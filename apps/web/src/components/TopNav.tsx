/**
 * 顶栏 —— 2026-09-23 对齐 B 端控制台原型（zhiwei-console）的结构：
 *   · 固定高 56px、底色 canvas-deep（比画布更深一档的 chrome 层）、底部 1px 半透明描边；
 *   · 品牌（标识 +「知微」字距 .1em）→ 竖分隔线 → 五个全高下划线式 Tab → 右侧空间胶囊；
 *   · Tab 当前态 = 文字提亮 + 2px 下划线（原型 .tab[aria-current]::after），
 *     不再用胶囊底色——整条 Tab 栏与顶栏同高，active 由下划线表达。
 *
 * 空间列表懒加载：已登录且 store 为空时取一次（#3 space/list）；失败静默——空间页会给提示。
 *
 * 设计规则走查（2026-09-22，沿袭）：
 *   · 顶栏用实底不用 backdrop-blur：半透明顶栏滚动时对比度一直在变，实底静态可算。
 *   · z-index 走令牌（z-nav），圆角走 rounded-control（8px，对齐原型 --r-ctl）。
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { listSpaces } from '../api/endpoints';
import { SPACES_PATH, navRoutes } from '../router';
import { useAuthStore } from '../stores/auth';
import { useSpaceStore } from '../stores/space';
import ZhiweiLogo from './ZhiweiLogo';

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
    <header className="sticky top-0 z-nav border-b border-line/50 bg-canvas-deep">
      <nav className="mx-auto flex h-14 max-w-[1320px] items-center gap-[18px] px-8 max-[720px]:px-6">
        {/* 品牌位：标识与「知微」二字同现，故标识按纯装饰隐藏（读屏只念一次「知微」）。
            原型 .brand-word：15px / 600 / 字距 .1em */}
        <Link
          to={token ? SPACES_PATH : '/login'}
          className="flex flex-none items-center gap-[9px] rounded-control text-ink"
        >
          <ZhiweiLogo size={27} />
          <span className="text-[15px] font-semibold tracking-[0.1em]">知微</span>
        </Link>

        {token ? (
          <>
            {/* 原型 .nav-sep：18px 竖分隔线，窄屏隐藏 */}
            <span className="h-[18px] w-px flex-none bg-line max-[720px]:hidden" aria-hidden="true" />

            <ul className="flex h-full min-w-0 flex-1 items-stretch gap-0.5">
              {navRoutes().map((route) => (
                <li key={route.path} className="flex items-stretch">
                  <NavLink
                    to={route.path}
                    className={({ isActive }) =>
                      [
                        'relative inline-flex items-center rounded-t-control px-3.5 text-[13.5px] font-medium',
                        'transition-colors duration-150 ease-out',
                        isActive
                          ? 'font-semibold text-ink after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-t-[2px] after:bg-accent after:content-[""]'
                          : 'text-ink-soft hover:bg-accent-veil hover:text-ink',
                      ].join(' ')
                    }
                  >
                    {route.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            {/* 原型 .space-chip：34px 胶囊 = 立方体图标块 + 空間名 + 下拉箭头 */}
            <div className="relative ml-auto flex flex-none items-center gap-2.5">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-[34px] items-center gap-[9px] rounded-control border border-line bg-surface pl-2 pr-[9px] text-[12.5px] font-medium text-ink transition-colors duration-150 ease-out hover:border-[#475569] hover:bg-raised"
                aria-expanded={open}
              >
                <span className="grid h-5 w-5 place-items-center rounded-[5px] border border-accent/40 bg-accent-veil text-accent" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 5.4 8 2.4l6 3v5.2l-6 3-6-3z" />
                    <path d="M2 5.4 8 8.4l6-3M8 8.4v5.2" />
                  </svg>
                </span>
                <span className="max-[720px]:hidden">空间·{active ? active.name : '未选择'}</span>
                <svg className="text-[#93a0b4]" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4 6.5 4 4 4-4" />
                </svg>
              </button>

              {open ? (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-control border border-line bg-surface p-2 shadow-card">
                  <p className="px-2 py-1 text-[13px] text-ink-soft">切到另一个空间</p>
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
                            'w-full rounded-control px-2 py-1.5 text-left text-sm',
                            space.space_id === activeSpaceId ? 'bg-accent-veil text-accent' : 'text-ink hover:bg-raised',
                          ].join(' ')}
                        >
                          {space.name}
                          {space.is_default ? <span className="ml-1 text-[13px] text-ink-soft">（默认）</span> : null}
                        </button>
                      </li>
                    ))}
                    {spaces.length === 0 ? (
                      <li className="min-h-9 px-2 py-2 text-[13px] text-ink-soft">还没有空间</li>
                    ) : null}
                  </ul>
                  <Link
                    to={SPACES_PATH}
                    onClick={() => setOpen(false)}
                    className="mt-1 block rounded-control px-2 py-1.5 text-sm text-ink-soft hover:bg-raised"
                  >
                    管理空间
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
