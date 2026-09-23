/**
 * 页 8 · 知识图谱（兼「学习路径页」；P0 #10）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx（全部 24 节点掌握度）+ graphSnapshot 静态副本（结构，D7）
 *       查询参数 ?path=kp1,kp2（来自页 7 归因跳转或 #17 plan.path）→ 路径节点描边加粗 + 边走主色，其余降透明度
 * 技术（2026-09-23 移植控制台原型）：纯 SVG 渲染（不再用 echarts）——分层坐标仍来自 lib/graphLayout.ts，
 *       节点/边按控制台 .node / .edge 类名上色，悬停高亮邻域 + .tip 浮层。
 * 空态：未自报也未测评（掌握度全 0 且无 accuracy）→ 引导文案，不伪造数据（D12）。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { GRAPH_NODES, kpName, snapshotNode } from '../data/graphSnapshot';
import { computeGraphLayout, isPathEdge, parsePathParam } from '../lib/graphLayout';
import { kpLabel, percent } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { BAND_ORDER, masteryBandOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { useAttributionStore } from '../stores/attribution';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 节点半径（控制台 G.nodes[].r 对应值；布局不输出 r，前端固定）。 */
const NODE_R = 7;
/** SVG 视口内边距，给节点光晕与文字标签留位。 */
const PAD_X = 90;
const PAD_TOP = 46;
const PAD_BOTTOM = 60;

/** 中文状态带 → 控制台 band-xxx CSS 类（已移植进 index.css）。 */
const BAND_CSS: Record<MasteryBand, string> = {
  已掌握: 'band-solid',
  基本掌握: 'band-basic',
  不稳定: 'band-waver',
  待巩固: 'band-weak',
};

/** 状态带一句描述（控制台 G.bands[].desc 语义；视图层本地文案）。 */
const BAND_DESC: Record<MasteryBand, string> = {
  已掌握: '能独立稳定完成，可进入下一环节',
  基本掌握: '大体会做，偶有小错，保持练习即可',
  不稳定: '时对时错，思路还没固化，需要针对性练',
  待巩固: '这一环还晃，先把上游铺稳再回来',
};

/** 悬停浮层预估尺寸（用于边界 clamp；按 tip-grid + tip-err 实际内容高度预留）。 */
const TIP_W = 254;
const TIP_H = 300;

/**
 * 纵向拉伸系数（纯视图层）：computeGraphLayout() 的列距 240 / 行距 60 是为「横向可滚动」
 * 设计的；本页按控制台 width:100% 缩放后会压成细条、图例被裁。保持 x 不变，把 y 在视图层
 * 放大，让 viewBox 接近控制台 1180×700 的均衡比例（不改布局数据本身）。
 */
const V_SCALE = 3.0;

export default function GraphPage() {
  const [params] = useSearchParams();
  const highlightPath = parsePathParam(params.get('path'));

  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const plan = useAttributionStore((state) => state.plan);

  const frameRef = useRef<HTMLDivElement | null>(null);

  const layout = useMemo(() => computeGraphLayout(), []);
  const masteryById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report?.mastery ?? []) map.set(row.kp_id, row.mastery);
    return map;
  }, [report]);

  /** 布局节点 id → 坐标/章节（边连线与悬停定位查坐标用）。 */
  const nodeById = useMemo(() => {
    const map = new Map(layout.nodes.map((n) => [n.id, n]));
    return map;
  }, [layout]);

  /** 无向邻接表：悬停时高亮邻域。 */
  const adj = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of layout.nodes) map.set(n.id, new Set());
    for (const e of layout.edges) {
      map.get(e.from)?.add(e.to);
      map.get(e.to)?.add(e.from);
    }
    return map;
  }, [layout]);

  const vbW = layout.width + PAD_X * 2;
  const vbH = PAD_TOP + layout.height * V_SCALE + PAD_BOTTOM;

  const hasData = Boolean(
    report && (report.accuracy.length > 0 || report.mastery.some((row) => row.mastery > 0)),
  );

  // 数据加载（与原 echarts 版同一份请求逻辑，未改动）
  useEffect(() => {
    let cancelled = false;
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
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

  const onPath = (id: string): boolean => highlightPath.includes(id);
  const dimOthers = highlightPath.length > 0;

  /** 悬停节点：高亮邻域 + 计算 tip 位置。 */
  function showTip(id: string): void {
    setHoveredId(id);
    const node = nodeById.get(id);
    const frame = frameRef.current;
    if (!node || !frame) return;
    const scale = frame.clientWidth / vbW;
    const nx = (node.x + PAD_X) * scale;
    const ny = (node.y * V_SCALE + PAD_TOP) * scale;

    let left = nx + NODE_R * scale + 16;
    if (left + TIP_W > frame.clientWidth - 10) left = nx - NODE_R * scale - 16 - TIP_W;
    if (left < 10) left = Math.min(Math.max(10, nx - TIP_W / 2), frame.clientWidth - TIP_W - 10);
    let top = ny - 30;
    top = Math.max(10, Math.min(top, frame.clientHeight - TIP_H - 10));
    setTipPos({ left, top });
  }

  function hideTip(): void {
    setHoveredId(null);
    setTipPos(null);
  }

  /** 边的端点坐标：按节点半径收缩（与控制台 app.js 同公式）。 */
  function edgeEndpoints(fromId: string, toId: string) {
    const A = nodeById.get(fromId);
    const B = nodeById.get(toId);
    if (!A || !B) return null;
    const ax = A.x + PAD_X;
    const ay = A.y * V_SCALE + PAD_TOP;
    const bx = B.x + PAD_X;
    const by = B.y * V_SCALE + PAD_TOP;
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.hypot(dx, dy) || 1;
    return {
      x1: ax + (dx / d) * (NODE_R + 3),
      y1: ay + (dy / d) * (NODE_R + 3),
      x2: bx - (dx / d) * (NODE_R + 8),
      y2: by - (dy / d) * (NODE_R + 8),
    };
  }

  const counts = BAND_ORDER.reduce<Partial<Record<MasteryBand, number>>>((accumulator, band) => {
    accumulator[band] = (report?.mastery ?? []).filter((row) => masteryBandOf(row.mastery) === band).length;
    return accumulator;
  }, {});

  const hoveredNode = hoveredId ? snapshotNode(hoveredId) : null;
  const hoveredMastery = hoveredId ? (masteryById.get(hoveredId) ?? 0) : 0;
  const hoveredBand = hoveredId ? masteryBandOf(hoveredMastery) : null;

  if (!activeSpaceId) {
    return (
      <>
        <header className="page-head">
          <div>
            <h1 className="t-display">知识图谱</h1>
            <p className="page-lead">{UI_TEXT.needSelfReport}</p>
          </div>
        </header>
        <Link to={SPACES_PATH} className="btn btn-primary">
          去选空间
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="t-display">知识图谱</h1>
          <p className="page-lead">节点颜色表示掌握程度，连线表示先修关系。悬停任一节点，可查看它的邻域与学习详情。</p>
        </div>
        <div className="page-actions">
          {highlightPath.length > 0 ? (
            <span className="tag tag-accent">
              {plan && plan.path.join(',') === highlightPath.join(',')
                ? `学习路径：${plan.strategy}`
                : '正在高亮一条路径（上游 → 根因）'}
            </span>
          ) : null}
          <span className="tag">共 {GRAPH_NODES.length} 个知识点</span>
        </div>
      </header>

      {loading ? (
        <PageSkeleton label="正在取你的掌握度…" rows={1} />
      ) : !hasData ? (
        <div className="card" style={{ padding: 20 }}>
          <EmptyState
            title="这张图还没有你的颜色"
            hint={`${UI_TEXT.needSelfReport}做完自报或几道题，每个知识点就会按掌握度上色。`}
            action={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link to="/self-report" className="btn btn-primary">
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className="btn btn-ghost">
                  直接做几道题
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <section className="graph-frame" ref={frameRef} onMouseLeave={hideTip}>
          <svg
            className={`graph-svg${hoveredId ? ' is-focus' : ''}`}
            viewBox={`0 0 ${vbW} ${vbH}`}
            role="img"
            aria-label={`初中数学知识图谱，${GRAPH_NODES.length} 个知识点，${layout.edges.length} 条先修关系`}
            onMouseLeave={hideTip}
          >
            <defs>
              <marker
                id="zwArrow"
                viewBox="0 0 6 6"
                refX="5.2"
                refY="3"
                markerWidth="5.6"
                markerHeight="5.6"
                orient="auto"
              >
                <path className="edge-arrow" d="M.4.6 5.4 3 .4 5.4z" />
              </marker>
            </defs>

            <g className="edge-layer">
              {layout.edges.map((edge, i) => {
                const pts = edgeEndpoints(edge.from, edge.to);
                if (!pts) return null;
                const fromNode = nodeById.get(edge.from);
                const toNode = nodeById.get(edge.to);
                const cross = Boolean(fromNode && toNode && fromNode.chapter !== toNode.chapter);
                const onPathEdge = isPathEdge(edge.from, edge.to, highlightPath);
                const dim = dimOthers && !onPathEdge;
                const isOn =
                  Boolean(hoveredId) && (edge.from === hoveredId || edge.to === hoveredId);
                return (
                  <line
                    key={`e${i}`}
                    className={`edge${cross ? ' is-cross' : ''}${isOn ? ' is-on' : ''}`}
                    x1={pts.x1}
                    y1={pts.y1}
                    x2={pts.x2}
                    y2={pts.y2}
                    markerEnd="url(#zwArrow)"
                    style={{ opacity: dim ? 0.22 : 1 }}
                  />
                );
              })}
            </g>

            <g className="node-layer">
              {layout.nodes.map((placed) => {
                const mastery = masteryById.get(placed.id) ?? 0;
                const band = masteryBandOf(mastery);
                const bandCss = BAND_CSS[band];
                const isOn =
                  hoveredId === placed.id || Boolean(hoveredId && adj.get(placed.id)?.has(hoveredId));
                const dim = dimOthers && !onPath(placed.id);
                const weak = band === '待巩固';
                return (
                  <g
                    key={placed.id}
                    className={`node ${bandCss}${isOn ? ' is-on' : ''}`}
                    tabIndex={0}
                    role="button"
                    transform={`translate(${placed.x + PAD_X},${placed.y * V_SCALE + PAD_TOP})`}
                    onMouseEnter={() => showTip(placed.id)}
                    onFocus={() => showTip(placed.id)}
                    onBlur={hideTip}
                    style={{ opacity: dim ? 0.28 : 1 }}
                  >
                    <circle className="node-halo" r={NODE_R + 8} />
                    {weak ? <circle className="node-ring" r={NODE_R + 3.6} /> : null}
                    <circle className="node-dot" r={NODE_R} />
                    <text className="node-label" y={NODE_R + 15}>
                      {kpLabel(placed.id, 8)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <aside className="legend">
            <div className="legend-head">
              <h3>掌握程度</h3>
              <span>{GRAPH_NODES.length} 个节点</span>
            </div>
            <ul className="legend-list">
              {BAND_ORDER.map((band) => (
                <li key={band}>
                  <i className={`legend-sw ${BAND_CSS[band]}`} />
                  <span className="legend-name">{band}</span>
                  <span className="legend-count">{counts[band] ?? 0}</span>
                </li>
              ))}
            </ul>
            <div className="legend-foot">{layout.edges.length} 条先修关系 · 虚线为跨章节</div>
          </aside>

          <div className="canvas-foot">
            <span>知识库 初中数学</span>
            <i />
            <span>更新于 最近一次练习</span>
            <i />
            <span>义务教育数学课程标准</span>
          </div>

          <div
            className={`tip${hoveredId ? ' is-on' : ''}`}
            role="tooltip"
            aria-hidden={!hoveredId}
            style={tipPos ? { left: tipPos.left, top: tipPos.top } : undefined}
          >
            {hoveredNode && hoveredBand ? (
              <>
                <div className="tip-head">
                  <div>
                    <div className="tip-name">{hoveredNode.name}</div>
                    <div className="tip-chapter">
                      {hoveredNode.chapter} · 难度 {hoveredNode.difficulty}/5
                    </div>
                  </div>
                  <span className={`tag tag-band ${BAND_CSS[hoveredBand]}`}>
                    <i className={`tag-dot ${BAND_CSS[hoveredBand]}`} style={{ background: 'var(--band)' }} />
                    {hoveredBand}
                  </span>
                </div>
                <dl className="tip-grid">
                  <div>
                    <dt>掌握度</dt>
                    <dd>{percent(hoveredMastery)}</dd>
                  </div>
                  <div>
                    <dt>状态带</dt>
                    <dd>{hoveredBand}</dd>
                  </div>
                  <div>
                    <dt>先修</dt>
                    <dd>{hoveredNode.prerequisites.length === 0 ? '无' : hoveredNode.prerequisites.length}</dd>
                  </div>
                  <div>
                    <dt>后继</dt>
                    <dd>{hoveredNode.successors.length === 0 ? '无' : hoveredNode.successors.length}</dd>
                  </div>
                </dl>
                <div className="tip-err">
                  {hoveredBand}：{BAND_DESC[hoveredBand]}
                  <br />
                  先修{' '}
                  {hoveredNode.prerequisites.length === 0
                    ? '无'
                    : hoveredNode.prerequisites.map((id) => kpName(id)).join('、')}
                  {' · 后继 '}
                  {hoveredNode.successors.length === 0
                    ? '无'
                    : hoveredNode.successors.map((id) => kpName(id)).join('、')}
                </div>
              </>
            ) : null}
          </div>
        </section>
      )}

      <p className="t-sub" style={{ marginTop: 14 }}>
        共 {GRAPH_NODES.length} 个知识点 / {layout.columns} 层先修链 · 节点颜色与四色阈值取自引擎同一份常量
      </p>
    </>
  );
}
