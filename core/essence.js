/* core/essence.js —— 质变六指标。
   ------------------------------------------------------------------
   这一部作品的立场是：没有纯粹的量变，只有纯粹的质变。
   所以资源不由格数给，由「这具图形在结构上有多不寻常」给。

   六项指标，每项都不靠一个公式拍脑袋，而是由若干条彼此独立的判据
   分别真算、再按权重合成。每条判据都留着自己的读数与说法，
   测量页会把它们一条条摊开给人看——凭什么给这个分，说得出来。

   全部判据都是确定性的：同一具图形，量多少次都是同一个数。
   六项各自归一到 0..1，合成后的「质变度」也在 0..1。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var Bd = BS.body;

  /* 判据的「说法」里嵌着读数，所以不能写成死字符串——那样等于在算的那一刻
     就把语言定死了。这里统一造 {t: 中文模板, a: 参数}，渲染时才落语言。
     静态的说法（没有读数）直接写中文串，渲染时走查表。 */
  function NT(t, a, b, c, d) {
    var A = [];
    if (a !== undefined) A.push(a);
    if (b !== undefined) A.push(b);
    if (c !== undefined) A.push(c);
    if (d !== undefined) A.push(d);
    return A.length ? { t: t, a: A } : t;
  }

  /* ---------- 通用小工具 ---------- */
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function f2(x) { return Math.round(x * 100) / 100; }
  function f3(x) { return Math.round(x * 1000) / 1000; }

  /* 格集合 -> 便于查的表 */
  function cellSet(b) {
    var set = {}, ks = Object.keys(b.cells), i, p;
    for (i = 0; i < ks.length; i++) { p = Bd.unkey(ks[i]); set[p[0] + ',' + p[1]] = 1; }
    return { set: set, ks: ks, pts: ks.map(function (k) { return Bd.unkey(k); }) };
  }
  function bboxOf(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][0] < x0) x0 = pts[i][0];
      if (pts[i][0] > x1) x1 = pts[i][0];
      if (pts[i][1] < y0) y0 = pts[i][1];
      if (pts[i][1] > y1) y1 = pts[i][1];
    }
    if (!pts.length) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 1, h: 1 };
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* ================================================================
     一、自相似 SELF-SIMILARITY
     四条判据，各测一件不同的事：
       A 尺度自相关  把图形按 2×2 粗化再放回原尺度，与原图重叠多少
       B 窗口重复率  以每格为中心的 3×3 邻域模式，去重后剩几种
       C 四分递归    外接框切四象限，各象限的占据分布彼此有多像
       D 标度不变性  不同半径下的格数增长，是否服从单一幂律
     ================================================================ */

  /* A：粗化—放大—比对。这是分形最朴素的自检方式。 */
  function coarseEcho(g, bb) {
    var S = g.set, x, y, k;
    /* 粗化：以 bb.x0,bb.y0 为原点，每 2×2 一格，任一格被占则该粗格被占 */
    var coarse = {};
    for (k in S) {
      var p = k.split(','); x = +p[0]; y = +p[1];
      var cx = Math.floor((x - bb.x0) / 2), cy = Math.floor((y - bb.y0) / 2);
      coarse[cx + ',' + cy] = 1;
    }
    var cn = Object.keys(coarse).length;
    if (!cn) return { v: 0, note: '粗化后没有留下东西' };
    /* 放大回去：每个粗格铺成 2×2 */
    var echo = {}, ck;
    for (ck in coarse) {
      var q = ck.split(',');
      var bx = +q[0] * 2 + bb.x0, by = +q[1] * 2 + bb.y0;
      echo[bx + ',' + by] = 1; echo[(bx + 1) + ',' + by] = 1;
      echo[bx + ',' + (by + 1)] = 1; echo[(bx + 1) + ',' + (by + 1)] = 1;
    }
    /* Jaccard：交集 / 并集 */
    var inter = 0, union = 0, kk;
    for (kk in S) { union++; if (echo[kk]) inter++; }
    for (kk in echo) if (!S[kk]) union++;
    var v = union ? inter / union : 0;
    return { v: v, note: NT('粗化再放大后与原图重叠 #%（粗格 # 个）', Math.round(v * 100), cn) };
  }

  /* B：3×3 邻域模式的重复率。模式越单调，说明局部结构在反复出现。 */
  function windowRepeat(g) {
    var S = g.set, i, p, dx, dy, seen = {}, total = 0;
    for (i = 0; i < g.pts.length; i++) {
      p = g.pts[i];
      var bits = 0, z = 0;
      for (dy = -1; dy <= 1; dy++) for (dx = -1; dx <= 1; dx++) {
        if (S[(p[0] + dx) + ',' + (p[1] + dy)]) bits |= (1 << z);
        z++;
      }
      seen[bits] = (seen[bits] || 0) + 1;
      total++;
    }
    if (total < 4) return { v: 0, kinds: total, note: '格数太少，看不出重复' };
    var kinds = Object.keys(seen).length;
    /* 重复率：1 - 种类数/窗口数。全同一种 -> 1；个个不同 -> 0 */
    var v = clamp01(1 - (kinds - 1) / Math.max(1, total - 1));
    return { v: v, kinds: kinds, note: NT('# 个邻域窗口只用了 # 种模式', total, kinds) };
  }

  /* C：四分象限的占据分布相似度。用四象限的格数向量算归一化离散度。 */
  function quadrantEcho(g, bb) {
    if (bb.w < 4 || bb.h < 4) return { v: 0, note: '外接框不足 4×4，切不出四象限' };
    var S = g.set, mx = bb.x0 + Math.floor(bb.w / 2), my = bb.y0 + Math.floor(bb.h / 2);
    var q = [0, 0, 0, 0], k, p, idx;
    for (k in S) {
      p = k.split(',');
      idx = ((+p[0] < mx) ? 0 : 1) + ((+p[1] < my) ? 0 : 2);
      q[idx]++;
    }
    var tot = q[0] + q[1] + q[2] + q[3];
    if (!tot) return { v: 0, note: '四象限都是空的' };
    /* 完全均匀 -> 每份 1/4 -> 离散度 0 -> v=1；全挤一角 -> v=0 */
    var dev = 0, i;
    for (i = 0; i < 4; i++) dev += Math.abs(q[i] / tot - 0.25);
    var v = clamp01(1 - dev / 1.5);
    return { v: v, q: q, note: NT('四象限各占 #%', q.map(function (x) { return Math.round(x / tot * 100); }).join('/')) };
  }

  /* D：标度不变性。数不同半径 r 内的格数 N(r)，看 log N 对 log r 是否成直线。
     直线越直（残差越小），说明结构在各个尺度上按同一律增长。 */
  function scalingLaw(g, st) {
    if (g.pts.length < 12) return { v: 0, note: '不足 12 格，回归不出标度' };
    var cx = st.bcx, cy = st.bcy, i, p, d;
    var rmax = Math.max(1, st.rmax);
    var rs = [], k;
    /* 取 5 个尺度 */
    for (k = 1; k <= 5; k++) rs.push(rmax * k / 5);
    var xs = [], ys = [];
    for (k = 0; k < rs.length; k++) {
      var cnt = 0;
      for (i = 0; i < g.pts.length; i++) {
        p = g.pts[i];
        d = Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy));
        if (d <= rs[k]) cnt++;
      }
      if (cnt < 2) continue;
      xs.push(Math.log(rs[k])); ys.push(Math.log(cnt));
    }
    if (xs.length < 3) return { v: 0, note: '有效尺度不足三档，回归不出标度' };
    /* 最小二乘 + 残差 */
    var n2 = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (i = 0; i < n2; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var den = n2 * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return { v: 0, note: '尺度取值退化' };
    var slope = (n2 * sxy - sx * sy) / den;
    var inter = (sy - slope * sx) / n2;
    var sse = 0, sst = 0, my2 = sy / n2;
    for (i = 0; i < n2; i++) {
      var pred = slope * xs[i] + inter;
      sse += (ys[i] - pred) * (ys[i] - pred);
      sst += (ys[i] - my2) * (ys[i] - my2);
    }
    var r2 = sst > 1e-12 ? clamp01(1 - sse / sst) : 1;
    /* 平面填充的理论标度是 2；越接近 2 说明越像实心块，越偏离越像分形骨架 */
    var dim = slope;
    return {
      v: r2, dim: dim, r2: r2, scales: n2,
      note: NT('N(r) ∝ r^#，# 档尺度的拟合优度 R²=#', f2(dim), n2, f3(r2))
    };
  }

  function selfSimilarity(b, st) {
    var g = cellSet(b), bb = bboxOf(g.pts);
    if (!g.pts.length) return empty4('图是空的');
    var A = coarseEcho(g, bb), B = windowRepeat(g), C = quadrantEcho(g, bb), D = scalingLaw(g, st);
    /* 权重重排：D 0.30 → 0.12，A 0.30 → 0.34，B 0.24 → 0.30，C 0.16 → 0.24。
       D（标度不变性）量的是「半径内的格数对半径做幂律回归的 R²」，
       而任何一片铺得开的图形都满足 count ∝ r² —— 实测六种形状它全部读到
       0.97~0.99，等于恒真。真正把这六种分开的是 A（尺度自相关 0.50~1.00）
       与 B（窗口重复率 0.61~0.97），所以权重往它们身上挪。
       D 仍留 0.12：它挡的是「一团孤点」那种连幂律都谈不上的东西。 */
    var W = { A: 0.34, B: 0.30, C: 0.24, D: 0.12 };
    var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
    return {
      v: v,
      parts: [
        { id: 'A', t: '尺度自相关', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '窗口重复率', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '四分递归', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '标度不变性', w: W.D, v: D.v, note: D.note }
      ],
      dim: D.dim || 0
    };
  }

  /* ================================================================
     二、部分对称 PARTIAL SYMMETRY
     整体对称只有一种「是或不是」，部分对称才是一般图形的常态。
       A 最佳轴镜像覆盖率  不只测外接框中轴，扫全部半格步进候选轴取最优
       B 对称岛占比        最大的「局部完全对称」连通区域占多大
       C 镜像对密度        构成镜像对的格数占总格数的比例
       D 轴向一致度        水平轴与垂直轴两个方向的覆盖率是否接近
     ================================================================ */

  /* A：扫候选轴，找覆盖率最高的那条。覆盖率 = 有镜像的格 / 总格数。 */
  function bestAxis(g, bb) {
    var S = g.set, n2 = g.pts.length;
    if (n2 < 2) return { v: 0, axis: null, note: '不足两格，谈不上镜像' };
    var best = { v: -1, axis: null, dir: null };
    /* 竖轴：x = c，c 以半格步进扫过外接框 */
    var c, i, p, m, hit;
    for (c = bb.x0 - 0.5; c <= bb.x1 + 0.5; c += 0.5) {
      hit = 0;
      for (i = 0; i < n2; i++) {
        p = g.pts[i];
        m = Math.round(2 * c - p[0]);
        if (S[m + ',' + p[1]]) hit++;
      }
      var v = hit / n2;
      if (v > best.v) best = { v: v, axis: c, dir: 'v', hit: hit };
    }
    /* 横轴：y = c */
    for (c = bb.y0 - 0.5; c <= bb.y1 + 0.5; c += 0.5) {
      hit = 0;
      for (i = 0; i < n2; i++) {
        p = g.pts[i];
        m = Math.round(2 * c - p[1]);
        if (S[p[0] + ',' + m]) hit++;
      }
      var v2 = hit / n2;
      if (v2 > best.v) best = { v: v2, axis: c, dir: 'h', hit: hit };
    }
    best.v = clamp01(best.v);
    best.note = NT('最优#轴在 #，#/# 格有镜像',
      best.dir === 'v' ? '竖' : '横', f2(best.axis), best.hit, n2);
    return best;
  }

  /* B：对称岛。以最佳轴为镜，把「自己和镜像都在」的格标出来，
     取其中最大连通块的面积占比。这一条测的是「局部有没有成片对称」。 */
  function symIslands(g, bb) {
    var S = g.set, n2 = g.pts.length;
    if (n2 < 6) return { v: 0, note: '不足六格，成不了岛' };
    var ax = bestAxis(g, bb);
    if (!ax.axis) return { v: 0, note: '找不到候选轴' };
    /* 标出有镜像的格 */
    var good = {}, i, p, m;
    for (i = 0; i < n2; i++) {
      p = g.pts[i];
      if (ax.dir === 'v') { m = Math.round(2 * ax.axis - p[0]); if (S[m + ',' + p[1]]) good[p[0] + ',' + p[1]] = 1; }
      else { m = Math.round(2 * ax.axis - p[1]); if (S[p[0] + ',' + m]) good[p[0] + ',' + p[1]] = 1; }
    }
    var gk = Object.keys(good);
    if (!gk.length) return { v: 0, big: 0, note: '没有任何一格有镜像' };
    /* 在 good 里做连通块 */
    var seen = {}, bestN = 0, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < gk.length; i++) {
      if (seen[gk[i]]) continue;
      var stack = [gk[i]], cnt = 0, u;
      seen[gk[i]] = 1;
      while (stack.length) {
        u = stack.pop(); cnt++;
        var q = u.split(',');
        for (var z = 0; z < 4; z++) {
          var nk = (+q[0] + D4[z][0]) + ',' + (+q[1] + D4[z][1]);
          if (good[nk] && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
        }
      }
      if (cnt > bestN) bestN = cnt;
    }
    var v = clamp01(bestN / n2);
    return { v: v, big: bestN, note: NT('最大的一片局部对称区有 # 格，占 #%', bestN, Math.round(v * 100)) };
  }

  /* C：镜像对密度。数「成对」的格，同一对不重复计。 */
  function mirrorPairs(g, bb) {
    var S = g.set, n2 = g.pts.length;
    if (n2 < 2) return { v: 0, pairs: 0, note: '不足两格' };
    var ax = bestAxis(g, bb);
    if (!ax.axis) return { v: 0, pairs: 0, note: '找不到候选轴' };
    var counted = {}, pairs = 0, i, p, m, k1, k2;
    for (i = 0; i < n2; i++) {
      p = g.pts[i];
      if (ax.dir === 'v') m = [Math.round(2 * ax.axis - p[0]), p[1]];
      else m = [p[0], Math.round(2 * ax.axis - p[1])];
      k1 = p[0] + ',' + p[1]; k2 = m[0] + ',' + m[1];
      if (k1 === k2) continue;                 /* 落在轴上的格不算一对 */
      if (S[k2] && !counted[k1] && !counted[k2]) { counted[k1] = 1; counted[k2] = 1; pairs++; }
    }
    var v = clamp01(pairs * 2 / n2);
    return { v: v, pairs: pairs, note: NT('# 对镜像，覆盖 #% 的格', pairs, Math.round(v * 100)) };
  }

  /* D：轴向一致度。水平与垂直两个方向的最优覆盖率是否接近——
     接近说明这不是「碰巧一个方向对称」，而是两个方向都有对称倾向。 */
  function axisBalance(g, bb) {
    var S = g.set, n2 = g.pts.length;
    if (n2 < 4) return { v: 0, note: '不足四格，比不出两轴' };
    function cover(dir) {
      var best = 0, c, i, p, m, hit;
      var lo = dir === 'v' ? bb.x0 : bb.y0, hi = dir === 'v' ? bb.x1 : bb.y1;
      for (c = lo - 0.5; c <= hi + 0.5; c += 0.5) {
        hit = 0;
        for (i = 0; i < n2; i++) {
          p = g.pts[i];
          if (dir === 'v') { m = Math.round(2 * c - p[0]); if (S[m + ',' + p[1]]) hit++; }
          else { m = Math.round(2 * c - p[1]); if (S[p[0] + ',' + m]) hit++; }
        }
        if (hit / n2 > best) best = hit / n2;
      }
      return best;
    }
    var cv = cover('v'), ch = cover('h');
    var hi2 = Math.max(cv, ch), lo2 = Math.min(cv, ch);
    var v = hi2 > 0 ? clamp01(lo2 / hi2) * clamp01(hi2) : 0;
    return { v: v, cv: cv, ch: ch, note: NT('竖轴覆盖 #%，横轴覆盖 #%', Math.round(cv * 100), Math.round(ch * 100)) };
  }

  function partialSymmetry(b, st) {
    var g = cellSet(b), bb = bboxOf(g.pts);
    if (!g.pts.length) return empty4('图是空的');
    var A = bestAxis(g, bb), B = symIslands(g, bb), C = mirrorPairs(g, bb), D = axisBalance(g, bb);
    var W = { A: 0.34, B: 0.26, C: 0.22, D: 0.18 };
    var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
    return {
      v: v,
      parts: [
        { id: 'A', t: '最佳轴镜像覆盖率', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '对称岛占比', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '镜像对密度', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '轴向一致度', w: W.D, v: D.v, note: D.note }
      ],
      axis: A.axis, dir: A.dir
    };
  }

  /* ================================================================
     三、整体对称 GLOBAL SYMMETRY
     这一项测的是「整个图形作为一个刚体，对称群有多大」。
       A 二面体群阶      st.sym.order（1/2/4/8）
       B 旋转轴数        四重轴记满，二重轴记半
       C 镜面数          竖、横、两条对角，各算一条
       D 心合一度        质心与几何中心的偏离，越小越对称
     ================================================================ */
  function globalSymmetry(b, st) {
    var g = cellSet(b);
    if (!g.pts.length) return empty4('图是空的');
    var sym = st.sym || Bd.symmetry(b);
    var S = g.set, bb = bboxOf(g.pts), i, p;

    /* A：群阶。order 只可能是 1/2/4/8 */
    var vA = clamp01((sym.order - 1) / 7);
    var pA = { id: 'A', t: '二面体群阶', w: 0.34, v: vA, note: NT('对称群阶为 #（满阶是 8）', sym.order) };

    /* B：旋转。四重旋转记满，只有二重记半，没有记零 */
    var vB = sym.rot === 4 ? 1 : (sym.rot === 2 ? 0.5 : 0);
    var pB = { id: 'B', t: '旋转轴', w: 0.22, v: vB, note: NT('# 重旋转对称', sym.rot) };

    /* C：镜面数。除竖横外，再真算两条对角线 */
    var mirrors = 0, names = [];
    if (sym.mv) { mirrors++; names.push('竖'); }
    if (sym.mh) { mirrors++; names.push('横'); }
    /* 对角镜面：只在正方形外接框里才可能 */
    if (bb.w === bb.h && bb.w >= 2) {
      var cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
      var d1 = true, d2 = true;
      for (i = 0; i < g.pts.length && (d1 || d2); i++) {
        p = g.pts[i];
        /* 主对角：(x,y) -> (cx + (y-cy), cy + (x-cx)) */
        var m1x = Math.round(cx + (p[1] - cy)), m1y = Math.round(cy + (p[0] - cx));
        if (d1 && !S[m1x + ',' + m1y]) d1 = false;
        /* 反对角：(x,y) -> (cx - (y-cy), cy - (x-cx)) */
        var m2x = Math.round(cx - (p[1] - cy)), m2y = Math.round(cy - (p[0] - cx));
        if (d2 && !S[m2x + ',' + m2y]) d2 = false;
      }
      if (d1) { mirrors++; names.push('主对角'); }
      if (d2) { mirrors++; names.push('反对角'); }
    }
    var vC = clamp01(mirrors / 4);
    var pC = { id: 'C', t: '镜面数', w: 0.22, v: vC, note: mirrors ? NT('# 条镜面（#）', mirrors, names) : '没有任何镜面' };

    /* D：心合一度。偏心 ecc 是格为单位的距离，按外接框对角线归一 */
    var diag = Math.max(1, Math.sqrt(bb.w * bb.w + bb.h * bb.h));
    var vD = clamp01(1 - (st.ecc / diag) * 4);
    var pD = { id: 'D', t: '心合一度', w: 0.22, v: vD, note: NT('质心偏离几何中心 # 格', f3(st.ecc)) };

    var v = clamp01(pA.v * pA.w + pB.v * pB.w + pC.v * pC.w + pD.v * pD.w);
    return { v: v, parts: [pA, pB, pC, pD], order: sym.order, mirrors: mirrors };
  }

  /* ================================================================
     四、分形特征 FRACTALITY
       A 盒计数维数      用 1/2/4/8 的盒子覆盖，回归 log-log 斜率
       B 周长标度        P 对 n 的标度指数，越偏离 0.5 越不寻常
       C 边界褶皱        凹角占比与轮廓步数的复合
       D 多尺度空隙恒定性  不同尺度下填充率的稳定程度
     ================================================================ */

  /* A：盒计数。真数盒子，不估算。 */
  function boxCount(g, bb) {
    var S = g.set;
    if (g.pts.length < 8) return { v: 0, note: '不足八格，数不出维数' };
    var sizes = [1, 2, 4, 8], xs = [], ys = [], z, i, p;
    for (z = 0; z < sizes.length; z++) {
      var s = sizes[z];
      if (s > Math.max(bb.w, bb.h)) break;
      var boxes = {}, k;
      for (k in S) {
        p = k.split(',');
        var bx = Math.floor((+p[0] - bb.x0) / s), by = Math.floor((+p[1] - bb.y0) / s);
        boxes[bx + ',' + by] = 1;
      }
      var cnt = Object.keys(boxes).length;
      if (cnt < 2) continue;
      xs.push(Math.log(1 / s)); ys.push(Math.log(cnt));
    }
    if (xs.length < 3) return { v: 0, note: '有效盒尺度不足三档' };
    var n2 = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (i = 0; i < n2; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var den = n2 * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return { v: 0, note: '盒尺度退化' };
    var slope = (n2 * sxy - sx * sy) / den;
    /* 实心块的盒维数是 2，一条线是 1。分形特征在两者之间，越接近 1.6~1.9 越有味道 */
    var dim = clamp01(slope) * 2;             /* slope 是对 log(1/s) 的，实心块时约为 1 */
    /* 响应窗口：分母 **1.72 → 0.45**。
       旧窗口下，实际可达的 dim 全区间 [1.0, 2.0] 只能映射出 v ∈ [0.58, 1.00]——
       实测六种**有意为之**的形状（实心方块、地毯、空心方、格栅、树、乱堆）
       在这一条分项上全部读到 0.84，它等于恒真，没在测量任何东西。
       新窗口以 1.72 为峰、半宽 0.45：dim=2.00 给 0.38，dim=1.72 给 1.00。 */
    var v = clamp01(1 - Math.abs(dim - 1.72) / 0.45);
    return { v: v, dim: dim, scales: n2, note: NT('盒计数维数 ≈ #（# 档盒尺度）', f2(dim), n2) };
  }

  /* B：周长标度。P ∝ n^k，实心块 k=0.5，分形骨架 k 明显更大。 */
  function perimScaling(st) {
    if (st.n < 12 || !st.P) return { v: 0, note: '不足十二格，标度不可靠' };
    var k = Math.log(st.P) / Math.log(st.n);
    /* k=0.5 是实心块（最不分形），k=1 是完全骨架化。把偏离 0.5 的程度当分形性 */
    var v = clamp01((k - 0.5) / 0.5);
    return { v: v, k: k, note: NT('周长 P ∝ 格数^#（实心块是 0.5）', f3(k)) };
  }

  /* C：边界褶皱。凹角占比 + 单位面积的轮廓步数。 */
  function boundaryFold(st) {
    if (!st.verts) return { v: 0, note: '没有轮廓' };
    var conc = st.conc / Math.max(1, st.verts);        /* 凹角占顶点的比例 */
    var steps = st.P / Math.max(1, st.n);               /* 每格摊到多少条轮廓边 */
    var vC1 = clamp01(conc / 0.34);                     /* 凹角占三分之一已算很皱 */
    var vC2 = clamp01((steps - 1.0) / 2.2);             /* 实心块约 1.0，骨架可到 3+ */
    var v = clamp01(vC1 * 0.55 + vC2 * 0.45);
    return { v: v, conc: conc, steps: steps, note: NT('凹角占顶点 #%，每格摊 # 条轮廓边', Math.round(conc * 100), f2(steps)) };
  }

  /* D：多尺度空隙恒定性。分形的标志之一是「换个尺度看，疏密还是那个样子」。
     在三个盒尺度上各算一次填充率，取它们的稳定程度。 */
  function voidDensStable(g, bb) {
    if (g.pts.length < 12) return { v: 0, note: '不足十二格，看不出多尺度' };
    var sizes = [2, 4, 8], fills = [], z;
    for (z = 0; z < sizes.length; z++) {
      var s = sizes[z];
      if (s > Math.max(bb.w, bb.h)) continue;
      var tot = Math.ceil(bb.w / s) * Math.ceil(bb.h / s);
      var cnt = 0, bx, by, k, p, seen = {};
      for (k in g.set) {
        p = k.split(',');
        bx = Math.floor((+p[0] - bb.x0) / s); by = Math.floor((+p[1] - bb.y0) / s);
        var kk = bx + ',' + by;
        if (!seen[kk]) { seen[kk] = 1; cnt++; }
      }
      if (tot) fills.push(cnt / tot);
    }
    if (fills.length < 2) return { v: 0, note: '有效尺度不足两档' };
    /* 变异系数越小越稳定 */
    var i, mean = 0;
    for (i = 0; i < fills.length; i++) mean += fills[i];
    mean /= fills.length;
    var sd = 0;
    for (i = 0; i < fills.length; i++) sd += (fills[i] - mean) * (fills[i] - mean);
    sd = Math.sqrt(sd / fills.length);
    var cv = mean > 1e-9 ? sd / mean : 0;
    var v = clamp01(1 - cv / 0.9);
    return { v: v, cv: cv, note: NT('三档尺度下的填充率变异系数 #（越小越标度不变）', f3(cv)) };
  }

  function fractality(b, st) {
    var g = cellSet(b), bb = bboxOf(g.pts);
    if (!g.pts.length) return empty4('图是空的');
    var A = boxCount(g, bb), B = perimScaling(st), C = boundaryFold(st), D = voidDensStable(g, bb);
    /* 权重重排：A 0.32 → 0.14，C 0.20 → 0.38。
       理由同样是实测：A（盒计数维数）在六种有意为之的形状上读数几乎不动，
       而 C（边界褶皱）是唯一把**实心方块（0.00）**和其余所有形状分开的那一条——
       实心块正是这一项要否掉的东西，所以它该拿最大的权重。 */
    var W = { A: 0.14, B: 0.24, C: 0.38, D: 0.24 };
    var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
    return {
      v: v,
      parts: [
        { id: 'A', t: '盒计数维数', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '周长标度', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '边界褶皱', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '多尺度空隙恒定性', w: W.D, v: D.v, note: D.note }
      ],
      dim: A.dim || 0
    };
  }

  /* ================================================================
   五、空腔秩序 POROSITY
   洞本身不算本事——随手一围就有一个。本事是洞「成秩序」：
   够多、大小成档、位置对称、边界与外轮廓同调。
     A 洞阶      有几个洞。一两个是偶然，五个以上才叫结构
     B 大小成档  各洞的面积聚拢在一两个尺寸上，而不是乱糟糟一片
     C 位置对称  洞的分布关于中轴有多对称
     D 边界同调  洞的周长/面积比，与外轮廓是不是一个脾气
   ================================================================ */

/* 从外接框外圈灌水，灌不到的空格就是洞。返回一片一片的洞。 */
function holesOf(g, bb) {
  if (!g.pts.length) return [];
  var W = bb.w + 2, H = bb.h + 2;
  if (W * H > 40000) return [];           /* 太大就不灌了，免得把机器拖死 */
  var S = g.set, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var ox = bb.x0 - 1, oy = bb.y0 - 1;
  var seen = {}, stack = [[ox, oy]], i, z, nx, ny, x, y, k, comp;
  function key(a, c) { return (a - ox) + ',' + (c - oy); }
  function inBox(a, c) { return a >= ox && a <= ox + W - 1 && c >= oy && c <= oy + H - 1; }
  seen[key(ox, oy)] = 1;
  while (stack.length) {
    var p = stack.pop(); x = p[0]; y = p[1];
    for (z = 0; z < 4; z++) {
      nx = x + D4[z][0]; ny = y + D4[z][1];
      if (!inBox(nx, ny)) continue;
      k = key(nx, ny);
      if (seen[k] || S[nx + ',' + ny]) continue;
      seen[k] = 1; stack.push([nx, ny]);
    }
  }
  var visited = {}, holes = [];
  for (i = 0; i < W * H; i++) {
    x = ox + (i % W); y = oy + Math.floor(i / W);
    var ck = x + ',' + y;
    if (S[ck] || seen[key(x, y)] || visited[ck]) continue;
    comp = []; stack = [ck]; visited[ck] = 1;
    while (stack.length) {
      var cur = stack.pop(), pp = cur.split(','), cx = +pp[0], cy = +pp[1];
      /* 灌水区边框上的空格不是洞，是图外 */
      if (!inBox(cx, cy)) continue;
      comp.push([cx, cy]);
      for (z = 0; z < 4; z++) {
        var ax = cx + D4[z][0], ay = cy + D4[z][1], ak = ax + ',' + ay;
        if (!inBox(ax, ay)) continue;
        if (visited[ak] || S[ak] || seen[key(ax, ay)]) continue;
        visited[ak] = 1; stack.push(ak);
      }
    }
    if (comp.length) holes.push(comp);
  }
  return holes;
}

/* A：洞阶。要五个洞才给满分，一两个只算偶然。 */
function holeTiers(holes) {
  var n2 = holes.length;
  return { v: clamp01(n2 / 5), n: n2, note: n2 ? NT('# 个洞，五个才满', n2) : '一个洞都没有' };
}

/* B：大小成档。各洞面积聚拢才算成档；只有一个洞谈不上「档」。 */
function holeSizeBand(holes) {
  if (holes.length < 2) return { v: 0, note: '不足两个洞，谈不上有档' };
  var sz = [], i, mean = 0, sd = 0;
  for (i = 0; i < holes.length; i++) { sz.push(holes[i].length); mean += holes[i].length; }
  mean /= sz.length;
  for (i = 0; i < sz.length; i++) sd += (sz[i] - mean) * (sz[i] - mean);
  sd = Math.sqrt(sd / sz.length);
  var cv = mean > 1e-9 ? sd / mean : 0;
  return { v: clamp01(1 - cv / 0.75), cv: cv, note: NT('各洞面积 #，变异系数 #', sz.join('/'), f3(cv)) };
}

/* C：位置对称。以中轴为镜，每个洞的质心能不能对上一个（或自己落在轴上）。 */
function holeSymmetry(holes, bb) {
  if (!holes.length) return { v: 0, note: '没有洞' };
  var cs = [], i, z;
  for (i = 0; i < holes.length; i++) {
    var sx = 0, sy = 0;
    for (z = 0; z < holes[i].length; z++) { sx += holes[i][z][0]; sy += holes[i][z][1]; }
    cs.push([sx / holes[i].length, sy / holes[i].length]);
  }
  var axV = (bb.x0 + bb.x1) / 2, axH = (bb.y0 + bb.y1) / 2, best = 0, tol;
  [['v', axV], ['h', axH]].forEach(function (a) {
    var hit = 0;
    for (i = 0; i < cs.length; i++) {
      var m = a[0] === 'v' ? Math.abs(cs[i][0] - a[1]) : Math.abs(cs[i][1] - a[1]);
      if (m < 0.5) { hit++; continue; }               /* 自己就落在轴上 */
      for (z = 0; z < cs.length; z++) {
        if (z === i) continue;
        var mz = a[0] === 'v' ? cs[z][0] : cs[z][1];
        if (Math.abs((2 * a[1] - m) - mz) < 0.75 || Math.abs(mz - (2 * a[1] - m)) < 0.75) { hit++; break; }
      }
    }
    var v2 = hit / cs.length;
    if (v2 > best) best = v2;
  });
  return { v: clamp01(best), note: NT('洞的质心关于中轴对上了 #%', Math.round(best * 100)) };
}

/* D：边界同调。洞的周长/面积比与外轮廓是不是一个脾气。 */
function holeBoundaryEcho(holes, g, st) {
  if (!holes.length || !st || !st.n) return { v: 0, note: '没有洞，无从呼应' };
  var S = g.set, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var outer = st.P / Math.sqrt(st.n);             /* 外轮廓的形状指数 */
  var vs = 0, i, z, q;
  for (i = 0; i < holes.length; i++) {
    var per = 0;
    for (z = 0; z < holes[i].length; z++) {
      for (q = 0; q < 4; q++) {
        if (S[(holes[i][z][0] + D4[q][0]) + ',' + (holes[i][z][1] + D4[q][1])]) per++;
      }
    }
    var idx = per / Math.sqrt(Math.max(1, holes[i].length));
    vs += clamp01(1 - Math.abs(idx - outer) / Math.max(1, outer));
  }
  var v = vs / holes.length;
  return { v: clamp01(v), outer: outer, note: NT('外轮廓形状指数 #，洞与它同调到 #', f2(outer), f2(v)) };
}

function porosity(b, st) {
  var g = cellSet(b), bb = bboxOf(g.pts);
  if (!g.pts.length) return empty4('图是空的');
  var holes = holesOf(g, bb);
  var A = holeTiers(holes), B = holeSizeBand(holes), C = holeSymmetry(holes, bb), D = holeBoundaryEcho(holes, g, st);
  var W = { A: 0.26, B: 0.26, C: 0.26, D: 0.22 };
  var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
  return {
    v: v, holes: holes.length,
    parts: [
      { id: 'A', t: '洞阶', w: W.A, v: A.v, note: A.note },
      { id: 'B', t: '大小成档', w: W.B, v: B.v, note: B.note },
      { id: 'C', t: '位置对称', w: W.C, v: C.v, note: C.note },
      { id: 'D', t: '边界同调', w: W.D, v: D.v, note: D.note }
    ]
  };
}

/* ================================================================
   六、同质度 HOMOGENEITY
   实心块是均匀的，但那是死的均匀；乱堆也是不匀的。
   这里要的是「有疏有密，而疏密在各处一致」——一种不靠对称的整齐。
     A 局部密度变异  每格 3×3 邻域的占据率，各处差多少
     B 中值密度带    平均占据率落在该落的区间（太实太疏都不算）
     C 径向平稳      由质心往外的环带密度，有没有突变
     D 象限均衡      四象限的密度彼此有多接近
   ================================================================ */

function localDensity(g) {
  var S = g.set, n2 = g.pts.length, i, z, dx, dy, occ, vals = [], mean = 0;
  for (i = 0; i < n2; i++) {
    occ = 0;
    for (dx = -1; dx <= 1; dx++) for (dy = -1; dy <= 1; dy++) {
      if (S[(g.pts[i][0] + dx) + ',' + (g.pts[i][1] + dy)]) occ++;
    }
    vals.push(occ / 9); mean += occ / 9;
  }
  mean /= Math.max(1, n2);
  var sd = 0;
  for (i = 0; i < n2; i++) sd += (vals[i] - mean) * (vals[i] - mean);
  sd = Math.sqrt(sd / Math.max(1, n2));
  return { mean: mean, sd: sd, cv: mean > 1e-9 ? sd / mean : 0 };
}

function homogeneity(b, st) {
  var g = cellSet(b), bb = bboxOf(g.pts);
  if (!g.pts.length) return empty4('图是空的');
  var ld = localDensity(g);

  /* A：局部密度变异系数，越小越匀 */
  var A = { v: clamp01(1 - ld.cv / 0.55), note: NT('局部占据率变异系数 #（越小越匀）', f3(ld.cv)) };
  /* B：平均占据率要落在 0.42~0.72 这条带上：实心块太满，骨架太空 */
  var band = ld.mean, vb;
  if (band >= 0.42 && band <= 0.72) vb = 1;
  else vb = clamp01(1 - Math.min(Math.abs(band - 0.42), Math.abs(band - 0.72)) / 0.42);
  var B = { v: vb, note: NT('平均占据率 #，宜落在 0.42~0.72', f2(band)) };
  /* C：径向环带密度有没有突变 */
  var cx = 0, cy = 0, i2;
  for (i2 = 0; i2 < g.pts.length; i2++) { cx += g.pts[i2][0]; cy += g.pts[i2][1]; }
  cx /= g.pts.length; cy /= g.pts.length;
  var NR = 5, rings = [], cnts = [], r, p, d, ri;
  for (r = 0; r < NR; r++) { rings.push(0); cnts.push(0); }
  var maxd = Math.sqrt(bb.w * bb.w + bb.h * bb.h) / 2 || 1;
  var inb = {};
  for (i2 = 0; i2 < g.pts.length; i2++) inb[g.pts[i2][0] + ',' + g.pts[i2][1]] = 1;
  for (i2 = 0; i2 < g.pts.length; i2++) {
    p = g.pts[i2]; d = Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy));
    ri = Math.min(NR - 1, Math.floor(d / maxd * NR));
    rings[ri]++;
  }
  /* 每环的理论面积 ∝ r²，按面积归一后比较 */
  var dens = [], z2, area;
  for (r = 0; r < NR; r++) {
    area = Math.PI * maxd * maxd * ((r + 1) * (r + 1) - r * r) / (NR * NR);
    dens.push(area > 1e-9 ? rings[r] / area : 0);
  }
  var dm = 0, dsd = 0;
  for (z2 = 0; z2 < NR; z2++) dm += dens[z2];
  dm /= NR;
  for (z2 = 0; z2 < NR; z2++) dsd += (dens[z2] - dm) * (dens[z2] - dm);
  dsd = Math.sqrt(dsd / NR);
  var dcv = dm > 1e-9 ? dsd / dm : 0;
  var C = { v: clamp01(1 - dcv / 0.85), note: NT('五道环带的密度变异系数 #（越小越平稳）', f3(dcv)) };
  /* D：四象限密度均衡 */
  var q = [0, 0, 0, 0], mx = (bb.x0 + bb.x1) / 2, my = (bb.y0 + bb.y1) / 2;
  for (i2 = 0; i2 < g.pts.length; i2++) {
    p = g.pts[i2];
    q[(p[0] > mx ? 1 : 0) + (p[1] > my ? 2 : 0)]++;
  }
  var qm = 0, qsd = 0;
  for (z2 = 0; z2 < 4; z2++) qm += q[z2];
  qm /= 4;
  for (z2 = 0; z2 < 4; z2++) qsd += (q[z2] - qm) * (q[z2] - qm);
  qsd = Math.sqrt(qsd / 4);
  var qcv = qm > 1e-9 ? qsd / qm : 0;
  var D = { v: clamp01(1 - qcv / 0.6), note: NT('四象限格数 #，变异系数 #', q.join('/'), f3(qcv)) };

  var W = { A: 0.28, B: 0.24, C: 0.24, D: 0.24 };
  var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
  return {
    v: v,
    parts: [
      { id: 'A', t: '局部密度变异', w: W.A, v: A.v, note: A.note },
      { id: 'B', t: '中值密度带', w: W.B, v: B.v, note: B.note },
      { id: 'C', t: '径向平稳', w: W.C, v: C.v, note: C.note },
      { id: 'D', t: '象限均衡', w: W.D, v: D.v, note: D.note }
    ]
  };
}

/* ================================================================
   七、环络 CYCLICITY
   树没有环，一拆就断；环太多又糊成一团。
   这里量的是「环有没有织成网」：多少格真的站在环上、环够不够多、
   有没有环套环、环是不是铺开了而不是挤在一处。
     A 环上格占比  有多少格至少站在一条环上（桥边不算）
     B 环阶密度    独立环数 ÷ 格数，落在合适的带里
     C 环套环      有洞，且洞的外面还有格站在环上
     D 环的分布    环上的格铺得多开（占外接框多大一片）
   ================================================================ */

function cycleCells(b) {
  var g = Bd.graph(b), ks = g.ks, adj = g.adj;
  var disc = {}, low = {}, par = {}, br = {}, t = 0, i, z;
  /* 注意：nb / v / z 必须声明在 dfs 里。声明在外层的话，递归会把外层
     正在用的那个循环变量一起改写——桥就全判错了（一条线会被判成 24/24 格
     站在环上）。body.js 的 articulations 也是同一个写法，别改回外层去。 */
  function dfs(a) {
    disc[a] = low[a] = ++t;
    var nb = adj[a], v, zz;
    for (zz = 0; zz < nb.length; zz++) {
      v = nb[zz];
      if (!disc[v]) {
        par[v] = a; dfs(v);
        if (low[v] < low[a]) low[a] = low[v];
        if (low[v] > disc[a]) br[a + '|' + v] = 1;
      } else if (v !== par[a] && disc[v] < low[a]) low[a] = disc[v];
    }
  }
  for (i = 0; i < ks.length; i++) if (!disc[ks[i]]) dfs(ks[i]);
  var on = [], cnt = 0;
  for (i = 0; i < ks.length; i++) {
    var nb2 = adj[ks[i]], flag = 0;
    for (z = 0; z < nb2.length; z++) {
      if (!br[ks[i] + '|' + nb2[z]] && !br[nb2[z] + '|' + ks[i]]) { flag = 1; break; }
    }
    if (flag) { cnt++; on.push(ks[i]); }
  }
  return { n: ks.length, on: cnt, cells: on };
}

function cyclicity(b, st) {
  var g = cellSet(b), bb = bboxOf(g.pts);
  if (!g.pts.length) return empty4('图是空的');
  var cc = cycleCells(b);
  /* A：站在环上的格占比 */
  var A = { v: clamp01(cc.on / Math.max(1, cc.n) / 0.72), note: NT('#/# 格站在环上', cc.on, cc.n) };
  /* B：独立环数 ÷ 格数。0 是树，太多就糊了，0.08~0.30 是最好的一段。
     一条环都没有就不给分——「还是棵树」和「环织成网」是两回事，
     不能因为离目标带不远就白送分。 */
  var cyc = (st && st.cyc) || 0, dens = cc.n ? cyc / cc.n : 0, vb;
  if (!cyc) vb = 0;
  else if (dens >= 0.08 && dens <= 0.30) vb = 1;
  else vb = clamp01(1 - Math.min(Math.abs(dens - 0.08), Math.abs(dens - 0.30)) / 0.15);
  var B = { v: vb, note: cyc ? NT('独立环 # 条，密度 #，宜落在 0.08~0.30', cyc, f3(dens)) : '一条环都没有，还是棵树' };
  /* C：环套环——有洞，且洞外面还有格站在环上 */
  var holes = holesOf(g, bb);
  var vc = 0;
  if (holes.length && cc.on >= 4) vc = clamp01(Math.min(1, holes.length / 3) * 0.5 + clamp01(cc.on / Math.max(1, cc.n) / 0.5) * 0.5);
  var C = { v: vc, note: holes.length ? NT('# 个洞，外面还有 # 格站在环上', holes.length, cc.on) : '没有洞，套不起来' };
  /* D：环上的格铺得多开 */
  var vd = 0, i2, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, p;
  if (cc.on >= 2) {
    for (i2 = 0; i2 < cc.cells.length; i2++) {
      p = cc.cells[i2].split(',');
      if (+p[0] < x0) x0 = +p[0];
      if (+p[0] > x1) x1 = +p[0];
      if (+p[1] < y0) y0 = +p[1];
      if (+p[1] > y1) y1 = +p[1];
    }
    var sw = Math.max(1, x1 - x0 + 1), sh = Math.max(1, y1 - y0 + 1);
    vd = clamp01((sw * sh) / Math.max(1, bb.w * bb.h) / 0.55);
  }
  var D = { v: vd, note: cc.on >= 2 ? NT('环上的格铺开占外接框 #%', Math.round(vd * 100)) : '不足两格在环上' };

  var W = { A: 0.30, B: 0.22, C: 0.24, D: 0.24 };
  var v = clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D);
  return {
    v: v,
    parts: [
      { id: 'A', t: '环上格占比', w: W.A, v: A.v, note: A.note },
      { id: 'B', t: '环阶密度', w: W.B, v: B.v, note: B.note },
      { id: 'C', t: '环套环', w: W.C, v: C.v, note: C.note },
      { id: 'D', t: '环的分布', w: W.D, v: D.v, note: D.note }
    ]
  };
}

function empty4(why) {
    return {
      v: 0, note: why,
      parts: [{ id: '—', t: '—', w: 1, v: 0, note: why }]
    };
  }

  /* ---------- 后四项共用的小工具 ---------- */
  /* 变异系数：均值的相对离散度。名字避开 localDensity 里那段内联算法。 */
  function cvList(a) {
    var n2 = a.length, m = 0, s = 0, i;
    if (!n2) return 0;
    for (i = 0; i < n2; i++) m += a[i];
    m /= n2;
    if (Math.abs(m) < 1e-9) return 0;
    for (i = 0; i < n2; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / n2) / Math.abs(m);
  }
  /* 落在 [lo,hi] 这条带上给满分，越出越远扣得越多。
     tol 是「离带多远扣到底」的那个距离。 */
  function bandV(x, lo, hi, tol) {
    if (x >= lo && x <= hi) return 1;
    var d = Math.min(Math.abs(x - lo), Math.abs(x - hi));
    return clamp01(1 - d / (tol || 0.5));
  }
  /* 序列粗糙度：二阶差分绝对值的平均，再除以均值。
     一条平的线接近 0，锯齿接近 1 以上。 */
  function roughOf(a) {
    var n2 = a.length, s = 0, m = 0, i;
    if (n2 < 3) return 0;
    for (i = 0; i < n2; i++) m += a[i];
    m /= n2;
    if (Math.abs(m) < 1e-9) return 0;
    for (i = 1; i < n2 - 1; i++) s += Math.abs(a[i - 1] - 2 * a[i] + a[i + 1]);
    return (s / (n2 - 2)) / Math.abs(m);
  }
  /* 去重后的种类数：用来问「这些值成几档」 */
  function tierKinds(a) {
    var seen = {}, n2 = 0, i;
    for (i = 0; i < a.length; i++) if (!seen[a[i]]) { seen[a[i]] = 1; n2++; }
    return n2;
  }
  /* 局部极大值的个数：剖面是不是单峰 */
  function peaksOf(a) {
    var c = 0, j, l, r;
    for (j = 0; j < a.length; j++) {
      l = j > 0 ? a[j - 1] : 0;
      r = j < a.length - 1 ? a[j + 1] : 0;
      if (a[j] > l && a[j] >= r) c++;
    }
    return c;
  }

  /* ================================================================
     八、边界节律 BORDER RHYTHM
     轮廓是一串单位步：直着走几步，转一个弯，再直着走几步。
     这一项不问轮廓围出多大地方，只问那串「走几步转一下」本身有没有节律——
     跟分形特征问的「标度」是两件事，跟整体对称问的「群阶」更是两件事。
       A 直段成档   直段长度去重之后剩几种
       B 直段平稳   直段长度的变异系数
       C 凸凹成比   凸角占全部转角的比例，要落在带上
       D 直段均值   平均一段走几步，也要落在带上
     ================================================================ */

  /* 一条环 -> { runs: 直段长度序列, turns: 转角序列(+1 凸 / -1 凹) }。
     轮廓的边是按每个格自身逆时针生成的，所以左转恒为凸、右转恒为凹，
     不必再看这条环是外环还是洞——turns() 里也是这个理。 */
  function ringRhythm(ring) {
    var L = ring.length, runs = [], tn = [], z, dirs = [], p, q2, d0, d1, cr, cur = 1;
    if (L < 4) return { runs: runs, turns: tn };
    for (z = 0; z < L; z++) {
      p = ring[z]; q2 = ring[(z + 1) % L];
      dirs.push([q2[0] - p[0], q2[1] - p[1]]);
    }
    for (z = 1; z < L; z++) {
      d0 = dirs[z - 1]; d1 = dirs[z];
      if (d0[0] === d1[0] && d0[1] === d1[1]) { cur++; continue; }
      runs.push(cur); cur = 1;
      cr = d0[0] * d1[1] - d0[1] * d1[0];
      tn.push(cr > 0 ? 1 : (cr < 0 ? -1 : 0));
    }
    /* 环是闭合的：末段与首段要接起来再看 */
    if (!runs.length) { runs.push(cur); return { runs: runs, turns: tn }; }
    d0 = dirs[L - 1]; d1 = dirs[0];
    if (d0[0] === d1[0] && d0[1] === d1[1]) {
      runs[0] += cur;
    } else {
      runs.push(cur);
      cr = d0[0] * d1[1] - d0[1] * d1[0];
      tn.push(cr > 0 ? 1 : (cr < 0 ? -1 : 0));
    }
    return { runs: runs, turns: tn };
  }

  function borderRhythm(b, st) {
    var rings = Bd.boundary(b);
    if (!rings.length) return empty4('图是空的');
    var runs = [], conv = 0, conc = 0, i, z, rr;
    for (i = 0; i < rings.length; i++) {
      rr = ringRhythm(rings[i]);
      for (z = 0; z < rr.runs.length; z++) runs.push(rr.runs[z]);
      for (z = 0; z < rr.turns.length; z++) {
        if (rr.turns[z] > 0) conv++; else if (rr.turns[z] < 0) conc++;
      }
    }
    if (!runs.length) return empty4('轮廓上没有量得出节律的东西');

    var kinds = tierKinds(runs);
    var A = { v: clamp01(1 - (kinds - 1) / 9), note: NT('直段 # 段，去重后 # 种长度', runs.length, kinds) };
    var cvr = cvList(runs);
    var B = { v: clamp01(1 - cvr / 0.95), note: NT('直段长度变异系数 #（越小越平稳）', f3(cvr)) };
    var tn2 = conv + conc, cf = tn2 ? conv / tn2 : 0;
    var C = { v: bandV(cf, 0.52, 0.86, 0.40), note: NT('凸角 # / 凹角 #，凸占 #%', conv, conc, Math.round(cf * 100)) };
    var mr = 0;
    for (z = 0; z < runs.length; z++) mr += runs[z];
    mr /= runs.length;
    var D = { v: bandV(mr, 1.5, 4.5, 3.2), note: NT('平均一段直着走 # 步，宜落在 1.5~4.5', f2(mr)) };

    var W = { A: 0.26, B: 0.26, C: 0.24, D: 0.24 };
    return {
      v: clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D),
      parts: [
        { id: 'A', t: '直段成档', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '直段平稳', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '凸凹成比', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '直段均值', w: W.D, v: D.v, note: D.note }
      ]
    };
  }

  /* ================================================================
     九、连通秩序 NEXUS
     把格当成图的顶点，相邻格连边。这一项问这张图有多「齐」——
     跟环络问的「环织成了网」是两件事：环络看圈，这里看骨架本身。
       A 块阶成档   连通块的大小去重后剩几种
       B 度数谱齐   度数分布的归一化熵，越小越齐
       C 关节占比   关节点占格数的比例：链式结构到处是关节，那是脆弱
       D 端点占比   端点占格数的比例：一堆悬着的须子是散，不是秩序
     ================================================================ */

  function nexus(b, st) {
    var g = cellSet(b);
    if (!g.pts.length) return empty4('图是空的');
    var nn = g.ks.length, i, z, p, d;

    /* A：连通块的大小成几档 */
    var comps = Bd.components(b), sizes = [];
    for (i = 0; i < comps.length; i++) sizes.push(comps[i].length);
    var kinds = tierKinds(sizes);
    var A = { v: clamp01(1 - (kinds - 1) / 5), note: NT('# 个连通块，去重后 # 种大小', comps.length, kinds) };

    /* B：度数谱的熵。全图同一个度数 -> 熵 0 -> 满分；
       五种度数摊匀 -> 熵 1 -> 0 分。这里要的是「齐」，不是「多」。 */
    var NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var degs = [0, 0, 0, 0, 0];
    for (i = 0; i < nn; i++) {
      p = Bd.unkey(g.ks[i]); d = 0;
      for (z = 0; z < 4; z++) if (g.set[(p[0] + NB4[z][0]) + ',' + (p[1] + NB4[z][1])]) d++;
      degs[Math.max(0, Math.min(4, d))]++;
    }
    var H = 0, pr;
    for (z = 0; z < 5; z++) if (degs[z]) { pr = degs[z] / nn; H -= pr * Math.log(pr); }
    H /= Math.log(5);
    var B = { v: clamp01(1 - H), note: NT('度数谱 #，归一化熵 #（越小越齐）', degs.join('/'), f3(H)) };

    /* C：关节点。一条链上每一格都是关节——那是脆弱，不是秩序。 */
    var af = (st.art || 0) / Math.max(1, nn);
    var C = { v: clamp01(1 - af / 0.16), note: NT('关节点 # 个，占 #%（越少越好）', st.art || 0, Math.round(af * 100)) };

    /* D：端点（度数为一的格）。 */
    var lf = (st.leaf || 0) / Math.max(1, nn);
    var D = { v: clamp01(1 - lf / 0.12), note: NT('端点 # 个，占 #%（越少越好）', st.leaf || 0, Math.round(lf * 100)) };

    var W = { A: 0.26, B: 0.26, C: 0.24, D: 0.24 };
    return {
      v: clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D),
      parts: [
        { id: 'A', t: '块阶成档', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '度数谱齐', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '关节占比', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '端点占比', w: W.D, v: D.v, note: D.note }
      ]
    };
  }

  /* ================================================================
     十、层理 STRATIFICATION
     把格投影到惯量主轴上，得到一条「每层有多厚」的剖面。
     这一项问那条剖面有没有层理——跟同质度问的「局部疏密匀不匀」是两件事：
     同质度看邻域，这里看的是沿主轴切出来的整条剖面。
       A 剖面单峰   局部极大值有几个，一个最好
       B 剖面平稳   剖面的二阶差分粗糙度
       C 双向同调   主轴与垂直轴的剖面，粗糙度彼此有多近
       D 层厚成档   每层的格数去重后剩几种
     ================================================================ */

  function strata(b, st) {
    var g = cellSet(b);
    if (!g.pts.length) return empty4('图是空的');
    var pts = g.pts, n2 = pts.length, i, j;

    /* 主轴由格点自己的协方差算，不借用 stats 里的 theta——那里的约定另有用处。 */
    var mx = 0, my = 0, dx, dy;
    for (i = 0; i < n2; i++) { mx += pts[i][0]; my += pts[i][1]; }
    mx /= n2; my /= n2;
    var sxx = 0, syy = 0, sxy = 0;
    for (i = 0; i < n2; i++) {
      dx = pts[i][0] - mx; dy = pts[i][1] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    var th = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    var ca = Math.cos(th), sa = Math.sin(th);

    function profile(cx2, sx2) {
      var lo = Infinity, hi = -Infinity, v, t, K, bins;
      for (j = 0; j < n2; j++) {
        v = pts[j][0] * cx2 + pts[j][1] * sx2;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      K = Math.max(3, Math.min(14, Math.round(Math.sqrt(n2))));
      bins = [];
      for (t = 0; t < K; t++) bins.push(0);
      for (j = 0; j < n2; j++) {
        v = pts[j][0] * cx2 + pts[j][1] * sx2;
        bins[Math.max(0, Math.min(K - 1, Math.floor((v - lo) / Math.max(1e-9, hi - lo) * K)))]++;
      }
      return bins;
    }
    var P1 = profile(ca, sa);            /* 沿主轴 */
    var P2 = profile(-sa, ca);           /* 沿垂直轴 */

    var pk = peaksOf(P1);
    var A = { v: clamp01(1 - (pk - 1) / 4), note: NT('主轴剖面 # 层，局部峰 # 个', P1.length, pk) };
    var r1 = roughOf(P1);
    var B = { v: clamp01(1 - r1 / 0.9), note: NT('剖面粗糙度 #（越小越平）', f3(r1)) };
    var r2 = roughOf(P2);
    var C = { v: clamp01(1 - Math.abs(r1 - r2) / 0.6), note: NT('主轴粗糙度 #，垂直轴 #', f3(r1), f3(r2)) };
    var kd = tierKinds(P1);
    var D = { v: clamp01(1 - (kd - 1) / 6), note: NT('各层格数 #，去重后 # 种', P1.join('/'), kd) };

    var W = { A: 0.25, B: 0.25, C: 0.25, D: 0.25 };
    return {
      v: clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D),
      parts: [
        { id: 'A', t: '剖面单峰', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '剖面平稳', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '双向同调', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '层厚成档', w: W.D, v: D.v, note: D.note }
      ]
    };
  }

  /* ================================================================
     十一、外廓秩序 CONTOUR
     最后一项问的是「它整个看上去是不是一个东西」：
     凸包有没有白留、由质心往外的半径成不成档、各向是不是对称。
       A 凸包亏缺   凸包里的填充率要落在带上：太满是块，太疏是骨架
       B 径向成档   十六个扇区的最远半径，取整后剩几种
       C 径向平稳   那些半径的变异系数
       D 四向对称   四个象限的平均半径彼此有多接近
     ================================================================ */

  function contour(b, st) {
    var g = cellSet(b);
    if (!g.pts.length) return empty4('图是空的');
    var pts = g.pts, n2 = pts.length, i, t;

    /* A：凸包内填充率。hullA 由 body.stats 先算好，这里只取用。 */
    var ha = st.hullA || 0;
    var fl = ha > 0 ? Math.min(1, n2 / ha) : 1;
    var A = { v: bandV(fl, 0.70, 0.97, 0.35), note: NT('凸包内填充率 #，宜落在 0.70~0.97', f2(fl)) };

    /* 径向剖面：绕质心切十六个扇区，每区取最远的那个格 */
    var cx = 0, cy = 0;
    for (i = 0; i < n2; i++) { cx += pts[i][0]; cy += pts[i][1]; }
    cx /= n2; cy /= n2;
    var K = 16, rad = [], ax, ay, rr, bi;
    for (t = 0; t < K; t++) rad.push(0);
    for (i = 0; i < n2; i++) {
      ax = pts[i][0] - cx; ay = pts[i][1] - cy;
      bi = Math.floor((Math.atan2(ay, ax) + Math.PI) / (2 * Math.PI) * K) % K;
      rr = Math.sqrt(ax * ax + ay * ay);
      if (rr > rad[bi]) rad[bi] = rr;
    }
    var nz = [], ri;
    for (t = 0; t < K; t++) if (rad[t] > 0) nz.push(rad[t]);

    var B, C, D;
    if (nz.length < 6) {
      var why = '有效扇区不足六，量不出外廓';
      B = { v: 0, note: why }; C = { v: 0, note: why }; D = { v: 0, note: why };
    } else {
      var rk = [], kd;
      for (t = 0; t < nz.length; t++) rk.push(Math.round(nz[t]));
      kd = tierKinds(rk);
      B = { v: clamp01(1 - (kd - 1) / 8), note: NT('# 个扇区有格，半径取整后 # 种', nz.length, kd) };
      var cr2 = cvList(nz);
      C = { v: clamp01(1 - cr2 / 0.55), note: NT('半径变异系数 #（越小越平稳）', f3(cr2)) };
      var q = [0, 0, 0, 0], qc = [0, 0, 0, 0], qi;
      for (i = 0; i < n2; i++) {
        ax = pts[i][0] - cx; ay = pts[i][1] - cy;
        qi = (ax >= 0 ? 1 : 0) + (ay >= 0 ? 2 : 0);
        q[qi] += Math.sqrt(ax * ax + ay * ay); qc[qi]++;
      }
      var qm = [];
      for (t = 0; t < 4; t++) qm.push(qc[t] ? q[t] / qc[t] : 0);
      var qcv = cvList(qm);
      D = { v: clamp01(1 - qcv / 0.45), note: NT('四象限平均半径 #，变异系数 #', qm.map(function (x) { return f2(x); }).join('/'), f3(qcv)) };
    }

    var W = { A: 0.28, B: 0.24, C: 0.24, D: 0.24 };
    return {
      v: clamp01(A.v * W.A + B.v * W.B + C.v * W.C + D.v * W.D),
      parts: [
        { id: 'A', t: '凸包亏缺', w: W.A, v: A.v, note: A.note },
        { id: 'B', t: '径向成档', w: W.B, v: B.v, note: B.note },
        { id: 'C', t: '径向平稳', w: W.C, v: C.v, note: C.note },
        { id: 'D', t: '四向对称', w: W.D, v: D.v, note: D.note }
      ]
    };
  }

  /* ---------- 六项合成 ----------
     从前是十一项。十一项的问题是**没人记得住**：
     玩家在组装台上装一件，要同时想象「层理」「连通秩序」「外廓秩序」
     各会怎么动——那不是在做设计，那是在做心算。衡量的标准若不能被记住，
     它就不能指导任何决策，只能事后给个数字。
     所以砍到六项，每一项都配一句**能自己动手验的话**（ask 字段）：
     随手在纸上折一下、数一下、看一眼，就能知道这一项大概会读到多少。
     six 个人能记住的上限，也是一张仪表盘该有的格子数。

     src 是这一项的算法入口。合成与「只量一项」都从这张表走，
     所以以后加减项只改这里——别的模块（任务 / 成就 / 鉴赏录 / 科技树）
     一律读 DEFS，不再各自抄一份键名。 */
  /* 名字、说明、怎么验，三样都按表项的老规矩自带四语（t / en / ja / ru）。
     它们不走叠加层词典——这些是**数据**，不是散在界面里的句子，
     放在表上才能跟这一项本身一起被看见、一起被改。 */
  var DEFS = [
    { k: 'sym', t: '对称', en: 'SYMMETRY', ja: '対称', ru: 'СИММЕТРИЯ', g: '质变',
      d: { t: '对折之后能不能重合', en: 'Does it overlap when folded',
        ja: '折り重ねたときに重なるか', ru: 'Совпадает ли при сложении' },
      ask: { t: '沿中线对折，两边重不重合', en: 'Fold it down the middle: do the two halves match?',
        ja: '真ん中で折って、両側は重なるか', ru: 'Сложите по середине: совпадают ли половины?' },
      src: function (b, st) { return globalSymmetry(b, st); } },
    { k: 'repeat', t: '重复', en: 'REPETITION', ja: '反復', ru: 'ПОВТОР', g: '质变',
      d: { t: '同一段花样是不是在别处又出现', en: 'Does the same motif show up again elsewhere',
        ja: '同じ模様が別の場所にも現れるか', ru: 'Повторяется ли тот же мотив в другом месте' },
      ask: { t: '缩小一半再看，还是不是同一个花样', en: 'Shrink it by half: still the same pattern?',
        ja: '半分に縮めて見ても同じ模様か', ru: 'Уменьшите вдвое: узор тот же?' },
      src: function (b, st) { return selfSimilarity(b, st); } },
    { k: 'void', t: '通透', en: 'VOID ORDER', ja: '通透', ru: 'ПОРЯДОК ПУСТОТ', g: '质变',
      d: { t: '洞是不是排得有秩序，而不是随手漏出来的', en: 'Are the holes laid out with order, not just leaked',
        ja: '穴は秩序を持って並んでいるか', ru: 'Расположены ли пустоты упорядоченно' },
      ask: { t: '洞的大小差不多吗，位置对着中轴吗', en: 'Are the holes about the same size, placed about the axis?',
        ja: '穴の大きさは揃っているか、位置は中軸に沿っているか', ru: 'Пустоты близки по размеру и выровнены по оси?' },
      src: function (b, st) { return porosity(b, st); } },
    { k: 'even', t: '匀质', en: 'EVENNESS', ja: '均質', ru: 'РОВНОСТЬ', g: '质变',
      d: { t: '疏密在各处是不是一个样', en: 'Is the density the same everywhere',
        ja: '疎密はどこでも同じか', ru: 'Плотность одинакова повсюду?' },
      ask: { t: '从中心到四角，疏密是不是一路平稳', en: 'From centre to corners: does the density stay steady?',
        ja: '中心から四隅まで、疎密は一定に続くか', ru: 'От центра к углам плотность ровная?' },
      src: function (b, st) { return homogeneity(b, st); } },
    { k: 'weave', t: '环络', en: 'WEAVE', ja: '環絡', ru: 'ЦИКЛИЧНОСТЬ', g: '质变',
      d: { t: '是环织成的网，还是一棵树', en: 'A net woven of cycles, or a tree',
        ja: '環で織られた網か、それとも木か', ru: 'Сеть из циклов или дерево' },
      ask: { t: '有没有围出来的圈，还是每根枝都只有一个走法', en: 'Are there enclosed loops, or does every branch have one way only?',
        ja: '囲まれた輪があるか、それとも枝に道が一つしかないか', ru: 'Есть ли замкнутые петли, или у каждой ветви один путь?' },
      src: function (b, st) { return cyclicity(b, st); } },
    { k: 'edge', t: '轮廓', en: 'CONTOUR', ja: '輪郭', ru: 'КОНТУР', g: '质变',
      d: { t: '整个看上去是不是一个东西', en: 'Does the whole thing read as one object',
        ja: '全体はひとつのものに見えるか', ru: 'Читается ли целое как один объект' },
      ask: { t: '外廓是不是干净的一整块，有没有飘出去的碎块', en: 'Is the outline one clean piece, with no floating scraps?',
        ja: '輪郭はきれいな一塊か、浮いた欠片はないか', ru: 'Контур — единый кусок, без висящих обрывков?' },
      src: function (b, st) { return contour(b, st); } }
  ];
  var DEFBY = {};
  (function () { var i; for (i = 0; i < DEFS.length; i++) DEFBY[DEFS[i].k] = DEFS[i]; })();
  /* stats 上的字段名：es + 首字母大写。别处一律从 DEFS 推，不手写。 */
  function statKey(k) { return 'es' + k.charAt(0).toUpperCase() + k.slice(1); }

  /* 合成分：六项的加权几何平均。就这一条，没有别的。
     曾经在这上面还乘过两层惩罚——一层罚「落差」（十一项差得越开扣得越多），
     一层罚「掉队」（掉到 FLOOR 以下的项每项再扣一道）。那两层已经拿掉了。
     理由：几何平均本身就在罚不匀——六项里只要有一项矮，整条乘积就跟着矮，
     而且矮得越狠拽得越凶。在一个已经在罚的算子上再补一脚，
     只会让分数变成「读数的读数」，看的人没法从读数反推出自己哪里做错了。
     现在分就是读数算出来的那个数，一眼能对得上。
     落差与掉队仍然每次都算，仍然摆在测量页上——它们只是诊断，不参与算分。 */
  /* 权重：六项一律 1.0。
     从前前四项给 1.0、后七项给 0.85，那点差别说不出理由——
     既然六项都是「一眼能验」的同一档东西，就不该有暗的轻在里头。 */
  var W11 = { sym: 1.0, repeat: 1.0, void: 1.0, even: 1.0, weave: 1.0, edge: 1.0 };
  /* 诊断线：低于这条线的项算「掉队」。只做两件事——
     喂给测量页标出来，喂给命题与判定的判据用。它不碰合成分。 */
  var FLOOR = 0.30;
  /* 折叠：加权几何平均。抽出来是因为混沌的「反转」律要换一套数再折一次。 */
  function fold(vals, EPS) {
    var lg = 0, wsum = 0, i, k, w, v, lo = 1, hi = 0, weak = 0;
    for (i = 0; i < DEFS.length; i++) {
      k = DEFS[i].k; w = W11[k] || 1; v = clamp01(vals[k] || 0);
      lg += w * Math.log(v + EPS); wsum += w;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      if (v < FLOOR) weak++;
    }
    var gm = clamp01(Math.exp(lg / Math.max(1e-9, wsum)) - EPS);
    var spread = clamp01(hi - lo);
    return { score: gm, gm: gm, spread: spread, weak: weak, lo: lo };
  }
  function compose(vals, ctx) {
    var EPS = 0.02;
    var r = fold(vals, EPS);
    return {
      score: r.score, gm: clamp01(r.gm), spread: r.spread,
      weak: r.weak, lo: clamp01(r.lo)
    };
  }

  /* 分档：六项的本征分布大致落在 0.27～0.82 之间（见 test 里的量测），
     门槛按这个区间切成五档。0.92 那档不是给人常拿的——要拿它，
     六项里最矮的一项也得接近 0.9，正常几何下拿不到，得靠特质与科技去抬。
     惩罚拿掉之后这套门槛一个字没改：档位是读数的标签，不是难度旋钮。 */
  function grade(v) {
    if (v >= 0.92) return { t: '极', en: 'SUPREME', i: 4 };
    if (v >= 0.78) return { t: '上', en: 'HIGH', i: 3 };
    if (v >= 0.58) return { t: '中', en: 'FAIR', i: 2 };
    if (v >= 0.36) return { t: '下', en: 'LOW', i: 1 };
    return { t: '微', en: 'FAINT', i: 0 };
  }

  /* 空图的全零读数。图上没有东西，就没有结构可谈——
     六项一律 0，不给「空图很对称」这种荒唐读数。 */
  function zeros() {
    var why = '图是空的';
    var z = { v: 0, note: why, parts: [{ id: '—', t: '—', w: 1, v: 0, note: why }] };
    var out = {
      esScore: 0, esPeak: null, esPeakV: 0, esDim: 0, esSpread: 0, esGm: 0,
      esWeak: 0, esLo: 0, es: { score: 0 }, esDetail: {}, esGrade: grade(0)
    };
    var i;
    for (i = 0; i < DEFS.length; i++) {
      out[statKey(DEFS[i].k)] = 0;
      out.es[DEFS[i].k] = 0;
      out.esDetail[DEFS[i].k] = z;
    }
    return out;
  }

  /* 量一遍六项。返回的字段会被并进 stats，所以键名都带 es 前缀。
     每一项怎么算由 DEFS 里的 src 决定，这里只管跑表、合成、打包。 */
  function measure(b, st) {
    if (!st || !st.n) return zeros();
    var got = {}, raw = {}, i, k;
    for (i = 0; i < DEFS.length; i++) {
      k = DEFS[i].k;
      got[k] = DEFS[i].src(b, st);
      raw[k] = got[k].v;
    }
    var c = compose(raw, { n: st.n });
    /* 峰值：六项里最高的那一项，用来判断「这具图形强在哪一头」 */
    var peak = -1, peakK = null, kk;
    for (kk in raw) if (raw[kk] > peak) { peak = raw[kk]; peakK = kk; }
    var fr = fractality(b, st);        /* 只用来算标度维数，不进六项 */
    var out = {
      esScore: c.score,
      esPeak: peakK, esPeakV: peak,
      esDim: (got.repeat.dim + (fr.dim || 0)) / 2,
      esSpread: c.spread, esGm: c.gm, esWeak: c.weak, esLo: c.lo,
      /* es 是未经特质/科技抬高的原始六项：rig 拿它当基值再做加成，
         measure 页拿它底下的 detail 摊开判据。两者都用原值，不混。
         score 一并带上——任务页与组装台直接读 es.score，别处不必再算一遍。 */
      es: { score: c.score },
      esDetail: {},
      esGrade: grade(c.score)
    };
    for (i = 0; i < DEFS.length; i++) {
      k = DEFS[i].k;
      out[statKey(k)] = raw[k];
      out.es[k] = raw[k];
      out.esDetail[k] = got[k];
    }
    return out;
  }

  /* 只量一项（任务与成就按需调用，不必每次全算）。
     表在 DEFS 上，所以这里不需要一串 if。 */
  function one(k, b, st) {
    var d = DEFBY[k];
    if (d) return d.src(b, st);
    /* 退场的那几项（部分对称 / 分形 / 边界节律 / 连通秩序 / 层理）
       仍留着算法，供诊断与旧存档对账用，但已不进六项、不进合成分。 */
    if (k === 'partsym') return partialSymmetry(b, st);
    if (k === 'fractal') return fractality(b, st);
    if (k === 'border') return borderRhythm(b, st);
    if (k === 'nexus') return nexus(b, st);
    if (k === 'strata') return strata(b, st);
    return empty4('没有这一项');
  }

  BS.essence = {
    DEFS: DEFS, DEFBY: DEFBY, statKey: statKey,
    measure: measure, one: one, grade: grade, compose: compose,
    clamp01: clamp01, zeros: zeros
  };
})(window.BS);
