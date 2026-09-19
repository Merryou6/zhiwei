/**
 * CloudBase 云函数入口（D1 薄适配层）
 *
 * 本文件只做适配：解析云函数 event（path / method / headers / body / query）→
 * router.dispatch → 回包。**业务逻辑零落点**，与本地 server.ts 共用同一 router。
 *
 * 【后续迭代接线位置（本迭代不激活，见计划 一、1.2 排除项 2）】
 *   const cloud = require('@cloudbase/node-sdk');
 *   const app = cloud.init({ env: ctx.env });
 *   const db = app.database();
 *   → 在 appContext() 里用 createAppContext({ store: new CloudBaseStore(db) }) 替换
 *     当前默认的本地 JSON Store；并把 SERVER_SECRET 配到云函数环境变量
 *      ZHIWEI_SERVER_SECRET（契约 §1 token 无状态签名）。
 *
 * 【SSE 降级】云函数不支持长连接流式输出，agent/chat 的事件流在此收集后按
 * 契约 §9 降级为普通 JSON（{ reply 全文, meta }），保证「禁止白屏」。
 */

import { createAppContext } from './context';
import type { AppContext } from './context';
import { toHttpStatus } from './errors';
import type { ApiResponse } from './errors';
import { dispatch, isAsyncGenerator } from './router';

export interface CloudFunctionEvent {
  /** 请求路径（如 /api/space/list） */
  path?: string;
  /** HTTP 方法 */
  method?: string;
  /** 请求头（小写键或原文键均可） */
  headers?: Record<string, string>;
  /** 请求体（对象或 JSON 字符串） */
  body?: unknown;
  /** 查询参数（CloudBase 网关形态） */
  queryStringParameters?: Record<string, string> | null;
}

export interface CloudFunctionContext {
  /** 云环境标识 */
  env?: string;
}

export interface CloudFunctionResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** 进程内缓存的上下文（云函数实例复用；SDK 初始化后应替换为注入 db 的上下文）。 */
let cachedContext: Promise<AppContext> | null = null;

function appContext(ctx: CloudFunctionContext): Promise<AppContext> {
  if (!cachedContext) {
    cachedContext = createAppContext({
      dbKind: process.env.ZHIWEI_DB === 'cloudbase' ? 'cloudbase' : 'json',
      rootDir: process.env.ZHIWEI_ROOT,
    });
    void ctx;
  }
  return cachedContext;
}

function normalizeBody(body: unknown): Record<string, unknown> {
  if (body === null || body === undefined) return {};
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

function wrap(response: ApiResponse): CloudFunctionResponse {
  return {
    statusCode: toHttpStatus(response.code),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(response),
  };
}

/** 云函数入口：薄适配，无业务逻辑。 */
export async function main(
  event: CloudFunctionEvent = {},
  ctx: CloudFunctionContext = {},
): Promise<CloudFunctionResponse> {
  const context = await appContext(ctx);

  const result = await dispatch(
    {
      method: event.method ?? 'GET',
      path: event.path ?? '/',
      query: event.queryStringParameters ?? {},
      body: normalizeBody(event.body),
      headers: event.headers ?? {},
    },
    context,
  );

  if (isAsyncGenerator(result)) {
    const segments: string[] = [];
    let meta: unknown = null;
    for await (const ev of result) {
      if (ev.event === 'delta') {
        segments.push(String((ev.data as { text?: string }).text ?? ''));
      } else if (ev.event === 'meta') {
        meta = ev.data;
      }
    }
    return wrap({ code: 0, msg: 'success', data: { reply: segments.join(''), meta } });
  }

  return wrap(result);
}
