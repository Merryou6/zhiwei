/**
 * 掌握度状态带 —— 前端颜色与状态带的**唯一事实源**（计划 D6）
 *
 * 三件事在这里一次性锁定：
 *   1) 阈值与状态带判定：**直接复用 engine**（packages/engine/src/statusBand.ts），
 *      前端不得另写阈值或另立区间；守恒测试断言导出常量 === engine 导出值。
 *   2) hex 令牌：PRD §6 只给语义色名（暖橙/黄/浅青绿/青绿）+「低饱和、不刺眼、禁大红」约束，
 *      hex 具体取值由迭代 3 计划 D6 裁决；与 apps/web/tailwind.config.js 的 extend.colors
 *      逐字相等（守恒测试断言）。
 *   3) tailwind class 名与图例文案：组件只允许经本模块取色，禁止硬编码 hex。
 *
 * 导入纪律（执行报告偏差 D-3）：从 statusBand **源模块**导入，而非 engine barrel ——
 * barrel 会连带 params.ts（node:fs / node:path），进浏览器 bundle 会在 vite 构建期
 * 报「externalized for browser compatibility」、运行期直接炸；常量本体仍是 engine 那一份，非复制。
 */

import {
  BAND_COLORS,
  BAND_THRESHOLD_MASTERED,
  BAND_THRESHOLD_MASTERY,
  BAND_THRESHOLD_UNSTABLE,
  masteryToBand,
  masteryToColor,
} from '../../../../packages/engine/src/statusBand';
import type { MasteryBand, MasteryColor } from '../../../../packages/engine/src/statusBand';

export {
  BAND_COLORS,
  BAND_THRESHOLD_MASTERED,
  BAND_THRESHOLD_MASTERY,
  BAND_THRESHOLD_UNSTABLE,
  masteryToBand,
  masteryToColor,
};
export type { MasteryBand, MasteryColor };

/** 主色：低饱和青蓝（PRD §6「主色低饱和青蓝」）。 */
export const PRIMARY_HEX = '#4E8FB0';
/** 主色浅底（图例/链接 hover 底、路径高亮底色）。 */
export const PRIMARY_SOFT_HEX = '#EAF2F6';

/**
 * 四状态带 hex（D6 裁决；全部低饱和，无大红）。
 * 语义色名与 engine.BAND_COLORS 一一对应（守恒测试锁定）。
 */
export const BAND_HEX: Record<MasteryBand, string> = {
  待巩固: '#E8894A',
  不稳定: '#D9B23F',
  基本掌握: '#79B8A6',
  已掌握: '#2F9C7C',
};

/** 四状态带浅底（chip / 条形底；同色相提亮，仅作背景，不参与语义判断）。 */
export const BAND_SOFT_HEX: Record<MasteryBand, string> = {
  待巩固: '#FBEDE2',
  不稳定: '#F8F1DC',
  基本掌握: '#E7F2EF',
  已掌握: '#E2F1EC',
};

/** 状态带固定展示序（低 → 高；图例、报告分布条形图、图例项顺序）。 */
export const BAND_ORDER: readonly MasteryBand[] = ['待巩固', '不稳定', '基本掌握', '已掌握'];

/**
 * 状态带面纱色：把实色降到低不透明度，用作 chip / 浅色底的背景。
 *
 * 为什么不直接用 BAND_SOFT_HEX：那四个值是「在白色底上」配出来的浅色。
 * 深色主题下它们会变成一块发亮的色纸，而 ink 文字在深色下是浅色——
 * 浅底浅字，实测对比度会掉到 1.1:1 附近，等于读不出来。
 *
 * 用实色的低透明度则两套主题同时成立：叠在白底上 ≈ 原来的软色（通道差 ≤4），
 * 叠在深底上则是同色相的暗面纱。色相语义不变，明度自动跟随底色。
 *
 * @param alpha 不透明度。0.14 是「看得出归属、又不抢正文」的取值。
 */
export function bandVeilHex(band: MasteryBand, alpha = 0.14): string {
  const hex = BAND_HEX[band];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 状态带 → tailwind class（与 tailwind.config.js 令牌同名；禁止在组件里写 hex）。 */
export const BAND_CLASS: Record<MasteryBand, { bg: string; text: string; border: string }> = {
  待巩固: { bg: 'bg-band-weak', text: 'text-band-weak', border: 'border-band-weak' },
  不稳定: { bg: 'bg-band-unstable', text: 'text-band-unstable', border: 'border-band-unstable' },
  基本掌握: { bg: 'bg-band-basic', text: 'text-band-basic', border: 'border-band-basic' },
  已掌握: { bg: 'bg-band-mastered', text: 'text-band-mastered', border: 'border-band-mastered' },
};

/**
 * 状态带 → 语义色名（暖橙/黄/浅青绿/青绿）。
 * 直接透传 engine.BAND_COLORS：PRD §6 的颜色语义只有一份映射，前端不重写。
 */
export function bandColorName(band: MasteryBand): MasteryColor {
  return BAND_COLORS[band];
}

/** 掌握度 → 状态带（复用 engine，不另写阈值）。 */
export function masteryBandOf(p: number): MasteryBand {
  return masteryToBand(p);
}

/** 掌握度 → hex（图谱着色、分布条形、ΔAccuracy 徽标的统一取色入口）。 */
export function masteryHexOf(p: number): string {
  return BAND_HEX[masteryToBand(p)];
}
