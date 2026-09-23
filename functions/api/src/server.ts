/**
 * 本地 Node HTTP 入口（D2，`npm run api`）
 *
 * 职责仅三件：解析请求（method/path/query/body/headers）→ router.dispatch →
 * 序列化响应（JSON 或 SSE）。业务逻辑一律不落此文件。
 *
 * 构建方式（D2）：esbuild 打包 --platform=node --format=cjs → functions/api/dist/server.js。
 * 注意：esbuild 的 cjs 输出中 `import.meta` 为空对象（已实测），故「是否作为入口直接运行」
 * 改用 process.argv[1] 的 basename 判定（server.js / server.ts），
 * 该判定在 vitest（argv[1]=vitest.mjs）下恒为 false，测试导入本模块不会自动监听端口。
 *
 * SSE（契约 §9）：手写 chunked 写出（res.write + flushHeaders），不依赖任何框架；
 * 流开始前的错误 → 普通 JSON 错误体；流开始后的异常 → event:error + event:done（D11）。
 */

import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { basename } from 'node:path';

import { createAppContext } from './context';
import type { AppContext, Headers } from './context';
import type { DbKind } from './db';
import { ERROR_CODES, toHttpStatus } from './errors';
import { dispatch, isAsyncGenerator } from './router';
import type { SseEvent } from './router';

export const DEFAULT_API_PORT = 8787;

export interface ApiServerOptions {
  port?: number;
  rootDir?: string;
  storeDir?: string;
  dbKind?: DbKind;
  /** 复用已有上下文（测试注入临时库）。 */
  context?: AppContext;
  /** 屏蔽启动日志（测试用）。 */
  quiet?: boolean;
}

interface ParsedBody {
  body: Record<string, unknown>;
  error?: string;
}

async function readBody(req: IncomingMessage): Promise<ParsedBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw.length === 0) return { body: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { body: {}, error: '请求体必须是 JSON 对象' };
    }
    return { body: parsed as Record<string, unknown> };
  } catch {
    return { body: {}, error: '请求体不是合法 JSON' };
  }
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

/** SSE 事件写出：`event: <name>\ndata: <json>\n\n`（契约 §9 事件序列）。 */
function writeSseEvent(res: ServerResponse, event: SseEvent): void {
  res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: AppContext,
  port: number,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) query[key] = value;

  const parsed = await readBody(req);
  if (parsed.error) {
    writeJson(res, ERROR_CODES.BAD_REQUEST, {
      code: ERROR_CODES.BAD_REQUEST,
      msg: parsed.error,
      data: null,
    });
    return;
  }

  const result = await dispatch(
    {
      method: req.method ?? 'GET',
      path: url.pathname,
      query,
      body: parsed.body,
      headers: req.headers as Headers,
    },
    ctx,
  );

  if (isAsyncGenerator(result)) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    try {
      for await (const event of result) writeSseEvent(res, event);
    } catch {
      // 流已开始：不改状态码，按契约输出用户可读降级话术后收尾（禁止白屏）
      writeSseEvent(res, {
        event: 'error',
        data: { msg: '对话服务暂时不可用，你可以先把这题拍照发我，我看看你卡在哪一步。' },
      });
      writeSseEvent(res, { event: 'done', data: {} });
    }
    res.end();
    return;
  }

  // 二进制响应（图片等）
  if (typeof result === 'object' && result !== null && (result as { __binary?: boolean }).__binary) {
    const binary = result as { mime: string; buffer: Buffer };
    res.writeHead(200, {
      'Content-Type': binary.mime,
      'Content-Length': binary.buffer.length,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(binary.buffer);
    return;
  }

  writeJson(res, toHttpStatus(result.code), result);
}

/** 创建（未监听）HTTP server；测试可直接 listen(0) 取随机端口。 */
export async function createApiServer(options: ApiServerOptions = {}): Promise<Server> {
  const ctx = options.context ?? (await createAppContext(options));
  const port = options.port ?? DEFAULT_API_PORT;
  return createServer((req, res) => {
    void handleRequest(req, res, ctx, port).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!res.headersSent) {
        writeJson(res, ERROR_CODES.INTERNAL, {
          code: ERROR_CODES.INTERNAL,
          msg: `服务器内部错误：${message}`,
          data: null,
        });
      } else {
        res.end();
      }
    });
  });
}

/** 创建并监听。 */
export async function startApiServer(
  options: ApiServerOptions = {},
): Promise<{ server: Server; port: number; ctx: AppContext }> {
  const ctx = options.context ?? (await createAppContext(options));
  const server = await createApiServer({ ...options, context: ctx });
  const port = options.port ?? DEFAULT_API_PORT;

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  if (!options.quiet) {
    console.log(`[zhiwei-api] listening on http://localhost:${actualPort}`);
  }
  return { server, port: actualPort, ctx };
}

/**
 * 入口判定：esbuild 的 cjs 输出无 import.meta，故用 argv[1] 文件名判定。
 * 仅当本模块被 `node functions/api/dist/server.js`（或 ts 直跑）作为入口时自启动。
 */
function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const file = basename(entry);
  return file === 'server.js' || file === 'server.ts';
}

async function bootstrap(): Promise<void> {
  const port = Number(process.env.ZHIWEI_API_PORT ?? DEFAULT_API_PORT);
  const { server, port: actualPort } = await startApiServer({ port });
  const shutdown = () => {
    console.log('\n[zhiwei-api] shutting down');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.log(`[zhiwei-api] ready (port=${actualPort})`);
}

if (isDirectRun()) {
  void bootstrap().catch((error: unknown) => {
    console.error('[zhiwei-api] failed to start:', error);
    process.exit(1);
  });
}
