/**
 * 抽屉「视口越界自动关闭」探针（2026-09-24 移动端适配轮补丁 1af2346 的回归网）
 *
 * 【为什么需要它】几何走查（同目录 responsive-audit.cjs）只覆盖「某个静态宽度下已渲染的形态」，
 * 覆盖不到**同一次会话内的视口变化**。而抽屉恰好在这条缝里出过真实缺陷：
 *   <720 打开抽屉 → 视口拉宽到 ≥720（手机横屏 375×812 转 812×375 必命中）时，抽屉根节点的
 *   `nav:hidden` 生效为 display:none，但 store 的 open 仍为 true，同时坏两件事：
 *     ① Layout 的正文 aria-hidden 不撤 → 读屏用户读到空白页；
 *     ② 焦点陷阱仍以隐藏子树为边界：Tab 时 preventDefault() 后 focus() 落到 display:none
 *        元素上无效 → Tab 键全站失效（只能刷新恢复）。
 * 本探针把「拉宽后抽屉必须卸载、正文不得残留 aria-hidden」固化成断言。
 *
 * 【用法】需先把前端与后端跑起来（:5173 / :8787）。
 *   node tools/probe-nav-rotate.cjs
 *   ZHIWEI_PROBE_BASE=http://127.0.0.1:5174 node tools/probe-nav-rotate.cjs
 * 退出码：0 = PASS，1 = FAIL（缺陷复现），2 = 探针异常。
 * 环境：ZHIWEI_PROBE_BASE / ZHIWEI_PROBE_CDP_PORT / ZHIWEI_PROBE_CHROME。
 * 零依赖：Node 18+ 自带 WebSocket，直接说 CDP；浏览器走 headless + --no-sandbox
 * （受限沙箱里 Chromium 自身沙箱层会因权限被拒触发 SIGTRAP）。
 * ⚠ 探针只读：不写仓库任何文件；临时 profile 留在系统临时目录由系统回收
 * （**不要**在这里对 profile 做递归删除——会触发沙箱的批量删除闸门，实测踩到）。
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ZHIWEI_PROBE_BASE || 'http://127.0.0.1:5173';
const CDP_PORT = Number(process.env.ZHIWEI_PROBE_CDP_PORT || 9445);
const IDENT = 'probe_rotate_' + Date.now();
const PASS = 'probe_rotate_pass_123';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findBrowser() {
  const candidates = [
    process.env.ZHIWEI_PROBE_CHROME,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Edge/Chrome，可用 ZHIWEI_PROBE_CHROME 指定路径');
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

  once(method, timeout = 20000) {
    return new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('等待事件超时：' + method)), timeout);
      const waiters = this.events.get(method) || [];
      waiters.push((params) => {
        clearTimeout(timer);
        res(params);
      });
      this.events.set(method, waiters);
    });
  }

  async ev(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('页面求值异常：' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  }
}

/** 设备视口覆写：375×812（竖屏手机）与 812×375（同一台手机横屏，宽度越过 720 收纳断点）。 */
const VIEW = (width, height) => ({ width, height, deviceScaleFactor: 1, mobile: true });

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-probe-nav-'));
  const child = spawn(findBrowser(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch {
      /* 浏览器尚未就绪 */
    }
  }
  if (!target) throw new Error('连不上浏览器 CDP');

  const cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Emulation.setDeviceMetricsOverride', VIEW(375, 812));
  {
    const done = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await done.catch(() => {});
    await sleep(2500);
  }

  // 注册 / 登录并落地 token（与 responsive-audit.cjs 同款协议：409 表示已存在 → 改登录）
  const auth = JSON.parse(await cdp.ev(`(async () => {
    const body = JSON.stringify({ identifier: '${IDENT}', password: '${PASS}' });
    const post = (p) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    let j = await (await post('/api/auth/register')).json();
    if (j.code === 409) j = await (await post('/api/auth/login')).json();
    if (j.code !== 0) return JSON.stringify({ ok: false, code: j.code, msg: j.msg });
    localStorage.setItem('zhiwei_token', j.data.token);
    localStorage.setItem('zhiwei_user_id', j.data.user_id);
    const sp = await (await fetch('/api/space/list', { headers: { Authorization: 'Bearer ' + j.data.token } })).json();
    const first = sp.data && sp.data.spaces && sp.data.spaces[0];
    if (first) localStorage.setItem('zhiwei_active_space', first.space_id);
    return JSON.stringify({ ok: true });
  })()`));
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));

  // ⚠ 必须整页 reload：CDP Page.navigate 到仅 hash 不同的 URL 属于同文档导航、不触发重载，
  //   React 不会重新读 localStorage，会停在登录页（此时顶栏没有汉堡键）——实测踩到。
  {
    const done = cdp.once('Page.loadEventFired');
    await cdp.send('Page.reload');
    await done.catch(() => {});
    await sleep(2500);
  }
  // 未落在带顶栏的路由时补一跳
  await cdp.ev("if (!document.getElementById('mobile-nav-toggle')) location.hash = '#/spaces'; 1");
  await sleep(1500);

  const before = JSON.parse(await cdp.ev(`(async () => {
    const toggle = document.getElementById('mobile-nav-toggle');
    if (!toggle) return JSON.stringify({ ok: false, why: '顶栏没有汉堡键（可能未登录）' });
    toggle.click();
    await new Promise((r) => setTimeout(r, 500));
    const drawer = document.getElementById('mobile-nav-drawer');
    const root = drawer ? drawer.parentElement : null;
    const main = document.querySelector('main');
    return JSON.stringify({
      ok: true,
      viewportW: window.innerWidth,
      drawerMounted: !!drawer,
      drawerRootDisplay: root ? getComputedStyle(root).display : null,
      mainWrapAriaHidden: main && main.parentElement ? main.parentElement.getAttribute('aria-hidden') : null,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    });
  })()`));

  // 拉宽到手机横屏（812 > 720）：抽屉此时不可能被看到，必须自行关闭
  await cdp.send('Emulation.setDeviceMetricsOverride', VIEW(812, 375));
  await sleep(1200);

  const after = JSON.parse(await cdp.ev(`(async () => {
    await new Promise((r) => setTimeout(r, 400));
    const drawer = document.getElementById('mobile-nav-drawer');
    const main = document.querySelector('main');
    return JSON.stringify({
      viewportW: window.innerWidth,
      drawerMounted: !!drawer,
      mainWrapAriaHidden: main && main.parentElement ? main.parentElement.getAttribute('aria-hidden') : null,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    });
  })()`));

  console.log(JSON.stringify({ before, after }, null, 1));

  // 判据：拉宽后 ① 抽屉必须卸载（否则 store 的 open 残留）② 正文不得残留 aria-hidden（否则读屏空白页）
  const pass = before.ok === true
    && before.drawerMounted === true
    && before.mainWrapAriaHidden === 'true'
    && after.viewportW >= 720
    && after.drawerMounted === false
    && after.mainWrapAriaHidden === null;

  console.log(pass
    ? 'RESULT: PASS（拉宽后抽屉已卸载、正文 aria-hidden 已撤）'
    : 'RESULT: FAIL（缺陷复现：拉宽后抽屉仍挂载或正文残留 aria-hidden）');

  cdp.ws.close();
  child.kill('SIGKILL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('探针异常：' + e.message);
  process.exit(2);
});
