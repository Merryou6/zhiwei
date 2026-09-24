// @vitest-environment jsdom
/**
 * 汉堡抽屉开合切片测试（stores/mobileNav.ts，移动端适配轮 D3/D4）
 *
 * 覆盖 4 条：默认关闭（会话级、不落盘）；setOpen/toggle 状态机；
 *   与右侧对话面板的互斥（两个方向各一条）；与 localStorage 无关。
 *
 * 抽屉的渲染与交互（Esc / 背景幕 / 焦点陷阱 / 焦点归还 / aria-modal）不在这里测——
 * 现有 14 个前端测试文件全是逻辑/静态单测、无 jsdom 组件渲染先例（不引渲染测试栈），
 * 那部分由 tools/responsive-audit.cjs --probe-nav 在真浏览器里取证（计划 7.3 / 8.3.3）。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useChatPanelStore } from '../src/stores/chatPanel';
import { useMobileNavStore } from '../src/stores/mobileNav';

beforeEach(() => {
  useMobileNavStore.getState().setOpen(false);
  useChatPanelStore.getState().setOpen(false);
});

describe('mobileNav store', () => {
  it('默认关闭；setOpen 显式设值、toggle 往返（会话级状态机）', () => {
    expect(useMobileNavStore.getState().open).toBe(false);

    useMobileNavStore.getState().setOpen(true);
    expect(useMobileNavStore.getState().open).toBe(true);
    useMobileNavStore.getState().setOpen(true);
    expect(useMobileNavStore.getState().open).toBe(true);

    useMobileNavStore.getState().setOpen(false);
    expect(useMobileNavStore.getState().open).toBe(false);

    useMobileNavStore.getState().toggle();
    expect(useMobileNavStore.getState().open).toBe(true);
    useMobileNavStore.getState().toggle();
    expect(useMobileNavStore.getState().open).toBe(false);
  });

  it('互斥（正向 D4）：打开抽屉会先收掉右侧对话面板', () => {
    useChatPanelStore.getState().setOpen(true);
    expect(useChatPanelStore.getState().open).toBe(true);

    useMobileNavStore.getState().setOpen(true);

    expect(useMobileNavStore.getState().open).toBe(true);
    expect(useChatPanelStore.getState().open).toBe(false);
  });

  it('互斥（兜底 D4）：面板开着时 toggle 抽屉 → 面板关、抽屉开', () => {
    useChatPanelStore.getState().setOpen(true);

    useMobileNavStore.getState().toggle();

    expect(useMobileNavStore.getState().open).toBe(true);
    expect(useChatPanelStore.getState().open).toBe(false);
  });

  it('不落盘：开合状态不写 localStorage（键集不变）', () => {
    const keysBefore = Object.keys(window.localStorage).sort();

    useMobileNavStore.getState().setOpen(true);
    useMobileNavStore.getState().toggle();
    useMobileNavStore.getState().setOpen(true);

    expect(useMobileNavStore.getState().open).toBe(true);
    expect(Object.keys(window.localStorage).sort()).toEqual(keysBefore);
    expect(window.localStorage.getItem('zhiwei_mobile_nav')).toBeNull();
  });
});
