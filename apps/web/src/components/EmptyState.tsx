/**
 * 空状态（2026-09-20 风格走查新增）
 *
 * 统一「还没有数据」时的表达：一个极简标记 + 标题 + 一句说明 + 可选的下一步动作。
 * 设计纪律：
 *   - 标记用 currentColor + 令牌类（text-line / text-accent-ink），不硬编码 hex；
 *     三根柱子从低到高、最后一根用主色 = 「做完就有图了」，不使用四状态带颜色以免稀释语义。
 *   - 不画插画、不用 emoji、不加渐变（与 PRD §6 低饱和、不刺眼一致）。
 *   - 文案归 PRD §6「像耐心的学长」语气：说清「为什么还没有」+「下一步做什么」。
 */

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  /** 主句（16px，说清状态）。 */
  title: string;
  /** 说明（13px，说清下一步）。 */
  hint?: string;
  /** 下一步动作（按钮或链接），由调用方给。 */
  action?: ReactNode;
  /** 紧凑模式：嵌在卡片内时用（不显示标记、收紧留白）。 */
  compact?: boolean;
}

export default function EmptyState({ title, hint, action, compact = false }: EmptyStateProps) {
  return (
    <div className={compact ? 'py-2' : 'py-4'}>
      {compact ? null : (
        <span
          aria-hidden
          className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-surface border border-line bg-canvas"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" focusable="false">
            <rect x="3" y="13.5" width="3.6" height="5.5" rx="1" fill="currentColor" className="text-line" />
            <rect x="9.2" y="9.5" width="3.6" height="9.5" rx="1" fill="currentColor" className="text-line" />
            <rect x="15.4" y="4.5" width="3.6" height="14.5" rx="1" fill="currentColor" className="text-accent-ink" />
          </svg>
        </span>
      )}

      <p className="text-base font-medium text-ink">{title}</p>

      {hint ? (
        <p className="mt-1 max-w-prose text-ui-sm leading-relaxed text-ink-soft">{hint}</p>
      ) : null}

      {action ? <div className={compact ? 'mt-3' : 'mt-4'}>{action}</div> : null}
    </div>
  );
}
