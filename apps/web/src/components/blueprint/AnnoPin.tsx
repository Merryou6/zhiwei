/**
 * AnnoPin 编号徽标（按需展开）（style-10 蓝图迁移 P4 / 规范 6.1、6.2）
 *
 * 标注的默认形态：目标块右上角一枚圆形编号徽标（24×24；md/sm 档与粗指针环境下
 * 抬到 44×44 —— 触控底线），悬浮 / 聚焦 / 点击展开正文。
 *
 * 【状态机（单一展开）】open 是**受控**的：同一时刻只允许一枚展开（原型行为），
 * 这个约束必须由父容器持有（组件自己无法知道「别的徽标开没开」）。
 * 所以这里只做三件事：把 open 画出来、把点击转成 onOpenChange、Esc 收起。
 *
 * 【无障碍（D11 拍板）】触发键 aria-expanded + aria-controls 指向浮层 id；
 * 浮层只在展开时挂载（收起即不存在）。不用 aria-details（浏览器支持不全）。
 */

import { useId, type ReactNode } from 'react';

import { cn } from '../../lib/cn';
import AnnoPop from './AnnoPop';

export interface AnnoPinProps {
  /** 编号，如 '①'。 */
  no: string;
  title: string;
  body: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 徽标在目标上的位置（画布走左上，避开右上工具列）。 */
  align?: 'right' | 'left';
  className?: string;
}

export default function AnnoPin({
  no,
  title,
  body,
  open,
  onOpenChange,
  align = 'right',
  className,
}: AnnoPinProps) {
  const popId = `anno-pop-${useId().replace(/:/g, '')}`;

  return (
    <span
      className={cn('absolute top-2 z-20', align === 'right' ? 'right-2' : 'left-2', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={`标注 ${no}：${title}，悬浮或点击显示说明`}
        className={cn(
          'grid h-11 w-11 place-items-center rounded-full border bg-surface font-mono text-tok leading-none text-accent-ink',
          'transition-colors duration-100 ease-out',
          open ? 'border-accent bg-accent-veil' : 'border-line hover:border-accent',
        )}
      >
        {no}
      </button>
      {open ? (
        <AnnoPop id={popId} no={no} title={title} body={body} align={align} />
      ) : null}
    </span>
  );
}
