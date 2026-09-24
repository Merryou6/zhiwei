/**
 * 智能体对话服务（契约 §9，接口 #18 POST /api/agent/chat；SSE）
 *
 * 职责：SSE 事件序列 + **退出通道状态机**（ALGORITHM §5）+ 弱负证据（D13）+ 提示阶梯。
 *
 * 事件序列（契约 §9 v1.3）：
 *   phase/thought/tool 过程事件（本地模式全部先于首个 delta；真实执行序，未发生的步骤零事件）
 *   → event: delta（≥1 段）→ event: meta → event: done
 * 降级（D11）：Accept: application/json 或 X-Response-Format: json → 普通 JSON
 *   { reply 全文, meta, trace }（禁止白屏；trace 顺序即执行顺序，前端重放为对应回调）。
 *
 * 链路透出纪律（计划 D4，红线）：
 *   - tool.args / tool.result 全部是**真实中间量**（真实 kp_id / 置信度 / before-after /
 *     去重命中与否 / consecutive_false / exit_count）；未执行的动作为零事件。
 *   - tool.ms 是真实执行耗时（本地毫秒级，不人为 delay、不伪造 ms）。
 *   - thought 是**由真实中间量拼成的确定性推理摘要**（不是伪装成模型独白的话术）。
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
 *
 * 拆两段（D9a）保住「流开始之前的错误走普通 JSON 错误体」：
 *   prepareChat() 认证 + 空间归属 + 入参校验 + dialog 加载（401/403/400/404 全在这里抛）
 *   runChat()     模型调用 / 证据 / 状态机 / 分段 / 落库，过程事件经 emit 产出
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
import type { ChatNextAction, ChatTurnOutput } from '../models/types';
import type { DialogMessage, DialogRecord } from '../db/types';
import type { HandlerResult, RouteRequest, SseEvent } from '../router';
import type { KnowledgeNode } from '../data/staticData';
import { authedUser } from './auth';
import {
  createToolIdSeq,
  createTraceRecorder,
  deltaEvent,
  phaseEvent,
  thoughtEvent,
  toolEvent,
} from './chatTrace';
import type { ChatEmit, ChatTraceStep } from './chatTrace';
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

/** kp_match.args.message_excerpt 的截断长度（契约 §9 v1.3：≤20 字）。 */
const MESSAGE_EXCERPT_MAX = 20;

/** 真实执行计时（毫秒，3 位小数）。
 *  用实时时钟而非 ctx.now()：ctx.now() 在测试里是固定值，拿它算耗时恒为 0，等于伪造。 */
const realNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
const msSince = (start: number): number => Math.round((realNow() - start) * 1000) / 1000;

/** 摘要里的数值格式：保留两位小数再去掉尾零（0.5 → "0.5"、0.45 → "0.45"）。 */
function fmt(value: number): string {
  return String(Number(value.toFixed(2)));
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

/** 流开始前的全部校验（D9a）：抛错 → 普通 JSON 错误体，绝不变成流内 error 事件。 */
export interface PreparedChat {
  userId: string;
  spaceId: string;
  /** 空间的知识库 id（load_graph.args.kb 的真实值）。 */
  kb: string;
  /** 该知识库的图谱节点（load_graph 的真实产出）。 */
  nodes: KnowledgeNode[];
  /** nodesForKb 的真实耗时（load_graph.ms）。 */
  graphMs: number;
  message: string;
  imageFileId: string | null;
  dialog: DialogRecord;
}

export async function prepareChat(req: RouteRequest, ctx: AppContext): Promise<PreparedChat> {
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

  const kb = space.knowledge_source[0];
  const graphStart = realNow();
  const nodes = ctx.data.nodesForKb(kb);
  const graphMs = msSince(graphStart);

  return {
    userId: user.user_id,
    spaceId: space.space_id,
    kb,
    nodes,
    graphMs,
    message,
    imageFileId: typeof imageFileId === 'string' ? imageFileId : null,
    dialog,
  };
}

/** 弱负证据的真实中间量（tool 事件 args/result 用；写入逻辑本身一行未改）。 */
export interface SilentEvidenceOutcome {
  /** 是否真的写入了证据（false = 同小时去重命中）。 */
  written: boolean;
  /** 同小时同 kp 是否已有证据（dedup_check.result.hit）。 */
  dedupHit: boolean;
  before: number | null;
  after: number | null;
  eventId: string | null;
  /** 去重查询的真实耗时（dedup_check.ms）。 */
  dedupMs: number;
  /** 三表写入的真实耗时（apply_evidence.ms）；未写入时为 0。 */
  writeMs: number;
}

/** 弱负证据（D13）：applyWeakNegative + 1 小时去重 + 全字段留痕。 */
async function applySilentEvidence(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  kpId: string,
  raw: Record<string, unknown>,
): Promise<SilentEvidenceOutcome> {
  const nowMs = ctx.now();
  const dedupKey = buildDedupKey({
    userId,
    spaceId,
    kp: kpId,
    source: 'silent',
    unixTs: Math.floor(nowMs / 1000),
  });

  // 先查后写（silent 事件 item_id = null，键单独生效）
  const dedupStart = realNow();
  const existing = await ctx.store.findEventsByDedupKey(spaceId, dedupKey);
  const dedupMs = msSince(dedupStart);
  if (existing.length > 0) {
    return { written: false, dedupHit: true, before: null, after: null, eventId: null, dedupMs, writeMs: 0 };
  }

  const writeStart = realNow();
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

  return { written: true, dedupHit: false, before, after, eventId, dedupMs, writeMs: msSince(writeStart) };
}

interface ExitOutcome {
  upstream: KnowledgeNode | null;
  jumped: boolean;
  /** 跳转计数（含本次；exit_channel.result.exit_count 的真实值）。 */
  exitCount: number;
  /** 跳转上限（MAX_EXIT_HOPS 的真实值）。 */
  hopLimit: number;
}

/** 退出通道（ALGORITHM §5）：标记 blocked_by_prerequisite + 最近低掌握上游跳转。 */
async function applyExitChannel(
  ctx: AppContext,
  userId: string,
  spaceId: string,
  dialog: DialogRecord,
  currentKpId: string | null,
): Promise<ExitOutcome> {
  const hopLimit = ctx.params.MAX_EXIT_HOPS;
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

  if (!currentKpId) return { upstream: null, jumped: false, exitCount: dialog.exit_count, hopLimit };

  const state = await loadSelectionState(ctx, userId, spaceId, 'diagnose');
  // ALGORITHM §5 未限定回溯深度 → 放开到全图上界，仅用于找「最近」的低掌握上游
  // 上界取该空间学段的节点数（多学段并存后，另一个学段的节点与本图无关）
  const wide = { ...ctx.params, MAX_DEPTH: ctx.data.nodesForKb(await kbOfSpace(ctx, spaceId)).length };
  const search = searchUpstream(ctx.data.nodeById, state.mastery, currentKpId, wide);

  const lowOnes = search.suspects
    .filter((entry) => (state.mastery[entry.kp_id] ?? 0) < ctx.params.EXIT_UPSTREAM_THRESHOLD)
    .sort((a, b) => a.dist - b.dist || (a.kp_id < b.kp_id ? -1 : a.kp_id > b.kp_id ? 1 : 0));

  const target = lowOnes[0];
  if (!target) return { upstream: null, jumped: false, exitCount: dialog.exit_count, hopLimit };

  const upstream = ctx.data.nodeById.get(target.kp_id) ?? null;

  // 连续跳转上限（防一路滑到底）
  if (dialog.exit_count >= hopLimit) {
    return { upstream, jumped: false, exitCount: dialog.exit_count, hopLimit };
  }

  dialog.exit_count += 1;
  dialog.kp_id = target.kp_id;
  return { upstream, jumped: true, exitCount: dialog.exit_count, hopLimit };
}

// ---------------------------------------------------------------- thought 摘要（确定性拼接）

/** kp_match 后的摘要（契约 §9 3.4 模板一）。 */
function matchThought(input: {
  kpId: string;
  kpName: string | null;
  confidence: number;
  threshold: number;
  adopted: boolean;
  fallbackKpId: string | null;
}): string {
  const name = input.kpName ?? '未命中图谱的知识点';
  const id = input.kpId.length > 0 ? input.kpId : '无';
  const relation = input.confidence >= input.threshold ? '≥' : '<';
  const action = input.adopted
    ? '采纳为本轮知识点'
    : input.fallbackKpId
      ? `沿用上轮知识点（${input.fallbackKpId}）`
      : '本轮不产生证据，先追问澄清';
  return `学生这句话匹配到知识点「${name}」（${id}），置信度 ${fmt(input.confidence)} ${relation} 采纳阈值 ${fmt(input.threshold)}，${action}`;
}

/** 证据步骤后的摘要（契约 §9 3.4 模板二，含真实 before → after）。 */
function evidenceThought(outcome: SilentEvidenceOutcome, kpName: string | null): string {
  if (outcome.dedupHit) return `同小时已有证据，跳过写入（${kpName ?? '当前知识点'}）`;
  return `写入弱负证据：掌握度 ${fmt(outcome.before ?? 0)} → ${fmt(outcome.after ?? 0)}`;
}

/** 状态机后的摘要（契约 §9 3.4 模板三，含真实 consecutive_false 与阈值）。 */
function stateMachineThought(input: {
  progress: boolean;
  consecutiveFalse: number;
  nextAction: ChatNextAction;
  exitThreshold: number;
}): string {
  if (input.progress) return '本轮有有效进展，连续无进展轮次清零（0 轮）';
  const ladder =
    input.nextAction === 'exit_channel'
      ? `，达到 ${input.exitThreshold} 轮，进入退出通道`
      : input.nextAction === 'hint_down'
        ? '，降至提示阶梯第 2 档'
        : '';
  return `本轮无有效进展，连续无进展 ${input.consecutiveFalse} 轮${ladder}`;
}

/** 退出通道后的摘要（契约 §9 3.4 模板四，含真实上游与上限）。 */
function exitThought(outcome: ExitOutcome): string {
  if (!outcome.upstream) return '回溯先修：上游没有低于阈值的知识点，本轮只提示不跳转';
  const name = outcome.upstream.name;
  return outcome.jumped
    ? `回溯先修：最近低掌握上游为「${name}」，执行跳转`
    : `回溯先修：最近低掌握上游为「${name}」，已达跳转上限 ${outcome.hopLimit}，只提示不跳转`;
}

/** generate 阶段摘要（仅 hint_down / exit_channel 有附加段时产出；段数为真实值）。 */
function generateThought(nextAction: ChatNextAction, segmentCount: number): string {
  if (nextAction === 'exit_channel') {
    return `进入退出通道，本轮回复在引导语之后追加完整解法与退出话术（共 ${segmentCount} 段）`;
  }
  return `本轮无有效进展，回复在引导语之后追加方向提示（共 ${segmentCount} 段）`;
}

// ---------------------------------------------------------------- 一轮对话

/**
 * 一轮对话的核心逻辑（SSE 与 JSON 降级共用）。
 * 过程事件按**真实执行顺序**经 emit 产出（D4：未发生的步骤零事件、args/result 全真实）。
 */
export async function runChat(
  prepared: PreparedChat,
  ctx: AppContext,
  emit: ChatEmit,
): Promise<ChatResult> {
  const { userId, spaceId, kb, nodes, message, imageFileId, dialog } = prepared;

  // ---- analyze：加载知识图谱（真实动作 = prepareChat 内的 nodesForKb）
  emit.event(phaseEvent('analyze'));
  emit.event(
    toolEvent({
      id: emit.toolId(),
      name: 'load_graph',
      status: 'ok',
      args: { kb, node_count: nodes.length },
      ms: prepared.graphMs,
    }),
  );

  // ---- retrieve：调用模型 + kp 匹配
  emit.event(phaseEvent('retrieve'));
  const modelMode = process.env.ZHIWEI_MODEL_MODE === 'remote' ? 'remote' : 'local';
  const isRemote = modelMode === 'remote';
  const modelId = emit.toolId();
  // 远程模式是唯一出现 status:'running' → 终态两段式的地方（真发起模型流）；
  // 本地模式计算毫秒级完成，不演耗时，只发终态一次（D4c / 计划 E2）
  if (isRemote) {
    emit.event(toolEvent({ id: modelId, name: 'model_call', status: 'running', args: { mode: modelMode } }));
  }

  // 远程模型流的 thought / reply 增量即到即发：thought → thought 事件；
  // reply → delta 事件（先于 meta 到达，真流式，契约 §9 v1.3 D12）。
  let liveReply = '';
  let liveReplySent = false;
  const modelStart = realNow();
  let turn: ChatTurnOutput;
  try {
    turn = await createModels().chatTurn({
      message,
      image_file_id: imageFileId,
      nodes,
      history: dialog.messages,
      onIncrement: (chunk) => {
        if (chunk.field === 'thought') {
          emit.event(thoughtEvent(chunk.text));
          return;
        }
        liveReply += chunk.text;
        liveReplySent = true;
        emit.event(deltaEvent(chunk.text));
      },
    });
  } catch (error) {
    // 半截即断（D3d）：已发出的增量保留在前端，这里只报工具终态为 error 后让异常冒泡
    emit.event(
      toolEvent({
        id: modelId,
        name: 'model_call',
        status: 'error',
        args: { mode: modelMode },
        ms: msSince(modelStart),
      }),
    );
    throw error;
  }
  emit.event(
    toolEvent({
      id: modelId,
      name: 'model_call',
      status: 'ok',
      args: { mode: modelMode },
      result: {
        kp_id: turn.kp_match.kp_id,
        confidence: turn.kp_match.confidence,
        progress: turn.progress,
      },
      ms: msSince(modelStart),
    }),
  );

  // 远程模式下 thought 通道 = 模型流式自述增量原样转发（D3b/契约 3.4）：
  // 本地那套「确定性推理摘要」不再混进同一通道（两种语义不混，真实中间量仍在 tool.args/result 里）
  const emitThought = (text: string): void => {
    if (!isRemote) emit.event(thoughtEvent(text));
  };

  // kp 匹配：≥ CONF_ADOPT 且命中图谱才认；否则沿用上轮已匹配 kp（追问澄清，不产生证据）
  const matchStart = realNow();
  const matched =
    turn.kp_match.confidence >= ctx.params.CONF_ADOPT &&
    ctx.data.nodeById.has(turn.kp_match.kp_id)
      ? turn.kp_match.kp_id
      : null;
  const effectiveKp = matched ?? dialog.kp_id;
  const effectiveNode = effectiveKp ? (ctx.data.nodeById.get(effectiveKp) ?? null) : null;
  const matchedNode = ctx.data.nodeById.get(turn.kp_match.kp_id) ?? null;
  const kpMatchResult: Record<string, unknown> = {
    kp_id: turn.kp_match.kp_id,
    confidence: turn.kp_match.confidence,
    threshold: ctx.params.CONF_ADOPT,
    adopted: matched !== null,
  };
  if (matched === null && dialog.kp_id) kpMatchResult.fallback_kp_id = dialog.kp_id;
  emit.event(
    toolEvent({
      id: emit.toolId(),
      name: 'kp_match',
      status: 'ok',
      args: { message_excerpt: message.slice(0, MESSAGE_EXCERPT_MAX) },
      result: kpMatchResult,
      ms: msSince(matchStart),
    }),
  );
  emitThought(
    matchThought({
      kpId: turn.kp_match.kp_id,
      kpName: matchedNode?.name ?? null,
      confidence: turn.kp_match.confidence,
      threshold: ctx.params.CONF_ADOPT,
      adopted: matched !== null,
      fallbackKpId: dialog.kp_id,
    }),
  );

  // ---- judge：弱负证据（去重 → 写入）→ 状态机 → 退出通道
  emit.event(phaseEvent('judge'));

  if (matched) {
    dialog.kp_id = matched;
    const outcome = await applySilentEvidence(ctx, userId, spaceId, matched, {
      message,
      image_file_id: imageFileId,
    });
    emit.event(
      toolEvent({
        id: emit.toolId(),
        name: 'dedup_check',
        status: 'ok',
        args: { kp_id: matched },
        result: { hit: outcome.dedupHit },
        ms: outcome.dedupMs,
      }),
    );
    if (outcome.written) {
      emit.event(
        toolEvent({
          id: emit.toolId(),
          name: 'apply_evidence',
          status: 'ok',
          args: { kp_id: matched },
          result: { before: outcome.before, after: outcome.after, event_id: outcome.eventId },
          ms: outcome.writeMs,
        }),
      );
    }
    emitThought(evidenceThought(outcome, matchedNode?.name ?? effectiveNode?.name ?? null));
  }

  // ---- 状态机（ALGORITHM §5）
  const stateStart = realNow();
  const consecutiveFalse = turn.progress ? 0 : dialog.consecutive_false + 1;
  dialog.consecutive_false = consecutiveFalse;

  let nextAction: ChatNextAction = 'continue';
  if (!turn.progress && consecutiveFalse >= ctx.params.CONSEC_FALSE_EXIT) {
    nextAction = 'exit_channel';
  } else if (!turn.progress && consecutiveFalse === 2) {
    nextAction = 'hint_down';
  }
  emit.event(
    toolEvent({
      id: emit.toolId(),
      name: 'state_machine',
      status: 'ok',
      args: { progress: turn.progress },
      result: {
        consecutive_false: consecutiveFalse,
        next_action: nextAction,
        exit_threshold: ctx.params.CONSEC_FALSE_EXIT,
      },
      ms: msSince(stateStart),
    }),
  );
  emitThought(
    stateMachineThought({
      progress: turn.progress,
      consecutiveFalse,
      nextAction,
      exitThreshold: ctx.params.CONSEC_FALSE_EXIT,
    }),
  );

  let exitOutcome: ExitOutcome | null = null;
  if (nextAction === 'exit_channel') {
    const exitStart = realNow();
    exitOutcome = await applyExitChannel(ctx, userId, spaceId, dialog, effectiveKp);
    dialog.status = 'exited';
    const exitResult: Record<string, unknown> = {
      jumped: exitOutcome.jumped,
      exit_count: exitOutcome.exitCount,
      hop_limit: exitOutcome.hopLimit,
    };
    if (exitOutcome.upstream) {
      exitResult.upstream_kp_id = exitOutcome.upstream.id;
      exitResult.upstream_name = exitOutcome.upstream.name;
    }
    emit.event(
      toolEvent({
        id: emit.toolId(),
        name: 'exit_channel',
        status: 'ok',
        args: { current_kp_id: effectiveKp },
        result: exitResult,
        ms: msSince(exitStart),
      }),
    );
    emitThought(exitThought(exitOutcome));
  }

  // ---- generate：delta 分段（拼接即 reply）
  emit.event(phaseEvent('generate'));
  // 远程模式首段可能已随模型流逐段发出（liveReplySent）→ 用它作为首段原样文本，
  // 保证「SSE 各 delta 拼接 === reply === 落库 agent.content」这一不变式恒成立。
  const segments: string[] = [liveReplySent ? liveReply : turn.reply];
  if (nextAction === 'hint_down') {
    segments.push(`\n\n${hintText(effectiveNode)}`);
  } else if (nextAction === 'exit_channel' && exitOutcome) {
    const state = await loadSelectionState(ctx, userId, spaceId, 'diagnose');
    segments.push(`\n\n${solutionText(effectiveNode, ctx.data.items, state.usedItemIds)}`);
    segments.push(
      `\n\n${exitOutcome.jumped ? exitText(exitOutcome.upstream) : exitLimitText(effectiveNode)}`,
    );
  }
  if (segments.length > 1) {
    emitThought(generateThought(nextAction, segments.length));
  }
  for (const [index, segment] of segments.entries()) {
    // 首段已随模型流发出时不再重发（避免前端拼接出重复文本）
    if (index === 0 && liveReplySent) continue;
    emit.event(deltaEvent(segment));
  }
  const reply = segments.join('');

  // ---- kp_match：存在低掌握上游且发生跳转时切到上游（四、4.3 / 计划 #18）
  const kpMatch =
    exitOutcome?.jumped && exitOutcome.upstream
      ? { kp_id: exitOutcome.upstream.id, confidence: turn.kp_match.confidence }
      : effectiveKp
        ? { kp_id: effectiveKp, confidence: turn.kp_match.confidence }
        : { kp_id: turn.kp_match.kp_id, confidence: turn.kp_match.confidence };

  const timestamp = nowIso(ctx.now());
  const studentMessage: DialogMessage = {
    role: 'student',
    content: message,
    image_file_id: imageFileId,
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

/**
 * SSE 桥（D9b）：runChat 的 emit 同步入队，生成器逐个 yield
 * （远程模式下模型流的增量即到即发，真流式）。runChat 完成后补发 meta → done。
 *
 * runChat 抛错（半截失败等）→ 已入队的事件先出尽，随后让异常冒泡：
 * server.ts 既有 catch 输出 error + done（现状语义，前端保留已到文本）。
 */
async function* sseStream(prepared: PreparedChat, ctx: AppContext): AsyncGenerator<SseEvent> {
  const queue: SseEvent[] = [];
  let wake: (() => void) | null = null;
  let settled = false;
  let failed = false;
  let failure: unknown = null;
  let produced: ChatResult | null = null;

  const wakeUp = (): void => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const emit: ChatEmit = {
    toolId: createToolIdSeq(),
    event(event) {
      queue.push(event);
      wakeUp();
    },
  };

  /** 取值经函数返回：闭包内的赋值对控制流分析不可见，直接读会被窄化成初始的 null。 */
  const takeProduced = (): ChatResult | null => produced;

  void runChat(prepared, ctx, emit).then(
    (value) => {
      produced = value;
      settled = true;
      wakeUp();
    },
    (error: unknown) => {
      failed = true;
      failure = error;
      settled = true;
      wakeUp();
    },
  );

  for (;;) {
    while (queue.length > 0) yield queue.shift() as SseEvent;
    if (settled) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  // 半截失败等：已入队事件先出尽，随后让异常冒泡（server.ts 既有 catch → error + done）
  if (failed) throw failure;
  const finished = takeProduced();
  if (!finished) throw new Error('对话链路未返回结果');
  yield { event: 'meta', data: finished.meta };
  yield { event: 'done', data: {} };
}

/** 请求是否要求普通 JSON（D11 降级路径）。 */
export function wantsJson(headers: RouteRequest['headers']): boolean {
  const accept = headerValue(headers, 'accept') ?? '';
  if (accept.toLowerCase().includes('application/json')) return true;
  return (headerValue(headers, 'x-response-format') ?? '').toLowerCase() === 'json';
}

/**
 * POST /api/agent/chat：SSE 或 JSON 降级。
 *
 * prepareChat 先于流开始完成（401/403/400/404 保持普通 JSON 错误体），
 * 之后才决定走事件流还是 JSON（含 trace）。
 */
export async function chat(req: RouteRequest, ctx: AppContext): Promise<HandlerResult> {
  const prepared = await prepareChat(req, ctx);

  if (wantsJson(req.headers)) {
    const recorder = createTraceRecorder();
    const result = await runChat(prepared, ctx, recorder);
    return ok({ reply: result.reply, meta: result.meta, trace: recorder.steps() });
  }
  return sseStream(prepared, ctx);
}

/** JSON 降级响应的 data 形态（契约 §9 v1.3：reply + meta + trace）。 */
export interface ChatJsonData {
  reply: string;
  meta: ChatMeta;
  /** 当轮执行序（phase/tool/thought），前端重放为对应回调。 */
  trace: ChatTraceStep[];
}

export type ChatJsonResponse = ApiResponse<ChatJsonData>;
