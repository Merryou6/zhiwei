/** @type {import('tailwindcss').Config} */
export default {
  // relative: true —— 让 glob 相对本配置文件解析：工程从仓库根用 `--config apps/web/vite.config.ts`
  // 启动（cwd=仓库根），默认按 cwd 解析会命中不到 apps/web/src，导致「No utility classes detected」。
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      // 令牌与 src/theme/bands.ts 逐字守恒（tests/bands.test.ts 断言）：
      // 四状态带（暖橙/黄/浅青绿/青绿）+ 主色低饱和青蓝，无刺眼大红。
      colors: {
        primary: '#4E8FB0',
        'primary-soft': '#EAF2F6',
        'band-weak': '#E8894A',
        'band-unstable': '#D9B23F',
        'band-basic': '#79B8A6',
        'band-mastered': '#2F9C7C',
        ink: '#22303A',
        'ink-soft': '#5B6B76',
        // 层次令牌（2026-09-20 风格走查）：canvas 压深一档、line 提对比一档，
        // 让白底卡片在浅底上具备可感知的边界；四状态带与主色不动（守恒测试锁的就是那四色）。
        line: '#DCE4E9',
        canvas: '#F5F8F9',
        // 提示条语义加深色：error 用更深暖橙（仍低饱和、非刺眼大红，遵守 PRD §6）。
        'tone-error': '#C96A3A',
      },
      boxShadow: {
        // 卡片抬升（极轻，不抢状态带颜色的注意力）
        card: '0 1px 2px rgba(34,48,58,0.04), 0 2px 6px rgba(34,48,58,0.05)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
