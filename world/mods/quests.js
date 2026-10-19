/* world/mods/quests.js —— 命题。
   三条同时挂着，完成一条补一条。目标一律不看格数——看的是质变指标、
   特质、型、资质和结构特征。进度条实时走，达成了就点「签收」。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, Q = BS.quests, T = H.T, I = BS.i18n;

  var host = null, dirty = true, msg = '';
  function mark() { dirty = true; }

  function bar(p) {
    var w = Math.round(U.clamp(p, 0, 1) * 100);
    return '<div class="qb' + (p >= 1 ? ' full' : '') + '"><i style="width:' + w + '%"></i>' +
      '<em>' + w + '%</em></div>';
  }

  function card(item) {
    var d = item.def;
    return '<div class="qc' + (item.done ? ' done' : '') + '">' +
      '<div class="qch">' +
      '<span class="qk">' + U.esc(T(d.kt)) + '</span>' +
      '<span class="qn">#' + U.n0(d.qi + 1) + '</span>' +
      (d.lv ? '<span class="ql">' + T('难度 #').replace('#', d.lv + 1) + '</span>' : '') +
      '<span class="qp">' + U.esc(T('声誉')) + ' +' + Math.round(Q.REP_STEP * 100) + '%</span>' +
      '</div>' +
      '<div class="qs">' + U.esc(I.tell(d.say)) + '</div>' +
      '<div class="qh">' + U.esc(I.tell(item.hint)) + '</div>' +
      bar(item.p) +
      '<div class="ff">' +
      (item.done
        ? H.btn('claim:' + d.id, T('签收'), 'go')
        : H.btn('reroll:' + d.id, T('换一条（# 光）').replace('#', U.big(Q.rerollCost())), 'ghost small')) +
      '</div>' +
      '</div>';
  }

  function peekBlock() {
    var mods = BS.tree.mods();
    if (!mods.peek) {
      return H.note(T('点亮「识」这条脉络，就能提前看到接下来会派什么命题。'));
    }
    var list = Q.peek(mods.peekN), out = '', i;
    for (i = 0; i < list.length; i++) {
      out += '<div class="pk"><span class="qk">' + U.esc(T(list[i].kt)) + '</span>' +
        '<span>' + U.esc(I.tell(list[i].say)) + '</span></div>';
    }
    return '<h3 class="sub">' + U.esc(T('接下来')) + '</h3><div class="pks">' + out + '</div>';
  }

  function render() {
    var items = Q.progress(M);
    var q = Q.st();
    var mods = BS.tree.mods();
    var ready = 0, i;
    for (i = 0; i < items.length; i++) if (items[i].done) ready++;

    var cards = '';
    for (i = 0; i < items.length; i++) cards += card(items[i]);

    host.innerHTML =
      H.head('命题', 'QUESTS',
        T('三条同时挂着，完成一条补一条。目标不看格数——看的是质变指标、特质、型、资质和结构。命题不给光：它给的是声誉，声誉抬的是你下一具图形的成交价。').replace('#', Q.REP_EVERY)) +
      '<div class="msg">' + U.esc(msg) + '</div>' +
      '<div class="statline">' +
      H.kv('可领', U.n0(ready) + ' ' + T('条')) +
      H.kv('已完成', U.n0(q.done) + ' ' + T('条')) +
      H.kv('声誉', '+' + Math.round(Q.rep() * 100) + '%') +
      H.kv('声誉上限', '+' + Math.round(Q.REP_CAP * 100) + '%') +
      H.kv('下一次涨声誉', T('再做 # 条').replace('#', Q.REP_EVERY - (q.done % Q.REP_EVERY))) +
      H.kv('换一条', U.big(Q.rerollCost()) + ' ' + T('光')) +
      '</div>' +
      (ready ? '<div class="rdy">' + U.esc(T('有 # 条命题已达成，点「签收」把声誉收走。').replace('#', ready)) + '</div>' : '') +
      '<div class="qcs">' + cards + '</div>' +
      '<h3 class="sub">' + U.esc(T('当前的质变读数')) + '</h3>' +
      essBlock() +
      peekBlock() +
      H.note(T('卡在某一条上就换掉它，换命题要花光，越往后越贵。命题的难度每 # 条爬一级，所以别指望一直轻松。').replace('#', 6));
    bind();
  }

  /* 六项指标的当前读数：命题大多是冲着它们去的，所以直接摊在这里 */
  function essBlock() {
    var st = M.stats(), e = st.es || {}, out = '', i, defs = BS.essence.DEFS;
    for (i = 0; i < defs.length; i++) {
      var v = e[defs[i].k] || 0;
      var g = BS.essence.grade(v);
      out += '<div class="es"><span class="est">' + U.esc(I.term(defs[i])) + '</span>' +
        '<span class="esb"><i style="width:' + Math.round(v * 100) + '%"></i></span>' +
        '<span class="esv">' + v.toFixed(3) + '</span>' +
        '<span class="esg g' + g.i + '">' + U.esc(I.term(g)) + '</span></div>';
    }
    out += '<div class="es tot"><span class="est">' + U.esc(T('质变度')) + '</span>' +
      '<span class="esb"><i style="width:' + Math.round((e.score || 0) * 100) + '%"></i></span>' +
      '<span class="esv">' + (e.score || 0).toFixed(3) + '</span>' +
      '<span class="esg">' + U.esc(T('六项加权几何平均')) + '</span></div>';
    return '<div class="ess">' + out + '</div>';
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('claim:') === 0) {
        var r = Q.claim(a.slice(6), M);
        if (r.ok) {
          msg = (r.rep ? T('声誉 +#%，下一具会更好卖。').replace('#', Math.round(r.rep * 100))
                       : T('领了。这一条没到涨声誉的档上。'));
        } else msg = r.why;
        mark(); render();
      }
      else if (a.indexOf('reroll:') === 0) {
        var r2 = Q.reroll(a.slice(7), M);
        if (r2.ok) msg = T('换了一条，花 # 光。').replace('#', U.big(r2.cost));
        else msg = r2.why;
        mark(); render();
      }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  /* 进度每拍都在动。但整页重建会把滚动位置弹回顶部，
     所以这里只就地改数字与进度条宽度，结构不动。 */
  function patch() {
    if (!host) return;
    var items = Q.progress(M), i, j;
    var cards = host.querySelectorAll('.qc');
    if (cards.length !== items.length) { render(); return; }
    var ready = 0;
    for (i = 0; i < items.length; i++) {
      if (items[i].done) ready++;
      var c = cards[i];
      var qh = c.querySelector('.qh'), hintTxt = I.tell(items[i].hint);
      if (qh && qh.textContent !== hintTxt) qh.textContent = hintTxt;
      var qb = c.querySelector('.qb'), fill = qb ? qb.querySelector('i') : null, em = qb ? qb.querySelector('em') : null;
      var w = Math.round(U.clamp(items[i].p, 0, 1) * 100);
      if (fill) fill.style.width = w + '%';
      if (em && em.textContent !== w + '%') em.textContent = w + '%';
      if (qb) qb.classList.toggle('full', items[i].done);
      c.classList.toggle('done', items[i].done);
      /* 达成了就把「换一条」换成「签收」——只在状态翻转时动一次 DOM */
      var claim = c.querySelector('[data-act^="claim:"]');
      if (items[i].done && !claim) render();
      else if (!items[i].done && claim) render();
    }
    /* 顶部的「可领」计数 */
    var kv = host.querySelectorAll('.kv .v');
    if (kv[0]) U.setText(kv[0], U.n0(ready) + ' ' + T('条'));
    /* 质变读数。列顺序跟着 DEFS 走，末尾那一列是合成分——
       不写死五个键，加指标时这里不用跟着改。 */
    var st = M.stats(), e = st.es || {}, defs = BS.essence.DEFS;
    var map = [], j2;
    for (j2 = 0; j2 < defs.length; j2++) map.push(e[defs[j2].k] || 0);
    map.push(e.score || 0);
    var esRows = host.querySelectorAll('.es');
    for (j = 0; j < esRows.length && j < map.length; j++) {
      var v = map[j] || 0;
      var f = esRows[j].querySelector('i');
      var vv = esRows[j].querySelector('.esv');
      if (f) f.style.width = Math.round(v * 100) + '%';
      if (vv) U.setText(vv, v.toFixed(3));
    }
  }

  BS.reg.add({
    id: 'quests', n: '3', t: '命题', sub: 'PROPOSITIONS',
    badge: function () { var n = Q.readyCount(); return n ? '!' + n : ''; },
    mount: function (h) { host = h; msg = ''; render(); },
    tick: function () {
      if (!host) return;
      if (dirty) { dirty = false; render(); return; }
      patch();
    }
  });
  B.on('body', mark); B.on('quest', mark); B.on('restore', mark); B.on('lux', mark);
})(window.BS);
