/**
 * 页 8 · 知识图谱（兼「学习路径页」）→ v2.1 技能树 2.0
 *
 * 数据：#32 GET /api/graph/mastery（v2.1 起本页唯一数据源 —— 一次带回结构化掌握度 +
 *       游戏化摘要：evidence_total / newly_mastered_7d / weakest / confidence）。
 *       band 由服务端 engine.masteryToBand 同源计算，前端只消费不重算（纪律不变）。
 *
 * ── style-10「青蓝蓝图」迁移 P7（2026-10-11）：/graph 视觉层按原型 PAGES.graph
 *    （tempui/prototypes/style-10/index.html L2793-2908）逐段复现，**业务逻辑一行不改**：
 *
 *   ① 页头        SheetHead：eyebrow「KNOWLEDGE GRAPH / 先修链全景」+ SHEET 10-11
 *                 + 需求 2.11；h1 有证据态「知识图谱 · 也是学习路径页」/ 空态
 *                 「知识图谱：现在是空的」；chip「T0 · 三重编码」（cyan）。页头归页面
 *                 自有（D19：Layout 的 PAGE_OWNED_HEAD 登记 '/graph'，外壳不再补第二份 h1）
 *   ② 01 证据统计  四格 measure（总证据 / 本周新点亮 / 覆盖进度 / 章节通关），数据全部
 *                 来自既有 summary / badges，不新增请求；「本周点亮」WeekCount 随点火
 *                 爬升 + badge-pop 尾注机制保留（冻结）
 *   ③ 02 画布      画布制式容器 + 工具条四钮（放大 / 缩小 / 复位 / 导出海报）+ ECharts
 *                 画布（roam 保留）+ 窄屏降级 note + 图例底条（BandLegend）+ 底部 row
 *                 （缩放倍数 / 平移提示 / 路径高亮态 / 导出海报）。原型「模拟从报告带入
 *                 路径」演示按钮不复现（D5：不引入 mock 交互）
 *   ④ 画布内节点/边  四档形状 symbol（graphSymbol，D20①）+ 画布单行标签（名称，11px 走
 *                 ink 令牌不用天蓝，D20②；百分数与编号由 tooltip / 详情卡 / 文字清单承载，
 *                 见 setOption 处的取舍注）+ 低置信边框虚线补偿 + 边 hl/done
 *                 「已打通」角标 + 箭头 + 路径高亮降透明（DIM_OPACITY 冻结）
 *   ⑤ 03 节点详情 + 04 为什么是这张图  双栏（annos 档以上）：kv 清单 + 掌握度条 + CTA
 *                 （navigate 语义冻结）；aside 分层排布说明 + tick-list 四条
 *   ⑥ 05 非图形文字版清单  细网格表**全档常在**（替换旧 details 折叠）：知识点 / 章节 /
 *                 掌握度 / 档位 / 证据 / 先修链；行可点开同一张详情卡（键盘回车保留）
 *   ⑦ 空态分支    !hasAnyEvidence → 空态版页头 + 01 空状态 emptyBox（三条冷启动出路）
 *                 + 02 口径图例；不放示例节点
 *
 * 【四态（规范 §7；本页为区域级）】
 *   loading → SkeletonLines（PageSkeleton 留给未迁移页）
 *   失败     → Stamp 红章 + 真重试（D15c 最小新增，插 loading 之后、数据态之前）
 *   无空间   → 虚线空盒 EmptyState（现有文案，D5）
 *   无数据   → ⑦ 空态分支
 *
 * 【计划 3.1 追加红线（逐条遵守）】
 *   · 取数 useEffect（getGraphMastery 调用 / cancelled 清理 / 依赖数组 [activeSpaceId]）逐字符不改；
 *   · 守卫分支顺序：无空间 → loading →（失败）→ 空态/数据态；
 *   · 派生与机制语义不改：byKp/summary/badges/counts 派生、六态视觉机、点火机制
 *     （IGNITE_BASE_MS / IGNITE_STAGGER_MS / ignitionLandingMs / lastIgnitionSourceRef
 *     重绘不重播判定）、主题重绘机制（theme 进 effect deps + themeColor 读 CSS 变量）、
 *     poster 链路、文字清单键盘行为语义、UI_TEXT/STATE_HINT/EVIDENCE_LABEL 文案常量。
 *
 * 【375 档纪律（D14 精神）】旧实现用内联 `minWidth: max(720, layout.width+200)` 把画布
 *   撑出页面级横向滚动（/graph overflowPx≠0 的根因）。本轮改为**画布内缩放**：容器
 *   `w-full` + 固定视口高（制式类），初始 `zoom/center` 由容器实测尺寸算「适应窗口」，
 *   页面不再出现横向溢出。目标：audit-style10-375.json 中 /graph overflowPx = 0。
 *   窄档补充（2026-10-11 走查复核）：适配缩放下限取 0.3（避免缩到节点成点），且容器
 *   宽 < 700px 时不画节点文字（标签不随 roam 缩放，窄档会叠成一团）—— 窄档画布退化为
 *   「形状地图」，名称/百分数/编号由下方 05 文字清单承载（原型窄档降级同口径）。
 *
 * ── 第 3 轮认领清偿（P8.1，2026-10-11 第 4 轮）：
 *   · M-1（1440/1024 档节点标签叠压成片不可读，D21 第二层）：核实「label.width:96 +
 *     overflow:'truncate' 单独控密度不足」后，改用 series 级 labelLayout:{hideOverlap:true}
 *     （ECharts 内建避让，重叠标签自动隐藏且 emphasis 态保留 → 悬停仍可见）+ shortLabel
 *     把超长名称截到 8 字 + 省略号（完整名称由 tooltip / 详情卡 / 05 文字清单承担）。
 *     不动任何冻结语义（点火 / DIM_OPACITY / 重绘机制 / 文字清单键盘语义 / 取数）。
 *   · L-1（D22）：ZOOM_MIN 由 0.12 改 0.3，与「适应窗口」地板同口径（防节点成点），
 *     禁止两口径并存。
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
// 按需引入（前端优化批一）：本页只用到 graph 系列 + tooltip + canvas 渲染器。
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

import { ApiError } from '../api/client';
import { getGraphMastery } from '../api/endpoints';
import type { GraphMasteryData } from '../api/types';
import BandLegend from '../components/BandLegend';
import EmptyState from '../components/EmptyState';
// 完成奖励（awwwards 适配包 2）：节点「已掌握」时刻的小号描边对勾
import SuccessMark from '../components/SuccessMark';
import BandMark, { type BandKey } from '../components/blueprint/BandMark';
import { useBlueprintTier } from '../components/blueprint/Board';
import MeasureBox from '../components/blueprint/MeasureBox';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import Stamp from '../components/blueprint/Stamp';
import { Icon } from '../components/blueprint/icons';
import { Badge, Button, IconButton, buttonVariants } from '../components/ui';
import { GRAPH_NODES, snapshotNode } from '../data/graphSnapshot';
import { computeGraphLayout, isPathEdge, parsePathParam } from '../lib/graphLayout';
import {
  chapterBadges,
  edgeLit,
  masteryByKpOf,
  treeNodeState,
} from '../lib/graphMastery';
import type { ChapterBadge, TreeNodeState } from '../lib/graphMastery';
import { symbolForState } from '../lib/graphSymbol';
import { buildGrowthPoster, downloadPoster } from '../lib/poster';
import { cn } from '../lib/cn';
import { percent } from '../lib/format';
import { prefersReducedMotion, scrollBehavior, subscribePrefersReducedMotion } from '../lib/motion';
import { UI_TEXT } from '../lib/phrases';
import { useCountUp } from '../lib/useCountUp';
import { SPACES_PATH } from '../router';
import { BAND_HEX, BAND_ORDER, PRIMARY_HEX, masteryBandOf, masteryHexOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { useAttributionStore } from '../stores/attribution';
import { useSpaceStore } from '../stores/space';
import { useThemeStore } from '../stores/theme';
import { useUiStore } from '../stores/ui';

/** 模板页的固定元信息（原型 sheetHead 的图号与需求号，规范 §10 / 原件 2.11）。 */
const SHEET_NO = '10-11';
const SECTION_NO = '2.11';

/** 非路径元素的不透明度（高亮时其余节点降透明）。 */
const DIM_OPACITY = 0.28;
/** 主题取不到时的兜底（浅色值）。正常情况下不会用到。 */
const EDGE_COLOR_FALLBACK = '#C9D3D8';
const TEXT_COLOR_FALLBACK = '#22303A';
/** 未点亮 / 锁定的描边色（跟随主题 line 变量，兜底深色值）。 */
const LOCKED_COLOR_FALLBACK = '#4A5560';

/** 节点点火动画时刻表：setOption 与「本周点亮」尾注共用一份（改一处两处同步）。 */
const IGNITE_BASE_MS = 900;
const IGNITE_STAGGER_MS = 36;

/**
 * 画布视图缩放的安全范围（工具条 / 键盘共同遵守）。
 * 下限 0.3 与「适应窗口」地板同口径（D22 / 第 3 轮 L-1 清偿）：两者都遵守
 * 「防节点成点」这一条取舍，不允许一个 0.12 一个 0.3 并存。
 */
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 8;
/** 键鼠一次缩放的倍率（原型 gZoom 取 1.2 / 0.83）。 */
const ZOOM_STEP_IN = 1.2;
const ZOOM_STEP_OUT = 0.83;
/** 方向键平移的屏幕步长（px）；换算到数据坐标时除以当前缩放。 */
const PAN_STEP_PX = 60;

/**
 * 画布节点标签的最长字数（第 3 轮 M-1 清偿 / D21 第二层）。
 * 依据：列距 240px × 适应缩放 ~0.3 ≈ 72px 在屏间距，而 11px 字体下一个中文字约 11px
 * —— 16 字的章节名（≈176px）必然与左右两列的标签咬合成片（第 3 轮 1440 档实采确证）。
 * 截断到 8 字 + 省略号（≈99px）后，配合 series 级 labelLayout.hideOverlap 的内建避让，
 * 留在画布上的标签都是可读的；完整名称照旧由 tooltip、节点详情卡、05 非图形文字版清单
 * 三处承担（D8「文字编码多路径」口径不变）。
 */
const LABEL_MAX_CHARS = 8;

/** 最后一个节点落位的时刻（24 节点 → 约 1.7s）。 */
function ignitionLandingMs(nodeCount: number): number {
  return IGNITE_BASE_MS + Math.max(0, nodeCount - 1) * IGNITE_STAGGER_MS;
}

/** 「本周点亮 +N」的滚动数字：随节点点火爬升，最后一个节点落位时正好到达 N。 */
function WeekCount({ to, duration }: { to: number; duration: number }): ReactNode {
  const value = useCountUp(to, { duration });
  return (
    <>
      {/* 爬升中的中间值对读屏是噪音（恰好导航到这会听到 37% 当真值）：
          视觉值 aria-hidden，终值用 sr-only 提供一份静态可读文本（复评 P3）。 */}
      <span aria-hidden="true">{Math.round(value)}</span>
      <span className="sr-only">+{to}</span>
    </>
  );
}

/** 六态在图表里的视觉（颜色/描边在 setOption 处组装，这里只管语义标签）。 */
const STATE_HINT: Record<string, string> = {
  mastered: '已点亮',
  basic: '接近点亮',
  unstable: '不太稳',
  weak: '待攻克',
  untouched: '还没碰过',
  locked: '先修未通，暂锁定',
};

/** 六态 → 档位名（文字清单「档位」列与详情面板 bandTag 的共用映射）。 */
const STATE_BAND: Record<TreeNodeState, BandKey> = {
  mastered: '已掌握',
  basic: '基本掌握',
  unstable: '不稳定',
  weak: '待巩固',
  untouched: '未接触',
  locked: '未解锁',
};

const EVIDENCE_LABEL: Record<string, string> = {
  silent: '静默观察',
  paper: '试卷',
  diagnose: '测评',
  self_report: '自报',
  practice: '练习批改',
};

function themeColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw})` : fallback;
}

/**
 * 画布与清单共用的短编号：原型节点 id 是短码（K1…K14），本项目 id 是长路径
 * （math.cz.…）。画布与表格列宽有限，去掉公共前缀 `math.cz.` 后的末段更可读
 * （纯展示变换，不动数据；`graphSnapshot` / `graphLayout` 属冻结区）。
 */
function shortKpId(id: string): string {
  return id.replace(/^math\.cz\./, '');
}

/** kp 显示名：优先 #32 的服务端名称，兜底结构快照（禁止白屏的既有纪律）。 */
function kpNameOf(id: string, serverName: string | undefined): string {
  return serverName ?? (snapshotNode(id)?.name ?? id);
}

/** 画布标签文本：截断 + 省略号，控住密度（见 LABEL_MAX_CHARS；纯展示变换，不动数据）。 */
function shortLabel(name: string): string {
  return name.length > LABEL_MAX_CHARS ? `${name.slice(0, LABEL_MAX_CHARS)}…` : name;
}

/** 画布视图相机（数据坐标系）：适应窗口的初始值 + 键盘/工具条的缩放与平移。 */
interface GraphView {
  zoom: number;
  center: [number, number];
}

export default function GraphPage() {
  const [params, setParams] = useSearchParams();
  const highlightPath = parsePathParam(params.get('path'));
  const bootstrapped = params.get('bootstrapped') === '1';

  const [report, setReport] = useState<GraphMasteryData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  /** 点火是否已落位（最后一个节点到达）：控制「本周点亮」徽标的 badge-pop 尾注。 */
  const [ignited, setIgnited] = useState(false);
  /** 已落定的那次取数属于哪个空间（失败态判定的前提，D15c 同口径）。 */
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);
  /** 画布当前缩放倍数（工具条/键盘操作后回显；复位与主题重绘回到适应窗口的初始值）。 */
  const [zoomLevel, setZoomLevel] = useState(1);
  /** 失败态重试在途（D15c 最小新增，与 P6 /report 同口径）。 */
  const [retrying, setRetrying] = useState(false);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const plan = useAttributionStore((state) => state.plan);
  // 复测 CTA 用 react-router 导航（包 C）：不用 window.location.hash 直改，保住路由状态。
  const navigate = useNavigate();
  /** 主题切换 → 画布配色重取 CSS 变量（进图表 effect 的 deps）。 */
  const theme = useThemeStore((state) => state.theme);
  const tier = useBlueprintTier();

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** 详情卡锚点：从文字清单开卡时滚过去并把焦点交给卡片（卡片在上方图容器内，视口外）。 */
  const detailCardRef = useRef<HTMLDivElement | null>(null);
  /** 点火只随数据变化重放：byKp 是 report 的 useMemo 派生，主题/路径重绘时身份不变。 */
  const lastIgnitionSourceRef = useRef<unknown>(null);
  /** ECharts 实例（键盘 / 工具条直接操作视图，不必重建图表）。 */
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  /** 当前相机（数据坐标系）。 */
  const viewRef = useRef<GraphView>({ zoom: 1, center: [0, 0] });
  /** 适应窗口的相机（复位用）。 */
  const fitRef = useRef<GraphView>({ zoom: 1, center: [0, 0] });
  /** 动效偏好做成响应式（复评 P3）：运行中切换「减弱动态」→ 下次重绘瞬时到位，不用刷新页面。 */
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());
  useEffect(() => subscribePrefersReducedMotion(setReducedMotion), []);

  const layout = useMemo(() => computeGraphLayout(), []);
  const byKp = useMemo(() => masteryByKpOf(report?.nodes ?? []), [report]);
  const summary = report?.summary ?? null;
  const badges = useMemo<ChapterBadge[]>(() => chapterBadges(byKp), [byKp]);

  /** 冷启动（拍卷建图）横幅：确认后带 ?bootstrapped=1 跳入，展示一次即关闭。 */
  function dismissBootstrap(): void {
    params.delete('bootstrapped');
    setParams(params, { replace: true });
  }

  useEffect(() => {
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await getGraphMastery(activeSpaceId);
        if (!cancelled) setReport(data);
      } catch (error) {
        if (!cancelled) toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId]);

  /** 取数落定记账（D15c）：记空间 id 才分得清「首次失败」与「切空间在途」。 */
  useEffect(() => {
    if (!loading && activeSpaceId) setLoadedSpaceId(activeSpaceId);
  }, [loading, activeSpaceId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !report) return;

    const chart = echarts.init(container);
    chartRef.current = chart;
    // canvas 内动画不受 CSS reduce 块管辖，JS 侧自行降级（偏好是响应式 state，切设置即生效）。
    const reduced = reducedMotion;
    // 点火重放判定：byKp 变了（新数据/新空间）才重播；主题切换或路径高亮的重绘不重播。
    const replayIgnition = lastIgnitionSourceRef.current !== byKp;
    lastIgnitionSourceRef.current = byKp;
    // 节点文字走 ink 令牌：原型 nsh（环内百分数）用天蓝 #4E86D6，面板合成底仅 4.15:1，
    // 迁移计划已禁用天蓝做小字（D20②）；本页画布标签一律取当前主题达标的 ink 家族。
    const textColor = themeColor('--c-ink', TEXT_COLOR_FALLBACK);
    const edgeColor = themeColor('--c-line', EDGE_COLOR_FALLBACK);
    const accentColor = themeColor('--c-accent', PRIMARY_HEX);
    const lockedColor = themeColor('--c-line', LOCKED_COLOR_FALLBACK);
    const doneColor = BAND_HEX['已掌握'];
    const onPath = (id: string): boolean => highlightPath.includes(id);

    // 画布视图：按容器实测尺寸算「适应窗口」的初始 zoom/center（消除页面级横向溢出）。
    // 下限 0.3（= ZOOM_MIN，D22 同口径）：窄档若照字面 fit 会缩到 ~0.15（节点成点、不可读），
    // 故留一个「看得见形状」的地板，超出部分由 roam（拖拽 / 方向键）查看 —— 完整可读的表
    // 在下一节（原型窄档口径）。
    const pad = 56;
    const cw = container.clientWidth || 720;
    const ch = container.clientHeight || 360;
    const gw = Math.max(1, layout.width);
    const gh = Math.max(1, layout.height);
    const fitZoom = Math.max(0.3, Math.min(1.1, Math.min((cw - pad) / gw, (ch - pad) / gh)));
    const fit: GraphView = { zoom: fitZoom, center: [gw / 2, gh / 2] };
    // 窄画布（<700px）不画节点文字：标签不随 roam 缩放（ECharts 行为），窄档下会叠成一团。
    // 此时画布退化为「形状地图」，名称/百分数/编号由下方文字清单承载（与原型窄档降级同口径）。
    const showLabels = cw >= 700;
    fitRef.current = fit;
    viewRef.current = fit;
    setZoomLevel(fitZoom);

    chart.setOption(
      {
        tooltip: {
          formatter: (raw: unknown) => {
            const data = (raw as { data?: { id?: string } }).data;
            if (!data?.id) return '';
            const snapshot = snapshotNode(data.id);
            const profile = byKp.get(data.id);
            const mastery = profile?.mastery ?? 0;
            const state = treeNodeState(snapshot ?? { ...GRAPH_NODES[0], id: data.id }, byKp);
            const lines = [
              kpNameOf(data.id, profile?.name),
              `章节：${snapshot?.chapter ?? '—'}`,
              `掌握度：${percent(mastery)}（${masteryBandOf(mastery)}）`,
              `状态：${STATE_HINT[state] ?? state}`,
            ];
            if (profile && profile.confidence === 'low') {
              lines.push('？从旧卷/自报估的 —— 做 2 道复测会更准');
            }
            return lines.join('<br/>');
          },
        },
        // 节点错落点亮：先修链上游先亮，下游跟进（一次性的「点火」仪式感）
        // 系统开了「减弱动态效果」→ 瞬时到位；主题/路径重绘 → 不重播（省 1.7s 的重复闪烁）。
        animationDuration: reduced || !replayIgnition ? 0 : IGNITE_BASE_MS,
        animationDelay:
          reduced || !replayIgnition ? 0 : (rawIndex: number) => rawIndex * IGNITE_STAGGER_MS,
        animationEasing: 'cubicOut',
        series: [
          {
            // id 固定：工具条 / 键盘用 setOption({series:[{id:'graph',…}]}) 合并更新视图。
            id: 'graph',
            type: 'graph',
            layout: 'none',
            roam: true,
            draggable: false,
            // 视图相机（数据坐标系）：适应窗口，见上面 fit。
            zoom: fit.zoom,
            center: fit.center,
            edgeSymbol: ['none', 'arrow'],
            edgeSymbolSize: 6,
            label: {
              // 单 label 锚点的取舍（原型三段文本：环上编号 / 环内百分数 / 下方名称）：
              // ECharts graph 节点只有一个 label 锚点，且节点文字**不随 roam 缩放**
              // （原型 SVG 连文字一起缩放）——两条都做不了，只能取一条单行标签以控住密度：
              // 画布承载「形状（symbol）+ 名称（label）」两重编码；百分数（数字）与编号
              // 由 tooltip、节点详情卡、文字清单三处承载。三重编码在图例（形状+色+文字+区间）
              // 与文字清单（编号+名称+百分数+档位）上完整成立。落差留痕见执行报告。
              // M-1 清偿（D21 第二层）：宽度截断只是兜底（8 字短标签 ≈99px 已先由 shortLabel
              // 截好），真正的密度控制交给下面的 labelLayout.hideOverlap。
              show: showLabels,
              position: 'bottom',
              distance: 6,
              fontSize: 11,
              color: textColor,
              width: 96,
              overflow: 'truncate',
              formatter: (raw: unknown) => {
                const data = (raw as { data?: { labelText?: string } }).data;
                return data?.labelText ?? '';
              },
            },
            // ECharts 内建标签避让（第 3 轮 M-1 清偿 / D21 第二层）：重叠的标签自动隐藏
            // （label.ignore = true，emphasis 态保留 → 鼠标悬停/聚焦仍能看到该节点名称），
            // 单靠 label.width/overflow 截断不足以控住「多列标签咬合成片」的密度。
            labelLayout: { hideOverlap: true },
            emphasis: { focus: 'adjacency', label: { fontSize: 12 } },
            data: layout.nodes.map((placed) => {
              const snapshot = snapshotNode(placed.id);
              const state = treeNodeState(snapshot ?? { ...GRAPH_NODES[0], id: placed.id }, byKp);
              const profile = byKp.get(placed.id);
              const mastery = profile?.mastery ?? 0;
              const onHighlight = onPath(placed.id);
              const dim = highlightPath.length > 0 && !onHighlight;
              const isSelected = selected === placed.id;

              // 六态 → 视觉（形状走 graphSymbol，D20①）
              const filled = state !== 'untouched' && state !== 'locked';
              const color = filled ? masteryHexOf(mastery) : 'transparent';
              const border =
                state === 'locked'
                  ? lockedColor
                  : state === 'untouched'
                    ? edgeColor
                    : onHighlight
                      ? accentColor
                      : BAND_HEX[masteryBandOf(mastery) as MasteryBand];
              // 低置信：原型内环虚线（L2813）在 ECharts 单 symbol 下无法双 path →
              // 用节点边框虚线 + 详情面板/图例「低置信」标注补偿（D20 留痕）。
              const borderType: 'solid' | 'dashed' =
                state === 'locked' || profile?.confidence === 'low' ? 'dashed' : 'solid';
              // 选中/高亮加粗描边（D8⑥ 键盘选中态在画布上的近似表达）。
              const borderWidth =
                onHighlight || isSelected ? 3 : state === 'weak' ? 2.5 : state === 'untouched' || state === 'locked' ? 1.5 : 1;
              const name = kpNameOf(placed.id, profile?.name);

              return {
                id: placed.id,
                name,
                x: placed.x,
                y: placed.y,
                symbol: symbolForState(state),
                symbolSize: onHighlight || isSelected ? 34 : state === 'weak' ? 30 : 26,
                // 画布单行标签 = 名称的短标签（>8 字截断 + 省略号，见 shortLabel；
                // 11px ink 令牌，D20② 不用天蓝）；百分数由 tooltip/详情卡/文字清单承载。
                labelText: shortLabel(name),
                itemStyle: {
                  color,
                  borderColor: border,
                  borderWidth,
                  borderType,
                  opacity: dim ? DIM_OPACITY : 1,
                },
                label: { opacity: dim ? DIM_OPACITY : 1 },
              };
            }),
            edges: layout.edges.map((edge) => {
              const lit = edgeLit(edge.from, edge.to, byKp);
              const onHighlight = isPathEdge(edge.from, edge.to, highlightPath);
              const dim = highlightPath.length > 0 && !onHighlight;
              // 「打通」= 高亮且两端已掌握（原型 done 口径 L2824）。
              const done = onHighlight && lit;
              return {
                source: edge.from,
                target: edge.to,
                lineStyle: {
                  color: done ? doneColor : onHighlight || lit ? accentColor : edgeColor,
                  width: done ? 2.2 : onHighlight ? 2.5 : lit ? 2 : 1,
                  opacity: dim ? DIM_OPACITY * 0.8 : lit ? 0.9 : 0.5,
                  curveness: 0.06,
                },
                // 「已打通」角标（原型 L2829）：ECharts edge 无独立 label 字段，
                // 用边的 label 承担；两端已掌握且在高亮路径上才显示。
                label: done
                  ? { show: true, formatter: '已打通', fontSize: 10, color: accentColor }
                  : { show: false },
              };
            }),
          },
        ],
      },
      true,
    );

    chart.on('click', (raw: unknown) => {
      const data = (raw as { data?: { id?: string } }).data;
      if (data?.id) setSelected(data.id);
    });

    const onResize = (): void => chart.resize();
    window.addEventListener('resize', onResize);

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            chart.resize();
          });
    observer?.observe(container);

    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
    // theme 进 deps（2026-10-09）：配色在 effect 里读 CSS 变量，主题切换后必须重取重绘；
    // 其余依赖不变（eslint 认不出 theme 的用途）。
    // reducedMotion 进 deps（2026-10-09 复评）：偏好切换 → 重绘瞬时到位。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, highlightPath.join(','), layout, byKp, theme, reducedMotion]);

  /** 视图操作（键盘 / 工具条共用）：写回相机 + 合并更新 series，不重建图表。 */
  function applyView(zoom: number, center: [number, number]): void {
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    viewRef.current = { zoom: clamped, center };
    setZoomLevel(clamped);
    chartRef.current?.setOption({ series: [{ id: 'graph', zoom: clamped, center }] });
  }

  /** 缩放（以当前视图中心为锚）。 */
  function zoomBy(factor: number): void {
    applyView(viewRef.current.zoom * factor, viewRef.current.center);
  }

  /** 复位：回到适应窗口的初始相机。 */
  function resetView(): void {
    applyView(fitRef.current.zoom, fitRef.current.center);
  }

  /** 平移（数据坐标增量）：正 dx 使画面右移。 */
  function panBy(dx: number, dy: number): void {
    const { zoom, center } = viewRef.current;
    applyView(zoom, [center[0] + dx, center[1] + dy]);
  }

  /**
   * 画布键盘操作（D20④ 候选 A）：方向键平移、加减号缩放。
   * canvas 内的节点无 DOM 焦点（节点级键盘选中走下方文字清单，见 D20④ 候选 B）。
   */
  function onCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const step = PAN_STEP_PX / Math.max(ZOOM_MIN, viewRef.current.zoom);
    switch (event.key) {
      case 'ArrowRight':
        panBy(-step, 0);
        break;
      case 'ArrowLeft':
        panBy(step, 0);
        break;
      case 'ArrowUp':
        panBy(0, step);
        break;
      case 'ArrowDown':
        panBy(0, -step);
        break;
      case '+':
      case '=':
        zoomBy(ZOOM_STEP_IN);
        break;
      case '-':
      case '_':
        zoomBy(ZOOM_STEP_OUT);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  /** 打开同一张详情卡（画布点击 / 文字清单点击与回车共用）。 */
  function openNode(id: string): void {
    setSelected(id);
    // 从文字清单开卡：卡片在上方图容器内，多半在视口外 —— 滚过去并把焦点
    // 交给卡片，键盘/读屏用户的回车才有「按下去有反应」的反馈（复评 P2）。
    requestAnimationFrame(() => {
      detailCardRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
      detailCardRef.current?.focus({ preventScroll: true });
    });
  }

  /** 「本周点亮」尾注：数字随点火爬升，最后一个节点落位时徽标跳一下（只此一次）。 */
  const nodeCount = layout.nodes.length;
  const weekGain = summary?.newly_mastered_7d ?? 0;
  useEffect(() => {
    if (weekGain <= 0) return;
    if (reducedMotion) {
      setIgnited(true);
      return;
    }
    const timer = window.setTimeout(() => setIgnited(true), ignitionLandingMs(nodeCount));
    return () => window.clearTimeout(timer);
  }, [weekGain, nodeCount, reducedMotion]);

  const counts = BAND_ORDER.reduce<Partial<Record<MasteryBand, number>>>((accumulator, band) => {
    accumulator[band] = summary?.band_counts[band] ?? 0;
    return accumulator;
  }, {});

  const selectedNode = selected ? snapshotNode(selected) : null;
  const selectedProfile = selected ? byKp.get(selected) : undefined;
  const selectedMastery = selectedProfile?.mastery ?? 0;
  const selectedState: TreeNodeState | null = selected
    ? treeNodeState(selectedNode ?? { ...GRAPH_NODES[0], id: selected }, byKp)
    : null;
  // 薄弱态判定（包 C）：mastery < 0.4 在 engine 里就是「待巩固」带（本图谱状态带没有
  // 「未掌握」档，最弱即待巩固）；补完值得验证效果才推复测——没碰过的点（无 profile、
  // 无基线可比）不给这个按钮，仍走「去攻克/分步练一道」。
  const selectedIsWeak = selectedProfile != null && selectedMastery < 0.4;

  async function sharePoster(): Promise<void> {
    if (!summary || posting) return;
    setPosting(true);
    try {
      const blob = await buildGrowthPoster(summary, badges);
      if (!blob || !downloadPoster(blob)) {
        toast('这个浏览器导不了图片，截个屏分享也一样', 'warn');
      } else {
        toast('海报已生成，看看下载列表');
      }
    } finally {
      setPosting(false);
    }
  }

  /** 导出海报 CTA（工具条图标钮与底部按钮共用同一入口，链路冻结）。 */
  const canPoster = Boolean(summary) && (summary?.evidence_total ?? 0) > 0;
  const posterLabel = posting ? '正在画…' : '导出成长海报';

  /**
   * 失败态的真重试（规范 5.8 / D10）：复用**同一个** getGraphMastery 取数函数
   * （不新开请求路径），在途时 Stamp 的重试键禁用；失败仍走既有 toast 话术。
   */
  async function reload(): Promise<void> {
    if (!activeSpaceId) return;
    setRetrying(true);
    try {
      const data = await getGraphMastery(activeSpaceId);
      setReport(data);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setRetrying(false);
    }
  }

  /** 高亮路径的段数（底部 row 的「路径已高亮 · N 段」）。 */
  const highlightEdgeCount = highlightPath.length
    ? layout.edges.filter((edge) => isPathEdge(edge.from, edge.to, highlightPath)).length
    : 0;

  if (!activeSpaceId) {
    return (
      <>
        <SheetHead
          eyebrow="KNOWLEDGE GRAPH / 先修链全景"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="知识图谱"
          sub="先选一个学习空间：这张图谱记录的是该空间里的证据，没有空间就没有可画的数。"
          chips={<Badge tone="accent">T0</Badge>}
          dim={sheetDimText(tier)}
        />
        <SheetBlock no="01" title="空状态：没有空间">
          <EmptyState
            tag="NO SPACE"
            title="还没有选中的学习空间"
            hint={UI_TEXT.needSelfReport}
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                去选空间
              </Link>
            }
          />
        </SheetBlock>
      </>
    );
  }

  const hasAnyEvidence = (summary?.evidence_total ?? 0) > 0;

  /**
   * 失败态（D15c 最小新增，与 P6 /report 同口径）。取数 effect 是冻结红线，故失败
   * **派生**：取数已落定（落定的正是当前空间）+ 报告仍为空 ⇔ 请求失败（成功必落 report）。
   */
  const failed = !loading && report === null && loadedSpaceId !== null && loadedSpaceId === activeSpaceId;

  /** 有证据态页头（原型 L2865-2866）。 */
  const pageHead = (
    <SheetHead
      eyebrow="KNOWLEDGE GRAPH / 先修链全景"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="知识图谱 · 也是学习路径页"
      sub="颜色是掌握度（下方图例），形状同样是档位；从左往右是「先学什么再学什么」。两个点都亮了，中间这条路就算打通。点一个点看细节。"
      chips={<Badge tone="accent">T0 · 三重编码</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  if (loading) {
    return (
      <>
        {pageHead}
        <SkeletonLines rows={4} block />
      </>
    );
  }

  if (failed) {
    return (
      <>
        {pageHead}
        <Stamp
          reason="这一次没能取到本空间的掌握度（网络中断，或服务暂时没有响应）。你已有的学习证据没有丢，重试一次通常就能取到；一直取不到时可以先去学习空间确认它还在。"
          onRetry={() => {
            void reload();
          }}
          retrying={retrying}
          alt={{ label: '回到学习空间', to: SPACES_PATH }}
        />
      </>
    );
  }

  // ⑦ 空态分支（原型 L2852-2859）：空图谱照常可读，不放示例节点。
  if (!hasAnyEvidence) {
    return (
      <>
        <SheetHead
          eyebrow="KNOWLEDGE GRAPH / 先修链全景"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="知识图谱：现在是空的"
          sub="按需求 2.11：没有任何证据时，空状态引导三种冷启动方式。"
          chips={<Badge tone="accent">T0</Badge>}
          dim={sheetDimText(tier)}
        />
        <SheetBlock no="01" title="空状态">
          <EmptyState
            tag="NO EVIDENCE"
            title="还没有一条证据，图上还没有数"
            hint="图谱的每个节点都要有真实来源的数：自报、测评、试卷确认、对话或练习。现在一个都没有，所以这里不放示例节点充数。"
            action={
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/paper" className={cn(buttonVariants({ variant: 'primary' }))}>
                  拍试卷建图（推荐）
                </Link>
                <Link to="/self-report" className={cn(buttonVariants({ variant: 'secondary' }))}>
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
                  直接做几道题
                </Link>
              </div>
            }
          />
        </SheetBlock>
        <SheetBlock no="02" title="口径图例">
          <BandLegend counts={counts} />
        </SheetBlock>
      </>
    );
  }

  return (
    <>
      {pageHead}

      {bootstrapped && summary ? (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-surface border border-band-basic bg-surface p-4 shadow-card">
          <div>
            <p className="text-sm text-ink">
              初始图谱已生成：覆盖{' '}
              <span className="font-mono tabular-nums">{summary.covered_kp}</span> 个知识点，
              <span className="font-mono tabular-nums">{summary.band_counts['待巩固'] ?? 0}</span>{' '}
              个待巩固。
            </p>
            <p className="mt-1 text-ui-sm text-ink-soft">
              带「？」的点是从旧卷估出来的，做两道复测就会更准。
            </p>
          </div>
          <IconButton size="md" variant="quiet" onClick={dismissBootstrap} aria-label="关闭横幅">
            ×
          </IconButton>
        </div>
      ) : null}

      {/* ② 01 证据统计（原型 L2867-2870）：四格 measure，数据全部来自 summary / badges */}
      <SheetBlock
        no="01"
        title="证据统计"
        right={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge>{GRAPH_NODES.length} 个知识点</Badge>
            {badges
              .filter((badge) => badge.complete)
              .map((badge) => (
                <Badge key={badge.name} tone="positive">
                  {badge.name} ✓ 通关
                </Badge>
              ))}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 sheet:grid-cols-4">
          <MeasureBox label="总证据" value={summary?.evidence_total ?? 0} suffix="条" />
          {/* 本周新点亮：数字随点火爬升（WeekCount），落位时徽标跳一下（badge-pop，冻结） */}
          <div className={cn('bp-measure', ignited && weekGain > 0 && 'badge-pop')}>
            <span className="tok">本周新点亮</span>
            <span className="big-num">
              <WeekCount to={weekGain} duration={ignitionLandingMs(nodeCount)} />
              <span className="ml-1 text-body-sm font-normal">个知识点</span>
            </span>
          </div>
          <MeasureBox
            label="覆盖进度"
            value={`${summary?.covered_kp ?? 0}/${summary?.total_kp ?? 0}`}
            suffix="个知识点"
          />
          <MeasureBox label="章节通关" value={badges.filter((badge) => badge.complete).length} suffix="章" />
        </div>
      </SheetBlock>

      {/* ③④ 02 画布（原型 L2871-2889） */}
      <SheetBlock
        no="02"
        title="画布"
        right={
          highlightPath.length > 0 ? (
            <Badge tone="accent">
              <Icon name="branch" className="mr-1 h-3.5 w-3.5 align-[-2px]" />
              {plan && plan.path.join(',') === highlightPath.join(',')
                ? `学习路径：${plan.strategy}`
                : '正在高亮一条路径（上游 → 根因）'}
            </Badge>
          ) : null
        }
      >
        <div className="bp-gcanvas">
          <div className="bp-gtools">
            <IconButton aria-label="放大画布" onClick={() => zoomBy(ZOOM_STEP_IN)}>
              <Icon name="zoomin" className="h-4 w-4" />
            </IconButton>
            <IconButton aria-label="缩小画布" onClick={() => zoomBy(ZOOM_STEP_OUT)}>
              <Icon name="zoomout" className="h-4 w-4" />
            </IconButton>
            <IconButton aria-label="复位画布" onClick={resetView}>
              <Icon name="target" className="h-4 w-4" />
            </IconButton>
            <IconButton
              aria-label="导出成长海报图片"
              disabled={!canPoster || posting}
              onClick={() => void sharePoster()}
            >
              <Icon name="download" className="h-4 w-4" />
            </IconButton>
          </div>
          {/* 画布视口：键盘可达（方向键平移 / 加减号缩放，D20④）；canvas 内节点无 DOM 焦点，
              节点级键盘选中走下方文字清单。 */}
          <div
            ref={containerRef}
            role="group"
            tabIndex={0}
            onKeyDown={onCanvasKeyDown}
            aria-label={`知识图谱画布：${GRAPH_NODES.length} 个知识点的先修关系，可用方向键平移、加减号缩放；下方的文字清单可逐个打开节点详情。`}
            className="bp-gcanvas__viewport"
          />
          {tier === 'sm' || tier === 'md' ? (
            <p className="bp-gcanvas__note">窄屏降级：画布保留，完整可读的表格在下一节。</p>
          ) : null}
          <BandLegend counts={counts} showPath={highlightPath.length > 0} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <span className="tok">缩放 {zoomLevel.toFixed(2)}×</span>
          <Badge tone="outline">拖拽或用方向键平移</Badge>
          <Badge tone={highlightPath.length > 0 ? 'accent' : 'outline'}>
            {highlightPath.length > 0 ? `路径已高亮 · ${highlightEdgeCount} 段` : '未带入路径'}
          </Badge>
          <Button variant="secondary" size="sm" disabled={!canPoster || posting} onClick={() => void sharePoster()}>
            <Icon name="image" className="h-4 w-4" />
            {posterLabel}
          </Button>
        </div>
      </SheetBlock>

      {/* ⑤ 03 节点详情 + 04 为什么是这张图（原型 L2890-2906）：annos 档以上双栏 */}
      <section className="mb-8 grid gap-5 annos:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <SheetBlock
          no="03"
          title="节点详情"
          right={selected ? <Badge>{shortKpId(selected)}</Badge> : null}
        >
          {selectedNode && selectedState ? (
            <div ref={detailCardRef} tabIndex={-1} className="bp-panel p-4">
              <h3 className="flex items-center gap-1.5 font-disp text-title-sm tracking-tight text-ink">
                {selectedNode.name}
                {masteryBandOf(selectedMastery) === '已掌握' ? (
                  <SuccessMark size={20} tone="positive" label="已掌握" />
                ) : null}
              </h3>
              <dl className="mt-2">
                <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                  <dt className="tok">章节</dt>
                  <dd className="text-body-sm text-ink">{selectedNode.chapter}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                  <dt className="tok">难度</dt>
                  <dd className="num-mono text-body-sm text-ink">{selectedNode.difficulty}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                  <dt className="tok">掌握度 / 档位</dt>
                  <dd className="flex items-center gap-2 text-body-sm text-ink">
                    {selectedProfile ? (
                      <span className="num-mono">{selectedProfile.mastery.toFixed(2)}</span>
                    ) : (
                      <span className="tok">尚无可用的数</span>
                    )}
                    <BandMark band={STATE_BAND[selectedState]} showValue={false} size="sm" />
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                  <dt className="tok">证据条数</dt>
                  <dd className="num-mono text-body-sm text-ink">{selectedProfile?.evidence_count ?? 0}</dd>
                </div>
                {selectedProfile?.last_evidence_type ? (
                  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                    <dt className="tok">最近来源</dt>
                    <dd className="text-body-sm text-ink">
                      {EVIDENCE_LABEL[selectedProfile.last_evidence_type] ?? selectedProfile.last_evidence_type}
                    </dd>
                  </div>
                ) : null}
                {selectedProfile?.confidence === 'low' ? (
                  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5">
                    <dt className="tok">置信来源</dt>
                    <dd className="text-body-sm text-ink-soft">
                      <Badge tone="warning">低置信</Badge> 来自试卷估计，做复测会更准
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="tok">先修链</dt>
                  <dd className="num-mono text-caption text-ink">
                    {selectedNode.prerequisites.length === 0
                      ? '无先修'
                      : selectedNode.prerequisites.map((id) => shortKpId(id)).join(' ← ')}
                  </dd>
                </div>
              </dl>
              {/* 掌握度条（BandMark 的 bar 制式；null 值不画数，与详情一致） */}
              <div className="mt-3">
                <BandMark
                  band={STATE_BAND[selectedState]}
                  mastery={selectedProfile ? selectedMastery : null}
                  showValue={false}
                  bar
                />
              </div>
              {/* CTA：navigate 语义冻结（去攻克 / 分步练一道 / 薄弱复测） */}
              <div className={cn('mt-3.5 flex gap-2', selectedIsWeak && 'flex-wrap')}>
                <Link
                  to={`/assessment?kp=${selectedNode.id}`}
                  className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
                >
                  去攻克
                </Link>
                <Link
                  to={`/practice?kp=${selectedNode.id}`}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
                >
                  分步练一道
                </Link>
                {selectedIsWeak ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/assessment?mode=retest')}
                  >
                    补完做 2 道复测，验证效果
                  </Button>
                ) : null}
              </div>
              <p className="mt-2.5 text-body-sm text-ink-soft">
                详情面板随选中节点更新；用 TAB 在画布上按方向键平移、在下方文字清单上按 ENTER 也可选中。
              </p>
            </div>
          ) : (
            <EmptyState
              compact
              tag="NO SELECTION"
              title="还没有选中节点"
              hint="点画布上的一个点，或用下方文字清单打开一张详情卡。"
            />
          )}
        </SheetBlock>

        <aside className="bp-panel h-fit p-4">
          <SheetBlock no="04" title="为什么是这张图" className="mb-0">
            <p className="text-body-sm leading-relaxed text-ink-soft">
              节点按先修深度分层排布：越靠左的先修层级越浅。回溯路径用的就是这同一批边。
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-body-sm text-ink-soft">
              {[
                '掌握度 = 0 到 1 的数，四档阈值固定',
                '未接触 = 尚无任何证据；未解锁 = 先修链尚未打开',
                '低置信 = 来自试卷估计',
                `边 = 先修关系，共 ${layout.edges.length} 条`,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Icon name="tick" className="mt-0.5 h-3.5 w-3.5 flex-none text-accent-ink" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </SheetBlock>
        </aside>
      </section>

      {/* ⑥ 05 非图形文字版清单（原型 L2841-2851 + L2907）：细网格表全档常在（替换旧 details） */}
      <SheetBlock no="05" title="非图形文字版清单">
        <div className="bp-tbl-wrap">
          <table className="bp-tbl">
            <caption>非图形文字版清单 · 键盘可达（TAB 进入，ENTER 选节点）</caption>
            <thead>
              <tr>
                <th scope="col">知识点</th>
                <th scope="col">章节</th>
                <th scope="col" className="n">
                  掌握度
                </th>
                <th scope="col">档位</th>
                <th scope="col" className="n">
                  证据
                </th>
                <th scope="col">先修链</th>
              </tr>
            </thead>
            <tbody>
              {layout.nodes.map((placed) => {
                const snapshot = snapshotNode(placed.id);
                const profile = byKp.get(placed.id);
                const state = treeNodeState(snapshot ?? { ...GRAPH_NODES[0], id: placed.id }, byKp);
                const mastery = profile?.mastery ?? 0;
                const isCurrent = selected === placed.id;
                return (
                  <tr
                    key={placed.id}
                    data-current={isCurrent ? 'true' : undefined}
                    onClick={() => openNode(placed.id)}
                  >
                    <td data-label="知识点">
                      <button
                        type="button"
                        aria-current={isCurrent ? 'true' : undefined}
                        onClick={(event) => {
                          event.stopPropagation();
                          openNode(placed.id);
                        }}
                        className="text-left text-ui-sm text-ink hover:underline"
                      >
                        <span className="num-mono text-mono-xs text-ink-soft">{shortKpId(placed.id)}</span>{' '}
                        {kpNameOf(placed.id, profile?.name)}
                      </button>
                      {profile?.confidence === 'low' ? (
                        <Badge tone="warning" size="sm" className="ml-1.5">
                          低置信
                        </Badge>
                      ) : null}
                    </td>
                    <td data-label="章节">{snapshot?.chapter ?? '—'}</td>
                    <td data-label="掌握度" className="n">
                      {profile ? percent(mastery) : <span className="tok">尚无可用的数</span>}
                    </td>
                    <td data-label="档位" className="whitespace-nowrap">
                      <BandMark band={STATE_BAND[state]} showValue={false} size="sm" />
                    </td>
                    <td data-label="证据" className="n">
                      {profile?.evidence_count ?? 0}
                    </td>
                    <td data-label="先修链" className="num-mono text-caption">
                      {snapshot && snapshot.prerequisites.length > 0
                        ? snapshot.prerequisites.map((id) => shortKpId(id)).join(' ← ')
                        : '无先修'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SheetBlock>
    </>
  );
}
