/**
 * 用户资料接口测试（契约 §1，接口 #20 GET /api/user/profile · v1.2 新增，只读）
 *
 * 覆盖：未认证 401；注册后 user 键集恰为四字段 + spaces 与 §2 list 同形 + model 默认 local；
 * 「响应整体不含 password_hash / salt」红线；nickname 透传与 null 兜底；
 * 环境变量分支（ZHIWEI_MODEL_MODE=remote + ZHIWEI_LLM_MODEL）→ mode/name。
 *
 * 说明：本接口无 space_id 入参，越权面在设计上不存在（计划 D4c / R3）。
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

interface ProfileUserView {
  user_id: string;
  identifier: string;
  nickname: string | null;
  created_at: string;
}

interface SpaceView {
  space_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

interface ProfileData {
  user: ProfileUserView;
  spaces: SpaceView[];
  model: { mode: 'local' | 'remote'; name: string | null };
}

describe('profile · 契约 §1 #20 GET /api/user/profile（只读）', () => {
  it('未认证 → 401（与全接口一致的 requireAuth 覆盖）', async () => {
    expect((await app.get('/api/user/profile')).code).toBe(401);
  });

  it('注册后 GET：code=0；user 键恰为四字段；spaces 与 §2 list 同形；model 默认 local', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.get<ProfileData>('/api/user/profile', { token: user.token });

    expect(res.code).toBe(0);
    expect(Object.keys(res.data!.user).sort()).toEqual(
      ['created_at', 'identifier', 'nickname', 'user_id'].sort(),
    );
    expect(res.data!.user.user_id).toBe(user.user_id);
    expect(res.data!.user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

    expect(res.data!.spaces).toHaveLength(1);
    expect(res.data!.spaces[0].space_id).toBe(user.space_id);
    expect(Object.keys(res.data!.spaces[0]).sort()).toEqual(
      ['created_at', 'is_default', 'knowledge_source', 'name', 'space_id', 'subject'].sort(),
    );

    expect(res.data!.model).toEqual({ mode: 'local', name: null });
  });

  it('响应全文不含 password_hash 与 salt（红线断言）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.get<ProfileData>('/api/user/profile', { token: user.token });

    const raw = JSON.stringify(res);
    expect(raw).not.toContain('password_hash');
    expect(raw).not.toContain('salt');
  });

  it('nickname 透传：注册时传「小林」→ 原样；未传 → null', async () => {
    const named: TestUser = await app.register(uniqueIdentifier(), undefined, '小林');
    const namedRes = await app.get<ProfileData>('/api/user/profile', { token: named.token });
    expect(namedRes.data!.user.nickname).toBe('小林');

    const anonymous: TestUser = await app.register(uniqueIdentifier());
    const anonRes = await app.get<ProfileData>('/api/user/profile', { token: anonymous.token });
    expect(anonRes.data!.user.nickname).toBeNull();
  });

  it('环境变量分支：ZHIWEI_MODEL_MODE=remote + ZHIWEI_LLM_MODEL → mode=remote / name 透传', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());

    vi.stubEnv('ZHIWEI_MODEL_MODE', 'remote');
    vi.stubEnv('ZHIWEI_LLM_MODEL', 'deepseek-chat');
    const remote = await app.get<ProfileData>('/api/user/profile', { token: user.token });
    expect(remote.data!.model).toEqual({ mode: 'remote', name: 'deepseek-chat' });

    // 非 remote 值（如 "local"）→ local 且 name 恒为 null（不泄露模型名）
    vi.stubEnv('ZHIWEI_MODEL_MODE', 'local');
    const local = await app.get<ProfileData>('/api/user/profile', { token: user.token });
    expect(local.data!.model).toEqual({ mode: 'local', name: null });
  });
});
