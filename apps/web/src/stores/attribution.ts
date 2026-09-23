/**
 * 归因切片（页 7）：classify 结果（向导态）→ analyze 结果（结果态）→ 验证/处方中间态。
 *
 * 为什么 classify 结果要落 store：向导第二步（枚举卡片 + 置信度 + evidence）→ 第三步
 * （analyze）之间要跨屏保持，且「低置信就地追问」需要保留原输入（stem/answer/kp）重发。
 */

import { create } from 'zustand';

import type {
  AttributionView,
  ClassifyAdoptedData,
  ClassifyClarifyData,
  ClientItem,
  PlanData,
} from '../api/types';

export interface VerifyState {
  /** 当前待作答的验证题（null = 无验证题，已终局或候选耗尽）。 */
  item: ClientItem | null;
  /** 最近一次 verify 的判定（服务端下发；仅用于显示「验证通过」徽标，不做对错评价）。 */
  lastCorrect: boolean | null;
  verified: boolean;
  /** 候选耗尽（服务端 next_candidate=null）→ 诚实兜底文案。 */
  exhausted: boolean;
}

export interface AttributionDraft {
  kpId: string;
  stem: string;
  studentAnswer: string;
  itemId: string | null;
}

interface AttributionData {
  draft: AttributionDraft | null;
  classifyAdopted: ClassifyAdoptedData | null;
  classifyClarify: ClassifyClarifyData | null;
  attribution: AttributionView | null;
  verification: VerifyState;
  plan: PlanData | null;
}

const INITIAL: AttributionData = {
  draft: null,
  classifyAdopted: null,
  classifyClarify: null,
  attribution: null,
  verification: { item: null, lastCorrect: null, verified: false, exhausted: false },
  plan: null,
};

export interface AttributionState extends AttributionData {
  setDraft: (draft: AttributionDraft) => void;
  setClassifyAdopted: (data: ClassifyAdoptedData) => void;
  setClassifyClarify: (data: ClassifyClarifyData) => void;
  clearClassify: () => void;
  setAttribution: (view: AttributionView) => void;
  setVerification: (state: Partial<VerifyState>) => void;
  setPlan: (plan: PlanData | null) => void;
  reset: () => void;
}

export const useAttributionStore = create<AttributionState>((set, get) => ({
  ...INITIAL,

  setDraft: (draft: AttributionDraft) => set({ draft }),

  setClassifyAdopted: (data: ClassifyAdoptedData) =>
    set({ classifyAdopted: data, classifyClarify: null }),

  setClassifyClarify: (data: ClassifyClarifyData) =>
    set({ classifyClarify: data, classifyAdopted: null }),

  clearClassify: () => set({ classifyAdopted: null, classifyClarify: null }),

  setAttribution: (view: AttributionView) =>
    set({
      attribution: view,
      verification: {
        item: view.verification_item,
        lastCorrect: get().verification.lastCorrect,
        verified: view.verified,
        exhausted: !view.verified && view.verification_item === null,
      },
    }),

  setVerification: (state: Partial<VerifyState>) =>
    set({ verification: { ...get().verification, ...state } }),

  setPlan: (plan: PlanData | null) => set({ plan }),

  reset: () => set({ ...INITIAL }),
}));
