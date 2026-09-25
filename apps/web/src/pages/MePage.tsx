/**
 * 页 12 · 我的（v1.2，D4b）
 *
 * 契约：#20 GET /api/user/profile（只读）——账号信息 / 空间概览 / 对话模型运行信息。
 * 页面另读 useSpaceStore 拿「当前学习空间」，并复用顶栏同一份 useThemeStore 做主题切换。
 *
 * 一屏一件事（沿用 max-w-3xl 卡片结构）：
 *   1) 账号：identifier / nickname（空显示「未设置」）/ user_id / 注册时间
 *   2) 当前学习空间：名称 + 学科标签 + 「去管理」→ /spaces
 *   3) 主题：ThemeToggle（与顶栏同一 store）
 *   4) 对话模型：mode 徽标 + 模型名（remote 时）+ 固定说明「不可在此自定义」
 *   5) 退出登录：确认后清 auth + space 两个 store，再导航 /login
 *
 * 红线：模型区只展示服务端下发的 mode/name，**不提供任何自定义入口**（用户反馈第 4 条：
 * 模型由服务端环境变量提供）；页面不做任何写接口调用。
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getUserProfile } from '../api/endpoints';
import type { ProfileData } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import PageSkeleton from '../components/PageSkeleton';
import ThemeToggle from '../components/ThemeToggle';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { stageLabel } from '../lib/stages';
import { LOGIN_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { activeSpaceOf, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

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

  const card = 'rounded-2xl border border-line bg-surface p-5 shadow-card';

  return (
    <section className="max-w-3xl">
      <header>
        <h1 className="text-xl font-medium text-ink">我的</h1>
        <p className="mt-2 text-sm text-ink-soft">账号、当前空间、主题和对话模型，都在这儿。</p>
      </header>

      {loading ? (
        <PageSkeleton label="正在取你的账号信息…" rows={2} className="mt-6" />
      ) : (
        <div className="mt-6 space-y-4">
          {/* 1) 账号 */}
          <div className={card}>
            <h2 className="text-base font-medium text-ink">账号</h2>
            {profile ? (
              <div className="mt-2 divide-y divide-line">
                <InfoRow label="账号" value={profile.user.identifier} />
                <InfoRow label="昵称" value={profile.user.nickname ?? '未设置'} />
                <InfoRow label="用户 ID" value={profile.user.user_id} />
                <InfoRow label="注册时间" value={formatTime(profile.user.created_at)} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-soft">账号信息暂时取不到，稍后刷新再看一眼。</p>
            )}
          </div>

          {/* 2) 当前学习空间 */}
          <div className={card}>
            <h2 className="text-base font-medium text-ink">当前学习空间</h2>
            {activeSpace ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink">{activeSpace.name}</p>
                  <p className="mt-1 text-ui-sm text-ink-soft">{stageLabel(activeSpace.knowledge_source[0])}</p>
                </div>
                <Link
                  to={SPACES_PATH}
                  className="min-h-9 rounded-control border border-line px-3 py-2 text-sm text-ink hover:bg-raised"
                >
                  去管理
                </Link>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">还没选中的学习空间。</p>
                <Link
                  to={SPACES_PATH}
                  className="min-h-9 rounded-control bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90"
                >
                  去选空间
                </Link>
              </div>
            )}
          </div>

          {/* 3) 主题 */}
          <div className={card}>
            <h2 className="text-base font-medium text-ink">主题</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">白天用浅色，晚上用深色，随你。</p>
              <ThemeToggle />
            </div>
          </div>

          {/* 4) 对话模型（只读） */}
          <div className={card}>
            <h2 className="text-base font-medium text-ink">对话模型</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-accent-veil px-2 py-0.5 text-xs text-accent">
                {profile ? MODEL_MODE_LABEL[profile.model.mode] : '—'}
              </span>
              {profile?.model.name ? (
                <span className="text-sm text-ink">{profile.model.name}</span>
              ) : null}
            </div>
            <p className="mt-2 text-ui-sm leading-relaxed text-ink-soft">{MODEL_NOTE}</p>
          </div>

          {/* 5) 退出登录 */}
          <div className={card}>
            <h2 className="text-base font-medium text-ink">退出登录</h2>
            <p className="mt-2 text-ui-sm text-ink-soft">退出后要重新登录才能接着学，学习记录不会丢。</p>
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="mt-3 min-h-9 rounded-control border border-line px-4 py-2 text-sm text-ink hover:bg-raised"
            >
              退出登录
            </button>
          </div>
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
    </section>
  );
}
