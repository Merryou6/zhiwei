/**
 * 任意 DOM 量测：把一组表达式丢进页面求值并打印，用于核对比例、对齐、间距。
 * 读 tools/measure-targets.json
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9336;
const PROJ = path.resolve(__dirname, '..');
const URL_BASE = 'file:///' + path.join(PROJ, 'index.html').replace(/\\/g, '/');
const PAGES = ['#/space', '#/assessment', '#/chat', '#/graph', '#/report', '#/drive'];
const T = JSON.parse(fs.readFileSync(path.join(__dirname, process.argv[2] || 'measure-targets.json'), 'utf8'));

const log = [];
const LOGPATH = path.resolve(PROJ, '..', process.argv[3] || '_measure.txt');
function flush(m) { if (m) log.push(m); try { fs.writeFileSync(LOGPATH, log.join('\n'), 'utf8'); } catch (e) {} }
process.on('uncaughtException', (e) => { flush('UNCAUGHT: ' + ((e && e.stack) || e)); process.exit(1); });
process.on('unhandledRejection', (e) => { flush('REJECT: ' + ((e && e.stack) || e)); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = (u) => fetch(u).then((r) => r.json());

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map(); }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const p = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
      } else if (m.method) { const w = c.events.get(m.method) || []; c.events.set(m.method, []); w.forEach((f) => f(m.params)); }
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
  once(m) { return new Promise((res) => { const a = this.events.get(m) || []; a.push(res); this.events.set(m, a); }); }
}

(async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(PROJ, '..', '_chrome-profile-m'),
    'about:blank'
  ], { stdio: 'ignore' });
  let ver = null;
  for (let i = 0; i < 60; i++) { try { ver = await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(250); } }
  if (!ver) { flush('Chrome 未就绪'); process.exit(1); }
  const cdp = await CDP.attach((await getJSON(`http://127.0.0.1:${PORT}/json/list`)).filter((t) => t.type === 'page')[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  let last = '';
  for (const t of T) {
    const w = t.width || 1600;
    const key = t.page + '@' + w;
    if (key !== last) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false });
      const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
      await cdp.send('Page.navigate', { url: URL_BASE + '?shot=1&m=' + t.page + '-' + w + PAGES[t.page] });
      await loaded;
      await sleep(300);
      await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
      last = key;
    }
    const r = await cdp.send('Runtime.evaluate', { expression: t.expr, returnByValue: true });
    flush('### ' + t.label + '\n' + r.result.value);
  }
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})();
