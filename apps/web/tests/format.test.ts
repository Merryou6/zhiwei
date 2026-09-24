/**
 * 展示格式化（lib/format.ts）——清尾轮 L4 新增 metric() 的回归网。
 *
 * 为什么单独立一份：链路面板里的真实中间量带 IEEE754 噪声
 *（实测 apply_evidence.result.after = 0.009000000000000001），显示层需要一条
 * 「只改显示、不改数据」的确定性规则；这条规则必须钉住边界（整数 / 尾随 0 /
 * 极小非零值不能显示成 0 / 非有限值降级）。
 */

import { describe, expect, it } from 'vitest';

import { metric } from '../src/lib/format';

describe('format.metric · 数值显示（L4 浮点噪声只在显示层收敛）', () => {
  it('3 位小数内的值原样显示，尾随 0 去掉', () => {
    expect(metric(0.009)).toBe('0.009');
    expect(metric(0.009000000000000001)).toBe('0.009'); // 实测的真实中间量（apply_evidence.result.after）
    expect(metric(0.5)).toBe('0.5');
    expect(metric(0.45)).toBe('0.45');
    expect(metric(0.85)).toBe('0.85');
    expect(metric(3.244)).toBe('3.244');
    expect(metric(2.54)).toBe('2.54');
    expect(metric(17.329)).toBe('17.329');
  });

  it('整数不补小数点，零显示为 0（不是 0.000）', () => {
    expect(metric(0)).toBe('0');
    expect(metric(24)).toBe('24');
    expect(metric(100)).toBe('100');
    expect(metric(-2)).toBe('-2');
  });

  it('超过 3 位小数四舍五入到 3 位（显示层规则，不改数据）', () => {
    expect(metric(0.12345)).toBe('0.123');
    expect(metric(1.9999)).toBe('2');
    expect(metric(0.0009)).toBe('0.001');
    expect(metric(0.4, 1)).toBe('0.4');
    expect(metric(0.44, 1)).toBe('0.4');
  });

  it('极小非零值不许显示成 0（宁难看也不失真）', () => {
    expect(metric(1e-7)).toBe('1e-7');
    expect(metric(-1e-7)).toBe('-1e-7');
  });

  it('非有限值降级为 —（与 percent / fileSize 同口径）', () => {
    expect(metric(Number.NaN)).toBe('—');
    expect(metric(Number.POSITIVE_INFINITY)).toBe('—');
    expect(metric(Number.NEGATIVE_INFINITY)).toBe('—');
  });

  it('是纯函数：同一输入恒等输出，且不改动入参语义（无状态、无副作用）', () => {
    const noisy = 0.009000000000000001;
    expect(metric(noisy)).toBe(metric(noisy));
    expect(noisy).toBe(0.009000000000000001); // 原值未被触碰
  });
});
