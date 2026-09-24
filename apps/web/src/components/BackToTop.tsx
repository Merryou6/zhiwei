/**
 * 返回顶部浮动按钮（2026-09-23 新增功能）。
 *
 * 长页面（学习报告、知识图谱、测评）滚动超过一屏后出现，点击平滑回到顶部。
 * 位置固定在视口右下，属「非阻断辅助控件」：不抢焦点、不挡主操作（避开右下角表单提交区）。
 * 入场用 .fab-rise（prefers-reduced-motion 下被降级为瞬时）。
 */

import { useEffect, useState } from 'react';

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
    <button
      type="button"
      aria-label="返回顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      // z-index 走令牌（D12：原为裸 z-40）；bottom/right 走安全区工具类（D14）——
      // 桌面非刘海设备 env(safe-area-inset-*) 恒为 0，计算值与 1.5rem 逐字相同。
      className="fab-rise fixed bottom-safe-6 right-safe-6 z-nav flex h-11 w-11 items-center justify-center rounded-control border border-line bg-surface text-ink-soft shadow-[var(--shadow-card)] transition-colors hover:border-accent hover:text-accent"
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
    </button>
  );
}
