/**
 * 页 6 · 对话辅导（SSE 流式；P0 #8）
 *
 * 契约：#18 POST /api/agent/chat（Content-Type: text/event-stream）
 *       事件序列：delta（≥1 段）→ meta（五字段）→ done；Accept 为 json 时返回 {reply, meta}
 * 交互：学长左 / 学生右；delta 增量追加渲染；流式期间禁发；meta 只读不自行判断——
 *   - kp_match.confidence < 0.6 → 学长气泡下加浅色注脚「我不太确定说的是哪个知识点…」（对应服务端 clarify 行为）
 *   - next_action=hint_down → 气泡标「方向提示」徽标
 *   - next_action=exit_channel → 显著退出提示条（PRD §6 话术「我们先往回看一眼「XX」」）+ 去图谱链接
 * 「传图读题」为演示态（D15）：本地无云存储直传接口，弹预置文件选择器，选中后以 image_file_id 随消息发送，
 * 按钮旁标注「演示态」，不伪造上传假象。
 * 降级（D5）：流中断 → sse.ts 自动 JSON 重发一次 → 仍失败出错误气泡，页面永不白屏。
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { drive } from '../api/endpoints';
import { streamChat } from '../api/sse';
import type { ChatMeta, DriveFileView } from '../api/types';
import { kpName } from '../data/graphSnapshot';
import { UI_TEXT, exitChannelText } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useDialogStore } from '../stores/dialog';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** kp 匹配低置信阈值（契约 §9：< 0.6 服务端先追问、不产生证据）。 */
const LOW_CONFIDENCE = 0.6;

function badgeOf(meta: ChatMeta | null): 'hint' | 'exit' | null {
  if (!meta) return null;
  if (meta.next_action === 'exit_channel') return 'exit';
  if (meta.next_action === 'hint_down') return 'hint';
  return null;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [imageFileId, setImageFileId] = useState<string | null>(null);

  const store = useDialogStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [store.messages.length, store.streaming]);

  async function openPicker(): Promise<void> {
    setPickerOpen((value) => !value);
    if (files.length > 0 || !activeSpaceId) return;
    try {
      const data = await drive(activeSpaceId);
      setFiles(data.files);
      setImageFileId((current) => current ?? data.files[0]?.file_id ?? null);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'error');
    }
  }

  async function send(): Promise<void> {
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      return;
    }
    const text = input.trim();
    if (text.length === 0 || store.streaming) return;

    store.appendStudent(text, imageFileId);
    setInput('');

    const assistantId = store.startAssistant();
    const sentImage = imageFileId;
    setImageFileId(null);
    setPickerOpen(false);

    await streamChat(
      {
        space_id: activeSpaceId,
        dialog_id: store.dialogId ?? undefined,
        message: text,
        image_file_id: sentImage ?? undefined,
      },
      {
        onDelta: (delta) => store.appendDelta(assistantId, delta),
        onMeta: (meta) => store.setMeta(meta),
        onDone: () => {
          const meta = useDialogStore.getState().meta;
          const lowConfidence =
            meta !== null && (meta.kp_match.confidence ?? 0) < LOW_CONFIDENCE && meta.kp_match.kp_id.length > 0;
          store.finishAssistant(
            assistantId,
            badgeOf(meta),
            lowConfidence ? '我不太确定说的是哪个知识点，可以再描述一下吗' : null,
          );
        },
        onError: (msg) => {
          store.failAssistant(assistantId, msg);
          toast(msg, 'warn');
        },
        onFallback: (msg) => toast(msg),
      },
    );
  }

  const meta = store.meta;
  const exitNotice =
    meta?.next_action === 'exit_channel'
      ? exitChannelText(kpName(meta.kp_match.kp_id))
      : null;

  return (
    <section className="max-w-2xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium text-ink">跟学长聊两句</h1>
          <p className="mt-2 text-sm text-ink-soft">
            卡在哪一步就说哪一步，写半句也行。我不会直接给你答案，会先陪你把思路接上。
          </p>
        </div>
        {meta ? (
          <span className="shrink-0 text-xs text-ink-soft">
            这轮在聊：{kpName(meta.kp_match.kp_id)}（{Math.round(meta.kp_match.confidence * 100)}%）
          </span>
        ) : null}
      </header>

      {exitNotice ? (
        <div className="mt-4 rounded-xl border border-band-weak bg-band-weak/10 px-4 py-3 text-sm text-ink">
          <p className="font-medium">{exitNotice}</p>
          <p className="mt-1 text-xs text-ink-soft">
            连续几轮都没往前走，多半是更前面的砖没铺稳——我们回去补那一块，不丢人。
          </p>
          <Link
            to={`/graph?path=${encodeURIComponent(meta?.kp_match.kp_id ?? '')}`}
            className="mt-2 inline-block rounded-lg bg-primary px-3 min-h-9 py-2 text-[13px] text-white"
          >
            去图谱看看这一环
          </Link>
        </div>
      ) : null}

      <div className="mt-5 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
        {store.messages.length === 0 ? (
          <p className="text-sm text-ink-soft">
            还没有聊天记录。可以从一句「我卡在这里」开始，也可以传张题图让我先读题。
          </p>
        ) : null}

        {store.messages.map((message) => {
          if (message.role === 'notice') {
            return (
              <p key={message.id} className="text-center text-xs text-ink-soft">
                {message.text}
              </p>
            );
          }

          const isStudent = message.role === 'student';
          return (
            <div key={message.id} className={isStudent ? 'flex justify-end' : 'flex justify-start'}>
              <div className={isStudent ? 'max-w-[80%] text-right' : 'max-w-[85%]'}>
                <div
                  className={[
                    'inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed',
                    isStudent ? 'bg-primary-soft text-ink' : 'bg-canvas text-ink',
                  ].join(' ')}
                >
                  {message.text.length > 0 ? message.text : message.pending ? '正在想…' : ''}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  {isStudent && message.imageFileId ? (
                    <span className="rounded-md bg-canvas px-2 py-0.5">已带题图（演示态 · {message.imageFileId}）</span>
                  ) : null}
                  {message.badge === 'hint' ? (
                    <span className="rounded-md bg-band-unstable/15 px-2 py-0.5 text-band-unstable">方向提示</span>
                  ) : null}
                  {message.badge === 'exit' ? (
                    <span className="rounded-md bg-band-weak/15 px-2 py-0.5 text-band-weak">换条路走走</span>
                  ) : null}
                  {!isStudent && message.note ? (
                    <span className="text-ink-soft/80">注：{message.note}</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {pickerOpen ? (
        <div className="mt-3 rounded-xl border border-line bg-white p-3">
          <p className="text-xs text-ink-soft">传图读题（演示态）：从预置文件里选一张，随下一条消息发我。</p>
          <ul className="mt-2 space-y-1">
            {files.map((file) => (
              <li key={file.file_id}>
                <button
                  type="button"
                  onClick={() => setImageFileId(file.file_id)}
                  className={[
                    'w-full rounded-lg px-3 py-1.5 text-left text-xs',
                    imageFileId === file.file_id ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-canvas',
                  ].join(' ')}
                >
                  {file.name}
                </button>
              </li>
            ))}
            {files.length === 0 ? <li className="px-3 min-h-9 py-2 text-[13px] text-ink-soft">正在取文件…</li> : null}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex items-end gap-2">
        <textarea
          className="min-h-[44px] flex-1 resize-y rounded-xl border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          rows={2}
          placeholder="写一句你的思路，或者直接说卡在哪"
          value={input}
          disabled={store.streaming}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          type="button"
          onClick={() => void openPicker()}
          className="rounded-xl border border-line px-3 py-2.5 text-xs text-ink-soft hover:bg-white"
          title="本地演示态：选预置文件代替真实直传"
        >
          传图读题
          <span className="ml-1 text-[10px] text-ink-soft/70">演示态</span>
        </button>
        <button
          type="button"
          disabled={store.streaming}
          onClick={() => void send()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {store.streaming ? '正在回…' : '发送'}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        {activeSpaceId ? '' : `还没有空间，`}
        <Link to={SPACES_PATH} className="underline">
          {activeSpaceId ? '空间与进度' : '先去建一个空间'}
        </Link>
        {' · '}
        <Link to="/graph" className="underline">
          看看我的地图
        </Link>
      </p>
    </section>
  );
}
