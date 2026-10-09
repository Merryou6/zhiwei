/**
 * 页 8 · 知识图谱（兼「学习路径页」）→ v2.1 技能树 2.0
 *
 * 数据：#32 GET /api/graph/mastery（v2.1 起本页唯一数据源 —— 一次带回结构化掌握度 +
 *       游戏化摘要：evidence_total / newly_mastered_7d / weakest / confidence）。
 *       band 由服务端 engine.masteryToBand 同源计算，前端只消费不重算（纪律不变）。
 *
 * v2.1 新增（对应战略三张牌之一「让越用越懂你被看见」）：
 *   ① 六态视觉机：四带实色（BAND_HEX）+ 未点亮空心 + 先修锁定（灰 + ？）；
 *   ② 先修边「打通」着色：两端均已掌握 → 亮边（进度感来源）；
 *   ③ 首屏常驻证据计数器：「这张图谱记录了你 N 条学习证据」+「本周点亮 +N」；
 *   ④ 章节徽章：全章 ≥ 基本掌握 → ✓；
 *   ⑤ 低置信角标：confidence=low（仅旧试卷/自报触达）→ 节点带 ？，提示做复测校准；
 *   ⑥ 成长海报：客户端 canvas 生成 PNG 分享（lib/poster.ts，零后端）；
 *   ⑦ 冷启动横幅：?bootstrapped=1（拍卷建图完成跳转）→「初始图谱已生成」；
 *   ⑧ 节点错落点亮动画（echarts 逐点 delay；reduced-motion 降级为瞬时）——
 *      「本周点亮 +N」数字随点火爬升、最后一个节点落位时到达并跳一下（badge-pop 尾注）。
 *   ⑨ 无障碍补全（2026-10-09）：canvas 挂 role=img + 并行语义清单（details 逐点按钮，
 *      键盘/读屏可达，回车打开同一张详情卡）；主题切换重绘画布（theme 进 effect deps，
 *      配色重取 CSS 变量），重绘不重播点火。
 *
 * 版式纪律继承：echarts 配色读 CSS 变量（themeColor）；图例常驻（BandLegend）；
 * 详情卡不透明底 + shadow-overlay；标签先换行再截断。
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import PageSkeleton from '../components/PageSkeleton';
import { Badge, Button, IconButton, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { GRAPH_NODES, snapshotNode } from '../data/graphSnapshot';
import { computeGraphLayout, isPathEdge, parsePathParam } from '../lib/graphLayout';
import {
  chapterBadges,
  edgeLit,
  masteryByKpOf,
  treeNodeState,
} from '../lib/graphMastery';
import type { ChapterBadge } from '../lib/graphMastery';
import { buildGrowthPoster, downloadPoster } from '../lib/poster';
import { cn } from '../lib/cn';
import { kpLabel, percent } from '../lib/format';
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

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const plan = useAttributionStore((state) => state.plan);
  /** 主题切换 → 画布配色重取 CSS 变量（进图表 effect 的 deps）。 */
  const theme = useThemeStore((state) => state.theme);

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** 详情卡锚点：从文字清单开卡时滚过去并把焦点交给卡片（卡片在上方图容器内，视口外）。 */
  const detailCardRef = useRef<HTMLDivElement | null>(null);
  /** 点火只随数据变化重放：byKp 是 report 的 useMemo 派生，主题/路径重绘时身份不变。 */
  const lastIgnitionSourceRef = useRef<unknown>(null);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !report) return;

    const chart = echarts.init(container);
    // canvas 内动画不受 CSS reduce 块管辖，JS 侧自行降级（偏好是响应式 state，切设置即生效）。
    const reduced = reducedMotion;
    // 点火重放判定：byKp 变了（新数据/新空间）才重播；主题切换或路径高亮的重绘不重播。
    const replayIgnition = lastIgnitionSourceRef.current !== byKp;
    lastIgnitionSourceRef.current = byKp;
    const textColor = themeColor('--c-ink', TEXT_COLOR_FALLBACK);
    const edgeColor = themeColor('--c-line', EDGE_COLOR_FALLBACK);
    const accentColor = themeColor('--c-accent', PRIMARY_HEX);
    const lockedColor = themeColor('--c-line', LOCKED_COLOR_FALLBACK);
    const onPath = (id: string): boolean => highlightPath.includes(id);

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
            type: 'graph',
            layout: 'none',
            roam: true,
            draggable: false,
            symbol: 'circle',
            edgeSymbol: ['none', 'arrow'],
            edgeSymbolSize: 5,
            label: {
              show: true,
              position: 'bottom',
              distance: 6,
              fontSize: 11,
              lineHeight: 13,
              width: 76,
              overflow: 'break',
              color: textColor,
            },
            emphasis: { focus: 'adjacency', label: { fontSize: 12 } },
            data: layout.nodes.map((placed) => {
              const snapshot = snapshotNode(placed.id);
              const state = treeNodeState(snapshot ?? { ...GRAPH_NODES[0], id: placed.id }, byKp);
              const profile = byKp.get(placed.id);
              const mastery = profile?.mastery ?? 0;
              const onHighlight = onPath(placed.id);
              const dim = highlightPath.length > 0 && !onHighlight;

              // 六态 → 视觉
              const filled = state !== 'untouched' && state !== 'locked';
              const color = filled
                ? masteryHexOf(mastery)
                : state === 'locked'
                  ? 'transparent'
                  : 'transparent';
              const border =
                state === 'locked'
                  ? lockedColor
                  : state === 'untouched'
                    ? edgeColor
                    : onHighlight
                      ? accentColor
                      : BAND_HEX[masteryBandOf(mastery) as MasteryBand];
              const borderType: 'solid' | 'dashed' =
                state === 'locked' || (profile?.confidence === 'low' && onHighlight) ? 'dashed' : 'solid';
              // 低置信：边框加虚线语义（tooltip 再补 ？说明），待攻克加粗描边
              const borderWidth = onHighlight ? 3 : state === 'weak' ? 2.5 : state === 'untouched' || state === 'locked' ? 1.5 : 1;

              return {
                id: placed.id,
                name: state === 'locked' ? `${kpLabel(placed.id, 14)}？` : kpLabel(placed.id, 14),
                x: placed.x,
                y: placed.y,
                symbolSize: onHighlight ? 34 : state === 'weak' ? 30 : 26,
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
              return {
                source: edge.from,
                target: edge.to,
                lineStyle: {
                  color: onHighlight ? accentColor : lit ? accentColor : edgeColor,
                  width: onHighlight ? 2.5 : lit ? 2 : 1,
                  opacity: dim ? DIM_OPACITY * 0.8 : lit ? 0.9 : 0.5,
                  curveness: 0.06,
                },
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
    };
    // theme 进 deps（2026-10-09）：配色在 effect 里读 CSS 变量，主题切换后必须重取重绘；
    // 其余依赖不变（eslint 认不出 theme 的用途）。
    // reducedMotion 进 deps（2026-10-09 复评）：偏好切换 → 重绘瞬时到位。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, highlightPath.join(','), layout, byKp, theme, reducedMotion]);

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

  if (!activeSpaceId) {
    return (
      <PageContainer width="prose">
        <PageHeader title="知识图谱" description={UI_TEXT.needSelfReport} />
        <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }), 'mt-4')}>
          去选空间
        </Link>
      </PageContainer>
    );
  }

  const hasAnyEvidence = (summary?.evidence_total ?? 0) > 0;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="你的技能树"
        description="颜色是掌握度（左下角图例），从左往右是「先学什么再学什么」。两个点都亮了，中间这条路就算打通。点一个点看细节。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {summary && hasAnyEvidence ? (
              <Button variant="secondary" size="sm" disabled={posting} onClick={() => void sharePoster()}>
                {posting ? '正在画…' : '生成成长海报'}
              </Button>
            ) : null}
            {highlightPath.length > 0 ? (
              <span className="inline-flex min-h-9 items-center rounded-control bg-accent-veil px-3 text-ui-sm text-accent-ink">
                {plan && plan.path.join(',') === highlightPath.join(',')
                  ? `学习路径：${plan.strategy}`
                  : '正在高亮一条路径（上游 → 根因）'}
              </span>
            ) : null}
          </div>
        }
      />

      {bootstrapped && summary ? (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-surface border border-band-basic bg-surface p-4 shadow-card">
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

      {/* 「越用越懂你」的量化：证据计数器 + 本周点亮（v2.1 技能树首屏常驻） */}
      {summary ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={hasAnyEvidence ? 'positive' : 'neutral'} size="md">
            这张图谱记录了你 {summary.evidence_total} 条学习证据
          </Badge>
          {summary.newly_mastered_7d > 0 ? (
            <Badge tone="positive" size="md" className={cn(ignited && 'badge-pop')}>
              本周点亮 +<WeekCount to={summary.newly_mastered_7d} duration={ignitionLandingMs(nodeCount)} />
            </Badge>
          ) : null}
          <Badge tone="neutral" size="md">
            已覆盖 {summary.covered_kp}/{summary.total_kp}
          </Badge>
          {badges
            .filter((badge) => badge.complete)
            .map((badge) => (
              <Badge key={badge.name} tone="positive" size="md">
                {badge.name} ✓ 通关
              </Badge>
            ))}
        </div>
      ) : null}

      {loading ? (
        <PageSkeleton label="正在取你的掌握度…" rows={1} className="mt-6" />
      ) : !hasAnyEvidence ? (
        <div className="mt-4 rounded-surface border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-ink">这张图还没有你的颜色。</p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            不用刷题也可以开始：拍一张最近的试卷，一分钟点亮它；或者花 30 秒自报，先给个大概。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
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
        </div>
      ) : null}

      <div className="relative mt-4 rounded-surface border border-line bg-surface p-3 sm:p-0">
        <BandLegend
          counts={counts}
          showPath={highlightPath.length > 0}
          className="mb-3 sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:mb-0"
        />
        <div className="overflow-x-auto">
          <div
            ref={containerRef}
            role="img"
            aria-label={`技能树图：${GRAPH_NODES.length} 个知识点的掌握度地图，颜色代表掌握程度，虚线空心代表先修未通。图形下方的文字清单可以逐个打开详情。`}
            style={{
              minWidth: Math.max(720, layout.width + 200),
              height: Math.max(420, layout.height + 200),
            }}
          />
        </div>

        {selectedNode ? (
          <div
            ref={detailCardRef}
            tabIndex={-1}
            className="absolute bottom-3 left-3 w-[min(16rem,calc(100%-1.5rem))] rounded-surface border border-line bg-surface p-3 text-xs shadow-overlay"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink">{selectedNode.name}</p>
              <IconButton size="md" variant="quiet" onClick={() => setSelected(null)} aria-label="关闭">
                ×
              </IconButton>
            </div>
            <p className="mt-1 text-ink-soft">
              {selectedNode.chapter} · 难度 {selectedNode.difficulty}
            </p>
            <p className="mt-1 text-ink-soft">
              掌握度 {percent(selectedMastery)}（
              <span style={{ color: masteryHexOf(selectedMastery) }}>{masteryBandOf(selectedMastery)}</span>）
            </p>
            {selectedProfile ? (
              <>
                <p className="mt-1 text-ink-soft">
                  证据{' '}
                  <span className="font-mono tabular-nums text-ink">{selectedProfile.evidence_count}</span>{' '}
                  条
                  {selectedProfile.last_evidence_type
                    ? ` · 最近：${EVIDENCE_LABEL[selectedProfile.last_evidence_type] ?? selectedProfile.last_evidence_type}`
                    : ''}
                </p>
                {selectedProfile.confidence === 'low' ? (
                  <p className="mt-1 text-band-weak">？从旧卷估的 —— 做 2 道复测会更准</p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-ink-soft">还没碰过这个点——先修打通后就从它开始。</p>
            )}
            <p className="mt-1 text-ink-soft">
              先修：
              {selectedNode.prerequisites.length === 0
                ? '无（起点）'
                : selectedNode.prerequisites.map((id) => byKp.get(id)?.name ?? id).join('、')}
            </p>
            <div className="mt-2 flex gap-2">
              {/* v2.1 评审 P2：CTA 带 kp 参数，到测评/练习页不断上下文（两页均消费 ?kp=） */}
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
            </div>
          </div>
        ) : null}
      </div>

      {/* 无障碍（2026-10-09）：canvas 对键盘/读屏不可达 —— 并行一份语义清单，
          每个知识点一行真实按钮（可 Tab 聚焦、回车打开同一张详情卡）；
          不用读屏的用户也能拿它当「文字版」，不想看图时同样有用。 */}
      <details className="group mt-3 rounded-surface border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-ui-sm text-ink-soft transition-colors hover:bg-raised [&::-webkit-details-marker]:hidden">
          打不开图或不想看图？用文字看这棵树（{GRAPH_NODES.length} 个知识点，回车打开详情）
          <span aria-hidden="true" className="shrink-0 text-ink-soft transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="border-t border-line">
          {layout.nodes.map((placed) => {
            const snapshot = snapshotNode(placed.id);
            const profile = byKp.get(placed.id);
            const state = treeNodeState(snapshot ?? { ...GRAPH_NODES[0], id: placed.id }, byKp);
            const mastery = profile?.mastery ?? 0;
            return (
              <li key={placed.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(placed.id);
                    // 从文字清单开卡：卡片在上方图容器内，多半在视口外 —— 滚过去并把焦点
                    // 交给卡片，键盘/读屏用户的回车才有「按下去有反应」的反馈（复评 P2）。
                    requestAnimationFrame(() => {
                      detailCardRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
                      detailCardRef.current?.focus({ preventScroll: true });
                    });
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-ui-sm text-ink transition-colors hover:bg-raised"
                >
                  <span className="min-w-0 truncate">{kpNameOf(placed.id, profile?.name)}</span>
                  <span className="shrink-0 font-mono tabular-nums text-ink-soft">
                    {STATE_HINT[state] ?? state} · {percent(mastery)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </details>

      <p className="mt-4 text-ui-sm text-ink-soft">
        共 <span className="font-mono tabular-nums text-ink">{GRAPH_NODES.length}</span> 个知识点 /{' '}
        <span className="font-mono tabular-nums text-ink">{layout.columns}</span> 层先修链 ·
        虚线空心 = 先修未通 · 颜色阈值与状态带取自引擎同一份常量
      </p>
    </PageContainer>
  );
}

/** kp 显示名：优先 #32 的服务端名称，兜底结构快照（禁止白屏的既有纪律）。 */
function kpNameOf(id: string, serverName: string | undefined): string {
  return serverName ?? (snapshotNode(id)?.name ?? id);
}
