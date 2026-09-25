/** @type {import('tailwindcss').Config} */
export default {
  // relative: true —— 让 glob 相对本配置文件解析：工程从仓库根用 `--config apps/web/vite.config.ts`
  // 启动（cwd=仓库根），默认按 cwd 解析会命中不到 apps/web/src，导致「No utility classes detected」。
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      // ───────────────────────────────────────────────────────────────
      // 响应式断点（单一来源，2026-09-24 移动端适配轮 D1/D2）
      //
      // nav 是「导航收纳断点」：<720 顶栏收进汉堡抽屉、ChatPage 双栏切单栏、
      // 正文页边距 48→32px。取 720 的理由：TopNav 原有 2 处 max-[720px]:hidden
      // 与 ChatPage 的 min-[720px] 双栏切换**本就在用 720**，它正是「顶栏收纳 /
      // 双栏切换」的现役分界；改取其他值反而引入新的行为漂移。
      //
      // 为什么 sm:/lg: 不并入本表：它们不是散落的魔法数字（Tailwind 默认刻度
      // 本身就是集中定义）。强行替换会让 lg:grid-cols-3（1024）在 768–1023
      // 提前变三列——直接违反「桌面 ≥768 渲染像素级零变化」这条硬约束。
      //
      // 生效后得到两组变体：
      //   nav:*     → @media (min-width: 720px)
      //   max-nav:* → @media not all and (min-width: 720px)  即 ≤719.98px
      // src/** 不得再出现任意值断点变体（/tests/breakpoints.test.ts 静态锁死）。
      // ⚠ 边界说明：旧写法 min-[720px] 与 max-[720px] 在**恰好 720px** 处同时命中
      //   （min-width:720 + max-width:720），而 nav/max-nav 是互斥互补的一对——
      //   恰在 720px 处的差异已实测并在执行报告中留痕。
      // ───────────────────────────────────────────────────────────────
      screens: {
        nav: '720px',
      },

      // ───────────────────────────────────────────────────────────────
      // 字号刻度（2026-09-25 视觉重构 P1a）
      //
      // 收敛前：全站 27 个文件、118 处在写任意值 —— text-[13px] 96 处、
      // text-[11px] 10 处、text-[15px] 4 处、text-[38px]/[42px] 登录标题。
      // 字号本该是最先被约束的东西，却是唯一从未被令牌化的维度。
      //
      // ⚠ 必须用**单值字符串**，禁止 [size, { lineHeight }] 元组。
      //   任意值 text-[13px] 只产出 `font-size:13px` 一条声明，行高由
      //   leading-* 或继承决定；换成元组后 Tailwind 会**额外注入 line-height**，
      //   从而改变文本块高度、继而移动兄弟元素 —— 那是一次隐性布局变更。
      //   单值形式只产出 font-size，与替换前逐位等价，codemod 才是安全的。
      //
      // 命名的依据不是「大小」而是「职责」：
      //   display / display-lg — 品牌时刻（仅登录页，配合 sm: 升档）
      //   reading              — 需要逐字读的正文（题干、表单值）
      //   ui-sm                — 界面次要文字：元信息、说明、小按钮
      //   caption              — 极小元信息与密集标签
      // ───────────────────────────────────────────────────────────────
      fontSize: {
        caption: '11px',
        'ui-sm': '13px',
        reading: '15px',
        display: '38px',
        'display-lg': '42px',
      },

      // ───────────────────────────────────────────────────────────────
      // 动效（2026-09-25 视觉重构 P1a）
      //
      // 本轮只要 3 个 keyframe，全部在这里定义，组件不写内联动画：
      //   ① rise             —— Hero / 区块的一次性入场
      //   ② fade             —— 浮层与背景幕
      //   ③ slide-in-panel   —— 移动端导航抽屉入场
      //
      // ⚠ 两条硬纪律（无障碍红线，不是风格偏好）：
      //   1. from 隐藏 → to 可见，且**元素基态必须是可见/终态**。
      //      index.css 末尾的 `@media (prefers-reduced-motion: reduce)` 把
      //      animation-duration 压到 0.01ms —— 动画会瞬间收敛到终态。若把基态
      //      写成 opacity-0，降级后元素**永久隐形**，这是真实缺陷而不是小瑕疵。
      //   2. **禁止 animation-delay / stagger**。全局降级块没有重置 delay，
      //      带延迟的元素会先隐形再出现，看起来像卡顿。
      //
      // 不做：页面级路由转场、列表 stagger、滚动视差、数字滚动。
      // ───────────────────────────────────────────────────────────────
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        fade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-panel': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        fade: 'fade 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-panel': 'slide-in-panel 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },

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
        // 强调色**作为文字**时的取值（2026-09-25 P2 补，系统性修复一个既有缺陷）。
        //
        // 问题：accent 在浅色下 = #4E8FB0，落在白底上只有 3.57:1、落在 accent-veil
        // (#EAF2F6) 上只有 3.15:1 —— 都不达 AA 的 4.5:1。全站却有 20+ 处把它当文字用
        // （导航激活态、徽标、链接、卡片眉标…）。
        //
        // 项目其实早就发现过这一点，但当时只能**局部规避**：清尾轮 L2 在 ChatTracePanel
        // 里把「进行中」从 text-accent 改成 text-ink-soft，并留下实测数字，结论是
        // 「accent 只当非文本装饰用（3:1 门槛），文字交给 ink 家族」。问题是这样一来
        // 品牌色在文字层面就消失了，而且每遇到一处都要重新判断一次。
        //
        // 所以这里补一个「accent 作为文字」的角色令牌，与既有的 on-accent
        // （「落在 accent 底上的文字」）成对 —— 同一件事的一问一答：
        //   accent      → 填充、描边、图形（非文本，3:1 门槛）
        //   accent-ink  → 文字（4.5:1 门槛）
        //   on-accent   → 落在 accent 填充上的文字
        //
        // 取值：浅色 #2E6B87（同色相压深；白底 5.95:1、accent-veil 上 5.26:1、
        // canvas 上 5.58:1，三处都过 AA）；深色沿用 #6FB3D4（= accent 本身，
        // 在 accent-veil 上 7.20:1，本来就是达标的）。
        // ⚠ 全站纪律：text-accent 一律用 text-accent-ink 代替；accent 只用于
        //   bg-/border-/ring-/描边与 currentColor 图形。
        'accent-ink': 'rgb(var(--c-accent-ink) / <alpha-value>)',
        // 落在 accent 底上的文字：浅色下白、深色下近黑（#6FB3D4 上
        // 白字仅 2.32:1，黑字 8.5:1）。这是唯一能让强调块在两套主题下
        // 都达标的方式。
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',

        // 提示条语义加深色：error 用更深暖橙（仍低饱和、非刺眼大红，遵守 PRD §6）。
        // 深底上 #C96A3A 尚有 5.27:1，两套主题通用，不变量化。
        'tone-error': '#C96A3A',

        // 危险/错误前景（2026-09-25 视觉重构 P1a）。
        // 收敛前这是登录页一个 JS 常量 `ERROR_TEXT='text-[#FFB088]'` ——
        // 全站唯一残留的硬编码 hex，且无法随主题切换，被 breakpoints.test.ts
        // 白名单特批。改成变量令牌后白名单可以撤掉。
        //   浅色 #C96A3A（与 tone-error 同值，白底 4.9:1）
        //   深色 #FFB088（原值，dusk-base 上 11:1）
        danger: 'rgb(var(--c-danger) / <alpha-value>)',

        // ─────────────────────────────────────────────────────────────
        // 深色场景表面（登录页 / 夜间自习）。2026-09-22 视觉批三。
        //
        // 为什么是这套：深色场景的层次必须靠**表面明度**建立，不能靠
        // 半透明玻璃叠加——玻璃会让正文对比度随背景浮动，夜间尤其伤读。
        // 底色取带蓝调的 off-black 而非纯黑：纯黑会把所有阴影与描边吃掉，
        // 页面塌成一片。每个值右侧标注其在 dusk-base 上的实测对比度。
        // ─────────────────────────────────────────────────────────────
        'dusk-base': '#070C14',     // 页面底（off-black 带蓝调，非纯黑）
        'dusk-surface': '#111A26',  // 抬升表面：表单外壳、面板
        'dusk-raised': '#18222F',   // 再上一层：展示块、次级按钮
        'dusk-line': '#26374A',     // 边框与分隔线
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
        'dusk-title': '#E8EEF4',    // 标题 / 正文强调
        'dusk-body': '#B8C4D0',     // 正文
        'dusk-muted': '#7A8798',    // 次要文字（勿用在 raised 表面）
        'dusk-faint': '#5A6675',    // 仅限非文本装饰

        // 深色底上的品牌色：与 primary **同色相**（COLOR CONSISTENCY LOCK：
        // 全站只有一个强调色），仅提亮以在深底上达到 AA。
        // 与之相对，登录页此前用的 #67E8F9 / #4EA8FF / #6FE9B4 是另起的三套蓝绿，
        // 与内页 primary 不是同一个颜色家族 —— 已废弃。
        'primary-lift': '#6FB3D4',  // 深底上的主色（8.5:1，可安全承载按钮文字）
        'primary-press': '#3D7E9E', // 主色按下态
      },

      // ── 圆角刻度（SHAPE CONSISTENCY LOCK）─────────────────────────
      // 一个页面只允许一套圆角规则，且必须有依据。旧的 rounded-[22px]/[26px]
      // 是随手写的，已删除。三档对应三种层级职责：
      //   control — 按钮、输入框、分段项（用户直接操作的件）
      //   surface — 面板、卡片、信息块（承载内容的件）
      //   shell   — 页面级最大外壳（登录表单容器）
      borderRadius: {
        control: '10px',
        surface: '16px',
        shell: '20px',
      },

      boxShadow: {
        // 卡片抬升：同样走主题变量。
        //
        // 为什么阴影也必须变量化：浅色的 card 阴影是 rgba(34,48,58,…) 的冷灰，
        // 投在深色底上等于没画——深色里的「抬起」靠的是上缘 1px 内高光 + 更深的外羽化，
        // 不是把浅色阴影照搬过来。变量值见 src/index.css。
        card: 'var(--shadow-card)',
        // 真正浮起的层（2026-09-25 视觉重构 P1a）：对话框、下拉、图谱节点明细卡、
        // 返回顶部按钮。收敛前这些位置用的要么是 shadow-card（与静态卡片同档，
        // 层级没有差别），要么是 Tailwind 内置 shadow-lg —— 而内置阴影是固定
        // 的黑色 rgba，深色主题下完全看不见，这是真实缺陷。
        overlay: 'var(--shadow-overlay)',
        // 深色场景：阴影带蓝调（跟着底色走，不用纯黑）、有 y 偏移与柔和羽化。
        // 首段 inset 是 1px 内高光边，用来给深色表面一个可感知的上边缘——
        // 这是边缘定义，不是外发光；零偏移的彩色外发光属装饰，一律不用。
        //
        // 首版的表面明度差只有 1.06:1、边框 1.34:1（实测渲染值），卡片和底色糊在一起。
        // 深色界面的表面层次本来就窄，必须把「表面明度 + 边框 + 内高光」三件事一起抬，
        // 单靠任何一件都不够——现取值为：表面 1.12:1、边框 1.62:1。
        'dusk-surface':
          '0 1px 0 0 rgba(255,255,255,0.07) inset, 0 18px 44px -20px rgba(2,6,14,0.85)',
        'dusk-raised': '0 1px 2px rgba(2,6,14,0.55), 0 10px 26px -14px rgba(2,6,14,0.7)',
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
