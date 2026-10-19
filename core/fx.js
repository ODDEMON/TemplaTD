/* core/fx.js —— 表现层的独奏。
   ------------------------------------------------------------------
   只有一件事：**进化塌缩**。提交那一刻，把板上的整具图形收拢成
   一颗单格炮塔——「形状即塔」这句话唯一的高光一秒。

   这一层不碰任何判定，也不改任何存档：它只读 rec.cells 把它画出来。
   三处收敛，缺一条就是「有人被动画挡住了」：
     · 系统 prefers-reduced-motion：不演；
     · 冷静模式（prefs.calm）：不演——那一档本来就是为了少看动的东西；
     · 没有 body（无头环境 / 极端情况）：不演。
   全部包在 try 里：动画失败绝不能连累提交流程。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }
  function calm() {
    try { var p = BS.bus && BS.bus.state && BS.bus.state.prefs; return !!(p && p.calm); }
    catch (e) { return false; }
  }

  /* rec 是 shop.submit() 交回来的那条记录（cells / rar / nm）。
     格子是 [i, j]，j 向上；画的时候翻成屏幕坐标（y = maxJ - j）。 */
  function collapse(rec) {
    try {
      if (!rec || !rec.cells || !rec.cells.length) return;
      if (!document.body || reduced() || calm()) return;
      var cs = rec.cells, i, minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
      for (i = 0; i < cs.length; i++) {
        if (cs[i][0] < minI) minI = cs[i][0];
        if (cs[i][0] > maxI) maxI = cs[i][0];
        if (cs[i][1] < minJ) minJ = cs[i][1];
        if (cs[i][1] > maxJ) maxJ = cs[i][1];
      }
      var w = maxI - minI + 1, h = maxJ - minJ + 1;
      var rects = '';
      for (i = 0; i < cs.length; i++) {
        rects += '<rect x="' + cs[i][0] + '" y="' + (maxJ - cs[i][1]) + '" width="1" height="1"/>';
      }
      var el = document.createElement('div');
      el.className = 'collapse';
      el.innerHTML = '<div class="cfig">' +
        '<svg viewBox="' + (minI - 1) + ' -1 ' + (w + 2) + ' ' + (h + 2) + '" aria-hidden="true">' +
        '<g class="cf r' + ((rec.rar | 0) || 0) + '">' + rects + '</g></svg>' +
        '<i class="cring"></i>' +
        '<b class="cname">' + U.esc(rec.nm || '') + '</b>' +
        '</div>';
      document.body.appendChild(el);
      setTimeout(function () {
        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) { /* 由它去 */ }
      }, 1180);
    } catch (e) { /* 动画坏了也不许挡住提交 */ }
  }

  BS.fx = { collapse: collapse };
})(window.BS);
