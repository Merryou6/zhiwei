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
 *   - 本地无云存储直传（契约 §9 指向云环境）→ 演示态从预置文件里选，不伪造上传。
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
import PageSkeleton from '../components/PageSkeleton';
import { Badge, Button, PageContainer, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { GRAPH_NODES } from '../data/graphSnapshot';
import { fileSize } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
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
}

/** 知识点下拉选项（20 节点，章节分组显示）。 */
const KP_OPTIONS = GRAPH_NODES.map((node) => ({
  id: node.id,
  label: `${node.chapter} / ${node.name}`,
}));

export default function PaperPage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState<'pick' | 'confirm'>('pick');
  const [status, setStatus] = useState<string>('');
  const [recognitionId, setRecognitionId] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<PaperConfirmData | null>(null);
  const [wrongCount, setWrongCount] = useState(0);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  const toRows = (data: PaperUploadData): RowState[] =>
    data.items.map((item) => ({ ...item, kpId: item.kp_guess, result: null }));

  useEffect(() => {
    if (!activeSpaceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await drive(activeSpaceId);
        if (!cancelled) {
          setFiles(data.files);
          setSelected(data.files[0]?.file_id ?? null);
        }
      } catch (error) {
        if (!cancelled) toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
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

  async function startRecognize(): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || !selected || busy) return;

    setBusy(true);
    setStatus('识别中…');
    try {
      const data = await uploadPaper({ space_id: spaceId, file_id: selected });
      setRows(toRows(data));
      setStatus(data.status);
      setRecognitionId(data.recognition_id);
      setStage('confirm');
      writeRecognitionId(data.recognition_id);
    } catch (error) {
      setStatus('');
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function submitConfirm(): Promise<void> {
    const spaceId = guardSpace();
    if (!spaceId || busy) return;

    const unmarked = rows.filter((row) => row.result === null);
    if (unmarked.length > 0) {
      toast(`第 ${unmarked[0].seq} 题还没标对错`, 'warn');
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

  // ------------------------------------------------------------ 确认完成
  if (confirmed) {
    return (
      <PageContainer width="prose">
        <PageHeader title="这份卷子记下了" />
        <p className="mt-3 text-reading leading-relaxed text-ink-soft">
          新增了 <span className="font-mono tabular-nums text-ink">{confirmed.events_created}</span> 条证据，
          更新了 <span className="font-mono tabular-nums text-ink">{confirmed.mastery_updates.length}</span> 个知识点。
          要不要挑一道错题，我们一起看看它是怎么错的？
        </p>

        <ul className="mt-4 space-y-2">
          {confirmed.mastery_updates.map((update) => (
            <li
              key={update.knowledge_point}
              className="rounded-control border border-line bg-surface px-4 py-2 text-sm text-ink-soft"
            >
              {/* 前后掌握度是本页最重要的读数：等宽数字让「87% → 92%」这类对齐可读 */}
              <span className="font-mono tabular-nums text-ink">{update.knowledge_point}</span>：
              <span className="font-mono tabular-nums">{Math.round(update.before * 100)}%</span> →{' '}
              <span className="font-mono tabular-nums text-ink">{Math.round(update.after * 100)}%</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => navigate('/attribution')}>
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

        {wrongCount > 0 ? (
          <p className="mt-4 text-ui-sm text-ink-soft">
            已把你标为错的 <span className="font-mono tabular-nums text-ink">{wrongCount}</span> 道题存到本地，归因时可一键带出。
          </p>
        ) : null}
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 逐题确认
  if (stage === 'confirm') {
    const allMarked = rows.every((row) => row.result !== null);
    return (
      <PageContainer width="standard">
        <PageHeader
          title="对一下每题的对错"
          description={`识别状态：${status}。看漏的题我不猜——你标了我才记账。`}
          actions={
            <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
              已标 {rows.filter((row) => row.result !== null).length}/{rows.length}
            </span>
          }
        />

        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.seq} className="rounded-surface border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="font-mono text-ui-sm tabular-nums text-ink-soft">第 {row.seq} 题</span>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{row.stem_excerpt}</p>
                  <p className="mt-1 text-ui-sm text-ink-soft">
                    你的作答：{row.student_answer.length > 0 ? row.student_answer : '（识别为空）'}
                  </p>
                </div>
                {row.suggested_result === 'unclear' ? (
                  <Badge tone="negative" size="md" className="shrink-0">
                    {UI_TEXT.paperUnclearRow}
                  </Badge>
                ) : (
                  <span className="shrink-0 text-ui-sm text-ink-soft">
                    参考：{row.suggested_result === 'wrong' ? '疑似错' : '疑似对'}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-ui-sm text-ink-soft">
                  知识点
                  <Select
                    fieldSize="sm"
                    className="ml-2 w-auto min-h-9"
                    value={row.kpId}
                    onChange={(event) =>
                      setRows(rows.map((item) => (item.seq === row.seq ? { ...item, kpId: event.target.value } : item)))
                    }
                  >
                    {KP_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="flex items-center gap-2">
                  {(['correct', 'wrong'] as ConfirmResult[]).map((value) => {
                    const active = row.result === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setRows(rows.map((item) => (item.seq === row.seq ? { ...item, result: value } : item)))
                        }
                        className={cn(
                          'min-h-9 rounded-control border px-3 py-2 text-ui-sm transition-colors',
                          active
                            ? 'border-accent bg-accent-veil text-ink'
                            : 'border-line text-ink-soft hover:bg-raised',
                        )}
                      >
                        {value === 'correct' ? '这题对了' : '这题错了'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            disabled={!allMarked || busy}
            onClick={() => void submitConfirm()}
          >
            {busy ? '正在记账…' : '确认，更新掌握度'}
          </Button>
          {!allMarked ? (
            <span className="font-mono text-ui-sm tabular-nums text-ink-soft">
              还有 {rows.filter((r) => r.result === null).length} 题没标
            </span>
          ) : null}
        </div>
      </PageContainer>
    );
  }

  // ------------------------------------------------------------ 选文件
  return (
    <PageContainer width="prose">
      <PageHeader
        title="传一份卷子"
        description="演示态：从预置文件里挑一份（真实的相册上传在云端开放）。识别结果只是草稿，对错由你最后确认，看清楚才记账。"
      />

      {files.length === 0 ? (
        <PageSkeleton label="正在取文件列表…" rows={2} className="mt-6" />
      ) : (
        <ul className="mt-6 space-y-3">
          {files.map((file) => {
            const active = selected === file.file_id;
            return (
              <li key={file.file_id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(file.file_id)}
                  className={cn(
                    'w-full rounded-surface border bg-surface p-4 text-left transition-colors',
                    active ? 'border-accent' : 'border-line hover:border-accent/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">{file.name}</span>
                    <span className="shrink-0 font-mono text-ui-sm tabular-nums text-ink-soft">
                      {file.type.toUpperCase()} · {fileSize(file.size)}
                    </span>
                  </div>
                  {/* break-all（R6）：file_id 无空格长串，窄屏强制断行 */}
                  <p className="mt-1 break-all text-ui-sm text-ink-soft">{file.file_id}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="primary"
        full
        className="mt-6"
        disabled={busy || !selected}
        onClick={() => void startRecognize()}
      >
        {busy ? '正在识别…' : '开始识别'}
      </Button>

      {status ? <p className="mt-3 text-ui-sm text-ink-soft">{status}</p> : null}
    </PageContainer>
  );
}
