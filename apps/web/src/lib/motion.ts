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

/** 平滑滚动的 behavior：尊重系统偏好。 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
