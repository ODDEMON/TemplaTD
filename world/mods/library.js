/* world/mods/library.js —— 库。
   上游按它自己的钟往下游投放：每若干秒一件，**只在你开着页面的时候落**。
   落下的是什么、多大、哪一档资质、带什么特质、是哪种型，全由序号决定。
   你能做的是：挑着装，或者把不要的丢掉腾地方。

   三道筛选一直都在，一道都不用点亮：资质、型、特质。
   从前「按特质筛库」要挖到「识」第三条才给，于是绝大多数人从头到尾
   没见过那排按钮——筛选是查东西用的，不是奖励。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, P = BS.parts, R = BS.render, T = H.T, I = BS.i18n;

  var host = null, dirty = true, from = 0, rar = -1, trait = '', form = '', msg = '';
  var PER = 24;
  function mark() { dirty = true; }

  /* 三道筛选：**一开始就在**，不用点亮任何脉络，也不用等任何点亮。
     从前「按特质筛库」要挖到「识」第三条，绝大多数人从头到尾没见过那排按钮——
     筛选是查东西用的，不是奖励。这句话也写在页面上，免得那排亮片看着像锁着的。 */
  function filters() {
    var i;
    var out = '<p class="ffnote">' + U.esc(T('三道筛选一开始就能用：不用点亮任何脉络，也不用等点亮。')) + '</p>';
    out += '<div class="ff"><span class="fl">' + U.esc(T('资质')) + '</span>' +
      H.btn('rar:-1', T('全部'), rar < 0 ? 'on' : 'chip');
    for (i = 0; i < P.RARITY.length; i++) {
      out += H.btn('rar:' + i, I.full(P.RARITY[i]), rar === i ? 'on' : 'chip');
    }
    out += '</div>';
    out += '<div class="ff"><span class="fl">' + U.esc(T('型')) + '</span>' +
      H.btn('fm:', T('全部'), form === '' ? 'on' : 'chip');
    for (i = 0; i < P.FORMS.length; i++) {
      /* btn 的第 4 参是「禁用」、第 5 参才是悬停说明——曾经把 d 错塞进第 4 参，
         整排 chip 全被渲染成 disabled，看着就像锁着没点亮。 */
      out += H.btn('fm:' + P.FORMS[i].id, P.FORMS[i].sym + ' ' + I.term(P.FORMS[i]),
        form === P.FORMS[i].id ? 'on' : 'chip', false, P.FORMS[i].d);
    }
    out += '</div>';
    out += '<div class="ff"><span class="fl">' + U.esc(T('特质')) + '</span>' +
      H.btn('tr:', T('全部'), trait === '' ? 'on' : 'chip');
    for (i = 0; i < P.TRAITS.length; i++) {
      out += H.btn('tr:' + P.TRAITS[i].id, P.TRAITS[i].sym + ' ' + I.term(P.TRAITS[i]),
        trait === P.TRAITS[i].id ? 'on' : 'chip', false, P.TRAITS[i].d);
    }
    out += '</div>';
    return out;
  }

  function rows() {
    var pg = M.page(from, PER, rar, trait, form), out = '', i, r;
    if (!pg.rows.length) {
      return H.empty(from > 0 ? T('这一页没有东西了。') : T('没有符合条件的件。换个筛选，或者等它落。'));
    }
    for (i = 0; i < pg.rows.length; i++) {
      r = pg.rows[i];
      var pr = M.rotPairOf(r.e, 0);
      var sz = P.size(pr.cells);
      var fm = P.FORM_BY[r.form];
      var trs = '', z;
      for (z = 0; z < (r.traits || []).length; z++) {
        var t = P.traitOf(r.traits[z]);
        if (t) trs += '<span class="tr" title="' + U.esc(T(t.d)) + '"><i>' + t.sym + '</i>' + U.esc(I.term(t)) + '</span>';
      }
      out += '<div class="lr">' +
        '<div class="lrf">' + R.shape(pr.cells, 54, r.rar, { glyphs: pr.glyphs }) + '</div>' +
        '<div class="lrt"><b>' + U.esc(r.nm) + '</b>' +
        '<span class="rv r' + r.rar + '">' + U.esc(I.full(P.RARITY[r.rar])) + '</span>' +
        (fm ? '<span class="fam">' + fm.sym + ' ' + U.esc(I.term(fm)) + '</span>' : '') +
        '<em>' + T('外接') + ' ' + sz.w + '×' + sz.h + ' · ' + P.serialOf(+r.e.slice(1)) + '</em>' +
        (trs ? '<div class="trs">' + trs + '</div>' : '') +
        '</div>' +
        '<div class="lra">' + H.btn('take:' + r.e, T('拿在手上'), 'go') +
        H.btn('rec:' + r.e, T('丢弃'), 'ghost small') + '</div>' +
        '</div>';
    }
    return '<div class="lrs">' + out + '</div>';
  }

  function render() {
    var tot = M.libCount();
    var matched = M.countBy(rar < 0 ? null : rar, trait, form);
    host.innerHTML =
      H.head('库', 'LIBRARY',
        T('上游每 # 秒落一件，而且只在你开着页面的时候落。挑着装，或者把不要的丢掉腾地方。').replace('#', M.curPeriod().toFixed(1))) +
      '<div class="msg">' + U.esc(msg) + '</div>' +
      '<div class="statline">' +
      H.kv('光', U.big(S.lux)) +
      H.kv('库里', U.n0(tot) + ' ' + T('件')) +
      H.kv('符合筛选', U.n0(matched) + ' ' + T('件')) +
      H.kv('已落', U.n0(M.natural()) + ' ' + T('件')) +
      H.kv('在板上', U.n0(Object.keys(M.placedSet()).length) + ' ' + T('件')) +
      H.kv('已离场', U.n0(Object.keys(S.gone || {}).length) + ' ' + T('件')) +
      H.kv('来料', M.nextIn().toFixed(0) + ' s') +
      H.kv('声誉', '+' + Math.round((BS.quests ? BS.quests.rep() : 0) * 100) + '%') +
      '</div>' +
      filters() +
      '<div class="ff">' +
      H.btn('go0', T('回到最前'), 'ghost', from === 0) +
      H.btn('back', T('往前 # 条').replace('#', PER), 'ghost', from === 0) +
      '<span class="pl">' + T('第 # 到 # 条').replace('#', U.n0(matched ? from + 1 : 0)).replace('#', U.n0(Math.min(matched, from + PER))) + '</span>' +
      H.btn('more', T('再往 # 条').replace('#', PER), 'ghost', from + PER >= matched) +
      '</div>' +
      rows() +
      '<h3 class="sub">' + U.esc(T('手上')) + '</h3>' +
      (M.sel.e
        ? '<div class="statline">' + H.kv('拿着', U.esc(M.metaOf(M.sel.e).nm)) +
          H.kv('档', I.full(P.RARITY[M.metaOf(M.sel.e).rar])) +
          H.kv('格数', U.n0(M.cellsOf(M.sel.e).length)) + '</div>' +
          '<div class="ff">' + H.btn('go:assembly', T('去组装台按空格放下它'), 'go') + '</div>'
        : '<p class="note dim">' + U.esc(T('手上是空的。随便挑一件拿上。')) + '</p>') +
      H.note(T('资质不只是更大、更碎、能带的特质更多——它换的是长相：变与超是小而强对称的现代结构，华是赛博朋克的锐角与回路，殿是巨型的极简。'));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('rar:') === 0) { rar = +a.slice(4); from = 0; msg = ''; mark(); render(); }
      else if (a.indexOf('fm:') === 0) { form = a.slice(3); from = 0; msg = ''; mark(); render(); }
      else if (a.indexOf('tr:') === 0) { trait = a.slice(3); from = 0; msg = ''; mark(); render(); }
      else if (a === 'more') { from += PER; mark(); render(); }
      else if (a === 'back') { from = Math.max(0, from - PER); mark(); render(); }
      else if (a === 'go0') { from = 0; mark(); render(); }
      else if (a.indexOf('take:') === 0) {
        M.sel.e = a.slice(5); M.sel.r = 0; msg = ''; mark(); render();
      }
      else if (a.indexOf('rec:') === 0) {
        var r = M.discard(a.slice(4));
        msg = r.ok ? T('丢掉了「#」。它不换光——光只在呈交那一刻给。').replace('#', r.nm) : r.why;
        mark(); render();
      }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  BS.reg.add({
    id: 'library', n: '1', t: '库', sub: 'STOCK',
    badge: function () { return U.n0(M.libCount()); },
    mount: function (h) { host = h; msg = ''; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  /* 别的页要带筛选跳进来（型录点一型、特质页点一种）。
     状态收在这一页的闭包里，所以由这里接——不把筛选器暴露成全局。 */
  B.on('libfilter', function (o) {
    o = o || {};
    form = o.form || '';
    trait = o.trait || '';
    if (o.rar != null) rar = o.rar;
    from = 0; msg = ''; mark();
  });
  B.on('lib', mark); B.on('body', mark); B.on('restore', mark); B.on('lux', mark); B.on('auc', mark);
})(window.BS);
