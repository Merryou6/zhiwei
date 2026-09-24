/**
 * 右侧常驻对话面板的开合切片（v1.3，D1a）。
 *
 * 为什么放 store 而不是组件态：Layout 随路由切换会重挂载，组件态会丢；
 * store 是会话级的（不落盘：刷新后回到默认关闭，避免「上次开着就永远开着」）。
 * 对话上下文本就在全局 useDialogStore，故关掉面板再打开上下文不丢。
 */

import { create } from 'zustand';

export interface ChatPanelState {
  /** 面板是否展开（默认关闭）。 */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useChatPanelStore = create<ChatPanelState>((set, get) => ({
  open: false,
  setOpen: (open: boolean) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
