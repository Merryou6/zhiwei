/**
 * 顶栏 —— 品牌 + 主导航 + 主题切换 + 空间胶囊，一行放下。
 *
 * 【P2 修正的三处「注释与实现不符」】
 * 改版前的文件头描述的是另一个设计（「五个全高下划线式 Tab」「active = 2px 下划线」
 * 「底色 canvas-deep」），但代码实际用的是**圆角胶囊 + accent-veil 底色**，
 * 导航项也早已是 6 个（navRoutes()）。注释描述一个不存在的实现，比没有注释更危险 ——
 * 后来人会照着它去改，越改越偏。这里以实际实现为准重写。
 *
 * 【P2 修掉的一个真实对比度缺陷】
 * 激活态原为 `bg-accent-veil text-accent`（#4E8FB0 落在 #EAF2F6 上）。
 * 实测 **3.15:1**，低于 AA 正文标准的 4.5:1 —— 而未激活态 `text-ink-soft` 落在白底上是
 * **5.56:1**。也就是说「当前页面」比「其它页面」更难读，层级是反的，这恰好伤到
 * 导航最该回答的那个问题：「我现在在哪里」。
 * 改为 `text-ink`（11.97:1）保住可读性，品牌感由 accent-veil 底色与下方 2px 强调条承担；
 * 强调条是「当前位置」的信息载体，不是装饰。
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
 *   · 圆角统一到 rounded-control / rounded-surface 两档。
 *   · 「管理空间 →」去掉箭头：给导航文字加箭头是模板套件里的固定装饰，不携带信息。
 *   · 下拉箭头原为硬编码 `text-ink-soft`，两主题下对比度都由变量体系保证。
 *
 * v1.3（D1d）：「对话辅导」在 navRoutes().map 里**特判为 button**（aria-pressed + 开合右侧常驻
 * 面板），其余项仍是 NavLink。改的只是渲染层——ROUTES / navRoutes / guardPath 数据结构零改动，
 * 故 routerGuard.test.ts 的 12 页与 6 项导航断言不受影响。/chat 全屏形态仍在（面板头部「全屏打开」进入）。
 *
 * v1.3 补（清尾轮 L11，2026-09-24）：header 读 Layout 写下的让位自定义属性（./panelDock.ts），
 * 面板展开（≥1280 让位态）时顶栏内容与正文列同步左移 —— 「内容列与顶栏共用同一条左基线」
 * 这条设计不变量在两态下都成立（1440 实测开合两态差 0px）。padding 落在 header 上，
 * 故整条顶栏的底色与下边框仍是整宽（面板从 y=56 起，不受影响）。
 *
 * P2（2026-09-25）：nav 容器宽度与 Layout 的 main 同步放宽到 max-w-6xl —— 两者必须同值，
 * 否则左基线不变量立刻破。汉堡键改用 IconButton 原语（id / aria-controls / nav:hidden
 * 与渲染条件一字未动，mobileNav.test.ts 的跨组件 id 断言据此通过）。
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { listSpaces } from '../api/endpoints';
import { cn } from '../lib/cn';
import { MOBILE_NAV_DRAWER_ID, MOBILE_NAV_TOGGLE_ID } from '../lib/ids';
import { SPACES_PATH, navRoutes } from '../router';
import { useAuthStore } from '../stores/auth';
import { useChatPanelStore } from '../stores/chatPanel';
import { useMobileNavStore } from '../stores/mobileNav';
import { useSpaceStore } from '../stores/space';
import { IconButton } from './ui';
import { DOCK_OFFSET_STYLE } from './panelDock';
import SpaceCreateForm from './SpaceCreateForm';
import ThemeToggle from './ThemeToggle';
import ZhiweiLogo from './ZhiweiLogo';

/** 需特判为面板开合按钮的导航项（与 router.ROUTES 的 '/chat' 一致；路由数据本身不改）。 */
const CHAT_PATH = '/chat';

/** 导航项共用形态。放在组件外：NavLink 与特判 button 两处必须逐字一致。 */
const NAV_ITEM_BASE =
  'relative rounded-control px-3 py-1.5 text-sm transition-colors duration-150 ease-out';
/** 未激活：次要文字色。hover 提亮到正文色，让「可点」与「已选中」分开表达。 */
const NAV_ITEM_IDLE = 'text-ink-soft hover:bg-raised hover:text-ink';
/**
 * 已激活：正文色（11.97:1）保证可读 + accent-veil 底色 + 底部 2px 强调条。
 * 强调条是当前位置的信息载体 —— 只用底色的话，accent-veil 与白底只差 1.13:1，
 * 在浅色主题下几乎看不出「我在这一页」。
 */
const NAV_ITEM_ACTIVE = [
  'bg-accent-veil font-medium text-ink',
  "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:content-['']",
].join(' ');


export default function TopNav() {
  const [open, setOpen] = useState(false);
  /** 弹层内的新建表单是否展开（D2：原地展开，不跳页）。 */
  const [createOpen, setCreateOpen] = useState(false);

  const token = useAuthStore((state) => state.token);
  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  /** 右侧常驻面板（v1.3 D1d）：顶栏此项变成开合按钮。 */
  const panelOpen = useChatPanelStore((state) => state.open);
  const togglePanel = useChatPanelStore((state) => state.toggle);
  /** 汉堡抽屉（B2/D5）：<720 唯一的导航入口。 */
  const navOpen = useMobileNavStore((state) => state.open);
  const toggleNav = useMobileNavStore((state) => state.toggle);

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
    <header
      // data-print='hide'：打印（ReportPage 的「存为 PDF」）时隐藏顶栏。
      // 用显式标记而不是结构选择器，是因为页面自身的 <header> 也要打印，
      // 靠标签名会连它一起干掉。
      data-print="hide"
      className="sticky top-0 z-nav border-b border-line bg-surface transition-[padding] duration-200 ease-out"
      style={DOCK_OFFSET_STYLE}
    >
      {/* max-w-6xl 必须与 Layout 的 main 同值：两者共用同一条左基线（see ./panelDock.ts）。 */}
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3 nav:px-6">
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
            {/* 原型 .nav-sep：18px 竖分隔线，窄屏隐藏（具名断点 max-nav，见 tailwind.config.js） */}
            <span className="h-[18px] w-px flex-none bg-line max-nav:hidden" aria-hidden="true" />

            {/* <720：整条 Tab 栏收进汉堡抽屉（移动端适配轮 D5/B2）。≥720 该 class 不生效，
                桌面渲染逐像素不变。 */}
            <ul className="flex h-full min-w-0 flex-1 items-stretch gap-0.5 max-nav:hidden">
              {navRoutes().map((route) => {
                // 「对话辅导」特判（v1.3 D1d）：开合右侧常驻面板，不再跳整页
                if (route.path === CHAT_PATH) {
                  return (
                    <li key={route.path} className="flex items-stretch">
                      <button
                        type="button"
                        onClick={togglePanel}
                        aria-pressed={panelOpen}
                        className={cn(NAV_ITEM_BASE, panelOpen ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
                      >
                        {route.label}
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={route.path} className="flex items-stretch">
                    <NavLink
                      to={route.path}
                      className={({ isActive }) =>
                        cn(NAV_ITEM_BASE, isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)
                      }
                    >
                      {route.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>

            {/* 主题切换（D3d）：空间胶囊左侧，与「我的」页共用 useThemeStore。
                <720 收进抽屉（抽屉内另有一份），外层包一个 flex 壳承载 max-nav:hidden ——
                不改 ThemeToggle 自身（它同时用在 /me 页，改组件会连带影响那一处）。 */}
            <span className="flex max-nav:hidden">
              <ThemeToggle />
            </span>

            {/* 原型 .space-chip：34px 胶囊 = 立方体图标块 + 空間名 + 下拉箭头。
                <720 整个胶囊收进抽屉（D5）。 */}
            <div className="relative ml-auto flex flex-none items-center gap-2.5 max-nav:hidden">
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
                {/* 立方体图标块：rounded-md（6px）而非任意值 rounded-[5px] ——
                    圆角纪律只允许令牌三档 + 微标签的 rounded-md，[5px] 是随手写的。 */}
                <span className="grid h-5 w-5 place-items-center rounded-md border border-accent/40 bg-accent-veil text-accent-ink" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 5.4 8 2.4l6 3v5.2l-6 3-6-3z" />
                    <path d="M2 5.4 8 8.4l6-3M8 8.4v5.2" />
                  </svg>
                </span>
                <span className="max-nav:hidden">空间·{active ? active.name : '未选择'}</span>
                <svg className="text-ink-soft" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m4 6.5 4 4 4-4" />
                </svg>
              </button>

              {open ? (
                <div className="absolute right-0 mt-2 w-56 rounded-surface border border-line bg-surface p-2 shadow-card">
                  <p className="px-2 py-1 text-ui-sm text-ink-soft">切到另一个空间</p>
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
                            space.space_id === activeSpaceId ? 'bg-accent-veil text-accent-ink' : 'text-ink hover:bg-raised',
                          ].join(' ')}
                        >
                          {space.name}
                          {space.is_default ? <span className="ml-1 text-ui-sm text-ink-soft">（默认）</span> : null}
                        </button>
                      </li>
                    ))}
                    {spaces.length === 0 ? (
                      <li className="min-h-9 px-2 py-2 text-ui-sm text-ink-soft">还没有空间</li>
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
                      className="mt-1 block w-full rounded-control px-2 py-1.5 text-left text-sm text-accent-ink hover:bg-raised"
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

            {/* 汉堡键（B2/D5）：<720 顶栏唯一的导航入口。nav:hidden ⇒ ≥720 不渲染，
                桌面布局与像素零变化；<720 时胶囊容器为 display:none，故这里自带 ml-auto。
                id / aria-controls 走 lib/ids.ts 的共享常量（清尾轮 T2）：跨组件靠 id 关联，
                字面量硬编码在两处会静默失效（改一处忘另一处不报错、不挂测试）。
                P2 起改用 IconButton 原语 —— aria-label 在组件签名里是必填，不会再漏。 */}
            <IconButton
              id={MOBILE_NAV_TOGGLE_ID}
              size="sm"
              variant="outline"
              onClick={toggleNav}
              aria-expanded={navOpen}
              aria-controls={MOBILE_NAV_DRAWER_ID}
              aria-label={navOpen ? '关闭导航菜单' : '打开导航菜单'}
              className="nav:hidden ml-auto"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
              </svg>
            </IconButton>
          </>
        ) : (
          <span className="flex-1 text-sm text-ink-soft">学习伴侣</span>
        )}
      </nav>
    </header>
  );
}
