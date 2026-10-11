知微 · 移动端适配（修破绽深度，桌面像素级零变化）实施计划
=================================================
计划编号：01_PLAN（第 6 版：移动端适配）
编写日期：2026-09-24 20:47
编写角色：planner（只读规划，implementer 严格照办；执行歧义按「二、决策记录」裁决）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD 位于 tempdeploy 分支（rev-list --count HEAD = 90）。工作区他人未提交变更：
      M tools/e2e-smoke.cjs（Edge 路径 + --no-sandbox，本计划 B0 会参考其 CDP 模式，不改回、不提交回退）、
      ?? _pipeline/PR-tempdeploy.md、?? 知微-项目介绍.md —— 本计划不碰、不回退（延续上版 D13）。
归档：旧计划已先复制归档为 _pipeline/archive/01_PLAN_20260924_2047.md（md5 e18ebf49… 两份一致，
      归档只增不删），然后才覆写本文件。
需求边界（总控已拍板，不再提问）：
  · 深度 = 修破绽，桌面（≥768px）渲染像素级零变化；不做手机优先重构、不做报告表格卡片化、
    不做图谱移动端独立视图。
  · 顶栏收纳 = 汉堡抽屉（手机上顶栏只留「知微」+ 汉堡键；抽屉承载全部导航项 + 主题键 + 空间切换）。
  · README 由总控另案负责，不在本计划范围（D13）。
提问纪律：总控已声明不接受中途提问 → 全部歧义以 D 编号自行裁决留痕。无阻塞项。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL：vitest 一律分批；git diff 一律 --no-pager；
    dev server / 后端可 run_in_background 存活（实测），走查脚本按宽度分档跑防超时。

-------------------------------------------------
一、目标与验收清单（逐条可勾选）
-------------------------------------------------
[ ] 1.【第一验收项】1440px（及 768/1024 档）桌面渲染像素级不变：用 tools/responsive-audit.cjs
       采集「改造前基线」与「改造后」两份几何 JSON（每页顶栏/正文/首卡片 getBoundingClientRect +
       字号采样），对比 ≥768 档全部几何项 diff = 0px，另附前后截图供人工复核（B0 采基线、B6 复测）。
[ ] 2. 断点单一定义：tailwind.config.js 具名断点 nav:'720px'；全站 min-[720px]/max-[720px]
       任意值断点清零（grep 0 行）；新增静态测试锁死（见「七、」）。
[ ] 3. 375/414 档：顶栏只显示「知微」+ 汉堡键；抽屉可开合（背景幕/Esc/点导航项收起/焦点归还），
       内含全部 navRoutes() 项 + 主题切换 + 空间切换（含新建/管理入口）。
[ ] 4. 375/414 档每页 documentElement.scrollWidth === clientWidth（图谱页容器、报告页表格容器
       这两处「有意横向滚动」的内部区域除外，见 D7/D8）。
[ ] 5. 触控目标 <720 一律 ≥36px（max-nav: 作用域，桌面不变，D6）。
[ ] 6. 长串（file_id / attribution_id / 行内 code）不再撑破容器（break-all / break-words 落位）。
[ ] 7. 安全区：viewport-fit=cover + env() 工具类单一来源（index.css）；BackToTop/Toast/面板输入区/
       抽屉底避让刘海与 home indicator；桌面非刘海设备 env()=0 → 数值不变。
[ ] 8. Layout 地址栏伸缩不跳动（min-h-screen → min-h-dvh，与 LoginPage 统一）。
[ ] 9. 测试全绿且分批可跑：packages / functions/api/tests / apps/web/tests 三条各 exit 0；
       tsc 三段 exit 0；build:web 通过。
[ ] 10. 不碰业务红线：answer/solution_steps 不下发、算法参数零硬编码、令牌体系（颜色/圆角/阴影/
       z-index）不引入组件内裸值（本轮反而清掉 3 处既有裸 z 值，见 D12）。

-------------------------------------------------
二、决策记录（歧义自行裁决，D 编号留痕）
-------------------------------------------------
D1 断点命名与取值：nav:'720px'（theme.extend.screens）。理由：TopNav 现有 2 处
   max-[720px]:hidden 与 ChatPage 两栏切换的 min-[720px] 已在用 720；720 落在 sm(640) 与
   md(768) 之间，正是「顶栏收纳/双栏切换单栏」的现役分界，改取其他值反而引入新行为漂移。
D2 sm:/lg: 保留 Tailwind 标准刻度、不并入 nav:。理由：它们不是散落的魔法数字（默认刻度本身
   即集中定义）；若强行替换，lg:grid-cols-3(1024→720) 会让 768–1023 变三列、sm:*(640→720)
   会改 640–719 行为——前者直接违反硬约束 1。「单一来源」的落点是：消灭任意值断点 +
   具名断点进 config + 测试禁止清单锁死再犯（见「三、」与 breakpoints.test.ts）。
D3 抽屉开合状态用 store（新建 apps/web/src/stores/mobileNav.ts，仿 stores/chatPanel.ts 先例），
   不用组件态。理由：Layout 随路由切换重挂载会丢组件态（chatPanel.ts 文件头已论证过同一问题），
   且互斥逻辑（D4）需要跨 store 读写。
D4 抽屉与右侧对话面板互斥、单向调度：<720 时面板唯一打开路径是抽屉内的「对话辅导」按钮，
   该按钮 onClick 先 mobileNav.setOpen(false) 再 chatPanel.setOpen(true)；mobileNav 的
   open/toggle action 内部再调 useChatPanelStore.getState().setOpen(false) 兜底（面板开着时
   开抽屉 → 关面板）。桌面（≥720）抽屉永不渲染（nav:hidden），无双向需求；避免两 store 互相
   import 造成循环依赖。二者同为 z-overlay，互斥后不会同屏，不存在层叠竞争。
D5 抽屉为全高覆盖式（fixed inset-0 z-overlay，从右滑入，覆盖 TopNav——z-nav 40 < z-overlay 50
   天然被盖），自带头部（标题 + 关闭键），不与顶栏并排。理由：顶栏 56px 内塞第二排导航没有
   空间；全高抽屉是「汉堡抽屉」的标准形态，也回避了 top:56px 与安全区 top 叠加计算的复杂度。
D6 触控目标放大一律加 max-nav: 前缀（如 max-nav:min-h-9）。理由：硬约束 1（桌面像素零变化）
   优先于触控目标；不加作用域的 min-h-9 会改变桌面按钮高度即违约。
D7 图谱保持 minWidth ≥720 + overflow-x-auto 横向滚动，不改小、不做独立移动视图。理由：
   LOOKATME 设计固化项明文「窄屏：图谱最小宽 720 并横向滚动」，20 节点压进 327px 不可读；
   本轮只补容器尺寸变化的重绘（ResizeObserver，见「五、」R2）。
D8 报告页表格保持 min-w-[420px] + overflow-x-auto。总控已拍板不做卡片化；横向滚动是既有
   接受形态，验收按「容器内允许横滚、页面级不允许溢出」口径。
D9 窄档页边距：TopNav nav（TopNav.tsx:88）与 Layout main（Layout.tsx:128）的 px-6 同步改为
   「px-4 nav:px-6」——必须两处同步，否则破坏「内容列与顶栏共用同一条左基线」不变量；
   ≥720 仍为 px-6（桌面零变化）。LoginPage 是 bare 外壳且居中布局，不动。
D10 index.css 滚动条 10px 不动。理由：改它会影响桌面出现滚动条时的 clientWidth，属像素级
   变化风险；且走查脚本用 --hide-scrollbars，改了也测不到收益。
D11 PageSkeleton.tsx:37/46 的 Bar prop 传反纳入本轮（B3 批）。planner 实测判定：当前渲染
   className 为 " h-5 w-40 bg-line rounded-md"（height 空串 + tone 含全部类），类集合与修正后
   完全一致 → 视觉零变化，属「语义误用但渲染等价」的破绽，修正 = tone 只放底色、height 放尺寸。
D12 顺带令牌化 3 处既有裸 z 值：Toast.tsx:38 z-50→z-overlay、ConfirmDialog.tsx:32 z-50→
   z-overlay、BackToTop.tsx:30 z-40→z-nav。数值相同（50→50、40→40）→ 像素零变化，属令牌
   纪律清偿，非新改动。
D13 README 不在本计划范围（总控另案）。知微-项目介绍.md 为他人未提交文件，不碰。
D14 安全区方案：加 index.css @layer utilities 工具类（单一来源），组件只用类名、不写内联
   style、不引依赖。具体类名见「六、」。
D15 未登录不渲染汉堡键：未登录顶栏只有品牌 +「学习伴侣」文案（TopNav.tsx:230），无导航可
   收纳；登录页走 bare 外壳天然不进 Layout。
D16 720–767 区间保持现状顶栏（不收纳）。理由：硬约束 1 的桌面下限是 768；且收纳边界若取
   768 会与 ChatPage 既有的 720 双栏切换错位（D1），扩面收益低、回归风险高。
D17 背景处理用「全屏背景幕 button + 正文容器 aria-hidden + role=dialog aria-modal + 焦点
   陷阱」，不使用 inert。理由：React 18 对 inert 布尔属性支持不完整（需 inert="" 变通），
   背景幕已拦截指针、焦点陷阱拦截键盘、aria-modal 声明读屏语义，三条路径已闭合。

-------------------------------------------------
三、断点单一定义与替换清单
-------------------------------------------------
3.1 定义（apps/web/tailwind.config.js，theme.extend 内新增，位于 colors 之前）：
      screens: {
        // 导航收纳断点（单一来源）：<720 顶栏收进汉堡抽屉、ChatPage 双栏切单栏。
        // 取 720：与 TopNav 既有 2 处 max-[720px] 与 ChatPage 两栏切换同值（D1/D2）。
        nav: '720px',
      },
    生效后自动获得 nav:*（min-width:720px）与 max-nav:*（max-width:719.98px）两组变体，
    语义与被替换的任意值写法逐像素一致。
3.2 替换清单（planner 2026-09-24 20:47 实测行号，共 3 处任意值断点）：
      1) apps/web/src/components/TopNav.tsx:101  max-[720px]:hidden → max-nav:hidden
      2) apps/web/src/components/TopNav.tsx:163  max-[720px]:hidden → max-nav:hidden
      3) apps/web/src/pages/ChatPage.tsx:98
         min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] → nav:grid-cols-[…同值…]
3.3 保留不动（Tailwind 标准刻度，D2；列出仅为把「现状混用」清点闭环）：
      GraphPage.tsx:269 sm:p-0；:273 sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:mb-0；
      LoginPage.tsx:198 sm:text-[42px]；ConsoleHomePage.tsx:173 sm:grid-cols-4；
      ConsoleHomePage.tsx:217 sm:grid-cols-2 lg:grid-cols-3。
      （planner 实测 sm: 共 8 处、lg: 共 1 处，与审计口径 9/1 相差 1 处为 GraphPage:269 的
       计法差异，无实质影响。）
3.4 禁止清单（由 breakpoints.test.ts 静态锁死，见「七、」）：
      · src/** 不允许再出现任意值**断点变体** /(?:min|max)-\[\d+px\]:/（判别特征 = 中缀
        任意值后紧跟冒号，如 max-[720px]:hidden；注意与 min-w-[420px] 这类宽度工具类
        区分——后者无冒号后缀，是合法保留项，ReportPage 的两处 min-w-[420px] 不在禁列）；
      · src/** 不允许 z-[ 任意值 z-index；
      · src/** 的 JSX className 字面量属性不允许裸 hex（当前实测 0 处，保持 0；
        令牌源 bands.ts/theme.ts、LoginPage 既有 ERROR_TEXT 常量、ECharts 画布色为
        合法白名单，见 7.1 ④）；

-------------------------------------------------
四、汉堡抽屉（MobileNav）设计
-------------------------------------------------
4.1 新增文件：
      · apps/web/src/components/MobileNav.tsx（抽屉组件）
      · apps/web/src/stores/mobileNav.ts（开合切片，仿 chatPanel.ts：open=false /
        setOpen / toggle，会话级不落盘）
4.2 顶栏改造（apps/web/src/components/TopNav.tsx，桌面 ≥720 渲染逐像素不变——
    新增的全部是响应式类，≥720 不生效）：
      · :103 的 nav <ul> 容器加 max-nav:hidden；
      · :142 <ThemeToggle /> 外层（或组件自身根元素）加 max-nav:hidden；
      · :145 空间胶囊容器 div 加 max-nav:hidden；
      · nav 容器（:88）尾部新增汉堡键：
        <button id="mobile-nav-toggle" type="button" onClick={toggle}
          aria-expanded={open} aria-controls="mobile-nav-drawer"
          aria-label={open ? '关闭导航菜单' : '打开导航菜单'}
          className="nav:hidden ml-auto grid h-9 w-9 place-items-center rounded-control
                     border border-line text-ink-soft hover:bg-raised">（三横线 SVG，
          stroke=currentColor，与 ThemeToggle 同款线框风格）
      · 顶栏 nav 的 px-6 → px-4 nav:px-6（D9，与 Layout main 同步）。
4.3 抽屉结构（MobileNav.tsx）：
      根：<div className="fixed inset-0 z-overlay nav:hidden">
        ├ 背景幕：<button aria-label="关闭导航菜单" className="absolute inset-0 bg-canvas/60"
        │          onClick={close}/>（与 ChatPanelDock 背景幕同款写法）
        └ <aside id="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="导航菜单"
             tabIndex={-1}
             className="absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col
                        border-l border-line bg-surface shadow-card">
             ├ 头部：标题「菜单」+ 关闭键（h-9 w-9，aria-label="关闭导航菜单"）
             ├ 滚动区（overflow-y-auto）：① navRoutes() 全部 6 项列表
             │   （测评/对话辅导/知识图谱/学习报告/云盘/我的）——NavLink 沿用 active 样式
             │   bg-accent-veil text-accent，每项 min-h-11 px-4 py-2.5 text-sm（触控 ≥44px）；
             │   「对话辅导」特判为 button（与 TopNav 同款 aria-pressed），onClick =
             │   先关抽屉再开面板（D4）；② 分隔线；③ 主题切换行（<ThemeToggle /> + 文字
             │   「深浅主题」标签）；④ 分隔线；⑤ 空间区：当前空间名、空间列表（每项
             │   min-h-9，active 样式同 TopNav 弹层）、「+ 新建空间」（原地展开
             │   <SpaceCreateForm compact />，成功后收起）、「管理空间」Link
             │   （复用 TopNav :169-226 弹层的内容逻辑，平铺不套 popover）
             └ 底部 pb-safe（安全区，见「六、」）
4.4 开合与路由联动：
      · 抽屉内所有导航 Link / 按钮 onClick 先 setOpen(false)（点导航项自动收起）；
      · 另用 useEffect 订阅 useLocation().pathname，变化即 setOpen(false)（兜底浏览器后退
        与键盘导航）。
4.5 无障碍（D17）：
      · 打开时：焦点移入 aside（ref.focus()）；关闭时：焦点归还
        document.getElementById('mobile-nav-toggle')；
      · Esc 关闭（useEffect keydown，与 ChatPanel.tsx:34-40 同款实现）；
      · Tab 焦点陷阱：keydown 拦截 Tab/Shift+Tab，在 aside 内可聚焦元素首尾循环；
      · 抽屉打开期间给 Layout 正文外层（Layout.tsx:127 的让位 wrapper）加 aria-hidden；
      · 背景幕为全屏 button，指针路径已被拦截。
4.6 挂载与互斥：
      · MobileNav 挂在 Layout（TopNav 之后、ChatPanelDock 之前），token 存在才渲染
        （D15——实际由 TopNav 汉堡键控制入口，组件内部再判 useAuthStore token 兜底）；
      · 互斥见 D4；ChatPanelDock 自身逻辑零改动（<720 本就是覆盖抽屉 + 背景幕）。
4.7 层叠关系（终局口径）：
      TopNav z-nav(40) < 抽屉/面板 z-overlay(50) < Toast z-toast(60)。
      手机上抽屉与面板互斥不同屏；Toast 永远最上（现状语义保留）。

-------------------------------------------------
五、逐风险点处置方案（文件:行 → 改法 → 理由）
-------------------------------------------------
R1 顶栏挤压（TopNav.tsx:88/103）→ 见「四、」汉堡抽屉整体方案。理由：375px 塞不下
   品牌+6 Tab+主题+胶囊，收纳是唯一不破坏桌面的解。
R2 图谱不随容器重绘（GraphPage.tsx:193-194 只监听 window.resize）：
   → 在图表 useEffect 内新增 ResizeObserver，observe(containerRef.current)，回调
     chart.resize()；卸载时 observer.disconnect()（与 window resize 监听并存）。
   理由：面板开合挤压正文列时 window 不 resize，图表白边/裁切；ResizeObserver 是容器
   尺寸变化的标准信号。图谱 minWidth 720 保持（D7）。
R3 输入区按钮压扁（chat/ChatComposer.tsx:88 容器 flex 不换行、按钮无 shrink-0）：
   → :88 容器加 flex-wrap；:97 传图读题与 :106 发送两按钮加 shrink-0；
     :89 textarea 加 min-w-[min(100%,12rem)]。
   理由：窄屏放不下时按钮换行而非压缩；≥720 空间充裕不触发 wrap、min-w 已满足 →
   桌面像素零变化。
R4 外壳高度跳动 + 页边距（Layout.tsx:122 min-h-screen；:128 px-6）：
   → :122 min-h-screen → min-h-dvh（与 LoginPage.tsx:182 统一，桌面 dvh==vh 零变化；
     目标浏览器为现代 Chromium/Safari，项目已有 dvh 先例）；
   → :128 px-6 → px-4 nav:px-6，与 TopNav:88 同步（D9，左基线不变量）。
R5 报告表格（ReportPage.tsx:186/226）→ 不改（D8：横向滚动为既有接受形态；页面级溢出
   由 R6 类修复 + 走查验证兜底）。
R6 长串撑破容器（全项目 break-all/break-words 0 处）：
   → DrivePage.tsx:106 {file.file_id} 所在 p 加 break-all（同文件 :105 name 已 truncate）；
   → PaperPage.tsx:368 {file.file_id} 所在 p 加 break-all；
   → AttributionPage.tsx:247 归因编号行加 break-all；
   → chat/ChatMessageList.tsx:52 学生气泡外层与 :56 气泡内层加 break-words（保留
     whitespace-pre-wrap）；
   → chat/ChatMessageList.tsx:76 「已带题图（演示态 · {imageFileId}）」span 加 break-all；
   → lib/richText.tsx:52 行内 <code> 加 break-all；:117 段落 p（whitespace-pre-wrap）加
     break-words。
   理由：ID 是无空格长串，break-all 是唯一不溢出的断行方式；桌面本就不溢出，零视觉变化。
R7 flex 行不换行（两按钮组等）：
   → AttributionPage.tsx:537、:571、:646 加 flex-wrap；
   → AttributionPage.tsx:663-678 容器加 flex-wrap + gap-3，第二个按钮 :675 的 ml-3 删除
     （gap-3=12px 与 ml-3=12px 同值 → 桌面间距像素不变）；
   → PaperPage.tsx:209、:322 加 flex-wrap；
   → SelfReportPage.tsx:83 加 flex-wrap；
   → AssessmentPage.tsx:238 加 flex-wrap；
   → SpacesPage.tsx:108 卡片头 div 加 flex-wrap（标题+徽标+右侧按钮在窄屏换行堆叠）。
   理由：flex-wrap 在空间充裕时不改变排布 → 桌面零变化；窄屏按钮掉到第二行可用。
R8 触控目标 <36px（全部 max-nav: 作用域，D6）：
   → GraphPage.tsx:289-296 关闭「×」：className 加
     "max-nav:grid max-nav:h-9 max-nav:w-9 max-nav:place-items-center"；
   → chat/ChatPanel.tsx:55「全屏打开」与 :64 关闭键：加 max-nav:min-h-9；
   → components/Toast.tsx:57「知道了」：加 max-nav:min-h-9；
   → chat/ChatComposer.tsx:69 文件项按钮：加 max-nav:min-h-9；
   → AttributionPage.tsx:340「反驳一下」：加 max-nav:min-h-9；
   → TopNav.tsx:114/129/154/182：<720 已收进抽屉，抽屉内项自设 min-h-9/min-h-11，
     顶栏原项不再触屏可达，无需另改。
   理由：硬约束 1 与触控目标的冲突解法就是「只在 <720 生效」。
R9 安全区（viewport 缺 viewport-fit=cover；BackToTop/Toast 未避让）→ 见「六、」。
R10 index.css 缺 overscroll-behavior / touch-action → 见「六、」；滚动条 10px 不动（D10）。
R11 骨架 prop 传反（PageSkeleton.tsx:37/46）：
   → <Bar tone="bg-line" height="h-5 w-40" /> 与 <Bar tone="bg-line/80" height="h-4 w-32" />
     （:39/:40/:48/:49 的正确用法不动）。
   理由：D11——渲染等价的语义修正，零视觉变化，属「修破绽」范畴。
R12 裸 z 值（D12）：Toast.tsx:38 z-50→z-overlay；ConfirmDialog.tsx:32 z-50→z-overlay；
   BackToTop.tsx:30 z-40→z-nav。数值相同，像素零变化。

-------------------------------------------------
六、安全区与全局 CSS 方案（D14：index.css 工具类单一来源）
-------------------------------------------------
6.1 apps/web/index.html:8：
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    （只追加 viewport-fit=cover，其余属性不动。）
6.2 apps/web/src/index.css 新增（@layer utilities，全部带 0px 兜底；桌面非刘海设备
    env() 恒为 0 → 与原值逐像素相同）：
      @layer utilities {
        /* 安全区工具类（单一来源）：Tailwind 无内置 safe-area 工具，统一在这里定义，
           组件不得写内联 style 或 env() 任意值。基础值与被替换的 Tailwind 类同值：
           6=1.5rem、4=1rem、16=4rem、3=0.75rem。 */
        .pt-safe { padding-top: env(safe-area-inset-top, 0px); }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
        .bottom-safe-6 { bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem); }
        .right-safe-6 { right: calc(env(safe-area-inset-right, 0px) + 1.5rem); }
        .top-safe-16 { top: calc(env(safe-area-inset-top, 0px) + 4rem); }
        .right-safe-4 { right: calc(env(safe-area-inset-right, 0px) + 1rem); }
        .pb-safe-3 { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem); }
      }
6.3 应用点（连同被替换的定位类一起改，桌面数值不变）：
      · BackToTop.tsx:30：bottom-6 right-6 → bottom-safe-6 right-safe-6；
      · Toast.tsx:38：top-16 right-4 → top-safe-16 right-safe-4；
      · chat/ChatPanel.tsx:94 输入区容器：pb-3 → pb-safe-3（<720 面板为覆盖抽屉时避让
        home indicator；≥720 pb 值不变 12px）；
      · MobileNav 抽屉滚动区底部：pb-safe。
6.4 index.css 全局行为（@layer base 的 html 段追加；只影响滚动/触摸行为，不产生任何
    布局或像素变化）：
      html { overscroll-behavior-y: none; }   /* 消 rubber-band / 下拉刷新误触 */
      @media (pointer: coarse) {
        button, a, [role='button'] { touch-action: manipulation; }  /* 去双击缩放延迟 */
      }
    （touch-action 包在 pointer: coarse 里，桌面鼠标环境零影响。）

-------------------------------------------------
七、测试计划（新增 2 个测试文件，预计 11 用例）
-------------------------------------------------
7.1 新增 apps/web/tests/breakpoints.test.ts（静态源码扫描，仿 stages.test.ts「直接读
    源文件核对」先例；node:fs 读文本 + 正则断言）：
      ① 读 apps/web/tailwind.config.js（文本解析或 import），断言含 nav: '720px'
        的 screens 定义；
      ② 递归扫描 apps/web/src/**/*.tsx 与 *.ts：断言无 /(?:min|max)-\[\d+px\]:/（任意值
        断点变体禁止清单，3.4；必须带冒号后缀，避免误伤 min-w-[420px] 这类宽度工具类）；
      ③ 同上扫描：断言无 'z-['；
      ④ 扫描 JSX 里的 className 字面量属性（/className="[^"]*#[0-9a-fA-F]{3,8}/）：断言 0 处
        （planner 实测当前 0 处）。⚠ 口径说明：仅限字面量属性——LoginPage.tsx:51 的
        ERROR_TEXT 常量（text-[#FFB088]，注释实测 11.0:1 的深底既有色）、theme/bands.ts
        与 stores/theme.ts（令牌源本身）、GraphPage 的 ECharts 画布回退色，均属**合法
        保留**，不在断言范围，测试注释里写明白名单边界；
      ⑤ 读 apps/web/index.html：断言 viewport 含 viewport-fit=cover；
      ⑥ 读 apps/web/src/index.css：断言含 overscroll-behavior、touch-action 与
        .pb-safe 定义；
      ⑦ 读 apps/web/src/components/Layout.tsx：断言含 min-h-dvh 且无 min-h-screen。
      预计 7 用例。
7.2 新增 apps/web/tests/mobileNav.test.ts（纯逻辑，仿 chatPanel.test.ts）：
      ① 初始 open === false；setOpen(true) / toggle() 状态机正确；
      ② 互斥：mobileNav.setOpen(true) 后 useChatPanelStore.getState().open === false；
      ③ 互斥兜底：先 chatPanel.setOpen(true) 再 mobileNav.toggle() → chatPanel 关、
        mobileNav 开；
      ④ 不落盘：store 状态不写 localStorage（键集不变）。
      预计 4 用例。
7.3 不新增组件渲染测试：现有 14 个前端测试文件全为逻辑/静态单测，无 jsdom 组件渲染
    先例；抽屉的交互正确性由「八、」真浏览器走查覆盖（B6），不为本轮破例引渲染测试栈。
7.4 基准数字：前端 139 → 预计 150；全仓 351 → 预计 362。既有测试零改动预期
    （routerGuard 的 12 页/6 导航断言不受影响——ROUTES/navRoutes 数据零改动，与上轮
    F3 同口径）。
7.5 分批测试命令（每条独立跑，勿合并防 60s 被杀）：
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests

-------------------------------------------------
八、自检闸门与窄屏走查方案
-------------------------------------------------
8.1 每批改完必跑（全部命令原样可执行）：
      # 类型检查三段（各自独立一条）
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      # 测试三批
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      # 前端构建
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
8.2 静态复核（B1 后每次必跑，期望全部无匹配行；正则带冒号后缀，只命中断点变体，
     不误伤 min-w-[420px]）：
      grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src ; echo "exit=$?"
      grep -rn "z-\[" apps/web/src ; echo "exit=$?"
      grep -rn "min-h-screen" apps/web/src/components/Layout.tsx ; echo "exit=$?"
8.3 真浏览器走查（本机仅 Microsoft Edge；参考 tools/e2e-smoke.cjs 的 CDP 模式：
    Edge 路径 /Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge、
    --headless=new --no-sandbox --hide-scrollbars、零依赖 CDP 类直接复用其写法）：
   8.3.1 新增 tools/responsive-audit.cjs（B0 产出，不改 e2e-smoke.cjs）：
      · 环境变量：ZHIWEI_AUDIT_BASE（默认 http://127.0.0.1:5173）、
        ZHIWEI_AUDIT_OUT（默认 _pipeline/screenshots/mobile）、ZHIWEI_AUDIT_TAG、
        ZHIWEI_AUDIT_WIDTHS（逗号分隔，必填——为绕 60s 限制按档分跑）；
      · 流程：起 Edge CDP → 复用 e2e-smoke 的注册/登录 eval 拿 token → 逐宽度档
        （Emulation.setDeviceMetricsOverride，deviceScaleFactor=1，mobile 视宽度而定）→
        逐路由（12 页：/login /self-report /spaces /console /assessment /paper /chat
        /attribution /graph /report /drive /me）→ 每页采集：
        a) document.documentElement.scrollWidth vs clientWidth 溢出量；
        b) 溢出元素清单（querySelectorAll('*') 中 getBoundingClientRect().right >
           innerWidth+1 的前 10 个：tag+class 片段）；
        c) 几何锚点 getBoundingClientRect：header、header nav、main、main 首个子卡片
           （各页统一取 main 内第一个 border 卡片），另采 getComputedStyle 采样字号；
        d) 截图 PNG。
      · 输出：<OUT>/audit-<tag>-<width>.json + <tag>-<width>-<route>.png；
      · 对比模式 --compare <tagA> <tagB>：逐页逐锚点 diff，≥768 档任一项 ≠0 即列出并
        exit 1（这是验收项 1 的判据）。
   8.3.2 走查执行序（服务先起，run_in_background 可存活）：
      # 起服务（两条后台）
      $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
      $NODE functions/api/dist/server.js            # 后台 :8787
      $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts   # 后台 :5173
      # 改造前基线（B0，四档分四条命令跑）
      $NODE tools/responsive-audit.cjs --tag baseline --widths 1440
      $NODE tools/responsive-audit.cjs --tag baseline --widths 1024
      $NODE tools/responsive-audit.cjs --tag baseline --widths 768
      $NODE tools/responsive-audit.cjs --tag baseline --widths 414,375
      # 改造后复测（B6，同四条，tag=after）
      $NODE tools/responsive-audit.cjs --tag after --widths 1440
      $NODE tools/responsive-audit.cjs --tag after --widths 1024
      $NODE tools/responsive-audit.cjs --tag after --widths 768
      $NODE tools/responsive-audit.cjs --tag after --widths 414,375
      # 桌面像素级零变化判据（≥768 三档逐页逐锚点 diff=0）
      $NODE tools/responsive-audit.cjs --compare baseline after --widths 1440,1024,768
      # （--compare 内部排除本就变化的白名单：无——本轮要求 ≥768 全量零 diff）
   8.3.3 窄档人工复核点（375/414 截图逐页过一遍）：抽屉开/合/Esc/背景幕/焦点归还、
      输入区换行、图谱横滚、报告表横滚、Toast/BackToTop 避让。
8.4 走查超时预案：单档 12 页 ×（导航 0.7s + 采样）约 25–40s，贴近 60s 上限；若被杀，
   把 --widths 拆成单值逐条跑（375 与 414 必须分开时用 ZHIWEI_AUDIT_WIDTHS=375）。

-------------------------------------------------
九、批次切分（每批可独立提交、独立回滚；B0 必须最先——基线要先于任何改动采集）
-------------------------------------------------
B0 走查工具与桌面基线（不改任何业务代码）
    涉及：tools/responsive-audit.cjs（新增）；_pipeline/screenshots/mobile/（产物入库）
    做什么：写工具 → 起服务 → 采 baseline 四档 JSON+截图 → commit
    commit 草稿：「走查: 新增响应式走查工具 responsive-audit.cjs（Edge CDP，12 页 × 4 档
      宽度采溢出量/溢出元素/几何锚点），并采集改前基线（1440/1024/768/414/375）」
B1 断点与令牌单一来源
    涉及：apps/web/tailwind.config.js、src/components/TopNav.tsx（:101/:163 两处替换）、
    src/pages/ChatPage.tsx（:98 替换）、src/components/Toast.tsx（z 令牌化 + 安全区定位）、
    src/components/ConfirmDialog.tsx（z 令牌化）、src/components/BackToTop.tsx（z 令牌化 +
    安全区定位）、index.html（viewport-fit）、src/index.css（utilities + 全局行为）、
    apps/web/tests/breakpoints.test.ts（新增）
    commit 草稿：「移动端批1: 断点单一定义——tailwind 具名断点 nav:720px，替换 3 处任意值
      断点；3 处裸 z 值令牌化(z-40→z-nav/z-50→z-overlay)；viewport-fit=cover + 7 个安全区
      工具类 + overscroll/touch-action；新增 breakpoints.test.ts 静态闸门 7 用例」
B2 汉堡抽屉
    涉及：src/components/MobileNav.tsx（新增）、src/stores/mobileNav.ts（新增）、
    src/components/TopNav.tsx（max-nav:hidden 收纳 + 汉堡键 + px）、src/components/Layout.tsx
    （挂载 + 正文 aria-hidden）、apps/web/tests/mobileNav.test.ts（新增）
    commit 草稿：「移动端批2: 顶栏汉堡抽屉——<720 顶栏只留「知微」+汉堡键，抽屉（z-overlay
      全高右滑）承载 6 导航项+主题+空间切换；stores/mobileNav.ts 会话级开合、与对话面板互斥；
      Esc/背景幕/焦点陷阱/焦点归还/aria-modal 齐备；≥720 顶栏渲染逐像素不变；新增 4 用例」
B3 布局与断行破绽
    涉及：src/components/Layout.tsx（min-h-dvh + px）、src/components/chat/ChatComposer.tsx、
    src/components/chat/ChatMessageList.tsx、src/lib/richText.tsx、src/pages/DrivePage.tsx、
    src/pages/PaperPage.tsx、src/pages/AttributionPage.tsx（break-all + flex-wrap）、
    src/pages/SelfReportPage.tsx、src/pages/AssessmentPage.tsx、src/pages/SpacesPage.tsx、
    src/components/PageSkeleton.tsx（prop 修正）
    commit 草稿：「移动端批3: 布局破绽——外壳 min-h-dvh(与登录页统一)、窄档页边距 48→32px
      (顶栏与正文同步保左基线)；输入区按钮 shrink-0+换行；9 处 flex 行补 flex-wrap；
      7 处长串 ID/行内 code 补 break-all/words；PageSkeleton Bar prop 传反修正(渲染等价)」
B4 图谱重绘与触控
    涉及：src/pages/GraphPage.tsx（ResizeObserver + 关闭键 max-nav 触控目标）
    commit 草稿：「移动端批4: 图谱容器 ResizeObserver(面板开合挤压时重绘，window.resize
      保留)；详情卡关闭键 <720 触控目标 16→36px；720 最小宽+横滚保持(D7)」
B5 触控目标与安全区应用
    涉及：src/components/chat/ChatPanel.tsx（min-h-9 + pb-safe-3）、src/components/Toast.tsx
    （min-h-9）、src/components/chat/ChatComposer.tsx（文件项 min-h-9）、
    src/pages/AttributionPage.tsx（:340 min-h-9）
    commit 草稿：「移动端批5: 触控目标补齐——ChatPanel 两键/Toast 知道了/文件项/反驳键
      <720 一律 ≥36px(max-nav 作用域)；面板输入区 pb-safe-3 避让 home indicator」
B6 改后复测、对比与收尾
    涉及：_pipeline/screenshots/mobile/（after 产物）、LOOKATME.md、
    _pipeline/02_EXEC_REPORT.md
    做什么：跑 after 四档 + --compare 三档桌面档 → 全部 diff=0 才算过验收项 1；
      375/414 溢出清单复核（图谱/报告两容器内允许、页面级必须 0）；更新文档实测数字
    commit 草稿：「移动端批6: 走查收尾——改后 12 页 × 5 档复测；1440/1024/768 几何对比
      全量 0px(桌面像素级零变化验收通过)；375/414 页面级溢出清零(图谱/报告容器内横滚除外)；
      LOOKATME/执行报告按实测数字更新」
批次依赖：B0 → B1 → B2 → B3 → B4/B5（可并行文件不重叠，但串行更稳）→ B6。
每批完成即跑 8.1 三段 tsc + 前端 vitest 批（packages/后端批在 B1 与 B6 各全量跑一次即可，
本轮不碰引擎与后端代码）。

-------------------------------------------------
十、风险与回滚
-------------------------------------------------
R1【高】TopNav 改动破坏桌面顶栏（B2 是最大单批）
   回滚：B2 独立 commit，revert 即恢复；B0 基线在手，revert 后可立即 --compare 复核。
   缓解：新增类全部为响应式（≥720 不生效）+ B6 几何对比逐锚点判 0。
R2【高】「桌面像素零变化」被无意破坏（如漏加 max-nav 前缀、flex-wrap 意外在宽屏换行、
   ml-3→gap-3 数值错）
   回滚：定位到具体批次 revert；走查 JSON 会逐页列出 ≠0 的锚点与页面。
   缓解：8.3 的 --compare 是硬闸门，任何一档 ≥768 diff≠0 即 B6 不许收尾。
R3【中】max-nav/nav 类名拼写错误 → 样式静默失效（不报错、只是不生效）
   缓解：B1 的 breakpoints.test.ts 断言 config 定义存在；走查 375 档人工复核抽屉形态。
R4【中】抽屉与面板同时打开（互斥遗漏某条路径）
   缓解：mobileNav.test.ts 互斥两用例 + 8.3.3 人工复核；<720 面板唯一入口是抽屉按钮（D4
   已论证），路径封闭。
R5【中】走查脚本单条命令超 60s 被杀
   缓解：按宽度分档跑（8.3.2 每档一条）；再超时拆到单宽度单条（8.4）。
R6【低】ResizeObserver 在极旧浏览器缺失 → 图表仍靠 window.resize 兜底（监听保留不删），
   行为不劣于现状。
R7【低】dvh 兼容：项目已有 LoginPage min-h-dvh 先例，目标浏览器现代内核；不支持的环境
   丢失的只是外壳最小高（页面内容自然高度仍撑开），不产生布局破坏。
R8【低】PageSkeleton 修正（D11）与 z 令牌化（D12）均为渲染等价改动，revert 无副作用。
回滚总原则：每批独立 commit、互相不混提（AGENT §7）；任何一批出问题单批 revert，
不影响其余批次；_pipeline/archive/ 与 _pipeline/screenshots/ 产物只增不删。

-------------------------------------------------
收尾数字
-------------------------------------------------
涉及文件总数：28
  · 新增 5：MobileNav.tsx、stores/mobileNav.ts、breakpoints.test.ts、mobileNav.test.ts、
    tools/responsive-audit.cjs
  · 修改业务/样式 21：tailwind.config.js、index.html、index.css、TopNav、Layout、Toast、
    ConfirmDialog、BackToTop、PageSkeleton、chat/ChatPanel、chat/ChatComposer、
    chat/ChatMessageList、lib/richText、pages/ChatPage、GraphPage、DrivePage、PaperPage、
    AttributionPage、SelfReportPage、AssessmentPage、SpacesPage（其中 AttributionPage、
    ChatComposer、Toast 跨批各计一次）
  · 文档 2：LOOKATME.md、_pipeline/02_EXEC_REPORT.md（收尾批）
预计新增测试用例：11（breakpoints.test.ts 7 + mobileNav.test.ts 4）
  → 前端 139 → 150，全仓 351 → 362
