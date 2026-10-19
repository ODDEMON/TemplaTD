/* world/mods/dual.js —— 两面。
   同一具图形，两种读法，同时成立：
     素的一面——只剩一条外轮廓。一支笔，一条线。
     繁的一面——每件一道外接框，每格一个坐标注。没有边界，没有尽头。
   极简与极繁在这部作品里不是两种风格，而是同一具图形的两种读法。
   这一页就是把这句话演出来：左右两边是同一具图形，不是两具。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, R = BS.render, T = H.T;

  var host = null, dirty = true;
  function mark() { dirty = true; }

  function face(cls, title, gloss, caption, svg) {
    return '<section class="face ' + cls + '">' +
      '<div class="faceh"><b>' + U.esc(T(title)) + '</b><i>' + U.esc(gloss) + '</i></div>' +
      '<div class="faceb">' + svg + '</div>' +
      '<div class="facec">' + U.esc(T(caption)) + '</div>' +
      '</section>';
  }

  function render() {
    var st = M.stats();
    var empty = st.n === 0;
    var austere = R.silhouette(M.body(), { pitch: 26, title: T('素') });
    var dense = R.board(M.body(), {
      dense: 1, hint: false, coords: false, nohit: true, pitch: 20, pad: 4,
      title: T('繁'),
      rarOf: function (e) { return M.metaOf(e).rar; },
      glyphOf: function (e, dx, dy, r) { return M.glyphOf(e, r, dx, dy); },
      nmOf: function (e) { return M.metaOf(e).nm; }
    });
    host.innerHTML =
      H.head('两面', 'DUAL',
        '同一具图形，两种读法。素的一面只剩一条轮廓；繁的一面格格有注。两种都成立——这部作品的张力，就在这两者之间。') +
      (empty ? '<p class="note">' + U.esc(T('图纸空着。素的一面已经成立；繁的一面，等第一件落料。')) + '</p>' : '') +
      '<div class="duo">' +
      face('a', '素', 'AUSTERE', '一支笔，一条线。', austere) +
      face('f', '繁', 'DENSE', '没有边界，没有尽头。', dense) +
      '</div>' +
      '<div class="statline">' +
      H.kv('格', U.n0(st.n)) + H.kv('元件', U.n0(st.insts)) +
      H.kv('质变度', st.esScore.toFixed(3)) + H.kv('洞', U.n0(st.holes)) +
      '</div>' +
      H.note(T('图纸太大时，繁的一面会自动退稀——这部作品只承认算得动的密度。'));
  }

  BS.reg.add({
    id: 'dual', n: '12', t: '两面', sub: 'DUAL',
    mount: function (h) { host = h; render(); },
    unmount: function () { host = null; },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('lib', mark); B.on('restore', mark);
})(window.BS);
