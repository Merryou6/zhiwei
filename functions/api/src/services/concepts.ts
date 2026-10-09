/**
 * 概念知识库服务（契约 §16 · v2.2-m1，接口 #36 GET /api/concepts?space_id=xxx[&chapter=yyy]）
 *
 * 支柱⑤「概念问答给体系」+ 支柱⑥「推理引导给阶梯」的数据底座：
 *   每张概念卡 = definition 定义 + key_points 体系要点 + method 核心方法（提示链 L1 方向）
 *   + hint 通俗思路（提示链 L2）+ classic_example 典型例（讲透）+ common_errors 易错点
 *   + related 关联知识点（触类旁通）。
 *
 * 口径：
 *   - 卡内容为人工撰写的教学材料（data/knowledge/math/cz_concepts.json，24 卡与 cz.json 节点一一对应）；
 *   - classic_example 是独立撰写的示例题（不是题库题），因此可以完整讲透——这正是
 *     「概念不是不给答案，而是给体系」的落点；题库题的 answer/solution_steps 红线不变；
 *   - kb 隔离：卡片按 kp_id 是否属于该空间知识库过滤（gz 空间自然得空集）；
 *   - 提示链 L1/L2 同时供 #34 practice/ladder 使用（知识点级提示，不涉具体题解答，不泄题）。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';

/** 概念卡（响应白名单，显式结构）。 */
export interface ConceptCard {
  kp_id: string;
  name: string;
  chapter: string;
  definition: string;
  key_points: string[];
  /** 核心方法：提示链 L1（方向）。 */
  method: string;
  /** 通俗思路：提示链 L2（阶梯）。 */
  hint: string;
  classic_example: { stem: string; steps: string[] };
  common_errors: string[];
  related: string[];
}

interface ConceptFile {
  meta: Record<string, unknown>;
  cards: ConceptCard[];
}

/** rootDir → 卡片缓存（与 staticData 同思路；文件缺失 → 空数组，不炸服务）。 */
const cache = new Map<string, ConceptCard[]>();

function loadCards(rootDir: string): ConceptCard[] {
  const cached = cache.get(rootDir);
  if (cached) return cached;
  let cards: ConceptCard[] = [];
  try {
    const file = JSON.parse(
      readFileSync(resolve(rootDir, 'data/knowledge/math/cz_concepts.json'), 'utf8'),
    ) as ConceptFile;
    if (Array.isArray(file.cards)) cards = file.cards;
  } catch {
    cards = [];
  }
  cache.set(rootDir, cards);
  return cards;
}

/** 单卡查询（practice/ladder 的提示链 L1/L2 数据源）。 */
export function conceptCardOf(ctx: AppContext, kpId: string): ConceptCard | null {
  return loadCards(ctx.rootDir).find((card) => card.kp_id === kpId) ?? null;
}

/** GET /api/concepts?space_id=xxx[&chapter=yyy] */
export async function concepts(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const space = await requireSpaceOwnership(ctx, user.user_id, spaceId);

  const chapter = req.query.chapter ?? req.body.chapter;
  const chapterFilter = typeof chapter === 'string' && chapter.trim().length > 0 ? chapter.trim() : null;

  const kbId = space.knowledge_source[0];
  const kbKpIds = new Set(ctx.data.nodesForKb(kbId).map((node) => node.id));
  if (kbKpIds.size === 0) {
    throw httpError.badRequest(`知识库不存在或为空：${kbId}`);
  }

  // kb 隔离：只保留该空间知识库覆盖的知识点卡（cz 空间 → 24 卡；gz 空间 → 空集）
  const scoped = loadCards(ctx.rootDir).filter((card) => kbKpIds.has(card.kp_id));
  const cards = chapterFilter ? scoped.filter((card) => card.chapter === chapterFilter) : scoped;
  if (chapterFilter && cards.length === 0) {
    throw httpError.badRequest(`章节不存在或暂无概念卡：${chapterFilter}`);
  }

  return ok({ space_id: spaceId, count: cards.length, cards });
}
