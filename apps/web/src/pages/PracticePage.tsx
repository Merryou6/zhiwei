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
 *
 * ── style-10「青蓝蓝图」迁移 P9.2（2026-10-11 第 4 轮）：本页视觉层按原型
 *    PAGES.practice（tempui/prototypes/style-10/index.html L2348-2523）逐段复现，
 *    **业务逻辑一行不改**（三段状态机 / 三个取数 useEffect / 提交与重批 handler /
 *    战报口径 / 确认框 / 导航目标全部原样）：
 *    ① 页头 SheetHead：eyebrow「PRACTICE / 分步书写（明判通路）」+ SHEET 10-08 + 需求 2.8 +
 *      h1「专项练习：把思路一步一步摊开」+ chip「T0 · 明判」；页头归页面自有
 *      （D24：Layout 的 PAGE_OWNED_HEAD 登记 '/practice'，外壳不再补第二份 h1）
 *    ② 阶段指示条（原型 segs L2357-2361）：flat 条 + 三段 chip（选章/练习/战报）+ 阶梯口径
 *    ③ STAGE1 01 选章（原型 L2363-2396）：章节卡网格（进度 kv / 未练过如实写 / 开始按钮）；
 *      02 本章概念卡（原型 L2379-2391：默认收起，展开是定义·关键点·易错点·典型例·触类旁通）
 *    ④ STAGE2 01 本章进度与阶梯（原型 L2456-2463：章节头 + ladder + hbar + 题干）+
 *      02 分步书写（原型 L2464-2469：步骤卡 .bp-step，data-verdict 三态 + 加一步）+
 *      03 逐步批改 / 04 提示（逐级解锁）（原型 L2470-2485 的 split 两栏）
 *    ⑤ STAGE3 01 战报（原型 L2399-2417：全对走 stamp-ok；measure 读数 + 出口）
 *
 * 【四态（规范 §7 practice 行，区域级）】
 *   章节 empty（未练过）→ EmptyState 虚线空盒（「未练过 · 第一组从最容易的开始」，不编 0%）
 *   进度取数失败 → 如实写「拿不到就是拿不到」（既有诚实失败口径，bp-note--alert）
 *   概念卡取数失败 → Stamp 红章 + 真重试（复用既有 conceptRetry 计数机制，不新开请求路径）
 *   无空间 → 既有 guardSpace 的 toast + 不发起请求（R19 取证口径）
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
import EmptyState from '../components/EmptyState';
import ItemCard from '../components/ItemCard';
import { Badge, Button } from '../components/ui';
import { useBlueprintTier } from '../components/blueprint/Board';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import Stamp from '../components/blueprint/Stamp';
import { GRAPH_CHAPTERS, snapshotNode } from '../data/graphSnapshot';
import MathSymbolPad from '../components/MathSymbolPad';
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

/** 图号与需求号（原型 sheetHead L2354 的 SHEET 10-08 / 需求 2.8）。 */
const SHEET_NO = '10-08';
const SECTION_NO = '2.8';

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
    <article className="bp-flat p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2.5">
        <h4 className="font-disp text-ui-sm tracking-tight text-ink">{card.name}</h4>
        <Badge>{card.chapter}</Badge>
      </header>
      <p className="bp-note bp-note--ok mt-0">
        <b className="tok block">定义</b>
        {card.definition}
      </p>
      <h5 className="mb-1.5 mt-3 font-mono text-tok uppercase tracking-widest text-ink-soft">关键点</h5>
      <ul className="bp-tick-list">
        {card.key_points.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
      <h5 className="mb-1.5 mt-3 font-mono text-tok uppercase tracking-widest text-ink-soft">易错点</h5>
      <ul className="bp-tick-list">
        {card.common_errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
      {/* P3：展开按钮与内容块补 id/aria-controls 关联，读屏可感知控制关系 */}
      <button
        type="button"
        id={`example-toggle-${card.kp_id}`}
        aria-controls={`example-panel-${card.kp_id}`}
        className="mt-3 min-h-8 text-ui-sm text-accent-ink underline-offset-2 hover:underline"
        aria-expanded={exampleOpen}
        onClick={() => setExampleOpen((open) => !open)}
      >
        {exampleOpen ? '收起典型例（含完整步骤） ▲' : '看一道典型例（讲透）▼'}
      </button>
      {exampleOpen ? (
        <div id={`example-panel-${card.kp_id}`} className="bp-panel mt-2 p-3">
          <p className="text-body-sm text-ink">{card.classic_example.stem}</p>
          <ol className="mt-2 space-y-1">
            {card.classic_example.steps.map((step, index) => (
              <li key={index} className="font-mono text-ui-sm leading-relaxed text-ink-soft">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {relatedNames.length > 0 ? (
        <p className="mt-2.5 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">
          触类旁通：<span className="text-accent-ink">{relatedNames.join('、')}</span>
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

  /** 断点行 / 总评卡的 DOM 锚点：结果到达后自动滚到位（峰值时刻 = 先看到断的那步）。
   *  ⚠ P9.2：步骤行由 div 改为 ol>li（原型 .steps 是列表语义），锚点类型随之取 HTMLElement
   *  —— 只改类型标注，取值与 scrollIntoView 行为逐字不变。 */
  const stepRowRefs = useRef(new Map<number, HTMLElement>());
  const summaryRef = useRef<HTMLDivElement | null>(null);
  /** 可编辑步骤输入框本体（1 基下标，与 stepRowRefs 同口径）：符号键盘光标插入的目标。 */
  const stepFieldRefs = useRef(new Map<number, HTMLTextAreaElement>());
  /** 最后聚焦的步骤下标（0 基）：符号键盘插入优先落点；判定后自动回退到可编辑步。 */
  const activeStepRef = useRef(0);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  // P3：站内跳转统一走 react-router
  const navigate = useNavigate();
  const tier = useBlueprintTier();

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

  /**
   * 符号键盘 → 步骤输入框的光标插入（2026-10-12：面板从整题框迁到分步书写区）。
   * 语义与 ItemCard.insertSymbol 一致：selectionStart/End 生效，插入后光标落回符号之后。
   * 落点 = 最后聚焦的可编辑步；无聚焦/不可编辑时回退到第一个可编辑步（判后即断点步）。
   * 写入走函数式 setSteps：连点符号时每次都基于最新值累加，不互相覆盖。
   */
  function insertStepSymbol(symbol: string): void {
    const breakStep = result?.overall.first_break_step ?? null;
    const isEditable = (index: number): boolean =>
      !(result !== null && index + 1 !== breakStep);
    let target = activeStepRef.current;
    if (!isEditable(target) || !stepFieldRefs.current.has(target + 1)) {
      target = steps.findIndex((_, index) => isEditable(index) && stepFieldRefs.current.has(index + 1));
      if (target < 0) return;
    }
    const element = stepFieldRefs.current.get(target + 1);
    if (!element) {
      setSteps((prev) => prev.map((step, offset) => (offset === target ? (step ?? '') + symbol : step)));
      return;
    }
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    setSteps((prev) =>
      prev.map((step, offset) => {
        if (offset !== target) return step;
        const cur = step ?? '';
        return cur.slice(0, start) + symbol + cur.slice(end);
      }),
    );
    // 插入后把光标放回符号之后（异步等 DOM 更新）
    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + symbol.length;
      element.setSelectionRange(cursor, cursor);
    });
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

  /** 页头（原型 sheetHead L2354）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="PRACTICE / 分步书写（明判通路）"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="专项练习：把思路一步一步摊开"
      sub="这一条通路与测评的静默相反：每步都给明确判定。断点在哪一步，就只改那一步。"
      chips={<Badge tone="warning">T0 · 明判</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  /** 阶段指示条（原型 segs L2357-2361）：三段单向推进 + 阶梯口径。 */
  const stepper = (
    <div className="bp-flat mb-6 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3.5">
        {(
          [
            ['01', '选章', 'select'],
            ['02', '练习', 'ladder'],
            ['03', '战报', 'summary'],
          ] as const
        ).map(([no, label, key]) => (
          <Badge key={no} tone={phase === key ? 'accent' : 'neutral'}>
            {`${no} · ${label}`}
          </Badge>
        ))}
        <span className="tok ml-auto text-ink-soft">阶梯：由易到难</span>
      </div>
    </div>
  );

  // ------------------------------------------------------------ 战报（summary）
  if (phase === 'summary') {
    const groupCount = results.length;
    const groupCorrect = results.filter((entry) => entry.correct).length;
    const groupAvg =
      groupCount > 0 ? results.reduce((sum, entry) => sum + entry.pass_ratio, 0) / groupCount : null;
    // 完成奖励（awwwards「reward attention」→ 原型 stamp-ok L2404-2405）：整组全对才出现的定格
    const allRight = groupCount > 0 && groupCorrect === groupCount;
    const chapterProgress = progress?.chapters.find((entry) => entry.chapter === ladder?.chapter) ?? null;
    return (
      <>
        {pageHead}
        {stepper}
        <SheetBlock
          no="01"
          title="战报"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 3 / 3</span>}
        >
          <div className={cn('result-in p-4', allRight ? 'bp-stamp-ok' : 'bp-panel')}>
            {allRight ? (
              <p className="bp-band-4-t mb-3 font-mono text-tok uppercase tracking-widest">
                这一组每步都过了 · ALL STEPS CLEARED
              </p>
            ) : null}
            {/* 战报只报过程（原型 L2406-2411）：走到正确答案几题、平均通过率、本章累计 —— 不出现评价词。 */}
            <div className="grid grid-cols-2 gap-3 sheet:grid-cols-4">
              <div className="bp-measure">
                <span className="tok">走到正确答案</span>
                <span className="big-num">
                  {groupCorrect} / {groupCount}
                </span>
              </div>
              <div className="bp-measure">
                <span className="tok">平均通过步骤</span>
                <span className="big-num">
                  {groupAvg !== null ? (
                    <>
                      <PercentCount to={groupAvg} />%
                    </>
                  ) : (
                    <span className="text-ui-sm text-ink-soft">尚无可用的数</span>
                  )}
                </span>
              </div>
              <div className="bp-measure">
                <span className="tok">本章练过</span>
                <span className="big-num">
                  {chapterProgress ? chapterProgress.practiced_items : '尚无可用的数'}
                </span>
                <span className="tok">题</span>
              </div>
              <div className="bp-measure">
                <span className="tok">本章提交</span>
                <span className="big-num">
                  {chapterProgress ? chapterProgress.submissions : '尚无可用的数'}
                </span>
                <span className="tok">次</span>
              </div>
            </div>
            <p className="bp-note">
              {ladder?.chapter ?? chapter} · {groupCount} 题由易到难走完，过程都记进了你的掌握度。
              断点已经记进你的图谱——复测和推荐会自动围着它转。
            </p>
            <div className="flex flex-wrap items-center gap-3">
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
          </div>
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 阶梯作答（ladder）
  if (phase === 'ladder' && ladder && current) {
    const ladderTotal = ladder.items.length;
    const ladderStep = Math.min(ladderIndex + 1, ladderTotal);
    const firstBreak = result?.overall.first_break_step ?? null;
    return (
      <>
        {pageHead}
        {stepper}
        <SheetBlock
          no="01"
          title="本章进度与阶梯"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 2 / 3</span>}
        >
          <div className="bp-panel p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <span className="tok">章节</span>
                <h3 className="mt-0.5 font-disp text-title-sm tracking-tight text-ink">
                  {current.chapter}
                </h3>
                <span className="tok">
                  {`第 ${ladderIndex + 1} 题 / 共 ${ladderTotal} 题 · 难度 ${current.difficulty}（最高 5）`}
                </span>
              </div>
              {/* 阶梯（原型 ladder L2422-2425）：第几阶一眼可见，当前阶走琥珀。 */}
              <div
                className="bp-ladder"
                role="img"
                aria-label={`阶梯进度：第 ${ladderStep} 阶，共 ${ladderTotal} 阶`}
              >
                {Array.from({ length: ladderTotal }, (_, index) => (
                  <i
                    key={index}
                    style={{ height: `${10 + index * 3}px` }}
                    data-on={index < ladderStep - 1 ? '1' : '0'}
                    data-cur={index === ladderStep - 1 ? '1' : '0'}
                  />
                ))}
              </div>
            </div>
            <div
              className="bp-hbar"
              role="img"
              aria-label={`阶梯第 ${ladderStep} 阶，共 ${ladderTotal} 阶`}
            >
              <i style={{ width: `${Math.round((ladderStep / Math.max(ladderTotal, 1)) * 100)}%` }} />
            </div>
            <p className="flex flex-wrap items-center gap-2.5 text-ui-sm text-ink-soft">
              知识点「{current.kp_name}」
              {ladder.refilled ? <Badge>第二轮：练过的题已回流</Badge> : null}
            </p>
            <div className="mt-3.5">
              {/* 2026-10-12：解答题不再渲染整题作答框（payload 只走分步 steps，整题框是
                  「写了不参与批改」的死框且与 STEP 01 提示文案相同造成误导）——只留题干；
                  符号键盘随迁至 02 分步书写区。选择题 radio 分支不受影响（payload=[choice]）。 */}
              <ItemCard
                item={current}
                value={choice}
                onChange={setChoice}
                disabled={busy || result !== null}
                answerVisible={Boolean(current.options)}
                placeholder="第一步怎么下手？"
              />
            </div>
          </div>
        </SheetBlock>

        <SheetBlock
          no="02"
          title="分步书写"
          right={<Badge>{`上限 ${MAX_STEPS} 步`}</Badge>}
        >
          {!current.options ? (
            <>
              <ol className="bp-steps" aria-label="作答步骤">
                {steps.map((step, index) => {
                  const verdictRow = result?.step_results.find((row) => row.index === index + 1);
                  const isBreak = firstBreak === index + 1 && verdictRow?.verdict !== 'pass';
                  /** 判后仅断点步保持可编辑（P1 重试回路）；其余步按原型 L2432-2434 落为静态文本。 */
                  const locked = result !== null && index + 1 !== firstBreak;
                  return (
                    <li
                      key={index}
                      ref={(el) => {
                        if (el) stepRowRefs.current.set(index + 1, el);
                        else stepRowRefs.current.delete(index + 1);
                      }}
                      className={cn('bp-step', isBreak && 'break-flash')}
                      data-verdict={verdictRow?.verdict ?? ''}
                      data-lock={locked ? '1' : '0'}
                      data-break={isBreak ? '1' : '0'}
                      style={
                        isBreak
                          ? ({ '--break-flash-from': bandVeilHex('待巩固', 0.2) } as CSSProperties)
                          : undefined
                      }
                    >
                      <span className="bp-step__no">{`STEP ${String(index + 1).padStart(2, '0')}`}</span>
                      <span className="flex min-w-0 flex-col gap-2">
                        {locked ? (
                          <span className="font-mono text-body-sm leading-relaxed text-ink">
                            {step || '（空）'}
                          </span>
                        ) : (
                          /* P2 无障碍：textarea 无可见标签，补 aria-label；
                             P1 判后重试回路：判后仅断点步保持可编辑，学生能按提示补写 */
                          <textarea
                            className="bp-field w-full resize-y px-3 py-2 text-sm text-ink outline-none focus:border-accent disabled:opacity-70"
                            rows={2}
                            value={step}
                            aria-label={`第 ${index + 1} 步`}
                            disabled={
                              busy || retrying || (result !== null && index + 1 !== firstBreak)
                            }
                            placeholder={index === 0 ? '第一步怎么下手？' : '这一步做了什么？'}
                            ref={(el) => {
                              if (el) stepFieldRefs.current.set(index + 1, el);
                              else stepFieldRefs.current.delete(index + 1);
                            }}
                            onFocus={() => {
                              activeStepRef.current = index;
                            }}
                            onChange={(event) => updateStep(index, event.target.value)}
                          />
                        )}
                        {verdictRow ? (
                          <span
                            className="verdict-in flex flex-col gap-1"
                            style={{ animationDelay: `${index * 90 + 60}ms` }}
                          >
                            <span className="text-body-sm text-ink">{verdictRow.feedback}</span>
                            {verdictRow.hint ? (
                              <span className="text-ui-sm text-accent-ink">
                                下一步往哪想：{verdictRow.hint}
                              </span>
                            ) : null}
                            {/* P1 判后重试回路：断点步给重批入口，改完重新提交（不重复计战报） */}
                            {isBreak ? (
                              <Button
                                className="self-start"
                                variant="secondary"
                                size="sm"
                                disabled={busy || retrying}
                                onClick={() => void resubmitSteps()}
                              >
                                {retrying ? '正在重新批改…' : '按提示改这一步，重新批改'}
                              </Button>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                      <span className="bp-step__acts flex flex-wrap items-center justify-end gap-1.5">
                        {verdictRow ? (
                          <Badge
                            tone={VERDICT_LABEL[verdictRow.verdict].tone}
                            className="verdict-in"
                            style={{ animationDelay: `${index * 90}ms` }}
                          >
                            {VERDICT_LABEL[verdictRow.verdict].text}
                          </Badge>
                        ) : null}
                        {locked ? <Badge tone="outline">已锁定</Badge> : null}
                        {result === null && steps.length > 1 ? (
                          <>
                            <Button
                              variant="quiet"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveStep(index, -1)}
                              aria-label="上移"
                            >
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
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => removeStep(index)}
                              aria-label="删除该步"
                            >
                              ×
                            </Button>
                          </>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {/* 符号键盘（2026-10-12 自整题框迁入）：光标插入最后聚焦的可编辑步，
                  判后自动落断点步；busy/重批期间整体禁用，与步骤输入框 disabled 同口径。 */}
              <div className="mt-3.5">
                <MathSymbolPad
                  disabled={busy || retrying}
                  onInsert={insertStepSymbol}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                {steps.length < MAX_STEPS ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || result !== null}
                    onClick={() => setSteps((prev) => [...prev, ''])}
                  >
                    + 加一步
                  </Button>
                ) : null}
                <span className="tok text-ink-soft">
                  {`${steps.length} / ${MAX_STEPS} 步${steps.length >= MAX_STEPS ? ' · 已到上限' : ''}`}
                </span>
              </div>
            </>
          ) : (
            <p className="bp-note">
              选择题：以所选选项作为单步提交。本题池里没有可下发的正确项——判定随批改一起回来，前端不预先知道哪个选项对。
            </p>
          )}
        </SheetBlock>

        {/* 03 逐步批改 / 04 提示（逐级解锁）：原型 L2470-2485 的 split 两栏。 */}
        <div className="grid grid-cols-1 items-start gap-5 narrow:grid-cols-[minmax(0,1fr)_15rem]">
          <SheetBlock no="03" title="逐步批改">
            <div className="bp-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={result ? 'warning' : 'neutral'}>
                  {result
                    ? `已批改 ${result.step_results.length} 步`
                    : '尚未批改'}
                </Badge>
                <span className="tok text-ink-soft">
                  四类判定 · 这步对了 / 运算失误 / 思路断点 / 没看懂
                </span>
              </div>
              {result ? (
                <dl className="mt-3">
                  {result.step_results.map((row) => (
                    <div className="bp-kv" key={row.index}>
                      <dt>{`STEP ${String(row.index).padStart(2, '0')}`}</dt>
                      <dd>{VERDICT_LABEL[row.verdict].text}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="bp-note">
                  写完一步就提交一步。批改只告诉你这一步的判定和下一步往哪想，不给整题答案。
                </p>
              )}

              {/* 总评（入场 + 通过率数字爬升；锚点供自动滚动） */}
              {result ? (
                <div ref={summaryRef} className="result-in bp-panel mt-3.5 p-4">
                  <p className="text-body-sm text-ink">
                    {result.overall.correct ? '终点抵达了正确答案。' : '这次没能走到正确答案，但过程都记下了。'}
                    {result.overall.first_break_step !== null
                      ? `断点在第 ${result.overall.first_break_step} 步。`
                      : '每一步都过了。'}
                  </p>
                  <p className="mt-1 text-ui-sm text-ink-soft">
                    通过{' '}
                    {result.overall.pass_ratio === 1 ? (
                      '全部'
                    ) : (
                      <>
                        <PercentCount to={result.overall.pass_ratio} />%
                      </>
                    )}{' '}
                    步骤 · 知识点「{result.overall.kp_name}」
                    {result.evidence_written ? ' · 本次已记入掌握度' : ' · 这道题刚才批过（同一小时不重复计）'}
                  </p>
                </div>
              ) : null}

              <div className="mt-3.5 flex flex-wrap items-center gap-3">
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
            </div>
          </SheetBlock>

          <aside className="bp-flat p-4">
            <h3 className="font-mono text-tok uppercase tracking-widest text-ink-soft">
              04 提示（逐级解锁）
            </h3>
            {/* 提示链：L1 方向 → L2 思路（知识点级，不泄题）；第三级就是逐步批改本身。 */}
            <div className="bp-seg bp-seg--vertical mt-3" role="radiogroup" aria-label="提示级别">
              <label>
                <input
                  type="radio"
                  name="hint-level"
                  value="1"
                  checked={hintLevel >= 1}
                  disabled={result !== null}
                  onChange={() => setHintLevel(1)}
                />
                <span className="bp-seg__n">L1</span>
                <span>给个方向</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="hint-level"
                  value="2"
                  checked={hintLevel >= 2}
                  disabled={hintLevel < 1 || result !== null}
                  onChange={() => setHintLevel(2)}
                />
                <span className="bp-seg__n">L2</span>
                <span>再给点思路</span>
              </label>
            </div>
            {hintLevel >= 1 ? (
              <p className="bp-note bp-note--ok">
                <b className="tok block">方向</b>
                {current.approach}
              </p>
            ) : null}
            {hintLevel >= 2 ? (
              <p className="bp-note bp-note--ok">
                <b className="tok block">思路</b>
                {current.hint}
              </p>
            ) : null}
            <p className="tok mt-3 text-ink-soft">
              {hintLevel >= 2
                ? /* P3：选择题不存在「写过程」，第三级提示改成可执行的下一步 */
                  current.options
                  ? '第三级 · 选一个答案提交试试。'
                  : '第三级 · 还下不了手？把过程写出来提交，逐步批改带你走。'
                : hintLevel === 1
                  ? '往下还有一级：再给点思路。'
                  : '还没有解锁任何一级 · 卡住时可以只要方向'}
            </p>
            <p className="tok mt-2 text-ink-soft">任何一级都不含本题答案</p>
          </aside>
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
      </>
    );
  }

  // ------------------------------------------------------------ 选章（select；也是异常态兜底）
  return (
    <>
      {pageHead}
      {stepper}
      <SheetBlock
        no="01"
        title="选章"
        right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
      >
        {focusChapter && focusKp ? (
          <p className="bp-note mt-0 mb-4">
            已按你在技能树点的「{snapshotNode(focusKp)?.name ?? focusKp}」选好章节，直接开始就行。
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 narrow:grid-cols-2 sheet:grid-cols-3">
          {GRAPH_CHAPTERS.map((entry) => {
            const entryProgress = progress?.chapters.find((row) => row.chapter === entry.name) ?? null;
            const on = entry.name === chapter;
            return (
              <article
                key={entry.name}
                className={cn('bp-panel flex flex-col p-4', on ? 'border-accent' : '')}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2.5">
                  <h3 className="font-disp text-ui-sm tracking-tight text-ink">{entry.name}</h3>
                  <Badge tone={on ? 'accent' : 'neutral'}>{`${entry.kp_ids.length} 个知识点`}</Badge>
                </div>
                {entryProgress ? (
                  <dl className="flex-1">
                    <div className="bp-kv">
                      <dt>练过</dt>
                      <dd className="num-mono">{entryProgress.practiced_items} 题</dd>
                    </div>
                    <div className="bp-kv">
                      <dt>提交次数</dt>
                      <dd className="num-mono">{entryProgress.submissions} 次</dd>
                    </div>
                    <div className="bp-kv">
                      <dt>平均通过率</dt>
                      <dd className="num-mono">
                        {entryProgress.avg_pass_ratio !== null ? (
                          <>
                            <PercentCount to={entryProgress.avg_pass_ratio} />%
                          </>
                        ) : (
                          '尚无可用的数'
                        )}
                      </dd>
                    </div>
                  </dl>
                ) : progressError ? (
                  /* P2 诚实失败：进度取不到时不再误显示「还没练过」 */
                  <div className="flex-1">
                    <p className="bp-note bp-note--alert mt-0">
                      这一章的练习进度取数失败：拿不到就是拿不到，我不会用 0% 或「—」假装它是个数。
                    </p>
                  </div>
                ) : (
                  <div className="flex-1">
                    <EmptyState
                      compact
                      tag="NOT PRACTICED"
                      title="未练过"
                      hint="第一组从最容易的开始。这一章还没有任何练习证据，所以没有通过率可给。"
                    />
                  </div>
                )}
                <Button
                  className="mt-3.5 self-start"
                  variant={on ? 'primary' : 'secondary'}
                  onClick={() => setChapter(entry.name)}
                >
                  {on ? '已选中这一章' : '选这一章'}
                </Button>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={busy || chapter.length === 0}
            onClick={() => void startLadder()}
          >
            {/* P3：删掉硬编码题数——梯子长度由服务端决定，文案不再承诺「5 题」 */}
            {busy ? '正在组题…' : '开始这一组（当前章节）'}
          </Button>
          <span className="tok text-ink-soft">{`当前章节：${chapter}`}</span>
        </div>
        <p className="bp-note">
          每一步都会被认真对待：对的部分照实记账（答错但有进展，掌握度不会按全错拉低）。
        </p>
      </SheetBlock>

      {/* 概念知识体系（#36）：概念不是不给答案，而是给体系——先看懂，再动笔 */}
      <SheetBlock
        no="02"
        title="本章概念卡"
        right={conceptCards !== null ? <Badge>{`${conceptCards.length} 张`}</Badge> : null}
      >
        <div className="bp-flat">
          <button
            type="button"
            id="concept-toggle"
            aria-controls="concept-panel"
            className={cn('bp-blk-sum', conceptOpen && 'bp-blk-sum--open')}
            aria-expanded={conceptOpen}
            onClick={() => setConceptOpen((open) => !open)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="tok">{conceptOpen ? 'COLLAPSE' : 'EXPAND'} · 概念卡（默认收起）</span>
              <span>{`先看看「${chapter}」的知识体系`}</span>
            </span>
            <span className="tok" aria-hidden="true">
              {conceptOpen ? '收起 ▲' : '展开 ▼'}
            </span>
          </button>
          {conceptOpen ? (
            <div id="concept-panel" className="space-y-3 border-t border-line px-4 pb-4 pt-3">
              {/* 加载态：静态发丝斜线骨架（规范 5.10），不 shimmer */}
              {conceptCards === null && !conceptError ? (
                <p className="tok flex items-center gap-2 text-ink-soft">
                  <span className="bp-hatch inline-block h-3 w-10" aria-hidden="true" />
                  正在取本章概念卡…（取数中 · 不伪造内容）
                </p>
              ) : null}
              {/* 失败态（规范 5.8 / D15c）：真重试复用既有 conceptRetry 计数，不新开请求路径 */}
              {conceptError ? (
                <Stamp
                  reason="这一章的概念卡没能取回来。它和「这一章没有概念卡」不是一回事——重试一次通常就能取到；一直取不到也可以先直接开练，提示链会在卡住时给你方向。"
                  onRetry={() => setConceptRetry((count) => count + 1)}
                  alt={{ label: '回学习空间', to: '/spaces' }}
                />
              ) : null}
              {/* 空集合（规范 5.9）：只引导、不重试 */}
              {conceptCards !== null && conceptCards.length === 0 ? (
                <EmptyState
                  compact
                  tag="NO CONCEPT CARDS"
                  title="本章暂无概念卡"
                  hint="直接开练就行——提示链会在卡住时给你方向，概念卡是补充不是前提。"
                />
              ) : null}
              {conceptCards?.map((card) => <ConceptCardView key={card.kp_id} card={card} />)}
            </div>
          ) : null}
        </div>
      </SheetBlock>
    </>
  );
}
