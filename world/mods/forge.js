/* world/mods/forge.js —— 图形工坊。
   ------------------------------------------------------------------
   界面与手势照搬 CONFIGURA 的组装台与库（用户决策），规模精简：
     · 左边图纸、右边三段——手上 / 库 / 选中的格，与组装台同构。
     · 库沿用库页的模式：稀有度 / 型 / 特质三道筛选一开始就能用，
       行尾一枚「拿在手上」。
     · 放置只认空格：光标在哪一格，按空格把手上的件落在那里；
       点击只认查看：点哪一格就看哪一格的数据，绝不改动图面。
     · 悬停画 ghost、试算放下去会怎样（质变度与成本的前后对比）——
       ghost 只改那一格的 class、试算只写一个固定盒子，
       **绝不整页重渲染**。上一版在 mouseenter 里 render()，
       真实浏览器里光标每动一下就换一轮节点，click 落在公共祖先上，
       元件永远放不下去——这就是「无法部署」的全部原因。

   提交进化：整具图形塌缩成一座只占一格的炮塔，进驻军械库。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, SH = BS.shop, Bd = BS.body, store = BS.store;

  var host = null, dirty = false, offs = [];
  var hand = -1, handRot = 0;          /* 手上那件：序号 + 朝向 */
  var hover = null, sel = null;        /* 光标格 / 选中的格 */
  var msg = '';
  var from = 0, PER = 12;
  var rar = -1, form = '', trait = ''; /* 库的三道筛选（库页的模式） */
  var ghostMarks = [];                 /* 已被 ghost 染色的节点——退场时还原 */

  function mark() { dirty = true; }
  function q(s) { return host ? host.querySelector(s) : null; }

  /* 放手：手上那件回库。
     **它不是这一页的私有状态，是借出来的一枚资源**——「拿在手上」那一下
     已经从库里 takeOne 出去了，所以只要这一页走了而没放手，那枚就没了。
     进页与离页各调一次（见 mount / unmount 的注释）。 */
  function dropHand() {
    if (hand >= 0) { store.give(hand); hand = -1; handRot = 0; }
  }

  /* ---------- 库：读的是**库存**（抽来的），不是目录 ----------
     三道筛选沿用库页的模式；行尾「拿在手上」——拿走一枚，库存少一枚。
     库是抽卡来的有限资源：抽卡去「库」页，这里只管用。 */
  function invIds() {
    var a = BS.store.inv(), seen = {}, out = [], k;
    for (k = 0; k < a.length; k++) {
      if (!seen[a[k]]) { seen[a[k]] = 1; out.push(a[k]); }
    }
    return out;
  }

  function filtered() {
    var ids = invIds(), out = [], i;
    for (i = 0; i < ids.length; i++) {
      var part = SH.partOf(ids[i]);
      if (rar >= 0 && part.rar !== rar) continue;
      if (form && part.form !== form) continue;
      if (trait && part.traits.indexOf(trait) < 0) continue;
      out.push(ids[i]);
    }
    return out;
  }

  function libRows() {
    var ids = filtered(), out = '', i;
    if (from >= ids.length) from = 0;
    if (!ids.length) {
      return '<p class="note dim">' + U.esc(T('库里没有符合条件的件。去「库」页抽几发。')) + '</p>';
    }
    for (i = from; i < ids.length && i < from + PER; i++) {
      var idx = ids[i], part = SH.partOf(idx);
      var f = P.formOf(part.form), rr = P.RARITY[part.rar];
      var trs = part.traits.map(function (t) {
        var tt = P.TRAIT_BY[t];
        return '<span class="tr" title="' + U.esc(T(tt.d)) + '">' + U.esc(tt.sym) + '</span>';
      }).join('');
      out += '<div class="lrrow r' + part.rar + '">' +
        '<span class="lrf">' + miniGrid(part, 8) + '</span>' +
        '<span class="lrt"><b>' + U.esc(P.serialOf(idx)) + '</b>' +
        '<span class="fam">' + f.sym + ' ' + U.esc(I.term(f)) + '</span>' +
        '<em class="rv">' + U.esc(I.term(rr, 'full')) + '</em>' +
        '<em>' + U.n0(part.cells.length) + ' ' + U.esc(T('格')) + trs + '</em></span>' +
        '<span class="lra">' + H.btnR('take:' + idx, hand === idx ? T('放回') : T('拿在手上'), hand === idx ? 'ghost' : 'on small') + '</span>' +
        '</div>';
    }
    out += '<div class="pager">' +
      H.btnR('pg:prev', '←', 'ghost', from === 0) +
      '<span class="pgi">' + (ids.length ? from + 1 : 0) + '–' + Math.min(from + PER, ids.length) + ' / ' + ids.length + '</span>' +
      H.btnR('pg:next', '→', 'ghost', from + PER >= ids.length) +
      '</div>';
    return '<div class="lrs">' + out + '</div>';
  }

  function filters() {
    var i, out = '';
    out += '<div class="ff"><span class="fl">' + U.esc(T('稀有度')) + '</span>' +
      H.btnR('rar:-1', T('全部'), rar < 0 ? 'on' : 'chip');
    for (i = 0; i < P.RARITY.length; i++) {
      out += H.btnR('rar:' + i, I.term(P.RARITY[i], 't'), rar === i ? 'on' : 'chip');
    }
    out += '</div>';
    out += '<div class="ff"><span class="fl">' + U.esc(T('型')) + '</span>' +
      H.btnR('fm:', T('全部'), form === '' ? 'on' : 'chip');
    for (i = 0; i < P.FORMS.length; i++) {
      out += H.btnR('fm:' + P.FORMS[i].id, P.FORMS[i].sym + ' ' + I.term(P.FORMS[i]),
        form === P.FORMS[i].id ? 'on' : 'chip', false, P.FORMS[i].d);
    }
    out += '</div>';
    out += '<div class="ff"><span class="fl">' + U.esc(T('特质')) + '</span>' +
      H.btnR('tr:', T('全部'), trait === '' ? 'on' : 'chip');
    for (i = 0; i < P.TRAITS.length; i++) {
      out += H.btnR('tr:' + P.TRAITS[i].id, P.TRAITS[i].sym + ' ' + U.esc(I.term(P.TRAITS[i])),
        trait === P.TRAITS[i].id ? 'on' : 'chip', false, P.TRAITS[i].d);
    }
    out += '</div>';
    return out;
  }

  /* ---------- 手上 ---------- */
  function miniGrid(part, px) {
    var sz = P.size(part.cells), out = '', x, y, set = {}, i;
    for (i = 0; i < part.cells.length; i++) set[part.cells[i][0] + ',' + part.cells[i][1]] = 1;
    for (y = 0; y < sz.h; y++) {
      for (x = 0; x < sz.w; x++) out += '<i class="' + (set[x + ',' + y] ? 'on' : '') + '"></i>';
    }
    return '<span class="mg' + (px ? ' big' : '') + '" style="--w:' + sz.w + '">' + out + '</span>';
  }

  function handPanel() {
    if (hand < 0) {
      return '<div class="cinf"><p class="note dim">' + U.esc(T('手上是空的。从下面的库里拿一件。')) + '</p></div>';
    }
    var part = SH.partOf(hand), a = BS.tower.attrs(part);
    var f = P.formOf(part.form), rr = P.RARITY[part.rar];
    var pr = P.rotCells(part.cells, handRot), sz = P.size(pr);
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(P.serialOf(hand)) + '</b>' +
      '<em class="rv r' + part.rar + '">' + U.esc(I.term(rr, 'full')) + '</em>' +
      '<span class="fam" title="' + U.esc(T(f.d)) + '">' + f.sym + ' ' + U.esc(I.term(f)) + '</span></div>' +
      '<div class="handfig">' + miniGrid({ cells: pr }, 12) + '</div>' +
      '<div class="statline">' + H.kv('外接', sz.w + '×' + sz.h) +
      H.kv('格数', U.n0(part.cells.length)) + H.kv('转向', (handRot * 90) + '°') + '</div>' +
      '<div class="pces">' + H.esGrid(a.es) + '</div>' +
      '<div class="ff">' + H.btnR('rot', T('转 90°（R）'), 'on small') +
      H.btnR('handnone', T('放回'), 'ghost small') + '</div>' +
      '<p class="note dim">' + U.esc(T('把光标移到图纸上，按空格把它放下——外接框左上角就落在光标那一格。')) + '</p>' +
      '</div>';
  }

  /* ---------- 选中的格：看数据，拆整件 ---------- */
  function cellInfo() {
    if (!sel) return '<div class="cinf"><p class="note dim">' +
      U.esc(T('点图纸上任意一格，看那一格的数据。看不会改动图面；放置只认空格。')) + '</p></div>';
    var a = sel.split(','), i = +a[0], j = +a[1];
    var c = Bd.at(SH.board(), i, j);
    if (!c) return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(i + ' , ' + j) + '</b>' +
      '<em class="rv">' + U.esc(T('空格')) + '</em></div>' +
      '<p class="note dim">' + U.esc(T('这里还没有东西。把手上的件对准它，按空格就落在这里。')) + '</p></div>';
    var p = SH.partOf(c.e.slice(1) | 0);
    var ins = Bd.instances(SH.board())[Bd.instKeyOf(SH.board(), Bd.key(i, j))];
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(P.serialOf(p.i)) + '</b>' +
      '<em class="rv r' + p.rar + '">' + U.esc(I.term(P.RARITY[p.rar], 'full')) + '</em>' +
      '<span class="fam">' + P.formOf(p.form).sym + ' ' + U.esc(I.term(P.formOf(p.form))) + '</span></div>' +
      '<div class="statline">' + H.kv('坐标', i + ' , ' + j) +
      H.kv('整件', U.n0(ins ? ins.cells.length : 0) + ' ' + T('格')) +
      H.kv('转向', ((c.r | 0) * 90) + '°') + '</div>' +
      '<div class="ff">' + H.btnR('rm:' + i + ',' + j, T('拆掉整件（Del）'), 'danger small') + '</div>' +
      '<p class="note dim">' + U.esc(T('元件来自序号池：拆了不亏，随时再取。')) + '</p>' +
      '</div>';
  }

  /* ---------- 进化条：这一页的仪表盘（组装台估价条的位分） ---------- */
  function evoBar() {
    var fig = SH.figure();
    if (!fig) {
      return '<div class="pv empty"><b>' + U.esc(T('进化预览')) + '</b>' +
        '<span class="note dim"> ' + U.esc(T('图纸是空的。放上一枚元件，读数就开始长。')) + '</span></div>';
    }
    var r = SH.read(fig);
    var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
    var cost = BS.build.cost(part);
    return '<div class="pv">' +
      '<div class="pvhead"><b>' + U.esc(T('进化预览')) + '</b>' +
      H.kvR(T('格数'), U.n0(fig.cells.length)) +
      H.kvR(T('元件'), U.n0(fig.parts.length)) +
      H.kvR(T('质变度'), r.esScore.toFixed(3)) +
      H.kvR(T('部署成本'), '<b>' + U.n0(cost) + '</b> 辉光') + '</div>' +
      '<div class="pves">' + H.esGrid(r.es) + '</div>' +
      '<div class="ff">' +
      H.btnR('clear', T('清空图纸'), 'ghost small') +
      H.btnR('submit', T('提交进化'), 'go') + '</div>' +
      '</div>';
  }

  /* ---------- 图纸 ---------- */
  function boardHTML() {
    var b = SH.board(), out = '', x, y, C = SH.cols(), R = SH.rows();
    for (y = 0; y < R; y++) {
      for (x = 0; x < C; x++) {
        var k = Bd.key(x, y), cls = 'cell', inner = '';
        var c = b.cells[k];
        if (c) {
          var p = SH.partOf(c.e.slice(1) | 0);
          cls += ' g' + p.rar;
          inner = '<u>' + U.esc(P.serialOf(p.i).slice(1)) + '</u>';
        }
        if (sel === k) cls += ' selc';
        out += '<div class="' + cls + '" data-c="' + x + ',' + y + '">' + inner + '</div>';
      }
    }
    return '<div class="sheetwrap"><div class="wgrid" style="--cols:' + C + '">' + out + '</div>' +
      /* 空图纸也是舞台：中央一句话，不遮网格（pointer-events: none）。
         第一件随便放——这条规矩写在这里，比写在右下角小字里有用。 */
      (SH.n() ? '' : '<div class="stagehint"><b>' + U.esc(T('图纸空着')) + '</b>' +
        U.esc(T('从下面取一件，放在任意一格上——第一件随便放。')) + '</div>') +
      '</div>';
  }

  /* ---------- ghost 与试算：只碰 class 与一个盒子，绝不重渲染 ---------- */
  function clearGhost() {
    while (ghostMarks.length) {
      var c = ghostMarks.pop();
      if (c.__base != null) c.className = c.__base;
    }
    var box = document.getElementById('prevbox');
    if (box) box.innerHTML = '';
  }
  function ghostAt(x, y) {
    clearGhost();
    if (hand < 0) return;
    var cs = P.rotCells(SH.partOf(hand).cells, handRot);
    var ok = SH.canPlace(hand, [x, y], handRot) === '';
    var z;
    for (z = 0; z < cs.length; z++) {
      var cell = host ? host.querySelector('[data-c="' + (x + cs[z][0]) + ',' + (y + cs[z][1]) + '"]') : null;
      if (cell) {
        cell.__base = cell.className;
        cell.className += ok ? ' gok' : ' gno';
        ghostMarks.push(cell);
      }
    }
    paintPrev(x, y, ok);
  }
  function paintPrev(x, y, ok) {
    var box = document.getElementById('prevbox');
    if (!box) return;
    if (hand < 0 || x == null) { box.innerHTML = ''; return; }
    if (!ok) {
      box.innerHTML = '<b>' + U.esc(T('试算')) + '</b><span class="no">' + U.esc(T('这里放不下')) + '</span>';
      return;
    }
    var t = SH.trial(hand, [x, y], handRot);
    var cur = SH.figure();
    var es0 = cur ? SH.read(cur).esScore : 0;
    var cost0 = cur ? BS.build.cost({ cells: cur.cells, form: cur.form, traits: cur.traits, rar: cur.rar, i: null }) : 0;
    box.innerHTML = '<b>' + U.esc(T('试算')) + '</b>' +
      '<span class="pd">' + U.esc(I.fill(T('质变度 # → #'), es0.toFixed(2), t.esScore.toFixed(2))) + '</span>' +
      '<span class="pe">' + U.esc(I.fill(T('部署成本 # → # 辉光'), U.n0(cost0), U.n0(t.cost))) + '</span>';
  }

  /* ---------- 渲染（只在离散动作之后整页重画） ---------- */
  function render() {
    if (!host) return;
    ghostMarks = [];
    var out = H.head('图形工坊', 'WORKSHOP',
      '把元件拼成一具图形——提交之后，它进化为一座只占一格的炮塔，进驻军械库。');
    /* 板子尺寸摆在最显眼处：它是这一页最实在的产能指标，
       而「图纸扩容」升级会让它当场变大——数字动给玩家看。 */
    out += '<div class="statline">' +
      H.kv('图纸', SH.cols() + ' × ' + SH.rows()) +
      H.kv('扩容层级', SH.roomLv()) +
      H.kv('格数', U.n0(SH.cols() * SH.rows())) +
      '</div>';
    out += '<div class="msg">' + U.esc(msg) + '</div>';
    out += evoBar();
    out += '<div class="asm">' +
      '<div class="asml">' +
      boardHTML() +
      '<div class="pvbox" id="prevbox"></div>' +
      '<div class="ff">' +
      (hand >= 0 ? H.btnR('rot', T('转 90°（R）'), 'ghost small') : '') +
      (hand >= 0 ? H.btnR('handnone', T('放回'), 'ghost small') : '') +
      '<span class="dim">' + U.esc(T('空格＝放下 · R＝转手上那件 · 点一格＝看那一格')) + '</span>' +
      '</div>' +
      '</div>' +
      '<div class="asmr">' +
      '<h3 class="sub">' + U.esc(T('手上')) + '</h3>' + handPanel() +
      '<h3 class="sub">' + U.esc(T('库')) + ' <span class="pl">' +
      U.n0(BS.store.count()) + '</span></h3>' + filters() + libRows() +
      '<h3 class="sub">' + U.esc(T('选中的格')) + '</h3>' + cellInfo() +
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
          if (hand >= 0) store.give(hand);   /* 换手：旧的先回库 */
          store.takeOne(id);
          hand = id; handRot = 0; msg = T('拿起了「#」。').replace('#', P.serialOf(id));
        }
        render(); return;
      }
      if (a === 'handnone') { if (hand >= 0) store.give(hand); hand = -1; msg = ''; render(); return; }
      if (a === 'rot') { handRot = (handRot + 1) % 4; msg = T('转了 #°。').replace('#', handRot * 90); render(); return; }
      if (a === 'clear') {
        /* 清空图纸：板上所有元件回库（提交进化才会消耗它们） */
        var bs = SH.board(), k;
        for (k in bs.cells) store.give(bs.cells[k].e.slice(1) | 0);
        SH.clear(); sel = null; hover = null; msg = T('图纸清空了。');
        render(); return;
      }
      if (a === 'submit') {
        var res = SH.submit();
        msg = res.ok ? I.fill(T('# 已进化入库，部署成本 # 辉光'), res.rec.nm, res.rec.cost) : res.why;
        /* 进化塌缩：整具图形收拢成一颗单格炮塔（纯表现，不碰判定）。
           fx 自己会在减少动效 / 冷静模式 / 无 body 时拒绝演出。 */
        if (res.ok && BS.fx) BS.fx.collapse(res.rec);
        sel = null; hover = null;
        render(); return;
      }
      if (a === 'pg:prev') { from = Math.max(0, from - PER); render(); return; }
      if (a === 'pg:next') { from = from + PER; render(); return; }
      if (a.indexOf('rar:') === 0) { rar = +a.slice(4); from = 0; render(); return; }
      if (a.indexOf('fm:') === 0) { form = a.slice(3); from = 0; render(); return; }
      if (a.indexOf('tr:') === 0) { trait = a.slice(3); from = 0; render(); return; }
      if (a.indexOf('rm:') === 0) {
        var p = a.slice(3).split(',').map(Number);
        var o = SH.remove(p);
        msg = o.ok ? T('拆掉了整件。') : o.why;
        if (o.ok) store.give(o.serial);   /* 元件回库：拆了不亏 */
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

  /* ghost 走 mousemove 委托：只改 class，不重渲染——上一次翻车的直接对策 */
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

  /* 键盘：空格放下，R 转手上那件，Del 拆选中的整件 */
  function onKey(e) {
    if (!host) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (hand < 0) { msg = T('手上是空的。从下面的库里拿一件。'); render(); return; }
      if (!hover) { msg = T('先把光标移到图纸上，再按空格——落点就是光标那一格。'); render(); return; }
      var o = SH.place(hand, hover, handRot);
      msg = o.ok ? T('成了。') : o.why;
      if (o.ok) { sel = null; hand = -1; B.save(); }
      render();
    } else if (e.key === 'r' || e.key === 'R') {
      if (hand < 0) return;
      handRot = (handRot + 1) % 4;
      msg = T('转了 #°。').replace('#', handRot * 90);
      render();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!sel) return;
      var p = sel.split(',').map(Number);
      var o2 = SH.remove(p);
      msg = o2.ok ? T('拆掉了整件。') : o2.why;
      if (o2.ok) store.give(o2.serial);
      sel = null;
      render();
    }
  }

  BS.reg.add({
    id: 'forge', n: '1', t: '图形工坊', sub: 'WORKSHOP',
    mount: function (h) {
      /* 手上那件是**借出来的**：从库 takeOne 出来、还没落到板上。
         所以进这一页之前必须先还回去——上一次的 mount 直接把它抹成 -1，
         于是「拿在手上 → 切一页 → 回来」那件就凭空消失了（用户报的 bug）。
         dropHand() 在 unmount 与 mount 各来一次：unmount 是语义上的正位
         （离开这一页就该放手），mount 是兜底（万一上一次没走 unmount）。 */
      dropHand();
      host = h; dirty = false; handRot = 0; hover = null; sel = null; msg = ''; from = 0;
      ghostMarks = [];
      offs.push(B.on('shop', function () { mark(); }));
      offs.push(B.on('armory', function () { mark(); }));
      offs.push(B.on('inv', function () { mark(); }));
      /* 升级商店买了「图纸扩容」会 emit('gain')——板子尺寸变了，
         这一页必须整页重画（网格上界、--cols 都得跟着换）。
         少了这一条，买完升级要切走再回来才看得到新板子。 */
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
