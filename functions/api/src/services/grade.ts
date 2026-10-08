/**
 * 逐步批改服务（契约 §15 · v2.1 三张牌之「专业感来源」，接口 #33 POST /api/grade/steps）
 *
 * 定位：学生按步提交解题过程，服务端**逐步**判定并指出「断在第几步、什么类型的错」，
 * 而不是只判最终对错。这是与拍搜工具「只给答案/只判对错」的结构性差异。
 *
 * 评分两层（不重造轮子，全部消费既有数据资产）：
 *   1) 题目级：item.solution_steps（题库既有字段，仅服务端可见）作为分步期望值 ——
 *      学生步骤归一化后与之互为包含 → pass；
 *   2) 知识点级：item.distractors.typical_error_code（典型错误码）命中 → slip，
 *      feedback 取该题 distractor.explanation，并叠加 kp.typical_errors 的 remedy 处方。
 *
 * 判定优先级（确定性、可复现，本地规则模型即可全量工作，无网络依赖）：
 *   ① 步骤为空 → unclear
 *   ② 步骤 = 标准答案，或与任一 solution_step 互为包含 → pass
 *   ③ 步骤 = 某条 distractor → slip（procedural 类）或 concept_gap（概念类，按错误码的
 *      error_type 归属判定）
 *   ④ 无法判定：其后存在 pass 步 → concept_gap（思路与常见解法不一致）；
 *      否则 → unclear（诚实说「看不懂」，不猜）
 *
 * 证据（闭环的关键）：写 evidence_events(source='practice', w=W_PRACTICE)。
 * 「部分正证据」折算：整体答错但已有步骤通过时，错误证据权重按 (1 − pass_ratio/2) 衰减
 * （最多减半）—— 答错但前几步对，掌握度不该按「全错」拉低；这是逐步批改相对
 * 「只判对错」在数据层的本质优势。
 *
 * 红线（服务端测试锁定）：
 *   - 响应不含 answer / solution_steps / distractors / step_rubric 字段（assertNoForbiddenKeys）；
 *   - feedback / hint 中的值级泄漏被 scrubFeedback 清洗（不得含标准答案的归一化形态）。
 */

import { buildDedupKey, updateMastery } from '../../../../packages/engine/src/index';

import { nowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import type { BankItemRecord } from '../data/staticData';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { assertNoForbiddenKeys } from '../serialization';
import { normalizeAnswer } from '../grading';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

/** 步骤数上限（防滥用；一份解题过程 8 步足够）。 */
export const MAX_STEPS = 8;
/** 单步文本长度上限。 */
export const MAX_STEP_LENGTH = 300;

export type StepVerdict = 'pass' | 'slip' | 'concept_gap' | 'unclear';

export interface StepResult {
  index: number;
  verdict: StepVerdict;
  matched_error_code: string | null;
  feedback: string;
  hint: string | null;
}

export interface GradeStepsData {
  step_results: StepResult[];
  overall: {
    correct: boolean;
    pass_ratio: number;
    first_break_step: number | null;
    kp_id: string;
    kp_name: string;
  };
  evidence_written: boolean;
  weight_applied: number;
}

interface DistractorLike {
  answer: string;
  typical_error_code: string;
  explanation: string;
}

/**
 * 值级泄漏清洗：feedback/hint 中出现标准答案的归一化形态 → 换成安全话术。
 * 豁免：答案值本身已出现在题干里（如「当 x=-2 时…」的 -2）属题面公开信息，不算泄漏。
 */
export function scrubFeedback(text: string, item: BankItemRecord): string {
  const normalizedAnswer = normalizeAnswer(item.answer);
  if (normalizedAnswer.length === 0) return text;
  if (normalizeAnswer(item.stem).includes(normalizedAnswer)) return text;
  if (!normalizeAnswer(text).includes(normalizedAnswer)) return text;
  return '这一步的问题出在符号或数值处理上，把对应运算重新写一遍再核对。';
}

/** 求某错误码的处方话术（kp.typical_errors，找不到返回 null）。 */
function remedyFor(item: BankItemRecord, ctx: AppContext, code: string): string | null {
  const kp = ctx.data.nodeById.get(item.knowledge_point);
  return kp?.typical_errors.find((error) => error.code === code)?.remedy ?? null;
}

/** 单步与 solution_steps 的包含匹配（归一化后互为子串，≥2 字符防误命中）。 */
function matchesSolutionStep(stepText: string, item: BankItemRecord): boolean {
  const normalized = normalizeAnswer(stepText);
  if (normalized.length < 2) return false;
  for (const step of item.solution_steps) {
    const expected = normalizeAnswer(step);
    if (expected.length < 2) continue;
    if (expected.includes(normalized) || normalized.includes(expected)) return true;
  }
  return false;
}

/** 与 distractor 答案判等（复用 gradeAnswer 的归一化规则，不重写）。 */
function matchDistractor(stepText: string, item: BankItemRecord): DistractorLike | null {
  const normalized = normalizeAnswer(stepText);
  if (normalized.length === 0) return null;
  const standard = normalizeAnswer(item.answer);
  for (const distractor of item.distractors ?? []) {
    const value = normalizeAnswer(distractor.answer);
    if (value.length === 0 || value === standard) continue;
    if (value === normalized) return distractor;
  }
  return null;
}

/**
 * 本地确定性逐步判定（纯函数；远程模型适配器留待 v2.2 接入，本版全量可离线工作）。
 * 两段式：先定 pass/slip，再把「未命中但后面有 pass」的步骤升格为 concept_gap。
 */
export function gradeStepsLocal(item: BankItemRecord, steps: string[], ctx: AppContext): StepResult[] {
  const normalizedAnswer = normalizeAnswer(item.answer);

  const primary = steps.map((text) => {
    const normalized = normalizeAnswer(text);
    if (normalized.length === 0) {
      return { verdict: 'unclear' as StepVerdict, code: null as string | null, explanation: '' };
    }
    if (normalized === normalizedAnswer || matchesSolutionStep(text, item)) {
      return { verdict: 'pass' as StepVerdict, code: null, explanation: '' };
    }
    const distractor = matchDistractor(text, item);
    if (distractor) {
      const kp = ctx.data.nodeById.get(item.knowledge_point);
      const errorType = kp?.typical_errors.find((error) => error.code === distractor.typical_error_code)?.error_type;
      // 程序性失误（算错/看错）→ slip；概念/方法/先修类 → concept_gap
      const verdict: StepVerdict =
        errorType === 'procedural_slip' || errorType === 'misreading' ? 'slip' : 'concept_gap';
      return { verdict, code: distractor.typical_error_code, explanation: distractor.explanation };
    }
    return { verdict: 'unclear' as StepVerdict, code: null, explanation: '' };
  });

  const lastPassIndex = (() => {
    for (let i = primary.length - 1; i >= 0; i -= 1) {
      if (primary[i].verdict === 'pass') return i;
    }
    return -1;
  })();

  return primary.map((entry, offset) => {
    const index = offset + 1;
    if (entry.verdict === 'unclear' && offset < lastPassIndex) {
      // 思路断点：后面有正确的步骤，说明这一步走了不同的（多半不对的）路
      return {
        index,
        verdict: 'concept_gap',
        matched_error_code: null,
        feedback: '这一步和常见解法对不上——思路在这里断了一下。',
        hint: `第 ${lastPassIndex + 1} 步你写对了，倒推这一步应该落到哪里。`,
      } satisfies StepResult;
    }
    switch (entry.verdict) {
      case 'pass':
        return { index, verdict: 'pass', matched_error_code: null, feedback: '这一步对，继续。', hint: null };
      case 'slip':
      case 'concept_gap': {
        const remedy = remedyFor(item, ctx, entry.code ?? '');
        const feedback = scrubFeedback(entry.explanation, item);
        return {
          index,
          verdict: entry.verdict,
          matched_error_code: entry.code,
          feedback,
          hint: remedy ?? '把这一步的运算对象和符号逐个核对一遍。',
        } satisfies StepResult;
      }
      case 'unclear':
      default:
        return {
          index,
          verdict: 'unclear',
          matched_error_code: null,
          feedback: '这一步我没读明白。',
          hint: '写成具体的式子或数值（比如「(-2)^2 = 4」），我才能接着往下判。',
        } satisfies StepResult;
    }
  });
}

function parseSteps(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw httpError.badRequest('steps 必须是非空数组');
  }
  if (raw.length > MAX_STEPS) {
    throw httpError.badRequest(`解题过程最多 ${MAX_STEPS} 步`);
  }
  return raw.map((entry, offset) => {
    const text = typeof entry === 'string' ? entry : typeof (entry as { text?: unknown })?.text === 'string'
      ? ((entry as { text: string }).text)
      : '';
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw httpError.badRequest(`第 ${offset + 1} 步是空的（不确定就写「不会」）`);
    }
    if (trimmed.length > MAX_STEP_LENGTH) {
      throw httpError.badRequest(`第 ${offset + 1} 步超过 ${MAX_STEP_LENGTH} 字`);
    }
    return trimmed;
  });
}

/** POST /api/grade/steps */
export async function gradeSteps(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const space = await requireSpaceOwnership(ctx, user.user_id, req.body.space_id);

  const itemId = req.body.item_id;
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw httpError.badRequest('item_id 不能为空');
  }
  const item = ctx.data.itemById.get(itemId);
  if (!item) throw httpError.notFound('题目不存在');
  const kp = ctx.data.nodeById.get(item.knowledge_point);
  if (!kp) throw httpError.notFound(`题目的知识点不在知识库中：${item.knowledge_point}`);

  const steps = parseSteps(req.body.steps);

  // ---- 逐步判定
  const stepResults = gradeStepsLocal(item, steps, ctx);
  const passedCount = stepResults.filter((result) => result.verdict === 'pass').length;
  const passRatio = stepResults.length === 0 ? 0 : passedCount / stepResults.length;
  const normalizedAnswer = normalizeAnswer(item.answer);
  // 整体正确 = 过程中真实抵达了标准答案（含末步）；只看结果，不惩罚绕路
  const correct = steps.some((text) => normalizeAnswer(text) === normalizedAnswer);
  const firstBreak = stepResults.find((result) => result.verdict !== 'pass')?.index ?? null;

  // ---- 证据（dedup：同一小时同一题只记一次，重复提交幂等返回）
  const nowMs = ctx.now();
  const createdAt = nowIso(nowMs);
  const dedupKey = buildDedupKey({
    userId: user.user_id,
    spaceId: space.space_id,
    kp: item.knowledge_point,
    source: 'practice',
    unixTs: Math.floor(nowMs / 1000),
  });
  const existing = await ctx.store.findEventsByDedupKey(space.space_id, dedupKey);
  const duplicated = existing.some((event) => event.item_id === itemId);

  let weightApplied = 0;
  if (!duplicated) {
    // 部分正证据折算：答错但有步骤通过 → 错误证据权重按 (1 − pass_ratio/2) 衰减（最多减半）
    weightApplied = correct
      ? ctx.params.W_PRACTICE
      : ctx.params.W_PRACTICE * (1 - passRatio / 2);

    const profile = await ctx.store.getProfile(user.user_id, space.space_id, item.knowledge_point);
    const before = profile?.mastery ?? 0;
    const eventId = newId('evt_');
    const update = updateMastery(before, correct, weightApplied, ctx.params, eventId);

    await ctx.store.insertEvent({
      event_id: eventId,
      user_id: user.user_id,
      space_id: space.space_id,
      knowledge_point: item.knowledge_point,
      item_id: itemId,
      source: 'practice',
      mode: null,
      result: correct ? 'correct' : 'wrong',
      weight: weightApplied,
      alpha: null,
      raw: {
        first_break_step: firstBreak,
        pass_ratio: Math.round(passRatio * 1000) / 1000,
        verdicts: stepResults.map((result) => result.verdict),
        matched_error_code: stepResults.find((result) => result.matched_error_code)?.matched_error_code ?? null,
        step_count: steps.length,
      },
      dedup_key: dedupKey,
      expire_at: null,
      created_at: createdAt,
    });

    await ctx.store.insertLog({
      log_id: newId('log_'),
      user_id: user.user_id,
      space_id: space.space_id,
      knowledge_point: item.knowledge_point,
      before: update.before,
      p_obs: update.p_obs,
      p_eff: update.p_eff,
      after: update.after,
      weight: update.weight,
      triggered_by: eventId,
      created_at: createdAt,
    });

    await ctx.store.upsertProfile({
      user_id: user.user_id,
      space_id: space.space_id,
      knowledge_point: item.knowledge_point,
      mastery: update.after,
      evidence_count: (profile?.evidence_count ?? 0) + 1,
      p_l0: profile?.p_l0 ?? before,
      status: profile?.status ?? 'active',
      last_updated: createdAt,
      last_evidence_type: 'practice',
    });
  }

  const data: GradeStepsData = {
    step_results: stepResults,
    overall: {
      correct,
      pass_ratio: Math.round(passRatio * 1000) / 1000,
      first_break_step: firstBreak,
      kp_id: item.knowledge_point,
      kp_name: kp.name,
    },
    evidence_written: !duplicated,
    weight_applied: Math.round(weightApplied * 1000) / 1000,
  };

  // 序列化红线：键名级禁发字段断言（与 closedLoop 全局断言同源）
  assertNoForbiddenKeys(data, 'grade/steps');

  return ok(data);
}
