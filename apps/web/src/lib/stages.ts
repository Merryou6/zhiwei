/**
 * 学段（学科）清单 —— 前端静态副本 + 空间名建议（纯函数，零依赖）
 *
 * 为什么是静态副本：后端没有「学段清单」下发接口（本轮也不新增），前端已有同类先例
 * （知识图谱 snapshot，迭代 3 D7）——静态副本 + 一致性测试，比为此开一个接口更省。
 * 唯一真相仍在 `data/knowledge/index.json` 的 subjects[].stages[]；
 * `apps/web/tests/stages.test.ts` 逐项断言本文件与它一致，防两处漂移。
 *
 * 空间名唯一约束（契约 §2 v1.2）= 同一用户内空间名唯一 → 新建时用 suggestSpaceName()
 * 在本地先算出不重名、且**长度合规**的名字，保证「一键新建必成功」，服务端 409 仅作并发兜底。
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
 * 空间名长度上限（trim 后字符数）——**前端唯一来源**。
 *
 * ⚠ 与后端 `functions/api/src/services/space.ts` 的 `MAX_SPACE_NAME_LENGTH` **同值同源**
 * （契约 §2 v1.2：「name 可选，1–30 字」；超限服务端一律 400）。
 * 前端 maxLength、本地重名预检、后端校验三处必须是同一个数字：
 * 曾出现「输入框 40 / 服务端 30」的错位（赛前修整轮 H1）——用户输入 31–40 字提交必被 400，
 * 且 30 字原名已占用时自动追加序号得到 32 字、同样必 400（报错文案还与他实输的 30 字自相矛盾）。
 * **改这里必须同步改后端常量（反之亦然）**；`apps/web/tests/stages.test.ts` 有一条断言直接
 * 读后端源文件核对该数字，两处漂移会让测试红。
 */
export const SPACE_NAME_MAX = 30;

/** base 为空时的兜底名（与后端 create 里 `?? '学习空间'` 的兜底一致）。 */
const FALLBACK_SPACE_NAME = '学习空间';

/** 序号上界（防御性）：真实单实例 JSON 存储不可能有这么多同名空间，仅保证循环必然终止。 */
const MAX_SUFFIX_INDEX = 999;

/**
 * 在不重名的前提下给空间起名（纯函数，**返回值长度恒 ≤ SPACE_NAME_MAX**）：
 *   base 未被占用 → 原样；已占用 → 依次试 `${base} 2`、`${base} 3`…
 * 追加序号时**先给序号预留字符**：`head = base.slice(0, SPACE_NAME_MAX - suffix.length)`，
 * 故 base 本身就顶到 30 字时仍能得到「前 28 字 + ' 2'」= 恰好 30 的合法名（不超限、不 400）。
 * trim：后端校验与入库用的都是 trim 后的名字；这里若保留尾随空格，返回的名字会被后端 trim 成
 *   另一个（可能已被占用的）名字，本地预检就白做了——故先 trim 再取前缀。
 * 名字被截断时仍保留 base 的可辨识前缀（不会退化成空串或纯序号）。
 */
export function suggestSpaceName(base: string, taken: readonly string[]): string {
  const trimmed = base.trim();
  const safeBase = (trimmed.length > 0 ? trimmed : FALLBACK_SPACE_NAME).slice(0, SPACE_NAME_MAX);
  if (!taken.includes(safeBase)) return safeBase;

  for (let index = 2; index <= MAX_SUFFIX_INDEX; index += 1) {
    const suffix = ` ${index}`;
    const headLength = SPACE_NAME_MAX - suffix.length;
    if (headLength <= 0) break; // 序号长到装不下（不可达），退回截断的 base：长度仍合规，冲突交 409 兜底
    const candidate = `${safeBase.slice(0, headLength)}${suffix}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return safeBase;
}
