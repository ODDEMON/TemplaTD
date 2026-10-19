/* world/mods/shaping.js —— 重塑：局外成长 + 重整（手动重置）。
   ------------------------------------------------------------------
   这一页管两件事，两件事其实是同一件事的两头：
     · **阅历登记**：一局打完记下的点数，在这里点亮一棵树。
       树上的节点优先是**横向解锁**（多一张指令候选、多三条可勾的战况、
       失守不再那么疼），其次才是纵向数值。给「下次可以这样打」
       比给「+10% 伤害」更值钱——这是《明日方舟》集成战略的
       「认知塑造」真正好用的那一半。
     · **重整**：把局面清掉重来，履历留下。

   **为什么不再由机器判定「困住」**（本版改掉的一条）：
   上一版用 `stuck()` 去认那一个死结形状（没件 + 没塔 + 尘不够抽一发），
   那是**机器替玩家下判断**。它能认的形状只有一个，而玩家不想再打下去的
   局面有一百种：手里剩一堆拼不出东西的废件、塔都在但这一套打法已经腻了、
   或者只是想换一种活法。认不出来的那些，界面就一声不吭——
   而玩家其实早就想重来了。

   所以现在：这一键**常驻**，什么时候按由玩家决定。界面只做两件事——
   把代价写清楚、把这一局按下之后按什么口径结算写清楚。
   **按下即结算这一局**：进行中的那一局按它现在走到第几波入账
   （休整期按撤离口径、交战中按失守口径），再清局面。打了一半按重置
   不再等于白打——「这一局打到第 11 波」照样进阅历、进战绩。

   为什么重置要搬进玩法而不是留在设置里：
     · 它**是玩法的一部分**，不是运维。想把局面推倒重来是一种游戏状态，
       那个状态该有一个出口，而出口长在游戏里才找得到。
     · 它必须**看得见代价与回报**：清掉什么、留下什么、这一局按什么口径
       结算、发下多少配给，四件事写在同一张卡上。埋在设置页的一个红按钮
       不告诉你这些。
     · 设置页那一个改名「彻底重置」——那是真清零（履历也不留），
       两种重置必须一眼分得开。

   二次确认照规矩来：第一次点只是亮出确认钮。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util, B = BS.bus, H = BS.ui, T = H.T, I = BS.i18n;

  var host = null, dirty = false, offs = [];
  var arm = false;              /* 重整的二次确认 */
  var note = '';

  /* ---------- 这一局按下之后怎么结算 ----------
     口径跟着**当前状态**走，不给额外便宜：休整期是撤离，交战中是失守。
     这一段只是**预告**：真正的账在 core/meta.js 的 rally() 里结，
     两边读的是同一个 expOf、同一条口径，所以预告不会与结算对不上。 */
  function pending() {
    var r = BS.run ? BS.run.current() : null;
    if (!r || r.phase === 'over' || !r.battle || (r.battle.wave | 0) < 1) return null;
    var voluntary = r.phase === 'rest';
    var kills = 0, k;
    for (k in r.battle.kills) kills += r.battle.kills[k] | 0;
    var won = !!(voluntary && r.battle.wave >= BS.run.WON_WAVE && r.battle.baseHp > 0);
    var e = BS.meta.expOf({
      wave: r.battle.wave, kills: kills, won: won,
      lost: !voluntary, mul: BS.run.gradeMul(r)
    });
    return { wave: r.battle.wave, voluntary: voluntary, exp: e.total, hp: Math.max(0, r.battle.baseHp | 0) };
  }

  /* ---------- 重整：常驻的那一键 ---------- */
  function resetBox() {
    var kit = BS.meta.rallyKit();
    var p = pending();
    var out = '<div class="pv">' +
      '<div class="pvhead"><b>' + U.esc(T('重整')) + '</b>' +
      H.kvR(T('当前这一局'), p
        ? U.esc(I.fill('第 # 波', p.wave)) + ' · ' + U.esc(T(p.voluntary ? '撤离' : '失守'))
        : U.esc(T('没有进行中的一局'))) +
      '</div>';
    if (p) {
      out += '<p class="note">' + U.esc(T('按下重整，这一局先结算：')) + ' ' +
        U.esc(I.fill('第 # 波 · # · 阅历 +#', p.wave, T(p.voluntary ? '撤离' : '失守'), U.n0(p.exp))) + '</p>';
      out += '<p class="note">' + U.esc(T(p.voluntary
        ? '在波与波之间按：与「撤离」同口径——波数收益全额，剩余基地生命折算进尘，阅历记全额。'
        : '在交战中按：与「失守」同口径——波数收益打折、没有基地折算、阅历记一半。')) + '</p>';
    } else {
      out += '<p class="note">' + U.esc(T('现在没有进行中的一局，按下就是直接清空局面。')) + '</p>';
    }
    out += '<p class="note">' + U.esc(T('重整只清局面：库存、军械库、图纸、花园、这一局与两样资源全部归零。阅历、重塑登记、成就与升级线一笔不动——上一次走到第几步仍然作数。')) + '</p>';
    out += '<div class="statline">' +
      H.kv('重整配给', '<b>' + U.n0(kit.dust) + '</b> ' + U.esc(T('采集尘')) + ' · <b>' +
        U.n0(kit.crystal) + '</b> ' + U.esc(T('结晶'))) +
      H.kv('按已登记', U.n0(kit.nodes) + ' ' + U.esc(T('条'))) +
      '</div>';
    out += '<p class="note">' + U.esc(T('配给是保底不是叠加：这一局结算落袋的比它多就留多的，比它少就把你抬到配给线。')) + '</p>';
    out += '</div>';
    if (!arm) {
      out += '<div class="ff">' + H.btn('rally', T('重整（清空局面，留下履历）'), 'x') + '</div>';
    } else {
      out += '<div class="ff">' +
        H.btn('rallyYes', T('确认重整'), 'x') +
        H.btn('rallyNo', T('算了'), 'ghost') + '</div>' +
        '<p class="note">' + U.esc(T('要清掉的是局面；这一局按上面那个口径先入账；要发下的是那一笔配给。履历不动。')) + '</p>';
    }
    return out;
  }

  /* ---------- 重塑树 ---------- */
  function nodeRow(s) {
    var got = BS.meta.isShaped(s.id), reqOk = BS.meta.reqOk(s.id);
    var cost = BS.meta.shapeCost(s.id), can = !got && reqOk && (BS.bus.state.meta.exp | 0) >= cost;
    var req = s.req ? BS.metaDefs.SHAPE_BY[s.req] : null;
    return '<div class="srow' + (got ? ' got' : (reqOk ? '' : ' lock')) + '">' +
      '<span class="smark">' + (got ? '●' : (reqOk ? '○' : '×')) + '</span>' +
      '<span class="sn"><b>' + U.esc(I.term(s)) + '</b>' +
      '<em>' + U.esc(I.term(s, 'd')) + '</em></span>' +
      '<span class="sreq">' + (req && !got
        ? U.esc(I.fill('先登记「#」', I.term(req))) : '') + '</span>' +
      '<span class="sc">' + (got
        ? H.tagR(T('已登记'), 'ok')
        : H.btnR('shape:' + s.id, I.fill('登记（# 阅历）', U.n0(cost)),
          can ? 'go small' : 'ghost small', !can)) +
      '</span></div>';
  }

  function tree() {
    var list = BS.metaDefs.SHAPING, groups = BS.metaDefs.SHAPE_GROUPS, out = '', gi, i;
    for (gi = 0; gi < groups.length; gi++) {
      var rows = '';
      for (i = 0; i < list.length; i++) {
        if ((list[i].br || '') === groups[gi]) rows += nodeRow(list[i]);
      }
      if (!rows) continue;
      out += '<div class="subhead">' + U.esc(T(groups[gi])) + '</div>';
      out += '<div class="vtable">' + rows + '</div>';
    }
    return out;
  }

  function render() {
    if (!host) return;
    var rd = BS.meta.readings();
    var out = H.head('重塑', 'REMOLD',
      '一局打完记下的阅历，在这里点亮一棵树：多一张指令候选、多三条可勾的战况、失守没那么疼。局面要不要重来，你自己说了算——按下重整，这一局先按它走到第几波结算。');
    out += '<div class="statline">' +
      H.kv('阅历', '<b>' + U.n0(rd.exp) + '</b>') +
      H.kv('已登记', U.n0(rd.shaped) + ' / ' + U.n0(rd.shapeTotal)) +
      H.kv('总局数', U.n0(rd.runs)) +
      H.kv('最好一局', T('第 # 波').replace('#', U.n0(rd.bestWaves))) +
      H.kv('重整过', U.n0(rd.rallies) + ' ' + U.esc(T('次'))) +
      '</div>';
    out += '<div class="ff">' + H.btn('go:shop', T('去商店花结晶'), 'go') +
      H.btn('go:meta', T('看成就'), 'ghost') + '</div>';
    if (note) out += '<p class="note">' + U.esc(note) + '</p>';
    out += resetBox();
    out += '<div class="subhead">' + U.esc(T('重塑树')) + '</div>';
    out += '<p class="note">' + U.esc(T('结晶买的是数值，阅历登记的是可能性——这一页优先给的是「下次可以这样打」。')) + '</p>';
    out += tree();
    host.innerHTML = out;
    bind();
  }

  function bind() {
    if (!host) return;
    U.act(host, function (a) {
      if (a.indexOf('go:') === 0) { BS.app.go(a.slice(3)); return; }
      if (a === 'rally') { arm = true; note = ''; render(); return; }
      if (a === 'rallyNo') { arm = false; note = T('没动。'); render(); return; }
      if (a === 'rallyYes') {
        arm = false;
        var o = BS.meta.rally();
        note = o.settled
          ? T('重整完毕：这一局按第 # 波（#）结算入账，配给 # 采集尘与 # 结晶。履历一笔没动。')
            .replace('#', U.n0(o.settled.over.wave))
            .replace('#', T(o.settled.lost ? '失守' : '撤离'))
            .replace('#', U.n0(o.kit.dust)).replace('#', U.n0(o.kit.crystal))
          : T('重整完毕：发下 # 采集尘与 # 结晶。履历一笔没动。')
            .replace('#', U.n0(o.kit.dust)).replace('#', U.n0(o.kit.crystal));
        render(); return;
      }
      if (a.indexOf('shape:') === 0) {
        var o2 = BS.meta.shape(a.slice(6));
        note = o2.ok ? T('登记好了。下一局就能用上。') : o2.why;
        render(); return;
      }
    });
  }

  BS.reg.add({
    id: 'shaping', n: '7', t: '重塑', sub: 'REMOLD',
    mount: function (h) {
      host = h; dirty = false; arm = false; note = '';
      offs.push(B.on('gain', function () { dirty = true; }));
      offs.push(B.on('shape', function () { dirty = true; }));
      /* 「当前这一局」是活读数：开波、进休整、结算都会改它，所以 run
         事件也得让它重画——不挂的话玩家会看到上一波的口径。 */
      offs.push(B.on('run', function () { dirty = true; }));
      offs.push(B.on('rally', function () { render(); }));
      offs.push(B.on('restore', function () { render(); }));
      render();
    },
    tick: function () { if (host && dirty) { dirty = false; render(); } },
    unmount: function () {
      arm = false;
      while (offs.length) { try { offs.pop()(); } catch (e) { /* 由它去 */ } }
      host = null;
    }
  });
})(window.BS);
