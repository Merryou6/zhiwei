/**
 * 智能体对话服务（契约 §9，接口 #18 POST /api/agent/chat；SSE）
 *
 * 职责：SSE 事件序列 + **退出通道状态机**（ALGORITHM §5）+ 弱负证据（D13）+ 提示阶梯。
 *
 * 事件序列（契约 §9）：event: delta（≥1 段）→ event: meta → event: done
 * 降级（D11）：Accept: application/json 或 X-Response-Format: json → 普通 JSON
 *   { reply 全文, meta }（禁止白屏）。
 *
 * 规则落点：
 *   - kp 匹配置信度 < CONF_ADOPT(0.6) → 先追问澄清、**不产生证据**（沿用上轮已匹配的 kp）
 *   - ≥ 0.6 → 产生弱负证据（source="silent"、alpha=ALPHA_SILENT、1 小时去重）
 *     → applyWeakNegative + evidence_events + mastery_logs（D13：p_obs=p_eff=after、weight=0）
 *   - progress 只读适配器结构化字段（不解析自然语言）
 *   - consecutive_false：progress=true 清零，false 加一；≥CONSEC_FALSE_EXIT(3) → 退出通道；
 *     ==2 → hint_down（提示阶梯第 2 档，方向性提示）
 *   - 退出通道：当前 kp 置 blocked_by_prerequisite → 沿先修找**最近**的
 *     mastery < EXIT_UPSTREAM_THRESHOLD(0.6) 上游重启引导；连续跳转 ≤ MAX_EXIT_HOPS(2)，
 *     超限只提示不跳转；找不到达标上游 → 不跳转、改用基础巩固话术
 *   - 第 3 轮 = 完整解法（train 首题 solution_steps）+ 退出话术合并（四、4.3 留痕裁决）
 */

import { applyWeakNegative, buildDedupKey } from '../../../../packages/engine/src/index';

import { searchUpstream } from '../attribution/attributionCore';
import { headerValue, nowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import { createModels } from '../models';
import { exitLimitText, exitText, hintText, solutionText } from '../models/localChat';
import type { ChatNextAction } from '../models/types';
import type { DialogMessage, DialogRecord } from '../db/types';
import type { HandlerResult, RouteRequest, SseEvent } from '../router';
import type { KnowledgeNode } from '../data/staticData';
import { authedUser } from './auth';
import { kbOfSpace, loadSelectionState } from './diagnose';

export interface ChatMeta {
  dialog_id: string;
  kp_match: { kp_id: string; confidence: number };
  progress: boolean;
  progress_reason: string | null;
  next_action: ChatNextAction;
}

export interface ChatResult {
  meta: ChatMeta;
  /** 增量文本段（SSE 每段一个 delta 事件；拼接即 reply） */
  deltas: string[];
  reply: string;
}

function newDialog(ctx: AppContext, userId: string, spaceId: string): DialogRecord {
  return {
    dialog_id: newId('dlg_'),
    user_id: userId,
    space_id: spaceId,
    kp_id: null,
    messages: [],
    consecutive_false: 0,
    exit_count: 0,
    status: 'open',
    created_at: nowIso(ctx.now()),
  };
}

async function loadOwnedDialog(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  dialogId: unknown,
): Promise<DialogRecord> {
  if (typeof dialogId !== 'string' || dialogId.trim().length === 0) {
    throw httpError.badRequest('dialog_id 不能为空');
  }
  const dialog = await ctx.store.getDialog(dialogId);
  if (!dialog) throw httpError.notFound('对话不存在');
  if (dialog.user_id !== userId) throw httpError.forbidden('无权访问该对话');
  if (dialog.space_id !== spaceId) throw httpError.forbidden('对话不属于该空间');
  return dialog;
}

/** 弱负证据（D13）：applyWeakNegative + 1 小时去重 + 全字段留痕。 */
async function applySilentEvidence(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  kpId: string,
  raw: Record<string, unknown>,
): Promise<boolean> {
  const nowMs = ctx.now();
  const dedupKey = buildDedupKey({
    userId,
    spaceId,
    kp: kpId,
    source: 'silent',
    unixTs: Math.floor(nowMs / 1000),
  });

  // 先查后写（silent 事件 item_id = null，键单独生效）
  const existing = await ctx.store.findEventsByDedupKey(spaceId, dedupKey);
  if (existing.length > 0) return false;

  const createdAt = nowIso(nowMs);
  const profile = await ctx.store.getProfile(userId, spaceId, kpId);
  const before = profile?.mastery ?? 0;
  const after = applyWeakNegative(before, ctx.params);
  const eventId = newId('evt_');

  await ctx.store.insertEvent({
    event_id: eventId,
    user_id: userId,
    space_id: spaceId,
    knowledge_point: kpId,
    item_id: null,
    source: 'silent',
    mode: null,
    result: 'wrong',
    weight: 0,
    alpha: ctx.params.ALPHA_SILENT,
    raw,
    dedup_key: dedupKey,
    expire_at: null,
    created_at: createdAt,
  });

  // D13：弱负证据无三段式中间量 → p_obs = p_eff = after、weight = 0
  await ctx.store.insertLog({
    log_id: newId('log_'),
    user_id: userId,
    space_id: spaceId,
    knowledge_point: kpId,
    before,
    p_obs: after,
    p_eff: after,
    after,
    weight: 0,
    triggered_by: eventId,
    created_at: createdAt,
  });

  await ctx.store.upsertProfile({
    user_id: userId,
    space_id: spaceId,
    knowledge_point: kpId,
    mastery: after,
    evidence_count: (profile?.evidence_count ?? 0) + 1,
    p_l0: profile?.p_l0 ?? before,
    status: profile?.status ?? 'active',
    last_updated: createdAt,
    last_evidence_type: 'silent',
  });

  return true;
}

interface ExitOutcome {
  upstream: KnowledgeNode | null;
  jumped: boolean;
}

/** 退出通道（ALGORITHM §5）：标记 blocked_by_prerequisite + 最近低掌握上游跳转。 */
async function applyExitChannel(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  dialog: DialogRecord,
  currentKpId: string | null,
): Promise<ExitOutcome> {
  const timestamp = nowIso(ctx.now());

  if (currentKpId) {
    const profile = await ctx.store.getProfile(userId, spaceId, currentKpId);
    await ctx.store.upsertProfile({
      user_id: userId,
      space_id: spaceId,
      knowledge_point: currentKpId,
      mastery: profile?.mastery ?? 0,
      evidence_count: profile?.evidence_count ?? 0,
      p_l0: profile?.p_l0 ?? 0,
      status: 'blocked_by_prerequisite',
      last_updated: timestamp,
      last_evidence_type: profile?.last_evidence_type ?? null,
    });
  }

  if (!currentKpId) return { upstream: null, jumped: false };

  const state = await loadSelectionState(ctx, userId, spaceId, 'diagnose');
  // ALGORITHM §5 未限定回溯深度 → 放开到全图上界，仅用于找「最近」的低掌握上游
  // 上界取该空间学段的节点数（多学段并存后，另一个学段的节点与本图无关）
  const wide = { ...ctx.params, MAX_DEPTH: ctx.data.nodesForKb(await kbOfSpace(ctx, spaceId)).length };
  const search = searchUpstream(ctx.data.nodeById, state.mastery, currentKpId, wide);

  const lowOnes = search.suspects
    .filter((entry) => (state.mastery[entry.kp_id] ?? 0) < ctx.params.EXIT_UPSTREAM_THRESHOLD)
    .sort((a, b) => a.dist - b.dist || (a.kp_id < b.kp_id ? -1 : a.kp_id > b.kp_id ? 1 : 0));

  const target = lowOnes[0];
  if (!target) return { upstream: null, jumped: false };

  const upstream = ctx.data.nodeById.get(target.kp_id) ?? null;

  // 连续跳转上限（防一路滑到底）
  if (dialog.exit_count >= ctx.params.MAX_EXIT_HOPS) {
    return { upstream, jumped: false };
  }

  dialog.exit_count += 1;
  dialog.kp_id = target.kp_id;
  return { upstream, jumped: true };
}

/** 一轮对话的核心逻辑（SSE 与 JSON 降级共用）。 */
export async function runChat(req: RouteRequest, ctx: AppContext): Promise<ChatResult> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const message = req.body.message;
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw httpError.badRequest('message 不能为空');
  }
  const imageFileId = req.body.image_file_id;
  if (
    imageFileId !== undefined &&
    imageFileId !== null &&
    typeof imageFileId !== 'string'
  ) {
    throw httpError.badRequest('image_file_id 必须是字符串');
  }

  const dialog =
    req.body.dialog_id === undefined || req.body.dialog_id === null || req.body.dialog_id === ''
      ? newDialog(ctx, user.user_id, space.space_id)
      : await loadOwnedDialog(ctx, user.user_id, space.space_id, req.body.dialog_id);

  const turn = await createModels().chatTurn({
    message,
    image_file_id: typeof imageFileId === 'string' ? imageFileId : null,
    nodes: ctx.data.nodesForKb(space.knowledge_source[0]),
    history: dialog.messages,
  });

  // kp 匹配：≥ CONF_ADOPT 才认；否则沿用上轮已匹配 kp（追问澄清，不产生证据）
  const matched =
    turn.kp_match.confidence >= ctx.params.CONF_ADOPT &&
    ctx.data.nodeById.has(turn.kp_match.kp_id)
      ? turn.kp_match.kp_id
      : null;
  const effectiveKp = matched ?? dialog.kp_id;
  const effectiveNode = effectiveKp ? (ctx.data.nodeById.get(effectiveKp) ?? null) : null;

  if (matched) {
    dialog.kp_id = matched;
    await applySilentEvidence(ctx, user.user_id, space.space_id, matched, {
      message,
      image_file_id: typeof imageFileId === 'string' ? imageFileId : null,
    });
  }

  // ---- 状态机（ALGORITHM §5）
  const consecutiveFalse = turn.progress ? 0 : dialog.consecutive_false + 1;
  dialog.consecutive_false = consecutiveFalse;

  let nextAction: ChatNextAction = 'continue';
  let exitOutcome: ExitOutcome = { upstream: null, jumped: false };

  if (!turn.progress && consecutiveFalse >= ctx.params.CONSEC_FALSE_EXIT) {
    nextAction = 'exit_channel';
    exitOutcome = await applyExitChannel(ctx, user.user_id, space.space_id, dialog, effectiveKp);
    dialog.status = 'exited';
  } else if (!turn.progress && consecutiveFalse === 2) {
    nextAction = 'hint_down';
  }

  // ---- delta 分段（拼接即 reply）
  const segments: string[] = [turn.reply];
  if (nextAction === 'hint_down') {
    segments.push(`\n\n${hintText(effectiveNode)}`);
  } else if (nextAction === 'exit_channel') {
    const state = await loadSelectionState(ctx, user.user_id, space.space_id, 'diagnose');
    segments.push(`\n\n${solutionText(effectiveNode, ctx.data.items, state.usedItemIds)}`);
    segments.push(
      `\n\n${exitOutcome.jumped ? exitText(exitOutcome.upstream) : exitLimitText(effectiveNode)}`,
    );
  }
  const reply = segments.join('');

  // ---- kp_match：存在低掌握上游且发生跳转时切到上游（四、4.3 / 计划 #18）
  const kpMatch =
    exitOutcome.jumped && exitOutcome.upstream
      ? { kp_id: exitOutcome.upstream.id, confidence: turn.kp_match.confidence }
      : effectiveKp
        ? { kp_id: effectiveKp, confidence: turn.kp_match.confidence }
        : { kp_id: turn.kp_match.kp_id, confidence: turn.kp_match.confidence };

  const timestamp = nowIso(ctx.now());
  const studentMessage: DialogMessage = {
    role: 'student',
    content: message,
    image_file_id: typeof imageFileId === 'string' ? imageFileId : null,
    ts: timestamp,
  };
  const agentMessage: DialogMessage = {
    role: 'agent',
    content: reply,
    progress: turn.progress,
    progress_reason: turn.progress_reason,
    next_action: nextAction,
    ts: timestamp,
  };
  dialog.messages = [...dialog.messages, studentMessage, agentMessage];
  await ctx.store.upsertDialog(dialog);

  return {
    meta: {
      dialog_id: dialog.dialog_id,
      kp_match: kpMatch,
      progress: turn.progress,
      progress_reason: turn.progress_reason,
      next_action: nextAction,
    },
    deltas: segments,
    reply,
  };
}

/** SSE 事件序列：delta（≥1 段）→ meta → done。 */
async function* toSseStream(result: ChatResult): AsyncGenerator<SseEvent> {
  for (const segment of result.deltas) {
    yield { event: 'delta', data: { text: segment } };
  }
  yield { event: 'meta', data: result.meta };
  yield { event: 'done', data: {} };
}

/** 请求是否要求普通 JSON（D11 降级路径）。 */
export function wantsJson(headers: RouteRequest['headers']): boolean {
  const accept = headerValue(headers, 'accept') ?? '';
  if (accept.toLowerCase().includes('application/json')) return true;
  return (headerValue(headers, 'x-response-format') ?? '').toLowerCase() === 'json';
}

/** POST /api/agent/chat：SSE 或 JSON 降级（业务计算先于流开始，错误走普通 JSON 错误体）。 */
export async function chat(req: RouteRequest, ctx: AppContext): Promise<HandlerResult> {
  const result = await runChat(req, ctx);

  if (wantsJson(req.headers)) {
    return ok({ reply: result.reply, meta: result.meta });
  }
  return toSseStream(result);
}

/** JSON 降级响应的 data 形态（供测试与 closedLoop 断言复用）。 */
export interface ChatJsonData {
  reply: string;
  meta: ChatMeta;
}

export type ChatJsonResponse = ApiResponse<ChatJsonData>;
