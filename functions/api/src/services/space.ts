/**
 * 学习空间服务（契约 §2，接口 #3 list / #4 create / #5 drive）
 *
 * v1.2（2026-09-24，契约 §2 变更记录）：唯一约束由「每学科每用户一个空间」改为
 * **同用户内空间名唯一**——学科可以多开（同一 kb 允许建多个空间，如「初中数学」+
 * 「我的错题本」），仅同名才冲突。
 *   · name 由「不接受客户端传入」改为**可选传入**：缺省仍由服务端取知识库名
 *     （ctx.data.kbName，向后兼容 v1.1 行为）；显式传入时校验「字符串 / trim 后非空 /
 *     trim 后 ≤30 字」，非法一律 400（不猜测、不补默认值，与「试卷 unclear 拒绝默认值」
 *     同一纪律）。
 *   · 同名空间已存在 → 409 且 data = { existing_space_id }（前端据此弹「切换过去」），
 *     existing_space_id 字段语义与 v1.1 完全一致。
 */

import { ctxNowIso, ok, requireSpaceOwnership } from '../context';
import type { AppContext } from '../context';
import { httpError } from '../errors';
import type { ApiResponse } from '../errors';
import { newId } from '../ids';
import type { RouteRequest } from '../router';
import type { SpaceRecord } from '../db/types';
import { authedUser } from './auth';

export interface SpaceView {
  space_id: string;
  name: string;
  subject: string;
  knowledge_source: string[];
  is_default: boolean;
  created_at: string;
}

export interface DriveFileView {
  file_id: string;
  name: string;
  type: string;
  size: number;
}

/**
 * 预置文件清单（课标 + 教材）。
 * 【留桩】真实云盘列目录：后续迭代接入 COS/云存储 SDK 遍历 `{env}/preset/`
 * （DATA_SCHEMA §5 路径约定），本地形态返回固定清单 + 用户文件（本地恒为空）。
 */
export const PRESET_FILES: readonly DriveFileView[] = [
  {
    file_id: 'file_preset_001',
    name: '义务教育数学课程标准（2022年版）.pdf',
    type: 'pdf',
    size: 1048576,
  },
  {
    file_id: 'file_preset_002',
    name: '人教版初中数学九年级上册（教材）.pdf',
    type: 'pdf',
    size: 5242880,
  },
];

export function toSpaceView(space: SpaceRecord): SpaceView {
  return {
    space_id: space.space_id,
    name: space.name,
    subject: space.subject,
    knowledge_source: space.knowledge_source,
    is_default: space.is_default,
    created_at: space.created_at,
  };
}

/** GET /api/space/list */
export async function list(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const spaces = await ctx.store.listSpacesByUser(user.user_id);
  return ok({ spaces: spaces.map(toSpaceView) });
}

/** 空间名上限（契约 §2 v1.2：1–30 字，trim 后计长）。 */
export const MAX_SPACE_NAME_LENGTH = 30;

/** POST /api/space/create
 *  合法 knowledge_source = index 里的全部 kb（kb_math_cz / kb_math_gz / …）；
 *  v1.2 起同一用户可建同学科多个空间，仅「空间名重复」为 409。
 *  name 可选（1–30 字，trim 后计长），缺省取知识库名。 */
export async function create(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const knowledgeSource = req.body.knowledge_source;

  const legalKbIds = ctx.data.kbIds();
  if (typeof knowledgeSource !== 'string' || !legalKbIds.includes(knowledgeSource)) {
    throw httpError.badRequest(
      `knowledge_source 非法，可选值：${legalKbIds.join('、')}`,
    );
  }

  // name 校验（v1.2）：undefined / null = 缺省；其余一律按显式传入严格校验。
  // 空串不视为缺省——宁拒收不猜测（契约 §5「unclear 拒绝默认值」同一纪律）。
  const rawName = req.body.name;
  let clientName: string | null = null;
  if (rawName !== undefined && rawName !== null) {
    if (typeof rawName !== 'string') {
      throw httpError.badRequest('name 必须是字符串');
    }
    const trimmed = rawName.trim();
    if (trimmed.length === 0) {
      throw httpError.badRequest('name 不能为空白');
    }
    if (trimmed.length > MAX_SPACE_NAME_LENGTH) {
      throw httpError.badRequest(`name 至多 ${MAX_SPACE_NAME_LENGTH} 字`);
    }
    clientName = trimmed;
  }

  const finalName = clientName ?? ctx.data.kbName(knowledgeSource) ?? '学习空间';

  // 查重口径 = 「同用户同名」（v1.2）。用现有 listSpacesByUser 内存过滤，不新增 Store 方法。
  const mine = await ctx.store.listSpacesByUser(user.user_id);
  const dup = mine.find((space) => space.name === finalName);
  if (dup) {
    throw httpError.conflict('同名空间已存在', { existing_space_id: dup.space_id });
  }

  const space: SpaceRecord = {
    space_id: newId('sp_'),
    user_id: user.user_id,
    name: finalName,
    subject: ctx.data.subjectOfKb(knowledgeSource) ?? '数学',
    knowledge_source: [knowledgeSource],
    is_default: false,
    created_at: ctxNowIso(ctx),
  };
  await ctx.store.insertSpace(space);

  return ok({ space_id: space.space_id, name: space.name });
}

// 注（D7）：旧查重方法 store.findSpaceByUserAndKnowledgeSource 在 v1.2 后不再有调用方
// （查重口径改为「同用户同名」，见上）。Store 接口 + jsonStore + cloudbaseStore 三处定义
// 保留备查：删它要动三处、收益为零，且 dist 由构建再生，不做无谓跨层改动。


/** GET /api/space/{space_id}/drive */
export async function drive(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  await requireSpaceOwnership(ctx, user.user_id, req.params.spaceId);

  return ok({ files: [...PRESET_FILES] });
}
