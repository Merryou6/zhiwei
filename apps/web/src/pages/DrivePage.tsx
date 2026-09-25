/**
 * 页 10 · 云盘（P1）
 *
 * 契约：#5 GET /api/space/{space_id}/drive（预置课标 / 教材 + 用户文件；本地形态用户文件恒为空）
 * 交互：只读列表（file_id / name / type / size 人性化）+「上传自定义知识库」**禁用占位**
 *       （点击给非阻断 toast：PRD §3 P1 原文案「自定义知识库即将开放」）。
 * 不做真实上传（1.2 排除项：不写云存储直传）。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { drive } from '../api/endpoints';
import type { DriveFileView } from '../api/types';
import { fileSize } from '../lib/format';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { Button, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [loading, setLoading] = useState(true);

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
        const data = await drive(activeSpaceId);
        if (!cancelled) setFiles(data.files);
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

  if (!activeSpaceId) {
    return (
      <PageContainer width="prose">
        <PageHeader title="云盘" />
        <div className="mt-5 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有选中的学习空间"
            hint="先选一个学习空间，我再告诉你这个学科有哪些资料。"
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                去选空间
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="standard">
      <PageHeader
        title="资料与教材"
        description="这个空间里的预置资料（只读）。你自己的知识库还在路上。"
        actions={
          // 占位按钮走 Button 原语：原实现手写「描边 + 半透明文字」表达禁用，
          // 与原语的禁用态（opacity-60 + cursor-not-allowed）是两套写法。
          // 这是页面上唯一一处「将来会变可用」的入口，先把形态收进原语。
          <Button
            variant="secondary"
            size="sm"
            disabled
            title={UI_TEXT.driveComingSoon}
            onClick={() => toast(UI_TEXT.driveComingSoon)}
          >
            上传自定义知识库（P1）
          </Button>
        }
      />

      {loading ? (
        <PageSkeleton label="正在取文件列表…" rows={2} className="mt-6" />
      ) : files.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">这个空间暂时没有资料。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {files.map((file) => (
            <li
              key={file.file_id}
              className="flex items-center justify-between gap-4 rounded-surface border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{file.name}</p>
                {/* break-all（R6）：file_id 是无空格长串（形如 file_xxxxxxxxxxxx），
                    窄屏只有强制断行才不撑破卡片。桌面宽度足够，断行分支不触发。 */}
                <p className="mt-0.5 break-all text-ui-sm text-ink-soft">{file.file_id}</p>
              </div>
              <span className="shrink-0 font-mono text-ui-sm tabular-nums text-ink-soft">
                {file.type.toUpperCase()} · {fileSize(file.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
