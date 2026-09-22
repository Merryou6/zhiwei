/* 由 tools/gen-graph.cjs 从 zhiwei-analysis/data/knowledge/math/cz.json 生成，请勿手改 */
window.ZW_GRAPH = {
 "meta": {
  "title": "初中数学",
  "knowledgeBase": "kb_math_cz",
  "standard": "义务教育数学课程标准（2022年版）",
  "nodeCount": 20,
  "edgeCount": 27,
  "updated": "2026-09-22",
  "width": 1180,
  "height": 700,
  "labelFontSize": 12,
  "labelHeight": 15,
  "legendSafe": {
   "x1": 918,
   "y1": 0,
   "x2": 1180,
   "y2": 228
  }
 },
 "bands": [
  {
   "key": "solid",
   "label": "已掌握",
   "desc": "连续 3 次正确，可迁移到新题",
   "count": 7
  },
  {
   "key": "basic",
   "label": "基本掌握",
   "desc": "常规题稳定，变式题偶有失误",
   "count": 6
  },
  {
   "key": "waver",
   "label": "不稳定",
   "desc": "正确率波动，依赖题目形式",
   "count": 4
  },
  {
   "key": "weak",
   "label": "待巩固",
   "desc": "概念或步骤存在明确缺口",
   "count": 3
  }
 ],
 "chapters": [
  {
   "name": "代数式",
   "count": 2,
   "avgAccuracy": 90,
   "mastery": {
    "solid": 1,
    "basic": 1,
    "waver": 0,
    "weak": 0
   },
   "level": 80,
   "weakest": "完全平方公式",
   "cx": 268,
   "cy": 168
  },
  {
   "name": "函数",
   "count": 3,
   "avgAccuracy": 80,
   "mastery": {
    "solid": 1,
    "basic": 1,
    "waver": 1,
    "weak": 0
   },
   "level": 62,
   "weakest": "一次函数",
   "cx": 236,
   "cy": 512
  },
  {
   "name": "一元二次方程",
   "count": 4,
   "avgAccuracy": 88,
   "mastery": {
    "solid": 3,
    "basic": 0,
    "waver": 1,
    "weak": 0
   },
   "level": 81,
   "weakest": "配方法",
   "cx": 632,
   "cy": 176
  },
  {
   "name": "二次函数",
   "count": 11,
   "avgAccuracy": 72,
   "mastery": {
    "solid": 2,
    "basic": 4,
    "waver": 2,
    "weak": 3
   },
   "level": 45,
   "weakest": "一般式↔顶点式",
   "cx": 872,
   "cy": 438
  }
 ],
 "nodes": [
  {
   "id": "math.cz.algebra.basic",
   "name": "代数式与代入求值",
   "short": "代数式求值",
   "chapter": "代数式",
   "grade": "八年级",
   "difficulty": 1,
   "errors": 4,
   "items": 2,
   "band": "solid",
   "accuracy": 94,
   "attempts": 19,
   "ago": 3,
   "r": 11,
   "lw": 72,
   "ex": 35,
   "x": 159.5,
   "y": 205.7
  },
  {
   "id": "math.cz.algebra.identity",
   "name": "完全平方公式与配方变形",
   "short": "完全平方公式",
   "chapter": "代数式",
   "grade": "八年级",
   "difficulty": 2,
   "errors": 4,
   "items": 2,
   "band": "basic",
   "accuracy": 85,
   "attempts": 23,
   "ago": 4,
   "r": 12.8,
   "lw": 86.4,
   "ex": 41,
   "x": 349.3,
   "y": 166.2
  },
  {
   "id": "math.cz.function.concept",
   "name": "函数的概念与自变量取值范围",
   "short": "函数概念",
   "chapter": "函数",
   "grade": "八年级",
   "difficulty": 2,
   "errors": 4,
   "items": 2,
   "band": "solid",
   "accuracy": 97,
   "attempts": 6,
   "ago": 3,
   "r": 12.8,
   "lw": 57.6,
   "ex": 29,
   "x": 248.2,
   "y": 550.5
  },
  {
   "id": "math.cz.function.graph",
   "name": "函数的图像与描点法",
   "short": "函数图像",
   "chapter": "函数",
   "grade": "八年级",
   "difficulty": 2,
   "errors": 3,
   "items": 2,
   "band": "basic",
   "accuracy": 77,
   "attempts": 18,
   "ago": 9,
   "r": 12.8,
   "lw": 57.6,
   "ex": 29,
   "x": 455.9,
   "y": 553.5
  },
  {
   "id": "math.cz.function.linear",
   "name": "一次函数与待定系数法",
   "short": "一次函数",
   "chapter": "函数",
   "grade": "八年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "waver",
   "accuracy": 66,
   "attempts": 22,
   "ago": 5,
   "r": 14.8,
   "lw": 57.6,
   "ex": 29,
   "x": 257.3,
   "y": 383.8
  },
  {
   "id": "math.cz.quadratic.eq_concept",
   "name": "一元二次方程的概念与直接开平方法",
   "short": "方程概念",
   "chapter": "一元二次方程",
   "grade": "九年级",
   "difficulty": 2,
   "errors": 4,
   "items": 2,
   "band": "solid",
   "accuracy": 91,
   "attempts": 13,
   "ago": 4,
   "r": 12.8,
   "lw": 57.6,
   "ex": 29,
   "x": 468.3,
   "y": 262.5
  },
  {
   "id": "math.cz.quadratic.completing_square",
   "name": "配方法解一元二次方程",
   "short": "配方法",
   "chapter": "一元二次方程",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "waver",
   "accuracy": 70,
   "attempts": 10,
   "ago": 12,
   "r": 14.8,
   "lw": 43.2,
   "ex": 23,
   "x": 605.1,
   "y": 244.4
  },
  {
   "id": "math.cz.quadratic.formula",
   "name": "公式法与根的判别式",
   "short": "求根公式",
   "chapter": "一元二次方程",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "solid",
   "accuracy": 94,
   "attempts": 11,
   "ago": 2,
   "r": 14.8,
   "lw": 57.6,
   "ex": 29,
   "x": 782.8,
   "y": 174.4
  },
  {
   "id": "math.cz.quadratic.factoring",
   "name": "因式分解法解一元二次方程",
   "short": "因式分解法",
   "chapter": "一元二次方程",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "solid",
   "accuracy": 95,
   "attempts": 22,
   "ago": 4,
   "r": 14.8,
   "lw": 72,
   "ex": 35,
   "x": 514.8,
   "y": 78.7
  },
  {
   "id": "math.cz.quadratic.concept",
   "name": "二次函数的概念与一般式",
   "short": "二次函数概念",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 2,
   "errors": 3,
   "items": 2,
   "band": "solid",
   "accuracy": 92,
   "attempts": 15,
   "ago": 3,
   "r": 12.8,
   "lw": 86.4,
   "ex": 41,
   "x": 484.3,
   "y": 475.3
  },
  {
   "id": "math.cz.quadratic.graph_basic",
   "name": "y=ax2 的图像与性质",
   "short": "y=ax² 图像",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 2,
   "errors": 3,
   "items": 2,
   "band": "solid",
   "accuracy": 91,
   "attempts": 6,
   "ago": 3,
   "r": 12.8,
   "lw": 76.3,
   "ex": 36.8,
   "x": 681.9,
   "y": 531.2
  },
  {
   "id": "math.cz.quadratic.opening",
   "name": "开口方向、对称轴与增减性",
   "short": "开口与对称轴",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "basic",
   "accuracy": 85,
   "attempts": 13,
   "ago": 5,
   "r": 14.8,
   "lw": 86.4,
   "ex": 41,
   "x": 873.7,
   "y": 444.2
  },
  {
   "id": "math.cz.quadratic.vertex_form",
   "name": "二次函数的顶点式",
   "short": "顶点式",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "basic",
   "accuracy": 83,
   "attempts": 21,
   "ago": 5,
   "r": 14.8,
   "lw": 43.2,
   "ex": 23,
   "x": 735.2,
   "y": 460.8
  },
  {
   "id": "math.cz.quadratic.general_to_vertex",
   "name": "一般式与顶点式互化",
   "short": "一般式↔顶点式",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 4,
   "errors": 4,
   "items": 2,
   "band": "weak",
   "accuracy": 45,
   "attempts": 8,
   "ago": 7,
   "r": 16.6,
   "lw": 94.3,
   "ex": 44.3,
   "x": 854.8,
   "y": 596.7
  },
  {
   "id": "math.cz.quadratic.translation",
   "name": "抛物线的平移变换",
   "short": "抛物线平移",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 3,
   "items": 2,
   "band": "waver",
   "accuracy": 73,
   "attempts": 15,
   "ago": 6,
   "r": 14.8,
   "lw": 72,
   "ex": 35,
   "x": 958.1,
   "y": 468.1
  },
  {
   "id": "math.cz.quadratic.extremum",
   "name": "二次函数的最值",
   "short": "最值",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 3,
   "errors": 4,
   "items": 2,
   "band": "waver",
   "accuracy": 70,
   "attempts": 4,
   "ago": 4,
   "r": 14.8,
   "lw": 28.8,
   "ex": 22.3,
   "x": 935.6,
   "y": 531.5
  },
  {
   "id": "math.cz.quadratic.three_points",
   "name": "待定系数法求二次函数解析式",
   "short": "待定系数法",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 4,
   "errors": 3,
   "items": 2,
   "band": "basic",
   "accuracy": 76,
   "attempts": 8,
   "ago": 6,
   "r": 16.6,
   "lw": 72,
   "ex": 35,
   "x": 572.9,
   "y": 368.6
  },
  {
   "id": "math.cz.quadratic.eq_relation",
   "name": "二次函数与一元二次方程的关系",
   "short": "与方程的关系",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 4,
   "errors": 4,
   "items": 2,
   "band": "weak",
   "accuracy": 41,
   "attempts": 21,
   "ago": 20,
   "r": 16.6,
   "lw": 86.4,
   "ex": 41,
   "x": 954.6,
   "y": 276.3
  },
  {
   "id": "math.cz.quadratic.application",
   "name": "二次函数的实际应用",
   "short": "实际应用",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 4,
   "errors": 4,
   "items": 2,
   "band": "basic",
   "accuracy": 79,
   "attempts": 11,
   "ago": 8,
   "r": 16.6,
   "lw": 57.6,
   "ex": 29,
   "x": 1027.7,
   "y": 395.6
  },
  {
   "id": "math.cz.quadratic.geometry",
   "name": "抛物线与几何综合",
   "short": "几何综合",
   "chapter": "二次函数",
   "grade": "九年级",
   "difficulty": 5,
   "errors": 3,
   "items": 2,
   "band": "weak",
   "accuracy": 57,
   "attempts": 23,
   "ago": 19,
   "r": 18.4,
   "lw": 57.6,
   "ex": 29,
   "x": 819.5,
   "y": 368.5
  }
 ],
 "edges": [
  {
   "a": 0,
   "b": 1,
   "cross": false
  },
  {
   "a": 2,
   "b": 3,
   "cross": false
  },
  {
   "a": 2,
   "b": 4,
   "cross": false
  },
  {
   "a": 0,
   "b": 4,
   "cross": true
  },
  {
   "a": 1,
   "b": 5,
   "cross": true
  },
  {
   "a": 1,
   "b": 6,
   "cross": true
  },
  {
   "a": 5,
   "b": 6,
   "cross": false
  },
  {
   "a": 6,
   "b": 7,
   "cross": false
  },
  {
   "a": 5,
   "b": 8,
   "cross": false
  },
  {
   "a": 2,
   "b": 9,
   "cross": true
  },
  {
   "a": 5,
   "b": 9,
   "cross": true
  },
  {
   "a": 9,
   "b": 10,
   "cross": false
  },
  {
   "a": 3,
   "b": 10,
   "cross": true
  },
  {
   "a": 10,
   "b": 11,
   "cross": false
  },
  {
   "a": 6,
   "b": 12,
   "cross": true
  },
  {
   "a": 3,
   "b": 12,
   "cross": true
  },
  {
   "a": 12,
   "b": 13,
   "cross": false
  },
  {
   "a": 10,
   "b": 13,
   "cross": false
  },
  {
   "a": 12,
   "b": 14,
   "cross": false
  },
  {
   "a": 12,
   "b": 15,
   "cross": false
  },
  {
   "a": 9,
   "b": 16,
   "cross": false
  },
  {
   "a": 4,
   "b": 16,
   "cross": true
  },
  {
   "a": 11,
   "b": 17,
   "cross": false
  },
  {
   "a": 7,
   "b": 17,
   "cross": true
  },
  {
   "a": 15,
   "b": 18,
   "cross": false
  },
  {
   "a": 18,
   "b": 19,
   "cross": false
  },
  {
   "a": 16,
   "b": 19,
   "cross": false
  }
 ]
};
