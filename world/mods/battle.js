/* world/mods/battle.js —— 塔防（无限模式，强化界面）。
   ------------------------------------------------------------------
   独立的系统：与图形工坊只有「进化」一座桥，只认军械库送来的属性块。

   界面三件强化（本版决策）：
     · **弹道**：td 每次开火记进 b.beams，渲染层用覆盖 SVG 画线——
       直击青色、连锁金色、溅射橙圈。判定是纯算法，弹道只是它的可见面。
     · **范围**：点选一座塔，切比雪夫射程的虚线方框亮出来；塔的详情
       （属性 / 击杀 / 目标优先级 / 升级）摊在旁边。
     · **无限模式**：波没有尽头，难度一路缩放；休整期二选一——
       下一波继续顶，或撤离落袋（采集尘与结晶按波数结算）。1×/2×/4× 播放速度。

   **场上的一切都是图形，没有字**（本版）：
   旧版格子里的「塔」与「兵/冲/甲/灵/首」是五个汉字——玩家读到的是标签，
   不是形状。现在塔画它自己的图形（spec.cells，按稀有度着色），
   十种敌人各有自己的形状（边数即读数；群兵是最小的圆、裂胞是两个圆、
   愈使是个十字）。视觉即信息：一眼看得出
   「这座塔是十字形的」「来的是重甲」。

   **局中也能放塔**（本版修掉的老 bug）：
   挑选条在 deploy / battle / rest 三个相位都摆着。部署阶段走预算、
   可撤回；开战之后走本局辉光、不可撤回。少了这条，
   「打着打着发现这儿该补一座」这个塔防最基本的乐趣没有了。

   **塔详情在波次中随时能开**（本版）：
   旧写法里「点格子」先走**放塔**分支——武装着一座待放的塔时，
   点任何一格都只换来一句「这一格已经有东西了」，详情面板在整个武装
   期间打不开（`sel >= 0` 一直挡在前面）。现在两种意图落在两种格子上：
   **点空格 = 放塔，点塔 = 看它**。另加一条「塔条」——战斗中新出现的
   那一行选择界面，每座塔一个钮（图形 + 编号 + 等级），点它就开详情，
   不必在 22×14 的棋盘上去找那一格。

   **优先级与等级是两件事**（本版）：
   目标优先级是**选择态**，不是结构——它一变就得当场重画那三个钮。
   旧写法把它漏在结构指纹之外、patch 又不管它，于是点「最强」之后
   塔的判定立刻变了、面板上的高亮却还停在「最前」，**要等升一级
   （等级进了指纹 → 整块重搭）高亮才跳过去**——读起来就是
   「升级把优先级改掉了」。现在 patch 逐 tick 补三个钮的高亮，
   升级与优先级各走各的路，谁也不等谁。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, TD = BS.td, RUN = BS.run;

  var host = null, dirty = false, offs = [];
  var paused = false, acc = 0, speed = 1;
  var sel = -1;            /* 挑中的军械库编号（部署 / 局中补塔共用） */
  var selTower = -1;       /* 战斗阶段：选中的塔 */
  var bghost = null, ghostCls = '';   /* 落点预览：追加在格子 class 后面的那一截 */
  /* 稳定骨架：结构指纹不变时战斗中只补丁、不重画（见 render） */
  var skel = null, lastKey = '';

  function mark() { dirty = true; }
  function run() { return RUN.current(); }

  /* ---------- 图形：一具格子表 → 能塞进战场格子的 SVG ----------
     viewBox 按包围盒归一化，所以再怪的形状也自动居中、自动占满格子。
     fill 交给 CSS（.fig.r0..r4），与工坊 / 花园同一套稀有度色——
     三处用一套色，玩家才不必重新学一遍「这个颜色是什么意思」。 */
  function figSVG(cells, cls) {
    if (!cells || !cells.length) return '';
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, i;
    for (i = 0; i < cells.length; i++) {
      if (cells[i][0] < minx) minx = cells[i][0];
      if (cells[i][1] < miny) miny = cells[i][1];
      if (cells[i][0] > maxx) maxx = cells[i][0];
      if (cells[i][1] > maxy) maxy = cells[i][1];
    }
    /* pad 是「每格留多少缝」。它必须小于 1——写成 1.1 时
       width = 1 - pad = -0.10，浏览器整块丢弃，于是战场上根本画不出塔的形状，
       只剩格子底色（.cell.t）；而控制台只刷一条 attribute 警告，
       不报错、门禁也不痛。0.12 的缝与 rx=0.16 配起来刚好是「一颗颗零件」。 */
    var w = maxx - minx + 1, h = maxy - miny + 1, out = '', pad = 0.12;
    for (i = 0; i < cells.length; i++) {
      out += '<rect x="' + (cells[i][0] - minx + pad / 2).toFixed(2) +
        '" y="' + (cells[i][1] - miny + pad / 2).toFixed(2) +
        '" width="' + (1 - pad).toFixed(2) + '" height="' + (1 - pad).toFixed(2) +
        '" rx="0.16"/>';
    }
    return '<svg class="fig ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h +
      '" preserveAspectRatio="xMidYMid meet">' + out + '</svg>';
  }

  /* 十种敌人各一个形状。边数即读数：越难缠的边越多——
     这是给眼睛的提示，不是数值。
     三种不靠边数：群兵是**最小的那个圆**（一眼看出「这只不重要，这一群才重要」）、
     裂胞是**两个圆**（正在分成两只）、愈使是个**十字**（它在补自己）。
     形状要能在 20×20 的格子里被认出来，认不出来就等于没画。 */
  var ESHAPE = {
    ground: '<polygon points="10,1.5 18.5,17.5 1.5,17.5"/>',
    fast: '<polygon points="10,1 19,10 10,19 1,10"/>',
    swarm: '<circle cx="10" cy="10" r="4.6"/>',
    armor: '<rect x="2.5" y="2.5" width="15" height="15" rx="2"/>',
    lancer: '<polygon points="10,1 16,4.8 16,15.2 10,19 4,15.2 4,4.8"/>',
    splitter: '<circle cx="7.2" cy="10" r="4.1"/><circle cx="13.6" cy="10" r="3.2"/>',
    mender: '<polygon points="7.2,1.6 12.8,1.6 12.8,7.2 18.4,7.2 18.4,12.8 12.8,12.8 12.8,18.4 7.2,18.4 7.2,12.8 1.6,12.8 1.6,7.2 7.2,7.2"/>',
    wraith: '<polygon points="10,1.5 18.5,8.5 15.5,18.5 4.5,18.5 1.5,8.5"/>',
    bulwark: '<polygon points="10,1 16.4,3.6 18.6,10 16.4,16.4 10,19 3.6,16.4 1.4,10 3.6,3.6"/>',
    chief: '<polygon points="10,1 19,7 16,18.5 4,18.5 1,7"/>'
  };
  function enemySVG(id, cls) {
    var s = ESHAPE[id] || ESHAPE.ground;
    return '<svg class="efig ' + (cls || '') + '" viewBox="0 0 20 20">' + s + '</svg>';
  }
  /* 护盾环：盾还在就画一圈虚线。波次预告与战场共用——
     「这一波带盾」必须在前一届就看得见，否则破盾无从准备。 */
  function shieldRing(cls) {
    return '<svg class="esh ' + (cls || '') + '" viewBox="0 0 20 20">' +
      '<circle cx="10" cy="10" r="9.2" fill="none" stroke-width="1.7" stroke-dasharray="3.4 2.2"/></svg>';
  }

  /* ---------- 阵型浮层：读数即裁判 ----------
     指针宇宙退场之后，接管战斗标量的那一头由**阵型**接上。
     这一块面板要同时说清三件事，而且三件事都不解释名词——
     名词本来就无意义，有意义的是**它从哪儿来**：
       · 本局摆了几座塔，六项读数各是多少
       · 每一项接管了哪个战斗标量，净效应多少
       · 峰值那一项是双刃：它同时抬高一格敌血
     玩家记住的不再是「上次那个叫什么来着，好像特别凶」，
     而是「我这阵太偏环络了，连锁很响但敌人也厚」。 */
  var BIND = {
    dmg: { t: '伤害', en: 'DMG' }, rate: { t: '攻速', en: 'RATE' },
    range: { t: '射程', en: 'RANGE' }, splash: { t: '溅射', en: 'SPLASH' },
    chain: { t: '连锁', en: 'CHAIN' }, slow: { t: '减速', en: 'SLOW' },
    proj: { t: '散射', en: 'SHOTS' }, pierce: { t: '穿透', en: 'PIERCE' },
    crit: { t: '暴击', en: 'CRIT' }, leak: { t: '护盾', en: 'SHIELD' },
    lux: { t: '辉光产', en: 'LUX OUT' }, hp: { t: '敌血', en: 'ENEMY HP' }
  };
  function bindName(k) { return I.term(BIND[k] || { t: k, en: k }); }

  /* 六项读数 → 它接管的标量（与 run.js 的 FMAP 同一张表） */
  var FROW = [
    { k: 'even',   t: '匀质', bind: 'dmg',   fmt: 'pct' },
    { k: 'repeat', t: '重复', bind: 'rate',  fmt: 'pct' },
    { k: 'void',   t: '通透', bind: 'range', fmt: 'num', also: ['穿透'] },
    { k: 'sym',    t: '对称', bind: 'proj',  fmt: 'int' },
    { k: 'weave',  t: '环络', bind: 'chain', fmt: 'int', also: ['减速'] },
    { k: 'edge',   t: '轮廓', bind: 'crit',  fmt: 'pct' }
  ];
  function esName(k) {
    return { even: T('匀质'), repeat: T('重复'), void: T('通透'),
      sym: T('对称'), weave: T('环络'), edge: T('轮廓') }[k] || k;
  }
  function fxNum(fx, k) {
    if (k === 'dmg' || k === 'rate' || k === 'slow' || k === 'lux') return fx[k + 'Mul'];
    if (k === 'crit') return fx.critP;
    if (k === 'leak') return fx.leakCut;
    if (k === 'hp') return fx.hpMul;
    if (k === 'range') return fx.rangeAdd;
    return fx[k + 'Add'];
  }

  function fluxPanel(b) {
    var fx = b.flux;
    if (!fx) return '';
    var f = fx.form, out = '<div class="bx-flux">';
    out += '<div class="bx-fxh"><b>' + U.esc(T('阵型')) + '</b><em>' +
      U.esc(I.fill('# 座 · 质变度 #', (f ? f.n : 0), f ? f.esScore.toFixed(2) : '—')) +
      '</em><span class="bx-fxsig">' + U.esc(T('乱流是你摆出来的，不是掷出来的')) + '</span></div>';
    if (!f) {
      out += '<div class="dim">' + U.esc(T('这一局还没摆下任何东西。')) + '</div></div>';
      return out;
    }
    /* 六项读数：每一项报「多少 → 接管什么 → 净效应」 */
    out += '<div class="bx-fxrow">';
    var i, r, v, eff, cls;
    for (i = 0; i < FROW.length; i++) {
      r = FROW[i]; v = f.es[r.k] || 0;
      eff = fxNum(fx, r.bind);
      if (r.fmt === 'pct') eff = (eff - 1) * 100;
      cls = (r.fmt === 'pct') ? (eff > 0.5 ? ' up' : (eff < -0.5 ? ' dn' : '')) : (eff > 0 ? ' up' : '');
      out += '<span class="bx-fxv' + cls + '"><em>' + U.esc(esName(r.k)) + ' ' + v.toFixed(2) + '</em><b>' +
        (r.fmt === 'pct' ? ((eff >= 0 ? '+' : '') + eff.toFixed(0) + '%')
          : (r.fmt === 'int' ? (eff >= 0 ? '+' : '') + eff
            : (eff >= 0 ? '+' : '') + eff.toFixed(2))) + '</b>' +
        '<i>' + U.esc(bindName(r.bind)) + '</i></span>';
    }
    out += '</div>';
    /* 双刃：峰值那一项同时抬高一格敌血 */
    if (f.peak) {
      out += '<div class="bx-fxact"><span class="bx-fxa dn">' +
        '<b>' + U.esc(esName(f.peak)) + '</b><em>' + U.esc(bindName('hp')) + '</em>' +
        '<s class="dn">+' + ((fx.hpMul - 1) * 100).toFixed(0) + '%</s>' +
        '<i>' + U.esc(T('峰值是双刃：你的强项，也是这一局敌人的厚度')) + '</i></span></div>';
    }
    /* 接缝：这一局摆出了几条邻接回路 */
    var wires = 0, x, y, A, B2;
    for (x = 0; x < b.towers.length; x++) {
      for (y = x + 1; y < b.towers.length; y++) {
        A = b.towers[x]; B2 = b.towers[y];
        if (TD.cheb(A.cx, A.cy, B2.cx, B2.cy) <= 1.5) wires++;
      }
    }
    if (wires) {
      out += '<div class="bx-fxact"><span class="bx-fxa">' +
        '<b>' + U.esc(I.fill('# 条接缝', wires)) + '</b><em>' + U.esc(T('邻接回路')) + '</em>' +
        '<i>' + U.esc(T('共振 / 干涉 / 互补——谁挨着谁，第一次有意义')) + '</i></span></div>';
    }
    out += '</div>';
    return out;
  }

  function specLine(a) {
    return T('伤害 # · 攻速 # · 射程 # · 弹 # · 连锁 #')
      .replace('#', a.dmg.toFixed(1)).replace('#', a.rate.toFixed(1))
      .replace('#', a.range.toFixed(1)).replace('#', a.proj).replace('#', a.chain);
  }

  /* 塔的型名：界面上唯一说明「这是哪种炮」的地方。
     不同型 → 不同战斗签名 → 不同的塔，这一行就是那张对照表的入口。 */
  function typeLine(a) {
    var f = BS.parts.formOf(a.form);
    if (!f) return '';
    return '<span class="ttype">' + U.esc(f.sym + ' ' + I.term(f)) + '</span>';
  }

  function clearBghost() {
    if (bghost) {
      /* gok/gno 是追加在 class 后面的那一截，摘掉它就好——
         别整块重写 className，那会把 paintCell 刚写好的 p/t/e 一起抹了。 */
      bghost.className = bghost.className.replace(/ ?g(o k|no)/, '');
      bghost = null;
      ghostCls = '';
    }
  }

  /* ---------- 棋盘 + 覆盖 SVG（弹道与范围） ---------- */
  function enemyCells(b) {
    var es = {}, i, c;
    for (i = 0; i < b.enemies.length; i++) {
      c = b.path[Math.min(b.path.length - 1, Math.floor(b.enemies[i].pos))];
      es[TD.key(c[0], c[1])] = b.enemies[i];
    }
    return es;
  }

  /* 一格的内容：敌人优先（它站在塔上），没敌人才画塔自己的形状。
     塔画它自己的形状——取 inst 的 a.cells，进化时写进 spec 的那份。 */
  function cellInner(b, k, e, inBattle) {
    var inner = '';
    if (e) {
      var pct = Math.max(0, Math.min(100, e.hp / e.maxHp * 100));
      inner = enemySVG(e.id) + '<i style="width:' + pct.toFixed(0) + '%"></i>';
      /* 盾：环 + 盾条。盾条走顶上（血条在底下），一眼分得开
         「还剩多少血」与「还剩多少盾」。 */
      if (e.sh > 0) {
        inner = shieldRing() + inner;
        var spct = Math.max(0, Math.min(100, e.sh / (e.maxSh || 1) * 100));
        inner += '<i class="shbar" style="width:' + spct.toFixed(0) + '%"></i>';
      }
    } else if (b.occ[k] && inBattle) {
      var tw = b.towers[+String(b.occ[k]).slice(1)];
      inner = tw ? figSVG(tw.a.cells, 'r' + (tw.a.rar == null ? 0 : tw.a.rar)) : '';
    }
    return inner;
  }

  function grid(r, b, legal) {
    var es = enemyCells(b), out = '', x, y, ls = {}, i;
    if (legal) for (i = 0; i < legal.length; i++) ls[TD.key(legal[i][0], legal[i][1])] = 1;
    var inBattle = r.phase === 'battle' || r.phase === 'rest';
    for (y = 0; y < TD.ROWS; y++) {
      for (x = 0; x < TD.COLS; x++) {
        var k = TD.key(x, y), cls = '', inner = '', extra = '';
        if (b.pathSet[k] != null) cls += ' p';
        var occ = b.occ[k];
        if (occ) cls += ' t';
        if (ls[k]) cls += ' ok';
        var e = es[k];
        if (e) cls += ' e';
        inner = cellInner(b, k, e, inBattle);
        if (e) {
          /* 敌人站在塔上时摘掉 data-t：那一格点下去不该选中塔 */
        } else if (occ && inBattle) {
          extra = ' data-t="' + String(occ).slice(1) + '"';
        }
        out += '<div class="cell' + cls + '" data-c="' + x + ',' + y + '"' + extra + '>' + inner + '</div>';
      }
    }
    /* 外层 .bframe 是场地框（底板 / 边框 / 四角取景标），
       内层 .bwrap 是真正的坐标系：弹道覆盖层按 100% 铺在它上面，
       所以**框不能加在 .bwrap 上**——padding 会把 beams 与格子错开。 */
    return '<div class="bframe"><div class="bwrap"><div class="bgrid" style="--cols:' + TD.COLS + '">' + out + '</div>' + overlay(b) + '</div></div>';
  }

  /* 覆盖层：pitch = 25（24px 格 + 1px 缝），格心 = i*25 + 12.5 */
  var PITCH = 25, HALF = 12.5;
  function overlayInner(b) {
    var out = '', i;
    /* 范围：选中的塔亮切比雪夫射程的虚线方框 */
    if (selTower >= 0 && b.towers[selTower]) {
      var t = b.towers[selTower], r2 = t.a.range;
      var x0 = Math.max(0, Math.round(t.cx - r2)), x1 = Math.min(TD.COLS - 1, Math.round(t.cx + r2));
      var y0 = Math.max(0, Math.round(t.cy - r2)), y1 = Math.min(TD.ROWS - 1, Math.round(t.cy + r2));
      out += '<rect class="rng" x="' + (x0 * PITCH + 1) + '" y="' + (y0 * PITCH + 1) +
        '" width="' + ((x1 - x0 + 1) * PITCH - 2) + '" height="' + ((y1 - y0 + 1) * PITCH - 2) + '"/>';
    }
    /* 弹道：判定这一 tick 的每一次开火 */
    for (i = 0; i < b.beams.length; i++) {
      var bm = b.beams[i];
      if (bm.k === 'splash') {
        out += '<circle class="bm splash" cx="' + (bm.x1 * PITCH + HALF) + '" cy="' + (bm.y1 * PITCH + HALF) + '" r="' + (PITCH * 0.9) + '"/>';
      } else {
        out += '<line class="bm ' + bm.k + '" x1="' + (bm.x1 * PITCH + HALF) + '" y1="' + (bm.y1 * PITCH + HALF) +
          '" x2="' + (bm.x2 * PITCH + HALF) + '" y2="' + (bm.y2 * PITCH + HALF) + '"/>';
      }
    }
    return out;
  }
  function overlay(b) {
    return '<svg class="bovl" viewBox="0 0 ' + (TD.COLS * PITCH) + ' ' + (TD.ROWS * PITCH) + '">' +
      overlayInner(b) + '</svg>';
  }

  /* ---------- 挑选条：从军械库挑一座塔 ----------
     三个相位共用。区别只在**钱与能不能撤回**：
       deploy → 预算，可撤回；battle / rest → 本局辉光，不可撤回。 */
  /* 挑选条上的钮是**手写**的而不是走 H.btnR：战斗中这个条要能局部补丁
     （辉光在涨，「（不够）」随时在变），而补丁需要 data-pick 挂在钮上。 */
  function pickBar(r) {
    var b = r.battle, arm = BS.bus.state.armory || [], i;
    var midRun = r.phase !== 'deploy';
    var pool = midRun ? (b.lux | 0) : RUN.left(r);
    var taken = BS.shop.deployedIds();
    var out = '<div class="pickbar"><span class="pbl">' + U.esc(T(midRun ? '补塔（花本局辉光）' : '挑一座塔')) + '</span>';
    var avail = 0;
    for (i = 0; i < arm.length; i++) {
      if (taken[arm[i].id]) continue;
      avail++;
      var rec = arm[i], poor = rec.cost > pool;
      var label = rec.serial + ' · ' + U.esc(I.fill('# 辉光', U.n0(rec.cost)));
      out += '<button class="btn ' + (sel === rec.id ? 'on' : (poor ? 'ghost' : '')) +
        '" data-act="pick:' + rec.id + '" data-pick="' + rec.cost + '" data-label="' + U.esc(label) + '"' +
        (poor && sel !== rec.id ? ' disabled' : '') + '>' + label +
        (poor ? U.esc(T('（不够）')) : '') + '</button>';
    }
    if (!arm.length) out += '<span class="dim">' + U.esc(T('军械库是空的。去图形工坊提交一具图形。')) + '</span>';
    else if (!avail) out += '<span class="dim">' + U.esc(T('没有可挑的了——库里的都部署上了')) + '</span>';
    out += '<span class="dim pbr">' + U.esc(T(midRun ? '本局辉光' : '剩余预算')) +
      ' <b data-v="pool">' + U.n0(pool) + '</b></span></div>';
    return out;
  }

  /* ---------- 塔条：战斗中的「进化体选择界面」 ----------
     休整期有塔列表（restPanel），战斗中没有——想打开一座塔的详情，
     只能在 22×14 的棋盘上去找那一格。这一行把「选哪座塔」从
     「在战场上找一格」变成「点一行」：图形 + 编号 + 等级，点它开详情。
     只在 battle 摆：rest 已经有完整列表，deploy 还没开打、塔动不了
     （点开也只能看着，那是噪音）。
     等级不挂 data-v：能升级的只有 selTower 那一位，而它的等级已经在
     结构指纹里（`t.level`）——升一级就会重搭骨架，这一行跟着换对。 */
  function towerBar(r) {
    var b = r.battle, i;
    if (!b || !b.towers.length) return '';
    var out = '<div class="pickbar twbar"><span class="pbl">' + U.esc(T('塔')) + '</span>' +
      '<span class="dim">' + U.esc(T('点一座看它')) + '</span>';
    for (i = 0; i < b.towers.length; i++) {
      var t = b.towers[i], a = t.a;
      out += '<button class="btn ' + (selTower === i ? 'on' : 'ghost') + '" data-act="sel:' + i + '">' +
        '<span class="tfig">' + figSVG(a.cells, 'r' + (a.rar == null ? 0 : a.rar)) + '</span>' +
        '<span>' + U.esc(a.serial || '') + '</span>' +
        (t.level ? '<em class="rv">' + U.esc(' · ' + T('# 级').replace('#', t.level)) + '</em>' : '') +
        '</button>';
    }
    out += '</div>';
    return out;
  }

  /* 合法落点：辉光照不亮、路径照挡。局中补塔与部署阶段同一套规则。 */
  function legalCells(b) {
    var out = [], x, y;
    for (y = 0; y < TD.ROWS; y++) for (x = 0; x < TD.COLS; x++) {
      if (TD.deployOk(b, [x, y]) === '') out.push([x, y]);
    }
    return out;
  }

  /* ---------- 部署阶段 ---------- */
  function deployPanel(r) {
    if (!r.battle) r.battle = TD.start({ seed: r.seed, turrets: [] });
    var b = r.battle, left = RUN.left(r), budget = BS.build.budget();
    var out = '<div class="statline">' +
      H.kv('剩余预算', '<b>' + U.n0(left) + '</b> / ' + U.n0(budget)) +
      H.kv('已花', U.n0(r.spent)) +
      H.kv('已部署', U.n0(r.deployed.length)) +
      '</div><div class="bbar"><i style="width:' + (budget ? (r.spent / budget * 100).toFixed(1) : 0) + '%"></i></div>';
    /* 战况条在**部署阶段**：开战之前才谈得上「这一局我愿意挨多少」。 */
    out += condBar(r);
    out += pickBar(r);
    var legal = null, hint;
    if (sel >= 0) {
      legal = legalCells(b);
      hint = U.esc(T('点战场上亮出的格子落塔。')) + ' <b>' + legal.length + '</b>';
    } else {
      hint = '<span class="dim">' + U.esc(T('先在上面挑一座塔。')) + '</span>';
    }
    out += '<div class="fcols"><div class="fright">' + grid(r, b, legal) +
      '<div class="selinfo">' + hint + '</div>';
    out += '<div class="dlist">';
    for (var z = 0; z < r.deployed.length; z++) {
      var rec2 = RUN.recOf(r.deployed[z].aid);
      out += '<span class="drow">' + U.esc(rec2 ? rec2.serial : '?') +
        ' <b>' + U.n0(r.deployed[z].cost) + '</b>' + H.btnR('rm:' + z, '×', 'x') + '</span>';
    }
    if (!r.deployed.length) out += '<span class="dim">' + U.esc(T('还没部署任何东西')) + '</span>';
    out += '</div><div class="ff">' +
      H.btn('begin', T('开战'), r.deployed.length ? 'on' : 'ghost', !r.deployed.length) +
      H.btn('new', T('重开一局'), 'ghost') +
      '</div></div></div>';
    return out;
  }

  /* ---------- 下一波预告 ----------
     预告要吃**这一局的战况**：勾了「蜂拥」就得真的显示更多敌人，
     勾了「盾列」就得提前把那圈环画出来。预告与实战读的是同一个
     b.mods，所以预告不会骗人——骗人的预告比没有预告更糟。
     peek（侦察指令）让它一次摊两波。 */
  function wavePreview(b, peek) {
    var md = b.mods || TD.modsNeutral(), sh = md.waveShift | 0;
    var n = Math.max(1, peek | 0), out = '', w, i;
    for (w = 1; w <= n; w++) {
      var nw = b.wave + w;
      var comp = BS.waves.comp(b.seed, nw), sc = BS.waves.scale(nw + sh);
      out += '<div class="subhead">' + U.esc(I.fill('第 # 波预告', nw)) +
        ' · HP ×' + sc.hp.toFixed(2);
      /* 第 11 波起每波有主题：抬起来的那一路写在标题里。
         「下一波是甲潮还是灵潮」读得出来，才谈得上为它留火力。 */
      if (nw > 10) {
        out += ' · ' + U.esc(T('主题')) + ' <b>' + U.esc(I.term(BS.waves.flavorName(nw))) + '</b>';
      }
      out += '</div><div class="statline">';
      for (i = 0; i < comp.length; i++) {
        var cnt = Math.max(1, Math.round(comp[i].count * md.countMul));
        out += '<span class="wvprev">' + enemySVG(comp[i].id);
        /* 带盾的敌人先画环——「该为破盾做点准备」要赶在开波之前说 */
        if (BS.enemies.hasShield(comp[i].id, nw + sh, md.shieldFrom)) out += shieldRing();
        out += '<b>×' + cnt + '</b></span>';
      }
      out += '</div>';
    }
    return out;
  }

  /* ---------- 战况条：开局前自己勾 ----------
     《几何竞技场 2》的挑战卡：**难度是一张一张勾的**，每一条都明码标价
     一个结算倍率。倍率就在这一条的右边，勾一条涨一点——
     风险与回报在同一行字里，不需要玩家去别处查表。 */
  function condBar(r) {
    var open = RUN.condOpen(), all = BS.cond.LIST.length, mul = RUN.gradeMul(r), i;
    var out = '<div class="pickbar condbar"><span class="pbl">' + U.esc(T('战况')) + '</span>';
    for (i = 0; i < open.length; i++) {
      var c = open[i], on = (r.cond || []).indexOf(c.id) >= 0;
      out += '<button class="btn ' + (on ? 'on' : 'ghost') + '" data-act="cond:' + c.id +
        '" title="' + U.esc(I.term(c, 'd')) + '">' +
        U.esc(I.term(c)) + ' <em>+' + c.mul + '%</em></button>';
    }
    out += '<span class="dim pbr">' + U.esc(T('结算倍率')) + ' <b>×' + mul.toFixed(2) + '</b></span>';
    if (open.length < all) {
      out += '<span class="dim pbr">' + U.esc(T('更狠的几条在重塑树的「契约」里')) + '</span>';
    }
    return out + '</div>';
  }

  /* ---------- 战备指令：波与波之间的三选一 ----------
     每一张都写两行：**得** 与 **付**。只有得没有付，三选一就退化成
     「挑最大的那个」；有了付，你选的才是「这一局往哪边长」。 */
  function orderBox(r) {
    var of = RUN.offerOf(r), i, o;
    /* 这一波有没有下过令——闸门在 run.pick 里（按波去重），
       界面只负责**把话说清楚**：下过就把三张卡压暗、按钮拿掉，
       不留一排点不动的死钮（点了只换来一句「已经下过」，那是最坏的反馈）。 */
    var wave = r.battle ? (r.battle.wave | 0) : 0;
    var done = (r.ordAtWave | 0) === wave;
    var out = '<div class="subhead">' + U.esc(T('战备指令')) + '</div>';
    var last = (r.ordTaken && r.ordTaken.length) ? r.ordTaken[r.ordTaken.length - 1] : null;
    if (last) {
      o = BS.orders.BY[last];
      if (o) {
        out += '<div class="ordnow">' + U.esc(T('本波已下令')) + '：<b>' + U.esc(I.term(o)) + '</b>' +
          '<span class="dim">' + U.esc(I.term(o.give)) + ' · ' + U.esc(I.term(o.pay)) + '</span></div>';
      }
    }
    if (done) {
      out += '<div class="dim">' + U.esc(T('这一波已经下过令了：同一条指令可以在后面的波里再下一次。')) + '</div>';
    }
    out += '<div class="ocards' + (done ? ' locked' : '') + '">';
    for (i = 0; i < of.length; i++) {
      o = BS.orders.BY[of[i]];
      if (!o) continue;
      out += '<div class="ocard"><div class="och"><b>' + U.esc(I.term(o)) + '</b></div>' +
        '<div class="orow up"><em>' + U.esc(T('得')) + '</em>' + U.esc(I.term(o.give)) + '</div>' +
        '<div class="orow dn"><em>' + U.esc(T('付')) + '</em>' + U.esc(I.term(o.pay)) + '</div>' +
        '<div class="off">' + (done ? '<span class="dim">' + U.esc(T('下一波再选')) + '</span>'
          : H.btnR('ord:' + o.id, T('下令'), 'on')) + '</div></div>';
    }
    out += '</div>';
    /* 重掷只在还没下令时给：下完令再重掷，等于「付了一份又反悔」。 */
    if ((r.rerollLeft | 0) > 0 && !done) {
      out += '<div class="ff">' + H.btnR('reroll', T('重掷（还剩 # 次）').replace('#', r.rerollLeft), 'ghost') + '</div>';
    }
    return out;
  }

  /* ---------- 塔详情：属性 / 击杀 / 优先级 / 升级 / 撤收 ---------- */
  function PRI_NAMES() { return { first: T('最前'), strong: T('最强'), near: T('贴身') }; }
  function towerPanel(r, i) {
    var b = r.battle, t = b.towers[i], a = t.a;
    if (!t) return '';
    var out = '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(BS.shop.nameOfSpec(a)) + '</b>' +
      (t.level ? '<em class="rv">' + U.esc(T('# 级').replace('#', t.level)) + '</em>' : '') +
      /* 模块 badge：局外在装配台装的，这里只报名字——
         立场是出发前选的，战场上不给人改。 */
      (t.br && TD.BRANCH_BY[t.br] ? '<em class="rv r2">' + U.esc(T(TD.BRANCH_BY[t.br].t)) + '</em>' : '') +
      typeLine(a) + '</div>' +
      '<div class="handfig big">' + figSVG(a.cells, 'r' + (a.rar == null ? 0 : a.rar)) + '</div>' +
      '<div class="statline">' +
      H.kv('伤害', '<span data-v="t-dmg">' + a.dmg.toFixed(1) +
        (t.level ? ' ×' + TD.levelMul(t.level).toFixed(2) : '') + '</span>') +
      H.kv('攻速', a.rate.toFixed(1)) +
      H.kv('射程', a.range.toFixed(1)) +
      H.kv('弹', a.proj) +
      H.kv('连锁', a.chain) +
      /* 破盾三件套摆出来：盾吃五折的只有单体，这三项全额——
         玩家要能在这个面板上直接数出「我这座塔破盾有多快」。 */
      H.kv('穿透', a.pierce) +
      H.kv('溅射', a.splash) +
      H.kv('减速', a.slow.toFixed(2)) +
      H.kv('击杀', '<span data-v="t-kills">' + U.n0(t.kills) + '</span>') +
      '</div>' +
      '<div class="ff"><span class="fl">' + U.esc(T('目标优先级')) + '</span>';
    var pris = ['first', 'strong', 'near'], names = PRI_NAMES(), p;
    for (var z = 0; z < pris.length; z++) {
      p = pris[z];
      out += H.btnR('pri:' + i + ':' + p, names[p], t.pri === p ? 'on' : 'ghost');
    }
    out += '</div>';
    /* 形变 badge：这座塔在战场上长出来的规则。焊死不可改，所以只报名字。 */
    if (t.a.mut && t.a.mut.length) {
      out += '<div class="ff"><span class="fl">' + U.esc(T('长成')) + '</span>';
      for (var mi = 0; mi < t.a.mut.length; mi++) {
        var mm = TD.MUT_BY[t.a.mut[mi]];
        if (mm) out += '<em class="rv r2">' + U.esc(I.term(mm)) + '</em>';
      }
      out += '</div>';
    }
    /* 质变口：下一级正好是这一座的下一口（第 2 / 5 / 10 级）时，
       这一级不给伤害，给一条新规则。三个候选由这座塔自己的六项读数
       排序得出——菜单是算出来的。
       升级在**战斗与休整都摆着**：辉光是击杀里挣的，局内挣的就该局内花得掉。

       **一口一条**（本版）：开门那一级必须选一条才能过，焊完桌子就撤，
       不再有「还能再选」。所以界面只剩一张桌子：`up.need === 'mutate'`。
       门级与上限都从 TD.GATE_LEVELS / TD.MAX_MUT 读——
       界面不许自己写死一份 2 / 5 / 10。 */
    if (r.phase === 'battle' || r.phase === 'rest') {
      /* 问的是 upgradeInfo 不是 upgrade：后者是**命令**（扣钱、抬等级），
         活在渲染路径里会变成「打开塔面板就自动升级」——那个 bug
         实测抓到过，玩家只是选中一座塔就付掉一级。 */
      var up = TD.upgradeInfo(b, i);
      var mut = (up.ok && up.need === 'mutate') ? up : TD.gateOpenAt(t);
      if (mut && mut.options && mut.options.length) {
        out += '<div class="mutbox"><b>' + U.esc(T('质变口：这一级不给伤害，给一条新规则')) + '</b>' +
          '<span class="tg ok">' + U.esc(T('不花辉光')) + '</span>' +
          '<span class="tg">' + U.esc(I.fill('第 # 级这一口 · 已焊 # / #',
            mut.gate || (t.level + 1), (t.a.mut || []).length, TD.MAX_MUT)) + '</span>';
        out += '<span class="dim">' + U.esc(T('三个候选由这座塔自己的读数排序得出。一口一条，选完焊死——想换请进化下一座。')) + '</span>';
        for (var oi = 0; oi < mut.options.length; oi++) {
          var mu = TD.MUT_BY[mut.options[oi]];
          if (!mu) continue;
          out += '<div class="mutrow">' + H.btnR('mut:' + i + ':' + mu.id, I.term(mu), 'on') +
            '<span class="mud">' + U.esc(I.term(mu, 'd')) + '</span></div>';
        }
        out += '</div>';
      }
      /* 升级钮：开门那一级不摆（那时选一条是唯一的路）。 */
      if (!(up.ok && up.need === 'mutate')) {
        /* 下一口在哪一级，随时报出来：它是这一座塔还剩下的取舍次数，
           玩家该能照着它安排辉光——而不是升到门口才发现没钱。 */
        var ng = TD.gateLevelFor(t);
        if (ng) out += '<span class="dim">' + U.esc(I.fill('下一口在第 # 级', ng)) + '</span>';
        /* 升级折扣（重塑「量产」）在这一局那张纸上，算钱的时候才用它。 */
        var cost = TD.upgradeCost(t.level, b.mods ? b.mods.upDisc : 0);
        var can = b.lux >= cost && t.level < BS.eff.CAP.level;
        out += '<div class="ff">' +
          H.btnR('up:' + i, can ? T('升级 # 辉光').replace('#', cost) : T('辉光不够'),
            can ? 'on' : 'ghost', !can).replace('data-act="up:' + i + '"',
              'data-act="up:' + i + '" data-v="t-up"') + '</div>';
      }
    }
    /* 殉爆：只有长成「殉爆」的塔才有这个钮。它换来的是一次范围伤害，
       付的是这座塔本身——塔第一次可以死。 */
    if ((r.phase === 'battle' || r.phase === 'rest') && TD.mutOn(t.a, 'martyr')) {
      out += '<div class="ff">' +
        H.btnR('boom:' + i, T('殉爆'), 'ghost', false,
          T('自毁：周围一圈造成生命值 ×2 的伤害，返六成辉光，塔回军械库。')) + '</div>';
    }
    /* 撤收：开战之后才能撤（部署阶段有全额退款）。返六成辉光、
        塔回军械库——「摆错了搬个家」要付四成过路费。 */
    if (r.phase === 'battle' || r.phase === 'rest') {
      var d = r.deployed[i];
      var back = d ? Math.max(1, Math.floor(d.cost * RUN.modsOf(r).sellRate)) : 0;
      out += '<div class="ff">' +
        H.btnR('sell:' + i, T('撤收（返 # 辉光）').replace('#', back), 'ghost', false,
          T('摘下这座塔，返六成辉光，塔回军械库。重新部署要再付全价。')) + '</div>';
    }
    out += '</div>';
    return out;
  }

  /* ---------- 休整期：塔列表 + 详情 ---------- */
  /* 一行的击杀/优先级那一段。补丁与首画共用一个函数——
     写成两份的话，优先级改了之后这一行会停在旧档位上。 */
  function killLine(t) {
    return I.fill('# 击杀 · #', U.n0(t.kills), PRI_NAMES()[t.pri] || '');
  }

  function restPanel(r) {
    var b = r.battle, out = '<div class="subhead">' + U.esc(T('波与波之间')) +
      ' · ' + U.esc(T('辉光 #').replace('#', U.n0(b.lux))) + '</div>';
    out += '<div class="tlist">';
    var i;
    for (i = 0; i < b.towers.length; i++) {
      var t = b.towers[i], a = t.a;
      out += '<div class="trow">' +
        '<span class="tfig">' + figSVG(a.cells, 'r' + (a.rar == null ? 0 : a.rar)) + '</span>' +
        '<span class="tn">' + U.esc(BS.shop.nameOfSpec(a)) +
        /* 等级也走 T()：直接拼 ' ' + n + ' 级' 在英文界面上会漏一个「级」字——
           那是一串**没有对应键**的字，永远译不进去。 */
        (t.level ? ' · ' + T('# 级').replace('#', t.level) : '') + '</span>' +
        '<span class="tp">' + U.esc(specLine(a)) + '</span>' +
        /* 击杀数与目标优先级都挂 data-v：战斗中这一行每 tick 都在涨，
           而这一行不许被整页重画连带销毁（详情钮就在它旁边）。
           优先级改了就补这一段——它和上面的三个钮走同一条路。 */
        '<span class="tk" data-v="k' + i + '">' + killLine(t) + '</span>' +
        H.btnR('sel:' + i, T('详情'), 'ghost small') +
        '</div>';
    }
    out += '</div>';
    if (selTower >= 0) out += towerPanel(r, selTower);
    return out;
  }

  /* ---------- 结算 ----------
     **撤离与失守是两笔不同的账**，所以结算页要把两笔都说清楚：
     失守那一栏写着打了多少折，玩家下次才知道「再顶一波」值不值。
     阅历那一栏**逐条列出来源**——「登记」的意思就是
     每一笔你都能指出它从哪来，只给总数的话玩家学不会任何事。 */
  var EXPK = { 波数: 1, 深水: 1, 击杀: 1, 撤离犒赏: 1, 战况: 1, 失守: 1 };
  function expLines(res) {
    var e = res.exp, out = [], i, L;
    if (!e) return '';
    for (i = 0; i < e.lines.length; i++) {
      L = e.lines[i];
      if (L.v == null) {
        if (L.mul != null && Math.abs(L.mul - 1) > 0.001) out.push(T(L.k) + ' ×' + L.mul.toFixed(2));
      } else if (L.v) out.push(T(L.k) + ' +' + U.n0(L.v));
    }
    return out.join(' · ');
  }

  function overPanel(r) {
    var res = r.result, o = res.over, c = res.ctx;
    var ks = [], k;
    for (k in r.battle.kills) ks.push(k + '×' + r.battle.kills[k]);
    var title = o.phase === 'left'
      ? (c.won ? T('撤离落袋。撑过第 10 波，这一局成了') : T('撤离了。第 # 波为止').replace('#', o.wave))
      : T('基地失守于第 # 波').replace('#', o.wave);
    var out = '<div class="subhead">' + U.esc(title) + '</div>';
    out += '<div class="statline">' +
      H.kv('打到', U.n0(c.wave) + ' ' + T('波')) +
      H.kv('击杀', U.esc(ks.join(' ') || '—')) +
      H.kv('辉光（局内）', U.n0(r.battle.lux)) +
      H.kv('基地', Math.max(0, r.battle.baseHp) + ' / ' + TD.BASE_HP) +
      /* 盾账：这一局的盾到底有多厚。破盾数是「为非单体火力
         留了多少位置」的量化——看不看得见，决定它是不是决策。 */
      H.kv('破盾', U.n0(r.battle.shieldBreaks || 0) + ' 面') +
      H.kv('盾吸收', U.n0(r.battle.shieldHit || 0)) +
      '</div>';
    /* 两笔账的分野就写在这里：失守打折是一个**看得见的数字**，
       不是藏在公式里的一行。看不见的惩罚不叫惩罚。 */
    out += '<div class="statline">' +
      H.kv('结算口径', res.lost
        ? '<b class="dn">' + U.esc(T('失守')) + ' ×' + res.rate.toFixed(2) + '</b>'
        : '<b class="up">' + U.esc(T('撤离')) + ' ' + U.esc(T('全额')) + '</b>') +
      H.kv('深水区', '×' + res.deepMul.toFixed(2)) +
      H.kv('战况倍率', '×' + res.mul.toFixed(2)) +
      H.kv('基地折算', res.hpBonus ? '+' + U.n0(res.hpBonus) : '—') +
      '</div>';
    out += '<div class="unlock">' +
      U.esc(T('采集尘 +# · 结晶 +#')).replace('#', U.n0(res.dust)).replace('#', U.n0(res.crystal)) +
      '</div>';
    if (res.exp) {
      out += '<div class="unlock">' + U.esc(I.fill('阅历 +#：#', U.n0(res.exp.total), expLines(res))) +
        '</div>';
    }
    if (res.newly && res.newly.length) {
      out += '<div class="unlock">' + U.esc(T('新解锁：')) + res.newly.map(function (id) {
        var m = BS.metaDefs.BY[id];
        return '<b>' + U.esc(I.term(m)) + '</b>';
      }).join('、') + '</div>';
    }
    /* 收成够不够抽一发，这里只说**这一件事实**。
       「你被卡住了」那句话不说了——那是替玩家下判断；
       要不要重来，交给重塑页那一键（它在，而且随时可以按）。 */
    var dc = BS.store.drawCost();
    if ((BS.bus.state.dust | 0) < dc) {
      out += '<div class="unlock">' +
        U.esc(I.fill('这一局的收成不够再抽一发（# / # 采集尘）', U.n0(BS.bus.state.dust | 0), U.n0(dc))) +
        '</div>';
    }
    out += '<div class="ff">' + H.btn('again', T('再开一局'), 'on') +
      H.btn('go:shaping', T('去重塑页登记'), 'go') + '</div>';
    return out;
  }

  /* ---------- 稳定骨架 + 局部补丁 ----------
     战斗中**不再整页重画**。旧写法每 160ms 把 host.innerHTML 整个换掉，
     于是按钮在两次重画之间被销毁又重建——真人点击十个里丢九个：
     mousedown 与 mouseup 落在不同节点上，浏览器根本不出 click。
     jsdom 的测试是同步派发事件的，所以这道门禁一直绿着，而真人人是瘸的。
     现在分两层：
       · **结构指纹**（相位 / 选中 / 塔数 / 等级 / 形变 / 暂停 / 倍速）变了
         → 重搭骨架、重新绑事件；
       · 指纹没变 → 只补数字与格子，按钮原地不动，点得下去。 */
  function keyOf(r) {
    if (!r) return 'none';
    var b = r.battle, t = (b && selTower >= 0) ? b.towers[selTower] : null;
    /* 战况 / 指令也是**结构**：它们变了就得重搭骨架——
       否则「勾了一条战况」之后那一排钮还是旧的那一排。 */
    return [r.phase, sel, selTower, b ? b.towers.length : 0,
      t ? t.level : -1, t ? (t.a.mut || []).length : -1,
      t && TD.mutOn(t.a, 'martyr') ? 1 : 0,
      r.deployed.length, paused ? 1 : 0, speed,
      (r.cond || []).join(','), (r.offer || []).join(','),
      (r.ordTaken || []).length, (r.ordAtWave | 0), r.peek | 0, r.rerollLeft | 0].join('|');
  }

  /* 把要补丁的节点一次抓牢。战斗中每 tick 都走这条路，所以只抓一次。 */
  function grab() {
    var s2 = { cells: [], ovl: null, picks: [], up: null, pri: [] };
    var cs = host.querySelectorAll('.bgrid .cell'), i;
    for (i = 0; i < cs.length; i++) {
      var el = cs[i];
      s2.cells.push({
        el: el, k: el.getAttribute('data-c'), st: '',
        ok: /(^| )ok( |$)/.test(el.className)
      });
    }
    s2.ovl = host.querySelector('.bovl');
    var ps = host.querySelectorAll('[data-pick]');
    for (i = 0; i < ps.length; i++) {
      s2.picks.push({ el: ps[i], cost: +ps[i].getAttribute('data-pick'),
        label: ps[i].getAttribute('data-label') || '' });
    }
    s2.up = host.querySelector('[data-v="t-up"]');
    /* 优先级的三个钮：`pri:<塔号>:<档位>`。它们**不进结构指纹**——
       优先级是选择态，不是结构；进了指纹就等于「改一次优先级、
       整块面板重搭一次」，而那正是旧版把「升级」和「优先级」焊在一起的
       地方（指纹里只有等级，于是高亮要等升级才跳）。 */
    var pr = host.querySelectorAll('[data-act^="pri:"]');
    for (i = 0; i < pr.length; i++) {
      var seg = String(pr[i].getAttribute('data-act') || '').split(':');
      s2.pri.push({ el: pr[i], idx: +seg[1], p: seg[2] });
    }
    return s2;
  }

  function setV(k, html) {
    if (!host) return;
    var n = host.querySelector('[data-v="' + k + '"]');
    if (n) n.innerHTML = html;
  }

  /* 一格：状态没变就只换内容（血条在掉），状态变了才换 class。
     data-t 跟着敌人走——敌人站在塔上时那一格不该选中塔。 */
  function paintCell(c, b, es, inBattle) {
    var el = c.el, e = es[c.k];
    var st = (b.pathSet[c.k] != null ? 'p' : '') + (b.occ[c.k] ? 't' : '') + (e ? 'e' : '');
    if (st !== c.st) {
      c.st = st;
      var cls = 'cell';
      if (st.indexOf('p') >= 0) cls += ' p';
      if (st.indexOf('t') >= 0) cls += ' t';
      if (c.ok) cls += ' ok';
      if (st.indexOf('e') >= 0) cls += ' e';
      /* 悬停预览的 gok/gno 是挂在 class 后面的，重写时得原样带回去 */
      el.className = (bghost === el) ? (cls + ghostCls) : cls;
      if (e || !b.occ[c.k]) {
        if (el.getAttribute('data-t') != null) el.removeAttribute('data-t');
      } else if (inBattle) {
        el.setAttribute('data-t', String(b.occ[c.k]).slice(1));
      }
    }
    var inner = cellInner(b, c.k, e, inBattle);
    if (el.innerHTML !== inner) el.innerHTML = inner;
  }

  function patch() {
    var r = run();
    if (!r || !skel || !skel.cells.length) return;
    var b = r.battle, i;
    if (b) {
      var inBattle = r.phase === 'battle' || r.phase === 'rest';
      setV('base', Math.max(0, b.baseHp));
      setV('lux', U.n0(b.lux));
      setV('towers', U.n0(b.towers.length));
      setV('en', U.n0(b.enemies.length));
      setV('whp', b.sc.hp.toFixed(2));
      var es = enemyCells(b);
      for (i = 0; i < skel.cells.length; i++) paintCell(skel.cells[i], b, es, inBattle);
      if (skel.ovl) skel.ovl.innerHTML = overlayInner(b);
      /* 挑选条：辉光在涨，「（不够）」随时在翻 */
      var pool = (r.phase !== 'deploy') ? (b.lux | 0) : RUN.left(r);
      setV('pool', U.n0(pool));
      for (i = 0; i < skel.picks.length; i++) {
        var pk = skel.picks[i], poor = pk.cost > pool;
        pk.el.disabled = poor;
        pk.el.innerHTML = pk.label + (poor ? U.esc(T('（不够）')) : '');
      }
      /* 塔详情：伤害乘数、击杀、升级钮的可点性 */
      if (selTower >= 0 && b.towers[selTower]) {
        var t = b.towers[selTower];
        setV('t-dmg', t.a.dmg.toFixed(1) + (t.level ? ' ×' + TD.levelMul(t.level).toFixed(2) : ''));
        setV('t-kills', U.n0(t.kills));
        var cost = TD.upgradeCost(t.level, b.mods ? b.mods.upDisc : 0), can = b.lux >= cost && t.level < BS.eff.CAP.level;
        if (skel.up) {
          skel.up.innerHTML = U.esc(can ? T('升级 # 辉光').replace('#', cost) : T('辉光不够'));
          skel.up.disabled = !can;
          skel.up.className = 'btn ' + (can ? 'on' : 'ghost');
        }
      }
      /* 目标优先级：那三个钮的高亮就补在这条路上——**不重画**。
         为什么不用「把 pri 塞进结构指纹」那个写法：进指纹就等于
         「点一次优先级、整块面板重搭一次」，钮会被销毁重建；而优先级
         在一场战斗里会被来回点十几次。更要紧的是旧版根本没管它，
         于是高亮只在**等级变了**（唯一进指纹的塔字段）时才对——
         读起来就是「升级把优先级改掉了」。现在两者各走各的路：
         等级变了重搭骨架，优先级变了只换这几个 class。 */
      for (i = 0; i < skel.pri.length; i++) {
        var pb = skel.pri[i], ptw = b.towers[pb.idx];
        if (!ptw) continue;
        var pcls = 'btn ' + (ptw.pri === pb.p ? 'on' : 'ghost');
        if (pb.el.className !== pcls) pb.el.className = pcls;
      }
      /* 休整期塔列表的击杀数与优先级 */
      for (i = 0; i < b.towers.length; i++) setV('k' + i, killLine(b.towers[i]));
    }
    /* 开波仪式在这里兜底：相位翻转必然重搭骨架（render 会跑），
       但补丁每 160ms 也查一遍——波号变了就闪那一下。 */
    syncWave(r);
  }

  /* ---------- 开波仪式 ----------
     波号一变，战场框闪一道、波号大字浮起又沉下。
     lastRunRef 认局：重开一局时波号回到 1，那一波也要闪。 */
  var lastWave = -1, lastRunRef = null;
  function syncWave(r) {
    var b = r && r.battle;
    if (!b) return;
    if (r !== lastRunRef) { lastRunRef = r; lastWave = -1; }
    if (b.wave === lastWave) return;
    lastWave = b.wave;
    try {
      if (!host) return;
      var fr = host.querySelector('.bframe');
      if (!fr) return;
      fr.classList.remove('wflash');
      void fr.offsetWidth;
      fr.classList.add('wflash');
      var w = document.createElement('div');
      w.className = 'waven';
      w.textContent = I.fill(T('第 # 波'), b.wave);
      fr.appendChild(w);
      setTimeout(function () {
        try {
          if (w.parentNode) w.parentNode.removeChild(w);
          fr.classList.remove('wflash');
        } catch (e) { /* 由它去 */ }
      }, 1050);
    } catch (e) { /* 仪式坏了不连累战斗 */ }
  }

  function build(r) {
    if (!r) {
      var out0 = H.head('塔防', 'TOWER DEFENSE',
        '从军械库挑出进化好的塔，部署在路径两旁。波没有尽头——看你能撑到第几波。') +
        /* 没有局的时候也是舞台：空场地 + 扫描 + 一张卡片。
           旧版这里只有一句「现在没有进行中的一局」——一屏黑加一句话，
           第一次进来的人看不见这游戏长什么样。「路径由种子铺出来」
           这件事也在这里说清楚：它不预画一条假路径，因为下一局的种子还没掷。 */
        '<div class="arena"><div class="acard">' +
        '<b>' + U.esc(T('战场待命')) + '</b>' +
        '<span>' + U.esc(I.fill('无限模式 · # × #', TD.COLS, TD.ROWS)) + '</span>' +
        '<em>' + U.esc(T('开一局：路径会在这一刻由种子铺出来。')) + '</em>' +
        H.btn('new', T('开一局新的'), 'on') + '</div></div>';
      /* 军械库空着就说这一件事实（不替玩家下「推不动了」的判断）。
         重整那一键**常驻**在重塑页——什么时候推倒重来由玩家定，
         所以这里也给它一个入口，而不是等某个条件成立才露面。 */
      if (!(BS.bus.state.armory || []).length) {
        out0 += '<div class="unlock bad">' + U.esc(T('军械库是空的：先去工坊拼一具图形、提交进化，才有塔可部署。')) + '</div>';
      }
      out0 += '<div class="ff">' + H.btn('go:shaping', T('去重塑页'), 'ghost') + '</div>';
      return out0;
    }
    if (r.phase === 'deploy') {
      return H.head('塔防', 'TOWER DEFENSE',
        '一座塔占一格，建在路径两旁——火力覆盖哪一段路，是这里唯一的摆位学问。') +
        deployPanel(r);
    }
    var b2 = r.battle;
    /* 波号是运行期拼的：走 I.fill 模板，英文界面才落得进去（'Wave #'）。
       直接 '第 ' + n + ' 波' 拼出来的是一个**没有对应键**的串，永远漏译。 */
    var out2 = H.head('塔防', 'TOWER DEFENSE', I.fill('第 # 波 · 无限模式', b2.wave));
    out2 += '<div class="statline">' +
      H.kv('基地', '<span data-v="base">' + Math.max(0, b2.baseHp) + '</span> / ' + TD.BASE_HP) +
      H.kv('辉光', '<span data-v="lux">' + U.n0(b2.lux) + '</span>') +
      H.kv('塔', '<span data-v="towers">' + U.n0(b2.towers.length) + '</span>') +
      H.kv('场上敌人', '<span data-v="en">' + U.n0(b2.enemies.length) + '</span>') +
      H.kv('本波 HP ×', '<span data-v="whp">' + b2.sc.hp.toFixed(2) + '</span>') +
      '</div>';
    if (r.phase === 'battle') {
      out2 += '<div class="ff">' +
        H.btn('pause', paused ? T('继续') : T('暂停'), paused ? 'on' : 'ghost') +
        H.btn('skip', T('跳过这一波'), 'ghost') +
        H.btnR('sp:1', '1×', speed === 1 ? 'on' : 'chip') +
        H.btnR('sp:2', '2×', speed === 2 ? 'on' : 'chip') +
        H.btnR('sp:4', '4×', speed === 4 ? 'on' : 'chip') +
        '</div>';
    } else if (r.phase === 'rest') {
      out2 += '<div class="ff">' +
        H.btn('next', T('下一波'), 'on') +
        H.btn('leave', T('撤离结算'), 'go') +
        '</div>';
    }
    /* 战场先于一切文字面板：它是这一部的舞台。
       旧版把波次预告、战备指令、阵型面板与挑选条全摆在棋盘前面，
       于是 1440×900 的屏上战场落在折线以下——打开塔防页先看到的
       是一排读数与三张卡，不是战场。挪位置不碰判定：
       骨架抓取全按选择器，与先后无关。 */
    var legal2 = (sel >= 0 && r.phase !== 'over') ? legalCells(b2) : null;
    out2 += '<div class="fcols bfc"><div class="fright">' + grid(r, b2, legal2) + '</div>';
    /* 右栏是战争室的读数排：塔详情（点开才有）压着阵型面板竖着叠。
       都不在就不占位——战场上永远没有一块空栏。 */
    var rcol = '';
    if (selTower >= 0 && b2.towers[selTower] && r.phase !== 'over') {
      rcol += '<div class="bside">' + towerPanel(r, selTower) + '</div>';
    }
    var fxp = fluxPanel(b2);
    if (fxp) rcol += fxp;
    if (rcol) out2 += '<div class="rcol">' + rcol + '</div>';
    out2 += '</div>';
    /* 休整期的两件排在战场之后：先看一眼战场，再决定下一步怎么打。 */
    if (r.phase === 'rest') {
      out2 += wavePreview(b2, r.peek ? 2 : 1);
      /* 战备指令：波与波之间的三选一。旧版这里只有「下一波 / 撤离」
         两个钮，于是运营在一整局里只发生过一次。 */
      out2 += orderBox(r);
    }
    /* 战况倍率在战斗中也摆着：它跟着这一局的结算走，
       玩家随时该知道「这一局值多少」。 */
    var gmul = RUN.gradeMul(r);
    if (gmul > 1.001) {
      out2 += '<div class="statline">' + H.kv('战况倍率', '<b>×' + gmul.toFixed(2) + '</b>') + '</div>';
    }
    /* 挑选条：deploy / battle / rest 都在。开局之后照样能补塔——
       这是本版修掉的老 bug，别再把这三个相位分出三六九等。 */
    if (r.phase !== 'over') out2 += pickBar(r);
    /* 塔条：战斗中的进化体选择界面。入口在这里，
       不必到 22×14 的棋盘上去把那一格找出来。 */
    if (r.phase === 'battle') out2 += towerBar(r);
    /* 阵型面板已搬进战场右栏（rcol），这里不再重复摆一份 */
    if (r.phase === 'rest' && selTower < 0) out2 += restPanel(r);
    if (r.phase === 'over') out2 += overPanel(r);
    return out2;
  }

  function render() {
    if (!host) return;
    clearBghost();
    var r = run();
    var k = keyOf(r);
    /* 指纹没变就只补丁——按钮与格子原地不动，点得下去 */
    if (k === lastKey && host.firstChild) { patch(); return; }
    lastKey = k;
    host.innerHTML = build(r);
    skel = grab();
    bind();
    patch();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      var r = run();
      if (a.indexOf('go:') === 0) { BS.app.go(a.slice(3)); return; }
      if (a === 'new') { RUN.newRun(BS.seed.runSeed('')); sel = -1; selTower = -1; paused = false; render(); return; }
      if (!r) return;
      /* 战况：勾上 / 取消。它只在部署阶段能改——开战之后再改，
         「这一局我愿意挨多少」这句话就没了分量。 */
      if (a.indexOf('cond:') === 0) {
        var cid = a.slice(5), on = (r.cond || []).indexOf(cid) < 0;
        var oc = RUN.setCond(r, cid, on);
        if (!oc.ok) B.log(oc.why, 'sys');
        render(); return;
      }
      /* 战备指令：下令 / 重掷 */
      if (a.indexOf('ord:') === 0) {
        var op = RUN.pick(r, a.slice(4));
        if (!op.ok) B.log(op.why, 'sys');
        else B.log(BS.i18n.fill('下令：#', BS.i18n.term(BS.orders.BY[op.id])), 'sys');
        render(); return;
      }
      if (a === 'reroll') {
        var orr = RUN.reroll(r);
        if (!orr.ok) B.log(orr.why, 'sys');
        render(); return;
      }
      if (a === 'begin') { var o = RUN.begin(r); if (!o.ok) B.log(o.why, 'sys'); sel = -1; render(); return; }
      if (a === 'pause') { paused = !paused; render(); return; }
      if (a.indexOf('sp:') === 0) { speed = +a.slice(3); render(); return; }
      if (a === 'skip') {
        paused = true;
        var g = 0;
        while (r.phase === 'battle' && g++ < TD.WAVE_TICKS) { TD.tickOnce(r.battle); afterTick(r); }
        render();
        return;
      }
      if (a === 'next') {
        /* 乱流不再随波重掷（它跟着部署走），所以这里直接开新波。 */
        TD.beginWave(r.battle);
        paused = false;
        r.phase = 'battle';
        render();
        return;
      }
      if (a === 'leave') {
        var lv = RUN.leave(r);
        if (!lv.ok) B.log(lv.why, 'sys');
        selTower = -1;
        render();
        return;
      }
      if (a === 'again') { RUN.newRun(BS.seed.runSeed('')); paused = false; sel = -1; selTower = -1; render(); return; }
      if (a.indexOf('up:') === 0) {
        var o2 = RUN.up(r, +a.slice(3));
        if (!o2.ok) B.log(o2.why, 'sys');
        render();
        return;
      }
      if (a.indexOf('pri:') === 0) {
        var m = a.slice(4).split(':');
        var o3 = RUN.pri(r, +m[0], m[1]);
        if (!o3.ok) B.log(o3.why, 'sys');
        render();
        return;
      }
      if (a.indexOf('mut:') === 0) {
        var mm2 = a.slice(4).split(':');
        var om = RUN.chooseMut(r, +mm2[0], mm2[1]);
        if (!om.ok) B.log(om.why, 'sys');
        render();
        return;
      }
      if (a.indexOf('boom:') === 0) {
        var ob = RUN.detonate(r, +a.slice(5));
        if (!ob.ok) B.log(ob.why, 'sys');
        else B.log(BS.i18n.fill('殉爆：命中 # 只，返 # 辉光', ob.hit, ob.back), 'sys');
        selTower = -1;   /* 塔没了，选择当场失效 */
        render();
        return;
      }
      if (a.indexOf('sell:') === 0) {
        var os = RUN.sell(r, +a.slice(5));
        if (!os.ok) B.log(os.why, 'sys');
        else B.log(BS.i18n.fill('撤收：返 # 辉光，塔回军械库', os.back), 'sys');
        selTower = -1;   /* 摘塔之后下标全体前移，选择当场失效 */
        render();
        return;
      }
      if (a.indexOf('sel:') === 0) { selTower = +a.slice(4); render(); return; }
      if (a.indexOf('pick:') === 0) { sel = (+a.slice(5) === sel) ? -1 : +a.slice(5); render(); return; }
      if (a.indexOf('rm:') === 0) {
        var rm = RUN.remove(r, +a.slice(3));
        if (!rm.ok) B.log(rm.why, 'sys');
        render();
        return;
      }
    });
    var cells = host.querySelectorAll('[data-c]'), i;
    for (i = 0; i < cells.length; i++) {
      cells[i].addEventListener('mouseenter', function () {
        clearBghost();
        var r = run();
        /* 三个相位都允许预览落点——局中补塔同样该有「放得下放不下」的先知。 */
        if (!r || r.phase === 'over' || sel < 0 || !r.battle) return;
        var p = this.getAttribute('data-c').split(',').map(Number);
        var ok = TD.deployOk(r.battle, p) === '';
        ghostCls = ok ? ' gok' : ' gno';
        this.className += ghostCls;
        bghost = this;
      });
      cells[i].addEventListener('mouseleave', function () { clearBghost(); });
      cells[i].addEventListener('click', function () {
        var rr = run();
        if (!rr) return;
        var dt = this.getAttribute('data-t');
        /* 点一座塔 = 看它。这一条**先于**放塔那一支：旧写法里武装着一座
           待放的塔时（sel >= 0），点任何一格都先走 add，于是点塔格只换来
           一句「这一格已经有东西了」，详情面板在整个武装期间打不开。
           放塔与看塔落在两种格子上（空格 / 有塔的格），不会互相盖住。 */
        if (dt != null && (rr.phase === 'battle' || rr.phase === 'rest')) {
          selTower = +dt;
          render();
          return;
        }
        if (rr.phase !== 'over' && sel >= 0) {
          var p = this.getAttribute('data-c').split(',').map(Number);
          var o = RUN.add(rr, sel, p);
          if (!o.ok) B.log(o.why, 'sys');
          else sel = -1;
          render();
          return;
        }
      });
    }
  }

  /* tickOnce 之后的出口判定：与 td.wave() 是同一套条件，只是拆到 UI 侧逐步走 */
  function afterTick(r) {
    var b = r.battle;
    if (b.over) { RUN.settle(r, false); return; }
    if (b.baseHp <= 0) { b.over = { phase: 'lost', wave: b.wave }; RUN.settle(r, false); return; }
    if (!b.toSpawn.length && !b.enemies.length) {
      /* 走 run.toRest()，不在这里自己改相位：那一半要做的事
         （清掉上一张指令、摊新候选）必须两条路都做，漏一条就会
         出现「指令的付永远挂在场上」。 */
      RUN.toRest(r);
      return;
    }
  }

  function tick(dt) {
    var r = run();
    if (!r || r.phase !== 'battle' || paused) return;
    /* 乱流跟着部署走，不跟着钟走——所以这里再没有什么「推进相位」。
       钟只驱动播放速度。 */
    acc += dt;
    var step = (BS.eff.isCalm() ? 400 : 160) / speed;
    var guard = 0;
    while (acc >= step && guard++ < 12) {
      acc -= step;
      TD.tickOnce(r.battle);
      afterTick(r);
      if (r.phase !== 'battle') { acc = 0; break; }
    }
    mark();
  }

  BS.reg.add({
    id: 'battle', n: '5', t: '塔防', sub: 'TOWER DEFENSE',
    mount: function (h) {
      host = h; dirty = false; paused = false; acc = 0; sel = -1; selTower = -1;
      offs.push(B.on('run', function () { render(); }));
      offs.push(B.on('restore', function () { render(); }));
      render();
    },
    tick: function (dt) {
      if (!host) return;
      tick(dt);
      if (dirty) { dirty = false; render(); }
    },
    unmount: function () {
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      host = null; skel = null; lastKey = '';
    }
  });
})(window.BS);
