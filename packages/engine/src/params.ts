/**
 * 参数加载与类型定义（ALGORITHM §0）
 *
 * 引擎唯一参数来源：config/params.json（相对仓库根，路径解析用 process.cwd()）。
 * 源码中禁止出现任何算法参数的字面值——全部经 loadParams 注入。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Params {
  P_S: number;
  P_G: number;
  P_T: number;
  W_DIAGNOSE: number;
  W_PAPER: number;
  ALPHA_SILENT: number;
  PRIOR_MAP: Record<string, number>;
  PRUNE_THRESHOLD: number;
  EXIT_UPSTREAM_THRESHOLD: number;
  SUSPECT_BASE: number;
  MAX_DEPTH: number;
  MAX_EXIT_HOPS: number;
  CONF_ADOPT: number;
  CONSEC_FALSE_EXIT: number;
  MAX_ITEMS: number;
  CONV_VAR: number;
  CLAMP: [number, number];
}

/** ALGORITHM §0 参数总表（17 项）的键名清单，用于加载后的完整性断言。 */
export const PARAM_KEYS = [
  'P_S',
  'P_G',
  'P_T',
  'W_DIAGNOSE',
  'W_PAPER',
  'ALPHA_SILENT',
  'PRIOR_MAP',
  'PRUNE_THRESHOLD',
  'EXIT_UPSTREAM_THRESHOLD',
  'SUSPECT_BASE',
  'MAX_DEPTH',
  'MAX_EXIT_HOPS',
  'CONF_ADOPT',
  'CONSEC_FALSE_EXIT',
  'MAX_ITEMS',
  'CONV_VAR',
  'CLAMP',
] as const;

export type ParamKey = (typeof PARAM_KEYS)[number];

/** 默认参数文件路径（相对仓库根）。 */
export const DEFAULT_PARAMS_PATH = 'config/params.json';

/**
 * 加载参数并做键完整性断言。
 * @param path 相对 process.cwd() 的路径，默认 config/params.json
 */
export function loadParams(path: string = DEFAULT_PARAMS_PATH): Params {
  const fullPath = resolve(process.cwd(), path);
  const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as Partial<Params>;
  const missing = PARAM_KEYS.filter((key) => raw[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`params.json 缺少 ALGORITHM §0 参数：${missing.join(', ')}`);
  }
  return raw as Params;
}

/** 自报掌握度 → P(L0)（ALGORITHM §0 PRIOR_MAP，键为字符串 '1'–'5'）。 */
export function priorFor(selfReport: number, params: Params): number {
  const key = String(selfReport);
  const value = params.PRIOR_MAP[key];
  if (value === undefined) {
    throw new Error(`PRIOR_MAP 中不存在自报档位：${key}`);
  }
  return value;
}
