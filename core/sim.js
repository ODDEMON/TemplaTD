/* core/sim.js —— 特质怎么加成、自动装配怎么挑。
   ------------------------------------------------------------------
   光不在这里算。装一件不进账——光是在呈交那一刻由鉴赏录一次给的
   （core/auction.js）。所以这一层只做两件事：
     把板上所有元件的特质摊平，交给 essence 去抬六项的读数；
     以及在自动装配开着的时候，替你挑一件装得下的贴上去。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var B = BS.bus, P = BS.parts;

  /* ---------- 板上所有元件的特质汇总 ---------- */
  function boardTraits(M) {
    var ids = {}, ins = M.insts(), i, e, m, out = {};
    for (i = 0; i < ins.length; i++) {
      e = ins[i].e;
      if (ids[e]) continue;
      ids[e] = 1;
      m = M.metaOf(e);
      var tr = m.traits || [], z;
      for (z = 0; z < tr.length; z++) out[tr[z]] = (out[tr[z]] || 0) + 1;
    }
    return out;
  }

  /* ---------- 质变指标被特质与脉络抬高 ---------- */
  function boostedEssence(base, traits, mods, n) {
    /* base = 六项原始读数，全部 0..1
       抬读数这件事走**递减**的那一份和：特质按件数累加，件数随这一稿线性增长，
       线性求和会让四条轴在六十件前后必然打满（详见 parts.sumEffectsTapered）。
       成交价那边（auction）仍按件线性算钱——那是钱，不是读数。 */
    var eff = P.sumEffectsTapered(traits), es = BS.essence.clamp01;
    var all = eff.allEssence || 0;                 /* 神视：六项都抬一点 */
    var em = (mods && mods.essence) || [];
    /* 每种特质只抬它自己那一项：晶簇→重复，镜渊与圣几何→对称，
       虚空→通透。eff 的键名就是效果名，不是特质 id。
       匀质、环络、轮廓没有对应的特质——它们只吃「神视」的全项抬升和
       脉络「质」脉络里对应的那几档。 */
    /* 每一项抬多少，按它在 DEFS 里的**序号**取脉络那一份——
       从前这里手写十一行、写死十个下标，加减一项就会静悄悄错位。
       现在跟着 DEFS 走，六项也好、八项也好，不会漏。 */
    var out = {}, i, d, k;
    for (i = 0; i < BS.essence.DEFS.length; i++) {
      d = BS.essence.DEFS[i];
      k = d.k;
      out[k] = es((base[k] || 0) + (eff[k] || 0) + all + (em[i] || 0));
    }
    /* 抬完重算合成分：与 essence.measure 同一套算法（加权几何平均，不打折） */
    var c = BS.essence.compose(out, { n: n || 0 });
    out.score = c.score;
    out.spread = c.spread;
    out.gm = c.gm;
    /* weak / lo 也要跟着走：rig 把它们写成 st.esWeak / st.esLo，
       判定页与测量页读的是这两个——漏了就永远显示「一个掉队的都没有」。
       它们如今只是诊断（不再扣分），但读数本身照样得送过去。 */
    out.weak = c.weak;
    out.lo = c.lo;
    return out;
  }

  /* ---------- 自动装配：挑一件能装下的，贴上去 ----------
     autoPick 点亮后优先挑带「自组织」特质的件；否则挑最小的能装下的件，
     这样它能尽快把图形铺起来，像俄罗斯方块那样有即时反馈。
     返回 { ok, e, i, j, r } 或 { ok:false }。 */
  function autoPlace(M) {
    var mods = BS.tree ? BS.tree.mods() : {};
    var lib = M.lib();
    if (!lib.length) return { ok: false, why: BS.i18n.get('库里空了') };
    var pick = (BS.tree && mods.autoPick) ? pickAuto(M, lib) : null;
    if (!pick) pick = pickSmallest(M, lib);
    if (!pick) return { ok: false, why: BS.i18n.get('没有一件装得下') };
    var r = M.place(pick.i, pick.j, pick.e, 0, { auto: true });
    if (!r.ok) return { ok: false, why: r.why };
    return { ok: true, e: pick.e, i: pick.i, j: pick.j, nm: M.metaOf(pick.e).nm };
  }

  /* 挑带自组织特质、且装得下的最小件 */
  function pickAuto(M, lib) {
    var i, e, m, cs, pos, best = null;
    for (i = 0; i < lib.length; i++) {
      e = lib[i]; m = M.metaOf(e);
      if ((m.traits || []).indexOf('automa') < 0) continue;
      cs = M.cellsOf(e);
      pos = findSpot(M, e);
      if (!pos) continue;
      if (!best || cs.length < best.n) best = { e: e, i: pos[0], j: pos[1], n: cs.length };
    }
    return best;
  }
  /* 挑装得下的最小件（贪心：先铺小的，图形长得快） */
  function pickSmallest(M, lib) {
    var i, e, cs, pos, best = null;
    var lim = Math.min(lib.length, 40);         /* 库很大时不必每拍全扫 */
    for (i = 0; i < lim; i++) {
      e = lib[i]; cs = M.cellsOf(e);
      pos = findSpot(M, e);
      if (!pos) continue;
      if (!best || cs.length < best.n) best = { e: e, i: pos[0], j: pos[1], n: cs.length };
    }
    return best;
  }
  /* 找一个能装下的位置：从质心附近往外一圈圈扫，扫到第一个放得下的就返回。
     这样自动装配会把图形往中间堆，像俄罗斯方块一样紧凑，不会往天边乱飘。
     两个要点：旋转结果只算一次（canAt 每次都会重算并排序，很贵）；
     扫描半径封顶——真放不下就老实说放不下，不要把主线程拖死。 */
  function findSpot(M, e) {
    var Bd = BS.body;
    var b = M.body();
    var cs = BS.parts.rotCells(M.cellsOf(e), 0);
    if (!Bd.n(b)) return Bd.canPlace(b, cs, 0, 0) ? [0, 0] : null;
    var st = M.stats();
    var cx = Math.round(st.bcx), cy = Math.round(st.bcy);
    var R = Math.min(RING_CAP, Math.max(st.bboxW, st.bboxH) + 6);
    var ring, dx, z, cand, x, y;
    for (ring = 0; ring <= R; ring++) {
      for (dx = -ring; dx <= ring; dx++) {
        cand = [[cx + dx, cy + ring], [cx + dx, cy - ring], [cx + ring, cy + dx], [cx - ring, cy + dx]];
        for (z = 0; z < 4; z++) {
          x = cand[z][0]; y = cand[z][1];
          if (Bd.canPlace(b, cs, x, y)) return [x, y];
        }
      }
    }
    return null;
  }
  var RING_CAP = 60;      /* 往外最多扫这么多圈：再远说明图形已经摊得没法看了 */

  BS.sim = {
    boostedEssence: boostedEssence, boardTraits: boardTraits,
    autoPlace: autoPlace, pickSmallest: pickSmallest, pickAuto: pickAuto, findSpot: findSpot
  };
})(window.BS);
