/* world/mods/garden.js —— 图形花园。
   ------------------------------------------------------------------
   组装台的玩法，目的换掉：不呈交、不卖钱——**种下去为战斗做准备**。
   从库里「拿在手上」，按空格种进土里；相连的格构成一具根 graphic，
   **每一件**按自己的六项读数给战斗面的加成（辉光/尘晶掉落、伤害/
   攻速/射程/暴击）。Del 挖走，元件回库。
   面板上六类加成各占一行——旧版压成两行文字，正好把「五类恒为 0」
   这件事藏住了；摆开之后空的那几行自己会说话。
   园子会随种植量一圈圈向外长——起始 16×12，每满 16 格长宽各 +2，
   只扩不缩。悬停画 ghost + 收益试算，绝不整页重渲染（工坊那两次翻车的对策）。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, G = BS.garden, Bd = BS.body, store = BS.store;

  var host = null, dirty = false, offs = [];
  var hand = -1, handRot = 0;
  var hover = null, sel = null;
  var msg = '';
  var ghostMarks = [];

  function mark() { dirty = true; }
  function q(s) { return host ? host.querySelector(s) : null; }

  /* 放手：手上那件回库。它不是这一页的私有状态，是借出来的一枚资源——
     「拿在手上」那一下已经 takeOne 出库了，所以这一页走了而没放手，那枚就没了
     （工坊页报过同一个 bug，两页同源）。进页与离页各调一次。 */
  function dropHand() {
    if (hand >= 0) { store.give(hand); hand = -1; handRot = 0; }
  }

  function invIds() {
    var a = store.inv(), seen = {}, out = [], k;
    for (k = 0; k < a.length; k++) { if (!seen[a[k]]) { seen[a[k]] = 1; out.push(a[k]); } }
    return out;
  }

  function miniGrid(part, px) {
    var sz = P.size(part.cells), out = '', x, y, set = {}, i;
    for (i = 0; i < part.cells.length; i++) set[part.cells[i][0] + ',' + part.cells[i][1]] = 1;
    for (y = 0; y < sz.h; y++) {
      for (x = 0; x < sz.w; x++) out += '<i class="' + (set[x + ',' + y] ? 'on' : '') + '"></i>';
    }
    return '<span class="mg' + (px ? ' big' : '') + '" style="--w:' + sz.w + '">' + out + '</span>';
  }

  /* 一件自己的读数。**按件计量之后，玩家要能看见「这一件给什么」**——
     旧版只报整园那一具根的峰值，单件的读数根本不露脸，
     于是「种什么」不是决策，只是往板子上堆。
     走的是花园计分用的同一条路（转过的格位 → 测量），
     所以面板上看到的读数就是种下去之后会兑现的那一份。 */
  function pieceRead(part, rot) {
    return BS.tower.read({
      cells: P.norm(P.rotCells(part.cells, rot | 0)),
      form: part.form, traits: part.traits, rar: part.rar, i: null
    });
  }
  function peakLine(st) {
    return '<p class="note dim">' + U.esc(I.fill(T('这一件的主项：#（#）'),
      kindName(st.esPeak || 'sym'), (st.esPeakV || 0).toFixed(2))) + '</p>';
  }

  /* ---------- 手上 ---------- */
  function handPanel() {
    if (hand < 0) {
      return '<div class="cinf"><p class="note dim">' + U.esc(T('手上是空的。从下面的库里拿一枚。')) + '</p></div>';
    }
    var part = BS.shop.partOf(hand);
    var f = P.formOf(part.form), rr = P.RARITY[part.rar];
    var pr = P.rotCells(part.cells, handRot), sz = P.size(pr);
    var rd = pieceRead(part, handRot);
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(P.serialOf(hand)) + '</b>' +
      '<em class="rv r' + part.rar + '">' + U.esc(I.term(rr, 'full')) + '</em>' +
      '<span class="fam" title="' + U.esc(T(f.d)) + '">' + f.sym + ' ' + U.esc(I.term(f)) + '</span></div>' +
      '<div class="handfig">' + miniGrid({ cells: pr }, 12) + '</div>' +
      '<div class="statline">' + H.kv('外接', sz.w + '×' + sz.h) +
      H.kv('格数', U.n0(part.cells.length)) + H.kv('转向', (handRot * 90) + '°') + '</div>' +
      H.esGrid(rd.es) + peakLine(rd.st) +
      '<div class="ff">' + H.btnR('rot', T('转 90°（R）'), 'on small') +
      H.btnR('handnone', T('放回'), 'ghost small') + '</div>' +
      '<p class="note dim">' + U.esc(T('把光标移到花园上，按空格种下——外接框左上角落在光标那一格。')) + '</p>' +
      '</div>';
  }

  /* ---------- 选中的格 ---------- */
  function cellInfo() {
    if (!sel) return '<div class="cinf"><p class="note dim">' +
      U.esc(T('点花园任意一格，看那一格的数据。放置只认空格。')) + '</p></div>';
    var a = sel.split(','), i = +a[0], j = +a[1];
    var c = Bd.at(G.board(), i, j);
    if (!c) return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(i + ' , ' + j) + '</b>' +
      '<em class="rv">' + U.esc(T('空土')) + '</em></div>' +
      '<p class="note dim">' + U.esc(T('把光标对准它，按空格就种在这里。')) + '</p></div>';
    var p = BS.shop.partOf(c.e.slice(1) | 0);
    var rd = pieceRead(p, c.r | 0);
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(P.serialOf(p.i)) + '</b>' +
      '<em class="rv r' + p.rar + '">' + U.esc(I.term(P.RARITY[p.rar], 'full')) + '</em>' +
      '<span class="fam">' + P.formOf(p.form).sym + ' ' + U.esc(I.term(P.formOf(p.form))) + '</span></div>' +
      '<div class="statline">' + H.kv('坐标', i + ' , ' + j) +
      H.kv('转向', ((c.r | 0) * 90) + '°') + '</div>' +
      H.esGrid(rd.es) + peakLine(rd.st) +
      '<div class="ff">' + H.btnR('rm:' + i + ',' + j, T('挖走（Del）'), 'danger small') + '</div>' +
      '<p class="note dim">' + U.esc(T('挖走后元件回库。')) + '</p>' +
      '</div>';
  }

  /* ---------- 收益面板：每一件的加成与全局总量 ---------- */
  function KINDS() { return G.KINDS; }
  function kindName(k) {
    var row = G.KIND_BY[k];
    return row ? I.term(row) : k;
  }
  /* 条多长：**按这一屏里最大的那一项**归一，不是按一个固定刻度。
     为什么：固定刻度下前期六根条全是一小截（看着像没长），后期又全顶格
     （看着像都满了）——两头都读不出形状。条要回答的问题是
     「六项里哪一项还没长起来」，那是一个相对问题，数字在右边给绝对的。
     射程与百分比不是同一个量纲，所以先各自归一（射程按 2 格、百分比按 60%）
     再比大小，否则射程永远最短、永远看着像荒着。 */
  function kindNorm(kd, v) { return Math.max(0, v) / (kd.v === 'rangeAdd' ? 2 : 60); }
  function kindBar(p) {
    p = Math.max(0, Math.min(1, p));
    return '<span class="pkb"><i style="width:' + (p * 100).toFixed(1) + '%"></i></span>';
  }
  function yieldPanel() {
    var fs = G.figs(), m = G.mods(), i;
    var mx = 0;
    for (i = 0; i < KINDS().length; i++) {
      var nv = kindNorm(KINDS()[i], m[KINDS()[i].v] || 0);
      if (nv > mx) mx = nv;
    }
    mx = Math.max(mx * 1.15, 0.02);      /* 空园也别除零 */
    var out = '<div class="pv">' +
      '<div class="pvhead"><b>' + U.esc(T('花园加成')) + '</b>' +
      H.kvR(T('件'), U.n0(m.parts)) +
      H.kvR(T('根'), U.n0(m.roots)) +
      H.kvR(T('园子'), I.fill('# 圈 · # 格', m.lv, U.n0(m.cells))) +
      H.kvR(T('苗床'), I.fill('# / # 格', U.n0(m.nurse), G.NURSE_CELLS)) + '</div>';
    /* 六项各占一行：旧版把它们压成两行文字，而「六类里五类恒为 0」
       这件事正是靠这两行文字藏住的——摆成六行，空的那几行自己会说话。 */
    out += '<div class="pvkinds">';
    for (i = 0; i < KINDS().length; i++) {
      var kd = KINDS()[i], v = m[kd.v] || 0;
      var isR = kd.v === 'rangeAdd';
      out += '<div class="pkrow' + (v <= 0.001 ? ' zero' : '') + '">' +
        '<em>' + U.esc(I.term(kd)) + '</em>' + kindBar(kindNorm(kd, v) / mx) +
        '<b>+' + v.toFixed(isR ? 2 : 1) + (isR ? '' : '%') + '</b></div>';
    }
    out += '</div>';
    /* 每一具根：几格几件、质变多高、主项是哪一个 */
    if (fs.length) {
      out += '<div class="pves">';
      for (i = 0; i < fs.length; i++) {
        var f = fs[i];
        /* 这里只报「几格几件、整具质变多高」。
           曾经还报过一个「主项」，但那是**整具根的峰值**——按件计量之后
           它不再决定任何一类加成，摆在这儿会让玩家以为「这根主攻辉光」。
           一件自己的主项归它自己报（见手上面板与选中格）。 */
        out += '<div class="crow"><b>' + U.esc(I.fill('# 格 · # 件',
          U.n0(f.fig.cells.length), (f.fig.parts ? f.fig.parts.length : 0))) + '</b>' +
          '<span>' + U.esc(I.fill(T('质变 #'), f.esScore.toFixed(2))) + '</span></div>';
      }
      out += '</div>';
    }
    if (m.orphans > 0) {
      out += '<div class="pvstat warn">' + U.esc(I.fill(T('有 # 件离了根，出力折半——贴着根种才拿得到全份。'), m.orphans)) + '</div>';
    }
    out += '<p class="note dim">' + U.esc(I.fill(T('苗床：最早种下的 # 格，它们的出力额外再给一半——挖走早年的件，后面的件会顶进苗床。'), G.NURSE_CELLS)) + '</p>';
    out += '<p class="note dim">' + U.esc(T('每一格的边际贡献递减（小于 1 的幂次）——再种一具大的，与把这一具修得更对称，是两个不同的选择。')) + '</p>';
    out += '</div>';
    return out;
  }

  /* ---------- 花园板 ---------- */
  function boardHTML() {
    var b = G.board(), out = '', x, y, C = G.cols(), R = G.rows();
    var or = G.orphans();      /* 离根的件画个记号——折半是看得见的代价 */
    for (y = 0; y < R; y++) {
      for (x = 0; x < C; x++) {
        var k = Bd.key(x, y), cls = 'cell', inner = '';
        var c = b.cells[k];
        if (c) {
          var p = BS.shop.partOf(c.e.slice(1) | 0);
          cls += ' g' + p.rar;
          if (or[Bd.ik(c.e, c.ox, c.oy)]) cls += ' orph';
          inner = '<u>' + U.esc(P.serialOf(p.i).slice(1)) + '</u>';
        }
        if (sel === k) cls += ' selc';
        out += '<div class="' + cls + '" data-c="' + x + ',' + y + '">' + inner + '</div>';
      }
    }
    /* --cols 跟着 cols() 走——园子扩一圈，网格必须当场变宽。 */
    return '<div class="sheetwrap"><div class="wgrid garden" style="--cols:' + C + '">' + out + '</div>' +
      /* 空园子同样给一句待命：这里的第一件决定苗床从哪儿开始，
         「贴着已有的件种出力全份」是这一页唯一的放置规矩。 */
      (Bd.n(b) ? '' : '<div class="stagehint"><b>' + U.esc(T('园子空着')) + '</b>' +
        U.esc(T('从下面取一件，种在第一格上——贴着已有的件种，出力才是全份。')) + '</div>') +
      '</div>';
  }

  /* ---------- ghost + 收益试算：只碰 class 与固定盒子 ---------- */
  function clearGhost() {
    while (ghostMarks.length) {
      var c = ghostMarks.pop();
      if (c.__base != null) c.className = c.__base;
    }
    var box = document.getElementById('gprevbox');
    if (box) box.innerHTML = '';
  }
  function ghostAt(x, y) {
    clearGhost();
    if (hand < 0) return;
    var cs = P.rotCells(BS.shop.partOf(hand).cells, handRot);
    var ok = G.canPlant(hand, [x, y], handRot) === '';
    var z;
    for (z = 0; z < cs.length; z++) {
      var cell = host ? host.querySelector('[data-c="' + (x + cs[z][0]) + ',' + (y + cs[z][1]) + '"]') : null;
      if (cell) {
        cell.__base = cell.className;
        cell.className += ok ? ' gok' : ' gno';
        ghostMarks.push(cell);
      }
    }
    paintPrev(ok);
  }
  function paintPrev(ok) {
    var box = document.getElementById('gprevbox');
    if (!box || hand < 0) { if (box) box.innerHTML = ''; return; }
    if (!ok) {
      box.innerHTML = '<b>' + U.esc(T('试算')) + '</b><span class="no">' + U.esc(T('这里种不下')) + '</span>';
      return;
    }
    /* 试算：往克隆花园板上放一件，看全局收益的前后差 */
    var b = G.board(), clone = { cells: {} }, k;
    for (k in b.cells) clone.cells[k] = b.cells[k];
    var cs = P.rotCells(BS.shop.partOf(hand).cells, handRot);
    Bd.place(clone, hover[0], hover[1], 'p' + hand, handRot, cs, (b.seq | 0) + 1);
    var before = G.mods();
    var save = BS.bus.state.garden;
    BS.bus.state.garden = { cells: clone.cells, seq: (b.seq | 0) + 1 };
    var after = G.mods();
    BS.bus.state.garden = save;
    box.innerHTML = '<b>' + U.esc(T('试算')) + '</b>' +
      '<span class="pd">' + U.esc(I.fill(T('伤害 #% → #%'), before.dmgPct.toFixed(1), after.dmgPct.toFixed(1))) + '</span>' +
      '<span class="pe">' + U.esc(I.fill(T('辉光掉落 #% → #%'), before.luxPct.toFixed(1), after.luxPct.toFixed(1))) + '</span>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!host) return;
    ghostMarks = [];
    var m = G.mods();
    var out = H.head('图形花园', 'GARDEN',
      '种下去为战斗做准备：每一件按自己的六项读数给战斗掉落与增益加成。');
    out += '<div class="msg">' + U.esc(msg) + '</div>';
    /* 园子尺寸摆在最显眼处：它是这一页最实在的产能指标，
       而「种满一圈就扩一圈」是玩家看得见的成长。
       苗床也摆在这里——它是前期唯一一个会自己往下走的数，
       玩家挖一件就能看见它往回涨，这是「重种值不值」的答案。 */
    out += '<div class="statline">' +
      H.kv('园子', G.cols() + ' × ' + G.rows()) +
      H.kv('扩圈', G.level()) +
      H.kv('格数', U.n0(G.n())) +
      H.kv('件', U.n0(m.parts)) +
      H.kv('苗床', I.fill('# / #', U.n0(m.nurse), G.NURSE_CELLS)) +
      H.kv('再种', I.fill('# 格扩一圈', Math.max(0, G.PER_LEVEL - (G.n() % G.PER_LEVEL)))) +
      '</div>';
    out += yieldPanel();
    out += '<div class="asm">' +
      '<div class="asml">' +
      boardHTML() +
      '<div class="pvbox" id="gprevbox"></div>' +
      '<div class="ff">' +
      (hand >= 0 ? H.btnR('rot', T('转 90°（R）'), 'ghost small') : '') +
      (hand >= 0 ? H.btnR('handnone', T('放回'), 'ghost small') : '') +
      '<span class="dim">' + U.esc(T('空格＝种下 · R＝转手上那件 · 点一格＝看那一格')) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="asmr">' +
      '<h3 class="sub">' + U.esc(T('手上')) + '</h3>' + handPanel() +
      '<h3 class="sub">' + U.esc(T('库')) + ' <span class="pl">' + U.n0(store.count()) + '</span></h3>';
    var ids = invIds(), i;
    if (!ids.length) {
      out += '<p class="note dim">' + U.esc(T('库里是空的。')) + '</p>';
    } else {
      out += '<div class="lrs">';
      for (i = 0; i < ids.length; i++) {
        var idx = ids[i], part = BS.shop.partOf(idx);
        out += '<div class="lrrow r' + part.rar + '">' +
          '<span class="lrf">' + miniGrid(part, 8) + '</span>' +
          '<span class="lrt"><b>' + U.esc(P.serialOf(idx)) + '</b>' +
          '<em class="rv">' + U.esc(I.term(P.RARITY[part.rar], 'full')) + '</em></span>' +
          '<span class="lra">' + H.btnR('take:' + idx, hand === idx ? T('放回') : T('拿在手上'), hand === idx ? 'ghost' : 'on small') + '</span>' +
          '</div>';
      }
      out += '</div>';
    }
    out += '<h3 class="sub">' + U.esc(T('选中的格')) + '</h3>' + cellInfo() +
      '</div></div>';
    host.innerHTML = out;
    bind();
    bindGhost();
    if (hover) ghostAt(hover[0], hover[1]);
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('take:') === 0) {
        var id = +a.slice(5);
        if (hand === id) { store.give(id); hand = -1; msg = T('放回了。'); }
        else {
          if (!store.has(id)) { msg = T('库里没有这一件'); render(); return; }
          if (hand >= 0) store.give(hand);
          store.takeOne(id);
          hand = id; handRot = 0; msg = T('拿起了「#」。').replace('#', P.serialOf(id));
        }
        render(); return;
      }
      if (a === 'handnone') { if (hand >= 0) store.give(hand); hand = -1; msg = ''; render(); return; }
      if (a === 'rot') { handRot = (handRot + 1) % 4; msg = T('转了 #°。').replace('#', handRot * 90); render(); return; }
      if (a.indexOf('rm:') === 0) {
        var p = a.slice(3).split(',').map(Number);
        var o = G.dig(p);
        msg = o.ok ? T('挖走了。元件回库。') : o.why;
        if (o.ok) store.give(o.serial);
        sel = null; render(); return;
      }
    });
    var cells = host.querySelectorAll('[data-c]'), i;
    for (i = 0; i < cells.length; i++) {
      cells[i].addEventListener('click', function () {
        sel = this.getAttribute('data-c');
        msg = '';
        render();
      });
    }
  }

  function bindGhost() {
    var grid = q('.wgrid');
    if (!grid) return;
    grid.addEventListener('mousemove', function (ev) {
      var t = ev.target;
      while (t && t !== grid && !t.getAttribute('data-c')) t = t.parentNode;
      if (!t || t === grid) { hover = null; clearGhost(); return; }
      var p = t.getAttribute('data-c').split(',').map(Number);
      if (hover && hover[0] === p[0] && hover[1] === p[1]) return;
      hover = p;
      ghostAt(p[0], p[1]);
    });
    grid.addEventListener('mouseleave', function () { hover = null; clearGhost(); });
  }

  function onKey(e) {
    if (!host) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (hand < 0) { msg = T('手上是空的。从下面的库里拿一枚。'); render(); return; }
      if (!hover) { msg = T('先把光标移到花园上，再按空格——落点就是光标那一格。'); render(); return; }
      var o = G.plant(hand, hover, handRot);
      msg = o.ok ? T('种下了。') : o.why;
      if (o.ok) { sel = null; }
      render();
    } else if (e.key === 'r' || e.key === 'R') {
      if (hand < 0) return;
      handRot = (handRot + 1) % 4;
      msg = T('转了 #°。').replace('#', handRot * 90);
      render();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!sel) return;
      var p = sel.split(',').map(Number);
      var o2 = G.dig(p);
      msg = o2.ok ? T('挖走了。元件回库。') : o2.why;
      if (o2.ok) store.give(o2.serial);
      sel = null;
      render();
    }
  }

  BS.reg.add({
    id: 'garden', n: '4', t: '花园', sub: 'GARDEN',
    mount: function (h) {
      dropHand();   /* 进页前先把上一次借出去的还掉（对照 unmount） */
      host = h; dirty = false; handRot = 0; hover = null; sel = null; msg = '';
      ghostMarks = [];
      offs.push(B.on('garden', function () { mark(); }));
      offs.push(B.on('inv', function () { mark(); }));
      offs.push(B.on('gain', function () { mark(); }));
      offs.push(B.on('restore', function () { render(); }));
      if (typeof document !== 'undefined') document.addEventListener('keydown', onKey);
      render();
    },
    tick: function () { if (host && dirty) { dirty = false; render(); } },
    unmount: function () {
      dropHand();   /* 离页放手：手上那件回库，绝不带走 */
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      if (typeof document !== 'undefined') document.removeEventListener('keydown', onKey);
      host = null;
    }
  });
})(window.BS);
