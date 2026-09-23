/**
 * 处方生成接口测试（契约 §8，接口 #17 POST /api/plan/generate；D15）
 *
 * 覆盖：strategy 按 error_type 映射；path = 先修链（上游在前、完整 id）；
 * item_sequence 难度非降序 / 全部 train 池 / 排除已做过 / ≤8 题 / 带 difficulty；
 * explanation_outline 3–5 条；响应无 answer/solution_steps（E5）。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadStaticData } from '../src/data/staticData';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);
const ROOT_CAUSE = 'math.cz.quadratic.extremum';

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface PlanItem {
  item_id: string;
  stem: string;
  options: string[] | null;
  difficulty: number;
}

interface PlanData {
  strategy: string;
  explanation_outline: string[];
  item_sequence: PlanItem[];
  path: string[];
}

const generate = (user: TestUser, rootCause: string, errorType: string) =>
  app.post<PlanData>(
    '/api/plan/generate',
    { space_id: user.space_id, root_cause: rootCause, error_type: errorType },
    { token: user.token },
  );

describe('plan · 契约 §8 策略与路径', () => {
  it('strategy 按 error_type 映射（ALGORITHM §4）', async () => {
    const user = await app.register(uniqueIdentifier());

    expect((await generate(user, ROOT_CAUSE, 'concept_confusion')).data?.strategy).toBe('对比辨析');
    expect((await generate(user, ROOT_CAUSE, 'method_gap')).data?.strategy).toBe('思路示范');
    expect((await generate(user, ROOT_CAUSE, 'prerequisite_gap')).data?.strategy).toBe(
      '先补上游 + 上游讲解',
    );
  });

  it('path = 先修链完整 id，首元素为链最上游（拓扑序，末尾为根因）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await generate(user, ROOT_CAUSE, 'prerequisite_gap');
    const path = res.data!.path;

    expect(path[path.length - 1]).toBe(ROOT_CAUSE);
    // 2026-09-23 图谱加深（补有理数/一元一次方程/整式乘法/因式分解后），链头变为更浅的根
    expect(path[0]).toBe('math.cz.function.concept');
    expect(new Set(path).size).toBe(path.length);
    for (const kp of path) {
      expect(SD.nodeById.has(kp)).toBe(true);
      expect(kp).toBe(SD.nodeById.get(kp)!.id);
    }
    // 链 = 全部祖先 + 自身（图论口径）
    expect(path).toContain('math.cz.quadratic.vertex_form');
    expect(path).toContain('math.cz.function.graph');
  });

  it('explanation_outline 3–5 条（取根因 kp 的 typical_errors desc → remedy）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await generate(user, ROOT_CAUSE, 'prerequisite_gap');

    const outline = res.data!.explanation_outline;
    expect(outline.length).toBeGreaterThanOrEqual(3);
    expect(outline.length).toBeLessThanOrEqual(5);
    for (const line of outline) {
      expect(line).toContain('→');
    }
    expect(SD.nodeById.get(ROOT_CAUSE)!.typical_errors.length).toBeGreaterThanOrEqual(3);
  });

  it('root_cause 不在知识库 / error_type 非法 → 400；越权 → 403；未认证 → 401', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());

    expect((await generate(a, 'math.nc.zzz', 'prerequisite_gap')).code).toBe(400);
    expect((await generate(a, ROOT_CAUSE, 'not_a_type')).code).toBe(400);

    const cross = await app.post(
      '/api/plan/generate',
      { space_id: a.space_id, root_cause: ROOT_CAUSE, error_type: 'prerequisite_gap' },
      { token: b.token },
    );
    expect(cross.code).toBe(403);

    expect(
      (
        await app.post('/api/plan/generate', {
          space_id: a.space_id,
          root_cause: ROOT_CAUSE,
          error_type: 'prerequisite_gap',
        })
      ).code,
    ).toBe(401);
  });
});

describe('plan · 契约 §8 巩固题序列（D15）', () => {
  it('item_sequence 难度非降序、全部 train 池、≤8 题、带 difficulty、无 answer', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await generate(user, ROOT_CAUSE, 'method_gap');
    const sequence = res.data!.item_sequence;

    expect(sequence.length).toBeGreaterThan(0);
    expect(sequence.length).toBeLessThanOrEqual(8);

    for (let i = 1; i < sequence.length; i += 1) {
      expect(sequence[i].difficulty).toBeGreaterThanOrEqual(sequence[i - 1].difficulty);
    }

    for (const entry of sequence) {
      const record = SD.itemById.get(entry.item_id)!;
      expect(record.pool).toBe('train');
      expect(entry.difficulty).toBe(record.difficulty);
      expect(Object.keys(entry).sort()).toEqual(
        ['difficulty', 'item_id', 'options', 'stem'].sort(),
      );
    }

    const serialized = JSON.stringify(res.data);
    expect(serialized).not.toContain('"answer"');
    expect(serialized).not.toContain('"solution_steps"');
    expect(serialized).not.toContain('"distractors"');
  });

  it('链长 > 4 时每节点 1 题、总量封顶 8（extremum 链 10 节点 → 取难度最低的 8 题）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await generate(user, ROOT_CAUSE, 'prerequisite_gap');
    const sequence = res.data!.item_sequence;
    const path = res.data!.path;

    expect(path.length).toBeGreaterThan(4);
    expect(sequence).toHaveLength(Math.min(path.length, 8));

    const kps = sequence.map((entry) => SD.itemById.get(entry.item_id)!.knowledge_point);
    expect(new Set(kps).size).toBe(kps.length);

    for (const kp of kps) {
      const lowest = SD.itemsByKpPool(kp, 'train')[0];
      expect(sequence.some((entry) => entry.item_id === lowest.item_id)).toBe(true);
    }
  });

  it('排除已做过的题（evidence_events 中的 item_id）', async () => {
    const user = await app.register(uniqueIdentifier());
    const first = await generate(user, ROOT_CAUSE, 'prerequisite_gap');
    const usedId = first.data!.item_sequence[0].item_id;
    const usedRecord = SD.itemById.get(usedId)!;

    const submitted = await app.post(
      '/api/diagnose/submit',
      { space_id: user.space_id, item_id: usedId, answer: usedRecord.answer, mode: 'diagnose' },
      { token: user.token },
    );
    expect(submitted.code).toBe(0);

    const res = await generate(user, ROOT_CAUSE, 'prerequisite_gap');
    const ids = res.data!.item_sequence.map((entry) => entry.item_id);
    // 核心契约：已做过的题必须被排除
    expect(ids).not.toContain(usedId);
    // 题量封顶不变（仍 ≤8，且图深链长取满 8）
    expect(ids).toHaveLength(8);
    // 必然引入至少一道「新题」（与首轮不同），证明确实重选而非原样返回
    const firstIds = new Set(first.data!.item_sequence.map((entry) => entry.item_id));
    expect(ids.some((id) => !firstIds.has(id))).toBe(true);
  });

  it('短链（≤4 节点）时每节点 2 题', async () => {
    const user = await app.register(uniqueIdentifier());
    // 2026-09-23 后 factoring 链长 7；换真正的短链根因（链长 1）
    const res = await generate(user, 'math.cz.number.rational', 'concept_confusion');
    const path = res.data!.path;

    expect(path.length).toBeLessThanOrEqual(4);
    const kps = res.data!.item_sequence.map(
      (entry) => SD.itemById.get(entry.item_id)!.knowledge_point,
    );
    for (const kp of new Set(kps)) {
      expect(kps.filter((value) => value === kp)).toHaveLength(2);
    }
  });
});
