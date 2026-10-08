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

/**
 * 选项化（2026-10-08 追加）：填空题「难输入 → 选择题」改造的服务端侧。
 *
 * 背景：题干答案多为公式/根与系数关系式，开放文本输入对学生（尤其手机端）门槛过高。
 * 题库自带 distractors（典型错误干扰项，附 typical_error_code），本函数在**服务端**
 * 把 [标准答案 + 最多 3 条干扰项答案] 组装成 options 下发——
 *   - 红线不破：answer / solution_steps / distractors 对象仍绝不下发（FORBIDDEN_KEYS
 *     断言扫描的是 JSON 键名，options 数组里是字符串值，不触发）；
 *   - 判分不变：学生提交选项**文本**，gradeItem 仍按归一化判等（顺序无关）；
 *   - 选错干扰项 → 命中 typical_error_code 的既有链路原样生效。
 *
 * 规则：
 *   - 仅 type='fill' 且 distractors ≥ 2 条的题参与（1 条干扰项 → 2 选 1 猜中率 50%，不化）；
 *   - choice 题 options 原样、short_answer 恒文本作答；
 *   - 洗牌用 item_id 做种（Fisher-Yates + LCG）：同一题每次下发顺序一致，
 *     刷新/换题回来不误导（确定可复现，与引擎「确定性」纪律一致）。
 */
export function composeChoiceOptions(item: BankItemRecord): string[] | null {
  if (item.type !== 'fill') return null;
  const raw = item.options;
  if (raw && raw.length > 0) return raw;
  const distractorAnswers = (item.distractors ?? [])
    .map((d) => d.answer)
    .filter((v) => typeof v === 'string' && v.trim().length > 0);
  if (distractorAnswers.length < 2) return null;

  let seed = 0;
  for (let i = 0; i < item.item_id.length; i++) {
    seed = (seed * 31 + item.item_id.charCodeAt(i)) >>> 0;
  }
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const options = [item.answer, ...distractorAnswers.slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

/** 契约 §4 / §7 的题对象形态（选项化后）。 */
export function toClientItem(item: BankItemRecord): ClientItem {
  return {
    item_id: item.item_id,
    stem: item.stem,
    options: item.options && item.options.length > 0 ? item.options : composeChoiceOptions(item),
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
