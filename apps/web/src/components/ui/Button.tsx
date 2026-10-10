/**
 * Button（2026-09-25 视觉重构 P1b）
 *
 * 【它替换掉什么】
 * 收敛前，全站 30+ 处按钮都是**裸 class 字符串**，且同一形态被抄了很多遍，例如
 * 主按钮出现过两种写法：
 *   `rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90 disabled:opacity-60`
 *   `rounded-lg bg-accent px-3 py-2 text-xs text-on-accent hover:opacity-90 disabled:opacity-60`
 * 改一次视觉要动十几个文件，且无法保证一致。这里把「颜色、尺寸、触控、禁用、
 * 焦点」四件事一次定死。
 *
 * 【关于 loading：故意不画转圈】
 * 本项目所有异步按钮都靠**按钮文案本身**表达进行中（「正在判…」「正在往上找…」
 * 「再看一次…」）。这是有意的产品语态，也让状态变化不依赖动画（前庭友好）。
 * 所以 loading 不替换 children、不插 spinner，只做两件事：禁用 + aria-busy，
 * 让读屏用户同样知道「这个操作正在进行」。文案仍由调用方切换。
 *
 * 【为什么需要 max-nav:min-h-*】
 * 触屏上 32px 高的按钮很难点准。移动端把最小高度抬到 36px（≥ 推荐值的下限），
 * 桌面（≥720）完全不受影响 —— 与项目既有 `max-nav:min-h-9` 的手写做法同源，
 * 现在收进原语，不用再逐处记得写。
 *
 * 【2026-10-10 style-10 蓝图迁移 P4：换视觉规格，API 一行不动】
 * 契约（variant 取值集合、size 档名、full、loading、as/href 用法、className 合并行为）
 * 全部保留，只换视觉：等宽大写制式 + inset 3px 内框线 + hover 走 accent-veil +
 * 禁用态走「虚线 + 斜纹 + [停用]」。
 * ⚠ 与「规范 5.1 写 12px 字号」的一处差异：本工程的字号必须走令牌
 *   （tokens.test.ts ① 禁止任意值字号），而刻度里没有 12px ——
 *   故取最近的 `ui-sm`(13px) 与 `tok`(11px)，差 1px，已写进执行报告。
 * ⚠ 触控底线从「<720 抬到 36px」改为「主控件一律 ≥44px」（规范 2.5/9）：
 *   md/lg 桌面即 44px，sm 桌面 36px、≤900 档抬到 44px。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  // base：`bp-btn` 承担蓝图制式（等宽大写 + .14em 字距 + inset 3px 内框线 +
  // 禁用态的虚线/斜纹/[停用] 前缀，见 index.css 的「控件制式」一节）。
  // ⚠ 禁用态不再用 opacity 压暗：规范 5.11 的禁用表达是「虚线 + 斜纹 + [停用]」，
  //   压暗会把斜纹与文字一起减淡，反而看不清「这里为什么不能点」。
  'bp-btn inline-flex select-none items-center justify-center rounded-control disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'border border-accent bg-accent text-on-accent hover:border-accent-ink',
        secondary: 'border border-line bg-surface text-ink hover:border-accent hover:bg-accent-veil',
        ghost:
          'border border-transparent text-ink-soft hover:bg-accent-veil hover:text-ink',
        /** 纯文字操作（「换一道」「回到上一步」）。不占盒模型，不用在行内加方块。 */
        quiet: 'border border-transparent px-2 text-ink-soft hover:text-ink',
        /**
         * 视觉上等同链接。用于「管理空间」这类附着在正文里的跳转。
         * hover 只用下划线，不用「文字变淡」：把 accent-ink 再乘 0.8 的透明度后
         * 对比度会从 7.35:1 掉到约 4.2:1，重新跌破 AA —— 悬停态不该变得难读。
         * ⚠ 链接形态不是「制图按钮」：回到正文栈与小写字形（normal-case），
         *   否则一句嵌入正文的「管理空间」会变成等宽大写的元信息，读起来像图号。
         */
        link: 'border border-transparent px-0 font-body normal-case tracking-normal text-accent-ink hover:underline',
        /** 破坏性操作（规范 5.1 的 danger）：红边 + 红字，不做实底红块。 */
        danger: 'border border-danger text-danger hover:bg-raised',
      },
      size: {
        // 主控件触控底线 44px（规范 2.5 / 9）；sm 在桌面 36px，≤900 档抬到 44。
        sm: 'min-h-9 gap-1.5 px-3 text-tok tracking-widest max-sheet:min-h-11',
        md: 'min-h-11 gap-2 px-4 text-ui-sm',
        lg: 'min-h-12 gap-2 px-5 text-ui-sm',
      },
      full: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // 纯文字/链接形态只归零 padding，不再把 min-h 归零：
      // 归零后经 cn()（tailwind-merge 后者覆盖前者）会压掉 size 的 min-h，
      // 这类按钮实际高度会跌到 20px 上下，跌破触控下限。
      { variant: 'quiet', class: 'py-0' },
      { variant: 'link', class: 'py-0 min-h-9' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      full: false,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 异步进行中：禁用 + aria-busy。文案由调用方切换（见文件头说明）。 */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, full, loading, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      // loading 与 disabled 是「或」关系：任一为真都不可点。
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...rest}
    />
  );
});
