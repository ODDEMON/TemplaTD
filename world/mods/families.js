/* world/mods/families.js —— 型录。
   十八种骨架在这里摊开：每一种型长什么样（拿一件真件画给你看）、
   它的规矩是什么、板上和库里各有多少件。
   型只改格子的排布，不碰任何读数——所以这一页讲的全是「怎么认出它」，
   一个字的加成都不提，因为确实没有。

   哪一档用哪几种型写在 core/parts.js 的 STYLE_FORMS 里：
   常档用的是碎块、短梁、阶、小三角、梳；殿档用的是巨框、巨环、
   巨三角、巨十字、巨叉、门、长梁、空心菱——那是它「巨型而极简」的来处。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, P = BS.parts, R = BS.render, T = H.T, I = BS.i18n;

  var host = null, dirty = true;
  function mark() { dirty = true; }

  /* 每型抽一件真件当样例：拿序号最小的那件，确定性，刷新也不变 */
  function samples() {
    var out = {}, i, s;
    for (i = 0; i < 900; i++) {
      s = P.shapeOf(i);
      if (!out[s.form]) out[s.form] = i;
    }
    return out;
  }
  function counts() {
    var onBoard = {}, inLib = {}, ins = M.insts(), i, lib = M.lib(), m;
    for (i = 0; i < ins.length; i++) {
      m = M.metaOf(ins[i].e);
      onBoard[m.form] = (onBoard[m.form] || 0) + 1;
    }
    for (i = 0; i < lib.length; i++) {
      if ((S.gone || {})[lib[i]]) continue;
      m = M.metaOf(lib[i]);
      inLib[m.form] = (inLib[m.form] || 0) + 1;
    }
    return { board: onBoard, lib: inLib };
  }
  /* 这一型出现在哪几档里：写在型录上，一眼看得见「谁会用这种骨架」 */
  function usersOf(formId) {
    var out = [], k, i;
    for (k in P.STYLE_FORMS) {
      if (P.STYLE_FORMS[k].indexOf(formId) < 0) continue;
      for (i = 0; i < P.RARITY.length; i++) if (P.RARITY[i].style === k) out.push(P.RARITY[i]);
    }
    return out;
  }

  function render() {
    var sm = samples(), c = counts(), out = '', i, f, idx;
    for (i = 0; i < P.FORMS.length; i++) {
      f = P.FORMS[i];
      idx = sm[f.id];
      var fig = '', pr = null;
      if (idx != null) { pr = M.rotPairOf('n' + idx, 0); fig = R.shape(pr.cells, 64, P.shapeOf(idx).rar, { glyphs: pr.glyphs, plain: 1 }); }
      var users = usersOf(f.id), un = '', z;
      for (z = 0; z < users.length; z++) {
        un += '<span class="rv r' + users[z].id + '">' + U.esc(I.full(users[z])) + '</span>';
      }
      out += '<div class="lr">' +
        '<div class="lrf">' + (fig || '<span class="tsym">' + f.sym + '</span>') + '</div>' +
        '<div class="lrt"><b>' + f.sym + ' ' + U.esc(I.term(f)) + '</b>' +
        (I.gloss(f) ? '<em>' + U.esc(I.gloss(f)) + '</em>' : '') +
        '<p class="tdesc">' + U.esc(T(f.d)) + '</p>' +
        (un ? '<div class="fam">' + U.esc(T('出现在')) + ' ' + un + '</div>' : '') + '</div>' +
        '<div class="lra tnums">' +
        '<span class="kv"><b>' + T('板上') + '</b>' + U.n0(c.board[f.id] || 0) + '</span>' +
        '<span class="kv"><b>' + T('库里') + '</b>' + U.n0(c.lib[f.id] || 0) + '</span>' +
        H.btn('go:' + f.id, T('去库里挑'), 'ghost small') +
        '</div></div>';
    }
    host.innerHTML =
      H.head('型录', 'FORMS',
        T('十八种骨架。型决定这件元件摆成什么样——它不碰任何读数，不加任何分。框围得出空，拱把两边挑起来，梁就是一根到底。')) +
      '<div class="statline">' +
      H.kv('型', P.FORMS.length + ' ' + T('种')) +
      H.kv('板上元件', U.n0(M.insts().length)) +
      H.kv('库里元件', U.n0(M.libCount())) +
      '</div>' +
      '<div class="lrs">' + out + '</div>' +
      H.note(T('每一种型都必须是一整块：格与格只认横竖相邻，只靠对角挨着的「斜线」不算连上。所以星形、圆形，以及那些尖角收在格心里的三角、梯形、平行四边形，都从这一版删掉了。')) +
      H.note(T('五档造型语言各取其中的一部分：常档是极简的小块，变与超是小而强对称的现代结构，华是赛博朋克的锐角与回路，殿是巨型的极简。'));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('go:') === 0) {
        B.emit('libfilter', { form: a.slice(3) });
        B.emit('goto', { id: 'library' });
      }
    });
  }

  BS.reg.add({
    id: 'families', n: '8', t: '型录', sub: 'FORMS',
    badge: function () { return ''; },
    mount: function (h) { host = h; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('lib', mark); B.on('restore', mark);
})(window.BS);
