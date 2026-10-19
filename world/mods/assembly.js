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
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts, SH = BS.shop, TD = BS.td;

  var host = null, dirty = false, offs = [];
  var sel = -1;            /* 选中的在库编号；-1 = 没选 */

  function specLine(a) {
    return T('伤害 # · 攻速 # · 射程 # · 弹 # · 连锁 #')
      .replace('#', a.dmg.toFixed(1)).replace('#', a.rate.toFixed(1))
      .replace('#', a.range.toFixed(1)).replace('#', a.proj).replace('#', a.chain);
  }

  function miniGrid(rec, cls) {
    var sz = P.size(rec.cells), out = '', x, y, set = {}, i;
    for (i = 0; i < rec.cells.length; i++) set[rec.cells[i][0] + ',' + rec.cells[i][1]] = 1;
    for (y = 0; y < sz.h; y++) {
      for (x = 0; x < sz.w; x++) out += '<i class="' + (set[x + ',' + y] ? 'on' : '') + '"></i>';
    }
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
    });
  }

  BS.reg.add({
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
})(window.BS);
