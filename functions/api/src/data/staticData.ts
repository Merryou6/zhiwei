/**
 * 静态数据加载（知识图谱 + 题库 + 学科索引）
 *
 * 数据来源（DATA_SCHEMA §1，2026-09-23 起多学段）：
 *   data/knowledge/index.json        学科索引（kb_id → 知识库名；每 stage 一个图谱）
 *   data/knowledge/math/cz.json      初中 24 节点 / gz.json 高中 12 节点
 *   data/item_bank/math/<stage>.json 对应学段的题库（cz 272 题 / gz 132 题）
 *
 * 进程内缓存（按 rootDir 缓存，测试可注入不同 rootDir）；只读，永不写入。
 * CloudBase 形态下题库等价于读 item_bank 表（见 db/cloudbaseStore.ts 桩注释）；
 * 本地形态直接读静态文件（DATA_SCHEMA §7：知识库 JSON 不入库）。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** five-value global enum（契约 §6 / ALGORITHM §3），全局唯一来源。 */
export const ERROR_TYPES = [
  'prerequisite_gap',
  'concept_confusion',
  'method_gap',
  'procedural_slip',
  'misreading',
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

/** error_type → attribution_direction 服务端硬编码映射（ALGORITHM §3，不采信模型输出）。 */
export const ATTRIBUTION_DIRECTION: Record<ErrorType, 'upstream' | 'self' | 'none'> = {
  prerequisite_gap: 'upstream',
  concept_confusion: 'self',
  method_gap: 'self',
  procedural_slip: 'none',
  misreading: 'none',
};

/** plan/generate 的 strategy 枚举（ALGORITHM §4 三条 + §3 两条转训动作）。 */
export const STRATEGY_BY_ERROR_TYPE: Record<ErrorType, string> = {
  concept_confusion: '对比辨析',
  method_gap: '思路示范',
  prerequisite_gap: '先补上游 + 上游讲解',
  procedural_slip: '熟练度训练',
  misreading: '审题训练',
};

export interface TypicalError {
  code: string;
  desc: string;
  error_type: ErrorType;
  remedy: string;
}

export interface KnowledgeNode {
  id: string;
  name: string;
  subject: string;
  stage: string;
  grade: string;
  chapter: string;
  difficulty: number;
  prerequisites: string[];
  successors: string[];
  typical_errors: TypicalError[];
  sample_items: string[];
}

export type ItemPool = 'train' | 'retest';
export type ItemType = 'choice' | 'fill' | 'short_answer';

export interface BankDistractor {
  answer: string;
  typical_error_code: string;
  explanation: string;
}

export interface BankItemRecord {
  item_id: string;
  knowledge_point: string;
  pool: ItemPool;
  type: ItemType;
  difficulty: number;
  stem: string;
  options: string[] | null;
  /** 标准答案：**绝不下发前端**（序列化白名单见 serialization.ts）。 */
  answer: string;
  /** 分步解答：**绝不下发前端**（仅 chat 完整解法话术内部消费）。 */
  solution_steps: string[];
  distractors: BankDistractor[];
}

export interface KnowledgeStage {
  key: string;
  name: string;
  kb_id: string;
  file: string;
}

export interface KnowledgeSubject {
  key: string;
  stages: KnowledgeStage[];
}

export interface SubjectIndex {
  subjects: KnowledgeSubject[];
}

export interface StaticData {
  rootDir: string;
  index: SubjectIndex;
  nodes: KnowledgeNode[];
  nodeById: Map<string, KnowledgeNode>;
  items: BankItemRecord[];
  itemById: Map<string, BankItemRecord>;
  /** 章节名 → 该章节全部节点（自报先验按章节展开；跨学段全局口径）。 */
  nodesByChapter(chapter: string): KnowledgeNode[];
  /** kb 作用域：该知识库的全部节点（多学段并存后，选题/报告/对话都要按空间隔离）。 */
  nodesForKb(kbId: string): KnowledgeNode[];
  /** kb 作用域的章节查询（防止 cz/gz 同名章节互相串）。 */
  nodesByChapterForKb(kbId: string, chapter: string): KnowledgeNode[];
  /** kb 作用域：该知识库的全部题目（选题引擎的 bank 输入）。 */
  itemsForKb(kbId: string): BankItemRecord[];
  /** 全部合法 kb_id（space/create 的合法值来源）。 */
  kbIds(): string[];
  /** 知识点 → 该 kp 全部题（可再按 pool 过滤）。 */
  itemsByKp(kpId: string): BankItemRecord[];
  /** 知识点 → 指定池的题（按难度升序，同日同池顺序稳定）。 */
  itemsByKpPool(kpId: string, pool: ItemPool): BankItemRecord[];
  /** kb_id → 知识库展示名（space/create 的 name 由服务端取此值）。 */
  kbName(kbId: string): string | null;
  /** kb_id → 学科中文名（spaces.subject）。 */
  subjectOfKb(kbId: string): string | null;
  /** kp 的祖先链（全部上游，含间接），按「离 kp 由近到远」稳定排序。 */
  ancestorsOf(kpId: string): string[];
  /** kp 的祖先链（含自身），上游在前（拓扑序），供 plan/generate 使用。 */
  chainIncludingSelf(kpId: string): string[];
}

const DEFAULT_ROOT = process.env.ZHIWEI_ROOT ?? process.cwd();

const knowledgeIndexPath = 'data/knowledge/index.json';

const cache = new Map<string, StaticData>();

function readJson<T>(absolutePath: string): T {
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

/** 载入静态数据（进程内缓存）。rootDir 为仓库根；文件缺失时抛出可读错误。
 *  多学段：遍历 index 的全部 stages，图谱走 stage.file，题库按
 *  data/item_bank/<subject.key>/<stage.key>.json 路由（cz / gz / …）。 */
export function loadStaticData(rootDir: string = DEFAULT_ROOT): StaticData {
  const cached = cache.get(rootDir);
  if (cached) return cached;

  const index = readJson<SubjectIndex>(resolve(rootDir, knowledgeIndexPath));
  const subjects = index.subjects ?? [];
  const stages = subjects.flatMap((s) => s.stages ?? []);
  if (stages.length === 0) throw new Error(`${knowledgeIndexPath} 中没有任何 stages`);

  const nodes: KnowledgeNode[] = [];
  const items: BankItemRecord[] = [];
  const nodesByStage = new Map<string, KnowledgeNode[]>();
  const itemsByStage = new Map<string, BankItemRecord[]>();
  const stageByKb = new Map<string, KnowledgeStage>();
  const subjectKeyByKb = new Map<string, string>();

  for (const subject of subjects) {
    for (const stage of subject.stages ?? []) {
      stageByKb.set(stage.kb_id, stage);
      subjectKeyByKb.set(stage.kb_id, subject.key);
      const graphFile = readJson<{ nodes: KnowledgeNode[] }>(resolve(rootDir, stage.file));
      const bankFile = readJson<{ items: BankItemRecord[] }>(
        resolve(rootDir, 'data', 'item_bank', subject.key, `${stage.key}.json`),
      );
      if (!Array.isArray(graphFile.nodes) || graphFile.nodes.length === 0) {
        throw new Error(`${stage.file} 的 nodes 缺失或为空`);
      }
      if (!Array.isArray(bankFile.items)) {
        throw new Error(`${subject.key}/${stage.key}.json 的 items 必须为数组`);
      }
      nodesByStage.set(stage.key, graphFile.nodes);
      itemsByStage.set(stage.key, bankFile.items);
      nodes.push(...graphFile.nodes);
      items.push(...bankFile.items);
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const itemById = new Map(items.map((i) => [i.item_id, i]));

  const itemsByKpIndex = new Map<string, BankItemRecord[]>();
  for (const item of items) {
    const list = itemsByKpIndex.get(item.knowledge_point);
    if (list) list.push(item);
    else itemsByKpIndex.set(item.knowledge_point, [item]);
  }

  const byDifficulty = (a: BankItemRecord, b: BankItemRecord) =>
    a.difficulty - b.difficulty || (a.item_id < b.item_id ? -1 : a.item_id > b.item_id ? 1 : 0);

  const nodesByChapter = (chapter: string): KnowledgeNode[] =>
    nodes.filter((n) => n.chapter === chapter);

  const itemsByKp = (kpId: string): BankItemRecord[] => itemsByKpIndex.get(kpId) ?? [];

  const itemsByKpPool = (kpId: string, pool: ItemPool): BankItemRecord[] =>
    itemsByKp(kpId)
      .filter((i) => i.pool === pool)
      .sort(byDifficulty);

  const kbIds = (): string[] => [...stageByKb.keys()];

  const nodesForKb = (kbId: string): KnowledgeNode[] => {
    const stage = stageByKb.get(kbId);
    return stage ? (nodesByStage.get(stage.key) ?? []) : [];
  };

  const nodesByChapterForKb = (kbId: string, chapter: string): KnowledgeNode[] =>
    nodesForKb(kbId).filter((n) => n.chapter === chapter);

  const itemsForKb = (kbId: string): BankItemRecord[] => {
    const stage = stageByKb.get(kbId);
    return stage ? (itemsByStage.get(stage.key) ?? []) : [];
  };

  const kbName = (kbId: string): string | null =>
    stages.find((s) => s.kb_id === kbId)?.name ?? null;

  const subjectOfKb = (kbId: string): string | null => {
    // 索引不含学科中文名，取该阶段任一节点的 subject 字段（图谱规格必填）
    const node = nodesForKb(kbId)[0];
    return node ? node.subject : null;
  };

  /** 全部祖先（含间接），按「离 kp 由近到远 + id 稳定」排序。 */
  const ancestorsOf = (kpId: string): string[] => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    let frontier = [...(nodeById.get(kpId)?.prerequisites ?? [])].sort();
    let hops = 0;
    while (frontier.length > 0 && hops <= nodes.length) {
      const next: string[] = [];
      for (const p of frontier) {
        if (seen.has(p)) continue;
        seen.add(p);
        ordered.push(p);
        next.push(...(nodeById.get(p)?.prerequisites ?? []));
      }
      frontier = [...next].sort();
      hops += 1;
    }
    return ordered;
  };

  /** 先修链深度（根节点为 0），用于拓扑排序。 */
  const depthOf = (id: string, memo = new Map<string, number>()): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    memo.set(id, 0); // 防御性占位（图谱为 DAG，已由校验脚本保证）
    const prereqs = nodeById.get(id)?.prerequisites ?? [];
    const value = prereqs.length === 0 ? 0 : 1 + Math.max(...prereqs.map((p) => depthOf(p, memo)));
    memo.set(id, value);
    return value;
  };

  /** 祖先链（含自身），上游在前（拓扑序），末尾为 kp 自身。 */
  const chainIncludingSelf = (kpId: string): string[] => {
    const memo = new Map<string, number>();
    const ordered = [...ancestorsOf(kpId)].sort(
      (a, b) => depthOf(a, memo) - depthOf(b, memo) || (a < b ? -1 : a > b ? 1 : 0),
    );
    return [...ordered, kpId];
  };

  const data: StaticData = {
    rootDir,
    index,
    nodes,
    nodeById,
    items,
    itemById,
    nodesByChapter,
    nodesForKb,
    nodesByChapterForKb,
    itemsForKb,
    kbIds,
    itemsByKp,
    itemsByKpPool,
    kbName,
    subjectOfKb,
    ancestorsOf,
    chainIncludingSelf,
  };

  cache.set(rootDir, data);
  return data;
}

/** 清空缓存（测试用）。 */
export function clearStaticDataCache(): void {
  cache.clear();
}

export function isErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && (ERROR_TYPES as readonly string[]).includes(value);
}
