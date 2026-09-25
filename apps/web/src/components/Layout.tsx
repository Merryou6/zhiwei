/**
 * 页面外壳：顶栏 + 主内容区 + 右侧常驻对话面板 + 非阻断 Toast 出口（stores/ui.ts 驱动）。
 *
 * 内容宽度由外壳统一给出（一屏一件事：页面自己决定单栏/两栏，外壳只负责留白与底色）。
 * P2（2026-09-25）把外壳从 max-w-5xl(1024) 放宽到 **max-w-6xl(1152)**：数据型页面
 * （图谱、控制台、对话双栏）在 1024 下偏挤，且 ConsoleHomePage 曾自己写 max-w-[1180px]
 * 想突破外壳 —— 结果被外壳截断成死代码，没有任何提示。宽度只能有一个真相。
 * ⚠ TopNav 的 nav 容器必须与此同值，否则「内容列与顶栏共用同一条左基线」立刻破。
 *
 * 视觉改版（2026-09-22）：Toast 出口抽到 ToastHost，与「无外壳」的登录页共用一份队列。
 *
 * v1.3（D1）：挂 <ChatPanelDock />。面板开合状态在 stores/chatPanel.ts（会话级）——
 * Layout 随路由切换会重挂载，放组件态会丢；对话上下文本就在全局 dialog store。
 * 形态按视口分两档（D1b）：
 *   · ≥1280：常驻挤压 —— 正文外层让出与面板等宽的 padding-right
 *     （transition-[padding] 平滑过渡），无背景幕；
 *   · <1280：覆盖式 —— 半透明背景幕 + 右侧抽屉，正文不动（此宽度下正文列本就贴边，
 *     再挤压必不可读）。
 * z-index 走令牌 z-overlay（50）档：单一 fixed 容器（内部先背景幕后面板本体），
 * 面板 top 自顶栏下缘（56px）起不遮 TopNav；Toast（z-toast=60）仍在最上层。
 *
 * 登录页走 bare 外壳（App.tsx），不进本组件 ⇒ 面板天然只在登录后出现。
 *
 * ⚠ 让位的 padding 放在**外层包装**而不是 main 自己（F4 走查实测修正，D24）：
 * 若把 padding-right 加在 main 上，padding 落在 main 的盒内，正文实际可用宽度会被
 * 白白吃掉一块、且与面板之间空出一条死区；放在外层后 main 的 max-width 作用在
 * 「面板左边的可用宽度」上，正文列始终紧贴面板左侧、无死区。
 * （D24 当时的具体像素值是在 max-w-5xl 下测的，P2 放宽到 6xl 后按同一机制推算，
 *   实测值见 P2 的走查截图。）
 *
 * ⚠ 让位量必须同时作用于**顶栏**（清尾轮 L11 修正，2026-09-24）：F3 只改了正文列，
 * 面板一展开顶栏仍按整宽居中 ⇒ 1440 实测顶栏内容左缘 232px vs 正文列左缘 32px（错位 200px），
 * 破坏了「内容列与顶栏共用同一条左基线」这条设计不变量。
 * 现在让位量写成 CSS 自定义属性（单一来源，见 ./panelDock.ts），顶栏 nav 与正文列外层
 * 读同一个变量 ⇒ 左基线恒等（实测开合两态差 0px），且不存在第二份 400px 常量。
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { useChatPanelStore } from '../stores/chatPanel';
import { useMobileNavStore } from '../stores/mobileNav';
import ChatPanel from './chat/ChatPanel';
import MobileNav from './MobileNav';
import { DOCK_OFFSET_STYLE, dockOffsetVarStyle } from './panelDock';
import ToastHost from './ToastHost';
import TopNav from './TopNav';

/** 面板宽度（px）：常驻态正文外层让出等宽 padding-right，覆盖态抽屉同宽（窄屏再受 92vw 约束）。 */
const PANEL_WIDTH_PX = 400;

/**
 * 常驻（挤压正文列）与覆盖（抽屉 + 背景幕）的分界。
 *
 * ⚠ 它与外壳宽度**不是**同一个数（旧注释写成「与正文列 max-w-5xl 同值」，是错的：
 * 1024 ≠ 1280）。真正的判据是「挤出面板之后，正文列还剩多少可读宽度」：
 *   1280 − 400 = 880，再扣两侧页边距 48 ⇒ 832px，仍是舒服的阅读宽度；
 *   再窄下去正文就要被压到 700 以下，那时挤压比覆盖更伤阅读，故改用覆盖式。
 * 所以外壳放宽到 1152 也不改这个分界 —— 它由「正文可读下限」决定，不由外壳决定。
 */
const DOCK_MIN_WIDTH_PX = 1280;

/** 顶栏高度（px）：面板从顶栏下缘起，不遮导航。 */
const TOPNAV_HEIGHT_PX = 56;


function readMatch(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  } catch {
    return false;
  }
}

/** 视口是否 ≥ minWidth（matchMedia 订阅；不支持 matchMedia 的环境按窄屏处理 = 覆盖式，不挤压正文）。 */
function useViewportAtLeast(minWidth: number): boolean {
  const query = `(min-width: ${minWidth}px)`;
  const [matches, setMatches] = useState<boolean>(() => readMatch(query));

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

/**
 * 面板 dock：单一 fixed 容器（z-overlay）+ 面板本体。
 * docked = 常驻态（≥1280 且展开）→ 无背景幕；否则为覆盖态 → 半透明背景幕（点击关闭）。
 * 关闭时不渲染任何 DOM（不给隐藏的可交互节点留后门）。
 */
function ChatPanelDock({ docked }: { docked: boolean }) {
  const open = useChatPanelStore((state) => state.open);
  const setOpen = useChatPanelStore((state) => state.setOpen);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-overlay" style={{ top: TOPNAV_HEIGHT_PX }}>
      {docked ? null : (
        <button
          type="button"
          // 与面板头部的关闭键区分开（同一可访问名会读屏歧义；F4 走查发现，D25）
          aria-label="点击空白处关闭对话面板"
          onClick={() => setOpen(false)}
          className="scrim absolute inset-0 animate-fade"
        />
      )}
      <aside
        // data-print='hide'：打印时隐藏面板，否则右侧会切掉一栏内容。
        data-print="hide"
        aria-label="对话辅导面板"
        // animate-slide-in-panel：与移动端抽屉同一条入场曲线（面板在 <1280 就是右侧抽屉）。
        className="absolute bottom-0 right-0 top-0 max-w-[92vw] animate-slide-in-panel border-l border-line bg-surface shadow-card"
        style={{ width: PANEL_WIDTH_PX }}
      >
        <ChatPanel />
      </aside>
    </div>
  );
}

export interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  const open = useChatPanelStore((state) => state.open);
  const wideEnough = useViewportAtLeast(DOCK_MIN_WIDTH_PX);
  /** 常驻态才挤压正文列；覆盖态（窄屏）正文一律不动（D1b）。 */
  const docked = open && wideEnough;
  /** 汉堡抽屉（B2）：打开期间正文对读屏隐藏（D17 三条路径里的第三条）。 */
  const navOpen = useMobileNavStore((state) => state.open);

  return (
    // 让位量写一次（单一来源）：顶栏 nav 与正文列外层都读这个自定义属性（L11）。
    // 外壳最小高：100vh 档（sticky 视口高）→ 动态视口高 min-h-dvh（移动端适配轮 R4）。
    // 手机上地址栏伸缩时 vh 不变而可视区变高，外壳会矮一截导致跳动；dvh 跟随动态视口。
    // 与 LoginPage:182 统一。桌面 dvh === vh（无动态工具栏）→ 数值不变。
    <div className="min-h-dvh bg-canvas text-ink" style={dockOffsetVarStyle(docked ? PANEL_WIDTH_PX : 0)}>
      <TopNav />
      {/* 常驻态：给面板让位的 padding 在外层（见文件头 D24 说明），main 的 max-w-6xl
          仍作用在「面板左边的可用宽度」上；覆盖态该变量为 0，正文一律不动。
          顶栏读同一个变量，故两者左基线始终一致（L11）。
          aria-hidden：抽屉打开期间正文对读屏隐藏（关闭时不渲染该属性 → DOM 与改造前一致）。
          px-4 nav:px-6（D9）：窄档页边距 48→32px，必须与 TopNav 的 nav padding 同步，
          否则破坏「内容列与顶栏共用同一条左基线」这条不变量。 */}
      <div
        className="transition-[padding] duration-200 ease-out"
        style={DOCK_OFFSET_STYLE}
        aria-hidden={navOpen || undefined}
      >
        {/* 路由入场（P1）：key 换成 pathname，每次换页重新挂载 main，动画才会重播。
            换页本来就会换掉页面组件（12 条路由与 12 个页面文件 1:1 对应），所以这个 key
            不引入额外的状态丢失；同一路径只变 query 的导航 key 不变，页面状态保留。
            动画刻意挂在 main 自身而不是再包一层 div —— 多一层包装会改变取证脚本
            mainChild 锚点的取法（它是 main 的第一个子元素），而锚点几何是基线的一部分。
            动画本身只做透明度（见 tailwind.config.js 的 route-in）：带位移的入场会让
            锚点 y 在动画期间取到中间值。 */}
        <main key={pathname} className="mx-auto w-full max-w-6xl animate-route-in px-4 py-8 nav:px-6">
          {children}
        </main>
      </div>
      {/* 汉堡抽屉：挂在 TopNav 之后、面板之前（同 z-overlay，但二者互斥不同屏，D4）。
          自身在 ≥720 不渲染（nav:hidden）+ 未登录不渲染（D15）。 */}
      <MobileNav />
      <ChatPanelDock docked={docked} />
      <ToastHost />
    </div>
  );
}
