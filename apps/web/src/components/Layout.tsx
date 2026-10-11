/**
 * 页面外壳（style-10「青蓝蓝图」迁移 P5：制图板四层骨架一次切换）
 *
 * 【它现在是什么】一张制图板：
 *
 *   Board（板：底色 + 四角标记 + 图幅档）
 *   ├─ Masthead（图签条：品牌 ⊕ 四项图签 ⊕ 身份芯片 ⊕ 索引/标注/面板开关 ⊕ 右区操作簇）
 *   ├─ workbench（grid）
 *   │  ├─ Rail（分层索引；≥901 才渲染，窄档收进「全部图纸」抽屉）
 *   │  └─ Sheet（图纸：页头 + 页面内容 + 右下标题栏）
 *   ├─ MobileNav（≤900 底部 5 项 tabbar + 「全部图纸」抽屉 + 空间切换/新建/管理）
 *   ├─ ChatPanelDock（对话面板三个形态，见下）
 *   ├─ BackToTop（回到图纸顶部）
 *   └─ ToastHost（非阻断批注条）
 *
 * 【三处必须说清的设计决定】
 *
 * 1) Rail 在窄档**根本不渲染**，而不是渲染后 CSS 隐藏。
 *    抽屉与正文靠 aria-hidden 互斥；多一个「渲染了但看不见」的可聚焦子树，
 *    焦点陷阱与 Tab 序都会踩到死区（该子树在 display:none 下 focus() 无效，
 *    会让 Tab 键彻底失效 —— 移动端适配轮已经踩过一次）。
 *
 * 2) 面板三形态（D3）挂 annos(1180) / sheet(900) 两档，不再是 1280/720：
 *      ≥1180 常驻挤压：正文与顶栏一起让出 400px（--panel-dock-offset 单一来源），无幕布；
 *      901–1179 覆盖抽屉：半透明幕布 + 右侧同宽抽屉，正文不动；
 *      ≤900   全屏覆盖：填满视口（含图签条），因为这一档图纸本身已是单列窄幅，
 *             留一条 400px 的右侧空隙会把正文压到不可读。
 *    「落位图纸右侧栏位」= 常驻态下它占的正是原型 `.annos` 标注列的视觉位置（图纸右缘），
 *    只是宽度仍取面板自身的 400px（对话需要的最小舒适宽），标注列本身在页面批才出现。
 *
 * 3) 未迁移页面（P6 起才逐页换）进新外壳的**简化形态**：它们没有 sheet-head，
 *    也没有标注，但会正常落在 Sheet 的内边距与标题栏之间。这是拍板的共存过渡态。
 *
 * 【让位量仍是单一来源】`--panel-dock-offset` 由本文件写入，workbench 与右区操作簇
 * 都读同一个变量 ⇒「内容列与顶栏共用同一条左基线」这条不变量在两态下都成立
 * （机制见 ./panelDock.ts，清尾轮 L11）。
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { LOGIN_PATH, ROUTES, routeOf } from '../router';
import { useAuthStore } from '../stores/auth';
import { useChatPanelStore } from '../stores/chatPanel';
import { useMobileNavStore } from '../stores/mobileNav';
import { useSpaceStore } from '../stores/space';
import Board, { useBlueprintTier, type BlueprintTier } from './blueprint/Board';
import Masthead from './blueprint/Masthead';
import Rail, { type RailItem } from './blueprint/Rail';
import Sheet, { sheetDimText } from './blueprint/Sheet';
import TitleBlock, { type TitleCell } from './blueprint/TitleBlock';
import ChatPanel from './chat/ChatPanel';
import MobileNav from './MobileNav';
import { DOCK_OFFSET_STYLE, dockOffsetVarStyle } from './panelDock';
import BackToTop from './BackToTop';
import ToastHost from './ToastHost';
import TopNav from './TopNav';

/** 面板宽度（px）：常驻态正文外层让出等宽，覆盖态抽屉同宽（窄档再受 92vw 约束）。 */
const PANEL_WIDTH_PX = 400;

/**
 * 常驻（挤压图纸）与覆盖（抽屉 + 幕布）的分界。
 *
 * ⚠ 从 1280 改挂 annos 档（1180，D3）：原判据是「挤出面板之后正文还剩多少可读宽度」，
 *   而新外壳的图纸自身有 48px 外框内边距与左侧 236px 索引列，同一份宽度的可读量
 *   比旧外壳少 —— 故分界必须提前到标注档，与原型「标注开启时 .sheet-grid 转两栏」
 *   的档位一致（≥1180 才允许图纸被切出一列）。
 * 值必须来自 tailwind.config.js 的 screens.annos，不能是第三个数。
 */
const DOCK_MIN_WIDTH_PX = 1180;

/**
 * 覆盖式与全屏覆盖的分界 = sheet 档（900）。
 *
 * ⚠ 必须与 CSS 的 `max-sheet:`（= `not all and (min-width:900px)`，即 ≤899.98）
 *   **同边界**：JS 侧写 900 → 「≥900 不铺满」，CSS 侧 ≥900 不铺满 —— 恰好 900 时两处一致。
 *   反例（首跑实测）：JS 侧曾写 901，于是恰好 900px 时 JS 判「铺满」而 CSS 的
 *   `max-sheet:left-0` 不生效，aside 掉进「只有 right 无 width」的自动宽度态，
 *   实测渲成 471px 宽的窄条（既不是覆盖抽屉也不是全屏）。
 */
const PANEL_FULLSCREEN_MAX_WIDTH_PX = 900;

/** 图签条高度（px）：覆盖态面板从它的下缘起，不遮图签条。 */
const MASTHEAD_HEIGHT_PX = 56;

/** 图号（规范 10 章：学生图纸 10-01…10-14、教师图纸 10-15…10-17）。 */
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
  '/t': '10-15',
  '/t/student': '10-16',
  '/t/recommendations': '10-17',
};

/** 图纸优先级（Rail 右列）：T0 = 学习闭环主链，T1 = 质量定型页，T2 = 辅助页。 */
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
 * 自持页头的图纸（2026-10-11 迁移 P6 / D16）。
 *
 * 【为什么需要这张表】外壳给所有页面补一个**通用页头**（eyebrow = 路由 label + 优先级、
 * h1 = 路由 label、dim = 图幅口径）。但迁移页的页头是**页面内容**：eyebrow 要写
 * `REPORT / 汇总与验证`、h1 要写 `学习报告 · 按空间汇总`、sub 里要嵌当前空间名、
 * chips 要挂该页的等级（`T0 · 可打印`）—— 这些数据只有页面拿得到，外壳给不出来。
 *
 * 【不给会怎样】两条路都错：外壳继续补一份则一页出现两个 h1（「学习报告」与
 * 「学习报告 · 按空间汇总」），大标题语义坏掉；外壳补一份而页面再写一份正文标题，
 * 则是同一件事两个真相。所以在**外壳登记、由页面自己渲染**——登记表是外壳的职责
 * （「哪些图纸已迁移」是外壳才知道的事），页头内容仍是页面的职责。
 *
 * ⚠ 这是 P6 首个迁移页带出的外壳机制（计划 P6 只列了 ReportPage + index.css，
 *   本表属偏差，见 02_EXEC_REPORT 的 D16 留痕）。后续页面迁移时在这里加一行即可。
 *
 * 【2026-10-11 迁移 P7（D19，INFO-1 认领）】/graph 页头归**页面自有**：原型 PAGES.graph
 *   两个分支（有证据 L2865 / 空图谱 L2854）都渲染自己的 sheetHead，且 sub/chip 数据
 *   只有页面拿得到 —— 登记 '/graph'，避免外壳再补一份通用页头造成双 h1。
 */
const PAGE_OWNED_HEAD = new Set<string>(['/report', '/graph']);

/** 图幅档 → 标题栏比例（规范 4.3：xl 1:1 / lg 1:2 / md 1:5 / sm 1:10）。 */
const TIER_SCALE: Record<BlueprintTier, string> = {
  xl: '1:1',
  lg: '1:2',
  md: '1:5',
  sm: '1:10',
};

/** 一个批次内写死的日期：图纸签署日期是「本图纸的签发日」，不是实时时钟。 */
const ISSUE_DATE = '2026-10-10';

function readMatch(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;
  } catch {
    return false;
  }
}

/** 视口是否 ≥ minWidth（matchMedia 订阅；不支持 matchMedia 的环境按窄屏处理 = 覆盖式）。 */
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
 *
 * docked（≥1180 且展开）→ 无幕布（正文自己让位，见 --panel-dock-offset）；
 * 否则为覆盖态 → 半透明幕布（点击关闭）；≤900 时面板铺满视口。
 * 关闭时不渲染任何 DOM（不给隐藏的可交互节点留后门）。
 */
function ChatPanelDock({ docked, fullScreen }: { docked: boolean; fullScreen: boolean }) {
  const open = useChatPanelStore((state) => state.open);
  const setOpen = useChatPanelStore((state) => state.setOpen);

  if (!open) return null;

  return (
    // ⚠ 这一层 fixed inset-x-0 铺满整宽：它只是面板与幕布的定位上下文，
    // **不是可交互表面**。必须 pointer-events-none，否则常驻态（无幕布）下
    // 这一整层会替面板挡住全页的点击——面板旁边的正文看起来没被遮，实际一次都点不到。
    // overflow-hidden：入场动画的起始帧是 `translateX(100%)`，那一帧里面板整个
    // 落在视口右侧之外。**fixed 容器的可滚动溢出会被算进文档宽度**（真浏览器实测：
    // 面板打开时 documentElement.scrollWidth 从 470 涨到 750 = 视口 + 面板宽），
    // 于是桌面会闪一条横向滚动条。给定位层剪掉溢出即消除该副作用 ——
    // 这一层是纯定位层（pointer-events-none），剪掉不会影响任何可见内容。
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-overlay overflow-hidden"
      style={{ top: fullScreen ? 0 : MASTHEAD_HEIGHT_PX }}
    >
      {docked ? null : (
        <button
          type="button"
          // 与面板头部的关闭键区分开（同一可访问名会读屏歧义；F4 走查发现，D25）
          aria-label="点击空白处关闭对话面板"
          onClick={() => setOpen(false)}
          className="scrim pointer-events-auto absolute inset-0 animate-fade"
        />
      )}
      <aside
        // data-print='hide'：打印时隐藏面板，否则右侧会切掉一栏内容。
        data-print="hide"
        aria-label="对话辅导面板"
        // animate-slide-in-panel：与「全部图纸」抽屉同一条入场曲线（160ms，规范第 8 章）。
        className="pointer-events-auto absolute bottom-0 right-0 top-0 animate-slide-in-panel border-l border-line bg-surface max-sheet:left-0 max-sheet:border-l-0"
        style={fullScreen ? undefined : { width: PANEL_WIDTH_PX, maxWidth: '92vw' }}
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
  const notFullScreen = useViewportAtLeast(PANEL_FULLSCREEN_MAX_WIDTH_PX);
  /** 常驻态才挤压图纸；覆盖态（窄档）正文一律不动（D3）。 */
  const docked = open && wideEnough;
  const fullScreen = !notFullScreen;

  /** 「全部图纸」抽屉（原汉堡抽屉）：store 零改动，行为语义完全复用。 */
  const navOpen = useMobileNavStore((state) => state.open);

  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);

  const tier = useBlueprintTier();

  /** 两个图层开关（索引 / 标注）。会话级组件态：刷新回到缺省（索引开、标注关）。 */
  const [railOpen, setRailOpen] = useState(true);
  const [annosOpen, setAnnosOpen] = useState(false);

  const route = routeOf(pathname);
  const sheetNo = SHEET_NO[pathname] ?? '10-00';
  const pr = SHEET_PR[pathname] ?? 'T2';
  const activeSpace = spaces.find((space) => space.space_id === activeSpaceId) ?? null;

  /** 分层索引项：路由表派生（router.ROUTES 是冻结区，只读不改）。 */
  const railItems: RailItem[] = ROUTES.filter((item) => item.path !== LOGIN_PATH).map((item) => ({
    path: item.path,
    dwg: SHEET_NO[item.path] ?? '10-00',
    label: item.label,
    pr: SHEET_PR[item.path] ?? 'T2',
  }));

  const meta = [
    { label: '项目 / PROJECT', value: '初中数学' },
    { label: '图号 / SHEET', value: sheetNo },
    { label: '比例 / SCALE', value: TIER_SCALE[tier] },
    { label: '日期 / DATE', value: ISSUE_DATE },
  ];

  /** 右下标题栏 8 格（规范 4.3）。 */
  const titleCells: TitleCell[] = [
    { label: '项目 / PROJECT', value: '知微·初中数学' },
    { label: '图号 / SHEET', value: sheetNo },
    { label: '比例 / SCALE', value: TIER_SCALE[tier] },
    { label: '日期 / DATE', value: ISSUE_DATE },
    { label: '视图 / VIEW', value: route?.label ?? '未登记' },
    { label: '制图 / DRAWN', value: '知微前端' },
    { label: '状态 / STATUS', value: token ? '已签发' : '草稿' },
    { label: '签发 / ISSUED', value: role === 'teacher' ? '教师端' : '学生端' },
  ];

  return (
    // 让位量写一次（单一来源）：workbench 与右区操作簇都读这个自定义属性。
    // 外壳最小高：动态视口高 min-h-dvh（移动端适配轮 R4）—— 见 Board 的 min-h-dvh。
    <Board
      tier={tier}
      railOpen={railOpen}
      annosOpen={annosOpen}
      style={dockOffsetVarStyle(docked ? PANEL_WIDTH_PX : 0)}
    >
      <Masthead
        meta={meta}
        // 身份芯片：未登录 / 学生 / 教师。昵称不取（auth store 只落 user_id，
        // 没有昵称字段 —— 不为了填一格而编一个名字）。
        identity={{ role: token ? role : 'guest' }}
        railOpen={railOpen}
        annosOpen={annosOpen}
        onRailToggle={() => setRailOpen((value) => !value)}
        onAnnosToggle={() => setAnnosOpen((value) => !value)}
        panelOpen={open}
        onTogglePanel={() => useChatPanelStore.getState().toggle()}
        trailing={<TopNav />}
        // 常驻态让位：读与 workbench 同一个自定义属性 —— 否则面板会盖住右区操作簇
        //（需求文档 §5 风险表「面板与标题栏打架」的处置）。
        className="transition-[padding] duration-200 ease-out [padding-right:var(--panel-dock-offset,0px)]"
      />

      {/* workbench：常驻态给面板让位的 padding 落在外层（D24），
          让 Sheet 的可用宽度仍是「面板左边的宽」；顶栏右区读同一个变量 ⇒ 左基线一致。
          aria-hidden：抽屉 / 覆盖式面板打开期间正文对读屏隐藏（关闭时不渲染该属性 →
          DOM 与默认态一致）。 */}
      <div
        className="mx-auto w-full transition-[padding] duration-200 ease-out"
        style={DOCK_OFFSET_STYLE}
        aria-hidden={navOpen || (open && !docked) || undefined}
      >
        <div
          className={[
            'grid items-start',
            railOpen && tier !== 'md' && tier !== 'sm' ? 'sheet:grid-cols-[236px_minmax(0,1fr)]' : 'grid-cols-1',
          ].join(' ')}
        >
          {railOpen && tier !== 'md' && tier !== 'sm' ? (
            <Rail
              items={railItems}
              note={
                <>
                  <span className="block">图层：图纸 / 索引 / 标注</span>
                  <span className="block">
                    当前空间：{activeSpace ? activeSpace.name : '未选择'}
                  </span>
                </>
              }
            />
          ) : null}

          <Sheet
            // max-sheet:pb-[76px]：≤900 档底部 tabbar 固定在视口底，图纸要给
            // 它让出 76px（tabbar 52px + 安全区 + 呼吸），否则页尾内容被压住。
            className="min-w-0 max-sheet:pb-[76px]"
            // 已迁移页自持页头（见 PAGE_OWNED_HEAD）：head 传 undefined，由页面渲染。
            head={
              PAGE_OWNED_HEAD.has(pathname)
                ? undefined
                : {
                    eyebrow: `${route?.label ?? '未登记'} / ${pr} 图纸`,
                    sheetNo,
                    title: route?.label ?? '这一页还没有登记图号',
                    dim: sheetDimText(tier),
                  }
            }
          >
            {children}
            <TitleBlock cells={titleCells} />
          </Sheet>
        </div>
      </div>

      {/* 回到图纸顶部：放在浮层之前，保证抽屉 / 面板 / 批注条都在它之上。 */}
      <BackToTop />
      {/* 「全部图纸」抽屉 + ≤900 底部 tabbar：自身在 ≥900 不渲染（sheet:hidden）。 */}
      <MobileNav />
      <ChatPanelDock docked={docked} fullScreen={fullScreen} />
      <ToastHost />
    </Board>
  );
}
