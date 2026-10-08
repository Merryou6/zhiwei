/**
 * 技能树状态推导（v2.1）—— 纯函数，无 DOM / 无请求，供 GraphPage 与单元测试消费。
 *
 * 结构来源：graphSnapshot（cz.json 冻结副本，禁止手改）；
 * 掌握度来源：#32 GET /api/graph/mastery（band 由服务端 engine 同源计算；
 * 本文件只做**状态归类与锁定推导**，不重算阈值 —— 锁定判断用 band 字符串比较）。
 *
 * 六态视觉机（PRD §6 四带 + 冷启动/游戏化两态）：
 *   mastered / basic / unstable / weak —— 四带实色（BAND_HEX）；
 *   untouched —— 无 profile（零证据）空心；locked —— 未点亮且任一先修也未点亮/待巩固。
 *
 * 「打通」边：两端均已掌握 → 亮边（进度感的直接来源）。
 */

import { GRAPH_CHAPTERS, GRAPH_NODES } from '../data/graphSnapshot';
import type { GraphNodeSnapshot } from '../data/graphSnapshot';
import type { GraphMasteryNode } from '../api/types';

export type TreeNodeState = 'mastered' | 'basic' | 'unstable' | 'weak' | 'untouched' | 'locked';

/** #32 节点 → 按 id 索引（结构快照里可能有而 #32 缺的节点按未触及兜底）。 */
export function masteryByKpOf(nodes: readonly GraphMasteryNode[]): Map<string, GraphMasteryNode> {
  return new Map(nodes.map((node) => [node.kp_id, node]));
}

/** 单节点是否有学习痕迹（#32 未返回 / 全零都算未触及）。 */
export function isTouched(node: GraphMasteryNode | undefined): boolean {
  return Boolean(node && (node.evidence_count > 0 || node.last_evidence_type !== null));
}

/**
 * 节点六态推导。
 * 规则：有学习痕迹 → 按四带；无痕迹 → 任一先修「未点亮或待巩固」→ locked，否则 untouched。
 */
export function treeNodeState(
  snapshot: GraphNodeSnapshot,
  byKp: Map<string, GraphMasteryNode>,
): TreeNodeState {
  const profile = byKp.get(snapshot.id);
  if (isTouched(profile)) {
    const band = profile!.band;
    if (band === '已掌握') return 'mastered';
    if (band === '基本掌握') return 'basic';
    if (band === '不稳定') return 'unstable';
    return 'weak';
  }
  const blocked = snapshot.prerequisites.some((prereqId) => {
    const prereqProfile = byKp.get(prereqId);
    if (!isTouched(prereqProfile)) return true;
    return prereqProfile!.band === '待巩固';
  });
  return blocked ? 'locked' : 'untouched';
}

/** 全图六态（顺序与结构快照一致，GraphPage 逐点消费）。 */
export function treeNodeStates(
  byKp: Map<string, GraphMasteryNode>,
): Map<string, TreeNodeState> {
  return new Map(GRAPH_NODES.map((snapshot) => [snapshot.id, treeNodeState(snapshot, byKp)]));
}

/** 先修边是否「打通」（两端均已掌握）。 */
export function edgeLit(from: string, to: string, byKp: Map<string, GraphMasteryNode>): boolean {
  const lit = (id: string): boolean => byKp.get(id)?.band === '已掌握';
  return lit(from) && lit(to);
}

export interface ChapterBadge {
  name: string;
  /** 该章知识点数。 */
  total: number;
  /** 已点亮数（band ∈ 基本掌握/已掌握）。 */
  lit: number;
  /** 全章点亮 → 徽章成立。 */
  complete: boolean;
}

/** 章节徽章（全章 ≥ 基本掌握 → complete）。 */
export function chapterBadges(byKp: Map<string, GraphMasteryNode>): ChapterBadge[] {
  return GRAPH_CHAPTERS.map((chapter) => {
    const profiles = chapter.kp_ids
      .map((kpId) => byKp.get(kpId))
      .filter((profile): profile is GraphMasteryNode => Boolean(profile));
    const lit = profiles.filter(
      (profile) => profile.band === '基本掌握' || profile.band === '已掌握',
    ).length;
    return { name: chapter.name, total: chapter.kp_ids.length, lit, complete: lit === chapter.kp_ids.length };
  });
}

/** 覆盖率（已点亮 / 全图），海报与页脚用。 */
export function coverageRatio(byKp: Map<string, GraphMasteryNode>): number {
  if (GRAPH_NODES.length === 0) return 0;
  const lit = GRAPH_NODES.filter((snapshot) => {
    const profile = byKp.get(snapshot.id);
    return profile && (profile.band === '基本掌握' || profile.band === '已掌握');
  }).length;
  return lit / GRAPH_NODES.length;
}
