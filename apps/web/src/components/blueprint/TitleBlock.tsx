/**
 * TitleBlock 右下标题栏（style-10 蓝图迁移 P4 / 规范 4.3）
 *
 * 图纸右下角的 8 格图签栏：项目 / 图号 / 比例 / 日期 / 视图 / 制图 / 状态 / 签发。
 * 用 `dl/dt/dd` 表达「名 — 值」对：它是被核对的元信息，不是装饰网格。
 *
 * 【打印时保留】与其它外壳件相反：标题栏是纸面图纸的组成部分（规范 11 章 #8），
 * 所以它**不**打 data-print="hide"，打印时反而要转成黑白可读的边框。
 * 【窄档降为两列】原型 [data-tier=md/sm] #tb .tb-grid{repeat(2,…)}：一格变窄后
 * 「项目 / PROJECT」这类长值会折行，与其硬挤成四列，不如两列各占半幅。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface TitleCell {
  /** 「项目 / PROJECT」这类双语名。 */
  label: string;
  value: ReactNode;
}

export interface TitleBlockProps {
  cells: TitleCell[];
  className?: string;
}

export default function TitleBlock({ cells, className }: TitleBlockProps) {
  return (
    <footer className={cn('mt-2 border-t border-line bg-surface', className)}>
      <dl className="grid grid-cols-2 annos:grid-cols-4">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="min-w-0 border-b border-r border-line/20 px-3 py-2 last:border-r-0"
          >
            <dt className="mb-0.5 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">
              {cell.label}
            </dt>
            <dd className="num-mono m-0 break-words text-body-sm tracking-wide text-ink">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  );
}
