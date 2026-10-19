/* tools/button_sweep.mjs —— 真浏览器（Edge + CDP）把每一个按钮都真按一遍。
   ------------------------------------------------------------------
   为什么要有这一个：三道门禁里 smoke_play 已经会派发真实 DOM 事件，
   但它只点「剧情需要的那几个」。玩家会点的钮远不止那些——
   而一个钮点不动，是不会报错的，它只是静静地没有反应。

   这一个工具的做法：
     1. 起一台真 Edge（headless），走 CDP，配一个静态服务器（file:// 下
        localStorage 与截图都有限制）。
     2. 定义十来个**场景**（起手 / 富裕 / 有塔 / 部署 / 交战 / 休整 / 结算 /
        花园 / 已重塑 / 英文）——每个钮只在它该出现的状态下露面，
        所以场景要先把状态摆出来。
     3. 每个钮：**重置场景 → 进页面 → 重新取节点**（整页重画的页，
        先前抓到的引用在第一次点击后就是游离节点，点它等于什么都没点）
        → 量它的真实矩形 → elementFromPoint 验它没被别的东西盖住
        → 真实 mousePressed / mouseReleased 落在它的中心
        → 比对**状态指纹**判这一下有没有产生任何效果。
     4. 分类：err（抛错）/ blocked（被遮挡，真浏览器里点不到）/
        invisible（零尺寸或在视口外）/ disabled（设计上就点不动，跳过）/
        noop（点了什么都没发生，留给人判读）/ ok（有反应）。

   指纹里同时装**状态字段**与**面板 HTML 哈希**：前者抓「买到了没有」，
   后者抓「重画了没有」——只装前者会漏掉那些纯粹视觉的钮（排序、筛选）。

   用法：node tools/button_sweep.mjs
   退出码：有 err / blocked / invisible 之一即为 1。
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
if (!EDGE) { console.log('找不到 Edge，跳过'); process.exit(0); }

const PORT = 9335, SRV = 8822;
const userDir = path.join(os.tmpdir(), 'templatd-sweep-' + Date.now());

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const norm = p => p.replace(/\\/g, '/');
const missing = [];
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/favicon.ico') { res.writeHead(200, { 'Content-Type': 'image/x-icon' }); return res.end(''); }
  const f = norm(path.join(ROOT, u === '/' ? 'index.html' : u));
  if (!f.startsWith(norm(ROOT)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    missing.push(u); res.writeHead(404); return res.end('no');
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

/* 手写最小 CDP 客户端（同 headless_check.mjs：不引 ws 依赖）。 */
function makeWS(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = Buffer.from(Math.random().toString(36).slice(2)).toString('base64');
    const req = http.request({
      host: u.hostname, port: u.port, path: u.pathname + u.search,
      headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key }
    });
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
          const payload = buf.slice(off, off + len);
          buf = buf.slice(off, off + len);
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
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    logs.push((m.params.args || []).map(a => a.value).join(' '));
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errs.push((d.exception && d.exception.description || d.text || '').split('\n').slice(0, 3).join(' | '));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    const t = m.params.entry.text || '';
    if (t.indexOf('favicon') >= 0) return;
    errs.push('log: ' + t);
  }
});
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');
await cdp.send('DOM.enable');

async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) return { err: r.result.exceptionDetails.text };
  return { v: r.result && r.result.result ? r.result.result.value : undefined };
}

await cdp.send('Page.navigate', { url: 'http://127.0.0.1:' + SRV + '/index.html' });
for (let i = 0; i < 60; i++) {
  const r = await ev(`!!document.querySelector('#panel .page') && !!window.BS && !!BS.reg && BS.reg.list().length`);
  if (r.v) break;
  await sleep(200);
}

/* ---------- 页内 helpers（一次注入，场景与指纹都靠它） ---------- */
await ev(`window.__SW = (function () {
  function hash(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); }
  /* 从零造一座塔（用工坊礼包里的第 0 枚元件） */
  function tower() {
    BS.shop.clear(); BS.shop.place(0, [3, 2], 0);
    var s = BS.shop.submit();
    return s.ok ? s.rec : null;
  }
  /* 这一局放得下塔的第一个格子 */
  function spot(r) {
    for (var y = 0; y < BS.td.ROWS; y++) for (var x = 0; x < BS.td.COLS; x++) {
      if (BS.td.deployOk(BS.td.start({ seed: r.seed, turrets: [] }), [x, y]) === '') return [x, y];
    }
    return null;
  }
  function plant8() {
    BS.bus.state.garden = null;
    var done = 0, guard = 0;
    while (done < 8 && guard++ < 200) {
      var ok = false;
      for (var y = 0; y < BS.garden.rows() && !ok; y++) {
        for (var x = 0; x < BS.garden.cols() && !ok; x++) {
          var o = BS.garden.plant(done % 40, [x, y], 0);
          if (o.ok) { ok = true; done++; }
        }
      }
      if (!ok) break;
    }
    return done;
  }
  /* 状态指纹：资源 + 局 + 重塑 + 面板与导航的 HTML 哈希 + 顶栏文字 */
  function digest() {
    var s = BS.bus.state, r = BS.run.current(), b = r && r.battle;
    var t = (b && b.towers.length) ? b.towers[0] : null;
    var P = document.getElementById('panel');
    return JSON.stringify([
      s.dust | 0, s.crystal | 0, s.meta.exp | 0, (s.inv || []).length, (s.armory || []).length,
      s.meta.runs | 0, (s.log || []).length, BS.eff.isCalm() ? 1 : 0, BS.i18n.lang,
      BS.meta.shapedCount(), s.meta.rallies | 0, (s.meta.lastCond || []).join(''),
      s.shop && s.shop.cells ? Object.keys(s.shop.cells).length : -1,
      s.garden && s.garden.cells ? Object.keys(s.garden.cells).length : -1,
      r ? [r.phase, b ? b.wave : 0, Math.round(b ? b.baseHp : 0), b ? b.lux | 0 : 0,
        (r.deployed || []).length, b ? b.towers.length : 0, t ? t.level : -1,
        (r.ordTaken || []).length, (r.cond || []).join(''), r.result ? 1 : 0,
        r.rerollLeft | 0, r.peek | 0, r.garageBonus | 0] : null,
      P ? hash(P.innerHTML) : '', hash(document.getElementById('rail').innerHTML),
      (document.getElementById('hud').textContent || '').replace(/\\s+/g, ' ').slice(0, 50)
    ]);
  }
  /* 页面上此刻所有可点的东西 */
  function buttons() {
    var out = [], seen = {};
    function push(act, sel, tag, label, dis) {
      if (!act || seen[act]) return; seen[act] = 1;
      out.push({ act: act, sel: sel, tag: tag, label: String(label || '').replace(/\\s+/g, ' ').slice(0, 44), dis: !!dis });
    }
    var ps = document.querySelectorAll('#panel [data-act]');
    for (var i = 0; i < ps.length; i++) {
      var el = ps[i], a = el.getAttribute('data-act');
      push(a, '#panel [data-act="' + a + '"]', el.tagName, el.textContent, el.disabled);
    }
    /* 没有 data-act 的 button：点它不可能有任何效果，单独报 */
    var bs = document.querySelectorAll('#panel button:not([data-act])');
    for (var j = 0; j < bs.length; j++) push('NOACT:' + j, '#panel button:not([data-act])', 'BUTTON', bs[j].textContent, false);
    var rs = document.querySelectorAll('#rail [data-go]');
    for (var q = 0; q < rs.length; q++) {
      var g = rs[q].getAttribute('data-go');
      push('rail:' + g, '#rail [data-go="' + g + '"]', rs[q].tagName, rs[q].textContent, false);
    }
    var c = document.getElementById('btnCalm');
    if (c) push('top:calm', '#btnCalm', 'BUTTON', c.textContent, false);
    /* 网格格：每页取前三个（工坊/花园/战场都是同一套 data-c） */
    var cs = document.querySelectorAll('#panel [data-c]');
    for (var z = 0; z < cs.length && z < 3; z++) {
      var v = cs[z].getAttribute('data-c');
      push('cell:' + v, '#panel [data-c="' + v + '"]', cs[z].tagName, '格子 ' + v, false);
    }
    return out;
  }
  return { hash: hash, tower: tower, spot: spot, plant8: plant8, digest: digest, buttons: buttons };
})();`);

/* ---------- 场景 ----------
   每个场景拆两段：
     setup —— 摆状态（在外层 go(page) **之前**跑：切语言、造塔、起局…）
     final —— 进页之后的收尾（按暂停、选中塔…）。为什么不都放 setup：
             战场页的 mount 会把 paused/selTower 重置，setup 里点的暂停
             会被外层这一次 go 冲掉——按钮 enumerated 出来是未暂停态，
             而指纹每 100ms 都在变，noop 就永远测不出来。 */
const ALL = ['forge', 'store', 'shop', 'garden', 'battle', 'meta', 'shaping', 'measure', 'armory', 'assembly', 'settings', 'codex'];
const DEPLOY = `(function(){
  var rec = __SW.tower(); if (!rec) return;
  var r = BS.run.newRun(4242, []); var sp = __SW.spot(r);
  if (sp) BS.run.add(r, rec.id, sp);
})();`;
/* 交战中的状态：起局 → 推到有敌人 → 辉光管够 */
const INBATTLE = `(function(){
  var rec = __SW.tower(); if (!rec) return;
  var r = BS.run.newRun(909, []); var sp = __SW.spot(r);
  if (!sp) return;
  BS.run.add(r, rec.id, sp);
  BS.run.begin(r);
  var g = 0; while (r.battle.enemies.length === 0 && g++ < 80) BS.td.tickOnce(r.battle);
  r.battle.lux = 9999;
})();`;
/* 时钟自己推的话指纹每 100ms 都在变，任何钮都会显得「有反应」——所以先按暂停 */
const PAUSE = `(function(){
  var p = document.querySelector('#panel [data-act="pause"]');
  if (p) p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
})();`;
const SELECT_T = `(function(){
  var c = document.querySelector('#panel [data-c][data-t]');
  if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
})();`;
const TOREST = `(function(){
  var rec = __SW.tower(); if (!rec) return;
  var r = BS.run.newRun(1516, []); var sp = __SW.spot(r);
  if (!sp) return;
  BS.run.add(r, rec.id, sp);
  BS.run.begin(r);
  var g = 0;
  while (r.phase === 'battle' && g++ < 60) BS.run.step(r);
  r.battle.lux = 9999;
  BS.bus.emit('run');
})();`;
const TOOVER = TOREST + `(function(){ var r = BS.run.current(); if (r && r.phase === 'rest') BS.run.leave(r); BS.bus.emit('run'); })();`;

const SCENES = [
  { id: 'kit', name: '起手礼包', pages: ALL, setup: `BS.bus.wipe();` },
  {
    id: 'rich', name: '富裕（尘/晶/阅历管够 + 抽过十发）', pages: ALL,
    setup: `BS.bus.wipe(); BS.bus.state.dust = 9999; BS.bus.state.crystal = 9999; BS.bus.state.meta.exp = 9999; BS.store.draw(10);`
  },
  { id: 'built', name: '军械库里有一座塔', pages: ALL, setup: `BS.bus.wipe(); __SW.tower();` },
  { id: 'draft', name: '工坊图纸上有两枚元件', pages: ['forge', 'garden'], setup: `BS.bus.wipe(); BS.shop.clear(); BS.shop.place(0, [3, 2], 0); BS.shop.place(1, [4, 2], 0);` },
  { id: 'deploy', name: '部署阶段（有预算、有候选塔）', pages: ['battle'], setup: DEPLOY },
  { id: 'battle', name: '交战中（已暂停、塔已选中）', pages: ['battle'], setup: INBATTLE, final: PAUSE + SELECT_T },
  {
    id: 'mutate', name: '交战中·质变口（2 级塔 + 殉爆）', pages: ['battle'],
    setup: INBATTLE + `(function(){ var r = BS.run.current(); if (r && r.battle) { var t = r.battle.towers[0]; if (t) { t.level = 2; t.a.mut = ['martyr']; } } })();`,
    final: PAUSE + SELECT_T
  },
  { id: 'rest', name: '休整期（三张指令 + 塔已选中）', pages: ['battle'], setup: TOREST, final: SELECT_T },
  { id: 'over', name: '结算页', pages: ['battle'], setup: TOOVER },
  { id: 'garden', name: '园子里种了八棵', pages: ['garden', 'forge'], setup: `BS.bus.wipe(); __SW.plant8();` },
  {
    id: 'shaped', name: '重塑树上已登记（含二档战况）', pages: ['shaping', 'battle', 'settings', 'shop'],
    setup: `BS.bus.wipe(); BS.bus.state.meta.exp = 9999; BS.bus.state.meta.shaped = { k_fund: 1, k_budget: 1, o_adv: 1, o_cond1: 1, r_lost: 1, r_deep: 1 };`
  },
  {
    id: 'en', name: '英文界面', pages: ALL,
    setup: `BS.bus.wipe(); BS.i18n.setLang('en'); BS.bus.state.prefs.lang = 'en'; BS.bus.save(); __SW.tower();`
  }
];

/* 少数钮要点之前先往页里塞点东西（导入框） */
const PRE = {
  'import': `(function(){ var b = document.querySelector('#impbox'); if (b) b.value = BS.bus.encode(); })();`
};

/* 覆盖清单：源码里出现过的动作前缀。没被任何场景点到的，最后单独报。 */
const EXPECT = ['new', 'begin', 'pause', 'sp:', 'skip', 'next', 'leave', 'again', 'up:', 'pri:', 'mut:',
  'boom:', 'sell:', 'sel:', 'pick:', 'rm:', 'cond:', 'ord:', 'reroll', 'go:', 'goSettings', 'clear', 'fm:',
  'pg:', 'rar:', 'rot', 'submit', 'take:', 'tr:', 'handnone', 'dis:', 'buy:', 'draw:', 'vw:', 'fit:',
  'save', 'export', 'import', 'reset', 'resetNo', 'resetYes', 'lang:', 'rally', 'rallyNo', 'rallyYes',
  'shape:', 'es:', 'rail:', 'top:calm', 'cell:', 'NOACT:'];

const seen = {};
const rows = [];
let clicked = 0;

for (const sc of SCENES) {
  for (const page of sc.pages) {
    console.log('… ' + sc.id + ' / ' + page);
    /* 先枚举一次，知道这一页这一状态下有哪些钮 */
    await ev(`(function(){ ${sc.setup} BS.app.go('${page}'); ${sc.final || ''} return 1; })()`);
    await sleep(90);
    const en = await ev(`__SW.buttons()`);
    const btns = (en.v || []);
    if (en.err) { rows.push({ sc: sc.id, page, act: '(枚举失败)', res: 'err', detail: en.err }); continue; }
    for (const b of btns) {
      if (b.dis) { rows.push({ sc: sc.id, page, act: b.act, res: 'disabled', label: b.label }); continue; }
      const pre = PRE[b.act] || '';
      const r = await ev(`(function(){
        ${sc.setup}
        BS.app.go('${page}');
        ${sc.final || ''}
        var el = document.querySelector(${JSON.stringify(b.sel)});
        if (!el) return JSON.stringify({ miss: true });
        ${pre}
        el.scrollIntoView({ block: 'center', inline: 'center' });
        var rc = el.getBoundingClientRect();
        var cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
        var top = document.elementFromPoint(cx, cy);
        return JSON.stringify({
          x: Math.round(cx), y: Math.round(cy),
          w: Math.round(rc.width), h: Math.round(rc.height),
          vis: !!(rc.width > 0 && rc.height > 0),
          covered: !(el === top || (top && el.contains(top))),
          top: top ? (top.tagName + '.' + String(top.className || '').slice(0, 24)) : 'none',
          d0: __SW.digest()
        });
      })()`);
      if (r.err) { rows.push({ sc: sc.id, page, act: b.act, res: 'err', label: b.label, detail: r.err }); continue; }
      let p = {};
      try { p = JSON.parse(r.v); } catch (e) { p = {}; }
      if (p.miss) { rows.push({ sc: sc.id, page, act: b.act, res: 'miss', label: b.label }); continue; }
      if (!p.vis) { rows.push({ sc: sc.id, page, act: b.act, res: 'invisible', label: b.label, detail: p.w + 'x' + p.h }); continue; }
      if (p.covered) { rows.push({ sc: sc.id, page, act: b.act, res: 'blocked', label: b.label, detail: '上面是 ' + p.top }); continue; }
      errs.length = 0;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await sleep(110);
      const d = await ev(`__SW.digest()`);
      clicked++;
      const thrown = errs.slice();
      seen[b.act.replace(/:\d+.*$/, ':').replace(/^(rail|cell):.*$/, '$1')] = 1;
      seen[b.act] = 1;
      if (thrown.length) {
        rows.push({ sc: sc.id, page, act: b.act, res: 'err', label: b.label, detail: thrown[0].slice(0, 160) });
      } else if (d.err) {
        rows.push({ sc: sc.id, page, act: b.act, res: 'err', label: b.label, detail: d.err });
      } else if (d.v !== p.d0) {
        rows.push({ sc: sc.id, page, act: b.act, res: 'ok', label: b.label });
      } else {
        rows.push({ sc: sc.id, page, act: b.act, res: 'noop', label: b.label });
      }
    }
  }
}

/* ---------- 报告 ---------- */
const by = {};
for (const r of rows) { (by[r.res] = by[r.res] || []).push(r); }
const order = ['err', 'blocked', 'invisible', 'noop', 'miss', 'disabled', 'ok'];

console.log('\n================ 按钮全量实测（真 Edge · 真实鼠标事件） ================');
console.log('场景 ' + SCENES.length + ' 个 · 实点 ' + clicked + ' 次');
for (const k of order) {
  if (!by[k]) continue;
  const name = { err: '抛错', blocked: '被遮挡（真浏览器里点不到）', invisible: '不可见', noop: '点了没反应', miss: '这一态没出现', disabled: '设计上禁用的', ok: '有反应' }[k];
  console.log('\n---- ' + name + '：' + by[k].length + ' 项 ----');
  const shown = by[k].slice(0, k === 'ok' || k === 'disabled' ? 0 : 400);
  for (const r of shown) {
    console.log('  [' + r.sc + '/' + r.page + '] ' + r.act +
      (r.label ? '  「' + r.label + '」' : '') + (r.detail ? '  — ' + r.detail : ''));
  }
  if (k === 'ok' || k === 'disabled') console.log('  （略，只在计数里）');
}

console.log('\n---- 覆盖：源码里有的动作前缀，有没有被点到 ----');
const missExp = EXPECT.filter(e => !EXPECT.some(x => seen[x] && e.indexOf(x) === 0) && !seen[e]);
const really = EXPECT.filter(e => {
  if (seen[e]) return false;
  return !Object.keys(seen).some(k => k.indexOf(e) === 0 || (e.indexOf(':') > 0 && k.indexOf(e) === 0));
});
if (!really.length) console.log('  全覆盖');
else really.forEach(e => console.log('  没点到：' + e));

const bad = (by.err || []).length + (by.blocked || []).length + (by.invisible || []).length;
console.log('\n──────────');
console.log('实点 ' + clicked + ' 次 · 抛错 ' + (by.err || []).length +
  ' · 被遮挡 ' + (by.blocked || []).length + ' · 不可见 ' + (by.invisible || []).length +
  ' · 点空 ' + (by.noop || []).length + ' · 这一态没出现 ' + (by.miss || []).length +
  ' · 禁用 ' + (by.disabled || []).length + ' · 有反应 ' + (by.ok || []).length);

/* 收尾：语言切回中文，世界复原 */
await ev(`(function(){ BS.i18n.setLang('zh'); BS.bus.state.prefs.lang = 'zh'; BS.bus.save(); return 1; })()`);
cdp.close(); edge.kill(); srv.close();
try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { }
process.exit(bad ? 1 : 0);
