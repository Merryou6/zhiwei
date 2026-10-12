/**
 * 数学符号快捷面板——从 ItemCard 内联面板抽出共用（2026-10-12：练习页分步书写区也需要）。
 *
 * 纪律：
 *   - 纯文本插入：点按只回调 onInsert(符号)，不含任何判分逻辑（同 ItemCard 面板口径）；
 *   - 光标位置生效由调用方负责（调用方持有目标 textarea 的 ref 与当前值）；
 *   - 视觉规格沿用规范 5.16 的 .sym-pad：桌面 36px、≤900 档 44px 保底，
 *     0 圆角 + hover 转 accent 面纱，禁用态由 disabled 入参控制。
 */

const MATH_SYMBOLS = ['√', '²', '³', '±', '×', '÷', 'π', '≤', '≥', '≠', 'Δ', '/'] as const;

export interface MathSymbolPadProps {
  /** 点按符号时的插入回调（接收原始符号字符）。 */
  onInsert: (symbol: string) => void;
  disabled?: boolean;
}

export default function MathSymbolPad({ onInsert, disabled = false }: MathSymbolPadProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-mono-xs uppercase tracking-widest text-ink-soft">插入</span>
      {MATH_SYMBOLS.map((symbol) => (
        <button
          key={symbol}
          type="button"
          disabled={disabled}
          aria-label={`插入符号 ${symbol}`}
          className="min-h-9 min-w-9 rounded-none border border-line bg-surface px-2 text-sm text-ink transition-colors hover:border-accent hover:bg-accent-veil disabled:cursor-not-allowed disabled:opacity-60 max-sheet:min-h-11 max-sheet:min-w-11"
          onClick={() => onInsert(symbol)}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}
