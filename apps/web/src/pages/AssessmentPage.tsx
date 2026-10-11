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
 *
 * ── style-10「青蓝蓝图」迁移 P9.1（2026-10-11 第 4 轮）：本页视觉层按原型
 *    PAGES.assess（tempui/prototypes/style-10/index.html L2107-2213）逐段复现，
 *    **业务逻辑一行不改**（状态机三阶段 / 取数 handler / 依赖数组 / 导航目标 / toast 话术
 *    全部原样）：
 *    ① 页头 SheetHead：eyebrow「ASSESS / 证据采集（静默通路）」+ SHEET 10-06 + 需求 2.6 +
 *      h1「测评：只采集，不当场判对错」+ chip「T0 · 静默」；页头归页面自有
 *      （D24：Layout 的 PAGE_OWNED_HEAD 登记 '/assessment'，外壳不再补第二份 h1）
 *    ② 三条约定（原型 disc L2116-2118）：flat 面板 + tick-list，落静默通路的既有纪律
 *      （不判对错 / 不给答案 / 跳过与离开都不丢证据）
 *    ③ STAGE1 01 选模式（原型 L2120-2136）：三张模式卡（panel + panel-h + desc + 开始键），
 *      预选高亮（?mode=retest，既有语义）与 ?kp= 定位提示原样保留；02 随时可走（原型 L2135）
 *    ④ STAGE2 01 逐题作答（原型 L2173-2189）：chips 行 + 原型 hbar（2px 细进度条）+
 *      题干 panel（ItemCard，已随组件库的题卡制式）+ 提交 / 跳过 / 随时离开
 *    ⑤ STAGE3 01 本轮结束（原型 L2149-2154）：环节结论面板 + 出口行；「本轮没能出题」
 *      （收敛过快，既有 tooFast 判据）落区域级空盒（原型 L2141-2143 的 emptyBox 对位）
 *
 * 【四态（规范 §7 assess 行，区域级）】
 *   empty（本轮无题）→ EmptyState 虚线空盒（既有文案，D5）
 *   error（取数失败）→ Stamp 红章 + 真重试（D15c 同口径的最小新增：handler 里记下失败
 *     动作，红章的重试重新发起**同一个**请求；既有 toast 话术保留）
 *   无空间 → requireSpace 的既有 toast + 重定向语义一行不改（R19 取证口径）
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { diagnoseNext, diagnoseSubmit } from '../api/endpoints';
import type { DiagnoseMode } from '../api/types';
import ItemCard from '../components/ItemCard';
import NextStepCard from '../components/NextStepCard';
import { Badge, Button, buttonVariants } from '../components/ui';
import { useBlueprintTier } from '../components/blueprint/Board';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import Stamp from '../components/blueprint/Stamp';
import EmptyState from '../components/EmptyState';
import { cn } from '../lib/cn';
import { GRAPH_CHAPTERS } from '../data/graphSnapshot';
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

// 模式卡文案学长化（2026-10-09 复测入口包 C）：对学生的可见文案去掉「复测池」「干预前水平」
// 等研究术语，改成学长口吻、不施压不说教；mode 枚举值本身不动（只影响 payload 语义）。
const MODE_CARDS: ModeCard[] = [
  { value: 'diagnose', desc: '挑几道练过的题，专门找你现在卡在哪儿。' },
  { value: 'baseline', desc: '先做 3 道题，记下你现在的高度——之后补完了，回来再比一比。' },
  { value: 'retest', desc: '补完之后，做几道没见过的新题，看看是不是真的补上了。' },
];

/** 图号与需求号（原型 sheetHead L2113 的 SHEET 10-06 / 需求 2.6）。 */
const SHEET_NO = '10-06';
const SECTION_NO = '2.6';

type Phase = 'select' | 'question' | 'done';

/** 静默通路的既有纪律（原型 disc L2116-2118 的 A.discipline 三行对位，措辞按 D5 用本工程口径）。 */
const DISCIPLINE_LINES = [
  '不当场判定对错：这一轮只采集证据，判读统一放在学习报告里。',
  '不给答案与解析：题目只走一次，做过的不再出现。',
  '跳过与离开都不算失败：跳过的题不再出现，已提交的证据也不会丢。',
] as const;

/** 区域级失败态（D15c 口径）：记下失败的是哪一次动作，红章的重试重新发起同一个请求。 */
type FailedAction = { kind: 'next' } | { kind: 'submit' } | { kind: 'skip' };

export default function AssessmentPage() {
  const [phase, setPhase] = useState<Phase>('select');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  /** 区域级红章的入参（表现层新增，见文件头四态说明）。 */
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null);

  const store = useAssessmentStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const tier = useBlueprintTier();

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

  function handleError(error: unknown, action: FailedAction): void {
    // 既有 toast 话术原样保留；额外记下失败动作，供区域级红章给「真重试」。
    setFailedAction(action);
    toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
  }

  async function startMode(mode: DiagnoseMode): Promise<void> {
    const spaceId = requireSpace();
    if (!spaceId) return;

    setFailedAction(null);
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
      handleError(error, { kind: 'next' });
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

    setFailedAction(null);
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
      handleError(error, { kind: 'submit' });
    } finally {
      setBusy(false);
    }
  }

  async function skipItem(): Promise<void> {
    const spaceId = requireSpace();
    const item = store.currentItem;
    if (!spaceId || !item || busy) return;

    setFailedAction(null);
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
      handleError(error, { kind: 'skip' });
    } finally {
      setBusy(false);
    }
  }

  /** 区域级红章的真重试：重新发起**同一个**请求，不新开取数路径（规范 5.8 / D10）。 */
  async function retryFailed(): Promise<void> {
    const kind = failedAction?.kind;
    setFailedAction(null);
    if (kind === 'submit') await submitAnswer();
    else if (kind === 'skip') await skipItem();
    else await startMode(store.mode);
  }

  const pageHead = (
    <SheetHead
      eyebrow="ASSESS / 证据采集（静默通路）"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="测评：只采集，不当场判对错"
      sub="一次只做一件事：你要么让我找卡点（诊断），要么先量一量现在的水平、之后再来比一比。题目都只出现一次，做过的不再出。"
      chips={<Badge tone="accent">T0 · 静默</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  /** 三条约定（原型 disc）：静默通路的三条纪律，全阶段常在。 */
  const discipline = (
    <div className="bp-flat mb-6 p-4">
      <div className="flex items-center gap-2">
        <span className="num-mono text-accent-ink" aria-hidden="true">
          !
        </span>
        <h2 className="font-disp text-ui-sm tracking-tight text-ink">这一轮的三条约定</h2>
      </div>
      <ul className="bp-tick-list mt-2.5">
        {DISCIPLINE_LINES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );

  /** 区域级红章（D15c）：插在 loading 之后、数据态之前的位置（本页无 loading 窗口）。 */
  const failureStamp = failedAction ? (
    <Stamp
      className="mb-6"
      reason="这一次没能取到题目（网络中断，或服务暂时没有响应）。已经记下的题不会丢，重试一次通常就能继续；一直取不到时可以先回学习空间看一眼。"
      onRetry={() => {
        void retryFailed();
      }}
      retrying={busy}
      alt={{ label: '回到学习空间', to: SPACES_PATH }}
    />
  ) : null;

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
    const actionRow = (
      <div className="flex flex-wrap items-center gap-3">
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
    );

    return (
      <>
        {pageHead}
        {failureStamp}
        <SheetBlock
          no="01"
          title="本轮结束"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 3 / 3</span>}
        >
          {/* 区域级空态（原型 L2141-2143 的 emptyBox 对位）：本轮没能凑出题来 —— 既有
              tooFast 判据（冷启动立即收敛，INFO-1）唯一确定，文案与出路沿用既有口径。 */}
          {tooFast ? (
            <EmptyState
              tag="NO QUESTIONS DRAWN"
              title={guidance.title}
              hint={guidance.description}
              action={actionRow}
            />
          ) : (
            <div className="bp-panel p-4">
              <h3 className="font-disp text-title-sm tracking-tight text-ink">{guidance.title}</h3>
              <p className="mt-1.5 text-body-sm text-ink-soft">{guidance.description}</p>
              <p className="bp-note mt-3">
                按需求 2.6：结束反馈里不出现对错判定，也不给答案或解析。这一轮已提交的证据都写进当前空间了。
              </p>
              {store.mode === 'retest' ? (
                <NextStepCard
                  className="mt-4"
                  status="复测 3 题记完了"
                  // 文案去研究术语（包 C）：不再对学生说「基线」。
                  hint="同一批知识点的两次成绩现在可以并排比了。"
                  actions={[{ label: '打开学习报告', to: '/report', primary: true }]}
                />
              ) : null}
              {store.mode === 'baseline' ? (
                <NextStepCard
                  className="mt-4"
                  // 文案去研究术语（包 C）：去掉「（复测池）」这类研究口径词。
                  status="这 3 题记完了，你的起点有了"
                  hint="补完回来再点一次「复测测量」，两次一比就能看到变化。"
                  actions={[
                    { label: '去对话页补一补', to: '/chat', primary: true },
                    { label: '看看我的地图', to: '/graph' },
                  ]}
                />
              ) : null}
              <div className="mt-4">{actionRow}</div>
            </div>
          )}
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 模式选择屏
  if (phase === 'select') {
    return (
      <>
        {pageHead}
        {discipline}
        {failureStamp}
        <SheetBlock
          no="01"
          title="选模式"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
        >
          {focusChapter && focusKp ? (
            <p className="bp-note mb-4">
              已按你在技能树点的知识点定位到「<b className="num-mono">{focusChapter}</b>
              」——选「诊断测评」就只出这一章的题。
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-4 narrow:grid-cols-2 sheet:grid-cols-3">
            {MODE_CARDS.map((card) => (
              <article
                key={card.value}
                className={cn(
                  // 原型 L2124：模式卡 = panel，`?mode=` 预选时描边走高亮色（既有高亮语义不变）。
                  'bp-panel flex flex-col p-4',
                  card.value === preselectedMode ? 'border-accent' : '',
                )}
              >
                <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-disp text-ui-sm tracking-tight text-ink">
                    {MODE_LABEL[card.value]}
                  </h3>
                  {/* mode 枚举（diagnose/baseline/retest）不再直出给学生（包 C）：
                      只保留一份 sr-only 给读屏/测试定位用。 */}
                  <span className="sr-only font-mono text-mono-xs text-ink-soft">{card.value}</span>
                </div>
                <p className="flex-1 text-body-sm leading-relaxed text-ink-soft">{card.desc}</p>
                {card.value === preselectedMode ? (
                  <p className="bp-note bp-note--ok mt-3">已为你选好这个模式，点下面的键就开始。</p>
                ) : null}
                <Button
                  className="mt-4 self-start"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void startMode(card.value)}
                >
                  {`开始${MODE_LABEL[card.value]}`}
                </Button>
              </article>
            ))}
          </div>
        </SheetBlock>

        <SheetBlock no="02" title="随时可走">
          <p className="bp-note">
            已答 {answered} 题。中途离开不指责：
            <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'link' }))}>
              回空间页
            </Link>
            <Link to="/graph" className={cn(buttonVariants({ variant: 'link' }))}>
              看技能树
            </Link>
            <Link to="/report" className={cn(buttonVariants({ variant: 'link' }))}>
              学习报告
            </Link>
            。
          </p>
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 单题屏
  const item = store.currentItem;
  if (!item) {
    return (
      <>
        {pageHead}
        {discipline}
        <SheetBlock no="01" title="逐题作答">
          <p className="bp-note">正在取题……</p>
        </SheetBlock>
      </>
    );
  }

  const safeTotal = Math.max(total, 1);
  const progressPct = Math.round(Math.min(1, answered / safeTotal) * 100);

  return (
    <>
      {pageHead}
      {discipline}
      {failureStamp}
      <SheetBlock
        no="01"
        title="逐题作答"
        right={
          <span className="num-mono text-tok text-ink-soft">
            {`STAGE 2 / 3 · ${MODE_LABEL[store.mode]}`}
          </span>
        }
      >
        {/* 进度条只数题（原型 L2175-2180）：chips 行 + hbar，全程不出现对错标记。 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone="accent">{`第 ${answered + 1} / ${safeTotal} 题`}</Badge>
          <Badge>{`已答 ${answered} 题`}</Badge>
          <Badge>{`剩 ${store.remaining} 题`}</Badge>
          <span className="ml-auto tok text-ink-soft" aria-live="polite">
            本轮不当场告知对错
          </span>
        </div>
        <div
          className="bp-hbar mt-2.5"
          role="img"
          aria-label={`已答 ${answered} 题，共 ${safeTotal} 题`}
        >
          <i style={{ width: `${progressPct}%` }} />
        </div>

        <div className="mt-4">
          <ItemCard
            item={item}
            value={answer}
            onChange={setAnswer}
            disabled={busy}
            dwg={SHEET_NO}
            header={MODE_LABEL[store.mode]}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => void submitAnswer()}>
            {busy ? '记一下…' : '下一题'}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void skipItem()}>
            这道先跳过
          </Button>
          <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'link' }))}>
            随时离开
          </Link>
        </div>

        <p className="mt-3 text-ui-sm text-ink-soft">
          跳过也没关系，跳过的题后面不再出现；离开后已提交的证据不会丢。
        </p>

        {/* 中途路标（2026-10-08 用户走查）：答过 2 题后出现——告诉学生"随时可以走，
            进度与地图都在"，把闭环下一步显式递到眼前，不用等做完 10 题。 */}
        {answered >= 2 ? (
          <NextStepCard
            className="mt-5"
            no="02"
            status={`已经记了 ${answered} 题（可随时离开，进度留着）`}
            hint="想先看看这些题撬动了什么，随时可以去地图或报告瞄一眼，回来接着答。"
            actions={[
              { label: '看看我的地图', to: '/graph', primary: true },
              { label: '打开学习报告', to: '/report' },
            ]}
          />
        ) : null}
      </SheetBlock>
    </>
  );
}
