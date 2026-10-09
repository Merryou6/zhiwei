/**
 * 页 14 · 专项练习（v2.2-m1：系统性刷题阶梯 + 概念知识体系 + 提示链）
 *
 * 契约：#34 GET  /api/practice/ladder（按章组一梯子题：train 池由易到难，排除已练，练完回流）
 *       #35 GET  /api/practice/progress（按章聚合练习进度：提交数/练过题数/平均通过率）
 *       #36 GET  /api/concepts（概念卡：定义/体系要点/典型例/易错点/关联 —— 概念给体系）
 *       #33 POST /api/grade/steps（分步提交 → 逐步判定 + 断点定位 + practice 证据）
 *
 * 三段流程：
 *   select  选章节 → 本章进度概览 +「先看看知识体系」概念卡折叠面板 → 开始专项阶梯
 *   ladder  逐题作答（进度点 + 难度点）→ 提示链 L1「给个方向」/ L2「再给点思路」逐级解锁
 *           → 分步写过程 → 逐步批改（verdict + 断点高亮）→ 下一题 → 做完看战报
 *   summary 本组战报（对几题/平均通过率）+ 本章累计进度 → 再来一组 / 换一章 / 看技能树
 *
 * 提示链哲学：L1/L2 是「知识点级」提示（概念卡 method/hint），不含本题解答、不泄题；
 * 第三级引导就是逐步批改本身——把过程写出来提交，断在哪一步、怎么补，批改带你走。
 * 练完一轮的题会回流（refilled），阶梯可以反复刷；每轮都从当前还没练熟的部分继续。
 *
 * 与测评的纪律差异：这里明确反馈对错与断点（逐步批改就是产品价值本身），
 * 与 D11「测评不即时展示对错」不冲突——两条通路，两种目的。
 * 红线继承：题目对象只含白名单字段；前端不自行拼接题库内容。
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
// P3 路由修复：站内跳转改用 useNavigate，替换 window.location.hash 直改（避免整页 hash 跳变绕过路由）
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { concepts, gradeSteps, practiceLadder, practiceProgress } from '../api/endpoints';
import type {
  ConceptCard,
  GradeStepsData,
  PracticeLadderData,
  PracticeProgressData,
  StepVerdict,
} from '../api/types';
import ConfirmDialog from '../components/ConfirmDialog';
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
  unclear: { text: '？ 这步我没看懂，再写清楚点？', tone: 'neutral' }, // P3：把「没读懂」的责任说清楚，给出下一步动作
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

/** 概念卡视图（select 屏「知识体系」面板）：定义 + 体系要点 + 易错点 + 典型例（默认折叠）+ 关联。 */
function ConceptCardView({ card }: { card: ConceptCard }): ReactNode {
  const [exampleOpen, setExampleOpen] = useState(false);
  const relatedNames = card.related.map((id) => snapshotNode(id)?.name ?? id);
  return (
    <article className="rounded-surface border border-line bg-raised p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-ink">{card.name}</h3>
        <Badge tone="neutral" size="sm">
          {card.chapter}
        </Badge>
      </header>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{card.definition}</p>
      <ul className="mt-2 space-y-1">
        {card.key_points.map((point, index) => (
          <li key={index} className="text-ui-sm leading-relaxed text-ink-soft">
            <span className="mr-1.5 text-accent-ink">·</span>
            {point}
          </li>
        ))}
      </ul>
      {card.common_errors.map((error, index) => (
        <p key={index} className="mt-1.5 text-ui-sm text-ink">
          <span className="text-ink-soft">易错：</span>
          {error}
        </p>
      ))}
      {/* P3：展开按钮与内容块补 id/aria-controls 关联，读屏可感知控制关系 */}
      <button
        type="button"
        id={`example-toggle-${card.kp_id}`}
        aria-controls={`example-panel-${card.kp_id}`}
        className="mt-2 min-h-8 text-ui-sm text-accent-ink underline-offset-2 hover:underline"
        aria-expanded={exampleOpen}
        onClick={() => setExampleOpen((open) => !open)}
      >
        {exampleOpen ? '收起典型例 ▲' : '看一道典型例（讲透）▼'}
      </button>
      {exampleOpen ? (
        <div id={`example-panel-${card.kp_id}`} className="mt-2 rounded-control border border-line bg-surface p-3">
          <p className="text-sm text-ink">{card.classic_example.stem}</p>
          <ol className="mt-2 space-y-1">
            {card.classic_example.steps.map((step, index) => (
              <li key={index} className="text-ui-sm leading-relaxed text-ink-soft">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {relatedNames.length > 0 ? (
        <p className="mt-2 text-ui-sm text-ink-soft">
          <span className="text-accent-ink">触类旁通：</span>
          {relatedNames.join('、')}
        </p>
      ) : null}
    </article>
  );
}

type Phase = 'select' | 'ladder' | 'summary';

/** 本组战报的单题记录（来自每题 gradeSteps 的 overall）。 */
interface GroupResult {
  correct: boolean;
  pass_ratio: number;
}

export default function PracticePage() {
  /** ?kp= 从技能树详情卡带来：预选其所在章节（v2.1 评审 P2：CTA 不断上下文）。 */
  const [params] = useSearchParams();
  const focusKp = params.get('kp');
  const focusChapter = focusKp
    ? (GRAPH_CHAPTERS.find((entry) => entry.kp_ids.includes(focusKp))?.name ?? null)
    : null;
  const [chapter, setChapter] = useState<string>(focusChapter ?? GRAPH_CHAPTERS[0]?.name ?? '');

  const [phase, setPhase] = useState<Phase>('select');
  const [busy, setBusy] = useState(false);

  const [ladder, setLadder] = useState<PracticeLadderData | null>(null);
  const [ladderIndex, setLadderIndex] = useState(0);
  const [results, setResults] = useState<GroupResult[]>([]);

  const [choice, setChoice] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [result, setResult] = useState<GradeStepsData | null>(null);
  /** 提示链层级：0 未开 · 1 方向(L1) · 2 思路(L2)；逐级解锁，重置于每题开始。 */
  const [hintLevel, setHintLevel] = useState(0);
  /** 重批进行中（P1 判后重试回路）：与 busy 分开，避免把重批计入战报流程的按钮态混淆。 */
  const [retrying, setRetrying] = useState(false);
  /** 阶梯中途退出确认（P1）：存在未提交内容时先确认再清空。 */
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 删步确认（P2）：记录待删除步下标，非空步先确认防丢。 */
  const [removeStepIndex, setRemoveStepIndex] = useState<number | null>(null);

  const [conceptCards, setConceptCards] = useState<ConceptCard[] | null>(null);
  const [conceptOpen, setConceptOpen] = useState(false);
  /** 概念卡失败态（P2 诚实失败）：不再静默降级为空集。 */
  const [conceptError, setConceptError] = useState(false);
  /** 概念卡重试计数：变化重新触发 fetch effect（P2）。 */
  const [conceptRetry, setConceptRetry] = useState(0);
  const [progress, setProgress] = useState<PracticeProgressData | null>(null);
  /** 进度失败态（P2 诚实失败）：区分「取不到」与「还没练过」。 */
  const [progressError, setProgressError] = useState(false);

  /** 断点行 / 总评卡的 DOM 锚点：结果到达后自动滚到位（峰值时刻 = 先看到断的那步）。 */
  const stepRowRefs = useRef(new Map<number, HTMLDivElement>());
  const summaryRef = useRef<HTMLDivElement | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  // P3：站内跳转统一走 react-router
  const navigate = useNavigate();

  const current = ladder?.items[ladderIndex] ?? null;

  useEffect(() => {
    if (!result) return;
    const breakStep = result.overall.first_break_step;
    const anchor =
      (breakStep !== null ? stepRowRefs.current.get(breakStep) : undefined) ?? summaryRef.current;
    anchor?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [result]);

  // 进度（#35）：select / summary 两个阶段展示；summary 进入时刷新，战报口径即时
  useEffect(() => {
    if (!activeSpaceId || (phase !== 'select' && phase !== 'summary')) return;
    let cancelled = false;
    setProgressError(false);
    practiceProgress(activeSpaceId)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch(() => {
        // 进度是增强信息，但静默降级会被误读成「还没练过」（P2 诚实失败）：标记失败态
        if (!cancelled) setProgressError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, phase]);

  // 概念卡（#36）：跟随所选章节；无卡空间（如 gz）静默降级为空集，不弹错误
  useEffect(() => {
    if (!activeSpaceId || phase !== 'select') return;
    let cancelled = false;
    setConceptCards(null);
    setConceptError(false);
    concepts(activeSpaceId, chapter)
      .then((data) => {
        if (!cancelled) setConceptCards(data.cards);
      })
      .catch(() => {
        // 失败不再伪装成「本章暂无概念卡」（P2 诚实失败）：标记错误态，面板给重试按钮
        if (!cancelled) setConceptError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSpaceId, chapter, phase, conceptRetry]);

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

  /** #34：组一梯子题（由易到难；已练过的自动排除，练完回流）。 */
  async function startLadder(): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || busy) return;
    setBusy(true);
    try {
      const data = await practiceLadder(spaceId, chapter);
      // 空梯兜底（P2）：组不出题时留在选章屏，不切 phase、不给一个空阶梯
      if (data.items.length === 0) {
        toast('这一章的题暂时取不到，换一章试试', 'warn');
        return;
      }
      setLadder(data);
      setLadderIndex(0);
      setResults([]);
      setChoice('');
      setSteps(['']);
      setResult(null);
      setHintLevel(0);
      setPhase('ladder');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitSteps(): Promise<void> {
    const spaceId = guardSpace();
    const item = ladder?.items[ladderIndex];
    if (!spaceId || !item || busy) return;

    // 选择题：把所选选项文本作为单步提交；其余题型走分步
    const payload = item.options ? [choice] : steps.map((step) => step.trim());
    if (payload.some((step) => step.length === 0)) {
      toast('把每一步都写点什么（不会的那步写「不会」也行）', 'warn');
      return;
    }

    setBusy(true);
    try {
      const data = await gradeSteps({ space_id: spaceId, item_id: item.item_id, steps: payload });
      setResult(data);
      setResults((prev) => [...prev, { correct: data.overall.correct, pass_ratio: data.overall.pass_ratio }]);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 重批（P1 判后重试回路）：断点步按提示改完重新提交。
   * 与 submitSteps 的区别：不把结果 push 进战报 results（战报对几题的口径以首次提交为准），
   * 只整体替换 result；服务端同题一小时 evidence 不重复计，verdict 正常返回。
   */
  async function resubmitSteps(): Promise<void> {
    const spaceId = guardSpace();
    const item = ladder?.items[ladderIndex];
    if (!spaceId || !item || busy || retrying) return;
    const payload = steps.map((step) => step.trim());
    if (payload.some((step) => step.length === 0)) {
      toast('把每一步都写点什么（不会的那步写「不会」也行）', 'warn');
      return;
    }
    setRetrying(true);
    try {
      const data = await gradeSteps({ space_id: spaceId, item_id: item.item_id, steps: payload });
      setResult(data); // 整体替换：重批后断点可能变化，断点步编辑逻辑对新 result 依旧成立
    } catch (error) {
      handleError(error);
    } finally {
      setRetrying(false);
    }
  }

  /** 下一题；最后一题完成后进战报（此时 #35 会自动刷新）。 */
  function nextItem(): void {
    if (!ladder) return;
    const next = ladderIndex + 1;
    if (next >= ladder.items.length) {
      setPhase('summary');
      return;
    }
    setLadderIndex(next);
    setChoice('');
    setSteps(['']);
    setResult(null);
    setHintLevel(0);
  }

  /** 阶梯中途退出（P1）：存在未提交内容时先确认，防误触丢掉已写的过程。 */
  function backToSelect(): void {
    if (result === null && (steps.some((step) => step.trim()) || choice.trim())) {
      setConfirmOpen(true);
      return;
    }
    doBackToSelect();
  }

  function doBackToSelect(): void {
    setConfirmOpen(false);
    setPhase('select');
    setLadder(null);
    setResults([]);
    setResult(null);
  }

  function updateStep(index: number, value: string): void {
    setSteps((prev) => prev.map((step, offset) => (offset === index ? value : step)));
  }

  /** 删步（P2 防丢）：被删步内容非空时先确认；空步直接删。 */
  function removeStep(index: number): void {
    if (steps[index]?.trim()) {
      setRemoveStepIndex(index);
      return;
    }
    doRemoveStep(index);
  }

  function doRemoveStep(index: number): void {
    setRemoveStepIndex(null);
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

  // ------------------------------------------------------------ 战报（summary）
  if (phase === 'summary') {
    const groupCount = results.length;
    const groupCorrect = results.filter((entry) => entry.correct).length;
    const groupAvg =
      groupCount > 0 ? results.reduce((sum, entry) => sum + entry.pass_ratio, 0) / groupCount : null;
    const chapterProgress = progress?.chapters.find((entry) => entry.chapter === ladder?.chapter) ?? null;
    return (
      <PageContainer width="prose">
        <PageHeader
          title="这组练完了"
          description={`${ladder?.chapter ?? chapter} · ${groupCount} 题由易到难走完，过程都记进了你的掌握度。`}
        />
        <div className="result-in mt-5 rounded-surface border border-line bg-surface p-4 shadow-card">
          <p className="text-sm text-ink">
            {groupCount} 题里 {groupCorrect} 题走到正确答案。
            {groupAvg !== null ? (
              <>
                平均通过 <PercentCount to={groupAvg} />% 的步骤。
              </>
            ) : null}
          </p>
          {chapterProgress ? (
            <p className="mt-1 text-ui-sm text-ink-soft">
              本章累计：练过 {chapterProgress.practiced_items} 题 · 提交 {chapterProgress.submissions} 次
              {chapterProgress.avg_pass_ratio !== null ? (
                <>
                  {' '}
                  · 平均通过率 <PercentCount to={chapterProgress.avg_pass_ratio} />%
                </>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-ui-sm text-ink-soft">
            断点已经记进你的图谱——复测和推荐会自动围着它转。
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={() => void startLadder()}>
            再来一组（自动避开刚练过的）
          </Button>
          {/* P1 战报复测 CTA：练完引导立刻验证断点补上没有（?mode=retest 由测评页支持） */}
          <Button variant="secondary" onClick={() => navigate('/assessment?mode=retest')}>
            补完做 2 道复测，验证效果
          </Button>
          <Button variant="secondary" onClick={backToSelect}>
            换一章
          </Button>
          <Button variant="ghost" onClick={() => navigate('/graph')}>
            看看技能树
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 阶梯作答（ladder）
  if (phase === 'ladder' && ladder && current) {
    const difficulty = Math.max(0, Math.min(5, current.difficulty));
    return (
      <PageContainer width="standard">
        <PageHeader
          title="分步写，我逐步批"
          description="一步一步写过程；卡住的那步写「不会」也可以——我会告诉你断点在哪、怎么补。"
          actions={
            <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
              {current.chapter} · 第 {ladderIndex + 1}/{ladder.items.length} 题
            </span>
          }
        />

        {/* 阶梯元信息：难度点 + 知识点 + 回流提示 */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-ui-sm text-ink-soft">
            难度{' '}
            <span className="text-accent-ink" aria-hidden="true">
              {'●'.repeat(difficulty)}
            </span>
            <span className="text-accent-ink opacity-30" aria-hidden="true">
              {'●'.repeat(5 - difficulty)}
            </span>
            <span className="sr-only">{current.difficulty}（最高 5）</span>
          </span>
          <span className="text-ui-sm text-ink-soft">知识点「{current.kp_name}」</span>
          {ladder.refilled ? <Badge tone="neutral" size="sm">第二轮：练过的题已回流</Badge> : null}
        </div>

        {/* 阶梯进度点：完成的亮、当前的呼吸、未到的暗 */}
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {ladder.items.map((entry, index) => (
            <span
              key={entry.item_id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                index < ladderIndex ? 'bg-accent' : index === ladderIndex ? 'bg-accent animate-pulse' : 'bg-ink/15',
              )}
            />
          ))}
        </div>
        <p className="sr-only">
          第 {ladderIndex + 1} 题，共 {ladder.items.length} 题，由易到难排列。
        </p>

        <div className="mt-5">
          <ItemCard
            item={current}
            value={choice}
            onChange={setChoice}
            disabled={busy || result !== null}
            placeholder="第一步怎么下手？"
          />
        </div>

        {/* 提示链：L1 方向 → L2 思路（知识点级，不泄题）；第三级就是逐步批改本身 */}
        {result === null ? (
          <div className="mt-3 rounded-surface border border-line bg-raised p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ui-sm text-ink-soft">卡住了？</span>
              {hintLevel === 0 ? (
                <Button variant="quiet" size="sm" onClick={() => setHintLevel(1)}>
                  给个方向
                </Button>
              ) : null}
              {hintLevel === 1 ? (
                <Button variant="quiet" size="sm" onClick={() => setHintLevel(2)}>
                  再给点思路
                </Button>
              ) : null}
              {hintLevel >= 2 ? (
                <span className="text-ui-sm text-accent-ink">
                  {/* P3：选择题不存在「写过程」，第三级提示改成可执行的下一步 */}
                  {current.options ? '选一个答案提交试试。' : '还下不了手？把过程写出来提交，逐步批改带你走。'}
                </span>
              ) : null}
            </div>
            {hintLevel >= 1 ? (
              <p className="mt-2 text-sm leading-relaxed text-ink">
                <span className="text-ink-soft">方向：</span>
                {current.approach}
              </p>
            ) : null}
            {hintLevel >= 2 ? (
              <p className="mt-1 text-sm leading-relaxed text-ink">
                <span className="text-ink-soft">思路：</span>
                {current.hint}
              </p>
            ) : null}
          </div>
        ) : null}

        {!current.options ? (
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
                  {/* P2 无障碍：textarea 无可见标签，补 aria-label；
                      P1 判后重试回路：判后仅断点步保持可编辑，学生能按提示补写；选择题不走分步，不受影响 */}
                  <textarea
                    className="mt-2 w-full resize-y rounded-control border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-70"
                    rows={2}
                    value={step}
                    aria-label={`第 ${index + 1} 步`}
                    disabled={busy || retrying || (result !== null && index + 1 !== result.overall.first_break_step)}
                    placeholder={index === 0 ? '第一步怎么下手？' : '这一步做了什么？'}
                    onChange={(event) => updateStep(index, event.target.value)}
                  />
                  {verdictRow ? (
                    <div className="verdict-in mt-2 space-y-1" style={{ animationDelay: `${index * 90 + 60}ms` }}>
                      <p className="text-sm text-ink">{verdictRow.feedback}</p>
                      {verdictRow.hint ? <p className="text-ui-sm text-accent-ink">下一步往哪想：{verdictRow.hint}</p> : null}
                      {/* P1 判后重试回路：断点步给重批入口，改完重新提交（不重复计战报） */}
                      {isBreak ? (
                        <Button variant="secondary" size="sm" disabled={busy || retrying} onClick={() => void resubmitSteps()}>
                          {retrying ? '正在重新批改…' : '按提示改这一步，重新批改'}
                        </Button>
                      ) : null}
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
            <Button variant="primary" disabled={busy || retrying} onClick={nextItem}>
              {ladderIndex + 1 >= ladder.items.length ? '做完这组，看战报' : '下一题'}
            </Button>
          )}
          <Button variant="secondary" disabled={busy || retrying} onClick={backToSelect}>
            换一章
          </Button>
          <Button variant="ghost" onClick={() => navigate('/graph')}>
            看看技能树
          </Button>
        </div>

        {/* P1/P3：中途退出与删步各用一枚确认框（用户主动操作才弹，符合「采集永不弹窗」纪律） */}
        <ConfirmDialog
          open={confirmOpen}
          title="这一题还没提交"
          description="换一章会丢掉已写的过程。要先留下来改完，还是确定离开？"
          confirmLabel="丢掉，换一章"
          onConfirm={doBackToSelect}
          onCancel={() => setConfirmOpen(false)}
        />
        <ConfirmDialog
          open={removeStepIndex !== null}
          title={`删除第 ${(removeStepIndex ?? 0) + 1} 步？`}
          description="这一步已经写了内容，删除后找不回来。"
          confirmLabel="删除"
          onConfirm={() => doRemoveStep(removeStepIndex ?? 0)}
          onCancel={() => setRemoveStepIndex(null)}
        />
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 选章（select；也是异常态兜底）
  const chapterProgress = progress?.chapters.find((entry) => entry.chapter === chapter) ?? null;
  return (
    <PageContainer width="prose">
      <PageHeader
        title="专项练习"
        description="挑一个模块，系统性地刷：由易到难一组题，逐步批改陪你走完每一步。"
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
        <Button variant="primary" disabled={busy || chapter.length === 0} onClick={() => void startLadder()}>
          {/* P3：删掉硬编码题数——梯子长度由服务端决定，文案不再承诺「5 题」 */}
          {busy ? '正在组题…' : '开始专项阶梯'}
        </Button>
      </div>

      {focusChapter && focusKp ? (
        <p className="mt-4 text-ui-sm text-accent-ink">
          已按你在技能树点的「{snapshotNode(focusKp)?.name ?? focusKp}」选好章节，直接开始就行。
        </p>
      ) : null}

      {/* 本章进度概览（#35）：P2 诚实失败——取不到进度时不再误显示「还没练过」 */}
      {chapterProgress ? (
        <p className="mt-4 text-ui-sm text-ink-soft">
          本章已练 {chapterProgress.practiced_items} 题 · 提交 {chapterProgress.submissions} 次
          {chapterProgress.avg_pass_ratio !== null ? (
            <>
              {' '}
              · 平均通过率 <PercentCount to={chapterProgress.avg_pass_ratio} />%
            </>
          ) : null}
        </p>
      ) : progressError ? (
        <p className="mt-4 text-ui-sm text-ink-soft">进度暂时取不到，稍后再回来看看。</p>
      ) : (
        <p className="mt-4 text-ui-sm text-ink-soft">这一章还没练过——第一组题会从最容易的开始。</p>
      )}

      <p className="mt-2 text-ui-sm text-ink-soft">
        每一步都会被认真对待：对的部分照实记账（答错但有进展，掌握度不会按全错拉低）。
      </p>

      {/* 概念知识体系（#36）：概念不是不给答案，而是给体系——先看懂，再动笔 */}
      <div className="mt-6 rounded-surface border border-line bg-surface">
        <button
          type="button"
          id="concept-toggle"
          aria-controls="concept-panel"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          aria-expanded={conceptOpen}
          onClick={() => setConceptOpen((open) => !open)}
        >
          <span className="text-sm font-medium text-ink">
            先看看「{chapter}」的知识体系
            {conceptCards !== null ? (
              <span className="ml-1 font-normal text-ink-soft">（{conceptCards.length} 张概念卡）</span>
            ) : null}
          </span>
          <span className="text-ui-sm text-ink-soft" aria-hidden="true">
            {conceptOpen ? '收起 ▲' : '展开 ▼'}
          </span>
        </button>
        {conceptOpen ? (
          <div id="concept-panel" className="space-y-3 border-t border-line px-4 pb-4 pt-3">
            {conceptCards === null ? <PageSkeleton label="正在取本章概念卡…" rows={2} /> : null}
            {/* P2 诚实失败：概念卡没取到时明说，并给重试入口（retry 计数重新触发 fetch） */}
            {conceptError ? (
              <div className="flex items-center gap-2">
                <p className="text-ui-sm text-ink-soft">概念卡没取到，稍后再试。</p>
                <Button variant="quiet" size="sm" onClick={() => setConceptRetry((count) => count + 1)}>
                  重试
                </Button>
              </div>
            ) : null}
            {conceptCards !== null && conceptCards.length === 0 ? (
              <p className="text-ui-sm text-ink-soft">本章暂无概念卡——直接开练，提示链会在卡住时给你方向。</p>
            ) : null}
            {conceptCards?.map((card) => (
              <ConceptCardView key={card.kp_id} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
