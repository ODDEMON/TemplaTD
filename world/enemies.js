/* world/enemies.js —— 敌人志。
   ------------------------------------------------------------------
   **十种**敌人，每一种各管一种塔的短板（docs/DESIGN.md §3.2）：
   冲刺兵逼攻速与减速，重甲逼连锁与穿透，灵体逼非单体伤害。
   没有一种敌人是「什么都吃」的——这是塔的属性分工成立的前提。

   **本版从五种扩到十种**。扩的不是数值，是**问法**：
     · 群兵      —— 单只几乎没有血量，成群才成立。逼「溅射 / 连锁」而非「单体」。
     · 疾甲      —— 又硬又快。逼「减速之外还得有穿透」——只靠减速拖不住。
     · 裂胞      —— 死在门口会炸出两只群兵。**逼「别让它死在基地边上」**，
                    这是唯一一种把「杀在哪儿」变成决策的敌人。
     · 愈使      —— 持续回血。逼爆发；小刀子割不动它。
     · 壁垒      —— 单体伤害打它只剩三成。**逼「这一局必须留一路非单体火力」**。
   前五种是「属性分工」，后五种是「时间与地点」：什么时候杀、在哪儿杀、
   用什么杀。十种一起，波次预告才值得看。

   **护盾**：第 8 波起，重甲 / 疾甲 / 壁垒 / 首领带盾入场。规则只有一条：
   护盾先吃伤害；**单体伤害（直击 / 近战）打盾只有五成**，溅射 / 连锁 /
   穿透 / 灼烧全额。它制造的决策是「这一局要不要为破盾留一路非单体火力」——
   而阵型每波重掷的溅射 / 连锁 / 穿透加成，从此有了战术含义：
   偏覆盖的那几波就是破盾波。盾量随波数缩放（与敌血同一根轴），
   所以它不是某种敌人的静态属性，是这条难度曲线上的第二层皮。

   两个新字段是**纯数据**：td.js 只认 `regen`（每秒回血）与
   `split: { id, n }`（死亡分裂成 n 只 id）。它俩与 hp / speed 同一种东西——
   表上写多少就是多少，td.js 里没有任何一句「如果敌人是裂胞那么」。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  /* HP 是第四轮 tuning 后的值。前三轮的历史值得记住：
     首版全场压力不足——满预算贪心 AI 六场里三场满血通关，首胜没有分量。
     第二轮 HP 统一 +40%，复测：满预算从「稳赢但见血」变成「能赢但见血」。
     第三轮放大塔属性的波动幅度（SCALE 系数上调，见 world/towers.js），
     满预算 DPS 从约 60 抬到约 98——**再加 60% 敌血把「能赢但见血」找回来**。
     两条曲线要一起动：只放大塔的波动不改敌血，第 10 波会变成散步。
     半预算 / 少塔时仍是看位置与行市——难度墙的位置没变，只是不再白给。

     十种版本的数量是照「总血量预算」重排过的：新种类不是白加的，
     每加一种就从前五种的骨架里让出一份额度——否则第 20 波会直接顶穿。 */
  var ENEMIES = [
    { id: 'ground', t: '步行兵', en: 'STRIDER', hp: 67, speed: 1.0, leak: 1, lux: 4, singleMul: 1.0, sh: 0,
      d: '最平常的一种。什么塔都打得动它——它是用来给你校准手感的。', den: 'The plain one. Any tower hurts it — it calibrates your hand.' },
    { id: 'fast', t: '冲刺兵', en: 'DASHER', hp: 40, speed: 2.2, leak: 1, lux: 5, singleMul: 1.0, sh: 0,
      d: '快。攻速慢的塔会漏它——减速是它的解。', den: 'Fast. Slow turrets leak it — slow effects are the answer.' },
    { id: 'swarm', t: '群兵', en: 'SWARMLING', hp: 22, speed: 1.45, leak: 1, lux: 2, singleMul: 1.0, sh: 0,
      d: '单只几乎没有血，成群才成立。单体火力会被它淹掉，溅射与连锁按群吃。', den: 'Nothing alone, everything in a crowd. Single-target drowns; splash and chain eat them by the dozen.' },
    { id: 'armor', t: '重甲', en: 'PLATED', hp: 202, speed: 0.8, leak: 2, lux: 9, singleMul: 0.6, sh: 110,
      d: '单体伤害打它只剩六成。连锁、穿透、溅射不吃这个减免。', den: 'Direct damage lands at 60%. Chain, pierce and splash ignore the reduction.' },
    { id: 'lancer', t: '疾甲', en: 'LANCER', hp: 96, speed: 1.75, leak: 2, lux: 11, singleMul: 0.55, sh: 80,
      d: '又硬又快：减速拖不住它，单体也啃不动它。这一路要的是穿透。', den: 'Hard and fast: slows will not hold it, direct fire barely bites. This lane wants pierce.' },
    { id: 'splitter', t: '裂胞', en: 'SPLITTER', hp: 130, speed: 0.95, leak: 2, lux: 6, singleMul: 0.9, sh: 0,
      split: { id: 'swarm', n: 2 },
      d: '死时会炸出两只群兵。别让它死在基地边上——杀在哪儿，从这一条起是决策。', den: 'Bursts into two Swarmlings on death. Do not let it die near the base — where you kill it is now a decision.' },
    { id: 'mender', t: '愈使', en: 'MENDER', hp: 150, speed: 0.75, leak: 2, lux: 12, singleMul: 0.7, sh: 0,
      regen: 7,
      d: '每秒回 7 点血。小刀子割不动它——要么一发打穿，要么别碰。', den: 'Regenerates 7 HP per second. Chip damage does not stick — burst through it or leave it.' },
    { id: 'wraith', t: '灵体', en: 'WRAITH', hp: 34, speed: 1.3, leak: 2, lux: 7, singleMul: 0.5, sh: 0,
      d: '单体伤害只有五成，但血薄。溅射是它的解。', den: 'Direct damage lands at 50%, but it is thin. Splash is the answer.' },
    { id: 'bulwark', t: '壁垒', en: 'BULWARK', hp: 380, speed: 0.5, leak: 3, lux: 20, singleMul: 0.3, sh: 260,
      d: '单体只剩三成，还带厚盾。这一局必须留一路非单体火力，不然它只是走过去。', den: 'Direct damage lands at 30%, behind a thick shield. Keep one non-direct lane or it simply walks through.' },
    /* BOSS · 本版下调到原来的 **0.7 倍**（血 / 盾 / 速 三样一起）：
       1344 → 940.8（取整 941）、520 → 364、0.6 → 0.42。
       三样必须一起动：只削血，它还是「走得太快的墙」；只削速，
       它还是「顶不动的那口气」。要的是「收得住」，不是「变软」。
       它的角色没变——每波最后那一下，账结在这里。 */
    { id: 'chief', t: '首领', en: 'WARDEN', hp: 941, speed: 0.42, leak: 3, lux: 25, singleMul: 0.7, sh: 364,
      d: '每波的收尾。它走过的地方，这一波的账就结在这里。', den: 'The closer of every wave. Where it walks, the wave settles.' }
  ];
  var BY = {};
  (function () { var i; for (i = 0; i < ENEMIES.length; i++) BY[ENEMIES[i].id] = ENEMIES[i]; })();

  /* 盾从第几波开始出现。8 波是灵体入场的后一拍——「该为破盾做点准备」
     与「该为非单体伤害做点准备」是同一个提醒，只响一次。 */
  var SHIELD_FROM = 8;

  /* singleMul：单体直击伤害的减免。连锁、溅射、穿透不吃它——
     「重甲怕连锁、灵体怕溅射」的克制关系全在这一个字段上。
     护盾是叠在这一层上面的第二层皮：打盾时单体再打一次五折。 */

  /* 第 wave 波（从 1 数起）该敌人的盾量。走与敌血同一根缩放轴，
     所以盾不是静态属性，是难度曲线的一部分。第 8 波前为 0——
     玩家在前 7 波看到的任何提示都来得及。 */
  /* from：盾从第几波开始。战况的「盾列」把它提前到第 5 波——
     它是**这一局的参数**，不是表里写死的常数，所以由调用方传进来；
     不传（或传 0）就是表里的默认值。 */
  function shieldOf(id, wave, from) {
    var e = BY[id];
    if (!e || !e.sh) return 0;
    var f = (from == null || !(from > 0)) ? SHIELD_FROM : from;
    if (!(wave >= f)) return 0;
    return e.sh * BS.waves.scale(wave).hp;
  }

  /* 这一波带不带盾——波次预告与战场渲染靠它决定画不画那圈环。 */
  function hasShield(id, wave, from) { return shieldOf(id, wave, from) > 0.5; }

  function get(id) { return BY[id] || BY.ground; }

  BS.enemies = { ENEMIES: ENEMIES, BY: BY, get: get, shieldOf: shieldOf, hasShield: hasShield, SHIELD_FROM: SHIELD_FROM };
})(window.BS);
