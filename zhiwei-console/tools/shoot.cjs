/**
 * 用 Chrome DevTools Protocol 做整页高清截图（零依赖，Node 22 自带 WebSocket）。
 * 每页按真实内容高度裁切，deviceScaleFactor = 2。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const PROJ = path.resolve(__dirname, '..');
const OUT = path.join(PROJ, 'shots');
const URL_BASE = 'file:///' + path.join(PROJ, 'index.html').replace(/\\/g, '/');
const W = 1600, H0 = 1000, DSF = 2;

const PAGES = [
  ['01-学习空间', '#/space'],
  ['02-测评', '#/assessment'],
  // 对话页是视口型页面（内部滚动、输入区贴底），按视口高度截，不整页扩高
  ['03-对话辅导', '#/chat', 'viewport'],
  ['04-知识图谱', '#/graph'],
  ['05-学习报告', '#/report'],
  ['06-云盘', '#/drive']
];

const log = [];
const LOGPATH = path.resolve(PROJ, 'reports', 'shoot-report.txt');
function flush(msg) {
  if (msg) log.push(msg);
  try { fs.writeFileSync(LOGPATH, log.join('\n'), 'utf8'); } catch (e) {}
}
process.on('uncaughtException', (e) => { flush('UNCAUGHT: ' + ((e && e.stack) || e)); process.exit(1); });
process.on('unhandledRejection', (e) => { flush('REJECT: ' + ((e && e.stack) || e)); process.exit(1); });
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJSON(url) {
  const res = await fetch(url);
  return res.json();
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map(); }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const p = c.pending.get(msg.id); c.pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      } else if (msg.method) {
        const waiters = c.events.get(msg.method) || [];
        c.events.set(msg.method, []);
        waiters.forEach((w) => w(msg.params));
      }
    };
    return c;
  }
  send(method, params) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, 30000);
    });
  }
  once(method) { return new Promise((res) => { const a = this.events.get(method) || []; a.push(res); this.events.set(method, a); }); }
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(LOGPATH), { recursive: true });
  flush('node=' + process.version + ' ws=' + typeof WebSocket + ' chromeExists=' + fs.existsSync(CHROME));
  const profile = path.join(PROJ, '..', '_chrome-profile');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  // 等待 DevTools 端点
  let ver = null;
  for (let i = 0; i < 60; i++) {
    try { ver = await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(250); }
  }
  if (!ver) { flush('Chrome 未就绪，端口 ' + PORT + ' 无响应'); process.exit(1); }
  log.push('chrome=' + ver['Browser']);

  const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  const target = list.filter((t) => t.type === 'page')[0];
  const cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  let ok = 0;
  for (let pi = 0; pi < PAGES.length; pi++) {
    const name = PAGES[pi][0], hash = PAGES[pi][1];
    // 每页给唯一的 query，强制整页导航（只改 hash 属于同文档导航，不会触发 load 事件）
    const url = URL_BASE + '?shot=1&p=' + pi + hash;
    // 1) 先在标准视口下加载并量出内容高度
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: W, height: H0, deviceScaleFactor: DSF, mobile: false
    });
    const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
    await cdp.send('Page.navigate', { url });
    await loaded;
    await sleep(320);
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
    await sleep(200);

    const hRes = await cdp.send('Runtime.evaluate', {
      expression: 'Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)',
      returnByValue: true
    });
    const h = PAGES[pi][2] === 'viewport'
      ? H0
      : Math.max(H0, Math.min(4000, Math.ceil(hRes.result.value)));

    // 2) 需要时扩展视口到整页高度再截
    if (h > H0) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: W, height: h, deviceScaleFactor: DSF, mobile: false
      });
      await sleep(220);
    }

    // 顺手把该页的渲染自检结果带回来
    const chk = await cdp.send('Runtime.evaluate', {
      expression: '(function(){var e=document.querySelectorAll(".page *").length;' +
        'var f=document.getElementById("graphFrame");' +
        'var nx=document.querySelectorAll(".node").length;' +
        'var em=document.querySelectorAll(".edge").length;' +
        'return JSON.stringify({els:e,nodes:nx,edges:em,frameW:f?f.clientWidth:0,tip:!!document.getElementById("graphTip")});})()',
      returnByValue: true
    });

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    log.push(`${name}  hash=${hash}  cssHeight=${h}  ->  ${W * DSF}x${h * DSF}  ${kb}KB  ${chk.result.value}`);
    ok++;
    flush();
  }

  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  flush('RESULT ok=' + ok + '/' + PAGES.length);
  process.exit(ok === PAGES.length ? 0 : 1);
})();
