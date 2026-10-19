/* core/achieve.js —— 判定：手写（条数以 LIST.length 为准，界面、手册与测试都从那取，不写死）。
   ------------------------------------------------------------------
   上一版是一千条机器生成的判定，语域花哨，但没人读得懂自己在追什么。
   这一版反过来：每一条都有个说得出口的名字，和一句看得懂的条件。

   难度是故意拔高的。这部作品装一件挣一点光，图形慢慢长，
   所以判定不该是「装十件就给」——那只会让判定变成进度条的装饰。
   这里绝大多数条目要你真正把结构做出名堂：几项指标同时读高、
   指定的特质凑齐、极端的结构特征、或者长期的苦功。
   玩很久偶尔蹦出一条，那条才值钱。

   判定是一次性的：成立了就记进存档，不会因为你拆掉一格而灭掉。
   它不直接给光——光只在呈交那一刻给。它换的是声誉：
   成立过的每一条，都会把你下一具图形的成交价往上抬一点。

   系数表（COEF）仍然留在这一层：测量页要靠它把stats 排成几栏。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus;

  /* ---------- 系数表：测量页与判定共用这一张 ---------- */
  var COEF = [
    /* 质变六项：这一组排在最前，因为它们是这部作品真正在乎的东西。
       六项的名字与顺序一律从 essence 的 DEFS 推出来，不在这里抄一份——
       抄一份就会在加减指标那天对不上（这一部作品出过这种事故）。 */
    { k: 'esScore', t: '质变度', en: 'ESSENCE', ja: 'エッセンス', ru: 'ЭССЕНЦИЯ', g: '质变' },
    { k: 'esSym', t: '对称', en: 'SYMMETRY', ja: '対称', ru: 'СИММЕТРИЯ', g: '质变' },
    { k: 'esRepeat', t: '重复', en: 'REPETITION', ja: '反復', ru: 'ПОВТОР', g: '质变' },
    { k: 'esVoid', t: '通透', en: 'VOID ORDER', ja: '通透', ru: 'ПОРЯДОК ПУСТОТ', g: '质变' },
    { k: 'esEven', t: '匀质', en: 'EVENNESS', ja: '均質', ru: 'РОВНОСТЬ', g: '质变' },
    { k: 'esWeave', t: '环络', en: 'WEAVE', ja: '環絡', ru: 'ЦИКЛИЧНОСТЬ', g: '质变' },
    { k: 'esEdge', t: '轮廓', en: 'CONTOUR', ja: '輪郭', ru: 'КОНТУР', g: '质变' },
    { k: 'esSpread', t: '六项落差', en: 'SPREAD', ja: '六項の落差', ru: 'РАЗБРОС', g: '质变' },
    { k: 'esWeak', t: '掉队项数', en: 'LAGGARDS', ja: '脱落項', ru: 'ОТСТАЮЩИХ', g: '质变' },
    { k: 'esLo', t: '最矮的那项', en: 'WEAKEST', ja: '最低の項', ru: 'СЛАБЕЙШИЙ', g: '质变' },
    { k: 'esDim', t: '标度维数', en: 'SCALING DIM.', ja: 'スケーリング次元', ru: 'РАЗМЕРНОСТЬ', g: '质变' },

    { k: 'n', t: '格数', en: 'CELLS', ja: 'マス数', ru: 'ЯЧЕЕК', g: '体量' },
    { k: 'M', t: '质量', en: 'MASS', ja: '質量', ru: 'МАССА', g: '体量' },
    { k: 'cellW', t: '平均格重', en: 'CELL WEIGHT', ja: '平均マス重', ru: 'СРЕДНИЙ ВЕС', g: '体量' },
    { k: 'insts', t: '元件数', en: 'PIECES', ja: '要素数', ru: 'ДЕТАЛЕЙ', g: '体量' },

    { k: 'P', t: '轮廓周长', en: 'PERIMETER', ja: '輪郭周長', ru: 'ПЕРИМЕТР', g: '轮廓' },
    { k: 'rings', t: '环数', en: 'RINGS', ja: '環数', ru: 'КОЛЕЦ', g: '轮廓' },
    { k: 'holes', t: '洞数', en: 'HOLES', ja: '穴数', ru: 'ДЫР', g: '轮廓' },
    { k: 'verts', t: '顶点数', en: 'VERTICES', ja: '頂点数', ru: 'ВЕРШИН', g: '轮廓' },
    { k: 'conv', t: '凸角数', en: 'CONVEX', ja: '凸角数', ru: 'ВЫПУКЛЫХ УГЛОВ', g: '轮廓' },
    { k: 'conc', t: '凹角数', en: 'CONCAVE', ja: '凹角数', ru: 'ВОГНУТЫХ УГЛОВ', g: '轮廓' },
    { k: 'turnR', t: '凹角比', en: 'TURN RATIO', ja: '凹角比', ru: 'ДОЛЯ ВОГНУТЫХ', g: '轮廓' },
    { k: 'exposure', t: '暴露', en: 'EXPOSURE', ja: '露出', ru: 'ЭКСПОЗИЦИЯ', g: '轮廓' },
    { k: 'circularity', t: '圆度', en: 'CIRCULARITY', ja: '円度', ru: 'КРУГЛОСТЬ', g: '轮廓' },
    { k: 'boundaryP', t: '边界势', en: 'BOUNDARY POT.', ja: '境界ポテンシャル', ru: 'ПОТЕНЦИАЛ ГРАНИЦЫ', g: '轮廓' },
    { k: 'fractal', t: '分形维数', en: 'FRACTAL DIM.', ja: 'フラクタル次元', ru: 'ФРАКТАЛЬНАЯ РАЗМЕРНОСТЬ', g: '轮廓' },

    { k: 'bboxW', t: '外接宽', en: 'BOX W', ja: '外接幅', ru: 'ШИРИНА ОПИСИ', g: '外形' },
    { k: 'bboxH', t: '外接高', en: 'BOX H', ja: '外接高', ru: 'ВЫСОТА ОПИСИ', g: '外形' },
    { k: 'spanX', t: '跨度 X', en: 'SPAN X', ja: 'スパン X', ru: 'ПРОЛЁТ X', g: '外形' },
    { k: 'spanY', t: '跨度 Y', en: 'SPAN Y', ja: 'スパン Y', ru: 'ПРОЛЁТ Y', g: '外形' },
    { k: 'diag', t: '外接对角线', en: 'DIAGONAL', ja: '外接対角線', ru: 'ДИАГОНАЛЬ', g: '外形' },
    { k: 'aspect', t: '长短比', en: 'ASPECT', ja: '長短比', ru: 'ВЫТЯНУТОСТЬ', g: '外形' },
    { k: 'boxfill', t: '框内填充', en: 'BOX FILL', ja: '枠内充填', ru: 'ЗАПОЛНЕНИЕ РАМКИ', g: '外形' },
    { k: 'void', t: '框内空位', en: 'VOID', ja: '枠内空き', ru: 'ПУСТОТЫ РАМКИ', g: '外形' },
    { k: 'hullV', t: '凸包顶点', en: 'HULL VERTS', ja: '凸包頂点', ru: 'ВЕРШИНЫ ОБОЛОЧКИ', g: '外形' },
    { k: 'hullA', t: '凸包面积', en: 'HULL AREA', ja: '凸包面積', ru: 'ПЛОЩАДЬ ОБОЛОЧКИ', g: '外形' },
    { k: 'fill', t: '充实度', en: 'FILL', ja: '充実度', ru: 'НАПОЛНЕННОСТЬ', g: '外形' },

    { k: 'e', t: '边数', en: 'EDGES', ja: '辺数', ru: 'РЁБЕР', g: '结构' },
    { k: 'comp', t: '连通块', en: 'COMPONENTS', ja: '連結成分', ru: 'КОМПОНЕНТ', g: '结构' },
    { k: 'cyc', t: '环数（图）', en: 'CYCLES', ja: '環数（グラフ）', ru: 'ЦИКЛОВ (ГРАФ)', g: '结构' },
    { k: 'art', t: '关节点', en: 'ARTICULATIONS', ja: '関節点', ru: 'ТОЧЕК СОЧЛЕНЕНИЯ', g: '结构' },
    { k: 'red', t: '冗余度', en: 'REDUNDANCY', ja: '冗長度', ru: 'ИЗБЫТОЧНОСТЬ', g: '结构' },
    { k: 'leaf', t: '端点', en: 'LEAVES', ja: '端点', ru: 'ЛИСТЬЕВ', g: '结构' },
    { k: 'branch', t: '分支点', en: 'BRANCHES', ja: '分岐点', ru: 'ТОЧЕК ВЕТВЛЕНИЯ', g: '结构' },
    { k: 'maxdeg', t: '最大度数', en: 'MAX DEGREE', ja: '最大次数', ru: 'МАКС. СТЕПЕНЬ', g: '结构' },
    { k: 'avgdeg', t: '平均度数', en: 'AVG DEGREE', ja: '平均次数', ru: 'СРЕДНЯЯ СТЕПЕНЬ', g: '结构' },
    { k: 'tree', t: '是否树', en: 'TREE', ja: '木か', ru: 'ДЕРЕВО', g: '结构' },
    { k: 'dia', t: '最长链', en: 'DIAMETER', ja: '最長鎖', ru: 'ДИАМЕТР', g: '结构' },
    { k: 'rad', t: '半径', en: 'RADIUS', ja: '半径', ru: 'РАДИУС', g: '结构' },
    { k: 'order', t: '群阶', en: 'GROUP ORDER', ja: '群の位数', ru: 'ПОРЯДОК ГРУППЫ', g: '结构' },

    { k: 'rar0', t: '常·格数', en: 'COMMON', ja: '常・マス数', ru: 'ОБЫКН. ЯЧЕЕК', g: '分布' },
    { k: 'rar1', t: '变·格数', en: 'MUTANT', ja: '変・マス数', ru: 'МУТАНТ. ЯЧЕЕК', g: '分布' },
    { k: 'rar2', t: '超·格数', en: 'HYPER', ja: '超・マス数', ru: 'ГИПЕР. ЯЧЕЕК', g: '分布' },
    { k: 'rar3', t: '华·格数', en: 'GLORY', ja: '華・マス数', ru: 'СЛАВН. ЯЧЕЕК', g: '分布' },
    { k: 'rar4', t: '殿·格数', en: 'MYRIAD', ja: '殿・マス数', ru: 'МИРИАД. ЯЧЕЕК', g: '分布' },
    { k: 'rarMax', t: '最高资质', en: 'MAX RARITY', ja: '最高レア度', ru: 'МАКС. РЕДКОСТЬ', g: '分布' },
    { k: 'rarMix', t: '资质种类', en: 'RARITY MIX', ja: 'レア度の種類', ru: 'ВИДОВ РЕДКОСТИ', g: '分布' },

    { k: 'cx', t: '质心 X', en: 'CENTROID X', ja: '質心 X', ru: 'ЦЕНТР МАСС X', g: '惯量' },
    { k: 'cy', t: '质心 Y', en: 'CENTROID Y', ja: '質心 Y', ru: 'ЦЕНТР МАСС Y', g: '惯量' },
    { k: 'bcx', t: '几何中心 X', en: 'BARY X', ja: '幾何中心 X', ru: 'БАРИЦЕНТР X', g: '惯量' },
    { k: 'bcy', t: '几何中心 Y', en: 'BARY Y', ja: '幾何中心 Y', ru: 'БАРИЦЕНТР Y', g: '惯量' },
    { k: 'ecc', t: '偏心', en: 'ECCENTRICITY', ja: '偏心', ru: 'ЭКСЦЕНТРИСИТЕТ', g: '惯量' },
    { k: 'rmean', t: '平均臂长', en: 'MEAN ARM', ja: '平均アーム長', ru: 'СРЕДНЕЕ ПЛЕЧО', g: '惯量' },
    { k: 'rmax', t: '最大臂长', en: 'MAX ARM', ja: '最大アーム長', ru: 'МАКС. ПЛЕЧО', g: '惯量' },
    { k: 'rmin', t: '最小臂长', en: 'MIN ARM', ja: '最小アーム長', ru: 'МИН. ПЛЕЧО', g: '惯量' },
    { k: 'rg', t: '回转半径', en: 'GYRATION', ja: '回転半径', ru: 'РАДИУС ГИРАЦИИ', g: '惯量' },
    { k: 'cheb', t: '切比雪夫半径', en: 'CHEBYSHEV', ja: 'チェビシェフ半径', ru: 'РАДИУС ЧЕБЫШЁВА', g: '惯量' },
    { k: 'manh', t: '曼哈顿半径', en: 'MANHATTAN', ja: 'マンハッタン半径', ru: 'МАНХЭТТЕНСКИЙ РАДИУС', g: '惯量' },
    { k: 'euc', t: '欧氏半径', en: 'EUCLIDEAN', ja: 'ユークリッド半径', ru: 'ЕВКЛИДОВ РАДИУС', g: '惯量' },
    { k: 'Ixx', t: '二阶矩 XX', en: 'IXX', ja: '二次モーメント XX', ru: 'МОМЕНТ XX', g: '惯量' },
    { k: 'Iyy', t: '二阶矩 YY', en: 'IYY', ja: '二次モーメント YY', ru: 'МОМЕНТ YY', g: '惯量' },
    { k: 'Ixy', t: '二阶矩 XY', en: 'IXY', ja: '二次モーメント XY', ru: 'МОМЕНТ XY', g: '惯量' },
    { k: 'l1', t: '主轴惯量 1', en: 'LAMBDA 1', ja: '主軸慣量 1', ru: 'ОСЬ 1', g: '惯量' },
    { k: 'l2', t: '主轴惯量 2', en: 'LAMBDA 2', ja: '主軸慣量 2', ru: 'ОСЬ 2', g: '惯量' },
    { k: 'aniso', t: '各向异性', en: 'ANISOTROPY', ja: '異方性', ru: 'АНИЗОТРОПИЯ', g: '惯量' },
    { k: 'theta', t: '主轴角', en: 'AXIS ANGLE', ja: '主軸角', ru: 'УГОЛ ОСИ', g: '惯量' }
  ];
  var BY = {};
  (function () { var i; for (i = 0; i < COEF.length; i++) BY[COEF[i].k] = COEF[i]; })();

  function val(st, k) {
    if (k === 'order') return st.sym ? st.sym.order : 0;
    if (k === 'tree') return st.tree ? 1 : 0;
    if (k.length === 4 && k.indexOf('rar') === 0) return st.rar ? (st.rar[+k.charAt(3)] | 0) : 0;
    var v = st[k];
    return typeof v === 'number' ? v : 0;
  }

  /* ---------- 判定（条数以 LIST.length 为准，界面、手册与测试都从那取，不写死） ----------
     ok(ctx) 拿到的 ctx 里有：
       st       当前图形的全部系数（含 es 六项与 esScore）
       traits   板上各特质的件数   forms 板上各型的件数
       insts    板上元件件数       lux    当前光   luxTotal  这辈子挣到的光
       tree     点亮的脉络数       quests 完成的命题数
       placed/removed/spun/recycled/undone  各项动手次数
     pay 是这一条的分量：难度越高给得越多。它决定这条在鉴赏录里值多少。 */
  var LIST = [
    /* ===== 质变：六项指标。这一组是这部作品的主线 ===== */
    { id: 'firstLight', cat: '质变', t: '第一缕光', d: '装上第一件元件，看见光进来', pay: 5,
      ok: function (c) { return c.placed >= 1; } },
    { id: 'essence30', cat: '质变', t: '有点意思了', d: '质变度达到 0.30', pay: 30,
      ok: function (c) { return c.st.esScore >= 0.30; } },
    { id: 'essence45', cat: '质变', t: '结构开始说话', d: '质变度达到 0.45', pay: 90,
      ok: function (c) { return c.st.esScore >= 0.45; } },
    { id: 'essence58', cat: '质变', t: '不是量变堆出来的', d: '质变度达到 0.58，且格数不少于一百', pay: 260,
      ok: function (c) { return c.st.esScore >= 0.58 && c.st.n >= 100; } },
    { id: 'essence70', cat: '质变', t: '上帝也得多看一眼', d: '质变度达到 0.70', pay: 900,
      ok: function (c) { return c.st.esScore >= 0.70; } },
    { id: 'allFour50', cat: '质变', t: '四面都立住了', d: '对称、重复、通透、匀质四项同时不低于 0.50', pay: 400,
      ok: function (c) { var e = c.st.es || {}; return e.sym >= 0.5 && e.repeat >= 0.5 && e.void >= 0.5 && e.even >= 0.5; } },
    { id: 'allFour68', cat: '质变', t: '四象俱全', d: '这四项同时不低于 0.68', pay: 2000,
      ok: function (c) { var e = c.st.es || {}; return e.sym >= 0.68 && e.repeat >= 0.68 && e.void >= 0.68 && e.even >= 0.68; } },
    /* 前五项：对称 / 重复 / 通透 / 匀质 / 环络。
       六项里最难凑的是「环络」——要围出圈来，不是堆出来的，所以单独留一档。 */
    { id: 'allSeven', cat: '质变', t: '前五项都立住', d: '对称、重复、通透、匀质、环络五项同时不低于 0.40', pay: 3000,
      ok: function (c) { var e = c.st.es || {}, ks = ['sym', 'repeat', 'void', 'even', 'weave'], i;
        for (i = 0; i < ks.length; i++) if (!((e[ks[i]] || 0) >= 0.40)) return false;
        return true; } },
    { id: 'allEleven', cat: '质变', t: '六项都立住', d: '六项质变指标同时不低于 0.36', pay: 6000,
      ok: function (c) { var e = c.st.es || {}, i, d2 = (BS.essence && BS.essence.DEFS) || [];
        for (i = 0; i < d2.length; i++) if (!((e[d2[i].k] || 0) >= 0.36)) return false;
        return true; } },
    { id: 'noWeakLeg', cat: '质变', t: '没有矮的那根', d: '六项之间的落差压到 0.28 以内，而质变度不低于 0.34', pay: 5000,
      ok: function (c) { return (c.st.esSpread || 0) <= 0.28 && (c.st.esScore || 0) >= 0.34; } },
    { id: 'noLaggard', cat: '质变', t: '一个掉队的都没有', d: '六项里没有一项低于 0.30，而质变度不低于 0.40', pay: 8000,
      ok: function (c) { return (c.st.esWeak || 0) === 0 && (c.st.esScore || 0) >= 0.40; } },
    { id: 'selfsim70', cat: '质变', t: '换个尺度还是它', d: '重复单项读到 0.70，且格数不少于八十', pay: 300,
      ok: function (c) { return c.st.esRepeat >= 0.70 && c.st.n >= 80; } },
    { id: 'fractal75', cat: '质变', t: '它不是实心块', d: '通透单项读到 0.75', pay: 300,
      ok: function (c) { return c.st.esVoid >= 0.75; } },
    { id: 'scoreNoSize', cat: '质变', t: '小而精', d: '只用不到四十格，把质变度做到 0.50 以上', pay: 350,
      ok: function (c) { return c.st.n > 0 && c.st.n < 40 && c.st.esScore >= 0.50; } },

    /* ===== 对称 ===== */
    { id: 'mirror8', cat: '对称', t: '水面静止', d: '对称读到 0.80，且格数不少于六十', pay: 220,
      ok: function (c) { return c.st.esSym >= 0.80 && c.st.n >= 60; } },
    { id: 'd4full', cat: '对称', t: '四镜齐明', d: '整个图形的对称群阶达到 8，且格数不少于一百二十', pay: 700,
      ok: function (c) { return c.st.sym && c.st.sym.order >= 8 && c.st.n >= 120; } },
    { id: 'globsym85', cat: '对称', t: '刚体级的整齐', d: '对称读到 0.85，且格数不少于八十', pay: 400,
      ok: function (c) { return c.st.esSym >= 0.85 && c.st.n >= 80; } },
    { id: 'eccZero', cat: '对称', t: '分毫不偏', d: '格数不少于六十，而质心与几何中心完全重合（偏心为 0）', pay: 500,
      ok: function (c) { return c.st.n >= 60 && c.st.ecc === 0; } },
    { id: 'symAndFractal', cat: '对称', t: '秩序里的褶皱', d: '对称与通透同时不低于 0.60——整齐的外框里塞着有秩序的洞', pay: 800,
      ok: function (c) { var e = c.st.es || {}; return e.sym >= 0.60 && e.void >= 0.60; } },
    { id: 'convexBig', cat: '对称', t: '一块都不凹', d: '凹角为 0，且格数不少于六十', pay: 450,
      ok: function (c) { return c.st.conc === 0 && c.st.n >= 60; } },

    /* ===== 结构：极端特征 ===== */
    { id: 'hole3', cat: '结构', t: '漏了三处', d: '围出 3 个洞', pay: 60,
      ok: function (c) { return c.st.holes >= 3; } },
    { id: 'hole9', cat: '结构', t: '筛子', d: '围出 9 个洞', pay: 500,
      ok: function (c) { return c.st.holes >= 9; } },
    { id: 'hole20', cat: '结构', t: '千疮百孔，仍然立着', d: '围出 20 个洞，且图形仍然是一整块', pay: 1800,
      ok: function (c) { return c.st.holes >= 20 && c.st.comp === 1; } },
    { id: 'thread40', cat: '结构', t: '一线到天边', d: '最长链达到 40 格', pay: 400,
      ok: function (c) { return c.st.dia >= 40; } },
    { id: 'thread80', cat: '结构', t: '一笔画不出', d: '最长链达到 80 格', pay: 1600,
      ok: function (c) { return c.st.dia >= 80; } },
    { id: 'pureTree', cat: '结构', t: '没有一个环', d: '格位图是一棵树（无环）且不少于五十格', pay: 600,
      ok: function (c) { return c.st.tree && c.st.n >= 50; } },
    { id: 'manyRings', cat: '结构', t: '环环相扣', d: '格位图里有 30 个以上的环', pay: 500,
      ok: function (c) { return c.st.cyc >= 30; } },
    { id: 'spiky', cat: '结构', t: '浑身是刺', d: '端点（只有一格邻居的格）达到 20 个', pay: 350,
      ok: function (c) { return c.st.leaf >= 20; } },
    { id: 'artic15', cat: '结构', t: '一拆就散', d: '关节点达到 15 个', pay: 400,
      ok: function (c) { return c.st.art >= 15; } },
    { id: 'noArtic', cat: '结构', t: '拿掉哪一格都还连着', d: '格数不少于八十，而关节点为 0', pay: 900,
      ok: function (c) { return c.st.n >= 80 && c.st.art === 0; } },
    { id: 'dense100', cat: '结构', t: '密不透风', d: '框内填充率不低于 0.95，且格数不少于一百', pay: 500,
      ok: function (c) { return c.st.boxfill >= 0.95 && c.st.n >= 100; } },
    { id: 'loose100', cat: '结构', t: '摊成一片', d: '框内填充率不高于 0.30，且格数不少于一百', pay: 500,
      ok: function (c) { return c.st.boxfill <= 0.30 && c.st.n >= 100; } },
    { id: 'serrated', cat: '结构', t: '锯齿成排', d: '凹角达到 40 个', pay: 400,
      ok: function (c) { return c.st.conc >= 40; } },
    { id: 'aniso8', cat: '结构', t: '一根扁担', d: '惯量主轴之比达到 8', pay: 400,
      ok: function (c) { return c.st.aniso >= 8; } },
    { id: 'circle85', cat: '结构', t: '逼近一个圆', d: '圆度达到 0.85，且格数不少于八十', pay: 600,
      ok: function (c) { return c.st.circularity >= 0.85 && c.st.n >= 80; } },
    { id: 'split5', cat: '结构', t: '五块互不相干', d: '图形断成 5 块以上', pay: 200,
      ok: function (c) { return c.st.comp >= 5; } },
    { id: 'huge', cat: '结构', t: '看不见全貌', d: '格数达到 600', pay: 700,
      ok: function (c) { return c.st.n >= 600; } },
    { id: 'vast', cat: '结构', t: '一屏装不下', d: '格数达到 1500', pay: 2500,
      ok: function (c) { return c.st.n >= 1500; } },

    /* ===== 特质 ===== */
    { id: 'volt', cat: '特质', t: '闪电顺着骨架走', d: '板上同时有 3 件带「闪电」特质', pay: 200,
      ok: function (c) { return (c.traits.volt || 0) >= 3; } },
    { id: 'sacra', cat: '特质', t: '圣几何显形', d: '板上同时有 3 件带「圣几何」特质', pay: 200,
      ok: function (c) { return (c.traits.sacra || 0) >= 3; } },
    { id: 'oculus', cat: '特质', t: '被上帝注视', d: '板上同时有 4 件带「神视」特质', pay: 400,
      ok: function (c) { return (c.traits.oculus || 0) >= 4; } },
    { id: 'automa', cat: '特质', t: '它们自己会动', d: '板上同时有 4 件带「自组织」特质', pay: 400,
      ok: function (c) { return (c.traits.automa || 0) >= 4; } },
    { id: 'allTraits', cat: '特质', t: '十一相俱全', d: '十一种特质在板上各至少有一件', pay: 3000,
      ok: function (c) { var P2 = BS.parts, i; for (i = 0; i < P2.TRAITS.length; i++) if (!(c.traits[P2.TRAITS[i].id] > 0)) return false; return true; } },
    { id: 'traitHeavy', cat: '特质', t: '一身都是本事', d: '板上的元件带的特质总数达到 20 条', pay: 600,
      ok: function (c) { var k, s = 0; for (k in c.traits) s += c.traits[k]; return s >= 20; } },
    { id: 'voltSight', cat: '特质', t: '雷与眼', d: '板上同时有「闪电」与「神视」各 2 件以上', pay: 500,
      ok: function (c) { return (c.traits.volt || 0) >= 2 && (c.traits.oculus || 0) >= 2; } },
    { id: 'crystaVacua', cat: '特质', t: '晶与虚', d: '板上同时有「晶簇」与「虚空」各 2 件以上', pay: 500,
      ok: function (c) { return (c.traits.crysta || 0) >= 2 && (c.traits.vacua || 0) >= 2; } },

    /* ===== 型：十八种骨架 ===== */
    { id: 'form8', cat: '型', t: '八型同堂', d: '板上出现了 8 种以上的型', pay: 900,
      ok: function (c) { var k, n = 0; for (k in (c.forms || {})) if (c.forms[k] > 0) n++; return n >= 8; } },
    { id: 'form12', cat: '型', t: '十二型同堂', d: '板上出现了 12 种以上的型', pay: 2200,
      ok: function (c) { var k, n = 0; for (k in (c.forms || {})) if (c.forms[k] > 0) n++; return n >= 12; } },
    { id: 'same5', cat: '型', t: '同一种来了五件', d: '板上有 5 件同一型的元件', pay: 400,
      ok: function (c) { var k; for (k in (c.forms || {})) if (c.forms[k] >= 5) return true; return false; } },
    { id: 'frame3', cat: '型', t: '框里的框', d: '板上同时有 3 件「框」型', pay: 300,
      ok: function (c) { return (c.forms.frame || 0) >= 3; } },
    { id: 'arch3', cat: '型', t: '三拱相连', d: '板上同时有 3 件「拱」型', pay: 300,
      ok: function (c) { return (c.forms.arch || 0) >= 3; } },
    { id: 'tower3', cat: '型', t: '三座塔', d: '板上同时有 3 件「塔」型', pay: 300,
      ok: function (c) { return (c.forms.tower || 0) >= 3; } },
    { id: 'coil3', cat: '型', t: '三只盘', d: '板上同时有 3 件「盘」型', pay: 300,
      ok: function (c) { return (c.forms.coil || 0) >= 3; } },
    { id: 'bolt3', cat: '型', t: '三道落雷', d: '板上同时有 3 件「雷」型', pay: 300,
      ok: function (c) { return (c.forms.bolt || 0) >= 3; } },

    /* ===== 资质 ===== */
    { id: 'rar2', cat: '稀有', t: '摸到超档', d: '板上有一件「超」档以上的元件', pay: 60,
      ok: function (c) { return c.st.rarMax >= 2; } },
    { id: 'rar3', cat: '稀有', t: '华彩', d: '板上有一件「华」档以上的元件', pay: 200,
      ok: function (c) { return c.st.rarMax >= 3; } },
    { id: 'rar4', cat: '稀有', t: '殿堂之上', d: '板上有一件「殿」档元件', pay: 600,
      ok: function (c) { return c.st.rarMax >= 4; } },
    { id: 'rar4x3', cat: '稀有', t: '三座殿堂', d: '板上同时有 3 件「殿」档元件', pay: 2500,
      ok: function (c) { return countRar(c, 4) >= 3; } },
    { id: 'mix5', cat: '稀有', t: '五档同框', d: '常、变、超、华、殿五档资质同时在板上', pay: 800,
      ok: function (c) { return c.st.rarMix >= 5; } },
    { id: 'mix5big', cat: '稀有', t: '五档同框，而且很大', d: '五档资质同时在板上，且格数不少于两百', pay: 1800,
      ok: function (c) { return c.st.rarMix >= 5 && c.st.n >= 200; } },

    /* ===== 脉络 ===== */
    { id: 'tree5', cat: '脉络', t: '点亮第一盏', d: '点亮 5 个脉络节点', pay: 40,
      ok: function (c) { return c.tree >= 5; } },
    { id: 'tree20', cat: '脉络', t: '顺着脉络往下', d: '点亮 20 个脉络节点', pay: 200,
      ok: function (c) { return c.tree >= 20; } },
    { id: 'tree50', cat: '脉络', t: '一片灯海', d: '点亮 50 个脉络节点', pay: 800,
      ok: function (c) { return c.tree >= 50; } },
    { id: 'allBranch', cat: '脉络', t: '八条脉络都走通了', d: '八条脉络每条至少点亮 3 个节点', pay: 1500,
      ok: function (c) { return c.branchMin >= 3; } },
    { id: 'deep8', cat: '脉络', t: '挖到第八层', d: '点亮一个第 8 层或更深的节点', pay: 900,
      ok: function (c) { return c.maxTier >= 8; } },
    { id: 'undo5', cat: '脉络', t: '留了后手', d: '「手」这条脉络点到可撤销 5 步以上', pay: 150,
      ok: function (c) { return c.undoCap >= 5; } },

    /* ===== 命题 ===== */
    { id: 'quest1', cat: '命题', t: '按吩咐办了', d: '完成第 1 条命题', pay: 30,
      ok: function (c) { return c.quests >= 1; } },
    { id: 'quest10', cat: '命题', t: '熟练工', d: '完成 10 条命题', pay: 200,
      ok: function (c) { return c.quests >= 10; } },
    { id: 'quest30', cat: '命题', t: '照单全收', d: '完成 30 条命题', pay: 800,
      ok: function (c) { return c.quests >= 30; } },
    { id: 'rep20', cat: '命题', t: '有了名声', d: '声誉攒到 20% 以上', pay: 600,
      ok: function (c) { return c.rep >= 0.20; } },
    { id: 'rep40', cat: '命题', t: '拍卖行认你的名字', d: '声誉攒到 40% 以上', pay: 2000,
      ok: function (c) { return c.rep >= 0.40; } },

    /* ===== 苦功 ===== */
    { id: 'place50', cat: '苦功', t: '手热了', d: '累计装上 50 件', pay: 60,
      ok: function (c) { return c.placed >= 50; } },
    { id: 'place300', cat: '苦功', t: '装到手软', d: '累计装上 300 件', pay: 400,
      ok: function (c) { return c.placed >= 300; } },
    { id: 'place1000', cat: '苦功', t: '一千次动手，全在这块板上', d: '累计装上 1000 件', pay: 2000,
      ok: function (c) { return c.placed >= 1000; } },
    { id: 'lux10k', cat: '苦功', t: '小有积蓄', d: '这辈子累计挣到 10,000 光', pay: 150,
      ok: function (c) { return c.luxTotal >= 10000; } },
    { id: 'lux1m', cat: '苦功', t: '光的富翁', d: '这辈子累计挣到 1,000,000 光', pay: 1200,
      ok: function (c) { return c.luxTotal >= 1000000; } },
    { id: 'lux100m', cat: '苦功', t: '亮得看不见别的东西', d: '这辈子累计挣到 100,000,000 光', pay: 6000,
      ok: function (c) { return c.luxTotal >= 100000000; } },
    { id: 'recycle50', cat: '苦功', t: '断舍离', d: '回收 50 件', pay: 120,
      ok: function (c) { return c.recycled >= 50; } },
    { id: 'undo20', cat: '苦功', t: '后悔了二十次', d: '撤销 20 步', pay: 200,
      ok: function (c) { return c.undone >= 20; } },
    { id: 'spin100', cat: '苦功', t: '转了又转', d: '原地转向 100 次', pay: 150,
      ok: function (c) { return c.spun >= 100; } },

    /* ===== 冷门：要碰运气，或者要想一下才做得到 ===== */
    { id: 'singleCell', cat: '冷门', t: '一格宇宙', d: '板上只有一格，而质变度不为 0', pay: 100,
      ok: function (c) { return c.st.n === 1 && c.st.esScore > 0; } },
    { id: 'onePiece', cat: '冷门', t: '只此一件', d: '板上只装了一件元件，而它不少于二十格', pay: 250,
      ok: function (c) { return c.insts === 1 && c.st.n >= 20; } },
    { id: 'perfectSquare', cat: '冷门', t: '一个正方形', d: '外接框是正方形，填充率 100%，且边长不少于 8', pay: 500,
      ok: function (c) { return c.st.bboxW === c.st.bboxH && c.st.bboxW >= 8 && c.st.boxfill >= 0.999; } },
    /* 上面那条要边长 8 起步，于是「小而方」这件事一开头就够不着。
       下面三条量的是同一件事的小号版本：格子少，但干净得不打折。
       它们是给早期那几件_structural 反馈用的—— symmetries 读得很高却没人应，
       是这一版最实在的一处冷落。 */
    { id: 'neatSquare', cat: '冷门', t: '小而方', d: '外接框是正方形，填充率 100%，边长在 3 到 7 之间', pay: 120,
      ok: function (c) { return c.st.bboxW === c.st.bboxH && c.st.bboxW >= 3 && c.st.bboxW < 8 && c.st.boxfill >= 0.999; } },
    { id: 'mirrorSmall', cat: '冷门', t: '小镜子', d: '对称读到 0.90 以上，而格数不超过四十', pay: 150,
      ok: function (c) { return c.st.n > 0 && c.st.n <= 40 && c.st.esSym >= 0.90; } },
    { id: 'stillSolid', cat: '冷门', t: '一块整料', d: '格数不少于九，而凹角为 0、洞为 0、仍然连成一整块', pay: 100,
      ok: function (c) { return c.st.n >= 9 && c.st.conc === 0 && c.st.holes === 0 && c.st.comp === 1; } },
    { id: 'thinLine', cat: '冷门', t: '一根线', d: '外接框有一边是 1，另一边不少于 20', pay: 300,
      ok: function (c) { return (c.st.bboxW === 1 && c.st.bboxH >= 20) || (c.st.bboxH === 1 && c.st.bboxW >= 20); } },
    { id: 'zeroHolesBig', cat: '冷门', t: '实心到两百格', d: '格数不少于两百，而一个洞都没有', pay: 600,
      ok: function (c) { return c.st.n >= 200 && c.st.holes === 0; } },
    { id: 'noUndoRun', cat: '冷门', t: '一步没错', d: '累计装上 200 件，而一次都没撤销过', pay: 800,
      ok: function (c) { return c.placed >= 200 && c.undone === 0; } },
    { id: 'aether5', cat: '冷门', t: '轻得像没有', d: '板上同时有 5 件带「以太」特质', pay: 1200,
      ok: function (c) { return (c.traits.aether || 0) >= 5; } },
    { id: 'resona5', cat: '冷门', t: '共鸣成阵', d: '板上同时有 5 件带「共鸣」特质', pay: 1200,
      ok: function (c) { return (c.traits.resona || 0) >= 5; } },
    { id: 'essenceAtScale', cat: '冷门', t: '大了还不散', d: '格数不少于三百，而质变度仍不低于 0.55', pay: 2500,
      ok: function (c) { return c.st.n >= 300 && c.st.esScore >= 0.55; } },
    { id: 'fullHouse', cat: '冷门', t: '满堂彩', d: '五档资质、十种以上的型、十一种特质，全部同时在板上', pay: 8000,
      ok: function (c) {
        var P2 = BS.parts, i, k, nf = 0;
        if (c.st.rarMix < 5) return false;
        for (k in (c.forms || {})) if (c.forms[k] > 0) nf++;
        if (nf < 10) return false;
        for (i = 0; i < P2.TRAITS.length; i++) if (!(c.traits[P2.TRAITS[i].id] > 0)) return false;
        return true;
      } }
  ];
  var BYID = {};
  (function () { var i; for (i = 0; i < LIST.length; i++) BYID[LIST[i].id] = LIST[i]; })();

  /* 「三座殿堂」要数的是件数，不是格数——st.rar[4] 是格数 */
  function countRar(c, r) {
    return c.rarCount ? (c.rarCount[r] || 0) : 0;
  }

  /* ---------- 分类 ---------- */
  function groups() {
    var out = [], seen = {}, i;
    for (i = 0; i < LIST.length; i++) {
      if (seen[LIST[i].cat]) continue;
      seen[LIST[i].cat] = 1;
      out.push(LIST[i].cat);
    }
    return out;
  }
  function inGroup(g) {
    var out = [], i;
    for (i = 0; i < LIST.length; i++) if (LIST[i].g === g || LIST[i].cat === g) out.push(LIST[i]);
    return out;
  }
  /* 测量页要按 COEF 分组排栏，这个函数单独给它 */
  function coefGroups() {
    var out = [], seen = {}, i;
    for (i = 0; i < COEF.length; i++) {
      if (seen[COEF[i].g]) continue;
      seen[COEF[i].g] = 1;
      out.push(COEF[i].g);
    }
    return out;
  }
  function coefInGroup(g) {
    var out = [], i;
    for (i = 0; i < COEF.length; i++) if (COEF[i].g === g) out.push(COEF[i]);
    return out;
  }

  /* ---------- 上下文：判定要看的读数全在这里凑齐 ---------- */
  function buildCtx(M) {
    var S = B.state;
    var st = M.stats();
    var traits = {}, forms = {}, rarCount = [0, 0, 0, 0, 0], seen = {}, ins = M.insts(), i, e, m;
    for (i = 0; i < ins.length; i++) {
      e = ins[i].e;
      if (seen[e]) continue;
      seen[e] = 1;
      m = M.metaOf(e);
      var tr = m.traits || [], z;
      for (z = 0; z < tr.length; z++) traits[tr[z]] = (traits[tr[z]] || 0) + 1;
      if (m.form) forms[m.form] = (forms[m.form] || 0) + 1;
      rarCount[Math.max(0, Math.min(4, m.rar | 0))]++;
    }
    /* 八条脉络里点得最少的那条有几级 */
    var branchMin = Infinity, b;
    for (i = 0; i < BS.tree.BRANCHES.length; i++) {
      b = BS.tree.branchLevel(BS.tree.BRANCHES[i].id);
      if (b < branchMin) branchMin = b;
    }
    if (branchMin === Infinity) branchMin = 0;
    return {
      st: st, traits: traits, forms: forms, rarCount: rarCount,
      insts: ins.length,
      lux: S.lux | 0, luxTotal: S.luxTotal | 0,
      tree: BS.tree.mods().nodes | 0,
      maxTier: BS.tree.maxBoughtTier(),
      /* 这一项读的是「手」脉络累计加了多少步，**不含** rig.UNDO_BASE 那基础的五步。
         名字沿用 undoCap 是历史遗留，别拿它跟 M.undoCap() 比——后者是两者之和。
         判定「留了后手」判的是 c.undoCap >= 5，也就是脉络本身点到 5 步，
         T6 给了基础五步之后这条门槛没有变松，仍然是要点亮「手」才拿得到。 */
      undoCap: BS.tree.mods().undo | 0,
      branchMin: branchMin,
      quests: S.quest ? (S.quest.done | 0) : 0,
      rep: BS.quests ? BS.quests.rep() : 0,
      placed: S.stat.placed | 0, removed: S.stat.removed | 0,
      spun: S.stat.spun | 0, recycled: S.stat.recycled | 0, undone: S.stat.undone | 0
    };
  }

  /* ---------- 点亮：一次性的，点亮就记档、就给光 ---------- */
  function scan(M) {
    var S = B.state, ctx = buildCtx(M), out = [], i, a;
    S.ach = S.ach || {};
    for (i = 0; i < LIST.length; i++) {
      a = LIST[i];
      if (S.ach[a.id]) continue;                 /* 已经成立的不再判 */
      var hit = false;
      try { hit = !!a.ok(ctx); } catch (e) { hit = false; }
      if (!hit) continue;
      S.ach[a.id] = S.seq | 0;
      S.stat.achs = (S.stat.achs | 0) + 1;
      /* 判定不给光——光只在呈交那一刻给。判定换的是声誉：
         成立过的每一条都会把你下一具图形的成交价抬上去一点。 */
      /* 记录栏里的文字是原样渲染的，所以这一句在写进日志那一刻就得落语言。 */
      B.log(BS.i18n.fill('判定成立：# —— #', BS.i18n.tell(a.t), BS.i18n.tell(a.d)), 'ach');
      out.push(a);
    }
    if (out.length) { B.emit('ach', out); B.save(); }
    return out;
  }
  function unlocked(id) { return !!(B.state.ach || {})[id]; }
  function count() {
    var S = B.state, k, n = 0;
    for (k in (S.ach || {})) if (BYID[k]) n++;
    return n;
  }
  /* 当前图形满足了哪些（不管有没有点亮过）——测量页用来高亮 */
  function marks(M) {
    var ctx = buildCtx(M), out = [], i;
    for (i = 0; i < LIST.length; i++) {
      try { if (LIST[i].ok(ctx)) out.push(LIST[i].id); } catch (e) { /* 由它去 */ }
    }
    return out;
  }

  BS.achieve = {
    COEF: COEF, LIST: LIST, BYID: BYID,
    val: val, groups: groups, inGroup: inGroup,
    coefGroups: coefGroups, coefInGroup: coefInGroup,
    buildCtx: buildCtx, scan: scan, marks: marks, unlocked: unlocked, count: count
  };
})(window.BS);
