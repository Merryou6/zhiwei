/**
 * graphMastery 纯函数测试（v2.1 技能树）
 *
 * 覆盖：六态推导（四带 / untouched / locked）、打通边、章节徽章、覆盖率。
 * 数据不走网络：直接手工构造 GraphMasteryNode。
 */

import { describe, expect, it } from 'vitest';

import { GRAPH_NODES, snapshotNode } from '../src/data/graphSnapshot';
import {
  chapterBadges,
  coverageRatio,
  edgeLit,
  isTouched,
  masteryByKpOf,
  treeNodeState,
} from '../src/lib/graphMastery';
import type { GraphMasteryNode } from '../src/api/types';

function node(kpId: string, overrides: Partial<GraphMasteryNode> = {}): GraphMasteryNode {
  return {
    kp_id: kpId,
    name: kpId,
    chapter: snapshotNode(kpId)?.chapter ?? '',
    mastery: 0,
    band: '待巩固',
    evidence_count: 0,
    last_evidence_type: null,
    last_updated: null,
    confidence: 'normal',
    ...overrides,
  };
}

describe('graphMastery · 六态推导', () => {
  it('零证据用户：无先修 → untouched；先修未点亮 → locked', async () => {
    const byKp = masteryByKpOf([]);
    // 有理数无先修 → untouched（起点可攻）
    expect(treeNodeState(snapshotNode('math.cz.number.rational')!, byKp)).toBe('untouched');
    // 整式乘法先修有理数（未点亮）→ locked
    expect(treeNodeState(snapshotNode('math.cz.algebra.multiply')!, byKp)).toBe('locked');
    // 抛物线与几何综合（深层）→ locked
    expect(treeNodeState(snapshotNode('math.cz.quadratic.geometry')!, byKp)).toBe('locked');
  });

  it('四带映射：band 字段直读服务端（前端不重算阈值）', () => {
    const byKp = masteryByKpOf([
      node('math.cz.number.rational', { mastery: 0.9, band: '已掌握', evidence_count: 3, last_evidence_type: 'diagnose' }),
      node('math.cz.equation.linear_one', { mastery: 0.5, band: '不稳定', evidence_count: 1, last_evidence_type: 'diagnose' }),
      node('math.cz.algebra.basic', { mastery: 0.2, band: '待巩固', evidence_count: 1, last_evidence_type: 'diagnose' }),
      node('math.cz.function.concept', { mastery: 0.7, band: '基本掌握', evidence_count: 2, last_evidence_type: 'practice' }),
    ]);
    expect(treeNodeState(snapshotNode('math.cz.number.rational')!, byKp)).toBe('mastered');
    expect(treeNodeState(snapshotNode('math.cz.equation.linear_one')!, byKp)).toBe('unstable');
    expect(treeNodeState(snapshotNode('math.cz.algebra.basic')!, byKp)).toBe('weak');
    expect(treeNodeState(snapshotNode('math.cz.function.concept')!, byKp)).toBe('basic');
  });

  it('锁定规则：先修待巩固 → locked；先修全点亮 → 按自身带', () => {
    const byKp = masteryByKpOf([
      node('math.cz.number.rational', { mastery: 0.2, band: '待巩固', evidence_count: 1, last_evidence_type: 'diagnose' }),
      // 自身有证据但先修待巩固 → 不锁（有数据优先展示真实状态）
      node('math.cz.algebra.multiply', { mastery: 0.7, band: '基本掌握', evidence_count: 2, last_evidence_type: 'diagnose' }),
    ]);
    // 自身 touched → 显示自身带（不被锁定覆盖）
    expect(treeNodeState(snapshotNode('math.cz.algebra.multiply')!, byKp)).toBe('basic');
    // 自身 untouched 且先修待巩固 → locked
    expect(treeNodeState(snapshotNode('math.cz.algebra.basic')!, byKp)).toBe('locked');
  });

  it('isTouched：evidence_count=0 且无 last_evidence_type → false', () => {
    expect(isTouched(node('x'))).toBe(false);
    expect(isTouched(node('x', { evidence_count: 0, last_evidence_type: 'paper' }))).toBe(true);
    expect(isTouched(undefined)).toBe(false);
  });
});

describe('graphMastery · 打通边与徽章', () => {
  it('两端均已掌握 → 亮边；否则不亮', () => {
    const byKp = masteryByKpOf([
      node('math.cz.number.rational', { mastery: 0.9, band: '已掌握', evidence_count: 2, last_evidence_type: 'diagnose' }),
      node('math.cz.equation.linear_one', { mastery: 0.9, band: '已掌握', evidence_count: 2, last_evidence_type: 'diagnose' }),
      node('math.cz.algebra.basic', { mastery: 0.7, band: '基本掌握', evidence_count: 1, last_evidence_type: 'diagnose' }),
    ]);
    expect(edgeLit('math.cz.number.rational', 'math.cz.equation.linear_one', byKp)).toBe(true);
    expect(edgeLit('math.cz.number.rational', 'math.cz.algebra.basic', byKp)).toBe(false);
  });

  it('章节徽章：全章 ≥ 基本掌握 → complete', () => {
    const allMastered = masteryByKpOf(
      GRAPH_NODES.map((snapshot) =>
        node(snapshot.id, {
          mastery: 0.85,
          band: '已掌握',
          evidence_count: 1,
          last_evidence_type: 'diagnose',
        }),
      ),
    );
    const badges = chapterBadges(allMastered);
    expect(badges.every((badge) => badge.complete)).toBe(true);

    const empty = masteryByKpOf([]);
    expect(chapterBadges(empty).every((badge) => !badge.complete)).toBe(true);
  });

  it('覆盖率：点亮数 / 全图', () => {
    expect(coverageRatio(masteryByKpOf([]))).toBe(0);
    const oneOfAll = masteryByKpOf(
      GRAPH_NODES.slice(0, 1).map((snapshot) =>
        node(snapshot.id, { mastery: 0.9, band: '已掌握', evidence_count: 1, last_evidence_type: 'diagnose' }),
      ),
    );
    expect(coverageRatio(oneOfAll)).toBeCloseTo(1 / GRAPH_NODES.length, 6);
  });
});
