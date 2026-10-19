/* world/mods/meta.js —— 成就（局外成长）。
   ------------------------------------------------------------------
   七条元件成就，每条都盯着元件数据而非战斗指标：
   「用一件对称度 ≥0.8 的塔通关」是元件成就，「累计击杀 500」不是。
   前者让玩家回去把元件做得更好，后者只让玩家把塔建得更功利。

   进度把「还差什么」逐条列出来——不把「差一点」说成「快到了」。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, TD = BS.td;

  var host = null, dirty = false, offs = [];

  /* 成就页没有「本局 ctx」，用跨局读数拼一份：它回答的是「至今差多少」。 */
  function ctxOf() {
    var rd = BS.meta.readings(), m = BS.bus.state.meta, i, before = 0;
    var list = BS.metaDefs.LIST;
    for (i = 0; i < list.length; i++) {
      if (m.unlocked[list[i].id]) before++;
    }
    return {
      won: (rd.wins | 0) > 0, wave: rd.bestWaves, maxSym: rd.maxSym,
      baseHp: rd.bestHp, baseMax: TD.BASE_HP,
      chainKills: rd.chainKills, formsUsed: rd.forms, bestEs: rd.bestEs,
      maxGarEs: rd.maxGarEs, draws: rd.draws, bestWave: rd.bestWaves,
      before: before, allBefore: false
    };
  }

  function givesOf(m) {
    var out = [], g = m.gives || {};
    if (g.poolBoost) out.push(T('序号池 +#').replace('#', g.poolBoost));
    if (g.budget) out.push(T('预算 +#').replace('#', g.budget));
    if (g.dustPct) out.push(T('战斗采集尘 +#%').replace('#', g.dustPct));
    if (g.crystalPct) out.push(T('结晶收入 +#%').replace('#', g.crystalPct));
    if (g.traitLuck) for (var t in g.traitLuck) {
      out.push(T('# 特质加权').replace('#', I.term(BS.parts.TRAIT_BY[t])));
    }
    if (g.rarBoost) for (var r in g.rarBoost) out.push(T('稀有度 ×#').replace('#', g.rarBoost[r]));
    return out;
  }

  function render() {
    if (!host) return;
    var rd = BS.meta.readings(), c = ctxOf();
    var out = H.head('成就', 'META',
      '局外成长只认图形：对称度、质变度、用过的型、连锁击杀。结晶在升级商店花。');
    out += '<div class="statline">' +
      H.kv('胜场', rd.wins + ' / ' + rd.runs) +
      H.kv('最好一局', T('第 # 波').replace('#', rd.bestWaves)) +
      H.kv('最高质变度', rd.bestEs.toFixed(2)) +
      H.kv('最高对称度', rd.maxSym.toFixed(2)) +
      H.kv('花园最高', rd.maxGarEs.toFixed(2)) +
      H.kv('型收集', rd.forms + ' / 18') +
      '</div>';
    out += '<div class="ff">' + H.btn('go:shop', T('去商店花结晶'), 'go') + '</div>';

    var list = BS.metaDefs.LIST, i;
    for (i = 0; i < list.length; i++) {
      var m = list[i], got = !!BS.bus.state.meta.unlocked[m.id];
      out += '<div class="arow' + (got ? ' got' : '') + '">' +
        '<span class="amark">' + (got ? '●' : '○') + '</span>' +
        '<span class="an"><b>' + U.esc(I.term(m)) + '</b>' +
        '<em>' + U.esc(I.gloss(m)) + '</em></span>' +
        '<span class="ad">' + U.esc(T(m.d)) + '</span>' +
        '<span class="ap">' + U.esc(BS.meta.progress(m.id, c)) + '</span>' +
        '<span class="ag">' + U.esc(givesOf(m).join(' · ')) + '</span>' +
        '</div>';
    }
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('go:') === 0) BS.app.go(a.slice(3));
    });
  }

  BS.reg.add({
    id: 'meta', n: '6', t: '成就', sub: 'META',
    mount: function (h) {
      host = h; dirty = false;
      offs.push(B.on('run', function () { render(); }));
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
