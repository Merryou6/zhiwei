/**
 * 引擎基础模块单测：加权 BKT（ALGORITHM §1 硬门槛）+ 去重 key + 状态带 + 参数加载
 *
 * 计划 步骤 8 用例清单：
 *   T1 P_L=0.5 答对 w=1.0 → 0.845   T2 同场景 w=0.8 → 0.791   T3 答错 w=1.0 → 0.244
 *   T4 w=0 → 三值相等；T5 输入越界 clamp；T6 弱负证据 0.5 → 0.45
 *   T7 中间量对照（p_obs / p_eff）；T8 dedup_key 确定性与小时桶
 * 另附 八、C6 掌握度状态带四区间映射与颜色（无新增文件，见执行报告偏差说明）。
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
  PARAM_KEYS,
  updateMastery,
} from '../src/index';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/** 真实参数（唯一来源 config/params.json，测试不内联任何参数值） */
const P = loadParams(resolve(REPO_ROOT, 'config/params.json'));

describe('params · 参数外置完整性（六、6.2 同源）', () => {
  it('config/params.json 含 ALGORITHM §0 全部 17 键', () => {
    expect(PARAM_KEYS).toHaveLength(17);
    expect(Object.keys(P)).toHaveLength(17);
  });

  it('PRIOR_MAP 为字符串键 1–5；CLAMP 为合法区间', () => {
    expect(Object.keys(P.PRIOR_MAP).sort()).toEqual(['1', '2', '3', '4', '5']);
    expect(P.CLAMP[0]).toBeLessThan(P.CLAMP[1]);
  });
});

describe('bkt · ALGORITHM §1 三个自检用例（硬门槛，±0.001）', () => {
  it('T1 P_L=0.5 答对 w=1.0 → after ≈ 0.845', () => {
    const r = updateMastery(0.5, true, P.W_DIAGNOSE, P);
    expect(r.after).toBeCloseTo(0.845, 3);
  });

  it('T2 P_L=0.5 答对 w=0.8 → after ≈ 0.791', () => {
    const r = updateMastery(0.5, true, P.W_PAPER, P);
    expect(r.after).toBeCloseTo(0.791, 3);
  });

  it('T3 P_L=0.5 答错 w=1.0 → after ≈ 0.244', () => {
    const r = updateMastery(0.5, false, P.W_DIAGNOSE, P);
    expect(r.after).toBeCloseTo(0.244, 3);
  });

  it('T4 w=0 → 早退分支：before / p_obs / p_eff / after 四值相等', () => {
    const r = updateMastery(0.5, true, 0, P);
    expect(r.p_obs).toBe(r.before);
    expect(r.p_eff).toBe(r.before);
    expect(r.after).toBe(r.before);
    expect(r.before).toBeCloseTo(0.5, 10);
  });

  it('T5 输入越界先 clamp：pL=0 → 0.01，pL=1.5 → 0.99，结果均在 CLAMP 内', () => {
    const low = updateMastery(0, true, P.W_DIAGNOSE, P);
    const high = updateMastery(1.5, false, P.W_DIAGNOSE, P);
    expect(low.before).toBeCloseTo(P.CLAMP[0], 10);
    expect(high.before).toBeCloseTo(P.CLAMP[1], 10);
    for (const v of [low.after, high.after, low.p_obs, high.p_eff]) {
      expect(v).toBeGreaterThanOrEqual(P.CLAMP[0]);
      expect(v).toBeLessThanOrEqual(P.CLAMP[1]);
    }
  });

  it('T6 弱负证据：0.5 → 0.45（P × (1 − ALPHA_SILENT)）', () => {
    expect(applyWeakNegative(0.5, P)).toBeCloseTo(0.5 * (1 - P.ALPHA_SILENT), 10);
    expect(applyWeakNegative(0.5, P)).toBeCloseTo(0.45, 10);
  });

  it('T7 中间量对照：T1 场景 p_obs≈0.818、p_eff≈0.818；T2 场景 p_eff≈0.754', () => {
    const t1 = updateMastery(0.5, true, P.W_DIAGNOSE, P);
    expect(t1.p_obs).toBeCloseTo(0.818, 3);
    expect(t1.p_eff).toBeCloseTo(0.818, 3);
    const t2 = updateMastery(0.5, true, P.W_PAPER, P);
    // 规格写作 ≈0.754，精确值为 0.7545454…（0.8×0.818182 + 0.2×0.5），
    // 即 0.7545（四位小数）；按 0.754 断言会超出 toBeCloseTo(…, 3) 的 0.0005 容差，
    // 属规格文本取整差异而非公式误差，故与精确值 0.7545 比较。
    expect(t2.p_eff).toBeCloseTo(0.7545, 3);
  });

  it('三段式顺序校验：先验→后验→插值→迁移，中间量关系可复算', () => {
    const r = updateMastery(0.5, true, P.W_PAPER, P);
    const pObs = (0.5 * (1 - P.P_S)) / (0.5 * (1 - P.P_S) + 0.5 * P.P_G);
    const pEff = P.W_PAPER * pObs + (1 - P.W_PAPER) * 0.5;
    const pNew = pEff + (1 - pEff) * P.P_T;
    expect(r.p_obs).toBeCloseTo(pObs, 12);
    expect(r.p_eff).toBeCloseTo(pEff, 12);
    expect(r.after).toBeCloseTo(pNew, 12);
  });

  it('clamp：区间内外取值', () => {
    expect(clamp(0.001, P.CLAMP)).toBe(P.CLAMP[0]);
    expect(clamp(1, P.CLAMP)).toBe(P.CLAMP[1]);
    expect(clamp(0.5, P.CLAMP)).toBe(0.5);
  });
});

describe('dedup · ALGORITHM §1 去重（幂等算法侧）', () => {
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
    const a = buildDedupKey({ ...base, unixTs: 1_700_000_000 });
    const b = buildDedupKey({ ...base, unixTs: 1_700_000_000 + 3600 });
    expect(a).not.toBe(b);
    expect(hourBucket(1_700_000_000 + 3600) - hourBucket(1_700_000_000)).toBe(1);
  });

  it('T8c 格式为五段冒号分隔，且第 5 段是 hour_bucket', () => {
    const key = buildDedupKey(base);
    const parts = key.split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(base.userId);
    expect(parts[1]).toBe(base.spaceId);
    expect(parts[2]).toBe(base.kp);
    expect(parts[3]).toBe(base.source);
    expect(parts[4]).toBe(String(hourBucket(base.unixTs)));
  });

  it('T8d isDuplicateKey 纯判断（命中即重复，不触碰存储）', () => {
    const key = buildDedupKey(base);
    const seen = new Set<string>([key]);
    expect(isDuplicateKey(seen, key)).toBe(true);
    expect(isDuplicateKey(seen, buildDedupKey({ ...base, unixTs: base.unixTs + 3600 }))).toBe(false);
  });
});

describe('statusBand · ALGORITHM §6 掌握度状态带', () => {
  it('C6 四区间映射（端点归属：0.4/0.6/0.8 归上段）', () => {
    expect(masteryToBand(0)).toBe('待巩固');
    expect(masteryToBand(0.39)).toBe('待巩固');
    expect(masteryToBand(0.4)).toBe('不稳定');
    expect(masteryToBand(0.59)).toBe('不稳定');
    expect(masteryToBand(0.6)).toBe('基本掌握');
    expect(masteryToBand(0.79)).toBe('基本掌握');
    expect(masteryToBand(0.8)).toBe('已掌握');
    expect(masteryToBand(0.99)).toBe('已掌握');
  });

  it('C6 颜色语义与 PRD §6 一致', () => {
    expect(BAND_COLORS).toEqual({
      待巩固: '暖橙',
      不稳定: '黄',
      基本掌握: '浅青绿',
      已掌握: '青绿',
    });
  });
});
