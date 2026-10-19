/* world/mods/armory.js —— 军械库。
   ------------------------------------------------------------------
   提交进化的炮塔都住在这里。每一位的身份是它的编号（TC-###）：
   同一编号永远是同一座塔、同一批读数、同一个部署成本。
   这一页回答「打起来什么样」——六项读数与炮塔属性都有数字。
   正在局里站岗的塔不许淘汰：先撤下，再淘汰。

   这一版多了一栏**提交流水**，理由很简单：
   「淘汰」是删掉在库记录，删掉之后你就再也说不出「我做过一座什么样的塔」。
   所以提交那一刻另存一份只增不减的流水（bus.armoryLog）——
   在库列表只减不增，流水只增不减，两张表合起来才是完整的历史。
   流水里的每一行都标出它现在还在库、还是已经被淘汰。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, SH = BS.shop;

  var host = null, dirty = false, offs = [];
  var view = 'live';     /* live = 在库 / log = 流水 */

  function specLine(a) {
    return T('伤害 # · 攻速 # · 射程 # · 弹 # · 连锁 #')
      .replace('#', a.dmg.toFixed(1)).replace('#', a.rate.toFixed(1))
      .replace('#', a.range.toFixed(1)).replace('#', a.proj).replace('#', a.chain);
  }

  function miniGrid(rec) {
    var sz = P.size(rec.cells), out = '', x, y, set = {}, i;
    for (i = 0; i < rec.cells.length; i++) set[rec.cells[i][0] + ',' + rec.cells[i][1]] = 1;
    for (y = 0; y < sz.h; y++) {
      for (x = 0; x < sz.w; x++) out += '<i class="' + (set[x + ',' + y] ? 'on' : '') + '"></i>';
    }
    return '<span class="mg" style="--w:' + sz.w + '">' + out + '</span>';
  }

  /* 时间戳：只到分钟。军械库不是法庭，不需要毫秒。 */
  function when(ts) {
    var d;
    try { d = new Date(ts || 0); } catch (e) { return '—'; }
    if (!(d.getTime() > 0)) return '—';
    var p = function (v) { return v < 10 ? '0' + v : String(v); };
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- 在库：能淘汰的那一份 ---------- */
  function liveRows(arm, taken) {
    if (!arm.length) {
      return H.empty('军械库是空的。去图形工坊拼一具图形，提交进化。');
    }
    var out = '<div class="vtable">', i;
    for (i = 0; i < arm.length; i++) {
      var rec = arm[i], a = rec.spec;
      out += '<div class="vrow r' + rec.rar + '">' +
        '<span class="vs">' + U.esc(rec.serial) + '</span>' +
        '<span class="vf">' + U.esc(I.term(P.FORM_BY[rec.form])) + ' · ' + U.esc(I.term(P.RARITY[rec.rar], 'full')) + '</span>' +
        '<span class="vm">' + miniGrid(rec) + ' ' + U.esc(I.fill('# 格', U.n0(rec.n))) + '</span>' +
        '<span class="ve">' + H.esRow(rec.es) + '</span>' +
        '<span class="vt">' + U.esc(specLine(a)) + '</span>' +
        '<span class="vc"><b>' + U.n0(rec.cost) + '</b> ' + U.esc(T('辉光')) +
        H.btnR('rm:' + rec.id, taken[rec.id] ? T('站岗中') : T('淘汰'), taken[rec.id] ? 'ghost' : 'x', !!taken[rec.id]) +
        '</span>' +
        '</div>';
    }
    return out + '</div>';
  }

  /* ---------- 流水：只读的那一份 ----------
     淘汰过的行不隐藏、不灰得看不见——它就该在那儿。
     只用一个「已淘汰」小标把它和还在库的区分开。 */
  function logRows(log, liveSet) {
    if (!log.length) {
      return H.empty('还没有提交过任何图形。');
    }
    var out = '<div class="vtable">', i;
    for (i = log.length - 1; i >= 0; i--) {
      var rec = log[i], a = rec.spec, on = !!liveSet[rec.id];
      out += '<div class="vrow r' + rec.rar + (on ? '' : ' gone') + '">' +
        '<span class="vs">' + U.esc(rec.serial) + '</span>' +
        '<span class="vf">' + U.esc(I.term(P.FORM_BY[rec.form])) + ' · ' + U.esc(I.term(P.RARITY[rec.rar], 'full')) + '</span>' +
        '<span class="vm">' + miniGrid(rec) + ' ' + U.n0(rec.n) + ' 格</span>' +
        '<span class="ve">' + H.esRow(rec.es) + '</span>' +
        '<span class="vt">' + U.esc(specLine(a)) + '</span>' +
        '<span class="vc">' +
        (on ? H.tagR(T('在库'), 'ok') : H.tagR(T('已淘汰'), 'x')) +
        '<em class="axt">' + U.esc(when(rec.at)) + '</em>' +
        '</span>' +
        '</div>';
    }
    return out + '</div>';
  }

  function render() {
    if (!host) return;
    var arm = BS.bus.state.armory || [];
    var log = BS.bus.state.armoryLog || [];
    var taken = SH.deployedIds();
    var liveSet = {}, i;
    for (i = 0; i < arm.length; i++) liveSet[arm[i].id] = 1;

    var out = H.head('军械库', 'ARMORY',
      '编号即身份：同编号永远是同一座塔。在库能淘汰，流水永不擦。');
    out += '<div class="statline">' +
      H.kv('在库', U.n0(arm.length)) +
      H.kv('递交过', U.n0(log.length)) +
      H.kv('已淘汰', U.n0(Math.max(0, log.length - arm.length))) +
      H.kv('已淘汰累计', U.n0(Math.max(0, (BS.bus.state.armorySeq | 0) - arm.length))) +
      '</div>';
    out += '<div class="ff">' +
      H.btnR('vw:live', T('在库（#）').replace('#', arm.length), view === 'live' ? 'on' : 'chip') +
      H.btnR('vw:log', T('提交流水（#）').replace('#', log.length), view === 'log' ? 'on' : 'chip') +
      '</div>';
    out += view === 'live' ? liveRows(arm, taken) : logRows(log, liveSet);
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('rm:') === 0) {
        var o = SH.discard(+a.slice(3));
        if (!o.ok) B.log(o.why, 'sys');
        render();
      } else if (a.indexOf('vw:') === 0) {
        view = a.slice(3);
        render();
      }
    });
  }

  BS.reg.add({
    id: 'armory', n: '9', t: '军械库', sub: 'ARMORY',
    mount: function (h) {
      host = h; dirty = false;
      offs.push(B.on('armory', function () { dirty = true; }));
      offs.push(B.on('run', function () { dirty = true; }));
      offs.push(B.on('restore', function () { render(); }));
      render();
    },
    tick: function () { if (host && dirty) { dirty = false; render(); } },
    unmount: function () {
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      host = null;
    }
  });
})(window.BS);
