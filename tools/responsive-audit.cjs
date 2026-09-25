/**
 * 窄屏响应式走查（零依赖 CDP + 本机 Edge）—— 移动端适配轮的「桌面像素级零变化」判据工具。
 *
 * 【为什么需要它】
 * 本轮的目标是「修窄屏破绽、桌面（≥768px）渲染像素级零变化」。肉眼比对截图不足以支撑
 * 「零变化」这种强断言 —— 需要可复算的数字：同一批路由、同一批几何锚点，改造前后逐项 diff。
 * 本脚本就是那台量尺：跑两遍（tag=baseline / tag=after），第三遍 --compare 出 diff 表。
 *
 * 【⚠ 2026-09-25 起 --compare 闸门临时停用（UI 视觉重构轮）】
 * 那一轮的任务是「比赛级 UI 视觉重构」，**有意改变桌面视觉**（信息架构、字号刻度、
 * 卡片层级、导航形态）。这与本脚本 --compare 的判据在**定义上互斥**：判据要求
 * ≥768 三档逐锚点 diff 全 0，而重构正是要去动这些锚点。跑它必然 exit 1 ——
 * 一个「必然红灯」的闸门会让真红灯失去意义。
 *
 * 处理方式（不删脚本、不删基线）：
 *   · 加 SKIP_RESPONSIVE_AUDIT=1 开关，**只短路 --compare**（采样与 --probe-nav 不受影响
 *     —— 它们是取证工具，不是闸门）。这样在 CI 里跳过闸门，同时仍能截图留证。
 *   · 既有基线（_pipeline/screenshots/mobile/*）原样保留，未删除、未覆盖。
 *   · TODO(UI 稳定后恢复)：去掉 CI 侧的 SKIP_RESPONSIVE_AUDIT=1，重采一份新基线
 *     `--tag v2-baseline`，之后按 `--compare v2-baseline <new>` 继续。
 *     跟踪项：项目 issue「恢复 responsive-audit 桌面零变化闸门（UI 稳定后）」。
 *
 * 恢复前的替代判据（本轮实际使用）：4 档宽度（1440/1024/768/375）× 深/浅两套主题的
 * 截图 + 每页 overflowPx 与溢出元素清单 + --probe-nav 行为探针。
 *
 * 【它采集什么】（每个宽度档 × 12 条路由各一份）
 *   a) 页面级横向溢出：documentElement.scrollWidth - clientWidth（px）
 *   b) 溢出元素清单：getBoundingClientRect().right > 视口宽 +1 的前 10 个（tag + class 片段）
 *      —— 图谱容器 / 报告表格容器属「有意内部横滚」，需人工据此判读，脚本不替人下结论
 *   c) 几何锚点 getBoundingClientRect（x/y/w/h，2 位小数）：header、header nav、main、
 *      main 首个子元素、main 内首个「有边框且够大」的卡片、main 内首个 h1/h2；
 *      另采 computedStyle 字号（body / main / 标题 / 顶栏导航项）
 *   d) 视口截图 PNG
 *
 * 【怎么用】
 *   先起服务（后端 :8787 + vite :5173），再按宽度分档跑（本机单条命令约 60s 被 SIGKILL，
 *   12 页 × 1 档 ≈ 20–30s，故一档一条命令，勿合并）：
 *     node tools/responsive-audit.cjs --tag baseline --widths 1440
 *     node tools/responsive-audit.cjs --tag baseline --widths 1024
 *     node tools/responsive-audit.cjs --tag baseline --widths 768
 *     node tools/responsive-audit.cjs --tag baseline --widths 414,375
 *     node tools/responsive-audit.cjs --tag after    --widths 1440
 *     ...
 *     # 桌面零变化判据（≥768 三档逐页逐锚点 diff 必须全 0；任一项 ≠0 → 打印并 exit 1）
 *     node tools/responsive-audit.cjs --compare baseline after --widths 1440,1024,768
 *     # 抽屉交互探针（<720 专用；不属于几何判据，仅取证）
 *     node tools/responsive-audit.cjs --probe-nav --widths 375
 *
 * 【环境变量】
 *   ZHIWEI_AUDIT_BASE    前端地址，默认 http://127.0.0.1:5173
 *   ZHIWEI_AUDIT_OUT     产物目录，默认 <仓库根>/_pipeline/screenshots/mobile
 *   ZHIWEI_AUDIT_TAG     采样标签（baseline / after / 任意），--compare 读的就是它
 *   ZHIWEI_AUDIT_WIDTHS  逗号分隔宽度，等价于 --widths（两者都给时以 CLI 为准）
 *   ZHIWEI_AUDIT_IDENT / ZHIWEI_AUDIT_PASS  走查账号，默认 e2e_smoke / e2e_test_2026
 *   ZHIWEI_AUDIT_CDP_PORT  CDP 端口，默认 9334（避开 e2e-smoke 的 9333）
 *   ZHIWEI_AUDIT_THEME   采样主题：light / dark，默认 dark（应用默认就是深色）。
 *                        P2 新增：两套主题都要按同等标准验收，而原先采样固定落深色，
 *                        浅色一套无证可取。实现是在 clear 之后写 zhiwei_theme 并 reload，
 *                        纯增量，不改任何既有行为。
 *   SKIP_RESPONSIVE_AUDIT  置 1 时短路 --compare（见文件头停用说明）。不影响采样与探针。
 *
 * 【输出】
 *   <OUT>/audit-<tag>-<width>.json         采样结果（12 页，含 theme 字段）
 *   <OUT>/<tag>-<width>-<theme>-<route>.png 逐页截图（P2 起文件名带主题，便于两套并列比对）
 *   <OUT>/compare-<A>-<B>-<widths>.json    --compare 的机器可读结果
 *
 * 【退出码】0 = 通过 / 采样完成；1 = 有失败项（--compare 有 diff、Chrome 未就绪、脚本异常）。
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJ = path.resolve(__dirname, '..');
const BASE = process.env.ZHIWEI_AUDIT_BASE ?? 'http://127.0.0.1:5173';
const OUT = process.env.ZHIWEI_AUDIT_OUT
  ? path.resolve(process.env.ZHIWEI_AUDIT_OUT)
  : path.join(PROJ, '_pipeline', 'screenshots', 'mobile');
const IDENT = process.env.ZHIWEI_AUDIT_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_AUDIT_PASS ?? 'e2e_test_2026';
const CDP_PORT = Number(process.env.ZHIWEI_AUDIT_CDP_PORT ?? 9334);

/** 采样主题（P2 新增）：应用默认就是深色，故默认 dark；'light' 时在 clear 之后写入并 reload。 */
const THEME = process.env.ZHIWEI_AUDIT_THEME === 'light' ? 'light' : undefined;

/**
 * 桌面零变化闸门的临时停用开关（见文件头）。**只短路 --compare** ——
 * 采样与 --probe-nav 是取证工具而非闸门，停掉它们只会让本轮无证可取。
 */
const SKIP_COMPARE = process.env.SKIP_RESPONSIVE_AUDIT === '1';

/** 写入 localStorage 的主题值：未指定时显式写 dark，让「这次是哪套皮肤」变成事实而非默认值推断。 */
const THEME_KEY_VALUE = THEME ?? 'dark';

/** 12 页路由表（与 apps/web/src/router.tsx 的 ROUTES 同序；本脚本不 import 业务代码）。 */
const ROUTES = [
  { path: '/login', name: 'login', auth: false },
  { path: '/self-report', name: 'self-report', auth: true },
  { path: '/spaces', name: 'spaces', auth: true },
  { path: '/console', name: 'console', auth: true },
  { path: '/assessment', name: 'assessment', auth: true },
  { path: '/paper', name: 'paper', auth: true },
  { path: '/chat', name: 'chat', auth: true },
  { path: '/attribution', name: 'attribution', auth: true },
  { path: '/graph', name: 'graph', auth: true },
  { path: '/report', name: 'report', auth: true },
  { path: '/drive', name: 'drive', auth: true },
  { path: '/me', name: 'me', auth: true },
];

/** 「桌面档」下限：≥768 的档必须逐项 diff=0（本轮硬约束 1）。 */
const DESKTOP_MIN_WIDTH = 768;

const ANCHORS = ['header', 'headerNav', 'main', 'mainChild', 'firstCard', 'heading'];
const FONTS = ['body', 'main', 'heading', 'headerNav'];

const log = [];
function say(line) {
  const text = String(line);
  log.push(text);
  console.log(text);
}
process.on('uncaughtException', (e) => {
  say('!! UNCAUGHT: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  say('!! REJECT: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 清理临时 profile：Edge 退出后仍可能残留文件句柄 → 失败不致命（只影响 /tmp 残留）。 */
function rmQuiet(dir, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      /* 重试；最终失败也只是 /tmp 里多一个目录 */
    }
  }
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const opts = { tag: process.env.ZHIWEI_AUDIT_TAG ?? '', widths: [], compare: null, probeNav: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tag') opts.tag = argv[++i] ?? '';
    else if (a === '--widths') opts.widths = String(argv[++i] ?? '').split(',').filter(Boolean);
    else if (a === '--compare') opts.compare = [argv[++i] ?? '', argv[++i] ?? ''];
    else if (a === '--probe-nav') opts.probeNav = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else {
      say('未知参数：' + a);
      process.exit(2);
    }
  }
  if (opts.widths.length === 0 && process.env.ZHIWEI_AUDIT_WIDTHS) {
    opts.widths = String(process.env.ZHIWEI_AUDIT_WIDTHS).split(',').filter(Boolean);
  }
  opts.widths = opts.widths.map((w) => Number(w)).filter((w) => Number.isFinite(w) && w > 0);
  return opts;
}

function usage() {
  say('用法：');
  say('  node tools/responsive-audit.cjs --tag <baseline|after> --widths 1440,1024,768,720,414,375');
  say('  node tools/responsive-audit.cjs --compare <tagA> <tagB> --widths 1440,1024,768');
  say('  node tools/responsive-audit.cjs --probe-nav --widths 375');
  say('提示：ZHIWEI_AUDIT_WIDTHS 等价于 --widths；按宽度分档跑防 60s 超时。');
  say('      ZHIWEI_AUDIT_THEME=light 采浅色一套（默认深色），截图文件名带主题。');
  say('      SKIP_RESPONSIVE_AUDIT=1 短路 --compare（不影响采样与探针）。');
}

/** 视口高度：≥768 走桌面比例（与 e2e-smoke 同 1440×900），窄档走手机比例（375×812 系）。 */
function viewportHeight(width) {
  return width >= DESKTOP_MIN_WIDTH ? 900 : 812;
}

// ---------------------------------------------------------------- CDP（写法沿用 tools/e2e-smoke.cjs）
function findChromium() {
  const candidates = [
    process.env.ZHIWEI_AUDIT_CHROME,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Edge/Chrome，可用 ZHIWEI_AUDIT_CHROME 指定路径');
}

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
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    }
    return r.result.value;
  }
}

// ---------------------------------------------------------------- 页面内探针
/** 逐页采集表达式：溢出量 + 溢出元素 + 几何锚点 + 字号。 */
const PROBE_JS = `(() => {
  const rect = (el) => {
    const b = el.getBoundingClientRect();
    return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) };
  };
  const fsOf = (el) => (el ? getComputedStyle(el).fontSize : null);
  const q = (s) => document.querySelector(s);
  const docEl = document.documentElement;
  const main = q('main');
  let card = null;
  if (main) {
    for (const el of main.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const bw = Math.max(
        parseFloat(cs.borderTopWidth) || 0,
        parseFloat(cs.borderRightWidth) || 0,
        parseFloat(cs.borderBottomWidth) || 0,
        parseFloat(cs.borderLeftWidth) || 0,
      );
      const b = el.getBoundingClientRect();
      if (bw > 0 && b.width >= 100 && b.height >= 40) { card = el; break; }
    }
  }
  const heading = main ? main.querySelector('h1, h2') : null;
  const headerNavItem = q('header nav a, header nav button');
  const limit = docEl.clientWidth;
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.height > 0 && b.right > limit + 1) {
      const cls = typeof el.className === 'string' ? el.className : String(el.className || '');
      overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: cls.replace(/\\s+/g, ' ').trim().slice(0, 110),
        left: +b.left.toFixed(1),
        right: +b.right.toFixed(1),
        w: +b.width.toFixed(1),
      });
      if (overflow.length >= 10) break;
    }
  }
  return JSON.stringify({
    hash: location.hash,
    title: document.title,
    innerWidth: window.innerWidth,
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    bodyScrollWidth: document.body.scrollWidth,
    overflow,
    anchors: {
      header: q('header') ? rect(q('header')) : null,
      headerNav: q('header nav') ? rect(q('header nav')) : null,
      main: main ? rect(main) : null,
      mainChild: main && main.firstElementChild ? rect(main.firstElementChild) : null,
      firstCard: card ? rect(card) : null,
      heading: heading ? rect(heading) : null,
    },
    fonts: {
      body: fsOf(document.body),
      main: fsOf(main),
      heading: fsOf(heading),
      headerNav: fsOf(headerNavItem),
    },
    textLen: (document.body.innerText || '').length,
  });
})()`;

// ---------------------------------------------------------------- 采样
async function ensureAuth(cdp) {
  const raw = await cdp.ev(`(async () => {
    const body = JSON.stringify({ identifier: '${IDENT}', password: '${PASS}' });
    const post = (p) => fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    let via = 'register';
    let j = await (await post('/api/auth/register')).json();
    if (j.code === 409) { via = 'login'; j = await (await post('/api/auth/login')).json(); }
    if (j.code !== 0) return JSON.stringify({ ok: false, code: j.code, msg: j.msg });
    localStorage.setItem('zhiwei_token', j.data.token);
    localStorage.setItem('zhiwei_user_id', j.data.user_id);
    return JSON.stringify({ ok: true, via, userId: j.data.user_id });
  })()`);
  const auth = JSON.parse(raw);
  if (!auth.ok) throw new Error('鉴权失败：' + raw);

  const spaceId = await cdp.ev(`(async () => {
    const r = await fetch('/api/space/list', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') }
    });
    const j = await r.json();
    return (j.data && j.data.spaces && j.data.spaces[0]) ? j.data.spaces[0].space_id : '';
  })()`);
  if (!spaceId) throw new Error('取不到 space_id');
  await cdp.ev(`localStorage.setItem('zhiwei_active_space', '${spaceId}'); 1`);

  // 报告页要有数据才可比（自报幂等：同一组 level 重复提交结果一致）
  await cdp.ev(`(async () => {
    await fetch('/api/evidence/self-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') },
      body: JSON.stringify({ space_id: '${spaceId}', reports: [
        { chapter: '二次函数', level: 2 }, { chapter: '一元二次方程', level: 4 }, { chapter: '代数式', level: 5 }
      ]})
    });
    return 1;
  })()`);
  return { auth, spaceId };
}

async function runSample(cdp, opts) {
  say('base    = ' + BASE);
  say('out     = ' + OUT);
  say('tag     = ' + opts.tag);
  say('theme   = ' + THEME_KEY_VALUE + (THEME ? '' : '（默认；用 ZHIWEI_AUDIT_THEME=light 采浅色）'));
  say('widths  = ' + opts.widths.join(','));

  for (const width of opts.widths) {
    const height = viewportHeight(width);
    const mobile = width < DESKTOP_MIN_WIDTH;
    say('\n=== 宽度档 ' + width + ' × ' + height + '（mobile=' + mobile + '）===');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
    await sleep(150);

    // 清 localStorage 需要一个同源文档：先落一次根路径再清（保证 /login 不被守卫改写）
    const stamp = String(Date.now());
    await goto(cdp, `${BASE}/?audit=${stamp}b#/login`);
    await cdp.ev('localStorage.clear(); sessionStorage.clear(); 1');

    // 主题（P2 新增）：必须写在 clear **之后**，否则会被清掉。
    // 未显式指定时也写 dark：应用默认是深色，但把「这次采的是哪套皮肤」变成
    // 写进 JSON 的事实，而不是靠默认值推断 —— 两套主题要并列比对时这一点很关键。
    await cdp.ev(`localStorage.setItem('zhiwei_theme', '${THEME_KEY_VALUE}'); 1`);
    await cdp.ev('location.reload(); 1');
    await sleep(500);

    const pages = [];
    let authed = false;
    for (const route of ROUTES) {
      if (route.auth && !authed) {
        const info = await ensureAuth(cdp);
        await cdp.ev('location.reload(); 1');
        authed = true;
        say('  鉴权 via=' + info.auth.via + ' space=' + info.spaceId);
      }
      const waitMs = route.name === 'graph' ? 1500 : route.name === 'report' ? 1100 : 650;
      await goto(cdp, `${BASE}/?audit=${stamp}-${route.name}#${route.path}`);
      await cdp.ev('document.fonts && document.fonts.ready ? document.fonts.ready.then(() => 1) : 1');
      await sleep(waitMs);

      const sample = JSON.parse(await cdp.ev(PROBE_JS));
      sample.route = route.path;
      sample.routeName = route.name;
      sample.width = width;
      sample.height = height;
      sample.tag = opts.tag;
      sample.theme = THEME_KEY_VALUE;
      pages.push(sample);

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      // 文件名带主题（P2）：两套主题的截图并列时不会互相覆盖。
      const file = path.join(OUT, `${opts.tag}-${width}-${THEME_KEY_VALUE}-${route.name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));

      say(
        '  ' +
          route.path.padEnd(14) +
          '溢出=' +
          String(sample.overflowPx).padStart(4) +
          'px  溢出元素=' +
          String(sample.overflow.length).padStart(2) +
          (sample.hash === '#' + route.path ? '' : '   落入 ' + sample.hash),
      );
    }

    const totalOverflow = pages.reduce((s, p) => s + p.overflowPx, 0);
    const payload = {
      tag: opts.tag,
      width,
      height,
      mobile,
      theme: THEME_KEY_VALUE,
      base: BASE,
      capturedAt: new Date().toISOString(),
      pages,
    };
    const jsonFile = path.join(OUT, `audit-${opts.tag}-${width}.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(payload, null, 1), 'utf8');
    say('  → ' + path.relative(PROJ, jsonFile) + '   页面级溢出合计 ' + totalOverflow + 'px');
  }
  return true;
}

/**
 * 导航并确认文档真的换成了目标 URL。
 * 为什么要确认：CDP 的 Page.loadEventFired 可能与**上一次**导航（或启动时的 about:blank）
 * 竞争，只 await 它会让紧随其后的 eval 跑在旧文档上（实测报 SecurityError: localStorage
 * access denied on about:blank）。每次导航的 URL 都带唯一 query，用 location.href 回读即可确定。
 */
async function goto(cdp, url) {
  const query = url.slice(url.indexOf('?')).split('#')[0];
  const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
  const res = await cdp.send('Page.navigate', { url });
  if (res && res.errorText) say('!! Page.navigate 失败：' + res.errorText + '  url=' + url);
  await loaded;
  let last = '';
  let lastErr = '';
  for (let i = 0; i < 60; i++) {
    try {
      last = String(await cdp.ev('location.href'));
      if (last.includes(query)) return;
    } catch (error) {
      lastErr = error && error.message ? error.message.slice(0, 120) : String(error);
    }
    await sleep(120);
  }
  throw new Error('导航未就位：' + url + '  最后一次 href=' + last + '  err=' + lastErr);
}

// ---------------------------------------------------------------- 对比
function diffPages(a, b) {
  const rows = [];
  const byRoute = new Map(a.pages.map((p) => [p.route, p]));
  for (const pb of b.pages) {
    const pa = byRoute.get(pb.route);
    if (!pa) {
      rows.push({ route: pb.route, kind: 'missing-in-A', detail: '基线无此页' });
      continue;
    }
    for (const key of ANCHORS) {
      const ra = pa.anchors[key];
      const rb = pb.anchors[key];
      if (!ra && !rb) continue;
      if (!ra || !rb) {
        rows.push({ route: pb.route, kind: 'anchor', key, detail: (ra ? 'A有B无' : 'A无B有') });
        continue;
      }
      for (const k of ['x', 'y', 'w', 'h']) {
        if (Math.abs(ra[k] - rb[k]) > 0.005) {
          rows.push({ route: pb.route, kind: 'anchor', key, prop: k, a: ra[k], b: rb[k], delta: +(rb[k] - ra[k]).toFixed(2) });
        }
      }
    }
    for (const key of FONTS) {
      if (pa.fonts[key] !== pb.fonts[key]) {
        rows.push({ route: pb.route, kind: 'font', key, a: pa.fonts[key], b: pb.fonts[key] });
      }
    }
    if (pa.textLen !== pb.textLen) {
      rows.push({ route: pb.route, kind: 'text-len-info', a: pa.textLen, b: pb.textLen, delta: pb.textLen - pa.textLen });
    }
  }
  return rows;
}

function runCompare(opts) {
  const [tagA, tagB] = opts.compare;
  if (!tagA || !tagB) {
    say('--compare 需要两个 tag：--compare baseline after');
    process.exit(2);
  }
  const widths = opts.widths.length > 0 ? opts.widths : [1440, 1024, 768];
  say('对比 ' + tagA + ' → ' + tagB + '   档位 ' + widths.join(','));
  say('判据：≥768 档逐页逐锚点 diff 必须全 0（0px 才算过）');

  const result = { tagA, tagB, widths, desktopMin: DESKTOP_MIN_WIDTH, perWidth: [], hardFail: [] };
  for (const width of widths) {
    const fa = path.join(OUT, `audit-${tagA}-${width}.json`);
    const fb = path.join(OUT, `audit-${tagB}-${width}.json`);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) {
      say('\n[' + width + '] 缺文件：' + (!fs.existsSync(fa) ? fa : fb));
      result.hardFail.push({ width, reason: 'missing-json' });
      continue;
    }
    const A = JSON.parse(fs.readFileSync(fa, 'utf8'));
    const B = JSON.parse(fs.readFileSync(fb, 'utf8'));
    const rows = diffPages(A, B);
    const geometry = rows.filter((r) => r.kind !== 'text-len-info');
    const textInfo = rows.filter((r) => r.kind === 'text-len-info');

    say('\n=== ' + width + 'px ===');
    for (const p of B.pages) {
      const pa = A.pages.find((x) => x.route === p.route);
      const pageGeometry = geometry.filter((r) => r.route === p.route);
      say(
        '  ' +
          p.route.padEnd(14) +
          '锚点diff=' +
          String(pageGeometry.length).padStart(2) +
          '  溢出 ' +
          (pa ? pa.overflowPx : '?') +
          'px → ' +
          p.overflowPx +
          'px',
      );
    }
    if (geometry.length === 0) {
      say('  几何 diff：0 项（' + B.pages.length + ' 页 × ' + ANCHORS.length + ' 锚点 × 4 维 + ' + FONTS.length + ' 字号采样 全等）');
    } else {
      say('  几何 diff：' + geometry.length + ' 项 ≠0 ↓');
      for (const r of geometry) {
        say(
          '    ' +
            r.route.padEnd(14) +
            ' ' +
            (r.key || '-') +
            (r.prop ? '.' + r.prop : '') +
            '   ' +
            (r.a !== undefined ? r.a + ' → ' + r.b + '  Δ=' + r.delta : r.detail),
        );
      }
      if (width >= DESKTOP_MIN_WIDTH) result.hardFail.push({ width, count: geometry.length });
    }
    if (textInfo.length > 0) {
      say('  （参考：正文文本长度变化 ' + textInfo.length + ' 处，不计入判据）');
    }
    result.perWidth.push({ width, pages: B.pages.length, geometryDiffs: geometry.length, rows });
  }

  const outFile = path.join(OUT, `compare-${tagA}-${tagB}-${widths.join('_')}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1), 'utf8');
  say('\n→ ' + path.relative(PROJ, outFile));

  if (result.hardFail.length > 0) {
    say('\n结论：FAIL —— ≥768 档存在几何差异（桌面像素级零变化未达成）');
    for (const f of result.hardFail) say('  ' + JSON.stringify(f));
    return 1;
  }
  say('\n结论：PASS —— ≥768 档 ' + widths.filter((w) => w >= DESKTOP_MIN_WIDTH).length + ' 档逐页逐锚点 diff 全 0');
  return 0;
}

// ---------------------------------------------------------------- 抽屉交互探针（<720 专用取证）
const KEY_ESCAPE = 27;
const KEY_TAB = 9;
async function pressKey(cdp, code, key, vk, modifiers = 0) {
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: vk,
    nativeVirtualKeyCode: vk,
    modifiers,
  });
}

const DRAWER_JS = `(() => {
  const t = document.getElementById('mobile-nav-toggle');
  const drawer = document.getElementById('mobile-nav-drawer');
  const panel = document.querySelector('aside[aria-label="对话辅导面板"]');
  const navUl = document.querySelector('header nav ul');
  const active = document.activeElement;
  return JSON.stringify({
    toggleExists: !!t,
    toggleVisible: !!t && getComputedStyle(t).display !== 'none',
    toggleExpanded: t ? t.getAttribute('aria-expanded') : null,
    drawer: !!drawer,
    drawerRole: drawer ? drawer.getAttribute('role') : null,
    drawerModal: drawer ? drawer.getAttribute('aria-modal') : null,
    drawerWidth: drawer ? +drawer.getBoundingClientRect().width.toFixed(1) : null,
    drawerRight: drawer ? +drawer.getBoundingClientRect().right.toFixed(1) : null,
    navUlHidden: navUl ? getComputedStyle(navUl).display === 'none' : null,
    focusInsideDrawer: !!(drawer && active && drawer.contains(active)),
    focusId: active ? (active.id || active.tagName.toLowerCase()) : null,
    panelOpen: !!panel,
    bodyAriaHidden: (() => {
      const m = document.querySelector('main');
      const w = m && m.parentElement;
      return w ? w.getAttribute('aria-hidden') : null;
    })(),
    docOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  });
})()`;

async function runProbeNav(cdp, opts) {
  const width = opts.widths[0] ?? 375;
  const height = viewportHeight(width);
  say('抽屉交互探针 @ ' + width + '×' + height);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const stamp = String(Date.now());
  await goto(cdp, `${BASE}/?probe=${stamp}b#/login`);
  await cdp.ev('localStorage.clear(); sessionStorage.clear(); 1');
  await goto(cdp, `${BASE}/?probe=${stamp}#/login`);
  const info = await ensureAuth(cdp);
  say('  鉴权 via=' + info.auth.via);
  await goto(cdp, `${BASE}/?probe=${stamp}-spaces#/spaces`);
  await sleep(700);

  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail) => {
    if (ok) {
      pass += 1;
      say('  [OK]   ' + name);
    } else {
      fail += 1;
      say('  [FAIL] ' + name + (detail ? '   → ' + JSON.stringify(detail) : ''));
    }
  };

  const closed = JSON.parse(await cdp.ev(DRAWER_JS));
  check('未登录态无关：已登录、汉堡键存在且可见', closed.toggleExists && closed.toggleVisible, closed);
  check('顶栏导航 ul 在 <720 被收纳（display:none）', closed.navUlHidden === true, closed);
  check('初始抽屉不存在', closed.drawer === false, closed);

  // 打开
  await cdp.ev(`document.getElementById('mobile-nav-toggle').click(); 1`);
  await sleep(250);
  const opened = JSON.parse(await cdp.ev(DRAWER_JS));
  check('点击汉堡键后抽屉出现', opened.drawer === true, opened);
  check('抽屉 role=dialog / aria-modal=true', opened.drawerRole === 'dialog' && opened.drawerModal === 'true', opened);
  check('汉堡键 aria-expanded=true', opened.toggleExpanded === 'true', opened);
  check('抽屉从右侧滑入（right ≈ 视口宽）', Math.abs(opened.drawerRight - width) < 2, opened);
  check('焦点移入抽屉', opened.focusInsideDrawer === true, opened);
  const shotOpen = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `probe-${width}-drawer-open.png`), Buffer.from(shotOpen.data, 'base64'));

  // 焦点陷阱：连按 Tab 不应逃出抽屉
  for (let i = 0; i < 25; i++) await pressKey(cdp, 'Tab', 'Tab', KEY_TAB);
  await sleep(150);
  const afterTabs = JSON.parse(await cdp.ev(DRAWER_JS));
  check('25 次 Tab 后焦点仍在抽屉内（焦点陷阱）', afterTabs.focusInsideDrawer === true, afterTabs);

  // Esc 关闭
  await pressKey(cdp, 'Escape', 'Escape', KEY_ESCAPE);
  await sleep(250);
  const afterEsc = JSON.parse(await cdp.ev(DRAWER_JS));
  check('Esc 关闭抽屉', afterEsc.drawer === false, afterEsc);
  check('Esc 后焦点归还汉堡键', afterEsc.focusId === 'mobile-nav-toggle', afterEsc);

  // 背景幕关闭（真实指针命中测试：点抽屉左侧空白）
  await cdp.ev(`document.getElementById('mobile-nav-toggle').click(); 1`);
  await sleep(250);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 6, y: Math.round(height / 2), button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 6, y: Math.round(height / 2), button: 'left', clickCount: 1 });
  await sleep(250);
  const afterScrim = JSON.parse(await cdp.ev(DRAWER_JS));
  check('点背景幕关闭抽屉（指针路径）', afterScrim.drawer === false, afterScrim);

  // 点抽屉内导航项自动收起 + 路由跳转
  await cdp.ev(`document.getElementById('mobile-nav-toggle').click(); 1`);
  await sleep(250);
  await cdp.ev(`(() => {
    const d = document.getElementById('mobile-nav-drawer');
    const link = d && d.querySelector('a[href="#/report"]');
    if (link) link.click();
    return !!link;
  })()`);
  await sleep(400);
  const afterNav = JSON.parse(await cdp.ev(DRAWER_JS));
  const hashNow = await cdp.ev('location.hash');
  check('点抽屉内「学习报告」→ 抽屉收起', afterNav.drawer === false, afterNav);
  check('点抽屉内「学习报告」→ 路由跳转', hashNow === '#/report', hashNow);

  // 互斥（D4）：抽屉内「对话辅导」→ 关抽屉、开面板
  await cdp.ev(`document.getElementById('mobile-nav-toggle').click(); 1`);
  await sleep(250);
  await cdp.ev(`(() => {
    const d = document.getElementById('mobile-nav-drawer');
    const btn = d && d.querySelector('button[aria-pressed]');
    if (btn) btn.click();
    return !!btn;
  })()`);
  await sleep(300);
  const excl = JSON.parse(await cdp.ev(DRAWER_JS));
  check('抽屉内「对话辅导」→ 抽屉收起且面板打开（互斥 D4）', excl.drawer === false && excl.panelOpen === true, excl);

  // 面板开着时开抽屉 → 面板关（D4 兜底）
  await cdp.ev(`document.getElementById('mobile-nav-toggle').click(); 1`);
  await sleep(300);
  const excl2 = JSON.parse(await cdp.ev(DRAWER_JS));
  check('面板开着时点汉堡键 → 面板关闭、抽屉打开（互斥兜底）', excl2.panelOpen === false && excl2.drawer === true, excl2);

  const shotScrim = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `probe-${width}-drawer-open-2.png`), Buffer.from(shotScrim.data, 'base64'));

  say('\n探针结果：' + pass + ' 通过 / ' + fail + ' 失败');
  return fail === 0 ? 0 : 1;
}

// ---------------------------------------------------------------- main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    process.exit(0);
  }
  fs.mkdirSync(OUT, { recursive: true });

  if (opts.compare) {
    if (SKIP_COMPARE) {
      say('== --compare 已临时停用（SKIP_RESPONSIVE_AUDIT=1）==');
      say('   原因：2026-09-25 UI 视觉重构**有意**改变桌面视觉，与「桌面 ≥768');
      say('   像素级零变化」判据在定义上互斥 —— 跑它必然 exit 1，属预期而非失败。');
      say('   脚本未删、既有基线未删。恢复步骤见本文件 main() 上方的 TODO。');
      say('   ⚠ 采样与 --probe-nav 不受此开关影响：unset SKIP_RESPONSIVE_AUDIT 后');
      say('     加 --tag 即可继续截图取证。');
      process.exit(0);
    }
    // 对比模式不启浏览器
    fs.writeFileSync(path.join(OUT, `last-compare-log.txt`), '', 'utf8');
    const code = runCompare(opts);
    fs.writeFileSync(path.join(OUT, `last-compare-log.txt`), log.join('\n'), 'utf8');
    process.exit(code);
  }

  if (opts.widths.length === 0) {
    usage();
    say('!! 必须给 --widths（或 ZHIWEI_AUDIT_WIDTHS）');
    process.exit(2);
  }
  if (!opts.probeNav && !opts.tag) {
    say('!! 采样模式必须给 --tag');
    process.exit(2);
  }

  const chromePath = findChromium();
  const profile = path.join(os.tmpdir(), 'zhiwei-audit-profile-' + CDP_PORT);
  rmQuiet(profile);
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=' + CDP_PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=' + opts.widths[0] + ',' + viewportHeight(opts.widths[0]),
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(300);
    }
  }
  if (!version) {
    say('!! Edge/Chrome 未就绪（CDP ' + CDP_PORT + ' 无响应）');
    chrome.kill();
    process.exit(1);
  }
  say('browser = ' + version.Browser);

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = await CDP.attach(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  let code = 0;
  try {
    code = opts.probeNav ? await runProbeNav(cdp, opts) : ((await runSample(cdp, opts)) ? 0 : 1);
  } finally {
    fs.writeFileSync(path.join(OUT, `last-${opts.probeNav ? 'probe' : 'sample-' + opts.tag}-log.txt`), log.join('\n'), 'utf8');
    await cdp.send('Browser.close').catch(() => {});
    await sleep(300);
    chrome.kill();
    rmQuiet(profile);
  }
  process.exit(code);
}

void main();
