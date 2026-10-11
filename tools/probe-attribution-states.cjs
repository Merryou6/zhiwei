/**
 * /attribution 走查与状态取证探针（2026-10-11 style-10 迁移 P9.4）。
 *
 * 【为什么需要它（如实说明）】归因页的证据必须在**真实数据链**上采：错题候选来自
 * 「本会话试卷确认判出的错题」（sessionStorage 的 zhiwei_paper_wrong_*，规范第 11 章
 * 勾稽 #3）。所以本探针先真做一遍 /paper 的「选文件 → 识别 → 标记 → 确认」，再带
 * 着缓存进 /attribution 走完向导 —— 全程不作假态、不直接写 sessionStorage 造数据。
 *
 * 【它采什么（每档 5 个状态）】
 *   step1    —— 进页第一步：错题表现身 + 「N 题可带出」chip（勾稽 #3 前半段）
 *   step2    —— 点「用这道」后的复述确认（题目 / 你的作答 / 知识点）
 *   step3    —— 点「就是这样，看看属于哪类」后的分类结果（采纳 or 低置信追问，如实记）
 *   step4    —— 分流（往上游找根源 / 这一类不用深挖，按真实 direction 如实记）
 *   result   —— 点「看看真正的根源」后的结果态（根因块 + 回溯链 + 候选贡献度 + 验证）
 *
 * 【纪律】只读只取证：不写业务代码、不造假态、不新建空间。
 *   本探针会真实提交一次试卷确认（业务行为，会落证据与错题缓存），故**默认只在指定
 *   空间**里跑（ZHIWEI_STATE_SPACE），不动 D23 的空空间基线。
 *   产物只增不删，落 _pipeline/screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 30s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=1440 node tools/probe-attribution-states.cjs
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH /
 *   ZHIWEI_STATE_OUT / ZHIWEI_STATE_SPACE / ZHIWEI_STATE_FILE_INDEX /
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
const SPACE = process.env.ZHIWEI_STATE_SPACE ?? 'sp_mv3d1i2g01js2';
/** 用第几份预置文件造错题（0 起）—— 同一小时内同一份文件的确认会命中幂等键，见 /paper 探针。 */
const FILE_INDEX = Number(process.env.ZHIWEI_STATE_FILE_INDEX ?? 0);
/** 挑第几道错题进向导（0 起）。 */
const WRONG_INDEX = Number(process.env.ZHIWEI_STATE_WRONG_INDEX ?? 0);
/** 走「或者手动填一道」入口（见下方说明；默认值取自真实题库 q_cz_basic_008）。 */
const MANUAL = process.env.ZHIWEI_STATE_MANUAL === '1';
const MANUAL_STEM = process.env.ZHIWEI_STATE_MANUAL_STEM ?? '化简：3(x + 2) = ?';
const MANUAL_ANSWER = process.env.ZHIWEI_STATE_MANUAL_ANSWER ?? '3x + 2 = 5x';
const MANUAL_KP = process.env.ZHIWEI_STATE_MANUAL_KP ?? 'math.cz.algebra.basic';
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9468); // 避开 9444/9455/9456/9466/9467
const PROFILE = path.join(os.tmpdir(), `zhiwei-attr-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-paper-states.cjs）。 */
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

/** 页面内量尺：overflowPx + h1 复核（D24）+ 归因页制式的可读锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const main = document.querySelector('main');
  const text = main ? (main.innerText || '') : '';
  const wrongRaw = sessionStorage.getItem('zhiwei_paper_wrong_${SPACE}');
  let wrongCount = null;
  if (wrongRaw) {
    try { const p = JSON.parse(wrongRaw); wrongCount = Array.isArray(p) ? p.length : null; } catch { wrongCount = null; }
  }
  const stepChips = [...document.querySelectorAll('main .bp-flat .bp-chip')]
    .map((el) => (el.textContent || '').trim())
    .filter((t) => /^0[1-5] ·/.test(t));
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheet10: text.indexOf('SHEET 10-10') !== -1,
    stepChips,
    wrongRows: document.querySelectorAll('main .bp-tbl tbody tr').length,
    pathItems: document.querySelectorAll('main .bp-path > li').length,
    candItems: document.querySelectorAll('main .bp-cands > li').length,
    hasAnalyze: text.indexOf('看看真正的根源') !== -1,
    hasNoDeepDive: text.indexOf('不用深挖') !== -1,
    hasClarify: text.indexOf('我再确认一下') !== -1,
    hasResult: document.querySelectorAll('main .bp-path').length > 0,
    planGiven: text.indexOf('验证通过后给出') !== -1 || text.indexOf('待验证通过后给出') !== -1,
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
  say(`space   = ${SPACE} · 造错题文件序号 = ${FILE_INDEX}`);
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
      `  ${state.padEnd(8)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}` +
        `  错题表=${data.wrongRows}  链=${data.pathItems}  候选=${data.candItems}` +
        `  wrong=${data.paperWrongCount}`,
    );
    await cdp.shot(path.join(OUT, `attribution-${WIDTH}-${THEME}-${state}.png`));
  };
  const clickByText = async (needle, tag = 'button') =>
    cdp.evaluate(`(() => {
      const el = [...document.querySelectorAll('main ${tag}')]
        .find((b) => (b.textContent || '').indexOf(${JSON.stringify(needle)}) !== -1 && !b.disabled);
      if (!el) return false;
      el.click();
      return true;
    })()`);

  // ── 0. 登录 + 指定空间（D23：只挑不建） ──
  await cdp.send('Page.navigate', { url: `${BASE}/?probe=p94attr#/login` });
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
      return JSON.stringify({ ok: true, via, space: hit.space_id, spaceName: hit.name });
    })()`),
  );
  if (!auth.ok) throw new Error('鉴权失败：' + JSON.stringify(auth));
  say(`auth    = via=${auth.via} space=${auth.space}（${auth.spaceName}）`);
  await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); sessionStorage.clear(); 1`);
  const nav = (hash) => cdp.send('Page.navigate', { url: `${BASE}/?probe=p94attr-${Date.now()}#${hash}` });

  // ── 1. 先用 /paper 真造一份错题缓存（勾稽 #3 的前提，不作假态） ──
  say('== 前置：/paper 真链路造错题 ==');
  await nav('/paper');
  await sleep(2600);
  if (FILE_INDEX > 0) {
    const sw = await cdp.evaluate(`(() => {
      const boxes = [...document.querySelectorAll('main .bp-tbl tbody input[type=checkbox]')];
      if (boxes.length <= ${FILE_INDEX}) return 'no-such-file';
      if (boxes[0].checked) boxes[0].click();
      if (!boxes[${FILE_INDEX}].checked) boxes[${FILE_INDEX}].click();
      return 'switched';
    })()`);
    await sleep(600);
    say(`  换选文件[${FILE_INDEX}] = ${sw}`);
  }
  say(`  开始识别=${await clickByText('开始识别')}`);
  await sleep(2600);
  say(`  一键采纳=${await clickByText('一键填到未标注的题')}`);
  await sleep(900);
  const marked = await cdp.evaluate(`(() => {
    let n = 0;
    document.querySelectorAll('main input[type=radio][name^="g"]').forEach((el) => {
      if (el.value === 'wrong' && !el.checked) { el.click(); n += 1; }
    });
    return n;
  })()`);
  await sleep(700);
  const submitted = await clickByText('确认，更新掌握度');
  await sleep(2800);
  const wrongCount = await cdp.evaluate(`(() => {
    const raw = sessionStorage.getItem('zhiwei_paper_wrong_${SPACE}');
    if (!raw) return null;
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.length : null; } catch { return null; }
  })()`);
  say(`  手标题数=${marked}  提交=${submitted}  错题缓存=${wrongCount} 条`);

  // ── 2. 归因向导：step1 → step2 → step3 → step4 → result ──
  say('== 状态取证（/attribution） ==');
  await nav('/attribution');
  await sleep(2800);
  await measureAndShot('step1');

  // 挑错题的两种真实入口（都走同一套向导）：
  //   A 默认：点错题表里第 WRONG_INDEX 行的「用这道」（数据来自本会话试卷确认）；
  //   B MANUAL=1：走「或者手动填一道」——题干 / 作答 / 知识点三项按**真实题库数据**填
  //     （q_cz_basic_008 的干扰项 3x + 2 = 5x 命中 term_merge → concept_confusion →
  //      direction=self ⇒ 能走到「深挖 → 结果态」；试卷错题那份数据在本次会话里
  //      判定落在低置信追问，走不到结果态）。这不是造态：手填本来就是产品的一条真实入口。
  let picked;
  if (MANUAL) {
    picked = await cdp.evaluate(`(() => {
      const setValue = (el, value) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const panel = [...document.querySelectorAll('main .bp-flat')].find((el) =>
        (el.textContent || '').indexOf('或者手动填一道') !== -1,
      );
      if (!panel) return 'no-manual-panel';
      const areas = [...panel.querySelectorAll('textarea')];
      const select = panel.querySelector('select');
      if (areas.length < 2 || !select) return 'no-fields';
      setValue(areas[0], ${JSON.stringify(MANUAL_STEM)});
      setValue(areas[1], ${JSON.stringify(MANUAL_ANSWER)});
      select.value = ${JSON.stringify(MANUAL_KP)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const btn = [...panel.querySelectorAll('button')].find((b) => (b.textContent || '').indexOf('下一步') !== -1);
      if (!btn || btn.disabled) return 'submit-disabled';
      btn.click();
      return 'manual-picked';
    })()`);
  } else {
    picked = await cdp.evaluate(`(() => {
      const btns = [...document.querySelectorAll('main button')].filter((b) => (b.textContent || '').trim() === '用这道');
      if (btns.length <= ${WRONG_INDEX}) return 'no-such-row(' + btns.length + ')';
      btns[${WRONG_INDEX}].click();
      return 'picked';
    })()`);
  }
  say(`  选错题[${MANUAL ? 'manual' : WRONG_INDEX}] = ${picked}`);
  await sleep(1200);
  await measureAndShot('step2');

  say(`  看看属于哪类=${await clickByText('就是这样，看看属于哪类')}`);
  await sleep(2400);
  await measureAndShot('step3');

  const analyze = await clickByText('看看真正的根源');
  if (!analyze) {
    say('  没有「看看真正的根源」键 —— 这次判定落在 direction=none（不用深挖）分支，如实记录');
  }
  await sleep(1200);
  await measureAndShot('step4');

  if (analyze) {
    await sleep(2400);
    await measureAndShot('result');
  }

  const jsonFile = path.join(OUT, `attribution-${WIDTH}-${THEME}.json`);
  fs.writeFileSync(
    jsonFile,
    JSON.stringify(
      {
        page: '/attribution',
        width: WIDTH,
        height: HEIGHT,
        theme: THEME,
        base: BASE,
        capturedAt: new Date().toISOString(),
        auth: { via: auth.via, space: auth.space, spaceName: auth.spaceName },
        chain: {
          fileIndex: FILE_INDEX,
          manual: MANUAL,
          wrongIndex: WRONG_INDEX,
          picked,
          marked,
          submitted,
          wrongCount,
          analyzeAvailable: analyze,
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

  fs.writeFileSync(path.join(OUT, `last-attribution-probe-${WIDTH}-${THEME}-log.txt`), logLines.join('\n'), 'utf8');
  await cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  child.kill();
}

main().catch((error) => {
  say('!! 探针异常：' + (error && error.stack ? error.stack : error));
  process.exit(1);
});
