/**
 * IconButton（2026-09-25 视觉重构 P1b）
 *
 * 【为什么不并入 Button】
 * 两者的尺寸决定方式根本不同：
 *   · Button  —— 高度由「字号 + padding + 最小高度」共同决定，宽度跟着文案走；
 *   · IconButton —— 正方形触控目标，尺寸由边长独立决定，与文字无关。
 * 更关键的是无障碍契约不同：Button 有可见文字，IconButton **没有**。
 * 所以这里把 `aria-label` 提升为**必填**（见下），让「图标按钮必须有名字」
 * 从「靠人记得」变成「不写就编译不过」。
 *
 * 收敛前这些位置是手写的 `grid h-9 w-9 place-items-center rounded-control border
 * border-line ...`（顶栏汉堡键、抽屉关闭键、返回顶部、图谱节点卡关闭键），
 * 每处的 hover / 焦点 / 禁用都各写各的。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const iconButtonVariants = cva(
  // ── 2026-10-10 style-10 蓝图迁移 P4：规范 5.2 ─────────────────────────
  // 44×44 保底、1px 线、透明底、hover 转 accent 边 + accent 图标 + accent-veil 底。
  // ⚠ 不再挂 opacity 压暗表达禁用：与 Button 同一理由（禁用走虚线/斜纹语义）。
  'grid flex-none place-items-center rounded-control transition-colors duration-150 ease-out ' +
    'disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        /** 描边式：浮在内容上、需要自己划出边界（图签条的开关按钮、抽屉关闭键）。 */
        outline:
          'border border-line bg-transparent text-ink-soft hover:border-accent hover:bg-accent-veil hover:text-accent-ink',
        /** 有影浮起（返回顶部）。比 outline 多一层「离开了页面平面」的表达。 */
        raised:
          'border border-line bg-surface text-ink-soft shadow-overlay hover:border-accent hover:bg-accent-veil hover:text-accent-ink',
        /** 无边界：贴在卡片内部，靠 hover 底色表达可点（图谱节点明细卡关闭键）。 */
        quiet: 'text-ink-soft hover:bg-accent-veil hover:text-ink',
        /** 实心主色。 */
        solid: 'bg-accent text-on-accent hover:bg-accent-ink',
      },
      size: {
        /** 36px（桌面）；md/sm 视口档与粗指针环境由 CSS 抬到 44（规范 5.2）。 */
        sm: 'h-9 w-9 max-sheet:h-11 max-sheet:w-11',
        /** 44px —— 独立浮起的主触控目标（返回顶部）与触控档保底。 */
        md: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'sm',
    },
  },
);

/**
 * `aria-label` 被 Omit 后又以必填形式加回：这是本组件唯一不可省略的 prop。
 * 图标按钮没有可见文字，缺了它对读屏用户就是「按钮」两个字，等于没有。
 */
export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...rest}
    />
  );
});
