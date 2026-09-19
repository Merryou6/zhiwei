/**
 * ModelAdapter 接口（D4）—— 大模型能力的唯一抽象边界
 *
 * 三方法（计划 D4）：
 *   classify(input)       → 错误类型诊断（受约束结构化调用，ALGORITHM §3）
 *   recognizePaper(input) → 试卷识别（契约 §5）
 *   chatTurn(input)       → 对话一轮（契约 §9）
 *
 * 纪律（ALGORITHM §3「后处理（代码侧，不采信模型）」）：
 *   适配器只产出**结构化字段**；CONF_ADOPT 阈值、attribution_direction 硬编码映射、
 *   error_type 五值枚举校验、matched_typical_error ∈ 该 kp typical_errors 校验、
 *   完整 kp id 校验、next_action 状态机 —— 全部在 services 层真实实现，
 *   换真实模型（models/index.ts 的 createModels）不改后处理纪律。
 */

import type { BankDistractor, ErrorType, KnowledgeNode } from '../data/staticData';
import type { ClassifyCandidate, DialogMessage, SuggestedResult } from '../db/types';

export interface ClassifyInput {
  /** 题干（item_id 命中时取题库 stem，否则取请求 stem） */
  stem: string;
  /** 学生作答原文 */
  student_answer: string;
  /** 匹配到的知识点（含 typical_errors，供适配器选 matched code） */
  kp: KnowledgeNode;
  /** 该 kp 的题库候选（含 distractor 与标准答案，用于确定性命中判定） */
  candidates: ClassifyCandidate[];
}

export interface ClassifyOutput {
  /** null 表示未能判定类型（服务层会因 confidence < CONF_ADOPT 退回 clarify） */
  error_type: ErrorType | null;
  matched_typical_error: string | null;
  confidence: number;
  evidence: string | null;
}

export interface RecognizeInput {
  space_id: string;
  file_id: string;
  recognition_id: string;
}

/** 识别结果单项（含 crop_url，落 recognitions 表；响应侧由 service 白名单裁剪）。 */
export interface RecognizeItemOutput {
  seq: number;
  stem_excerpt: string;
  kp_guess: string;
  student_answer: string;
  suggested_result: SuggestedResult;
  crop_url: string;
}

/** 契约 §9 的 next_action 枚举（权威值由服务层状态机计算，见 四、4.3）。 */
export type ChatNextAction = 'continue' | 'hint_down' | 'give_solution' | 'exit_channel';

export interface ChatTurnInput {
  message: string;
  image_file_id: string | null;
  /** 知识图谱（kp 匹配候选集） */
  nodes: KnowledgeNode[];
  /** 对话历史（dialogs.messages，适配器只读结构化字段） */
  history: DialogMessage[];
}

export interface KpMatch {
  kp_id: string;
  confidence: number;
}

export interface ChatTurnOutput {
  reply: string;
  progress: boolean;
  progress_reason: string | null;
  kp_match: KpMatch;
  /**
   * 本字段仅为对齐 D4 的方法签名而保留；本地适配器**恒返回 null**，
   * 权威 next_action 由 services/chat.ts 状态机计算（ALGORITHM §5），
   * 服务层不读取本字段（纪律：代码只读服务端结构化决策，不采信适配器自然语言）。
   */
  next_action: ChatNextAction | null;
  /** 首轮带图时返回 Top-3 候选（契约 §9：meta 只回最优一个） */
  top_candidates: (KpMatch & { name: string })[];
}

export interface ModelAdapter {
  classify(input: ClassifyInput): Promise<ClassifyOutput>;
  recognizePaper(input: RecognizeInput): Promise<RecognizeItemOutput[]>;
  chatTurn(input: ChatTurnInput): Promise<ChatTurnOutput>;
}

/** 适配器可见的 distractor 形态（供实现引用，避免各处重复声明）。 */
export type AdapterDistractor = BankDistractor;
