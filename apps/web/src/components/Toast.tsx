/**
 * 非阻断提示条（Toast）——PRD §6「采集永不弹窗」：错误/状态提示一律用不遮挡操作的浮层，
 * 不使用 modal 遮罩（唯一的 modal 是 ConfirmDialog，用于 409 空间切换这种用户主动确认）。
 *
 * 本组件为**纯展示**：toast 队列在 stores/ui.ts（批 2 接入 Layout）。
 */

export type ToastTone = 'info' | 'warn' | 'error';

/**
 * 分档视觉（走查修正：三档语义可区分；均低饱和、无刺眼大红）。
 *
 * 【2026-10-10 style-10 蓝图迁移 P4（规范 5.13）】从「小圆点 + 全边框」改成
 * **左边 3px 语义色条**：色条贴在正文的首行起手上，比右下角一个点更容易扫到，
 * 而且在等宽批注制式下不会有「圆点被字距挤开」的观感。底色仍是 surface + 语义边框，
 * 三档语义未变（info/warn/error），调用方零改动。
 */
const TONE_CLASS: Record<ToastTone, { box: string; dot: string }> = {
  info: { box: 'border-line bg-surface text-ink-soft', dot: 'border-l-accent' },
  warn: { box: 'border-band-weak bg-surface text-ink', dot: 'border-l-band-weak' },
  // error 底色原为写死的浅暖色 #FDF4EE——它只在浅底上成立，深色主题下会是一块
  // 发亮的米色。改为 tone-error 的 10% 透明度：由边框色自己调出面纱，
  // 浅底上是极淡暖底、深底上是暗棕底，两套主题都保持「暖而不刺眼」（PRD §6）。
  error: { box: 'border-tone-error bg-tone-error/10 text-ink', dot: 'border-l-tone-error' },
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
    // 位置（规范 5.13）：**右下角**，因为提示条是「批注」而不是「警报」——
    // 图纸的批注栏在右下正文之外；右上角是标题/操作区，堆在那里会与「正在做什么」抢视线。
    // ≤900 档（图幅 md/sm）左右各让 12px，并抬到 76px 让开底部 tabbar（tabbar 高 66px）。
    //
    // ⚠ 与冻结门禁的一处相互作用（已留痕）：`top-safe-16` 原本只被本文件使用，
    //   而 breakpoints.test.ts ⑥ 要求它必须有真实使用点；本轮把提示条从右上改到右下后，
    //   该类的使用点移到 blueprint/Board.tsx 的 skip link（聚焦落位 = 安全区 + 4rem，
    //   正好落在图签条下方），门禁仍成立且语义更贴切。
    <div
      // data-print='hide'：提示条是临时浮层，不该出现在打印稿里。
      data-print="hide"
      className="pointer-events-none fixed bottom-safe-6 right-safe-4 z-overlay flex w-[min(22rem,calc(100vw-2rem))] flex-col items-stretch gap-2 max-sheet:bottom-[76px] max-sheet:left-3 max-sheet:right-3 max-sheet:w-auto"
      role="status"
      aria-live="polite"
    >
      {items.map((item) => {
        const tone = TONE_CLASS[item.tone ?? 'info'];
        return (
          <div
            key={item.id}
            className={[
              // 浮层该用 shadow-overlay 而不是 shadow-card：card 是「贴在页面平面上的静态卡」，
              // 提示条是「浮在内容之上、随时会走」的临时层，两者必须能一眼分开。
              // 制式（规范 5.13）：0 圆角 + 等宽 13px + 左边 3px 语义色条。
              'pointer-events-auto flex animate-rise items-start gap-3 rounded-none border border-l-[3px] px-3 py-2.5 font-mono text-ui-sm tracking-wide shadow-overlay',
              tone.box,
              tone.dot,
            ].join(' ')}
          >
            <span className="flex-1 leading-relaxed">{item.msg}</span>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="shrink-0 rounded-none px-2 py-1 font-mono text-mono-xs uppercase tracking-widest text-ink-soft transition-colors duration-150 ease-out hover:bg-accent-veil max-nav:min-h-9"
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
