/**
 * 汉堡抽屉的开合切片（2026-09-24 移动端适配轮 D3/D4）。
 *
 * 为什么是 store 而不是组件态：Layout 随路由切换会重挂载，组件态会丢
 * （与 stores/chatPanel.ts 文件头论证的是同一个问题）；而且互斥逻辑需要
 * 跨 store 读写，组件态做不到。
 *
 * 会话级、不落盘：刷新后回到默认关闭——「上次开着就永远开着」在手机上会让
 * 每次进来都先挡住页面。
 *
 * 互斥（D4，单向调度，避免两个 store 互相 import 造成循环依赖）：
 *   `open/toggle` 一旦要**打开**抽屉，就先无条件把右侧对话面板关掉
 *   （面板开着时点汉堡键 → 面板关）。反方向不走本 store ——
 *   `ChatPanel` 与面板的开合完全是既有逻辑，本文件不 import 也不改写它，
 *   故循环依赖不存在。桌面（≥720）抽屉永不渲染（nav:hidden），无双向需求。
 */

import { create } from 'zustand';

import { useChatPanelStore } from './chatPanel';

export interface MobileNavState {
  /** 抽屉是否展开（默认关闭）。 */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/** 打开抽屉前先收掉右侧对话面板（二者同为 z-overlay，互斥后不会同屏竞争）。 */
function closePanel(): void {
  useChatPanelStore.getState().setOpen(false);
}

export const useMobileNavStore = create<MobileNavState>((set, get) => ({
  open: false,

  setOpen: (open: boolean) => {
    if (open) closePanel();
    set({ open });
  },

  toggle: () => {
    const next = !get().open;
    if (next) closePanel();
    set({ open: next });
  },
}));
