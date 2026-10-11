/**
 * 全站页头复核探针（2026-10-11 style-10 迁移 P12.3 收尾）。
 *
 * 【为什么需要它（如实说明）】
 * P12.3 要求「D24 页头无双 h1 逐页目验」。tools/responsive-audit.cjs 的采样字段里
 * **没有 h1 计数**（历史口径，改它会牵动作废既有 v2-baseline 比较，与 P9.2/P10.2 同口径），
 * 故按 6.5 惯例另起一个「只取证、不下结论」的探针：一条命令把一个（宽度 × 主题）组合下的
 * 14 条学端路由逐页量一遍页头。
 *
 * 【它采什么】每个（宽度 × 主题）组合一份 h1check-<宽>-<主题>.json，routes[] 逐页：
 *   overflowPx    = documentElement.scrollWidth - clientWidth（判据 0）
 *   h1AllCount    = 整页 h1 数（D24 判据 1：既无外壳通用页头、也无双页头）
 *   h1All         = 各 h1 文本（人工核对是哪一份页头）
 *   h1MainCount   = main 内 h1 数（页面自有页头）
 *   shellHeaderH1 = <header> 内 h1 数（外壳标题栏；Layout 的 header 在 main 内，故与 main 计数同源）
 *   textLen       = main 文本长度（页面确实渲染了的粗判据，防空页误判）
 * 覆盖 14 条路由：/login（未登录态）与 /（门户，未登录态）先量，其余 12 条登录后量
 * （/t 教师三页不在本探针覆盖内 —— 由 tools/probe-teacher-states.cjs 的 4 档 × 双主题
 *  32 状态承担，见 P11.2–P11.4 走查产物）。
 *
 * 【纪律】只读只取证：不写业务代码、不新建空间（D23 只挑不建）、不造假态。
 * 产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 25s，防 60s SIGKILL）：
 *   ZHIWEI_H1_THEME=light ZHIWEI_H1_WIDTH=1440 node tools/probe-h1-sweep.cjs
 *   ... 换主题 / 宽度逐条；宽度取 1440/1024/768/375。
 * 环境变量：ZHIWEI_H1_BASE / ZHIWEI_H1_THEME / ZHIWEI_H1_WIDTH / ZHIWEI_H1_OUT /
 *   ZHIWEI_H1_IDENT / ZHIWEI_H1_PASS / ZHIWEI_H1_CDP_PORT / ZHIWEI_H1_CHROME
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ZHIWEI_H1_BASE ?? 'http://127.0.0.1:5173';
const THEME = process.env.ZHIWEI_H1_THEME === 'light' ? 'light' : 'dark';
const WIDTH = Number(process.env.ZHIWEI_H1_WIDTH ?? 1440);
const HEIGHT = WIDTH >= 768 ? 900 : 812;
const OUT =
  process.env.ZHIWEI_H1_OUT ?? path.join(__dirname, '..', '_pipeline', 'screenshots', 'style10');
const IDENT = process.env.ZHIWEI_H1_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_H1_PASS ?? 'e2e_test_2026';
const PORT = Number(process.env.ZHIWEI_H1_CDP_PORT ?? 9499); // 避开既有 9333/9334/9444/9455/9456/9466/9477/9488
const PROFILE = path.join(os.tmpdir(), `zhiwei-h1-probe-${PORT}`);

/** 路由表：先量未登录可访问的两条，再登录量其余（与产品 guardPath 语义对齐）。 */
const ANON_ROUTES = ['/login', '/'];
const AUTH_ROUTES = [
  '/assessment',
  '/paper',
  '/chat',
  '/practice',
  '/attribution',
  '/graph',
  '/report',
  '/drive',
  '/me',
  '/self-report',
  '/spaces',
  '/start',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logLines = [];
function say(line) {
  logLines.push(String(line));
  console.log(line);
}

function findBrowser() {
  const candidates = [
    process.env.ZHIWEI_H1_CHROME,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Edge/Chrome（可用 ZHIWEI_H1_CHROME 指定）');
}

/** 极简 CDP 客户端（写法沿用 tools/probe-start-states.cjs）。 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('CDP WebSocket 连接失败'));
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`页面内求值失败：${res.exceptionDetails.text ?? 'unknown'}`);
    }
    return res.result ? res.result.value : undefined;
  }
}

async function pageWsUrl() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('等不到 CDP page target');
}

const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const text = (el) => ((el && (el.textContent || '').trim()) || '');
  const all = [...document.querySelectorAll('h1')];
  const mainH1 = [...document.querySelectorAll('main h1')];
  const headerH1 = [...document.querySelectorAll('header h1')];
  const main = document.querySelector('main');
  return JSON.stringify({
    hash: location.hash,
    route: location.hash.replace(/^#/, '').split('?')[0],
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    h1AllCount: all.length,
    h1All: all.map(text),
    h1MainCount: mainH1.length,
    shellHeaderH1: headerH1.length,
    textLen: main ? (main.innerText || '').length : 0,
  });
})()`;

async function main() {
  const bin = findBrowser();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const child = spawn(
    bin,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  say(`browser = ${bin}`);
  say(`base    = ${BASE}`);
  say(`theme   = ${THEME}`);
  say(`width   = ${WIDTH} × ${HEIGHT}`);
  say('');

  const cdp = await Cdp.attach(await pageWsUrl());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: WIDTH < 768,
  });
  // 先落到应用源（about:blank 上没有 localStorage，会 Uncaught），再写主题键：
  // 主题在登录前先落盘，保证首条 /login 也是目标主题（与其它探针的取景一致）。
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=h1-boot` });
  await sleep(2500);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);

  const routes = [];
  const measure = async (route, auth) => {
    await sleep(2400);
    const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
    const row = { ...data, route, auth };
    routes.push(row);
    const flag = data.overflowPx === 0 && data.h1AllCount === 1 ? 'ok ' : '!! ';
    say(
      `  ${flag}${route.padEnd(24)} 落入=${(data.route || '(空)').padEnd(24)} ` +
        `溢出=${String(data.overflowPx).padStart(4)}px h1=${data.h1AllCount} ` +
        `(main ${data.h1MainCount} / header ${data.shellHeaderH1}) textLen=${data.textLen}` +
        (data.h1AllCount === 1 ? ` h1Text="${data.h1All[0]}"` : ` h1Text=${JSON.stringify(data.h1All)}`),
    );
  };

  // ── 1. 未登录态两条：/login（守卫不弹回，因为此刻无 token）与门户 / ──
  say('== 未登录态 ==');
  for (const r of ANON_ROUTES) {
    await cdp.send('Page.navigate', { url: `${BASE}/?probe=h1-${Date.now()}#${r}` });
    await measure(r, false);
  }

  // ── 2. 登录 + 复用账号既有活跃空间（D23：只挑不建） ──
  const auth = JSON.parse(
    await cdp.evaluate(`(async () => {
      const body = JSON.stringify({ identifier: '${IDENT}', password: '${PASS}' });
      const post = (p) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      let via = 'register';
      let j = await (await post('/api/auth/register')).json();
      if (j.code === 409) { via = 'login'; j = await (await post('/api/auth/login')).json(); }
      if (j.code !== 0) return JSON.stringify({ ok: false, code: j.code, msg: j.msg });
      localStorage.setItem('zhiwei_token', j.data.token);
      localStorage.setItem('zhiwei_user_id', j.data.user_id);
      const r = await fetch('/api/space/list', { headers: { Authorization: 'Bearer ' + j.data.token } });
      const s = await r.json();
      const list = (s.data && s.data.spaces) || [];
      if (!list.length) return JSON.stringify({ ok: false, reason: 'no-space' });
      localStorage.setItem('zhiwei_active_space', list[0].space_id);
      localStorage.setItem('zhiwei_theme', '${THEME}');
      return JSON.stringify({ ok: true, via, count: list.length, space: list[0].space_id, spaceName: list[0].name });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say('');
  say(`auth    = via=${auth.via} 空间数=${auth.count} 活跃=${auth.spaceName}`);
  say('');

  say('== 登录态 ==');
  for (const r of AUTH_ROUTES) {
    await cdp.send('Page.navigate', { url: `${BASE}/?probe=h1-${Date.now()}#${r}` });
    await measure(r, true);
  }

  const jsonFile = path.join(OUT, `h1check-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        tag: 'h1check',
        width: WIDTH,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, space: auth.space, spaceName: auth.spaceName },
        routes,
      },
      null,
      1,
    ),
    'utf8',
  );

  const bad = routes.filter((r) => r.overflowPx !== 0 || r.h1AllCount !== 1);
  say('');
  say(`→ ${path.relative(path.join(__dirname, '..'), jsonFile)}`);
  say(
    `routes=${routes.length}  overflowPx 全 0 = ${routes.every((r) => r.overflowPx === 0)}  ` +
      `h1 全 1 = ${routes.every((r) => r.h1AllCount === 1)}  不合规路由数=${bad.length}`,
  );

  fs.writeFileSync(path.join(OUT, `last-h1check-${WIDTH}-${THEME}-log.txt`), logLines.join('\n'), 'utf8');
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
