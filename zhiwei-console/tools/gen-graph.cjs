/**
 * 从真实知识库 zhiwei-analysis/data/knowledge/math/cz.json 生成知识图谱布局。
 * 输出 zhiwei-console/data/knowledge-graph.js（经典脚本，window.ZW_GRAPH）
 *
 * 布局 = 章节聚簇的确定性力导向（seeded PRNG）+ 标签感知去重叠 + 自检。
 * 关键点：中文知识点名较长，节点间距必须按「标签包围盒」而非「圆点半径」计算，
 * 否则画布上标签会互相压住。生成后打印重叠对数，必须为 0。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'zhiwei-analysis', 'data', 'knowledge', 'math', 'cz.json');
const OUT = path.resolve(__dirname, '..', 'data', 'knowledge-graph.js');

const W = 1180, H = 700, PAD = 58;

const BANDS = [
  { key: 'solid', label: '已掌握', desc: '连续 3 次正确，可迁移到新题' },
  { key: 'basic', label: '基本掌握', desc: '常规题稳定，变式题偶有失误' },
  { key: 'waver', label: '不稳定', desc: '正确率波动，依赖题目形式' },
  { key: 'weak', label: '待巩固', desc: '概念或步骤存在明确缺口' }
];

const BAND_OF = {
  'math.cz.algebra.basic': 'solid',
  'math.cz.function.concept': 'solid',
  'math.cz.quadratic.eq_concept': 'solid',
  'math.cz.quadratic.concept': 'solid',
  'math.cz.quadratic.graph_basic': 'solid',
  'math.cz.quadratic.factoring': 'solid',
  'math.cz.quadratic.formula': 'solid',

  'math.cz.algebra.identity': 'basic',
  'math.cz.function.graph': 'basic',
  'math.cz.quadratic.vertex_form': 'basic',
  'math.cz.quadratic.opening': 'basic',
  'math.cz.quadratic.three_points': 'basic',
  'math.cz.quadratic.application': 'basic',

  'math.cz.function.linear': 'waver',
  'math.cz.quadratic.completing_square': 'waver',
  'math.cz.quadratic.translation': 'waver',
  'math.cz.quadratic.extremum': 'waver',

  'math.cz.quadratic.general_to_vertex': 'weak',
  'math.cz.quadratic.eq_relation': 'weak',
  'math.cz.quadratic.geometry': 'weak'
};

const SHORT = {
  'math.cz.algebra.basic': '代数式求值',
  'math.cz.algebra.identity': '完全平方公式',
  'math.cz.function.concept': '函数概念',
  'math.cz.function.graph': '函数图像',
  'math.cz.function.linear': '一次函数',
  'math.cz.quadratic.eq_concept': '方程概念',
  'math.cz.quadratic.completing_square': '配方法',
  'math.cz.quadratic.formula': '求根公式',
  'math.cz.quadratic.factoring': '因式分解法',
  'math.cz.quadratic.concept': '二次函数概念',
  'math.cz.quadratic.graph_basic': 'y=ax² 图像',
  'math.cz.quadratic.opening': '开口与对称轴',
  'math.cz.quadratic.vertex_form': '顶点式',
  'math.cz.quadratic.general_to_vertex': '一般式↔顶点式',
  'math.cz.quadratic.translation': '抛物线平移',
  'math.cz.quadratic.extremum': '最值',
  'math.cz.quadratic.three_points': '待定系数法',
  'math.cz.quadratic.eq_relation': '与方程的关系',
  'math.cz.quadratic.application': '实际应用',
  'math.cz.quadratic.geometry': '几何综合'
};

/* 章节聚簇中心：刻意做成不等距，避免规整网格感 */
const CH = [
  { key: '代数式',       cx: 268, cy: 168, seed: 11 },
  { key: '函数',         cx: 236, cy: 512, seed: 23 },
  { key: '一元二次方程', cx: 632, cy: 176, seed: 37 },
  { key: '二次函数',     cx: 872, cy: 438, seed: 53 }
];

const ACCURACY = { solid: [88, 97], basic: [76, 86], waver: [62, 74], weak: [41, 58] };
const DAYS = { solid: [1, 5], basic: [1, 9], waver: [2, 14], weak: [5, 21] };
const LABEL_FS = 12, LABEL_H = 15;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* 近似文本宽度：CJK 全角 12px，其余 6.6px */
function textWidth(s) {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0) > 0x2e80 ? LABEL_FS : LABEL_FS * 0.55;
  return +w.toFixed(1);
}

const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const idx = new Map();
const nodes = raw.nodes.map((n, i) => {
  idx.set(n.id, i);
  const band = BAND_OF[n.id] || 'basic';
  const rng = mulberry32((i + 1) * 7919);
  const [aLo, aHi] = ACCURACY[band];
  const [dLo, dHi] = DAYS[band];
  const short = SHORT[n.id] || n.name;
  const lw = textWidth(short);
  return {
    id: n.id, name: n.name, short,
    chapter: n.chapter, grade: n.grade, difficulty: n.difficulty,
    errors: (n.typical_errors || []).length,
    items: (n.sample_items || []).length,
    band,
    accuracy: Math.round(aLo + rng() * (aHi - aLo)),
    attempts: 3 + Math.round(rng() * 21),
    ago: Math.round(dLo + rng() * (dHi - dLo)),
    r: +(7.6 + n.difficulty * 1.55).toFixed(1),
    lw,
    ex: 0, // 排除半径
    x: 0, y: 0
  };
});
nodes.forEach((n) => { n.ex = Math.max(n.r + 10, n.lw / 2 + 5); });

const edges = [];
for (const n of raw.nodes) {
  const to = idx.get(n.id);
  for (const p of n.prerequisites || []) {
    if (idx.has(p)) edges.push({ a: idx.get(p), b: to });
  }
}

/* 初始化：章节星团内随机撒点 */
CH.forEach((c) => { c.items = []; });
nodes.forEach((n) => CH.find((c) => c.key === n.chapter).items.push(n));
CH.forEach((c) => {
  const rng = mulberry32(c.seed);
  const ring = 26 + c.items.length * 12;
  c.items.forEach((n, k) => {
    const a = (k / c.items.length) * Math.PI * 2 + rng() * 0.8;
    const rr = c.items.length === 1 ? 0 : ring * (0.5 + rng() * 0.7);
    n.x = c.cx + Math.cos(a) * rr;
    n.y = c.cy + Math.sin(a) * rr;
  });
});

/* 力导向：rep 用「排除半径」之和推挤，让标签也有位置 */
const K_REP = 1.0, K_SPRING = 0.075, L = 132, K_CLUSTER = 0.055, K_CENTER = 0.004;
const cx0 = W / 2, cy0 = H / 2;

for (let it = 0; it < 1400; it++) {
  const t = 16 * Math.pow(0.22, it / 1400) + 0.3;
  const fx = new Float64Array(nodes.length), fy = new Float64Array(nodes.length);

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const min = nodes[i].ex + nodes[j].ex;
      let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
      let d = Math.hypot(dx, dy);
      if (d < 0.5) { const a = (i * 2.399 + j); dx = Math.cos(a); dy = Math.sin(a); d = 1; }
      const f = (K_REP * min * min) / Math.max(d * d, 400);
      const ux = dx / d, uy = dy / d;
      fx[i] -= ux * f; fy[i] -= uy * f;
      fx[j] += ux * f; fy[j] += uy * f;
    }
  }
  for (const e of edges) {
    const A = nodes[e.a], B = nodes[e.b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.max(Math.hypot(dx, dy), 1);
    const f = K_SPRING * (d - L);
    const ux = dx / d, uy = dy / d;
    fx[e.a] += ux * f; fy[e.a] += uy * f;
    fx[e.b] -= ux * f; fy[e.b] -= uy * f;
  }
  for (const c of CH) {
    const n = c.items.length;
    const mx = c.items.reduce((s, x) => s + x.x, 0) / n;
    const my = c.items.reduce((s, x) => s + x.y, 0) / n;
    for (const x of c.items) {
      const k = idx.get(x.id);
      fx[k] += (c.cx - mx) * K_CLUSTER;
      fy[k] += (c.cy - my) * K_CLUSTER;
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    fx[i] += (cx0 - n.x) * K_CENTER;
    fy[i] += (cy0 - n.y) * K_CENTER;
    const disp = Math.hypot(fx[i], fy[i]);
    if (disp < 1e-9) continue;
    const step = Math.min(disp, t);
    n.x += (fx[i] / disp) * step;
    n.y += (fy[i] / disp) * step;
    n.x = Math.min(W - PAD, Math.max(PAD, n.x));
    n.y = Math.min(H - PAD, Math.max(PAD, n.y));
  }
}

/* 右上角为图例预留的空区（SVG 坐标）：布局必须避开，否则图例会压住节点 */
const LEGEND = { x1: 1180 - 262, y1: 0, x2: 1180, y2: 228 };

/* 标签包围盒 */
function labelBox(n) {
  return { x1: n.x - n.lw / 2 - 3, x2: n.x + n.lw / 2 + 3, y1: n.y + n.r + 4, y2: n.y + n.r + 4 + LABEL_H };
}
function circleBox(n) {
  return { x1: n.x - n.r, x2: n.x + n.r, y1: n.y - n.r, y2: n.y + n.r };
}
function hit(a, b, gap = 2) {
  return a.x1 - gap < b.x2 && b.x1 - gap < a.x2 && a.y1 - gap < b.y2 && b.y1 - gap < a.y2;
}
function nodeBox(n) {
  const b = labelBox(n), c = circleBox(n);
  return { x1: Math.min(b.x1, c.x1), x2: Math.max(b.x2, c.x2), y1: Math.min(b.y1, c.y1), y2: Math.max(b.y2, c.y2) };
}
/* 把落进图例区的节点推出去：向左或向下取更近的一侧 */
function avoidLegend(n) {
  const z = { x1: LEGEND.x1 - 10, y1: LEGEND.y1 - 10, x2: 1e9, y2: LEGEND.y2 + 10 };
  if (!hit(nodeBox(n), z, 0)) return 0;
  const bb = nodeBox(n);
  const pushLeft = bb.x2 - z.x1 + 2;
  const pushDown = z.y2 - bb.y1 + 2;
  if (pushLeft <= pushDown) { n.x -= pushLeft; return 1; }
  n.y += pushDown; return 1;
}

/* 硬约束松弛：圆点互斥 + 标签互斥 + 标签不压别人的圆点 + 避开图例区 */
let overlap = 0, maxGap = 0;
for (let pass = 0; pass < 900; pass++) {
  let moved = 0;
  const push = (i, j, dx, dy, d, need, strength) => {
    const amt = (need - d) * strength;
    const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0.3;
    nodes[i].x -= ux * amt / 2; nodes[i].y -= uy * amt / 2;
    nodes[j].x += ux * amt / 2; nodes[j].y += uy * amt / 2;
    moved++;
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i], B = nodes[j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy);
      /* 1) 圆点 vs 圆点 */
      const needDot = A.r + B.r + 12;
      if (d < needDot) { push(i, j, dx, dy, d, needDot, 0.5); continue; }
      /* 2) A 的标签 vs B 的圆点 */
      const ab = labelBox(A), aa = circleBox(A);
      const bb = labelBox(B), ba = circleBox(B);
      if (hit(ab, ba, 3) || hit(bb, aa, 3)) {
        const dxa = dx === 0 ? 0.4 : dx, dya = dy === 0 ? 0.4 : dy;
        push(i, j, dxa, dya, Math.max(d, 0.5), Math.max(A.ex + B.ex, 96), 0.42);
        continue;
      }
      /* 3) 标签 vs 标签：横向多推，因为中文标签是横长条 */
      if (hit(ab, bb, 3)) {
        const horizOnly = 0.5;
        const ux = dx >= 0 ? 1 : -1;
        nodes[i].x -= ux * 3.2; nodes[j].x += ux * 3.2;
        nodes[i].y -= dya * horizOnly * 0.06; nodes[j].y += dya * horizOnly * 0.06;
        moved++;
      }
    }
  }
  /* 4) 图例预留区 */
  for (let i = 0; i < nodes.length; i++) moved += avoidLegend(nodes[i]);

  if (!moved) {
    let bad = 0;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y) < nodes[i].r + nodes[j].r + 12) bad++;
      }
    if (!bad) break;
  }
}

/* 统计最终重叠与最小圆点间距（在缩放前统计，缩放为等比，关系不变） */
let minPairDist = 1e9;
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    minPairDist = Math.min(minPairDist, Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y) - nodes[i].r - nodes[j].r);
    const la = labelBox(nodes[i]), lb = labelBox(nodes[j]);
    if (hit(la, lb) || hit(la, circleBox(nodes[j])) || hit(lb, circleBox(nodes[i]))) overlap++;
  }
}

/* 居中并适度放大填满画布：等比缩放，标签相应放大但不超过类型标度的上限 */
let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
nodes.forEach((n) => {
  const b = labelBox(n);
  minX = Math.min(minX, b.x1);
  maxX = Math.max(maxX, b.x2);
  minY = Math.min(minY, circleBox(n).y1);
  maxY = Math.max(maxY, b.y2);
});
const availW = W - PAD * 2, availH = H - PAD * 2;
const s = Math.min(1.2, availW / (maxX - minX), availH / (maxY - minY));
nodes.forEach((n) => {
  n.x = PAD + (n.x - minX) * s + (availW - (maxX - minX) * s) / 2;
  n.y = PAD + (n.y - minY) * s + (availH - (maxY - minY) * s) / 2;
  n.x = +n.x.toFixed(1); n.y = +n.y.toFixed(1);
  n.r = +(n.r * s).toFixed(1); n.lw = +(n.lw * s).toFixed(1);
});

/* 缩放后复核：图例区是否被侵入 */
const legendHits = nodes.filter((n) =>
  nodeBox(n).x1 < LEGEND.x2 && LEGEND.x1 < nodeBox(n).x2 &&
  nodeBox(n).y1 < LEGEND.y2 && LEGEND.y1 < nodeBox(n).y2).length;

/* 章节统计（用于图例与报告页） */
const chapters = CH.map((c) => {
  const its = c.items.map((n) => nodes[idx.get(n.id)]);
  const rank = { solid: 0, basic: 1, waver: 2, weak: 3 };
  const mastery = { solid: 0, basic: 0, waver: 0, weak: 0 };
  its.forEach((n) => { mastery[n.band]++; });
  const level = Math.round(((mastery.solid + mastery.basic * 0.6 + mastery.waver * 0.25) / its.length) * 100);
  return {
    name: c.key,
    count: its.length,
    avgAccuracy: Math.round(its.reduce((s2, n) => s2 + n.accuracy, 0) / its.length),
    mastery,
    level,
    weakest: its.slice().sort((a, b) => rank[b.band] - rank[a.band])[0].short,
    cx: +c.cx.toFixed(0), cy: +c.cy.toFixed(0)
  };
});

const bandCount = nodes.reduce((acc, n) => { acc[n.band] = (acc[n.band] || 0) + 1; return acc; }, {});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT,
  '/* 由 tools/gen-graph.cjs 从 zhiwei-analysis/data/knowledge/math/cz.json 生成，请勿手改 */\n' +
  'window.ZW_GRAPH = ' + JSON.stringify({
    meta: {
      title: '初中数学', knowledgeBase: raw.meta.kb_id, standard: raw.meta.primary_standard,
      nodeCount: nodes.length, edgeCount: edges.length, updated: '2026-09-22',
      width: W, height: H, labelFontSize: LABEL_FS, labelHeight: LABEL_H,
      legendSafe: LEGEND
    },
    bands: BANDS.map((b) => ({ ...b, count: bandCount[b.key] || 0 })),
    chapters,
    nodes,
    edges: edges.map((e) => ({ ...e, cross: nodes[e.a].chapter !== nodes[e.b].chapter }))
  }, null, 1) + ';\n', 'utf8');

fs.writeFileSync(path.resolve(__dirname, '..', '..', '_graph-report.txt'), [
  `nodes=${nodes.length} edges=${edges.length} crossChapter=${edges.filter((e) => nodes[e.a].chapter !== nodes[e.b].chapter).length}`,
  `bands=${JSON.stringify(bandCount)}  chapters=${JSON.stringify(chapters.map((c) => c.name + ':' + c.count + '/' + c.level + '%'))}`,
  `LABEL_OVERLAP=${overlap}  MIN_DOT_GAP=${minPairDist.toFixed(1)}px  SCALE=${s.toFixed(3)}  LEGEND_HITS=${legendHits}`,
  `bbox=x[${minX.toFixed(0)},${maxX.toFixed(0)}] y[${minY.toFixed(0)},${maxY.toFixed(0)}]`,
  '---',
  ...nodes.map((n) => `${n.short.padEnd(9, '　')} (${n.x},${n.y}) r=${n.r} ex=${n.ex.toFixed(0)} ${n.band} ${n.accuracy}% ago=${n.ago}d`)
].join('\n'), 'utf8');
