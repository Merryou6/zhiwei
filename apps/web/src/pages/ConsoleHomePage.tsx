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
 *
 * ── 重构 P3-2（2026-09-25）───────────────────────────────────────
 * ① 宽度改走 PageContainer 的 wide 档：原来写死的 max-w-[1180px] 大于外壳的 1152，
 *    被静默截断成一句永不生效的死值（「宽度只能有一个真相」那条纪律的起因）。
 * ② 标题区改走 PageHeader：角色标签从自制的 chip 变成 kicker（页面归属的表达），
 *    管理空间 Link 复用 buttonVariants —— 不再抄第二套按钮 class。
 * ③ 修掉一处**静默失效**：Stat 的色调参数拼出的是裸类 `band-mastered` 而不是
 *    `text-band-mastered`，于是「已掌握」「待巩固」两个 KPI 的颜色编码从未渲染过。
 *    见文件末 Stat 的说明；tokens.test.ts ⑪ 已加静态闸门拦这类写法。
 * ④ 数值全部改等宽 + 表格数字（font-mono tabular-nums）：这几个数随数据变化，
 *    比例字体下每刷新一次宽度就跳一次。
 * ⑤ 容器内间距收紧（KPI 行 gap-2/gap-3、模块网格 gap-3），页面级间距（mt-6/mt-8）
 *    保持不变 —— 密度只压容器，不动版式骨架。
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
import { PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
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
    <PageContainer width="wide">
      {/* 宽度改走 PageContainer 的 wide 档（2026-09-25 重构 P3）。
          原来这里写死 max-w-[1180px]，而外壳在 P2 已放宽到 1152 —— 页面自己写的宽度
          一旦大于外壳就会被静默截断，成为一句永不生效的死值。这正是本项目
          「宽度只能有一个真相」那条纪律的起因。wide 档刻意不设 max-width，直接继承外壳。 */}
      <PageHeader
        kicker="教师 / 管理端"
        title="控制台"
        description={
          <>
            知微学习伴侣 · 当前空间：<span className="text-ink">{space ? space.name : '未选择'}</span>
          </>
        }
        actions={
          // Link 复用按钮的可视规格：buttonVariants 是原语导出的唯一形态来源，
          // 在这里取用它，而不是把按钮的 class 再抄一遍（抄一遍就是第二套真相）。
          <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
            管理空间
          </Link>
        }
      />

      {/* ── 实时学习概览（真数据，不是摆设） ── */}
      <div className="mt-6 rounded-surface border border-line bg-surface p-6 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-ink">学习概览</h2>
          <span className="text-xs text-ink-soft">实时取自当前空间</span>
        </div>

        {loading ? (
          <PageSkeleton label="正在拉取概览…" rows={2} className="mt-4" />
        ) : distribution.total === 0 ? (
          <div className="mt-4 rounded-surface border border-line bg-canvas p-4 text-sm text-ink-soft">
            这个空间还没有学习数据。先去
            <Link to="/assessment" className="text-accent-ink hover:underline">
              做一次测评
            </Link>
            ，或到
            <Link to="/drive" className="text-accent-ink hover:underline">
              云盘
            </Link>
            上传一份试卷，概览就会在这里出现。
          </div>
        ) : (
          <>
            {/* KPI 行：窄屏 gap-2、≥720 gap-3。密度只压容器间距，最小一档也停在 8px ——
                再小会让相邻 KPI 的边界糊成一片，那是「挤」而不是「密」。 */}
            <div className="mt-4 grid grid-cols-2 gap-2 nav:gap-3 sm:grid-cols-4">
              <Stat label="知识点" value={distribution.total} />
              <Stat label="已掌握" value={distribution.counts['已掌握']} band="已掌握" />
              <Stat label="待巩固" value={distribution.counts['待巩固']} band="待巩固" />
              <Stat label="薄弱项" value={distribution.gaps} />
            </div>

            {/* 四状态带分布条 */}
            <div className="mt-5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-canvas">
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
                    <span className="font-mono tabular-nums text-ink">{distribution.counts[band]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-caption text-ink-soft">
              平均掌握度{' '}
              <span className="font-mono tabular-nums text-ink">
                {Math.round(distribution.avg * 100)}%
              </span>
            </p>
          </>
        )}
      </div>

      {/* ── 六个真实模块入口 ── */}
      <h2 className="mt-8 text-base font-medium text-ink">模块</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <li key={m.path}>
            <Link
              to={m.path}
              className="group flex h-full flex-col rounded-surface border border-line bg-surface p-5 shadow-card transition-colors hover:border-accent"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-surface border border-accent/40 bg-accent-veil text-accent-ink">
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
                <h3 className="text-reading font-medium text-ink">{m.title}</h3>
                {m.badge ? (
                  <span className="ml-auto rounded-md bg-band-mastered/10 px-2 py-0.5 text-xs text-band-mastered">
                    {m.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex-1 text-ui-sm leading-relaxed text-ink-soft">{m.desc}</p>
              <span className="mt-3 text-ui-sm font-medium text-accent-ink transition-transform group-hover:translate-x-0.5">
                进入 →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

/**
 * 概览小卡片。
 *
 * 【2026-09-25 重构 P3 修掉的一处静默失效】
 * 原实现的色调参数是 `tone?: string`，调用方传 `"band-mastered"`，最终拼出的类是
 * **`band-mastered`** —— 而 Tailwind 的颜色工具类必须带前缀（`text-band-mastered`）。
 * 裸令牌名不是类，浏览器静默忽略，于是「已掌握」「待巩固」两个 KPI 的颜色编码
 * **从未渲染过**：不报错、不挂测试，看起来还「像是设计成这样」。
 * 现在改为传 band 语义名、从 BAND_CLASS 取 text 类 —— 颜色只有一个来源，
 * 而且拼不出裸类名（BAND_CLASS 的值自带 prefix）。tokens.test.ts ⑪ 已加静态闸门。
 */
function Stat({ label, value, band }: { label: string; value: number; band?: MasteryBand }) {
  return (
    <div className="rounded-surface border border-line bg-canvas p-3">
      <p className="text-caption text-ink-soft">{label}</p>
      {/* 数值走等宽 + 表格数字：这几个数随数据变化（知识点数、各带计数），
          比例字体下每刷新一次宽度就跳一次；等宽数字让它们对齐且不抖动。 */}
      <p
        className={cn(
          'mt-1 font-mono text-xl font-medium tabular-nums',
          band ? BAND_CLASS[band].text : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  );
}
