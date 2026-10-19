/* world/mods/record.js —— 记录。
   你动过的每一次手，按次序排在这里。装、拆、转、回收、撤销、点亮、签收、点亮，
   全都记一笔。留最近五千条，够你翻回去看刚才干了什么。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, H = BS.ui, A = BS.achieve, T = H.T;

  var host = null, dirty = true, show = 200;
  var KINDS = { add: '装', rm: '拆', move: '挪', spin: '转', undo: '撤', recycle: '弃', tree: '亮', quest: '务', ach: '成', auc: '拍', sys: '·' };
  function mark() { dirty = true; }

  function render() {
    var n = S.log.length, out = '', i, from = Math.max(0, n - show);
    for (i = n - 1; i >= from; i--) {
      var e = S.log[i];
      out += '<div class="lg k-' + U.esc(e.k) + '">' +
        '<span class="lt">' + U.n0(e.n) + '</span>' +
        '<span class="lk">' + U.esc(T(KINDS[e.k] || e.k || '·')) + '</span>' +
        '<span class="lm">' + U.esc(e.m) + '</span></div>';
    }
    host.innerHTML =
      H.head('记录', 'RECORD',
        T('你动过的每一次手。留最近 # 条，够你翻回去看刚才干了什么。').replace('#', U.n0(B.LOGCAP))) +
      '<div class="statline">' +
      H.kv('总动手', U.n0(S.seq)) +
      H.kv('装上', U.n0(S.stat.placed)) +
      H.kv('拆除', U.n0(S.stat.removed)) +
      H.kv('转向', U.n0(S.stat.spun)) +
      H.kv('平移', U.n0(S.stat.moved)) +
      H.kv('丢弃', U.n0(S.stat.recycled)) +
      H.kv('成交', U.n0((S.auc || {}).n)) +
      H.kv('撤销', U.n0(S.stat.undone)) +
      H.kv('脉络', U.n0(BS.tree.mods().nodes)) +
      H.kv('命题', U.n0(S.quest ? S.quest.done : 0)) +
      H.kv('判定', U.n0(A.count())) +
      H.kv('记录条数', U.n0(n)) +
      '</div>' +
      '<div class="ff">' +
      [50, 200, 1000, 5000].map(function (k) {
        return H.btn('show:' + k, T('最近 #').replace('#', k), show === k ? 'on' : 'ghost');
      }).join('') +
      '</div>' +
      (n
        ? '<div class="logs">' + out + '</div>' +
          (n > show ? '<p class="note dim">' + T('上面只画了最近 # 条。').replace('#', U.n0(show)) + '</p>' : '')
        : H.empty(T('还什么都没做。去库里拿一件。')));
    bind();
  }

  function bind() {
    U.act(host, function (a) {
      if (a.indexOf('show:') === 0) { show = +a.slice(5); mark(); render(); }
    });
  }

  BS.reg.add({
    id: 'record', n: '10', t: '记录', sub: 'RECORD',
    mount: function (h) { host = h; render(); },
    tick: function () { if (host && dirty) { dirty = false; render(); } }
  });
  B.on('log', mark); B.on('restore', mark);
})(window.BS);
