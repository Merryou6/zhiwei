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
        line: '#E3E8EB',
        canvas: '#F7F9FA',
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
