/* world/cond.js —— 战况：开局前自己勾选的加压项。
   ------------------------------------------------------------------
   **难度不是一档一档选的，是一张一张勾的**。参照《几何竞技场 2》的挑战卡：
   玩家给自己上难度，每一条都**明码标价**一个结算倍率——勾得越狠，
   这一局的尘 / 晶 / 阅历乘得越高。它把「我要打多难」从一个下拉框
   变成一串有价格的勾选，而价格写在每一条旁边。

   为什么值得单开一张表：
     · **它是运营的第一道决策**。开局之前先回答「这一局我愿意挨多少」，
       而这个答案会一直跟着结算走——风险与回报在同一行字里。
     · **它是局外成长的回报放大器**。重塑树里「契约 I / II」解锁的是
       **更狠的战况**，而更狠的战况给更高的倍率。所以局外成长不是直接
       给你数值，是把「你可以赌多大」的上限抬高——这比 +10% 伤害有意思。
     · **它不新增闸门**。尘还是只管抽、晶还是只管升、辉光还是只管局内；
       战况只改这一局的战斗参数与结算倍率。

   三档 tier：0 是起手就有的三条，1 / 2 由重塑树的「契约」解锁。
   起手只给三条，是因为九条一起摊开会把新手吓退——先让人学会
   「勾一条、看倍率涨」，再谈「全勾上」。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  /* mul 是**结算倍率的百分点**（+18 → ×1.18）。
     尘 / 晶 / 阅历走同一个乘区，所以「这一局值多少」只有一个数字。 */
  var LIST = [
    /* ---- tier 0：起手就有 ---- */
    { id: 'thick', t: '厚甲', en: 'THICK HIDE', tier: 0, mul: 18,
      d: '敌人生命 ×1.25', den: 'Enemy HP ×1.25', mods: { hpMul: 1.25 } },
    { id: 'rush', t: '疾行', en: 'RUSH', tier: 0, mul: 15,
      d: '敌人移动速度 ×1.20', den: 'Enemy speed ×1.20', mods: { spdMul: 1.20 } },
    { id: 'swarm', t: '蜂拥', en: 'SWARM', tier: 0, mul: 25,
      d: '每一波的敌人数量 ×1.40', den: 'Enemy count per wave ×1.40', mods: { countMul: 1.40 } },

    /* ---- tier 1：契约 I 解锁 ---- */
    { id: 'early', t: '早潮', en: 'EARLY TIDE', tier: 1, mul: 20,
      d: '难度曲线前移 3 波（第 1 波就是第 4 波的厚度）', den: 'Difficulty curve shifts 3 waves earlier',
      mods: { waveShift: 3 } },
    { id: 'aegis', t: '盾列', en: 'AEGIS LINE', tier: 1, mul: 15,
      d: '护盾从第 5 波起入场（原为第 8 波）', den: 'Shields arrive from wave 5 (was 8)',
      mods: { shieldFrom: 5 } },
    { id: 'nox', t: '无辉', en: 'NO GLOW', tier: 1, mul: 22,
      d: '击杀掉落的辉光 ×0.75', den: 'Lux drops ×0.75', mods: { luxMul: 0.75 } },

    /* ---- tier 2：契约 II 解锁 ---- */
    { id: 'lean', t: '节流', en: 'LEAN PURSE', tier: 2, mul: 20,
      d: '这一局的部署预算 ×0.75', den: 'Deploy budget ×0.75', mods: { budgetMul: 0.75 } },
    { id: 'tight', t: '缺编', en: 'UNDERSTAFFED', tier: 2, mul: 18,
      d: '容机上限 −3 座', den: 'Hangar cap −3', mods: { garageCut: 3 } },
    { id: 'drain', t: '渗血', en: 'BLEEDING', tier: 2, mul: 30,
      d: '基地生命上限 −5', den: 'Base HP cap −5', mods: { baseHpCut: 5 } }
  ];
  var BY = {};
  (function () { var i; for (i = 0; i < LIST.length; i++) BY[LIST[i].id] = LIST[i]; })();

  /* 中性块。**每一项都是「不作用」**，缺字段的畸形块退化到这里——
     与 td.js 的 flux / buffs 同一条保险。 */
  function blank() {
    return {
      hpMul: 1, spdMul: 1, countMul: 1, luxMul: 1, dmgMul: 1, budgetMul: 1,
      waveShift: 0, shieldFrom: 0, garageCut: 0, baseHpCut: 0, levelAdd: 0,
      leakFlat: 0, upDisc: 0, sellRate: 0.6
    };
  }
  var MULK = ['hpMul', 'spdMul', 'countMul', 'luxMul', 'dmgMul', 'budgetMul'];
  var ADDK = ['waveShift', 'garageCut', 'baseHpCut', 'levelAdd', 'leakFlat', 'upDisc'];

  /* 合一块进来。乘区相乘、加区相加——**没有第三种接法**。
     shieldFrom 取更小的那个（更早 = 更难），0 表示「没说，用默认」。 */
  function merge(out, src) {
    if (!src) return out;
    var i, k;
    for (i = 0; i < MULK.length; i++) {
      k = MULK[i];
      if (src[k] != null) out[k] = (out[k] == null ? 1 : out[k]) * src[k];
    }
    for (i = 0; i < ADDK.length; i++) {
      k = ADDK[i];
      if (src[k]) out[k] = (out[k] || 0) + src[k];
    }
    if (src.shieldFrom) out.shieldFrom = out.shieldFrom ? Math.min(out.shieldFrom, src.shieldFrom) : src.shieldFrom;
    /* 撤收回扣是「这一刻的值」，不是乘区——后写的那一条直接盖掉 */
    if (src.sellRate != null) out.sellRate = src.sellRate;
    return out;
  }

  /* 勾了哪几条 → 一张 mods 纸。空数组 = 中性（没勾 = 常规局）。 */
  function modsOf(ids) {
    var out = blank(), i;
    if (!ids || !ids.length) return out;
    for (i = 0; i < ids.length; i++) {
      var c = BY[ids[i]];
      if (c) merge(out, c.mods);
    }
    return out;
  }

  /* 勾了哪几条 → 结算倍率（1 + 百分点之和）。 */
  function mulOf(ids) {
    var s = 1, i;
    if (!ids || !ids.length) return 1;
    for (i = 0; i < ids.length; i++) {
      var c = BY[ids[i]];
      if (c) s += c.mul / 100;
    }
    return s;
  }

  /* 现在开放到第几档：0 / 1 / 2。重塑树的「契约 I / II」抬它。 */
  function openOf(tier) {
    var t = tier | 0, out = [], i;
    for (i = 0; i < LIST.length; i++) if ((LIST[i].tier | 0) <= t) out.push(LIST[i]);
    return out;
  }

  BS.cond = {
    LIST: LIST, BY: BY, blank: blank, merge: merge,
    modsOf: modsOf, mulOf: mulOf, openOf: openOf
  };
})(window.BS);
