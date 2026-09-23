/**
 * 学习报告接口测试（契约 §10，接口 #19 GET /api/report/summary；D12）
 *
 * 覆盖：mastery 全 20 节点（无画像 = 0 + 待巩固）与 status_band 边界（0.39/0.4/0.8 与引擎一致）；
 * gaps 仅含 mastery<0.4 且 error_type_last 取最近归因记录（无记录 → null）；
 * accuracy 按 evidence_events(source=diagnose) 的 mode 分组（baseline 1/3、retest 3/3 →
 * delta≈0.67），单侧缺失 → null，双侧皆无 → 不进列表；400/403/401。
 * 另含终审前修复 D15 的测量一致性集成用例：baseline 3 题 → retest 3 题落在同一批 kp，
 * accuracy 三行 baseline/retest/delta 均非 null；无基线证据时复测回退引擎原选题逻辑。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { masteryToBand, nextItem } from '../../../packages/engine/src/index';
import { loadStaticData } from '../src/data/staticData';
import type { EvidenceEventRecord } from '../src/db/types';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const KP = 'math.cz.quadratic.translation';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface ReportData {
  mastery: { kp_id: string; name: string; mastery: number; status_band: string }[];
  gaps: { kp_id: string; name: string; mastery: number; error_type_last: string | null }[];
  accuracy: { kp_id: string; baseline: number | null; retest: number | null; delta: number | null }[];
}

const summary = (user: TestUser) =>
  app.get<ReportData>('/api/report/summary', { token: user.token, query: { space_id: user.space_id } });

let seedSeq = 0;
async function seedEvent(
  user: TestUser,
  kp: string,
  mode: 'baseline' | 'retest' | 'diagnose',
  correct: boolean,
  itemId: string,
): Promise<void> {
  seedSeq += 1;
  const event: EvidenceEventRecord = {
    event_id: `evt_seed_${seedSeq}`,
    user_id: user.user_id,
    space_id: user.space_id,
    knowledge_point: kp,
    item_id: itemId,
    source: 'diagnose',
    mode,
    result: correct ? 'correct' : 'wrong',
    weight: app.ctx.params.W_DIAGNOSE,
    alpha: null,
    raw: {},
    dedup_key: `seed:${seedSeq}`,
    expire_at: null,
    created_at: '2026-09-19T10:00:00Z',
  };
  await app.ctx.store.insertEvent(event);
}

describe('report · 契约 §10 mastery 与 gaps', () => {
  it('mastery 输出该空间学段的全部节点；无画像者 mastery=0、status_band="待巩固"', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await summary(user);

    expect(res.code).toBe(0);
    const czIds = SD.nodesForKb('kb_math_cz').map((node) => node.id);
    expect(res.data?.mastery).toHaveLength(czIds.length);
    expect(res.data?.mastery.map((row) => row.kp_id)).toEqual(czIds);

    for (const row of res.data!.mastery) {
      expect(Object.keys(row).sort()).toEqual(['kp_id', 'mastery', 'name', 'status_band'].sort());
      expect(row.mastery).toBe(0);
      expect(row.status_band).toBe(masteryToBand(0));
      expect(row.status_band).toBe('待巩固');
    }
  });

  it('status_band 边界（0.39/0.4/0.8）与引擎 masteryToBand 一致', async () => {
    const user = await app.register(uniqueIdentifier());
    const cases: [string, number][] = [
      ['math.cz.quadratic.translation', 0.39],
      ['math.cz.quadratic.opening', 0.4],
      ['math.cz.quadratic.extremum', 0.8],
    ];
    for (const [kp, mastery] of cases) {
      await app.ctx.store.upsertProfile({
        user_id: user.user_id,
        space_id: user.space_id,
        knowledge_point: kp,
        mastery,
        evidence_count: 1,
        p_l0: 0.5,
        status: 'active',
        last_updated: '2026-09-19T10:00:00Z',
        last_evidence_type: 'diagnose',
      });
    }

    const res = await summary(user);
    for (const [kp, mastery] of cases) {
      const row = res.data!.mastery.find((entry) => entry.kp_id === kp)!;
      expect(row.mastery).toBeCloseTo(mastery, 10);
      expect(row.status_band).toBe(masteryToBand(mastery));
    }
    expect(masteryToBand(0.39)).toBe('待巩固');
    expect(masteryToBand(0.4)).toBe('不稳定');
    expect(masteryToBand(0.8)).toBe('已掌握');
  });

  it('gaps 仅含 mastery<0.4；error_type_last 取最近归因记录，无记录 → null', async () => {
    const user = await app.register(uniqueIdentifier());
    await app.post(
      '/api/evidence/self-report',
      { space_id: user.space_id, reports: [{ chapter: '二次函数', level: 1 }] },
      { token: user.token },
    );

    const analyzed = await app.post(
      '/api/attribution/analyze',
      { space_id: user.space_id, kp_id: 'math.cz.quadratic.extremum', error_type: 'concept_confusion' },
      { token: user.token },
    );
    expect(analyzed.code).toBe(0);

    const res = await summary(user);
    expect(res.data!.gaps.length).toBeGreaterThan(0);
    for (const gap of res.data!.gaps) {
      expect(gap.mastery).toBeLessThan(0.4);
    }

    const withAttribution = res.data!.gaps.find((gap) => gap.kp_id === 'math.cz.quadratic.extremum');
    expect(withAttribution?.error_type_last).toBe('concept_confusion');

    const withoutAttribution = res.data!.gaps.find(
      (gap) => gap.kp_id === 'math.cz.quadratic.translation',
    );
    expect(withoutAttribution).toBeDefined();
    expect(withoutAttribution?.error_type_last).toBeNull();

    // 0.85（level 5 已掌握档次）不在 gaps 中
    await app.ctx.store.upsertProfile({
      user_id: user.user_id,
      space_id: user.space_id,
      knowledge_point: 'math.cz.quadratic.vertex_form',
      mastery: 0.85,
      evidence_count: 2,
      p_l0: 0.5,
      status: 'active',
      last_updated: '2026-09-19T10:00:00Z',
      last_evidence_type: 'diagnose',
    });
    const after = await summary(user);
    expect(after.data!.gaps.map((gap) => gap.kp_id)).not.toContain('math.cz.quadratic.vertex_form');
  });
});

describe('report · 契约 §10 accuracy（mode 分组）', () => {
  it('baseline 1/3 对、retest 3/3 对 → baseline≈0.33、retest=1.0、delta≈0.67', async () => {
    const user = await app.register(uniqueIdentifier());
    const retestItems = SD.itemsByKpPool(KP, 'retest').map((item) => item.item_id);

    await seedEvent(user, KP, 'baseline', true, retestItems[0]);
    await seedEvent(user, KP, 'baseline', false, retestItems[1]);
    await seedEvent(user, KP, 'baseline', false, retestItems[2]);
    await seedEvent(user, KP, 'retest', true, retestItems[3]);
    await seedEvent(user, KP, 'retest', true, retestItems[4]);
    await seedEvent(user, KP, 'retest', true, retestItems[5]);

    const res = await summary(user);
    const row = res.data!.accuracy.find((entry) => entry.kp_id === KP)!;

    expect(row.baseline).toBeCloseTo(1 / 3, 10);
    expect(row.baseline).toBeCloseTo(0.33, 2);
    expect(row.retest).toBeCloseTo(1, 10);
    expect(row.delta).toBeCloseTo(1 - 1 / 3, 10);
    expect(row.delta).toBeGreaterThan(0);
  });

  it('单侧缺失 → 该侧 null 且 delta null；双侧皆无 → 不进 accuracy；source 非 diagnose 不计', async () => {
    const user = await app.register(uniqueIdentifier());
    const retestItems = SD.itemsByKpPool(KP, 'retest').map((item) => item.item_id);

    await seedEvent(user, KP, 'baseline', true, retestItems[0]);

    // silent 弱负证据（source ≠ diagnose）不参与 accuracy
    await seedEvent(user, 'math.cz.quadratic.opening', 'diagnose', true, retestItems[1]);
    await app.ctx.store.insertEvent({
      event_id: 'evt_silent_seed',
      user_id: user.user_id,
      space_id: user.space_id,
      knowledge_point: 'math.cz.quadratic.opening',
      item_id: null,
      source: 'silent',
      mode: null,
      result: 'wrong',
      weight: 0,
      alpha: 0.1,
      raw: {},
      dedup_key: 'silent:seed',
      expire_at: null,
      created_at: '2026-09-19T10:00:00Z',
    });

    const res = await summary(user);
    const baselineOnly = res.data!.accuracy.find((entry) => entry.kp_id === KP)!;
    expect(baselineOnly.baseline).toBeCloseTo(1, 10);
    expect(baselineOnly.retest).toBeNull();
    expect(baselineOnly.delta).toBeNull();

    // opening：仅 1 条 diagnose 事件但 mode=diagnose → 不进 accuracy（mode 只认 baseline/retest）
    expect(res.data!.accuracy.map((entry) => entry.kp_id)).not.toContain(
      'math.cz.quadratic.opening',
    );

    // 双侧皆无的 kp 不在列表中
    expect(res.data!.accuracy).toHaveLength(1);
  });
});

describe('report · §7/P0#11 测量一致性（retest 优先落在已有基线证据的 kp）', () => {
  const CHAPTERS = ['代数式', '函数', '一元二次方程', '二次函数'];

  interface ClientItemLite {
    item_id: string;
  }
  interface NextData {
    item: ClientItemLite | null;
    remaining: number;
    converged: boolean;
  }
  interface SubmitData {
    correct: boolean | null;
    converged: boolean;
    next_item: ClientItemLite | null;
  }

  /** 全章节自报 3 档 → 20 个 kp 掌握度 0.5（可测且 V=0.25，不立即收敛）。 */
  async function seedAllChaptersAt3(user: TestUser): Promise<void> {
    const res = await app.post(
      '/api/evidence/self-report',
      { space_id: user.space_id, reports: CHAPTERS.map((chapter) => ({ chapter, level: 3 })) },
      { token: user.token },
    );
    expect(res.code).toBe(0);
  }

  /** 走 count 题（next + submit），返回实际送达的 item_id 序列。 */
  async function runPhase(
    user: TestUser,
    mode: 'baseline' | 'retest',
    count: number,
    answerFor: (itemId: string) => string,
  ): Promise<string[]> {
    const served: string[] = [];
    const first = await app.post<NextData>(
      '/api/diagnose/next',
      { space_id: user.space_id, mode },
      { token: user.token },
    );
    expect(first.code).toBe(0);
    let item = first.data!.item;

    for (let i = 0; i < count; i += 1) {
      expect(item, `${mode} 第 ${i + 1} 题不应为 null`).not.toBeNull();
      const itemId = item!.item_id;
      served.push(itemId);
      const submitted = await app.post<SubmitData>(
        '/api/diagnose/submit',
        { space_id: user.space_id, mode, item_id: itemId, answer: answerFor(itemId) },
        { token: user.token },
      );
      expect(submitted.code).toBe(0);
      item = submitted.data!.next_item;
    }
    return served;
  }

  it('baseline 3 题（全错）→ retest 3 题（全对）→ 同批 3 个 kp 的 baseline/retest/delta 均非 null（delta=+1）', async () => {
    const user = await app.register(uniqueIdentifier());
    await seedAllChaptersAt3(user);

    const itemById = app.ctx.data.itemById;
    const kpOf = (itemId: string): string => itemById.get(itemId)!.knowledge_point;
    const answerOf = (itemId: string): string => itemById.get(itemId)!.answer;

    // 基线：3 题全错（'__wrong__' 既非标准答案也非任何干扰项）
    const baselineItems = await runPhase(user, 'baseline', 3, () => '__wrong__');
    // 复测：3 题全对（直接取题库标准答案，走真实 gradeItem 判定）
    const retestItems = await runPhase(user, 'retest', 3, answerOf);

    const baselineKps = baselineItems.map(kpOf);
    const retestKps = retestItems.map(kpOf);

    // PRD §7：复测与基线测同一批知识点（本题量下为 3 个不同 kp）
    expect(new Set(baselineKps).size).toBe(3);
    expect([...new Set(retestKps)].sort()).toEqual([...new Set(baselineKps)].sort());
    // PRD §7：复测题与基线题不重复（retest 池内为另外的题）
    for (const itemId of retestItems) expect(baselineItems).not.toContain(itemId);

    // P0 #11 / ALGORITHM §7：ΔAccuracy = retest − baseline，双侧均可得
    const res = await summary(user);
    const measured = res.data!.accuracy.filter((row) => baselineKps.includes(row.kp_id));
    expect(measured).toHaveLength(3);
    for (const row of measured) {
      expect(row.baseline).toBeCloseTo(0, 10);
      expect(row.retest).toBeCloseTo(1, 10);
      expect(row.delta).not.toBeNull();
      expect(row.delta).toBeCloseTo(row.retest! - row.baseline!, 10);
      expect(row.delta).toBeCloseTo(1, 10);
    }

    // 对照组：未被测量的 kp 不进 accuracy（双侧皆无 → 不造行）
    expect(res.data!.accuracy).toHaveLength(3);
  });

  it('无基线证据 → 复测回退引擎原选题逻辑（服务级不报错，行为与迭代 3 一致）', async () => {
    const user = await app.register(uniqueIdentifier());
    await seedAllChaptersAt3(user);

    const res = await app.post<NextData>(
      '/api/diagnose/next',
      { space_id: user.space_id, mode: 'retest' },
      { token: user.token },
    );
    expect(res.code).toBe(0);
    expect(res.data!.item).not.toBeNull();

    // 与直接调用引擎（不传 measureKps）的结果逐字一致
    const expected = nextItem({
      graph: SD.nodes.map((node) => ({ id: node.id, prerequisites: node.prerequisites })),
      bank: SD.items,
      mastery: Object.fromEntries(SD.nodes.map((node) => [node.id, 0.5])),
      mode: 'retest',
      usedItemIds: [],
      answeredCount: 0,
      params: app.ctx.params,
    });
    expect(res.data!.item!.item_id).toBe(expected.item!.item_id);

    // 复测事件已产生但无基线侧 → 该 kp 的 retest 非 null、baseline/delta 为 null（不伪造 delta）
    await app.post<SubmitData>(
      '/api/diagnose/submit',
      {
        space_id: user.space_id,
        mode: 'retest',
        item_id: res.data!.item!.item_id,
        answer: app.ctx.data.itemById.get(res.data!.item!.item_id)!.answer,
      },
      { token: user.token },
    );
    const report = await summary(user);
    const row = report.data!.accuracy.find(
      (entry) => entry.kp_id === app.ctx.data.itemById.get(res.data!.item!.item_id)!.knowledge_point,
    )!;
    expect(row.retest).toBeCloseTo(1, 10);
    expect(row.baseline).toBeNull();
    expect(row.delta).toBeNull();
  });
});

describe('report · 契约 §10/§0 校验与鉴权', () => {
  it('缺 space_id → 400；空间不存在 → 404；跨用户 → 403；未认证 → 401', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());

    expect((await app.get('/api/report/summary', { token: a.token })).code).toBe(400);
    expect(
      (await app.get('/api/report/summary', { token: a.token, query: { space_id: 'sp_nope' } })).code,
    ).toBe(404);
    expect(
      (await app.get('/api/report/summary', { token: b.token, query: { space_id: a.space_id } })).code,
    ).toBe(403);
    expect(
      (await app.get('/api/report/summary', { query: { space_id: a.space_id } })).code,
    ).toBe(401);
  });
});
