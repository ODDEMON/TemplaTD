/* world/mods/tree.js —— 脉络。
   八条脉络，往下没有尽头。每个节点写清楚三件事：要花多少光、
   要先点亮谁、点亮之后确切会得到什么。没有「提升若干」这种含糊话。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, Tr = BS.tree, T = H.T, I = BS.i18n;

  var host = null, dirty = true, msg = '', expand = 0;
  function mark() { dirty = true; }

  /* 每条脉络点亮到第几级，做成一览 */
  function branchBar() {
    var out = '', i, b, lv;
    for (i = 0; i < Tr.BRANCHES.length; i++) {
      b = Tr.BRANCHES[i];
      lv = Tr.branchLevel(b.id);
      out += '<span class="br' + (lv ? ' has' : '') + '" title="' + U.esc(T(b.d)) + '">' +
        '<i>' + b.sym + '</i><b>' + U.esc(I.term(b)) + '</b><em>' + U.n0(lv) + '</em></span>';
    }
    return '<div class="brs">' + out + '</div>';
  }

  function nodeHtml(nd) {
    var bought = Tr.bought(nd.id);
    var blk = bought ? '' : Tr.blocked(nd.id);
    var cls = 'nd' + (bought ? ' on' : (blk ? ' off' : ' can'));
    var why = bought ? T('已点亮') : blk;
    return '<button class="' + cls + '" data-act="buy:' + U.esc(nd.id) + '"' +
      (bought || blk ? ' disabled' : '') + ' title="' + U.esc(why) + '">' +
      '<span class="ndb">' + nd.branch.sym + '</span>' +
      '<span class="ndn">' + U.esc(I.tell(nd.nm)) + '</span>' +
      '<span class="nds">' + U.esc(I.tell(nd.say)) + '</span>' +
      '<span class="ndc">' + (bought ? '✓' : U.big(nd.cost)) + '</span>' +
      '</button>';
  }

  function tiers() {
    var ts = Tr.tiers(), out = '', i, j;
    var lim = Math.min(ts.length, expand ? ts.length : 8);
    for (i = 0; i < lim; i++) {
      var t = ts[i];
      out += '<div class="tier' + (i % 2 ? ' alt' : '') + '">' +
        '<div class="tierh"><b>' + T('第 # 层').replace('#', i) + '</b>' +
        '<em>' + U.n0(t.nodes.length) + ' ' + T('个节点') + '</em></div>' +
        '<div class="tiern">';
      for (j = 0; j < t.nodes.length; j++) out += nodeHtml(t.nodes[j]);
      out += '</div></div>';
    }
    if (lim < ts.length) {
      out += '<div class="ff">' + H.btn('more', T('再往下 # 层').replace('#', Math.min(8, ts.length - lim)), 'go') + '</div>';
    }
    return out;
  }

  function render() {
    var mods = Tr.mods();
    host.innerHTML =
      H.head('脉络', 'TECH TREE',
        T('往下没有尽头。每个节点都写明要花多少光、要先点亮谁、点亮后确切得到什么。价钱按 # 倍逐层涨，收益涨得更慢——所以永远值得挖，也永远挖不到头。').replace('#', Tr.COST_GROW)) +
      '<div class="msg">' + U.esc(msg) + '</div>' +
      '<div class="statline">' +
      H.kv('手上的光', U.big(S.lux)) +
      H.kv('已点亮', U.n0(mods.nodes) + ' ' + T('个')) +
      H.kv('最深', T('第 # 层').replace('#', Math.max(0, Tr.maxBoughtTier()))) +
      H.kv('累计花掉', U.big(Tr.spent())) +
      H.kv('可见深度', U.n0(Tr.depth()) + ' ' + T('层')) +
      '</div>' +
      '<h3 class="sub">' + U.esc(T('八条脉络')) + '</h3>' +
      branchBar() +
      '<h3 class="sub">' + U.esc(T('当前的加成')) + '</h3>' +
      '<div class="mods">' + modList(mods) + '</div>' +
      '<h3 class="sub">' + U.esc(T('往下挖')) + '</h3>' +
      tiers() +
      H.note(T('买下一个节点之后，可见深度会往外推——所以这棵树是挖不完的。价钱按层数指数增长，光不够就先回去装图形。'));
    bind();
  }

  function modList(m) {
    var rows = '';
    rows += H.row('成交价倍率', '×' + U.fmt(m.luxMult, 2));
    rows += H.row('落件间隔', M.curPeriod().toFixed(1) + ' s（' + T('缩短 #').replace('#', Math.round(m.haste * 100) + '%') + '）');
    rows += H.row('眼光（成交价）', '+' + Math.round(m.bid * 100) + '%');
    rows += H.row('特质 luck', '+' + Math.round(m.traitLuck * 100) + '%');
    rows += H.row('可撤销步数', U.n0(m.undo));
    rows += H.row('自动装配', m.autoRate > 0 ? T('已点亮，速度 #').replace('#', Math.round(m.autoRate * 100) + '%') + (m.autoPick ? T('，优先挑「自组织」') : '') : T('未点亮'));
    rows += H.row('预知落件', m.peek ? T('接下来 # 件').replace('#', m.peekN) : T('未点亮'));
    rows += H.row('眼光加成', '+' + Math.round(m.bid * 100) + '%');
    rows += H.row('指标加成', T('自相似 +# / 部分对称 +# / 整体对称 +# / 分形 +#')
      .replace('#', Math.round(m.essence[0] * 100) + '%')
      .replace('#', Math.round(m.essence[1] * 100) + '%')
      .replace('#', Math.round(m.essence[2] * 100) + '%')
      .replace('#', Math.round(m.essence[3] * 100) + '%'));
    return '<div class="stats">' + rows + '</div>';
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('buy:') === 0) {
        var r = Tr.buy(a.slice(4));
        if (r.ok) { msg = T('点亮「#」：#').replace('#', I.tell(r.nd.nm)).replace('#', I.tell(r.nd.say)); }
        else msg = r.why;
        mark(); render();
      }
      else if (a === 'more') { expand = expand + 8; mark(); render(); }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  BS.reg.add({
    id: 'tree', n: '4', t: '脉络', sub: 'VEINS',
    badge: function () { return U.big(S.lux); },
    mount: function (h) { host = h; msg = ''; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('tree', mark); B.on('lux', mark); B.on('restore', function () { expand = 0; mark(); });
})(window.BS);
