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
import PageSkeleton from '../components/PageSkeleton';
import ProgressBar from '../components/ProgressBar';
import { MODE_LABEL } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useAssessmentStore } from '../stores/assessment';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

type Phase = 'select' | 'question' | 'done';
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function TargetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" {...strokeProps}>
      <circle cx="10" cy="10" r="7.2" />
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 1.4v2.6M10 16v2.6M1.4 10h2.6M16 10h2.6" />
    </svg>
  );
}
function RulerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" {...strokeProps}>
      <rect x="1.8" y="6.6" width="16.4" height="6.8" rx="1.6" />
      <path d="M5.6 6.6v2.6M8.8 6.6v3.6M12 6.6v2.6M15.2 6.6v3.6" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" {...strokeProps}>
      <path d="M3 10a7 7 0 1 0 2.6-5.5" />
      <path d="M3 3.6V7h3.4" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" {...strokeProps}>
      <path d="M8 1.8 9.6 6 13.8 7.6 9.6 9.2 8 13.4 6.4 9.2 2.2 7.6 6.4 6z" />
    </svg>
  );
}

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
    toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
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
      <section className="max-w-xl">
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
            className="rounded-lg bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90"
          >
            {tooFast ? '去花 30 秒自报' : '看看我的地图'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/report')}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink hover:bg-surface"
          >
            打开学习报告
          </button>
          <button
            type="button"
            onClick={() => {
              store.reset();
              setPhase('select');
            }}
            className="rounded-lg px-4 py-2.5 text-sm text-ink-soft hover:bg-surface"
          >
            换一种测评
          </button>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ 模式选择屏
  if (phase === 'select') {
    const modes = [
      {
        mode: 'diagnose' as DiagnoseMode,
        icon: <TargetIcon />,
        tone: '',
        tag: '建议先做',
        tagClass: 'tag tag-accent',
        title: '诊断测评',
        desc: '用自适应题逐层缩小范围，定位到具体的知识点与错因类型，产出一份结构化的诊断画像。',
        note: '自适应收敛 · 定位到卡点即停，做过的题不再出',
        num: '自适应',
        cta: '开始诊断',
        primary: true,
      },
      {
        mode: 'baseline' as DiagnoseMode,
        icon: <RulerIcon />,
        tone: 'is-green',
        tag: '基准',
        tagClass: 'tag',
        title: '基线测量',
        desc: '在学期初或新空间启用时测量一次能力基线，作为之后每次进步的对照基准。基线只测一次。',
        note: '干预前基准 · 只测一次，复测用来对照',
        num: '3',
        cta: '建立基线',
        primary: false,
      },
      {
        mode: 'retest' as DiagnoseMode,
        icon: <RedoIcon />,
        tone: 'is-amber',
        tag: '对照',
        tagClass: 'tag',
        title: '复测测量',
        desc: '与基线逐题对照，检验这一阶段的学习效果，并把结果写回知识图谱更新掌握程度。',
        note: '与基线逐题对照 · 结果写回知识图谱',
        num: '3',
        cta: '开始复测',
        primary: false,
      },
    ];

    return (
      <section>
        <header className="page-head">
          <div>
            <h1 className="t-display">测评</h1>
            <p className="page-lead">
              三种测评各有分工：诊断定位问题，基线锚定起点，复测检验效果。每次测评结果都会写回知识图谱。
            </p>
          </div>
        </header>
        <div className="stack">
          {modes.map((m) => (
            <article
              key={m.mode}
              className="card card-hover assess"
              style={{ cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
              onClick={() => void startMode(m.mode)}
            >
              <span className={`assess-icon ${m.tone}`}>{m.icon}</span>
              <div className="assess-body">
                <div className="assess-title-row">
                  <h2 className="t-h2">{m.title}</h2>
                  <span className={m.tagClass}>{m.tag}</span>
                </div>
                <p className="assess-desc">{m.desc}</p>
                <div className="assess-note">
                  <SparkIcon />
                  <span>{m.note}</span>
                </div>
              </div>
              <div className="assess-side">
                <div className="assess-metric">
                  <span className="num">{m.num}</span>
                  <span className="unit">题</span>
                </div>
                <button type="button" disabled={busy} className={`btn ${m.primary ? 'btn-primary' : 'btn-ghost'} btn-lg`}>
                  {m.cta}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ 单题屏
  const item = store.currentItem;
  if (!item) {
    return (
      <section className="max-w-2xl">
        <PageSkeleton label="正在取题…" rows={1} />
      </section>
    );
  }

  return (
    <section className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-medium text-ink">{MODE_LABEL[store.mode]}</h1>
        <span className="text-[13px] text-ink-soft">剩 {store.remaining} 题</span>
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
          className="rounded-lg bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {busy ? '记一下…' : '下一题'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void skipItem()}
          className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink-soft hover:bg-surface disabled:opacity-60"
        >
          这道先跳过
        </button>
      </div>

      <p className="mt-4 text-[13px] text-ink-soft">
        我不会当场告诉你对错——分数攒着，等这一轮完了我们一起看整体。跳过也没关系。
      </p>
    </section>
  );
}
