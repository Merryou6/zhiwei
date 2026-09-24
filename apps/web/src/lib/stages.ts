/**
 * 学段（学科）清单 —— 前端静态副本 + 空间名建议（纯函数，零依赖）
 *
 * 为什么是静态副本：后端没有「学段清单」下发接口（本轮也不新增），前端已有同类先例
 * （知识图谱 snapshot，迭代 3 D7）——静态副本 + 一致性测试，比为此开一个接口更省。
 * 唯一真相仍在 `data/knowledge/index.json` 的 subjects[].stages[]；
 * `apps/web/tests/stages.test.ts` 逐项断言本文件与它一致，防两处漂移。
 *
 * 空间名唯一约束（契约 §2 v1.2）= 同一用户内空间名唯一 → 新建时用 suggestSpaceName()
 * 在本地先算出不重名的名字，保证「一键新建必成功」，服务端 409 仅作并发兜底。
 */

export interface StageOption {
  /** 知识库 id（data/knowledge/index.json 的 stage.kb_id），即 space/create 的 knowledge_source。 */
  id: string;
  /** 学段展示名（index.json 的 stage.name），既是单选文案也是缺省空间名。 */
  label: string;
}

/** 可选学段（与 data/knowledge/index.json 的 stages 一致；新增学科在此扩 + 同步测试）。 */
export const STAGES = [
  { id: 'kb_math_cz', label: '初中数学' },
  { id: 'kb_math_gz', label: '高中数学' },
] as const satisfies readonly StageOption[];

/** 默认学段（新建表单的初始选中项，也是 register 自动建默认空间用的那个 kb）。 */
export const DEFAULT_STAGE_ID: string = STAGES[0].id;

/** 知识库 id → 学段标签（空间卡片副标题、我的页学科标签用）。未知 id 回退「数学」。 */
export function stageLabel(kbId: string | undefined): string {
  return STAGES.find((stage) => stage.id === kbId)?.label ?? '数学';
}

/**
 * 在不重名的前提下给空间起名（纯函数）：
 *   base 未被占用 → 原样；已占用 → 依次试 `${base} 2`、`${base} 3`…
 * 取名规则与 D1d 一致：重名自动追加序号，用户不必为此手动改名。
 */
export function suggestSpaceName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let index = 2;
  while (taken.includes(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}
