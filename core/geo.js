/* core/geo.js —— 点集几何。
   这一部作品里，几何不是一组抽象的直线，而是一具被一格一格拼出来的图形。
   留下来的只有四件真东西：凸包、面积、质心、包围盒。其余全部由图形自己算。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  function convexHull(pts) {
    var P = pts.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; });
    if (P.length < 3) return { vs: P.length, area: 0, ring: P };
    var i, lo = [], up = [];
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < P.length; i++) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], P[i]) <= 1e-12) lo.pop();
      lo.push(P[i]);
    }
    for (i = P.length - 1; i >= 0; i--) {
      while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], P[i]) <= 1e-12) up.pop();
      up.push(P[i]);
    }
    lo.pop(); up.pop();
    var ring = lo.concat(up), area = 0;
    for (i = 0; i < ring.length; i++) {
      var a = ring[i], b = ring[(i + 1) % ring.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return { vs: ring.length, area: Math.abs(area) / 2, ring: ring };
  }

  function polyArea(ring) {
    var a = 0, i;
    for (i = 0; i < ring.length; i++) {
      var p = ring[i], q = ring[(i + 1) % ring.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(a) / 2;
  }
  function centroid(pts) {
    var x = 0, y = 0, i;
    if (!pts.length) return [0, 0];
    for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / pts.length, y / pts.length];
  }
  function bbox(pts) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    for (i = 0; i < pts.length; i++) {
      if (pts[i][0] < x0) x0 = pts[i][0];
      if (pts[i][0] > x1) x1 = pts[i][0];
      if (pts[i][1] < y0) y0 = pts[i][1];
      if (pts[i][1] > y1) y1 = pts[i][1];
    }
    if (!pts.length) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }

  BS.geo = { convexHull: convexHull, polyArea: polyArea, centroid: centroid, bbox: bbox };
})(window.BS);
