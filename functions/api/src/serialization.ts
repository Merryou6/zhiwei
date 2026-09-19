/**
 * 序列化白名单（E5 硬纪律：answer / solution_steps 绝不下发前端）
 *
 * 所有返回题库题对象的接口（diagnose/next、diagnose/submit next_item、
 * attribution/analyze 与 verify 的 verification_item、agent/reject、
 * plan/generate 的 item_sequence）**必须**经本模块构造响应，
 * 禁止直接 res.json(item) 或展开原始题目对象。
 *
 * 白名单字段与契约逐字一致：
 *   §4/§7 verification_item → { item_id, stem, options }
 *   §8 item_sequence        → { item_id, stem, options, difficulty }
 */

import type { BankItemRecord } from './data/staticData';

export interface ClientItem {
  item_id: string;
  stem: string;
  options: string[] | null;
}

export interface ClientItemWithDifficulty extends ClientItem {
  difficulty: number;
}

/** 契约 §4 / §7 的题对象形态。 */
export function toClientItem(item: BankItemRecord): ClientItem {
  return {
    item_id: item.item_id,
    stem: item.stem,
    options: item.options ?? null,
  };
}

/** 契约 §8 的题对象形态（额外带 difficulty）。 */
export function toClientItemWithDifficulty(item: BankItemRecord): ClientItemWithDifficulty {
  return {
    ...toClientItem(item),
    difficulty: item.difficulty,
  };
}

/** 序列化校验：确保对象不含任何禁发字段（closedLoop 全局断言复用）。 */
export const FORBIDDEN_CLIENT_KEYS = ['answer', 'solution_steps', 'distractors'] as const;

export function assertNoForbiddenKeys(value: unknown, where: string): void {
  const serialized = JSON.stringify(value ?? null);
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`${where} 响应中出现禁发字段 ${key}`);
    }
  }
}
