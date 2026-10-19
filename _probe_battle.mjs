/* _probe_battle.mjs —— 两条行为的一次性探针（jsdom，真派发 DOM 事件）。
   ------------------------------------------------------------------
   钉住这一版改的两件事，改回去就红：
     1. **目标优先级与等级不挂钩**
        · 点「最强」→ 塔的 pri 立刻是 strong，**高亮也在同一拍跟过去**
          （旧版高亮要等升一级、整块骨架重搭才对）
        · 再点升级 → pri 一个字不动（旧版读起来像「升级把优先级改掉了」）
     2. **塔详情在波次中随时能打开**
        · 战斗页有「塔条」，点一行 → 详情面板出现
        · 武装着一座待放的塔（sel >= 0）时点塔格 → 详情照样打开
          （旧版只换来一句「这一格已经有东西了」，整个武装期间都打不开）
        · deploy / rest 不摆塔条（rest 用完整塔列表）

   用法：node _probe_battle.mjs   退出码：任一判据不成立即为 1。 */
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
const click = sel => ev(`(function(){
  var b = document.querySelector(${JSON.stringify(sel)}); if (!b) return 'miss';
  b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); return 'ok';
})()`);
const state = () => ev(`(function(){
  var r = BS.run.current(), t = r && r.battle && r.battle.towers[0];
  var on = document.querySelector('#panel [data-act^="pri:"].on');
  var p = document.getElementById('panel');
  return JSON.stringify({
    phase: r ? r.phase : '-',
    pri: t ? t.pri : '-', lv: t ? t.level : '-', lux: r && r.battle ? r.battle.lux : '-',
    hi: on ? String(on.getAttribute('data-act')).split(':')[2] : 'none',
    cinf: !!p.querySelector('.cinf'), twbar: !!p.querySelector('.twbar'),
    picks: p.querySelectorAll('[data-pick]').length
  });
})()`);
const J = s => { try { return JSON.parse(s); } catch (e) { return {}; } };
function ok(name, cond, got) {
  if (!cond) bad.push(name + ' → ' + JSON.stringify(got));
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '  ' + JSON.stringify(got)));
}

/* ---------- 造一局：两座塔（一座部署、一座留在库供挑选条） ---------- */
console.log(ev(`(function(){
  BS.bus.wipe(); BS.shop.clear();
  var ids = [], k, sm;
  for (k = 0; k < 2; k++) { BS.shop.place(k, [3 + k * 3, 2], 0); sm = BS.shop.submit(); ids.push(sm.rec.id); }
  var r = BS.run.newRun(24601, []), probe = BS.td.start({ seed: r.seed, turrets: [] });
  var spots = [], x, y;
  for (y = 0; y < BS.td.ROWS; y++) for (x = 0; x < BS.td.COLS; x++)
    if (BS.td.deployOk(probe, [x, y]) === '' && spots.length < 2) spots.push([x, y]);
  BS.run.add(r, ids[0], spots[0]);
  BS.run.begin(r);
  BS.td.beginWave(r.battle);
  var g = 0; while (r.battle.enemies.length < 2 && g++ < 200) BS.td.tickOnce(r.battle);
  r.battle.lux = 500;
  BS.app.go('battle');
  return 'phase=' + r.phase + ' armory=' + BS.bus.state.armory.length;
})()`));

/* ---------- 1. 优先级：高亮当场跟过去，等级不碰它 ---------- */
console.log('\n1) 优先级与等级解耦');
let s = J(await state());
ok('开场面板未开', s.cinf === false, s);
await click('#panel [data-c][data-t]');
s = J(await state());
ok('点塔格 → 详情打开', s.cinf === true, s);
ok('初始高亮=最前', s.hi === 'first', s);
await click('#panel [data-act="pri:0:strong"]');
s = J(await state());
ok('点「最强」→ pri=strong', s.pri === 'strong', s);
ok('点「最强」→ 高亮当场变 strong（不靠等级）', s.hi === 'strong', s);
const lvBefore = s.lv;
await click('#panel [data-act^="up:"]');
s = J(await state());
ok('升级 → 等级 +1', s.lv === lvBefore + 1, s);
ok('升级 → 优先级一个字不动', s.pri === 'strong', s);
ok('升级 → 高亮还在 strong', s.hi === 'strong', s);
await click('#panel [data-act="pri:0:near"]');
s = J(await state());
ok('点「贴身」→ pri=near 且高亮同步', s.pri === 'near' && s.hi === 'near', s);

/* ---------- 2. 塔条与武装状态下的详情 ---------- */
console.log('\n2) 战斗中的进化体选择界面');
s = J(await state());
ok('战斗页有塔条', s.twbar === true, s);
await click('#panel [data-act="sel:0"]');
s = J(await state());
ok('点塔条一行 → 详情打开', s.cinf === true, s);

/* 武装一座待放的塔（sel >= 0），再点塔格：旧版这里会卡死 */
await click('#panel [data-pick]');
s = J(await state());
ok('点挑选钮 → 挑选条亮起', s.picks > 0, s);
const twBefore = ev(`BS.run.current().battle.towers.length`);
await click('#panel [data-c][data-t]');
s = J(await state());
ok('武装状态下点塔格 → 详情仍能打开', s.cinf === true, s);
ok('武装状态未被这一下吞掉（towers 不变）', ev(`BS.run.current().battle.towers.length`) === twBefore, s);

/* 休整期与部署期不摆塔条 */
await click('#panel [data-act="skip"]');
s = J(await state());
ok('休整期：无塔条（用完整列表）', s.phase === 'rest' && s.twbar === false, s);
ev(`(function(){ BS.run.newRun(999, []); BS.app.go('battle'); })()`);
s = J(await state());
ok('部署期：无塔条', s.phase === 'deploy' && s.twbar === false, s);

console.log('\nJS 异常：', errs.length ? errs.slice(0, 5) : '无');
console.log(bad.length ? '\n失败 ' + bad.length + ' 条：\n' + bad.join('\n') : '\n全部通过');
dom.window.close();
process.exit(bad.length || errs.length ? 1 : 0);
