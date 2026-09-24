/**
 * 主题切换按钮（D3d）：顶栏空间胶囊左侧、「我的」页各一处，共用 useThemeStore。
 *
 * 图标语义：当前是深色 → 显示「太阳」（点击去浅色）；当前是浅色 → 显示「月亮」。
 * 线框 SVG、无填充，两主题下都随 currentColor 取 text-ink-soft，不引入新配色。
 * 触控目标 36×36（min 36px 纪律），走语义令牌而非裸 hex。
 */

import { useThemeStore } from '../stores/theme';

export default function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="切换深浅主题"
      aria-pressed={isDark}
      title={isDark ? '切到浅色' : '切到深色'}
      className="grid h-9 w-9 flex-none place-items-center rounded-control border border-line text-ink-soft transition-colors duration-150 ease-out hover:bg-raised"
    >
      {isDark ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1Z" />
        </svg>
      )}
    </button>
  );
}
