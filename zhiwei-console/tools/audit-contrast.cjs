/**
 * 真实渲染下的对比度审计（改完必验）。
 * 逐页加载 → 遍历所有可见文字 → 合成实际背景 → 算 WCAG 对比度 → 报失败项。
 * 阈值：正文 4.5:1，大字（≥18.66px，或 ≥14px 且 600+）3:1。禁用态按规范豁免。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const PROJ = path.resolve(__dirname, '..');
const URL_BASE = 'file:///' + path.join(PROJ, 'index.html').replace(/\\/g, '/');
const W = 1600, H = 1000, DSF = 1;

const PAGES = [
  ['学习空间', '#/space'], ['测评', '#/assessment'], ['对话辅导', '#/chat'],
  ['知识图谱', '#/graph'], ['学习报告', '#/report'], ['云盘', '#/drive']
];

const log = [];
const LOGPATH = path.resolve(PROJ, '..', '_contrast.txt');
function flush(m) { if (m) log.push(m); try { fs.writeFileSync(LOGPATH, log.join('\n'), 'utf8'); } catch (e) {} }
process.on('uncaughtException', (e) => { flush('UNCAUGHT: ' + ((e && e.stack) || e)); process.exit(1); });
process.on('unhandledRejection', (e) => { flush('REJECT: ' + ((e && e.stack) || e)); process.exit(1); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(u) { return fetch(u).then((r) => r.json()); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map(); }
  static async attach(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && c.pending.has(msg.id)) {
        const p = c.pending.get(msg.id); c.pending.delete(msg.id);
        msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
      } else if (msg.method) {
        const w = c.events.get(msg.method) || []; c.events.set(msg.method, []); w.forEach((f) => f(msg.params));
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
  once(m) { return new Promise((res) => { const a = this.events.get(m) || []; a.push(res); this.events.set(m, a); }); }
}

const AUDIT = `(function(){
  function parse(c){ var m=String(c).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(parseFloat);
    return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function lin(v){ v/=255; return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
  function lum(c){ return 0.2126*lin(c.r)+0.7152*lin(c.g)+0.0722*lin(c.b); }
  function over(f,b){ var a=f.a; return {r:f.r*a+b.r*(1-a), g:f.g*a+b.g*(1-a), b:f.b*a+b.b*(1-a), a:1}; }
  function ratio(a,b){ var l1=lum(a), l2=lum(b); if(l1<l2){var t=l1;l1=l2;l2=t;} return (l1+0.05)/(l2+0.05); }
  function hex(c){ return '#'+[c.r,c.g,c.b].map(function(v){return Math.round(v).toString(16).padStart(2,'0');}).join(''); }

  var root = parse(getComputedStyle(document.documentElement).backgroundColor) || {r:22,g:41,b:69,a:1};
  function effBg(el){
    var layers=[], n=el;
    while(n && n.nodeType===1){
      var cs=getComputedStyle(n);
      var bg=parse(cs.backgroundColor);
      if(bg && bg.a>0.001){ layers.push(bg); if(bg.a>=0.999) break; }
      n=n.parentElement;
    }
    var base={r:root.r,g:root.g,b:root.b,a:1};
    for(var i=layers.length-1;i>=0;i--) base=over(layers[i],base);
    return base;
  }
  function path(el){
    var s=[], n=el;
    while(n && n.nodeType===1 && s.length<4){
      var t=n.tagName.toLowerCase();
      if(n.id) { s.unshift(t+'#'+n.id); break; }
      if(n.className && typeof n.className==='string' && n.className.trim()) t+='.'+n.className.trim().split(/\\s+/).slice(0,2).join('.');
      s.unshift(t); n=n.parentElement;
    }
    return s.join(' > ');
  }

  var out=[], skip=0;
  Array.prototype.forEach.call(document.querySelectorAll('*'), function(el){    if(el.closest('.tip')) { return; }
    if(el.disabled || el.getAttribute('aria-disabled')==='true' || el.hasAttribute('disabled')) { skip++; return; }
    var txt='';
    Array.prototype.forEach.call(el.childNodes, function(n){ if(n.nodeType===3) txt+=n.nodeValue; });
    txt=txt.replace(/\\s+/g,' ').trim();
    if(txt.length<1) return;
    if(!el.getClientRects().length) return;
    var cs=getComputedStyle(el);
    if(cs.visibility==='hidden' || parseFloat(cs.opacity)<0.5) return;
    var fs=parseFloat(cs.fontSize); if(!fs || fs<9) return;
    var isSvg = el.namespaceURI==='http://www.w3.org/2000/svg';
    var fg = parse(isSvg ? cs.fill : cs.color); if(!fg) return;
    var bg = effBg(el);
    var eff = over(fg, bg);
    var r = ratio(eff, bg);
    var fw = parseInt(cs.fontWeight,10)||400;
    var large = fs>=18.66 || (fs>=14 && fw>=600);
    var need = large?3:4.5;
    if(r + 0.005 < need){
      out.push({r:+r.toFixed(2), need:need, fs:+fs.toFixed(1), fw:fw,
                fg:hex(eff), bg:hex(bg), text:txt.slice(0,34), sel:path(el)});
    }
  });
  /* 令牌级校验：掌握程度四色 / 强调色 在四种表面上的对比度 */
  var cs0 = getComputedStyle(document.documentElement);
  function pg(v){
    v=String(v).trim();
    if(v.charAt(0)==='#'){ var h=v.slice(1); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}; }
    return parse(v);
  }
  var TK = function(n){ return pg(cs0.getPropertyValue(n)); };
  var surfs = [['canvas',TK('--canvas')],['surface',TK('--surface')],['raised',TK('--raised')],['sunken',TK('--sunken')]];
  var inks = [['--ink',TK('--ink'),4.5],['--ink-2',TK('--ink-2'),4.5],['--ink-label',TK('--ink-label'),4.5],['--accent',TK('--accent'),4.5],
              ['--band-solid',TK('--band-solid'),3],['--band-basic',TK('--band-basic'),3],
              ['--band-waver',TK('--band-waver'),3],['--band-weak',TK('--band-weak'),3]];
  var tokens = [];
  inks.forEach(function(ik){ surfs.forEach(function(sf){
    if(!ik[1] || !sf[1]) return;
    tokens.push({ink:ik[0], on:sf[0], r:+ratio(ik[1],sf[1]).toFixed(2), need:ik[2]});
  }); });

  return JSON.stringify({failed: out.length, skippedDisabled: skip, items: out.slice(0,40), tokens: tokens});
})()`;

(async function main() {
  const profile = path.join(PROJ, '..', '_chrome-profile-audit');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60; i++) { try { ver = await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(250); } }
  if (!ver) { flush('Chrome 未就绪'); process.exit(1); }

  const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  const cdp = await CDP.attach(list.filter((t) => t.type === 'page')[0].webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });

  let totalFail = 0;
  for (let i = 0; i < PAGES.length; i++) {
    const [name, hash] = PAGES[i];
    const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
    await cdp.send('Page.navigate', { url: URL_BASE + '?audit=1&p=' + i + hash });
    await loaded;
    await sleep(260);
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
    const res = await cdp.send('Runtime.evaluate', { expression: AUDIT, returnByValue: true });
    const data = JSON.parse(res.result.value);
    totalFail += data.failed;
    log.push('=== ' + name + '  失败 ' + data.failed + ' 项（豁免禁用态 ' + data.skippedDisabled + ' 项）');
    data.items.forEach((it) => {
      log.push('  ' + it.r + ':1 (需 ' + it.need + ')  ' + it.fs + 'px/' + it.fw +
        '  文字 ' + it.fg + ' 底色 ' + it.bg + '  「' + it.text + '」  ' + it.sel);
    });
    if (i === 0) {
      const bad = data.tokens.filter((t) => t.r + 0.005 < t.need);
      log.push('--- 令牌校验（掌握程度色/强调色 在 4 种表面上的对比度，需 ≥4.5 文字 / ≥3 图形）');
      data.tokens.forEach((t) => {
        log.push('    ' + t.ink.padEnd(13) + ' on ' + t.on.padEnd(8) + t.r + ':1  ' +
          (t.r + 0.005 < t.need ? 'FAIL' : 'ok'));
      });
      log.push('--- 令牌不达标数 = ' + bad.length);
      flush();
    }
  }
  flush('TOTAL_FAILED=' + totalFail);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})();
