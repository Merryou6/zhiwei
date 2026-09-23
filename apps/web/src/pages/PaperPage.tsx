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
      <section className="max-w-2xl">
        <h1 className="text-xl font-medium text-ink">这份卷子记下了</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          新增了 {confirmed.events_created} 条证据，更新了 {confirmed.mastery_updates.length} 个知识点。
          要不要挑一道错题，我们一起看看它是怎么错的？
        </p>

        <ul className="mt-4 space-y-2">
          {confirmed.mastery_updates.map((update) => (
            <li key={update.knowledge_point} className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-soft">
              {update.knowledge_point}：{Math.round(update.before * 100)}% → {Math.round(update.after * 100)}%
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/attribution')}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90"
          >
            挑错题看看根源
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmed(null);
              setRows([]);
              setStage('pick');
              setStatus('');
            }}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-ink hover:bg-surface"
          >
            再传一份
          </button>
        </div>

        {wrongCount > 0 ? (
          <p className="mt-4 text-[13px] text-ink-soft">
            已把你标为错的 {wrongCount} 道题存到本地，归因时可一键带出。
          </p>
        ) : null}
      </section>
    );
  }

  // ------------------------------------------------------------ 逐题确认
  if (stage === 'confirm') {
    const allMarked = rows.every((row) => row.result !== null);
    return (
      <section className="max-w-3xl">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium text-ink">对一下每题的对错</h1>
            <p className="mt-2 text-sm text-ink-soft">
              识别状态：{status}。看漏的题我不猜——你标了我才记账。
            </p>
          </div>
          <span className="shrink-0 text-[13px] text-ink-soft">
            已标 {rows.filter((row) => row.result !== null).length}/{rows.length}
          </span>
        </header>

        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.seq} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[13px] text-ink-soft">第 {row.seq} 题</span>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{row.stem_excerpt}</p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    你的作答：{row.student_answer.length > 0 ? row.student_answer : '（识别为空）'}
                  </p>
                </div>
                {row.suggested_result === 'unclear' ? (
                  <span className="shrink-0 rounded-md bg-band-weak/10 px-2 py-0.5 text-xs text-band-weak">
                    {UI_TEXT.paperUnclearRow}
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] text-ink-soft">
                    参考：{row.suggested_result === 'wrong' ? '疑似错' : '疑似对'}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-[13px] text-ink-soft">
                  知识点
                  <select
                    className="ml-2 rounded-lg border border-line px-2 min-h-9 py-2 text-[13px] text-ink outline-none focus:border-accent"
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
                  </select>
                </label>

                <div className="flex items-center gap-2">
                  {(['correct', 'wrong'] as ConfirmResult[]).map((value) => {
                    const active = row.result === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setRows(rows.map((item) => (item.seq === row.seq ? { ...item, result: value } : item)))
                        }
                        className={[
                          'rounded-lg border px-3 min-h-9 py-2 text-[13px] transition-colors',
                          active ? 'border-accent bg-accent-veil text-ink' : 'border-line text-ink-soft hover:bg-raised',
                        ].join(' ')}
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

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            disabled={!allMarked || busy}
            onClick={() => void submitConfirm()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? '正在记账…' : '确认，更新掌握度'}
          </button>
          {!allMarked ? <span className="text-[13px] text-ink-soft">还有 {rows.filter((r) => r.result === null).length} 题没标</span> : null}
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------ 选文件
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">传一份卷子</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        演示态：从预置文件里挑一份（真实的相册上传在云端开放）。识别结果只是草稿，
        对错由你最后确认，看清楚才记账。
      </p>

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
                  onClick={() => setSelected(file.file_id)}
                  className={[
                    'w-full rounded-2xl border bg-surface p-4 text-left',
                    active ? 'border-accent' : 'border-line hover:border-accent/60',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink">{file.name}</span>
                    <span className="shrink-0 text-[13px] text-ink-soft">
                      {file.type.toUpperCase()} · {fileSize(file.size)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-soft">{file.file_id}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void startRecognize()}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90 disabled:opacity-60"
      >
        {busy ? '正在识别…' : '开始识别'}
      </button>

      {status ? <p className="mt-3 text-[13px] text-ink-soft">{status}</p> : null}
    </section>
  );
}
