/**
 * UI 切片：非阻断提示队列（toast）。
 *
 * PRD §6「采集永不弹窗」：错误与状态提示一律走 toast（不遮挡、不阻断操作），
 * 唯一 modal 是 ConfirmDialog（用户主动确认 409 空间切换）。
 */

import { create } from 'zustand';

import type { ToastItem, ToastTone } from '../components/Toast';

/** 自动消隐时长（ms）；组件仍可手动关闭。 */
export const TOAST_TTL_MS = 6000;

export interface UiState {
  toasts: ToastItem[];
  toast: (msg: string, tone?: ToastTone) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let seq = 0;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],

  toast: (msg: string, tone: ToastTone = 'info') => {
    seq += 1;
    const id = `toast_${seq}`;
    set({ toasts: [...get().toasts, { id, msg, tone }] });
    if (typeof setTimeout === 'function') {
      setTimeout(() => {
        get().dismiss(id);
      }, TOAST_TTL_MS);
    }
    return id;
  },

  dismiss: (id: string) => {
    set({ toasts: get().toasts.filter((item) => item.id !== id) });
  },

  clear: () => set({ toasts: [] }),
}));
