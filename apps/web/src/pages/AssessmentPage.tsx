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

import { type ReactNode, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { diagnoseNext, diagnoseSubmit } from '../api/endpoints';
import type { DiagnoseMode } from '../api/types';
import ItemCard from '../components/ItemCard';
import NextStepCard from '../components/NextStepCard';
import PageSkeleton from '../components/PageSkeleton';
import ProgressBar from '../components/ProgressBar';
import { Button, PageContainer, PageHeader } from '../components/ui';
import { GRAPH_CHAPTERS } from '../data/graphSnapshot';
import { MODE_LABEL } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { useReveal } from '../lib/useReveal';
import { SPACES_PATH } from '../router';
import { useAssessmentStore } from '../stores/assessment';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

interface ModeCard {
  value: DiagnoseMode;
  desc: string;
}

// 模式卡文案学长化（2026-10-09 复测入口包 C）：对学生的可见文案去掉「复测池」「干预前水平」
// 等研究术语，改成学长口吻、不施压不说教；mode 枚举值本身不动（只影响 payload 语义）。
const MODE_CARDS: ModeCard[] = [
  { value: 'diagnose', desc: '挑几道练过的题，专门找你现在卡在哪儿。' },
  { value: 'baseline', desc: '先做 3 道题，记下你现在的高度——之后补完了，回来再比一比。' },
  { value: 'retest', desc: '补完之后，做几道没见过的新题，看看是不是真的补上了。' },
];

type Phase = 'select' | 'question' | 'done';

/** 包 E（设计语言统一）：模式卡逐条揭示容器——once 语义，进入视口才揭示；
 *  同屏错峰走 style.animationDelay（reduced-motion 全局 reduce 块会归零 delay，安全）。 */
function RevealModeCard({ delayMs = 0, children }: { delayMs?: number; children: ReactNode }) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={inView ? 'reveal-section is-revealed' : 'reveal-section'}
      style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
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

  /** ?kp= 从技能树「去攻克」带来：只给「诊断测评」加 scope_chapter（契约 #7），
   *  基线/复测池语义不动（v2.1 评审 P2：CTA 不断上下文）。 */
  const [params] = useSearchParams();
  const focusKp = params.get('kp');
  const focusChapter = focusKp
    ? (GRAPH_CHAPTERS.find((entry) => entry.kp_ids.includes(focusKp))?.name ?? null)
    : null;
  // ?mode=retest（图谱详情卡复测 CTA 带入，2026-10-09 包 C）：模式卡是「点了即开始」、
  // 没有二段确认屏，所以「预选」= 高亮该卡并提示一句，仍由学生自己点下去，不自动开跑。
  const preselectedMode = MODE_CARDS.some((card) => card.value === params.get('mode'))
    ? params.get('mode')
    : null;

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
      const data = await diagnoseNext({
        space_id: spaceId,
        mode,
        ...(mode === 'diagnose' && focusChapter ? { scope_chapter: focusChapter } : {}),
      });
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
        ...(store.mode === 'diagnose' && focusChapter ? { scope_chapter: focusChapter } : {}),
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
    // 下一步引导按模式分流（2026-10-08 用户走查：五步闭环的转场不该靠学生自己悟）：
    //   diagnose → 已定位卡点，去看图谱/报告；baseline → 基准已量，去干预（对话/图谱）后复测；
    //   retest → 复测完成，直接去报告看 ΔAccuracy。
    const doneGuidance: Record<DiagnoseMode, { title: string; description: string }> = {
      diagnose: {
        title: tooFast ? '这一轮很快就收敛了' : UI_TEXT.assessmentDone,
        description: tooFast
          ? UI_TEXT.assessmentDoneTooFast
          : '你的地图已经更新，接下来可以看图谱或报告，也可以直接进对话问我。',
      },
      baseline: {
        title: '基准记下了',
        // 文案去研究术语（包 C）：不再对学生说「干预前水平」。
        description:
          '这 3 题先记下了你现在的水平。接下来去对话页让我带你补一补，或者去图谱挑个薄弱点——之后回来再做一次复测，就能看到变化。',
      },
      retest: {
        title: '复测完成',
        // 文案去研究术语（包 C）：ΔAccuracy 这类词留到报告页用图形表达，这里只说人话。
        description:
          '这几道新题和上次那组不重复，所以变化是真实的。去报告页看两次的对比——补没补上，数字说话。',
      },
    };
    const guidance = doneGuidance[store.mode] ?? {
      title: UI_TEXT.assessmentDone,
      description: '你的地图已经更新，接下来可以看图谱或报告，也可以直接进对话问我。',
    };
    const doneActions =
      store.mode === 'retest'
        ? [
            // 按钮文案学长化（包 C）：ΔAccuracy 是研究记号，对学生只说「看变化」。
            { label: '去报告看变化', to: '/report', primary: true },
            { label: '换一种测评', to: '', primary: false },
          ]
        : store.mode === 'baseline'
          ? [
              { label: '去对话页补一补', to: '/chat', primary: true },
              { label: '看看我的地图', to: '/graph', primary: false },
            ]
          : [
              { label: tooFast ? '去花 30 秒自报' : '看看我的地图', to: tooFast ? '/self-report' : '/graph', primary: true },
              { label: '打开学习报告', to: '/report', primary: false },
            ];
    return (
      <PageContainer width="prose">
        <PageHeader title={guidance.title} description={guidance.description} />
        {store.mode === 'retest' ? (
          <NextStepCard
            className="mt-6"
            status="复测 3 题记完了"
            // 文案去研究术语（包 C）：不再对学生说「基线」。
            hint="同一批知识点的两次成绩现在可以并排比了。"
            actions={[{ label: '打开学习报告', to: '/report', primary: true }]}
          />
        ) : null}
        {store.mode === 'baseline' ? (
          <NextStepCard
            className="mt-6"
            // 文案去研究术语（包 C）：去掉「（复测池）」这类研究口径词。
            status="这 3 题记完了，你的起点有了"
            hint="补完回来再点一次「复测测量」，两次一比就能看到变化。"
            actions={[
              { label: '去对话页补一补', to: '/chat', primary: true },
              { label: '看看我的地图', to: '/graph' },
            ]}
          />
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {doneActions.map((action) =>
            action.to.length > 0 ? (
              <Button
                key={action.label}
                variant={action.primary ? 'primary' : 'secondary'}
                onClick={() => navigate(action.to)}
              >
                {action.label}
              </Button>
            ) : (
              <Button
                key={action.label}
                variant="ghost"
                onClick={() => {
                  store.reset();
                  setPhase('select');
                }}
              >
                {action.label}
              </Button>
            ),
          )}
        </div>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 模式选择屏
  if (phase === 'select') {
    return (
      <PageContainer width="standard">
        <PageHeader
          title="选一种测评"
          // 文案去研究术语（包 C）：不再对学生说「基线/复测」的口径词，只说用途。
          description="一次只做一件事：你要么让我找卡点（诊断），要么先量一量现在的水平、之后再来比一比。题目都只出现一次，做过的不再出。"
        />
        {focusChapter && focusKp ? (
          <p className="mt-2 text-ui-sm text-accent-ink">
            已按你在技能树点的知识点定位到「{focusChapter}」——选「诊断测评」就只出这一章的题。
          </p>
        ) : null}

        <ul className="mt-6 space-y-3">
          {MODE_CARDS.map((card, index) => (
            <li key={card.value}>
              {/* 包 E：模式卡升为 glass-card 玻璃面（替换 bg-surface）+ 逐条错峰揭示（80ms 步进）；
                  ?mode=retest 的 border-accent 高亮逻辑零改动（glass-card 只管面，不管描边色）。 */}
              <RevealModeCard delayMs={index * 80}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startMode(card.value)}
                  className={`glass-card w-full rounded-surface border p-5 text-left shadow-card transition-colors hover:border-accent disabled:opacity-60 ${
                  // ?mode=retest 预选（包 C）：用主色描边 + 提示语把「选好了」说清楚，不自动开跑。
                  card.value === preselectedMode ? 'border-accent' : 'border-line'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-medium text-ink">{MODE_LABEL[card.value]}</span>
                  {/* mode 枚举（diagnose/baseline/retest）不再直出给学生（包 C）：
                      只保留一份 sr-only 给读屏/测试定位用。 */}
                  <span className="sr-only font-mono text-ui-sm text-ink-soft">{card.value}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.desc}</p>
                {card.value === preselectedMode ? (
                  <p className="mt-1 text-ui-sm text-accent-ink">已为你选好这个模式，点卡片就开始。</p>
                ) : null}
                </button>
              </RevealModeCard>
            </li>
          ))}
        </ul>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 单题屏
  const item = store.currentItem;
  if (!item) {
    return (
      <PageContainer width="standard">
        <PageSkeleton label="正在取题…" rows={1} />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="standard">
      {/* 这里不用 PageHeader：单题屏的「模式名 + 剩题数」是**进行中状态条**，
          不是页面标题区 —— 它该贴着进度条，而不是撑出一个 24px 的落点。 */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base font-medium text-ink">{MODE_LABEL[store.mode]}</h1>
        <span className="font-mono text-ui-sm tabular-nums text-ink-soft">剩 {store.remaining} 题</span>
      </div>

      <div className="mt-3">
        <ProgressBar answered={answered} total={Math.max(total, 1)} />
      </div>

      <div className="mt-5">
        <ItemCard item={item} value={answer} onChange={setAnswer} disabled={busy} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={() => void submitAnswer()}>
          {busy ? '记一下…' : '下一题'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void skipItem()}>
          这道先跳过
        </Button>
      </div>

      {/* 中途路标（2026-10-08 用户走查）：答过 2 题后出现——告诉学生"随时可以走，
          进度与地图都在"，把闭环下一步显式递到眼前，不用等做完 10 题。 */}
      {answered >= 2 ? (
        <NextStepCard
          className="mt-5"
          status={`已经记了 ${answered} 题（可随时离开，进度留着）`}
          hint="想先看看这些题撬动了什么，随时可以去地图或报告瞄一眼，回来接着答。"
          actions={[
            { label: '看看我的地图', to: '/graph', primary: true },
            { label: '打开学习报告', to: '/report' },
          ]}
        />
      ) : null}

      <p className="mt-4 text-ui-sm text-ink-soft">
        我不会当场告诉你对错——分数攒着，等这一轮完了我们一起看整体。跳过也没关系。
      </p>
    </PageContainer>
  );
}
