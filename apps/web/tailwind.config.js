/** @type {import('tailwindcss').Config} */
export default {
  // relative: true —— 让 glob 相对本配置文件解析：工程从仓库根用 `--config apps/web/vite.config.ts`
  // 启动（cwd=仓库根），默认按 cwd 解析会命中不到 apps/web/src，导致「No utility classes detected」。
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      // ───────────────────────────────────────────────────────────────
      // 令牌与 src/theme/bands.ts 逐字守恒（tests/bands.test.ts 逐键断言）：
      // 四状态带（暖橙/黄/浅青绿/青绿）+ 主色低饱和青蓝，无刺眼大红。
      // 本区**只增不改**：下游有守恒测试，改值即破坏语义与测试。
      // ───────────────────────────────────────────────────────────────
      colors: {
        // ─── 守恒区：字面 hex，禁止改成变量 ───────────────────────────
        // tests/bands.test.ts 逐键断言 `tailwindColors['primary'] === '#4E8FB0'`
        // 等六项。改成 rgb(var(--x)) 会让断言直接失败，也会切断
        // src/theme/bands.ts 与 tailwind 配置之间的唯一真相。
        primary: '#4E8FB0',
        'primary-soft': '#EAF2F6',
        'band-weak': '#E8894A',
        'band-unstable': '#D9B23F',
        'band-basic': '#79B8A6',
        'band-mastered': '#2F9C7C',

        // ─── 主题变量区（2026-09-22 视觉批四：全站深色化）──────────────
        // 上一轮只把登录页做成深色，内页仍是浅色。用户登录后会话落在
        // localStorage（「刷新不掉线」），一打开就被送进内页，看到的是满屏
        // 白底 —— 于是反馈「怎么还是没变」。根因是深色没有覆盖全站。
        //
        // 为什么不逐组件改 class：内页 text-ink 出现 202 次、bg-white 54 次、
        // border-line 68 次。逐处改既容易漏，也会把「配色」这件事散布到
        // 几百行 JSX 里。改为让令牌指向 CSS 变量，:root 放浅色值、
        // html.dusk 放深色值，一个开关全站换肤，组件代码一行不用动。
        //
        // 变量值定义在 src/index.css。浅色值与原字面 hex 完全相同，
        // 因此未挂 dusk 时外观零变化。
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        'canvas-deep': 'rgb(var(--c-canvas-deep) / <alpha-value>)',
        sunken: 'rgb(var(--c-sunken) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        // 强调色的语义层：浅色下等于 primary (#4E8FB0)，深色下换成
        // primary-lift (#6FB3D4)。分成两个名字是必须的 ——
        // #4E8FB0 承载白字只有 3.57:1，深底上当按钮不达 AA；
        // 而 primary 被守恒测试锁死不能改，只能另起一问一答的令牌。
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-veil': 'rgb(var(--c-accent-veil) / <alpha-value>)',
        // 落在 accent 底上的文字：浅色下白、深色下近黑（#6FB3D4 上
        // 白字仅 2.32:1，黑字 8.5:1）。这是唯一能让强调块在两套主题下
        // 都达标的方式。
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',

        // 提示条语义加深色：error 用更深暖橙（仍低饱和、非刺眼大红，遵守 PRD §6）。
        // 深底上 #C96A3A 尚有 5.27:1，两套主题通用，不变量化。
        'tone-error': '#C96A3A',

        // ─────────────────────────────────────────────────────────────
        // 深色场景表面（登录页）。2026-09-23 换血：与 B 端控制台原型
        // （zhiwei-console/design.css）同一世界 —— 深灰蓝 #122139 系而非 off-black。
        // 原型纪律：分层靠 1px 描边，不靠重阴影与渐变。
        // ─────────────────────────────────────────────────────────────
        'dusk-base': '#122139',     // 页面底（= 原型 canvas-deep，登录页比内页更深一档）
        'dusk-surface': '#1e293b',  // 抬升表面：表单外壳、面板（= 原型 surface）
        'dusk-raised': '#25344a',   // 再上一层：展示块、次级按钮（= 原型 raised）
        'dusk-line': '#334155',     // 边框与分隔线（= 原型 line）
        // 前景色。**每个值标注的是它在 base 上的对比度，但对比度取决于落在哪个表面**——
        // 落到更亮的 surface / raised 上会整体下降，实测：
        //                        on base   on surface  on raised
        //   title  #E8EEF4       16.8:1     14.6:1      12.5:1
        //   body   #B8C4D0       11.1:1      9.6:1       8.3:1
        //   muted  #7A8798        5.4:1      4.8:1       4.1:1  ← raised 上已不达 AA
        //   faint  #5A6675        3.4:1      3.0:1       2.6:1  ← 任何表面都不达 AA
        //
        // 由此两条使用纪律（都是实测踩出来的）：
        //   1. muted 不用在 raised 上；要放在 raised 上就改用 body。
        //   2. faint 只用于非文本装饰（分隔符、图标描边）。它曾经被用在
        //      12px 的说明文字上，实测 2.99:1，已改回 muted。
        'dusk-title': '#E8EDF3',    // 标题 / 正文强调（= 原型 ink，12.6:1 on base）
        'dusk-body': '#A9B2C3',     // 正文（= 原型 ink-2，7.4:1 on base）
        'dusk-muted': '#6B7280',    // 仅禁用态，不承载信息（= 原型 ink-3）
        'dusk-faint': '#5A6675',    // 仅限非文本装饰

        // 深色底上的品牌色：与 primary **同色相**（COLOR CONSISTENCY LOCK：
        // 全站只有一个强调色），仅提亮以在深底上达到 AA。
        // 与之相对，登录页此前用的 #67E8F9 / #4EA8FF / #6FE9B4 是另起的三套蓝绿，
        // 与内页 primary 不是同一个颜色家族 —— 已废弃。
        'primary-lift': '#42A5F5',  // 深底上的主色（= 原型 accent，承载 #0B1A2C 约 7.4:1）
        'primary-press': '#2F92E6', // 主色按下态（= 原型 accent-active）
      },

      // ── 圆角刻度（SHAPE CONSISTENCY LOCK）─────────────────────────
      // 一个页面只允许一套圆角规则，且必须有依据。2026-09-23 对齐原型：
      // 控件与卡片统一 8px（原型 --r-card / --r-ctl 均为 8px，brief 规范值）。
      // shell 是页面级最大外壳（登录表单容器），保留稍大一档做层级区分。
      borderRadius: {
        control: '8px',
        surface: '8px',
        shell: '12px',
      },

      boxShadow: {
        // 卡片抬升：同样走主题变量。
        //
        // 为什么阴影也必须变量化：浅色的 card 阴影是 rgba(34,48,58,…) 的冷灰，
        // 投在深色底上等于没画——深色里的「抬起」靠的是上缘 1px 内高光 + 更深的外羽化，
        // 不是把浅色阴影照搬过来。变量值见 src/index.css。
        card: 'var(--shadow-card)',
        // 深色场景：阴影带蓝调（跟着底色走，不用纯黑）、有 y 偏移与柔和羽化。
        // 首段 inset 是 1px 内高光边，用来给深色表面一个可感知的上边缘——
        // 这是边缘定义，不是外发光；零偏移的彩色外发光属装饰，一律不用。
        //
        // 首版的表面明度差只有 1.06:1、边框 1.34:1（实测渲染值），卡片和底色糊在一起。
        // 深色界面的表面层次本来就窄，必须把「表面明度 + 边框 + 内高光」三件事一起抬，
        // 单靠任何一件都不够——现取值为：表面 1.12:1、边框 1.62:1。
        'dusk-surface':
          '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 18px 44px -20px rgba(5,13,26,0.7)',
        'dusk-raised': '0 1px 2px rgba(5,13,26,0.4), 0 10px 26px -18px rgba(5,13,26,0.6)',
      },

      // ── 动效曲线 ──────────────────────────────────────────────────
      // 指数缓出：起手快、收尾长，读起来像物体自然停住。
      // 全站入场/交互统一走这条曲线，不要每处各写一个 cubic-bezier。
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },

      // ── z-index 刻度 ──────────────────────────────────────────────
      // 禁止在组件里写 z-[9999]。四层足够覆盖现有结构。
      zIndex: {
        nav: '40',
        overlay: '50',
        toast: '60',
      },

      fontFamily: {
        // 拉丁字母与数字交给 Geist（自托管，不依赖外网，无 FOUT 抖动）；
        // 汉字不在 Geist 字形集内，自然回落到系统中文栈。
        //
        // 中文为什么不引外部字体：思源/霞鹜一类全量中文字体动辄数 MB，
        // 为一个登录页拖垮首屏不划算。中文的质感来自排版工艺
        // （标点挤压 palt、字重阶梯、字距控制），这些在 index.css 里做。
        sans: [
          'Geist Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: ['Geist Mono Variable', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
