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
    // 幕布改用 .scrim（style-10 P4，规范 5.14）：它是全站唯一「隔着半透明层还要读前景」
    // 的位置，抽成类之后「系统减少透明度」偏好才有落点；且底色取自主题变量，
    // 蓝图/白图两套自动成立（原来写死的 bg-ink/30 在蓝图下偏亮）。
    <div className="fixed inset-0 z-overlay flex items-center justify-center scrim px-4">
      {/* 图纸模态（规范 5.14）：`.bp-panel` 给「外框 1px + inset 3px 内框线」的双线制图感，
          浮起层保留一层投影（静态面一律无阴影）。 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bp-panel w-full max-w-[520px] p-5 shadow-overlay"
      >
        <p className="font-mono text-tok uppercase tracking-widest text-ink-soft">CONFIRM</p>
        <h2 className="mt-1 font-disp text-title-sm tracking-tight text-ink">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-[64ch] text-body-sm leading-relaxed text-ink-soft">{description}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          {/* 按钮收编原语（P3 走查）：原来两串手写 class 与 Button 是同视觉第二套真相；
              autoFocus 透传保留——焦点默认落在契约要求的「切换过去」上。
              ⚠ 确认键**不用** danger variant（规范 5.14 的 danger 只给破坏性操作）：
                 本组件当前唯一使用者是 409「同学科空间已存在」，契约 §2 明文要求默认按钮
                 是「切换过去」——那是可逆的切换，不是破坏性动作，涂红会给出错误的风险信号。
                 danger variant 已在 ui/Button 备好，供页面批的「退出登录 / 解除绑定」使用。 */}
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
