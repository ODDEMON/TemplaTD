/* core/app.js —— 装配：导航、顶栏、时钟。
   ------------------------------------------------------------------
   这一版最重要的一条：**每进一页就新建一个容器**。
   上一版把同一个 #panel 交给所有界面，于是离场的界面还在往里重画，
   玩家在战场上看到建造台——那是这一部上一次翻车的根因。
   现在 host 是逐页新建、逐页丢弃的，结构上不可能再互相覆盖。

   时钟也只叫当前那一页。离场的界面不该再被驱动。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, I = BS.i18n, H = BS.ui, T = H.T;

  var cur = null, curBox = null, clock = null;

  /* ---------- 顶栏：三资源 + 哪一阶段 ---------- */
  function hud() {
    var r = BS.run.current(), out = '';
    out = H.kv('采集尘', '<b>' + U.n0(BS.bus.state.dust) + '</b>') +
      H.kv('结晶', '<b>' + U.n0(BS.bus.state.crystal) + '</b>') +
      /* 阅历是第四本账：**只喂重塑树**。它挂在顶栏是因为「这一局能记下多少」
         与「我还剩多少」是同一个问题的两面——但它的闸门与结晶完全分开。 */
      H.kv('阅历', '<b>' + U.n0(BS.bus.state.meta.exp | 0) + '</b>') +
      H.kv('库', U.n0(BS.store.count()));
    /* 顶栏带上阵型的一个读数：质变度。它放在这里而不是只在战场，
      是为了让「我摆了个什么形状」与「这一局」始终在同一个画面上
      ——它们本来就是同一个系统。 */
    if (r && r.battle && r.battle.flux && r.battle.flux.form) {
      out += H.kv('阵型', U.fmt(r.battle.flux.form.esScore, 2));
    }
    if (r) {
      if (r.phase === 'deploy') {
        out += H.kv('阶段', T('部署')) +
          H.kv('剩余预算', U.n0(BS.run.left(r)) + ' / ' + U.n0(BS.build.budget())) +
          H.kv('已部署', U.n0(r.deployed.length));
      } else {
        var b = r.battle;
        out += H.kv('阶段', r.phase === 'battle' ? T('战斗') : (r.phase === 'rest' ? T('休整') : T('已结算'))) +
          H.kv('波次', b.wave) +
          H.kv('基地', Math.max(0, b.baseHp) + ' / ' + BS.td.BASE_HP) +
          H.kv('辉光', U.n0(b.lux));
      }
    } else {
      out += H.kv('阶段', T('不在局中'));
    }
    return out;
  }

  function renderTop() {
    var el = document.getElementById('hud');
    if (el) el.innerHTML = hud();
    var tk = document.getElementById('ticker');
    if (tk) {
      var lg = B.state.log, last = lg.length ? lg[lg.length - 1] : null;
      tk.textContent = last ? last.m : T('图形即防事。');
    }
  }

  /* ---------- 导航 ---------- */
  function rail() {
    var el = document.getElementById('rail');
    if (!el) return;
    var out = '', list = BS.reg.list(), i;
    for (i = 0; i < list.length; i++) {
      out += '<button class="rn' + (list[i].id === (cur && cur.id) ? ' on' : '') +
        '" data-go="' + list[i].id + '"><span class="rn-n">' + U.esc(list[i].n) + '</span>' +
        '<span class="rn-t">' + U.esc(T(list[i].t)) + '</span></button>';
    }
    el.innerHTML = out;
    var bs = el.querySelectorAll('[data-go]');
    for (var j = 0; j < bs.length; j++) {
      bs[j].addEventListener('click', function () { go(this.getAttribute('data-go')); });
    }
  }

  /* 进一页：先送走旧的，再给新的一页一个**全新的**容器。 */
  function go(id) {
    var m = BS.reg.get(id);
    if (!m) return;
    if (cur && cur.unmount) { try { cur.unmount(); } catch (e) { /* 由它去 */ } }
    var panel = document.getElementById('panel');
    if (!panel) return;
    panel.innerHTML = '';
    curBox = document.createElement('div');
    curBox.className = 'page';
    panel.appendChild(curBox);
    cur = m;
    try { m.mount(curBox); } catch (e) {
      curBox.innerHTML = '<div class="empty">这一页挂了：' + U.esc(e.message) + '</div>';
    }
    rail();
    renderTop();
    /* 换页转场：只动 transform / opacity，不碰布局。
       重挂一次类名，让新一页的前几块错峰上浮（battle 的骨架重搭不走这里）。 */
    try {
      panel.classList.remove('pv');
      void panel.offsetWidth;
      panel.classList.add('pv');
    } catch (e) { /* 由它去 */ }
  }

  /* ---------- 初始化 ---------- */
  function init() {
    B.load();
    var p = B.state.prefs;
    BS.eff.setCalm(!!(p && p.calm));
    /* 语言：存档里带着偏好，启动时落上去。
       词典是 world 层注册的（core 先加载、world 后加载），到这一步已经在了。 */
    I.init(p && p.lang);
    /* 语言切换是全页面事件：**重进当前页**就是最彻底的「当场生效」——
       十二页的每一处 T() 都会在重画时重新取词，不需要每页各订一份。 */
    B.on('lang', function () {
      rail(); renderTop();
      if (cur) go(cur.id);
    });
    /* 起手页是**工坊**，不是别的什么上层结构。
       先学会做图形，再把它送进战场、摆成阵型——这个顺序才是对的。 */
    var start = BS.reg.get('forge') || BS.reg.list()[0];
    if (start) go(start.id); else rail();

    if (clock) clearInterval(clock);
    clock = setInterval(function () {
      /* 只叫当前这一页。离场的界面不该再被驱动。 */
      if (cur && cur.tick) { try { cur.tick(100); } catch (e) { /* 由它去 */ } }
      renderTop();
    }, 100);

    /* 顶栏只留冷静模式——它是随时要按的播放开关。
       「存档」与「重置」搬去设置页了：一处一个家，重置也不再是一颗
       埋在别处的红按钮（详见 world/mods/settings.js 的头注释）。 */
    var calm = document.getElementById('btnCalm');
    if (calm) {
      calm.textContent = BS.eff.isCalm() ? T('冷静 开') : T('冷静 关');
      calm.addEventListener('click', function () {
        BS.eff.setCalm(!BS.eff.isCalm());
        B.state.prefs.calm = BS.eff.isCalm() ? 1 : 0;
        calm.textContent = BS.eff.isCalm() ? T('冷静 开') : T('冷静 关');
        B.save();
      });
    }
  }

  BS.app = { init: init, go: go, renderTop: renderTop, rail: rail, now: function () { return cur; } };

  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(window.BS);
