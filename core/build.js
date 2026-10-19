/* core/build.js —— 进化体的部署成本与预算。
   ------------------------------------------------------------------
   大小与复杂度的闸门（本版沿用旧公式、去掉墙折扣——墙没有了）：
     cost = ⌈ 2 辉/格 × 格数 × 稀有度 × (1 + 质变度 × 0.5) + 特质 × 8 ⌉
   质变度上浮是故意留的口子：好看的图形进化出更贵的炮塔。
   它制造的决策是「一座偏科神器，还是一片各管一面的杂牌军」——
   预算永远不够两边都要，而这不是惩罚，是这一版的主题：
   审美即战力，你付的每一分钱都在为「它是什么」计价。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var P = BS.parts, E = BS.eff;

  var PER_CELL = 2;       /* 每格的基础价 */
  var PER_TRAIT = 8;      /* 每条特质的加价 */
  var ES_UPLIFT = 0.5;    /* 质变度上浮系数 */
  var BASE_BUDGET = 300;  /* 每局的部署预算（局外成长在此之上加） */

  function cost(part) {
    var r = BS.tower.read(part);
    var sp = P.RARITY[part.rar];
    var c = PER_CELL * part.cells.length * sp.w * (1 + r.esScore * ES_UPLIFT)
      + part.traits.length * PER_TRAIT;
    c *= BS.tower.attrs(part).costMul;
    return Math.max(1, Math.ceil(c));
  }

  /* 一局的部署预算：基础 300 + 成就加成 + 升级商店的「部署预算」。
     花园不再给预算——本版起它只管战斗面（伤害/攻速/射程/暴击/掉落），
     一局的起手资本归成就与升级管。两套系统各管一摊，不再互相伸手。 */
  function budget() {
    return BASE_BUDGET + (BS.metaDefs.mods(BS.bus.state.meta).budget | 0);
  }

  BS.build = { cost: cost, budget: budget, PER_CELL: PER_CELL, PER_TRAIT: PER_TRAIT, ES_UPLIFT: ES_UPLIFT, BASE_BUDGET: BASE_BUDGET };
})(window.BS);
