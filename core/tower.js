/* core/tower.js —— 图形数据 → 炮塔属性。
   ------------------------------------------------------------------
   这是「进化」那座桥（本版的核心决策）：图形在工坊里拼好、提交之后，
   塌缩成一座只占一格的炮塔。六项读数各司其职，特质给战斗人格——
   战场不再有多格脚印，也不再分墙与炮塔：一切图形进化为炮塔。
   测量走 essence 的原套算法，一格未改——审美的尺度不变，
   变的只是这个尺度如今兑现成什么。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, Bd = BS.body, P = BS.parts;

  /* ---------- 把一枚元件拓成一座可测量的图纸 ----------
     body 要的是绝对格坐标；元件的格子是相对的，直接铺上去。 */
  function bodyOf(part) {
    var b = Bd.mk(), cs = part.cells, i;
    for (i = 0; i < cs.length; i++) {
      b.cells[cs[i][0] + ',' + cs[i][1]] = { e: 'p' + (part.i != null ? part.i : 0), r: 0, ox: cs[i][0], oy: cs[i][1] };
    }
    return b;
  }

  /* meta：body.stats 要每格的重量与稀有度。元件的稀有度整件一个。 */
  function metaOf(part) {
    var w = P.RARITY[part.rar].w;
    return function () { return { w: w, rar: part.rar | 0, lv: 0 }; };
  }

  /* ---------- 测量：按元件序号缓存 ----------
     同一序号永远是同一具图形，所以读数算一次就够。 */
  var CACHE = {};
  function read(part) {
    var k = part.i != null ? 'i' + part.i : JSON.stringify(part.cells) + part.form + part.traits.join(',');
    if (CACHE[k]) return CACHE[k];
    var st = Bd.stats(bodyOf(part), metaOf(part));
    var out = {
      st: st,
      es: { sym: st.esSym, repeat: st.esRepeat, void: st.esVoid, even: st.esEven, weave: st.esWeave, edge: st.esEdge },
      esScore: st.esScore || 0
    };
    CACHE[k] = out;
    return out;
  }
  /* 失效两个缓存。**两个都要清**——曾经只清了 CACHE（读数）没清 ACACHE（属性），
     于是「改完 SCALE 表调 forget() 再量一次」量到的还是旧值。
     这个坑极难发现：生产环境里图形签名是稳定的，缓存永不失效也不出错；
     只有调系数、做实验、写测试的时候才会踩上，而那时它会静默地告诉你
     「改没用」。门禁里有一条专门钉这个。 */
  function forget() { CACHE = {}; ACACHE = {}; }
  /* ---------- 塔属性 ----------
     这里有一处**缓存与全局升级的冲突**，必须讲清楚：
     read() 按元件序号缓存读数，而升级商店的「膛压/循环/校射」是全局的——
     如果把升级乘进缓存里，买完升级后老塔还是旧数值（缓存命中，永远不刷新）。
     所以 attrs() 分两段：
       ① 基础段（由图形决定）—— 可以缓存，也确实只需要算一次；
       ② 修正段（由 meta 升级决定）—— **每次都算**，绝不进缓存。
     这样买完升级，所有塔当场生效，不用手动失效任何缓存。 */
  var ACACHE = {};
  function base(part) {
    var k = part.i != null ? 'i' + part.i : JSON.stringify(part.cells) + part.form + part.traits.join(',');
    if (ACACHE[k]) return ACACHE[k];
    var r = read(part), st = r.st;
    var BASE = BS.towers.BASE, SC = BS.towers.SCALE, FX = BS.towers.TRAIT_FX, E = BS.eff;
    var f = P.formOf(part.form);
    var s = {
      dmg: BASE.dmg + SC.even.dmg * st.esEven,
      rate: BASE.rate + SC.repeat.rate * st.esRepeat,
      range: BASE.range + SC.void.range * st.esVoid,
      proj: 1 + Math.floor(st.esSym * SC.sym.projStep),
      pierce: Math.floor(st.esVoid * SC.void.pierce),
      chain: Math.floor(st.esWeave * SC.weave.chain),
      splash: 0,
      slow: st.esWeave * SC.weave.slow,
      hp: BASE.hp + st.esEdge * SC.edge.hp,
      melee: st.esEdge * SC.edge.melee,
      dot: 0, auraDmg: 0, costMul: 1
    };
    /* 型签名：每种型一座塔的人格。它作用在**属性**上而不是读数上——
       所以同一具图形，主料换成另一种型，进化出来就是另一种塔。
       这就是「不同炮对应不同图形」在数值上的落点。
       注意 dmgMul / rateMul 是**当场乘进 dmg / rate**，不是新开一个字段——
       签名是「加成」，乘区归乘区，别在 spec 里留一个没人读的键。 */
    if (f && f.sig) {
      var sg = f.sig, sk;
      for (sk in sg) {
        if (sk === 'dmgMul') s.dmg *= sg[sk];
        else if (sk === 'rateMul') s.rate *= sg[sk];
        else s[sk] = (s[sk] || 0) + sg[sk];
      }
    }
    /* 特质：每种一个战斗人格 */
    var t, fx;
    for (t = 0; t < part.traits.length; t++) {
      fx = FX[part.traits[t]];
      if (!fx) continue;
      if (fx.chain) s.chain += fx.chain;
      if (fx.proj) s.proj += fx.proj;
      if (fx.dmgMul) s.dmg *= fx.dmgMul;
      if (fx.range) s.range += fx.range;
      if (fx.slow) s.slow += fx.slow;
      if (fx.auraDmg) s.auraDmg += fx.auraDmg;
      if (fx.rateMul) s.rate *= fx.rateMul;
      if (fx.splash) s.splash += fx.splash;
      if (fx.dot) s.dot += fx.dot;
      if (fx.pierce) s.pierce += fx.pierce;
      if (fx.costMul) s.costMul *= fx.costMul;
    }
    s.kind = 'turret'; s.wall = false;
    s.esScore = r.esScore; s.es = r.es; s.n = part.cells.length;
    s.form = part.form; s.traits = part.traits.slice();
    /* 稀有度进 spec：战场与图鉴要按档位给这座塔上色。
       少了它，三处颜色体系就对不上——工坊里华档是金的，战场上那座塔却是灰的。 */
    s.rar = part.rar | 0;
    /* 形状进 spec：战场与图鉴要照着自己的样子画这座塔。
       少了它，「图形即炮塔」就只在数值上成立，看板上还是一个字。 */
    s.cells = part.cells.map(function (c) { return [c[0], c[1]]; });
    ACACHE[k] = s;
    return s;
  }

  function attrs(part) {
    var s = base(part), E = BS.eff;
    /* 修正段：全局升级。每次都乘，不进缓存——买完升级全场当场生效。 */
    var g = BS.metaDefs ? BS.metaDefs.mods(BS.bus.state.meta) : null;
    var o = {};
    var k;
    for (k in s) o[k] = s[k];
    o.traits = s.traits.slice();
    if (g) {
      o.dmg = s.dmg * (g.dmgMul || 1);
      o.rate = s.rate * (g.rateMul || 1);
      o.range = s.range + (g.rangeAdd || 0);
    }
    /* 闸门统一在这里收口——单点收敛，别处不许再夹 */
    o.dmg = E.eff('dmg', o.dmg);
    o.rate = E.eff('rate', o.rate);
    o.range = E.eff('range', o.range);
    o.hp = E.eff('towerHp', o.hp);
    o.proj = Math.max(1, Math.min(E.CAP.proj, Math.round(o.proj + o.pierce)));
    o.chain = Math.max(0, Math.round(o.chain));
    o.splash = Math.max(0, Math.round(o.splash));
    o.pierce = Math.max(0, Math.round(o.pierce));
    o.up = g ? { dmgMul: g.dmgMul || 1, rateMul: g.rateMul || 1, rangeAdd: g.rangeAdd || 0 } : null;
    return o;
  }

  /* 塔在战场上的生效格与攻击基准（包围盒中心） */
  function footprint(part, rot) {
    var cs = P.rotCells(part.cells, rot || 0);
    var sz = P.size(cs);
    return { cells: cs, w: sz.w, h: sz.h, cx: (sz.w - 1) / 2, cy: (sz.h - 1) / 2 };
  }

  BS.tower = {
    bodyOf: bodyOf, metaOf: metaOf, read: read, forget: forget,
    base: base, attrs: attrs, footprint: footprint
  };
})(window.BS);
