/* world/mods/codex.js —— 图鉴（**最后一页**）。
   ------------------------------------------------------------------
   十一张表摊平：四本账、六项→塔属性、十八型、十一特质、敌人志、
   波次与缩放、战况、战备指令、结算口径、重塑树、战绩。
   这一页是「元件凭什么那么打、一局凭什么那么算」的完整答案，
   也是唯一把映射规则与结算规则写成一句话的地方。
   改平衡从 world/ 的表改，这里跟着变——**数字一律现算，不抄一份**。

   **本页兼收战绩**（原第九页「卷宗」并入此处）：卷宗撤页之后，
   每一局的记录不能跟着消失——履历是这一部里最不肯丢的东西
   （重塑只清局面不清履历，彻底重置才清）。所以图鉴从「参考书」
   变成最后一页的「档案 + 宪法」：上面十张表回答规则，
   最后一张表回答「我上一局打到哪儿、怎么输的」。

   排序上它垫底是故意的：参考与档案不该挤在工坊与战场之间——
   玩家要看规则的时候是**主动来查**的，那就不该挡在日常动线上。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n, P = BS.parts;

  var host = null, dirty = false, offs = [];

  /* 六项映射：**从 world/towers.js 的表现读**，不在这里抄一份。
     抄一份的后果踩过：系数调了（projStep 3→6、dmg 6→12…），
     图鉴里还写着旧公式——玩家按图鉴算出来的数与实际不符，
     而门禁全是绿的。所以这里全部现算。 */
  function mapTable() {
    var SC = BS.towers.SCALE, BASE = BS.towers.BASE, out = '<div class="ctable">', i;
    var rows = [
      /* 公式也是文案：数字现算，句子走模板——英文界面里这条公式读作
         「SHOTS = 1 + ⌊SYM × 6⌋」，与中文那一行说的是同一件事。 */
      ['sym', I.fill('散射弹数 = 1 + ⌊对称 × #⌋', SC.sym.projStep)],
      ['repeat', I.fill('攻速 = # + # × 重复', BASE.rate, SC.repeat.rate)],
      ['void', I.fill('射程 = # + # × 通透；穿透 = ⌊通透 × #⌋', BASE.range, SC.void.range, SC.void.pierce)],
      ['even', I.fill('伤害 = # + # × 匀质', BASE.dmg, SC.even.dmg)],
      ['weave', I.fill('连锁 = ⌊环络 × #⌋；减速 = 环络 × #', SC.weave.chain, SC.weave.slow)],
      ['edge', I.fill('近战 = 轮廓 × #；生命 = # + 轮廓 × #', SC.edge.melee, BASE.hp, SC.edge.hp)]
    ];
    for (i = 0; i < rows.length; i++) {
      out += '<div class="crow"><b>' + U.esc(H.esName(rows[i][0])) + '</b>' +
        '<span>' + U.esc(rows[i][1]) + '</span></div>';
    }
    out += '</div>';
    return out;
  }

  /* 型的战斗签名：也现读。十八种型各一座塔的人格——
     这一页是玩家唯一能把「型名」翻译成「它大概怎么打」的地方。 */
  var SIG_NAMES = {
    dmgMul: { t: '伤害', en: 'DMG' }, rateMul: { t: '攻速', en: 'RATE' },
    range: { t: '射程', en: 'RANGE' }, proj: { t: '散射弹', en: 'SHOTS' },
    chain: { t: '连锁', en: 'CHAIN' }, splash: { t: '溅射', en: 'SPLASH' },
    pierce: { t: '穿透', en: 'PIERCE' }, slow: { t: '减速', en: 'SLOW' },
    dot: { t: '持续伤害', en: 'DOT' }, hp: { t: '生命', en: 'HP' },
    melee: { t: '近战', en: 'MELEE' }, auraDmg: { t: '邻格光环', en: 'AURA' }
  };
  function sigText(sig) {
    var out = [], k;
    for (k in sig) {
      var nm = I.term(SIG_NAMES[k] || { t: k, en: k });
      if (k === 'dmgMul' || k === 'rateMul') out.push(nm + ' ×' + sig[k].toFixed(2));
      else out.push(nm + ' +' + sig[k]);
    }
    return out.join(' · ');
  }
  function formTable() {
    var out = '<div class="ctable">', i, f;
    for (i = 0; i < P.FORMS.length; i++) {
      f = P.FORMS[i];
      out += '<div class="crow"><b>' + U.esc(f.sym + ' ' + I.term(f)) + '</b>' +
        '<span>' + U.esc(sigText(f.sig)) + '</span></div>';
    }
    return out + '</div>';
  }

  function traitTable() {
    var out = '<div class="ctable">', i, t;
    for (i = 0; i < P.TRAITS.length; i++) {
      t = P.TRAITS[i];
      out += '<div class="crow"><b>' + U.esc(t.sym + ' ' + I.term(t)) + '</b>' +
        '<span>' + U.esc(I.term(t, 'd')) + '</span></div>';
    }
    out += '</div>';
    return out;
  }

  /* 敌人从第几波进场：**从波次表读**，不在这里抄一份。
     扫 comp(0, n) 找第一次出现——种子固定为 0，而抖动只改数量
     不改有无（骨架里每路至少 1），所以这个扫描是稳的。 */
  function entryWave(id) {
    var n, i, c;
    for (n = 1; n <= 30; n++) {
      c = BS.waves.comp(0, n);
      for (i = 0; i < c.length; i++) if (c[i].id === id) return n;
    }
    return 1;
  }

  /* 敌人志：数值 + 入场波 + 它的解。
     regen / split / 护盾都落成一句话——表里写得清清楚楚，
     界面上就该看得见；藏起来的字段等于不存在。 */
  function enemyTable() {
    var EN = BS.enemies, out = '<div class="ctable">', i, e, sp;
    /* 按**入场波数**排，不按表的声明序：这一页的敌人志要能当
       「什么时候会遇见谁」读，与下面波次表那一行同一个次序。 */
    var es = EN.ENEMIES.slice().sort(function (a, b) { return entryWave(a.id) - entryWave(b.id); });
    for (i = 0; i < es.length; i++) {
      e = es[i];
      out += '<div class="crow"><b>' + U.esc(I.term(e)) + '</b><span>' +
        U.esc(T('生命 # · 速度 # · 单体伤害减免 # · 漏过扣 # · 辉光 #')
          .replace('#', e.hp).replace('#', e.speed)
          .replace('#', e.singleMul).replace('#', e.leak).replace('#', e.lux));
      sp = [];
      if (e.sh) sp.push(T('护盾 #（第 # 波起）').replace('#', e.sh).replace('#', EN.SHIELD_FROM));
      if (e.regen) sp.push(T('每秒回复 #').replace('#', e.regen));
      if (e.split) sp.push(T('死亡时分裂出 # 只#').replace('#', e.split.n).replace('#', I.term(EN.get(e.split.id))));
      if (sp.length) out += ' · ' + U.esc(sp.join(' · '));
      out += '</span>' +
        /* 每一种敌人的**解**写在它自己那一行：图鉴是宪法，
           宪法只列数值的话，玩家还是得靠死几次才记得住谁怕什么。 */
        '<i>' + U.esc(I.fill('第 # 波入场', entryWave(e.id)) + ' · ' + I.term(e, 'd')) + '</i></div>';
    }
    out += '</div>';
    return out;
  }

  /* 四本账：尘 / 晶 / 辉光 / 阅历。前三行是旧版就有的，
     阅历这一行是新的——**它只在重塑树里花**，所以单独一本。 */
  function resTable() {
    var rows = [
      ['采集尘', '原件获取资源', '战斗结算按波数（花园的尘晶掉落算在这一档）· 成就 —— 抽取元件的唯一门票'],
      ['结晶', '局外成长资源', '战斗结算按波数 · 撑过第 10 波犒赏 · 成就 —— 升级商店的唯一门票'],
      ['辉光', '战斗所需资源', '击杀掉落（本波缩放加成）—— 局内升级塔，局内生局内死'],
      ['阅历', '局外登记资源', '战斗结算逐项入账（波数 / 深水 / 击杀 / 撤离犒赏），失守减半 —— 只用于重塑树登记']
      /* 这几行是**数据**，但每一格都要过 T()：表格里的中文和正文里的中文
         一样会漏进英文界面，而它恰好是这一页最正面的一张表。
         ⚠ 这一张表的串是**装在数组里**喂给 T(rows[i][2]) 的，覆盖门禁的
         抽取器看不见它们（它只认 T('字面量')）——所以守这四行译文的是
         **界面门禁的逐页汉字扫描**，不是覆盖检查。加第五本账的时候，
         两条门禁都要过一遍，别只跑 npm test 的第一道。 */
    ];
    var out = '<div class="ctable">', i;
    for (i = 0; i < rows.length; i++) {
      out += '<div class="crow"><b>' + U.esc(T(rows[i][0])) + ' · ' + U.esc(T(rows[i][1])) + '</b>' +
        '<span>' + U.esc(T(rows[i][2])) + '</span></div>';
    }
    return out + '</div>';
  }

  /* 波次与缩放：曲线现算（scale 是函数，不是抄下来的数），
     主题轮换与入场波从波次表读。 */
  function waveTable() {
    var EN = BS.enemies, out = '<div class="ctable">', i, e;
    /* 入场：按波数排，不按表的声明序 */
    var es = EN.ENEMIES.slice().sort(function (a, b) { return entryWave(a.id) - entryWave(b.id); });
    var ent = [];
    for (i = 0; i < es.length; i++) ent.push(entryWave(es[i].id) + ' ' + I.term(es[i]));
    out += '<div class="crow"><b>' + U.esc(T('入场')) + '</b><span>' + U.esc(ent.join(' · ')) + '</span></div>';
    /* 主题：五波一轮，名字从 flavorName 读 */
    var fl = [], k;
    for (k = 0; k < BS.waves.FLAV.length; k++) fl.push(I.term(BS.waves.flavorName(11 + k)));
    out += '<div class="crow"><b>' + U.esc(T('主题')) + '</b><span>' + U.esc(fl.join(' · ') + ' ' + T('（五波一轮，主题那一路数量 ×1.5）')) + '</span></div>';
    /* 缩放：挑几个波数现算给眼睛看 */
    var ws = [1, 5, 10, 15, 20, 30], n, sc;
    for (i = 0; i < ws.length; i++) {
      n = ws[i]; sc = BS.waves.scale(n);
      out += '<div class="crow"><b>' + U.esc(I.fill('第 # 波', n)) + '</b><span>' +
        U.esc(I.fill('HP ×# · 速度 ×# · 辉光 ×#', sc.hp.toFixed(2), sc.spd.toFixed(2), sc.lux.toFixed(2))) +
        '</span></div>';
    }
    return out + '</div>';
  }

  /* 战况：九条加压项。每条的**价格**（结算倍率）与解锁条件都写在行里——
     难度是自己勾的，所以勾之前必须知道每一条卖多少钱。 */
  function condTable() {
    var out = '<div class="ctable">', i, c, lock;
    var LOCK = ['起手就有', '契约 I 解锁', '契约 II 解锁'];
    for (i = 0; i < BS.cond.LIST.length; i++) {
      c = BS.cond.LIST[i];
      lock = LOCK[c.tier | 0] || LOCK[0];
      out += '<div class="crow c3"><b>' + U.esc(I.term(c)) + '</b>' +
        '<span class="cv">+' + c.mul + '%</span>' +
        '<span>' + U.esc(I.term(c, 'd')) + '</span>' +
        '<i>' + U.esc(T(lock)) + '</i></div>';
    }
    return out + '</div>';
  }

  /* 战备指令：十条，得与付并排写。没有白给的选项——
     这一页要让玩家在**开局之前**就看见每一张卡的代价。 */
  function orderTable() {
    var out = '<div class="ctable">', i, o, note;
    for (i = 0; i < BS.orders.LIST.length; i++) {
      o = BS.orders.LIST[i];
      note = (o.tier | 0) ? '高级指令（重塑树解锁）' : '起手就在池子里';
      out += '<div class="crow c3"><b>' + U.esc(I.term(o)) + '</b>' +
        '<span class="cv">' + U.esc(T(note)) + '</span>' +
        '<span>' + U.esc(T('得') + ' ' + I.term(o.give) + ' · ' + T('付') + ' ' + I.term(o.pay)) + '</span>' +
        '</div>';
    }
    return out + '</div>';
  }

  /* 结算口径：撤离与失守是两本账。数字全部从 PAY / EXP 现读——
     这里是玩家唯一能核对「我这一局到底怎么算的」的地方。 */
  function settleTable() {
    var P2 = BS.metaDefs.PAY, E2 = BS.metaDefs.EXP;
    var rows = [
      ['撤离', I.fill('波数收益全额 · 剩余基地生命每点折算 # 采集尘 · 撑过第 10 波额外 # 结晶 · 阅历全额',
        P2.HP_BONUS, P2.WON_BONUS_CRYSTAL)],
      ['失守', I.fill('波数收益只发 # 成（重塑「抚恤」可提到 # 成）· 没有基地折算 · 没有犒赏 · 阅历只记一半',
        P2.LOST_RATE * 10, 7.5)],
      ['深水区', I.fill('第 # 波起进入深水区，每波收益再递增 #%（重塑「深水」抬到 #%）——「再撑一波」从这一波起变成真诱惑',
        P2.DEPTH_FROM, Math.round(P2.DEPTH_STEP * 100), 9)],
      ['战况倍率', I.fill('勾选的每一条各加一份百分点，尘 / 晶 / 阅历乘同一个数')],
      ['阅历逐项', I.fill('每波 # · 深水 = 波数^1.35 × # · 每击杀 # · 撑过第 10 波后撤离 # · 失守只记一半',
        E2.PER_WAVE, E2.DEPTH_MUL, E2.PER_KILL, E2.WON)]
      /* 每一行的值都在**进数组之前**取好词（fill 即翻译）：
         渲染时直接 U.esc。混着来（有的译好了有的没有）就会漏——
         上面那张资源表已经用注释钉住了这个坑。 */
    ];
    var out = '<div class="ctable">', i;
    for (i = 0; i < rows.length; i++) {
      out += '<div class="crow"><b>' + U.esc(T(rows[i][0])) + '</b>' +
        '<span>' + U.esc(rows[i][1]) + '</span></div>';
    }
    return out + '</div>';
  }

  /* 重塑树：二十个节点一屏摊平。花费（阅历）与前置都写在行里——
     这一屏是「局外成长到底给了什么」的总账。 */
  function shapeTable() {
    var S = BS.metaDefs.SHAPING, out = '<div class="ctable">', i, s, req;
    for (i = 0; i < S.length; i++) {
      s = S[i];
      req = s.req ? BS.metaDefs.SHAPE_BY[s.req] : null;
      out += '<div class="crow c3"><b>' + U.esc(I.term(s)) + '</b>' +
        '<span class="cv">' + U.n0(s.cost) + '</span>' +
        '<span>' + U.esc(I.term(s, 'd')) + '</span>' +
        '<i>' + U.esc(I.fill('# · 前置：#', T(s.br), req ? I.term(req) : T('无'))) + '</i></div>';
    }
    return out + '</div>';
  }

  /* 战绩：原卷宗页的那一张表。种子是这一局的完整身份证——
     同种子同部署，战斗逐 tick 可复现，所以「那一局到底怎么输的」
     在这作里是一个能回答的问题。 */
  function recordTable() {
    var m = B.state.meta, runs = m.history || [], i;
    var out = '<div class="statline">' +
      H.kv('总局数', U.n0(m.runs | 0)) +
      H.kv('胜场', U.n0(m.wins | 0)) +
      H.kv('留档', U.n0(runs.length)) +
      '</div>';
    if (!runs.length) return out + H.empty('还没有打完的局。');
    out += '<div class="rtable">';
    for (i = 0; i < runs.length; i++) {
      var r = runs[i], k = r.kills || {}, ks = [], kk;
      for (kk in k) ks.push(kk + '×' + k[kk]);
      out += '<div class="rrow' + (r.won ? ' won' : '') + '">' +
        '<span class="rw">' + (r.won ? '胜' : '败') + '</span>' +
        '<span class="rv">' + U.esc(I.fill('第 # 波', r.wave)) + '</span>' +
        '<span class="rb">' + U.esc(I.fill('基地 #', r.baseHp)) + '</span>' +
        '<span class="rl">' + U.n0(r.lux) + ' ' + U.esc(T('辉光')) + '</span>' +
        '<span class="rs">' + U.esc(ks.join(' ') || '—') + '</span>' +
        /* 阅历与口径：战绩是**履历**，而履历要能回答
           「那一局我拿了多少、是走着出来的还是被打出来的」。 */
        '<span class="re">' + U.esc(I.fill('阅历 #', U.n0(r.exp || 0))) +
        (r.lost ? ' <em class="dn">' + U.esc(T('失守')) + '</em>' : '') +
        ((r.mul != null && r.mul > 1.001) ? ' <em class="up">×' + r.mul.toFixed(2) + '</em>' : '') +
        '</span>' +
        '<span class="rd">#' + U.esc(String(r.seed)) + '</span>' +
        '</div>';
    }
    out += '</div>';
    return out;
  }

  function render() {
    if (!host) return;
    var out = H.head('图鉴', 'CODEX',
      '图形凭什么那么打，一局凭什么那么算：十一张表，一部宪法。') +
      '<div class="subhead">' + U.esc(T('四本账')) + '</div>' + resTable() +
      '<div class="subhead">' + U.esc(T('六项 → 炮塔属性')) + '</div>' + mapTable() +
      '<div class="subhead">' + U.esc(T('十八种型')) + '</div>' + formTable() +
      '<div class="subhead">' + U.esc(T('十一种特质')) + '</div>' + traitTable() +
      '<div class="subhead">' + U.esc(T('敌人志')) + '</div>' + enemyTable() +
      '<div class="subhead">' + U.esc(T('波次与缩放')) + '</div>' +
      H.note('前十波一种一种放进来，第 11 波起十种全上；每波有一个主题，全局缩放一路往上顶。') +
      waveTable() +
      '<div class="subhead">' + U.esc(T('战况')) + '</div>' +
      H.note('难度不是一档一档选的，是一张一张勾的：每一条都明码标价一个结算倍率，勾得越狠，尘 / 晶 / 阅历乘得越高。') +
      condTable() +
      '<div class="subhead">' + U.esc(T('战备指令')) + '</div>' +
      H.note('每打完一波摊三张（重塑「指令扩容」给四张），选一张。每一张都有得有付——得的一半当场生效，一半进下一波。') +
      orderTable() +
      '<div class="subhead">' + U.esc(T('结算口径')) + '</div>' +
      H.note('撤离与失守不再是同一笔账；战况倍率三笔一起乘。') +
      settleTable() +
      '<div class="subhead">' + U.esc(T('重塑树')) + '</div>' +
      H.note('结晶买数值，阅历登记可能性。花费是阅历，前置只有一个。') +
      shapeTable() +
      '<div class="subhead">' + U.esc(T('战绩')) + '</div>' +
      H.note('每一局留一笔。种子即身份证：同种子同部署，结果可以逐 tick 复盘。') +
      recordTable() +
      '<div class="subhead">' + U.esc(T('最近记录')) + '</div><div class="loglist">';

    var lg = B.state.log, n = Math.min(lg.length, 30), i;
    for (i = 0; i < n; i++) out += '<div class="lrow2">' + U.esc(lg[lg.length - n + i].m) + '</div>';
    if (!n) out += '<div class="dim">' + U.esc(T('还没有记录')) + '</div>';
    out += '</div>';
    /* 存档与重置归设置页一处管——这里留一颗指路钮，
       免得玩家按老印象来这一页找「存档」。 */
    out += '<div class="ff"><span class="fl">' + U.esc(T('存档与重置')) + '</span>' +
      H.btn('goSettings', T('去设置页'), 'ghost small') + '</div>';
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    /* 这一页只读：跳去设置页那一颗是唯一的外链 */
    U.act(host, function (a) {
      if (a === 'goSettings' && BS.app && BS.app.go) BS.app.go('settings');
    });
  }

  BS.reg.add({
    id: 'codex', n: '12', t: '图鉴', sub: 'CODEX',
    mount: function (h) {
      host = h; dirty = false;
      offs.push(B.on('restore', function () { render(); }));
      offs.push(B.on('run', function () { render(); }));
      offs.push(B.on('rally', function () { render(); }));
      offs.push(B.on('log', function () { dirty = true; }));
      render();
    },
    tick: function () { if (host && dirty) { dirty = false; render(); } },
    unmount: function () {
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      host = null;
    }
  });
})(window.BS);
