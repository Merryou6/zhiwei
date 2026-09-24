// @vitest-environment jsdom
/**
 * 汉堡抽屉开合切片测试（stores/mobileNav.ts，移动端适配轮 D3/D4）
 *
 * 覆盖 5 条：store 4 条 —— 默认关闭（会话级、不落盘）；setOpen/toggle 状态机；
 *   与右侧对话面板的互斥（两个方向各一条）；与 localStorage 无关。
 *   另一条是清尾轮 T2 补的**静态断言**：读 TopNav.tsx / MobileNav.tsx 的源文件文本，
 *   断言两者都不再硬编码跨组件共享的 id 字面量、且都从 lib/ids.ts 导入共享常量
 *   （手法仿 stages.test.ts「直接读源文件核对」先例，与组件渲染无关）。
 *
 * 抽屉的渲染与交互（Esc / 背景幕 / 焦点陷阱 / 焦点归还 / aria-modal）不在这里测——
 * 现有 14 个前端测试文件全是逻辑/静态单测、无 jsdom 组件渲染先例（不引渲染测试栈），
 * 那部分由 tools/responsive-audit.cjs --probe-nav 在真浏览器里取证（计划 7.3 / 8.3.3）。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { useChatPanelStore } from '../src/stores/chatPanel';
import { useMobileNavStore } from '../src/stores/mobileNav';

/** apps/web/tests → apps/web/src */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

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

describe('跨组件 DOM id 单一来源（清尾轮 T2 / 审查 L2）', () => {
  it('TopNav / MobileNav 都不再硬编码 id 字面量，改从 lib/ids.ts 导入共享常量', () => {
    const sources = [
      ['TopNav.tsx', readFileSync(resolve(SRC, 'components/TopNav.tsx'), 'utf8')],
      ['MobileNav.tsx', readFileSync(resolve(SRC, 'components/MobileNav.tsx'), 'utf8')],
    ] as const;

    // ⚠ 断言里出现的 id 一律**拆写**：否则本断言自身的文本就成了「使用点」，
    // 测试会退化成自证（与 breakpoints.test.ts 禁止清单同一套纪律）。
    const toggleId = ['mobile', 'nav', 'toggle'].join('-');
    const drawerId = ['mobile', 'nav', 'drawer'].join('-');

    for (const [name, text] of sources) {
      // 背景：汉堡键与抽屉分属两个组件，靠 id 字符串 + aria-controls 关联；
      // 只改一处会静默失效（焦点不再归还、aria 关联断掉），既不报错也不挂测试。
      expect(text, `${name} 不应再出现硬编码的汉堡键 id 字面量`).not.toContain(toggleId);
      expect(text, `${name} 不应再出现硬编码的抽屉 id 字面量`).not.toContain(drawerId);
      // 两边都从共享常量模块取（含 MobileNav 焦点归还用的 getElementById）
      expect(text, `${name} 应从 lib/ids.ts 导入 id 常量`).toContain(`from '../lib/ids'`);
      expect(text, `${name} 应使用 MOBILE_NAV_TOGGLE_ID`).toContain('MOBILE_NAV_TOGGLE_ID');
      expect(text, `${name} 应使用 MOBILE_NAV_DRAWER_ID`).toContain('MOBILE_NAV_DRAWER_ID');
    }
  });
});
