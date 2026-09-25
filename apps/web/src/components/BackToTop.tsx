/**
 * 返回顶部浮动按钮（2026-09-23 新增功能；2026-09-25 P1c 收敛到原语）
 *
 * 长页面（学习报告、知识图谱、测评）滚动超过一屏后出现，点击平滑回到顶部。
 * 位置固定在视口右下，属「非阻断辅助控件」：不抢焦点、不挡主操作（避开右下角表单提交区）。
 *
 * 【P1c 修掉的三处静默失效】
 *   ① 入场类 `fab-rise` 在全仓**从未被定义**（index.css 里没有任何 @keyframes），
 *      注释写着「入场用 .fab-rise」但实际什么都没发生 —— 已换成令牌动画 `animate-rise`。
 *   ② `shadow-[var(--shadow-card)]` 是任意值写法，等价于 `shadow-card` 令牌，
 *      但绕过了 token 体系 —— 已改走 `shadow-overlay`（浮起层该比静态卡更明显）。
 *   ③ 平滑滚动写死 `behavior: 'smooth'`，无视系统的「减弱动态效果」偏好 ——
 *      改走 lib/motion 的 `scrollBehavior()`，尊重 prefers-reduced-motion。
 */

import { useEffect, useState } from 'react';

import { scrollBehavior } from '../lib/motion';
import { IconButton } from './ui';

const SHOW_AFTER = 480; // 滚动超过该像素数才出现

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <IconButton
      aria-label="返回顶部"
      variant="raised"
      size="md"
      onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
      // z-index 走令牌（原为裸 z-40）；bottom/right 走安全区工具类 ——
      // 桌面非刘海设备 env(safe-area-inset-*) 恒为 0，计算值与 1.5rem 逐字相同。
      // 两个安全区工具类必须保留：tests/breakpoints.test.ts 要求每个类都有真实使用点。
      className="animate-rise fixed bottom-safe-6 right-safe-6 z-nav"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 19V5M12 5l-6 6M12 5l6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconButton>
  );
}
