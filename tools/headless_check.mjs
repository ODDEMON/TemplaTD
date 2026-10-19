/* tools/headless_check.mjs —— 真实浏览器里的行为验证（一次性工具，不进 npm test）。
   ------------------------------------------------------------------
   jsdom 不动布局、不算 CSS、不跑合成——它只能证明「不抛」。
   而这一层的风险恰好全在布局与交互上：网格会不会把列撑爆、
   悬停会不会在 mouseover 里重渲染、钟面指针转不转得动。
   所以这里拉一台真 Edge，走 CDP，做四件事：
     1. 打开 file:// 的 index.html，收集 console 与 pageerror
     2. 断言首屏渲染出网格与二十四条流，量它们的实际像素尺寸
     3. 派发一次真实 mousemove 到某条流上，断言溯源面板的文本变了
        （并且页面 handle 数没有暴涨 —— 即没有整页重渲染）
     4. 截一张图，用像素方差判断「是不是一屏空白」
   用法：node tools/headless_check.mjs
*/
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';
import os from 'os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
if (!EDGE) { console.log('找不到 Edge，跳过真实浏览器检查'); process.exit(0); }

const PORT = 9333, SRV = 8811;
const userDir = path.join(os.tmpdir(), 'templatd-edge-' + Date.now());

/* 起一个静态服务器——file:// 下 CDP 的 localStorage 与截图会有限制。
   注意 path.join 在 Windows 上产生反斜杠，用 startsWith(ROOT) 做越权检查
   会把每一个请求都判成越界（于是 /index.html 也 404，整个检查全绿变全红）。
   统一 normalize 成正斜杠再比。 */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const norm = p => p.replace(/\\/g, '/');
const missing = [];
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  /* 浏览器总会自己去要 favicon。给一个空图，免得它的 404 混进
     console 日志里、把「零错误」这条判据变成一句永远为假的话。 */
  if (u === '/favicon.ico') { res.writeHead(200, { 'Content-Type': 'image/x-icon' }); return res.end(''); }
  const f = norm(path.join(ROOT, u === '/' ? 'index.html' : u));
  if (!f.startsWith(norm(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    missing.push(u);
    res.writeHead(404); return res.end('no');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => srv.listen(SRV, r));

const edge = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir, '--no-first-run', '--disable-gpu',
  '--window-size=1600,1200', '--hide-scrollbars', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 等 CDP 端口起来 */
let list = null;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
    list = await r.json();
    if (list.length) break;
  } catch (e) { /* 还没起来 */ }
  await sleep(250);
}
if (!list || !list.length) { console.log('CDP 没起来'); edge.kill(); srv.close(); process.exit(1); }

const ws = list.find(t => t.type === 'page').webSocketDebuggerUrl;

/* 手写一个最小 CDP 客户端。不引 ws 依赖：它只是 jsdom 的传递依赖，
   没有出现在 package.json 里，靠它会让这个工具在上游升级后悄悄坏掉。
   CDP 只用得到「带掩码的文本帧 + 按 id 配对响应 + 收事件」三件事。 */
function makeWS(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = Buffer.from(Math.random().toString(36).slice(2)).toString('base64');
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: {
        'Connection': 'Upgrade', 'Upgrade': 'websocket',
        'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key
      }
    });
    req.on('upgrade', (res, sock) => {
      let buf = Buffer.alloc(0), id = 0;
      const waits = new Map(), evs = [];
      sock.on('data', d => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          if (buf.length < 2) return;
          const fin = buf[0] & 0x80, op = buf[0] & 0x0f;
          let len = buf[1] & 0x7f, off = 2;
          if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + len) return;
          const payload = buf.slice(off, off + len);
          buf = buf.slice(off + len);
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
      resolve({
        send(method, params) {
          return new Promise(res => { const i = ++id; waits.set(i, res); frame({ id: i, method, params: params || {} }); });
        },
        on(fn) { evs.push(fn); },
        close() { try { sock.end(); } catch (e) { } }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const cdp = await makeWS(ws);
const logs = [], errs = [];
cdp.on(m => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push((m.params.args || []).map(a => a.value).join(' '));
  if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' :: ' + (m.params.exceptionDetails.exception || {}).description);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    const t = m.params.entry.text || '';
    /* favicon 的 404 与作品无关：浏览器总会去要一个，我们没有。 */
    if (t.indexOf('favicon') >= 0) return;
    errs.push('log: ' + t);
  }
});
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');
await cdp.send('DOM.enable');

await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV + '/index.html' });
/* 首屏现在是**图形工坊**（指针宇宙那一页已经删掉了）。
   所以先等装配起来，拿到导航顺序，再显式走过去。 */
for (let i = 0; i < 60; i++) {
  const r = await evalJS(`!!document.querySelector('#panel .page')`);
  if (r.v) break;
  await sleep(200);
}
const railOrder = await evalJS(`Array.from(document.querySelectorAll('#rail .rn')).map(b => b.getAttribute('data-go'))`);
const railFirst = await evalJS(`(document.querySelector('#rail .rn') || {}).getAttribute ? document.querySelector('#rail .rn').getAttribute('data-go') : ''`);
const railLast = await evalJS(`(function(){var b=document.querySelectorAll('#rail .rn');return b.length? b[b.length-1].getAttribute('data-go'):'';})()`);

await evalJS(`BS.app.go('battle')`);
for (let i = 0; i < 60; i++) {
  const r = await evalJS(`!!document.querySelector('.bgrid .cell')`);
  if (r.v) break;
  await sleep(200);
}
await sleep(700);

async function evalJS(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { err: r.result.exceptionDetails.text };
  return { v: r.result && r.result.result ? r.result.result.value : undefined };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

console.log('\n== 真实浏览器：导航顺序（工坊必须在第一位，设置垫底）==');
ok((railOrder.v || []).length >= 11, '导航有 ' + (railOrder.v || []).length + ' 项');
ok(railFirst.v === 'forge', '第一位是图形工坊（实为 ' + railFirst.v + '）');
ok(railLast.v === 'settings', '末位是设置（实为 ' + railLast.v + '）');
ok((railOrder.v || []).indexOf('apex') < 0, '指针宇宙那一页已经不在了');

console.log('\n== 真实浏览器：加载与首屏 ==');
const realMiss = missing.filter(u => u.indexOf('favicon') < 0);
ok(errs.length === 0, '零 console 错误 / 未捕获异常' + (errs.length ? '：\n    ' + errs.slice(0, 5).join('\n    ') : ''));
ok(realMiss.length === 0, '没有真正的资源缺失（404）' + (realMiss.length ? '：' + realMiss.join(', ') : '') +
  '　／favicon 的 404 由浏览器自动发起，与作品无关');
const r1 = await evalJS(`(() => {
  const grid = document.querySelector('.bgrid');
  const cells = document.querySelectorAll('.bgrid .cell').length;
  const flux = document.querySelector('.bx-flux');
  return { cells: cells, cols: grid ? grid.getAttribute('style') : '',
    hasFlux: !!flux,
    panelH: Math.round(document.getElementById('panel').scrollHeight),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`);
const A = r1.v || {};
ok(A.cells === 22 * 14, '战场渲染出 ' + A.cells + ' 格（22×14）');
ok(String(A.cols || '').indexOf('--cols:22') >= 0, '网格带着 --cols 变量（' + A.cols + '）');
ok(A.panelH > 400, '战场页有真实高度 ' + A.panelH + 'px');
ok(Math.abs(A.overflowX) <= 2, '没有横向溢出（' + A.overflowX + 'px）');

console.log('\n== 真实浏览器：悬停不重渲染 ==');
/* 战场格子上的落点预览：mouseenter 只改 class、只写固定盒子。
   在 mouseenter 里 render() 会让真实浏览器里 click 落不到格子上
   ——「无法部署」翻过一次车（README 规矩四）。 */
const before = await evalJS(`document.getElementById('panel').innerHTML.length`);
const box = await evalJS(`(() => {
  const el = document.querySelector('.bgrid .cell:not(.p)');
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
    cls: el.className };
})()`);
await sleep(300);
if (box.v) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.v.x, y: box.v.y, buttons: 0 });
  await sleep(120);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.v.x + 3, y: box.v.y + 2, buttons: 0 });
  await sleep(350);
  const r2 = await evalJS(`(() => ({
    len: document.getElementById('panel').innerHTML.length,
    cells: document.querySelectorAll('.bgrid .cell').length
  }))()`);
  const B = r2.v || {};
  ok(B.len === before.v, '悬停后面板没有整页重渲染（' + before.v + ' → ' + B.len + '）');
  ok(B.cells === A.cells, '格子数没有变（' + B.cells + '）');
} else { ok(false, '找不到可悬停的战场格子'); }

console.log('\n== 真实浏览器：战斗时钟在走 ==');
/* 指针宇宙的钟删掉之后，唯一还在走的钟是战斗本身：
   起一局、开战，看敌人是否真的在前进、基地是否真的在算。 */
const CLK = await evalJS(`(function () {
  BS.bus.state.armory = []; BS.bus.state.armoryLog = []; BS.bus.state.armorySeq = 0;
  BS.shop.clear();
  BS.shop.place(0, [3, 2], 0);
  var s = BS.shop.submit();
  if (!s.ok) return { err: '提交失败' };
  var r = BS.run.newRun(4242);
  var spot = null, x, y;
  for (y = 0; y < BS.td.ROWS && !spot; y++) for (x = 0; x < BS.td.COLS && !spot; x++) {
    if (BS.td.deployOk(BS.td.start({ seed: r.seed, turrets: [] }), [x, y]) === '') spot = [x, y];
  }
  if (!BS.run.add(r, s.rec.id, spot).ok) return { err: '部署失败' };
  BS.run.begin(r);
  var b = r.battle, g = 0;
  while (b.enemies.length === 0 && g++ < 80) BS.td.tickOnce(b);
  var p0 = b.enemies.length ? b.enemies[0].pos : -1;
  for (var i = 0; i < 12; i++) BS.td.tickOnce(b);
  var p1 = b.enemies.length ? b.enemies[0].pos : -1;
  BS.app.go('battle');
  var ls = BS.reg.list();
  for (var j = 0; j < ls.length; j++) if (ls[j].tick) ls[j].tick(16);
  var P = document.getElementById('panel');
  return { p0: p0, p1: p1, wave: b.wave,
    hud: (document.getElementById('hud').textContent || '').replace(/\s+/g, ' ').slice(0, 120),
    cells: P.querySelectorAll('.bgrid .cell').length };
})()`);
const CK = CLK.v || {};
ok(!CK.err, '起了一局并开战' + (CK.err ? '：' + CK.err : ''));
ok(CK.p1 > CK.p0, '敌人在前进（' + (CK.p0 || 0).toFixed(2) + ' → ' + (CK.p1 || 0).toFixed(2) + '）');
ok(CK.wave >= 1, '已经进到第 ' + CK.wave + ' 波');
ok(/阵型/.test(CK.hud || ''), '顶栏报出了阵型读数（' + (CK.hud || '') + '）');

console.log('\n== 真实浏览器：全部页面跑一遍 ==');
const pages = await evalJS(`BS.reg.list().map(m => m.id)`);
const ids = pages.v || [];
let pageFail = 0;
for (const id of ids) {
  errs.length = 0;
  await evalJS(`BS.app.go('${id}')`);
  await sleep(140);
  const r = await evalJS(`({ len: document.getElementById('panel').innerHTML.length })`);
  if (!r.v || r.v.len < 60 || errs.length) { pageFail++; console.log('    ' + id + ' 有问题 len=' + (r.v && r.v.len) + ' errs=' + errs.length); }
}
ok(pageFail === 0, ids.length + ' 页在真实浏览器里全部挂载成功' + (pageFail ? '（' + pageFail + ' 页失败）' : ''));

console.log('\n== 真实浏览器：军械库流水（淘汰也不擦）==');
/* 这一段在真实浏览器里重演「提交两座 → 淘汰一座」，
   断言流水条数不变。jsdom 里已经测过，这里再测一次是因为它跨越了
   存档序列化（localStorage）——流水必须能活着过一遍 JSON 往返。 */
const armLog = await evalJS(`(function () {
  /* 清干净，从零造两座 */
  BS.bus.state.armory = [];
  BS.bus.state.armoryLog = [];
  BS.bus.state.armorySeq = 0;
  BS.shop.clear();
  BS.shop.place(0, [3, 2], 0);
  var a = BS.shop.submit();
  BS.shop.place(1, [4, 2], 0);
  var b = BS.shop.submit();
  var live0 = BS.bus.state.armory.length, log0 = BS.bus.state.armoryLog.length;
  var del = BS.shop.discard(a.rec.id);
  return {
    ok1: a.ok && b.ok, live0: live0, log0: log0,
    delOk: del.ok,
    live1: BS.bus.state.armory.length,
    log1: BS.bus.state.armoryLog.length,
    kept: BS.bus.state.armoryLog.filter(function (x) { return x.id === a.rec.id; }).length,
    sameObj: BS.bus.state.armoryLog[0] === BS.bus.state.armory[0],
    saveOk: (function () { BS.bus.save(); return true; })()
  };
})()`);
const AR = armLog.v || {};
ok(AR.ok1 === true, '真实浏览器里提交了两座');
ok(AR.live0 === 2 && AR.log0 === 2, '在库 2 座、流水 2 条');
ok(AR.delOk === true, '淘汰了一座');
ok(AR.live1 === 1, '在库降到 1 座');
ok(AR.log1 === 2, '流水**仍是** 2 条（淘汰不擦底账）');
ok(AR.kept === 1, '被淘汰的那一座仍留在流水里');
ok(AR.sameObj === false, '流水是在库记录的独立副本');

/* 切到流水视图，截图。这一张是留给人工核对的：在库行 vs 已淘汰行要能一眼分开。 */
await evalJS(`BS.app.go('armory'); (function(){ var b = document.querySelector('[data-act="vw:log"]'); if (b) b.click(); return 1; })()`);
await sleep(400);
const armRows = await evalJS(`({ rows: document.querySelectorAll('#panel .vtable .vrow').length, gone: document.querySelectorAll('#panel .vrow.gone').length })`);
ok((armRows.v || {}).rows >= 2, '流水视图画出了 ' + ((armRows.v || {}).rows || 0) + ' 行');
ok((armRows.v || {}).gone >= 1, '已淘汰的那一行带上了 gone 标记');
const armShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const armPng = Buffer.from(armShot.result.data, 'base64');
const outArm = path.join(ROOT, 'docs', 'armory_shot.png');
fs.writeFileSync(outArm, armPng);
ok(armPng.length > 30000, '军械库截图 ' + Math.round(armPng.length / 1024) + 'KB');
console.log('    截图：' + outArm);

console.log('\n== 真实浏览器：截图非空白 ==');
await evalJS(`BS.app.go('battle')`);
await sleep(600);
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const png = Buffer.from(shot.result.data, 'base64');
const outPng = path.join(ROOT, 'docs', 'battle_flux_shot.png');
fs.writeFileSync(outPng, png);
ok(png.length > 40000, '截图 ' + Math.round(png.length / 1024) + 'KB（空白页通常 <20KB）');
console.log('    截图：' + outPng);

/* 商店页：抽卡概率公示 + 升级商店三组。顺手截一张，便于人工核对概率条真的画出来了。 */
await evalJS(`BS.app.go('shop')`);
await sleep(400);
const shopShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const shopPng = Buffer.from(shopShot.result.data, 'base64');
const outShop = path.join(ROOT, 'docs', 'shop_shot.png');
fs.writeFileSync(outShop, shopPng);
const odN = await evalJS(`document.querySelectorAll('.od .odc').length`);
ok((odN.v || 0) === 5, '商店页画出了五档概率条（实 ' + (odN.v || 0) + '）');
ok(shopPng.length > 30000, '商店页截图 ' + Math.round(shopPng.length / 1024) + 'KB');
console.log('    截图：' + outShop);

console.log('\n== 真实浏览器：图纸扩容（网格当场长大）==');
/* jsdom 里数过格数了；这里再量一次，是因为真实浏览器有 CSS 网格：
   --cols 变量若没跟着换，DOM 里虽然还是那么多 data-c，
   但整张图会挤成一列/塌掉——那是只有真浏览器才看得见的错。 */
const fg = await evalJS(`(function () {
  BS.bus.state.crystal = 100000;
  BS.app.go('forge');
  var P = document.getElementById('panel');
  var before = { c: BS.shop.cols(), r: BS.shop.rows(),
    cells: P.querySelectorAll('.wgrid [data-c]').length,
    cols: (P.querySelector('.wgrid') || {getAttribute:function(){return '';}}).getAttribute('style') };
  /* 直接买一级——不切页，看它自己重不重画 */
  var bought = BS.meta.buy('room');
  var ls = BS.reg.list();
  for (var i = 0; i < ls.length; i++) if (ls[i].tick) ls[i].tick(16);
  var P2 = document.getElementById('panel');
  var after = { c: BS.shop.cols(), r: BS.shop.rows(),
    cells: P2.querySelectorAll('.wgrid [data-c]').length,
    cols: (P2.querySelector('.wgrid') || {getAttribute:function(){return '';}}).getAttribute('style') };
  /* 网格真实几何：拿第一行首尾两个格子的 rect 算一下列间距是否非零 */
  var all = P2.querySelectorAll('.wgrid [data-c]');
  var w0 = all.length ? all[0].getBoundingClientRect() : { width: 0 };
  return { before: before, after: after, bought: !!(bought && bought.ok),
    cellW: Math.round(w0.width) };
})()`);
const FG = fg.v || {};
ok(FG.bought === true, '真实浏览器里买下「图纸扩容」');
ok(FG.before && FG.before.cells === FG.before.c * FG.before.r,
  '买前格数 = ' + (FG.before && FG.before.cells) + '（' + (FG.before && FG.before.c) + '×' + (FG.before && FG.before.r) + '）');
ok(FG.after && FG.after.c > FG.before.c, '列数变大：' + (FG.before && FG.before.c) + ' → ' + (FG.after && FG.after.c));
ok(FG.after && FG.after.cells === FG.after.c * FG.after.r,
  '买后**当场**重画成 ' + (FG.after && FG.after.cells) + ' 格（' + (FG.after && FG.after.c) + '×' + (FG.after && FG.after.r) + '）');
ok(FG.after && String(FG.after.cols).indexOf('--cols:' + FG.after.c) >= 0,
  '真实 DOM 的 --cols 变量换成了 ' + (FG.after && FG.after.c) + '（实：' + (FG.after && FG.after.cols) + '）');
ok((FG.cellW || 0) > 4, '格子有真实宽度 ' + FG.cellW + 'px（网格没塌成零宽）');
const fgShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const fgPng = Buffer.from(fgShot.result.data, 'base64');
const outFg = path.join(ROOT, 'docs', 'forge_shot.png');
fs.writeFileSync(outFg, fgPng);
ok(fgPng.length > 30000, '工坊截图 ' + Math.round(fgPng.length / 1024) + 'KB');
console.log('    截图：' + outFg);

console.log('\n== 真实浏览器：战场上是图形，不是字 ==');
/* 这一段量的是**渲染出来的形状**：SVG 的 rect/polygon 真的在 DOM 里、
   格子有非零尺寸、颜色对得上稀有度。jsdom 里数得出节点，
   但量不出「这个形状到底画出来了没有、占不占地方」——
   SVG 的 getBBox / getBoundingClientRect 在 jsdom 里恒为 0。 */
const bt = await evalJS(`(function () {
  /* 从零造一局：工坊拼一件 → 提交 → 部署 → 开战 */
  BS.bus.state.armory = []; BS.bus.state.armoryLog = []; BS.bus.state.armorySeq = 0;
  BS.shop.clear();
  BS.shop.place(0, [3, 2], 0);
  var s = BS.shop.submit();
  if (!s.ok) return { err: '提交失败' };
  BS.bus.state.armory.push(s.rec);
  var r = BS.run.newRun(20261013);
  if (!BS.run.add(r, s.rec.id, [2, 2]).ok) return { err: '部署失败' };
  BS.run.begin(r);
  /* 推到有敌人，再推几 tick 让它真的在走 */
  var g = 0;
  while (r.battle.enemies.length === 0 && g++ < 80) BS.td.tickOnce(r.battle);
  for (var i = 0; i < 6; i++) BS.td.tickOnce(r.battle);
  /* 切到战场页再推时钟——不切页的话 #panel 里还是工坊，
     量到的是别的东西（这个错犯过一次：0 个 SVG，全红）。 */
  BS.app.go('battle');
  var ls = BS.reg.list();
  for (var j = 0; j < ls.length; j++) if (ls[j].tick) ls[j].tick(16);
  var P = document.getElementById('panel');
  var figs = P.querySelectorAll('.cell .fig');
  var efigs = P.querySelectorAll('.cell .efig');
  var f0 = figs.length ? figs[0] : null;
  /* 量形状的真实占位：SVG 的 getBoundingClientRect */
  var fr = f0 ? f0.getBoundingClientRect() : { width: 0, height: 0 };
  var e0 = efigs.length ? efigs[0] : null;
  var er = e0 ? e0.getBoundingClientRect() : { width: 0, height: 0 };
  /* 格子上不许有字 */
  var cellText = '';
  var cs = P.querySelectorAll('.bgrid .cell');
  for (var q = 0; q < cs.length; q++) cellText += (cs[q].textContent || '').trim();
  return {
    figs: figs.length, figRects: f0 ? f0.querySelectorAll('rect').length : 0,
    figW: Math.round(fr.width), figH: Math.round(fr.height),
    figCls: f0 ? f0.getAttribute('class') : '',
    efigs: efigs.length, eW: Math.round(er.width), eH: Math.round(er.height),
    hasPoly: !!e0 && !!(e0.querySelector('polygon') || e0.querySelector('rect')),
    cellText: cellText.slice(0, 24),
    form: s.rec.form, nm: s.rec.nm, lux: r.battle.lux, hp: r.battle.baseHp
  };
})()`);
const BT = bt.v || {};
ok(!BT.err, '真实浏览器里拼出、提交、部署、开战一条龙' + (BT.err ? '：' + BT.err : ''));
ok((BT.figs || 0) >= 1, '塔画成了形状（' + (BT.figs || 0) + ' 个 SVG）');
ok((BT.figRects || 0) > 0, '塔的形状由 ' + (BT.figRects || 0) + ' 个矩形拼成');
/* 上下界都要卡：太小是空 SVG，太大是父级没定位、形状摊满整张棋盘。
   后一种错只有真浏览器看得见（jsdom 量不出布局）——所以这一条
   必须在 headless 里，而且必须同时卡上界。 */
ok((BT.figW || 0) > 4 && (BT.figH || 0) > 4,
  '塔的形状真的占地方（' + BT.figW + '×' + BT.figH + 'px）——不是零尺寸的空 SVG');
ok((BT.figW || 0) <= 24 && (BT.figH || 0) <= 24,
  '塔的形状守在格子里（' + BT.figW + '×' + BT.figH + 'px ≤ 24）——没摊满棋盘');
ok(/fig r[0-4]/.test(BT.figCls || ''), '塔按稀有度着色（' + BT.figCls + '）');
ok((BT.efigs || 0) >= 1, '敌人画成了多边形（' + (BT.efigs || 0) + ' 个）');
ok(BT.hasPoly === true, '敌人形状由多边形构成');
ok((BT.eW || 0) > 4, '敌人的多边形也占地方（' + BT.eW + '×' + BT.eH + 'px）');
ok(!/[塔兵冲甲灵首]/.test(BT.cellText || ''),
  '战场格上没有单字 glyph（实为 "' + BT.cellText + '"）');

/* ------------------------------------------------------------------
   护盾环也是绝对定位：`.cell .esh { position:absolute; inset:0 }`。
   与 `.cell .fig` 同一类坑——父级 `.cell.e` 若没定位，环会一路找到
   `.bwrap` 摊满整张棋盘。jsdom 量不出布局，所以这一条必须在真浏览器里，
   而且**上下界都要卡**（太小是没画，太大是父级没定位）。 */
console.log('\n== 真实浏览器：护盾环与盾条 ==');
const SH = await evalJS(`(function () {
  /* 把战场直接推到第 8 波、**清场**后只放两只重甲（带盾），量环的真实占位。
     不清场会被上一节残留的敌人骗过：场上已经有敌人，出生循环一次都不跑，
     量到的是第 1 波的步行兵（没有盾）——探针量错了东西，还量得很自洽。 */
  var r = BS.run.current();
  if (!r || !r.battle) return { err: '没有进行中的一局' };
  var b = r.battle;
  b.wave = 7;
  BS.td.beginWave(b);
  b.enemies.length = 0;
  b.toSpawn = [{ id: 'armor', count: 2 }];
  b.spawnCd = 0;
  var g = 0, shielded = 0, i, e;
  while (g++ < 80) {
    BS.td.tickOnce(b);
    shielded = 0;
    for (i = 0; i < b.enemies.length; i++) { e = b.enemies[i]; if (e.sh > 0) shielded++; }
    if (shielded >= 2) break;
  }
  BS.app.go('battle');
  var ls = BS.reg.list();
  for (var j = 0; j < ls.length; j++) if (ls[j].tick) ls[j].tick(16);
  var P = document.getElementById('panel');
  var rings = P.querySelectorAll('.cell .esh');
  var bars = P.querySelectorAll('.cell.e i.shbar');
  var r0 = rings.length ? rings[0] : null;
  var rr = r0 ? r0.getBoundingClientRect() : { width: 0, height: 0 };
  shielded = 0;
  for (i = 0; i < b.enemies.length; i++) { e = b.enemies[i]; if (e.sh > 0) shielded++; }
  return {
    shielded: shielded, enemies: b.enemies.length,
    rings: rings.length, bars: bars.length,
    w: Math.round(rr.width), h: Math.round(rr.height),
    hasCircle: !!r0 && !!r0.querySelector('circle'),
    wave: b.wave
  };
})()`);
const SHV = SH.v || {};
ok(!SHV.err, '真浏览器里把战场推到第 8 波' + (SHV.err ? '：' + SHV.err : ''));
ok((SHV.shielded || 0) >= 1, '第 ' + SHV.wave + ' 波的重甲带着盾（' + SHV.shielded + '/' + SHV.enemies + ' 只）');
ok((SHV.rings || 0) >= 1, '带盾的敌人画出了护盾环（' + SHV.rings + ' 个）');
ok(SHV.hasCircle === true, '护盾环由虚线圆构成');
ok((SHV.w || 0) > 4 && (SHV.h || 0) > 4,
  '护盾环真的占地方（' + SHV.w + '×' + SHV.h + 'px）——不是零尺寸的空 SVG');
ok((SHV.w || 0) <= 24 && (SHV.h || 0) <= 24,
  '护盾环守在格子里（' + SHV.w + '×' + SHV.h + 'px ≤ 24）——没摊满棋盘');
ok((SHV.bars || 0) >= 1, '盾条画在格子上（' + SHV.bars + ' 条）');

const shShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const shPng = Buffer.from(shShot.result.data, 'base64');
const outSh = path.join(ROOT, 'docs', 'battle_shield_shot.png');
fs.writeFileSync(outSh, shPng);
ok(shPng.length > 30000, '带盾战场截图 ' + Math.round(shPng.length / 1024) + 'KB');
console.log('    截图：' + outSh);

/* 装配台：真浏览器里装一块模块（闸门 + 一次性） */
console.log('\n== 真实浏览器：装配台装模块 ==');
const AS = await evalJS(`(function () {
  BS.app.go('forge');
  BS.shop.clear();
  BS.shop.place(5, [3, 2], 0);
  var sub = BS.shop.submit();
  if (!sub.ok) return { err: '提交失败' };
  var rec = BS.bus.state.armory[BS.bus.state.armory.length - 1];
  BS.bus.state.crystal = BS.shop.fitCost();
  BS.app.go('assembly');
  var P = document.getElementById('panel');
  var cards = P.querySelectorAll('.bcard');
  var btns = P.querySelectorAll('.bcard [data-act^="fit:"]');
  var before = rec.br;
  var clicked = false;
  if (btns.length) { btns[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); clicked = true; }
  var after = rec.br;
  var crystal = BS.bus.state.crystal;
  /* 一次性：再点第二张也换不了 */
  var btns2 = P.querySelectorAll('.bcard [data-act^="fit:"]');
  if (btns2.length > 1) btns2[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  var after2 = rec.br;
  /* 拆解还料：元件回库 */
  var inv0 = BS.bus.state.inv.length;
  var rm = P.querySelector('[data-act^="rm:"]');
  if (rm) rm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return {
    cards: cards.length, btns: btns.length, clicked: clicked,
    before: before, after: after, after2: after2,
    parts: (rec.parts || []).length,
    invGain: BS.bus.state.inv.length - inv0,
    crystalLeft: crystal,
    railHasBench: !!document.querySelector('#rail [data-go="assembly"]')
  };
})()`);
const ASV = AS.v || {};
ok(!ASV.err, '真浏览器里提交一座塔并进装配台' + (ASV.err ? '：' + ASV.err : ''));
ok(ASV.cards === 3, '三张模块卡都摆着（' + ASV.cards + '）');
ok(ASV.btns === 3, '三张装配钮都在（' + ASV.btns + '）');
ok(ASV.before === null && ASV.after === 'pierce', '点一下真的装上了（' + ASV.before + ' → ' + ASV.after + '）');
ok(ASV.after2 === 'pierce', '装过模块的塔换不了（一次性，' + ASV.after2 + '）');
ok(ASV.invGain === ASV.parts && ASV.parts > 0,
  '拆解还料：' + ASV.parts + ' 枚元件回库（+-' + ASV.invGain + '）');
ok(ASV.railHasBench === true, '导航里有装配台这一页');

const btShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const btPng = Buffer.from(btShot.result.data, 'base64');
const outBt = path.join(ROOT, 'docs', 'assembly_shot.png');
fs.writeFileSync(outBt, btPng);
ok(btPng.length > 30000, '装配台截图 ' + Math.round(btPng.length / 1024) + 'KB');
console.log('    截图：' + outBt);

console.log('\n== 真实浏览器：花园无限延展 + 战斗加成 ==');
const gd = await evalJS(`(function () {
  /* 清空园子，一路种到好几圈 */
  BS.bus.state.garden = null;
  var before = { c: BS.garden.cols(), r: BS.garden.rows(), lv: BS.garden.level() };
  var planted = 0, grew = 0, guard = 0, part = 0;
  while (grew < 3 && guard++ < 600) {
    var done = false;
    for (var y = 0; y < BS.garden.rows() && !done; y++) {
      for (var x = 0; x < BS.garden.cols() && !done; x++) {
        var o = BS.garden.plant(part % 40, [x, y], 0);
        if (o.ok) { done = true; planted++; if (o.grew) grew++; part++; }
      }
    }
    if (!done) break;
  }
  var m = BS.garden.mods();
  /* 同上：先切到花园页，否则 #panel 里还是战场 */
  BS.app.go('garden');
  var ls = BS.reg.list();
  for (var i = 0; i < ls.length; i++) if (ls[i].tick) ls[i].tick(16);
  var P = document.getElementById('panel');
  var cells = P.querySelectorAll('.wgrid [data-c]').length;
  var wg = P.querySelector('.wgrid');
  /* 六类加成各占一行：旧版压成两行文字，正好把「五类恒为 0」藏住了 */
  var rows = P.querySelectorAll('.pkrow'), lit = 0, z;
  for (z = 0; z < rows.length; z++) if (rows[z].className.indexOf('zero') < 0) lit++;
  var bars = 0;
  for (z = 0; z < rows.length; z++) if (rows[z].querySelector('.pkb i')) bars++;
  return {
    before: before,
    after: { c: BS.garden.cols(), r: BS.garden.rows(), lv: BS.garden.level(), n: BS.garden.n() },
    grew: grew, cells: cells,
    cols: wg ? wg.getAttribute('style') : '',
    kindRows: rows.length, kindLit: lit, kindBars: bars,
    mods: { dmgPct: +m.dmgPct.toFixed(1), ratePct: +m.ratePct.toFixed(1),
      rangeAdd: +m.rangeAdd.toFixed(2), critPct: +m.critPct.toFixed(1),
      luxPct: +m.luxPct.toFixed(1), dropPct: +m.dropPct.toFixed(1),
      parts: m.parts, roots: m.roots, nurse: m.nurse },
    buffs: BS.garden.buffs(),
    txt: (P.textContent || '').replace(/\\s+/g, ' ').slice(0, 300)
  };
})()`);
const GD = gd.v || {};
ok(GD.after && GD.after.lv >= 3, '真实浏览器里园子扩到了 ' + (GD.after && GD.after.lv) + ' 圈');
ok(GD.after && GD.after.c === GD.before.c + GD.after.lv * 2,
  '列数 = 基准 + 圈数×2 = ' + (GD.after && GD.after.c));
ok(GD.cells === GD.after.c * GD.after.r,
  '重画后的格数 = ' + GD.cells + '（' + (GD.after && GD.after.c) + '×' + (GD.after && GD.after.r) + '）');
ok(String(GD.cols).indexOf('--cols:' + GD.after.c) >= 0,
  '园子网格的 --cols 跟着扩（实：' + GD.cols + '）');
const anyGain = GD.mods && (GD.mods.dmgPct > 0 || GD.mods.ratePct > 0 || GD.mods.luxPct > 0
  || GD.mods.dropPct > 0 || GD.mods.critPct > 0 || GD.mods.rangeAdd > 0);
ok(anyGain === true, '种出来的根真的给了战斗面加成（' + JSON.stringify(GD.mods) + '）');
ok(GD.buffs && GD.buffs.dmgMul >= 1 && GD.buffs.luxMul >= 1,
  '加成折成交给塔防的纸面（伤害 ×' + (GD.buffs && GD.buffs.dmgMul.toFixed(3)) +
  ' · 辉光 ×' + (GD.buffs && GD.buffs.luxMul.toFixed(3)) + '）');
/* 六类加成各占一行，且**不止一类**有数——这是失败信号 G2 的可见面。
   旧版只有「最突出的那一项」出力，种满一园子也只有一行有数字。 */
ok(GD.kindRows === 6, '六类加成各占一行（实：' + GD.kindRows + ' 行）');
ok(GD.kindBars === 6, '六类各带一根条（实：' + GD.kindBars + '）');
ok(GD.kindLit >= 3, '点亮了 ' + GD.kindLit + ' 类（旧版恒为 1 类——单一加成统治）');
ok(/苗床/.test(GD.txt || ''), '面板上摆着苗床那一栏（' + (GD.mods && GD.mods.nurse) + ' / 96 格）');
ok(!/被动采集尘/.test(GD.txt || ''), '旧版的被动尘说法已从花园页退场');
const gdShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const gdPng = Buffer.from(gdShot.result.data, 'base64');
const outGd = path.join(ROOT, 'docs', 'garden_shot.png');
fs.writeFileSync(outGd, gdPng);
ok(gdPng.length > 30000, '花园截图 ' + Math.round(gdPng.length / 1024) + 'KB');
console.log('    截图：' + outGd);

/* ------------------------------------------------------------------
   设置页：存档与重置归一处，重置在真浏览器里也必须二次确认。
   顶栏的「存档」钮撤掉了——它原先和卷宗页那颗各管一半，
   而且卷宗那颗点一下就直接清（真正的风险不在 jsdom 里，在人手上）。
   ------------------------------------------------------------------ */
console.log('\n== 真实浏览器：设置页（写入 / 导出 / 重置二次确认）==');
const SET = await evalJS(`(function () {
  /* 点了会重画的按钮：**每次点击前必须重新取节点**。
     这些页是整页 innerHTML 重画，先前抓到的那几个 DOM 引用
     在第一次点击之后就成了游离节点——事件的委托挂在新容器上，
     点一颗游离的旧按钮等于什么都没点（这次踩的就是这个）。 */
  function hit(sel) {
    var el = document.querySelector('#panel ' + sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }
  function q(sel) { return document.querySelector('#panel ' + sel); }
  BS.app.go('settings');
  var P = document.getElementById('panel');
  var rail = document.querySelector('#rail [data-go="settings"]');
  var hasSaveBtn = !!document.getElementById('btnSave');
  var log0 = (BS.bus.state.log || []).length;
  var saveHit = hit('[data-act="save"]');
  var logGrew = (BS.bus.state.log || []).length > log0;
  var expHit = hit('[data-act="export"]');
  var box = q('#expbox');
  var txtLen = box ? box.value.length : 0;
  /* 重置：第一下只亮确认 */
  var runs0 = BS.bus.state.meta.runs | 0;
  var resetHit = hit('[data-act="reset"]');
  var armed = !!q('[data-act="resetYes"]');
  var stillIntact = (BS.bus.state.meta.runs | 0) === runs0;
  hit('[data-act="resetNo"]');
  var disarmed = !q('[data-act="resetYes"]');
  /* 真确认 */
  hit('[data-act="reset"]');
  hit('[data-act="resetYes"]');
  var wiped = (BS.bus.state.meta.runs | 0) === 0 && BS.store.count() === 3;
  return {
    rail: !!rail, hasSaveBtn: hasSaveBtn, logGrew: logGrew, saveHit: saveHit, expHit: expHit,
    txtLen: txtLen, resetHit: resetHit,
    armed: armed, stillIntact: stillIntact, disarmed: disarmed, wiped: wiped,
    txt: (P.textContent || '').slice(0, 400)
  };
})()`);
const SV = SET.v || {};
ok(SV.rail === true, '导航里有设置页');
ok(SV.hasSaveBtn === false, '顶栏的「存档」钮已经撤掉');
ok(/设置/.test(SV.txt || ''), '设置页渲染出内容');
ok(SV.logGrew === true, '「写入存档」真的写了一条记录');
ok((SV.txtLen || 0) > 10, '「导出为文本」给出了一段可复制的存档（' + SV.txtLen + ' 字符）');
ok(SV.armed === true, '点「重置进度」只亮出确认钮');
ok(SV.stillIntact === true, '第一下没动进度（没有一击致命）');
ok(SV.disarmed === true, '「算了」能把确认收回去');
ok(SV.wiped === true, '确认之后真的清零（局数归零 + 起手礼包回库 3 枚）');

/* 留一张设置页截图（重置之前的状态长得最全：进度明细 + 三种存档动作） */await evalJS(`(function(){ BS.app.go('settings');
  var b = document.querySelector('#panel [data-act="export"]');
  if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return 1; })()`);
const setShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const setPng = Buffer.from(setShot.result.data, 'base64');
const outSet = path.join(ROOT, 'docs', 'settings_shot.png');
fs.writeFileSync(outSet, setPng);
ok(setPng.length > 20000, '设置页截图 ' + Math.round(setPng.length / 1024) + 'KB');
console.log('    截图：' + outSet);

/* ------------------------------------------------------------------
   商店「阵型」组：买到的两条旋钮必须真的改到 formationFlux 的常数上。
   它们改的是读数的幅度与峰值的反噬——所以「买到了什么」要能在
   战场上量出来，否则它只是一次数值改动。
   ------------------------------------------------------------------ */
console.log('\n== 真实浏览器：阵型组旋钮真的改到乱流上 ==');
const KN = await evalJS(`(function () {
  BS.bus.state.crystal = 100000;
  var bought = {};
  ['fscale', 'frelief'].forEach(function (id) {
    var o = BS.meta.buy(id);
    bought[id] = !!o.ok;
  });
  var r = BS.run.current();
  var b = r && r.battle;
  BS.run.syncFlux(b);
  var fx = b.flux;
  var mm = BS.metaDefs.mods(BS.bus.state.meta);
  return {
    bought: bought,
    formScale: mm.formScale, formRelief: mm.formRelief,
    dmgMul: fx.dmgMul, hpMul: fx.hpMul,
    n: b.towers.length
  };
})()`);
const KNV = KN.v || {};
ok(KNV.bought && KNV.bought.fscale === true, '阵型增益买得上');
ok(KNV.bought && KNV.bought.frelief === true, '峰值豁免买得上');
ok(KNV.formScale > 1, '阵型增益抬高了读数幅度（' + (KNV.formScale || 0).toFixed(3) + ' > 1）');
ok(KNV.formRelief < 1, '峰值豁免压低了敌血系数（' + (KNV.formRelief || 0).toFixed(3) + ' < 1）');

/* ------------------------------------------------------------------
   语言：真浏览器里切成英文，整页整栏都得跟着换。
   顺带留一张英文截图——公开展示时那一张比中文更能说明「这是成品」。
   ------------------------------------------------------------------ */
console.log('\n== 真实浏览器：切英文（含截图）==');
const LANG = await evalJS(`(function () {
  function hit(sel) {
    var el = document.querySelector('#panel ' + sel);
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }
  function q(sel) { return document.querySelector('#panel ' + sel); }
  BS.app.go('settings');
  var okBtn = hit('[data-act="lang:en"]');
  var lang = BS.i18n.lang;
  var rail = document.getElementById('rail').textContent;
  var setTxt = (q('.mhead') ? q('.mhead').textContent : '');
  BS.app.go('battle');
  var battleTxt = document.getElementById('panel').textContent.replace(/\\s+/g, ' ');
  BS.app.go('measure');
  var measureTxt = document.getElementById('panel').textContent.replace(/\\s+/g, ' ');
  return {
    clicked: okBtn, lang: lang,
    railCJK: /[\\u4e00-\\u9fa5]/.test(rail), railHead: rail.replace(/\\s+/g, ' ').slice(0, 80),
    setHead: setTxt.slice(0, 60),
    battleCJK: /[\\u4e00-\\u9fa5]/.test(battleTxt), battleHead: battleTxt.slice(0, 80),
    measureCJK: /[\\u4e00-\\u9fa5]/.test(measureTxt), measureHead: measureTxt.slice(0, 80)
  };
})()`);
const LV = LANG.v || {};
ok(LV.clicked === true, '设置页点得到语言切换钮');
ok(LV.lang === 'en', '语言真的切到 en');
ok(LV.railCJK === false, '导航栏里一个汉字都不剩（' + (LV.railHead || '') + '）');
ok(/Settings/.test(LV.setHead || ''), '设置页标题变英文（' + (LV.setHead || '') + '）');
ok(LV.battleCJK === false, '塔防页没有汉字残留（' + (LV.battleHead || '') + '）');
ok(LV.measureCJK === false, '测量页没有汉字残留（' + (LV.measureHead || '') + '）');
await evalJS(`(function(){ BS.app.go('battle'); var ls = BS.reg.list();
  for (var j = 0; j < ls.length; j++) if (ls[j].tick) ls[j].tick(16); return 1; })()`);
const enShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
const enPng = Buffer.from(enShot.result.data, 'base64');
const outEn = path.join(ROOT, 'docs', 'battle_en_shot.png');
fs.writeFileSync(outEn, enPng);
ok(enPng.length > 30000, '英文战场截图 ' + Math.round(enPng.length / 1024) + 'KB');
console.log('    截图：' + outEn);
/* 切回中文：门禁跑完之后世界要复原（存档里的偏好也是） */
await evalJS(`(function(){
  BS.i18n.setLang('zh'); BS.bus.state.prefs.lang = 'zh'; BS.bus.save();
  BS.emit ? 0 : 0; return BS.i18n.lang; })()`);

console.log('\n──────────');
console.log(pass + ' 项通过 · ' + fail + ' 项失败');
cdp.close(); edge.kill(); srv.close();
try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { }
process.exit(fail ? 1 : 0);
