/**
 * 知识图谱静态副本（D7）——**由 data/knowledge/math/cz.json 机械生成，禁止手改**。
 *
 * 为什么需要副本：契约 19 接口中没有任何「图谱结构 / 章节清单」下发接口，
 * 而前端页 2（自报章节）、页 4（scope）、页 7（kp 名 / 回溯路径）、页 8（图谱）都需要结构。
 * 数据资产冻结 + tests/graphSnapshot.test.ts 逐字段守恒断言 = 副本不会漂移。
 *
 * 生成来源：data/knowledge/math/cz.json（24 节点，8 章节）。
 * 生成脚本：node _gen_snapshot.cjs（读 cz.json → 写本文件），非工程文件。
 */

export interface GraphNodeSnapshot {
  id: string;
  name: string;
  chapter: string;
  difficulty: number;
  prerequisites: string[];
  successors: string[];
}

export interface ChapterSnapshot {
  name: string;
  kp_ids: string[];
}

/** 24 个知识点（顺序与冻结数据逐项一致）。 */
export const GRAPH_NODES: readonly GraphNodeSnapshot[] = [
  {
    "id": "math.cz.algebra.basic",
    "name": "代数式与代入求值",
    "chapter": "代数式",
    "difficulty": 1,
    "prerequisites": ["math.cz.number.rational"],
    "successors": ["math.cz.algebra.identity","math.cz.function.linear"]
  },
  {
    "id": "math.cz.algebra.identity",
    "name": "完全平方公式与配方变形",
    "chapter": "代数式",
    "difficulty": 2,
    "prerequisites": ["math.cz.algebra.basic","math.cz.algebra.multiply"],
    "successors": ["math.cz.quadratic.eq_concept","math.cz.quadratic.completing_square"]
  },
  {
    "id": "math.cz.function.concept",
    "name": "函数的概念与自变量取值范围",
    "chapter": "函数",
    "difficulty": 2,
    "prerequisites": [],
    "successors": ["math.cz.function.graph","math.cz.function.linear","math.cz.quadratic.concept"]
  },
  {
    "id": "math.cz.function.graph",
    "name": "函数的图像与描点法",
    "chapter": "函数",
    "difficulty": 2,
    "prerequisites": ["math.cz.function.concept"],
    "successors": ["math.cz.quadratic.graph_basic","math.cz.quadratic.vertex_form"]
  },
  {
    "id": "math.cz.function.linear",
    "name": "一次函数与待定系数法",
    "chapter": "函数",
    "difficulty": 3,
    "prerequisites": ["math.cz.function.concept","math.cz.algebra.basic","math.cz.equation.linear_one"],
    "successors": ["math.cz.quadratic.three_points"]
  },
  {
    "id": "math.cz.quadratic.eq_concept",
    "name": "一元二次方程的概念与直接开平方法",
    "chapter": "一元二次方程",
    "difficulty": 2,
    "prerequisites": ["math.cz.algebra.identity"],
    "successors": ["math.cz.quadratic.completing_square","math.cz.quadratic.factoring","math.cz.quadratic.concept"]
  },
  {
    "id": "math.cz.quadratic.completing_square",
    "name": "配方法解一元二次方程",
    "chapter": "一元二次方程",
    "difficulty": 3,
    "prerequisites": ["math.cz.algebra.identity","math.cz.quadratic.eq_concept"],
    "successors": ["math.cz.quadratic.formula","math.cz.quadratic.vertex_form"]
  },
  {
    "id": "math.cz.quadratic.formula",
    "name": "公式法与根的判别式",
    "chapter": "一元二次方程",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.completing_square"],
    "successors": ["math.cz.quadratic.eq_relation"]
  },
  {
    "id": "math.cz.quadratic.factoring",
    "name": "因式分解法解一元二次方程",
    "chapter": "一元二次方程",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.eq_concept","math.cz.algebra.factoring"],
    "successors": []
  },
  {
    "id": "math.cz.quadratic.concept",
    "name": "二次函数的概念与一般式",
    "chapter": "二次函数",
    "difficulty": 2,
    "prerequisites": ["math.cz.function.concept","math.cz.quadratic.eq_concept"],
    "successors": ["math.cz.quadratic.graph_basic","math.cz.quadratic.three_points"]
  },
  {
    "id": "math.cz.quadratic.graph_basic",
    "name": "y=ax2 的图像与性质",
    "chapter": "二次函数",
    "difficulty": 2,
    "prerequisites": ["math.cz.quadratic.concept","math.cz.function.graph"],
    "successors": ["math.cz.quadratic.opening","math.cz.quadratic.general_to_vertex"]
  },
  {
    "id": "math.cz.quadratic.opening",
    "name": "开口方向、对称轴与增减性",
    "chapter": "二次函数",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.graph_basic"],
    "successors": ["math.cz.quadratic.eq_relation"]
  },
  {
    "id": "math.cz.quadratic.vertex_form",
    "name": "二次函数的顶点式",
    "chapter": "二次函数",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.completing_square","math.cz.function.graph"],
    "successors": ["math.cz.quadratic.general_to_vertex","math.cz.quadratic.translation","math.cz.quadratic.extremum"]
  },
  {
    "id": "math.cz.quadratic.general_to_vertex",
    "name": "一般式与顶点式互化",
    "chapter": "二次函数",
    "difficulty": 4,
    "prerequisites": ["math.cz.quadratic.vertex_form","math.cz.quadratic.graph_basic"],
    "successors": []
  },
  {
    "id": "math.cz.quadratic.translation",
    "name": "抛物线的平移变换",
    "chapter": "二次函数",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.vertex_form"],
    "successors": []
  },
  {
    "id": "math.cz.quadratic.extremum",
    "name": "二次函数的最值",
    "chapter": "二次函数",
    "difficulty": 3,
    "prerequisites": ["math.cz.quadratic.vertex_form"],
    "successors": ["math.cz.quadratic.application"]
  },
  {
    "id": "math.cz.quadratic.three_points",
    "name": "待定系数法求二次函数解析式",
    "chapter": "二次函数",
    "difficulty": 4,
    "prerequisites": ["math.cz.quadratic.concept","math.cz.function.linear"],
    "successors": ["math.cz.quadratic.geometry"]
  },
  {
    "id": "math.cz.quadratic.eq_relation",
    "name": "二次函数与一元二次方程的关系",
    "chapter": "二次函数",
    "difficulty": 4,
    "prerequisites": ["math.cz.quadratic.opening","math.cz.quadratic.formula"],
    "successors": []
  },
  {
    "id": "math.cz.quadratic.application",
    "name": "二次函数的实际应用",
    "chapter": "二次函数",
    "difficulty": 4,
    "prerequisites": ["math.cz.quadratic.extremum"],
    "successors": ["math.cz.quadratic.geometry"]
  },
  {
    "id": "math.cz.quadratic.geometry",
    "name": "抛物线与几何综合",
    "chapter": "二次函数",
    "difficulty": 5,
    "prerequisites": ["math.cz.quadratic.application","math.cz.quadratic.three_points"],
    "successors": []
  },
  {
    "id": "math.cz.number.rational",
    "name": "有理数的运算",
    "chapter": "有理数",
    "difficulty": 1,
    "prerequisites": [],
    "successors": ["math.cz.algebra.basic","math.cz.equation.linear_one","math.cz.algebra.multiply"]
  },
  {
    "id": "math.cz.equation.linear_one",
    "name": "一元一次方程的解法",
    "chapter": "一元一次方程",
    "difficulty": 1,
    "prerequisites": ["math.cz.number.rational"],
    "successors": ["math.cz.function.linear"]
  },
  {
    "id": "math.cz.algebra.multiply",
    "name": "整式的乘法与乘法公式",
    "chapter": "整式的乘法",
    "difficulty": 2,
    "prerequisites": ["math.cz.number.rational"],
    "successors": ["math.cz.algebra.identity","math.cz.algebra.factoring"]
  },
  {
    "id": "math.cz.algebra.factoring",
    "name": "因式分解",
    "chapter": "因式分解",
    "difficulty": 2,
    "prerequisites": ["math.cz.algebra.multiply"],
    "successors": ["math.cz.quadratic.factoring"]
  },
];

/** 8 个章节及其知识点（顺序取冻结数据中的首次出现序）。 */
export const GRAPH_CHAPTERS: readonly ChapterSnapshot[] = [
  {
    "name": "代数式",
    "kp_ids": ["math.cz.algebra.basic","math.cz.algebra.identity"]
  },
  {
    "name": "函数",
    "kp_ids": ["math.cz.function.concept","math.cz.function.graph","math.cz.function.linear"]
  },
  {
    "name": "一元二次方程",
    "kp_ids": ["math.cz.quadratic.eq_concept","math.cz.quadratic.completing_square","math.cz.quadratic.formula","math.cz.quadratic.factoring"]
  },
  {
    "name": "二次函数",
    "kp_ids": ["math.cz.quadratic.concept","math.cz.quadratic.graph_basic","math.cz.quadratic.opening","math.cz.quadratic.vertex_form","math.cz.quadratic.general_to_vertex","math.cz.quadratic.translation","math.cz.quadratic.extremum","math.cz.quadratic.three_points","math.cz.quadratic.eq_relation","math.cz.quadratic.application","math.cz.quadratic.geometry"]
  },
  {
    "name": "有理数",
    "kp_ids": ["math.cz.number.rational"]
  },
  {
    "name": "一元一次方程",
    "kp_ids": ["math.cz.equation.linear_one"]
  },
  {
    "name": "整式的乘法",
    "kp_ids": ["math.cz.algebra.multiply"]
  },
  {
    "name": "因式分解",
    "kp_ids": ["math.cz.algebra.factoring"]
  },
];

/** 章节名 → 知识点数量（自报页展示用）。 */
export const CHAPTER_SIZES: Record<string, number> = {
  "代数式": 2,
  "函数": 3,
  "一元二次方程": 4,
  "二次函数": 11,
  "有理数": 1,
  "一元一次方程": 1,
  "整式的乘法": 1,
  "因式分解": 1,
};

/** 完整 id → 显示名（图谱快照范围内）。 */
export const KP_NAMES: Record<string, string> = {
  "math.cz.algebra.basic": "代数式与代入求值",
  "math.cz.algebra.identity": "完全平方公式与配方变形",
  "math.cz.function.concept": "函数的概念与自变量取值范围",
  "math.cz.function.graph": "函数的图像与描点法",
  "math.cz.function.linear": "一次函数与待定系数法",
  "math.cz.quadratic.eq_concept": "一元二次方程的概念与直接开平方法",
  "math.cz.quadratic.completing_square": "配方法解一元二次方程",
  "math.cz.quadratic.formula": "公式法与根的判别式",
  "math.cz.quadratic.factoring": "因式分解法解一元二次方程",
  "math.cz.quadratic.concept": "二次函数的概念与一般式",
  "math.cz.quadratic.graph_basic": "y=ax2 的图像与性质",
  "math.cz.quadratic.opening": "开口方向、对称轴与增减性",
  "math.cz.quadratic.vertex_form": "二次函数的顶点式",
  "math.cz.quadratic.general_to_vertex": "一般式与顶点式互化",
  "math.cz.quadratic.translation": "抛物线的平移变换",
  "math.cz.quadratic.extremum": "二次函数的最值",
  "math.cz.quadratic.three_points": "待定系数法求二次函数解析式",
  "math.cz.quadratic.eq_relation": "二次函数与一元二次方程的关系",
  "math.cz.quadratic.application": "二次函数的实际应用",
  "math.cz.quadratic.geometry": "抛物线与几何综合",
  "math.cz.number.rational": "有理数的运算",
  "math.cz.equation.linear_one": "一元一次方程的解法",
  "math.cz.algebra.multiply": "整式的乘法与乘法公式",
  "math.cz.algebra.factoring": "因式分解",
};

const NODE_BY_ID = new Map(GRAPH_NODES.map((node) => [node.id, node]));

/** 按 id 取节点（不存在返回 null）。 */
export function snapshotNode(id: string): GraphNodeSnapshot | null {
  return NODE_BY_ID.get(id) ?? null;
}

/** 按 id 取显示名；未知 id 回退为 id 本身（禁止白屏）。 */
export function kpName(id: string): string {
  return KP_NAMES[id] ?? id;
}

/** 章节名清单（自报页 4 张卡片、下拉选项共用）。 */
export function chapterNames(): string[] {
  return GRAPH_CHAPTERS.map((chapter) => chapter.name);
}

