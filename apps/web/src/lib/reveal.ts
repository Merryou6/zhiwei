import { useEffect } from 'react';

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
 * 给待揭示区块展开的 props：`<div className="…" {...revealItem}>`。
 * 用展开而不是在 JSX 里写死 `data-reveal-item=""`，是为了让属性名只有一个来源 ——
 * CSS 侧的选择器与这里的常量必须逐字一致，两处各写一遍就会静默失效
 * （属性名写错时浏览器不报错，只是永不揭示）。
 */
export const revealItem = { [REVEAL_ITEM_ATTR]: '' } as const;

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
 * 先给「已经在视口里」的项打完成标记。
 *
 * ⚠ 这一步**必须在挂启用开关之前**做。原因是时序：观察器的回调是异步的
 * （observe 之后浏览器在下一帧才派发初始状态），而挂上开关的那一刻 CSS 规则就生效了。
 * 若不先标记，首屏内的区块会经历「可见 → 被隐藏 → 被观察器揭示」这一帧的闪烁 ——
 * 内容没有丢，但加载瞬间会明显地抖一下，比不做动画更糟。
 *
 * 判据用 rect.top < 视口高：不要求完整进入视口，只要顶部已经进入可视区就算
 * 「用户已经看得见它」。元素在视口上方（滚过去了）同样视为已见。
 */
export function markInViewDone(scope: Element): void {
  const viewportHeight =
    (typeof window !== 'undefined' && window.innerHeight) ||
    document.documentElement.clientHeight ||
    0;

  scope.querySelectorAll(`[${REVEAL_ITEM_ATTR}]:not([${REVEAL_DONE_ATTR}])`).forEach((el) => {
    if (el.getBoundingClientRect().top < viewportHeight) {
      el.setAttribute(REVEAL_DONE_ATTR, '');
    }
  });
}

/**
 * 当前已装配的揭示消费者数量。
 *
 * 作用域落在 `<html>` 上时，多个消费者会共用同一个开关属性 —— 若不做计数，
 * 先卸载的那个会把开关摘掉，后卸载的那个就再也不会揭示（属性没了，
 * 预置态规则失效，**此时反而是「全都可见」**，所以症状不是内容消失而是动效静默消失，
 * 更难查）。计数保证只有最后一个消费者真正摘开关。
 */
let armedConsumers = 0;

/**
 * React 侧入口：装配当前页面的滚动揭示。**无需容器 ref** —— 作用域直接落在
 * `<html>` 上。
 *
 * 为什么不设计成「传一个容器 ref」：那要求调用方在页面上再包一层 div，
 * 而这一层会改变 tools/responsive-audit.cjs 取锚点的方式（mainChild 是 main 的第一个
 * 子元素），锚点几何是取证基线的一部分。揭示是纯表现层的事，不该换来 DOM 结构变化。
 *
 * 环境不允许时**什么都不做**（属性不挂，区块按 CSS 默认保持可见）。
 */
export function useReveal(): void {
  useEffect(() => {
    if (!revealAvailable()) return;

    const root = document.documentElement;
    if (armedConsumers === 0) {
      // 顺序不能换：先标记首屏内的项，再挂开关（见 markInViewDone 的说明）。
      markInViewDone(root);
      root.setAttribute(REVEAL_SCOPE_ATTR, 'on');
    }
    armedConsumers += 1;

    const stop = observeReveal(root);
    return () => {
      stop();
      armedConsumers -= 1;
      if (armedConsumers === 0) root.removeAttribute(REVEAL_SCOPE_ATTR);
    };
  }, []);
}
