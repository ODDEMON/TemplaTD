/* world/mods/auction.js —— 呈交。光只在这里到账。
   ------------------------------------------------------------------
   你把这一具图形整个交出去：它离开图纸，你拿到一笔光。
   价由鉴赏录定——这一具此刻符合了多少条，就值多少条的钱，
   而且条数本身还要再乘一道：收藏家买的是成套的东西，不是零敲碎打。

   这一页做三件事：
     · 把此刻的估价摆在最上面，它是你这段时间全部劳动的标价
     · 把鉴赏录摊开，每一条都写明它认什么、此刻成不成立
     · 按下「拍卖并重置」，成交，图纸归零

   成交之后元件也一并离场——你卖的是这一具，不是它的照片。
   所以下一具必须从头再来：这就是这一部作品的呼吸。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, A = BS.auction, P = BS.parts, R = BS.render, T = H.T, I = BS.i18n;

  var host = null, dirty = true, only = 0, openCat = '', msg = '', receipt = null, catInit = 0;
  function mark() { dirty = true; }

  /* 习作 / 作品：够不上作品，参数·构形·名堂这三类就不计价。
     这一条必须常驻可见——不然看的人看到的是「我的估价凭什么从 90 跳到 1140」，
     而不是「我刚刚跨过了一条线」。 */
  function workBar(ev) {
    if (!ev || !ev.n) return '';
    if (ev.isWork) {
      return '<div class="workbar ok"><b>' + U.esc(T('作品')) + '</b>' +
        '<span>' + U.esc(T('三类鉴赏条目都已计价')) + '</span></div>';
    }
    var dn = Math.max(0, BS.auction.WORK_CELLS - ev.n);
    var dp = Math.max(0, BS.auction.WORK_PIECES - ev.pieces);
    return '<div class="workbar"><b>' + U.esc(T('习作')) + '</b>' +
      '<span>' + U.esc(BS.i18n.fill(T('还差 # 件 / # 格'), U.n0(dp), U.n0(dn))) + '</span>' +
      '<em>' + U.esc(T('参数·构形·名堂这三类暂不计价')) + '</em>' +
      '<i class="gbar"><u style="width:' +
      Math.round(U.clamp(Math.min(ev.pieces / BS.auction.WORK_PIECES, ev.n / BS.auction.WORK_CELLS), 0, 1) * 100) +
      '%"></u></i></div>';
  }

  function bidBox(ev) {
    if (!ev || !ev.n) {
      return '<div class="bidbox empty"><b>' + U.esc(T('此刻估价')) + '</b>' +
        '<span class="note dim">' + U.esc(T('图纸是空的。落下第一件，估价就开始长。')) + '</span>' +
        '<div class="ff">' + H.btn('go:library', T('去库里拿一件'), 'go') + '</div></div>';
    }
    var tags = '', i;
    for (i = 0; i < ev.top.length; i++) {
      tags += '<span class="bt2">' + U.esc(I.tell(ev.top[i].t)) + '<em>+' + U.big(ev.top[i].pay) + '</em></span>';
    }
    return '<div class="bidbox big">' +
      '<div class="bidtop"><b>' + U.esc(T('此刻估价')) + '</b>' +
      '<span class="bidnum">' + U.big(Math.round(ev.total)) + '</span><em>' + U.esc(T('光')) + '</em></div>' +
      '<div class="bidsub">' +
      H.kv('格', U.n0(ev.n)) + H.kv('元件', U.n0(ev.pieces)) +
      H.kv('站住的条目', U.n0(ev.k) + ' / ' + U.n0(ev.items.length)) +
      H.kv('条目估值合计', U.big(ev.sum)) +
      H.kv('条数加成', '×' + U.fmt(ev.mult, 2)) +
      H.kv('声誉', '×' + U.fmt(ev.rep, 2)) +
      H.kv(T('成交加成'), '×' + U.fmt(ev.sales || 1, 2)) +
      H.kv('脉络倍率', '×' + U.fmt((BS.tree.mods().luxMult || 1) * (1 + (BS.tree.mods().bid || 0)), 2)) +
      '</div>' +
      (tags ? '<div class="bidtags"><span class="btl">' + U.esc(T('最值钱的那几条')) + '</span>' + tags + '</div>' : '') +
      '</div>';
  }

  function ledger(ev) {
    var gs = A.groups(), out = '', i, j, on;
    for (i = 0; i < gs.length; i++) {
      var list = A.inGroup(gs[i]), hitN = 0;
      for (j = 0; j < list.length; j++) if (ev.ids[list[j].id]) hitN++;
      var isOpen = openCat === gs[i];
      out += '<div class="led' + (isOpen ? ' open' : '') + '">' +
        '<button class="ledh" data-act="cat:' + U.esc(gs[i]) + '">' +
        '<b>' + U.esc(T(gs[i])) + '</b>' +
        '<span class="ledn">' + hitN + ' / ' + list.length + '</span>' +
        '<i class="gbar"><u style="width:' + (list.length ? (hitN / list.length * 100).toFixed(1) : 0) + '%"></u></i>' +
        '</button>';
      if (isOpen) {
        out += '<div class="ledl">';
        for (j = 0; j < list.length; j++) {
          var a = list[j];
          on = !!ev.ids[a.id];
          if (only === 1 && !on) continue;
          if (only === 2 && on) continue;
          out += '<div class="li' + (on ? ' on' : '') + '">' +
            '<span class="lii">' + (on ? '◉' : '○') + '</span>' +
            '<span class="lit">' + U.esc(I.tell(a.t)) + '</span>' +
            '<span class="lid">' + U.esc(I.tell(a.d)) + '</span>' +
            '<span class="lip">' + (on ? '+' + U.big(a.pay) : '—') + '</span></div>';
        }
        out += '</div>';
      }
      out += '</div>';
    }
    return '<div class="leds">' + out + '</div>';
  }

  /* 陈列随上交一并清空（上交重置除光与脉络外的全部内容），
     永远是空的，这一段界面就整个摘掉了。S.gal 字段留在存档结构里，只作兼容。 */

  function record() {
    var a = S.auc || { n: 0, total: 0, best: 0, cells: 0 };
    return '<div class="statline">' +
      H.kv('成交次数', U.n0(a.n)) +
      H.kv('累计进账', U.big(a.total || 0)) +
      H.kv('最高一次', U.big(a.best || 0)) +
      H.kv('累计交出', U.n0(a.cells) + ' ' + T('格')) +
      H.kv('声誉', '+' + Math.round(BS.quests.rep() * 100) + '%') +
      H.kv('已成立判定', U.n0(BS.achieve.count()) + ' / ' + U.n0(BS.achieve.LIST.length)) +
      '</div>';
  }

  function render() {
    var ev = null;
    try { ev = A.eval(M); } catch (e) { ev = null; }
    /* 头一次进来就把第一类鉴赏条目掀开：空着一片折叠面板，看着像没内容 */
    if (!catInit) { catInit = 1; openCat = A.groups()[0] || ''; }
    var can = !!(ev && ev.n > 0 && ev.total > 0);
    host.innerHTML =
      H.head('呈交', 'AUCTION',
        T('光不按件给。你把这一具整个交出去，价由它此刻符合了多少条鉴赏条目定——成交之后图纸归零，元件也一并离场。')) +
      '<div class="msg">' + U.esc(msg) + '</div>' +
      (receipt ? receiptHtml() : '') +
      workBar(ev) +
      bidBox(ev) +
      '<div class="ff big">' +
      H.btn('sell', T('拍卖并重置'), can ? 'go big' : 'go big', !can) +
      H.btn('go:assembly', T('回去再改改'), 'ghost big') +
      '</div>' +
      '<h3 class="sub">' + U.esc(T('成交记录')) + '</h3>' +
      record() +
      '<h3 class="sub">' + U.esc(T('鉴赏录')) + '</h3>' +
      H.note(T('每一条都从当前这一具上当场重算：你拆掉一格，刚才亮着的那条就灭，价也跟着掉。点一类展开。')) +
      '<div class="ff">' +
      H.btn('only:0', T('全部'), only === 0 ? 'on' : 'ghost') +
      H.btn('only:1', T('只看站住的'), only === 1 ? 'on' : 'ghost') +
      H.btn('only:2', T('只看还差的'), only === 2 ? 'on' : 'ghost') +
      '</div>' +
      (ev ? ledger(ev) : '') +
      H.note(T('声誉来自你完成过的命题与点亮过的判定：它们不进清单，但它们抬价——拍卖行认的是作者，不只是这一件。'));
    bind();
  }

  function receiptHtml() {
    var r = receipt, out = '', i;
    for (i = 0; i < r.top.length; i++) {
      out += '<span class="bt2">' + U.esc(I.tell(r.top[i].t)) + '<em>+' + U.big(r.top[i].pay) + '</em></span>';
    }
    return '<div class="receipt">' +
      '<b>' + U.esc(T('成交')) + '</b>' +
      '<span class="rnum">' + U.big(Math.round(r.pay)) + '</span><em>' + U.esc(T('光')) + '</em>' +
      '<div class="bidsub">' +
      H.kv('交出', U.n0(r.n) + ' ' + T('格') + ' / ' + U.n0(r.pieces) + ' ' + T('件')) +
      H.kv('站住的条目', U.n0(r.k)) + '</div>' +
      (out ? '<div class="bidtags">' + out + '</div>' : '') +
      '<p class="note dim">' + U.esc(T('图纸已经归零。上游还在落件——下一具从这一刻重新开始。')) + '</p></div>';
  }

  function bind() {
    U.act(host, function (a) {
      if (a === 'sell') {
        var r = M.sell();
        if (r.ok) {
          receipt = r;
          msg = T('成交：# 光。').replace('#', U.big(Math.round(r.pay)));
          only = 1;
        } else { msg = r.why; receipt = null; }
        mark(); render();
        return;
      }
      if (a.indexOf('cat:') === 0) { openCat = (openCat === a.slice(4) ? '' : a.slice(4)); mark(); render(); return; }
      if (a.indexOf('only:') === 0) { only = +a.slice(5); mark(); render(); return; }
      if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  BS.reg.add({
    id: 'auction', n: '2', t: '呈交', sub: 'AUCTION',
    badge: function () {
      var v = BS.app && BS.app.bidNow ? BS.app.bidNow() : 0;
      return v ? U.big(Math.round(v)) : '';
    },
    mount: function (h) { host = h; msg = ''; receipt = null; catInit = 0; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('lib', mark); B.on('restore', mark); B.on('lux', mark);
  B.on('tree', mark); B.on('auc', mark);
})(window.BS);
