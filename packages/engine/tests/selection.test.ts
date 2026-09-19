/**
 * 自适应选题单测（ALGORITHM §2）
 *
 * 用例 S1–S7 来自计划 步骤 8；测试数据全部为内联 fixture（小图 4 节点 + 12 题），
 * 不依赖 data/ 真实文件（数据资产正确性由 scripts/validate_data.py 负责，职责分离）。
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadParams, nextItem, rankTestableKps } from '../src/index';
import type { BankItem, GraphNode, SelectionMode } from '../src/index';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const P = loadParams(resolve(REPO_ROOT, 'config/params.json'));

/** 小图：kp.a、kp.d 为根节点；kp.b 依赖 kp.a；kp.c 依赖 kp.b（链最长） */
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
  { item_id: 'q_c_t2', knowledge_point: 'kp.c', pool: 'train', difficulty: 4 },
  { item_id: 'q_c_r1', knowledge_point: 'kp.c', pool: 'retest', difficulty: 2 },
  { item_id: 'q_c_r2', knowledge_point: 'kp.c', pool: 'retest', difficulty: 3 },
  { item_id: 'q_d_t1', knowledge_point: 'kp.d', pool: 'train', difficulty: 1 },
  { item_id: 'q_d_r1', knowledge_point: 'kp.d', pool: 'retest', difficulty: 2 },
];

const allEqual = (v: number): Record<string, number> => ({
  'kp.a': v,
  'kp.b': v,
  'kp.c': v,
  'kp.d': v,
});

const ask = (mastery: Record<string, number>, mode: SelectionMode, extra: Partial<{
  usedItemIds: string[];
  answeredCount: number;
  bank: BankItem[];
  graph: GraphNode[];
}> = {}) =>
  nextItem({
    graph: extra.graph ?? graph,
    bank: extra.bank ?? bank,
    mastery,
    mode,
    usedItemIds: extra.usedItemIds ?? [],
    answeredCount: extra.answeredCount ?? 0,
    params: P,
  });

describe('selection · ALGORITHM §2', () => {
  it('S1 拓扑剪枝：先修 mastery=0.3 < PRUNE_THRESHOLD → 后继不可测并出现在 prunedKps', () => {
    const mastery = { 'kp.a': 0.3, 'kp.b': 0.9, 'kp.c': 0.9, 'kp.d': 0.9 };
    const r = ask(mastery, 'diagnose');
    expect(r.prunedKps).toContain('kp.b');
    expect(r.prunedKps).not.toContain('kp.a');
    expect(r.item?.knowledge_point).toBe('kp.a');
  });

  it('S2 根节点（先修为空）天然可测；先修达标的节点同样可测', () => {
    const { testable, prunedKps } = rankTestableKps(graph, allEqual(0.9), P);
    expect(testable.map((n) => n.id)).toEqual(['kp.c', 'kp.b', 'kp.a', 'kp.d']);
    expect(prunedKps).toEqual([]);

    const unknown = rankTestableKps(graph, {}, P);
    expect(unknown.testable.map((n) => n.id)).toContain('kp.a');
    expect(unknown.prunedKps).toEqual([]);
  });

  it('S3 信息增益：mastery 0.5 的 kp 优先于 0.9 的 kp', () => {
    const mastery = { 'kp.a': 0.9, 'kp.b': 0.9, 'kp.c': 0.9, 'kp.d': 0.5 };
    const r = ask(mastery, 'diagnose');
    expect(r.item?.knowledge_point).toBe('kp.d');
    expect(r.converged).toBe(false);
  });

  it('S4a 池推导：mode=diagnose → train 池', () => {
    const r = ask(allEqual(0.5), 'diagnose');
    expect(r.item?.pool).toBe('train');
    expect(r.item?.item_id).toBe('q_c_t1');
  });

  it('S4b 池推导：mode=baseline → retest 池', () => {
    const r = ask(allEqual(0.5), 'baseline');
    expect(r.item?.pool).toBe('retest');
    expect(r.item?.item_id).toBe('q_c_r1');
  });

  it('S4c 池推导：mode=retest → retest 池', () => {
    const r = ask(allEqual(0.5), 'retest');
    expect(r.item?.pool).toBe('retest');
  });

  it('S5 排除已做：usedItemIds 命中后取同 kp 的次题', () => {
    const first = ask(allEqual(0.5), 'diagnose');
    expect(first.item?.item_id).toBe('q_c_t1');
    const second = ask(allEqual(0.5), 'diagnose', { usedItemIds: ['q_c_t1'] });
    expect(second.item?.knowledge_point).toBe('kp.c');
    expect(second.item?.item_id).toBe('q_c_t2');
  });

  it('S6 收敛：mastery=0.95 → V=0.0475 < CONV_VAR → converged=true、item=null', () => {
    const r = ask(allEqual(0.95), 'diagnose');
    expect(0.95 * 0.05).toBeLessThan(P.CONV_VAR);
    expect(r.converged).toBe(true);
    expect(r.item).toBeNull();
  });

  it('S7a 收敛：answeredCount ≥ MAX_ITEMS → converged=true、item=null、remaining=0', () => {
    const r = ask(allEqual(0.5), 'diagnose', { answeredCount: P.MAX_ITEMS });
    expect(r.converged).toBe(true);
    expect(r.item).toBeNull();
    expect(r.remaining).toBe(0);
  });

  it('S7b remaining = MAX_ITEMS − answeredCount（下限 0）', () => {
    const one = ask(allEqual(0.5), 'diagnose', { answeredCount: P.MAX_ITEMS - 1 });
    expect(one.remaining).toBe(1);
    expect(one.item).not.toBeNull();

    const over = ask(allEqual(0.5), 'diagnose', { answeredCount: P.MAX_ITEMS + 5 });
    expect(over.remaining).toBe(0);
    expect(over.converged).toBe(true);
  });

  it('§2③ 该 kp 对应池为空 → 换次优 kp（不返回 null）', () => {
    const withoutRetest = bank.filter(
      (i) => !(i.knowledge_point === 'kp.c' && i.pool === 'retest'),
    );
    const r = ask(allEqual(0.5), 'baseline', { bank: withoutRetest });
    expect(r.item?.knowledge_point).toBe('kp.b');
    expect(r.item?.pool).toBe('retest');
  });

  it('§2③ 全部无题 → item=null 且不判收敛', () => {
    const r = ask(allEqual(0.5), 'diagnose', { bank: [] });
    expect(r.item).toBeNull();
    expect(r.converged).toBe(false);
  });

  it('确定性：同一输入多次调用结果一致；先修链更长者在并列时优先', () => {
    const a = ask(allEqual(0.5), 'diagnose');
    const b = ask(allEqual(0.5), 'diagnose');
    expect(a.item?.item_id).toBe(b.item?.item_id);
    // 并列（gain 相同）时深度更大者胜出：kp.c 链长 2 > kp.b 1 > kp.a / kp.d 0
    expect(a.item?.knowledge_point).toBe('kp.c');
  });

  it('剪枝点不出题：先修未达标时不会从该 kp 取题', () => {
    const mastery = { 'kp.a': 0.2, 'kp.b': 0.95, 'kp.c': 0.95, 'kp.d': 0.95 };
    const r = ask(mastery, 'diagnose');
    expect(r.prunedKps).toContain('kp.b');
    expect(r.item?.knowledge_point).not.toBe('kp.b');
  });
});
