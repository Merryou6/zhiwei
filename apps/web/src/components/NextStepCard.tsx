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
  className?: string;
}

export default function NextStepCard({ status, hint, actions, className }: NextStepCardProps) {
  return (
    <aside
      data-print="hide"
      className={cn(
        'rounded-surface border border-dashed border-accent/40 bg-accent-veil/40 p-4',
        className,
      )}
    >
      <p className="text-ui-sm text-ink-soft">{status}</p>
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
