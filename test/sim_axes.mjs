/* ==========================================================================
   test/sim_axes.mjs —— 轴的分辨率体检
   --------------------------------------------------------------------------
   T5 的合格线不是「数字变小了」，而是「这六根柱子开始有高有矮」。
   所以这里造六种**有意为之**的形状，把它们跟「什么都不想的乱堆」摆在一起量：
     实心方块   应该是最不「分形」、最不「空腔」的那一档
     谢尔宾斯基地毯  应该是最「分形」、最「自相似」的那一档
     环 / 空心方  洞多、环多
     树        一条环都没有
     格栅      环织成网
     乱堆      基线：它拿到的每一分，都是这一局白白送人的
   用法：node test/sim_axes.mjs
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

const BS = w.BS, S = BS.bus.state, M = BS.rig, Bd = BS.body, SM = BS.sim, E = BS.essence, AU = BS.auction;
const say = (s) => process.stdout.write(s + '\n');
const KEYS = E.DEFS.map(function (d) { return d.k; });
const f2 = (x) => (x || 0).toFixed(2);

/* 直接按格落子：Bd.stamp 只查有没有压到别的东西，不查连通——正合适造图形 */
function build(cells) {
  S.body = Bd.mk(); S.gone = {}; S.clock = 0; S.seq = 0;
  M.invalidateEssence();
  Bd.stamp(S.body, 0, 0, 'n0', 0, cells, 1);
  return M.stats();
}
function solid(k) { const c = []; for (let x = 0; x < k; x++) for (let y = 0; y < k; y++) c.push([x, y]); return c; }
function carpet(level) {
  const N = Math.pow(3, level);
  const keep = (x, y) => {
    let X = x, Y = y;
    for (let i = 0; i < level; i++) {
      if (X % 3 === 1 && Y % 3 === 1) return false;
      X = Math.floor(X / 3); Y = Math.floor(Y / 3);
    }
    return true;
  };
  const c = [];
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (keep(x, y)) c.push([x, y]);
  return c;
}
function ring(k, th) {
  const c = [];
  for (let x = 0; x < k; x++) for (let y = 0; y < k; y++) {
    if (x < th || y < th || x >= k - th || y >= k - th) c.push([x, y]);
  }
  return c;
}
function lattice(k, step) {
  const c = [];
  for (let x = 0; x < k; x++) for (let y = 0; y < k; y++) {
    if (x % step === 0 || y % step === 0) c.push([x, y]);
  }
  return c;
}
function tree() {
  /* 一条主干，往上分叉两次：结构上一条环都没有 */
  const c = [];
  for (let y = 0; y < 10; y++) c.push([0, y]);
  for (let y = 10; y < 18; y++) { c.push([-1, y]); c.push([1, y]); }
  for (let y = 18; y < 24; y++) { c.push([-2, y]); c.push([0, y]); c.push([2, y]); }
  const set = {}, out = [];
  for (const p of c) { const k = p[0] + ',' + p[1]; if (!set[k]) { set[k] = 1; out.push(p); } }
  return out;
}
function heap(nPieces) {
  S.body = Bd.mk(); S.gone = {}; S.clock = 0; S.seq = 0;
  M.invalidateEssence();
  let g = 0;
  while (M.lib().length < nPieces && g++ < 3000) M.tickClock(M.curPeriod());
  let p = 0, gg = 0;
  while (p < nPieces && gg++ < 3000) {
    const lib = M.lib(); if (!lib.length) break;
    const pk = SM.pickSmallest(M, lib); if (!pk) break;
    if (!M.place(pk.i, pk.j, pk.e, 0).ok) break;
    p++;
  }
  return M.stats();
}

const SHAPES = [
  ['实心 16×16', solid(16)],
  ['地毯 L3', carpet(3)],
  ['空心方 20/th4', ring(20, 4)],
  ['格栅 21/4', lattice(21, 4)],
  ['树（无环）', tree()],
];

say('');
say('== 有意为之的形状 vs 乱堆基线 ==');
say('');
const rows = [];
function row(name, st) {
  rows.push({ name, st });
  say('  ' + name.padEnd(16) + ' 格=' + String(st.n).padStart(4) +
    '  质变度=' + f2(st.esScore) + '  ' +
    KEYS.map(function (k) { return k.slice(0, 4) + '=' + f2(st.es[k]); }).join(' '));
}
for (const [nm, cells] of SHAPES) row(nm, build(cells));
row('乱堆 40 件', heap(40));
row('乱堆 90 件', heap(90));

say('');
say('== 每根柱子的分辨率：最高与最低差多少 ==');
say('   （差得太小 = 这根柱子对任何图形都给同一个数 = 它没在测量任何东西）');
say('');
say('  轴        最低    最高    幅度    乱堆40  乱堆90   判定');
say('  ------------------------------------------------------------');
{
  const designed = rows.slice(0, SHAPES.length);
  const h40 = rows[rows.length - 2].st, h90 = rows[rows.length - 1].st;
  for (const k of KEYS) {
    let lo = 1, hi = 0;
    for (const d of designed) { const v = d.st.es[k] || 0; if (v < lo) lo = v; if (v > hi) hi = v; }
    const amp = hi - lo;
    const verdict = amp < 0.25 ? '恒真（几乎不分辨）' : (amp < 0.45 ? '偏钝' : '有分辨率');
    say('  ' + k.padEnd(9) + f2(lo) + '   ' + f2(hi) + '   ' + f2(amp) + '    ' +
      f2(h40.es[k]) + '    ' + f2(h90.es[k]) + '    ' + verdict);
  }
}

say('');
say('== 分项：每一根柱子的每一条分项，六种形状逐个摊开 ==');
say('');
{
  const which = E.DEFS.map(function (d) { return d.k; });
  for (const [nm, cells] of SHAPES) {
    const st = build(cells);
    say('  —— ' + nm + '（格=' + st.n + '，盒维数 dim=' + f2(st.esDim) + '）——');
    for (const k of which) {
      const r = E.one(k, S.body, st);
      say('      ' + k.padEnd(8) + 'v=' + f2(r.v) + '  ' +
        (r.parts || []).map(function (p) { return p.id + '=' + f2(p.v); }).join(' '));
    }
  }
  for (const nm of ['乱堆 40 件', '乱堆 90 件']) {
    const st = heap(nm === '乱堆 40 件' ? 40 : 90);
    say('  —— ' + nm + '（格=' + st.n + '，盒维数 dim=' + f2(st.esDim) + '）——');
    for (const k of which) {
      const r = E.one(k, S.body, st);
      say('      ' + k.padEnd(8) + 'v=' + f2(r.v) + '  ' +
        (r.parts || []).map(function (p) { return p.id + '=' + f2(p.v); }).join(' '));
    }
  }
}
say('');
process.exit(0);
