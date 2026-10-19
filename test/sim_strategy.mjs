/* ==========================================================================
   test/sim_strategy.mjs —— 策略观测台（只读，不改游戏）
   --------------------------------------------------------------------------
   把「正常人怎么打」折算成 光/分钟，看哪种打法最优。
   如果一个三十秒就能走完的短循环，收益压过用心经营十分钟的长局，
   那么这局的全部 mit Entscheidungen 就都不成立了。
   用法：node test/sim_strategy.mjs
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

const BS = w.BS, S = BS.bus.state, M = BS.rig, Bd = BS.body, SM = BS.sim, AU = BS.auction, P = BS.parts;
const say = (s) => process.stdout.write(s + '\n');

const HUMAN = 2.5;   /* 一个正常人挑一件、看一眼、按空格：约 2.5 秒 */

function reset() {
  S.body = Bd.mk(); S.gone = {}; S.undo = []; S.clock = 0; S.seq = 0;
  M.invalidateEssence(); BS.tree.invalidate();
}
function waitFor(n) { let g = 0; while (M.lib().length < n && g++ < 3000) M.tickClock(M.curPeriod()); return M.clock(); }
function play(n) {
  let placed = 0, g = 0;
  while (placed < n && g++ < 3000) {
    const lib = M.lib(); if (!lib.length) break;
    const p = SM.pickSmallest(M, lib); if (!p) break;
    if (!M.place(p.i, p.j, p.e, 0).ok) break;
    placed++;
  }
  return placed;
}
function i(x) { return Math.round(x).toLocaleString('en-US'); }

say('');
say('== A. 各种「打到 X 件就交」的收益率 ==');
say('   人手麦克 Ils implicated 2.5s/件；单次开局白送 ' + M.START + ' 件（clock=0 就有）');
say('');
say('  目标件   等待秒   实耗秒(=等待+人手)   成交价      光/分钟');
say('  ----------------------------------------------------------------');
const rows = [];
for (const target of [1, 3, 8, 12, 15, 25, 40, 60, 90]) {
  reset();
  const wait = target <= M.START ? 0 : waitFor(target);
  const got = play(target);
  const ev = AU.eval(M);
  const pay = Math.round(ev.total);
  const secs = wait + got * HUMAN;
  const pm = pay / Math.max(1, secs) * 60;
  rows.push({ target, wait, secs, pay, pm, n: M.stats().n, k: ev.k });
  say('  ' + String(target).padStart(5) + '  ' + String(Math.round(wait)).padStart(7) + '  ' +
    String(Math.round(secs)).padStart(16) + '  ' + i(pay).padStart(10) + '  ' + String(Math.round(pm)).padStart(9));
}
const best = rows.slice().sort(function (a, b) { return b.pm - a.pm; })[0];
say('');
say('   >> 收益率最高的是「做到 ' + best.target + ' 件就交」：' + Math.round(best.pm) +
  ' 光/分钟。说明最优解是【' + (best.target <= 12 ? '短刷' : '长局') + '】。');

say('');
say('== B. 短刷 vs 长局：同一个十分钟里谁挣得多 ==');
{
  const TEN = 600;
  for (const target of [8, 15, 40, 90]) {
    const r = rows.filter(function (x) { return x.target === target; })[0];
    if (!r) continue;
    const cycles = Math.floor(TEN / r.secs);
    say('   打到 ' + String(target).padStart(3) + ' 件：一轮 ' + String(Math.round(r.secs)).padStart(4) +
      's × ' + String(cycles).padStart(2) + ' 轮 = ' + i(cycles * r.pay).padStart(9) + ' 光/10分钟');
  }
}

say('');
say('== C. 一间 Lib 头 reward：成交价的 group 构成 ==');
{
  for (const target of [8, 25, 60]) {
    reset(); waitFor(target); play(target);
    const ev = AU.eval(M);
    const byCat = {}, payCat = {};
    for (const h of ev.hit) { byCat[h.cat] = (byCat[h.cat] || 0) + 1; payCat[h.cat] = (payCat[h.cat] || 0) + h.pay; }
    const all = AU.items();
    const cnt = {};
    for (const a of all) cnt[a.cat] = (cnt[a.cat] || 0) + 1;
    say('   -- ' + target + ' 件 / ' + ev.n + ' 格 / 成交 ' + i(ev.total) + ' 光 --');
    for (const cat in cnt) {
      say('      ' + cat.padEnd(4) + ' 站住 ' + String(byCat[cat] || 0).padStart(3) + '/' + String(cnt[cat]).padStart(3) +
        '  这类给的估值 ' + String(payCat[cat] || 0).padStart(6));
    }
  }
}

say('');
say('== D. 质变六项：乱堆也能读到多少？ ==');
{
  /* 键名一律从 essence 的 DEFS 读——十一项砍成六项那天，
     这里手抄的旧键名让整行恒读 0.00，而主读数 score/spread 是对的，
     于是错得悄无声息。抄键名就会这样，所以只此一次，下不为例。 */
  const defs = BS.essence.DEFS;
  for (const target of [8, 25, 60, 90]) {
    reset(); waitFor(target); play(target);
    const st = M.stats(), es = st.es;
    say('   ' + String(target).padStart(3) + ' 件 score=' + st.esScore.toFixed(3) + ' spread=' + st.esSpread.toFixed(3) + '  ' +
      defs.map(function (d) { return d.k.slice(0, 4) + '=' + (es[d.k] || 0).toFixed(2); }).join(' '));
  }
}

say('');
say('== E. 猜测校验：把胸一块布会怎样 ==');
{
  // 只放一个 1x1 的件
  reset(); waitFor(8);
  const lib = M.lib();
  let one = null;
  for (const e of lib) if (M.cellsOf(e).length === 1) { one = e; break; }
  if (one) {
    M.place(0, 0, one, 0);
    const ev = AU.eval(M);
    say('   只装 1 格：成交 ' + i(ev.total) + ' 光，站住 ' + ev.k + ' 条 -> 也能交，也能进光');
  } else {
    say('   开局 8 件里没有 1 格的件（无所谓：只要能装就行）');
  }
}
say('');
process.exit(0);
