/**
 * SkeletonLines 骨架（style-10 蓝图迁移 P4 / 规范 5.10）
 *
 * 加载态的唯一形态：若干条**静态发丝斜线** + 一块斜纹方块 + 一行「取数中 · 不伪造内容」。
 *
 * 【为什么禁止 shimmer】原型的取舍是明确的：骨架的任务是「说明这里在取数」，
 * 而呼吸 / 脉冲 / 扫光会让一块空白持续抢注意力 —— 在一个讲「工程可核查感」的界面里，
 * 那是噪音。所以这里**一个动画类都不挂**（对照：旧 PageSkeleton 用的 animate-pulse，
 * 迁移到本组件即下线）。
 *
 * 【无障碍】容器 role="status" + aria-live="polite"：读屏会念出 note 文案；
 * 斜线本身 aria-hidden（它们不携带信息）。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Icon } from './icons';

export interface SkeletonLinesProps {
  /** 斜线条数（缺省 3；宽度按 100% - i*9%，下限 40%）。 */
  rows?: number;
  /** 追加一块 104px 高的斜纹方块。 */
  block?: boolean;
  /** 状态文案，缺省「取数中 · 不伪造内容」。 */
  note?: ReactNode;
  className?: string;
}

export default function SkeletonLines({
  rows = 3,
  block = false,
  note = '取数中 · 不伪造内容',
  className,
}: SkeletonLinesProps) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-2.5', className)}>
      <span className="flex items-center gap-2 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">
        <Icon name="clock" className="h-3.5 w-3.5 text-accent-ink" />
        {note}
      </span>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="bp-hatch h-3.5 border border-dashed border-line"
          // 宽度递减是刻意的：等宽条会读成「一张表」，递减会读成「一段话正在到达」。
          style={{ width: `${Math.max(40, 100 - index * 9)}%` }}
        />
      ))}
      {block ? (
        // 104px = 原型的 .sk-block 高度
        <span aria-hidden="true" className="bp-hatch h-[104px] border border-dashed border-line" />
      ) : null}
    </div>
  );
}
