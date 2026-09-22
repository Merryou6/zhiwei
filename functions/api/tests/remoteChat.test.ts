/**
 * 远程大模型对话适配器测试（models/remoteChat.ts）
 *
 * 覆盖：环境变量配置读取（缺项回落）；extractJsonObject 稳健解析（裸 JSON / 围栏 / 杂文包裹）；
 * chatTurn 对 mock fetch 的结构化映射（reply/progress/kp_match/top_candidates）；
 * kp_id 未命中图谱时丢弃；网络失败/非 JSON/缺字段 → 回落 localChat（禁止白屏纪律）。
 * 全程 mock fetch，不发真实网络请求。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import { chatTurn, extractJsonObject, readRemoteChatConfig } from '../src/models/remoteChat';
import { REPO_ROOT } from './helpers';

const SD = loadStaticData(REPO_ROOT);

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

describe('chatTurn（mock fetch）', () => {
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

  function okResponse(content: string): Response {
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }

  it('结构化映射：合法字段透传，伪造 kp_id 的候选被丢弃', async () => {
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse(MODEL_JSON));
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
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(JSON.stringify({
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
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const out = await chatTurn(BASE_INPUT);
    // localChat 的「不知道」触发词 → progress=false；回复为澄清/引导模板
    expect(out.progress).toBe(false);
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.next_action).toBeNull();
  });

  it('模型输出非 JSON → 回落本地脚本适配器', async () => {
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('哎呀我忘了输出格式')));

    const out = await chatTurn(BASE_INPUT);
    expect(out.reply.length).toBeGreaterThan(0);
    expect(out.top_candidates).toHaveLength(3);
  });

  it('历史中学长回复以 {"reply": ...} 形式回传（锚定 JSON 输出格式）', async () => {
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse(MODEL_JSON));
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

  it('请求默认带 response_format=json_object；服务商 400 时去掉重试', async () => {
    setEnv({
      ZHIWEI_LLM_BASE_URL: 'https://api.example.com/v1',
      ZHIWEI_LLM_API_KEY: 'sk-test',
      ZHIWEI_LLM_MODEL: 'test-model',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('response_format not supported', { status: 400 }))
      .mockResolvedValueOnce(okResponse(MODEL_JSON));
    vi.stubGlobal('fetch', fetchMock);

    const out = await chatTurn(BASE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body1 = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      response_format?: { type: string };
    };
    const body2 = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as {
      response_format?: { type: string };
    };
    expect(body1.response_format).toEqual({ type: 'json_object' });
    expect(body2.response_format).toBeUndefined();
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
});
