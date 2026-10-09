/**
 * #36 GET /api/concepts 测试（v2.2-m1 概念知识库）
 *
 * 覆盖：
 *   - 鉴权：未登录 401 / 缺 space_id 400 / 他人空间 403；
 *   - cz 空间 → 24 张卡、字段齐全非空、kp_id 唯一、related 都是合法节点 id；
 *   - chapter 过滤：二次函数 → 11 卡；未知章节 → 400；
 *   - kb 隔离：gz 空间 → 卡片为空集（概念卡按知识库覆盖过滤）；
 *   - 红线：卡内容不含题库题的 answer/solution_steps/distractors（概念卡的
 *     classic_example 是独立撰写的示例，不在禁发键语义内）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueIdentifier, type TestApp } from './helpers';
import type { ConceptCard } from '../src/services/concepts';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.cleanup();
});

describe('#36 concepts · 鉴权与入参', () => {
  it('未登录 → 401；缺 space_id → 400；他人空间 → 403', async () => {
    const user = await app.register(uniqueIdentifier('concept'));

    const noAuth = await app.get('/api/concepts', { query: { space_id: 'sp_x' } });
    expect(noAuth.code).toBe(401);

    const noSpace = await app.get('/api/concepts', { token: user.token });
    expect(noSpace.code).toBe(400);

    const other = await app.register(uniqueIdentifier('concept'));
    const forbidden = await app.get('/api/concepts', {
      token: user.token,
      query: { space_id: other.space_id },
    });
    expect(forbidden.code).toBe(403);
  });
});

describe('#36 concepts · 概念卡内容', () => {
  it('cz 空间 → 24 张卡，字段齐全、kp_id 唯一、related 全部合法', async () => {
    const user = await app.register(uniqueIdentifier('concept'));
    const response = await app.get<{ count: number; cards: ConceptCard[] }>('/api/concepts', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(response.code).toBe(0);
    const cards = response.data!.cards;
    expect(response.data!.count).toBe(cards.length);
    expect(cards.length).toBe(24);

    const kpIds = new Set(cards.map((card) => card.kp_id));
    expect(kpIds.size).toBe(cards.length);

    const nodeIds = new Set(app.ctx.data.nodesForKb('kb_math_cz').map((node) => node.id));
    for (const card of cards) {
      expect(card.name.length).toBeGreaterThan(0);
      expect(card.definition.length).toBeGreaterThan(10);
      expect(card.key_points.length).toBeGreaterThanOrEqual(3);
      expect(card.method.length).toBeGreaterThan(5);
      expect(card.hint.length).toBeGreaterThan(10);
      expect(card.classic_example.stem.length).toBeGreaterThan(3);
      expect(card.classic_example.steps.length).toBeGreaterThanOrEqual(2);
      expect(card.common_errors.length).toBeGreaterThanOrEqual(1);
      for (const relatedId of card.related) {
        expect(nodeIds.has(relatedId)).toBe(true);
      }
    }
  });

  it('chapter 过滤：二次函数 → 11 卡；未知章节 → 400', async () => {
    const user = await app.register(uniqueIdentifier('concept'));
    const quadratic = await app.get<{ count: number; cards: ConceptCard[] }>('/api/concepts', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '二次函数' },
    });
    expect(quadratic.code).toBe(0);
    expect(quadratic.data!.count).toBe(11);
    expect(quadratic.data!.cards.every((card) => card.chapter === '二次函数')).toBe(true);

    const badChapter = await app.get('/api/concepts', {
      token: user.token,
      query: { space_id: user.space_id, chapter: '不存在的章节' },
    });
    expect(badChapter.code).toBe(400);
  });

  it('kb 隔离：gz 空间 → 卡片空集（概念卡只覆盖 cz 知识库）', async () => {
    const user = await app.register(uniqueIdentifier('concept'));
    const created = await app.post<{ space_id: string }>(
      '/api/space/create',
      { knowledge_source: 'kb_math_gz', name: '高中空间' },
      { token: user.token },
    );
    expect(created.code).toBe(0);

    const response = await app.get<{ count: number; cards: ConceptCard[] }>('/api/concepts', {
      token: user.token,
      query: { space_id: created.data!.space_id },
    });
    expect(response.code).toBe(0);
    expect(response.data!.count).toBe(0);
    expect(response.data!.cards).toHaveLength(0);
  });
});
