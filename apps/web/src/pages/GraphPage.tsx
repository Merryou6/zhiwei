/**
 * 页 8 · 知识图谱（兼「学习路径页」；P0 #10）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx（全部 20 节点掌握度）+ graphSnapshot 静态副本（结构，D7）
 *       查询参数 ?path=kp1,kp2（来自页 7 归因跳转或 #17 plan.path）→ 路径节点描边加粗 + 边走主色，其余降透明度
 * 技术：echarts graph series + layout:'none' + 自算分层坐标（lib/graphLayout.ts，D10：不用力导向，
 *       避免演示时位置抖动；横向=上游→下游）；图例常驻右上（BandLegend，四色 + 归因/学习路径）。
 * 空态：未自报也未测评（掌握度全 0 且无 accuracy）→ 引导文案，不伪造数据（D12）。
 *
 * ── 重构 P3-3（2026-09-25）本页被认定为「全站最弱一页」，改动集中在四处可见缺陷 ──
 * ① 节点标签：原为 kpLabel(id, 7) 截断 + fontSize 10，图上是一排「函数的概念与自…」，
 *    信息量等于零 —— 而「这个点是什么」正是图谱页最该回答的问题。改为
 *    width + overflow:'break' 先换行再截断（对齐 compact-label-overflow 的口径：
 *    溢出要换行，不要藏值），字号提到 11，名称上限放到 14 字；完整名称仍在 tooltip。
 * ② 节点直径 22 → 26（高亮 30 → 34）：原尺寸下 20 个点看起来像一层灰。
 * ③ 详情卡改用 shadow-overlay + 不透明底：原来用内置 shadow-sm（固定黑色 rgba，
 *    深色主题下投在深底上完全看不见）配 bg-surface/95（图线从卡面透上来干扰文字）。
 * ④ 路径徽标改用 inline-flex：原来是在 **inline span** 上写 min-h-9，而行内元素
 *    忽略 min-height —— 这个最小高度从未生效过。顺带把关闭键从「仅 <720 撑到 36px」
 *    改为全断点 IconButton size="md"（44×44）：触控目标下限不分断点。
 * 版式接入 PageContainer（wide / 无空间时 prose）+ PageHeader；两处按钮 Link 复用
 * buttonVariants，不再抄第二套按钮 class；页脚计数改等宽表格数字。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
// 按需引入（前端优化批一）：本页只用到 graph 系列 + tooltip + canvas 渲染器，
// 全量 `import * as echarts` 会把整个库（含未用图表类型）打进 echarts chunk（约 1MB）。
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

import { ApiError } from '../api/client';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import BandLegend from '../components/BandLegend';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { IconButton, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { GRAPH_NODES, kpName, snapshotNode } from '../data/graphSnapshot';
import { computeGraphLayout, isPathEdge, parsePathParam } from '../lib/graphLayout';
import { cn } from '../lib/cn';
import { kpLabel, percent } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { BAND_HEX, BAND_ORDER, PRIMARY_HEX, masteryBandOf, masteryHexOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { useAttributionStore } from '../stores/attribution';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 非路径元素的不透明度（高亮时其余节点降透明）。 */
const DIM_OPACITY = 0.28;
/** 主题取不到时的兜底（浅色值）。正常情况下不会用到。 */
const EDGE_COLOR_FALLBACK = '#C9D3D8';
const TEXT_COLOR_FALLBACK = '#22303A';

/**
 * 读取主题变量的当前解析值。
 *
 * echarts 把图画在 canvas 上，拿不到 tailwind 的 class，所以它的配色必须由 JS 提供。
 * 上一版把节点标签写成 #22303A、边线写成 #C9D3D8 —— 这是「按浅色底选的色」，
 * 深色主题下标签会直接消失在深底里。改为回头读 CSS 变量，
 * 图表与 DOM 就共用同一份主题真相，将来加主题切换也不必再改这里。
 *
 * 变量值是「R G B」三元组，需要补上 rgb() 外壳。
 */
function themeColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw})` : fallback;
}

export default function GraphPage() {
  const [params] = useSearchParams();
  const highlightPath = parsePathParam(params.get('path'));

  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const plan = useAttributionStore((state) => state.plan);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => computeGraphLayout(), []);
  const masteryById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report?.mastery ?? []) map.set(row.kp_id, row.mastery);
    return map;
  }, [report]);

  const hasData = Boolean(
    report && (report.accuracy.length > 0 || report.mastery.some((row) => row.mastery > 0)),
  );

  useEffect(() => {
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await reportSummary(activeSpaceId);
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
    // 图表配色随主题解析（见 themeColor 注释）。取值的时机放在这里而非模块顶层：
    // 模块加载时样式表未必已生效，此时读变量会拿到空串。
    const textColor = themeColor('--c-ink', TEXT_COLOR_FALLBACK);
    const edgeColor = themeColor('--c-line', EDGE_COLOR_FALLBACK);
    // 高亮路径走 accent：深色下是提亮过的 #6FB3D4，与页面强调色同源。
    const accentColor = themeColor('--c-accent', PRIMARY_HEX);
    const onPath = (id: string): boolean => highlightPath.includes(id);

    chart.setOption(
      {
        tooltip: {
          formatter: (raw: unknown) => {
            const data = (raw as { data?: { id?: string } }).data;
            if (!data?.id) return '';
            const mastery = masteryById.get(data.id) ?? 0;
            const node = snapshotNode(data.id);
            return `${kpName(data.id)}<br/>章节：${node?.chapter ?? '—'}<br/>掌握度：${percent(mastery)}（${masteryBandOf(mastery)}）`;
          },
        },
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
              // 标签走「先换行、再截断」而不是直接截断：
              // 原实现是 kpLabel(id, 7) + fontSize 10，于是图上是一排「函数的概念与自…」，
              // 信息量等于零 —— 而这恰恰是图谱页最该回答的问题「这个点是什么」。
              // width + overflow:'break' 让长名称折成两行；完整名称仍在 tooltip 里。
              width: 76,
              overflow: 'break',
              color: textColor,
            },
            emphasis: { focus: 'adjacency', label: { fontSize: 12 } },
            data: layout.nodes.map((placed) => {
              const mastery = masteryById.get(placed.id) ?? 0;
              const band = masteryBandOf(mastery);
              const onHighlight = onPath(placed.id);
              const dim = highlightPath.length > 0 && !onHighlight;
              return {
                id: placed.id,
                name: kpLabel(placed.id, 14),
                x: placed.x,
                y: placed.y,
                symbolSize: onHighlight ? 34 : 26,
                itemStyle: {
                  color: masteryHexOf(mastery),
                  borderColor: onHighlight ? accentColor : BAND_HEX[band],
                  borderWidth: onHighlight ? 3 : 1,
                  opacity: dim ? DIM_OPACITY : 1,
                },
                label: { opacity: dim ? DIM_OPACITY : 1 },
              };
            }),
            edges: layout.edges.map((edge) => {
              const onHighlight = isPathEdge(edge.from, edge.to, highlightPath);
              const dim = highlightPath.length > 0 && !onHighlight;
              return {
                source: edge.from,
                target: edge.to,
                lineStyle: {
                  color: onHighlight ? accentColor : edgeColor,
                  width: onHighlight ? 2.5 : 1,
                  opacity: dim ? DIM_OPACITY * 0.8 : 1,
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

    // 容器尺寸变化的重绘（R2）：window 的 resize 只在视口变化时触发，而正文列的宽度还会
    // 因「右侧对话面板开合时的让位 padding」（≥1280 挤压态）而变化——那时 window 不 resize，
    // 图表会留着旧尺寸的白边或裁切。ResizeObserver 观察的是容器本身，是标准信号；
    // window 监听保留作兜底（极旧浏览器无 ResizeObserver 时行为不劣于改造前）。
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, highlightPath.join(','), layout]);

  const counts = BAND_ORDER.reduce<Partial<Record<MasteryBand, number>>>((accumulator, band) => {
    accumulator[band] = (report?.mastery ?? []).filter((row) => masteryBandOf(row.mastery) === band).length;
    return accumulator;
  }, {});

  const selectedNode = selected ? snapshotNode(selected) : null;
  const selectedMastery = selected ? (masteryById.get(selected) ?? 0) : 0;

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

  return (
    <PageContainer width="wide">
      <PageHeader
        title="你的知识地图"
        description="颜色是掌握度（左下角是图例），从左往右是「先学什么再学什么」。点一个点看细节。"
        actions={
          highlightPath.length > 0 ? (
            // inline-flex + items-center：原实现是 inline span 上写 min-h-9，
            // 而**行内元素忽略 min-height** —— 这个最小高度从未生效过（又一次静默失效）。
            <span className="inline-flex min-h-9 items-center rounded-control bg-accent-veil px-3 text-ui-sm text-accent-ink">
              {plan && plan.path.join(',') === highlightPath.join(',')
                ? `学习路径：${plan.strategy}`
                : '正在高亮一条路径（上游 → 根因）'}
            </span>
          ) : undefined
        }
      />

      {loading ? (
        <PageSkeleton label="正在取你的掌握度…" rows={1} className="mt-6" />
      ) : !hasData ? (
        <div className="mt-6 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="这张图还没有你的颜色"
            hint={`${UI_TEXT.needSelfReport}做完自报或几道题，每个知识点就会按掌握度上色。`}
            action={
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/self-report" className={cn(buttonVariants({ variant: 'primary' }))}>
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
                  直接做几道题
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        /* 窄屏适配：图例在 <sm 收成卡片内静态一行（不压图），图本身给最小宽度并允许横向滚动，
           保证 20 个节点在手机上不被压扁到标签重叠。 */
        <div className="relative mt-4 rounded-surface border border-line bg-surface p-3 sm:p-0">
          <BandLegend
            counts={counts}
            showPath={highlightPath.length > 0}
            className="mb-3 sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:mb-0"
          />
          <div className="overflow-x-auto">
            <div
              ref={containerRef}
              style={{
                minWidth: Math.max(720, layout.width + 200),
                height: Math.max(420, layout.height + 200),
              }}
            />
          </div>

          {selectedNode ? (
            // 浮起层：用 shadow-overlay 而不是内置 shadow-sm。
            // 内置阴影是固定的黑色 rgba —— 深色主题下投在深底上完全看不见，卡片会失去
            // 与图面的层级关系（这是本项目记录在案的缺陷类型：P1a 当时就把它与静态卡
            // 混用的问题写进了 boxShadow 的注释）。
            // 底色同时从 bg-surface/95 改为不透明：半透明卡面会让下层图线与标签透上来
            // 干扰文字，而这里没有任何「透视关系」要表达。
            <div className="absolute bottom-3 left-3 w-[min(16rem,calc(100%-1.5rem))] rounded-surface border border-line bg-surface p-3 text-xs shadow-overlay">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-ink">{selectedNode.name}</p>
                {/* 关闭键走 IconButton size="md"（44×44）：原实现只在 <720 把「×」撑到
                    36×36，桌面是一个几像素的纯文字 —— 触控目标下限是不分断点的。 */}
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
              <p className="mt-1 text-ink-soft">
                先修：{selectedNode.prerequisites.length === 0 ? '无（起点）' : selectedNode.prerequisites.map((id) => kpName(id)).join('、')}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-4 text-ui-sm text-ink-soft">
        共 <span className="font-mono tabular-nums text-ink">{GRAPH_NODES.length}</span> 个知识点 /{' '}
        <span className="font-mono tabular-nums text-ink">{layout.columns}</span> 层先修链 ·
        四色阈值与状态带取自引擎同一份常量
      </p>
    </PageContainer>
  );
}
