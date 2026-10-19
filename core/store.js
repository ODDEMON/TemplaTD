/* core/store.js —— 库：抽卡与库存。
   ------------------------------------------------------------------
   本版的根本决策：元件不再是一张人人可查的目录——**图形库删掉了**。
   元件以抽卡的模式获取（照搬 CONFIGURA「上游落件」的随机性）：
   花尘抽一发，稀有度按五档权重落，抽到什么全凭手气；
   **库无上限**——抽卡不再被「满库」卡住，元件爱攒多少攒多少。
   库存是**多重集合**：同一序号允许攒多枚——攒同件也是攒。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var P = BS.parts;

  var DRAW_COST = 25;        /* 单抽的基础价（采集尘） */

  /* ---------- 库存：序号的多重集合 ---------- */
  function inv() { return BS.bus.state.inv; }
  function count() { return inv().length; }
  /* 库无上限：永远不挡抽卡。保留 cap() 仅供界面展示用。 */
  function cap() { return Infinity; }
  function full() { return false; }
  function has(i, n) {
    var c = 0, k;
    n = n || 1;
    for (k = 0; k < inv().length; k++) if (inv()[k] === i) c++;
    return c >= n;
  }
  function give(i) {
    inv().push(i | 0);
    BS.bus.save();
    BS.bus.emit('inv');
  }
  /* 取走一枚：从后往前找，保住先入手的那些排前面 */
  function takeOne(i) {
    var a = inv(), k;
    for (k = a.length - 1; k >= 0; k--) {
      if (a[k] === i) { a.splice(k, 1); BS.bus.save(); BS.bus.emit('inv'); return true; }
    }
    return false;
  }
  function takeAny() {
    var a = inv();
    if (!a.length) return -1;
    var i = a.pop();
    BS.bus.save();
    BS.bus.emit('inv');
    return i;
  }
  function discard(i) {
    return takeOne(i) ? { ok: true } : { ok: false, why: BS.i18n.get('库里没有这一件') };
  }

  /* ---------- 抽卡：尘换随机元件 ---------- */
  /* 抽取折扣：只来自升级商店的「抽取议价」。
     花园旧版给过折扣与高档权重——本版起花园只管战斗面，
     抽卡的运气归升级与成就管，两套系统不再互相伸手。 */
  function drawCost() {
    var disc = BS.metaDefs.mods(BS.bus.state.meta).drawDisc | 0;
    return Math.max(5, Math.round(DRAW_COST * (1 - disc / 100)));
  }
  /* 稀有度权重：五档基础权重，成就与「高档权重」升级抬高档位。
     **先算权重、再掷骰**——界面上的概率条与实际抽取读的是同一份权重，
     所以显示的百分比永远不会骗人。改这里，两处一起变。 */
  function weights() {
    var w = [0.500, 0.290, 0.145, 0.052, 0.013], m;
    m = BS.metaDefs.mods(BS.bus.state.meta);
    if (m.rarBoost) {
      if (m.rarBoost[3]) w[3] *= m.rarBoost[3];
      if (m.rarBoost[4]) w[4] *= m.rarBoost[4];
    }
    return w;
  }
  /* 概率显示：权重归一到 0..1 的数组，外加基础档的参照值。
     base 永远不会变，用来告诉玩家「你抬了多少」——两个数字并列，
     玩家自己就能看出哪一档被改动过。 */
  function odds() {
    var BASE = [0.500, 0.290, 0.145, 0.052, 0.013];
    var w = weights(), tot = 0, p = [], i;
    for (i = 0; i < 5; i++) tot += w[i];
    if (!(tot > 0)) tot = 1;
    for (i = 0; i < 5; i++) p.push(w[i] / tot);
    var bt = 0;
    for (i = 0; i < 5; i++) bt += BASE[i];
    var base = [];
    for (i = 0; i < 5; i++) base.push(BASE[i] / bt);
    return { p: p, base: base, weights: w };
  }
  function rollRarity() {
    var w = weights(), tot = 0, k;
    for (k = 0; k < 5; k++) tot += w[k];
    var u = Math.random() * tot;
    for (k = 0; k < 5; k++) { u -= w[k]; if (u <= 0) return k; }
    return 0;
  }
  function rollSerial(rar) {
    var pool = P.pool(), tries = 0, i;
    do {
      i = Math.floor(Math.random() * Math.min(pool, 4096));
      tries++;
    } while (P.shapeOf(i).rar !== rar && tries < 80);
    return i;
  }
  /* 抽 n 发：库无上限，尘够就抽得到——再不被「满库」卡住。
     返回 { ok, got:[{i,rar}], cost } 或 { ok:false, why }。 */
  function draw(n) {
    n = Math.max(1, n | 0);
    var cost = drawCost() * n;
    if (BS.bus.state.dust < cost) return { ok: false, why: BS.i18n.get('采集尘不够：抽取要 # 采集尘').replace('#', cost) };
    var got = [], k;
    for (k = 0; k < n; k++) {
      var rar = rollRarity();
      var i = rollSerial(rar);
      inv().push(i);
      got.push({ i: i, rar: rar });
    }
    BS.bus.state.dust -= cost;
    BS.bus.state.meta.draws = (BS.bus.state.meta.draws | 0) + n;
    BS.bus.save();
    var names = got.map(function (g2) { return P.serialOf(g2.i); }).join('、');
    BS.bus.log(BS.i18n.fill('抽了 # 发：#', n, names), 'sys');
    BS.bus.emit('inv');
    BS.bus.emit('gain');
    return { ok: true, got: got, cost: cost };
  }

  BS.store = {
    DRAW_COST: DRAW_COST,
    inv: inv, count: count, cap: cap, full: full, has: has,
    give: give, takeOne: takeOne, takeAny: takeAny, discard: discard,
    drawCost: drawCost, weights: weights, odds: odds, draw: draw
  };
})(window.BS);
