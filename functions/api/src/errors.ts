/**
 * 契约 §0 错误码表（全部接口共用，**不扩展**）
 *
 * | code | 含义 |
 * | 0    | 成功 |
 * | 400  | 参数缺失/非法 |
 * | 401  | 未认证 / token 无效 |
 * | 403  | 越权（space_id 不属于当前用户） |
 * | 404  | 资源不存在 |
 * | 409  | 冲突（identifier 已注册 / 同学科空间已存在） |
 * | 500  | 内部错误 |
 * | 502  | 模型上游失败（msg 需含用户可读降级话术） |
 * | 504  | 模型超时 |
 *
 * 纪律：任何新增错误码都属契约破坏；路由层「路径不存在」与「方法不被支持」两个
 * HTTP 层场景也复用 404（不得发明 405 —— 契约错误码表无此码，见执行报告 D-2）。
 */

export const ERROR_CODES = {
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

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 契约 §0 统一响应体：{ code, msg, data }。 */
export interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T | null;
}

/** 业务异常：由 handler 抛出，路由层统一转成契约响应（HTTP status = code，D11）。 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly data: unknown;

  constructor(code: ErrorCode, msg: string, data: unknown = null) {
    super(msg);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

/** 语义化构造器（可读性用，行为与 new ApiError 完全一致）。 */
export const httpError = {
  badRequest: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.BAD_REQUEST, msg, data),
  unauthorized: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.UNAUTHORIZED, msg, data),
  forbidden: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.FORBIDDEN, msg, data),
  notFound: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.NOT_FOUND, msg, data),
  conflict: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.CONFLICT, msg, data),
  internal: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.INTERNAL, msg, data),
  modelUpstreamFailed: (msg: string, data: unknown = null) =>
    new ApiError(ERROR_CODES.MODEL_UPSTREAM_FAILED, msg, data),
  modelTimeout: (msg: string, data: unknown = null) => new ApiError(ERROR_CODES.MODEL_TIMEOUT, msg, data),
} as const;

/** 试卷识别失败时对用户可读的降级话术（契约 §5，502/504 共用）。 */
export const PAPER_FALLBACK_MSG = '这道题我没看清，麻烦你手动标一下对错';

/** 契约 §0：code ≥ 400 时 HTTP status = code；code = 0 时 status = 200（D11）。 */
export function toHttpStatus(code: number): number {
  return code >= 400 ? code : 200;
}
