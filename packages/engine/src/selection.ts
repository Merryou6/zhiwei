/**
 * 自适应选题（ALGORITHM §2）
 *
 * ① 拓扑剪枝：先修为空或全部先修 mastery ≥ PRUNE_THRESHOLD 的 kp 才可测
 *    （其余记入 prunedKps，标记「未具备学习条件」）
 * ② 可测集合中选 |mastery − 0.5| 最小者（信息增益最大；并列取先修链更长者，再按 id 稳定排序）
 * ③ 池推导：mode=diagnose → train；mode=baseline/retest → retest（服务端推导，调用方不传 pool）
 *    排除 usedItemIds；该 kp 对应池为空 → 换次优 kp（全部无题 → item=null）
 * ④ 收敛判定（优先于出题）：所选 kp 的 V = P(1−P) < CONV_VAR，或已答 ≥ MAX_ITEMS
 * ⑤ remaining = MAX_ITEMS − answeredCount（下限 0）
 */
import type { Params } from './params';

export interface GraphNode {
  id: string;
  prerequisites: string[];
}

export interface BankItem {
  item_id: string;
  knowledge_point: string;
  pool: 'train' | 'retest';
  difficulty: number;
}

export interface SelectionState {
  mastery: Record<string, number>;
  answeredCount: number;
  usedItemIds: Set<string> | string[];
}

export type SelectionMode = 'diagnose' | 'baseline' | 'retest';

export interface SelectionInput {
  graph: GraphNode[];
  bank: BankItem[];
  mastery: Record<string, number>;
  mode: SelectionMode;
  usedItemIds: string[];
  answeredCount: number;
  params: Params;
}

export interface SelectionResult {
  item: BankItem | null;
  converged: boolean;
  remaining: number;
  prunedKps: string[];
}

/** 信息增益最大的掌握度位置：|mastery − 0.5| 最小。 */
const TARGET_MASTERY = 0.5;

/** mode → 池推导（服务端职责，前端不传 pool）。 */
export function poolForMode(mode: SelectionMode): 'train' | 'retest' {
  return mode === 'diagnose' ? 'train' : 'retest';
}

/** 先修链长度（用于并列时的确定性排序）。 */
function prereqChainLength(id: string, prereqOf: Map<string, string[]>, memo: Map<string, number>): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  memo.set(id, 0); // 防御性占位，避免异常数据成环时无限递归
  const prereqs = prereqOf.get(id) ?? [];
  let best = 0;
  for (const p of prereqs) {
    const depth = 1 + prereqChainLength(p, prereqOf, memo);
    if (depth > best) best = depth;
  }
  memo.set(id, best);
  return best;
}

export function nextItem(input: SelectionInput): SelectionResult {
  const { graph, bank, mastery, mode, usedItemIds, answeredCount, params } = input;

  const used = new Set(usedItemIds);
  const prereqOf = new Map(graph.map((node) => [node.id, node.prerequisites]));

  // ① 拓扑剪枝
  const testable: string[] = [];
  const prunedKps: string[] = [];
  for (const node of graph) {
    const ready = node.prerequisites.every(
      (p) => (mastery[p] ?? 0) >= params.PRUNE_THRESHOLD,
    );
    if (ready) testable.push(node.id);
    else prunedKps.push(node.id);
  }

  // ② 信息增益排序（含确定性并列规则）
  const memo = new Map<string, number>();
  const ranked = [...testable].sort((a, b) => {
    const da = Math.abs((mastery[a] ?? 0) - TARGET_MASTERY);
    const db = Math.abs((mastery[b] ?? 0) - TARGET_MASTERY);
    if (da !== db) return da - db;
    const ca = prereqChainLength(a, prereqOf, memo);
    const cb = prereqChainLength(b, prereqOf, memo);
    if (ca !== cb) return cb - ca;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const pool = poolForMode(mode);
  const remaining = Math.max(0, params.MAX_ITEMS - answeredCount);

  // ③④：逐个候选 kp 找题；收敛判定先于出题
  for (const kp of ranked) {
    const available = bank.filter(
      (item) => item.knowledge_point === kp && item.pool === pool && !used.has(item.item_id),
    );
    if (available.length === 0) continue;

    if (answeredCount >= params.MAX_ITEMS) {
      return { item: null, converged: true, remaining, prunedKps };
    }
    const p = mastery[kp] ?? 0;
    const variance = p * (1 - p);
    if (variance < params.CONV_VAR) {
      return { item: null, converged: true, remaining, prunedKps };
    }
    return { item: available[0], converged: false, remaining, prunedKps };
  }

  // 全部可测 kp 的对应池均无题可出：无可出题即视为收敛（诚实停止，不硬凑题）
  return { item: null, converged: true, remaining, prunedKps };
}
