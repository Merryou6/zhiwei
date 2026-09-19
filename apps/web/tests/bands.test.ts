/**
 * 颜色与状态带守恒测试（D6）
 *
 * 三组断言，锁死「前端不得另立阈值、不得另立 hex」：
 *   1) 阈值常量 / 状态带判定 === engine（packages/engine/src/statusBand.ts）导出值；
 *   2) bands.ts 的 hex === apps/web/tailwind.config.js 的 extend.colors（逐字）；
 *   3) 四色语义名 === engine.BAND_COLORS（暖橙/黄/浅青绿/青绿），且无刺眼大红。
 */

import { describe, expect, it } from 'vitest';

// @ts-ignore -- tailwind 配置为无类型声明的 JS 文件，本测试只读取其字面量
import tailwindConfig from '../tailwind.config.js';
import * as engine from '../../../packages/engine/src/index';
import {
  BAND_CLASS,
  BAND_COLORS,
  BAND_HEX,
  BAND_ORDER,
  BAND_SOFT_HEX,
  BAND_THRESHOLD_MASTERED,
  BAND_THRESHOLD_MASTERY,
  BAND_THRESHOLD_UNSTABLE,
  PRIMARY_HEX,
  PRIMARY_SOFT_HEX,
  bandColorName,
  masteryBandOf,
  masteryHexOf,
} from '../src/theme/bands';
import type { MasteryBand } from '../src/theme/bands';

const tailwindColors = (tailwindConfig as {
  theme: { extend: { colors: Record<string, string> } };
}).theme.extend.colors;

const ALL_BANDS: MasteryBand[] = ['待巩固', '不稳定', '基本掌握', '已掌握'];

/** #RRGGBB → 通道值。 */
function rgb(hex: string): { r: number; g: number; b: number } {
  expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

describe('bands · 阈值与状态带判定复用 engine（前端禁止另写阈值）', () => {
  it('三个阈值常量 === engine 导出值', () => {
    expect(BAND_THRESHOLD_UNSTABLE).toBe(engine.BAND_THRESHOLD_UNSTABLE);
    expect(BAND_THRESHOLD_MASTERY).toBe(engine.BAND_THRESHOLD_MASTERY);
    expect(BAND_THRESHOLD_MASTERED).toBe(engine.BAND_THRESHOLD_MASTERED);
    expect([BAND_THRESHOLD_UNSTABLE, BAND_THRESHOLD_MASTERY, BAND_THRESHOLD_MASTERED]).toEqual([
      0.4, 0.6, 0.8,
    ]);
  });

  it('masteryBandOf === engine.masteryToBand（含边界 0.399/0.4/0.599/0.6/0.799/0.8）', () => {
    const samples = [0, 0.399, 0.4, 0.599, 0.6, 0.799, 0.8, 1];
    for (const p of samples) {
      expect(masteryBandOf(p)).toBe(engine.masteryToBand(p));
    }
    // 左闭右开口径（statusBand.ts 注释）：边界值落在「上」一档
    expect(masteryBandOf(0.399)).toBe('待巩固');
    expect(masteryBandOf(0.4)).toBe('不稳定');
    expect(masteryBandOf(0.599)).toBe('不稳定');
    expect(masteryBandOf(0.6)).toBe('基本掌握');
    expect(masteryBandOf(0.799)).toBe('基本掌握');
    expect(masteryBandOf(0.8)).toBe('已掌握');
  });

  it('masteryHexOf 与状态带一致（低 → 高的四段取色）', () => {
    expect(masteryHexOf(0.399)).toBe(BAND_HEX['待巩固']);
    expect(masteryHexOf(0.4)).toBe(BAND_HEX['不稳定']);
    expect(masteryHexOf(0.6)).toBe(BAND_HEX['基本掌握']);
    expect(masteryHexOf(0.8)).toBe(BAND_HEX['已掌握']);
  });

  it('语义色名 === engine.BAND_COLORS（暖橙/黄/浅青绿/青绿）', () => {
    expect(BAND_COLORS).toEqual(engine.BAND_COLORS);
    expect(ALL_BANDS.map(bandColorName)).toEqual(['暖橙', '黄', '浅青绿', '青绿']);
  });
});

describe('bands · hex 令牌与 tailwind 配置逐字守恒（D6）', () => {
  it('四状态带 hex === tailwind band-* 令牌', () => {
    expect(BAND_HEX['待巩固']).toBe(tailwindColors['band-weak']);
    expect(BAND_HEX['不稳定']).toBe(tailwindColors['band-unstable']);
    expect(BAND_HEX['基本掌握']).toBe(tailwindColors['band-basic']);
    expect(BAND_HEX['已掌握']).toBe(tailwindColors['band-mastered']);
    expect(BAND_HEX['待巩固']).toBe('#E8894A');
    expect(BAND_HEX['不稳定']).toBe('#D9B23F');
    expect(BAND_HEX['基本掌握']).toBe('#79B8A6');
    expect(BAND_HEX['已掌握']).toBe('#2F9C7C');
  });

  it('主色与主色浅底 === tailwind primary / primary-soft', () => {
    expect(PRIMARY_HEX).toBe(tailwindColors.primary);
    expect(PRIMARY_HEX).toBe('#4E8FB0');
    expect(PRIMARY_SOFT_HEX).toBe(tailwindColors['primary-soft']);
  });

  it('四状态带与浅底 hex 四色齐全且格式合法', () => {
    expect(Object.keys(BAND_HEX).sort()).toEqual([...ALL_BANDS].sort());
    expect(Object.keys(BAND_SOFT_HEX).sort()).toEqual([...ALL_BANDS].sort());
    for (const band of ALL_BANDS) {
      rgb(BAND_HEX[band]);
      rgb(BAND_SOFT_HEX[band]);
    }
  });

  it('无刺眼大红：四色红通道不占绝对优势（PRD §6 禁用刺眼大红）', () => {
    for (const band of ALL_BANDS) {
      const { r, g, b } = rgb(BAND_HEX[band]);
      expect(r).toBeLessThan(0xf0);
      expect(r - Math.max(g, b)).toBeLessThan(0x60);
    }
  });

  it('BAND_ORDER 覆盖四带（图例 / 分布图顺序唯一来源）', () => {
    expect([...BAND_ORDER].sort()).toEqual([...ALL_BANDS].sort());
    expect(BAND_ORDER).toEqual(['待巩固', '不稳定', '基本掌握', '已掌握']);
  });

  it('BAND_CLASS 指向 tailwind band-* 令牌（组件不得硬编码 hex）', () => {
    const tokens = ['band-weak', 'band-unstable', 'band-basic', 'band-mastered'];
    for (const band of ALL_BANDS) {
      expect(tokens).toContain(BAND_CLASS[band].bg.replace('bg-', ''));
      expect(tokens).toContain(BAND_CLASS[band].text.replace('text-', ''));
      expect(tokens).toContain(BAND_CLASS[band].border.replace('border-', ''));
    }
  });
});
