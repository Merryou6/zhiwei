/**
 * 数字滚动 hook（2026-10-09 交互峰值包）
 *
 * 用途：批改总评的通过率、「本周点亮 +N」这类**结果型数字**从 0 爬到目标值——
 * 让「计数被结算」这件事被看见，而不是静态文本的硬切换。
 *
 * 设计约束：
 * - 减弱动态效果（prefers-reduced-motion）→ 跳过动画直接显示终值；
 *   CSS 侧的降级块管不到 JS 驱动的逐帧setState，必须在 hook 内自行降级。
 * - rAF 循环里的 setState 只在叶子组件里调用（调用方包一层小组件，
 *   例如 GraphPage 的 WeekCount），避免 60fps 重渲染整页。
 * - 卸载 / target 变化时取消 rAF 与 delay 定时器，不残留帧回调。
 */

import { useEffect, useState } from 'react';

import { prefersReducedMotion } from './motion';

/**
 * easeOutCubic —— 全站入场动画缓动曲线 cubic-bezier(0.16, 1, 0.3, 1) 的 JS 近似：
 * 前段快（数字很快爬到大部分进度）、后段缓（收尾落定），与 reveal-in 同一条手感。
 */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export interface CountUpOptions {
  /** 从 0 爬到 target 的时长（ms），默认 700。 */
  duration?: number;
  /** 起跳前的等待（ms）。用于「等点火动画落位再滚动」的尾注编排。 */
  delay?: number;
}

/**
 * 数字滚动：返回当前应显示的值（未取整；调用方按语义取整）。
 * target 变化时重新从 0 爬升（结果重置 → 重新结算的场景由调用方卸载/重挂载承担）。
 */
export function useCountUp(target: number, options?: CountUpOptions): number {
  const duration = options?.duration ?? 700;
  const delay = options?.delay ?? 0;
  // 首帧就要正确：reduced-motion 下初始即终值，避免「闪一下 0 再跳 N」。
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }
    if (target === 0) {
      setDisplay(0);
      return;
    }

    let cancelled = false;
    let raf = 0;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const startedAt = performance.now();
      const tick = (now: number): void => {
        if (cancelled) return;
        const progress = duration > 0 ? Math.min(1, (now - startedAt) / duration) : 1;
        setDisplay(target * easeOutCubic(progress));
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);

  return display;
}
