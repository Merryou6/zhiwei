/**
 * 对话页交互验收：在真实浏览器里逐条操作并断言，不靠肉眼看。
 * 覆盖 发送 / Enter / Shift+Enter / 输入法组合态 / 传图 / 候选入口 / 切页续存 / 回复内容真实性。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9444;
const PROJ = path.resolve(__dirname, '..');
const SHOTS = path.join(PROJ, 'shots', 'chat');
const LOGPATH = path.resolve(PROJ, 'reports', 'chat-test.txt');
const URL_BASE = 'file:///' + path.join(PROJ, 'index.html').replace(/\\/g, '/');
const W = 1600, H0 = 1000, DSF = 2;

const log = [];
const results = [];
function flush(msg) {
  if (msg) log.push(msg);
  try { fs.writeFileSync(LOGPATH, log.join('\n'), 'utf8'); } catch (e) {}
}
function check(name, pass, detail) {
  results.push(pass);
  flush((pass ? 'PASS  ' : 'FAIL  ') + name + (detail !== undefined && detail !== '' ? '   [' + detail + ']' : ''));
}
process.on('uncaughtException', (e) => { flush('UNCAUGHT: ' + ((e && e.stack) || e)); process.exit(1); });
process.on('unhandledRejection', (e) => { flush('REJECT: ' + ((e && e.stack) || e)); process.exit(1); });
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function getJSON(url) { return (await fetch(url)).json(); }

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = new Map(); this.hooks = new Map(); }
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
        (c.hooks.get(msg.method) || []).forEach((f) => f(msg.params));
        const waiters = c.events.get(msg.method) || [];
        c.events.set(msg.method, []);
        waiters.forEach((w) => w(msg.params));
      }
    };
    return c;
  }
  on(method, fn) { const a = this.hooks.get(method) || []; a.push(fn); this.hooks.set(method, a); }
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
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(path.dirname(LOGPATH), { recursive: true });
  flush('node=' + process.version + '  chrome=' + fs.existsSync(CHROME));

  const profile = path.join(PROJ, '..', '_chrome-profile-chat');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    '--allow-file-access-from-files',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
    'about:blank'
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60; i++) {
    try { ver = await getJSON(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await sleep(250); }
  }
  if (!ver) { flush('Chrome 未就绪'); process.exit(1); }
  flush('browser=' + ver['Browser']);

  const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
  const target = list.filter((t) => t.type === 'page')[0];
  const cdp = await CDP.attach(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H0, deviceScaleFactor: DSF, mobile: false });

  /* 捕获加载期与运行期的 JS 异常（window.onerror 抓不到早于它安装的错误） */
  const pageErrors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    pageErrors.push((d.text || '') + ' ' + ((d.exception || {}).description || ''));
  });

  async function ev(expr) {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails.exception && (r.exceptionDetails.exception.description || r.exceptionDetails.exception.value);
      throw new Error('页面异常: ' + (d || JSON.stringify(r.exceptionDetails)));
    }
    return r.result.value;
  }
  async function installErrorTrap() {
    await ev('window.__errs=[];' +
      'window.addEventListener("error",function(e){window.__errs.push(String(e.message))});' +
      'window.addEventListener("unhandledrejection",function(e){window.__errs.push("reject:"+String(e.reason))});1');
  }
  async function goto(tag) {
    const loaded = Promise.race([cdp.once('Page.loadEventFired'), sleep(12000)]);
    /* 交互测试刻意不开 ?shot=1 —— 截图模式会把思考延迟压成 0，断言时序就失真了 */
    await cdp.send('Page.navigate', { url: URL_BASE + '?t=' + tag + '#/chat' });
    await loaded;
    await sleep(380);
    await cdp.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
    await installErrorTrap();
  }
  async function waitDone() {
    for (let i = 0; i < 90; i++) {
      if (await ev('!document.querySelector(".thinking")')) return true;
      await sleep(100);
    }
    return false;
  }
  async function type(text) {
    await ev(`(function(){var i=document.querySelector('.composer-input');i.value=${JSON.stringify(text)};` +
      `i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  }
  async function clickSend() { await ev(`document.querySelector('[data-act="send"]').click()`); }
  async function shot(name) {
    const s = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const f = path.join(SHOTS, name + '.png');
    fs.writeFileSync(f, Buffer.from(s.data, 'base64'));
    flush('        -> shots/chat/' + name + '.png  ' + (fs.statSync(f).size / 1024).toFixed(0) + 'KB');
  }
  async function lastAiText() {
    return ev(`(function(){var m=document.querySelectorAll('.chat-stream .msg');` +
      `for(var i=m.length-1;i>=0;i--){if(!m[i].classList.contains('msg-user'))return m[i].innerText}` +
      `return ''})()`);
  }
  const sendDisabled = () => ev(`document.querySelector('[data-act="send"]').disabled === true`);

  /* ======================================================== 会话前半 ---- */
  flush('--- 第一次进入（带历史消息） ---');
  await goto(0);

  const initMsgs = await ev(`document.querySelectorAll('.chat-stream .msg').length`);
  check('初始渲染 3 条历史消息', initMsgs === 3, '实际 ' + initMsgs);
  check('空输入时发送按钮禁用', await sendDisabled());
  check('禁用态不是 primary 蓝底',
    (await ev(`getComputedStyle(document.querySelector('[data-act="send"]')).backgroundColor`)) !== 'rgb(66, 165, 245)',
    await ev(`getComputedStyle(document.querySelector('[data-act="send"]')).backgroundColor`));
  check('输入区提示与行为一致（写明 Enter 发送）',
    (await ev(`document.querySelector('.composer-hint').textContent`)).indexOf('Enter 发送') >= 0);
  await shot('01-初始');

  await type('一般式互化直接给我答案');
  check('输入后发送按钮启用', !(await sendDisabled()));

  await clickSend();
  check('点击后立刻出现思考态', await ev(`!!document.querySelector('.thinking')`));
  check('思考期间按钮回到禁用（防连点）', await sendDisabled());
  await shot('02-思考中');
  check('思考态自行结束', await waitDone());

  const userCount = await ev(`document.querySelectorAll('.chat-stream .msg-user').length`);
  check('用户消息已追加', userCount === 2, '实际 ' + userCount);
  const t3 = await lastAiText();
  check('索要答案时不直接给，改为定位卡点', t3.indexOf('先回答我一个小问题') >= 0);
  check('引用真实错误次数（错过 4 次）', t3.indexOf('错过 4 次') >= 0);
  check('引用真实正确率（45%）', t3.indexOf('45%') >= 0);
  check('回复带知识点标签',
    (await ev(`(function(){var m=document.querySelectorAll('.chat-stream .msg');` +
      `for(var i=m.length-1;i>=0;i--){if(!m[i].classList.contains('msg-user'))` +
      `return (m[i].querySelector('.tag')||{}).textContent||''}return ''})()`)) === '二次函数 · 一般式↔顶点式');

  flush('--- 键盘行为 ---');
  await type('为什么一般式和顶点式要互化');
  await ev(`(function(){var i=document.querySelector('.composer-input');` +
    `i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true,cancelable:true}));return 1})()`);
  check('Enter（无 Shift）触发发送', await ev(`!!document.querySelector('.thinking')`));
  await waitDone();
  check('问「为什么」时给因果解释', (await lastAiText()).indexOf('看不出顶点') >= 0);

  const n5a = await ev(`document.querySelectorAll('.chat-stream .msg').length`);
  await type('第一行');
  await ev(`(function(){var i=document.querySelector('.composer-input');` +
    `i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,shiftKey:true,bubbles:true,cancelable:true}));return 1})()`);
  check('Shift+Enter 不发送', (await ev(`document.querySelectorAll('.chat-stream .msg').length`)) === n5a);

  await ev(`(function(){var i=document.querySelector('.composer-input');` +
    `var e=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});` +
    `Object.defineProperty(e,'isComposing',{value:true});i.dispatchEvent(e);return 1})()`);
  check('输入法选词回车不误发', (await ev(`document.querySelectorAll('.chat-stream .msg').length`)) === n5a);

  flush('--- 卡点分支 ---');
  await type('不知道');
  await clickSend();
  await waitDone();
  check('说「不知道」时给三步引导',
    (await ev(`(function(){var m=document.querySelectorAll('.chat-stream .msg');` +
      `return m[m.length-1].querySelectorAll('.steps li').length})()`)) === 3);
  check('分步引导沿用当前话题',
    (await lastAiText()).indexOf('顶点式') >= 0, (await lastAiText()).slice(0, 24).replace(/\n/g, ' '));

  flush('--- 传图读题 ---');
  await ev(`document.querySelector('[data-act="image"]').click()`);
  check('传图后附件条出现', await ev(`document.querySelector('.composer-attach').classList.contains('is-on')`));
  check('有附件时无文字也可发送', !(await sendDisabled()));
  await clickSend();
  await waitDone();
  check('发出的消息带图片缩略', await ev(`!!document.querySelector('.chat-stream .msg-user .msg-photo')`));
  check('回复带识图结果卡', await ev(`!!document.querySelector('.chat-stream .msg:not(.msg-user) .ocr-card')`));
  check('附件条发送后收起', await ev(`!document.querySelector('.composer-attach').classList.contains('is-on')`));
  await shot('03-传图后');

  flush('--- 切页续存 ---');
  const n9 = await ev(`document.querySelectorAll('.chat-stream .msg').length`);
  await ev(`location.hash='#/graph'`);
  await sleep(520);
  await ev(`location.hash='#/chat'`);
  await sleep(520);
  check('切到图谱再回来对话仍在', (await ev(`document.querySelectorAll('.chat-stream .msg').length`)) === n9, n9 + ' 条');
  check('回来后输入区可继续用', await ev(`!!document.querySelector('.composer-input')`));
  check('回来后发送按钮状态被重算', await sendDisabled());

  flush('--- 数据一致性 / 错误 ---');
  const real = await ev(`(function(){var n=null;window.ZW_GRAPH.nodes.forEach(function(x){` +
    `if(x.short==='一般式↔顶点式')n=x});` +
    `return JSON.stringify({acc:n.accuracy,err:n.errors,band:n.band})})()`);
  check('回复引用的数字来自图谱真实字段',
    real.indexOf('"acc":45') >= 0 && real.indexOf('"err":4') >= 0, real);
  const errs = await ev(`JSON.stringify(window.__errs||[])`);
  check('页面无 JS 报错', errs === '[]' && pageErrors.length === 0,
    errs + (pageErrors.length ? ' 异常:' + pageErrors.slice(0, 2).join(' | ') : ''));

  /* 对话页靠内部滚动，不该为截图拉长视口；分两屏记录长会话 */
  await ev(`(function(){var s=document.querySelector('.chat-stream');s.scrollTop=0;return 1})()`);
  await sleep(320);
  await shot('04-会话-上');
  await ev(`(function(){var s=document.querySelector('.chat-stream');s.scrollTop=s.scrollHeight;return 1})()`);
  await sleep(320);
  await shot('05-会话-下');

  /* ======================================================== 全新会话 ---- */
  flush('--- 重新进入（空白会话） ---');
  await goto(1);
  check('重新进入回到 3 条初始消息',
    (await ev(`document.querySelectorAll('.chat-stream .msg').length`)) === 3);

  await type('今天这道题好烦');
  await clickSend();
  await waitDone();
  check('未命中知识点时给出三个候选入口',
    (await ev(`document.querySelectorAll('.chat-stream .choices .choice').length`)) === 3);
  check('候选入口是按钮而非纯文字', await ev(`document.querySelector('.choices .choice').tagName === 'BUTTON'`));
  await shot('06-候选入口');

  const n12 = await ev(`document.querySelectorAll('.chat-stream .msg').length`);
  await ev(`document.querySelector('.choices .choice').click()`);
  check('点击候选入口自动发送', await ev(`!!document.querySelector('.thinking')`));
  await waitDone();
  check('候选入口产生一轮完整对话',
    (await ev(`document.querySelectorAll('.chat-stream .msg').length`)) === n12 + 2);
  await shot('07-选中入口后');

  const errs2 = await ev(`JSON.stringify(window.__errs||[])`);
  check('新会话同样无 JS 报错', errs2 === '[]' && pageErrors.length === 0,
    errs2 + ' 异常数=' + pageErrors.length);

  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  const pass = results.filter(Boolean).length;
  flush('');
  flush('RESULT  ' + pass + '/' + results.length + ' 通过');
  if (pass !== results.length) {
    flush('失败项：');
    log.filter(function (l) { return l.indexOf('FAIL') === 0; }).forEach(function (l) { flush(l); });
  }
  process.exit(pass === results.length ? 0 : 1);
})();
