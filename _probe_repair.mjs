/* 临时探针：合并冲突修复后的全项目冒烟验收。
   查：标题/品牌名、12 页逐页挂载（.page 有内容且不含 .empty）、
   零 JS 异常 / 零 console error / 零 404、战斗局可开、英文界面可切。
   用法：在 TemplaTD 目录下 node _probe_repair.mjs。用完即删。 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 9341, SRV = 8855;
const SHOT = 'C:/Users/Administrator/WorkBuddy/2026-10-16-18-19-06/shots/repair-battle-zh.png';
const userDir = path.join(os.tmpdir(), 'templatd-repair-' + Date.now());
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const norm = p => p.replace(/\\/g, '/');
const misses = [];
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(200); return res.end(''); }
  const f = norm(path.join(ROOT, u === '/' ? 'index.html' : u));
  if (!f.startsWith(norm(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    misses.push(u); res.writeHead(404); return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(SRV, r));
const edge = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir, '--no-first-run', '--disable-gpu',
  '--window-size=1600,1200', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 60; i++) {
  try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list'); list = await r.json(); if (list.length) break; } catch (e) { }
  await sleep(250);
}
const ws = list.find(t => t.type === 'page').webSocketDebuggerUrl;
function makeWS(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = Buffer.from(Math.random().toString(36).slice(2)).toString('base64');
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
    req.on('upgrade', (res, sock) => {
      let buf = Buffer.alloc(0), id = 0;
      const waits = new Map(), evs = [];
      sock.on('data', d => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          if (buf.length < 2) return;
          const op = buf[0] & 0x0f;
          let len = buf[1] & 0x7f, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + len) return;
          const payload = buf.slice(off, off + len); buf = buf.slice(off + len);
          if (op === 0x1) {
            let msg; try { msg = JSON.parse(payload.toString()); } catch (e) { continue; }
            if (msg.id != null && waits.has(msg.id)) { waits.get(msg.id)(msg); waits.delete(msg.id); }
            else if (msg.method) evs.forEach(f => f(msg));
          } else if (op === 0x8) { sock.end(); }
        }
      });
      function frame(obj) {
        const p = Buffer.from(JSON.stringify(obj));
        const mask = Buffer.from([0, 0, 0, 0]);
        let head;
        if (p.length < 126) head = Buffer.from([0x81, 0x80 | p.length]);
        else if (p.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0xFE; head.writeUInt16BE(p.length, 2); }
        else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 0xFF; head.writeBigUInt64BE(BigInt(p.length), 2); }
        const body = Buffer.alloc(p.length);
        for (let i = 0; i < p.length; i++) body[i] = p[i] ^ mask[i % 4];
        sock.write(Buffer.concat([head, mask, body]));
      }
      resolve({ send(m, pr) { return new Promise(res => { const i = ++id; waits.set(i, res); frame({ id: i, method: m, params: pr || {} }); }); },
        on(f) { evs.push(f); }, close() { try { sock.end(); } catch (e) { } } });
    });
    req.on('error', reject); req.end();
  });
}
const cdp = await makeWS(ws);
const errs = [];
cdp.on(m => {
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errs.push((d.exception && d.exception.description || d.text || '').split('\n')[0]);
  } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errs.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 120));
  }
});
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { err: r.result.exceptionDetails.text };
  return { v: r.result && r.result.result ? r.result.result.value : undefined };
}
const bad = [];
function check(name, ok, detail) {
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail !== undefined ? '  → ' + detail : ''));
  if (!ok) bad.push(name + (detail !== undefined ? ' (' + detail + ')' : ''));
}

await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV + '/index.html' });
for (let i = 0; i < 60; i++) { const r = await ev(`!!(window.BS && BS.reg && BS.reg.list().length)`); if (r.v) break; await sleep(200); }
await sleep(500);

console.log('== 1. 标题与品牌 ==');
const t1 = await ev(`({ title: document.title, brand: (document.querySelector('.brand .bt')||{}).textContent })`);
check('标签页标题 = TemplaTD · 构成塔防', t1.v && t1.v.title === 'TemplaTD · 构成塔防', t1.v && t1.v.title);
check('页面主标题 = 构成塔防', t1.v && t1.v.brand === '构成塔防', t1.v && t1.v.brand);

console.log('== 2. 十二页逐页挂载 ==');
const pages = await ev(`BS.reg.list().map(function(m){return m.id + '|' + m.n + '|' + (m.t||'');})`);
const ids = (pages.v || []).map(s => s.split('|')[0]);
check('页面数 = 12', ids.length === 12, ids.length + ' 页: ' + ids.join(','));
for (const id of ids) {
  const g = await ev(`(function(){ BS.app.go(${JSON.stringify(id)}); return 1; })()`);
  await sleep(220);
  const st = await ev(`(function(){
    var pg = document.querySelector('#panel .page');
    var empty = document.querySelector('#panel .page .empty');
    return { has: !!pg, kids: pg ? pg.children.length : 0, empty: empty ? (empty.textContent||'').slice(0,60) : '' };
  })()`);
  check('页 ' + id + ' 挂载', !!st.v && st.v.has && st.v.kids > 0 && !st.v.empty, st.v ? ('kids=' + st.v.kids + (st.v.empty ? ' EMPTY:' + st.v.empty : '')) : 'no result');
}

console.log('== 3. 战斗局冒烟（run/td/battle 链路） ==');
const setup = await ev(`(function(){
  BS.bus.wipe();
  BS.shop.clear(); BS.shop.place(0, [3, 2], 0);
  var s = BS.shop.submit(); if (!s.ok) return 'submit fail';
  var r = BS.run.newRun(24601, []);
  var spot = null, x, y;
  for (y = 0; y < BS.td.ROWS && !spot; y++) for (x = 0; x < BS.td.COLS && !spot; x++)
    if (BS.td.deployOk(BS.td.start({ seed: r.seed, turrets: [] }), [x, y]) === '') spot = [x, y];
  if (!spot) return 'no spot';
  if (!BS.run.add(r, s.rec.id, spot).ok) return 'add fail';
  BS.run.begin(r);
  var g = 0; while (r.battle.enemies.length === 0 && g++ < 80) BS.td.tickOnce(r.battle);
  r.battle.lux = 500;
  BS.app.go('battle');
  return r.phase + ' wave=' + r.battle.wave;
})()`);
check('一局可开（部署+开波）', !!setup.v && setup.v.indexOf('battle') === 0, setup.v || setup.err);
await sleep(400);
const board = await ev(`(function(){
  var cells = document.querySelectorAll('#panel [data-c]').length;
  var wv = (document.querySelector('#panel')||{}).textContent || '';
  return { cells: cells, wave: wv.indexOf('第 1 波') >= 0 };
})()`);
check('战场格子已渲染', !!board.v && board.v.cells > 0, board.v && board.v.cells + ' 格');
check('波次文案在（第 1 波）', !!board.v && board.v.wave);

console.log('== 4. 英文界面切换 ==');
const en = await ev(`(function(){
  BS.i18n.setLang('en');
  BS.app.go('battle');
  var txt = (document.querySelector('#panel')||{}).textContent || '';
  return { isEn: BS.i18n.isEn(), wave: txt.indexOf('WAVE') >= 0, zh: txt.indexOf('第 1 波') >= 0 };
})()`);
check('切英文成功且界面英文化', !!en.v && en.v.isEn && en.v.wave && !en.v.zh, en.v && JSON.stringify(en.v));
await ev(`BS.i18n.setLang('zh'); BS.app.go('battle');`);
await sleep(300);

console.log('== 5. 截图（中文战场） ==');
await ev(`(function(){ var b = document.getElementById('boot'); if (b) b.remove(); return 1; })()`);
await sleep(250);
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
if (shot.result && shot.result.data) { fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64')); check('截图已存', true, SHOT); }
else check('截图已存', false, 'no data');

console.log('== 汇总 ==');
check('JS 异常 / console error 为零', errs.length === 0, errs.length ? errs.slice(0, 5).join(' | ') : '无');
check('请求 404 为零', misses.length === 0, misses.length ? misses.slice(0, 5).join(', ') : '无');

cdp.close(); edge.kill(); srv.close();
try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { }
console.log(bad.length ? '\n结论：未通过 ' + bad.length + ' 项 → ' + bad.join('；') : '\n结论：全部通过');
process.exit(bad.length ? 1 : 0);
