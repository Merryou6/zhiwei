/**
 * 页 14 · 专项练习（v2.1 三张牌之「逐步批改做专业感来源」）
 *
 * 契约：#7 POST /api/diagnose/next（mode=diagnose + scope_chapter —— 只取题，不落证据）
 *       #33 POST /api/grade/steps（分步提交 → 逐步判定 + 断点定位 + practice 证据）
 *
 * 交互：选章节 → 取一题 → 分步写过程（≤8 步）→ 批改结果（逐步 verdict + 断点高亮 +
 *       处方话术）→「再来一题」（exclude 已练题）。
 * 结果揭示（2026-10-09 交互峰值包）：verdict 徽章错落入场 + 断点行一次性高亮并
 *       自动滚到位 + 总评卡入场与通过率数字爬升 —— reduced-motion 下全部瞬时。
 * 与测评的纪律差异：这里**明确反馈对错与断点**（逐步批改就是产品价值本身），
 * 与 D11「测评不即时展示对错」不冲突 —— 两条通路，两种目的。
 * 红线继承：题目对象只含白名单字段；feedback/hint 由服务端清洗，前端不自行拼接题库内容。
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { diagnoseNext, gradeSteps } from '../api/endpoints';
import type { GradeStepsData, StepVerdict } from '../api/types';
import ItemCard from '../components/ItemCard';
import PageSkeleton from '../components/PageSkeleton';
import { Badge, Button, PageContainer, PageHeader, Select } from '../components/ui';
import { GRAPH_CHAPTERS, snapshotNode } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { scrollBehavior } from '../lib/motion';
import { UI_TEXT } from '../lib/phrases';
import { useCountUp } from '../lib/useCountUp';
import { bandVeilHex } from '../theme/bands';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

const VERDICT_LABEL: Record<StepVerdict, { text: string; tone: 'positive' | 'warning' | 'negative' | 'neutral' }> = {
  pass: { text: '✓ 这步对了', tone: 'positive' },
  slip: { text: '⚠ 运算失误', tone: 'warning' },
  concept_gap: { text: '✗ 思路断点', tone: 'negative' },
  unclear: { text: '？ 没读懂', tone: 'neutral' },
};

const MAX_STEPS = 8;

/** 总评通过率的滚动数字：结果卡入场时从 0 爬到实际值（reduced-motion 直接终值）。 */
function PercentCount({ to }: { to: number }): ReactNode {
  const value = useCountUp(to, { duration: 700 });
  return (
    <>
      {/* 中间值对读屏是噪音：视觉值 aria-hidden，终值给 sr-only 静态文本（复评 P3）。 */}
      <span aria-hidden="true">{Math.round(value * 100)}</span>
      <span className="sr-only">{Math.round(to * 100)}</span>
    </>
  );
}

export default function PracticePage() {
  /** ?kp= 从技能树详情卡带来：预选其所在章节（v2.1 评审 P2：CTA 不断上下文）。 */
  const [params] = useSearchParams();
  const focusKp = params.get('kp');
  const focusChapter = focusKp
    ? (GRAPH_CHAPTERS.find((entry) => entry.kp_ids.includes(focusKp))?.name ?? null)
    : null;
  const [chapter, setChapter] = useState<string>(focusChapter ?? GRAPH_CHAPTERS[0]?.name ?? '');
  const [item, setItem] = useState<{ item_id: string; stem: string; options: string[] | null } | null>(null);
  const [choice, setChoice] = useState<string>('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeStepsData | null>(null);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [noMore, setNoMore] = useState(false);

  /** 断点行 / 总评卡的 DOM 锚点：结果到达后自动滚到位（峰值时刻 = 先看到断的那步）。 */
  const stepRowRefs = useRef(new Map<number, HTMLDivElement>());
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!result) return;
    const breakStep = result.overall.first_break_step;
    const anchor =
      (breakStep !== null ? stepRowRefs.current.get(breakStep) : undefined) ?? summaryRef.current;
    anchor?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [result]);

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
        {focusChapter && focusKp ? (
          <p className="mt-4 text-ui-sm text-accent-ink">
            已按你在技能树点的「{snapshotNode(focusKp)?.name ?? focusKp}」选好章节，直接取题就行。
          </p>
        ) : null}
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
                ref={(el) => {
                  if (el) stepRowRefs.current.set(index + 1, el);
                  else stepRowRefs.current.delete(index + 1);
                }}
                className={cn(
                  'rounded-surface border bg-surface p-3',
                  isBreak ? 'border-band-weak break-flash' : 'border-line',
                )}
                style={
                  isBreak ? ({ '--break-flash-from': bandVeilHex('待巩固', 0.2) } as CSSProperties) : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-ui-sm tabular-nums text-ink-soft">第 {index + 1} 步</span>
                  <div className="flex items-center gap-1">
                    {verdictRow ? (
                      <Badge
                        tone={VERDICT_LABEL[verdictRow.verdict].tone}
                        size="sm"
                        className="verdict-in"
                        style={{ animationDelay: `${index * 90}ms` }}
                      >
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
                  <div className="verdict-in mt-2 space-y-1" style={{ animationDelay: `${index * 90 + 60}ms` }}>
                    <p className="text-sm text-ink">{verdictRow.feedback}</p>
                    {verdictRow.hint ? <p className="text-ui-sm text-accent-ink">下一步往哪想：{verdictRow.hint}</p> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 总评（入场 + 通过率数字爬升；锚点供自动滚动） */}
      {result ? (
        <div
          ref={summaryRef}
          className="result-in mt-5 rounded-surface border border-line bg-surface p-4 shadow-card"
        >
          <p className="text-sm text-ink">
            {result.overall.correct ? '终点抵达了正确答案。' : '这次没能走到正确答案，但过程都记下了。'}
            {result.overall.first_break_step !== null
              ? `断点在第 ${result.overall.first_break_step} 步。`
              : '每一步都过了。'}
          </p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            通过 {result.overall.pass_ratio === 1 ? '全部' : <><PercentCount to={result.overall.pass_ratio} />%</>} 步骤
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
