/**
 * 测试应用工厂（D1：业务为纯模块，测试**不起真实端口**，直接调 router.dispatch）
 *
 * 隔离方式：每个测试文件/用例用 mkdtemp 建临时 local_db 目录，互不干扰；
 * 静态数据（图谱/题库/参数）从仓库根读取，全程只读。
 * closedLoop.test.ts 例外：它专门用真实 HTTP（server.ts 工厂）+ fetch 验证通路与 SSE。
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAppContext } from '../src/context';
import type { AppContext, Headers } from '../src/context';
import type { ApiResponse } from '../src/errors';
import { dispatch, isAsyncGenerator } from '../src/router';
import type { SseEvent } from '../src/router';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_PASSWORD = 'secret123';

export interface CallOptions {
  token?: string;
  headers?: Headers;
  query?: Record<string, string>;
}

export interface TestUser {
  user_id: string;
  token: string;
  space_id: string;
}

export interface TestApp {
  ctx: AppContext;
  storeDir: string;
  call<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    options?: CallOptions,
  ): Promise<ApiResponse<T>>;
  get<T = unknown>(path: string, options?: CallOptions): Promise<ApiResponse<T>>;
  post<T = unknown>(
    path: string,
    body?: Record<string, unknown>,
    options?: CallOptions,
  ): Promise<ApiResponse<T>>;
  /** SSE 通路：收集事件序列（chat 专用）。 */
  stream(path: string, body: Record<string, unknown>, options?: CallOptions): Promise<SseEvent[]>;
  register(identifier: string, password?: string, nickname?: string | null): Promise<TestUser>;
  login(identifier: string, password: string): Promise<ApiResponse<{ user_id: string; token: string }>>;
  cleanup(): Promise<void>;
}

function mergeHeaders(options: CallOptions | undefined): Headers {
  const headers: Headers = { ...(options?.headers ?? {}) };
  if (options?.token) headers.authorization = `Bearer ${options.token}`;
  return headers;
}

let seq = 0;

/** 全局唯一 identifier（同一文件/同一进程内的用例互不碰撞）。 */
export function uniqueIdentifier(prefix = 'user'): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}@example.com`;
}

export async function createTestApp(
  options: { now?: () => number; rootDir?: string } = {},
): Promise<TestApp> {
  const storeDir = await mkdtemp(join(tmpdir(), 'zhiwei-db-'));
  const ctx = await createAppContext({
    rootDir: options.rootDir ?? REPO_ROOT,
    storeDir,
    now: options.now,
  });

  async function call<T = unknown>(
    method: string,
    path: string,
    body?: Record<string, unknown> | null,
    callOptions?: CallOptions,
  ): Promise<ApiResponse<T>> {
    const result = await dispatch(
      {
        method,
        path,
        query: callOptions?.query ?? {},
        body: body ?? {},
        headers: mergeHeaders(callOptions),
      },
      ctx,
    );
    if (isAsyncGenerator(result)) {
      throw new Error(`接口 ${method} ${path} 返回 SSE 事件流，请用 app.stream()`);
    }
    return result as ApiResponse<T>;
  }

  async function get<T = unknown>(path: string, callOptions?: CallOptions): Promise<ApiResponse<T>> {
    return call<T>('GET', path, null, callOptions);
  }

  async function post<T = unknown>(
    path: string,
    body?: Record<string, unknown>,
    callOptions?: CallOptions,
  ): Promise<ApiResponse<T>> {
    return call<T>('POST', path, body ?? {}, callOptions);
  }

  async function stream(
    path: string,
    body: Record<string, unknown>,
    callOptions?: CallOptions,
  ): Promise<SseEvent[]> {
    const result = await dispatch(
      { method: 'POST', path, body, headers: mergeHeaders(callOptions) },
      ctx,
    );
    if (!isAsyncGenerator(result)) {
      throw new Error(`接口 ${path} 未返回 SSE 事件流`);
    }
    const events: SseEvent[] = [];
    for await (const event of result) events.push(event);
    return events;
  }

  async function register(
    identifier: string,
    password: string = DEFAULT_PASSWORD,
    nickname: string | null = null,
  ): Promise<TestUser> {
    const response = await call<{ user_id: string; token: string }>('POST', '/api/auth/register', {
      identifier,
      password,
      nickname,
    });
    if (response.code !== 0 || !response.data) {
      throw new Error(`注册失败：${response.code} ${response.msg}`);
    }
    const spaces = await call<{ spaces: { space_id: string }[] }>('GET', '/api/space/list', null, {
      token: response.data.token,
    });
    const spaceId = spaces.data?.spaces[0]?.space_id;
    if (!spaceId) throw new Error('注册后未自动创建默认空间');
    return { user_id: response.data.user_id, token: response.data.token, space_id: spaceId };
  }

  async function login(
    identifier: string,
    password: string,
  ): Promise<ApiResponse<{ user_id: string; token: string }>> {
    return call<{ user_id: string; token: string }>('POST', '/api/auth/login', {
      identifier,
      password,
    });
  }

  async function cleanup(): Promise<void> {
    await rm(storeDir, { recursive: true, force: true });
  }

  return { ctx, storeDir, call, get, post, stream, register, login, cleanup };
}
