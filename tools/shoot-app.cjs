/**
 * 真实前端整页截图（视觉验收用）：零依赖 CDP + 真实 Chrome。
 *
 * 【为什么需要它】
 * 2026-09-23 把 dusk 主题换血到 B 端控制台原型（zhiwei-console）的色世界后，
 * 需要把真实页面与原型截图逐页比对。本脚本登录真实账号、走真实后端数据，
 * 对 7 个页面（登录 + 原型对应的 6 页）截全页高清图，并抽查关键令牌的
 * 计算值（顶栏底色 / 正文底色 / 卡片底色），确认换血真的生效。
 *
 * 【怎么用】
 *   先起服务：npm run all
 *   再截图：  node tools/shoot-app.cjs
 *
 * 【环境变量】（与 e2e-smoke 同名同默认）
 *   ZHIWEI_E2E_BASE    前端地址，默认 http://127.0.0.1:5173
 *   ZHIWEI_E2E_IDENT   测试账号，默认 e2e_smoke（不存在则自动注册）
 *   ZHIWEI_E2E_PASS    测试密码，默认 e2e_test_2026
 *   ZHIWEI_APP_SHOTS   截图输出目录，默认 <仓库>/reports/app-shots
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJ = path.resolve(__dirname, '..');
const BASE = process.env.ZHIWEI_E2E_BASE ?? 'http://127.0.0.1:5173';
const IDENT = process.env.ZHIWEI_E2E_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_E2E_PASS ?? 'e2e_test_2026';
const OUT = process.env.ZHIWEI_APP_SHOTS ?? path.join(PROJ, 'reports', 'app-shots');
const LOG = path.join(OUT, 'report.txt');
const PORT = Number(process.env.ZHIWEI_E2E_CDP_PORT ?? 9337);
const W = 1600;
const H = 1000;

const log = [];
function flush(line) {
  if (line !== undefined) log.push(line);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(LOG, log.join('\n'), 'utf8');
  } catch {
    /* ignore */
  }
}
process.on('uncaughtException', (e) => {
  flush('!! UNCAUGHT: ' + (e.stack || e));
  process.exit(1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.ZHIWEI_E2E_CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Chrome/Edge，可用 ZHIWEI_E2E_CHROME 指定路径');
}

/** 极简 CDP 客户端（与 tools/e2e-smoke.cjs 同款）。 */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.exceptions = [];
  }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('CDP WebSocket 连接失败'));
    });
    const client = new CDP(ws);
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id && client.pending.has(msg.id)) {
        const p = client.pending.get(msg.id);
        client.pending.delete(msg.id);
        if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
        else p.res(msg.result);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        client.exceptions.push((d.exception && d.exception.description) || d.text || 'unknown');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        client.exceptions.push('[console.error] ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (msg.method) {
        const waiters = client.events.get(msg.method) || [];
        client.events.set(msg.method, []);
        waiters.forEach((w) => w(msg.params));
      }
    };
    return client;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method) {
    return new Promise((res) => {
      const arr = this.events.get(method) || [];
      arr.push(res);
      this.events.set(method, arr);
    });
  }
  async ev(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chromePath = findChrome();
  flush('base   = ' + BASE);
  flush('chrome = ' + chromePath);
  flush('shots  = ' + OUT);

  const profile = path.join(os.tmpdir(), 'zhiwei-shoot-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${W},${H}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let targets = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      targets = list.filter((t) => t.type === 'page');
      if (targets.length) break;
    } catch {
      await sleep(300);
    }
  }
  if (!targets || !targets.length) throw new Error('CDP 页面目标不可用');
  const cdp = await CDP.attach(targets[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });

  let seq = 0;
  async function shot(name, waitMs) {
    seq += 1;
    await sleep(waitMs);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(png.data, 'base64'));
    flush(`  [SHOT] ${name}.png  (${Math.round(png.data.length / 1024)} KiB)`);
  }
  async function goto(url) {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(6000)]);
  }

  // ① 登录页（未登录态，全新 profile 自动落在 #/login）
  await goto(`${BASE}/?shoot=login#/login`);
  await shot('01-login', 3200); // 粒子聚拢动画给足时间

  // ② 登录拿 token（经 vite 代理走真实后端）
  async function post(pathname) {
    return fetch(BASE + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: IDENT, password: PASS, nickname: '截图验收' }),
    });
  }
  let j = await (await post('/api/auth/register')).json();
  if (j.code === 409) j = await (await post('/api/auth/login')).json();
  if (!j.data || !j.data.token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 200));
  await cdp.ev(`localStorage.setItem('zhiwei_token','${j.data.token}'); localStorage.setItem('zhiwei_user_id','${j.data.user_id}'); 1`);

  // 取默认空间并落 activeSpace
  const list = await (
    await fetch(BASE + '/api/space/list', { headers: { Authorization: 'Bearer ' + j.data.token } })
  ).json();
  const spaceId = list.data?.spaces?.[0]?.space_id;
  if (spaceId) await cdp.ev(`localStorage.setItem('zhiwei_active_space','${spaceId}'); 1`);

  // ③ 六个主页面（每页唯一 query，确保触发 load 事件）
  const pages = [
    ['02-spaces', '#/spaces', 1400],
    ['03-assessment', '#/assessment', 1400],
    ['04-chat', '#/chat', 1600],
    ['05-graph', '#/graph', 2600], // echarts canvas 需要更久
    ['06-report', '#/report', 1600],
    ['07-drive', '#/drive', 1400],
  ];
  for (const [name, hash, wait] of pages) {
    await goto(`${BASE}/?shoot=${name}#${hash.slice(1)}`);
    await shot(name, wait);
  }

  // ④ 令牌计算值抽查（换血是否真生效的硬证据）
  await goto(`${BASE}/?shoot=tokens#/report`);
  await sleep(1200);
  const tokens = await cdp.ev(`(() => {
    const pick = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
    return JSON.stringify({
      bodyBg: getComputedStyle(document.body).backgroundColor,
      topbarBg: pick('header', 'backgroundColor'),
      cardBg: pick('.bg-surface', 'backgroundColor'),
      canvas: getComputedStyle(document.documentElement).getPropertyValue('--c-canvas').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--c-surface').trim(),
      canvasDeep: getComputedStyle(document.documentElement).getPropertyValue('--c-canvas-deep').trim(),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim(),
      htmlDusk: document.documentElement.className,
    });
  })()`);
  flush('  [TOKENS] ' + tokens);

  flush(cdp.exceptions.length ? '!! JS 异常 ' + cdp.exceptions.length + ' 条:\n' + cdp.exceptions.join('\n') : 'JS 异常: 0');
  flush('DONE');

  try {
    chrome.kill();
  } catch {
    /* ignore */
  }
  process.exit(cdp.exceptions.length ? 1 : 0);
}

main().catch((e) => {
  flush('!! ' + (e.stack || e));
  process.exit(1);
});
