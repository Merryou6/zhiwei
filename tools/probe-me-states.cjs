/**
 * /me 走查与状态取证探针（2026-10-11 style-10 迁移 P10.5）。
 *
 * 【为什么需要它】P10.5 的验收要求两条 responsive-audit.cjs 采不到的东西：
 *   ① 四态落点（规范 §7 profile 行）：概览区域级空态 —— 「无数据空间」与「无当前空间」
 *      两个分支各要一张实拍（前者复用 D23 的账号既有空空间基线，**不新建空间**）；
 *   ② 走查专项「主题切换实拍（me 页切换后全站生效对照）」—— 点 /me 页上的 ThemeToggle，
 *      验证 zhiwei_theme 落盘翻转 + html.dusk 同步，再跳另一个路由证明全站生效。
 *   另量每个状态的 overflowPx（判据 0）与 main h1 数（D24 页头复核：应恰好 1 个）。
 *
 * 【它采什么】每个（宽度 × 主题）组合五个状态：
 *   logged-in     —— 登录态进 /me：SHEET 10-14 / 单 h1 / 四格 measure / 四档分布行 /
 *                    推荐台账表（有推荐数据时）
 *   overview-empty—— 切到「零数据空间」（D23：从账号既有空间里挑全部掌握度 = 0 的一个，
 *                    判据是 max(mastery)=0 而非行数=0，见下文实测校准）
 *                    ⇒ 概览走虚线空盒 + 两条出路（「这个空间还没有学习数据」）
 *   no-space      —— 清掉 zhiwei_active_space 后进 /me ⇒ 被 guardPath **重定向到 /spaces**
 *                    （R19 实测：token 且无活跃空间时 /me 被弹回；MePage 的无空间空盒
 *                    分支因此不可直接导航取到，本状态取证的是守卫链路本身）
 *   toggle-*      —— 承 logged-in 态，点 /me 页内的 ThemeToggle（真用户路径）
 *                    ⇒ 截图 + 记录切换后的 zhiwei_theme / html.dusk
 *   global-*      —— 承上跳 /report ⇒ 证明「me 页切换后全站生效」（dusk 随全站 DOM）
 *
 * 【纪律】只读只取证：不写业务代码、不伪造数据、不新建空间（空空间从既有空间里挑）、
 *   不新建账号（e2e_smoke 已存在则只登录）。主题切换会改 localStorage 的 zhiwei_theme，
 *   属探针浏览器的临时 profile，不影响任何服务端数据。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=1440 node tools/probe-me-states.cjs
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9511); // 避开 9477/9488/9333/9334/9444/9455/9456/9466/9499
const PROFILE = path.join(os.tmpdir(), `zhiwei-me-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-login-states.cjs）。 */
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

/** 页面内量尺：overflowPx 判据 + h1 复核 + 本页锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : '';
  const btn = main ? main.querySelector('button[aria-label="切换深浅主题"]') : null;
  const recTable = main ? main.querySelector('.bp-tbl') : null;
  let stored = null;
  try { stored = localStorage.getItem('zhiwei_theme'); } catch (e) {}
  let space = null;
  try { space = localStorage.getItem('zhiwei_active_space'); } catch (e) {}
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    eyebrow: text.indexOf('PROFILE / 个人中心') !== -1,
    sheetNo: text.indexOf('SHEET 10-14') !== -1,
    measureCount: main ? main.querySelectorAll('.bp-measure').length : 0,
    distRows: main ? main.querySelectorAll('.grid > span.bp-band-1, .grid > span.bp-band-2, .grid > span.bp-band-3, .grid > span.bp-band-4').length : 0,
    kvRows: main ? main.querySelectorAll('.bp-kv').length : 0,
    recTableRows: recTable ? recTable.querySelectorAll('tbody tr').length : -1,
    recTableCaption: recTable ? (recTable.querySelector('caption')?.textContent || '').trim() : null,
    sections: main ? [...main.querySelectorAll('h2')].map((h) => (h.textContent || '').trim()) : [],
    emptyBoxes: main ? main.querySelectorAll('.bp-empty').length : 0,
    themeToggle: !!btn,
    themePressed: btn ? btn.getAttribute('aria-pressed') : null,
    dusk: docEl.classList.contains('dusk'),
    storedTheme: stored,
    activeSpace: space,
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

  const states = [];
  const fileBase = `me-${WIDTH}-${THEME}`;

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

    const measureAndShot = async (state, note, clip) => {
      const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
      data.state = state;
      data.note = note ?? null;
      data.width = WIDTH;
      data.height = HEIGHT;
      data.theme = THEME;
      states.push(data);
      say(
        `  ${state.padEnd(15)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
          `measure=${data.measureCount}  dist=${data.distRows}  台账行=${data.recTableRows}  ` +
          `空盒=${data.emptyBoxes}  dusk=${data.dusk}  storedTheme=${data.storedTheme}`,
      );
      say(`     h1=${JSON.stringify(data.h1Text)}  分节=${JSON.stringify(data.sections)}`);
      if (clip) await cdp.shot(path.join(OUT, `${fileBase}-${state}-zoom.png`), clip);
      else await cdp.shot(path.join(OUT, `${fileBase}-${state}.png`));
    };

    const go = async (hash, wait = 2200) => {
      await cdp.send('Page.navigate', {
        url: `${BASE}/?probe=p105me-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#${hash}`,
      });
      await sleep(wait);
    };

    // ── 0. 鉴权（真登录；e2e_smoke 已存在 ⇒ 只读）+ 找一个「零数据空间」（D23：不新建） ──
    await go('/login', 1500);
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
        return JSON.stringify({ ok: true, via, userId: j.data.user_id });
      })()`),
    );
    if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
    say(`鉴权 via=${auth.via} user=${auth.userId}`);

    const spaces = JSON.parse(
      await cdp.evaluate(`(async () => {
        const r = await fetch('/api/space/list', { headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') } });
        const j = await r.json();
        const rows = (j.data && j.data.spaces) || [];
        const out = [];
        for (const s of rows) {
          const rr = await fetch('/api/report/summary?space_id=' + encodeURIComponent(s.space_id), {
            headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') }
          });
          const jj = await rr.json();
          const mastery = (jj.data && jj.data.mastery) || [];
          const vals = mastery.map((row) => row.mastery);
          out.push({
            space_id: s.space_id,
            name: s.name,
            rows: mastery.length,
            maxMastery: vals.length ? Math.max(...vals) : 0,
            sumMastery: Number(vals.reduce((a, b) => a + b, 0).toFixed(3)),
          });
        }
        return JSON.stringify(out);
      })()`),
    );
    // ⚠ 空空间判据用「掌握度最大值 = 0」而非「行数 = 0」——
    //   #9 reportSummary 对空间内**全部**知识点各出一行（行数 = 空间知识点数，非观测数），
    //   故「行数 = 0」永不成立；「全部掌握度都为 0」才是真正的「无数据空间」（P10.5 实测校准）。
    say('空间基线（name / 行数 / max / sum）：' + JSON.stringify(spaces));
    const bySum = spaces.slice().sort((a, b) => b.sumMastery - a.sumMastery);
    const dataSpace = bySum[0] ?? spaces[0];
    const emptySpace = spaces.find((s) => s.maxMastery === 0) ?? null;
    if (!dataSpace) throw new Error('账号没有可用空间');
    say(`有数据空间 = ${dataSpace.name}（sum=${dataSpace.sumMastery}）`);
    say(`零数据空间 = ${emptySpace ? `${emptySpace.name}（max=0，D23 既有基线，不新建）` : '无（本状态跳过）'}`);

    // ── 1. logged-in：登录态进 /me ──
    say('== 状态取证 ==');
    await cdp.evaluate(`localStorage.setItem('zhiwei_active_space', '${dataSpace.space_id}'); 1`);
    await go('/me', 2600);
    await measureAndShot('logged-in', '登录态 /me：SHEET 10-14 + 单 h1 + 四格 measure + 四档分布 + 推荐台账');

    // ── 2. overview-empty：切到零数据空间 ⇒ 概览空盒（区域级四态） ──
    if (emptySpace) {
      await cdp.evaluate(`localStorage.setItem('zhiwei_active_space', '${emptySpace.space_id}'); 1`);
      await go('/me', 2600);
      await measureAndShot('overview-empty', '零数据空间：概览虚线空盒 + 两条出路（做一次测评 / 去云盘传试卷）');
    } else {
      say('  overview-empty  跳过（账号无零数据空间）');
    }

    // ── 3. no-space：清掉当前空间 ⇒ **守卫重定向**（R19 实测口径，非空盒） ──
    //   router.tsx guardPath L120-121：token 且无活跃空间且非 /spaces、/self-report → /spaces。
    //   故清掉 zhiwei_active_space 后进 /me 会被弹回 /spaces（本状态取证的是「守卫链路」，
    //   MePage 内的无空间空盒分支因此不可直接导航取到——如实记录为 R19 口径）。
    await cdp.evaluate(`localStorage.removeItem('zhiwei_active_space'); 1`);
    await go('/me', 2600);
    await measureAndShot('no-space', '无当前空间：守卫 guardPath 重定向到 /spaces（R19；非 MePage 空盒）');
    await cdp.evaluate(`localStorage.setItem('zhiwei_active_space', '${dataSpace.space_id}'); 1`);

    // ── 4. toggle：在 /me 页点 ThemeToggle（真用户路径）⇒ 主题切换实拍 ──
    await go('/me', 2600);
    const flipped = THEME === 'dark' ? 'light' : 'dark';
    const clicked = await cdp.evaluate(`(() => {
      const main = document.querySelector('main');
      const btn = main ? main.querySelector('button[aria-label="切换深浅主题"]') : null;
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    say(`  切换按钮可点 = ${clicked}（${THEME} → 期望 ${flipped}）`);
    await sleep(700);
    await measureAndShot(`toggle-${flipped}`, `me 页切换主题后（期望 storedTheme=${flipped}、dusk=${flipped === 'dark'}）`);

    // ── 5. global：跳 /report ⇒ 主题在全站生效 ──
    await go('/report', 2600);
    await measureAndShot(`global-${flipped}`, '承上跳 /report：主题已在全站生效（dusk 与 storedTheme 同源）');

    const payload = {
      tag: 'me',
      width: WIDTH,
      height: HEIGHT,
      theme: THEME,
      base: BASE,
      capturedAt: new Date().toISOString(),
      spaces,
      dataSpace: dataSpace.space_id,
      emptySpace: emptySpace ? emptySpace.space_id : null,
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
