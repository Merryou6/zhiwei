/**
 * 页面外壳：顶栏 + 主内容区 + 非阻断 Toast 出口（stores/ui.ts 驱动）。
 *
 * 内容宽度对齐控制台原型（zhiwei-console .page）：max-width 1320px，
 * 留白 30px 32px 72px（页面自己决定单栏/两栏，外壳只负责留白与底色）。
 *
 * 视觉改版（2026-09-22）：Toast 出口抽到 ToastHost，与「无外壳」的登录页共用一份队列。
 */

import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import BackToTop from './BackToTop';
import ToastHost from './ToastHost';
import TopNav from './TopNav';

export interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <TopNav />
      {/* key=pathname：换路由即重挂载内容容器 → content-rise 入场动效重播 */}
      <main className="mx-auto w-full max-w-[1320px] px-8 pb-[72px] pt-[30px] max-[720px]:px-6">
        <div key={location.pathname} className="content-rise">
          {children}
        </div>
      </main>
      <BackToTop />
      <ToastHost />
    </div>
  );
}
