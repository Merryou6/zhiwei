/**
 * 自报先验接口测试（契约 §3，接口 #6 POST /api/evidence/self-report，通路四）
 *
 * 覆盖：章节 → 全部 kp 落 p_l0/mastery（PRIOR_MAP 经引擎 priorFor）；
 * evidence_count>0 的知识点不被覆盖（真实证据优先）；不产生 evidence_events；
 * 参数校验（≤6 项 / level 1–5 / 章节存在）与 401/403。
 */

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

const selfReport = (user: TestUser, reports: unknown) =>
  app.post<{ updated: number }>(
    '/api/evidence/self-report',
    { space_id: user.space_id, reports },
    { token: user.token },
  );

const SECONDARY_CHAPTER = '二次函数';
const SECONDARY_KP_COUNT = 11;

describe('selfReport · 契约 §3 章节 → 先验写入', () => {
  it('章节「二次函数」level 2 → 该章节全部 kp 的 p_l0 与 mastery = 0.30（PRIOR_MAP）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 2 }]);

    expect(res.code).toBe(0);
    expect(res.data?.updated).toBe(SECONDARY_KP_COUNT);

    const expected = app.ctx.params.PRIOR_MAP['2'];
    expect(expected).toBeCloseTo(0.3, 10);

    for (const node of app.ctx.data.nodesByChapter(SECONDARY_CHAPTER)) {
      const profile = await app.ctx.store.getProfile(user.user_id, user.space_id, node.id);
      expect(profile?.p_l0).toBeCloseTo(0.3, 10);
      expect(profile?.mastery).toBeCloseTo(0.3, 10);
      expect(profile?.evidence_count).toBe(0);
      expect(profile?.status).toBe('active');
      expect(profile?.last_evidence_type).toBeNull();
    }
  });

  it('level 5 → 0.85；未自报章节的知识点不产生记录', async () => {
    const user = await app.register(uniqueIdentifier());
    await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 5 }]);

    const profile = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      'math.cz.quadratic.extremum',
    );
    expect(profile?.mastery).toBeCloseTo(0.85, 10);

    const untouched = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      'math.cz.algebra.basic',
    );
    expect(untouched).toBeNull();
  });

  it('不产生 evidence_events（自报是先验，不是观测）', async () => {
    const user = await app.register(uniqueIdentifier());
    await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 3 }]);

    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
  });

  it('evidence_count > 0 的知识点不被覆盖，且不计入 updated', async () => {
    const user = await app.register(uniqueIdentifier());
    await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 3 }]);

    // 制造一条真实观测（diagnose 提交），使 translation 的 evidence_count = 1
    const target = app.ctx.data.itemById.get('q_cz_translate_001')!;
    const submitted = await app.post(
      '/api/diagnose/submit',
      {
        space_id: user.space_id,
        item_id: target.item_id,
        answer: target.answer,
        mode: 'diagnose',
      },
      { token: user.token },
    );
    expect(submitted.code).toBe(0);

    const before = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      target.knowledge_point,
    );
    expect(before?.evidence_count).toBe(1);

    const res = await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 1 }]);
    expect(res.data?.updated).toBe(SECONDARY_KP_COUNT - 1);

    const after = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      target.knowledge_point,
    );
    expect(after?.mastery).toBeCloseTo(before!.mastery, 10);
    expect(after?.p_l0).toBeCloseTo(before!.p_l0, 10);
    expect(after?.evidence_count).toBe(1);

    // 其余知识点被覆盖为 level 1 的先验
    const other = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      'math.cz.quadratic.extremum',
    );
    expect(other?.mastery).toBeCloseTo(app.ctx.params.PRIOR_MAP['1'], 10);
  });

  it('evidence_count = 0 时可被重复自报覆盖（非观测记录）', async () => {
    const user = await app.register(uniqueIdentifier());
    await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 1 }]);
    await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 4 }]);

    const profile = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      'math.cz.quadratic.opening',
    );
    expect(profile?.mastery).toBeCloseTo(app.ctx.params.PRIOR_MAP['4'], 10);
  });
});

describe('selfReport · 契约 §3 参数校验与鉴权', () => {
  it('章节不存在 → 400；level 越界/非整数 → 400', async () => {
    const user = await app.register(uniqueIdentifier());
    expect((await selfReport(user, [{ chapter: '不存在的章节', level: 3 }])).code).toBe(400);
    expect((await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 0 }])).code).toBe(400);
    expect((await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 6 }])).code).toBe(400);
    expect((await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: 1.5 }])).code).toBe(400);
    expect((await selfReport(user, [{ chapter: SECONDARY_CHAPTER, level: '3' }])).code).toBe(400);
  });

  it('reports 超过 6 项 → 400；非数组 → 400', async () => {
    const user = await app.register(uniqueIdentifier());
    const seven = Array.from({ length: 7 }, () => ({ chapter: SECONDARY_CHAPTER, level: 3 }));
    expect((await selfReport(user, seven)).code).toBe(400);
    expect((await selfReport(user, { chapter: SECONDARY_CHAPTER, level: 3 })).code).toBe(400);

    const six = Array.from({ length: 6 }, () => ({ chapter: SECONDARY_CHAPTER, level: 3 }));
    expect((await selfReport(user, six)).code).toBe(0);
  });

  it('跨用户 space_id → 403；未认证 → 401；缺 space_id → 400', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());

    expect((await selfReport(b, [{ chapter: SECONDARY_CHAPTER, level: 3 }])).code).toBe(0);
    const cross = await app.post(
      '/api/evidence/self-report',
      { space_id: a.space_id, reports: [{ chapter: SECONDARY_CHAPTER, level: 3 }] },
      { token: b.token },
    );
    expect(cross.code).toBe(403);

    const anonymous = await app.post('/api/evidence/self-report', {
      space_id: a.space_id,
      reports: [{ chapter: SECONDARY_CHAPTER, level: 3 }],
    });
    expect(anonymous.code).toBe(401);

    const missing = await app.post(
      '/api/evidence/self-report',
      { reports: [{ chapter: SECONDARY_CHAPTER, level: 3 }] },
      { token: a.token },
    );
    expect(missing.code).toBe(400);
  });
});
