/**
 * 用户主动确认对话框（全站唯一 modal）
 *
 * PRD §6「采集永不弹窗」：证据采集、识别、判定全程不弹窗；本组件只用于**用户主动操作**的确认
 * ——当前唯一使用者是页 3 的 409「同学科空间已存在」：契约 §2 明文要求默认按钮是「切换过去」
 * 而不是「仍要新建」。
 */

import { Button } from './ui';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** 默认按钮（契约 §2：409 时默认 = 切换过去）。 */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    // z-index 走令牌（D12：原为裸 z-50，数值相同 → 像素零变化）
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-ink/30 px-4">
      {/* shadow-overlay：对话框是浮起层，与静态卡的 shadow-card 分档（P3 走查补齐，
          此前误用裸 shadow-lg，绕过了阴影档位体系） */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-surface border border-line bg-surface p-5 shadow-overlay"
      >
        <h2 className="text-base font-medium text-ink">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          {/* 按钮收编原语（P3 走查）：原来两串手写 class 与 Button 是同视觉第二套真相；
              autoFocus 透传保留——焦点默认落在契约要求的「切换过去」上 */}
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button autoFocus onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
