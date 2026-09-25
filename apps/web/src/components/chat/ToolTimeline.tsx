/**
 * 工具链竖向时间轴（D5c）——全屏页与右侧面板共用。
 *
 * 每一步都是服务端**真实发生**的动作（契约 §9 v1.3 的 7 项工具名闭集，未发生的步骤零事件）：
 *   label（中文可读名）+ name（闭集标识）+ ms（真实耗时）+ args/result（真实中间量，紧凑键值行）。
 * 状态图标：running 转圈 / ok ✓（band-basic）/ error（tone-error）。
 * 阶段进度条：analyze → retrieve → judge → generate 四档。
 *
 * 对比度（F4 走查实测，D26）：组件内小字（步骤名 10px / 键值行 10–11px）**不用**
 * `text-ink-soft/70` 这类半透明降级 —— 浅色主题下实测 2.97:1 / 3.61:1，不达 WCAG AA（4.5:1）；
 * 改为纯 `text-ink-soft` 后浅色 5.4:1、深色 8.9:1。降级靠字号与字重表达，不靠透明度。
 *
 * 数值显示（清尾轮 L4，2026-09-24）：args/result/ms 里的数字统一走 lib/format.metric
 * （最多 3 位小数 + 去尾随 0），浮点噪声不再直出；**只改显示，真实值一个字不动**。
 */

import type { ChatSsePhaseData, ChatPhaseName, ChatToolStep, ChatToolStatus } from '../../api/types';
import { metric } from '../../lib/format';

const PHASE_ORDER: ChatPhaseName[] = ['analyze', 'retrieve', 'judge', 'generate'];

/** 值过长截断（面板窄，长 JSON 会把卡片撑爆）。 */
const MAX_VALUE_LENGTH = 42;

/**
 * 值 → 单行文本。数字走 lib/format.metric（最多 3 位小数、去尾随 0）：
 * 真实中间量里有 IEEE754 噪声（实测 apply_evidence.result.after = 0.009000000000000001，
 * 而同轮推理摘要写「0.01」），直接 String() 会让同一份数据在一屏里长出两个样子。
 * ⚠ 只格式化**显示**：step.args / step.result / step.ms 的真实值一个字不改（契约 §9 的语义）。
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  if (typeof value === 'number') return metric(value);
  if (typeof value === 'boolean') return String(value);
  const json = JSON.stringify(value);
  if (json === undefined) return '—';
  return json.length > MAX_VALUE_LENGTH ? `${json.slice(0, MAX_VALUE_LENGTH)}…` : json;
}

function StatusIcon({ status }: { status: ChatToolStatus }) {
  if (status === 'running') {
    return (
      <svg className="h-3.5 w-3.5 animate-spin text-accent-ink" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="h-3.5 w-3.5 text-tone-error" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.8v4M8 11.2h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 text-band-basic" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="m5.2 8.2 1.9 1.9 3.7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyValueRows({ title, data }: { title: string; data?: Record<string, unknown> }) {
  const entries = data ? Object.entries(data) : [];
  if (entries.length === 0) return null;
  return (
    <div className="mt-1.5">
      <p className="text-caption uppercase tracking-wide text-ink-soft">{title}</p>
      <dl className="mt-0.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        {entries.map(([key, value]) => (
          <div key={key} className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
            <dt className="font-mono text-caption text-ink-soft">{key}</dt>
            <dd className="truncate text-caption text-ink" title={formatValue(value)}>
              {formatValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export interface ToolTimelineProps {
  steps: ChatToolStep[];
  phase: ChatSsePhaseData | null;
}

export default function ToolTimeline({ steps, phase }: ToolTimelineProps) {
  const phaseIndex = phase ? PHASE_ORDER.indexOf(phase.name) : -1;
  const progress = phaseIndex < 0 ? 0 : ((phaseIndex + 1) / PHASE_ORDER.length) * 100;

  return (
    <div>
      {/* 阶段进度：第 n/4 档 + 进度条 */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-ink-soft" role="status">
          {phase ? `阶段 ${phaseIndex + 1}/${PHASE_ORDER.length} · ${phase.label}` : '等待开始'}
        </p>
        <p className="font-mono text-caption text-ink-soft">
          {steps.length > 0 ? `第 ${steps.length} 步` : ''}
        </p>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {steps.length === 0 ? (
        <p className="mt-3 text-caption text-ink-soft">还没有调用工具。</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {steps.map((step, index) => (
            <li key={step.id} className="relative rounded-lg border border-line bg-canvas/50 p-2">
              {/* 竖向连接线（非文本装饰） */}
              {index < steps.length - 1 ? (
                <span className="absolute left-[15px] top-[26px] h-[calc(100%-10px)] w-px bg-line" aria-hidden="true" />
              ) : null}
              <div className="flex items-start gap-2">
                <span className="mt-0.5">
                  <StatusIcon status={step.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-ui-sm text-ink">
                      第 {index + 1} 步 · {step.label}
                    </p>
                    <span className="shrink-0 font-mono text-caption text-ink-soft">
                      {typeof step.ms === 'number' ? `${metric(step.ms)}ms` : '—'}
                    </span>
                  </div>
                  <p className="font-mono text-caption text-ink-soft">{step.name}</p>
                  <KeyValueRows title="入参" data={step.args} />
                  <KeyValueRows title="产出" data={step.result} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
