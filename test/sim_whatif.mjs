/* ==========================================================================
   test/sim_whatif.mjs —— 改案预演台
   --------------------------------------------------------------------------
   把「拟议中的改动」只实现在这里（不动游戏本体），重新跑一遍收益率表，
   看看最优策略有没有真的换人。改完了就从这里提炼结论，再谈要不要落到 core/。
   用法：node test/sim_whatif.mjs
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
  for (const p of tries) { try { return require(p); } catch (e) { } }
  throw new Error('找不到 jsdom');
}
const { JSDOM, VirtualConsole } = loadJsdom();

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORDER = []; const re = /<script src="([^"]+)"><\/script>/g; let mm;
while ((mm = re.exec(html))) ORDER.push(mm[1]);
const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/g, ''), {
  url: 'http://localhost/', runScripts: 'dangerously', virtualConsole: vc,
  beforeParse(w) { w.requestAnimationFrame = () => 0; w.cancelAnimationFrame = () => { }; }
});
const w = dom.window, doc = w.document;
for (const f of ORDER) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
if (!w.BS || !w.BS.app) doc.dispatchEvent(new w.Event('DOMContentLoaded'));

const BS = w.BS, S = BS.bus.state, M = BS.rig, Bd = BS.body, SM = BS.sim, AU = BS.auction;
const say = (s) => process.stdout.write(s + '\n');
const HUMAN = 2.5;
const i = (x) => Math.round(x).toLocaleString('en-US');

/* ---------- 拟议参数（改这里就能试方案） ---------- */
const CFG = {
  gate: 1,                 /* 习作/作品门槛：开 */
  WORK_CELLS: 140,         /* 够得上「作品」的格数 */
  WORK_PIECES: 18,         /* 够得上「作品」的件数 */
  GATE_CATS: { '参数': 1, '构形': 1, '名堂': 1 },   /* 这三组只在「作品」之后才计 */
  sizeBoost: 1,            /* 规模条目加一道尾 Longevity */
  sizeBoostPay: 0,         /* 额外 pay 系数 */
  salesBonus: 0            /* 每次成交的永久倍率步长 */
};

/* 重算成交：与 core/auction.js 同 formula，把门槛和倍率套上去 */
function evalWith(cfg, salesCount) {
  const ev = AU.eval(M);
  const n = ev.n, pieces = ev.pieces;
  const isWork = (!cfg.gate) || (n >= cfg.WORK_CELLS && pieces >= cfg.WORK_PIECES);
  let sum = 0, k = 0;
  const hit = [];
  for (const it of ev.items) {
    let okHit = false;
    try { okHit = !!it.ok(ev.ctx); } catch (e) { okHit = false; }
    if (!okHit) continue;
    if (cfg.gate && cfg.GATE_CATS[it.cat] && !isWork) continue;   /* 习作不计这三类 */
    sum += it.pay; k++; hit.push(it);
  }
  const st = ev.ctx.st || {};
  let traitTotal = 0; const ids = [];
  for (const tk in ev.ctx.traits) {
    traitTotal += ev.ctx.traits[tk];
    for (let z = 0; z < ev.ctx.traits[tk]; z++) ids.push(tk);
  }
  const eff = BS.parts.sumEffects(ids);
  if (eff.luxPerCell) sum += eff.luxPerCell * Math.min(300, n);
  const mult = (1 + 0.025 * k) * (1 + 0.015 * traitTotal);
  const mods = BS.tree ? BS.tree.mods() : { luxMult: 1, bid: 0 };
  const rep = 1 + 0.60 * BS.quests.rep() + 0.02 * BS.achieve.count();
  const salesMul = 1 + cfg.salesBonus * (salesCount || 0);
  const total = sum * mult * rep * (mods.luxMult || 1) * (1 + (mods.bid || 0)) * salesMul * 0.04;
  return { total: Math.max(0, total), n, pieces, k, isWork };
}

function reset() {
  S.body = Bd.mk(); S.gone = {}; S.undo = []; S.clock = 0; S.seq = 0;
  M.invalidateEssence(); BS.tree.invalidate();
}
function waitFor(n) { let g = 0; while (M.lib().length < n && g++ < 3000) M.tickClock(M.curPeriod()); return M.clock(); }
function play(n) {
  let p = 0, g = 0;
  while (p < n && g++ < 3000) {
    const lib = M.lib(); if (!lib.length) break;
    const pk = SM.pickSmallest(M, lib); if (!pk) break;
    if (!M.place(pk.i, pk.j, pk.e, 0).ok) break;
    p++;
  }
  return p;
}

say('');
say('== 改案预演：习作/作品门槛 ==');
say('   参数/构形/名堂 三类只在 格数 >= ' + CFG.WORK_CELLS + ' 且 件数 >= ' + CFG.WORK_PIECES + ' 之后才计入');
say('');
say('  目标件   实耗秒   成交价     习作/作品   光/分钟');
say('  ------------------------------------------------------------');
const rows = [];
for (const target of [3, 8, 12, 15, 18, 20, 25, 40, 60, 90]) {
  reset();
  const wait = target <= M.START ? 0 : waitFor(target);
  const got = play(target);
  const ev = evalWith(CFG, 0);
  const secs = wait + got * HUMAN;
  const pm = ev.total / Math.max(1, secs) * 60;
  rows.push({ target, secs, pay: ev.total, pm, isWork: ev.isWork, k: ev.k });
  say('  ' + String(target).padStart(5) + '  ' + String(Math.round(secs)).padStart(8) + '  ' +
    i(ev.total).padStart(9) + '   ' + (ev.isWork ? '作品' : '习作') + '      ' + String(Math.round(pm)).padStart(6));
}
const bestNow = rows.slice().sort(function (a, b) { return b.pm - a.pm; })[0];
say('');
say('   >> 改后最优：做到 ' + bestNow.target + ' 件再交，' + Math.round(bestNow.pm) + ' 光/分钟（原最优为 1 件 / 816）');
say('   >> 习作阶段的最大诱饵（8 件刷）现在是 ' + Math.round(rows.filter(r => r.target === 8)[0].pm) + ' 光/分钟');

say('');
say('== 同一段十分钟：各种打法的总收入 ==');
{
  const TEN = 600;
  for (const r of rows) {
    const cycles = TEN / r.secs;
    say('   做到 ' + String(r.target).padStart(3) + ' 件：' + String(Math.round(r.secs)).padStart(4) + 's × ' +
      cycles.toFixed(1).padStart(4) + ' 轮 = ' + i(cycles * r.pay).padStart(9) + ' 光/10分钟');
  }
}

say('');
say('== 试：给「规模」一类加一道尾巴，让长局重新跑赢 ==');
say('   （在原本最高档 n>=1500 / pay 1500 之上再加 n>=900 / pay*k系数 的测试项）');
{
  for (const boost of [0, 3000, 6000]) {
    reset(); waitFor(90); play(90);
    const base = evalWith(CFG, 0);
    const st = M.stats();
    const extra = st.n >= 900 ? boost : 0;
    say('   n=' + st.n + ' 加 ' + String(boost).padStart(5) + ' -> 成交 ' + i(base.total + extra * 0.04 * 2.5) + ' 光');
  }
}

say('');
say('== 试：每次成交给一道永久倍率 ==');
{
  for (const step of [0, 0.05, 0.08, 0.12]) {
    const cfg = Object.assign({}, CFG, { salesBonus: step });
    const line = [];
    for (const sales of [1, 5, 10, 20]) {
      const mul = 1 + step * sales;
      line.push('第' + sales + '次=x' + mul.toFixed(2));
    }
    say('   步长 ' + step.toFixed(2) + '：' + line.join('  '));
  }
}
say('');
process.exit(0);
