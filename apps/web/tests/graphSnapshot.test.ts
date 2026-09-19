/**
 * 知识图谱静态副本守恒测试（D7）
 *
 * 用 node:fs 直接读冻结数据 data/knowledge/math/cz.json，逐字段断言副本未漂移：
 *   节点数 / 每节点 id·name·chapter·difficulty·prerequisites·successors / 章节清单 /
 *   prereq↔successor 互逆 / 引用闭包 / kp 名表完备，外加拓扑分层布局（graphLayout）性质。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CHAPTER_SIZES,
  GRAPH_CHAPTERS,
  GRAPH_NODES,
  KP_NAMES,
  chapterNames,
  kpName,
  snapshotNode,
} from '../src/data/graphSnapshot';
import { chainDepth, computeGraphLayout, isPathEdge, parsePathParam } from '../src/lib/graphLayout';

const CZ_PATH = fileURLToPath(new URL('../../../data/knowledge/math/cz.json', import.meta.url));

interface FrozenNode {
  id: string;
  name: string;
  chapter: string;
  difficulty: number;
  prerequisites: string[];
  successors: string[];
}

const frozen = JSON.parse(readFileSync(CZ_PATH, 'utf8')) as { nodes: FrozenNode[] };

describe('graphSnapshot · 与冻结数据逐字段守恒', () => {
  it('节点数 20、章节数 4', () => {
    expect(frozen.nodes).toHaveLength(20);
    expect(GRAPH_NODES).toHaveLength(20);
    expect(GRAPH_CHAPTERS).toHaveLength(4);
  });

  it('每个节点的 id / name / chapter / difficulty / prerequisites / successors 逐项相等', () => {
    expect(GRAPH_NODES.map((node) => node.id)).toEqual(frozen.nodes.map((node) => node.id));

    for (const [index, source] of frozen.nodes.entries()) {
      const copy = GRAPH_NODES[index];
      expect(copy.id).toBe(source.id);
      expect(copy.name).toBe(source.name);
      expect(copy.chapter).toBe(source.chapter);
      expect(copy.difficulty).toBe(source.difficulty);
      expect(copy.prerequisites).toEqual(source.prerequisites);
      expect(copy.successors).toEqual(source.successors);
    }
  });

  it('章节清单（名称 + 知识点归属与顺序）与冻结数据一致，规模 2/3/4/11', () => {
    const expected: { name: string; kp_ids: string[] }[] = [];
    for (const node of frozen.nodes) {
      const bucket = expected.find((entry) => entry.name === node.chapter);
      if (bucket) bucket.kp_ids.push(node.id);
      else expected.push({ name: node.chapter, kp_ids: [node.id] });
    }

    expect(GRAPH_CHAPTERS).toEqual(expected);
    expect(chapterNames()).toEqual(['代数式', '函数', '一元二次方程', '二次函数']);
    expect(CHAPTER_SIZES).toEqual({ 代数式: 2, 函数: 3, 一元二次方程: 4, 二次函数: 11 });
  });

  it('prerequisites ↔ successors 互逆（有向边双向记录一致）', () => {
    const successorSet = new Map(GRAPH_NODES.map((node) => [node.id, new Set(node.successors)]));
    const prerequisiteSet = new Map(GRAPH_NODES.map((node) => [node.id, new Set(node.prerequisites)]));

    for (const node of GRAPH_NODES) {
      for (const prereq of node.prerequisites) {
        expect(successorSet.get(prereq)?.has(node.id)).toBe(true);
      }
      for (const successor of node.successors) {
        expect(prerequisiteSet.get(successor)?.has(node.id)).toBe(true);
      }
    }
  });

  it('引用闭包：所有先修/后继 id 都在这 20 个节点内（无悬挂引用）', () => {
    const ids = new Set(GRAPH_NODES.map((node) => node.id));
    for (const node of GRAPH_NODES) {
      for (const id of [...node.prerequisites, ...node.successors]) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });

  it('kp 名表完备（20 项）且与节点名一致；未知 id 回退为 id 本身', () => {
    expect(Object.keys(KP_NAMES)).toHaveLength(20);
    for (const node of GRAPH_NODES) expect(kpName(node.id)).toBe(node.name);
    expect(kpName('math.nc.unknown')).toBe('math.nc.unknown');
    expect(snapshotNode('math.cz.quadratic.extremum')?.chapter).toBe('二次函数');
    expect(snapshotNode('nope')).toBeNull();
  });
});

describe('graphLayout · 分层坐标（纯函数、同输入恒同输出）', () => {
  const layout = computeGraphLayout();

  it('列数 = 最长先修链深度 + 1；根级节点在第 0 列', () => {
    const byId = new Map(GRAPH_NODES.map((node) => [node.id, node]));
    const maxDepth = Math.max(...GRAPH_NODES.map((node) => chainDepth(node.id, byId)));
    expect(layout.columns).toBe(maxDepth + 1);
    for (const node of GRAPH_NODES) {
      const placed = layout.nodes.find((entry) => entry.id === node.id);
      expect(placed).toBeDefined();
      expect(placed!.column).toBe(chainDepth(node.id, byId));
    }
    expect(
      GRAPH_NODES.filter((node) => node.prerequisites.length === 0).every(
        (node) => layout.nodes.find((entry) => entry.id === node.id)!.column === 0,
      ),
    ).toBe(true);
  });

  it('同列内 y 坐标不重叠、坐标确定性（两次计算结果一致）', () => {
    const again = computeGraphLayout();
    expect(again).toEqual(layout);

    const byColumn = new Map<number, number[]>();
    for (const node of layout.nodes) {
      const bucket = byColumn.get(node.column) ?? [];
      bucket.push(node.y);
      byColumn.set(node.column, bucket);
    }
    for (const ys of byColumn.values()) {
      expect(new Set(ys).size).toBe(ys.length);
    }
    expect(layout.nodes).toHaveLength(20);
  });

  it('边 = 全部直接先修关系，且指向真实节点', () => {
    const expectedEdges = GRAPH_NODES.reduce((total, node) => total + node.prerequisites.length, 0);
    expect(layout.edges).toHaveLength(expectedEdges);
    const byId = new Map(GRAPH_NODES.map((node) => [node.id, node]));
    for (const edge of layout.edges) {
      expect(byId.get(edge.to)?.prerequisites).toContain(edge.from);
    }
  });

  it('?path= 解析与路径边判定（图谱高亮口径）', () => {
    expect(parsePathParam('a,b ,,b')).toEqual(['a', 'b']);
    expect(parsePathParam(null)).toEqual([]);
    expect(isPathEdge('a', 'b', ['a', 'b', 'c'])).toBe(true);
    expect(isPathEdge('b', 'a', ['a', 'b', 'c'])).toBe(false);
    expect(isPathEdge('a', 'c', ['a', 'b', 'c'])).toBe(false);
  });
});
