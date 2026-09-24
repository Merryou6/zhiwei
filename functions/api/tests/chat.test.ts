/**
 * 对话 SSE 接口测试（契约 §9，接口 #18 POST /api/agent/chat；ALGORITHM §5 退出通道）
 *
 * 覆盖：SSE 事件序列 delta→meta→done（v1.3：以 phase 开头，delta 前有真实过程事件）；
 * kp 匹配 ≥0.6 → silent 弱负证据（mastery ×0.9）；同小时同 kp 去重不新增事件；
 * 无关键词 → 澄清且零证据；提示阶梯（第 2 轮 hint_down）；
 * 连续 3 轮 false → exit_channel + consecutive_false=3 + blocked_by_prerequisite +
 * 切到最近低掌握上游（≤MAX_EXIT_HOPS）；dialog 续聊复用；JSON 降级路径（携 trace）；首轮带图读题。
 *
 * 过程链路（v1.3）另起 describe：tool 事件字段全真实中间量、未发生的步骤零事件、
 * JSON 降级 trace 与 SSE 事件序列同形。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import { TOOL_LABEL } from '../src/services/chatTrace';
import type { ChatToolName } from '../src/services/chatTrace';
import type { ChatMeta, ChatTraceStep } from '../src/services/chat';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const VERTEX_KP = 'math.cz.quadratic.vertex_form';
const FIXED_NOW = Date.parse('2026-09-19T10:00:00Z');

/** 契约 §9 v1.3 的工具名闭集（测试即契约副本，防「演」的步骤混入）。 */
const TOOL_NAMES: ChatToolName[] = [
  'load_graph',
  'model_call',
  'kp_match',
  'dedup_check',
  'apply_evidence',
  'state_machine',
  'exit_channel',
];

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp({ now: () => FIXED_NOW });
});

afterEach(async () => {
  await app.cleanup();
});

interface ChatJsonData {
  reply: string;
  meta: ChatMeta;
  trace: ChatTraceStep[];
}

/** 注册 + 自报「二次函数」level 3（vertex_form mastery = 0.50，使弱负证据可观测）。 */
async function bootstrap(): Promise<TestUser> {
  const user = await app.register(uniqueIdentifier());
  const res = await app.post(
    '/api/evidence/self-report',
    { space_id: user.space_id, reports: [{ chapter: '二次函数', level: 3 }] },
    { token: user.token },
  );
  expect(res.code).toBe(0);
  return user;
}

const streamChat = (
  user: TestUser,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => app.stream('/api/agent/chat', { space_id: user.space_id, ...body }, { token: user.token, headers });

const jsonChat = (user: TestUser, body: Record<string, unknown>) =>
  app.post<ChatJsonData>('/api/agent/chat', { space_id: user.space_id, ...body }, {
    token: user.token,
    headers: { accept: 'application/json' },
  });

const KP_MESSAGE = '二次函数的顶点式我不会';

type Ev = { event: string; data: unknown };

/** 从事件序列中取 meta（delta 段数随状态机变化，禁止硬编码下标）。 */
function metaOf(events: Ev[]): ChatMeta {
  const found = events.find((event) => event.event === 'meta');
  if (!found) throw new Error('SSE 事件序列缺少 meta');
  return found.data as ChatMeta;
}

function deltaTexts(events: Ev[]): string[] {
  return events
    .filter((event) => event.event === 'delta')
    .map((event) => (event.data as { text: string }).text);
}

/** 首个 delta 事件的 data（v1.3 起 events[0] 是 phase 事件）。 */
function firstDelta(events: Ev[]): { text: string } {
  const found = events.find((event) => event.event === 'delta');
  if (!found) throw new Error('SSE 事件序列缺少 delta');
  return found.data as { text: string };
}

/** 取某个工具事件的 data（不存在即抛，避免静默通过）。 */
function toolOf(events: Ev[], name: ChatToolName): {
  id: string;
  name: ChatToolName;
  label: string;
  status: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  ms?: number;
} {
  const found = events.filter((event) => event.event === 'tool');
  const target = found.find((event) => (event.data as { name: string }).name === name);
  if (!target) throw new Error(`SSE 事件序列缺少 tool 事件：${name}`);
  return target.data as never;
}

function toolNames(events: Ev[]): string[] {
  return events
    .filter((event) => event.event === 'tool')
    .map((event) => (event.data as { name: string }).name);
}

function thoughtTexts(events: Ev[]): string[] {
  return events
    .filter((event) => event.event === 'thought')
    .map((event) => (event.data as { text: string }).text);
}

describe('chat · 契约 §9 SSE 事件序列', () => {
  it('事件序列为 delta（≥1 段）→ meta → done，meta 字段与契约一致', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: KP_MESSAGE });

    // v1.3：以 phase 开头、meta/done 收尾；过滤掉过程事件后 delta→meta→done 相对序不变
    const names = events.map((event) => event.event);
    expect(names[0]).toBe('phase');
    expect(events[0].data).toEqual({ name: 'analyze', label: '分析' });
    expect(names.slice(-2)).toEqual(['meta', 'done']);
    expect(names.filter((name) => ['delta', 'meta', 'done'].includes(name))).toEqual([
      'delta',
      'meta',
      'done',
    ]);

    const delta = firstDelta(events);
    expect(typeof delta.text).toBe('string');
    expect(delta.text.length).toBeGreaterThan(0);

    const meta = metaOf(events);
    expect(Object.keys(meta).sort()).toEqual(
      ['dialog_id', 'kp_match', 'next_action', 'progress', 'progress_reason'].sort(),
    );
    expect(meta.dialog_id).toMatch(/^dlg_/);
    expect(meta.kp_match.kp_id).toBe(VERTEX_KP);
    expect(meta.kp_match.confidence).toBeGreaterThanOrEqual(app.ctx.params.CONF_ADOPT);
    expect(meta.progress).toBe(false);
    expect(meta.progress_reason).toEqual(expect.any(String));
    expect(meta.next_action).toBe('continue');

    expect(events[events.length - 1].data).toEqual({});
  });

  it('第 2 轮仍无进展 → hint_down；第 3 轮 → exit_channel（3 段 delta）', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    const second = await streamChat(user, { message: '不会', dialog_id: dialogId });
    expect(metaOf(second).next_action).toBe('hint_down');
    // 段数（原数组断言改为段数 + 相对序；v1.3 起序列里还有 phase/thought/tool 事件）
    expect(deltaTexts(second)).toHaveLength(2);
    expect(second.map((event) => event.event).filter((name) => ['delta', 'meta', 'done'].includes(name))).toEqual([
      'delta',
      'delta',
      'meta',
      'done',
    ]);

    const third = await streamChat(user, { message: '不会', dialog_id: dialogId });
    expect(deltaTexts(third)).toHaveLength(3);
    expect(third.map((event) => event.event).filter((name) => ['delta', 'meta', 'done'].includes(name))).toEqual([
      'delta',
      'delta',
      'delta',
      'meta',
      'done',
    ]);
    const meta = metaOf(third);
    expect(meta.next_action).toBe('exit_channel');
    expect(meta.dialog_id).toBe(dialogId);

    // 完整解法 + 退出话术（先解法后退出）
    const texts = deltaTexts(third);
    expect(texts[1]).toContain('完整解法');
    expect(texts[2]).toContain('往回看一眼');

    const dialog = await app.ctx.store.getDialog(dialogId);
    expect(dialog?.consecutive_false).toBe(3);
    expect(dialog?.messages).toHaveLength(6);
    expect(dialog?.status).toBe('exited');
  });

  it('第 3 轮触发退出通道 → 当前 kp 置 blocked_by_prerequisite，并切到最近低掌握上游', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    await streamChat(user, { message: '不会', dialog_id: dialogId });
    const third = await streamChat(user, { message: '不会', dialog_id: dialogId });
    const meta = metaOf(third);

    const blocked = await app.ctx.store.getProfile(user.user_id, user.space_id, VERTEX_KP);
    expect(blocked?.status).toBe('blocked_by_prerequisite');
    expect(blocked?.mastery).toBeCloseTo(0.45, 10);

    // 最近（dist=1）且 mastery < EXIT_UPSTREAM_THRESHOLD 的上游
    expect(meta.kp_match.kp_id).toBe('math.cz.function.graph');
    const dialog = await app.ctx.store.getDialog(dialogId);
    expect(dialog?.kp_id).toBe('math.cz.function.graph');
    expect(dialog?.exit_count).toBe(1);
  });
});

describe('chat · 契约 §9 弱负证据与澄清', () => {
  it('kp 匹配置信度 ≥0.6 → 产生 silent 弱负证据（mastery ×0.9）+ mastery_logs 留痕', async () => {
    const user = await bootstrap();
    await streamChat(user, { message: KP_MESSAGE });

    const profile = await app.ctx.store.getProfile(user.user_id, user.space_id, VERTEX_KP);
    expect(profile?.mastery).toBeCloseTo(0.45, 10);
    expect(profile?.last_evidence_type).toBe('silent');

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('silent');
    expect(events[0].mode).toBeNull();
    expect(events[0].item_id).toBeNull();
    expect(events[0].weight).toBe(0);
    expect(events[0].alpha).toBeCloseTo(app.ctx.params.ALPHA_SILENT, 10);
    expect(events[0].knowledge_point).toBe(VERTEX_KP);

    const logs = await app.ctx.store.listLogsBySpace(user.space_id);
    expect(logs).toHaveLength(1);
    expect(logs[0].before).toBeCloseTo(0.5, 10);
    expect(logs[0].after).toBeCloseTo(0.45, 10);
    expect(logs[0].p_obs).toBeCloseTo(0.45, 10);
    expect(logs[0].weight).toBe(0);
    expect(logs[0].triggered_by).toBe(events[0].event_id);
  });

  it('同小时同 kp 第二轮 → dedup 命中，不新增事件、掌握度不再衰减', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    await streamChat(user, { message: '顶点式还是不会', dialog_id: dialogId });

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events).toHaveLength(1);
    expect(await app.ctx.store.listLogsBySpace(user.space_id)).toHaveLength(1);

    const profile = await app.ctx.store.getProfile(user.user_id, user.space_id, VERTEX_KP);
    expect(profile?.mastery).toBeCloseTo(0.45, 10);
  });

  it('无 kp 关键词 → clarify 且零证据（confidence 0.30 < CONF_ADOPT）', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: '这题怎么写' });

    const meta = metaOf(events);
    expect(meta.kp_match.confidence).toBeCloseTo(0.3, 10);
    expect(meta.kp_match.confidence).toBeLessThan(app.ctx.params.CONF_ADOPT);
    expect(meta.progress).toBe(true);

    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
    expect(await app.ctx.store.listLogsBySpace(user.space_id)).toHaveLength(0);
    expect(firstDelta(await streamChat(user, { message: '这题怎么写' }))).toEqual({
      text: expect.stringContaining('确认'),
    });
  });

  it('首轮带 image_file_id → 先读题（reply 含 Top-1 kp 名，meta.kp_match 返回最优候选）', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, {
      message: KP_MESSAGE,
      image_file_id: 'cos://demo/chat.jpg',
    });

    const meta = metaOf(events);
    expect(meta.kp_match.kp_id).toBe(VERTEX_KP);
    expect(firstDelta(events).text).toContain('我看到了这道题');
    expect(firstDelta(events).text).toContain(SD.nodeById.get(VERTEX_KP)!.name);

    const dialog = await app.ctx.store.getDialog(meta.dialog_id);
    expect(dialog?.messages[0].image_file_id).toBe('cos://demo/chat.jpg');
  });
});

describe('chat · 契约 §9 降级路径与校验', () => {
  it('Accept: application/json → 普通 JSON（reply 全文 + meta + trace，无 event 前缀）', async () => {
    const user = await bootstrap();
    const res = await jsonChat(user, { message: KP_MESSAGE });

    expect(res.code).toBe(0);
    expect(Object.keys(res.data!).sort()).toEqual(['meta', 'reply', 'trace'].sort());
    expect(typeof res.data!.reply).toBe('string');
    expect(res.data!.reply).not.toContain('event:');
    expect(res.data!.meta.dialog_id).toMatch(/^dlg_/);
    expect(res.data!.meta.kp_match.kp_id).toBe(VERTEX_KP);
  });

  it('X-Response-Format: json 同样走降级路径', async () => {
    const user = await bootstrap();
    const res = await app.post<ChatJsonData>(
      '/api/agent/chat',
      { space_id: user.space_id, message: KP_MESSAGE },
      { token: user.token, headers: { 'x-response-format': 'json' } },
    );
    expect(res.code).toBe(0);
    expect(res.data!.reply).toEqual(expect.any(String));
  });

  it('续聊传 dialog_id 复用同一记录；他人 dialog → 403；不存在 → 404', async () => {
    const a = await bootstrap();
    const b = await bootstrap();
    const first = await streamChat(a, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    const second = await streamChat(a, { message: '还是不会', dialog_id: dialogId });
    expect(metaOf(second).dialog_id).toBe(dialogId);

    const cross = await app.post(
      '/api/agent/chat',
      { space_id: b.space_id, dialog_id: dialogId, message: '你好' },
      { token: b.token },
    );
    expect(cross.code).toBe(403);

    const res = await app.post(
      '/api/agent/chat',
      { space_id: a.space_id, dialog_id: 'dlg_not_exists', message: '你好' },
      { token: a.token },
    );
    expect(res.code).toBe(404);
  });

  it('message 为空 → 400；越权 space_id → 403；未认证 → 401', async () => {
    const a = await bootstrap();
    const b = await bootstrap();

    const blank = await app.post(
      '/api/agent/chat',
      { space_id: a.space_id, message: '   ' },
      { token: a.token },
    );
    expect(blank.code).toBe(400);
    const empty = await app.post(
      '/api/agent/chat',
      { space_id: a.space_id, message: '' },
      { token: a.token },
    );
    expect(empty.code).toBe(400);

    const cross = await app.post(
      '/api/agent/chat',
      { space_id: a.space_id, message: '你好' },
      { token: b.token },
    );
    expect(cross.code).toBe(403);

    expect((await app.post('/api/agent/chat', { space_id: a.space_id, message: '你好' })).code).toBe(
      401,
    );
  });
});

describe('chat · 过程链路 trace（契约 §9 v1.3）', () => {
  it('事件全序列：phase analyze 开头、meta/done 收尾；delta 前有 4 个真实 tool 事件', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: KP_MESSAGE });

    const names = events.map((event) => event.event);
    expect(names[0]).toBe('phase');
    expect(names[names.length - 2]).toBe('meta');
    expect(names[names.length - 1]).toBe('done');

    const deltaIndex = names.indexOf('delta');
    expect(deltaIndex).toBeGreaterThan(0);
    const before = events.slice(0, deltaIndex);
    const beforeTools = toolNames(before);
    for (const name of ['load_graph', 'model_call', 'kp_match', 'state_machine']) {
      expect(beforeTools).toContain(name);
    }
    // 本地模式过程事件全部先于首个 delta（契约 §9 v1.3 顺序约定）
    expect(beforeTools).toEqual(['load_graph', 'model_call', 'kp_match', 'dedup_check', 'apply_evidence', 'state_machine']);
    // 阶段顺序：analyze → retrieve → judge → generate
    expect(
      events
        .filter((event) => event.event === 'phase')
        .map((event) => (event.data as { name: string }).name),
    ).toEqual(['analyze', 'retrieve', 'judge', 'generate']);
    expect(events[names.length - 1].event).toBe('done');
  });

  it('tool 字段形态：name ∈ 闭集、label 与 TOOL_LABEL 一致、kp_match.result 为真实中间量', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: KP_MESSAGE });

    const tools = events
      .filter((event) => event.event === 'tool')
      .map((event) => event.data as { name: ChatToolName; label: string; status: string; ms?: number });
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(TOOL_NAMES).toContain(tool.name);
      expect(tool.label).toBe(TOOL_LABEL[tool.name]);
      expect(tool.status).toBe('ok');
      expect(typeof tool.ms).toBe('number');
      expect(tool.ms).toBeGreaterThanOrEqual(0);
    }

    const kpMatch = toolOf(events, 'kp_match');
    expect(kpMatch.result).toEqual({
      kp_id: VERTEX_KP,
      confidence: 0.85,
      threshold: app.ctx.params.CONF_ADOPT,
      adopted: true,
    });
    expect(kpMatch.args).toEqual({ message_excerpt: KP_MESSAGE.slice(0, 20) });

    const loadGraph = toolOf(events, 'load_graph');
    expect(loadGraph.args).toEqual({ kb: 'kb_math_cz', node_count: SD.nodesForKb('kb_math_cz').length });

    const modelCall = toolOf(events, 'model_call');
    expect(modelCall.args).toEqual({ mode: 'local' });
    expect(modelCall.result).toEqual({ kp_id: VERTEX_KP, confidence: 0.85, progress: false });
  });

  it('第二轮 dedup 命中：dedup_check.result.hit === true 且无 apply_evidence 事件', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    // 同 kp（含「二次函数的顶点式」）第二次追问 → 1 小时桶内去重命中
    const second = await streamChat(user, { message: '二次函数的顶点式还是不会', dialog_id: dialogId });
    expect(toolOf(second, 'kp_match').result?.adopted).toBe(true);
    expect(toolOf(second, 'dedup_check').result).toEqual({ hit: true });
    expect(toolNames(second)).not.toContain('apply_evidence');
    expect(thoughtTexts(second).some((text) => text.includes('同小时已有证据，跳过写入'))).toBe(true);

    // 第一轮的对照：命中前应有 apply_evidence，且 hit === false
    expect(toolOf(first, 'dedup_check').result).toEqual({ hit: false });
    expect(toolNames(first)).toContain('apply_evidence');
  });

  it('证据事件：apply_evidence.result.before/after 与 mastery_logs 对账；thought 含真实数值', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: KP_MESSAGE });

    const applied = toolOf(events, 'apply_evidence');
    const logs = await app.ctx.store.listLogsBySpace(user.space_id);
    expect(logs).toHaveLength(1);
    expect(applied.args).toEqual({ kp_id: VERTEX_KP });
    expect((applied.result as { before: number }).before).toBeCloseTo(logs[0].before, 10);
    expect((applied.result as { after: number }).after).toBeCloseTo(logs[0].after, 10);
    expect((applied.result as { before: number }).before).toBeCloseTo(0.5, 10);
    expect((applied.result as { after: number }).after).toBeCloseTo(0.45, 10);
    expect((applied.result as { event_id: string }).event_id).toMatch(/^evt_/);
    expect((applied.result as { event_id: string }).event_id).toBe(logs[0].triggered_by);

    // thought 是真实中间量拼成的确定性摘要（不是伪造的模型独白）
    expect(thoughtTexts(events)).toContain('写入弱负证据：掌握度 0.5 → 0.45');
  });

  it('第 3 轮退出通道：exit_channel.result 为真实上游 / 跳转 / 计数 / 上限', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;
    await streamChat(user, { message: '不会', dialog_id: dialogId });
    const third = await streamChat(user, { message: '不会', dialog_id: dialogId });

    const exit = toolOf(third, 'exit_channel');
    expect(exit.args).toEqual({ current_kp_id: VERTEX_KP });
    expect(exit.result).toEqual({
      jumped: true,
      exit_count: 1,
      hop_limit: app.ctx.params.MAX_EXIT_HOPS,
      upstream_kp_id: 'math.cz.function.graph',
      upstream_name: expect.any(String),
    });
    expect(exit.result?.upstream_name).toBe(SD.nodeById.get('math.cz.function.graph')!.name);
    expect(exit.result?.hop_limit).toBe(2);
    expect(thoughtTexts(third).some((text) => text.includes('执行跳转'))).toBe(true);
  });

  it('clarify 轮（无关键词）：未发生的步骤零事件（无 dedup_check / apply_evidence）', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: '这题怎么写' });

    expect(toolNames(events)).toEqual(['load_graph', 'model_call', 'kp_match', 'state_machine']);
    expect(toolOf(events, 'kp_match').result).toEqual({
      kp_id: '',
      confidence: 0.3,
      threshold: app.ctx.params.CONF_ADOPT,
      adopted: false,
    });
    expect(thoughtTexts(events).some((text) => text.includes('本轮不产生证据，先追问澄清'))).toBe(true);
    // 澄清轮无附加段 → 不发 generate 阶段的 thought
    expect(thoughtTexts(events).some((text) => text.includes('追加'))).toBe(false);
  });

  it('JSON 降级 data.trace 与 SSE 事件序列同形（两个全新空间各跑同一请求）', async () => {
    const stream = await bootstrap();
    const json = await bootstrap();

    const events = await streamChat(stream, { message: KP_MESSAGE });
    const res = await jsonChat(json, { message: KP_MESSAGE });

    expect(res.code).toBe(0);
    const trace = res.data!.trace;
    expect(Array.isArray(trace)).toBe(true);

    const traceToolNames = trace.filter((step) => step.type === 'tool').map((step) => (step as { name: string }).name);
    expect(traceToolNames).toEqual(toolNames(events));
    expect(
      trace.filter((step) => step.type === 'phase').map((step) => (step as { name: string }).name),
    ).toEqual(
      events.filter((event) => event.event === 'phase').map((event) => (event.data as { name: string }).name),
    );
    expect(
      trace.filter((step) => step.type === 'thought').map((step) => (step as { text: string }).text),
    ).toEqual(thoughtTexts(events));

    // 降级 trace 只含当轮；工具步骤恒为终态（契约 §9 3.3）
    for (const step of trace) {
      if (step.type === 'tool') expect(step.status).toBe('ok');
    }
    expect(trace[0]).toEqual({ type: 'phase', name: 'analyze', label: '分析' });
    // 拼接 reply 与 SSE 各 delta 段一致（delta 走独立通道，不在 trace 内）
    expect(res.data!.reply).toBe(deltaTexts(events).join(''));
  });
});
