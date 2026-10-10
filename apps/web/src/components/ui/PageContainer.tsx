/**
 * PageContainer / PageHeader（2026-09-25 视觉重构 P1b）
 *
 * 【它替换掉什么】
 * 收敛前 12 个页面各写各的内容宽度，一共 5 种写法，彼此没有依据：
 *   max-w-xl（Assessment 完成态）· max-w-2xl（Attribution / Paper 填充 / Drive 空态）
 *   max-w-3xl（Me / Spaces / Drive / Report）· max-w-[1180px]（ConsoleHome，**被外壳截断而失效**）
 *   · 完全没有 max-w（Graph / Chat）
 *
 * 【两档而不是五档】
 * 宽度不是越细越好 —— 档位多的代价是每加一个页面都要重新决定一次「我该多宽」，
 * 而这类决定本应来自页面类型。所以只留两种意图明确的宽度：
 *   prose    要逐字读的页面（题干、表单、向导、结论叙述）。窄列 = 更短的行长 = 更好读。
 *   standard 扫读与列举型页面（报告、空间、资料、账号）。中等列。
 *   wide     数据型页面（图谱、控制台、对话双栏）。**不设上限**，直接继承外壳宽度。
 *
 * 【关于外壳宽度】
 * 外壳（Layout 的 main / TopNav 的 nav）在 P2 从 max-w-5xl(1024) 放宽到 max-w-6xl(1152)。
 * 所以 `wide` 这一档必须**不设 max-width** 才吃得到这份宽度；如果这里再写一个
 * max-w-6xl，外壳以后调整就又要在两处同步 —— 那正是当初 ConsoleHomePage
 * 那个失效的 1180 的成因（页面自己写宽度，与外壳不一致，且不一致时没有任何提示）。
 *
 * 注意：`wide` 不设上限 ≠ 无限宽。外壳仍兜住 1152px，且顶栏与之共用同一条左基线。
 *
 * 【2026-10-10 style-10 蓝图迁移 P4】两条留痕：
 *   ① `PageContainer` 的职责**收窄为「宽度意图」**，不再承担页边距。
 *      规范 4.1 的 `--pad-frame`（桌面 48px / ≤900 22px 18px / ≤420 16px 12px）
 *      由新外壳的 `Sheet`（blueprint/Sheet.tsx）单一承担 —— 若这里再写一遍内边距，
 *      两处相加会在迁移页上出现 96px 的双倍留白。单一来源优先。
 *   ② `PageHeader` 补两件可选 props（`sheetNo` / `dim`）并换四件式视觉
 *      （eyebrow 等宽大写 / h1 标题栈 / sub 正文 / dim 右对齐等宽）。
 *      两件都可选 —— 未迁移页面不传即与改造前**逐字相同**的渲染结果（共存策略）。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type PageWidth = 'prose' | 'standard' | 'wide';

const WIDTH_CLASS: Record<PageWidth, string> = {
  prose: 'max-w-2xl',
  standard: 'max-w-3xl',
  /** 空串：继承外壳宽度。故意不写 max-w-*，避免与外壳出现第二个宽度真相。 */
  wide: '',
};

export interface PageContainerProps {
  width?: PageWidth;
  className?: string;
  children: ReactNode;
}

export function PageContainer({ width = 'standard', className, children }: PageContainerProps) {
  return <section className={cn('w-full', WIDTH_CLASS[width], className)}>{children}</section>;
}

export interface PageHeaderProps {
  /** 标题上方的小字（步骤眉标、页面归属）。承担「这是哪一类信息」的定位。 */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** 右侧操作区。会整体换行到标题下方，不挤压标题。 */
  actions?: ReactNode;
  /** md = 24px（默认）；lg = 30px（页面本身就是全站焦点时才用）。 */
  size?: 'md' | 'lg';
  /**
   * 眉标旁的图号（style-10 P4 新增，规范 4.3 的 `SHEET 10-12`）。
   * 可选：未迁移页面不传，渲染结果与改造前逐字相同。
   */
  sheetNo?: string;
  /**
   * 右上角 dim 行（规范 4.3 的「图幅 <档> · <宽度>px」）。
   * 未迁移页面不传 → 不渲染，保持旧观感（共存策略）。
   */
  dim?: string;
  className?: string;
  /** 标题下方的补充内容（徽标行、状态行）。 */
  children?: ReactNode;
}

/**
 * 页面标题区。**不带边框、不带底色、不带圆角** —— 标题区是版式的一部分，
 * 不是一张卡。收敛前多数页面用裸 <header> 是对的，这里只是把它统一成有规格的版式：
 * 标题 24px 起（原来普遍 20px，导致页面第一眼没有落点）。
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  size = 'md',
  sheetNo,
  dim,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn('relative flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {/* 眉标走批注制式（规范 4.3 的 eyebrow：等宽大写 + 图标 + SHEET 图号）。 */}
        {kicker ? (
          <p className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-tok uppercase tracking-widest text-accent-ink">
            <span>{kicker}</span>
            {sheetNo ? <span className="num-mono">SHEET {sheetNo}</span> : null}
          </p>
        ) : null}
        <h1
          className={cn(
            'font-disp font-medium tracking-tight text-ink',
            size === 'lg' ? 'text-3xl leading-tight' : 'text-2xl leading-snug',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-prose text-body-sm leading-relaxed text-ink-soft">{description}</p>
        ) : null}
        {children}
      </div>
      {/* dim 行（规范 4.3）：右对齐等宽元信息，装饰性（图幅/基准），故 aria-hidden。 */}
      {dim ? (
        <div
          aria-hidden="true"
          className="num-mono absolute right-0 top-0 text-right text-mono-xs leading-relaxed tracking-wide text-ink-soft"
        >
          {dim}
        </div>
      ) : null}
      {actions ? (
        <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
