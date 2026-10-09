/**
 * 动效偏好工具（前端优化批三 · 2026-09-22）
 *
 * 全站 transition 由 index.css 的 reduced-motion 媒体查询统一降级；
 * 但 JS 侧主动发起的平滑滚动（scrollIntoView smooth）不受 CSS 管，
 * 需要按同一偏好降级为瞬时滚动（系统开了「减弱动态效果」时不做长距离动画）。
 */

/** 系统是否要求减弱动态效果（环境不支持或读取失败按「不减弱」处理）。 */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  } catch {
    return false;
  }
}

/**
 * 订阅偏好变化（2026-10-09 复评 P3）：运行中切换「减弱动态效果」时收到通知。
 * 此前的偏好只在挂载时读一次 —— 用户开着页面切系统设置，正在爬的数字 / 下次重绘
 * 都感知不到。返回退订函数；环境不支持 matchMedia 时返回空退订。
 */
export function subscribePrefersReducedMotion(callback: (reduced: boolean) => void): () => void {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent): void => callback(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  } catch {
    return () => {};
  }
}

/** 平滑滚动的 behavior：尊重系统偏好。 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
