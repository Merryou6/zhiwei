/**
 * 输入区（全屏页与右侧面板共用，D11）。
 *
 * 自 ChatPage 原样迁出：输入框 + 传图读题（演示态 picker）+ 发送键。
 * 演示态纪律保留：本地无云存储直传接口，选中后以 image_file_id 随下一条消息发送，
 * 按钮旁标注「演示态」，不伪造上传假象。
 */

import { useState } from 'react';

import { ApiError } from '../../api/client';
import { drive } from '../../api/endpoints';
import type { DriveFileView } from '../../api/types';
import { UI_TEXT } from '../../lib/phrases';
import { InlineSkeletonRows } from '../PageSkeleton';
import { useSpaceStore } from '../../stores/space';
import { useUiStore } from '../../stores/ui';
import { useChatSend } from './useChatSend';

export interface ChatComposerProps {
  /** 流式回复中：禁用输入与发送（全屏页/面板各自据 store.streaming 传入）。 */
  disabled: boolean;
}

export default function ChatComposer({ disabled }: ChatComposerProps) {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [imageFileId, setImageFileId] = useState<string | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const { send } = useChatSend();

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

  async function submit(): Promise<void> {
    const text = input.trim();
    if (text.length === 0 || disabled) return;
    const sentImage = imageFileId;
    setInput('');
    setImageFileId(null);
    setPickerOpen(false);
    await send(text, sentImage);
  }

  return (
    <div>
      {pickerOpen ? (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <p className="text-ui-sm text-ink-soft">传图读题（演示态）：从预置文件里选一张，随下一条消息发我。</p>
          <ul className="mt-2 space-y-1">
            {files.map((file) => (
              <li key={file.file_id}>
                <button
                  type="button"
                  onClick={() => setImageFileId(file.file_id)}
                  className={[
                    'w-full rounded-lg px-3 py-1.5 text-left text-xs max-nav:min-h-9',
                    imageFileId === file.file_id ? 'bg-accent-veil text-accent-ink' : 'text-ink hover:bg-raised',
                  ].join(' ')}
                >
                  {file.name}
                </button>
              </li>
            ))}
            {files.length === 0 ? (
              <li className="px-3">
                {/* 预置文件列表加载中：行内骨架，原状态文字保留给屏幕阅读器 */}
                <span className="sr-only">正在取文件…</span>
                <InlineSkeletonRows rows={2} />
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* flex-wrap（R3）：窄屏放不下时按钮换行到第二行，而不是被压扁成一行挤在一起；
          空间充裕时（≥720）不触发换行。两个按钮 shrink-0 保住自身最小尺寸（不参与压缩），
          textarea 给一个 12rem 的可用下限，避免被挤到不可读。 */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <textarea
          className="min-h-[44px] min-w-[min(100%,12rem)] flex-1 resize-y rounded-xl border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
          rows={2}
          placeholder="写一句你的思路，或者直接说卡在哪"
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          type="button"
          onClick={() => void openPicker()}
          className="shrink-0 rounded-xl border border-line px-3 py-2.5 text-ui-sm text-ink-soft hover:bg-surface"
          title="本地演示态：选预置文件代替真实直传"
        >
          传图读题
          <span className="ml-1 text-caption text-ink-soft">演示态</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void submit()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {disabled ? '正在回…' : '发送'}
        </button>
      </div>
    </div>
  );
}
