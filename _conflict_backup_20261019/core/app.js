<<<<<<< HEAD
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
=======
/* core/app.js —— 总台。
   这一版有东西会自己发生了：库在落件，自动装配在装（如果开着），
   判定每一拍扫一次——所以你装到一半突然蹦出一条，那是真的达成了。
   一秒一跳的钟只做三件事：刷 HUD、扫判定、跑自动装配。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, S = B.state, M = BS.rig, P = BS.parts, Bd = BS.body, T = BS.ui.T;

  var cur = 'assembly', host = null, rail = null, ticker = null, timer = 0, langbar = null;
  var autoAcc = 0;                 /* 自动装配的计时器 */
  var toast = [];                  /* 判定提示，显示几秒后自己消失 */
  function $(id) { return document.getElementById(id); }

  function nav() {
    var list = BS.reg.list(), out = '', i;
    for (i = 0; i < list.length; i++) {
      var m = list[i], badge = '';
      if (m.badge) { try { badge = m.badge() || ''; } catch (e) { badge = ''; } }
      out += '<button class="nb' + (m.id === cur ? ' on' : '') + '" data-act="' + U.esc(m.id) + '">' +
        '<span class="nn">' + U.esc(m.n) + '</span>' +
        '<span class="nt">' + U.esc(T(m.t)) + '</span>' +
        '<span class="ns">' + U.esc(m.sub) + '</span>' +
        (badge ? '<span class="nbadge">' + U.esc(badge) + '</span>' : '') + '</button>';
    }
    rail.innerHTML = out;
    U.act(rail, function (a) { go(a); });
  }

  /* 估价：这一具此刻能拍出多少。HUD 每秒都要读它，所以按「动手次数 + 格数」缓存。 */
  var _bid = 0, _bidKey = '';
  function bidNow() {
    if (!BS.auction) return 0;
    var key = (S.seq | 0) + ':' + Bd.n(M.body()) + ':' + (BS.tree ? (BS.tree.mods().nodes | 0) : 0);
    if (key === _bidKey) return _bid;
    var v = 0;
    try { v = BS.auction.eval(M).total || 0; } catch (e) { v = 0; }
    _bid = v; _bidKey = key;
    return v;
  }

  /* HUD：光是主读数，估价紧随其后——一个是你已经到手的，一个是板上正在长的 */
  function facts() {
    var st = M.stats();
    return [
      { k: 'lux', t: T('光'), f: function () { return U.big(S.lux); }, big: 1 },
      { k: 'es', t: T('质变度'), f: function () { return st.esScore.toFixed(3); }, big: 1 },
      { k: 'n', t: T('格'), f: function () { return U.n0(st.n); } },
      { k: 'lib', t: T('库里'), f: function () { return U.n0(M.libCount()); } },
      { k: 'rar', t: T('最高资质'), f: function () { return BS.i18n.full(P.RARITY[Math.min(4, st.rarMax)]); } },
      { k: 'bid', t: T('估价'), f: function () { return U.big(bidNow()); } },
      { k: 'quest', t: T('命题'), f: function () { return U.n0(BS.quests.readyCount()); } },
      { k: 'next', t: T('来料'), f: function () { return M.nextIn().toFixed(0) + ' s'; } },
      { k: 'moves', t: T('动手'), f: function () { return U.n0(S.seq); } }
    ];
  }
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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
<<<<<<< HEAD
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
=======
    var ns = bar.querySelectorAll('.hx'), i, j;
    for (i = 0; i < ns.length; i++) {
      var k = ns[i].getAttribute('data-k');
      for (j = 0; j < fs.length; j++) {
        if (fs[j].k !== k) continue;
        var v = fs[j].f();
        /* 数字真的换了才播那一下「跳」：这一稿的读数全是正在变的数，
           得让人看见它在变。低烈度下 body.low * 会把动画摘掉。 */
        if (ns[i].textContent !== v) {
          U.setText(ns[i], v);
          ns[i].classList.remove('tick');
          void ns[i].offsetWidth;
          ns[i].classList.add('tick');
        }
      }
    }
    paintTools();
  }

  /* 顶栏两个按钮的状态 */
  function paintTools() {
    var bu = $('btnUndo'), ba = $('btnAuto');
    if (bu) {
      var cap = M.undoCap();
      bu.disabled = !M.canUndo();
      /* 撤销栈默认就有几步，不再需要先点亮「手」，那句旧提示也就没处用了。
         拆下来的元件不回库，所以顶栏这一枚按钮是这个不可逆规则唯一的安全阀——
         它得一直看得见自己还剩几步。 */
      bu.textContent = T('撤销') + ' ' + M.undoDepth() + '/' + cap;
      bu.title = T('撤销上一步（Ctrl+Z），最多留 # 步').replace('#', cap);
    }
    if (ba) {
      var on = !!S.prefs.auto;
      var canAuto = BS.tree.mods().autoRate > 0;
      ba.disabled = !canAuto;
      ba.textContent = T('自动 ') + (on ? T('开') : T('关'));
      ba.classList.toggle('on', on && canAuto);
      ba.title = canAuto ? T('每 # 秒自己装一件（产光打对折）').replace('#', autoEvery().toFixed(1))
        : T('点亮「机」这条脉络才能自动装配');
    }
  }
  /* 自动装配的间隔：autoRate 越高越快，封顶 0.4 秒一件 */
  function autoEvery() {
    var r = BS.tree.mods().autoRate;
    if (r <= 0) return 0;
    return Math.max(0.4, 3.2 - r * 2.4);
  }

  function go(id) {
    if (!id || !BS.reg.get(id)) return;
    cur = id;
    var m = BS.reg.get(id);
    if (m && m.mount) {
      try { m.mount(host); }
      catch (e) { host.innerHTML = '<div class="empty">' + U.esc(T('这一页没有搭起来：')) + U.esc(e.message) + '</div>'; }
    }
    var sc = $('main'); if (sc) sc.scrollTop = 0;
    try { location.hash = '#/' + id; } catch (e) { /* 由它去 */ }
    nav();
    if (BS.atmos) BS.atmos.pageIn();   /* 换页转场：正文错峰上浮 + 页头扫描线 */
  }

  function tickerLine() {
    if (!ticker) return;
    if (!S.prefs.ticker) { ticker.style.display = 'none'; return; }
    ticker.style.display = '';
    /* 有待签收的命题时，底栏优先报它——目标是常驻可见的 */
    var rd = BS.quests.readyCount();
    if (rd > 0) {
      var nxt = BS.quests.firstReadySay();
      ticker.innerHTML = '<span class="tk ok">' + U.esc(T('命题')) + '</span><span class="tm">' +
        U.esc(nxt) + '</span>';
      return;
    }
    var l = S.log.length ? S.log[S.log.length - 1] : null;
    ticker.innerHTML = l
      ? '<span class="tk">' + U.esc(l.k || '·') + '</span><span class="tm">' + U.esc(l.m) + '</span>'
      : '<span class="tk">·</span><span class="tm">' + U.esc(T('图纸是空的。去「库」拿一件，落下第一块。')) + '</span>';
  }

  /* ---------- 判定提示：右下角浮一条，几秒后自己走 ---------- */
  var TOAST_MAX = 3;   /* 一次点亮一串时只留最近三条，否则它会盖住半页正文 */
  function dropToast(t) {
    var el = t.el;
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  }
  function showToast(list) {
    var box = $('toastbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastbox';
      document.getElementById('frame').appendChild(box);
    }
    var i;
    for (i = 0; i < list.length; i++) {
      var a = list[i];
      var el = document.createElement('div');
      el.className = 'toast';
      /* 判定名与条件也要落语言。这里先前是原样渲染 a.t / a.d，
         于是英文界面的浮层上一直挂着一串汉字——和判定页当年那个坑同源。 */
      /* 浮层上不再写「+N 光」：判定成立并不发奖（光只在呈交那一刻到账），
         从前那一行是旧经济留下来的承诺，看的人领了个空气。
         写给用户看的数字必须等于实际到账的数——所以这里只留名字与条件。 */
      el.innerHTML = '<b>' + U.esc(a.title ? T(a.title) : T('判定成立')) + '</b>' +
        '<span class="tn">' + U.esc(BS.i18n.tell(a.t)) + '</span>' +
        '<span class="td">' + U.esc(BS.i18n.tell(a.d)) + '</span>';
      box.appendChild(el);
      toast.push({ el: el, until: Date.now() + 6000 });
    }
    /* 超出的从最老的开始请出去——「更重要的刚发生」总排在前面 */
    while (toast.length > TOAST_MAX) dropToast(toast.shift());
    if (S.prefs.sound) ding();
  }
  function reapToast() {
    var now = Date.now(), i;
    for (i = toast.length - 1; i >= 0; i--) {
      if (now > toast[i].until) {
        var el = toast[i].el;
        el.classList.add('out');
        toast.splice(i, 1);
        (function (e2) { setTimeout(function () { if (e2.parentNode) e2.parentNode.removeChild(e2); }, 400); })(el);
      }
    }
  }
  /* 一声很短的提示音。默认不出声，设置里打开才有。 */
  function ding() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ding.ctx) ding.ctx = new AC();
      var c = ding.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g); g.connect(c.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      o.stop(c.currentTime + 0.26);
    } catch (e) { /* 没有声音也不影响玩 */ }
  }

  /* ---------- 每一拍 ---------- */
  var ACC = 0, last = 0;
  function beat() {
    var now = Date.now();
    var dt = last ? Math.min(2, (now - last) / 1000) : 1;
    last = now;

    /* 自动装配：开着且点亮了才跑 */
    if (S.prefs.auto && BS.tree.mods().autoRate > 0) {
      autoAcc += dt;
      var every = autoEvery();
      var guard = 0;
      while (autoAcc >= every && guard++ < 20) {
        autoAcc -= every;
        var r = BS.sim.autoPlace(M);
        if (!r.ok) { autoAcc = 0; break; }       /* 装不下了就停下等，不空转 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
      }
    } else {
      out += H.kv('阶段', T('不在局中'));
    }
    return out;
  }

<<<<<<< HEAD
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
=======
    /* 库只在你开着页面的时候走：每一拍把这一秒加进时钟。
       关掉页面，这一行就不跑了，上游也就不落件。 */
    M.tickClock(dt);

    /* 判定扫描：每拍一次。它只在有新点亮时才写档，所以平时不耗 */
    try {
      var got = BS.achieve.scan(M);
      if (got && got.length) { showToast(got); nav(); }
    } catch (e) { /* 由它去 */ }

    /* 估价里程碑：跨过一个十倍档就报一次。
       这一版的正反馈全在估价那根条上，所以「它又上了一个数量级」
       这件事值得单独说一句话——不报，很多人是注意不到的。 */
    try {
      var bid = bidNow();
      if (bid > 0) {
        var tier = Math.floor(Math.log(bid) / Math.LN10);
        if (tier > (S.bidTier | 0) && tier >= 2) {
          S.bidTier = tier;
          showToast([{
            title: T('估价上了一个数量级'),
            t: T('这一具此刻值 # 光').replace('#', U.big(Math.round(bid))),
            d: T('再往下做，或者现在就去呈交。')
          }]);
        }
      }
    } catch (e) { /* 由它去 */ }

    /* 跨过作品线也报一次：那一瞬间估价会跳一大截，不报的话看的人以为
       是自己刚才手抖。跨过了记一次，退回习作就清掉，下次再跨还会报。 */
    try {
      if (BS.auction) {
        var stW = M.stats();
        var isWork = (stW.n >= BS.auction.WORK_CELLS) && (stW.insts >= BS.auction.WORK_PIECES);
        if (isWork && !S.workOn) {
          S.workOn = 1;
          showToast([{
            title: T('够得上作品了'),
            t: T('三类鉴赏条目从这一刻开始计价'),
            d: T('再往下做，或者现在就去呈交。')
          }]);
        } else if (!isWork && S.workOn) { S.workOn = 0; }
      }
    } catch (e) { /* 由它去 */ }

    var m = BS.reg.get(cur);
    if (m && m.tick) { try { m.tick(); } catch (e) { /* 由它去 */ } }
    hud();
    tickerLine();
    reapToast();
    ACC += dt;
    if (ACC > 15) { ACC = 0; B.save(); }          /* 每十五秒存一次 */
  }

  function paintLang() {
    if (!langbar) return;
    var out = '', i, ls = BS.i18n.LANGS;
    for (i = 0; i < ls.length; i++) {
      out += '<button type="button" class="lb' + (BS.i18n.lang === ls[i] ? ' on' : '') +
        '" data-act="lang:' + ls[i] + '">' + U.esc(BS.i18n.get(BS.i18n.NAMES[ls[i]])) + '</button>';
    }
    langbar.innerHTML = out;
  }

  function paint() {
    var low = !!S.prefs.low;
    document.body.classList.toggle('low', low);
    var bl = $('btnLow');
    if (bl) {
      bl.textContent = T('辉光 ') + (low ? T('低烈度') : T('全'));
      bl.classList.toggle('on', low);
    }
    paintLang();
  }

  /* 换语言时把浮层清掉：浮层上那句话是用旧语言说出来的，
     留着就是半截汉字挂在英文界面上。它们是几秒钟的即时反馈，
     重来一次比留在旧语言里强。 */
  function clearToasts() {
    var box = $('toastbox');
    if (box) box.innerHTML = '';
    toast.length = 0;
  }

  /* 顶栏与标签页标题也归语言层管。
     index.html 里写死的中文只够撑到 JS 接手；换语言时要重新画一遍，
     否则「存档」这种按钮会一直留在中文。品牌字「构形」是标记，不译。 */
  function paintChrome() {
    paintTools();
    var bv = $('btnSave');
    if (bv) bv.textContent = T('存档');
    if (typeof document !== 'undefined') document.title = T('构形 · CONFIGURA');
  }

  function doUndo() {
    var r = M.undo();
    if (!r.ok) { tickerMsg(r.why); return; }
    hud(); tickerLine();
    var m = BS.reg.get(cur);
    if (m && m.mount) m.mount(host);
  }
  function tickerMsg(txt) {
    if (!ticker) return;
    ticker.innerHTML = '<span class="tk">·</span><span class="tm warn">' + U.esc(txt) + '</span>';
  }
  function toggleAuto() {
    if (BS.tree.mods().autoRate <= 0) {
      tickerMsg(T('还没点亮「机」这条脉络：去脉络点它。'));
      return;
    }
    S.prefs.auto = S.prefs.auto ? 0 : 1;
    B.save(); paintTools();
    B.log(S.prefs.auto ? T('自动装配：开') : T('自动装配：关'), 'sys');
    tickerLine();
  }

  function boot() {
    host = $('panel'); rail = $('rail'); ticker = $('ticker'); langbar = $('langbar');
    B.load();
    BS.i18n.init();
    if (!S.body) S.body = BS.body.mk();
    if (!(S.t0 > 0)) S.t0 = Date.now();
    BS.quests.st();                       /* 保证三条命题在位 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986

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
<<<<<<< HEAD
=======

    B.on('goto', function (d) { if (d && d.id) go(d.id); });
    B.on('log', tickerLine);
    B.on('body', hud);
    B.on('lib', hud);
    B.on('lux', hud);
    B.on('tree', function () { nav(); hud(); });
    B.on('quest', function () { nav(); hud(); tickerLine(); });
    B.on('restore', function () {
      BS.tree.invalidate();
      M.invalidateEssence();
      BS.quests.st();
      nav(); paint(); hud(); tickerLine(); go('assembly');
    });

    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
      /* Ctrl+Z / Cmd+Z 撤销 */
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); doUndo(); return; }
      /* 空格：把手上的元件放到光标所指的那一格。
         放置与查看从此是两种手势——点只用来查数据，装不上去；
         所以「手抖点歪了」再也不会把件放在错误的格子上。
         按住不放不连放：e.repeat 里只放行第一次。 */
      if (e.key === ' ' || e.key === 'Spacebar' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) B.emit('key:space');
        return;
      }
      /* R 键转手上那件 */
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        if (M.sel.e) { M.sel.r = (M.sel.r + 1) % 4; B.emit('hand'); go(cur); }
        return;
      }
      /* 选中的那一格：方向键整件平移，Q / E 原地转，Delete 拆掉。
         图纸不是一次性画完的，一件摆上去还要来回挪。
         只在组装台上抢这几个键——别的页还要靠方向键翻页、靠退格改字。 */
      if (cur === 'assembly' &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        B.emit('key:move', { dx: e.key === 'ArrowLeft' ? -1 : (e.key === 'ArrowRight' ? 1 : 0),
          dy: e.key === 'ArrowDown' ? -1 : (e.key === 'ArrowUp' ? 1 : 0) });
        return;
      }
      if ((e.key === 'q' || e.key === 'Q') && cur === 'assembly') { B.emit('key:spin', { dir: -1 }); return; }
      if ((e.key === 'e' || e.key === 'E') && cur === 'assembly') { B.emit('key:spin', { dir: 1 }); return; }
      if (e.key === 'Delete' && cur === 'assembly') { e.preventDefault(); B.emit('key:del'); return; }
      /* A 键切自动 */
      if (e.key === 'a' || e.key === 'A') { toggleAuto(); return; }
      var list = BS.reg.list();
      if (e.key >= '0' && e.key <= '9') {
        var idx = e.key === '0' ? 0 : +e.key;
        if (list[idx]) go(list[idx].id);
      }
    });
    window.addEventListener('beforeunload', function () { B.save(); });

    tickerLine();
    timer = setInterval(beat, 1000);

    /* 氛围层与开场：装了 atmos 才演（测试环境里它也在，只是开场会被
       sessionStorage / 低烈度 / 减少动效任一挡掉）。 */
    if (BS.atmos) BS.atmos.start();

    BS.app = {
      go: go, cur: function () { return cur; }, beat: beat, stop: function () { clearInterval(timer); },
      nav: nav, hud: hud, tickerLine: tickerLine, doUndo: doUndo, toggleAuto: toggleAuto,
      showToast: showToast, bidNow: bidNow,
      onLangChange: function () {
        /* 元件的名字是算出来就存进 meta 的（形貌词 + 格数），
           换语言得把这份缓存清掉重算，否则名字会留在旧语言里。
           脉络节点同理：名字与效果说明都存了模板，rerender 就够。 */
        if (BS.rig && BS.rig.forget) BS.rig.forget();
        clearToasts();
        paintChrome();
        paint(); nav(); go(cur); hud(); tickerLine();
      }
    };
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  }

  BS.app = { init: init, go: go, renderTop: renderTop, rail: rail, now: function () { return cur; } };

  if (typeof document !== 'undefined' && document.getElementById) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(window.BS);
