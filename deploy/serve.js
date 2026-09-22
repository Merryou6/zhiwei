#!/usr/bin/env node
/**
 * 知微 · 单容器运行入口（部署件，非业务代码）
 *
 * 职责（一个进程全包）：
 *   1. 以子进程启动本地 API server（functions/api/dist/server.js，容器内 127.0.0.1:${ZHIWEI_API_PORT}）
 *   2. 对外监听 ${PORT}（默认 8080）：
 *      - /api/*   → 反代到 API 子进程（流式 pipe 直通，SSE 不缓冲——已实测可用）
 *      - /healthz → 容器健康检查（API 子进程存活即 200）
 *      - 其余     → apps/web/dist 静态文件（未命中回退 index.html）
 *
 * 设计约束：
 *   - 仅用 Node 标准库，运行镜像无需 npm install；
 *   - 不改任何业务代码（API 的「不设 CORS 头」由本层同源反代天然解决）；
 *   - 优雅退出：SIGTERM 先停外层再停子进程（docker stop 不丢已落盘数据——JSON 存储为同步写）。
 *
 * 环境变量：
 *   PORT              对外端口（默认 8080）
 *   ZHIWEI_API_PORT   容器内 API 端口（默认 8787，一般不动）
 *   ZHIWEI_SERVER_SECRET  token 签名密钥（必设！未设回落开发密钥——容器会打印警告）
 *   其余 ZHIWEI_* 透传给 API 子进程
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);
const API_PORT = Number(process.env.ZHIWEI_API_PORT || 8787);
const STATIC_DIR = path.join(ROOT, 'apps', 'web', 'dist');
const API_ENTRY = path.join(ROOT, 'functions', 'api', 'dist', 'server.js');

if (!process.env.ZHIWEI_SERVER_SECRET) {
  console.warn('[zhiwei][警告] 未设置 ZHIWEI_SERVER_SECRET，将回落到开发密钥——任何人可伪造登录态！上线必设（见 deploy/DEPLOY.md）');
}

// ------------------------------------------------------------ 1) API 子进程
const api = spawn(process.execPath, [API_ENTRY], {
  cwd: ROOT,
  env: { ...process.env, ZHIWEI_API_PORT: String(API_PORT), ZHIWEI_ROOT: ROOT },
  stdio: ['ignore', 'inherit', 'inherit'],
});
api.on('exit', (code) => {
  console.error(`[zhiwei] API 子进程退出（code=${code}），容器终止`);
  process.exit(code === null ? 1 : code);
});

// ------------------------------------------------------------ 2) 静态 + 反代
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function proxy(req, res) {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` },
    },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: 502, msg: '后端暂时不可用，稍后再试一次', data: null }));
    } else {
      res.end();
    }
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    /* 保持 '/' */
  }
  let filePath = path.normalize(path.join(STATIC_DIR, pathname));
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }
  const ext = path.extname(filePath);
  // vite 产物带内容 hash（index-XXXX.js）→ 一年强缓存；HTML 不缓存，保证发版即生效
  const immutable = /-[A-Za-z0-9_-]{8,}\.(js|css|woff2?)$/.test(path.basename(filePath));
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) return proxy(req, res);
  if (req.url.split('?')[0] === '/healthz') {
    const alive = api.exitCode === null;
    res.writeHead(alive ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: alive, api: alive ? 'up' : 'down' }));
    return;
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`[zhiwei] http://localhost:${PORT}  (api → 127.0.0.1:${API_PORT}，静态 → ${STATIC_DIR})`);
});

// ------------------------------------------------------------ 3) 优雅退出
function shutdown() {
  console.log('[zhiwei] 收到停止信号，关闭中…');
  server.close(() => process.exit(0));
  api.kill('SIGTERM');
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
