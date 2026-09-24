/**
 * 主题切片（D3）：深浅两态，落 localStorage（'zhiwei_theme'），默认深色。
 *
 * 机制：主题的唯一开关是 <html> 上的 `dusk` class（见 src/index.css 的变量体系）——
 * 挂上 = 深色，去掉 = 浅色（浅色基线完整保留在 :root）。本 store 只负责三件事：
 *   1) 读偏好（模块加载时）→ 初始 theme；
 *   2) setTheme/toggle → 写 localStorage + 同步 DOM（class + meta theme-color）；
 *   3) 供顶栏 ThemeToggle 与「我的」页共用（两处入口同一份状态）。
 *
 * 首帧防闪由 index.html 的内联同步脚本负责（在本 store 之前跑），二者键名与判定规则
 * 必须一致：只有 'light' 算浅色，其余（含读不到/异常）一律深色。
 *
 * DOM 操作全部 try/catch：隐私模式 / 无 document（node 测试）下不崩，内存态仍可用
 * —— 与 stores/auth、stores/space 同款纪律。
 */

import { create } from 'zustand';

import { STORAGE_KEYS } from '../router';

export type Theme = 'dark' | 'light';

/** 主题 → 浏览器 UI 主题色（meta[name=theme-color]），与 index.html 内联脚本一致。 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#070C14',
  light: '#F5F8F9',
};

/**
 * 初始主题解析（纯函数）：只有显式 'light' 才浅色，其余一律深色。
 * 与 index.html 内联脚本 `t !== 'light'` 的判定完全相同（默认深色，上线不变样）。
 */
export function resolveInitialTheme(stored: string | null): Theme {
  return stored === 'light' ? 'light' : 'dark';
}

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** 深浅互切（顶栏图标按钮与「我的」页共用）。 */
  toggle: () => void;
}

function readStored(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEYS.theme);
  } catch {
    return null;
  }
}

function writeStored(theme: Theme): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {
    /* 隐私模式等场景忽略：内存态仍然可用 */
  }
}

/** 把主题落到 DOM：html.dusk class + meta theme-color（无 document 时静默跳过）。 */
function applyToDom(theme: Theme): void {
  try {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dusk', theme === 'dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
  } catch {
    /* 忽略：主题失败只影响观感，不该阻断交互 */
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: resolveInitialTheme(readStored()),

  setTheme: (theme: Theme) => {
    writeStored(theme);
    applyToDom(theme);
    set({ theme });
  },

  toggle: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));
