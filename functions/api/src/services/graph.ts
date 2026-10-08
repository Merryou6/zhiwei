/**
 * 图谱掌握度服务（契约 §14 · v2.1 技能树，接口 #32 GET /api/graph/mastery?space_id=xxx）
 *
 * 目标：学生端一次拉齐「结构 × 掌握度 × 游戏化摘要」，技能树页据此着色/锁定/点亮。
 *
 * 口径（与既有服务同源，禁另立标准）：
 *   - band 用 engine.masteryToBand（状态带唯一来源，与 report/summary、teacher 快照一致）；
 *   - 未触及知识点 mastery=0（归入待巩固，与 teacher.bandCounts 的补 0 口径一致）；
 *   - confidence='low'：该 kp 的**最后一条证据**来自 paper / self_report（历史材料估的，
 *     做复测会更准）——这是「拍卷冷启动」与「复测闭环」的咬合点；
 *   - newly_mastered_7d：mastery_logs 中 7 天内 after≥0.8 且 before<0.8 的条数
 *     （阈值取 statusBand 的规格常量，不写字面值）；
 *   - weakest：待巩固带按 mastery 升序前 3（供「去攻克」直达）。
 *
 * 红线：响应显式字面构造，不透传 profile 记录；无 answer / 对话原文等任何敏感字段。
 */

import {
  BAND_THRESHOLD_MASTERED,
  masteryToBand,
} from '../../../../packages/engine/src/index';

import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';
import type { MasteryProfileRecord } from '../db/types';

/** 最近点亮窗口（天）——「本周点亮 +N」的统计口径。 */
export const RECENT_DAYS = 7;

/** 单节点视图（响应白名单，显式字面构造）。 */
export interface GraphMasteryNode {
  kp_id: string;
  name: string;
  chapter: string;
  mastery: number;
  band: string;
  evidence_count: number;
  last_evidence_type: string | null;
  last_updated: string | null;
  confidence: 'low' | 'normal';
}

export interface GraphMasterySummary {
  total_kp: number;
  covered_kp: number;
  band_counts: Record<string, number>;
  evidence_total: number;
  newly_mastered_7d: number;
  weakest: { kp_id: string; name: string; mastery: number }[];
}

export interface GraphMasteryData {
  space_id: string;
  nodes: GraphMasteryNode[];
  summary: GraphMasterySummary;
}

/** confidence 判定：最后一条证据来自历史材料（试卷/自述）→ low。 */
export function confidenceOf(profile: MasteryProfileRecord | undefined): 'low' | 'normal' {
  if (!profile) return 'normal';
  return profile.last_evidence_type === 'paper' || profile.last_evidence_type === 'self_report'
    ? 'low'
    : 'normal';
}

/** GET /api/graph/mastery?space_id=xxx */
export async function mastery(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const space = await requireSpaceOwnership(ctx, user.user_id, spaceId);

  const kbNodes = ctx.data.nodesForKb(space.knowledge_source[0]);
  if (kbNodes.length === 0) {
    throw httpError.badRequest(`知识库不存在或为空：${space.knowledge_source[0]}`);
  }

  const profiles = await ctx.store.listProfiles(user.user_id, space.space_id);
  const profileByKp = new Map(profiles.map((profile) => [profile.knowledge_point, profile]));

  // ---- 逐节点视图（kb 全量，与结构冻结数据同序）
  const nodes: GraphMasteryNode[] = kbNodes.map((node) => {
    const profile = profileByKp.get(node.id);
    const value = profile?.mastery ?? 0;
    return {
      kp_id: node.id,
      name: node.name,
      chapter: node.chapter,
      mastery: value,
      band: masteryToBand(value),
      evidence_count: profile?.evidence_count ?? 0,
      last_evidence_type: profile?.last_evidence_type ?? null,
      last_updated: profile?.last_updated ?? null,
      confidence: confidenceOf(profile),
    };
  });

  // ---- 摘要
  const bandCounts: Record<string, number> = { 待巩固: 0, 不稳定: 0, 基本掌握: 0, 已掌握: 0 };
  let evidenceTotal = 0;
  for (const node of nodes) {
    bandCounts[node.band] += 1;
    evidenceTotal += node.evidence_count;
  }

  const cutoffMs = ctx.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const newlyMastered7d = (await ctx.store.listLogsBySpace(space.space_id)).filter((log) => {
    if (log.after < BAND_THRESHOLD_MASTERED || log.before >= BAND_THRESHOLD_MASTERED) return false;
    return new Date(log.created_at).getTime() >= cutoffMs;
  }).length;

  const weakest = nodes
    .filter((node) => node.band === '待巩固')
    .sort((a, b) => a.mastery - b.mastery || a.kp_id.localeCompare(b.kp_id))
    .slice(0, 3)
    .map((node) => ({ kp_id: node.kp_id, name: node.name, mastery: node.mastery }));

  const summary: GraphMasterySummary = {
    total_kp: nodes.length,
    covered_kp: profiles.length,
    band_counts: bandCounts,
    evidence_total: evidenceTotal,
    newly_mastered_7d: newlyMastered7d,
    weakest,
  };

  return ok({ space_id: space.space_id, nodes, summary });
}
