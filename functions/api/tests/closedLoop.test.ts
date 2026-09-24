/**
 * 闭环集成测试（真实 HTTP server + fetch，唯一使用真实端口的测试）
 *
 * 全链路：register → 自报先验 → diagnose 3 题（错答制造 prerequisite_gap 素材）→
 * 试卷上传/回显/确认 → classify → attribution/analyze → verify（答错推进 + 答对确认
 * 两条子场景）→ agent/reject → plan/generate → baseline 3 题 / retest 3 题 →
 * report/summary 断言 ΔAccuracy > 0。
 *
 * 另有全局断言：**全程捕获的全部响应 JSON 字符串不含 "answer" / "solution_steps"**
 * （E5：toClientItem 白名单的端到端验证）；403 越权；真实 SSE 流式通路 + JSON 降级。
 */

import type { Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppContext } from '../src/context';
import { loadStaticData } from '../src/data/staticData';
import { createRoutes } from '../src/router';
import { createApiServer } from '../src/server';
import { REPO_ROOT, uniqueIdentifier } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const TRANSLATION_KP = 'math.cz.quadratic.translation';
const PASSWORD = 'secret123';

let server: Server;
let baseUrl: string;
let storeDir: string;

/** 全程捕获的响应原文（E5 全局断言用） */
const captured: { path: string; body: string }[] = [];

beforeAll(async () => {
  storeDir = await mkdtemp(join(tmpdir(), 'zhiwei-closedloop-'));
  const ctx = await createAppContext({ rootDir: REPO_ROOT, storeDir });
  server = await createApiServer({ context: ctx, quiet: true });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('未取到监听端口');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await rm(storeDir, { recursive: true, force: true });
});

interface ApiBody<T> {
  code: number;
  msg: string;
  data: T | null;
}

interface ApiResult<T> {
  status: number;
  body: ApiBody<T>;
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  captured.push({ path: `${method} ${path}`, body: text });
  return { status: response.status, body: JSON.parse(text) as ApiBody<T> };
}

async function newLearner(): Promise<{ token: string; spaceId: string }> {
  const registered = await api<{ user_id: string; token: string }>(
    'POST',
    '/api/auth/register',
    { identifier: uniqueIdentifier(), password: PASSWORD, nickname: '小林' },
  );
  expect(registered.body.code).toBe(0);
  const token = registered.body.data!.token;

  const spaces = await api<{ spaces: { space_id: string }[] }>(
    'GET',
    '/api/space/list',
    undefined,
    token,
  );
  return { token, spaceId: spaces.body.data!.spaces[0].space_id };
}

interface ClientItem {
  item_id: string;
  stem: string;
  options: string[] | null;
}

interface NextData {
  item: ClientItem | null;
  remaining: number;
  converged: boolean;
}

interface SubmitData {
  correct: boolean | null;
  mastery_before: number;
  mastery_after: number;
  converged: boolean;
  next_item: ClientItem | null;
}

interface RecognitionView {
  recognition_id: string;
  status: string;
  items: {
    seq: number;
    stem_excerpt: string;
    kp_guess: string;
    student_answer: string;
    suggested_result: string;
  }[];
}

interface AttributionData {
  attribution_id: string;
  root_cause: string;
  path: string[];
  suspect_scores: Record<string, number>;
  verification_item: ClientItem | null;
}

interface VerifyData {
  verified: boolean;
  correct: boolean;
  root_cause: string;
  next_candidate: {
    kp_id: string;
    suspect_score: number;
    verification_item: ClientItem | null;
  } | null;
}

interface PlanData {
  strategy: string;
  explanation_outline: string[];
  item_sequence: (ClientItem & { difficulty: number })[];
  path: string[];
}

interface ReportData {
  mastery: { kp_id: string; name: string; mastery: number; status_band: string }[];
  gaps: { kp_id: string; name: string; mastery: number; error_type_last: string | null }[];
  accuracy: { kp_id: string; baseline: number | null; retest: number | null; delta: number | null }[];
}

/** 确定的错误作答：优先 distractor 答案，否则空作答（D10 判 wrong）。 */
function wrongOf(itemId: string): string {
  return SD.itemById.get(itemId)?.distractors[0]?.answer ?? '';
}

describe('closedLoop · 20 接口全链路（真实 HTTP）', () => {
  it('register→自报→测评→试卷→诊断→归因→处方→复测→报告 全链路可跑通', async () => {
    const { token, spaceId } = await newLearner();

    // ---- #6 自报先验（level 3 → 二次函数 11 节点 mastery=0.50，使错答路径掌握度必然下降）
    const selfReport = await api<{ updated: number }>(
      'POST',
      '/api/evidence/self-report',
      { space_id: spaceId, reports: [{ chapter: '二次函数', level: 3 }] },
      token,
    );
    expect(selfReport.body.code).toBe(0);
    expect(selfReport.body.data!.updated).toBe(11);

    // ---- #7/#8 测评 3 题（全部用 distractor 答错 → 制造 prerequisite_gap 素材）
    const answered: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      const next = await api<NextData>(
        'POST',
        '/api/diagnose/next',
        { space_id: spaceId, mode: 'diagnose' },
        token,
      );
      expect(next.body.code).toBe(0);
      const item = next.body.data!.item;
      expect(item).not.toBeNull();

      const submitted = await api<SubmitData>(
        'POST',
        '/api/diagnose/submit',
        { space_id: spaceId, item_id: item!.item_id, answer: wrongOf(item!.item_id), mode: 'diagnose' },
        token,
      );
      expect(submitted.body.code).toBe(0);
      // diagnose 模式 correct 恒为 null（防反推答案）
      expect(submitted.body.data!.correct).toBeNull();
      expect(submitted.body.data!.mastery_after).toBeLessThan(submitted.body.data!.mastery_before);
      answered.push(item!.item_id);
    }
    expect(new Set(answered).size).toBe(3);

    // ---- #9/#10/#11 试卷上传 → 回显 → 确认
    const uploaded = await api<RecognitionView>(
      'POST',
      '/api/evidence/paper',
      { space_id: spaceId, file_id: 'cos://demo/paper.jpg' },
      token,
    );
    expect(uploaded.body.code).toBe(0);
    const recognitionId = uploaded.body.data!.recognition_id;

    const echoBefore = await api<RecognitionView>(
      'GET',
      `/api/evidence/paper/${recognitionId}`,
      undefined,
      token,
    );
    expect(echoBefore.body.data!.status).toBe('pending_confirm');
    expect(echoBefore.body.data!.items).toHaveLength(3);

    const confirmItems = uploaded.body.data!.items.map((item) => ({
      seq: item.seq,
      kp_id: item.kp_guess,
      result: item.suggested_result === 'unclear' ? 'wrong' : 'correct',
    }));
    const confirmed = await api<{ events_created: number }>(
      'POST',
      '/api/evidence/paper/confirm',
      { recognition_id: recognitionId, space_id: spaceId, items: confirmItems },
      token,
    );
    expect(confirmed.body.code).toBe(0);
    expect(confirmed.body.data!.events_created).toBeGreaterThan(0);

    const echoAfter = await api<RecognitionView>(
      'GET',
      `/api/evidence/paper/${recognitionId}`,
      undefined,
      token,
    );
    expect(echoAfter.body.data!.status).toBe('confirmed');

    // ---- #12 错误诊断（命中真实 distractor 路径）
    const classified = await api<{ status: string; attribution_direction: string | null }>(
      'POST',
      '/api/error/classify',
      {
        space_id: spaceId,
        kp_id: 'math.cz.quadratic.vertex_form',
        item_id: 'q_cz_vertex_001',
        student_answer: '(-1, 2)',
      },
      token,
    );
    expect(classified.body.code).toBe(0);
    expect(classified.body.data!.status).toBe('adopted');
    expect(classified.body.data!.attribution_direction).toBe('self');

    // ---- #13/#14 归因 analyze + get
    const analyzed = await api<AttributionData>(
      'POST',
      '/api/attribution/analyze',
      {
        space_id: spaceId,
        kp_id: 'math.cz.quadratic.extremum',
        error_type: 'prerequisite_gap',
      },
      token,
    );
    expect(analyzed.body.code).toBe(0);
    expect(analyzed.body.data!.attribution_id).toMatch(/^attr_/);
    expect(analyzed.body.data!.path[analyzed.body.data!.path.length - 1]).toBe(
      analyzed.body.data!.root_cause,
    );
    expect(analyzed.body.data!.verification_item).not.toBeNull();

    const attributionId = analyzed.body.data!.attribution_id;
    const fetched = await api<AttributionData>(
      'GET',
      `/api/attribution/${attributionId}`,
      undefined,
      token,
    );
    expect(fetched.body.code).toBe(0);
    expect(fetched.body.data!.root_cause).toBe(analyzed.body.data!.root_cause);
    expect(fetched.body.data!.verification_item).toEqual(analyzed.body.data!.verification_item);

    // ---- #15 verify 子场景 A：答错 → 推进次高嫌疑
    const firstItemId = analyzed.body.data!.verification_item!.item_id;
    const wrongVerified = await api<VerifyData>(
      'POST',
      '/api/attribution/verify',
      { attribution_id: attributionId, item_id: firstItemId, answer: wrongOf(firstItemId) },
      token,
    );
    expect(wrongVerified.body.code).toBe(0);
    expect(wrongVerified.body.data!.correct).toBe(false);
    expect(wrongVerified.body.data!.verified).toBe(false);
    expect(wrongVerified.body.data!.next_candidate).not.toBeNull();

    // ---- #15 verify 子场景 B：答对 → 确认根因
    const secondItem = wrongVerified.body.data!.next_candidate!.verification_item!;
    const correctVerified = await api<VerifyData>(
      'POST',
      '/api/attribution/verify',
      {
        attribution_id: attributionId,
        item_id: secondItem.item_id,
        answer: SD.itemById.get(secondItem.item_id)!.answer,
      },
      token,
    );
    expect(correctVerified.body.code).toBe(0);
    expect(correctVerified.body.data!.correct).toBe(true);
    expect(correctVerified.body.data!.verified).toBe(true);
    expect(correctVerified.body.data!.root_cause).toBe(
      SD.itemById.get(secondItem.item_id)!.knowledge_point,
    );

    // ---- #16 agent/reject
    const rejected = await api<{ verification_item: ClientItem | null }>(
      'POST',
      '/api/agent/reject',
      { attribution_id: attributionId, reason: '我觉得不是这个知识点' },
      token,
    );
    expect(rejected.body.code).toBe(0);

    // ---- #17 处方
    const plan = await api<PlanData>(
      'POST',
      '/api/plan/generate',
      { space_id: spaceId, root_cause: analyzed.body.data!.root_cause, error_type: 'prerequisite_gap' },
      token,
    );
    expect(plan.body.code).toBe(0);
    expect(plan.body.data!.strategy).toBe('先补上游 + 上游讲解');
    const planPath = plan.body.data!.path;
    expect(planPath[planPath.length - 1]).toBe(analyzed.body.data!.root_cause);
    expect(SD.nodeById.get(planPath[0])!.prerequisites).toHaveLength(0);
    expect(plan.body.data!.item_sequence.length).toBeGreaterThan(0);

    // 同一根因下，处方 path 必须与归因 path 完全一致（图谱高亮可直接 join）
    const planFromExtremum = await api<PlanData>(
      'POST',
      '/api/plan/generate',
      {
        space_id: spaceId,
        root_cause: 'math.cz.quadratic.extremum',
        error_type: 'prerequisite_gap',
      },
      token,
    );
    // 处方 path = 根因先修链（上游→根因，图谱高亮用）；必须覆盖归因回溯路径的节点
    const extremumPath = planFromExtremum.body.data!.path;
    expect(extremumPath[extremumPath.length - 1]).toBe('math.cz.quadratic.extremum');
    expect(extremumPath[0]).toBe('math.cz.function.concept');
    for (const kp of analyzed.body.data!.path) {
      expect(extremumPath).toContain(kp);
    }

    // ---- #11 复测闭环：baseline 3 题全错 → retest 3 题（另题）全对
    const retestItems = SD.itemsByKpPool(TRANSLATION_KP, 'retest');
    expect(retestItems.length).toBeGreaterThanOrEqual(6);

    for (const item of retestItems.slice(0, 3)) {
      const res = await api<SubmitData>(
        'POST',
        '/api/diagnose/submit',
        { space_id: spaceId, item_id: item.item_id, answer: wrongOf(item.item_id), mode: 'baseline' },
        token,
      );
      expect(res.body.code).toBe(0);
      expect(res.body.data!.correct).toBe(false);
    }
    for (const item of retestItems.slice(3, 6)) {
      const res = await api<SubmitData>(
        'POST',
        '/api/diagnose/submit',
        { space_id: spaceId, item_id: item.item_id, answer: item.answer, mode: 'retest' },
        token,
      );
      expect(res.body.code).toBe(0);
      expect(res.body.data!.correct).toBe(true);
    }

    // ---- #19 报告：ΔAccuracy > 0
    const report = await api<ReportData>(
      'GET',
      `/api/report/summary?space_id=${spaceId}`,
      undefined,
      token,
    );
    expect(report.body.code).toBe(0);
    expect(report.body.data!.mastery).toHaveLength(SD.nodesForKb('kb_math_cz').length);

    const row = report.body.data!.accuracy.find((entry) => entry.kp_id === TRANSLATION_KP)!;
    expect(row.baseline).toBe(0);
    expect(row.retest).toBe(1);
    expect(row.delta).toBe(1);
    expect(row.delta!).toBeGreaterThan(0);

    // 缺口清单与归因 error_type_last 已落库
    expect(report.body.data!.gaps.length).toBeGreaterThan(0);
    expect(
      report.body.data!.gaps.find((gap) => gap.kp_id === 'math.cz.quadratic.extremum')?.error_type_last,
    ).toBe('prerequisite_gap');
  });

  it('跨用户越权 → 403（E3：HTTP 状态与响应体 code 一致）', async () => {
    const a = await newLearner();
    const b = await newLearner();

    const cross = await api('POST', '/api/diagnose/next', { space_id: a.spaceId, mode: 'diagnose' }, b.token);
    expect(cross.body.code).toBe(403);
    expect(cross.status).toBe(403);

    const report = await api('GET', `/api/report/summary?space_id=${a.spaceId}`, undefined, b.token);
    expect(report.body.code).toBe(403);

    const noToken = await api('GET', '/api/space/list');
    expect(noToken.body.code).toBe(401);
    expect(noToken.status).toBe(401);
  });

  it('真实 SSE 流式通路（fetch 逐块读）+ Accept: application/json 降级', async () => {
    const { token, spaceId } = await newLearner();

    const response = await fetch(`${baseUrl}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ space_id: spaceId, message: '二次函数的顶点式我不会' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let chunks = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += 1;
      text += decoder.decode(value, { stream: true });
    }
    captured.push({ path: 'POST /api/agent/chat (sse)', body: text });

    // 逐块写出（chunked）而非一次性返回
    expect(chunks).toBeGreaterThanOrEqual(1);
    // v1.3：过程事件（phase/thought/tool）先于 delta；过滤后 delta → meta → done 相对序不变
    const events = [...text.matchAll(/^event: (\w+)/gm)].map((match) => match[1]);
    expect(events[0]).toBe('phase');
    expect(events.slice(-2)).toEqual(['meta', 'done']);
    expect(events.filter((name) => ['delta', 'meta', 'done'].includes(name))).toEqual([
      'delta',
      'meta',
      'done',
    ]);
    expect(events).toContain('thought');
    expect(events).toContain('tool');
    expect(text).toContain('"kp_match"');
    expect(text).toContain('math.cz.quadratic.vertex_form');
    expect(text).toContain('"next_action"');
    // tool 事件字段名（契约 §9 v1.3）与真实中间量落点
    expect(text).toContain('"node_count"');
    expect(text).toContain('"adopted"');

    // 降级路径：Accept: application/json
    const downgraded = await api<{
      reply: string;
      meta: { dialog_id: string };
      trace: { type: string; name?: string }[];
    }>(
      'POST',
      '/api/agent/chat',
      { space_id: spaceId, message: '二次函数的顶点式我不会' },
      token,
      { Accept: 'application/json' },
    );
    expect(downgraded.body.code).toBe(0);
    expect(downgraded.body.data!.reply).toEqual(expect.any(String));
    expect(downgraded.body.data!.reply).not.toContain('event:');
    expect(downgraded.body.data!.meta.dialog_id).toMatch(/^dlg_/);
    // v1.3：JSON 降级同携 trace（顺序即执行顺序，首步为 analyze 阶段）
    captured.push({ path: 'POST /api/agent/chat (json)', body: JSON.stringify(downgraded.body) });
    expect(Array.isArray(downgraded.body.data!.trace)).toBe(true);
    expect(downgraded.body.data!.trace.length).toBeGreaterThan(0);
    expect(downgraded.body.data!.trace[0]).toEqual({ type: 'phase', name: 'analyze', label: '分析' });
    expect(downgraded.body.data!.trace.filter((step) => step.type === 'tool').length).toBeGreaterThan(0);
  });

  it('E5 全局断言：全程捕获的响应 JSON 不含 "answer" / "solution_steps"', () => {
    expect(captured.length).toBeGreaterThan(20);
    for (const entry of captured) {
      expect(entry.body, `${entry.path} 下发禁发字段`).not.toContain('"answer"');
      expect(entry.body, `${entry.path} 下发禁发字段`).not.toContain('"solution_steps"');
    }
  });

  it('E1 路由闭合：20 个接口全部挂载（契约 v1.2：#1–#20 逐项核对）', () => {
    const routes = createRoutes().map((route) => `${route.method} ${route.pattern}`);

    expect(routes).toHaveLength(20);
    expect(new Set(routes).size).toBe(20);
    expect(routes).toEqual([
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/space/list',
      'POST /api/space/create',
      'GET /api/space/:spaceId/drive',
      'POST /api/evidence/self-report',
      'POST /api/diagnose/next',
      'POST /api/diagnose/submit',
      'POST /api/evidence/paper',
      'POST /api/evidence/paper/confirm',
      'GET /api/evidence/paper/:recognitionId',
      'POST /api/error/classify',
      'POST /api/attribution/analyze',
      'POST /api/attribution/verify',
      'POST /api/agent/reject',
      'GET /api/attribution/:attributionId',
      'POST /api/plan/generate',
      'POST /api/agent/chat',
      'GET /api/report/summary',
      // v1.2 新增（#20，只读）：路由表计数 19 → 20（更新而非删除，见执行报告 D11）
      'GET /api/user/profile',
    ]);
  });
});
