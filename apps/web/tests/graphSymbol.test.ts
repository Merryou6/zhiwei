/**
 * graphSymbol 纯函数测试（style-10 迁移 P7 / D20①）
 *
 * 覆盖：四档 + 未解锁 + 未接触六种形状 path 的**顶点数**与圆/方的判别特征，
 * 以及 TreeNodeState → symbol 的映射。
 *
 * 纯函数、不拉渲染栈（沿用纪律）：断言对着 path 串本身，顶点公式逐字对照原型
 * `bandShapePath()`（tempui/prototypes/style-10/index.html L2784-2792）。
 */

import { describe, expect, it } from 'vitest';

import {
  bandShapePath,
  bandSymbol,
  circlePath,
  polygonPath,
  shapeKindOfState,
  squarePath,
  symbolForState,
} from '../src/lib/graphSymbol';

/** 多边形 path 的顶点数：`M p0 L p1 … Z` 里按 'L' 分段，段数 = 顶点数。 */
function polygonVertices(path: string): number {
  return path.split('L').length;
}

/** 方形 path 的角数：`M H V H Z` 里按命令字母分段，段数（去尾）= 角数。 */
function squareCorners(path: string): number {
  return path.split(/[MHV]/).filter((segment) => segment.length > 0).length;
}

describe('graphSymbol · 多边形顶点（原型 L2788/L2789 的顶点公式）', () => {
  it('菱形（待巩固）= 4 顶点', () => {
    const path = bandShapePath('待巩固');
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(polygonVertices(path)).toBe(4);
    // 菱形四点应落在上下左右（±半径）上：含 '0.00 -10.00' 与 '0.00 10.00'
    expect(path).toContain('0.00 -10.00');
    expect(path).toContain('0.00 10.00');
  });

  it('五边形（不稳定）= 5 顶点', () => {
    expect(polygonVertices(bandShapePath('不稳定'))).toBe(5);
  });

  it('六边形（基本掌握）= 6 顶点', () => {
    expect(polygonVertices(bandShapePath('基本掌握'))).toBe(6);
  });

  it('polygonPath(n) 的顶点数恒为 n', () => {
    for (const n of [3, 4, 5, 6, 8]) {
      expect(polygonVertices(polygonPath(n))).toBe(n);
    }
  });
});

describe('graphSymbol · 圆与方形', () => {
  it('已掌握 / 未接触 = 圆（含圆弧命令 A，无折线 L）', () => {
    for (const kind of ['已掌握', '未接触'] as const) {
      const path = bandShapePath(kind);
      expect(path).toContain('A');
      expect(path).not.toContain('L');
    }
    expect(circlePath()).toContain('A');
  });

  it('未解锁 = 0.8r 方形（H/V 直角，4 个角）', () => {
    const path = bandShapePath('未解锁');
    expect(path).toContain('H');
    expect(path).toContain('V');
    expect(squareCorners(path)).toBe(4);
    expect(squarePath()).toBe(path);
  });
});

describe('graphSymbol · ECharts symbol 与状态映射', () => {
  it('bandSymbol 带 path:// 前缀', () => {
    expect(bandSymbol('已掌握')).toBe(`path://${bandShapePath('已掌握')}`);
    expect(bandSymbol('待巩固').startsWith('path://')).toBe(true);
  });

  it('六态 → 形状档位：菱形待巩固 / 五边形不稳定 / 六边形基本掌握 / 圆已掌握 / 方形未解锁 / 圆未接触', () => {
    expect(shapeKindOfState('weak')).toBe('待巩固');
    expect(shapeKindOfState('unstable')).toBe('不稳定');
    expect(shapeKindOfState('basic')).toBe('基本掌握');
    expect(shapeKindOfState('mastered')).toBe('已掌握');
    expect(shapeKindOfState('locked')).toBe('未解锁');
    expect(shapeKindOfState('untouched')).toBe('未接触');
    expect(symbolForState('weak')).toBe(bandSymbol('待巩固'));
  });

  it('六种形状两两不同（形状本身就是编码，不得重样）', () => {
    const kinds = ['待巩固', '不稳定', '基本掌握', '已掌握', '未解锁', '未接触'] as const;
    const paths = kinds.map((kind) => bandShapePath(kind));
    // 未接触与已掌握同为圆（空心/实心由描边区分），其余互不相同
    expect(new Set(paths).size).toBe(5);
    expect(bandShapePath('未接触')).toBe(bandShapePath('已掌握'));
  });
});
