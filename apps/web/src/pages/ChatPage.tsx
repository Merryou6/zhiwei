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
 *
 * 视图（2026-09-23 移植控制台原型）：视口型聊天——chat-shell 贴满内容宽，chat-stream 可滚，
 * composer 贴底；消息走 .msg / .msg-user / .msg-bubble，头像用控制台 AVATAR 几何。
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import EmptyState from '../components/EmptyState';
import { InlineSkeletonRows } from '../components/PageSkeleton';
import { drive } from '../api/endpoints';
import { streamChat } from '../api/sse';
import type { ChatMeta, DriveFileView } from '../api/types';
import { kpName } from '../data/graphSnapshot';
import { scrollBehavior } from '../lib/motion';
import { UI_TEXT, exitChannelText } from '../lib/phrases';
import RichText from '../lib/richText';
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

/** 知微头像：与控制台 app.js AVATAR 同源几何（28x28）。 */
function Avatar(): JSX.Element {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#25344a" stroke="#334155" />
      <path
        d="M9.7 9.5 18.1 14 9.7 18.5"
        fill="none"
        stroke="#42a5f5"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.7" cy="9.5" r="1.9" fill="#e8edf3" />
      <circle cx="18.1" cy="14" r="2.4" fill="#42a5f5" />
      <circle cx="9.7" cy="18.5" r="1.5" fill="#8b95a8" />
    </svg>
  );
}

const ICO_IMAGE = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.2" y="3" width="11.6" height="10" rx="1.8" />
    <circle cx="5.8" cy="6.4" r="1.1" />
    <path d="M3 11.2 6.4 8l2.4 2.2L11 8.6l2.2 2" />
  </svg>
);

const ICO_SEND = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 8 2.6 2.8 5 8l-2.4 5.2z" />
    <path d="M5 8h9" />
  </svg>
);

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [imageFileId, setImageFileId] = useState<string | null>(null);

  const store = useDialogStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // 流式追加时把消息流滚到底（只滚 .chat-stream，不连带滚动窗口/顶栏）；
    // 系统开启「减弱动态效果」时改为瞬时滚动（批三）
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
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

  /** 最近一条 AI 消息：在它的名字行挂「当前聊到的知识点」标签（控制台 .tag 语义）。 */
  const lastAgentId = (() => {
    for (let i = store.messages.length - 1; i >= 0; i -= 1) {
      if (store.messages[i].role === 'agent') return store.messages[i].id;
    }
    return null;
  })();

  const pendingFile = imageFileId ? files.find((f) => f.file_id === imageFileId) : null;
  const sendDisabled = store.streaming || (input.trim().length === 0 && !imageFileId);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="t-display">对话辅导</h1>
          <p className="page-lead">不会直接给答案：先确认你卡在哪一步，再一步步把思路交回给你。</p>
        </div>
        {meta ? (
          <div className="page-actions">
            <span className="tag tag-accent">
              这轮在聊：{kpName(meta.kp_match.kp_id)}（{Math.round(meta.kp_match.confidence * 100)}%）
            </span>
          </div>
        ) : null}
      </header>

      {exitNotice ? (
        <div
          style={{
            marginBottom: 16,
            padding: '13px 16px',
            border: '1px solid rgba(239,127,76,.4)',
            borderRadius: 8,
            background: 'rgba(239,127,76,.12)',
          }}
        >
          <p className="t-body" style={{ color: 'var(--ink)', fontWeight: 500 }}>{exitNotice}</p>
          <p className="t-sub" style={{ marginTop: 4 }}>
            连续几轮都没往前走，多半是更前面的砖没铺稳——我们回去补那一块，不丢人。
          </p>
          <Link
            to={`/graph?path=${encodeURIComponent(meta?.kp_match.kp_id ?? '')}`}
            className="btn btn-primary"
            style={{ marginTop: 10, height: 32, padding: '0 12px', fontSize: 12.5 }}
          >
            去图谱看看这一环
          </Link>
        </div>
      ) : null}

      <section className="chat-shell">
        <div className="chat-stream" role="log" aria-live="polite" ref={streamRef}>
          {store.messages.length === 0 ? (
            <EmptyState
              compact
              title="还没有聊天记录"
              hint="可以从一句「我卡在这里」开始，也可以传张题图让我先读题。"
            />
          ) : null}

          {store.messages.map((message) => {
            if (message.role === 'notice') {
              return (
                <p key={message.id} style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)' }}>
                  {message.text}
                </p>
              );
            }

            const isStudent = message.role === 'student';

            if (isStudent) {
              return (
                <div key={message.id} className="msg msg-user">
                  <div className="msg-body">
                    <div className="msg-name">
                      <strong>我</strong>
                    </div>
                    <div className="msg-bubble">
                      {message.imageFileId ? (
                        <div className="msg-photo">
                          {ICO_IMAGE}
                          <span>已带题图（演示态 · {message.imageFileId}）</span>
                        </div>
                      ) : null}
                      {message.text ? <p className="msg-text">{message.text}</p> : null}
                    </div>
                  </div>
                </div>
              );
            }

            // AI 消息：pending 且还没收到任何 delta → 显示思考态
            const thinking = message.pending && message.text.length === 0;
            const kpTag =
              message.id === lastAgentId && meta ? kpName(meta.kp_match.kp_id) : null;

            return (
              <div key={message.id} className="msg">
                <span className="msg-avatar" aria-hidden="true">
                  <Avatar />
                </span>
                <div className="msg-body">
                  <div className="msg-name">
                    <strong>知微</strong>
                    {kpTag ? <span className="tag">{kpTag}</span> : null}
                    {message.badge === 'hint' ? <span className="tag tag-waver">方向提示</span> : null}
                    {message.badge === 'exit' ? <span className="tag tag-weak">换条路走走</span> : null}
                  </div>

                  {thinking ? (
                    <div className="thinking">
                      <span className="thinking-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="thinking-text">在看你的思路…</span>
                    </div>
                  ) : (
                    <>
                      {message.text ? (
                        <RichText text={message.text} className="space-y-1.5" />
                      ) : null}
                      {message.note ? (
                        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>注：{message.note}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="composer-box">
            <div className={`composer-attach${imageFileId ? ' is-on' : ''}`}>
              <span className="attach-thumb">{ICO_IMAGE}</span>
              <div className="attach-meta">
                <div className="attach-name">{pendingFile?.name ?? '已选图片'}</div>
                <div className="attach-sub">演示态传图 · 随下一条消息发送</div>
              </div>
              <button
                type="button"
                className="attach-x"
                aria-label="移除图片"
                onClick={() => setImageFileId(null)}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <textarea
              ref={inputRef}
              className="composer-input"
              rows={2}
              placeholder="把你的思路或卡住的地方写下来，也可以直接拍题上传…"
              value={input}
              disabled={store.streaming}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
            />

            <div className="composer-bar">
              <span className="composer-hint">Enter 发送 · Shift + Enter 换行</span>
              <div className="composer-actions">
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void openPicker()}
                    title="本地演示态：选预置文件代替真实直传"
                  >
                    {ICO_IMAGE}
                    传图读题
                  </button>
                  {pickerOpen ? (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        right: 0,
                        width: 260,
                        maxHeight: 220,
                        overflowY: 'auto',
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        boxShadow: 'var(--shadow-pop)',
                        padding: 6,
                        zIndex: 30,
                      }}
                    >
                      <p style={{ padding: '6px 8px', fontSize: 11.5, color: 'var(--ink-label)' }}>
                        传图读题（演示态）：选一张随消息发我。
                      </p>
                      {files.map((file) => (
                        <button
                          key={file.file_id}
                          type="button"
                          onClick={() => {
                            setImageFileId(file.file_id);
                            setPickerOpen(false);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '7px 8px',
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: imageFileId === file.file_id ? 'var(--accent)' : 'var(--ink)',
                            background: imageFileId === file.file_id ? 'var(--accent-veil)' : 'transparent',
                          }}
                        >
                          {file.name}
                        </button>
                      ))}
                      {files.length === 0 ? (
                        <div style={{ padding: '6px 8px' }}>
                          <span className="sr-only">正在取文件…</span>
                          <InlineSkeletonRows rows={2} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sendDisabled}
                  onClick={() => void send()}
                >
                  {ICO_SEND}
                  {store.streaming ? '正在回…' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="t-sub" style={{ marginTop: 14 }}>
        {activeSpaceId ? '' : `还没有空间，`}
        <Link to={SPACES_PATH} style={{ textDecoration: 'underline' }}>
          {activeSpaceId ? '空间与进度' : '先去建一个空间'}
        </Link>
        {' · '}
        <Link to="/graph" style={{ textDecoration: 'underline' }}>
          看看我的地图
        </Link>
      </p>
    </>
  );
}
