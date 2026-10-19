/* world/mods/traits.js —— 特质。
   十一种特质在这里摊开：每一种做什么、此刻板上有几件、库里还有几件。
   特质是这一部作品里唯一「出身之外的差别」，所以值得单独一页讲清楚。

   互动有两种：点一种特质跳去库里按它筛选；点「测量」看它抬高了哪一项。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, P = BS.parts, T = H.T, I = BS.i18n;

  var host = null, dirty = true;
  function mark() { dirty = true; }

  /* 板上与库里各有多少件带这种特质。
     注意 M.lib() 放的是元件 id 字符串，不是对象——取 .e 会拿到 undefined。 */
  function counts() {
    var onBoard = {}, inLib = {}, ins = M.insts(), i, z, e, m, lib = M.lib();
    for (i = 0; i < ins.length; i++) {
      m = M.metaOf(ins[i].e);
      for (z = 0; z < (m.traits || []).length; z++) onBoard[m.traits[z]] = (onBoard[m.traits[z]] || 0) + 1;
    }
    for (i = 0; i < lib.length; i++) {
      e = lib[i];
      if ((S.gone || {})[e]) continue;
      m = M.metaOf(e);
      for (z = 0; z < (m.traits || []).length; z++) inLib[m.traits[z]] = (inLib[m.traits[z]] || 0) + 1;
    }
    return { board: onBoard, lib: inLib };
  }

  function render() {
    var c = counts(), out = '', i, t;
    for (i = 0; i < P.TRAITS.length; i++) {
      t = P.TRAITS[i];
      var onB = c.board[t.id] || 0, inL = c.lib[t.id] || 0;
      out += '<div class="lr' + (onB ? ' hotrow' : '') + '">' +
        '<div class="lrf"><span class="tsym">' + t.sym + '</span></div>' +
        '<div class="lrt"><b>' + U.esc(I.term(t)) + '</b>' +
        (I.gloss(t) ? '<em>' + U.esc(I.gloss(t)) + '</em>' : '') +
        '<p class="tdesc">' + U.esc(T(t.d)) + '</p></div>' +
        '<div class="lra tnums">' +
        '<span class="kv"><b>' + T('板上') + '</b>' + U.n0(onB) + '</span>' +
        '<span class="kv"><b>' + T('库里') + '</b>' + U.n0(inL) + '</span>' +
        H.btn('go:' + t.id, T('去库里挑'), 'ghost small') +
        '</div></div>';
    }
    var tot = 0, k;
    for (k in c.board) tot += c.board[k];
    host.innerHTML =
      H.head('特质', 'TRAITS',
        T('十一件本事。资质决定长相与能带几条特质，特质才是真正的差别——同一档里也可能天壤之别。')) +
      '<div class="statline">' +
      H.kv('板上特质总数', U.n0(tot)) +
      H.kv('带特质的元件', U.n0(M.insts().filter(function (x) { return (M.metaOf(x.e).traits || []).length; }).length)) +
      H.kv('全部特质', P.TRAITS.length + ' ' + T('种')) +
      '</div>' +
      '<div class="lrs">' + out + '</div>' +
      H.note(T('特质是元件自带的，由序号决定，装上那一刻就在起作用。「神视」抬的是六项全部，其余只抬自己那一项。'));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('go:') === 0) {
        B.emit('libfilter', { trait: a.slice(3) });
        B.emit('goto', { id: 'library' });
      }
    });
  }

  BS.reg.add({
    id: 'traits', n: '7', t: '特质', sub: 'TRAITS',
    badge: function () { return ''; },
    mount: function (h) { host = h; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('lib', mark); B.on('restore', mark);
})(window.BS);