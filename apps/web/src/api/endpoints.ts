/**
 * 20 接口的类型化函数（逐条对照 API_CONTRACT.md §1–§10 的 method + path + #20）。
 *
 * #1–#17、#19、#20 走统一 client（request）；#18 agent/chat 是 SSE，见 api/sse.ts。
 * 本文件只做「路径 / 方法 / DTO」映射，不含任何业务判断（页面与 store 负责编排）。
 */

import { request } from './client';
import type {
  ConceptIndexData,
  PracticeLadderData,
  PracticeProgressData,
  AttributionAnalyzeData,
  AttributionAnalyzeRequest,
  AttributionRejectData,
  AttributionRejectRequest,
  AttributionVerifyData,
  AttributionVerifyRequest,
  AttributionView,
  AuthData,
  ClassifyData,
  ClassifyRequest,
  DiagnoseNextData,
  DiagnoseNextRequest,
  DiagnoseSubmitData,
  DiagnoseSubmitRequest,
  DriveData,
  GradeStepsRequest,
  GradeStepsData,
  GraphMasteryData,
  LoginRequest,
  PaperConfirmData,
  PaperConfirmRequest,
  PaperGetData,
  PaperUploadData,
  PaperUploadRequest,
  PlanData,
  PlanGenerateRequest,
  ProfileData,
  RegisterRequest,
  ReportSummaryData,
  SelfReportData,
  SelfReportRequest,
  SpaceCreateData,
  SpaceCreateRequest,
  SpaceListData,
  InviteInfo,
  InviteListItem,
  LinkConfirmResult,
  LinkPreview,
  MyTeacher,
  TeacherRecommendation,
  TeacherStudentCard,
  TeacherStudentDetail,
} from './types';

// ---------------------------------------------------------------- §1 认证

/** #1 POST /api/auth/register（注册成功服务端自动建默认空间）。 */
export function register(body: RegisterRequest): Promise<AuthData> {
  return request<AuthData>('/api/auth/register', { method: 'POST', body, auth: false });
}

/** #2 POST /api/auth/login */
export function login(body: LoginRequest): Promise<AuthData> {
  return request<AuthData>('/api/auth/login', { method: 'POST', body, auth: false });
}

/** #20 GET /api/user/profile（v1.2 新增，只读：「我的」页的账号 / 空间 / 模型信息）。 */
export function getUserProfile(): Promise<ProfileData> {
  return request<ProfileData>('/api/user/profile');
}

// ---------------------------------------------------------------- §2 空间

/** #3 GET /api/space/list */
export function listSpaces(): Promise<SpaceListData> {
  return request<SpaceListData>('/api/space/list');
}

/** #4 POST /api/space/create（409 时 ApiError.data = { existing_space_id }）。 */
export function createSpace(body: SpaceCreateRequest): Promise<SpaceCreateData> {
  return request<SpaceCreateData>('/api/space/create', { method: 'POST', body });
}

/** #5 GET /api/space/{space_id}/drive */
export function drive(spaceId: string): Promise<DriveData> {
  return request<DriveData>(`/api/space/${encodeURIComponent(spaceId)}/drive`);
}

// ---------------------------------------------------------------- §3 自报

/** #6 POST /api/evidence/self-report */
export function selfReport(body: SelfReportRequest): Promise<SelfReportData> {
  return request<SelfReportData>('/api/evidence/self-report', { method: 'POST', body });
}

// ---------------------------------------------------------------- §4 测评

/** #7 POST /api/diagnose/next（题池由服务端按 mode 推导，前端不传 pool）。 */
export function diagnoseNext(body: DiagnoseNextRequest): Promise<DiagnoseNextData> {
  return request<DiagnoseNextData>('/api/diagnose/next', { method: 'POST', body });
}

/** #8 POST /api/diagnose/submit（correct 仅测量模式有值；前端一律不渲染，D11）。 */
export function diagnoseSubmit(body: DiagnoseSubmitRequest): Promise<DiagnoseSubmitData> {
  return request<DiagnoseSubmitData>('/api/diagnose/submit', { method: 'POST', body });
}

// ---------------------------------------------------------------- §5 试卷

/** #9 POST /api/evidence/paper */
export function uploadPaper(body: PaperUploadRequest): Promise<PaperUploadData> {
  return request<PaperUploadData>('/api/evidence/paper', { method: 'POST', body });
}

/** #10 GET /api/evidence/paper/{recognition_id}（刷新回显） */
export function getPaper(recognitionId: string): Promise<PaperGetData> {
  return request<PaperGetData>(`/api/evidence/paper/${encodeURIComponent(recognitionId)}`);
}

/** #11 POST /api/evidence/paper/confirm（unclear 必须手标，服务端拒绝默认值）。 */
export function confirmPaper(body: PaperConfirmRequest): Promise<PaperConfirmData> {
  return request<PaperConfirmData>('/api/evidence/paper/confirm', { method: 'POST', body });
}

// ---------------------------------------------------------------- §6 错误类型诊断

/** #12 POST /api/error/classify（confidence < 0.6 → status='clarify'）。 */
export function classify(body: ClassifyRequest): Promise<ClassifyData> {
  return request<ClassifyData>('/api/error/classify', { method: 'POST', body });
}

// ---------------------------------------------------------------- §7 归因

/** #13 POST /api/attribution/analyze（procedural_slip / misreading 前端不得调用）。 */
export function analyze(body: AttributionAnalyzeRequest): Promise<AttributionAnalyzeData> {
  return request<AttributionAnalyzeData>('/api/attribution/analyze', { method: 'POST', body });
}

/** #14 GET /api/attribution/{attribution_id}（结果页刷新回显） */
export function getAttribution(attributionId: string): Promise<AttributionView> {
  return request<AttributionView>(`/api/attribution/${encodeURIComponent(attributionId)}`);
}

/** #15 POST /api/attribution/verify（对错由服务端判定） */
export function verify(body: AttributionVerifyRequest): Promise<AttributionVerifyData> {
  return request<AttributionVerifyData>('/api/attribution/verify', { method: 'POST', body });
}

/** #16 POST /api/agent/reject（学生反驳，追加再验证题） */
export function reject(body: AttributionRejectRequest): Promise<AttributionRejectData> {
  return request<AttributionRejectData>('/api/agent/reject', { method: 'POST', body });
}

// ---------------------------------------------------------------- §8 处方

/** #17 POST /api/plan/generate */
export function generatePlan(body: PlanGenerateRequest): Promise<PlanData> {
  return request<PlanData>('/api/plan/generate', { method: 'POST', body });
}

// ---------------------------------------------------------------- §10 报告

/** #19 GET /api/report/summary?space_id=xxx */
export function reportSummary(spaceId: string): Promise<ReportSummaryData> {
  return request<ReportSummaryData>('/api/report/summary', { query: { space_id: spaceId } });
}

// ---------------------------------------------------------------- §14 技能树（v2.1）

/** #32 GET /api/graph/mastery?space_id=xxx —— 技能树全量掌握度 + 游戏化摘要。 */
export function getGraphMastery(spaceId: string): Promise<GraphMasteryData> {
  return request<GraphMasteryData>('/api/graph/mastery', { query: { space_id: spaceId } });
}

// ---------------------------------------------------------------- §15 逐步批改（v2.1）

/** #33 POST /api/grade/steps —— 分步提交，逐步批改并定位思路断点。 */
export function gradeSteps(body: GradeStepsRequest): Promise<GradeStepsData> {
  return request<GradeStepsData>('/api/grade/steps', { method: 'POST', body });
}

// ---------------------------------------------------------------- §12 老师端（v1.6）

/** #21 POST /api/teacher/invites —— 生成（或复用）绑定邀请码。 */
export function createInvite(): Promise<InviteInfo> {
  return request<InviteInfo>('/api/teacher/invites', { method: 'POST', body: {} });
}

/** #22 GET /api/teacher/invites —— 我的邀请码列表。 */
export function listInvites(): Promise<{ invites: InviteListItem[] }> {
  return request<{ invites: InviteListItem[] }>('/api/teacher/invites');
}

/** #23 GET /api/teacher/students —— 学生卡片墙。 */
export function listTeacherStudents(): Promise<{ students: TeacherStudentCard[]; total: number }> {
  return request<{ students: TeacherStudentCard[]; total: number }>('/api/teacher/students');
}

/** #24 GET /api/teacher/students/:studentId?space_id= —— 学生详情快照。 */
export function getTeacherStudent(studentId: string, spaceId: string): Promise<TeacherStudentDetail> {
  return request<TeacherStudentDetail>(`/api/teacher/students/${encodeURIComponent(studentId)}`, {
    query: { space_id: spaceId },
  });
}

/** #25 POST /api/teacher/recommendations —— 下发推荐。 */
export function assignRecommendation(body: {
  space_id: string;
  kp_id: string;
  note?: string;
}): Promise<TeacherRecommendation> {
  return request<TeacherRecommendation>('/api/teacher/recommendations', { method: 'POST', body });
}

/** #26 GET /api/teacher/recommendations —— 我的推荐（可按学生/空间过滤）。 */
export function listTeacherRecommendations(params: { student_id?: string; space_id?: string } = {}): Promise<{
  recommendations: TeacherRecommendation[];
}> {
  return request<{ recommendations: TeacherRecommendation[] }>('/api/teacher/recommendations', {
    query: { student_id: params.student_id, space_id: params.space_id },
  });
}

// ---------------------------------------------------------------- §13 学生端（v1.6）

/** #27 GET /api/student/link/preview?code= —— 绑定前预览（双向确认第一步）。 */
export function previewLink(code: string): Promise<LinkPreview> {
  return request<LinkPreview>('/api/student/link/preview', { query: { code } });
}

/** #28 POST /api/student/link —— 确认绑定（双向确认第二步）。 */
export function confirmLink(body: { invite_code: string; space_id: string }): Promise<LinkConfirmResult> {
  return request<LinkConfirmResult>('/api/student/link', { method: 'POST', body });
}

/** #29 GET /api/student/links —— 我的老师。 */
export function listMyTeachers(): Promise<{ teachers: MyTeacher[] }> {
  return request<{ teachers: MyTeacher[] }>('/api/student/links');
}

/** #30 GET /api/student/recommendations?space_id= —— 我的推荐。 */
export function listMyRecommendations(spaceId: string): Promise<{
  recommendations: TeacherRecommendation[];
}> {
  return request<{ recommendations: TeacherRecommendation[] }>('/api/student/recommendations', {
    query: { space_id: spaceId },
  });
}

/** #31 POST /api/student/recommendations/:id/feedback —— 推荐反馈（推进闭环）。 */
export function recommendationFeedback(
  recommendationId: string,
  action: 'viewed' | 'in_progress' | 'dismissed',
): Promise<TeacherRecommendation> {
  return request<TeacherRecommendation>(
    `/api/student/recommendations/${encodeURIComponent(recommendationId)}/feedback`,
    { method: 'POST', body: { action } },
  );
}

// ---------------------------------------------------------------- §15 专项阶梯 + 进度（#34/#35，v2.2-m1）

/** #34 GET /api/practice/ladder?space_id=&chapter=&size= —— 专项阶梯（由易到难组一梯子题）。 */
export function practiceLadder(
  spaceId: string,
  chapter: string,
  size = 5,
): Promise<PracticeLadderData> {
  return request<PracticeLadderData>('/api/practice/ladder', {
    query: { space_id: spaceId, chapter, size: String(size) },
  });
}

/** #35 GET /api/practice/progress?space_id=[&chapter=] —— 练习进度（按章节聚合）。 */
export function practiceProgress(spaceId: string, chapter?: string): Promise<PracticeProgressData> {
  return request<PracticeProgressData>('/api/practice/progress', {
    query: chapter ? { space_id: spaceId, chapter } : { space_id: spaceId },
  });
}

// ---------------------------------------------------------------- §16 概念知识库（#36，v2.2-m1）

/** #36 GET /api/concepts?space_id=[&chapter=] —— 概念体系卡（概念给体系 / 提示链数据源）。 */
export function concepts(spaceId: string, chapter?: string): Promise<ConceptIndexData> {
  return request<ConceptIndexData>('/api/concepts', {
    query: chapter ? { space_id: spaceId, chapter } : { space_id: spaceId },
  });
}
