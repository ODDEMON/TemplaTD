/* _probe_gate.mjs —— 质变口规则的一次性探针（jsdom，真派发 DOM 事件）。
   ------------------------------------------------------------------
   钉住 2026-10-18 修订的那三条，改回去就红：

     1. **门在 2 / 5 / 10**：一座塔从 1 级升上去，upgradeInfo 报
        need:'mutate' 的那三次，恰好发生在「下一级 = 2 / 5 / 10」时；
        其余各级都是 need:'level'（花辉光）。
     2. **一口一条**：同一口上第二次 choose 被拒
        （旧版允许叠加，于是「选一条」变成「选三条」）。
     3. **最多三口**：焊满三条之后 choose 一律被拒，且不再有下一口
        （gateLevelFor 返回 0）。

   顺带钉住两件被这次修订牵动的事：
     · 等级封顶 ≥ 10（否则第 10 级那一口永远到不了——旧版封顶 9）；
     · 每次 choose 只抬一级（叠规则不再吃级数）。

   用法：node _probe_gate.mjs    退出码：任一判据不成立即为 1。 */
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

/* 摆一座塔、开一局、进入休整（休整才能自由升级与选口） */
const boot = ev(`(function(){
  var BS = window.BS;
  BS.bus.state.dust = 900;
  BS.shop.clear();
  BS.shop.place(0, [3, 2], 0);
  var s = BS.shop.submit(); if (!s.ok) return 'submit fail: ' + s.why;
  var r = BS.run.newRun(24601, []);
  var ids = (BS.bus.state.armory || []).map(function (a) { return a.id; });
  var p = 0;
  for (var q = 0; q < ids.length && p < 1; q++) {
    for (var x = 0; x < 22 && p < 1; x++) for (var y = 0; y < 14 && p < 1; y++) {
      if (BS.run.add(r, ids[q], [x, y]).ok) { p++; x = 99; break; }
    }
  }
  if (!p) return 'no tower placed';
  BS.run.begin(r);
  /* 给够辉光：这一探针验的是门的规则，不是钱 */
  r.battle.lux = 99999;
  return 'ok';
})()`);
if (boot !== 'ok') { console.log('BOOT FAIL:', boot, errs.join(' | ')); process.exit(1); }

/* 一路升到封顶，记录每一级 upgradeInfo 报什么 */
const trace = ev(`(function(){
  var BS = window.BS, TD = BS.td, r = BS.run.current(), b = r.battle, t = b.towers[0];
  var out = [], guard = 0;
  while (guard++ < 40) {
    var info = TD.upgradeInfo(b, 0);
    var lv = t.level, muts = (t.a.mut || []).length;
    if (!info.ok) { out.push({ level: lv, need: 'none', why: info.why, muts: muts }); break; }
    if (info.need === 'mutate') {
      var pick = info.options[0];
      var c = TD.choose(b, 0, pick);
      out.push({ level: lv, need: 'mutate', gate: info.gate, picked: pick, chooseOk: c.ok, after: t.level, muts: (t.a.mut || []).length });
      if (!c.ok) break;
      /* 同一口上再选一次：必须被拒（一口一条） */
      var second = TD.choose(b, 0, info.options[info.options.length - 1]);
      out.push({ level: lv, need: 'second-pick', rejected: !second.ok, why: second.why });
    } else {
      var u = TD.upgrade(b, 0);
      out.push({ level: lv, need: 'level', ok: u.ok, after: u.ok ? u.level : lv });
      if (!u.ok) break;
    }
  }
  return JSON.stringify({
    cap: BS.eff.CAP.level,
    gates: TD.GATE_LEVELS, maxMut: TD.MAX_MUT,
    finalMut: t.a.mut.slice(), finalLevel: t.level,
    nextGate: TD.gateLevelFor(t),
    steps: out
  });
})()`);

let T;
try { T = JSON.parse(trace); } catch (e) { console.log('TRACE PARSE FAIL:', trace, errs.join(' | ')); process.exit(1); }

/* 判据 0：门表与封顶 */
ok(JSON.stringify(T.gates) === '[2,5,10]', '门在 2 / 5 / 10', T.gates);
ok(T.maxMut === 3, '最多三条规则', T.maxMut);
ok(T.cap >= 10, '等级封顶 ≥ 10（否则第 10 级那一口到不了）', T.cap);

/* 判据 1：开口恰好在 2 / 5 / 10 */
const gateSteps = T.steps.filter(s => s.need === 'mutate');
ok(gateSteps.length === 3, '一共开三次口', gateSteps.length);
ok(JSON.stringify(gateSteps.map(s => s.gate)) === '[2,5,10]', '三次口分别在第 2 / 5 / 10 级', gateSteps.map(s => s.gate));
gateSteps.forEach((s, i) => {
  ok(s.after === s.gate, '第 ' + (i + 1) + ' 口选完正好落在第 ' + s.gate + ' 级（只抬一级）', s.after);
});

/* 判据 2：一口一条——同一口第二次选被拒 */
const seconds = T.steps.filter(s => s.need === 'second-pick');
ok(seconds.length === 3, '每个口都试了第二次选择', seconds.length);
ok(seconds.every(s => s.rejected), '同一口的第二次选择一律被拒（不再叠加）', seconds.map(s => s.rejected));

/* 判据 3：三口焊满之后没有下一口，且再选被拒 */
ok(T.finalMut.length === 3, '焊满三条', T.finalMut.length);
ok(new Set(T.finalMut).size === 3, '三条互不相同', T.finalMut);
ok(T.nextGate === 0, '焊满之后不再有下一口', T.nextGate);
const lastChoose = ev(`(function(){
  var BS = window.BS, r = BS.run.current(), t = r.battle.towers[0];
  var opts = BS.td.optionsFor(t.a, t.a.mut);
  if (!opts.length) return JSON.stringify({ skipped: true });
  var c = BS.td.choose(r.battle, 0, opts[0]);
  return JSON.stringify({ rejected: !c.ok, why: c.why, muts: (t.a.mut || []).length });
})()`);
let LC; try { LC = JSON.parse(lastChoose); } catch (e) { LC = { raw: lastChoose }; }
if (!LC.skipped) {
  ok(LC.rejected, '焊满之后再选被拒', LC);
  ok(LC.muts === 3, '被拒之后仍是三条（没有悄悄加上去）', LC.muts);
}

/* 判据 4：封顶那一级之后 upgradeInfo 不再开口 */
const afterCap = ev(`(function(){
  var BS = window.BS, r = BS.run.current(), t = r.battle.towers[0];
  var i = BS.td.upgradeInfo(r.battle, 0);
  return JSON.stringify({ level: t.level, ok: i.ok, need: i.need || '-', why: i.why || '' });
})()`);
let AC; try { AC = JSON.parse(afterCap); } catch (e) { AC = { raw: afterCap }; }
ok(AC.level === T.cap, '最终等级 = 封顶', AC.level);
ok(!(AC.need === 'mutate'), '封顶之后不再开门', AC.need);

console.log('— trace —');
console.log('cap=' + T.cap, 'gates=' + JSON.stringify(T.gates), 'maxMut=' + T.maxMut);
console.log('final level=' + T.finalLevel, 'mut=' + JSON.stringify(T.finalMut), 'nextGate=' + T.nextGate);
T.steps.forEach(s => console.log('  ', JSON.stringify(s)));

if (errs.length) console.log('jsdom errors:', errs.slice(0, 4).join(' | '));
if (bad.length) {
  console.log('\n没过的：');
  bad.forEach(b => console.log('  ×', b));
  process.exit(1);
}
console.log('\n质变口规则全部成立（门 2/5/10 · 一口一条 · 最多三口）');
process.exit(0);
