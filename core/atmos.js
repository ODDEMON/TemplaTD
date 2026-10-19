/* core/atmos.js —— 氛围层与开场。
   这一层只负责「看」：开场测绘序列、光标测斑、漂浮微尘、页面转场。
   它不碰任何读数，也不进撤销栈——拆掉它，作品一项都不会变。

   三条硬约束，是从这个项目的测试里长出来的：
     · 全文档一块 canvas 都不能有（smoke.mjs 守着）——所以微尘是 div，不是粒子引擎；
     · 脚本执行期任何未捕获的抛出都会挂掉测试——所以每一段都自己兜底；
     · jsdom 里 requestAnimationFrame 是被桩掉的（只返回 0，从不回调）——
       所以测光斑的循环在无头环境里自然熄灭，不需要特判。

   两档收敛：prefs.low（低烈度）与系统 prefers-reduced-motion，
   一律退化为「没有这一层」——这一部作品对闪烁不适的人的立场一贯如此。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  function reduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function low() {
    try {
      var S = BS.bus && BS.bus.state;
      return !!(S && S.prefs && S.prefs.low);
    } catch (e) { return false; }
  }
  function seen() {
    try { return window.sessionStorage && sessionStorage.getItem('cfg.intro') === '1'; }
    catch (e) { return false; }
  }
  function markSeen() {
    try { if (window.sessionStorage) sessionStorage.setItem('cfg.intro', '1'); } catch (e) { /* 由它去 */ }
  }

  /* ---------- 漂浮微尘 ----------
     位置与节奏由确定性散列给——同一台机器上每次看到的布局一样，
     不和「随机」两个字沾边：这个作品里没有随机。 */
  function motes() {
    var box = document.getElementById('motes');
    if (!box) return;
    var n = 14, out = '', i, a, b, c;
    for (i = 0; i < n; i++) {
      a = U.at(1107, i); b = U.at(2243, i); c = U.at(3313, i);
      out += '<i class="mote' + (i % 5 === 2 ? ' v' : '') + '" style="' +
        'left:' + (a * 100).toFixed(2) + '%;' +
        'width:' + (1 + (b > 0.7 ? 1 : 0)) + 'px;height:' + (1 + (b > 0.7 ? 1 : 0)) + 'px;' +
        'animation-duration:' + (46 + c * 34).toFixed(1) + 's;' +
        'animation-delay:-' + (c * 60).toFixed(1) + 's"></i>';
    }
    box.innerHTML = out;
  }

  /* ---------- 光标测斑 ----------
     一簇跟着指针走的极淡青光。指针停了它还要溜一小段才到位——
     这一点点迟滞就是「仪器在追」的手感。触屏不进：media query 兜底。 */
  var spot = null, spotX = 0, spotY = 0, spotTX = 0, spotTY = 0, spotRaf = 0, spotOn = false;
  function spotFrame() {
    spotX += (spotTX - spotX) * 0.12;
    spotY += (spotTY - spotY) * 0.12;
    if (spot) spot.style.transform = 'translate3d(' + spotX.toFixed(1) + 'px,' + spotY.toFixed(1) + 'px,0)';
    if (Math.abs(spotTX - spotX) > 0.4 || Math.abs(spotTY - spotY) > 0.4) {
      spotRaf = requestAnimationFrame(spotFrame);
    } else { spotRaf = 0; }
  }
  function spotMove(x, y) {
    if (!spot) return;
    spotTX = x; spotTY = y;
    if (!spotOn) {
      spotOn = true;
      spotX = x; spotY = y;
      spot.style.opacity = '1';
    }
    if (!spotRaf) spotRaf = requestAnimationFrame(spotFrame);
  }
  function bindSpot() {
    spot = document.getElementById('spot');
    if (!spot) return;
    try {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        spotMove(e.clientX, e.clientY);
      }, { passive: true });
      document.addEventListener('mouseleave', function () {
        if (spot) spot.style.opacity = '0';
        spotOn = false;
      });
    } catch (e) { /* 由它去 */ }
  }

  /* ---------- 开场：测绘校准 ----------
     一次会话只演一次（sessionStorage）。低烈度 / 减少动效 / 看过了：
     节点直接拔掉，不演。任何点击或按键都可以跳过。 */
  var bootEl = null, bootTimer = 0, bootOut = 0;
  function bootSVG() {
    var ticks = '', i, a;
    for (i = 0; i < 12; i++) {
      a = i * 30;
      ticks += '<line class="dr d5" pathLength="100" x1="' + (60 + 44 * Math.cos(a * Math.PI / 180)).toFixed(2) +
        '" y1="' + (60 + 44 * Math.sin(a * Math.PI / 180)).toFixed(2) +
        '" x2="' + (60 + 52 * Math.cos(a * Math.PI / 180)).toFixed(2) +
        '" y2="' + (60 + 52 * Math.sin(a * Math.PI / 180)).toFixed(2) + '"/>';
    }
    var diag = '', q;
    for (q = 0; q < 4; q++) {
      a = 45 + q * 90;
      diag += '<line class="dr d4" pathLength="100" x1="' + (60 + 33 * Math.cos(a * Math.PI / 180)).toFixed(2) +
        '" y1="' + (60 + 33 * Math.sin(a * Math.PI / 180)).toFixed(2) +
        '" x2="' + (60 + 44 * Math.cos(a * Math.PI / 180)).toFixed(2) +
        '" y2="' + (60 + 44 * Math.sin(a * Math.PI / 180)).toFixed(2) + '"/>';
    }
    return '<svg class="bootem" viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="dr d1" pathLength="100" cx="60" cy="60" r="52"/>' +
      '<circle class="dr d3" pathLength="100" cx="60" cy="60" r="40"/>' +
      ticks + diag +
      '<path class="dr d2" pathLength="100" d="M60 8V24M60 96V112M8 60H24M96 60H112"/>' +
      '<path class="dr d4" pathLength="100" d="M52 60H68M60 52V68"/>' +
      '<circle class="dt" cx="60" cy="60" r="3"/>' +
      '</svg>';
  }
  function bootBody() {
    var T = BS.ui && BS.ui.T ? BS.ui.T : function (x) { return x; };
    var seq = 0;
    try { seq = BS.bus.state.seq | 0; } catch (e) { /* 由它去 */ }
    var ep = '';
    try { ep = T('两条规则，一支笔，一张没有边界的图纸。'); }
    catch (e) { ep = ''; }
    var log = [
      'GRID · 26 PX · LOCKED',
      'UPSTREAM · LIVE',
      'SEED · ' + seq,
      'DETERMINISM · ON'
    ], i, out = '';
    for (i = 0; i < log.length; i++) out += '<span style="animation-delay:' + (0.55 + i * 0.28).toFixed(2) + 's">' + U.esc(log[i]) + '</span>';
    return '<div class="bootin">' +
      '<i class="boottag">CALIBRATION</i>' +
      bootSVG() +
      /* 品牌字是标记，不译——与顶栏的「构形」一致，四种语言都照留 */
      '<div class="bootti"><b>构形</b><span>CONFIGURA</span></div>' +
      (ep ? '<p class="bootep">' + U.esc(ep) + '</p>' : '') +
      '<div class="bootlog">' + out + '</div>' +
      '<div class="bootbar"><u></u></div>' +
      '</div>';
  }
  function killBoot() {
    if (bootTimer) { clearTimeout(bootTimer); bootTimer = 0; }
    if (bootOut) { clearTimeout(bootOut); bootOut = 0; }
    if (bootEl && bootEl.parentNode) bootEl.parentNode.removeChild(bootEl);
    bootEl = null;
    try { window.removeEventListener('pointerdown', skipBoot); window.removeEventListener('keydown', skipBoot); }
    catch (e) { /* 由它去 */ }
  }
  function skipBoot() {
    if (!bootEl) return;
    markSeen();
    if (bootEl.classList.contains('out')) { killBoot(); return; }
    bootEl.classList.add('out');
    bootOut = setTimeout(killBoot, 420);
  }
  function startBoot() {
    bootEl = document.getElementById('boot');
    if (!bootEl) return;
    if (low() || reduced() || seen()) { killBoot(); return; }
    bootEl.innerHTML = bootBody();
    bootEl.hidden = false;
    /* 强制重排，让 transition / animation 从初始态开始跑 */
    try { void bootEl.offsetWidth; } catch (e) { /* 由它去 */ }
    bootEl.classList.add('go');
    try {
      window.addEventListener('pointerdown', skipBoot);
      window.addEventListener('keydown', skipBoot);
    } catch (e) { /* 由它去 */ }
    bootTimer = setTimeout(skipBoot, 2600);
  }

  /* ---------- 页面转场 ----------
     换页时正文做一次极短的「上浮」，页头顶过一道扫描线。
     只动 transform / opacity，不碰布局。 */
  function pageIn() {
    try {
      var p = document.getElementById('panel');
      if (p) { p.classList.remove('pv'); void p.offsetWidth; p.classList.add('pv'); }
      var m = document.getElementById('main');
      if (m) { m.classList.remove('swp'); void m.offsetWidth; m.classList.add('swp'); }
    } catch (e) { /* 由它去 */ }
  }

  function start() {
    try {
      if (reduced()) return;          /* 减少动效：整层不装 */
      motes();
      if (!low()) bindSpot();
      startBoot();
    } catch (e) { /* 氛围层坏了也不耽误玩 */ }
  }

  BS.atmos = { start: start, pageIn: pageIn, motes: motes, bindSpot: bindSpot, reduced: reduced, low: low };
})(window.BS);
