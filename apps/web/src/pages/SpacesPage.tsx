/**
 * 页 3 · 学习空间列表（PRD §5 #3「默认已有空间；新建是次要按钮」；P0 #1）
 *
 * 契约：#3 GET /api/space/list、#4 POST /api/space/create
 *       409 → data={existing_space_id} → ConfirmDialog，**默认按钮「切换过去」**（契约 §2 明文）
 * 交互：主内容只放学习入口（主按钮按是否已自报切换文案）；空间管理本身是次要动作。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { createSpace, listSpaces } from '../api/endpoints';
import type { SpaceCreateConflictData, SpaceView } from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SELF_REPORT_PATH, isSelfReportDone } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 可选学段（与 data/knowledge/index.json 的 stages 对应；新增学科在此扩）。 */
const STAGES = [
  { id: 'kb_math_cz', label: '初中数学' },
  { id: 'kb_math_gz', label: '高中数学' },
] as const;

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [stage, setStage] = useState<(typeof STAGES)[number]['id']>('kb_math_cz');
  const [conflictSpaceId, setConflictSpaceId] = useState<string | null>(null);

  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  async function load(): Promise<void> {
    try {
      const data = await listSpaces();
      setSpaces(data.spaces);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(): Promise<void> {
    if (creating) return;
    setCreating(true);
    try {
      const created = await createSpace({ knowledge_source: stage });
      toast(`已建好「${created.name}」`);
      setActive(created.space_id);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.code === 409) {
        const data = error.data as SpaceCreateConflictData | null;
        if (data?.existing_space_id) setConflictSpaceId(data.existing_space_id);
        else toast(error.message, 'warn');
      } else {
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      }
    } finally {
      setCreating(false);
    }
  }

/** 主按钮：按本机自报标记决定「开始自报」还是「进入测评」（第一屏就让用户开始）。 */
function primaryAction(space: SpaceView): { label: string; path: string } {
  return isSelfReportDone(space.space_id)
    ? { label: '进入测评', path: '/assessment' }
    : { label: '开始 30 秒自报', path: SELF_REPORT_PATH };
}

/** 知识库 id → 学段标签（卡片副标题用）。 */
function stageLabel(kbId: string | undefined): string {
  return STAGES.find((s) => s.id === kbId)?.label ?? '数学';
}

  const ordered = [...spaces].sort((a, b) => Number(b.is_default) - Number(a.is_default));

  return (
    <section className="max-w-3xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-ink">学习空间</h1>
          <p className="mt-2 text-sm text-ink-soft">
            一个空间就是一个学科的知识地图。默认空间已经建好了，直接开始就好。
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* 学段选择：新建空间时决定挂哪个知识库（初中 / 高中） */}
          <div
            role="group"
            aria-label="选择学段"
            className="flex rounded-lg border border-line bg-sunken p-0.5 text-xs"
          >
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                aria-pressed={stage === s.id}
                className={[
                  'rounded-[6px] px-2.5 py-1 transition-colors',
                  stage === s.id ? 'bg-accent text-on-accent' : 'text-ink-soft hover:text-ink',
                ].join(' ')}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="min-h-9 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {creating ? '正在新建…' : '+ 新建空间'}
          </button>
        </div>
      </header>

      {loading ? (
        <PageSkeleton label="正在取你的空间…" rows={2} className="mt-8" />
      ) : ordered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有学习空间"
            hint="一个空间就是一个学科的知识地图。先建一个，我再按你的自报给你排学习顺序。"
            action={
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating}
                className="min-h-9 rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90 disabled:opacity-60"
              >
                {creating ? '正在新建…' : '新建学习空间'}
              </button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {ordered.map((space) => {
            const isActive = space.space_id === activeSpaceId;
            const action = primaryAction(space);
            return (
              <li
                key={space.space_id}
                className={[
                  'card-hover rounded-2xl border bg-surface p-5',
                  isActive ? 'border-accent' : 'border-line',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-medium text-ink">{space.name}</h2>
                      {space.is_default ? (
                        <span className="rounded-md bg-accent-veil px-2 py-0.5 text-xs text-accent">
                          默认空间
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="rounded-md bg-band-mastered/10 px-2 py-0.5 text-xs text-band-mastered">
                          当前使用
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      {stageLabel(space.knowledge_source[0])} · 创建于 {formatTime(space.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => navigate(action.path)}
                        className="rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90"
                      >
                        {action.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActive(space.space_id)}
                        className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-raised"
                      >
                        切到这个空间
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={conflictSpaceId !== null}
        title="这个学科的空间已经有一个了"
        description="同一个学科只留一个空间，数据才不会分散。要切到已有的那个吗？"
        confirmLabel={UI_TEXT.switchToExisting}
        onCancel={() => setConflictSpaceId(null)}
        onConfirm={() => {
          if (conflictSpaceId) setActive(conflictSpaceId);
          setConflictSpaceId(null);
          void load();
        }}
      />
    </section>
  );
}
