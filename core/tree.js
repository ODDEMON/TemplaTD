/* core/tree.js —— 脉络：程序生成，可无限延展。
   ------------------------------------------------------------------
   这棵树没有尽头，也没有一张写死的表。每一个节点都是当场算出来的：
   给它一个层号与脉络号，它的名字、价钱、前置、效果就全都定了——
   同一输入永远同一节点，所以存档里只需要记「点亮了哪些」。

   八条脉络，每条只管一件事，说明里写的都是确切数字：
     光  抬成交价      时  快落件        质  抬指标
     相  抬眼光        性  多带特质      手  能撤销
     机  自动装        识  看得远

   往下挖的代价按 1.62 的幂涨，收益按更慢的速度涨——
   所以它永远值得挖，也永远挖不到头。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus;

  /* ---------- 八条脉络 ---------- */
  var BRANCHES = [
    { id: 'lux', t: '光', en: 'LUX', sym: '✦', d: '呈交时成交价的倍率更高' },
    { id: 'tempo', t: '时', en: 'TEMPO', sym: '⧗', d: '上游落件的间隔更短' },
    { id: 'essence', t: '质', en: 'ESSENCE', sym: '◈', d: '六项质变指标里某一项的读数被抬高' },
    { id: 'aspect', t: '相', en: 'ASPECT', sym: '❖', d: '眼光更毒：成交价按符合的条数再上一截' },
    { id: 'trait', t: '性', en: 'TRAIT', sym: '✧', d: '元件带特质的概率被推高' },
    { id: 'hand', t: '手', en: 'HAND', sym: '✥', d: '能撤销的步数更多' },
    { id: 'auto', t: '机', en: 'AUTO', sym: '❋', d: '自动装配更快、更挑' },
    { id: 'sight', t: '识', en: 'SIGHT', sym: '◉', d: '看得更远：预知接下来会落什么' }
  ];
  var BR = {};
  (function () { var i; for (i = 0; i < BRANCHES.length; i++) BR[BRANCHES[i].id] = BRANCHES[i]; })();

  /* 「质」这条脉络每一层抬高六项里的哪一项。名字从 essence 的 DEFS 取，
     不在这里另抄一份——抄一份就会和实际的项数对不上。
     存的是**表项本身**，落语言留到渲染时（tell 支持函数参数，见 i18n.tell），
     否则中途换语言，节点说明里那半句会留在旧语言里。 */
  var ESS7 = (function () {
    var d = (BS.essence && BS.essence.DEFS) ? BS.essence.DEFS : [];
    var out = [], i;
    for (i = 0; i < d.length; i++) {
      out.push((function (row) {
        return function () { return BS.i18n.term(row); };
      })(d[i]));
    }
    return out.length ? out : [function () { return '自相似'; }];
  })();

  /* ---------- 生成参数 ---------- */
  var COST_BASE = 24;         /* 第 0 层一个节点的基础价钱 */
  var COST_GROW = 1.62;       /* 每下一层贵这么多倍 */
  var OPEN_TIERS = 3;         /* 最深的那一层之后，再露出这么多层 */
  var MIN_TIERS = 5;          /* 一开始至少露出这么多层 */

  /* 每条脉络的节点名池：轮着用，所以名字有变化但不随机 */
  var NAMES = {
    lux: ['聚辉', '折光', '增亮', '满盈', '炽核', '恒曜', '流金', '烛天', '皓魄', '炎精'],
    tempo: ['急拍', '促节', '连珠', '疾风', '短晷', '飞梭', '刹那', '迅羽', '雷行', '电逝'],
    essence: ['度量', '显微', '察形', '析理', '刻骨', '见微', '穷象', '通变', '烛幽', '格致'],
    aspect: ['筛玉', '淘金', '拔萃', '擢异', '拣珍', '筛华', '擢秀', '采奇', '甄异', '选瑰'],
    trait: ['启蒙', '赋性', '注灵', '开窍', '点睛', '授能', '通神', '化性', '醒质', '铸魂'],
    hand: ['回腕', '悔步', '倒带', '复初', '返辙', '重描', '补笔', '改弦', '回溯', '重来'],
    auto: ['代手', '自持', '不歇', '常运', '恒作', '自转', '无休', '代劳', '自动', '长勤'],
    sight: ['望远', '窥隙', '先见', '烛远', '预览', '明察', '洞观', '远瞩', '前瞻', '照见']
  };
  /* 层号怎么念，归语言层管（BS.i18n.digits）：中文「三」，英文「3」。
     这一段原来在这里自己拼汉字数字（还留着一张 CN 表），于是英文界面上
     出现了「光·三」。现在节点名存的是模板，念法到渲染时才定。 */

  /* 节点名与效果说明里都嵌着算出来的数，所以不能拼成死字符串。
     统一造 {t: 中文模板, a: 参数}，渲染时才落语言。 */
  function D(t) {
    return BS.i18n.dyn(t, Array.prototype.slice.call(arguments, 1));
  }

  /* ---------- 层里有哪些节点 ----------
     第 0 层固定是光、时、手三条——开局就有的三件事。
     之后每层 3~4 个节点，脉络不重复，由层号确定地挑。 */
  function tierBranches(t) {
    if (t === 0) return ['lux', 'tempo', 'hand'];
    var cnt = 3 + (U.at(t * 977 + 13, 2) < 0.45 ? 1 : 0);
    /* 用层号把八条脉络确定地洗一遍，取前 cnt 条 */
    var pool = [], i;
    for (i = 0; i < BRANCHES.length; i++) pool.push(BRANCHES[i].id);
    var out = [], z;
    for (z = 0; z < cnt && pool.length; z++) {
      var r = U.at(t * 7691 + 31, 100 + z);
      var idx = Math.floor(r * pool.length) % pool.length;
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    /* 保证每条脉络不会长期缺席：若某条已经 4 层没出现，强制补进来 */
    var need = [], b;
    for (b in BR) {
      if (out.indexOf(b) >= 0) continue;
      var lastSeen = -1, tt;
      for (tt = t - 1; tt >= 0 && tt >= t - 4; tt--) {
        if (rawTierBranches(tt).indexOf(b) >= 0) { lastSeen = tt; break; }
      }
      if (lastSeen < 0) need.push(b);
    }
    /* 把需要补的从尾部逐个换进来：每个换掉一个不同的槽位，
       换过的槽位不再动，所以既不会漏补也不会补出重复。 */
    var slot = out.length - 1;
    while (need.length && slot >= 2) {
      if (out.indexOf(need[0]) < 0) out[slot] = need.shift();
      else need.shift();
      slot--;
    }
    return out;
  }
  /* 不带「强制补齐」的原始洗牌结果，只给上面那个回看用，避免无限递归 */
  function rawTierBranches(t) {
    if (t === 0) return ['lux', 'tempo', 'hand'];
    var cnt = 3 + (U.at(t * 977 + 13, 2) < 0.45 ? 1 : 0);
    var pool = [], i;
    for (i = 0; i < BRANCHES.length; i++) pool.push(BRANCHES[i].id);
    var out = [], z;
    for (z = 0; z < cnt && pool.length; z++) {
      var r = U.at(t * 7691 + 31, 100 + z);
      var idx = Math.floor(r * pool.length) % pool.length;
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  }

  var TIER_CACHE = {};
  function tierOf(t) {
    t = t | 0;
    if (TIER_CACHE[t]) return TIER_CACHE[t];
    var bs = tierBranches(t), out = [], i;
    for (i = 0; i < bs.length; i++) out.push(id(t, bs[i]));
    TIER_CACHE[t] = out;
    return out;
  }
  function id(t, b) { return 'T' + t + ':' + b; }
  function parse(nid) {
    var m = /^T(\d+):([a-z]+)$/.exec(String(nid || ''));
    if (!m) return null;
    return { t: +m[1], b: m[2] };
  }

  /* ---------- 一个节点的全部信息 ---------- */
  var NODE_CACHE = {};
  function node(nid) {
    if (NODE_CACHE[nid]) return NODE_CACHE[nid];
    var p = parse(nid);
    if (!p || !BR[p.b]) return null;
    var t = p.t, b = p.b, br = BR[b];
    /* 这一条脉络在这之前点亮过几个：决定它是本脉络的第几级 */
    var lv = levelInBranch(b, t);
    /* 名字：脉络名池轮着取 + 层号 */
    var pool = NAMES[b] || [];
    /* 名字 = 脉络名池轮着取 + 层号。层号怎么念归语言层管：
       中文是「光·三」，英文是「LUX·3」。所以这里存模板，不存成品。 */
    var nm = D('#·#', pool[(t + lv * 3) % pool.length], function () { return BS.i18n.digits(t); });
    /* 价钱：基础 × 层的幂 × 脉络系数 × 节点抖动。
       抖动用脉络在表里的序号做盐，不用名字长度——长度会撞。 */
    var bi = BRANCHES.indexOf(br);
    var bf = 0.88 + U.at(t * 313 + 7, 3) * 0.34;          /* 0.88..1.22 */
    var jit = 0.92 + U.at(t * 577 + bi * 4001 + 19, 4) * 0.20;
    var cost = Math.max(1, Math.round(COST_BASE * Math.pow(COST_GROW, t) * bf * jit));
    /* 前置：同脉络的上一层那一个；没有就取上一层的第一个 */
    var pre = [];
    if (t > 0) {
      var prev = tierOf(t - 1);
      var same = id(t - 1, b);
      pre.push(prev.indexOf(same) >= 0 ? same : prev[0]);
    }
    var nd = {
      id: nid, t: t, b: b, branch: br, lv: lv,
      nm: nm, cost: cost, pre: pre,
      eff: effOf(b, t, lv),
      say: sayOf(b, t, lv)
    };
    NODE_CACHE[nid] = nd;
    return nd;
  }

  /* ---------- 效果：确切数字，写在说明里 ---------- */
  /* 每条脉络的第 lv 级给多少。收益比代价涨得慢，所以越挖越吃力但永远有得挖。 */
  function effOf(b, t, lv) {
    var k = lv + 1;                                    /* 第几级，从 1 起 */
    var dim = 1 / (1 + lv * 0.16);                     /* 递减系数 */
    var bump = 1 + t * 0.05;                           /* 越深的层单点越值钱一点 */
    switch (b) {
      case 'lux': return { luxMult: 0.14 * dim * bump };
      case 'tempo': return { haste: 0.055 * dim * bump };
      case 'essence': return { essence: 0.016 * dim * bump, essenceTier: t % ESS7.length };
      case 'aspect': return { bid: 0.10 * dim * bump };
      case 'trait': return { traitLuck: 0.06 * dim * bump };
      case 'hand': return { undo: 1 + (lv % 3 === 2 ? 1 : 0) };
      case 'auto': return { autoRate: 0.22 * dim * bump, autoPick: lv >= 2 ? 1 : 0 };
      case 'sight': return { peek: lv >= 1 ? 1 : 0, peekN: 1 + Math.floor(lv / 2), peekForms: lv >= 3 ? 1 : 0 };
    }
    return {};
  }
  function sayOf(b, t, lv) {
    var e = effOf(b, t, lv), pct = function (x) { return '+' + Math.round(x * 100) + '%'; };
    switch (b) {
      case 'lux': return D('光的产出 #', pct(e.luxMult));
      case 'tempo': return D('落件间隔缩短 #', pct(e.haste));
      case 'essence': return D('# 读数 #', ESS7[e.essenceTier], pct(e.essence));
      case 'aspect': return D('成交价 #：鉴赏录里符合的条目越多，加得越狠', pct(e.bid));
      case 'trait': return D('带特质的概率 #', pct(e.traitLuck));
      case 'hand': return D('可撤销步数 +#', e.undo);
      case 'auto': return e.autoPick
        ? D('自动装配速度 #，并优先挑带「自组织」的件', pct(e.autoRate))
        : D('自动装配速度 #', pct(e.autoRate));
      case 'sight': return e.peekForms
        ? D('预知接下来 # 件，连它们的型都看得见', e.peekN)
        : D('预知接下来 # 件', e.peekN);
    }
    return '';
  }

  /* 这条脉络在第 t 层之前一共点亮过多少个（用于命名与效果递减） */
  function levelInBranch(b, t) {
    var n = 0, i, bs;
    for (i = 0; i < t; i++) {
      bs = tierBranches(i);
      if (bs.indexOf(b) >= 0) n++;
    }
    return n;
  }

  /* ---------- 可见深度：露到最深购买层再往下一截 ---------- */
  function maxBoughtTier() {
    var S = B.state, k, p, mx = -1;
    for (k in (S.tree || {})) {
      p = parse(k);
      if (p && p.t > mx) mx = p.t;
    }
    return mx;
  }
  function depth() {
    return Math.max(MIN_TIERS, maxBoughtTier() + 1 + OPEN_TIERS);
  }
  function tiers() {
    var d = depth(), out = [], i;
    for (i = 0; i < d; i++) out.push({ t: i, nodes: tierOf(i).map(node).filter(Boolean) });
    return out;
  }

  /* ---------- 购买 ---------- */
  function bought(nid) { return !!(B.state.tree || {})[nid]; }
  function blocked(nid) {
    var nd = node(nid);
    if (!nd) return BS.i18n.get('没有这个节点');
    if (bought(nid)) return BS.i18n.get('已经点亮了');
    var i;
    for (i = 0; i < nd.pre.length; i++) {
      if (!bought(nd.pre[i])) {
        var pn = node(nd.pre[i]);
        return BS.i18n.fill('要先点亮「#」', pn ? BS.i18n.tell(pn.nm) : nd.pre[i]);
      }
    }
    if (nd.t > maxBoughtTier() + 1 && nd.t > 0 && !anyBoughtInTier(nd.t - 1)) {
      return BS.i18n.get('上一层还没有任何节点被点亮');
    }
    if (!B.can(nd.cost)) {
      return BS.i18n.fill('光不够：要 #，手上有 #', U.big(nd.cost), U.big(B.state.lux));
    }
    return '';
  }
  function anyBoughtInTier(t) {
    var ns = tierOf(t), i;
    for (i = 0; i < ns.length; i++) if (bought(ns[i])) return true;
    return false;
  }
  function canBuy(nid) { return blocked(nid) === ''; }
  function buy(nid) {
    var why = blocked(nid);
    if (why) return { ok: false, why: why };
    var nd = node(nid);
    if (!B.spend(nd.cost, 'tree')) return { ok: false, why: BS.i18n.get('光不够') };
    (B.state.tree = B.state.tree || {})[nid] = 1;
    B.state.stat.tree = (B.state.stat.tree | 0) + 1;
    invalidate();
    B.log(BS.i18n.fill('点亮：# · #（#），花 # 光', BS.i18n.term(nd.branch),
      BS.i18n.tell(nd.nm), BS.i18n.tell(nd.say), U.big(nd.cost)), 'tree');
    B.emit('tree', { id: nid });
    B.save();
    return { ok: true, nd: nd };
  }

  /* ---------- 汇总所有已点亮节点的效果 ----------
     mods() 每秒被读很多次，所以缓存起来，点亮时才失效。 */
  var MODS = null;
  function invalidate() {
    MODS = null; NODE_CACHE = {}; TIER_CACHE = {};
    /* 元件带几条特质吃「性」这条脉络，而它由这棵树给。
       点亮一个节点，库里有些件会多带一条特质——所以元件缓存必须跟着清掉。
       形状与资质不跟着变：它们只由序号定，跟脉络无关。 */
    if (BS.rig) { BS.rig.forget(); BS.rig.invalidateEssence(); }
  }
  function mods() {
    if (MODS) return MODS;
    /* essence 数组的长度跟着 DEFS 走：从前写死七个 0，
       加一项指标那天就会静悄悄地把新的一项丢在数组外面。 */
    var ess = [], zi;
    for (zi = 0; zi < ESS7.length; zi++) ess.push(0);
    var out = {
      luxMult: 1, haste: 0, essence: ess, bid: 0, traitLuck: 0,
      undo: 0, autoRate: 0, autoPick: 0, peek: 0, peekN: 0, peekForms: 0, nodes: 0
    };
    var S = B.state, k, nd, e;
    for (k in (S.tree || {})) {
      nd = node(k);
      if (!nd) continue;
      out.nodes++;
      e = nd.eff;
      if (e.luxMult) out.luxMult *= (1 + e.luxMult);
      if (e.haste) out.haste += e.haste;
      if (e.essence != null) out.essence[Math.max(0, Math.min(out.essence.length - 1, e.essenceTier | 0))] += e.essence;
      if (e.bid) out.bid += e.bid;
      if (e.traitLuck) out.traitLuck += e.traitLuck;
      if (e.undo) out.undo += e.undo;
      if (e.autoRate) out.autoRate += e.autoRate;
      if (e.autoPick) out.autoPick = 1;
      if (e.peek) { out.peek = 1; out.peekN = Math.max(out.peekN, e.peekN | 0); }
      if (e.peekForms) out.peekForms = 1;
    }
    /* 上限：这些是概率与速度的口子，得夹住，不然树挖深了会变成无脑挂机 */
    out.haste = Math.min(0.85, out.haste);
    out.bid = Math.min(4.0, out.bid);
    out.traitLuck = Math.min(0.75, out.traitLuck);
    out.undo = Math.min(B.UNDOCAP, out.undo);
    out.luxMult = Math.min(200, out.luxMult);
    MODS = out;
    return out;
  }
  /* 本脉络点亮了几级 */
  function branchLevel(b) {
    var S = B.state, k, p, n = 0;
    for (k in (S.tree || {})) { p = parse(k); if (p && p.b === b) n++; }
    return n;
  }
  function spent() {
    var S = B.state, k, nd, sum = 0;
    for (k in (S.tree || {})) { nd = node(k); if (nd) sum += nd.cost; }
    return sum;
  }

  BS.tree = {
    BRANCHES: BRANCHES, BR: BR, COST_GROW: COST_GROW,
    tierOf: tierOf, tiers: tiers, depth: depth, node: node, parse: parse,
    bought: bought, canBuy: canBuy, blocked: blocked, buy: buy,
    mods: mods, invalidate: invalidate, branchLevel: branchLevel, spent: spent,
    maxBoughtTier: maxBoughtTier
  };
  B.on('restore', invalidate);
})(window.BS);
