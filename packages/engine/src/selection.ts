/**
 * 自适应选题（ALGORITHM §2）
 *
 * ① 拓扑剪枝：先修为空或全部先修 mastery ≥ PRUNE_THRESHOLD 的 kp 才可测
 *    （其余记入 prunedKps，标记「未具备学习条件」）
 *    【剪枝口径声明（D9）】按**直接先修**判定：更上游的节点不达标不阻断本节点
 *    （ALGORITHM §2「所有先修节点」取直接先修解读）。迭代 1 已按此实现并由
 *    S1/S1b 用例锁定，本迭代仅补充口径声明，行为零变更。
 * ② 可测集合中选 |mastery − 0.5| 最小者（信息增益最大；并列取先修链更长者，再按 id 稳定排序）
 * ③ 池推导：mode=diagnose → train；mode=baseline/retest → retest（服务端推导，调用方不传 pool）
 *    排除 usedItemIds；该 kp 对应池为空 → 换次优 kp（全部无题 → item=null）
 * ④ 收敛判定（优先于出题）：所选 kp 的 V = P(1−P) < CONV_VAR，或已答 ≥ MAX_ITEMS
 * ⑤ remaining = MAX_ITEMS − answeredCount（下限 0）
 * ⑥ 测量一致性（D15，可选入参 measureKps）：mode='retest' 时把「已有基线证据的 kp」提前到
 *    候选顺序最前，保证基线与复测测同一批知识点（否则 |mastery−0.5| 会因基线作答而重排，
 *    复测漂到别的 kp，报告侧按 kp 分组时单侧缺失 → ΔAccuracy 恒 null）。集合内无可用题则
 *    自然回退到原排序（循环 continue），不报错、不死循环；mode='diagnose'/'baseline' 不受影响。
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
  /**
   * 复测首选 kp 集合（D15，**可选，向后兼容**）：mode='retest' 时用于把「该 space 已有
   * mode=baseline 证据事件的知识点」排到候选顺序最前，使复测与基线落在同一批 kp 上。
   * 纯数据入参（string[]），引擎不做任何 IO；缺省/空数组/mode≠'retest' → 行为与迭代 3 完全一致。
   * 集合内 kp 的对应池无可用题时，循环自然落到其后候选（回退），不报错也不死循环。
   * 数组顺序即优先级（调用方据此把尚未复测的基线 kp 排前）。
   */
  measureKps?: string[];
}

export interface SelectionResult {
  item: BankItem | null;
  converged: boolean;
  remaining: number;
  prunedKps: string[];
  /**
   * 停止原因（D8，**可选字段，向后兼容**）：区分「无题可出」与「已收敛」，
   * 避免把题池耗尽误报为收敛。
   *   'variance'  方差代理 V = P(1−P) < CONV_VAR
   *   'max_items' 已答 ≥ MAX_ITEMS
   *   'no_items'  可测 kp 的对应池均无可用题（诚实停止，不硬凑题）
   * 契约 §4 响应**不含**本字段（契约冻结，converged 语义保持「前端结束测评」）；
   * 仅供服务端日志与接口测试断言使用。
   */
  stopReason?: 'variance' | 'max_items' | 'no_items';
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

/**
 * 复测优先排序（D15，纯函数、零 IO）：把 measureKps 中**可测**的 kp 按调用方给定顺序提前，
 * 其余候选保持引擎原排序跟在其后。
 * - 仅 mode='retest' 生效（mode='diagnose'/'baseline' 行为逐字不变）；
 * - measureKps 缺省/空 → 原样返回（向后兼容：无基线证据时复测行为与迭代 3 一致）；
 * - 集合内无任何可测 kp（如全被剪枝）→ 原样返回（回退，不报错）；
 * - 集合内 kp 的对应池无可用题 → 由 nextItem 的循环 continue 自然落到其后候选（回退，不死循环）；
 * - head 采纳**调用方顺序**（调用方据此把「尚未复测的基线 kp」排前，使一轮复测覆盖整批基线 kp，
 *   对应 PRD §7「复测与基线测同一批知识点」）；tail 仍由引擎的信息增益排序主导。
 */
function preferMeasureKps(
  ranked: string[],
  mode: SelectionMode,
  measureKps?: string[],
): string[] {
  if (mode !== 'retest' || !measureKps || measureKps.length === 0) return ranked;
  const testable = new Set(ranked);
  const seen = new Set<string>();
  const head: string[] = [];
  for (const kp of measureKps) {
    if (!testable.has(kp) || seen.has(kp)) continue;
    seen.add(kp);
    head.push(kp);
  }
  if (head.length === 0 || head.length === ranked.length) return ranked;
  return [...head, ...ranked.filter((kp) => !seen.has(kp))];
}

export function nextItem(input: SelectionInput): SelectionResult {
  const { graph, bank, mastery, mode, usedItemIds, answeredCount, params, measureKps } = input;

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

  // ②′ 测量一致性重排（D15）：仅 mode='retest' 且给出非空 measureKps 时生效
  const ordered = preferMeasureKps(ranked, mode, measureKps);

  // ③④：逐个候选 kp 找题；收敛判定先于出题
  for (const kp of ordered) {
    const available = bank.filter(
      (item) => item.knowledge_point === kp && item.pool === pool && !used.has(item.item_id),
    );
    if (available.length === 0) continue;

    if (answeredCount >= params.MAX_ITEMS) {
      return { item: null, converged: true, remaining, prunedKps, stopReason: 'max_items' };
    }
    const p = mastery[kp] ?? 0;
    const variance = p * (1 - p);
    if (variance < params.CONV_VAR) {
      return { item: null, converged: true, remaining, prunedKps, stopReason: 'variance' };
    }
    return { item: available[0], converged: false, remaining, prunedKps };
  }

  // 全部可测 kp 的对应池均无题可出：无可出题即视为收敛（诚实停止，不硬凑题）
  return { item: null, converged: true, remaining, prunedKps, stopReason: 'no_items' };
}
