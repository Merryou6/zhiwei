/**
 * 归因定位核心（ALGORITHM §4，纯计算，服务端；按总控指示不进 engine 包）
 *
 * ```text
 * function attribute(kp, error_type):
 *   direction = MAP[error_type]
 *   if direction == "upstream":
 *      candidates = BFS 反向沿先修, 深度 ≤ MAX_DEPTH
 *      for a in candidates: suspect[a] = SUSPECT_BASE^dist(a) * (1 − mastery(a))
 *      降序逐个出最小验证题（train 池, 难度取该 kp 最低）
 *         答对 → 确认根因；答错 → 排除，取次高嫌疑继续
 *      全部排除 → root_cause 回落为本节点（诚实兜底，不硬猜）
 * ```
 *
 * 参数全部来自 config/params.json（经 Params 注入）：SUSPECT_BASE、MAX_DEPTH。
 * 上界（ALGORITHM §4 勘误）：d=1 → ≤0.60，d=2 → ≤0.36。
 *
 * 本模块零 IO、零副作用，方便单测与复用；表读写由 services/attribution.ts 负责。
 */

import type { Params } from '../../../../packages/engine/src/params';

import type { BankItemRecord, KnowledgeNode } from '../data/staticData';

export interface SuspectEntry {
  kp_id: string;
  /** 与 from_kp 的跳数（≥1） */
  dist: number;
  suspect_score: number;
}

export interface BackwardSearch {
  /** 按嫌疑分降序（同分按 kp id 升序，保证确定性） */
  suspects: SuspectEntry[];
  /** 每个候选 kp 的父指针（指向离 from_kp 更近的一跳），供路径还原 */
  parents: Map<string, string>;
}

/**
 * 反向 BFS（沿 prerequisites 上行），深度 ≤ MAX_DEPTH。
 * 同一节点可能经多条路径到达，取**最短跳数**（BFS 首次到达即最短）。
 */
export function searchUpstream(
  nodeById: Map<string, KnowledgeNode>,
  mastery: Record<string, number>,
  fromKp: string,
  params: Params,
): BackwardSearch {
  const parents = new Map<string, string>();
  const best = new Map<string, number>();
  const collected: { kp_id: string; dist: number }[] = [];

  let frontier: string[] = [fromKp];
  let dist = 0;

  while (frontier.length > 0 && dist < params.MAX_DEPTH) {
    dist += 1;
    const next: string[] = [];
    for (const current of frontier) {
      const prereqs = [...(nodeById.get(current)?.prerequisites ?? [])].sort();
      for (const prereq of prereqs) {
        if (best.has(prereq)) continue;
        best.set(prereq, dist);
        parents.set(prereq, current);
        collected.push({ kp_id: prereq, dist });
        next.push(prereq);
      }
    }
    frontier = next;
  }

  const suspects: SuspectEntry[] = collected.map((entry) => ({
    kp_id: entry.kp_id,
    dist: entry.dist,
    suspect_score: params.SUSPECT_BASE ** entry.dist * (1 - (mastery[entry.kp_id] ?? 0)),
  }));

  suspects.sort(
    (a, b) =>
      b.suspect_score - a.suspect_score || (a.kp_id < b.kp_id ? -1 : a.kp_id > b.kp_id ? 1 : 0),
  );

  return { suspects, parents };
}

/** 由 BFS 父指针还原 from_kp → rootCause 的完整 id 路径（终点 = 根因）。 */
export function buildPath(
  fromKp: string,
  rootCause: string,
  parents: Map<string, string>,
): string[] {
  if (rootCause === fromKp) return [fromKp];

  const reversed: string[] = [rootCause];
  let cursor = rootCause;
  let guard = 0;
  while (cursor !== fromKp) {
    const parent = parents.get(cursor);
    if (!parent || guard > parents.size + 1) return [fromKp, rootCause];
    reversed.push(parent);
    cursor = parent;
    guard += 1;
  }
  return reversed.reverse();
}

/** 验证题：该 kp 的 train 池中难度最低、且未做过的题（ALGORITHM §4）。 */
export function pickVerificationItem(
  items: readonly BankItemRecord[],
  kpId: string,
  usedItemIds: readonly string[],
): BankItemRecord | null {
  const used = new Set(usedItemIds);
  const candidates = items
    .filter((item) => item.knowledge_point === kpId && item.pool === 'train' && !used.has(item.item_id))
    .sort(
      (a, b) => a.difficulty - b.difficulty || (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0),
    );
  return candidates[0] ?? null;
}
