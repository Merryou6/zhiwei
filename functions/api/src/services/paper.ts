/**
 * 试卷上传服务（契约 §5，接口 #9 upload / #10 get / #11 confirm；通路二 w = W_PAPER = 0.8）
 *
 * - 上传：本地确定性识别（D14）→ 整体写 recognitions 表（刷新页面可凭 recognition_id 回显）；
 *   识别本身**不产生证据、不更新掌握度**（确认才生效）。
 * - 回显：确认前 pending_confirm / 确认后 confirmed。
 * - 确认：unclear 项必须由学生手动标注（服务端拒绝默认值，PRD P0 #4）；
 *   kp_id 必须存在于知识库；与 kp_guess 不一致视为学生修正（允许）；
 *   重复确认 → 409（防双击重复计分）；逐题写 evidence_events(source="paper", w=0.8,
 *   item_id=null, raw 含 crop_url 与 student_answer, dedup 先查后写) + mastery_logs +
 *   mastery_profiles；确认后 status → confirmed、expire_at = now + 30d（合规项）。
 *
 * 502 / 504：模型上游失败或超时时返回 msg = "这道题我没看清，麻烦你手动标一下对错"（用户可读）。
 */

import { buildDedupKey, updateMastery } from '../../../../packages/engine/src/index';

import { isoPlusDays, nowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { ApiError, PAPER_FALLBACK_MSG, httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import { createModels } from '../models';
import type { RecognizeItemOutput } from '../models';
import type { RouteRequest } from '../router';
import type { RecognitionItemRecord, RecognitionRecord } from '../db/types';
import { authedUser } from './auth';

/** 试卷图片保留期限（契约 §5 合规项）。 */
export const PAPER_EXPIRE_DAYS = 30;
/** 学生可标注的结果枚举（契约 §5）。 */
export const CONFIRM_RESULTS = ['correct', 'wrong'] as const;

export type ConfirmResult = (typeof CONFIRM_RESULTS)[number];

/** 模型异常 → 契约 §5 用户可读降级话术（502 / 504）。 */
export function mapModelError(error: unknown): ApiError {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|ETIMEDOUT/i.test(message)
    ? httpError.modelTimeout(PAPER_FALLBACK_MSG)
    : httpError.modelUpstreamFailed(PAPER_FALLBACK_MSG);
}

/** 响应白名单（契约 §5 五项；crop_url 属存储字段，不下发）。 */
export function toClientRecognitionItem(item: RecognitionItemRecord): {
  seq: number;
  stem_excerpt: string;
  kp_guess: string;
  student_answer: string;
  suggested_result: string;
} {
  return {
    seq: item.seq,
    stem_excerpt: item.stem_excerpt,
    kp_guess: item.kp_guess,
    student_answer: item.student_answer,
    suggested_result: item.suggested_result,
  };
}

export function toClientRecognition(record: RecognitionRecord): {
  recognition_id: string;
  status: string;
  items: ReturnType<typeof toClientRecognitionItem>[];
} {
  return {
    recognition_id: record.recognition_id,
    status: record.status,
    items: record.items.map(toClientRecognitionItem),
  };
}

/** POST /api/evidence/paper */
export async function upload(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const fileId = req.body.file_id;
  if (typeof fileId !== 'string' || fileId.trim().length === 0) {
    throw httpError.badRequest('file_id 不能为空');
  }

  const recognitionId = newId('rec_');
  const nowMs = ctx.now();

  let recognized: RecognizeItemOutput[];
  try {
    recognized = await createModels().recognizePaper({
      space_id: space.space_id,
      file_id: fileId,
      recognition_id: recognitionId,
    });
  } catch (error) {
    throw mapModelError(error);
  }

  const record: RecognitionRecord = {
    recognition_id: recognitionId,
    user_id: user.user_id,
    space_id: space.space_id,
    file_id: fileId,
    status: 'pending_confirm',
    items: recognized,
    created_at: nowIso(nowMs),
    expire_at: isoPlusDays(nowMs, PAPER_EXPIRE_DAYS),
  };
  await ctx.store.insertRecognition(record);

  // 识别结果不产生证据、不更新掌握度（确认才生效）
  return ok({
    recognition_id: record.recognition_id,
    status: record.status,
    items: record.items.map(toClientRecognitionItem),
  });
}

/** 读取识别记录并做归属校验（404 / 403）。 */
async function loadOwnedRecognition(
  ctx: AppContext,
  userId: string,
  recognitionId: unknown,
): Promise<RecognitionRecord> {
  if (typeof recognitionId !== 'string' || recognitionId.trim().length === 0) {
    throw httpError.badRequest('recognition_id 不能为空');
  }
  const record = await ctx.store.getRecognition(recognitionId);
  if (!record) throw httpError.notFound('识别结果不存在');
  if (record.user_id !== userId) throw httpError.forbidden('无权访问该识别结果');
  return record;
}

/** GET /api/evidence/paper/{recognition_id} */
export async function getOne(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const record = await loadOwnedRecognition(ctx, user.user_id, req.params.recognitionId);
  return ok(toClientRecognition(record));
}

interface ConfirmRow {
  seq: number;
  kp_id: string;
  result: ConfirmResult;
}

/** 校验 confirm 的 items（unclear 必须手标；kp 必须存在；seq 必须属于该识别结果）。 */
export function parseConfirmItems(
  raw: unknown,
  ctx: AppContext,
  record: RecognitionRecord,
): Map<number, ConfirmRow> {
  if (!Array.isArray(raw)) {
    throw httpError.badRequest('items 必须是数组');
  }

  const bySeq = new Map<number, ConfirmRow>();
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw httpError.badRequest('items 每项必须是对象');
    }
    const { seq, kp_id: kpId, result } = entry as Record<string, unknown>;

    if (typeof seq !== 'number' || !Number.isInteger(seq)) {
      throw httpError.badRequest('items[].seq 必须是整数');
    }
    if (bySeq.has(seq)) {
      throw httpError.badRequest(`items[].seq 重复：${seq}`);
    }
    if (!record.items.some((item) => item.seq === seq)) {
      throw httpError.badRequest(`items[].seq 不属于该识别结果：${seq}`);
    }
    if (typeof kpId !== 'string' || !ctx.data.nodeById.has(kpId)) {
      throw httpError.badRequest(`items[].kp_id 不在知识库中：${String(kpId)}`);
    }
    if (typeof result !== 'string' || !(CONFIRM_RESULTS as readonly string[]).includes(result)) {
      throw httpError.badRequest('items[].result 必须是 correct | wrong');
    }
    bySeq.set(seq, { seq, kp_id: kpId, result: result as ConfirmResult });
  }

  // unclear 项必须由学生手动标注（服务端拒绝默认值）
  for (const item of record.items) {
    if (item.suggested_result === 'unclear' && !bySeq.has(item.seq)) {
      throw httpError.badRequest(`第 ${item.seq} 题识别不清，必须手动标注对错`);
    }
  }

  return bySeq;
}

/** POST /api/evidence/paper/confirm */
export async function confirmPaper(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);
  const record = await loadOwnedRecognition(ctx, user.user_id, req.body.recognition_id);

  if (record.space_id !== space.space_id) {
    throw httpError.forbidden('识别结果不属于该空间');
  }
  if (record.status !== 'pending_confirm') {
    throw httpError.conflict('该识别结果已确认');
  }

  const rows = parseConfirmItems(req.body.items, ctx, record);
  const nowMs = ctx.now();
  const createdAt = nowIso(nowMs);

  let eventsCreated = 0;
  const masteryByKp = new Map<string, { knowledge_point: string; before: number; after: number }>();

  for (const item of [...record.items].sort((a, b) => a.seq - b.seq)) {
    const submitted = rows.get(item.seq);
    const kpId = submitted?.kp_id ?? item.kp_guess;
    const rawResult = submitted?.result ?? item.suggested_result;
    if (rawResult !== 'correct' && rawResult !== 'wrong') {
      // parseConfirmItems 已保证 unclear 必然手标；此处为类型收窄
      throw httpError.badRequest(`第 ${item.seq} 题的结果非法`);
    }
    const isCorrect = rawResult === 'correct';

    const dedupKey = buildDedupKey({
      userId: user.user_id,
      spaceId: space.space_id,
      kp: kpId,
      source: 'paper',
      unixTs: Math.floor(nowMs / 1000),
    });
    // 先查后写（paper 事件 item_id = null，键单独生效）
    const existing = await ctx.store.findEventsByDedupKey(space.space_id, dedupKey);
    if (existing.length > 0) continue;

    const profile = await ctx.store.getProfile(user.user_id, space.space_id, kpId);
    const before = profile?.mastery ?? 0;
    const eventId = newId('evt_');
    const update = updateMastery(before, isCorrect, ctx.params.W_PAPER, ctx.params, eventId);

    await ctx.store.insertEvent({
      event_id: eventId,
      user_id: user.user_id,
      space_id: space.space_id,
      knowledge_point: kpId,
      item_id: null,
      source: 'paper',
      mode: null,
      result: isCorrect ? 'correct' : 'wrong',
      weight: ctx.params.W_PAPER,
      alpha: null,
      raw: {
        crop_url: item.crop_url,
        student_answer: item.student_answer,
        seq: item.seq,
      },
      dedup_key: dedupKey,
      expire_at: record.expire_at,
      created_at: createdAt,
    });

    await ctx.store.insertLog({
      log_id: newId('log_'),
      user_id: user.user_id,
      space_id: space.space_id,
      knowledge_point: kpId,
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
      knowledge_point: kpId,
      mastery: update.after,
      evidence_count: (profile?.evidence_count ?? 0) + 1,
      p_l0: profile?.p_l0 ?? before,
      status: profile?.status ?? 'active',
      last_updated: createdAt,
      last_evidence_type: 'paper',
    });

    eventsCreated += 1;
    const current = masteryByKp.get(kpId);
    masteryByKp.set(kpId, {
      knowledge_point: kpId,
      before: current ? current.before : update.before,
      after: update.after,
    });
  }

  record.status = 'confirmed';
  record.expire_at = isoPlusDays(nowMs, PAPER_EXPIRE_DAYS);
  await ctx.store.updateRecognition(record);

  return ok({
    events_created: eventsCreated,
    mastery_updates: [...masteryByKp.values()],
  });
}
