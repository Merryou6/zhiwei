/**
 * 非阻断提示条（Toast）——PRD §6「采集永不弹窗」：错误/状态提示一律用不遮挡操作的浮层，
 * 不使用 modal 遮罩（唯一的 modal 是 ConfirmDialog，用于 409 空间切换这种用户主动确认）。
 *
 * 本组件为**纯展示**：toast 队列在 stores/ui.ts（批 2 接入 Layout）。
 */

export type ToastTone = 'info' | 'warn';

export interface ToastItem {
  id: string;
  msg: string;
  tone?: ToastTone;
}

export interface ToastListProps {
  items: readonly ToastItem[];
  onDismiss: (id: string) => void;
}

export default function ToastList({ items, onDismiss }: ToastListProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={[
            'pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm',
            item.tone === 'warn'
              ? 'border-band-weak bg-white text-ink'
              : 'border-line bg-white text-ink-soft',
          ].join(' ')}
        >
          <span
            aria-hidden
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              item.tone === 'warn' ? 'bg-band-weak' : 'bg-primary'
            }`}
          />
          <span className="leading-relaxed">{item.msg}</span>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="ml-2 shrink-0 rounded px-2 text-xs text-ink-soft hover:bg-canvas"
            aria-label="关闭提示"
          >
            知道了
          </button>
        </div>
      ))}
    </div>
  );
}
