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
 *   quiet  下沉的区块：**无边框、无阴影**，只靠底色（canvas）与卡片表面区分。
 *          它的存在意义就是「让嵌套内容不再是卡片」—— 卡里的分组用 quiet，
 *          就自然得到「一层卡 + 若干下沉区块」，而不是「卡里还有卡」。
 *   bare   完全无装饰。给「本来就不该有边界」的内容用（例如 Hero）。
 *
 * 【为什么 base 里带 space-y-3】
 * 卡片内部各段之间的垂直节奏本该是一致的，但收敛前是每处手写 mt-4 / mt-5 / mt-3。
 * 这里用 `space-y-3` 统一：它只出现在**相邻兄弟之间**，所以
 *   · 只有一段内容的卡片 —— 零影响；
 *   · 头部 + 内容 + 页脚 —— 自动获得 12px 节奏。
 * 需要别的节奏时在 Card 上覆盖（如 `className="space-y-0"`），cn() 会正确消解。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export const cardVariants = cva('rounded-surface space-y-3', {
  variants: {
    variant: {
      plain: 'border border-line bg-surface shadow-card',
      raised: 'border border-line bg-surface shadow-overlay',
      quiet: 'bg-canvas',
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

export interface CardProps extends VariantProps<typeof cardVariants> {
  className?: string;
  children?: ReactNode;
}

export function Card({ className, variant, padding, interactive, children }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding, interactive }), className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h2 className={cn('text-base font-medium text-ink', className)}>{children}</h2>;
}

export interface CardHeaderProps {
  title?: ReactNode;
  /** 标题下的一行说明。 */
  description?: ReactNode;
  /** 右侧操作区，与标题同一行、顶部对齐。 */
  actions?: ReactNode;
  className?: string;
  /** 需要完全自定义版式时用它替代 title/description/actions。 */
  children?: ReactNode;
}

export function CardHeader({ title, description, actions, className, children }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
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

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>;
}
