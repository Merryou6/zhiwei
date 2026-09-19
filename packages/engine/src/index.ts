/**
 * @zhiwei/engine barrel 导出
 *
 * 知微共享算法层（纯函数、零运行时依赖、零 IO）：
 *   params      —— 参数加载与类型（config/params.json 为唯一来源）
 *   bkt         —— 加权三段式掌握度更新 + 弱负证据
 *   dedup       —— evidence_events 幂等去重键
 *   selection   —— 拓扑剪枝 + 信息增益 + 池推导 + 收敛判定的自适应选题
 *   statusBand  —— 掌握度状态带与颜色映射
 */
export type { Params, ParamKey } from './params';
export { PARAM_KEYS, DEFAULT_PARAMS_PATH, loadParams, priorFor } from './params';

export type { MasteryUpdateResult } from './bkt';
export { clamp, updateMastery, applyWeakNegative } from './bkt';

export type { EvidenceSource, DedupKeyInput } from './dedup';
export {
  SECONDS_PER_HOUR,
  hourBucket,
  buildDedupKey,
  isDuplicateKey,
  isDuplicateEvidence,
} from './dedup';

export type {
  GraphNode,
  BankItem,
  SelectionState,
  SelectionMode,
  SelectionInput,
  SelectionResult,
} from './selection';
export { poolForMode, nextItem } from './selection';

export type { MasteryBand, MasteryColor } from './statusBand';
export {
  BAND_THRESHOLD_UNSTABLE,
  BAND_THRESHOLD_MASTERY,
  BAND_THRESHOLD_MASTERED,
  BAND_COLORS,
  masteryToBand,
  masteryToColor,
} from './statusBand';
