/**
 * /graph 四态与专项取证探针（2026-10-11 style-10 迁移 P7 走查用）。
 *
 * 【它是什么】按既有惯例（tools/probe-report-states.cjs / probe-dock-click.cjs）另起的
 * **只取证、不下结论**的探针：不打退出码，失败只打印原因、把过程写进日志。它复用
 * responsive-audit 的 CDP 写法，但职责不同 —— 这里采的是「默认态之外」的取证：
 *   loading / error / no-data 三态 + 键盘操作 + 主题切换重绘不重播 + reduced-motion。
 *
 * 【D18 口径（L-3 认领）】无数据态**优先复用账号中已有的空空间**（P6 探针遗留），
 * 本探针**不再新建空间**：它先列空间、逐个查掌握度，挑一个 evidence_total = 0 的
 * 既有空间；找不到就在日志里如实记录「无空空间，不新建、跳过」。
 *
 * 【它怎么造出各态】
 *   error    —— Page.addScriptToEvaluateOnNewDocument 注入 fetch 包装，让
 *               `/api/graph/mastery` 直接 reject（不碰业务代码、不改后端）。
 *   loading  —— 同一手法改为让该请求**永不落地**（pending Promise）。
 *   no-data  —— 把既有空空间写进 localStorage 的活跃空间键后重进 /graph。
 *   no-space —— **采不到**：路由守卫（router.tsx 冻结区）在「已登录但无活跃空间」时
 *               把 /graph 重定向到 /spaces；如实记录，不伪造（R12 口径）。
 *   键盘      —— 聚焦画布容器后 dispatch 方向键 / 加减号，截「键盘操作后」的图。
 *   主题切换  —— 切主题前后各截一张（切后 350ms 的图若节点已画满 = 未重播点火）。
 *   reduced   —— Emulation.setEmulatedMedia(prefers-reduced-motion: reduce) 后重进 /graph。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），再跑：
 *   ZHIWEI_STATE_THEME=light node tools/probe-graph-states.cjs
 * 环境变量（沿用 probe-report-states.cjs）：
 *   ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH / ZHIWEI_STATE_OUT /
 *   ZHIWEI_STATE_IDENT / ZHIWEI_STATE_PASS / ZHIWEI_STATE_CDP_PORT / ZHIWEI_STATE_CHROME
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9456); // 避开 9333/9334/9444/9455
const PROFILE = path.join(os.tmpdir(), `zhiwei-graph-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-report-states.cjs）。 */
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

/** 注入脚本：只拦 /api/graph/mastery，其余请求原样放行。mode: 'fail' | 'hang'。 */
function graphMasteryPatch(mode) {
  return `
(() => {
  const orig = window.fetch;
  const blocked = (url) => String(url).indexOf('/api/graph/mastery') !== -1;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (blocked(url)) {
      ${mode === 'fail'
        ? "return Promise.reject(new TypeError('probe: graph/mastery 注入失败（模拟断网）'));"
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

  const name = (state) => path.join(OUT, `graph-${WIDTH}-${THEME}-${state}.png`);
  const zoomText = () =>
    cdp.evaluate(
      `(() => { const el = [...document.querySelectorAll('span')].find((s) => (s.textContent || '').startsWith('缩放 ')); return el ? el.textContent.trim() : null; })()`,
    );

  // ── 0. 登录 + 空间分类（D18：空空间只挑不建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph#/login` });
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
    const info = [];
    for (const sp of spaces) {
      try {
        const g = await fetch('/api/graph/mastery?space_id=' + encodeURIComponent(sp.space_id), {
          headers: { Authorization: 'Bearer ' + d.token },
        });
        const gb = await g.json();
        const gd = gb.data ?? gb;
        info.push({ space_id: sp.space_id, name: sp.name, evidence: (gd.summary && gd.summary.evidence_total) || 0 });
      } catch {
        info.push({ space_id: sp.space_id, name: sp.name, evidence: -1 });
      }
    }
    return { ok: true, token: d.token, spaces: info };
  })()`);
  say(`登录 = ${JSON.stringify({ ok: login && login.ok, count: login && login.spaces ? login.spaces.length : 0 })}`);
  if (!login || login.ok !== true || !login.spaces || login.spaces.length === 0) {
    say('!! 登录或取空间失败，各态无从注入');
    child.kill();
    process.exit(1);
  }
  say(`空间分类 = ${JSON.stringify(login.spaces)}`);
  const rich = login.spaces.find((s) => s.evidence > 0) ?? login.spaces[0];
  const empty = login.spaces.find((s) => s.evidence === 0) ?? null;
  say(`有证据空间 = ${rich.space_id}（证据 ${rich.evidence}）`);
  say(`空空间（复用/不新建） = ${empty ? `${empty.space_id}（${empty.name}）` : '无 —— 无数据态将跳过'}`);
  say('');

  const setSpace = (sid) =>
    cdp.evaluate(`localStorage.setItem('zhiwei_active_space', ${JSON.stringify(sid)}); true`);

  // ── 1. 正常态 ──
  await setSpace(rich.space_id);
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-normal#/graph` });
  await sleep(3500);
  say('正常态：');
  await cdp.shot(name('normal'));
  say(`  缩放 tok = ${await zoomText()}`);

  // ── 2. 键盘操作（D20④ 候选 A：方向键平移 + 加减号缩放） ──
  const kb = await cdp.evaluate(`(() => {
    const vp = document.querySelector('.bp-gcanvas__viewport');
    if (!vp) return { ok: false, reason: '找不到画布视口' };
    vp.focus();
    const press = (key) => vp.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const before = (vp.getAttribute('aria-label') || '').length;
    ['ArrowRight', 'ArrowRight', 'ArrowDown', '+', '+'].forEach(press);
    return { ok: document.activeElement === vp, focused: document.activeElement === vp, ariaLen: before };
  })()`);
  say(`键盘注入 = ${JSON.stringify(kb)}`);
  await sleep(700);
  say('键盘操作后（右移 + 放大）：');
  await cdp.shot(name('keyboard'));
  say(`  缩放 tok = ${await zoomText()}`);

  // ── 3. 主题切换重绘不重播（D20③） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-theme#/graph` });
  await sleep(3500);
  const beforeZoom = await zoomText();
  say('主题切换前（当前主题）：');
  await cdp.shot(name(`theme-before-${THEME}`));
  const toggled = await cdp.evaluate(`(() => {
    const btn = document.querySelector('button[aria-label="切换深浅主题"]');
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true, pressed: btn.getAttribute('aria-pressed') };
  })()`);
  say(`主题切换点击 = ${JSON.stringify(toggled)}`);
  // 画布墨量（非透明像素计数）：点火重播时 350ms 处只有最早几个节点落位 → 墨量远小于稳态。
  const inkCount = () =>
    cdp.evaluate(
      `(() => { const c = document.querySelector('.bp-gcanvas__viewport canvas'); if (!c) return null; const ctx = c.getContext('2d'); const { data } = ctx.getImageData(0, 0, c.width, c.height); let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++; return { w: c.width, h: c.height, ink: n }; })()`,
    );
  // 350ms：若点火被重播，此刻只有最早几个节点落位（截图会缺节点、墨量骤减）→ 反面即「不重播」。
  await sleep(350);
  const ink350 = await inkCount();
  say('主题切换后 350ms（点火窗口内；节点画满 = 未重播）：');
  await cdp.shot(name('theme-after-350ms'));
  const afterZoom = await zoomText();
  say(`  缩放 tok：切换前 = ${beforeZoom} / 切换后 = ${afterZoom}`);
  await sleep(2000);
  const inkSettled = await inkCount();
  say(`  画布墨量：350ms = ${JSON.stringify(ink350)} / 稳态 = ${JSON.stringify(inkSettled)}`);
  await cdp.shot(name('theme-after-settled'));

  // ── 4. reduced-motion（系统偏好通道；产品内无手动开关，见留痕） ──
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-reduced#/graph` });
  await sleep(800);
  const reducedFlag = await cdp.evaluate(
    `window.matchMedia('(prefers-reduced-motion: reduce)').matches`,
  );
  say(`reduced-motion 生效 = ${reducedFlag}（重进后 800ms 截图，节点应已瞬时到位）：`);
  await cdp.shot(name('reduced-motion'));
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  // ── 5. 无数据态（复用既有空空间，D18 不新建） ──
  if (empty) {
    await setSpace(empty.space_id);
    await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-nodata#/graph` });
    await sleep(3000);
    say('无数据态（空图谱，复用既有空空间）：');
    await cdp.shot(name('no-data'));
  } else {
    say('无数据态：**跳过** —— 账号内无空空间，按 D18 不新建（无感膨胀计数 = 0）。');
  }

  // ── 6. loading 态（graph/mastery 永不落地） ──
  await setSpace(rich.space_id);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: graphMasteryPatch('hang') });
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-loading#/graph` });
  await sleep(2000);
  say('loading 态（骨架）：');
  await cdp.shot(name('loading'));

  // ── 7. error 态（graph/mastery 注入失败 → 红章 + 真重试） ──
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: graphMasteryPatch('fail') });
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p7graph-error#/graph` });
  await sleep(3000);
  say('error 态（红章）：');
  await cdp.shot(name('error'));

  // ── 8. 无空间态：守卫重定向，采不到（如实记录，不伪造） ──
  say('');
  say('无空间态：**探针不采** —— router.guardPath 在「已登录 + 无活跃空间」时把 /graph');
  say('  重定向到 /spaces（router.tsx 属冻结区）；该分支只在「页面已挂载时空间被清空」');
  say('  路径下出现，无导航取证方式（R12 口径，与 P6 /report 同）。');

  child.kill();
  fs.writeFileSync(
    path.join(OUT, `last-graph-probe-${WIDTH}-${THEME}-log.txt`),
    logLines.join('\n'),
    'utf8',
  );
  process.exit(0);
}

main().catch((err) => {
  say(`!! 探针异常：${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
