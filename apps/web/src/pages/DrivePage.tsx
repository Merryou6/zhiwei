/**
 * 页 10 · 云盘（P1）
 *
 * 契约：#5 GET /api/space/{space_id}/drive（预置课标 / 教材 + 用户文件；本地形态用户文件恒为空）
 *       #19 GET /api/report/summary（复用缺口数据，把资料和学生的薄弱章节挂钩）
 *
 * 2026-10-08 用户走查改造（「两个文件 + 一个禁用按钮」对学生没有价值）：
 *   - 新增「和你正在补的内容」区块：缺口知识点 → 章节（graphSnapshot）→ 对应资料
 *     （一元二次方程 / 二次函数 → 人教版九上；其余章节 → 课标工具书）；
 *     映射是**确定性关键词规则**、纯前端计算，不伪造"已读教材进度"之类的假数据；
 *   - 无缺口时引导先测评（数据长出来之前不硬推资料，D12 不伪造）；
 *   - 文件列表、上传禁用占位保持原样。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { drive, reportSummary } from '../api/endpoints';
import type { DriveFileView, ReportSummaryData } from '../api/types';
import { GRAPH_NODES } from '../data/graphSnapshot';
import { fileSize } from '../lib/format';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { Button, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 人教版九年级上册覆盖的章节（初中数学主线；其余章节回落到课标工具书）。 */
const GRADE9_CHAPTERS = new Set(['一元二次方程', '二次函数']);

interface FileRelevance {
  fileId: string;
  /** 关联的缺口知识点名（最多取 3 个展示）。 */
  relatedNames: string[];
}

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [report, setReport] = useState<ReportSummaryData | null>(null);
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
        const [driveData, summaryData] = await Promise.all([
          drive(activeSpaceId),
          reportSummary(activeSpaceId).catch(() => null), // 报告失败不拖垮文件列表
        ]);
        if (!cancelled) {
          setFiles(driveData.files);
          setReport(summaryData);
        }
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

  /** 缺口 → 资料关联（确定性规则：缺口知识点 → 章节 → 册次匹配的文件）。 */
  const relevance = useMemo<FileRelevance[]>(() => {
    const gaps = report?.gaps ?? [];
    if (gaps.length === 0 || files.length === 0) return [];
    const chapterOf = new Map(GRAPH_NODES.map((node) => [node.id, node.chapter]));

    const textbook = files.find((file) => file.name.includes('九年级上册'));
    const syllabus = files.find((file) => file.name.includes('课程标准')) ?? files[0];

    const grade9Names: string[] = [];
    const otherNames: string[] = [];
    for (const gap of gaps) {
      const chapter = chapterOf.get(gap.kp_id) ?? '';
      if (GRADE9_CHAPTERS.has(chapter)) grade9Names.push(gap.name);
      else otherNames.push(gap.name);
    }

    const result: FileRelevance[] = [];
    if (textbook && grade9Names.length > 0) {
      result.push({ fileId: textbook.file_id, relatedNames: grade9Names.slice(0, 3) });
    }
    if (syllabus && otherNames.length > 0) {
      result.push({ fileId: syllabus.file_id, relatedNames: otherNames.slice(0, 3) });
    }
    return result;
  }, [files, report]);

  if (!activeSpaceId) {
    return (
      <PageContainer width="prose">
        <PageHeader title="云盘" />
        {/* 玻璃面：空间层次（awwwards 2026 layered depth）。未选空间的引导卡属页首浮层卡，
            EmptyState 自带文案与动作钮，玻璃外层面不影响其可读性。 */}
        <div className="mt-5 glass-card rounded-surface border border-line p-5 shadow-card">
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
        <>
          {/* 和你正在补的内容（有缺口数据时才出现，不硬凑推荐） */}
          {relevance.length > 0 ? (
            // 玻璃面：空间层次（awwwards 2026 layered depth）。文件列表的头部统计卡；
            // 行内资料条保持 bg-canvas 实底、下方文件列表行刻意不动——列表行是密集信息区，可读性优先。
            <div className="mt-6 glass-card rounded-surface border border-line p-4 shadow-card">
              <h2 className="text-base font-medium text-ink">和你正在补的内容</h2>
              <p className="mt-1 text-ui-sm text-ink-soft">
                按你报告里的缺口挑的——先看这些，别整本翻。
              </p>
              <ul className="mt-3 space-y-2">
                {relevance.map((entry) => {
                  const file = files.find((item) => item.file_id === entry.fileId);
                  if (!file) return null;
                  return (
                    <li
                      key={entry.fileId}
                      className="rounded-control border border-line bg-canvas px-3 py-2"
                    >
                      <p className="truncate text-sm text-ink">{file.name}</p>
                      <p className="mt-0.5 text-ui-sm text-ink-soft">
                        涉及你正在补的：
                        {entry.relatedNames.map((name, index) => (
                          <span key={name}>
                            {index > 0 ? '、' : ''}
                            <span className="text-ink">{name}</span>
                          </span>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (report?.gaps ?? []).length === 0 && !loading ? (
            <div className="mt-6 rounded-surface border border-dashed border-line bg-surface p-4">
              <p className="text-sm text-ink">还没有能把资料和你挂钩的数据。</p>
              <p className="mt-1 text-ui-sm text-ink-soft">
                先去做几道题，我就能按你的缺口告诉你先看哪份资料。
              </p>
              <Link
                to="/assessment"
                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-3')}
              >
                去做几道题
              </Link>
            </div>
          ) : null}

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
        </>
      )}
    </PageContainer>
  );
}
