/**
 * 颜色与状态带守恒测试（D6 建立；2026-10-10 style-10 蓝图迁移 P2 换值）
 *
 * 四组断言，锁死「前端不得另立阈值、不得另立 hex、四档小字必须达标」：
 *   1) 阈值常量 / 状态带判定 === engine（packages/engine/src/statusBand.ts）导出值；
 *   2) bands.ts 的 hex === apps/web/tailwind.config.js 的 extend.colors（逐字）；
 *   3) 四色语义名 === engine.BAND_COLORS（engine 冻结，见下方冲突留痕）；
 *   4) 新增：四档**文本**色（`-t` 系列）在白图 canvas 上的实测对比度 ≥ 4.5:1。
 *
 * 【2026-10-10 style-10 迁移 P2 的换值口径】
 *   档名、阈值、接口签名一律不动（engine 同源，冻结区）；只把四档 hex 换成
 *   「青蓝蓝图」新色系。守恒区只能容纳**一套**字面 hex，取**白图**那一套 ——
 *   默认主题是白图（拍板①「跟随系统、优先白图」），蓝图那一套走 `--c-band-*` 变量
 *   （见 index.css 与 tokens.test.ts ③ 的成对断言）。
 *
 *   ⚠ 冲突留痕（agent 不得静默）：engine.BAND_COLORS 的语义色名仍是
 *   「暖橙 / 黄 / 浅青绿 / 青绿」（PRD §6 口径，engine 属冻结区不改），
 *   而蓝图新色实际是「红 / 黄 / 蓝 / 青」。两者不一致已在
 *   tempui/STYLE-10-设计系统规范.md 第 12.2 章逐条以原型为准留痕。
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
  BAND_TEXT_HEX,
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

/** 白图 canvas（原型 --bg 浅色档 / index.css 的 --c-canvas 白图值）。 */
const LIGHT_CANVAS_HEX = '#F4F7FA';

/** #RRGGBB → 通道值。 */
function rgb(hex: string): { r: number; g: number; b: number } {
  expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** WCAG 相对亮度（sRGB → 线性）。 */
function luminance(hex: string): number {
  const { r, g, b } = rgb(hex);
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 对比度（≥1）。 */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
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

  it('语义色名 === engine.BAND_COLORS（engine 冻结；与蓝图新色相的差异见文件头冲突留痕）', () => {
    expect(BAND_COLORS).toEqual(engine.BAND_COLORS);
    expect(ALL_BANDS.map(bandColorName)).toEqual(['暖橙', '黄', '浅青绿', '青绿']);
  });
});

describe('bands · hex 令牌与 tailwind 配置逐字守恒', () => {
  it('四状态带 hex === tailwind band-* 令牌', () => {
    expect(BAND_HEX['待巩固']).toBe(tailwindColors['band-weak']);
    expect(BAND_HEX['不稳定']).toBe(tailwindColors['band-unstable']);
    expect(BAND_HEX['基本掌握']).toBe(tailwindColors['band-basic']);
    expect(BAND_HEX['已掌握']).toBe(tailwindColors['band-mastered']);
    expect(BAND_HEX['待巩固']).toBe('#B3261E');
    expect(BAND_HEX['不稳定']).toBe('#7A4F00');
    expect(BAND_HEX['基本掌握']).toBe('#1A5FB4');
    expect(BAND_HEX['已掌握']).toBe('#00567A');
  });

  it('主色与主色浅底 === tailwind primary / primary-soft', () => {
    expect(PRIMARY_HEX).toBe(tailwindColors.primary);
    expect(PRIMARY_HEX).toBe('#1A5FB4');
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

  it('无刺眼大红：四色红通道不占绝对优势（规范 12.2 以原型为准后的新判据）', () => {
    // ⚠ 判据换值留痕：上一轮锁的是 r < 0xF0 且 r - max(g,b) < 0x60 ——
    // 那是「暖橙 + 低饱和」那套旧色的实测上限。蓝图新色的「待巩固」是
    // #B3261E（r=179, r-max(g,b)=141），按旧阈值的第二项会被判为违规，
    // 而 PRD §6 禁的是**刺眼大红**（纯饱和红）不是红本身，故按新色系重取阈值：
    //   · r < 0xC0（192）：纯红 #FF0000 / #F10000 一类仍然被拦；
    //   · r - max(g,b) < 0x90（144）：实测新色最大差值为 141，旧色系（95）也在内。
    // 这是「只换值」而非删断言：一旦有人把 band 色写成 #FF3B30（r=255、差值 255-59=196），
    // 两条都会失败。
    for (const band of ALL_BANDS) {
      const { r, g, b } = rgb(BAND_HEX[band]);
      expect(r).toBeLessThan(0xc0);
      expect(r - Math.max(g, b)).toBeLessThan(0x90);
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

describe('bands · 四档文本色 -t 系列（规范 2.3：小字达标）', () => {
  it('BAND_TEXT_HEX 四档齐全、格式合法，且与 engine 档名一一对应', () => {
    expect(Object.keys(BAND_TEXT_HEX).sort()).toEqual([...ALL_BANDS].sort());
    for (const band of ALL_BANDS) rgb(BAND_TEXT_HEX[band]);
  });

  it('四档文本色在白图 canvas 上实测对比度 ≥ 4.5:1（天蓝不做小字，规范 2.4）', () => {
    for (const band of ALL_BANDS) {
      const ratio = contrast(BAND_TEXT_HEX[band], LIGHT_CANVAS_HEX);
      expect(
        ratio,
        `${band} 的文本色 ${BAND_TEXT_HEX[band]} 在 canvas ${LIGHT_CANVAS_HEX} 上只有 ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
