/**
 * 本地脚本化对话适配器（四、4.3）
 *
 * kp 匹配置信度：
 *   含 kp.name → 0.85；含 chapter 名 → 0.70；含该 kp 某条 typical_errors.desc 的前 6 字符
 *   → 0.65；否则 0.30（< CONF_ADOPT → 服务层先追问澄清，不产生证据）。多命中取最高。
 * progress：命中触发词表 ["不会","不知道","没思路","随便","猜"] → false（仍在猜/无有效一步）；
 *   否则 true。**只读结构化字段，不解析自然语言**（ALGORITHM §5 纪律）。
 *
 * 文案模板（语气遵守 PRD §6「耐心的学长」）：澄清 / 引导 / 方向提示（remedy）/
 *   完整解法（solution_steps 分步输出）/ 退出话术。模板函数由服务层按状态机调用
 *   （next_action 权威值在 services/chat.ts 计算，适配器不裁决）。
 *
 * 【真实模型接入点】替换本文件为真实对话模型调用（结构化输出 reply/progress/
 *   progress_reason/kp_match），返回结构不变；状态机与证据纪律仍在服务层。
 */

import type { BankItemRecord, KnowledgeNode } from '../data/staticData';
import type { ChatTurnInput, ChatTurnOutput } from './types';

export const KP_NAME_CONFIDENCE = 0.85;
export const CHAPTER_CONFIDENCE = 0.7;
export const TYPICAL_ERROR_DESC_CONFIDENCE = 0.65;
export const NO_MATCH_CONFIDENCE = 0.3;
/** 特征关键词取 desc 前 6 字符（四、4.3）。 */
export const DESC_KEYWORD_LENGTH = 6;
/** 无进展触发词表（四、4.3）。 */
export const NEGATIVE_TRIGGERS = ['不会', '不知道', '没思路', '随便', '猜'] as const;
export const PROGRESS_REASON_NO_STEP = '学生仍未能给出有效一步';

/** Top-N 候选（首轮带图时 meta 只回最优一个）。 */
export const TOP_CANDIDATE_COUNT = 3;

export interface KpCandidate {
  kp_id: string;
  name: string;
  confidence: number;
}

/** 消息 → kp 候选（按置信度降序，同分按 kp id 升序）。 */
export function matchKp(message: string, nodes: KnowledgeNode[]): KpCandidate[] {
  const scored: KpCandidate[] = [];

  for (const node of nodes) {
    let confidence = 0;
    if (message.includes(node.name)) confidence = KP_NAME_CONFIDENCE;
    else if (message.includes(node.chapter)) confidence = CHAPTER_CONFIDENCE;
    else if (
      node.typical_errors.some((entry) =>
        message.includes(entry.desc.slice(0, DESC_KEYWORD_LENGTH)),
      )
    ) {
      confidence = TYPICAL_ERROR_DESC_CONFIDENCE;
    }
    if (confidence > 0) scored.push({ kp_id: node.id, name: node.name, confidence });
  }

  scored.sort(
    (a, b) => b.confidence - a.confidence || (a.kp_id < b.kp_id ? -1 : a.kp_id > b.kp_id ? 1 : 0),
  );
  return scored;
}

/** progress 判定：命中触发词 → false（只读结构化字段）。 */
export function hasProgress(message: string): boolean {
  return !NEGATIVE_TRIGGERS.some((trigger) => message.includes(trigger));
}

// ------------------------------------------------------------------ 文案模板

export function clarifyText(): string {
  return '我先确认一下：这道题你卡在哪一步？把题目读一遍、或者拍张照片发我，我看看你手头的条件是什么。';
}

export function guideText(kp: KnowledgeNode | null): string {
  if (!kp) return '我们一步一步来：先把你写出的那一步发我，我看看从哪里开始接。';
  const error = kp.typical_errors[0];
  return `我们先把「${kp.name}」的定义过一遍：${error ? error.desc : '先把基本概念说清楚'}。你先按这个思路试一步，写完发我。`;
}

export function readPaperText(candidate: KpCandidate | null): string {
  if (!candidate) {
    return '我看到了这道题，但一时没认出它考哪个知识点。你先告诉我这是哪个章节的题？';
  }
  return `我看到了这道题，它考的是「${candidate.name}」。我们一起把它拆开看。`;
}

/** 方向性提示（提示阶梯第 2 档）：取该 kp 的典型错误补救话术。 */
export function hintText(kp: KnowledgeNode | null): string {
  if (!kp) return '给你一个方向：先把题目里给的条件一条条列出来，看看哪一条还没用上。';
  const error = kp.typical_errors[0];
  return `给你一个方向：${error ? error.remedy : `重点看「${kp.name}」的定义边界。`} 再试一步？`;
}

/** 完整解法（提示阶梯第 3 档）：train 池首题的分步解答。 */
export function solutionText(
  kp: KnowledgeNode | null,
  items: readonly BankItemRecord[],
  usedItemIds: readonly string[] = [],
): string {
  if (!kp) return '我把完整解法给你：先把条件写成式子，再按定义一步步算。';
  const used = new Set(usedItemIds);
  const item =
    items.find((entry) => entry.knowledge_point === kp.id && entry.pool === 'train' && !used.has(entry.item_id)) ??
    items.find((entry) => entry.knowledge_point === kp.id && entry.pool === 'train');

  if (!item) return `「${kp.name}」这道题我把完整解法给你：先按定义列式，再逐步化简。`;
  const steps = item.solution_steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  return `「${kp.name}」这道题的完整解法：\n${steps}`;
}

/** 退出话术（ALGORITHM §5 / PRD §6）：不让学生以为是自己笨。 */
export function exitText(upstream: KnowledgeNode | null): string {
  if (!upstream) {
    return '我们先往回退一步，把最基础的那部分重新捡起来。这很正常——不是你不行，是这块砖还没铺好。';
  }
  return `我们先往回看一眼「${upstream.name}」，那里可能是关键。不是你笨，是这块砖还没铺稳。`;
}

/** 连续跳转超上限时的兜底话术（只提示，不跳转）。 */
export function exitLimitText(kp: KnowledgeNode | null): string {
  return `我们先停一下，把「${kp ? kp.name : '当前这一步'}」再啃一遍，不要急着往前赶。`;
}

// ------------------------------------------------------------------ 主入口

export async function chatTurn(input: ChatTurnInput): Promise<ChatTurnOutput> {
  const candidates = matchKp(input.message, input.nodes);
  const top = candidates.slice(0, TOP_CANDIDATE_COUNT);
  const best = top[0] ?? null;

  const kpMatch = best
    ? { kp_id: best.kp_id, confidence: best.confidence }
    : { kp_id: '', confidence: NO_MATCH_CONFIDENCE };

  const progress = hasProgress(input.message);
  const matchedNode = best ? (input.nodes.find((node) => node.id === best.kp_id) ?? null) : null;

  // 首轮带图：先「读题」（meta.kp_match 返回最优候选）
  const reply =
    input.image_file_id && input.history.every((entry) => entry.role !== 'agent')
      ? readPaperText(best)
      : best
        ? guideText(matchedNode)
        : clarifyText();

  return {
    reply,
    progress,
    progress_reason: progress ? null : PROGRESS_REASON_NO_STEP,
    kp_match: kpMatch,
    // 权威 next_action 由服务层状态机计算（ALGORITHM §5），适配器不裁决
    next_action: null,
    top_candidates: top,
  };
}
