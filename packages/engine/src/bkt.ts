/**
 * 加权 BKT 更新（ALGORITHM §1 逐行转译）
 *
 * 实现顺序：clamp 输入 → w===0 早退 → 贝叶斯后验（对/错两分支）
 *          → 证据权重插值 → 学习迁移 → clamp 输出。
 * 中间量不做任何四舍五入，仅最终结果 clamp；全程纯函数、不调用大模型、不落库。
 */
import type { Params } from './params';

export interface MasteryUpdateResult {
  /** clamp 后的输入掌握度 */
  before: number;
  /** 贝叶斯后验 P_obs */
  p_obs: number;
  /** 证据权重插值后 P_eff */
  p_eff: number;
  /** 学习迁移并 clamp 后的新掌握度 */
  after: number;
  /** 本次证据权重 */
  weight: number;
  /**
   * 留痕字段：触发本次更新的 evidence_event id（验收 C3「mastery_logs 全留痕」）。
   * 调用方传什么就返回什么；未传时为 null。本迭代不实现落库（见计划 一、1.2 排除项）。
   */
  triggered_by: string | null;
}

/** P(L) 取值夹取（CLAMP = [下界, 上界]）。 */
export function clamp(p: number, params: Params): number {
  const [lo, hi] = params.CLAMP;
  if (p < lo) return lo;
  if (p > hi) return hi;
  return p;
}

/**
 * 三段式加权 BKT 更新。
 *
 * @param pL 当前掌握度 P(L)
 * @param isCorrect 本题是否答对
 * @param w 证据权重（W_DIAGNOSE / W_PAPER 等由调用方传入）
 * @param triggeredBy 可选：触发本次更新的 evidence_event id，仅供 mastery_logs 留痕，不参与计算
 */
export function updateMastery(
  pL: number,
  isCorrect: boolean,
  w: number,
  params: Params,
  triggeredBy: string | null = null,
): MasteryUpdateResult {
  const before = clamp(pL, params);

  // 完全不采纳：直接返回，三个中间量相等（规格早退分支）
  if (w === 0) {
    return { before, p_obs: before, p_eff: before, after: before, weight: w, triggered_by: triggeredBy };
  }

  const { P_S, P_G, P_T } = params;
  const pCorrect = before * (1 - P_S);
  const pWrong = (1 - before) * P_G;
  const pWrongCase = before * P_S;
  const pWrongThenRight = (1 - before) * (1 - P_G);

  // ① 标准贝叶斯后验
  const p_obs = isCorrect
    ? pCorrect / (pCorrect + pWrong)
    : pWrongCase / (pWrongCase + pWrongThenRight);

  // ② 证据权重插值
  const p_eff = w * p_obs + (1 - w) * before;

  // ③ 学习迁移
  const p_new = p_eff + (1 - p_eff) * P_T;

  return { before, p_obs, p_eff, after: clamp(p_new, params), weight: w, triggered_by: triggeredBy };
}

/**
 * 弱负证据（静默 / 对话传图求助）：不走 BKT，P_new = P_L × (1 − ALPHA_SILENT)。
 * 输入先行 clamp 以保持一致；结果按规格公式直接返回（不做二次 clamp）。
 */
export function applyWeakNegative(pL: number, params: Params): number {
  const before = clamp(pL, params);
  return before * (1 - params.ALPHA_SILENT);
}
