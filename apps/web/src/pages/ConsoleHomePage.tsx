/**
 * 页 · 控制台工作台（B 端「教师 / 管理端」首页）
 *
 * 这是「B 端深色控制台原型（zhiwei-console）」正式并入 apps/web 后的**真实入口**：
 *   - 不再是静态 HTML，而是挂载在真实后端之上的工作台；
 *   - 上方实时拉取当前空间的「学习概览」（GET /api/report/summary），用四状态带分布
 *     证明它读的是真数据，不是摆设；
 *   - 下方六张模块卡片（学习空间 / 测评 / 对话辅导 / 知识图谱 / 学习报告 / 云盘）
 *     全部跳转到已接通后端的真实路由。
 *
 * 设计：沿用控制台原型 / 全站 dusk 主题的设计令牌（bg-surface / border-line / text-ink /
 * band-*），不引入新配色。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import { SPACES_PATH } from '../router';
import { activeSpaceOf, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';
import { BAND_CLASS, BAND_ORDER, masteryBandOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import PageSkeleton from '../components/PageSkeleton';
import { UI_TEXT } from '../lib/phrases';

/** 六个真实模块（路径 = 已接通后端的路由）。 */
const MODULES: ReadonlyArray<{
  path: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}> = [
  {
    path: SPACES_PATH,
    title: '学习空间',
    desc: '管理学科空间，切换初中 / 高中数学知识库。',
    icon: (
      <path d="M2 5.4 8 2.4l6 3v5.2l-6 3-6-3zM2 5.4 8 8.4l6-3M8 8.4v5.2" />
    ),
  },
  {
    path: '/assessment',
    title: '测评',
    desc: '自适应测评，按掌握度收敛定位薄弱点。',
    icon: <path d="M4 3.5h8v9H4zM6.5 6.2l1.2 1.2 2.3-2.5M6.5 9.8h3" />,
  },
  {
    path: '/chat',
    title: '对话辅导',
    desc: '大模型陪练，逐步引导、不直接给答案。',
    icon: <path d="M2.5 4.2h11v6.5h-7l-2.6 2v-2.6H2.5zM5 7h6M5 5.6h4" />,
    badge: '大模型',
  },
  {
    path: '/graph',
    title: '知识图谱',
    desc: '知识点依赖关系与掌握度一览。',
    icon: <path d="M8 2.4 13.6 5v5.2L8 13.6 2.4 10.2V5zM8 2.4v11.2M2.4 5l11.2 5.2M13.6 5 2.4 10.2" />,
  },
  {
    path: '/report',
    title: '学习报告',
    desc: '掌握度分布、薄弱项与提升轨迹。',
    icon: <path d="M2.5 13.5V3M2.5 13.5h11M6 13.5v-4M9.5 13.5V7M13 13.5V4" />,
  },
  {
    path: '/drive',
    title: '云盘',
    desc: '教学资料与试卷归档。',
    icon: <path d="M2.5 5.5 5 3h6l2.5 2.5v6H2.5zM5.5 9.5h5" />,
  },
];

/** 概览：按四状态带统计分布（复用 engine 阈值，不另写）。 */
function useOverview(spaceId: string | null) {
  const [data, setData] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const toast = useUiStore((state) => state.toast);

  useEffect(() => {
    if (!spaceId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const result = await reportSummary(spaceId);
        if (!cancelled) setData(result);
      } catch (error) {
        if (!cancelled) {
          setFailed(true);
          toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId, toast]);

  return { data, loading, failed };
}

export default function ConsoleHomePage() {
  const space = useSpaceStore((state) => activeSpaceOf(state));
  const { data, loading } = useOverview(space?.space_id ?? null);

  const distribution = useMemo(() => {
    const counts: Record<MasteryBand, number> = { 待巩固: 0, 不稳定: 0, 基本掌握: 0, 已掌握: 0 };
    const total = data ? data.mastery.length : 0;
    const avg = total > 0 && data ? data.mastery.reduce((sum, row) => sum + row.mastery, 0) / total : 0;
    const gaps = data ? data.gaps.length : 0;
    if (data) for (const row of data.mastery) counts[masteryBandOf(row.mastery)] += 1;
    return { counts, total, avg, gaps };
  }, [data]);

  return (
    <section className="max-w-[1180px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-ink">控制台</h1>
            <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink-soft">
              教师 / 管理端
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            知微学习伴侣 · 当前空间：
            <span className="text-ink">{space ? space.name : '未选择'}</span>
          </p>
        </div>
        <Link
          to={SPACES_PATH}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
        >
          管理空间
        </Link>
      </header>

      {/* ── 实时学习概览（真数据，不是摆设） ── */}
      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-ink">学习概览</h2>
          <span className="text-xs text-ink-soft">实时取自当前空间</span>
        </div>

        {loading ? (
          <PageSkeleton label="正在拉取概览…" rows={2} className="mt-4" />
        ) : distribution.total === 0 ? (
          <div className="mt-4 rounded-xl border border-line bg-sunken p-4 text-sm text-ink-soft">
            这个空间还没有学习数据。先去
            <Link to="/assessment" className="text-accent hover:underline">
              做一次测评
            </Link>
            ，或到
            <Link to="/drive" className="text-accent hover:underline">
              云盘
            </Link>
            上传一份试卷，概览就会在这里出现。
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="知识点" value={String(distribution.total)} />
              <Stat label="已掌握" value={String(distribution.counts['已掌握'])} tone="band-mastered" />
              <Stat label="待巩固" value={String(distribution.counts['待巩固'])} tone="band-weak" />
              <Stat label="薄弱项" value={String(distribution.gaps)} />
            </div>

            {/* 四状态带分布条 */}
            <div className="mt-5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                {BAND_ORDER.map((band) => {
                  const n = distribution.counts[band];
                  if (n === 0) return null;
                  const pct = (n / distribution.total) * 100;
                  return (
                    <span
                      key={band}
                      className={BAND_CLASS[band].bg}
                      style={{ width: `${pct}%` }}
                      title={`${band}：${n}`}
                    />
                  );
                })}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                {BAND_ORDER.map((band) => (
                  <li key={band} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className={`h-2.5 w-2.5 rounded-full ${BAND_CLASS[band].bg}`} />
                    {band}
                    <span className="text-ink">{distribution.counts[band]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-xs text-ink-soft">
              平均掌握度 <span className="text-ink">{Math.round(distribution.avg * 100)}%</span>
            </p>
          </>
        )}
      </div>

      {/* ── 六个真实模块入口 ── */}
      <h2 className="mt-8 text-base font-medium text-ink">模块</h2>
      <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <li key={m.path}>
            <Link
              to={m.path}
              className="card-hover group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-accent"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/40 bg-accent-veil text-accent">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {m.icon}
                  </svg>
                </span>
                <h3 className="text-[15px] font-medium text-ink">{m.title}</h3>
                {m.badge ? (
                  <span className="ml-auto rounded-md bg-band-mastered/12 px-2 py-0.5 text-xs text-band-mastered">
                    {m.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-soft">{m.desc}</p>
              <span className="mt-3 text-[13px] font-medium text-accent transition-transform group-hover:translate-x-0.5">
                进入 →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 概览小卡片。 */
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-sunken p-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone ?? 'text-ink'}`}>{value}</p>
    </div>
  );
}
