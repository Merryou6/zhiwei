/**
 * /paper 走查与状态取证探针（2026-10-11 style-10 迁移 P9.3）。
 *
 * 【为什么需要它（如实说明）】tools/responsive-audit.cjs 只采「进页默认态」的 overflow
 * 与截图，覆盖不到 /paper 的三段流转。P9.3 的接线勾稽 #3（规范第 11 章）要求
 * **进页 → 刷新 → 确认态保留** 与 **确认后写 zhiwei_paper_wrong_* → 归因页联动** 的
 * 全链取证 —— 这两件事必须真操作一遍才拿得到证据，故按 6.5 惯例另起一个
 * 「只取证、不下结论」的探针。
 *
 * 【它采什么（每档 5 个状态）】
 *   select      —— 进页默认态（预置文件库表格 + 已选 1/5）
 *   recognized  —— 点「开始识别」后的逐题确认态（含提交前缺口红章）
 *   reload      —— **刷新页面**后再看一次：凭 sessionStorage 的 zhiwei_recognition_id
 *                  走 #10 回显，确认态与已识别的题应当原样回来（勾稽 #3 前半段）
 *   submitted   —— 采纳识别预判 + 手标「识别不确定」题 + 提交确认后的完成态
 *                  （同时读 sessionStorage 的错题缓存条数，勾稽 #3 后半段）
 *   attribution —— 从完成态跳 /attribution：错题缓存被归因页第一步带出（跨页联动）
 *
 * 【纪律】只读只取证：不写业务代码、不造假态、不新建空间。
 *   本探针会真实提交一次试卷确认（确认本身是业务行为，会落证据与掌握度），
 *   故**默认只在指定空间**里跑（ZHIWEI_STATE_SPACE，缺省取 P6 四态取证空间）——
 *   不动 D23 的空空间基线（初中数学零证据空间留给四态取证）。
 *   产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=1440 node tools/probe-paper-states.cjs
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH /
 *   ZHIWEI_STATE_OUT / ZHIWEI_STATE_SPACE / ZHIWEI_STATE_IDENT / ZHIWEI_STATE_PASS /
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
/** 只在指定空间里跑（见文件头纪律）。缺省 = P6 四态取证空间。 */
const SPACE = process.env.ZHIWEI_STATE_SPACE ?? 'sp_mv3d1i2g01js2';
/**
 * 选第几份预置文件（0 起）。
 *
 * 【为什么需要它】确认的幂等键是「同用户 × 同空间 × 同知识点 × 同来源 × 同小时」
 * （packages/engine/src/dedup.ts 的 hourBucket），同一小时内重复确认同一份文件
 * （同 kp）会得到 events_created = 0 —— 那是真实业务结果，但会让「完成态」取不到
 * 掌握度前后变化表的样本。换一份文件即换一组 kp，仍是真实链路。
 */
const FILE_INDEX = Number(process.env.ZHIWEI_STATE_FILE_INDEX ?? 0);
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9467); // 避开 9333/9444/9455/9456/9466
const PROFILE = path.join(os.tmpdir(), `zhiwei-paper-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-practice-states.cjs）。 */
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

/**
 * 页面内量尺：overflowPx + h1 复核 + 三段制式的可读锚点 + sessionStorage 勾稽事实。
 * ⚠ 阶段判据一律用「分节条右侧的 STAGE n / 3 角标」或分节标题，不用正文词
 *   （正文里同时出现「识别」等词，按词判会串档）。
 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const main = document.querySelector('main');
  const text = main ? (main.innerText || '') : '';
  const wrongRaw = sessionStorage.getItem('zhiwei_paper_wrong_${SPACE}');
  let wrongCount = null;
  if (wrongRaw) {
    try { const parsed = JSON.parse(wrongRaw); wrongCount = Array.isArray(parsed) ? parsed.length : null; } catch { wrongCount = null; }
  }
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-07') !== -1,
    stageBadge: text.indexOf('STAGE 3 / 3') !== -1 ? 'done'
      : text.indexOf('STAGE 2 / 3') !== -1 ? 'confirm' : 'pick',
    fileRows: document.querySelectorAll('main .bp-tbl tbody tr').length,
    verdictSegments: document.querySelectorAll('main input[type=radio][name^="g"]').length / 2,
    gapsStamp: text.indexOf('提交前还差') !== -1,
    measures: document.querySelectorAll('main .bp-measure').length,
    /** 完成态四格的读数（新增证据 / 更新知识点 / 初始覆盖 / 待巩固）——串起来存档，
     *  这样「events_created 是 0 还是 3」在 JSON 里是事实，不靠看图猜。 */
    measuresText: [...document.querySelectorAll('main .bp-measure')]
      .map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()),
    masteryRows: document.querySelectorAll('main .bp-tbl tbody tr').length,
    recognitionIdSet: !!sessionStorage.getItem('zhiwei_recognition_id'),
    paperWrongCount: wrongCount,
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
  say(`space   = ${SPACE}（只在指定空间里跑，见文件头纪律）`);
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
      `  ${state.padEnd(12)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}` +
        `  stage=${data.stageBadge}  题=${data.verdictSegments}  缺口章=${data.gapsStamp}` +
        `  recId=${data.recognitionIdSet}  wrong=${data.paperWrongCount}`,
    );
    await cdp.shot(path.join(OUT, `paper-${WIDTH}-${THEME}-${state}.png`));
  };

  // ── 0. 登录 + 指定空间（D23：只挑不建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p93paper#/login` });
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
      const hit = list.find((x) => x.space_id === '${SPACE}') || list[0];
      if (!hit) return JSON.stringify({ ok: false, reason: 'no-space' });
      localStorage.setItem('zhiwei_active_space', hit.space_id);
      return JSON.stringify({ ok: true, via, space: hit.space_id, spaceName: hit.name, total: list.length });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} space=${auth.space}（${auth.spaceName}）账号空间数=${auth.total}`);
  if (auth.space !== SPACE) say(`!! 未命中指定空间，回退到 ${auth.space} —— 结论请按此行读`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); sessionStorage.clear(); 1`);
  const nav = (hash) => cdp.send('Page.navigate', { url: `${BASE}/?probe=p93paper-${Date.now()}#${hash}` });

  // ── 1. select：进页默认态 ──
  await nav('/paper');
  await sleep(2600);
  say('== 状态取证 ==');
  await measureAndShot('select');

  // ── 1b. 换选第 FILE_INDEX 份预置文件（见文件头：为拿到非零的完成态样本） ──
  const fileSwitch = await cdp.evaluate(`(() => {
    const idx = ${FILE_INDEX};
    if (idx === 0) return 'default';
    const boxes = [...document.querySelectorAll('main .bp-tbl tbody input[type=checkbox]')];
    if (boxes.length <= idx) return 'no-such-file(' + boxes.length + ')';
    if (boxes[0].checked) boxes[0].click();
    if (!boxes[idx].checked) boxes[idx].click();
    return 'switched:' + boxes.length;
  })()`);
  await sleep(600);
  say(`  换选文件[${FILE_INDEX}] = ${fileSwitch}`);

  // ── 2. recognized：点「开始识别」后的逐题确认态 ──
  const started = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => (b.textContent || '').indexOf('开始识别') !== -1 && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(2600);
  say(`  开始识别=${started}`);
  await measureAndShot('recognized');

  // ── 3. reload：刷新后凭 zhiwei_recognition_id 回显确认态（勾稽 #3 前半段） ──
  const recBefore = await cdp.evaluate(`sessionStorage.getItem('zhiwei_recognition_id')`);
  await cdp.send('Page.reload');
  await sleep(3200);
  const recAfter = await cdp.evaluate(`sessionStorage.getItem('zhiwei_recognition_id')`);
  say(`  刷新前 recognition_id=${recBefore ? '有' : '无'} → 刷新后=${recAfter ? '有' : '无'}`);
  await measureAndShot('reload');

  // ── 4. submitted：采纳预判 + 手标「识别不确定」题 + 提交（勾稽 #3 后半段） ──
  const adopted = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => (b.textContent || '').indexOf('一键填到未标注的题') !== -1 && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  await sleep(900);
  // 逐题把还没选的判定选上（识别不确定的题必须手标 —— 探针按「这题错了」标，
  // 这样错题缓存里留得下题，归因页第一步才有东西可带）。
  const marked = await cdp.evaluate(`(() => {
    let n = 0;
    document.querySelectorAll('main input[type=radio][name^="g"]').forEach((el) => {
      if (el.value === 'wrong' && !el.checked) { el.click(); n += 1; }
    });
    return n;
  })()`);
  await sleep(700);
  const submitted = await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => (b.textContent || '').indexOf('确认，更新掌握度') !== -1);
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  })()`);
  await sleep(2800);
  say(`  一键采纳=${adopted}  手标题数=${marked}  提交=${submitted}`);
  await measureAndShot('submitted');

  // ── 5. attribution：跨页联动（错题缓存被归因页第一步带出，勾稽 #3 全链） ──
  await nav('/attribution');
  await sleep(2800);
  await measureAndShot('attribution');

  const jsonFile = path.join(OUT, `paper-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/paper',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, space: auth.space, spaceName: auth.spaceName, spaces: auth.total },
        chain: {
          fileIndex: FILE_INDEX,
          fileSwitch,
          recBefore: !!recBefore,
          recAfter: !!recAfter,
          adopted,
          marked,
          submitted,
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
  say(`overflowPx 最大 ${worst}px（判据：0）`);

  fs.writeFileSync(path.join(OUT, `last-paper-probe-${WIDTH}-${THEME}-log.txt`), logLines.join('\n'), 'utf8');
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
