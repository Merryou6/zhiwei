/**
 * 用户资料服务（契约 §1，接口 #20 GET /api/user/profile · v1.2 新增，**只读**）
 *
 * 用途：「我的」页一屏所需的三类只读信息（账号 / 空间概览 / 对话模型运行信息）。
 *
 * 红线（逐条对应计划 D4c / R3）：
 *   · user 视图是**显式字面构造**，不整记录透传 —— password_hash 绝不进入响应对象；
 *   · 模型信息只回 { mode, name }：ZHIWEI_LLM_API_KEY 绝不下发；
 *   · 无 space_id 入参 → 越权面在设计上不存在；401 由 authedUser（requireAuth）统一覆盖；
 *   · 本接口与 answer / solution_steps 序列化白名单无交集。
 *
 * 字段命名沿用契约 §1（小写蛇形）+ §0 统一响应体；spaces 序列化复用 services/space 的
 * toSpaceView，与 #3 list 完全同形（前端一套类型两处可用）。
 */

import { ok } from '../context';
import type { AppContext } from '../context';
import type { ApiResponse } from '../errors';
import type { RouteRequest } from '../router';
import type { UserRecord } from '../db/types';
import { authedUser } from './auth';
import { toSpaceView } from './space';
import type { SpaceView } from './space';

/** 账号视图（显式三字段 + 时间；password_hash 不在其中）。 */
export interface ProfileUserView {
  user_id: string;
  identifier: string;
  nickname: string | null;
  created_at: string;
}

/** 对话模型运行信息（只读展示，前端不提供自定义入口）。 */
export interface ProfileModelView {
  mode: 'local' | 'remote';
  /** 仅 mode=remote 时有值（ZHIWEI_LLM_MODEL），否则 null。 */
  name: string | null;
}

export interface ProfileData {
  user: ProfileUserView;
  spaces: SpaceView[];
  model: ProfileModelView;
}

/** user 记录 → 响应视图：逐字段挑，绝不 spread / 透传整条记录。 */
function toUserView(user: UserRecord): ProfileUserView {
  return {
    user_id: user.user_id,
    identifier: user.identifier,
    nickname: user.nickname,
    created_at: user.created_at,
  };
}

/**
 * 模型运行信息：与 models/index.ts 的判定**同源**（=== 'remote' 才 remote，否则 local 默认）。
 * name 只取模型名，API Key 永不出现在响应里。
 */
function toModelView(): ProfileModelView {
  if (process.env.ZHIWEI_MODEL_MODE !== 'remote') return { mode: 'local', name: null };
  return { mode: 'remote', name: process.env.ZHIWEI_LLM_MODEL?.trim() || null };
}

/** GET /api/user/profile */
export async function profile(req: RouteRequest, ctx: AppContext): Promise<ApiResponse> {
  const user = await authedUser(req, ctx);
  const spaces = await ctx.store.listSpacesByUser(user.user_id);

  return ok({
    user: toUserView(user),
    spaces: spaces.map(toSpaceView),
    model: toModelView(),
  });
}
