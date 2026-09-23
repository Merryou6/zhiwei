/**
 * 「知微」标识几何 —— 视觉改版（2026-09-22）
 *
 * ── 设计说明 ────────────────────────────────────────────────
 * 形状叫「微眼」：一枚沿对角线张开的叶形（两道对称弧），
 * 弧内穿过一条自左下升到右上的**先修链**，链心是一枚实心瞳孔。
 *
 *   · 叶形轮廓 —— 知识与成长（也读作眼睛：知微 = 洞察细微）；
 *   · 链上的四个节点 —— 根因、先修枢纽、掌握，一条从卡住到学会的路径；
 *   · 瞳孔 —— 整件事的焦点：先看清你到底卡在哪，别的都是后话；
 *   · 虹膜细环 —— 把瞳孔圈出来，小尺寸下也能看出是「眼睛」而不是一颗球。
 *
 * 构图上刻意的三处对称：两道弧关于主轴镜像；链上节点关于中心成对（t 与 1−t）；
 * 两端节点正好落在眼角上，于是「链的两端 = 眼睛的两角」，不会多出游离的碎点。
 *
 * ── 为什么单独成模块 ────────────────────────────────────────
 * 这份几何被三处共用，必须只有一个源头，否则必然漂移：
 *   1. ParticleLogo（Canvas 粒子动画）→ sampleLogoPoints() 采目标点；
 *   2. ZhiweiLogo（界面内静态 SVG）→ eyeOutlinePaths() 描边；
 *   3. tools/brand-assets/gen-favicon.ts（标签页图标）→ 同上。
 * 坐标统一在 0..100 的归一化空间里，渲染端按画布尺寸等比缩放。
 */

/** 归一化画布边长（宽高共用）。 */
export const LOGO_VIEW = 100;

export type LogoGroup = 'outline' | 'link' | 'iris' | 'core' | 'node';

export interface LogoPoint {
  /** 归一化坐标。 */
  x: number;
  y: number;
  /** 渲染半径（与坐标同一归一化单位）。 */
  size: number;
  /** 目标不透明度。 */
  alpha: number;
  group: LogoGroup;
}

export interface LogoNode {
  id: string;
  x: number;
  y: number;
  r: number;
  /** 链的两端（根因 / 掌握）：略大略亮。 */
  key?: boolean;
  /** 瞳孔：用多点填成实心盘，而不是单颗粒子。 */
  core?: boolean;
}

/** 眼角（主轴两端），也是先修链的两个端点。 */
const CORNER_A = { x: 17, y: 77 };
const CORNER_B = { x: 83, y: 23 };

/** 主轴中点处的最大张开度（叶形半宽）。 */
const HALF_WIDTH = 25;
/** 瞳孔半径 / 虹膜环半径。 */
const PUPIL_RADIUS = 8.2;
const IRIS_RADIUS = 11.6;

const MID = { x: (CORNER_A.x + CORNER_B.x) / 2, y: (CORNER_A.y + CORNER_B.y) / 2 };

/** 主轴长度与单位方向（左下 → 右上）。 */
const AXIS_LENGTH = Math.hypot(CORNER_B.x - CORNER_A.x, CORNER_B.y - CORNER_A.y);
const AXIS_U = {
  x: (CORNER_B.x - CORNER_A.x) / AXIS_LENGTH,
  y: (CORNER_B.y - CORNER_A.y) / AXIS_LENGTH,
};
/** 单位法向：垂直于主轴，指向右下。 */
const AXIS_P = { x: -AXIS_U.y, y: AXIS_U.x };

/**
 * 两道弧用**二次贝塞尔**而不是圆弧：控制点取「中点 ± 2×半宽」，
 * 这样 t=0.5 处的曲线点恰好落在「中点 ± 半宽」上（0.25A + 0.5C + 0.25B 的性质），
 * 半宽就成为一个能直接读懂的设计参数，不必反算圆的半径。
 */
const CONTROL_PLUS = { x: MID.x + AXIS_P.x * 2 * HALF_WIDTH, y: MID.y + AXIS_P.y * 2 * HALF_WIDTH };
const CONTROL_MINUS = { x: MID.x - AXIS_P.x * 2 * HALF_WIDTH, y: MID.y - AXIS_P.y * 2 * HALF_WIDTH };

/** 主轴上的取点（t=0 左眼角，t=1 右眼角）。 */
function axisPoint(t: number): { x: number; y: number } {
  return {
    x: CORNER_A.x + (CORNER_B.x - CORNER_A.x) * t,
    y: CORNER_A.y + (CORNER_B.y - CORNER_A.y) * t,
  };
}

/**
 * 链上节点：两端落在眼角上，中间两个关于瞳孔对称（t 与 1−t）。
 * 对称是有意的——不对称会立刻读成「随手撒的点」。
 */
export const LOGO_NODES: readonly LogoNode[] = [
  { id: 'root', ...axisPoint(0), r: 2.6, key: true },
  { id: 'step', ...axisPoint(0.31), r: 2.2 },
  { id: 'pupil', x: MID.x, y: MID.y, r: PUPIL_RADIUS, core: true },
  { id: 'rise', ...axisPoint(0.69), r: 2.2 },
  { id: 'mastered', ...axisPoint(1), r: 2.6, key: true },
];

/** 先修链：串联上面的节点（经过瞳孔的那两段会被实心盘盖住，正是想要的效果）。 */
export const LOGO_LINKS: readonly (readonly [string, string])[] = [
  ['root', 'step'],
  ['step', 'pupil'],
  ['pupil', 'rise'],
  ['rise', 'mastered'],
];

/** 供渲染端读数（也便于设计调整时对齐参数）。 */
export const LOGO_EYE = {
  a: CORNER_A,
  b: CORNER_B,
  mid: MID,
  halfWidth: HALF_WIDTH,
  pupilRadius: PUPIL_RADIUS,
  irisRadius: IRIS_RADIUS,
  axisLength: AXIS_LENGTH,
} as const;

export function getLogoNode(id: string): LogoNode | null {
  return LOGO_NODES.find((node) => node.id === id) ?? null;
}

/**
 * 把一个点投影到主轴上，返回 0..1 的位置。
 * 粒子与 SVG 的配色都靠它——保证渐变的走向严格沿先修链，而不是沿画布对角线。
 */
export function axisRatio(x: number, y: number): number {
  const projected = (x - CORNER_A.x) * AXIS_U.x + (y - CORNER_A.y) * AXIS_U.y;
  return Math.min(1, Math.max(0, projected / AXIS_LENGTH));
}

/** 保留两位小数，避免 SVG 路径里出现一长串浮点噪声。 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 叶形两道弧的 SVG path（静态标识直接拿去描边）。 */
export function eyeOutlinePaths(): string[] {
  return [CONTROL_PLUS, CONTROL_MINUS].map(
    (control) =>
      `M ${round(CORNER_A.x)} ${round(CORNER_A.y)} Q ${round(control.x)} ${round(control.y)} ${round(CORNER_B.x)} ${round(CORNER_B.y)}`,
  );
}

/** 二次贝塞尔取点。 */
function quadPoint(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const k = 1 - t;
  return {
    x: k * k * from.x + 2 * k * t * control.x + t * t * to.x,
    y: k * k * from.y + 2 * k * t * control.y + t * t * to.y,
  };
}

/** 曲线长度的数值估计（32 段折线），用来把「点间距」换算成采样个数。 */
function quadLength(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const segments = 32;
  let length = 0;
  let previous = from;
  for (let index = 1; index <= segments; index += 1) {
    const point = quadPoint(from, control, to, index / segments);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

/** 沿一段直线按固定间距取点。 */
function segmentPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  step: number,
): { x: number; y: number }[] {
  const count = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / step));
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index <= count; index += 1) {
    const ratio = index / count;
    points.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
  }
  return points;
}

/** 一圈点（虹膜环用）。 */
function circlePoints(
  cx: number,
  cy: number,
  radius: number,
  step: number,
): { x: number; y: number }[] {
  const count = Math.max(8, Math.round((2 * Math.PI * radius) / step));
  const points: { x: number; y: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (2 * Math.PI * index) / count;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}

export interface SampleOptions {
  /** 叶形轮廓相邻点间距。 */
  outlineStep?: number;
  /** 先修链相邻点间距。 */
  linkStep?: number;
  /** 瞳孔内的点间距（越小越实心）。 */
  coreStep?: number;
  /** 虹膜环相邻点间距。 */
  irisStep?: number;
  /** 位置抖动：0 = 完全规整（机器感），默认 0.3 带一点手作呼吸。 */
  jitter?: number;
  /** 随机源，测试可注入固定值。 */
  random?: () => number;
}

/**
 * 采样出粒子的目标点。
 *
 * 返回顺序即绘制顺序（后画的压在上面），这是有意的分层：
 *   叶形轮廓 → 先修链 → 虹膜环 → 瞳孔实心盘 → 链上节点
 * 于是瞳孔盖住穿过的链、节点浮在轮廓之上，视觉层级和设计稿一致。
 *
 * 亮度也是分层且单调的（虹膜 0.32 < 链 0.58 < 轮廓 0.66 < 瞳孔 0.92 < 节点 1.0），
 * 测试里钉住了这个顺序，避免以后随手改坏主次。
 */
export function sampleLogoPoints(options: SampleOptions = {}): LogoPoint[] {
  const {
    outlineStep = 1.05,
    linkStep = 0.95,
    coreStep = 1.7,
    irisStep = 2,
    jitter = 0.3,
    random = Math.random,
  } = options;

  const points: LogoPoint[] = [];
  const drift = (amount: number): number => (random() - 0.5) * 2 * amount;

  // 1) 叶形轮廓（两道对称弧）
  for (const control of [CONTROL_PLUS, CONTROL_MINUS]) {
    const count = Math.max(
      24,
      Math.round(quadLength(CORNER_A, control, CORNER_B) / outlineStep),
    );
    for (let index = 0; index <= count; index += 1) {
      const at = quadPoint(CORNER_A, control, CORNER_B, index / count);
      points.push({ x: at.x + drift(jitter), y: at.y + drift(jitter), size: 0.95, alpha: 0.66, group: 'outline' });
    }
  }

  // 2) 先修链
  for (const [fromId, toId] of LOGO_LINKS) {
    const from = getLogoNode(fromId);
    const to = getLogoNode(toId);
    if (!from || !to) continue;
    for (const at of segmentPoints(from, to, linkStep)) {
      points.push({ x: at.x + drift(jitter), y: at.y + drift(jitter), size: 0.9, alpha: 0.58, group: 'link' });
    }
  }

  // 3) 虹膜环：把瞳孔圈出来，小尺寸下也读得出是「眼睛」
  for (const at of circlePoints(MID.x, MID.y, IRIS_RADIUS, irisStep)) {
    points.push({ x: at.x + drift(jitter * 0.6), y: at.y + drift(jitter * 0.6), size: 0.8, alpha: 0.32, group: 'iris' });
  }

  // 4) 瞳孔：同心环填成实心盘（环距 ≈ 点距，颗粒刚好咬合成面）
  const pupil = LOGO_NODES.find((node) => node.core);
  if (pupil) {
    for (const ratio of [0.32, 0.56, 0.78, 1]) {
      for (const at of circlePoints(pupil.x, pupil.y, pupil.r * ratio, coreStep)) {
        points.push({ x: at.x, y: at.y, size: 1.05, alpha: 0.92, group: 'core' });
      }
    }
    points.push({ x: pupil.x, y: pupil.y, size: pupil.r * 0.4, alpha: 0.92, group: 'core' });
  }

  // 5) 链上节点（最小最亮，压在最上层）
  for (const node of LOGO_NODES) {
    if (node.core) continue;
    points.push({ x: node.x, y: node.y, size: node.r, alpha: 1, group: 'node' });
  }

  return points;
}
