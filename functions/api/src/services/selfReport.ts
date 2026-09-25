/**
 * 自报先验服务（契约 §3，接口 #6 POST /api/evidence/self-report，通路四）
 *
 * 规则：level → P(L0) 用 engine.priorFor（PRIOR_MAP 唯一来源）；
 *      仅初始化/覆盖 mastery_profiles 的 p_l0 与 mastery；
 *      【不产生 evidence_events】（自报是先验，不是观测）；
 *      evidence_count > 0 的知识点【不覆盖】（真实证据优先）。
 */

import { priorFor } from '../../../../packages/engine/src/index';

import { ctxNowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

/** 契约 §3：reports ≤ 8 项（章节粒度；v1.4 由 ≤6 上调——两个学段的章节清单实测都是 8，
 *  页 2 允许全选 + 「按 3 档先填上」一键填满，旧上限会把满选用户必然锁死在 400）。 */
export const MAX_REPORTS = 8;
/** level → P(L0) 映射档位（ALGORITHM §0 PRIOR_MAP 的键域）。 */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

interface SelfReportRow {
  chapter: string;
  level: number;
}

/** 校验并解析 reports（非法 → 400）。章节按空间所属学段校验（cz/gz 同名章节不串）。 */
export function parseReports(raw: unknown, data: AppContext['data'], kbId: string): SelfReportRow[] {
  if (!Array.isArray(raw)) {
    throw httpError.badRequest('reports 必须是数组');
  }
  if (raw.length > MAX_REPORTS) {
    throw httpError.badRequest(`reports 最多 ${MAX_REPORTS} 项`);
  }

  return raw.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw httpError.badRequest('reports 每项必须是对象');
    }
    const { chapter, level } = entry as Record<string, unknown>;

    if (typeof chapter !== 'string' || chapter.trim().length === 0) {
      throw httpError.badRequest('reports[].chapter 不能为空');
    }
    if (
      typeof level !== 'number' ||
      !Number.isInteger(level) ||
      level < MIN_LEVEL ||
      level > MAX_LEVEL
    ) {
      throw httpError.badRequest(`reports[].level 必须是 ${MIN_LEVEL}–${MAX_LEVEL} 的整数`);
    }
    if (data.nodesByChapterForKb(kbId, chapter).length === 0) {
      throw httpError.badRequest(`章节不存在：${chapter}`);
    }
    return { chapter, level };
  });
}

/** POST /api/evidence/self-report */
export async function selfReport(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);
  const kbId = space.knowledge_source[0];
  const reports = parseReports(req.body.reports, ctx.data, kbId);

  const timestamp = ctxNowIso(ctx);
  let updated = 0;

  for (const report of reports) {
    const pL0 = priorFor(report.level, ctx.params);
    for (const node of ctx.data.nodesByChapterForKb(kbId, report.chapter)) {
      const existing = await ctx.store.getProfile(user.user_id, space.space_id, node.id);
      // 真实证据优先：已有观测的知识点不被先验覆盖
      if (existing && existing.evidence_count > 0) continue;

      await ctx.store.upsertProfile({
        user_id: user.user_id,
        space_id: space.space_id,
        knowledge_point: node.id,
        mastery: pL0,
        evidence_count: existing?.evidence_count ?? 0,
        p_l0: pL0,
        status: existing?.status ?? 'active',
        last_updated: timestamp,
        last_evidence_type: existing?.last_evidence_type ?? null,
      });
      updated += 1;
    }
  }

  // 注意：不写 evidence_events（自报是先验，不是观测）
  return ok({ updated });
}
