/**
 * 学习空间接口测试（契约 §2，接口 #3 list / #4 create / #5 drive）
 *
 * 覆盖：list 字段与 DATA_SCHEMA §4.2 一致 + 用户隔离；
 * create 409 冲突（existing_space_id）/ 400 非法 knowledge_source / 200 成功路径
 * （name 由服务端取知识库名、拒收客户端传入）；
 * drive 预置清单 + 越权 403 + 未认证 401 + 空间不存在 404。
 *
 * 说明：「200 成功路径」在真实调用序里天然被 409 遮蔽（register 已自动建默认空间，
 * 契约 §1 副作用），故用例先清空 spaces 表以构造「无同学科空间」的前置状态 ——
 * data/local_db 为可再生产物（计划 六、运行时生成），清表属正当测试前置。
 */

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface SpaceView {
  space_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

describe('space · 契约 §2 list', () => {
  it('新用户仅见 1 个默认空间，字段与 DATA_SCHEMA §4.2 一致', async () => {
    const user: TestUser = await app.register(uniqueIdentifier(), undefined, '小林');
    const res = await app.get<{ spaces: SpaceView[] }>('/api/space/list', { token: user.token });

    expect(res.code).toBe(0);
    expect(res.data?.spaces).toHaveLength(1);
    expect(Object.keys(res.data!.spaces[0]).sort()).toEqual(
      ['created_at', 'is_default', 'knowledge_source', 'name', 'space_id', 'subject'].sort(),
    );
  });

  it('用户隔离：B 用户看不到 A 用户的空间', async () => {
    const a: TestUser = await app.register(uniqueIdentifier());
    const b: TestUser = await app.register(uniqueIdentifier());

    const listB = await app.get<{ spaces: SpaceView[] }>('/api/space/list', { token: b.token });
    expect(listB.data?.spaces.map((s) => s.space_id)).not.toContain(a.space_id);
  });
});

describe('space · 契约 §2 create', () => {
  it('已存在同学科空间 → 409 且 data = { existing_space_id }', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.post<{ existing_space_id: string }>('/api/space/create', {
      knowledge_source: 'kb_math_cz',
    }, { token: user.token });

    expect(res.code).toBe(409);
    expect(res.data).toEqual({ existing_space_id: user.space_id });
  });

  it('非法 knowledge_source → 400（当前唯一合法值 kb_math_cz）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.post('/api/space/create', { knowledge_source: 'kb_physics_cz' }, {
      token: user.token,
    });
    expect(res.code).toBe(400);
    expect((await app.post('/api/space/create', {}, { token: user.token })).code).toBe(400);
  });

  it('无同学科空间时 create 成功 → { space_id, name }，name 由服务端取知识库名', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    await rm(join(app.storeDir, 'spaces.json')); // 构造「尚无空间」前置状态

    const res = await app.post<{ space_id: string; name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_cz', name: '客户端不该传这个' },
      { token: user.token },
    );

    expect(res.code).toBe(0);
    expect(res.data?.space_id).toMatch(/^sp_/);
    expect(res.data?.name).toBe('初中数学');
    expect(Object.keys(res.data!).sort()).toEqual(['name', 'space_id']);

    const list = await app.get<{ spaces: SpaceView[] }>('/api/space/list', { token: user.token });
    expect(list.data?.spaces).toHaveLength(1);
    expect(list.data?.spaces[0].is_default).toBe(false);
  });

  it('未认证 → 401', async () => {
    expect((await app.post('/api/space/create', { knowledge_source: 'kb_math_cz' })).code).toBe(401);
  });
});

describe('space · 契约 §2 drive', () => {
  it('返回预置 2 条文件（课标 + 教材）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.get<{ files: { file_id: string; name: string; type: string; size: number }[] }>(
      `/api/space/${user.space_id}/drive`,
      { token: user.token },
    );

    expect(res.code).toBe(0);
    expect(res.data?.files).toHaveLength(2);
    expect(res.data?.files[0].file_id).toMatch(/^file_preset_/);
    expect(Object.keys(res.data!.files[0]).sort()).toEqual(['file_id', 'name', 'size', 'type'].sort());
  });

  it('跨用户访问 space_id → 403（E3）', async () => {
    const a: TestUser = await app.register(uniqueIdentifier());
    const b: TestUser = await app.register(uniqueIdentifier());

    const res = await app.get(`/api/space/${a.space_id}/drive`, { token: b.token });
    expect(res.code).toBe(403);
  });

  it('空间不存在 → 404；未认证 → 401', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    expect((await app.get('/api/space/sp_not_exists/drive', { token: user.token })).code).toBe(404);
    expect((await app.get(`/api/space/${user.space_id}/drive`)).code).toBe(401);
  });

  it('方法不被支持（POST drive）→ 404 JSON（契约 §0 无 405，见 D-2）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.post(`/api/space/${user.space_id}/drive`, {}, { token: user.token });
    expect(res.code).toBe(404);
    expect(res.msg).toContain('请求方法不被支持');
  });
});
