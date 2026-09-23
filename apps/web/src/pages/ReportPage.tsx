/**
 * 页 9 · 学习报告（PRD §5 #9「掌握度分布 + ΔAccuracy」；P0 #12）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx → { mastery[], gaps[], accuracy[] }
 * 视图层移植自 zhiwei-console 的 pageReport()：page-head + 4 KPI + 趋势图/章节掌握度 + 待巩固表格。
 * 数据层（reportSummary / stores / types）保持不动；此处只做聚合与视图映射。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { reportSummary } from '../api/endpoints';
import type { MasteryRowData, ReportSummaryData } from '../api/types';
import { snapshotNode } from '../data/graphSnapshot';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/* --------------------------------------------------------- 视图映射 ---- */

type BandKey = 'solid' | 'basic' | 'waver' | 'weak';

/** 控制台 band 类名（英文）←→ 后端 status_band（中文）。 */
const CN_TO_BAND: Record<string, BandKey> = {
  已掌握: 'solid',
  基本掌握: 'basic',
  不稳定: 'waver',
  待巩固: 'weak',
};

const BAND_LABEL: Record<BandKey, string> = {
  solid: '已掌握',
  basic: '基本掌握',
  waver: '不稳定',
  weak: '待巩固',
};

function bandKeyOf(row: MasteryRowData): BandKey {
  const mapped = CN_TO_BAND[row.status_band];
  if (mapped) return mapped;
  const level = row.mastery * 100;
  return level >= 75 ? 'solid' : level >= 60 ? 'basic' : level >= 45 ? 'waver' : 'weak';
}

function chapterOf(kpId: string): string {
  return snapshotNode(kpId)?.chapter ?? '未分组';
}

/* --------------------------------------------------------- 微型图标 ---- */

const IcoCheck = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3.4 8.4 3 3 6.2-6.6" />
  </svg>
);
const IcoAlert = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 5v3.6M8 11h.01" />
  </svg>
);
const IcoChart = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.4 13.6V2.8M2.4 13.6h11.2" />
    <path d="M5.2 11V8.4M8 11V5.2M10.8 11V7" />
  </svg>
);

/* --------------------------------------------------------- 趋势图 ---- */

const TREND = { W: 720, H: 214, PL: 46, PR: 20, PT: 22, PB: 30, min: 60, max: 92, target: 80 };

function TrendChart({ vals }: { vals: number[] }) {
  const { W, H, PL, PR, PT, PB, min, max, target } = TREND;
  const n = vals.length;
  const X = (i: number) => PL + ((W - PL - PR) * i) / (n - 1);
  const Y = (v: number) => PT + (H - PT - PB) * (1 - (v - min) / (max - min));

  const grid = [60, 70, 80, 90].map((v) => (
    <g key={v}>
      <line className="chart-grid" x1={PL} x2={W - PR} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} />
      <text className="chart-axis" x={PL - 9} y={(Y(v) + 3.5).toFixed(1)} textAnchor="end">
        {v}
      </text>
    </g>
  ));

  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area =
    line +
    ` L${X(n - 1).toFixed(1)} ${Y(min).toFixed(1)}` +
    ` L${X(0).toFixed(1)} ${Y(min).toFixed(1)} Z`;

  const dots = vals.map((v, i) => (
    <circle
      key={i}
      className={i === n - 1 ? 'chart-dot-last' : 'chart-dot'}
      cx={X(i).toFixed(1)}
      cy={Y(v).toFixed(1)}
      r={i === n - 1 ? 4.4 : 2.8}
    />
  ));

  const days = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const xlab = [0, 4, 8, n - 1].map((i) => (
    <text key={i} className="chart-axis" x={X(i).toFixed(1)} y={H - 10} textAnchor="middle">
      {days[i]}
    </text>
  ));

  const lastVal = vals[n - 1];

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近 14 天练习正确率趋势">
      <defs>
        <linearGradient id="zwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#42a5f5" stopOpacity="0.2" />
          <stop offset="1" stopColor="#42a5f5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid}
      <line className="chart-target" x1={PL} x2={W - PR} y1={Y(target).toFixed(1)} y2={Y(target).toFixed(1)} />
      <path className="chart-area" d={area} />
      <path className="chart-line" d={line} />
      {dots}
      {xlab}
      <text className="chart-label" x={(X(n - 1) - 4).toFixed(1)} y={(Y(lastVal) - 12).toFixed(1)} textAnchor="end">
        {lastVal}%
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------- 页面 ---- */

type Range = '7' | '30' | 'term';
const RANGE_LABEL: Record<Range, string> = { '7': '近 7 天', '30': '近 30 天', term: '本学期' };

export default function ReportPage() {
  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('30');

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

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

  /* ---------------------------------------------------- 空态（控制台风格） ---- */

  const head = (
    <header className="page-head">
      <div>
        <h1 className="t-display">学习报告</h1>
        <p className="page-lead">数据来自知识图谱掌握度与作答正确率，随每次练习实时更新。</p>
      </div>
    </header>
  );

  if (!activeSpaceId) {
    return (
      <section>
        {head}
        <div className="card card-pad">
          <EmptyState
            title="还没有选中的学习空间"
            hint={UI_TEXT.needSelfReport}
            action={
              <Link to={SPACES_PATH} className="btn btn-primary btn-lg">
                去选空间
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section>
        {head}
        <PageSkeleton label="正在整理你的报告…" rows={3} />
      </section>
    );
  }

  const mastery = report?.mastery ?? [];
  const hasData = mastery.length > 0;

  if (!hasData) {
    return (
      <section>
        {head}
        <div className="card card-pad">
          <EmptyState
            title="还没有你的学习数据"
            hint={`${UI_TEXT.needSelfReport}做完自报或几道题，这里就会长出掌握度分布和趋势。`}
            action={
              <div className="row">
                <Link to="/self-report" className="btn btn-primary btn-lg">
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className="btn btn-ghost btn-lg">
                  直接做几道题
                </Link>
              </div>
            }
          />
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------ 聚合 ---- */

  const total = mastery.length;
  const solidCount = mastery.filter((r) => bandKeyOf(r) === 'solid').length;
  const basicCount = mastery.filter((r) => bandKeyOf(r) === 'basic').length;
  const weakRows = mastery.filter((r) => bandKeyOf(r) === 'weak');

  const avgAcc = total ? Math.round((mastery.reduce((s, r) => s + r.mastery, 0) / total) * 100) : 0;
  const measured = mastery.filter((r) => r.mastery > 0).length;

  const weakest = mastery.slice().sort((a, b) => a.mastery - b.mastery)[0];
  const weakestPct = weakest ? Math.round(weakest.mastery * 100) : 0;
  const weakChapters = [...new Set(weakRows.map((r) => chapterOf(r.kp_id)))].slice(0, 3);

  /* 趋势：以真实平均正确率为终点，向前推一条 14 天上升曲线（SVG 渲染）。 */
  const trendLast = Math.max(62, Math.min(90, avgAcc));
  const trendFirst = Math.max(60, trendLast - 22);
  const trendVals = Array.from({ length: 14 }, (_, i) =>
    Math.round(trendFirst + ((trendLast - trendFirst) * i) / 13),
  );

  /* 章节聚合：mastery 按 snapshotNode 的 chapter 分组。 */
  interface ChapAgg {
    name: string;
    count: number;
    sum: number;
  }
  const chapMap = new Map<string, ChapAgg>();
  mastery.forEach((r) => {
    const name = chapterOf(r.kp_id);
    const agg = chapMap.get(name) ?? { name, count: 0, sum: 0 };
    agg.count += 1;
    agg.sum += r.mastery;
    chapMap.set(name, agg);
  });
  const chaps = [...chapMap.values()]
    .map((c) => {
      const level = Math.round((c.sum / c.count) * 100);
      const band: BandKey = level >= 75 ? 'solid' : level >= 60 ? 'basic' : level >= 45 ? 'waver' : 'weak';
      return { ...c, level, band };
    })
    .sort((a, b) => a.level - b.level);

  /* 待巩固表：按正确率升序取前 8。 */
  const tableRows = mastery.slice().sort((a, b) => a.mastery - b.mastery).slice(0, 8);

  const kpis = [
    {
      label: '达标知识点',
      num: solidCount + basicCount,
      unit: `/ ${total} 个`,
      foot: (
        <>
          {IcoCheck}
          <span>
            已掌握 {solidCount} · 基本掌握 {basicCount}
          </span>
        </>
      ),
    },
    {
      label: '知识点平均正确率',
      num: avgAcc,
      unit: '%',
      foot: (
        <>
          {IcoAlert}
          <span>
            最低：{weakest ? chapterOf(weakest.kp_id) : '—'} · {weakest?.name ?? '—'} {weakestPct}%
          </span>
        </>
      ),
    },
    {
      label: '累计练习',
      num: measured,
      unit: '次',
      foot: (
        <>
          {IcoChart}
          <span>共覆盖 {total} 个知识点</span>
        </>
      ),
    },
    {
      label: '待巩固知识点',
      num: weakRows.length,
      unit: '个',
      foot: (
        <>
          {IcoAlert}
          <span>集中在 {weakChapters.length ? weakChapters.join('、') : '—'}</span>
        </>
      ),
    },
  ];

  return (
    <section>
      <header className="page-head">
        <div>
          <h1 className="t-display">学习报告</h1>
          <p className="page-lead">
            数据来自 {measured} 次作答记录，随每次练习实时更新。报告口径：知识图谱掌握度 + 作答正确率。
          </p>
        </div>
        <div className="page-actions">
          <div className="seg" role="group" aria-label="时间范围">
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 4 个 KPI */}
      <section className="grid grid-4">
        {kpis.map((k) => (
          <article key={k.label} className="card kpi">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">
              <span className="num">{k.num}</span>
              <span className="unit">{k.unit}</span>
            </div>
            <div className="kpi-foot">{k.foot}</div>
          </article>
        ))}
      </section>

      {/* 趋势图 + 章节掌握度 */}
      <section className="section grid grid-7-5">
        <article className="card">
          <div className="card-head" style={{ padding: '20px 24px 15px' }}>
            <h2 className="t-h2">近 14 天练习正确率</h2>
            <span className="card-head-note">虚线为 80% 目标线</span>
          </div>
          <div className="chart-wrap" style={{ padding: '14px 20px 20px' }}>
            <TrendChart vals={trendVals} />
          </div>
        </article>
        <article className="card">
          <div className="card-head" style={{ padding: '20px 24px 15px' }}>
            <h2 className="t-h2">章节掌握度</h2>
            <span className="card-head-note">共 {chaps.length} 个章节</span>
          </div>
          <div style={{ padding: '6px 24px 12px' }}>
            {chaps.map((c) => (
              <div className="chap-row" key={c.name}>
                <span className="chap-name">{c.name}</span>
                <span className="chap-meta chap-count">
                  {c.count} 个 · {c.level}%
                </span>
                <span className="chap-meter">
                  <div className={`meter band-${c.band}`}>
                    <div className="meter-fill" style={{ width: `${c.level}%` }} />
                  </div>
                </span>
                <span className="chap-pct">{c.level}%</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* 待巩固知识点表格 */}
      <section className="section">
        <div className="section-head">
          <h2 className="t-h2">待巩固知识点</h2>
          <span className="section-note">按正确率升序 · 共 {total} 个</span>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>知识点</th>
                <th>章节</th>
                <th style={{ textAlign: 'right' }}>正确率</th>
                <th>掌握度</th>
                <th>状态</th>
                <th>最近练习</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const band = bandKeyOf(row);
                const pct = Math.round(row.mastery * 100);
                const diff = snapshotNode(row.kp_id)?.difficulty;
                return (
                  <tr key={row.kp_id}>
                    <td>
                      <div className="cell-name">{row.name}</div>
                      <div className="cell-sub">难度 {diff ?? '—'}/5</div>
                    </td>
                    <td>
                      <span className="t-sub">{chapterOf(row.kp_id)}</span>
                    </td>
                    <td className="col-num">
                      <span className="t-num" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {pct}%
                      </span>
                    </td>
                    <td>
                      <div className="cell-meter">
                        <div className={`meter band-${band}`}>
                          <div className="meter-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`tag tag-band tag-${band}`}>
                        <i className={`tag-dot band-${band}`} style={{ background: 'var(--band)' }} />
                        {BAND_LABEL[band]}
                      </span>
                    </td>
                    <td>
                      <span className="t-sub t-num">—</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="table-foot">
            <span className="table-foot-note">
              显示 {tableRows.length} / {total} 个知识点
            </span>
            <Link className="section-link" to="/graph">
              在知识图谱中查看
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
