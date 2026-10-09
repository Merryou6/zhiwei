/**
 * #34 GET /api/practice/ladder + #35 GET /api/practice/progress 测试（v2.2-m1 专项阶梯）
 *
 * 覆盖：
 *   - 鉴权：未登录 401 / 缺 space_id 或 chapter 400 / 他人空间 403；未知章节 400；
 *   - 阶梯：难度升序（由易到难）、默认 5 题、size 夹取 [1, 8]、
 *     每题带 approach/hint 提示链（非空）、不含禁发键；
 *   - 排除已练：practice 证据里的题不再出现在新梯子中；全练完 → refill 回流整章 + refilled=true；
 *   - 进度：空 → 零口径；插入 practice 事件 → 按章节聚合（提交数/去重题数/正确数/
 *     平均通过率/最近时间）；chapter 过滤；非 practice 证据（paper）不计数；
 *   - 整体口径 overall 与分章聚合一致。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDedupKey } from '../../../packages/engine/src/index';
import { nowIso } from '../src/context';
import { createTestApp, uniqueIdentifier, type TestApp } from './helpers';
import type { LadderData, PracticeProgressData } from '../src/services/practice';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.cleanup();
});

/** 直插一条 evidence 事件（source/result/题干可指定），专注阶梯/进度聚合口径。 */
async function seedEvent(options: {
  userId: string;
  spaceId: string;
  kpId: string;
  itemId: string | null;
  source: 'practice' | 'paper';
  result: 'correct' | 'wrong';
  passRatio?: number;
}): Promise<void> {
  const ctx = app.ctx;
  const nowMs = ctx.now();
  await ctx.store.insertEvent({
    event_id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    user_id: options.userId,
    space_id: options.spaceId,
    knowledge_point: options.kpId,
    item_id: options.itemId,
    source: options.source,
    mode: null,
    result: options.result,
    weight: 0.7,
    alpha: null,
    raw: options.passRatio === undefined ? {} : { pass_ratio: options.passRatio },
    dedup_key: buildDedupKey({
      userId: options.userId,
      spaceId: options.spaceId,
      kp: options.kpId,
      source: options.source,
      unixTs: Math.floor(nowMs / 1000),
    }),
    expire_at: null,
    created_at: nowIso(nowMs),
  });
}

describe('#34 practice/ladder · 鉴权与入参', () => {
  it('未登录 401；缺 space_id 400；缺 chapter 400；他人空间 403；未知章节 400', async () => {
    const user = await app.register(uniqueIdentifier('ladder'));

    const noAuth = await app.get('/api/practice/ladder', {
      query: { space_id: user.space_id, chapter: '二次函数' },
    });
    expect(noAuth.code).toBe(401);

    const noSpace = await app.get('/api/practice/ladder', {
      token: user.token,
      query: { chapter: '二次函数' },
    });
    expect(noSpace.code).toBe(400);

    const noChapter = await app.get('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(noChapter.code).toBe(400);

    const other = await app.register(uniqueIdentifier('ladder'));
    const forbidden = await app.get('/api/practice/ladder', {
      token: user.token,
      query: { space_id: other.space_id, chapter: '二次函数' },
    });
    expect(forbidden.code).toBe(403);

    const badChapter = await app.get('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '不存在的章节' },
    });
    expect(badChapter.code).toBe(400);
  });
});

describe('#34 practice/ladder · 阶梯口径', () => {
  it('默认 5 题、难度升序、提示链非空、无禁发键', async () => {
    const user = await app.register(uniqueIdentifier('ladder'));
    const response = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '二次函数' },
    });
    expect(response.code).toBe(0);
    const data = response.data!;

    expect(data.items.length).toBe(5);
    expect(data.refilled).toBe(false);
    const difficulties = data.items.map((item) => item.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));

    for (const item of data.items) {
      expect(item.seq).toBeGreaterThan(0);
      expect(item.stem.length).toBeGreaterThan(3);
      expect(item.approach.length).toBeGreaterThan(3);
      expect(item.hint.length).toBeGreaterThan(3);
      expect(item.chapter).toBe('二次函数');
    }
    // 红线：响应 JSON 不含禁发键（answer / solution_steps / distractors）
    const raw = JSON.stringify(data);
    expect(raw).not.toContain('"answer"');
    expect(raw).not.toContain('"solution_steps"');
    expect(raw).not.toContain('"distractors"');
  });

  it('size 夹取 [1, 8]', async () => {
    const user = await app.register(uniqueIdentifier('ladder'));
    const oversized = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '二次函数', size: '99' },
    });
    expect(oversized.code).toBe(0);
    expect(oversized.data!.requested_size).toBe(8);
    expect(oversized.data!.items.length).toBeLessThanOrEqual(8);

    const tiny = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '二次函数', size: '1' },
    });
    expect(tiny.code).toBe(0);
    expect(tiny.data!.items.length).toBe(1);
  });

  it('已练的题不再出现在新梯子；全章练完 → refill 回流 + refilled=true', async () => {
    const user = await app.register(uniqueIdentifier('ladder'));
    const chapter = '二次函数';

    // 第一轮：取 8 题，把其中第一题标为已练
    const first = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter, size: '8' },
    });
    expect(first.code).toBe(0);
    const head = first.data!.items[0];
    await seedEvent({
      userId: user.user_id,
      spaceId: user.space_id,
      kpId: head.kp_id,
      itemId: head.item_id,
      source: 'practice',
      result: 'correct',
      passRatio: 1,
    });

    const second = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter, size: '8' },
    });
    expect(second.code).toBe(0);
    expect(second.data!.refilled).toBe(false);
    expect(second.data!.items.some((item) => item.item_id === head.item_id)).toBe(false);

    // 全章 train 池都标为已练 → 回流（refilled=true，题目可重复出现，阶梯仍由易到难）
    const chapterNodeIds = new Set(
      app.ctx.data
        .nodesForKb('kb_math_cz')
        .filter((node) => node.chapter === chapter)
        .map((node) => node.id),
    );
    const trainItems = app.ctx.data
      .itemsForKb('kb_math_cz')
      .filter((item) => item.pool === 'train' && chapterNodeIds.has(item.knowledge_point));
    expect(trainItems.length).toBeGreaterThan(0);
    for (const item of trainItems) {
      await seedEvent({
        userId: user.user_id,
        spaceId: user.space_id,
        kpId: item.knowledge_point,
        itemId: item.item_id,
        source: 'practice',
        result: 'correct',
        passRatio: 1,
      });
    }

    const third = await app.get<LadderData>('/api/practice/ladder', {
      token: user.token,
      query: { space_id: user.space_id, chapter, size: '8' },
    });
    expect(third.code).toBe(0);
    expect(third.data!.refilled).toBe(true);
    const difficulties = third.data!.items.map((item) => item.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });
});

describe('#35 practice/progress · 进度聚合', () => {
  it('零练习 → chapters 空、overall 零口径', async () => {
    const user = await app.register(uniqueIdentifier('progress'));
    const response = await app.get<PracticeProgressData>('/api/practice/progress', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(response.code).toBe(0);
    expect(response.data!.chapters).toHaveLength(0);
    expect(response.data!.overall.submissions).toBe(0);
    expect(response.data!.overall.practiced_items).toBe(0);
    expect(response.data!.overall.correct).toBe(0);
    expect(response.data!.overall.avg_pass_ratio).toBeNull();
    expect(response.data!.overall.last_practiced_at).toBeNull();
  });

  it('按章节聚合：提交数 / 去重题数 / 正确数 / 平均通过率；chapter 过滤；paper 证据不计数', async () => {
    const user = await app.register(uniqueIdentifier('progress'));

    // 有理数章：2 次提交（1 对 pass=1；1 错 pass=0.5）
    await seedEvent({
      userId: user.user_id,
      spaceId: user.space_id,
      kpId: 'math.cz.number.rational',
      itemId: 'q_lad_a',
      source: 'practice',
      result: 'correct',
      passRatio: 1,
    });
    await seedEvent({
      userId: user.user_id,
      spaceId: user.space_id,
      kpId: 'math.cz.number.rational',
      itemId: 'q_lad_b',
      source: 'practice',
      result: 'wrong',
      passRatio: 0.5,
    });
    // 二次函数章：1 次提交
    await seedEvent({
      userId: user.user_id,
      spaceId: user.space_id,
      kpId: 'math.cz.quadratic.formula',
      itemId: 'q_lad_c',
      source: 'practice',
      result: 'correct',
      passRatio: 0.8,
    });
    // paper 证据（不应计入 practice 进度）
    await seedEvent({
      userId: user.user_id,
      spaceId: user.space_id,
      kpId: 'math.cz.number.rational',
      itemId: null,
      source: 'paper',
      result: 'correct',
    });

    const response = await app.get<PracticeProgressData>('/api/practice/progress', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(response.code).toBe(0);
    const data = response.data!;

    expect(data.chapters.length).toBe(2);
    const rational = data.chapters.find((row) => row.chapter === '有理数')!;
    expect(rational.submissions).toBe(2);
    expect(rational.practiced_items).toBe(2);
    expect(rational.correct).toBe(1);
    expect(rational.avg_pass_ratio).toBeCloseTo(0.75, 5);
    expect(rational.last_practiced_at).not.toBeNull();

    const overall = data.overall;
    expect(overall.submissions).toBe(3);
    expect(overall.practiced_items).toBe(3);
    expect(overall.correct).toBe(2);
    expect(overall.avg_pass_ratio).toBeCloseTo((1 + 0.5 + 0.8) / 3, 5);

    // chapter 过滤：只看有理数
    const filtered = await app.get<PracticeProgressData>('/api/practice/progress', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '有理数' },
    });
    expect(filtered.code).toBe(0);
    expect(filtered.data!.chapters.length).toBe(1);
    expect(filtered.data!.chapters[0].chapter).toBe('有理数');
    expect(filtered.data!.overall.submissions).toBe(2);
  });
});
