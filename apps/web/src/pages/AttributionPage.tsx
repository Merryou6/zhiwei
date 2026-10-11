/**
 * 页 7 · 归因（向导态 + 结果态；P0 #6 #7 #9，答辩主战场）
 *
 * 契约：#12 POST /api/error/classify（confidence<0.6 → clarify，禁止采纳）
 *       #13 POST /api/attribution/analyze（procedural_slip / misreading 前端不得调用）
 *       #14 GET /api/attribution/{attribution_id}（刷新 / 状态同步）
 *       #15 POST /api/attribution/verify（对错由服务端判定）
 *       #16 POST /api/agent/reject（反驳 → 追加再验证题）
 *       #17 POST /api/plan/generate（处方）
 * 交互纪律（PRD §6 + 契约 §7 前置）：
 *   - 先复述错误（evidence 展示）再判定；五类枚举卡片常显，命中项高亮；
 *   - clarify（低置信）→ 就地追问输入框，学生补充后**重发 classify**（不自动 analyze）；
 *   - adopted 但 direction=none（procedural_slip / misreading）→ 明示「这类小失误不用归因」且**不出现 analyze 按钮**；
 *   - 结果态：回溯路径纵向步进条 + 根因高亮 + 错误类型徽标 + suspect 前三 + 验证区 + **反驳按钮常驻**；
 *   - 耗尽（verification_item=null 且未 verified）→ 诚实兜底文案；rejected_by_student → 「已记录你的反驳」徽标。
 *
 * ─────────────────────────────────────────────────────────────────────
 * P3（2026-09-25）信息架构重做（结论 → 为什么 → 怎么找到的 → 其它可能 → 验证 → 处方）
 * 保留其结论：结论必须是页面的第一眼，处方只在验证通过后出现。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P9.4（2026-10-11 第 4 轮）：视觉层按原型 PAGES.attribution
 *   （tempui/prototypes/style-10/index.html L2604-2760）逐段复现，**业务逻辑一行不改**
 *   （四步向导 / classify 与 analyze 的分叉 / direction=none 不出现 analyze / 验证与反驳
 *   链路 / 处方生成 / 取数 effect 与依赖数组 / Link 目标 / toast 话术全部原样）：
 *   ① 页头 SheetHead：eyebrow「ATTRIBUTION / 沿先修链回溯」+ SHEET 10-10 + 需求 2.10 +
 *     h1「错题归因：往上找真正卡住你的那一环」+ chip「T0 · 回溯」；页头归页面自有
 *     （D24：Layout 的 PAGE_OWNED_HEAD 登记 '/attribution'，外壳不再补第二份 h1）
 *   ② 步骤条（原型 stepper L2611-2615）：01 挑一道错题 / 02 复述确认 / 03 错误分类 /
 *     04 分流·深挖 / 05 结果与验证 —— 当前步高亮 + aria-current="step"，已过步走平色
 *   ③ STEP1 01 挑一道错题（原型 L2625-2649）：左栏「从本会话的试卷错题里挑」（错题表 +
 *     「N 题可带出 / 暂无缓存」chip；缓存为空 → 空盒如实说没有并给两条出路）+
 *     右栏「或者手动填一道」（题干 / 你的作答 / 知识点三填，走同一套流程）
 *   ④ STEP2 02 复述确认（原型 L2651-2665）：复述框（题目 / 你的作答 / 知识点）+
 *     两个动作（就是这么写的，看看属于哪类 / 换一道）
 *   ⑤ STEP3 03 错误分类（原型 L2667-2688）：低置信就地追问（我已拿不准就不硬猜）；
 *     采纳后出「先复述你写的这一步」（含置信度读数与证据）+ 五类闭集清单（命中项高亮）
 *   ⑥ STEP4 04 分流（原型 L2691-2706）：direction=none → 明说不深挖并给出路；
 *     否则给出「沿先修链往上回溯」的起步键
 *   ⑦ STEP5 05+01~04 结果（原型 L2709-2756）：根因块（编号 / 层数 / 状态 / 为什么）+
 *     回溯路径（.bp-path 链，根因那一节红框 + 「根因在此」）+ 候选根因排序（.bp-cands
 *     贡献度条）+ 验证环节 + 处方（验证通过才给）+ 反驳常驻在页脚
 *
 * 【四态（规范 §7 attribution 行，整页级）】
 *   loading（带 ?attribution_id= 回显中）→ SkeletonLines + 「载入该次归因结果」分节
 *   empty（本会话没有可归因的错题）→ EmptyState（如实说没有，并给「去传一张卷子」的出路）
 *   error（该次归因结果取不到）→ Stamp 红章 + **真重试**（D15c 同口径：重发同一个 #14 请求）
 *     —— 不给半截结论：取不到就明说取不到，不拿向导态冒充结果
 *   无空间 → guardSpace 的既有 toast + 重定向语义一行不改（R19 取证口径）
 *
 * 【D15c 同口径的最小新增（表现层，留痕）】回显 effect 的 catch 里加一个 `viewFailed`
 *   置位（接口调用、cancelled 清理、依赖数组 [attributionId] 逐字符未动）；重试走
 *   同一个 getAttribution(attributionId)。与 P6 /report、P7 /graph、P9.2 /paper 同一口径。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { analyze, classify, generatePlan, getAttribution, reject, verify } from '../api/endpoints';
import type { AttributionView, ErrorTypeValue } from '../api/types';
import ItemCard from '../components/ItemCard';
import Stamp from '../components/blueprint/Stamp';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import { useBlueprintTier } from '../components/blueprint/Board';
import EmptyState from '../components/EmptyState';
import {
  Badge,
  Button,
  FormField,
  Select,
  Textarea,
  buttonVariants,
} from '../components/ui';
import { GRAPH_NODES, kpName } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { percent } from '../lib/format';
import { scrollBehavior } from '../lib/motion';
import {
  ERROR_TYPES,
  ERROR_TYPE_LABEL,
  ERROR_TYPE_NOTE,
  PHRASES,
  UI_TEXT,
} from '../lib/phrases';
import { SPACES_PATH, readPaperWrong } from '../router';
import { useAttributionStore } from '../stores/attribution';
import type { AttributionDraft } from '../stores/attribution';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

const KP_OPTIONS = GRAPH_NODES.map((node) => ({
  id: node.id,
  label: `${node.chapter} / ${node.name}`,
}));

/** 结果态里两个可跳转区块的 id（Hero 的「去验证」用它滚动定位）。 */
const VERIFY_ANCHOR_ID = 'attribution-verify';
const PLAN_ANCHOR_ID = 'attribution-plan';

/** 图号与需求号（原型 sheetHead L2608 的 SHEET 10-10 / 需求 2.10）。 */
const SHEET_NO = '10-10';
const SECTION_NO = '2.10';

/** 步骤条的五步（原型 stepper L2612；本工程把「错误分类 / 分流」两步分别对应
 *  clarify|adopted 与 direction 分叉，步序不编造、不加步）。 */
const WIZARD_STEPS = [
  ['01', '挑一道错题'],
  ['02', '复述确认'],
  ['03', '错误分类'],
  ['04', '分流 / 深挖'],
  ['05', '结果与验证'],
] as const;

export default function AttributionPage() {
  const [params] = useSearchParams();
  const attributionId = params.get('attribution_id');
  const navigate = useNavigate();

  const store = useAttributionStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  const [stem, setStem] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [kpId, setKpId] = useState(KP_OPTIONS[0].id);
  const [clarifyInput, setClarifyInput] = useState('');
  const [verifyAnswer, setVerifyAnswer] = useState('');
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  /** 带 ?attribution_id= 进入时的回显等待（批三：此前会先闪一屏空白起始页）。 */
  const [viewLoading, setViewLoading] = useState(false);
  /** 该次归因结果这一次没取到（红章依据，见文件头「D15c 同口径的最小新增」）。 */
  const [viewFailed, setViewFailed] = useState(false);
  const tier = useBlueprintTier();

  const loadedRef = useRef<string | null>(null);

  // 刷新 / 带 ?attribution_id= 进入 → #14 回显
  useEffect(() => {
    if (!attributionId || loadedRef.current === attributionId) return;
    setViewLoading(true);
    void (async () => {
      try {
        const view = await getAttribution(attributionId);
        loadedRef.current = view.attribution_id;
        store.setAttribution(view);
        setViewFailed(false);
      } catch (error) {
        setViewFailed(true);
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
      } finally {
        setViewLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributionId]);

  function guardSpace(): string | null {
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      navigate(SPACES_PATH);
      return null;
    }
    return activeSpaceId;
  }

  function handleError(error: unknown): void {
    toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
  }

  // ------------------------------------------------------------ 向导：classify
  async function runClassify(draft: AttributionDraft): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId) return;

    setBusy(true);
    try {
      const data = await classify({
        space_id: spaceId,
        stem: draft.stem,
        student_answer: draft.studentAnswer,
        kp_id: draft.kpId,
      });
      if (data.status === 'clarify') store.setClassifyClarify(data);
      else store.setClassifyAdopted(data);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ 向导：analyze
  async function runAnalyze(): Promise<void> {
    const spaceId = guardSpace();
    const adopted = store.classifyAdopted;
    if (!spaceId || !adopted) return;

    setBusy(true);
    try {
      const data = await analyze({
        space_id: spaceId,
        kp_id: adopted.knowledge_point,
        error_type: adopted.error_type,
      });
      const view = await getAttribution(data.attribution_id);
      loadedRef.current = view.attribution_id;
      store.setAttribution(view);
      setLastCorrect(null);
      navigate(`/attribution?attribution_id=${view.attribution_id}`, { replace: true });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ 结果态：verify / reject / plan
  async function submitVerify(): Promise<void> {
    const view = store.attribution;
    const item = store.verification.item;
    if (!view || !item || busy) return;

    setBusy(true);
    try {
      const data = await verify({
        attribution_id: view.attribution_id,
        item_id: item.item_id,
        answer: verifyAnswer,
      });
      setVerifyAnswer('');
      setLastCorrect(data.correct);
      const fresh = await getAttribution(view.attribution_id);
      loadedRef.current = fresh.attribution_id;
      store.setAttribution(fresh);
      store.setVerification({ lastCorrect: data.correct });
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitReject(): Promise<void> {
    const view = store.attribution;
    if (!view || busy) return;

    setBusy(true);
    try {
      await reject({ attribution_id: view.attribution_id, reason: rejectReason.trim() || undefined });
      setRejectOpen(false);
      setRejectReason('');
      setLastCorrect(null);
      const fresh = await getAttribution(view.attribution_id);
      store.setAttribution(fresh);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function runPlan(): Promise<void> {
    const spaceId = guardSpace();
    const view = store.attribution;
    if (!spaceId || !view || busy) return;

    setBusy(true);
    try {
      const data = await generatePlan({
        space_id: spaceId,
        root_cause: view.root_cause,
        error_type: view.error_type,
      });
      store.setPlan(data);
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  /** 红章的真重试（D15c 口径）：重发**同一个** #14 请求，不新开取数路径。 */
  async function retryLoad(): Promise<void> {
    if (!attributionId) return;
    setViewLoading(true);
    try {
      const view = await getAttribution(attributionId);
      loadedRef.current = view.attribution_id;
      store.setAttribution(view);
      setViewFailed(false);
    } catch (error) {
      handleError(error);
    } finally {
      setViewLoading(false);
    }
  }

  function restart(): void {
    store.reset();
    loadedRef.current = null;
    setLastCorrect(null);
    navigate('/attribution', { replace: true });
  }

  const draft = store.draft;
  const adopted = store.classifyAdopted;
  const clarify = store.classifyClarify;
  const wrongItems = activeSpaceId ? readPaperWrong(activeSpaceId) : [];

  /** 当前步（0 起，与 WIZARD_STEPS 对齐）：结果态 = 第 5 步。 */
  const stepIndex = store.attribution ? 4 : adopted ? 3 : clarify ? 2 : draft ? 1 : 0;

  /** 页头（原型 sheetHead L2608）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="ATTRIBUTION / 沿先修链回溯"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="错题归因：往上找真正卡住你的那一环"
      sub="四步：挑错题 → 复述确认 → 错误分类 → 分流；验证通过才给处方。允许你反驳。"
      chips={<Badge tone="accent">T0 · 回溯</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  /** 步骤条（原型 stepper L2611-2615）：当前步高亮，已过的步走平色。 */
  const stepper = (
    <div className="bp-flat mb-6 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {WIZARD_STEPS.map(([no, label], index) => (
          <Badge
            key={no}
            tone={stepIndex === index ? 'accent' : 'neutral'}
            className={cn(stepIndex > index && 'opacity-70')}
          >
            {`${no} · ${label}`}
          </Badge>
        ))}
        <span className="tok ml-auto text-ink-soft">从 ?attribution_id= 进入时先取回该次结果</span>
      </div>
    </div>
  );

  // ============================================================ 回显等待
  // 带 ?attribution_id= 进入且尚未取回结果：先出骨架，避免闪一屏空白起始页（批三）
  if (viewLoading && !store.attribution) {
    return (
      <>
        {pageHead}
        {stepper}
        <SheetBlock no="00" title="载入该次归因结果">
          <SkeletonLines rows={4} note="正在取这次归因的结果 · 不伪造内容" />
        </SheetBlock>
      </>
    );
  }

  // ============================================================ 取不到（error）
  // 不给半截结论：结果取不到就明说取不到，重试重发同一个请求；不拿向导态冒充结果。
  if (viewFailed && !store.attribution) {
    return (
      <>
        {pageHead}
        {stepper}
        <SheetBlock no="00" title="载入该次归因结果">
          <Stamp
            reason="这一次没能取回这次归因的结果（网络中断、结果已过期，或服务暂时没有响应）。取不到就不给你半截结论：重试一次通常就能取到，也可以从下面重新挑一道错题开始。"
            onRetry={() => {
              void retryLoad();
            }}
            retrying={viewLoading}
            alt={{ label: '重新挑一道错题', to: '/attribution' }}
          />
        </SheetBlock>
      </>
    );
  }

  // ============================================================ 结果态
  if (store.attribution) {
    const view: AttributionView = store.attribution;
    const suspects = Object.entries(view.suspect_scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const item = store.verification.item;
    const plan = store.plan;

    /**
     * 把视线送到指定区块。
     * ⚠ 不能用 `href="#id"` —— 本项目是 HashRouter，`#` 归路由所有，锚点链接会把路由顶掉。
     * 且滚动行为走 lib/motion 的 scrollBehavior()，尊重系统的「减弱动态效果」偏好。
     */
    function scrollTo(id: string): void {
      document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    }

    return (
      <>
        {pageHead}
        {stepper}

        {/* ── 05 结论（原型 L2715-2721）：根因块是全页的第一眼 ────────── */}
        <SheetBlock
          no="05"
          title={PHRASES.attributionFound}
          right={<Badge>{`回溯 ${view.path.length} 层`}</Badge>}
        >
          <div className="bp-panel p-4">
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
              <h3 className="font-disp text-ui-sm tracking-tight text-ink">根因</h3>
              <Badge tone="warning">{ERROR_TYPE_LABEL[view.error_type]}</Badge>
              {view.verified ? <Badge tone="positive">已验证</Badge> : null}
              {view.rejected_by_student ? (
                <Badge tone="neutral">{UI_TEXT.rejectRecorded}</Badge>
              ) : null}
            </div>
            <p className="font-disp text-base leading-snug tracking-tight text-ink">
              {kpName(view.root_cause)}
            </p>
            <p className="tok mt-1.5">
              归因编号 <span className="num-mono">{view.attribution_id}</span> · 回溯层数{' '}
              {view.path.length} · 当前状态：
              {view.verified ? '已验证' : item ? '待验证' : '尝试用完'}
            </p>
            <p className="bp-note mt-3">
              从「{kpName(view.from_kp)}」出发，沿先修链往上找了 {view.path.length} 层，停在了「
              {kpName(view.root_cause)}」。{ERROR_TYPE_LABEL[view.error_type]} ——{' '}
              {ERROR_TYPE_NOTE[view.error_type]}
            </p>
            {/* 主操作：未验证时给出「下一步」，已到达终局就不再堆按钮（处方区自会有操作）。 */}
            {!view.verified && item ? (
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => scrollTo(VERIFY_ANCHOR_ID)}>
                  去验证这一步 ↓
                </Button>
              </div>
            ) : null}
          </div>
        </SheetBlock>

        {/* ── 01 回溯路径（原型 L2722-2727）：一条链，根因那一节换红框 ──── */}
        <SheetBlock no="01" title="回溯路径">
          <ol className="bp-path">
            {view.path.map((id, index) => {
              const isRoot = index === view.path.length - 1;
              return (
                <li key={id} data-root={isRoot ? '1' : '0'}>
                  <span className="pl" aria-hidden="true">
                    {`L${String(view.path.length - index).padStart(2, '0')}`}
                  </span>
                  <span className="min-w-0">{kpName(id)}</span>
                  {isRoot ? <Badge tone="negative">根因在此</Badge> : null}
                </li>
              );
            })}
          </ol>
          <p className="bp-note">
            层号从表面往上游数：L{String(view.path.length).padStart(2, '0')} 是那道错题表面的知识点，L01
            是回溯到的最上游。
          </p>
        </SheetBlock>

        {/* ── 02 候选根因排序（原型 L2728-2732）：贡献度条 + 读数 ──────── */}
        {suspects.length > 0 ? (
          <SheetBlock no="02" title="候选根因排序">
            <ul className="bp-cands">
              {suspects.map(([suspect, score]) => (
                <li key={suspect}>
                  <span className="cn">{kpName(suspect)}</span>
                  <span
                    className="bp-bar"
                    data-share={score >= 0.5 ? 'high' : score >= 0.2 ? 'mid' : 'low'}
                    role="img"
                    aria-label={`嫌疑分 ${score.toFixed(2)}`}
                  >
                    <i style={{ width: `${Math.round(score * 100)}%` }} />
                  </span>
                  <span className="num-mono">{score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {/* ⚠ 口径按本工程真实字段写：suspect_scores 是**嫌疑分**（先修距离越近越高，
                上界 d=1 0.60 / d=2 0.36 / d=3 0.216，不归一、合计不为 1）——原型那句
                「贡献度合计为 1」是原型 mock 的口径，照抄会变成一句与数据不符的话。 */}
            <p className="bp-note">
              {`嫌疑分按「离那道错题的先修距离」排（越近越高），不归一；排第一的就是这次认定的根因，其余是也在起作用的候选（本次最高 ${percent(suspects[0][1])}）。`}
            </p>
          </SheetBlock>
        ) : null}

        {/* ── 03 验证环节（原型 L2733-2745）──────────────────────────── */}
        <SheetBlock
          no="03"
          title="验证环节"
          id={VERIFY_ANCHOR_ID}
          className="scroll-mt-20"
          right={<Badge>{view.verified ? '已验证' : item ? '待你作答' : '尝试用完'}</Badge>}
        >
          <div className="bp-panel p-4">
            {item ? (
              <>
                <p className="max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
                  做对这一题，就说明我们找对了方向（做错也没关系，我换一道再确认）。
                </p>
                <div className="mt-3">
                  <ItemCard item={item} value={verifyAnswer} onChange={setVerifyAnswer} disabled={busy} />
                </div>
                <Button className="mt-3" loading={busy} onClick={() => void submitVerify()}>
                  {busy ? '正在判…' : '提交这一步'}
                </Button>
              </>
            ) : view.verified ? (
              <p className="max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
                {lastCorrect === false
                  ? '这道没过，我们换个方向继续看。'
                  : `${UI_TEXT.verifyPassed}——这一环确实是我们该补的地方。`}
              </p>
            ) : (
              <p className="max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
                {UI_TEXT.verificationExhausted}
              </p>
            )}
          </div>
        </SheetBlock>

        {/* ── 04 处方（原型 L2746-2753）：验证通过才给 ─────────────────── */}
        <SheetBlock
          no="04"
          title="处方"
          id={PLAN_ANCHOR_ID}
          className="scroll-mt-20"
          right={
            <Badge tone={view.verified ? 'accent' : 'neutral'}>
              {view.verified ? '验证通过后给出' : '待验证通过后给出'}
            </Badge>
          }
        >
          {view.verified ? (
            <div className="bp-panel p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-disp text-ui-sm tracking-tight text-ink">
                    那就从这一环开始稳
                  </h3>
                  <p className="tok mt-0.5">我给你排一条从根因往上补的路线，题从易到难。</p>
                </div>
                <Button size="sm" loading={busy} onClick={() => void runPlan()}>
                  {plan ? '重新生成' : '给我一条路线'}
                </Button>
              </div>
              {plan ? (
                <>
                  <p className="mt-3 text-body-sm text-ink">
                    策略：<span className="text-accent-ink">{plan.strategy}</span>
                  </p>
                  <ul className="bp-tick-list mt-2">
                    {plan.explanation_outline.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                  <div className="bp-tbl-wrap mt-3">
                    <table className="bp-tbl">
                      <caption>题目序列（从易到难）</caption>
                      <thead>
                        <tr>
                          <th>难度</th>
                          <th>题目</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.item_sequence.map((sequenceItem) => (
                          <tr key={sequenceItem.item_id}>
                            <td data-label="难度" className="n">
                              {sequenceItem.difficulty}
                            </td>
                            <td data-label="题目">{sequenceItem.stem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Link
                    to={`/graph?path=${encodeURIComponent(plan.path.join(','))}`}
                    className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4')}
                  >
                    去图谱看学习路径
                  </Link>
                </>
              ) : null}
            </div>
          ) : (
            <p className="max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
              先把上面这一步验证完，我再给你排路线。验证通过才生成补齐方案——这次尝试用完了，我们就停在这里，不硬编一份方案出来。
            </p>
          )}
        </SheetBlock>

        {/* ── 页脚：反驳常驻 + 重新归因（原型 L2754-2756 的出口行）───────
            「反驳」承载的是产品的一条纪律（学生可以不同意机器判断），所以常驻；
            但它不与结论争注意力，落在页脚一行，需要时才展开。 */}
        <SheetBlock no="06" title="下一步">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-disp text-ui-sm tracking-tight text-ink">不同意这个判断？</h3>
              <p className="tok mt-0.5">你比我清楚当时怎么想的——说一句，我换一道题再确认。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-expanded={rejectOpen}
                onClick={() => setRejectOpen((value) => !value)}
              >
                {rejectOpen ? '收起' : '反驳一下'}
              </Button>
              <Button variant="quiet" size="sm" onClick={restart}>
                换一道错题重新归因
              </Button>
            </div>
          </div>

          {rejectOpen ? (
            <div className="mt-3">
              <FormField label="你的理由（可选）" labelHidden>
                <Textarea
                  rows={2}
                  placeholder="（可选）说说你的理由，比如「我其实会配方，只是这题看错了」"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </FormField>
              <Button size="sm" className="mt-2" loading={busy} onClick={() => void submitReject()}>
                {busy ? '正在记…' : '提交反驳，换一道验证题'}
              </Button>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link to="/graph" className={cn(buttonVariants({ variant: 'link' }))}>
              去看技能树
            </Link>
            <Link to="/report" className={cn(buttonVariants({ variant: 'link' }))}>
              学习报告
            </Link>
          </div>
        </SheetBlock>
      </>
    );
  }

  // ============================================================ 向导态
  /**
   * 步骤眉标（P3 新增）。
   * ⚠ 刻意**不用进度条**：契约里没有「总步数」这个概念，画进度条就是编造数据。
   * 步骤感由步骤条 + 内容推进承担，而不是由一个假装能量化进度的组件承担。
   * 文案留作页内字面量，不并入 UI_TEXT —— 后者有逐字断言（phrases.test.ts）。
   */
  const stepLabel =
    draft === null
      ? '第 1 步 · 挑一道错题'
      : clarify
        ? '第 3 步 · 我再确认一下'
        : adopted
          ? '第 4 步 · 看看属于哪一类'
          : '第 2 步 · 先复述一遍';

  return (
    <>
      {pageHead}
      {stepper}

      {/* ── STEP1 · 01 挑一道错题（原型 L2636-2648）──────────────────── */}
      {draft === null ? (
        <SheetBlock
          no="01"
          title="挑一道错题"
          right={<span className="num-mono text-tok text-ink-soft">STEP 1 / 4</span>}
        >
          <p className="bp-note mb-3">{`当前：${stepLabel}。先告诉我一道错题：我会先复述你写的那一步，再说它大概属于哪一类——拿不准我会问你，而不是猜。`}</p>

          <div className="grid grid-cols-1 gap-4 annos:grid-cols-[minmax(0,1fr)_320px]">
            {/* 左：本会话试卷确认判出的错题（勾稽 #3：只从缓存里取，不凭空造题） */}
            <div className="bp-panel p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-disp text-ui-sm tracking-tight text-ink">从本会话的试卷错题里挑</h3>
                <Badge tone={wrongItems.length > 0 ? 'accent' : 'neutral'}>
                  {wrongItems.length > 0 ? `${wrongItems.length} 题可带出` : '暂无缓存'}
                </Badge>
              </div>

              {wrongItems.length > 0 ? (
                <div className="bp-tbl-wrap">
                  <table className="bp-tbl">
                    <caption>试卷逐题确认时判错的题（来自本会话的试卷确认）</caption>
                    <thead>
                      <tr>
                        <th>题</th>
                        <th>题干</th>
                        <th>知识点</th>
                        <th>你的作答</th>
                        <th>选</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wrongItems.map((item, index) => (
                        <tr key={`${item.kp_id}_${index}`}>
                          <td data-label="题" className="n">
                            {index + 1}
                          </td>
                          <td data-label="题干">{item.stem_excerpt}</td>
                          <td data-label="知识点">{kpName(item.kp_id)}</td>
                          <td data-label="你的作答">{item.student_answer || '（空）'}</td>
                          <td data-label="选">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                store.setDraft({
                                  kpId: item.kp_id,
                                  stem: item.stem_excerpt,
                                  studentAnswer: item.student_answer,
                                  itemId: null,
                                })
                              }
                            >
                              用这道
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  tag="NO WRONG ITEMS"
                  title="这个会话里还没有试卷确认产生的错题"
                  hint="候选清单只从试卷逐题确认判出的错题里取，不凭空造题；缓存为空就如实说没有。先去传一张卷子（确认判错的题会留在这里），或者在右边手动填一道——手动填的题走同一套归因流程。"
                  action={
                    <Button variant="secondary" size="sm" onClick={() => navigate('/paper')}>
                      先去传一张卷子
                    </Button>
                  }
                />
              )}
            </div>

            {/* 右：手动填一道（走同一套流程，不因不是拍照来的就降级处理） */}
            <div className="bp-flat p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-disp text-ui-sm tracking-tight text-ink">或者手动填一道</h3>
                <Badge tone="neutral">同一套流程</Badge>
              </div>
              <FormField label="题干">
                <Textarea rows={2} value={stem} onChange={(event) => setStem(event.target.value)} />
              </FormField>
              <FormField label="你的作答">
                <Textarea
                  rows={2}
                  value={studentAnswer}
                  onChange={(event) => setStudentAnswer(event.target.value)}
                />
              </FormField>
              <FormField label="知识点">
                <Select value={kpId} onChange={(event) => setKpId(event.target.value)}>
                  {KP_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button
                className="mt-1"
                disabled={stem.trim().length === 0 || studentAnswer.trim().length === 0}
                onClick={() => store.setDraft({ kpId, stem, studentAnswer, itemId: null })}
              >
                下一步：先复述一遍
              </Button>
            </div>
          </div>
        </SheetBlock>
      ) : null}

      {/* ── STEP2 · 02 复述确认（先复述再判定，是产品纪律不是装饰）────── */}
      {draft !== null && !adopted && !clarify ? (
        <SheetBlock
          no="02"
          title="复述确认"
          right={<span className="num-mono text-tok text-ink-soft">STEP 2 / 4</span>}
        >
          <div className="bp-panel p-4">
            <h3 className="font-disp text-ui-sm tracking-tight text-ink">我把你的作答这样读，对不对？</h3>
            <p className="bp-note mt-1.5">{UI_TEXT.restateFirst}</p>
            <div className="mt-3">
              <div className="bp-kv">
                <dt>题目</dt>
                <dd className="whitespace-pre-wrap text-left">{draft.stem}</dd>
              </div>
              <div className="bp-kv">
                <dt>你的作答</dt>
                <dd className="whitespace-pre-wrap text-left">{draft.studentAnswer}</dd>
              </div>
              <div className="bp-kv">
                <dt>知识点</dt>
                <dd className="text-left">{kpName(draft.kpId)}</dd>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button loading={busy} onClick={() => void runClassify(draft)}>
                {busy ? '正在看…' : '就是这样，看看属于哪类'}
              </Button>
              <Button variant="quiet" onClick={() => store.reset()}>
                换一道
              </Button>
            </div>
          </div>
        </SheetBlock>
      ) : null}

      {/* ── STEP3-A · 03 低置信就地追问（不自动 analyze）────────────── */}
      {clarify ? (
        <SheetBlock
          no="03"
          title="错误分类（我再确认一下）"
          right={<span className="num-mono text-tok text-ink-soft">STEP 3 / 4</span>}
        >
          <div className="bp-panel border-band-weak p-4">
            <p className="text-body-sm leading-relaxed text-ink">{clarify.question}</p>
            <p className="bp-note mt-1.5">我拿不准就不硬猜——你把这一步写清楚，我再判一次。</p>
            <span className="bp-ctl mt-3 block">
              <Textarea
                rows={3}
                placeholder="比如把中间那一步式子写出来"
                value={clarifyInput}
                onChange={(event) => setClarifyInput(event.target.value)}
              />
            </span>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                loading={busy}
                disabled={clarifyInput.trim().length === 0}
                onClick={() => {
                  const current = store.draft;
                  if (!current) return;
                  const next: AttributionDraft = { ...current, studentAnswer: clarifyInput };
                  store.setDraft(next);
                  store.clearClassify();
                  setClarifyInput('');
                  void runClassify(next);
                }}
              >
                {busy ? '再看一次…' : '再判一次'}
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  store.clearClassify();
                }}
              >
                回到上一步
              </Button>
            </div>
          </div>
        </SheetBlock>
      ) : null}

      {/* ── STEP3-B · 03 判定结果（五类闭集常显，命中项高亮）────────── */}
      {adopted ? (
        <>
          <SheetBlock
            no="03"
            title="错误分类（五类闭集）"
            right={<span className="num-mono text-tok text-ink-soft">STEP 3 / 4</span>}
          >
            <div className="bp-panel p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-disp text-ui-sm tracking-tight text-ink">先复述你写的这一步</h3>
                <span className="num-mono tok text-ink-soft">把握 {percent(adopted.confidence)}</span>
              </div>
              {adopted.evidence ? (
                <p className="bp-note bp-note--ok">{adopted.evidence}</p>
              ) : null}
              {adopted.matched_typical_error ? (
                <p className="tok mt-1.5">匹配到的典型失误：{adopted.matched_typical_error}</p>
              ) : null}
            </div>

            <div className="bp-tbl-wrap mt-3">
              <table className="bp-tbl">
                <caption>错误五类 · 命中高亮 + 说明</caption>
                <thead>
                  <tr>
                    <th>类别</th>
                    <th>说明</th>
                    <th>按这条走</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_TYPES.map((type: ErrorTypeValue) => {
                    const hit = adopted.error_type === type;
                    return (
                      <tr key={type} data-current={hit ? 'true' : 'false'}>
                        <td data-label="类别">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-ink">{ERROR_TYPE_LABEL[type]}</span>
                            {hit ? <Badge tone="negative">命中</Badge> : null}
                          </span>
                        </td>
                        <td data-label="说明">
                          <span className={cn(!hit && 'opacity-70')}>{ERROR_TYPE_NOTE[type]}</span>
                        </td>
                        <td data-label="按这条走">
                          {hit ? <Badge tone="accent">当前判定</Badge> : <span className="tok">未命中</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SheetBlock>

          {/* ── STEP4 · 04 分流（原型 L2691-2706）────────────────────── */}
          <SheetBlock
            no="04"
            title={
              adopted.attribution_direction === 'none' ? '分流：这一类不用深挖' : '分流：往上游找根源'
            }
            right={<span className="num-mono text-tok text-ink-soft">STEP 4 / 4</span>}
          >
            {adopted.attribution_direction === 'none' ? (
              /* 契约硬约束：direction=none（procedural_slip / misreading）**不出现 analyze 按钮**。
                 这类不是知识缺口，往上翻没有意义，只能诚实告诉学生「不用归因」。 */
              <div className="bp-panel p-4">
                <p className="font-mono text-ui-sm uppercase tracking-widest text-band-unstable">
                  SMALL MISTAKE · 不再向上回溯
                </p>
                <p className="mt-2 text-body-sm text-ink">{UI_TEXT.slipNoAttribution}</p>
                <p className="bp-note mt-2">
                  这类不属于知识缺口，所以我不往上游翻——你需要的只是再稳一遍手。这一类不提供深挖入口。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link to="/assessment" className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}>
                    再练几道
                  </Link>
                  <Button variant="quiet" size="sm" onClick={() => store.reset()}>
                    看下一道错题
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bp-panel p-4">
                <h3 className="font-disp text-ui-sm tracking-tight text-ink">这一类值得往上走</h3>
                <p className="mt-1.5 max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
                  按「{ERROR_TYPE_LABEL[adopted.error_type]}
                  」，我会沿先修链向上回溯，找出最早能解释这个行为的那一环，然后用一道新题验证。回溯每一层都会摊开给你看。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {/* R7：两个按钮由「同行 inline-block + 第二个 ml-3」改成「flex-wrap + gap-3」。
                      JSX 会吃掉换行相邻的空白，故原先按钮之间只有 ml-3 的 12px、不含额外空格宽；
                      gap-3 同为 12px ⇒ 桌面（不换行时）间距与位置逐像素不变，窄屏才换行堆叠。 */}
                  <Button loading={busy} onClick={() => void runAnalyze()}>
                    {busy ? '正在往上找…' : '看看真正的根源'}
                  </Button>
                  <Button variant="quiet" onClick={() => store.reset()}>
                    换一道
                  </Button>
                </div>
              </div>
            )}
          </SheetBlock>
        </>
      ) : null}
    </>
  );
}
