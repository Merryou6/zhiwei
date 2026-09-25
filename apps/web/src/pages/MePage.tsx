/**
 * 页 12 · 我的（v1.2，D4b；v1.4 吸收旧控制台页 11 的「学习概览」）
 *
 * 契约：#20 GET /api/user/profile（只读）——账号信息 / 空间概览 / 对话模型运行信息。
 *       概览块走 #9 GET /api/report/summary（与学习报告同一数据源，实时）。
 * 页面另读 useSpaceStore 拿「当前学习空间」，并复用顶栏同一份 useThemeStore 做主题切换。
 *
 * 一屏一件事（standard 列 + Card 分节）：
 *   0) 学习概览（v1.4 自控制台并入）：四状态带 KPI + 分布条 + 平均掌握度
 *   1) 账号：identifier / nickname（空显示「未设置」）/ user_id / 注册时间
 *   2) 当前学习空间：名称 + 学科标签 + 「去管理」→ /spaces
 *   3) 主题：ThemeToggle（与顶栏同一 store）
 *   4) 对话模型：mode 徽标 + 模型名（remote 时）+ 固定说明「不可在此自定义」
 *   5) 退出登录：确认后清 auth + space 两个 store，再导航 /login
 *
 * 红线：模型区只展示服务端下发的 mode/name，**不提供任何自定义入口**（用户反馈第 4 条：
 * 模型由服务端环境变量提供）；页面不做任何写接口调用。
 *
 * v1.4（2026-09-25 用户口径「把控制台融进我的页面，砍掉教师端」）：
 * 概览数据块自 ConsoleHomePage 迁入（分档阈值仍走 theme/bands 的 masteryBandOf，engine 唯一来源）；
 * 控制台特有的「六模块入口」网格**不迁**——顶栏主导航本就覆盖全部模块，
 * 门户网格是 B 端工作台的角色产物，学生产品里它是第二套导航真相。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getUserProfile, reportSummary } from '../api/endpoints';
import type { ProfileData, ReportSummaryData } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import PageSkeleton from '../components/PageSkeleton';
import ThemeToggle from '../components/ThemeToggle';
import { Badge, Button, Card, CardTitle, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { stageLabel } from '../lib/stages';
import { LOGIN_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { activeSpaceOf, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';
import { BAND_CLASS, BAND_ORDER, masteryBandOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';

/** 模型模式 → 中文徽标（只读展示，两种取值来自契约 #20）。 */
const MODEL_MODE_LABEL: Record<ProfileData['model']['mode'], string> = {
  local: '本地规则',
  remote: '远程大模型',
};

/** 只读展示：可填「不可自定义」说明文案（用户反馈第 4 条）。 */
const MODEL_NOTE = '对话模型由服务端配置，不可在此自定义。';

/** 一行「标签 + 值」的账号信息行。 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <span className="text-ui-sm text-ink-soft">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

/**
 * 概览小卡（v1.4 自控制台迁入）。
 * ⚠ band 着色必须走 BAND_CLASS[band].text（完整字面量类名由 bands.ts 给），
 * 不得传裸令牌名拼类 —— 那是 tokens.test.ts ⑪ 拦过的静默失效原案。
 */
function Stat({ label, value, band }: { label: string; value: number; band?: MasteryBand }) {
  return (
    <div className="rounded-surface border border-line bg-canvas p-3">
      <p className="text-caption text-ink-soft">{label}</p>
      {/* 数值等宽 + 表格数字：这些数随数据变化，比例字体下每刷新宽度就跳一次 */}
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

/** 学习概览（#9 实时数据；v1.4 自控制台迁入，数据源与学习报告同一条）。 */
function OverviewCard({ spaceId }: { spaceId: string }) {
  const [data, setData] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useUiStore((state) => state.toast);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await reportSummary(spaceId);
        if (!cancelled) setData(result);
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
  }, [spaceId]);

  const distribution = useMemo(() => {
    const counts: Record<MasteryBand, number> = { 待巩固: 0, 不稳定: 0, 基本掌握: 0, 已掌握: 0 };
    const total = data ? data.mastery.length : 0;
    const avg = total > 0 && data ? data.mastery.reduce((sum, row) => sum + row.mastery, 0) / total : 0;
    const gaps = data ? data.gaps.length : 0;
    if (data) for (const row of data.mastery) counts[masteryBandOf(row.mastery)] += 1;
    return { counts, total, avg, gaps };
  }, [data]);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>学习概览</CardTitle>
        <span className="text-caption text-ink-soft">实时取自当前空间</span>
      </div>

      {loading ? (
        <PageSkeleton label="正在拉取概览…" rows={2} />
      ) : distribution.total === 0 ? (
        <p className="text-sm leading-relaxed text-ink-soft">
          这个空间还没有学习数据。先去
          <Link to="/assessment" className="text-accent-ink hover:underline">
            做一次测评
          </Link>
          ，或到
          <Link to="/drive" className="text-accent-ink hover:underline">
            云盘
          </Link>
          上传一份试卷，概览就会在这里出现。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 nav:gap-3 sm:grid-cols-4">
            <Stat label="知识点" value={distribution.total} />
            <Stat label="已掌握" value={distribution.counts['已掌握']} band="已掌握" />
            <Stat label="待巩固" value={distribution.counts['待巩固']} band="待巩固" />
            <Stat label="薄弱项" value={distribution.gaps} />
          </div>

          {/* 四状态带分布条（着色与图例同一来源 BAND_CLASS） */}
          <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-canvas">
              {BAND_ORDER.map((band) => {
                const n = distribution.counts[band];
                if (n === 0) return null;
                return (
                  <span
                    key={band}
                    className={BAND_CLASS[band].bg}
                    style={{ width: `${(n / distribution.total) * 100}%` }}
                    title={`${band}：${n}`}
                  />
                );
              })}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {BAND_ORDER.map((band) => (
                <li key={band} className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span className={`h-2.5 w-2.5 rounded-full ${BAND_CLASS[band].bg}`} />
                  {band}
                  <span className="font-mono tabular-nums text-ink">{distribution.counts[band]}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-caption text-ink-soft">
            平均掌握度{' '}
            <span className="font-mono tabular-nums text-ink">
              {Math.round(distribution.avg * 100)}%
            </span>
          </p>
        </>
      )}
    </Card>
  );
}

export default function MePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const activeSpace = useSpaceStore(activeSpaceOf);
  const clearSpace = useSpaceStore((state) => state.clear);
  const clearAuth = useAuthStore((state) => state.clear);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getUserProfile();
        if (!cancelled) setProfile(data);
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
  }, []);

  function handleLogout(): void {
    // 顺序：先清两个 store（含 localStorage），再导航——守卫读落盘，必须先落盘再跳转
    clearAuth();
    clearSpace();
    setConfirmLogout(false);
    navigate(LOGIN_PATH, { replace: true });
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="我的"
        description="学习概览、账号、当前空间、主题和对话模型，都在这儿。"
      />

      {/* 0) 学习概览（v1.4 自控制台并入）：自己管取数与加载态，
          不被账号信息的 loading 挡住——概览只依赖当前空间，先到先渲染。 */}
      {activeSpace ? <div className="mt-6"><OverviewCard spaceId={activeSpace.space_id} /></div> : null}

      {loading ? (
        <PageSkeleton label="正在取你的账号信息…" rows={2} className="mt-6" />
      ) : (
        <div className={activeSpace ? 'mt-4 space-y-4' : 'mt-6 space-y-4'}>
          {/* 1) 账号 */}
          <Card>
            <CardTitle>账号</CardTitle>
            {profile ? (
              <div className="divide-y divide-line">
                <InfoRow label="账号" value={profile.user.identifier} />
                <InfoRow label="昵称" value={profile.user.nickname ?? '未设置'} />
                <InfoRow label="用户 ID" value={profile.user.user_id} />
                <InfoRow label="注册时间" value={formatTime(profile.user.created_at)} />
              </div>
            ) : (
              <p className="text-sm text-ink-soft">账号信息暂时取不到，稍后刷新再看一眼。</p>
            )}
          </Card>

          {/* 2) 当前学习空间 */}
          <Card>
            <CardTitle>当前学习空间</CardTitle>
            {activeSpace ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink">{activeSpace.name}</p>
                  <p className="mt-1 text-ui-sm text-ink-soft">{stageLabel(activeSpace.knowledge_source[0])}</p>
                </div>
                <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'secondary' }))}>
                  去管理
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">还没选中的学习空间。</p>
                <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                  去选空间
                </Link>
              </div>
            )}
          </Card>

          {/* 3) 主题 */}
          <Card>
            <CardTitle>主题</CardTitle>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">白天用浅色，晚上用深色，随你。</p>
              <ThemeToggle />
            </div>
          </Card>

          {/* 4) 对话模型（只读） */}
          <Card>
            <CardTitle>对话模型</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                {profile ? MODEL_MODE_LABEL[profile.model.mode] : '—'}
              </Badge>
              {profile?.model.name ? (
                <span className="text-sm text-ink">{profile.model.name}</span>
              ) : null}
            </div>
            <p className="text-ui-sm leading-relaxed text-ink-soft">{MODEL_NOTE}</p>
          </Card>

          {/* 5) 退出登录 */}
          <Card>
            <CardTitle>退出登录</CardTitle>
            <p className="text-ui-sm text-ink-soft">退出后要重新登录才能接着学，学习记录不会丢。</p>
            <Button variant="secondary" onClick={() => setConfirmLogout(true)}>
              退出登录
            </Button>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmLogout}
        title="要退出登录吗？"
        description="退出后需要重新登录，你的空间和学习记录都会保留。"
        confirmLabel="退出登录"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </PageContainer>
  );
}
