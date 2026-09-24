/**
 * 20 接口 DTO 类型（逐字对照 API_CONTRACT.md v1.2 §1–§10 + #20）
 *
 * 纪律：字段名一律以契约为唯一依据（禁止改名/加兼容别名）；错误码只消费不发明（§0 九码冻结）。
 * 题对象两形态（serialization.ts 白名单）：{item_id, stem, options} 与 +difficulty（§8 item_sequence）。
 */

/** 统一响应体（契约 §0）。 */
export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T | null;
}

/** 题对象白名单形态（契约 §4 / §7）。answer / solution_steps 永不下发。 */
export interface ClientItem {
  item_id: string;
  stem: string;
  options: string[] | null;
}

/** §8 item_sequence 的题对象（多一个 difficulty）。 */
export interface ClientItemWithDifficulty extends ClientItem {
  difficulty: number;
}

// ---------------------------------------------------------------- §1 认证

export interface RegisterRequest {
  identifier: string;
  password: string;
  nickname?: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface AuthData {
  user_id: string;
  token: string;
}

// ---------------------------------------------------------------- §2 空间

export interface SpaceView {
  space_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

export interface SpaceListData {
  spaces: SpaceView[];
}

export interface SpaceCreateRequest {
  /** 学科知识库 id（取 data/knowledge/index.json 的任一 stage.kb_id，如 kb_math_cz / kb_math_gz）。 */
  knowledge_source: string;
  /**
   * 空间名（契约 §2 v1.2 新增，可选）：1–30 字（trim 后计长），缺省由服务端取知识库名。
   * 传空串/全空白/超 30 字/非字符串 → 400（服务端不猜测、不补默认值）。
   * 仅当与本人已有空间同名时才 409（data.existing_space_id 语义不变）。
   */
  name?: string;
}

export interface SpaceCreateData {
  space_id: string;
  name: string;
}

/** 409 冲突时 data 携带的既有空间 id（契约 §2，前端据此弹「切换过去」）。 */
export interface SpaceCreateConflictData {
  existing_space_id: string;
}

export interface DriveFileView {
  file_id: string;
  name: string;
  type: string;
  size: number;
}

export interface DriveData {
  files: DriveFileView[];
}

// ---------------------------------------------------------------- §3 自报

export type SelfReportLevel = 1 | 2 | 3 | 4 | 5;

export interface SelfReportRow {
  chapter: string;
  level: SelfReportLevel;
}

export interface SelfReportRequest {
  space_id: string;
  reports: SelfReportRow[];
}

export interface SelfReportData {
  /** 被写入先验的知识点数（契约 §3）。 */
  updated: number;
}

// ---------------------------------------------------------------- §4 测评

export type DiagnoseMode = 'diagnose' | 'baseline' | 'retest';

export interface DiagnoseNextRequest {
  space_id: string;
  mode: DiagnoseMode;
  scope_chapter?: string;
  exclude_item_ids?: string[];
}

export interface DiagnoseNextData {
  item: ClientItem | null;
  remaining: number;
  converged: boolean;
}

export interface DiagnoseSubmitRequest {
  space_id: string;
  item_id: string;
  answer: string;
  mode: DiagnoseMode;
}

export interface DiagnoseSubmitData {
  /** 仅 baseline / retest 返回真值；diagnose 恒 null（前端一律不渲染，D11）。 */
  correct: boolean | null;
  mastery_before: number;
  mastery_after: number;
  converged: boolean;
  next_item: ClientItem | null;
}

// ---------------------------------------------------------------- §5 试卷

export type SuggestedResult = 'correct' | 'wrong' | 'unclear';
export type ConfirmResult = 'correct' | 'wrong';

export interface RecognitionItemView {
  seq: number;
  stem_excerpt: string;
  kp_guess: string;
  student_answer: string;
  suggested_result: SuggestedResult;
}

export interface PaperUploadRequest {
  space_id: string;
  file_id: string;
}

export interface PaperUploadData {
  recognition_id: string;
  status: string;
  items: RecognitionItemView[];
}

/** §10 回显与 §9 上传 data 同形（识别结果整体持久化）。 */
export type PaperGetData = PaperUploadData;

export interface PaperConfirmRow {
  seq: number;
  kp_id: string;
  result: ConfirmResult;
}

export interface PaperConfirmRequest {
  recognition_id: string;
  space_id: string;
  items: PaperConfirmRow[];
}

export interface MasteryUpdateView {
  knowledge_point: string;
  before: number;
  after: number;
}

export interface PaperConfirmData {
  events_created: number;
  mastery_updates: MasteryUpdateView[];
}

// ---------------------------------------------------------------- §6 错误类型诊断

export type ErrorTypeValue =
  | 'prerequisite_gap'
  | 'concept_confusion'
  | 'method_gap'
  | 'procedural_slip'
  | 'misreading';

export type AttributionDirectionValue = 'upstream' | 'self' | 'none';

export interface ClassifyRequest {
  space_id: string;
  item_id?: string;
  stem?: string;
  student_answer: string;
  kp_id: string;
}

export interface ClassifyAdoptedData {
  status: 'adopted';
  knowledge_point: string;
  error_type: ErrorTypeValue;
  matched_typical_error: string | null;
  confidence: number;
  evidence: string | null;
  attribution_direction: AttributionDirectionValue;
}

export interface ClassifyClarifyData {
  status: 'clarify';
  question: string;
}

export type ClassifyData = ClassifyAdoptedData | ClassifyClarifyData;

// ---------------------------------------------------------------- §7 归因

export interface AttributionAnalyzeRequest {
  space_id: string;
  kp_id: string;
  error_type: ErrorTypeValue;
  evidence_event_id?: string;
}

export interface AttributionAnalyzeData {
  attribution_id: string;
  root_cause: string;
  /** 完整 kp id，终点 = 根因（契约 §7）。 */
  path: string[];
  suspect_scores: Record<string, number>;
  verification_item: ClientItem | null;
}

/** §14 GET 的完整视图（analyze 的超集：含回显字段，见执行报告偏差 D-2 留痕）。 */
export interface AttributionView extends AttributionAnalyzeData {
  from_kp: string;
  error_type: ErrorTypeValue;
  verified: boolean;
  verified_by: string | null;
  rejected_by_student: boolean;
}

export interface AttributionVerifyRequest {
  attribution_id: string;
  item_id: string;
  answer: string;
}

export interface NextCandidateView {
  kp_id: string;
  suspect_score: number;
  verification_item: ClientItem | null;
}

export interface AttributionVerifyData {
  verified: boolean;
  correct: boolean;
  root_cause: string;
  next_candidate: NextCandidateView | null;
}

export interface AttributionRejectRequest {
  attribution_id: string;
  reason?: string;
}

export interface AttributionRejectData {
  verification_item: ClientItem | null;
}

// ---------------------------------------------------------------- §8 处方

export interface PlanGenerateRequest {
  space_id: string;
  root_cause: string;
  error_type: ErrorTypeValue;
}

export interface PlanData {
  strategy: string;
  explanation_outline: string[];
  item_sequence: ClientItemWithDifficulty[];
  /** 图谱高亮用完整 id 链（上游 → 根因）。 */
  path: string[];
}

// ---------------------------------------------------------------- §9 对话（SSE）

export type ChatNextAction = 'continue' | 'hint_down' | 'give_solution' | 'exit_channel';

export interface ChatMeta {
  dialog_id: string;
  kp_match: { kp_id: string; confidence: number };
  progress: boolean;
  progress_reason: string | null;
  next_action: ChatNextAction;
}

export interface ChatRequest {
  space_id: string;
  dialog_id?: string;
  message: string;
  image_file_id?: string;
}

export interface ChatJsonData {
  reply: string;
  meta: ChatMeta;
  /**
   * v1.3：当轮过程链路（phase / tool / thought，顺序即执行顺序）。
   * 旧服务端可能不带本字段 → 可选，前端按「无 trace」正常整段渲染。
   */
  trace?: ChatTraceStep[];
}

export interface SseDeltaData {
  text: string;
}

export interface SseErrorMessageData {
  msg: string;
}

// ---------------------------------------------------------------- §9 过程事件（v1.3）

/** 阶段名（契约 §9 v1.3：analyze → retrieve → judge → generate）。 */
export type ChatPhaseName = 'analyze' | 'retrieve' | 'judge' | 'generate';

/** 工具名闭集（7 项，与后端 chatTrace.TOOL_LABEL 的键集逐字一致）。 */
export type ChatToolName =
  | 'load_graph'
  | 'model_call'
  | 'kp_match'
  | 'dedup_check'
  | 'apply_evidence'
  | 'state_machine'
  | 'exit_channel';

/** 工具步骤状态：running（仅远程真流场景）→ 终态 ok | error。 */
export type ChatToolStatus = 'running' | 'ok' | 'error';

/** tool 事件的 data（字段名与契约 §9 v1.3 逐字一致）。 */
export interface ChatToolStep {
  id: string;
  name: ChatToolName;
  label: string;
  status: ChatToolStatus;
  /** 服务端真实中间量（不含题库答案字段）。 */
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  /** 真实执行耗时（毫秒）。 */
  ms?: number;
}

export type ChatSseToolData = ChatToolStep;

export interface ChatSseThoughtData {
  text: string;
}

export interface ChatSsePhaseData {
  name: ChatPhaseName;
  label: string;
}

/** JSON 降级 trace 的步骤（顺序即执行顺序，前端重放为对应回调）。 */
export type ChatTraceStep =
  | { type: 'phase'; name: ChatPhaseName; label: string }
  | ({ type: 'tool' } & ChatToolStep)
  | { type: 'thought'; text: string };

// ---------------------------------------------------------------- §10 报告

export interface MasteryRowData {
  kp_id: string;
  name: string;
  mastery: number;
  status_band: string;
}

export interface GapRowData {
  kp_id: string;
  name: string;
  mastery: number;
  error_type_last: ErrorTypeValue | null;
}

export interface AccuracyRowData {
  kp_id: string;
  baseline: number | null;
  retest: number | null;
  delta: number | null;
}

export interface ReportSummaryData {
  mastery: MasteryRowData[];
  gaps: GapRowData[];
  accuracy: AccuracyRowData[];
}

// ---------------------------------------------------------------- §1 认证 · #20（v1.2 新增，只读）

/** #20 的账号视图（服务端显式字面构造；password_hash 永不下发）。 */
export interface ProfileUserView {
  user_id: string;
  identifier: string;
  nickname: string | null;
  created_at: string;
}

/** #20 的对话模型运行信息（只读展示：前端不提供自定义入口）。 */
export interface ProfileModelView {
  mode: 'local' | 'remote';
  /** 仅 mode='remote' 时有值（ZHIWEI_LLM_MODEL），否则 null。 */
  name: string | null;
}

/** #20 GET /api/user/profile 的 data。 */
export interface ProfileData {
  user: ProfileUserView;
  /** 与 §2 list 完全同形（复用 SpaceView）。 */
  spaces: SpaceView[];
  model: ProfileModelView;
}
