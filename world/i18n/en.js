/* world/i18n/en.js —— 英语词典。
   ------------------------------------------------------------------
   **中文是源**：`T('战斗')` 里的那个串就是键，这个文件只提供它的英文。
   为什么不改成 key→{zh,en} 的两栏表：那要把全部十二页的每一处调用点
   都改一遍（三百多处），而「中文即键」让这一层可以整个拆掉或整个换上，
   不动任何一页——这正是把语言收在一层里的意义（见 core/i18n.js 的头注释）。

   三条规矩：
     1. **模板里的 `#` 数量必须与中文一致**——译文是先查表、后填空的，
        少一个 `#` 就是少一个数字（`fill()` 会原样留下 `#`，很难看但不会崩）。
     2. **表项不走这里**：稀有度 / 型 / 特质 / 敌人 / 升级 / 成就 / 形变
        本来就带 `en` 字段（它们是造型语言的一部分），由 `I.term(row)` 按
        当前语言取——所以那份翻译只有一处，不会和这里重复。
     3. **键必须与源码逐字相同**（含标点与空格）：门禁会把源码里所有
        T('…') / H.kv('…') / H.head('…') 抽出来，逐条查这里有没有。
        少一条就红——这是「加了新界面忘了上语言」的唯一防线。

   分区顺序与导航一致：顶栏 → 工坊 → 库 → 商店 → 花园 → 塔防 → 成就
   → 重塑 → 测量 → 军械库 → 装配台 → 设置 → 图鉴（垫底）。
   （指针宇宙那一页已经删掉：接管战斗标量的那一头由「阵型」接上，
     词条收在本文件上方的「阵型」与「质变口」两段里。） */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  if (!BS.i18n || !BS.i18n.dict) return;      /* 语言层不在就直接退出 */

  BS.i18n.dict('en', {
    /* ---------- 顶栏与阶段 ---------- */
    '部署': 'DEPLOY', '战斗': 'BATTLE', '休整': 'REST', '已结算': 'SETTLED', '不在局中': 'NO RUN',
    '图形即防事。': 'Form is the defense.',
    '冷静 开': 'Calm ON', '冷静 关': 'Calm OFF',
    '采集尘': 'Dust', '结晶': 'Crystal', '库': 'Stock',
    '刻度': 'RANK', '压': 'PRESS', '阶段': 'PHASE',
    '剩余预算': 'BUDGET LEFT', '已部署': 'DEPLOYED', '已花': 'SPENT',
    '波次': 'WAVE', '基地': 'BASE', '辉光': 'Lux',
    '拍': 'BEAT', '接线': 'WIRES', '密度': 'DENSITY', '压力': 'PRESSURE', '饱和': 'SEAL',
    '生命 # · 速度 # · 单体伤害减免 # · 漏过扣 #':
      'HP # · SPEED # · SINGLE HIT ×# · LEAK −#',
    '波': 'WAVES', '塔': 'TOWERS', '场上敌人': 'ON FIELD', '本波 HP ×': 'WAVE HP ×',

    /* ---------- 阵型（接管战斗标量的那一头） ---------- */
    '阵型': 'FORMATION', '质变度': 'TRANSMUTATION', '座': 'towers',
    '接缝': 'SEAM', '邻接回路': 'ADJACENCY', '长成': 'GREW INTO',
    '# 座 · 质变度 #': '# towers · transmutation #',
    '乱流是你摆出来的，不是掷出来的': 'The flux is laid out by you, not rolled for you.',
    '这一局还没摆下任何东西。': 'Nothing is laid out in this run yet.',
    '# 条接缝': '# seams',
    '共振 / 干涉 / 互补——谁挨着谁，第一次有意义':
      'resonance / interference / complement — who sits next to whom matters for the first time',
    '峰值是双刃：你的强项，也是这一局敌人的厚度':
      'the peak is double-edged: your strength, and this run\u2019s enemy thickness',
    /* ---------- 质变口（第 2 / 5 / 10 级各开一口，一口一条，最多三口） ---------- */
    '质变口：这一级不给伤害，给一条新规则':
      'Transmutation gate: this level gives no damage, it gives a new rule.',
    '三个候选由这座塔自己的读数排序得出。一口一条，选完焊死——想换请进化下一座。':
      'The three candidates are ranked by this tower\u2019s own readings. One per gate; once chosen it is welded — to change it, evolve the next one.',
    '第 # 级这一口 · 已焊 # / #': 'Gate at level # · welded # / #',
    '下一口在第 # 级': 'Next gate at level #',
    /* 战备指令：按波去重（一波一次），不按局去重（同一条后面的波可以再来） */
    '这一波已经下过令了——下一波再选': 'This wave already has an order — pick again next wave.',
    '这一波已经下过令了：同一条指令可以在后面的波里再下一次。':
      'This wave already has an order; the same order may be issued again in a later wave.',
    '下一波再选': 'Pick again next wave',
    /* 塔条与详情里的等级后缀。它一直没进词典，所以英文界面上
       塔名后面永远拖着一个「级」字。 */
    '# 级': 'LV #',
    '这一座最多 # 条规则，已经焊满了':
      'This tower holds at most # rules — it is welded shut.',
    '这一口已经焊过了——下一口在更高一级':
      'This gate is already welded — the next one is at a higher level.',
    '殉爆': 'DETONATE',
    '自毁：周围一圈造成生命值 ×2 的伤害，返六成辉光，塔回军械库。':
      'Self-destruct: ×2 HP as damage in one ring, refunds 60% Lux, and the tower returns to the armory.',
    '殉爆：命中 # 只，返 # 辉光': 'Detonate: hit # enemies, refunded # Lux',
    '没有这一局': 'No run in progress',
    '只有这一局里才能殉爆': 'You can only detonate inside a run',
    '殉爆的塔没能回到军械库（流水里找不到它）':
      'The detonated tower could not return to the armory (not in the submission log)',
    '没有这种形变': 'No such mutation',
    '这座塔已经走过这条路': 'This tower has already walked that road',
    '这座塔长不成这个': 'This tower cannot grow into that',
    /* ---------- 测量页的第四个目标 ---------- */
    '# 格扩一圈': '# cells to the next ring',
    '本局阵型': 'This run\u2019s formation',
    '阵型六项读数接管战斗标量的幅度 +20%': 'Formation readings take over battle scalars +20%',
    '峰值读数抬高的敌血 -20%': 'Enemy thickness raised by the peak reading −20%',
    '阵型增益': 'FORMATION GAIN', '峰值豁免': 'PEAK RELIEF',


    /* ---------- 图形工坊 ---------- */
    '图形工坊': 'Workshop', 'WORKSHOP': 'WORKSHOP',
    '伤害 # · 攻速 # · 射程 # · 弹 # · 连锁 #':
      'DMG # · RATE # · RANGE # · SHOTS # · CHAIN #',
    '手上是空的。从下面的库里拿一件。': 'Your hand is empty. Take a piece from the library below.',
    '手上是空的。从下面的库里拿一枚。': 'Your hand is empty. Take a piece from the library below.',
    '转 90°（R）': 'Rotate 90° (R)',
    '放回': 'Put back',
    '拿在手上': 'Take in hand',
    '把光标移到图纸上，按空格把它放下——外接框左上角就落在光标那一格。':
      'Move the cursor onto the blueprint and press SPACE to drop it — the bounding box lands on that cell.',
    '点图纸上任意一格，看那一格的数据。看不会改动图面；放置只认空格。':
      'Click any cell to read its data. Reading never changes the board; placing only happens on SPACE.',
    '空格': 'SPACE',
    '这里还没有东西。把手上的件对准它，按空格就落在这里。':
      'Nothing here yet. Aim your piece at it and press SPACE.',
    '拆掉整件（Del）': 'Remove whole piece (Del)',
    '元件来自序号池：拆了不亏，随时再取。': 'Pieces come from a serial pool — removing loses nothing.',
    '进化预览': 'EVOLUTION PREVIEW',
    '图纸是空的。放上一枚元件，读数就开始长。': 'The blueprint is empty. Place one piece and the readings start growing.',
    '元件': 'PIECE', '质变度': 'TRANSMUTATION',
    '清空图纸': 'Clear blueprint', '提交进化': 'Submit & evolve',
    '试算': 'WHAT-IF', '这里放不下': 'Does not fit here',
    '质变度 # → #': 'Transmutation # → #',
    '部署成本 # → # 辉光': 'Deploy cost # → # Lux',
    '空格＝放下 · R＝转手上那件 · 点一格＝看那一格':
      'SPACE = place · R = rotate · click a cell = inspect',
    '手上': 'IN HAND', '选中的格': 'SELECTED CELL',
    '放回了。': 'Put back.', '库里没有这一件': 'No such piece in the library',
    '拿起了「#」。': 'Took "#".', '转了 #°。': 'Rotated #°.', '图纸清空了。': 'Blueprint cleared.',
    '拆掉了整件。': 'Removed the whole piece.',
    '先把光标移到图纸上，再按空格——落点就是光标那一格。':
      'Move the cursor onto the blueprint first — SPACE drops it on that cell.',
    '成了。': 'Done.',
    '外接': 'BBOX', '转向': 'ROT', '坐标': 'AT', '整件': 'PIECE',
    '图纸': 'BLUEPRINT', '扩容层级': 'EXPANSION', '格': 'cells',
    '稀有度': 'RARITY', '全部': 'All', '特质': 'TRAITS',
    '←': '←', '→': '→',

    /* ---------- 图形花园 ---------- */
    '图形花园': 'Garden', 'GARDEN': 'GARDEN',
    '花园': 'Garden',
    '把光标移到花园上，按空格种下——外接框左上角落在光标那一格。':
      'Move the cursor onto the garden and press SPACE to plant.',
    '点花园任意一格，看那一格的数据。放置只认空格。':
      'Click any cell to read its data. Planting only happens on SPACE.',
    '空土': 'BARE SOIL', '把光标对准它，按空格就种在这里。': 'Aim at it and press SPACE to plant here.',
    '挖走（Del）': 'Dig out (Del)', '挖走后元件回库。': 'Digging returns the piece to the library.',
    '花园加成': 'GARDEN BONUS', '根 graphic': 'ROOT FIGURES', '园子': 'GARDEN',
    '主项：#（#）': 'PEAK # (#)',
    '战斗掉落：辉光 +#% · 尘晶 +#%': 'COMBAT DROPS: Lux +#% · Dust & Crystal +#%',
    '增益：伤害 +#% · 攻速 +#% · 射程 + · 暴击 +%':
      'BUFFS: DMG +#% · RATE +#% · RANGE + · CRIT +%',
    '每具根的边际贡献递减（小于 1 的幂次）——再种一具大的，与把这一具修得更对称，是两个不同的选择。':
      'Every root contributes less than the one before (power below 1) — planting another big one and refining this one are two different choices.',
    /* 本版：计量单位从「整园那一具根」换成「件」，另加苗床 */
    '种下去为战斗做准备：每一件按自己的六项读数给战斗掉落与增益加成。':
      'Plant to prepare for battle: each piece feeds the combat drops and buffs from its own six readings.',
    '件': 'PIECES', '苗床': 'SEEDBED',
    '# / # 格': '# / # cells', '# / #': '# / #', '# 件': '# pcs',
    '# 格 · # 件': '# cells · # pcs', '质变 #': 'TRANSMUTATION #',
    '这一件的主项：#（#）': 'This piece peaks at: # (#)',
    '苗床：最早种下的 # 格，它们的出力额外再给一半——挖走早年的件，后面的件会顶进苗床。':
      'Seedbed: the first # cells planted give half again on top — dig out an early piece and the later ones move up into the seedbed.',
    '有 # 件离了根，出力折半——贴着根种才拿得到全份。':
      '# piece(s) are off-root and give half — plant against the root to collect the full share.',
    '每一格的边际贡献递减（小于 1 的幂次）——再种一具大的，与把这一具修得更对称，是两个不同的选择。':
      'Each extra cell contributes less than the one before (power below 1) — planting another big one and refining this one are two different choices.',
    '这里种不下': 'Cannot plant here',
    '伤害 #% → #%': 'DMG #% → #%', '辉光掉落 #% → #%': 'LUX DROP #% → #%',
    '空格＝种下 · R＝转手上那件 · 点一格＝看那一格':
      'SPACE = plant · R = rotate · click a cell = inspect',
    '库里是空的。': 'The library is empty.', '挖走了。元件回库。': 'Dug out. Piece returned to the library.',
    '先把光标移到花园上，再按空格——落点就是光标那一格。':
      'Move the cursor onto the garden first — SPACE plants on that cell.',
    '种下了。': 'Planted.', '扩圈': 'EXPANDED', '根': 'ROOTS', '再种': 'Plant again',

    /* ---------- 塔防 ---------- */
    '塔防': 'Tower Defense', 'TOWER DEFENSE': 'TOWER DEFENSE',
    '开战': 'Commence', '重开一局': 'New run', '开一局新的': 'Start a new run', '再开一局': 'Run again',
    '下一波预告': 'NEXT WAVE',
    '最前': 'FIRST', '最强': 'STRONGEST', '贴身': 'CLOSEST',
    '# 级': 'LV #', '目标优先级': 'TARGET PRIORITY',
    '升级 # 辉光': 'Upgrade # Lux', '辉光不够': 'Not enough Lux',
    '撤收（返 # 辉光）': 'Withdraw (+# Lux)',
    '摘下这座塔，返六成辉光，塔回军械库。重新部署要再付全价。':
      'Take the tower off the field: 60% Lux back, the tower returns to the armory. Redeploying costs full price.',
    '波与波之间': 'BETWEEN WAVES', '辉光 #': 'Lux #', '# 击杀 · #': '# kills · #', '详情': 'Details',
    '点一座看它': 'Pick one to inspect',
    '不花辉光': 'No Lux',
    '撤离落袋。撑过第 10 波，这一局成了': 'Extracted. Survived wave 10 — this run counts.',
    '撤离了。第 # 波为止': 'Extracted at wave #.',
    '基地失守于第 # 波': 'Base lost at wave #',
    '采集尘 +# · 结晶 +#': 'Dust +# · Crystal +#', '新解锁：': 'Unlocked: ',
    '继续': 'Resume', '暂停': 'Pause', '跳过这一波': 'Skip wave', '下一波': 'Next wave',
    '撤离结算': 'Extract & settle', '1×': '1×', '2×': '2×', '4×': '4×',
    '伤害': 'DMG', '攻速': 'RATE', '射程': 'RANGE', '弹': 'SHOTS', '连锁': 'CHAIN',
    '穿透': 'PIERCE', '溅射': 'SPLASH', '减速': 'SLOW', '击杀': 'KILLS',
    '打到': 'REACHED', '辉光（局内）': 'LUX (IN RUN)', '破盾': 'SHIELDS BROKEN',
    '盾吸收': 'ABSORBED',
    '没有可挑的了——库里的都部署上了': 'Nothing left to pick — everything is deployed',
    '点战场上亮出的格子落塔。': 'Click a highlighted cell to place the tower.',
    '先在上面挑一座塔。': 'Pick a tower above first.',
    '还没部署任何东西': 'Nothing deployed yet',
    '这一局还没有棋盘': 'No board for this run yet',
    '超出战场': 'Outside the field',
    '这一格已经有东西了': 'That cell is taken',
    '路径上建不了塔：火力要覆盖的是路两旁': 'No towers on the path — cover its sides',
    '这一局已经结束了': 'This run is over',
    '军械库里没有这一座': 'No such tower in the armory',
    '这座已经部署过了': 'This tower is already deployed',
    '容机已满：# 座。升级商店的「容机预算」能扩。':
      'Hangar full: # towers. The "Hangar Slots" upgrade widens it.',
    '辉光不够：这一座要 # 辉光，本局还剩 # 辉光':
      'Not enough Lux: this tower needs #, the run has # left',
    '预算不够：这一座要 # 辉光，还剩 # 辉光':
      'Not enough budget: this tower needs #, # left',
    '这一局已经开战，不能再改部署': 'The run has begun — deployment is locked',
    '没有这一座': 'No such tower', '这一局已经开战了': 'This run already started',
    '还没有部署任何东西。': 'Nothing deployed yet.',
    '现在不能推进': 'Cannot advance right now',
    '现在不能升级——要在这一局里（战斗或休整）':
      'Cannot upgrade now — you must be in a run (battle or rest)',
    '没有这座塔': 'No such tower', '到顶了': 'Maxed out',
    '只有波与波之间可以撤离': 'You can only extract between waves',
    '部署阶段请用撤回（全额退款）': 'During deploy use Remove (full refund)',
    '现在没有进行中的一局。': 'No run in progress.',
    '一座塔占一格，建在路径两旁——火力覆盖哪一段路，是这里唯一的摆位学问。':
      'One tower, one cell, built beside the path — which stretch you cover is the whole art of placement.',

    /* ---------- 装配台 ---------- */
    '装配台': 'Assembly Bench', 'ASSEMBLY BENCH': 'ASSEMBLY BENCH',
    '军械库是空的。去图形工坊提交一具图形。':
      'The armory is empty. Forge a figure and submit it.',
    '去图形工坊': 'Go to Workshop',
    '已装': 'FITTED', '装配（# 结晶）': 'Fit (# Crystal)', '当前属性': 'CURRENT STATS',
    '模块已装，不可更换——立场是出发前选的。想换请进化下一座。':
      'A module is fitted and cannot be swapped — the stance is chosen before departure. Evolve another tower to change it.',
    '模块（三选一 · 一次性）': 'MODULES (pick one · one-time)',
    '拆解': 'DISMANTLE',
    '把这座塔拆回 # 枚元件还库（淘汰它，流水仍在）。请不起的塔拆了拼一具小的——局外永远有路。':
      'Dismantle this tower back into # pieces (the submission log keeps the record). A tower you cannot afford can be broken down into a smaller one — there is always a way out.',
    '拆解还料': 'Dismantle to pieces',
    '从军械库淘汰这座塔，它的元件回到库裏。提交流水不受影响。':
      'Drop this tower from the armory; its pieces return to the library. The submission log is untouched.',
    '型': 'FORM', '档': 'TIER', '格数': 'CELLS', '部署成本': 'DEPLOY COST',
    '模块价': 'MODULE PRICE', '已装模块': 'MODULES FITTED',
    '已专精': 'SPECIALISED',
    '要到 # 级才能专精': 'Requires level # to specialise',
    '没有这条专精': 'No such specialisation',
    '这座塔已经专精过了': 'This tower is already specialised',
    '结晶不够：装一块模块要 # 结晶': 'Not enough Crystal: a module costs #',
    '没有这块模块': 'No such module',
    '这座塔已经装过模块了——专精是一次性的': 'This tower already carries a module — one per tower',
    '它正在这一局里站岗，先撤下再装': 'It is standing in this run — withdraw it first',
    '破盾尖锋': 'Shield Breaker', '裂界散射': 'Rift Scatter', '迅捷节律': 'Swift Tempo',
    '穿透 +2+⌊通透×2⌋ · 伤害 +20%': 'PIERCE +2+⌊VOID×2⌋ · DMG +20%',
    '溅射 +1 · 散射 +2+⌊对称⌋': 'SPLASH +1 · SHOTS +2+⌊SYM⌋',
    '攻速 +25% · 减速 +0.10+重复×0.10': 'RATE +25% · SLOW +0.10+REP×0.10',
    '这座塔吃不到这块': 'This tower gains nothing from it',

    /* ---------- 军械库 ---------- */
    '军械库': 'Armory', 'ARMORY': 'ARMORY',
    '站岗中': 'ON DUTY', '淘汰': 'Drop', '在库': 'IN STOCK', '已淘汰': 'DROPPED',
    '在库（#）': 'IN STOCK (#)', '提交流水（#）': 'SUBMISSION LOG (#)',
    '递交过': 'SUBMITTED', '已淘汰累计': 'DROPPED TOTAL',
    '编号即身份：同编号永远是同一座塔。在库能淘汰，流水永不擦。':
      'The serial is the identity: the same serial is always the same tower. Stock can be dropped; the log never is.',
    '它正在这一局里站岗，先撤下再淘汰': 'It is standing in this run — withdraw it first',
    '拆解：# 枚元件还库': 'Dismantled: # pieces returned',

    /* ---------- 测量 ---------- */
    '测量': 'Measure', 'MEASURE': 'MEASURE',
    '全部真算，没有一项是估算。六项质变指标是主角，每项都写着「自己怎么验」，点开看底下判据各读到多少、凭什么。':
      'Everything is computed, nothing is estimated. The six transmutation indices are the leads — each one says how it verifies itself.',
    '质变六项': 'SIX INDICES', '板上的构成': 'WHAT IS ON THE BOARD', '其余系数': 'OTHER COEFFICIENTS',
    '轮廓': 'EDGE', '洞': 'VOID', '连通块': 'COMPONENTS',
    '边': 'EDGE', '怎么验': 'HOW', '权重': 'WEIGHT',
    '六项的加权几何平均': 'Weighted geometric mean of the six',
    '这一项由下面 # 条判据按权重合成，每条都是真算的。':
      'This index is composed of the # criteria below, each weighted and each truly computed.',
    '没有带特质的元件': 'No pieces with traits', '板是空的': 'The board is empty',
    '没有东西可以量。': 'Nothing to measure.', '目标上是空的。': 'The target is empty.',
    '工坊图纸': 'Workshop blueprint', '花园全园': 'Whole garden', '最新进化体': 'Newest evolution',

    /* ---------- 成就 ---------- */
    '成就': 'Achievements', 'META': 'META',
    '首胜': 'FIRST STAND', '对称凯旋': 'SYMMETRY TRIUMPH', '片叶不伤': 'UNTOUCHED',
    '连锁大师': 'CHAIN ADEPT', '诸型皆列': 'ALL FORMS MUSTERED', '质变之心': 'HEART OF CHANGE',
    '花匠之心': 'GARDENER', '开盒之人': 'UNBOXER', '无尽行者': 'ENDLESS WALKER',
    '最好一局': 'BEST RUN', '最高质变度': 'BEST TRANSMUTATION', '最高对称度': 'BEST SYMMETRY',
    '花园最高': 'GARDEN BEST', '型收集': 'FORMS SEEN', '最高波数': 'BEST WAVE',

    /* ---------- 战绩（原第九页「卷宗」并入图鉴） ---------- */
    '第 # 波': 'WAVE #', '基地 #': 'BASE #', '最近记录': 'RECENT LOG', '还没有记录': 'No entries yet',
    '总局数': 'RUNS', '胜场': 'WINS', '留档': 'ARCHIVED',
    '每一局留一笔。种子即身份证：同种子同部署，结果可以逐 tick 复盘。':
      'One line per run. The seed is the identity card: same seed, same deployment, reproducible tick by tick.',
    '存档与重置': 'SAVE & RESET', '去设置页': 'Go to Settings',

    /* ---------- 图鉴（最后一页：十一张表 + 战绩） ---------- */
    '图鉴': 'Codex', 'CODEX': 'CODEX',
    '图形凭什么那么打，一局凭什么那么算：十一张表，一部宪法。':
      'Why shapes fight the way they do and why a run settles the way it does: eleven tables, one constitution.',
    '四本账': 'FOUR LEDGERS', '六项 → 炮塔属性': 'SIX READINGS → TOWER STATS',
    '十八种型': 'EIGHTEEN FORMS', '十一种特质': 'ELEVEN TRAITS', '敌人志': 'BESTIARY',
    /* 敌人志的数值行与三个特殊字段（护盾 / 回血 / 分裂） */
    '生命 # · 速度 # · 单体伤害减免 # · 漏过扣 # · 辉光 #':
      'HP # · SPD # · direct-damage cut # · leak # · lux #',
    '护盾 #（第 # 波起）': 'Shield # (from wave #)',
    '每秒回复 #': 'Regen #/s',
    '死亡时分裂出 # 只#': 'Splits into # # on death',
    '第 # 波入场': 'Enters at wave #',
    /* 波次与缩放 */
    '波次与缩放': 'WAVES & SCALING',
    '入场': 'ENTRY',
    '前十波一种一种放进来，第 11 波起十种全上；每波有一个主题，全局缩放一路往上顶。':
      'The first ten waves bring one enemy at a time; from wave 11 all ten are live. Every wave carries a theme and the global scaling keeps climbing.',
    '（五波一轮，主题那一路数量 ×1.5）': '(cycles every five waves; the themed lane gets ×1.5 count)',
    'HP ×# · 速度 ×# · 辉光 ×#': 'HP ×# · SPD ×# · lux ×#',
    /* 战况九条 */
    '起手就有': 'Available from the start',
    '契约 I 解锁': 'Unlocked by Contract I', '契约 II 解锁': 'Unlocked by Contract II',
    '难度不是一档一档选的，是一张一张勾的：每一条都明码标价一个结算倍率，勾得越狠，尘 / 晶 / 阅历乘得越高。':
      'Difficulty is not picked from a dropdown, it is ticked card by card: each one carries its price in payout percentage — the harsher you tick, the more Dust, Crystal and EXP multiply.',
    /* 战备指令十条 */
    '每打完一波摊三张（重塑「指令扩容」给四张），选一张。每一张都有得有付——得的一半当场生效，一半进下一波。':
      'Three cards per rest (the Remold WIDER TABLE node makes it four). Every card has a gain and a cost — half the gain lands now, the other half shapes the next wave.',
    '起手就在池子里': 'In the pool from the start',
    '高级指令（重塑树解锁）': 'Advanced — unlocked on the Remold tree',
    /* 结算口径 */
    '结算口径': 'SETTLEMENT',
    '阅历逐项': 'EXP, LINE BY LINE',
    '撤离与失守不再是同一笔账；战况倍率三笔一起乘。':
      'Withdraw and lost are no longer the same ledger; the condition multiplier applies to all three.',
    '波数收益全额 · 剩余基地生命每点折算 # 采集尘 · 撑过第 10 波额外 # 结晶 · 阅历全额':
      'Full wave payout · each remaining base HP converts to # Dust · clearing wave 10 adds # Crystal · EXP in full',
    '波数收益只发 # 成（重塑「抚恤」可提到 # 成）· 没有基地折算 · 没有犒赏 · 阅历只记一半':
      'Wave payout at #0% (Remold CONSOLATION raises it to #0%) · no base-HP conversion · no bonus · EXP at half',
    '第 # 波起进入深水区，每波收益再递增 #%（重塑「深水」抬到 #%）——「再撑一波」从这一波起变成真诱惑':
      'Deep water from wave #: every further wave adds #% to the payout (Remold DEEP WATER raises it to #%) — from here on, one more wave is a real temptation',
    '勾选的每一条各加一份百分点，尘 / 晶 / 阅历乘同一个数':
      'Each ticked condition adds its percentage points; Dust, Crystal and EXP multiply by the same number',
    '每波 # · 深水 = 波数^1.35 × # · 每击杀 # · 撑过第 10 波后撤离 # · 失守只记一半':
      'Per wave # · deep water = wave^1.35 × # · per kill # · withdraw after wave 10 # · a lost run records half',
    /* 重塑树一屏 */
    '结晶买数值，阅历登记可能性。花费是阅历，前置只有一个。':
      'Crystal buys numbers, EXP registers possibilities. Everything here costs EXP and has a single prerequisite.',
    '# · 前置：#': '# · requires #', '无': 'none',
    /* 战绩 */
    '战绩': 'RECORD',
    '是': 'YES', '否': 'NO',

    /* ---------- 库 / 商店 ---------- */
    '丢弃': 'Discard', '库存': 'STOCK', '去重': 'UNIQUE', 'STORE': 'STORE',
    '丢弃了一枚。': 'Discarded one.',
    '库里没有符合条件的件。': 'No pieces match.',
    '库里没有符合条件的件。去「库」页抽几发。': 'No pieces match. Draw a few on the Shop page.',
    '抽取': 'DRAW', '抽取 ×1（# 采集尘）': 'Draw ×1 (# Dust)',
    '抽取 ×10（# 采集尘）': 'Draw ×10 (# Dust)',
    '一百抽大约出 # 张华档以上（华 # + 殿 #）。概率随「高档权重」升级与成就当场变化——抽的是什么，写得明明白白。':
      'A hundred draws yield about # Glory-tier or better (Glory # + Myriad #). The odds shift live with the "Rare Odds" upgrade and achievements.',
    '商店': 'Shop', 'SHOP': 'SHOP', '升级商店': 'UPGRADES',
    '层级 # / #': 'LV # / #', '已满': 'MAX', '# 结晶': '# Crystal',
    '采集尘 -#。': 'Dust −#.', '升了一级。': 'Upgraded.', '累计抽取': 'DRAWS',
    '抽取费用 -10%': 'Draws cost 10% less',
    '战斗结算的采集尘 +20%': 'Settlement Dust +20%',
    '华档与殿档的抽取权重 ×1.5（概率条会当场变）':
      'Glory & Myriad draw weight ×1.5 (the odds bar moves live)',
    '战斗中辉光的掉落 +15%': 'Lux drops +15% in battle',
    '战斗结算的结晶 +15%': 'Settlement Crystal +15%',
    '全部塔伤害 +8%': 'All towers +8% damage',
    '全部塔攻速 +6%': 'All towers +6% rate',
    '全部塔射程 +0.4': 'All towers +0.4 range',
    '每局部署预算 +60': '+60 deploy budget per run',
    '每局开始额外白给 +80 部署预算': '+80 extra deploy budget at run start',
    '每局可部署的炮塔上限 +2 座': '+2 tower slots per run',
    '图形工坊的图纸长宽各 +2（基准 14×9）': 'Blueprint +2 in each direction (base 14×9)',
    '单条流对战斗标量的影响上限 +0.03（基准 0.35）':
      'Max influence of one flow +0.03 (base 0.35)',
    '乱流的正向偏移 +8%、逆向偏移 -6%': 'Positive flux deltas +8%, negative −6%',
    '流值饱和点 -0.08（基准 1.6，越低流越响）':
      'Flow saturation point −0.08 (base 1.6 — lower is louder)',
    '唯一入口「外源」读数 +10%（外源不只是吃进度，也能被投资）':
      'The single inlet "Exogen" +10% (it reads progress — and can be invested in)',
    '通胀压力 -12%（倒灌与抽血跟着轻）': 'Inflation pressure −12% (backwash and bleeding ease)',
    '花采集尘抽元件，花结晶买旋钮。概率公示、价格公示——买的是什么，一眼能看清。':
      'Spend Dust to draw pieces, Crystal to buy knobs. Odds and prices are posted — you can see exactly what you buy.',

    /* ---------- 设置 ---------- */
    '设置': 'Settings', 'SETTINGS': 'SETTINGS',
    '这一份进度': 'THIS PROGRESS', '存档': 'SAVE',
    '每一次动手都会自动写入本地存档。这里是手动再写一次，或者把整份进度导出成一段文本带走。':
      'Every action saves automatically. Here you can write once by hand, or export the whole progress as text.',
    '写入存档': 'Write save', '导出为文本': 'Export as text',
    '上面这段就是整份进度。复制走，粘进「导入」就能回来。':
      'That is the whole progress. Copy it — paste it into Import to bring it back.',
    '导入': 'IMPORT',
    '把导出的那段文本粘进来，读回那一份进度（会覆盖当前这一份）。':
      'Paste the exported text to read that progress back (it overwrites the current one).',
    '把导出的存档文本粘在这里': 'Paste the exported save here',
    '读回这一份': 'Read it back',
    '重置': 'RESET',
    '清空进度：局数与战绩、军械库与流水、库存与元件、花园、升级与成就——全部回到起手礼包。这一局若有进行中的，也一并结束。':
      'Wipe progress: runs and records, armory and log, stock and pieces, garden, upgrades and achievements — everything returns to the starter kit. Any run in progress ends too.',
    '重置进度': 'Reset progress',
    '确认重置（不可撤销）': 'Confirm reset (irreversible)',
    '算了': 'Never mind',
    '要清掉的是上面那一整份：局数 #、胜场 #、在库 # 座。':
      'This wipes everything above: # runs, # wins, # towers in stock.',
    '写好了（#）。自动存档一直在跑，这一下是手动的一次。':
      'Written (#). Autosave keeps running; this was a manual one.',
    '存档已写入': 'Save written', '存档已读回': 'Save read back',
    '导出了 # 个字符——复制走，重置之后还能回来。':
      'Exported # characters — copy it and you can come back after a reset.',
    '框里是空的——先把导出的那段文本粘进来。': 'The box is empty — paste the exported text first.',
    '读回来了。': 'Read back.', '读不回来：#': 'Could not read it: #',
    '没动。': 'Left untouched.',
    '清干净了。起手礼包已经放回库里（三枚元件 + 60 采集尘）。':
      'Wiped clean. The starter kit is back in the library (three pieces + 60 Dust).',
    '在庫炮塔': 'TOWERS IN STOCK', '在库炮塔': 'TOWERS IN STOCK',
    '提交流水': 'SUBMISSION LOG', '累计抽卡': 'TOTAL DRAWS',
    '库存元件': 'PIECES IN STOCK', '花园已种': 'GARDEN PLANTED', '上次写入': 'LAST WRITE',
    '语言': 'LANGUAGE', '中文': '中文', 'English': 'English',
    '界面语言。切换之后这一页与全部界面当场改——中文是源，英文是译。':
      'Interface language. Switching re-renders this page and every other one — Chinese is the source, English the translation.',
    '当前语言': 'CURRENT LANGUAGE',
    '入口': 'WHERE', '内容': 'WHAT',

    /* ---------- 其它零散 ---------- */
    '这一页挂了：': 'This page crashed: ',
    '空': 'empty',
    '现在没有进行中的一局': 'No run in progress',
    '取消': 'Cancel',
    '选一座': 'Pick one',
    '# 已进化入库，部署成本 # 辉光': '# evolved into the armory · deploy cost # Lux',
    '序号池 +#': 'Serial pool +#',
    '预算 +#': 'Budget +#',
    '战斗采集尘 +#%': 'Combat Dust +#%',
    '结晶收入 +#%': 'Crystal income +#%',
    '# 特质加权': '# trait-weighted',
    '稀有度 ×#': 'Rarity ×#',
    '去商店花结晶': 'Spend Crystal in the Shop',
    '已载入 # 条译文；查不到的串按原文显示。':
      '# translations loaded; anything missing falls back to the source text.',
    '×': '×',

    /* ---------- 各页的开场白与空状态 ----------
       这些是**跨行拼接**的段落（源码里写成 '…' + '…'），
       所以覆盖门禁的抽取器必须能吃掉拼接链——否则它们永远漏译，
       而漏译恰好发生在每一页最显眼的那一行。 */
    '把元件拼成一具图形——提交之后，它进化为一座只占一格的炮塔，进驻军械库。':
      'Assemble pieces into a figure — submitting evolves it into a one-cell tower that joins the armory.',
    '元件是抽来的，不是查来的。这一页只管「手里还剩什么」——抽卡与升级在商店页。':
      'Pieces are drawn, never looked up. This page answers only "what do I still hold" — drawing and upgrades live on the Shop page.',
    '图形凭什么那么打：五张表，一部宪法。':
      'Why a figure fights the way it does: five tables, one constitution.',
    '种下去为战斗做准备：每具根 graphic 按最突出的读数给战斗掉落与增益加成。':
      'Plant to prepare for battle: every root figure grants drop and buff bonuses from its peak reading.',
    '从军械库挑出进化好的塔，部署在路径两旁。波没有尽头——看你能撑到第几波。':
      'Pick evolved towers from the armory and build them beside the path. The waves never end — see how far you hold.',
    '给进化体装模块：三块各认一种敌人，每块吃一项读数——同一块模块装在不同图形上效果不同。花结晶，一次性。请不起的塔可以拆解还料。':
      'Fit modules onto an evolution: three of them, each answering a different enemy, each eating one reading — the same module behaves differently on a different figure. Crystal, one per tower. A tower you cannot afford can be dismantled back into pieces.',
    '军械库是空的。去图形工坊拼一具图形，提交进化。':
      'The armory is empty. Forge a figure and submit it for evolution.',
    '还没有提交过任何图形。': 'Nothing has been submitted yet.',
    '图形工坊是空的。': 'The workshop is empty.',
    '局外成长只认图形：对称度、质变度、用过的型、连锁击杀。结晶在升级商店花。':
      'Meta growth counts figures only: symmetry, transmutation, forms used, chain kills. Crystal is spent in the Upgrade Shop.',
    '还没有打完的局。': 'No finished runs yet.',
    '进度自动存，这里再手动写一次；要清就清得明白——导出先留一份，重置才有退路。':
      'Progress saves automatically; write once by hand here. And if you wipe, wipe knowingly — export a copy first, so a reset has a way back.',

    '采集尘 / 结晶 / 辉光': 'Dust / Crystal / Lux',
    '原件获取资源': 'source of pieces',
    '局外成长资源': 'meta growth resource',
    '战斗所需资源': 'the resource battle runs on',
    '局外登记资源': 'registration resource',
    '战斗结算按波数（花园的尘晶掉落算在这一档）· 成就 —— 抽取元件的唯一门票':
      'settlement by wave (the garden\u2019s dust/crystal drop lands in this bracket) · achievements — the only ticket to drawing pieces',
    '战斗结算按波数 · 撑过第 10 波犒赏 · 成就 —— 升级商店的唯一门票':
      'settlement by wave · reward for surviving wave 10 · achievements — the only ticket to the Upgrade Shop',
    '击杀掉落（本波缩放加成）—— 局内升级塔，局内生局内死':
      'drops from kills (scaled by wave) — upgrades towers inside a run, and dies with it',
    '战斗结算逐项入账（波数 / 深水 / 击杀 / 撤离犒赏），失守减半 —— 只用于重塑树登记':
      'settlement line by line (waves / deep water / kills / extraction bonus); a lost run records half — spent only on Remold registrations',
    '撑过第 10 波后撤离': 'Extract after surviving wave 10',
    '用一座对称度 ≥ 0.80 的炮塔撑过第 10 波': 'Survive wave 10 with a tower of symmetry ≥ 0.80',
    '撑过第 10 波时基地生命全满': 'Reach wave 10 with the base at full health',
    '单场连锁塔（连锁 ≥ 2）累计击杀 50': '50 kills in one run with chain towers (chain ≥ 2)',
    '部署过 10 种不同的型的炮塔': 'Deploy towers of 10 different forms',
    '单具图形质变度 ≥ 0.85 进化成塔': 'Evolve a figure with transmutation ≥ 0.85',
    '在花园种下一具质变度 ≥ 0.50 的根 graphic': 'Plant a root figure with transmutation ≥ 0.50',
    '累计抽取 20 次': 'Draw 20 times in total',
    '单局撑到第 15 波': 'Reach wave 15 in a single run',
    '# 升到 # 级': '# → level #',
    '第 # 波 · 无限模式': 'WAVE # · ENDLESS',
    '结晶不够：要 # 颗': 'Not enough Crystal: # needed',
    /* ---------- 六项读数：全作最常用的六个词，一处不漏地收在这里 ---------- */
    '任何一条流没有出口，通胀就只是时间问题。接线每拍自己改写自己——你能积累的只有趋势，不是公式。':
      'A flow with no sink is an inflation time bomb. The wiring rewrites itself every beat — what you accumulate is a tendency, never a formula.',
    '辉光产': 'LUX OUT', '敌血': 'ENEMY HP', '射程': 'RANGE', '暴击': 'CRIT', '护盾': 'SHIELD',
    '核': 'NUCLEUS', '胞': 'CELL', '体': 'BODY', '域': 'FIELD', '界': 'REALM', '宙': 'COSM', '穹': 'VAULT',
    '接': 'LINK', '压': 'PRESS',
    '未装模块': 'no module', '吃 # #': '# eats #', '进化体·#': 'EVOLUTION·#',
    '乱流': 'FLUX', '# 条 · 第 # 拍 · 刻度 #': '# wires · beat # · rank #',
    '密度 # · 压 #%': 'density # · press #%',
    '这一屏的每一个数字都过单点收敛 eff()。逆流不是 bug，是语法。':
      'Every number on this screen passes the single-point convergence eff(). Backflow is not a bug, it is grammar.',
    /* 十一特质的说明（图鉴页逐条列出） */
    '电天生走连锁': 'Lightning chains by nature',
    '一簇晶刺散开，单根变细': 'A cluster of shards spreads out; each one is thinner',
    '被看着的东西躲不掉': 'What is being watched cannot escape',
    '虚空吸人': 'The void pulls them in',
    '邻格塔伤害 +10%——全作唯一的光环': 'Neighbouring towers +10% damage — the only aura in the game',
    '神圣几何的伤害修正': 'The damage correction of sacred geometry',
    '自己会开火': 'It fires on its own',
    '颜色散开': 'Colours scatter',
    '命中挂 3 秒持续伤害（每秒 dot/3 点）': 'Hits apply 3 seconds of damage over time',
    '镜面穿射': 'Mirror-piercing shot',
    '轻所以便宜——唯一动成本的特质': 'Light, so it is cheap — the only trait that touches cost',
    /* 十八种型的说明（图鉴页逐条列出） */
    '两根柱子，顶上是一道拱。': 'Two pillars with an arch on top.',
    '本局辉光': 'RUN LUX',
    '（不够）': '(short)', '# 格': '# cells', '# 结晶': '# Crystal', '# 辉光': '# Lux',
    '散射弹': 'SHOTS', '持续伤害': 'DOT', '生命': 'HP', '近战': 'MELEE', '邻格光环': 'AURA',
    '没有这一条升级': 'No such upgrade',
    '对称': 'SYM', '重复': 'REP', '通透': 'VOID', '匀质': 'EVEN', '环络': 'WEAVE', '轮廓': 'EDGE',

    /* ---------- 成就的「还差什么」（带数字，走 fill 模板） ---------- */
    '已达成': 'reached',
    '最好一次撑到第 # 波（目标：撑过第 10 波后撤离）':
      'best so far: wave # (goal: extract after wave 10)',
    '炮塔的最高对称度 # / 0.80': 'best tower symmetry # / 0.80',
    '满基地生命撑过第 10 波（本局剩 #）': 'clear wave 10 with the base full (this run: # left)',
    '连锁塔单场击杀 # / 50': 'chain-tower kills in one run # / 50',
    '部署过的型 # / 10 种': 'forms deployed # / 10',
    '单具图形质变度 # / 0.85': 'single-figure transmutation # / 0.85',
    '花园根 graphic 的最高质变度 # / 0.50': 'best garden root transmutation # / 0.50',
    '累计抽取 # / 20 次': 'draws # / 20',
    '单局最好成绩第 # 波 / 15': 'best single run wave # / 15',

    /* ---------- 图鉴的公式行（数字现算，句子走模板） ---------- */
    '散射弹数 = 1 + ⌊对称 × #⌋': 'SHOTS = 1 + ⌊SYM × #⌋',
    '攻速 = # + # × 重复': 'RATE = # + # × REP',
    '射程 = # + # × 通透；穿透 = ⌊通透 × #⌋': 'RANGE = # + # × VOID; PIERCE = ⌊VOID × #⌋',
    '伤害 = # + # × 匀质': 'DMG = # + # × EVEN',
    '连锁 = ⌊环络 × #⌋；减速 = 环络 × #': 'CHAIN = ⌊WEAVE × #⌋; SLOW = WEAVE × #',
    '近战 = 轮廓 × #；生命 = # + 轮廓 × #': 'MELEE = EDGE × #; HP = # + EDGE × #',
    '# 圈 · # 格': '# rings · # cells',
    '补塔（花本局辉光）': 'Add tower (costs run Lux)',
    '没有这一条升级': 'No such upgrade', '已经到顶了': 'Already maxed',
    '开局': 'OPENING', '循环': 'ECONOMY', '手感': 'HANDLING', '阵型': 'FORMATION',

    /* ---------- 战况 / 战备指令（一局的运营面） ---------- */
    '战况': 'CONDITIONS', '结算倍率': 'PAYOUT', '战况倍率': 'CONDITION',
    '更狠的几条在重塑树的「契约」里': 'Harsher ones live in the Remold tree, under Contracts',
    '战备指令': 'ORDERS', '本波已下令': 'Order issued this wave',
    '得': 'GAIN', '付': 'COST', '下令': 'ISSUE',
    '重掷（还剩 # 次）': 'REDRAW (# left)',
    '第 # 波预告': 'WAVE # FORECAST', '主题': 'THEME',

    /* ---------- 结算：撤离与失守是两笔账 + 阅历登记 ---------- */
    '失守': 'LOST', '撤离': 'WITHDRAWN', '全额': 'FULL',
    '结算口径': 'PAYOUT BASIS', '深水区': 'DEEP WATER', '基地折算': 'BASE HP CASHED IN',
    '阅历 +#：#': 'EXP +#: #', '阅历 #': 'EXP #',
    '波数': 'WAVES', '深水': 'DEPTH', '击杀': 'KILLS', '撤离犒赏': 'WITHDRAW BONUS',

    /* ---------- 重塑页：局外成长 + 重整（手动重置，按下即结算这一局） ---------- */
    '重塑': 'REMOLD', 'REMOLD': 'REMOLD',
    '一局打完记下的阅历，在这里点亮一棵树：多一张指令候选、多三条可勾的战况、失守没那么疼。局面要不要重来，你自己说了算——按下重整，这一局先按它走到第几波结算。':
      'EXP recorded at the end of a run lights a tree here: one more order card, three more conditions to tick, a lost run hurts less. Whether to start the board over is your call — press Rally and the run in progress settles first, at whatever wave it reached.',
    '阅历': 'EXP', '已登记': 'REGISTERED', '重整过': 'RALLIES', '次': 'times', '条': 'nodes',
    '重塑树': 'REMOLD TREE',
    '结晶买的是数值，阅历登记的是可能性——这一页优先给的是「下次可以这样打」。':
      'Crystal buys numbers, EXP registers possibilities — this page hands out new ways to play first.',
    '看成就': 'Achievements',
    '登记（# 阅历）': 'REGISTER (# EXP)', '先登记「#」': 'Register "#" first',
    '登记好了。下一局就能用上。': 'Registered — it applies from the next run on.',
    '没有这一条重塑': 'No such Remold node',
    '登记重塑：#': 'Registered Remold: #',

    /* 重整：**常驻**的那一键。困住不由机器判定，什么时候按由玩家定。 */
    '重整': 'RALLY',
    '当前这一局': 'THIS RUN',
    '没有进行中的一局': 'no run in progress',
    '现在没有进行中的一局，按下就是直接清空局面。':
      'No run in progress — pressing it clears the board outright.',
    '按下重整，这一局先结算：': 'Press Rally and this run settles first:',
    '第 # 波 · # · 阅历 +#': 'WAVE # · # · EXP +#',
    /* 这两条走三元表达式，抽取器看不见——但它们在英文界面上是真会显示的，
       所以照样得有译文。（门禁只查抽得到的键，这一处靠自觉。） */
    '在波与波之间按：与「撤离」同口径——波数收益全额，剩余基地生命折算进尘，阅历记全额。':
      'Pressed between waves: same basis as a Withdrawal — full wave payout, remaining Base HP cashed into Dust, full EXP.',
    '在交战中按：与「失守」同口径——波数收益打折、没有基地折算、阅历记一半。':
      'Pressed mid-fight: same basis as a Loss — wave payout discounted, no Base HP cash-in, half EXP.',
    '重整只清局面：库存、军械库、图纸、花园、这一局与两样资源全部归零。阅历、重塑登记、成就与升级线一笔不动——上一次走到第几步仍然作数。':
      'Rally clears the board only: stock, armory, blueprint, garden, this run and both currencies all reset to zero. EXP, Remold nodes, achievements and upgrades stay exactly as they are — how far you got still counts.',
    '配给是保底不是叠加：这一局结算落袋的比它多就留多的，比它少就把你抬到配给线。':
      'The kit is a floor, not a bonus: whatever this run paid out stays if it beats the kit, otherwise you are lifted to the kit line.',
    '重整配给': 'RALLY KIT', '按已登记': 'PER NODE',
    '重整（清空局面，留下履历）': 'RALLY (CLEAR THE BOARD, KEEP THE RECORD)',
    '确认重整': 'CONFIRM RALLY',
    '要清掉的是局面；这一局按上面那个口径先入账；要发下的是那一笔配给。履历不动。':
      'What goes is the board; this run is booked first on the basis above; what comes is that kit. Your record stays.',
    '重整完毕：这一局按第 # 波（#）结算入账，配给 # 采集尘与 # 结晶。履历一笔没动。':
      'Rally done: the run was booked at wave # (#), # Dust and # Crystal issued. Your record is untouched.',
    '重整完毕：发下 # 采集尘与 # 结晶。履历一笔没动。':
      'Rally done: # Dust and # Crystal issued. Your record is untouched.',
    '重整：第 # 波按#结算入账，局面清空，配给 # 采集尘与 # 结晶':
      'Rally: wave # booked as #, board cleared, kit # Dust and # Crystal',
    '重整：局面清空，配给 # 采集尘与 # 结晶': 'Rally: board cleared, kit # Dust and # Crystal',
    '去重塑页登记': 'Register on the Remold page',
    '去重塑页': 'Remold page',
    '去重塑页重整（保留履历）': 'Rally on the Remold page (keeps your record)',
    '这一局的收成不够再抽一发（# / # 采集尘）': 'This run did not cover another draw (# / # Dust)',
    '军械库是空的：先去工坊拼一具图形、提交进化，才有塔可部署。':
      'The armory is empty: assemble a figure in the workshop and submit it for evolution first — only then is there a tower to deploy.',

    /* ---------- 设置：彻底重置（与重塑页的重整一眼分开） ---------- */
    '彻底重置': 'FULL WIPE',
    '清空进度：局数与战绩、军械库与流水、库存与元件、花园、升级与成就、阅历与重塑登记——全部回到起手礼包。这一局若有进行中的，也一并结束。':
      'Erase everything: runs and record, armory and its ledger, stock and parts, garden, upgrades, achievements, EXP and Remold nodes — all back to the starter kit. Any run in progress ends with it.',
    '只想把局面清掉、留下履历的话，用重塑页的「重整」——它还会把进行中的那一局按当前波数结算入账。':
      'To clear only the board and keep your record, use Rally on the Remold page — it also books the run in progress at its current wave.',

    /* ---------- 重塑树的四个分支 ---------- */
    '启程': 'START', '战备': 'ORDERS', '补给': 'SUPPLY', '结算': 'PAYOUT',

    /* ---------- 舞台与待命（游戏层） ---------- */
    '战场待命': 'ARENA STANDBY',
    '无限模式 · # × #': 'ENDLESS · # × #',
    '开一局：路径会在这一刻由种子铺出来。': 'Start a run: the path is laid from the seed at that moment.',
    '图纸空着': 'SHEET EMPTY',
    '从下面取一件，放在任意一格上——第一件随便放。':
      'Take a part below and drop it on any cell — the first one goes anywhere.',
    '园子空着': 'GARDEN EMPTY',
    '从下面取一件，种在第一格上——贴着已有的件种，出力才是全份。':
      'Take a part below and plant it on the first cell — plant against what is already there, or its yield is halved.'
  });
})(window.BS);
