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

/** v1.6 双端：用户角色（缺省 student；旧记录无此字段时按 student 兜底）。 */
export type UserRole = 'student' | 'teacher';

/** §4.1 users */
export interface UserRecord {
  user_id: string;
  identifier: string;
  /** 形态 "salt:hash"（十六进制）；字段名沿用 DATA_SCHEMA（算法为 scrypt，见 D5）。 */
  password_hash: string;
  nickname: string | null;
  /** v1.6 双端（可选字段，向后兼容）：读取侧 userRoleOf() 兜底 'student'。 */
  role?: UserRole;
  created_at: string;
}

/** 读取侧角色兜底：旧记录 / 未带 role 字段一律按学生（零破坏）。 */
export function userRoleOf(user: Pick<UserRecord, 'role'> | null | undefined): UserRole {
  return user?.role === 'teacher' ? 'teacher' : 'student';
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

// ============================================================================
// v1.6 双端三张新表（TEACHER_PORTAL_DESIGN §3；与既有九张表同构：本地 JSON 文件、
// CloudBase 集合同名。归属纪律：除 invite_codes 外全部带 space_id，与数据归属一致）
// ============================================================================

/** §4.10 invite_codes：老师生成的绑定邀请码（无 space 归属——码在绑定前不指向具体空间）。 */
export interface InviteCodeRecord {
  /** 6 位大写字母数字码本身（主键）。 */
  code: string;
  teacher_id: string;
  created_at: string;
  /** 过期时间（创建 + 7 天）。 */
  expire_at: string;
  /** 最多可绑定学生数。 */
  max_uses: number;
  used_count: number;
  status: 'active' | 'disabled';
}

/** §4.11 links：老师—学生（空间）绑定关系（绑定到 space 而非 user，与数据归属一致）。 */
export interface LinkRecord {
  link_id: string;
  teacher_id: string;
  student_id: string;
  space_id: string;
  created_at: string;
}

/** v1.6 推荐闭环状态机：assigned → viewed → in_progress → done / dismissed；expired 由读取侧惰性判定。 */
export type RecommendationStatus =
  | 'assigned'
  | 'viewed'
  | 'in_progress'
  | 'done'
  | 'dismissed'
  | 'expired';

/** §4.12 recommendations：老师下发的薄弱知识点推荐（闭环见 TEACHER_PORTAL_DESIGN §5）。 */
export interface RecommendationRecord {
  recommendation_id: string;
  teacher_id: string;
  student_id: string;
  space_id: string;
  link_id: string;
  /** 完整 kp id（快照 gaps 的口径）。 */
  kp_id: string;
  kp_name: string;
  /** 老师的一句话说明（学生端确认卡与推荐卡展示）。 */
  note: string;
  status: RecommendationStatus;
  viewed_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  /** 复测闭环自动回写：该 kp 的 retest 正确率 − baseline 正确率（diagnose 服务钩子）。 */
  delta_accuracy: number | null;
  created_at: string;
}

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

  // invite_codes（v1.6 双端）
  getInviteCode(code: string): Promise<InviteCodeRecord | null>;
  listInviteCodesByTeacher(teacherId: string): Promise<InviteCodeRecord[]>;
  insertInviteCode(code: InviteCodeRecord): Promise<void>;
  updateInviteCode(code: InviteCodeRecord): Promise<void>;

  // links（v1.6 双端）
  getLink(linkId: string): Promise<LinkRecord | null>;
  insertLink(link: LinkRecord): Promise<void>;
  deleteLink(linkId: string): Promise<void>;
  listLinksByTeacher(teacherId: string): Promise<LinkRecord[]>;
  listLinksByStudent(studentId: string): Promise<LinkRecord[]>;
  findLinkByStudentAndSpace(studentId: string, spaceId: string): Promise<LinkRecord[]>;

  // recommendations（v1.6 双端）
  getRecommendation(recommendationId: string): Promise<RecommendationRecord | null>;
  insertRecommendation(recommendation: RecommendationRecord): Promise<void>;
  updateRecommendation(recommendation: RecommendationRecord): Promise<void>;
  listRecommendationsByTeacher(teacherId: string): Promise<RecommendationRecord[]>;
  listRecommendationsByStudent(studentId: string): Promise<RecommendationRecord[]>;
}
