/**
 * 认证切片（D2）：token / user_id，手动读写 localStorage（不用 persist 中间件——
 * 便于测试注入与 401 清理；契约 §1 明确不做登出接口，前端删 localStorage 即可）。
 *
 * 落盘键与 router.STORAGE_KEYS 同源：路由守卫直接读 localStorage，登录/登出/401 清理
 * 都先同步写盘再导航，故守卫始终与 store 一致。
 */

import { create } from 'zustand';

import { STORAGE_KEYS } from '../router';
import type { AuthData } from '../api/types';

export interface AuthState {
  token: string | null;
  userId: string | null;
  /** 登录 / 注册成功后落盘（契约 #1 / #2 的 data）。 */
  setSession: (data: AuthData) => void;
  /** 401 或主动登出：内存与 localStorage 一起清（P0 #1「刷新不掉线」的反向操作）。 */
  clear: () => void;
}

function read(slot: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(slot);
  } catch {
    return null;
  }
}

function write(slot: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(slot, value);
  } catch {
    /* 隐私模式等场景忽略：内存态仍然可用 */
  }
}

function remove(slot: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(slot);
  } catch {
    /* 同上 */
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: read(STORAGE_KEYS.token),
  userId: read(STORAGE_KEYS.userId),

  setSession: (data: AuthData) => {
    write(STORAGE_KEYS.token, data.token);
    write(STORAGE_KEYS.userId, data.user_id);
    set({ token: data.token, userId: data.user_id });
  },

  clear: () => {
    remove(STORAGE_KEYS.token);
    remove(STORAGE_KEYS.userId);
    set({ token: null, userId: null });
  },
}));
