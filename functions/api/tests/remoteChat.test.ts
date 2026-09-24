/**
 * 远程大模型对话适配器测试（models/remoteChat.ts，契约 §9 v1.3 真流式）
 *
 * 覆盖：环境变量配置读取（缺项回落）；extractJsonObject 稳健解析（裸 JSON / 围栏 / 杂文包裹）；
 * parseOpenAiStreamLines 断行安全（跨 chunk 半行、非 data 行、[DONE] 结束）；
 * 字段流增量抽取（thought/reply 按块到达、转义跨 chunk 不错字、字段乱序不失败）；
 * chatTurn 对 mock 流式 fetch 的结构化映射；请求体 stream:true 且无 response_format；
 * 零增量失败回落 localChat；已发 reply 增量后失败抛 RemoteChatAborted（半截即断，不拼接）。
 * 全程 mock fetch，不发真实网络请求。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import {
  RemoteChatAborted,
  chatTurn,
  createFieldStreamExtractor,
  extractJsonObject,
  parseOpenAiStreamLines,
  readRemoteChatConfig,
} from '../src/models/remoteChat';
import type { ChatStreamIncrement } from '../src/models/types';
import { REPO_ROOT } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const encoder = new TextEncoder();

const BASE_INPUT = {
  message: '二次函数顶点式我不知道怎么求',
  image_file_id: null,
  nodes: SD.nodes,
  history: [],
};

function setEnv(map: Record<string, string | undefined>): void {
  const keys = ['ZHIWEI_LLM_BASE_URL', 'ZHIWEI_LLM_API_KEY', 'ZHIWEI_LLM_MODEL', 'ZHIWEI_LLM_TIMEOUT_MS'];
  for (const key of keys) {
    if (map[key] === undefined) delete process.env[key];
    else process.env[key] = map[key];
  }
}

const REMOTE_ENV = {
  ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
  ZHIWEI_LLM_API_KEY: 'sk-test',
  ZHIWEI_LLM_MODEL: 'test-model',
};

/** 一条 OpenAI 流式行：choices[0].delta.content = content。 */
function contentLine(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

const DONE_LINE = 'data: [DONE]\n\n';

/** 原始字节块序列 → 流式 Response。 */
function streamResponse(rawChunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of rawChunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** 先吐给定行，随后下一次读取抛错（模拟流中转断）。 */
function brokenStream(rawChunks: string[]): Response {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < rawChunks.length) {
        controller.enqueue(encoder.encode(rawChunks[index]));
        index += 1;
        return;
      }
      controller.error(new Error('connection reset'));
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** 把模型输出文本按固定步长切成 delta.content 块后编码为完整流式响应。 */
function streamText(text: string, size = 12): Response {
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i += size) pieces.push(text.slice(i, i + size));
  if (pieces.length === 0) pieces.push('');
  return streamResponse([...pieces.map(contentLine), DONE_LINE]);
}

function collectIncrements(): { increments: ChatStreamIncrement[]; onIncrement: (chunk: ChatStreamIncrement) => void } {
  const increments: ChatStreamIncrement[] = [];
  return { increments, onIncrement: (chunk) => increments.push(chunk) };
}

const joinField = (increments: ChatStreamIncrement[], field: 'thought' | 'reply'): string =>
  increments.filter((chunk) => chunk.field === field).map((chunk) => chunk.text).join('');

afterEach(() => {
  setEnv({});
  vi.unstubAllGlobals();
});

describe('readRemoteChatConfig', () => {
  it('任一必填项缺失返回 null', () => {
    setEnv({ ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1', ZHIWEI_LLM_MODEL: 'test-model' });
    expect(readRemoteChatConfig()).toBeNull();
  });

  it('配置齐全时读取并去掉 baseUrl 尾部斜杠', () => {
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1///',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    expect(readRemoteChatConfig()).toEqual({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      model: 'test-model',
      timeoutMs: 45000,
    });
  });
});

describe('extractJsonObject', () => {
  it('解析裸 JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('解析 ```json 围栏内 JSON', () => {
    expect(extractJsonObject('好的，这是结果：\n```json\n{"reply":"嗯"}\n```')).toEqual({ reply: '嗯' });
  });

  it('解析前后杂文包裹的 JSON', () => {
    expect(extractJsonObject('前言 {"a":{"b":2}} 后记')).toEqual({ a: { b: 2 } });
  });

  it('多个 JSON 对象时取第一个完整对象', () => {
    expect(extractJsonObject('说明 {"a":1} 补充 {"b":2}')).toEqual({ a: 1 });
  });

  it('字符串字面量内的花括号不参与配平', () => {
    expect(extractJsonObject('{"reply":"含 } 花括号 { 的文本","progress":true}')).toEqual({
      reply: '含 } 花括号 { 的文本',
      progress: true,
    });
  });

  it('无 JSON 时返回 null', () => {
    expect(extractJsonObject('完全不是 JSON')).toBeNull();
  });
});

describe('parseOpenAiStreamLines（纯函数）', () => {
  it('跨 chunk 半行安全：不完整行留在 rest，拼上后续块才成一条', () => {
    const first = parseOpenAiStreamLines(`${contentLine('甲')}data: {"cho`);
    expect(first.contents).toEqual(['甲']);
    expect(first.rest).toBe('data: {"cho');
    expect(first.done).toBe(false);

    const second = parseOpenAiStreamLines(`${first.rest}ices":[{"delta":{"content":"乙"}}]}\ndata: [DONE`);
    expect(second.contents).toEqual(['乙']);
    expect(second.rest).toBe('data: [DONE');
    expect(second.done).toBe(false);

    const third = parseOpenAiStreamLines(`${second.rest}]\n\n`);
    expect(third.done).toBe(true);
    expect(third.contents).toEqual([]);
  });

  it('忽略非 data 行（空行 / 注释 / event 行）与非 JSON payload，且 [DONE] 后不再解析', () => {
    const parsed = parseOpenAiStreamLines(
      [
        ': keep-alive\n',
        'event: message\n',
        '\n',
        'data: 这不是 JSON\n',
        contentLine('丙'),
        DONE_LINE,
        contentLine('不该被解析'),
      ].join(''),
    );
    expect(parsed.contents).toEqual(['丙']);
    expect(parsed.done).toBe(true);
  });
});

describe('createFieldStreamExtractor（纯状态机）', () => {
  it('thought / reply 增量按到达顺序回调，拼接即字段原文；字段闭合后锁定', () => {
    const { increments, onIncrement } = collectIncrements();
    const raw = '{"thought":"先看顶点式","reply":"我们一步步来"}';
    const extractor = createFieldStreamExtractor(onIncrement);
    for (const char of raw) extractor.push(char);

    expect(joinField(increments, 'thought')).toBe('先看顶点式');
    expect(joinField(increments, 'reply')).toBe('我们一步步来');
    // thought 整体先于 reply 到达（模型守字段序时的自然顺序）
    const firstReply = increments.findIndex((chunk) => chunk.field === 'reply');
    const thoughtCount = increments.filter((chunk) => chunk.field === 'thought').length;
    expect(firstReply).toBe(thoughtCount);
    expect(extractor.finish()).toBe(raw);
    expect(extractor.replyStarted()).toBe(true);

    // 闭合后继续追加不再产出增量（锁定）
    const before = increments.length;
    extractor.push('{"reply":"第二条回复"}');
    expect(increments.length).toBe(before);
  });

  it('字符串值闭合前不发出半截文本；不完整转义暂存（increment 永不以 \\ 结尾）', () => {
    const { increments, onIncrement } = collectIncrements();
    const extractor = createFieldStreamExtractor(onIncrement);

    extractor.push('{"reply":"甲');
    expect(joinField(increments, 'reply')).toBe('甲');

    extractor.push('\\');
    expect(joinField(increments, 'reply')).toBe('甲'); // 半截转义不发

    extractor.push('n乙'); // \n 完整了
    expect(joinField(increments, 'reply')).toBe('甲\n乙');

    extractor.push('\\u4e'); // \uXXXX 未完整
    const snapshot = joinField(increments, 'reply');
    expect(snapshot).toBe('甲\n乙');

    extractor.push('2d丙'); // 中
    expect(joinField(increments, 'reply')).toBe('甲\n乙中丙');
    for (const chunk of increments) {
      expect(chunk.text.endsWith('\\')).toBe(false);
      expect(chunk.text).not.toContain('\\u');
    }
  });

  it('字符串值里出现的同名字样不被误认为键（只看 { / , 之后的键位）', () => {
    const { increments, onIncrement } = collectIncrements();
    const extractor = createFieldStreamExtractor(onIncrement);
    extractor.push('{"thought":"他说 \\"reply\\" 这个词","reply":"真的回复"}');

    expect(joinField(increments, 'reply')).toBe('真的回复');
    expect(joinField(increments, 'thought')).toBe('他说 "reply" 这个词');
  });
});

describe('chatTurn（mock 流式 fetch）', () => {
  const MODEL_JSON = JSON.stringify({
    reply: '我们先把式子配成顶点式试试，你把 x^2-4x 这半边先写出来？',
    progress: false,
    progress_reason: '学生表示不知道怎么求',
    kp_match: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.9 },
    top_candidates: [
      { kp_id: 'math.cz.quadratic.vertex_form', name: '顶点式', confidence: 0.9 },
      { kp_id: 'math.cz.not.exist.kp', name: '伪造节点', confidence: 0.8 },
    ],
  });

  it('结构化映射：流式分块到达、合法字段透传，伪造 kp_id 的候选被丢弃', async () => {
    setEnv(REMOTE_ENV);
    const fetchMock = vi.fn().mockResolvedValue(streamText(MODEL_JSON, 20));
    vi.stubGlobal('fetch', fetchMock);

    const out = await chatTurn(BASE_INPUT);

    expect(out.reply).toContain('顶点式');
    expect(out.progress).toBe(false);
    expect(out.progress_reason).toBe('学生表示不知道怎么求');
    expect(out.kp_match).toEqual({ kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.9 });
    expect(out.next_action).toBeNull();
    // 伪造 kp id 不进候选（不采信模型输出）
    expect(out.top_candidates).toHaveLength(1);
    expect(out.top_candidates[0].kp_id).toBe('math.cz.quadratic.vertex_form');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    expect(body.messages[0].role).toBe('system');
  });

  it('kp_id 不在图谱中 → 按无匹配处理', async () => {
    setEnv(REMOTE_ENV);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamText(JSON.stringify({
      reply: '你先说说卡在哪一步？',
      progress: true,
      progress_reason: null,
      kp_match: { kp_id: 'math.cz.fabricated', confidence: 0.95 },
      top_candidates: [],
    }))));

    const out = await chatTurn(BASE_INPUT);
    expect(out.kp_match).toEqual({ kp_id: '', confidence: 0.3 });
  });

  it('网络失败 → 回落本地脚本适配器', async () => {
    setEnv(REMOTE_ENV);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const out = await chatTurn(BASE_INPUT);
    // localChat 的「不知道」触发词 → progress=false；回复为澄清/引导模板
    expect(out.progress).toBe(false);
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.next_action).toBeNull();
  });

  it('模型输出非 JSON → 回落本地脚本适配器', async () => {
    setEnv(REMOTE_ENV);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([contentLine('哎呀我忘了输出格式'), DONE_LINE])));

    const out = await chatTurn(BASE_INPUT);
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.top_candidates).toHaveLength(3);
  });

  it('历史中学长回复以 {"reply": ...} 形式回传（锚定 JSON 输出格式）', async () => {
    setEnv(REMOTE_ENV);
    const fetchMock = vi.fn().mockResolvedValue(streamText(MODEL_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const ts = '2026-09-22T00:00:00Z';
    await chatTurn({
      ...BASE_INPUT,
      history: [
        { role: 'student', content: '顶点式怎么求', ts },
        { role: 'agent', content: '我们先把式子配成顶点式试试。', ts },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    expect(body.messages).toHaveLength(4); // system + 2 条历史 + 本轮
    expect(body.messages[1]).toEqual({ role: 'user', content: '顶点式怎么求' });
    const agentMsg = JSON.parse(body.messages[2].content) as { reply: string };
    expect(agentMsg.reply).toContain('顶点式');
    expect(body.messages[3].role).toBe('user');
  });

  it('请求体 stream === true 且不带 response_format（不再有 400 去参重试）', async () => {
    setEnv(REMOTE_ENV);
    const fetchMock = vi.fn().mockResolvedValue(streamText(MODEL_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const out = await chatTurn(BASE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      stream?: boolean;
      response_format?: unknown;
    };
    expect(body.stream).toBe(true);
    expect(body.response_format).toBeUndefined();
    expect(out.reply).toContain('顶点式');
  });

  it('未配置环境变量 → 直接回落，不发起网络请求', async () => {
    setEnv({});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const out = await chatTurn(BASE_INPUT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.reply.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------- 新增（v1.3 真流式）

  it('thought / reply 增量按块到达：内容与顺序正确，且 thought 先于 reply', async () => {
    setEnv(REMOTE_ENV);
    const raw = JSON.stringify({
      thought: '学生卡在顶点式，我先带他把式子配平。',
      reply: '我们先把式子配成顶点式试试？',
      progress: false,
      progress_reason: '学生不知怎么求',
      kp_match: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.9 },
      top_candidates: [],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamText(raw, 8)));

    const { increments, onIncrement } = collectIncrements();
    const out = await chatTurn({ ...BASE_INPUT, onIncrement });

    expect(joinField(increments, 'thought')).toBe('学生卡在顶点式，我先带他把式子配平。');
    expect(joinField(increments, 'reply')).toBe('我们先把式子配成顶点式试试？');
    expect(increments.every((chunk) => chunk.text.length > 0)).toBe(true);
    // 增量分多块到达（真流式），不是一次性给全文
    expect(increments.filter((chunk) => chunk.field === 'reply').length).toBeGreaterThan(1);
    const firstReply = increments.findIndex((chunk) => chunk.field === 'reply');
    expect(increments.slice(0, firstReply).every((chunk) => chunk.field === 'thought')).toBe(true);
    expect(out.reply).toBe('我们先把式子配成顶点式试试？');
  });

  it('转义跨 chunk：\\" 与 \\uXXXX 被拆在多个块里 → 增量文本正确解码、无错字', async () => {
    setEnv(REMOTE_ENV);
    // 手写原始 JSON 文本（含 \" 与 \u4e2d 两种转义），最坏情况：逐字符到达
    const raw =
      '{"thought":"写 \\"顶点式\\" 时 \\u4e2d 间那一步不能漏","reply":"好的","progress":true,"progress_reason":null,"kp_match":{"kp_id":"math.cz.quadratic.vertex_form","confidence":0.9},"top_candidates":[]}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse([...raw.split('').map(contentLine), DONE_LINE])));

    const { increments, onIncrement } = collectIncrements();
    const out = await chatTurn({ ...BASE_INPUT, onIncrement });

    expect(joinField(increments, 'thought')).toBe('写 "顶点式" 时 中 间那一步不能漏');
    expect(joinField(increments, 'reply')).toBe('好的');
    for (const chunk of increments) {
      expect(chunk.text.endsWith('\\')).toBe(false);
      expect(chunk.text).not.toContain('\\u4e2d');
      expect(chunk.text).not.toContain('\\"');
    }
    expect(out.reply).toBe('好的');
    expect(out.progress).toBe(true);
  });

  it('data: [DONE] 结束 + 完整解析成功 → 字段映射不变（[DONE] 之后的块不再解析）', async () => {
    setEnv(REMOTE_ENV);
    const raw = JSON.stringify({
      thought: '先确认条件',
      reply: '先写下你看到的条件？',
      progress: true,
      progress_reason: null,
      kp_match: { kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.88 },
      top_candidates: [],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        streamResponse([contentLine(raw), DONE_LINE, contentLine('{"reply":"DONE 之后的多余块"}')]),
      ),
    );

    const { increments, onIncrement } = collectIncrements();
    const out = await chatTurn({ ...BASE_INPUT, onIncrement });

    expect(out.reply).toBe('先写下你看到的条件？');
    expect(out.kp_match).toEqual({ kp_id: 'math.cz.quadratic.vertex_form', confidence: 0.88 });
    expect(joinField(increments, 'reply')).toBe('先写下你看到的条件？');
  });

  it('字段乱序（reply 在 thought 前）→ 增量各自正确、不判失败，最终输出正确', async () => {
    setEnv(REMOTE_ENV);
    const raw =
      '{"reply":"先说的回复","thought":"后到的思考","progress":true,"progress_reason":null,"kp_match":{"kp_id":"math.cz.quadratic.vertex_form","confidence":0.7},"top_candidates":[]}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamText(raw, 6)));

    const { increments, onIncrement } = collectIncrements();
    const out = await chatTurn({ ...BASE_INPUT, onIncrement });

    expect(joinField(increments, 'reply')).toBe('先说的回复');
    expect(joinField(increments, 'thought')).toBe('后到的思考');
    // 到达顺序如实反映模型输出序（不猜测、不重排）
    expect(increments[0].field).toBe('reply');
    expect(out.reply).toBe('先说的回复');
  });

  it('流中段 network error 且已有 reply 增量 → 抛 RemoteChatAborted（不回落本地）', async () => {
    setEnv(REMOTE_ENV);
    // 后半截 JSON 被截断，流在此处断掉
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        brokenStream([contentLine('{"reply":"半截文本已经发出来了","progress":tru')]),
      ),
    );

    const { increments, onIncrement } = collectIncrements();
    await expect(chatTurn({ ...BASE_INPUT, onIncrement })).rejects.toBeInstanceOf(RemoteChatAborted);

    // 已到达的增量保留（前端据此保留半截文本并出错误气泡），且没有拼上本地模板文
    expect(joinField(increments, 'reply')).toBe('半截文本已经发出来了');
  });

  it('流开始即失败（零增量，HTTP 500）→ 回落本地，不抛 RemoteChatAborted', async () => {
    setEnv(REMOTE_ENV);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('server error', { status: 500 })));

    const { increments, onIncrement } = collectIncrements();
    const out = await chatTurn({ ...BASE_INPUT, onIncrement });

    expect(increments).toEqual([]);
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.next_action).toBeNull();
  });
});
