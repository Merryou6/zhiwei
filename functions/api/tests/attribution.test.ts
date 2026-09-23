/**
 * 归因接口测试（契约 §7，接口 #13 analyze / #14 get / #15 verify / #16 agent/reject）
 *
 * 覆盖（ALGORITHM §4 服务端落地）：
 *   - upstream（prerequisite_gap）：BFS ≤MAX_DEPTH、嫌疑分公式与上界（d=1 ≤0.60、d=2 ≤0.36）、
 *     降序 + (1−mastery) 单调性、path 完整 id 且终点=根因、验证题取 train 池最低难度未做题
 *   - self（concept_confusion）：path=[kp]、verification_item=null、suspect_scores={}
 *   - none（procedural_slip / misreading）→ 400（服务端防御，不进归因）
 *   - verify：答对确认根因 / 答错推进次高嫌疑 / 全部排除诚实回落 from_kp / 验证题写 diagnose 证据
 *   - reject：rejected_by_student=true + 追加再验证题 / 候选耗尽 → null
 *   - analyze 后立即 GET 字段一致；404 / 403 / 401
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const FROM_KP = 'math.cz.quadratic.extremum';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface AnalyzeData {
  attribution_id: string;
  root_cause: string;
  path: string[];
  suspect_scores: Record<string, number>;
  verification_item: { item_id: string; stem: string; options: string[] | null } | null;
}

interface GetData extends AnalyzeData {
  from_kp: string;
  error_type: string;
  verified: boolean;
  verified_by: string | null;
  rejected_by_student: boolean;
}

interface VerifyData {
  verified: boolean;
  correct: boolean;
  root_cause: string;
  next_candidate: {
    kp_id: string;
    suspect_score: number;
    verification_item: { item_id: string } | null;
  } | null;
}

const analyze = (user: TestUser, kpId: string, errorType: string) =>
  app.post<AnalyzeData>(
    '/api/attribution/analyze',
    { space_id: user.space_id, kp_id: kpId, error_type: errorType },
    { token: user.token },
  );

const getAttribution = (user: TestUser, id: string) =>
  app.get<GetData>(`/api/attribution/${id}`, { token: user.token });

const verify = (user: TestUser, attributionId: string, itemId: string, answer: string) =>
  app.post<VerifyData>(
    '/api/attribution/verify',
    { attribution_id: attributionId, item_id: itemId, answer },
    { token: user.token },
  );

const reject = (user: TestUser, attributionId: string, reason?: string) =>
  app.post<{ verification_item: { item_id: string } | null }>(
    '/api/agent/reject',
    { attribution_id: attributionId, reason },
    { token: user.token },
  );

/** 该 kp 的 train 池最低难度未做题（与 attributionCore.pickVerificationItem 同口径）。 */
function expectedVerificationItem(kpId: string, used: string[] = []): string | null {
  const candidates = SD.itemsByKpPool(kpId, 'train').filter((item) => !used.includes(item.item_id));
  return candidates[0]?.item_id ?? null;
}

/** 一个「确定的错误作答」：优先用 distractor 答案，否则用空作答（D10：空作答判 wrong）。 */
function wrongAnswer(itemId: string): string {
  return SD.itemById.get(itemId)?.distractors[0]?.answer ?? '';
}describe('attribution · 契约 §7 analyze（upstream 回溯）', () => {
  it('prerequisite_gap → BFS ≤MAX_DEPTH + 嫌疑分公式（上界 d=1 ≤0.60、d=2 ≤0.36）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await analyze(user, FROM_KP, 'prerequisite_gap');

    expect(res.code).toBe(0);
    const data = res.data!;
    expect(data.attribution_id).toMatch(/^attr_/);

    // 深度 ≤ MAX_DEPTH(3)：extremum 的 d=1 先修 vertex_form；d=2 function.graph/completing_square；
    // d=3 algebra.identity/function.concept/quadratic.eq_concept；d=4（algebra.basic）必须缺席
    const scores = data.suspect_scores;
    expect(Object.keys(scores)).toHaveLength(6);
    expect(scores['math.cz.quadratic.vertex_form']).toBeCloseTo(0.6, 10);
    expect(scores['math.cz.function.graph']).toBeCloseTo(0.36, 10);
    expect(scores['math.cz.quadratic.completing_square']).toBeCloseTo(0.36, 10);
    expect(scores['math.cz.algebra.basic']).toBeUndefined();
    for (const score of Object.values(scores)) expect(score).toBeLessThanOrEqual(0.6);

    // 降序 + (1−mastery) 单调性：无画像时 mastery=0，得分仅由 0.6^d 决定
    const ordered = Object.entries(scores);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i - 1][1]).toBeGreaterThanOrEqual(ordered[i][1]);
    }

    // 根因 = 最高嫌疑；path 完整 id 且终点 = 根因
    expect(data.root_cause).toBe('math.cz.quadratic.vertex_form');
    expect(data.path).toEqual([FROM_KP, 'math.cz.quadratic.vertex_form']);

    // 验证题 = 根因 kp 的 train 池最低难度未做题（vertex_form 的 diff=1 题）
    expect(data.verification_item?.item_id).toBe('q_cz_vertex_001');
    expect(expectedVerificationItem('math.cz.quadratic.vertex_form')).toBe('q_cz_vertex_001');
    expect(Object.keys(data.verification_item!).sort()).toEqual(['item_id', 'options', 'stem'].sort());
  });

  it('嫌疑分随 (1−mastery) 变化并重排候选（已掌握先修被降权）', async () => {
    const user = await app.register(uniqueIdentifier());
    // 自报「二次函数」level 3 → vertex_form mastery=0.5（score = 0.6×0.5 = 0.30 < 0.36）
    await app.post(
      '/api/evidence/self-report',
      { space_id: user.space_id, reports: [{ chapter: '二次函数', level: 3 }] },
      { token: user.token },
    );

    const res = await analyze(user, FROM_KP, 'prerequisite_gap');
    const data = res.data!;

    expect(data.suspect_scores['math.cz.quadratic.vertex_form']).toBeCloseTo(0.3, 10);
    expect(data.suspect_scores['math.cz.function.graph']).toBeCloseTo(0.36, 10);
    expect(data.root_cause).toBe('math.cz.function.graph');
    expect(data.path).toEqual([FROM_KP, 'math.cz.quadratic.vertex_form', 'math.cz.function.graph']);
  });

  it('concept_confusion → path=[kp]、suspect_scores={}、verification_item=null（self 不回溯）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await analyze(user, FROM_KP, 'concept_confusion');

    expect(res.code).toBe(0);
    expect(res.data?.path).toEqual([FROM_KP]);
    expect(res.data?.root_cause).toBe(FROM_KP);
    expect(res.data?.suspect_scores).toEqual({});
    expect(res.data?.verification_item).toBeNull();
  });

  it('procedural_slip / misreading → 400（契约 §7 前置，服务端防御）', async () => {
    const user = await app.register(uniqueIdentifier());
    expect((await analyze(user, FROM_KP, 'procedural_slip')).code).toBe(400);
    expect((await analyze(user, FROM_KP, 'misreading')).code).toBe(400);
    expect((await analyze(user, FROM_KP, 'not_a_type')).code).toBe(400);
    expect((await analyze(user, 'math.nc.zzz', 'prerequisite_gap')).code).toBe(400);
  });

  it('无先修可回溯的根节点 → 如实回落本节点（不硬猜）', async () => {
    const user = await app.register(uniqueIdentifier());
    // 2026-09-23 图谱加深后 algebra.basic 有先修了；真正的根节点是有理数运算
    const res = await analyze(user, 'math.cz.number.rational', 'prerequisite_gap');

    expect(res.code).toBe(0);
    expect(res.data?.suspect_scores).toEqual({});
    expect(res.data?.root_cause).toBe('math.cz.number.rational');
    expect(res.data?.path).toEqual(['math.cz.number.rational']);
    expect(res.data?.verification_item).toBeNull();
  });
});

describe('attribution · 契约 §7 get / verify', () => {
  it('analyze 后立即 GET 字段一致（含 verification_item 与 rejected_by_student）', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const fetched = await getAttribution(user, created.data!.attribution_id);

    expect(fetched.code).toBe(0);
    expect(fetched.data?.attribution_id).toBe(created.data!.attribution_id);
    expect(fetched.data?.root_cause).toBe(created.data!.root_cause);
    expect(fetched.data?.path).toEqual(created.data!.path);
    expect(fetched.data?.suspect_scores).toEqual(created.data!.suspect_scores);
    expect(fetched.data?.verification_item).toEqual(created.data!.verification_item);
    expect(fetched.data?.from_kp).toBe(FROM_KP);
    expect(fetched.data?.error_type).toBe('prerequisite_gap');
    expect(fetched.data?.verified).toBe(false);
    expect(fetched.data?.verified_by).toBeNull();
    expect(fetched.data?.rejected_by_student).toBe(false);
  });

  it('verify 答对 → verified=true、root_cause=首候选、next_candidate=null，并写 diagnose 证据', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const itemId = created.data!.verification_item!.item_id;
    const item = SD.itemById.get(itemId)!;

    const res = await verify(user, created.data!.attribution_id, itemId, item.answer);

    expect(res.code).toBe(0);
    expect(res.data?.correct).toBe(true);
    expect(res.data?.verified).toBe(true);
    expect(res.data?.root_cause).toBe('math.cz.quadratic.vertex_form');
    expect(res.data?.next_candidate).toBeNull();

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('diagnose');
    expect(events[0].mode).toBe('diagnose');
    expect(events[0].item_id).toBe(itemId);
    expect(events[0].weight).toBeCloseTo(app.ctx.params.W_DIAGNOSE, 10);
    expect(events[0].knowledge_point).toBe('math.cz.quadratic.vertex_form');

    const fetched = await getAttribution(user, created.data!.attribution_id);
    expect(fetched.data?.verified).toBe(true);
    expect(fetched.data?.verified_by).toBe(events[0].event_id);
  });

  it('verify 答错一次 → 排除当前候选，next_candidate=次高嫌疑及其验证题', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const firstItemId = created.data!.verification_item!.item_id;

    const res = await verify(user, created.data!.attribution_id, firstItemId, wrongAnswer(firstItemId));

    expect(res.code).toBe(0);
    expect(res.data?.correct).toBe(false);
    expect(res.data?.verified).toBe(false);
    expect(res.data?.next_candidate?.kp_id).toBe('math.cz.function.graph');
    expect(res.data?.next_candidate?.suspect_score).toBeCloseTo(0.36, 10);
    expect(res.data?.next_candidate?.verification_item?.item_id).toBe(
      expectedVerificationItem('math.cz.function.graph', [firstItemId]),
    );
  });

  it('连续答错至候选全部排除 → root_cause 回落 from_kp、verified=true（诚实兜底）', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    let current = created.data!.verification_item!.item_id;
    const visited: string[] = [];

    for (let hop = 0; hop < 6; hop += 1) {
      const res = await verify(user, id, current, wrongAnswer(current));
      expect(res.code).toBe(0);
      expect(res.data?.correct).toBe(false);
      visited.push(SD.itemById.get(current)!.knowledge_point);

      if (!res.data?.next_candidate) {
        expect(res.data?.verified).toBe(true);
        expect(res.data?.root_cause).toBe(FROM_KP);
        break;
      }
      expect(res.data.next_candidate.verification_item).not.toBeNull();
      current = res.data.next_candidate.verification_item!.item_id;
    }

    // 六个候选（d≤3）依次被排除后如实回落本节点
    expect(visited).toHaveLength(6);
    expect(new Set(visited).size).toBe(6);
    expect(visited[0]).toBe('math.cz.quadratic.vertex_form');

    const fetched = await getAttribution(user, id);
    expect(fetched.data?.root_cause).toBe(FROM_KP);
    expect(fetched.data?.path).toEqual([FROM_KP]);
    expect(fetched.data?.verified).toBe(true);
  });

  it('verify 题目不存在 → 404；attribution 不存在 → 404；缺 answer → 400', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    expect((await verify(user, id, 'q_not_exists', 'x')).code).toBe(404);
    expect((await verify(user, 'attr_not_exists', 'q_cz_vertex_001', 'x')).code).toBe(404);
    expect(
      (
        await app.post(
          '/api/attribution/verify',
          { attribution_id: id, item_id: 'q_cz_vertex_001' },
          { token: user.token },
        )
      ).code,
    ).toBe(400);
  });

  // ---- MINOR-①（迭代3 清偿）：验证题必须属于当前候选集
  it('MINOR-①：传非候选集的题 → 400「这不是当前的验证题，先完成手头这道」', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    // extremum 的 d≤3 候选集 = {vertex_form, function.graph, completing_square,
    //                          algebra.identity, function.concept, eq_concept}；
    // translation 的题不在其中（旧题 / 前端传错题的典型情形）
    const outsider = SD.itemsByKpPool('math.cz.quadratic.translation', 'train')[0];
    expect(created.data!.suspect_scores[outsider.knowledge_point]).toBeUndefined();

    const res = await verify(user, id, outsider.item_id, outsider.answer);
    expect(res.code).toBe(400);
    expect(res.msg).toBe('这不是当前的验证题，先完成手头这道');

    // 被拒绝后状态不变：不写证据、不推进候选游标
    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
    const fetched = await getAttribution(user, id);
    expect(fetched.data?.root_cause).toBe('math.cz.quadratic.vertex_form');
    expect(fetched.data?.verified).toBe(false);
  });

  it('MINOR-①：候选集内的其它题仍正常通过（只排除该候选，不误伤）', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    // 次高嫌疑 function.graph 的题（候选集内，但非当前第一嫌疑）
    const secondKp = 'math.cz.function.graph';
    expect(Object.keys(created.data!.suspect_scores)).toContain(secondKp);
    const item = SD.itemsByKpPool(secondKp, 'train')[0];

    const res = await verify(user, id, item.item_id, wrongAnswer(item.item_id));
    expect(res.code).toBe(0);
    expect(res.data?.correct).toBe(false);
    // 该候选被排除，root_cause 回到剩余候选的第一位（vertex_form）
    expect(res.data?.root_cause).toBe('math.cz.quadratic.vertex_form');
    expect(res.data?.next_candidate?.kp_id).toBe('math.cz.quadratic.vertex_form');

    const fetched = await getAttribution(user, id);
    expect(fetched.data?.suspect_scores[secondKp]).toBeCloseTo(0.36, 10);
  });
});

describe('attribution · 契约 §7 agent/reject', () => {
  it('reject → rejected_by_student=true（GET 可见）且追加一道再验证题', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    const res = await reject(user, id, '我觉得不是这个知识点的问题');
    expect(res.code).toBe(0);
    expect(res.data?.verification_item?.item_id).toBe(
      expectedVerificationItem('math.cz.function.graph'),
    );

    const fetched = await getAttribution(user, id);
    expect(fetched.data?.rejected_by_student).toBe(true);
    expect(fetched.data?.root_cause).toBe('math.cz.function.graph');
    expect(fetched.data?.verification_item?.item_id).toBe(
      expectedVerificationItem('math.cz.function.graph'),
    );
  });

  it('候选耗尽后 reject → root_cause 回落 from_kp、verification_item=null', async () => {
    const user = await app.register(uniqueIdentifier());
    const created = await analyze(user, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    for (let hop = 0; hop < 6; hop += 1) {
      const res = await reject(user, id);
      expect(res.code).toBe(0);
      if (!res.data?.verification_item) break;
    }

    const last = await reject(user, id);
    expect(last.data?.verification_item).toBeNull();

    const fetched = await getAttribution(user, id);
    expect(fetched.data?.rejected_by_student).toBe(true);
    expect(fetched.data?.root_cause).toBe(FROM_KP);
    expect(fetched.data?.path).toEqual([FROM_KP]);
    expect(fetched.data?.verified).toBe(true);
  });
});

describe('attribution · 契约 §0 归属校验', () => {
  it('他人 attribution → 403（get / verify / reject 三处）；未认证 → 401', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());
    const created = await analyze(a, FROM_KP, 'prerequisite_gap');
    const id = created.data!.attribution_id;

    expect((await getAttribution(b, id)).code).toBe(403);
    expect((await verify(b, id, 'q_cz_vertex_001', 'x')).code).toBe(403);
    expect((await reject(b, id)).code).toBe(403);

    expect((await app.get(`/api/attribution/${id}`)).code).toBe(401);
  });

  it('prerequisite_gap 的嫌疑分为 object（完整 kp id 键，非数组）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await analyze(user, FROM_KP, 'prerequisite_gap');
    const scores = res.data!.suspect_scores as Record<string, number>;
    expect(Array.isArray(scores)).toBe(false);
    for (const key of Object.keys(scores)) {
      expect(key.startsWith('math.cz.')).toBe(true);
    }
  });
});
