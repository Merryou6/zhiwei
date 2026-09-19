/**
 * 请求上下文：鉴权（D6 无状态 token）、space 归属校验（403）、统一响应封装、
 * 时间格式（ISO8601 UTC）、应用依赖装配。
 *
 * 契约 §0：除 register / login 外所有请求必须带 `Authorization: Bearer <token>`；
 * 所有写接口必须校验 space_id 归属当前用户，否则 403。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

import { loadParams } from '../../../packages/engine/src/index';
import type { Params } from '../../../packages/engine/src/index';

import { createInitializedStore } from './db';
import type { DbKind, Store } from './db';
import type { SpaceRecord, UserRecord } from './db/types';
import { ERROR_CODES, httpError } from './errors';
import type { ApiResponse, ErrorCode } from './errors';
import { loadStaticData } from './data/staticData';
import type { StaticData } from './data/staticData';

export type Headers = Record<string, string | string[] | undefined>;

export interface AppContext {
  store: Store;
  params: Params;
  data: StaticData;
  rootDir: string;
  /** 注入时钟（测试可覆盖，用于小时桶/过期断言）。 */
  now(): number;
}

export interface AppContextOptions {
  rootDir?: string;
  /** local_db 目录（测试注入 mkdtemp 临时目录）。 */
  storeDir?: string;
  dbKind?: DbKind;
  /** 直接注入已构造的 Store（高级用法）。 */
  store?: Store;
  now?: () => number;
}

/** 装配应用依赖：Store（含 init）+ 参数 + 静态数据。 */
export async function createAppContext(options: AppContextOptions = {}): Promise<AppContext> {
  const rootDir = options.rootDir ?? process.env.ZHIWEI_ROOT ?? process.cwd();
  const store =
    options.store ??
    (await createInitializedStore({ rootDir, dir: options.storeDir, kind: options.dbKind }));

  return {
    store,
    params: loadParams(resolve(rootDir, 'config/params.json')),
    data: loadStaticData(rootDir),
    rootDir,
    now: options.now ?? (() => Date.now()),
  };
}

// -------------------------------------------------------------- 响应封装

export function ok<T>(data: T, msg = 'success'): ApiResponse<T> {
  return { code: ERROR_CODES.OK, msg, data };
}

export function fail(code: ErrorCode, msg: string, data: unknown = null): ApiResponse {
  return { code, msg, data };
}

// ---------------------------------------------------------------- 时间

/** ISO8601 UTC，秒精度（契约 §0 样例 `2026-09-24T20:10:00Z`）。 */
export function nowIso(ms: number = Date.now()): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** now + days 天的 ISO8601 UTC（试卷图片保留期限 expire_at 用）。 */
export function isoPlusDays(ms: number, days: number): string {
  return nowIso(ms + days * 24 * 60 * 60 * 1000);
}

/** 当前 ISO 时间（上下文时钟口径）。 */
export function ctxNowIso(ctx: AppContext): string {
  return nowIso(ctx.now());
}

// ---------------------------------------------------------------- 请求头

export function headerValue(headers: Headers | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value[0];
    return value;
  }
  return undefined;
}

// ------------------------------------------------------- token（D6 无状态）

export interface TokenPayload {
  user_id: string;
  /** 签发时间（unix 秒）。 */
  iat: number;
  /** 过期时间（unix 秒）= iat + 30 天。 */
  exp: number;
}

export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** 本地演示缺省密钥；云函数必须由环境变量 ZHIWEI_SERVER_SECRET 注入。 */
const DEV_SECRET = 'zhiwei-dev-secret';

export function serverSecret(): string {
  return process.env.ZHIWEI_SERVER_SECRET ?? DEV_SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function hmac(payload: string): string {
  return createHmac('sha256', serverSecret()).update(payload).digest('base64url');
}

/**
 * 签发 token：base64url(payload) + '.' + HMAC-SHA256(payloadB64)。
 * 不落库（契约 §1）；校验 = 解 payload + 验签 + exp 未过期。
 * overrides 供测试构造过期 token。
 */
export function signToken(
  userId: string,
  overrides: Partial<Pick<TokenPayload, 'iat' | 'exp'>> = {},
): string {
  const iat = overrides.iat ?? Math.floor(Date.now() / 1000);
  const exp = overrides.exp ?? iat + TOKEN_TTL_SECONDS;
  const payload: TokenPayload = { user_id: userId, iat, exp };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${hmac(encoded)}`;
}

/** 验签并解析 token；失败（格式/签名/过期）返回 null。 */
export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = hmac(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (typeof payload.user_id !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 鉴权

/** 契约 §0：解析 Bearer token 并取出用户（401 三种情形：缺失/无效/过期）。 */
export async function requireAuth(headers: Headers | undefined, ctx: AppContext): Promise<UserRecord> {
  const raw = headerValue(headers, 'authorization');
  if (!raw || raw.trim().length === 0) {
    throw httpError.unauthorized('缺少 Authorization 请求头');
  }
  const matched = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  if (!matched) {
    throw httpError.unauthorized('Authorization 请求头格式应为 Bearer <token>');
  }
  const payload = verifyToken(matched[1]);
  if (!payload) {
    throw httpError.unauthorized('token 无效或已过期');
  }
  const user = await ctx.store.findUserById(payload.user_id);
  if (!user) {
    throw httpError.unauthorized('token 无效或已过期');
  }
  return user;
}

/** 契约 §0：space_id 必须属于当前用户，否则 403；空间不存在为 404。 */
export async function requireSpaceOwnership(
  ctx: AppContext,
  userId: string,
  spaceId: unknown,
): Promise<SpaceRecord> {
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const space = await ctx.store.getSpace(spaceId);
  if (!space) {
    throw httpError.notFound('空间不存在');
  }
  if (space.user_id !== userId) {
    throw httpError.forbidden('无权访问该空间');
  }
  return space;
}
