/* core/body.js —— 装出来的那具图形。
   它只是一堆格位，每格记着它属于哪一个元件、那元件的原点在哪、转过多少度。
   所有能说的量都从这堆格位里真算出来，一项都不估算。
   元件的量由形状决定：一格算一份重，资质只改这一份的倍率——
   所以「质量」是面积的等价物，一克不多，一克不少。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var G = BS.geo;

  var D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function key(i, j) { return i + ',' + j; }
  function unkey(k) { var a = String(k).split(','); return [+a[0], +a[1]]; }

  function mk() { return { cells: {} }; }

  /* 存档可能是旧版本、也可能被人手改过：认不出的格清掉，坐标不合法的清掉。
     不清「不连通」的碎块——断开是这一部作品里真会发生的事，得留着看。 */
  function fix(b) {
    var o = (b && typeof b === 'object' && b.cells && typeof b.cells === 'object') ? b.cells : {};
    var c = {}, k, e;
    for (k in o) {
      e = o[k];
      if (!e || typeof e !== 'object') continue;
      if (!/^-?\d+,-?\d+$/.test(k)) continue;
      var u = unkey(k);
      if (!isFinite(u[0]) || !isFinite(u[1])) continue;
      if (typeof e.e !== 'string' || !e.e) continue;
      c[k] = { e: e.e, ox: e.ox | 0, oy: e.oy | 0, r: ((e.r | 0) % 4 + 4) % 4, seq: e.seq | 0 };
    }
    return { cells: c };
  }

  function at(b, i, j) { return b.cells[key(i, j)] || null; }
  function n(b) { var c = 0, k; for (k in b.cells) c++; return c; }
  function list(b) {
    var out = [], k, c, e;
    for (k in b.cells) {
      c = unkey(k); e = b.cells[k];
      out.push({ i: c[0], j: c[1], k: k, e: e.e, ox: e.ox, oy: e.oy, r: e.r, seq: e.seq });
    }
    out.sort(function (x, y) { return x.seq - y.seq; });
    return out;
  }

  /* ---------- 实例：同一个元件在板上占的那一片格 ---------- */
  function ik(ent, ox, oy) { return ent + '@' + ox + ',' + oy; }
  function instKeyOf(b, k) {
    var c = b.cells[k];
    return c ? ik(c.e, c.ox, c.oy) : null;
  }
  function instances(b) {
    var out = {}, k, c, id;
    for (k in b.cells) {
      c = b.cells[k];
      id = ik(c.e, c.ox, c.oy);
      if (!out[id]) out[id] = { id: id, e: c.e, ox: c.ox, oy: c.oy, r: c.r | 0, seq: c.seq | 0, cells: [] };
      out[id].cells.push(k);
    }
    return out;
  }
  function instList(b) {
    var m = instances(b), out = [], id;
    for (id in m) out.push(m[id]);
    out.sort(function (x, y) { return x.seq - y.seq; });
    return out;
  }

  /* 只能贴着已经有的格装；图还空着的时候，第一件随便放。
     注意是「整件都放得下，且至少一格贴着」——元件是一体的，没有半件。 */
  function canPlace(b, cs, i, j) {
    var z, q, x, y;
    for (z = 0; z < cs.length; z++) {
      x = i + cs[z][0]; y = j + cs[z][1];
      if (b.cells[x + ',' + y]) return false;
    }
    var touch = false;
    if (n(b) === 0) touch = true;
    else {
      for (z = 0; z < cs.length && !touch; z++) {
        x = i + cs[z][0]; y = j + cs[z][1];
        for (q = 0; q < 4; q++) if (b.cells[(x + D4[q][0]) + ',' + (y + D4[q][1])]) { touch = true; break; }
      }
    }
    if (!touch) return false;
    return true;
  }
  function place(b, i, j, ent, r, cs, seq) {
    if (!canPlace(b, cs, i, j)) return false;
    var z;
    for (z = 0; z < cs.length; z++) {
      b.cells[key(i + cs[z][0], j + cs[z][1])] = { e: ent, ox: i, oy: j, r: ((r | 0) % 4 + 4) % 4, seq: seq | 0 };
    }
    return true;
  }
  /* 直接落子：只查「有没有压到别的东西」，不查连通性。
     撤销「挪」与「转」这两步时要用它把原件放回原位——那时候原位刚刚空出来，
     放回去是板上钉钉的事，不该再被「有没有贴着」问一遍。 */
  function stamp(b, i, j, ent, r, cs, seq) {
    var z;
    for (z = 0; z < cs.length; z++) if (b.cells[key(i + cs[z][0], j + cs[z][1])]) return false;
    for (z = 0; z < cs.length; z++) {
      b.cells[key(i + cs[z][0], j + cs[z][1])] = { e: ent, ox: i, oy: j, r: ((r | 0) % 4 + 4) % 4, seq: seq | 0 };
    }
    return true;
  }
  /* 拆一格就是拆一整件：元件没有半件这回事 */
  function removeInst(b, k) {
    var id = instKeyOf(b, k);
    if (!id) return null;
    var m = instances(b), ins = m[id], z;
    if (!ins) return null;
    for (z = 0; z < ins.cells.length; z++) delete b.cells[ins.cells[z]];
    return ins;
  }

  /* ---------- 轮廓：追踪有向边界边（单位格，精确） ---------- */
  function ckey(x, y) { return Math.round(x * 2) + ',' + Math.round(y * 2); }
  function boundary(b) {
    var S = b.cells, edges = [], k, i, j;
    for (k in S) {
      var c = unkey(k); i = c[0]; j = c[1];
      if (!S[key(i, j - 1)]) edges.push({ a: [i - 0.5, j - 0.5], b: [i + 0.5, j - 0.5] });
      if (!S[key(i + 1, j)]) edges.push({ a: [i + 0.5, j - 0.5], b: [i + 0.5, j + 0.5] });
      if (!S[key(i, j + 1)]) edges.push({ a: [i + 0.5, j + 0.5], b: [i - 0.5, j + 0.5] });
      if (!S[key(i - 1, j)]) edges.push({ a: [i - 0.5, j + 0.5], b: [i - 0.5, j - 0.5] });
    }
    var byStart = {}, e, z;
    for (e = 0; e < edges.length; e++) {
      var ka = ckey(edges[e].a[0], edges[e].a[1]);
      (byStart[ka] = byStart[ka] || []).push(e);
    }
    var used = new Array(edges.length), rings = [];
    for (e = 0; e < edges.length; e++) {
      if (used[e]) continue;
      var ring = [], cur = e;
      while (cur != null && !used[cur]) {
        used[cur] = 1;
        ring.push(edges[cur].a);
        var kb = ckey(edges[cur].b[0], edges[cur].b[1]);
        var nx = null, cand = byStart[kb] || [];
        for (z = 0; z < cand.length; z++) if (!used[cand[z]]) { nx = cand[z]; break; }
        cur = nx;
      }
      if (ring.length >= 4) rings.push(ring);
    }
    return rings;
  }
  function pathOf(rings) {
    var d = '', i, z;
    for (i = 0; i < rings.length; i++) {
      for (z = 0; z < rings[i].length; z++) d += (z ? 'L' : 'M') + rings[i][z][0] + ' ' + rings[i][z][1];
      d += 'Z';
    }
    return d;
  }
  /* 转角。轮廓的边是按每个格自身逆时针生成的，所以外环逆时针、洞顺时针——
     两边都把材料留在前进方向的左手边，于是左转恒为凸角、右转恒为凹角，不必再看环的朝向。 */
  function turns(rings) {
    var conv = 0, conc = 0, i, z, L;
    for (i = 0; i < rings.length; i++) {
      var r = rings[i]; L = r.length;
      for (z = 0; z < L; z++) {
        var p0 = r[(z - 1 + L) % L], p1 = r[z], p2 = r[(z + 1) % L];
        var ux = p1[0] - p0[0], uy = p1[1] - p0[1];
        var vx = p2[0] - p1[0], vy = p2[1] - p1[1];
        var cr = ux * vy - uy * vx;
        if (cr > 0) conv++;
        else if (cr < 0) conc++;
      }
    }
    return { conv: conv, conc: conc };
  }

  /* ---------- 图 ---------- */
  function graph(b) {
    var S = b.cells, ks = [], k, adj = {}, i, j;
    for (k in S) { ks.push(k); adj[k] = []; }
    for (i = 0; i < ks.length; i++) {
      var c = unkey(ks[i]);
      for (j = 0; j < 4; j++) {
        var nk = key(c[0] + D4[j][0], c[1] + D4[j][1]);
        if (S[nk]) adj[ks[i]].push(nk);
      }
    }
    return { ks: ks, adj: adj };
  }
  function articulations(b) {
    var g = graph(b), ks = g.ks, adj = g.adj;
    var disc = {}, low = {}, par = {}, art = {}, t = 0, i;
    for (i = 0; i < ks.length; i++) if (!disc[ks[i]]) dfs(ks[i], true);
    function dfs(u, root) {
      disc[u] = low[u] = ++t;
      var kids = 0, nb = adj[u], v, z;
      for (z = 0; z < nb.length; z++) {
        v = nb[z];
        if (!disc[v]) {
          par[v] = u; kids++;
          dfs(v, false);
          if (low[v] < low[u]) low[u] = low[v];
          if (!root && low[v] >= disc[u]) art[u] = 1;
        } else if (v !== par[u] && disc[v] < low[u]) low[u] = disc[v];
      }
      if (root && kids > 1) art[u] = 1;
    }
    var out = [];
    for (i = 0; i < ks.length; i++) if (art[ks[i]]) out.push(ks[i]);
    return out;
  }
  function components(b) {
    var g = graph(b), ks = g.ks, adj = g.adj, seen = {}, out = [], i, stack;
    for (i = 0; i < ks.length; i++) {
      if (seen[ks[i]]) continue;
      var comp = [], u;
      stack = [ks[i]]; seen[ks[i]] = 1;
      while (stack.length) {
        u = stack.pop(); comp.push(u);
        var nb = adj[u], z;
        for (z = 0; z < nb.length; z++) if (!seen[nb[z]]) { seen[nb[z]] = 1; stack.push(nb[z]); }
      }
      out.push(comp);
    }
    return out;
  }
  /* 最长链：双扫法。一般图上它是近似值，所以名字与手册里都写明近似。 */
  function diameter(b) {
    var g = graph(b), ks = g.ks;
    if (!ks.length) return { dia: 0, rad: 0 };
    function sweep(s) {
      var dist = {}, q = [s], head = 0, last = s;
      dist[s] = 0;
      while (head < q.length) {
        var u = q[head++], nb = g.adj[u], z;
        last = u;
        for (z = 0; z < nb.length; z++) if (dist[nb[z]] === undefined) { dist[nb[z]] = dist[u] + 1; q.push(nb[z]); }
      }
      return { last: last, dist: dist };
    }
    var a = sweep(ks[0]).last;
    var r = sweep(a);
    var d = r.dist[r.last] || 0;
    return { dia: d, rad: Math.ceil(d / 2) };
  }

  function symmetry(b) {
    var S = b.cells, ks = Object.keys(S);
    if (!ks.length) return { rot: 1, refl: false, order: 1, mv: false, mh: false, cx: 0, cy: 0 };
    var i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity, i, c;
    for (i = 0; i < ks.length; i++) {
      c = unkey(ks[i]);
      if (c[0] < i0) i0 = c[0]; if (c[0] > i1) i1 = c[0];
      if (c[1] < j0) j0 = c[1]; if (c[1] > j1) j1 = c[1];
    }
    var cx = (i0 + i1) / 2, cy = (j0 + j1) / 2;
    function has(a, bb) { return !!S[key(a, bb)]; }
    function mapAll(f) {
      for (var z = 0; z < ks.length; z++) {
        var q = unkey(ks[z]), t = f(q[0], q[1]);
        if (!has(t[0], t[1])) return false;
      }
      return true;
    }
    var mv = mapAll(function (a, bb) { return [Math.round(2 * cx - a), bb]; });
    var mh = mapAll(function (a, bb) { return [a, Math.round(2 * cy - bb)]; });
    var r2 = mapAll(function (a, bb) { return [Math.round(2 * cx - a), Math.round(2 * cy - bb)]; });
    var r4 = false;
    if (i1 - i0 === j1 - j0) {
      r4 = mapAll(function (a, bb) { return [Math.round(cx + bb - cy), Math.round(cy - (a - cx))]; });
    }
    var rot = r4 ? 4 : (r2 ? 2 : 1);
    var refl = mv || mh;
    return { rot: rot, refl: refl, order: rot * (refl ? 2 : 1), mv: mv, mh: mh, cx: cx, cy: cy };
  }

  /* ---------- 系数束：六十七项，全部真算 ----------
     meta(ent) 返回那一件元件的 { w, rar, lv }；认不出来的按 1.00 重、常档算。 */
  var NIL = { w: 1, rar: 0, lv: 0 };
  function stats(b, meta) {
    meta = meta || function () { return NIL; };
    var st = {
      n: 0, M: 0, cellW: 0, rg: 0, rmean: 0, rmax: 0, rmin: 0,
      cheb: 0, manh: 0, euc: 0, diag: 0,
      e: 0, comp: 0, cyc: 0, art: 0, red: 1, leaf: 0, branch: 0, maxdeg: 0, avgdeg: 0,
      tree: false, dia: 0, rad: 0,
      P: 0, rings: 0, holes: 0, verts: 0, conv: 0, conc: 0, turnR: 0,
      bboxW: 0, bboxH: 0, aspect: 1, spanX: 0, spanY: 0, boxfill: 0, void: 0,
      hullV: 0, hullA: 0, fill: 0,
      exposure: 1, circularity: 0, boundaryP: 0, fractal: 0,
      cx: 0, cy: 0, bcx: 0, bcy: 0, ecc: 0,
      Ixx: 0, Iyy: 0, Ixy: 0, l1: 0, l2: 0, theta: 0, aniso: 1,
      sym: symmetry(b), rar: [0, 0, 0, 0, 0], rarMax: 0, rarMix: 0, lvMax: 0, lvSum: 0, insts: 0
    };
    var ks = Object.keys(b.cells), i, c, m2;
    st.n = ks.length;
    if (!st.n) {                               /* 空图不给 NaN，只给零 */
      if (BS.essence) { var z = BS.essence.zeros(), zk; for (zk in z) st[zk] = z[zk]; }
      return st;
    }

    var M = 0, cx = 0, cy = 0, gx = 0, gy = 0, mix = 0, id, m3;
    for (i = 0; i < st.n; i++) {
      c = unkey(ks[i]);
      m2 = meta(b.cells[ks[i]].e) || NIL;
      M += m2.w;
      cx += m2.w * c[0]; cy += m2.w * c[1];
      gx += c[0]; gy += c[1];
      st.rar[Math.max(0, Math.min(4, m2.rar | 0))]++;
      if ((m2.rar | 0) > st.rarMax) st.rarMax = m2.rar | 0;
      if ((m2.lv | 0) > st.lvMax) st.lvMax = m2.lv | 0;
      st.lvSum += (m2.lv | 0);
    }
    cx /= M; cy /= M; gx /= st.n; gy /= st.n;
    st.M = M; st.cellW = M / st.n; st.cx = cx; st.cy = cy; st.bcx = gx; st.bcy = gy;
    st.ecc = Math.sqrt((cx - gx) * (cx - gx) + (cy - gy) * (cy - gy));
    for (i = 0; i < 5; i++) if (st.rar[i]) mix++;
    st.rarMix = mix;
    m3 = instances(b);
    for (id in m3) st.insts++;

    var Ixx = 0, Iyy = 0, Ixy = 0;
    for (i = 0; i < st.n; i++) {
      c = unkey(ks[i]);
      m2 = meta(b.cells[ks[i]].e) || NIL;
      var rx = c[0] - cx, ry = c[1] - cy, d = Math.sqrt(rx * rx + ry * ry);
      Ixx += m2.w * ry * ry; Iyy += m2.w * rx * rx; Ixy -= m2.w * rx * ry;
      st.rmean += d; if (d > st.rmax) st.rmax = d;
      if (!i || d < st.rmin) st.rmin = d;
      var ax = Math.abs(rx), ay = Math.abs(ry);
      if (ax > st.cheb) st.cheb = ax;
      if (ay > st.cheb) st.cheb = ay;
      if (ax + ay > st.manh) st.manh = ax + ay;
      if (d > st.euc) st.euc = d;
    }
    st.rmean /= st.n;
    st.Ixx = Ixx; st.Iyy = Iyy; st.Ixy = Ixy;
    var tr = Ixx + Iyy, dt2 = Ixx * Iyy - Ixy * Ixy;
    var disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt2));
    st.l1 = tr / 2 + disc; st.l2 = Math.max(1e-9, tr / 2 - disc);
    st.aniso = st.l1 / st.l2;
    st.theta = 0.5 * Math.atan2(2 * Ixy, Iyy - Ixx);
    st.rg = Math.sqrt(tr / M);

    var g = graph(b), deg = 0, kk, z;
    for (kk = 0; kk < g.ks.length; kk++) deg += g.adj[g.ks[kk]].length;
    st.e = deg / 2;
    st.avgdeg = st.n ? st.e * 2 / st.n : 0;
    for (kk = 0; kk < g.ks.length; kk++) {
      z = g.adj[g.ks[kk]].length;
      if (z > st.maxdeg) st.maxdeg = z;
      if (z === 1) st.leaf++;
      if (z >= 3) st.branch++;
    }
    st.comp = components(b).length;
    st.cyc = st.e - st.n + st.comp;
    st.art = articulations(b).length;
    st.red = 1 - st.art / Math.max(1, st.n - 1);
    st.tree = st.e === st.n - st.comp;
    var dm = diameter(b);
    st.dia = dm.dia; st.rad = dm.rad;

    var rings = boundary(b), per = 0, verts = 0;
    for (i = 0; i < rings.length; i++) { per += rings[i].length; verts += rings[i].length; }
    st.P = per; st.verts = verts; st.rings = rings.length;
    st.holes = Math.max(0, rings.length - 1);
    var tn = turns(rings);
    st.conv = tn.conv; st.conc = tn.conc;
    st.turnR = st.conv ? st.conc / st.conv : 0;
    st.exposure = per / (2 * Math.sqrt(Math.PI * st.n));
    st.circularity = 4 * Math.PI * st.n / (per * per);
    st.boundaryP = per * per / st.n;
    st.fractal = (st.n > 1 && per > 4) ? Math.min(2, 2 * Math.log(per / 4) / Math.log(st.n)) : 0;

    var pts = [], i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
    for (i = 0; i < st.n; i++) {
      c = unkey(ks[i]);
      pts.push([c[0], c[1]]);
      if (c[0] < i0) i0 = c[0]; if (c[0] > i1) i1 = c[0];
      if (c[1] < j0) j0 = c[1]; if (c[1] > j1) j1 = c[1];
    }
    var hull = G.convexHull(pts), bb = G.bbox(pts);
    st.hullV = hull.vs; st.hullA = hull.area;
    st.fill = hull.area > 0 ? Math.min(1, st.n / (hull.area + 0.6)) : 1;
    st.bboxW = bb.w + 1; st.bboxH = bb.h + 1;
    st.spanX = st.bboxW; st.spanY = st.bboxH;
    st.aspect = Math.max(st.bboxW, st.bboxH) / Math.max(1, Math.min(st.bboxW, st.bboxH));
    st.diag = Math.sqrt(st.bboxW * st.bboxW + st.bboxH * st.bboxH);
    st.void = st.bboxW * st.bboxH - st.n;
    st.boxfill = st.n / (st.bboxW * st.bboxH);

    /* 质变六项：对称 / 重复 / 通透 / 匀质 / 环络 / 轮廓。
       这一项要等上面全部系数算完才能量——它要用到 sym、ecc、bcx、P、conc 等。
       真算，不估算；每一项底下还挂着若干条独立判据，测量页会摊开给人看。 */
    if (BS.essence) {
      var es = BS.essence.measure(b, st), ek;
      for (ek in es) st[ek] = es[ek];
    }
    return st;
  }

  BS.body = {
    key: key, unkey: unkey, mk: mk, fix: fix, at: at, list: list, n: n,
    ik: ik, instances: instances, instList: instList, instKeyOf: instKeyOf,
    canPlace: canPlace, place: place, removeInst: removeInst, stamp: stamp,
    boundary: boundary, pathOf: pathOf, turns: turns,
    graph: graph, articulations: articulations, components: components, diameter: diameter,
    symmetry: symmetry, stats: stats
  };
})(window.BS);
