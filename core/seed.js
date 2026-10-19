/* core/seed.js —— 派生随机。
   ------------------------------------------------------------------
   一场战斗 = 部署与种子的纯函数。同种子同部署，逐 tick 同结果——
   这条既是设计（玩家能复盘「那枚墙若建在另一边」），也是工程
   （冒烟测试拿它做逐字节断言）。
   每种运算从局种子派生自己的子种子：波次、路径、敌人变量各走各的流，
   改一个不会悄悄动另一个。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* FNV-1a：把字符串拌成 32 位盐 */
  function hash(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* 派生：任一命名运算拿到自己的一条随机流 */
  function derive(seed, tag) {
    var s = String(seed) + '|' + tag;
    return mulberry32((hash(s) ^ (seed | 0)) >>> 0);
  }

  /* 按权重挑一个：表是 [{ id, w }]，返回 id */
  function pick(rnd, rows) {
    var tot = 0, i;
    for (i = 0; i < rows.length; i++) tot += rows[i].w;
    var r = rnd() * tot;
    for (i = 0; i < rows.length; i++) {
      r -= rows[i].w;
      if (r <= 0) return rows[i].id;
    }
    return rows[rows.length - 1].id;
  }

  /* 一局的种子：不指定就现摇一个；指定则整个宇宙随之确定 */
  function runSeed(x) {
    if (x != null && x !== '') return Math.abs(hash(String(x))) % 2147483647;
    return (Math.random() * 2147483647) | 0;
  }

  BS.seed = { mulberry32: mulberry32, hash: hash, derive: derive, pick: pick, runSeed: runSeed };
})(window.BS);
