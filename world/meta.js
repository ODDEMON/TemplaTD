/* world/meta.js —— 局外成长：升级商店 + 元件成就表。
   ------------------------------------------------------------------
   三种资源里的**结晶**在这里花。升级商店四条组，各管一个旋钮——
   **开局**（一局怎么开始）、**循环**（资源怎么滚）、**手感**（塔怎么打）、
   **阵型**（你自己摆出来的那个形状有多响）。
   分组不是为了好看：它让玩家一眼看出「我现在想改的是开局还是手感」。

   **「阵型」组是接替「宇宙」组的那一组**。指针宇宙删掉之后，接管战斗
   标量的那一头由阵型接上（run.js 的 formationFlux），于是「把阵型调好」
   与「把塔调强」是两条完全不同的成长轴：前者放大的是**六项读数本身**，
   后者只是把塔的数值抬高。两条旋钮各改一个真实存在的常数：
   读数的幅度、峰值那一项的反噬。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  /* ---------- 升级商店：结晶的唯一去处 ----------
     grp：开局 / 循环 / 手感——界面按这个分组渲染。
     max 与 cost 都是「玩家读得懂的一行数字」，别在这里藏公式。 */
  var UPGRADES = [
    /* 开局：一局的起手条件 */
    { id: 'budget', t: '部署预算', en: 'BUDGET', grp: '开局', max: 5, cost: function (l) { return 40 + 40 * l; },
      d: '每局部署预算 +60' },
    { id: 'start', t: '起手拨付', en: 'SEED FUND', grp: '开局', max: 3, cost: function (l) { return 60 + 60 * l; },
      d: '每局开始额外白给 +80 部署预算' },
    { id: 'garage', t: '容机预算', en: 'HANGAR SLOTS', grp: '开局', max: 3, cost: function (l) { return 50 + 50 * l; },
      d: '每局可部署的炮塔上限 +2 座' },
    { id: 'room', t: '图纸扩容', en: 'BLUEPRINT EXPANSION', grp: '开局', max: 4, cost: function (l) { return 55 + 55 * l; },
      d: '图形工坊的图纸长宽各 +2（基准 14×9）' },

    /* 循环：资源怎么滚起来 */
    { id: 'dust', t: '采集尘收取', en: 'DUST YIELD', grp: '循环', max: 5, cost: function (l) { return 30 + 30 * l; },
      d: '战斗结算的采集尘 +20%' },
    { id: 'draw', t: '抽取议价', en: 'BARGAIN', grp: '循环', max: 4, cost: function (l) { return 40 + 40 * l; },
      d: '抽取费用 -10%' },
    { id: 'rar', t: '高档权重', en: 'RARE ODDS', grp: '循环', max: 3, cost: function (l) { return 80 + 80 * l; },
      d: '华档与殿档的抽取权重 ×1.5（概率条会当场变）' },
    { id: 'lux', t: '辉光精炼', en: 'LUX REFINERY', grp: '循环', max: 3, cost: function (l) { return 40 + 40 * l; },
      d: '战斗中辉光的掉落 +15%' },
    { id: 'crystal', t: '结晶开采', en: 'CRYSTAL VEIN', grp: '循环', max: 3, cost: function (l) { return 70 + 70 * l; },
      d: '战斗结算的结晶 +15%' },

    /* 手感：塔怎么打 */
    { id: 'dmg', t: '膛压校准', en: 'CHAMBER TUNE', grp: '手感', max: 4, cost: function (l) { return 60 + 60 * l; },
      d: '全部塔伤害 +8%' },
    { id: 'rate', t: '循环加速', en: 'CYCLE RUSH', grp: '手感', max: 3, cost: function (l) { return 60 + 60 * l; },
      d: '全部塔攻速 +6%' },
    { id: 'range', t: '校射镜组', en: 'SIGHT ARRAY', grp: '手感', max: 3, cost: function (l) { return 50 + 50 * l; },
      d: '全部塔射程 +0.4' },

    /* 阵型：**优化你自己摆出来的那个形状**。
       为什么值得单开一组：阵型接管十二个战斗标量（六项读数各管一摊），
       所以「把阵型调好」与「把塔调强」是两条完全不同的成长轴——
       前者放大的是**读数本身**（好坏一起），后者只是把塔的数值抬高。
       两条旋钮各改一个真实存在的常数：读数的幅度、峰值的反噬。 */
    { id: 'fscale', t: '阵型增益', en: 'FORMATION GAIN', grp: '阵型', max: 4,
      cost: function (l) { return 60 + 60 * l; },
      d: '阵型六项读数接管战斗标量的幅度 +20%' },
    { id: 'frelief', t: '峰值豁免', en: 'PEAK RELIEF', grp: '阵型', max: 3,
      cost: function (l) { return 70 + 70 * l; },
      d: '峰值读数抬高的敌血 -20%' }
  ];
  var UPG_BY = {};
  (function () { var i; for (i = 0; i < UPGRADES.length; i++) UPG_BY[UPGRADES[i].id] = UPGRADES[i]; })();
  /* 分组顺序：界面上按这个次序列，别靠 UPGRADES 的声明序去猜。 */
  var UPG_GROUPS = ['开局', '循环', '手感', '阵型'];

  /* ---------- 元件成就：九条 ---------- */
  var LIST = [
    { id: 'M1', t: '首胜', en: 'FIRST STAND', w: 1,
      d: '撑过第 10 波后撤离',
      ok: function (c) { return c.won; },
      gives: { poolBoost: 40 } },

    { id: 'M2', t: '对称凯旋', en: 'SYMMETRY TRIUMPH', w: 2,
      d: '用一座对称度 ≥ 0.80 的炮塔撑过第 10 波',
      ok: function (c) { return c.won && c.maxSym >= 0.80; },
      gives: { traitLuck: { sacra: 0.30 } } },

    { id: 'M3', t: '片叶不伤', en: 'UNTOUCHED', w: 2,
      d: '撑过第 10 波时基地生命全满',
      ok: function (c) { return c.won && c.baseHp >= c.baseMax; },
      gives: { rarBoost: { 4: 1.5 } } },

    { id: 'M4', t: '连锁大师', en: 'CHAIN ADEPT', w: 2,
      d: '单场连锁塔（连锁 ≥ 2）累计击杀 50',
      ok: function (c) { return c.chainKills >= 50; },
      gives: { traitLuck: { volt: 0.30 } } },

    { id: 'M5', t: '诸型皆列', en: 'ALL FORMS MUSTERED', w: 2,
      d: '部署过 10 种不同的型的炮塔',
      ok: function (c) { return c.formsUsed >= 10; },
      gives: { budget: 100 } },

    { id: 'M6', t: '质变之心', en: 'HEART OF CHANGE', w: 3,
      d: '单具图形质变度 ≥ 0.85 进化成塔',
      ok: function (c) { return c.bestEs >= 0.85; },
      gives: { rarBoost: { 3: 1.5 } } },

    { id: 'M7', t: '花匠之心', en: 'GARDENER', w: 2,
      d: '在花园种下一具质变度 ≥ 0.50 的根 graphic',
      ok: function (c) { return c.maxGarEs >= 0.50; },
      gives: { dustPct: 25 } },

    { id: 'M8', t: '开盒之人', en: 'UNBOXER', w: 2,
      d: '累计抽取 20 次',
      ok: function (c) { return c.draws >= 20; },
      gives: { rarBoost: { 3: 1.2, 4: 1.2 } } },

    { id: 'M9', t: '无尽行者', en: 'ENDLESS WALKER', w: 3,
      d: '单局撑到第 15 波',
      ok: function (c) { return c.bestWave >= 15; },
      gives: { crystalPct: 10 } }
  ];
  var BY = {};
  (function () { var i; for (i = 0; i < LIST.length; i++) BY[LIST[i].id] = LIST[i]; })();

  /* ---------- 重塑：局外成长树 ----------
     **结晶买的是数值，阅历登记的是可能性。**
     升级商店那 14 条旋钮回答「我要把哪条曲线抬高」，重塑树回答
     「我这一局还能做哪些以前做不了的事」——多一张指令候选、多一次重掷、
     多三条可以勾的战况、失守不再那么疼。**横向解锁优先于纵向数值**，
     这是《明日方舟》集成战略的「认知塑造」真正值钱的那一半：
     它给的不是 +10%，是「下次我可以这样打」。

     四个分支各管一摊，与升级商店的四组同一套分组逻辑：
       · **启程** 一局怎么开始（辉光 / 预算 / 基地 / 容机 / 出厂等级）
       · **战备** 波与波之间能选什么（指令张数 / 重掷 / 高级指令 / 战况解锁）
       · **补给** 局内资源怎么滚（辉光掉落 / 撤收回扣 / 升级成本 / 漏怪减免）
       · **结算** 一局打完落袋多少（尘 / 晶 / 阅历 / 失守折扣 / 重整配给 / 深水）

     req 是**单前置**：一棵树只要能回答「先点哪个」就够了，
     多前置会让玩家在脑子里做拓扑排序，而那不是这一页该收的乐趣。
     花费是**阅历**——它只在结算里入账，所以「这一局打得怎么样」
     与「下次开局能做什么」第一次是同一件事。 */
  var SHAPING = [
    /* 启程 */
    { id: 'k_fund', t: '起手辉光', en: 'SEED LUX', br: '启程', cost: 90, req: null,
      d: '每局开局额外 +80 辉光', den: 'Each run starts with +80 lux' },
    { id: 'k_budget', t: '追加预算', en: 'EXTRA BUDGET', br: '启程', cost: 130, req: 'k_fund',
      d: '每局的部署预算 +70', den: 'Deploy budget +70 per run' },
    { id: 'k_hp', t: '加厚基座', en: 'THICKER BASE', br: '启程', cost: 160, req: 'k_fund',
      d: '基地生命上限 +2', den: 'Base HP cap +2' },
    { id: 'k_garage', t: '备用机位', en: 'SPARE SLOT', br: '启程', cost: 190, req: 'k_budget',
      d: '每局的容机上限 +1 座', den: 'Hangar cap +1 per run' },
    { id: 'k_level', t: '出厂校准', en: 'FACTORY TUNE', br: '启程', cost: 280, req: 'k_hp',
      d: '开局部署的每一座塔自带 1 级', den: 'Towers deploy at level 1' },

    /* 战备 */
    { id: 'o_slots', t: '指令扩容', en: 'WIDER TABLE', br: '战备', cost: 150, req: null,
      d: '休整期的指令候选从 3 张变 4 张', den: 'Order offers: 3 → 4 cards' },
    { id: 'o_reroll', t: '重掷', en: 'REDRAW', br: '战备', cost: 210, req: 'o_slots',
      d: '每局有一次重掷候选的机会', den: 'One redraw of the offer per run' },
    { id: 'o_adv', t: '高级指令', en: 'ADVANCED ORDERS', br: '战备', cost: 300, req: 'o_slots',
      d: '解锁 4 条高级指令（押运 / 督战 / 扩编 / 清拆）', den: 'Unlock 4 advanced orders' },
    { id: 'o_cond1', t: '契约 I', en: 'CONTRACT I', br: '战备', cost: 170, req: null,
      d: '解锁 3 条战况（早潮 / 盾列 / 无辉）', den: 'Unlock 3 conditions' },
    { id: 'o_cond2', t: '契约 II', en: 'CONTRACT II', br: '战备', cost: 350, req: 'o_cond1',
      d: '再解锁 3 条战况（节流 / 缺编 / 渗血）', den: 'Unlock 3 more conditions' },

    /* 补给 */
    { id: 'p_lux', t: '精炼', en: 'REFINERY', br: '补给', cost: 110, req: null,
      d: '击杀掉落的辉光 +12%', den: 'Lux drops +12%' },
    { id: 'p_sell', t: '折价回收', en: 'BUYBACK', br: '补给', cost: 180, req: 'p_lux',
      d: '撤收回扣从六成提到七成', den: 'Sell refund 60% → 70%' },
    { id: 'p_up', t: '量产', en: 'MASS PRODUCTION', br: '补给', cost: 200, req: null,
      d: '塔的升级费用 −12%', den: 'Tower upgrade cost −12%' },
    { id: 'p_leak', t: '护壁', en: 'BULWARK', br: '补给', cost: 330, req: 'p_up',
      d: '每一只漏掉的敌人对基地的伤害 −1（最低 1）', den: 'Each leaker costs 1 less base HP (min 1)' },

    /* 结算 */
    { id: 'r_dust', t: '征收', en: 'LEVY', br: '结算', cost: 100, req: null,
      d: '战斗结算的采集尘 +15%', den: 'Dust from battles +15%' },
    { id: 'r_cry', t: '深层开采', en: 'DEEP VEIN', br: '结算', cost: 140, req: 'r_dust',
      d: '战斗结算的结晶 +15%', den: 'Crystal from battles +15%' },
    { id: 'r_exp', t: '记录习惯', en: 'KEEPING NOTES', br: '结算', cost: 160, req: null,
      d: '每局记下的阅历 +20%', den: 'EXP recorded per run +20%' },
    { id: 'r_lost', t: '抚恤', en: 'CONSOLATION', br: '结算', cost: 250, req: 'r_exp',
      d: '失守的结算折扣从六成提到七成五', den: 'Lost-run payout 60% → 75%' },
    { id: 'r_kit', t: '重整配给', en: 'RALLY KIT', br: '结算', cost: 210, req: null,
      d: '重整时发下的配给 +50%', den: 'Rally kit +50%' },
    { id: 'r_deep', t: '深水', en: 'DEEP WATER', br: '结算', cost: 290, req: 'r_dust',
      d: '深水区每波的收益递增 6% → 9%', den: 'Deep-water gain per wave 6% → 9%' }
  ];
  var SHAPE_BY = {};
  (function () { var i; for (i = 0; i < SHAPING.length; i++) SHAPE_BY[SHAPING[i].id] = SHAPING[i]; })();
  var SHAPE_GROUPS = ['启程', '战备', '补给', '结算'];

  /* ---------- 阅历：一局打完记下多少 ----------
     公式摊在结算页上逐条列出——「登记」这两个字的意思是
     **你能指出这一笔是从哪来的**。不给明细的成长点数只是又一个进度条。 */
  var EXP = {
    PER_WAVE: 5,          /* 每波 */
    DEPTH_POW: 1.35,      /* 深水区：波数^1.35 × 1.2 */
    DEPTH_MUL: 1.2,
    PER_KILL: 0.15,       /* 每个击杀 */
    WON: 30,              /* 撑过第 10 波后撤离 */
    LOST_RATE: 0.5        /* 失守只记一半 */
  };

  /* ---------- 结算：撤离与失守不再是同一笔账 ----------
     旧版失守与撤离的收益**完全一样**，于是最优解是「永远点下一波直到死」——
     撤离按钮是一个假决策。现在两笔账分开写：
       · 撤离：波数收益全额 + 剩余基地生命折算 + 撑过第 10 波的犒赏 + 阅历全额
       · 失守：波数收益打折（重塑可抬到七成五）+ 没有犒赏 + 阅历记一半
     这就是**贪吃蛇的那一口**：多撑一波多一段收益，而撑不住就把已经攒下的
     赔进去一部分。没有这个差，push-your-luck 结构当场塌成一条直线。 */
  var PAY = {
    DUST_PER_WAVE: 6, CRYSTAL_PER_WAVE: 2,
    WON_BONUS_CRYSTAL: 15,
    DEPTH_FROM: 10,       /* 第几波起进入深水区 */
    DEPTH_STEP: 0.06,     /* 深水区每波递增（重塑「深水」抬到 0.09） */
    LOST_RATE: 0.6,       /* 失守打折（重塑「抚恤」抬到 0.75） */
    HP_BONUS: 3           /* 撤离时每剩 1 点基地生命折算的采集尘 */
  };

  /* 汇总：成就奖励 + 升级层数 + 重塑登记 → 全局修正。调用方拿整个状态。
     **效果一律走小于 1 的幂次**（eff.pow(lv, A) = A·lv^0.6）：
     一级的数字与旧版逐字相同，但第 4 级不再是 4 倍。
     线性叠加在长线里必然逼出「全都升」这一个解；递减但不封顶的曲线
     才让「先升哪一条」重新成为决策。成本仍是线性（见 UPGRADES 的 cost）——
     收益递减、成本不递减，晚买的级别才真的更不值。 */
  function mods(meta) {
    var unlocked = (meta && meta.unlocked) || {};
    var ups = (meta && meta.upgrades) || {};
    var PW = BS.eff ? BS.eff.pow : function (x, k) { return k * x; };
    var out = {
      poolBoost: 0, budget: 0, traitLuck: {}, rarBoost: {},
      dustPct: 0, crystalPct: 0, drawDisc: 0, luxPct: 0,
      /* 新旋钮：开局拨付 / 容机上限 / 塔的三项手感 —— 塔的手感在 tower 层读 */
      startFund: 0, garage: 0,
      dmgMul: 1, rateMul: 1, rangeAdd: 0,
      /* 阵型旋钮：run.js 的 formationFlux() 读。
         这里只管算，别处不许再夹——与「单点收敛」同一条规矩。
         基准值全 0 / 1（零级 = 阵型原样）。 */
      formScale: 1, formRelief: 1,
      /* 重塑树：局外登记的那棵。**横向解锁优先于纵向数值**——
         ordSlots / ordReroll / ordAdv / condTier 打开的是新选项，
         不是更大的数字；startLux / baseHpAdd / startLevel 才是一局的条件。 */
      startLux: 0, baseHpAdd: 0, startLevel: 0,
      ordSlots: 0, ordReroll: 0, ordAdv: 0, condTier: 0,
      sellRate: 0.6, upDisc: 0, leakFlat: 0,
      expPct: 0, lostRate: PAY.LOST_RATE, kitPct: 0, deepStep: PAY.DEPTH_STEP
    }, k;
    for (k in unlocked) {
      if (!unlocked[k]) continue;
      var m = BY[k];
      if (!m) continue;
      var g = m.gives || {};
      if (g.poolBoost) out.poolBoost += g.poolBoost;
      if (g.budget) out.budget += g.budget;
      if (g.dustPct) out.dustPct += g.dustPct;
      if (g.crystalPct) out.crystalPct += g.crystalPct;
      if (g.traitLuck) for (var t in g.traitLuck) out.traitLuck[t] = (out.traitLuck[t] || 0) + g.traitLuck[t];
      if (g.rarBoost) for (var r in g.rarBoost) out.rarBoost[r] = (out.rarBoost[r] || 1) * g.rarBoost[r];
    }
    for (k in ups) {
      var u = UPG_BY[k], lv = ups[k] | 0;
      if (!u || lv <= 0) continue;
      /* 注意这里不再逐级循环：层数是**一次**折进幂次的。
         逐级循环再逐级 concave 会把曲线折两次——那是「改曲线」变成「改两次曲线」，
         数值会低到看不出成长。一级的值必须与旧版逐字相同，这是底线。 */
      if (k === 'budget') out.budget += Math.round(PW(lv, 60));
      else if (k === 'start') out.startFund += Math.round(PW(lv, 80));
      else if (k === 'garage') out.garage += Math.round(PW(lv, 2));
      else if (k === 'dust') out.dustPct += Math.round(PW(lv, 20));
      else if (k === 'draw') out.drawDisc += Math.round(PW(lv, 10));
      else if (k === 'rar') {
        out.rarBoost[3] = (out.rarBoost[3] || 1) * Math.pow(1.5, Math.pow(lv, BS.eff.POW));
        out.rarBoost[4] = (out.rarBoost[4] || 1) * Math.pow(1.5, Math.pow(lv, BS.eff.POW));
      }
      else if (k === 'lux') out.luxPct += Math.round(PW(lv, 15));
      else if (k === 'crystal') out.crystalPct += Math.round(PW(lv, 15));
      else if (k === 'dmg') out.dmgMul *= 1 + 0.08 * Math.pow(lv, BS.eff.POW);
      else if (k === 'rate') out.rateMul *= 1 + 0.06 * Math.pow(lv, BS.eff.POW);
      else if (k === 'range') out.rangeAdd += 0.4 * Math.pow(lv, BS.eff.POW);
      /* 阵型组：改的是 formationFlux() 那两个真实存在的常数。
         与别处同一条曲线：层数一次折进幂次，一级就是那个数，四级不到四倍。 */
      else if (k === 'fscale') out.formScale += 0.20 * Math.pow(lv, BS.eff.POW);
      else if (k === 'frelief') out.formRelief -= 0.20 * Math.pow(lv, BS.eff.POW);
      /* 'room'（图纸扩容）在这里**故意不处理**：它不改数值修正，
         而是被 core/shop.js 的 roomLv() 直接读层数来算板子尺寸。
         一条升级不必非得落进 mods()，只读层数也是一种合法接法。 */
    }
    /* 重塑树：登记了哪些节点。与升级同一条规矩——**只在这里算一次**，
       别处不许再读 shaped 表自己加一遍（散落的加成是漏抽象的老巢）。 */
    var shp = (meta && meta.shaped) || {};
    for (k in shp) {
      if (!shp[k]) continue;
      var s = SHAPE_BY[k];
      if (!s) continue;
      if (k === 'k_fund') out.startLux += 80;
      else if (k === 'k_budget') out.budget += 70;
      else if (k === 'k_hp') out.baseHpAdd += 2;
      else if (k === 'k_garage') out.garage += 1;
      else if (k === 'k_level') out.startLevel += 1;
      else if (k === 'o_slots') out.ordSlots += 1;
      else if (k === 'o_reroll') out.ordReroll += 1;
      else if (k === 'o_adv') out.ordAdv += 1;
      else if (k === 'o_cond1') out.condTier += 1;
      else if (k === 'o_cond2') out.condTier += 1;
      else if (k === 'p_lux') out.luxPct += 12;
      else if (k === 'p_sell') out.sellRate = 0.70;
      else if (k === 'p_up') out.upDisc += 0.12;
      else if (k === 'p_leak') out.leakFlat += 1;
      else if (k === 'r_dust') out.dustPct += 15;
      else if (k === 'r_cry') out.crystalPct += 15;
      else if (k === 'r_exp') out.expPct += 20;
      else if (k === 'r_lost') out.lostRate = 0.75;
      else if (k === 'r_kit') out.kitPct += 50;
      else if (k === 'r_deep') out.deepStep = 0.09;
    }
    return out;
  }

  BS.metaDefs = {
    LIST: LIST, BY: BY, UPGRADES: UPGRADES, UPG_BY: UPG_BY,
    UPG_GROUPS: UPG_GROUPS, mods: mods,
    SHAPING: SHAPING, SHAPE_BY: SHAPE_BY, SHAPE_GROUPS: SHAPE_GROUPS,
    EXP: EXP, PAY: PAY
  };
})(window.BS);
