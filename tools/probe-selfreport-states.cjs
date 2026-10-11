/**
 * /self-report 走查与状态取证探针（2026-10-11 style-10 迁移 P10.3）。
 *
 * 【为什么需要它】P10.3 的验收要求两条：①「提交后已记录态实拍」（原型 L2033-2036 的
 * bp-stamp-ok 回执）；② 规范 §7 self-report 行为「无四态」（提交失败走 toast），但 D24 的
 * 「页面顶部单 h1、无外壳通用页头残留」必须在真浏览器里复核。responsive-audit.cjs 只采
 * 「进页默认态」的几何与截图（且不量 h1），采不到「已记录态」，故按 6.5 惯例另起一个
 * 「只取证、不下结论」的探针（复用 tools/probe-spaces-states.cjs 的 CDP 写法）。
 *
 * 【它采什么】每个（宽度 × 主题）组合三个状态 + 量尺：
 *   normal    —— 进页默认态（8 章 × 5 档全部未选）
 *   picked    —— 点「按 3 档先填上」一键加速（真点按钮，走真实 React 路径）
 *   submitted —— **真提交**：第一行选「03 会一点，会晃」→ 点「提交自报」→ 等服务端
 *                POST /api/evidence/self-report 返回 → 已记录态（bp-stamp-ok 回执）
 * 每个状态都量 overflowPx（判据 0）、main h1 数（D24 页头复核：应恰好 1 个）与页面锚点。
 *
 * 【纪律】只读只取证：不写业务代码、不伪造数据。**唯一的真实副作用是 self-report 提交**：
 *   它按契约只写 mastery_profiles 的先验（p_l0 / mastery），**不写 evidence_events**
 *   （functions/api/src/services/selfReport.ts 明写），且只针对「还没有观测证据」的知识点；
 *   每次只提交第一行的 03 档（可重复覆盖，幂等）。每组的实际 updated 计数如实写进 JSON。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-selfreport-states.cjs
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9488); // 避开 9477/9333/9334/9444/9455/9456/9466
const PROFILE = path.join(os.tmpdir(), `zhiwei-selfreport-probe-${PORT}`);

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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 三个状态各自的锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : '';
  const rows = main ? main.querySelectorAll('table.bp-tbl tbody tr') : [];
  const radios = main ? main.querySelectorAll('table.bp-tbl input[type="radio"]') : [];
  const checked = main ? main.querySelectorAll('table.bp-tbl input[type="radio"]:checked') : [];
  const ok = main ? main.querySelector('.bp-stamp-ok') : null;
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-04') !== -1,
    eyebrow: text.indexOf('SELF REPORT') !== -1,
    rows: rows.length,
    radios: radios.length,
    checked: checked.length,
    stampOk: !!ok,
    received: !!ok && text.indexOf('RECEIVED') !== -1,
    updatedText: ok ? (ok.innerText || '').replace(/\\s+/g, ' ').slice(0, 160) : null,
    exits: []
      .concat(ok ? [...ok.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) : [])
      .filter(Boolean),
    buttons: main ? [...main.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean) : [],
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
  const measureAndShot = async (state, note) => {
    const raw = await cdp.evaluate(MEASURE_JS);
    const data = JSON.parse(raw);
    data.state = state;
    data.note = note ?? null;
    data.width = WIDTH;
    data.height = HEIGHT;
    data.theme = THEME;
    states.push(data);
    say(
      `  ${state.padEnd(10)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
        `章节行=${data.rows} 档位钮=${data.radios} 已选=${data.checked} 绿章=${data.stampOk}`,
    );
    if (data.updatedText) say(`     回执：${data.updatedText}`);
    await cdp.shot(path.join(OUT, `self-report-${WIDTH}-${THEME}-${state}.png`));
  };

  // ── 0. 登录 + 记录账号既有空间（D23：只挑不建；本页不新建空间） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p103selfreport#/login` });
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
        activeSpace: list[0].space_id,
      });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} 空间数=${auth.count} 激活=${auth.activeSpace}`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);

  // ── 1. normal：进页默认态 ──
  say('== 状态取证 ==');
  const url = () => `${BASE}/?probe=p103selfreport-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#/self-report`;
  await cdp.send('Page.navigate', { url: url() });
  await sleep(2600);
  await measureAndShot('normal', '进页默认态：8 章 × 5 档全部未选');

  // ── 2. picked：点「按 3 档先填上」一键加速（真点按钮） ──
  const filled = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => (b.textContent || '').indexOf('按 3 档先填上') !== -1);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(700);
  say(`  点「按 3 档先填上」=${filled}`);
  await measureAndShot('picked', '一键加速：真实点击「按 3 档先填上」按钮');

  // ── 3. submitted：重新进页 → 第一行选 03 档 → 真提交 → 已记录态 ──
  await cdp.send('Page.navigate', { url: url() });
  await sleep(2600);
  const picked = await cdp.evaluate(`(() => {
    const row = document.querySelector('main table.bp-tbl tbody tr');
    if (!row) return false;
    const radios = row.querySelectorAll('input[type="radio"]');
    if (radios.length < 3) return false;
    radios[2].click();   // 03 会一点，会晃（QUICK_LEVEL 同档）
    return radios[2].checked;
  })()`);
  await sleep(500);
  say(`  第一行选 03 档=${picked}`);
  const submitted = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => {
      const t = (b.textContent || '').trim();
      return t === '提交自报' || t === '正在记下…';
    });
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(2200);
  say(`  点「提交自报」=${submitted}`);
  await measureAndShot('submitted', '真实提交：第一行 03 档 → POST /api/evidence/self-report（只写先验，不写 evidence_events）');

  const jsonFile = path.join(OUT, `self-report-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/self-report',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, count: auth.count, names: auth.names, activeSpace: auth.activeSpace },
        // D23 记账：本页无空间新建；唯一副作用是 self-report 先验写入（幂等，只写第一行 03 档）
        sideEffects: {
          createdSpace: null,
          spaceCountBefore: auth.count,
          selfReportSubmits: 1,
          selfReportScope: '第一行章节 × 03 档（先验 p_l0，不写 evidence_events）',
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
  const done = states.find((s) => s.state === 'submitted');
  say(`已记录态取证：绿章=${!!done?.stampOk} RECEIVED=${!!done?.received}`);

  fs.writeFileSync(
    path.join(OUT, `last-selfreport-probe-${WIDTH}-${THEME}-log.txt`),
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
