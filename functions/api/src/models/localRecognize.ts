/**
 * 本地确定性试卷识别适配器（D14）
 *
 * 规则：以 file_id 字符串哈希为随机种子，从题库**确定性**抽 3 题（只从带
 *       distractors 的题中抽，保证「模拟学生答错」有真实错误路径值）；
 *       stem_excerpt = 题干前 24 字符 + "…"；kp_guess = 题的 knowledge_point；
 *       student_answer = 该题 distractors[0].answer；suggested_result = "wrong"；
 *       seq % 3 === 0 的项改为 student_answer = ""、suggested_result = "unclear"
 *       （专供「unclear 必须手标」测试与演示）；
 *       crop_url 按 DATA_SCHEMA §5 路径约定拼 "local://paper/{space_id}/{recognition_id}/{seq}.jpg"。
 *
 * 为什么确定性：测试可复现（同 file_id 两次调用结果一致），且不需要真实 OCR。
 * 【真实模型接入点】替换本文件为调用多模态模型（图片 URL → OCR + 题目切分 +
 * 知识点猜测），返回结构不变即可，服务层零改动。
 */

import { loadStaticData } from '../data/staticData';
import type { BankItemRecord } from '../data/staticData';
import type { RecognizeInput, RecognizeItemOutput } from './types';

/** 抽取题数（契约 §5 样例 3 项；演示与测试口径）。 */
export const RECOGNIZED_ITEM_COUNT = 3;
/** stem_excerpt 截断长度（D14）。 */
export const STEM_EXCERPT_LENGTH = 24;

/** FNV-1a 32 位哈希（种子来源，确定性）。 */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32：小而稳定的确定性伪随机数发生器。 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function excerpt(stem: string): string {
  return stem.length <= STEM_EXCERPT_LENGTH
    ? `${stem}…`
    : `${stem.slice(0, STEM_EXCERPT_LENGTH)}…`;
}

/** 确定性抽题：同 file_id 恒得同 3 题（含至少 1 个有 distractor 的题）。 */
export function pickRecognizedItems(fileId: string, count = RECOGNIZED_ITEM_COUNT): BankItemRecord[] {
  const candidates = loadStaticData().items.filter(
    (item) => (item.distractors ?? []).length > 0,
  );
  const random = mulberry32(fnv1a(fileId));
  const picked: BankItemRecord[] = [];
  const usedIndexes = new Set<number>();

  while (picked.length < count && usedIndexes.size < candidates.length) {
    const index = Math.floor(random() * candidates.length);
    if (usedIndexes.has(index)) continue;
    usedIndexes.add(index);
    picked.push(candidates[index]);
  }
  return picked;
}

/** D14 主入口：确定性识别 3 题。 */
export async function recognizePaper(input: RecognizeInput): Promise<RecognizeItemOutput[]> {
  const picked = pickRecognizedItems(input.file_id);

  return picked.map((item, offset) => {
    const seq = offset + 1;
    const unclear = seq % 3 === 0;
    return {
      seq,
      stem_excerpt: excerpt(item.stem),
      kp_guess: item.knowledge_point,
      student_answer: unclear ? '' : (item.distractors[0]?.answer ?? ''),
      suggested_result: unclear ? 'unclear' : 'wrong',
      crop_url: `local://paper/${input.space_id}/${input.recognition_id}/${seq}.jpg`,
    };
  });
}
