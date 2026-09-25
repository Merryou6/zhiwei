/**
 * class 名合并工具（2026-09-25 视觉重构 P1a）
 *
 * 【为什么需要它】
 * UI 原语必须允许调用方覆盖默认样式，最典型的是间距：
 *   <Card className="p-6">   ← 期望覆盖 Card 内建的 p-5，而不是两个都生效
 * 裸字符串拼接做不到「后者覆盖前者」，只会让两个 padding 同时存在，
 * 谁赢取决于生成的 CSS 顺序 —— 也就是不可预测。
 *
 * 【为什么必须 extendTailwindMerge，不能直接用 twMerge】
 * tailwind-merge 只认识 Tailwind 自己的刻度。本项目大量使用**自定义令牌**
 * （text-ui-sm / rounded-surface / shadow-card / z-nav / ease-out-soft），
 * 而 tailwind-merge 的默认配置里：
 *   · colors 用 `isAny` 兜底  → `text-caption` 会被误判进「文字颜色」组，
 *     于是 cn('text-caption text-ink') 里两者互相冲突、先出现的被吃掉；
 *   · rounded / shadow / z / ease 的默认校验器只认 Tailwind 原生刻度
 *     （t-shirt size、数字），`rounded-surface` 会被当成**未知类**放行 ——
 *     结果 `cn('rounded-surface rounded-lg')` 两个都保留，覆盖逻辑静默失效。
 * 把自定义令牌登记进来，令牌才能和原生类一样参与冲突消解。
 *
 * ⚠ 新增自定义令牌时必须同步登记到这里，否则该令牌在覆盖场景下会静默失效
 *   —— 不会报错，只会「看起来没生效」。
 *   （新增位置：apps/web/tailwind.config.js 的 theme.extend）
 */

import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // 字号刻度（tailwind.config.js → theme.extend.fontSize）
      'font-size': [{ text: ['caption', 'ui-sm', 'reading', 'display', 'display-lg'] }],
      // 圆角两档（theme.extend.borderRadius；微标签档走内置 rounded-md，无需登记）
      rounded: [{ rounded: ['control', 'surface'] }],
      // 阴影（theme.extend.boxShadow）
      shadow: [{ shadow: ['card', 'overlay', 'dusk-surface', 'dusk-raised'] }],
      // 层级（theme.extend.zIndex）
      z: [{ z: ['nav', 'overlay', 'toast'] }],
      // 缓动（theme.extend.transitionTimingFunction）
      ease: [{ ease: ['out', 'out-soft'] }],
    },
  },
});

/** 合并 tailwind class：后者覆盖前者的同类属性，条件类可传 false/null/undefined。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
