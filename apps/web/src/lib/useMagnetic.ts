/**
 * 磁性 hover（2026-10-10 awwwards 适配包 G）
 *
 * 设计依据（awwwards 2026 micro-interactions）：主 CTA 在悬停时向光标轻微
 * 「吸引」，是获奖站点表达「这个元素可以按、且欢迎按」的最小动效语言。
 * 本实现刻意克制：
 *   · 最大位移 6px（乘以 strength 后夹取）——超过 8px 就从「吸引」变成「追逐」，
 *     对学习产品「学长」的人设是施压，不是邀请；
 *   · 跟随 transition 150ms ease-out（跟手感），离开归位 250ms（略慢的回弹）；
 *   · 归位结束后**清除内联 transition**，把过渡属性还给组件类名 —— 否则
 *     Button primary 的 transition-opacity 会被内联样式永久压掉，hover 反馈退化。
 *
 * 无障碍与触屏：
 *   · prefersReducedMotion() 为 true 时两个 handler 直接 no-op（与 CSS 侧
 *     全局 reduce 块同一哲学：JS 主动发起的动效不归 CSS 管，必须自己降级）；
 *   · 触屏没有 mousemove，动效天然不触发，无需额外分支。
 *
 * 用法：<Button {...useMagnetic(0.2)} /> —— handler 一律读 event.currentTarget，
 * 同一实例可安全地 spread 到多个元素上。
 */

import type { MouseEvent } from 'react';

import { prefersReducedMotion } from './motion';

/** 单轴位移上限（px）：超过就不再是「磁性」而是「追逐光标」。 */
const MAX_SHIFT = 6;

export function useMagnetic(strength = 0.25): {
  onMouseMove: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave: (event: MouseEvent<HTMLElement>) => void;
} {
  function onMouseMove(event: MouseEvent<HTMLElement>): void {
    if (prefersReducedMotion()) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const clamp = (v: number): number => Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, v));
    const dx = clamp((event.clientX - (rect.left + rect.width / 2)) * strength);
    const dy = clamp((event.clientY - (rect.top + rect.height / 2)) * strength);
    el.style.transition = 'transform 150ms ease-out';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onMouseLeave(event: MouseEvent<HTMLElement>): void {
    if (prefersReducedMotion()) return;
    const el = event.currentTarget;
    el.style.transition = 'transform 250ms ease-out';
    el.style.transform = '';
    // 归位动画结束后交还过渡控制权（见文件头：不永久压掉组件自身的 transition）
    el.addEventListener(
      'transitionend',
      (e) => {
        if ((e as TransitionEvent).propertyName === 'transform') el.style.transition = '';
      },
      { once: true },
    );
  }

  return { onMouseMove, onMouseLeave };
}
