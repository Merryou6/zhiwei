import { useEffect, useRef } from 'react';

import { prefersReducedMotion } from './motion';

/**
 * 滚动揭示机制（2026-09-25 视觉重构 P0）
 *
 * 为什么单开一个模块：揭示是**动效里唯一会「隐藏内容」的一种**，所以它的失败模式
 * 比入场动画严重得多 —— 入场动画不播放只是少了点观感，揭示机制出问题则是**内容看不见**。
 * 因此它必须走渐进增强，且必须有独立的安全网与断言。
 *
 * 渐进增强的三段式（顺序不能换）：
 *   ① CSS 默认：元素**完全可见**。index.css 里的预置态规则带
 *      `[data-reveal='on']` 前缀，属性不存在时整条规则不生效。
 *   ② JS 就绪且允许动效：`useRevealScope` 给作用域元素挂 REVEAL_SCOPE_ATTR，
 *      此刻才启用「先隐藏、进入视口再揭示」。
 *   ③ 任何一条不满足（无 IntersectionObserver / 用户要求减弱动效 / JS 未执行 /
 *      打印）：属性不挂 → 元素一律可见。
 *
 * 换句话说：**隐藏是被授予的权限，不是默认状态。**
 * 反过来写（CSS 默认 opacity-0 + JS 负责揭示）在 reduce 或打印下会让首屏之外的
 * 区块永久隐形 —— 那是一个真实缺陷，不是风格取舍。
 */

/** 作用域属性：挂在父容器上，是「启用揭示」的唯一开关。 */
export const REVEAL_SCOPE_ATTR = 'data-reveal';

/** 揭示项属性：挂在每个待揭示的区块上。 */
export const REVEAL_ITEM_ATTR = 'data-reveal-item';

/** 完成标记：进入过视口后由观察器打上，打上即不再隐藏。 */
export const REVEAL_DONE_ATTR = 'data-revealed';

/**
 * 当前环境是否允许启用揭示。
 * 三个条件缺一不可：有 IntersectionObserver、用户未要求减弱动效、能安全读取环境。
 */
export function revealAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (typeof window.IntersectionObserver !== 'function') return false;
    return !prefersReducedMotion();
  } catch {
    return false;
  }
}

/** 给作用域元素挂启用开关。返回撤销函数（必须在卸载时调用）。 */
export function armReveal(scope: Element): () => void {
  scope.setAttribute(REVEAL_SCOPE_ATTR, 'on');
  return () => scope.removeAttribute(REVEAL_SCOPE_ATTR);
}

/**
 * 观察作用域内的揭示项：进入视口即标记完成并停止观察。
 * 已在首屏内的元素由观察器的首次回调处理（observe 之后会立刻收到一次初始状态），
 * 因此不需要额外的「首屏立即揭示」分支。
 */
export function observeReveal(scope: Element): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute(REVEAL_DONE_ATTR, '');
        observer.unobserve(entry.target);
      }
    },
    // 下边界内收 8%：元素刚探进视口底缘时不急着揭示，等它真正进入阅读区域。
    { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
  );

  scope
    .querySelectorAll(`[${REVEAL_ITEM_ATTR}]:not([${REVEAL_DONE_ATTR}])`)
    .forEach((el) => observer.observe(el));

  return () => observer.disconnect();
}

/**
 * React 侧入口：把 ref 挂到要作为揭示作用域的容器上。
 * 环境不允许时**什么都不做**（属性不挂，区块按 CSS 默认保持可见）。
 */
export function useRevealScope<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const scope = ref.current;
    if (!scope) return;
    if (!revealAvailable()) return;

    const disarm = armReveal(scope);
    const stop = observeReveal(scope);
    return () => {
      stop();
      disarm();
    };
  }, []);

  return ref;
}
