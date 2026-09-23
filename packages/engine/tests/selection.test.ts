/**
 * 自适应选题单测（ALGORITHM §2）
 *
 * 计划 步骤 8 用例清单：
 *   S1 拓扑剪枝：先修 mastery=0.3 < 0.40 → 后继不可测，出现在 prunedKps
 *   S2 根节点（先修为空）天然可测
 *   S3 信息增益：mastery 0.5 的 kp 优先于 0.9 的 kp
 *   S4 池推导：mode=baseline → retest 池；mode=diagnose → train 池
 *   S5 排除已做：usedItemIds 命中后取同 kp 次题
 *   S6 收敛：mastery=0.95 → V=0.0475 < CONV_VAR → converged=true、item=null
 *   S7 收敛：answeredCount ≥ MAX_ITEMS → converged
 *   S6c/S6d 收敛取等边界（MINOR-①，迭代2 新增）：V = CONV_VAR ∓ 1e-9 双侧夹逼，
 *           并断言 stopReason（D8）为 'variance' / undefined
 * 另含 remaining 计算与确定性并列规则（先修链更长者优先）。
 *
 * 测试数据为内联 fixture（4 节点小图 + 12 题小题库），不依赖 data/ 真实文件
 * （数据资产正确性由 scripts/validate_data.py 负责，职责分离）。
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadParams, nextItem, poolForMode } from '../src/index';
import type { BankItem, GraphNode, SelectionMode } from '../src/index';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const P = loadParams(resolve(REPO_ROOT, 'config/params.json'));

/** 小图：kp.a、kp.d 为根节点；kp.b 依赖 kp.a；kp.c 依赖 kp.b（先修链最长） */
const graph: GraphNode[] = [
  { id: 'kp.a', prerequisites: [] },
  { id: 'kp.b', prerequisites: ['kp.a'] },
  { id: 'kp.c', prerequisites: ['kp.b'] },
  { id: 'kp.d', prerequisites: [] },
];

const bank: BankItem[] = [
  { item_id: 'q_a_t1', knowledge_point: 'kp.a', pool: 'train', difficulty: 1 },
  { item_id: 'q_a_t2', knowledge_point: 'kp.a', pool: 'train', difficulty: 3 },
  { item_id: 'q_a_r1', knowledge_point: 'kp.a', pool: 'retest', difficulty: 2 },
  { item_id: 'q_a_r2', knowledge_point: 'kp.a', pool: 'retest', difficulty: 4 },
  { item_id: 'q_b_t1', knowledge_point: 'kp.b', pool: 'train', difficulty: 2 },
  { item_id: 'q_b_r1', knowledge_point: 'kp.b', pool: 'retest', difficulty: 3 },
  { item_id: 'q_c_t1', knowledge_point: 'kp.c', pool: 'train', difficulty: 3 },
  { item_id: 'q_c_r1', knowledge_point: 'kp.c', pool: 'retest', difficulty: 2 },
  { item_id: 'q_d_t1', knowledge_point: 'kp.d', pool: 'train', difficulty: 1 },
  { item_id: 'q_d_r1', knowledge_point: 'kp.d', pool: 'retest', difficulty: 2 },
];

interface Extra {
  usedItemIds?: string[];
  answeredCount?: number;
  bank?: BankItem[];
  graph?: GraphNode[];
  measureKps?: string[];
}

const ask = (mastery: Record<string, number>, mode: SelectionMode, extra: Extra = {}) =>
  nextItem({
    graph: extra.graph ?? graph,
    bank: extra.bank ?? bank,
    mastery,
    mode,
    usedItemIds: extra.usedItemIds ?? [],
    answeredCount: extra.answeredCount ?? 0,
    params: P,
    measureKps: extra.measureKps,
  });

/** 由目标方差 V 反解 p（取 p < 0.5 一侧）：p = (1 − √(1 − 4V)) / 2。S6c/S6d 取等边界用。 */
const pFromVariance = (v: number): number => (1 - Math.sqrt(1 - 4 * v)) / 2;

describe('selection · ALGORITHM §2 拓扑剪枝与信息增益', () => {
  it('S1 先修 mastery=0.3（< PRUNE_THRESHOLD）→ 后继不可测并记入 prunedKps', () => {
    const r = ask({ 'kp.a': 0.3, 'kp.b': 0.9, 'kp.c': 0.9, 'kp.d': 0.3 }, 'diagnose');
    expect(r.prunedKps).toContain('kp.b');
    expect(r.prunedKps).not.toContain('kp.a');
    // 剪枝按「直接先修」判定：kp.c 的直接先修 kp.b 掌握度 0.9 ≥ 阈值，故 kp.c 仍可测
    expect(r.prunedKps).not.toContain('kp.c');
    expect(r.item?.knowledge_point).not.toBe('kp.b');
  });

  it('S1b 先修链上逐级不达标时，下级同样被剪枝', () => {
    const r = ask({ 'kp.a': 0.3, 'kp.b': 0.2, 'kp.c': 0.9, 'kp.d': 0.2 }, 'diagnose');
    expect(r.prunedKps).toContain('kp.b');
    expect(r.prunedKps).toContain('kp.c');
  });

  it('S1b 先修 mastery=0.4（= PRUNE_THRESHOLD）→ 后继可测（阈值取闭区间下界）', () => {
    const r = ask(
      { 'kp.a': P.PRUNE_THRESHOLD, 'kp.b': 0.5, 'kp.c': 0, 'kp.d': 0 },
      'diagnose',
    );
    expect(r.prunedKps).not.toContain('kp.b');
  });

  it('S2 根节点（先修为空）天然可测', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose');
    expect(r.prunedKps).not.toContain('kp.a');
    expect(r.item?.knowledge_point).toBe('kp.a');
  });

  it('S3 信息增益：|mastery−0.5| 最小者优先（0.5 的 kp 先于 0.9 的 kp）', () => {
    const preferB = ask({ 'kp.a': 0.9, 'kp.b': 0.5, 'kp.c': 0, 'kp.d': 0.9 }, 'diagnose');
    expect(preferB.item?.knowledge_point).toBe('kp.b');
    const preferA = ask({ 'kp.a': 0.5, 'kp.b': 0.9, 'kp.c': 0, 'kp.d': 0.9 }, 'diagnose');
    expect(preferA.item?.knowledge_point).toBe('kp.a');
  });

  it('并列时取先修链更长者（确定性排序）', () => {
    const r = ask({ 'kp.a': 0.5, 'kp.b': 0.5, 'kp.c': 0.5, 'kp.d': 0.5 }, 'diagnose');
    expect(r.item?.knowledge_point).toBe('kp.c');
  });
});

describe('selection · ALGORITHM §2 池推导与已做排除', () => {
  it('S4 poolForMode：diagnose → train；baseline / retest → retest', () => {
    expect(poolForMode('diagnose')).toBe('train');
    expect(poolForMode('baseline')).toBe('retest');
    expect(poolForMode('retest')).toBe('retest');
  });

  it('S4b mode=diagnose 取 train 池题', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose');
    expect(r.item?.pool).toBe('train');
    expect(r.item?.item_id).toBe('q_a_t1');
  });

  it('S4c mode=baseline 取 retest 池题（同 kp 不同池，双池零重叠）', () => {
    const r = ask({ 'kp.a': 0.5 }, 'baseline');
    expect(r.item?.pool).toBe('retest');
    expect(r.item?.item_id).toBe('q_a_r1');
  });

  it('S5 usedItemIds 命中后取同 kp 次题', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose', { usedItemIds: ['q_a_t1'] });
    expect(r.item?.knowledge_point).toBe('kp.a');
    expect(r.item?.item_id).toBe('q_a_t2');
  });

  it('S5b 该 kp 池内题全部做过 → 换次优 kp', () => {
    const r = ask({ 'kp.a': 0.5, 'kp.d': 0.5 }, 'diagnose', {
      usedItemIds: ['q_a_t1', 'q_a_t2'],
    });
    expect(r.item?.item_id).toBe('q_d_t1');
  });

  it('S5c 文库中无可用题 → item=null 且不抛错', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose', { bank: [] });
    expect(r.item).toBeNull();
  });
});

describe('selection · ALGORITHM §2 收敛判定与剩余题量', () => {
  it('S6 mastery=0.95 → V=P(1−P)=0.0475 < CONV_VAR → converged=true、item=null', () => {
    const r = ask({ 'kp.a': 0.95 }, 'diagnose');
    expect(0.95 * (1 - 0.95)).toBeLessThan(P.CONV_VAR);
    expect(r.converged).toBe(true);
    expect(r.item).toBeNull();
  });

  it('S6b mastery=0.5（V=P(1−P)=0.25 ≥ CONV_VAR）→ 正常出题', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose');
    expect(r.converged).toBe(false);
    expect(r.item).not.toBeNull();
  });

  it('S7 answeredCount ≥ MAX_ITEMS → converged=true、item=null、remaining=0', () => {
    const r = ask({ 'kp.a': 0.5 }, 'diagnose', { answeredCount: P.MAX_ITEMS });
    expect(r.converged).toBe(true);
    expect(r.item).toBeNull();
    expect(r.remaining).toBe(0);
  });

  it('S7b remaining = MAX_ITEMS − answeredCount（下限 0）', () => {
    expect(ask({ 'kp.a': 0.5 }, 'diagnose', { answeredCount: 3 }).remaining).toBe(P.MAX_ITEMS - 3);
    expect(
      ask({ 'kp.a': 0.5 }, 'diagnose', { answeredCount: P.MAX_ITEMS + 5 }).remaining,
    ).toBe(0);
  });

  it('S6c 取等边界（下侧）：V = CONV_VAR − 1e-9 → converged=true、stopReason="variance"', () => {
    // MINOR-①（03_REVIEW §5.3）：收敛取等边界用例。
    // IEEE754 无法精确表示 0.10，故先按解析解反解 p = (1 − √(1 − 4V)) / 2，
    // 再以 ±1e-9 双侧夹逼（本用例下侧、S6d 上侧）把取等边界锁成确定性断言。
    const pLo = pFromVariance(P.CONV_VAR - 1e-9);
    expect(pLo * (1 - pLo)).toBeLessThan(P.CONV_VAR);

    // 单节点图：确保取等边界的 kp.a 就是信息增益最大者（否则 mastery=0.5 的节点会先被选中）
    const only: GraphNode[] = [{ id: 'kp.a', prerequisites: [] }];
    const r = ask({ 'kp.a': pLo }, 'diagnose', { graph: only });
    expect(r.converged).toBe(true);
    expect(r.item).toBeNull();
    expect(r.stopReason).toBe('variance');

    // D8：三个终止出口的 stopReason 互不相同（区分「题量上限 / 方差收敛 / 无题可出」），
    // 避免把「题池耗尽」误报为「已收敛」。
    expect(ask({ 'kp.a': 0.5 }, 'diagnose', { answeredCount: P.MAX_ITEMS }).stopReason).toBe(
      'max_items',
    );
    expect(ask({ 'kp.a': 0.5 }, 'diagnose', { bank: [] }).stopReason).toBe('no_items');
  });

  it('S6d 取等边界（上侧）：V = CONV_VAR + 1e-9 → 正常出题、stopReason 保持 undefined', () => {
    const pHi = pFromVariance(P.CONV_VAR + 1e-9);
    expect(pHi * (1 - pHi)).toBeGreaterThanOrEqual(P.CONV_VAR);

    const only: GraphNode[] = [{ id: 'kp.a', prerequisites: [] }];
    const r = ask({ 'kp.a': pHi }, 'diagnose', { graph: only });
    expect(r.converged).toBe(false);
    expect(r.item).not.toBeNull();
    expect(r.stopReason).toBeUndefined();
  });
});

/**
 * 测量一致性（D15，终审前修复）：mode='retest' 的 measureKps 首选集合。
 *
 * 背景：mode=baseline 与 mode=retest 若各自取「|mastery−0.5| 最小」的 kp，基线作答后该 kp
 * 掌握度变化会让复测漂到**另一个** kp，报告按 kp 分组时单侧缺失 → ΔAccuracy 恒为 null。
 *
 * 用例（内联 fixture：mastery 全 0.5 → 引擎原排序 = [kp.c(链长2), kp.b(1), kp.a(0), kp.d(0)]）：
 *   S8  measureKps=['kp.a'] → retest 池落在 kp.a（覆盖引擎原排序）；diagnose 同参不受影响
 *   S9  首选 kp 的 retest 题耗尽 / 首选集合全为不可测或未知 kp → 回退原排序，不抛错、不死循环
 *   S10 head 采纳**调用方顺序**（['kp.d','kp.a'] → 先 kp.d），锁定服务端「未复测基线 kp 排前」的覆盖策略
 *   S11 首选集合内 kp 被拓扑剪枝 → 跳过该 kp，其余首选仍生效
 */
describe('selection · D15 测量一致性（retest 的 measureKps 首选集合）', () => {
  const allHalf = { 'kp.a': 0.5, 'kp.b': 0.5, 'kp.c': 0.5, 'kp.d': 0.5 };

  it('S8 未传 measureKps 时 retest 取引擎排序首位（kp.c）；传入 [kp.a] 后优先取 kp.a', () => {
    // 基线行为（向后兼容基准）
    expect(ask(allHalf, 'retest').item).toMatchObject({
      item_id: 'q_c_r1',
      knowledge_point: 'kp.c',
    });

    const preferred = ask(allHalf, 'retest', { measureKps: ['kp.a'] });
    expect(preferred.item).toMatchObject({ item_id: 'q_a_r1', knowledge_point: 'kp.a' });
    // 仍走 retest 池、收敛语义不变
    expect(preferred.converged).toBe(false);
    expect(preferred.remaining).toBe(P.MAX_ITEMS);
  });

  it('S8b mode=diagnose / baseline 传 measureKps 也逐字不变（仅 retest 生效）', () => {
    // diagnose 走 train 池，且忽略 measureKps
    expect(ask(allHalf, 'diagnose', { measureKps: ['kp.a'] }).item).toMatchObject({
      item_id: 'q_c_t1',
      knowledge_point: 'kp.c',
    });
    // baseline 亦忽略 measureKps（保持迭代 3 行为）
    expect(ask(allHalf, 'baseline', { measureKps: ['kp.a'] }).item).toMatchObject({
      item_id: 'q_c_r1',
      knowledge_point: 'kp.c',
    });
  });

  it('S9 首选 kp 的 retest 题耗尽 / 首选集合不可测或不存在 → 回退原排序，不抛错', () => {
    // kp.a 的 retest 池两题都已做过 → 回退到引擎排序首位 kp.c
    const exhausted = ask(allHalf, 'retest', {
      measureKps: ['kp.a'],
      usedItemIds: ['q_a_r1', 'q_a_r2'],
    });
    expect(exhausted.item).toMatchObject({ item_id: 'q_c_r1', knowledge_point: 'kp.c' });

    // 首选集合全是图谱外的未知 kp → 原样返回引擎排序
    expect(
      ask(allHalf, 'retest', { measureKps: ['kp.unknown', 'kp.nope'] }).item,
    ).toMatchObject({ item_id: 'q_c_r1', knowledge_point: 'kp.c' });

    // 空集合等价于不传（向后兼容）
    expect(ask(allHalf, 'retest', { measureKps: [] }).item).toMatchObject({
      item_id: 'q_c_r1',
      knowledge_point: 'kp.c',
    });

    // 首选集合内的 kp 全无可用题（整库为空）→ 诚实停止（stopReason='no_items'），不死循环
    const empty = ask(allHalf, 'retest', { measureKps: ['kp.a'], bank: [] });
    expect(empty.item).toBeNull();
    expect(empty.converged).toBe(true);
    expect(empty.stopReason).toBe('no_items');
  });

  it('S10 head 采纳调用方顺序：measureKps=[kp.d,kp.a] → 先 kp.d（服务端覆盖策略依赖此语义）', () => {
    // 引擎原排序中 kp.a 在 kp.d 之前（链长同为 0，按 id 升序），调用方顺序可覆盖之
    expect(ask(allHalf, 'retest').item?.knowledge_point).toBe('kp.c');
    expect(
      ask(allHalf, 'retest', { measureKps: ['kp.d', 'kp.a'] }).item,
    ).toMatchObject({ item_id: 'q_d_r1', knowledge_point: 'kp.d' });

    // 调换顺序 → 先 kp.a，证明顺序即优先级
    expect(
      ask(allHalf, 'retest', { measureKps: ['kp.a', 'kp.d'] }).item,
    ).toMatchObject({ item_id: 'q_a_r1', knowledge_point: 'kp.a' });
  });

  it('S11 首选集合内被剪枝的 kp 被跳过，其余首选仍生效', () => {
    // kp.a=0.3 < PRUNE_THRESHOLD → kp.b 不可测；首选 [kp.b,kp.d] → kp.b 被跳过，取 kp.d
    const r = ask(
      { 'kp.a': 0.3, 'kp.b': 0.9, 'kp.c': 0.9, 'kp.d': 0.5 },
      'retest',
      { measureKps: ['kp.b', 'kp.d'] },
    );
    expect(r.prunedKps).toContain('kp.b');
    expect(r.item).toMatchObject({ item_id: 'q_d_r1', knowledge_point: 'kp.d' });
  });
});
