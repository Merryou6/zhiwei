/**
 * LeaderLayer 标注引线层（style-10 蓝图迁移 P4 / 规范 6.1、6.2）
 *
 * xl 档（≥1180）才绘制的 SVG 虚线引线：从图纸上的目标块右侧出发，一段 14px 短干，
 * 一个膝点，然后水平落到右侧标注卡的左上角；起点画一个圆点、旁边一个编号小方块。
 *
 * 【几何是纯函数】`computeLeaderPath` 只吃两个矩形 + 一个基准，返回路径字符串与
 * 装饰件坐标 —— 可以单测，也可以在做不到真实测量的环境（无 DOM）里退化。组件只负责
 * 「测量 → 调用纯函数 → 渲染」。
 *
 * 【重绘时机】resize / scroll / ResizeObserver（内容变化）三处触发，
 * 用 requestAnimationFrame 合并（原型 syncLeaders 同款）：一帧内多次触发只重绘一次，
 * 避免滚动时每帧都重建 SVG。
 *
 * 【间距不足不画】目标与标注卡的间距 < 24px 时返回 null：此时引线会横穿内容，
 * 比不画更糟（原型同口径）。
 *
 * 【面板打开时停用】D3 / 规范 11 章 #7：常驻面板打开会挤压图纸宽，锚点随之下移，
 * 引线会指错位置；由外壳传 active={false} 停用整层（而不是让它画错）。
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface LeaderRect {
  left: number;
  top: number;
  right: number;
  height: number;
}

export interface LeaderGeometry {
  /** SVG path 的 d。 */
  d: string;
  /** 起点圆点。 */
  dotX: number;
  dotY: number;
  /** 编号小方块的左上角。 */
  boxX: number;
  boxY: number;
  /** 编号文字位置。 */
  textX: number;
  textY: number;
}

export interface LeaderLine {
  /** 编号（决定小方块里的字符）。 */
  no: string;
  /** 图纸上的目标元素。 */
  target: RefObject<HTMLElement | null>;
  /** 右侧标注卡元素。 */
  card: RefObject<HTMLElement | null>;
}

/** 最小间距：小于它就不画（会横穿内容）。 */
export const LEADER_MIN_GAP_PX = 24;
/** 短干长度（原型的 stub）。 */
export const LEADER_STUB_PX = 14;

/**
 * 计算一条引线的几何（纯函数，可单测）。
 * 返回 null 表示「不该画」：间距不足或缺测量值。
 */
export function computeLeaderPath(
  target: LeaderRect,
  card: LeaderRect,
  base: { left: number; top: number },
  opts: { stub?: number; minGap?: number } = {},
): LeaderGeometry | null {
  const stub = opts.stub ?? LEADER_STUB_PX;
  const minGap = opts.minGap ?? LEADER_MIN_GAP_PX;

  const gap = card.left - target.right;
  if (!Number.isFinite(gap) || gap < minGap) return null;

  const x1 = target.right - base.left;
  const y1 = target.top - base.top + Math.min(18, target.height / 2);
  const x4 = card.left - base.left;
  const y4 = card.top - base.top + 16;
  const knee = Math.max(18, (x4 - x1) * 0.42);
  const tail = Math.max(0, x4 - x1 - stub - knee);

  return {
    d: `M${x1.toFixed(1)} ${y1.toFixed(1)} h${stub} l${knee.toFixed(1)} ${(y4 - y1).toFixed(1)} h${tail.toFixed(1)}`,
    dotX: x1 + stub,
    dotY: y1,
    boxX: x1 + stub + 3,
    boxY: y1 + (y4 > y1 ? 3 : -12),
    textX: x1 + stub + 5,
    textY: y1 + (y4 > y1 ? 12.5 : -2.5),
  };
}

/** 小方块里显示的字符（超过两位取末两位）。 */
export function leaderLabel(no: string): string {
  return no.length > 2 ? no.slice(-2) : no;
}

export interface LeaderLayerProps {
  lines: LeaderLine[];
  /** false / 缺省时不渲染任何 DOM（面板打开、标注关、非 xl 档都传 false）。 */
  active?: boolean;
  /** 入场描边动画（800ms，仅首次挂载时用）。 */
  draw?: boolean;
  /** 高亮的编号（hover 联动）。 */
  highlightNo?: string | null;
  /** 基准元素（图纸 #sheet），引线坐标相对它计算。 */
  baseRef?: RefObject<HTMLElement | null>;
  /** 内容变化的重算触发键（如当前路由、数据长度）。 */
  deps?: readonly unknown[];
  className?: string;
}

export default function LeaderLayer({
  lines,
  active = false,
  draw = false,
  highlightNo = null,
  baseRef,
  deps = [],
  className,
}: LeaderLayerProps) {
  const [items, setItems] = useState<{ no: string; geo: LeaderGeometry }[]>([]);

  const measure = useCallback(() => {
    const base = baseRef?.current;
    if (!base) {
      setItems([]);
      return;
    }
    const baseRect = base.getBoundingClientRect();
    const origin = { left: baseRect.left, top: baseRect.top };
    const next: { no: string; geo: LeaderGeometry }[] = [];
    for (const line of lines) {
      const targetEl = line.target.current;
      const cardEl = line.card.current;
      if (!targetEl || !cardEl) continue;
      const geo = computeLeaderPath(
        targetEl.getBoundingClientRect(),
        cardEl.getBoundingClientRect(),
        origin,
      );
      if (geo) next.push({ no: line.no, geo });
    }
    setItems(next);
  }, [baseRef, lines]);

  useEffect(() => {
    if (!active) {
      setItems([]);
      return;
    }
    let frame = 0;
    const schedule = (): void => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    schedule();

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => schedule())
        : null;
    const base = baseRef?.current;
    if (observer && base) observer.observe(base);
    if (observer) {
      for (const line of lines) {
        if (line.target.current) observer.observe(line.target.current);
        if (line.card.current) observer.observe(line.card.current);
      }
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
    };
    // deps 是调用方给出的「内容变了」信号（路由 / 数据长度 / 布局开关）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, measure, baseRef, ...deps]);

  if (!active) return null;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 6,
        overflow: 'visible',
      }}
    >
      {items.map(({ no, geo }) => {
        const highlighted = highlightNo === no;
        return (
          <g key={no}>
            <path
              d={geo.d}
              fill="none"
              stroke={highlighted ? 'rgb(var(--c-accent))' : 'rgb(var(--c-leader) / 0.85)'}
              strokeWidth={1}
              strokeDasharray={highlighted ? undefined : '4 3'}
              // 入场描边（规范第 8 章唯一大动效，800ms）：给这条线一个足够长的
              // dasharray，再由 keyframes draw 从 1200 描到 0。高亮线不参与
              // （它是实线，描边入场会让它先消失再出现）。
              className={draw && !highlighted ? 'animate-draw' : undefined}
              style={draw && !highlighted ? { strokeDasharray: 1200 } : undefined}
            />
            <circle
              cx={geo.dotX}
              cy={geo.dotY}
              r={2.6}
              fill="none"
              stroke="rgb(var(--c-accent))"
              strokeWidth={1}
            />
            <rect
              x={geo.boxX}
              y={geo.boxY}
              width={15}
              height={12}
              fill="rgb(var(--c-canvas))"
              stroke="rgb(var(--c-accent))"
              strokeWidth={1}
            />
            <text
              x={geo.textX}
              y={geo.textY}
              fill="rgb(var(--c-accent))"
              className="num-mono"
              fontSize={9.5}
            >
              {leaderLabel(no)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
