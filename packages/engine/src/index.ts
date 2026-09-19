/**
 * @zhiwei/engine · barrel 导出
 *
 * 共享算法层（BKT 纯函数引擎）：前端与云函数未来都从这里 import 同一份实现，
 * "引擎无 if(subject) 分支"的架构证明落在目录结构上（计划 2.2 D1）。
 * 本文件不做任何计算，只做公共符号汇总。
 */

export type { Params } from './params';
export { PARAM_KEYS, DEFAULT_PARAMS_PATH, loadParams, priorFor } from './params';

export type { MasteryUpdateResult } from './bkt';
export { clamp, updateMastery, applyWeakNegative } from './bkt';

export type { EvidenceSource, DedupKeyInput } from './dedup';
export { hourBucket, buildDedupKey, isDuplicateKey } from './dedup';

export type {
  GraphNode,
  BankItem,
  SelectionState,
  SelectionMode,
  NextItemInput,
  NextItemResult,
  PruneResult,
} from './selection';
export { nextItem, rankTestableKps } from './selection';

export type { MasteryBand, BandColor } from './statusBand';
export { masteryToBand, BAND_COLORS } from './statusBand';
