/**
 * 对话面板 dock 点击穿透探针（2026-09-25 用户实测 bug #1 的回归闸门）。
 *
 * 【为什么单测盖不住】
 * Bug 是 pointer-events 命中测试层面的：ChatPanelDock 的 fixed inset-x-0 wrapper
 * 在常驻态（≥1280 无幕布）仍是铺满视口的可交互表面，替面板挡住全页点击。
 * jsdom 不做命中测试，vitest 里 DOM 与 CSS 全对、浏览器里照样点不动 ——
 * 只有真浏览器的 elementFromPoint / Input.dispatchMouseEvent 能证伪。
 *
 * 【它验证什么】（1440×900 常驻态 + 1100×900 覆盖态）
 *   A1 wrapper computed pointer-events = none（修复本体）
 *   A2 面板外正文点的 elementFromPoint 落回探针按钮（不是 wrapper/幕布）
 *   A3 真鼠标事件点正文探针 → onclick 被触发（穿透 = 可交互，不只是"看得见"）
 *   A4 面板本体 elementFromPoint 落在 aside 内（wrapper 解禁不能把面板也解没）
 *   B1 覆盖态幕布存在且盖住正文点（elementFromPoint = 幕布按钮，压出正确）
 *   B2 真点击幕布 → 面板关闭（aside 从 DOM 移除）
 *
 * 【怎么用】
 *   先起服务：npm run all
 *   再跑探针：node tools/probe-dock-click.cjs
 *   退出码 0 = 全过；1 = 有失败。报告与截图写 <tmp>/zhiwei-dock-probe/。
 *
 * 【环境变量】
 *   ZHIWEI_DOCK_BASE      前端地址，默认 http://127.0.0.1:5173
 *   ZHIWEI_DOCK_IDENT / ZHIWEI_DOCK_PASS  复用 e2e 测试账号口径
 *   ZHIWEI_DOCK_CDP_PORT  CDP 端口，默认 9444（避开 e2e-smoke 的 9333）
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ZHIWEI_DOCK_BASE ?? 'http://127.0.0.1:5173';
const IDENT = process.env.ZHIWEI_DOCK_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_DOCK_PASS ?? 'e2e_test_2026';
const OUT = path.join(os.tmpdir(), 'zhiwei-dock-probe');
const LOG = path.join(OUT, 'report.txt');
const PORT = Number(process.env.ZHIWEI_DOCK_CDP_PORT ?? 9444);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logLines = [];
function flush(line) {
  if (line !== undefined) logLines.push(line);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(LOG, logLines.join('\n'), 'utf8');
  } catch {
    /* ignore */
  }
}

function findBrowser() {
  const candidates = [
    process.env.ZHIWEI_E2E_CHROME,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Edge/Chrome');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
  }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('CDP WS 连接失败'));
    });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const p = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
        else p.res(msg.result);
        return;
      }
      if (msg.method) {
        (c.events.get(msg.method) || []).forEach((w) => w(msg.params));
        c.events.set(msg.method, []);
      }
    };
    return c;
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
    if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  }
  async click(x, y) {
    // 真输入事件（不是 el.click()）：完整走 hit-test → 派发，pointer-events 生效路径
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
}

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    flush('  [OK]   ' + name);
  } else {
    fail += 1;
    flush('  [FAIL] ' + name + (detail ? '   → ' + String(detail).slice(0, 240) : ''));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browserPath = findBrowser();
  const profile = path.join(os.tmpdir(), 'zhiwei-dock-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--no-sandbox', // 受限沙箱内 Chromium 自身沙箱会 SIGTRAP（同 e2e-smoke 注释）
      '--hide-scrollbars',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(300);
    }
  }
  if (!version) {
    flush('!! 浏览器未就绪');
    browser.kill();
    process.exit(1);
  }
  flush('browser = ' + version.Browser + '   base = ' + BASE);
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = await CDP.attach(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  async function goto(url) {
    const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
    await cdp.send('Page.navigate', { url });
    await loaded;
    await sleep(800);
  }

  try {
    // 鉴权（与 e2e-smoke 同法：register 撞 409 则 login）
    await goto(`${BASE}/?dock=1#/login`);
    const auth = await cdp.ev(`(async () => {
      const body = JSON.stringify({ identifier: '${IDENT}', password: '${PASS}' });
      const post = (p) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      let j = await (await post('/api/auth/register')).json();
      if (j.code === 409) j = await (await post('/api/auth/login')).json();
      if (j.code !== 0) return 'fail:' + j.code;
      localStorage.setItem('zhiwei_token', j.data.token);
      localStorage.setItem('zhiwei_user_id', j.data.user_id);
      return 'ok';
    })()`);
    flush('auth = ' + auth);
    if (auth !== 'ok') throw new Error('鉴权失败：' + auth);

    await goto(`${BASE}/?dock=2#/spaces`);
    await sleep(600);

    // 注入探针：正文左侧的 fixed 按钮（z 低于 overlay 档），命中它 = 点击真的落到正文
    await cdp.ev(`(() => {
      const b = document.createElement('button');
      b.id = 'zw-dock-probe';
      b.textContent = 'P';
      b.style.cssText = 'position:fixed;left:400px;top:400px;width:80px;height:48px;z-index:1';
      b.onclick = () => { window.__probeHit = (window.__probeHit || 0) + 1; };
      document.body.appendChild(b);
      return 1;
    })()`);

    // 打开面板（点顶栏「对话辅导」特判按钮，1440 ⇒ docked 常驻态）
    const opened = await cdp.ev(`(() => {
      const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('对话辅导'));
      if (!btn) return 'no-btn';
      btn.click();
      return btn.getAttribute('aria-pressed');
    })()`);
    await sleep(500);
    flush('panel toggle aria-pressed(before click) = ' + opened);
    await cdp.ev(`(async () => new Promise(r => setTimeout(r, 350)))()`);

    const state = await cdp.ev(`(() => {
      const aside = document.querySelector('aside[aria-label="对话辅导面板"]');
      const wrapper = aside ? aside.parentElement : null;
      const pe = wrapper ? getComputedStyle(wrapper).pointerEvents : null;
      const hit = document.elementFromPoint(440, 424); // 探针按钮中心
      const hitInPanel = aside ? aside.contains(document.elementFromPoint(1440 - 200, 500)) : false;
      return {
        aside: !!aside,
        wrapperPointerEvents: pe,
        hitId: hit ? hit.id || hit.tagName + '.' + (hit.className || '').slice(0, 40) : null,
        hitInPanel,
      };
    })()`);
    flush('docked state = ' + JSON.stringify(state));

    flush('\n=== 常驻态（1440，无幕布）===');
    check('A0 面板已挂载（aside 存在）', state.aside === true, JSON.stringify(state));
    check('A1 wrapper pointer-events = none（bug#1 修复本体）', state.wrapperPointerEvents === 'none', 'got=' + state.wrapperPointerEvents);
    check('A2 正文点 elementFromPoint = 探针按钮（不再被 wrapper 拦截）', state.hitId === 'zw-dock-probe', 'got=' + state.hitId);
    check('A4 面板本体仍可交互（aside 内命中测试正常）', state.hitInPanel === true);

    await cdp.click(440, 424);
    await sleep(250);
    const hitCount = await cdp.ev('window.__probeHit || 0');
    check('A3 真鼠标点正文探针 → onclick 触发（穿透可交互）', hitCount >= 1, 'hits=' + hitCount);

    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, 'docked-1440.png'), Buffer.from(s.data, 'base64'));

    flush('\n=== 覆盖态（1100，幕布压出）===');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(600);
    const cover = await cdp.ev(`(() => {
      const aside = document.querySelector('aside[aria-label="对话辅导面板"]');
      const scrim = document.querySelector('button[aria-label="点击空白处关闭对话面板"]');
      const hit = document.elementFromPoint(300, 500);
      return {
        aside: !!aside,
        scrim: !!scrim,
        hitIsScrim: !!scrim && scrim === hit,
      };
    })()`);
    flush('cover state = ' + JSON.stringify(cover));
    check('B0 面板在覆盖态仍展开', cover.aside === true);
    check('B1 幕布存在且盖住正文点（压出语义保留）', cover.hitIsScrim === true, JSON.stringify(cover));

    const before = await cdp.ev('window.__probeHit || 0');
    await cdp.click(300, 500); // 点幕布 → 应关面板而不是穿透点正文
    await sleep(500);
    const after = await cdp.ev('window.__probeHit || 0');
    const closed = await cdp.ev('!document.querySelector(\'aside[aria-label="对话辅导面板"]\')');
    check('B2 点幕布关闭面板（aside 移除）', closed === true);
    check('B3 幕布拦截生效（正文探针未被点击）', after === before, 'before=' + before + ' after=' + after);

    const s2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, 'cover-1100.png'), Buffer.from(s2.data, 'base64'));
  } finally {
    flush('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
    flush('报告与截图: ' + LOG);
    flush(logLines.join('\n'));
    browser.kill();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch((e) => {
  flush('!! ' + (e.stack || e));
  flush('\n结果: ' + pass + ' 通过 / ' + (fail + 1) + ' 失败');
  try {
    process.exit(1);
  } catch {
    /* noop */
  }
});
