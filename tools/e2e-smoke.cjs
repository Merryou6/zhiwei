/**
 * 前后端联调体检（端到端冒烟）：零依赖 CDP + 真实 Chrome。
 *
 * 【为什么需要它】
 * 前后端是两个进程、经 vite proxy 连接（/api → 127.0.0.1:8787）。
 * 「链路断了」的症状往往只是页面上的一句网络错误，很难一眼定位是
 * proxy 配置、后端没起、还是页面没接 API。这个脚本把整条链路走一遍并逐项断言，
 * 直接告诉你断在哪一环。
 *
 * 【它验证什么】
 *   1) 未登录直达受保护页 → 被路由守卫送回 #/login
 *   2) 经 vite 代理调 /api/auth/register（409 则 login）→ 拿到 token
 *   3) #/spaces 显示真实空间（数据来自后端 local_db）
 *   4) #/report 展示的百分比 **等于 /api/report/summary 的返回值**
 *      —— 这条是关键：排除「前端写死数据」的假象
 *   5) #/graph 的 canvas 真的画了像素（echarts CanvasRenderer，DOM 里没有文字节点）
 *   6) 全程零未捕获 JS 异常
 *
 * 【怎么用】
 *   先起服务：npm run all        （或分别 npm run api / npm run dev）
 *   再跑体检：node tools/e2e-smoke.cjs
 *
 * 【环境变量】
 *   ZHIWEI_E2E_BASE    前端地址，默认 http://127.0.0.1:5173
 *   ZHIWEI_E2E_IDENT   测试账号，默认 e2e_smoke（不存在则自动注册）
 *   ZHIWEI_E2E_PASS    测试密码，默认 e2e_test_2026
 *   ZHIWEI_E2E_SHOTS   截图输出目录，默认 <系统临时目录>/zhiwei-e2e-shots
 *
 * 【退出码】0 = 全部通过；1 = 有失败项或环境异常。
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJ = path.resolve(__dirname, '..');
const BASE = process.env.ZHIWEI_E2E_BASE ?? 'http://127.0.0.1:5173';
const IDENT = process.env.ZHIWEI_E2E_IDENT ?? 'e2e_smoke';
const PASS = process.env.ZHIWEI_E2E_PASS ?? 'e2e_test_2026';
const OUT = process.env.ZHIWEI_E2E_SHOTS ?? path.join(os.tmpdir(), 'zhiwei-e2e-shots');
const LOG = path.join(OUT, 'report.txt');
const PORT = Number(process.env.ZHIWEI_E2E_CDP_PORT ?? 9333);
const W = 1440;
const H = 900;

const log = [];
function flush(line) {
  if (line !== undefined) log.push(line);
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(LOG, log.join('\n'), 'utf8');
  } catch {
    /* ignore */
  }
}
process.on('uncaughtException', (e) => {
  flush('!! UNCAUGHT: ' + (e.stack || e));
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  flush('!! REJECT: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.ZHIWEI_E2E_CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    // macOS Edge（2026-09-24：本机无 Chrome 仅有 Edge，Chromium 内核 CDP 通用）
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const p of candidates) if (fs.existsSync(p)) return p;
  throw new Error('未找到 Chrome/Edge，可用 ZHIWEI_E2E_CHROME 指定路径');
}

/** 极简 CDP 客户端：Node 18+ 自带 WebSocket，无需 puppeteer/playwright。 */
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
      // 加载期异常只有 CDP 事件能抓到（window.onerror 会漏掉）
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        client.exceptions.push((d.exception && d.exception.description) || d.text || 'unknown');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        client.exceptions.push(
          '[console.error] ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '),
        );
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

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    flush('  [OK]   ' + name);
  } else {
    fail += 1;
    flush('  [FAIL] ' + name + (detail ? '   → ' + String(detail).slice(0, 220) : ''));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chromePath = findChrome();
  flush('base   = ' + BASE);
  flush('chrome = ' + chromePath);
  flush('shots  = ' + OUT);

  const profile = path.join(os.tmpdir(), 'zhiwei-e2e-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      // --no-sandbox：受限沙箱（如 LearnBuddy 命令沙箱）里，Chromium 自身沙箱层
      // 会因权限被拒触发 SIGTRAP 崩溃——表现为 WS 1006 断开、本脚本 pending 永不
      // 结算后静默退出(0)。加此开关后 2026-09-24 实测全链路 1.5s 跑通（仅 e2e
      // 一次性临时 profile，风险可接受；agent-browser 同样这么跑）。
      '--no-sandbox',
      '--hide-scrollbars',
      `--window-size=${W},${H}`,
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
    flush('!! Chrome 未就绪（CDP 端口 ' + PORT + ' 无响应）');
    chrome.kill();
    process.exit(1);
  }
  flush('browser= ' + version.Browser);

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = await CDP.attach(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: false,
  });

  async function goto(url) {
    const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
    await cdp.send('Page.navigate', { url });
    await loaded;
    await sleep(700);
  }
  async function shot(name) {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
    flush('  [shot] ' + name + '.png  ' + (fs.statSync(file).size / 1024).toFixed(0) + 'KB');
  }

  try {
    // ------------------------------------------------ 1. 路由守卫
    flush('\n=== 1. 未登录直达受保护页 ===');
    await goto(`${BASE}/?e2e=1#/spaces`);
    const hash1 = await cdp.ev('location.hash');
    check('被重定向到 #/login', hash1 === '#/login', 'hash=' + hash1);
    const txt1 = await cdp.ev('document.body.innerText.slice(0,400)');
    check('登录页有可交互内容', typeof txt1 === 'string' && txt1.length > 15, txt1);
    await shot('01-登录页');

    // ------------------------------------------------ 2. 鉴权（经 proxy）
    flush('\n=== 2. 经 vite 代理调鉴权接口（不存在则注册）===');
    const authRaw = await cdp.ev(`(async () => {
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
    const auth = JSON.parse(authRaw);
    check('鉴权接口 code=0（走同源代理）', auth.ok === true, authRaw);

    // ------------------------------------------------ 3. 空间页
    flush('\n=== 3. 进入 #/spaces ===');
    await goto(`${BASE}/?e2e=2#/spaces`);
    await sleep(500);
    const hash2 = await cdp.ev('location.hash');
    const txt2 = await cdp.ev('document.body.innerText');
    check('未被踢回登录，停在 #/spaces', hash2 === '#/spaces', 'hash=' + hash2);
    check('页面出现真实空间名', String(txt2).includes('初中数学'), String(txt2).slice(0, 120));
    await shot('02-学习空间');

    const spaceId = await cdp.ev(`(async () => {
      const r = await fetch('/api/space/list', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') }
      });
      const j = await r.json();
      return (j.data && j.data.spaces && j.data.spaces[0]) ? j.data.spaces[0].space_id : '';
    })()`);
    check('能取到 space_id', !!spaceId, spaceId);
    await cdp.ev(`localStorage.setItem('zhiwei_active_space', '${spaceId}'); 1`);

    // 保证报告页有数据可验（自报幂等：同一组 level 重复提交结果一致）
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

    // ------------------------------------------------ 4. 报告页
    flush('\n=== 4. 进入 #/report ===');
    await goto(`${BASE}/?e2e=3#/report`);
    await sleep(1200);
    const txt4 = await cdp.ev('document.body.innerText');
    check('报告页渲染出内容', String(txt4).length > 100, String(txt4).slice(0, 120));
    check('出现知识点名', /二次函数|一元二次方程|代数式/.test(String(txt4)));
    check('出现掌握度分档（四状态带）', /已掌握|基本掌握|不稳定|待巩固/.test(String(txt4)));

    const apiPct = await cdp.ev(`(async () => {
      const r = await fetch('/api/report/summary?space_id=' + localStorage.getItem('zhiwei_active_space'), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('zhiwei_token') }
      });
      const j = await r.json();
      const kp = (j.data.mastery || []).find((m) => m.kp_id === 'math.cz.algebra.basic');
      return kp ? String(Math.round(kp.mastery * 100)) : '';
    })()`);
    check(
      '页面百分比 === API 返回值（证明数据非前端写死）',
      !!apiPct && String(txt4).includes(apiPct + '%'),
      'api=' + apiPct + '%',
    );
    await shot('03-学习报告');

    // ------------------------------------------------ 5. 图谱页
    flush('\n=== 5. 进入 #/graph ===');
    await goto(`${BASE}/?e2e=4#/graph`);
    await sleep(1800);
    const canvasCount = await cdp.ev(`document.querySelectorAll('canvas').length`);
    const txt5 = await cdp.ev('document.body.innerText');
    // 图谱用 echarts CanvasRenderer：节点与标签都画在 canvas 上，
    // DOM 里没有文字节点 —— 所以只能采样画布像素，不能靠 innerText 找标签。
    check('图谱用 canvas 渲染', canvasCount > 0, 'canvas=' + canvasCount);
    const painted = await cdp.ev(`(() => {
      const c = document.querySelector('canvas');
      if (!c) return -1;
      try {
        const ctx = c.getContext('2d');
        if (!ctx) return -2;
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let hit = 0;
        for (let i = 3; i < d.length; i += 4000) if (d[i] > 8) hit++;
        return hit;
      } catch (e) { return -3; }
    })()`);
    check('canvas 已实际绘制像素（非空白）', painted > 0, 'sampled=' + painted);
    check('图例（DOM）显示四档', /已掌握|基本掌握|不稳定|待巩固/.test(String(txt5)), String(txt5).slice(0, 100));
    await shot('04-知识图谱');

    // ------------------------------------------------ 6. 异常
    flush('\n=== 6. 运行期 JS 异常 ===');
    const ex = cdp.exceptions.filter((e) => e && !/favicon/i.test(String(e)));
    check('无未捕获 JS 异常', ex.length === 0, ex.slice(0, 3).join(' | '));
  } finally {
    flush(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`);
    await cdp.send('Browser.close').catch(() => {});
    await sleep(300);
    chrome.kill();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  process.exit(fail === 0 ? 0 : 1);
}

void main();
