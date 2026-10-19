/* core/eff.js —— 单点收敛。
   ------------------------------------------------------------------
   所有限制走这一个函数。逻辑里禁止散落 if——散落的 clamp 是
   「改一处漏三处」的老巢，而这部作品的平衡全在数值上。
   CAP 是硬上限，FLOOR 是硬下限，CALM 是冷静模式钳制
   （冷静模式不改任何一条规则，只把烈度钳住）。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  var CAP = {
    slow: 0.60,        /* 减速封顶：再叠也超不过 */
    proj: 8,           /* 散射弹数封顶 */
    range: 8.0,        /* 射程封顶（格） */
    rate: 6.0,         /* 攻速封顶（次/秒） */
    dmg: 999,          /* 单发伤害封顶 */
    towerHp: 400,      /* 塔与墙的 HP 封顶 */
    chainDmg: 0.25,    /* 连锁每次跳转的伤害留存下限 */
    /* 塔的等级封顶 = 10：第三口质变口开在第 10 级，
       封顶不能再低——低于 10 的话 upgradeInfo 先撞上「到顶了」就 return，
       那一口永远开不了（旧版封顶 9、口写在 3/6/9：第三口是死的）。 */
    level: 10
  };
  var FLOOR = {
    dmg: 0.5,          /* 单发伤害保底 */
    rate: 0.2,         /* 攻速保底 */
    range: 1.0         /* 射程保底（格） */
  };
  var CALM = {
    speed: 1.0,        /* 战斗播放倍率：冷静模式钳到 0.5 */
    luxShow: true      /* 辉的数字照常显示——冷静模式不藏信息 */
  };

  function eff(key, value) {
    if (CAP[key] != null && value > CAP[key]) return CAP[key];
    if (FLOOR[key] != null && value < FLOOR[key]) return FLOOR[key];
    return value;
  }

  /* ---------- 小于 1 的幂次：所有「叠加越多越强」的曲线都走这里 ----------
     为什么要它：线性叠加在长线游戏里必然爆炸。第 10 级和第 1 级一样值钱，
     玩家就没有「先升哪一条」的决策了——只有「全都升」。
     p < 1 让曲线**递减但不封顶**：每一级仍然变强，只是越往后越不值，
     于是「我该把结晶花在伤害还是攻速」重新变成一个真问题。

     形状：value(x) = k · x^p
       x = 1 → k          （一级的数值，与旧版逐字相同）
       x = 4 → k · 4^0.6 = k · 2.30   （线性本该是 4k）
     所以**改曲线不动一级的手感**——老玩家第一次买到的还是那个数，
     只是买到第 4 级时不再有 4 倍。这是「改曲线」和「改平衡」的分界线。

     这里只收口「加成」，不收口「消耗」：成本该涨还是涨（见 meta.js 的 cost），
     否则递减的收益配上递减的成本，升级就永远不亏，曲线白改。 */
  var POW = 0.6;
  function pow(x, k, p) {
    if (!(x > 0)) return 0;
    return k * Math.pow(x, p == null ? POW : p);
  }

  /* 冷静模式开关：只钳 CALM 表里的键，不动任何判定 */
  var calm = false;
  function setCalm(on) { calm = !!on; }
  function isCalm() { return calm; }

  BS.eff = {
    eff: eff, CAP: CAP, FLOOR: FLOOR, CALM: CALM,
    setCalm: setCalm, isCalm: isCalm,
    POW: POW, pow: pow
  };
})(window.BS);
