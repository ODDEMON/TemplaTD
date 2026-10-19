/* world/mods/measure.js —— 测量。
   ------------------------------------------------------------------
   照搬 CONFIGURA 测量界面的可用内容：质变六项是主角，每一项
   挂着它底下的判据（权重 / 读数 / 「凭什么这么说」），点开逐条摊开；
   六项全部真算，没有一项是估算。目标可切换：工坊图纸 / 花园全园 /
   军械库最新的进化体 / **本局阵型**。

   「本局阵型」是这一版新加的第四个目标：战场上摆下的那些塔，
   本身就是一具图形——用同一把尺子量它，于是「我这阵摆成了什么形状」
   第一次有了数字。它与战斗里那个接管十二个标量的阵型乱流
   是同一个 formation()，一处算、两处看。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts;

  var host = null, dirty = false, offs = [];
  var open = '', target = 'shop';

  function mark() { dirty = true; }

  /* ---------- 目标：量哪一具 ---------- */
  function targets() {
    var has = BS.run && BS.run.current && BS.run.current();
    return [
      { id: 'shop', t: '工坊图纸' },
      { id: 'garden', t: '花园全园' },
      { id: 'armory', t: '最新进化体' },
      { id: 'field', t: '本局阵型', off: !has }
    ];
  }
  /* 本局阵型的格子表：战场上的塔就是这具图形的格。
     与 run.formation() 同一套构造——一处算、两处看。 */
  function fieldCells() {
    var r = BS.run && BS.run.current ? BS.run.current() : null;
    var b = r && r.battle, out = {}, i;
    if (!b) return out;
    for (i = 0; i < b.towers.length; i++) {
      out[b.towers[i].cx + ',' + b.towers[i].cy] =
        { e: 'f' + i, ox: b.towers[i].cx, oy: b.towers[i].cy, r: 0, seq: i };
    }
    return out;
  }
  function curFig() {
    if (target === 'field') {
      var cs = fieldCells();
      if (!Object.keys(cs).length) return null;
      return { cells: Object.keys(cs).map(function (k) {
        var u = BS.body.unkey(k); return [u[0], u[1]];
      }), form: 'field', rar: 0, traits: [], parts: [] };
    }
    if (target === 'garden') {
      var cs = BS.garden.board().cells;
      if (!Object.keys(cs).length) return null;
      return BS.shop.figFrom(cs);
    }
    if (target === 'armory') {
      var arm = BS.bus.state.armory;
      if (!arm.length) return null;
      var rec = arm[arm.length - 1];
      return { cells: rec.cells, form: rec.form, rar: rec.rar, traits: rec.traits, parts: [] };
    }
    return BS.shop.figure();
  }

  function show(st, k) {
    var v = st[k];
    if (k === 'tree') return v ? T('是') : T('否');
    if (k === 'theta') return U.fmt(v * 180 / Math.PI, 1) + '°';
    if (k === 'red' || k === 'turnR' || k === 'boxfill' || k === 'fill') return (v * 100).toFixed(1) + '%';
    if (k.indexOf('es') === 0 && typeof v === 'number') return v.toFixed(3);
    return U.fmt(v);
  }

  /* ---------- 质变六项：主角 ---------- */
  function essenceBlock(st) {
    var detail = st.esDetail || {};
    var defs = BS.essence.DEFS, out = '', i;
    for (i = 0; i < defs.length; i++) {
      var d = defs[i], dd = detail[d.k] || { parts: [], v: 0 };
      var v = st[BS.essence.statKey(d.k)] || 0;
      var g = BS.essence.grade(v);
      var isOpen = open === d.k;
      out += '<div class="es4' + (isOpen ? ' open' : '') + '">' +
        '<button class="es4h" data-act="es:' + d.k + '">' +
        '<span class="e4t">' + U.esc(I.term(d)) + '</span>' +
        '<span class="e4d">' + U.esc(I.term(d.d)) + '</span>' +
        '<span class="e4ask"><b>' + U.esc(T('怎么验')) + '</b>' +
        (I.lang === 'zh' ? '：' : ': ') + U.esc(I.term(d.ask)) + '</span>' +
        '<span class="e4b"><i style="width:' + Math.round(v * 100) + '%"></i></span>' +
        '<span class="e4v">' + v.toFixed(3) + '</span>' +
        '<span class="esg g' + g.i + '">' + U.esc(I.term(g)) + '</span>' +
        '</button>' +
        (isOpen ? partsHtml(dd) : '') +
        '</div>';
    }
    var score = st.esScore || 0;
    out += '<div class="es4 tot"><div class="es4h">' +
      '<span class="e4t">' + U.esc(T('质变度')) + '</span>' +
      '<span class="e4d">' + U.esc(T('六项的加权几何平均')) + '</span>' +
      '<span class="e4b"><i style="width:' + Math.round(score * 100) + '%"></i></span>' +
      '<span class="e4v">' + score.toFixed(3) + '</span>' +
      '</div></div>';
    return '<div class="es4s">' + out + '</div>';
  }

  /* 一项指标底下的判据：权重、读数、以及它凭什么这么说 */
  function partsHtml(dd) {
    if (!dd.parts || !dd.parts.length) return '';
    var out = '<div class="e4p"><p class="note dim">' +
      U.esc(I.fill(T('这一项由下面 # 条判据按权重合成，每条都是真算的。'), dd.parts.length)) + '</p>';
    for (var i = 0; i < dd.parts.length; i++) {
      var p = dd.parts[i];
      out += '<div class="p4">' +
        '<span class="p4i">' + U.esc(p.id) + '</span>' +
        '<span class="p4t">' + U.esc(T(p.t)) + '</span>' +
        '<span class="p4w">' + T('权重') + ' ' + Math.round(p.w * 100) + '%</span>' +
        '<span class="p4b"><i style="width:' + Math.round(U.clamp(p.v, 0, 1) * 100) + '%"></i></span>' +
        '<span class="p4v">' + p.v.toFixed(3) + '</span>' +
        '<span class="p4n">' + U.esc(I.tell(p.note)) + '</span>' +
        '</div>';
    }
    return out + '</div>';
  }

  /* ---------- 其余系数：挑玩家读得懂的摆一栏 ---------- */
  var COEFS = [
    ['n', '格数'], ['insts', '元件'], ['holes', '洞'], ['comp', '连通块'],
    ['P', '周长'], ['e', '边'], ['cyc', '回路'], ['leaf', '叶'],
    ['dia', '最长链'], ['cheb', '半径（切比雪夫）'], ['euc', '半径（欧氏）'],
    ['aspect', '纵横比'], ['boxfill', '框填充'], ['exposure', '暴露度'],
    ['circularity', '圆度'], ['fractal', '分形维数'], ['aniso', '各向异性'],
    ['tree', '是树'], ['rarMax', '最高稀有度'], ['rarMix', '稀有度混档']
  ];
  function groups(st) {
    var out = '<div class="mcols"><div class="col">', i;
    for (i = 0; i < COEFS.length; i++) {
      out += H.rowR(T(COEFS[i][1]), show(st, COEFS[i][0]));
    }
    return out + '</div></div>';
  }

  /* ---------- 板上的构成 ---------- */
  function tallyBoard(cells) {
    var insts = {}, k, c;
    for (k in cells) {
      c = cells[k];
      insts[c.e] = (insts[c.e] || 0) + 1;
    }
    var traits = {}, forms = {}, rar = [0, 0, 0, 0, 0], e;
    for (e in insts) {
      var part = BS.shop.partOf(e.slice(1) | 0);
      rar[part.rar] += insts[e];
      for (var z = 0; z < part.traits.length; z++) traits[part.traits[z]] = (traits[part.traits[z]] || 0) + insts[e];
      forms[part.form] = (forms[part.form] || 0) + insts[e];
    }
    var out = '<div class="tally">';
    out += '<span class="tl">' + U.esc(T('资质')) + '</span>' +
      P.RARITY.map(function (r, i2) {
        return '<span class="rv r' + i2 + '">' + U.esc(I.term(r, 'full')) + '</span><b>' + U.n0(rar[i2]) + '</b>';
      }).join('') + '</div>';
    var t2 = '<div class="tally"><span class="tl">' + U.esc(T('特质')) + '</span>', any = false, j;
    for (j = 0; j < P.TRAITS.length; j++) {
      var n2 = traits[P.TRAITS[j].id] || 0;
      if (!n2) continue;
      any = true;
      t2 += '<span class="tr" title="' + U.esc(T(P.TRAITS[j].d)) + '"><i>' + P.TRAITS[j].sym + '</i>' +
        U.esc(I.term(P.TRAITS[j])) + '</span><b>' + U.n0(n2) + '</b>';
    }
    t2 += any ? '</div>' : U.esc(T('没有带特质的元件')) + '</div>';
    var f2 = '<div class="tally"><span class="tl">' + U.esc(T('型')) + '</span>', any2 = false;
    for (j = 0; j < P.FORMS.length; j++) {
      var n3 = forms[P.FORMS[j].id] || 0;
      if (!n3) continue;
      any2 = true;
      f2 += '<span class="fam">' + P.FORMS[j].sym + ' ' + U.esc(I.term(P.FORMS[j])) + '</span><b>' + U.n0(n3) + '</b>';
    }
    f2 += any2 ? '</div>' : U.esc(T('板是空的')) + '</div>';
    return out + t2 + f2;
  }

  function render() {
    if (!host) return;
    var fig = curFig();
    if (!fig) {
      host.innerHTML = H.head('测量', 'MEASURE', T('没有东西可以量。')) +
        H.empty(T('目标上是空的。')) +
        '<div class="ff">' + targetBtns() + '</div>';
      return;
    }
    var part = { cells: fig.cells, form: fig.form, traits: fig.traits, rar: fig.rar, i: null };
    var r = BS.tower.read(part);
    var st = r.st;
    var ts = targets(), out = H.head('测量', 'MEASURE',
      T('全部真算，没有一项是估算。六项质变指标是主角，每项都写着「自己怎么验」，点开看底下判据各读到多少、凭什么。'));
    out += '<div class="ff">';
    for (var i = 0; i < ts.length; i++) {
      out += H.btnR('tg:' + ts[i].id, T(ts[i].t),
        target === ts[i].id ? 'on' : 'ghost', !!ts[i].off);
    }
    out += '</div>';
    out += '<div class="statline">' +
      H.kv('质变度', (st.esScore || 0).toFixed(3)) +
      H.kv('格', U.n0(st.n)) + H.kv('元件', U.n0(st.insts)) +
      H.kv('轮廓', U.n0(st.P) + ' ' + T('边')) + H.kv('洞', U.n0(st.holes)) +
      H.kv('连通块', U.n0(st.comp)) +
      '</div>';
    out += '<h3 class="sub">' + U.esc(T('质变六项')) + '</h3>' + essenceBlock(st);
    out += '<h3 class="sub">' + U.esc(T('板上的构成')) + '</h3>' + tallyBoard(srcCells());
    out += '<h3 class="sub">' + U.esc(T('其余系数')) + '</h3>' + groups(st);
    host.innerHTML = out;
    bind();
  }

  /* 测量目标的原始格位表（构成统计要用元件实例，不能用归一化格） */
  function srcCells() {
    if (target === 'field') return fieldCells();
    if (target === 'garden') return BS.garden.board().cells;
    if (target === 'armory') {
      var arm = BS.bus.state.armory;
      if (!arm.length) return {};
      var rec = arm[arm.length - 1], out = {}, i;
      for (i = 0; i < rec.cells.length; i++) {
        out[rec.cells[i][0] + ',' + rec.cells[i][1]] = { e: 'p' + (rec.parts && rec.parts[0] != null ? rec.parts[0] : 0), ox: 0, oy: 0, r: 0, seq: 0 };
      }
      return out;
    }
    return BS.shop.board().cells;
  }

  function targetBtns() {
    var ts = targets(), out = '', i;
    for (i = 0; i < ts.length; i++) {
      out += H.btnR('tg:' + ts[i].id, T(ts[i].t),
        target === ts[i].id ? 'on' : 'ghost', !!ts[i].off);
    }
    return out;
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('es:') === 0) {
        var k = a.slice(3);
        open = (open === k) ? '' : k;
        render();
      } else if (a.indexOf('tg:') === 0) {
        target = a.slice(3);
        open = '';
        render();
      }
    });
  }

  BS.reg.add({
    id: 'measure', n: '8', t: '测量', sub: 'MEASURE',
    mount: function (h) {
      host = h; dirty = false; open = '';
      offs.push(B.on('shop', function () { mark(); }));
      offs.push(B.on('garden', function () { mark(); }));
      offs.push(B.on('armory', function () { mark(); }));
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
