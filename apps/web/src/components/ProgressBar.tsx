/**
 * 测评进度条（页 4）：只反映「量」，不含对错（D11 不展示对错）。
 */

export interface ProgressBarProps {
  /** 已作答（含跳过）题数。 */
  answered: number;
  /** 本轮题量（answered + remaining）。 */
  total: number;
}

export default function ProgressBar({ answered, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(1, Math.max(0, answered / safeTotal));

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className="shrink-0 text-[13px] text-ink-soft">
        已答 {answered} / {total}
      </span>
    </div>
  );
}
