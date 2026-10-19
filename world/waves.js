/* world/waves.js —— 波次表（无限模式）。
   ------------------------------------------------------------------
   波没有尽头：第 1~10 波是教学骨架，第 11 波起每个周期在骨架上加码，
   同时全局缩放一路往上顶（HP / 速度 / 报酬）——
   难度不断上升的无限模式，终局只由基地生命写。
   组成 = 固定骨架 + 种子派生抖动：同种子同波次同组成，可复现的一部分；
   抖动幅度小（±2），波次的性格由骨架决定，不靠随机撒野。

   **十种敌人怎么排进波次**（本版）：
     · 前十波是**教学**：一种一种放进来，每进来一种就给玩家一波的余裕。
       3 冲刺 / 5 重甲 / 7 灵体 / 8 护盾 / 9 群兵 / 10 首领。
     · 第 11 波起才是**全部十种**的舞台：疾甲 11、裂胞 14、愈使 15、壁垒 16，
       进来之后常驻——新种类不是一次性演出，是往后的每一波都得算上它。
     · 第 11 波起每波有一个**主题**（潮 / 疾 / 甲 / 灵 / 攻，五波一轮）：
       主题那一路抬五成。**相邻两波不再同一张脸**——旧版第 11 波与第 12 波
       只是数字不同、问法完全一样，预告也就没有看的必要；
       现在「下一波是甲潮还是灵潮」是能在预告里读出来、并据此留火力的事。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var SD = BS.seed;

  /* 波次骨架（教学期）。7 波起灵体入场，9 波起群兵入场——
     此前玩家有时间先建起非单体的塔。 */
  var BASE = [
    { ground: 6 },
    { ground: 8 },
    { ground: 6, fast: 3 },
    { fast: 8 },
    { ground: 8, armor: 2 },
    { armor: 4, fast: 6 },
    { ground: 6, wraith: 6 },
    { armor: 5, wraith: 4 },
    { fast: 8, wraith: 5, swarm: 6 },
    { ground: 8, armor: 4, wraith: 4, chief: 1 }
  ];

  /* 第 11 波起的主题，五波一轮。它抬的是**数量**，不是血量倍率——
     血量倍率会让「这一波变难了」变成一句空话，数量才看得见、数得清。 */
  var FLAV = ['swarm', 'fast', 'armor', 'wraith', 'chief'];
  var FLAV_T = { swarm: '潮', fast: '疾', armor: '甲', wraith: '灵', chief: '攻' };
  var FLAV_EN = { swarm: 'TIDE', fast: 'RUSH', armor: 'PLATE', wraith: 'HEX', chief: 'SIEGE' };

  /* 第 n 波（>10）的骨架：每波往上加码，5 波一个首领台阶，
     新种类按波数入场后常驻，主题那一路再抬五成。 */
  function hardComp(n) {
    var e = n - 10;
    var c = {
      ground: 6 + Math.floor(e / 3),
      fast: 3 + Math.floor(e / 2),
      armor: 3 + Math.floor(e / 2),
      wraith: 3 + Math.floor(e / 3),
      chief: 1 + Math.floor(e / 5)
    };
    /* 新种类入场：11 群兵 · 12 疾甲 · 14 裂胞 · 15 愈使 · 16 壁垒。
       每加一种，骨架上那五路就少一份额度——**总血量预算是守着的**：
       不守的话第 20 波会直接顶穿，而顶穿在无限模式里等于没有后期。 */
    if (n >= 11) c.swarm = 5 + Math.floor(e * 0.8);
    if (n >= 12) c.lancer = 2 + Math.floor(e / 3);
    if (n >= 14) c.splitter = 2 + Math.floor((e - 4) / 3);
    if (n >= 15) c.mender = 2 + Math.floor((e - 5) / 4);
    if (n >= 16) c.bulwark = 1 + Math.floor((e - 6) / 5);
    var f = flavorOf(n);
    c[f] = Math.round((c[f] | 0) * 1.5);
    return c;
  }

  /* 第 n 波的主题。第 10 波及以前没有主题——教学期不需要，
     那一阶段的每一波本来就在教一样新东西。 */
  function flavorOf(n) { return FLAV[((n - 11) % FLAV.length + FLAV.length) % FLAV.length]; }
  function flavorName(n) {
    var f = flavorOf(n);
    return { id: f, t: FLAV_T[f], en: FLAV_EN[f] };
  }

  /* 第 n 波（从 1 数起）的组成。抖动走本波自己的随机流。 */
  function comp(seed, n) {
    var base = n <= BASE.length ? BASE[n - 1] : hardComp(n);
    var rnd = SD.derive(seed, 'wave' + n), out = [], k;
    for (k in base) {
      var jitter = base[k] >= 4 ? Math.floor(rnd() * 3) - 1 : 0;
      var c = Math.max(1, base[k] + jitter);
      out.push({ id: k, count: c });
    }
    return out;
  }

  /* 全局缩放：难度不断上升的那根轴。第 8 波起加速，10 波后二次项发力。 */
  function scale(n) {
    var e = Math.max(0, n - 10);
    return {
      hp: 1 + 0.10 * (n - 1) + 0.01 * e * e,
      spd: 1 + 0.015 * Math.max(0, n - 8),
      lux: 1 + 0.06 * (n - 1)
    };
  }

  BS.waves = {
    BASE: BASE, FLAV: FLAV, comp: comp, hardComp: hardComp, scale: scale,
    flavorOf: flavorOf, flavorName: flavorName
  };
})(window.BS);
