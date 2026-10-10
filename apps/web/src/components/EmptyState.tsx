/**
 * 空状态（2026-09-20 风格走查新增；2026-10-10 style-10 蓝图迁移 P4 换形态）
 *
 * 统一「还没有数据」时的表达：一个虚线空盒 + 状态标签 + 标题 + 一句说明 + 可选的下一步动作。
 *
 * 【P4 换的是什么】从「小柱子图标 + 一段文字」换成规范 5.9 的**虚线空盒**：
 * 双层虚线框 + `EMPTY SET · 空集合` 制式标签。原实现的三根柱子是「做完就有图了」
 * 的隐喻，但它在四种空场景（无空间 / 无错题 / 无节点 / 无数据）里都暗示同一个
 * 「图会长出来」的期待，与其中三种都不成立 —— 空集合需要回答的是
 * 「为什么是空的 + 出路在哪」，而不是给一个会落空的承诺。
 *
 * 【语义纪律（规范 5.9，不是风格偏好）】
 *   · 空态只引导、**不重试**：重试按钮属红章（失败态）。空 ≠ 失败；
 *   · 空态必须给出「为什么是空的」与 ≥1 条出路；
 *   · 空态不显示假数据 / 假图表。
 *
 * 设计纪律（沿用）：标记用 currentColor + 令牌类，不硬编码 hex；不画插画、不用 emoji、
 * 不加渐变（与 PRD §6 低饱和、不刺眼一致）。
 */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 主句（16px，说清状态）。 */
  title: string;
  /** 说明（13.5px，说清下一步）。 */
  hint?: string;
  /** 下一步动作（按钮或链接），由调用方给。 */
  action?: ReactNode;
  /** 紧凑模式：嵌在卡片内时用（不显示状态标签、收紧留白）。 */
  compact?: boolean;
  /** 制式标签文案（缺省 `EMPTY SET · 空集合`）。 */
  tag?: string;
  className?: string;
}

export default function EmptyState({
  title,
  hint,
  action,
  compact = false,
  tag = 'EMPTY SET · 空集合',
  className,
}: EmptyStateProps) {
  return (
    <div className={['bp-empty', compact ? 'px-3 py-2.5' : 'px-4 py-4', className ?? ''].join(' ')}>
      {compact ? null : (
        <p className="mb-2 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">{tag}</p>
      )}

      <p className={compact ? 'text-body-sm font-medium text-ink' : 'text-base font-medium text-ink'}>
        {title}
      </p>

      {hint ? (
        <p className="mt-1 max-w-prose text-body-sm leading-relaxed text-ink-soft">{hint}</p>
      ) : null}

      {action ? <div className={compact ? 'mt-3' : 'mt-4'}>{action}</div> : null}
    </div>
  );
}
