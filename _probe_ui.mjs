/* 临时探针：真浏览器里量战斗中塔面板的四个事实。用完即删。 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';

const ROOT = process.cwd();
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const PORT = 9337, SRV = 8824;
const userDir = path.join(os.tmpdir(), 'templatd-probe-' + Date.now());
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const norm = p => p.replace(/\\/g, '/');
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(200); return res.end(''); }
  const f = norm(path.join(ROOT, u === '/' ? 'index.html' : u));
  if (!f.startsWith(norm(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
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
          const payload = buf.slice(off, off + len); buf = buf.slice(off, off + len);
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
  }
});
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { err: r.result.exceptionDetails.text };
  return { v: r.result && r.result.result ? r.result.result.value : undefined };
}
async function hit(sel) {
  const r = await ev(`(function(){
    var el = document.querySelector(${JSON.stringify(sel)}); if (!el) return JSON.stringify({ miss: 1 });
    el.scrollIntoView({ block: 'center' });
    var b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
    return JSON.stringify({ x: Math.round(x), y: Math.round(y), w: Math.round(b.width), h: Math.round(b.height) });
  })()`);
  const p = JSON.parse(r.v || '{}');
  if (p.miss) return false;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await sleep(120);
  return true;
}
await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV + '/index.html' });
for (let i = 0; i < 60; i++) { const r = await ev(`!!(window.BS && BS.reg && BS.reg.list().length)`); if (r.v) break; await sleep(200); }
await sleep(400);

// 造一局：塔 + 开战 + 推到有敌人 + 辉光 500
const setup = await ev(`(function(){
  BS.bus.wipe();
  BS.shop.clear(); BS.shop.place(0, [3, 2], 0);
  var s = BS.shop.submit(); if (!s.ok) return 'submit fail';
  var r = BS.run.newRun(24601, []);
  var spot = null, x, y;
  for (y = 0; y < BS.td.ROWS && !spot; y++) for (x = 0; x < BS.td.COLS && !spot; x++)
    if (BS.td.deployOk(BS.td.start({ seed: r.seed, turrets: [] }), [x, y]) === '') spot = [x, y];
  if (!BS.run.add(r, s.rec.id, spot).ok) return 'add fail';
  BS.run.begin(r);
  var g = 0; while (r.battle.enemies.length === 0 && g++ < 80) BS.td.tickOnce(r.battle);
  r.battle.lux = 500;
  BS.app.go('battle');
  return r.phase + ' wave=' + r.battle.wave + ' lux=' + r.battle.lux;
})()`);
console.log('开局：', setup.v, setup.err || '');

// 1) 波次中真点塔格 → 面板是否打开、是否稳住
const cellSel = `#panel [data-c][data-t]`;
const cellInfo = await ev(`(function(){ var c = document.querySelector(${JSON.stringify(cellSel)}); return c ? c.getAttribute('data-c') : 'none'; })()`);
console.log('塔格 data-c =', cellInfo.v);
console.log('点塔格：', await hit(cellSel));
const opened = await ev(`(function(){ return { cinf: !!document.querySelector('#panel .cinf'), pri: (BS.run.current().battle.towers[0]||{}).pri, lv: BS.run.current().battle.towers[0].level, lux: BS.run.current().battle.lux }; })()`);
console.log('点后：面板存在 =', opened.v.cinf, ' pri =', opened.v.pri, ' lv =', opened.v.lv, ' lux =', opened.v.lux);
await sleep(900);
const stay = await ev(`(function(){ return { cinf: !!document.querySelector('#panel .cinf'), lv: BS.run.current().battle.towers[0].level, lux: BS.run.current().battle.lux }; })()`);
console.log('放 0.9 秒：面板还在 =', stay.v.cinf, ' lv =', stay.v.lv, ' lux =', stay.v.lux);

// 2) 点「最强」优先级 → 状态 / 高亮 / 等级 / 辉光
const before = await ev(`(function(){ var t = BS.run.current().battle.towers[0];
  var on = document.querySelector('#panel [data-act^="pri:"].on');
  return { pri: t.pri, lv: t.level, lux: BS.run.current().battle.lux, on: on ? on.getAttribute('data-act') : 'none' }; })()`);
console.log('\n点「最强」之前：', JSON.stringify(before.v));
console.log('点 pri:0:strong：', await hit('#panel [data-act="pri:0:strong"]'));
const after = await ev(`(function(){ var t = BS.run.current().battle.towers[0];
  var on = document.querySelector('#panel [data-act^="pri:"].on');
  return { pri: t.pri, lv: t.level, lux: BS.run.current().battle.lux, on: on ? on.getAttribute('data-act') : 'none' }; })()`);
console.log('点「最强」之后：', JSON.stringify(after.v));

// 3) 点升级 → 等级 / 辉光 / 面板
const upBtn = await ev(`(function(){ var b = document.querySelector('#panel [data-act^="up:"]'); return b ? b.textContent : 'none'; })()`);
console.log('\n升级钮：', upBtn.v);
console.log('点它：', await hit('#panel [data-act^="up:"]'));
const upAfter = await ev(`(function(){ var t = BS.run.current().battle.towers[0];
  return { cinf: !!document.querySelector('#panel .cinf'), lv: t.level, lux: BS.run.current().battle.lux, pri: t.pri }; })()`);
console.log('升级之后：面板还在 =', upAfter.v.cinf, ' lv =', upAfter.v.lv, ' lux =', upAfter.v.lux, ' pri =', upAfter.v.pri);

// 4) 再点同一格：面板是否仍然在（不误关）
console.log('\n再点同一塔格：', await hit(cellSel));
const again = await ev(`({ cinf: !!document.querySelector('#panel .cinf') })`);
console.log('面板还在 =', again.v.cinf);

console.log('\nJS 异常：', errs.length ? errs.slice(0, 5) : '无');
cdp.close(); edge.kill(); srv.close();
try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { }
process.exit(0);
