/* core/auction.js —— 鉴赏录：一具图形值多少光。
   ------------------------------------------------------------------
   光不按件结算，只在**呈交**那一刻一次到账。价由鉴赏录定：
   这是一张写死的清单，每一条都明说它认什么，此刻成不成立当场重算——
   你拆掉一格，刚才亮着的那条就灭，价也就跟着掉下去。

   清单有四路来源，正好是这一部作品全部能说出口的东西：
     · 构形识别（core/catalog.js）——这一具「恰好是什么」
     · 具体参数——六项质变指标各自的档，以及质变度、规模、资质、特质、型
     · 判定条目（core/achieve.js 里的结构类）——那些被人认下来过的名堂
   符合的条数越多越值钱，而且不是线性地值钱：
   单价之外还乘一道「条数加成」——收藏家买的是成套的东西。

   声誉来自你攒下的声誉（命题）与点亮过的判定：它们不进清单，
   但它们抬价——拍卖行认的是作者，不只是这一件。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  /* 条目估值 -> 光。整套经济只靠这一个数调平。
     0.04 → 0.070：批次乙（core/sim.js 的特质递减 + core/essence.js 的两处窗口重排）
     把「什么都不想」的基线读数整体压下来了（乱堆 25 件的成交从 2,077 掉到 1,136），
     而脉络的价钱一个没动。若不同时抬这一个数，整条长期曲线会原地慢一半——
     那不是难度，是拖时间。抬到 0.070 之后，一局 25 件回到 ~2,000 光，
     与批次甲验证过的那段节奏（4~5 分钟一局，两局买到 T7）对齐。 */
  var SCALE = 0.070;

  /* ---------- 习作 / 作品 ----------
     鉴赏录里有三类条目（参数 / 构形 / 名堂）回答的是「这具图形长成了什么」，
     而不是「它有多大一坨」。一坨八件的习作同样能让这三类站住几十条，
     于是「装一件立刻呈交」成了收益率最高的打法——实测 816 光/分钟，
     压过用心经营十分钟的长局（364）。这是这一版最要紧的一个洞。
     所以这三类要等这具图形够得上「作品」才开始计价：
     格数与件数两个条件一起卡——只卡格数会被「丢一个巨大件」绕过去，
     只卡件数会被「塞一堆单格件」绕过去。
     数值理由：基线模型 15 件 = 89 格、25 件 = 163 格，140 落在两者之间，
     又正好压在规模条目「120 格那一档」之上。 */
  var WORK_CELLS = 140;
  var WORK_PIECES = 18;
  /* 每次成交留一道永久倍率。收入随件数近似线性，而树的成本 ×1.62/层——
     线性对指数必然撞墙（实测撞在 T10~T12）。给收入装一条随局数上升的斜率，
     把墙改成坡：+10%/次，约多做 5~6 次成交换一层。[PLACEHOLDER：待 playtest] */
  var SALES_STEP = 0.10;
  var T_FIRST_CELL = '图纸上至少有一格。';   /* 唯一一句不带占位符的规模条目 */
  var T_MIX5 = '五档同框';
  var T_MIX5D = '五档资质同时在板上。';
  var T_ALL11 = '十一种特质在板上各至少有一件。';

  /* ---------- 参数条目：六项 × 三档 ----------
     键与名字都从 essence 的 DEFS 取，不在这里抄一份——
     抄一份就会在加指标那天对不上。 */
  function paramItems() {
    var out = [], d = (BS.essence && BS.essence.DEFS) || [], i, z;
    var TIERS = [
      { th: 0.35, pay: 14 },
      { th: 0.55, pay: 46 },
      { th: 0.75, pay: 165 }
    ];
    for (i = 0; i < d.length; i++) {
      for (z = 0; z < TIERS.length; z++) {
        out.push({
          id: 'p:' + d[i].k + ':' + z,
          cat: '参数', gate: 1,
          /* 名字与说法都存「模板 + 参数」，渲染时才落语言——
             整句拼好再交给词典是永远查不到的。 */
          t: BS.i18n.dyn('# #', [d[i].t, TIERS[z].th.toFixed(2)]),
          d: BS.i18n.dyn('「#」这一项读到 # 以上。', [d[i].t, TIERS[z].th.toFixed(2)]),
          pay: TIERS[z].pay,
          ok: (function (k, th) {
            return function (c) { return (c.st.es[k] || 0) >= th; };
          })(d[i].k, TIERS[z].th)
        });
      }
    }
    return out;
  }
  function scoreItems() {
    var S = [
      { th: 0.30, pay: 34 },
      { th: 0.45, pay: 110 },
      { th: 0.60, pay: 330 },
      { th: 0.72, pay: 900 }
    ], out = [], i;
    for (i = 0; i < S.length; i++) {
      out.push({
        id: 'sc:' + i, cat: '参数', gate: 1,
        t: BS.i18n.dyn('质变度 #', [S[i].th.toFixed(2)]),
        d: BS.i18n.dyn('质变度达到 #。', [S[i].th.toFixed(2)]),
        pay: S[i].pay,
        ok: (function (th) { return function (c) { return (c.st.esScore || 0) >= th; }; })(S[i].th)
      });
    }
    return out;
  }
  function sizeItems() {
    var S = [
      { n: 1, pay: 8 },
      { n: 40, pay: 26 },
      { n: 120, pay: 78 },
      { n: 300, pay: 210 },
      { n: 700, pay: 560 },
      { n: 1500, pay: 1500 }
    ], out = [], i;
    for (i = 0; i < S.length; i++) {
      out.push({
        id: 'sz:' + i, cat: '规模',
        t: BS.i18n.dyn('格 #', [S[i].n]),
        d: S[i].n <= 1 ? T_FIRST_CELL : BS.i18n.dyn('格数达到 #。', [S[i].n]),
        pay: S[i].pay,
        ok: (function (n) { return function (c) { return (c.st.n || 0) >= n; }; })(S[i].n)
      });
    }
    return out;
  }
  function rarityItems() {
    var S = [{ r: 1, pay: 18 }, { r: 2, pay: 46 }, { r: 3, pay: 140 },
      { r: 4, pay: 420 }, { r: -5, pay: 300 }], out = [], i, P = BS.parts;
    for (i = 0; i < S.length; i++) {
      out.push({
        id: 'rr:' + i, cat: '稀有',
        t: S[i].r < 0 ? T_MIX5 : BS.i18n.dyn('档 #', [P.RARITY[S[i].r].full]),
        d: S[i].r < 0 ? T_MIX5D : (S[i].r >= 4
          ? BS.i18n.dyn('板上有一件「#」档元件。', [P.RARITY[S[i].r].full])
          : BS.i18n.dyn('板上有一件「#」档以上的元件。', [P.RARITY[S[i].r].full])),
        pay: S[i].pay,
        ok: (function (r) {
          return r < 0
            ? function (c) { return (c.st.rarMix || 0) >= 5; }
            : function (c) { return (c.rarCount[r] || 0) >= 1; };
        })(S[i].r)
      });
    }
    return out;
  }
  function traitItems() {
    var S = [
      { n: 3, pay: 60 }, { n: 8, pay: 150 }, { n: 16, pay: 400 },
      { n: 6, pay: 320 }, { n: 11, pay: 900, all: 1 }
    ], out = [], i;
    for (i = 0; i < S.length; i++) {
      out.push({
        id: 'tt:' + i, cat: '特质',
        t: BS.i18n.dyn(i < 3 ? '特质 #' : '特质种 #', [S[i].n]),
        d: S[i].all ? T_ALL11
          : BS.i18n.dyn(i < 3 ? '板上一共带了 # 条以上的特质。' : '板上有 # 种以上不同的特质。', [S[i].n]),
        pay: S[i].pay,
        ok: (function (n, kinds) {
          return function (c) {
            var k, s = 0, kindsN = 0;
            for (k in c.traits) { s += c.traits[k]; kindsN++; }
            return kinds ? kindsN >= n : s >= n;
          };
        })(S[i].n, i >= 3)
      });
    }
    return out;
  }
  function formItems() {
    var S = [{ n: 3, pay: 70 }, { n: 6, pay: 200 }, { n: 10, pay: 600 }], out = [], i;
    for (i = 0; i < S.length; i++) {
      out.push({
        id: 'fm:' + i, cat: '型',
        t: BS.i18n.dyn('型 #', [S[i].n]),
        d: BS.i18n.dyn('板上出现 # 种以上的型。', [S[i].n]),
        pay: S[i].pay,
        ok: (function (n) {
          return function (c) {
            var k, s = 0;
            for (k in (c.forms || {})) if (c.forms[k] > 0) s++;
            return s >= n;
          };
        })(S[i].n)
      });
    }
    return out;
  }
  /* 构形识别整表搬进来：每一条都有它自己的价钱。 */
  function identItems() {
    var C = BS.catalog, out = [], i, a;
    for (i = 0; i < C.LIST.length; i++) {
      a = C.LIST[i];
      out.push({
        id: 'id:' + a.id, cat: '构形', gate: 1, t: a.t, d: a.d, pay: a.pay || 24,
        ok: (function (f) { return function (c) { try { return !!f(c.st); } catch (e) { return false; } }; })(a.ok)
      });
    }
    return out;
  }
  /* 判定里的结构类名堂：被人认下来过的东西，拍卖行也认。
     苦功 / 脉络 / 命题那几类不进清单——它们与这一具长什么样无关。 */
  var ACH_CATS = { '质变': 1, '对称': 1, '结构': 1, '特质': 1, '形状': 1, '稀有': 1, '冷门': 1 };
  function achItems() {
    var A = BS.achieve, out = [], i, a;
    for (i = 0; i < A.LIST.length; i++) {
      a = A.LIST[i];
      if (!ACH_CATS[a.cat]) continue;
      out.push({
        id: 'ac:' + a.id, cat: '名堂', gate: 1, t: a.t, d: a.d,
        pay: Math.max(10, Math.round((a.pay || 30) * 0.35)),
        ok: (function (f) { return function (c) { try { return !!f(c); } catch (e) { return false; } }; })(a.ok)
      });
    }
    return out;
  }

  var _items = null;
  function items() {
    if (_items) return _items;
    _items = sizeItems().concat(scoreItems(), paramItems(), identItems(),
      rarityItems(), traitItems(), formItems(), achItems());
    return _items;
  }
  function groups() {
    var it = items(), out = [], seen = {}, i;
    for (i = 0; i < it.length; i++) {
      if (seen[it[i].cat]) continue;
      seen[it[i].cat] = 1;
      out.push(it[i].cat);
    }
    return out;
  }
  function inGroup(g) {
    var it = items(), out = [], i;
    for (i = 0; i < it.length; i++) if (it[i].cat === g) out.push(it[i]);
    return out;
  }

  /* ---------- 估价 ----------
     sum  所有站住的条目的估值之和
     k    站住的条数——它自己还要再乘一道，成套的东西不是按件论的
     rep  声誉：命题攒下的声誉 + 点亮过的判定条数
     脉络  「光」脉络的倍率 × 「相」脉络的眼光 */
  function evalBid(M) {
    var ctx = BS.achieve.buildCtx(M);
    var it = items(), hit = [], i, a, okHit, sum = 0;
    var st0 = ctx.st || {};
    /* 习作 / 作品：够不上作品的，那三类条目一条都不算。 */
    var isWork = (st0.n || 0) >= WORK_CELLS && (ctx.insts || 0) >= WORK_PIECES;
    for (i = 0; i < it.length; i++) {
      a = it[i];
      if (a.gate && !isWork) continue;
      try { okHit = !!a.ok(ctx); } catch (e) { okHit = false; }
      if (!okHit) continue;
      hit.push(a);
      sum += a.pay;
    }
    var k = hit.length;
    var st = ctx.st || {};
    var n = st.n || 0;
    /* 特质的小账：虹彩按格数加价，其余按「身上有多少本事」抬倍率 */
    var traitTotal = 0, tk, ids = [], z2;
    for (tk in ctx.traits) {
      traitTotal += ctx.traits[tk];
      for (z2 = 0; z2 < ctx.traits[tk]; z2++) ids.push(tk);
    }
    var eff = BS.parts.sumEffects(ids);
    if (eff.luxPerCell) sum += eff.luxPerCell * Math.min(300, n);
    /* 条数加成：站住的条目越多，单价越高。收藏家买的是成套的东西，
       不是零敲碎打——所以这一项是按条数往上翻的，不是按件数。 */
    var mult = (1 + 0.025 * k) * (1 + 0.015 * traitTotal);
    var mods = BS.tree ? BS.tree.mods() : { luxMult: 1, bid: 0 };
    var rep = 1 + 0.60 * (BS.quests ? BS.quests.rep() : 0) + 0.02 * (BS.achieve ? BS.achieve.count() : 0);
    /* 成交加成：交出去过多少次，就留下多少。它抬的是**这一具**的价，
       所以这一次成交本身不计入——数字是在 sell() 里成交之后才往上加的。 */
    var sales = 1 + SALES_STEP * (((BS.bus && BS.bus.state && BS.bus.state.auc) ? BS.bus.state.auc.n : 0) | 0);
    /* SCALE 是整套经济的定盘星：它把「条目估值」换成「光」。
       调它一个数，所有成交价一起动——其余的价都是相对关系，不必跟着改。
       定在这一档上：十几件、百来格的头一具，大约能拍出几百光，
       够点亮头五六层的脉络；再往后靠规模、声誉与脉络倍率往上走。 */
    var total = sum * mult * rep * (mods.luxMult || 1) * (1 + (mods.bid || 0)) * sales * SCALE;
    if (!(total > 0)) total = 0;
    hit.sort(function (x, y) { return y.pay - x.pay; });
    return {
      n: n, pieces: ctx.insts || 0, sum: Math.round(sum), k: k,
      mult: mult, rep: rep, sales: sales, isWork: isWork, total: total, top: hit.slice(0, 5),
      ids: (function () { var o = {}, z; for (z = 0; z < hit.length; z++) o[hit[z].id] = 1; return o; })(),
      ctx: ctx, items: it, hit: hit
    };
  }

  BS.auction = {
    items: items, groups: groups, inGroup: inGroup, eval: evalBid,
    SCALE: SCALE, WORK_CELLS: WORK_CELLS, WORK_PIECES: WORK_PIECES, SALES_STEP: SALES_STEP
  };
})(window.BS);
