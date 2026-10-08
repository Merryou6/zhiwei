/**
 * 输入区（全屏页与右侧面板共用，D11）。
 *
 * 自 ChatPage 原样迁出：输入框 + 传图读题 + 发送键。
 *
 * 传图读题（2026-10-08 开通，替换旧"演示态"）：
 *   - 真实选图（设备相册 / 相机 capture）→ canvas 压缩为 ≤1280px 的 JPEG data URL
 *     （长边 1280 / 质量 0.72，实测题图普遍落在 100~250KB，低于服务端 400K 字符上限）；
 *   - 选中后仅存在于本组件预览态，随**下一条消息**发送（与旧交互一致）；
 *   - 服务端只在当轮把图转给模型适配器、不落库；本地规则模式会诚实回复看不了图，
 *     引导学生改用文字描述（localChat.readPaperText）；
 *   - dialogs 里仍记 image_file_id = 客户端标记（img_local_<ts>），字段契约不变。
 */

import { useRef, useState } from 'react';

import { UI_TEXT } from '../../lib/phrases';
import { Button, Textarea } from '../ui';
import { useUiStore } from '../../stores/ui';
import { useChatSend } from './useChatSend';

export interface ChatComposerProps {
  /** 流式回复中：禁用输入与发送（全屏页/面板各自据 store.streaming 传入）。 */
  disabled: boolean;
}

/** 压缩上限：长边像素 / JPEG 质量（题图文档场景够用，控制请求体积）。 */
const IMAGE_MAX_EDGE = 1280;
const IMAGE_QUALITY = 0.72;

/** 选中的题图（预览态）：压缩产物 + 展示用缩略（复用同一 data URL）。 */
export interface PickedImage {
  dataUrl: string;
}

/** 读图 → 等比缩放 → JPEG data URL；失败抛错由调用方 toast。 */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选一张图片文件（jpg / png / webp 都行）');
  }
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('这张图读不出来，换一张试试'));
      element.src = bitmapUrl;
    });
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器画布不可用');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

export default function ChatComposer({ disabled }: ChatComposerProps) {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [compressing, setCompressing] = useState(false);

  const toast = useUiStore((state) => state.toast);
  const { send } = useChatSend();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onPickFile(file: File | undefined | null): Promise<void> {
    if (!file) return;
    setCompressing(true);
    try {
      const dataUrl = await compressImage(file);
      setImage({ dataUrl });
    } catch (error) {
      toast(error instanceof Error ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setCompressing(false);
    }
  }

  async function submit(): Promise<void> {
    const text = input.trim();
    if ((text.length === 0 && !image) || disabled) return;
    const picked = image;
    setInput('');
    setImage(null);
    // 附件随消息走：带图时给一个客户端标记 id（dialogs 落库字段契约不变）
    const imageFileId = picked ? `img_local_${Date.now()}` : null;
    await send(text, imageFileId, picked?.dataUrl ?? null, {
      allowEmptyText: Boolean(picked),
    });
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void onPickFile(event.target.files?.[0]);
          // 允许连续选同一张图（input.value 不清空则不触发 change）
          event.target.value = '';
        }}
      />

      {image ? (
        <div className="mt-3 flex items-start gap-3 rounded-surface border border-line bg-surface p-3">
          <img
            src={image.dataUrl}
            alt="已选的题图预览"
            className="h-16 w-16 shrink-0 rounded-control border border-line object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-ui-sm text-ink">题图备好了，随下一条消息一起发。</p>
            <p className="mt-0.5 text-ui-sm text-ink-soft">
              可以再补一句话说卡在哪；只发图也行。
            </p>
            <button
              type="button"
              className="mt-1 text-ui-sm text-accent-ink hover:underline"
              onClick={() => setImage(null)}
              disabled={disabled}
            >
              重新选一张
            </button>
          </div>
        </div>
      ) : null}

      {/* flex-wrap（R3）：窄屏放不下时按钮换行到第二行，而不是被压扁成一行挤在一起；
          空间充裕时（≥720）不触发换行。两个按钮 shrink-0 保住自身最小尺寸（不参与压缩），
          textarea 给一个 12rem 的可用下限，避免被挤到不可读。 */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        {/* min-h-11 = 44px，与原手写的 min-h-[44px] 同值（触控下限），但走标准刻度
            而不是任意值；圆角由原语定成 rounded-control（原为 rounded-surface，
            P2 已把全站控件统一收成 control 一档，此处是当时漏网的最后一处） */}
        <Textarea
          fieldSize="md"
          className="min-h-11 min-w-[min(100%,12rem)] flex-1 py-2.5"
          rows={2}
          placeholder={image ? '补一句卡在哪（可留空直接发图）' : '写一句你的思路，或者直接说卡在哪'}
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button
          variant="secondary"
          size="md"
          className="shrink-0"
          title="从相册选择或拍照传题"
          disabled={disabled || compressing}
          onClick={() => fileInputRef.current?.click()}
        >
          {compressing ? '处理图…' : '传图读题'}
        </Button>
        <Button
          className="shrink-0"
          disabled={disabled || compressing || (input.trim().length === 0 && !image)}
          onClick={() => void submit()}
        >
          {disabled ? '正在回…' : '发送'}
        </Button>
      </div>
    </div>
  );
}
