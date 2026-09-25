/**
 * Badge（2026-09-25 视觉重构 P1b）
 *
 * 【它替换掉什么】
 * 收敛前徽标有 6 种各写各的形态：`bg-band-unstable/15 text-band-unstable`、
 * `bg-band-mastered/10`、`bg-band-weak/10`、`bg-canvas text-ink-soft`、
 * `border border-line bg-surface`、`bg-accent-veil text-accent`。
 * 同一个「已掌握」在不同页面可能是 /10 也可能是 /15，透明度全靠手写记忆。
 *
 * 【三个必须遵守的约束】
 *
 * ① ⚠ band 的颜色必须写成**完整字面量类名**，绝不能运行时拼接。
 *    Tailwind 是「按源码文本扫描」产出 CSS 的：`bg-band-${band}` 这种写法生成的
 *    类名不会被扫到，构建产物里根本没有这条规则 —— 徽标会静默变成透明底，
 *    不报错、不警告。所以下面是逐条写死的 BAND_BADGE 表。
 *    颜色令牌名仍用 band-weak / band-unstable / band-basic / band-mastered
 *    （取自 tailwind 的守恒区，与 src/theme/bands.ts 同源），
 *    与 tests/bands.test.ts 对 BAND_CLASS 的断言不冲突 ——
 *    那条断言管的是 `BAND_CLASS[band].bg/text/border` 本身的取值，不是禁止别处引用同名字面量。
 *
 * ② ⚠ 透明度分母**必须是 5 的倍数**（Tailwind 默认 opacity 刻度：
 *    0/5/10/15/…/100）。写 `/12`、`/18` 这类值**不会产出任何 CSS**，
 *    同样静默失效。这不是理论风险 —— 本轮之前全站有 12 处
 *    「band 色令牌 + /12」的写法一直在无声失效
 *    （「已验证」「当前使用」等徽标其实没有底色），已统一收敛到 /10。
 *    要非刻度值只能写成任意值形式 `/[0.12]`，但本文件一律不用，保持刻度一致。
 *
 * ③ 为什么不直接复用 BAND_CLASS：BAND_CLASS 给的是**实心**取值（`bg-band-weak`），
 *    适合状态点、进度条这类实色标记；徽标要的是**淡底**（`bg-band-weak/10`）+ 同色文字，
 *    两者是同一色相的不同用法，不是同一个东西。混用会让徽标变成一块实色砖。
 */

import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import type { MasteryBand } from '../../theme/bands';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium',
  {
    variants: {
      tone: {
        /** 内部用：给了 band 时用它压掉 tone 的底色，避免两套颜色叠加。 */
        none: '',
        /** 中性元信息：ID、编号、计数。 */
        neutral: 'bg-canvas text-ink-soft',
        /** 品牌强调：当前空间、路径高亮、模型标识。 */
        accent: 'bg-accent-veil text-accent',
        /** 正向：已验证、掌握度上升。 */
        positive: 'bg-band-mastered/10 text-band-mastered',
        /** 负向（低饱和暖橙，不是刺眼大红）：待巩固、掌握度下降。 */
        negative: 'bg-band-weak/10 text-band-weak',
        /** 待确认：不稳定、识别存疑。 */
        warning: 'bg-band-unstable/15 text-band-unstable',
        /** 描边式：需要克制、不想引入色块时（如角色标识）。 */
        outline: 'border border-line bg-surface text-ink-soft',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-caption',
        md: 'px-2 py-0.5 text-xs',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
    },
  },
);

/**
 * 掌握度四状态带 → 徽标淡底 + 同色文字。
 * 键必须与 `BAND_ORDER`（src/theme/bands.ts）逐字一致，改一处要改两处。
 */
const BAND_BADGE: Record<MasteryBand, string> = {
  待巩固: 'bg-band-weak/10 text-band-weak',
  不稳定: 'bg-band-unstable/15 text-band-unstable',
  基本掌握: 'bg-band-basic/10 text-band-basic',
  已掌握: 'bg-band-mastered/10 text-band-mastered',
};

export interface BadgeProps extends Omit<VariantProps<typeof badgeVariants>, 'tone'> {
  tone?: Exclude<NonNullable<VariantProps<typeof badgeVariants>['tone']>, 'none'>;
  /** 给掌握度状态带时按四色语义着色，**优先于 tone**（会压掉 tone 的底色与文字色）。 */
  band?: MasteryBand;
  className?: string;
  children?: ReactNode;
}

export function Badge({ tone, size, band, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        badgeVariants({ tone: band ? 'none' : tone, size }),
        band ? BAND_BADGE[band] : undefined,
        className,
      )}
    >
      {children}
    </span>
  );
}
