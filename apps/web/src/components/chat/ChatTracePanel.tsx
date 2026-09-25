/**
 * 思考与工具链面板（D5a/D5f）——全屏页与右侧面板共用。
 *
 * 折叠条 + 内容（ThoughtStream + ToolTimeline）：
 *   - 流式期间**自动展开**（过程正在发生，这是用户想看的时刻）；
 *   - 一轮结束后回到用户手上的控制权：可折叠（组件本地态，用户手动折叠后不再自动弹开）；
 *   - 标题文案随模式区分（D4b）：本地模式「推理摘要」/ 远程模式「思考过程」
 *     （数据源 = #20 的 model.mode，由调用方传入；不额外开判断入口）。
 *
 * 对比度（F4 走查实测 + 清尾轮 L2 修正）：小字标签不用半透明降级（`text-ink-soft/80` 浅色下 3.61:1
 * 不达 AA），统一走纯 `text-ink-soft`；「进行中」原为 `text-accent`，浅色 accent = #4E8FB0 落在
 * bg-surface (#FFFFFF) 上只有 **3.57:1**（清尾轮实测量：rgb(78,143,176) on rgb(255,255,255)），
 * 亦不达 AA，改 `text-ink-soft`（浅色 5.51:1）。状态色由左侧那个会呼吸的圆点承载
 * （bg-accent，非文本装饰，浅色 3.57:1 ≥ 非文本 3:1 要求），文字只负责可读。
 * 详见 ToolTimeline 文件头的实测数字。
 *
 * 补（P2，2026-09-25）：上面这条「accent 当文字不达 AA」的结论，当时只能靠**局部规避**
 * 处理（换成 ink-soft，代价是丢掉品牌色，而且每遇到一处都要重新判断一次）。
 * 现在已补上「accent 作为文字」的角色令牌 `text-accent-ink`（浅色 #2E6B87：
 * 白底 5.95:1、accent-veil 上 5.26:1、canvas 上 5.58:1），全站 text-accent 已统一迁移过去。
 * 本文件当前仍走 ink-soft —— 那是这一处刻意的克制选择，不是遗留问题；若将来想给
 * 「进行中」上品牌色，直接用 text-accent-ink 即可，不必再降级成灰色。
 */

import { useState } from 'react';

import type { ChatSsePhaseData, ChatToolStep } from '../../api/types';
import ThoughtStream from './ThoughtStream';
import ToolTimeline from './ToolTimeline';

export interface ChatTracePanelProps {
  thought: string;
  toolSteps: ChatToolStep[];
  phase: ChatSsePhaseData | null;
  /** 本轮是否在流式输出中（决定自动展开与思考流光标）。 */
  streaming: boolean;
  /** 模型模式（#20）：仅用于思考区标题文案，不影响数据。 */
  mode: 'local' | 'remote';
}

export default function ChatTracePanel({ thought, toolSteps, phase, streaming, mode }: ChatTracePanelProps) {
  /** null = 跟随流式（流式期间展开）；用户手动点过后固定为用户选择。 */
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const expanded = manualOpen === null ? streaming : manualOpen;

  const title = streaming
    ? mode === 'remote'
      ? '思考过程（模型自述）'
      : '推理摘要（本地规则）'
    : mode === 'remote'
      ? '思考过程'
      : '推理摘要';

  return (
    <section className="rounded-surface border border-line bg-surface shadow-card" aria-label="思考与工具链">
      <button
        type="button"
        onClick={() => setManualOpen(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 rounded-surface px-4 py-2.5 text-left hover:bg-raised"
      >
        <span className="flex items-center gap-2">
          <span className="text-ui-sm font-medium text-ink">思考与工具链</span>
          {streaming ? (
            // 文本色走 text-ink-soft（浅色 5.51:1）；accent 只留在呼吸圆点上（非文本装饰）
            <span className="flex items-center gap-1 text-caption text-ink-soft">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
              进行中
            </span>
          ) : (
            <span className="text-caption text-ink-soft">{toolSteps.length} 步</span>
          )}
        </span>
        <svg
          className={['h-3 w-3 shrink-0 text-ink-soft transition-transform duration-150', expanded ? 'rotate-180' : ''].join(' ')}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m4 6.5 4 4 4-4" />
        </svg>
      </button>

      {expanded ? (
        <div className="border-t border-line px-4 py-3">
          <div>
            <p className="mb-1.5 text-caption tracking-wide text-ink-soft">{title}</p>
            <ThoughtStream text={thought} done={!streaming} />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <ToolTimeline steps={toolSteps} phase={phase} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
