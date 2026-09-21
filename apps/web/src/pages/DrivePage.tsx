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
      <section className="max-w-2xl">
        <h1 className="text-xl font-medium text-ink">云盘</h1>
        <div className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card">
          <EmptyState
            title="还没有选中的学习空间"
            hint="先选一个学习空间，我再告诉你这个学科有哪些资料。"
            action={
              <Link to={SPACES_PATH} className="inline-block min-h-9 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90">
                去选空间
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-ink">资料与教材</h1>
          <p className="mt-2 text-sm text-ink-soft">
            这个空间里的预置资料（只读）。你自己的知识库还在路上。
          </p>
        </div>

        <button
          type="button"
          disabled
          title={UI_TEXT.driveComingSoon}
          onClick={() => toast(UI_TEXT.driveComingSoon)}
          className="cursor-not-allowed rounded-lg border border-line px-3 py-2 text-sm text-ink-soft/60"
        >
          上传自定义知识库（P1）
        </button>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">正在取文件列表…</p>
      ) : files.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">这个空间暂时没有资料。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {files.map((file) => (
            <li
              key={file.file_id}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{file.name}</p>
                <p className="mt-0.5 text-[13px] text-ink-soft">{file.file_id}</p>
              </div>
              <span className="shrink-0 text-[13px] text-ink-soft">
                {file.type.toUpperCase()} · {fileSize(file.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
