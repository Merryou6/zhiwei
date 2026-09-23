/**
 * 学习空间服务（契约 §2，接口 #3 list / #4 create / #5 drive）
 *
 * create 的 name 由服务端取知识库名，**不接受客户端传入**（契约 §2 防多空间同学科）；
 * 同学科空间已存在 → 409 且 data = { existing_space_id }（前端据此弹「切换过去」）。
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
 * 预置文件清单（课标 + 教材 + 初高中数学知识点资料）。
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
  // ===== 初中数学知识点资料 =====
  {
    file_id: 'file_preset_003',
    name: '初中数学知识归纳总结（打印版）.pdf',
    type: 'pdf',
    size: 2097152,
  },
  {
    file_id: 'file_preset_004',
    name: '初中数学定理公式大全.pdf',
    type: 'pdf',
    size: 1572864,
  },
  {
    file_id: 'file_preset_005',
    name: '初中数学知识点总结（代数+几何）.pdf',
    type: 'pdf',
    size: 2621440,
  },
  {
    file_id: 'file_preset_006',
    name: '中考数学核心知识点清单.pdf',
    type: 'pdf',
    size: 1835008,
  },
  {
    file_id: 'file_preset_007',
    name: '初中数学必考公式定律与知识梳理.pdf',
    type: 'pdf',
    size: 1310720,
  },
  // ===== 高中数学知识点资料 =====
  {
    file_id: 'file_preset_008',
    name: '高考数学思维导图及公式汇总.pdf',
    type: 'pdf',
    size: 3145728,
  },
  {
    file_id: 'file_preset_009',
    name: '高中数学100个常考知识点汇总.pdf',
    type: 'pdf',
    size: 2359296,
  },
  {
    file_id: 'file_preset_010',
    name: '高中数学公式定理大全.pdf',
    type: 'pdf',
    size: 1835008,
  },
  {
    file_id: 'file_preset_011',
    name: '高考数学核心基础知识清单（含二级结论与易错点）.pdf',
    type: 'pdf',
    size: 2883584,
  },
  {
    file_id: 'file_preset_012',
    name: '高中数学高分必背公式手册.pdf',
    type: 'pdf',
    size: 1572864,
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

/** POST /api/space/create
 *  合法 knowledge_source = index 里的全部 kb（kb_math_cz / kb_math_gz / …），
 *  每个学科每用户限建一个空间。 */
export async function create(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const knowledgeSource = req.body.knowledge_source;

  const legalKbIds = ctx.data.kbIds();
  if (typeof knowledgeSource !== 'string' || !legalKbIds.includes(knowledgeSource)) {
    throw httpError.badRequest(
      `knowledge_source 非法，可选值：${legalKbIds.join('、')}`,
    );
  }

  const existing = await ctx.store.findSpaceByUserAndKnowledgeSource(user.user_id, knowledgeSource);
  if (existing) {
    throw httpError.conflict('同学科空间已存在', { existing_space_id: existing.space_id });
  }

  const space: SpaceRecord = {
    space_id: newId('sp_'),
    user_id: user.user_id,
    name: ctx.data.kbName(knowledgeSource) ?? '学习空间',
    subject: ctx.data.subjectOfKb(knowledgeSource) ?? '数学',
    knowledge_source: [knowledgeSource],
    is_default: false,
    created_at: ctxNowIso(ctx),
  };
  await ctx.store.insertSpace(space);

  return ok({ space_id: space.space_id, name: space.name });
}

/** GET /api/space/{space_id}/drive */
export async function drive(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  await requireSpaceOwnership(ctx, user.user_id, req.params.spaceId);

  return ok({ files: [...PRESET_FILES] });
}
