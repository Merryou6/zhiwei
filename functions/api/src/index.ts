// 知微云函数入口骨架（迭代1）
//
// 范围声明（见计划 一、1.2 排除项）：本迭代不实现任何接口逻辑，
// 本文件仅作为后端目录骨架的占位入口，保持可编译的零逻辑状态。
//
// TODO（迭代2 起）：按 API_CONTRACT.md 实现以下 19 个接口
//   auth：    register / login / logout
//   spaces：  创建空间 / 列出空间 / 更新空间
//   evidence：self-report / silent / diagnose 提交 / paper 提交 / paper 识别回显
//   mastery： 读取掌握度画像 / 掌握度明细
//   agent：   chat 对话 / 处方读取
//   attribution：溯因提交 / 溯因确认
//   report：  报告页聚合数据
// 注：接口数量与命名以 API_CONTRACT.md 为准，本注释仅为导航，不作为实现依据。

export interface CloudFunctionEvent {
  /** 请求路径（迭代2 由路由层填充） */
  path?: string;
  /** 请求体（迭代2 由路由层填充） */
  body?: unknown;
}

export interface CloudFunctionContext {
  /** 云环境标识（迭代2 由平台注入） */
  env?: string;
}

/**
 * 空入口：迭代1 不做任何业务处理，统一返回未实现标记。
 * 不得在此处加入任何数据读写、认证、SSE 或大模型调用逻辑。
 */
export async function main(_event: CloudFunctionEvent, _ctx: CloudFunctionContext) {
  return { code: 'NOT_IMPLEMENTED', message: '迭代1：接口按计划推迟至迭代2 实现' };
}
