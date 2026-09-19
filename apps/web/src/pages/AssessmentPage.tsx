/**
 * 页 4 · 测评（PRD §5 #4「单题呈现 + 进度条，无对错反馈」；P0 #3 / #11）
 *
 * 契约：#7 POST /api/diagnose/next（mode / scope_chapter / exclude_item_ids）
 *       #8 POST /api/diagnose/submit（correct 仅测量模式有值）
 * 交互：三屏状态机 = 模式选择屏 → 单题屏（一屏一题）→ 结束屏；提交后用响应里的 next_item
 *       直接换题（少一次往返）；「跳过这道」把该题记入 doneIds 并继续。
 * 纪律：
 *   - **一律不展示对错**（D11）：diagnose 恒 null，baseline/retest 虽有 correct 也不渲染，
 *     结果统一由报告页 ΔAccuracy 呈现；
 *   - exclude_item_ids = 本轮 doneIds（含跳过题），服务端另有 evidence_events 兜底（双保险）；
 *   - converged=true 或 item=null → 结束屏；冷启动立即收敛（INFO-1）时引导先自报。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { diagnoseNext, diagnoseSubmit } from '../api/endpoints';
import type { DiagnoseMode } from '../api/types';
import ItemCard from '../components/ItemCard';
import ProgressBar from '../components/ProgressBar';
import { MODE_LABEL } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useAssessmentStore } from '../stores/assessment';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

interface ModeCard {
  value: DiagnoseMode;
  desc: string;
}

const MODE_CARDS: ModeCard[] = [
  { value: 'diagnose', desc: '从训练题池里挑题，专门找你现在卡住的地方。' },
  { value: 'baseline', desc: '干预前的基准 3 题（复测池），用来和之后再比一次。' },
  { value: 'retest', desc: '干预后的复测 3 题（复测池的另外几道，与基线题不重复）。' },
];

type Phase = 'select' | 'question' | 'done';

export default function AssessmentPage() {
  const [phase, setPhase] = useState<Phase>('select');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  const store = useAssessmentStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  const answered = store.submittedCount;
  /** 进度条总量 = 已答（含跳过）+ 剩余。 */
  const total = answered + store.remaining;

  function requireSpace(): string | null {
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      navigate(SPACES_PATH);
      return null;
    }
    return activeSpaceId;
  }

  function handleError(error: unknown): void {
    toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
  }

  async function startMode(mode: DiagnoseMode): Promise<void> {
    const spaceId = requireSpace();
    if (!spaceId) return;

    store.start(mode);
    setAnswer('');
    setBusy(true);
    try {
      const data = await diagnoseNext({ space_id: spaceId, mode });
      store.setCurrent(data.item, data.remaining);
      setPhase(data.item === null || data.converged ? 'done' : 'question');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(): Promise<void> {
    const spaceId = requireSpace();
    const item = store.currentItem;
    if (!spaceId || !item || busy) return;
    if (answer.trim().length === 0) {
      toast('写点东西我再往下走（写一步也行）', 'warn');
      return;
    }

    setBusy(true);
    try {
      const data = await diagnoseSubmit({
        space_id: spaceId,
        item_id: item.item_id,
        answer,
        mode: store.mode,
      });
      // 不读 data.correct（D11 不展示对错）；只用 next_item / converged 推进
      store.markSubmitted(item.item_id, data.next_item, Math.max(0, store.remaining - 1), data.converged);
      setAnswer('');
      setPhase(data.next_item === null || data.converged ? 'done' : 'question');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  async function skipItem(): Promise<void> {
    const spaceId = requireSpace();
    const item = store.currentItem;
    if (!spaceId || !item || busy) return;

    store.markSkipped(item.item_id);
    setAnswer('');
    setBusy(true);
    try {
      const data = await diagnoseNext({
        space_id: spaceId,
        mode: store.mode,
        exclude_item_ids: store.doneIds,
      });
      store.setCurrent(data.item, data.remaining);
      setPhase(data.item === null || data.converged ? 'done' : 'question');
    } catch (error) {
      handleError(error);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ 结束屏
  if (phase === 'done') {
    const tooFast = store.submittedCount === 0;
    return (
      <section className="mx-auto max-w-xl">
        <h1 className="text-xl font-medium text-ink">
          {tooFast ? '这一轮很快就收敛了' : UI_TEXT.assessmentDone}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {tooFast ? UI_TEXT.assessmentDoneTooFast : '你的地图已经更新，接下来可以看图谱或报告，也可以直接进对话问我。'}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(tooFast ? '/self-report' : '/graph')}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90"
          >
            {tooFast ? '去花 30 秒自报' : '看看我的地图'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink hover:bg-white"
          >
            打开学习报告
          </button>
          <button
            type="button"
            onClick={() => {
              store.reset();
              setPhase('select');
            }}
            className="rounded-lg px-4 py-2.5 text-sm text-ink-soft hover:bg-white"
          >
            换一种测评
          </button>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ 模式选择屏
  if (phase === 'select') {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="text-xl font-medium text-ink">选一种测评</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          一次只做一件事：你要么让我找卡点（诊断），要么先量一个基准（基线/复测）。题目都只出现一次，
          做过的不再出。
        </p>

        <ul className="mt-6 space-y-3">
          {MODE_CARDS.map((card) => (
            <li key={card.value}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startMode(card.value)}
                className="w-full rounded-2xl border border-line bg-white p-5 text-left hover:border-primary disabled:opacity-60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-ink">{MODE_LABEL[card.value]}</span>
                  <span className="text-xs text-ink-soft">{card.value}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.desc}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // ------------------------------------------------------------ 单题屏
  const item = store.currentItem;
  if (!item) {
    return (
      <section className="mx-auto max-w-2xl">
        <p className="text-sm text-ink-soft">正在取题…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-medium text-ink">{MODE_LABEL[store.mode]}</h1>
        <span className="text-xs text-ink-soft">剩 {store.remaining} 题</span>
      </div>

      <div className="mt-3">
        <ProgressBar answered={answered} total={Math.max(total, 1)} />
      </div>

      <div className="mt-5">
        <ItemCard item={item} value={answer} onChange={setAnswer} disabled={busy} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitAnswer()}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? '记一下…' : '下一题'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void skipItem()}
          className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:bg-white disabled:opacity-60"
        >
          这道先跳过
        </button>
      </div>

      <p className="mt-4 text-xs text-ink-soft">
        我不会当场告诉你对错——分数攒着，等这一轮完了我们一起看整体。跳过也没关系。
      </p>
    </section>
  );
}
