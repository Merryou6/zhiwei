/**
 * 页面外壳：顶栏 + 主内容区 + 非阻断 Toast 出口。
 *
 * 内容宽度固定 max-w-5xl（一屏一件事：页面自己决定单栏/两栏，外壳只负责留白与底色）。
 */

import type { ReactNode } from 'react';

import TopNav from './TopNav';

export interface LayoutProps {
  children: ReactNode;
  /** Toast 出口（批 2 由 stores/ui.ts 驱动；本批暂无队列）。 */
  toastSlot?: ReactNode;
}

export default function Layout({ children, toastSlot }: LayoutProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
      {toastSlot}
    </div>
  );
}
