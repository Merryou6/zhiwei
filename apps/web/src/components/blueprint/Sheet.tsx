/**
 * Sheet 图纸区（含 SheetHead / SheetBlock）（style-10 蓝图迁移 P4 / 规范 4.1、4.3）
 *
 * 图纸 = 页头（eyebrow + h1 + sub + dim）+ 若干 `section.block` 分节，
 * 右侧另有一个「栏位」槽位（原型 `.annos` 位）：常态放标注列，
 * 本工程按 D3 让常驻对话面板落在这里（`≥1180` 挤压图纸宽）。
 *
 * 【为什么把栏位做成 slot 而不是内建标注列】标注列的数据来自页面（每条标注挂在哪、
 * 正文是什么），面板则来自 store；共同点只有「几何位置」这一件事。
 * 把几何位置做成一个 slot，两种用法都成立，且互不打架。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Icon } from './icons';

export interface SheetHeadProps {
  /** 眉标（等宽大写，如 'REPORT / 学习报告'）。 */
  eyebrow: string;
  /** 图号，如 '10-12'。 */
  sheetNo: string;
  /** 需求编号，如 '2.12'。 */
  section?: string;
  title: string;
  /** 页头说明（≤74ch）。 */
  sub?: ReactNode;
  /** 右上角 dim 行（缺省由外壳给「图幅 <档> · <宽度>px」）。 */
  dim?: string;
  /** 眉标右侧的 chip 槽位。 */
  chips?: ReactNode;
  className?: string;
}

/** 页头四件：eyebrow（图标 + 眉标 + 图号 + 需求号）/ h1 / sheet-sub / dim。 */
export function SheetHead({
  eyebrow,
  sheetNo,
  section,
  title,
  sub,
  dim,
  chips,
  className,
}: SheetHeadProps) {
  return (
    <header className={cn('relative mb-5 border-b border-line pb-3.5', className)}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5 font-mono text-tok uppercase tracking-widest text-accent-ink">
        <Icon name="compass" className="h-4 w-4" />
        <span>{eyebrow}</span>
        <span className="num-mono">SHEET {sheetNo}</span>
        {section ? <span>需求 {section}</span> : null}
        {chips}
      </div>
      {/* h1：`sm` 档（≤420）降到 20px 并允许断词 —— 原型
          `#board[data-tier="sm"] h1{font-size:20px}` / `#board[data-tier="sm"] .sheet-head h1{word-break:break-word}`
          （prototypes/style-10/index.html L696-697）。落法按 D1 走具名断点 `max-narrow:`
          （≤419.98，与原型「≤420」在恰好 420px 处差 1px，与既有 nav:720 的端点留痕同性质）。 */}
      <h1 className="mb-1.5 font-disp text-num-lg leading-tight tracking-tight text-ink max-narrow:break-words max-narrow:text-title">
        {title}
      </h1>
      {sub ? <p className="max-w-[74ch] text-body-sm text-ink-soft">{sub}</p> : null}
      {dim ? (
        <div
          aria-hidden="true"
          className="num-mono absolute right-0 top-0 text-right text-mono-xs leading-relaxed tracking-wide text-ink-soft max-narrow:static max-narrow:mt-2.5 max-narrow:text-left"
        >
          {dim}
        </div>
      ) : null}
    </header>
  );
}

export interface SheetBlockProps {
  /** 分节号（原型 blockTitle 的第一个参数，如 '01'）。 */
  no?: string;
  title: string;
  /** 分节右侧的 tok / chip。 */
  right?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** 分节：等宽大写的分节条 + 内容。 */
export function SheetBlock({ no, title, right, id, className, children }: SheetBlockProps) {
  return (
    <section className={cn('relative mb-8', className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-3.5 flex flex-wrap items-baseline gap-2.5 border-b border-line pb-1.5 font-mono text-tok uppercase tracking-widest text-ink-soft">
        {no ? <span className="num-mono text-accent-ink">{no}</span> : null}
        <h2 id={id ? `${id}-title` : undefined} className="font-disp text-title-sm tracking-tight text-ink">
          {title}
        </h2>
        {right ? <span className="ml-auto">{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

export interface SheetProps {
  head?: SheetHeadProps;
  /** 右侧栏位（原型 .annos 位）：标注列 / 常驻面板 / 空。 */
  aside?: ReactNode;
  /** 栏位是否占位（false 时 grid 单栏）。 */
  asideOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * 图纸外框内边距：**四值逐档对齐规范 §4.2 / 原型**（2026-10-11 P6a，M-1 裁决 D13）。
 *
 *   档位（工程断点）              上 / 左右 / 底      依据
 *   ─────────────────────────────────────────────────────────────────────────
 *   base（sm，<420）              16 / 12 / 10        原型 L681（16px 12px 10px）
 *   narrow:（md，420–899.98）     22 / 18 / 12        原型 L680（22px 18px 12px）
 *   sheet:（lg/xl，≥900）         48 / 48 / 16        原型 L140 + L40（--pad-frame 48，底 16）
 *
 * ⚠ 两处与原型 1px 的端点差（与既有 nav:720 的端点留痕同性质，D13b 已注明）：
 *   原型 md 档是 421–900、lg 档是 901 起；工程断点是 narrow:420 / sheet:900
 *   （D1 具名断点，全站同一套）⇒ 恰好 420px 与 900px 两处归属与原型相差 1px。
 *   不为此改断点：D1 的价值是「全站只有一套档位边界」，1px 归属差是它的已知代价。
 *
 * ⚠ 22 / 18 走 tailwind.config.js 的 pad-frame-* 具名 token（默认刻度上没有这两个值），
 *   禁止就地写 pt-[22px] —— 裸任意值既不挂在刻度上，也没有任何断言保护。
 * ⚠ annos 档不再单列 px-12：lg/xl 同值（48），多一条分支只会多一个真相。
 */
const SHEET_PADDING =
  'pt-4 px-3 pb-2.5 narrow:pt-pad-frame-md-y narrow:px-pad-frame-md-x narrow:pb-pad-frame-md-b sheet:pt-12 sheet:px-12 sheet:pb-4';

export default function Sheet({ head, aside, asideOpen = false, className, children }: SheetProps) {
  return (
    <main id="sheet" tabIndex={-1} className={cn('relative min-w-0', SHEET_PADDING, className)}>
      <div
        className={cn(
          'relative z-10 grid gap-0',
          // annos 档（≥1180）且有栏位时才分两栏：右栏 296px（规范 4.2）
          asideOpen && aside ? 'annos:grid-cols-[minmax(0,1fr)_296px]' : 'grid-cols-1',
        )}
      >
        <article className="min-w-0">
          {head ? <SheetHead {...head} /> : null}
          {children}
        </article>
        {asideOpen && aside ? (
          <aside
            aria-label="标注卡"
            className="min-w-0 border-line/20 annos:sticky annos:top-14 annos:ml-4 annos:border-l annos:pl-4"
          >
            {aside}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
