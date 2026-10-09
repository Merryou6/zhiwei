/**
 * 专项阶梯服务（契约 §15 · v2.2-m1）
 *
 * #34 GET /api/practice/ladder?space_id=xxx&chapter=yyy[&size=n]
 *     系统性刷题（支柱②）：把某章节的 train 池题按难度升序组成一梯子（默认 5 题，上限 8），
 *     排除该学生在本空间已练过的题（练完一轮后回流 refill 并标记 refilled=true）。
 *     每题附提示链：approach = 概念卡核心方法（L1 方向）、hint = 概念卡通俗思路（L2）——
 *     提示是「知识点级」的，不含本题解答，不泄题；第三级引导就是本产品核心的逐步批改本身。
 *
 * #35 GET /api/practice/progress?space_id=xxx[&chapter=yyy]
 *     练习进度（支柱②的可见性）：按章节聚合 practice 证据——提交数 / 练过题数 / 正确数 /
 *     平均通过率（raw.pass_ratio）/ 最近练习时间；整体口径 overall 同源。
 *
 * 红线：响应显式字面构造，无 answer / solution_steps / distractors（assertNoForbiddenKeys）。
 */

import { ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import { authedUser } from './auth';
import { assertNoForbiddenKeys } from '../serialization';
import { conceptCardOf } from './concepts';

export const LADDER_DEFAULT_SIZE = 5;
export const LADDER_MAX_SIZE = 8;

/** 阶梯题视图（响应白名单，显式字面构造；无 answer / solution_steps / distractors）。 */
export interface LadderItemView {
  item_id: string;
  seq: number;
  kp_id: string;
  kp_name: string;
  chapter: string;
  difficulty: number;
  type: string;
  stem: string;
  options: string[] | null;
  /** 提示链 L1（方向）：概念卡核心方法。 */
  approach: string;
  /** 提示链 L2（思路）：概念卡通俗思路。 */
  hint: string;
}

export interface LadderData {
  space_id: string;
  chapter: string;
  requested_size: number;
  /** 剩余新题不足时是否回流整章题库（练完一轮再练的口径）。 */
  refilled: boolean;
  items: LadderItemView[];
}

export interface ChapterProgress {
  chapter: string;
  submissions: number;
  practiced_items: number;
  correct: number;
  /** raw.pass_ratio 的均值；尚无数据为 null。 */
  avg_pass_ratio: number | null;
  last_practiced_at: string | null;
}

export interface PracticeProgressData {
  space_id: string;
  chapters: ChapterProgress[];
  overall: ChapterProgress;
}

/** GET /api/practice/ladder */
export async function practiceLadder(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const chapter = req.query.chapter ?? req.body.chapter;
  if (typeof chapter !== 'string' || chapter.trim().length === 0) {
    throw httpError.badRequest('缺少 chapter');
  }
  const sizeRaw = Number(req.query.size ?? req.body.size ?? LADDER_DEFAULT_SIZE);
  const size =
    Number.isFinite(sizeRaw) && sizeRaw > 0
      ? Math.min(Math.trunc(sizeRaw), LADDER_MAX_SIZE)
      : LADDER_DEFAULT_SIZE;

  const space = await requireSpaceOwnership(ctx, user.user_id, spaceId);
  const kbId = space.knowledge_source[0];

  const chapterNodes = ctx.data.nodesForKb(kbId).filter((node) => node.chapter === chapter);
  if (chapterNodes.length === 0) {
    throw httpError.badRequest(`章节不存在：${chapter}`);
  }
  const nameByKp = new Map(chapterNodes.map((node) => [node.id, node.name]));
  const kpIds = new Set(chapterNodes.map((node) => node.id));

  const chapterItems = ctx.data
    .itemsForKb(kbId)
    .filter((item) => kpIds.has(item.knowledge_point) && item.pool === 'train');
  if (chapterItems.length === 0) {
    throw httpError.badRequest('该章节暂无练习题');
  }

  // 排除本空间该学生已练过的题（practice 证据里的 item_id）
  const practiced = new Set(
    (await ctx.store.listEventsBySpace(space.space_id))
      .filter((event) => event.source === 'practice' && event.user_id === user.user_id)
      .map((event) => event.item_id)
      .filter((itemId): itemId is string => typeof itemId === 'string'),
  );
  let remaining = chapterItems.filter((item) => !practiced.has(item.item_id));
  let refilled = false;
  if (remaining.length < size) {
    // 练完一轮 → 回流整章（阶梯可反复刷；refilled=true 让前端提示「第二轮」）
    remaining = [...chapterItems];
    refilled = remaining.length >= size;
  }
  if (remaining.length === 0) {
    throw httpError.badRequest('该章节暂无可练习的题');
  }

  // 难度升序 = 由易到难的阶梯；同难度按 item_id 稳定排序（可复现）
  remaining.sort((a, b) => a.difficulty - b.difficulty || a.item_id.localeCompare(b.item_id));

  const items: LadderItemView[] = remaining.slice(0, size).map((item, index) => {
    const card = conceptCardOf(ctx, item.knowledge_point);
    const kpName = nameByKp.get(item.knowledge_point) ?? item.knowledge_point;
    return {
      item_id: item.item_id,
      seq: index + 1,
      kp_id: item.knowledge_point,
      kp_name: kpName,
      chapter,
      difficulty: item.difficulty,
      type: item.type,
      stem: item.stem,
      options: item.options,
      approach: card?.method ?? `先回想「${kpName}」的核心方法，再动笔。`,
      hint: card?.hint ?? '先把这一步要用到的公式或定理写出来，再动手算。',
    };
  });

  const data: LadderData = {
    space_id: space.space_id,
    chapter,
    requested_size: size,
    refilled,
    items,
  };
  assertNoForbiddenKeys(data, 'practice/ladder');
  return ok(data);
}

/** GET /api/practice/progress */
export async function practiceProgress(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);

  const spaceId = req.query.space_id ?? req.body.space_id;
  if (typeof spaceId !== 'string' || spaceId.trim().length === 0) {
    throw httpError.badRequest('缺少 space_id');
  }
  const space = await requireSpaceOwnership(ctx, user.user_id, spaceId);

  const chapter = req.query.chapter ?? req.body.chapter;
  const chapterFilter = typeof chapter === 'string' && chapter.trim().length > 0 ? chapter.trim() : null;

  const nodes = ctx.data.nodesForKb(space.knowledge_source[0]);
  const chapterOfKp = new Map(nodes.map((node) => [node.id, node.chapter]));

  interface Bucket {
    submissions: number;
    itemIds: Set<string>;
    correct: number;
    passSum: number;
    passCount: number;
    last: string | null;
  }
  const buckets = new Map<string, Bucket>();
  const events = (await ctx.store.listEventsBySpace(space.space_id)).filter(
    (event) => event.source === 'practice' && event.user_id === user.user_id,
  );
  for (const event of events) {
    const chapterName = chapterOfKp.get(event.knowledge_point);
    if (!chapterName) continue;
    if (chapterFilter && chapterName !== chapterFilter) continue;
    const bucket = buckets.get(chapterName) ?? {
      submissions: 0,
      itemIds: new Set<string>(),
      correct: 0,
      passSum: 0,
      passCount: 0,
      last: null,
    };
    bucket.submissions += 1;
    if (event.item_id) bucket.itemIds.add(event.item_id);
    if (event.result === 'correct') bucket.correct += 1;
    const ratio = (event.raw as { pass_ratio?: unknown } | undefined)?.pass_ratio;
    if (typeof ratio === 'number' && Number.isFinite(ratio)) {
      bucket.passSum += ratio;
      bucket.passCount += 1;
    }
    if (bucket.last === null || event.created_at > bucket.last) bucket.last = event.created_at;
    buckets.set(chapterName, bucket);
  }

  const toView = (chapterName: string, bucket: Bucket): ChapterProgress => ({
    chapter: chapterName,
    submissions: bucket.submissions,
    practiced_items: bucket.itemIds.size,
    correct: bucket.correct,
    avg_pass_ratio: bucket.passCount > 0 ? bucket.passSum / bucket.passCount : null,
    last_practiced_at: bucket.last,
  });

  const chapters = [...buckets.entries()]
    .map(([chapterName, bucket]) => toView(chapterName, bucket))
    .sort((a, b) => b.submissions - a.submissions || a.chapter.localeCompare(b.chapter));

  const overallBucket: Bucket = {
    submissions: 0,
    itemIds: new Set<string>(),
    correct: 0,
    passSum: 0,
    passCount: 0,
    last: null,
  };
  for (const bucket of buckets.values()) {
    overallBucket.submissions += bucket.submissions;
    overallBucket.correct += bucket.correct;
    overallBucket.passSum += bucket.passSum;
    overallBucket.passCount += bucket.passCount;
    for (const itemId of bucket.itemIds) overallBucket.itemIds.add(itemId);
    if (overallBucket.last === null || (bucket.last !== null && bucket.last > overallBucket.last)) {
      overallBucket.last = bucket.last;
    }
  }

  const data: PracticeProgressData = {
    space_id: space.space_id,
    chapters,
    overall: toView('全部章节', overallBucket),
  };
  return ok(data);
}
