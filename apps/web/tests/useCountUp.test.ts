import { describe, expect, it } from 'vitest';

import { easeOutCubic } from '../src/lib/useCountUp';

/**
 * 交互峰值包（2026-10-09）：数字滚动的缓动曲线。
 * hook 本体（rAF 循环 + reduced-motion 分支）依赖真实时钟/环境，
 * 单测锁定纯函数部分 —— 边界、单调性、ease-out 特征。
 */
describe('easeOutCubic（数字滚动缓动，对齐全站入场曲线的手感）', () => {
  it('边界：0→0、1→1，越界夹紧不外溢', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-0.5)).toBe(0);
    expect(easeOutCubic(1.5)).toBe(1);
  });

  it('曲线值正确：t=0.5 → 0.875（1 - 0.5³）', () => {
    expect(easeOutCubic(0.5)).toBe(0.875);
  });

  it('单调不减，且前半程过半（先快后慢 = ease-out 特征）', () => {
    let previous = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const value = easeOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
