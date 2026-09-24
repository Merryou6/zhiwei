/**
 * 骨架屏（前端优化批三 · 2026-09-22）
 *
 * 背景：原先 10 个页面的数据加载态都是一行文字（「正在取你的掌握度…」），
 * 首屏看起来像卡住；换成与真实版式同构的骨架能明显降低「等待感」。
 *
 * 纪律（沿用既有约定）：
 *   - 骨架是纯灰块，**不伪造数据**（D12：不与真实掌握度/题目混淆，不用彩色状态带）；
 *   - 原状态文字保留为视觉隐藏文本（role="status" + aria-live），屏幕阅读器仍能听到进度；
 *   - 动效只做浅脉冲；系统开启「减弱动态效果」时由 index.css 统一压平为静态灰块。
 */

import type { ReactElement } from 'react';

interface PageSkeletonProps {
  /** 视觉隐藏的状态文案（原先那行「正在取…」）。 */
  label: string;
  /** 内容块数量（默认 3，按页面真实版式给 2~4）。 */
  rows?: number;
  /** 外层间距由调用方控制（与页面原有 mt-* 一致）。 */
  className?: string;
}

function Bar({ tone, height }: { tone: string; height: string }): ReactElement {
  return <div className={`${height} ${tone} rounded-md`} aria-hidden="true" />;
}

export default function PageSkeleton({ label, rows = 3, className }: PageSkeletonProps): ReactElement {
  const blocks = Array.from({ length: rows }, (_, index) => index);

  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      <div className="animate-pulse space-y-3" aria-hidden="true">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          {/* D11 修正：原先把 tone / height 两个 prop 传反了（tone 收了尺寸、height 收了空串）。
              渲染出的类集合与修正后完全一致（只是拼接顺序与首个空格不同）→ 视觉零变化。 */}
          <Bar tone="bg-line" height="h-5 w-40" />
          <div className="mt-3 space-y-2">
            <Bar tone="w-full max-w-md bg-line/70" height="h-3.5" />
            <Bar tone="w-2/3 bg-line/70" height="h-3.5" />
          </div>
        </div>

        {blocks.map((index) => (
          <div key={index} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <Bar tone="bg-line/80" height="h-4 w-32" />
            <div className="mt-3 space-y-2">
              <Bar tone="w-full bg-line/60" height="h-3.5" />
              <Bar tone="w-1/2 bg-line/60" height="h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 行内小骨架（列表项内部等待，如对话页的预置文件列表）。 */
export function InlineSkeletonRows({ rows = 2 }: { rows?: number }): ReactElement {
  return (
    <div className="animate-pulse space-y-2 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-4 w-3/4 rounded-md bg-line/70" />
      ))}
    </div>
  );
}
