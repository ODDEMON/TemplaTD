/* world/towers.js —— 炮塔属性表。
   ------------------------------------------------------------------
   图形数据 → 炮塔属性的全部规则都在这里。改数据不改逻辑。
   六项读数各司其职，互不重叠：
     sym→散射弹数 · repeat→攻速 · void→射程与穿透
     even→伤害 · weave→连锁与减速 · edge→近战与 HP
   特质效果写在这里而不写在 parts.js：parts 管图形长什么样，
   这里管它进化出的炮塔打什么样。墙不存在了——一切图形进化为炮塔。

   **波动幅度**：系数按实测分布标定（见 docs/DESIGN.md §3.3）。
   六项读数的实测区间是 sym .22–1.00 / repeat .13–.76 / void .00–.82 /
   even .31–.74 / weave .00–1.00 / edge .26–.84——也就是说
   「换一具图形」能把伤害从 6.7 抬到 11.9（旧版只在 5.9–8.4 之间晃）、
   把连锁从 0 抬到 5、把散射从 2 弹抬到 7 弹。
   玩家拼什么图形，从此真的差别很大。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  /* 六项全 0 的元件是一座最朴素的塔。所有读数在这副骨架上加成。 */
  var BASE = { dmg: 3, rate: 0.8, range: 2.5, proj: 1, pierce: 0, chain: 0, splash: 0, slow: 0, hp: 20, melee: 0 };

  /* 每项读数的贡献。用步进的（floor）不用连续的——玩家能心算。
     平均值大致与旧版相当（伤害 8.6 vs 6.8、攻速 1.33 vs 1.01），
     变的是**摆动的幅度**——同一把元件，摆法不同就是两种塔。 */
  var SCALE = {
    sym:    { projStep: 6 },                  /* proj = 1 + floor(sym × 6)：2..7 弹 */
    repeat: { rate: 1.3 },                    /* rate = 0.8 + 1.3 × repeat */
    void:   { range: 5.0, pierce: 4 },        /* range = 2.5 + 5 × void；pierce = floor(void × 4) */
    even:   { dmg: 12 },                      /* dmg = 3 + 12 × even */
    weave:  { chain: 5, slow: 0.45 },         /* chain = floor(weave × 5)；slow = weave × 0.45 */
    edge:   { melee: 10, hp: 180 }            /* melee = edge × 10；hp = 20 + edge × 180 */
  };

  /* 十一特质的塔防效果。每种给塔一个战斗人格，全部是乘区或加区。 */
  var TRAIT_FX = {
    volt:   { chain: 2 },                     /* 电天生走连锁 */
    crysta: { proj: 1, dmgMul: 0.85 },        /* 一簇晶刺散开，单根变细 */
    oculus: { range: 1.5 },                   /* 被看着的东西躲不掉 */
    vacua:  { slow: 0.15 },                   /* 虚空吸人 */
    resona: { auraDmg: 0.10 },                /* 邻格塔伤害 +10%——全作唯一的光环 */
    sacra:  { dmgMul: 1.15 },                 /* 神圣几何的伤害修正 */
    automa: { rateMul: 1.20 },                /* 自己会开火 */
    iris:   { splash: 1 },                    /* 颜色散开 */
    radix:  { dot: 3 },                       /* 命中挂 3 秒持续伤害（每秒 dot/3 点） */
    specu:  { pierce: 2 },                    /* 镜面穿射 */
    aether: { costMul: 0.85 }                 /* 轻所以便宜——唯一动成本的特质 */
  };

  /* 塔的射程判定用切比雪夫距离（方格世界里的「圆」），
     近战在塔所在格及八邻格生效。 */
  var RANGE_METRIC = 'chebyshev';

  BS.towers = { BASE: BASE, SCALE: SCALE, TRAIT_FX: TRAIT_FX, RANGE_METRIC: RANGE_METRIC };
})(window.BS);
