/**
 * 老师端服务（契约 §12 · v1.6 双端，接口 #21–#26）
 *
 * 职责：邀请码 / 学生列表 / 学生详情快照 / 推荐下发与查询。
 * 隐私口径（TEACHER_PORTAL_DESIGN §1.3，2026-10-08 修订）：老师可见**聚合掌握度、
 * 趋势、行为计数与答卷/答题/错题原文**（批改讲评必需）；**对话原文不下发**。
 *
 * 权限纪律（三条守卫，全部服务端强制）：
 *   1. requireTeacher —— 老师端接口仅 role=teacher 可调（403）；
 *   2. requireLinkedSpace —— 访问的学生空间必须存在有效绑定（403）；
 *   3. 快照由本文件专用序列化函数产出（白名单字段逐一内联），不走学生端序列化路径。
 */

import { randomInt } from 'node:crypto';

import { masteryToBand } from '../../../../packages/engine/src/index';

import { ctxNowIso, ok } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import { userRoleOf } from '../db/types';
import type {
  AttributionRecord,
  InviteCodeRecord,
  LinkRecord,
  MasteryProfileRecord,
  RecognitionRecord,
  RecommendationRecord,
  SpaceRecord,
  UserRecord,
} from '../db/types';
import { authedUser } from './auth';
import { GAP_THRESHOLD } from './report';

/** 邀请码默认有效期（天）与容量（TEACHER_PORTAL_DESIGN §2.1）。 */
export const INVITE_TTL_DAYS = 7;
export const INVITE_MAX_USES = 30;
/** 无歧义字母表：去掉 0/O/1/I，家长群手抄不出错。 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// ---------------------------------------------------------------- 守卫

/** 守卫 1：老师端接口仅 role=teacher 可调。 */
export async function requireTeacher(req: RouteRequest, ctx: AppContext): Promise<UserRecord> {
  const user = await authedUser(req, ctx);
  if (userRoleOf(user) !== 'teacher') {
    throw httpError.forbidden('该接口仅教师账号可用');
  }
  return user;
}

/** 守卫 2：学生空间必须与该老师存在有效绑定；空间不存在 404、未绑定 403。 */
export async function requireLinkedSpace(
  ctx: AppContext,
  teacherId: string,
  spaceId: string,
): Promise<{ space: SpaceRecord; student: UserRecord; link: LinkRecord }> {
  const space = await ctx.store.getSpace(spaceId);
  if (!space) throw httpError.notFound('空间不存在');
  const student = await ctx.store.findUserById(space.user_id);
  if (!student) throw httpError.notFound('学生不存在');
  const links = await ctx.store.listLinksByTeacher(teacherId);
  const link = links.find((row) => row.space_id === spaceId);
  if (!link) throw httpError.forbidden('该学生未绑定到你（或绑定已解除）');
  return { space, student, link };
}

function readSpaceId(source: Record<string, unknown> | Record<string, string>): string | null {
  const value = 'space_id' in source ? source.space_id : undefined;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

// ---------------------------------------------------------- 快照聚合（白名单）

/** 状态带名与 engine.masteryToBand 同源（待巩固/不稳定/基本掌握/已掌握）。 */
const BAND_KEYS = ['待巩固', '不稳定', '基本掌握', '已掌握'] as const;
type BandKey = (typeof BAND_KEYS)[number];

function bandCounts(profiles: MasteryProfileRecord[], totalKp: number): Record<BandKey, number> {
  const counts: Record<BandKey, number> = { 待巩固: 0, 不稳定: 0, 基本掌握: 0, 已掌握: 0 };
  for (const profile of profiles) {
    const band = masteryToBand(profile.mastery) as BandKey;
    if (band in counts) counts[band] += 1;
  }
  // 无记录的知识点按 mastery=0 口径归带（与报告页 mastery=0 → 待巩固 一致）
  const recorded = profiles.length;
  if (recorded < totalKp) {
    counts[masteryToBand(0) as BandKey] += totalKp - recorded;
  }
  return counts;
}

function avgMastery(profiles: MasteryProfileRecord[], totalKp: number): number {
  if (totalKp === 0) return 0;
  const sum = profiles.reduce((acc, row) => acc + row.mastery, 0);
  return Math.round((sum / totalKp) * 1000) / 1000;
}

/** 最近 N 天逐日证据数（活跃趋势；空日期补 0）。 */
function activitySeries(
  events: { created_at: string }[],
  ctx: AppContext,
  days: number,
): { date: string; count: number }[] {
  const byDay = new Map<string, number>();
  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const series: { date: string; count: number }[] = [];
  const nowMs = ctx.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(nowMs - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    series.push({ date, count: byDay.get(date) ?? 0 });
  }
  return series;
}

/** 学生摘要（列表卡片）：聚合层——不含任何原文。 */
export async function studentSummary(
  ctx: AppContext,
  student: UserRecord,
  space: SpaceRecord,
  link: LinkRecord,
  recommendations: RecommendationRecord[],
) {
  const profiles = await ctx.store.listProfiles(student.user_id, space.space_id);
  const events = await ctx.store.listEventsBySpace(space.space_id);
  const nodes = ctx.data.nodesForKb(space.knowledge_source[0]);

  const masteryByKp = new Map(profiles.map((row) => [row.knowledge_point, row.mastery]));
  const gaps = nodes
    .map((node) => ({ kp_id: node.id, name: node.name, mastery: masteryByKp.get(node.id) ?? 0 }))
    .filter((row) => row.mastery < GAP_THRESHOLD)
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3)
    .map((row) => ({ kp_id: row.kp_id, name: row.name, mastery: row.mastery }));

  const lastActive = events.reduce<string | null>(
    (acc, event) => (acc === null || event.created_at > acc ? event.created_at : acc),
    null,
  );
  const activeRecs = recommendations.filter((row) =>
    ['assigned', 'viewed', 'in_progress'].includes(row.status),
  ).length;

  return {
    student_id: student.user_id,
    nickname: student.nickname,
    space_id: space.space_id,
    space_name: space.name,
    linked_at: link.created_at,
    kp_total: nodes.length,
    bands: bandCounts(profiles, nodes.length),
    avg_mastery: avgMastery(profiles, nodes.length),
    top_gaps: gaps,
    last_active_at: lastActive,
    active_recommendations: activeRecs,
  };
}

/** 归因的路径翻译成知识点名（老师端可读）。 */
function attributionView(ctx: AppContext, attribution: AttributionRecord) {
  const nameOf = (kpId: string) => ctx.data.nodeById.get(kpId)?.name ?? kpId;
  return {
    attribution_id: attribution.attribution_id,
    from_kp: nameOf(attribution.from_kp),
    root_cause: nameOf(attribution.root_cause),
    error_type: attribution.error_type,
    path: attribution.path.map(nameOf),
    verified: attribution.verified,
    rejected_by_student: attribution.rejected_by_student,
    created_at: attribution.created_at,
  };
}

/** 试卷识别的错题条目（答卷原文口径）。 */
function recognitionView(recognition: RecognitionRecord) {
  return {
    recognition_id: recognition.recognition_id,
    status: recognition.status,
    created_at: recognition.created_at,
    wrong_items: recognition.items
      .filter((item) => item.suggested_result !== 'correct')
      .map((item) => ({
        stem_excerpt: item.stem_excerpt,
        kp_guess: item.kp_guess,
        student_answer: item.student_answer,
        suggested_result: item.suggested_result,
      })),
  };
}

/** 学生详情快照（详情层）：含答卷/答题/错题原文（教学必需），不含对话原文。 */
export async function studentDetailSnapshot(
  ctx: AppContext,
  student: UserRecord,
  space: SpaceRecord,
  link: LinkRecord,
  recommendations: RecommendationRecord[],
) {
  const profiles = await ctx.store.listProfiles(student.user_id, space.space_id);
  const events = await ctx.store.listEventsBySpace(space.space_id);
  const logs = await ctx.store.listLogsBySpace(space.space_id);
  const attributions = await ctx.store.listAttributionsBySpace(space.space_id);
  // 口径说明：dialogs（对话原文）不进快照——老师端只看答卷/答题/错题原文与聚合层。

  const kbId = space.knowledge_source[0];
  const nodes = ctx.data.nodesForKb(kbId);
  const masteryByKp = new Map(profiles.map((row) => [row.knowledge_point, row.mastery]));

  const mastery = nodes.map((node) => {
    const value = masteryByKp.get(node.id) ?? 0;
    return { kp_id: node.id, name: node.name, mastery: value, status_band: masteryToBand(value) };
  });
  const gaps = mastery
    .filter((row) => row.mastery < GAP_THRESHOLD)
    .map((row) => ({
      kp_id: row.kp_id,
      name: row.name,
      mastery: row.mastery,
      error_type_last:
        attributions
          .filter((row2) => row2.from_kp === row.kp_id)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.error_type ?? null,
    }));

  // accuracy：与 report.ts 同口径（source=diagnose，baseline/retest 分组）
  const counters = new Map<string, { baseline: { c: number; t: number }; retest: { c: number; t: number } }>();
  for (const event of events) {
    if (event.source !== 'diagnose') continue;
    if (event.mode !== 'baseline' && event.mode !== 'retest') continue;
    const bucket =
      counters.get(event.knowledge_point) ??
      { baseline: { c: 0, t: 0 }, retest: { c: 0, t: 0 } };
    const target = event.mode === 'baseline' ? bucket.baseline : bucket.retest;
    target.t += 1;
    if (event.result === 'correct') target.c += 1;
    counters.set(event.knowledge_point, bucket);
  }
  const accuracy = nodes
    .filter((node) => counters.has(node.id))
    .map((node) => {
      const bucket = counters.get(node.id)!;
      const baseline = bucket.baseline.t > 0 ? bucket.baseline.c / bucket.baseline.t : null;
      const retest = bucket.retest.t > 0 ? bucket.retest.c / bucket.retest.t : null;
      return {
        kp_id: node.id,
        name: node.name,
        baseline,
        retest,
        delta: baseline !== null && retest !== null ? retest - baseline : null,
      };
    });

  // 行为计数
  const bySource = { self_report: 0, diagnose: 0, paper: 0, silent: 0 } as Record<string, number>;
  for (const event of events) bySource[event.source] += 1;
  const chatRounds = 0; // 对话内容不下发，仅给出行为计数占位（详见快照口径注释）

  // 答题原文：最近 20 条诊断/试卷证据（对错 + 学生原答 + 错误码）
  const recent_answers = events
    .filter((event) => event.source === 'diagnose' || event.source === 'paper')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 20)
    .map((event) => ({
      created_at: event.created_at,
      source: event.source,
      mode: event.mode,
      kp: ctx.data.nodeById.get(event.knowledge_point)?.name ?? event.knowledge_point,
      item_id: event.item_id,
      result: event.result,
      student_answer:
        typeof event.raw.student_answer === 'string' ? event.raw.student_answer : null,
      matched_error_code:
        typeof event.raw.matched_error_code === 'string' ? event.raw.matched_error_code : null,
    }));

  const masterySum = nodes.reduce(
    (acc, node) => acc + (masteryByKp.get(node.id) ?? 0),
    0,
  );

  return {
    student: {
      student_id: student.user_id,
      nickname: student.nickname,
      space_id: space.space_id,
      space_name: space.name,
      linked_at: link.created_at,
    },
    summary: {
      kp_total: nodes.length,
      bands: bandCounts(profiles, nodes.length),
      avg_mastery: nodes.length > 0 ? Math.round((masterySum / nodes.length) * 1000) / 1000 : 0,
      behavior: { ...bySource, chat_rounds: chatRounds, attributions: attributions.length },
      mastery_log_count: logs.length,
    },
    activity: activitySeries(events, ctx, 7),
    mastery,
    gaps,
    accuracy,
    recent_answers,
    attributions: attributions
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((row) => attributionView(ctx, row)),
    paper_recognitions: (await listRecognitions(ctx, space.space_id)).map(recognitionView),
    recommendations: recommendations
      .filter((row) => row.space_id === space.space_id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(recommendationView),
  };
}

async function listRecognitions(ctx: AppContext, _spaceId: string): Promise<RecognitionRecord[]> {
  // 试卷识别记录按 space 过滤：Store 未提供列表方法，试卷三接口亦未暴露全量——
  // v1.6 先按「无列表即空」处理，接线 CloudBase 时补 where({ space_id }).get()。
  void ctx;
  void _spaceId;
  return [];
}

/** 推荐的学生端视图（老师端列表与学生端共用字段口径）。 */
export function recommendationView(row: RecommendationRecord) {
  return {
    recommendation_id: row.recommendation_id,
    student_id: row.student_id,
    kp_id: row.kp_id,
    kp_name: row.kp_name,
    note: row.note,
    status: row.status,
    delta_accuracy: row.delta_accuracy,
    viewed_at: row.viewed_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------- 端点

/** #21 POST /api/teacher/invites —— 生成绑定邀请码。 */
export async function createInvite(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const nowMs = ctx.now();

  // 同一老师已有未过期、未满额、active 的码 → 直接复用（码是通道不是凭证，复用避免群刷）
  const existing = (await ctx.store.listInviteCodesByTeacher(teacher.user_id)).find(
    (row) => row.status === 'active' && row.expire_at > ctxNowIso(ctx) && row.used_count < row.max_uses,
  );
  if (existing) {
    return ok({ code: existing.code, expire_at: existing.expire_at, reused: true });
  }

  let code = generateInviteCode();
  while (await ctx.store.getInviteCode(code)) code = generateInviteCode();

  const record: InviteCodeRecord = {
    code,
    teacher_id: teacher.user_id,
    created_at: nowIsoOf(nowMs),
    expire_at: new Date(nowMs + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z'),
    max_uses: INVITE_MAX_USES,
    used_count: 0,
    status: 'active',
  };
  await ctx.store.insertInviteCode(record);
  return ok({ code: record.code, expire_at: record.expire_at, reused: false });
}

function nowIsoOf(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** #22 GET /api/teacher/invites —— 我的邀请码列表。 */
export async function listInvites(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const rows = await ctx.store.listInviteCodesByTeacher(teacher.user_id);
  return ok({
    invites: rows
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((row) => ({
        code: row.code,
        created_at: row.created_at,
        expire_at: row.expire_at,
        used_count: row.used_count,
        max_uses: row.max_uses,
        status: row.status,
      })),
  });
}

/** #23 GET /api/teacher/students —— 学生卡片墙。 */
export async function listStudents(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const links = await ctx.store.listLinksByTeacher(teacher.user_id);

  const summaries = await Promise.all(
    links.map(async (link) => {
      const space = await ctx.store.getSpace(link.space_id);
      const student = await ctx.store.findUserById(link.student_id);
      if (!space || !student) return null;
      const recs = await ctx.store.listRecommendationsByTeacher(teacher.user_id);
      return studentSummary(ctx, student, space, link, recs);
    }),
  );

  const students = summaries
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => (a.linked_at < b.linked_at ? 1 : -1));
  return ok({ students, total: students.length });
}

/** #24 GET /api/teacher/students/:studentId?space_id=xxx —— 学生详情快照。 */
export async function getStudent(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const spaceId = req.query.space_id ?? readSpaceId(req.body);
  if (!spaceId) throw httpError.badRequest('缺少 space_id');
  const { space, student, link } = await requireLinkedSpace(ctx, teacher.user_id, spaceId);
  if (student.user_id !== req.params.studentId) {
    throw httpError.badRequest('student_id 与空间归属不一致');
  }
  const recs = await ctx.store.listRecommendationsByTeacher(teacher.user_id);
  return ok(await studentDetailSnapshot(ctx, student, space, link, recs));
}

/** #25 POST /api/teacher/recommendations —— 下发推荐。 */
export async function assignRecommendation(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const spaceId = readSpaceId(req.body);
  if (!spaceId) throw httpError.badRequest('缺少 space_id');
  const { space, student, link } = await requireLinkedSpace(ctx, teacher.user_id, spaceId);

  const kpId = req.body.kp_id;
  if (typeof kpId !== 'string' || kpId.length === 0) {
    throw httpError.badRequest('缺少 kp_id');
  }
  const node = ctx.data.nodeById.get(kpId);
  if (!node) throw httpError.notFound('知识点不存在');
  if (!space.knowledge_source.some((kb) => ctx.data.nodesForKb(kb).some((n) => n.id === kpId))) {
    throw httpError.badRequest('该知识点不属于该空间的知识库');
  }
  const noteRaw = req.body.note;
  if (noteRaw !== undefined && noteRaw !== null && typeof noteRaw !== 'string') {
    throw httpError.badRequest('note 必须是字符串');
  }
  const note = typeof noteRaw === 'string' ? noteRaw.slice(0, 200) : '';

  // 幂等：同一学生/空间/知识点已有未完结推荐 → 返回既有记录（不重复下发）
  const recs = await ctx.store.listRecommendationsByTeacher(teacher.user_id);
  const duplicate = recs.find(
    (row) =>
      row.student_id === student.user_id &&
      row.space_id === space.space_id &&
      row.kp_id === kpId &&
      ['assigned', 'viewed', 'in_progress'].includes(row.status),
  );
  if (duplicate) return ok(recommendationView(duplicate));

  const record: RecommendationRecord = {
    recommendation_id: newId('rcm_'),
    teacher_id: teacher.user_id,
    student_id: student.user_id,
    space_id: space.space_id,
    link_id: link.link_id,
    kp_id: kpId,
    kp_name: node.name,
    note,
    status: 'assigned',
    viewed_at: null,
    started_at: null,
    finished_at: null,
    delta_accuracy: null,
    created_at: ctxNowIso(ctx),
  };
  await ctx.store.insertRecommendation(record);
  return ok(recommendationView(record));
}

/** #26 GET /api/teacher/recommendations?student_id=&space_id= —— 我的推荐（可按学生/空间过滤）。 */
export async function listRecommendations(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const teacher = await requireTeacher(req, ctx);
  const links = await ctx.store.listLinksByTeacher(teacher.user_id);
  const linkedSpaceIds = new Set(links.map((row) => row.space_id));

  let rows = await ctx.store.listRecommendationsByTeacher(teacher.user_id);
  const studentId = req.query.student_id;
  if (typeof studentId === 'string' && studentId.length > 0) {
    rows = rows.filter((row) => row.student_id === studentId);
  }
  const spaceId = req.query.space_id;
  if (typeof spaceId === 'string' && spaceId.length > 0) {
    rows = rows.filter((row) => row.space_id === spaceId);
  }

  return ok({
    recommendations: rows
      .filter((row) => linkedSpaceIds.has(row.space_id))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(recommendationView),
  });
}
