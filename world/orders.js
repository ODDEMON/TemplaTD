/* world/orders.js —— 战备指令：波与波之间的三选一。
   ------------------------------------------------------------------
   旧版的休整期只有一个二选一（下一波 / 撤离），于是「运营」这件事
   在整局里只发生过一次。现在每打完一波，桌上摊开三张指令，
   选一张——**每一张都有得有付**，没有白给的选项。

   为什么「有付」是硬要求：只有得没有付，三选一就退化成「挑最大的那个」，
   选与不选的差别只有数值大小。有了付，**这一局正在变成什么**才是个问题：
   加固拿基地生命、付下一波敌血；押运拿报酬、付敌人加速；潜伏拿减速、
   付报酬。你不是在选加成，是在选这一局往哪边长。

   对标：《明日方舟》集成战略的**节点分支**——每一层走哪条路，
   决定这一局的资源形状。这里把地图折成三张卡，因为塔防没有地图可走。

   now(r, b) 是**立即**兑现的那一半（加辉光、加基地生命、加容机）；
   mods 是**下一波**才生效的那一半（敌血 / 敌速 / 敌数 / 报酬 / 塔等级）。
   两半分开写，界面才能把「马上到手」与「下一波付账」分成两行说。

   tier 1 的四条是高级指令，由重塑树的「高级指令」解锁——
   局外成长打开的是**新选项**，不是更大的数字。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  var LIST = [
    /* ---- tier 0：起手就在池子里 ---- */
    { id: 'fortify', t: '加固', en: 'FORTIFY', tier: 0,
      give: { t: '基地生命 +2', en: '+2 base HP' },
      pay: { t: '下一波敌人生命 ×1.10', en: 'Next wave enemy HP ×1.10' },
      mods: { hpMul: 1.10 },
      now: function (r, b) {
        /* 上限要扣掉战况砍掉的那一截——「渗血 −5」之后再加固，
           不该把基地灌回 15。这里自己算，不去问 run（这张表不该认识它）。 */
        var cut = 0, ids = r.cond || [], i, c;
        for (i = 0; i < ids.length; i++) {
          c = BS.cond.BY[ids[i]];
          if (c && c.mods && c.mods.baseHpCut) cut += c.mods.baseHpCut;
        }
        b.baseHp = Math.min(BS.td.BASE_HP - cut, b.baseHp + 2);
      } },

    { id: 'recruit', t: '征募', en: 'RECRUIT', tier: 0,
      give: { t: '辉光 +45（每多一波再 +9）', en: '+45 lux (+9 per wave reached)' },
      pay: { t: '下一波敌人数量 ×1.30', en: 'Next wave enemy count ×1.30' },
      mods: { countMul: 1.30 },
      now: function (r, b) { b.lux = (b.lux | 0) + 45 + 9 * (b.wave | 0); } },

    { id: 'calibrate', t: '校准', en: 'CALIBRATE', tier: 0,
      give: { t: '下一波全部塔伤害 ×1.20', en: 'Next wave: all tower damage ×1.20' },
      pay: { t: '下一波辉光掉落 ×0.75', en: 'Next wave: lux drops ×0.75' },
      mods: { dmgMul: 1.20, luxMul: 0.75 } },

    { id: 'scout', t: '侦察', en: 'SCOUT', tier: 0,
      give: { t: '看见后面两波 · 辉光 +20', en: 'See the next two waves · +20 lux' },
      pay: { t: '下一波敌人速度 ×1.12', en: 'Next wave enemy speed ×1.12' },
      mods: { spdMul: 1.12 },
      now: function (r, b) { b.lux = (b.lux | 0) + 20; r.peek = 2; } },

    { id: 'hold', t: '潜伏', en: 'HOLD', tier: 0,
      give: { t: '下一波敌人速度 ×0.82', en: 'Next wave enemy speed ×0.82' },
      pay: { t: '下一波辉光掉落 ×0.85', en: 'Next wave: lux drops ×0.85' },
      mods: { spdMul: 0.82, luxMul: 0.85 } },

    { id: 'trim', t: '精简', en: 'TRIM', tier: 0,
      give: { t: '本休整期撤收回扣提到八成', en: 'Sell refund raised to 80% this rest' },
      pay: { t: '下一波敌人生命 ×1.08', en: 'Next wave enemy HP ×1.08' },
      mods: { sellRate: 0.80, hpMul: 1.08 } },

    /* ---- tier 1：高级指令（重塑树解锁） ---- */
    { id: 'convoy', t: '押运', en: 'CONVOY', tier: 1,
      give: { t: '下一波辉光掉落 ×1.40', en: 'Next wave: lux drops ×1.40' },
      pay: { t: '下一波敌人速度 ×1.15', en: 'Next wave enemy speed ×1.15' },
      mods: { luxMul: 1.40, spdMul: 1.15 } },

    { id: 'oversee', t: '督战', en: 'OVERSEE', tier: 1,
      give: { t: '下一波全部塔按 +1 级计伤害', en: 'Next wave: all towers count as +1 level' },
      pay: { t: '下一波敌人数量 ×1.20 · 辉光 ×0.85', en: 'Next wave: enemy count ×1.20 · lux ×0.85' },
      mods: { levelAdd: 1, countMul: 1.20, luxMul: 0.85 } },

    { id: 'expand', t: '扩编', en: 'EXPAND', tier: 1,
      give: { t: '本局容机上限 +1（立刻生效）', en: '+1 hangar slot for this run' },
      pay: { t: '下一波敌人生命 ×1.12', en: 'Next wave enemy HP ×1.12' },
      mods: { hpMul: 1.12 },
      now: function (r) { r.garageBonus = (r.garageBonus | 0) + 1; } },

    { id: 'salvage', t: '清拆', en: 'SALVAGE', tier: 1,
      give: { t: '辉光 +30 · 撤收回扣提到九成', en: '+30 lux · sell refund raised to 90%' },
      pay: { t: '下一波敌人生命 ×1.10', en: 'Next wave enemy HP ×1.10' },
      mods: { sellRate: 0.90, hpMul: 1.10 },
      now: function (r, b) { b.lux = (b.lux | 0) + 30; } }
  ];
  var BY = {};
  (function () { var i; for (i = 0; i < LIST.length; i++) BY[LIST[i].id] = LIST[i]; })();

  /* 池子：tier 0 常在，tier 1 由重塑树的「高级指令」打开。 */
  function pool(adv) {
    var out = [], i;
    for (i = 0; i < LIST.length; i++) {
      if ((LIST[i].tier | 0) === 0 || adv) out.push(LIST[i]);
    }
    return out;
  }

  /* 掷 n 张：走**本局种子的子流**，所以同一局回到同一波永远是同样的三张。
     可复现这一条不能破——否则「重开一局刷一个好指令」就成了最优解。 */
  function offerN(seed, wave, n, adv) {
    var ps = pool(adv), out = [], i;
    var rnd = BS.seed.derive((seed | 0), 'ord' + (wave | 0));
    var bag = ps.slice();
    n = Math.min(n | 0 || 3, bag.length);
    for (i = 0; i < n; i++) {
      var k = Math.floor(rnd() * bag.length) % bag.length;
      out.push(bag[k].id);
      bag.splice(k, 1);
    }
    return out;
  }

  BS.orders = { LIST: LIST, BY: BY, pool: pool, offerN: offerN };
})(window.BS);
