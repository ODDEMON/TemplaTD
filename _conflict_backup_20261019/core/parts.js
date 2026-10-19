<<<<<<< HEAD
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
=======
/* core/parts.js —— 元件：形状、字形、特质。
   ------------------------------------------------------------------
   同一序号永远是同一形状、同一批特质——这条铁律不动，而且比从前更硬：
   资质只由序号决定，脉络与命题一律不改它。原因很实在——
   形状决定长相，长相决定这一件美不美；若脉络能把已落下的件改形，
   板上那具图形就会在你点下节点的那一刻自己散掉。

   造型分五档语言，一档一套审美：
     常·碎块   极简的小块，说不上是什么形状——这是常态
     变·现代   小、强对称、现代感：十字、丁字、阶梯、短梁
     超·现代   更小更强的对称：斜带、缺口块、工字、十字、蜂窝
     华·赛博   极致的赛博朋克与神秘：落雷、裂片、符文、折线、连线回路
     殿·极简   巨型的、惊人的极简：巨框、巨拱、巨三角、巨门、长梁

   一件元件不再是一堆实心方块，而是一组**单格组成部分**（字形）。
   字形只有两类，但两类都不会散：四条边都贴得住的实心字形
   （方块、十字、丁字、L 折、缺口块、斜带、工字、凹口），
   以及按邻居出笔的连线（粗线 / 细线）。详见下面字形表上的那段话。
   字形由这一件的造型语言定，跟着元件一起旋转。 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  /* 资质五档：常 / 变 / 超 / 华 / 殿。
     cut 是「命中本档的上界」，u < cut 就落到这一档。
<<<<<<< HEAD
     style 是这一档的造型语言；cells 是格数区间；traits 是能带的特质条数上限。 */
=======
     style 是这一档的造型语言；cells 是格数区间；traits 是能带的特质条数上限。
     t 是单字缩写，full 是全称：凡是把档名摆出来给人看的地方都用 full。 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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

<<<<<<< HEAD
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
=======
  /* ---------- 特质表：十一种，各有各的用处 ----------
     每种特质写明它到底做什么，不给模糊的「加成」二字。
     effect 是它在 sim 里被读取的那一个键，数值写死在这里，方便调平衡。 */
  var TRAITS = [
    { id: 'volt', t: '闪电', en: 'VOLT', sym: '⚡',
      d: '装上时若与已有图形接出一条通路，这一具的估价再多一分。',
      effect: { conduct: 0.6 } },
    { id: 'sacra', t: '圣几何', en: 'SACRA', sym: '✵',
      d: '自带对称骨架：对称这一项的读数提升。',
      effect: { sym: 0.14 } },
    { id: 'oculus', t: '神视', en: 'OCULUS', sym: '◉',
      d: '被注视着的东西藏不住：六项质变指标的读数全部小幅提升。',
      effect: { allEssence: 0.06 } },
    { id: 'automa', t: '自组织', en: 'AUTOMA', sym: '❋',
      d: '它会自己找到位置：开着自动装配时，优先装这一件。',
      effect: { auto: 1 } },
    { id: 'crysta', t: '晶簇', en: 'CRYSTA', sym: '❖',
      d: '反复出现的结构：重复这一项的读数提升。',
      effect: { repeat: 0.16 } },
    { id: 'iris', t: '虹彩', en: 'IRIS', sym: '◈',
      d: '折射出多余的颜色：成交时按格数额外加一点价。',
      effect: { luxPerCell: 0.12 } },
    { id: 'vacua', t: '虚空', en: 'VACUA', sym: '◌',
      d: '它自己就带着空：通透这一项的读数提升。',
      effect: { void: 0.16 } },
    { id: 'resona', t: '共鸣', en: 'RESONA', sym: '∿',
      d: '与相邻元件带有相同特质时，那几件一起把估价抬上去。',
      effect: { resonate: 0.5 } },
    { id: 'radix', t: '根须', en: 'RADIX', sym: '⑃',
      d: '扎得深：装上时降低掉落间隔，来料来得更快。',
      effect: { haste: 0.10 } },
    { id: 'specu', t: '镜渊', en: 'SPECU', sym: '⧉',
      d: '水面似的：对称这一项的读数提升。',
      effect: { sym: 0.16 } },
    { id: 'aether', t: '以太', en: 'AETHER', sym: '✧',
      d: '轻得不像话：不占重量，让质心更靠近几何中心。',
      effect: { weightless: 1 } }
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  ];
  var TRAIT_BY = {};
  (function () { var i; for (i = 0; i < TRAITS.length; i++) TRAIT_BY[TRAITS[i].id] = TRAITS[i]; })();

<<<<<<< HEAD
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
=======
  /* ---------- 单格组成部分：字形表 ----------
     一件元件画出来好不好看，全看这一层。字形是画在一个单位格里的矢量：
     有的是整格填满的多边形，有的是一条按邻居出笔的连线。
     所有字形的几何只写一次（rot 个朝向里只写第 0 个），
     其余朝向由代码把点绕格心转 90° 生成——手写三遍必定写歪，还会转不出来。

     k='poly' 填充多边形；k='line' 描边连线（粗）；k='net' 描边连线（细）。
     后两种都不看 pts 里的点，由渲染器按邻居出笔——见 core/render.js。 */
  /* 每格画什么。这里是「字形」的唯一来源：一条 base 只写 0 号朝向，
     其余朝向由 rot90 派生（rot 写 90° 独立的朝向数）。

     一条硬规矩，写死在这里：**实心字形必须四条边都贴得住**。
     格与格是贴边相连的——一件元件看着是不是一整块，全看相邻两格里
     画的东西在它们公用的那条边上有没有一段实实在在的接触。
     只在角上点一下、或者缩在格心里，排出来就是「一串珠子」，所以整条删掉：
       · 小圆点、四角星、圆——一个点都不碰格边
       · 正三角形、梯形、平行四边形、直角三角形——尖角收在格心附近，
         只有角对角的接触
       · 半格、粗带、斜线、角弧——只贴两条边（甚至只贴一点）
       · 菱、五边、六边、八边形——内接多边形，顶点碰边是「点」不是「段」
     留下的每一条都同时贴着上下左右四条边，所以不论怎么转、跟谁相邻，
     两格之间都有一段接得上。连线（ln 粗 / net 细）是另一路：
     它们不看 pts，由渲染器**按邻居出笔**，有线就画到邻格的边中点，
     所以天生就连着。 */
  /* 字形只剩三种：**正方形 / 线条 / 叉号**（线条分粗细两档，是同一件事的两种笔宽）。
     从前那一张表（十字、丁字、L 折、缺口块、斜带、工字、凹口）全部退场——
     它们单看都成立，排成一片之后没人分得清哪条边是哪一件画的，
     而这一版要的是「看一眼就知道这一格是什么」。
     三种各自的角色：
       sq   实心方块：铺面，负责「这里有一块料」
       ln   粗线：按邻居出笔，负责把一件连成一张网
       net  细线：同上，笔更细，高档件用
       x    叉号：两道对角笔画，读作「这一格被划掉了 / 编进去了」，
            与方块和线条一眼分得开。相邻两格的斜笔在共用角上接得上，
            所以一串叉号看着是一条连续的折线，而不是一串浮着的珠子。
     这四种的 rot 都是 1——转 90° 之后长相不变，所以字形不再跟着元件
     转出「同一件换个朝向就不认识了」这种事。 */
  var GBASE = [
    { id: 'sq', k: 'poly', rot: 1, pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { id: 'ln', k: 'line', rot: 1, pts: [] },
    { id: 'net', k: 'net', rot: 1, pts: [] },
    { id: 'x', k: 'x', rot: 1, pts: [] }
  ];
  /* 点绕格心顺时针转 90°：(x,y) -> (1-y, x)。y 朝下，所以这是屏幕上的顺时针。 */
  function rot90(pts) {
    var out = [], i;
    for (i = 0; i < pts.length; i++) out.push([1 - pts[i][1], pts[i][0]]);
    return out;
  }
  var GLYPHS = [], GLYPH_BY = {}, ROTOF = {}, ROTN = {};
  (function () {
    var i, v, g, pts, base;
    for (i = 0; i < GBASE.length; i++) {
      base = GBASE[i];
      pts = base.pts;
      ROTN[base.id] = base.rot;
      for (v = 0; v < base.rot; v++) {
        g = { id: base.rot > 1 ? base.id + v : base.id, base: base.id, k: base.k, pts: pts };
        GLYPHS.push(g);
        GLYPH_BY[g.id] = g;
        ROTOF[g.id] = base.rot > 1 ? base.id + ((v + 1) % base.rot) : g.id;
        pts = rot90(pts);
      }
    }
  })();
  function glyph(id) { return GLYPH_BY[id] || GLYPH_BY.sq; }
  /* 取一个字族的第 v 个朝向。朝向数按字族自己有几档取模——
     方块、十字、连线只有一档，拿 4 去取模就会取到一个不存在的 id。 */
  function variant(base, v) {
    var n = ROTN[base] || 1;
    if (n <= 1) return base;
    return base + (((v % n) + n) % n);
  }
  /* 字形跟着元件一起转：转 r 个 90°，就顺着 ROTOF 走 r 步。 */
  function rotGlyph(id, r) {
    r = ((r | 0) % 4 + 4) % 4;
    var i;
    for (i = 0; i < r; i++) id = ROTOF[id] || id;
    return id;
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  }
  function has1(set, x, y) { return !!set[x + ',' + y]; }

<<<<<<< HEAD
=======
  /* ---------- 型：十八种骨架 ----------
     型是这一件的「骨架种类」——梁、框、拱、十字、叉、三角、菱、阶、
     雷、裂、梯、门、梳、巢、折、符、塔、盘。型由序号与造型语言共同决定，
     所以同一序号永远同一型。型只改格子的排布，不碰任何读数。
     每一条生成器都必须交出**一整块**：看着是一个整体的部分，
     内部就得格格正交相连（斜着相邻等于断的，桥接兜底只是保险）。 */
  var FORMS = [
    { id: 'bar', t: '梁', en: 'BEAM', sym: '▬', d: '一条直杠，长而薄。' },
    { id: 'frame', t: '框', en: 'FRAME', sym: '▭', d: '一个方框的轮廓，中间是空的。' },
    { id: 'arch', t: '拱', en: 'ARCH', sym: '⌂', d: '两根柱子，顶上是一道拱。' },
    { id: 'cross', t: '十字', en: 'CROSS', sym: '✚', d: '从一个中心往四边伸出等长的臂。' },
    { id: 'xs', t: '叉', en: 'SALTIRE', sym: '✕', d: '两条对角线从中心穿出去。' },
    { id: 'tri', t: '三角', en: 'TRIANGLE', sym: '△', d: '一个三角形，小的是实心的，大的是空心轮廓。' },
    { id: 'dia', t: '菱', en: 'DIAMOND', sym: '◇', d: '一个菱形，小的是实心的，大的是空心轮廓。' },
    { id: 'stair', t: '阶', en: 'STAIR', sym: '◢', d: '一级一级往上叠。' },
    { id: 'bolt', t: '雷', en: 'BOLT', sym: '⚡', d: '折来折去的一条长链。' },
    { id: 'shard', t: '裂', en: 'SHARD', sym: '⁘', d: '碎下来的一片，边上全是缺口。' },
    { id: 'ladder', t: '梯', en: 'LADDER', sym: '⋈', d: '两根竖档，中间横着几道踏。' },
    { id: 'gate', t: '门', en: 'GATE', sym: '⌐', d: '两根柱子，顶上架一道横梁。' },
    { id: 'comb', t: '梳', en: 'COMB', sym: '⋔', d: '一根脊，上面排着齿。' },
    { id: 'hex', t: '巢', en: 'HONEYCOMB', sym: '⬡', d: '六边形的一小块蜂窝。' },
    { id: 'chev', t: '折', en: 'CHEVRON', sym: '›', d: '一道一道的折线，层层套着。' },
    { id: 'rune', t: '符', en: 'RUNE', sym: '⌘', d: '一道竖笔，横着挑出几道，顶端悬着一枚环。' },
    { id: 'tower', t: '塔', en: 'TOWER', sym: '⌸', d: '一层一层往上叠，越往上越窄。' },
    { id: 'coil', t: '盘', en: 'COIL', sym: '↻', d: '一格宽的方螺旋，从外往里绕。' }
  ];
  var FORM_BY = {};
  (function () { var i; for (i = 0; i < FORMS.length; i++) FORM_BY[FORMS[i].id] = FORMS[i]; })();
  /* 每档造型语言用哪几种型。写在这里，一眼看得见「这一档长什么样」。 */
  var STYLE_FORMS = {
    shard: ['shard', 'bar', 'stair', 'tri', 'comb'],
    mod: ['cross', 'frame', 'dia', 'hex', 'bar', 'chev', 'stair', 'xs', 'ladder', 'tower'],
    mod2: ['ladder', 'arch', 'frame', 'xs', 'hex', 'dia', 'cross', 'comb', 'coil'],
    glory: ['bolt', 'shard', 'rune', 'chev', 'xs', 'comb', 'ladder', 'frame', 'tower'],
    myriad: ['frame', 'arch', 'tri', 'cross', 'xs', 'gate', 'bar', 'dia', 'coil']
  };
  /* 每档的字形候选。用哪几种，就是这一档的「笔法」。
     表里只允许出现两类东西：四条边都贴得住的实心字形，
     以及按邻居出笔的连线（ln 粗 / net 细）。
     别的形状一律不进表——只要有一条只贴边角，整档就会看着散。 */
  var STYLE_PAL = {
    shard: ['sq', 'sq', 'sq', 'x'],
    mod: ['sq', 'sq', 'ln', 'x'],
    mod2: ['sq', 'sq', 'ln', 'net', 'x'],
    glory: ['net', 'net', 'x', 'ln'],
    myriad: ['net', 'net', 'x', 'sq', 'ln']
  };

  /* ---------- 骨架生成器 ----------
     t 是目标格数，r 是 [0,1) 的稳定随机流。生成出来的格不归一化。 */
  function put1(set, cells, x, y) {
    var k = x + ',' + y;
    if (set[k]) return false;
    set[k] = 1; cells.push([x, y]); return true;
  }
  function has1(set, x, y) { return !!set[x + ',' + y]; }

>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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
<<<<<<< HEAD
     看着是一条斜线，其实是断成一串孤格。 */
=======
     看着是一条斜线，其实是断成一串孤格。阶梯走法每一步都是正交相邻。 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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
<<<<<<< HEAD
=======
      /* 两条腰走阶梯：每一级先横一步再竖一步，于是整条腰是一整条通路 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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
<<<<<<< HEAD
=======
    /* 顶：从两柱往中间一级一级抬，抬到中点会合 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    var mid = Math.floor(w / 2), lift = 0;
    for (x = 0; x <= mid; x++) {
      lift = Math.round(h + x * (h * 0.5 / Math.max(1, mid)));
      put1(set, cells, x, lift);
      if (x > 1 && x < w - 2) put1(set, cells, x, lift - 1);
      put1(set, cells, w - 1 - x, lift);
      if (x > 1 && x < w - 2) put1(set, cells, w - 1 - x, lift - 1);
    }
<<<<<<< HEAD
=======
    /* 把柱子顶端与拱的第一级接上（差一格就补一格，不留断口） */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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

<<<<<<< HEAD
=======
  /* ---------- 字形分配 ----------
     一件元件**整件用同一个字形**：从这一档的候选里挑一种，件上每一格都是它。
     从前是按象限给不同朝向，那套做法的前提是「同一族里有四五个朝向」——
     字形表砍到三种之后那个前提没了，而且整件同形本来就更易读：
     一眼看过去就知道「这一件是方块做的」还是「这一件是线编的」。
     线（ln / net）与叉号（x）由渲染器照邻居或照笔画自己画，方块是实心面。 */
  function assignGlyphs(cells, style, seed) {
    var pal = STYLE_PAL[style] || STYLE_PAL.shard;
    var pick = pal[Math.floor(U.at(seed, 901) * pal.length) % pal.length];
    var out = [], i;
    for (i = 0; i < cells.length; i++) out.push(pick);
    return out;
  }

>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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

<<<<<<< HEAD
  /* ---------- 归一化与旋转 ---------- */
=======
  /* ---------- 归一化：格与字形一起排，保证一一对应 ---------- */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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
<<<<<<< HEAD
=======
  function normPair(cells, glyphs) {
    var mnx = Infinity, mny = Infinity, t, arr = [];
    for (t = 0; t < cells.length; t++) {
      if (cells[t][0] < mnx) mnx = cells[t][0];
      if (cells[t][1] < mny) mny = cells[t][1];
    }
    for (t = 0; t < cells.length; t++) arr.push([cells[t][0] - mnx, cells[t][1] - mny, glyphs ? glyphs[t] : 'sq']);
    arr.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    return { cells: arr.map(function (a) { return [a[0], a[1]]; }), glyphs: arr.map(function (a) { return a[2]; }) };
  }
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
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

<<<<<<< HEAD
  /* ---------- 序号池 ----------
     成就解锁往里加序号（BS.metaDefs.mods().poolBoost），
     所以「库里出现新元件」的机制就是池子变大，不改任何生成规则。 */
  function pool() {
    var base = 512;
    var boost = (BS.metaDefs && BS.metaDefs.mods && BS.bus) ? (BS.metaDefs.mods(BS.bus.state.meta).poolBoost || 0) : 0;
    return base + boost;
  }

=======
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  /* ---------- 一件元件的全部：只由序号决定 ---------- */
  function shapeOf(i) {
    var seed = i * 7919 + 13;
    var uBase = U.at(i * 104729 + 1, 0);
<<<<<<< HEAD
    /* 稀有度只由序号定：解锁一概不碰它。
       长相跟着稀有度走，所以「解锁之后库里的件自己变了形」这种事不会发生。 */
=======
    /* 资质只由序号定：脉络与命题一概不碰它。
       长相跟着资质走，所以「点了脉络之后板上的件自己变了形」这种事不会发生。 */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    var rar = rarityOf(uBase);
    var sp = RARITY[rar];
    var k = 0;
    function R() { return U.at(seed, 500 + (k++)); }
    var target = sp.cells[0] + Math.floor(U.at(seed, 1) * (sp.cells[1] - sp.cells[0] + 1));
<<<<<<< HEAD
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
=======
    var pool = STYLE_FORMS[sp.style] || STYLE_FORMS.shard;
    var form = pool[Math.floor(U.at(seed, 2) * pool.length) % pool.length];
    var gen = GEN[form] || fShard;
    var raw = bridge(gen(target, R) || [[0, 0]]);
    if (!raw.length) raw = [[0, 0]];
    var gl = assignGlyphs(raw, sp.style, seed);
    var np = normPair(raw, gl);
    return { cells: np.cells, glyphs: np.glyphs, rar: rar, traits: traitsOf(i, rar), form: form, style: sp.style };
  }

  /* ---------- 特质分配：只由序号与资质决定 ---------- */
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  function traitsOf(i, rar) {
    var cap = RARITY[Math.max(0, Math.min(4, rar | 0))].traits;
    var u0 = U.at(i * 6151 + 11, 21);
    var base = u0 < 0.30 ? 0 : (u0 < 0.68 ? 1 : (u0 < 0.88 ? 2 : 3));
    var nT = Math.min(cap, base);
    /* 常档再压一压：让「什么都不带的常件」是常态，碰上特质才值得高兴 */
    if ((rar | 0) === 0 && U.at(i * 3571 + 5, 22) < 0.45) nT = Math.min(nT, 0);
<<<<<<< HEAD
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
=======
    /* 「性」这条脉络的用途是把空掷救回来：本来一条都不带的，按概率补一条。 */
    if (nT < cap) {
      var tl = BS.tree ? BS.tree.mods().traitLuck : 0;
      if (tl > 0 && U.at(i * 4211 + 17, 23) < tl) nT = Math.min(cap, nT + 1);
    }
    if (!nT) return [];
    var pool = [], z;
    for (z = 0; z < TRAITS.length; z++) pool.push(z);
    var out = [], j;
    for (j = 0; j < nT && pool.length; j++) {
      var rr = U.at(i * 7727 + 31, 40 + j);
      var idx = Math.floor(rr * pool.length) % pool.length;
      out.push(TRAITS[pool[idx]].id);
      pool.splice(idx, 1);
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
    }
    return out;
  }
  function traitOf(id) { return TRAIT_BY[id] || null; }
<<<<<<< HEAD
=======
  function sumEffects(ids) {
    var out = {}, i, t, e;
    for (i = 0; i < (ids || []).length; i++) {
      t = TRAIT_BY[ids[i]];
      if (!t) continue;
      for (e in t.effect) out[e] = (out[e] || 0) + t.effect[e];
    }
    return out;
  }
  /* ---------- 边际递减 ----------
     上面那个线性求和有个洞：特质是按**件数**累加的，而件数随这一稿长下去，
     于是「晶簇 → 自相似 +0.16」这种条目会堆到 0.16×N —— 六十件前后那四条轴
     必然打满 1.00。一个线性 source 没有衰减，就没有看的人会把它当目标，只有终点。
     所以抬质变读数的场合一律走这一份：同一种特质第 n 件的效力按 n/(n+K) 递减，
     总额封在这条特质「单件名义值」之内——再怎么堆也堆不过它的本值。
     K = 1.5：一件给 0.40 倍，三件 0.67 倍，十件 0.87 倍。[PLACEHOLDER：待 playtest] */
  var TAPER_K = 1.5;
  function sumEffectsTapered(ids, K) {
    if (K == null) K = TAPER_K;
    var cnt = {}, i, id, t, e, out = {};
    for (i = 0; i < (ids || []).length; i++) cnt[ids[i]] = (cnt[ids[i]] || 0) + 1;
    for (id in cnt) {
      t = TRAIT_BY[id];
      if (!t) continue;
      var f = cnt[id] / (cnt[id] + K);
      for (e in t.effect) out[e] = (out[e] || 0) + t.effect[e] * f;
    }
    return out;
  }
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  /* 名 = 型 · 格数。念一遍名字，就知道手里这件是个什么东西、有多大。 */
  function nameOf(i) {
    var s = shapeOf(i);
    return BS.i18n.term(FORM_BY[s.form]) + '·' + BS.i18n.fill('#格', s.cells.length);
  }
  function serialOf(i) { return '#' + pad(i, 4); }

  BS.parts = {
    RARITY: RARITY, TRAITS: TRAITS, TRAIT_BY: TRAIT_BY,
<<<<<<< HEAD
    FORMS: FORMS, FORM_BY: FORM_BY, STYLE_FORMS: STYLE_FORMS, formOf: formOf,
    rarityOf: rarityOf, nameOf: nameOf, serialOf: serialOf, shapeOf: shapeOf, traitsOf: traitsOf,
    traitOf: traitOf, pool: pool,
    rotCells: rotCells, size: size, norm: norm
=======
    FORMS: FORMS, FORM_BY: FORM_BY, STYLE_FORMS: STYLE_FORMS, STYLE_PAL: STYLE_PAL,
    GLYPHS: GLYPHS, GLYPH_BY: GLYPH_BY, ROTOF: ROTOF, ROTN: ROTN,
    rarityOf: rarityOf, nameOf: nameOf, serialOf: serialOf, shapeOf: shapeOf, traitsOf: traitsOf,
    traitOf: traitOf, sumEffects: sumEffects, sumEffectsTapered: sumEffectsTapered, TAPER_K: TAPER_K,
    glyph: glyph, rotGlyph: rotGlyph, variant: variant,
    rotCells: rotCells, rotPair: rotPair, size: size, norm: norm, normPair: normPair
>>>>>>> 6639c8bd4f64d897c2934d8577735e5d9e735986
  };
})(window.BS);
