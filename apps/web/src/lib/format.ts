/**
 * 展示格式化（纯函数，零依赖；所有页面共用，禁止在组件里散写 toFixed/日期拼接）。
 */

import { kpName } from '../data/graphSnapshot';

/** 掌握度 → 百分比文本，如 0.845 → '85%'（digits 默认 0 位）。 */
export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/** ΔAccuracy → 带符号百分比文本（null → '—'）。 */
export function deltaPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/**
 * 数值 → 展示文本：最多 digits（默认 3）位小数，尾随 0 去掉（0.009 / 0.5 / 0.45 / 1）。
 *
 * 为什么需要：链路面板里的中间量是**真实计算出来的** IEEE754 双精度值，直接 String() 会带浮点噪声
 * —— 实测 apply_evidence.result.after = 0.009000000000000001，而同轮推理摘要写的是「0.01」，
 * 同一份数据在一屏里长出两个样子。
 * ⚠ 只用于**显示**：契约 §9 的 tool.result / tool.ms 字段语义是真实值，
 *   数据本身一个字都不许改（本函数是纯函数，不回写任何 store / 事件）。
 * 非有限值（NaN / ±Infinity）→ '—'（与 percent 等函数的降级口径一致）。
 */
export function metric(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  if (!fixed.includes('.')) return fixed;
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  // 极小非零值（|v| < 0.5×10^-digits）四舍五入会变成 '0' —— 那是显示失真（数值并非 0），
  // 退回 3 位有效数字的科学计数，宁可难看也不写错。
  if (value !== 0 && Number(trimmed) === 0) return String(Number(value.toPrecision(3)));
  return trimmed;
}

/**
 * 知识点短名：优先取全名；超过 limit 时截断加省略号（图谱节点标签、窄栏表格用）。
 * 未知 id 回退为 id 本身（禁止白屏）。
 */
export function kpLabel(id: string, limit = 12): string {
  const name = kpName(id);
  return name.length <= limit ? name : `${name.slice(0, limit)}…`;
}

/** 字节 → 人性化大小（云盘列表用）。 */
export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

/** ISO8601 → 本地可读时间（秒精度，契约 §0 时间格式）。 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** 模式 → 中文名（测评页模式卡、报告页口径说明共用）。 */
export const MODE_LABEL: Record<'diagnose' | 'baseline' | 'retest', string> = {
  diagnose: '诊断测评',
  baseline: '基线测量',
  retest: '复测测量',
};
