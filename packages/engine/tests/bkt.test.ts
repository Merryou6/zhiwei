/**
 * 加权 BKT 单测（ALGORITHM §1 硬门槛：3 个自检用例全过才算实现完成）
 *
 * 计划 步骤 8 用例清单：
 *   T1 P_L=0.5 答对 w=1.0 → after ≈ 0.845（toBeCloseTo 容差 1e-3）
 *   T2 P_L=0.5 答对 w=0.8 → after ≈ 0.791
 *   T3 P_L=0.5 答错 w=1.0 → after ≈ 0.244
 *   T4 w=0 → 三值相等且等于 clamp 后的输入（规格早退分支）
 *   T5 输入越界 clamp：pL=0 / 1.5 → 结果落在 CLAMP 内
 *   T6 弱负证据：pL=0.5 → 0.45（0.5 × 0.9）
 *   T7 中间量对照：T1 场景 p_obs≈0.818、p_eff≈0.818；T2 场景 p_eff≈0.754
 *   T8 dedup_key：同时间戳一致、跨小时桶不同、格式五段冒号分隔
 * 另含 params 外置完整性（与六、6.2 同源）与掌握度状态带四区间映射（验收 C6）。
 *
 * 参数一律取自 config/params.json（ALGORITHM §0 的 17 项由该文件提供），
 * 测试内不内联任何参数数值；末段另有「独立复算」用例，用第二种写法核对公式。
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  applyWeakNegative,
  BAND_COLORS,
  buildDedupKey,
  clamp,
  hourBucket,
  isDuplicateKey,
  loadParams,
  masteryToBand,
  masteryToColor,
  PARAM_KEYS,
  updateMastery,
} from '../src/index';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const P = loadParams(resolve(REPO_ROOT, 'config/params.json'));

describe('params · 参数外置（ALGORITHM §0 全部 17 键）', () => {
  it('键清单与 params.json 实际键完全一致且为 17 项', () => {
    expect(PARAM_KEYS).toHaveLength(17);
    expect(Object.keys(P).sort()).toEqual([...PARAM_KEYS].sort());
  });

  it('PRIOR_MAP 键为字符串 1–5；CLAMP 为合法区间', () => {
    expect(Object.keys(P.PRIOR_MAP).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(P.CLAMP[0]).toBeLessThan(P.CLAMP[1]);
  });
});

describe('bkt · ALGORITHM §1 三个自检用例（硬门槛，±0.001）', () => {
  it('T1 P_L=0.5、答对、w=1.0 → after ≈ 0.845', () => {
    const r = updateMastery(0.5, true, P.W_DIAGNOSE, P);
    expect(r.after).toBeCloseTo(0.845, 3);
  });

  it('T2 P_L=0.5、答对、w=0.8 → after ≈ 0.791', () => {
    const r = updateMastery(0.5, true, P.W_PAPER, P);
    expect(r.after).toBeCloseTo(0.791, 3);
  });

  it('T3 P_L=0.5、答错、w=1.0 → after ≈ 0.244', () => {
    const r = updateMastery(0.5, false, P.W_DIAGNOSE, P);
    expect(r.after).toBeCloseTo(0.244, 3);
  });

  it('T4 w=0 → 早退：before / p_obs / p_eff / after 相等且等于 clamp 后的输入', () => {
    const r = updateMastery(0.5, true, 0, P);
    expect(r.before).toBeCloseTo(0.5, 12);
    expect(r.p_obs).toBe(r.before);
    expect(r.p_eff).toBe(r.before);
    expect(r.after).toBe(r.before);
    expect(r.weight).toBe(0);
  });

  it('T5 输入越界先 clamp：pL=0 → 0.01、pL=1.5 → 0.99，全部结果落在 CLAMP 内', () => {
    const low = updateMastery(0, true, P.W_DIAGNOSE, P);
    const high = updateMastery(1.5, false, P.W_DIAGNOSE, P);
    expect(low.before).toBeCloseTo(P.CLAMP[0], 12);
    expect(high.before).toBeCloseTo(P.CLAMP[1], 12);
    for (const v of [low.before, low.p_obs, low.p_eff, low.after, high.after]) {
      expect(v).toBeGreaterThanOrEqual(P.CLAMP[0]);
      expect(v).toBeLessThanOrEqual(P.CLAMP[1]);
    }
  });

  it('T6 弱负证据：0.5 → 0.45（P × (1 − ALPHA_SILENT)）', () => {
    expect(applyWeakNegative(0.5, P)).toBeCloseTo(0.45, 10);
    expect(applyWeakNegative(0.5, P)).toBeCloseTo(0.5 * (1 - P.ALPHA_SILENT), 12);
  });

  it('T7 中间量对照：T1 场景 p_obs≈0.818、p_eff≈0.818；T2 场景 p_eff≈0.754', () => {
    const t1 = updateMastery(0.5, true, P.W_DIAGNOSE, P);
    expect(t1.p_obs).toBeCloseTo(0.818, 3);
    expect(t1.p_eff).toBeCloseTo(0.818, 3);
    const t2 = updateMastery(0.5, true, P.W_PAPER, P);
    // 规格写作「p_eff ≈ 0.754」，精确值为 0.8×0.818182 + 0.2×0.5 = 0.7545454…；
    // 按 0.754 直接断言会超出 toBeCloseTo(·, 3) 的 0.0005 容差（差 0.00055），
    // 属规格文本取整差异而非实现误差，故与精确值 0.7545 比较（容差仍为 1e-3 级别）。
    expect(t2.p_eff).toBeCloseTo(0.7545, 3);
  });
});

describe('bkt · 三段式实现路径与独立复算（另一套写法交叉核对）', () => {
  it('中间量可由公式独立复算（后验 → 插值 → 迁移）', () => {
    const pL = 0.5;
    const w = P.W_PAPER;
    const r = updateMastery(pL, true, w, P);
    // 独立写法：分别计算对/错的四条路径再取比值
    const num = pL * (1 - P.P_S);
    const den = pL * (1 - P.P_S) + (1 - pL) * P.P_G;
    expect(r.p_obs).toBeCloseTo(num / den, 12);
    const pEff = w * r.p_obs + (1 - w) * pL;
    const pNew = pEff + (1 - pEff) * P.P_T;
    expect(r.p_eff).toBeCloseTo(pEff, 12);
    expect(r.after).toBeCloseTo(clamp(pNew, P), 12);
  });

  it('答错分支：后验低于先验（错答降低掌握度估计）', () => {
    const r = updateMastery(0.6, false, P.W_DIAGNOSE, P);
    expect(r.p_obs).toBeLessThan(r.before);
    expect(r.after).toBeLessThan(r.before);
  });

  it('clamp 边界：低于下界/高于上界/区间内', () => {
    expect(clamp(P.CLAMP[0] / 2, P)).toBe(P.CLAMP[0]);
    expect(clamp(P.CLAMP[1] * 2, P)).toBe(P.CLAMP[1]);
    expect(clamp(0.5, P)).toBe(0.5);
  });
});

describe('dedup · ALGORITHM §1 去重键（幂等算法侧，查重落库属迭代 2）', () => {
  const base = {
    userId: 'u_1024',
    spaceId: 'sp_001',
    kp: 'math.cz.quadratic.vertex_form',
    source: 'diagnose' as const,
    unixTs: 1_700_000_000,
  };

  it('T8a 同一时间戳两次构造结果一致（确定性）', () => {
    expect(buildDedupKey(base)).toBe(buildDedupKey({ ...base }));
  });

  it('T8b 跨小时桶（t 与 t+3600）结果不同', () => {
    const a = buildDedupKey(base);
    const b = buildDedupKey({ ...base, unixTs: base.unixTs + 3600 });
    expect(a).not.toBe(b);
    expect(hourBucket(base.unixTs + 3600) - hourBucket(base.unixTs)).toBe(1);
  });

  it('T8c 格式为五段冒号分隔，第 5 段为 hour_bucket', () => {
    const parts = buildDedupKey(base).split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(base.userId);
    expect(parts[1]).toBe(base.spaceId);
    expect(parts[2]).toBe(base.kp);
    expect(parts[3]).toBe(base.source);
    expect(parts[4]).toBe(String(hourBucket(base.unixTs)));
  });

  it('T8d 不同 source / 不同 kp 不互相去重', () => {
    const withPaper = buildDedupKey({ ...base, source: 'paper' });
    const withOtherKp = buildDedupKey({ ...base, kp: 'math.cz.quadratic.extremum' });
    expect(withPaper).not.toBe(buildDedupKey(base));
    expect(withOtherKp).not.toBe(buildDedupKey(base));
  });

  it('T8e isDuplicateKey 为纯判断（命中即重复，不触碰存储）', () => {
    const key = buildDedupKey(base);
    const seen = new Set<string>([key]);
    expect(isDuplicateKey(seen, key)).toBe(true);
    expect(isDuplicateKey(seen, buildDedupKey({ ...base, unixTs: base.unixTs + 3600 }))).toBe(false);
  });
});

describe('statusBand · ALGORITHM §6 掌握度状态带（验收 C6）', () => {
  it('四区间映射与边界（统一按左闭右开）', () => {
    expect(masteryToBand(0.39)).toBe('待巩固');
    expect(masteryToBand(0.4)).toBe('不稳定');
    expect(masteryToBand(0.59)).toBe('不稳定');
    expect(masteryToBand(0.6)).toBe('基本掌握');
    expect(masteryToBand(0.79)).toBe('基本掌握');
    expect(masteryToBand(0.8)).toBe('已掌握');
    expect(masteryToBand(0.95)).toBe('已掌握');
  });

  it('颜色常量与状态带一一对应', () => {
    expect(masteryToColor(0.3)).toBe('暖橙');
    expect(masteryToColor(0.5)).toBe('黄');
    expect(masteryToColor(0.7)).toBe('浅青绿');
    expect(masteryToColor(0.9)).toBe('青绿');
    expect(Object.keys(BAND_COLORS)).toHaveLength(4);
  });
});
