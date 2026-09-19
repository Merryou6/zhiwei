/**
 * 认证接口测试（契约 §1 / §0，接口 #1 register、#2 login）
 *
 * 覆盖：注册成功（token + 默认空间副作用）／409 重复 identifier／400 密码过短／
 * nickname 缺省；login 正确与失败（D16 统一 401 话术）；受保护接口鉴权
 * （缺失 / 伪造 / 过期 / 用户不存在）；时间格式与 ID 前缀（E4）。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { signToken } from '../src/context';
import { DEFAULT_PASSWORD, createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

interface RegisterData {
  user_id: string;
  token: string;
}

interface SpaceView {
  space_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

describe('auth · 契约 §1 register', () => {
  it('注册成功返回 u_ 前缀 user_id 与 token，并自动创建默认空间（§1 副作用）', async () => {
    const identifier = uniqueIdentifier();
    const res = await app.post<RegisterData>('/api/auth/register', {
      identifier,
      password: DEFAULT_PASSWORD,
      nickname: '小林',
    });

    expect(res.code).toBe(0);
    expect(res.msg).toEqual(expect.any(String));
    expect(res.data?.user_id).toMatch(/^u_/);
    expect(typeof res.data?.token).toBe('string');

    const list = await app.get<{ spaces: SpaceView[] }>('/api/space/list', {
      token: res.data?.token,
    });
    expect(list.code).toBe(0);
    expect(list.data?.spaces).toHaveLength(1);

    const space = list.data!.spaces[0];
    expect(space.space_id).toMatch(/^sp_/);
    expect(space.name).toBe('初中数学');
    expect(space.subject).toBe('数学');
    expect(space.knowledge_source).toEqual(['kb_math_cz']);
    expect(space.is_default).toBe(true);
    expect(space.created_at).toMatch(ISO_UTC);
  });

  it('重复 identifier → 409（契约 §1）', async () => {
    const identifier = uniqueIdentifier();
    expect((await app.post('/api/auth/register', { identifier, password: DEFAULT_PASSWORD })).code).toBe(0);

    const again = await app.post('/api/auth/register', { identifier, password: DEFAULT_PASSWORD });
    expect(again.code).toBe(409);
    expect(again.data).toBeNull();
  });

  it('password 少于 6 位 → 400；缺 password → 400；identifier 为空 → 400', async () => {
    const identifier = uniqueIdentifier();
    expect((await app.post('/api/auth/register', { identifier, password: '12345' })).code).toBe(400);
    expect((await app.post('/api/auth/register', { identifier })).code).toBe(400);
    expect((await app.post('/api/auth/register', { identifier: '   ', password: DEFAULT_PASSWORD })).code).toBe(400);
  });

  it('nickname 缺省可注册，落库为 null（DATA_SCHEMA §4.1）', async () => {
    const identifier = uniqueIdentifier();
    const res = await app.post<RegisterData>('/api/auth/register', {
      identifier,
      password: DEFAULT_PASSWORD,
    });
    expect(res.code).toBe(0);

    const user = await app.ctx.store.findUserByIdentifier(identifier);
    expect(user?.nickname).toBeNull();
    expect(user?.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(user?.created_at).toMatch(ISO_UTC);
  });
});

describe('auth · 契约 §1 login', () => {
  it('正确凭证返回可用的新 token', async () => {
    const identifier = uniqueIdentifier();
    const registered = await app.register(identifier, DEFAULT_PASSWORD, '小林');

    const res = await app.login(identifier, DEFAULT_PASSWORD);
    expect(res.code).toBe(0);
    expect(res.data?.user_id).toBe(registered.user_id);

    const list = await app.get<{ spaces: SpaceView[] }>('/api/space/list', {
      token: res.data?.token,
    });
    expect(list.code).toBe(0);
    expect(list.data?.spaces).toHaveLength(1);
  });

  it('错误密码与不存在的账号均 → 401 且话术一致（D16 不泄露存在性）', async () => {
    const identifier = uniqueIdentifier();
    await app.register(identifier, DEFAULT_PASSWORD);

    const wrongPassword = await app.login(identifier, 'wrong-password');
    const missingUser = await app.login(uniqueIdentifier(), DEFAULT_PASSWORD);

    expect(wrongPassword.code).toBe(401);
    expect(missingUser.code).toBe(401);
    expect(wrongPassword.msg).toBe(missingUser.msg);
    expect(wrongPassword.data).toBeNull();
  });

  it('password 为空 / identifier 为空 → 400', async () => {
    expect((await app.post('/api/auth/login', { identifier: 'x', password: '' })).code).toBe(400);
    expect((await app.post('/api/auth/login', { identifier: '', password: 'x' })).code).toBe(400);
  });
});

describe('auth · 契约 §0 受保护接口鉴权', () => {
  it('缺少 Authorization → 401；格式非法 → 401', async () => {
    expect((await app.get('/api/space/list')).code).toBe(401);
    expect((await app.get('/api/space/list', { headers: { authorization: 'Token abc' } })).code).toBe(401);
  });

  it('伪造签名 / 篡改 payload → 401', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const forged = `${user.token.split('.')[0]}.forgedsignature`;
    expect((await app.get('/api/space/list', { token: forged })).code).toBe(401);
  });

  it('过期 token → 401（exp 语义）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const now = Math.floor(Date.now() / 1000);
    const expired = signToken(user.user_id, { iat: now - 40 * 24 * 3600, exp: now - 10 });
    expect((await app.get('/api/space/list', { token: expired })).code).toBe(401);
  });

  it('签名有效但用户不存在 → 401', async () => {
    expect((await app.get('/api/space/list', { token: signToken('u_not_exists') })).code).toBe(401);
  });
});
