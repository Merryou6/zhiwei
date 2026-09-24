/**
 * 汉堡抽屉（移动端导航收纳，2026-09-24 移动端适配轮 D3–D5/D15/D17）。
 *
 * 【为什么需要它】375px 的顶栏塞不下「品牌 + 6 个 Tab + 主题键 + 空间胶囊」——
 * 实测现状是 6 个 Tab 的文字被压成竖排（每字一行），既难看也不可点。
 * 桌面（≥768）必须像素级零变化，所以收纳只能是「<720 另走一条路」：
 * 手机上顶栏只留「知微」+ 汉堡键，抽屉承载全部导航项 + 主题 + 空间切换。
 *
 * 【形态】全高覆盖式（D5）：fixed inset-0 + z-overlay（50，压在 z-nav 40 的顶栏之上），
 * 从右滑入，自带头部（标题 + 关闭键），不与顶栏并排——56px 顶栏里塞不下第二排导航，
 * 且全高形态回避了「top:56px 与安全区 top 叠加」的复杂度。
 *
 * 【无障碍（D17）】不用 inert（React 18 对布尔 inert 支持不完整），改用三条独立闭合的路径：
 *   1) 背景幕是**全屏 button**，指针路径被拦截；
 *   2) 打开时焦点移入抽屉，关闭时归还汉堡键（#mobile-nav-toggle）；Tab / Shift+Tab 在抽屉内首尾循环；
 *   3) role=dialog + aria-modal 声明读屏语义，并由 Layout 给正文外层加 aria-hidden。
 * 另有 Esc 关闭，与 ChatPanel（chat/ChatPanel.tsx）同款实现。
 *
 * 【开合联动】抽屉内每个导航项 onClick 先 setOpen(false)（点完自动收起）；
 * 另订阅 location.pathname 变化即收起，兜底浏览器后退与键盘导航。
 *
 * 【互斥（D4）】<720 时右侧对话面板的唯一打开路径就是抽屉里的「对话辅导」按钮：
 * 先关抽屉再开面板；反方向（面板开着时开抽屉）由 stores/mobileNav.ts 兜底。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { SPACES_PATH, navRoutes } from '../router';
import { useAuthStore } from '../stores/auth';
import { useChatPanelStore } from '../stores/chatPanel';
import { useMobileNavStore } from '../stores/mobileNav';
import { useSpaceStore } from '../stores/space';
import SpaceCreateForm from './SpaceCreateForm';
import ThemeToggle from './ThemeToggle';

/** 需特判为面板开合按钮的导航项（与 router.ROUTES 的 '/chat' 一致；路由数据本身不改）。 */
const CHAT_PATH = '/chat';

/** 抽屉内可聚焦元素（焦点陷阱用）。与 :focus-visible 的可见性口径一致。 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function MobileNav() {
  const token = useAuthStore((state) => state.token);
  const open = useMobileNavStore((state) => state.open);
  const setOpen = useMobileNavStore((state) => state.setOpen);

  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setActive = useSpaceStore((state) => state.setActive);

  const panelOpen = useChatPanelStore((state) => state.open);
  const setPanelOpen = useChatPanelStore((state) => state.setOpen);

  /** 抽屉内的「+ 新建空间」是否原地展开（与顶栏弹层同款紧凑态共享表单）。 */
  const [createOpen, setCreateOpen] = useState(false);

  const asideRef = useRef<HTMLElement | null>(null);
  /** 记录「是否曾经打开过」，用于区分「关闭」与「初始未打开」，避免挂载即抢焦点。 */
  const wasOpen = useRef(false);
  const { pathname } = useLocation();

  // 路由变化即收起（兜底浏览器后退 / 抽屉内 Link 之外的程序化跳转）
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Esc 关闭 + Tab 焦点陷阱（仅在打开期间挂监听）
  useEffect(() => {
    if (!open) return;

    asideRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const root = asideRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (!current || !root.contains(current)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  // 关闭后把焦点归还给顶栏汉堡键（D17：三条路径闭合的最后一条）
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const toggle = document.getElementById('mobile-nav-toggle');
    toggle?.focus();
  }, [open]);

  // 未登录不渲染（D15：未登录顶栏只有品牌 +「学习伴侣」，无导航可收纳）
  if (!token) return null;
  if (!open) return null;

  const active = spaces.find((space) => space.space_id === activeSpaceId) ?? null;
  const itemBase =
    'flex min-h-11 w-full items-center rounded-control px-4 py-2.5 text-left text-sm transition-colors duration-150 ease-out';

  return (
    <div className="fixed inset-0 z-overlay nav:hidden">
      {/* 背景幕：全屏 button，指针路径由此闭合（与 ChatPanelDock 同款写法）。
          aria-label 与抽屉头部关闭键不同名，避免读屏出现两个同名可访问名。 */}
      <button
        type="button"
        aria-label="点击空白处关闭导航菜单"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-canvas/60"
      />

      <aside
        id="mobile-nav-drawer"
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="导航菜单"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col border-l border-line bg-surface shadow-card outline-none"
      >
        <header className="flex flex-none items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-medium text-ink">菜单</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭导航菜单"
            className="grid h-9 w-9 flex-none place-items-center rounded-control border border-line text-ink-soft transition-colors duration-150 ease-out hover:bg-raised"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </header>

        {/* 滚动区：底部 pb-safe-3 = 安全区 + 原 pb-3（非刘海设备 env()=0 → 仍是 12px） */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-safe-3">
          <ul className="flex flex-col gap-0.5">
            {navRoutes().map((route) => {
              // 「对话辅导」特判：<720 时面板的唯一入口就在这里（D4）——先关抽屉再开面板
              if (route.path === CHAT_PATH) {
                return (
                  <li key={route.path}>
                    <button
                      type="button"
                      aria-pressed={panelOpen}
                      onClick={() => {
                        setOpen(false);
                        setPanelOpen(true);
                      }}
                      className={[
                        itemBase,
                        panelOpen ? 'bg-accent-veil text-accent' : 'text-ink-soft hover:bg-raised',
                      ].join(' ')}
                    >
                      {route.label}
                    </button>
                  </li>
                );
              }
              return (
                <li key={route.path}>
                  <NavLink
                    to={route.path}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        itemBase,
                        isActive ? 'bg-accent-veil text-accent' : 'text-ink-soft hover:bg-raised',
                      ].join(' ')
                    }
                  >
                    {route.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          <div className="my-3 border-t border-line" />

          <div className="flex min-h-9 items-center justify-between px-1">
            <span className="text-[13px] text-ink-soft">深浅主题</span>
            <ThemeToggle />
          </div>

          <div className="my-3 border-t border-line" />

          <div className="px-1">
            <p className="text-[13px] text-ink-soft">当前空间</p>
            <p className="mt-0.5 break-words text-sm text-ink">{active ? active.name : '未选择'}</p>

            <ul className="mt-2 flex flex-col gap-0.5">
              {spaces.map((space) => (
                <li key={space.space_id}>
                  <button
                    type="button"
                    onClick={() => setActive(space.space_id)}
                    className={[
                      'flex min-h-9 w-full items-center rounded-control px-2 py-1.5 text-left text-sm',
                      space.space_id === activeSpaceId ? 'bg-accent-veil text-accent' : 'text-ink hover:bg-raised',
                    ].join(' ')}
                  >
                    <span className="min-w-0 flex-1 truncate">{space.name}</span>
                    {space.is_default ? <span className="ml-1 flex-none text-[13px] text-ink-soft">（默认）</span> : null}
                  </button>
                </li>
              ))}
              {spaces.length === 0 ? (
                <li className="min-h-9 px-2 py-2 text-[13px] text-ink-soft">还没有空间</li>
              ) : null}
            </ul>

            {createOpen ? (
              <div className="mt-2 border-t border-line pt-2">
                {/* 与顶栏弹层共用同一份紧凑态表单（D2c：唯一共享入口） */}
                <SpaceCreateForm compact onCreated={() => setCreateOpen(false)} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 flex min-h-9 w-full items-center rounded-control px-2 py-1.5 text-left text-sm text-accent hover:bg-raised"
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
              className="mt-1 flex min-h-9 items-center rounded-control px-2 py-1.5 text-sm text-ink-soft hover:bg-raised"
            >
              管理空间
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
