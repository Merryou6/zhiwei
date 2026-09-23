/**
 * 元素级高倍裁切：按选择器截取某个元素，用 DSF=3 放大，用于核对对齐/间距细节。
 * 用法：node tools/crop.cjs <pageIndex> <selector> <outName>
 * 例：  node tools/crop.cjs 4 ".table" check-report-table
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9335;
const PROJ = path.resolve(__dirname, '..');
const URL_BASE = 'file:///' + path.join(PROJ, 'index.html').replace(/\\/g, '/');
const OUT = path.join(PROJ, 'shots', 'crops');
const PAGES = ['#/space', '#/assessment', '#/chat', '#/graph', '#/report', '#/drive'];

const TARGETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'crop-targets.json'), 'utf8'));

const log = [];
const LOGPATH = path.resolve(PROJ, '..', '_crop.txt');
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
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + path.join(PROJ, '..', '_chrome-profile-crop'),
    'about:blank'
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60; i++) { try { ver = await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(250); } }
  if (!ver) { flush('Chrome 未就绪'); process.exit(1); }

  const cdp = await CDP.attach((await getJSON(`http://127.0.0.1:${PORT}/json/list`)).filter((t) => t.type === 'page')[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const DSF = 3;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: DSF, mobile: false });

  let lastPage = -1;
  for (const t of TARGETS) {
    if (t.page !== lastPage) {
      const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
      await cdp.send('Page.navigate', { url: URL_BASE + '?shot=1&c=' + t.page + PAGES[t.page] });
      await loaded;
      await sleep(320);
      await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
      await sleep(150);
      lastPage = t.page;
    }
    const box = await cdp.send('Runtime.evaluate', {
      expression: `(function(){var e=document.querySelector(${JSON.stringify(t.sel)}); if(!e) return 'null';
        var r=e.getBoundingClientRect(); return JSON.stringify({x:r.x,y:r.y,w:r.width,h:r.height});})()`,
      returnByValue: true
    });
    if (box.result.value === 'null') { flush('MISS ' + t.sel); continue; }
    const b = JSON.parse(box.result.value);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, fromSurface: true,
      clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: b.w + 16, height: b.h + 16, scale: DSF }
    });
    const f = path.join(OUT, t.name + '.png');
    fs.writeFileSync(f, Buffer.from(shot.data, 'base64'));
    flush(`${t.name}  ${t.sel}  box=${b.w.toFixed(0)}x${b.h.toFixed(0)} -> ${((b.w + 16) * DSF).toFixed(0)}x${((b.h + 16) * DSF).toFixed(0)}  ${(fs.statSync(f).size / 1024).toFixed(0)}KB`);

    // 顺便量一下该容器内 th/td 的右边缘，验证列对齐
    if (t.cols) {
      const cols = await cdp.send('Runtime.evaluate', {
        expression: `(function(){var t=document.querySelector(${JSON.stringify(t.sel)});
          function edges(sel){ return Array.prototype.map.call(t.querySelectorAll(sel), function(e){
            var r=e.getBoundingClientRect(); return {t:e.textContent.trim().slice(0,10), l:+r.left.toFixed(1), r:+r.right.toFixed(1)}; }); }
          return JSON.stringify({th:edges('thead th'), td:edges('tbody tr:first-child td')});})()`,
        returnByValue: true
      });
      const c = JSON.parse(cols.result.value);
      c.th.forEach((x, i) => {
        const y = c.td[i];
        flush(`  col${i} th「${x.t}」右缘 ${x.r}  /  td「${y ? y.t : '-'}」右缘 ${y ? y.r : '-'}  差 ${y ? (x.r - y.r).toFixed(1) : '-'}`);
      });
    }
  }

  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})();
