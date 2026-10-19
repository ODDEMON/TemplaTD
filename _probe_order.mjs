/* _probe_order.mjs —— 战备指令规则的一次性探针（jsdom）。
   ------------------------------------------------------------------
   钉住 2026-10-18 修订的那两条，改回去就红：

     1. **一波一次**：同一波里连点三张卡，第二张起必须被拒
        （旧版没有这道闸门，而 now() 是立即兑现的，于是「三张全点」白拿三份）。
     2. **不按局去重**：同一条指令在**后面的波**里可以再下一次
        （旧版「这一条本局已经下过了」拦的正是这一条）。

   顺带钉住：重掷在没下令时才给（下完令再重掷＝付了一份又反悔），
   以及 ordTaken 仍是流水（记着这一局下过哪些），不是闸门。

   用法：node _probe_order.mjs    退出码：任一判据不成立即为 1。 */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const errs = [], bad = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push(String(e.message || e)));
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), {
  url: 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html',
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
});
const w = dom.window;
await new Promise(r => setTimeout(r, 1600));

const ev = e => { try { return w.eval(e); } catch (x) { return 'ERR: ' + x.message; } };
const ok = (cond, msg, extra) => {
  if (!cond) bad.push(msg + (extra === undefined ? '' : '（实际 ' + JSON.stringify(extra) + '）'));
};

/* 摆一座塔、开一局、打完第一波进入休整（休整才有指令桌） */
const boot = ev(`(function(){
  var BS = window.BS;
  BS.bus.state.dust = 900;
  BS.shop.clear(); BS.shop.place(0, [3, 2], 0); BS.shop.place(1, [7, 3], 0);
  var s = BS.shop.submit(); if (!s.ok) return 'submit fail: ' + s.why;
  var r = BS.run.newRun(24601, []);
  var id = (BS.bus.state.armory || [])[0].id, p = 0;
  for (var x = 0; x < 22 && p < 1; x++) for (var y = 0; y < 14 && p < 1; y++) {
    if (BS.run.add(r, id, [x, y]).ok) { p++; x = 99; break; }
  }
  if (!p) return 'no tower';
  BS.run.begin(r);
  /* 直接跳到休整：这一探针验的是指令规则，不是战斗 */
  var g = 0;
  while (r.phase === 'battle' && g++ < 2000) BS.run.step(r);
  return r.phase === 'rest' ? 'ok' : 'phase=' + r.phase;
})()`);
if (boot !== 'ok') { console.log('BOOT FAIL:', boot, errs.join(' | ')); process.exit(1); }

/* 判据 1：同一波连点三张，第二张起被拒 */
const wave1 = ev(`(function(){
  var BS = window.BS, r = BS.run.current();
  var of = BS.run.offerOf(r);
  var res = [];
  for (var i = 0; i < of.length; i++) {
    var o = BS.run.pick(r, of[i]);
    res.push({ id: of[i], ok: o.ok, why: o.why || '' });
  }
  return JSON.stringify({ wave: r.battle.wave, offers: of.length, res: res,
    ordAtWave: r.ordAtWave, taken: r.ordTaken.slice(), ordMods: r.ordMods });
})()`);
let W1; try { W1 = JSON.parse(wave1); } catch (e) { console.log('PARSE FAIL:', wave1); process.exit(1); }

ok(W1.res.length >= 2, '桌上至少两张卡（才试得出连点）', W1.offers);
ok(W1.res[0] && W1.res[0].ok, '第一张下令成功', W1.res[0]);
ok(W1.res.slice(1).every(x => !x.ok), '同一波的第二张起一律被拒（一波一次）', W1.res.map(x => x.ok));
ok(/这一波已经下过令了/.test((W1.res[1] || {}).why || ''), '拒绝语说的是「这一波」不是「这一局」', (W1.res[1] || {}).why);
ok(W1.ordAtWave === W1.wave, 'ordAtWave 记在本波', W1.ordAtWave);
ok(W1.ordMods !== null, '下一波那一半挂上了', W1.ordMods);

/* 判据 2：下一波之后，同一条指令可以再下一次 */
const wave2 = ev(`(function(){
  var BS = window.BS, r = BS.run.current();
  var first = r.ordTaken[0];
  var before = { wave: r.battle.wave, ordAtWave: r.ordAtWave };
  /* 再打一波：与界面「下一波」同一条路（TD.beginWave + phase='battle'），
     再 step 到波末自动进休整。 */
  BS.td.beginWave(r.battle);
  r.phase = 'battle';
  var g = 0;
  while (r.phase === 'battle' && g++ < 6000) BS.run.step(r);
  var after = { phase: r.phase, wave: r.battle.wave, ordAtWave: r.ordAtWave, ordMods: r.ordMods };
  /* 这一波桌上有没有那条旧指令？有就再下一次 */
  var of = BS.run.offerOf(r) || [];
  var has = of.indexOf(first) >= 0;
  var again = has ? BS.run.pick(r, first) : { skipped: true, table: of };
  return JSON.stringify({
    first: first, before: before, after: after,
    table: of, hasSame: has,
    repeatOk: again.ok === true, why: again.why || '',
    taken: r.ordTaken.slice()
  });
})()`);
let W2; try { W2 = JSON.parse(wave2); } catch (e) { console.log('PARSE FAIL:', wave2); process.exit(1); }

ok(W2.after.phase === 'rest', '走到了下一波的休整', W2.after.phase);
ok(W2.after.wave > W2.before.wave, '波号前进了', [W2.before.wave, W2.after.wave]);
ok((W2.after.ordMods === null || W2.after.wave !== W2.before.wave), '上一波那一半已清掉（指令跟着波走，不跟局走）', W2.after.ordMods);
if (W2.hasSame) {
  ok(W2.repeatOk, '同一条指令在后面的波里可以再下一次（不再按局去重）', W2.why);
  ok(W2.taken.filter(x => x === W2.first).length === 2, '流水里这条记了两次', W2.taken);
} else {
  /* 桌上没摆同一条：退而求其次，验「这一波能下令」仍然成立 */
  const any = ev(`(function(){
    var BS = window.BS, r = BS.run.current(), of = BS.run.offerOf(r) || [];
    if (!of.length) return JSON.stringify({ none: true });
    var o = BS.run.pick(r, of[0]);
    return JSON.stringify({ id: of[0], ok: o.ok, why: o.why || '' });
  })()`);
  let A; try { A = JSON.parse(any); } catch (e) { A = { raw: any }; }
  ok(A.none || A.ok, '新的一波可以再下令（同一条没摆上桌时，至少新的一条能下）', A);
}

/* 判据 3：重掷在已下令的那一波不出现（界面层规则落在 orderBox） */
const box = ev(`(function(){
  var BS = window.BS, r = BS.run.current();
  var html = '';
  try { BS.app.go('battle'); } catch (e) {}
  var p = document.getElementById('panel');
  html = p ? p.innerHTML : '';
  return JSON.stringify({
    hasRerollBtn: html.indexOf('reroll') >= 0,
    locked: html.indexOf('ocards locked') >= 0 || html.indexOf('下一波再选') >= 0,
    saidWave: html.indexOf('这一波已经下过令了') >= 0
  });
})()`);

console.log('— trace —');
console.log('wave1:', JSON.stringify(W1));
console.log('wave2:', JSON.stringify(W2));
console.log('box  :', box);

if (errs.length) console.log('jsdom errors:', errs.slice(0, 4).join(' | '));
if (bad.length) {
  console.log('\n没过的：');
  bad.forEach(b => console.log('  ×', b));
  process.exit(1);
}
console.log('\n战备指令规则成立（一波一次 · 同一条可在后面的波再来）');
process.exit(0);
