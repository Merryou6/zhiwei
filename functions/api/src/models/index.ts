/**
 * 模型适配层工厂（D4）—— 真实模型接入点（已落地 remoteChat）
 *
 * 换真实模型只改本文件：
 *   1. models/remoteChat.ts 已实现 chatTurn 的远程大模型调用
 *      （任意 OpenAI 兼容接口，配置读环境变量 ZHIWEI_LLM_BASE_URL / ZHIWEI_LLM_API_KEY /
 *      ZHIWEI_LLM_MODEL；未配置或调用失败自动回落 localChat）。
 *   2. createModels() 按 process.env.ZHIWEI_MODEL_MODE 选择实现：
 *      - 'remote'：对话走远程大模型（诊断/识别仍为本地确定性实现）
 *      - 'local'（默认）：全部本地，测试与离线演示不受影响
 *   3. 服务层后处理纪律（CONF_ADOPT / direction 映射 / 枚举校验 / 状态机）零改动。
 */

import { chatTurn as localChatTurn } from './localChat';
import { chatTurn as remoteChatTurn } from './remoteChat';
import { classify } from './localClassify';
import { recognizePaper } from './localRecognize';
import type { ChatTurnInput, ChatTurnOutput, ModelAdapter } from './types';

function resolveChatTurn(): (input: ChatTurnInput) => Promise<ChatTurnOutput> {
  return process.env.ZHIWEI_MODEL_MODE === 'remote' ? remoteChatTurn : localChatTurn;
}

export function createModels(): ModelAdapter {
  return {
    recognizePaper,
    classify,
    chatTurn: resolveChatTurn(),
  };
}

export * from './types';
