/**
 * 图谱布局（D10：纯函数，预计算拓扑分层坐标）
 *
 * 为什么不用力导向：force 每次渲染位置抖动、答辩演示不可控；分层布局与「先修链」语义一致
 * —— 列 = 到根级节点的最长先修链深度（左→右 = 上游→下游），列内按章节聚簇、再按难度与 id 稳定排序。
 * 同输入恒得同输出（浏览器与测试一致），无随机、无时间依赖。
 */

import { GRAPH_NODES } from '../data/graphSnapshot';
import type { GraphNodeSnapshot } from '../data/graphSnapshot';
import { chapterNames } from '../data/graphSnapshot';

/** 列间距（px）。 */
export const COLUMN_GAP = 320;
/** 行间距（px）。 */
export const ROW_GAP = 80;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  /** 拓扑分层列号（0 = 根级章节起点）。 */
  column: number;
  chapter: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface GraphLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** 列数（= 最长先修链深度 + 1）。 */
  columns: number;
  width: number;
  height: number;
}

/**
 * 节点的「最长先修链深度」：无先修 → 0；否则 1 + max(先修深度)。
 * 图谱为 DAG（校验脚本保证），此处仍带 memo + 防御性占位，避免脏数据造成无限递归。
 */
export function chainDepth(id: string, byId: Map<string, GraphNodeSnapshot>, memo = new Map<string, number>()): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  memo.set(id, 0);
  const node = byId.get(id);
  const prereqs = node?.prerequisites ?? [];
  const value = prereqs.length === 0 ? 0 : 1 + Math.max(...prereqs.map((p) => chainDepth(p, byId, memo)));
  memo.set(id, value);
  return value;
}

/** 计算分层坐标（纯函数；default 参数便于测试注入小样本）。 */
export function computeGraphLayout(nodes: readonly GraphNodeSnapshot[] = GRAPH_NODES): GraphLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chapterOrder = chapterNames();

  const columns = nodes.map((node) => ({ id: node.id, column: chainDepth(node.id, byId) }));
  const columnCount = columns.length === 0 ? 0 : Math.max(...columns.map((entry) => entry.column)) + 1;

  const buckets = new Map<number, GraphNodeSnapshot[]>();
  for (const node of nodes) {
    const column = chainDepth(node.id, byId);
    const bucket = buckets.get(column) ?? [];
    bucket.push(node);
    buckets.set(column, bucket);
  }

  const sorted: LayoutNode[] = [];
  for (const [column, bucket] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    bucket.sort((a, b) => {
      const chapterDiff =
        chapterOrder.indexOf(a.chapter) - chapterOrder.indexOf(b.chapter);
      if (chapterDiff !== 0) return chapterDiff;
      if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    bucket.forEach((node, row) => {
      sorted.push({
        id: node.id,
        x: column * COLUMN_GAP,
        y: row * ROW_GAP,
        column,
        chapter: node.chapter,
      });
    });
  }

  const edges: LayoutEdge[] = [];
  for (const node of nodes) {
    for (const prereq of node.prerequisites) {
      if (!byId.has(prereq)) continue; // 防御：副本内引用必须闭包，缺失则跳过
      edges.push({ from: prereq, to: node.id });
    }
  }

  const maxRows = Math.max(0, ...[...buckets.values()].map((bucket) => bucket.length));

  return {
    nodes: sorted,
    edges,
    columns: columnCount,
    width: Math.max(0, (columnCount - 1) * COLUMN_GAP),
    height: Math.max(0, (maxRows - 1) * ROW_GAP),
  };
}

/** 把 'kp1,kp2' 解析为 id 数组（?path= 高亮用；过滤空段与重复）。 */
export function parsePathParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((segment) => segment.trim()).filter((segment) => segment.length > 0))];
}

/** 某条边是否落在高亮路径上（路径相邻两跳之间的边）。 */
export function isPathEdge(from: string, to: string, path: readonly string[]): boolean {
  for (let i = 1; i < path.length; i += 1) {
    if (path[i - 1] === from && path[i] === to) return true;
  }
  return false;
}
