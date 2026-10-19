/* core/run.js —— 一局：部署 → 战斗（无限波） → 休整 → 撤离/失守结算。
   ------------------------------------------------------------------
   波没有尽头：休整期玩家二选一——「下一波」继续顶，或「撤离」落袋。
   撤离结算把本局战绩折成三种资源里的两样：
     · **采集尘**（原件获取资源）= 波数 × 基数 × 加成
     · **结晶**（局外成长资源）= 波数 × 基数 × 加成，撑过第 10 波另有犒赏
   辉光不结算——它是战斗所需资源，局内生、局内死。
   一局引用的是军械库的进化体（aid），战场拿到的只是属性块。

   **乱流**：由**本局的阵型**算出，作为**纯数据块**转交塔防。
   指针宇宙已经退场——它那一层是不可读的混沌（二十四条流、每拍重连、
   名词当面具），玩家能积累的只有「上次那个好像特别凶」。
   现在换成一具看得见的东西：摆下的塔本身就是一具图形，六项读数
   各接管一个战斗标量。run 是唯一同时认识战场与 essence 的地方，
   所以这张纸只能在这里算，算完就交出去——与花园加成同一套规矩。

   **撤收（本版）**：开战之后也能把一座塔摘下来——返六成辉光，塔回
   军械库（从流水里恢复，流水只增不减所以找得回）。它制造的决策是
   「这儿摆错了，是认了还是花四成搬个家」；没有它，开战即终局，
   摆位是一次性的赌博。辉光花了就是花了——撤收返的是辉光，
   重新部署要再付一次全价，所以来回搬是在付过路费，不是刷钱。

   **专精（本版）**：三块模块（破盾尖锋 / 裂界散射 / 迅捷节律）在
   **装配台**上局外花结晶装到具体一座塔上，一次性。每块模块吃一项
   读数——同一块模块装在不同图形上效果不同。run 不管装，只管
   把 rec.br 折成这一局的属性块（specsOf → TD.applyBranch）。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var T = BS.td, B = BS.build;

  var PHASES = ['deploy', 'battle', 'rest', 'over'];
  /* 结算的基数（每波尘 / 晶、犒赏、深水区、失守折扣）搬去了
     world/meta.js 的 PAY——**一张表一处写**，run 只负责照着算。
     这里留一份别名只是为了让读代码的人不必跳文件去猜 10 是哪来的。 */
  var WON_WAVE = 10;

  function current() {
    var r = BS.bus.state.run;
    if (!r || PHASES.indexOf(r.phase) < 0) return null;
    return r;
  }

  /* ---------- 战况：这一局挨多少，开局前自己勾 ----------
     参照《几何竞技场 2》的挑战卡：**难度不是一档一档选的，是一张一张勾的**，
     每一条都明码标价一个结算倍率。勾得越狠，这一局的尘 / 晶 / 阅历乘得越高。
     它把「我要打多难」从一个下拉框变成一串有价格的勾选。

     三档 tier：tier 0 起手就有，tier 1 / 2 由重塑树的「契约 I / II」解锁——
     局外成长抬的是**你能赌多大**，不是直接给你数值。 */
  function modsOf(r) {
    var mm = BS.metaDefs.mods(BS.bus.state.meta);
    var out = BS.cond.blank();
    /* 重塑的两项常驻修正在这里落到同一张纸上：它们与战况同一种东西
       （都是「这一局的参数」），所以走同一个口子，别处不许再夹一遍。 */
    out.sellRate = mm.sellRate;
    out.upDisc = mm.upDisc;
    out.leakFlat = mm.leakFlat;
    BS.cond.merge(out, BS.cond.modsOf((r && r.cond) || []));
    BS.cond.merge(out, (r && r.ordMods) || null);
    return out;
  }
  function syncMods(b, r) { if (b) T.setMods(b, modsOf(r)); return b; }

  function gradeMul(r) { return BS.cond.mulOf((r && r.cond) || []); }

  /* 能勾哪几条：tier 由重塑树的「契约」抬。 */
  function condOpen() { return BS.cond.openOf(BS.metaDefs.mods(BS.bus.state.meta).condTier | 0); }
  function setCond(r, id, on) {
    if (!r) return { ok: false, why: BS.i18n.get('没有这一局') };
    if (r.phase !== 'deploy') return { ok: false, why: BS.i18n.get('开战之后不能再改战况') };
    var c = BS.cond.BY[id], open = condOpen(), i, has = false;
    if (!c) return { ok: false, why: BS.i18n.get('没有这一条战况') };
    for (i = 0; i < open.length; i++) if (open[i].id === id) has = true;
    if (!has) return { ok: false, why: BS.i18n.get('这一条还没解锁：重塑树的「契约」能开到更狠的战况') };
    var a = (r.cond || []).slice(), ix = a.indexOf(id);
    if (on) { if (ix < 0) a.push(id); }
    else if (ix >= 0) a.splice(ix, 1);
    r.cond = a;
    /* 战况改了就得重开棋盘：它改的是**这一局的敌血与基地**，
       不是挂在墙上的倍率。留着旧的 b，玩家会看到「勾了却没变」。 */
    if (r.battle) { r.battle = startBattle(r); syncFlux(r.battle); }
    BS.bus.state.meta.lastCond = a.slice();
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, cond: a, mul: gradeMul(r) };
  }

  /* ---------- 战备指令：波与波之间的三选一 ----------
     旧版的休整期只有一个二选一（下一波 / 撤离），于是「运营」在一整局里
     只发生过一次。现在每打完一波摊三张指令，选一张——**每一张都有得有付**。
     对标《明日方舟》集成战略的节点分支：每一层走哪条路，决定这一局的
     资源形状；这里把地图折成三张卡，因为塔防没有地图可走。

     候选走**种子派生的子流**，同局同波永远同样的三张——可复现这条不能破，
     否则「重开一局刷一组好指令」就成了最优解。 */
  function ordSlots() { return 3 + (BS.metaDefs.mods(BS.bus.state.meta).ordSlots | 0); }
  function offerOf(r) {
    if (!r || !r.battle) return [];
    var w = r.battle.wave | 0;
    if (r.offer && r.offerWave === w) return r.offer;
    var adv = !!BS.metaDefs.mods(BS.bus.state.meta).ordAdv;
    r.offer = BS.orders.offerN((r.seed | 0) + (r.offerSalt | 0) * 7919, w, ordSlots(), adv);
    r.offerWave = w;
    return r.offer;
  }
  function reroll(r) {
    if (!r || r.phase !== 'rest') return { ok: false, why: BS.i18n.get('只有波与波之间能重掷') };
    if ((r.rerollLeft | 0) <= 0) return { ok: false, why: BS.i18n.get('本局的重掷已经用掉了') };
    r.rerollLeft = (r.rerollLeft | 0) - 1;
    r.offerSalt = (r.offerSalt | 0) + 1;
    r.offer = null;
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, list: offerOf(r), left: r.rerollLeft };
  }
  function pick(r, id) {
    if (!r) return { ok: false, why: BS.i18n.get('没有这一局') };
    if (r.phase !== 'rest') return { ok: false, why: BS.i18n.get('只有波与波之间能下令') };
    var o = BS.orders.BY[id];
    if (!o) return { ok: false, why: BS.i18n.get('没有这一条指令') };
    /* **一波一次**：三张卡都摊在桌上，但这一波只许下一次令。
       旧版没有这道闸门——三张都能点，而 `now()` 是**立即**兑现的
       （加辉光 / 加基地生命 / 加容机），于是「三张全点」等于白拿三份。
       旧版那道「同一条指令本局只能下过一次」反而是拦错了地方：
       它拦的是「同一条在**后面的波**里再来一次」——那正是这一部
       想要的重复决策（同样的取舍，在不同的局面下再答一遍）。
       现在：按波去重（防三连点），不按局去重（同一条可以再来）。 */
    var w = r.battle ? (r.battle.wave | 0) : 0;
    if ((r.ordAtWave | 0) === w) return { ok: false, why: BS.i18n.get('这一波已经下过令了——下一波再选') };
    var of = offerOf(r);
    if (of.length && of.indexOf(id) < 0) return { ok: false, why: BS.i18n.get('这一条不在桌上') };
    if (o.now) o.now(r, r.battle);
    r.ordMods = o.mods || null;
    r.ordAtWave = w;
    if (!r.ordTaken) r.ordTaken = [];
    r.ordTaken.push(id);
    r.offer = null; r.offerWave = -1;
    syncMods(r.battle, r);
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, id: id, give: o.give, pay: o.pay };
  }

  /* ---------- 开一局新的 ---------- */
  function newRun(seed, conds) {
    var mm = BS.metaDefs.mods(BS.bus.state.meta);
    var r = {
      seed: BS.seed.runSeed(seed),
      phase: 'deploy',
      deployed: [],            /* [{ aid, at, cost, pri }] */
      fund: mm.startFund | 0,  /* 起手拨付：升级商店白给的一笔，不算已花 */
      spent: 0,
      battle: null,
      result: null,
      at: Date.now(),
      /* 战况：默认沿用上一局勾的那几条——连开十局不该勾十遍。 */
      cond: (conds && conds.length ? conds.slice() : (BS.bus.state.meta.lastCond || []).slice()),
      /* 战备指令：候选是**本局定下来的**，所以存在这一局上。
         ordMods 是「下一波」那一半，波一打完就清掉。 */
      offer: null, offerWave: -1, offerSalt: 0,
      /* ordTaken 是**这一局下过哪些**的流水（给界面与战绩看），不是闸门；
         闸门是 ordAtWave：记着上一次下令是在第几波。 */
      ordTaken: [], ordMods: null, ordAtWave: -1,
      rerollLeft: mm.ordReroll | 0,
      peek: 0,
      garageBonus: 0
    };
    /* 越界的战况（存档被改过 / 节点被撤）在这里滤掉，别带进战斗 */
    var open = condOpen(), keep = [], i;
    for (i = 0; i < r.cond.length; i++) if (BS.cond.BY[r.cond[i]] && open.indexOf(BS.cond.BY[r.cond[i]]) >= 0) keep.push(r.cond[i]);
    r.cond = keep;
    BS.bus.state.meta.lastCond = r.cond.slice();
    BS.bus.state.run = r;
    BS.bus.save();
    BS.bus.emit('run');
    return r;
  }

  /* 一局的预算 = build.budget()（基础 + 成就 + 升级 + 重塑）。花园不再给预算——
     本版起它只管战斗面（伤害/攻速/射程/暴击/掉落），见 core/build.js。
     升级里的「起手拨付」是**开局白给的一笔**，记在 r.fund 上——
     它不进 spent，所以「已花 / 剩余」两个数字读起来更清楚：
     玩家看到的是「我还有多少能花」。
     战况的「节流」是**这一局**的折扣，所以乘在这一局的总预算上。 */
  function budgetOf(r) {
    return Math.max(1, Math.round((B.budget() + (r.fund | 0)) * modsOf(r).budgetMul));
  }
  function left(r) { return budgetOf(r) - r.spent; }

  /* 容机上限：这一局最多能部署几座。0 表示不限（没买过升级时的旧口径）。 */
  function garageCap(r) {
    var g = BS.metaDefs.mods(BS.bus.state.meta).garage | 0;
    var md = modsOf(r);
    var cut = md.garageCut | 0, bonus = r ? (r.garageBonus | 0) : 0;
    if (!(g > 0) && !(cut > 0) && !(bonus > 0)) return 0;
    return Math.max(1, 8 + g - cut + bonus);
  }

  /* 军械库里的编号 → 进化体记录 */
  function recOf(aid) {
    var arm = BS.bus.state.armory || [], i;
    for (i = 0; i < arm.length; i++) if (arm[i].id === aid) return arm[i];
    return null;
  }

  /* ---------- 阵型：本局摆下的塔，就是一具图形 ----------
     这是指针宇宙退场之后接上的那一头。
     做法：把已部署的塔拓成一具 body，交给 essence 的**原套六项读数**
     （与工坊图纸、花园全园同一把尺子，一格未改）。
     1×1 的点阵会读出一批极端的数——那本身就是信息：散着摆，
     点与点不相邻，环络恒 0；密排成一片，环络才上得来。
     于是「摆得密还是摊开覆盖」从一个战斗问题变成同时是几何问题。

     为什么它必须算在这里：td.js 不许 import body / essence
     （门禁钉着 BS.body 与 BS.essence 都在禁用清单里）。 */
  var FMAP = {
    even:   { k: 'dmgMul',   a: 0.30 },
    repeat: { k: 'rateMul',  a: 0.30 },
    void:   { k: 'rangeAdd', a: 0.60, also: { k: 'pierceAdd', a: 2 } },
    sym:    { k: 'projAdd',  a: 2 },
    weave:  { k: 'chainAdd', a: 2, also: { k: 'slowMul', a: 0.30 } },
    edge:   { k: 'critP',    a: 0.22 }
  };
  var FKEYS = ['even', 'repeat', 'void', 'sym', 'weave', 'edge'];

  function formation(b) {
    if (!b || !b.towers || !b.towers.length) return null;
    var bd = BS.body.mk(), i, t;
    for (i = 0; i < b.towers.length; i++) {
      t = b.towers[i];
      bd.cells[t.cx + ',' + t.cy] = { e: 'f' + i, r: 0, ox: t.cx, oy: t.cy };
    }
    var st = BS.body.stats(bd, function () { return { w: 1, rar: 0, lv: 0 }; });
    return {
      n: st.n,
      es: { sym: st.esSym, repeat: st.esRepeat, void: st.esVoid,
            even: st.esEven, weave: st.esWeave, edge: st.esEdge },
      esScore: st.esScore || 0, peak: st.esPeak || null
    };
  }

  /* 阵型 → 乱流块。**峰值那一项是双刃**：它既是你的强项，
     也是这一局敌人的厚度（hpMul）。所以「偏科」是有代价的，
     而代价写在同一块面板上——读得懂，才叫决策。
     两项与塔数挂钩：围得越厚漏怪越少，塔越多辉光产出越高。 */
  function formationFlux(b) {
    var f = formation(b);
    if (!f) return null;
    /* 两条阵型旋钮（升级商店「阵型」组）：读数的幅度、峰值的反噬。
       零级 = 1，所以没买过的存档读出来与从前逐字一致。 */
    var mm = (BS.metaDefs && BS.metaDefs.mods) ? BS.metaDefs.mods(BS.bus.state.meta) : null;
    var gain = (mm && mm.formScale) || 1, relief = (mm && mm.formRelief) || 1;
    var fx = { form: f }, i, k, m, v, w;
    for (i = 0; i < FKEYS.length; i++) {
      k = FKEYS[i]; m = FMAP[k]; v = f.es[k] || 0;
      fx[m.k] = (m.k === 'dmgMul' || m.k === 'rateMul' || m.k === 'slowMul') ? (1 + m.a * v * gain)
        : (m.k === 'critP' || m.k === 'rangeAdd') ? (m.a * v * gain) : Math.round(m.a * v * gain);
      if (m.also) {
        w = m.also;
        fx[w.k] = (w.k === 'dmgMul' || w.k === 'rateMul' || w.k === 'slowMul') ? (1 + w.a * v * gain)
          : (w.k === 'critP' || w.k === 'rangeAdd') ? (w.a * v * gain) : Math.round(w.a * v * gain);
      }
    }
    fx.leakCut = 0.18 * Math.min(1, f.n / 12);
    fx.luxMul = 1 + 0.25 * Math.min(1, f.n / 8);
    fx.hpMul = 1 + 0.20 * (f.es[f.peak] || 0) * relief;
    return fx;
  }

  /* 部署变了就重算：补塔、撤收、拆塔都会让阵型换一张脸。
     它只依赖部署，所以「同种子同部署逐 tick 一致」一个字都没破。 */
  function syncFlux(b) {
    if (!b) return;
    T.setFlux(b, formationFlux(b));
  }

  /* 花园加成：局外种植 → 战斗面的那一张纸。
     它是**纯数据块**，与 flux 同一种东西——run 是唯一同时认识
     花园与塔防的地方，所以这张纸只能在这里算，算完就交出去。
     塔防不认识花园，这条边界有门禁钉着。 */
  function buffsNow() {
    try {
      if (BS.garden && BS.garden.buffs) return BS.garden.buffs();
    } catch (e) { /* 由它去，退化成中性 */ }
    return T.buffsNeutral();
  }

  /* 起一局战斗。加成（buffs）来自局外种植，与钟无关，起手挂上就行；
     乱流不在这里挂——它由 syncFlux 在**部署定下来那一刻**装上
     （begin / 补塔 / 撤收 / 拆塔各一次）。阵型只依赖部署，
     所以两遍同样的战斗，乱流逐字节一致。 */
  function startBattle(r) {
    var mm = BS.metaDefs.mods(BS.bus.state.meta);
    /* 战况与指令作为**第三张纯数据纸**交出去（与乱流、花园加成同一种东西）：
       塔防不认识战况，它只吃一张已经算好的标量表。 */
    var b = T.start({ seed: r.seed, turrets: specsOf(r), buffs: buffsNow(), mods: modsOf(r) });
    /* 重塑树的三项开局条件在这里落：它们改的是**这一局的起手**，
       不是塔的属性块，所以放在战场上而不是 spec 里。 */
    if (mm.startLux > 0) b.lux = (b.lux | 0) + (mm.startLux | 0);
    if (mm.baseHpAdd > 0) b.baseHp = Math.min(T.BASE_HP, (b.baseHp | 0) + (mm.baseHpAdd | 0));
    if (mm.startLevel > 0) {
      for (var i = 0; i < b.towers.length; i++) b.towers[i].level = mm.startLevel | 0;
    }
    return b;
  }

  /* 在库记录 → 这一局要用的属性块。**专精在这里落地**（与乱流、花园
     同一套规矩）：模块是局外装在 rec.br 上的，效果由 TD.applyBranch
     现算成一份新的属性块——共享的那份 spec 不沾，别局与流水都不受影响。
     specsOf（开战）与 add（局中补塔）都必须走这一个口子，
     漏一处就是「装了模块的塔补进来却不生效」的半修状态。 */
  function specFor(rec) {
    return {
      spec: rec.br ? T.applyBranch(rec.spec, rec.br) : rec.spec,
      br: rec.br || null
    };
  }

  /* 已部署的进化体 → [{ spec, at, pri, br }]：TD 只认这个 */
  function specsOf(r) {
    var out = [], i;
    for (i = 0; i < r.deployed.length; i++) {
      var rec = recOf(r.deployed[i].aid);
      if (!rec) continue;
      var sp = specFor(rec);
      out.push({ spec: sp.spec, at: r.deployed[i].at, pri: r.deployed[i].pri,
        br: sp.br, cost: r.deployed[i].cost });
    }
    return out;
  }

  /* ---------- 部署阶段：落位与撤回 ----------
     **开局之后也能放塔**（本版修掉的老 bug）：
     旧写法把 add() 整个锁在 phase === 'deploy' 里，于是「开战」之后
     军械库里剩下的塔再也摆不下去——玩家眼睁睁看着库存烂掉，
     而塔防的乐趣有一半是「打着打着发现这儿该补一座」。
     现在三种相位都能放，区别只在**钱从哪儿出**：
       · deploy：走部署预算（budget），撤回全额退款（未开战，没有沉没成本）
       · battle / rest：走本局辉光（b.lux），且**当场消耗军械库记录**——
         局中补的塔没有「撤回」可言，辉光花了就是花了。
     这条边界必须说清楚：预算是一局的起手资本，辉光是局中挣的。
     两笔钱混在一起，「我先部署满再开战」和「留着辉光局中补」就不再是两个选择了。 */
  function add(r, aid, at) {
    if (r.phase !== 'deploy' && r.phase !== 'battle' && r.phase !== 'rest')
      return { ok: false, why: BS.i18n.get('这一局已经结束了') };
    var rec = recOf(aid);
    if (!rec) return { ok: false, why: BS.i18n.get('军械库里没有这一座') };
    if (r.deployed.some(function (d) { return d.aid === aid; }))
      return { ok: false, why: BS.i18n.get('这座已经部署过了') };
    var cap = garageCap(r);
    if (cap > 0 && r.deployed.length >= cap)
      return { ok: false, why: BS.i18n.get('容机已满：# 座。升级商店的「容机预算」能扩。').replace('#', cap) };
    if (!r.battle) r.battle = startBattle(r);
    var why = T.deployOk(r.battle, at);
    if (why) return { ok: false, why: why };
    var cost = rec.cost, midRun = r.phase !== 'deploy';
    var pool = midRun ? (r.battle.lux | 0) : left(r);
    if (cost > pool) {
      return { ok: false, why: midRun
        ? BS.i18n.get('辉光不够：这一座要 # 辉光，本局还剩 # 辉光').replace('#', cost).replace('#', pool)
        : BS.i18n.get('预算不够：这一座要 # 辉光，还剩 # 辉光').replace('#', cost).replace('#', pool) };
    }
    if (midRun) r.battle.lux -= cost;
    else r.spent += cost;
    var sp = specFor(rec);
    T.addTower(r.battle, sp.spec, at, 'first', sp.br, cost);
    syncFlux(r.battle);
    r.deployed.push({ aid: aid, at: [at[0], at[1]], cost: cost, pri: 'first' });
    /* 局中补塔：军械库记录当场消耗。部署阶段的记录则等 begin() 一次性消耗——
       两条路径都要擦，漏一条就会出现「同一座塔既在战场上又在库裡」。 */
    if (midRun) dropFromArmory(aid);
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, cost: cost, left: midRun ? (r.battle.lux | 0) : left(r), midRun: midRun };
  }

  /* 从军械库抹掉一座（不碰流水——流水是底账，见 shop.recSnap）。 */
  function dropFromArmory(aid) {
    var arm = BS.bus.state.armory || [], w = 0, i;
    for (i = 0; i < arm.length; i++) if (arm[i].id !== aid) arm[w++] = arm[i];
    arm.length = w;
    BS.bus.emit('armory');
  }

  /* 部署阶段撤回：钱全回来（未开战，没有沉没成本可言） */
  function remove(r, idx) {
    if (r.phase !== 'deploy') return { ok: false, why: BS.i18n.get('这一局已经开战，不能再改部署') };
    if (idx < 0 || idx >= r.deployed.length) return { ok: false, why: BS.i18n.get('没有这一座') };
    r.deployed.splice(idx, 1);
    r.spent = 0;
    var i;
    for (i = 0; i < r.deployed.length; i++) r.spent += r.deployed[i].cost;
    r.battle = startBattle(r);
    syncFlux(r.battle);
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, left: left(r) };
  }

  /* ---------- 开战 ---------- */
  function begin(r) {
    if (r.phase !== 'deploy') return { ok: false, why: BS.i18n.get('这一局已经开战了') };
    if (!r.deployed.length) return { ok: false, why: BS.i18n.get('还没有部署任何东西') };
    var b = startBattle(r);          /* 阵型：部署定下来那一刻就定版 */
    syncFlux(b);
    r.battle = b;
    r.phase = 'battle';
    consumeDeployed(r);
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true };
  }

  /* 开战即承诺：这一局部署的进化体从军械库真正消耗掉（撤回只限部署阶段）。 */
  function consumeDeployed(r) {
    if (!r.deployed.length) return;
    var ids = {}, i;
    for (i = 0; i < r.deployed.length; i++) ids[r.deployed[i].aid] = 1;
    var arm = BS.bus.state.armory, w = 0;
    for (i = 0; i < arm.length; i++) if (!ids[arm[i].id]) arm[w++] = arm[i];
    arm.length = w;
  }

  /* ---------- 进入休整期 ----------
     上一张指令的账已经付完了（那一波打完了），所以把它清掉，
     顺手摊出新的一桌候选。**指令跟着波走，不跟局走**——留着它，
     「上一波的加固」会莫名其妙压住下一波。
     它必须是**一个函数**：界面那条路（时钟推进到波末）与这条
     （step 推完一波）都得走它，漏一条就会出现「指令永远挂着」。 */
  function toRest(r) {
    r.phase = 'rest';
    r.ordMods = null;
    r.peek = 0;
    syncMods(r.battle, r);
    offerOf(r);
    BS.bus.save();
    BS.bus.emit('run');
    return r;
  }

  /* ---------- 推进一波；rest 时返回波间，over 时结算 ---------- */
  function step(r) {
    if (r.phase !== 'battle' && r.phase !== 'rest') return { ok: false, why: BS.i18n.get('现在不能推进') };
    /* 乱流不再随波重掷：它跟着**部署**走。部署不变，波与波之间
       就是同一张脸——于是「这一波偏什么」是个稳定的观察，
       而不是每波换一次的雪花。 */
    var out = T.wave(r.battle);
    if (out.phase === 'rest') {
      toRest(r);
      return { ok: true, phase: 'rest', wave: out.wave, lux: r.battle.lux, baseHp: r.battle.baseHp,
        flux: r.battle.flux };
    }
    settle(r, false);
    return { ok: true, phase: r.phase, result: r.result };
  }

  /* ---------- 升级 / 改目标优先级 / （专精在装配台） ----------
     升级**战斗中也行**（用户报的 bug：原先只许波与波之间升，
     于是「打到一半发现这座该升」没有出口）。这跟辉光的性质是自洽的：
     辉光在击杀里挣、在局内花，所以它跟着战斗走，而不是只在波间结算。
     只有两个相位不给升——`deploy`（还没开打，钱是预算不是辉光）
     与 `over`（这一局已经完了）。 */
  function up(r, idx) {
    if (r.phase !== 'battle' && r.phase !== 'rest')
      return { ok: false, why: BS.i18n.get('现在不能升级——要在这一局里（战斗或休整）') };
    var out = T.upgrade(r.battle, idx);
    if (out.ok) { BS.bus.save(); BS.bus.emit('run'); }
    return out;
  }
  function pri(r, idx, p) {
    if (!r.battle) return { ok: false, why: BS.i18n.get('没有这座塔') };
    var out = T.setPri(r.battle, idx, p);
    if (out.ok) {
      if (r.deployed[idx]) r.deployed[idx].pri = p;
      BS.bus.save();
      BS.bus.emit('run');
    }
    return out;
  }
  /* 专精：局外装在在库记录上（shop.fit，花结晶），这里只负责
     把效果折进这一局的属性块——落地在 specsOf 的 applyBranch。
     波与波之间**没有**专精入口：立场是出发前选的，不是局中改的。 */

  /* ---------- 撤收：开战之后摘塔，返六成辉光 ----------
     为什么返六成而不是全退：部署阶段撤回全额（未开战，没有沉没成本），
     开战之后撤收返六成——搬一次家付四成过路费。全额退款会让
     「先随便摆上去试试」零成本，摆位就不再是决策。
     塔回军械库（从流水恢复），所以「搬到哪儿去」仍然开放；
     重新部署要再付一次全价辉光——这就是过路费。 */
  var SELL_RATE = 0.6;
  function sell(r, idx) {
    if (!r.battle) return { ok: false, why: BS.i18n.get('没有这一座') };
    if (r.phase !== 'battle' && r.phase !== 'rest')
      return { ok: false, why: BS.i18n.get('部署阶段请用撤回（全额退款）') };
    var d = r.deployed[idx];
    if (!d) return { ok: false, why: BS.i18n.get('没有这一座') };
    /* 回扣从**这一局那张纸**上读：重塑的「折价回收」与指令的
       「精简 / 清拆」都改这同一个数，所以这里只有一个来源。 */
    var back = Math.max(1, Math.floor(d.cost * modsOf(r).sellRate));
    T.removeTower(r.battle, idx);
    r.deployed.splice(idx, 1);
    r.battle.lux = (r.battle.lux | 0) + back;
    syncFlux(r.battle);
    /* 塔回库：流水只增不减，所以从流水里恢复一份独立副本。
       恢复失败（理论上不会——流水写在提交那一刻）也别把塔吞了。 */
    if (!restoreToArmory(d.aid)) {
      BS.bus.log(BS.i18n.get('撤收的塔没能回到军械库（流水里找不到它）'), 'sys');
    }
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true, back: back, left: r.battle.lux | 0 };
  }
  /* ---------- 质变口：选完要写回流水 ----------
     开战即消耗：军械库里那条记录在 begin() 时就没了，战场上长出来的
     形变只能落到**流水**上（底账只增不减，本来就应该记住
     「这座塔后来长成了什么」）。撤收从流水恢复，所以形变跟着回家。
     写在库记录是错的：局中那条已经被消耗掉了。 */
  function logMut(aid, mut) {
    var log = BS.bus.state.armoryLog || [], i;
    for (i = 0; i < log.length; i++) {
      if (log[i].id !== aid) continue;
      if (!Array.isArray(log[i].mut)) log[i].mut = [];
      if (log[i].mut.indexOf(mut) < 0) log[i].mut.push(mut);
      return true;
    }
    return false;
  }
  function chooseMut(r, idx, id) {
    if (!r.battle) return { ok: false, why: BS.i18n.get('没有这一局') };
    var d = r.deployed[idx];
    if (!d) return { ok: false, why: BS.i18n.get('没有这座塔') };
    var out = T.choose(r.battle, idx, id);
    if (!out.ok) return out;
    logMut(d.aid, id);
    BS.bus.save();
    BS.bus.emit('run');
    return out;
  }

  /* ---------- 殉爆：伤害在 td 里算，收尾在这里 ----------
     塔回军械库（从流水恢复）、返六成辉光——与撤收同一条过路费口径。
     殉爆是「这座塔可以死」的兑现：它换来的是一次范围伤害，
     付的是这座塔本身。 */
  function detonate(r, idx) {
    if (!r.battle) return { ok: false, why: BS.i18n.get('没有这一局') };
    if (r.phase !== 'battle' && r.phase !== 'rest')
      return { ok: false, why: BS.i18n.get('只有这一局里才能殉爆') };
    var d = r.deployed[idx];
    if (!d) return { ok: false, why: BS.i18n.get('没有这座塔') };
    var out = T.detonate(r.battle, idx);
    if (!out.ok) return out;
    r.deployed.splice(idx, 1);
    r.battle.lux = (r.battle.lux | 0) + out.back;
    syncFlux(r.battle);
    if (!restoreToArmory(d.aid)) {
      BS.bus.log(BS.i18n.get('殉爆的塔没能回到军械库（流水里找不到它）'), 'sys');
    }
    BS.bus.save();
    BS.bus.emit('run');
    return out;
  }

  /* 从提交流水恢复一座塔进军械库。独立副本——在库记录与流水
     必须各是各的对象，同引用的话历史就能被在库记录改写。 */
  function restoreToArmory(aid) {
    var log = BS.bus.state.armoryLog || [], i;
    for (i = 0; i < log.length; i++) {
      if (log[i].id === aid) {
        BS.bus.state.armory.push(BS.shop.recSnap(log[i]));
        BS.bus.emit('armory');
        return true;
      }
    }
    return false;
  }

  /* ---------- 撤离（休整期主动结算）：won = 撑过第 10 波 ---------- */
  function leave(r) {
    if (r.phase !== 'rest') return { ok: false, why: BS.i18n.get('只有波与波之间可以撤离') };
    return { ok: true, result: settle(r, true) };
  }

  /* ---------- 结算：收益入账 + 阅历登记 + 成就判定 ----------
     **撤离与失守不再是同一笔账**（本版最关键的一条）。
     旧版两笔账逐字相同，于是最优解是「永远点下一波直到死」——
     撤离按钮是一个假决策，整局没有任何一处需要你判断「够了没有」。
     现在：
       · 撤离：波数收益**全额** + 剩余基地生命折算 + 撑过第 10 波的犒赏 + 阅历全额
       · 失守：波数收益**打折**（重塑「抚恤」可抬到七成五）+ 没有犒赏 + 阅历记一半
     这就是**贪吃蛇的那一口**：多撑一波多一段收益，撑不住就把已经攒下的
     赔进去一部分。有了这个差，「见好就收」才第一次是个问题。

     深水区递增是它的另一半：第 10 波之后每一波的收益都在变重，
     所以「继续」的诱惑是真的——两条一起，撤与不撤才都有话说。
     （递增的斜率参照《几何竞技场 2》的难度倍率思路：越深越值钱，
     而不是线性地每波 +6。） */
  function settle(r, voluntary) {
    var b = r.battle, st = BS.bus.state.meta;
    var maxSym = 0, bestEs = 0, i, k;
    for (i = 0; i < b.towers.length; i++) {
      if (b.towers[i].a.es.sym > maxSym) maxSym = b.towers[i].a.es.sym;
      if (b.towers[i].a.esScore > bestEs) bestEs = b.towers[i].a.esScore;
      st.formsUsed[b.towers[i].a.form] = (st.formsUsed[b.towers[i].a.form] || 0) + 1;
    }
    var won = !!(voluntary && b.wave >= WON_WAVE && b.baseHp > 0);
    var lost = !voluntary;                    /* 失守 / 放弃：同一条折扣口径 */
    var gm = BS.garden ? BS.garden.mods() : {}, mm = BS.metaDefs.mods(st);
    var P = BS.metaDefs.PAY;
    var mul = gradeMul(r);
    var deepMul = 1 + (mm.deepStep || 0) * Math.max(0, b.wave - P.DEPTH_FROM);
    var rate = lost ? mm.lostRate : 1;
    var hpBonus = voluntary ? Math.max(0, b.baseHp) * P.HP_BONUS : 0;
    var dustBase = P.DUST_PER_WAVE * b.wave * deepMul;
    var cryBase = P.CRYSTAL_PER_WAVE * b.wave * deepMul;
    var dropPct = mm.dustPct + (gm.dropPct || 0);
    var cryPct = mm.crystalPct + (gm.dropPct || 0);
    var dustGain = Math.round((dustBase * rate + hpBonus) * (1 + dropPct / 100) * mul);
    var crystalGain = Math.round(cryBase * rate * (1 + cryPct / 100) * mul)
      + (won ? P.WON_BONUS_CRYSTAL : 0);
    BS.bus.state.dust += dustGain;
    BS.bus.state.crystal += crystalGain;

    /* 阅历：把这一局记下来。**逐条列得出来源**才算登记，
       只给一个总数的话，玩家学不会「我该多撑一波还是早点撤」。 */
    var kills = 0;
    for (k in b.kills) kills += b.kills[k] | 0;
    var exp = BS.meta.addExp({ wave: b.wave, kills: kills, won: won, lost: lost, mul: mul });

    var ctx = {
      won: won,
      wave: b.wave,
      baseHp: Math.max(0, b.baseHp),
      baseMax: T.BASE_HP,
      maxSym: maxSym,
      bestEs: bestEs,
      chainKills: b.chainKills,
      formsUsed: Object.keys(st.formsUsed).length,
      bestWave: st.best.waves | 0,
      draws: st.draws | 0,
      maxGarEs: st.maxGarEs | 0,
      voluntary: !!voluntary
    };
    st.runs = (st.runs | 0) + 1;
    if (won) st.wins = (st.wins | 0) + 1;
    if (ctx.wave > (st.best.waves | 0)) st.best.waves = ctx.wave;
    if (ctx.baseHp > (st.best.baseHp | 0)) st.best.baseHp = ctx.baseHp;
    if (maxSym > (st.maxSym | 0)) st.maxSym = maxSym;
    if (bestEs > (st.bestEs | 0)) st.bestEs = bestEs;
    if (b.chainKills > (st.chainKills | 0)) st.chainKills = b.chainKills;
    var newly = BS.meta.scan(ctx);
    BS.bus.pushRun({
      seed: r.seed, wave: ctx.wave, won: ctx.won,
      baseHp: ctx.baseHp, lux: b.lux, dust: dustGain, crystal: crystalGain,
      kills: kills, exp: exp.total, lost: lost, mul: mul, cond: (r.cond || []).slice(),
      at: Date.now()
    });
    r.phase = 'over';
    r.result = {
      over: b.over || { phase: voluntary ? 'left' : 'lost', wave: b.wave },
      newly: newly, ctx: ctx, dust: dustGain, crystal: crystalGain,
      /* 结算页照着这几项把账逐条写出来——**登记**的意思就是
         「每一笔你都能指出它从哪来」。 */
      lost: lost, rate: rate, mul: mul, deepMul: deepMul,
      hpBonus: Math.round(hpBonus), exp: exp, cond: (r.cond || []).slice()
    };
    BS.bus.save();
    BS.bus.emit('run');
    return r.result;
  }

  /* 放弃这一局（往战绩里记一笔） */
  function abandon(r) {
    if (r.phase === 'over' || !r) return { ok: false };
    settle(r, false);
    BS.bus.save();
    BS.bus.emit('run');
    return { ok: true };
  }

  BS.run = {
    PHASES: PHASES, WON_WAVE: WON_WAVE, SELL_RATE: SELL_RATE,
    current: current, newRun: newRun, left: left, budgetOf: budgetOf,
    garageCap: garageCap, recOf: recOf,
    add: add, remove: remove, begin: begin, step: step, up: up, pri: pri,
    sell: sell, leave: leave, settle: settle, abandon: abandon,
    chooseMut: chooseMut, detonate: detonate, logMut: logMut,
    formation: formation, formationFlux: formationFlux, syncFlux: syncFlux,
    /* 战况与战备指令：一局的运营面。 */
    modsOf: modsOf, syncMods: syncMods, gradeMul: gradeMul,
    condOpen: condOpen, setCond: setCond,
    ordSlots: ordSlots, offerOf: offerOf, reroll: reroll, pick: pick, toRest: toRest,
    dropFromArmory: dropFromArmory
  };
})(window.BS);
