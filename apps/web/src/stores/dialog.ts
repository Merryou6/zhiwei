/**
 * 对话切片（页 6）：dialog_id 续聊 + 消息流（SSE 增量追加）+ meta。
 *
 * 消息模型区分三种气泡：
 *   - student：学生发言（右侧；带图时记 image_file_id）
 *   - agent：学长回复（左侧；流式期间 pending=true，delta 逐段追加）
 *   - notice：系统级非阻断提示（退出提示条 / 降级提示），样式独立
 * meta 只存服务端下发的最新值（页面据此显示徽标与注脚，不自行判断语义）。
 */

import { create } from 'zustand';

import type { ChatMeta } from '../api/types';

export type ChatRole = 'student' | 'agent' | 'notice';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  imageFileId?: string | null;
  /** 本地上传图片的访问 URL（传图读题）。 */
  imageUrl?: string | null;
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
  appendStudent: (text: string, imageFileId?: string | null, imageUrl?: string | null) => string;
  startAssistant: () => string;
  appendDelta: (id: string, text: string) => void;
  setMeta: (meta: ChatMeta) => void;
  finishAssistant: (id: string, badge?: 'hint' | 'exit' | null, note?: string | null) => void;
  failAssistant: (id: string, msg: string) => void;
  pushNotice: (text: string) => string;
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

  appendStudent: (text: string, imageFileId: string | null = null, imageUrl: string | null = null) => {
    const id = nextId('msg');
    set({ messages: [...get().messages, { id, role: 'student', text, imageFileId, imageUrl }] });
    return id;
  },

  startAssistant: () => {
    const id = nextId('msg');
    set({
      messages: [...get().messages, { id, role: 'agent', text: '', pending: true }],
      streaming: true,
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

  reset: () => set({ dialogId: null, messages: [], meta: null, streaming: false }),
}));
