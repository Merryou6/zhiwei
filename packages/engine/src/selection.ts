/**
 * 自适应选题（ALGORITHM §2，纯函数，不读任何文件/数据库）
 *
 *   ① 拓扑剪枝：先修全为空或全部先修 mastery ≥ PRUNE_THRESHOLD 的 kp 才可测，
 *      其余记入 prunedKps（"未具备学习条件"）
 *   ② 可测集合中选 |mastery − 0.5| 最小者（信息增益最大）；并列取先修链更长者，
 *      再并列按 graph 数组顺序（稳定排序保证确定性）
 *   ③ 池推导：mode=diagnose → train；mode=baseline/retest → retest（服务端推导，
 *      调用方不传 pool）；排除 usedItemIds；该 kp 对应池为空 → 换次优 kp；
 *      全部无题 → item=null
 *   ④ 收敛：所选 kp 的 V = P(1−P) < CONV_VAR 或 answeredCount ≥ MAX_ITEMS
 *      → converged=true 且 item=null（收敛判定优先于出题）
 *   ⑤ remaining = MAX_ITEMS − answeredCount（下限 0）
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

export interface NextItemInput {
  graph: GraphNode[];
  bank: BankItem[];
  mastery: Record<string, number>;
  mode: SelectionMode;
  usedItemIds: string[];
  answeredCount: number;
  params: Params;
}

export interface NextItemResult {
  item: BankItem | null;
  converged: boolean;
  remaining: number;
  prunedKps: string[];
}

/** 信息增益最大点（ALGORITHM §2② 的 0.5）：规格常量，非 §0 可调参数 */
const TARGET_MASTERY = 0.5;

/** 池由 mode 推导（ALGORITHM §2③），调用方不传 pool */
const POOL_BY_MODE: Record<SelectionMode, 'train' | 'retest'> = {
  diagnose: 'train',
  baseline: 'retest',
  retest: 'retest',
};

/**
 * 掌握度未知时的取值：按"最大不确定"处理（TARGET_MASTERY）。
 * 理由：若按 0 处理，V = P(1−P) = 0 会立刻触发 §2④ 的收敛，导致新学生一道题都出不来；
 * 调用方正常情况下会用自报先验 PRIOR_MAP 填充每个 kp 的初始值。
 */
const DEFAULT_MASTERY = TARGET_MASTERY;

function masteryOf(mastery: Record<string, number>, kp: string): number {
  const value = mastery[kp];
  return typeof value === 'number' ? value : DEFAULT_MASTERY;
}

/** 沿先修链的最长深度（用于 §2② 的并列裁决；非 DAG 输入按 0 兜底防死循环） */
function prereqChainLength(
  id: string,
  prereqMap: Map<string, string[]>,
  memo: Map<string, number>,
  visiting: Set<string>,
): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  if (visiting.has(id)) return 0;
  visiting.add(id);
  const prereqs = prereqMap.get(id) ?? [];
  let depth = 0;
  for (const p of prereqs) {
    depth = Math.max(depth, 1 + prereqChainLength(p, prereqMap, memo, visiting));
  }
  visiting.delete(id);
  memo.set(id, depth);
  return depth;
}

export interface PruneResult {
  /** 可测节点（已按 §2② 的优先级排序） */
  testable: GraphNode[];
  /** 未具备学习条件的节点 id（被剪枝） */
  prunedKps: string[];
}

/** §2① 拓扑剪枝 + §2② 排序（确定性） */
export function rankTestableKps(
  graph: GraphNode[],
  mastery: Record<string, number>,
  params: Params,
): PruneResult {
  const prereqMap = new Map<string, string[]>();
  for (const node of graph) {
    prereqMap.set(node.id, node.prerequisites ?? []);
  }

  const testable: GraphNode[] = [];
  const prunedKps: string[] = [];
  for (const node of graph) {
    const prereqs = node.prerequisites ?? [];
    const ready = prereqs.every(
      (p) => masteryOf(mastery, p) >= params.PRUNE_THRESHOLD,
    );
    if (ready) {
      testable.push(node);
    } else {
      prunedKps.push(node.id);
    }
  }

  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const decorated = testable.map((node, index) => ({
    node,
    index,
    gain: Math.abs(masteryOf(mastery, node.id) - TARGET_MASTERY),
    depth: prereqChainLength(node.id, prereqMap, memo, visiting),
  }));

  // 稳定排序：信息增益 → 先修链更长者优先 → graph 原顺序
  decorated.sort((a, b) => {
    if (a.gain !== b.gain) return a.gain - b.gain;
    if (a.depth !== b.depth) return b.depth - a.depth;
    return a.index - b.index;
  });

  return { testable: decorated.map((d) => d.node), prunedKps };
}

/** §2③ 同 kp 候选题的确定性取题：难度最低优先，同难度按题库原顺序 */
function pickItem(candidates: BankItem[]): BankItem {
  let best = candidates[0];
  for (const c of candidates) {
    if (c.difficulty < best.difficulty) best = c;
  }
  return best;
}

export function nextItem(input: NextItemInput): NextItemResult {
  const { graph, bank, mastery, params, answeredCount } = input;
  const remaining = Math.max(0, params.MAX_ITEMS - answeredCount);

  const { testable, prunedKps } = rankTestableKps(graph, mastery, params);

  // §2④ 收敛判定（题量上限）优先于出题
  if (answeredCount >= params.MAX_ITEMS) {
    return { item: null, converged: true, remaining: 0, prunedKps };
  }

  const pool = POOL_BY_MODE[input.mode];
  const used = new Set(input.usedItemIds);

  for (const node of testable) {
    const candidates = bank.filter(
      (i) => i.knowledge_point === node.id && i.pool === pool && !used.has(i.item_id),
    );
    // §2③ 该 kp 对应池为空（或题已做完）→ 换次优 kp
    if (candidates.length === 0) continue;

    // §2④ 收敛判定优先于出题
    const p = masteryOf(mastery, node.id);
    const variance = p * (1 - p);
    if (variance < params.CONV_VAR) {
      return { item: null, converged: true, remaining, prunedKps };
    }

    return { item: pickItem(candidates), converged: false, remaining, prunedKps };
  }

  // 全图无题可用：不判收敛（题量上限已在上方处理）
  return { item: null, converged: false, remaining, prunedKps };
}
