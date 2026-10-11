/**
 * /spaces 走查与状态取证探针（2026-10-11 style-10 迁移 P10.1）。
 *
 * 【为什么需要它】P10.1 的验收要求两条：①「409 冲突专项（新建重名空间触发 ConfirmDialog
 * 实拍）」；② 规范 §7 spaces 行的**区域级四态**（loading / empty / error / 正常列表）落点
 * 在真浏览器里有证可取。responsive-audit.cjs 只采「进页默认态」的几何与截图，采不到这两条，
 * 故按 6.5 惯例另起一个「只取证、不下结论」的探针（复用 responsive-audit / probe-practice-
 * states 的 CDP 写法）。
 *
 * 【它采什么】每个（宽度 × 主题）组合四个状态 + 一个 409 专项：
 *   normal    —— 进页默认态（空间列表）
 *   conflict  —— **真触发**服务端 409：注入的 /api/space/list 在**真实响应**上滤掉一个已有
 *                空间名（模拟「store 的列表已过期」：本地重名预检读的正是 store 里那份列表）
 *                → 再在真表单里填那个已被占用的名字提交 ⇒ 真 POST /api/space/create
 *                ⇒ 服务端 409（真错误码 + 真 existing_space_id）⇒ ConfirmDialog 实拍。
 *                ⚠ 这不是伪造 409 响应：create 走的是真实接口与真实判定；只有 list 被滤过。
 *                ⚠ 这样触发**不新建任何空间**（D23 只挑不建）—— 早前一版探针靠「先建一个
 *                  重名空间制造过期」，那会往账号里落一个探针空间，已改掉。
 *   list-fail —— 注入 /api/space/list 的失败响应（R12 口径的 error 态探针注入）⇒ 区域级红章
 *   list-empty—— 注入 /api/space/list 的空集合响应 ⇒ 区域级空盒
 * 每个状态都量 overflowPx（判据 0）与 main h1 数（D24 页头复核：应恰好 1 个）。
 *
 * 【纪律】只读只取证：不写业务代码、不伪造数据（list-fail / list-empty / list-stale 都是
 * **状态注入**，在 JSON 的 injected 字段里如实标注；conflict 的 409 由真实 create 接口判定）。
 * 本探针**不新建任何空间**（D23 只挑不建），只在 sessionStorage 里放一个目标名。
 * 产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-spaces-states.cjs
 *   ... 换主题 / 宽度逐条；宽度取 1440/375（本页走查底线两档）。
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9477); // 避开 9333/9334/9444/9455/9456/9466
const PROFILE = path.join(os.tmpdir(), `zhiwei-spaces-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-practice-states.cjs）。 */
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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 四个状态各自的锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
  const text = main ? main.innerText || '' : '';
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-05') !== -1,
    cards: main ? main.querySelectorAll('ul > li.bp-panel').length : 0,
    activeCard: main ? main.querySelectorAll('li.bp-panel[data-active="1"]').length : 0,
    hasEmpty: !!main && !!main.querySelector('.bp-empty'),
    hasStamp: !!main && !!main.querySelector('.bp-stamp'),
    hasSkeleton: !!main && !!main.querySelector('[role="status"] .bp-hatch'),
    createForm: !!main && !!main.querySelector('input[name="space-stage"]'),
    dialogOpen: !!dialog,
    dialogTitle: dialog ? ((dialog.querySelector('h2') || {}).textContent || '').trim() : '',
    dialogButtons: dialog
      ? [...dialog.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
      : [],
    textLen: text.length,
  });
})()`;

/**
 * 探针注入脚本（R12 口径）：只拦 /api/space/list，按 sessionStorage 的开关行事。
 *   fail  → 直接给失败响应（error 态）
 *   empty → 给空集合（empty 态）
 *   stale → **先拿真实响应**，再滤掉 __probe_stale_name 那一条（正常列表 + store 过期）
 * 其它请求（含 space/create）一律透传 —— 409 必须是真服务端判的。
 */
const INJECT_JS = `(() => {
  const originalFetch = window.fetch.bind(window);
  const read = (key) => { try { return sessionStorage.getItem(key); } catch (e) { return null; } };
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const mode = read('__probe_space_list_mode');
    if (mode && url.indexOf('/api/space/list') !== -1) {
      if (mode === 'fail') {
        return Promise.resolve(new Response(JSON.stringify({ code: 9001, msg: '探针注入：空间列表请求失败' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (mode === 'empty') {
        return Promise.resolve(new Response(JSON.stringify({ code: 0, msg: 'ok', data: { spaces: [] } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (mode === 'stale') {
        const target = read('__probe_stale_name');
        return originalFetch(input, init).then((res) => res.json()).then((j) => {
          const spaces = (j && j.data && j.data.spaces) || [];
          const kept = spaces.filter((s) => s.name !== target);
          return new Response(JSON.stringify({ code: 0, msg: 'ok', data: { spaces: kept } }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        });
      }
    }
    return originalFetch(input, init);
  };
  return 1;
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
  // 注入脚本必须在**每次导航的新文档**里先生效（应用的取数发生在挂载时）。
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT_JS });

  const states = [];
  const measureAndShot = async (state, injected) => {
    const raw = await cdp.evaluate(MEASURE_JS);
    const data = JSON.parse(raw);
    data.state = state;
    data.injected = injected ?? null;
    data.width = WIDTH;
    data.height = HEIGHT;
    data.theme = THEME;
    states.push(data);
    say(
      `  ${state.padEnd(10)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
        `卡片=${data.cards} 空盒=${data.hasEmpty} 红章=${data.hasStamp} 骨架=${data.hasSkeleton} ` +
        `对话框=${data.dialogOpen}`,
    );
    await cdp.shot(path.join(OUT, `spaces-${WIDTH}-${THEME}-${state}.png`));
  };

  // ── 0. 登录 + 记录账号既有空间（D23：只挑不建；本页之外不新建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p101spaces#/login` });
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
      return JSON.stringify({
        ok: true, via, count: list.length, names: list.map((x) => x.name),
        activeSpace: list[0].space_id, token: j.data.token,
      });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} 空间数=${auth.count} 名称=${JSON.stringify(auth.names)}`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);

  // ── 1. normal：进页默认态（此时 store 里的空间列表就是服务端那份） ──
  say('== 状态取证 ==');
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p101spaces-${Date.now()}#/spaces` });
  await sleep(2600);
  await measureAndShot('normal');

  // ── 2. conflict：注入「store 过期」的列表，再在真表单里提交那个被滤掉的已有名字 ──
  // 目标名取账号里真实存在的第一个空间名 ⇒ create 一定被服务端判 409。
  const target = auth.names[0];
  await cdp.evaluate(`sessionStorage.setItem('__probe_stale_name', ${JSON.stringify(target)}); 1`);
  await cdp.evaluate(`sessionStorage.setItem('__probe_space_list_mode', 'stale'); 1`);
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p101spaces-stale-${Date.now()}#/spaces` });
  await sleep(2600);
  say(`  注入 stale 列表（滤掉「${target}」）后进页`);

  const typed = await cdp.evaluate(`(() => {
    const form = document.querySelector('main form');
    const input = form && form.querySelector('input[type="text"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(target)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  say(`  表单填入已被占用的名字=${typed}`);
  await sleep(400);
  const submitted = await cdp.evaluate(`(() => {
    const form = document.querySelector('main form');
    const btn = form && form.querySelector('button[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(1800);
  say(`  提交=${submitted}`);
  await measureAndShot('conflict', '409 由真实 POST /api/space/create 判定；list 注入 stale（滤掉目标名）');

  const cancelled = await cdp.evaluate(`(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!d) return false;
    const btn = [...d.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '取消');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(600);
  say(`  点「取消」关闭对话框=${cancelled}`);

  // 复核：这次提交没有多出空间（409 被服务端拒绝；本探针不新建空间）
  // ⚠ 复核前必须撤掉 stale 注入，否则这次 list 请求也会被滤掉，读到的不是服务端真相。
  await cdp.evaluate(`sessionStorage.removeItem('__probe_space_list_mode'); 1`);
  const after = JSON.parse(
    await cdp.evaluate(`(async () => {
      const r = await fetch('/api/space/list', { headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') } });
      const j = await r.json();
      const list = (j.data && j.data.spaces) || [];
      return JSON.stringify({ count: list.length, names: list.map((x) => x.name) });
    })()`),
  );
  say(`  复核：空间数 ${auth.count} → ${after.count}（409 那次未落库；探针不新建空间）`);
  say(`  复核名称 = ${JSON.stringify(after.names)}`);

  // ── 3. list-fail：注入列表失败 ⇒ 区域级红章（R12 口径的状态注入） ──
  await cdp.evaluate(`sessionStorage.setItem('__probe_space_list_mode', 'fail'); 1`);
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p101spaces-fail-${Date.now()}#/spaces` });
  await sleep(2600);
  await measureAndShot('list-fail', 'error 态为探针注入（/api/space/list 返回 500）');

  // ── 4. list-empty：注入空集合 ⇒ 区域级空盒（R12 口径的状态注入） ──
  await cdp.evaluate(`sessionStorage.setItem('__probe_space_list_mode', 'empty'); 1`);
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p101spaces-empty-${Date.now()}#/spaces` });
  await sleep(2600);
  await measureAndShot('list-empty', 'empty 态为探针注入（/api/space/list 返回空集合）');

  const jsonFile = path.join(OUT, `spaces-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/spaces',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, count: auth.count, names: auth.names, activeSpace: auth.activeSpace },
        // D23 只挑不建：本探针不新建空间（conflict 靠 stale 列表注入 + 真实 409 判定）
        sideEffects: { createdSpace: null, countBefore: auth.count, countAfter: after.count },
        states,
      },
      null,
      1,
    ),
    'utf8',
  );
  say('');
  say(`→ ${path.relative(path.join(__dirname, '..'), jsonFile)}`);
  const worst = states.reduce((m, s) => Math.max(m, s.overflowPx), 0);
  const h1bad = states.filter((s) => s.h1Count !== 1).map((s) => `${s.state}:${s.h1Count}`);
  say(`overflowPx 最大 ${worst}px（判据：0）`);
  say(`h1 ≠ 1 的状态：${h1bad.length ? h1bad.join(', ') : '无'}`);
  say(`409 对话框实拍：${states.find((s) => s.state === 'conflict')?.dialogOpen ? '出现' : '未出现'}`);

  fs.writeFileSync(
    path.join(OUT, `last-spaces-probe-${WIDTH}-${THEME}-log.txt`),
    logLines.join('\n'),
    'utf8',
  );
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
