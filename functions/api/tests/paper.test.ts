/**
 * 试卷上传/回显/确认接口测试（契约 §5，接口 #9–#11；通路二 w = W_PAPER = 0.8）
 *
 * 覆盖：识别 3 项且含 unclear、确定性（同 file_id 结果一致）、recognitions 落库与回显、
 * 确认流（unclear 必须手标 400 / kp 非法 400 / seq 非法 400 / 重复确认 409 /
 * 逐题写证据 + w=0.8 掌握度更新 + status→confirmed + expire_at 30d）、
 * 识别本身不产生证据、404/403/401、502/504 降级话术映射。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PAPER_EXPIRE_DAYS,
  mapModelError,
  toClientRecognitionItem,
  upload,
} from '../src/services/paper';
import { ERROR_CODES } from '../src/errors';
import { createRoutes } from '../src/router';
import type { RecognitionRecord } from '../src/db/types';
import { createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface RecognitionItemView {
  seq: number;
  stem_excerpt: string;
  kp_guess: string;
  student_answer: string;
  suggested_result: string;
}

interface RecognitionView {
  recognition_id: string;
  status: string;
  items: RecognitionItemView[];
}

interface ConfirmData {
  events_created: number;
  mastery_updates: { knowledge_point: string; before: number; after: number }[];
}

const doUpload = (user: TestUser, fileId = 'cos://demo/paper.jpg') =>
  app.post<RecognitionView>(
    '/api/evidence/paper',
    { space_id: user.space_id, file_id: fileId },
    { token: user.token },
  );

const doGet = (user: TestUser, recognitionId: string) =>
  app.get<RecognitionView>(`/api/evidence/paper/${recognitionId}`, { token: user.token });

const doConfirm = (user: TestUser, recognitionId: string, items: unknown) =>
  app.post<ConfirmData>(
    '/api/evidence/paper/confirm',
    { recognition_id: recognitionId, space_id: user.space_id, items },
    { token: user.token },
  );

describe('paper · 契约 §5 上传与回显（#9 / #10）', () => {
  it('上传返回 3 项、至少 1 项 unclear、字段为契约白名单（无 crop_url）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await doUpload(user);

    expect(res.code).toBe(0);
    expect(res.data?.recognition_id).toMatch(/^rec_/);
    expect(res.data?.status).toBe('pending_confirm');
    expect(res.data?.items).toHaveLength(3);
    expect(res.data?.items.filter((item) => item.suggested_result === 'unclear').length).toBeGreaterThanOrEqual(1);

    for (const item of res.data!.items) {
      expect(Object.keys(item).sort()).toEqual(
        ['kp_guess', 'seq', 'stem_excerpt', 'student_answer', 'suggested_result'].sort(),
      );
      expect(item.stem_excerpt.endsWith('…')).toBe(true);
      expect(item.suggested_result).toMatch(/^(correct|wrong|unclear)$/);
    }
  });

  it('结果整体落 recognitions 表（含 crop_url），刷新可凭 recognition_id 回显', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;

    const stored = await app.ctx.store.getRecognition(id);
    expect(stored?.status).toBe('pending_confirm');
    expect(stored?.user_id).toBe(user.user_id);
    expect(stored?.space_id).toBe(user.space_id);
    expect(stored?.items).toHaveLength(3);
    expect(stored?.items[0].crop_url).toBe(`local://paper/${user.space_id}/${id}/1.jpg`);
    expect(stored?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(Date.parse(stored!.expire_at) - Date.parse(stored!.created_at)).toBe(
      PAPER_EXPIRE_DAYS * 24 * 3600 * 1000,
    );

    const echoed = await doGet(user, id);
    expect(echoed.code).toBe(0);
    expect(echoed.data?.status).toBe('pending_confirm');
    expect(echoed.data?.items).toEqual(uploaded.data?.items);
  });

  it('同 file_id 两次调用结果一致（确定性，D14）', async () => {
    const user = await app.register(uniqueIdentifier());
    const first = await doUpload(user, 'cos://demo/same.jpg');
    const second = await doUpload(user, 'cos://demo/same.jpg');
    expect(second.data?.items).toEqual(first.data?.items);
    expect(second.data?.recognition_id).not.toBe(first.data?.recognition_id);
  });

  it('识别本身不产生证据、不更新掌握度（确认才生效）', async () => {
    const user = await app.register(uniqueIdentifier());
    await doUpload(user);

    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
    expect(await app.ctx.store.listProfiles(user.user_id, user.space_id)).toHaveLength(0);
  });

  it('不存在 → 404；他人 recognition → 403；未认证 → 401', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(a);
    const id = uploaded.data!.recognition_id;

    expect((await doGet(a, 'rec_not_exists')).code).toBe(404);
    expect((await doGet(b, id)).code).toBe(403);
    expect((await app.get(`/api/evidence/paper/${id}`)).code).toBe(401);
  });

  it('space 越权 → 403；file_id 缺失 → 400', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());

    const cross = await app.post(
      '/api/evidence/paper',
      { space_id: a.space_id, file_id: 'cos://demo/x.jpg' },
      { token: b.token },
    );
    expect(cross.code).toBe(403);
    expect(
      (await app.post('/api/evidence/paper', { space_id: a.space_id }, { token: a.token })).code,
    ).toBe(400);
  });
});

describe('paper · 契约 §5 确认（#11）', () => {
  it('确认 3 题 → events_created=3、mastery_updates 按去重后 kp 数、status→confirmed', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;

    const items = uploaded.data!.items.map((item) => ({
      seq: item.seq,
      kp_id: item.kp_guess,
      result: item.suggested_result === 'unclear' ? 'wrong' : 'correct',
    }));
    const res = await doConfirm(user, id, items);

    expect(res.code).toBe(0);

    const distinctKps = new Set(uploaded.data!.items.map((item) => item.kp_guess));
    expect(res.data?.events_created).toBe(distinctKps.size);

    expect(res.data?.mastery_updates).toHaveLength(distinctKps.size);
    for (const update of res.data!.mastery_updates) {
      expect(distinctKps.has(update.knowledge_point)).toBe(true);
    }

    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events).toHaveLength(distinctKps.size);
    for (const event of events) {
      expect(event.source).toBe('paper');
      expect(event.mode).toBeNull();
      expect(event.item_id).toBeNull();
      expect(event.weight).toBeCloseTo(app.ctx.params.W_PAPER, 10);
      expect(event.expire_at).toBeTruthy();
      expect(event.raw.crop_url).toEqual(expect.stringContaining('local://paper/'));
      expect(Object.keys(event.raw).sort()).toEqual(['crop_url', 'seq', 'student_answer'].sort());
    }

    expect((await app.ctx.store.getRecognition(id))?.status).toBe('confirmed');
    expect((await doGet(user, id)).data?.status).toBe('confirmed');
  });

  it('unclear 项未手标 → 400（服务端拒绝默认值，PRD P0 #4）', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;

    const missingUnclear = uploaded.data!.items
      .filter((item) => item.suggested_result !== 'unclear')
      .map((item) => ({ seq: item.seq, kp_id: item.kp_guess, result: 'wrong' }));

    const res = await doConfirm(user, id, missingUnclear);
    expect(res.code).toBe(400);
    expect(res.msg).toContain('手动标注');

    expect((await app.ctx.store.getRecognition(id))?.status).toBe('pending_confirm');
    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
  });

  it('kp_id 不在知识库 / result 非法 / seq 不属于该识别结果 / items 非数组 → 400', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;
    const seq1 = uploaded.data!.items[0].seq;

    expect((await doConfirm(user, id, [{ seq: seq1, kp_id: 'math.not.exists', result: 'wrong' }])).code).toBe(400);
    expect((await doConfirm(user, id, [{ seq: seq1, kp_id: 'math.cz.quadratic.extremum', result: 'maybe' }])).code).toBe(400);
    expect((await doConfirm(user, id, [{ seq: 99, kp_id: 'math.cz.quadratic.extremum', result: 'wrong' }])).code).toBe(400);
    expect((await doConfirm(user, id, 'nope')).code).toBe(400);
  });

  it('重复 confirm → 409（防双击重复计分）', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;
    const items = uploaded.data!.items.map((item) => ({
      seq: item.seq,
      kp_id: item.kp_guess,
      result: 'wrong',
    }));

    expect((await doConfirm(user, id, items)).code).toBe(0);
    const again = await doConfirm(user, id, items);
    expect(again.code).toBe(409);

    // 幂等保护：事件不因重复确认而翻倍
    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(3);
  });

  it('w=0.8 的掌握度变化与引擎 T2 自检场景一致（0.50 → 0.791）', async () => {
    const user = await app.register(uniqueIdentifier());
    await app.post(
      '/api/evidence/self-report',
      { space_id: user.space_id, reports: [{ chapter: '二次函数', level: 3 }] },
      { token: user.token },
    );

    const recognitions = app.ctx.store;
    const record: RecognitionRecord = {
      recognition_id: 'rec_controlled',
      user_id: user.user_id,
      space_id: user.space_id,
      file_id: 'cos://demo/controlled.jpg',
      status: 'pending_confirm',
      items: [
        {
          seq: 1,
          stem_excerpt: '求 y = x^2 - 4x + 7 的最小值…',
          kp_guess: 'math.cz.quadratic.extremum',
          student_answer: 'x=2时最小值3',
          suggested_result: 'correct',
          crop_url: 'local://paper/controlled/1.jpg',
        },
      ],
      created_at: '2026-09-19T10:00:00Z',
      expire_at: '2026-10-19T10:00:00Z',
    };
    await recognitions.insertRecognition(record);

    const res = await doConfirm(user, 'rec_controlled', [
      { seq: 1, kp_id: 'math.cz.quadratic.extremum', result: 'correct' },
    ]);

    expect(res.code).toBe(0);
    expect(res.data?.events_created).toBe(1);
    expect(res.data?.mastery_updates[0].before).toBeCloseTo(app.ctx.params.PRIOR_MAP['3'], 10);
    expect(res.data?.mastery_updates[0].after).toBeCloseTo(0.791, 3);

    const profile = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      'math.cz.quadratic.extremum',
    );
    expect(profile?.mastery).toBeCloseTo(0.791, 3);
    expect(profile?.last_evidence_type).toBe('paper');
    expect(profile?.evidence_count).toBe(1);
  });

  it('学生修正 kp_id（与 kp_guess 不一致）被接受，证据记在学生修正的 kp 上', async () => {
    const user = await app.register(uniqueIdentifier());
    const uploaded = await doUpload(user);
    const id = uploaded.data!.recognition_id;

    const corrected = 'math.cz.quadratic.extremum';
    const items = uploaded.data!.items.map((item) => ({
      seq: item.seq,
      kp_id: corrected,
      result: 'wrong',
    }));
    const res = await doConfirm(user, id, items);

    expect(res.code).toBe(0);
    const events = await app.ctx.store.listEventsBySpace(user.space_id);
    expect(events.every((event) => event.knowledge_point === corrected)).toBe(true);
    // 同 kp 同小时同 source → dedup 只计一次（先查后写），events_created 如实反映
    expect(res.data?.events_created).toBe(1);
    expect(events).toHaveLength(1);
  });
});

describe('paper · 契约 §5 降级话术与白名单', () => {
  it('mapModelError：普通失败 → 502、超时 → 504，msg 均为用户可读话术', () => {
    const upstream = mapModelError(new Error('boom'));
    expect(upstream.code).toBe(ERROR_CODES.MODEL_UPSTREAM_FAILED);
    expect(upstream.message).toBe('这道题我没看清，麻烦你手动标一下对错');

    const timeout = mapModelError(new Error('model timeout'));
    expect(timeout.code).toBe(ERROR_CODES.MODEL_TIMEOUT);
    expect(timeout.message).toBe('这道题我没看清，麻烦你手动标一下对错');
  });

  it('toClientRecognitionItem 白名单：不下发 crop_url（存储字段）', () => {
    const view = toClientRecognitionItem({
      seq: 1,
      stem_excerpt: '题干…',
      kp_guess: 'math.cz.quadratic.extremum',
      student_answer: 'x=2',
      suggested_result: 'wrong',
      crop_url: 'local://paper/x/1.jpg',
    });
    expect(Object.keys(view).sort()).toEqual(
      ['kp_guess', 'seq', 'stem_excerpt', 'student_answer', 'suggested_result'].sort(),
    );
  });

  it('三条试卷路由已挂载且 /confirm 静态段先于 /:recognitionId（路由闭合核对）', () => {
    const routes = createRoutes().map((route) => `${route.method} ${route.pattern}`);

    expect(routes).toContain('POST /api/evidence/paper');
    expect(routes).toContain('GET /api/evidence/paper/:recognitionId');
    expect(routes.indexOf('POST /api/evidence/paper/confirm')).toBeLessThan(
      routes.indexOf('GET /api/evidence/paper/:recognitionId'),
    );
    expect(typeof upload).toBe('function');
  });
});
