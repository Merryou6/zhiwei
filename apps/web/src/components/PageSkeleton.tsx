/**
 * 骨架屏（前端优化批三 · 2026-09-22；2026-10-10 style-10 蓝图迁移 P4 换形态）
 *
 * 背景：原先 10 个页面的数据加载态都是一行文字（「正在取你的掌握度…」），
 * 首屏看起来像卡住；换成与真实版式同构的骨架能明显降低「等待感」。
 *
 * 【P4 换的是什么】把「脉冲灰块卡」换成 blueprint/SkeletonLines 的
 * **静态发丝斜线**（规范 5.10）。原实现每一块都挂 `animate-pulse`，
 * 那是全站唯一一处循环动效 —— 规范第 8 章明令「无循环动效：不用呼吸、
 * 不用 shimmer、不用旋转 loading（骨架是静态的）」。理由不是审美偏好：
 * 一块持续呼吸的空白会在整个取数期间抢注意力，而这界面讲的是
 * 「工程可核查感」——批注说清「在取数」，比让空白喘气更有信息量。
 *
 * 【契约零改动】props 仍是 `label` / `rows` / `className`，调用点（App.tsx 的
 * Suspense fallback 与各页面的加载态）一行不用改。`label` 保留为**视觉隐藏**文案：
 * 可见的那行由 SkeletonLines 的「取数中 · 不伪造内容」承担，读屏两者都能听到。
 */

import type { ReactElement, ReactNode } from 'react';

import SkeletonLines from './blueprint/SkeletonLines';

interface PageSkeletonProps {
  /** 视觉隐藏的状态文案（原先那行「正在取…」）。 */
  label: string;
  /** 内容块数量（默认 3，按页面真实版式给 2~4）。 */
  rows?: number;
  /** 外层间距由调用方控制（与页面原有 mt-* 一致）。 */
  className?: string;
}

export default function PageSkeleton({ label, rows = 3, className }: PageSkeletonProps): ReactElement {
  // 注：note 里同时给出「读屏专用 label」与「可见的取数批注」。
  // 可见文案属状态提示（不是产品话术），不落在 phrases 的锁定范围内。
  const note: ReactNode = (
    <>
      <span className="sr-only">{label}</span>
      取数中 · 不伪造内容
    </>
  );

  return <SkeletonLines rows={rows} block className={className} note={note} />;
}

/** 行内小骨架（列表项内部等待，如对话页的预置文件列表）。同样是静态斜线。 */
export function InlineSkeletonRows({ rows = 2 }: { rows?: number }): ReactElement {
  return (
    <div className="flex flex-col gap-2 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <span
          key={index}
          className="bp-hatch h-3.5 border border-dashed border-line"
          style={{ width: `${Math.max(40, 100 - index * 9)}%` }}
        />
      ))}
    </div>
  );
}
