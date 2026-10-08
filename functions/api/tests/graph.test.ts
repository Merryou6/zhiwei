/**
 * #32 GET /api/graph/mastery 测试（v2.1 技能树）
 *
 * 覆盖：
 *   - 未触及用户：全节点 mastery=0 / band=待巩固 / evidence_count=0 / confidence normal；
 *   - paper 证据触达 → confidence='low'（拍卷冷启动与复测闭环的咬合点）；
 *   - band 与 report/summary 同源一致（同一掌握度 → 同一带名）；
 *   - summary：band_counts 覆盖全部 kb 节点、evidence_total 求和、newly_mastered_7d 口径；
 *   - 越权（未登录 / 缺 space_id / 他人空间）。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildDedupKey, updateMastery, masteryToBand } from '../../../packages/engine/src/index';
import { nowIso } from '../src/context';
import { createTestApp, uniqueIdentifier, type TestApp } from './helpers';
import type { GraphMasteryData } from '../src/services/graph';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.cleanup();
});

describe('#32 graph/mastery · 鉴权与入参', () => {
  it('未登录 → 401；缺 space_id → 400；他人空间 → 403', async () => {
    const user = await app.register(uniqueIdentifier('graph'));

    const noAuth = await app.get('/api/graph/mastery', { query: { space_id: 'sp_x' } });
    expect(noAuth.code).toBe(401);

    const noSpace = await app.get('/api/graph/mastery', { token: user.token });
    expect(noSpace.code).toBe(400);

    const other = await app.register(uniqueIdentifier('graph'));
    const forbidden = await app.get('/api/graph/mastery', {
      token: user.token,
      query: { space_id: other.space_id },
    });
    expect(forbidden.code).toBe(403);
  });
});

describe('#32 graph/mastery · 空图谱（未触及用户）', () => {
  it('全节点待巩固、零证据、band_counts 覆盖全部节点', async () => {
    const user = await app.register(uniqueIdentifier('graph'));
    const response = await app.get<GraphMasteryData>('/api/graph/mastery', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(response.code).toBe(0);
    const data = response.data!;
    const totalKp = data.nodes.length;
    expect(totalKp).toBeGreaterThan(0);

    expect(data.summary.total_kp).toBe(totalKp);
    expect(data.summary.covered_kp).toBe(0);
    expect(data.summary.evidence_total).toBe(0);
    expect(data.summary.newly_mastered_7d).toBe(0);
    expect(data.summary.band_counts['待巩固']).toBe(totalKp);
    expect(data.summary.band_counts['已掌握']).toBe(0);
    // 未触及节点也在 weakest 里（mastery=0），供「去攻克」直达
    expect(data.summary.weakest.length).toBeGreaterThan(0);
    expect(data.nodes.every((node) => node.band === '待巩固' && node.confidence === 'normal')).toBe(true);
  });
});

describe('#32 graph/mastery · 证据触达后的口径', () => {
  it('paper 证据 → confidence=low；band 与 report/summary 同源；newly_mastered_7d 计数', async () => {
    const user = await app.register(uniqueIdentifier('graph'));
    const ctx = app.ctx;

    // 直写一条 paper 证据（上次归因路径：跨 kp 的「有理数」节点，mastery 推到已掌握区）
    const kpId = 'math.cz.number.rational';
    const nowMs = ctx.now();
    const dedupKey = buildDedupKey({
      userId: user.user_id,
      spaceId: user.space_id,
      kp: kpId,
      source: 'paper',
      unixTs: Math.floor(nowMs / 1000),
    });
    const eventId = 'evt_test_graph_1';
    const update = updateMastery(0, true, ctx.params.W_PAPER, ctx.params, eventId);
    await ctx.store.insertEvent({
      event_id: eventId,
      user_id: user.user_id,
      space_id: user.space_id,
      knowledge_point: kpId,
      item_id: null,
      source: 'paper',
      mode: null,
      result: 'correct',
      weight: ctx.params.W_PAPER,
      alpha: null,
      raw: {},
      dedup_key: dedupKey,
      expire_at: null,
      created_at: nowIso(nowMs),
    });
    await ctx.store.insertLog({
      log_id: 'log_test_graph_1',
      user_id: user.user_id,
      space_id: user.space_id,
      knowledge_point: kpId,
      before: update.before,
      p_obs: update.p_obs,
      p_eff: update.p_eff,
      after: update.after,
      weight: update.weight,
      triggered_by: eventId,
      created_at: nowIso(nowMs),
    });
    await ctx.store.upsertProfile({
      user_id: user.user_id,
      space_id: user.space_id,
      knowledge_point: kpId,
      mastery: update.after,
      evidence_count: 1,
      p_l0: 0,
      status: 'active',
      last_updated: nowIso(nowMs),
      last_evidence_type: 'paper',
    });

    const response = await app.get<GraphMasteryData>('/api/graph/mastery', {
      token: user.token,
      query: { space_id: user.space_id },
    });
    expect(response.code).toBe(0);
    const data = response.data!;

    const touched = data.nodes.find((node) => node.kp_id === kpId)!;
    expect(touched.mastery).toBe(update.after);
    expect(touched.band).toBe(masteryToBand(update.after));
    expect(touched.confidence).toBe('low');
    expect(touched.evidence_count).toBe(1);

    const untouched = data.nodes.find((node) => node.kp_id !== kpId)!;
    expect(untouched.confidence).toBe('normal');
    expect(untouched.evidence_count).toBe(0);

    expect(data.summary.covered_kp).toBe(1);
    expect(data.summary.evidence_total).toBe(1);
    expect(data.summary.newly_mastered_7d).toBe(update.after >= 0.8 ? 1 : 0);

    // 同源断言：#32 的 band_counts 与 report/summary 的 mastery 分带完全一致
    const report = await app.get<{
      mastery: { kp_id: string; mastery: number; status_band: string }[];
    }>('/api/report/summary', { token: user.token, query: { space_id: user.space_id } });
    expect(report.code).toBe(0);
    for (const row of report.data!.mastery) {
      const node = data.nodes.find((item) => item.kp_id === row.kp_id)!;
      expect(node.band).toBe(row.status_band);
    }
  });
});
