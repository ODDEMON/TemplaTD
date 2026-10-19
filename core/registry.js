/* core/registry.js —— 子界面注册表。
   ------------------------------------------------------------------
   一个子界面 = { id, n, t, sub, mount(host), tick(dt), unmount() }。

   三条硬规矩（上一版翻车就翻在这三条上）：
     1. mount 拿到的 host 是**这一页专属**的容器，由 app 新建、由 app 丢弃。
        两个界面永远不可能拿到同一个节点——这是「页面互相覆盖」不可能发生的结构原因。
     2. tick 只会被**当前那一页**调用。离场的界面不再被时钟驱动。
     3. unmount 必须把自己从总线摘干净。不写的界面会漏监听，那是 bug 不是风格。

   界面之间不互相 import：要说话就走 bus。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';
  var LIST = [], BY = {};

  function add(d) {
    if (!d || !d.id) throw new Error('子界面必须有 id');
    if (typeof d.mount !== 'function') throw new Error('子界面 ' + d.id + ' 必须有 mount(host)');
    if (BY[d.id]) throw new Error('子界面 id 重复：' + d.id);
    var m = {
      id: d.id, n: d.n == null ? String(LIST.length) : d.n,
      t: d.t || d.id, sub: d.sub || '',
      mount: d.mount, tick: d.tick || null, unmount: d.unmount || null
    };
    LIST.push(m); BY[m.id] = m;
    return m;
  }
  function get(id) { return BY[id] || null; }
  /* 排序键：n 允许是数字或纯数字串。**必须按数值比，不能按字符串比**——
     localeCompare 会把 '10' 排在 '2' 前面（字符 '1' < '2'），
     军械库编号从 9 提到 10 之后，它就会莫名其妙跳到「库」前面去。
     非数字的 n（如果有人要用 'a'）退回字符串比较，保持原语义。 */
  function nkey(m) {
    var s = String(m.n), v = Number(s);
    return (s !== '' && isFinite(v)) ? v : NaN;
  }
  function list() {
    return LIST.slice().sort(function (a, b) {
      var x = nkey(a), y = nkey(b);
      if (isFinite(x) && isFinite(y)) return x - y;
      if (isFinite(x) !== isFinite(y)) return isFinite(x) ? -1 : 1;
      return String(a.n).localeCompare(String(b.n), 'en');
    });
  }

  BS.reg = { add: add, get: get, list: list };
})(window.BS);
