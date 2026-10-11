/**
 * /start 走查取证探针（2026-10-11 style-10 迁移 P10.2）。
 *
 * 【为什么需要它（如实说明）】
 * tools/responsive-audit.cjs 的 ROUTES 表是 11 页的**历史口径**（login / self-report /
 * spaces / assessment / paper / chat / attribution / graph / report / drive / me），
 * **不含 /start**。本轮 P10.2 要给 /start 出「T1 两档（1440/375）× 双主题」的
 * overflowPx 硬判据证据，但**不动那张表**（改它会连带作废既有 v2-baseline 比较口径，
 * 与 P9.2 的处置同口径）—— 故按 6.5 惯例另起一个「只取证、不下结论」的探针。
 *
 * 【它采什么】每个（宽度 × 主题）组合一个状态（本页是**静态引导页**，规范 §7 明示无四态）：
 *   normal —— 登录态进页默认态；量 documentElement.scrollWidth - clientWidth（判据 0）、
 *             main h1 数（D24 页头复核：应恰好 1）、SHEET 10-03 是否在页、四条路径卡数。
 *
 * 【纪律】只读只取证：不写业务代码、不新建空间（D23 只挑不建）、不造假态。
 * 产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 15s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-start-states.cjs
 *   ... 换主题 / 宽度逐条；宽度取 1440/1024/768/375。
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH /
 *   ZHIWEI_STATE_OUT / ZHIWEI_STATE_IDENT / ZHIWEI_STATE_PASS /
 *   ZHIWEI_STATE_CDP_PORT / ZHIWEI_STATE_CHROME
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9488); // 避开 9333/9334/9444/9455/9456/9466/9477
const PROFILE = path.join(os.tmpdir(), `zhiwei-start-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-spaces-states.cjs）。 */
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
    say(`  → ${path.relative(path.join(__dirname, '..'), file)}`);
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
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : '';
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-03') !== -1,
    pathCards: main ? main.querySelectorAll('article.bp-panel').length : 0,
    ctaCount: main
      ? [...main.querySelectorAll('button')].filter((b) => (b.textContent || '').indexOf('进入这一步') !== -1).length
      : 0,
    textLen: text.length,
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

  // ── 登录 + 复用账号既有活跃空间（D23：只挑不建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p102start#/login` });
  await sleep(2500);
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
      return JSON.stringify({ ok: true, via, count: list.length, space: list[0].space_id, spaceName: list[0].name });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} 空间数=${auth.count} 活跃=${auth.spaceName}`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);

  // ── 进页：唯一状态（静态引导页，规范 §7 明示无四态） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p102start-${Date.now()}#/start` });
  await sleep(2600);
  const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
  say('== 状态取证 ==');
  say(
    `  normal     溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
      `SHEET10-03=${data.sheet10}  路径卡=${data.pathCards}  CTA=${data.ctaCount}`,
  );
  say(`  落入 = ${data.hash}`);
  await cdp.shot(path.join(OUT, `start-${WIDTH}-${THEME}-normal.png`));

  const jsonFile = path.join(OUT, `start-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/start',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, space: auth.space, spaceName: auth.spaceName },
        states: [{ ...data, state: 'normal', width: WIDTH, height: HEIGHT, theme: THEME }],
      },
      null,
      1,
    ),
    'utf8',
  );
  say('');
  say(`→ ${path.relative(path.join(__dirname, '..'), jsonFile)}`);
  say(`overflowPx ${data.overflowPx}px（判据：0）；main h1 = ${data.h1Count}（判据：1）`);

  fs.writeFileSync(path.join(OUT, `last-start-probe-${WIDTH}-${THEME}-log.txt`), logLines.join('\n'), 'utf8');
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
