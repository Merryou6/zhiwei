/**
 * 页 14 · 专项练习（v2.1 三张牌之「逐步批改做专业感来源」）
 *
 * 契约：#7 POST /api/diagnose/next（mode=diagnose + scope_chapter —— 只取题，不落证据）
 *       #33 POST /api/grade/steps（分步提交 → 逐步判定 + 断点定位 + practice 证据）
 *
 * 交互：选章节 → 取一题 → 分步写过程（≤8 步）→ 批改结果（逐步 verdict + 断点高亮 +
 *       处方话术）→「再来一题」（exclude 已练题）。
 * 与测评的纪律差异：这里**明确反馈对错与断点**（逐步批改就是产品价值本身），
 * 与 D11「测评不即时展示对错」不冲突 —— 两条通路，两种目的。
 * 红线继承：题目对象只含白名单字段；feedback/hint 由服务端清洗，前端不自行拼接题库内容。
 */

import { useState } from 'react';

import { ApiError } from '../api/client';
import { diagnoseNext, gradeSteps } from '../api/endpoints';
import type { GradeStepsData, StepVerdict } from '../api/types';
import ItemCard from '../components/ItemCard';
import PageSkeleton from '../components/PageSkeleton';
import { Badge, Button, PageContainer, PageHeader, Select } from '../components/ui';
import { GRAPH_CHAPTERS } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { UI_TEXT } from '../lib/phrases';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

const VERDICT_LABEL: Record<StepVerdict, { text: string; tone: 'positive' | 'warning' | 'negative' | 'neutral' }> = {
  pass: { text: '✓ 这步对了', tone: 'positive' },
  slip: { text: '⚠ 运算失误', tone: 'warning' },
  concept_gap: { text: '✗ 思路断点', tone: 'negative' },
  unclear: { text: '？ 没读懂', tone: 'neutral' },
};

const MAX_STEPS = 8;

export default function PracticePage() {
  const [chapter, setChapter] = useState<string>(GRAPH_CHAPTERS[0]?.name ?? '');
  const [item, setItem] = useState<{ item_id: string; stem: string; options: string[] | null } | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeStepsData | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [noMore, setNoMore] = useState(false);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  function guardSpace(): string | null {
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      return null;
    }
    return activeSpaceId;
  }

  function handleError(error: unknown): void {
    toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
  }

  async function fetchItem(exclude: string[] = []): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || busy) return;
    setBusy(true);
    setResult(null);
    setChoice('');
    setSteps(['']);
    try {
      const data = await diagnoseNext({
        space_id: spaceId,
        mode: 'diagnose',
        scope_chapter: chapter,
        exclude_item_ids: exclude,
      });
      if (data.item === null || data.converged) {
        setItem(null);
        setNoMore(true);
      } else {
        setItem(data.item);
        setNoMore(false);
      }
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitSteps(): Promise<void> {
    const spaceId = guardSpace();
    const current = item;
    if (!spaceId || !current || busy) return;

    // 选择题：把所选选项文本作为单步提交；其余题型走分步
    const payload = current.options ? [choice] : steps.map((step) => step.trim());
    if (payload.some((step) => step.length === 0)) {
      toast('把每一步都写点什么（不会的那步写「不会」也行）', 'warn');
      return;
    }

    setBusy(true);
    try {
      const data = await gradeSteps({ space_id: spaceId, item_id: current.item_id, steps: payload });
      setResult(data);
      setDoneIds((prev) => [...new Set([...prev, current.item_id])]);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  function updateStep(index: number, value: string): void {
    setSteps((prev) => prev.map((step, offset) => (offset === index ? value : step)));
  }

  function removeStep(index: number): void {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, offset) => offset !== index)));
  }

  function moveStep(index: number, delta: -1 | 1): void {
    setSteps((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ------------------------------------------------------------ 章节选择
  if (!item && !noMore) {
    return (
      <PageContainer width="prose">
        <PageHeader
          title="专项练习"
          description="挑一章，写你的解题过程——我不只判对错，会告诉你断在第几步、为什么断。"
        />
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="text-ui-sm text-ink-soft">
            章节
            <Select
              fieldSize="sm"
              className="ml-2 w-auto min-h-9"
              value={chapter}
              onChange={(event) => setChapter(event.target.value)}
            >
              {GRAPH_CHAPTERS.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name}（{entry.kp_ids.length} 个知识点）
                </option>
              ))}
            </Select>
          </label>
          <Button variant="primary" disabled={busy || chapter.length === 0} onClick={() => void fetchItem(doneIds)}>
            {busy ? '正在取题…' : '取一道题'}
          </Button>
        </div>
        <p className="mt-4 text-ui-sm text-ink-soft">
          每一步都会被认真对待：对的部分照实记账（答错但有进展，掌握度不会按全错拉低）。
        </p>
      </PageContainer>
    );
  }

  if (noMore || !item) {
    return (
      <PageContainer width="prose">
        <PageHeader
          title="这一章练得差不多了"
          description="本章的题这轮都见过了。换个章节，或者去技能树看看这些练习点亮了什么。"
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => { setNoMore(false); setDoneIds([]); }}>
            换一章
          </Button>
          <Button variant="primary" onClick={() => { window.location.hash = '#/graph'; }}>
            看看我的技能树
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 作答 / 批改结果
  return (
    <PageContainer width="standard">
      <PageHeader
        title="分步写，我逐步批"
        description="一步一步写过程；卡住的那步写「不会」也可以——我会告诉你断点在哪、怎么补。"
        actions={
          <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
            {chapter} · 本轮已练 {doneIds.length} 题
          </span>
        }
      />

      <div className="mt-5">
        <ItemCard
          item={item}
          value={choice}
          onChange={setChoice}
          disabled={busy || result !== null}
          placeholder="第一步怎么下手？"
        />
      </div>

      {!item.options ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ui-sm text-ink-soft">
              解题过程（{steps.length}/{MAX_STEPS} 步）
            </span>
            {steps.length < MAX_STEPS ? (
              <Button
                variant="quiet"
                size="sm"
                disabled={busy || result !== null}
                onClick={() => setSteps((prev) => [...prev, ''])}
              >
                + 加一步
              </Button>
            ) : null}
          </div>
          {steps.map((step, index) => {
            const verdictRow = result?.step_results.find((row) => row.index === index + 1);
            const isBreak = result?.overall.first_break_step === index + 1 && verdictRow?.verdict !== 'pass';
            return (
              <div
                key={index}
                className={cn(
                  'rounded-surface border bg-surface p-3',
                  isBreak ? 'border-band-weak' : 'border-line',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-ui-sm tabular-nums text-ink-soft">第 {index + 1} 步</span>
                  <div className="flex items-center gap-1">
                    {verdictRow ? (
                      <Badge tone={VERDICT_LABEL[verdictRow.verdict].tone} size="sm">
                        {VERDICT_LABEL[verdictRow.verdict].text}
                      </Badge>
                    ) : null}
                    {result === null && steps.length > 1 ? (
                      <>
                        <Button variant="quiet" size="sm" disabled={index === 0} onClick={() => moveStep(index, -1)} aria-label="上移">
                          ↑
                        </Button>
                        <Button
                          variant="quiet"
                          size="sm"
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                          aria-label="下移"
                        >
                          ↓
                        </Button>
                        <Button variant="quiet" size="sm" onClick={() => removeStep(index)} aria-label="删除该步">
                          ×
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <textarea
                  className="mt-2 w-full resize-y rounded-control border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-70"
                  rows={2}
                  value={step}
                  disabled={busy || result !== null}
                  placeholder={index === 0 ? '第一步怎么下手？' : '这一步做了什么？'}
                  onChange={(event) => updateStep(index, event.target.value)}
                />
                {verdictRow ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-ink">{verdictRow.feedback}</p>
                    {verdictRow.hint ? <p className="text-ui-sm text-accent-ink">下一步往哪想：{verdictRow.hint}</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 总评 */}
      {result ? (
        <div className="mt-5 rounded-surface border border-line bg-surface p-4 shadow-card">
          <p className="text-sm text-ink">
            {result.overall.correct ? '终点抵达了正确答案。' : '这次没能走到正确答案，但过程都记下了。'}
            {result.overall.first_break_step !== null
              ? `断点在第 ${result.overall.first_break_step} 步。`
              : '每一步都过了。'}
          </p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            通过 {result.overall.pass_ratio === 1 ? '全部' : `${Math.round(result.overall.pass_ratio * 100)}%`} 步骤
            · 知识点「{result.overall.kp_name}」
            {result.evidence_written ? ' · 本次已记入掌握度' : ' · 这道题刚才批过（同一小时不重复计）'}
          </p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            断点已经记进你的图谱——复测和推荐会自动围着它转。
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {result === null ? (
          <Button variant="primary" disabled={busy} onClick={() => void submitSteps()}>
            {busy ? '正在批改…' : '提交，逐步批改'}
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void fetchItem(doneIds)}>
            {busy ? '正在取题…' : '再来一题'}
          </Button>
        )}
        <Button variant="secondary" disabled={busy} onClick={() => { setItem(null); setResult(null); setNoMore(false); }}>
          换一章
        </Button>
        <Button variant="ghost" onClick={() => { window.location.hash = '#/graph'; }}>
          看看技能树
        </Button>
      </div>

      {busy && result !== null ? <PageSkeleton label="正在准备下一题…" rows={1} className="mt-4" /> : null}
    </PageContainer>
  );
}
