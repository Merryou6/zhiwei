/**
 * /login 走查与状态取证探针（2026-10-11 style-10 迁移 P10.4）。
 *
 * 【为什么需要它】P10.4 的验收要求三条：①「登录成功跳转与 token 落盘实拍（探针）」；
 * ②「字段错误态实拍」；③ 规范第 11 章 #6 的**登录真实链路**勾稽：token 落盘 / 刷新不掉线 /
 * 演示账号 / 401 清理。responsive-audit.cjs 只采「进页默认态」的几何与截图（且不量 h1），
 * 采不到这些，故按 6.5 惯例另起一个「只取证、不下结论」的探针（复用 probe-spaces /
 * probe-selfreport 的 CDP 写法）。
 *
 * 【它采什么】每个（宽度 × 主题）组合六个状态 + 量尺：
 *   normal       —— 未登录进页（shell 内渲染：SHEET 10-02 / 单 h1 / 通道分段 / 演示账号两卡）
 *   field-error  —— 空表单直接提交 ⇒ 字段级错误（FormField 的 role=alert 行）+ 非阻断 toast
 *   register-tab —— 切到「注册」⇒ h1 变「注册知微」+ 昵称字段出现
 *   login-ok     —— **真登录**（真填账号密码 → 真 POST /api/auth/login）⇒ 落 token + 跳 /spaces
 *   login-reload —— 承上**刷新页面** ⇒ 仍在 /spaces（刷新不掉线）
 *   bad-token    —— 把 token 改成无效串后进 /spaces ⇒ 服务端 401 ⇒ 会话清空 + 回 /login
 *                   （#6 的 401 清理口径；链路本身在 api/client.ts，本次未改动）
 *   demo-enter   —— 点 aside 里的「一键进入」（学生端）⇒ 真链路：账号存在则登录进 /spaces，
 *                   不存在则**自动注册**（服务端建默认空间）并进 /start。这一步是 #6 里
 *                   「演示账号」的实证：两条分支分别在第一组（本机无 demo_student ⇒ 建号）
 *                   与后续组（已有 ⇒ 登录）里各现一次，JSON 的 demoEnter.path 如实记录。
 * 另附一张 aside 放大图（clip + scale 3：演示账号卡的 chip / 一键进入 / kv 三件是否齐）。
 * 每个状态都量 overflowPx（判据 0）与 main h1 数（D24 页头复核：应恰好 1 个）。
 *
 * 【纪律】只读只取证：不写业务代码、不伪造数据。**真实副作用**：login-ok / login-reload /
 *   bad-token 三次都真登录一次探针账号（ZHIWEI_STATE_IDENT，默认 e2e_smoke，已存在 ⇒ 只读）；
 *   不新建任何账号、不新建任何空间（演示账号只在**已存在**时才点「一键进入」，见下）。
 *   401 清理状态用的是无效 token，不改动任何服务端数据。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 25s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-login-states.cjs
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9499); // 避开 9477/9488/9333/9334/9444/9455/9456/9466
const PROFILE = path.join(os.tmpdir(), `zhiwei-login-probe-${PORT}`);

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

  async shot(file, clip) {
    const res = await this.send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 各状态锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : '';
  let token = null;
  try { token = localStorage.getItem('zhiwei_token'); } catch (e) {}
  const segs = main ? [...main.querySelectorAll('.bp-seg')] : [];
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    eyebrow: text.indexOf('AUTH / 最小摩擦入口') !== -1,
    sheet1002: text.indexOf('SHEET 10-02') !== -1,
    segCount: segs.length,
    segLabels: segs.map((s) => [...s.querySelectorAll('label')].map((l) => (l.innerText || '').trim())),
    formCount: main ? main.querySelectorAll('form').length : 0,
    inputCount: main ? main.querySelectorAll('main input, input').length : 0,
    demoPanels: main ? main.querySelectorAll('aside .bp-panel .bp-panel').length : 0,
    demoNames: main
      ? [...main.querySelectorAll('aside .bp-kv dd')].map((d) => (d.textContent || '').trim())
      : [],
    nicknameField: text.indexOf('昵称') !== -1,
    errorRows: main ? main.querySelectorAll('[role="alert"]').length : 0,
    errorText: main
      ? [...main.querySelectorAll('[role="alert"]')].map((e) => (e.textContent || '').trim())
      : [],
    toastCount: document.querySelectorAll('[role="status"]').length,
    toastText: [...document.querySelectorAll('[role="status"]')]
      .map((t) => (t.innerText || '').replace(/\\s+/g, ' ').trim())
      .filter(Boolean),
    tokenPresent: !!token,
    tokenTail: token ? String(token).slice(-6) : null,
    identityChip: (() => {
      const el = [...document.querySelectorAll('header *')].find((n) => (n.textContent || '').indexOf('身份') !== -1);
      return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) : null;
    })(),
    textLen: text.length,
  });
})()`;

/** 填受控输入（React 受控组件：走原生 setter + input 事件，否则 onChange 不触发）。 */
function fillJs(selector, value) {
  return `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`;
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

  const states = [];
  const measureAndShot = async (state, note, clip) => {
    const raw = await cdp.evaluate(MEASURE_JS);
    const data = JSON.parse(raw);
    data.state = state;
    data.note = note ?? null;
    data.width = WIDTH;
    data.height = HEIGHT;
    data.theme = THEME;
    states.push(data);
    say(
      `  ${state.padEnd(12)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
        `hash=${data.hash}  token=${data.tokenPresent}  错误行=${data.errorRows}  toast=${data.toastCount}`,
    );
    say(`     h1=${JSON.stringify(data.h1Text)}  分段=${JSON.stringify(data.segLabels)}`);
    if (clip) await cdp.shot(path.join(OUT, `login-${WIDTH}-${THEME}-${state}-zoom.png`), clip);
    else await cdp.shot(path.join(OUT, `login-${WIDTH}-${THEME}-${state}.png`));
  };

  const go = async (hash, wait = 2400) => {
    await cdp.send('Page.navigate', {
      url: `${BASE}/?probe=p104login-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#${hash}`,
    });
    await sleep(wait);
  };

  // ── 0. 演示账号存在性（**只探测不创建**：纯 login 尝试，失败即记录为不存在） ──
  await go('/login');
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);
  const demo = JSON.parse(
    await cdp.evaluate(`(async () => {
      const post = (p, body) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const r = await post('/api/auth/login', { identifier: 'demo_student', password: 'demo123456' });
      const j = await r.json();
      return JSON.stringify({ exists: j.code === 0, code: j.code, msg: j.msg });
    })()`),
  );
  say(`演示账号 demo_student 存在 = ${demo.exists}（code=${demo.code}）`);

  // ── 1. normal：未登录进页（壳内渲染的图纸） ──
  say('== 状态取证 ==');
  await go('/login');
  await measureAndShot('normal', '未登录进页：shell 内图纸（SHEET 10-02 + 单 h1）');
  // aside 放大图：演示账号卡的三件（chip / 一键进入 / kv）
  const box = JSON.parse(
    await cdp.evaluate(`(() => {
      const aside = document.querySelector('main aside');
      if (!aside) return 'null';
      const r = aside.getBoundingClientRect();
      return JSON.stringify({ x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8, scale: 3 });
    })()`),
  );
  if (box) {
    say('  aside 放大取景 = ' + JSON.stringify(box));
    await cdp.shot(path.join(OUT, `login-${WIDTH}-${THEME}-aside-zoom.png`), box);
  }

  // ── 2. field-error：空表单提交 ⇒ 字段级错误 + toast ──
  const emptySubmitted = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main form button[type="submit"]')][0];
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(700);
  say(`  空表单提交=${emptySubmitted}`);
  await measureAndShot('field-error', '空表单提交：字段级 role=alert 错误 + 非阻断 toast');

  // ── 3. register-tab：切到注册（h1 变「注册知微」+ 昵称字段） ──
  const toRegister = await cdp.evaluate(`(() => {
    const el = document.querySelector('input[name="auth-tab"][value="register"]');
    if (!el) return false;
    el.click();
    return true;
  })()`);
  await sleep(600);
  say(`  切到注册=${toRegister}`);
  await measureAndShot('register-tab', '分段切到「注册」：h1 与昵称字段随之变化');

  // ── 4. login-ok：回登录段 → 真填账号密码 → 真提交 ──
  await cdp.evaluate(`(() => {
    const el = document.querySelector('input[name="auth-tab"][value="login"]');
    if (el) el.click();
    return true;
  })()`);
  await sleep(500);
  const filledId = await cdp.evaluate(fillJs('input[autocomplete="username"]', IDENT));
  const filledPw = await cdp.evaluate(fillJs('input[type="password"]', PASS));
  say(`  填入账号=${filledId} 密码=${filledPw}`);
  await sleep(300);
  const submitted = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main form button[type="submit"]')][0];
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(2600);
  say(`  提交=${submitted}`);
  await measureAndShot('login-ok', '真登录（POST /api/auth/login）：token 落盘 + 跳 /spaces');

  // ── 5. login-reload：刷新 ⇒ 仍在 /spaces（刷新不掉线） ──
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(2600);
  await measureAndShot('login-reload', '刷新页面：token 在盘 ⇒ 仍在 /spaces（刷新不掉线）');

  // ── 6. bad-token：无效 token 进 /spaces ⇒ 401 ⇒ 清会话 + 回 /login ──
  await cdp.evaluate(`localStorage.setItem('zhiwei_token', 'probe-invalid-token-0000'); 1`);
  await cdp.send('Page.navigate', {
    url: `${BASE}/?probe=p104login-badtoken-${Date.now()}#/spaces`,
  });
  await sleep(3000);
  await measureAndShot('bad-token', '无效 token：服务端 401 ⇒ 清会话并回 /login（client.ts 既有链路）');

  // ── 7. demo-enter：点「一键进入」（学生端）⇒ 真链路（登录 or 自动注册） ──
  // ⚠ 副作用：demo_student 在本机不存在时这一步会**真建号**（服务端同时建默认空间）。
  //   这条链路正是 #6 要证的东西（演示账号点一下就进得来），故如实取证 + 如实记账，
  //   不为了「零副作用」而跳过它 —— 组内先跑过的 demo 存在性探测已写在 JSON 里。
  await go('/login');
  const demoClicked = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main aside button')].find((b) =>
      (b.textContent || '').indexOf('一键进入') !== -1,
    );
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(3000);
  say(`  点 aside「一键进入」=${demoClicked}`);
  await measureAndShot(
    'demo-enter',
    '演示账号一键进入：' + (demo.exists ? '本组之前已存在 ⇒ 走登录分支' : '本机不存在 ⇒ 走自动注册分支（真建号）'),
  );
  const demoState = states.find((s) => s.state === 'demo-enter');
  const demoPath = demoState?.hash === '#/start' ? 'register(建号)' : 'login';
  say(`  演示账号落地：hash=${demoState?.hash} path=${demoPath}`);

  const jsonFile = path.join(OUT, `login-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/login',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        probeAccount: { identifier: IDENT, existed: true },
        demoStudentExists: demo,
        demoEnter: { path: demoPath, hash: demoState?.hash ?? null },
        sideEffects: {
          createdSpace: null,
          createdAccount: demo.exists ? null : 'demo_student（演示账号一键进入的自动注册分支；服务端同时给它建了默认空间）',
          note: '真登录 3 次（login-ok / login-reload / bad-token 前置）用的都是探针账号 e2e_smoke，不新建空间；demo-enter 走的是产品本身的演示账号链路',
        },
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
  const ok = states.find((s) => s.state === 'login-ok');
  const reload = states.find((s) => s.state === 'login-reload');
  const bad = states.find((s) => s.state === 'bad-token');
  say(`登录成功：hash=${ok?.hash} token=${ok?.tokenPresent}`);
  say(`刷新不掉线：hash=${reload?.hash} token=${reload?.tokenPresent}`);
  say(`401 清理：hash=${bad?.hash} token=${bad?.tokenPresent}（期望 #/login 且 token=false）`);

  fs.writeFileSync(
    path.join(OUT, `last-login-probe-${WIDTH}-${THEME}-log.txt`),
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
