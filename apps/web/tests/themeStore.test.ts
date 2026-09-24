// @vitest-environment jsdom
/**
 * 主题切片测试（D3）
 *
 * 覆盖：resolveInitialTheme 判定（仅 'light' 为浅色）/ setTheme 双写（DOM class + meta content
 * + localStorage）/ toggle 互切 / localStorage 不可用（隐私模式）时不崩。
 *
 * 手法参照 authStore.test.ts：beforeEach 清 localStorage，重载模块用 vi.resetModules() 取新单例
 * （store 的初始 theme 在模块加载时解析，只有重载才能验证「读盘恢复」）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../src/router';
import { THEME_COLOR, resolveInitialTheme, useThemeStore } from '../src/stores/theme';

/** 测试文档里补一个 meta[name=theme-color]（jsdom 默认没有，store 要能改写它）。 */
function ensureMeta(): void {
  document.head.innerHTML = '<meta name="theme-color" content="#070C14" />';
}

/** 只读当前 meta theme-color（不可用 ensureMeta——它会重建 DOM）。 */
function metaContent(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dusk');
  ensureMeta();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('theme · resolveInitialTheme（与 index.html 内联脚本同规则）', () => {
  it('null / "dark" / 任意脏值 → dark（默认深色）', () => {
    expect(resolveInitialTheme(null)).toBe('dark');
    expect(resolveInitialTheme('dark')).toBe('dark');
    expect(resolveInitialTheme('garbage')).toBe('dark');
    expect(resolveInitialTheme('')).toBe('dark');
  });

  it('仅 "light" → light', () => {
    expect(resolveInitialTheme('light')).toBe('light');
  });
});

describe('theme · setTheme / toggle（DOM + 落盘）', () => {
  it('setTheme("light")：html 无 dusk、meta = #F5F8F9、localStorage 写入', () => {
    document.documentElement.classList.add('dusk'); // 先置于深色，验证会被摘掉
    useThemeStore.getState().setTheme('light');

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dusk')).toBe(false);
    expect(metaContent()).toBe(THEME_COLOR.light);
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('light');
  });

  it('setTheme("dark")：dusk 挂回、meta = #070C14、localStorage 写入', () => {
    useThemeStore.getState().setTheme('light');
    useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dusk')).toBe(true);
    expect(metaContent()).toBe(THEME_COLOR.dark);
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark');
  });

  it('toggle 深浅互切', () => {
    useThemeStore.getState().setTheme('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('刷新页面（重载模块）后从 localStorage 恢复浅色偏好', async () => {
    localStorage.setItem(STORAGE_KEYS.theme, 'light');

    vi.resetModules();
    const fresh = (await import('../src/stores/theme')).useThemeStore;
    expect(fresh.getState().theme).toBe('light');
  });

  it('localStorage 读写抛错（隐私模式）时不崩：内存态仍可用', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    vi.resetModules();
    const fresh = (await import('../src/stores/theme')).useThemeStore;

    expect(fresh.getState().theme).toBe('dark'); // 读不到 → 默认深色
    expect(() => fresh.getState().setTheme('light')).not.toThrow();
    expect(fresh.getState().theme).toBe('light'); // 内存态已更新
    expect(document.documentElement.classList.contains('dusk')).toBe(false);
  });
});
