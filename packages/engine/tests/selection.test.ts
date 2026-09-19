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
  });

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
});
