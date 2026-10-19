<<<<<<< HEAD
/* world/mods/assembly.js —— 装配台。
   ------------------------------------------------------------------
   这一页回答两个问题，都发生在**局外**：
     · 这座塔装哪块模块？（破盾尖锋 / 裂界散射 / 迅捷节律，花结晶，一次性）
     · 这座塔请不起，拆不拆？（拆解还料——元件回库，拼一具小的再来）

   为什么专精长在这里而不是战场上：升级只加伤害，_balance.mjs 量出来
   「先升哪座」没有差别。模块补这个缺口，而它**属于出发前**——
   装之前看得见效果（每张卡都现算装配后的属性），装之后这一局、
   别局都带着它走。辉光留在局内（升级 / 补塔 / 撤收），结晶花在局外
   （商店与这台装配台）——三道闸门一块都没混。

   **每块模块吃一项读数**（通透 / 对称 / 重复）：同一块模块装在不同
   图形上效果不同，「哪座塔配哪块模块」因此是一个真问题——
   审美即战力在装配台上当场兑现。卡的相性行直接报出那座塔的读数，
   预览行报出装配前后的属性差——信息给在按按钮之前。

   拆解还料同时是一把**死结的钥匙**：实测抓到过「起手拼一具太贵的塔，
   全局预算请不起，而尘只能靠战斗结算挣」的死局。拆了它，料回库，
   拼一具小的——局外永远有路。 */
=======
/* world/mods/assembly.js —— 组装台。这一页就是这一部作品本身。
   规则只有两条：整件都放得下，且至少一格贴着已有的格；图空着时第一件随便放。

   装一件不进光。这一页最要紧的读数是**估价**：你把这一具做到什么份上，
   它能拍出多少。每装一件，那根条就动一次——正反馈就在那一下。
   觉得够了，就去「呈交」把它整个卖掉，图纸归零，光一次到账。

   —— 两种手势分工 ——
   放置只认空格：光标在哪一格，就按空格把手上那件放在那里。
   点击只认查看：点哪一格就看哪一格的数据，绝不改动图面。
   选中的那一格还能整件平移（方向键）、原地转（Q / E）、拆掉（Delete）——
   一具图形不是一次画完的，一件摆上去还得来回挪。

   但**拆是要不回来的**（T6）：拆下来的元件不回库，整件永久离场。
   所以拆之前要先问一句，而问的那一句必须带内容——只写「确定吗」等于没问，
   看的人照样会点掉。这一句里带着它叫什么、多少格、哪一档，以及还救不救得回来。
   华 / 殿两档多问一遍：拆掉一件殿档件的代价是等到下一次抽到殿档为止。 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, SH = BS.shop, TD = BS.td;

<<<<<<< HEAD
  var host = null, dirty = false, offs = [];
  var sel = -1;            /* 选中的在库编号；-1 = 没选 */

  function specLine(a) {
    return T('伤害 # · 攻速 # · 射程 # · 弹 # · 连锁 #')
      .replace('#', a.dmg.toFixed(1)).replace('#', a.rate.toFixed(1))
      .replace('#', a.range.toFixed(1)).replace('#', a.proj).replace('#', a.chain);
=======
  var host = null, dirty = true, sel = null, msg = '', lastPlace = null;
  var hover = null;
  /* 拆件的确认计数：0 = 还没问过。够数了才真拆。 */
  var pendingRm = 0;
  function mark() { dirty = true; }
  function q(s) { return host ? host.querySelector(s) : null; }

  function traitTags(ids) {
    if (!ids || !ids.length) return '';
    var out = '', i, t;
    for (i = 0; i < ids.length; i++) {
      t = P.traitOf(ids[i]);
      if (!t) continue;
      out += '<span class="tr" title="' + U.esc(T(t.d)) + '"><i>' + t.sym + '</i>' + U.esc(I.term(t)) + '</span>';
    }
    return out;
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  }

  function miniGrid(rec, cls) {
    var sz = P.size(rec.cells), out = '', x, y, set = {}, i;
    for (i = 0; i < rec.cells.length; i++) set[rec.cells[i][0] + ',' + rec.cells[i][1]] = 1;
    for (y = 0; y < sz.h; y++) {
      for (x = 0; x < sz.w; x++) out += '<i class="' + (set[x + ',' + y] ? 'on' : '') + '"></i>';
    }
<<<<<<< HEAD
    return '<span class="mg ' + (cls || '') + '" style="--w:' + sz.w + '">' + out + '</span>';
  }

  /* ---------- 在库列表：点一行选一座 ---------- */
  function towerRows(arm) {
    if (!arm.length) {
      return H.empty('军械库是空的。去图形工坊拼一具图形，提交进化。');
    }
    var out = '<div class="vtable">', i;
    for (i = 0; i < arm.length; i++) {
      var rec = arm[i];
      out += '<div class="vrow r' + rec.rar + (sel === rec.id ? ' sel' : '') + '" data-act="sel:' + rec.id + '">' +
        '<span class="vs">' + U.esc(rec.serial) + '</span>' +
        '<span class="vf">' + U.esc(I.term(P.FORM_BY[rec.form])) + '</span>' +
        '<span class="vm">' + miniGrid(rec) + '</span>' +
        '<span class="vt">' +
        (rec.br ? '<em class="rv r2">' + U.esc(T(TD.BRANCH_BY[rec.br].t)) + '</em>' : '<em class="rv">' + U.esc(T('未装模块')) + '</em>') +
        '</span>' +
        '<span class="vc"><b>' + U.n0(rec.cost) + '</b> ' + U.esc(T('辉光')) + '</span>' +
        '</div>';
    }
    return out + '</div>';
=======
    if (!best) return '';
    if (best.done) {
      return '<div class="goal rdy"><b>' + U.esc(T('命题达成')) + '</b>' +
        '<span>' + U.esc(I.tell(best.def.say)) + '</span>' +
        H.btn('go:quests', T('去签收'), 'go small') + '</div>';
    }
    return '<div class="goal"><b>' + U.esc(T('当前目标')) + '</b>' +
      '<span>' + U.esc(I.tell(best.def.say)) + '</span>' +
      '<em>' + U.esc(I.tell(best.hint)) + '</em>' +
      '<i class="gbar"><u style="width:' + Math.round(U.clamp(best.p, 0, 1) * 100) + '%"></u></i>' +
      '</div>';
  }

  /* ---------- 估价条：这一页的仪表盘 ----------
     光不按件给，所以「我刚才那一件挣了多少」这句话已经没有意义了。
     有意义的是这一句：这一具此刻值多少。每一次动手它都会动。 */
  function bidBox() {
    var ev = null;
    try { ev = BS.auction.eval(M); } catch (e) { ev = null; }
    if (!ev || !ev.n) {
      return '<div class="bidbox empty"><b>' + U.esc(T('估价')) + '</b>' +
        '<span class="note dim">' + U.esc(T('图纸是空的。落下第一件，估价就开始长。')) + '</span></div>';
    }
    var top = '', i;
    for (i = 0; i < ev.top.length; i++) {
      top += '<span class="bt2">' + U.esc(I.tell(ev.top[i].t)) + '<em>+' + U.big(ev.top[i].pay) + '</em></span>';
    }
    return '<div class="bidbox">' +
      '<div class="bidtop"><b>' + U.esc(T('此刻估价')) + '</b>' +
      '<span class="bidnum">' + U.big(Math.round(ev.total)) + '</span>' +
      '<em>' + U.esc(T('光')) + '</em>' +
      H.btn('go:auction', T('去呈交'), 'go') + '</div>' +
      '<div class="bidsub">' +
      H.kv('站住的条目', U.n0(ev.k) + ' / ' + U.n0(ev.items.length)) +
      H.kv('格', U.n0(ev.n)) + H.kv('元件', U.n0(ev.pieces)) +
      H.kv('条数加成', '×' + U.fmt(ev.mult, 2)) +
      H.kv('声誉', '×' + U.fmt(ev.rep, 2)) +
      '</div>' +
      (top ? '<div class="bidtags">' + top + '</div>' : '') +
      '</div>';
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  }

  /* ---------- 模块卡：相性 + 效果预览 + 装配钮 ----------
     预览是**真算的**：applyBranch 是纯函数，装配前后各量一遍，
     只把变了的属性摆出来。玩家按按钮之前就知道自己买到什么。 */
  /* 预览行比的是「装配前 → 装配后」，标签按语言取（表项自带 en）。 */
  var DIFF_KEYS = [
    ['dmg', { t: '伤害', en: 'DMG' }, 1], ['rate', { t: '攻速', en: 'RATE' }, 1],
    ['pierce', { t: '穿透', en: 'PIERCE' }, 0], ['splash', { t: '溅射', en: 'SPLASH' }, 0],
    ['proj', { t: '弹', en: 'SHOTS' }, 0], ['slow', { t: '减速', en: 'SLOW' }, 2]
  ];
  function branchCard(rec, br) {
    var after = TD.applyBranch(rec.spec, br.id);
    var deltas = [], i;
    for (i = 0; i < DIFF_KEYS.length; i++) {
      var k = DIFF_KEYS[i][0], d = DIFF_KEYS[i][2];
      var a0 = rec.spec[k], a1 = after[k];
      if (Math.abs(a1 - a0) < 1e-9) continue;
      deltas.push(I.term(DIFF_KEYS[i][1]) + ' ' + a0.toFixed(d) + ' → ' + a1.toFixed(d));
    }
<<<<<<< HEAD
    var kv = rec.es[br.k] || 0;
    var fitted = rec.br === br.id;
    var poor = BS.bus.state.crystal < SH.fitCost();
    var out = '<div class="bcard' + (fitted ? ' on' : '') + '">' +
      '<div class="bch"><b>' + U.esc(T(br.t)) + '</b>' +
      '<em>' + U.esc(I.fill('吃 # #', T(br.kt), kv.toFixed(2))) + '</em></div>' +
      '<div class="bcd">' + U.esc(T(br.d)) + '</div>' +
      '<div class="bcp">' + (deltas.length ? U.esc(deltas.join(' · ')) : U.esc(T('这座塔吃不到这块'))) + '</div>';
    if (fitted) out += '<span class="tg ok">' + U.esc(T('已装')) + '</span>';
    else out += H.btnR('fit:' + rec.id + ':' + br.id,
      T('装配（# 结晶）').replace('#', SH.fitCost()),
      (!poor && !rec.br) ? 'on' : 'ghost', poor || !!rec.br);
    return out + '</div>';
  }

  /* ---------- 详情：这座塔 + 三张模块卡 + 拆解 ---------- */
  function benchPanel(rec) {
    var a = rec.spec;
    var out = '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(SH.nameOf(rec)) + '</b>' +
      '<em class="rv">' + U.esc(rec.serial) + '</em>' +
      (rec.br ? '<em class="rv r2">' + U.esc(T(TD.BRANCH_BY[rec.br].t)) + '</em>' : '') +
      typeLine(rec) + '</div>' +
      '<div class="handfig big">' + miniGrid(rec, 'big') + '</div>' +
      '<div class="statline">' +
      H.kv('型', U.esc(I.term(P.FORM_BY[rec.form]))) +
      H.kv('档', U.esc(I.term(P.RARITY[rec.rar], 'full'))) +
      H.kv('格数', U.n0(rec.n)) +
      H.kv('部署成本', '<b>' + U.n0(rec.cost) + '</b> ' + U.esc(T('辉光'))) +
      '</div>' +
      '<div class="statline">' + H.esRow(rec.es) + '</div>' +
      '<div class="subhead">' + U.esc(T('当前属性')) + '</div>' +
      '<div class="statline">' + U.esc(specLine(a)) + '</div>';
    if (rec.br) {
      out += '<p class="note">' + U.esc(T('模块已装，不可更换——立场是出发前选的。想换请进化下一座。')) + '</p>';
=======
    var m = M.metaOf(e);
    var pr = M.rotPairOf(e, M.sel.r);
    var sz = P.size(pr.cells);
    var fm = P.FORM_BY[m.form];
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(m.nm) + '</b>' +
      '<em class="rv r' + m.rar + '">' + U.esc(I.full(P.RARITY[m.rar])) + '</em>' +
      (fm ? '<span class="fam" title="' + U.esc(T(fm.d)) + '">' + fm.sym + ' ' + U.esc(I.term(fm)) + '</span>' : '') +
      '</div>' +
      '<div class="handfig">' + R.shape(pr.cells, 150, m.rar, { glyphs: pr.glyphs }) + '</div>' +
      traitTags(m.traits) +
      '<div class="statline">' + H.kv('格数', U.n0(pr.cells.length)) + H.kv('外接', sz.w + '×' + sz.h) +
      H.kv('转向', (M.sel.r * 90) + '°') + '</div>' +
      '<div class="ff">' + H.btn('rot', T('转 90°（R）'), 'go') +
      H.btn('handnone', T('放回去'), 'ghost', false, T('把手上这件收回库里，空出手来。它不会丢。')) + '</div>' +
      /* 试算的读数落在这里。它随光标走，不动图面、不进撤销栈。 */
      '<div class="prev" id="prevbox"></div>' +
      '<p class="note dim">' + U.esc(T('把光标移到图纸上，按空格把它放下——外接框左下角就落在光标那一格。')) + '</p>' +
      '</div>';
  }

  /* ---------- 试算：放下去之后会怎样 ----------
     这一版的原则是「先知代替后悔」：信息要给在按空格之前，
     而不是让看的人靠事后反复试去凑。所以这里是往**克隆图**上放一件再问一次价：
     真身不动、计数不动、撤销栈不进。
     buildCtx 只读 M.stats / M.insts / M.metaOf，所以这个替身是安全的。 */
  var _pk = '', _pv = null;
  function tryAt(i, j) {
    var e = M.sel.e, r = M.sel.r | 0;
    if (!e || !M.canAt(i, j, e, r)) return null;
    var key = e + ':' + r + ':' + i + ':' + j + ':' + (S.seq | 0);
    if (key === _pk) return _pv;
    _pk = key;
    var clone = { cells: {} }, k, src = M.body().cells;
    for (k in src) clone.cells[k] = src[k];
    var cs = P.rotCells(M.cellsOf(e), r);
    if (!Bd.place(clone, i, j, e, r, cs, (S.seq | 0) + 1)) { _pv = null; return null; }
    var fake = {
      body: function () { return clone; },
      insts: function () { return Bd.instList(clone); },
      metaOf: M.metaOf,
      stats: function () { return Bd.stats(clone, M.metaOf); }
    };
    var out = null;
    try {
      var now = BS.auction.eval(M);
      var aft = BS.auction.eval(fake);
      out = {
        dBid: aft.total - now.total, kBid: aft.k - now.k,
        es0: now.ctx.st.esScore || 0, es1: aft.ctx.st.esScore || 0
      };
    } catch (err) { out = null; }
    _pv = out;
    return out;
  }
  function paintPrev(i, j) {
    var box = document.getElementById('prevbox');
    if (!box) return;
    if (!M.sel.e || i == null) { box.innerHTML = ''; _pk = ''; return; }
    if (!M.canAt(i, j, M.sel.e, M.sel.r)) {
      box.innerHTML = '<b>' + U.esc(T('试算')) + '</b><span class="no">' + U.esc(T('这里放不下')) + '</span>';
      return;
    }
    var v = tryAt(i, j);
    if (!v) { box.innerHTML = ''; return; }
    box.innerHTML = '<b>' + U.esc(T('试算')) + '</b>' +
      '<span class="pd">' + U.esc(BS.i18n.fill(T('估价 # 光'), (v.dBid >= 0 ? '+' : '') + U.big(Math.round(v.dBid)))) + '</span>' +
      '<span class="pe">' + U.esc(BS.i18n.fill(T('质变度 # → #'), v.es0.toFixed(2), v.es1.toFixed(2))) + '</span>' +
      '<span class="pk">' + U.esc(BS.i18n.fill(T('新站住 # 条'), (v.kBid >= 0 ? '+' : '') + U.n0(v.kBid))) + '</span>';
  }

  /* 选中的那一格：看数据，以及把它整件挪走 / 转过来 / 拆掉 */
  function cellInfo() {
    if (!sel) return '<div class="cinf"><p class="note dim">' +
      U.esc(T('点图纸上任意一格，看那一格的数据。看不会改动图面；选中之后可以用方向键整件平移。')) + '</p></div>';
    var a = sel.split(','), i = +a[0], j = +a[1];
    var c = Bd.at(M.body(), i, j);
    if (!c) return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(i + ' , ' + j) + '</b>' +
      '<em class="rv">' + U.esc(T('空格')) + '</em></div>' +
      '<p class="note dim">' + U.esc(T(M.sel.e
        ? '这里还没有东西。把光标停在这一格，按空格，手上那件就落在这里。'
        : '这里还没有东西。想放一件，先去右边「接下来几件」里拿一件。')) + '</p>' +
      '</div>';
    var m = M.metaOf(c.e), ins = Bd.instances(M.body())[Bd.instKeyOf(M.body(), Bd.key(i, j))];
    return '<div class="cinf">' +
      '<div class="cih"><b>' + U.esc(m.nm) + '</b>' +
      '<em class="rv r' + m.rar + '">' + U.esc(I.full(P.RARITY[m.rar])) + '</em></div>' +
      traitTags(m.traits) +
      '<div class="statline">' + H.kv('坐标', i + ' , ' + j) +
      H.kv('整件', U.n0(ins ? ins.cells.length : 0) + ' ' + T('格')) +
      H.kv('转向', ((c.r | 0) * 90) + '°') + '</div>' +
      '<div class="ff">' +
      H.btn('mv:' + sel + ':-1:0', '←', 'ghost small', false, T('整件往左挪一格')) +
      H.btn('mv:' + sel + ':1:0', '→', 'ghost small', false, T('整件往右挪一格')) +
      H.btn('mv:' + sel + ':0:1', '↑', 'ghost small', false, T('整件往上挪一格')) +
      H.btn('mv:' + sel + ':0:-1', '↓', 'ghost small', false, T('整件往下挪一格')) +
      '</div>' +
      '<div class="ff">' +
      H.btn('sp:' + sel + ':-1', T('逆转（Q）'), 'ghost small') +
      H.btn('sp:' + sel + ':1', T('正转（E）'), 'ghost small') +
      rmBtn(i, j) + '</div>' +
      rmWarn(i, j) +
      '<p class="note dim">' + U.esc(T('选中之后方向键就能整件平移，Q / E 原地转。平移与旋转不花元件，只有拆要。')) + '</p>' +
      '</div>';
  }

  /* ---------- 拆：先问一句，问得有内容，再真拆 ----------
     常 / 变 / 超三档问一遍；华 / 殿两档问两遍。
     分档的理由是代价不对称：拆掉一件 28~64 格的殿档件，实际代价是
     等到下一次抽到殿档为止（约 1.3%，十几分钟）。问第二遍不是防呆，
     是让「这一下很贵」这件事真的被看见一次。
     label 一律走 btnR：这几句都是拼出来的定稿串，再喂回 T() 会查不到词条。 */
  function rmStage(pk) { return pk && pk.rar >= 3 ? 2 : 1; }
  function rmBtn(i, j) {
    var pk = M.peekRemove(i, j);
    if (!pk) return '';
    if (pendingRm <= 0) {
      return H.btnR('rm:' + i + ',' + j, T('拆掉整件（Del）'), 'danger small', false,
        T('拆下来的元件不回库：整件永久离场。'));
    }
    var rar = I.full(P.RARITY[pk.rar]), act = 'rm:' + i + ',' + j, out = '';
    if (pendingRm >= rmStage(pk)) {
      out += H.btnR(act, T('确定：# 格，拆了就真的没了').replace('#', pk.cells), 'danger small');
    } else {
      out += H.btnR(act, T('「#」·# 格·# 档，拆了就没了，再点一次确认')
        .replace('#', pk.nm).replace('#', pk.cells).replace('#', rar), 'danger small');
    }
    out += H.btnR('rmcancel', T('取消'), 'ghost small');
    return out;
  }
  /* 拆件那一栏的常驻说明。它不只是警告——它要说清「还救不救得回来」，
     而这句话随撤销栈的状态变：这一步还留在栈里，就有救；被挤出去了，就没有。 */
  function rmWarn(i, j) {
    if (!M.peekRemove(i, j)) return '';
    var txt = pendingRm > 0
      ? T('拆下来不回库。现在按 Ctrl+Z 还救得回来；再挪 # 步，这一步就被挤出撤销栈了。').replace('#', M.undoCap())
      : T('拆下来的元件不回库：整件永久离场。先用试算看清楚，再决定拆不拆。');
    return '<p class="note warn">' + U.esc(txt) + '</p>';
  }

  function quickLib() {
    var mods = BS.tree.mods();
    var lim = mods.peek ? Math.max(3, mods.peekN) : 3;
    var pg = M.page(0, lim), out = '', i, r;
    if (!pg.rows.length) return '<p class="note dim">' + U.esc(T('库里空了，等来料落下来。')) + '</p>';
    for (i = 0; i < pg.rows.length; i++) {
      r = pg.rows[i];
      var pr = M.rotPairOf(r.e, 0);
      out += '<button class="ql" data-act="take:' + U.esc(r.e) + '"' +
        (M.sel.e === r.e ? ' on' : '') + ' title="' + U.esc(r.nm + ' · ' + I.full(P.RARITY[r.rar]) + ' · ' + pr.cells.length + ' ' + T('格') + '') + '">' +
        R.shape(pr.cells, 40, r.rar, { glyphs: pr.glyphs, plain: 1 }) +
        '<em class="rv r' + r.rar + '">' + U.esc(I.full(P.RARITY[r.rar])) + '</em>' +
        (r.traits && r.traits.length ? '<i class="qt">' + r.traits.map(function (t) {
          var tt = P.traitOf(t); return tt ? tt.sym : '';
        }).join('') + '</i>' : '') +
        '</button>';
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    }
    out += '<div class="subhead">' + U.esc(T('模块（三选一 · 一次性）')) + '</div><div class="bcards">';
    for (var z = 0; z < TD.BRANCHES.length; z++) out += branchCard(rec, TD.BRANCHES[z]);
    out += '</div>';
    /* 拆解还料：请不起的塔拆回元件。数量当场报出来——
        玩家要看得见「拆了这一座，库里会多回几枚」。 */
    var ps = rec.parts || [];
    out += '<div class="subhead">' + U.esc(T('拆解')) + '</div>' +
      '<p class="note">' + U.esc(T('把这座塔拆回 # 枚元件还库（淘汰它，流水仍在）。请不起的塔拆了拼一具小的——局外永远有路。').replace('#', ps.length)) + '</p>' +
      '<div class="ff">' +
      H.btnR('rm:' + rec.id, T('拆解还料'), 'x', false,
        T('从军械库淘汰这座塔，它的元件回到库裏。提交流水不受影响。')) +
      '</div>';
    return out + '</div>';
  }

  function typeLine(rec) {
    var f = P.FORM_BY[rec.form];
    return f ? '<span class="ttype">' + U.esc(f.sym + ' ' + I.term(f)) + '</span>' : '';
  }

  function render() {
<<<<<<< HEAD
    if (!host) return;
    var arm = BS.bus.state.armory || [];
    var fitted = 0, i;
    for (i = 0; i < arm.length; i++) if (arm[i].br) fitted++;
    var out = H.head('装配台', 'ASSEMBLY BENCH',
      '给进化体装模块：三块各认一种敌人，每块吃一项读数——同一块模块装在不同图形上效果不同。花结晶，一次性。请不起的塔可以拆解还料。');
    out += '<div class="statline">' +
      H.kv('结晶', '<b>' + U.n0(BS.bus.state.crystal) + '</b>') +
      H.kv('模块价', U.esc(I.fill('# 结晶', U.n0(SH.fitCost())))) +
      H.kv('已装模块', U.n0(fitted) + ' / ' + U.n0(arm.length)) +
      '</div>';
    if (!arm.length) {
      out += H.empty('军械库是空的。去图形工坊拼一具图形，提交进化。') +
        '<div class="ff">' + H.btnR('go:forge', T('去图形工坊'), 'ghost') + '</div>';
      host.innerHTML = out;
      bind();
      return;
    }
    var rec = null;
    for (i = 0; i < arm.length; i++) if (arm[i].id === sel) rec = arm[i];
    if (!rec) { sel = arm[0].id; rec = arm[0]; }
    out += '<div class="fcols"><div class="fcol-list">' + towerRows(arm) + '</div>' +
      '<div class="fcol-detail">' + benchPanel(rec) + '</div></div>';
    host.innerHTML = out;
    bind();
=======
    var st = M.stats();
    host.innerHTML =
      H.head('组装台', 'ASSEMBLY',
        T('装一件不进账。价是在呈交那一刻一次算的——把它做到什么份上，它就值多少。')) +
      goal() +
      '<div class="msg">' + U.esc(msg) + '</div>' +
      bidBox() +
      '<div class="asm">' +
      '<div class="asml">' +
      '<div class="sheetstage"><div class="sheetwrap">' + R.board(M.body(), {
        hint: !!S.prefs.hint, coords: !!S.prefs.coords, sel: sel, pitch: 22, pad: 6,
        rarOf: function (e) { return M.metaOf(e).rar; },
        glyphOf: function (e, dx, dy, r) { return M.glyphOf(e, r, dx, dy); },
        nmOf: function (e) { return M.metaOf(e).nm; }
      }) + '</div><div class="scan"></div><div class="coord">— , —</div></div>' +
      essBar(st) +
      '<div class="statline">' +
      H.kv('光', U.big(S.lux)) + H.kv('质变度', st.esScore.toFixed(3)) +
      H.kv('格', U.n0(st.n)) + H.kv('元件', U.n0(st.insts)) +
      H.kv('洞', U.n0(st.holes)) + H.kv('连通块', U.n0(st.comp)) +
      '</div>' +
      '<div class="ff">' +
      H.btn('undo', T('撤销（Ctrl+Z）'), 'ghost', !M.canUndo()) +
      (BS.tree.mods().autoRate > 0
        ? H.btn('auto', T('自动装配：#').replace('#', S.prefs.auto ? T('开') : T('关')), S.prefs.auto ? 'on' : 'ghost')
        : H.btn('go:tree', T('自动装配未点亮'), 'ghost', true, T('去脉络点亮「机」这条脉络'))) +
      H.btn('go:auction', T('呈交'), 'go') +
      H.btn('go:library', T('库（# 件）').replace('#', U.n0(M.libCount())), 'ghost') +
      '</div>' +
      '</div>' +
      '<div class="asmr">' +
      '<h3 class="sub">' + U.esc(T('接下来几件')) + '</h3>' + quickLib() +
      '<h3 class="sub">' + U.esc(T('手上')) + '</h3>' + hand() +
      '<h3 class="sub">' + U.esc(T('选中的格')) + '</h3>' + cellInfo() +
      '</div></div>' +
      H.note(T('上游每 # 秒落一件，而且只在你开着页面的时候落。落下的是什么由序号决定——你能决定的是怎么装。').replace('#', M.curPeriod().toFixed(1)));
    bind();
    bindGhost();
    if (hover) ghostAt(hover.i, hover.j);
  }

  function essBar(st) {
    var e = st.es || {}, defs = BS.essence.DEFS, out = '', i;
    for (i = 0; i < defs.length; i++) {
      var v = e[defs[i].k] || 0;
      /* 名字与说明是表项自带的四语，走 term，不往叠加层词典里塞一份 */
      out += '<span class="eb" title="' + U.esc(I.term(defs[i].d)) + '">' +
        '<b>' + U.esc(I.term(defs[i])) + '</b>' +
        '<i><u style="width:' + Math.round(v * 100) + '%"></u></i>' +
        '<em>' + v.toFixed(2) + '</em></span>';
    }
    return '<div class="ebs">' + out + '</div>';
  }

  /* ---------- 落点预览 ---------- */
  function ghostAt(i, j) {
    var svg = q('.fig.board');
    var g = svg ? svg.querySelector('.bgghost') : null;
    if (!g) return;
    /* 实时坐标：光标在哪一格，图纸右下角就报哪一格。
       鼠标离开后读数留着（转暗）——仪表的数是留着回看的，不是擦给人看的。 */
    var cd = q('.coord');
    if (cd && i != null) U.setText(cd, i + ' , ' + j);
    /* 试算跟着光标走：能放就报「放下去会怎样」，放不下就直说放不下 */
    paintPrev(i, j);
    if (!M.sel.e || i == null) { g.innerHTML = ''; return; }
    var pr = M.rotPairOf(M.sel.e, M.sel.r);
    var ok = M.canAt(i, j, M.sel.e, M.sel.r);
    var out = '', z;
    for (z = 0; z < pr.cells.length; z++) {
      var pt = R.cellXY(svg, i + pr.cells[z][0], j + pr.cells[z][1]);
      out += '<rect class="bgh' + (ok ? '' : ' no') + '" x="' + (pt.x - pt.pt / 2) +
        '" y="' + (pt.y - pt.pt / 2) + '" width="' + pt.pt + '" height="' + pt.pt + '"/>';
    }
    g.innerHTML = out;
    var o = R.cellXY(svg, i, j);
    g.innerHTML += '<rect class="bgh anchor' + (ok ? '' : ' no') + '" x="' + (o.x - o.pt / 2) +
      '" y="' + (o.y - o.pt / 2) + '" width="' + o.pt + '" height="' + o.pt + '"/>';
  }
  function clearGhost() {
    var g = q('.fig.board .bgghost');
    if (g) g.innerHTML = '';
    paintPrev(null, null);
  }
  function bindGhost() {
    var svg = q('.fig.board');
    if (!svg) return;
    svg.addEventListener('mousemove', function (ev) {
      var t = ev.target;
      while (t && t !== svg && !t.getAttribute('data-act')) t = t.parentNode;
      if (!t || t === svg) { hover = null; clearGhost(); return; }
      var a = t.getAttribute('data-act') || '';
      if (a.indexOf('c:') !== 0) { hover = null; clearGhost(); return; }
      var p = a.slice(2).split(':');
      hover = { i: +p[0], j: +p[1] };
      ghostAt(hover.i, hover.j);
    });
    svg.addEventListener('mouseleave', function () { hover = null; clearGhost(); });
  }

  function say(r, good) {
    if (!r) return;
    msg = r.ok ? (good || T('成了。')) : (r.why || T('不成。'));
  }
  function bidSay(nm) {
    var v = 0;
    try { v = BS.auction.eval(M).total || 0; } catch (e) { v = 0; }
    return T('装上「#」。此刻估价 # 光。').replace('#', nm).replace('#', U.big(Math.round(v)));
  }

  function placeAt(i, j) {
    if (!M.sel.e) { msg = T('手上是空的。先按右边的「接下来几件」拿一件。'); mark(); render(); return; }
    var e2 = M.sel.e, nm = M.metaOf(e2).nm;
    var r = M.place(i, j, e2, M.sel.r);
    if (r.ok) {
      msg = bidSay(nm);
      lastPlace = { nm: nm, conn: r.conn };
      try {
        var got = BS.achieve.scan(M);
        if (got && got.length && BS.app.showToast) BS.app.showToast(got);
      } catch (err) { /* 由它去 */ }
    } else {
      say(r, T('装上「#」。').replace('#', nm));
    }
    sel = null;
    mark(); render();
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  }

  /* 选中的那一格整件挪一格。挪完选中框跟着走，连着按就能一直挪。 */
  function doMove(i, j, dx, dy) {
    var r = M.move(i, j, dx, dy);
    if (r.ok) {
      sel = Bd.key(i + dx, j + dy);
      msg = T('挪了一格。');
    } else msg = r.why;
    mark(); render();
  }
  function doSpin(i, j, dir) {
    var r = M.spin(i, j, dir);
    msg = r.ok ? T('转了 #°。').replace('#', r.r * 90) : r.why;
    mark(); render();
  }
  /* 拆之前的那一问：够数了才真拆。 */
  function onRm(i, j) {
    var pk = M.peekRemove(i, j);
    if (!pk) { doRemove(i, j); return; }
    if (pendingRm >= rmStage(pk)) { pendingRm = 0; doRemove(i, j); return; }
    pendingRm++;
    mark(); render();
  }
  function doRemove(i, j) {
    var r = M.removeAt(i, j);
    /* 两句话的分野是撤销栈：这一步还留在栈里就说「还救得回来」，
       被挤出去了就说「没了」。写给用户看的话必须等于实际能做的事。 */
    msg = r.ok
      ? (r.guarded
        ? T('拆掉了整件。它回不来了——Ctrl+Z 还救得回来，但再挪 # 步就挤不进撤销栈了。').replace('#', M.undoCap())
        : T('拆掉了整件。它回不来了，撤销栈里也装不下这一步了。'))
      : r.why;
    sel = null; pendingRm = 0; mark(); render();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
<<<<<<< HEAD
      if (a.indexOf('sel:') === 0) { sel = +a.slice(4); render(); return; }
      if (a.indexOf('fit:') === 0) {
        var m = a.slice(4).split(':');
        var o = SH.fit(+m[0], m[1]);
        if (!o.ok) B.log(o.why, 'sys');
        else B.log(BS.i18n.fill('装上了 #（-# 结晶）', T(TD.BRANCH_BY[o.br].t), o.cost), 'sys');
        render();
        return;
      }
      if (a.indexOf('rm:') === 0) {
        var o2 = SH.discard(+a.slice(3));
        if (!o2.ok) B.log(o2.why, 'sys');
        else {
          B.log(BS.i18n.fill('拆解：# 枚元件还库', o2.back), 'sys');
          if (sel === +a.slice(3)) sel = -1;
        }
        render();
        return;
      }
      if (a.indexOf('go:') === 0 && BS.app && BS.app.go) BS.app.go(a.slice(3));
=======
      /* 除了 rm 自己往下走，任何别的动作都把「拆」这一问清掉：
         换了格、挪了件、转了向，刚才那一问说的就已经不是同一件事了。 */
      if (a.indexOf('rm:') !== 0) pendingRm = 0;
      if (a === 'rot') { M.sel.r = (M.sel.r + 1) % 4; msg = ''; mark(); render(); }
      else if (a === 'handnone') { M.sel.e = null; M.sel.r = 0; msg = ''; mark(); render(); }
      else if (a.indexOf('take:') === 0) { M.sel.e = a.slice(5); M.sel.r = 0; msg = ''; mark(); render(); }
      else if (a === 'undo') {
        var u = M.undo();
        msg = u.ok ? T('撤销了一步。') : u.why;
        lastPlace = null; sel = null; mark(); render();
      }
      else if (a === 'auto') { BS.app.toggleAuto(); mark(); render(); }
      else if (a.indexOf('c:') === 0) {
        var p = a.slice(2).split(':');
        sel = Bd.key(+p[0], +p[1]);
        msg = ''; lastPlace = null; mark(); render();
      }
      else if (a.indexOf('mv:') === 0) {
        var m1 = a.slice(3).split(':').map(Number);
        doMove(m1[0], m1[1], m1[2], m1[3]);
      }
      else if (a.indexOf('sp:') === 0) {
        var m2 = a.slice(3).split(':').map(Number);
        doSpin(m2[0], m2[1], m2[2]);
      }
      else if (a === 'rmcancel') { pendingRm = 0; msg = ''; mark(); render(); }
      else if (a.indexOf('rm:') === 0) {
        var m3 = a.slice(3).split(',').map(Number);
        onRm(m3[0], m3[1]);
      }
      else if (a.indexOf('go:') === 0) B.emit('goto', { id: a.slice(3) });
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    });
  }

  BS.reg.add({
<<<<<<< HEAD
    id: 'assembly', n: '10', t: '装配台', sub: 'ASSEMBLY BENCH',
    mount: function (h) {
      host = h; dirty = false; sel = -1;
      offs.push(B.on('armory', function () { dirty = true; }));
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
=======
    id: 'assembly', n: '0', t: '组装台', sub: 'ASSEMBLY',
    badge: function () { return String(M.stats().n); },
    mount: function (h) { host = h; msg = ''; pendingRm = 0; render(); },
    tick: function () {
      if (!host) return;
      if (dirty) { dirty = false; render(); return; }
      if (M.sel.e && ((S.gone || {})[M.sel.e] || M.placedSet()[M.sel.e])) {
        M.sel.e = null; M.sel.r = 0; mark(); render();
      }
    }
  });
  B.on('body', mark); B.on('lib', mark); B.on('restore', function () { lastPlace = null; hover = null; sel = null; mark(); });
  B.on('lux', mark); B.on('quest', mark); B.on('hand', mark); B.on('tree', mark); B.on('auc', mark);

  /* 空格＝放下。键是总台收的（它才知道焦点在哪个输入框里），
     收到之后转给这一页；不在这一页就装作没听见。 */
  B.on('key:space', function () {
    if (!host || !BS.app || BS.app.cur() !== 'assembly') return;
    if (!M.sel.e) { msg = T('手上是空的。先按右边的「接下来几件」拿一件。'); mark(); render(); return; }
    if (!hover) { msg = T('先把光标移到图纸上，再按空格——落点就是光标那一格。'); mark(); render(); return; }
    placeAt(hover.i, hover.j);
  });
  /* 选中的那一格：方向键平移 / Q E 转 / Delete 拆 */
  function selIJ() {
    if (!sel || !host || !BS.app || BS.app.cur() !== 'assembly') return null;
    var a = sel.split(',');
    return [+a[0], +a[1]];
  }
  B.on('key:move', function (d) {
    var p = selIJ();
    if (!p || !d) return;
    doMove(p[0], p[1], d.dx | 0, d.dy | 0);
  });
  B.on('key:spin', function (d) {
    var p = selIJ();
    if (!p) return;
    doSpin(p[0], p[1], d && d.dir < 0 ? -1 : 1);
  });
  /* Delete 走的是同一条确认链：键盘看的人不该比鼠标看的人少问一句。 */
  B.on('key:del', function () {
    var p = selIJ();
    if (!p) return;
    onRm(p[0], p[1]);
  });
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
})(window.BS);
