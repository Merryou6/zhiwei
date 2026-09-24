/**
 * 路由层（D1）：method + path 匹配 → service 分发表
 *
 * 双入口共用：server.ts（本地 Node HTTP）与 index.ts（CloudBase 薄适配）都只做
 * 「解析请求 → router.dispatch → 序列化响应」，业务逻辑零入口耦合。
 *
 * 路由注册顺序纪律（契约 §2/§5/§7 静态段与参数段冲突）：
 *   /api/evidence/paper/confirm   先于  /api/evidence/paper/:recognitionId
 *   /api/attribution/analyze|verify 先于 /api/attribution/:attributionId
 *
 * 错误码纪律：契约 §0 无 405，路径不存在与方法不被支持均返回 404（msg 区分），
 * 见执行报告 D-2。
 */

import type { AppContext, Headers } from './context';
import { fail } from './context';
import { ERROR_CODES, ApiError } from './errors';
import type { ApiResponse } from './errors';
import {
  analyze as attributionAnalyze,
  getOne as getAttribution,
  reject as agentReject,
  verify as attributionVerify,
} from './services/attribution';
import { login, register } from './services/auth';
import { chat as agentChat } from './services/chat';
import { classifyError } from './services/classify';
import { next as diagnoseNext, submit as diagnoseSubmit } from './services/diagnose';
import { confirmPaper, getOne as getPaper, upload as uploadPaper } from './services/paper';
import { generate as generatePlan } from './services/plan';
import { profile as userProfile } from './services/profile';
import { summary as reportSummary } from './services/report';
import { selfReport } from './services/selfReport';
import { create as createSpace, drive as spaceDrive, list as listSpaces } from './services/space';

export interface SseEvent {
  event: 'delta' | 'meta' | 'done' | 'error';
  data: unknown;
}

/** 业务响应或 SSE 事件流（仅 agent/chat 走流式）。 */
export type HandlerResult = ApiResponse | AsyncGenerator<SseEvent>;

export interface RouteRequest {
  method: string;
  /** 仅路径部分（不含 query），如 /api/space/sp_1/drive */
  path: string;
  /** 路径参数（:spaceId 等） */
  params: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
  headers: Headers;
}

export type RouteHandler = (req: RouteRequest, ctx: AppContext) => Promise<HandlerResult> | HandlerResult;

export interface RouteDefinition {
  method: string;
  /** 形如 /api/space/:spaceId/drive */
  pattern: string;
  handler: RouteHandler;
}

export interface DispatchInput {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: Record<string, unknown> | null;
  headers?: Headers;
}

/** 20 个接口的路由表（按批挂载；每批只追加自己的路由，注册顺序即匹配优先级）。 */
export function createRoutes(): RouteDefinition[] {
  return [
    // 步骤 2：认证 + 空间（#1–#5）
    { method: 'POST', pattern: '/api/auth/register', handler: register },
    { method: 'POST', pattern: '/api/auth/login', handler: login },
    { method: 'GET', pattern: '/api/space/list', handler: listSpaces },
    { method: 'POST', pattern: '/api/space/create', handler: createSpace },
    { method: 'GET', pattern: '/api/space/:spaceId/drive', handler: spaceDrive },

    // 步骤 3：自报 + 测评（#6–#8）
    { method: 'POST', pattern: '/api/evidence/self-report', handler: selfReport },
    { method: 'POST', pattern: '/api/diagnose/next', handler: diagnoseNext },
    { method: 'POST', pattern: '/api/diagnose/submit', handler: diagnoseSubmit },

    // 步骤 4：试卷三接口（#9–#11）
    // 注册顺序：/confirm 静态段必须先于 /:recognitionId 参数段（契约 §5）
    { method: 'POST', pattern: '/api/evidence/paper', handler: uploadPaper },
    { method: 'POST', pattern: '/api/evidence/paper/confirm', handler: confirmPaper },
    { method: 'GET', pattern: '/api/evidence/paper/:recognitionId', handler: getPaper },

    // 步骤 5：错误诊断 + 归因四接口（#12–#16）
    // 注册顺序：/analyze 与 /verify 静态段必须先于 /:attributionId 参数段（契约 §7）
    { method: 'POST', pattern: '/api/error/classify', handler: classifyError },
    { method: 'POST', pattern: '/api/attribution/analyze', handler: attributionAnalyze },
    { method: 'POST', pattern: '/api/attribution/verify', handler: attributionVerify },
    { method: 'POST', pattern: '/api/agent/reject', handler: agentReject },
    { method: 'GET', pattern: '/api/attribution/:attributionId', handler: getAttribution },

    // 步骤 6：处方 + 对话（#17–#18）
    { method: 'POST', pattern: '/api/plan/generate', handler: generatePlan },
    { method: 'POST', pattern: '/api/agent/chat', handler: agentChat },

    // 步骤 7：学习报告（#19）
    { method: 'GET', pattern: '/api/report/summary', handler: reportSummary },

    // 步骤 8：用户资料（#20 · v1.2）—— 静态段，与既有路由无前缀冲突
    { method: 'GET', pattern: '/api/user/profile', handler: userProfile },
  ];
}

function splitPath(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

function matchPath(pattern: string, segments: string[]): Record<string, string> | null {
  const patternSegments = splitPath(pattern);
  if (patternSegments.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i += 1) {
    const segment = patternSegments[i];
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(segments[i]);
      continue;
    }
    if (segment !== segments[i]) return null;
  }
  return params;
}

/** 路由分派：命中 → handler；未命中 → 契约 404 JSON（禁止 HTML 错误页）。 */
export async function dispatch(input: DispatchInput, ctx: AppContext): Promise<HandlerResult> {
  const method = (input.method ?? 'GET').toUpperCase();
  const rawPath = input.path.split('?')[0] || '/';
  const segments = splitPath(rawPath);
  const routes = createRoutes();

  let pathMatched = false;
  let handler: RouteHandler | null = null;
  let params: Record<string, string> = {};

  for (const route of routes) {
    const matched = matchPath(route.pattern, segments);
    if (!matched) continue;
    pathMatched = true;
    if (route.method.toUpperCase() === method) {
      handler = route.handler;
      params = matched;
      break;
    }
  }

  if (!handler) {
    return pathMatched
      ? fail(ERROR_CODES.NOT_FOUND, `请求方法不被支持：${method} ${rawPath}`)
      : fail(ERROR_CODES.NOT_FOUND, `接口不存在：${method} ${rawPath}`);
  }

  const request: RouteRequest = {
    method,
    path: rawPath,
    params,
    query: input.query ?? {},
    body: input.body ?? {},
    headers: input.headers ?? {},
  };

  try {
    const result = await handler(request, ctx);
    if (isAsyncGenerator(result)) return result;
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.code, error.message, error.data);
    }
    const message = error instanceof Error ? error.message : String(error);
    // 本地演示：把原因带进 msg 便于定位；生产可改为只记日志
    return fail(ERROR_CODES.INTERNAL, `服务器内部错误：${message}`);
  }
}

/** 判定 handler 是否返回 SSE 事件流（不可用 instanceof 覆盖跨 realm 情形）。 */
export function isAsyncGenerator(value: unknown): value is AsyncGenerator<SseEvent> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AsyncGenerator<SseEvent>)[Symbol.asyncIterator] === 'function'
  );
}
