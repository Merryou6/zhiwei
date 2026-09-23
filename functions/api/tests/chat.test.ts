/**
 * 对话 SSE 接口测试（契约 §9，接口 #18 POST /api/agent/chat；ALGORITHM §5 退出通道）
 *
 * 覆盖：SSE 事件序列 delta→meta→done；kp 匹配 ≥0.6 → silent 弱负证据（mastery ×0.9）；
 * 同小时同 kp 去重不新增事件；无关键词 → 澄清且零证据；提示阶梯（第 2 轮 hint_down）；
 * 连续 3 轮 false → exit_channel + consecutive_false=3 + blocked_by_prerequisite +
 * 切到最近低掌握上游（≤MAX_EXIT_HOPS）；dialog 续聊复用；JSON 降级路径；首轮带图读题。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import type { ChatMeta } from '../src/services/chat';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const VERTEX_KP = 'math.cz.quadratic.vertex_form';
const FIXED_NOW = Date.parse('2026-09-19T10:00:00Z');

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

/** 从事件序列中取 meta（delta 段数随状态机变化，禁止硬编码下标）。 */
function metaOf(events: { event: string; data: unknown }[]): ChatMeta {
  const found = events.find((event) => event.event === 'meta');
  if (!found) throw new Error('SSE 事件序列缺少 meta');
  return found.data as ChatMeta;
}

function deltaTexts(events: { event: string; data: unknown }[]): string[] {
  return events
    .filter((event) => event.event === 'delta')
    .map((event) => (event.data as { text: string }).text);
}

describe('chat · 契约 §9 SSE 事件序列', () => {
  it('事件序列为 delta（≥1 段）→ meta → done，meta 字段与契约一致', async () => {
    const user = await bootstrap();
    const events = await streamChat(user, { message: KP_MESSAGE });

    expect(events.map((event) => event.event)).toEqual(['delta', 'meta', 'done']);

    const delta = events[0].data as { text: string };
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

    expect(events[2].data).toEqual({});
  });

  it('第 2 轮仍无进展 → hint_down；第 3 轮 → exit_channel（3 段 delta）', async () => {
    const user = await bootstrap();
    const first = await streamChat(user, { message: KP_MESSAGE });
    const dialogId = metaOf(first).dialog_id;

    const second = await streamChat(user, { message: '不会', dialog_id: dialogId });
    expect(metaOf(second).next_action).toBe('hint_down');
    expect(second.map((event) => event.event)).toEqual(['delta', 'delta', 'meta', 'done']);

    const third = await streamChat(user, { message: '不会', dialog_id: dialogId });
    expect(third.map((event) => event.event)).toEqual([
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
    expect((await streamChat(user, { message: '这题怎么写' }))[0].data).toEqual({
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
    expect((events[0].data as { text: string }).text).toContain('我看到了这道题');
    expect((events[0].data as { text: string }).text).toContain(
      SD.nodeById.get(VERTEX_KP)!.name,
    );

    const dialog = await app.ctx.store.getDialog(meta.dialog_id);
    expect(dialog?.messages[0].image_file_id).toBe('cos://demo/chat.jpg');
  });
});

describe('chat · 契约 §9 降级路径与校验', () => {
  it('Accept: application/json → 普通 JSON（reply 全文 + meta，无 event 前缀）', async () => {
    const user = await bootstrap();
    const res = await jsonChat(user, { message: KP_MESSAGE });

    expect(res.code).toBe(0);
    expect(Object.keys(res.data!).sort()).toEqual(['meta', 'reply'].sort());
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
