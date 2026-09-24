/**
 * 学段清单一致性 + 空间名建议测试（D6）
 *
 * 与 graphSnapshot.test.ts 同一手法：前端静态副本必须与仓库静态数据逐项一致，
 * 防「加了学段只改一边」的漂移。本文件是纯逻辑，node 环境即可（无需 jsdom）。
 *
 * 长度上限（赛前修整轮 H1）：SPACE_NAME_MAX 必须与后端 MAX_SPACE_NAME_LENGTH 同值同源，
 * 且 suggestSpaceName() 在任何 base 长度下都返回 ≤ 上限的名字——这样「输入框能打出来的字」
 * 与「服务端收得下的字」才不会错位（曾出现 40 vs 30：31–40 字必 400；30 字原名已占用时
 * 自动后缀拼出 32 字、同样必 400）。故下面既有「恰为上限」的定点用例，也有全长度扫描的性质用例。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SPACE_NAME_MAX, STAGES, suggestSpaceName, stageLabel, DEFAULT_STAGE_ID } from '../src/lib/stages';

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

describe('stages · 空间名长度上限（H1：前端 30 与服务端同源，任何输入都不因长度被 400）', () => {
  /** 定点构造：恰为 / 超过上限的中文名（「一」×3 的重复块，长度好数）。 */
  const base30 = '一二三四五六七八九十'.repeat(3); // 30 字 = 上限
  const base40 = '一二三四五六七八九十'.repeat(4); // 40 字 > 上限

  it('SPACE_NAME_MAX 与后端 MAX_SPACE_NAME_LENGTH 同值（读后端源文件核对，防两处漂移）', () => {
    const serverSrc = readFileSync(
      resolve(REPO_ROOT, 'functions/api/src/services/space.ts'),
      'utf8',
    );
    const matched = /MAX_SPACE_NAME_LENGTH\s*=\s*(\d+)/.exec(serverSrc);

    expect(matched, '后端 space.ts 里应能找到 MAX_SPACE_NAME_LENGTH 的字面量').not.toBeNull();
    expect(Number(matched![1])).toBe(SPACE_NAME_MAX);
    // 契约 §2 v1.2「name 可选，1–30 字」——改这个数字要先改契约，再两处同步
    expect(SPACE_NAME_MAX).toBe(30);
    expect(base30).toHaveLength(SPACE_NAME_MAX);
    expect(base40.length).toBeGreaterThan(SPACE_NAME_MAX);
  });

  it('base 恰为上限（30 字）且未占用 → 原样返回，长度 = 30', () => {
    const name = suggestSpaceName(base30, []);

    expect(name).toBe(base30);
    expect(name).toHaveLength(SPACE_NAME_MAX);
  });

  it('base 恰为上限且已占用 → 长度 ≤ 30、不与 taken 冲突、保留 base 可辨识前缀（不复现 32 字）', () => {
    const name = suggestSpaceName(base30, [base30]);

    expect(name.length).toBeLessThanOrEqual(SPACE_NAME_MAX);
    expect([base30]).not.toContain(name);
    expect(name.endsWith(' 2')).toBe(true);
    // 前缀必须是 base 的前缀：截断后仍可辨识，不退化成空串或纯序号
    const head = name.slice(0, name.length - ' 2'.length);
    expect(head.length).toBeGreaterThan(0);
    expect(base30.startsWith(head)).toBe(true);
    expect(head).toBe(base30.slice(0, SPACE_NAME_MAX - ' 2'.length));
  });

  it('base 恰为上限且连号占用 → 依次拿到 2、3，长度都 ≤ 30', () => {
    const second = suggestSpaceName(base30, [base30]);
    const third = suggestSpaceName(base30, [base30, second]);

    expect(second.endsWith(' 2')).toBe(true);
    expect(third.endsWith(' 3')).toBe(true);
    expect(second.length).toBeLessThanOrEqual(SPACE_NAME_MAX);
    expect(third.length).toBeLessThanOrEqual(SPACE_NAME_MAX);
    expect([base30, second]).not.toContain(third);
  });

  it('base 超长（40 字）→ 返回值长度 ≤ 30（不把超长名原样发给服务端）', () => {
    const free = suggestSpaceName(base40, []);
    const taken = suggestSpaceName(base40, [free]);

    expect(free).toHaveLength(SPACE_NAME_MAX);
    expect(free).toBe(base40.slice(0, SPACE_NAME_MAX));
    expect(taken.length).toBeLessThanOrEqual(SPACE_NAME_MAX);
    expect([free]).not.toContain(taken);
  });

  it('base 自带首尾空格 → 先 trim 再判重（否则后端 trim 后会撞上已有空间名）', () => {
    expect(suggestSpaceName('初中数学  ', ['初中数学'])).toBe('初中数学 2');
    expect(suggestSpaceName('  我的错题本  ', [])).toBe('我的错题本');
    expect(suggestSpaceName(`  ${base30}  `, [base30]).length).toBeLessThanOrEqual(SPACE_NAME_MAX);
  });

  it('base 为空 / 纯空白 → 退回兜底名（绝不返回空串，否则服务端 400「name 不能为空白」）', () => {
    expect(suggestSpaceName('', [])).toBe('学习空间');
    expect(suggestSpaceName('   ', [])).toBe('学习空间');
  });

  it('性质扫描：base 长度 0–60 × 四种占用情形 → 结果恒非空、恒 ≤ 30、恒不与 taken 冲突', () => {
    for (let length = 0; length <= 60; length += 1) {
      const base = '甲'.repeat(length);
      const cases: string[][] = [
        [],
        [base],
        [base, `${base} 2`],
        [base, `${base} 2`, `${base} 3`],
        [`${base} 2`, `${base} 3`],
      ];
      for (const taken of cases) {
        const name = suggestSpaceName(base, taken);
        expect(name.length, `base=${length} 字、taken=${taken.length} 项`).toBeLessThanOrEqual(
          SPACE_NAME_MAX,
        );
        expect(name.length).toBeGreaterThan(0);
        expect(taken, `base=${length} 字的结果不应与已占用名冲突`).not.toContain(name);
      }
    }
  });
});
