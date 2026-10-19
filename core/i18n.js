/* core/i18n.js —— 语言层。
   ------------------------------------------------------------------
   **中文是源**：界面里写的是 `T('战斗')`，那个中文串本身就是键。
   这一层只回答一个问题——当前语言下这句该显示成什么。

   为什么用「中文即键」而不是 `key: {zh, en}` 的两栏表：
   两栏表要把十二页的每一个调用点都改成 `T('nav.battle')` 这种符号键，
   三百多处全得动一遍，而收益只是「键看起来更整齐」。
   中文即键的代价是词典要逐字对齐中文（一个字不同就查不到），
   所以门禁里有一条**覆盖检查**：把源码里所有 T('…') / H.kv('…') /
   H.head('…') 的串抽出来，逐条查词典里有没有——少一条就红。
   加了新界面忘了上语言，会被这条挡住。

   三条约定：
     1. **表项不走词典**：稀有度 / 型 / 特质 / 敌人 / 升级 / 成就 / 形变
        自带 `en` 字段（它们是造型语言的一部分），由 `term(row)` 按语言取。
        所以「十字」与「CROSS」只在 parts.js 里写一次，不在词典里重复。
     2. **模板先查表、后填空**：`fill('第 # 波', 7)` 查的是模板本身，
        译文的 `#` 数量必须与中文一致。
     3. **查不到就退回中文**，绝不显示空串——单语时代留下的老习惯，
        在这里是有意的：漏译会以中文形式露出来（看得见），而不是变成空白。

   当前语言存在 `bus.state.prefs.lang`，由设置页切换、app.init() 读回。 */
window.BS = window.BS || {};
(function (BS) {
  'use strict';

  /* 语言表：code → { name, dict }。词典由 world/i18n/<code>.js 注册进来
     （core 先加载、world 后加载，所以词典是运行期挂上的，不是静态引入）。 */
  var LANGS = {
    zh: { name: '中文', dict: null },      /* 中文是源，不需要词典 */
    en: { name: 'English', dict: {} }
  };
  var cur = 'zh';

  function dict(code, obj) {
    if (!LANGS[code]) LANGS[code] = { name: code, dict: {} };
    if (!LANGS[code].dict) LANGS[code].dict = {};
    var k;
    for (k in obj) if (obj[k] != null) LANGS[code].dict[k] = obj[k];
    return LANGS[code].dict;
  }

  function langs() {
    var out = [], k;
    for (k in LANGS) out.push({ code: k, name: LANGS[k].name, ready: k === 'zh' || !!LANGS[k].dict });
    return out;
  }
  function langName(code) {
    var c = code || cur;
    return (LANGS[c] && LANGS[c].name) || c;
  }
  /* 词典条数：设置页拿它报一句实话（「已载入 N 条译文」）。
     **覆盖率**由门禁独立算（它才抽得到源码里的全部键）——
     界面只报体积，不假装自己知道总数。 */
  function dictSize(code) {
    var c = code || cur, d = LANGS[c] && LANGS[c].dict;
    if (!d) return 0;
    var n = 0, k;
    for (k in d) n++;
    return n;
  }
  function lang() { return cur; }
  function isEn() { return cur !== 'zh'; }

  /* 词典里有没有这一条——给覆盖门禁与调试用（不参与渲染）。
     注意它查的是**指定语言**的词典，不是当前语言的：
     门禁要在中文界面下检查英文词典的覆盖率。 */
  function has(zh, code) {
    var c = code || cur;
    if (c === 'zh') return true;
    return !!(LANGS[c] && LANGS[c].dict && LANGS[c].dict[zh] != null);
  }

  /* 切语言。**不做任何重画**：这一层不认识界面，
     重画由调用方（设置页 / app.init）在切完之后自己对总线说一声。
     这样语言层永远不需要知道「现在有哪几页」——它只提供翻译。 */
  function setLang(code) {
    cur = LANGS[code] ? code : 'zh';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = cur === 'zh' ? 'zh-CN' : cur;
    }
    /* `lang` 是**字符串属性**（measure 页拿它挑全角/半角冒号），
       setLang 必须把它一起换掉——换了函数签名就等于把那一页静默改坏。 */
    if (BS.i18n) BS.i18n.lang = cur;
    return cur;
  }

  /* 取词：中文是源，查不到就原样退回（宁可露中文，不要露空白）。 */
  function get(zh) {
    if (zh == null) return '';
    if (cur === 'zh') return zh;
    var d = LANGS[cur] && LANGS[cur].dict;
    if (!d) return zh;
    var v = d[zh];
    return v == null ? zh : v;
  }

  /* ---------- 表项取词 ----------
     表里的行自带 t（中文）与 en（拉丁名：COMMON / CROSS / STRIDER…）。
     中文语言取 t，英文语言取 en——这是唯一一处「翻译只写一次」的地方：
     十八种型、十一种特质、五档稀有度、十种敌人、十二条升级、九条成就、
     七刻度、八奇点、二十四条流，全都靠它。 */
  function term(row, key) {
    key = key || 't';
    if (!row) return '';
    if (typeof row === 'string') return get(row);
    if (cur !== 'zh') {
      /* 说明栏走自己的英文键（den）——`en` 是**名字**，
         拿它当说明用会把「一条直杠，长而薄」显示成「BEAM」。 */
      if (key === 'd' && row.den != null) return row.den;
      if (row.en != null) return row.en;
    }
    var v = row[key];
    if (v == null) v = row.t;
    return v == null ? '' : v;
  }
  function dual(row, key) { return term(row, key); }

  /* 全称：t 是缩写（稀有度「常/变/超/华/殿」）时用 full。
     英文里没有这个区分，两个都归到 en。 */
  function full(row) {
    if (!row) return '';
    if (typeof row === 'string') return get(row);
    if (cur !== 'zh') return row.en != null ? row.en : term(row);
    return row.full || term(row);
  }

  /* 模板填空：把 '#' 从左到右依次替换成参数。
     先查表（get）再填空——顺序反了会把参数也当成中文去查。 */
  function fill(key, a, b, c, d) {
    var vals = [a, b, c, d], i = 0;
    return get(String(key)).replace(/#/g, function () {
      return i < vals.length && vals[i] !== undefined ? String(vals[i++]) : '#';
    });
  }

  /* 表项里的拉丁 gloss：不并排显示，恒空串。 */
  function gloss() { return ''; }

  /* 延迟填空的载体（essence 里的推导链用它）。
     形状不变：算的时候存模板 + 参数，渲染时才落语言。 */
  function tell(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'string') return get(v);
    var s = get(String(v.t)), a = v.a || [], i = 0;
    if (!a.length) return s;
    return s.replace(/#/g, function () {
      if (i >= a.length) return '#';
      var x = a[i++];
      if (Array.isArray(x)) return x.join(cur === 'zh' ? '、' : ', ');
      if (x && typeof x === 'object' && x.t !== undefined) return tell(x);
      if (typeof x === 'function') { try { return String(x()); } catch (e) { return ''; } }
      return String(x);
    });
  }
  function dyn(t, a) { return { t: t, a: a || [] }; }

  /* 数字的形态：中文里「第几层」念得出来（三 / 十二），
     英文里就是阿拉伯数字——所以这一项也跟着语言走。 */
  var CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function digits(n) {
    n = n | 0;
    if (cur !== 'zh') return String(n);
    if (n < 0) return String(n);
    if (n < 10) return CN[n] || String(n);
    if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
    if (n < 100) return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
    return String(n);
  }

  /* 启动时按存档里的偏好落语言。app.init() 读完存档之后调它。 */
  function init(pref) {
    setLang(pref || 'zh');
  }

  BS.i18n = {
    get: get, setLang: setLang, init: init,
    dict: dict, langs: langs, isEn: isEn, has: has,
    langName: langName, dictSize: dictSize,
    term: term, dual: dual, full: full, fill: fill, gloss: gloss,
    tell: tell, dyn: dyn, digits: digits,
    /* 当前语言（字符串）。顶栏/测量页读它做排版，所以是属性不是函数。 */
    lang: cur
  };
})(window.BS);
