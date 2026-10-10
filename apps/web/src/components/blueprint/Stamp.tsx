/**
 * Stamp 红章错误态（style-10 蓝图迁移 P4 / 规范 5.8）
 *
 * 失败态的形态：外框 1px 红实线 + inset 4px 红虚线 + 右上角方块章 +
 * 「!! 数据获取失败」章头 + 原因 + 真重试与一条出路。
 *
 * 【三条纪律】
 *   1. 失败不得画成空态：空 ≠ 失败（规范 7.1）。空态只引导，失败才给重试。
 *   2. 必须说清「失败的是什么」：`reason` 是必填，禁止「出错了」这类无信息文案。
 *   3. 重试必须是**真重试**（调用方传 onRetry 重新发起同一请求），在途时禁用；
 *      不提供「到状态实验室改回正常」这类出口（拍板③：状态实验室不迁移）。
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../../lib/cn';
import { Icon } from './icons';

export interface StampProps {
  /** 章头（缺省「!! 数据获取失败」）。 */
  title?: string;
  /** 方块章文字（缺省 RED STAMP）。 */
  seal?: string;
  /** 失败的是什么 + 为什么。必填。 */
  reason: ReactNode;
  /** 有则渲染重试主按钮。 */
  onRetry?: () => void;
  /** 重试在途。 */
  retrying?: boolean;
  /** 一条出路（换个入口）。 */
  alt?: { label: string; to: string };
  /** red = 失败；amber = 角色 / 权限类提示（非失败）。 */
  tone?: 'red' | 'amber';
  /** 追加的动作行内容。 */
  extra?: ReactNode;
  className?: string;
}

export default function Stamp({
  title = '!! 数据获取失败',
  seal = 'RED STAMP',
  reason,
  onRetry,
  retrying = false,
  alt,
  tone = 'red',
  extra,
  className,
}: StampProps) {
  const amber = tone === 'amber';
  return (
    <div
      role="alert"
      className={cn(amber ? 'relative border border-line bg-surface p-4' : 'bp-stamp p-4', className)}
    >
      {/* 内层虚线：制图感来自「双线」，与空态的双层虚框同一个手法。
          red 档由 `.bp-stamp`（index.css 制式类）统一定义 inset 4px + 55% 透明；
          amber 是「角色/权限类提示」不是失败，故不套红章制式，自己起一层灰虚线。 */}
      {amber ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 border border-dashed border-line opacity-50"
        />
      ) : null}
      <span
        className={cn(
          'absolute -top-3 right-3 border bg-canvas px-2 py-0.5 font-mono text-mono-xs uppercase tracking-widest',
          amber ? 'border-line text-ink-soft' : 'border-danger text-danger',
        )}
      >
        {seal}
      </span>

      <div
        className={cn(
          'relative mb-2 flex items-center gap-2.5 font-mono text-ui-sm font-semibold tracking-widest',
          amber ? 'text-ink' : 'text-danger',
        )}
      >
        <Icon name="alert" className="h-[18px] w-[18px]" />
        <span>{title}</span>
      </div>

      <p className="relative max-w-[64ch] text-body-sm text-ink-soft">{reason}</p>

      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-control border px-3 py-2 font-mono text-ui-sm uppercase tracking-widest',
              amber
                ? 'border-line text-ink hover:border-accent'
                : 'border-danger bg-danger text-on-accent',
              retrying && 'cursor-not-allowed opacity-60',
            )}
          >
            <Icon name="retry" className="h-4 w-4" />
            {retrying ? '重试中…' : '重试一次'}
          </button>
        ) : null}
        {alt ? (
          <Link
            to={alt.to}
            className="inline-flex min-h-11 items-center rounded-control border border-line px-3 py-2 font-mono text-ui-sm uppercase tracking-widest text-ink hover:border-accent hover:bg-accent-veil"
          >
            {alt.label}
          </Link>
        ) : null}
        {extra}
      </div>
    </div>
  );
}
