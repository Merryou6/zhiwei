// @vitest-environment jsdom
/**
 * 右侧常驻对话面板开合切片测试（stores/chatPanel.ts，v1.3 D1a）
 *
 * 覆盖：默认关闭（不落盘）；toggle 往返；setOpen 显式设值。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useChatPanelStore } from '../src/stores/chatPanel';

beforeEach(() => {
  useChatPanelStore.getState().setOpen(false);
});

describe('chatPanel store', () => {
  it('默认关闭（会话级，不读 localStorage）', () => {
    expect(useChatPanelStore.getState().open).toBe(false);
    expect(window.localStorage.getItem('zhiwei_chat_panel')).toBeNull();
  });

  it('toggle 开 → 关往返', () => {
    useChatPanelStore.getState().toggle();
    expect(useChatPanelStore.getState().open).toBe(true);

    useChatPanelStore.getState().toggle();
    expect(useChatPanelStore.getState().open).toBe(false);
  });

  it('setOpen 显式设值（幂等）', () => {
    useChatPanelStore.getState().setOpen(true);
    useChatPanelStore.getState().setOpen(true);
    expect(useChatPanelStore.getState().open).toBe(true);

    useChatPanelStore.getState().setOpen(false);
    expect(useChatPanelStore.getState().open).toBe(false);
  });
});
