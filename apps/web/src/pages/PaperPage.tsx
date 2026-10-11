/**
 * 页 5 · 试卷上传与逐题确认（PRD §5 #5「识别进度 → 逐题确认对错」；P0 #4）
 *
 * 契约：#5 GET /api/space/{space_id}/drive（选预置文件）
 *       #9 POST /api/evidence/paper（识别；502/504 用户可读话术）
 *       #10 GET /api/evidence/paper/{recognition_id}（刷新回显）
 *       #11 POST /api/evidence/paper/confirm
 * 交互（三段式）：选预置文件 → 识别中（展示 status）→ 逐题确认列表。
 * 纪律：
 *   - **unclear 行强制无默认值**：所有行的「对/错」都不预选，suggested_result 只作参考样式；
 *     未标全则提交按钮禁用（服务端同样拒绝默认值，前端只是提前拦住）；
 *   - 识别不产生证据、不更新掌握度（确认才生效）——页面文案如实说明；
 *   - 知识点减负（2026-10-09）：识别猜的点收成「识别猜的」徽标按钮（点开才是按章节
 *     分组的 select，选完自动收起），多数行零操作；识别没猜才直接给 select —— 不装作有默认；
 *   - 本地无云存储直传（契约 §9 指向云环境）→ 演示态从预置文件里选，不伪造上传。
 *
 * ── style-10「青蓝蓝图」迁移 P9.3（2026-10-11 第 4 轮）：本页视觉层按原型
 *    PAGES.paper（tempui/prototypes/style-10/index.html L2213-2348）逐段复现，
 *    **业务逻辑一行不改**（三段流转 / 取数 handler / 依赖数组 / 导航目标 / toast 话术
 *    全部原样）：
 *    ① 页头 SheetHead：eyebrow「PAPER / 批量证据采集（三段）」+ SHEET 10-07 + 需求 2.7 +
 *      h1「拍一张最近的试卷」+ chip「T0 · 明判草稿」；页头归页面自有（D24：Layout 的
 *      PAGE_OWNED_HEAD 登记 '/paper'，外壳不再补第二份 h1）
 *    ② 阶段条（原型 segs L2221-2225）：01 选文件 / 02 逐题确认 / 03 完成 + 「三段之间单向推进」
 *    ③ STAGE1 01 预置文件库（原型 L2227-2248）：已选 n/5 chip + 清空 + 细网格表格
 *      （勾选框制式 .bp-check / 文件名 / 类型 / 大小 / 备注）+ 开始识别主键与其禁用说明
 *    ④ STAGE2 01 逐题确认（原型 L2251-2295）：已判定 chip + 一键采纳 + 每题的
 *      panel（卷面识别 tok / 题干 / bp-kv 识别出的作答 / VERDICT 分段 / 知识点字段）
 *      + 提交前缺口红章（原型 .stamp INCOMPLETE：逐条列出第几题缺什么）
 *    ⑤ STAGE3 01 完成（原型 L2298-2322）：measure 四格（含冷启动两格）+ 掌握度前后变化
 *      细网格表（变化带 ↑↓ 与 up/down 色）+ 错题缓存旁注 + 随情形变的主出口
 *
 * 【四态（规范 §7 paper 行，整页级）】
 *   loading（文件列表取数中）→ SkeletonLines（静态发丝斜线，不 shimmer）
 *   empty（0 份试卷）→ EmptyState 虚线空盒（既有出路文案，D5）
 *   error（取列表失败 / 识别失败）→ Stamp 红章 + **真重试**（D15c 同口径：重试重新发起
 *     同一个请求；识别失败的红章明说「识别不产生证据、缓存完好」）
 *   无空间 → guardSpace 的既有 toast + 重定向语义一行不改（R19 取证口径）
 *
 * 【D15c 同口径的最小新增（表现层，逐条留痕；同 P6 /report、P7 /graph 先例）】
 *   · `filesLoading` 初值 true，取数 effect 的 finally 里落定 —— 只为把「还在取数」
 *     与「取到了但一份都没有」分开（空 ≠ 失败，规范 7.1）；
 *   · `loadFailed` 在**既有 catch 分支内**置位 —— drive() 成功必落 files，故失败必须
 *     由 handler 显式记账（不像 /graph 那样可由 report===null 派生）；
 *   · `recognizeFailed` 在 startRecognize 的既有 catch 内置位，红章的重试直接重新调用
 *     同一个 startRecognize()（不新开取数路径）；
 *   · 接口调用参数、cancelled 清理、依赖数组 [activeSpaceId] **逐字符未动**。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { confirmPaper, drive, getPaper, uploadPaper } from '../api/endpoints';
import type {
  ConfirmResult,
  DriveFileView,
  PaperConfirmData,
  PaperUploadData,
  RecognitionItemView,
} from '../api/types';
import Stamp from '../components/blueprint/Stamp';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import { useBlueprintTier } from '../components/blueprint/Board';
import EmptyState from '../components/EmptyState';
import { Badge, Button, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { GRAPH_CHAPTERS, kpName } from '../data/graphSnapshot';
import { fileSize } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { masteryBandOf } from '../theme/bands';
import {
  SPACES_PATH,
  readRecognitionId,
  writePaperWrong,
  writeRecognitionId,
} from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

interface RowState extends Omit<RecognitionItemView, 'kp_guess'> {
  /** 学生确认的知识点（默认取 kp_guess，可改）。 */
  kpId: string;
  /** 学生对/错：**无默认值**，必须手标。 */
  result: ConfirmResult | null;
  /** 识别猜的知识点快照（空串 = 识别没猜出来）：撑起「识别猜的」徽标按钮的对照。 */
  guess: string;
}

/** v2.1 多页整卷上限（与后端 PAPER_MAX_FILES 一致）。 */
const MAX_UPLOAD_FILES = 5;

/** 识别状态 → 用户可读文案（v2.1 评审：内部枚举不再直出给学生；未知值兜底原文）。 */
const STATUS_LABEL: Record<string, string> = {
  pending_confirm: '识别完成，等你逐题确认',
};

/** 知识点选项（v2.1 评审减负：按章节 optgroup 分组 —— 组头即章节，翻找不再靠 24 项平铺）。 */
const KP_GROUPS = GRAPH_CHAPTERS.map((chapter) => ({
  name: chapter.name,
  ids: chapter.kp_ids,
}));

/** 图号与需求号（原型 sheetHead L2218 的 SHEET 10-07 / 需求 2.7）。 */
const SHEET_NO = '10-07';
const SECTION_NO = '2.7';

/** 卷面识别的参考判定 → 学生可读词（原型 seg 的「疑似对 / 疑似错 / 识别不确定」口径）。 */
const REFERENCE_LABEL: Record<string, string> = {
  correct: '疑似对',
  wrong: '疑似错',
  unclear: '识别不确定',
};

export default function PaperPage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  /** v2.1 冷启动：多页整卷（≤5 张）。空数组 = 未选。 */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stage, setStage] = useState<'pick' | 'confirm'>('pick');
  const [status, setStatus] = useState<string>('');
  const [recognitionId, setRecognitionId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  /** 知识点选择器展开中的行（seq）：收起时「识别猜的」徽标就是答案，不碰即确认（减负）。 */
  const [openKpSeq, setOpenKpSeq] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<PaperConfirmData | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  /** 文件列表取数是否已落定（见文件头「D15c 同口径的最小新增」）。 */
  const [filesLoading, setFilesLoading] = useState(true);
  /** 文件列表这一次没取到（红章依据；不停留在空盒 —— 空 ≠ 失败）。 */
  const [loadFailed, setLoadFailed] = useState(false);
  /** 识别这一次没完成（红章依据；识别不产生证据，已选文件与缓存都还在）。 */
  const [recognizeFailed, setRecognizeFailed] = useState(false);
  /** 红章重试在途。 */
  const [retrying, setRetrying] = useState(false);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const tier = useBlueprintTier();

  const toRows = (data: PaperUploadData): RowState[] =>
    data.items.map((item) => ({ ...item, kpId: item.kp_guess, result: null, guess: item.kp_guess }));

  useEffect(() => {
    if (!activeSpaceId) {
      setFilesLoading(false);
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const data = await drive(activeSpaceId);
        if (!cancelled) {
          setFiles(data.files);
          setSelectedIds(data.files[0] ? [data.files[0].file_id] : []);
          setLoadFailed(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadFailed(true);
          toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
        }
      } finally {
        if (!cancelled) setFilesLoading(false);
      }

      // 刷新回显：凭 sessionStorage 里的 recognition_id 走 #10
      const recognitionId = readRecognitionId();
      if (!recognitionId || cancelled) return;
      try {
        const data = await getPaper(recognitionId);
        if (cancelled) return;
        if (data.status === 'pending_confirm') {
          setRows(toRows(data));
          setStatus(data.status);
          setRecognitionId(recognitionId);
          setStage('confirm');
        } else {
          writeRecognitionId(null);
        }
      } catch {
        writeRecognitionId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId]);

  function guardSpace(): string | null {
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      navigate(SPACES_PATH);
      return null;
    }
    return activeSpaceId;
  }

  /** 红章的真重试（D15c 口径）：重新发起**同一个**请求，不新开取数路径。 */
  async function retryLoad(): Promise<void> {
    if (!activeSpaceId) return;
    setRetrying(true);
    try {
      const data = await drive(activeSpaceId);
      setFiles(data.files);
      setSelectedIds(data.files[0] ? [data.files[0].file_id] : []);
      setLoadFailed(false);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    } finally {
      setRetrying(false);
    }
  }

  /** v2.1：单/多图切换。预置文件点选即切换（已选则取消）。 */
  function toggleFile(fileId: string): void {
    setSelectedIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : prev.length >= MAX_UPLOAD_FILES
          ? prev
          : [...prev, fileId],
    );
  }

  async function startRecognize(): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || selectedIds.length === 0 || busy) return;

    setBusy(true);
    setRecognizeFailed(false);
    setStatus(selectedIds.length > 1 ? `识别中…（${selectedIds.length} 页整卷）` : '识别中…');
    try {
      // v2.1 追加式：多页走 file_ids；单页仍传 file_id（服务端两态兼容）
      const data =
        selectedIds.length > 1
          ? await uploadPaper({ space_id: spaceId, file_ids: selectedIds })
          : await uploadPaper({ space_id: spaceId, file_id: selectedIds[0] });
      setRows(toRows(data));
      setStatus(data.status);
      setRecognitionId(data.recognition_id);
      setStage('confirm');
      writeRecognitionId(data.recognition_id);
    } catch (error) {
      setStatus('');
      setRecognizeFailed(true);
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    } finally {
      setBusy(false);
    }
  }

  /** v2.1 快捷标注：把「参考对错」一键应用到全部可参考行（unclear 仍必须手标）。 */
  function adoptSuggestions(): void {
    let adopted = 0;
    setRows((prev) =>
      prev.map((row) => {
        if (row.result !== null) return row;
        if (row.suggested_result === 'correct' || row.suggested_result === 'wrong') {
          adopted += 1;
          return { ...row, result: row.suggested_result };
        }
        return row;
      }),
    );
    if (adopted > 0) toast(`已按参考标好 ${adopted} 题，过一眼再确认`);
    else toast('没有可采纳的参考行（识别不清的要手标）', 'warn');
  }

  async function submitConfirm(): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || busy) return;

    const unmarked = rows.filter((row) => row.result === null);
    if (unmarked.length > 0) {
      toast(`第 ${unmarked[0].seq} 题还没标对错`, 'warn');
      return;
    }
    // 复评 P1（2026-10-09）：识别没猜的知识点行 kpId 为空串 —— 不拦会把 kp_id:''
    // 交给 confirm，「学习证据」指向不存在的知识点。按钮 disabled 是第一道，这里是兜底。
    const unselected = rows.find((row) => row.kpId === '');
    if (unselected) {
      toast(`第 ${unselected.seq} 题还没选知识点`, 'warn');
      return;
    }
    if (!recognitionId) {
      toast('这份卷子的识别记录不在了，重新传一次就好', 'warn');
      setStage('pick');
      return;
    }

    setBusy(true);
    try {
      const data = await confirmPaper({
        recognition_id: recognitionId,
        space_id: spaceId,
        items: rows.map((row) => ({ seq: row.seq, kp_id: row.kpId, result: row.result as ConfirmResult })),
      });
      setConfirmed(data);
      writeRecognitionId(null);
      const wrong = rows.filter((row) => row.result === 'wrong');
      writePaperWrong(
        spaceId,
        wrong.map((row) => ({
          kp_id: row.kpId,
          stem_excerpt: row.stem_excerpt,
          student_answer: row.student_answer,
        })),
      );
      setWrongCount(wrong.length);
      const changed = data.mastery_updates
        .map((update) => `${update.knowledge_point.split('.').slice(-1)[0]} ${Math.round(update.before * 100)}%→${Math.round(update.after * 100)}%`)
        .join('、');
      toast(`${UI_TEXT.paperConfirmed}：${data.events_created} 条证据${changed ? `（${changed}）` : ''}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 409) {
        toast(`${error.message}，去归因页看看`,'warn');
      } else {
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  /** 页头（原型 sheetHead L2218）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="PAPER / 批量证据采集（三段）"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="拍一张最近的试卷"
      sub={`识别结果只是草稿：对错由你逐题敲定，知识点也由你确认。上限 ${MAX_UPLOAD_FILES} 页拼成一份整卷。`}
      chips={<Badge tone="accent">T0 · 明判草稿</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  /** 阶段条（原型 segs L2221-2225）：三段单向推进，当前段走高亮 chip。 */
  const stageKey = confirmed !== null ? 'done' : stage === 'confirm' ? 'confirm' : 'pick';
  const stageBar = (
    <div className="bp-flat mb-6 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-3.5">
        {(
          [
            ['01', '选文件', 'pick'],
            ['02', '逐题确认', 'confirm'],
            ['03', '完成', 'done'],
          ] as const
        ).map(([no, label, key]) => (
          <Badge key={no} tone={stageKey === key ? 'accent' : 'neutral'}>
            {`${no} · ${label}`}
          </Badge>
        ))}
        <span className="tok ml-auto text-ink-soft">三段之间单向推进</span>
      </div>
    </div>
  );

  /** 识别中（原型 STAGE2 的骨架态）：只在识别在途这一窗口出现，不改任何流转。 */
  const recognizing = busy && status.startsWith('识别中');

  // ------------------------------------------------------------ 取数中（loading）
  if (filesLoading) {
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="预置文件库"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
        >
          <SkeletonLines rows={3} block note="正在取文件列表 · 不伪造内容" />
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 取数失败（error）
  if (loadFailed && files.length === 0) {
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="预置文件库"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
        >
          <Stamp
            reason="这一次没能取到本空间的文件列表（网络中断，或服务暂时没有响应）。已经选好的东西没有丢，重试一次通常就能取到；一直取不到时可以先回学习空间确认它还在。"
            onRetry={() => {
              void retryLoad();
            }}
            retrying={retrying}
            alt={{ label: '回到学习空间', to: SPACES_PATH }}
          />
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 空集合（0 份试卷）
  if (files.length === 0) {
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="预置文件库"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
        >
          <EmptyState
            tag="NO FILES"
            title="这个空间里还没有可选的卷子"
            hint="试卷识别从预置文件库里挑（不接真实上传）：这个空间现在一份资料都没有。先回学习空间看看，或换一个有资料的空间再进来。"
            action={
              <Button variant="secondary" onClick={() => navigate(SPACES_PATH)}>
                回学习空间
              </Button>
            }
          />
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 确认完成（STAGE 3）
  if (confirmed) {
    const bootstrap = confirmed.bootstrap;
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="完成"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 3 / 3</span>}
        >
          {/* measure 四格（原型 L2309-2314）：冷启动进来才多给两格（初始覆盖 / 待巩固）。 */}
          <div className="mb-4 grid grid-cols-2 gap-3 sheet:grid-cols-4">
            <div className="bp-measure">
              <span className="tok">新增证据</span>
              <span className="big-num">{confirmed.events_created}</span>
              <span className="tok">条</span>
            </div>
            <div className="bp-measure">
              <span className="tok">更新知识点</span>
              <span className="big-num">{confirmed.mastery_updates.length}</span>
              <span className="tok">个</span>
            </div>
            {bootstrap ? (
              <>
                <div className="bp-measure">
                  <span className="tok">初始覆盖</span>
                  <span className="big-num">{bootstrap.covered_kps}</span>
                  <span className="tok">个知识点</span>
                </div>
                <div className="bp-measure">
                  <span className="tok">待巩固</span>
                  <span className="big-num">{bootstrap.band_counts['待巩固'] ?? 0}</span>
                  <span className="tok">个</span>
                </div>
              </>
            ) : null}
          </div>

          {/* 掌握度前后变化（原型 L2315-2316）：细网格表；变化列带 ↑↓ 与 up/down 色。 */}
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <caption>掌握度前后变化（来自这份卷子）</caption>
              <thead>
                <tr>
                  <th>知识点</th>
                  <th>前</th>
                  <th>后</th>
                  <th>变化</th>
                  <th>档位</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.mastery_updates.map((update) => {
                  const delta = Math.round((update.after - update.before) * 100);
                  return (
                    <tr key={update.knowledge_point}>
                      <td data-label="知识点">
                        <span className="num-mono">{update.knowledge_point}</span>
                      </td>
                      <td data-label="前" className="n">
                        {Math.round(update.before * 100)}%
                      </td>
                      <td data-label="后" className="n">
                        {Math.round(update.after * 100)}%
                      </td>
                      <td data-label="变化" className={cn('n', delta < 0 ? 'down' : 'up')}>
                        {`${delta < 0 ? '−' : '+'}${Math.abs(delta)}%${delta < 0 ? ' ↓' : ' ↑'}`}
                      </td>
                      <td data-label="档位">
                        <Badge>{masteryBandOf(update.after)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 错题缓存旁注（原型 L2317 的 note ok / anno ①「错题已经缓存好了」）。 */}
          <p className="bp-note bp-note--ok mt-4">
            <Icon name="cloud" className="mr-1.5 inline-block h-4 w-4 align-[-2px]" />
            {wrongCount > 0
              ? `已把你标为错的 ${wrongCount} 道题存到本地，归因时可一键带出。`
              : '这份卷子没有判错的题，所以没有新的错题缓存 —— 归因页只会看到以前留下的错题。'}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* v2.1 冷启动：建图完成 → 主按钮直达技能树（游戏化的「点亮时刻」） */}
            {bootstrap ? (
              <Button variant="primary" onClick={() => navigate('/graph?bootstrapped=1')}>
                看看你的技能树
              </Button>
            ) : null}
            <Button variant={bootstrap ? 'secondary' : 'primary'} onClick={() => navigate('/attribution')}>
              挑错题看看根源
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmed(null);
                setRows([]);
                setStage('pick');
                setStatus('');
              }}
            >
              再传一份
            </Button>
          </div>
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 逐题确认（STAGE 2）
  if (stage === 'confirm') {
    const allMarked = rows.every((row) => row.result !== null);
    /** 复评 P1：空 guess 行的知识点必须显式选过，与「对错必标」同一纪律。 */
    const allKpSelected = rows.every((row) => row.kpId !== '');
    /** 提交前缺口（原型 paperGaps L2324-2332）：逐条说清第几题缺什么，不批量甩一句。 */
    const gaps = rows.flatMap((row) => {
      const items: string[] = [];
      if (row.result === null) {
        items.push(
          row.suggested_result === 'unclear'
            ? '识别不确定的题必须由你确认判定（不允许默认）'
            : '还没有判定（对了 / 错了）',
        );
      }
      if (row.kpId === '') items.push('还没有选知识点');
      return items.map((miss) => ({ seq: row.seq, miss }));
    });
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="逐题确认"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 2 / 3 · 单向推进</span>}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <Badge tone="accent">{`已判定 ${rows.filter((row) => row.result !== null).length} / ${rows.length}`}</Badge>
            {/* v2.1 快捷标注：一键采纳参考（unclear 行不参与，仍必须手标） */}
            <Button variant="secondary" size="sm" disabled={busy || allMarked} onClick={adoptSuggestions}>
              把识别的预判一键填到未标注的题（不确定的题除外）
            </Button>
          </div>

          <p className="bp-note mb-3">
            {`识别状态：${STATUS_LABEL[status] ?? status}。看漏的题我不猜 —— 你标了我才记账。`}
          </p>

          {rows.map((row) => (
            <article key={row.seq} className="bp-panel mb-3.5 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <Badge tone={row.result === 'wrong' ? 'negative' : 'neutral'}>{`第 ${row.seq} 题`}</Badge>
                <span className="tok text-ink-soft">
                  {`卷面识别：${REFERENCE_LABEL[row.suggested_result] ?? row.suggested_result}`}
                </span>
              </div>
              <p className="text-body-sm leading-relaxed text-ink">{row.stem_excerpt}</p>
              <dl className="mt-2 mb-3">
                <div className="bp-kv">
                  <dt>识别出的作答</dt>
                  <dd className="num-mono">
                    {row.student_answer.length > 0 ? (
                      row.student_answer
                    ) : (
                      <Badge tone="negative">识别为空</Badge>
                    )}
                  </dd>
                </div>
              </dl>

              <fieldset className="mb-3">
                <legend className="tok mb-2">你来判定 / VERDICT</legend>
                {/* 判定仍只有「对 / 错」两态且**无默认值**（unclear 行由下面的旁注点名，
                    不允许默认）—— 分段选择器只是把既有两个按钮换成原型的三段制式控件。 */}
                <div className="bp-seg" role="radiogroup" aria-label={`第 ${row.seq} 题判定`}>
                  {(['correct', 'wrong'] as ConfirmResult[]).map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name={`g${row.seq}`}
                        value={value}
                        checked={row.result === value}
                        onChange={() =>
                          setRows(
                            rows.map((item) =>
                              item.seq === row.seq ? { ...item, result: value } : item,
                            ),
                          )
                        }
                      />
                      <span>{value === 'correct' ? '这题对了' : '这题错了'}</span>
                    </label>
                  ))}
                </div>
                {row.suggested_result === 'unclear' ? (
                  <p className="bp-note bp-note--alert" role="alert">
                    {UI_TEXT.paperUnclearRow}——识别没看清的题不允许默认，这一题的判定只能你来。
                  </p>
                ) : null}
              </fieldset>

              <fieldset>
                <legend className="tok mb-2">知识点 / KNOWLEDGE POINT</legend>
                {/* 知识点（v2.1 评审减负）：识别有猜 → 默认收成「识别猜的」徽标按钮，
                    多数行零操作；点开才见按章节分组的原生 select（选完自动收起）。
                    识别没猜（guess 空）→ 直接给分组 select，不装作有默认。 */}
                {row.guess !== '' && openKpSeq !== row.seq ? (
                  <button
                    id={`kp-badge-${row.seq}`}
                    type="button"
                    aria-expanded={false}
                    onClick={() => setOpenKpSeq(row.seq)}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-none border px-2 py-1 text-ui-sm transition-colors',
                      row.kpId === row.guess
                        ? 'border-accent bg-accent-veil text-accent-ink'
                        : 'border-line bg-surface text-ink-soft hover:bg-raised',
                    )}
                  >
                    <span className={cn(row.kpId === row.guess && 'font-medium')}>
                      {row.kpId === row.guess ? '识别猜的' : '已改选'}
                    </span>
                    <span className="text-ink">{kpName(row.kpId)}</span>
                    <span aria-hidden="true" className="text-ink-soft">
                      ▾
                    </span>
                  </button>
                ) : (
                  <label className="text-ui-sm text-ink-soft">
                    知识点
                    <span className="bp-ctl ml-2 inline-block">
                      <Select
                        fieldSize="sm"
                        className="w-auto min-h-9"
                        value={row.kpId}
                        onChange={(event) => {
                          setRows(
                            rows.map((item) =>
                              item.seq === row.seq ? { ...item, kpId: event.target.value } : item,
                            ),
                          );
                          // 收起时焦点还给徽标按钮：select 卸载焦点会掉到 body，
                          // 键盘用户得从头 Tab（复评 P2）。空 guess 行不收起，无此问题。
                          if (row.guess !== '') {
                            requestAnimationFrame(() =>
                              document.getElementById(`kp-badge-${row.seq}`)?.focus(),
                            );
                          }
                          setOpenKpSeq(null);
                        }}
                      >
                        {/* 复评 P1：value='' 且无空值 option 时 select 显示空白/错位 ——
                            显式占位让「还没选」可见可选中状态正确。 */}
                        {row.kpId === '' ? (
                          <option value="" disabled>
                            请选知识点
                          </option>
                        ) : null}
                        {KP_GROUPS.map((group) => (
                          <optgroup key={group.name} label={group.name}>
                            {group.ids.map((id) => (
                              <option key={id} value={id}>
                                {kpName(id)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </span>
                  </label>
                )}
                {row.guess === '' ? (
                  <p className="bp-note bp-note--alert" role="alert">
                    识别没有给出猜测，这里不装作有默认：请手动选择这一题的知识点。
                  </p>
                ) : null}
              </fieldset>
            </article>
          ))}

          {/* 提交前缺口（原型 L2289-2291 的 .stamp INCOMPLETE）：逐条列出第几题缺什么。 */}
          {gaps.length > 0 ? (
            <Stamp
              title={`!! 提交前还差 ${gaps.length} 处`}
              seal="INCOMPLETE"
              reason="识别给的是草稿，判断权在你：每一题都要有判定与知识点才能记账。"
              extra={
                <ul className="bp-tick-list w-full">
                  {gaps.map((gap) => (
                    <li key={`${gap.seq}-${gap.miss}`}>{`第 ${gap.seq} 题：${gap.miss}`}</li>
                  ))}
                </ul>
              }
            />
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              disabled={!allMarked || !allKpSelected || busy}
              onClick={() => void submitConfirm()}
            >
              {busy ? '正在记账…' : '确认，更新掌握度'}
            </Button>
            {!allMarked ? (
              <span className="num-mono tok text-ink-soft">
                还有 {rows.filter((r) => r.result === null).length} 题没标
              </span>
            ) : !allKpSelected ? (
              <span className="tok text-ink-soft">
                还有 {rows.filter((r) => r.kpId === '').length} 题没选知识点
              </span>
            ) : (
              <span className="tok text-ink-soft">标完了，过一眼再确认</span>
            )}
            <span className="tok text-ink-soft">识别进行中刷新页面，会恢复到确认环节</span>
          </div>
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 识别中（原型 STAGE2 骨架）
  if (recognizing) {
    return (
      <>
        {pageHead}
        {stageBar}
        <SheetBlock
          no="01"
          title="识别中"
          right={<span className="num-mono text-tok text-ink-soft">STAGE 2 / 3</span>}
        >
          <SkeletonLines rows={3} block note={status} />
          <p className="bp-note">
            识别只做一次草稿，不产生证据、也不动掌握度 —— 结果出来后每一题的对错与知识点都由你敲定。
          </p>
        </SheetBlock>
      </>
    );
  }

  // ------------------------------------------------------------ 选文件（STAGE 1）
  return (
    <>
      {pageHead}
      {stageBar}
      {recognizeFailed ? (
        <Stamp
          className="mb-6"
          reason="这一次识别没能完成（网络中断，或服务暂时没有响应）。识别本身不产生证据、也不改掌握度 —— 你已选的文件和错题缓存都还在，重试一次即可。"
          onRetry={() => {
            void startRecognize();
          }}
          retrying={busy}
          alt={{ label: '回到学习空间', to: SPACES_PATH }}
        />
      ) : null}
      <SheetBlock
        no="01"
        title="预置文件库"
        right={<span className="num-mono text-tok text-ink-soft">STAGE 1 / 3</span>}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={selectedIds.length > 0 ? 'accent' : 'neutral'}>
            {`已选 ${selectedIds.length} / ${MAX_UPLOAD_FILES} 页`}
          </Badge>
          {selectedIds.length > 0 ? (
            <Button variant="quiet" size="sm" onClick={() => setSelectedIds([])}>
              清空
            </Button>
          ) : null}
        </div>

        <div className="bp-tbl-wrap mt-3">
          <table className="bp-tbl">
            <caption>挑一份或几页，拼成一张整卷</caption>
            <thead>
              <tr>
                <th>选</th>
                <th>文件名</th>
                <th>类型</th>
                <th>大小</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => {
                const active = selectedIds.includes(file.file_id);
                return (
                  <tr key={file.file_id}>
                    <td data-label="选">
                      {/* 真控件仍是原生 checkbox（键盘与读屏语义不重造），只换视觉制式。 */}
                      <label className="bp-check">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFile(file.file_id)}
                        />
                        <span className="box" aria-hidden="true">
                          <Icon name="tick" className="h-3 w-3" />
                        </span>
                        <span className="sr-only">{`选中 ${file.name}`}</span>
                      </label>
                    </td>
                    <td data-label="文件">
                      <b className="block font-medium text-ink">{file.name}</b>
                      {/* break-all（R6）：file_id 无空格长串，窄屏强制断行 */}
                      <span className="num-mono block break-all text-mono-xs text-ink-soft">
                        {file.file_id}
                      </span>
                    </td>
                    <td data-label="类型">{file.type.toUpperCase()}</td>
                    <td data-label="大小" className="n">
                      {fileSize(file.size)}
                    </td>
                    <td data-label="备注">
                      {index === 0 ? <span className="tok">预选第一份</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={busy || selectedIds.length === 0}
            onClick={() => void startRecognize()}
          >
            {busy
              ? '正在识别…'
              : selectedIds.length > 1
                ? `开始识别（${selectedIds.length} 页整卷）`
                : '开始识别'}
          </Button>
          <span className="tok text-ink-soft">
            {selectedIds.length > 0 ? '识别中会给出进行中反馈' : '未选文件时不能开始识别'}
          </span>
        </div>

        <p className="bp-note">
          按需求 2.7：预置文件库是长期形态（不接真实上传），演示态从里面挑。超过 {MAX_UPLOAD_FILES}{' '}
          页时不再接受新的勾选；识别只出草稿，确认才记账。
        </p>
      </SheetBlock>
    </>
  );
}
