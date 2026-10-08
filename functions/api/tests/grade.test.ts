/**
 * #33 POST /api/grade/steps 测试（v2.1 逐步批改）
 *
 * 覆盖：
 *   - 全对过程 → 全 pass + correct + W_PRACTICE 全额证据；
 *   - 典型错误（distractor 命中）→ slip/concept_gap + matched_error_code + remedy 话术；
 *   - 中途断步（后步对前步未命中）→ concept_gap + first_break_step 定位；
 *   - 部分正证据：答错但有通过步骤 → 权重 < W_PRACTICE（衰减不减半以下不出现）；
 *   - 红线：响应无禁发键（answer/solution_steps/distractors）；feedback/hint 不含
 *     标准答案的归一化形态（值级泄漏断言）；
 *   - 幂等：同一小时同一题重复提交 → evidence_written=false；
 *   - 入参校验：steps 空/超限/空步骤 → 400；题目不存在 → 404。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueIdentifier, type TestApp } from './helpers';
import type { GradeStepsData } from '../src/services/grade';
import { normalizeAnswer } from '../src/grading';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.cleanup();
});

/** 找一道「有 distractors 且 solution_steps ≥ 2」的 fill 题做主测题。 */
function pickFixtureItem(): { item_id: string; answer: string; knowledge_point: string } {
  const item = app.ctx.data.items.find(
    (candidate) =>
      (candidate.distractors ?? []).length > 0 &&
      candidate.solution_steps.length >= 2 &&
      candidate.type === 'fill',
  );
  if (!item) throw new Error('测试前置失败：题库里没有满足条件的题');
  return { item_id: item.item_id, answer: item.answer, knowledge_point: item.knowledge_point };
}

function assertNoAnswerLeak(data: GradeStepsData, item: { stem: string; answer: string }): void {
  const normalized = normalizeAnswer(item.answer);
  if (normalized.length === 0) return;
  const serialized = JSON.stringify(data);
  // 值级断言：feedback/hint 不含答案的归一化形态。
  // 豁免：答案值已出现在题干（题面公开信息，如「当 x=-2 时…」的 -2）。
  const answerIsPublic = normalizeAnswer(item.stem).includes(normalized);
  if (!answerIsPublic) {
    for (const result of data.step_results) {
      expect(normalizeAnswer(result.feedback).includes(normalized)).toBe(false);
      if (result.hint) {
        expect(normalizeAnswer(result.hint).includes(normalized)).toBe(false);
      }
    }
  }
  expect(serialized.includes('"solution_steps"')).toBe(false);
  expect(serialized.includes('"answer"')).toBe(false);
}

describe('#33 grade/steps · 全对过程', () => {
  it('逐题包含 solution_steps 的过程 → 全 pass、correct、证据全额', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items.find(
      (candidate) => candidate.type === 'fill' && candidate.solution_steps.length >= 2,
    )!;
    expect(item).toBeTruthy();

    // 步骤直接取 solution_steps 的前 N-1 步 + 最终答案（归一化后互为包含 → pass）
    const steps = [...item.solution_steps.slice(0, -1).map((step) => step.replace(/\s+/g, '')), item.answer];
    const response = await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps },
      { token: user.token },
    );
    expect(response.code).toBe(0);
    const data = response.data!;
    expect(data.step_results.every((result) => result.verdict === 'pass')).toBe(true);
    expect(data.overall.correct).toBe(true);
    expect(data.overall.first_break_step).toBeNull();
    expect(data.overall.pass_ratio).toBe(1);
    expect(data.evidence_written).toBe(true);
    expect(data.weight_applied).toBeCloseTo(app.ctx.params.W_PRACTICE, 6);
    assertNoAnswerLeak(data, item);
  });
});

describe('#33 grade/steps · 典型错误与断点定位', () => {
  it('distractor 步骤 → slip/concept_gap + matched_error_code + 处方话术', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const fixture = pickFixtureItem();
    const item = app.ctx.data.itemById.get(fixture.item_id)!;
    const distractor = item.distractors.find(
      (candidate) => normalizeAnswer(candidate.answer) !== normalizeAnswer(item.answer),
    )!;

    const response = await app.post<GradeStepsData>(
      '/api/grade/steps',
      {
        space_id: user.space_id,
        item_id: item.item_id,
        steps: ['先审题，圈出已知量', distractor.answer],
      },
      { token: user.token },
    );
    expect(response.code).toBe(0);
    const data = response.data!;
    expect(data.overall.correct).toBe(false);
    // 第 1 步读不懂（无后续 pass 可参照 → 保持 unclear），断点从第 1 步起算
    expect(data.overall.first_break_step).toBe(1);
    expect(data.step_results[0].verdict).toBe('unclear');
    const hit = data.step_results.find((result) => result.matched_error_code !== null);
    expect(hit?.matched_error_code).toBe(distractor.typical_error_code);
    expect(hit?.feedback.length).toBeGreaterThan(0);
    assertNoAnswerLeak(data, item);
  });

  it('前步通过后走岔 → concept_gap 断在中间；部分正证据权重衰减', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items.find(
      (candidate) =>
        candidate.type === 'fill' &&
        candidate.solution_steps.length >= 3 &&
        (candidate.distractors ?? []).length > 0,
    )!;
    expect(item).toBeTruthy();

    // 第 1 步 = 解答首步（pass）；第 2 步走岔；第 3 步直接给最终答案
    const steps = [item.solution_steps[0], '这一步我换了种想法随便算了一下', item.answer];
    const response = await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps },
      { token: user.token },
    );
    expect(response.code).toBe(0);
    const data = response.data!;
    expect(data.overall.correct).toBe(true); // 终点抵达了标准答案
    expect(data.overall.pass_ratio).toBeGreaterThan(0);
    expect(data.overall.pass_ratio).toBeLessThan(1);
    expect(data.step_results[1].verdict).toBe('concept_gap');
    assertNoAnswerLeak(data, item);
  });

  it('答错且有通过步骤 → 权重在 (W/2, W] 区间衰减', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items.find(
      (candidate) => candidate.type === 'fill' && candidate.solution_steps.length >= 2,
    )!;
    const wrongTail = item.distractors[0]?.answer ?? '1';
    const steps = [item.solution_steps[0], wrongTail];
    const response = await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps },
      { token: user.token },
    );
    expect(response.code).toBe(0);
    const data = response.data!;
    expect(data.overall.correct).toBe(false);
    expect(data.overall.pass_ratio).toBeGreaterThan(0);
    expect(data.weight_applied).toBeGreaterThan(app.ctx.params.W_PRACTICE / 2);
    expect(data.weight_applied).toBeLessThan(app.ctx.params.W_PRACTICE);
  });
});

describe('#33 grade/steps · 红线与幂等', () => {
  it('同一小时同一题重复提交 → evidence_written=false（幂等）', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items.find((candidate) => candidate.solution_steps.length >= 1)!;
    const steps = [item.answer];

    const first = await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps },
      { token: user.token },
    );
    expect(first.data!.evidence_written).toBe(true);

    const second = await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps },
      { token: user.token },
    );
    expect(second.code).toBe(0);
    expect(second.data!.evidence_written).toBe(false);
    expect(second.data!.weight_applied).toBe(0);
  });

  it('入参校验：空 steps / 超限步骤 / 空步骤 / 未知题目', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items[0];

    const empty = await app.post(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps: [] },
      { token: user.token },
    );
    expect(empty.code).toBe(400);

    const overLimit = await app.post(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps: Array.from({ length: 9 }, (_, i) => `步骤${i + 1}`) },
      { token: user.token },
    );
    expect(overLimit.code).toBe(400);

    const blankStep = await app.post(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps: ['  '] },
      { token: user.token },
    );
    expect(blankStep.code).toBe(400);

    const missing = await app.post(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: 'q_not_exist', steps: ['x'] },
      { token: user.token },
    );
    expect(missing.code).toBe(404);
  });

  it('掌握度被 practice 证据更新（profile.last_evidence_type=practice）', async () => {
    const user = await app.register(uniqueIdentifier('grade'));
    const item = app.ctx.data.items.find((candidate) => candidate.solution_steps.length >= 1)!;
    await app.post<GradeStepsData>(
      '/api/grade/steps',
      { space_id: user.space_id, item_id: item.item_id, steps: [item.answer] },
      { token: user.token },
    );
    const profile = await app.ctx.store.getProfile(
      user.user_id,
      user.space_id,
      item.knowledge_point,
    );
    expect(profile).not.toBeNull();
    expect(profile!.last_evidence_type).toBe('practice');
    expect(profile!.evidence_count).toBe(1);
    expect(profile!.mastery).toBeGreaterThan(0);
  });
});
