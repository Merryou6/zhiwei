/**
 * 19 接口的类型化函数（逐条对照 API_CONTRACT.md §1–§10 的 method + path）。
 *
 * #1–#17、#19 走统一 client（request）；#18 agent/chat 是 SSE，见 api/sse.ts。
 * 本文件只做「路径 / 方法 / DTO」映射，不含任何业务判断（页面与 store 负责编排）。
 */

import { request } from './client';
import type {
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
  LoginRequest,
  PaperConfirmData,
  PaperConfirmRequest,
  PaperGetData,
  PaperUploadData,
  PaperUploadRequest,
  PlanData,
  PlanGenerateRequest,
  RegisterRequest,
  ReportSummaryData,
  SelfReportData,
  SelfReportRequest,
  SpaceCreateData,
  SpaceCreateRequest,
  SpaceListData,
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
