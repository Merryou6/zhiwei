/* ============================================================================
   知微 · 控制台原型
   6 个页面共用一套设计系统，只换内容。
   数据来自 data/knowledge-graph.js（由真实知识库生成）。
   ========================================================================= */
(function () {
  'use strict';

  var G = window.ZW_GRAPH;

  /* ------------------------------------------------------------- 图标 ---- */
  var S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var ICO = {
    plus: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M8 3v10M3 8h10"/></svg>',
    upload: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M8 11V2.6M4.8 5.8 8 2.6l3.2 3.2"/><path d="M2.6 10.4v1.8a1.8 1.8 0 0 0 1.8 1.8h7.2a1.8 1.8 0 0 0 1.8-1.8v-1.8"/></svg>',
    send: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M14 8 2.6 2.8 5 8l-2.4 5.2z"/><path d="M5 8h9"/></svg>',
    image: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><rect x="2.2" y="3" width="11.6" height="10" rx="1.8"/><circle cx="5.8" cy="6.4" r="1.1"/><path d="M3 11.2 6.4 8l2.4 2.2L11 8.6l2.2 2"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 16 16" ' + S + '><circle cx="7.2" cy="7.2" r="4.4"/><path d="m10.6 10.6 2.9 2.9"/></svg>',
    grid: '<svg width="17" height="17" viewBox="0 0 18 18" ' + S + '><rect x="2.4" y="2.4" width="5.4" height="5.4" rx="1.4"/><rect x="10.2" y="2.4" width="5.4" height="5.4" rx="1.4"/><rect x="2.4" y="10.2" width="5.4" height="5.4" rx="1.4"/><rect x="10.2" y="10.2" width="5.4" height="5.4" rx="1.4"/></svg>',
    target: '<svg width="20" height="20" viewBox="0 0 20 20" ' + S + '><circle cx="10" cy="10" r="7.2"/><circle cx="10" cy="10" r="3.4"/><path d="M10 1.4v2.6M10 16v2.6M1.4 10h2.6M16 10h2.6"/></svg>',
    ruler: '<svg width="20" height="20" viewBox="0 0 20 20" ' + S + '><rect x="1.8" y="6.6" width="16.4" height="6.8" rx="1.6"/><path d="M5.6 6.6v2.6M8.8 6.6v3.6M12 6.6v2.6M15.2 6.6v3.6"/></svg>',
    redo: '<svg width="20" height="20" viewBox="0 0 20 20" ' + S + '><path d="M3 10a7 7 0 1 0 2.6-5.5"/><path d="M3 3.6V7h3.4"/></svg>',
    clip: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><rect x="3.4" y="2.4" width="9.2" height="11.2" rx="1.6"/><path d="M3.4 6h9.2M3.4 9.4h9.2M3.4 12.8h5.6"/></svg>',
    chart: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M2.4 13.6V2.8M2.4 13.6h11.2"/><path d="M5.2 11V8.4M8 11V5.2M10.8 11V7"/></svg>',
    cloud: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M4.6 12.4h7.2a2.8 2.8 0 0 0 .3-5.6 3.9 3.9 0 0 0-7.5-.7 2.9 2.9 0 0 0 0 6.3z"/></svg>',
    file: '<svg width="16" height="16" viewBox="0 0 18 18" ' + S + '><path d="M10.2 1.9H5.2a1.7 1.7 0 0 0-1.7 1.7v10.8a1.7 1.7 0 0 0 1.7 1.7h7.6a1.7 1.7 0 0 0 1.7-1.7V6.2z"/><path d="M10.2 1.9v4.3h4.3"/></svg>',
    download: '<svg width="15" height="15" viewBox="0 0 16 16" ' + S + '><path d="M8 2.4v8M4.8 7.2 8 10.4l3.2-3.2"/><path d="M2.6 12.8h10.8"/></svg>',
    more: '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.4" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.6" cy="8" r="1.3"/></svg>',
    spark: '<svg width="13" height="13" viewBox="0 0 16 16" ' + S + '><path d="M8 1.8 9.6 6 13.8 7.6 9.6 9.2 8 13.4 6.4 9.2 2.2 7.6 6.4 6z"/></svg>',
    alert: '<svg width="13" height="13" viewBox="0 0 16 16" ' + S + '><circle cx="8" cy="8" r="6.2"/><path d="M8 5v3.6M8 11h.01"/></svg>',
    check: '<svg width="13" height="13" viewBox="0 0 16 16" ' + S + '><path d="m3.4 8.4 3 3 6.2-6.6"/></svg>'
  };

  /* --------------------------------------------------------- 基础工具 ---- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function bandOf(k) { for (var i = 0; i < G.bands.length; i++) if (G.bands[i].key === k) return G.bands[i]; return null; }
  function bandForLevel(l) { return l >= 75 ? 'solid' : l >= 60 ? 'basic' : l >= 45 ? 'waver' : 'weak'; }
  function agoText(d) { return d <= 0 ? '今天' : d === 1 ? '1 天前' : d + ' 天前'; }

  /* ------------------------------------------------- 由真实数据派生 ---- */
  var D = (function () {
    var ns = G.nodes;
    var mastered = ns.filter(function (n) { return n.band === 'solid' || n.band === 'basic'; }).length;
    var avgAcc = Math.round(sum(ns.map(function (n) { return n.accuracy; })) / ns.length);
    var attempts = sum(ns.map(function (n) { return n.attempts; }));
    var recent = sum(ns.filter(function (n) { return n.ago <= 7; }).map(function (n) { return n.attempts; }));
    var weak = ns.filter(function (n) { return n.band === 'weak'; });
    var weakChapters = [];
    weak.forEach(function (n) { if (weakChapters.indexOf(n.chapter) < 0) weakChapters.push(n.chapter); });
    var byAcc = ns.slice().sort(function (a, b) { return a.accuracy - b.accuracy; });
    return {
      mastered: mastered, total: ns.length, avgAcc: avgAcc,
      attempts: attempts, recent: recent,
      weak: weak, weakChapters: weakChapters, byAcc: byAcc,
      weakest: byAcc[0], best: byAcc[byAcc.length - 1]
    };
  })();

  /* ------------------------------------------------------------- 片段 ---- */
  function pageHead(title, lead, actions) {
    return '<header class="page-head"><div>' +
      '<h1 class="t-display">' + esc(title) + '</h1>' +
      '<p class="page-lead">' + lead + '</p></div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') +
      '</header>';
  }

  function bandTag(key) {
    var b = bandOf(key);
    return '<span class="tag tag-band tag-' + key + '"><i class="tag-dot band-' + key + '" style="background:var(--band)"></i>' + b.label + '</span>';
  }

  function meter(level, key) {
    return '<div class="meter ' + (key ? 'band-' + key : '') + '"><div class="meter-fill" style="width:' + level + '%"></div></div>';
  }

  /* ==================================================== 1. 学习空间 ===== */
  function pageSpace() {
    var bandRows = G.bands.map(function (b) {
      return '<li><i class="swatch swatch-' + b.key + '"></i>' + b.label +
        '<span class="count">' + b.count + '</span></li>';
    }).join('');
    var segs = G.bands.map(function (b) {
      return '<span class="band-' + b.key + '" style="flex:' + b.count + ';background:var(--band)"></span>';
    }).join('');

    var others = [
      { name: '几何专项空间', desc: '聚焦三角形全等与四边形证明，独立记录掌握进度。', level: 38, meta: '知识点 14 · 最近 2 天前' },
      { name: '错题回练空间', desc: '按错因聚合历史作答，只练反复出错的知识点。', level: 64, meta: '知识点 18 · 最近 1 天前' },
      { name: '学期冲刺空间', desc: '期末前 30 天的高频考点与限时训练。', level: 21, meta: '知识点 26 · 最近 4 天前' }
    ].map(function (s) {
      var k = bandForLevel(s.level);
      return '<article class="card card-hover space-card">' +
        '<div class="space-card-top"><span class="space-icon">' + ICO.grid + '</span>' +
        '<div><h3>' + esc(s.name) + '</h3><p class="space-card-desc">' + esc(s.desc) + '</p></div></div>' +
        '<div class="space-card-foot">' +
        '<div class="space-card-foot-row"><span class="t-micro">掌握度</span><span class="space-card-pct">' + s.level + '%</span></div>' +
        meter(s.level, k) +
        '<div class="space-card-foot-row" style="margin:9px 0 0"><span class="t-micro">' + esc(s.meta) + '</span></div>' +
        '</div></article>';
    }).join('');

    var feed = [
      { t: '今天 15:42', k: 'basic', text: '完成「顶点式」巩固练习 8 题', res: '6/8 正确' },
      { t: '今天 09:41', k: '', text: '上传 <em>2026秋·九年级数学·第一次月考（含答案）.pdf</em>', res: '已入云盘' },
      { t: '昨天 20:15', k: 'weak', text: '对话辅导：一般式与顶点式互化', res: '3 轮引导' },
      { t: '09-20 19:02', k: 'basic', text: '完成复测测量', res: '正确率 74%，+8pt' },
      { t: '09-18 14:26', k: 'weak', text: '完成诊断测评', res: '定位 3 个待巩固知识点' }
    ].map(function (f) {
      return '<li><span class="feed-time">' + f.t + '</span>' +
        '<i class="feed-dot ' + (f.k ? 'band-' + f.k : '') + '"></i>' +
        '<span class="feed-text">' + f.text + '</span>' +
        '<span class="feed-result">' + f.res + '</span></li>';
    }).join('');

    return pageHead('学习空间',
      '每个空间对应一份独立的知识图谱与练习记录。切换空间不影响其他空间已有的进度。',
      '<button class="btn btn-ghost" type="button">' + ICO.plus + '新建空间</button>'
      ) +

      /* 主卡片 */
      '<section class="feature">' +
        '<div class="feature-main">' +
          '<div class="feature-title"><h2 class="t-h2">初中数学 默认空间</h2>' +
            '<span class="tag tag-accent">当前空间</span></div>' +
          '<p class="feature-desc">基于《义务教育数学课程标准（2022年版）》构建的知识图谱，覆盖代数式、函数、一元二次方程与二次函数四个章节，共 ' + D.total + ' 个知识点、' + G.meta.edgeCount + ' 条先修关系。</p>' +
          '<dl class="feature-meta">' +
            '<div><dt>知识点</dt><dd>' + D.total + '</dd></div>' +
            '<div><dt>达标</dt><dd>' + D.mastered + '</dd></div>' +
            '<div><dt>累计练习</dt><dd>' + D.attempts + ' 次</dd></div>' +
            '<div><dt>最近活动</dt><dd>3 小时前</dd></div>' +
          '</dl>' +
          '<div class="feature-block">' +
            '<div class="space-card-foot-row"><span class="t-micro">掌握程度分布</span>' +
              '<span class="t-micro">达标 ' + D.mastered + ' / ' + D.total + '</span></div>' +
            '<div class="segbar">' + segs + '</div>' +
            '<ul class="legend-inline">' + bandRows + '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="feature-side">' +
          '<button class="btn btn-primary btn-lg" type="button">开始30秒自报</button>' +
          '<p class="feature-hint">12 道题 · 约 30 秒 · 实时更新图谱</p>' +
        '</div>' +
      '</section>' +

      /* 其他空间 */
      '<section class="section">' +
        '<div class="section-head"><h2 class="t-h2">其他空间</h2><span class="section-note">3 个</span></div>' +
        '<div class="grid grid-3">' + others + '</div>' +
      '</section>' +

      /* 最近活动 */
      '<section class="section">' +
        '<div class="section-head"><h2 class="t-h2">最近活动</h2>' +
          '<a class="section-link" href="#/report">查看学习报告</a></div>' +
        '<div class="card"><ul class="feed">' + feed + '</ul></div>' +
      '</section>';
  }

  /* ======================================================== 2. 测评 ===== */
  function pageAssessment() {
    var items = [
      {
        icon: ICO.target, tone: '', tag: '<span class="tag tag-accent">建议先做</span>',
        name: '诊断测评',
        desc: '用 18 道自适应题逐层缩小范围，定位到具体的知识点与错因类型，产出一份结构化的诊断画像。',
        note: '上次完成 09-18 14:26 · 定位到 3 个待巩固知识点',
        n: 18, cta: '开始诊断', primary: true
      },
      {
        icon: ICO.ruler, tone: 'is-green', tag: '<span class="tag">基准</span>',
        name: '基线测量',
        desc: '在学期初或新空间启用时测量一次能力基线，作为之后每次进步的对照基准。基线只测一次。',
        note: '上次完成 09-02 09:10 · 基线正确率 66%',
        n: 24, cta: '建立基线', primary: false
      },
      {
        icon: ICO.redo, tone: 'is-amber', tag: '<span class="tag">对照</span>',
        name: '复测测量',
        desc: '与基线逐题对照，检验这一阶段的学习效果，并把结果写回知识图谱更新掌握程度。',
        note: '距基线 20 天 · 建议完成 2 个知识点巩固后再复测',
        n: 24, cta: '开始复测', primary: false
      }
    ].map(function (a) {
      return '<article class="card card-hover assess">' +
        '<span class="assess-icon ' + a.tone + '">' + a.icon + '</span>' +
        '<div class="assess-body">' +
          '<div class="assess-title-row"><h2 class="t-h2">' + a.name + '</h2>' + a.tag + '</div>' +
          '<p class="assess-desc">' + a.desc + '</p>' +
          '<div class="assess-note">' + ICO.spark + esc(a.note) + '</div>' +
        '</div>' +
        '<div class="assess-side">' +
          '<div class="assess-metric"><span class="num">' + a.n + '</span><span class="unit">题</span></div>' +
          '<button class="btn ' + (a.primary ? 'btn-primary' : 'btn-ghost') + ' btn-lg" type="button">' + a.cta + '</button>' +
        '</div>' +
      '</article>';
    }).join('');

    return pageHead('测评',
      '三种测评各有分工：诊断定位问题，基线锚定起点，复测检验效果。每次测评结果都会写回知识图谱。'
      ) + '<div class="stack">' + items + '</div>';
  }

  /* ==================================================== 3. 对话辅导 ===== */

  /* 知微头像：与登录页 logo 同源几何 */
  var AVATAR = '<svg viewBox="0 0 28 28">' +
    '<rect width="28" height="28" rx="8" fill="#25344a" stroke="#334155"/>' +
    '<path d="M9.7 9.5 18.1 14 9.7 18.5" fill="none" stroke="#42a5f5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="9.7" cy="9.5" r="1.9" fill="#e8edf3"/><circle cx="18.1" cy="14" r="2.4" fill="#42a5f5"/>' +
    '<circle cx="9.7" cy="18.5" r="1.5" fill="#8b95a8"/></svg>';

  function txt(s) { return '<p class="msg-text">' + s + '</p>'; }
  function aiMsg(inner, tag) {
    return '<div class="msg">' +
      '<span class="msg-avatar" aria-hidden="true">' + AVATAR + '</span>' +
      '<div class="msg-body">' +
        '<div class="msg-name"><strong>知微</strong>' +
        (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</div>' +
        inner +
      '</div></div>';
  }
  function meMsg(inner) {
    return '<div class="msg msg-user"><div class="msg-body">' +
      '<div class="msg-name"><strong>我</strong></div>' +
      '<div class="msg-bubble">' + inner + '</div></div></div>';
  }
  function stepBlock(title, arr) {
    return '<div class="steps"><div class="steps-head">' + ICO.clip + esc(title) + '</div><ul>' +
      arr.map(function (t, i) {
        return '<li><span class="steps-idx">' + (i + 1) + '</span>' +
          '<span class="steps-text">' + t + '</span></li>';
      }).join('') + '</ul></div>';
  }
  function listOf(arr) {
    if (!arr.length) return '——';
    return arr.slice(0, 3).map(esc).join('、') + (arr.length > 3 ? ' 等 ' + arr.length + ' 项' : '');
  }

  /* ----------------------------------------------------- 辅导引擎 ----
     回复不是随机话术：先按关键词定位到知识点，再按「卡在哪一类」决定怎么回。
     凡出现数字的地方（正确率、错误次数、先修关系）都取自知识图谱的真实统计。 */
  var COACH = (function () {
    var byShort = {}, i;
    for (i = 0; i < G.nodes.length; i++) byShort[G.nodes[i].short] = i;

    /* 学生的口语说法 → 知识点（长词优先命中） */
    var KEYS = [
      ['一般式', '一般式↔顶点式'], ['互化', '一般式↔顶点式'], ['顶点式', '顶点式'],
      ['顶点', '顶点式'], ['最小值', '最值'], ['最大值', '最值'], ['最值', '最值'],
      ['配方', '配方法'], ['完全平方', '完全平方公式'], ['对称轴', '开口与对称轴'],
      ['开口', '开口与对称轴'], ['增减', '开口与对称轴'], ['平移', '抛物线平移'],
      ['判别式', '求根公式'], ['求根公式', '求根公式'], ['因式分解', '因式分解法'],
      ['待定系数', '待定系数法'], ['交点', '与方程的关系'], ['实际应用', '实际应用'],
      ['几何综合', '几何综合'], ['一次函数', '一次函数'], ['自变量', '函数概念'],
      ['函数图像', '函数图像'], ['二次函数', '二次函数概念'], ['代数式', '代数式求值']
    ];

    /* 重点知识点手写了教学内容；其余由图谱数据生成 */
    var SCRIPT = {
      '最值': {
        tag: '二次函数 · 最值',
        probe: '顶点式 <span class="formula">y = a(x − h)² + k</span> 里，是 <b>h</b> 还是 <b>k</b> 给出了最值？',
        why: '因为 <span class="formula">(x − h)²</span> 最小只能到 0 —— 平方不可能是负的。所以 x = h 时 y 取到 k，最值就是 k。配方的作用，就是把它变成一眼能读的形式。',
        steps: [
          '先看二次项系数 a：<b>a &gt; 0 开口向上取最小值，a &lt; 0 取最大值</b>。',
          '把一般式配方成顶点式，让 <b>h、k 露出来</b>。',
          '结论写完整：<b>在 x = h 处取到最值 k</b>，两个数缺一不可。'
        ],
        check: '把 x = 2 代回 y = x² − 4x + 3：4 − 8 + 3 = −1，和顶点式里的 k 对上了，说明配对了。'
      },
      '一般式↔顶点式': {
        tag: '二次函数 · 一般式↔顶点式',
        probe: '你是<b>配不出来</b>，还是配出来了但<b>不确定对不对</b>？这两种卡法的练法完全不同。',
        why: '一般式 <span class="formula">y = ax² + bx + c</span> 看不出顶点，但顶点式 <span class="formula">y = a(x − h)² + k</span> 一眼就能读。互化就是把「算得出来」变成「看得见」—— 平移、最值、对称轴全都建立在顶点式上。',
        steps: [
          '先把 a 提出来：<span class="formula">y = a(x² + (b/a)x) + c</span>，别漏掉 c 先不动。',
          '括号内凑完全平方，<b>加了什么就要减去什么</b>，这是最容易丢分的一步。',
          '整理成 <span class="formula">y = a(x − h)² + k</span>，再用<b>顶点反推</b>检验一遍。'
        ],
        check: '拿 <span class="formula">y = 2x² − 8x + 5</span> 试：配方后应是 y = 2(x − 2)² − 3。把 x = 2 代回原式得 8 − 16 + 5 = −3，对上了。'
      },
      '配方法': {
        tag: '一元二次方程 · 配方法',
        probe: '你在「加一项减一项」那步会不会犹豫 —— 不确定该配哪个数？',
        why: '配方不改变式子的值，只改变它的<b>写法</b>。既然值不变，「加了就要立刻减掉」这件事就必然是刚性的，犹豫通常是因为把它当成了计算而不是变形。',
        steps: [
          '二次项系数化 1（两边同除 a），这是前提。',
          '配上<b>一次项系数一半的平方</b>，同时立刻减掉同一个数。',
          '左边收成完全平方，右边是常数，开平方时<b>别忘了 ±</b>。'
        ],
        check: 'x² − 6x + 5 = 0 配方：x² − 6x = −5，两边加 9 得 (x − 3)² = 4，解出 x = 5 或 1。代回都对。'
      },
      '与方程的关系': {
        tag: '二次函数 · 与方程的关系',
        probe: '抛物线与 x 轴的交点，和方程 ax² + bx + c = 0 的根，你直觉上觉得是什么关系？',
        why: '函数看的是<b>图像上的点</b>，方程问的是<b>y = 0 的那些点</b>。把 y 钉死成 0，抛物线就退化成和 x 轴的两个（或零个、一个）交点 —— 所以判别式 Δ 才同时管着「有没有交点」和「有没有实根」。',
        steps: [
          '把方程写成函数：<span class="formula">y = ax² + bx + c</span>，方程的解就是 y = 0 的 x。',
          '算 Δ = b² − 4ac，先判断<b>几个交点</b>（&gt;0 两个、=0 一个、&lt;0 没有）。',
          '再用图像位置验证：开口方向、顶点在 x 轴的上方还是下方。'
        ],
        check: 'x² − 4x + 3 = 0 的 Δ = 16 − 12 = 4 &gt; 0，两个交点。而 y = x² − 4x + 3 的顶点是 (2, −1)，在 x 轴下方 —— 开口向上且顶点在下，必然穿过 x 轴两次，吻合。'
      }
    };

    function prereqs(idx) {
      return G.edges.filter(function (e) { return e.b === idx; })
        .map(function (e) { return G.nodes[e.a].short; });
    }
    function nexts(idx) {
      return G.edges.filter(function (e) { return e.a === idx; })
        .map(function (e) { return G.nodes[e.b].short; });
    }

    /* 没有手写内容的知识点：用图谱里的真实统计生成追问 / 解释 / 步骤 */
    function genProbe(n, b) {
      return '「' + esc(n.name) + '」你目前是 <b>' + b.label + '</b>（正确率 ' + n.accuracy +
        '%，练过 ' + n.attempts + ' 次）。先分清卡在哪一类：是<b>概念上不确定它在干什么</b>，还是<b>知道要干什么但算不下去</b>？';
    }
    function genWhy(idx, n) {
      var pre = prereqs(idx), nx = nexts(idx);
      return '放到图谱里会更清楚：<b>' + esc(n.name) + '</b> 的先修是 ' + listOf(pre) +
        '，它又会被 ' + listOf(nx) + ' 用到。所以它很少孤立地难 —— 卡在这里，通常是前一步的某个动作没定型。' +
        '先回去确认 ' + (pre.length ? esc(pre[0]) : '前置概念') + ' 能不能独立做对，比在这道题上硬耗更省时间。';
    }
    function genSteps(n) {
      return [
        '先把题目里的每个条件<b>逐条翻成式子</b>，不急着算 —— 大多数「不会做」其实是没把条件列全。',
        '再确定这道题要的是<b>' + esc(n.short) + '</b> 里的哪个动作，只调这一个工具，别混用。',
        '算完<b>回代验证</b>：把结果放回原条件，看是否全部成立。成立才算做完。'
      ];
    }

    function intentOf(t) {
      if (/(答案|结果|选什么|等于多少|等于几)/.test(t)) return 'answer';
      if (/(不知道|不会|不懂|没思路|卡住|卡在|想不出|太难|看不懂|头疼)/.test(t)) return 'stuck';
      if (/(为什么|为啥|凭什么|原因|原理|道理|怎么会)/.test(t)) return 'why';
      if (/(是不是|对吗|对不对|我算|我觉得|应该是|这样行|你看我)/.test(t)) return 'check';
      return 'open';
    }

    /* 返回 {idx, intent}；idx 为 -1 表示没定位到知识点 */
    function locate(text, ctx) {
      var hit = null;
      for (var k = 0; k < KEYS.length; k++) {
        if (text.indexOf(KEYS[k][0]) >= 0) {
          if (!hit || KEYS[k][0].length > hit[0].length) hit = KEYS[k];
        }
      }
      var idx = hit ? byShort[hit[1]] : (ctx.topic >= 0 ? ctx.topic : -1);
      return { idx: idx, intent: intentOf(text) };
    }

    function build(idx, it, hasImg) {
      var n = G.nodes[idx], b = bandOf(n.band), s = SCRIPT[n.short] || null;
      var out = [];

      if (hasImg) {
        out.push('<div class="ocr-card"><span class="ocr-thumb">' + ICO.image + '</span>' +
          '<div><div class="ocr-title">已读取你上传的题目</div>' +
          '<div class="ocr-sub">' + esc(n.name) + ' · 识别到 2 个条件、1 个待求量</div></div></div>');
        out.push(txt('题看到了，它落在「' + esc(n.name) + '」这一环上。先别写，我们把它拆开看。'));
      }

      if (it === 'answer') {
        out.push(txt('可以给。但这一步跳过去就白做了 —— 你在「' + esc(n.name) + '」上已经错过 ' +
          n.errors + ' 次，正确率 ' + n.accuracy + '%。答案给你，这道题是过去了；换个数字，还会卡在同一个地方。'));
        out.push(txt('先回答我一个小问题：' + (s ? s.probe : '这道题要你求的是<b>某个具体数值</b>，还是<b>某个性质或范围</b>？先分清这个，再谈怎么算。')));
        out.push(txt('答不上来也没关系，说「不知道」我就把台阶再降一级。'));
      } else if (it === 'stuck') {
        out.push(txt('正常，这一步本来就不是靠想出来的。' + (s ? '' :
          '我把「' + esc(n.name) + '」拆成三步，你对着看自己断在第几步。')));
        out.push(stepBlock('分步引导 · ' + n.short, s ? s.steps : genSteps(n)));
        out.push(txt(s ? '验一下：' + s.check :
          '这类题的通法是<b>先列条件、再选工具、最后回代</b>。回代这一步别省，它比重新算一遍更快。'));
      } else if (it === 'why') {
        out.push(txt(s ? s.why : genWhy(idx, n)));
        out.push(txt('听懂了吗？用自己的话把它复述一遍，我就知道你是真过了。'));
      } else if (it === 'check') {
        out.push(txt('先别急着问我 —— 这类式子有个自检办法，比问我快：<b>把结果代回原条件</b>。'));
        if (s) out.push(txt(s.check));
        out.push(txt('和你算的一致吗？一致就往下走一步，我出个变式；不一致就把过程贴给我，我只看哪一行开始偏的。'));
      } else {
        out.push(txt(s ? s.probe : genProbe(n, b)));
      }

      return { tag: s ? s.tag : n.chapter + ' · ' + n.short, html: out.join('') };
    }

    function opening() {
      return {
        tag: null,
        html: txt('先别写过程。数学题卡住，大多落在三种情况里 —— 你是哪一种？') +
          '<div class="choices">' +
            '<button class="choice" type="button" data-fill="概念没懂，不知道这个知识点在干什么">概念没懂 · 不知道它在干什么</button>' +
            '<button class="choice" type="button" data-fill="知道方向，但算到一半就断了">算到一半断了</button>' +
            '<button class="choice" type="button" data-fill="读不懂题，看不出要我求什么">读不懂题 · 看不出要求什么</button>' +
          '</div>'
      };
    }

    function reply(text, ctx, hasImg) {
      var loc = locate(text, ctx);
      if (loc.idx < 0) {
        ctx.topic = -1;
        return opening();
      }
      ctx.topic = loc.idx;
      var r = build(loc.idx, loc.intent, hasImg);
      r.idx = loc.idx;
      return r;
    }

    return { reply: reply, opening: opening };
  })();

  /* 会话状态：切页回来不丢对话 */
  var chatLog = null;
  var chatCtx = { topic: -1, pendingImg: null };

  function seedChat() {
    return [
      aiMsg(
        txt('我们来看这道题。先别急着算，告诉我：你卡在哪一步了？是不知道从哪下手，还是配方之后不知道看什么？'),
        '二次函数 · 最值'),
      meMsg(txt('配方我知道怎么做，但配方之后不知道要读哪个数。')),
      aiMsg(
        txt('那问题就清楚了 —— 配方本身不是目的，<b>顶点式里的那两个数是唯一的答案来源</b>。我把它拆成三步，你跟着读一遍。') +
        stepBlock('分步引导 · 顶点式读最值', [
          '先看二次项系数 <b>a = 1</b>，大于 0，所以抛物线开口向上，函数有<b>最小值</b>。',
          '配方：<span class="formula">y = x² − 4x + 3 = (x − 2)² − 1</span>',
          '顶点就是 (2, −1)，所以最小值取 <b>−1</b>，在 x = 2 处取到。'
        ]) +
        txt('现在换你来：如果题目改成 <span class="formula">y = −x² + 4x</span>，最小值还会存在吗？为什么？') +
        '<div class="ocr-card"><span class="ocr-thumb">' + ICO.image + '</span>' +
        '<div><div class="ocr-title">已读取你上传的题目</div>' +
        '<div class="ocr-sub">第 3 题 · 二次函数最值 · 识别到 2 个条件、1 个待求量</div></div></div>')
    ];
  }

  function pageChat() {
    if (!chatLog) chatLog = seedChat();

    return pageHead('对话辅导',
      '不会直接给答案：先确认你卡在哪一步，再一步步把思路交回给你。'
      ) +
      '<section class="chat-shell">' +
        '<div class="chat-stream" role="log" aria-live="polite">' + chatLog.join('') + '</div>' +

        '<div class="composer">' +
          '<div class="composer-box">' +
            '<div class="composer-attach">' +
              '<span class="attach-thumb">' + ICO.image + '</span>' +
              '<div class="attach-meta">' +
                '<div class="attach-name">IMG_2043.jpg</div>' +
                '<div class="attach-sub">已识图 · 二次函数最值 · 2 个条件</div>' +
              '</div>' +
              '<button class="attach-x" type="button" aria-label="移除图片">' +
                '<svg width="12" height="12" viewBox="0 0 16 16" ' + S + '><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
              '</button>' +
            '</div>' +
            '<textarea class="composer-input" rows="2" placeholder="把你的思路或卡住的地方写下来，也可以直接拍题上传…"></textarea>' +
            '<div class="composer-bar">' +
              '<span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>' +
              '<div class="composer-actions">' +
                '<button class="btn btn-ghost" type="button" data-act="image">' + ICO.image + '传图读题</button>' +
                '<button class="btn btn-primary" type="button" data-act="send" disabled>' + ICO.send + '发送</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function mountChat() {
    var stream = document.querySelector('.chat-stream');
    var input = document.querySelector('.composer-input');
    var sendBtn = document.querySelector('.composer-actions [data-act="send"]');
    var imgBtn = document.querySelector('.composer-actions [data-act="image"]');
    var attach = document.querySelector('.composer-attach');
    if (!stream || !input || !sendBtn) return;

    var SHOT = document.documentElement.classList.contains('shot');
    var THINK_MS = SHOT ? 0 : 460;
    var busy = false;

    function scrollEnd() {
      stream.scrollTo({ top: stream.scrollHeight, behavior: SHOT ? 'auto' : 'smooth' });
    }
    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.max(62, Math.min(150, input.scrollHeight)) + 'px';
    }
    function refreshSend() {
      sendBtn.disabled = busy || (!input.value.trim() && !chatCtx.pendingImg);
    }
    function remember(el) {
      el.classList.remove('is-new');
      chatLog.push(el.outerHTML);
    }

    /* 发送：用户消息 → 思考态 → 回复 */
    function submit() {
      if (busy) return;
      var text = input.value.trim();
      var img = chatCtx.pendingImg;
      if (!text && !img) return;

      var mine = document.createElement('div');
      mine.className = 'msg msg-user is-new';
      mine.innerHTML = '<div class="msg-body"><div class="msg-name"><strong>我</strong></div>' +
        '<div class="msg-bubble">' +
        (img ? '<div class="msg-photo">' + ICO.image + '<span>' + esc(img.name) + '</span></div>' : '') +
        (text ? txt(esc(text)) : '') +
        '</div></div>';
      stream.appendChild(mine);
      remember(mine);

      input.value = '';
      autoGrow();
      chatCtx.pendingImg = null;
      attach.classList.remove('is-on');
      busy = true;
      refreshSend();
      scrollEnd();

      var holder = document.createElement('div');
      holder.className = 'msg is-new';
      holder.innerHTML = '<span class="msg-avatar" aria-hidden="true">' + AVATAR + '</span>' +
        '<div class="msg-body"><div class="msg-name"><strong>知微</strong></div>' +
        '<div class="thinking"><span class="thinking-dots"><i></i><i></i><i></i></span>' +
        '<span class="thinking-text">在看你的思路…</span></div></div>';
      stream.appendChild(holder);
      scrollEnd();

      setTimeout(function () {
        var r = COACH.reply(text, chatCtx, !!img);
        holder.innerHTML = '<span class="msg-avatar" aria-hidden="true">' + AVATAR + '</span>' +
          '<div class="msg-body"><div class="msg-name"><strong>知微</strong>' +
          (r.tag ? '<span class="tag">' + esc(r.tag) + '</span>' : '') + '</div>' + r.html + '</div>';
        remember(holder);
        busy = false;
        refreshSend();
        scrollEnd();
      }, THINK_MS);
    }

    /* 输入区 */
    input.addEventListener('input', function () { autoGrow(); refreshSend(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        submit();
      }
    });
    sendBtn.addEventListener('click', submit);

    /* 传图读题：先挂到输入区，和消息一起发出 */
    imgBtn.addEventListener('click', function () {
      if (chatCtx.pendingImg) return;
      chatCtx.pendingImg = { name: 'IMG_2043.jpg' };
      attach.classList.add('is-on');
      refreshSend();
      input.focus();
    });
    attach.querySelector('.attach-x').addEventListener('click', function () {
      chatCtx.pendingImg = null;
      attach.classList.remove('is-on');
      refreshSend();
    });

    /* 候选入口点了就发出去 */
    stream.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.choice') : null;
      if (!btn) return;
      input.value = btn.dataset.fill;
      autoGrow();
      refreshSend();
      submit();
    });

    autoGrow();
    refreshSend();
    scrollEnd();
  }

  /* ==================================================== 4. 知识图谱 ===== */
  function pageGraph() {
    var W = G.meta.width, H = G.meta.height;

    /* 连线：两端按半径收缩，箭头轻量指示先修方向 */
    var edgeSvg = G.edges.map(function (e, i) {
      var A = G.nodes[e.a], B = G.nodes[e.b];
      var dx = B.x - A.x, dy = B.y - A.y;
      var d = Math.hypot(dx, dy) || 1;
      var x1 = A.x + dx / d * (A.r + 3), y1 = A.y + dy / d * (A.r + 3);
      var x2 = B.x - dx / d * (B.r + 8), y2 = B.y - dy / d * (B.r + 8);
      return '<line class="edge' + (e.cross ? ' is-cross' : '') + '" data-e="' + i + '" data-a="' + e.a +
        '" data-b="' + e.b + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" marker-end="url(#zwArrow)"/>';
    }).join('');

    var nodeSvg = G.nodes.map(function (n, i) {
      return '<g class="node band-' + n.band + '" data-i="' + i + '" tabindex="0" role="button" ' +
        'aria-label="' + esc(n.name) + '，' + bandOf(n.band).label + '，正确率 ' + n.accuracy + '%" ' +
        'transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle class="node-halo" r="' + (n.r + 8) + '"/>' +
        (n.band === 'weak' ? '<circle class="node-ring" r="' + (n.r + 3.6) + '"/>' : '') +
        '<circle class="node-dot" r="' + n.r + '"/>' +
        '<text class="node-label" y="' + (n.r + 15) + '">' + esc(n.short) + '</text>' +
        '</g>';
    }).join('');

    var legend = G.bands.map(function (b) {
      return '<li><i class="legend-sw band-' + b.key + '"></i>' +
        '<span class="legend-name">' + b.label + '</span>' +
        '<span class="legend-count">' + b.count + '</span></li>';
    }).join('');

    return pageHead('知识图谱',
      '节点颜色表示掌握程度，连线表示先修关系。悬停任一节点，可查看它的邻域与学习详情。',
      '<span class="tag">' + ICO.check + '共 ' + G.meta.nodeCount + ' 个知识点</span>'
      ) +
      '<section class="graph-frame" id="graphFrame">' +
        '<svg class="graph-svg" id="graphSvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
          'aria-label="初中数学知识图谱，' + G.meta.nodeCount + ' 个知识点，' + G.meta.edgeCount + ' 条先修关系">' +
          '<defs><marker id="zwArrow" viewBox="0 0 6 6" refX="5.2" refY="3" markerWidth="5.6" markerHeight="5.6" orient="auto">' +
            '<path class="edge-arrow" d="M.4.6 5.4 3 .4 5.4z"/></marker></defs>' +
          '<g class="edge-layer">' + edgeSvg + '</g>' +
          '<g class="node-layer">' + nodeSvg + '</g>' +
        '</svg>' +

        '<aside class="legend">' +
          '<div class="legend-head"><h3>掌握程度</h3><span>' + G.meta.nodeCount + ' 个节点</span></div>' +
          '<ul class="legend-list">' + legend + '</ul>' +
          '<div class="legend-foot">' + G.meta.edgeCount + ' 条先修关系 · 虚线为跨章节</div>' +
        '</aside>' +

        '<div class="canvas-foot">' +
          '<span>知识库 ' + esc(G.meta.knowledgeBase) + '</span><i></i>' +
          '<span>更新于 ' + esc(G.meta.updated) + '</span><i></i>' +
          '<span>' + esc(G.meta.standard) + '</span>' +
        '</div>' +

        '<div class="tip" id="graphTip" role="tooltip" aria-hidden="true"></div>' +
      '</section>';
  }

  /* 图谱交互：悬停/聚焦 → 高亮邻域 + 详情浮层 */
  function mountGraph() {
    var svg = document.getElementById('graphSvg');
    var frame = document.getElementById('graphFrame');
    var tip = document.getElementById('graphTip');
    if (!svg || !frame || !tip) return;

    var nodes = svg.querySelectorAll('.node');
    var edges = svg.querySelectorAll('.edge');
    var scale = frame.clientWidth / G.meta.width;

    var adj = {};
    G.nodes.forEach(function (_, i) { adj[i] = {}; });
    G.edges.forEach(function (e) { adj[e.a][e.b] = 1; adj[e.b][e.a] = 1; });

    function show(idx) {
      var n = G.nodes[idx];
      var around = adj[idx];
      var related = Object.keys(around).map(function (k) { return +k; });

      svg.classList.add('is-focus');
      nodes.forEach(function (el) {
        var i = +el.dataset.i;
        el.classList.toggle('is-on', i === idx || around[i] === 1);
      });
      edges.forEach(function (el) {
        el.classList.toggle('is-on', +el.dataset.a === idx || +el.dataset.b === idx);
      });

      var pre = [], suc = [];
      G.edges.forEach(function (e) {
        if (e.b === idx) pre.push(G.nodes[e.a].short);
        if (e.a === idx) suc.push(G.nodes[e.b].short);
      });
      var b = bandOf(n.band);
      tip.innerHTML =
        '<div class="tip-head"><div>' +
          '<div class="tip-name">' + esc(n.name) + '</div>' +
          '<div class="tip-chapter">' + esc(n.chapter) + ' · ' + esc(n.grade) + ' · 难度 ' + n.difficulty + '/5</div>' +
        '</div>' + bandTag(n.band) + '</div>' +
        '<dl class="tip-grid">' +
          '<div><dt>正确率</dt><dd>' + n.accuracy + '%</dd></div>' +
          '<div><dt>练习次数</dt><dd>' + n.attempts + '</dd></div>' +
          '<div><dt>常见错因</dt><dd>' + n.errors + ' 类</dd></div>' +
          '<div><dt>最近练习</dt><dd>' + agoText(n.ago) + '</dd></div>' +
        '</dl>' +
        '<div class="tip-err">' + b.label + '：' + esc(b.desc) + '<br>先修 ' +
          (pre.length ? esc(pre.join('、')) : '无') + ' · 后继 ' + (suc.length ? esc(suc.join('、')) : '无') + '</div>';
      tip.classList.add('is-on');
      tip.setAttribute('aria-hidden', 'false');

      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var nx = n.x * scale, ny = n.y * scale;
      var left = nx + n.r * scale + 16;
      if (left + tw > frame.clientWidth - 10) left = nx - n.r * scale - 16 - tw;
      if (left < 10) left = Math.min(Math.max(10, nx - tw / 2), frame.clientWidth - tw - 10);
      var top = ny - 30;
      top = Math.max(10, Math.min(top, frame.clientHeight - th - 10));
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }

    function hide() {
      svg.classList.remove('is-focus');
      nodes.forEach(function (el) { el.classList.remove('is-on'); });
      edges.forEach(function (el) { el.classList.remove('is-on'); });
      tip.classList.remove('is-on');
      tip.setAttribute('aria-hidden', 'true');
    }

    nodes.forEach(function (el) {
      var i = +el.dataset.i;
      el.addEventListener('mouseenter', function () { show(i); });
      el.addEventListener('focus', function () { show(i); });
      el.addEventListener('blur', hide);
    });
    svg.addEventListener('mouseleave', hide);
    frame.addEventListener('mouseleave', hide);
    window.addEventListener('resize', function () {
      scale = frame.clientWidth / G.meta.width;
      if (tip.classList.contains('is-on')) hide();
    });
  }

  /* ==================================================== 5. 学习报告 ===== */
  function trendChart() {
    var W = 720, H = 214, PL = 46, PR = 20, PT = 22, PB = 30;
    var vals = [62, 64, 61, 68, 71, 69, 74, 72, 76, 79, 77, 81, 80, 84];
    var days = ['09-09', '09-10', '09-11', '09-12', '09-13', '09-14', '09-15', '09-16',
      '09-17', '09-18', '09-19', '09-20', '09-21', '09-22'];
    var min = 60, max = 92, target = 80;

    function X(i) { return PL + (W - PL - PR) * i / (vals.length - 1); }
    function Y(v) { return PT + (H - PT - PB) * (1 - (v - min) / (max - min)); }

    var grid = [60, 70, 80, 90].map(function (v) {
      return '<line class="chart-grid" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>' +
        '<text class="chart-axis" x="' + (PL - 9) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + v + '</text>';
    }).join('');

    var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    /* 面积基线落在已标注的 60 线上，避免出现无刻度参照的色块 */
    var area = line + ' L' + X(vals.length - 1).toFixed(1) + ' ' + Y(min).toFixed(1) +
      ' L' + X(0).toFixed(1) + ' ' + Y(min).toFixed(1) + ' Z';
    var dots = vals.map(function (v, i) {
      var last = i === vals.length - 1;
      return '<circle class="' + (last ? 'chart-dot-last' : 'chart-dot') + '" cx="' + X(i).toFixed(1) +
        '" cy="' + Y(v).toFixed(1) + '" r="' + (last ? 4.4 : 2.8) + '"/>';
    }).join('');

    var xlab = [0, 4, 8, 13].map(function (i) {
      return '<text class="chart-axis" x="' + X(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + days[i] + '</text>';
    }).join('');

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="近 14 天练习正确率，从 62% 提升到 84%">' +
      '<defs><linearGradient id="zwGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#42a5f5" stop-opacity=".20"/>' +
        '<stop offset="1" stop-color="#42a5f5" stop-opacity="0"/></linearGradient></defs>' +
      grid +
      '<line class="chart-target" x1="' + PL + '" x2="' + (W - PR) + '" y1="' + Y(target).toFixed(1) + '" y2="' + Y(target).toFixed(1) + '"/>' +
      '<path class="chart-area" d="' + area + '"/>' +
      '<path class="chart-line" d="' + line + '"/>' + dots + xlab +
      '<text class="chart-label" x="' + (X(vals.length - 1) - 4).toFixed(1) + '" y="' + (Y(84) - 12).toFixed(1) + '" text-anchor="end">84%</text>' +
      '</svg>';
  }

  function pageReport() {
    var kpis = [
      { label: '达标知识点', num: D.mastered, unit: '/ ' + D.total + ' 个', foot: ICO.check + '已掌握 ' + bandOf('solid').count + ' · 基本掌握 ' + bandOf('basic').count },
      { label: '知识点平均正确率', num: D.avgAcc, unit: '%', foot: ICO.alert + '最低：' + esc(D.weakest.chapter) + ' · ' + esc(D.weakest.short) + ' ' + D.weakest.accuracy + '%' },
      { label: '累计练习', num: D.attempts, unit: '次', foot: ICO.chart + '近 7 天 ' + D.recent + ' 次' },
      { label: '待巩固知识点', num: D.weak.length, unit: '个', foot: ICO.alert + '集中在 ' + esc(D.weakChapters.join('、')) }
    ].map(function (k) {
      return '<article class="card kpi">' +
        '<div class="kpi-label">' + k.label + '</div>' +
        '<div class="kpi-value"><span class="num">' + k.num + '</span><span class="unit">' + k.unit + '</span></div>' +
        '<div class="kpi-foot">' + k.foot + '</div>' +
        '</article>';
    }).join('');

    var chaps = G.chapters.map(function (c) {
      var k = bandForLevel(c.level);
      return '<div class="chap-row">' +
        '<span class="chap-name">' + esc(c.name) + '</span>' +
        '<span class="chap-meta chap-count">' + c.count + ' 个 · ' + c.avgAccuracy + '%</span>' +
        '<span class="chap-meter">' + meter(c.level, k) + '</span>' +
        '<span class="chap-pct">' + c.level + '%</span>' +
        '</div>';
    }).join('');

    var rows = D.byAcc.slice(0, 8).map(function (n) {
      return '<tr>' +
        '<td><div class="cell-name">' + esc(n.name) + '</div>' +
          '<div class="cell-sub">难度 ' + n.difficulty + '/5 · 常见错因 ' + n.errors + ' 类</div></td>' +
        '<td><span class="t-sub">' + esc(n.chapter) + '</span></td>' +
        '<td class="col-num"><span class="t-num" style="font-weight:600;color:var(--ink)">' + n.accuracy + '%</span></td>' +
        '<td><div class="cell-meter">' + meter(n.accuracy, n.band) + '</div></td>' +
        '<td>' + bandTag(n.band) + '</td>' +
        '<td><span class="t-sub t-num">' + agoText(n.ago) + '</span></td>' +
        '</tr>';
    }).join('');

    return pageHead('学习报告',
      '数据来自 ' + D.attempts + ' 次作答记录，随每次练习实时更新。报告口径：知识图谱掌握度 + 作答正确率。',
      '<div class="seg" role="group" aria-label="时间范围">' +
        '<button type="button">近 7 天</button>' +
        '<button type="button" aria-pressed="true">近 30 天</button>' +
        '<button type="button">本学期</button></div>'
      ) +

      '<section class="grid grid-4">' + kpis + '</section>' +

      '<section class="section grid grid-7-5">' +
        '<article class="card">' +
          '<div class="card-head" style="padding:20px 24px 15px">' +
            '<h2 class="t-h2">近 14 天练习正确率</h2>' +
            '<span class="card-head-note">虚线为 80% 目标线</span>' +
          '</div>' +
          '<div style="padding:14px 20px 20px" class="chart-wrap">' + trendChart() + '</div>' +
        '</article>' +
        '<article class="card">' +
          '<div class="card-head" style="padding:20px 24px 15px">' +
            '<h2 class="t-h2">章节掌握度</h2>' +
            '<span class="card-head-note">共 ' + G.chapters.length + ' 个章节</span>' +
          '</div>' +
          '<div style="padding:6px 24px 12px">' + chaps + '</div>' +
        '</article>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head"><h2 class="t-h2">待巩固知识点</h2>' +
          '<span class="section-note">按正确率升序 · 共 ' + D.total + ' 个</span></div>' +
        '<div class="card" style="overflow:hidden">' +
          '<table class="table">' +
            '<thead><tr><th>知识点</th><th>章节</th><th style="text-align:right">正确率</th><th>掌握度</th><th>状态</th><th>最近练习</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
          '<div class="table-foot">' +
            '<span class="table-foot-note">显示 8 / ' + D.total + ' 个知识点</span>' +
            '<a class="section-link" href="#/graph">在知识图谱中查看</a>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* ======================================================== 6. 云盘 ===== */
  function pageDrive() {
    var files = [
      { n: '2026秋·九年级数学·第一次月考（含答案）.pdf', s: '2.4 MB', t: '今天 09:41', src: '我上传', tone: '', p: '测评试卷' },
      { n: '二次函数专题·顶点式与最值·练习卷.pdf', s: '1.6 MB', t: '今天 09:12', src: '系统生成', tone: 'is-drill', p: '测评试卷' },
      { n: '一元二次方程·配方法·错题整理.pdf', s: '0.9 MB', t: '昨天 20:15', src: '我上传', tone: 'is-drill', p: '错题整理' },
      { n: '学习报告_2026-09-18.pdf', s: '0.4 MB', t: '昨天 19:58', src: '系统生成', tone: 'is-report', p: '学习报告' },
      { n: '2026秋·八年级数学·期中模拟卷.pdf', s: '2.1 MB', t: '09-19 14:02', src: '共享给我', tone: '', p: '测评试卷' },
      { n: '函数图像与性质·课堂讲义.pdf', s: '3.2 MB', t: '09-17 10:26', src: '我上传', tone: '', p: '课堂资料' },
      { n: '几何综合题·专项训练 20 题.pdf', s: '1.4 MB', t: '09-15 16:40', src: '我上传', tone: 'is-drill', p: '专项训练' },
      { n: '初中数学·知识图谱说明（2022课标）.pdf', s: '0.6 MB', t: '09-12 08:30', src: '系统生成', tone: 'is-report', p: '产品文档' }
    ];
    var totalMB = 12.6;

    var rows = files.map(function (f) {
      return '<tr>' +
        '<td><div class="file-cell"><span class="file-glyph ' + f.tone + '">' + ICO.file + '</span>' +
          '<div><div class="file-name">' + esc(f.n) + '</div>' +
          '<div class="file-path">' + esc(f.p) + '</div></div></div></td>' +
        '<td><span class="t-sub t-num">PDF · ' + f.s + '</span></td>' +
        '<td><span class="t-sub t-num">' + f.t + '</span></td>' +
        '<td><span class="t-sub">' + f.src + '</span></td>' +
        '<td><span class="file-act">' +
          '<button class="icon-btn" type="button" title="下载">' + ICO.download + '</button>' +
          '<button class="icon-btn" type="button" title="更多操作">' + ICO.more + '</button>' +
        '</span></td>' +
        '</tr>';
    }).join('');

    return pageHead('云盘',
      '存放测评试卷、错题整理与导出的学习报告。上传的题目图片会被自动识别并归类到对应知识点。',
      '<button class="btn btn-primary btn-lg" type="button">' + ICO.upload + '上传</button>'
      ) +

      '<div class="card" style="margin-bottom:16px">' +
        '<div class="toolbar">' +
          '<nav class="crumb" aria-label="路径">' +
            '<span>云盘</span><span class="crumb-sep">/</span>' +
            '<span>初中数学 · 默认空间</span><span class="crumb-sep">/</span>' +
            '<b>全部文件</b>' +
          '</nav>' +
          '<span class="toolbar-sep" aria-hidden="true"></span>' +
          '<div class="seg" role="group" aria-label="文件筛选">' +
            '<button type="button" aria-pressed="true">全部</button>' +
            '<button type="button">我上传的</button>' +
            '<button type="button">共享给我</button>' +
          '</div>' +
          '<div class="search">' + ICO.search +
            '<input type="search" placeholder="搜索文件名或知识点" aria-label="搜索文件">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="overflow:hidden">' +
        '<table class="table">' +
          '<thead><tr><th>文件名</th><th>类型 · 大小</th><th>更新时间</th><th>来源</th><th style="text-align:right">操作</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '<div class="table-foot">' +
          '<span class="table-foot-note">' + files.length + ' 个文件 · 共 ' + totalMB + ' MB</span>' +
          '<a class="section-link" href="#/report">导出全部学习报告</a>' +
        '</div>' +
      '</div>';
  }

  /* ========================================================= 路由 ===== */
  var ROUTES = [
    { hash: '#/space', title: '学习空间', render: pageSpace, mount: null },
    { hash: '#/assessment', title: '测评', render: pageAssessment, mount: null },
    { hash: '#/chat', title: '对话辅导', render: pageChat, mount: mountChat },
    { hash: '#/graph', title: '知识图谱', render: pageGraph, mount: mountGraph },
    { hash: '#/report', title: '学习报告', render: pageReport, mount: null },
    { hash: '#/drive', title: '云盘', render: pageDrive, mount: null }
  ];

  function route() {
    var hash = location.hash || '#/space';
    var r = ROUTES.filter(function (x) { return x.hash === hash; })[0] || ROUTES[0];

    document.getElementById('view').innerHTML = r.render();
    document.title = '知微 · ' + r.title;

    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].dataset.route === r.hash) tabs[i].setAttribute('aria-current', 'page');
      else tabs[i].removeAttribute('aria-current');
    }
    if (r.mount) r.mount();
    window.scrollTo(0, 0);
  }

  /* 截图模式：跳过入场动画，保证取到终态 */
  if (/[?&]shot=1/.test(location.search)) document.documentElement.classList.add('shot');

  window.addEventListener('hashchange', route);
  route();
})();
