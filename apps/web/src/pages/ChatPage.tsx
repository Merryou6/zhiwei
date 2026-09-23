/**
 * 页 6 · 对话辅导（SSE 流式；P0 #8）
 *
 * 契约：#18 POST /api/agent/chat（Content-Type: text/event-stream）
 *       事件序列：delta（≥1 段）→ meta（五字段）→ done；Accept 为 json 时返回 {reply, meta}
 * 交互：学长左 / 学生右；delta 增量追加渲染；流式期间禁发；meta 只读不自行判断——
 *   - kp_match.confidence < 0.6 → 学长气泡下加浅色注脚「我不太确定说的是哪个知识点…」
 *   - next_action=hint_down → 气泡标「方向提示」徽标
 *   - next_action=exit_channel → 显著退出提示条 + 去图谱链接
 *
 * 传图读题：支持本地图片上传（点击选择 / 拖拽 / 粘贴），上传后随消息发送；
 *           同时保留云盘预置文件选择（演示态）。
 * 降级（D5）：流中断 → sse.ts 自动 JSON 重发一次 → 仍失败出错误气泡，页面永不白屏。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import EmptyState from '../components/EmptyState';
import { InlineSkeletonRows } from '../components/PageSkeleton';
import { drive, uploadImage } from '../api/endpoints';
import { streamChat } from '../api/sse';
import type { ChatMeta, DriveFileView, UploadImageData } from '../api/types';
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

const ICO_CLOSE = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const ICO_FOLDER = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 2h5.5A1.5 1.5 0 0 1 15 6.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 2 11.5z" />
  </svg>
);

/** 本地上传的图片数据 */
interface LocalImage {
  fileId: string;
  url: string;
  filename: string;
  size: number;
  /** 前端预览用的 blob URL（上传前） */
  previewUrl?: string;
}

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [localImage, setLocalImage] = useState<LocalImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const store = useDialogStore();
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
  }, [store.messages.length, store.streaming]);

  /** 将 File 转为 data URL */
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /** 处理选中的图片文件 */
  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件（PNG / JPG / GIF / WebP）', 'warn');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('图片大小不能超过 10MB', 'warn');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const previewUrl = URL.createObjectURL(file);

      const result: UploadImageData = await uploadImage({
        image_base64: dataUrl,
        filename: file.name,
      });

      setLocalImage({
        fileId: result.file_id,
        url: result.url,
        filename: result.filename,
        size: result.size,
        previewUrl,
      });
      setImageFileId(null); // 清除云盘文件选择
      toast('图片已上传，随下一条消息发送', 'info');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '图片上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }, [toast]);

  /** 点击选择图片 */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleImageFile(file);
    e.target.value = ''; // 重置以便重复选择同一文件
  };

  /** 粘贴上传 */
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleImageFile(file);
          break;
        }
      }
    }
  }, [handleImageFile]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  /** 拖拽上传 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleImageFile(file);
  };

  /** 移除本地上传的图片 */
  const removeLocalImage = () => {
    if (localImage?.previewUrl) URL.revokeObjectURL(localImage.previewUrl);
    setLocalImage(null);
  };

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
    const hasImage = !!localImage || !!imageFileId;
    if (text.length === 0 && !hasImage) return;
    if (store.streaming || uploading) return;

    const sentImageFileId = localImage?.fileId ?? imageFileId ?? null;
    const sentImageUrl = localImage?.url ?? null;

    store.appendStudent(text, sentImageFileId, sentImageUrl);
    setInput('');
    removeLocalImage();
    setImageFileId(null);
    setPickerOpen(false);

    const assistantId = store.startAssistant();

    await streamChat(
      {
        space_id: activeSpaceId,
        dialog_id: store.dialogId ?? undefined,
        message: text || '[图片]',
        image_file_id: sentImageFileId ?? undefined,
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

  const lastAgentId = (() => {
    for (let i = store.messages.length - 1; i >= 0; i -= 1) {
      if (store.messages[i].role === 'agent') return store.messages[i].id;
    }
    return null;
  })();

  const pendingFile = imageFileId ? files.find((f) => f.file_id === imageFileId) : null;
  const sendDisabled = store.streaming || uploading || (input.trim().length === 0 && !localImage && !imageFileId);

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

      <section
        className="chat-shell"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽遮罩 */}
        {dragOver ? (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(91,141,239,0.12)',
              border: '2px dashed var(--accent)',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{ICO_IMAGE}</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>松开鼠标上传图片</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>支持 PNG / JPG / GIF / WebP，最大 10MB</div>
            </div>
          </div>
        ) : null}

        <div className="chat-stream" role="log" aria-live="polite" ref={streamRef}>
          {store.messages.length === 0 ? (
            <EmptyState
              compact
              title="还没有聊天记录"
              hint="可以从一句「我卡在这里」开始，也可以传张题图让我先读题。支持点击上传、拖拽、粘贴图片。"
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
                      {message.imageUrl ? (
                        <div
                          style={{
                            marginBottom: message.text ? 8 : 0,
                            borderRadius: 8,
                            overflow: 'hidden',
                            cursor: 'zoom-in',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                          onClick={() => setPreviewImageUrl(message.imageUrl!)}
                        >
                          <img
                            src={message.imageUrl}
                            alt="题目图片"
                            style={{ maxWidth: 280, maxHeight: 200, display: 'block', objectFit: 'contain', background: '#fff' }}
                          />
                        </div>
                      ) : message.imageFileId ? (
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
            {/* 本地上传图片预览 */}
            {localImage ? (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', margin: '0 14px 10px',
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 8,
                }}
              >
                <img
                  src={localImage.previewUrl || localImage.url}
                  alt={localImage.filename}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {localImage.filename}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-label)', marginTop: 2 }}>
                    {(localImage.size / 1024).toFixed(1)} KB · 随下一条消息发送
                  </div>
                </div>
                <button
                  type="button"
                  className="attach-x"
                  aria-label="移除图片"
                  onClick={removeLocalImage}
                  style={{ flexShrink: 0 }}
                >
                  {ICO_CLOSE}
                </button>
              </div>
            ) : null}

            {/* 云盘预置文件选择（演示态） */}
            {imageFileId && !localImage ? (
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
                  {ICO_CLOSE}
                </button>
              </div>
            ) : null}

            {uploading ? (
              <div style={{ padding: '10px 14px', margin: '0 14px 10px', fontSize: 13, color: 'var(--accent)' }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> 正在上传图片…
              </div>
            ) : null}

            <textarea
              ref={inputRef}
              className="composer-input"
              rows={2}
              placeholder="把你的思路或卡住的地方写下来，也可以直接拍题上传（支持拖拽 / 粘贴）…"
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
              <span className="composer-hint">Enter 发送 · Shift + Enter 换行 · 可拖拽/粘贴图片</span>
              <div className="composer-actions">
                {/* 隐藏的文件选择器 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {/* 本地上传按钮 */}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => fileInputRef.current?.click()}
                  title="选择本地图片（也支持拖拽和粘贴）"
                  disabled={uploading || store.streaming}
                >
                  {ICO_IMAGE}
                  上传图片
                </button>

                {/* 云盘预置文件选择 */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void openPicker()}
                    title="从云盘选择预置文件（演示态）"
                    disabled={uploading || store.streaming}
                  >
                    {ICO_FOLDER}
                    云盘文件
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
                        从云盘选择（演示态）：选一张随消息发我。
                      </p>
                      {files.map((file) => (
                        <button
                          key={file.file_id}
                          type="button"
                          onClick={() => {
                            setImageFileId(file.file_id);
                            setLocalImage(null);
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
                  {store.streaming ? '正在回…' : uploading ? '上传中…' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 图片放大预览 */}
      {previewImageUrl ? (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <img
            src={previewImageUrl}
            alt="放大预览"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
          />
          <button
            type="button"
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setPreviewImageUrl(null)}
          >
            ×
          </button>
        </div>
      ) : null}

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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
