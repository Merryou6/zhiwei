/**
 * 页 3 · 学习空间列表（PRD §5 #3「默认已有空间；新建是次要按钮」；P0 #1）
 *
 * 契约：#3 GET /api/space/list、#4 POST /api/space/create
 *       409 → data={existing_space_id} → ConfirmDialog，**默认按钮「切换过去」**（契约 §2 明文）
 * 交互：主内容只放学习入口（主按钮按是否已自报切换文案）；空间管理本身是次要动作。
 *
 * D2c 职责划分（v1.2）：本页 = 完整管理（列表 / 进入学习 / 新建 / 空状态引导），
 * 新建表单抽到 components/SpaceCreateForm 完整态嵌入（顶栏弹层复用同一组件的紧凑态），
 * 故本文件不再持有 handleCreate / stage / ConfirmDialog 逻辑。
 * STAGES 与 stageLabel 迁至 lib/stages（SpacesPage / SpaceCreateForm / 一致性测试三处共用）。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces } from '../api/endpoints';
import type { SpaceView } from '../api/types';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import SpaceCreateForm from '../components/SpaceCreateForm';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { stageLabel } from '../lib/stages';
import { SELF_REPORT_PATH, isSelfReportDone } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 主按钮：按本机自报标记决定「开始自报」还是「进入测评」（第一屏就让用户开始）。 */
function primaryAction(space: SpaceView): { label: string; path: string } {
  return isSelfReportDone(space.space_id)
    ? { label: '进入测评', path: '/assessment' }
    : { label: '开始 30 秒自报', path: SELF_REPORT_PATH };
}

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  /** 空状态下点「新建学习空间」才展开表单，避免一屏两个主按钮互相抢注意力。 */
  const [formOpen, setFormOpen] = useState(false);

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

  const ordered = [...spaces].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const showForm = loading ? false : ordered.length > 0 || formOpen;

  return (
    <section className="max-w-3xl">
      <header>
        <h1 className="text-xl font-medium text-ink">学习空间</h1>
        <p className="mt-2 text-sm text-ink-soft">
          一个空间就是一个学科的知识地图。默认空间已经建好了，直接开始就好。
        </p>
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
                onClick={() => setFormOpen(true)}
                className="min-h-9 rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90"
              >
                新建学习空间
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
                  'rounded-2xl border bg-surface p-5',
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

      {showForm ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-base font-medium text-ink">新建空间</h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            选一个学科；空间名不填就用学科名。同名会自动加序号，放心建。
          </p>
          <div className="mt-4">
            {/* 完整态共享表单（顶栏弹层用同一组件的 compact 态，D2c） */}
            <SpaceCreateForm />
          </div>
        </div>
      ) : null}
    </section>
  );
}
