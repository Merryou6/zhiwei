/**
 * 认证服务（契约 §1，接口 #1 register / #2 login）
 *
 * - 密码哈希：node:crypto scrypt（salt 16B + N=16384 + keylen 64），存 "salt:hash" 十六进制；
 *   字段名沿用 DATA_SCHEMA §4.1 的 password_hash（D5 裁决：scrypt 替代 bcrypt）。
 * - token：无状态签名（D6），不落库；校验 = 解 payload + 验签 + exp。
 * - register 副作用：服务端自动创建默认空间（name 取知识库名，见契约 §1）。
 * - login 失败统一 401 同一话术（D16，不泄露 identifier 存在性）。
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { ctxNowIso, ok, requireAuth, signToken } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import type { SpaceRecord, UserRecord } from '../db/types';

/** 当前唯一合法知识库（契约 §2）。 */
export const DEFAULT_KB_ID = 'kb_math_cz';
/** 默认空间展示名回落值（知识库名读不到时使用）。 */
const DEFAULT_SPACE_NAME = '初中数学';
const DEFAULT_SUBJECT = '数学';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

function readString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' ? value : null;
}

/** 默认空间（契约 §1：name="初中数学"、knowledge_source=["kb_math_cz"]、is_default=true）。 */
export function buildDefaultSpace(ctx: AppContext, userId: string): SpaceRecord {
  return {
    space_id: newId('sp_'),
    user_id: userId,
    name: ctx.data.kbName(DEFAULT_KB_ID) ?? DEFAULT_SPACE_NAME,
    subject: ctx.data.subjectOfKb(DEFAULT_KB_ID) ?? DEFAULT_SUBJECT,
    knowledge_source: [DEFAULT_KB_ID],
    is_default: true,
    created_at: ctxNowIso(ctx),
  };
}

/** POST /api/auth/register */
export async function register(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const identifier = readString(req.body, 'identifier');
  const password = readString(req.body, 'password');
  const nicknameRaw = req.body.nickname;

  if (!identifier || identifier.trim().length === 0) {
    throw httpError.badRequest('identifier 不能为空');
  }
  if (typeof password !== 'string' || password.length < 6) {
    throw httpError.badRequest('password 至少 6 位');
  }
  if (nicknameRaw !== undefined && nicknameRaw !== null && typeof nicknameRaw !== 'string') {
    throw httpError.badRequest('nickname 必须是字符串');
  }

  const trimmedIdentifier = identifier.trim();
  const existing = await ctx.store.findUserByIdentifier(trimmedIdentifier);
  if (existing) {
    throw httpError.conflict('该账号已注册');
  }

  const user: UserRecord = {
    user_id: newId('u_'),
    identifier: trimmedIdentifier,
    password_hash: hashPassword(password),
    nickname: typeof nicknameRaw === 'string' && nicknameRaw.length > 0 ? nicknameRaw : null,
    created_at: ctxNowIso(ctx),
  };
  await ctx.store.insertUser(user);

  // 契约 §1 副作用：注册成功即自动创建默认空间
  await ctx.store.insertSpace(buildDefaultSpace(ctx, user.user_id));

  return ok({ user_id: user.user_id, token: signToken(user.user_id) });
}

/** POST /api/auth/login */
export async function login(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const identifier = readString(req.body, 'identifier');
  const password = readString(req.body, 'password');

  if (!identifier || identifier.trim().length === 0) {
    throw httpError.badRequest('identifier 不能为空');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw httpError.badRequest('password 不能为空');
  }

  const user = await ctx.store.findUserByIdentifier(identifier.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw httpError.unauthorized('账号或密码不正确');
  }

  return ok({ user_id: user.user_id, token: signToken(user.user_id) });
}

/** 受保护接口的统一入口（路由层用；供 services 复用，避免各处重复 requireAuth）。 */
export async function authedUser(req: RouteRequest, ctx: AppContext): Promise<UserRecord> {
  return requireAuth(req.headers, ctx);
}
