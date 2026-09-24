/**
 * 对话链路 trace 契约模块（v1.3，契约 §9「v1.3 变更」块）
 *
 * 本模块是**事件契约的唯一类型来源**：SSE 的 phase / thought / tool 三类过程事件、
 * JSON 降级的 trace 字段（顺序即执行顺序）、以及工具名闭集与中文标签表。
 *
 * 纪律（AGENT §6 + 计划 D4）：
 *   - tool.args / tool.result 只装**真实中间量**（真实 kp_id、真实置信度、真实
 *     before/after 掌握度、真实去重命中与否、真实 consecutive_false / exit_count）。
 *     不允许出现任何「演」的步骤；未发生的动作零事件。
 *   - tool.ms 是真实执行耗时（本地通常 <5ms，后端不人为 delay、不伪造 ms；D4c）。
 *   - thought 在本地模式 = 由真实中间量拼成的**确定性推理摘要**；远程模式 =
 *     模型流式输出的 thought 字段增量原样转发。
 *   - trace 只含 phase / tool / thought —— reply 全文走 delta 通道，不进 trace。
 *
 * 兼容性（契约 §9 v1.3）：delta / meta / done / error 四类语义一字未改，
 * 旧客户端遇到新事件走 sse.ts 的 default 分支直接忽略。
 */

/** 阶段名（契约 §9 v1.3）：analyze → retrieve → judge → generate。 */
export type ChatPhaseName = 'analyze' | 'retrieve' | 'judge' | 'generate';

/** 工具名闭集（7 项，本地与远程共用；新增动作必须先改契约 §9）。 */
export type ChatToolName =
  | 'load_graph'
  | 'model_call'
  | 'kp_match'
  | 'dedup_check'
  | 'apply_evidence'
  | 'state_machine'
  | 'exit_channel';

/** 工具步骤状态：running（仅远程 model_call 真流场景）→ 终态 ok | error。 */
export type ChatToolStatus = 'running' | 'ok' | 'error';

/** 一步工具调用（tool 事件的 data 形态，契约 §9）。 */
export interface ChatToolStep {
  /** 步骤 id：step_1、step_2…；同一动作的 running → 终态共用同一 id（前端按 id upsert）。 */
  id: string;
  name: ChatToolName;
  /** 中文可读名：由 toolEvent() 从 TOOL_LABEL 填充，禁止手写以避免与契约漂移。 */
  label: string;
  status: ChatToolStatus;
  /** 真实入参中间量（白名单字段，绝不含题库 answer / solution_steps）。 */
  args?: Record<string, unknown>;
  /** 真实产出中间量。 */
  result?: Record<string, unknown>;
  /** 真实执行耗时（毫秒，带两位小数；不伪造——D4c）。 */
  ms?: number;
}

/** JSON 降级（契约 §9 v1.3）的 trace 步骤：顺序即执行顺序，前端按序重放为对应回调。 */
export type ChatTraceStep =
  | { type: 'phase'; name: ChatPhaseName; label: string }
  | ({ type: 'tool' } & ChatToolStep)
  | { type: 'thought'; text: string };

/** 阶段中文名（与契约 §9 v1.3 逐字一致）。 */
export const PHASE_LABEL: Record<ChatPhaseName, string> = {
  analyze: '分析',
  retrieve: '检索',
  judge: '判定',
  generate: '生成',
};

/** 工具中文名（与契约 §9 v1.3「ToolName 与真实动作对照表」逐字一致）。 */
export const TOOL_LABEL: Record<ChatToolName, string> = {
  load_graph: '加载知识图谱',
  model_call: '调用对话模型',
  kp_match: '知识点匹配与采纳',
  dedup_check: '弱负证据去重检查',
  apply_evidence: '写入证据与掌握度',
  state_machine: '状态机判定',
  exit_channel: '退出通道·上游回溯',
};

export interface ChatPhaseEventData {
  name: ChatPhaseName;
  label: string;
}

export interface ChatThoughtEventData {
  text: string;
}

export type ChatToolEventData = ChatToolStep;

/** 过程事件（phase / thought / tool）——SSE 新增三类事件，也是 trace 的三类来源。 */
export type ChatProcessEvent =
  | { event: 'phase'; data: ChatPhaseEventData }
  | { event: 'thought'; data: ChatThoughtEventData }
  | { event: 'tool'; data: ChatToolEventData };

/**
 * 流内事件（过程事件 + 回复增量）。
 * delta 不进 trace：reply 全文由 runChat 返回值给出，trace 按契约 §9 3.3 只含三类过程步骤。
 */
export type ChatStreamEvent = ChatProcessEvent | { event: 'delta'; data: { text: string } };

/** 构造 phase 事件（label 由 PHASE_LABEL 填充）。 */
export function phaseEvent(name: ChatPhaseName): { event: 'phase'; data: ChatPhaseEventData } {
  return { event: 'phase', data: { name, label: PHASE_LABEL[name] } };
}

/** 构造 thought 事件。 */
export function thoughtEvent(text: string): { event: 'thought'; data: ChatThoughtEventData } {
  return { event: 'thought', data: { text } };
}

/** 构造 tool 事件（label 由 TOOL_LABEL 填充）。 */
export function toolEvent(input: {
  id: string;
  name: ChatToolName;
  status: ChatToolStatus;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  ms?: number;
}): { event: 'tool'; data: ChatToolEventData } {
  const data: ChatToolStep = { ...input, label: TOOL_LABEL[input.name] };
  return { event: 'tool', data };
}

/** 构造 delta 事件（回复增量）。 */
export function deltaEvent(text: string): { event: 'delta'; data: { text: string } } {
  return { event: 'delta', data: { text } };
}

/** 工具步骤 id 自增器：step_1、step_2…（SSE 与 JSON 两条路径共用同一来源，保证同形）。 */
export function createToolIdSeq(): () => string {
  let seq = 0;
  return () => {
    seq += 1;
    return `step_${seq}`;
  };
}

/**
 * 事件出口：SSE 路径把事件推入队列，JSON 路径由 TraceRecorder 收集为 trace 数组。
 * runChat 只依赖本接口，两条路径共用同一份执行序（D9b/D9c）。
 */
export interface ChatEmit {
  event(ev: ChatStreamEvent): void;
  /** 取下一个工具步骤 id（同一动作的 running 与终态必须复用同一个 id）。 */
  toolId(): string;
}

export interface TraceRecorder extends ChatEmit {
  /** 已收集的 trace 步骤（顺序即执行顺序）。 */
  steps(): ChatTraceStep[];
}

/** 双模式收集器：JSON 降级路径（与测试）用。delta 不进 trace，直接忽略。 */
export function createTraceRecorder(toolId: () => string = createToolIdSeq()): TraceRecorder {
  const collected: ChatTraceStep[] = [];
  return {
    toolId,
    event(ev: ChatStreamEvent) {
      if (ev.event === 'phase') {
        collected.push({ type: 'phase', name: ev.data.name, label: ev.data.label });
        return;
      }
      if (ev.event === 'thought') {
        collected.push({ type: 'thought', text: ev.data.text });
        return;
      }
      if (ev.event === 'tool') {
        collected.push({ type: 'tool', ...ev.data });
      }
      // delta：不落 trace（reply 由 runChat 返回，契约 §9 3.3 只含 phase/tool/thought）
    },
    steps: () => collected,
  };
}
