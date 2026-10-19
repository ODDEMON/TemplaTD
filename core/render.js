/* core/render.js —— 把图形画成矢量。
   图纸不设边界：视框按已有格自动向外扩两圈，图多大，图纸就多大。
   没有展示抽样——有多少格就画多少格；代价就是代价，写在设置页里。

   元件没有颜色差异：一格就是一种颜色，五档资质共用同一支笔。
   资质不再靠色相区分——它写在长相里（多大、多繁、多空），
   也写在标签上。辉光只在高档上多给一点光晕，色相一动不动。

   一格画什么，由这一件的**字形**决定：方块、十字、丁字、L 折、缺口块、
   斜带、工字、凹口，以及会顺着邻居自己连成网的连线（粗线与细线）。
   实心字形一律四条边都贴得住——只在角上点一下、或缩在格心（点、星、圆、
   正三角、梯形、平行四边形、直角三角形、半格、粗带、斜线、菱、五/六/八边形）
   排成一排就散成孤块，所以已经整条删掉。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, Bd = BS.body, P = BS.parts;

  var LOWCAP = { blur: 1.2 };
  function low() {
    var S = BS.bus && BS.bus.state;
    return !!(S && S.prefs && S.prefs.low);
  }
  function eff(k) {
    if (!low()) return k === 'blur' ? 2.4 : 1;
    return LOWCAP[k] === undefined ? 1 : LOWCAP[k];
  }

  /* 五档共用一支笔。--fc 是唯一的格色。 */
  var CELL = 'var(--fc)';
  function rarFill() { return CELL; }

  function defs() {
    if (low()) return '';
    var b1 = eff('blur'), b2 = b1 * 1.9;
    return '<defs>' +
      '<filter id="odg1" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feGaussianBlur stdDeviation="' + b1 + '" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="odg2" x="-70%" y="-70%" width="240%" height="240%">' +
      '<feGaussianBlur stdDeviation="' + b2 + '" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';
  }
  /* 高档（华 / 殿）多一层光晕。这是亮度上的差别，不是颜色上的。 */
  function gf(r) {
    if (low() || (r | 0) < 3) return '';
    return ' filter="url(#' + ((r | 0) >= 4 ? 'odg2' : 'odg1') + ')"';
  }

  /* ---------- 一个字形怎么画 ----------
     x,y 是这一格左上角的 svg 坐标，pt 是格距。
     nbr 是四邻掩码（1 右 2 左 4 下 8 上），只有 net 用它。 */
  function ptsStr(pts, x, y, pt) {
    var s = '', i;
    for (i = 0; i < pts.length; i++) {
      s += (i ? ' ' : '') + (x + pts[i][0] * pt).toFixed(2) + ',' + (y + pts[i][1] * pt).toFixed(2);
    }
    return s;
  }
  function glyphSVG(id, x, y, pt, nbr, cls) {
    var g = P.glyph(id);
    var w = Math.max(0.7, Math.min(2.2, pt * 0.15));
    if (g.k === 'poly') {
      return '<polygon class="' + (cls || 'bc') + '" points="' + ptsStr(g.pts, x, y, pt) + '" fill="' + CELL + '"/>';
    }
    /* 叉号：两道对角笔画，从角到角。
       相邻两格的斜笔在它们公用的那个角上接得上，所以一串叉号看着是
       一条连续的折线——它是个「记号」，连接靠的是折线本身，不是边中点。 */
    if (g.k === 'x') {
      var mx = Math.max(0.7, Math.min(2.2, pt * 0.13));
      var x0 = x.toFixed(2), y0 = y.toFixed(2), x1 = (x + pt).toFixed(2), y1 = (y + pt).toFixed(2);
      return '<path class="' + (cls || 'bx') + '" fill="none" stroke="' + CELL +
        '" stroke-width="' + mx.toFixed(2) + '" stroke-linecap="round" ' +
        'd="M' + x0 + ' ' + y0 + 'L' + x1 + ' ' + y1 + 'M' + x1 + ' ' + y0 + 'L' + x0 + ' ' + y1 + '"/>';
    }
    /* line（粗线）与 net（细线）：一视同仁地**按邻居出笔**——
       从格心往每一个真的挨着的邻格画到边中点。连起来之后，整件是一张
       连成一片的网：拐角处自然拐弯，也绝不会出现「各画各的一段」。
       四边都没有邻格时（只有孤零零一格才这样）画一小段横桩，
       而不是一个圆点——圆点看着像颗浮着的小珠子。 */
    var wS = (g.k === 'line') ? w : Math.max(0.55, w * 0.62);
    var d = '', cx = x + pt / 2, cy = y + pt / 2;
    if (nbr & 1) d += 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) + 'L' + (x + pt).toFixed(2) + ' ' + cy.toFixed(2);
    if (nbr & 2) d += 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) + 'L' + x.toFixed(2) + ' ' + cy.toFixed(2);
    if (nbr & 4) d += 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) + 'L' + cx.toFixed(2) + ' ' + (y + pt).toFixed(2);
    if (nbr & 8) d += 'M' + cx.toFixed(2) + ' ' + cy.toFixed(2) + 'L' + cx.toFixed(2) + ' ' + y.toFixed(2);
    if (!d) {
      var hw = pt * 0.28;
      d = 'M' + (cx - hw).toFixed(2) + ' ' + cy.toFixed(2) + 'L' + (cx + hw).toFixed(2) + ' ' + cy.toFixed(2);
    }
    return '<path class="' + (cls || 'bl') + '" d="' + d + '" fill="none" stroke="' + CELL +
      '" stroke-width="' + wS.toFixed(2) + '" stroke-linecap="round"/>';
  }

  /* 邻居掩码：只认同一件元件的格。两件挨在一起时，线不会串到隔壁去。 */
  function nbrMask(own, x, y) {
    var m = 0;
    if (own[(x + 1) + ',' + y]) m |= 1;
    if (own[(x - 1) + ',' + y]) m |= 2;
    if (own[x + ',' + (y + 1)]) m |= 4;
    if (own[x + ',' + (y - 1)]) m |= 8;
    return m;
  }

  /* ---------- 图纸 ----------
     pad 决定「已有的格之外再画几圈」。组装台给得宽（默认 6），
     因为放件这件事不该被视框限制。 */
  function board(b, opt) {
    opt = opt || {};
    var ls = Bd.list(b), n = ls.length, i, j, z;
    var PAD = opt.pad == null ? 6 : opt.pad, i0 = 0, i1 = 0, j0 = 0, j1 = 0;
    if (n) {
      i0 = Infinity; j0 = Infinity; i1 = -Infinity; j1 = -Infinity;
      for (z = 0; z < n; z++) {
        if (ls[z].i < i0) i0 = ls[z].i;
        if (ls[z].i > i1) i1 = ls[z].i;
        if (ls[z].j < j0) j0 = ls[z].j;
        if (ls[z].j > j1) j1 = ls[z].j;
      }
    }
    i0 -= PAD; i1 += PAD; j0 -= PAD; j1 += PAD;
    var nx = i1 - i0 + 1, ny = j1 - j0 + 1;
    var pt = opt.pitch || 22;
    var ML = 26, MB = 16;
    var W = nx * pt + ML, H = ny * pt + MB;
    function X(v) { return ML + (v - i0) * pt + pt / 2; }
    function Y(v) { return (j1 - v) * pt + pt / 2; }

    var out = defs();
    var fine = '', coarse = '';
    for (i = 0; i <= nx; i++) {
      fine += 'M' + (ML + i * pt) + ' 0V' + (ny * pt);
      if ((i0 + i) % 4 === 0) coarse += 'M' + (ML + i * pt) + ' 0V' + (ny * pt);
    }
    for (j = 0; j <= ny; j++) {
      fine += 'M' + ML + ' ' + (j * pt) + 'H' + (ML + nx * pt);
      if ((j1 - j) % 4 === 0) coarse += 'M' + ML + ' ' + (j * pt) + 'H' + (ML + nx * pt);
    }
    out += '<path class="gfine" d="' + fine + '"/>';
    out += '<path class="gcoarse" d="' + coarse + '"/>';

    /* 外轮廓只是这一具的「脚印」：极淡的一层，不抢字形。 */
    out += '<path class="bout" fill-rule="evenodd" d="' +
      Bd.pathOf(Bd.boundary(b)) + '" transform="translate(' + (ML + (0.5 - i0) * pt) + ' ' + ((j1 + 0.5) * pt) +
      ') scale(' + pt + ' ' + (-pt) + ')"/>';

    /* 按实例分组：同一件的格才算邻居，net 才连得对 */
    var instOf = {}, own = {}, gl = opt.glyphOf || null, rarOf = opt.rarOf || null;
    for (z = 0; z < n; z++) {
      var c = ls[z];
      var ik = c.e + '@' + c.ox + ',' + c.oy;
      instOf[Bd.key(c.i, c.j)] = ik;
      (own[ik] = own[ik] || {})[Bd.key(c.i, c.j)] = 1;
    }
    var cells = '', nmf = opt.nmOf || null;
    for (z = 0; z < n; z++) {
      var cc = ls[z], rr = rarOf ? (rarOf(cc.e) | 0) : 0;
      var gid = gl ? (gl(cc.e, cc.i - cc.ox, cc.j - cc.oy, cc.r | 0) || 'sq') : 'sq';
      var own2 = own[instOf[Bd.key(cc.i, cc.j)]] || {};
      cells += '<g' + gf(rr) + '><title>' + U.esc((nmf ? nmf(cc.e) : cc.e) + ' · ' + cc.i + ',' + cc.j) + '</title>' +
        glyphSVG(gid, X(cc.i) - pt / 2, Y(cc.j) - pt / 2, pt, nbrMask(own2, cc.i, cc.j)) + '</g>';
    }
    out += cells;

    if (opt.sel) {
      var sc = Bd.unkey(opt.sel);
      out += '<rect class="bsel" x="' + (X(sc[0]) - pt / 2) + '" y="' + (Y(sc[1]) - pt / 2) +
        '" width="' + pt + '" height="' + pt + '"/>';
    }
    if (opt.hint) {
      var dots = '', seen = {}, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (z = 0; z < n; z++) {
        for (var q = 0; q < 4; q++) {
          var a = ls[z].i + dirs[q][0], c2 = ls[z].j + dirs[q][1], kk = a + ',' + c2;
          if (Bd.at(b, a, c2) || seen[kk]) continue;
          seen[kk] = 1;
          dots += '<circle class="bopen" cx="' + X(a) + '" cy="' + Y(c2) + '" r="1.4"/>';
        }
      }
      out += dots;
    }
    if (opt.coords) {
      var lab = '';
      for (i = i0; i <= i1; i++) if (i % 4 === 0) lab += '<text class="bco" x="' + X(i) + '" y="' + (ny * pt + 12) + '">' + i + '</text>';
      for (j = j0; j <= j1; j++) if (j % 4 === 0) lab += '<text class="bco l" x="' + (ML - 8) + '" y="' + (Y(j) + 3) + '">' + j + '</text>';
      out += lab;
    }

    /* 繁的一面（两面页用）：每件画一道外接框，每格注一个坐标。
       格子太多就自动退稀（step 2 / 4）——这部作品只承认算得动的密度，
       这一点它在设置页「算不动的地方」里一贯坦陈。 */
    if (opt.dense && n) {
      var seenD = {}, dbox = '', kd;
      for (z = 0; z < n; z++) {
        var cd = ls[z], ikd = cd.e + '@' + cd.ox + ',' + cd.oy;
        if (seenD[ikd]) continue;
        seenD[ikd] = 1;
        var ownd = own[ikd] || {}, a0 = Infinity, b0 = Infinity, a1 = -Infinity, b1 = -Infinity;
        for (kd in ownd) {
          var pd = Bd.unkey(kd);
          if (pd[0] < a0) a0 = pd[0];
          if (pd[0] > a1) a1 = pd[0];
          if (pd[1] < b0) b0 = pd[1];
          if (pd[1] > b1) b1 = pd[1];
        }
        dbox += '<rect class="dbox" x="' + (X(a0) - pt / 2).toFixed(2) + '" y="' + (Y(b1) - pt / 2).toFixed(2) +
          '" width="' + ((a1 - a0 + 1) * pt).toFixed(2) + '" height="' + ((b1 - b0 + 1) * pt).toFixed(2) + '"/>';
      }
      out += dbox;
      var step = nx * ny > 2500 ? 4 : (nx * ny > 900 ? 2 : 1), dco = '';
      for (i = i0; i <= i1; i += step) {
        for (j = j0; j <= j1; j += step) {
          dco += '<text class="dco" x="' + (X(i) + pt * 0.26).toFixed(2) +
            '" y="' + (Y(j) - pt * 0.22).toFixed(2) + '">' + i + ',' + j + '</text>';
        }
      }
      out += dco;
    }

    var hit = '';
    if (!opt.nohit) {
      for (i = i0; i <= i1; i++) for (j = j0; j <= j1; j++) {
        hit += '<rect class="bhit" x="' + (X(i) - pt / 2) + '" y="' + (Y(j) - pt / 2) + '" width="' + pt + '" height="' + pt +
          '" data-act="c:' + i + ':' + j + '"><title>' + i + ' , ' + j + '</title></rect>';
      }
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" class="fig board"' +
      ' data-pt="' + pt + '" data-i0="' + i0 + '" data-j1="' + j1 + '" data-ml="' + ML + '"' +
      (opt.title ? ' aria-label="' + U.esc(opt.title) + '"' : '') + '>' +
      out + '<g class="bgghost"></g>' + hit + '</svg>';
  }

  /* ---------- 素的一面：只剩外轮廓 ----------
     没有网格、没有字形、没有注。这一面回答的问题是：
     少到只剩一条线，它还认不认得出是这一具。
     图空着时画一把十字准星——素的一面在空图上已经成立。 */
  function silhouette(b, opt) {
    opt = opt || {};
    var ls = Bd.list(b), n = ls.length;
    var pt = opt.pitch || 26;
    var PAD = opt.pad == null ? 3 : opt.pad;
    var i0 = 0, i1 = 0, j0 = 0, j1 = 0, z;
    if (n) {
      i0 = Infinity; j0 = Infinity; i1 = -Infinity; j1 = -Infinity;
      for (z = 0; z < n; z++) {
        if (ls[z].i < i0) i0 = ls[z].i;
        if (ls[z].i > i1) i1 = ls[z].i;
        if (ls[z].j < j0) j0 = ls[z].j;
        if (ls[z].j > j1) j1 = ls[z].j;
      }
    }
    i0 -= PAD; i1 += PAD; j0 -= PAD; j1 += PAD;
    var nx = i1 - i0 + 1, ny = j1 - j0 + 1;
    var W = Math.max(1, (nx - 1) * pt), H = Math.max(1, (ny - 1) * pt);
    var out = '';
    if (n) {
      /* 外轮廓本来就走单元格角点，所以缩放变换与图纸一致，只是不留边距 */
      out += '<path class="sil" vector-effect="non-scaling-stroke" fill-rule="evenodd" d="' +
        Bd.pathOf(Bd.boundary(b)) + '" transform="translate(' + (-i0 * pt) + ' ' + (j1 * pt) +
        ') scale(' + pt + ' ' + (-pt) + ')"/>';
    } else {
      var cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.18;
      out += '<path class="silx" vector-effect="non-scaling-stroke" d="M' + (cx - r).toFixed(2) + ' ' + cy.toFixed(2) +
        'H' + (cx + r).toFixed(2) + 'M' + cx.toFixed(2) + ' ' + (cy - r).toFixed(2) +
        'V' + (cy + r).toFixed(2) + '"/>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" class="fig silfig"' + (opt.title ? ' aria-label="' + U.esc(opt.title) + '"' : '') + '>' + out + '</svg>';
  }

  function cellXY(svg, i, j, pt) {
    var s = svg || {};
    var p = pt || (+s.getAttribute('data-pt') || 22);
    var i0 = +s.getAttribute('data-i0') || 0;
    var j1 = +s.getAttribute('data-j1') || 0;
    var ml = +s.getAttribute('data-ml') || 26;
    return { x: ml + (i - i0) * p + p / 2, y: (j1 - j) * p + p / 2, pt: p };
  }

  /* ---------- 元件缩略图 ----------
     opt.glyphs 与 cells 一一对应；不给就按方块画。 */
  function shape(cells, w, rar, opt) {
    opt = opt || {};
    w = w || 46;
    var gl = opt.glyphs || null;
    var own = {}, i;
    for (i = 0; i < cells.length; i++) own[cells[i][0] + ',' + cells[i][1]] = 1;
    var sz = P.size(cells), pt = Math.max(3, Math.floor((w - 6) / Math.max(sz.w, sz.h)));
    var W = sz.w * pt + 2, H = sz.h * pt + 2;
    var out = '';
    for (i = 0; i < cells.length; i++) {
      var gid = gl ? (gl[i] || 'sq') : 'sq';
      var y0 = 1 + (sz.h - 1 - cells[i][1]) * pt;
      out += glyphSVG(gid, 1 + cells[i][0] * pt, y0, pt, nbrMask(own, cells[i][0], cells[i][1]));
    }
    var body = opt.plain ? out : '<g' + gf(rar) + '>' + out + '</g>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" class="fig icon">' + body + '</svg>';
  }

  BS.render = {
    board: board, shape: shape, cellXY: cellXY, rarFill: rarFill, silhouette: silhouette,
    glyphSVG: glyphSVG, nbrMask: nbrMask,
    LOWCAP: LOWCAP, eff: eff, low: low, defs: defs
  };
})(window.BS);
