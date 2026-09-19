/**
 * 掌握度状态带（ALGORITHM §6 / PRD §6 颜色语义）
 *
 *   < 0.4        待巩固   暖橙
 *   0.4 – 0.6    不稳定   黄
 *   0.6 – 0.8    基本掌握 浅青绿
 *   ≥ 0.8        已掌握   青绿
 *
 * 说明：规格区间在端点上含糊（`> 0.8` 与 `0.6 – 0.8` 重合），计划 步骤 7e 已统一约定：
 *   p<0.4 待巩固；0.4≤p<0.6 不稳定；0.6≤p<0.8 基本掌握；p≥0.8 已掌握。
 */

export type MasteryBand = '待巩固' | '不稳定' | '基本掌握' | '已掌握';

/** PRD §6 颜色语义（供前端图谱着色与图例消费） */
export type BandColor = '暖橙' | '黄' | '浅青绿' | '青绿';

/** ALGORITHM §6 状态带下界（规格常量，集中定义，禁止散落到组件里） */
const BAND_BOUNDARY_LOW = 0.4;
/** ALGORITHM §6 状态带中界 */
const BAND_BOUNDARY_MID = 0.6;
/** ALGORITHM §6 状态带上界 */
const BAND_BOUNDARY_HIGH = 0.8;

export function masteryToBand(p: number): MasteryBand {
  if (p < BAND_BOUNDARY_LOW) return '待巩固';
  if (p < BAND_BOUNDARY_MID) return '不稳定';
  if (p < BAND_BOUNDARY_HIGH) return '基本掌握';
  return '已掌握';
}

/** 状态带 → 颜色（PRD §6 全局一致：低饱和青蓝主色，禁用刺眼大红） */
export const BAND_COLORS: Record<MasteryBand, BandColor> = {
  待巩固: '暖橙',
  不稳定: '黄',
  基本掌握: '浅青绿',
  已掌握: '青绿',
};
