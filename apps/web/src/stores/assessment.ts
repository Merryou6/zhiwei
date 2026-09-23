/**
 * 测评切片（页 4）：会话态 = mode / 已出题（doneIds）/ remaining / converged / 当前题。
 *
 * doneIds 同时承担两件事（P0 #3「不出已做题」双保险）：
 *   ① 提交与「跳过」都把 item_id 记入 → 作为下次 next 的 exclude_item_ids；
 *   ② 服务端还会用 evidence_events 自动排除，前端这份只覆盖「跳过但未提交」的题。
 * 会话态不落 localStorage（刷新即重取，D2）。
 */

import { create } from 'zustand';

import type { ClientItem, DiagnoseMode } from '../api/types';

export interface AssessmentState {
  mode: DiagnoseMode;
  /** 本轮已出过的题（含跳过未提交的）。 */
  doneIds: string[];
  remaining: number;
  converged: boolean;
  currentItem: ClientItem | null;
  /** 本轮已提交题数（进度条已答 / 已答+剩余）。 */
  submittedCount: number;
  start: (mode: DiagnoseMode) => void;
  setCurrent: (item: ClientItem | null, remaining: number) => void;
  markSkipped: (itemId: string) => void;
  markSubmitted: (itemId: string, nextItem: ClientItem | null, remaining: number, converged: boolean) => void;
  reset: () => void;
}

const INITIAL = {
  mode: 'diagnose' as DiagnoseMode,
  doneIds: [] as string[],
  remaining: 0,
  converged: false,
  currentItem: null as ClientItem | null,
  submittedCount: 0,
};

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  ...INITIAL,

  start: (mode: DiagnoseMode) => set({ ...INITIAL, mode }),

  setCurrent: (item: ClientItem | null, remaining: number) =>
    set({ currentItem: item, remaining, converged: item === null }),

  markSkipped: (itemId: string) => {
    const { doneIds } = get();
    set({ doneIds: doneIds.includes(itemId) ? doneIds : [...doneIds, itemId] });
  },

  markSubmitted: (itemId: string, nextItem: ClientItem | null, remaining: number, converged: boolean) => {
    const { doneIds, submittedCount } = get();
    set({
      doneIds: doneIds.includes(itemId) ? doneIds : [...doneIds, itemId],
      currentItem: nextItem,
      remaining,
      converged: converged || nextItem === null,
      submittedCount: submittedCount + 1,
    });
  },

  reset: () => set({ ...INITIAL }),
}));
