// @vitest-environment jsdom
/**
 * SSE 解析器与流式客户端测试（D5，契约 §9）
 *
 * 解析器：跨 chunk 断行 / 一次多事件 / 残尾缓冲 / event 缺省 / 多行 data / \r\n / 注释行 / 非 JSON data。
 * 客户端：正常流（delta → meta → done）/ 服务端 JSON 降级 / 流中断再降级一次 / 重发也失败不白屏 / 401。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchSseMessage, parseSseBuffer, streamChat } from '../src/api/sse';
import type { ChatStreamHandlers } from '../src/api/sse';
import type { ChatMeta } from '../src/api/types';
import { UI_TEXT } from '../src/lib/phrases';
import { useAuthStore } from '../src/stores/auth';

const encoder = new TextEncoder();

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}

/** 先吐出 chunks，随后下一次读取抛错（模拟流中转断：已到达的增量保留，之后走降级）。 */
function brokenSseResponse(chunks: string[]): Response {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
        return;
      }
      controller.error(new Error('connection reset'));
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function jsonChatResponse(reply: string, meta: ChatMeta, trace?: unknown[]): Response {
  return new Response(
    JSON.stringify({ code: 0, msg: 'success', data: { reply, meta, ...(trace ? { trace } : {}) } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function makeHandlers() {
  const events: string[] = [];
  const deltas: string[] = [];
  const metas: ChatMeta[] = [];
  const errors: string[] = [];
  const fallbacks: string[] = [];
  const phases: { name: string; label: string }[] = [];
  const thoughts: string[] = [];
  const tools: { id: string; name: string; status: string }[] = [];
  const handlers: ChatStreamHandlers = {
    onDelta: (text) => {
      deltas.push(text);
      events.push('delta');
    },
    onMeta: (meta) => {
      metas.push(meta);
      events.push('meta');
    },
    onDone: () => events.push('done'),
    onError: (msg) => {
      errors.push(msg);
      events.push('error');
    },
    onFallback: (msg) => {
      fallbacks.push(msg);
      events.push('fallback');
    },
    onPhase: (phase) => {
      phases.push(phase);
      events.push('phase');
    },
    onThought: (text) => {
      thoughts.push(text);
      events.push('thought');
    },
    onTool: (tool) => {
      tools.push(tool);
      events.push('tool');
    },
  };
  return { handlers, events, deltas, metas, errors, fallbacks, phases, thoughts, tools };
}

const META: ChatMeta = {
  dialog_id: 'dlg_1',
  kp_match: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.85 },
  progress: false,
  progress_reason: '学生仍未能给出有效一步',
  next_action: 'continue',
};

beforeEach(() => {
  useAuthStore.getState().setSession({ user_id: 'u_1', token: 'tok_sse' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.getState().clear();
});

describe('sse · parseSseBuffer（纯函数）', () => {
  it('单事件块：event + data + 空行', () => {
    const { messages, rest } = parseSseBuffer('event: delta\ndata: {"text":"你好"}\n\n');
    expect(messages).toEqual([{ event: 'delta', data: '{"text":"你好"}' }]);
    expect(rest).toBe('');
  });

  it('跨 chunk 断行：首块无空行 → 留在 rest，拼上后续块才成事件', () => {
    const first = parseSseBuffer('event: delta\ndata: {"text":"半');
    expect(first.messages).toEqual([]);
    expect(first.rest).toBe('event: delta\ndata: {"text":"半');

    const second = parseSseBuffer(`${first.rest}句"}\n\n`);
    expect(second.messages).toEqual([{ event: 'delta', data: '{"text":"半句"}' }]);
    expect(second.rest).toBe('');
  });

  it('一次到达多个事件块（顺序保持）', () => {
    const { messages } = parseSseBuffer(
      'event: delta\ndata: {"text":"A"}\n\nevent: delta\ndata: {"text":"B"}\n\nevent: done\ndata: {}\n\n',
    );
    expect(messages.map((message) => message.event)).toEqual(['delta', 'delta', 'done']);
  });

  it('残尾（无结尾空行）留在 rest，不提前派发', () => {
    const { messages, rest } = parseSseBuffer('event: meta\ndata: {"dialog_id":"dlg_1"}\n\nevent: done\ndata: {}');
    expect(messages).toHaveLength(1);
    expect(messages[0].event).toBe('meta');
    expect(rest).toBe('event: done\ndata: {}');
  });

  it('event 缺省为 message；多行 data 以 \\n 连接', () => {
    const { messages } = parseSseBuffer('data: 第一行\ndata: 第二行\n\n');
    expect(messages).toEqual([{ event: 'message', data: '第一行\n第二行' }]);
  });

  it('兼容 \\r\\n 与注释行（keep-alive），空块不产出事件', () => {
    const { messages } = parseSseBuffer(': keep-alive\r\nevent: delta\r\ndata: {"text":"x"}\r\n\r\n\r\n');
    expect(messages).toEqual([{ event: 'delta', data: '{"text":"x"}' }]);
  });
});

describe('sse · dispatchSseMessage（事件路由 + 非 JSON 容错）', () => {
  it('delta / meta / done / error 四型路由正确', () => {
    const a = makeHandlers();
    dispatchSseMessage({ event: 'delta', data: '{"text":"增量"}' }, a.handlers);
    dispatchSseMessage({ event: 'meta', data: JSON.stringify(META) }, a.handlers);
    dispatchSseMessage({ event: 'done', data: '{}' }, a.handlers);
    expect(a.deltas).toEqual(['增量']);
    expect(a.metas[0].dialog_id).toBe('dlg_1');
    expect(a.events).toEqual(['delta', 'meta', 'done']);

    const b = makeHandlers();
    dispatchSseMessage({ event: 'error', data: '{"msg":"对话服务暂时不可用"}' }, b.handlers);
    expect(b.errors).toEqual(['对话服务暂时不可用']);
  });

  it('data 非 JSON → delta 原样当增量文本（不丢字）；未知事件忽略', () => {
    const a = makeHandlers();
    dispatchSseMessage({ event: 'delta', data: '这里是纯文本' }, a.handlers);
    expect(a.deltas).toEqual(['这里是纯文本']);

    dispatchSseMessage({ event: 'unknown', data: '{}' }, a.handlers);
    expect(a.events).toEqual(['delta']);
  });
});

describe('sse · streamChat（正常流 + 降级链）', () => {
  it('正常流：delta 增量 → meta → done，且请求带 Bearer 头与 Accept: text/event-stream', async () => {
    const init: RequestInit[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, options?: RequestInit) => {
      init.push(options ?? {});
      return sseResponse([
        'event: delta\ndata: {"text":"我们先把"}\n\n',
        'event: delta\ndata: {"text":"定义过一遍。"}\n\n',
        `event: meta\ndata: ${JSON.stringify(META)}\n\n`,
        'event: done\ndata: {}\n\n',
      ]);
    });

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: '顶点式我不会' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.deltas).toEqual(['我们先把', '定义过一遍。']);
    expect(captured.events).toEqual(['delta', 'delta', 'meta', 'done']);
    const headers = init[0].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok_sse');
    expect(headers.Accept).toBe('text/event-stream');
  });

  it('服务端返回 JSON（非 event-stream）→ 整段渲染 + 降级提示，不白屏', async () => {
    const fetchImpl = vi.fn(async () => jsonChatResponse('整段回复', META));
    const captured = makeHandlers();

    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.deltas).toEqual(['整段回复']);
    expect(captured.metas[0].dialog_id).toBe('dlg_1');
    expect(captured.fallbacks).toEqual([UI_TEXT.sseFallback]);
    expect(captured.events).toEqual(['fallback', 'delta', 'meta', 'done']);
  });

  it('流中断 → 用 Accept: application/json 重发一次 → 整段渲染 + 降级提示', async () => {
    const accepts: string[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, options?: RequestInit) => {
      const headers = (options?.headers ?? {}) as Record<string, string>;
      accepts.push(headers.Accept);
      if (accepts.length === 1) return brokenSseResponse(['event: delta\ndata: {"text":"半句"}\n\n']);
      return jsonChatResponse('降级后的完整回复', META);
    });

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(accepts).toEqual(['text/event-stream', 'application/json']);
    expect(captured.deltas).toEqual(['半句', '降级后的完整回复']);
    expect(captured.fallbacks).toEqual([UI_TEXT.sseFallback]);
    expect(captured.errors).toEqual([]);
  });

  it('重发也失败 → onError（错误气泡），页面不白屏', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, options?: RequestInit) => {
      const headers = (options?.headers ?? {}) as Record<string, string>;
      if (headers.Accept === 'text/event-stream') return brokenSseResponse([]);
      throw new TypeError('Failed to fetch');
    });

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.errors).toEqual([UI_TEXT.networkError]);
    expect(captured.deltas).toEqual([]);
  });

  it('首次请求即网络异常 → onError；401 → 清会话并提示重新登录', async () => {
    const broken = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, broken.handlers, {
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    expect(broken.errors).toEqual([UI_TEXT.networkError]);

    const unauthorized = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, unauthorized.handlers, {
      fetchImpl: (async () => new Response('{"code":401,"msg":"token 无效","data":null}', { status: 401 })) as unknown as typeof fetch,
    });
    expect(unauthorized.errors[0]).toContain('登录状态已过期');
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe('sse · v1.3 过程事件（phase / thought / tool）', () => {
  const THOUGHT_LINE = 'event: thought\ndata: {"text":"置信度 0.85 ≥ 采纳阈值 0.6"}\n\n';
  const TOOL_RUNNING = 'event: tool\ndata: {"id":"step_2","name":"model_call","label":"调用对话模型","status":"running","args":{"mode":"remote"}}\n\n';
  const TOOL_OK =
    'event: tool\ndata: {"id":"step_2","name":"model_call","label":"调用对话模型","status":"ok","args":{"mode":"remote"},"result":{"kp_id":"math.cz.quadratic.vertex_form","confidence":0.9,"progress":false},"ms":812.3}\n\n';

  it('dispatchSseMessage 三新事件路由：字段与回调一一对应', () => {
    const a = makeHandlers();
    dispatchSseMessage({ event: 'phase', data: '{"name":"judge","label":"判定"}' }, a.handlers);
    dispatchSseMessage({ event: 'thought', data: '{"text":"写入弱负证据：掌握度 0.5 → 0.45"}' }, a.handlers);
    dispatchSseMessage({ event: 'tool', data: JSON.stringify({ id: 'step_1', name: 'load_graph', label: '加载知识图谱', status: 'ok', args: { kb: 'kb_math_cz', node_count: 24 }, ms: 0.12 }) }, a.handlers);

    expect(a.phases).toEqual([{ name: 'judge', label: '判定' }]);
    expect(a.thoughts).toEqual(['写入弱负证据：掌握度 0.5 → 0.45']);
    expect(a.tools).toEqual([{ id: 'step_1', name: 'load_graph', label: '加载知识图谱', status: 'ok', args: { kb: 'kb_math_cz', node_count: 24 }, ms: 0.12 }]);
    expect(a.events).toEqual(['phase', 'thought', 'tool']);
    expect(a.deltas).toEqual([]);
  });

  it('tool 事件缺 id/name 或非 JSON → 忽略（不抛错、不污染回调）', () => {
    const a = makeHandlers();
    dispatchSseMessage({ event: 'tool', data: '{"name":"load_graph"}' }, a.handlers);
    dispatchSseMessage({ event: 'tool', data: '不是 JSON' }, a.handlers);
    dispatchSseMessage({ event: 'phase', data: '不是 JSON' }, a.handlers);
    expect(a.tools).toEqual([]);
    expect(a.phases).toEqual([]);
    expect(a.events).toEqual([]);
  });

  it('thought 事件 data 非 JSON → 原文当思考文本容错', () => {
    const a = makeHandlers();
    dispatchSseMessage({ event: 'thought', data: '纯文本思考' }, a.handlers);
    expect(a.thoughts).toEqual(['纯文本思考']);
  });

  it('streamChat 真流：过程事件与 delta 交错到达，顺序如实透传', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'event: phase\ndata: {"name":"analyze","label":"分析"}\n\n',
        'event: tool\ndata: {"id":"step_1","name":"load_graph","label":"加载知识图谱","status":"ok","args":{"kb":"kb_math_cz","node_count":24},"ms":0.1}\n\n',
        'event: phase\ndata: {"name":"retrieve","label":"检索"}\n\n',
        THOUGHT_LINE,
        'event: delta\ndata: {"text":"我们先把"}\n\n',
        TOOL_RUNNING,
        'event: delta\ndata: {"text":"定义过一遍。"}\n\n',
        TOOL_OK,
        `event: meta\ndata: ${JSON.stringify(META)}\n\n`,
        'event: done\ndata: {}\n\n',
      ]),
    );

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: '顶点式我不会' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.events).toEqual([
      'phase',
      'tool',
      'phase',
      'thought',
      'delta',
      'tool',
      'delta',
      'tool',
      'meta',
      'done',
    ]);
    expect(captured.deltas.join('')).toBe('我们先把定义过一遍。');
    expect(captured.phases.map((phase) => phase.name)).toEqual(['analyze', 'retrieve']);
    // 同 id 两次下发（running → ok）如实到达，由消费侧（dialog store）按 id upsert
    expect(captured.tools.map((tool) => tool.status)).toEqual(['ok', 'running', 'ok']);
    expect(captured.tools[1].id).toBe(captured.tools[2].id);
  });

  it('JSON 降级携 trace → 按 trace 顺序重放过程事件，再整段给出 reply', async () => {
    const trace = [
      { type: 'phase', name: 'analyze', label: '分析' },
      { type: 'tool', id: 'step_1', name: 'load_graph', label: '加载知识图谱', status: 'ok', args: { kb: 'kb_math_cz', node_count: 24 }, ms: 0.1 },
      { type: 'thought', text: '学生这句话匹配到知识点「二次函数的顶点式」' },
      { type: 'phase', name: 'generate', label: '生成' },
    ];
    const fetchImpl = vi.fn(async () => jsonChatResponse('整段回复', META, trace));

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.events).toEqual(['fallback', 'phase', 'tool', 'thought', 'phase', 'delta', 'meta', 'done']);
    expect(captured.deltas).toEqual(['整段回复']);
    expect(captured.phases.map((phase) => phase.name)).toEqual(['analyze', 'generate']);
    expect(captured.thoughts).toEqual(['学生这句话匹配到知识点「二次函数的顶点式」']);
    expect(captured.tools).toHaveLength(1);
    expect(captured.tools[0].name).toBe('load_graph');
  });

  it('旧服务端（无 trace）JSON 降级 → 行为与 v1.2 一致（只 delta/meta/done）', async () => {
    const fetchImpl = vi.fn(async () => jsonChatResponse('旧格式回复', META));

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.events).toEqual(['fallback', 'delta', 'meta', 'done']);
    expect(captured.deltas).toEqual(['旧格式回复']);
    expect(captured.phases).toEqual([]);
    expect(captured.thoughts).toEqual([]);
    expect(captured.tools).toEqual([]);
  });

  it('未知事件（未来新增）仍被忽略，不影响 delta 拼接', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'event: metrics\ndata: {"tokens":12}\n\n',
        'event: delta\ndata: {"text":"甲"}\n\n',
        'event: heartbeat\ndata: {}\n\n',
        'event: delta\ndata: {"text":"乙"}\n\n',
        `event: meta\ndata: ${JSON.stringify(META)}\n\n`,
        'event: done\ndata: {}\n\n',
      ]),
    );

    const captured = makeHandlers();
    await streamChat({ space_id: 'sp_1', message: 'hi' }, captured.handlers, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(captured.events).toEqual(['delta', 'delta', 'meta', 'done']);
    expect(captured.deltas.join('')).toBe('甲乙');
  });
});
