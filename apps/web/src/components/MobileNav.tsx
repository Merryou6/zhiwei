/**
 * 底部 tabbar + 「全部图纸」抽屉（style-10 蓝图迁移 P5，由移动端适配轮的汉堡抽屉重构而来）
 *
 * 【为什么重构】原型的信息架构是「左侧分层索引（桌面）+ 底部 tabbar（≤900）+ 全部图纸抽屉」，
 * 顶栏塞 6 个 Tab 的做法在新外壳里没有位置（图签条要放图签与开关）。于是：
 *   · ≤900：底部 5 项 tabbar 承担**主导航**（空间 / 测评 / 练习 / 图谱 / 报告）；
 *   · 任意档：抽屉承担**索引 + 空间管理**（全部图纸、切空间、新建空间、管理空间、主题）。
 * 抽屉仍由 `stores/mobileNav.ts` 驱动 —— store 与互斥逻辑一行未改。
 *
 * 【保留下来的一切（都不要动）】
 *   · 背景幕是全屏 button（指针路径闭合）；打开时焦点移入抽屉、关闭归还触发键；
 *     Tab / Shift+Tab 在抽屉内首尾循环；Esc 关闭；路由变化即收起；
 *   · role=dialog + aria-modal + 正文 aria-hidden（由 Layout 挂）；
 *   · 与右侧对话面板的互斥（store 单向调度）。
 *
 * 【NAV_COLLAPSE_MIN_WIDTH_PX 为什么仍是 JS 常量】抽屉根节点靠 `sheet:hidden` 隐藏，
 * 但「开合」状态在 store 里。若在 ≤900 打开抽屉后把视口拉宽到 ≥900（手机横屏
 * 375×812 转过来就是 812 —— 仍在抽屉档内，但桌面窗口拖动、分屏都会命中），
 * 根节点被 display:none 而 open 仍是 true，会同时坏两件事：
 *   ① Layout 的正文 aria-hidden 继续挂着 → 读屏用户看到「空白页」；
 *   ② 焦点陷阱以隐藏子树为边界 → Tab 键全站失效。
 * 故视口一旦越到 ≥900 就自动关闭。这个数字必须与 screens 的某一档同值
 * （breakpoints.test.ts ⑧ 静态锁死）——P5 起挂 **sheet(900)** 档。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { cn } from '../lib/cn';
import { MOBILE_NAV_DRAWER_ID, MOBILE_NAV_TOGGLE_ID } from '../lib/ids';
import { LOGIN_PATH, ROUTES, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { useChatPanelStore } from '../stores/chatPanel';
import { useMobileNavStore } from '../stores/mobileNav';
import { useSpaceStore } from '../stores/space';
import { Icon, type IconName } from './blueprint/icons';
import Rail, { type RailItem } from './blueprint/Rail';
import SpaceCreateForm from './SpaceCreateForm';
import ThemeToggle from './ThemeToggle';
import { IconButton } from './ui';

/** 图号（与 Layout 的 SHEET_NO 同一套口径；抽屉里的索引是它的 dense 形态）。 */
const SHEET_NO: Record<string, string> = {
  '/': '10-01',
  '/login': '10-02',
  '/start': '10-03',
  '/self-report': '10-04',
  '/spaces': '10-05',
  '/assessment': '10-06',
  '/paper': '10-07',
  '/practice': '10-08',
  '/chat': '10-09',
  '/attribution': '10-10',
  '/graph': '10-11',
  '/report': '10-12',
  '/drive': '10-13',
  '/me': '10-14',
};

const SHEET_PR: Record<string, 'T0' | 'T1' | 'T2'> = {
  '/assessment': 'T0',
  '/practice': 'T0',
  '/paper': 'T0',
  '/attribution': 'T0',
  '/graph': 'T1',
  '/chat': 'T1',
  '/report': 'T1',
};

/**
 * 抽屉里的图纸索引（除登录页：它是门口，不是图纸）。
 * 从 router.ROUTES（冻结区，只读）派生，不另手写一张表 —— 两张表一定会漂移。
 */
const DRAWER_SHEETS: RailItem[] = ROUTES.filter((route) => route.path !== LOGIN_PATH).map(
  (route) => ({
    path: route.path,
    dwg: SHEET_NO[route.path] ?? '10-00',
    label: route.label,
    pr: SHEET_PR[route.path] ?? 'T2',
  }),
);

/**
 * 底部 tabbar 的 5 项（规范 5.15：**严格 ≤5**）。
 * 「对话辅导」不在其中：它是常驻面板，由图签条的按钮开合，不占导航位。
 */
const TAB_ITEMS: readonly { path: string; label: string; icon: IconName }[] = [
  { path: SPACES_PATH, label: '空间', icon: 'grid' },
  { path: '/assessment', label: '测评', icon: 'target' },
  { path: '/practice', label: '练习', icon: 'pencil' },
  { path: '/graph', label: '图谱', icon: 'graph' },
  { path: '/report', label: '报告', icon: 'doc' },
];

/**
 * 导航收纳断点（**必须与 tailwind.config.js 的 `screens` 某一档同值**，
 * 一致性由 `apps/web/tests/breakpoints.test.ts` ⑧ 静态锁死）。
 * P5 起挂 `sheet: 900px` —— 它正是「底部 tabbar 出现 / 侧栏进抽屉 / 面板全屏覆盖」的下界。
 */
export const NAV_COLLAPSE_MIN_WIDTH_PX = 900;

/** 视口是否 ≥ minWidth（matchMedia 订阅；不支持 matchMedia 的环境按窄屏处理）。 */
function useViewportAtLeast(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`;
  const [matches, setMatches] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (event: MediaQueryListEvent): void => setMatches(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

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

  /** 抽屉内的「+ 新建空间」是否原地展开（与图签条弹层同款紧凑态共享表单）。 */
  const [createOpen, setCreateOpen] = useState(false);

  const asideRef = useRef<HTMLElement | null>(null);
  /** 记录「是否曾经打开过」，用于区分「关闭」与「初始未打开」，避免挂载即抢焦点。 */
  const wasOpen = useRef(false);
  const { pathname } = useLocation();
  const wide = useViewportAtLeast(NAV_COLLAPSE_MIN_WIDTH_PX);

  // 路由变化即收起（兜底浏览器后退 / 抽屉内 Link 之外的程序化跳转）
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // 视口越到 ≥900 即自行关闭（NAV_COLLAPSE_MIN_WIDTH_PX 注释里记的两个后果）。
  useEffect(() => {
    if (wide) setOpen(false);
  }, [wide, setOpen]);

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

  // 关闭后把焦点归还给触发键（图签条右区的「全部图纸」按钮）
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const toggle = document.getElementById(MOBILE_NAV_TOGGLE_ID);
    toggle?.focus();
  }, [open]);

  // 未登录不渲染（未登录只有登录页，没有图纸可索引）
  if (!token) return null;

  const active = spaces.find((space) => space.space_id === activeSpaceId) ?? null;

  return (
    <>
      {/* ── 底部 tabbar（≤900 档才出现，规范 5.15）──────────────────────
          固定底部、项数严格 5；当前项 aria-current="page" + 顶部 2px 强调条。
          z 走 z-nav(40)：与图纸索引同层，压在浮层（overlay 50）之下。 */}
      <nav
        data-print="hide"
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-nav border-t border-line bg-surface sheet:hidden"
      >
        {/* pb-safe-3：底部安全区 + 原 0.75rem（刘海屏不被 home indicator 压住）。 */}
        <ul className="flex items-stretch justify-around pb-safe-3">
          {TAB_ITEMS.map((item) => (
            <li key={item.path} className="flex-1">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-caption transition-colors duration-150 ease-out',
                    isActive ? 'text-accent-ink' : 'text-ink-soft hover:text-ink',
                    // 顶部 2px 强调条 = 「我在这一页」的信息载体（不是装饰）。
                    isActive
                      ? "after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:bg-accent after:content-['']"
                      : '',
                  )
                }
              >
                <Icon name={item.icon} className="h-5 w-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 「全部图纸」抽屉（打开时才渲染）──────────────────────────────
          if (!open) return null 式的条件渲染是无障碍设计的一部分：不给隐藏的
          可交互节点留后门（为退场动画改成常驻 DOM 是拿正确性换观感）。 */}
      {!open ? null : (
        // overflow-hidden：同 Layout 的 ChatPanelDock —— 抽屉入场起始帧在视口右侧外，
        // 若不剪掉，那一帧会被算进文档宽度（打开抽屉时闪横向滚动条）。
        <div data-print="hide" className="fixed inset-0 z-overlay overflow-hidden sheet:hidden">
          {/* 背景幕：全屏 button，指针路径由此闭合（与 ChatPanelDock 同款写法）。
              aria-label 与抽屉头部关闭键不同名，避免读屏出现两个同名可访问名。
              用 .scrim 而不是内联「底色 + 透明度」：半透明幕布是唯一「隔着它还要读前景」
              的位置，抽成类之后系统「减少透明度」偏好才有落点。 */}
          <button
            type="button"
            aria-label="点击空白处关闭全部图纸"
            onClick={() => setOpen(false)}
            className="scrim absolute inset-0 animate-fade"
          />

          <aside
            id={MOBILE_NAV_DRAWER_ID}
            ref={asideRef}
            role="dialog"
            aria-modal="true"
            aria-label="全部图纸"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-[min(26rem,92vw)] animate-slide-in-panel flex-col border-l border-line bg-surface outline-none"
          >
            <header className="flex flex-none items-center justify-between border-b border-line px-4 py-3">
              <p className="font-mono text-tok uppercase tracking-widest text-ink-soft">
                ALL SHEETS · 全部图纸
              </p>
              <IconButton
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
                aria-label="关闭全部图纸"
              >
                <Icon name="close" className="h-4 w-4" />
              </IconButton>
            </header>

            {/* 滚动区：底部 pb-safe-3 让开 home indicator。 */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-safe-3">
              <Rail items={DRAWER_SHEETS} title="分层索引" dense />

              <div className="my-3 border-t border-line" />

              <div className="flex min-h-11 items-center justify-between">
                <span className="font-mono text-tok uppercase tracking-widest text-ink-soft">
                  图纸底色
                </span>
                <ThemeToggle />
              </div>

              <div className="my-3 border-t border-line" />

              <div>
                <p className="font-mono text-tok uppercase tracking-widest text-ink-soft">
                  当前空间
                </p>
                <p className="mt-1 break-words text-sm text-ink">
                  {active ? active.name : '未选择'}
                </p>

                <ul className="mt-2 flex flex-col gap-0.5">
                  {spaces.map((space) => (
                    <li key={space.space_id}>
                      <button
                        type="button"
                        onClick={() => setActive(space.space_id)}
                        className={cn(
                          'flex min-h-11 w-full items-center rounded-none px-2 py-1.5 text-left text-sm',
                          space.space_id === activeSpaceId
                            ? 'bg-accent-veil text-accent-ink'
                            : 'text-ink hover:bg-raised',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{space.name}</span>
                        {space.is_default ? (
                          <span className="ml-1 flex-none font-mono text-mono-xs text-ink-soft">
                            默认
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {spaces.length === 0 ? (
                    <li className="min-h-11 px-2 py-2 text-ui-sm text-ink-soft">还没有空间</li>
                  ) : null}
                </ul>

                {createOpen ? (
                  <div className="mt-2 border-t border-line pt-2">
                    {/* 与图签条弹层共用同一份紧凑态表单（唯一共享入口） */}
                    <SpaceCreateForm compact onCreated={() => setCreateOpen(false)} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="mt-1 flex min-h-11 w-full items-center rounded-none px-2 py-1.5 text-left text-sm text-accent-ink hover:bg-raised"
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
                  className="mt-1 flex min-h-11 items-center rounded-none px-2 py-1.5 text-sm text-ink-soft hover:bg-raised"
                >
                  管理空间
                </Link>

                {/* 对话辅导不是图纸，它是常驻面板：给一条明确的入口（≤900 面板是全屏覆盖，
                    先关抽屉再开面板，互斥由 store 兜底）。 */}
                <button
                  type="button"
                  // aria-pressed：它是**面板开合的开关**（不是跳转），读屏要能听到开合态。
                  // 省略它会让读屏丢失唯一的开合信号（真浏览器探针实测会因此找不到
                  // 「抽屉里的开合按钮」，见 tools/responsive-audit.cjs --probe-nav）。
                  aria-pressed={panelOpen}
                  onClick={() => {
                    setOpen(false);
                    setPanelOpen(true);
                  }}
                  className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-sm text-ink hover:bg-raised"
                >
                  <Icon name="chat" className="h-4 w-4" />
                  对话辅导
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
