/**
 * MeasureBox 尺寸块（style-10 蓝图迁移 P4 / 规范 5.12）
 *
 * 承载「一个数 + 它的名字」：上方 tok 标签（下方一条虚线），下方等宽大数字。
 * 它是图纸上最小的信息单元 —— 页面里所有「一个数」的表达都用它，
 * 不允许再出现第三个「大数字 + 小标签」的写法。
 *
 * 【null 怎么画】null 不画 0、不画破折号，画等宽的「尚无可用的数」（规范 7.4）：
 * 缺数与「数是 0」在业务上完全不同，视觉上就必须不同。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface MeasureBoxProps {
  /** 等宽大写标签（如「平均掌握度 / MASTERY」）。 */
  label: string;
  value: string | number | null | undefined;
  /** 单位（与数值同一制式，不额外留空格）。 */
  suffix?: ReactNode;
  tone?: 'default' | 'accent' | 'red' | 'amber';
  className?: string;
}

const TONE: Record<NonNullable<MeasureBoxProps['tone']>, string> = {
  default: 'text-ink',
  accent: 'text-accent-ink',
  red: 'text-danger',
  amber: 'text-ink',
};

export default function MeasureBox({
  label,
  value,
  suffix,
  tone = 'default',
  className,
}: MeasureBoxProps) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className={cn('bp-measure', className)}>
      <span className="tok">{label}</span>
      {empty ? (
        // 等宽同样式，但语义是「没有数」而不是「数是零」（规范 7.4）。
        <span className="tok">尚无可用的数</span>
      ) : (
        <span className={cn('big-num', TONE[tone])}>
          {value}
          {suffix ? <span className="ml-1 text-body-sm font-normal">{suffix}</span> : null}
        </span>
      )}
    </div>
  );
}
