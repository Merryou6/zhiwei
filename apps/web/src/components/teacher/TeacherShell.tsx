/**
 * 老师端壳（v1.6 双端）：/t/* 路由族的顶栏外壳。
 *
 * 与学生端 Layout 分离的理由：导航真相不同——老师不需要测评/对话/云盘入口，
 * 需要的是「工作台 / 推荐管理」两个视图 + 随时回学生端的能力（demo 双端切换）。
 * 主题与 Toast 与学生端同源（useThemeStore / ToastHost 已在 App 层挂载）。
 */

import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { LOGIN_PATH, SPACES_PATH } from '../../router';
import { useAuthStore } from '../../stores/auth';
import { useSpaceStore } from '../../stores/space';
import { useUiStore } from '../../stores/ui';
import { cn } from '../../lib/cn';

const NAV_ITEMS = [
  { to: '/t', label: '工作台', exact: true },
  { to: '/t/recommendations', label: '推荐管理', exact: false },
] as const;

export default function TeacherShell({ children }: { children: ReactElement }) {
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clear);
  const clearSpaces = useSpaceStore((state) => state.clear);
  const toast = useUiStore((state) => state.toast);

  function handleLogout(): void {
    clearAuth();
    clearSpaces();
    toast('已退出老师端');
    navigate(LOGIN_PATH, { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="text-base font-semibold tracking-wide text-ink">
            知微 · <span className="text-accent-ink">老师端</span>
          </span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-accent-veil text-ink' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-ui-sm">
            <Link to={SPACES_PATH} className="text-ink-soft hover:text-ink">
              学生端
            </Link>
            <button type="button" onClick={handleLogout} className="text-ink-soft hover:text-ink">
              退出
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
