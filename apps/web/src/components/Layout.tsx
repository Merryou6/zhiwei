/**
 * 页面外壳：顶栏 + 主内容区 + 右侧常驻对话面板 + 非阻断 Toast 出口（stores/ui.ts 驱动）。
 *
 * 内容宽度固定 max-w-5xl（一屏一件事：页面自己决定单栏/两栏，外壳只负责留白与底色）。
 *
 * 视觉改版（2026-09-22）：Toast 出口抽到 ToastHost，与「无外壳」的登录页共用一份队列。
 *
 * v1.3（D1）：挂 <ChatPanelDock />。面板开合状态在 stores/chatPanel.ts（会话级）——
 * Layout 随路由切换会重挂载，放组件态会丢；对话上下文本就在全局 dialog store。
 * 形态按视口分两档（D1b）：
 *   · ≥1280（正文列 max-w-5xl 的宽度）：常驻挤压 —— 正文外层让出与面板等宽的 padding-right
 *     （transition-[padding] 平滑过渡），无背景幕；
 *   · <1280：覆盖式 —— 半透明背景幕 + 右侧抽屉，正文不动（此宽度下 max-w-5xl 的正文列
 *     本就贴边，再挤压必不可读）。
 * z-index 走令牌 z-overlay（50）档：单一 fixed 容器（内部先背景幕后面板本体），
 * 面板 top 自顶栏下缘（56px）起不遮 TopNav；Toast（z-toast=60）仍在最上层。
 *
 * 登录页走 bare 外壳（App.tsx），不进本组件 ⇒ 面板天然只在登录后出现。
 *
 * ⚠ 让位的 padding 放在**外层包装**而不是 main 自己（F4 走查实测修正，D24）：
 * max-w-5xl = 64rem = **1024px**（不是 1280px）。若把 padding-right 加在 main 上，
 * padding 在 main 的盒内，1440 视口实测正文只剩 600px、且与面板之间空出 208px 死区；
 * 放在外层后 main 的 max-width 作用在「面板左边的可用宽度」上，实测 1440 下正文 976px、
 * 1280 下 832px，正文列始终紧贴面板左侧、无死区。
 *
 * ⚠ 让位量必须同时作用于**顶栏**（清尾轮 L11 修正，2026-09-24）：F3 只改了正文列，
 * 面板一展开顶栏仍按整宽居中 ⇒ 1440 实测顶栏内容左缘 232px vs 正文列左缘 32px（错位 200px），
 * 破坏了「内容列与顶栏共用同一条左基线」这条设计不变量。
 * 现在让位量写成 CSS 自定义属性（单一来源，见 ./panelDock.ts），顶栏 nav 与正文列外层
 * 读同一个变量 ⇒ 左基线恒等（实测开合两态差 0px），且不存在第二份 400px 常量。
 */

import { useEffect, useState, type ReactNode } from 'react';

import { useChatPanelStore } from '../stores/chatPanel';
import ChatPanel from './chat/ChatPanel';
import { DOCK_OFFSET_STYLE, dockOffsetVarStyle } from './panelDock';
import ToastHost from './ToastHost';
import TopNav from './TopNav';

/** 面板宽度（px）：常驻态正文外层让出等宽 padding-right，覆盖态抽屉同宽（窄屏再受 92vw 约束）。 */
const PANEL_WIDTH_PX = 400;

/** 常驻（挤压正文列）与覆盖（抽屉 + 背景幕）的分界，与正文列 max-w-5xl 同值（D1b）。 */
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
          className="absolute inset-0 bg-canvas/60"
        />
      )}
      <aside
        aria-label="对话辅导面板"
        className="absolute bottom-0 right-0 top-0 max-w-[92vw] border-l border-line bg-surface shadow-card"
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
  const open = useChatPanelStore((state) => state.open);
  const wideEnough = useViewportAtLeast(DOCK_MIN_WIDTH_PX);
  /** 常驻态才挤压正文列；覆盖态（窄屏）正文一律不动（D1b）。 */
  const docked = open && wideEnough;

  return (
    // 让位量写一次（单一来源）：顶栏 nav 与正文列外层都读这个自定义属性（L11）。
    <div className="min-h-screen bg-canvas text-ink" style={dockOffsetVarStyle(docked ? PANEL_WIDTH_PX : 0)}>
      <TopNav />
      {/* 常驻态：给面板让位的 padding 在外层（见文件头 D24 说明），main 的 max-w-5xl
          仍作用在「面板左边的可用宽度」上；覆盖态该变量为 0，正文一律不动。
          顶栏读同一个变量，故两者左基线始终一致（L11）。 */}
      <div className="transition-[padding] duration-200 ease-out" style={DOCK_OFFSET_STYLE}>
        <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
      </div>
      <ChatPanelDock docked={docked} />
      <ToastHost />
    </div>
  );
}
