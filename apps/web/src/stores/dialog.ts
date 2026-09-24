/**
 * 对话切片（页 6）：dialog_id 续聊 + 消息流（SSE 增量追加）+ meta。
 *
 * 消息模型区分三种气泡：
 *   - student：学生发言（右侧；带图时记 image_file_id）
 *   - agent：学长回复（左侧；流式期间 pending=true，delta 逐段追加）
 *   - notice：系统级非阻断提示（退出提示条 / 降级提示），样式独立
 * meta 只存服务端下发的最新值（页面据此显示徽标与注脚，不自行判断语义）。
 *
 * 过程链路（v1.3，D10）：thought / toolSteps / phase 只保留**最新一轮**——startAssistant
 * 时清空（新一轮开始时上一轮的链路就该退场），finishAssistant / failAssistant 都不清
 * （过程跑完后仍要在面板里看得见）。链路不落库、不进 messages，历史轮次不复放。
 */

import { create } from 'zustand';

import type { ChatMeta, ChatSsePhaseData, ChatToolStep } from '../api/types';

export type ChatRole = 'student' | 'agent' | 'notice';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  imageFileId?: string | null;
  /** 学长气泡的注脚（如 kp 匹配低置信的澄清提示）。 */
  note?: string | null;
  /** 方向提示徽标（next_action=hint_down）。 */
  badge?: 'hint' | 'exit' | null;
  /** 流式输出中（尚未收到 meta/done）。 */
  pending?: boolean;
}

export interface DialogState {
  dialogId: string | null;
  messages: ChatMessage[];
  meta: ChatMeta | null;
  streaming: boolean;
  /** 当轮思考文本（增量拼接；本地=推理摘要，远程=模型自述）。 */
  thought: string;
  /** 当轮工具步骤（同 id 覆盖：running → 终态）。 */
  toolSteps: ChatToolStep[];
  /** 当轮阶段（最后一次 phase 事件）。 */
  phase: ChatSsePhaseData | null;
  appendStudent: (text: string, imageFileId?: string | null) => string;
  startAssistant: () => string;
  appendDelta: (id: string, text: string) => void;
  setMeta: (meta: ChatMeta) => void;
  finishAssistant: (id: string, badge?: 'hint' | 'exit' | null, note?: string | null) => void;
  failAssistant: (id: string, msg: string) => void;
  pushNotice: (text: string) => string;
  /** 思考增量（拼接）。 */
  appendThought: (text: string) => void;
  /** 工具步骤：同 id 覆盖（running → ok/error 不重复插卡，缺省字段沿用上一条）。 */
  upsertTool: (step: ChatToolStep) => void;
  setPhase: (phase: ChatSsePhaseData) => void;
  /** 清空当轮链路（startAssistant 自动调用；一般不单独调）。 */
  resetTrace: () => void;
  reset: () => void;
}

let seq = 0;
const nextId = (prefix: string): string => {
  seq += 1;
  return `${prefix}_${seq}`;
};

export const useDialogStore = create<DialogState>((set, get) => ({
  dialogId: null,
  messages: [],
  meta: null,
  streaming: false,
  thought: '',
  toolSteps: [],
  phase: null,

  appendStudent: (text: string, imageFileId: string | null = null) => {
    const id = nextId('msg');
    set({ messages: [...get().messages, { id, role: 'student', text, imageFileId }] });
    return id;
  },

  startAssistant: () => {
    const id = nextId('msg');
    set({
      messages: [...get().messages, { id, role: 'agent', text: '', pending: true }],
      streaming: true,
      // 新一轮开始 → 上一轮链路退场（D10：只保留最新一轮）
      thought: '',
      toolSteps: [],
      phase: null,
    });
    return id;
  },

  appendDelta: (id: string, text: string) => {
    set({
      messages: get().messages.map((message) =>
        message.id === id ? { ...message, text: message.text + text } : message,
      ),
    });
  },

  setMeta: (meta: ChatMeta) => set({ meta, dialogId: meta.dialog_id }),

  finishAssistant: (id: string, badge = null, note = null) => {
    set({
      streaming: false,
      messages: get().messages.map((message) =>
        message.id === id ? { ...message, pending: false, badge, note } : message,
      ),
    });
  },

  failAssistant: (id: string, msg: string) => {
    set({
      streaming: false,
      messages: get().messages.map((message) =>
        message.id === id
          ? { ...message, pending: false, text: message.text.length > 0 ? message.text : msg, badge: 'exit' }
          : message,
      ),
    });
  },

  pushNotice: (text: string) => {
    const id = nextId('notice');
    set({ messages: [...get().messages, { id, role: 'notice', text }] });
    return id;
  },

  appendThought: (text: string) => set({ thought: get().thought + text }),

  upsertTool: (step: ChatToolStep) => {
    const steps = get().toolSteps;
    const index = steps.findIndex((entry) => entry.id === step.id);
    if (index < 0) {
      set({ toolSteps: [...steps, step] });
      return;
    }
    const merged: ChatToolStep = { ...steps[index], ...step };
    set({ toolSteps: steps.map((entry, i) => (i === index ? merged : entry)) });
  },

  setPhase: (phase: ChatSsePhaseData) => set({ phase }),

  resetTrace: () => set({ thought: '', toolSteps: [], phase: null }),

  reset: () =>
    set({ dialogId: null, messages: [], meta: null, streaming: false, thought: '', toolSteps: [], phase: null }),
}));
