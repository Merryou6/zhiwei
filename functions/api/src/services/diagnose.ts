/**
 * 测评服务（契约 §4，接口 #7 next / #8 submit，通路三 w = W_DIAGNOSE = 1.0）
 *
 * 复用引擎（禁重写）：nextItem（含 D8 stopReason）/ poolForMode / updateMastery / buildDedupKey。
 *
 * 口径（计划 三、#7/#8）：
 *   usedItemIds  = 请求 exclude_item_ids ∪ 该 space 全部 evidence_events 的 item_id
 *   answeredCount = 该 space source="diagnose" 且 mode=本次 mode 的事件数
 *   scope_chapter 非空 → 图谱先按章节过滤再进选题
 *   correct 仅 baseline/retest 返回（diagnose 恒 null，防反推答案）
 *   幂等（D7）：dedup_key 相同**且** item_id 相同 → 静默返回当前状态，不写事件、不更新掌握度
 *   测量一致性（D15，仅 mode=retest）：首选 kp = 本 space 已有 baseline 证据的 kp（尚未复测者排前），
 *   经 nextItem 的 measureKps 传入；无基线证据 / 首选 kp 无 retest 池可用题 → 引擎回落原排序。
 *   mode=diagnose / baseline 的选题行为逐字不变。
 */

import {
  buildDedupKey,
  nextItem,
  poolForMode,
  updateMastery,
} from '../../../../packages/engine/src/index';
import type { GraphNode, SelectionMode } from '../../../../packages/engine/src/index';

import { nowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { gradeItem } from '../grading';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import { toClientItem } from '../serialization';
import type { BankItemRecord } from '../data/staticData';
import { authedUser } from './auth';

export const MODES: readonly SelectionMode[] = ['diagnose', 'baseline', 'retest'];

export function parseMode(value: unknown): SelectionMode {
  if (typeof value === 'string' && (MODES as readonly string[]).includes(value)) {
    return value as SelectionMode;
  }
  throw httpError.badRequest('mode 必须是 diagnose | baseline | retest');
}

/** 图谱：scope_chapter 非空时先按章节过滤（未命中章节 → 400）。 */
export function buildGraph(ctx: AppContext, scopeChapter: unknown): GraphNode[] {
  if (scopeChapter === undefined || scopeChapter === null || scopeChapter === '') {
    return ctx.data.nodes.map((node) => ({ id: node.id, prerequisites: node.prerequisites }));
  }
  if (typeof scopeChapter !== 'string') {
    throw httpError.badRequest('scope_chapter 必须是字符串');
  }
  const nodes = ctx.data.nodesByChapter(scopeChapter);
  if (nodes.length === 0) {
    throw httpError.badRequest(`章节不存在：${scopeChapter}`);
  }
  return nodes.map((node) => ({ id: node.id, prerequisites: node.prerequisites }));
}

function parseItemIdList(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw httpError.badRequest('exclude_item_ids 必须是数组');
  return raw.filter((value): value is string => typeof value === 'string');
}

export interface SpaceSelectionState {
  mastery: Record<string, number>;
  usedItemIds: string[];
  answeredCount: number;
  /**
   * 该 space 已有 mode='baseline' 证据事件的 kp（去重，保持事件顺序）——复测基准集合（D15）。
   * 与 report.ts 的 accuracy 分组口径一致（source='diagnose' 且 mode='baseline'）。
   */
  baselineKps: string[];
  /**
   * 该 space 已有 mode='retest' 证据事件的 kp（去重）——用于把「尚未复测的基线 kp」排前，
   * 使一轮复测覆盖整批基线 kp（PRD §7「复测与基线测同一批知识点」）。
   * 两项均由 loadSelectionState 已取出的事件列表计算，**零额外 IO**。
   */
  retestKps: string[];
}

/** 取该 space 的选题态（掌握度 + 已做 + 已答数）。 */
export async function loadSelectionState(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  mode: SelectionMode,
): Promise<SpaceSelectionState> {
  const mastery: Record<string, number> = {};
  for (const node of ctx.data.nodes) mastery[node.id] = 0;
  for (const profile of await ctx.store.listProfiles(userId, spaceId)) {
    mastery[profile.knowledge_point] = profile.mastery;
  }

  const events = await ctx.store.listEventsBySpace(spaceId);
  const usedItemIds = events
    .map((event) => event.item_id)
    .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0);
  const answeredCount = events.filter(
    (event) => event.source === 'diagnose' && event.mode === mode,
  ).length;

  const kpsByMode = (target: 'baseline' | 'retest'): string[] => [
    ...new Set(
      events
        .filter((event) => event.source === 'diagnose' && event.mode === target)
        .map((event) => event.knowledge_point),
    ),
  ];
  const baselineKps = kpsByMode('baseline');
  const retestKps = kpsByMode('retest');

  return { mastery, usedItemIds, answeredCount, baselineKps, retestKps };
}

/**
 * 复测的首选 kp 顺序（D15）：尚未复测的基线 kp 优先，再是已复测过的基线 kp；
 * 无基线证据（集合为空）→ 返回空数组，引擎回落原排序（向后兼容）。
 */
export function measureKpsForRetest(state: SpaceSelectionState): string[] {
  if (state.baselineKps.length === 0) return [];
  const retested = new Set(state.retestKps);
  const pending = state.baselineKps.filter((kp) => !retested.has(kp));
  const done = state.baselineKps.filter((kp) => retested.has(kp));
  return [...pending, ...done];
}

function resolveClientItem(
  ctx: AppContext,
  itemId: string | null | undefined,
): ReturnType<typeof toClientItem> | null {
  if (!itemId) return null;
  const record = ctx.data.itemById.get(itemId);
  return record ? toClientItem(record) : null;
}

interface SelectionOutcome {
  converged: boolean;
  remaining: number;
  nextItem: ReturnType<typeof toClientItem> | null;
}

/** 复跑选题（next 与 submit 共用）。 */
export async function computeSelection(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  mode: SelectionMode,
  graph: GraphNode[],
  extraUsed: string[] = [],
): Promise<SelectionOutcome> {
  const state = await loadSelectionState(ctx, userId, spaceId, mode);
  const usedItemIds = [...new Set([...state.usedItemIds, ...extraUsed])];

  const result = nextItem({
    graph,
    bank: ctx.data.items,
    mastery: state.mastery,
    mode,
    usedItemIds,
    answeredCount: state.answeredCount,
    params: ctx.params,
    // 测量一致性（D15）：复测优先落在已有基线证据的 kp 上，使报告 ΔAccuracy 可计算；
    // 集合内 retest 池无可用题时由引擎自然回退（不报错）。
    measureKps: mode === 'retest' ? measureKpsForRetest(state) : undefined,
  });

  return {
    converged: result.converged,
    remaining: result.remaining,
    nextItem: resolveClientItem(ctx, result.item?.item_id),
  };
}

/** POST /api/diagnose/next */
export async function next(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);
  const mode = parseMode(req.body.mode);
  const graph = buildGraph(ctx, req.body.scope_chapter);
  const exclude = parseItemIdList(req.body.exclude_item_ids);

  const outcome = await computeSelection(ctx, user.user_id, space.space_id, mode, graph, exclude);

  return ok({
    item: outcome.nextItem,
    remaining: outcome.remaining,
    converged: outcome.converged,
  });
}

/** POST /api/diagnose/submit */
export async function submit(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);
  const mode = parseMode(req.body.mode);

  const itemId = req.body.item_id;
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw httpError.badRequest('item_id 不能为空');
  }
  const item: BankItemRecord | undefined = ctx.data.itemById.get(itemId);
  if (!item) {
    throw httpError.notFound('题目不存在');
  }
  const answer = req.body.answer;
  if (typeof answer !== 'string') {
    throw httpError.badRequest('answer 必须是字符串');
  }

  const nowMs = ctx.now();
  const createdAt = nowIso(nowMs);
  const dedupKey = buildDedupKey({
    userId: user.user_id,
    spaceId: space.space_id,
    kp: item.knowledge_point,
    source: 'diagnose',
    unixTs: Math.floor(nowMs / 1000),
  });

  const graph = buildGraph(ctx, undefined);

  // ---- 幂等（D7 事件级）：dedup_key 相同且 item_id 相同 → 静默返回当前状态
  const sameKeyEvents = await ctx.store.findEventsByDedupKey(space.space_id, dedupKey);
  const hit = sameKeyEvents.find((event) => event.item_id === itemId);
  if (hit) {
    const profile = await ctx.store.getProfile(
      user.user_id,
      space.space_id,
      item.knowledge_point,
    );
    const mastery = profile?.mastery ?? 0;
    const outcome = await computeSelection(ctx, user.user_id, space.space_id, mode, graph);
    return ok({
      correct: mode === 'diagnose' ? null : hit.result === 'correct',
      mastery_before: mastery,
      mastery_after: mastery,
      converged: outcome.converged,
      next_item: outcome.nextItem,
    });
  }

  // ---- 判定 + 三段式更新 + 留痕
  const grade = gradeItem(item, answer);
  const profile = await ctx.store.getProfile(user.user_id, space.space_id, item.knowledge_point);
  const before = profile?.mastery ?? 0;

  const eventId = newId('evt_');
  const update = updateMastery(before, grade.correct, ctx.params.W_DIAGNOSE, ctx.params, eventId);

  await ctx.store.insertEvent({
    event_id: eventId,
    user_id: user.user_id,
    space_id: space.space_id,
    knowledge_point: item.knowledge_point,
    item_id: itemId,
    source: 'diagnose',
    mode,
    result: grade.correct ? 'correct' : 'wrong',
    weight: ctx.params.W_DIAGNOSE,
    alpha: null,
    raw: {
      student_answer: answer,
      matched_error_code: grade.matched_error_code,
    },
    dedup_key: dedupKey,
    expire_at: null,
    created_at: createdAt,
  });

  await ctx.store.insertLog({
    log_id: newId('log_'),
    user_id: user.user_id,
    space_id: space.space_id,
    knowledge_point: item.knowledge_point,
    before: update.before,
    p_obs: update.p_obs,
    p_eff: update.p_eff,
    after: update.after,
    weight: update.weight,
    triggered_by: eventId,
    created_at: createdAt,
  });

  await ctx.store.upsertProfile({
    user_id: user.user_id,
    space_id: space.space_id,
    knowledge_point: item.knowledge_point,
    mastery: update.after,
    evidence_count: (profile?.evidence_count ?? 0) + 1,
    p_l0: profile?.p_l0 ?? before,
    status: profile?.status ?? 'active',
    last_updated: createdAt,
    last_evidence_type: 'diagnose',
  });

  const outcome = await computeSelection(ctx, user.user_id, space.space_id, mode, graph);

  return ok({
    correct: mode === 'diagnose' ? null : grade.correct,
    mastery_before: update.before,
    mastery_after: update.after,
    converged: outcome.converged,
    next_item: outcome.nextItem,
  });
}

/** 供测试/调试读取池推导结果（服务端职责，前端不传 pool）。 */
export { poolForMode };
