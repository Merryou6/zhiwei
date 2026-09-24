/**
 * 页面外壳：顶栏 + 主内容区 + 非阻断 Toast 出口（stores/ui.ts 驱动）。
 *
 * 内容宽度固定 max-w-5xl（一屏一件事：页面自己决定单栏/两栏，外壳只负责留白与底色）。
 *
 * 视觉改版（2026-09-22）：Toast 出口抽到 ToastHost，与「无外壳」的登录页共用一份队列。
 */

import { type ReactNode } from 'react';

import ToastHost from './ToastHost';
import TopNav from './TopNav';

export interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
      <ToastHost />
    </div>
  );
}
