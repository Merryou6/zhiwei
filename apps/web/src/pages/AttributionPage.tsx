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
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { analyze, classify, generatePlan, getAttribution, reject, verify } from '../api/endpoints';
import type { AttributionView, ErrorTypeValue } from '../api/types';
import ItemCard from '../components/ItemCard';
import { GRAPH_NODES, kpName } from '../data/graphSnapshot';
import { percent } from '../lib/format';
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

  const loadedRef = useRef<string | null>(null);

  // 刷新 / 带 ?attribution_id= 进入 → #14 回显
  useEffect(() => {
    if (!attributionId || loadedRef.current === attributionId) return;
    void (async () => {
      try {
        const view = await getAttribution(attributionId);
        loadedRef.current = view.attribution_id;
        store.setAttribution(view);
      } catch (error) {
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
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

  // ============================================================ 结果态
  if (store.attribution) {
    const view: AttributionView = store.attribution;
    const suspects = Object.entries(view.suspect_scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    const item = store.verification.item;
    const plan = store.plan;

    return (
      <section className="max-w-2xl">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-medium text-ink">{PHRASES.attributionFound}</h1>
          <span className="rounded-md bg-band-unstable/15 px-2 py-0.5 text-xs text-band-unstable">
            {ERROR_TYPE_LABEL[view.error_type]}
          </span>
          {view.verified ? (
            <span className="rounded-md bg-band-mastered/12 px-2 py-0.5 text-xs text-band-mastered">已验证</span>
          ) : null}
          {view.rejected_by_student ? (
            <span className="rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">{UI_TEXT.rejectRecorded}</span>
          ) : null}
        </header>

        <p className="mt-2 text-xs text-ink-soft">
          起点：{kpName(view.from_kp)} · 归因编号 {view.attribution_id}
        </p>

        {/* 回溯路径步进条 */}
        <div className="mt-5 rounded-2xl border border-line bg-white p-4 shadow-card">
          <h2 className="text-sm font-medium text-ink">回溯路径（从出错的地方往上找）</h2>
          <ol className="mt-3 space-y-2">
            {view.path.map((id, index) => {
              const isRoot = index === view.path.length - 1;
              return (
                <li key={id} className="flex items-start gap-3">
                  <span
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]',
                      isRoot ? 'bg-primary text-white' : 'bg-canvas text-ink-soft',
                    ].join(' ')}
                  >
                    {index + 1}
                  </span>
                  <div
                    className={[
                      'rounded-lg px-3 py-2 text-sm',
                      isRoot ? 'bg-primary-soft text-ink' : 'text-ink-soft',
                    ].join(' ')}
                  >
                    <span className="block">{kpName(id)}</span>
                    {isRoot ? <span className="block text-xs text-primary">根因就在这里</span> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-ink-soft">
            根因：<span className="text-ink">{kpName(view.root_cause)}</span>
          </p>
        </div>

        {suspects.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
            <h2 className="text-sm font-medium text-ink">嫌疑排序（前 3）</h2>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              {suspects.map(([suspect, score]) => (
                <li key={suspect} className="flex items-center justify-between">
                  <span>{kpName(suspect)}</span>
                  <span>{(score * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 验证区 */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          <h2 className="text-sm font-medium text-ink">验证一下</h2>

          {item ? (
            <>
              <p className="mt-1 text-xs text-ink-soft">
                做对这一题，就说明我们找对了方向（做错也没关系，我换一道再确认）。
              </p>
              <div className="mt-3">
                <ItemCard item={item} value={verifyAnswer} onChange={setVerifyAnswer} disabled={busy} />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitVerify()}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? '正在判…' : '提交这一步'}
              </button>
            </>
          ) : view.verified ? (
            <p className="mt-2 text-sm text-ink-soft">
              {lastCorrect === false
                ? '这道没过，我们换个方向继续看。'
                : `${UI_TEXT.verifyPassed}——这一环确实是我们该补的地方。`}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">{UI_TEXT.verificationExhausted}</p>
          )}
        </div>

        {/* 反驳（常驻） */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">不同意这个判断？</h2>
              <p className="mt-1 text-xs text-ink-soft">你比我更清楚当时怎么想的——说一句，我换一道题再确认。</p>
            </div>
            <button
              type="button"
              onClick={() => setRejectOpen((value) => !value)}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-ink-soft hover:bg-canvas"
            >
              反驳一下
            </button>
          </div>

          {rejectOpen ? (
            <div className="mt-3">
              <textarea
                className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                rows={2}
                placeholder="（可选）说说你的理由，比如「我其实会配方，只是这题看错了」"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitReject()}
                className="mt-2 rounded-lg bg-primary px-3 py-2 text-xs text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? '正在记…' : '提交反驳，换一道验证题'}
              </button>
            </div>
          ) : null}
        </div>

        {/* 处方 */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          {view.verified ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-ink">那就从这一环开始稳</h2>
                  <p className="mt-1 text-xs text-ink-soft">我给你排一条从根因往上补的路线，题从易到难。</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runPlan()}
                  className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs text-white hover:opacity-90 disabled:opacity-60"
                >
                  {plan ? '重新生成' : '给我一条路线'}
                </button>
              </div>

              {plan ? (
                <div className="mt-4">
                  <p className="text-sm text-ink">
                    策略：<span className="text-primary">{plan.strategy}</span>
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-ink-soft">
                    {plan.explanation_outline.map((line, index) => (
                      <li key={index}>· {line}</li>
                    ))}
                  </ol>
                  <ul className="mt-3 space-y-2">
                    {plan.item_sequence.map((sequenceItem) => (
                      <li key={sequenceItem.item_id} className="rounded-lg border border-line px-3 py-2 text-sm text-ink">
                        <span className="mr-2 text-xs text-ink-soft">难度 {sequenceItem.difficulty}</span>
                        {sequenceItem.stem}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/graph?path=${encodeURIComponent(plan.path.join(','))}`}
                    className="mt-3 inline-block rounded-lg border border-line px-3 py-2 text-xs text-ink hover:bg-canvas"
                  >
                    去图谱看学习路径
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-soft">先把上面这一步验证完，我再给你排路线。</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            store.reset();
            loadedRef.current = null;
            setLastCorrect(null);
            navigate('/attribution', { replace: true });
          }}
          className="mt-5 rounded-lg px-3 py-2 text-xs text-ink-soft hover:bg-white"
        >
          换一道错题重新归因
        </button>
      </section>
    );
  }

  // ============================================================ 向导态
  const wrongItems = activeSpaceId ? readPaperWrong(activeSpaceId) : [];
  const draft = store.draft;
  const adopted = store.classifyAdopted;
  const clarify = store.classifyClarify;

  const selectClass =
    'mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-primary';

  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">看看这道题错在哪</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        先告诉我一道错题。我会先复述你写的这一步，再说它大概属于哪一类——如果我拿不准，我会问你，而不是猜。
      </p>

      {/* 第一步：选错题来源 */}
      {draft === null ? (
        <div className="mt-6 space-y-4">
          {wrongItems.length > 0 ? (
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <h2 className="text-sm font-medium text-ink">从试卷错题里挑</h2>
              <ul className="mt-2 space-y-2">
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
                      className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm text-ink hover:border-primary"
                    >
                      <span className="block">{item.stem_excerpt}</span>
                      <span className="mt-1 block text-xs text-ink-soft">
                        {kpName(item.kp_id)} · 你的作答：{item.student_answer || '（空）'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <h2 className="text-sm font-medium text-ink">或者自己填一道</h2>
            <label className="mt-3 block text-xs text-ink-soft">
              题目（写个大概也行）
              <textarea
                className={selectClass}
                rows={2}
                value={stem}
                onChange={(event) => setStem(event.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs text-ink-soft">
              你当时怎么写的
              <textarea
                className={selectClass}
                rows={2}
                value={studentAnswer}
                onChange={(event) => setStudentAnswer(event.target.value)}
              />
            </label>
            <label className="mt-3 block text-xs text-ink-soft">
              这道题考的知识点
              <select className={selectClass} value={kpId} onChange={(event) => setKpId(event.target.value)}>
                {KP_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={stem.trim().length === 0 || studentAnswer.trim().length === 0}
              onClick={() => store.setDraft({ kpId, stem, studentAnswer, itemId: null })}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
            >
              下一步：先复述一遍
            </button>
          </div>
        </div>
      ) : null}

      {/* 第二步：复述确认 */}
      {draft !== null && !adopted && !clarify ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="text-xs text-ink-soft">{UI_TEXT.restateFirst}</p>
          <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">
            <p className="text-xs text-ink-soft">题目</p>
            <p className="mt-1 whitespace-pre-wrap">{draft.stem}</p>
            <p className="mt-3 text-xs text-ink-soft">你的作答</p>
            <p className="mt-1 whitespace-pre-wrap">{draft.studentAnswer}</p>
            <p className="mt-3 text-xs text-ink-soft">
              知识点：{kpName(draft.kpId)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runClassify(draft)}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? '正在看…' : '就是这样，看看属于哪类'}
            </button>
            <button
              type="button"
              onClick={() => store.reset()}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
            >
              换一道
            </button>
          </div>
        </div>
      ) : null}

      {/* 第三步 A：低置信就地追问（不自动 analyze） */}
      {clarify ? (
        <div className="mt-6 rounded-2xl border border-band-weak bg-band-weak/5 p-4">
          <p className="text-sm text-ink">{clarify.question}</p>
          <p className="mt-1 text-xs text-ink-soft">
            我拿不准就不硬猜——你把这一步写清楚，我再判一次。
          </p>
          <textarea
            className="mt-3 w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            rows={3}
            placeholder="比如把中间那一步式子写出来"
            value={clarifyInput}
            onChange={(event) => setClarifyInput(event.target.value)}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={busy || clarifyInput.trim().length === 0}
              onClick={() => {
                const current = store.draft;
                if (!current) return;
                const next: AttributionDraft = { ...current, studentAnswer: clarifyInput };
                store.setDraft(next);
                store.clearClassify();
                setClarifyInput('');
                void runClassify(next);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
            >
              {busy ? '再看一次…' : '再判一次'}
            </button>
            <button
              type="button"
              onClick={() => {
                store.clearClassify();
              }}
              className="rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
            >
              回到上一步
            </button>
          </div>
        </div>
      ) : null}

      {/* 第三步 B：判定结果（五类枚举） */}
      {adopted ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-ink">先复述你写的这一步</h2>
              <span className="text-xs text-ink-soft">把握 {percent(adopted.confidence)}</span>
            </div>
            {adopted.evidence ? (
              <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm leading-relaxed text-ink">
                {adopted.evidence}
              </p>
            ) : null}
            {adopted.matched_typical_error ? (
              <p className="mt-2 text-xs text-ink-soft">匹配到的典型失误：{adopted.matched_typical_error}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <h2 className="text-sm font-medium text-ink">它大概属于哪一类</h2>
            <ul className="mt-3 space-y-2">
              {ERROR_TYPES.map((type: ErrorTypeValue) => {
                const active = adopted.error_type === type;
                return (
                  <li
                    key={type}
                    className={[
                      'rounded-lg border px-3 py-2',
                      active ? 'border-primary bg-primary-soft' : 'border-line opacity-60',
                    ].join(' ')}
                  >
                    <p className="text-sm text-ink">{ERROR_TYPE_LABEL[type]}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{ERROR_TYPE_NOTE[type]}</p>
                  </li>
                );
              })}
            </ul>
          </div>

          {adopted.attribution_direction === 'none' ? (
            <div className="rounded-2xl border border-band-weak bg-band-weak/5 p-4 text-sm text-ink">
              <p>{UI_TEXT.slipNoAttribution}</p>
              <p className="mt-1 text-xs text-ink-soft">
                这类不属于知识缺口，所以我不往上游翻——你需要的只是再稳一遍手。
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  to="/assessment"
                  className="rounded-lg bg-primary px-3 py-2 text-xs text-white hover:opacity-90"
                >
                  再练几道
                </Link>
                <button
                  type="button"
                  onClick={() => store.reset()}
                  className="rounded-lg px-3 py-2 text-xs text-ink-soft hover:bg-canvas"
                >
                  看下一道错题
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAnalyze()}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? '正在往上找…' : '看看真正的根源'}
              </button>
              <button
                type="button"
                onClick={() => store.reset()}
                className="ml-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
              >
                换一道
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
