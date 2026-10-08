/**
 * 学生端服务（契约 §13 · v1.6 双端，接口 #27–#31）
 *
 * 职责：邀请码绑定（双向确认的确认侧）/ 我的老师 / 我的推荐 / 推荐反馈。
 *
 * 双向确认纪律（未成年人数据保护，TEACHER_PORTAL_DESIGN §2.2）：
 *   学生输入邀请码后先走 preview（只回老师昵称与绑定范围说明），由学生显式
 *   confirm 才建立绑定——服务端绝不因「码有效」而静默建立师生关系。
 *
 * 推荐闭环：assigned → viewed → in_progress → done（ΔAccuracy 由 diagnose
 * 复测钩子自动回写）/ dismissed；expired 由读取侧按 created_at 惰性判定
 * （> 14 天且未开始 → 视图标记 expired，不回写存储，保持记录可审计）。
 */

import { ctxNowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import { userRoleOf } from '../db/types';
import type { RecommendationRecord, RecommendationStatus } from '../db/types';
import { authedUser } from './auth';
import { recommendationView } from './teacher';

/** 推荐过期窗口（天）：超窗未开始 → 学生端视图标 expired。 */
const REC_EXPIRE_DAYS = 14;

/** 守卫 3：学生端接口仅 role=student 可调（老师不能反向绑定/刷学生推荐）。 */
async function requireStudent(req: RouteRequest, ctx: AppContext) {
  const user = await authedUser(req, ctx);
  if (userRoleOf(user) !== 'student') {
    throw httpError.forbidden('该接口仅学生账号可用');
  }
  return user;
}

/** 读取侧惰性过期：超窗且未开始 → 视图层标 expired（不改存储）。 */
export function effectiveStatus(row: RecommendationRecord, nowMs: number): RecommendationStatus {
  if (row.status === 'assigned' || row.status === 'viewed' || row.status === 'in_progress') {
    const ageMs = nowMs - Date.parse(row.created_at).valueOf();
    if (Number.isFinite(ageMs) && ageMs > REC_EXPIRE_DAYS * 24 * 60 * 60 * 1000) {
      return 'expired';
    }
  }
  return row.status;
}

/** #27 GET /api/student/link/preview?code=XXX —— 绑定前预览（双向确认第一步）。 */
export async function previewLink(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  await requireStudent(req, ctx);
  const code = req.query.code;
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw httpError.badRequest('缺少邀请码');
  }

  const invite = await ctx.store.getInviteCode(code.trim().toUpperCase());
  if (!invite || invite.status !== 'active') {
    throw httpError.notFound('邀请码不存在或已停用');
  }
  if (invite.expire_at <= ctxNowIso(ctx)) {
    throw httpError.badRequest('邀请码已过期，请找老师重新生成');
  }
  if (invite.used_count >= invite.max_uses) {
    throw httpError.badRequest('邀请码名额已用完，请找老师重新生成');
  }

  const teacher = await ctx.store.findUserById(invite.teacher_id);
  if (!teacher) throw httpError.notFound('邀请码不存在或已停用');

  return ok({
    code: invite.code,
    teacher_id: teacher.user_id,
    teacher_nickname: teacher.nickname ?? '老师',
    expire_at: invite.expire_at,
  });
}

/** #28 POST /api/student/link —— 确认绑定（双向确认第二步）。 */
export async function confirmLink(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const student = await requireStudent(req, ctx);

  const codeRaw = req.body.invite_code;
  if (typeof codeRaw !== 'string' || codeRaw.trim().length === 0) {
    throw httpError.badRequest('缺少邀请码');
  }
  const space = await requireSpaceOwnership(ctx, student.user_id, req.body.space_id);

  const code = codeRaw.trim().toUpperCase();
  const invite = await ctx.store.getInviteCode(code);
  if (!invite || invite.status !== 'active') {
    throw httpError.notFound('邀请码不存在或已停用');
  }
  if (invite.expire_at <= ctxNowIso(ctx)) {
    throw httpError.badRequest('邀请码已过期，请找老师重新生成');
  }
  if (invite.used_count >= invite.max_uses) {
    throw httpError.badRequest('邀请码名额已用完，请找老师重新生成');
  }

  // 幂等：同学生同空间已绑定同一位老师 → 直接返回既有关系
  const existing = await ctx.store.findLinkByStudentAndSpace(student.user_id, space.space_id);
  const already = existing.find((row) => row.teacher_id === invite.teacher_id);
  if (already) {
    return ok({ link_id: already.link_id, teacher_id: already.teacher_id, duplicated: true });
  }

  const link = {
    link_id: newId('lnk_'),
    teacher_id: invite.teacher_id,
    student_id: student.user_id,
    space_id: space.space_id,
    created_at: ctxNowIso(ctx),
  };
  await ctx.store.insertLink(link);
  invite.used_count += 1;
  await ctx.store.updateInviteCode(invite);
  const teacher = await ctx.store.findUserById(invite.teacher_id);
  return ok({
    link_id: link.link_id,
    teacher_id: link.teacher_id,
    teacher_nickname: teacher?.nickname ?? '老师',
    space_id: space.space_id,
    duplicated: false,
  });
}

/** #29 GET /api/student/links —— 我的老师列表。 */
export async function listMyTeachers(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const student = await requireStudent(req, ctx);
  const links = await ctx.store.listLinksByStudent(student.user_id);

  const teachers = await Promise.all(
    links.map(async (link) => {
      const teacher = await ctx.store.findUserById(link.teacher_id);
      const space = await ctx.store.getSpace(link.space_id);
      if (!teacher) return null;
      return {
        link_id: link.link_id,
        teacher_id: teacher.user_id,
        teacher_nickname: teacher.nickname ?? '老师',
        space_id: link.space_id,
        space_name: space?.name ?? '',
        linked_at: link.created_at,
      };
    }),
  );

  return ok({
    teachers: teachers.filter((row): row is NonNullable<typeof row> => row !== null),
  });
}

/** #30 GET /api/student/recommendations?space_id= —— 我的推荐（按当前空间过滤）。 */
export async function listMyRecommendations(
  req: RouteRequest,
  ctx: AppContext,
): Promise<ApiResponse> {
  const student = await requireStudent(req, ctx);
  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  await requireSpaceOwnership(ctx, student.user_id, spaceId);

  const rows = await ctx.store.listRecommendationsByStudent(student.user_id);
  const nowMs = ctx.now();
  return ok({
    recommendations: rows
      .filter((row) => row.space_id === spaceId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map((row) => ({ ...recommendationView(row), status: effectiveStatus(row, nowMs) })),
  });
}

const FEEDBACK_TRANSITIONS: Record<string, RecommendationStatus> = {
  viewed: 'viewed',
  in_progress: 'in_progress',
  dismissed: 'dismissed',
};

/**
 * 复测闭环回写钩子（diagnose submit 在 mode=retest 落库后调用）：
 * 对该学生/空间/知识点的未完结推荐重算 ΔAccuracy（retest 正确率 − baseline 正确率，
 * 与 report.ts 同口径），首次回写即置 done。ΔAccuracy 随后续复测继续更新（记录已终态，
 * 仅刷新 delta 与 finished_at，状态保持 done）。
 */
export async function writebackOnRetest(
  ctx: AppContext,
  studentId: string,
  spaceId: string,
  kpId: string,
  nowIso: string,
): Promise<void> {
  // 与 report.ts 同口径的 baseline/retest 正确率
  const counters = { baseline: { c: 0, t: 0 }, retest: { c: 0, t: 0 } };
  for (const event of await ctx.store.listEventsBySpace(spaceId)) {
    if (event.source !== 'diagnose') continue;
    if (event.knowledge_point !== kpId) continue;
    if (event.mode !== 'baseline' && event.mode !== 'retest') continue;
    const bucket = event.mode === 'baseline' ? counters.baseline : counters.retest;
    bucket.t += 1;
    if (event.result === 'correct') bucket.c += 1;
  }
  if (counters.retest.t === 0 || counters.baseline.t === 0) return;
  const delta =
    Math.round((counters.retest.c / counters.retest.t - counters.baseline.c / counters.baseline.t) * 1000) / 1000;

  const recs = await ctx.store.listRecommendationsByStudent(studentId);
  for (const rec of recs) {
    if (rec.space_id !== spaceId || rec.kp_id !== kpId) continue;
    if (rec.status === 'dismissed') continue;
    const firstDone = rec.status !== 'done';
    await ctx.store.updateRecommendation({
      ...rec,
      status: 'done',
      delta_accuracy: delta,
      finished_at: firstDone ? nowIso : rec.finished_at,
    });
  }
}

/** #31 POST /api/student/recommendations/:recommendationId/feedback —— 学生反馈推进闭环。 */
export async function recommendationFeedback(
  req: RouteRequest,
  ctx: AppContext,
): Promise<ApiResponse> {
  const student = await requireStudent(req, ctx);
  const action = req.body.action;
  if (typeof action !== 'string' || !(action in FEEDBACK_TRANSITIONS)) {
    throw httpError.badRequest('action 必须是 viewed | in_progress | dismissed');
  }

  const rec = await ctx.store.getRecommendation(req.params.recommendationId);
  if (!rec) throw httpError.notFound('推荐不存在');
  if (rec.student_id !== student.user_id) throw httpError.forbidden('该推荐不属于你');

  // 终态不可逆：done / dismissed / expired 均不再变更
  if (['done', 'dismissed', 'expired'].includes(rec.status)) {
    return ok(recommendationView(rec));
  }

  const target = FEEDBACK_TRANSITIONS[action];
  const now = ctxNowIso(ctx);
  const updated: RecommendationRecord = { ...rec, status: target };
  if (target === 'viewed' && !rec.viewed_at) updated.viewed_at = now;
  if (target === 'in_progress') {
    if (!rec.viewed_at) updated.viewed_at = now;
    if (!rec.started_at) updated.started_at = now;
  }
  if (target === 'dismissed') updated.finished_at = now;

  await ctx.store.updateRecommendation(updated);
  return ok(recommendationView(updated));
}
