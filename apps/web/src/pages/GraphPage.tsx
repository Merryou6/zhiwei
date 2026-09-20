/**
 * 页 8 · 知识图谱（兼「学习路径页」；P0 #10）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx（全部 20 节点掌握度）+ graphSnapshot 静态副本（结构，D7）
 *       查询参数 ?path=kp1,kp2（来自页 7 归因跳转或 #17 plan.path）→ 路径节点描边加粗 + 边走主色，其余降透明度
 * 技术：echarts graph series + layout:'none' + 自算分层坐标（lib/graphLayout.ts，D10：不用力导向，
 *       避免演示时位置抖动；横向=上游→下游）；图例常驻右上（BandLegend，四色 + 归因/学习路径）。
 * 空态：未自报也未测评（掌握度全 0 且无 accuracy）→ 引导文案，不伪造数据（D12）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as echarts from 'echarts';

import { ApiError } from '../api/client';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import BandLegend from '../components/BandLegend';
import { GRAPH_NODES, kpName, snapshotNode } from '../data/graphSnapshot';
import { computeGraphLayout, isPathEdge, parsePathParam } from '../lib/graphLayout';
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
const EDGE_COLOR = '#C9D3D8';
const TEXT_COLOR = '#22303A';

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
              fontSize: 10,
              color: TEXT_COLOR,
            },
            emphasis: { focus: 'adjacency', label: { fontSize: 11 } },
            data: layout.nodes.map((placed) => {
              const mastery = masteryById.get(placed.id) ?? 0;
              const band = masteryBandOf(mastery);
              const onHighlight = onPath(placed.id);
              const dim = highlightPath.length > 0 && !onHighlight;
              return {
                id: placed.id,
                name: kpLabel(placed.id, 7),
                x: placed.x,
                y: placed.y,
                symbolSize: onHighlight ? 30 : 22,
                itemStyle: {
                  color: masteryHexOf(mastery),
                  borderColor: onHighlight ? PRIMARY_HEX : BAND_HEX[band],
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
                  color: onHighlight ? PRIMARY_HEX : EDGE_COLOR,
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

    return () => {
      window.removeEventListener('resize', onResize);
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
      <section className="max-w-2xl">
        <h1 className="text-xl font-medium text-ink">知识图谱</h1>
        <p className="mt-3 text-sm text-ink-soft">{UI_TEXT.needSelfReport}</p>
        <Link to={SPACES_PATH} className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-white">
          去选空间
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-ink">你的知识地图</h1>
          <p className="mt-2 text-sm text-ink-soft">
            颜色是掌握度（左下角是图例），从左往右是「先学什么再学什么」。点一个点看细节。
          </p>
        </div>
        {highlightPath.length > 0 ? (
          <span className="rounded-lg bg-primary-soft px-3 min-h-9 py-2 text-[13px] text-primary">
            {plan && plan.path.join(',') === highlightPath.join(',')
              ? `学习路径：${plan.strategy}`
              : '正在高亮一条路径（上游 → 根因）'}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">正在取你的掌握度…</p>
      ) : !hasData ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-card">
          <p className="text-sm text-ink">{UI_TEXT.needSelfReport}</p>
          <div className="mt-4 flex items-center gap-3">
            <Link to="/self-report" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">
              花 30 秒自报
            </Link>
            <Link to="/assessment" className="rounded-lg border border-line px-4 py-2 text-sm text-ink">
              直接做几道题
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative mt-4 rounded-2xl border border-line bg-white">
          <BandLegend
            counts={counts}
            showPath={highlightPath.length > 0}
            className="absolute right-3 top-3 z-10"
          />
          <div
            ref={containerRef}
            className="w-full"
            style={{ height: Math.max(460, layout.height + 220) }}
          />

          {selectedNode ? (
            <div className="absolute bottom-3 left-3 w-64 rounded-xl border border-line bg-white/95 p-3 text-xs shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-ink">{selectedNode.name}</p>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-ink-soft hover:text-ink"
                  aria-label="关闭"
                >
                  ×
                </button>
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

      <p className="mt-4 text-xs text-ink-soft">
        共 {GRAPH_NODES.length} 个知识点 / {layout.columns} 层先修链 · 四色阈值与状态带取自引擎同一份常量
      </p>
    </section>
  );
}
