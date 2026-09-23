/**
 * 作答判定（D10，全接口共用：diagnose/submit、attribution/verify、paper/confirm、classify）
 *
 * normalize(s) = 去首尾空白 → NFKC（全角 ASCII 含全角括号/加减/逗号/冒号/空格 → 半角；
 *               上标 ² 归一为 2）→ 英文小写 → 中文顿号/分号统一为英文逗号、
 *               CJK 句号/冒号/引号/减号归一 → 去全部空白。
 *
 * 判定顺序（确定性、可复现；PRD 未要求语义判分）：
 *   ① normalize(作答) 与某条 distractor.answer 判等 → wrong，返回该条的 typical_error_code
 *      （优先于标准答案比较，使「答错 → 典型错误码」链路在服务端真实可用）
 *   ② 与标准 answer 判等 → correct
 *   ③ 其余 → wrong，无错误码
 *   ④ 空作答（normalize 后为空串）→ wrong，无错误码
 *
 * 说明：distractor 若与标准答案归一化后同值，则跳过该条（避免把正确答案判成错误答案）；
 * 数据侧已由 scripts/validate_data.py 校验 raw 字符串不同值。
 */

import type { BankItemRecord } from './data/staticData';

export interface GradeResult {
  correct: boolean;
  /** 命中的典型错误码（未命中为 null），可直接供 classify 复用。 */
  matched_error_code: string | null;
}

export interface GradingDistractor {
  answer: string;
  typical_error_code: string;
}

export function normalizeAnswer(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[，、；]/g, ',')
    .replace(/：/g, ':')
    .replace(/。/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, '');
}

/** 通用判等：学生作答 vs 标准答案 + 干扰项清单。 */
export function gradeAnswer(
  studentAnswer: unknown,
  standardAnswer: string,
  distractors: readonly GradingDistractor[] = [],
): GradeResult {
  const student = normalizeAnswer(studentAnswer);
  if (student.length === 0) return { correct: false, matched_error_code: null };

  const standard = normalizeAnswer(standardAnswer);

  for (const distractor of distractors) {
    const value = normalizeAnswer(distractor.answer);
    if (value.length === 0 || value === standard) continue;
    if (value === student) return { correct: false, matched_error_code: distractor.typical_error_code };
  }

  if (standard === student) return { correct: true, matched_error_code: null };
  return { correct: false, matched_error_code: null };
}

/** 题库题判定（choice 题按选项文本判等，同一规则）。 */
export function gradeItem(item: BankItemRecord, studentAnswer: unknown): GradeResult {
  return gradeAnswer(studentAnswer, item.answer, item.distractors ?? []);
}
