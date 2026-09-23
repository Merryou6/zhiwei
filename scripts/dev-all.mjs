#!/usr/bin/env node
/**
 * 本地全栈一键启动：后端 API（8787）+ 前端 dev（5173）。
 *
 * 【为什么需要这个脚本】
 * 前端与后端是两个独立进程，缺一不可：
 *   - 前端页面所有请求走同源 `/api`（见 apps/web/src/api/client.ts），
 *     由 vite dev proxy 转发到 127.0.0.1:8787（apps/web/vite.config.ts）；
 *   - 后端没起时，代理转发会失败，页面只表现为「网络错误 / 加载失败」，
 *     不容易一眼看出根因是「另一个服务没启动」。
 * 把两件事绑成一条命令，避免这种排查成本。
 *
 * 用法：npm run all
 *
 * 环境变量：
 *   ZHIWEI_API_PORT  后端端口（默认 8787）
 *                   ⚠ 改它必须同步 apps/web/vite.config.ts 里的 proxy target，否则前端仍指向 8787
 *   ZHIWEI_ROOT      仓库根（默认本脚本所在目录的上一级）
 *
 * 零依赖：只用 node 内置模块。
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ZHIWEI_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = Number(process.env.ZHIWEI_API_PORT ?? 8787);
const WEB_PORT = 5173;
const IS_WIN = process.platform === 'win32';

/** 常驻服务进程（退出时统一收掉）。 */
const persistent = [];
let closing = false;

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of persistent) {
    try {
      child.kill();
    } catch {
      /* 已退出 */
    }
  }
  // 给子进程一点时间自己收尾
  setTimeout(() => process.exit(code), 400);
}

process.on('SIGINT', () => {
  process.stdout.write('\n收到中断，正在停止服务…\n');
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));

/** 把一个子进程的 stdout/stderr 按行加前缀转发到父进程。 */
function pipeWithPrefix(name, child) {
  const prefix = `[${name}] `;
  const forward = (stream, isErr) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);
        if (line.trim().length > 0) {
          (isErr ? process.stderr : process.stdout).write(prefix + line + '\n');
        }
      }
    });
  };
  forward(child.stdout, false);
  forward(child.stderr, true);
}

function spawnChild(name, command, args, { keep = false } = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    // Windows 上 npm 是 npm.cmd，必须经 shell 才能解析；参数都是固定的，无注入面。
    shell: IS_WIN,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  pipeWithPrefix(name, child);
  if (keep) {
    child.on('exit', (code, signal) => {
      if (closing) return;
      process.stderr.write(`\n[${name}] 进程退出（code=${code} signal=${signal}）—— 全栈随之停止\n`);
      shutdown(code ?? 1);
    });
    persistent.push(child);
  }
  return child;
}

/** 端口是否可绑定（用于启动前的占用预检）。 */
function isPortFree(port) {
  return new Promise((resolveCheck) => {
    const probe = createServer();
    probe.once('error', () => resolveCheck(false));
    probe.once('listening', () => probe.close(() => resolveCheck(true)));
    probe.listen(port, '127.0.0.1');
  });
}

function runOnce(name, command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnChild(name, command, args);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${name} 失败（exit=${code}）`));
    });
  });
}

async function main() {
  process.stdout.write('\n知微 · 本地全栈启动\n');
  process.stdout.write(`  仓库根：${ROOT}\n\n`);

  // —— 端口预检：先给出人能看懂的提示，而不是让子进程抛一堆栈 ——
  const conflicts = [];
  for (const [label, port] of [
    ['后端 API', API_PORT],
    ['前端 dev', WEB_PORT],
  ]) {
    if (!(await isPortFree(port))) conflicts.push(`${label} 端口 ${port} 已被占用`);
  }
  if (conflicts.length > 0) {
    process.stderr.write('启动中止：\n');
    for (const c of conflicts) process.stderr.write(`  · ${c}\n`);
    process.stderr.write('\n多半是上一次的服务还在跑。查占用（Windows）：\n');
    process.stderr.write(`  netstat -ano | findstr :${API_PORT}\n`);
    process.stderr.write('  taskkill /PID <上面最后一列的数字> /F\n\n');
    process.exit(1);
  }

  // —— 1) 构建后端：dist 与源码不同步会表现为「改了代码却没生效」——
  process.stdout.write('[build] 构建后端 functions/api/dist/server.js …\n');
  try {
    await runOnce('build', IS_WIN ? 'npm' : 'npm', ['run', 'build:api']);
  } catch (error) {
    process.stderr.write(`\n后端构建失败：${error.message}\n`);
    process.exit(1);
  }
  process.stdout.write('[build] 完成\n\n');

  // —— 2) 起后端（用当前 node，避免依赖 PATH 里的 node 版本）——
  spawnChild('api', process.execPath, ['functions/api/dist/server.js'], { keep: true });

  // —— 3) 起前端 dev（走 package.json 的 dev 脚本，跟随其配置）——
  spawnChild('web', 'npm', ['run', 'dev'], { keep: true });

  process.stdout.write('\n──────────────────────────────────────────────\n');
  process.stdout.write(`  前端    http://127.0.0.1:${WEB_PORT}\n`);
  process.stdout.write(`  后端    http://127.0.0.1:${API_PORT}   （/api 由前端同源代理转发）\n`);
  process.stdout.write(`  数据    ${ROOT}/data/local_db/*.json（首次启动自动创建）\n`);
  process.stdout.write('\n  Ctrl+C 同时停止两个服务\n');
  process.stdout.write('──────────────────────────────────────────────\n\n');
}

main().catch((error) => {
  process.stderr.write(`启动失败：${error && error.stack ? error.stack : error}\n`);
  shutdown(1);
});
