/* core/quests.js —— 命题：装图形 → 达成指标 → 签收 → 碰到更稀有的件。
   ------------------------------------------------------------------
   三条命题同时挂着，完成一条就补一条，补出来的由序号确定，
   所以谁玩到第 N 条命题，拿到的都是同一道——存档里只记「补到第几条」。

   命题的目标一律不看格数。看的是：
     · 质变六项读到多高（对称 / 重复 / 通透 / 匀质 / 环络 / 轮廓）
     · 板上出现了哪些特质、哪些形状族
     · 资质到了哪一档、几档同时在场
     · 图形结构长成了什么样子（洞、对称群、树、长条、致密……）

   奖励只有一种：声誉。声誉不进你的口袋，它抬的是你下一具图形的成交价——
   拍卖行认的是作者，不只是这一件。（光只在呈交那一刻给，见 core/auction.js。） */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, P = BS.parts;
  /* 与 rig.js 同一套写法：core 里的文件加载时 ui.js 还没到，
     所以取词一律走一个在**调用时**才解析的函数。 */
  function T(zh) { return BS.i18n ? BS.i18n.get(zh) : zh; }

  /* 命题的「说法」里嵌着阈值，而阈值是生成那一刻才算出来的——
     所以不能拼成死字符串（那样等于把语言定死在生成的那一刻）。
     这里统一造 {t: 中文模板, a: 参数}，渲染时才落语言。 */
  function D(t) {
    return BS.i18n.dyn(t, Array.prototype.slice.call(arguments, 1));
  }

  var SLOTS = 3;             /* 同时挂着三条 */
  var REP_EVERY = 3;         /* 每完成这么多条，给一次声誉 */
  var REP_STEP = 0.03;       /* 一次给这么多 */
  var REP_CAP = 0.60;        /* 声誉的天花板 */

  /* 六项质变指标：键与中文名都从 essence 的 DEFS 取，不在这里抄一份。
     抄一份就会在加指标那天对不上——这一部作品不缺这种事故。 */
  var ESS = [], ESST = {};
  (function () {
    var d = (BS.essence && BS.essence.DEFS) ? BS.essence.DEFS : [], i;
    /* 名字在**用的时候**才落语言：命题的说法是延迟渲染的（tell），
       这里若存中文源串，中途换语言就会留下一半汉字。 */
    for (i = 0; i < d.length; i++) {
      ESS.push(d[i].k);
      ESST[d[i].k] = BS.i18n.term(d[i]);
    }
    if (!ESS.length) {
      ESS = ['sym', 'repeat', 'void', 'even'];
      ESST = { sym: '对称', repeat: '重复', void: '通透', even: '匀质' };
    }
  })();

  /* 结构类命题的判据表。k 一律是 stats 上真算出来的字段，
     g(lv, u) 由难度与命题序号确定地生成阈值，dec 是小数位。 */
  var STRUCT_SPECS = [
    { k: 'holes', op: '>=', g: function (lv, u) { return Math.min(9, 1 + Math.floor(lv / 2) + (u < 0.35 ? 1 : 0)); }, t: '洞', dec: 0 },
    { k: 'comp', op: '>=', g: function (lv, u) { return Math.min(6, 2 + Math.floor(lv / 3) + (u < 0.3 ? 1 : 0)); }, t: '连通块', dec: 0 },
    { k: 'cyc', op: '>=', g: function (lv, u) { return Math.min(20, 2 + lv + (u < 0.4 ? 2 : 0)); }, t: '图环', dec: 0 },
    { k: 'dia', op: '>=', g: function (lv, u) { return Math.min(40, 6 + lv * 2 + (u < 0.4 ? 3 : 0)); }, t: '最长链', dec: 0 },
    { k: 'art', op: '>=', g: function (lv, u) { return Math.min(18, 2 + lv + (u < 0.35 ? 2 : 0)); }, t: '关节点', dec: 0 },
    { k: 'leaf', op: '>=', g: function (lv, u) { return Math.min(16, 3 + lv + (u < 0.4 ? 2 : 0)); }, t: '端点', dec: 0 },
    { k: 'circularity', op: '>=', g: function (lv, u) { return Math.min(0.94, 0.52 + lv * 0.05 + u * 0.08); }, t: '圆度', dec: 2 },
    { k: 'boxfill', op: '>=', g: function (lv, u) { return Math.min(0.99, 0.62 + lv * 0.05 + u * 0.10); }, t: '框内填充', dec: 2 },
    { k: 'boxfill', op: '<=', g: function (lv, u) { return Math.max(0.05, 0.26 - lv * 0.02 - u * 0.05); }, t: '松散', dec: 2 },
    { k: 'conc', op: '>=', g: function (lv, u) { return Math.min(40, 6 + lv * 2 + (u < 0.4 ? 3 : 0)); }, t: '凹角', dec: 0 },
    { k: 'conc', op: '<=', g: function () { return 0; }, t: '通凸', dec: 0, withN: function (lv) { return 14 + lv * 2; } },
    { k: 'exposure', op: '>=', g: function (lv, u) { return Math.min(3.2, 1.55 + lv * 0.08 + u * 0.15); }, t: '暴露', dec: 2 },
    { k: 'aniso', op: '>=', g: function (lv, u) { return Math.min(12, 2.6 + lv * 0.5 + u * 0.8); }, t: '各向异性', dec: 2 },
    { k: 'branch', op: '>=', g: function (lv, u) { return Math.min(24, 4 + lv + (u < 0.4 ? 2 : 0)); }, t: '分支点', dec: 0 },
    { k: 'esVoid', op: '>=', g: function (lv, u) { return Math.min(0.80, 0.26 + lv * 0.04 + u * 0.08); }, t: '通透', dec: 2 },
    { k: 'esEven', op: '>=', g: function (lv, u) { return Math.min(0.85, 0.34 + lv * 0.03 + u * 0.07); }, t: '匀质', dec: 2 },
    { k: 'esWeave', op: '>=', g: function (lv, u) { return Math.min(0.88, 0.34 + lv * 0.03 + u * 0.07); }, t: '环络', dec: 2 },
    { k: 'esEdge', op: '>=', g: function (lv, u) { return Math.min(0.88, 0.36 + lv * 0.03 + u * 0.07); }, t: '轮廓', dec: 2 }
  ];

  /* ---------- 命题种类 ----------
     每种写清楚：怎么算进度、怎么说人话、给多少光。
     live(ctx) 返回 0..1 的进度；ctx 里是当前的 stats、essence、库存、特质统计。 */
  var KINDS = [
    {
      id: 'essence', t: '指标', en: 'ESSENCE', w: 26,
      gen: function (q, lv) {
        /* 六项里挑一项。以前写死 *4，加指标那天就会漏掉新加的那几项。 */
        var k = ESS[Math.floor(q.u(1) * ESS.length) % ESS.length];
        /* 阈值随难度爬，但封顶在 0.92：再高就不是命题，是不可能。
           地板 0.30 → 0.50：旧地板下实测「什么都不想」的乱堆模型
           在四十件时六项全部越过 0.30（0.42～0.88，见 sim_axes），挂上去就是送的。
           抬到 0.50 之后它仍过得掉五项，只剩对称真的过不去——所以这条命题
           的狠劲不在低难度，在阈值随 lv 往上爬：通透、匀质在 0.6 前后掉队，
           环络、轮廓撑到 0.8 量级，只剩重复站到最后。
           必须真的去摆，这才是「命题」两个字的意思。 */
        var th = Math.min(0.92, 0.50 + lv * 0.03 + q.u(2) * 0.10);
        return { k: k, th: Math.round(th * 100) / 100 };
      },
      live: function (s, ctx) { return ctx.es[s.k] >= s.th ? 1 : (ctx.es[s.k] / s.th); },
      say: function (s) { return D('让「#」这一项读到 # 以上', ESST[s.k], s.th.toFixed(2)); },
      hint: function (s, ctx) { return D('现在 # / #', ctx.es[s.k].toFixed(2), s.th.toFixed(2)); },
      pay: function (s, lv) { return 26 + lv * 9; }
    },
    {
      id: 'score', t: '质变度', en: 'SCORE', w: 16,
      gen: function (q, lv) {
        /* 地板 0.26 → 0.50（同一条理由：乱堆四十件已经读到 0.61，旧地板白送）。
           封顶仍在 0.72：批次乙之后连「有意为之」的地毯也就 0.72，再高就不叫命题了。 */
        var th = Math.min(0.72, 0.50 + lv * 0.035 + q.u(3) * 0.08);
        return { th: Math.round(th * 100) / 100 };
      },
      live: function (s, ctx) { return ctx.es.score >= s.th ? 1 : (ctx.es.score / s.th); },
      say: function (s) { return D('让六项合成的「质变度」达到 # 以上', s.th.toFixed(2)); },
      hint: function (s, ctx) { return D('现在 # / #', ctx.es.score.toFixed(2), s.th.toFixed(2)); },
      pay: function (s, lv) { return 34 + lv * 12; }
    },
    {
      id: 'trait', t: '特质', en: 'TRAIT', w: 20,
      gen: function (q, lv) {
        var id = P.TRAITS[Math.floor(q.u(4) * P.TRAITS.length)].id;
        var cnt = 1 + (lv >= 4 && q.u(5) < 0.4 ? 1 : 0);
        return { tr: id, cnt: cnt };
      },
      live: function (s, ctx) { return Math.min(1, (ctx.traits[s.tr] || 0) / s.cnt); },
      say: function (s) {
        var t = P.traitOf(s.tr);
        return t ? D('让板上同时有 # 件带「#」的元件（#）', s.cnt, t.t, t.d)
          : D('让板上同时有 # 件带「#」的元件', s.cnt, s.tr);
      },
      hint: function (s, ctx) {
        var t = P.traitOf(s.tr);
        return D('现在 # / #（# #）', ctx.traits[s.tr] || 0, s.cnt, t ? t.sym : '', t ? t.t : s.tr);
      },
      pay: function (s, lv) { return 22 + lv * 8 + (s.cnt > 1 ? 18 : 0); }
    },
    {
      id: 'form', t: '型', en: 'FORM', w: 14,
      gen: function (q, lv) {
        var f = P.FORMS[Math.floor(q.u(6) * P.FORMS.length)];
        var cnt = 1 + (lv >= 3 && q.u(7) < 0.45 ? 1 : 0);
        return { fam: f.id, cnt: cnt };
      },
      live: function (s, ctx) { return Math.min(1, (ctx.forms[s.fam] || 0) / s.cnt); },
      say: function (s) {
        var f = P.FORM_BY[s.fam];
        /* 型名与型的那句话在**用的时候**才落语言：表项自带 en 的走 term，
           其余走词典。直接写 f.t / f.d 就会在英、日、俄界面里留一个汉字。 */
        return f ? D('让板上有 # 件「#」型的元件（#）', s.cnt, BS.i18n.term(f), T(f.d))
          : D('让板上有 # 件「#」型的元件', s.cnt, s.fam);
      },
      hint: function (s, ctx) {
        var f = P.FORM_BY[s.fam];
        return D('现在 # / #（# #）', ctx.forms[s.fam] || 0, s.cnt, f ? f.sym : '',
          f ? BS.i18n.term(f) : s.fam);
      },
      pay: function (s, lv) { return 20 + lv * 7 + (s.cnt > 1 ? 14 : 0); }
    },
    {
      id: 'rarity', t: '资质', en: 'RARITY', w: 14,
      gen: function (q, lv) {
        var need = Math.min(4, 1 + Math.floor(lv / 2) + (q.u(8) < 0.4 ? 1 : 0));
        var mix = lv >= 3 && q.u(9) < 0.5;
        return { need: need, mix: mix ? Math.min(5, 2 + Math.floor(lv / 3)) : 0 };
      },
      live: function (s, ctx) {
        var a = ctx.st.rarMax >= s.need ? 1 : (ctx.st.rarMax / s.need);
        if (!s.mix) return a;
        var b = ctx.st.rarMix >= s.mix ? 1 : (ctx.st.rarMix / s.mix);
        return (a + b) / 2;
      },
      say: function (s) {
        return s.mix
          ? D('让板上最高资质达到「#」档，且同时有 # 档资质在场', P.RARITY[s.need].full, s.mix)
          : D('让板上最高资质达到「#」档', P.RARITY[s.need].full);
      },
      hint: function (s, ctx) {
        return s.mix
          ? D('最高资质 # / #，在场 # / # 档', P.RARITY[Math.min(4, ctx.st.rarMax)].full, P.RARITY[s.need].full, ctx.st.rarMix, s.mix)
          : D('最高资质 # / #', P.RARITY[Math.min(4, ctx.st.rarMax)].full, P.RARITY[s.need].full);
      },
      pay: function (s, lv) { return 24 + lv * 10 + (s.mix ? 20 : 0); }
    },
    {
      id: 'struct', t: '结构', en: 'STRUCT', w: 18,
      gen: function (q, lv) {
        var sp = STRUCT_SPECS;
        var s = sp[Math.floor(q.u(10) * sp.length)];
        var th = s.g(lv, q.u(11));
        th = s.dec ? Math.round(th * 100) / 100 : Math.max(0, Math.round(th));
        var o = { k: s.k, op: s.op, th: th, t: s.t, dec: s.dec || 0 };
        if (s.withN) o.minN = s.withN(lv);
        return o;
      },
      live: function (s, ctx) {
        var v = Number(ctx.st[s.k]) || 0;
        if (s.minN && ctx.st.n < s.minN) return Math.min(0.99, ctx.st.n / s.minN);
        var hit = s.op === '>=' ? v >= s.th : v <= s.th;
        if (hit) return 1;
        /* 没达成也给个进度条：离目标有多近 */
        if (s.op === '>=') return s.th > 0 ? clamp01(v / s.th) : 0;
        var span = Math.max(1e-6, Math.abs(s.th));
        return clamp01(1 - Math.abs(v - s.th) / (span * 3));
      },
      say: function (s) {
        if (s.minN) return D('#：低于 #（且格数不少于 #）', s.t, fmtTh(s.th, s.dec), s.minN);
        return s.op === '>=' ? D('#：达到 #', s.t, fmtTh(s.th, s.dec))
          : D('#：低于 #', s.t, fmtTh(s.th, s.dec));
      },
      hint: function (s, ctx) {
        var v = Number(ctx.st[s.k]) || 0;
        return s.op === '>=' ? D('现在 # / ≥ #', fmtTh(v, s.dec), fmtTh(s.th, s.dec))
          : D('现在 # / < #', fmtTh(v, s.dec), fmtTh(s.th, s.dec));
      },
      pay: function (s, lv) { return 20 + lv * 8; }
    },
    {
      id: 'symmetry', t: '对称群', en: 'SYMMETRY', w: 12,
      gen: function (q, lv) {
        var need = [2, 4, 8][Math.min(2, Math.floor(lv / 2) + (q.u(12) < 0.5 ? 1 : 0))];
        return { order: need };
      },
      live: function (s, ctx) {
        var o = (ctx.st.sym && ctx.st.sym.order) || 1;
        return o >= s.order ? 1 : (o / s.order);
      },
      say: function (s) {
        return s.order >= 8
          ? D('让整个图形的对称群阶达到 #（既四重旋转又带镜面）', s.order)
          : D('让整个图形的对称群阶达到 #', s.order);
      },
      hint: function (s, ctx) { return D('现在群阶 # / #', (ctx.st.sym && ctx.st.sym.order) || 1, s.order); },
      pay: function (s, lv) { return 22 + lv * 9 + (s.order >= 8 ? 16 : 0); }
    },

    /* ---------- 后加的六种 ----------
       它们的共同点是：单一项达标不算数，要几件事同时成立。
       单独把一项堆到很高，其余不管，在这一版里已经不够用了。 */
    {
      /* 两项同时读高。单项阈值比「指标」那种低一截，但要两项一起。 */
      id: 'pair', t: '双项齐高', en: 'PAIR', w: 12,
      gen: function (q, lv) {
        var a = Math.floor(q.u(13) * ESS.length), b = Math.floor(q.u(14) * ESS.length);
        if (b === a) b = (b + 1 + Math.floor(q.u(15) * (ESS.length - 1))) % ESS.length;
        var th = Math.min(0.80, 0.18 + lv * 0.035 + q.u(16) * 0.08);
        th = Math.round(th * 100) / 100;
        return { k1: ESS[a], k2: ESS[b], th: th };
      },
      live: function (s, ctx) {
        var a = clamp01((ctx.es[s.k1] || 0) / s.th), b = clamp01((ctx.es[s.k2] || 0) / s.th);
        return Math.min(a, b);
      },
      say: function (s) { return D('让「#」与「#」同时读到 # 以上', ESST[s.k1], ESST[s.k2], s.th.toFixed(2)); },
      hint: function (s, ctx) {
        return D('# # · # # / #', ESST[s.k1], (ctx.es[s.k1] || 0).toFixed(2), ESST[s.k2], (ctx.es[s.k2] || 0).toFixed(2), s.th.toFixed(2));
      },
      pay: function (s, lv) { return 30 + lv * 11; }
    },
    {
      /* 六项都过线。线不高，但一项都不能瘸——这是最难的一类。 */
      id: 'allmin', t: '六项齐立', en: 'ALL SIX', w: 8,
      gen: function (q, lv) {
        var th = Math.min(0.55, 0.14 + lv * 0.022 + q.u(17) * 0.05);
        return { th: Math.round(th * 100) / 100 };
      },
      live: function (s, ctx) {
        var worst = 1, i;
        for (i = 0; i < ESS.length; i++) {
          var v = clamp01((ctx.es[ESS[i]] || 0) / s.th);
          if (v < worst) worst = v;
        }
        return worst;
      },
      say: function (s) { return D('六项全都读到 # 以上——一项都不能瘸', s.th.toFixed(2)); },
      hint: function (s, ctx) {
        var lo = 1, lk = '', i;
        for (i = 0; i < ESS.length; i++) {
          var v = ctx.es[ESS[i]] || 0;
          if (v < lo) { lo = v; lk = ESST[ESS[i]]; }
        }
        return D('最矮的是「#」# / #', lk, lo.toFixed(2), s.th.toFixed(2));
      },
      pay: function (s, lv) { return 48 + lv * 18; }
    },
    {
      /* 落差要小，总分还要够。这是「匀」的命题，专治偏科。 */
      id: 'harmony', t: '六项齐平', en: 'HARMONY', w: 8,
      gen: function (q, lv) {
        var sp = Math.max(0.18, 0.62 - lv * 0.035 - q.u(18) * 0.10);
        var sc = Math.min(0.62, 0.16 + lv * 0.03 + q.u(19) * 0.06);
        return { sp: Math.round(sp * 100) / 100, sc: Math.round(sc * 100) / 100 };
      },
      live: function (s, ctx) {
        var p1 = clamp01(1 - (ctx.st.esSpread || 0) / s.sp);
        var p2 = clamp01((ctx.es.score || 0) / s.sc);
        return Math.min(p1, p2);
      },
      say: function (s) { return D('把六项之间的落差压到 # 以内，同时质变度不低于 #', s.sp.toFixed(2), s.sc.toFixed(2)); },
      hint: function (s, ctx) {
        return D('落差 # / # · 质变度 # / #', (ctx.st.esSpread || 0).toFixed(2), s.sp.toFixed(2),
          (ctx.es.score || 0).toFixed(2), s.sc.toFixed(2));
      },
      pay: function (s, lv) { return 44 + lv * 16; }
    },
    {
      /* 标度维数落在一个带里：太实（2）太瘦（1）都不算。 */
      id: 'dimband', t: '维数落带', en: 'DIM BAND', w: 9,
      gen: function (q, lv) {
        var mid = Math.min(1.85, 1.45 + lv * 0.02 + q.u(20) * 0.12);
        var w2 = Math.max(0.10, 0.26 - lv * 0.012);
        return { lo: Math.round((mid - w2) * 100) / 100, hi: Math.round((mid + w2) * 100) / 100 };
      },
      live: function (s, ctx) {
        var v = Number(ctx.st.esDim) || 0;
        if (v >= s.lo && v <= s.hi) return 1;
        var d = v < s.lo ? (s.lo - v) : (v - s.hi);
        return clamp01(1 - d / 0.55);
      },
      say: function (s) { return D('让标度维数落在 # 到 # 之间', s.lo.toFixed(2), s.hi.toFixed(2)); },
      hint: function (s, ctx) { return D('现在 #，宜在 # ~ #', (Number(ctx.st.esDim) || 0).toFixed(2), s.lo.toFixed(2), s.hi.toFixed(2)); },
      pay: function (s, lv) { return 32 + lv * 12; }
    },
    {
      /* 洞和环都要有：通透与环络一起上。 */
      id: 'holring', t: '洞与环', en: 'CAVITY & CYCLE', w: 10,
      gen: function (q, lv) {
        var hn = Math.min(9, 1 + Math.floor(lv / 2) + (q.u(21) < 0.35 ? 1 : 0));
        var cy = Math.min(24, 2 + lv * 2 + (q.u(22) < 0.4 ? 2 : 0));
        var po = Math.min(0.85, 0.22 + lv * 0.04 + q.u(23) * 0.10);
        return { hn: hn, cy: cy, po: Math.round(po * 100) / 100 };
      },
      live: function (s, ctx) {
        var a = clamp01((ctx.st.holes || 0) / s.hn);
        var b = clamp01((ctx.st.cyc || 0) / s.cy);
        var c = clamp01((ctx.es.void || 0) / s.po);
        return Math.min(a, b, c);
      },
      say: function (s) { return D('围出 # 个洞、# 条独立环，且通透读到 # 以上', s.hn, s.cy, s.po.toFixed(2)); },
      hint: function (s, ctx) {
        return D('洞 #/# · 环 #/# · 通透 #/#', (ctx.st.holes || 0), s.hn, (ctx.st.cyc || 0), s.cy,
          (ctx.es.void || 0).toFixed(2), s.po.toFixed(2));
      },
      pay: function (s, lv) { return 40 + lv * 14; }
    },
    {
      /* 大而精：格数上去了，质变度还不许掉下来。长期目标。 */
      id: 'grand', t: '大而精', en: 'GRAND', w: 10,
      gen: function (q, lv) {
        var n2 = Math.min(600, 60 + lv * 40 + (q.u(24) < 0.4 ? 30 : 0));
        var sc = Math.min(0.60, 0.14 + lv * 0.028 + q.u(25) * 0.05);
        return { n: n2, sc: Math.round(sc * 100) / 100 };
      },
      live: function (s, ctx) {
        return Math.min(clamp01((ctx.st.n || 0) / s.n), clamp01((ctx.es.score || 0) / s.sc));
      },
      say: function (s) { return D('把图形做到 # 格，而质变度仍不低于 #——大了还不散', s.n, s.sc.toFixed(2)); },
      hint: function (s, ctx) {
        return D('格数 #/# · 质变度 #/#', (ctx.st.n || 0), s.n, (ctx.es.score || 0).toFixed(2), s.sc.toFixed(2));
      },
      pay: function (s, lv) { return 46 + lv * 17; }
    }
  ];
  var KB = {};
  (function () { var i; for (i = 0; i < KINDS.length; i++) KB[KINDS[i].id] = KINDS[i]; })();

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function fmtTh(v, d) {
    v = Number(v);
    if (!isFinite(v)) return '—';
    return d ? v.toFixed(d) : String(Math.round(v));
  }

  /* ---------- 一条命题的确定性生成 ---------- */
  function def(qi) {
    qi = qi | 0;
    var seed = qi * 2654435761 % 2147483647;
    function u(n) { return U.at(seed, n); }
    /* 难度：随命题序号慢慢爬，每 6 条一级 */
    var lv = Math.floor(qi / 6);
    /* 按权重挑一种 */
    var tot = 0, i;
    for (i = 0; i < KINDS.length; i++) tot += KINDS[i].w;
    var r = u(0) * tot, kind = KINDS[KINDS.length - 1];
    for (i = 0; i < KINDS.length; i++) { r -= KINDS[i].w; if (r <= 0) { kind = KINDS[i]; break; } }
    var q = { u: u, qi: qi, lv: lv };
    var spec = kind.gen(q, lv);
    spec.kind = kind.id;
    return {
      id: 'q' + qi, qi: qi, lv: lv, kind: kind.id, kt: kind.t,
      spec: spec, pay: Math.max(1, Math.round(kind.pay(spec, lv) * (1 + lv * 0.06))),
      say: kind.say(spec), hintF: kind.hint, liveF: kind.live
    };
  }

  /* ---------- 状态 ---------- */
  function st() {
    var S = B.state;
    if (!S.quest || typeof S.quest !== 'object') S.quest = { act: [], next: 0, done: 0, rep: 0, seen: {} };
    var q = S.quest;
    if (!Array.isArray(q.act)) q.act = [];
    if (!(q.next > 0)) q.next = 0;
    if (!(q.done >= 0)) q.done = 0;
    if (!(q.rep >= 0)) q.rep = 0;
    if (!q.seen || typeof q.seen !== 'object') q.seen = {};
    return q;
  }
  /* 补齐三条。第一次调用时从 0 号开始发。 */
  function ensure() {
    var q = st(), i;
    while (q.act.length < SLOTS) {
      var qi = q.next++;
      q.act.push({ id: 'q' + qi, qi: qi });
    }
    return q;
  }
  function list() {
    var q = ensure(), out = [], i;
    for (i = 0; i < q.act.length; i++) out.push(def(q.act[i].qi));
    return out;
  }

  /* ---------- 上下文：算进度要用的全部读数 ---------- */
  function ctx(M) {
    var b = M.body(), stt = M.stats();
    var es = stt.es || (BS.essence ? BS.essence.zeros().es : {});
    /* 板上每件元件的特质与族各数一次 */
    var traits = {}, forms = {}, ids = {}, ins = M.insts(), i;
    for (i = 0; i < ins.length; i++) {
      var e = ins[i].e;
      if (ids[e]) continue;
      ids[e] = 1;
      var m = M.metaOf(e);
      var tr = m.traits || [], z;
      for (z = 0; z < tr.length; z++) traits[tr[z]] = (traits[tr[z]] || 0) + 1;
      if (m.form) forms[m.form] = (forms[m.form] || 0) + 1;
    }
    return { st: stt, es: es, traits: traits, forms: forms, n: stt.n };
  }

  function progress(M) {
    var q = ensure(), c = ctx(M), out = [], i;
    for (i = 0; i < q.act.length; i++) {
      var d = def(q.act[i].qi);
      var p = 0;
      try { p = clamp01(d.liveF(d.spec, c)); } catch (e) { p = 0; }
      if (!isFinite(p)) p = 0;
      out.push({ def: d, p: p, done: p >= 1, hint: d.hintF ? safe(d.hintF, d.spec, c) : '' });
    }
    return out;
  }
  /* 说法的执行有可能抛（表里少一个键之类）。这里只兜异常，不做 String()——
     说法现在可能是「模板 + 参数」的对象，String() 会把它变成 '[object Object]'。
     落语言是渲染时 tell() 的事。 */
  function safe(f, s, c) { try { return f(s, c); } catch (e) { return ''; } }

  /* ---------- 签收 ---------- */
  function claim(qid, M) {
    var q = st(), i, slot = -1;
    for (i = 0; i < q.act.length; i++) if ('q' + q.act[i].qi === qid) { slot = i; break; }
    if (slot < 0) return { ok: false, why: BS.i18n.get('没有这条命题') };
    var d = def(q.act[slot].qi);
    var c = ctx(M), p = 0;
    try { p = clamp01(d.liveF(d.spec, c)); } catch (e) { p = 0; }
    if (p < 1) return { ok: false, why: BS.i18n.fill('还没达成：#', BS.i18n.tell(d.hintF ? safe(d.hintF, d.spec, c) : '')) };
    q.act.splice(slot, 1);
    q.done = (q.done | 0) + 1;
    B.state.stat.quests = q.done;
    var pay = d.pay;
    /* 每 REP_EVERY 条给一次声誉，封顶。声誉抬的是成交价，不是这一次的进账。 */
    var repUp = 0;
    if (q.done % REP_EVERY === 0 && q.rep < REP_CAP) {
      repUp = Math.min(REP_STEP, REP_CAP - q.rep);
      q.rep = Math.round((q.rep + repUp) * 1000) / 1000;
    }
    q.seen[d.id] = 1;
    ensure();
    /* 光真的到账。从前这里只算了 pay 却一次都没发出去——界面上写着
       「可领 # 光」，领完口袋里一个数都没动。写出来的数字必须等于到账的数。 */
    B.gain(pay, 'quest');
    B.log(BS.i18n.fill(T('命题达成：# —— 声誉 +#%，得 # 光'),
      BS.i18n.tell(d.say), Math.round(repUp * 100), U.big(pay)), 'quest');
    B.emit('quest', { id: d.id, rep: repUp });
    B.save();
    return { ok: true, rep: repUp, say: d.say };
  }
  /* 换掉一条：花光，越靠后越贵。给卡住的看的人一个出口。 */
  function reroll(qid, M) {
    var q = st(), i, slot = -1;
    for (i = 0; i < q.act.length; i++) if ('q' + q.act[i].qi === qid) { slot = i; break; }
    if (slot < 0) return { ok: false, why: BS.i18n.get('没有这条命题') };
    var cost = rerollCost();
    if (!B.can(cost)) return { ok: false, why: BS.i18n.fill('光不够：要 #', U.big(cost)) };
    B.spend(cost, 'reroll');
    var qi = q.next++;
    q.act[slot] = { id: 'q' + qi, qi: qi };
    B.log(BS.i18n.fill('换了一条命题，花 # 光', U.big(cost)), 'quest');
    B.emit('quest', {});
    B.save();
    return { ok: true, cost: cost, nd: def(qi) };
  }
  function rerollCost() {
    var q = st();
    return Math.max(6, Math.round(10 + q.done * 1.6));
  }
  /* 下一条命题的预知（识脉络点亮后才给看） */
  function peek(n) {
    var q = st(), out = [], i;
    for (i = 0; i < (n | 0); i++) out.push(def(q.next + i));
    return out;
  }
  /* 有几条已经达成、等着领。顶栏角标与底栏都用它。 */
  function readyCount() {
    var q = st(), c = null, i, n = 0;
    if (!BS.rig) return 0;
    c = ctx(BS.rig);
    for (i = 0; i < q.act.length; i++) {
      var d = def(q.act[i].qi), p = 0;
      try { p = clamp01(d.liveF(d.spec, c)); } catch (e) { p = 0; }
      if (p >= 1) n++;
    }
    return n;
  }
  /* 第一条已达成命题的说明：底栏拿它当常驻目标 */
  function firstReadySay() {
    var q = st(), i;
    if (!BS.rig) return '';
    var c = ctx(BS.rig);
    for (i = 0; i < q.act.length; i++) {
      var d = def(q.act[i].qi), p = 0;
      try { p = clamp01(d.liveF(d.spec, c)); } catch (e) { p = 0; }
      if (p >= 1) return BS.i18n.fill('# —— 已达成，可领 # 光', BS.i18n.tell(d.say), U.big(d.pay));
    }
    return '';
  }
  function rep() { return Math.min(REP_CAP, st().rep || 0); }

  BS.quests = {
    SLOTS: SLOTS, KINDS: KINDS, REP_EVERY: REP_EVERY, REP_STEP: REP_STEP, REP_CAP: REP_CAP,
    def: def, list: list, progress: progress, claim: claim, reroll: reroll,
    rerollCost: rerollCost, peek: peek, rep: rep, ctx: ctx, st: st,
    readyCount: readyCount, firstReadySay: firstReadySay
  };
})(window.BS);
