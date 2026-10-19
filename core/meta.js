/* core/meta.js —— 局外成长：成就判定、升级购买、跨局读数。
   ------------------------------------------------------------------
   成就只盯图形数据与部署事实；升级商店花结晶。表在 world/meta.js。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var DEFS = function () { return BS.metaDefs; };
  var I = BS.i18n;      /* 取词：成就的「还差什么」全是带数字的句子，走 fill 模板 */

  function isUnlocked(id) { return !!(BS.bus.state.meta.unlocked || {})[id]; }
  function upLv(id) { return (BS.bus.state.meta.upgrades || {})[id] | 0; }

  /* ---------- 升级：晶在这里花 ---------- */
  function upCost(id) {
    var u = DEFS().UPG_BY[id];
    if (!u) return 0;
    return u.cost(upLv(id));
  }
  function buy(id) {
    var u = DEFS().UPG_BY[id];
    if (!u) return { ok: false, why: BS.i18n.get('没有这一条升级') };
    var lv = upLv(id);
    if (lv >= u.max) return { ok: false, why: BS.i18n.get('已经到顶了') };
    var c = u.cost(lv);
    if (BS.bus.state.crystal < c) return { ok: false, why: BS.i18n.get('结晶不够：要 # 颗').replace('#', c) };
    BS.bus.state.crystal -= c;
    BS.bus.state.meta.upgrades[id] = lv + 1;
    BS.bus.save();
    /* 升级名走 I.term(u)：它是表项（带 en），贴进日志里也得跟着语言走——
       直接拼 u.t 会让英文界面的日志里冒出中文升级名。 */
    BS.bus.log(BS.i18n.fill('# 升到 # 级', BS.i18n.term(u), lv + 1), 'sys');
    BS.bus.emit('gain');
    return { ok: true, lv: lv + 1, cost: c };
  }

  /* ---------- 结算一局：更新跨局记录，判定新解锁 ---------- */
  function scan(c) {
    var st = BS.bus.state.meta, out = [];
    var list = DEFS().LIST, i;
    for (i = 0; i < list.length; i++) {
      if (st.unlocked[list[i].id]) continue;
      if (list[i].ok(c)) {
        /* +1：seq 从 0 起，而 0 是 falsy——存 0 会让「已解锁」的判读全线失效 */
        st.unlocked[list[i].id] = (BS.bus.state.seq | 0) + 1;
        out.push(list[i].id);
      }
    }
    return out;
  }

  /* 「还差什么」：界面逐条列，不把「差一点」说成「快到了」。 */
  function progress(id, c) {
    switch (id) {
      /* 「还差什么」也是文案：它每一条都带数字，所以要走 fill 模板——
         直接拼字串等于把这条永远钉在中文上（英文界面会露出整行中文）。 */
      case 'M1': return c.won ? I.get('已达成') : I.fill('最好一次撑到第 # 波（目标：撑过第 10 波后撤离）', c.wave);
      case 'M2': return I.fill('炮塔的最高对称度 # / 0.80', c.maxSym.toFixed(2));
      case 'M3': return c.won && c.baseHp >= c.baseMax ? I.get('已达成')
        : I.fill('满基地生命撑过第 10 波（本局剩 #）', c.baseHp);
      case 'M4': return I.fill('连锁塔单场击杀 # / 50', c.chainKills);
      case 'M5': return I.fill('部署过的型 # / 10 种', c.formsUsed);
      case 'M6': return I.fill('单具图形质变度 # / 0.85', c.bestEs.toFixed(2));
      case 'M7': return I.fill('花园根 graphic 的最高质变度 # / 0.50', c.maxGarEs.toFixed(2));
      case 'M8': return I.fill('累计抽取 # / 20 次', c.draws);
      case 'M9': return I.fill('单局最好成绩第 # 波 / 15', c.bestWave);
    }
    return '';
  }

  /* ---------- 重塑树：阅历在这里登记 ----------
     与升级商店的分工：**结晶买数值，阅历登记可能性**。
     一本账只喂一棵树，谁也不越界——混了闸门，「这一局打成了什么样」
     就没法与「下次我能做什么」对上号。 */
  function isShaped(id) { return !!(BS.bus.state.meta.shaped || {})[id]; }
  function shapeCost(id) {
    var s = DEFS().SHAPE_BY[id];
    return s ? s.cost : 0;
  }
  /* 前置：一棵树只要能回答「先点哪个」。多前置会让玩家做拓扑排序，
     而那不是这一页该收的乐趣——所以 req 只有一个。 */
  function reqOk(id) {
    var s = DEFS().SHAPE_BY[id];
    if (!s || !s.req) return true;
    return isShaped(s.req);
  }
  function shape(id) {
    var s = DEFS().SHAPE_BY[id];
    if (!s) return { ok: false, why: BS.i18n.get('没有这一条重塑') };
    if (isShaped(id)) return { ok: false, why: BS.i18n.get('已经登记过了') };
    if (!reqOk(id)) {
      var pre = DEFS().SHAPE_BY[s.req];
      return { ok: false, why: BS.i18n.fill('先登记「#」', pre ? pre.t : s.req) };
    }
    var c = s.cost, now = BS.bus.state.meta.exp | 0;
    if (now < c) {
      return { ok: false, why: BS.i18n.fill('阅历不够：要 # 点，还差 # 点', c, c - now) };
    }
    BS.bus.state.meta.exp = now - c;
    BS.bus.state.meta.shaped[id] = (BS.bus.state.seq | 0) + 1;
    BS.bus.save();
    BS.bus.log(BS.i18n.fill('登记重塑：#', BS.i18n.term(s)), 'sys');
    BS.bus.emit('gain');
    BS.bus.emit('shape');
    return { ok: true, cost: c };
  }
  function shapedCount() {
    var m = BS.bus.state.meta.shaped || {}, n = 0, k;
    for (k in m) if (m[k]) n++;
    return n;
  }

  /* ---------- 阅历：一局记下多少，逐条列出来 ----------
     **登记**这两个字的意思是「你能指出这一笔从哪来」。
     不给明细的成长点数只是一个进度条——玩家不知道自己该再多撑一波
     还是该早点撤，于是这个数字教不会任何人任何事。 */
  function expOf(c) {
    var E = DEFS().EXP, mm = DEFS().mods(BS.bus.state.meta);
    var wave = Math.max(0, c.wave | 0), kills = Math.max(0, c.kills | 0);
    var perWave = Math.round(wave * E.PER_WAVE);
    var deep = Math.round(Math.pow(wave, E.DEPTH_POW) * E.DEPTH_MUL);
    var perKill = Math.round(kills * E.PER_KILL);
    var won = c.won ? E.WON : 0;
    var mul = c.mul == null ? 1 : c.mul;               /* 战况倍率 */
    var pct = 1 + (mm.expPct | 0) / 100;
    var lostR = c.lost ? E.LOST_RATE : 1;
    var raw = perWave + deep + perKill + won;
    var total = Math.max(1, Math.round(raw * mul * pct * lostR));
    return {
      total: total, raw: raw, mul: mul, pct: pct, lostR: lostR,
      lines: [
        { k: '波数', v: perWave },
        { k: '深水', v: deep },
        { k: '击杀', v: perKill },
        { k: '撤离犒赏', v: won },
        { k: '战况', v: null, mul: mul },
        { k: '失守', v: null, mul: lostR }
      ],
      n: { wave: wave, kills: kills, won: won }
    };
  }
  /* 把一笔阅历入账。返回明细，结算页照着它逐行写。 */
  function addExp(c) {
    var e = expOf(c);
    BS.bus.state.meta.exp = (BS.bus.state.meta.exp | 0) + e.total;
    return e;
  }

  /* ---------- 重整：玩家自己按的那一键 ----------
     **困住不由机器判定**。上一版由 `stuck()` 去认「没件 + 没塔 + 尘不够」
     那一个死结形状——那是**机器替玩家下判断**：认得出的还罢，认不出的
     那些局面（手里还剩一堆拼不出东西的废件、或者塔都在但你已经不想
     再这样打下去了）它一声不吭，而玩家其实早就不想打了。
     要不要重来是**玩家的判断**，不是存档的形状。所以这一键常驻，
     什么时候按由人决定；界面只负责把代价与回报写清楚。

     按下之后**先结算这一局**：进行中的那一局按它现在走到第几波入账，
     再清局面。旧版是直接丢弃——打了一半按重置，那一半就白打了；
     现在它照样进阅历、进战绩、进两样资源，「这一局打到第 11 波」
     仍然作数。口径跟着**当前状态**走，不给额外的便宜：
       · 在休整期按 —— 与「撤离」同口径（全额 + 剩余基地折算）
       · 在交战中按 —— 与「失守」同口径（打折、无折算、阅历减半）
     交战中按不该比守到休整期更划算，否则「打到一半按重置」
     就成了躲掉失守的捷径——那会把撤离这个决定重新变成假的。

     **清掉的是局面，不是履历**。库存、军械库、图纸、花园、这一局与两样
     资源全部归零，阅历 / 重塑登记 / 成就 / 升级线一笔不动——
     履历留下了，「上一次我走到第几步」就还值钱。
     配给按**已登记的节点数**发，而且只作**保底**：刚结算那一局落袋的比
     配给多就留多的，比配给少就把你抬到配给线。这是把「成长点数」
     兑现成「下一次开局的手感」的唯一一处，也是它的意义。 */
  function rallyKit() {
    var m = BS.bus.state.meta, mm = DEFS().mods(m);
    var n = shapedCount(), mul = 1 + (mm.kitPct | 0) / 100;
    return {
      nodes: n,
      dust: Math.round((80 + 30 * n) * mul),
      crystal: Math.round((40 + 12 * n) * mul)
    };
  }
  function rally() {
    var s = BS.bus.state, kit = rallyKit();
    var settled = null;
    var r = BS.run ? BS.run.current() : null;
    /* wave 从 0 起、beginWave 里才 ++，所以 >= 1 就是「真的打过至少一波」。
       一局没开打就按重置，那是丢弃不是结算——不该往战绩里塞一条第 0 波。 */
    if (r && r.phase !== 'over' && r.battle && (r.battle.wave | 0) >= 1) {
      settled = BS.run.settle(r, r.phase === 'rest');
    }
    s.inv = [];
    s.armory = [];            /* 流水（armoryLog）不动——它只增不减，是底账 */
    s.shop = null;
    s.garden = null;
    s.run = null;
    s.dust = Math.max(s.dust | 0, kit.dust);
    s.crystal = Math.max(s.crystal | 0, kit.crystal);
    s.meta.rallies = (s.meta.rallies | 0) + 1;
    BS.bus.save();
    BS.bus.log(settled
      ? BS.i18n.fill('重整：第 # 波按#结算入账，局面清空，配给 # 采集尘与 # 结晶',
        settled.over.wave, settled.lost ? BS.i18n.get('失守') : BS.i18n.get('撤离'),
        kit.dust, kit.crystal)
      : BS.i18n.fill('重整：局面清空，配给 # 采集尘与 # 结晶', kit.dust, kit.crystal), 'sys');
    BS.bus.emit('rally');
    BS.bus.emit('inv');
    BS.bus.emit('armory');
    BS.bus.emit('run');
    BS.bus.emit('gain');
    return {
      ok: true, dust: s.dust, crystal: s.crystal, nodes: kit.nodes,
      kit: kit, settled: settled
    };
  }

  /* 当前跨局读数（成就页与库页都要显示） */
  function readings() {
    var m = BS.bus.state.meta;
    return {
      wins: m.wins | 0, runs: m.runs | 0,
      bestWaves: m.best.waves | 0, bestHp: m.best.baseHp | 0,
      bestEs: m.bestEs | 0, maxSym: m.maxSym | 0,
      maxGarEs: m.maxGarEs | 0, draws: m.draws | 0,
      chainKills: m.chainKills | 0,
      forms: Object.keys(m.formsUsed || {}).length,
      unlocked: Object.keys(m.unlocked || {}).length,
      total: DEFS().LIST.length,
      exp: m.exp | 0, shaped: shapedCount(), shapeTotal: DEFS().SHAPING.length,
      rallies: m.rallies | 0
    };
  }

  BS.meta = {
    isUnlocked: isUnlocked, upLv: upLv, upCost: upCost, buy: buy,
    scan: scan, progress: progress, readings: readings,
    isShaped: isShaped, shapeCost: shapeCost, reqOk: reqOk, shape: shape,
    shapedCount: shapedCount,
    expOf: expOf, addExp: addExp,
    rally: rally, rallyKit: rallyKit
  };
})(window.BS);
