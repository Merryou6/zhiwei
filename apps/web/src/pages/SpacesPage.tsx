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
 *
 * 【P1/P3 2026-10-09 双端切换轮】teacher 访问本页只给「回老师端」指引（老师没有学习空间）；
 * 主按钮改并列双入口「进入学习 / 自报·拍卷建图」，不再依赖本机 isSelfReportDone 标记。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces } from '../api/endpoints';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import SpaceCreateForm from '../components/SpaceCreateForm';
import { Button, PageContainer, PageHeader } from '../components/ui';
import { cn } from '../lib/cn';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { stageLabel } from '../lib/stages';
import { START_PATH, TEACHER_HOME } from '../router';
import { useAuthStore } from '../stores/auth';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/**
 * 【P3 主按钮口径】不再按本机 isSelfReportDone 标记分流：走「拍试卷建图」路径的学生
 * 永远不会写这个标记，回到空间页仍被推「开始 30 秒自报」，口径是错的。
 * 改为并列双入口：主按钮「进入学习」（测评链路），次按钮「自报 / 拍卷建图」落
 * 冷启动分叉页 /start（那里本就提供拍试卷与做摸底题两种方式），两种建图路径
 * 随时可补，谁也不挤谁。
 */
const PRIMARY_ENTRY = { label: '进入学习', path: '/assessment' } as const;
const BUILD_ENTRY = { label: '自报 / 拍卷建图', path: START_PATH } as const;

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
  // 【P1 双端切换回路】页面级判断：teacher 账号没有学习空间，本页对它只做指引不做建空间
  const isTeacher = useAuthStore((state) => state.role) === 'teacher';

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
  // 【P1 双端切换回路】teacher 不渲染新建表单：老师账号建空间没有意义（见下方指引卡）
  const showForm = isTeacher ? false : loading ? false : ordered.length > 0 || formOpen;

  return (
    <PageContainer width="standard">
      <PageHeader
        title="学习空间"
        description="一个空间就是一个学科的知识地图。默认空间已经建好了，直接开始就好。"
      />

      {/* 【P1 双端切换回路】teacher 访问本页只给指引：不建空间、不引导学习链路，
          一颗「回老师端」把唯一的正确去向放在眼前（原来只会看到「还没有学习空间」空态）。 */}
      {isTeacher ? (
        <div className="mt-6 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="老师账号不用建学习空间"
            hint="你的学生在绑定后自动出现——回老师端就能看到他们的学习地图。"
            action={
              <Button variant="primary" onClick={() => navigate(TEACHER_HOME)}>
                回老师端
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <PageSkeleton label="正在取你的空间…" rows={2} className="mt-8" />
      ) : ordered.length === 0 ? (
        <div className="mt-6 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有学习空间"
            hint="一个空间就是一个学科的知识地图。先建一个，我再按你的自报给你排学习顺序。"
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                新建学习空间
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {ordered.map((space) => {
            const isActive = space.space_id === activeSpaceId;
            return (
              <li
                key={space.space_id}
                className={cn(
                  'rounded-surface border bg-surface p-5',
                  isActive ? 'border-accent' : 'border-line',
                )}
              >
                {/* flex-wrap（R7）：窄屏「标题 + 徽标」与右侧按钮组换行堆叠，不再互相挤压 */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-medium text-ink">{space.name}</h2>
                      {space.is_default ? (
                        <span className="rounded-md bg-accent-veil px-2 py-0.5 text-xs text-accent-ink">
                          默认空间
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="rounded-md bg-band-mastered/10 px-2 py-0.5 text-xs text-band-mastered">
                          当前使用
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-ui-sm text-ink-soft">
                      {stageLabel(space.knowledge_source[0])} · 创建于 {formatTime(space.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isActive ? (
                      <>
                        {/* 【P3 主按钮口径】并列双入口：进学习不再依赖本机自报标记，
                            拍卷建图的学生也不会再被推去「开始 30 秒自报」 */}
                        <Button variant="primary" onClick={() => navigate(PRIMARY_ENTRY.path)}>
                          {PRIMARY_ENTRY.label}
                        </Button>
                        <Button variant="secondary" onClick={() => navigate(BUILD_ENTRY.path)}>
                          {BUILD_ENTRY.label}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => setActive(space.space_id)}>
                        切到这个空间
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm ? (
        <div className="mt-6 rounded-surface border border-line bg-surface p-5 shadow-card">
          <h2 className="text-base font-medium text-ink">新建空间</h2>
          <p className="mt-1 text-ui-sm text-ink-soft">
            选一个学科；空间名不填就用学科名。同名会自动加序号，放心建。
          </p>
          <div className="mt-4">
            {/* 完整态共享表单（顶栏弹层用同一组件的 compact 态，D2c） */}
            <SpaceCreateForm />
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
