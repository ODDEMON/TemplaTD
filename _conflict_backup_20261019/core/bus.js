<<<<<<< HEAD
/* core/bus.js —— 进度总线与存档。
   ------------------------------------------------------------------
   三种资源，各管一摊（本版的根本决策）：
    · **采集尘**——原件获取资源：抽新元件的唯一门票。来源：战斗结算、
      花园的被动产出（随时间滴答）、成就。
    · **结晶**——局外成长资源：升级商店的唯一门票（预算 / 战斗尘 / 抽取费 / 权重…）。
      来源：战斗结算按波数计、成就。
    · **辉光**——战斗所需资源：局内货币，击杀掉落，休整期升级塔，不跨局。
   跨局持久化：资源、库存（inv）、花园（garden）、军械库（armory）及其
   提交流水（armoryLog）、工坊图纸（shop）、元件成就（meta）、
   当前一局（run）、记录（log）。

   注意 armory 与 armoryLog 是**两回事**：
     · armory     —— 现在还在库里的炮塔。淘汰会被删掉，所以它只减不增。
     · armoryLog  —— 提交进化的**流水**。只增不减、淘汰也不擦，
                     它才是「这东西我做过」的完整底账。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var KEY = 'templatd_v3';
  var LOGCAP = 2000;         /* 记录留最近这么多条，免得存档撑爆 */
  var RUNS_CAP = 50;         /* 战绩摘要留最近这么多局 */
  var ARMORY_LOG_CAP = 400;  /* 提交流水留最近这么多座——它是底账，不是垃圾桶 */

  function blank() {
    return {
      v: 3, at: 0,
      t0: 0,                                  /* 第一次打开这个存档的时刻（只作纪念） */
      seq: 0,                                 /* 动手的次序计数：只增不减 */
      dust: 0,                                /* 尘：原件获取资源 */
      crystal: 0,                             /* 晶：局外成长资源 */
      inv: [],                                /* 库存：手里的元件序号（可重复） */
      garden: null,                           /* 花园板（garden.js 维护）：null = 空园。
                                                  lv 是园子的层数，只增不减 */
      meta: {                                 /* 局外成长：元件成就与达成情况 */
        unlocked: {},                         /* 成就 id -> 达成时的 seq */
        upgrades: {},                         /* 升级 id -> 已购层数 */
        formsUsed: {},                        /* 型 id -> 建成过几次 */
        bestEs: 0,                            /* 单件图形质变度的历史最高 */
        maxSym: 0,                            /* 单件图形对称度的历史最高 */
        maxGarEs: 0,                          /* 花园里种下的图形质变度历史最高 */
        chainKills: 0,                        /* 单场连锁塔击杀的历史最高 */
        draws: 0,                             /* 累计抽取次数 */
        wins: 0, runs: 0,                     /* runs 是**总局数**，一个数字 */
        history: [],                          /* 战绩摘要数组（最近 RUNS_CAP 局）——别和 runs 混 */
        best: { waves: 0, baseHp: 0 },        /* 历史最好一局：打到第几波、剩多少基地生命 */
        /* 局外成长的第二本账：**阅历**。它只喂重塑树，与结晶分工——
           结晶买旋钮（数值），阅历登记节点（可能性）。两本账各管一摊。 */
        exp: 0,
        shaped: {},                           /* 重塑树：节点 id -> 登记时的 seq */
        rallies: 0,                           /* 重整过几次（玩家自己按了几次） */
        lastCond: []                          /* 上一局勾的战况：开新局时默认沿用 */
      },
      run: null,                              /* 当前一局（run.js 维护）：null = 不在局中 */
      armory: [],                             /* 军械库：现在还在库里的炮塔（shop.js 维护） */
      armoryLog: [],                          /* 提交流水：只增不减，淘汰也不擦（shop.js 维护） */
      armorySeq: 0,                           /* 进化体编号：只增不减 */
      shop: null,                             /* 工坊图纸（shop.js 维护）：null = 空图 */
=======
/* core/bus.js —— 进度、事件总线、存档。
   这一版开始有资源了：光是唯一的货币，靠质变指标挣，花在脉络上。
   存档里什么都有；但一次上交就是一局的终局——能跨过上交的
   只有光与点亮的脉络，其余（库、图纸、记录、判定、命题、陈列、统计）
   一律从零再来。设置与存档的生辰不算局内内容。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  /* KEY 是存档占的槽位，名字里的 v7 是历史遗留——槽位不换，
     换的是里面的 v（结构版本）。这样升级时不至于把看的人攒下的光与脉络一起丢掉。 */
  var KEY = 'configura_v7';
  var LOGCAP = 5000;         /* 记录留最近这么多条，免得存档撑爆 */
  var UNDOCAP = 40;          /* 撤销栈的硬上限；实际能撤几步由脉络给 */
  var GALCAP = 8;            /* 陈列留最近这么多具：够你回头看，又不至于把存档撑爆 */

  function blank() {
    return {
      v: 8, at: 0,
      t0: 0,                                  /* 第一次打开这个存档的时刻（只作纪念，不再计时） */
      clock: 0,                               /* 页面开着的总秒数：库只在它走的时候落件 */
      body: null,
      gone: {},                               /* 已经不在这局里的自然件序号：弃掉的、或者拍出去的 */
      seq: 0,                                 /* 动手的次序计数：只增不减 */
      lux: 0,                                 /* 光：当前持有的 */
      luxTotal: 0,                            /* 光：这辈子一共挣到过多少 */
      tree: {},                               /* 点亮的脉络节点：id -> 1 */
      ach: {},                                /* 点亮的判定：id -> 点亮时的 seq */
      quest: null,                            /* 命题进度（quests.js 自己维护） */
      undo: [],                               /* 撤销栈：最近若干步的反向操作 */
      auc: { n: 0, total: 0, best: 0, cells: 0 },   /* 成交记录 */
      gal: [],                                /* 陈列：交出去的每一具，缩略图与数据都留着 */
      bidTier: 0,                             /* 估价跨到过第几个十倍档（用来报里程碑） */
      workOn: 0,                              /* 这一稿有没有报过「够得上作品了」 */
      stat: { placed: 0, removed: 0, moved: 0, spun: 0, recycled: 0, undone: 0, best: 0, quests: 0, achs: 0, sold: 0, soldCells: 0 },
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
      log: [],                                /* 记录 */
      prefs: { hint: 1, ticker: 1, calm: 0, lang: 'zh' }
    };
  }
  var state = blank();

  /* 起手礼包：全新存档送三枚常档元件（用户决策：初始 3~8 个，随成长扩容）。
     序号取池子最前的三枚——同一存档永远是同样三枚，可复现。
     写 BS.bus.state 而不是闭包里的 state：测试会整体替换 state 对象。 */
  function startKit() {
    BS.bus.state.inv = [0, 1, 2];
    BS.bus.state.dust = 60;     /* 够抽两发，尝一口抽卡的滋味 */
    BS.bus.state.crystal = 0;
  }

  function norm(o) {
    var b = blank(), k, dp = blank().prefs, dm = blank().meta;
    for (k in b) if (o[k] != null) b[k] = o[k];
    if (!b.meta || typeof b.meta !== 'object') b.meta = blank().meta;
    for (k in dm) if (b.meta[k] == null) b.meta[k] = dm[k];
    if (!b.meta.unlocked || typeof b.meta.unlocked !== 'object') b.meta.unlocked = {};
    if (!b.meta.formsUsed || typeof b.meta.formsUsed !== 'object') b.meta.formsUsed = {};
    /* 重塑树同理：老存档没有这一栏，补一个空的对象——
       「一棵没点过的树」与「没有这棵树」必须是同一件事。 */
    if (!b.meta.shaped || typeof b.meta.shaped !== 'object') b.meta.shaped = {};
    if (!(b.meta.exp >= 0)) b.meta.exp = 0;
    if (!(b.meta.rallies >= 0)) b.meta.rallies = 0;
    if (!Array.isArray(b.meta.lastCond)) b.meta.lastCond = [];
    if (!Array.isArray(b.meta.history)) b.meta.history = [];
    if (b.meta.history.length > RUNS_CAP) b.meta.history = b.meta.history.slice(0, RUNS_CAP);
    if (!(b.meta.runs >= 0)) b.meta.runs = 0;   /* 计数，不是数组 */
    if (!(b.meta.wins >= 0)) b.meta.wins = 0;
    if (!Array.isArray(b.log)) b.log = [];
    if (b.log.length > LOGCAP) b.log = b.log.slice(b.log.length - LOGCAP);
    if (!b.prefs || typeof b.prefs !== 'object') b.prefs = dp;
    for (k in dp) if (b.prefs[k] == null) b.prefs[k] = dp[k];
    if (!(b.seq >= 0)) b.seq = 0;
    if (!(b.t0 > 0)) b.t0 = Date.now();
<<<<<<< HEAD
    if (!(b.dust >= 0)) b.dust = 0;
    if (!(b.crystal >= 0)) b.crystal = 0;
    if (!Array.isArray(b.inv)) b.inv = [];
    if (!b.garden || typeof b.garden !== 'object' || !b.garden.cells) b.garden = null;
    /* 花园层数：老存档没有这一栏。按已种格数补一份，别让园子缩回去。
       garden.js 的 grow() 是单调的，所以补一次之后只会继续往上长。 */
    if (b.garden && !(b.garden.lv > 0)) {
      b.garden.lv = Math.floor(Object.keys(b.garden.cells).length / 16);
    }
    if (!b.meta.upgrades || typeof b.meta.upgrades !== 'object') b.meta.upgrades = {};
    if (!(b.meta.draws >= 0)) b.meta.draws = 0;
    if (!(b.meta.maxGarEs >= 0)) b.meta.maxGarEs = 0;
    if (!Array.isArray(b.armory)) b.armory = [];
    /* 流水只增不减。**判「缺栏」要判在原始存档 o 上，不能判在 b 上**——
       blank() 已经给了 b.armoryLog 一个空数组，若拿 b 去判，
       Array.isArray 永远是 true，补偿分支一次都进不来（这个坑当场踩过一次）。
       老存档的补偿：把已经在库的塔补进流水，别让底账凭空少一截。 */
    if (!Array.isArray(o.armoryLog)) {
      b.armoryLog = b.armory.slice();
    } else if (!Array.isArray(b.armoryLog)) {
      b.armoryLog = [];
    }
    if (b.armoryLog.length > ARMORY_LOG_CAP) {
      b.armoryLog = b.armoryLog.slice(b.armoryLog.length - ARMORY_LOG_CAP);
    }
    /* 底线：在库的每一座都必须在流水里有对应的一条。
       理论上不该缺，但存档可能被人手改过——补上比崩掉好。 */
    var seen = {}, qi;
    for (qi = 0; qi < b.armoryLog.length; qi++) seen[b.armoryLog[qi].id] = 1;
    for (qi = 0; qi < b.armory.length; qi++) {
      if (!seen[b.armory[qi].id]) { b.armoryLog.push(b.armory[qi]); seen[b.armory[qi].id] = 1; }
    }
    if (!(b.armorySeq >= 0)) b.armorySeq = b.armory.length;
    if (!b.shop || typeof b.shop !== 'object' || !b.shop.cells) b.shop = null;
    /* run 的合法性由 run.js 自己校验（phase 必须在它认识的那几个里） */
    if (b.run != null && typeof b.run !== 'object') b.run = null;
=======
    if (!(b.clock >= 0) || !isFinite(b.clock)) b.clock = 0;
    if (!(b.lux >= 0) || !isFinite(b.lux)) b.lux = 0;
    if (!(b.luxTotal >= 0) || !isFinite(b.luxTotal)) b.luxTotal = b.lux;
    if (!b.auc || typeof b.auc !== 'object') b.auc = blank().auc;
    if (!Array.isArray(b.gal)) b.gal = [];
    if (b.gal.length > GALCAP) b.gal = b.gal.slice(0, GALCAP);
    if (!(b.bidTier >= 0)) b.bidTier = 0;
    /* 元件的形状在这一版整个换了一套生成机制，字形表也换过一次。
       旧存档里那具图形是按旧形状排的，留着它，旋转与平移就会按新形状
       去算——那样图会散。所以旧档进来，图纸清空重开；
       光、脉络、判定、命题一样都不动。 */
    if (!(o.v >= 8)) b.body = { cells: {} };
    b.chaos = undefined;
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    return b;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { startKit(); save(); return false; }
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') { startKit(); save(); return false; }
      var b = norm(o), k;
      for (k in b) state[k] = b[k];
      return true;
    } catch (e) { startKit(); save(); return false; }
  }
  function save() {
    state.at = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 由它去 */ }
  }
  function wipe() {
    var p = state.prefs, s = blank(), k;
    for (k in s) state[k] = s[k];
    state.prefs = p;
    state.t0 = Date.now();
    startKit();
    save();
    emit('wipe');
  }

  var H = {};
  /* 订阅返回一个**退订函数**——子界面切走时必须能把自己摘干净，
     否则离场的页面还在监听总线、还在重画（那是这一版上一次翻车的根因）。 */
  function on(ev, fn) {
    (H[ev] = H[ev] || []).push(fn);
    var dead = false;
    return function () { if (dead) return; dead = true; off(ev, fn); };
  }
  function off(ev, fn) { var a = H[ev]; if (!a) return; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  function emit(ev, d) {
    var a = H[ev]; if (!a) return;
    for (var i = 0; i < a.length; i++) { try { a[i](d); } catch (e) { /* 由它去 */ } }
  }
  /* 记录一条。封顶在 LOGCAP：留最近的。 */
  function log(msg, kind) {
    state.seq = (state.seq | 0) + 1;
    var e = { n: state.seq, k: kind || '', m: String(msg) };
    state.log.push(e);
    if (state.log.length > LOGCAP) state.log.splice(0, state.log.length - LOGCAP);
    emit('log', e);
    return e;
  }

<<<<<<< HEAD
  /* 战绩摘要：图鉴页从这里取。存 meta.history，不碰 meta.runs（那是局数计数）。 */
  function pushRun(r) {
    var h = state.meta.history || (state.meta.history = []);
    h.unshift(r);
    if (h.length > RUNS_CAP) h.length = RUNS_CAP;
  }

  function dump() { return JSON.stringify({ sig: 'TEMPLATD', v: 1, at: new Date().toISOString(), s: state }); }
=======
  function dump() { return JSON.stringify({ sig: 'CONFIGURA', v: 8, at: new Date().toISOString(), s: state }); }
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  function encode() { var t = dump(); try { return btoa(unescape(encodeURIComponent(t))); } catch (e) { return t; } }
  function decode(txt) {
    var t = String(txt || '').trim();
    if (!t) return '';
    if (t.charAt(0) === '{') return t;
    try { return decodeURIComponent(escape(atob(t.replace(/\s+/g, '')))); } catch (e) { return ''; }
  }
  function restore(txt) {
    var raw = decode(txt);
    if (!raw) return { ok: false, why: BS.i18n.get('读不出内容') };
    var pack;
    try { pack = JSON.parse(raw); } catch (e) { return { ok: false, why: BS.i18n.get('不是存档') }; }
    if (!pack || pack.sig !== 'TEMPLATD') return { ok: false, why: BS.i18n.get('签名不符') };
    var o = pack.s;
    if (!o || typeof o !== 'object') return { ok: false, why: BS.i18n.get('其中没有进度') };
    var b = norm(o), k;
    for (k in b) state[k] = b[k];
    save();
    emit('restore');
    return { ok: true, at: pack.at || '' };
  }

  BS.bus = {
<<<<<<< HEAD
    KEY: KEY, LOGCAP: LOGCAP, RUNS_CAP: RUNS_CAP, ARMORY_LOG_CAP: ARMORY_LOG_CAP,
    state: state, blank: blank, norm: norm,
    startKit: startKit,
    load: load, save: save, wipe: wipe, on: on, off: off, emit: emit, log: log, pushRun: pushRun,
=======
    KEY: KEY, LOGCAP: LOGCAP, UNDOCAP: UNDOCAP, GALCAP: GALCAP, state: state, blank: blank, norm: norm,
    load: load, save: save, wipe: wipe, on: on, off: off, emit: emit, log: log,
    gain: gain, spend: spend, can: can,
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    dump: dump, encode: encode, decode: decode, restore: restore
  };
})(window.BS);
