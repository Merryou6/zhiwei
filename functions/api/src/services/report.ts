/**
 * 学习报告服务（契约 §10，接口 #19 GET /api/report/summary?space_id=xxx；D12）
 *
 * - mastery：输出全部 20 节点（无 mastery_profiles 记录者 mastery=0、
 *   status_band="待巩固"——语义成立：低于剪枝阈值即不可作为合格先修），供图谱四色着色
 * - status_band：用 engine.masteryToBand（状态带唯一来源）
 * - gaps：mastery < 0.4 清单；error_type_last 取该 kp 最近一条 attributions 的 error_type
 *   （九张表中只有 attributions 持久化 error_type），无归因记录 → null
 * - accuracy：按 evidence_events(source="diagnose") 分组——mode=baseline 算基线正确率、
 *   mode=retest 算复测正确率，delta = retest − baseline；
 *   单侧缺失 → 该侧 null 且 delta null；双侧皆无 → 该 kp 不进 accuracy 列表
 */

import { masteryToBand } from '../../../../packages/engine/src/index';

import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import type { ErrorType } from '../data/staticData';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

/** gaps 的掌握度阈值（ALGORITHM §6 待巩固区间上界）。 */
export const GAP_THRESHOLD = 0.4;

export interface MasteryRow {
  kp_id: string;
  name: string;
  mastery: number;
  status_band: string;
}

export interface GapRow {
  kp_id: string;
  name: string;
  mastery: number;
  error_type_last: ErrorType | null;
}

export interface AccuracyRow {
  kp_id: string;
  baseline: number | null;
  retest: number | null;
  delta: number | null;
}

interface ModeCounter {
  correct: number;
  total: number;
}

export async function summary(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const space = await requireSpaceOwnership(ctx, user.user_id, spaceId);

  const profiles = await ctx.store.listProfiles(user.user_id, space.space_id);
  const masteryByKp = new Map(profiles.map((profile) => [profile.knowledge_point, profile.mastery]));

  // ---- mastery + gaps
  const mastery: MasteryRow[] = ctx.data.nodes.map((node) => {
    const value = masteryByKp.get(node.id) ?? 0;
    return {
      kp_id: node.id,
      name: node.name,
      mastery: value,
      status_band: masteryToBand(value),
    };
  });

  // error_type_last：该 kp 最近一条归因记录（created_at 最大者）
  const lastErrorType = new Map<string, { error_type: ErrorType; created_at: string }>();
  for (const attribution of await ctx.store.listAttributionsBySpace(space.space_id)) {
    const previous = lastErrorType.get(attribution.from_kp);
    if (!previous || attribution.created_at > previous.created_at) {
      lastErrorType.set(attribution.from_kp, {
        error_type: attribution.error_type,
        created_at: attribution.created_at,
      });
    }
  }

  const gaps: GapRow[] = mastery
    .filter((row) => row.mastery < GAP_THRESHOLD)
    .map((row) => ({
      kp_id: row.kp_id,
      name: row.name,
      mastery: row.mastery,
      error_type_last: lastErrorType.get(row.kp_id)?.error_type ?? null,
    }));

  // ---- accuracy：按 mode 分组
  const counters = new Map<string, { baseline: ModeCounter; retest: ModeCounter }>();
  for (const event of await ctx.store.listEventsBySpace(space.space_id)) {
    if (event.source !== 'diagnose') continue;
    if (event.mode !== 'baseline' && event.mode !== 'retest') continue;

    const bucket =
      counters.get(event.knowledge_point) ??
      { baseline: { correct: 0, total: 0 }, retest: { correct: 0, total: 0 } };
    const target = event.mode === 'baseline' ? bucket.baseline : bucket.retest;
    target.total += 1;
    if (event.result === 'correct') target.correct += 1;
    counters.set(event.knowledge_point, bucket);
  }

  const accuracy: AccuracyRow[] = ctx.data.nodes
    .filter((node) => counters.has(node.id))
    .map((node) => {
      const bucket = counters.get(node.id)!;
      const baseline = bucket.baseline.total > 0 ? bucket.baseline.correct / bucket.baseline.total : null;
      const retest = bucket.retest.total > 0 ? bucket.retest.correct / bucket.retest.total : null;
      return {
        kp_id: node.id,
        baseline,
        retest,
        delta: baseline !== null && retest !== null ? retest - baseline : null,
      };
    });

  return ok({ mastery, gaps, accuracy });
}
