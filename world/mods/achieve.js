/* world/mods/achieve.js —— 判定。
   手写，每一条都有个说得出口的名字和一句看得懂的条件。
   （条数由 core/achieve.js 的 LIST 决定，页面上的数字从那儿取，不写死。）
   一次性点亮：成立了就记进存档，不会因为你拆掉一格而灭掉。
   它不直接给光——光只在呈交那一刻给。它换的是声誉：
   成立过的每一条，都会把下一具图形的成交价往上抬一点。
   难度是故意拔高的——玩很久偶尔蹦出一条，那条才值钱。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, A = BS.achieve, T = H.T;

  var host = null, dirty = true, cat = '', only = 0;
  function mark() { dirty = true; }

  function rows() {
    var out = '', i, a;
    var live = {};
    (function () { var m = A.marks(M), z; for (z = 0; z < m.length; z++) live[m[z]] = 1; })();
    var shown = 0;
    for (i = 0; i < A.LIST.length; i++) {
      a = A.LIST[i];
      if (cat && a.cat !== cat) continue;
      var got = A.unlocked(a.id);
      /* only=1 只看已成立；only=2 只看当前图形正满足但还没成立的（差一步的那种） */
      if (only === 1 && !got) continue;
      if (only === 2 && !(live[a.id] && !got)) continue;
      shown++;
      out += '<div class="ar' + (got ? ' on' : (live[a.id] ? ' hot' : '')) + '">' +
        '<span class="ai">' + (got ? '★' : (live[a.id] ? '◉' : '○')) + '</span>' +
        '<span class="ac">' + U.esc(T(a.cat)) + '</span>' +
        '<span class="at2">' + U.esc(T(a.t)) + '</span>' +
        '<span class="ad">' + U.esc(T(a.d)) + '</span>' +
        '<span class="ap">' + (got ? T('已成立') : U.big(a.pay) + ' ' + T('鉴赏价')) + '</span>' +
        '</div>';
    }
    if (!out) out = H.empty(T('这一段里没有条目。'));
    return { html: '<div class="ars">' + out + '</div>', shown: shown };
  }

  function render() {
    var r = rows();
    var got = A.count(), tot = A.LIST.length;
    /* 条数从LIST.length 取，不写死「七十二」——上一次它就写着七十二条，
       实际已经八十六条了。宁可让数字自己说话，也不要一句撒谎的定数。*/
    var cats = '<div class="voices">' + H.btn('c:', T('全部'), cat === '' ? 'on' : 'ghost');
    var gs = A.groups(), i;
    for (i = 0; i < gs.length; i++) {
      cats += H.btn('c:' + gs[i], T(gs[i]), cat === gs[i] ? 'on' : 'ghost');
    }
    cats += '</div>';

    host.innerHTML =
      H.head('判定', 'VERDICTS',
        tot + T('条，手写。成立了就记进存档，拆掉一格也不会灭。它不直接给光——它换的是声誉，声誉抬的是下一具的成交价。')) +
      '<div class="statline">' +
      H.kv('已成立', U.n0(got) + ' / ' + tot) +
      H.kv('完成率', Math.round(got / tot * 100) + '%') +
      H.kv('累计挣到', U.big(S.luxTotal) + ' ' + T('光')) +
      H.kv('手上的光', U.big(S.lux)) +
      '</div>' +
      '<div class="abar"><i style="width:' + (got / tot * 100).toFixed(1) + '%"></i></div>' +
      '<div class="ff">' +
      H.btn('only:0', T('看全部'), only === 0 ? 'on' : 'ghost') +
      H.btn('only:1', T('只看已成立'), only === 1 ? 'on' : 'ghost') +
      H.btn('only:2', T('只看差一步的'), only === 2 ? 'on' : 'ghost', undefined,
        T('当前图形已经满足、但还没成立的——通常是刚成立完又拆了一格的那种')) +
      '</div>' +
      cats +
      r.html +
      H.note(T('○ 还没成立　◉ 当前图形已经满足（下一拍就会成立）　★ 已成立。绝大多数条目要你真正把结构做出名堂，不是装够件数就行。'));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('only:') === 0) { only = +a.slice(5); mark(); render(); }
      else if (a.indexOf('c:') === 0) { cat = a.slice(2); mark(); render(); }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
    });
  }

  BS.reg.add({
    id: 'achieve', n: '9', t: '判定', sub: 'VERDICTS',
    badge: function () { return U.n0(A.count()); },
    mount: function (h) { host = h; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('body', mark); B.on('restore', mark); B.on('ach', mark); B.on('lux', mark);
})(window.BS);
