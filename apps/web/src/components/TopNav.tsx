/**
 * 紧凑顶栏（PRD §6「空间不占首屏」）：主内容区只放学习动作；
 * 图谱 / 测评 / 对话 / 报告 / 云盘 五个入口常驻，空间管理收进二级菜单（点开才展开）。
 *
 * 空间列表懒加载：已登录且 store 为空时取一次（#3 space/list）；失败静默——页 3 会给提示。
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { listSpaces } from '../api/endpoints';
import { SPACES_PATH, navRoutes } from '../router';
import { useAuthStore } from '../stores/auth';
import { useSpaceStore } from '../stores/space';

export default function TopNav() {
  const [open, setOpen] = useState(false);

  const token = useAuthStore((state) => state.token);
  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);

  useEffect(() => {
    if (!token || spaces.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await listSpaces();
        if (!cancelled) setSpaces(data.spaces);
      } catch {
        /* 静默：空间页负责给出可读提示 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, spaces.length, setSpaces]);

  const active = spaces.find((space) => space.space_id === activeSpaceId) ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 px-6 py-3">
        <Link to={token ? SPACES_PATH : '/login'} className="mr-4 text-sm font-medium tracking-wide text-ink">
          知微
        </Link>

        {token ? (
          <>
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

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-canvas"
                aria-expanded={open}
              >
                空间 · {active ? active.name : '未选择'}
              </button>

              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs text-ink-soft">切到另一个空间</p>
                  <ul>
                    {spaces.map((space) => (
                      <li key={space.space_id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActive(space.space_id);
                            setOpen(false);
                          }}
                          className={[
                            'w-full rounded-lg px-2 py-1.5 text-left text-sm',
                            space.space_id === activeSpaceId ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas',
                          ].join(' ')}
                        >
                          {space.name}
                          {space.is_default ? <span className="ml-1 text-xs text-ink-soft">（默认）</span> : null}
                        </button>
                      </li>
                    ))}
                    {spaces.length === 0 ? (
                      <li className="px-2 min-h-9 py-2 text-[13px] text-ink-soft">还没有空间</li>
                    ) : null}
                  </ul>
                  <Link
                    to={SPACES_PATH}
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-canvas"
                  >
                    管理空间 →
                  </Link>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <span className="flex-1 text-sm text-ink-soft">学习伴侣</span>
        )}
      </nav>
    </header>
  );
}
