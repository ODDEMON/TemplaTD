/* core/td.js —— 塔防战斗：纯算法模拟（无限模式）。
   ------------------------------------------------------------------
   本版的根本决策：塔防是一个**独立的系统**。它与图形工坊之间
   只有「进化」一座桥——工坊提交出炮塔，塔防拿到的只是**属性块**。
   这里不认识元件、不认识稀有度、不认识型与特质：一座塔占一格，
   没有墙，没有旋转，没有任何来自图形系统的概念漏进来。

   **无限模式**：波没有尽头，waves.scale() 让 HP / 速度 / 报酬一路上顶；
   终局只由基地生命写。每一座塔可设**目标优先级**（最前 / 最强 / 贴身）。
   每一次开火都记进弹道表（b.beams），渲染层拿它画线——判定仍是纯算法，
   弹道只是判定的可见面。

   **乱流（本版）**：opts.flux 是一个**纯数据块**，与 spec 同一种东西。
   塔防仍然不知道图形工坊存在、不知道哪一项读数在动它——它只读一个
   已经算好的标量集合，逐项作用在开火上：
     dmgMul 伤害倍率 / rateMul 攻速倍率 / rangeAdd 射程加成（格）
     splashAdd 溅射 +n 圈 / chainAdd 连锁 +n 跳 / slowMul 减速幅度倍率
     projAdd 散射 +n 弹 / pierceAdd 穿透 +n / critP 暴击概率
     leakCut 漏怪减免（基地护盾）/ luxMul 辉光产出倍率 / hpMul 敌血倍率
   **它的来源换了**：以前由指针宇宙每拍重掷（不可读的混沌），
   现在由**本局的阵型**算出来——摆下的塔本身是一具图形，六项读数
   各接管一个标量，峰值那一项同时抬高一格敌血。所以乱流不再掷骰子，
   它是**玩家自己摆出来的形状**，看得见、改得动、读得懂。
   算那张纸的是 run.js（它同时认识战场与 essence），这里只吃数据。
   **乱流可以变，但边界在这里封死**：缺省值一律为「不作用」，
   每一项在使用点再钳一次。哪怕传进来一个畸形的块，战斗也不会崩，
   只会退化成「没有乱流」——这是可玩性的最后一道保险丝。

   **质变口（本版）**：第 2 / 5 / 10 级各开一口，**一口一条规则**，最多三口。
   三个候选由这座塔自己的六项读数排序得出——菜单是算出来的，
   不是抄来的。选完就焊死（想换请进化下一座），所以「这座塔往哪儿长」
   是三个只能各做一次的决定。
   （旧版写在第 3 / 6 / 9 级且允许同口叠加：封顶是 9，第三口永远开不了，
     而「可以叠」把「选一条」稀释成「选三条」。两处都改掉了。）

   **邻接回路（本版）**：相邻的两座塔按各自读数的峰值算一个接缝——
   共振（同峰值且都不响）互相抬一手，干涉（同峰值且都太响）伤害打折
   换射程，互补（峰值不同且都够响）互相读到对方峰值的一半。
   于是**排列顺序**第一次有意义：摆位从「覆盖哪些格」变成「谁挨着谁」。

   **护盾（本版）**：第 8 波起重甲与首领带盾。规则一条：盾先吃；
   单体（直击 / 近战）打盾五成，溅射 / 连锁 / 穿透 / 灼烧全额。
   于是「留一路非单体火力」成为局内的真决策，而每波重掷的
   splash / chain / pierce 乱流从此有战术含义。

   **专精（本版）**：装配台上的三块模块（破盾尖锋 / 裂界散射 / 迅捷节律），
   局外花结晶装到具体一座塔上，一次性。每块模块吃一项读数——同一块模块
   装在不同图形上效果不同。落地只有 applyBranch() 一个纯函数：
   拷一份属性块再改，输入那块（在库记录）不沾；相位与结晶归 run / shop 管。

   flux 来自阵型（run.js 算好的纯数据块），而阵型只在**部署变了**的
   那一刻重算：补塔、撤收、拆塔都会让它换一张脸。同一局跑两遍，
   只要部署一样，逐 tick 结果逐字节一致。

   一场战斗 = 部署与种子的纯函数：同部署同种子，逐 tick 结果逐字节一致。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var SD = BS.seed, E = BS.eff, EN = BS.enemies, WV = BS.waves;

  /* 战场 22×14。上一版是 16×10——摆位太挤，「谁挨着谁」这门学问还没展开
     就用完了。面积翻倍之后邻接回路才真的有的可算：一条路上能并排坐下
     三四座塔，接缝从偶尔变成常态。
     代价如实记着：可摆的格多了，难度墙会往后挪（_balance.mjs 量过）。 */
  var COLS = 22, ROWS = 14, TICK = 0.5;   /* 战场与逻辑 tick */
  var BASE_HP = 15;                        /* 基地生命 */
  var SPAWN_GAP = 0.8;                     /* 波内每只敌人的出生间隔（秒） */
  var WAVE_TICKS = 900;                    /* 单波 tick 上限：450 秒，防死循环 */
  var CHAIN_FALL = 0.75;                   /* 连锁每跳的伤害留存 */
  var SPLASH_MUL = 0.5;                    /* 溅射伤害比例 */
  var MELEE_RANGE = 1.5;                   /* 近战生效距离（切比雪夫） */
  var LV_STEP = 0.25;                      /* 每级塔伤害 +25% */
  var LV_BASE = 40, LV_GROW = 1.7;         /* 升级成本 */

  function key(i, j) { return i + ',' + j; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  function num(x, d) { return (typeof x === 'number' && isFinite(x)) ? x : d; }
  function cl(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  /* ---------- 乱流：把外来块折成「绝不会崩」的一套标量 ----------
     flux 为空 / 畸形 / 少字段，一律退化成中性（不作用）。
     每一项都在这里钳死，使用点不再假设任何东西。

     注意：**可读的那一面（接线表 / 活性流 / 拍 / 压力）必须原样留着。**
     它们不参与判定，但战场浮层与日志靠它们说话；把它们一起滤掉，
     「名词即裁判」就会变成看不见的——这是本版翻过一次的坑。 */
  var FLUX1 = {
    dmgMul: 1, rateMul: 1, rangeAdd: 0, splashAdd: 0, chainAdd: 0, slowMul: 1,
    projAdd: 0, pierceAdd: 0, critP: 0, leakCut: 0, luxMul: 1, hpMul: 1
  };
  function fluxOf(src) {
    var s = src || {}, f = {}, k;
    for (k in FLUX1) f[k] = FLUX1[k];
    f.dmgMul = cl(num(s.dmgMul, 1), 0.55, 1.75);
    f.rateMul = cl(num(s.rateMul, 1), 0.55, 1.75);
    f.rangeAdd = cl(num(s.rangeAdd, 0), -0.8, 1.2);
    f.splashAdd = cl(Math.round(num(s.splashAdd, 0)), 0, 3);
    f.chainAdd = cl(Math.round(num(s.chainAdd, 0)), 0, 3);
    f.slowMul = cl(num(s.slowMul, 1), 0.5, 1.8);
    f.projAdd = cl(Math.round(num(s.projAdd, 0)), 0, 3);
    f.pierceAdd = cl(Math.round(num(s.pierceAdd, 0)), 0, 3);
    f.critP = cl(num(s.critP, 0), 0, 0.5);
    f.leakCut = cl(num(s.leakCut, 0), 0, 0.5);
    f.luxMul = cl(num(s.luxMul, 1), 0.5, 1.8);
    f.hpMul = cl(num(s.hpMul, 1), 0.7, 1.35);
    /* 可读面：原样透传（不作任何判定用途） */
    f.beat = num(s.beat, 1);
    f.pressure = cl(num(s.pressure, 0), 0, 1);
    f.seal = num(s.seal, 0);
    f.sig = (s.sig == null) ? '0' : String(s.sig);
    f.rank = s.rank ? String(s.rank) : '—';
    /* 阵型：这一局摆出来的形状。它不参与判定，但战场面板要能指着它说
       「乱流是你自己摆出来的」——所以原样透传，与 wires 同一性质。 */
    f.form = s.form || null;
    f.wires = Array.isArray(s.wires) ? s.wires.slice(0, 12) : [];
    f.active = Array.isArray(s.active) ? s.active.slice(0, 12) : [];
    /* 一个指纹：换波之后拿它对比就知道接线到底换没换 */
    f.mark = f.beat + '|' + f.wires.map(function (x) { return x.label; }).join(',') +
      '|' + f.dmgMul.toFixed(4) + '|' + f.rateMul.toFixed(4);
    return f;
  }
  function fluxNeutral() {
    var f = {}, k;
    for (k in FLUX1) f[k] = FLUX1[k];
    return f;
  }

  /* ---------- 花园加成：另一张纯数据纸 ----------
     与 flux 同一种东西：外部算好、这里只读、逐项再钳一次。
     为什么不能在这里直接查花园模块：**塔防不认识花园**——
     这条边界有门禁钉着（smoke.mjs 扫 td.js 的 BS.* 引用）。
     算这张纸的是 run.js，它是唯一同时知道两边都存在的地方。
     缺省值一律「不作用」，畸形块退化成中性——与 flux 同一套保险。 */
  var BUFF1 = {
    dmgMul: 1, rateMul: 1, rangeAdd: 0, critP: 0, luxMul: 1
  };
  function buffsOf(src) {
    var s = src || {}, f = {}, k;
    for (k in BUFF1) f[k] = BUFF1[k];
    f.dmgMul = cl(num(s.dmgMul, 1), 0.5, 3);
    f.rateMul = cl(num(s.rateMul, 1), 0.5, 3);
    f.rangeAdd = cl(num(s.rangeAdd, 0), 0, 4);
    f.critP = cl(num(s.critP, 0), 0, 0.6);
    f.luxMul = cl(num(s.luxMul, 1), 0.5, 4);
    return f;
  }
  function buffsNeutral() {
    var f = {}, k;
    for (k in BUFF1) f[k] = BUFF1[k];
    return f;
  }

  /* ---------- 战况 / 战备指令：第三张纯数据纸 ----------
     与 flux、buffs **同一种东西**：外部算好、这里只读、逐项再钳一次。
     塔防不认识「战况」也不认识「战备指令」——它只认识一张已经算好的
     标量表。算那张纸的是 run.js（唯一同时认识这一局与战场的地方）。

     它改的是**这一局长什么样**：敌血 / 敌速 / 敌数 / 难度曲线前移 /
     护盾从哪波开始 / 辉光掉落 / 塔的伤害与等级 / 基地上限 / 升级折扣 /
     漏怪减免。玩家在开局前勾的战况与波与波之间选的指令，落到战场
     上就是这一块——两条路都只从这一个口子进来。

     缺省值一律「不作用」，畸形块退化成中性——与 flux 同一套保险丝。 */
  var MODS1 = {
    hpMul: 1, spdMul: 1, countMul: 1, luxMul: 1, dmgMul: 1, budgetMul: 1,
    waveShift: 0, shieldFrom: 0, garageCut: 0, baseHpCut: 0, levelAdd: 0,
    leakFlat: 0, upDisc: 0, sellRate: 0.6
  };
  function modsOf(src) {
    var s = src || {}, f = {}, k;
    for (k in MODS1) f[k] = MODS1[k];
    f.hpMul = cl(num(s.hpMul, 1), 0.5, 4);
    f.spdMul = cl(num(s.spdMul, 1), 0.4, 3);
    f.countMul = cl(num(s.countMul, 1), 0.5, 4);
    f.luxMul = cl(num(s.luxMul, 1), 0.3, 4);
    f.dmgMul = cl(num(s.dmgMul, 1), 0.5, 3);
    f.budgetMul = cl(num(s.budgetMul, 1), 0.4, 2);
    f.waveShift = cl(Math.round(num(s.waveShift, 0)), 0, 12);
    f.shieldFrom = cl(Math.round(num(s.shieldFrom, 0)), 0, 30);
    f.garageCut = cl(Math.round(num(s.garageCut, 0)), 0, 8);
    f.baseHpCut = cl(Math.round(num(s.baseHpCut, 0)), 0, 10);
    f.levelAdd = cl(Math.round(num(s.levelAdd, 0)), 0, 3);
    f.leakFlat = cl(Math.round(num(s.leakFlat, 0)), 0, 3);
    f.upDisc = cl(num(s.upDisc, 0), 0, 0.6);
    f.sellRate = cl(num(s.sellRate, 0.6), 0.2, 1);
    return f;
  }
  function modsNeutral() {
    var f = {}, k;
    for (k in MODS1) f[k] = MODS1[k];
    return f;
  }
  function setMods(b, src) {
    if (!b) return b;
    b.mods = modsOf(src);
    b.modsSrc = src || null;
    return b;
  }

  /* ---------- 路径：S 形，种子决定 ---------- */
  function pathOf(seed) {
    var rnd = SD.derive(seed, 'path');
    var y = Math.floor(rnd() * ROWS);
    var pts = [[0, y]], x = 0, guard = 0;
    while (x < COLS - 1 && guard++ < 200) {
      var seg = 2 + Math.floor(rnd() * 4);
      var nx = Math.min(COLS - 1, x + seg);
      while (x < nx) { x++; pts.push([x, y]); }
      if (x >= COLS - 1) break;
      var dy = rnd() < 0.5 ? -1 : 1;
      var ny = y + dy * (1 + Math.floor(rnd() * 3));
      ny = Math.max(0, Math.min(ROWS - 1, ny));
      if (ny === y) ny = y === 0 ? 1 : y - 1;
      while (y !== ny) { y += (ny > y ? 1 : -1); pts.push([x, y]); }
    }
    return pts;
  }

  /* ---------- 开战：turrets: [{ spec, at, pri? }]，flux: 纯数据块 ---------- */
  function start(opts) {
    var seed = opts.seed | 0;
    var path = pathOf(seed), pathSet = {}, p;
    for (p = 0; p < path.length; p++) pathSet[key(path[p][0], path[p][1])] = p;
    var md = modsOf(opts.mods);
    var b = {
      seed: seed, path: path, pathSet: pathSet,
      towers: [], occ: {},
      wave: 0, toSpawn: [], spawnCd: 0, sc: { hp: 1, spd: 1, lux: 1 },
      /* 基地生命的起手值要扣掉战况砍掉的那一截（「渗血 −5」），
         重塑树的「加厚基座」在 run 那边加回来——两头各管各的，不互写。 */
      enemies: [], baseHp: Math.max(1, BASE_HP - (md.baseHpCut | 0)), lux: 0,
      kills: {}, chainKills: 0, tick: 0, log: [], over: null,
      beams: [],
      /* 护盾账本：吃了多少、破了几面——结算页要能说出「这局盾有多厚」 */
      shieldHit: 0, shieldBreaks: 0,
      /* 乱流：外来块折成安全标量；之后每波由 setFlux 重掷。
         加成：花园算好的另一张纸，全程不变（它来自局外种植，不随波次抖）。 */
      flux: fluxOf(opts.flux), fluxSrc: opts.flux || null,
      buffs: buffsOf(opts.buffs), buffsSrc: opts.buffs || null,
      mods: md, modsSrc: opts.mods || null
    };
    var d;
    for (d = 0; d < (opts.turrets || []).length; d++) {
      var t = opts.turrets[d];
      addTower(b, t.spec, t.at, t.pri, t.br, t.cost);
    }
    rewire(b);
    beginWave(b);
    return b;
  }

  /* ---------- 邻接回路：摆位从「覆盖」变成「接线」 ----------
     相邻的两座塔（切比雪夫 ≤ 1.5）按各自读数的峰值算一个接缝：
       共振  峰值相同、两座都不太响   → 互相抬一手（伤害 ×1.12 · 攻速 ×1.10）
       干涉  峰值相同、两座都太响     → 太响了会互相打架：伤害 ×0.92 换射程 +1
       互补  峰值不同、两座都够响     → 各读到对方**整个**峰值，落在对方那一项上
       （半额会被 round 吞成 0——那会让这条接缝静默失效）
     于是「谁挨着谁」第一次有意义——一排塔的排列顺序成了拓扑。
     resona 的光环仍在这里算：它也是邻格关系，走同一个口子出去。
     接缝只吃 spec 上已有的数值（spec.es 是纯数据），不 import 任何图形模块。 */
  var WIRE0 = { dmg: 1, rate: 1, slow: 1, range: 0, proj: 0, chain: 0, pierce: 0, crit: 0 };
  function wireOf() { var o = {}, k; for (k in WIRE0) o[k] = WIRE0[k]; return o; }

  /* 一项读数 → 它接管的那些标量。与 run.js 的阵型乱流是同一张表，
     但两边各写一份：这里在战斗域，那里在桥那一层，谁都不 import 谁。 */
  var WSCALE = {
    even:   [{ k: 'dmg', a: 0.30 }],
    repeat: [{ k: 'rate', a: 0.28 }],
    void:   [{ k: 'range', a: 0.50 }, { k: 'pierce', a: 1 }],
    sym:    [{ k: 'proj', a: 1 }],
    weave:  [{ k: 'chain', a: 1 }, { k: 'slow', a: 0.25 }],
    edge:   [{ k: 'crit', a: 0.18 }]
  };
  var WKEYS = ['even', 'repeat', 'void', 'sym', 'weave', 'edge'];
  function peakOf(es) {
    if (!es) return null;
    var best = null, bv = 0.05, i, k, v;
    for (i = 0; i < WKEYS.length; i++) { k = WKEYS[i]; v = es[k] || 0; if (v > bv) { bv = v; best = k; } }
    return best;
  }
  function wireAdd(w, key, v) {
    var list = WSCALE[key], i, e;
    if (!list || !(v > 0)) return;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.k === 'dmg') w.dmg *= (1 + e.a * v);
      else if (e.k === 'rate') w.rate *= (1 + e.a * v);
      else if (e.k === 'slow') w.slow *= (1 + e.a * v);
      else if (e.k === 'crit') w.crit += e.a * v;
      else if (e.k === 'proj') w.proj += Math.round(e.a * v);
      else if (e.k === 'chain') w.chain += Math.round(e.a * v);
      else if (e.k === 'pierce') w.pierce += Math.round(e.a * v);
      else if (e.k === 'range') w.range += e.a * v;
    }
  }
  function rewire(b) {
    var i, j, A, B, pa, pb, va, vb;
    for (i = 0; i < b.towers.length; i++) {
      b.towers[i].wire = wireOf();
      b.towers[i].aura = 0;
    }
    for (i = 0; i < b.towers.length; i++) {
      for (j = i + 1; j < b.towers.length; j++) {
        A = b.towers[i]; B = b.towers[j];
        if (cheb(A.cx, A.cy, B.cx, B.cy) > 1.5) continue;
        if (B.a.auraDmg > 0) A.aura += B.a.auraDmg;
        if (A.a.auraDmg > 0) B.aura += A.a.auraDmg;
        pa = peakOf(A.a.es); pb = peakOf(B.a.es);
        if (!pa || !pb) continue;
        va = A.a.es[pa] || 0; vb = B.a.es[pb] || 0;
        if (pa === pb) {
          if (va + vb >= 1.30) {          /* 干涉：太响了，互相打架 */
            A.wire.dmg *= 0.92; A.wire.range += 1.0;
            B.wire.dmg *= 0.92; B.wire.range += 1.0;
          } else {                         /* 共振 */
            A.wire.dmg *= 1.12; A.wire.rate *= 1.10;
            B.wire.dmg *= 1.12; B.wire.rate *= 1.10;
          }
        } else if (va >= 0.35 && vb >= 0.35) {   /* 互补：各读到对方的峰值 */
          wireAdd(A.wire, pb, vb);
          wireAdd(B.wire, pa, va);
        }
      }
    }
  }

  function beginWave(b) {
    b.wave++;
    var md = b.mods || modsNeutral();
    /* 战况的「早潮」把整条难度曲线往前挪：第 1 波就是第 1+shift 波的厚度。
       它改的是**缩放轴上的位置**，不是往波次表里塞新波——
       所以「前移」与「原曲线」是同一条曲线，不存在两套难度。 */
    var sc = WV.scale(b.wave + (md.waveShift | 0));
    b.sc = sc;
    b.toSpawn = WV.comp(b.seed, b.wave);
    if (md.countMul !== 1) {
      for (var ci = 0; ci < b.toSpawn.length; ci++) {
        b.toSpawn[ci].count = Math.max(1, Math.round(b.toSpawn[ci].count * md.countMul));
      }
    }
    b.spawnCd = 0;
    pushLog(b, '第 ' + b.wave + ' 波（HP ×' + sc.hp.toFixed(2) + '）：' + b.toSpawn.map(function (c) {
      return EN.get(c.id).t + '×' + c.count;
    }).join('、'));
    /* 乱流每波重掷：接线整张换掉。这一行是玩家唯一被允许抓住的线索。 */
    if (b.fluxSrc) fluxLine(b);
  }

  /* 把「这一波乱流在干什么」写成一行。不解释名词——名词本来就无意义，
     但**方向**必须诚实：伤害被拉高还是压低，是能说、也该说的。 */
  function fluxLine(b) {
    var f = b.flux, tags = [];
    if (f.dmgMul > 1.01) tags.push('伤害 ↑' + pct(f.dmgMul));
    else if (f.dmgMul < 0.99) tags.push('伤害 ↓' + pct(f.dmgMul));
    if (f.rateMul > 1.01) tags.push('攻速 ↑' + pct(f.rateMul));
    else if (f.rateMul < 0.99) tags.push('攻速 ↓' + pct(f.rateMul));
    if (f.rangeAdd > 0.05) tags.push('射程 +' + f.rangeAdd.toFixed(2));
    else if (f.rangeAdd < -0.05) tags.push('射程 −' + Math.abs(f.rangeAdd).toFixed(2));
    if (f.splashAdd > 0) tags.push('溅射 +' + f.splashAdd);
    if (f.chainAdd > 0) tags.push('连锁 +' + f.chainAdd);
    if (f.projAdd > 0) tags.push('散射 +' + f.projAdd);
    if (f.pierceAdd > 0) tags.push('穿透 +' + f.pierceAdd);
    if (f.critP > 0.01) tags.push('暴击 ' + Math.round(f.critP * 100) + '%');
    if (f.leakCut > 0.01) tags.push('护盾 ' + Math.round(f.leakCut * 100) + '%');
    if (f.slowMul > 1.01) tags.push('减速 ↑' + pct(f.slowMul));
    if (f.luxMul > 1.01) tags.push('辉光 ↑' + pct(f.luxMul));
    if (f.hpMul > 1.01) tags.push('敌血 ↑' + pct(f.hpMul));
    else if (f.hpMul < 0.99) tags.push('敌血 ↓' + pct(f.hpMul));
    pushLog(b, '乱流：' + (tags.length ? tags.join(' · ') : '本波无偏移'));
  }
  function pct(x, d) {
    var v = (x - 1) * 100;
    return (v >= 0 ? '+' : '') + v.toFixed(d == null ? 1 : d) + '%';
  }

  /* ---------- 换波换流：阵型变了就重算（外部交回来） ---------- */
  function setFlux(b, src) {
    if (!b) return b;
    b.flux = fluxOf(src);
    b.fluxSrc = src || null;
    return b;
  }

  function pushLog(b, m) {
    b.log.push({ t: b.tick, m: m });
    if (b.log.length > 100) b.log.shift();
  }

  /* ---------- 目标挑选：优先级是塔自己的战位 ---------- */
  function pick(t, b, near) {
    if (!near.length) return null;
    var i, c;
    if (t.pri === 'strong') {
      var best = near[0];
      for (i = 1; i < near.length; i++) if (near[i].hp > best.hp) best = near[i];
      return best;
    }
    if (t.pri === 'near') {
      var bd = Infinity, bc = near[0];
      for (i = 0; i < near.length; i++) {
        c = b.path[Math.min(b.path.length - 1, Math.floor(near[i].pos))];
        var d2 = cheb(t.cx, t.cy, c[0], c[1]);
        if (d2 < bd) { bd = d2; bc = near[i]; }
      }
      return bc;
    }
    /* 最前：走得最远的那只（默认） */
    var bf = near[0];
    for (i = 1; i < near.length; i++) if (near[i].pos > bf.pos) bf = near[i];
    return bf;
  }

  /* ---------- 造一只敌人 ----------
     出生与分裂共用这一处：**裂胞炸出来的那两只，和从起点走进来的
     那一只，是同一种东西**。分开写两遍的代价是「分裂出来的不缩放血量」
     这种 bug——它只在第 20 波之后露面，而那时没人会怀疑是新兵太脆。

     盾吃**同一根**缩放轴，也吃战况的敌血倍率——「敌血 ↑」的波
     是整体变厚，不是只厚血条。盾从第几波开始由 mods 说，
     0 表示「没说，用表里的默认」。 */
  function spawnAt(b, id, pos) {
    var spec = EN.get(id);
    var md = b.mods || modsNeutral();
    var hp0 = spec.hp * b.sc.hp * b.flux.hpMul * md.hpMul;
    var sh0 = EN.shieldOf(id, b.wave + (md.waveShift | 0), md.shieldFrom) * b.flux.hpMul * md.hpMul;
    return {
      id: id, hp: hp0, maxHp: hp0, pos: pos || 0,
      sh: sh0, maxSh: sh0,
      spdMul: b.sc.spd * md.spdMul,
      slowT: 0, slowV: 0, dotT: 0, dotDps: 0,
      uid: (b.seed ^ (b.tick * 2654435761)) + ':' + (b.enemies.length) + ':' + id
    };
  }

  /* ---------- 推进一个 tick ---------- */
  function tickOnce(b) {
    b.tick++;
    b.beams = [];
    var i, e, t;

    /* 出生：HP/速度按本波缩放；乱流再乘一道敌血倍率（>1 是变难）。
       第 8 波前盾为 0，看不见环。 */
    if (b.toSpawn.length) {
      b.spawnCd -= TICK;
      if (b.spawnCd <= 0) {
        var c = b.toSpawn[0];
        b.enemies.push(spawnAt(b, c.id, 0));
        c.count--;
        if (c.count <= 0) b.toSpawn.shift();
        b.spawnCd += SPAWN_GAP;
      }
    }

    /* 敌人移动与到站 */
    for (i = b.enemies.length - 1; i >= 0; i--) {
      e = b.enemies[i];
      if (e.slowT > 0) { e.slowT -= TICK; if (e.slowT <= 0) e.slowV = 0; }
      if (e.dotT > 0) {
        e.dotT -= TICK;
        hurt(b, e, e.dotDps * TICK, null, 'dot');
        /* hurt() 在致死时已经把 e 摘出队列——紧接着再 splice(i,1) 摘掉的
           是**左移一位后落到 i 上的那一只**（它这一拍已经处理过了），
           于是它被无声删掉：不掉辉光、不记击杀、也不到站。
           所以先确认 e 还在原位，再谈摘不摘。（老 bug，本版修。） */
        if (e.hp <= 0) {
          if (b.enemies[i] === e) b.enemies.splice(i, 1);
          continue;
        }
      }
      /* 愈使：每秒回 regen 点，回不过上限。它逼的是**爆发**——
         每秒割 5 点的塔在它身上等于没开火。回血写在移动循环里，
         与「走」同一拍，所以「走得越久越难杀」是字面意义上的。 */
      var rs = EN.get(e.id).regen;
      if (rs > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + rs * TICK);
      /* (e.spdMul == null ? 1 : e.spdMul)——不能写 || 1：0 是合法的速度
         （完全静止），而 0 是 falsy，写 || 会把「钉住」静默变成「全速」。 */
      var step = EN.get(e.id).speed * (e.spdMul == null ? 1 : e.spdMul) * TICK * (1 - e.slowV);
      e.pos += step;
      if (e.pos >= b.path.length - 1) {
        var spec0 = EN.get(e.id);
        /* 乱流护盾（阵型）是**按比例**减免，重塑「护壁」是**按只**减 1——
           两条口径不同，所以一个在乘区、一个在加区，谁也盖不住谁。 */
        var leak = spec0.leak * (1 - b.flux.leakCut) - ((b.mods && b.mods.leakFlat) | 0);
        if (leak > 0) leak = Math.max(1, Math.round(leak));
        else leak = 0;
        b.baseHp -= leak;
        pushLog(b, spec0.t + '抵达基地，扣 ' + leak + ' 点生命' +
          (b.flux.leakCut > 0.01 ? '（乱流护盾减 ' + Math.round(b.flux.leakCut * 100) + '%）' : ''));
        b.enemies.splice(i, 1);
      }
    }

    /* 塔开火：弹道只是判定的可见面 */
    var fx = b.flux, bf = b.buffs;
    for (i = 0; i < b.towers.length; i++) {
      t = b.towers[i];
      t.odT += TICK;
      t.cd -= TICK;
      if (t.cd > 0) continue;
      var w = t.wire || wireOf();
      /* 乱流：射程加成在这里生效——这是「够不够得着」的扰动。
         加成：花园的射程是**加区**；接缝的射程也是加区。三项并列。 */
      var range = t.a.range + fx.rangeAdd + bf.rangeAdd + w.range;
      var near = [], e2;
      for (var q = 0; q < b.enemies.length; q++) {
        e2 = b.enemies[q];
        var cell = b.path[Math.min(b.path.length - 1, Math.floor(e2.pos))];
        if (cheb(t.cx, t.cy, cell[0], cell[1]) <= range) near.push(e2);
      }
      if (!near.length) continue;
      /* 攻速：乱流是乘区，花园是乘区，接缝也是乘区。
         分母先钳住，绝不让 cd 变 0 或负。 */
      var rate = Math.max(0.05, t.a.rate * fx.rateMul * bf.rateMul * w.rate);
      /* 过载（质变口）：**每一发变成两发**，但每 12 秒停火 2 秒。
         为什么不是「攻速 ×2」：一个 tick 只有 0.5 秒，攻速超过 2 次/秒
         就表达不出来——那条旋钮会静默失效，而这一部不许有这种注释。
         连发在同一个 tick 里是看得见的；停火也是看得见的。
         它开始有节拍了，这是这一条的代价。 */
      var shots = 1;
      if (mutOn(t.a, 'overdrive')) shots = ((t.odT % 12) < 10) ? 2 : 0;
      var sIdx;
      for (sIdx = 0; sIdx < shots; sIdx++) fire(t, b, fx, bf, w, near);
      /* 停火那 2 秒里不装填：下一 tick 再来问一次，所以给它一个 tick 的 cd */
      t.cd = shots > 0 ? (1 / rate) : TICK;
    }
  }

  /* 一次开火（过载的连发就是把这个函数跑两遍）。
     纯局部变量：同一 tick 内连发两轮，第二轮读到的仍是这一帧的
     乱流 / 加成 / 接缝——它们在一个 tick 内不该变。 */
  function fire(t, b, fx, bf, w, near) {
    /* 乱流：伤害倍率。过一遍上限，永不为负。
       等级乘数走 levelMul()——小于 1 的幂次曲线在这里收口。
       加成：花园的伤害乘区与乱流、接缝并列，谁也不覆盖谁。
       沉压：同一只被连续命中时逐发 +15%（最多 +60%），换目标清零。
       它只对**长出沉压**的塔生效——写成无条件乘区的话，
       每一座塔的第三发都会莫名其妙变重（护盾那一节的精确断言
       当场红给你看，这个 bug 就是这么被抓到的）。 */
    var crush = mutOn(t.a, 'crush') ? (1 + 0.15 * Math.min(4, t.crushN)) : 1;
    /* 战况 / 指令的伤害乘区与乱流、花园、接缝并列——谁也不覆盖谁。
       督战的「按 +1 级计伤害」是**临时的**：它只改这一次开火读到的等级，
       不碰塔真正的 level，所以不会把质变口（第 2 / 5 / 10 级）悄悄跳过去。 */
    var md = b.mods || modsNeutral();
    var dmg = t.a.dmg * fx.dmgMul * bf.dmgMul * w.dmg * md.dmgMul *
      levelMul(t.level + (md.levelAdd | 0)) * (1 + t.aura) * crush;
    var z, tg, cell2;
    /* 乱流与接缝：散射弹数加成，并进 proj */
    var proj = Math.max(1, t.a.proj + fx.projAdd + w.proj);
    /* proj > 1：按优先级选主目标，其余取最前的凑数。
       齐射：每一发都锁定同一个目标——对厚皮是集中，对群战是浪费。 */
    var main = pick(t, b, near);
    var rest = near.slice().sort(function (a2, b2) { return b2.pos - a2.pos; });
    var targets = [];
    if (main) targets.push(main);
    if (mutOn(t.a, 'volley')) {
      for (z = 1; z < proj; z++) targets.push(main);
    } else {
      for (z = 0; z < rest.length && targets.length < proj; z++) {
        if (rest[z] !== main) targets.push(rest[z]);
      }
    }
    for (z = 0; z < targets.length; z++) {
      tg = targets[z];
      cell2 = b.path[Math.min(b.path.length - 1, Math.floor(tg.pos))];
      var dist = cheb(t.cx, t.cy, cell2[0], cell2[1]);
      /* 沉压记账：连续命中同一只才累加。uid 在出生时写死，换一只就清零。 */
      if (t.crushId !== tg.uid) { t.crushId = tg.uid; t.crushN = 1; }
      else t.crushN = Math.min(4, t.crushN + 1);
      /* 乱流：暴击。纯判定，弹道颜色里带上。
         加成：花园的暴击率与乱流**相加**；接缝的暴击也是加区——
         三个来源都是「多一次机会」，相加才读得懂。 */
      var critP = fx.critP + bf.critP + w.crit;
      var crit = critP > 0 && critRoll(b, tg, z, critP);
      var hit = crit ? dmg * 2 : dmg;
      b.beams.push({ x1: t.cx, y1: t.cy, x2: cell2[0], y2: cell2[1], k: crit ? 'crit' : 'direct' });
      hurt(b, tg, hit, t, 'direct');
      if (tg.hp <= 0) continue;
      /* 乱流与接缝：穿透——打在主目标之后不衰减地再走一格（同一条线上的下一只） */
      var pierce = t.a.pierce + fx.pierceAdd + w.pierce;
      if (pierce > 0 && dist <= MELEE_RANGE + 1) {
        var pd = pierceAround(b, t, cell2, hit, pierce);
        for (var pi = 0; pi < pd.length; pi++) b.beams.push(pd[pi]);
      }
      if (t.a.melee > 0 && dist <= MELEE_RANGE) hurt(b, tg, t.a.melee, t, 'melee');
      if (t.a.splash > 0) {
        splashAround(b, t, cell2, dmg * SPLASH_MUL);
        b.beams.push({ x1: cell2[0], y1: cell2[1], x2: cell2[0], y2: cell2[1], k: 'splash' });
      }
      /* 乱流：溅射 +n 圈——外圈按距离递减 */
      if (fx.splashAdd > 0) {
        for (var ring = 2; ring <= 1 + fx.splashAdd; ring++) {
          splashAround(b, t, cell2, dmg * SPLASH_MUL * (1 / ring), ring);
          b.beams.push({ x1: cell2[0], y1: cell2[1], x2: cell2[0], y2: cell2[1], k: 'splash' });
        }
      }
      /* 乱流与接缝：连锁 +n 跳。
         寄生：每一跳都不再衰减——第一跳的入参也要跟着换，
         只改 chainFrom 里面的 fall 会让第一跳仍然吃一次 0.75
         （那正是「改了一半」的半修状态）。 */
      var chain = t.a.chain + fx.chainAdd + w.chain;
      if (chain > 0) {
        var fall = mutOn(t.a, 'conduit') ? 1 : CHAIN_FALL;
        chainFrom(b, t, tg, dmg * fall, chain);
      }
      /* 乱流：减速幅度倍率；接缝的减速也是乘区 */
      if (t.a.slow > 0) {
        tg.slowV = Math.min(E.CAP.slow, tg.slowV + t.a.slow * fx.slowMul * w.slow);
        tg.slowT = 3;
      }
      if (t.a.dot > 0) { tg.dotT = 3; tg.dotDps = t.a.dot / 3; }
    }
  }

  function hurt(b, e, amount, tower, kind) {
    var mul = kind === 'direct' ? EN.get(e.id).singleMul : 1;
    var dmg = amount * mul;
    /* 穿模（质变口）：穿透 / 溅射 / 连锁不再先吃护盾，直接打进血条。
       它是「为破盾而生」的那条立场——单体仍然要吃五折。 */
    var bypass = e.sh > 0 && tower && mutOn(tower.a, 'phase') &&
      (kind === 'pierce' || kind === 'splash' || kind === 'chain');
    /* 护盾：先吃。单体（直击 / 近战）打盾五成，其余全额；
       破盾那一刻剩下的按同一折损继续打进血条——所以盾对单体是
       实打实的第二层皮，对溅射 / 连锁 / 穿透只是一道额外血量。
       盾未破时这一发不掉血：血条不动，环变薄。 */
    if (e.sh > 0 && !bypass) {
      var into = (kind === 'direct' || kind === 'melee') ? dmg * 0.5 : dmg;
      b.shieldHit += Math.min(into, e.sh);
      if (into < e.sh) { e.sh -= into; return; }
      var over = into - e.sh;
      e.sh = 0;
      b.shieldBreaks++;
      dmg = over;
    }
    e.hp -= dmg;
    if (e.hp <= 0) {
      var idx = b.enemies.indexOf(e);
      if (idx >= 0) b.enemies.splice(idx, 1);
      var spec = EN.get(e.id);
      /* 乱流：辉光产出倍率（悬置 / 终汇 这两条流在这里落地）。
         加成：花园的辉光掉落也是乘区——它管的是「这一局挣得多快」。 */
      b.lux += Math.max(1, Math.round(spec.lux * b.sc.lux * b.flux.luxMul * b.buffs.luxMul * b.mods.luxMul));
      b.kills[e.id] = (b.kills[e.id] || 0) + 1;
      if (tower) {
        tower.kills++;
        if (tower.a.chain >= 2) b.chainKills++;
      }
      /* 裂胞：死在原地炸出 n 只。**杀在哪儿**从这一条起是决策——
         它死在门口，那 n 只几乎就站在基地上。子代走完整的缩放与同一套
         出生逻辑（spawnAt），与从起点走进来的那些没有任何区别。
         子代不进 toSpawn：它们不在这一波的配额里，是**你自己杀出来的**。 */
      if (spec.split && spec.split.n > 0) {
        for (var q3 = 0; q3 < spec.split.n; q3++) {
          b.enemies.push(spawnAt(b, spec.split.id, e.pos));
        }
      }
    }
  }

  /* 暴击抽签。它必须**可复现**——用种子派生的子流，而不是 Math.random()，
     否则「同种子同部署逐 tick 一致」当场破功。
     抽取键 = (tick, 敌 id, 第几发)，所以同一发在同一 tick 永远同一结果。
     概率由调用方给（乱流 + 花园加成相加后的那个数）——这里不查任何全局。 */
  function critRoll(b, e, idx, p) {
    var r = SD.derive(b.seed, 'crit:' + b.tick + ':' + e.id + ':' + idx);
    return r() < p;
  }

  /* 穿透：从命中格沿路径方向再穿 n 格，每格掉一点伤害。 */
  function pierceAround(b, tower, cell, dmg, n) {
    var out = [], e, c2, i, d, best, bestD;
    for (var h = 0; h < n; h++) {
      best = null; bestD = Infinity;
      var cx = cell[0] + h + 1;
      for (i = 0; i < b.enemies.length; i++) {
        e = b.enemies[i];
        c2 = b.path[Math.min(b.path.length - 1, Math.floor(e.pos))];
        d = cheb(cx, cell[1], c2[0], c2[1]);
        if (d <= 1 && d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      var nc = b.path[Math.min(b.path.length - 1, Math.floor(best.pos))];
      out.push({ x1: cell[0], y1: cell[1], x2: nc[0], y2: nc[1], k: 'pierce' });
      hurt(b, best, dmg * (1 - 0.25 * (h + 1)), tower, 'pierce');
    }
    return out;
  }

  function splashAround(b, tower, cell, dmg, ring) {
    var R = ring || 1, i, e, c2, q, dx, dy;
    for (i = 0; i < b.enemies.length; i++) {
      e = b.enemies[i];
      c2 = b.path[Math.min(b.path.length - 1, Math.floor(e.pos))];
      dx = Math.abs(c2[0] - cell[0]); dy = Math.abs(c2[1] - cell[1]);
      if (Math.max(dx, dy) <= R && (dx + dy) > 0) { hurt(b, e, dmg, tower, 'splash'); }
    }
  }

  function chainFrom(b, tower, first, dmg, hops) {
    /* 寄生（质变口）：每一跳不再衰减。 */
    var fall = (tower && mutOn(tower.a, 'conduit')) ? 1 : CHAIN_FALL;
    var hit = [first], cur = first, i, e, c2, best, bestD;
    for (var h = 0; h < hops; h++) {
      best = null; bestD = Infinity;
      var curCell = b.path[Math.min(b.path.length - 1, Math.floor(cur.pos))];
      for (i = 0; i < b.enemies.length; i++) {
        e = b.enemies[i];
        if (hit.indexOf(e) >= 0) continue;
        c2 = b.path[Math.min(b.path.length - 1, Math.floor(e.pos))];
        var d = cheb(curCell[0], curCell[1], c2[0], c2[1]);
        if (d <= 3 && d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      var nc = b.path[Math.min(b.path.length - 1, Math.floor(best.pos))];
      b.beams.push({ x1: curCell[0], y1: curCell[1], x2: nc[0], y2: nc[1], k: 'chain' });
      hurt(b, best, dmg, tower, 'chain');
      hit.push(best);
      cur = best;
      dmg *= fall;
    }
  }

  /* ---------- 推进：本波清空返回 rest（等玩家升级或撤离）---------- */
  function wave(b) {
    if (b.over) return b.over;
    if (!b.toSpawn.length && !b.enemies.length && b.wave > 0) beginWave(b);
    var guard = 0;
    while (guard++ < WAVE_TICKS) {
      tickOnce(b);
      if (b.baseHp <= 0) { b.over = { phase: 'lost', wave: b.wave }; return b.over; }
      if (!b.toSpawn.length && !b.enemies.length) {
        return { phase: 'rest', wave: b.wave };
      }
    }
    b.over = { phase: 'lost', wave: b.wave };
    return b.over;
  }

  /* ---------- 部署合法性（1×1） ---------- */
  function deployOk(b, at) {
    if (!b) return BS.i18n.get('这一局还没有棋盘');
    if (at[0] < 0 || at[1] < 0 || at[0] >= COLS || at[1] >= ROWS) return BS.i18n.get('超出战场');
    var k = key(at[0], at[1]);
    if (b.occ[k]) return BS.i18n.get('这一格已经有东西了');
    if (b.pathSet[k] != null) return BS.i18n.get('路径上建不了塔：火力要覆盖的是路两旁');
    return '';
  }

  function addTower(b, spec, at, pri, br, cost) {
    var inst = {
      a: spec, i: at[0], j: at[1], cx: at[0], cy: at[1],
      level: 0, cd: 0, kills: 0, hp: spec.hp, aura: 0, wire: wireOf(),
      pri: pri || 'first', br: br || null, cost: cost || 0,
      /* 质变口与沉压的在席状态：都是这一座塔自己的账，不进 spec */
      odT: 0, crushId: null, crushN: 0
    };
    b.towers.push(inst);
    b.occ[key(at[0], at[1])] = 't' + (b.towers.length - 1);
    rewire(b);
    return inst;
  }

  /* 撤收：把一座塔从战场上摘下来（局中卖塔的那一步）。
     occ 里存的是 't'+下标，摘过塔之后全体错位——索性重建一遍。
     塔数是个位数，重建比打补丁便宜，也更不容易错。接缝与光环都是邻格关系，
     摘错一座全场 buff 数就错了，所以 rewire 必须跟着重算。 */
  function removeTower(b, idx) {
    var t = b.towers[idx];
    if (!t) return null;
    b.towers.splice(idx, 1);
    delete b.occ[key(t.i, t.j)];
    var i;
    for (i = 0; i < b.towers.length; i++) b.occ[key(b.towers[i].i, b.towers[i].j)] = 't' + i;
    rewire(b);
    return t;
  }

  function setPri(b, idx, pri) {
    var t = b.towers[idx];
    if (!t) return { ok: false, why: BS.i18n.get('没有这座塔') };
    t.pri = pri;
    return { ok: true };
  }

  /* ---------- 质变口：第 2 / 5 / 10 级各开一口，一口一条，最多三口 ----------
     为什么现在能是三口：六项读数 → 六种形变，一座塔一辈子每种最多焊一条，
     所以三口仍各有三个候选（三口 × 三条 ≠ 六条用尽），第三口不再空着。
     旧版写「三口必然空着 → 所以两口」是算错了：它把「六种形变」当成了
     「三口就把六种用光」。
     为什么一口一条（不再允许同口叠加）：叠加把「选一条」稀释成「选三条」，
     三条规则堆在同一座塔上，玩家读不出「这座塔到底长成了什么」。
     一口一条，三口落在三个不同的时刻——每一次都是一次真的取舍。 */
  var MUTATIONS = [
    { id: 'crush', k: 'even', t: '沉压', en: 'CRUSH',
      d: '同一只敌人被连续命中时，每次 +15% 伤害，最多 +60%；换目标清零。' },
    { id: 'overdrive', k: 'repeat', t: '过载', en: 'OVERDRIVE',
      d: '每一发变成两发，但每 12 秒停火 2 秒——它开始有节拍了。' },
    { id: 'phase', k: 'void', t: '穿模', en: 'PHASE',
      d: '穿透与溅射不再先吃护盾，直接打进血条。' },
    { id: 'volley', k: 'sym', t: '齐射', en: 'VOLLEY',
      d: '散射的每一发都锁定同一个目标——对厚皮是集中，对群战是浪费。' },
    { id: 'conduit', k: 'weave', t: '寄生', en: 'CONDUIT',
      d: '连锁的每一跳不再衰减。' },
    { id: 'martyr', k: 'edge', t: '殉爆', en: 'MARTYR',
      d: '这座塔可以自毁：周围一圈造成生命值 ×2 的伤害，返六成辉光。' }
  ];
  var MUT_BY = {};
  (function () { var i; for (i = 0; i < MUTATIONS.length; i++) MUT_BY[MUTATIONS[i].id] = MUTATIONS[i]; })();

  /* 门在哪一级、一座塔最多几条规则。这两条是**规则本身**，
     所以放在数据层、并由 BS.td 导出——界面与文档都从这里读，
     不许各自写死一个 2 / 5 / 10（写死第二份就等于埋一个迟早对不上的数）。 */
  var GATE_LEVELS = [2, 5, 10];
  var MAX_MUT = 3;

  /* 下一口开在哪一级：已焊 n 条 → 第 GATE_LEVELS[n] 级；三口焊满 → 0（没有下一口）。 */
  function gateLevelFor(t) {
    var n = (t && t.a && t.a.mut) ? t.a.mut.length : 0;
    return n < MAX_MUT ? GATE_LEVELS[n] : 0;
  }

  /* 三个候选：按读数从高到低取前三，跳过已经选过的。
     spec.es 是纯数据（进化时写进去的），所以这里不越界。 */
  function optionsFor(spec, taken) {
    var es = (spec && spec.es) || {}, out = [], i, k;
    var order = WKEYS.slice().sort(function (a, b) { return (es[b] || 0) - (es[a] || 0); });
    for (i = 0; i < order.length && out.length < 3; i++) {
      k = MUT_BY_KEY[order[i]].id;
      if (taken && taken.indexOf(k) >= 0) continue;
      if (out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }
  var MUT_BY_KEY = {};
  (function () { var i; for (i = 0; i < MUTATIONS.length; i++) MUT_BY_KEY[MUTATIONS[i].k] = MUTATIONS[i]; })();

  function mutOn(a, id) { return !!(a && a.mut && a.mut.indexOf(id) >= 0); }

  /* 形变落地：**纯函数**，返回一份新的属性块，输入那块不动。
     与 applyBranch 同一套规矩——t.a 可能是共享的在库记录。 */
  function mutate(spec, id) {
    var m = MUT_BY[id];
    if (!m || !spec) return spec;
    var a = {}, k;
    for (k in spec) a[k] = spec[k];
    a.mut = (spec.mut || []).concat([id]);
    return a;
  }

  /* 这一级是不是开着的一口（**纯查询**，渲染路径可以随便问）。
     一口一条之后，「本级开着」只有一种情况：本级正是这一座的下一口，
     且这一口还没焊。`t.gate` 记着上一次焊在哪一级，所以焊完
     `t.gate === t.level`，这里自然返回 null——桌子只摆一次。 */
  function gateOpenAt(t) {
    if (!t) return null;
    var gate = gateLevelFor(t);
    if (!gate || t.level !== gate) return null;
    if (t.gate === t.level) return null;         /* 这一口已经焊过了 */
    var opts = optionsFor(t.a, t.a.mut);
    if (!opts.length) return null;
    return { level: t.level, options: opts };
  }

  /* 到口上选一个：**不花辉光**、升一级、焊上形变。焊死不可改——
     想换请进化下一座，这与专精「一次性」是同一条立场。

     为什么这一级不收钱（本版）：质变口买的是**规则**，辉光买的是「更痛」。
     把规则也挂上价签，等于「这一局能不能长成另一种东西」取决于击杀掉了多少——
     那是运气，不是决策。等级照升（`level++`），所以后面的伤害升级
     不会把这一级跳过去；辉光一分不动，玩家在门口永远有得选。

     为什么可以叠（本版）：形变互不替换，各管一条规则（过载管节拍、
     穿模管盾、寄生管连锁衰减……），所以「再来一条」不会把上一条挤掉。
     第一口多取一条不再抬等级——叠的是规则，不是级数。
     出口就在同一块面板上：选够了直接点「升级」，等级一过这一级，
     桌子自然撤走（`t.gate !== t.level`）。 */
  function choose(b, idx, id) {
    var t = b.towers[idx];
    if (!t) return { ok: false, why: BS.i18n.get('没有这座塔') };
    if (!MUT_BY[id]) return { ok: false, why: BS.i18n.get('没有这种形变') };
    if (mutOn(t.a, id)) return { ok: false, why: BS.i18n.get('这座塔已经走过这条路') };
    var had = (t.a.mut || []).length;
    if (had >= MAX_MUT) return { ok: false, why: BS.i18n.fill('这一座最多 # 条规则，已经焊满了', MAX_MUT) };
    /* 一口一条：本级这一口焊过就不许再选（旧版在这里允许叠加，
       于是「选一条」变成了「选到手软」，而等级一次都不动）。 */
    if (t.gate === t.level) return { ok: false, why: BS.i18n.get('这一口已经焊过了——下一口在更高一级') };
    var opts = optionsFor(t.a, t.a.mut);
    if (opts.indexOf(id) < 0) return { ok: false, why: BS.i18n.get('这座塔长不成这个') };
    t.a = mutate(t.a, id);
    t.level++;
    t.gate = t.level;
    rewire(b);
    pushLog(b, t.a.nm + ' 长成「' + MUT_BY[id].t + '」：' + MUT_BY[id].d);
    return { ok: true, level: t.level, mut: id, count: had + 1, next: gateLevelFor(t), left: b.lux };
  }

  /* 殉爆：这座塔可以死。周围一圈造成生命值 ×2 的伤害。
     返六成辉光、塔回军械库——与撤收同一条过路费口径，
     由 run.js 收尾（它是唯一同时认识军械库与战场的地方）。 */
  function detonate(b, idx) {
    var t = b.towers[idx];
    if (!t) return { ok: false, why: BS.i18n.get('没有这座塔') };
    if (!mutOn(t.a, 'martyr')) return { ok: false, why: BS.i18n.get('这座塔不会殉爆') };
    var dmg = (t.a.hp || 20) * 2, i, e, c2, dx, dy, n = 0;
    for (i = b.enemies.length - 1; i >= 0; i--) {
      e = b.enemies[i];
      c2 = b.path[Math.min(b.path.length - 1, Math.floor(e.pos))];
      dx = Math.abs(c2[0] - t.cx); dy = Math.abs(c2[1] - t.cy);
      if (Math.max(dx, dy) <= 1.2) { hurt(b, e, dmg, t, 'splash'); n++; }
    }
    /* 回扣与撤收同一条口径，从同一张纸上读——殉爆也是「这座塔可以死」，
       过路费不该有第二个数。 */
    var back = Math.max(1, Math.floor(t.cost * (b.mods ? b.mods.sellRate : 0.6)));
    removeTower(b, idx);
    return { ok: true, back: back, hit: n };
  }

  /* ---------- 升级 ----------
     disc 是重塑树「量产」的折扣——它是这一局带着的，**只在算钱的时候**
     起作用，不进任何判定。 */
  function upgradeCost(level, disc) {
    return Math.max(1, Math.round(LV_BASE * Math.pow(LV_GROW, level) * (1 - (disc || 0))));
  }

  /* 塔等级的伤害乘数。**走小于 1 的幂次**：1 + 0.25·lv^0.6。
     一级仍是 +25%（与旧版逐字相同），但第 9 级是 ×1.93 而不是 ×3.25。
     升级成本照旧指数上涨——成本不递减，收益递减，晚升级才真的更不值。 */
  function levelMul(lv) { return 1 + LV_STEP * Math.pow(Math.max(0, lv | 0), BS.eff.POW); }

  /* ---------- 专精：装配台上的三块模块 ----------
     为什么它在装配台而不在战场上：升级只加伤害一项，_balance.mjs
     量出来「先升哪座」在塔与塔之间没有差别（spread 与 focus 终局波数
     逐种子相同）——那个旋钮没有在制造决策。专精补这个缺口，而它
     **属于局外**：在装配台上花结晶装，装之前看得见效果，装之后
     这一局、别局都带着它走。三条路各自认一种敌人：
       破盾尖锋 → 穿透不吃盾的五折，重甲与首领的答案
       裂界散射 → 溅射与散射，灵体群与破盾的另一个答案
       迅捷节律 → 攻速与减速，冲刺兵与「谁都能打」的答案
     **每块模块都吃一项读数**（k 字段）：同一块模块装在不同图形上
     效果不同——「哪座塔配哪块模块」因此是一个真问题，
     审美即战力在装配台上当场兑现。一次性、不可改：
     选了就是这座塔的立场；想换请进化下一座。 */
  var BRANCHES = [
    { id: 'pierce', t: '破盾尖锋', en: 'PIERCE', k: 'void', kt: '通透',
      d: '穿透 +2+⌊通透×2⌋ · 伤害 +20%',
      fx: function (a, es) { a.pierce += 2 + Math.floor((es.void || 0) * 2); a.dmg *= 1.20; } },
    { id: 'spread', t: '裂界散射', en: 'SPREAD', k: 'sym', kt: '对称',
      d: '溅射 +1 · 散射 +2+⌊对称⌋',
      fx: function (a, es) { a.splash += 1; a.proj += 2 + Math.floor(es.sym || 0); } },
    { id: 'swift',  t: '迅捷节律', en: 'SWIFT',  k: 'repeat', kt: '重复',
      d: '攻速 +25% · 减速 +0.10+重复×0.10',
      fx: function (a, es) { a.rate *= 1.25; a.slow += 0.10 + (es.repeat || 0) * 0.10; } }
  ];
  var BRANCH_BY = {};
  (function () { var i; for (i = 0; i < BRANCHES.length; i++) BRANCH_BY[BRANCHES[i].id] = BRANCHES[i]; })();

  /* 装模块：**纯函数**，返回一份新的属性块，输入那块不动。
     输入是在库记录拿来的共享 spec，就地写会把军械库记录一起改掉
     （别局、图鉴、流水全跟着变）——所以必须拷出来再改。
     读数在 spec.es 上（进化时写进去的），模块的浮动部分全从它出。
     proj 过一遍 CAP：+2+⌊对称⌋ 最多把 7 弹抬到 10，不许越顶。 */
  function applyBranch(spec, brId) {
    var br = BRANCH_BY[brId];
    if (!br || !spec) return spec;
    var a = {}, k;
    for (k in spec) a[k] = spec[k];
    br.fx(a, spec.es || {});
    a.proj = Math.max(1, Math.min(E.CAP.proj, Math.round(a.proj)));
    return a;
  }

  /* ---------- 升级前的**纯查询**：不扣钱、不升级 ----------
     为什么必须有它：`upgrade()` 是**命令**——它扣辉光、抬等级。
     而界面（塔面板）每次重画都要问一遍「下一级是质变口还是伤害、
     买不买得起」。这个问题活在渲染路径里，一秒被问几次，
     于是「打开塔面板」等于替玩家按了几十次升级：
     实测抓到过——玩家只是选中一座塔，等级就自己 +1、辉光自己少一截，
     而且之后每次重画都再扣一次（直到撞上质变口才停）。
     规矩：**命令与查询分开**。渲染路径只许调 upgradeInfo；
     要真的升级，走 RUN.up → upgrade()。 */
  function upgradeInfo(b, idx) {
    var t = b.towers[idx];
    if (!t) return { ok: false, why: BS.i18n.get('没有这座塔') };
    if (t.level >= E.CAP.level) return { ok: false, why: BS.i18n.get('到顶了') };
    /* 质变口：下一级正好是这一座的下一口时，这一级不给伤害，给一条新规则。
       质变口不收辉光（cost 0）——买的是规则，不是数值。
       一口一条之后不再有「还能再选」那一种，界面只需看 need === 'mutate'。 */
    var gate = gateLevelFor(t);
    if (gate && t.level + 1 === gate) {
      var opts = optionsFor(t.a, t.a.mut);
      if (opts.length) {
        return { ok: true, need: 'mutate', options: opts, cost: 0, level: t.level, gate: gate };
      }
    }
    var c = upgradeCost(t.level, b.mods ? b.mods.upDisc : 0);
    return { ok: b.lux >= c, need: 'level', cost: c,
      why: b.lux < c ? BS.i18n.get('辉光不够') : '' };
  }

  /* 升级（命令）：扣辉光、抬等级。只从 RUN.up 来——
     界面那边用的是 upgradeInfo。 */
  function upgrade(b, idx) {
    var info = upgradeInfo(b, idx);
    if (!info.ok) return info;
    if (info.need === 'mutate') return info;   /* 选完才扣，见 choose() */
    var t = b.towers[idx];
    b.lux -= info.cost;
    t.level++;
    return { ok: true, level: t.level, cost: info.cost };
  }

  BS.td = {
    COLS: COLS, ROWS: ROWS, TICK: TICK, BASE_HP: BASE_HP,
    WAVE_TICKS: WAVE_TICKS,
    pathOf: pathOf, start: start, wave: wave, tickOnce: tickOnce, beginWave: beginWave,
    deployOk: deployOk, addTower: addTower, removeTower: removeTower, setPri: setPri,
    upgrade: upgrade, upgradeInfo: upgradeInfo, upgradeCost: upgradeCost, levelMul: levelMul,
    applyBranch: applyBranch, BRANCHES: BRANCHES, BRANCH_BY: BRANCH_BY,
    MUTATIONS: MUTATIONS, MUT_BY: MUT_BY, optionsFor: optionsFor,
    GATE_LEVELS: GATE_LEVELS, MAX_MUT: MAX_MUT,
    gateLevelFor: gateLevelFor, gateOpenAt: gateOpenAt,
    mutate: mutate, mutOn: mutOn, choose: choose, detonate: detonate,
    peakOf: peakOf, wireOf: wireOf, rewire: rewire,
    setFlux: setFlux, fluxOf: fluxOf, fluxNeutral: fluxNeutral,
    buffsOf: buffsOf, buffsNeutral: buffsNeutral,
    setMods: setMods, modsOf: modsOf, modsNeutral: modsNeutral,
    key: key, cheb: cheb
  };
})(window.BS);
