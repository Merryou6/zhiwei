/**
 * 掌握度状态带（ALGORITHM §6）
 *
 * | 区间    | 状态     | 颜色   |
 * | < 0.4   | 待巩固   | 暖橙   |
 * | 0.4–0.6 | 不稳定   | 黄     |
 * | 0.6–0.8 | 基本掌握 | 浅青绿 |
 * | > 0.8   | 已掌握   | 青绿   |
 *
 * 规格区间在原文档边界处表述含糊（`0.4 – 0.6` 与 `> 0.8`），本迭代统一按
 * 「左闭右开」处理：p<0.4 待巩固；0.4≤p<0.6 不稳定；0.6≤p<0.8 基本掌握；p≥0.8 已掌握。
 *
 * 注意：以下三个阈值是 ALGORITHM §6 的界面呈现在用规格常量（非 config/params.json 参数），
 * 集中定义于此，禁止散落到其他模块。
 */
export const BAND_THRESHOLD_UNSTABLE = 0.4;
export const BAND_THRESHOLD_MASTERY = 0.6;
export const BAND_THRESHOLD_MASTERED = 0.8;

export type MasteryBand = '待巩固' | '不稳定' | '基本掌握' | '已掌握';
export type MasteryColor = '暖橙' | '黄' | '浅青绿' | '青绿';

/** 掌握度 → 状态带。 */
export function masteryToBand(p: number): MasteryBand {
  if (p < BAND_THRESHOLD_UNSTABLE) return '待巩固';
  if (p < BAND_THRESHOLD_MASTERY) return '不稳定';
  if (p < BAND_THRESHOLD_MASTERED) return '基本掌握';
  return '已掌握';
}

/** 状态带 → 颜色（与 PRD §6 颜色语义一致，供前端后续消费）。 */
export const BAND_COLORS: Record<MasteryBand, MasteryColor> = {
  待巩固: '暖橙',
  不稳定: '黄',
  基本掌握: '浅青绿',
  已掌握: '青绿',
};

/** 掌握度 → 颜色。 */
export function masteryToColor(p: number): MasteryColor {
  return BAND_COLORS[masteryToBand(p)];
}
