/**
 * 学习空间接口测试（契约 §2，接口 #3 list / #4 create / #5 drive）
 *
 * 覆盖：list 字段与 DATA_SCHEMA §4.2 一致 + 用户隔离；
 * create（v1.2 口径）409 同名冲突（existing_space_id）/ 400 非法 knowledge_source /
 * 400 name 校验（字符串 / 非空白 / ≤30 字）/ 200 成功（缺省取知识库名 + 同学科多空间）；
 * drive 预置清单 + 越权 403 + 未认证 401 + 空间不存在 404。
 *
 * 说明：create 成功路径在真实调用序里会被「同名」遮蔽（register 已自动建默认空间，
 * 名为知识库名），故用例先清空 spaces 表、或显式传入不同的 name 来构造前置状态 ——
 * data/local_db 为可再生产物（计划 六、运行时生成），清表属正当测试前置。
 *
 * v1.2 变更（2026-09-24）：唯一约束由「每学科每用户一个空间」改为「同用户内空间名唯一」，
 * 故原「已存在同学科空间 → 409」用例改判**同名**（断言结构不变），原「无同学科空间时
 * create 成功」用例拆为 (a)–(f) 六例。
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

describe('space · 契约 §2 create（v1.2：同用户同名唯一）', () => {
  it('不传 name 且已有同名空间（默认空间名 = 初中数学）→ 409 且 data = { existing_space_id }', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.post<{ existing_space_id: string }>('/api/space/create', {
      knowledge_source: 'kb_math_cz',
    }, { token: user.token });

    expect(res.code).toBe(409);
    expect(res.data).toEqual({ existing_space_id: user.space_id });
  });

  it('非法 knowledge_source → 400（当前合法值 kb_math_cz / kb_math_gz）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const res = await app.post('/api/space/create', { knowledge_source: 'kb_physics_cz' }, {
      token: user.token,
    });
    expect(res.code).toBe(400);
    expect((await app.post('/api/space/create', {}, { token: user.token })).code).toBe(400);
  });

  it('(a) 清空空间表后不传 name → 200，name 取知识库名，键恰为 [name, space_id]', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    await rm(join(app.storeDir, 'spaces.json')); // 构造「尚无空间」前置状态

    const res = await app.post<{ space_id: string; name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_cz' },
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

  it('(b) 已有默认空间时同名学科传新 name → 200，同学科多空间（D1 核心行为）', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());

    const res = await app.post<{ space_id: string; name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_cz', name: '我的错题本' },
      { token: user.token },
    );

    expect(res.code).toBe(0);
    expect(res.data?.name).toBe('我的错题本');

    const list = await app.get<{ spaces: SpaceView[] }>('/api/space/list', { token: user.token });
    expect(list.data?.spaces).toHaveLength(2);
    expect(list.data?.spaces.map((s) => s.name).sort()).toEqual(['初中数学', '我的错题本'].sort());
    const created = list.data!.spaces.find((s) => s.space_id === res.data!.space_id);
    expect(created?.is_default).toBe(false);
    expect(created?.knowledge_source).toEqual(['kb_math_cz']);
  });

  it('(c) 传与已有空间相同的 name → 409 + existing_space_id', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());

    const res = await app.post<{ existing_space_id: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_gz', name: '初中数学' },
      { token: user.token },
    );

    expect(res.code).toBe(409);
    expect(res.data).toEqual({ existing_space_id: user.space_id });
  });

  it('(d) name 空串 / 全空白 / 超 30 字 / 非字符串 → 400', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());
    const base = { knowledge_source: 'kb_math_cz' };

    expect((await app.post('/api/space/create', { ...base, name: '' }, { token: user.token })).code).toBe(400);
    expect((await app.post('/api/space/create', { ...base, name: '   ' }, { token: user.token })).code).toBe(400);
    expect((await app.post('/api/space/create', { ...base, name: '一'.repeat(32) }, { token: user.token })).code).toBe(400);
    expect((await app.post('/api/space/create', { ...base, name: 123 }, { token: user.token })).code).toBe(400);
  });

  it('(e) knowledge_source = kb_math_gz 不传 name → 200，name = 高中数学', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());

    const res = await app.post<{ space_id: string; name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_gz' },
      { token: user.token },
    );

    expect(res.code).toBe(0);
    expect(res.data?.name).toBe('高中数学');

    const list = await app.get<{ spaces: SpaceView[] }>('/api/space/list', { token: user.token });
    expect(list.data?.spaces).toHaveLength(2);
  });

  it('(f) name 首尾空白被 trim；恰 30 字为合法边界', async () => {
    const user: TestUser = await app.register(uniqueIdentifier());

    const trimmed = await app.post<{ name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_cz', name: '  我的错题本  ' },
      { token: user.token },
    );
    expect(trimmed.code).toBe(0);
    expect(trimmed.data?.name).toBe('我的错题本');

    const exact30 = '一二三四五六七八九十'.repeat(3); // 恰 30 字
    const res = await app.post<{ name: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_cz', name: exact30 },
      { token: user.token },
    );
    expect(exact30).toHaveLength(30);
    expect(res.code).toBe(0);
    expect(res.data?.name).toBe(exact30);
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
