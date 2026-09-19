/**
 * 测评接口测试（契约 §4，接口 #7 next / #8 submit；通路三 w = 1.0）
 *
 * 覆盖：池推导（diagnose→train、baseline/retest→retest）、已做题排除、拓扑剪枝、
 * 收敛（方差 / 题量上限）、remaining、correct 仅测量模式返回、三段式 0.845 自检场景、
 * mastery_logs 全字段留痕、**D7 事件级幂等**（同 item 重交不重复计分；
 * 同 kp 第二道不同题同小时正常计分）、序列化白名单（answer/solution_steps 零下发）、
 * 401/403/400 校验。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import type { BankItemRecord } from '../src/data/staticData';
import { REPO_ROOT, createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);

function bankItem(itemId: string): BankItemRecord {
  const item = SD.itemById.get(itemId);
  if (!item) throw new Error(`题库中不存在 ${itemId}`);
  return item;
}

let app: TestApp;

/** 固定时钟：使小时桶（dedup_key 第五段）确定，D7「同小时」断言不受真实时间影响。 */
const FIXED_NOW = Date.parse('2026-09-19T10:00:00Z');

beforeEach(async () => {
  app = await createTestApp({ now: () => FIXED_NOW });
});

afterEach(async () => {
  await app.cleanup();
});

interface ClientItem {
  item_id: string;
  stem: string;
  options: string[] | null;
}

interface NextData {
  item: ClientItem | null;
  remaining: number;
  converged: boolean;
}

interface SubmitData {
  correct: boolean | null;
  mastery_before: number;
  mastery_after: number;
  converged: boolean;
  next_item: ClientItem | null;
}

type Mode = 'diagnose' | 'baseline' | 'retest';

/** 注册 + 自报「二次函数」level 3（PRIOR_MAP 3 → 全部 0.50），获得受控初始态。 */
async function bootstrap(): Promise<TestUser> {
  const user = await app.register(uniqueIdentifier());
  const res = await app.post(
    '/api/evidence/self-report',
    { space_id: user.space_id, reports: [{ chapter: '二次函数', level: 3 }] },
    { token: user.token },
  );
  expect(res.code).toBe(0);
  return user;
}

const askNext = (user: TestUser, mode: Mode = 'diagnose', extra: Record<string, unknown> = {}) =>
  app.post<NextData>('/api/diagnose/next', { space_id: user.space_id, mode, ...extra }, {
    token: user.token,
  });

const submitItem = (
  user: TestUser,
  itemId: string,
  answer: string,
  mode: Mode = 'diagnose',
) =>
  app.post<SubmitData>(
    '/api/diagnose/submit',
    { space_id: user.space_id, item_id: itemId, answer, mode },
    { token: user.token },
  );

describe('diagnose · 契约 §4 选题（池推导 / 已做排除 / 剪枝 / 收敛）', () => {
  it('diagnose 出 train 池题；baseline 与 retest 出 retest 池题', async () => {
    const user = await bootstrap();

    const diagnose = await askNext(user, 'diagnose');
    expect(diagnose.code).toBe(0);
    expect(diagnose.data?.item).not.toBeNull();
    expect(bankItem(diagnose.data!.item!.item_id).pool).toBe('train');

    const baseline = await askNext(user, 'baseline');
    expect(bankItem(baseline.data!.item!.item_id).pool).toBe('retest');

    const retest = await askNext(user, 'retest');
    expect(bankItem(retest.data!.item!.item_id).pool).toBe('retest');
  });

  it('响应 item 仅含契约白名单字段（无 answer / solution_steps，E5）', async () => {
    const user = await bootstrap();
    const res = await askNext(user);

    expect(Object.keys(res.data!.item!).sort()).toEqual(['item_id', 'options', 'stem'].sort());
    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain('"answer"');
    expect(serialized).not.toContain('"solution_steps"');
    expect(serialized).not.toContain('"distractors"');
  });

  it('不重复出已做题：exclude_item_ids 命中后换题', async () => {
    const user = await bootstrap();
    const first = await askNext(user);
    const firstId = first.data!.item!.item_id;

    const second = await askNext(user, 'diagnose', { exclude_item_ids: [firstId] });
    expect(second.data!.item!.item_id).not.toBe(firstId);

    // 提交后该题进入 evidence_events，服务端自动排除
    const target = bankItem(firstId);
    await submitItem(user, firstId, target.answer);
    const afterSubmit = await askNext(user);
    expect(afterSubmit.data!.item!.item_id).not.toBe(firstId);
  });

  it('拓扑剪枝：返回题的 kp 其全部直接先修 mastery ≥ PRUNE_THRESHOLD', async () => {
    const user = await bootstrap();
    const res = await askNext(user);
    const kp = bankItem(res.data!.item!.item_id).knowledge_point;

    const node = app.ctx.data.nodeById.get(kp)!;
    expect(node.prerequisites.length).toBeGreaterThan(0);
    for (const prereq of node.prerequisites) {
      const profile = await app.ctx.store.getProfile(user.user_id, user.space_id, prereq);
      expect(profile?.mastery ?? 0).toBeGreaterThanOrEqual(app.ctx.params.PRUNE_THRESHOLD);
    }
  });

  it('remaining = MAX_ITEMS − 已答数（mode 分组计数）', async () => {
    const user = await bootstrap();
    expect((await askNext(user)).data?.remaining).toBe(app.ctx.params.MAX_ITEMS);

    const target = bankItem('q_cz_translate_001');
    await submitItem(user, target.item_id, target.answer, 'diagnose');
    expect((await askNext(user, 'diagnose')).data?.remaining).toBe(app.ctx.params.MAX_ITEMS - 1);

    // 另一 mode 的事件不计入本 mode 的已答数
    const retestItem = bankItem('q_cz_translate_006');
    await submitItem(user, retestItem.item_id, retestItem.answer, 'baseline');
    expect((await askNext(user, 'diagnose')).data?.remaining).toBe(app.ctx.params.MAX_ITEMS - 1);
  });

  it('收敛（方差）：可测 kp 的 V = P(1−P) < CONV_VAR → converged=true、item=null', async () => {
    const user = await bootstrap();
    for (const node of app.ctx.data.nodes) {
      await app.ctx.store.upsertProfile({
        user_id: user.user_id,
        space_id: user.space_id,
        knowledge_point: node.id,
        mastery: 0.95,
        evidence_count: 1,
        p_l0: 0.5,
        status: 'active',
        last_updated: '2026-09-19T00:00:00Z',
        last_evidence_type: 'diagnose',
      });
    }

    expect(0.95 * (1 - 0.95)).toBeLessThan(app.ctx.params.CONV_VAR);
    const res = await askNext(user);
    expect(res.data?.converged).toBe(true);
    expect(res.data?.item).toBeNull();
  });

  it('收敛（题量上限）：answeredCount ≥ MAX_ITEMS → converged=true、item=null、remaining=0', async () => {
    const user = await bootstrap();
    const trainItems = SD.itemsByKpPool('math.cz.quadratic.application', 'train');

    for (let i = 0; i < app.ctx.params.MAX_ITEMS; i += 1) {
      await app.ctx.store.insertEvent({
        event_id: `evt_seed_${i}`,
        user_id: user.user_id,
        space_id: user.space_id,
        knowledge_point: trainItems[i % trainItems.length].knowledge_point,
        item_id: trainItems[i % trainItems.length].item_id,
        source: 'diagnose',
        mode: 'diagnose',
        result: 'wrong',
        weight: app.ctx.params.W_DIAGNOSE,
        alpha: null,
        raw: {},
        dedup_key: `seed:${i}`,
        expire_at: null,
        created_at: '2026-09-19T00:00:00Z',
      });
    }

    const res = await askNext(user);
    expect(res.data?.converged).toBe(true);
    expect(res.data?.item).toBeNull();
    expect(res.data?.remaining).toBe(0);
  });

  it('scope_chapter 过滤图谱：仅章节内知识点参与选题', async () => {
    const user = await bootstrap();
    const res = await askNext(user, 'diagnose', { scope_chapter: '二次函数' });
    expect(res.code).toBe(0);
    const kp = bankItem(res.data!.item!.item_id).knowledge_point;
    expect(app.ctx.data.nodeById.get(kp)?.chapter).toBe('二次函数');

    expect((await askNext(user, 'diagnose', { scope_chapter: '不存在章节' })).code).toBe(400);
  });
});

describe('diagnose · 契约 §4 提交（判定 / BKT / 留痕 / correct 口径）', () => {
  it('答对（0.50 → 0.845 自检场景）且 diagnose 模式 correct 恒为 null', async () => {
    const user = await bootstrap();
    const target = bankItem('q_cz_translate_001');
    const res = await submitItem(user, target.item_id, target.answer, 'diagnose');

    expect(res.code).toBe(0);
    expect(res.data?.mastery_before).toBeCloseTo(0.5, 10);
    expect(res.data?.mastery_after).toBeCloseTo(0.845, 3);
    expect(res.data?.correct).toBeNull();
    expect(res.data?.next_item).not.toBeNull();
    expect(res.data?.converged).toBe(false);
  });

  it('答错（用 distractor 答案）→ 0.50 → 0.244（w=1.0 自检场景）', async () => {
    const user = await bootstrap();
    const target = bankItem('q_cz_translate_001');
    const distractor = target.distractors[0].answer;

    const res = await submitItem(user, target.item_id, distractor, 'diagnose');
    expect(res.data?.mastery_after).toBeCloseTo(0.244, 3);
    expect(res.data?.correct).toBeNull();

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events[0].result).toBe('wrong');
    expect(events[0].raw.matched_error_code).toBe(target.distractors[0].typical_error_code);
  });

  it('baseline 模式 correct 有值（布尔），retest 同理', async () => {
    const user = await bootstrap();
    const baselineItem = bankItem('q_cz_translate_006');
    const correct = await submitItem(user, baselineItem.item_id, baselineItem.answer, 'baseline');
    expect(correct.data?.correct).toBe(true);

    const retestItem = bankItem('q_cz_translate_007');
    const wrong = await submitItem(
      user,
      retestItem.item_id,
      retestItem.distractors[0].answer,
      'retest',
    );
    expect(wrong.data?.correct).toBe(false);
    expect(wrong.data!.mastery_after).toBeLessThan(wrong.data!.mastery_before);
  });

  it('mastery_logs 全字段留痕（before/p_obs/p_eff/after/weight/triggered_by，D13 同源）', async () => {
    const user = await bootstrap();
    const target = bankItem('q_cz_translate_002');
    await submitItem(user, target.item_id, target.answer);

    const logs = await app.ctx.store.listLogsBySpace(user.space_id);
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(Object.keys(log).sort()).toEqual(
      [
        'after',
        'before',
        'created_at',
        'knowledge_point',
        'log_id',
        'p_eff',
        'p_obs',
        'space_id',
        'triggered_by',
        'user_id',
        'weight',
      ].sort(),
    );
    expect(log.log_id).toMatch(/^log_/);
    expect(log.triggered_by).toMatch(/^evt_/);
    expect(log.weight).toBeCloseTo(app.ctx.params.W_DIAGNOSE, 10);
    expect(log.before).toBeCloseTo(0.5, 10);
    expect(log.p_obs).toBeCloseTo(0.818, 3);
    expect(log.p_eff).toBeCloseTo(0.818, 3);
    expect(log.after).toBeCloseTo(0.845, 3);
    expect(log.knowledge_point).toBe(target.knowledge_point);

    // triggered_by 必须指向真实存在的事件（可解释性闭环）
    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events.map((event) => event.event_id)).toContain(log.triggered_by);
    expect(events[0].mode).toBe('diagnose');
    expect(events[0].source).toBe('diagnose');
    expect(events[0].item_id).toBe(target.item_id);
  });

  it('幂等（D7）：同 item 同答案重交 → mastery_after 不变、证据与日志不新增', async () => {
    const user = await bootstrap();
    const target = bankItem('q_cz_translate_002');

    const first = await submitItem(user, target.item_id, target.answer);
    expect(first.data?.mastery_after).toBeCloseTo(0.845, 3);

    const again = await submitItem(user, target.item_id, target.answer);
    expect(again.code).toBe(0);
    expect(again.data?.mastery_before).toBeCloseTo(first.data!.mastery_after, 10);
    expect(again.data?.mastery_after).toBeCloseTo(first.data!.mastery_after, 10);

    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(1);
    expect(await app.ctx.store.listLogsBySpace(user.space_id)).toHaveLength(1);
  });

  it('D7 核心：同 kp 第二道不同题同小时正常计分（dedup_key 相同、事件 2 条）', async () => {
    const user = await bootstrap();
    const kp = 'math.cz.quadratic.translation';
    const first = bankItem('q_cz_translate_001');
    const second = bankItem('q_cz_translate_002');

    const wrong = await submitItem(user, first.item_id, first.distractors[0].answer);
    expect(wrong.data?.mastery_after).toBeCloseTo(0.244, 3);

    const next = await submitItem(user, second.item_id, second.answer);
    expect(next.data?.mastery_before).toBeCloseTo(0.244, 3);
    expect(next.data!.mastery_after).toBeGreaterThan(next.data!.mastery_before);

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.knowledge_point === kp)).toBe(true);
    // 键结构逐字遵循 ALGORITHM §1（不含 item_id）→ 两题同键
    expect(events[0].dedup_key).toBe(events[1].dedup_key);
    expect(new Set(events.map((event) => event.item_id)).size).toBe(2);
    expect(await app.ctx.store.listLogsBySpace(user.space_id)).toHaveLength(2);
  });
});

describe('diagnose · 契约 §4/§0 校验与鉴权', () => {
  it('mode 非法/缺失 → 400；item_id 不存在 → 404；answer 非字符串 → 400', async () => {
    const user = await bootstrap();
    expect((await app.post('/api/diagnose/next', { space_id: user.space_id }, { token: user.token })).code).toBe(400);
    expect((await askNext(user, 'unknown' as Mode)).code).toBe(400);

    const target = bankItem('q_cz_translate_001');
    expect((await submitItem(user, 'q_not_exists', 'x')).code).toBe(404);
    const bad = await app.post(
      '/api/diagnose/submit',
      { space_id: user.space_id, item_id: target.item_id, answer: 42, mode: 'diagnose' },
      { token: user.token },
    );
    expect(bad.code).toBe(400);
  });

  it('跨用户 space_id → 403（E3）；未认证 → 401', async () => {
    const a = await bootstrap();
    const b = await bootstrap();

    const res = await app.post(
      '/api/diagnose/next',
      { space_id: a.space_id, mode: 'diagnose' },
      { token: b.token },
    );
    expect(res.code).toBe(403);

    expect((await app.post('/api/diagnose/next', { space_id: a.space_id, mode: 'diagnose' })).code).toBe(401);
  });
});
