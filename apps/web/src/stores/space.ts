/**
 * 空间切片（D2）：空间列表 + 活跃空间；活跃空间落 localStorage（'zhiwei_active_space'）。
 *
 * 选择规则：显式 setActive 优先；否则取列表中的默认空间（is_default=true），
 * 再无则取第一个。刷新后凭 localStorage 恢复，恢复时若 id 已不在列表则回落到默认空间。
 */

import { create } from 'zustand';

import { STORAGE_KEYS } from '../router';
import type { SpaceView } from '../api/types';

export interface SpaceState {
  spaces: SpaceView[];
  activeSpaceId: string | null;
  setSpaces: (spaces: SpaceView[]) => void;
  setActive: (spaceId: string) => void;
  clear: () => void;
}

function readActive(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.activeSpace);
  } catch {
    return null;
  }
}

function writeActive(spaceId: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (spaceId === null) localStorage.removeItem(STORAGE_KEYS.activeSpace);
    else localStorage.setItem(STORAGE_KEYS.activeSpace, spaceId);
  } catch {
    /* 忽略：内存态仍可用 */
  }
}

/** 默认空间：is_default 优先，其次列表首个。 */
export function pickDefaultSpace(spaces: readonly SpaceView[]): SpaceView | null {
  return spaces.find((space) => space.is_default) ?? spaces[0] ?? null;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  activeSpaceId: readActive(),

  setSpaces: (spaces: SpaceView[]) => {
    const stored = get().activeSpaceId ?? readActive();
    const kept = spaces.some((space) => space.space_id === stored) ? stored : null;
    const active = kept ?? pickDefaultSpace(spaces)?.space_id ?? null;
    writeActive(active);
    set({ spaces, activeSpaceId: active });
  },

  setActive: (spaceId: string) => {
    writeActive(spaceId);
    set({ activeSpaceId: spaceId });
  },

  clear: () => {
    writeActive(null);
    set({ spaces: [], activeSpaceId: null });
  },
}));

/** 当前活跃空间对象（列表未加载时返回 null）。 */
export function activeSpaceOf(state: SpaceState): SpaceView | null {
  if (!state.activeSpaceId) return null;
  return state.spaces.find((space) => space.space_id === state.activeSpaceId) ?? null;
}
