/* core/util.js —— 散列、数字格式、DOM 委托。
   委托一律认 data-act；同一个容器重复绑定会顶掉上一次绑定。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  function hash(i) {
    var x = (i | 0) * 2654435761;
    x = ((x >>> 16) ^ x) * 0x45d9f3b;
    x = ((x >>> 16) ^ x) >>> 0;
    return x / 4294967296;
  }
  function at(seed, i) { return hash((seed | 0) * 7919 + (i | 0) * 104729); }

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* 数字：整数部分千分位，小数位按量级自动给 */
  function fmt(x, d) {
    if (x == null || !isFinite(x)) return '—';
    var neg = x < 0, a = Math.abs(x);
    if (a >= 1e9) return (neg ? '-' : '') + a.toExponential(2).replace('e+', 'e');
    var s = d == null ? (a >= 1000 ? 0 : a >= 100 ? 1 : 2) : d;
    var parts = a.toFixed(s).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }
  function n0(x) { return fmt(x, 0); }

  /* 大数：一千以内原样，一千以上用后缀，表用完了才上科学记数。
     光的数目会随脉络一路涨上去，读数得一直看得懂。
     注意：这一段不能有「一百万以内加千分位」的中间档——那个分支会把后缀
     整段遮住（1000 会被印成 "1,000" 而不是 "1.00K"），后缀表就成了死代码。 */
  var SUFFIX = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
  function big(x) {
    x = Number(x);
    if (!isFinite(x)) return '∞';
    var neg = x < 0, a = Math.abs(x), s;
    if (a < 1000) {
      s = (a < 10 && a % 1 !== 0) ? (Math.round(a * 10) / 10).toFixed(1) : String(Math.round(a));
      return (neg ? '-' : '') + s;
    }
    /* 用循环整除，不用 Math.log——对数在 1e6、1e9 这种整数幂上有浮点误差，
       会把 1e6 判成 K 档。 */
    var v = a, i = -1;
    while (v >= 1000 && i < SUFFIX.length) { v /= 1000; i++; }
    if (i >= 0 && i < SUFFIX.length) {
      s = v < 10 ? v.toFixed(2) : (v < 100 ? v.toFixed(1) : v.toFixed(0));
      return (neg ? '-' : '') + s + SUFFIX[i];
    }
    return (neg ? '-' : '') + a.toExponential(2).replace('e+', 'e');
  }

  function act(root, fn) {
    if (!root) return;
    if (root.__actFn) root.removeEventListener('click', root.__actFn);
    var h = function (e) {
      var t = e.target;
      while (t && t !== root) {
        if (t.getAttribute && t.getAttribute('data-act')) { fn(t.getAttribute('data-act'), t, e); return; }
        t = t.parentNode;
      }
    };
    root.addEventListener('click', h);
    root.__actFn = h;
  }
  function qa(root, s) { return root ? Array.prototype.slice.call(root.querySelectorAll(s)) : []; }
  function setText(node, txt) { if (node && node.textContent !== txt) node.textContent = txt; }

  function dur(ms) {
    ms = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
    function p2(x) { return (x < 10 ? '0' : '') + x; }
    return h ? h + ':' + p2(m) + ':' + p2(s) : m + ':' + p2(s);
  }
  function longDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    /* 单位名归语言层管。以前这里是 d + ' 天 ' + h + ' 时' 这样拼的，
       拼出来的串查不到词条，英文界面上就留着「天」「时」「分」。 */
    var F = BS.i18n.fill;
    if (d) return F('# 天 # 时', d, h);
    if (h) return F('# 时 # 分', h, m);
    if (m) return F('# 分', m);
    return F('# 秒', sec);
  }

  BS.util = {
    hash: hash, at: at, clamp: clamp, lerp: lerp, esc: esc, fmt: fmt, n0: n0, big: big,
    act: act, qa: qa, setText: setText, dur: dur, longDur: longDur
  };
})(window.BS);
