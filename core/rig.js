/* core/rig.js —— 装配台与库。
   ------------------------------------------------------------------
   库靠时间落件：每 PERIOD 秒多一件，而且**只在你开着页面的时候走**——
   关了页面，上游也不落。这是这一版的规矩：计时从页面启动的那一刻起算，
   你不在场，就没有件落下来。

   光不再按件结算。装一件不进账：光是在**呈交**那一刻一次到账的——
   你把这一具图形整个拍卖出去，价由它此刻符合了多少条鉴赏条目定。
   所以组装台上那根「估价」条才是这一稿真正的仪表盘。

   规则仍是两条：整件都放得下，且至少一格贴着已有的格；图空着时第一件随便放。
   装上去之后还能平移、旋转；**拆掉就要不回来了**——拆下来的元件不回库，
   直接进 S.gone，永久离场。

   这一条是这一版最重的一次改契约（T6）：拆下的元件不回库，整件永久离场。
   从前「拆了还能拿回来」，于是每一个动作都免费可逆，每一个「选择」
   都能在事后零成本改到最好——能免费改到最好的选择，就不成其为选择。
   现在拆是一次真取舍：装之前先用试算看清楚（T2 是它的前提），
   按下去之后认账。唯一的安全阀是撤销栈，默认五步。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var B = BS.bus, Bd = BS.body, P = BS.parts, S = B.state;
  function T(zh) { return BS.ui ? BS.ui.T(zh) : zh; }

  var PERIOD = 10;          /* 每 10 秒落一件（基准，会被 haste 缩短） */
  var START = 8;            /* 开局先落这八件 */
  var GRACE = PERIOD * 2;   /* 开局这两件的工夫，上游不落新件 */
  var SHC = {}, GLC = {}, MTC = {}, GMP = {};   /* 形状 / 字形 / 元件信息 缓存 */

  function body() {
    if (!S.body || !S.body.cells || typeof S.body.cells !== 'object') S.body = Bd.fix(S.body);
    return S.body;
  }
  function cellsOf(e) {
    if (SHC[e]) return SHC[e];
    var out;
    if (e.charAt(0) === 'n') out = P.shapeOf(+e.slice(1)).cells;
    else out = [[0, 0]];
    SHC[e] = out;
    return out;
  }
  function glyphsOf(e) {
    if (GLC[e]) return GLC[e];
    var out;
    if (e.charAt(0) === 'n') out = P.shapeOf(+e.slice(1)).glyphs;
    else out = ['sq'];
    GLC[e] = out;
    return out;
  }
  /* 转过 r 个 90° 之后的 {cells, glyphs}。字形跟着一起转，
     所以「转一下之后这件的长相」和原来完全是同一套设计。 */
  function rotPairOf(e, r) {
    var key = e + ':' + ((r | 0) % 4 + 4) % 4;
    if (GMP[key]) return GMP[key];
    var pr = P.rotPair(cellsOf(e), glyphsOf(e), r);
    pr.map = {};
    for (var z = 0; z < pr.cells.length; z++) pr.map[pr.cells[z][0] + ',' + pr.cells[z][1]] = pr.glyphs[z];
    GMP[key] = pr;
    return pr;
  }
  /* 图纸要画某一格：取这一件在某一转向下、某一格上的字形 */
  function glyphOf(e, r, dx, dy) {
    var m = rotPairOf(e, r).map;
    return m[dx + ',' + dy] || 'sq';
  }
  function metaOf(e) {
    if (MTC[e]) return MTC[e];
    var o;
    if (e.charAt(0) === 'n') {
      var s = P.shapeOf(+e.slice(1));
      o = { w: P.RARITY[s.rar].w, rar: s.rar, lv: 0, nm: P.nameOf(+e.slice(1)), traits: s.traits || [], form: s.form || 'shard' };
    } else {
      o = { w: 1, rar: 0, lv: 0, nm: e, traits: [], form: 'shard' };
    }
    MTC[e] = o;
    return o;
  }
  function forget() { SHC = {}; GLC = {}; MTC = {}; GMP = {}; }

  function insts() { return Bd.instList(body()); }

  /* ---------- 指标：真算 + 特质/脉络抬高 ---------- */
  var _st = null, _stKey = '';
  var ESSC = null;
  function essenceBoost() {
    if (ESSC) return ESSC;
    var traits = BS.sim.boardTraits({ insts: insts, metaOf: metaOf });
    var ids = [], k, z;
    for (k in traits) for (z = 0; z < traits[k]; z++) ids.push(k);
    var mods = BS.tree ? BS.tree.mods() : { essence: [] };
    ESSC = { ids: ids, mods: mods };
    return ESSC;
  }
  function statsRaw() { return Bd.stats(body(), metaOf); }
  function stats() {
    var key = (S.seq | 0) + ':' + Bd.n(body()) + ':' + (BS.tree ? (BS.tree.mods().nodes | 0) : 0);
    if (_st && _stKey === key) return _st;
    var st = statsRaw();
    var base = st.es || {};
    var eb = essenceBoost();
    var bs = BS.sim.boostedEssence(base, eb.ids, eb.mods, st.n);
    st.esScore = bs.score;
    /* 六项的读数一项项搬过去。字段名由 DEFS 推出来，不在这里抄一份——
       抄一份就会在加减指标那天对不上。 */
    var di, dk;
    for (di = 0; di < BS.essence.DEFS.length; di++) {
      dk = BS.essence.DEFS[di].k;
      st[BS.essence.statKey(dk)] = bs[dk] || 0;
    }
    st.esSpread = bs.spread; st.esGm = bs.gm;
    st.esWeak = bs.weak; st.esLo = bs.lo;
    st.es = bs;
    st.esRaw = base;
    st.esDetail = st.esDetail || null;
    _st = st; _stKey = key;
    return st;
  }
  function invalidateEssence() { ESSC = null; _st = null; _stKey = ''; }
  function marks() { return BS.achieve.marks(BS.rig); }

  /* ---------- 时间：库只在页面开着的时候落件 ----------
     S.clock 是「页面开着的总秒数」，每拍往上加，存进存档。
     关掉页面它就不走了——上游也跟着歇。所以「已落多少件」永远是
     你真在场的那段时间算出来的，不是挂机的时长。 */
  var _cc = { n: 0, cum: 0, seq: -1, period: -1 };
  function cadence() { return BS.cadence || null; }
  function curPeriod() {
    var mods = BS.tree ? BS.tree.mods() : { haste: 0 };
    return Math.max(3, PERIOD * (1 - (mods.haste || 0)));
  }
  function stepSec(k) {
    var c = cadence();
    if (c) return c.interval(k, S.seq | 0, curPeriod());
    return curPeriod();
  }
  function clock() { return Math.max(0, Number(S.clock) || 0); }
  function tickClock(dt) { S.clock = clock() + Math.max(0, dt || 0); }
  function natural() {
    var seq = S.seq | 0, per = curPeriod(), c = cadence();
    var el = clock(), t = Math.max(0, el - GRACE);
    if (!c) return START + Math.max(0, Math.floor(t / per));
    if (_cc.seq !== seq || _cc.period !== per) _cc = { n: 0, cum: 0, seq: seq, period: per };
    var guard = 0;
    while (_cc.cum + stepSec(_cc.n) <= t && guard++ < 200000) {
      _cc.cum += stepSec(_cc.n);
      _cc.n++;
    }
    return START + _cc.n;
  }
  function nextIn() {
    var el = clock(), c = cadence(), per = curPeriod();
    if (el < GRACE) return Math.max(0, GRACE - el);
    var t = el - GRACE;
    if (!c) return Math.max(0, per - (t % per));
    natural();
    return Math.max(0, _cc.cum + stepSec(_cc.n) - t);
  }
  function placedSet() {
    var m = Bd.instances(body()), id, out = {};
    for (id in m) out[m[id].e] = 1;
    return out;
  }
  function lib() {
    var on = placedSet(), gone = S.gone || {}, out = [], i;
    for (i = natural() - 1; i >= 0; i--) {
      var e = 'n' + i;
      if (on[e] || gone[e]) continue;
      out.push(e);
    }
    return out;
  }
  function libCount() { return lib().length; }
  /* 筛选后的整份清单。分页在**筛选之后**的数上走——
     从前分页用的是没筛过的下标，于是「再往 24 条」会跳过一整屏符合的件。 */
  function pick(rar, trait, form) {
    var all = lib(), out = [], i, e, m;
    for (i = 0; i < all.length; i++) {
      e = all[i];
      m = metaOf(e);
      if (rar != null && rar >= 0 && m.rar !== rar) continue;
      if (trait && (m.traits || []).indexOf(trait) < 0) continue;
      if (form && m.form !== form) continue;
      out.push({ e: e, nm: m.nm, rar: m.rar, lv: m.lv, n: cellsOf(e).length, traits: m.traits || [], form: m.form });
    }
    return out;
  }
  function page(from, count, rar, trait, form) {
    var all = pick(rar, trait, form), out = [], i;
    from = Math.max(0, from | 0);
    for (i = from; i < all.length && out.length < count; i++) out.push(all[i]);
    return { rows: out, at: from, total: all.length };
  }
  function countBy(rar, trait, form) { return pick(rar, trait, form).length; }

  /* 丢弃：库里不要的件清出去。它不换光——光只在呈交那一刻给。 */
  function discard(e) {
    if (!e || e.charAt(0) !== 'n') return { ok: false, why: T('只有库里的原件能丢') };
    if (placedSet()[e]) return { ok: false, why: T('板上的东西得先拆下来') };
    if ((S.gone || {})[e]) return { ok: false, why: T('这一件已经不在库里了') };
    var nm = metaOf(e).nm;
    drop(e);
    S.stat.recycled = (S.stat.recycled | 0) + 1;
    B.log(T('丢弃：#').replace('#', nm), 'rm');
    B.emit('lib');
    return { ok: true, nm: nm };
  }
  function recycle(e) { return discard(e); }
  function drop(e) {
    if (e.charAt(0) === 'n') { (S.gone = S.gone || {})[e] = 1; }
    delete SHC[e]; delete GLC[e]; delete MTC[e];
    var k;
    for (k in GMP) if (k.indexOf(e + ':') === 0) delete GMP[k];
  }

  /* ---------- 呈交：把这一具图形拍卖掉，这一稿就此了结 ----------
     上交是终局：光与点亮的脉络留下来，其余全部归零——库、图纸、
     记录、判定、命题与声誉、陈列、统计、时钟，一样都不带走。 */
  function canSell() { return Bd.n(body()) > 0; }
  /* 成交之前先把这一具拓下来。陈列随上交一并清空，这一手不再被 sell
     调用，但留作导出的工具：随时能把当前图纸拓成一份可存的快照。 */
  var GALCELLS = 1200;
  function capture() {
    var b = body(), ls = Bd.list(b), i, mnX = Infinity, mnY = Infinity;
    for (i = 0; i < ls.length; i++) {
      if (ls[i].i < mnX) mnX = ls[i].i;
      if (ls[i].j < mnY) mnY = ls[i].j;
    }
    var stride = ls.length > GALCELLS ? Math.ceil(ls.length / GALCELLS) : 1;
    var cs = [], gl = [], mxX = -Infinity, mxY = -Infinity, c, x, y;
    for (i = 0; i < ls.length; i += stride) {
      c = ls[i]; x = c.i - mnX; y = c.j - mnY;
      cs.push(x, y);
      gl.push(glyphOf(c.e, c.r | 0, c.i - c.ox, c.j - c.oy));
      if (x > mxX) mxX = x;
      if (y > mxY) mxY = y;
    }
    var st = stats();
    return {
      c: cs, g: gl, w: mxX + 1, h: mxY + 1, n: ls.length,
      rar: st.rarMax | 0, es: st.esScore || 0
    };
  }
  function sell() {
    var b = body();
    if (!Bd.n(b)) return { ok: false, why: T('图纸是空的，没有东西可以呈交。') };
    if (!BS.auction) return { ok: false, why: T('鉴赏录还没准备好。') };
    var ev = BS.auction.eval(BS.rig);
    if (!(ev.total > 0)) return { ok: false, why: T('这一具还不到能上拍的份上：一条鉴赏条目都没站住。') };
    var on = placedSet(), e;
    var pieces = 0;
    for (e in on) { pieces++; drop(e); }
    /* 先清场，后入账：能跨过上交的只有光（lux/luxTotal）与脉络（tree）。
       设置（prefs）与存档的生辰（t0）不是局内内容，也留着。

       另有两样东西从前也一并被清掉了，现在改为留下来——
       不留的话「从头再来」就只是惩罚，不是这一版想要的呼吸：
         · 声誉与命题序号（quest.rep / quest.next / quest.done）：
           声誉每 3 条命题才涨 0.03，封顶要 60 条；一局之内做不完 60 条，
           所以每局清零等于这条长期曲线物理上不存在。留下来它才走得动。
         · 成交记录（auc）：它是「你已经成交过 N 次」这件事的载体，
           也是鉴赏录里那道永久倍率的计数器（见 core/auction.js 的 SALES_STEP）。 */
    var q = (S.quest && typeof S.quest === 'object') ? S.quest : null;
    var auc0 = (S.auc && typeof S.auc === 'object') ? S.auc : { n: 0, total: 0, best: 0, cells: 0 };
    S.body = Bd.mk();
    S.gone = {};
    S.undo = [];
    S.ach = {};
    S.quest = {
      act: [], next: (q && q.next) | 0, done: (q && q.done) | 0,
      rep: (q && q.rep) || 0, seen: (q && q.seen) || {}
    };
    S.auc = {
      n: (auc0.n | 0) + 1,
      total: (auc0.total || 0) + ev.total,
      best: Math.max(auc0.best || 0, ev.total),
      cells: (auc0.cells | 0) + ev.n
    };
    S.gal = [];
    S.bidTier = 0;
    S.workOn = 0;
    S.clock = 0;
    S.seq = 0;
    S.stat = { placed: 0, removed: 0, moved: 0, spun: 0, recycled: 0, undone: 0, best: 0, quests: 0, achs: 0, sold: 0, soldCells: 0 };
    S.log = [];
    invalidateEssence();
    forget();
    B.gain(ev.total, 'auction');
    B.log(T('成交：# 格 / # 件拍出 # 光（# 条鉴赏站住）')
      .replace('#', ev.n).replace('#', pieces).replace('#', BS.util.big(Math.round(ev.total)))
      .replace('#', ev.k), 'auc');
    /* 挂着的三条要重新发过：序号接着往下走，所以下一局不再是同一组头三条。 */
    if (BS.quests && BS.quests.st) BS.quests.st();
    if (BS.quests && BS.quests.list) BS.quests.list();
    B.emit('body'); B.emit('lib'); B.emit('lux'); B.emit('auc', ev);
    B.emit('quest'); B.emit('ach');
    B.save();
    return { ok: true, pay: ev.total, n: ev.n, k: ev.k, pieces: pieces, top: ev.top };
  }

  /* ---------- 撤销栈 ----------
     默认就给五步，不再等「手」这条脉络点亮。
     装上是承诺之后，撤销不再是奢侈品，而是这条不可逆规则的**唯一安全阀**——
     没有安全阀的不可逆是惩罚，不是难度。基础值定在 5：
     够救回「刚拆错的那一下」，不够让看的人把一件东西反复装上拆下试到最好。
     「手」脉络在这五步之上再加，总数夹在 bus.UNDOCAP（40）以内。 */
  var UNDO_BASE = 5;
  function undoCap() {
    var add = BS.tree ? (BS.tree.mods().undo | 0) : 0;
    return Math.max(0, Math.min(B.UNDOCAP, UNDO_BASE + add));
  }
  function pushUndo(u) {
    var cap = undoCap();
    if (cap <= 0) return;
    (S.undo = S.undo || []).push(u);
    while (S.undo.length > cap) S.undo.shift();
  }
  function undoDepth() { return (S.undo || []).length; }
  function canUndo() { return undoCap() > 0 && undoDepth() > 0; }
  function undo() {
    if (!canUndo()) return { ok: false, why: undoDepth() <= 0 ? T('没有可撤销的动作了') : T('撤销不了') };
    var u = S.undo.pop();
    var b = body();
    if (u.k === 'place') {
      var ins = Bd.removeInst(b, Bd.key(u.i, u.j));
      if (!ins) {
        S.undo.push(u);
        return { ok: false, why: T('这一步撤销不了：找不到当时装的那一件') };
      }
      S.stat.undone = (S.stat.undone | 0) + 1;
      invalidateEssence();
      B.log(T('撤销：拆回「#」').replace('#', metaOf(u.e).nm), 'undo');
      B.emit('body');
      return { ok: true, k: u.k };
    }
    if (u.k === 'remove') {
      var cs = P.rotCells(cellsOf(u.e), u.r);
      if (Bd.canPlace(b, cs, u.i, u.j)) {
        Bd.place(b, u.i, u.j, u.e, u.r, cs, (S.seq | 0) + 1);
        /* 拆件不再回库，所以撤销是它唯一的回头路：必须把它从 gone 里请出来。
           这里写成 (S.gone = S.gone || {}) 而不是 (S.gone || {})——
           后者在 gone 还不存在时删的是一个临时对象，等于没删；
           在旧版里那只是白删一次，在 T6 之后那是一件永久消失。 */
        delete (S.gone = S.gone || {})[u.e];
        S.stat.undone = (S.stat.undone | 0) + 1;
        invalidateEssence();
        B.log(T('撤销：把「#」装回原位').replace('#', metaOf(u.e).nm), 'undo');
        B.emit('body');
        return { ok: true, k: u.k };
      }
      return { ok: false, why: T('原位已经被占了，撤销不了这一步') };
    }
    if (u.k === 'move') {
      var r = _move(u.i + u.dx, u.j + u.dy, -u.dx, -u.dy);
      if (!r.ok) { S.undo.push(u); return r; }
      S.stat.undone = (S.stat.undone | 0) + 1;
      B.log(T('撤销：把「#」挪回原位').replace('#', metaOf(u.e).nm), 'undo');
      B.emit('body');
      return { ok: true, k: u.k };
    }
    if (u.k === 'spin') {
      var ins2 = Bd.instances(b)[Bd.instKeyOf(b, Bd.key(u.i, u.j))];
      if (ins2) {
        var rot = P.rotCells(cellsOf(ins2.e), u.r);
        var backup = {}, z, k;
        for (z = 0; z < ins2.cells.length; z++) { backup[ins2.cells[z]] = b.cells[ins2.cells[z]]; delete b.cells[ins2.cells[z]]; }
        Bd.place(b, ins2.ox, ins2.oy, ins2.e, u.r, rot, ins2.seq);
        S.stat.undone = (S.stat.undone | 0) + 1;
        invalidateEssence();
        B.log(T('撤销：转回 #°').replace('#', ((u.r | 0) % 4) * 90), 'undo');
        B.emit('body');
        return { ok: true, k: u.k };
      }
    }
    return { ok: false, why: T('这一步撤销不了') };
  }

  /* ---------- 装 ---------- */
  function canAt(i, j, e, r) { return Bd.canPlace(body(), P.rotCells(cellsOf(e), r), i, j); }
  function connectedEdges(i, j, e, r) {
    var cs = P.rotCells(cellsOf(e), r), b = body(), z, q, cnt = 0;
    var D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (z = 0; z < cs.length; z++) {
      var x = i + cs[z][0], y = j + cs[z][1];
      for (q = 0; q < 4; q++) if (Bd.at(b, x + D4[q][0], y + D4[q][1])) cnt++;
    }
    return cnt;
  }
  function place(i, j, e, r, opt) {
    opt = opt || {};
    var b = body(), m = metaOf(e);
    if (!cellsOf(e)) return { ok: false, why: T('没有这一件') };
    if (placedSet()[e]) return { ok: false, why: T('「#」已经在板上了').replace('#', m.nm) };
    if ((S.gone || {})[e]) return { ok: false, why: T('这一件已经不在库里了') };
    if (!canAt(i, j, e, r)) {
      return { ok: false, why: Bd.n(b) ? T('放不下，或者没有一格贴着已经有的格') : T('这里放不下') };
    }
    var nBefore = Bd.n(b);
    var conn = connectedEdges(i, j, e, r);
    var seq = (S.seq | 0) + 1;
    var rot = P.rotCells(cellsOf(e), r);
    if (!Bd.place(b, i, j, e, ((r | 0) % 4 + 4) % 4, rot, seq)) {
      return { ok: false, why: T('装不上去') };
    }
    S.seq = seq;
    S.stat.placed = (S.stat.placed | 0) + 1;
    invalidateEssence();
    pushUndo({ k: 'place', e: e, i: i + rot[0][0], j: j + rot[0][1], r: ((r | 0) % 4 + 4) % 4 });
    B.log((opt.auto ? T('自动装：') : T('装：')) +
      T('#（#·# 格）到 #').replace('#', m.nm)
        .replace('#', BS.i18n.full(P.RARITY[m.rar])).replace('#', cellsOf(e).length).replace('#', i + ',' + j) +
      (r ? T('，转 #°').replace('#', (((r | 0) % 4 + 4) % 4) * 90) : ''), 'add');
    B.emit('body');
    return { ok: true, seq: seq, conn: conn, added: Bd.n(b) - nBefore };
  }

  /* 拆一格就是拆一整件。
     T6：**拆下来的元件不回库**，进 S.gone，永久离场。
     它仍然进撤销栈——那一步是它唯一能回来的路，所以返回值里带了
     guarded：这一步到底有没有真的留在栈里。栈满了被挤出去的那些，
     就是真的没了，界面必须把这话说出来，不能让看的人以为还有 Ctrl+Z。 */
  function removeAt(i, j) {
    var b = body(), c = Bd.at(b, i, j);
    if (!c) return { ok: false, why: T('这一格是空的') };
    var m = metaOf(c.e);
    var e = c.e, r = c.r | 0;
    var ins = Bd.instances(b)[Bd.instKeyOf(b, Bd.key(i, j))];
    var ox = ins ? ins.ox : i, oy = ins ? ins.oy : j;
    var cells = ins ? ins.cells.length : 0;
    Bd.removeInst(b, Bd.key(i, j));
    drop(e);                                  /* 永久离场：写进 S.gone，不再回到库里 */
    S.seq = (S.seq | 0) + 1;
    S.stat.removed = (S.stat.removed | 0) + 1;
    invalidateEssence();
    var rec = { k: 'remove', e: e, i: ox, j: oy, r: r };
    pushUndo(rec);
    var guarded = !!(S.undo && S.undo[S.undo.length - 1] === rec);
    B.log(T('拆：# 整件（# 格）从 #，它回不来了')
      .replace('#', m.nm).replace('#', cells).replace('#', i + ',' + j), 'rm');
    B.emit('body');
    return { ok: true, n: cells, e: e, nm: m.nm, rar: m.rar | 0, cells: cells, guarded: guarded };
  }
  /* 拆之前的损失预告：这一件是什么、多少格、哪一档、拆了之后还在不在撤销栈里。
     界面拿它去问一句「确定吗」，问的必须是有内容的那一句——
     只写「确定吗」等于没问，看的人照样会点掉。 */
  function peekRemove(i, j) {
    var c = Bd.at(body(), i, j);
    if (!c) return null;
    var m = metaOf(c.e);
    var ins = Bd.instances(body())[Bd.instKeyOf(body(), Bd.key(i, j))];
    return { e: c.e, nm: m.nm, rar: m.rar | 0, cells: ins ? ins.cells.length : 0, canUndo: canUndo() };
  }

  /* 平移一整件：先把它整件抬起来，再试着落到新地方。
     抬起来之后才判「放得下」，所以判的是**除它之外**的那具图形——
     挪完至少还得有一格贴着，除非它是场上唯一的一件。 */
  function _move(i, j, dx, dy) {
    var b = body(), c = Bd.at(b, i, j);
    if (!c) return { ok: false, why: T('这一格是空的') };
    var ins = Bd.instances(b)[Bd.instKeyOf(b, Bd.key(i, j))];
    if (!ins) return { ok: false, why: T('找不到这一件') };
    var rot = P.rotCells(cellsOf(ins.e), c.r | 0);
    var backup = {}, z, k;
    for (z = 0; z < ins.cells.length; z++) { backup[ins.cells[z]] = b.cells[ins.cells[z]]; delete b.cells[ins.cells[z]]; }
    if (!Bd.canPlace(b, rot, ins.ox + dx, ins.oy + dy)) {
      for (k in backup) b.cells[k] = backup[k];
      return { ok: false, why: T('挪不过去：有格会压到别的东西上，或者挪完一格都贴不到') };
    }
    Bd.place(b, ins.ox + dx, ins.oy + dy, ins.e, c.r | 0, rot, ins.seq);
    S.seq = (S.seq | 0) + 1;
    S.stat.moved = (S.stat.moved | 0) + 1;
    invalidateEssence();
    B.emit('body');
    return { ok: true, ox: ins.ox + dx, oy: ins.oy + dy, e: ins.e };
  }
  function move(i, j, dx, dy) {
    var c = Bd.at(body(), i, j);
    if (!c) return { ok: false, why: T('这一格是空的') };
    var r = _move(i, j, dx, dy);
    if (!r.ok) return r;
    var m = metaOf(c.e);
    pushUndo({ k: 'move', e: c.e, i: i, j: j, dx: dx, dy: dy });
    B.log(T('挪：「#」往 # 挪了一格').replace('#', m.nm)
      .replace('#', dx > 0 ? T('右') : (dx < 0 ? T('左') : (dy > 0 ? T('上') : T('下')))), 'move');
    return r;
  }

  /* 原地转 90°：dir 是 +1 顺时针 / -1 逆时针。 */
  function spin(i, j, dir) {
    var b = body(), c = Bd.at(b, i, j);
    if (!c) return { ok: false, why: T('这一格是空的') };
    var ins = Bd.instances(b)[Bd.instKeyOf(b, Bd.key(i, j))];
    if (!ins) return { ok: false, why: T('找不到这一件') };
    var oldR = (c.r | 0);
    var nr = (oldR + (dir < 0 ? 3 : 1)) % 4;
    var rot = P.rotCells(cellsOf(c.e), nr);
    var backup = {}, z, k;
    for (z = 0; z < ins.cells.length; z++) { backup[ins.cells[z]] = b.cells[ins.cells[z]]; delete b.cells[ins.cells[z]]; }
    if (!Bd.canPlace(b, rot, ins.ox, ins.oy)) {
      for (k in backup) b.cells[k] = backup[k];
      return { ok: false, why: T('转过之后放不下：有格会压到别的东西上，或者与原结构脱开') };
    }
    Bd.place(b, ins.ox, ins.oy, ins.e, nr, rot, ins.seq);
    S.seq = (S.seq | 0) + 1;
    S.stat.spun = (S.stat.spun | 0) + 1;
    invalidateEssence();
    pushUndo({ k: 'spin', e: ins.e, i: i, j: j, r: oldR });
    B.log(T('转：# 到 #°').replace('#', metaOf(ins.e).nm).replace('#', nr * 90), 'spin');
    B.emit('body');
    return { ok: true, r: nr };
  }

  /* 手上拿着的那一件 */
  var sel = { e: null, r: 0 };

  BS.rig = {
    PERIOD: PERIOD, START: START, GRACE: GRACE, sel: sel, UNDO_BASE: UNDO_BASE,
    body: body, stats: stats, statsRaw: statsRaw, marks: marks,
    metaOf: metaOf, cellsOf: cellsOf, glyphsOf: glyphsOf, rotPairOf: rotPairOf, glyphOf: glyphOf,
    forget: forget, insts: insts,
    natural: natural, nextIn: nextIn, lib: lib, libCount: libCount, page: page, pick: pick, countBy: countBy,
    placedSet: placedSet, canAt: canAt, connectedEdges: connectedEdges,
    place: place, removeAt: removeAt, peekRemove: peekRemove, move: move, spin: spin,
    drop: drop, discard: discard, recycle: recycle,
    canSell: canSell, sell: sell, capture: capture,
    undo: undo, canUndo: canUndo, undoDepth: undoDepth, undoCap: undoCap, pushUndo: pushUndo,
    clock: clock, tickClock: tickClock, curPeriod: curPeriod, invalidateEssence: invalidateEssence
  };
})(window.BS);
