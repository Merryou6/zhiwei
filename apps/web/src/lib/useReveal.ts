import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion, subscribePrefersReducedMotion } from './motion';

/**
 * 滚动叙事的章节揭示 hook（2026-10-09 awwwards 适配包 1 · 跨包契约）
 *
 * 返回 { ref, inView }：把 ref 挂到章节容器上，inView 变 true 后由组件加揭示类
 * （配套样式是 index.css 的 .reveal-section / .is-revealed，keyframes 就地定义）。
 * once 语义：进入视口即揭示并停止观察，回滚不重播——滚动叙事要的是「读到才出现」，
 * 不是「来回表演」，这也是克制人设（不施压、不说教）在动效上的落点。
 *
 * 为什么不并入 lib/reveal.ts 的 data-reveal 体系：那套体系是全站通用的渐进增强
 * （开关属性挂在 <html>、配静态安全网），适合普通内容区块；滚动叙事的章节是
 * 「导演过的段落」，需要按组件粒度拿 inView 布尔去编排（每章独立触发、逐条
 * 错峰），属性开关模型表达不了这个粒度。两套并存，语义分工写在两边注释里。
 *
 * 失败路径全部按「可见」兜底（与 lib/reveal.ts 同一哲学：隐藏是被授予的权限，
 * 不是默认状态）：
 *   · 环境读取异常（try/catch，SSR / 非常规环境安全）→ 直接 true；
 *   · 无 IntersectionObserver（老环境 / 未 mock 的测试环境）→ 直接 true；
 *   · 用户要求减弱动效 → 直接 true（不做「先藏后显」，终态即刻到达）；
 *   · 运行中才开启减弱动效 → subscribePrefersReducedMotion 补揭示，
 *     堵住「隐藏了却不揭示」这一揭示机制最危险的失败形态。
 */
export interface UseRevealResult<T extends HTMLElement> {
  /** 挂到待揭示元素上的 ref。 */
  ref: { current: T | null };
  /** 是否已揭示（once：置 true 后不会回到 false）。 */
  inView: boolean;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(): UseRevealResult<T> {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 减弱动效：跳过「先藏后显」，直接按已揭示处理。
    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }

    // 页面存续期间用户开启「减弱动态效果」：立即补揭示。
    const offPreference = subscribePrefersReducedMotion((reduced) => {
      if (reduced) setInView(true);
    });

    try {
      if (typeof IntersectionObserver !== 'function') {
        setInView(true);
        return offPreference;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setInView(true);
              observer.disconnect(); // once：揭示一次即收摊
              break;
            }
          }
        },
        // 下边界内收 10%：元素刚探进视口底缘不急着揭示，等真正进入阅读区域
        //（取值与 lib/reveal.ts 的既有观察器同思路，量级一致）。
        { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
      );
      observer.observe(el);

      return () => {
        observer.disconnect();
        offPreference();
      };
    } catch {
      // 环境异常（含 SSR 水合等非常规路径）：宁可没有动效，不可内容隐形。
      setInView(true);
      return offPreference;
    }
  }, []);

  return { ref, inView };
}
