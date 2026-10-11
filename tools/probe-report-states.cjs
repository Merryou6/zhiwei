/**
 * /report 四态取证探针（2026-10-11 style-10 迁移 P6 走查用）。
 *
 * 【为什么单开一个探针而不是扩 responsive-audit.cjs】
 * 走查工具（tools/responsive-audit.cjs）的职责是「同一批路由 × 四档 × 双主题的
 * 几何采样」，它每个路由只采**默认态**一次。而 P6 的检查点⑤要求四态各有一张证据
 * （规范 §7 的整页级落位：loading / 失败 / 无空间 / 无数据）。四态不是「换个宽度」
 * 就能采到的，需要注入条件（请求挂起、请求失败、换一个没有数据的空间）——
 * 把这种一次性注入塞进几何采样主工具会污染它的判据。故按既有惯例
 * （tools/probe-dock-click.cjs、tools/probe-nav-rotate.cjs）另起一个**只取证、
 * 不下结论**的探针：它不打退出码，失败只打印原因。
 *
 * 【它怎么造出四态】
 *   error   —— `Page.addScriptToEvaluateOnNewDocument` 注入 fetch 包装，
 *              让 `/api/report/summary` 直接 reject（不碰任何业务代码、不改后端）。
 *   loading —— 同一手法，改为让该请求**永不落地**（返回 pending Promise），
 *              于是页面停在骨架态，可以截到。
 *   no-data —— 真实调 POST /api/space/create 建一个全新空间（无任何 profile/evidence），
 *              把它写进 localStorage 的活跃空间键后重新进入 /report。
 *   no-space——**采不到**：路由守卫（router.tsx 冻结区）在「已登录但无活跃空间」时
 *              直接重定向到 /spaces，故该分支只能由「已在页内时空间被清空」触发。
 *              本探针如实记录这一点，不伪造截图（见 R12 口径）。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），再跑：
 *   ZHIWEI_STATE_THEME=light node tools/probe-report-states.cjs
 * 环境变量：
 *   ZHIWEI_STATE_BASE（默认 http://127.0.0.1:5173）
 *   ZHIWEI_STATE_THEME（dark 缺省 / light）
 *   ZHIWEI_STATE_WIDTH（默认 1440；<768 用 375 手机视口高度）
 *   ZHIWEI_STATE_OUT（默认 <仓库根>/_pipeline/screenshots/style10）
 *   ZHIWEI_STATE_IDENT / ZHIWEI_STATE_PASS（默认 e2e_smoke / e2e_test_2026）
 *   ZHIWEI_STATE_CDP_PORT（默认 9455，避开 e2e-smoke 9333 / 走查 9334 / dock 9444）
 *   ZHIWEI_STATE_CHROME（浏览器路径覆盖）
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ZHIWEI_STATE_BASE ?? 'http://127.0.0.1:5173';
const THEME = process.env.ZHIWEI_STATE_THEME === 'light' ? 'light' : 'dark';
const WIDTH = Number(process.env.ZHIWEI_STATE_WIDTH ?? 1440);
const HEIGHT = WIDTH >= 768 ? 900 : 812;
const OUT =
  process.env.ZHIWEI_STATE_OUT ?? path.join(__dirname, '..', '_pipeline', 'screenshots', 'style10');
const IDENT = process.env.ZHIWEI_STATE_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_STATE_PASS ?? 'e2e_test_2026';
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9455);
const PROFILE = path.join(os.tmpdir(), `zhiwei-state-probe-${PORT}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logLines = [];
function say(line) {
  logLines.push(String(line));
  console.log(line);
}

function findBrowser() {
  const candidates = [
    process.env.ZHIWEI_STATE_CHROME,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Edge/Chrome（可用 ZHIWEI_STATE_CHROME 指定）');
}

/** 极简 CDP 客户端（写法沿用 tools/responsive-audit.cjs）。 */
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

  async shot(file) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
    say(`  → ${file}`);
  }
}

/** 注入脚本：只拦 report/summary，其余请求原样放行。mode: 'fail' | 'hang'。 */
function reportSummaryPatch(mode) {
  return `
(() => {
  const orig = window.fetch;
  const blocked = (url) => String(url).indexOf('/api/report/summary') !== -1;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (blocked(url)) {
      ${mode === 'fail'
        ? "return Promise.reject(new TypeError('probe: report/summary 注入失败（模拟断网）'));"
        : 'return new Promise(function () {});'}
    }
    return orig.apply(this, arguments);
  };
})();
`;
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
  say(`out     = ${OUT}`);
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

  const name = (state) => path.join(OUT, `state-${WIDTH}-${THEME}-${state}.png`);

  // ── 0. 登录（真实接口）+ 写 localStorage（键与 router.STORAGE_KEYS 同源） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state#/login` });
  await sleep(2500);
  const login = await cdp.evaluate(`(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ${JSON.stringify(IDENT)}, password: ${JSON.stringify(PASS)} }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    const d = json.data ?? json;
    localStorage.setItem('zhiwei_token', d.token);
    localStorage.setItem('zhiwei_user_id', d.user_id);
    localStorage.setItem('zhiwei_role', d.role ?? 'student');
    localStorage.setItem('zhiwei_theme', ${JSON.stringify(THEME)});
    const list = await fetch('/api/space/list', { headers: { Authorization: 'Bearer ' + d.token } });
    const lb = await list.json();
    const spaces = (lb.data ?? lb).spaces ?? [];
    const sid = spaces[0] ? spaces[0].space_id : null;
    if (sid) localStorage.setItem('zhiwei_active_space', sid);
    return { ok: true, spaces: spaces.length, sid };
  })()`);
  say(`登录 = ${JSON.stringify(login)}`);
  if (!login || login.ok !== true || !login.sid) {
    say('!! 登录或取空间失败，四态无从注入');
    child.kill();
    process.exit(1);
  }

  // ── 1. 正常态（作为四态的对照，同时验证注入脚本还没生效） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state-normal#/report` });
  await sleep(3000);
  say('正常态：');
  await cdp.shot(name('normal'));

  // ── 2. loading 态（report/summary 永不落地） ──
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: reportSummaryPatch('hang'),
  });
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state-loading#/report` });
  await sleep(2000);
  say('loading 态（骨架）：');
  await cdp.shot(name('loading'));

  // ── 3. error 态（report/summary 注入失败 → 红章 + 真重试） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state-error#/report` }); // 仍是 hang 脚本
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: reportSummaryPatch('fail'),
  });
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state-error2#/report` });
  await sleep(3000);
  say('error 态（红章）：');
  await cdp.shot(name('error'));

  // ── 4. 无数据态（全新空间：无 profile / 无 evidence） ──
  const fresh = await cdp.evaluate(`(async () => {
    const token = localStorage.getItem('zhiwei_token');
    const res = await fetch('/api/space/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      // 名字带时间戳：同名空间服务端返回 409（首跑实测），重跑要能拿到一个全新空间。
      body: JSON.stringify({ knowledge_source: 'kb_math_cz', name: 'P6四态' + Date.now() }),
    });
    const json = await res.json();
    const d = json.data ?? json;
    const sid = d.space_id ?? (d.space && d.space.space_id) ?? null;
    if (sid) localStorage.setItem('zhiwei_active_space', sid);
    return { ok: res.ok, status: res.status, sid };
  })()`);
  say(`新建空间 = ${JSON.stringify(fresh)}`);
  if (fresh && fresh.sid) {
    await cdp.send('Page.navigate', { url: `${BASE}/?probe=p6state-nodata#/report` });
    await sleep(3000);
    say('无数据态（双空盒）：');
    await cdp.shot(name('no-data'));
  } else {
    say('!! 建空间失败，无数据态未取证');
  }

  // ── 5. 无空间态：守卫重定向，采不到（如实记录，不伪造） ──
  say('');
  say('无空间态：**探针不采** —— router.guardPath 在「已登录 + 无活跃空间」时');
  say('  直接把 /report 重定向到 /spaces（router.tsx 属冻结区）。该分支只在');
  say('  「页面已挂载时空间被清空」这一路径下出现，故无导航取证方式（R12 口径）。');

  child.kill();
  fs.writeFileSync(
    path.join(OUT, `last-state-probe-${WIDTH}-${THEME}-log.txt`),
    logLines.join('\n'),
    'utf8',
  );
  process.exit(0);
}

main().catch((err) => {
  say(`!! 探针异常：${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
