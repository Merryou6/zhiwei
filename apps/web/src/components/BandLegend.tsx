/**
 * 四色状态带全局图例（PRD §6「颜色语义（全局一致 + 图例）」，P0 #10 要求图例常驻）。
 *
 * 颜色一律经 theme/bands.ts 取（唯一事实源），组件内禁止硬编码 hex。
 * 图例项不可点击过滤（P0 无此要求，D10）。
 */

import { BAND_HEX, BAND_ORDER, BAND_SOFT_HEX, PRIMARY_HEX } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { masteryToBand } from '../theme/bands';

export interface BandLegendProps {
  /** 每状态带节点数（可选；报告页/图谱页传入后显示计数）。 */
  counts?: Partial<Record<MasteryBand, number>>;
  /** 是否显示「归因 / 学习路径」图例项（图谱页） */
  showPath?: boolean;
  className?: string;
}

export default function BandLegend({ counts, showPath = false, className }: BandLegendProps) {
  return (
    <div
      className={[
        // 实底而非半透明白 + 背景模糊：图例经常压在彩色图谱上，
        // 半透明会让四色色块与文字的颜色随底下内容漂移，反而失准。
        // 圆角与阴影统一走令牌（rounded-control / shadow-card）。
        'rounded-control border border-line bg-surface px-3 py-2 text-ui-sm text-ink-soft shadow-card',
        className ?? '',
      ].join(' ')}
      aria-label="掌握度颜色图例"
    >
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {BAND_ORDER.map((band) => (
          <li key={band} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full ring-1"
              style={{ backgroundColor: BAND_HEX[band], borderColor: BAND_SOFT_HEX[band] }}
            />
            <span>{band}</span>
            {counts && counts[band] !== undefined ? (
              <span className="tabular-nums text-ink-soft/70">({counts[band]})</span>
            ) : null}
          </li>
        ))}
        {showPath ? (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded"
              style={{ backgroundColor: PRIMARY_HEX }}
            />
            <span>归因 / 学习路径</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** 依掌握度取状态带（供调用方构造 counts 时复用，避免自行 import bands 两处）。 */
export function bandOf(mastery: number): MasteryBand {
  return masteryToBand(mastery);
}
