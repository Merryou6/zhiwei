/**
 * 顶栏 —— 2026-09-23 对齐 B 端控制台原型（zhiwei-console）的结构：
 *   · 固定高 56px、底色 canvas-deep（比画布更深一档的 chrome 层）、底部 1px 半透明描边；
 *   · 品牌（标识 +「知微」字距 .1em）→ 竖分隔线 → 五个全高下划线式 Tab → 右侧空间胶囊；
 *   · Tab 当前态 = 文字提亮 + 2px 下划线（原型 .tab[aria-current]::after），
 *     不再用胶囊底色——整条 Tab 栏与顶栏同高，active 由下划线表达。
 *
 * 空间列表懒加载：已登录且 store 为空时取一次（#3 space/list）；失败静默——页 3 会给提示。
 *
 * 空间下拉（D2）：v1.2 起下拉底部在「管理空间」Link 之前插入「+ 新建空间」——点击**原地展开**
 * 紧凑态 SpaceCreateForm（与 /spaces 页共用同一组件），成功后收起弹层并切到新空间。
 * 这样任意页面都有看得见的新建反馈，不再只有一条「点了也没反应」的 Link。
 *
 * 设计规则走查（2026-09-22）：
 *   · 顶栏原为 `bg-surface/90 + backdrop-blur`。半透明顶栏看着通透，但正文会从底下透上来，
 *     滚动时对比度一直在变；改成实底后对比度是静态可算的，与内页的浅色表面也更一致。
 *   · z-index 改走令牌（z-nav），不再散写 z-40。
 *   · 圆角统一到 rounded-control / rounded-surface 两档，不再混用 rounded-lg / rounded-xl。
 *   · 「管理空间 →」去掉箭头：给导航文字加箭头是模板套件里的固定装饰，不携带信息。
 *
 * 主题（D3，v1.2）：空间胶囊左侧加 ThemeToggle（顶栏与「我的」页共用 useThemeStore）；
 * 下拉箭头原为硬编码 `text-[#93a0b4]`（浅色下对白底约 2.9:1，且违反「组件只写语义类名」），
 * 改用令牌 `text-ink-soft`，两主题下对比度都由变量体系保证。
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { listSpaces } from '../api/endpoints';
import { SPACES_PATH, navRoutes } from '../router';
import { useAuthStore } from '../stores/auth';
import { useSpaceStore } from '../stores/space';
import SpaceCreateForm from './SpaceCreateForm';
import ThemeToggle from './ThemeToggle';
import ZhiweiLogo from './ZhiweiLogo';

export default function TopNav() {
  const [open, setOpen] = useState(false);
  /** 弹层内的新建表单是否展开（D2：原地展开，不跳页）。 */
  const [createOpen, setCreateOpen] = useState(false);

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
    <header className="sticky top-0 z-nav border-b border-line bg-surface">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 px-6 py-3">
        {/* 品牌位：标识与「知微」二字同现，故标识按纯装饰隐藏（读屏只念一次「知微」） */}
        <Link
          to={token ? SPACES_PATH : '/login'}
          className="mr-4 flex items-center gap-2 rounded-control text-base font-medium tracking-wide text-ink"
        >
          <ZhiweiLogo size={22} />
          知微
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
                        'rounded-control px-3 py-1.5 text-sm transition-colors duration-150 ease-out',
                        isActive ? 'bg-accent-veil text-accent' : 'text-ink-soft hover:bg-raised',
                      ].join(' ')
                    }
                  >
                    {route.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            {/* 主题切换（D3d）：空间胶囊左侧，与「我的」页共用 useThemeStore */}
            <ThemeToggle />

            {/* 原型 .space-chip：34px 胶囊 = 立方体图标块 + 空間名 + 下拉箭头 */}
            <div className="relative ml-auto flex flex-none items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setOpen((value) => {
                    if (value) setCreateOpen(false);
                    return !value;
                  });
                }}
                className="rounded-control px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 ease-out hover:bg-raised"
                aria-expanded={open}
              >
                <span className="grid h-5 w-5 place-items-center rounded-[5px] border border-accent/40 bg-accent-veil text-accent" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 5.4 8 2.4l6 3v5.2l-6 3-6-3z" />
                    <path d="M2 5.4 8 8.4l6-3M8 8.4v5.2" />
                  </svg>
                </span>
                <span className="max-[720px]:hidden">空间·{active ? active.name : '未选择'}</span>
                <svg className="text-ink-soft" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4 6.5 4 4 4-4" />
                </svg>
              </button>

              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-surface border border-line bg-surface p-2 shadow-card">
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
                  {createOpen ? (
                    <div className="mt-1 border-t border-line pt-2">
                      {/* 紧凑态共享表单（D2c）：成功后收起弹层，任意页面都有反馈 */}
                      <SpaceCreateForm
                        compact
                        onCreated={() => {
                          setCreateOpen(false);
                          setOpen(false);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-1 block w-full rounded-control px-2 py-1.5 text-left text-sm text-accent hover:bg-raised"
                    >
                      + 新建空间
                    </button>
                  )}
                  <Link
                    to={SPACES_PATH}
                    onClick={() => {
                      setCreateOpen(false);
                      setOpen(false);
                    }}
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
