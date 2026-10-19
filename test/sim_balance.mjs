/* ==========================================================================
   test/sim_balance.mjs —— 平衡观测台（只读诊断，不动游戏逻辑）
   --------------------------------------------------------------------------
   回答五个问题：
     1. 一局「不挑形状的普通玩家」能长多大、读到多少质变度？
     2. 第 N 件就交，能拍多少光？对应科技树能买到第几层？
     3. 多局累积之后，光 vs 树成本曲线，斜率谁跑得快？
     4. 任务做得完吗？声誉爬到天花板要几条？
     5. 库的节律：等一件要多久？
   用法：node test/sim_balance.mjs
   ========================================================================== */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function loadJsdom() {
  const tries = ['jsdom', path.resolve(ROOT, 'node_modules', 'jsdom'),
    'D:/__SOMETHING_REAL__/AI_Work/personal/node_modules/jsdom',
    'E:/__SOMETHING_REAL__/AI_Work/phantasia1/node_modules/jsdom'];
  for (const p of tries) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error('找不到 jsdom');
}
const { JSDOM, VirtualConsole } = loadJsdom();

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORDER = [];
const re = /<script src="([^"]+)"><\/script>/g;
let mm;
while ((mm = re.exec(html))) ORDER.push(mm[1]);
const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
  url: 'http://localhost/', runScripts: 'dangerously', virtualConsole: vc,
  beforeParse(w) { w.requestAnimationFrame = () => 0; w.cancelAnimationFrame = () => { }; }
});
const w = dom.window, doc = w.document;
for (const f of ORDER) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
if (!w.BS || !w.BS.app) doc.dispatchEvent(new w.Event('DOMContentLoaded'));

const BS = w.BS, S = BS.bus.state, M = BS.rig, Bd = BS.body;
const TR = BS.tree, Q = BS.quests, SM = BS.sim, AU = BS.auction;

const out = [];
function say(s) { out.push(s); process.stdout.write(s + '\n'); }

function resetRun() {
  S.body = Bd.mk(); S.gone = {}; S.undo = []; S.clock = 0; S.seq = 0;
  M.invalidateEssence(); BS.tree.invalidate();
}
function advanceClockToHave(n) {
  let guard = 0;
  while (M.lib().length < n && guard++ < 3000) M.tickClock(M.curPeriod());
  return M.clock();
}
function playRun(maxPieces) {
  let placed = 0, guard = 0;
  while (placed < maxPieces && guard++ < 3000) {
    const lib = M.lib();
    if (!lib.length) break;
    const pick = SM.pickSmallest(M, lib);
    if (!pick) break;
    const r = M.place(pick.i, pick.j, pick.e, 0);
    if (!r.ok) break;
    placed++;
  }
  return placed;
}
/* 光能买到第几层：每层买最便宜的那一个，逐层累加 */
function affordableTier(lux) {
  let acc = 0, tier = 0;
  for (let t = 0; t < 40; t++) {
    const ns = TR.tierOf(t).map(TR.node).filter(Boolean);
    if (!ns.length) break;
    const cheapest = Math.min.apply(null, ns.map(function (n) { return n.cost; }));
    if (acc + cheapest > lux) return tier;
    acc += cheapest; tier = t + 1;
  }
  return tier;
}
function i(x) { return Math.round(x).toLocaleString('en-US'); }
function f2(x) { return Math.round(x * 100) / 100; }

say('');
say('== 1. 一局能长多大（贪心：库里有就装，不挑形状、不回挪） ==');
say('  目标件   实装   格数   质变度   估价(光)   站住条目   落件耗时');
say('  ----------------------------------------------------------------------');
const RUNS = [8, 15, 25, 40, 60, 90];
const snap = {};
for (const target of RUNS) {
  resetRun();
  const secs = advanceClockToHave(target);
  const got = playRun(target);
  const st = M.stats();
  const ev = AU.eval(M);
  snap[target] = { pay: Math.round(ev.total), k: ev.k, n: st.n, score: st.esScore, secs: secs };
  say('  ' + String(target).padStart(6) + '  ' + String(got).padStart(6) + '  ' +
    String(st.n).padStart(6) + '  ' + f2(st.esScore).toString().padStart(7) + '  ' +
    i(ev.total).padStart(10) + '  ' + String(ev.k).padStart(8) + '  ' +
    (Math.round(secs) + 's').padStart(10));
}

say('');
say('== 2. 一局拍价 vs 科技树逐层成本 ==');
say('  最便宜节点的层成本：');
{
  const line = [];
  for (let t = 0; t <= 12; t++) {
    const ns = TR.tierOf(t).map(TR.node).filter(Boolean);
    line.push('T' + t + ':' + i(Math.min.apply(null, ns.map(function (n) { return n.cost; }))));
  }
  say('    ' + line.join('  '));
}
say('  经营到第 X 件就交出去 -> 这笔光够买到第几层：');
for (const target of RUNS) {
  const s = snap[target];
  say('    ' + String(target).padStart(4) + ' 件 / ' + Math.round(s.secs) + 's -> ' +
    i(s.pay).padStart(9) + ' 光  买得起第 ' + affordableTier(s.pay) + ' 层');
}

say('');
say('== 3. 多局累积：在同一局长到 40 件就交，重复 N 局 ==');
say('  局数    累计光       买得起第几层       备注');
say('  ------------------------------------------------------------');
{
  const per = snap[40].pay;
  for (const n of [1, 2, 3, 5, 8, 15, 30]) {
    const acc = per * n;
    say('  ' + String(n).padStart(4) + '  ' + i(acc).padStart(12) + '   第 ' +
      String(affordableTier(acc)).padStart(3) + ' 层        单局 ' + i(per) + ' 光');
  }
}

say('');
say('== 4. 任务与声誉 ==');
{
  resetRun();
  advanceClockToHave(40);
  playRun(40);
  const prog = Q.progress(M);
  for (const p of prog) {
    say('   [' + p.def.kt + '] ' + BS.i18n.tell(p.def.say) + '  ->  ' + Math.round(p.p * 100) + '%  ' + BS.i18n.tell(p.hint));
  }
  say('   REP_STEP=' + Q.REP_STEP + ' / REP_EVERY=' + Q.REP_EVERY + ' 条 / REP_CAP=' + Q.REP_CAP +
    '  -> 封顶要 ' + (Q.REP_CAP / Q.REP_STEP * Q.REP_EVERY) + ' 条任务');
  /* 批次甲之后 claim() 真的发钱了，所以这里改成实测：领一条到底进账多少 */
  {
    var doneQ = null;
    for (const p of prog) if (p.done) { doneQ = p; break; }
    if (doneQ) {
      var lx = S.lux | 0;
      var cr = Q.claim(doneQ.def.id, M);
      say('   领一条实测：' + (cr.ok ? '成，进账 ' + ((S.lux | 0) - lx) + ' 光（这条标着 ' + doneQ.def.pay + '）'
        : '不成：' + cr.why));
    } else say('   当前没有已达成可领的任务');
  }
}

say('');
say('== 5. 库的节律 ==');
say('   基准 ' + M.PERIOD + 's/件，开局 ' + M.START + ' 件，宽限 ' + M.GRACE + 's，当前周期 ' + M.curPeriod().toFixed(1) + 's');
{
  resetRun();
  for (const t of [0, 30, 60, 120, 300, 600]) {
    while (M.clock() < t) M.tickClock(1);
    say('   ' + String(t).padStart(5) + 's  累计落件 ' + String(M.natural()).padStart(4) +
      '  库里待装 ' + String(M.lib().length).padStart(4) + '  下一件 ' + M.nextIn().toFixed(1) + 's');
  }
}

say('');
say('== 6. 自动装配：解锁后每小时铺多少件 ==');
{
  resetRun();
  // 点亮 auto 脉络前两层的近似效果：直接看节拍
  const r0 = 3.2 - 0 * 2.4;
  say('   autoRate=0.22 -> ' + Math.max(0.4, 3.2 - 0.22 * 2.4).toFixed(2) + 's/件 -> ' + (3600 / Math.max(0.4, 3.2 - 0.22 * 2.4)).toFixed(0) + ' 件/小时');
  say('   autoRate=0.60 -> ' + Math.max(0.4, 3.2 - 0.60 * 2.4).toFixed(2) + 's/件 -> ' + (3600 / Math.max(0.4, 3.2 - 0.60 * 2.4)).toFixed(0) + ' 件/小时');
  say('   而库的上游只有 ' + (3600 / M.curPeriod()).toFixed(0) + ' 件/小时 -> 自动装配远快于供给，永远在等件');
}
say('');
process.exit(0);
