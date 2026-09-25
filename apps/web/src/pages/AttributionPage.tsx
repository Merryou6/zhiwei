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
 * P3（2026-09-25）信息架构重做
 *
 * 只重排视觉与版式。业务逻辑、数据字段、行为分叉、接口调用、Link 目标一字未动。
 *
 * 【改前的毛病】结果态是 5 张**同构等权**卡片（回溯路径 / 嫌疑排序 / 验证一下 /
 * 不同意这个判断 / 处方）自上而下堆叠，全部 `mt-4 rounded-2xl border p-4 shadow-card`。
 * 后果是没有视觉焦点：打开页面第一眼看到的是一堆卡片，而不是「结论是什么」。
 * 对一个「归因」产品这是致命的 —— 学生来就是为了那一句话。
 *
 * 【改后的叙事】结论 → 为什么 → 怎么找到的 → 其它可能 → 验证 → 处方
 *   ① Hero —— **刻意不是卡片**（无边框、无底色、无圆角，只有左侧 2px 主色标线
 *      与字号阶差）。第一眼就是结论：根因知识点做大字标题；「找到啦…」退成它上方的
 *      一句小字（它表达的是「我们找到了」这个态度，不是结论本身）。
 *   ② 为什么是这里 —— 这一类失误的典型表现 + 沿先修链找了几层、停在哪。
 *   ③ 怎么找到的 —— 纵向路径链（连接线 + 根因光环 + 等宽数字圆点），
 *      替代原来的「数字圆点 + 缩进文本」，让「往上追」这件事本身看得出来。
 *   ④ 其它可能 —— 降为 quiet 档（无边框、无阴影、只靠下沉底色），
 *      嫌疑度改成贡献度条；它是旁证，不该和结论一样重。
 *   ⑤ 验证一下 / ⑥ 处方 —— 页面的主操作区，保持 plain 档。
 *   ⑦ 反驳 + 换一道 —— 降为页脚一行 inline 操作，不再与 Hero 争注意力。
 *
 * 【只用真实字段】Hero 的结论取 view.root_cause；「为什么」取 error_type 与 path.length；
 * 链条取 view.path；贡献度取 view.suspect_scores；验证取 store.verification；
 * 处方取 store.plan。⚠ 结果态**没有** confidence —— 它只存在于向导态的 classifyAdopted，
 * 不得借用、不得编造。
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { analyze, classify, generatePlan, getAttribution, reject, verify } from '../api/endpoints';
import type { AttributionView, ErrorTypeValue } from '../api/types';
import ItemCard from '../components/ItemCard';
import PageSkeleton from '../components/PageSkeleton';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormField,
  PageContainer,
  PageHeader,
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
      } catch (error) {
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

  function restart(): void {
    store.reset();
    loadedRef.current = null;
    setLastCorrect(null);
    navigate('/attribution', { replace: true });
  }

  // ============================================================ 回显等待
  // 带 ?attribution_id= 进入且尚未取回结果：先出骨架，避免闪一屏空白起始页（批三）
  if (viewLoading && !store.attribution) {
    return (
      <PageContainer width="prose">
        <PageSkeleton label="正在取这次归因的结果…" rows={2} />
      </PageContainer>
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
      // ⚠ 结果态用 standard（768px）而不是向导态的 prose（672px）：
      // 结果态是**报告**（有链条、有进度条、有列表），不是连续阅读的正文。
      // 672px 的窄列让这一屏在 1440 下显得又瘦又空 —— 内容只占可用宽度六成，
      // 右边留出一大片什么都不发生的空白，看起来像没排完版。
      <PageContainer width="standard">
        {/* ── ① Hero：页面的视觉焦点，刻意不是卡片 ──────────────────────
            无边框、无底色、无圆角、无阴影 —— 只靠左侧 2px 主色标线与字号阶差立起来。
            这是「Hero 不必是 Card」这条判据的执行点：一旦给它套上 rounded-surface +
            border + shadow-card，它就和下面 4 张卡变成了同一级，结论又沉回页首了。
            唯一的面部动作是 animate-rise：整页只此一处入场动画，不做逐块 stagger。 */}
        <section className="animate-rise border-l-2 border-accent pl-4 nav:pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warning">{ERROR_TYPE_LABEL[view.error_type]}</Badge>
            {view.verified ? <Badge tone="positive">已验证</Badge> : null}
            {view.rejected_by_student ? (
              <Badge tone="neutral">{UI_TEXT.rejectRecorded}</Badge>
            ) : null}
          </div>

          <p className="mt-5 text-ui-sm text-ink-soft">{PHRASES.attributionFound}</p>
          <h1 className="mt-1 text-3xl font-medium leading-tight text-ink">
            {kpName(view.root_cause)}
          </h1>
          <p className="mt-3 text-reading leading-relaxed text-ink-soft">
            从「{kpName(view.from_kp)}」往上翻，真正卡住的是这一环。
          </p>
          <p className="mt-2 font-mono text-caption tabular-nums text-ink-soft">
            归因编号 {view.attribution_id} · 回溯 {view.path.length} 层
          </p>

          {/* 主操作：未验证时给出「下一步」，已到达终局就不再堆按钮（处方区自会有操作）。 */}
          {!view.verified && item ? (
            <div className="mt-5">
              <Button variant="secondary" size="sm" onClick={() => scrollTo(VERIFY_ANCHOR_ID)}>
                去验证这一步 ↓
              </Button>
            </div>
          ) : null}
        </section>

        {/* ── ② 为什么是这里 ─────────────────────────────────────────── */}
        <Card className="mt-8">
          <CardHeader title="为什么是这里" />
          <CardContent className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <p>
              <span className="text-ink">{ERROR_TYPE_LABEL[view.error_type]}</span>
              {' —— '}
              {ERROR_TYPE_NOTE[view.error_type]}
            </p>
            <p>
              我们从「{kpName(view.from_kp)}」出发，沿先修链往上找了 {view.path.length}{' '}
              层，停在了「<span className="text-ink">{kpName(view.root_cause)}</span>」。
            </p>
          </CardContent>
        </Card>

        {/* ── ③ 怎么找到的：纵向路径链 ─────────────────────────────────
            从「数字圆点 + 缩进文本」升级为一条真正的链：圆点之间画连接线，
            根因那节换成实心主色 + 光环，读起来才像「一路往上追」而不是一串并列项。
            ⚠ 连接线靠 left-3 + -translate-x-1/2 居中定位，不去碰图层级 ——
              src 里禁止任意值 z-index（breakpoints.test.ts 会按字面量静态扫出，
              连注释里都别写出范例，否则闸门会被自己的说明文字绊倒）。 */}
        <Card className="mt-4">
          <CardHeader title="怎么找到的" description="从出错的那一步，沿先修链一路往上。" />
          <CardContent>
            <ol className="relative">
              {view.path.map((id, index) => {
                const isRoot = index === view.path.length - 1;
                return (
                  <li
                    key={id}
                    className={cn('relative flex gap-3', !isRoot && 'pb-4')}
                  >
                    {!isRoot ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-3 top-7 bottom-0 w-px -translate-x-1/2 bg-line"
                      />
                    ) : null}
                    <span
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption tabular-nums',
                        isRoot
                          ? 'bg-accent font-medium text-on-accent ring-4 ring-accent-veil'
                          : 'border border-line bg-canvas text-ink-soft',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div
                      className={cn(
                        'min-w-0 rounded-control px-3 py-1.5',
                        isRoot && 'bg-accent-veil',
                      )}
                    >
                      <p className={cn('text-sm', isRoot ? 'font-medium text-ink' : 'text-ink-soft')}>
                        {kpName(id)}
                      </p>
                      {isRoot ? (
                        <p className="mt-0.5 text-ui-sm text-accent-ink">根因就在这里</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* ── ④ 其它可能：降为 quiet 档 ────────────────────────────────
            它是旁证，不是结论。用 quiet（无边框、无阴影、只靠下沉底色）把它压到
            视觉第二层，避免和上面两张卡抢注意力。 */}
        {suspects.length > 0 ? (
          <Card variant="quiet" className="mt-4">
            <CardHeader
              title="其它可能"
              description="如果根因不是上面那个，接下来最像的是这几个。"
            />
            <CardContent>
              <ul className="space-y-2.5">
                {suspects.map(([suspect, score]) => (
                  <li key={suspect}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink">{kpName(suspect)}</span>
                      <span className="flex-none tabular-nums text-ink-soft">
                        {percent(score)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${score * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* ── ⑤ 验证一下 ─────────────────────────────────────────────── */}
        <Card id={VERIFY_ANCHOR_ID} className="mt-4 scroll-mt-20">
          <CardHeader title="验证一下" />
          <CardContent>
            {item ? (
              <>
                <p className="text-ui-sm leading-relaxed text-ink-soft">
                  做对这一题，就说明我们找对了方向（做错也没关系，我换一道再确认）。
                </p>
                <div className="mt-3">
                  <ItemCard item={item} value={verifyAnswer} onChange={setVerifyAnswer} disabled={busy} />
                </div>
                <Button
                  className="mt-3"
                  loading={busy}
                  onClick={() => void submitVerify()}
                >
                  {busy ? '正在判…' : '提交这一步'}
                </Button>
              </>
            ) : view.verified ? (
              <p className="text-sm leading-relaxed text-ink-soft">
                {lastCorrect === false
                  ? '这道没过，我们换个方向继续看。'
                  : `${UI_TEXT.verifyPassed}——这一环确实是我们该补的地方。`}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-ink-soft">
                {UI_TEXT.verificationExhausted}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── ⑥ 处方 ───────────────────────────────────────────────────
            ⚠ 未验证时**不渲染成一张卡**：原来它是一张边框完整、只装一句话的卡片，
            在一堆卡片中间显得又重又空。只有真的排得出路线时才值得占一张卡。 */}
        {view.verified ? (
          <Card id={PLAN_ANCHOR_ID} className="mt-4 scroll-mt-20">
            <CardHeader
              title="那就从这一环开始稳"
              description="我给你排一条从根因往上补的路线，题从易到难。"
              actions={
                <Button size="sm" loading={busy} onClick={() => void runPlan()}>
                  {plan ? '重新生成' : '给我一条路线'}
                </Button>
              }
            />
            {plan ? (
              <CardContent>
                <p className="text-sm text-ink">
                  策略：<span className="text-accent-ink">{plan.strategy}</span>
                </p>
                <ol className="mt-2 space-y-1 text-sm leading-relaxed text-ink-soft">
                  {plan.explanation_outline.map((line, index) => (
                    <li key={index}>· {line}</li>
                  ))}
                </ol>
                <ul className="mt-3 space-y-2">
                  {plan.item_sequence.map((sequenceItem) => (
                    <li
                      key={sequenceItem.item_id}
                      className="flex items-baseline gap-2 rounded-control border border-line px-3 py-2 text-sm text-ink"
                    >
                      <Badge tone="neutral" size="sm" className="flex-none tabular-nums">
                        难度 {sequenceItem.difficulty}
                      </Badge>
                      <span className="min-w-0">{sequenceItem.stem}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={`/graph?path=${encodeURIComponent(plan.path.join(','))}`}
                  className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-4')}
                >
                  去图谱看学习路径
                </Link>
              </CardContent>
            ) : null}
          </Card>
        ) : (
          <p
            id={PLAN_ANCHOR_ID}
            className="mt-6 scroll-mt-20 text-sm leading-relaxed text-ink-soft"
          >
            先把上面这一步验证完，我再给你排路线。
          </p>
        )}

        {/* ── ⑦ 次要区：一行 inline 操作 ───────────────────────────────
            「反驳」原先是一张与 Hero 等权的大卡常驻页面中部，抢走了结论的注意力。
            但它承载的是产品的一条重要纪律（学生可以不同意机器判断），所以不能删 ——
            降为页脚一行，需要时会展开。 */}
        <section className="mt-8 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-medium text-ink">不同意这个判断？</h2>
              <p className="mt-1 text-ui-sm leading-relaxed text-ink-soft">
                你比我更清楚当时怎么想的——说一句，我换一道题再确认。
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={rejectOpen}
              onClick={() => setRejectOpen((value) => !value)}
            >
              {rejectOpen ? '收起' : '反驳一下'}
            </Button>
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
              <Button
                size="sm"
                className="mt-2"
                loading={busy}
                onClick={() => void submitReject()}
              >
                {busy ? '正在记…' : '提交反驳，换一道验证题'}
              </Button>
            </div>
          ) : null}

          <div className="mt-4">
            <Button variant="quiet" size="sm" onClick={restart}>
              换一道错题重新归因
            </Button>
          </div>
        </section>
      </PageContainer>
    );
  }

  // ============================================================ 向导态
  const wrongItems = activeSpaceId ? readPaperWrong(activeSpaceId) : [];
  const draft = store.draft;
  const adopted = store.classifyAdopted;
  const clarify = store.classifyClarify;

  /**
   * 步骤眉标（P3 新增）。
   * ⚠ 刻意**不用进度条**：契约里没有「总步数」这个概念，画进度条就是编造数据。
   * 步骤感由眉标 + 内容推进承担，而不是由一个假装能量化进度的组件承担。
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
    <PageContainer width="prose">
      <PageHeader
        kicker={stepLabel}
        title="看看这道题错在哪"
        description="先告诉我一道错题。我会先复述你写的这一步，再说它大概属于哪一类——如果我拿不准，我会问你，而不是猜。"
      />

      {/* ── 第一步：选错题来源 ───────────────────────────────────── */}
      {draft === null ? (
        <div className="mt-6 space-y-4">
          {wrongItems.length > 0 ? (
            <Card>
              <CardHeader
                title="从试卷错题里挑"
                description={`这个空间里记下了 ${wrongItems.length} 道错题。`}
              />
              <CardContent>
                <ul className="space-y-2">
                  {wrongItems.map((item, index) => (
                    <li key={`${item.kp_id}_${index}`}>
                      <button
                        type="button"
                        onClick={() =>
                          store.setDraft({
                            kpId: item.kp_id,
                            stem: item.stem_excerpt,
                            studentAnswer: item.student_answer,
                            itemId: null,
                          })
                        }
                        className="w-full rounded-control border border-line px-3 py-2 text-left transition-colors duration-150 ease-out hover:border-accent hover:bg-raised"
                      >
                        <span className="block text-sm text-ink">{item.stem_excerpt}</span>
                        <span className="mt-1 block text-ui-sm text-ink-soft">
                          {kpName(item.kp_id)} · 你的作答：{item.student_answer || '（空）'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="或者自己填一道" />
            <CardContent className="space-y-3">
              <FormField label="题目（写个大概也行）">
                <Textarea
                  rows={2}
                  value={stem}
                  onChange={(event) => setStem(event.target.value)}
                />
              </FormField>
              <FormField label="你当时怎么写的">
                <Textarea
                  rows={2}
                  value={studentAnswer}
                  onChange={(event) => setStudentAnswer(event.target.value)}
                />
              </FormField>
              <FormField label="这道题考的知识点">
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
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ── 第二步：复述确认（先复述再判定，是产品纪律不是装饰）────── */}
      {draft !== null && !adopted && !clarify ? (
        <Card className="mt-6">
          <CardContent>
            <p className="text-ui-sm text-ink-soft">{UI_TEXT.restateFirst}</p>
            {/* 复述块：用下沉底色与卡片本体分开，读起来像「引用你写的东西」而不是我们的结论。 */}
            <div className="mt-3 rounded-control bg-canvas px-3 py-2.5">
              <p className="text-ui-sm text-ink-soft">题目</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{draft.stem}</p>
              <p className="mt-3 text-ui-sm text-ink-soft">你的作答</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{draft.studentAnswer}</p>
              <p className="mt-3 text-ui-sm text-ink-soft">知识点：{kpName(draft.kpId)}</p>
            </div>
          </CardContent>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button loading={busy} onClick={() => void runClassify(draft)}>
              {busy ? '正在看…' : '就是这样，看看属于哪类'}
            </Button>
            <Button variant="quiet" onClick={() => store.reset()}>
              换一道
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── 第三步 A：低置信就地追问（不自动 analyze）──────────────── */}
      {clarify ? (
        <Card variant="quiet" className="mt-6 border border-band-weak">
          <CardContent>
            <p className="text-sm leading-relaxed text-ink">{clarify.question}</p>
            <p className="mt-1 text-ui-sm text-ink-soft">
              我拿不准就不硬猜——你把这一步写清楚，我再判一次。
            </p>
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="比如把中间那一步式子写出来"
              value={clarifyInput}
              onChange={(event) => setClarifyInput(event.target.value)}
            />
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
          </CardContent>
        </Card>
      ) : null}

      {/* ── 第三步 B：判定结果（五类枚举常显，命中项高亮）──────────── */}
      {adopted ? (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader
              title="先复述你写的这一步"
              actions={
                <span className="flex-none text-ui-sm tabular-nums text-ink-soft">
                  把握 {percent(adopted.confidence)}
                </span>
              }
            />
            <CardContent className="space-y-2">
              {adopted.evidence ? (
                <p className="rounded-control bg-canvas px-3 py-2.5 text-sm leading-relaxed text-ink">
                  {adopted.evidence}
                </p>
              ) : null}
              {adopted.matched_typical_error ? (
                <p className="text-ui-sm text-ink-soft">
                  匹配到的典型失误：{adopted.matched_typical_error}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="它大概属于哪一类"
              description="五类常显，命中的那一类会亮起来。"
            />
            <CardContent>
              <ul className="space-y-2">
                {ERROR_TYPES.map((type: ErrorTypeValue) => {
                  const active = adopted.error_type === type;
                  return (
                    <li
                      key={type}
                      className={cn(
                        'rounded-control border px-3 py-2',
                        active ? 'border-accent bg-accent-veil' : 'border-line opacity-60',
                      )}
                    >
                      <p className={cn('text-sm', active ? 'font-medium text-ink' : 'text-ink-soft')}>
                        {ERROR_TYPE_LABEL[type]}
                      </p>
                      <p className="mt-0.5 text-ui-sm leading-relaxed text-ink-soft">
                        {ERROR_TYPE_NOTE[type]}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {adopted.attribution_direction === 'none' ? (
            /* 契约硬约束：direction=none（procedural_slip / misreading）**不出现 analyze 按钮**。
               这类不是知识缺口，往上翻没有意义，只能诚实告诉学生「不用归因」。 */
            <Card variant="quiet" className="border border-band-weak">
              <CardContent>
                <p className="text-sm text-ink">{UI_TEXT.slipNoAttribution}</p>
                <p className="mt-1 text-ui-sm leading-relaxed text-ink-soft">
                  这类不属于知识缺口，所以我不往上游翻——你需要的只是再稳一遍手。
                </p>
              </CardContent>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Link
                  to="/assessment"
                  className={cn(buttonVariants({ variant: 'primary', size: 'sm' }))}
                >
                  再练几道
                </Link>
                <Button variant="quiet" size="sm" onClick={() => store.reset()}>
                  看下一道错题
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                {/* R7：两个按钮由「同行 inline-block + 第二个 ml-3」改成「flex-wrap + gap-3」。
                    JSX 会吃掉换行相邻的空白，故原先按钮之间只有 ml-3 的 12px、不含额外空格宽；
                    gap-3 同为 12px ⇒ 桌面（不换行时）间距与位置逐像素不变，窄屏才换行堆叠。 */}
                <Button loading={busy} onClick={() => void runAnalyze()}>
                  {busy ? '正在往上找…' : '看看真正的根源'}
                </Button>
                <Button variant="quiet" onClick={() => store.reset()}>
                  换一道
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </PageContainer>
  );
}
