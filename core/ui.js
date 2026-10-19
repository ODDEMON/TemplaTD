/* core/ui.js —— 界面共用的零件。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var U = BS.util;

  /* 译文取词：中文是源，其余语言查 BS.i18n 的叠加层。 */
  function T(zh) { return BS.i18n ? BS.i18n.get(zh) : zh; }

  function head(t, sub, lead) {
    /* 三个参数都过 T()：sub 也是界面文案（`TOWER DEFENSE` 是造型，
       整页的 sub（`TOWER DEFENSE` 之类）也是要译的）。漏掉 sub 这一层翻译，
       英文界面里就会在标题底下露出一整行中文——而这行字恰好最显眼。 */
    return '<div class="mhead"><h2>' + U.esc(T(t)) + '</h2>' +
      (sub ? '<div class="msub">' + U.esc(T(sub)) + '</div>' : '') +
      (lead ? '<p class="lead">' + U.esc(T(lead)) + '</p>' : '') + '</div>';
  }
  function btn(act, label, cls, dis, title) {
    return '<button class="btn ' + (cls || '') + '" data-act="' + act + '"' + (dis ? ' disabled' : '') +
      (title ? ' title="' + U.esc(T(title)) + '"' : '') + '>' + U.esc(T(label)) + '</button>';
  }
  function row(k, v) {
    return '<div class="row"><span class="k">' + U.esc(T(k)) + '</span><span class="v">' + v + '</span></div>';
  }
  function kv(k, v) { return '<span class="kv"><b>' + U.esc(T(k)) + '</b>' + v + '</span>'; }
  function note(t) { return '<p class="note">' + T(t) + '</p>'; }
  function empty(t) { return '<div class="empty">' + U.esc(T(t || '空')) + '</div>'; }
  function tag(t, cls) { return '<span class="tg ' + (cls || '') + '">' + U.esc(T(t)) + '</span>'; }
  function num(x, n) { return U.fmt(x, n); }

  /* ---------- 定稿变体：调用方已经把每一段都取过词了，这里不再走翻译 ----------
     为什么需要它们：这几个辅助函数都会对第一个参数再调一次 T()。
     调用方如果先拼好了一段（比如「符号 + 名字」、或者已经 dual() 过的双语标签），
     再喂进来就会被查第二遍——拼出来的串永远查不到词条，于是英文界面里
     留下汉字。凡是**拼过**的标签，一律走 R 结尾的这一组。
     T() 对查不到的串本来就会原样退回，所以这里的区别是「意图」而不是「结果」：
     它让「这一段已经定稿」这件事在代码里一眼看得见。 */
  function btnR(act, label, cls, dis, title) {
    return '<button class="btn ' + (cls || '') + '" data-act="' + act + '"' + (dis ? ' disabled' : '') +
      (title ? ' title="' + U.esc(title) + '"' : '') + '>' + U.esc(label) + '</button>';
  }
  function rowR(k, v) {
    return '<div class="row"><span class="k">' + U.esc(k) + '</span><span class="v">' + v + '</span></div>';
  }
  function kvR(k, v) { return '<span class="kv"><b>' + U.esc(k) + '</b>' + v + '</span>'; }
  function tagR(t, cls) { return '<span class="tg ' + (cls || '') + '">' + U.esc(t) + '</span>'; }

  /* ---------- 读数：条 + 数字 ----------
     为什么必须有数字：这一部的命脉是「读数决定塔属性」——
     对称→弹数、重复→攻速、通透→射程、匀质→伤害、环络→连锁与减速、轮廓→近战与生命。
     只有一根条，玩家读不出「0.42 和 0.49 差在哪」，核心映射就不可感知。
     上一版只画了条，这是它玩不了的第二条根因。 */
  var ES_KEYS = ['sym', 'repeat', 'void', 'even', 'weave', 'edge'];
  var ES_NAMES = { sym: '对称', repeat: '重复', void: '通透', even: '匀质', weave: '环络', edge: '轮廓' };

  function bar(v) {
    var p = Math.max(0, Math.min(1, v || 0));
    return '<span class="esb"><i style="width:' + (p * 100).toFixed(0) + '%"></i></span>' +
      '<b class="esn">' + p.toFixed(2) + '</b>';
  }
  /* 六项一行：名字 + 条 + 数字 */
  function esRow(es, keys) {
    var ks = keys || ES_KEYS, out = '', i;
    for (i = 0; i < ks.length; i++) {
      out += '<span class="esc"><em>' + U.esc(T(ES_NAMES[ks[i]])) + '</em>' + bar(es[ks[i]]) + '</span>';
    }
    return '<span class="esrow">' + out + '</span>';
  }
  /* 六项两列：建造台卡片用，省横向空间 */
  function esGrid(es) {
    var out = '', i;
    for (i = 0; i < ES_KEYS.length; i++) {
      var k = ES_KEYS[i];
      out += '<span class="esc"><em>' + U.esc(T(ES_NAMES[k])) + '</em>' + bar(es[k]) + '</span>';
    }
    return '<span class="esgrid">' + out + '</span>';
  }
  function esName(k) { return T(ES_NAMES[k]); }

  /* ---------- 分页 ---------- */
  function pager(from, n, total, act) {
    var a = String(act || 'pg');
    var prev = from > 0;
    var next = from + n < total;
    return '<div class="pager">' +
      btnR(a + ':prev', '←', 'ghost', !prev) +
      '<span class="pgi">' + (from + 1) + '–' + Math.min(from + n, total) + ' / ' + total + '</span>' +
      btnR(a + ':next', '→', 'ghost', !next) +
      '</div>';
  }

  BS.ui = {
    head: head, btn: btn, btnR: btnR, row: row, rowR: rowR, kv: kv, kvR: kvR,
    note: note, empty: empty, tag: tag, tagR: tagR, num: num, fmt: U.fmt, T: T,
    bar: bar, esRow: esRow, esGrid: esGrid, esName: esName, pager: pager,
    ES_KEYS: ES_KEYS, ES_NAMES: ES_NAMES
  };
})(window.BS);
