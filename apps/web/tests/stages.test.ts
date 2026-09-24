/**
 * 学段清单一致性 + 空间名建议测试（D6）
 *
 * 与 graphSnapshot.test.ts 同一手法：前端静态副本必须与仓库静态数据逐项一致，
 * 防「加了学段只改一边」的漂移。本文件是纯逻辑，node 环境即可（无需 jsdom）。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { STAGES, suggestSpaceName, stageLabel, DEFAULT_STAGE_ID } from '../src/lib/stages';

interface StageIndex {
  subjects: { key: string; stages: { key: string; name: string; kb_id: string; file: string }[] }[];
}

/** apps/web/tests → 仓库根 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('stages · 与 data/knowledge/index.json 一致（D6）', () => {
  it('STAGES 的 id / label 与 index.json 的 stages 逐项一致', () => {
    const index = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'data/knowledge/index.json'), 'utf8'),
    ) as StageIndex;
    const stages = index.subjects.flatMap((subject) => subject.stages);

    expect(STAGES.map((stage) => ({ kb_id: stage.id, name: stage.label }))).toEqual(
      stages.map((stage) => ({ kb_id: stage.kb_id, name: stage.name })),
    );
  });

  it('默认学段是首个选项；stageLabel 按 kb 回显，未知 id 回退「数学」', () => {
    expect(DEFAULT_STAGE_ID).toBe(STAGES[0].id);
    expect(stageLabel('kb_math_cz')).toBe('初中数学');
    expect(stageLabel('kb_math_gz')).toBe('高中数学');
    expect(stageLabel('kb_unknown')).toBe('数学');
    expect(stageLabel(undefined)).toBe('数学');
  });
});

describe('stages · suggestSpaceName（D1d 本地预检）', () => {
  it('不重名 → 原样返回', () => {
    expect(suggestSpaceName('我的错题本', ['初中数学', '高中数学'])).toBe('我的错题本');
  });

  it('重名 → 追加序号 2', () => {
    expect(suggestSpaceName('初中数学', ['初中数学'])).toBe('初中数学 2');
  });

  it('连号 → 依次递增到 3', () => {
    expect(suggestSpaceName('初中数学', ['初中数学', '初中数学 2'])).toBe('初中数学 3');
    expect(suggestSpaceName('初中数学', ['初中数学', '初中数学 2', '初中数学 3'])).toBe('初中数学 4');
  });

  it('taken 为空数组 → 原样返回', () => {
    expect(suggestSpaceName('初中数学', [])).toBe('初中数学');
  });
});
