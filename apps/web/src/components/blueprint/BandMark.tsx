/**
 * BandMark 四档形状标记（style-10 蓝图迁移 P4 / 规范 5.7）
 *
 * 「色 + 形状 + 文字」三重编码：形状（菱形 / 五边形 / 六边形 / 圆形 / 双圈 / 空框）
 * + 档位文字 + 等宽数值。三者缺一不可 —— 只靠颜色的话，色觉障碍用户读不出档位，
 * 黑白打印也读不出（规范 9）。
 *
 * 【颜色怎么取】形状与文字一律走 `-t` 文本色系列（.bp-band-N-t 制式类，读
 * `--c-band-N-t` 变量）：实色在蓝图下做小字不达标（规范 2.3）。
 * 条形填充反过来用实色（.bp-band-N）—— 它是图形不是文字。
 *
 * 【它不认识阈值】档位由调用方按 engine 判定后传入（BAND_ORDER / masteryToBand），
 * 组件里没有第二个阈值。
 */

import { cn } from '../../lib/cn';
import { BandShape } from './icons';

export type BandKey =
  | '待巩固'
  | '不稳定'
  | '基本掌握'
  | '已掌握'
  | '未接触'
  | '未解锁'
  | '低置信';

/** 档位 → 四档色键（b1..b4 / b0）。与原型 BAND_CLS 逐字一致。 */
const BAND_KEY: Record<BandKey, '1' | '2' | '3' | '4' | '0'> = {
  待巩固: '1',
  不稳定: '2',
  基本掌握: '3',
  已掌握: '4',
  未接触: '0',
  未解锁: '0',
  低置信: '0',
};

export interface BandMarkProps {
  band: BandKey;
  /** 掌握度（null / 缺省 = 无数值，不画数）。 */
  mastery?: number | null;
  /** 文字，缺省 = 档位名。 */
  text?: string;
  /** 显示数值（缺省 true 且 mastery 非空）。 */
  showValue?: boolean;
  size?: 'sm' | 'md';
  /** 追加一条 8px 高的条形（含 40/60/80 三档刻度）。 */
  bar?: boolean;
  className?: string;
}

export default function BandMark({
  band,
  mastery,
  text,
  showValue = true,
  size = 'md',
  bar = false,
  className,
}: BandMarkProps) {
  const key = BAND_KEY[band] ?? '0';
  const width = mastery === null || mastery === undefined ? 0 : Math.max(2, Math.round(mastery * 100));
  const ariaValue = mastery === null || mastery === undefined ? '尚无可用的数' : mastery.toFixed(2);

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body-sm', className)}>
      <span className={cn('inline-flex items-center gap-1.5', `bp-band-${key}-t`)}>
        <BandShape band={band} className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
        <span className="font-medium">{text ?? band}</span>
      </span>
      {showValue && mastery !== null && mastery !== undefined ? (
        <span className="num-mono text-mono-xs text-ink">{mastery.toFixed(2)}</span>
      ) : null}
      {bar ? (
        <span
          role="img"
          aria-label={`${band} 掌握度 ${ariaValue}`}
          className={cn('relative inline-block h-2 w-24 border border-line bg-accent-veil', `bp-band-${key}`)}
        >
          <i
            aria-hidden="true"
            className="absolute bottom-px left-px top-px block bg-current"
            style={{ width: `calc(${width}% - 2px)` }}
          />
          {[40, 60, 80].map((tick) => (
            <b
              key={tick}
              aria-hidden="true"
              className="absolute -bottom-1 -top-1 block w-px bg-line"
              style={{ left: `${tick}%` }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
