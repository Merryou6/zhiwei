/**
 * /（门户落地页）走查取证探针（2026-10-11 style-10 迁移 P11.1）。
 *
 * 【为什么需要它（如实说明）】
 * tools/responsive-audit.cjs 的 ROUTES 表是 11 页的**历史口径**，**不含公开门户 '/'**
 * （门户不进 router.ROUTES 的 11 页链路，App.tsx 直接渲染、无守卫）。P11.1 要给 '/'
 * 出「档位 × 双主题」的 overflowPx 硬判据证据，但不动那张表（与 P9.2/P10.2 同处置），
 * 故按 6.5 惯例另起一个「只取证、不下结论」的探针。
 *
 * 【它采什么】每个（宽度 × 主题）组合两个状态：
 *   normal   —— 默认动效通道：hero / 三条主张 / 五步闭环 / 两个入口 / 图纸目录；
 *               量 overflowPx（判据 0）、h1 数（应恰好 1）、SHEET 10-01、逐字 span 数、
 *               六数字量块、五步清单条数、目录表行数、scrollHeight（滚动叙事）。
 *   reduced  —— prefers-reduced-motion: reduce 通道（拍板④逐字动画的降级证据）：
 *               同一页面在减动效偏好下的静态呈现（kinetic-char 仍可见、无动画）。
 *
 * 【纪律】只读只取证：不写业务代码、不登录、无副作用（门户不请求任何真实接口）。
 * 产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 非必需，仅 vite :5173 必需），逐条跑（每条约 15s）：
 *   ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 node tools/probe-landing-states.cjs
 *   ... 换主题 / 宽度逐条；宽度取 1440/1024/768/375。
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH / ZHIWEI_STATE_OUT /
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
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9533); // 避开 9477/9488/9511/9522/9333
const PROFILE = path.join(os.tmpdir(), `zhiwei-landing-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-start-states.cjs）。 */
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

const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : document.body.innerText || '';
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    scrollHeight: docEl.scrollHeight,
    h1Count: h1s.length,
    h1Text: h1s,
    publicSheet: text.indexOf('ZHIWEI / PUBLIC SHEET') !== -1,
    sheet1001: text.indexOf('SHEET 10-01') !== -1,
    kineticChars: document.querySelectorAll('.kinetic-char').length,
    measures: document.querySelectorAll('.bp-measure').length,
    claims: document.querySelectorAll('article.bp-panel').length,
    loopItems: document.querySelectorAll('.bp-num-list > li').length,
    catalogRows: document.querySelectorAll('.bp-tbl tbody tr').length,
    sections: main ? [...main.querySelectorAll('h2')].map((h) => (h.textContent || '').trim()) : [],
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
  const fileBase = `landing-${WIDTH}-${THEME}`;

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
    // 先落主题偏好（应用读 localStorage.zhiwei_theme 决定 html.dusk）
    await cdp.send('Page.navigate', { url: `${BASE}/?probe=p111landing-boot#/` });
    await sleep(1200);
    await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);

    const go = async (hash, wait = 2200) => {
      await cdp.send('Page.navigate', {
        url: `${BASE}/?probe=p111landing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#${hash}`,
      });
      await sleep(wait);
    };

    const measureAndShot = async (state, note) => {
      const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
      data.state = state;
      data.note = note ?? null;
      data.width = WIDTH;
      data.height = HEIGHT;
      data.theme = THEME;
      states.push(data);
      say(
        `  ${state.padEnd(8)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
          `逐字=${data.kineticChars}  量块=${data.measures}  主张=${data.claims}  闭环=${data.loopItems}  ` +
          `目录行=${data.catalogRows}  scrollH=${data.scrollHeight}`,
      );
      say(`     h1=${JSON.stringify(data.h1Text)}  分节=${JSON.stringify(data.sections)}`);
      await cdp.shot(path.join(OUT, `${fileBase}-${state}.png`));
    };

    say('== 状态取证 ==');

    // ── 1. normal：默认动效通道 ──
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await go('/');
    await measureAndShot('normal', '默认动效：hero + 三条主张 + 五步闭环 + 两个入口 + 图纸目录');

    // ── 2. reduced：减动效通道（拍板④逐字动画的降级证据） ──
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await go('/');
    await measureAndShot('reduced', 'prefers-reduced-motion: reduce（kinetic-char 静态可见、无动画）');

    const payload = {
      page: '/',
      width: WIDTH,
      height: HEIGHT,
      theme: THEME,
      base: BASE,
      capturedAt: new Date().toISOString(),
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
