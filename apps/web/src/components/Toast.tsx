/**
 * 非阻断提示条（Toast）——PRD §6「采集永不弹窗」：错误/状态提示一律用不遮挡操作的浮层，
 * 不使用 modal 遮罩（唯一的 modal 是 ConfirmDialog，用于 409 空间切换这种用户主动确认）。
 *
 * 本组件为**纯展示**：toast 队列在 stores/ui.ts（批 2 接入 Layout）。
 */

export type ToastTone = 'info' | 'warn' | 'error';

/** 分档视觉（走查修正：三档语义可区分；均低饱和、无刺眼大红）。 */
const TONE_CLASS: Record<ToastTone, { box: string; dot: string }> = {
  info: { box: 'border-line bg-surface text-ink-soft', dot: 'bg-accent' },
  warn: { box: 'border-band-weak bg-surface text-ink', dot: 'bg-band-weak' },
  // error 底色原为写死的浅暖色 #FDF4EE——它只在浅底上成立，深色主题下会是一块
  // 发亮的米色。改为 tone-error 的 12% 透明度：由边框色自己调出面纱，
  // 浅底上是极淡暖底、深底上是暗棕底，两套主题都保持「暖而不刺眼」（PRD §6）。
  error: { box: 'border-tone-error bg-tone-error/12 text-ink', dot: 'bg-tone-error' },
};

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
    // 走查修正：原为底部居中（inset-x-0 bottom-6 items-center），会压住页面底部主按钮；
    // 改为**右上角贴顶栏下方**堆叠，永不遮挡内容区操作。
    <div
      className="pointer-events-none fixed right-4 top-16 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col items-stretch gap-2"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => {
        const tone = TONE_CLASS[item.tone ?? 'info'];
        return (
          <div
            key={item.id}
            className={[
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card',
              tone.box,
            ].join(' ')}
          >
            <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
            <span className="flex-1 leading-relaxed">{item.msg}</span>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="ml-1 shrink-0 rounded-md px-2 py-1 text-[13px] text-ink-soft hover:bg-raised"
              aria-label="关闭提示"
            >
              知道了
            </button>
          </div>
        );
      })}
    </div>
  );
}
