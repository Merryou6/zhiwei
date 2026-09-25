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
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const buttonVariants = cva(
  // base：只放「所有按钮都成立」的事。过渡曲线按变体给（见下），
  // 因为主按钮要过渡 opacity、次级按钮过渡颜色，两者的 transition-property 不同，
  // 写在 base 里会互相覆盖。
  'inline-flex select-none items-center justify-center rounded-control font-medium ' +
    'disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-on-accent transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80',
        secondary:
          'border border-line bg-surface text-ink transition-colors duration-150 ease-out hover:border-accent/60 hover:bg-raised',
        ghost:
          'text-ink-soft transition-colors duration-150 ease-out hover:bg-raised hover:text-ink',
        /** 纯文字操作（「换一道」「回到上一步」）。不占盒模型，不用在行内加方块。 */
        quiet: 'px-2 text-ink-soft transition-colors duration-150 ease-out hover:text-ink',
        /**
         * 视觉上等同链接。用于「管理空间」这类附着在正文里的跳转。
         * hover 只用下划线，不用「文字变淡」：把 accent-ink 再乘 0.8 的透明度后
         * 对比度会从 5.95:1 掉到约 3.8:1，重新跌破 AA —— 悬停态不该变得难读。
         */
        link: 'p-0 text-accent-ink transition-colors duration-150 ease-out hover:underline',
      },
      size: {
        sm: 'min-h-8 gap-1.5 px-3 text-ui-sm max-nav:min-h-9',
        md: 'min-h-9 gap-2 px-4 text-sm',
        lg: 'min-h-11 gap-2 px-4 text-reading',
      },
      full: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // 纯文字/链接形态不参与盒模型：把尺寸给的 padding 与最小高度归零。
      // 依赖 cn() 的「后者覆盖前者」—— compoundVariants 排在 size 之后，
      // 因此这里的 min-h-0 / px-0 能压掉上面 size 给的 min-h-* / px-*。
      { variant: 'quiet', class: 'min-h-0 px-2 py-0' },
      { variant: 'link', class: 'min-h-0 px-0 py-0' },
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
