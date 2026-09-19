/**
 * 紧凑顶栏（PRD §6「空间不占首屏」）：主内容区只有学习动作，
 * 图谱 / 测评 / 对话 / 报告 / 云盘 五个入口在此；空间管理收进二级入口（不占首屏）。
 *
 * 批 3 在此接入「空间切换」二级菜单（space store + 409 切换对话框）。
 */

import { Link, NavLink } from 'react-router-dom';

import { SPACES_PATH, navRoutes } from '../router';

export default function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 px-6 py-3">
        <Link to={SPACES_PATH} className="mr-4 text-sm font-medium tracking-wide text-ink">
          知微
        </Link>

        <ul className="flex flex-1 items-center gap-1">
          {navRoutes().map((route) => (
            <li key={route.path}>
              <NavLink
                to={route.path}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-canvas',
                  ].join(' ')
                }
              >
                {route.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <Link
          to={SPACES_PATH}
          className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas"
          title="学习空间（次要入口，不占首屏）"
        >
          空间
        </Link>
      </nav>
    </header>
  );
}
