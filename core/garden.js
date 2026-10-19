/* core/garden.js —— 图形花园。
   ------------------------------------------------------------------
   花园是一块**会自己长大**的常驻板。本版两处大改：

   **一、无限延展。** 旧版是钉死的 12×8——种满就种满，玩家对着
   一块满了的园子无事可做。现在园子按**已种格数**一圈一圈向外长：
   起始 16×12，每满 16 格长宽各 +2，只扩不缩、没有设计上限。
   层数记在板子上（garden.lv），所以挖走元件也**不会**把园子缩回去——
   已种下的东西永远在新界内，扩容不需要搬移或清理任何已有图形。
   （手滑上限 400 层纯粹是防呆，不是玩法上限：真要到那儿得有六千多格。）

   **二、功能换成战斗辅助。** 旧版是「随真实时间滴答的被动采集尘」——
   一个挂在墙上时钟上的水龙头，玩家什么都不做也在涨。本版起花园
   只服务**战斗**：种下的每一件按自己的六项读数给两类加成
     · **战斗掉落**：辉光掉落 +% · 尘晶掉落 +%
     · **增益**：伤害 +% · 攻速 +% · 射程 + · 暴击率 +
   于是花园从「放着不管也会涨的后台」变成「我为下一局准备了什么」——
   它改变的是**这一局怎么打**，而不是账本上的一个数。

   两类加成的量都走小于 1 的幂次（eff.pow）：种得越多越强，
   但每一格的边际贡献递减，「再种一具大的」与「把这一具修得更对称」
   因此成为两个不同的选择，而不是后者永远压倒前者。

   **三、前期加强（本版）。** 计量单位从「整园那一具根」换成「件」，
   再加一条苗床（园子越空、每一格越值钱）。为什么要改：
   贴着根种的规矩让整园恒为一具根，于是「整园的峰值决定加成哪一类」
   退化成「六类里五类恒为 0」，连设计文档里自己写的失败信号 G2 都踩上了；
   而且根长大了峰值会换人，种第二件时暴击加成能当场归零——越种越弱。
   按件计量之后，种一件多一份、只会往上加；前几件就能点亮三四类。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var Bd = BS.body, P = BS.parts, E = BS.eff;

  var BASE_COLS = 16, BASE_ROWS = 12;   /* 起始园子（旧版 12×8，本版抬高） */
  var PER_LEVEL = 16;                   /* 每 16 格，向外扩一圈 */
  var STEP = 2;                         /* 每圈长宽各 +2 */
  var SAFETY = 400;                     /* 防呆层数上限：6400+ 格，碰不到 */

  function board() {
    var g = BS.bus.state.garden;
    if (!g || !g.cells) { g = { cells: {}, seq: 0, lv: 0 }; BS.bus.state.garden = g; }
    return g;
  }
  function n() { return Bd.n(board()); }

  /* 层数：只增不减。挖走元件只减格数，不减层数——
     否则「挖一格园子就塌一圈」会把玩家种下去的东西连座端走。 */
  function level() {
    var b = board();
    if (!(b.lv > 0)) b.lv = 0;
    return b.lv | 0;
  }
  function cols() { return BASE_COLS + level() * STEP; }
  function rows() { return BASE_ROWS + level() * STEP; }

  /* 种下之后调：格数够上一档就扩一圈。返回有没有扩。 */
  function grow() {
    var b = board();
    var want = Math.min(SAFETY, Math.floor(Bd.n(b) / PER_LEVEL));
    if (want > (b.lv | 0)) { b.lv = want; return true; }
    return false;
  }

  /* ---------- 种与挖 ---------- */
  function cellsOf(i, at, rot) {
    return P.rotCells(BS.shop.partOf(i).cells, rot | 0);
  }
  function canPlant(i, at, rot) {
    if (i < 0) return BS.i18n.get('手上是空的');
    var b = board(), cs = cellsOf(i, at, rot), z, x, y, C = cols(), R = rows();
    for (z = 0; z < cs.length; z++) {
      x = at[0] + cs[z][0]; y = at[1] + cs[z][1];
      if (x < 0 || y < 0 || x >= C || y >= R) return BS.i18n.get('超出花园');
    }
    if (!Bd.canPlace(b, cs, at[0], at[1])) {
      return BS.i18n.get('种不下：要么压了别的件，要么没贴着已有的根');
    }
    return '';
  }
  function plant(i, at, rot) {
    var why = canPlant(i, at, rot);
    if (why) return { ok: false, why: why };
    var b = board(), cs = cellsOf(i, at, rot);
    Bd.place(b, at[0], at[1], 'p' + i, rot | 0, cs, b.seq | 0);
    b.seq = (b.seq | 0) + 1;
    /* 质变度入账（成就 M7 盯着它） */
    var comps = figs(), f;
    var best = 0;
    for (var k = 0; k < comps.length; k++) {
      f = comps[k];
      if (f.esScore > best) best = f.esScore;
    }
    var st = BS.bus.state.meta;
    if (best > (st.maxGarEs | 0)) st.maxGarEs = best;
    var grew = grow();
    BS.bus.save();
    BS.bus.emit('garden');
    if (grew) BS.bus.emit('gain');   /* 板子变了，工坊那类页面要靠它重画 */
    return { ok: true, grew: grew, lv: level() };
  }
  function dig(at) {
    var b = board();
    var ins = Bd.removeInst(b, Bd.key(at[0], at[1]));
    if (!ins) return { ok: false, why: BS.i18n.get('这一格是空的') };
    b.seq = (b.seq | 0) + 1;
    BS.bus.save();
    BS.bus.emit('garden');
    return { ok: true, serial: ins.e.slice(1) | 0 };
  }

  /* ---------- 每一件自己的读数 ----------
     「件」= 板上一个元件实例（同一枚元件在同一处铺下的那一片格）。
     读数由形状决定（tower.read 按元件签名缓存），所以一件的读数
     种下之后**再也不会变**——这一条是后面那条单调性的全部来源。 */
  function insts() {
    var list = Bd.instList(board()), out = [], i;
    for (i = 0; i < list.length; i++) {
      var ins = list[i], id = ins.e.slice(1) | 0;
      var part = BS.shop.partOf(id);
      var one = { cells: P.norm(P.rotCells(part.cells, ins.r | 0)),
        form: part.form, traits: part.traits, rar: part.rar, i: null };
      var r = BS.tower.read(one);
      out.push({
        id: id, r: ins.r | 0, n: ins.cells.length, seq: ins.seq | 0,
        ox: ins.ox | 0, oy: ins.oy | 0,
        es: r.es, esScore: r.esScore, st: r.st,
        peak: r.st.esPeak, peakV: r.st.esPeakV || 0
      });
    }
    return out;
  }

  /* 离根的件：园子里还有别的件，而它所在的那一块里只有它一件。
     （园子里总共只有一件时不算离根——第一件本来就无处可贴。）
     挖断才会造出这种件，所以这是「挖之前先想」的那条代价。 */
  function orphans() {
    var list = Bd.instList(board()), cs = comps(), per = {}, out = {}, z, k, ck, cnt, tot, i;
    for (z = 0; z < cs.length; z++) {
      cnt = {}; tot = 0;
      for (k in cs[z]) {
        ck = Bd.ik(cs[z][k].e, cs[z][k].ox, cs[z][k].oy);
        if (!cnt[ck]) { cnt[ck] = 1; tot++; }
      }
      for (ck in cnt) per[ck] = tot;
    }
    for (i = 0; i < list.length; i++) {
      out[Bd.ik(list[i].e, list[i].ox, list[i].oy)] = (per[Bd.ik(list[i].e, list[i].ox, list[i].oy)] === 1) && list.length > 1;
    }
    return out;
  }

  /* ---------- 根 graphic：花园板上每一个连通块 ----------
     复用 shop.figFrom（按格位表定量），这里按连通块切开来量。 */
  function comps() {
    var b = board(), ks = Object.keys(b.cells);
    if (!ks.length) return [];
    var set = {}, D = [[1, 0], [-1, 0], [0, 1], [0, -1]], out = [], i;
    for (i = 0; i < ks.length; i++) set[ks[i]] = b.cells[ks[i]];
    for (i = 0; i < ks.length; i++) {
      if (!set[ks[i]]) continue;
      var comp = {}, stack = [ks[i]];
      comp[ks[i]] = set[ks[i]];
      delete set[ks[i]];
      while (stack.length) {
        var u = stack.pop(), uv = Bd.unkey(u), z;
        for (z = 0; z < 4; z++) {
          var nk = (uv[0] + D[z][0]) + ',' + (uv[1] + D[z][1]);
          if (set[nk]) { comp[nk] = set[nk]; delete set[nk]; stack.push(nk); }
        }
      }
      out.push(comp);
    }
    return out;
  }
  function figs() {
    var cs = comps(), out = [], i;
    for (i = 0; i < cs.length; i++) {
      var fig = BS.shop.figFrom(cs[i]);
      if (fig && fig.cells.length) {
        var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
        var r = BS.shop.read(fig);
        out.push({ fig: fig, es: r.es, esScore: r.esScore, st: r.st,
          spec: BS.tower.attrs(part), cost: BS.build.cost(part) });
      }
    }
    return out;
  }

  /* ---------- 六项读数 → 战斗面 ----------
     **计量单位是「件」，不是「整园那一具根」。**
     上一版按整园那一具根的峰值给一类加成，实测踩了自己写的失败信号 G2：
     贴着根种的规矩让整园恒为一具根，于是**六类加成里五类恒为 0**——
     种满 128 件，面板上也只有辉光一类有数，其余五项一行 0.0。
     更糟的是那一具根长大了**峰值会换人**：实测种第二件时整园对称度
     从 1.00 塌到 0.22，暴击加成 10.1% 当场归零——**越种越弱**。
     换成「件」之后两件事同时成立：
       · 已种下的件读数不再变化 → 种一件多一份，**只会往上加，不会吃掉别人的**；
       · 每件自己六项都出力 → 前几件就能同时点亮三四类，前期不再是一行 0。

     每件怎么出力：自己的峰值那一项**全额**，其余五项按 SUB 折。
     为什么要折：全项全额会让「随便种一件」等于六类各 +10%，
     「这一件是对称的所以它给暴击」这条因果就被抹平了。 */
  /* 每类加成带 en：它是表项，界面按当前语言取（I.term）——
     语言层与这一张表互不知道对方存在，靠的就是「表项自带 en」这条约定。 */
  var KINDS = [
    { k: 'sym', t: '暴击率', en: 'CRIT RATE', v: 'critPct', g: 12 },
    { k: 'repeat', t: '攻速', en: 'RATE', v: 'ratePct', g: 18 },
    { k: 'void', t: '射程', en: 'RANGE', v: 'rangeAdd', g: 1.2 },
    { k: 'even', t: '伤害', en: 'DMG', v: 'dmgPct', g: 16 },
    { k: 'weave', t: '辉光掉落', en: 'LUX DROP', v: 'luxPct', g: 16 },
    { k: 'edge', t: '尘晶掉落', en: 'DUST/CRYSTAL DROP', v: 'dropPct', g: 16 }
  ];
  /* 读数名 → 加成行。界面按它把「这一件的主项」翻成人话（暴击率 / 攻速 / …），
     不想让页面自己再遍历一遍 KINDS 去猜。 */
  var KIND_BY = {};
  (function () { var i; for (i = 0; i < KINDS.length; i++) KIND_BY[KINDS[i].k] = KINDS[i]; })();

  var SUB = 0.35;          /* 副项折扣：不是这一件峰值的读数按三成半出力 */
  var ORPHAN = 0.5;        /* 离根的件出力折半——让「贴着根种」不只是放置约束 */
  var NURSE = 0.5;         /* 苗床：落在苗床里的那些格，出力额外再给一半 */
  var NURSE_CELLS = 96;    /* 苗床的格数（96 格 = 6 圈），按种植顺序取最早的 */

  /* 苗床。**加强前期的那一脚**：最早种下的 NURSE_CELLS 格（96 格 = 6 圈），
     它们的出力**额外再给一半**。为什么是「按格划一段」而不是「全园乘一个
     随园子变大而衰减的系数」：后者实测会让苗床的衰减跑赢读数的增长——
     种第 2 件时射程从 0.472 掉到 0.462，等于我自己又把「越种越弱」请回来了。
     按格划段之后两份原料都只增不减：全园那份随件数涨，
     苗床那份在 96 格之内涨、之后封顶不动，两项都不会被后来者吃掉。
     挖走早年的件会让后面的件**顶进苗床**（窗口按种植顺序算），
     于是「我要不要把这一片挖了重种」是一个有数字可看的问题，而不是玄学。 */
  function nurse(cells) {
    var c = cells == null ? Bd.n(board()) : (cells | 0);
    return Math.max(0, Math.min(c, NURSE_CELLS));   /* 苗床里已经用掉的格数 */
  }

  /* 全局收益：两类加成，全部现算。
     raw 累加的是「满强度贡献的份数」，**不在这里乘系数**——
     系数与幂次都在出口处做一次。每件折一次幂次等于把曲线折 N 回，
     加成会低到看不出来，那不是我想要的递减。 */
  function mods() {
    var is = insts(), or = orphans(), raw = {}, nur = {}, i, k, it, w, v, s, inn;
    for (k = 0; k < KINDS.length; k++) { raw[KINDS[k].v] = 0; nur[KINDS[k].v] = 0; }
    var cells = 0, orph = 0, cum = 0;
    for (i = 0; i < is.length; i++) {
      it = is[i];
      cells += it.n;
      w = or[Bd.ik('p' + it.id, it.ox, it.oy)] ? ORPHAN : 1;
      if (w < 1) orph++;
      inn = Math.max(0, Math.min(it.n, NURSE_CELLS - cum));   /* 这一件有几格落在苗床里 */
      cum += it.n;
      for (k = 0; k < KINDS.length; k++) {
        v = it.es[KINDS[k].k] || 0;
        if (v <= 0.05) continue;        /* 太平的读数不表态——别让噪声也变成加成 */
        s = v * (it.n / PER_LEVEL) * w * (KINDS[k].k === it.peak ? 1 : SUB);
        raw[KINDS[k].v] += s;
        if (inn > 0) nur[KINDS[k].v] += s * (inn / it.n);
      }
    }
    var out = {
      parts: is.length, roots: comps().length, orphans: orph,
      cells: cells, lv: level(), nurse: nurse(cells),
      critPct: 0, ratePct: 0, rangeAdd: 0, dmgPct: 0, luxPct: 0, dropPct: 0
    };
    for (k = 0; k < KINDS.length; k++) {
      out[KINDS[k].v] = (E.pow(raw[KINDS[k].v], 1) + E.pow(nur[KINDS[k].v], 1) * NURSE) * KINDS[k].g;
    }
    return out;
  }

  /* 给塔防的那一张纸（纯数据块，与 flux 同一种东西）。
     只有 run.js 会调它——塔防不认识花园，这是边界（门禁钉着）。 */
  function buffs() {
    var m = mods();
    return {
      dmgMul: 1 + m.dmgPct / 100,
      rateMul: 1 + m.ratePct / 100,
      rangeAdd: m.rangeAdd,
      critP: m.critPct / 100,
      luxMul: 1 + m.luxPct / 100
    };
  }

  BS.garden = {
    BASE_COLS: BASE_COLS, BASE_ROWS: BASE_ROWS, PER_LEVEL: PER_LEVEL, STEP: STEP,
    KINDS: KINDS, KIND_BY: KIND_BY,
    SUB: SUB, ORPHAN: ORPHAN, NURSE: NURSE, NURSE_CELLS: NURSE_CELLS,
    board: board, n: n, level: level, cols: cols, rows: rows, grow: grow,
    canPlant: canPlant, plant: plant, dig: dig,
    comps: comps, figs: figs, insts: insts, orphans: orphans, nurse: nurse,
    mods: mods, buffs: buffs
  };
})(window.BS);
