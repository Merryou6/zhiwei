/**
 * 图谱节点形状（style-10「青蓝蓝图」迁移 P7 / D20①「四档形状三重编码」）
 *
 * 【它是什么】把原型 `bandShapePath()`（tempui/prototypes/style-10/index.html L2784-2792）
 * 转写成**纯函数**，产出 ECharts `symbol` 的 `path://…` 串。
 *
 * 【为什么需要它】原型用 SVG 自绘节点形状（菱形 / 五边形 / 六边形 / 圆 / 方形），
 * 而本工程按 D8 保留 ECharts 生态（不做 SVG 自绘）。ECharts 的 graph 节点 `symbol`
 * 支持内建 `'circle'` / `'diamond'` 与自定义 `'path://…'` —— 四档 + 未解锁 + 未接触
 * 共六种形状，只有圆能走内建、其余五种必须给 path。把 path 生成公式**逐字对照原型**，
 * 形状语义才与原型一致（原型是唯一视觉依据）。
 *
 * 【顶点公式逐字对照原型】原型多边形用 `(-90 + i * step)` 度生成顶点
 * （L2788 五边形 step=72、L2789 六边形 step=60），菱形是同式 step=90 的四点；
 * 圆形用两段圆弧闭合（L2786/L2791）；方形取 0.8r 边长（L2790）。
 *
 * 【坐标口径】原型在 SVG 绝对坐标里以 r=15 画；这里统一画在以原点为中心、半径 10
 * 的设计坐标里 —— ECharts 会把 path 按自身包围盒缩放到 symbolSize，故绝对半径只需
 * 一致、无需等于 15。取 10 是为了 toFixed(2) 后有足够精度、不出并列坐标。
 *
 * 【它不认识阈值/颜色】形状只由「档位 kind」决定；档位由调用方按 engine 判定后传入
 * （TreeNodeState → ShapeKind），组件与颜色一律不在这里。
 */

import type { TreeNodeState } from './graphMastery';

/** 有形状语义的六个档位（四档 + 未解锁 + 未接触）。 */
export type ShapeKind = '待巩固' | '不稳定' | '基本掌握' | '已掌握' | '未解锁' | '未接触';

/** 设计坐标半径（见文件头「坐标口径」）。 */
const RADIUS = 10;

/**
 * 正多边形 path：顶点角度公式逐字对照原型 L2788/L2789 的 `(-90 + i * step)`。
 *
 * @param count 顶点数（菱形 4 / 五边形 5 / 六边形 6）。
 * @param radius 设计坐标半径。
 */
export function polygonPath(count: number, radius: number = RADIUS): string {
  const step = 360 / count;
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = ((-90 + i * step) * Math.PI) / 180;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M${points[0]}L${points.slice(1).join('L')}Z`;
}

/**
 * 圆形 path：原型用「起终点差 0.01」的两段圆弧闭合（L2786/L2791），这里同口径
 * —— 保证弧长足够画出一整个圆，而不是自交的零长度弧。
 */
export function circlePath(radius: number = RADIUS): string {
  const top = -radius;
  return `M0 ${top}A${radius} ${radius} 0 1 1 ${(-0.01).toFixed(2)} ${top}Z`;
}

/** 方形 path（未解锁）：原型 L2790 的 0.8r 边长方框。 */
export function squarePath(radius: number = RADIUS): string {
  const half = radius * 0.8;
  return `M${-half} ${-half}H${half}V${half}H${-half}Z`;
}

/** 档位 → path 串（不含 `path://` 前缀）。 */
export function bandShapePath(kind: ShapeKind): string {
  switch (kind) {
    case '待巩固':
      return polygonPath(4);
    case '不稳定':
      return polygonPath(5);
    case '基本掌握':
      return polygonPath(6);
    case '已掌握':
      return circlePath();
    case '未解锁':
      return squarePath();
    case '未接触':
    default:
      return circlePath();
  }
}

/** 档位 → ECharts symbol 串（`path://` 前缀）。 */
export function bandSymbol(kind: ShapeKind): string {
  return `path://${bandShapePath(kind)}`;
}

/**
 * 六态视觉机 → 形状档位。D20①：菱形=待巩固 / 五边形=不稳定 / 六边形=基本掌握 /
 * 圆=已掌握；未解锁=方形；未接触=虚线空心圆（形状同为圆，由调用方以边框虚线表达空心）。
 */
const STATE_SHAPE: Record<TreeNodeState, ShapeKind> = {
  weak: '待巩固',
  unstable: '不稳定',
  basic: '基本掌握',
  mastered: '已掌握',
  locked: '未解锁',
  untouched: '未接触',
};

/** 六态 → 形状档位。 */
export function shapeKindOfState(state: TreeNodeState): ShapeKind {
  return STATE_SHAPE[state];
}

/** 六态 → ECharts symbol 串（GraphPage 逐点挂到 data）。 */
export function symbolForState(state: TreeNodeState): string {
  return bandSymbol(STATE_SHAPE[state]);
}
