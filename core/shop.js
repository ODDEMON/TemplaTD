/* core/shop.js —— 图形工坊：拼图形、量读数、提交进化。
   ------------------------------------------------------------------
   这一部的新分工（本版的根本决策）：
     · 多格图形不再直接落进战场。它们先进「图形工坊」——一座小号的
       CONFIGURA 式组装台：元件只由整块正方形的格组成，拼什么、拼多大，
       由六项读数当场说话。
     · 提交（进化）那一刻，整具图形塌缩成一座**只占一格的炮塔**，
       进驻军械库。战场上不再有多格脚印、不再有墙——塔防那一边
       只认炮塔的属性块，与图形系统除「进化」这一座桥外再无关联。
   图纸存 bus.state.shop（刷新不丢），进化体存 bus.state.armory。
   进化体的名字与编号只由 armorySeq 决定：同一编号永远是同一座塔。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, Bd = BS.body, P = BS.parts, E = BS.eff;

  /* 工坊棋盘：基准 14 × 9，可被升级商店的「图纸扩容」逐级放大。
     为什么要大：板子越大，能容纳的成分越多、对称与环络上得去，
     质变度（进而炮塔属性）就越有空间。小板子拼不出好图形——
     所以「扩容」是一条实打实的成长线，不是摆设。
     **只扩不缩**：升级只会把上界变宽，已经放下的元件永远在新界内，
     不需要搬移或清理任何已有图纸。 */
  var BASE_COLS = 14, BASE_ROWS = 9;
  var STEP = 2;              /* 每级扩容的格数（行列各 +2，保持接近原比例） */

  /* 升级加成：读 meta 的「图纸扩容」层数。指针宇宙缺席时也能跑。 */
  function roomLv() {
    try {
      if (BS.meta && BS.meta.upLv) return BS.meta.upLv('room') | 0;
    } catch (e) { /* 由它去 */ }
    return 0;
  }
  function cols() { return BASE_COLS + roomLv() * STEP; }
  function rows() { return BASE_ROWS + roomLv() * STEP; }

  /* 序号 → 形状的本地缓存：量一次图要按格查重量，别反复生成。 */
  var SCACHE = {};
  function partOf(i) {
    if (SCACHE[i] === undefined) { SCACHE[i] = P.shapeOf(i); SCACHE[i].i = i; }
    return SCACHE[i];
  }

  /* ---------- 图纸：直接借 body 的格位模型 ----------
     每格记 { e:'p'+序号, ox, oy, r }——与 CONFIGURA 的板同构，
     但这里没有 cadence、没有撤销栈、没有估价经济，只有拼与量。 */
  function board() {
    var s = BS.bus.state.shop;
    if (!s || !s.cells) { s = { cells: {}, seq: 0 }; BS.bus.state.shop = s; }
    return s;
  }
  function n() { return Bd.n(board()); }

  function clear() {
    BS.bus.state.shop = { cells: {}, seq: 0 };
    BS.bus.save();
    BS.bus.emit('shop');
  }

  /* ---------- 放置：整件都放得下，且至少一格贴着已有的格 ---------- */
  function cellsOf(i, at, rot) {
    var part = partOf(i);
    return P.rotCells(part.cells, rot | 0);
  }
  function canPlace(i, at, rot) {
    if (i < 0 || i >= P.pool()) return BS.i18n.get('库里没有这一件');
    var b = board(), cs = cellsOf(i, at, rot), z, x, y, C = cols(), R = rows();
    for (z = 0; z < cs.length; z++) {
      x = at[0] + cs[z][0]; y = at[1] + cs[z][1];
      if (x < 0 || y < 0 || x >= C || y >= R) return BS.i18n.get('超出图纸');
    }
    /* body.canPlace 自带「图空时第一件随便放」的豁免 */
    if (!Bd.canPlace(b, cs, at[0], at[1])) {
      return BS.i18n.get('放不下：要么压了别的件，要么没贴着已有的格');
    }
    return '';
  }
  function place(i, at, rot) {
    var why = canPlace(i, at, rot);
    if (why) return { ok: false, why: why };
    var b = board(), cs = cellsOf(i, at, rot);
    Bd.place(b, at[0], at[1], 'p' + i, rot | 0, cs, b.seq | 0);
    b.seq = (b.seq | 0) + 1;
    BS.bus.save();
    BS.bus.emit('shop');
    return { ok: true };
  }
  /* 拆件：点中已放的一格，整件离场。元件来自序号池，随时再取，
     所以拆就是拆，不用二次确认。seq 一起走：试算缓存靠它失效。 */
  function remove(at) {
    var b = board();
    var ins = Bd.removeInst(b, Bd.key(at[0], at[1]));
    if (!ins) return { ok: false, why: BS.i18n.get('这一格是空的') };
    b.seq = (b.seq | 0) + 1;
    BS.bus.save();
    BS.bus.emit('shop');
    return { ok: true, serial: ins.e.slice(1) | 0 };
  }

  /* ---------- 图：整具图形的格子与成分 ----------
     归一化后的格子进测量；成分（哪几枚序号、各占几格）定型与特质。
     figFrom 接受任意的格位表——figure() 量真身，trial() 量替身。 */
  function figFrom(cells) {
    var insts = {}, k, c;
    for (k in cells) {
      c = cells[k];
      var id = c.e + '@' + c.ox + ',' + c.oy;
      if (!insts[id]) insts[id] = { e: c.e, seq: c.seq | 0, n: 0 };
      insts[id].n++;
    }
    var list = [], id2;
    for (id2 in insts) list.push(insts[id2]);
    if (!list.length) return null;
    list.sort(function (a, b) { return a.seq - b.seq; });
    var norm = [], k3;
    for (k3 in cells) {
      var u = Bd.unkey(k3);
      norm.push([u[0], u[1]]);
    }
    norm = P.norm(norm);
    /* 型：占格最多的那枚元件的型（并列取先放的）。它只作名字与偏好，
       测量量的是整具图形。 */
    var form = partOf(list[0].e.slice(1) | 0).form;
    var best = -1, i;
    for (i = 0; i < list.length; i++) {
      var pi = list[i].e.slice(1) | 0;
      if (list[i].n > best) { best = list[i].n; form = partOf(pi).form; }
    }
    /* 稀有度：整具按最高档的料计重——贵的料抬高整件的价，玩家读得懂。 */
    var rar = 0;
    for (i = 0; i < list.length; i++) {
      var r = partOf(list[i].e.slice(1) | 0).rar;
      if (r > rar) rar = r;
    }
    /* 特质：并集，去重，封顶 3 条——与单件的特质上限同一条线。 */
    var traits = [], seen = {};
    for (i = 0; i < list.length; i++) {
      var ts = partOf(list[i].e.slice(1) | 0).traits;
      for (var z = 0; z < ts.length; z++) {
        if (!seen[ts[z]] && traits.length < 3) { seen[ts[z]] = 1; traits.push(ts[z]); }
      }
    }
    var forms = [];
    for (i = 0; i < list.length; i++) {
      var fm = partOf(list[i].e.slice(1) | 0).form;
      if (forms.indexOf(fm) < 0) forms.push(fm);
    }
    return { cells: norm, form: form, rar: rar, traits: traits, forms: forms,
      parts: list.map(function (s) { return s.e.slice(1) | 0; }) };
  }

  function figure() {
    var b = board();
    if (!Bd.n(b)) return null;
    return figFrom(b.cells);
  }

  /* ---------- 测量：按图形签名缓存 ----------
     同一具图形（格位 + 型 + 特质 + 稀有度）读数只算一次。 */
  var MCACHE = {};
  function read(fig) {
    var k = JSON.stringify([fig.cells, fig.form, fig.rar, fig.traits]);
    if (MCACHE[k]) return MCACHE[k];
    var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
    var out = BS.tower.read(part);
    MCACHE[k] = out;
    return out;
  }
  function forget() { MCACHE = {}; SCACHE = {}; }

  /* ---------- 试算：往克隆图上放一件再量一次 ----------
     先知代替后悔：信息要给在按空格之前。真身不动、计数不动、缓存不脏。
     返回 { ok:true, esScore, cost } 或 { ok:false }；按图版 seq 缓存。 */
  var TCACHE = {};
  function trial(i, at, rot) {
    var b = board();
    /* canPlace 的 OK 是空串——判「放不下」要用 !== ''，不能取反 */
    if (i < 0 || canPlace(i, at, rot) !== '') return { ok: false };
    var key = i + ':' + (rot | 0) + ':' + at[0] + ',' + at[1] + ':' + (b.seq | 0);
    if (TCACHE[key]) return TCACHE[key];
    var clone = { cells: {} }, k;
    for (k in b.cells) clone.cells[k] = b.cells[k];
    var cs = cellsOf(i, at, rot);
    Bd.place(clone, at[0], at[1], 'p' + i, rot | 0, cs, (b.seq | 0) + 1);
    var fig = figFrom(clone.cells);
    var r = read(fig);
    var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
    var out = { ok: true, esScore: r.esScore, es: r.es, cost: BS.build.cost(part), n: fig.cells.length };
    TCACHE[key] = out;
    return out;
  }

  /* ---------- 进化体：提交之后 Graphic 变炮塔 ---------- */
  function pad(s, w) { var t = String(s); while (t.length < w) t = '0' + t; return t; }
  function serialOf(id) { return 'TC-' + pad(id, 3); }

  /* 深拷贝一座塔的记录。流水要独立于在库记录，
     不然「淘汰后在库那条被删」或「将来在库读数被改」都会连累历史。
     这里手写而不是 JSON 往返：字段是已知的、结构是浅的，手写更快也更严。
     parts（元件清单）、br（专精）与 mut（质变口长出来的形变）都要带：
     前者是「拆解还料」的凭据，后两者是这座塔的立场与它后来长成的东西
     ——流水里看得见，撤收恢复时也带得回来。 */
  function recSnap(rec) {
    return {
      id: rec.id, serial: rec.serial, nm: rec.nm,
      form: rec.form, forms: (rec.forms || []).slice(),
      rar: rec.rar, traits: (rec.traits || []).slice(),
      cells: (rec.cells || []).map(function (c) { return [c[0], c[1]]; }),
      parts: (rec.parts || []).slice(),
      n: rec.n, es: rec.es, esScore: rec.esScore,
      br: rec.br || null,
      mut: (rec.mut || []).slice(),
      spec: rec.spec ? JSON.parse(JSON.stringify(rec.spec)) : null,
      cost: rec.cost, at: rec.at
    };
  }

  /* 进化体的显示名：**派生**（型 + 编号），按当前语言现算。
     存档里那份 nm 是提交那一刻的定格（流水要留档、身份要稳定），
     但界面显示走这里——否则「切换语言之后，先造的那批塔还叫中文名」。 */
  function nameOfSpec(a) {
    if (!a) return '';
    var id = a.nmId != null ? a.nmId : (String(a.serial || '').replace(/[^0-9]/g, '') | 0);
    return BS.i18n.fill('进化体·#', BS.i18n.term(P.FORM_BY[a.form]) + ' ' + pad(id, 3));
  }
  function nameOf(rec) {
    return rec ? nameOfSpec({ form: rec.form, nmId: rec.id, serial: rec.serial }) : '';
  }

  function submit() {
    var fig = figure();
    if (!fig) return { ok: false, why: BS.i18n.get('图纸是空的——先放上一枚元件') };
    var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
    var r = read(fig);
    var spec = BS.tower.attrs(part);
    var cost = BS.build.cost(part);
    var id = BS.bus.state.armorySeq | 0;
    var rec = {
      id: id, serial: serialOf(id),
      nm: BS.i18n.fill('进化体·#', BS.i18n.term(P.FORM_BY[fig.form]) + ' ' + pad(id, 3)),
      form: fig.form, forms: fig.forms, rar: fig.rar, traits: fig.traits.slice(),
      cells: fig.cells, parts: (fig.parts || []).slice(), n: fig.cells.length,
      es: r.es, esScore: r.esScore, br: null, mut: [],
      spec: spec, cost: cost, at: Date.now()
    };
    spec.nm = rec.nm; spec.serial = rec.serial;
    /* 编号也进 spec：名字是**派生**的（型 + 编号），战场那边要能现算。 */
    spec.nmId = id;
    BS.bus.state.armory.push(rec);
    /* 流水同步写一份。它与 armory 存的是同一座塔，但使命不同：
       armory 会被淘汰删掉，流水永不删——所以流水是「做过什么」的底账。
       擦掉 at（时间戳）也无所谓，它只用来排序与显示。 */
    if (!Array.isArray(BS.bus.state.armoryLog)) BS.bus.state.armoryLog = [];
    var CAP = BS.bus.ARMORY_LOG_CAP || 400;
    /* 存**浅拷贝**：流水与在库记录必须各是各的对象。
       同一引用的话，将来任何一处改读数都会把历史一起改掉——
       历史一旦能被改写，就不叫底账了。 */
    BS.bus.state.armoryLog.push(recSnap(rec));
    if (BS.bus.state.armoryLog.length > CAP) {
      BS.bus.state.armoryLog.splice(0, BS.bus.state.armoryLog.length - CAP);
    }
    BS.bus.state.armorySeq = id + 1;
    BS.bus.state.shop = { cells: {}, seq: 0 };
    BS.bus.save();
    BS.bus.log(BS.i18n.fill('# 已进化入库，部署成本 # 辉光', rec.nm, cost), 'sys');
    BS.bus.emit('armory');
    BS.bus.emit('shop');
    return { ok: true, rec: rec };
  }

  /* 正在这一局里站岗的编号——部署阶段与局中都算。淘汰要避开它们。 */
  function deployedIds() {
    var r = BS.run ? BS.run.current() : null, out = {}, i;
    if (r) for (i = 0; i < r.deployed.length; i++) out[r.deployed[i].aid] = 1;
    return out;
  }

  /* 淘汰：正在局里部署着的进化体不许拆——拆了战场就悬空了。
     **拆解还料**（本版）：这座塔的元件清单还回库。为什么必须还——
     实测（test/_balance.mjs 的死结体检）抓到过一种死局：起手拼一具
     又大又贵的图形，成本超过全局部署预算，于是「没有一座塔请得回」，
     而尘的唯一水龙头是战斗结算——玩家被锁在局外，永远翻不了身。
     拆解还料把锁打开：请不起就拆，拆了拼一具小的。
     「提交消耗元件」这条不变——还料发生在**淘汰**这一刻，
     不是提交那一刻；流水（底账）更不因淘汰少一条。 */
  function discard(id) {
    var arm = BS.bus.state.armory, i;
    if (deployedIds()[id]) return { ok: false, why: BS.i18n.get('它正在这一局里站岗，先撤下再淘汰') };
    for (i = 0; i < arm.length; i++) {
      if (arm[i].id === id) {
        var ps = arm[i].parts || [], z;
        arm.splice(i, 1);
        for (z = 0; z < ps.length; z++) BS.store.give(ps[z] | 0);
        BS.bus.save();
        BS.bus.emit('armory');
        return { ok: true, back: ps.length };
      }
    }
    return { ok: false, why: BS.i18n.get('军械库里没有这一座') };
  }

  /* ---------- 专精：装配台上装模块 ----------
     局外成长，所以花**结晶**（闸门不变：尘管抽、晶管长、辉管局内）。
     一次性：装了就是这座塔的立场，别局也带着它走——想换请进化下一座。
     模块表在 td.js（战斗域），这里只做闸门与记账；效果落地在
     run.specsOf 调 TD.applyBranch 的那一刻——与乱流同一套规矩：
     run 是唯一同时认识在库记录与战场的地方。 */
  /* 装一块模块的结晶价。定 40 的道理：一局好的撤离约入账 30 结晶
     （2/波 + 撑过 10 波的犒赏），所以一块模块 ≈ 一课升级线的价、
     攒一局就装得起——装配台是每一两局都该回来看看的地方，
     不是攒二十局才摸得着的纪念碑。塔开战即消耗，模块跟着这座塔
     打它的那一局；所以它买的不是永久 buff，是「这一局怎么打」。 */
  var FIT_COST = 40;
  function fitCost() { return FIT_COST; }
  function fit(id, br) {
    var arm = BS.bus.state.armory, i, rec = null;
    for (i = 0; i < arm.length; i++) if (arm[i].id === id) rec = arm[i];
    if (!rec) return { ok: false, why: BS.i18n.get('军械库里没有这一座') };
    /* 正在局里站岗的不给装：部署相位里 add() 已经按旧属性块落过塔，
       事后再装会出现「库里装着、场上没装」的半修状态——与淘汰同一条界。 */
    if (deployedIds()[id]) return { ok: false, why: BS.i18n.get('它正在这一局里站岗，先撤下再装') };
    if (!BS.td || !BS.td.BRANCH_BY[br]) return { ok: false, why: BS.i18n.get('没有这块模块') };
    if (rec.br) return { ok: false, why: BS.i18n.get('这座塔已经装过模块了——专精是一次性的') };
    if (BS.bus.state.crystal < FIT_COST)
      return { ok: false, why: BS.i18n.get('结晶不够：装一块模块要 # 结晶').replace('#', FIT_COST) };
    BS.bus.state.crystal -= FIT_COST;
    rec.br = br;
    BS.bus.save();
    BS.bus.emit('armory');
    return { ok: true, br: br, cost: FIT_COST };
  }

  BS.shop = {
    /* 尺寸一律走 cols()/rows()——它们会随「图纸扩容」升级变大。
       **故意不提供 COLS/ROWS 常量别名**：留一个静态常量在那儿，
       迟早有人拿它当「当前板子尺寸」用，而那是错的。
       BASE_COLS/BASE_ROWS 是「零级时的尺寸」，只给测试与文档参考。 */
    BASE_COLS: BASE_COLS, BASE_ROWS: BASE_ROWS, STEP: STEP,
    cols: cols, rows: rows, roomLv: roomLv,
    board: board, n: n, clear: clear, canPlace: canPlace, place: place, remove: remove,
    figure: figure, figFrom: figFrom, read: read, forget: forget, trial: trial, submit: submit,
    serialOf: serialOf, discard: discard, deployedIds: deployedIds, partOf: partOf,
    nameOf: nameOf, nameOfSpec: nameOfSpec,
    fit: fit, fitCost: fitCost,
    recSnap: recSnap
  };
})(window.BS);
