// @vitest-environment jsdom
/**
 * 右侧常驻对话面板开合切片测试（stores/chatPanel.ts，v1.3 D1a/D1d）
 *
 * 覆盖：默认关闭（不落盘）；toggle 往返；setOpen 显式设值；
 *   关闭面板只改开合、不动对话上下文（D1a：上下文在全局 dialog store）；
 *   与路由无关（D1d：改的只是渲染层，ROUTES / navRoutes 数据结构零改动）。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { ROUTES, navRoutes } from '../src/router';
import { useChatPanelStore } from '../src/stores/chatPanel';
import { useDialogStore } from '../src/stores/dialog';

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

  it('关闭面板只改开合状态：对话上下文（消息 / 链路）原样保留', () => {
    useDialogStore.getState().reset();
    useDialogStore.getState().appendStudent('我卡在配方这一步');
    useDialogStore.getState().startAssistant();
    useDialogStore.getState().appendThought('匹配到知识点「二次函数配方」');
    useDialogStore.getState().setPhase({ name: 'judge', label: '判定' });

    useChatPanelStore.getState().setOpen(true);
    useChatPanelStore.getState().setOpen(false);

    expect(useChatPanelStore.getState().open).toBe(false);
    expect(useDialogStore.getState().messages).toHaveLength(2);
    expect(useDialogStore.getState().thought).toBe('匹配到知识点「二次函数配方」');
    expect(useDialogStore.getState().phase).toEqual({ name: 'judge', label: '判定' });

    useDialogStore.getState().reset();
  });

  it('与路由无关：开合不写 URL / 存储，路由表仍是 11 页 6 项导航（/chat 保留在全屏路由里；v1.4 控制台砍除）', () => {
    useChatPanelStore.getState().toggle();

    expect(useChatPanelStore.getState().open).toBe(true);
    expect(window.location.hash).toBe('');
    expect(window.localStorage.getItem('zhiwei_chat_panel')).toBeNull();
    expect(ROUTES).toHaveLength(11);
    expect(navRoutes().map((route) => route.path)).toEqual([
      '/assessment',
      '/chat',
      '/graph',
      '/report',
      '/drive',
      '/me',
    ]);
    expect(ROUTES.find((route) => route.path === '/chat')?.requiresAuth).toBe(true);
  });
});
