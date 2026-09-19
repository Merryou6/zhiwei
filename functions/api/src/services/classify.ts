/**
 * 错误类型诊断服务（契约 §6，接口 #12 POST /api/error/classify）
 *
 * 模型受约束调用 + **服务端后处理（真实实现，不采信适配器）**：
 *   - confidence < CONF_ADOPT(0.60) → 一律退回 clarify，禁止采纳（ALGORITHM §3）
 *   - attribution_direction 由服务端映射表从 error_type 硬编码（ALGORITHM §3 表）
 *   - error_type 必须在【五值全局枚举】内；matched_typical_error 只能取自
 *     该 kp 的 typical_errors[].code（越界 → 回退 null）
 *   - kp_id 必须是知识库完整 id
 * 不落表（契约 §6：模型受约束调用，无独立表；error_type 由 attributions 持久化）。
 */

import { ATTRIBUTION_DIRECTION, isErrorType } from '../data/staticData';
import type { BankItemRecord, ErrorType } from '../data/staticData';
import { normalizeAnswer } from '../grading';
import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { createModels } from '../models';
import type { ClassifyCandidate } from '../db/types';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

/** 规则 2 话术（作答正确，无错误可诊断）。 */
export const CLARIFY_CORRECT_QUESTION = '这次做对了，说说你当时卡在哪一步？';
/** 规则 3 话术（契约 §6 低置信样例）。 */
export const CLARIFY_LOW_CONFIDENCE_QUESTION = '你这一步是怎么算的？能写一下吗？';

/** POST /api/error/classify */
export async function classifyError(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const kpIdRaw = req.body.kp_id;
  if (typeof kpIdRaw !== 'string' || !ctx.data.nodeById.has(kpIdRaw)) {
    throw httpError.badRequest('kp_id 不在知识库中');
  }
  const kpId = kpIdRaw;
  const kp = ctx.data.nodeById.get(kpId)!;

  const itemIdRaw = req.body.item_id;
  let item: BankItemRecord | undefined;
  if (itemIdRaw !== undefined && itemIdRaw !== null && itemIdRaw !== '') {
    if (typeof itemIdRaw !== 'string') {
      throw httpError.badRequest('item_id 必须是字符串');
    }
    item = ctx.data.itemById.get(itemIdRaw);
    if (!item) throw httpError.notFound('题目不存在');
  }

  const stemRaw = req.body.stem;
  const stem = item ? item.stem : typeof stemRaw === 'string' ? stemRaw.trim() : '';
  if (stem.length === 0) {
    throw httpError.badRequest('item_id 为空时 stem 必填');
  }

  const studentAnswer = req.body.student_answer;
  if (typeof studentAnswer !== 'string') {
    throw httpError.badRequest('student_answer 必须是字符串');
  }

  const candidates: ClassifyCandidate[] = ctx.data.itemsByKp(kpId).map((entry) => ({
    item_id: entry.item_id,
    answer: entry.answer,
    distractors: entry.distractors,
  }));

  // 规则 2（服务层判定）：命中标准答案 → 错误分类无对象，诚实退回澄清
  const normalized = normalizeAnswer(studentAnswer);
  const answeredCorrectly =
    normalized.length > 0 &&
    candidates.some((candidate) => normalizeAnswer(candidate.answer) === normalized);
  if (answeredCorrectly) {
    return ok({ status: 'clarify', question: CLARIFY_CORRECT_QUESTION });
  }

  const output = await createModels().classify({
    stem,
    student_answer: studentAnswer,
    kp,
    candidates,
  });

  // ---- 服务端后处理：枚举校验 + 码校验 + 阈值拦截（不采信适配器）
  const errorType: ErrorType | null = isErrorType(output.error_type) ? output.error_type : null;
  const matched =
    typeof output.matched_typical_error === 'string' &&
    kp.typical_errors.some((entry) => entry.code === output.matched_typical_error)
      ? output.matched_typical_error
      : null;

  const confidence = typeof output.confidence === 'number' ? output.confidence : 0;

  if (errorType === null || confidence < ctx.params.CONF_ADOPT) {
    return ok({ status: 'clarify', question: CLARIFY_LOW_CONFIDENCE_QUESTION });
  }

  return ok({
    status: 'adopted',
    knowledge_point: kpId,
    error_type: errorType,
    matched_typical_error: matched,
    confidence,
    evidence: output.evidence,
    attribution_direction: ATTRIBUTION_DIRECTION[errorType],
  });
}
