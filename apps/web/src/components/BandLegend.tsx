/**
 * 四色状态带全局图例（PRD §6「颜色语义（全局一致 + 图例）」，P0 #10 要求图例常驻）。
 *
 * 颜色一律经 theme/bands.ts 取（唯一事实源），组件内禁止硬编码 hex。
 * 图例项不可点击过滤（P0 无此要求，D10）。
 *
 * 【2026-10-10 style-10 蓝图迁移 P4（规范 5.7 / 2.2）】
 * 从「圆点 + 名称」升级为**四列信息**：形状 + 色 + 名称 + 区间。
 * 为什么必须加形状：四档是「色 + 形状 + 文字」三重编码 —— 只给颜色的话，
 * 色觉障碍用户读不出档位，黑白打印也读不出（规范第 9 章）。图例是这套编码的
 * 说明处，它自己不遵守就等于没定义。
 *
 * 区间文案由 engine 的阈值常量拼出（BAND_THRESHOLD_*），**不在这里写第二份阈值**。
 * 色取 `-t` 文本色系列（规范 2.3）：图例文字是 13px 小字，实色在蓝图下不达 AA。
 */

import { BAND_ORDER, BAND_THRESHOLD_MASTERED, BAND_THRESHOLD_MASTERY, BAND_THRESHOLD_UNSTABLE, PRIMARY_HEX } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { masteryToBand } from '../theme/bands';
import { BandShape } from './blueprint/icons';

export interface BandLegendProps {
  /** 每状态带节点数（可选；报告页/图谱页传入后显示计数）。 */
  counts?: Partial<Record<MasteryBand, number>>;
  /** 是否显示「归因 / 学习路径」图例项（图谱页） */
  showPath?: boolean;
  /** 紧凑态（嵌在画布工具条里时用）：去掉区间列。 */
  compact?: boolean;
  className?: string;
}

/**
 * 档位 → `.bp-band-N-t` 键（与引擎档名逐字对应；改档名要同步这里与 BandMark）。
 *
 * ⚠ 这里**可以**用模板字符串拼类名（`bp-band-${key}-t`），这与 Badge.tsx 里
 *   「band 色必须写完整字面量类名」的纪律不矛盾：那条纪律针对的是 Tailwind
 *   **工具类**（按源码文本扫描产出，拼出来的类名不会被扫到，静默失效）；
 *   而 `.bp-band-*` 是 index.css 里的**未分层制式规则**，只要文件里写了就永远在产物里，
 *   与源码是否出现该字符串无关。P3 把制式类放在 utilities 层之外，正是为了这一条。
 */
const BAND_KEY: Record<MasteryBand, '1' | '2' | '3' | '4'> = {
  待巩固: '1',
  不稳定: '2',
  基本掌握: '3',
  已掌握: '4',
};

/** 档位 → 区间文案（值全部来自 engine 常量，不另写阈值）。 */
const BAND_RANGE_TEXT: Record<MasteryBand, string> = {
  待巩固: `< ${BAND_THRESHOLD_UNSTABLE.toFixed(2)}`,
  不稳定: `${BAND_THRESHOLD_UNSTABLE.toFixed(2)}–${BAND_THRESHOLD_MASTERY.toFixed(2)}`,
  基本掌握: `${BAND_THRESHOLD_MASTERY.toFixed(2)}–${BAND_THRESHOLD_MASTERED.toFixed(2)}`,
  已掌握: `> ${BAND_THRESHOLD_MASTERED.toFixed(2)}`,
};

export default function BandLegend({ counts, showPath = false, compact = false, className }: BandLegendProps) {
  return (
    <div
      className={['bp-panel px-3 py-2', className ?? ''].join(' ')}
      aria-label="掌握度颜色图例"
    >
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {BAND_ORDER.map((band) => (
          <li key={band} className={`flex items-center gap-1.5 bp-band-${BAND_KEY[band]}-t`}>
            {/* 形状 = 第一重编码（规范 2.2）：色觉障碍与黑白打印下唯一还能读的东西。 */}
            <BandShape band={band} className="h-4 w-4" />
            <span className="text-body-sm">{band}</span>
            {!compact ? (
              <span className="num-mono text-mono-xs text-ink-soft">{BAND_RANGE_TEXT[band]}</span>
            ) : null}
            {counts && counts[band] !== undefined ? (
              <span className="num-mono text-mono-xs text-ink-soft">n={counts[band]}</span>
            ) : null}
          </li>
        ))}
        {showPath ? (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: PRIMARY_HEX }}
            />
            <span className="text-body-sm text-ink-soft">归因 / 学习路径</span>
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
