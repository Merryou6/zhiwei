/**
 * 下一步引导卡（2026-10-08 追加）——五步闭环的"路标"。
 *
 * 背景：闭环各页职责清晰，但**步骤之间的转场靠用户自己悟**（用户走查结论）：
 * 测评做到一半离开不知道进度已保留、基线做完不知道该去干预、复测做完不知道
 * 去哪看 ΔAccuracy。本组件把"接下来去哪"显式摆出来。
 *
 * 纪律：
 *   - 学长语气：陈述现状 + 给一条最顺的路，不催促、不评判（PRD §6）；
 *   - 一屏最多一张（由各页面自行决定放哪），动作最多 2 个（一屏一件事原则）；
 *   - data-print="hide"：引导是屏幕上的路标，不该被印进报告。
 */

import { Link } from 'react-router-dom';

import { cn } from '../lib/cn';
import { buttonVariants } from './ui';

export interface NextStepAction {
  label: string;
  to: string;
  /** primary = 最顺的那条路（每张卡最多一个）。 */
  primary?: boolean;
}

export interface NextStepCardProps {
  /** 现状一句话（如"已经记了 3 题"）。 */
  status: string;
  /** 建议一句话（学长语气）。 */
  hint: string;
  actions: NextStepAction[];
  /**
   * 分节编号（规范 4.3 的 `01`）。可选：不传则不渲染编号行，
   * 未迁移页面保持与改造前相同的版式（共存策略）。
   */
  no?: string;
  className?: string;
}

export default function NextStepCard({ status, hint, actions, no, className }: NextStepCardProps) {
  return (
    <aside
      data-print="hide"
      className={cn(
        // 蓝图纸质制式（规范 5.12 的「出路行」）：虚线边 + 同色面纱 + 0 圆角。
        // 虚线（而不是实线）是刻意的：这张卡不是图纸的结构件，是**临时路标** ——
        // 走完就该消失，而实线框读起来像一个常驻区块。
        'rounded-none border border-dashed border-accent bg-accent-veil/40 p-4',
        className,
      )}
    >
      <p className="flex flex-wrap items-center gap-2 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">
        {no ? <span className="num-mono text-accent-ink">{no}</span> : null}
        <span>NEXT STEP · 下一步</span>
      </p>
      <p className="mt-1.5 text-body-sm text-ink-soft">{status}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Link
            key={action.to + action.label}
            to={action.to}
            className={cn(
              buttonVariants({ variant: action.primary ? 'primary' : 'secondary', size: 'sm' }),
            )}
          >
            {action.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
