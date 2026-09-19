/**
 * 归因服务（契约 §7，接口 #13 analyze / #14 get / #15 verify / #16 agent/reject）
 *
 * ALGORITHM §4 在服务端落地（迭代 1 未实现部分）：
 *   - direction=self（concept_confusion / method_gap）→ 不回溯：path=[kp]、根因即本节点，
 *     verification_item=null、suspect_scores={}（无候选，无需验证 → verified=true）
 *   - direction=upstream（prerequisite_gap）→ BFS 反向 ≤MAX_DEPTH + 嫌疑分公式
 *     （attributionCore），降序逐个出最小验证题（train 池最低难度未做题）
 *   - direction=none（procedural_slip / misreading）→ 400（契约 §7 前置：不进归因；
 *     服务端做防御，不依赖前端自觉）
 *
 * verify：correct 由服务端判定（D10，不采信前端）；答对 → 确认根因（verified=true、
 *   verified_by=evt_id）；答错 → 排除当前候选取次高嫌疑；候选全部排除 →
 *   root_cause 回落 from_kp（诚实兜底，不硬猜）；验证题作答写 source="diagnose"
 *   mode="diagnose" w=1.0 证据 + BKT + mastery_logs。
 *
 * reject：attributions.rejected_by_student = true + 追加一道再验证题；
 *   候选耗尽 → 按 #15 回落规则 root_cause=from_kp，verification_item=null。
 *
 * 候选游标持久化：AttributionRecord.pending_candidates（内部字段，响应不下发），
 * 见 db/types.ts 该字段注释与执行报告偏差留痕。
 */

import { buildDedupKey, updateMastery } from '../../../../packages/engine/src/index';

import { buildPath, pickVerificationItem, searchUpstream } from '../attribution/attributionCore';
import { nowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { ATTRIBUTION_DIRECTION, isErrorType } from '../data/staticData';
import type { ErrorType } from '../data/staticData';
import { gradeItem } from '../grading';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { AttributionRecord } from '../db/types';
import type { RouteRequest } from '../router';
import { toClientItem } from '../serialization';
import type { ClientItem } from '../serialization';
import { authedUser } from './auth';
import { loadSelectionState } from './diagnose';

export interface AttributionView {
  attribution_id: string;
  from_kp: string;
  root_cause: string;
  error_type: ErrorType;
  path: string[];
  suspect_scores: Record<string, number>;
  verified: boolean;
  verified_by: string | null;
  rejected_by_student: boolean;
  verification_item: ClientItem | null;
}

export interface NextCandidateView {
  kp_id: string;
  suspect_score: number;
  verification_item: ClientItem | null;
}

/** 统一视图（analyze / get 共用，保证「analyze 后立即 GET 字段一致」）。 */
async function toView(ctx: AppContext, record: AttributionRecord): Promise<AttributionView> {
  const pending = record.pending_candidates[0];
  let verificationItem: ClientItem | null = null;

  if (pending && !record.verified) {
    const state = await loadSelectionState(ctx, record.user_id, record.space_id, 'diagnose');
    const item = pickVerificationItem(ctx.data.items, pending, state.usedItemIds);
    verificationItem = item ? toClientItem(item) : null;
  }

  return {
    attribution_id: record.attribution_id,
    from_kp: record.from_kp,
    root_cause: record.root_cause,
    error_type: record.error_type,
    path: record.path,
    suspect_scores: record.suspect_scores,
    verified: record.verified,
    verified_by: record.verified_by,
    rejected_by_student: record.rejected_by_student,
    verification_item: verificationItem,
  };
}

async function loadOwned(
  ctx: AppContext,
  userId: string,
  attributionId: unknown,
): Promise<AttributionRecord> {
  if (typeof attributionId !== 'string' || attributionId.trim().length === 0) {
    throw httpError.badRequest('attribution_id 不能为空');
  }
  const record = await ctx.store.getAttribution(attributionId);
  if (!record) throw httpError.notFound('归因结果不存在');
  if (record.user_id !== userId) throw httpError.forbidden('无权访问该归因结果');
  return record;
}

/** POST /api/attribution/analyze */
export async function analyze(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const kpIdRaw = req.body.kp_id;
  if (typeof kpIdRaw !== 'string' || !ctx.data.nodeById.has(kpIdRaw)) {
    throw httpError.badRequest('kp_id 不在知识库中');
  }
  const kpId = kpIdRaw;

  const errorTypeRaw = req.body.error_type;
  if (!isErrorType(errorTypeRaw)) {
    throw httpError.badRequest('error_type 必须是五类枚举之一');
  }
  const errorType = errorTypeRaw;

  const direction = ATTRIBUTION_DIRECTION[errorType];
  if (direction === 'none') {
    throw httpError.badRequest(`${errorType} 不进归因（契约 §7 前置 + ALGORITHM §3）`);
  }

  const createdAt = nowIso(ctx.now());
  const attributionId = newId('attr_');

  let rootCause = kpId;
  let path = [kpId];
  let suspectScores: Record<string, number> = {};
  let pending: string[] = [];
  let verificationItem: ClientItem | null = null;
  // direction=self：根因即本节点（不回溯、无需验证）
  let verified = direction === 'self';

  if (direction === 'upstream') {
    const state = await loadSelectionState(ctx, user.user_id, space.space_id, 'diagnose');
    const search = searchUpstream(ctx.data.nodeById, state.mastery, kpId, ctx.params);

    if (search.suspects.length > 0) {
      pending = search.suspects.map((entry) => entry.kp_id);
      suspectScores = Object.fromEntries(
        search.suspects.map((entry) => [entry.kp_id, entry.suspect_score]),
      );
      rootCause = pending[0];
      path = buildPath(kpId, rootCause, search.parents);

      const item = pickVerificationItem(ctx.data.items, rootCause, state.usedItemIds);
      verificationItem = item ? toClientItem(item) : null;
    }
    // 无先修可回溯（如根节点）→ 如实回落本节点，不硬猜
  }

  const record: AttributionRecord = {
    attribution_id: attributionId,
    user_id: user.user_id,
    space_id: space.space_id,
    from_kp: kpId,
    root_cause: rootCause,
    error_type: errorType,
    path,
    suspect_scores: suspectScores,
    verified,
    verified_by: null,
    rejected_by_student: false,
    created_at: createdAt,
    pending_candidates: verified ? [] : pending,
  };
  await ctx.store.insertAttribution(record);

  return ok({
    attribution_id: record.attribution_id,
    root_cause: record.root_cause,
    path: record.path,
    suspect_scores: record.suspect_scores,
    verification_item: verificationItem,
  });
}

/** GET /api/attribution/{attribution_id} */
export async function getOne(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const record = await loadOwned(ctx, user.user_id, req.params.attributionId);
  return ok(await toView(ctx, record));
}

/** POST /api/attribution/verify */
export async function verify(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const record = await loadOwned(ctx, user.user_id, req.body.attribution_id);

  const itemId = req.body.item_id;
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw httpError.badRequest('item_id 不能为空');
  }
  const item = ctx.data.itemById.get(itemId);
  if (!item) throw httpError.notFound('验证题不存在');

  // MINOR-①（迭代2 遗留清偿）：pending_candidates 非空时，item 必须属于当前候选集。
  // 理由：前端会把服务端下发的 verification_item 原样回传，但「反驳追加题 / 刷新回显 /
  // 旧页面残留」都可能让前端传一道已经过期的题；候选游标由 item.knowledge_point 推进
  // （见下方 excluded 逻辑），若不校验，传任意题库题都会静默推进游标 → 归因结论被污染。
  // pending 为空（已 verified / self 型）时维持既有幂等行为不变。
  if (
    record.pending_candidates.length > 0 &&
    !record.pending_candidates.includes(item.knowledge_point)
  ) {
    throw httpError.badRequest('这不是当前的验证题，先完成手头这道');
  }

  const answer = req.body.answer;
  if (typeof answer !== 'string') {
    throw httpError.badRequest('answer 必须是字符串');
  }

  const grade = gradeItem(item, answer);
  const nowMs = ctx.now();
  const createdAt = nowIso(nowMs);

  const dedupKey = buildDedupKey({
    userId: user.user_id,
    spaceId: record.space_id,
    kp: item.knowledge_point,
    source: 'diagnose',
    unixTs: Math.floor(nowMs / 1000),
  });
  // D7 事件级幂等：同键同题再次提交不重复计分，也不重复推进候选
  const hit = (await ctx.store.findEventsByDedupKey(record.space_id, dedupKey)).find(
    (event) => event.item_id === itemId,
  );

  if (!hit) {
    const profile = await ctx.store.getProfile(
      user.user_id,
      record.space_id,
      item.knowledge_point,
    );
    const before = profile?.mastery ?? 0;
    const eventId = newId('evt_');
    const update = updateMastery(before, grade.correct, ctx.params.W_DIAGNOSE, ctx.params, eventId);

    await ctx.store.insertEvent({
      event_id: eventId,
      user_id: user.user_id,
      space_id: record.space_id,
      knowledge_point: item.knowledge_point,
      item_id: itemId,
      source: 'diagnose',
      mode: 'diagnose',
      result: grade.correct ? 'correct' : 'wrong',
      weight: ctx.params.W_DIAGNOSE,
      alpha: null,
      raw: { student_answer: answer, matched_error_code: grade.matched_error_code, verified_by: record.attribution_id },
      dedup_key: dedupKey,
      expire_at: null,
      created_at: createdAt,
    });

    await ctx.store.insertLog({
      log_id: newId('log_'),
      user_id: user.user_id,
      space_id: record.space_id,
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
      space_id: record.space_id,
      knowledge_point: item.knowledge_point,
      mastery: update.after,
      evidence_count: (profile?.evidence_count ?? 0) + 1,
      p_l0: profile?.p_l0 ?? before,
      status: profile?.status ?? 'active',
      last_updated: createdAt,
      last_evidence_type: 'diagnose',
    });

    // ---- 候选推进：答对确认根因；答错排除当前候选；全部排除则诚实回落
    if (grade.correct) {
      record.root_cause = item.knowledge_point;
      const search = searchUpstream(
        ctx.data.nodeById,
        (await loadSelectionState(ctx, user.user_id, record.space_id, 'diagnose')).mastery,
        record.from_kp,
        ctx.params,
      );
      record.path = buildPath(record.from_kp, record.root_cause, search.parents);
      record.verified = true;
      record.verified_by = eventId;
      record.pending_candidates = [];
    } else {
      const excluded = record.pending_candidates.includes(item.knowledge_point)
        ? item.knowledge_point
        : record.pending_candidates[0];
      record.pending_candidates = record.pending_candidates.filter((kp) => kp !== excluded);

      if (record.pending_candidates.length === 0) {
        record.root_cause = record.from_kp;
        record.path = [record.from_kp];
        record.verified = true;
        record.verified_by = eventId;
      } else {
        const search = searchUpstream(
          ctx.data.nodeById,
          (await loadSelectionState(ctx, user.user_id, record.space_id, 'diagnose')).mastery,
          record.from_kp,
          ctx.params,
        );
        record.root_cause = record.pending_candidates[0];
        record.path = buildPath(record.from_kp, record.root_cause, search.parents);
      }
    }

    await ctx.store.updateAttribution(record);
  }

  let nextCandidate: NextCandidateView | null = null;
  if (!record.verified && record.pending_candidates.length > 0) {
    const nextKp = record.pending_candidates[0];
    const state = await loadSelectionState(ctx, user.user_id, record.space_id, 'diagnose');
    const nextItem = pickVerificationItem(ctx.data.items, nextKp, state.usedItemIds);
    nextCandidate = {
      kp_id: nextKp,
      suspect_score: record.suspect_scores[nextKp] ?? 0,
      verification_item: nextItem ? toClientItem(nextItem) : null,
    };
  }

  return ok({
    verified: record.verified,
    correct: grade.correct,
    root_cause: record.root_cause,
    next_candidate: nextCandidate,
  });
}

/** POST /api/agent/reject */
export async function reject(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const record = await loadOwned(ctx, user.user_id, req.body.attribution_id);

  record.rejected_by_student = true;
  record.pending_candidates = record.pending_candidates.slice(1);

  let verificationItem: ClientItem | null = null;

  if (record.pending_candidates.length === 0) {
    // 候选耗尽 → 按 #15 回落规则处理（诚实兜底）
    record.root_cause = record.from_kp;
    record.path = [record.from_kp];
    record.verified = true;
  } else {
    const search = searchUpstream(
      ctx.data.nodeById,
      (await loadSelectionState(ctx, user.user_id, record.space_id, 'diagnose')).mastery,
      record.from_kp,
      ctx.params,
    );
    const nextKp = record.pending_candidates[0];
    record.root_cause = nextKp;
    record.path = buildPath(record.from_kp, nextKp, search.parents);
    const state = await loadSelectionState(ctx, user.user_id, record.space_id, 'diagnose');
    const item = pickVerificationItem(ctx.data.items, nextKp, state.usedItemIds);
    verificationItem = item ? toClientItem(item) : null;
  }

  await ctx.store.updateAttribution(record);

  return ok({ verification_item: verificationItem });
}
