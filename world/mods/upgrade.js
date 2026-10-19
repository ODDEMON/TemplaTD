/* world/mods/upgrade.js —— 商店。
   ------------------------------------------------------------------
   这一页管两件事，两件都花**结晶**或**采集尘**，但账目分得清清楚楚：
     · **抽取**：花采集尘抽随机元件。稀有度五档权重，×1 / ×10 两档。
       **概率当场公示**（store.odds()），而且抬档的每一级都会让那条概率
       当场变——玩家能亲眼看见自己买到的是什么。显示与抽取共用同一份
       权重代码，所以那个百分比永远不是装饰。
     · **升级商店**：花结晶买全局旋钮，按「开局 / 循环 / 手感」三组排。
       开局管一局怎么开始，循环管资源怎么滚，手感管塔怎么打。
   库存与抽卡已经分家：这一页只管「花出去」，库页只管「还剩什么」。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, ST = BS.store;

  var host = null, dirty = false, offs = [];
  var msg = '', lastDraw = null;

  /* ---------- 抽取概率：一条横条 ---------- */
  function oddsBar() {
    var od = ST.odds(), out = '<div class="od">', i;
    for (i = 0; i < 5; i++) {
      var rr = P.RARITY[i], p = od.p[i], b = od.base[i];
      var moved = Math.abs(p - b) > 0.0005;
      out += '<span class="odc r' + i + (moved ? ' moved' : '') + '"' +
        ' title="' + U.esc(I.term(rr, 'full') + '：' + (p * 100).toFixed(2) + '%' +
          (moved ? '（基础 ' + (b * 100).toFixed(2) + '%）' : '')) + '">' +
        '<em>' + U.esc(I.term(rr, 't')) + '</em>' +
        '<b>' + (p * 100).toFixed(2) + '%</b>' +
        '<i style="width:' + (p * 100).toFixed(2) + '%"></i>' +
        (moved ? '<s class="up">+' + ((p - b) * 100).toFixed(2) + '</s>' : '') +
        '</span>';
    }
    out += '</div>';
    /* 光有百分比不好感知，再给一句「一百抽大概出什么」——
       概率条负责精确，这一句负责直觉，两句话说的是同一件事。 */
    var hi = (od.p[3] + od.p[4]) * 100;
    out += '<p class="note dim">' + U.esc(T('一百抽大约出 # 张华档以上（华 # + 殿 #）。概率随「高档权重」升级与成就当场变化——抽的是什么，写得明明白白。')
      .replace('#', Math.round(hi))
      .replace('#', U.n0(Math.round(od.p[3] * 100)))
      .replace('#', U.n0(Math.round(od.p[4] * 100)))) + '</p>';
    return out;
  }

  function drawBox() {
    var cost = ST.drawCost();
    return '<div class="pv">' +
      '<div class="pvhead"><b>' + U.esc(T('抽取')) + '</b>' +
      H.kvR(T('采集尘'), '<b>' + U.n0(BS.bus.state.dust) + '</b>') +
      H.kvR(T('库'), U.n0(ST.count())) + '</div>' +
      '<div class="ff">' +
      H.btnR('draw:1', T('抽取 ×1（# 采集尘）').replace('#', U.n0(cost)), 'go', BS.bus.state.dust < cost) +
      H.btnR('draw:10', T('抽取 ×10（# 采集尘）').replace('#', U.n0(cost * 10)), 'ghost', BS.bus.state.dust < cost * 10) +
      '</div>' +
      oddsBar() +
      (lastDraw ? drawResult() : '') +
      '</div>';
  }

  function drawResult() {
    var out = '<div class="dres">';
    for (var i = 0; i < lastDraw.length; i++) {
      var g = lastDraw[i], part = BS.shop.partOf(g.i), f = P.formOf(part.form);
      out += '<span class="dr r' + g.rar + '" title="' + U.esc(P.serialOf(g.i) + ' · ' + I.term(f)) + '">' +
        '<em class="rv r' + g.rar + '">' + U.esc(I.term(P.RARITY[g.rar], 't')) + '</em>' +
        U.esc(P.serialOf(g.i)) + '</span>';
    }
    return out + '</div>';
  }

  /* ---------- 升级商店：按组渲染 ---------- */
  function upRow(u) {
    var lv = BS.meta.upLv(u.id), maxed = lv >= u.max;
    var cost = BS.meta.upCost(u.id);
    return '<div class="vrow u' + lv + '">' +
      '<span class="vs">' + U.esc(I.term(u)) + '</span>' +
      '<span class="vf">' + U.esc(T(u.d)) + '</span>' +
      '<span class="vt">' + U.esc(T('层级 # / #').replace('#', lv).replace('#', u.max)) + '</span>' +
      '<span class="vc">' + (maxed
        ? H.tagR(T('已满'), 'ok')
        : H.btnR('buy:' + u.id, T('# 结晶').replace('#', U.n0(cost)),
          BS.bus.state.crystal >= cost ? 'go small' : 'ghost small', BS.bus.state.crystal < cost)) +
      '</span></div>';
  }

  function shopBox() {
    var ups = BS.metaDefs.UPGRADES, groups = BS.metaDefs.UPG_GROUPS, out = '', gi, i;
    for (gi = 0; gi < groups.length; gi++) {
      var gname = groups[gi], rows = '';
      for (i = 0; i < ups.length; i++) {
        if ((ups[i].grp || '') === gname) rows += upRow(ups[i]);
      }
      if (!rows) continue;
      out += '<div class="subhead">' + U.esc(T(gname)) + '</div>';
      out += '<div class="vtable">' + rows + '</div>';
    }
    return out;
  }

  function render() {
    if (!host) return;
    var rd = BS.meta.readings();
    var out = H.head('商店', 'SHOP',
      '花采集尘抽元件，花结晶买旋钮。概率公示、价格公示——买的是什么，一眼能看清。');
    out += '<div class="msg">' + U.esc(msg) + '</div>';
    out += '<div class="statline">' +
      H.kv('采集尘', U.n0(BS.bus.state.dust)) +
      H.kv('结晶', U.n0(BS.bus.state.crystal)) +
      H.kv('库', U.n0(ST.count())) +
      H.kv('累计抽取', rd.draws) +
      '</div>';
    out += drawBox();
    out += '<h3 class="sub">' + U.esc(T('升级商店')) + '</h3>' + shopBox();
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a === 'draw:1' || a === 'draw:10') {
        var o = ST.draw(a === 'draw:10' ? 10 : 1);
        if (o.ok) { lastDraw = o.got; msg = T('采集尘 -#。').replace('#', U.n0(o.cost)); }
        else msg = o.why;
        render(); return;
      }
      if (a.indexOf('buy:') === 0) {
        var b2 = BS.meta.buy(a.slice(4));
        msg = b2.ok ? T('升了一级。') : b2.why;
        render(); return;
      }
    });
  }

  BS.reg.add({
    id: 'shop', n: '3', t: '商店', sub: 'SHOP',
    mount: function (h) {
      host = h; dirty = false; msg = '';
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
