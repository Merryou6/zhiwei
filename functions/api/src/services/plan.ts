/**
 * 处方生成服务（契约 §8，接口 #17 POST /api/plan/generate；D15）
 *
 * - strategy 由 error_type 硬编码映射（ALGORITHM §4 三条 + §3 两条转训动作）
 * - path = 根因的先修链（含自身，上游在前，拓扑序）—— 图谱高亮用，完整 id
 * - item_sequence = 沿链正向排布、**难度递增**、全部 train 池、排除已做过；
 *   链长 ≤4 时每节点 2 题、>4 时每节点 1 题，总量 ≤8；
 *   排序口径：主序难度升序（「难度递增」字面落实），同难度按链序稳定（保持沿链正向）
 * - explanation_outline 取根因 kp 的 typical_errors（desc → remedy），3–5 条
 */

import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { STRATEGY_BY_ERROR_TYPE, isErrorType } from '../data/staticData';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { toClientItemWithDifficulty } from '../serialization';
import { authedUser } from './auth';
import { loadSelectionState } from './diagnose';

/** 单次处方题量上限（D15）。 */
export const MAX_PLAN_ITEMS = 8;
/** 链长阈值：≤ 该值每节点 2 题（D15）。 */
export const SHORT_CHAIN_THRESHOLD = 4;
/** explanation_outline 条数上限（3–5 条，D15）。 */
export const OUTLINE_MAX_ITEMS = 5;

export async function generate(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const rootCauseRaw = req.body.root_cause;
  if (typeof rootCauseRaw !== 'string' || !ctx.data.nodeById.has(rootCauseRaw)) {
    throw httpError.badRequest('root_cause 不在知识库中');
  }
  const rootCause = rootCauseRaw;
  const rootNode = ctx.data.nodeById.get(rootCause)!;

  const errorTypeRaw = req.body.error_type;
  if (!isErrorType(errorTypeRaw)) {
    throw httpError.badRequest('error_type 必须是五类枚举之一');
  }
  const errorType = errorTypeRaw;

  const chain = ctx.data.chainIncludingSelf(rootCause);
  const state = await loadSelectionState(ctx, user.user_id, space.space_id, 'diagnose');
  const perNode = chain.length <= SHORT_CHAIN_THRESHOLD ? 2 : 1;

  const picked: { item: ReturnType<typeof toClientItemWithDifficulty>; chainIndex: number; difficulty: number }[] = [];

  for (const [chainIndex, kp] of chain.entries()) {
    const available = ctx.data
      .itemsByKpPool(kp, 'train')
      .filter((item) => !state.usedItemIds.includes(item.item_id));

    for (const item of available.slice(0, perNode)) {
      picked.push({
        item: toClientItemWithDifficulty(item),
        chainIndex,
        difficulty: item.difficulty,
      });
    }
    if (picked.length >= MAX_PLAN_ITEMS * 2) break;
  }

  // 难度递增（主序）+ 沿链正向（次序）；同难度同链序按 item_id 稳定
  picked.sort(
    (a, b) =>
      a.difficulty - b.difficulty ||
      a.chainIndex - b.chainIndex ||
      (a.item.item_id < b.item.item_id ? -1 : a.item.item_id > b.item.item_id ? 1 : 0),
  );

  const itemSequence = picked.slice(0, MAX_PLAN_ITEMS).map((entry) => entry.item);

  const explanationOutline = rootNode.typical_errors
    .slice(0, OUTLINE_MAX_ITEMS)
    .map((entry) => `${entry.desc} → ${entry.remedy}`);

  return ok({
    strategy: STRATEGY_BY_ERROR_TYPE[errorType],
    explanation_outline: explanationOutline,
    item_sequence: itemSequence,
    path: chain,
  });
}
