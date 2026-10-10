/**
 * Rail 分层索引（style-10 蓝图迁移 P4 / 规范 4.3）
 *
 * 图纸左侧的图层索引：图号（等宽，宽 46px）+ 标题 + 优先级（等宽，宽 22px 右对齐），
 * 当前项 `aria-current="page"` + 左侧 2px 强调条。项高 ≥44px（触控底线）。
 *
 * 【它不认识路由表】items 由外壳给（外壳从 router.ROUTES 派生），Rail 只负责画。
 * 这样它能在「全部图纸」抽屉里被复用（dense 变体），也不把路由依赖带进组件树。
 *
 * 【≤900 永不出现】窄档下侧栏收进抽屉（原型 [data-tier=md/sm] .rail{display:none}）。
 * 这里用 sheet:hidden 之外的策略：外壳在窄档根本不渲染它（避免「渲染了但看不见」
 * 的焦点陷阱死区 —— 抽屉与正文靠 aria-hidden 互斥，多一个不可见可聚焦子树很危险）。
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '../../lib/cn';

export interface RailItem {
  path: string;
  /** 图号，如 '10-12'。 */
  dwg: string;
  label: string;
  pr: 'T0' | 'T1' | 'T2';
}

export interface RailProps {
  items: RailItem[];
  /** 缺省「分层索引」。 */
  title?: string;
  /** 底部说明（图层口径 / 当前空间 / 证据计数）。 */
  note?: ReactNode;
  /** 抽屉内复用：去掉左侧内边距、标题右对齐。 */
  dense?: boolean;
  className?: string;
}

export default function Rail({ items, title = '分层索引', note, dense = false, className }: RailProps) {
  return (
    <nav
      id={dense ? undefined : 'bp-rail'}
      aria-label={dense ? '全部图纸索引' : '分层索引'}
      className={cn(
        dense
          ? ''
          : 'sticky top-14 max-h-[calc(100dvh-3.5rem)] min-w-0 self-start overflow-auto border-r border-line/20',
        className,
      )}
    >
      <h2
        className={cn(
          'flex items-center justify-between gap-2 border-b border-line/20 px-3.5 pb-2 pt-3 font-mono text-mono-xs uppercase tracking-widest text-ink-soft',
          dense && 'px-0',
        )}
      >
        <span>{title}</span>
        <span className="num-mono">{items.length} 张</span>
      </h2>

      <ul className="list-none py-1.5">
        {items.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center gap-2.5 px-3.5 text-body-sm leading-snug',
                  dense && 'px-0',
                  isActive
                    ? 'bg-accent-veil text-ink shadow-[inset_2px_0_0_rgb(var(--c-accent))]'
                    : 'text-ink-soft hover:bg-accent-veil hover:text-ink',
                )
              }
            >
              <span className="num-mono w-[46px] flex-none text-mono-xs text-accent-ink">
                {item.dwg}
              </span>
              <span className="min-w-0 flex-1">{item.label}</span>
              <span className="num-mono w-[22px] flex-none text-right text-mono-xs text-ink-soft">
                {item.pr}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>

      {note ? (
        <div
          className={cn(
            'border-t border-line/20 px-3.5 py-2.5 font-mono text-mono-xs leading-relaxed tracking-wider text-ink-soft',
            dense && 'px-0',
          )}
        >
          {note}
        </div>
      ) : null}
    </nav>
  );
}
