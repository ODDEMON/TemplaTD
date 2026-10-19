/* world/mods/store.js —— 库：库存。
   ------------------------------------------------------------------
   图形库（目录）已删——元件不再人人可查，而是抽来的。
   **这一页只管「还剩什么」**：抽卡与升级商店已经搬到「商店」页去了，
   这里只留库存列表与丢弃。分家的理由很直白：
     · 花出去的动作（抽卡/买升级）在一页，
     · 手里的存货（元件清单）在另一页，
   这样「我有多少」和「我能买什么」不会挤在同一屏里互相抢注意力。
   库存是**多重集合**：同一序号可以攒多枚。三道筛选 + 行尾丢弃。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, ST = BS.store;

  var host = null, dirty = false, offs = [];
  var from = 0, PER = 12;
  var rar = -1, form = '', trait = '';
  var msg = '';

  function invIds() {
    var a = ST.inv(), seen = {}, out = [], k;
    for (k = 0; k < a.length; k++) { if (!seen[a[k]]) { seen[a[k]] = 1; out.push(a[k]); } }
    return out;
  }
  function filtered() {
    var ids = invIds(), out = [], i;
    for (i = 0; i < ids.length; i++) {
      var part = BS.shop.partOf(ids[i]);
      if (rar >= 0 && part.rar !== rar) continue;
      if (form && part.form !== form) continue;
      if (trait && part.traits.indexOf(trait) < 0) continue;
      out.push(ids[i]);
    }
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

  function filters() {
    var i, out = '';
    out += '<div class="ff"><span class="fl">' + U.esc(T('稀有度')) + '</span>' +
      H.btnR('rar:-1', T('全部'), rar < 0 ? 'on' : 'chip');
    for (i = 0; i < P.RARITY.length; i++) out += H.btnR('rar:' + i, I.term(P.RARITY[i], 't'), rar === i ? 'on' : 'chip');
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
      out += H.btnR('tr:' + P.TRAITS[i].id, P.TRAITS[i].sym + ' ' + I.term(P.TRAITS[i]),
        trait === P.TRAITS[i].id ? 'on' : 'chip', false, P.TRAITS[i].d);
    }
    out += '</div>';
    return out;
  }

  function invRows() {
    var ids = filtered(), out = '', i;
    if (from >= ids.length) from = 0;
    if (!ids.length) return '<p class="note dim">' + U.esc(T('库里没有符合条件的件。')) + '</p>';
    for (i = from; i < ids.length && i < from + PER; i++) {
      var idx = ids[i], part = BS.shop.partOf(idx);
      var f = P.formOf(part.form), rr = P.RARITY[part.rar];
      var n = 0, k;
      for (k = 0; k < ST.inv().length; k++) if (ST.inv()[k] === idx) n++;
      out += '<div class="lrrow r' + part.rar + '">' +
        '<span class="lrf">' + miniGrid(part, 8) + '</span>' +
        '<span class="lrt"><b>' + U.esc(P.serialOf(idx)) + '</b>' +
        '<span class="fam">' + f.sym + ' ' + U.esc(I.term(f)) + '</span>' +
        '<em class="rv">' + U.esc(I.term(rr, 'full')) + '</em>' +
        '<em>×' + n + ' · ' + U.n0(part.cells.length) + ' ' + U.esc(T('格')) + '</em></span>' +
        '<span class="lra">' + H.btnR('dis:' + idx, T('丢弃'), 'ghost small') + '</span>' +
        '</div>';
    }
    out += '<div class="pager">' +
      H.btnR('pg:prev', '←', 'ghost', from === 0) +
      '<span class="pgi">' + (ids.length ? from + 1 : 0) + '–' + Math.min(from + PER, ids.length) + ' / ' + ids.length + '</span>' +
      H.btnR('pg:next', '→', 'ghost', from + PER >= ids.length) +
      '</div>';
    return '<div class="lrs">' + out + '</div>';
  }

  function render() {
    if (!host) return;
    var out = H.head('库', 'STORE',
      '元件是抽来的，不是查来的。这一页只管「手里还剩什么」——抽卡与升级在商店页。');
    out += '<div class="msg">' + U.esc(msg) + '</div>';
    out += '<div class="statline">' +
      H.kv('采集尘', U.n0(BS.bus.state.dust)) +
      H.kv('结晶', U.n0(BS.bus.state.crystal)) +
      H.kv('在库', U.n0(ST.count())) +
      H.kv('去重', U.n0(invIds().length)) +
      '</div>';
    out += '<h3 class="sub">' + U.esc(T('库存')) + '</h3>' + filters() + invRows();
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('dis:') === 0) {
        var d = ST.discard(+a.slice(4));
        msg = d.ok ? T('丢弃了一枚。') : d.why;
        render(); return;
      }
      if (a.indexOf('rar:') === 0) { rar = +a.slice(4); from = 0; render(); return; }
      if (a.indexOf('fm:') === 0) { form = a.slice(3); from = 0; render(); return; }
      if (a.indexOf('tr:') === 0) { trait = a.slice(3); from = 0; render(); return; }
      if (a === 'pg:prev') { from = Math.max(0, from - PER); render(); return; }
      if (a === 'pg:next') { from = from + PER; render(); return; }
    });
  }

  BS.reg.add({
    id: 'store', n: '2', t: '库', sub: 'STORE',
    mount: function (h) {
      host = h; dirty = false; from = 0; msg = '';
      offs.push(B.on('inv', function () { dirty = true; }));
      offs.push(B.on('gain', function () { dirty = true; }));
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
