/**
 * SSE 流客户端（D5，契约 §9 POST /api/agent/chat）
 *
 * 为什么不用 EventSource：规范不支持 POST 与自定义请求头（需要 Authorization + JSON body）。
 * 故用 fetch + response.body.getReader() + TextDecoder 增量解析，并拆出**纯函数**
 * parseSseBuffer（跨 chunk 断行 / 一次多事件 / 不完整尾块缓冲；可单测）。
 *
 * 降级链（契约 §9「禁止白屏」）：
 *   ① Content-Type 非 text/event-stream（服务端按 Accept 降级，或代理改写）
 *      → 直接按 {reply, meta} 整段渲染 + onFallback 提示；
 *   ② 流读取中途异常 → 用 Accept: application/json **重发一次**原请求 → 同上；
 *   ③ 重发也失败 → onError（页面出错误气泡，不白屏）。
 */

import { UI_TEXT } from '../lib/phrases';
import { useAuthStore } from '../stores/auth';
import { ApiError, ERROR_CODE, handleUnauthorized, readEnvelope } from './client';
import type { ApiEnvelope, ChatJsonData, ChatMeta, ChatRequest } from './types';

export interface SseMessage {
  /** 事件名（缺省为 'message'，契约 §9 只发 delta / meta / done / error）。 */
  event: string;
  /** data 行原文（多行 data 以 \n 连接）。 */
  data: string;
}

const DATA_NEWLINE = '\n';

/**
 * 解析 SSE 缓冲区（纯函数）：
 *   - 事件块以空行分隔（兼容 \r\n）；块内 `event:` / `data:` / `:` 注释；
 *   - 末尾未以空行闭合的残块 → 留在 rest，等下一个 chunk 拼接（跨 chunk 断行）；
 *   - 多行 data 按规范以 \n 连接；无 event 字段 → 'message'。
 */
export function parseSseBuffer(buffer: string): { messages: SseMessage[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split('\n\n');
  const rest = blocks.pop() ?? '';
  const messages: SseMessage[] = [];

  for (const block of blocks) {
    const message = parseSseBlock(block);
    if (message) messages.push(message);
  }
  return { messages, rest };
}

function parseSseBlock(block: string): SseMessage | null {
  let event: string | null = null;
  const dataLines: string[] = [];
  let sawField = false;

  for (const rawLine of block.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.length === 0) continue;
    if (line.startsWith(':')) continue; // 注释行（含 keep-alive heartbeat）

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') {
      event = value;
      sawField = true;
    } else if (field === 'data') {
      dataLines.push(value);
      sawField = true;
    } else if (field === 'id' || field === 'retry') {
      sawField = true;
    }
  }

  if (!sawField) return null;
  return { event: event ?? 'message', data: dataLines.join(DATA_NEWLINE) };
}

function tryParseJson(raw: string): unknown {
  const text = raw.trim();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface ChatStreamHandlers {
  /** 增量文本（delta 事件；降级路径一次性给出全文）。 */
  onDelta: (text: string) => void;
  onMeta: (meta: ChatMeta) => void;
  onDone: () => void;
  /** 失败：msg 已是用户可读话术（页面出错误气泡，不白屏）。 */
  onError: (msg: string) => void;
  /** 走了 JSON 降级路径（页面 toast UI_TEXT.sseFallback）。 */
  onFallback?: (msg: string) => void;
}

export interface StreamChatDeps {
  /** 测试注入用；默认全局 fetch。 */
  fetchImpl?: typeof fetch;
}

/** 单条 SSE 事件 → 回调（纯函数，可单测；data 非 JSON 时按原文当增量文本容错）。 */
export function dispatchSseMessage(message: SseMessage, handlers: ChatStreamHandlers): void {
  const payload = tryParseJson(message.data);

  switch (message.event) {
    case 'delta': {
      const text =
        typeof payload === 'object' && payload !== null && typeof (payload as { text?: unknown }).text === 'string'
          ? (payload as { text: string }).text
          : message.data; // 非 JSON data 容错：原样当增量文本，不丢字
      handlers.onDelta(text);
      return;
    }
    case 'meta': {
      if (typeof payload === 'object' && payload !== null) handlers.onMeta(payload as ChatMeta);
      return;
    }
    case 'done':
      handlers.onDone();
      return;
    case 'error': {
      const msg =
        typeof payload === 'object' && payload !== null && typeof (payload as { msg?: unknown }).msg === 'string'
          ? (payload as { msg: string }).msg
          : '对话服务暂时不可用，稍后再试一次';
      handlers.onError(msg);
      return;
    }
    default:
      return; // 未知事件忽略（向前兼容）
  }
}

function authHeaders(accept: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: accept };
  const token = useAuthStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** 按 JSON 响应整段渲染（降级路径）；失败走 onError。 */
async function renderJson(response: Response, handlers: ChatStreamHandlers, toast: boolean): Promise<void> {
  let envelope: ApiEnvelope<unknown>;
  try {
    envelope = await readEnvelope(response);
  } catch (error) {
    handlers.onError(error instanceof ApiError ? error.message : UI_TEXT.networkError);
    return;
  }

  if (envelope.code === ERROR_CODE.UNAUTHORIZED) {
    handleUnauthorized();
    handlers.onError(envelope.msg || '登录状态已过期，请重新登录');
    return;
  }
  if (envelope.code !== ERROR_CODE.OK || envelope.data === null) {
    handlers.onError(envelope.msg || UI_TEXT.networkError);
    return;
  }

  const data = envelope.data as ChatJsonData;
  if (toast) handlers.onFallback?.(UI_TEXT.sseFallback);
  if (typeof data.reply === 'string') handlers.onDelta(data.reply);
  if (data.meta) handlers.onMeta(data.meta);
  handlers.onDone();
}

/**
 * 发起一轮流式对话：delta 增量 → meta → done；异常按降级链处理（见文件头）。
 */
export async function streamChat(
  body: ChatRequest,
  handlers: ChatStreamHandlers,
  deps: StreamChatDeps = {},
): Promise<void> {
  const doFetch = deps.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) {
    handlers.onError(UI_TEXT.networkError);
    return;
  }

  const post = (accept: string): Promise<Response> =>
    doFetch('/api/agent/chat', {
      method: 'POST',
      headers: authHeaders(accept),
      body: JSON.stringify(body),
    });

  let response: Response;
  try {
    response = await post('text/event-stream');
  } catch {
    handlers.onError(UI_TEXT.networkError);
    return;
  }

  if (response.status === ERROR_CODE.UNAUTHORIZED) {
    handleUnauthorized();
    handlers.onError('登录状态已过期，请重新登录');
    return;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    // 服务端按 Accept 或自身策略返回普通 JSON：整段渲染 + 降级提示
    await renderJson(response, handlers, true);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  const consume = (text: string): void => {
    buffer += text;
    const { messages, rest } = parseSseBuffer(buffer);
    buffer = rest;
    for (const message of messages) {
      if (message.event === 'done') sawDone = true;
      dispatchSseMessage(message, handlers);
    }
  };

  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('响应没有可读流');

    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      consume(decoder.decode(chunk.value, { stream: true }));
    }
    consume(decoder.decode());
    if (buffer.trim().length > 0) consume('\n\n'); // 收尾未闭合残块
    if (!sawDone) handlers.onDone();
  } catch {
    // 流中断：JSON 降级重发一次（契约 §9 禁白屏）
    let fallback: Response;
    try {
      fallback = await post('application/json');
    } catch {
      handlers.onError(UI_TEXT.networkError);
      return;
    }
    await renderJson(fallback, handlers, true);
  }
}
