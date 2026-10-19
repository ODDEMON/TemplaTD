/* ==========================================================================
   test/smoke.mjs —— jsdom 无头冒烟
   --------------------------------------------------------------------------
   这一版守的是这些：
     · 形状与字形由序号决定，同一序号永远同一形状、同一批字形、同一批特质；十八种型都出得来。
     · 稀有度的真实频率就是表上写的；luck 只往上推，不改已定的几何。
     · 两条规则真的成立：整件放得下，且至少一格贴着；图空着时第一件随便放。
     · 质变六项每项底下四条判据都真算，不给 NaN，读数落在 0..1。
     · 装一件就挣光，光由质变度给；回收也给光；撤销能把光退回去。
     · 科技树是程序生成的、往下没有尽头；前置没点就买不了；价钱按层涨。
     · 任务三条同时挂着，完成一条补一条；达成才能领；每若干条给永久 luck。
     · 成就是一次性的：解锁了拆掉一格也不会灭。
     · 合成（打包）这一套必须真的不在。
     · 每个界面都搭得起来，没有 undefined/NaN；页面上一块 canvas 都没有。
     · 四种语言换得动，译不出的诚实退回中文。
   用法：node test/smoke.mjs
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
  for (const p of tries) { try { return require(p); } catch (e) { /* 换下一处 */ } }
  throw new Error('找不到 jsdom');
}
const { JSDOM, VirtualConsole } = loadJsdom();

let pass = 0, fail = 0;
const fails = [], runtimeErrors = [];
let SECT = '';
function ok(c, l) { if (c) { pass++; return; } fail++; fails.push((SECT ? SECT + ' · ' : '') + (l == null ? '<无标签>' : l)); }
function eq(a, b, l) { ok(a === b, l + '（实际 ' + JSON.stringify(a) + '）'); }
function gt(a, b, l) { ok(a > b, l + '（实际 ' + a + '）'); }
function gte(a, b, l) { ok(a >= b, l + '（实际 ' + a + '）'); }
function lt(a, b, l) { ok(a < b, l + '（实际 ' + a + '）'); }
function lte(a, b, l) { ok(a <= b, l + '（实际 ' + a + '）'); }
function near(a, b, e, l) { ok(Math.abs(a - b) <= (e || 1e-9), l + '（实际 ' + a + '，期望 ' + b + '）'); }
function neq(a, b, l) { ok(a !== b, l + '（实际 ' + JSON.stringify(a) + '）'); }
function section(n) { SECT = n; process.stdout.write('\n  ' + n + '\n'); }

/* ---------- 起一个页面 ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ORDER = [];
const re = /<script src="([^"]+)"><\/script>/g;
let mm;
while ((mm = re.exec(html))) ORDER.push(mm[1]);
const stripped = html.replace(/<script[^>]*><\/script>/g, '');
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => runtimeErrors.push(String(e.message || e)));
vc.on('error', (m) => runtimeErrors.push('console.error: ' + String(m)));

const dom = new JSDOM(stripped, {
  url: 'http://localhost/', runScripts: 'dangerously', virtualConsole: vc,
  beforeParse(w) { w.requestAnimationFrame = () => 0; w.cancelAnimationFrame = () => { }; }
});
const w = dom.window, doc = w.document;
for (const f of ORDER) {
  try { w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch (e) { runtimeErrors.push(f + ' 执行不了：' + e.message); }
}
if (doc.readyState !== 'complete') {
  await new Promise((r) => { w.addEventListener('load', r, { once: true }); setTimeout(r, 2500); });
}
if (!w.BS || !w.BS.app) doc.dispatchEvent(new w.Event('DOMContentLoaded'));

const BS = w.BS, S = BS.bus.state, M = BS.rig, U = BS.util, Bd = BS.body;
const P = BS.parts, G = BS.geo, C = BS.catalog, A = BS.achieve, R = BS.render;
const E = BS.essence, TR = BS.tree, Q = BS.quests, SM = BS.sim;
const I = BS.i18n;

function go(id) { BS.app.go(id); }
function panel() { return doc.getElementById('panel'); }
function q(sel) { return panel().querySelector(sel); }
function fresh() {
  BS.bus.wipe();
  S.body = Bd.mk();
  S.gone = {}; S.tree = {}; S.ach = {}; S.undo = []; S.quest = null;
  delete S.chaos;
  S.lux = 0; S.luxTotal = 0;
  S.clock = 0;
  S.auc = { n: 0, total: 0, best: 0, cells: 0 };
  S.gal = []; S.bidTier = 0;
  M.sel.e = null; M.sel.r = 0;
  BS.rig.forget(); BS.tree.invalidate(); BS.rig.invalidateEssence();
  BS.bus.emit('restore');
}
/* 把页面时钟往前拨，让库里先有 n 件（关掉页面它就不走，所以只能这么拨） */
function give(n) {
  var need = Math.max(0, n - M.START);
  S.clock = M.GRACE + Math.ceil(need) * M.PERIOD * 1.6 + 2;
}
/* 直接往板上写一片格（测试用；游戏里只能整件装） */
function write(cs, ent, ox, oy, r) {
  Bd.place(M.body(), ox | 0, oy | 0, ent || 'n0', r | 0, cs, (S.seq = (S.seq | 0) + 1));
  BS.bus.emit('body');
}
/* 硬塞：直接改 b.cells，绕过「整件放得下且至少一格贴着」这条规则。
   搭场景才用得到它——比如混沌的镜像律，要摆一具断开的、故意不对称的图形。
   游戏里没有第二个地方会这么干。 */
function poke(cs, ent, ox, oy, r) {
  var b = M.body(), z, x, y;
  for (z = 0; z < cs.length; z++) {
    x = (ox | 0) + cs[z][0]; y = (oy | 0) + cs[z][1];
    b.cells[Bd.key(x, y)] = { e: ent || 'n0', ox: ox | 0, oy: oy | 0, r: r | 0, seq: (S.seq = (S.seq | 0) + 1) };
  }
  BS.bus.emit('body');
  return b;
}
var BLOCK3 = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
var RING8 = BLOCK3.filter(function (c) { return !(c[0] === 1 && c[1] === 1); });
function occ(e, ox, oy, r) {
  return P.rotCells(M.cellsOf(e), r || 0).map(function (c) { return [ox + c[0], oy + c[1]]; });
}
/* 找一件能装下的位置 */
function spot(e, r) {
  for (var i = -6; i < 40; i++) if (M.canAt(i, 0, e, r || 0)) return [i, 0];
  return null;
}
function findRar(r) {
  for (var i = 0; i < 400; i++) if (P.shapeOf(i).rar === r) return 'n' + i;
  return null;
}
function findTrait(tid) {
  for (var i = 0; i < 800; i++) if ((P.shapeOf(i).traits || []).indexOf(tid) >= 0) return 'n' + i;
  return null;
}
function findForm(fid) {
  for (var i = 0; i < 4000; i++) if (P.shapeOf(i).form === fid) return 'n' + i;
  return null;
}

/* ========================================================================== */
section('形状与字形：由序号决定，型与特质都出得来');
{
  var a = P.shapeOf(7), b = P.shapeOf(7);
  eq(JSON.stringify(a.cells), JSON.stringify(b.cells), '同一序号两次生成一模一样');
  eq(a.form, b.form, '同一序号同一型');
  eq(JSON.stringify(a.traits), JSON.stringify(b.traits), '同一序号同一批特质');
  eq(JSON.stringify(a.glyphs), JSON.stringify(b.glyphs), '同一序号同一批字形');
  ok(P.shapeOf(8).cells.length !== a.cells.length || JSON.stringify(P.shapeOf(8).cells) !== JSON.stringify(a.cells),
    '不同序号形状不同');

  var i, z, hc = 0, glyphBad = 0, maxn = 0, ns = [];
  for (i = 0; i < 300; i++) {
    var s = P.shapeOf(i);
    ns.push(s.cells.length);
    if (s.cells.length > maxn) maxn = s.cells.length;
    if (s.glyphs.length !== s.cells.length) glyphBad++;
    for (z = 0; z < s.glyphs.length; z++) if (!P.GLYPH_BY[s.glyphs[z]]) glyphBad++;
    var mnx = Infinity, mny = Infinity;
    for (z = 0; z < s.cells.length; z++) {
      if (s.cells[z][0] < mnx) mnx = s.cells[z][0];
      if (s.cells[z][1] < mny) mny = s.cells[z][1];
    }
    if (mnx !== 0 || mny !== 0) hc++;
  }
  eq(hc, 0, '三百个形状都归一化到左下角');
  eq(glyphBad, 0, '每一格都有一个认得出的字形');
  gt(maxn, 24, '最大的那件不止二十四格（实际 ' + maxn + '）');
  gt(Math.max.apply(null, ns), Math.min.apply(null, ns), '大小参差');

  /* 稀有度频率：五档严格递减 */
  var cnt = [0, 0, 0, 0, 0], N = 20000, k;
  for (i = 0; i < N; i++) cnt[P.shapeOf(i).rar]++;
  gt(cnt[0], cnt[1], '常档最多（' + cnt[0] + ' > ' + cnt[1] + '）');
  gt(cnt[1], cnt[2], '变档多于超档');
  gt(cnt[2], cnt[3], '超档多于华档');
  gt(cnt[3], cnt[4], '华档多于殿档');
  var sum = 0;
  for (k = 0; k < 5; k++) sum += cnt[k];
  eq(sum, N, '五档加起来就是全部');

  /* ---------- 造型语言：一档一套审美 ----------
     变与超是「小而强对称」，殿是「巨型而极简」——这两句不是形容词，
     是下面这几个数：平均跨度与平均格数必须真的按那个次序排开。 */
  var span = [0, 0, 0, 0, 0], cells = [0, 0, 0, 0, 0], nR = [0, 0, 0, 0, 0];
  for (i = 0; i < 4000; i++) {
    var sr = P.shapeOf(i), szr = P.size(sr.cells);
    span[sr.rar] += Math.max(szr.w, szr.h);
    cells[sr.rar] += sr.cells.length;
    nR[sr.rar]++;
  }
  var spanAvg = [], cellsAvg = [];
  for (k = 0; k < 5; k++) { spanAvg.push(nR[k] ? span[k] / nR[k] : 0); cellsAvg.push(nR[k] ? cells[k] / nR[k] : 0); }
  gt(spanAvg[4], spanAvg[3], '殿档的平均跨度大于华档（' + spanAvg[4].toFixed(1) + ' > ' + spanAvg[3].toFixed(1) + '）');
  gt(spanAvg[3], spanAvg[2], '华档的平均跨度大于超档');
  gt(spanAvg[4], 12, '殿档是巨型的：平均跨度不止十二格（实际 ' + spanAvg[4].toFixed(1) + '）');
  lt(cellsAvg[1], cellsAvg[3], '变档的体积比华档小（' + cellsAvg[1].toFixed(1) + ' < ' + cellsAvg[3].toFixed(1) + '）');
  lt(cellsAvg[2], cellsAvg[3], '超档的体积比华档小（' + cellsAvg[2].toFixed(1) + ' < ' + cellsAvg[3].toFixed(1) + '）');
  lt(spanAvg[1], 10, '变档的跨度不超过十格（实际 ' + spanAvg[1].toFixed(1) + '）');

  /* 十八种型都要出得来 */
  var formSeen = {}, formCnt = 0;
  for (i = 0; i < 3000; i++) formSeen[P.shapeOf(i).form] = 1;
  for (i = 0; i < P.FORMS.length; i++) if (formSeen[P.FORMS[i].id]) formCnt++;
  eq(formCnt, P.FORMS.length, '十八种型全部出现过（' + P.FORMS.length + ' 种）');
  for (i = 0; i < P.FORMS.length; i++) {
    ok(!!findForm(P.FORMS[i].id), '「' + P.FORMS[i].t + '」型找得到实例');
  }
  /* 每一种型都有确定性的生成器，且归一化 */
  for (i = 0; i < P.FORMS.length; i++) {
    var fe = findForm(P.FORMS[i].id), fsh = P.shapeOf(+fe.slice(1));
    var mn2 = Infinity;
    for (z = 0; z < fsh.cells.length; z++) { mn2 = Math.min(mn2, fsh.cells[z][0], fsh.cells[z][1]); }
    eq(mn2, 0, P.FORMS[i].t + ' 型也归一化到左下角');
  }

  /* ---------- 连通铁律：一件元件内部必须真的连在一起 ----------
     斜着走的那串格只有对角相邻，等于断的；生成器长歪了还有 bridge()
     兜底，但兜底本身也得有人盯着——这里对几千个序号逐个数连通块
     （4-连通，只认横竖相邻），凡是不止一块就当场拦下。 */
  function nComps(cells) {
    var set = {}, seen = {}, n = 0, zz, q2, D2 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (zz = 0; zz < cells.length; zz++) set[cells[zz][0] + ',' + cells[zz][1]] = 1;
    for (zz = 0; zz < cells.length; zz++) {
      var k0 = cells[zz][0] + ',' + cells[zz][1];
      if (seen[k0]) continue;
      n++; seen[k0] = 1; q2 = [cells[zz]];
      while (q2.length) {
        var uu = q2.pop(), dd;
        for (dd = 0; dd < 4; dd++) {
          var nx = uu[0] + D2[dd][0], ny = uu[1] + D2[dd][1], nk = nx + ',' + ny;
          if (set[nk] && !seen[nk]) { seen[nk] = 1; q2.push([nx, ny]); }
        }
      }
    }
    return n;
  }
  var frag = 0, fragMax = 0, formFrag = {}, sp0;
  for (i = 0; i < 6000; i++) {
    sp0 = P.shapeOf(i);
    var nc = nComps(sp0.cells);
    if (nc > 1) { frag++; if (nc > fragMax) fragMax = nc; formFrag[sp0.form] = 1; }
  }
  eq(frag, 0, '六千件里没有一件内部断开（最碎的一件也有 ' + fragMax + ' 块）');
  eq(Object.keys(formFrag).length, 0, '没有一种型产出过断开的骨架（' + Object.keys(formFrag).join(' / ') + '）');
  /* 字形那一层同理：一个点都不碰格边的字形，一排下来就是浮着的孤块。
     小圆点、四角星、圆、正三角、梯形、平行四边形因此整条删掉——
     字形表里、每档的候选表里，都不许再出现它们。 */
  /* 字形那一层同理，而且这条是**量出来的**：
     实心字形必须四条边都贴得住（每条边上都有一段实实在在的接触）。
     格与格是贴边相连的——只在角上点一下、或者缩在格心，排出来就是
     「一串珠子」。小圆点、四角星、圆、正三角、梯形、平行四边形、
     直角三角形、半格、粗带、斜线、角弧、菱、五/六/八边形因此整条删掉。 */
  function inPoly(pts, x, y) {
    var i, j, c = false;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if (((pts[i][1] > y) !== (pts[j][1] > y)) &&
          (x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0])) c = !c;
    }
    return c;
  }
  function edgeCov(pts, e) {
    var n = 25, t, u, x, y, hit = 0, eps = 0.004;
    /* 采样点贴在边界**里侧**一点点：正好落在边界上时射线法判不准。 */
    for (t = 0; t < n; t++) {
      u = (t + 0.5) / n;
      if (e === 0) { x = u; y = eps; }            /* 上边 */
      else if (e === 1) { x = 1 - eps; y = u; }   /* 右边 */
      else if (e === 2) { x = u; y = 1 - eps; }   /* 下边 */
      else { x = eps; y = u; }                    /* 左边 */
      if (inPoly(pts, x, y)) hit++;
    }
    return hit / n;
  }
  var thinEdges = [], solidN = 0;
  for (i = 0; i < P.GLYPHS.length; i++) {
    var gg = P.GLYPHS[i];
    if (gg.k !== 'poly') continue;
    solidN++;
    for (var e2 = 0; e2 < 4; e2++) {
      if (edgeCov(gg.pts, e2) < 0.14) thinEdges.push(gg.id + ':' + e2);
    }
  }
  /* 实心字形现在只剩方块一种，它四条边当然都贴得住——这一条仍然要量，
     因为它是「一整块看着是一整块」的唯一保证。 */
  eq(solidN, 1, '实心字形只有方块一种（实际 ' + solidN + ' 种朝向）');
  eq(thinEdges.length, 0, '方块四条边都贴得住（漏的：' + thinEdges.join(' ') + '）');
  /* 描边字形（ln / net）是另一路：它们由渲染器按邻居出笔，天生连着。
     叉号（x）是第三路：两道对角笔画，连接靠相邻格共用角上的接续。 */
  ok(P.GLYPH_BY.ln && P.GLYPH_BY.ln.k === 'line' && P.GLYPH_BY.net.k === 'net',
    '粗线与细线都属于「按邻居出笔」的连线');
  ok(P.GLYPH_BY.x && P.GLYPH_BY.x.k === 'x', '叉号是单独一路：两道对角笔画');

  var gone = ['dot', 'dot0', 'star4', 'circ', 'etri', 'etri0', 'trap', 'trap0', 'para', 'para0',
    'rtri', 'rtri0', 'half', 'half0', 'band', 'band0', 'chev', 'chev0', 'ld', 'ld0', 'ld1',
    'arc', 'arc0', 'rhomb', 'pent', 'pent0', 'hex', 'hex0', 'oct'];
  var alive = [], pi, pn, pv;
  for (i = 0; i < gone.length; i++) if (P.GLYPH_BY[gone[i]]) alive.push(gone[i]);
  eq(alive.length, 0, '那几种浮着 / 只贴边角的字形都已不在表里（' + alive.join(' ') + '）');
  var palBad = 0, names = ['dot', 'star4', 'circ', 'etri', 'trap', 'para', 'rtri', 'half', 'band', 'chev', 'ld', 'arc', 'rhomb', 'pent', 'hex', 'oct'];
  for (pn in P.STYLE_PAL) {
    for (pi = 0; pi < names.length; pi++) if (P.STYLE_PAL[pn].indexOf(names[pi]) >= 0) palBad++;
  }
  eq(palBad, 0, '每档的字形候选里都没有那几种浮着的字形');
  /* 反过来：候选表里的名字必须真的存在——写错一个字母，整档会悄悄退回方块 */
  var dangling = [];
  for (pn in P.STYLE_PAL) {
    for (pi = 0; pi < P.STYLE_PAL[pn].length; pi++) {
      pv = P.STYLE_PAL[pn][pi];
      if (!P.GLYPH_BY[pv] && !P.GLYPH_BY[pv + '0']) dangling.push(pn + ':' + pv);
    }
  }
  eq(dangling.length, 0, '每档候选表里的字形都真的存在（' + dangling.join(' ') + '）');
  /* 叉号必须真的被用上：它是这一版新加的第三种画法，没人用等于没加 */
  var usedNew = 0, gi0, sgu;
  for (i = 0; i < 600; i++) {
    sgu = P.shapeOf(i).glyphs;
    for (gi0 = 0; gi0 < sgu.length; gi0++) if (sgu[gi0] === 'x') usedNew++;
  }
  gt(usedNew, 100, '叉号确实用上了（' + usedNew + ' 格）');

  /* ---------- 型只改形状，不碰任何读数与属性 ----------
     同一片格，型标成「框」和标成「裂」，量出来必须一模一样。
     这条要是破了，型就不再是长相，而成了加成——那就违背了这一部作品的
     立场：出身与长相都不该兑换成力量。 */
  var CS_FORM = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
  function statsWithForm(frm) {
    var bb = Bd.mk();
    Bd.place(bb, 0, 0, 'n0', 0, CS_FORM, 1);
    return Bd.stats(bb, function () { return { w: 1, rar: 1, lv: 0, form: frm, traits: [], nm: 'x' }; });
  }
  var sfA = statsWithForm('ladder'), sfB = statsWithForm('shard'), sfC = statsWithForm('frame');
  var essKeys = E.DEFS.map(function (d) { return d.k; }).concat(['score']);
  essKeys.forEach(function (k) {
    near(sfA.es[k], sfB.es[k], 1e-12, '型改成裂，「' + k + '」一字不差');
    near(sfA.es[k], sfC.es[k], 1e-12, '型改成框，「' + k + '」一字不差');
  });
  ['n', 'M', 'P', 'holes', 'cyc', 'comp', 'dia', 'art', 'boxfill', 'exposure'].forEach(function (k) {
    eq(sfA[k], sfB[k], '型不改系数「' + k + '」');
  });
  /* 型不能进特质：特质效果表里没有一条是以型为键的 */
  var formInEffect = 0;
  P.TRAITS.forEach(function (t) {
    for (var kk in (t.effect || {})) if (kk.indexOf('form') >= 0) formInEffect++;
  });
  eq(formInEffect, 0, '特质效果里没有一条按型给加成');
  /* 型不决定大小：每一种型里都要出现不止一种格数 */
  var formSizes = {};
  for (i = 0; i < 3000; i++) {
    var fsz = P.shapeOf(i);
    (formSizes[fsz.form] = formSizes[fsz.form] || {})[fsz.cells.length] = 1;
  }
  for (i = 0; i < P.FORMS.length; i++) {
    var fid2 = P.FORMS[i].id, buckets = formSizes[fid2] ? Object.keys(formSizes[fid2]).length : 0;
    gt(buckets, 1, '「' + P.FORMS[i].t + '」型里不止一种格数（实际 ' + buckets + ' 种）');
  }

  /* ---------- 字形：只剩正方形 / 线条 / 叉号 ----------
     从前那一表（十字、丁字、L 折、缺口块、斜带、工字、凹口）排成一片之后
     没人分得清哪条边是哪一件画的，所以整表退场，只留三种一眼认得出的。 */
  var glSeen = {}, glN = 0;
  for (i = 0; i < 600; i++) {
    var sg = P.shapeOf(i);
    for (z = 0; z < sg.glyphs.length; z++) glSeen[sg.glyphs[z]] = 1;
  }
  for (k in glSeen) glN++;
  eq(glN, 4, '库里用到的字形正好四种：方块 / 粗线 / 细线 / 叉号（实际 ' + glN + ' 种）');
  ok(!!P.GLYPH_BY.sq && !!P.GLYPH_BY.ln && !!P.GLYPH_BY.net && !!P.GLYPH_BY.x,
    '方块、粗线、细线、叉号都在字形表里');
  /* 退场的那几种不许再回来——它们正是这一版要删掉的东西 */
  var retired = ['cross', 'tee0', 'tee1', 'lbr0', 'notch0', 'diag0', 'gran0', 'u0'];
  var stillHere = [];
  for (i = 0; i < retired.length; i++) if (P.GLYPH_BY[retired[i]]) stillHere.push(retired[i]);
  eq(stillHere.length, 0, '十字 / 丁字 / L 折 / 缺口块 / 斜带 / 工字 / 凹口都已不在表里（' + stillHere.join(' ') + '）');
  /* 三种字形都不随转向变样子：转四次仍是自己 */
  ['sq', 'ln', 'net', 'x'].forEach(function (gid) {
    eq(P.rotGlyph(P.rotGlyph(P.rotGlyph(P.rotGlyph(gid, 1), 1), 1), 1), gid, '「' + gid + '」转四次回到原地');
  });
  /* 一件元件整件同一个字形：不再出现同一件里混着两种画法 */
  var mixed = 0;
  for (i = 0; i < 600; i++) {
    var gm = {}, gmN = 0, gk;
    var sm = P.shapeOf(i);
    for (z = 0; z < sm.glyphs.length; z++) { gm[sm.glyphs[z]] = 1; }
    for (gk in gm) gmN++;
    if (gmN > 1) mixed++;
  }
  eq(mixed, 0, '六百件里没有一件混着两种字形（整件同形，一眼认得出）');
  var pr1 = P.rotPair(a.cells, a.glyphs, 1);
  eq(pr1.cells.length, a.cells.length, '格与字形一起转，格数不变');
  eq(pr1.glyphs.length, a.glyphs.length, '格与字形一起转，字形数不变');
  var pr2 = P.rotPair(a.cells, a.glyphs, 2);
  eq(JSON.stringify(P.rotCells(a.cells, 2)), JSON.stringify(pr2.cells), '一起转的结果与只转格一致');

  /* 十一种特质都要出得来 */
  var trSeen = {}, trCnt = 0, trTotal = 0;
  for (i = 0; i < 2000; i++) {
    var ts = P.shapeOf(i).traits || [];
    trTotal += ts.length;
    for (z = 0; z < ts.length; z++) trSeen[ts[z]] = 1;
  }
  for (i = 0; i < P.TRAITS.length; i++) if (trSeen[P.TRAITS[i].id]) trCnt++;
  eq(trCnt, P.TRAITS.length, '十一种特质全部出现过');
  gt(trTotal, 300, '两千件里带特质的总数够多（' + trTotal + '）');
  /* 特质条数不超过稀有度给的上限 */
  var over = 0;
  for (i = 0; i < 2000; i++) {
    var sp = P.shapeOf(i);
    if ((sp.traits || []).length > P.RARITY[sp.rar].traits) over++;
  }
  eq(over, 0, '没有一件的特质条数超过它那一档的上限');
  /* 每种特质的 effect 都写得出来 */
  var noEff = 0;
  for (i = 0; i < P.TRAITS.length; i++) {
    if (!P.TRAITS[i].effect || !Object.keys(P.TRAITS[i].effect).length) noEff++;
    ok(!!P.TRAITS[i].d && P.TRAITS[i].d.length > 4, P.TRAITS[i].t + ' 有说清它干什么');
  }
  eq(noEff, 0, '每种特质都有效果');

  /* ---------- 铁律：科技与任务改不动形状 ----------
     形状决定长相，长相决定这一件美不美。若科技能把已落下的件改形，
     板上那具图形就会在你点下节点的那一刻自己散掉——所以这里盯死它。 */
  var geoBefore = [];
  for (i = 0; i < 400; i++) geoBefore.push(JSON.stringify(P.shapeOf(i).cells));
  S.tree['T0:aspect'] = 1; S.tree['T1:aspect'] = 1; S.tree['T2:aspect'] = 1;
  S.tree['T3:aspect'] = 1; S.tree['T4:aspect'] = 1;
  TR.invalidate(); M.forget();
  gt(TR.mods().bid, 0, '点亮「相」之后眼光加成大于 0');
  var geoChanged = 0;
  for (i = 0; i < 400; i++) if (JSON.stringify(P.shapeOf(i).cells) !== geoBefore[i]) geoChanged++;
  eq(geoChanged, 0, '科技没有改动任何一件的几何（同一序号同一形状）');
  S.tree = {}; TR.invalidate(); M.forget();
  ok(P.nameOf(3).indexOf('·') > 0, '元件有名：' + P.nameOf(3));
  eq(P.nameOf(3), P.nameOf(3), '名字是确定的');
}

section('质变六项：每项都有判据，全部真算');
{
  fresh();
  write(BLOCK3, 'n0', 0, 0, 0);
  var raw = M.statsRaw();
  ok(!!raw.es, 'stats 里带上了质变六项');
  /* 键一律从 DEFS 取：加减指标那天，这一整段跟着走，不用人来改 */
  var keys = E.DEFS.map(function (d) { return d.k; });
  eq(keys.length, 6, '一共六项（' + keys.join('、') + '）');
  keys.forEach(function (k) {
    ok(typeof raw.es[k] === 'number', k + ' 是个数');
    gte(raw.es[k], 0, k + ' 不低于 0');
    lte(raw.es[k], 1, k + ' 不超过 1');
    ok(isFinite(raw.es[k]), k + ' 是有限数');
  });
  gte(raw.es.score, 0, '质变度不低于 0');
  lte(raw.es.score, 1, '质变度不超过 1');
  /* 每一项底下都挂着四条判据，每条都有权重、读数与说法 */
  keys.forEach(function (k) {
    var d = raw.esDetail[k];
    ok(!!d && Array.isArray(d.parts), k + ' 有判据明细');
    eq(d.parts.length, 4, k + ' 底下正好四条判据');
    /* 每一项还必须配一句「自己怎么验」的话——
       六项之所以能被记住，靠的就是这一句，不是靠那四个数。 */
    var dk = E.DEFBY[k];
    ok(!!dk && dk.ask && typeof dk.ask.t === 'string' && dk.ask.t.length > 4,
      k + ' 配了一句能自己动手验的话');
    ok(!!dk && dk.ask && typeof dk.ask.en === 'string' && dk.ask.en.length > 0,
      k + ' 那句话自带英文');
    var wsum = 0, bad = 0;
    d.parts.forEach(function (p) {
      wsum += p.w;
      if (!(p.v >= 0 && p.v <= 1)) bad++;
      /* 说法可能是静态串，也可能是 {t:'模板#', a:[参数]}。
         两者都要能落成一句非空的话——用中文渲染，因为源串是中文。 */
      var say = BS.i18n.tell(p.note);
      if (typeof say !== 'string' || !say.length) bad++;
      if (say.indexOf('#') >= 0) bad++;          /* 占位符必须都填掉了 */
      if (!p.t || !p.t.length) bad++;
      if (!isFinite(p.v)) bad++;
    });
    eq(bad, 0, k + ' 的四条判据读数都在 0..1 且都有说法');
    near(wsum, 1, 1e-9, k + ' 的四条权重加起来是 1');
  });

  /* 空图：六项全是 0，不给 NaN */
  var empty = Bd.stats(Bd.mk(), M.metaOf);
  keys.forEach(function (k) {
    eq(empty.es[k], 0, '空图的 ' + k + ' 是 0');
  });
  eq(empty.es.score, 0, '空图的质变度是 0');
  var nanKeys = [];
  (function () { var kk; for (kk in empty) if (typeof empty[kk] === 'number' && !isFinite(empty[kk])) nanKeys.push(kk); })();
  eq(nanKeys.length, 0, '空图的全部系数里没有 NaN（' + nanKeys.join(',') + '）');

  /* 三三格：全对称，所以「对称」该读得高 */
  gt(raw.es.sym, 0.5, '三三格是 D4，对称读数高（' + raw.es.sym.toFixed(3) + '）');
  eq(raw.sym.order, 8, '三三格的对称群阶是 8');

  /* 中空八格：有洞、有凹角，通透该比实心块高 */
  var b2 = Bd.mk();
  Bd.place(b2, 0, 0, 'n0', 0, RING8, 1);
  var st2 = Bd.stats(b2, M.metaOf);
  eq(st2.n, 8, '八格');
  eq(st2.holes, 1, '围出一个洞');
  eq(st2.rings, 2, '内外两条环');
  eq(st2.conc, 4, '内环四个凹角');
  gt(st2.es.void, raw.es.void, '围出洞之后通透比实心块高（环 ' + st2.es.void.toFixed(3) + ' / 块 ' + raw.es.void.toFixed(3) + '）');

  /* 一条长线：一条枝走到底，围不出圈——环络该读得很低 */
  var line = [], i2;
  for (i2 = 0; i2 < 24; i2++) line.push([i2, 0]);
  var b3 = Bd.mk();
  Bd.place(b3, 0, 0, 'n0', 0, line, 1);
  var st3 = Bd.stats(b3, M.metaOf);
  eq(st3.n, 24, '二十四格一条线');
  eq(st3.dia, 23, '最长链 23');
  eq(st3.aspect, 24, '长短比 24');
  gt(st2.es.weave, st3.es.weave, '围出圈的环络高于一条线（' + st2.es.weave.toFixed(3) + ' / ' + st3.es.weave.toFixed(3) + '）');
  gt(st3.exposure, raw.exposure, '线比实心块摊得开');

  /* 单格：不给 NaN，六项都算得出来 */
  var b4 = Bd.mk();
  Bd.place(b4, 0, 0, 'n0', 0, [[0, 0]], 1);
  var st4 = Bd.stats(b4, M.metaOf);
  eq(st4.n, 1, '一格');
  keys.forEach(function (k) { ok(isFinite(st4.es[k]), '单格的 ' + k + ' 是有限数'); });
  ok(isFinite(st4.es.score), '单格的质变度是有限数');

  /* grade 分档。门槛跟着实现走：六项之后「极」抬到 0.92。 */
  eq(E.grade(0).t, '微', '0 分是「微」');
  eq(E.grade(0.92).t, '极', '0.92 是「极」');
  eq(E.grade(0.86).t, '上', '0.86 从前算「极」，现在只算「上」');
  eq(E.DEFS.length, 6, '六项指标');
  eq(Object.keys(st2.es).filter(function (k) { return k !== 'score'; }).length, 6, 'es 里正好六项（外加合成分 score）');
  /* 每一项都得量得出来，且落在 0..1。跟着 DEFS 走，将来加一项不会漏测。 */
  E.DEFS.forEach(function (d) {
    var v = st2.es[d.k];
    ok(typeof v === 'number' && isFinite(v), '「' + d.k + '」量得出来（' + (v || 0).toFixed(3) + '）');
    gte(v, 0, '「' + d.k + '」不低于 0');
    lte(v, 1, '「' + d.k + '」不超过 1');
  });
  /* 合成分＝六项加权几何平均，一项都不多乘。
     落差与掉队照旧量，但只作诊断——这条是这一版改掉的东西，得钉死。 */
  var flatV = {}, lop = {};
  E.DEFS.forEach(function (d) { flatV[d.k] = 0.6; lop[d.k] = 0.8; });
  lop[E.DEFS[1].k] = 0.2;
  var cmp = E.compose(lop);
  near(cmp.score, cmp.gm, 1e-12, '合成分就是几何平均，没有另外的折扣');
  near(E.compose(flatV).score, 0.6, 1e-9, '六项都是 0.6，合成分就是 0.6');
  lt(cmp.score, 0.8, '一项矮下去，整条乘积跟着矮——几何平均自己就在罚');
  var flat = E.compose(flatV);
  eq(flat.spread, 0, '六项齐平的时候落差是 0');
  eq(flat.weak, 0, '六项都在 0.30 以上，一个掉队的都没有');
  eq(flat.gm, flat.score, '齐平的时候几何平均与合成分逐位相同');
  lt(flat.spread, cmp.spread, '参差的时候落差更大');
  /* 掉队：读数照量，分不再另外扣 */
  var weakV = {};
  E.DEFS.forEach(function (d) { weakV[d.k] = 0.6; });
  weakV[E.DEFS[E.DEFS.length - 1].k] = 0.10;
  var wv = E.compose(weakV);
  eq(wv.weak, 1, '压低一项，掉队数就是 1');
  near(wv.score, wv.gm, 1e-12, '掉队不再额外扣分');
  lt(wv.score, 0.6, '但它确实把几何平均拽下去了（' + wv.score.toFixed(3) + '）');
  gt(wv.spread, flat.spread, '压低一项之后落差也跟着变大');
  eq(wv.lo, 0.10, '最矮的那项就是被压到 0.10 的那一项');
  /* 惩罚真的不在了：把一项压到贴地，分也不该出现「额外的」跌幅——
     即 score/gm 恒为 1，任何取值都一样 */
  var floorV = {};
  E.DEFS.forEach(function (d) { floorV[d.k] = 0.9; });
  floorV[E.DEFS[0].k] = 0.01; floorV[E.DEFS[2].k] = 0.01;
  var fv = E.compose(floorV);
  eq(fv.weak, 2, '两项贴地，掉队数是 2');
  near(fv.score / fv.gm, 1, 1e-12, '掉队两项也不再叠罚（ratio ' + (fv.score / fv.gm).toFixed(6) + '）');
  /* 有洞的比实心的空腔秩序高 */
  gte(st2.es.void, raw.es.void, '环的通透不低于实心块（' + st2.es.void.toFixed(3) + ' / ' + raw.es.void.toFixed(3) + '）');

  /* 大图形不能把机器拖死：两百格量一遍要在合理时间内回来 */
  var big = [], bx, by;
  for (bx = 0; bx < 20; bx++) for (by = 0; by < 10; by++) big.push([bx, by]);
  var b5 = Bd.mk();
  Bd.place(b5, 0, 0, 'n0', 0, big, 1);
  var t0 = Date.now();
  var st5 = Bd.stats(b5, M.metaOf);
  var dt = Date.now() - t0;
  eq(st5.n, 200, '两百格');
  lt(dt, 4000, '两百格量一遍不超过四秒（实际 ' + dt + ' ms）');
  keys.forEach(function (k) { ok(isFinite(st5.es[k]), '两百格的 ' + k + ' 是有限数'); });
}

section('光：只在呈交那一刻到账');
{
  fresh(); give(20);
  eq(S.lux, 0, '开局没有光');
  var lib = M.lib();
  var e = lib[0];
  var at = spot(e, 0);
  ok(!!at, '找得到放得下的位置');
  var r = M.place(at[0], at[1], e, 0);
  ok(r.ok, '装上了');
  eq(S.lux, 0, '装一件不进账');
  eq(S.luxTotal, 0, '累计也还是 0');
  eq(S.stat.placed, 1, '装了一件');
  gt(BS.auction.eval(M).total, 0, '可是估价已经不是 0 了（' + U.big(BS.auction.eval(M).total) + '）');

  /* 鉴赏录：条目够多，每一条都说得清自己认什么 */
  var items = BS.auction.items(), it, noD = 0, noPay = 0;
  gt(items.length, 80, '鉴赏录条目够多（' + items.length + ' 条）');
  for (it = 0; it < items.length; it++) {
    if (!items[it].d || items[it].d.length < 3) noD++;
    if (!(items[it].pay > 0)) noPay++;
  }
  eq(noD, 0, '每一条都写明了它认什么');
  eq(noPay, 0, '每一条都有自己的价钱');
  var gs = BS.auction.groups();
  gt(gs.length, 3, '条目分成了 ' + gs.length + ' 类');
  for (it = 0; it < gs.length; it++) gt(BS.auction.inGroup(gs[it]).length, 0, '「' + gs[it] + '」这一类里不是空的');

  /* 估价随结构走：越做越值钱——这就是这一版的正反馈 */
  var v1 = BS.auction.eval(M).total;
  var more = 0, z;
  for (z = 0; z < 8; z++) {
    var ez = M.lib()[0];
    if (!ez) break;
    var az = spot(ez, 0);
    if (!az) break;
    if (M.place(az[0], az[1], ez, 0).ok) more++;
  }
  gt(more, 0, '又装了 ' + more + ' 件');
  var v2 = BS.auction.eval(M).total;
  gt(v2, v1, '越做越值钱（' + U.big(v1) + ' → ' + U.big(v2) + '）');
  var ev = BS.auction.eval(M);
  gt(ev.k, 0, '已经有 ' + ev.k + ' 条站住了');
  lte(ev.k, ev.items.length, '站住的条数不超过总条数');
  gt(ev.top.length, 0, '最值钱的那几条列得出来');

  /* 呈交：成交、图纸归零、元件一并离场——除光与科技外全部重置 */
  var cellsBefore = M.stats().n, piecesBefore = M.insts().length;
  gt(cellsBefore, 0, '板上确实有东西');
  /* 先攒下一点会被清掉的东西：记录、撤销栈、成就、任务进度、时钟、陈列 */
  BS.bus.log('一条会被清掉的旧记录', 't');
  BS.bus.log('再一条', 't');
  S.undo = [{ k: 'place', i: 0, j: 0, e: 'n0', r: 0 }];
  S.ach = { fake: 1 };
  S.quest = { act: [], next: 5, done: 7, rep: 0.5, seen: {} };
  S.clock = 4321;
  S.bidTier = 2;
  S.tree = { 'T0:aspect': 1 };
  BS.tree.invalidate(); M.forget();
  var luxBefore = S.lux, totBefore = S.luxTotal;
  var sr = M.sell();
  ok(sr.ok, '成交了');
  gt(S.lux, 0, '光到账了（' + U.big(S.lux) + '）');
  gt(S.luxTotal, 0, '累计也记上了');
  ok(S.lux >= luxBefore, '旧的光一点没少');
  ok(S.luxTotal > totBefore, '累计只多不少');
  eq(S.tree['T0:aspect'], 1, '点亮的科技留了下来');
  eq(M.stats().n, 0, '图纸归零了');
  eq(M.insts().length, 0, '元件全部离场');
  ok(M.lib().indexOf(e) < 0, '拍出去的件不在库里了');
  /* 其余一切从零再来：记录只剩新局的头一条 */
  eq(S.log.length, 1, '记录清空了，只剩新局的头一条');
  eq(S.log[0].k, 'auc', '新局的头一条就是成交回执');
  eq(S.undo.length, 0, '撤销栈清空了');
  eq(Object.keys(S.ach).length, 0, '成就清空了');
  /* 声誉与任务序号改为跨局保留：一局做不完 60 条任务，而声誉封顶恰要 60 条，
     每局清零等于这条长期曲线物理上不存在。挂着的**那三条**仍然要重发。
     断言放在这里的方式是「先做一点进度，再交一次，看它还在不在」——
     上面那些「归零」的断言验的是别的字段，声誉要走自己的那一段。 */
  ok(S.quest && Array.isArray(S.quest.act) && S.quest.act.length === Q.SLOTS,
    '挂着的那三条重发过了');
  {
    var repKeep = 0.03, doneKeep = 3, nextKeep = 7;
    S.quest.rep = repKeep; S.quest.done = doneKeep; S.quest.next = nextKeep;
    var eK = M.lib()[0], atK = spot(eK, 0);
    M.place(atK[0], atK[1], eK, 0);
    ok(M.sell().ok, '带着声誉再交一次');
    eq(S.quest.rep, repKeep, '声誉跨过了这一局（' + repKeep + '）');
    eq(S.quest.done, doneKeep, '完成计数跨过了这一局');
    gte(S.quest.next, nextKeep, '任务序号接着往下走，没有回到 0（' + nextKeep + ' → ' + S.quest.next + '）');
    eq(S.quest.act.length, Q.SLOTS, '重发之后又是三条');
    ok(S.quest.act.every(function (a) { return (a.qi | 0) >= nextKeep; }),
      '发出来的三条都是新序号，不是上一局剩下的');
  }
  eq(S.clock, 0, '页面时钟归零了');
  eq(S.bidTier, 0, '估价档位从头再报');
  /* 成交记录改为累加：「你已经成交过 N 次」是鉴赏录那道永久倍率的计数器，
     清零就等于把长期曲线按在地上。第一次成交之后它就该是 1。 */
  eq((S.auc || {}).n, 2, '成交记录跨局累加（本段已成交两次：外头一次 + 上面保留性验证一次）');
  eq((S.stat.sold | 0), 0, '统计从零起算：刚成交的这次算上一局的，不记进新局');
  eq((S.gal || []).length, 0, '陈列一并清空');
  /* 上交是往复的：光与科技一路留，其余每局都从零起 */
  var round;
  for (round = 0; round < 3; round++) {
    give(20);
    var eR = M.lib()[0], atR = spot(eR, 0);
    ok(!!eR && !!atR, '第 ' + (round + 1) + ' 轮：库里又有件了');
    if (!eR || !atR) break;
    M.place(atR[0], atR[1], eR, 0);
    ok(M.sell().ok, '第 ' + (round + 1) + ' 轮也成交了');
    eq((S.gal || []).length, 0, '陈列没有再攒起来');
    gt(S.luxTotal, 0, '光一路留着');
  }
  eq(S.tree['T0:aspect'], 1, '科技一路留着');
  fresh(); give(20);
  ok(!M.sell().ok, '空板没有东西可交：' + M.sell().why);

  /* 丢弃不换光——光只在呈交那一刻给 */
  fresh(); give(20);
  var e3 = M.lib()[0];
  var lux0 = S.lux;
  var rc = M.discard(e3);
  ok(rc.ok, '丢弃成了');
  eq(S.lux, lux0, '丢弃不换光');
  eq(S.stat.recycled, 1, '丢弃计了数');
  ok(!M.discard(e3).ok, '同一件不能丢两次');
  ok((S.gone || {})[e3], '丢掉的记进 gone');
  ok(M.lib().indexOf(e3) < 0, '它不在库里了');
  /* 板上的不能直接丢 */
  fresh(); give(20);
  var e4 = M.lib()[0], at4 = spot(e4, 0);
  M.place(at4[0], at4[1], e4, 0);
  ok(!M.discard(e4).ok, '板上的东西得先拆下来');

  /* spend / can / gain 三件套 */
  fresh();
  S.lux = 100;
  ok(BS.bus.can(100), 'can 认得刚好够');
  ok(!BS.bus.can(101), 'can 认得不够');
  ok(BS.bus.spend(40), 'spend 扣得动');
  eq(S.lux, 60, '扣完剩 60');
  ok(!BS.bus.spend(1000), 'spend 不够就不动');
  eq(S.lux, 60, '不够的时候一分没扣');
  BS.bus.gain(5);
  eq(S.lux, 65, 'gain 加得上');
  eq(BS.bus.gain(-3), 0, '负数加不进来');
  eq(BS.bus.gain(NaN), 0, 'NaN 加不进来');
  eq(BS.bus.spend(0), false, '花 0 不算花');

  /* 大数格式化 */
  eq(U.big(0), '0', '0');
  eq(U.big(999), '999', '999');
  eq(U.big(1000), '1.00K', '1000 → 1.00K');
  eq(U.big(1500), '1.50K', '1500 → 1.50K');
  eq(U.big(1e6), '1.00M', '1e6 → 1.00M');
  eq(U.big(1e9), '1.00B', '1e9 → 1.00B');
  ok(U.big(1e30).indexOf('e') > 0, '极大数走科学记数：' + U.big(1e30));
  eq(U.big(-5), '-5', '负数带符号');
  eq(U.big(Infinity), '∞', '无穷大有个写法');
  ok(U.big(NaN) === '0' || U.big(NaN).length > 0, 'NaN 不炸：' + U.big(NaN));
}

section('平移 / 转向 / 拆除：一件摆上去还能改');
{
  fresh(); give(30);
  S.tree['T0:hand'] = 1; TR.invalidate();
  /* 找一件能装下的，装上去 */
  var e = M.lib()[0], at = spot(e, 0), i;
  ok(!!at && M.place(at[0], at[1], e, 0).ok, '装上了第一件');
  /* 再装一件，好让「挪完还得贴着」这条规矩有东西可贴 */
  var e2 = null, at2 = null;
  for (i = 0; i < 30; i++) {
    var cand = M.lib()[0];
    if (!cand) break;
    var sp2 = spot(cand, 0);
    if (!sp2) break;
    if (M.place(sp2[0], sp2[1], cand, 0).ok) { e2 = cand; at2 = sp2; break; }
  }
  ok(!!e2, '装上了第二件，规矩才有得考验');

  var cells0 = Bd.list(M.body());
  var c0 = cells0[0];
  var nCells = M.stats().n;
  /* 往右挪一格 */
  var mv = M.move(c0.i, c0.j, 1, 0);
  if (mv.ok) {
    eq(M.stats().n, nCells, '平移不增不减格数');
    ok(!Bd.at(M.body(), c0.i, c0.j), '原来那一格空出来了');
    ok(!!Bd.at(M.body(), c0.i + 1, c0.j), '右边那一格占上了');
    eq(S.stat.moved | 0, 1, '平移计了数');
    /* 撤销把这一步退回去 */
    var um = M.undo();
    ok(um.ok, '撤销这次平移');
    ok(!!Bd.at(M.body(), c0.i, c0.j), '它回到了原位');
  } else {
    ok(true, '这一件挪不动，并且说明了原因：' + mv.why);
  }

  /* 原地转：转得过就转，转不过就说话 */
  var cells1 = Bd.list(M.body());
  var c1 = cells1[0];
  var r0 = Bd.at(M.body(), c1.i, c1.j).r | 0;
  var sp = M.spin(c1.i, c1.j, 1);
  if (sp.ok) {
    eq(M.stats().n, nCells, '转向不增不减格数');
    var after = Bd.list(M.body())[0];
    neq(after.r, r0, '转过了（' + r0 + ' → ' + after.r + '）');
    var us = M.undo();
    ok(us.ok, '撤销这次转向');
    eq(Bd.list(M.body())[0].r, r0, '转回去了');
  } else {
    ok(true, '这一件转不动，并且说明了原因：' + sp.why);
  }

  /* 拆一整件 */
  var before = M.stats().n;
  var cells2 = Bd.list(M.body());
  var rm = M.removeAt(cells2[0].i, cells2[0].j);
  ok(rm.ok, '拆成了');
  lt(M.stats().n, before, '格数少了（' + before + ' → ' + M.stats().n + '）');
  eq(S.stat.removed | 0, 1, '拆除计了数');
  var ur = M.undo();
  ok(ur.ok, '撤销这次拆除');
  eq(M.stats().n, before, '装回去了');
  S.tree = {}; TR.invalidate();
}

section('撤销：默认就有五步；拆件不再回库，撤销是它唯一的回头路');
{
  fresh(); give(20);
  eq(M.undoCap(), M.UNDO_BASE, '没点「手」也默认有 ' + M.UNDO_BASE + ' 步（实测 ' + M.undoCap() + '）');
  var e = M.lib()[0], at = spot(e, 0);
  var r = M.place(at[0], at[1], e, 0);
  ok(r.ok, '装上了');
  ok(M.canUndo(), '默认就能撤销，不必先点「手」');
  eq(M.undoDepth(), 1, '这一步进了栈');
  var n0 = M.stats().n;
  var u0 = M.undo();
  ok(u0.ok, '撤成了');
  lt(M.stats().n, n0, '格数回去了（' + n0 + ' → ' + M.stats().n + '）');

  /* 点一级「手」：在基础之上加，不是从 0 起 */
  fresh(); give(20);
  var base = M.undoCap();
  S.tree['T0:hand'] = 1; TR.invalidate();
  gte(M.undoCap(), base + 1, '点亮「手」之后上限往上加（' + base + ' → ' + M.undoCap() + '）');
  lte(M.undoCap(), BS.bus.UNDOCAP, '总数夹在硬上限 ' + BS.bus.UNDOCAP + ' 以内');

  /* 撤销一次「装」：件回库（撤销是时间倒流，那件本来就在库里） */
  fresh(); give(20);
  var e2 = M.lib()[0], at2 = spot(e2, 0);
  var r2 = M.place(at2[0], at2[1], e2, 0);
  ok(r2.ok, '装上了第二件');
  eq(M.undoDepth(), 1, '这一步进了撤销栈');
  var nBefore = M.stats().n;
  var u = M.undo();
  ok(u.ok, '撤销成了');
  lt(M.stats().n, nBefore, '格数回去了（' + nBefore + ' → ' + M.stats().n + '）');
  eq(S.stat.undone, 1, '撤销计了数');
  ok(M.lib().indexOf(e2) >= 0, '撤销「装」：那件回到了库里');
  eq(M.undoDepth(), 0, '栈空了');
  ok(!M.canUndo(), '空了就不能再撤');

  /* 撤销一次「拆」：装回原位，并且把它从 gone 里请出来 */
  fresh(); give(20);
  var e3 = M.lib()[0], at3 = spot(e3, 0);
  M.place(at3[0], at3[1], e3, 0);
  var cell3 = occ(e3, at3[0], at3[1], 0)[0];
  var n3 = M.stats().n;
  var rm3 = M.removeAt(cell3[0], cell3[1]);
  ok(rm3.ok, '拆掉整件');
  ok(rm3.guarded, '刚拆的这一步记在撤销栈里，还救得回来');
  ok((S.gone || {})[e3], '拆下来的那件进了 gone（不回库）');
  eq(M.stats().n, 0, '板上空了');
  var u3 = M.undo();
  ok(u3.ok, '撤销这次拆除');
  eq(M.stats().n, n3, '整件装回来了（' + n3 + ' 格）');
  ok(!(S.gone || {})[e3], '它从 gone 里被请出来了');
  ok(M.lib().indexOf(e3) < 0, '它不在库里了，在板上');

  /* 撤销一次「转」 */
  fresh(); give(20);
  var big = null, i;
  for (i = 0; i < 40; i++) if (P.shapeOf(i).cells.length >= 6) { big = 'n' + i; break; }
  ok(!!big, '找得到一件六格以上的');
  var atb = spot(big, 0);
  M.place(atb[0], atb[1], big, 0);
  var cb = occ(big, atb[0], atb[1], 0)[0];
  var rs = M.spin(cb[0], cb[1], 1);
  if (rs.ok) {
    var depthBefore = M.undoDepth();
    var us = M.undo();
    ok(us.ok, '撤销转向');
    eq(M.undoDepth(), depthBefore - 1, '栈少了一步');
    var anyCell = Bd.list(M.body())[0];
    eq(anyCell.r, 0, '转回去了');
  } else {
    ok(true, '这一件转不动，跳过转向撤销（它说明了原因）');
  }

  /* 栈有上限 */
  fresh(); give(60);
  S.tree['T0:hand'] = 1; S.tree['T1:hand'] = 1; S.tree['T2:hand'] = 1; TR.invalidate();
  var cap = M.undoCap();
  gt(cap, 0, '点了三级「手」，上限是 ' + cap);
  var placed = 0, z;
  for (z = 0; z < 30; z++) {
    var ez = M.lib()[0];
    if (!ez) break;
    var az = spot(ez, 0);
    if (!az) break;
    if (M.place(az[0], az[1], ez, 0).ok) placed++;
  }
  lte(M.undoDepth(), cap, '栈没有超过上限（' + M.undoDepth() + ' ≤ ' + cap + '）');
  lte(M.undoDepth(), Math.min(BS.bus.UNDOCAP, cap), '也没有超过硬上限 ' + BS.bus.UNDOCAP);
  gt(placed, 0, '装了 ' + placed + ' 件');

  /* T6 的边界：拆了之后又把栈装满，那一步被挤出去，就真的没了。
     这是「沉没成本第一次出现」的那一条——它必须是真的不可逆，
     否则「先拆了看看」仍然是最优解，T6 就白改了。 */
  fresh(); give(60);
  var eCap = M.lib()[0], atCap = spot(eCap, 0);
  M.place(atCap[0], atCap[1], eCap, 0);
  var cCap = occ(eCap, atCap[0], atCap[1], 0)[0];
  var rmCap = M.removeAt(cCap[0], cCap[1]);
  ok(rmCap.ok, '拆掉了');
  ok(rmCap.guarded, '刚拆这一步还在栈里');
  var tries = 0, stillThere = true;
  while (tries++ < 300 && stillThere) {
    var ez2 = M.lib()[0];
    if (!ez2) break;
    var az2 = spot(ez2, 0);
    if (!az2) break;
    if (!M.place(az2[0], az2[1], ez2, 0).ok) break;
    stillThere = (S.undo || []).some(function (u2) { return u2.k === 'remove' && u2.e === eCap; });
  }
  ok(!stillThere, '再装满一整栈之后，那一步被挤出去了');
  ok((S.gone || {})[eCap], '它仍然留在 gone 里——这就是不可逆');
  ok(M.lib().indexOf(eCap) < 0, '库里也找不回它');
  S.tree = {}; TR.invalidate();
}

section('装上是承诺（T6）：拆下来的元件不回库');
{
  fresh(); give(20);
  var eT = M.lib()[0], atT = spot(eT, 0);
  M.place(atT[0], atT[1], eT, 0);
  var cT = occ(eT, atT[0], atT[1], 0)[0];

  /* 拆之前的预告：报出来的必须和实际拆掉的是同一件 */
  var pk = M.peekRemove(cT[0], cT[1]);
  ok(!!pk, '拆之前问得出这一件是什么');
  eq(pk.e, eT, '预告的正是这一件');
  eq(pk.nm, M.metaOf(eT).nm, '名字对得上（' + pk.nm + '）');
  gte(pk.cells, 1, '格数报得出来（' + pk.cells + ' 格）');
  eq(pk.rar, M.metaOf(eT).rar, '档位报得出来');
  eq(M.peekRemove(900, 900), null, '空格上问不出东西');

  var rmT = M.removeAt(cT[0], cT[1]);
  ok(rmT.ok, '拆成了');
  ok((S.gone || {})[eT], '它进了 gone：永久离场');
  ok(M.lib().indexOf(eT) < 0, '它不在库里了');
  /* 不比库的总数：动手会改 seq，而 cadence 的节律是 seq 的函数，
     所以 natural() 本来就会漂。要钉的是这一件的去向，不是总数。 */
  ok(!M.placedSet()[eT], '它也不在板上了');
  eq(rmT.cells, pk.cells, '拆掉的格数与预告一致（' + rmT.cells + '）');
  eq(M.stats().n, 0, '板上空了');

  /* 撤销是唯一的回头路 */
  var uT = M.undo();
  ok(uT.ok, '撤销把它救了回来');
  ok(!(S.gone || {})[eT], '从 gone 里出来了');
  ok(M.placedSet()[eT], '它回到了板上');
  eq(M.stats().n, rmT.cells, '格数回来了（' + M.stats().n + '）');

  /* 平移与旋转不花元件——只有拆要。这一条必须仍然成立，
     否则 T6 会顺手把「反复挪动」也一起罚掉。 */
  fresh(); give(20);
  var eM = M.lib()[0], atM = spot(eM, 0);
  M.place(atM[0], atM[1], eM, 0);
  var cM = occ(eM, atM[0], atM[1], 0)[0];
  var mvT = M.move(cM[0], cM[1], 1, 0);
  if (mvT.ok) {
    ok(!(S.gone || {})[eM], '平移不把它送进 gone');
    ok(M.placedSet()[eM], '平移之后它还在板上');
  } else {
    ok(true, '这一件挪不动，跳过（它说明了原因）');
  }
  var spT = M.spin(cM[0], cM[1], 1);
  if (spT.ok) ok(!(S.gone || {})[eM], '旋转也不把它送进 gone');
  else ok(true, '这一件转不动，跳过（它说明了原因）');
}

section('科技树：程序生成，往下没有尽头');
{
  fresh();
  eq(TR.BRANCHES.length, 8, '八条脉络');
  eq(TR.tierOf(0).length, 3, '第 0 层三个节点');
  eq(TR.tierOf(0).join(','), 'T0:lux,T0:tempo,T0:hand', '第 0 层是光、时、手');
  /* 每一层都有节点，且脉络不重复 */
  var i, j, bad = 0, sizes = [];
  for (i = 0; i < 60; i++) {
    var t = TR.tierOf(i);
    sizes.push(t.length);
    gte(t.length, 3, '第 ' + i + ' 层至少三个节点');
    lte(t.length, 4, '第 ' + i + ' 层最多四个节点');
    var seen = {};
    for (j = 0; j < t.length; j++) {
      if (seen[t[j]]) bad++;
      seen[t[j]] = 1;
      var nd = TR.node(t[j]);
      ok(!!nd, '节点 ' + t[j] + ' 解析得出来');
      ok(nd.cost > 0 && isFinite(nd.cost), '节点 ' + t[j] + ' 的价钱是正数');
      /* 名字与效果说明现在是 {t:'模板#', a:[参数]}，落成句子要过 tell()。 */
      var nmT = I.tell(nd.nm), sayT = I.tell(nd.say);
      ok(!!nmT && nmT.length > 0, '节点 ' + t[j] + ' 有名字：' + nmT);
      ok(!!sayT && sayT.length > 0, '节点 ' + t[j] + ' 有效果说明');
      ok(/NaN|undefined/.test(sayT) === false, '节点 ' + t[j] + ' 的说明里没有 NaN/undefined：' + sayT);
      ok(nmT.indexOf('#') < 0 && sayT.indexOf('#') < 0, '节点 ' + t[j] + ' 的占位符都填掉了');
    }
  }
  eq(bad, 0, '六十层里没有重复的节点');
  /* 确定性：同一层两次取一样 */
  eq(TR.tierOf(7).join(','), TR.tierOf(7).join(','), '同一层两次取出来一样');
  /* 可见深度：一开始至少五层，买深了会往外推 */
  gte(TR.depth(), 5, '一开始至少露出五层（实际 ' + TR.depth() + '）');
  var d0 = TR.depth();
  /* 价钱按层涨 */
  var c0 = TR.node('T0:lux').cost, c5 = TR.node('T5:lux') ? TR.node('T5:lux').cost : null;
  gt(c0, 0, '第 0 层的价钱是正数（' + c0 + '）');
  /* 前置：第 1 层要先点第 0 层 */
  var t1 = TR.tierOf(1)[0];
  var nd1 = TR.node(t1);
  gte(nd1.pre.length, 1, '第 1 层的节点有前置');
  ok(!TR.canBuy(t1), '前置没点，买不了');
  ok(TR.blocked(t1).length > 0, '买不了的时候说明了原因：' + TR.blocked(t1));
  /* 第 0 层没有前置，但光不够也买不了 */
  ok(!TR.canBuy('T0:lux'), '光不够，第 0 层也买不了');
  /* 界面默认英文，所以原因句要拿当前语言的词条去比，不能写死中文 */
  /* get() 只查表、不替 '#' 填数，所以比前缀「光不够」，而不是比整句 */
  ok(TR.blocked('T0:lux').indexOf(I.get('光不够')) >= 0, '说的是光不够：' + TR.blocked('T0:lux'));
  /* 给够光就能买 */
  S.lux = 1e9;
  ok(TR.canBuy('T0:lux'), '光够了就能买');
  var luxB = S.lux;
  var buy = TR.buy('T0:lux');
  ok(buy.ok, '买成了');
  lt(S.lux, luxB, '光扣掉了');
  ok(TR.bought('T0:lux'), '记进存档了');
  ok(!TR.buy('T0:lux').ok, '同一个节点不能买两次');
  eq(TR.mods().nodes, 1, '点亮了一个');
  gt(TR.mods().luxMult, 1, '「光」脉络真的抬高了产光倍率（×' + TR.mods().luxMult.toFixed(3) + '）');
  /* 买了之后，把某个第 1 层节点的真实前置买掉，它就买得了 */
  S.lux = 1e9;
  var pre1 = nd1.pre[0];
  ok(TR.canBuy(pre1), '前置节点本身买得了');
  ok(TR.buy(pre1).ok, '把前置买掉');
  ok(TR.canBuy(t1), '前置点了，第 1 层能买了');
  ok(TR.buy(t1).ok, '第 1 层买成了');
  /* 深度要买过第 2 层才会往外推（可见深度 = 最深购买层 + 4，地板是 5） */
  var t2 = TR.tierOf(2)[0], nd2 = TR.node(t2);
  var z2;
  for (z2 = 0; z2 < nd2.pre.length; z2++) if (!TR.bought(nd2.pre[z2])) { S.lux = 1e9; TR.buy(nd2.pre[z2]); }
  S.lux = 1e9;
  if (TR.canBuy(t2)) TR.buy(t2);
  gte(TR.maxBoughtTier(), 2, '已经买到第 2 层');
  gt(TR.depth(), d0, '买深了之后可见深度往外推（' + d0 + ' → ' + TR.depth() + '）');
  /* 挖到很深的层，节点仍然生成得出来 */
  var deep = TR.node('T40:lux');
  ok(!!deep, '第 40 层的节点也生成得出来');
  gt(deep.cost, c0, '越深越贵（' + c0 + ' → ' + U.big(deep.cost) + '）');
  /* 每条脉络的效果都写得出来 */
  for (i = 0; i < TR.BRANCHES.length; i++) {
    var bid = TR.BRANCHES[i].id;
    var nd = TR.node('T0:' + bid) || TR.node('T1:' + bid) || TR.node('T2:' + bid);
    if (nd) {
      var sayT = I.tell(nd.say);
      ok(!!sayT && !/undefined|NaN/.test(sayT), bid + ' 脉络的效果说明干净：' + sayT);
      ok(Object.keys(nd.eff).length > 0, bid + ' 脉络有效果字段');
    }
  }
  /* mods 的上限夹得住 */
  for (i = 0; i < 40; i++) S.tree['T' + i + ':tempo'] = 1;
  TR.invalidate();
  lte(TR.mods().haste, 0.85, 'haste 被夹在 0.85 以内（' + TR.mods().haste.toFixed(3) + '）');
  for (i = 0; i < 40; i++) S.tree['T' + i + ':hand'] = 1;
  TR.invalidate();
  lte(TR.mods().undo, BS.bus.UNDOCAP, '撤销步数被夹在硬上限内（' + TR.mods().undo + '）');
  gt(TR.spent(), 0, '累计花掉的光算得出来');
  gte(TR.maxBoughtTier(), 0, '最深购买层算得出来');
}

section('任务：三条挂着，目标不看格数');
{
  fresh(); give(30);
  var list = Q.list();
  eq(list.length, Q.SLOTS, '同时挂着 ' + Q.SLOTS + ' 条');
  /* 每条都说得清楚，且判据不是「格数达到多少」 */
  var sizeQuests = 0;
  list.forEach(function (d) {
    /* say / hint 现在是 {t:'模板#', a:[参数]}：中文源串 + 参数，渲染时才落语言。
       所以断言要先过 tell() 落成一句话——中文下渲染，因为源串就是中文。 */
    var say = I.tell(d.say);
    ok(!!say && say.length > 4, '任务说清了要干什么：' + say);
    ok(d.pay > 0, '任务有分量（' + d.pay + '）');
    ok(!!d.kt, '任务有类别：' + d.kt);
    ok(/undefined|NaN/.test(say) === false, '任务说明里没有 NaN/undefined');
    ok(say.indexOf('#') < 0, '任务说明里的占位符都填掉了');
    /* 目标不该是单纯的格数 */
    if (/格数达到|格数不低于/.test(say)) sizeQuests++;
  });
  eq(sizeQuests, 0, '没有一条任务的目标是「格数达到多少」');
  /* 确定性：同一序号两次生成一样。比的是「说法」落成的句子，不是对象引用。 */
  eq(I.tell(Q.def(5).say), I.tell(Q.def(5).say), '第 5 号任务两次生成一样');
  eq(Q.def(5).spec.kind, Q.def(5).spec.kind, '种类也一样');
  /* 难度随序号爬 */
  gt(Q.def(30).lv, Q.def(0).lv, '第 30 号比第 0 号难');
  /* 种类覆盖面：跑六百条，十三种都得轮得到——
     新加的种类要是永远抽不中，写了也白写。 */
  var kinds = {}, i;
  for (i = 0; i < 600; i++) kinds[Q.def(i).kind] = 1;
  eq(Object.keys(kinds).length, Q.KINDS.length,
    '六百条任务里 ' + Q.KINDS.length + ' 种全部出现过（实际 ' + Object.keys(kinds).length + ' 种）');
  Q.KINDS.forEach(function (kd) {
    ok(!!kinds[kd.id], '「' + kd.t + '」（' + kd.id + '）抽得到');
  });
  /* 每一条都说得清楚，且没有 NaN/undefined——重点盯新加的那六种 */
  var badSay = 0;
  for (i = 0; i < 600; i++) {
    var ds = Q.def(i), dsSay = I.tell(ds.say);
    if (/undefined|NaN/.test(dsSay) || !dsSay || dsSay.length < 6 || dsSay.indexOf('#') >= 0) badSay++;
  }
  eq(badSay, 0, '六百条任务说明里没有一句是糊涂话');
  /* 进度算得出来，且不越界 */
  var prog = Q.progress(M);
  eq(prog.length, Q.SLOTS, '进度也是三条');
  prog.forEach(function (p) {
    gte(p.p, 0, '进度不低于 0');
    lte(p.p, 1, '进度不超过 1');
    ok(isFinite(p.p), '进度是有限数');
    var hT = I.tell(p.hint);
    ok(typeof hT === 'string' && hT.length > 0, '有提示文字');
    ok(/undefined|NaN/.test(hT) === false, '提示里没有 NaN/undefined：' + hT);
    ok(hT.indexOf('#') < 0, '提示里的占位符都填掉了');
  });
  /* 没达成不能领 */
  var notDone = prog.filter(function (p) { return !p.done; })[0];
  if (notDone) {
    var bad = Q.claim(notDone.def.id, M);
    ok(!bad.ok, '没达成领不了');
    ok(bad.why.length > 0, '领不了的时候说明了原因');
  }
  /* 造一个能满足的条件：把图形做到有洞，然后扫出一条当前真达成的任务来领奖。
     不赌某个特定序号的任务是什么——那太脆；直接问判据函数。 */
  fresh(); give(10);
  write(RING8, 'n0', 0, 0, 0);
  var ctxQ = Q.ctx(M);
  var holesQ = null;
  for (i = 0; i < 4000 && !holesQ; i++) {
    var dq = Q.def(i), pv = 0;
    try { pv = dq.liveF(dq.spec, ctxQ); } catch (e) { pv = 0; }
    if (pv >= 1) holesQ = dq;
  }
  ok(!!holesQ, '找得到一条当前图形已经满足的任务');
  if (holesQ) {
    /* 把它塞进当前任务槽。
       注意 progress() 里的 ensure() 会把槽补满三条——那是设计：三条任务
       同时挂着是这游戏的承诺，不是一条领完之前就空出一个坑。所以这里
       断言的是「这一条在里面，而且它显示为已达成」，不是「只有一条」。 */
    S.quest.act = [{ id: holesQ.id, qi: holesQ.qi }];
    S.quest.next = holesQ.qi + 1;
    var pg2 = Q.progress(M);
    eq(pg2.length, Q.SLOTS, '槽被补满成 ' + Q.SLOTS + ' 条（补出来的那两条是新序号）');
    eq(pg2[0].def.id, holesQ.id, '第一条正是刚塞进去的那条');
    ok(pg2[0].done, '它显示为已达成（进度 ' + pg2[0].p.toFixed(2) + '）');
    ok(pg2.slice(1).every(function (p) { return p.def.id !== holesQ.id; }),
      '补出来的两条不是同一条');
    var repQ = Q.rep();
    var cl = Q.claim(holesQ.id, M);
    ok(cl.ok, '领奖成了');
    /* 领奖改成真给光：从前界面上写着「可领 # 光」，领完口袋里一个数都没动。
       写给用户看的数字必须等于到账的数。 */
    gt(S.lux, 0, '任务领奖真给光（' + U.big(S.lux) + '）');
    eq(S.lux, holesQ.pay, '给的数就是这条任务标着的数（' + holesQ.pay + '）');
    gte(Q.rep(), repQ, '声誉没倒退（' + repQ.toFixed(3) + ' → ' + Q.rep().toFixed(3) + '）');
    eq(Q.st().done, 1, '完成计数加一');
    eq(S.stat.quests, 1, '统计也加一');
    eq(Q.list().length, Q.SLOTS, '领完自动补回三条');
    /* 领过的不能重复领 */
    ok(!Q.claim(holesQ.id, M).ok, '同一条不能领两次');
  }
  /* 换一条要花光，且光不够就换不了 */
  fresh(); give(20);
  S.lux = 0;
  var rid = Q.list()[0].id;
  ok(!Q.reroll(rid, M).ok, '没有光换不了');
  S.lux = 1e6;
  var rr = Q.reroll(rid, M);
  ok(rr.ok, '有光就换得了');
  eq(Q.list()[0].id === rid, false, '换掉之后不是原来那条');
  /* 声誉：每 REP_EVERY 条给一次，封顶 */
  fresh();
  eq(Q.rep(), 0, '开局声誉是 0');
  var qs = Q.st();
  qs.done = Q.REP_EVERY - 1;
  lte(Q.rep(), Q.REP_CAP, '声誉不超过上限');
  gt(Q.REP_CAP, 0, '声誉为正');
  /* peek */
  var pk = Q.peek(3);
  eq(pk.length, 3, '预知三条');
  ok(I.tell(pk[0].say).length > 0, '预知的任务也说得出内容');
}

/* 条数从 A.LIST 取，不写死——成就页与手册也按同一条口径来。 */
section('成就：' + BS.achieve.LIST.length + ' 条，一次性解锁');
{
  fresh();
  var L = A.LIST;
  gt(L.length, 50, '成就条数够多（' + L.length + ' 条）');
  /* 每条都有名字、条件、分类、奖励，且名字不重样 */
  var ids = {}, names = {}, dupId = 0, dupName = 0, bad = 0;
  L.forEach(function (a) {
    if (ids[a.id]) dupId++;
    ids[a.id] = 1;
    if (names[a.t]) dupName++;
    names[a.t] = 1;
    if (!a.t || a.t.length < 2) bad++;
    if (!a.d || a.d.length < 4) bad++;
    if (!a.cat) bad++;
    if (!(a.pay > 0)) bad++;
    if (typeof a.ok !== 'function') bad++;
    if (/undefined|NaN/.test(a.d)) bad++;
  });
  eq(dupId, 0, 'id 不重复');
  eq(dupName, 0, '名字不重样（' + Object.keys(names).length + ' 个）');
  eq(bad, 0, '每条都有名字、条件、分类、奖励和判据函数');
  /* 分类 */
  var gs = A.groups();
  gt(gs.length, 4, '分了 ' + gs.length + ' 类：' + gs.join('、'));
  gs.forEach(function (g) { gt(A.inGroup(g).length, 0, '「' + g + '」类里有东西'); });
  /* 空图一条都不解锁 */
  eq(A.count(), 0, '开局没有解锁任何成就');
  var got0 = A.scan(M);
  eq(got0.length, 0, '空图扫不出成就');
  /* 装一件，第一条就该解锁 */
  fresh(); give(20);
  var e = M.lib()[0], at = spot(e, 0);
  M.place(at[0], at[1], e, 0);
  var got = A.scan(M);
  gt(got.length, 0, '装上第一件之后解锁了 ' + got.length + ' 条');
  ok(got.some(function (a) { return a.id === 'firstLight'; }), '「第一缕光」解锁了');
  eq(S.lux, 0, '成就解锁不给光——光只在呈交那一刻给');
  gt(A.count(), 0, '成就记进存档了');
  eq(A.count(), got.length, '解锁数记上了');
  /* 一次性：拆掉之后不会灭，也不会重复给钱 */
  var cnt1 = A.count(), lux1 = S.lux;
  var cell = Bd.list(M.body())[0];
  M.removeAt(cell.i, cell.j);
  eq(M.stats().n, 0, '板空了');
  var got2 = A.scan(M);
  eq(got2.length, 0, '板空了也不会重复解锁（一次性的）');
  eq(A.count(), cnt1, '已解锁的没有灭掉（' + cnt1 + ' 条仍在）');
  ok(A.unlocked('firstLight'), '「第一缕光」仍然算已解锁');
  /* 三三格该解锁「一个正方形」以外的结构类条目。
     三三格是个完美的对称小块（整体对称 1.00、群阶 8、填充 1.00），
     早期那几条对称成就却都写着「格数不少于六十/八十」——于是它一条都命中不了。
     这里钉住小号版本那三条，免得以后又被调回遥不可及。 */
  fresh();
  write(BLOCK3, 'n0', 0, 0, 0);
  var marks3 = A.marks(M);
  ok(marks3.length > 0, '三三格满足了 ' + marks3.length + ' 条');
  ['neatSquare', 'mirrorSmall', 'stillSolid'].forEach(function (id) {
    ok(marks3.indexOf(id) >= 0, '三三格命中「' + id + '」（' + (A.BYID[id] ? A.BYID[id].t : '?') + '）');
  });
  ok(marks3.indexOf('perfectSquare') < 0, '但「一个正方形」要边长 8，三三格够不着');
  var scan3 = A.scan(M);
  gt(scan3.length, 0, '三三格解锁了 ' + scan3.length + ' 条');
  eq(S.lux, 0, '成就不直接给光——它换的是声誉，声誉抬成交价');
  gt(A.count(), 0, '解锁数记上了（' + A.count() + ' 条）');
  /* 判据函数不许抛异常：拿几个极端图形都扫一遍 */
  var shapes = [BLOCK3, RING8, [[0, 0]], [[0, 0], [5, 5], [9, 2]]];
  var threw = 0;
  shapes.forEach(function (cs) {
    fresh();
    write(cs, 'n0', 0, 0, 0);
    var ctx = A.buildCtx(M);
    L.forEach(function (a) {
      try { a.ok(ctx); } catch (e) { threw++; }
    });
  });
  eq(threw, 0, '极端图形下没有判据抛异常');
  /* 难度：绝大多数条目在普通玩法下达不成 */
  fresh(); give(40);
  var z;
  for (z = 0; z < 12; z++) {
    var ez = M.lib()[0];
    if (!ez) break;
    var az = spot(ez, 0);
    if (!az) break;
    M.place(az[0], az[1], ez, 0);
  }
  A.scan(M);
  lt(A.count(), L.length * 0.25, '随手装十几件，解锁的不到四分之一（实际 ' + A.count() + '/' + L.length + '）');
  /* 系数表 */
  gt(A.COEF.length, 50, '系数表有 ' + A.COEF.length + ' 项');
  var st = M.stats();
  var miss = [];
  A.COEF.forEach(function (c) {
    var v = A.val(st, c.k);
    if (typeof v !== 'number' || !isFinite(v)) miss.push(c.k);
  });
  eq(miss.length, 0, '系数表每一项都量得出来（缺 ' + miss.join(',') + '）');
  ok(A.coefGroups().indexOf('质变') === 0, '「质变」组排在最前');
}

section('合成（打包）必须真的不在');
{
  eq(typeof M.pack, 'undefined', 'rig 上没有 pack');
  eq(typeof M.canPack, 'undefined', 'rig 上没有 canPack');
  eq(typeof M.packs, 'undefined', 'rig 上没有 packs');
  eq(typeof P.pack, 'undefined', 'parts 上没有 pack');
  eq(typeof P.DIRS, 'undefined', 'parts 上没有 DIRS');
  eq(S.made, undefined, '存档里没有合成件表');
  eq(typeof S.stat.packed, 'undefined', '统计里没有「合成」这一项');
  eq(BS.reg.get('pack'), null, '没有打包界面');
  /* 旧的打包文件真的不在磁盘上 */
  ok(!fs.existsSync(path.join(ROOT, 'world', 'mods', 'pack.js')), 'world/mods/pack.js 已移除');
  /* 宣言页随合成机制一起删过；现在它归位了，但按现行规则改写——
     旧路径不在，新路径在，写旧机制的那三句永远不许回来（下文守着）。 */
  ok(!fs.existsSync(path.join(ROOT, 'world', 'manifesto.js')), 'world/manifesto.js 旧路径不在');
  ok(fs.existsSync(path.join(ROOT, 'world', 'mods', 'manifesto.js')), '宣言页归位：world/mods/manifesto.js');
  ok(html.indexOf('pack.js') < 0, 'index.html 里没有打包的 script');
  ok(html.indexOf('world/mods/manifesto.js') >= 0, 'index.html 里宣言页接了线');
  /* 界面里不再有「去打包」这种跳转 */
  var src = fs.readFileSync(path.join(ROOT, 'world', 'mods', 'assembly.js'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'world', 'mods', 'library.js'), 'utf8');
  ok(src.indexOf('go:pack') < 0, '各界面里没有「去打包」的跳转');
  /* 那段被点名要删的文案，全库都不该再出现 */
  var all = '';
  ['core', 'world'].forEach(function (d) {
    fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(function (f) {
      if (f.isFile() && f.name.endsWith('.js')) all += fs.readFileSync(path.join(ROOT, d, f.name), 'utf8');
      if (f.isDirectory()) {
        fs.readdirSync(path.join(ROOT, d, f.name)).forEach(function (g) {
          if (g.endsWith('.js')) all += fs.readFileSync(path.join(ROOT, d, f.name, g), 'utf8');
        });
      }
    });
  });
  ok(all.indexOf('没有目标，没有奖励，没有自动，也没有撤销') < 0, '被点名要删的那句文案已经不在了');
  ok(all.indexOf('上游落下什么，不由你定') < 0, '与之相连的那半句也不在了');
  /* 宣言页回来了，但随合成机制删掉的那三句永远不回来：
     两件并成一件、拆下来的东西回库、「合」的那一下。 */
  ok(all.indexOf('把两件散料并成一件构件') < 0, '宣言里不写「两件并成一件」（合成已移除）');
  ok(all.indexOf('拆下来的东西回到库里') < 0, '宣言里不写「拆件回库」（现行规则：永久离场）');
  ok(all.indexOf('都握有「合」的那一下') < 0, '宣言里不写「合」的那一下（同上）');
  /* 这四样能力真的存在 */
  ok(typeof M.undo === 'function', '撤销：有');
  ok(typeof SM.autoPlace === 'function', '自动：有');
  ok(typeof BS.bus.gain === 'function', '奖励：有');
  ok(typeof Q.list === 'function', '目标（任务）：有');
}

section('库与节律');
{
  fresh();
  eq(M.natural(), M.START, '一开局先有 ' + M.START + ' 件');
  /* 计时只在你开着页面的时候走：把时钟往前拨，库就跟着长；
     不拨（关掉页面就等于不拨），库一件也不多。 */
  M.tickClock(10 * M.PERIOD * 1.6);
  gt(M.natural(), M.START, '页面开着十个周期，库里不止开局那几件');
  M.tickClock(100 * M.PERIOD * 1.6);
  gt(M.natural(), 20, '开着的时间越久库越大：' + M.natural());
  var held = M.natural();
  M.tickClock(0);
  eq(M.natural(), held, '不拨时钟，库一件也不多（关掉页面就是这么回事）');
  var ni = M.nextIn();
  ok(ni >= 0, '倒计时非负（' + ni.toFixed(2) + '）');
  eq(M.lib().length, M.natural(), '没装东西的时候库里就是全部自然件');
  /* 三道筛选：一开始就在，而且一枚都不许是 disabled——
     曾经把悬停说明错塞进 btn 的「禁用」槽位，型与特质两排 chip 全点不动，
     看着就像锁着没解锁。这里把整排 chip 摸一遍：不许有一枚灰的，点了要真亮。 */
  go('library');
  var chipEls = panel().querySelectorAll('.btn.chip');
  gt(chipEls.length, P.FORMS.length + P.TRAITS.length,
    '筛选 chip 摆在页面上（型 + 特质一共 ' + chipEls.length + ' 枚）');
  eq(panel().querySelectorAll('.btn.chip[disabled]').length, 0, '没有一枚筛选 chip 是禁用的');
  var fmBtn = panel().querySelector('[data-act^="fm:"]:not([data-act="fm:"])');
  ok(!!fmBtn, '型筛选里挑得出一枚具体的 chip');
  if (fmBtn) {
    fmBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    ok(String(panel().querySelector('[data-act="' + fmBtn.getAttribute('data-act') + '"]').className).indexOf('on') >= 0,
      '点下去它真的亮了（' + fmBtn.getAttribute('data-act') + '）');
  }
  var trBtn = panel().querySelector('[data-act^="tr:"]:not([data-act="tr:"])');
  ok(!!trBtn, '特质筛选里也挑得出一枚具体的 chip');
  if (trBtn) {
    trBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    ok(String(panel().querySelector('[data-act="' + trBtn.getAttribute('data-act') + '"]').className).indexOf('on') >= 0,
      '特质的 chip 同样点得动（' + trBtn.getAttribute('data-act') + '）');
  }
  /* 用完把两道筛选拨回「全部」，别让后面的用例踩在筛过的库上 */
  panel().querySelector('[data-act="fm:"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  panel().querySelector('[data-act="tr:"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  go('assembly');
  /* haste 让间隔变短 */
  fresh();
  var p0 = M.curPeriod();
  S.tree['T0:tempo'] = 1; S.tree['T1:tempo'] = 1; S.tree['T2:tempo'] = 1; TR.invalidate();
  var p1 = M.curPeriod();
  lt(p1, p0, '点亮「时」之后落件更快（' + p0.toFixed(1) + 's → ' + p1.toFixed(1) + 's）');
  gte(p1, 3, '但不会快到离谱（下限 3s）');
  S.tree = {}; TR.invalidate();
  /* cadence 仍然确定性、零均值 */
  var c = BS.cadence;
  eq(c.interval(123, 5, 15), c.interval(123, 5, 15), '间隔是确定的');
  var s2 = 0, mx2 = 0, i;
  for (i = 0; i < 2000; i++) { var r = c.rarityShift(i); s2 += r; if (Math.abs(r) > mx2) mx2 = Math.abs(r); }
  ok(Math.abs(s2 / 2000) < 0.01, '稀有度扰动零均值（' + (s2 / 2000).toFixed(4) + '）');
  ok(mx2 < 0.12, '稀有度扰动有界（±' + mx2.toFixed(3) + '）');
  /* 两条规则 */
  fresh(); give(20);
  var e = M.lib()[0], cs = M.cellsOf(e), sz = P.size(cs);
  ok(M.place(30, -12, e, 0).ok, '第一件放得再远也成');
  ok(!M.place(30, -12, e, 0).ok, '同一件不能装两次');
  eq(M.stats().n, cs.length, '格数就是这一件的格数');
  ok(!M.place(30 + sz.w + 5, -12 + sz.h + 5, 'n1', 0).ok, '离得远的放不下');
  ok(M.canAt(30 + sz.w, -12, 'n1', 0) || M.canAt(30, -12 + sz.h, 'n1', 0), '贴着的位置算得出来');
  /* 落点是外接框左下角，而那一格不一定被占。
     两种都得钉住：占了就拆得动，没占就拆不动，而且理由要说清楚。
     哪一件的角是空的不写死——形状是算出来的，写死序号迟早会错。 */
  var busy = null, free = null, bi2;
  for (bi2 = 0; bi2 < 60 && (!busy || !free); bi2++) {
    var csB = P.shapeOf(bi2).cells;
    var hasCorner = csB.some(function (c) { return c[0] === 0 && c[1] === 0; });
    if (hasCorner && !busy) busy = 'n' + bi2;
    if (!hasCorner && !free) free = 'n' + bi2;
  }
  ok(!!busy, '找得到一件外接框左下角被占的（' + busy + '）');
  ok(!!free, '找得到一件外接框左下角是空的（' + free + '）');
  fresh(); give(20);
  ok(M.place(30, -12, busy, 0).ok, '重新装上 ' + busy);
  ok(M.removeAt(30, -12).ok, '角上被占，拆得动');
  eq(M.stats().n, 0, '一格之拆，整件都下来了');
  /* 反过来：角是空的那一件，落点那一格必须拆不动，
     而且拆不动的时候板上一点不能少。 */
  fresh(); give(20);
  var e2 = free, cs2 = M.cellsOf(e2);
  ok(!cs2.some(function (c) { return c[0] === 0 && c[1] === 0; }), e2 + ' 的外接框左下角本来是空的');
  ok(M.place(40, -8, e2, 0).ok, '装上了 ' + e2);
  eq(M.stats().n, cs2.length, '格数对上了');
  ok(!Bd.at(M.body(), 40, -8), '落点那一格确实是空的');
  var bad = M.removeAt(40, -8);
  ok(!bad.ok, '落点那一格空的，拆不动');
  eq(bad.why, I.get('这一格是空的'), '而且说明了原因');
  eq(M.stats().n, cs2.length, '拆不动的时候板上一点没少');
  var real = Bd.list(M.body())[0];
  ok(M.removeAt(real.i, real.j).ok, '拆它真正占着的那一格');
  eq(M.stats().n, 0, '整件都被拆掉了');
  ok(M.lib().indexOf(e2) < 0, '拆下来的那件不回库（T6）');
  ok((S.gone || {})[e2], '它进的是 gone，永久离场');
  /* page 的筛选 */
  fresh(); give(60);
  var pg = M.page(0, 10, 0);
  ok(pg.rows.every(function (r) { return r.rar === 0; }), '按稀有度筛得动');
  var formId = P.FORMS[3].id;
  var pg2 = M.page(0, 200, -1, '', formId);
  gt(pg2.rows.length, 0, '按型筛得动，而且筛得出东西（' + pg2.rows.length + ' 件）');
  ok(pg2.rows.every(function (r) { return r.form === formId; }), '按型筛出来的每一件都是这一型');
  /* 特质筛选：不用解锁任何科技，一进库就该能用 */
  var tid = P.TRAITS[0].id;
  var pg3 = M.page(0, 400, -1, tid, '');
  gt(pg3.rows.length, 0, '按特质筛得动，而且筛得出东西（' + pg3.rows.length + ' 件）');
  ok(pg3.rows.every(function (r) { return (r.traits || []).indexOf(tid) >= 0; }), '按特质筛出来的每一件都带这一条');
  eq(M.countBy(null, tid, ''), pg3.total, 'countBy 与 page 的总数是一个数');
  /* 十一种特质，每一种都筛得出东西——从前这条要挖到「识」第三条才给用 */
  var noTraitHits = 0, ti;
  for (ti = 0; ti < P.TRAITS.length; ti++) {
    if (M.countBy(null, P.TRAITS[ti].id, '') === 0) noTraitHits++;
  }
  eq(noTraitHits, 0, '十一种特质每一种都筛得出件来');
  /* 分页走的是筛选之后的数：翻页不该跳过一屏符合的件 */
  var allT = M.pick(null, tid, '');
  var pageA = M.page(0, 5, null, tid, ''), pageB = M.page(5, 5, null, tid, '');
  eq(pageA.total, allT.length, '分页的总数是筛选之后的数');
  ok(pageA.rows.length + pageB.rows.length <= allT.length, '两页加起来不超过总数');
  if (allT.length > 5) {
    eq(pageA.rows[0].e, allT[0].e, '第一页从头开始');
    eq(pageB.rows[0].e, allT[5].e, '第二页接着第一页，中间不跳');
  }
  ok(pg.rows[0] && typeof pg.rows[0].traits !== 'undefined', '库页把特质也带出来了');
}

section('自动装配：解锁了才动');
{
  fresh(); give(30);
  eq(BS.tree.mods().autoRate, 0, '没点「机」的时候自动装配没解锁');
  /* 手动跑一次 autoPlace 看看它自己会不会乱动 */
  var n0 = M.stats().n;
  var auto1 = SM.autoPlace(M);
  ok(auto1.ok || !auto1.ok, 'autoPlace 不抛异常');
  /* 点了「机」之后能装 */
  S.tree['T0:auto'] = 1; TR.invalidate();
  gt(BS.tree.mods().autoRate, 0, '点亮「机」之后自动装配解锁了');
  var before = M.stats().n;
  var r = SM.autoPlace(M);
  ok(r.ok, '自动装配装上了一件（' + (r.nm || '') + '）');
  gt(M.stats().n, before, '格数真的涨了');
  /* 连续跑二十次不炸，且图形是连着的 */
  var i, failN = 0;
  for (i = 0; i < 20; i++) {
    var rr = SM.autoPlace(M);
    if (!rr.ok) failN++;
  }
  lt(failN, 20, '连续自动装配没有全军覆没（失败 ' + failN + ' 次）');
  var st = M.stats();
  gt(st.n, 0, '装出了 ' + st.n + ' 格');
  lte(st.comp, 3, '自动装配把图形堆得比较紧凑（连通块 ' + st.comp + ' 个）');
  /* 自动装配只负责往上贴，它不进账——光只在呈交那一刻给 */
  fresh(); give(20);
  var eA = M.lib()[0], atA = spot(eA, 0);
  var manual = M.place(atA[0], atA[1], eA, 0);
  fresh(); give(20);
  var eB = eA, atB = spot(eB, 0);
  var auto = M.place(atB[0], atB[1], eB, 0, { auto: true });
  ok(auto.ok && manual.ok, '手动与自动都装成了');
  eq(S.lux, 0, '自动装也不进账');
  eq(SM.AUTO_DISCOUNT, undefined, '自动装配的产光折扣已经不在了');
  /* 空库的时候不炸 */
  fresh();
  S.t0 = Date.now();
  S.gone = {};
  var emptyLib = SM.autoPlace(M);
  ok(typeof emptyLib.ok === 'boolean', '库里没东西时也老实返回');
  S.tree = {}; TR.invalidate();
}

section('混沌必须真的不在');
{
  eq(typeof BS.chaos, 'undefined', 'BS 上没有 chaos');
  ok(!fs.existsSync(path.join(ROOT, 'core', 'chaos.js')), 'core/chaos.js 已移除');
  ok(!fs.existsSync(path.join(ROOT, 'world', 'mods', 'chaos.js')), 'world/mods/chaos.js 已移除');
  ok(html.indexOf('chaos.js') < 0, 'index.html 里没有混沌的 script');
  eq(BS.reg.get('chaos'), null, '没有混沌界面');
  /* 存档里不再带着混沌那一块 */
  fresh();
  eq(S.chaos, undefined, '存档里没有 chaos 这个键');
  var nb = BS.bus.blank();
  ok(!('chaos' in nb), 'blank() 也不再造 chaos 这个键');
  /* 放置规则里不再有混沌那一道闸 */
  var b0 = Bd.mk();
  Bd.place(b0, 0, 0, 'n0', 0, [[0, 0]], 1);
  ok(Bd.canPlace(b0, [[3, 0]], 3, 0) === false, '离得远的还是放不下（规矩没松）');
  ok(Bd.canPlace(b0, [[0, 0]], 1, 0) === true, '贴着的还是放得下');
  /* 合成分不再被混沌改过 */
  var st0 = M.stats();
  ok(isFinite(st0.esScore), '质变度是有限数');
  /* 手册与指南也必须不在 */
  ok(!fs.existsSync(path.join(ROOT, '手册.md')), '手册.md 已移除');
  ok(!fs.existsSync(path.join(ROOT, 'world', 'guide.js')), 'world/guide.js 已移除');
  eq(BS.reg.get('guide'), null, '没有「怎么玩」那一页');
}

section('每一页都搭得起来');
{
  eq(BS.reg.all().length, 14, '十四个界面');
  var ids = BS.reg.all().map(function (m) { return m.id; });
  eq(new Set(ids).size, ids.length, 'id 不撞');
  for (const need of ['assembly', 'library', 'auction', 'quests', 'tree', 'measure', 'atlas',
    'traits', 'families', 'achieve', 'record', 'settings', 'dual', 'manifesto']) {
    ok(ids.indexOf(need) >= 0, '有 ' + need);
  }
  eq(BS.reg.get('pack'), null, '没有 pack');
  ok(BS.reg.get('manifesto'), '宣言页在册（收尾页，文案按现行规则改写）');
  eq(doc.querySelectorAll('#rail .nb').length, ids.length, '侧栏按钮数对得上');
  /* 侧栏序号是 0..13 连续的。按数值排，不按字符串排——字符串排会把 10 排到 2 前面。 */
  var nums = BS.reg.all().map(function (m) { return +m.n; }).sort(function (a, b) { return a - b; });
  eq(nums.join(','), '0,1,2,3,4,5,6,7,8,9,10,11,12,13', '侧栏序号连续（' + nums.join(',') + '）');
  fresh(); give(30);
  /* 装几件，让每一页都有东西可显示 */
  var z;
  for (z = 0; z < 6; z++) {
    var ez = M.lib()[0];
    if (!ez) break;
    var az = spot(ez, 0);
    if (!az) break;
    M.place(az[0], az[1], ez, 0);
  }
  S.lux = 1e6;
  TR.buy('T0:lux'); TR.buy('T0:tempo'); TR.buy('T0:hand');
  A.scan(M);
  for (const m of BS.reg.all()) {
    go(m.id);
    const h = panel().innerHTML;
    ok(h.length > 120, m.id + ' 搭出了东西（' + h.length + ' 字节）');
    ok(h.indexOf('undefined') < 0, m.id + ' 里没有 undefined');
    ok(h.indexOf('NaN') < 0, m.id + ' 里没有 NaN');
    ok(h.indexOf('[object Object]') < 0, m.id + ' 里没有没转成字符串的对象');
    /* 角标也算一遍 */
    if (m.badge) {
      var bg = m.badge();
      ok(bg === '' || bg == null || /undefined|NaN/.test(String(bg)) === false,
        m.id + ' 的角标干净：' + bg);
    }
  }
  /* 空图的时候每一页也不能散 */
  fresh();
  for (const m of BS.reg.all()) {
    go(m.id);
    const h = panel().innerHTML;
    ok(h.indexOf('undefined') < 0, '空图下 ' + m.id + ' 里没有 undefined');
    ok(h.indexOf('NaN') < 0, '空图下 ' + m.id + ' 里没有 NaN');
  }
  go('assembly');
}

section('点击真的会动');
{
  go('assembly');
  const btns = doc.querySelectorAll('#rail .nb');
  const target = btns[3];
  const id = target.getAttribute('data-act');
  target.querySelector('.nt').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(BS.app.cur(), id, '点击侧栏第 4 项跳到了 ' + id);
  ok(panel().innerHTML.length > 120, '对应页面搭出来了');

  /* 库页：拿一件在手上 */
  fresh(); give(20);
  go('library');
  const take = q('[data-act^="take:"]');
  ok(!!take, '库页里拿得到一件');
  const wanted = take.getAttribute('data-act').slice(5);
  take.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(M.sel.e, wanted, '手上拿着的是 ' + wanted);

  /* 库页：回收 */
  const rec = panel().querySelectorAll('[data-act^="rec:"]');
  ok(rec.length > 1, '库页里能回收');
  const recTarget = rec[rec.length - 1].getAttribute('data-act').slice(4);
  const libBefore = M.libCount();
  rec[rec.length - 1].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(M.libCount(), libBefore - 1, '回收之后库里少了一件');
  ok((S.gone || {})[recTarget], '回收的那件记进 gone');

  /* 组装台：点一格只查看，放置是空格的事。
     这两种手势从前是同一个动作，鼠标一抖就出岔子；测试要把它们钉开。 */
  go('assembly');
  const hit = panel().querySelector('[data-act="c:0:0"]');
  ok(!!hit, '图纸上有可点的格');
  const nBefore = M.stats().n;
  hit.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(M.stats().n, nBefore, '点一下图纸不会装上任何东西');
  eq(M.sel.e, wanted, '点一下也不会把手上的件丢掉');
  ok(panel().innerHTML.indexOf(I.get('选中的格')) > 0, '点过之后右边摊开的是「选中的格」');

  /* 空格：先把光标压到某一格上，再按键 */
  const luxBefore = S.lux;
  hit.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  eq(M.stats().n, M.cellsOf(wanted).length, '空格把整件装了上去');
  eq(S.lux, luxBefore, '装完光没动——光只在呈交那一刻给');
  gt(BS.auction.eval(M).total, 0, '装完估价不是 0 了');
  eq(M.sel.e, wanted, '手上那件还在，可以接着装');

  /* 试算：按空格之前就该看见「放下去会怎样」。
     这一版的原则是先知代替后悔——信息给在决定之前，不靠事后反复试。 */
  {
    const board = panel().querySelector('.fig.board');
    ok(!!board, '图纸在这');
    const slots = board.querySelectorAll('[data-act^="c:"]');
    let free = null, taken = null;
    for (const c of slots) {
      const a = c.getAttribute('data-act').slice(2).split(':').map(Number);
      if (!taken && BS.body.at(M.body(), a[0], a[1])) taken = c;
      if (!free && !BS.body.at(M.body(), a[0], a[1]) && M.canAt(a[0], a[1], M.sel.e, M.sel.r)) free = c;
    }
    ok(!!taken, '图纸上有一格是有东西的');
    if (taken) {
      taken.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
      const pb = doc.getElementById('prevbox');
      ok(pb.innerHTML.indexOf(I.get('试算')) >= 0, '试算那一块出现了');
      ok(pb.innerHTML.indexOf(I.get('这里放不下')) >= 0, '压在有东西的格上，直说放不下');
    }
    ok(!!free, '图纸上有一格放得下手上这件');
    if (free) {
      const nB = M.stats().n;
      free.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
      const pb2 = doc.getElementById('prevbox');
      ok(pb2.innerHTML.indexOf(I.get('试算')) >= 0, '试算那一块在');
      ok(pb2.innerHTML.indexOf(I.get('这里放不下')) < 0, '放得下的格上不说放不下');
      ok(pb2.innerHTML.indexOf(I.get('估价 # 光').replace('#', '')) >= 0 ||
        /估价|Appraisal|評価|Оценка/.test(pb2.innerHTML), '试算报了估价的变化');
      ok(pb2.innerHTML.indexOf(I.get('质变度 # → #').split(' ')[0]) >= 0 ||
        /质变度|Metamorphosis|質変度|Метаморфоза/.test(pb2.innerHTML), '试算报了质变度的前后');
      const seqB = S.seq | 0;
      const depthB = M.undoDepth();
      free.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
      eq(M.stats().n, nB, '试算不动图面：格数没变');
      eq(S.seq | 0, seqB, '试算不动动手计数（它没真的装上去）');
      /* 不比「栈是不是空的」——默认就有五步，装过的那一步本来就在栈里。
         要钉的是试算这一步自己没往栈里加东西。 */
      eq(M.undoDepth(), depthB, '试算不进撤销栈（' + depthB + ' 步没变）');
    }
  }
  /* 光标不在图纸上：空格不放，并且当场说明为什么 */
  const nNoHover = M.stats().n;
  panel().querySelector('.fig.board').dispatchEvent(new w.MouseEvent('mouseleave', { bubbles: true }));
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  eq(M.stats().n, nNoHover, '光标不在图纸上时，空格不放件');
  ok(panel().innerHTML.indexOf(I.get('先把光标移到图纸上，再按空格——落点就是光标那一格。')) >= 0, '并且当场说明落点没定');
  /* 不在组装台：空格什么也不做 */
  go('settings');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  eq(M.stats().n, nNoHover, '不在组装台时空格不动图面');
  go('assembly');
  ok(panel().innerHTML.indexOf(I.get('把光标移到图纸上，按空格把它放下——外接框左下角就落在光标那一格。')) > 0,
    '组装台把空格这个手势写在明面上');

  /* 目标条在 */
  ok(!!panel().querySelector('.goal'), '组装台上有常驻的目标条');
  /* 快速预览在 */
  ok(!!panel().querySelector('.qls'), '组装台上有「接下来几件」的预览');
  /* 六项指标的横条在 */
  eq(panel().querySelectorAll('.eb').length, E.DEFS.length, '组装台上画了 ' + E.DEFS.length + ' 项指标');
  const c0 = occ(wanted, 0, 0, 0)[0];
  const cell = panel().querySelector('[data-act="c:' + c0[0] + ':' + c0[1] + '"]');
  cell.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const rm = panel().querySelector('[data-act^="rm:"]');
  ok(!!rm, '选中之后可以拆它');
  /* 拆要问：常 / 变 / 超问一遍，华 / 殿问两遍。这里一路点到真拆为止，
     同时钉住两件事——第一下一定不拆，以及问的那一句带着内容。 */
  let rmClicks = 0;
  let rmNow = rm;
  while (rmNow && rmClicks < 5 && M.stats().n > 0) {
    rmNow.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    rmClicks++;
    if (rmClicks === 1) {
      gt(M.stats().n, 0, '第一次点只是问一句，没有真拆');
      ok(!!panel().querySelector('[data-act="rmcancel"]'), '问的那一栏有「取消」可以退出来');
      const lbl = (panel().querySelector('[data-act^="rm:"]') || {}).textContent || '';
      ok(lbl.indexOf(M.metaOf(wanted).nm) >= 0 || lbl.indexOf(String(M.cellsOf(wanted).length)) >= 0,
        '问的那一句带着这一件的名字或格数（「' + lbl + '」）');
    }
    rmNow = M.stats().n > 0 ? panel().querySelector('[data-act^="rm:"]') : null;
  }
  eq(M.stats().n, 0, '问完之后真拆掉了整件（点了 ' + rmClicks + ' 次）');
  lte(rmClicks, 3, '最多问三遍就够（实际 ' + rmClicks + ' 次）');

  /* 任务页：领奖按钮只在达成时出现 */
  fresh(); give(20);
  go('quests');
  ok(!!q('.qcs'), '任务页搭出了任务卡');
  eq(panel().querySelectorAll('.qc').length, Q.SLOTS, '画了 ' + Q.SLOTS + ' 张任务卡');
  ok(!!q(".ess"), "任务页摊开了六项质变读数");
  const rerollBtn = q('[data-act^="reroll:"]');
  ok(!!rerollBtn, '卡住的任务能换');
  S.lux = 1e6;
  const qid = rerollBtn.getAttribute('data-act').slice(7);
  rerollBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(!Q.list().some(function (d) { return d.id === qid; }), '换掉之后那一条不在了');

  /* 科技树页：买一个节点 */
  fresh();
  S.lux = 1e6;
  go('tree');
  ok(!!q('.tier'), '科技树画出了层');
  ok(!!q('.brs'), '科技树画出了八条脉络');
  const buyBtn = panel().querySelector('[data-act="buy:T0:lux"]');
  ok(!!buyBtn, '第 0 层的「光」节点点得到');
  eq(buyBtn.disabled, false, '光够的时候它是可点的');
  buyBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok(TR.bought('T0:lux'), '点一下就点亮了');
  ok(panel().querySelector('[data-act="buy:T0:lux"]').disabled, '点亮之后按钮禁用了');
  const offBtn = panel().querySelector('[data-act="buy:T3:lux"]');
  if (offBtn) eq(offBtn.disabled, true, '前置没点的节点是禁用的');

  /* 成就页：筛选 */
  fresh(); give(20);
  go('achieve');
  ok(!!q('.ars'), '成就页搭出了列表');
  ok(!!q('.abar'), '成就页有完成率条');
  const catBtn = panel().querySelector('[data-act="c:质变"]');
  ok(!!catBtn, '能按分类筛');
  catBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const rows = panel().querySelectorAll('.ar');
  ok(rows.length > 0 && rows.length < A.LIST.length, '筛完只剩「质变」类的（' + rows.length + ' 条）');

  /* 测量页：展开一项指标看判据 */
  fresh(); give(20);
  write(BLOCK3, 'n0', 0, 0, 0);
  go('measure');
  ok(!!q('.es4s'), '测量页画出了六项指标');
  eq(panel().querySelectorAll('.es4').length, E.DEFS.length + 1,
    '六项加一行合计（实际 ' + panel().querySelectorAll('.es4').length + ' 行）');
  /* 每一项都得露出那句「自己怎么验」的话——这是六项能被记住的关键 */
  ok(panel().innerHTML.indexOf(I.term(E.DEFS[0].ask)) >= 0,
    '测量页上写着这一项怎么自己验（' + I.term(E.DEFS[0].ask) + '）');
  const esBtn = q('[data-act="es:' + E.DEFS[0].k + '"]');
  ok(!!esBtn, '指标可以点开');
  esBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(panel().querySelectorAll('.p4').length, 4, '展开之后看到四条判据');
  ok(!!q('.e4p .note'), '判据上面有一句话说明');

  /* 设置页：开关 */
  go('settings');
  ok(!!q('[data-act="tg:auto"]'), '设置页有自动装配的开关');
  ok(!!q('[data-act="tg:sound"]'), '设置页有声音的开关');
  const autoTg = q('[data-act="tg:auto"]');
  autoTg.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(S.prefs.auto, 0, '没解锁「机」的时候按了也不会打开');
  S.tree['T0:auto'] = 1; TR.invalidate();
  go('settings');
  q('[data-act="tg:auto"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(S.prefs.auto, 1, '解锁之后按一下就开了');
  q('[data-act="tg:auto"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  eq(S.prefs.auto, 0, '再按一下关掉');

  /* 呈交页：估价、鉴赏录、拍卖并重置 */
  go('auction');
  const gh = panel().innerHTML;
  ok(gh.length > 500, '呈交页有内容');
  ok(!!q('.bidnum'), '呈交页把估价摆在明面上');
  ok(!!q('.leds'), '呈交页摊开了鉴赏录');
  ok(!!q('[data-act="sell"]'), '呈交页有「拍卖并重置」');
  ok(gh.indexOf('undefined') < 0 && gh.indexOf('NaN') < 0, '呈交页里没有 NaN/undefined');
  ok(gh.indexOf(I.get('光')) >= 0 || gh.indexOf(I.get('估价')) >= 0, '呈交页讲了光与估价');
  S.tree = {}; TR.invalidate();

  /* 呈交页：真的按下去会成交，并且图纸归零 */
  go('assembly');
  fresh(); give(30);
  var zs;
  for (zs = 0; zs < 8; zs++) {
    var es = M.lib()[0]; if (!es) break;
    var as2 = spot(es, 0); if (!as2) break;
    if (!M.place(as2[0], as2[1], es, 0).ok) break;
  }
  gt(M.stats().n, 0, '板上先有几件（' + M.stats().n + ' 格）');
  var luxSell = S.lux;
  go('auction');
  var sellBtn = q('[data-act="sell"]');
  ok(!!sellBtn, '呈交页有「拍卖并重置」这个按钮');
  if (sellBtn) {
    sellBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    gt(S.lux, luxSell, '按下去真的成交了（' + U.big(S.lux) + '）');
    eq(M.stats().n, 0, '图纸归零了');
    ok(panel().innerHTML.indexOf('undefined') < 0, '成交之后呈交页也没散');
    /* 陈列随上交一并清空：呈交页上不再有陈列区 */
    ok(panel().innerHTML.indexOf('gws') < 0, '陈列区不再挂在呈交页上');
    eq((S.gal || []).length, 0, '陈列也是空的');
  }

  go('assembly');
}

section('键盘：空格放置、撤销、转向、自动');
{
  fresh(); give(20);
  S.tree['T0:hand'] = 1; TR.invalidate();
  var e = M.lib()[0], at = spot(e, 0);
  M.place(at[0], at[1], e, 0);
  var n0 = M.stats().n;
  /* 空格：光标压住落点，手上拿着一件，按一下键就落下去 */
  go('assembly');
  var he = M.lib()[0];
  M.sel.e = he; M.sel.r = 0;
  var at2 = spot(he, 0);
  ok(!!at2, '空格测试有一个落得下的点');
  var cellA = panel().querySelector('[data-act="c:' + at2[0] + ':' + at2[1] + '"]');
  ok(!!cellA, '那一格在图纸上点得到');
  cellA.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true }));
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  var nSp = M.stats().n;
  gt(nSp, n0, '空格把手上的那件放了下去');
  /* Ctrl+Z */
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  lt(M.stats().n, nSp, 'Ctrl+Z 撤销了一步');
  /* R 转向 */
  M.sel.e = M.lib()[0]; M.sel.r = 0;
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
  eq(M.sel.r, 1, 'R 键把手上那件转了 90°');
  /* A 切自动 */
  S.prefs.auto = 0;
  S.tree['T0:auto'] = 1; TR.invalidate();
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  eq(S.prefs.auto, 1, 'A 键打开了自动装配');
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
  eq(S.prefs.auto, 0, '再按一次关掉');
  /* 数字键跳页 */
  doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: '3', bubbles: true }));
  eq(BS.app.cur(), 'tree', '按 3 跳到科技树');
  /* 输入框里打字不该触发快捷键 */
  go('settings');
  var ta = doc.getElementById('sxdump');
  if (ta) {
    var rBefore = M.sel.r;
    M.sel.e = 'n0'; M.sel.r = 0;
    var ev = new w.KeyboardEvent('keydown', { key: 'r', bubbles: true });
    Object.defineProperty(ev, 'target', { value: ta });
    ta.dispatchEvent(ev);
    eq(M.sel.r, 0, '在文本框里按 R 不会转手上那件');
  }
  S.tree = {}; TR.invalidate();
  go('assembly');
}

section('渲染与辉光');
{
  fresh(); give(20);
  var lib = M.lib();
  var pos = spot(lib[0], 0);
  M.place(pos[0], pos[1], lib[0], 0);
  var svg = R.board(M.body(), { hint: true, coords: true, pitch: 22, rarOf: function (e) { return M.metaOf(e).rar; } });
  ok(svg.indexOf('<svg') === 0, '图纸渲染是一段 svg');
  ok(svg.indexOf('class="gfine"') > 0, '画了细格线');
  ok(svg.indexOf('class="gcoarse"') > 0, '画了每四格的粗线');
  ok(svg.indexOf('class="bout"') > 0, '画了轮廓');
  ok(svg.indexOf('--fc') > 0, '所有格共用一支笔（元件没有颜色差异）');
  ok(svg.indexOf('#17475e') < 0 && svg.indexOf('#8f4be0') < 0 && svg.indexOf('#e02a9c') < 0,
    '旧的五档填充色已经不在了');
  var gv = R.glyphSVG('rtri0', 0, 0, 20, 0);
  ok(gv.indexOf('<polygon') === 0, '直角三角形画成多边形：' + gv.slice(0, 24));
  var gv2 = R.glyphSVG('ln', 0, 0, 20, 0);
  ok(gv2.indexOf('stroke') > 0, '线条是描边画出来的');
  var gv2b = R.glyphSVG('ln', 0, 0, 20, 1 | 4);
  ok(gv2b.split('L').length > 2, '粗线按邻居出笔：有几边邻格就伸几条臂');
  var gv3 = R.glyphSVG('net', 0, 0, 20, 5);
  ok(gv3.indexOf('M') >= 0, '连线从格心拉向邻格：' + gv3.slice(0, 40));
  ok(svg.indexOf('data-act="c:') > 0, '每一格都能点');
  ok(svg.indexOf('undefined') < 0, '渲染里没有 undefined');
  ok(svg.indexOf('NaN') < 0, '渲染里没有 NaN');
  ok(R.shape(P.shapeOf(3).cells, 50, 2).indexOf('<svg') === 0, '元件缩略图是一段 svg');
  eq(doc.querySelectorAll('canvas').length, 0, '页面上一块 canvas 都没有');
  /* 低烈度：滤镜真的被摘掉 */
  S.prefs.low = 0;
  eq(R.low(), false, '默认是全辉光');
  ok(R.defs().indexOf('odg1') > 0, '辉光全开时有滤镜');
  S.prefs.low = 1;
  eq(R.low(), true, '低烈度打开了');
  eq(R.defs(), '', '低烈度模式下定义里一个滤镜都没有');
  var svg2 = R.board(M.body(), { pitch: 22 });
  eq(svg2.indexOf('filter="url(#odg'), -1, '低烈度模式下没有任何滤镜引用');
  S.prefs.low = 0;
  /* 图纸跟着图一起长 */
  var w0 = Number(svg.match(/width="(\d+)"/)[1]);
  var big = M.lib()[0];
  var bb = M.stats();
  var p2 = null;
  for (var x = bb.bboxW + 6; x < bb.bboxW + 24 && !p2; x++) if (M.canAt(x, 0, big, 0)) p2 = [x, 0];
  if (p2) {
    M.place(p2[0], p2[1], big, 0);
    gt(Number(R.board(M.body(), { pitch: 22 }).match(/width="(\d+)"/)[1]), w0, '往外长出来之后画布自己变宽了');
  }
  /* 特质符号渲染得出来（组装台的快速预览会画） */
  go('assembly');
  ok(panel().innerHTML.indexOf('<svg') > 0, '组装台的预览里有缩略图');
}

section('存档：v8，坏档不带崩机器');
{
  fresh(); give(30);
  var lib = M.lib();
  var pos = spot(lib[0], 0);
  M.place(pos[0], pos[1], lib[0], 0);
  S.lux = 12345;
  S.tree['T0:lux'] = 1; S.tree['T0:hand'] = 1;
  TR.invalidate();
  S.ach['firstLight'] = 1;
  Q.st().done = 7;
  var n = M.stats().n, seq = S.seq, logs = S.log.length;
  var txt = BS.bus.encode();
  ok(txt.length > 80, '导出了一段');
  BS.bus.wipe(); S.body = Bd.mk();
  eq(M.stats().n, 0, '抹除之后图是空的');
  eq(S.lux, 0, '抹除之后光归零');
  eq(Object.keys(S.tree).length, 0, '抹除之后科技清空');
  eq(A.count(), 0, '抹除之后成就清空');
  var r = BS.bus.restore(txt);
  ok(r.ok, '读回来' + (r.ok ? '' : '：' + r.why));
  eq(M.stats().n, n, '格数接上');
  eq(S.seq, seq, '动手次数接上');
  eq(S.log.length, logs, '记录条数接上');
  eq(S.lux, 12345, '光接上');
  ok(TR.bought('T0:lux'), '科技接上');
  ok(A.unlocked('firstLight'), '成就接上');
  eq(Q.st().done, 7, '任务进度接上');
  ok(!BS.bus.restore('{"sig":"OTHER"}').ok, '别人家的存档读不进来');
  ok(!BS.bus.restore('not a save').ok, '乱字读不进来');
  ok(!BS.bus.restore('').ok, '空的读不进来');

  /* 缺胳膊少腿的存档 */
  var badPack = JSON.parse(BS.bus.decode(BS.bus.encode()));
  badPack.s.body = { cells: { '0,0': { e: 'n0', ox: 0, oy: 0, r: 0, seq: 1 }, '9,9': { e: '', ox: 0, oy: 0 }, 'zz': { e: 'n1' } } };
  delete badPack.s.log; delete badPack.s.gone; delete badPack.s.tree;
  delete badPack.s.ach; delete badPack.s.undo; delete badPack.s.quest;
  delete badPack.s.lux; delete badPack.s.stat;
  var r2 = BS.bus.restore(JSON.stringify(badPack));
  ok(r2.ok, '缺胳膊少腿的存档也读得进来');
  eq(M.stats().n, 1, '不合法的格被清掉，只剩合法那一格');
  eq(S.log.length, 0, '缺的记录补成空表');
  eq(typeof S.gone, 'object', '缺的 gone 表补上了');
  eq(typeof S.tree, 'object', '缺的科技表补上了');
  eq(typeof S.ach, 'object', '缺的成就表补上了');
  ok(Array.isArray(S.undo), '缺的撤销栈补成空表');
  eq(S.lux, 0, '缺的光补成 0');
  eq(typeof S.stat.placed, 'number', '缺的统计补上了');
  ok(!!Q.st() && Array.isArray(Q.st().act), '缺的任务表补上了');

  /* 上一版（v5，带合成件）的存档：读进来不该崩，合成件被丢弃 */
  var v5 = {
    sig: 'CONFIGURA', v: 5, at: '2026-01-01',
    s: {
      v: 5, t0: Date.now(), seq: 3,
      body: { cells: { '0,0': { e: 'm0', ox: 0, oy: 0, r: 0, seq: 1 }, '1,0': { e: 'n2', ox: 1, oy: 0, r: 0, seq: 2 } } },
      made: [{ id: 'm0', nm: 'x', cells: [[0, 0]], rar: 2, lv: 3 }],
      gone: {}, log: [], prefs: { lang: 'zh' }, stat: { placed: 2, packed: 1 }
    }
  };
  var r3 = BS.bus.restore(JSON.stringify(v5));
  ok(r3.ok, '旧版存档读得进来');
  eq(S.made, undefined, '合成件表被丢弃了');
  /* v8 又换了一次形状生成机制与字形表，旧档里的那具图形是按旧形状排的，
     留着它，平移与旋转就会按新形状去算——所以图纸清空重开，光与科技不动。 */
  eq(M.stats().n, 0, '旧版存档的图纸清空重开');
  gte(S.lux, 0, '光仍然是有限数');
  ok(isFinite(S.lux), '光补成了有限数');
  go('assembly');
  ok(panel().innerHTML.indexOf('undefined') < 0, '旧档读进来之后组装台也没散');

  /* 上一版的 v7 存档（形状是上一套）：读进来同样把图纸清空，其余照旧 */
  var v7 = JSON.parse(BS.bus.decode(BS.bus.encode()));
  v7.s.v = 7;
  v7.s.lux = 4321;
  v7.s.tree = { 'T0:lux': 1 };
  v7.s.body = { cells: { '2,2': { e: 'n1', ox: 2, oy: 2, r: 0, seq: 9 } } };
  var r4 = BS.bus.restore(JSON.stringify(v7));
  ok(r4.ok, 'v7 存档读得进来');
  eq(M.stats().n, 0, 'v7 的图纸也清空重开');
  eq(S.lux, 4321, 'v7 攒下的光留着');
  ok(S.tree['T0:lux'], 'v7 点亮的科技留着');

  /* 撤销栈封顶 */
  fresh();
  S.undo = [];
  for (var i = 0; i < BS.bus.UNDOCAP + 20; i++) S.undo.push({ k: 'place', e: 'n0', i: 0, j: 0, r: 0, lux: 1 });
  var norm = BS.bus.norm(S);
  lte(norm.undo.length, BS.bus.UNDOCAP, '撤销栈被裁到硬上限（' + norm.undo.length + '）');
  /* 记录封顶 */
  S.log = [];
  for (i = 0; i < BS.bus.LOGCAP + 100; i++) S.log.push({ n: i, k: 'add', m: 'x' });
  var norm2 = BS.bus.norm(S);
  lte(norm2.log.length, BS.bus.LOGCAP, '记录被裁到上限（' + norm2.log.length + '）');
}

section('四种语言：换得动，也退得回');
{
  ok(!!BS.i18n && Array.isArray(BS.i18n.LANGS), '有 i18n 模块');
  /* 英文排第一，也是默认语言 */
  eq(BS.i18n.LANGS.join(','), 'en,zh,ja,ru', '四种语言，英文第一');
  eq(BS.i18n.LANGS[0], 'en', '英文是第一个');
  for (const l of ['en', 'ja', 'ru']) {
    const m = BS.i18n.maps[l];
    ok(m && Object.keys(m).length > 100, l + ' 词典在（' + (m ? Object.keys(m).length : 0) + ' 条）');
  }
  /* 空译文要算译过了：中文量词「个」在英文里就该什么都不写，
     不能因为它长度是 0 又退回中文，害英文界面里冒出一个「个」。 */
  eq(BS.i18n.maps.en['个'], '', '「个」在英文里译成了空串');
  BS.i18n.setLang('en');
  eq(BS.i18n.get('个'), '', '空译文不会被当成没译');
  eq(BS.i18n.get('这一句中文词典里没有'), '这一句中文词典里没有', '真没有的还是诚实退回中文');
  BS.i18n.setLang('en');
  eq(BS.i18n.lang, 'en', '切到英文');
  eq(S.prefs.lang, 'en', '偏好写进了存档');
  eq(BS.i18n.get('格'), 'cell', '「格」译成 cell');
  eq(BS.i18n.get('这一句中文词典里没有'), '这一句中文词典里没有', '译不出的诚实退回中文');
  eq(doc.querySelectorAll('#langbar .lb').length, 4, '语言栏有四个按钮');
  /* 新增的几个关键词条补上了英文（2026-10 重定位为交互美学作品后的词表） */
  ['光', '命题', '脉络', '判定', '资质'].forEach(function (k) {
    var v = BS.i18n.maps.en[k];
    ok(!!v && v !== k, '「' + k + '」有英文词条：' + v);
  });
  /* 换语言之后每一页都得搭得起来 */
  for (const l of ['en', 'ja', 'ru', 'zh']) {
    BS.i18n.setLang(l);
    fresh(); give(20);
    var ez = M.lib()[0], az = spot(ez, 0);
    if (az) M.place(az[0], az[1], ez, 0);
    for (const m of BS.reg.all()) {
      go(m.id);
      const h = panel().innerHTML;
      ok(h.indexOf('undefined') < 0, l + ' 下 ' + m.id + ' 没有 undefined');
      ok(h.indexOf('NaN') < 0, l + ' 下 ' + m.id + ' 没有 NaN');
    }
  }
  BS.i18n.setLang('zh');
  eq(BS.i18n.get('格'), '格', '切回中文就是原话');
  go('assembly');
}

/* --------------------------------------------------------------------------
   英文界面：屏幕上不许再出现一个汉字。
   --------------------------------------------------------------------------
   这是把「查表」和「画出来」分开量之后立的一条硬规矩。
   只盯查表是不够的——有些中文是直接拼上去的，根本没走查表（成就页的名字与
   条件就这样漏了很久）。所以这里不看代码里有没有 T()，只看屏幕上剩了什么：
   逐页渲染，把所有可展开的都掀开（判据说法与律表只在展开时才渲染），
   然后遍历文本节点，凡是有汉字的都算漏。
   漏一处就红一处，以后谁再往界面里直接写中文，这条会当场拦下来。
   -------------------------------------------------------------------------- */
section('英文界面：屏幕上不许再出现一个汉字');
{
  BS.i18n.setLang('en');
  fresh(); give(30);
  /* 摆一具有点内容的图形，让读数、判据、律历都不是空的 */
  for (var bi = 0; bi < 14; bi++) {
    var be = M.lib()[0]; if (!be) break;
    var ba = spot(be, 0); if (!ba) break;
    M.place(ba[0], ba[1], be, 0);
  }
  /* 成交一次，让回执与成交记录也进到屏幕上（从前这一段靠混沌逼出律历） */
  var sr = M.sell();
  ok(sr.ok, '成交了一次，好把回执逼出来');

  const HAN = /[\u4e00-\u9fff]/;
  function hanBits(root) {
    const out = [];
    (function walk(n) {
      if (n.nodeType === 3) {
        if (n.nodeValue && HAN.test(n.nodeValue)) out.push(n.nodeValue.trim());
        return;
      }
      if (n.nodeType !== 1) return;
      /* 品牌字「构形」是标记（logotype），不是待译的界面文案，四种语言都照留。 */
      if (n.classList && n.classList.contains('brand')) return;
      const ti = n.getAttribute && n.getAttribute('title');
      if (ti && HAN.test(ti)) out.push('[title] ' + ti);
      for (let c = 0; c < n.childNodes.length; c++) walk(n.childNodes[c]);
    })(root);
    return out;
  }
  /* 扫整块屏幕，不只是面板：先前只扫 panel()，于是顶栏写死的「存档」
     「辉光」和页签标题一直漏在英文界面上没人管。 */
  function screen() { return doc.getElementById('frame') || panel(); }
  const bad = [];
  for (const m of BS.reg.all()) {
    go(m.id);
    panel().innerHTML.length;
    /* 掀开所有可展开的东西：展开前判据说法根本没进 DOM */
    for (let pass = 0; pass < 3; pass++) {
      const btns = panel().querySelectorAll('[data-act]');
      let clicked = 0;
      for (const el of btns) {
        const a = el.getAttribute('data-act') || '';
        if (/^(es:|tr:|fm:|rar:|only:|c:|cat:)/.test(a) && !el.__opened) {
          el.__opened = 1; try { el.click(); clicked++; } catch (e) { /* 点不动就算了 */ }
        }
      }
      if (!clicked) break;
    }
    /* 逐层扫：先扫面板，再扫提示条与底栏——那些也在屏幕上 */
    for (const bit of hanBits(screen())) bad.push(m.id + ' → ' + bit);
  }
  /* 设置页的每种开关、库页的每种筛选，也各过一遍 */
  for (const lk of Object.keys(S.prefs)) { S.prefs[lk] = S.prefs[lk] ? 0 : 1; go('settings'); for (const bit of hanBits(screen())) bad.push('settings → ' + bit); }
  for (const tid of ['volt', 'sacra', 'oculus', 'automa', 'crysta', 'iris', 'vacua', 'resona', 'radix', 'specu', 'aether']) {
    BS.bus.emit('libfilter', { trait: tid }); go('library');
    for (const bit of hanBits(screen())) bad.push('library(' + tid + ') → ' + bit);
  }
  /* 页签标题也在屏幕上 */
  if (HAN.test(doc.title)) bad.push('[title-tag] ' + doc.title);
  BS.i18n.setLang('zh');
  /* 想看全量漏点就设 DUMP_LEAKS=<路径>：只报前六个样本不足以定位，
     补词条的时候要的是完整清单。 */
  if (process.env.DUMP_LEAKS && bad.length) {
    fs.writeFileSync(process.env.DUMP_LEAKS, bad.join('\n'), 'utf8');
  }
  ok(bad.length === 0,
    '英文界面上一个汉字都没有（漏了 ' + bad.length + ' 处：' + bad.slice(0, 6).join(' ／ ') + '）');
}

section('习作 / 作品：赞誉不发给习作');
{
  /* 这一段的存在理由写在这里，免得后人把它当成一条普通断言删掉：
     改之前「装一件立刻呈交」是 816 光/分钟，压过用心经营十分钟的长局（364）。
     成因是开局白送八件 + 呈交把时钟归零，而参数/构形/名堂三类条目不问投入。
     所以这三类要等够得上「作品」才开始计价。这一段守的就是这条线。 */
  var WC = BS.auction.WORK_CELLS, WP = BS.auction.WORK_PIECES;
  gt(WC, 0, '门槛写在常量上：格数 ' + WC);
  gt(WP, 0, '门槛写在常量上：件数 ' + WP);
  var gated = BS.auction.items().filter(function (a) { return !!a.gate; });
  gt(gated.length, 20, '有 ' + gated.length + ' 条条目被门槛管着');
  ok(gated.every(function (a) { return a.cat === '参数' || a.cat === '构形' || a.cat === '名堂'; }),
    '被管着的只有参数 / 构形 / 名堂三类');

  /* 习作：一件小事，三类一条都不算 */
  fresh(); give(20);
  var eS = M.lib()[0], atS = spot(eS, 0);
  M.place(atS[0], atS[1], eS, 0);
  var evS = BS.auction.eval(M);
  eq(evS.isWork, false, '习作：一格两格的东西不算作品');
  eq(evS.hit.filter(function (a) { return !!a.gate; }).length, 0, '习作阶段，三类条目一条都没站住进价');
  var szS = evS.hit.filter(function (a) { return a.cat === '规模'; }).length;
  gt(szS, 0, '习作阶段规模那一类照常计价（' + szS + ' 条）——它回答的是「你用了什么」');

  /* 作品：够格之后三类才开始算 */
  fresh(); give(300);
  var guard = 0;
  while (M.lib().length && guard++ < 600) {
    var pk = SM.pickSmallest(M, M.lib());
    if (!pk) break;
    if (!M.place(pk.i, pk.j, pk.e, 0).ok) break;
    if (M.stats().n >= WC && M.insts().length >= WP) break;
  }
  var stW = M.stats();
  ok(stW.n >= WC && M.insts().length >= WP,
    '建到了 ' + stW.n + ' 格 / ' + M.insts().length + ' 件，跨过作品线');
  var evW = BS.auction.eval(M);
  eq(evW.isWork, true, '够格之后就算作品了');
  gt(evW.hit.filter(function (a) { return !!a.gate; }).length, 0, '三类条目开始计价了');

  /* 短刷不再划算：同样一件元件，习作态的价必须远低于作品态 */
  gt(evW.total / Math.max(1, evS.total), 8,
    '习作与作品的成交价拉开了一个数量级以上（' + U.big(evS.total) + ' → ' + U.big(evW.total) + '）');
}

section('成交加成：每一局留下一点东西');
{
  fresh(); give(200);
  var g2 = 0;
  while (M.lib().length && g2++ < 600) {
    var pk2 = SM.pickSmallest(M, M.lib());
    if (!pk2) break;
    if (!M.place(pk2.i, pk2.j, pk2.e, 0).ok) break;
    if (M.stats().n >= BS.auction.WORK_CELLS && M.insts().length >= BS.auction.WORK_PIECES) break;
  }
  var auc0 = (S.auc || {}).n | 0;
  var ev0 = BS.auction.eval(M);
  eq(ev0.sales, 1 + BS.auction.SALES_STEP * auc0, '这一次的成交加成按「之前成交过几次」算（×' + ev0.sales.toFixed(2) + '）');
  ok(M.sell().ok, '成交了');
  eq((S.auc || {}).n, auc0 + 1, '成交次数加一，而且跨过了这一局');
  gt((S.auc || {}).total, 0, '累计进账也跨过了这一局');
  /* 加成会真的抬下一次的价：同规模下再建一具，倍率该更大 */
  var ev1 = BS.auction.eval(M);
  ok(ev1.sales >= ev0.sales, '下一局的成交加成不小于上一局');
}

section('评分分辨率：这六根柱子必须有高有矮');
{
  /* 这一段守的是批次乙的合格线。改之前，六种**有意为之**的形状在
     fractality 的盒计数分项上全部读到 0.84，自相似的标度不变性分项
     全部读到 0.98 —— 那两根柱子等于恒真，没在测量任何东西。
     修法不是「把数字调小」，是让它们重新分得出高下。 */

  /* 一、实心方块必须明显比格栅「不 fractal」——它是这一项要否掉的东西 */
  function stamp(cells) {
    const b = Bd.mk();
    Bd.stamp(b, 0, 0, 'n0', 0, cells, 1);
    return b;
  }
  const solid16 = [], lattice21 = [];
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) solid16.push([x, y]);
  for (let x = 0; x < 21; x++) for (let y = 0; y < 21; y++) {
    if (x % 4 === 0 || y % 4 === 0) lattice21.push([x, y]);
  }
  const stSolid = Bd.stats(stamp(solid16), M.metaOf);
  const stLat = Bd.stats(stamp(lattice21), M.metaOf);
  /* 用六项里最直观的两条验：实心方块一个洞都没有，格栅围出一堆洞 */
  lt(stSolid.es.void, stLat.es.void - 0.15,
    '实心方块的通透明显低于格栅（' + stSolid.es.void.toFixed(2) + ' / ' + stLat.es.void.toFixed(2) + '）');
  gt(stLat.es.weave, stSolid.es.weave,
    '格栅的环络高于实心方块（' + stLat.es.weave.toFixed(2) + ' / ' + stSolid.es.weave.toFixed(2) + '）');
  /* 退场那条（分形）的算法仍在，窗口修好的事实要留着——它还在喂标度维数 */
  var fr = E.one('fractal', stamp(solid16), stSolid);
  var frA = (fr.parts || []).filter(function (p) { return p.id === 'A'; })[0];
  ok(frA, '退场那条分形算法的盒计数分项还在');
  if (frA) lt(frA.v, 0.60, '盒计数那一条不再对实心方块也发 0.84（现在 ' + frA.v.toFixed(2) + '）');

  /* 二、特质加成必须递减：五十件带同一条特质，抬不过它单件的本值。
       晶簇现在抬的是「重复」这一项。 */
  const one = P.sumEffectsTapered(['crysta']);
  const many = P.sumEffectsTapered(new Array(50).fill('crysta'));
  gt(one.repeat, 0, '一件晶簇仍然抬重复（+ ' + one.repeat.toFixed(3) + '）');
  gt(many.repeat, one.repeat, '件数多还是比一件强一点');
  lt(many.repeat, P.TRAIT_BY.crysta.effect.repeat,
    '五十件也抬不过单件的本值 ' + P.TRAIT_BY.crysta.effect.repeat + '（现在 ' + many.repeat.toFixed(3) + '）');
  lt(many.repeat, 10 * one.repeat, '不是线性的：十倍件数换不到十倍效果');
  /* 每一条特质抬的必须是六项里真的存在的某一项——写错一个键就等于白给。
     特质还带着一批与读数无关的效应（导电、自组织、共鸣、落件、失重、
     全项抬升、按格加价），那些不在这条断言的管辖范围内。 */
  const NON_AXIS = { conduct: 1, auto: 1, resonate: 1, haste: 1, weightless: 1, allEssence: 1, luxPerCell: 1 };
  const deadKey = [];
  P.TRAITS.forEach(function (tr) {
    for (const ek in tr.effect) {
      if (NON_AXIS[ek]) continue;
      if (!E.DEFBY[ek]) deadKey.push(tr.id + '→' + ek);
    }
  });
  eq(deadKey.length, 0, '没有一条特质抬在已经不存在的项上（' + deadKey.join(' ') + '）');

  /* 三、抬完的读数不许越界，也不许把原始读数抬成恒 1
       基值一律 0.5，键从 DEFS 取——以后加减项这一段照样成立。 */
  const base = {};
  E.DEFS.forEach(function (d) { base[d.k] = 0.5; });
  const boost = SM.boostedEssence(base, new Array(60).fill('crysta'), { essence: [] }, 400);
  lt(boost.repeat, 1, '抬完仍在 0..1 之内（' + boost.repeat.toFixed(3) + '）');
  gt(boost.repeat, 0.5, '确实抬上去了');
  lt(boost.repeat, 0.5 + P.TRAIT_BY.crysta.effect.repeat + 1e-9,
    '六十件晶簇也超不过「原始读数 + 单件本值」');
  /* 六项一个都不能少：boostedEssence 的输出必须正好覆盖 DEFS */
  const missingKeys = E.DEFS.filter(function (d) { return typeof boost[d.k] !== 'number'; })
    .map(function (d) { return d.k; });
  eq(missingKeys.length, 0, '抬完的读数正好覆盖六项（缺：' + missingKeys.join(' ') + '）');
}

section('识别表与旧字段');
{
  gt(C.LIST.length, 25, '识别表有 ' + C.LIST.length + ' 条');
  var b6 = Bd.mk();
  Bd.place(b6, 0, 0, 'n0', 0, BLOCK3, 1);
  var st6 = Bd.stats(b6, M.metaOf);
  ok(C.hit(st6, 'sym8'), '三三格是全对称体');
  ok(C.hit(st6, 'sym'), '三三格算「对称体」（对称读得高）');
  var b7 = Bd.mk();
  Bd.place(b7, 0, 0, 'n0', 0, RING8, 1);
  var st7 = Bd.stats(b7, M.metaOf);
  ok(C.hit(st7, 'ring'), '中空的一片是环体');
  eq(C.hit(st7, 'split'), false, '中空的一片没有断开');
  eq(C.hit(st7, 'packed'), false, '「套件体」这条已经随合成一起退场了');
  eq(C.marks(Bd.stats(Bd.mk(), M.metaOf)).length, 0, '空图一条都不命中');
  /* 识别表的判据都不许抛 */
  var threw = 0;
  [st6, st7, Bd.stats(Bd.mk(), M.metaOf)].forEach(function (s) {
    C.LIST.forEach(function (e) { try { e.ok(s); } catch (err) { threw++; } });
  });
  eq(threw, 0, '识别表的判据没有抛异常');
  /* 已删除的字段不该再被引用 */
  eq(st6.lvMax, 0, 'lvMax 还在系数里但恒为 0（合成没了）');
  ok(A.COEF.some(function (c) { return c.k === 'esScore'; }), '系数表里有质变度');
  ok(A.COEF.some(function (c) { return c.k === 'esSym'; }), '系数表里有对称');
}

section('性能：不能把浏览器拖死');
{
  /* 大图形：一千格量一遍 */
  var big = [], bx, by;
  for (bx = 0; bx < 50; bx++) for (by = 0; by < 20; by++) big.push([bx, by]);
  var b = Bd.mk();
  Bd.place(b, 0, 0, 'n0', 0, big, 1);
  var t0 = Date.now();
  var st = Bd.stats(b, M.metaOf);
  var dt = Date.now() - t0;
  eq(st.n, 1000, '一千格');
  lt(dt, 9000, '一千格量一遍不超过九秒（实际 ' + dt + ' ms）');
  ok(isFinite(st.esScore), '一千格的质变度是有限数');
  /* 科技树生成六十层不能卡 */
  var t1 = Date.now();
  TR.invalidate();
  var i;
  for (i = 0; i < 60; i++) TR.tierOf(i).forEach(function (id) { TR.node(id); });
  var dt2 = Date.now() - t1;
  lt(dt2, 3000, '生成六十层科技树不超过三秒（实际 ' + dt2 + ' ms）');
  /* 成就扫描（全部条目 × 复杂判据） */
  fresh(); give(20);
  var ez = M.lib()[0], az = spot(ez, 0);
  if (az) M.place(az[0], az[1], ez, 0);
  var t2 = Date.now();
  for (i = 0; i < 20; i++) A.buildCtx(M);
  var dt3 = Date.now() - t2;
  lt(dt3, 4000, '成就上下文算二十遍不超过四秒（实际 ' + dt3 + ' ms）');
  /* 任务进度 */
  var t3 = Date.now();
  for (i = 0; i < 20; i++) Q.progress(M);
  var dt4 = Date.now() - t3;
  lt(dt4, 4000, '任务进度算二十遍不超过四秒（实际 ' + dt4 + ' ms）');
}

eq(runtimeErrors.length, 0, '运行期没有报错（' + runtimeErrors.slice(0, 3).join(' / ') + '）');

process.stdout.write('\n');
if (fails.length) {
  process.stdout.write('  没过的：\n');
  for (const f of fails) process.stdout.write('    × ' + f + '\n');
}
process.stdout.write('\n  ' + pass + ' 项通过 · ' + fail + ' 失败\n\n');
try { w.close(); } catch (e) { /* 由它去 */ }
process.exit(fail ? 1 : 0);
