/**
 * Card / CardHeader / CardTitle / CardContent / CardFooter（2026-09-25 视觉重构 P1b）
 *
 * 【它替换掉什么】
 * 收敛前没有卡片组件，同一串 class 在 6 个文件里各抄一遍，还出现了三套内边距
 * （p-4 / p-5 / p-6）表达同一件事；更要命的是**卡中卡**：外层 `rounded-2xl` 里
 * 再套一层 `rounded-xl`，两层边框加两层阴影，层级噪音很大。
 *
 * 【三档 variant 的分工 —— 这是「克制使用卡片」的机制，不是装饰选项】
 *   plain  静态承载块：边框 + 浅阴影。页面的第一层信息容器，一个页面用几张。
 *   raised 真正浮起的层：更强的阴影。只给对话框、下拉、浮在内容上的明细卡。
 *   quiet  下沉的区块：**无边框、无阴影**，只靠表面色与页面底色区分。
 *          它的存在意义是「让嵌套内容不再是卡片」—— 卡里的分组用 quiet，
 *          就自然得到「一层卡 + 若干安静区块」，而不是「卡里还有卡」。
 *   bare   完全无装饰。给「本来就不该有边界」的内容用（例如 Hero）。
 *
 * ⚠ quiet 的底色为什么是 surface 而不是 canvas（P3 走查实测修正）：
 *   第一版把 quiet 写成 bg-canvas，结果在真实页面上**完全看不见** ——
 *   页面底色（body bg-canvas）与它逐字相同，容器边界彻底消失，标题和进度条
 *   像浮在空气里。浅色下同样失效（canvas #F5F8F9 也是页面底色）。
 *   真正的分工是：
 *     · 页面底             = canvas
 *     · quiet 容器         = surface（比页面底亮/深一档，无边框无阴影 → 比 plain 安静）
 *     · 卡片内部的凹陷块   = canvas（此时外层是 surface，canvas 才有对比）
 *   即 canvas 是「嵌在 surface 里的凹陷」，不是「页面上的容器」。
 *
 * 【为什么 base 里带 space-y-3】
 * 卡片内部各段之间的垂直节奏本该是一致的，但收敛前是每处手写 mt-4 / mt-5 / mt-3。
 * 这里用 `space-y-3` 统一：它只出现在**相邻兄弟之间**，所以
 *   · 只有一段内容的卡片 —— 零影响；
 *   · 头部 + 内容 + 页脚 —— 自动获得 12px 节奏。
 * 需要别的节奏时在 Card 上覆盖（如 `className="space-y-0"`），cn() 会正确消解。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

export const cardVariants = cva('rounded-surface space-y-3', {
  variants: {
    variant: {
      plain: 'border border-line bg-surface shadow-card',
      raised: 'border border-line bg-surface shadow-overlay',
      quiet: 'bg-surface',
      bare: '',
    },
    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
    /** 整卡可点时用：给 hover 反馈。plain 描边加深，quiet 底面上浮一档。 */
    interactive: {
      true: 'transition-colors duration-150 ease-out',
      false: '',
    },
  },
  compoundVariants: [
    // 描边式可以靠边框加深表达 hover；quiet 没有边框，只能靠底色。
    { variant: 'plain', interactive: true, class: 'hover:border-accent' },
    { variant: 'quiet', interactive: true, class: 'hover:bg-raised' },
  ],
  defaultVariants: {
    variant: 'plain',
    padding: 'md',
    interactive: false,
  },
});

export interface CardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'className'>,
    VariantProps<typeof cardVariants> {
  className?: string;
  children?: ReactNode;
}

/**
 * 开放标准的 div 属性（id / aria-* / data-* / onClick）：
 * 卡片经常需要被当作滚动锚点（id）、被读屏描述（aria-labelledby）或被整体点击。
 * 把它们挡住只会逼调用方在外面再套一层没有意义的 div。
 */
export function Card({ className, variant, padding, interactive, children, ...rest }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding, interactive }), className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  // text-lg(18px) 而非 text-base(16px)：卡片标题与正文(14px) 之间必须有一段**看得见**的
  // 阶差。16→14 只差 2px，中文正文下几乎读不出层级，一排卡片就会糊成一片「等权方块」——
  // 这正是改版前 AttributionPage 最明显的问题。18→14 是 1.29 倍，一眼分得开。
  return (
    <h2 className={cn('text-lg font-medium text-ink', className)} {...rest}>
      {children}
    </h2>
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'className'> {
  title?: ReactNode;
  /** 标题下的一行说明。 */
  description?: ReactNode;
  /** 右侧操作区，与标题同一行、顶部对齐。 */
  actions?: ReactNode;
  className?: string;
  /** 需要完全自定义版式时用它替代 title/description/actions。 */
  children?: ReactNode;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)} {...rest}>
      {children ?? (
        <>
          <div className="min-w-0">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? (
              <p className="mt-1 text-ui-sm leading-relaxed text-ink-soft">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
        </>
      )}
    </div>
  );
}

export function CardContent({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)} {...rest}>
      {children}
    </div>
  );
}
