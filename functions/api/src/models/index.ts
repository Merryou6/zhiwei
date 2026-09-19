/**
 * 模型适配层工厂（D4）—— **真实模型接入点**
 *
 * 换真实模型只改本文件：
 *   1. 新建 models/remoteClassify.ts / remoteRecognize.ts / remoteChat.ts 实现同一
 *      ModelAdapter 接口（内部调用自建网关或云厂商 API，API Key 读环境变量）。
 *   2. 在 createModels() 中按 process.env.ZHIWEI_MODEL_MODE（'local' | 'remote'）选择实现。
 *   3. 服务层后处理纪律（CONF_ADOPT / direction 映射 / 枚举校验 / 状态机）零改动。
 *
 * 本迭代只装配本地确定性适配器（计划 一、1.2 排除项 3：真实模型调用不在范围内）。
 */

import { chatTurn } from './localChat';
import { classify } from './localClassify';
import { recognizePaper } from './localRecognize';
import type { ModelAdapter } from './types';

export function createModels(): ModelAdapter {
  return {
    recognizePaper,
    classify,
    chatTurn,
  };
}

export * from './types';
