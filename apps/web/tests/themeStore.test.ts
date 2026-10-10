// @vitest-environment jsdom
/**
 * 主题切片测试（D3 建立；2026-10-10 style-10 蓝图迁移 P2 按 D2 换值）
 *
 * 【D2 / 拍板① 的新意图】默认「跟随系统、优先白图」：
 *   1) 显式偏好最优先 —— 落盘的 'dark' / 'light' 照用（老用户 zhiwei_theme 不丢）；
 *   2) 无偏好（读不到 / 空串 / 脏值）时**仅当**系统 prefers-color-scheme: dark 命中才用蓝图，
 *      其余一律白图。这就是「优先白图」的含义：白图是缺省答案，不需要任何证据。
 *
 * 覆盖：resolveInitialTheme 三分支（显式深 / 显式浅 / 无偏好×系统深浅）/ setTheme 双写
 * （DOM class + meta content + localStorage）/ toggle 互切 / 重载模块后的读盘恢复 /
 * localStorage 不可用（隐私模式）时不崩。
 *
 * 手法参照 authStore.test.ts：beforeEach 清 localStorage，重载模块用 vi.resetModules()
 * 取新单例（store 的初始 theme 在模块加载时解析，只有重载才能验证「读盘恢复」）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../src/router';
import { THEME_COLOR, resolveInitialTheme, useThemeStore } from '../src/stores/theme';

/** 测试文档里补一个 meta[name=theme-color]（jsdom 默认没有，store 要能改写它）。 */
function ensureMeta(): void {
  document.head.innerHTML = '<meta name="theme-color" content="#0B1B2B" />';
}

/** 只读当前 meta theme-color（不可复用 ensureMeta——它会重建 DOM）。 */
function metaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

/**
 * 把系统配色偏好钉成确定值（jsdom 没有真实的 prefers-color-scheme 媒体状态）。
 * 只填 store 会读到的那些成员（matches + 监听三件套），避免引入真实 MediaQueryList 类型。
 */
function stubPrefersDark(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

/** 让 matchMedia 整个缺席（老浏览器 / 非浏览器环境）。 */
function removeMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dusk');
  ensureMeta();
  stubPrefersDark(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('theme · resolveInitialTheme（与 index.html 内联脚本同规则）', () => {
  it('显式偏好最优先：落盘 dark → 蓝图，落盘 light → 白图（无视系统偏好）', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
    expect(resolveInitialTheme('dark', true)).toBe('dark');
    expect(resolveInitialTheme('light', true)).toBe('light');
    expect(resolveInitialTheme('light', false)).toBe('light');
  });

  it('无偏好（null / 空串 / 任意脏值）跟随系统：系统深色 → 蓝图，其余 → 白图', () => {
    for (const stored of [null, '', 'garbage', 'system', 'DARK']) {
      expect(resolveInitialTheme(stored, true), `${String(stored)} + 系统深色`).toBe('dark');
      expect(resolveInitialTheme(stored, false), `${String(stored)} + 系统浅色`).toBe('light');
    }
  });

  it('prefersDark 缺省时按「优先白图」：无证据即白图', () => {
    expect(resolveInitialTheme(null)).toBe('light');
    expect(resolveInitialTheme('garbage')).toBe('light');
    // 显式偏好仍然最高（缺省参数不影响它）
    expect(resolveInitialTheme('dark')).toBe('dark');
  });
});

describe('theme · setTheme / toggle（DOM + 落盘）', () => {
  it('setTheme("light")：html 无 dusk、meta = 白图底色、localStorage 写入', () => {
    document.documentElement.classList.add('dusk'); // 先置于蓝图，验证会被摘掉
    useThemeStore.getState().setTheme('light');

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dusk')).toBe(false);
    expect(metaContent()).toBe(THEME_COLOR.light);
    expect(THEME_COLOR.light).toBe('#F4F7FA');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
  });

  it('setTheme("dark")：dusk 挂回、meta = 蓝图底色、localStorage 写入', () => {
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dusk')).toBe(true);
    expect(metaContent()).toBe(THEME_COLOR.dark);
    expect(THEME_COLOR.dark).toBe('#0B1B2B');
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });

  it('toggle 深浅互切', () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('刷新页面（重载模块）后从 localStorage 恢复显式浅色偏好', async () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light');

    vi.resetModules();
    const fresh = (await import('../src/stores/theme')).useThemeStore;
    expect(fresh.getState().theme).toBe('light');
  });

  it('无偏好 + 系统深色：重载模块后进入蓝图（dusk 挂上）', async () => {
    stubPrefersDark(true);
    vi.resetModules();
    const fresh = (await import('../src/stores/theme')).useThemeStore;
    expect(fresh.getState().theme).toBe('dark');
  });

  it('localStorage 读写抛错（隐私模式）时不崩：跟随系统的判定仍成立、内存态可用', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    removeMatchMedia(); // 连 matchMedia 也不可用：一律按白图（优先白图）

    vi.resetModules();
    const fresh = (await import('../src/stores/theme')).useThemeStore;

    expect(fresh.getState().theme).toBe('light'); // 读不到偏好 + 无系统证据 → 白图
    expect(() => fresh.getState().setTheme('dark')).not.toThrow();
    expect(fresh.getState().theme).toBe('dark'); // 内存态已更新
    expect(document.documentElement.classList.contains('dusk')).toBe(true);
  });
});
