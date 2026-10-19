/* world/mods/settings.js —— 设置。
   ------------------------------------------------------------------
   这一页只回答两件事：**进度怎么存**、**怎么把它清掉**。
   它们原先散在别处——「存档」挂在顶栏、「清空存档」埋在当年的卷宗页
   （那一页已经撤了，战绩并入图鉴）而且点一下就直接清（没有二次确认，
   也没有一句「你在清掉什么」）。
   搬到这里是为了三件事：
     · **一处**：存档与重置只有一个家，不散在顶栏与记录页两处。
     · **看得见**：重置之前先把这一份进度摊出来（局数 / 胜场 / 最高波 /
       在库 / 结晶），玩家知道自己要删的是什么，而不是点一个红按钮赌一把。
     · **回得来**：导出把存档变成一段文本，导入把它读回来——
       重置因此不再是一次不可逆的事故。这一部的一切都由种子推出，
       所以一段文本就足以复活整份进度。
   自动存档照旧：每次动手都会写（bus.save），这里的「写入存档」是
   手动再写一次 + 给一个可见的时间戳，不是唯一的一次写。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n;

  var host = null, dirty = false, offs = [];
  var arm = false;          /* 重置的二次确认：第一次点只是亮出确认钮 */
  var exp = '';             /* 导出结果：摆在只读框里供复制 */
  var note = '';            /* 这一页自己的一句话回执 */

  function mark() { dirty = true; }

  function when(ts) {
    var d;
    try { d = new Date(ts || 0); } catch (e) { return '—'; }
    if (!(d.getTime() > 0)) return '—';
    var p = function (v) { return v < 10 ? '0' + v : String(v); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 这一份进度长什么样：重置之前必须先看见它 */
  function progress() {
    var s = B.state, m = s.meta || {};
    return {
      runs: m.runs | 0, wins: m.wins | 0,
      best: (m.best && m.best.waves) | 0,
      armory: (s.armory || []).length,
      log: (s.armoryLog || []).length,
      draws: m.draws | 0,
      inv: (s.inv || []).length,
      dust: s.dust | 0, crystal: s.crystal | 0,
      garden: s.garden ? Object.keys(s.garden.cells || {}).length : 0,
      /* 时间戳**不能过 | 0**：它是 13 位毫秒，按 32 位截断会变成 1970 年
         （这个 bug 是截图逮到的——数字对得上「不抛」，只有眼睛看得出不对）。 */
      at: s.at
    };
  }

  function render() {
    if (!host) return;
    var g = progress();
    var out = H.head('设置', 'SETTINGS',
      '进度自动存，这里再手动写一次；要清就清得明白——导出先留一份，重置才有退路。');

    /* ---------- 语言 ----------
       语言层是「中文即键」：界面里写的是 T('战斗')，那个串就是键。
       所以这里只切偏好 + 广播——**重进当前页**由 app 负责，
       它让十二页的每一处取词在重画时重新落一次。 */
    out += '<div class="subhead">' + U.esc(T('语言')) + '</div><div class="statline">' +
      H.kv('当前语言', '<b>' + U.esc(I.langName()) + '</b>') +
      '</div><div class="ff">';
    var ls = I.langs();
    for (var li = 0; li < ls.length; li++) {
      out += H.btnR('lang:' + ls[li].code, ls[li].name,
        I.lang === ls[li].code ? 'on' : 'ghost', !ls[li].ready);
    }
    out += '</div><p class="note">' +
      U.esc(T('界面语言。切换之后这一页与全部界面当场改——中文是源，英文是译。')) + '</p>';
    /* 词典体积：一句实话，也是给译者的进度条。
       覆盖率由门禁独立算（只有它抽得到源码里的全部键），这里不假装知道总数。 */
    if (I.lang !== 'zh') {
      out += '<p class="note">' + U.esc(T('已载入 # 条译文；查不到的串按原文显示。')
        .replace('#', I.dictSize())) + '</p>';
    }

    out += '<div class="subhead">' + U.esc(T('这一份进度')) + '</div><div class="statline">' +      H.kv('总局数', U.n0(g.runs)) +
      H.kv('胜场', U.n0(g.wins)) +
      H.kv('最高波数', U.n0(g.best)) +
      H.kv('在库炮塔', U.n0(g.armory)) +
      H.kv('提交流水', U.n0(g.log)) +
      H.kv('累计抽卡', U.n0(g.draws)) +
      '</div><div class="statline">' +
      H.kv('库存元件', U.n0(g.inv)) +
      H.kv('采集尘', U.n0(g.dust)) +
      H.kv('结晶', U.n0(g.crystal)) +
      H.kv('花园已种', U.n0(g.garden)) +
      H.kv('上次写入', U.esc(when(g.at))) +
      '</div>';

    out += '<div class="subhead">' + U.esc(T('存档')) + '</div>' +
      '<p class="note">' + U.esc(T('每一次动手都会自动写入本地存档。这里是手动再写一次，或者把整份进度导出成一段文本带走。')) + '</p>' +
      '<div class="ff">' +
      H.btn('save', T('写入存档'), 'on') +
      H.btn('export', T('导出为文本'), 'ghost') +
      '</div>';
    if (exp) {
      out += '<div class="ff"><textarea class="impbox" id="expbox" readonly rows="3">' + U.esc(exp) + '</textarea></div>' +
        '<p class="note">' + U.esc(T('上面这段就是整份进度。复制走，粘进「导入」就能回来。')) + '</p>';
    }
    out += '<div class="subhead">' + U.esc(T('导入')) + '</div>' +
      '<p class="note">' + U.esc(T('把导出的那段文本粘进来，读回那一份进度（会覆盖当前这一份）。')) + '</p>' +
      '<div class="ff"><textarea class="impbox" id="impbox" rows="3" placeholder="' +
      U.esc(T('把导出的存档文本粘在这里')) + '"></textarea>' +
      H.btn('import', T('读回这一份'), 'ghost') + '</div>';

    /* 两种重置必须一眼分得开：
         · **彻底重置**（这一页）——连履历一起清：阅历、重塑登记、成就、升级线全没。
         · **重整**（重塑页）——只清局面，履历留下；那是玩法的一部分，不是运维。
       埋在同一个词底下的两种清零，是最容易酿成事故的那一类界面。 */
    out += '<div class="subhead">' + U.esc(T('彻底重置')) + '</div>' +
      '<p class="note">' + U.esc(T('清空进度：局数与战绩、军械库与流水、库存与元件、花园、升级与成就、阅历与重塑登记——全部回到起手礼包。这一局若有进行中的，也一并结束。')) + '</p>' +
      '<p class="note">' + U.esc(T('只想把局面清掉、留下履历的话，用重塑页的「重整」——它还会把进行中的那一局按当前波数结算入账。')) + '</p>' +
      '<div class="ff">' + H.btn('go:shaping', T('去重塑页重整（保留履历）'), 'ghost') + '</div>';
    if (!arm) {
      out += '<div class="ff">' + H.btn('reset', T('彻底重置'), 'ghost') + '</div>';
    } else {
      out += '<div class="ff">' +
        H.btn('resetYes', T('确认重置（不可撤销）'), 'x') +
        H.btn('resetNo', T('算了'), 'ghost') + '</div>' +
        '<p class="note">' + U.esc(T('要清掉的是上面那一整份：局数 #、胜场 #、在库 # 座。')) 
          .replace('#', U.n0(g.runs)).replace('#', U.n0(g.wins)).replace('#', U.n0(g.armory)) + '</p>';
    }
    if (note) out += '<p class="note">' + U.esc(note) + '</p>';

    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('go:') === 0) { BS.app.go(a.slice(3)); return; }
      if (a.indexOf('lang:') === 0) {
        var code = a.slice(5);
        I.setLang(code);                       /* 先切（它只管翻译） */
        B.state.prefs.lang = I.lang;
        B.save();
        B.emit('lang');                        /* 再广播：app 会重进当前页 */
        render();                              /* 本地也重画一次，防 app 不在 */
        return;
      }
      if (a === 'save') {
        B.save();
        note = T('写好了（#）。自动存档一直在跑，这一下是手动的一次。').replace('#', when(B.state.at));
        B.log(T('存档已写入'), 'sys');
        render(); return;
      }
      if (a === 'export') {
        exp = B.encode();
        note = T('导出了 # 个字符——复制走，重置之后还能回来。').replace('#', exp.length);
        render(); return;
      }
      if (a === 'import') {
        var box = host.querySelector('#impbox');
        var txt = box ? String(box.value || '').trim() : '';
        if (!txt) { note = T('框里是空的——先把导出的那段文本粘进来。'); render(); return; }
        var o = B.restore(txt);
        note = o.ok ? T('读回来了。') : T('读不回来：#').replace('#', o.why || '');
        if (o.ok) B.log(T('存档已读回'), 'sys');
        render(); return;
      }
      if (a === 'reset') { arm = true; note = ''; render(); return; }
      if (a === 'resetNo') { arm = false; note = T('没动。'); render(); return; }
      if (a === 'resetYes') {
        arm = false; exp = '';
        B.wipe();
        note = T('清干净了。起手礼包已经放回库里（三枚元件 + 60 采集尘）。');
        render(); return;
      }
    });
  }

  BS.reg.add({
    id: 'settings', n: '11', t: '设置', sub: 'SETTINGS',
    mount: function (h) {
      host = h; dirty = false; arm = false; note = '';
      offs.push(B.on('restore', function () { render(); }));
      render();
    },
    tick: function () { if (host && dirty) { dirty = false; render(); } },
    unmount: function () {
      arm = false;                 /* 离页就把确认收起来，不存在「回来还是确认态」 */
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      host = null;
    }
  });
})(window.BS);
