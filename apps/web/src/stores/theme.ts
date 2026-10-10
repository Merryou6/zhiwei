/**
 * 主题切片（D3 建立；2026-10-10 style-10 迁移 P3 按 D2 / 拍板① 重写初始判定）：
 * 蓝图（深色）与白图（浅色）两态，落 localStorage（'zhiwei_theme'）。
 *
 * 机制：主题的唯一开关是 <html> 上的 `dusk` class（见 src/index.css 的变量体系）——
 * 挂上 = 蓝图，去掉 = 白图（白图基线完整保留在 :root，且**它就是默认**）。
 * 本 store 只负责三件事：
 *   1) 读偏好（模块加载时）→ 初始 theme；
 *   2) setTheme/toggle → 写 localStorage + 同步 DOM（class + meta theme-color）；
 *   3) 供 Masthead 与「我的」页共用（两处入口同一份状态）。
 *
 * 默认值（拍板①「跟随系统、优先白图」）：
 *   · 显式偏好最优先 —— 落盘的 'dark' / 'light' 照用（老用户 zhiwei_theme 不丢）；
 *   · 无偏好（读不到 / 空串 / 脏值）时**仅当**系统明确深色才用蓝图，
 *     其余一律白图：白图是缺省答案，不需要任何证据。
 *
 * 首帧防闪由 index.html 的内联同步脚本负责（在本 store 之前跑），二者键名与判定规则
 * 必须**逐字一致**（themeStore.test.ts 与 tokens/breakpoints 的静态纪律共同背书）：
 *   stored === 'dark' → dusk；stored === 'light' → 不挂；
 *   其余 → 看 (prefers-color-scheme: dark)。
 *
 * DOM 操作全部 try/catch：隐私模式 / 无 document（node 测试）下不崩，内存态仍可用
 * —— 与 stores/auth、stores/space 同款纪律。
 */

import { create } from 'zustand';

import { STORAGE_KEYS } from '../router';

export type Theme = 'dark' | 'light';

/** 主题 → 浏览器 UI 主题色（meta[name=theme-color]），与 index.html 内联脚本一致。 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#0B1B2B',
  light: '#F4F7FA',
};

/**
 * 系统是否偏好深色（= 蓝图）。
 * 无 window / 无 matchMedia（老浏览器、node 测试）/ 抛异常 → false：
 * 一律按「优先白图」处理，与 resolveInitialTheme 的缺省参数同义。
 */
export function systemPrefersDark(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/**
 * 初始主题解析（纯函数）：
 *   1) 显式偏好最高（'dark' / 'light' 直接照用）；
 *   2) 其余（null / '' / 脏值）跟随系统，且**优先白图**（systemPrefersDark 缺省 false）。
 * 与 index.html 内联脚本同规则。
 */
export function resolveInitialTheme(stored: string | null, systemPrefersDarkValue = false): Theme {
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  return systemPrefersDarkValue ? 'dark' : 'light';
}

export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** 蓝图 / 白图互切（Masthead 图标按钮与「我的」页共用）。 */
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
  theme: resolveInitialTheme(readStored(), systemPrefersDark()),

  setTheme: (theme: Theme) => {
    writeStored(theme);
    applyToDom(theme);
    set({ theme });
  },

  toggle: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));
