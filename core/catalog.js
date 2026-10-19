/* core/catalog.js —— 构形识别（条数以 LIST.length 为准，界面与手册都从那取，不写死）。
   它不收录，也不积累：每一次都是从当前这一具图形上重算一遍。
   你拆掉一格，之前亮着的那条就灭掉——这不是收藏，这是一次读数。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  var LIST = [
    { id: 'mono', t: '单体', en: 'MONOLITH', d: '只有一格。', ok: function (s) { return s.n === 1; } },
    { id: 'duo', t: '双体', en: 'DYAD', d: '两格。', ok: function (s) { return s.n === 2; } },
    { id: 'ring', t: '环体', en: 'ANNULUS', d: '轮廓里围出了一个洞。', ok: function (s) { return s.holes >= 1; } },
    { id: 'cav', t: '空腔体', en: 'CAVUM', d: '三个以上的洞。', ok: function (s) { return s.holes >= 3; } },
    { id: 'split', t: '断开体', en: 'DISCISSUM', d: '不再连通：分成了两块以上。', ok: function (s) { return s.comp >= 2; } },
    { id: 'tree', t: '树状体', en: 'ARBOR', d: '五格以上，格位图上一条多余边都没有。', ok: function (s) { return s.n >= 5 && s.tree; } },
    { id: 'cyc', t: '带环体', en: 'CYCLICUM', d: '四格以上，格位图里有环。', ok: function (s) { return s.n >= 4 && s.cyc >= 1; } },
    { id: 'spiny', t: '多须体', en: 'HISPIDUM', d: '三根以上的须：只有一格邻居的那些格。', ok: function (s) { return s.leaf >= 3; } },
    { id: 'branchy', t: '多叉体', en: 'RAMOSUM', d: '四个以上的分支点。', ok: function (s) { return s.branch >= 4; } },
    { id: 'thread', t: '细长体', en: 'FILUM', d: '八格以上，平均度数不到 1.8。', ok: function (s) { return s.n >= 8 && s.avgdeg < 1.8; } },
    { id: 'dense', t: '致密体', en: 'COMPACTUM', d: '十二格以上，轮廓周长逼近同面积圆（暴露 ≤ 1.16）。', ok: function (s) { return s.n >= 12 && s.exposure <= 1.16; } },
    { id: 'sleek', t: '流线体', en: 'STREAMLINED', d: '二十格以上，暴露 ≤ 1.08 且充实度 ≥ 0.8。', ok: function (s) { return s.n >= 20 && s.exposure <= 1.08 && s.fill >= 0.8; } },
    { id: 'spread', t: '摊开体', en: 'PATULUM', d: '十二格以上，暴露 ≥ 1.7。', ok: function (s) { return s.n >= 12 && s.exposure >= 1.7; } },
    { id: 'serrate', t: '锯齿体', en: 'SERRATUM', d: '凹角不少于八个：轮廓上到处是缺口。', ok: function (s) { return s.conc >= 8; } },
    { id: 'convexed', t: '通凸体', en: 'CONVEXUM', d: '十六格以上，一个凹角都没有。', ok: function (s) { return s.n >= 16 && s.conc === 0; } },
    { id: 'long', t: '长条体', en: 'TRABS', d: '八格以上，长短比 ≥ 4。', ok: function (s) { return s.n >= 8 && s.aspect >= 4; } },
    { id: 'loose', t: '松散体', en: 'LAXUM', d: '十六格以上，框内填充不到四成。', ok: function (s) { return s.n >= 16 && s.boxfill <= 0.4; } },
    { id: 'sym8', t: '全对称体', en: 'OCTOSYM', d: '同时有四重旋转与镜面，二面体群阶达到 8。', ok: function (s) { return s.sym.order >= 8; } },
    { id: 'mir', t: '镜像体', en: 'SPECULUM', d: '只有镜面，没有旋转对称，且不少于六格。', ok: function (s) { return !!(s.sym.refl && s.sym.rot === 1 && s.n >= 6); } },
    { id: 'rigid', t: '无关节体', en: 'ARTICULIS', d: '十二格以上却没有一个关节点。', ok: function (s) { return s.n >= 12 && s.art === 0; } },
    { id: 'fragile', t: '高危体', en: 'FRAGILIS', d: '五个以上的关节点。', ok: function (s) { return s.art >= 5; } },
    { id: 'branch1', t: '单点悬体', en: 'PENDULUM', d: '有端点，且最长链不短于十格。', ok: function (s) { return s.leaf >= 1 && s.dia >= 10; } },
    { id: 'ecc', t: '偏心体', en: 'EXCENTRICA', d: '八格以上，质心偏离几何中心 ≥ 0.6 格。', ok: function (s) { return s.n >= 8 && s.ecc >= 0.6; } },
    { id: 'aniso', t: '各向异体', en: 'ANISOTROPUM', d: '惯量主轴之比 ≥ 5。', ok: function (s) { return s.aniso >= 5; } },
    { id: 'rar', t: '异质体', en: 'DISPAR', d: '三档以上的资质同时出现在这一具上。', ok: function (s) { return s.rarMix >= 3; } },
    { id: 'mix', t: '混成体', en: 'MIXTUM', d: '五档资质全都在这一具上。', ok: function (s) { return s.rarMix >= 5; } },

    /* —— 质变六项：读得够高就算这一具「是」那样东西 ——
       一条一项，名字就是那一项的口语说法，所以认出来的那一刻
       看的人知道自己是凭什么被认下来的。 */
    { id: 'sym', t: '对称体', en: 'SYMMETRIC', d: '沿中线对折两边重合：对称读到 0.70 以上。', ok: function (s) { return (s.esSym || 0) >= 0.70; } },
    { id: 'partlysym', t: '半称体', en: 'PARTIALLY SYMMETRIC', d: '大体对得上但不完全：对称 0.55 以上，而对称群阶不到 8。', ok: function (s) { return (s.esSym || 0) >= 0.55 && (!s.sym || s.sym.order < 8); } },
    { id: 'repeat', t: '复现体', en: 'REPEATED', d: '同一段花样在别处又出现：重复读到 0.60 以上。', ok: function (s) { return (s.esRepeat || 0) >= 0.60; } },
    { id: 'porous', t: '多孔有序体', en: 'POROUS ORDERED', d: '洞够多而且成秩序：通透读到 0.55 以上。', ok: function (s) { return (s.esVoid || 0) >= 0.55; } },
    { id: 'homog', t: '同质体', en: 'HOMOGENEOUS', d: '疏密各处一致而不靠对称：匀质读到 0.60 以上。', ok: function (s) { return (s.esEven || 0) >= 0.60; } },
    { id: 'netted', t: '网络体', en: 'NETTED', d: '环织成了网：环络读到 0.60 以上。', ok: function (s) { return (s.esWeave || 0) >= 0.60; } },
    { id: 'contoured', t: '整廓体', en: 'CONTOURED', d: '整个看上去是一个东西：轮廓读到 0.62 以上。', ok: function (s) { return (s.esEdge || 0) >= 0.62; } },
    { id: 'essenced', t: '质变体', en: 'ESSENTIAL', d: '六项都不弱：质变度读到 0.40 以上。', ok: function (s) { return (s.esScore || 0) >= 0.40; } }
  ];

  /* ---------- 每一条在鉴赏录里值多少 ----------
     这张表只服务于一件事：呈交的时候，这一条能替你把价抬上去多少。
     越难碰到的构形越值钱——「只有一格」谁都做得到，「全对称体」得下功夫。
     写在这里而不是塞进 LIST，是为了让价钱这一栏一眼能整排对照着看。 */
  var PAY = {
    mono: 6, duo: 6, ring: 26, cav: 60, split: 14, tree: 30, cyc: 20, spiny: 22,
    branchy: 24, thread: 24, dense: 30, sleek: 46, spread: 26, serrate: 30,
    convexed: 40, long: 18, loose: 22, sym8: 150, mir: 40, rigid: 44, fragile: 26,
    branch1: 16, ecc: 18, aniso: 20, rar: 40, mix: 120,
    selfsimilar: 90, partlysym: 60, globallysym: 80, fractalish: 80, porous: 70,
    homog: 70, netted: 70, rhythmic: 70, nexal: 70, stratified: 70, contoured: 70,
    essenced: 110
  };
  (function () { var i; for (i = 0; i < LIST.length; i++) LIST[i].pay = PAY[LIST[i].id] || 24; })();

  /* 当前这一具图形命中了哪几条。算不出就一条都不给。 */
  function marks(st) {
    var out = [], i;
    if (!st || !st.n) return out;
    for (i = 0; i < LIST.length; i++) {
      var good = false;
      try { good = !!LIST[i].ok(st); } catch (e) { good = false; }
      if (good) out.push(LIST[i].id);
    }
    return out;
  }
  function hit(st, id) {
    var i;
    for (i = 0; i < LIST.length; i++) if (LIST[i].id === id) {
      try { return !!LIST[i].ok(st); } catch (e) { return false; }
    }
    return false;
  }

  BS.catalog = { LIST: LIST, marks: marks, hit: hit };
})(window.BS);
