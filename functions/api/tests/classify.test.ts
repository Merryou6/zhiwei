/**
 * 错误诊断接口测试（契约 §6，接口 #12 POST /api/error/classify）
 *
 * 覆盖：命中真实错误路径 → adopted（confidence 0.90、matched 为该 kp 的 code、
 * confidence/枚举/direction 均由**服务端后处理**决定）；未命中 → clarify（0.45 被
 * CONF_ADOPT 拦截）；作答正确 → clarify（规则 2）；**五类 error_type 的
 * attribution_direction 逐一断言**；参数校验与 401/403；不落表。
 *
 * 样本全部取自题库真实 distractor（已核对：该 kp 内首个命中即为目标 code，
 * 且不与任何标准答案同值），不发明题库里不存在的作答文本。
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ATTRIBUTION_DIRECTION, ERROR_TYPES, loadStaticData } from '../src/data/staticData';
import type { ErrorType } from '../src/data/staticData';
import { createTestApp, uniqueIdentifier, REPO_ROOT } from './helpers';
import type { TestApp, TestUser } from './helpers';

const SD = loadStaticData(REPO_ROOT);

let app: TestApp;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.cleanup();
});

interface AdoptedData {
  status: 'adopted';
  knowledge_point: string;
  error_type: ErrorType;
  matched_typical_error: string | null;
  confidence: number;
  evidence: string;
  attribution_direction: 'upstream' | 'self' | 'none';
}

interface ClarifyData {
  status: 'clarify';
  question: string;
}

const classify = (
  user: TestUser,
  body: { kp_id: string; student_answer: string; item_id?: string; stem?: string },
) =>
  app.post<AdoptedData | ClarifyData>(
    '/api/error/classify',
    { space_id: user.space_id, ...body },
    { token: user.token },
  );

/** 五类枚举的样本：(kp, item 内该 code 的 distractor 答案, 期望 code) */
const FIVE_SAMPLES: { kp_id: string; item_id: string; answer: string; code: string }[] = [
  { kp_id: 'math.cz.quadratic.vertex_form', item_id: 'q_cz_vertex_001', answer: '(-1, 2)', code: 'sign_confusion' },
  { kp_id: 'math.cz.quadratic.vertex_form', item_id: 'q_cz_vertex_006', answer: 'y = (x + 2)^2 + 1', code: 'no_vertex_form' },
  { kp_id: 'math.cz.quadratic.general_to_vertex', item_id: 'q_cz_g2v_006', answer: 'y = (x + 2)^2 - 7', code: 'prerequisite_completing_square_gap' },
  { kp_id: 'math.cz.algebra.basic', item_id: 'q_cz_basic_001', answer: '-10', code: 'negative_sign_drop' },
  { kp_id: 'math.cz.algebra.basic', item_id: 'q_cz_basic_002', answer: '6', code: 'misread_variable' },
];

describe('classify · 契约 §6 采纳路径', () => {
  it('命中 distractor（vertex_form / sign_confusion）→ adopted，字段与后处理规则一致', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await classify(user, {
      kp_id: 'math.cz.quadratic.vertex_form',
      item_id: 'q_cz_vertex_001',
      student_answer: '(-1, 2)',
    });

    expect(res.code).toBe(0);
    const data = res.data as AdoptedData;
    expect(data.status).toBe('adopted');
    expect(Object.keys(data).sort()).toEqual(
      [
        'attribution_direction',
        'confidence',
        'error_type',
        'evidence',
        'knowledge_point',
        'matched_typical_error',
        'status',
      ].sort(),
    );
    expect(data.knowledge_point).toBe('math.cz.quadratic.vertex_form');
    expect(data.error_type).toBe('concept_confusion');
    expect(data.matched_typical_error).toBe('sign_confusion');
    expect(data.confidence).toBeCloseTo(0.9, 10);
    expect(data.evidence).toEqual(expect.any(String));
    expect(data.attribution_direction).toBe('self');
  });

  it('item_id 缺省时用请求 stem（规则 3 走 clarify），不抛错', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await classify(user, {
      kp_id: 'math.cz.quadratic.vertex_form',
      stem: '抛物线 y = (x + 2)^2 + 3 的顶点坐标是____。',
      student_answer: '(-1, 2)',
    });

    expect(res.code).toBe(0);
    expect((res.data as AdoptedData).status).toBe('adopted');
    expect((res.data as AdoptedData).matched_typical_error).toBe('sign_confusion');
  });

  it('五类 error_type 的 attribution_direction 逐一断言（ALGORITHM §3 映射表）', async () => {
    const user = await app.register(uniqueIdentifier());
    const seen = new Set<ErrorType>();

    for (const sample of FIVE_SAMPLES) {
      const res = await classify(user, {
        kp_id: sample.kp_id,
        item_id: sample.item_id,
        student_answer: sample.answer,
      });

      expect(res.code).toBe(0);
      const data = res.data as AdoptedData;
      expect(data.status).toBe('adopted');
      expect(data.matched_typical_error).toBe(sample.code);
      expect(data.attribution_direction).toBe(ATTRIBUTION_DIRECTION[data.error_type]);
      seen.add(data.error_type);
    }

    // 样本覆盖五类全局枚举
    expect([...seen].sort()).toEqual([...ERROR_TYPES].sort());
    expect(ATTRIBUTION_DIRECTION.procedural_slip).toBe('none');
    expect(ATTRIBUTION_DIRECTION.misreading).toBe('none');
  });
});

describe('classify · 契约 §6 退回澄清路径', () => {
  it('未命中任何已知错误路径 → clarify（confidence 0.45 < CONF_ADOPT）', async () => {
    const user = await app.register(uniqueIdentifier());
    const res = await classify(user, {
      kp_id: 'math.cz.quadratic.vertex_form',
      item_id: 'q_cz_vertex_001',
      student_answer: '我自己随便写的答案',
    });

    expect(res.code).toBe(0);
    const data = res.data as ClarifyData;
    expect(data.status).toBe('clarify');
    expect(Object.keys(data).sort()).toEqual(['question', 'status'].sort());
    expect(data.question).toBe('你这一步是怎么算的？能写一下吗？');
    expect(0.45).toBeLessThan(app.ctx.params.CONF_ADOPT);
  });

  it('作答正确（命中标准答案）→ clarify（规则 2：错误分类无对象）', async () => {
    const user = await app.register(uniqueIdentifier());
    const item = SD.itemById.get('q_cz_vertex_001')!;
    const res = await classify(user, {
      kp_id: 'math.cz.quadratic.vertex_form',
      item_id: item.item_id,
      student_answer: item.answer,
    });

    expect(res.code).toBe(0);
    const data = res.data as ClarifyData;
    expect(data.status).toBe('clarify');
    expect(data.question).toContain('做对了');
  });

  it('classify 不落表（契约 §6：模型受约束调用，无独立表）', async () => {
    const user = await app.register(uniqueIdentifier());
    await classify(user, {
      kp_id: 'math.cz.quadratic.vertex_form',
      item_id: 'q_cz_vertex_001',
      student_answer: '(-1, 2)',
    });

    expect(await app.ctx.store.listEventsBySpace(user.space_id)).toHaveLength(0);
    expect(await app.ctx.store.listLogsBySpace(user.space_id)).toHaveLength(0);
  });
});

describe('classify · 契约 §6/§0 参数校验与鉴权', () => {
  it('kp_id 不在知识库 → 400；item_id 不存在 → 404；缺 stem 与 item_id → 400', async () => {
    const user = await app.register(uniqueIdentifier());

    expect((await classify(user, { kp_id: 'math.nc.zzz', student_answer: 'x' })).code).toBe(400);
    expect(
      (await classify(user, { kp_id: 'math.cz.quadratic.vertex_form', item_id: 'q_nope', student_answer: 'x' })).code,
    ).toBe(404);
    expect(
      (await classify(user, { kp_id: 'math.cz.quadratic.vertex_form', student_answer: 'x' })).code,
    ).toBe(400);
    expect(
      (await classify(user, { kp_id: 'math.cz.quadratic.vertex_form', item_id: 'q_cz_vertex_001', student_answer: 7 as unknown as string })).code,
    ).toBe(400);
  });

  it('跨用户 space_id → 403；未认证 → 401', async () => {
    const a = await app.register(uniqueIdentifier());
    const b = await app.register(uniqueIdentifier());

    const cross = await app.post(
      '/api/error/classify',
      { space_id: a.space_id, kp_id: 'math.cz.quadratic.vertex_form', student_answer: '(-1, 2)' },
      { token: b.token },
    );
    expect(cross.code).toBe(403);

    expect(
      (await app.post('/api/error/classify', {
        space_id: a.space_id,
        kp_id: 'math.cz.quadratic.vertex_form',
        student_answer: '(-1, 2)',
      })).code,
    ).toBe(401);
  });
});
