/**
 * 统一 API 客户端（D3）：唯一出口 request<T>()。
 *
 * 契约 §0：统一响应体 {code,msg,data}；错误码九码冻结（前端只消费不发明）。
 * 行为：
 *   - 基址 ''（同源，经 vite dev proxy 转发到 127.0.0.1:8787，D4）；
 *   - 自动附 `Authorization: Bearer <token>`（register / login 传 auth:false）；
 *   - HTTP 200 且 code===0 → 返回 data；code!==0 → 抛 ApiError{code,msg,data}；
 *   - code===401 → 清空会话（authStore + localStorage）并跳 #/login，再抛 ApiError(401)；
 *   - 其余码（400/403/404/409/500/502/504）原样抛 ApiError —— msg 已是服务端用户可读话术，
 *     前端不二次翻译（仅网络层失败时用统一话术 UI_TEXT.networkError）；
 *   - 响应非 JSON / 空体 → 也抛 ApiError（禁止白屏，页面按 toast 呈现）。
 */

import { UI_TEXT } from '../lib/phrases';
import { useAuthStore } from '../stores/auth';
import type { ApiEnvelope } from './types';

/** 契约 §0 错误码（不扩展）。 */
export const ERROR_CODE = {
  OK: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL: 500,
  MODEL_UPSTREAM_FAILED: 502,
  MODEL_TIMEOUT: 504,
} as const;

export class ApiError extends Error {
  readonly code: number;
  readonly data: unknown;

  constructor(code: number, message: string, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

/**
 * 默认请求超时（前端优化批二 · 2026-09-22）：15s。
 * 背景：原先只有调用方传 signal 才能取消，服务端挂起（如接入真实模型后的慢响应）时
 * 按钮会一直转、用户只能干等。超时后按统一话术抛 ApiError（不新增错误码）。
 */
export const DEFAULT_TIMEOUT_MS = 15_000;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** false 时不附带 Authorization（仅 register / login）。 */
  auth?: boolean;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** 覆盖默认超时（毫秒）；传 0 表示不限时（如大文件上传）。 */
  timeoutMs?: number;
}

export function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix.length > 0 ? `${path}?${suffix}` : path;
}

/** 401 统一副作用：清会话 + 跳登录（HashRouter 下改 hash 即可，不依赖 router 实例）。 */
export function handleUnauthorized(): void {
  useAuthStore.getState().clear();
  try {
    if (typeof window !== 'undefined') window.location.hash = '#/login';
  } catch {
    /* 非浏览器环境（测试）忽略 */
  }
}

/** 读取并校验统一响应体（非 JSON / 空体 → ApiError）。 */
export async function readEnvelope(response: Response): Promise<ApiEnvelope<unknown>> {
  let text = '';
  try {
    text = await response.text();
  } catch {
    throw new ApiError(ERROR_CODE.INTERNAL, UI_TEXT.networkError);
  }

  if (text.trim().length === 0) {
    throw new ApiError(response.status || ERROR_CODE.INTERNAL, '服务没有返回内容，稍后再试一次');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(
      response.status >= 400 ? response.status : ERROR_CODE.INTERNAL,
      '服务返回了无法识别的响应，稍后再试一次',
    );
  }

  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as ApiEnvelope<unknown>).code !== 'number') {
    throw new ApiError(ERROR_CODE.INTERNAL, '服务返回了无法识别的响应，稍后再试一次');
  }
  return parsed as ApiEnvelope<unknown>;
}

/** 统一请求出口。 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(options.headers ?? {}) };
  const method = options.method ?? 'GET';
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = useAuthStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  if (typeof fetch !== 'function') {
    throw new ApiError(ERROR_CODE.OK, UI_TEXT.networkError);
  }

  // 超时 + 调用方 signal 合流：内部 controller 统一驱动 fetch（AbortSignal.any 兼容性不足，手动转发）
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  const externalSignal = options.signal;
  const forwardAbort = (): void => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', forwardAbort);
  }
  const cleanup = (): void => {
    if (timer !== null) clearTimeout(timer);
    externalSignal?.removeEventListener('abort', forwardAbort);
  };

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    cleanup();
    if (timedOut) throw new ApiError(ERROR_CODE.OK, UI_TEXT.timeoutError);
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error;
    throw new ApiError(ERROR_CODE.OK, UI_TEXT.networkError);
  }
  cleanup();

  const envelope = await readEnvelope(response);

  if (envelope.code === ERROR_CODE.UNAUTHORIZED) {
    handleUnauthorized();
    throw new ApiError(ERROR_CODE.UNAUTHORIZED, envelope.msg || '登录状态已过期，请重新登录', envelope.data);
  }
  if (envelope.code !== ERROR_CODE.OK) {
    throw new ApiError(envelope.code, envelope.msg, envelope.data);
  }
  return envelope.data as T;
}
