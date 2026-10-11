/**
 * /drive 走查与状态取证探针（2026-10-11 style-10 迁移 P10.6）。
 *
 * 【为什么需要它】P10.6 的验收要求规范 §7 library 行的**区域级四态**（loading / empty /
 * error / 正常）在真浏览器里有证可取，外加 noSpace 守卫链路取证。responsive-audit.cjs 只采
 * 「进页默认态」，采不到注入态，故按 6.5 惯例另起一个「只取证、不下结论」的探针。
 *
 * 【它采什么】每个（宽度 × 主题）组合四个状态：
 *   normal   —— 登录态进 /drive：SHEET 10-13 / 单 h1 / .bp-tbl 文件表（每行「只读」）+ 03 自定义库
 *   empty    —— 注入 /api/space/{id}/drive 的空集合 ⇒ 区域级空盒（.bp-empty）
 *   error    —— 注入 /api/space/{id}/drive 的失败响应（R12 口径）⇒ 区域级红章（.bp-stamp）
 *   no-space —— 清掉 zhiwei_active_space 后进 /drive ⇒ **守卫 guardPath 重定向到 /spaces**
 *               （R19：/drive 不在豁免名单，故 DrivePage 内的 noSpace 分支不可直接导航取到）
 *
 * 【纪律】只读只取证：不写业务代码、不伪造数据（empty/error 都是**状态注入**，在 JSON 的
 *   injected 字段如实标注）；不新建空间、不落任何证据。产物只增不删，落 screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=1440 node tools/probe-drive-states.cjs
 *   ... 换主题 / 宽度逐条；宽度取 1440/375（本页走查底线两档）。
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH /
 *   ZHIWEI_STATE_OUT / ZHIWEI_STATE_IDENT / ZHIWEI_STATE_PASS / ZHIWEI_STATE_CDP_PORT
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9522); // 避开 9477/9488/9511/9333/9334/9444
const PROFILE = path.join(os.tmpdir(), `zhiwei-drive-probe-${PORT}`);

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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 本页锚点。 */
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
    eyebrow: text.indexOf('LIBRARY / 只读资料') !== -1,
    sheet13: text.indexOf('SHEET 10-13') !== -1,
    tblRows: main ? main.querySelectorAll('.bp-tbl tbody tr').length : 0,
    hasTable: !!main && !!main.querySelector('.bp-tbl'),
    readOnlyText: (text.match(/只读/g) || []).length,
    relPanels: main ? main.querySelectorAll('li.bp-panel').length : 0,
    hasEmpty: !!main && !!main.querySelector('.bp-empty'),
    hasStamp: !!main && !!main.querySelector('.bp-stamp'),
    hasSkeleton: !!main && !!main.querySelector('[role="status"] .bp-hatch'),
    sections: main ? [...main.querySelectorAll('h2')].map((h) => (h.textContent || '').trim()) : [],
    textLen: text.length,
  });
})()`;

/**
 * 探针注入脚本（R12 口径）：只拦 /api/space/{id}/drive，按 sessionStorage 开关行事。
 *   fail  → 失败响应（error 态）
 *   empty → 空集合（empty 态）
 * 其它请求（含 reportSummary / auth）一律透传。
 */
const INJECT_JS = `(() => {
  const originalFetch = window.fetch.bind(window);
  const read = (key) => { try { return sessionStorage.getItem(key); } catch (e) { return null; } };
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const mode = read('__probe_drive_mode');
    if (mode && url.indexOf('/api/space/') !== -1 && url.indexOf('/drive') !== -1) {
      if (mode === 'fail') {
        return Promise.resolve(new Response(JSON.stringify({ code: 9002, msg: '探针注入：资料列表请求失败' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        }));
      }
      if (mode === 'empty') {
        return Promise.resolve(new Response(JSON.stringify({ code: 0, msg: 'ok', data: { files: [] } }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }));
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

  const states = [];
  const fileBase = `drive-${WIDTH}-${THEME}`;

  try {
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT_JS });

    const measureAndShot = async (state, injected) => {
      const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
      data.state = state;
      data.injected = injected ?? null;
      data.width = WIDTH;
      data.height = HEIGHT;
      data.theme = THEME;
      states.push(data);
      say(
        `  ${state.padEnd(10)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
          `表行=${data.tblRows}  空盒=${data.hasEmpty}  红章=${data.hasStamp}  骨架=${data.hasSkeleton}  ` +
          `相关块=${data.relPanels}  只读字=${data.readOnlyText}`,
      );
      say(`     h1=${JSON.stringify(data.h1Text)}  分节=${JSON.stringify(data.sections)}`);
      await cdp.shot(path.join(OUT, `${fileBase}-${state}.png`));
    };

    const go = async (hash, wait = 2600) => {
      await cdp.send('Page.navigate', {
        url: `${BASE}/?probe=p106drive-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#${hash}`,
      });
      await sleep(wait);
    };

    // ── 0. 鉴权（真登录）+ 取一个活跃空间（D23：只挑不建） ──
    await go('/login', 2000);
    await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);
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
        return JSON.stringify({ ok: true, via, spaceId: list[0].space_id, name: list[0].name });
      })()`),
    );
    if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
    say(`auth    = via=${auth.via} 空间=${auth.name}（${auth.spaceId}）`);

    // ── 1. normal：登录态进 /drive ──
    say('== 状态取证 ==');
    await cdp.evaluate(`sessionStorage.removeItem('__probe_drive_mode'); 1`);
    await go('/drive');
    await measureAndShot('normal', null);

    // ── 2. empty：注入空集合 ──
    await cdp.evaluate(`sessionStorage.setItem('__probe_drive_mode', 'empty'); 1`);
    await go('/drive');
    await measureAndShot('empty', 'inject:/api/space/{id}/drive=[]');

    // ── 3. error：注入失败响应 ──
    await cdp.evaluate(`sessionStorage.setItem('__probe_drive_mode', 'fail'); 1`);
    await go('/drive');
    await measureAndShot('error', 'inject:/api/space/{id}/drive=500');

    // ── 4. no-space：清掉当前空间 ⇒ 守卫重定向（R19 实测，非本页空盒） ──
    await cdp.evaluate(`sessionStorage.removeItem('__probe_drive_mode'); localStorage.removeItem('zhiwei_active_space'); 1`);
    await go('/drive');
    await measureAndShot('no-space', 'guard:router.tsx L120-121 redirect /drive→/spaces');
    await cdp.evaluate(`localStorage.setItem('zhiwei_active_space', '${auth.spaceId}'); 1`);

    const payload = {
      tag: 'drive',
      width: WIDTH,
      height: HEIGHT,
      theme: THEME,
      base: BASE,
      capturedAt: new Date().toISOString(),
      spaceId: auth.spaceId,
      spaceName: auth.name,
      states,
    };
    const file = path.join(OUT, `${fileBase}.json`);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(payload, null, 1), 'utf8');
    say('  → ' + path.relative(path.join(__dirname, '..'), file));
    fs.writeFileSync(path.join(os.tmpdir(), `${fileBase}.log`), logLines.join('\n'), 'utf8');
  } finally {
    child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
