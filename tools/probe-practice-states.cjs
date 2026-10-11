/**
 * /practice 走查与状态取证探针（2026-10-11 style-10 迁移 P9.2）。
 *
 * 【为什么需要它（如实说明）】
 * tools/responsive-audit.cjs 的 ROUTES 表是 11 页的**历史口径**（login / self-report /
 * spaces / assessment / paper / chat / attribution / graph / report / drive / me），
 * **不含 /practice**（该表最后一次改动在本轮之前；脚本头注释也写明「页数变更后须重采
 * 基线」）。本轮 P9.2 要给 /practice 出 T0 四档 × 双主题的 overflowPx 硬判据证据，
 * 但**不动那张表**（改它会连带作废既有 v2-baseline 比较口径，属扩大范围）——
 * 故按 6.5 惯例另起一个「只取证、不下结论」的探针：复用 responsive-audit 的 CDP 写法，
 * 只测这一页的三个状态，逐档逐主题输出 overflowPx + 截图 + 一份机器可读 JSON。
 *
 * 【它采什么】每个（宽度 × 主题）组合五个状态：
 *   normal   —— 进页默认态（STAGE 1 选章）
 *   concept  —— 展开「本章概念卡」后（默认收起，展开是最深的一屏）
 *   drill    —— 点「开始这一组」后的分步书写态（拿不到梯子题时如实记 stage 未切换）
 *   hint-l1  —— 分步态下开提示链 L1「给个方向」（逐级解锁第一级）
 *   hint-l2  —— 再开 L2「再给点思路」（第二级；L2 在 L1 未开时 disabled，如实记 hintOpen）
 * 每个状态都量 `documentElement.scrollWidth - clientWidth`（overflowPx 判据）与
 * h1 数量 / 文本（D24 页头复核：应恰好 1 个）。
 *
 * 【纪律】只读只取证：不写业务代码、不造假态、不新建空间（D23：复用账号既有空间）；
 * 产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-practice-states.cjs
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9466); // 避开 9333/9334/9444/9455/9456
const PROFILE = path.join(os.tmpdir(), `zhiwei-practice-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-graph-states.cjs）。 */
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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 当前阶段的可读文本锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const main = document.querySelector('main');
  const text = main ? (main.innerText || '') : '';
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-08') !== -1,
    hasStepper: text.indexOf('阶梯：由易到难') !== -1,
    /* 阶段判据用分节条右侧的 STAGE n / 3（角标），不用正文词：select 页的 eyebrow 里
       也有「分步书写」四个字，按词判会把三态全判成 ladder（首跑实测踩到）。 */
    stage: text.indexOf('STAGE 3 / 3') !== -1 ? 'summary' : text.indexOf('STAGE 2 / 3') !== -1 ? 'ladder' : 'select',
    stepCards: document.querySelectorAll('.bp-step').length,
    /* 提示链解锁层级：0 未开 · 1 L1（给个方向）· 2 L2（再给点思路）。两个 radio 用
       checked={hintLevel >= n} 表达，故按「已 checked 的最高一级」计。 */
    hintOpen: (() => {
      const b = document.querySelector('input[name="hint-level"][value="2"]');
      const a = document.querySelector('input[name="hint-level"][value="1"]');
      return b && b.checked ? 2 : a && a.checked ? 1 : 0;
    })(),
    conceptPanel: !!document.getElementById('concept-panel'),
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

  const measureAndShot = async (state) => {
    const raw = await cdp.evaluate(MEASURE_JS);
    const data = JSON.parse(raw);
    data.state = state;
    data.width = WIDTH;
    data.height = HEIGHT;
    data.theme = THEME;
    states.push(data);
    say(
      `  ${state.padEnd(8)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  stage=${data.stage}`,
    );
    await cdp.shot(path.join(OUT, `practice-${WIDTH}-${THEME}-${state}.png`));
  };

  // ── 0. 登录 + 复用账号既有活跃空间（D23：只挑不建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p92practice#/login` });
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
      const first = s.data && s.data.spaces && s.data.spaces[0];
      if (!first) return JSON.stringify({ ok: false, reason: 'no-space' });
      localStorage.setItem('zhiwei_active_space', first.space_id);
      return JSON.stringify({ ok: true, via, space: first.space_id, spaceName: first.name });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} space=${auth.space}（${auth.spaceName}）`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p92practice-${Date.now()}#/practice` });
  await sleep(2600);

  // ── 1. normal：进页默认态 ──
  say('== 状态取证 ==');
  await measureAndShot('normal');

  // ── 2. concept：展开本章概念卡（默认收起，展开是最深一屏） ──
  const opened = await cdp.evaluate(`(() => {
    const btn = document.getElementById('concept-toggle');
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(1400);
  say(`  concept-toggle=${opened}`);
  await measureAndShot('concept');

  // ── 3. drill：点「开始这一组」后的分步书写态（拿不到梯子题时如实记未切换） ──
  const started = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => (b.textContent || '').indexOf('开始这一组') !== -1 && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(3200);
  say(`  开始这一组=${started}`);
  await measureAndShot('drill');

  // ── 4/5. hint-l1 / hint-l2：提示链逐级解锁实拍（radio 点选，与真实用户路径一致） ──
  const openHint = async (level) => {
    const ok = await cdp.evaluate(`(() => {
      const el = document.querySelector('input[name="hint-level"][value="${level}"]');
      if (!el || el.disabled) return false;
      el.click();
      return true;
    })()`);
    await sleep(900);
    say(`  hint-L${level}=${ok}`);
  };
  await openHint(1);
  await measureAndShot('hint-l1');
  await openHint(2);
  await measureAndShot('hint-l2');

  const jsonFile = path.join(OUT, `practice-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/practice',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, space: auth.space, spaceName: auth.spaceName },
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
  say(`overflowPx 最大 ${worst}px（判据：0）`);

  fs.writeFileSync(path.join(OUT, `last-practice-probe-${WIDTH}-${THEME}-log.txt`), logLines.join('\n'), 'utf8');
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
