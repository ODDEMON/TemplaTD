/* world/mods/atlas.js —— 图谱。
   识别表（条数以 C.LIST.length 为准，别在这里写死）在这里摊开。测量页只给你看「这一具此刻命中了哪几条」，
   这一页把表里**全部**识别列出来，每一条写明它要什么、此刻成不成立、
   还差多少——让你看得见「离下一条有多远」，而不是只看得见已经到手的。

   互动只有一种：点一条跳去测量页。图谱是地图，测量页才是现场。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, C = BS.catalog, T = H.T, I = BS.i18n;

  var host = null, dirty = true, only = 0;   /* 0 全部 / 1 此刻成立 / 2 差一步 */
  function mark() { dirty = true; }

  /* 这一条此刻离达成有多远：返回 0..1。只对写得出「还差多少」的条目给数。 */
  function progress(a, st) {
    var v = 0;
    try { if (a.ok(st)) return 1; } catch (e) { return 0; }
    /* 从条件文字里抠不出可靠进度，所以只对几类常见阈值给近似 */
    return v;
  }

  function rows() {
    var st = M.stats(), live = {}, out = '', i, shown = 0;
    (function () { var m = C.marks(st), z; for (z = 0; z < m.length; z++) live[m[z]] = 1; })();
    for (i = 0; i < C.LIST.length; i++) {
      var a = C.LIST[i], got = !!live[a.id];
      if (only === 1 && !got) continue;
      if (only === 2 && got) continue;
      shown++;
      out += '<div class="ar' + (got ? ' hot' : '') + '">' +
        '<span class="ai">' + (got ? '◉' : '○') + '</span>' +
        '<span class="ac">' + U.esc(I.gloss(a)) + '</span>' +
        '<span class="at2">' + U.esc(I.term(a)) + '</span>' +
        '<span class="ad">' + U.esc(T(a.d)) + '</span>' +
        '<span class="ap">' + (got ? T('此刻成立') : T('未成立')) + '</span>' +
        '</div>';
    }
    if (!out) out = H.empty(T('这一段里没有条目。'));
    return { html: '<div class="ars">' + out + '</div>', shown: shown };
  }

  function render() {
    var r = rows(), st = M.stats(), got = C.marks(st).length, tot = C.LIST.length;
    host.innerHTML =
      H.head('图谱', 'ATLAS',
        T('识别表的 # 条全部摊在这里。它不是收藏：每条都从当前这一具上重算，拆掉一格，亮着的就灭。').replace('#', tot)) +
      '<div class="statline">' +
      H.kv('此刻成立', got + ' / ' + tot) +
      H.kv('当前格数', U.n0(st.n)) +
      H.kv('质变度', (st.esScore || 0).toFixed(3)) +
      '</div>' +
      '<div class="abar"><i style="width:' + (tot ? (got / tot * 100).toFixed(1) : 0) + '%"></i></div>' +
      '<div class="ff">' +
      H.btn('only:0', T('看全部'), only === 0 ? 'on' : 'ghost') +
      H.btn('only:1', T('只看成立的'), only === 1 ? 'on' : 'ghost') +
      H.btn('only:2', T('只看没成立的'), only === 2 ? 'on' : 'ghost') +
      '</div>' +
      r.html +
      H.note(T('◉ 此刻这一具就是它，○ 还不是。想看这些数是怎么算出来的，去「测量」；想看某一具体图形，也去「测量」。'));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('only:') === 0) { only = +a.slice(5); mark(); render(); }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  BS.reg.add({
    id: 'atlas', n: '6', t: '图谱', sub: 'ATLAS',
    badge: function () { return U.n0(C.marks(M.stats()).length); },
    mount: function (h) { host = h; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('restore', mark);
})(window.BS);