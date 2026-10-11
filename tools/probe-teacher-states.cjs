/**
 * 教师端三页（/t · /t/student/:id · /t/recommendations）走查与状态取证探针
 * （2026-10-11 style-10 迁移 P11.2–P11.4）。
 *
 * 【为什么需要它】
 *  1) tools/responsive-audit.cjs 的 ROUTES 表是**学生端 11 页**的历史口径，不含教师端
 *     三条路由（也不含 / 、/start、/practice）—— 本轮要给教师端出「4 档 × 双主题」的
 *     overflowPx 硬判据证据，但不动那张表（改它作废既有 v2-baseline 比较口径），
 *     故按 6.5 惯例另起一个「只取证、不下结论」的探针；
 *  2) 教师端四态（规范 §7 teacher / teacher/student / teacher/recommendations 行）
 *     与 403 兜底链路都只能在真浏览器里取，responsive-audit 采不到注入态。
 *
 * 【教师账号口径（R17 + 上轮副作用教训）】不用裸 register 探测：先 login，
 *   仅在「明确未注册」时才 register **并带 role:'teacher'** —— 这正是产品自身
 *   「演示账号一键进入（教师端）」的行为（LoginPage.handleDemoEnter）。
 *
 * 【它采什么】ZHIWEI_STATE_PAGE 选页（t / student / recommendations），每页四个状态：
 *   normal   —— 教师登录态进页（/t 与 /t/student 会有真实绑定学生行）
 *   empty    —— 注入空集合（区域级空盒）
 *   error    —— 注入失败响应（区域级红章，R12 口径）
 *   denied   —— 学生 token 访问教师接口 ⇒ 服务端真 403 ⇒ 页面红章（403 兜底取证）
 *   /t/student 另加 missing —— 不带 studentId/space_id 进页 ⇒ 页面级「链接缺少参数」错误态
 *
 * 【纪律】只读只取证：不写业务代码；empty/error 是状态注入（JSON 的 injected 字段如实标注）；
 *   不新建空间、不新建账号（除产品自身演示教师账号外）。产物只增不删，落 screenshots/style10/。
 *
 * 【用法】先起服务（后端 :8787 + vite :5173），逐条跑（每条约 20~30s，防 60s SIGKILL）：
 *   ZHIWEI_STATE_PAGE=t              ZHIWEI_STATE_THEME=dark ZHIWEI_STATE_WIDTH=1440 node tools/probe-teacher-states.cjs
 *   ZHIWEI_STATE_PAGE=student        ...
 *   ZHIWEI_STATE_PAGE=recommendations ...
 * 环境变量：ZHIWEI_STATE_BASE / ZHIWEI_STATE_PAGE / ZHIWEI_STATE_THEME / ZHIWEI_STATE_WIDTH /
 *   ZHIWEI_STATE_OUT / ZHIWEI_STATE_TIDENT / ZHIWEI_STATE_TPASS /
 *   ZHIWEI_STATE_SIDENT / ZHIWEI_STATE_SPASS / ZHIWEI_STATE_CDP_PORT / ZHIWEI_STATE_CHROME
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.ZHIWEI_STATE_BASE ?? 'http://127.0.0.1:5173';
const PAGE = (process.env.ZHIWEI_STATE_PAGE ?? 't').toLowerCase();
const THEME = process.env.ZHIWEI_STATE_THEME === 'light' ? 'light' : 'dark';
const WIDTH = Number(process.env.ZHIWEI_STATE_WIDTH ?? 1440);
const HEIGHT = WIDTH >= 768 ? 900 : 812;
const OUT =
  process.env.ZHIWEI_STATE_OUT ?? path.join(__dirname, '..', '_pipeline', 'screenshots', 'style10');
/** 演示教师账号（= 产品登录页「教师端一键进入」用的那一个）。 */
const TIDENT = process.env.ZHIWEI_STATE_TIDENT ?? 'demo_teacher';
const TPASS = process.env.ZHIWEI_STATE_TPASS ?? 'demo123456';
/** 学生账号（仅用于 403 兜底取证；用既有探针账号，不新建）。 */
const SIDENT = process.env.ZHIWEI_STATE_SIDENT ?? 'e2e_smoke';
const SPASS = process.env.ZHIWEI_STATE_SPASS ?? 'e2e_test_2026';
const PORT = Number(process.env.ZHIWEI_STATE_CDP_PORT ?? 9533);
const PROFILE = path.join(os.tmpdir(), `zhiwei-teacher-probe-${PORT}`);

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

/** 极简 CDP 客户端（写法沿用 tools/probe-drive-states.cjs）。 */
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

/** 页面内量尺：overflowPx 判据 + h1 复核（D24）+ 教师端锚点。 */
const MEASURE_JS = `(() => {
  const docEl = document.documentElement;
  const main = document.querySelector('main');
  const h1s = [...document.querySelectorAll('main h1')].map((el) => (el.textContent || '').trim());
  const text = main ? main.innerText || '' : '';
  const h2s = main ? [...main.querySelectorAll('h2')].map((h) => (h.textContent || '').trim()) : [];
  return JSON.stringify({
    hash: location.hash,
    overflowPx: Math.max(0, docEl.scrollWidth - docEl.clientWidth),
    clientWidth: docEl.clientWidth,
    scrollWidth: docEl.scrollWidth,
    h1Count: h1s.length,
    h1Text: h1s,
    sheetNo: (text.match(/SHEET 10-1[567]/) || [])[0] || null,
    eyebrowOk: /TEACHER CONSOLE|STUDENT DOSSIER|RECOMMENDATION OPS/.test(text),
    measures: main ? main.querySelectorAll('.bp-measure').length : 0,
    tblRows: main ? main.querySelectorAll('.bp-tbl tbody tr').length : 0,
    hasTable: !!main && !!main.querySelector('.bp-tbl'),
    hasEmpty: !!main && !!main.querySelector('.bp-empty'),
    hasStamp: !!main && !!main.querySelector('.bp-stamp'),
    hasSkeleton: !!main && !!main.querySelector('[role="status"] .bp-hatch'),
    chips: main ? main.querySelectorAll('.bp-chip').length : 0,
    sections: h2s,
    shellNav: !!document.querySelector('header nav[aria-label="老师端导航"]'),
    textLen: text.length,
  });
})()`;

/**
 * 探针注入脚本（R12 口径）：只拦教师端三类取数，按 sessionStorage 开关行事。
 *   fail  → 失败响应（error 态）
 *   empty → 空集合（empty 态）
 * 其它请求（含 auth）一律透传。
 */
const INJECT_JS = `(() => {
  const originalFetch = window.fetch.bind(window);
  const read = (key) => { try { return sessionStorage.getItem(key); } catch (e) { return null; } };
  const json = (body, status) => Promise.resolve(new Response(JSON.stringify(body), {
    status: status || 200, headers: { 'Content-Type': 'application/json' },
  }));
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const mode = read('__probe_teacher_mode');
    const isStudents = url.indexOf('/api/teacher/students') !== -1;
    const isInvites = url.indexOf('/api/teacher/invites') !== -1;
    const isRecs = url.indexOf('/api/teacher/recommendations') !== -1;
    if (mode && (isStudents || isInvites || isRecs)) {
      if (mode === 'fail') {
        return json({ code: 9002, msg: '探针注入：教师端取数失败' }, 500);
      }
      if (mode === 'empty') {
        if (isStudents) return json({ code: 0, msg: 'ok', data: { students: [], total: 0 } });
        if (isInvites) return json({ code: 0, msg: 'ok', data: { invites: [] } });
        return json({ code: 0, msg: 'ok', data: { recommendations: [] } });
      }
    }
    return originalFetch(input, init);
  };
  return 1;
})()`;

/** 登录/注册（带 role）——「一键进入」的产品行为；返回 token 或错误。 */
const AUTH_JS = (ident, pass, role, nickname) => `(async () => {
  const post = (p, b) => fetch(p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
  });
  let j = await (await post('/api/auth/login', { identifier: '${ident}', password: '${pass}' })).json();
  let via = 'login';
  if (j.code !== 0) {
    via = 'register';
    j = await (await post('/api/auth/register', {
      identifier: '${ident}', password: '${pass}', nickname: '${nickname}', role: '${role}',
    })).json();
  }
  if (j.code !== 0) return JSON.stringify({ ok: false, code: j.code, msg: j.msg, via });
  return JSON.stringify({ ok: true, via, token: j.data.token, userId: j.data.user_id, role: j.data.role });
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
  const fileBase = `teacher-${PAGE}-${WIDTH}-${THEME}`;

  try {
    say(`browser = ${bin}`);
    say(`base    = ${BASE}`);
    say(`page    = ${PAGE}`);
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

    const go = async (hash, wait = 2600) => {
      await cdp.send('Page.navigate', {
        url: `${BASE}/?probe=p11teacher-${Date.now()}-${Math.random().toString(36).slice(2, 7)}#${hash}`,
      });
      await sleep(wait);
    };

    const measureAndShot = async (state, injected) => {
      const data = JSON.parse(await cdp.evaluate(MEASURE_JS));
      data.state = state;
      data.injected = injected ?? null;
      data.width = WIDTH;
      data.height = HEIGHT;
      data.theme = THEME;
      states.push(data);
      say(
        `  ${state.padEnd(9)} 溢出=${String(data.overflowPx).padStart(4)}px  h1=${data.h1Count}  ` +
          `表行=${data.tblRows}  量块=${data.measures}  空盒=${data.hasEmpty}  红章=${data.hasStamp}  ` +
          `骨架=${data.hasSkeleton}  SHEET=${data.sheetNo}`,
      );
      say(`     h1=${JSON.stringify(data.h1Text)}  分节=${JSON.stringify(data.sections)}  落入=${data.hash}`);
      await cdp.shot(path.join(OUT, `${fileBase}-${state}.png`));
    };

    // ── 0. 鉴权：演示教师（先 login、未注册才带 role:'teacher' 注册）+ 学生（403 取证用）──
    await go('/login', 1800);
    await cdp.evaluate(`localStorage.setItem('zhiwei_theme', '${THEME}'); 1`);
    const t = JSON.parse(await cdp.evaluate(AUTH_JS(TIDENT, TPASS, 'teacher', '演示老师')));
    if (!t.ok) throw new Error('教师鉴权失败：' + JSON.stringify(t));
    say(`auth(teacher) = ${TIDENT} via=${t.via} role=${t.role}`);
    const s = JSON.parse(await cdp.evaluate(AUTH_JS(SIDENT, SPASS, 'student', '演示同学')));
    if (!s.ok) say(`auth(student) = 取不到（403 取证将跳过）：${JSON.stringify(s)}`);
    else say(`auth(student) = ${SIDENT} via=${s.via} role=${s.role}`);

    const asTeacher = `localStorage.setItem('zhiwei_token', '${t.token}'); localStorage.setItem('zhiwei_user_id', '${t.userId}'); localStorage.setItem('zhiwei_role', 'teacher'); 1`;

    // 教师名下第一个绑定学生（供 /t 行可点 + /t/student 取 id）；只读，不新建。
    await go('/t', 2200);
    await cdp.evaluate(asTeacher);
    const bound = JSON.parse(
      await cdp.evaluate(`(async () => {
        const r = await fetch('/api/teacher/students', { headers: { Authorization: 'Bearer ${t.token}' } });
        const j = await r.json();
        const list = (j.data && j.data.students) || [];
        return JSON.stringify({ count: list.length, first: list[0] || null });
      })()`),
    );
    say(`bound   = 学生数=${bound.count}${bound.first ? ` 首个=${bound.first.nickname}/${bound.first.student_id}/${bound.first.space_id}` : ''}`);

    say('');
    say('== 状态取证 ==');
    await cdp.evaluate(`sessionStorage.removeItem('__probe_teacher_mode'); 1`);

    if (PAGE === 't') {
      await go('/t');
      await measureAndShot('normal', null);

      await cdp.evaluate(`sessionStorage.setItem('__probe_teacher_mode', 'empty'); 1`);
      await go('/t');
      await measureAndShot('empty', 'inject:/api/teacher/students+invites=[]');

      await cdp.evaluate(`sessionStorage.setItem('__probe_teacher_mode', 'fail'); 1`);
      await go('/t');
      await measureAndShot('error', 'inject:/api/teacher/students+invites=500');

      await cdp.evaluate(`sessionStorage.removeItem('__probe_teacher_mode'); 1`);
      await cdp.evaluate(
        `localStorage.setItem('zhiwei_token', '${s.ok ? s.token : t.token}'); localStorage.setItem('zhiwei_user_id', '${s.ok ? s.userId : t.userId}'); localStorage.setItem('zhiwei_role', 'student'); 1`,
      );
      await go('/t');
      await measureAndShot('denied', s.ok ? 'real-403:student-token' : 'skipped:no-student-account');
    } else if (PAGE === 'recommendations') {
      await cdp.evaluate(asTeacher);
      await go('/t/recommendations');
      await measureAndShot('normal', null);

      await cdp.evaluate(`sessionStorage.setItem('__probe_teacher_mode', 'empty'); 1`);
      await go('/t/recommendations');
      await measureAndShot('empty', 'inject:/api/teacher/recommendations=[]');

      await cdp.evaluate(`sessionStorage.setItem('__probe_teacher_mode', 'fail'); 1`);
      await go('/t/recommendations');
      await measureAndShot('error', 'inject:/api/teacher/recommendations=500');

      await cdp.evaluate(`sessionStorage.removeItem('__probe_teacher_mode'); 1`);
      await cdp.evaluate(
        `localStorage.setItem('zhiwei_token', '${s.ok ? s.token : t.token}'); localStorage.setItem('zhiwei_user_id', '${s.ok ? s.userId : t.userId}'); localStorage.setItem('zhiwei_role', 'student'); 1`,
      );
      await go('/t/recommendations');
      await measureAndShot('denied', s.ok ? 'real-403:student-token' : 'skipped:no-student-account');
    } else {
      await cdp.evaluate(asTeacher);
      const first = bound.first;
      if (first) {
        await go(`/t/student/${first.student_id}?space_id=${first.space_id}`);
        await measureAndShot('normal', null);
      } else {
        say('  !! 该教师名下没有绑定学生 —— /t/student 的 normal 态取不到（留痕，不伪造）');
      }

      await cdp.evaluate(`sessionStorage.setItem('__probe_teacher_mode', 'fail'); 1`);
      if (first) {
        await go(`/t/student/${first.student_id}?space_id=${first.space_id}`);
        await measureAndShot('error', 'inject:/api/teacher/students/:id=500');
      }
      await cdp.evaluate(`sessionStorage.removeItem('__probe_teacher_mode'); 1`);

      await go('/t/student/');
      await measureAndShot('missing', 'no-student-id:page-level-error');

      await cdp.evaluate(
        `localStorage.setItem('zhiwei_token', '${s.ok ? s.token : t.token}'); localStorage.setItem('zhiwei_user_id', '${s.ok ? s.userId : t.userId}'); localStorage.setItem('zhiwei_role', 'student'); 1`,
      );
      if (first) {
        await go(`/t/student/${first.student_id}?space_id=${first.space_id}`);
        await measureAndShot('denied', s.ok ? 'real-403:student-token' : 'skipped:no-student-account');
      }
    }

    const payload = {
      tag: 'teacher',
      page: PAGE,
      width: WIDTH,
      height: HEIGHT,
      theme: THEME,
      base: BASE,
      capturedAt: new Date().toISOString(),
      auth: { teacher: { ident: TIDENT, via: t.via }, student: s.ok ? { ident: SIDENT, via: s.via } : null },
      boundStudents: bound.count,
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
