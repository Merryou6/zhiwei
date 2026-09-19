/**
 * 运行时九张表的记录类型 + Store 接口（D3）
 *
 * 表清单与字段严格对齐 DATA_SCHEMA §4（九张表）；`item_bank` 为静态种子，
 * 运行时只读，不进 Store（本地直接读 data/item_bank 静态文件）。
 *
 * 隔离键：除 users / item_bank / recognitions 外全部带 space_id（契约 §0）；
 * item_bank 无归属、recognitions 在本地实现里额外带 space_id 供归属校验。
 */

import type { BankItemRecord, ErrorType } from '../data/staticData';

export type EvidenceSource = 'silent' | 'paper' | 'diagnose' | 'self_report';
export type EvidenceMode = 'diagnose' | 'baseline' | 'retest';
export type EvidenceResult = 'correct' | 'wrong';
export type ProfileStatus = 'active' | 'blocked_by_prerequisite';
export type RecognitionStatus = 'pending_confirm' | 'confirmed' | 'failed';
export type DialogStatus = 'open' | 'exited' | 'closed';
export type SuggestedResult = 'correct' | 'wrong' | 'unclear';

/** §4.1 users */
export interface UserRecord {
  user_id: string;
  identifier: string;
  /** 形态 "salt:hash"（十六进制）；字段名沿用 DATA_SCHEMA（算法为 scrypt，见 D5）。 */
  password_hash: string;
  nickname: string | null;
  created_at: string;
}

/** §4.2 spaces */
export interface SpaceRecord {
  space_id: string;
  user_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

/** §4.3 mastery_profiles（系统承重墙） */
export interface MasteryProfileRecord {
  user_id: string;
  space_id: string;
  knowledge_point: string;
  mastery: number;
  evidence_count: number;
  p_l0: number;
  status: ProfileStatus;
  last_updated: string;
  last_evidence_type: EvidenceSource | null;
}

/** §4.4 evidence_events（四路统一 schema，系统承重墙） */
export interface EvidenceEventRecord {
  event_id: string;
  user_id: string;
  space_id: string;
  knowledge_point: string;
  item_id: string | null;
  source: EvidenceSource;
  /** 仅 source=diagnose 时非空（报告页 ΔAccuracy 分组依据）。 */
  mode: EvidenceMode | null;
  result: EvidenceResult;
  weight: number;
  /** 弱负证据衰减系数（silent 路径），其余为 null。 */
  alpha: number | null;
  raw: Record<string, unknown>;
  /** 五段：{user_id}:{space_id}:{kp}:{source}:{hour_bucket}（ALGORITHM §1，完整 kp id）。 */
  dedup_key: string;
  /** 试卷图片保留期限（合规项）；非 paper 事件为 null。 */
  expire_at: string | null;
  created_at: string;
}

/** §4.5 mastery_logs（可复现性） */
export interface MasteryLogRecord {
  log_id: string;
  user_id: string;
  space_id: string;
  knowledge_point: string;
  before: number;
  p_obs: number;
  p_eff: number;
  after: number;
  weight: number;
  triggered_by: string;
  created_at: string;
}

/** §4.6 attributions */
export interface AttributionRecord {
  attribution_id: string;
  user_id: string;
  space_id: string;
  from_kp: string;
  root_cause: string;
  error_type: ErrorType;
  /** 完整 kp id，终点=根因。 */
  path: string[];
  /** 完整 kp id 为键；按嫌疑分降序写入（对象键序即候选序）。 */
  suspect_scores: Record<string, number>;
  verified: boolean;
  verified_by: string | null;
  rejected_by_student: boolean;
  created_at: string;
  /**
   * 候选推进状态（本地实现内部字段，契约响应不含此字段）：剩余待验证候选，
   * 按嫌疑分降序；verify 答对/答错与 agent/reject 均从队首推进。
   * 依据：验证题降序排除（ALGORITHM §4）需要跨请求持久化的候选游标，
   * DATA_SCHEMA §4.6 未定义该字段，故以内部字段承载并在执行报告留痕。
   */
  pending_candidates: string[];
}

export interface DialogMessage {
  role: 'student' | 'agent';
  content: string;
  image_file_id?: string | null;
  progress?: boolean;
  progress_reason?: string | null;
  next_action?: string | null;
  ts: string;
}

/** §4.7 dialogs */
export interface DialogRecord {
  dialog_id: string;
  user_id: string;
  space_id: string;
  kp_id: string | null;
  messages: DialogMessage[];
  consecutive_false: number;
  exit_count: number;
  status: DialogStatus;
  created_at: string;
}

export interface RecognitionItemRecord {
  seq: number;
  stem_excerpt: string;
  kp_guess: string;
  student_answer: string;
  suggested_result: SuggestedResult;
  crop_url: string;
}

/** §4.9 recognitions */
export interface RecognitionRecord {
  recognition_id: string;
  user_id: string;
  space_id: string;
  file_id: string;
  status: RecognitionStatus;
  items: RecognitionItemRecord[];
  created_at: string;
  expire_at: string;
}

/** classify 的题库候选上下文（services/classify 组装，供 localClassify 判定命中）。 */
export type ClassifyCandidate = Pick<BankItemRecord, 'item_id' | 'answer' | 'distractors'>;

/** 九张表读写语义的 Store 接口（D3）。本地 JSON 与 CloudBase 两套实现。 */
export interface Store {
  init(): Promise<void>;

  // users
  findUserByIdentifier(identifier: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  insertUser(user: UserRecord): Promise<void>;

  // spaces
  getSpace(spaceId: string): Promise<SpaceRecord | null>;
  listSpacesByUser(userId: string): Promise<SpaceRecord[]>;
  findSpaceByUserAndKnowledgeSource(userId: string, kbId: string): Promise<SpaceRecord | null>;
  insertSpace(space: SpaceRecord): Promise<void>;

  // mastery_profiles
  getProfile(userId: string, spaceId: string, knowledgePoint: string): Promise<MasteryProfileRecord | null>;
  listProfiles(userId: string, spaceId: string): Promise<MasteryProfileRecord[]>;
  upsertProfile(profile: MasteryProfileRecord): Promise<void>;

  // evidence_events
  findEventsByDedupKey(spaceId: string, dedupKey: string): Promise<EvidenceEventRecord[]>;
  listEventsBySpace(spaceId: string): Promise<EvidenceEventRecord[]>;
  insertEvent(event: EvidenceEventRecord): Promise<void>;

  // mastery_logs
  insertLog(log: MasteryLogRecord): Promise<void>;
  listLogsBySpace(spaceId: string): Promise<MasteryLogRecord[]>;

  // attributions
  getAttribution(attributionId: string): Promise<AttributionRecord | null>;
  listAttributionsBySpace(spaceId: string): Promise<AttributionRecord[]>;
  insertAttribution(attribution: AttributionRecord): Promise<void>;
  updateAttribution(attribution: AttributionRecord): Promise<void>;

  // dialogs
  getDialog(dialogId: string): Promise<DialogRecord | null>;
  upsertDialog(dialog: DialogRecord): Promise<void>;

  // recognitions
  getRecognition(recognitionId: string): Promise<RecognitionRecord | null>;
  insertRecognition(recognition: RecognitionRecord): Promise<void>;
  updateRecognition(recognition: RecognitionRecord): Promise<void>;
}
