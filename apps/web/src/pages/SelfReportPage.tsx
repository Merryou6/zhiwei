/**
 * 页 2 · 起点自报（PRD §5 #2「30 秒建先验 + 定主攻章节」；P0 #2）
 *
 * 契约：#6 POST /api/evidence/self-report（章节粒度 × 5 档，≤6 项）
 * 交互：一屏一件事（4 张章节卡 × 5 档单选，默认不选）+「按 3 档填」一键加速；
 *       提交后展示 updated（被写入先验的知识点数），并引导进测评（第一屏就让用户开始）。
 * 纪律：自报是先验不是观测（服务端不写 evidence_events）；此处不做任何对错/评价性措辞。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { selfReport } from '../api/endpoints';
import type { SelfReportLevel, SelfReportRow } from '../api/types';
import { Button, PageContainer, PageHeader } from '../components/ui';
import { CHAPTER_SIZES, chapterNames } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH, markSelfReportDone } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

const LEVELS: { value: SelfReportLevel; label: string; hint: string }[] = [
  { value: 1, label: '1', hint: '几乎没学过' },
  { value: 2, label: '2', hint: '听过，不熟' },
  { value: 3, label: '3', hint: '会一点，会晃' },
  { value: 4, label: '4', hint: '比较稳' },
  { value: 5, label: '5', hint: '很熟' },
];

/** 一键加速档位（D12：避免全零掌握度导致测评立即收敛 INFO-1）。 */
const QUICK_LEVEL: SelfReportLevel = 3;

export default function SelfReportPage() {
  const chapters = chapterNames();
  const [levels, setLevels] = useState<Record<string, SelfReportLevel>>({});
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  const chosen = chapters.filter((chapter) => levels[chapter] !== undefined);

  async function handleSubmit(): Promise<void> {
    if (submitting) return;
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      navigate(SPACES_PATH);
      return;
    }
    if (chosen.length === 0) {
      toast('至少选一个章节，或者点「按 3 档先填上」', 'warn');
      return;
    }

    const reports: SelfReportRow[] = chosen.map((chapter) => ({
      chapter,
      level: levels[chapter],
    }));

    setSubmitting(true);
    try {
      const data = await selfReport({ space_id: activeSpaceId, reports });
      setUpdated(data.updated);
      markSelfReportDone(activeSpaceId);
      toast(`已更新 ${data.updated} 个知识点的起点`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (updated !== null) {
    return (
      <PageContainer width="prose">
        <PageHeader title="起点记下了" />
        <p className="mt-3 text-reading leading-relaxed text-ink-soft">
          已更新 <span className="font-mono tabular-nums text-ink">{updated}</span> 个知识点的起点。
          接下来我出几道题，看看猜得准不准——你把会做的做掉就行，不用纠结对错，我这边只看整体。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => navigate('/assessment')}>
            开始测评
          </Button>
          <Button variant="secondary" onClick={() => navigate('/graph')}>
            先看看我的地图
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="prose">
      <PageHeader
        title="先说说你大概在哪一档"
        description="这不是考试，是让我别把时间浪费在你已经会的东西上。凭感觉选就行，30 秒够用。"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
          已选 {chosen.length}/{chapters.length} 个章节
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setLevels(Object.fromEntries(chapters.map((chapter) => [chapter, QUICK_LEVEL])))
          }
        >
          按 3 档先填上
        </Button>
      </div>

      <ul className="mt-4 space-y-3">
        {chapters.map((chapter) => (
          <li key={chapter} className="rounded-surface border border-line bg-surface p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-medium text-ink">{chapter}</h2>
              <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
                {CHAPTER_SIZES[chapter] ?? 0} 个知识点
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {LEVELS.map((level) => {
                const selected = levels[chapter] === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setLevels({ ...levels, [chapter]: level.value })}
                    className={cn(
                      'min-h-9 rounded-control border px-3 py-2 text-left text-ui-sm transition-colors',
                      selected
                        ? 'border-accent bg-accent-veil font-medium text-ink ring-1 ring-accent'
                        : 'border-line text-ink-soft hover:bg-raised',
                    )}
                  >
                    <span className="mr-1 font-medium">{level.label}</span>
                    {level.hint}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        size="lg"
        full
        loading={submitting}
        onClick={() => void handleSubmit()}
        className="mt-6"
      >
        {submitting ? '正在记下…' : '记下来，开始测评'}
      </Button>
    </PageContainer>
  );
}
