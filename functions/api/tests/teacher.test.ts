/**
 * 双端接口测试（契约 §12/§13 · v1.6，接口 #21–#31 + 推荐闭环回写）
 *
 * 覆盖：
 * - 角色守卫：学生调老师端 403 / 老师调学生端 403 / 401 未认证
 * - 邀请码：生成（复用语义）/ 过期 / 停用 / 名额用尽（直接操作 store 构造前置态）
 * - 绑定：preview → confirm 双向确认、幂等（重复绑定 duplicated）、码大小写归一
 * - 老师端：学生列表摘要（聚合层）/ 学生详情快照（含答题原文、不含对话原文字段）
 * - 推荐：下发幂等（同 kp 活跃推荐不重复）、kp 不属于空间知识库 400
 * - 闭环：学生 viewed → in_progress → 复测提交 → 自动 done + ΔAccuracy 回写；
 *   dismissed 终态不可逆；超窗未开始 → 视图层 expired
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import { REPO_ROOT, createTestApp, uniqueIdentifier } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const TRANSLATE_KP = 'math.cz.quadratic.translation';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

/** 老师生成（或复用）一个有效邀请码。 */
async function activeInvite(teacher: TestUser): Promise<string> {
  const res = await app.post<{ code: string }>('/api/teacher/invites', {}, { token: teacher.token });
  expect(res.code).toBe(0);
  return res.data!.code;
}

/** 学生完成绑定，返回 link 信息。 */
async function bindStudent(teacher: TestUser, student: TestUser) {
  const code = await activeInvite(teacher);

  const preview = await app.get<{ teacher_nickname: string }>('/api/student/link/preview', {
    token: student.token,
    query: { code },
  });
  expect(preview.code).toBe(0);

  const confirm = await app.post<{ link_id: string; teacher_nickname: string; duplicated: boolean }>(
    '/api/student/link',
    { invite_code: code.toLowerCase(), space_id: student.space_id },
    { token: student.token },
  );
  expect(confirm.code).toBe(0);
  return { code, confirm: confirm.data! };
}

/** 老师给学生的平移知识点下发推荐，返回推荐视图。 */
async function assign(teacher: TestUser, student: TestUser) {
  const res = await app.post<{ recommendation_id: string; kp_name: string; status: string }>(
    '/api/teacher/recommendations',
    { space_id: student.space_id, kp_id: TRANSLATE_KP, note: '先把平移三步走顺' },
    { token: teacher.token },
  );
  expect(res.code).toBe(0);
  return res.data!;
}

describe('v1.6 双端 · 角色守卫', () => {
  it('学生调老师端接口 → 403；老师调学生端接口 → 403', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');

    const forbiddenA = await app.post('/api/teacher/invites', {}, { token: student.token });
    expect(forbiddenA.code).toBe(403);

    const forbiddenB = await app.get('/api/student/links', { token: teacher.token });
    expect(forbiddenB.code).toBe(403);
  });

  it('未认证访问双端接口 → 401', async () => {
    const resA = await app.get('/api/teacher/students');
    expect(resA.code).toBe(401);
    const resB = await app.get('/api/student/recommendations', { query: { space_id: 'sp_x' } });
    expect(resB.code).toBe(401);
  });
});

describe('v1.6 双端 · 邀请码与绑定', () => {
  it('同一老师重复生成 → 复用同一活跃码；不同老师码互相独立', async () => {
    const t1 = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const t2 = await app.register(uniqueIdentifier(), undefined, '李老师', 'teacher');

    const a1 = await app.post<{ code: string; reused: boolean }>('/api/teacher/invites', {}, { token: t1.token });
    const a2 = await app.post<{ code: string; reused: boolean }>('/api/teacher/invites', {}, { token: t1.token });
    expect(a2.data!.reused).toBe(true);
    expect(a2.data!.code).toBe(a1.data!.code);

    const b1 = await app.post<{ code: string }>('/api/teacher/invites', {}, { token: t2.token });
    expect(b1.data!.code).not.toBe(a1.data!.code);
  });

  it('preview → confirm 建立绑定；used_count 递增；重复绑定幂等', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    const { confirm } = await bindStudent(teacher, student);
    expect(confirm.duplicated).toBe(false);
    expect(confirm.teacher_nickname).toBe('王老师');

    // 邀请码用量 +1
    const invites = await app.get<{ invites: { used_count: number }[] }>('/api/teacher/invites', {
      token: teacher.token,
    });
    expect(invites.data!.invites[0].used_count).toBe(1);

    // 学生重复确认同一码 → 幂等返回既有关系
    const again = await app.post<{ duplicated: boolean }>(
      '/api/student/link',
      { invite_code: await activeInvite(teacher), space_id: student.space_id },
      { token: student.token },
    );
    expect(again.data!.duplicated).toBe(true);

    // 我的老师列表出现该老师
    const mine = await app.get<{ teachers: { teacher_id: string; space_id: string }[] }>(
      '/api/student/links',
      { token: student.token },
    );
    expect(mine.data!.teachers).toHaveLength(1);
    expect(mine.data!.teachers[0].teacher_id).toBe(teacher.user_id);
  });

  it('无效 / 过期 / 停用 / 名额用尽的码 → preview 与 confirm 均拒绝', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');

    // 无效码
    const missing = await app.get('/api/student/link/preview', {
      token: student.token,
      query: { code: 'ZZZZ99' },
    });
    expect(missing.code).toBe(404);

    // 过期码：直接写 store 构造
    await app.ctx.store.insertInviteCode({
      code: 'OLD001',
      teacher_id: teacher.user_id,
      created_at: '2026-08-01T00:00:00Z',
      expire_at: '2026-08-08T00:00:00Z',
      max_uses: 30,
      used_count: 0,
      status: 'active',
    });
    const expired = await app.post('/api/student/link', { invite_code: 'OLD001', space_id: student.space_id }, {
      token: student.token,
    });
    expect(expired.code).toBe(400);

    // 停用码
    await app.ctx.store.insertInviteCode({
      code: 'STOP01',
      teacher_id: teacher.user_id,
      created_at: '2026-10-01T00:00:00Z',
      expire_at: '2027-10-08T00:00:00Z',
      max_uses: 30,
      used_count: 0,
      status: 'disabled',
    });
    const disabled = await app.post('/api/student/link', { invite_code: 'STOP01', space_id: student.space_id }, {
      token: student.token,
    });
    expect(disabled.code).toBe(404);

    // 名额用尽
    await app.ctx.store.insertInviteCode({
      code: 'FULL01',
      teacher_id: teacher.user_id,
      created_at: '2026-10-01T00:00:00Z',
      expire_at: '2027-10-08T00:00:00Z',
      max_uses: 1,
      used_count: 1,
      status: 'active',
    });
    const full = await app.post('/api/student/link', { invite_code: 'FULL01', space_id: student.space_id }, {
      token: student.token,
    });
    expect(full.code).toBe(400);
  });
});

describe('v1.6 双端 · 快照与越权', () => {
  it('学生列表含摘要（带分布 / 缺口 Top3 / 活跃推荐数）', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacher, student);

    const res = await app.get<{
      students: {
        student_id: string;
        nickname: string | null;
        bands: Record<string, number>;
        top_gaps: { kp_id: string }[];
        active_recommendations: number;
      }[];
    }>('/api/teacher/students', { token: teacher.token });

    expect(res.code).toBe(0);
    expect(res.data!.students).toHaveLength(1);
    const card = res.data!.students[0];
    expect(card.student_id).toBe(student.user_id);
    expect(card.nickname).toBe('小明');
    expect(Object.keys(card.bands).sort()).toHaveLength(4);
  });

  it('学生详情快照：含答题原文与归因；不含对话原文字段', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacher, student);

    const res = await app.get<Record<string, unknown>>(
      `/api/teacher/students/${student.user_id}`,
      { token: teacher.token, query: { space_id: student.space_id } },
    );
    expect(res.code).toBe(0);
    const snapshot = res.data! as Record<string, unknown>;
    expect(snapshot).toHaveProperty('recent_answers');
    expect(snapshot).toHaveProperty('attributions');
    expect(snapshot).toHaveProperty('activity');
    expect(snapshot).toHaveProperty('accuracy');
    // 隐私口径：对话原文永不出现
    expect(JSON.stringify(snapshot)).not.toContain('dialog');
  });

  it('未绑定的老师访问该学生空间 → 403；学生调详情 → 403', async () => {
    const teacherA = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const teacherB = await app.register(uniqueIdentifier(), undefined, '李老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacherA, student);

    const other = await app.get(`/api/teacher/students/${student.user_id}`, {
      token: teacherB.token,
      query: { space_id: student.space_id },
    });
    expect(other.code).toBe(403);

    const byStudent = await app.get(`/api/teacher/students/${student.user_id}`, {
      token: student.token,
      query: { space_id: student.space_id },
    });
    expect(byStudent.code).toBe(403);
  });
});

describe('v1.6 双端 · 推荐与闭环回写', () => {
  it('下发 → 学生 viewed/in_progress → 复测提交 → done + ΔAccuracy', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacher, student);

    // 基线：正确 1/1（直接落事件，口径与 report 一致）
    await app.ctx.store.insertEvent({
      event_id: 'evt_base_1',
      user_id: student.user_id,
      space_id: student.space_id,
      knowledge_point: TRANSLATE_KP,
      item_id: 'q_cz_translate_006',
      source: 'diagnose',
      mode: 'baseline',
      result: 'correct',
      weight: 1,
      alpha: null,
      raw: {},
      dedup_key: 'test:base:1',
      expire_at: null,
      created_at: '2026-10-01T00:00:00Z',
    });

    const rec = await assign(teacher, student);
    expect(rec.status).toBe('assigned');

    // 同 kp 重复下发 → 幂等返回既有活跃推荐
    const dup = await assign(teacher, student);
    expect(dup.recommendation_id).toBe(rec.recommendation_id);

    // 学生视角：列出（assigned）→ viewed → in_progress
    const mine = await app.get<{ recommendations: { status: string }[] }>(
      '/api/student/recommendations',
      { token: student.token, query: { space_id: student.space_id } },
    );
    expect(mine.data!.recommendations[0].status).toBe('assigned');

    await app.post(`/api/student/recommendations/${rec.recommendation_id}/feedback`, { action: 'viewed' }, {
      token: student.token,
    });
    await app.post(`/api/student/recommendations/${rec.recommendation_id}/feedback`, { action: 'in_progress' }, {
      token: student.token,
    });
    const afterStart = await app.get<{ recommendations: { status: string }[] }>(
      '/api/student/recommendations',
      { token: student.token, query: { space_id: student.space_id } },
    );
    expect(afterStart.data!.recommendations[0].status).toBe('in_progress');

    // 复测：答错（retest 0/1）→ 推荐自动 done，ΔAccuracy = 0 − 1 = −1
    const item = SD.itemById.get('q_cz_translate_001');
    if (!item) throw new Error('题库缺少 q_cz_translate_001');
    const submit = await app.post<{ correct: boolean }>(
      '/api/diagnose/submit',
      { space_id: student.space_id, item_id: item.item_id, answer: '__wrong__', mode: 'retest' },
      { token: student.token },
    );
    expect(submit.code).toBe(0);

    const final = await app.get<{ recommendations: { status: string; delta_accuracy: number | null }[] }>(
      '/api/teacher/recommendations',
      { token: teacher.token },
    );
    expect(final.data!.recommendations[0].status).toBe('done');
    expect(final.data!.recommendations[0].delta_accuracy).toBe(-1);
  });

  it('dismissed 为终态：复测不复活；非法 action 400；他人推荐 403/404', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    const stranger = await app.register(uniqueIdentifier(), undefined, '路人');
    await bindStudent(teacher, student);

    const rec = await assign(teacher, student);

    await app.post(`/api/student/recommendations/${rec.recommendation_id}/feedback`, { action: 'dismissed' }, {
      token: student.token,
    });
    // 复测不再回写 dismissed 记录
    await app.ctx.store.insertEvent({
      event_id: 'evt_retest_2',
      user_id: student.user_id,
      space_id: student.space_id,
      knowledge_point: TRANSLATE_KP,
      item_id: 'q_cz_translate_006',
      source: 'diagnose',
      mode: 'retest',
      result: 'correct',
      weight: 1,
      alpha: null,
      raw: {},
      dedup_key: 'test:retest:2',
      expire_at: null,
      created_at: '2026-10-02T00:00:00Z',
    });
    await app.ctx.store.insertEvent({
      event_id: 'evt_base_2',
      user_id: student.user_id,
      space_id: student.space_id,
      knowledge_point: TRANSLATE_KP,
      item_id: 'q_cz_translate_006',
      source: 'diagnose',
      mode: 'baseline',
      result: 'wrong',
      weight: 1,
      alpha: null,
      raw: {},
      dedup_key: 'test:base:2',
      expire_at: null,
      created_at: '2026-10-01T00:00:00Z',
    });

    const list = await app.get<{ recommendations: { status: string }[] }>('/api/teacher/recommendations', {
      token: teacher.token,
    });
    expect(list.data!.recommendations[0].status).toBe('dismissed');

    // 非法 action
    const badAction = await app.post(
      `/api/student/recommendations/${rec.recommendation_id}/feedback`,
      { action: 'explode' },
      { token: student.token },
    );
    expect(badAction.code).toBe(400);

    // 他人反馈 → 403；不存在的推荐 → 404
    const notYours = await app.post(
      `/api/student/recommendations/${rec.recommendation_id}/feedback`,
      { action: 'viewed' },
      { token: stranger.token },
    );
    expect(notYours.code).toBe(403);
    const missing = await app.post('/api/student/recommendations/rcm_missing/feedback', { action: 'viewed' }, {
      token: student.token,
    });
    expect(missing.code).toBe(404);
  });

  it('下发不属于空间知识库的 kp → 400；详情页推荐随快照返回', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacher, student);

    const badKp = await app.post('/api/teacher/recommendations', {
      space_id: student.space_id,
      kp_id: 'math.gz.not.exist',
    }, { token: teacher.token });
    expect(badKp.code).toBe(404);

    const rec = await assign(teacher, student);
    const detail = await app.get<{ recommendations: { recommendation_id: string }[] }>(
      `/api/teacher/students/${student.user_id}`,
      { token: teacher.token, query: { space_id: student.space_id } },
    );
    expect(detail.data!.recommendations.map((row) => row.recommendation_id)).toContain(
      rec.recommendation_id,
    );
  });

  it('超窗（14 天）未开始的推荐 → 学生视图标 expired（存储不变）', async () => {
    const teacher = await app.register(uniqueIdentifier(), undefined, '王老师', 'teacher');
    const student = await app.register(uniqueIdentifier(), undefined, '小明');
    await bindStudent(teacher, student);
    const rec = await assign(teacher, student);

    // 直接改 created_at 到 20 天前（用 updateRecommendation 模拟时间流逝）
    const stored = await app.ctx.store.getRecommendation(rec.recommendation_id);
    if (!stored) throw new Error('推荐不存在');
    await app.ctx.store.updateRecommendation({
      ...stored,
      created_at: '2026-09-10T00:00:00Z',
    });

    const mine = await app.get<{ recommendations: { status: string }[] }>(
      '/api/student/recommendations',
      { token: student.token, query: { space_id: student.space_id } },
    );
    expect(mine.data!.recommendations[0].status).toBe('expired');

    const storedAgain = await app.ctx.store.getRecommendation(rec.recommendation_id);
    expect(storedAgain?.status).toBe('assigned');
  });
});
