/**
 * AnnoPop 标注浮层正文（style-10 蓝图迁移 P4 / 规范 6.1、6.3）
 *
 * 编号徽标展开后的浮层：`<b>编号 标题</b>` + 正文一段（≤320px 宽）。
 * 只在展开期间挂载 —— 收起时整块 DOM 不存在（不给隐藏的可读内容留后门：
 * 读屏与 Tab 序列都不该碰到一个看不见的标注正文）。
 *
 * 无障碍（D11）：原型用 aria-details 把引线与标注卡关联，浏览器支持不全，
 * 本工程改用「触发键 aria-expanded + 本浮层 id 作为 aria-controls 目标」的组合，
 * 浮层自身 role="tooltip"。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface AnnoPopProps {
  /** 浮层 id（触发键的 aria-controls 指向它）。 */
  id?: string;
  /** 编号，如 '①' / 'A2'。 */
  no: string;
  title: string;
  body: ReactNode;
  /** 浮层贴左（画布上的徽标走左上，避免与右上工具列重叠）。 */
  align?: 'right' | 'left';
  className?: string;
}

export default function AnnoPop({ id, no, title, body, align = 'right', className }: AnnoPopProps) {
  return (
    <span
      id={id}
      role="tooltip"
      className={cn(
        'absolute top-8 block w-[min(320px,64vw)] rounded-control border border-accent bg-surface p-3 shadow-overlay',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      <b className="mb-1 block font-mono text-tok uppercase tracking-widest text-accent-ink">
        {no} {title}
      </b>
      <span className="block text-body-sm leading-relaxed text-ink-soft">{body}</span>
    </span>
  );
}
