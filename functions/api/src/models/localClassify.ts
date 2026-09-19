/**
 * 本地确定性错误诊断适配器（四、4.1）
 *
 * 规则 1：normalize(student_answer) 命中该 kp 任一题的 distractors[].answer →
 *         { confidence: 0.90, error_type: 该 code 对应 typical_errors[].error_type,
 *           matched_typical_error: code, evidence: distractor.explanation }
 * 规则 2：命中标准答案（作答正确）→ **服务层**直接走 clarify
 *         （classify 语义是「错误分类」，正确作答无错误可诊断；真实模型场景同样
 *          退化为低置信，clarify 是诚实行为）——本适配器不返回 adopted。
 * 规则 3：未命中任何已知错误路径 → { confidence: 0.45, error_type: null,
 *         matched_typical_error: null, evidence: null } → 服务层 CONF_ADOPT 拦截 → clarify。
 *
 * 【真实模型接入点】替换本文件为受约束的结构化模型调用（ALGORITHM §3 三条硬规则
 * 写入 Prompt），返回结构不变；后处理纪律（置信阈值 / direction 映射 / 枚举与码校验）
 * 仍在服务层，不采信模型输出。
 */

import { normalizeAnswer } from '../grading';
import type { ClassifyInput, ClassifyOutput } from './types';

/** 规则 1 的确定性置信度（命中真实错误路径）。 */
export const HIT_CONFIDENCE = 0.9;
/** 规则 3 的确定性置信度（低于 CONF_ADOPT，必然被拦截为 clarify）。 */
export const MISS_CONFIDENCE = 0.45;

export async function classify(input: ClassifyInput): Promise<ClassifyOutput> {
  const student = normalizeAnswer(input.student_answer);

  if (student.length > 0) {
    for (const item of input.candidates) {
      const standard = normalizeAnswer(item.answer);
      for (const distractor of item.distractors ?? []) {
        const value = normalizeAnswer(distractor.answer);
        if (value.length === 0 || value === standard || value !== student) continue;

        const typicalError = input.kp.typical_errors.find(
          (entry) => entry.code === distractor.typical_error_code,
        );
        if (!typicalError) continue;

        return {
          error_type: typicalError.error_type,
          matched_typical_error: typicalError.code,
          confidence: HIT_CONFIDENCE,
          evidence: distractor.explanation,
        };
      }
    }
  }

  return {
    error_type: null,
    matched_typical_error: null,
    confidence: MISS_CONFIDENCE,
    evidence: null,
  };
}
