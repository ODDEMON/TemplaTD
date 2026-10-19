/* core/parts.js —— 元件：形状、型、特质。
   ------------------------------------------------------------------
   同一序号永远是同一形状、同一批特质——这条铁律不动。
   稀有度只由序号决定，成就与解锁一概不改它：形状决定长相，
   长相决定这一件美不美；若解锁能把已落下的件改形，
   库里那批元件就会在点下成就的那一刻自己散掉。

   本版相对 CONFIGURA 的三处拆除：
     · 字形系统整体退场——单格组成部分只有正方形。一具图形的长相
       由格子排布独自承担，不再有一格之内还分方块 / 线条 / 叉号。
       这条是用户的明确决策：正方形之外的一切笔法都让「这件是什么」
       变回心算，而这一版要元件数据直接可读。
     · 特质效果整体移交 world/towers.js：parts 只管元件长什么样，
       塔打得怎么样归塔防表管。这里不再有效果字段。
     · 落件节律随 cadence 一并移除：元件由序号池抽取，不随时间滴落。

   型分两类（docs/DESIGN.md §2.4）：墙（bar / frame / gate）无攻击、
   挡在路径上；其余十五种是炮塔，各带一个二级属性偏好。
   偏好只有 15%——它让「拱」「塔」这些名字有战术意义，
   又不至于让某一型压倒六项读数成为唯一解。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  /* 资质五档：常 / 变 / 超 / 华 / 殿。
     cut 是「命中本档的上界」，u < cut 就落到这一档。
     style 是这一档的造型语言；cells 是格数区间；traits 是能带的特质条数上限。 */
  var RARITY = [
    { id: 0, t: '常', full: '常规', en: 'COMMON', cut: 0.5000, w: 1.00, cells: [1, 5], style: 'shard', traits: 1 },
    { id: 1, t: '变', full: '变异元件', en: 'MUTANT', cut: 0.7900, w: 1.15, cells: [4, 9], style: 'mod', traits: 1 },
    { id: 2, t: '超', full: '超级变异元件', en: 'HYPER', cut: 0.9350, w: 1.34, cells: [7, 13], style: 'mod2', traits: 2 },
    { id: 3, t: '华', full: '光华元件', en: 'GLORY', cut: 0.9870, w: 1.62, cells: [14, 26], style: 'glory', traits: 2 },
    { id: 4, t: '殿', full: '万净殿元件', en: 'MYRIAD', cut: 1.0001, w: 2.00, cells: [28, 64], style: 'myriad', traits: 3 }
  ];
  function rarityOf(u) {
    var i;
    for (i = 0; i < RARITY.length - 1; i++) if (u < RARITY[i].cut) return i;
    return RARITY.length - 1;
  }

  /* ---------- 特质表：十一种 ----------
     每种特质的战斗效果见 world/towers.js 的 TRAIT_FX——这里只留
     身份与一句人话。d 走 T()，是界面 live 文案。 */
  var TRAITS = [
    { id: 'volt', t: '闪电', en: 'VOLT', sym: '⚡', d: '连锁 +2：电天生走连锁。', den: 'Chain +2: lightning chains by nature.' },
    { id: 'sacra', t: '圣几何', en: 'SACRA', sym: '✵', d: '伤害 ×1.15：神圣几何的修正。', den: 'DMG ×1.15: the correction of sacred geometry.' },
    { id: 'oculus', t: '神视', en: 'OCULUS', sym: '◉', d: '射程 +1.5 格：被看着的东西躲不掉。', den: 'Range +1.5: what is watched cannot escape.' },
    { id: 'automa', t: '自组织', en: 'AUTOMA', sym: '❋', d: '攻速 ×1.20：它自己会开火。', den: 'Rate ×1.20: it fires on its own.' },
    { id: 'crysta', t: '晶簇', en: 'CRYSTA', sym: '❖', d: '散射 +1 弹，单发伤害 ×0.85。', den: 'Shots +1, single-shot damage ×0.85.' },
    { id: 'iris', t: '虹彩', en: 'IRIS', sym: '◈', d: '溅射 +1 格：颜色散开。', den: 'Splash +1: colours scatter.' },
    { id: 'vacua', t: '虚空', en: 'VACUA', sym: '◌', d: '减速 +0.15：虚空吸人。', den: 'Slow +0.15: the void pulls them in.' },
    { id: 'resona', t: '共鸣', en: 'RESONA', sym: '∿', d: '邻格塔伤害 +10%：共振传得到旁边。', den: 'Neighbours +10% damage: resonance carries across.' },
    { id: 'radix', t: '根须', en: 'RADIX', sym: '⑃', d: '命中挂 3 秒持续伤害。', den: 'Hits apply 3 seconds of damage over time.' },
    { id: 'specu', t: '镜渊', en: 'SPECU', sym: '⧉', d: '穿透 +2：镜面穿射。', den: 'Pierce +2: a mirror-piercing shot.' },
    { id: 'aether', t: '以太', en: 'AETHER', sym: '✧', d: '建造成本 ×0.85：轻，所以便宜。', den: 'Build cost ×0.85: light, therefore cheap.' }
  ];
  var TRAIT_BY = {};
  (function () { var i; for (i = 0; i < TRAITS.length; i++) TRAIT_BY[TRAITS[i].id] = TRAITS[i]; })();

  /* ---------- 型：十八种骨架 ----------
     kind: 'wall' 挡在路径上（无攻击）；'tower' 开火。
     sig: **战斗签名**——每种型一座塔的人格，由 tower.js 直接加成到属性上。
          有了它，「主料是十字」和「主料是盘」即使六项读数完全一致，
          进化出来的也是两种塔。型名因此成了战术语言。 */
  var FORMS = [
    { id: 'bar', t: '梁', en: 'BEAM', sym: '▬', d: '一条直杠，长而薄。', den: 'A single straight bar, long and thin.', kind: 'wall', sig: { range: 1.2, proj: 1 } },
    { id: 'frame', t: '框', en: 'FRAME', sym: '▭', d: '一个方框的轮廓，中间是空的。', den: 'The outline of a box, hollow inside.', kind: 'wall', sig: { proj: 1, rate: 0.15 } },
    { id: 'gate', t: '门', en: 'GATE', sym: '⌐', d: '两根柱子，顶上架一道横梁。', den: 'Two pillars carrying a beam.', kind: 'wall', sig: { hp: 60, melee: 2 } },
    { id: 'arch', t: '拱', en: 'ARCH', sym: '⌂', d: '两根柱子，顶上是一道拱。', den: 'Two pillars with an arch on top.', kind: 'tower', sig: { hp: 60 } },
    { id: 'cross', t: '十字', en: 'CROSS', sym: '✚', d: '从一个中心往四边伸出等长的臂。', den: 'Equal arms reaching out from one centre.', kind: 'tower', sig: { proj: 1 } },
    { id: 'xs', t: '叉', en: 'SALTIRE', sym: '✕', d: '两条对角线从中心穿出去。', den: 'Two diagonals crossing through the centre.', kind: 'tower', sig: { proj: 1, chain: 1 } },
    { id: 'tri', t: '三角', en: 'TRIANGLE', sym: '△', d: '一个三角形，小的是实心的，大的是空心轮廓。', den: 'A triangle: small ones solid, large ones hollow.', kind: 'tower', sig: { dmgMul: 1.10 } },
    { id: 'dia', t: '菱', en: 'DIAMOND', sym: '◇', d: '一个菱形，小的是实心的，大的是空心轮廓。', den: 'A diamond: small ones solid, large ones hollow.', kind: 'tower', sig: { rateMul: 1.10, splash: 1 } },
    { id: 'stair', t: '阶', en: 'STAIR', sym: '◢', d: '一级一级往上叠。', den: 'Stacked step by step.', kind: 'tower', sig: { range: 1.2 } },
    { id: 'bolt', t: '雷', en: 'BOLT', sym: '⚡', d: '折来折去的一条长链。', den: 'A long chain that folds back and forth.', kind: 'tower', sig: { chain: 2 } },
    { id: 'shard', t: '裂', en: 'SHARD', sym: '⁘', d: '碎下来的一片，边上全是缺口。', den: 'A broken-off shard, all notches on the edge.', kind: 'tower', sig: { dmgMul: 1.10, pierce: 1 } },
    { id: 'ladder', t: '梯', en: 'LADDER', sym: '⋈', d: '两根竖档，中间横着几道踏。', den: 'Two rails with rungs between them.', kind: 'tower', sig: { rateMul: 1.10, proj: 1 } },
    { id: 'comb', t: '梳', en: 'COMB', sym: '⋔', d: '一根脊，上面排着齿。', den: 'A spine with teeth along it.', kind: 'tower', sig: { proj: 1, rate: 0.10 } },
    { id: 'hex', t: '巢', en: 'HONEYCOMB', sym: '⬡', d: '六边形的一小块蜂窝。', den: 'A piece of hexagonal honeycomb.', kind: 'tower', sig: { hp: 60, auraDmg: 0.05 } },
    { id: 'chev', t: '折', en: 'CHEVRON', sym: '›', d: '一道一道的折线，层层套着。', den: 'Chevrons nested one inside another.', kind: 'tower', sig: { dmgMul: 1.10, chain: 1 } },
    { id: 'rune', t: '符', en: 'RUNE', sym: '⌘', d: '一道竖笔，横着挑出几道，顶端悬着一枚环。', den: 'A vertical stroke with crossbars and a ring hanging on top.', kind: 'tower', sig: { slow: 0.12, dot: 2 } },
    { id: 'tower', t: '塔', en: 'TOWER', sym: '⌸', d: '一层一层往上叠，越往上越窄。', den: 'Layers stacked upward, narrowing as they rise.', kind: 'tower', sig: { range: 1.2, rate: 0.10 } },
    { id: 'coil', t: '盘', en: 'COIL', sym: '↻', d: '一格宽的方螺旋，从外往里绕。', den: 'A one-cell square spiral winding inward.', kind: 'tower', sig: { rateMul: 1.10, chain: 1 } }
  ];
  var FORM_BY = {};
  (function () { var i; for (i = 0; i < FORMS.length; i++) FORM_BY[FORMS[i].id] = FORMS[i]; })();
  function formOf(id) { return FORM_BY[id] || null; }
  /* 每档造型语言用哪几种型。写在这里，一眼看得见「这一档长什么样」。 */
  var STYLE_FORMS = {
    shard: ['shard', 'bar', 'stair', 'tri', 'comb'],
    mod: ['cross', 'frame', 'dia', 'hex', 'bar', 'chev', 'stair', 'xs', 'ladder', 'tower'],
    mod2: ['ladder', 'arch', 'frame', 'xs', 'hex', 'dia', 'cross', 'comb', 'coil'],
    glory: ['bolt', 'shard', 'rune', 'chev', 'xs', 'comb', 'ladder', 'frame', 'tower'],
    myriad: ['frame', 'arch', 'tri', 'cross', 'xs', 'gate', 'bar', 'dia', 'coil']
  };

  /* ---------- 骨架生成器 ----------
     t 是目标格数，R 是 [0,1) 的稳定随机流。生成出来的格不归一化。 */
  function put1(set, cells, x, y) {
    var k = x + ',' + y;
    if (set[k]) return false;
    set[k] = 1; cells.push([x, y]); return true;
  }
  function has1(set, x, y) { return !!set[x + ',' + y]; }

  function fShard(t, R) {
    var set = {}, cells = [], D = [[1, 0], [-1, 0], [0, 1], [0, -1]], guard = 0, z, q, x, y, nb, w, tot, rr, pick;
    put1(set, cells, 0, 0);
    while (cells.length < t && guard++ < 600) {
      var cand = [];
      for (z = 0; z < cells.length; z++) {
        for (q = 0; q < 4; q++) {
          x = cells[z][0] + D[q][0]; y = cells[z][1] + D[q][1];
          if (has1(set, x, y)) continue;
          nb = 0;
          for (w = 0; w < 4; w++) if (has1(set, x + D[w][0], y + D[w][1])) nb++;
          cand.push([x, y, nb === 1 ? 1 + 2.2 : (nb >= 3 ? 0.35 : 1)]);
        }
      }
      if (!cand.length) break;
      tot = 0;
      for (z = 0; z < cand.length; z++) tot += cand[z][2];
      rr = R() * tot; pick = cand[cand.length - 1];
      for (z = 0; z < cand.length; z++) { rr -= cand[z][2]; if (rr <= 0) { pick = cand[z]; break; } }
      put1(set, cells, pick[0], pick[1]);
    }
    return cells;
  }
  function fBar(t, R) {
    var horiz = R() < 0.5, th = t >= 34 ? 2 : 1;
    var len = Math.max(2, Math.round(t / th)), set = {}, cells = [], i, k;
    for (i = 0; i < len; i++) for (k = 0; k < th; k++) put1(set, cells, horiz ? i : k, horiz ? k : i);
    return cells;
  }
  function fFrame(t, R) {
    var s = Math.max(3, Math.round((t + 4) / 4));
    var w = s + (R() < 0.35 ? 1 : 0), h = s;
    while (w > 3 && 2 * w + 2 * h - 4 > t) w--;
    while (h > 3 && 2 * w + 2 * h - 4 > t) h--;
    var set = {}, cells = [], x, y;
    for (x = 0; x < w; x++) { put1(set, cells, x, 0); put1(set, cells, x, h - 1); }
    for (y = 1; y < h - 1; y++) { put1(set, cells, 0, y); put1(set, cells, w - 1, y); }
    return cells;
  }
  function fCross(t, R) {
    var thick = t >= 18 && R() < 0.5;
    var per = thick ? 12 : 4;
    var a = Math.max(1, Math.round((t - 1) / per)), set = {}, cells = [], k;
    put1(set, cells, 0, 0);
    for (k = 1; k <= a; k++) {
      put1(set, cells, k, 0); put1(set, cells, -k, 0); put1(set, cells, 0, k); put1(set, cells, 0, -k);
      if (thick) {
        put1(set, cells, k, 1); put1(set, cells, k, -1); put1(set, cells, -k, 1); put1(set, cells, -k, -1);
        put1(set, cells, 1, k); put1(set, cells, -1, k); put1(set, cells, 1, -k); put1(set, cells, -1, -k);
      }
    }
    return cells;
  }
  /* 叉：四条斜臂。斜臂必须走阶梯——直接取 (k,k) 那串格彼此只对角相邻，
     看着是一条斜线，其实是断成一串孤格。 */
  function fXs(t, R) {
    var a = Math.max(1, Math.round((t - 1) / 8)), set = {}, cells = [], k, d;
    var DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    put1(set, cells, 0, 0);
    for (d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      for (k = 1; k <= a; k++) {
        put1(set, cells, dx * k, dy * k);
        put1(set, cells, dx * k, dy * (k - 1));
      }
    }
    return cells;
  }
  function fTri(t, R) {
    var set = {}, cells = [], h, y, x;
    if (t >= 14) {                     /* 大的：只留轮廓，极简 */
      h = Math.max(3, Math.round((t + 5) / 6));
      for (y = 0; y < h - 1; y++) {
        put1(set, cells, -y, -y); put1(set, cells, -(y + 1), -y);
        put1(set, cells, y, -y); put1(set, cells, y + 1, -y);
      }
      for (x = -(h - 1); x <= h - 1; x++) put1(set, cells, x, -(h - 1));
      put1(set, cells, 0, 0);
      return cells;
    }
    h = Math.max(2, Math.round((Math.sqrt(8 * t + 1) - 1) / 2));
    for (y = 0; y < h; y++) for (x = 0; x <= y; x++) put1(set, cells, x, -y);
    return cells;
  }
  function fDia(t, R) {
    var set = {}, cells = [], r = 1, x, y;
    var outline = t >= 18;
    if (outline) {
      /* 空心的菱只留一圈的话，那一圈全是斜着相邻的孤格——必断。
         所以留两圈厚：既还是一道轮廓，又是一条连着的通路。 */
      r = Math.max(2, Math.round((t + 4) / 8));
    } else {
      while (r <= 40 && 2 * r * r + 2 * r + 1 <= t) r++;
      r = Math.max(1, r - 1);
    }
    for (y = -r; y <= r; y++) for (x = -r; x <= r; x++) {
      var d = Math.abs(x) + Math.abs(y);
      if (outline ? (d === r || d === r - 1) : d <= r) put1(set, cells, x, y);
    }
    return cells;
  }
  function fStair(t, R) {
    var n = Math.max(1, Math.round(t / 2)), set = {}, cells = [], k;
    for (k = 0; k < n; k++) { put1(set, cells, k, k); put1(set, cells, k + 1, k); }
    return cells;
  }
  function fBolt(t, R) {
    var set = {}, cells = [], x = 0, y = 0, k;
    put1(set, cells, 0, 0);
    for (k = 1; k < t; k++) {
      if (R() < 0.42) x += (R() < 0.5 ? 1 : -1);
      else y += 1;
      if (!put1(set, cells, x, y)) { y += 1; if (!put1(set, cells, x, y)) break; }
    }
    return cells;
  }
  /* 梯：两根竖档，中间横着几道踏。竖档与踏都是正交相邻，
     所以整件天然是一整块——这正是「内部完整联通」要的样子。 */
  function fLadder(t, R) {
    var h = Math.max(3, Math.round(t / 2.6)), set = {}, cells = [], y, x;
    var w = Math.max(2, Math.min(5, Math.round(t / 7) + 1));
    for (y = 0; y < h; y++) { put1(set, cells, 0, y); put1(set, cells, w - 1, y); }
    for (y = 1; y < h - 1; y += 2) for (x = 0; x < w; x++) put1(set, cells, x, y);
    return cells;
  }
  /* 拱：两根柱子，顶上用阶梯把两边接起来。
     阶梯而不是斜线——斜着走的那串格只有对角相邻，等于断的。 */
  function fArch(t, R) {
    var h = Math.max(3, Math.round(t / 3.2)), w = Math.max(3, Math.round(t / 2.2)), set = {}, cells = [], y, x;
    for (y = 0; y < h; y++) { put1(set, cells, 0, y); put1(set, cells, w - 1, y); }
    var mid = Math.floor(w / 2), lift = 0;
    for (x = 0; x <= mid; x++) {
      lift = Math.round(h + x * (h * 0.5 / Math.max(1, mid)));
      put1(set, cells, x, lift);
      if (x > 1 && x < w - 2) put1(set, cells, x, lift - 1);
      put1(set, cells, w - 1 - x, lift);
      if (x > 1 && x < w - 2) put1(set, cells, w - 1 - x, lift - 1);
    }
    for (y = h; y <= lift; y++) { put1(set, cells, 0, y); put1(set, cells, w - 1, y); }
    return cells;
  }
  function fGate(t, R) {
    var h = Math.max(3, Math.round(t / 3)), w = Math.max(3, t - 2 * h + 2);
    var set = {}, cells = [], y, x;
    for (y = 0; y < h; y++) { put1(set, cells, 0, y); put1(set, cells, w - 1, y); }
    for (x = 0; x < w; x++) put1(set, cells, x, 0);
    return cells;
  }
  function fComb(t, R) {
    var L = Math.max(2, Math.round(t * 0.62)), set = {}, cells = [], i, down = R() < 0.5;
    for (i = 0; i < L; i++) put1(set, cells, i, 0);
    for (i = 0; i < L; i += 2) put1(set, cells, i, down ? -1 : 1);
    return cells;
  }
  function fHex(t, R) {
    var r = 1, set = {}, cells = [], x, y;
    while (r <= 30 && 3 * r * r + 3 * r + 1 <= t) r++;
    r = Math.max(1, r - 1);
    /* 一行一行往上叠，叠到 t 格就停——所以蜂窝有大有小，
       不会像从前那样「半径定了格数也就定了」。 */
    for (y = -r; y <= r && cells.length < t; y++) {
      var wdt = 2 * r + 1 - Math.abs(y);
      for (x = 0; x < wdt && cells.length < t; x++) put1(set, cells, x - Math.floor(wdt / 2), y);
    }
    return cells;
  }
  function fChev(t, R) {
    var rows = Math.max(2, Math.round(Math.sqrt(t))), set = {}, cells = [], y, x, half;
    for (y = 0; y < rows; y++) {
      half = Math.max(1, Math.round((t / rows) / 2));
      for (x = 0; x < half; x++) { put1(set, cells, -x, y); put1(set, cells, x + 1, y); }
    }
    return cells;
  }
  function fRune(t, R) {
    var h = Math.max(4, Math.round(t * 0.6)), set = {}, cells = [], y, bars = Math.max(1, Math.round(h / 4)), b, w2;
    for (y = 0; y < h; y++) put1(set, cells, 0, -y);
    for (b = 1; b <= bars; b++) {
      w2 = 1 + Math.floor(R() * 2);
      for (y = 0; y < w2; y++) put1(set, cells, y + 1, -Math.round(b * h / (bars + 1)));
    }
    /* 顶端一枚小环 */
    put1(set, cells, 0, 1); put1(set, cells, 1, 1); put1(set, cells, 1, 2); put1(set, cells, 0, 2);
    return cells;
  }
  /* 塔：一层一层往上叠，每一层都比下面窄，两层高的台阶才收一格。
     关键是上下两层在 x 上必有重叠——所以整座塔是一整块，不是一摞浮着的小块。 */
  function fTower(t, R) {
    var h = Math.max(3, Math.round(Math.sqrt(t * 1.2))), set = {}, cells = [], y, x, L;
    var w0 = 2 * Math.ceil(h / 2) - 1;
    if (w0 < 3) w0 = 3;
    for (y = 0; y < h; y++) {
      L = Math.floor(y / 2);
      for (x = L; x <= w0 - 1 - L; x++) put1(set, cells, x, -y);
    }
    return cells;
  }
  /* 盘：一格宽的方螺旋，从外往里绕。每一格都紧挨着上一格的正交方向，
     所以它不是「一圈圈套着的环」，而是**一条**绕起来的通路——不可能断。 */
  function fCoil(t, R) {
    var set = {}, cells = [], x = 0, y = 0, d = 0, seg = 0, len = 1, i;
    var D = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    put1(set, cells, 0, 0);
    while (cells.length < t && seg < 4000) {
      for (i = 0; i < len && cells.length < t; i++) {
        x += D[d][0]; y += D[d][1];
        put1(set, cells, x, y);
      }
      d = (d + 1) % 4;
      seg++;
      if (seg % 2 === 0) len++;
    }
    return cells;
  }
  var GEN = {
    bar: fBar, frame: fFrame, arch: fArch, cross: fCross, xs: fXs, tri: fTri, dia: fDia,
    stair: fStair, bolt: fBolt, shard: fShard, ladder: fLadder, gate: fGate, comb: fComb,
    hex: fHex, chev: fChev, rune: fRune, tower: fTower, coil: fCoil
  };

  /* ---------- 连通兜底 ----------
     一件元件里凡是「看着是一个整体」的那一部分，内部必须真的连在一起。
     斜着走的那串格只有对角相邻，等于断的——所以这里最后统一补一次：
     只要还剩不止一块，就找最近的两块，用一条正交的折线把它们接起来。
     这是一道兜底的闸，不是替代品：型本身该长成连着的，它才长成连着的。 */
  function compsOf(cells) {
    var set = {}, i, z, out = [], seen = {};
    for (i = 0; i < cells.length; i++) set[cells[i][0] + ',' + cells[i][1]] = cells[i];
    var D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (i = 0; i < cells.length; i++) {
      var k0 = cells[i][0] + ',' + cells[i][1];
      if (seen[k0]) continue;
      var comp = [], stack = [cells[i]];
      seen[k0] = 1;
      while (stack.length) {
        var u = stack.pop();
        comp.push(u);
        for (z = 0; z < 4; z++) {
          var nk = (u[0] + D[z][0]) + ',' + (u[1] + D[z][1]);
          if (set[nk] && !seen[nk]) { seen[nk] = 1; stack.push(set[nk]); }
        }
      }
      out.push(comp);
    }
    return out;
  }
  function bridge(cells) {
    var set = {}, i, z, w;
    for (i = 0; i < cells.length; i++) set[cells[i][0] + ',' + cells[i][1]] = 1;
    function add(x, y) {
      var k = x + ',' + y;
      if (set[k]) return;
      set[k] = 1;
      cells.push([x, y]);
    }
    var comps = compsOf(cells), guard = 0;
    while (comps.length > 1 && guard++ < 80) {
      comps.sort(function (a, b) { return a.length - b.length; });
      var small = comps[0], best = null;
      for (i = 1; i < comps.length; i++) {
        for (z = 0; z < small.length; z++) {
          for (w = 0; w < comps[i].length; w++) {
            var d = Math.abs(small[z][0] - comps[i][w][0]) + Math.abs(small[z][1] - comps[i][w][1]);
            if (!best || d < best.d) best = { d: d, a: small[z], b: comps[i][w] };
          }
        }
      }
      if (!best) break;
      var x = best.a[0], y = best.a[1];
      while (x !== best.b[0]) { x += (best.b[0] > x ? 1 : -1); add(x, y); }
      while (y !== best.b[1]) { y += (best.b[1] > y ? 1 : -1); add(x, y); }
      comps = compsOf(cells);
    }
    return cells;
  }

  /* ---------- 归一化与旋转 ---------- */
  function norm(cells) {
    var mnx = Infinity, mny = Infinity, t, out = [];
    for (t = 0; t < cells.length; t++) {
      if (cells[t][0] < mnx) mnx = cells[t][0];
      if (cells[t][1] < mny) mny = cells[t][1];
    }
    for (t = 0; t < cells.length; t++) out.push([cells[t][0] - mnx, cells[t][1] - mny]);
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return out;
  }
  function rotCells(cs, r) {
    r = ((r | 0) % 4 + 4) % 4;
    if (!r) return norm(cs);
    var out = [], i, x, y;
    for (i = 0; i < cs.length; i++) {
      x = cs[i][0]; y = cs[i][1];
      if (r === 1) out.push([-y, x]);
      else if (r === 2) out.push([-x, -y]);
      else out.push([y, -x]);
    }
    return norm(out);
  }
  /* 格与字形一起转：先算出每个格转后的位置，再按同一套顺序归一化。 */
  function rotPair(cells, glyphs, r) {
    r = ((r | 0) % 4 + 4) % 4;
    var out = [], i, x, y;
    for (i = 0; i < cells.length; i++) {
      x = cells[i][0]; y = cells[i][1];
      var g = rotGlyph(glyphs ? glyphs[i] : 'sq', r);
      if (r === 1) out.push([-y, x, g]);
      else if (r === 2) out.push([-x, -y, g]);
      else if (r === 3) out.push([y, -x, g]);
      else out.push([x, y, g]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var mnx = Infinity, mny = Infinity;
    for (i = 0; i < out.length; i++) {
      if (out[i][0] < mnx) mnx = out[i][0];
      if (out[i][1] < mny) mny = out[i][1];
    }
    return {
      cells: out.map(function (a) { return [a[0] - mnx, a[1] - mny]; }),
      glyphs: out.map(function (a) { return a[2]; })
    };
  }
  function size(cs) {
    var w = 0, h = 0, i;
    for (i = 0; i < cs.length; i++) {
      if (cs[i][0] + 1 > w) w = cs[i][0] + 1;
      if (cs[i][1] + 1 > h) h = cs[i][1] + 1;
    }
    return { w: w, h: h };
  }

  /* ---------- 序号池 ----------
     成就解锁往里加序号（BS.metaDefs.mods().poolBoost），
     所以「库里出现新元件」的机制就是池子变大，不改任何生成规则。 */
  function pool() {
    var base = 512;
    var boost = (BS.metaDefs && BS.metaDefs.mods && BS.bus) ? (BS.metaDefs.mods(BS.bus.state.meta).poolBoost || 0) : 0;
    return base + boost;
  }

  /* ---------- 一件元件的全部：只由序号决定 ---------- */
  function shapeOf(i) {
    var seed = i * 7919 + 13;
    var uBase = U.at(i * 104729 + 1, 0);
    /* 稀有度只由序号定：解锁一概不碰它。
       长相跟着稀有度走，所以「解锁之后库里的件自己变了形」这种事不会发生。 */
    var rar = rarityOf(uBase);
    var sp = RARITY[rar];
    var k = 0;
    function R() { return U.at(seed, 500 + (k++)); }
    var target = sp.cells[0] + Math.floor(U.at(seed, 1) * (sp.cells[1] - sp.cells[0] + 1));
    var pool2 = STYLE_FORMS[sp.style] || STYLE_FORMS.shard;
    var form = pool2[Math.floor(U.at(seed, 2) * pool2.length) % pool2.length];
    var gen = GEN[form] || fShard;
    var raw = bridge(gen(target, R) || [[0, 0]]);
    if (!raw.length) raw = [[0, 0]];
    return { cells: norm(raw), rar: rar, traits: traitsOf(i, rar), form: form, style: sp.style };
  }

  /* ---------- 特质分配：只由序号与稀有度决定 ----------
     成就的特质加权（M2 圣几何 / M4 闪电）在这里读——
     它只抬「空掷救回来」的概率，不改变序号与形状的对应。 */
  function traitsOf(i, rar) {
    var cap = RARITY[Math.max(0, Math.min(4, rar | 0))].traits;
    var u0 = U.at(i * 6151 + 11, 21);
    var base = u0 < 0.30 ? 0 : (u0 < 0.68 ? 1 : (u0 < 0.88 ? 2 : 3));
    var nT = Math.min(cap, base);
    /* 常档再压一压：让「什么都不带的常件」是常态，碰上特质才值得高兴 */
    if ((rar | 0) === 0 && U.at(i * 3571 + 5, 22) < 0.45) nT = Math.min(nT, 0);
    /* 特质加权：本来一条都不带的，按概率补一条 */
    var luck = (BS.metaDefs && BS.metaDefs.mods && BS.bus) ? BS.metaDefs.mods(BS.bus.state.meta).traitLuck : {};
    if (nT < cap) {
      for (var tid in luck) {
        if (U.at(i * 4211 + 17, 23) < luck[tid]) { nT = Math.min(cap, nT + 1); break; }
      }
    }
    if (!nT) return [];
    var pool3 = [], z;
    for (z = 0; z < TRAITS.length; z++) pool3.push(z);
    var out = [], j;
    for (j = 0; j < nT && pool3.length; j++) {
      var rr = U.at(i * 7727 + 31, 40 + j);
      var idx = Math.floor(rr * pool3.length) % pool3.length;
      out.push(TRAITS[pool3[idx]].id);
      pool3.splice(idx, 1);
    }
    return out;
  }
  function traitOf(id) { return TRAIT_BY[id] || null; }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  /* 名 = 型 · 格数。念一遍名字，就知道手里这件是个什么东西、有多大。 */
  function nameOf(i) {
    var s = shapeOf(i);
    return BS.i18n.term(FORM_BY[s.form]) + '·' + BS.i18n.fill('#格', s.cells.length);
  }
  function serialOf(i) { return '#' + pad(i, 4); }

  BS.parts = {
    RARITY: RARITY, TRAITS: TRAITS, TRAIT_BY: TRAIT_BY,
    FORMS: FORMS, FORM_BY: FORM_BY, STYLE_FORMS: STYLE_FORMS, formOf: formOf,
    rarityOf: rarityOf, nameOf: nameOf, serialOf: serialOf, shapeOf: shapeOf, traitsOf: traitsOf,
    traitOf: traitOf, pool: pool,
    rotCells: rotCells, size: size, norm: norm
  };
})(window.BS);
