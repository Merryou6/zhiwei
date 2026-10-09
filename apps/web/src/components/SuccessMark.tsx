/**
 * SuccessMark —— 完成时刻的奖励微交互（awwwards 2026 趋势「micro-interactions that reward attention」）。
 *
 * 设计依据：动效是**奖励**不是装饰 —— 本组件只应出现在值得庆祝的时刻
 * （整组全对 / 知识点已掌握 / 复测较基线提升），给「完成」一个可感知的定格。
 *
 * 动效：SVG 描边动画。圆环先画（600ms，stroke-dashoffset 从满周长描到 0）、
 * 对勾后画（300ms，延迟 450ms 错落启动），timing 与全站 verdict-in / result-in 同一条
 * cubic-bezier(0.16, 1, 0.3, 1)。keyframes（success-ring / success-check）定义在
 * index.css 状态触发入场区，与本文件内的变量 --success-*-length 配对。
 *
 * 无障碍：视觉图形 aria-hidden，语义由 sr-only 文本（label prop）承担。
 * 减弱动态效果：index.css 底部全局 reduce 块自动接管（duration 0.01ms + delay 0s），
 * 动画瞬时到达终态，本组件无需自行处理 prefers-reduced-motion。
 */

import type { CSSProperties, ReactNode } from 'react';

export interface SuccessMarkProps {
  /** 渲染尺寸（px），默认 28。 */
  size?: number;
  /** 颜色令牌：accent = 品牌强调色；positive = 「已掌握」状态带青绿（语义=好消息）。 */
  tone?: 'accent' | 'positive';
  /** sr-only 语义文本，默认「已完成」。 */
  label?: string;
}

/** 圆环几何（viewBox 24）：半径 11，周长 2πr ≈ 69.12，dasharray/offset 用满周长。 */
const RING_RADIUS = 11;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** 对勾路径 M7 12.5 L10.5 16 L17 8.5 的实长 ≈ 14.9，取 15 并留 0.5 余量防接头缺口。 */
const CHECK_LENGTH = 15.4;

/** tone → 颜色。accent 走 CSS 变量（跟随主题）；positive 复用 band-mastered 令牌类。
 *  注意：全站纪律禁止把 text-accent 当文字色类用（tokens.test.ts ⑧），故 accent 用内联变量。 */
const TONE_STYLE: Record<'accent' | 'positive', { className?: string; style?: CSSProperties }> = {
  accent: { style: { color: 'rgb(var(--c-accent))' } },
  positive: { className: 'text-band-mastered' },
};

export default function SuccessMark({
  size = 28,
  tone = 'accent',
  label = '已完成',
}: SuccessMarkProps): ReactNode {
  const toneStyle = TONE_STYLE[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${toneStyle.className ?? ''}`}
      style={toneStyle.style}
    >
      {/* 装饰性图形对读屏是噪音：aria-hidden，语义交给 sr-only 文本 */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle
          className="success-mark-ring"
          cx="12"
          cy="12"
          r={RING_RADIUS}
          stroke="currentColor"
          strokeWidth="2"
          style={{ '--success-ring-length': RING_LENGTH } as CSSProperties}
        />
        <path
          className="success-mark-check"
          d="M7 12.5 L10.5 16 L17 8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ '--success-check-length': CHECK_LENGTH } as CSSProperties}
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
