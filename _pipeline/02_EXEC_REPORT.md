知微 · 移动端适配（第 6 版计划）执行报告
=========================================
计划文件：_pipeline/01_PLAN.md（473 行，7 个批次 B0–B6、D1–D17 决策记录、R1–R12 风险点）
执行角色：implementer（严格按计划实现；本轮未再提任何问题）
执行时间：2026-09-24 20:57 – 21:54
工作区   ：/Users/Merryou/LearnBuddy/zhiwei    分支：tempdeploy
执行前 HEAD：c085db1（git rev-list --count HEAD = 90）
执行后 HEAD：58121fd（rev-list --count = 96，本轮新增 6 次提交：B0/B1/B2/B3/B4/B5）
归档     ：旧执行报告先复制归档为 _pipeline/archive/02_EXEC_REPORT_20260924_2154.md
            （md5 b36ab9143eeaf7df3110238e2e2ec784，与归档前 _pipeline/02_EXEC_REPORT.md 逐字节一致；归档只增不删）

本报告所有数字均为本次亲自跑出；跑不了的写「未跑 + 原因」，不写「应该 / 预计」。


-------------------------------------------------
零、开工前的行号复核（计划要求）
-------------------------------------------------
计划里 3.2 的替换清单行号是用 Read/Grep 复核过的，实物与计划**完全一致**：
  apps/web/src/components/TopNav.tsx:101  max-[720px]:hidden
  apps/web/src/components/TopNav.tsx:163  max-[720px]:hidden
  apps/web/src/pages/ChatPage.tsx:98      min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]
其余被改点行号同样未漂移：Toast.tsx:38/57、ConfirmDialog.tsx:32、BackToTop.tsx:30、
PageSkeleton.tsx:37/46、ChatPanel.tsx:55/64/94、ChatComposer.tsx:69/88/97/106、
ChatMessageList.tsx:52/56/76、richText.tsx:52/117、DrivePage.tsx:106、PaperPage.tsx:209/322/368、
AttributionPage.tsx:247/340/537/571/646/663-678、SelfReportPage.tsx:83、AssessmentPage.tsx:238、
SpacesPage.tsx:108、Layout.tsx:122/128、GraphPage.tsx:193-194/289-296。
差异只有一处，且是「内容差异」而非行号漂移：计划 7.1④ 引用 LoginPage.tsx:51 的 ERROR_TEXT 常量，
实测在 LoginPage.tsx 内（同文件、常量存在），不影响任何断言。
基线测试数也与计划一致：packages 43 / functions 169 / apps/web 139 = 351。


-------------------------------------------------
一、分批提交（hash 列表）
-------------------------------------------------
7e4d5ce  B0  走查工具 responsive-audit.cjs + 改前基线（7 档，92 个产物入库）
e20d9ba  B1  断点单一定义（nav:720px）+ 3 处任意值断点替换 + 3 处裸 z 令牌化
             + viewport-fit=cover + 7 个安全区工具类 + overscroll/touch-action
             + breakpoints.test.ts（7 用例）
bdaf2e9  B2  汉堡抽屉（MobileNav.tsx + stores/mobileNav.ts）+ 顶栏收纳 + hamburger 键
             + Layout 挂载 / aria-hidden / px + mobileNav.test.ts（4 用例）
d4824f5  B3  布局与断行破绽（flex-wrap ×9、break-all/words ×7、输入区换行、PageSkeleton prop 修正）
dabe075  B4  图谱 ResizeObserver + 详情卡关闭键触控目标
58121fd  B5  触控目标补齐（4 处 max-nav:min-h-9）+ 面板输入区 pb-safe-3
B6      B6 = **本报告所在的提交**（本轮 HEAD）。走查收尾：after 7 档复测 + 桌面 3 档对比全 0
        + 探针 16/16 + compare JSON + LOOKATME.md 与执行报告落盘 + 走查工具改进。
        ⚠ B6 的 hash **故意不写死在这里**：本报告是 B6 的内容之一，每修一次报告 hash 就会变
        （自指问题）。取当前 hash 请看 `git log --oneline -1`；它紧跟在 58121fd 之后。

B6 的产物清单见文末「十一、B6 提交内容」。

每批 commit 均**逐文件 git add 显式路径**（全程未用 git add -A / git add .）。
未入库、未回退的他人未提交变更（保持原样）：tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、
知微-项目介绍.md、_pipeline/01_PLAN.md（planner 写的，我只读不提交不改）、
_pipeline/archive/01_PLAN_20260924_2047.md（planner 的归档产物，我未 stage）。


-------------------------------------------------
二、B0 走查工具与基线（7e4d5ce）
-------------------------------------------------
新增 tools/responsive-audit.cjs（779 行，零依赖，写法沿用 tools/e2e-smoke.cjs 的 CDP 类；
**未改 e2e-smoke.cjs 一个字节**）。
能力：
  · --tag <t> --widths a,b,c   采样：12 路由 × 每档宽度
      采 a) documentElement.scrollWidth - clientWidth（页面级溢出量）
         b) body * 中 getBoundingClientRect().right > clientWidth+1 的前 10 个（tag + class 片段 + right/left/w）
         c) 6 个几何锚点 × 4 维（header / header nav / main / main 首个子元素 /
            main 内首个「有边框且 w≥100 且 h≥40」的卡片 / main 内首个 h1,h2；x,y,w,h 各留 2 位小数）
            + 4 处 getComputedStyle 字号（body / main / 标题 / 顶栏导航项）
         d) 视口截图 PNG
  · --compare <A> <B>          逐页逐锚点 diff；≥768 档任一项 ≠0 即列出并 exit 1
  · --probe-nav                抽屉交互探针（<720 专用取证，见 B2 节）
  · 环境变量、输出路径、退出码均按计划 8.3.1 实现（ZHIWEI_AUDIT_BASE / _OUT / _TAG / _WIDTHS）

工具在 B0 之后有 3 处修复/增强（随 B6 一并提交，见「八、3)」）：
  · goto() 增加「回读 location.href 必须含本次唯一 query」的就位确认（原先只 await loadEventFired，
    会与 about:blank 的加载事件竞争，实测导致 localStorage SecurityError / 打到错误文档）；
  · Page.navigate 失败时打印 errorText（正是它定位出 ERR_CONNECTION_REFUSED 这一环境问题）；
  · 临时 profile 清理改为容忍式 rmQuiet（Edge 退出后残留句柄会让 rmSync 抛 ENOTEMPTY，
    原先会打断进程收尾）。
**基线有效性复核**：改用修复后的 goto 之后，我复核了两套采样的落点 ——
  baseline 84 个页面样本、after 84 个页面样本，`hash` 字段与目标路由 **84/84、84/84 全部一致**
  （0 个样本落在非目标路由），故两套数据同口径可比；B0 的基线虽在修复前采得，落点经此复核无误。

起服务（两条后台）+ 采基线（一档一条命令，按计划 8.4 防 60s 超时）：
  实际命令：$NODE tools/responsive-audit.cjs --tag baseline --widths 1440 / 1024 / 768 / 414 / 375 / 767 / 720
  **其中 767 与 720 是总控要求的补充档，计划 8.3 只列了 1440/1024/768/414/375。**
  每档输出（逐页 0px，节选）：
    1440  12 页 溢出合计 0px   /graph 有 3 个「rect.right > 视口宽」元素、其余 11 页 0
    1024  12 页 溢出合计 0px   /graph 3
     768  12 页 溢出合计 0px   /graph 3
     767  12 页 溢出合计 0px   /graph 3
     720  12 页 溢出合计 0px   /graph 3
     414  12 页 溢出合计 0px   /graph 3、/report 10
     375  12 页 溢出合计 0px   /graph 3、/report 10
  产物：_pipeline/screenshots/mobile/audit-baseline-<width>.json ×7 + baseline-<width>-<route>.png ×84

**基线的重要发现（先于任何改动采到，构成后续一切的对照物）**：
  375/414 档的顶栏**并没有页面级溢出**，而是 6 个 Tab 的文字被压成竖排（每字一行）——
  即「溢出」不是本轮窄屏的主症状，「挤压到不可读」才是（R1 的定性被实测确认）；
  720/767 档顶栏 1 行内容正常容纳、无挤压（见 B6 节的 767/720 结论）。


-------------------------------------------------
三、B1 断点与令牌单一来源（e20d9ba）
-------------------------------------------------
改了 10 个文件：
  1) apps/web/tailwind.config.js
       theme.extend 内、colors 之前新增 screens: { nav: '720px' }（唯一键，带长注释说明 D1/D2
       与「旧写法在恰好 720px 处同时命中」的边界差异预警）。
  2) src/components/TopNav.tsx:101   max-[720px]:hidden → max-nav:hidden（分隔线）
  3) src/components/TopNav.tsx:163   max-[720px]:hidden → max-nav:hidden（空间胶囊文字）
  4) src/pages/ChatPage.tsx:98       min-[720px]:grid-cols-[…] → nav:grid-cols-[…]（值一字未改）
  5) src/components/Toast.tsx:38     z-50 → z-overlay；top-16 right-4 → top-safe-16 right-safe-4
  6) src/components/ConfirmDialog.tsx:32  z-50 → z-overlay
  7) src/components/BackToTop.tsx:30  z-40 → z-nav；bottom-6 right-6 → bottom-safe-6 right-safe-6
  8) apps/web/index.html             viewport 追加 viewport-fit=cover（其余属性不动）
  9) src/index.css                   @layer utilities 新增 7 个安全区工具类（计划 6.2 逐条照抄，
                                     env() 全部带 0px 兜底）；@layer base 的 html 段追加
                                     overscroll-behavior-y: none；新增 @media (pointer: coarse)
                                     下的 button/a/[role=button] { touch-action: manipulation }
 10) apps/web/tests/breakpoints.test.ts（新增，7 用例）

产物 CSS 实测（vite build 后从 dist CSS 里反查，非推断）：
  .nav\:grid-cols-\[…\]  → @media (min-width: 720px)
  .max-nav\:hidden       → @media not all and (min-width: 720px)
  此外 Tailwind 的 container 插件因新增 screen 多产出一条
  @media (min-width: 720px){.container{max-width:720px}} —— 项目里没有任何元素带 class="container"
  （content 扫描命中的是 GraphPage 的 JS 变量名 containerRef / container），故渲染零影响。

7 条静态闸门（breakpoints.test.ts，7 用例）与实跑结果：
  ① screens 只有 nav 键且为 '720px'，且 src/** 里 nav: 与 max-nav: 两侧都真的被用到
  ② src/** 无任意值断点变体 (min|max)-[NNNpx]:   实测 0 处
  ③ src/** 无 z-[                              实测 0 处
  ④ className 字面量属性无裸 hex                 实测 0 处（白名单见测试文件注释）
  ⑤ index.html viewport 含 viewport-fit=cover
  ⑥ index.css 含 overscroll-behavior / @media (pointer: coarse) / touch-action / 7 个 .xx-safe 定义
  ⑦ Layout.tsx 含 min-h-dvh 且不含 min-h-screen

计划 8.2 的 3 条静态复核（逐条实跑）：
  grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src      → 无匹配（exit 1）
  grep -rn "z-\[" apps/web/src                            → 无匹配（exit 1）
  grep -rn "min-h-screen" apps/web/src/components/Layout.tsx → 无匹配（exit 1）


-------------------------------------------------
四、B2 汉堡抽屉（bdaf2e9）
-------------------------------------------------
新增 2 个文件、改 2 个文件：
  · src/stores/mobileNav.ts（新）：open/setOpen/toggle；**打开时无条件先
    useChatPanelStore.getState().setOpen(false)**（D4 单向调度，不反向 import、无循环依赖）；
    会话级不落盘。
  · src/components/MobileNav.tsx（新，281 行）：fixed inset-0 z-overlay nav:hidden；
    背景幕是全屏 button（absolute inset-0 bg-canvas/60）；aside#mobile-nav-drawer
    role=dialog aria-modal aria-label="导航菜单" tabIndex=-1 w-[min(20rem,85vw)]；
    滚动区 px-3 pt-3 pb-safe-3；内容 = 6 个 navRoutes() 项（每项 min-h-11 ≥44px，
    active 沿用 bg-accent-veil text-accent；「对话辅导」特判为 aria-pressed 按钮，先关抽屉再开面板）
    → 分隔线 → 「深浅主题」行（复用 ThemeToggle）→ 分隔线 → 空间区（当前空间名 / 空间列表 min-h-9 /
    active 样式同顶栏弹层 / 「+ 新建空间」原地展开 SpaceCreateForm compact / 「管理空间」Link）。
    无障碍：打开时 aside.focus()、关闭时焦点归还 #mobile-nav-toggle（用 wasOpen ref 区分「关闭」与
    「初始未打开」，避免挂载即抢焦点）、Esc 关闭、Tab/Shift+Tab 在抽屉内首尾循环、
    订阅 location.pathname 变化即收起（兜底后退与键盘导航）。
  · src/components/TopNav.tsx：nav 容器 px-6 → px-4 nav:px-6；ul / ThemeToggle 的 flex 外层 span /
    空间胶囊容器 div 各加 max-nav:hidden；尾部新增 #mobile-nav-toggle
    （nav:hidden ml-auto grid h-9 w-9 + 三横线 SVG，aria-expanded / aria-controls="mobile-nav-drawer"
    / aria-label 随开合切换）。
  · src/components/Layout.tsx：挂 <MobileNav />（TopNav 之后、ChatPanelDock 之前）；
    正文外层 aria-hidden={navOpen || undefined}（关闭时不渲染该属性 → 桌面 DOM 与改造前一致）；
    main px-6 → px-4 nav:px-6。
  · apps/web/tests/mobileNav.test.ts（新，4 用例）

真浏览器探针（本轮新增的取证手段）：$NODE tools/responsive-audit.cjs --probe-nav --widths 375
  结果：**16 通过 / 0 失败**，逐条为
    [OK] 已登录、汉堡键存在且可见            [OK] 顶栏导航 ul 在 <720 为 display:none
    [OK] 初始抽屉不存在                      [OK] 点击汉堡键后抽屉出现
    [OK] 抽屉 role=dialog / aria-modal=true  [OK] 汉堡键 aria-expanded=true
    [OK] 抽屉从右侧滑入（right ≈ 视口宽）    [OK] 焦点移入抽屉
    [OK] 25 次 Tab 后焦点仍在抽屉内（焦点陷阱）
    [OK] Esc 关闭抽屉                        [OK] Esc 后焦点归还 #mobile-nav-toggle
    [OK] 点背景幕关闭抽屉（用 Input.dispatchMouseEvent 打真实坐标，走的是指针命中路径而非 el.click()）
    [OK] 点抽屉内「学习报告」→ 抽屉收起      [OK] 点抽屉内「学习报告」→ 路由跳转 #/report
    [OK] 抽屉内「对话辅导」→ 抽屉收起且面板打开（互斥 D4）
    [OK] 面板开着时点汉堡键 → 面板关闭、抽屉打开（互斥兜底）
  截图：_pipeline/screenshots/mobile/probe-375-drawer-open.png、probe-375-drawer-open-2.png
  （人工看过：全高右滑 320px 抽屉、6 项导航、主题行、空间区、+ 新建空间、管理空间齐全）

中途的 1440 桌面回归预警（B2 完成、B3 开工前，用临时输出目录 /tmp/zhiwei-audit-check 跑）：
  --compare baseline after --widths 1440 → 几何 diff 0 项，12 页逐页 0。


-------------------------------------------------
五、B3 布局与断行破绽（d4824f5）
-------------------------------------------------
改了 10 个文件（计划 B3 的 Layout.tsx 已在 B1/B2 落地，见「九、偏差 D-05」）：
  · chat/ChatComposer.tsx：:88 容器加 flex-wrap；「传图读题」与「发送」两按钮加 shrink-0；
    textarea 加 min-w-[min(100%,12rem)]（R3）
  · chat/ChatMessageList.tsx：:52 气泡外层、:56 气泡内层各加 break-words（保留 whitespace-pre-wrap）；
    :76「已带题图（演示态 · imageFileId）」span 加 break-all（R6）
  · lib/richText.tsx：:52 行内 code 加 break-all；:117 段落 p 加 break-words（R6）
  · DrivePage.tsx:106 file_id 加 break-all（R6）
  · PaperPage.tsx:368 file_id 加 break-all；:209 / :322 两处按钮行加 flex-wrap（R6/R7）
  · AttributionPage.tsx:247 归因编号行加 break-all；:537 / :571 / :646 加 flex-wrap；
    :663-678 容器改成 flex flex-wrap items-center gap-3 且第二个按钮的 ml-3 删除（R6/R7）
  · SelfReportPage.tsx:83、AssessmentPage.tsx:238 加 flex-wrap（R7）
  · SpacesPage.tsx:108 卡片头 div 加 flex-wrap（R7）
  · PageSkeleton.tsx:37/:46 的 <Bar> prop 传反修正（D11）：tone 只放底色、height 放尺寸。
    修正前渲染类字符串 = " h-5 w-40 bg-line rounded-md"（height 是空串、tone 含全部类），
    修正后 = "h-5 w-40 bg-line rounded-md" —— **类集合完全相同**，只差首个空格，渲染等价。

关于 AttributionPage:663 的「inline-block + ml-3 → flex-wrap + gap-3」：
计划 R7 的理由是「gap-3 = 12px 与 ml-3 = 12px 同值 ⇒ 桌面间距像素不变」，我复核了这个推理成立，
但**理由需要补一句**：JSX 会吃掉紧邻标签的换行空白（JSX 规范：new lines adjacent to tags are removed），
故修正前两个按钮之间**只有 ml-3 的 12px、不含任何空格宽**；否则 flex 布局会抹掉那个空格宽、
造成 ~3.5px 的桌面差异。已把这条写进代码注释与 commit message。
（该处需要「有 draft 的归因向导中段」才渲染，几何走查的 12 页采样覆盖不到 —— 见「八、未完成/盲区」。）


-------------------------------------------------
六、B4 / B5（dabe075 / 58121fd）
-------------------------------------------------
B4（GraphPage.tsx 单文件）：
  · 图表 useEffect 内新增 ResizeObserver observe(containerRef.current) → chart.resize()，
    卸载时 observer.disconnect()；**window resize 监听保留**（R6 兜底：无 ResizeObserver 的环境不劣于改造前）。
    理由（R2）：面板开合挤压正文列时 window 不 resize，图表会留白边/裁切。
  · 详情卡关闭「×」(:289) 加 max-nav:grid max-nav:h-9 max-nav:w-9 max-nav:place-items-center（16→36px，<720 生效）。
  · 图谱 minWidth max(720, layout.width+200) + overflow-x-auto **保持不动**（D7）。

B5（4 文件，全部 max-nav: 作用域，D6）：
  · chat/ChatPanel.tsx:55「全屏打开」Link、:64 关闭键 各加 max-nav:min-h-9；
    :94 输入区容器 pb-3 → pb-safe-3（= env(safe-area-inset-bottom) + 0.75rem）
  · components/Toast.tsx:57「知道了」加 max-nav:min-h-9
  · chat/ChatComposer.tsx:69 文件项按钮加 max-nav:min-h-9
  · pages/AttributionPage.tsx:340「反驳一下」加 max-nav:min-h-9


-------------------------------------------------
七、验证命令与逐条实测结果
-------------------------------------------------
7.1 类型检查（计划 8.1 三段，每批后各跑一次，全部 exit 0）
  最终代码状态复跑（B6 提交前，三条各自独立一条命令）：
    tsc --noEmit -p packages/engine/tsconfig.json   → tsc-engine exit=0
    tsc --noEmit -p functions/api/tsconfig.json     → tsc-api    exit=0
    tsc --noEmit -p apps/web/tsconfig.json          → tsc-web    exit=0
  过程：B1/B2/B3/B4/B5 每批后均跑过 apps/web 段（另 B1 后跑过 engine 与 api 段），全部 exit 0。
  唯一一次非 0：B3 中途 AttributionPage 报 8 个语法错误（见「八、1)」），修好后 exit 0。

7.2 测试（计划 7.5 三条分批，禁止合并防 60s 被杀）
  基线（改动前）：packages 43 passed / functions/api/tests 169 passed / apps/web/tests 139 passed（14 文件）
  终态（B6 提交前，三条各跑一次）：
    $NODE $WS/node_modules/vitest/vitest.mjs run packages
        Test Files 2 passed (2)      Tests 43 passed (43)      Duration 1.28s
    $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
        Test Files 14 passed (14)    Tests 169 passed (169)    Duration 4.15s
    $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
        Test Files 16 passed (16)    Tests 150 passed (150)    Duration 1.89s
        （逐个文件：stages 14 / logoGeometry 17 / graphSnapshot 10 / breakpoints 7 / richText 10 /
          dialogStore 7 / client 13 / authStore 5 / chatPanel 5 / sse 20 / themeStore 7 /
          routerGuard 9 / bands 10 / phrases 6 / format 6 / **mobileNav 4**）
  合计 **43 + 169 + 150 = 362 用例 / 32 个测试文件**，与计划 7.4 的「前端 139 → 150、全仓 351 → 362」**逐数吻合**。
  既有测试零改动：routerGuard.test.ts 的 12 页 / 6 项导航断言原样通过（ROUTES / navRoutes 数据结构一字未动）。

7.3 前端构建
  B1 后（原地构建，计划里的原命令）：vite build --config apps/web/vite.config.ts → 通过
        （index.css 基线 33.30 kB → 33.66 kB）
  B2 后（原地构建）：通过（index.css 33.96 kB = 33966 B，逐条核对过 .nav\:hidden / .nav\:px-6 /
        .max-nav\:hidden / .min-h-11 / .pb-safe-3 等新类均已产出）
  B3 起：**计划里的原命令被本机沙箱拦下**——vite build 会先清空 apps/web/dist/assets，
        触发删除防护并被我拒绝放行（提示 “Blocked paths: apps/web/dist/assets”）。
        改用等价命令（不删任何仓库内文件）：
        $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build
        → 通过（3.17s），终态产物：index 129.12 kB / react 165.48 kB / echarts 434.35 kB /
          index.css **34055 B（构建报告四舍五入 34.06 kB）**，gzip 7.34 kB
  （三次构建的 CSS 体积序列：33.30 kB 基线 → 33.66（B1）→ 33.96（B2）→ 34.06（终态）；
    增量来自具名断点 nav:720px 的变体、7 个安全区工具类中各使用到的 5 个、以及各批新增的 max-nav: 工具类。）
  产物 CSS 内安全区工具类的实际产出（Tailwind 会按内容扫描按需产出未用到的类）：
        .bottom-safe-6 / .right-safe-6 / .top-safe-16 / .right-safe-4 / .pb-safe-3  → 均已产出
        .pb-safe / .pt-safe                                                          → **未产出（当前无使用点）**
        （.pb-safe 计划 6.3 只用于 MobileNav 抽屉底；我按 D-03 改用 pb-safe-3，故 .pb-safe 成为未使用类；
          .pt-safe 计划 6.2 定义但 6.3 里没有应用点，同样未使用。两者定义都在 index.css 里、
          由 breakpoints.test.ts ⑥ 锁定，将来一旦使用即自动进产物。）

7.4 静态复核（计划 8.2，逐条实跑，期望全部无匹配）
  grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src              → 无匹配，exit 1   ✔
  grep -rn "z-\[" apps/web/src                                    → 无匹配，exit 1   ✔
  grep -rn "min-h-screen" apps/web/src/components/Layout.tsx      → 无匹配，exit 1   ✔
  另跑：breakpoints.test.ts 的 ②③④ 扫描同样 0 命中（测试内断言）。

7.5 真浏览器走查（计划 8.3，本机仅 Microsoft Edge 153.0.4234.48，--headless=new --no-sandbox --hide-scrollbars）
  采样（after，一档一条命令）：
    $NODE tools/responsive-audit.cjs --tag after --widths 1440 / 1024 / 768 / 767 / 720 / 414 / 375
  7 档 × 12 页 = 84 页样本，**页面级横向溢出合计全部 0px**（每档输出都打印「页面级溢出合计 0px」）。
  产物：_pipeline/screenshots/mobile/audit-after-<width>.json ×7 + after-<width>-<route>.png ×84
        + compare-baseline-after-1440_1024_768.json + compare-baseline-after-767_720.json
        + probe-375-drawer-open.png / probe-375-drawer-open-2.png + 3 个运行日志 txt

  【验收项 1 的判据 —— 桌面像素级零变化】
    $NODE tools/responsive-audit.cjs --compare baseline after --widths 1440,1024,768
      === 1440px ===  12 页逐页「锚点diff= 0」「溢出 0px → 0px」
                     几何 diff：0 项（12 页 × 6 锚点 × 4 维 + 4 字号采样 全等）
      === 1024px ===  同上，几何 diff 0 项
      ===  768px ===  同上，几何 diff 0 项
      输出文件：_pipeline/screenshots/mobile/compare-baseline-after-1440_1024_768.json
                  （perWidth 三项 geometryDiffs 均为 0、textLenDiffs 均为 0；hardFail = []）
      结论：PASS —— ≥768 档 3 档逐页逐锚点 diff 全 0；**命令 exit code 0**
    说明：diff 判定阈值为 0.01px（锚点值本身按 2 位小数取整），即实测分辨率下「零差异」。

  【验收项 4：375/414 页面级溢出】
    baseline 与 after 在 375、414 两档：scrollWidth === clientWidth === 375/414，溢出 0px，12 页全部如此。
    允许保留的「容器内有意横滚」实证（after @ 375，均为自身 overflow-x-auto 容器内部，不产生页面级溢出）：
      /graph  → <div> w=2120 right=2149、<canvas> w=2120 right=2149（图谱 minWidth 720 的固化设计，D7）
      /report → <table class="w-full min-w-[420px] text-left text-sm"> w=420 right=453
                （+ thead/tr/th/tbody/td 共 10 个后代，均在同一滚动容器内，D8）
    对照基线同一位置：/graph right=2157、/report right=461 —— **差 8px 全部来自窄档页边距 48→32px**
    （每侧 24→16px），属本轮 <720 的有意改动，不是溢出。

  【补充档 767 / 720 的实测结论（总控特别要求）】
    $NODE tools/responsive-audit.cjs --compare baseline after --widths 767,720
      width 767 pages 12 geometryDiffs 0    textLenDiffs 0
      width 720 pages 12 geometryDiffs 68   textLenDiffs 11   （hardFail = []，因 720 < 768 不参与桌面判据）
    **767 档：几何 diff 0、正文文本长度 diff 0 —— 完全无变化，D16 在 767 成立。**
    **767/720 两档页面级横向溢出均为 0px（baseline 0px → after 0px）。**
    **720 档出现一处边界差异**（详见「十、遗留与建议 1)」）：
      11 个带顶栏的页面（除 /login）一致地 header.h 68 → 88（+20px）、headerNav.h 67 → 87（+20px）、
      main.y 68 → 88、firstCard.y / heading.y 各 +20px；/chat 另有 main.h +48。
      根因：旧写法 min-[720px]（min-width:720px）与 max-[720px]（max-width:720px）在**恰好 720px 处同时命中**，
      而具名断点 nav: / max-nav: 是互斥互补的一对（max-nav: = not all and (min-width:720px)，不含 720）。
      于是 720px 处新增可见：顶栏竖分隔线（18px）与空间胶囊文字「空间·初中数学」（约 90px）
      → 顶栏高度 68 → 88px（+20px）。**顶栏仍是单行**（排版行数未变）：88px 与 721–767 档、
      与桌面档（≥768）**同高**（767/768 档 header.h 实测同为 88），main.y 亦同为 88；
      页面级溢出 0px、可读可点。差异只有 1px 的端点语义：旧 max-[720px]:hidden（max-width:720px
      **含**端点）vs 新 max-nav:hidden（max-width:719.98px **不含**端点），恰好 720px 时分隔线与
      胶囊文字由「隐藏」恢复为「显示」。
      **未做任何自行调整**（总控明确：不要自行改断点），已把 3 个可选裁决方向写进「十、遗留与建议」。
      另注：720px 处汉堡键仍为 display:none（nav:hidden 命中），6 个 Tab 仍可见可用；
      页面级溢出仍为 0px，未产生横向滚动。


-------------------------------------------------
八、失败详情与修复尝试（不隐藏任何失败）
-------------------------------------------------
1) B3 中途 apps/web tsconfig 报 8 个语法错误（TS1005/TS1382/TS17002…），全部指向 AttributionPage.tsx:666。
   原因：我把 JSX 注释 {/\* … \*/} 写在了三元表达式的 `) : (` 与 <div 之间 —— 那是表达式位置，
   注释本身成了一个表达式、后面再跟元素，语法不成立。
   修复：把该注释移进 <div> 内部作为子节点，注释文案一字未减。修复后 tsc exit 0、vite build 通过。**已彻底解决。**
2) breakpoints.test.ts 第 7 条用例首次运行失败（1 failed / 145 passed）。
   原因：我在 Layout.tsx 的新注释里写了字面量 `min-h-screen`（「min-h-screen → min-h-dvh」），
   被 `expect(layout).not.toContain('min-h-screen')` 命中。
   修复：改注释措辞为「外壳最小高：100vh 档（sticky 视口高）→ 动态视口高 min-h-dvh」，不再出现该字面量；
   同时确认计划 8.2 的 grep 也要求无匹配行，改后 grep 无匹配、测试 150/150 全绿。**已彻底解决。**
3) tools/responsive-audit.cjs 首版在 --probe-nav 下报
   `SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied`。
   原因：只 `await Page.loadEventFired` 会与启动时 about:blank 的加载事件竞争，eval 打在半旧文档上。
   修复：goto() 改为「导航后回读 location.href 且必须包含本次唯一的 query 才返回」，60 次 ×120ms 超时兜底，
   并在超时时打印最后一次 href 与错误，便于定位。之后所有采样与探针均稳。
   **附带发现（环境类，非代码缺陷）**：本会话里用 `nohup … &` 在沙箱内起的 dev server / 后端，
   Edge 与 vite 互相连不上（实测 Page.navigate 返回 net::ERR_CONNECTION_REFUSED）；
   改用工具的后台运行方式启动两个服务后即正常。此后所有走查都在服务刚起、同一轮内跑完。
4) vite build 到 apps/web/dist 被本机沙箱删除防护拦下（用户拒绝放行，提示 Blocked paths: apps/web/dist/assets）。
   处理：不重试原命令，改用 `--outDir /tmp/zhiwei-web-build` 的等价构建（不删任何仓库内文件）。
   影响与口径：B1、B2 的原地构建已通过；B3 起用的是等价命令，因此「原地 build 在最终代码上是否通过」
   属**未跑**（原因即上述沙箱限制），构建通过的证据来自 --outDir 版本。**如实记录，未使用等价结论冒充原命令。**
5) 一次 `git log --oneline --no-pager` 报 `fatal: unrecognized argument: --no-pager`。
   原因：选项位置写错（--no-pager 必须放在子命令之前）。改为 `git --no-pager log …` 后正常。**已解决。**


-------------------------------------------------
九、与计划的偏差及理由（逐条留痕）
-------------------------------------------------
D-01（B1）Layout.tsx 的 min-h-screen → min-h-dvh **提前到 B1** 落地（计划排在 B3）。
     理由：计划 7.1⑦ 的同批新增测试 breakpoints.test.ts 就断言「Layout 含 min-h-dvh 且无 min-h-screen」，
     若严格按批拆，B1 提交后会留下 1 个红用例直到 B3，违反「每批跑完 8.1 应全绿」的作业纪律。
     该改动是 1 行、渲染等价（桌面 dvh === vh），影响面最小。

D-02（B2）Layout.tsx 的 px-6 → px-4 nav:px-6 **随 B2** 落地（计划排在 B3，TopNav 的同类改动在 B2）。
     理由：D9 原文要求「TopNav nav 与 Layout main 两处同步，否则破坏『内容列与顶栏共用同一条左基线』
     这条设计不变量」。若一处留到 B3，B2 的提交里就会出现「顶栏 16px / 正文 24px」的错位破窗期，
     单批回滚/单批审查都难看。两处同批落地后该不变量在任何两个提交之间都成立。

D-03（B2）MobileNav 抽屉滚动区底部用 **pb-safe-3**（计划 4.3 写的是 pb-safe）。
     理由：pb-safe 单独使用会把 padding-bottom 完全替换为 env(safe-area-inset-bottom, 0px)，
     非刘海设备上该值为 0 ⇒ 抽屉底部从原本的 12px 变 0。而计划 6.2 自己对 pb-safe-3 的定义正是
     「容器内边距：底部避让 + 原 0.75rem（原 pb-3）」——pb-safe-3 才是这一处的本意。
     抽屉在 ≥720 不渲染，无桌面像素风险。

D-04（B2）MobileNav 背景幕的 aria-label 用「**点击空白处关闭导航菜单**」，而非计划 4.3 写的
     「关闭导航菜单」。理由：抽屉头部已有同名关闭键，两个可访问名相同会造成读屏歧义；
     本项目对同一问题已有先例裁决（Layout.tsx 的 ChatPanelDock 背景幕用
     「点击空白处关闭对话面板」，注释标为 D25）。

D-05（B3）B3 不再改 Layout.tsx（计划 B3 的涉及清单列了它）。理由即 D-01 + D-02 已把它做完，
     重复修改会把同一个文件拆到三个批次里。B3 的 commit message 已按实情表述。

增补 E-01（非偏差，属工具自研范围内）tools/responsive-audit.cjs 除了计划 8.3.1 要求的三项能力
     （采样 / 对比 / 环境变量与产物命名），额外实现了 `--probe-nav` 抽屉交互探针。
     理由：计划 7.3 明确「不新增组件渲染测试」，抽屉的 Esc / 背景幕 / 焦点陷阱 / 焦点归还
     只能靠真浏览器取证；做成脚本比人工点一遍更可复算，且不引入任何业务代码改动。

增补 E-02 走查宽度从计划的 5 档（1440/1024/768/414/375）扩到 7 档（+767、+720），
     按总控的补充要求执行；baseline 与 after 两套都采了这两档。


-------------------------------------------------
十、未完成项 / 审计盲区（如实列出）
-------------------------------------------------
1) **恰好 720px 的顶栏边界差异未修**（总控明确「不要自行改断点」，故只报告不动作）。
   ⚠ 定性已更正（清尾轮 T4，2026-09-24）：本报告原先在此把 720px 处 header 68 → 88px 的高度增长
   误判为顶栏排版行数发生变化（该错误表述本轮已整段删改，见「十三、清尾轮修正记录 T4」）。
   正确事实如下：
   720px 处 header 高 68 → 88px（+20px，11 个带顶栏页一致），根因是 1px 的端点语义差：
   旧 max-[720px]:hidden（max-width:720px **含**端点）与新 max-nav:hidden（max-width:719.98px
   **不含**端点）在恰好 720px 处不同 → 分隔线（18px）与空间胶囊文字（约 90px）由「隐藏」
   恢复为「显示」，把顶栏撑高 20px。88px 与 721–767 档、与桌面档（≥768）**同高**
   （767/768 档 header.h 实测同为 88、main.y 同为 88）；无溢出、可读可点。
   页面级横向溢出仍为 0px。
   建议总控裁决（三个方向，按我实测的代价从小到大）：
     a) 保持现状（nav: 单一定义不动，接受恰好 720px 这一档顶栏比 ≤719 档高 20px、多出分隔线与
        胶囊文字；影响面 = 单个 CSS 宽度的 20px 高度）
     b) 把顶栏 Tab 容器（TopNav 的 nav <ul>）加 overflow-x-auto 兜底：不碰断点，
        但会在 720px 引入顶栏内横向滚动条（--hide-scrollbars 下走查看不见，真实浏览器可见）
        （注：这是**未实施的备选**方向的推演，不是实测——720 档实测页面级溢出为 0px，
         该方向是否真会产出滚动条未经测量，故保留原样、不在此写入未实测结论）
     c) 给「≤720 隐藏」这一侧也进 config：`screens` 再加一个 max 侧条目（如 'nav-max': { max: '720px' }），
        把 TopNav:101 / :163 的两处 max-nav: 换成它 —— 语义与被替换的 max-[720px]:hidden **逐字等价**，
        nav:'720px' 仍是唯一的最小侧来源；代价是 screens 不再只有一个键
        （需同步放宽 breakpoints.test.ts ① 的「唯一键」断言）。
   （b) 违反「单一来源」的精神；(c) 最贴合「现状顶栏 720–767」的 D16 原意。我未实施其中任何一个。

2) 几何走查**覆盖不到的渲染面**（工具锚点只取每页顶栏/正文/首卡片/标题，深部元素不在采样内）：
   · AttributionPage:663 的按钮组（需「归因向导已有 draft」状态才渲染）——见「五、」的推理说明；
   · /chat 的消息气泡（file_id 徽标、行内 code）——走查时的聊天记录是空的，
     break-words / break-all 只在「确实放不下」时生效，因此这三处属**逻辑与规范正确、缺真机长串样本**；
   · Toast / BackToTop / ConfirmDialog / 对话面板与抽屉的**打开态**几何（只有 probe 截图，无几何锚点）；
   · 面板展开态（≥1280 挤压正文列）下的锚点对比 —— 基线采样时面板未打开，两套 after 也未开。
   上述面均**未跑**几何量化，原因是本轮工具按计划 8.3.1 的口径只采默认态；已在报告标明，不冒充已验。

3) ~~`.pb-safe` 与 `.pt-safe` 两个工具类定义在源码、未被任何组件使用~~ —— **清尾轮 T1 已删除这两个
   零使用点的死类**（Tailwind 按内容扫描产出，它们本就不进构建产物）。原文的「保留」结论作废，
   见文末「十三、清尾轮修正记录 T1」。当前 index.css 的 @layer utilities 只剩 5 个真实使用点：
   top-safe-16 / right-safe-4 / bottom-safe-6 / right-safe-6 / pb-safe-3。

4) 沙箱限制导致「原地 vite build」在最终代码上未跑（见「八、4)」），已用等价 --outDir 版本替代。

5) 未做的事（计划本来就排除，记录以免误读）：未碰 packages/engine/ 与 functions/ 任何文件；
   未改 router.tsx 的 ROUTES / navRoutes；未改 5 份冻结文档；未改 tools/e2e-smoke.cjs；
   未改根目录 README.md（总控另案）与 知微-项目介绍.md；未做手机优先重构 / 报告表格卡片化 /
   图谱移动端独立视图；未改 index.css 滚动条 10px（D10）；未改 ReportPage 表格（D8）。

6) 我未把 planner 的 2 个未提交文件纳入提交（_pipeline/01_PLAN.md 的修改、
   _pipeline/archive/01_PLAN_20260924_2047.md 的新增）。它们不属本轮实现范围，
   按 AGENT §7「归档文件入库」的口径应由 planner/总控处理；我保持只读、不 stage、不修改。


-------------------------------------------------
十一、B6 提交内容（本报告的落盘批）
-------------------------------------------------
新增/更新产物（全部只增不删）：
  _pipeline/screenshots/mobile/audit-after-<1440|1024|768|767|720|414|375>.json   （7 个）
  _pipeline/screenshots/mobile/after-<width>-<route>.png                          （84 个）
  _pipeline/screenshots/mobile/compare-baseline-after-1440_1024_768.json          （验收项 1 判据，全 0）
  _pipeline/screenshots/mobile/compare-baseline-after-767_720.json                （补充档实测）
  _pipeline/screenshots/mobile/probe-375-drawer-open.png / -open-2.png
  _pipeline/screenshots/mobile/last-sample-baseline-log.txt / last-sample-after-log.txt
        / last-probe-log.txt / last-compare-log.txt
        ⚠ 口径说明：last-sample-<tag>-log.txt 是该 tag **最后一次**运行的日志（按宽度分档跑，
          后一档会覆盖前一档），baseline 那份记的是 375 档、after 那份记的也是 375 档；
          完整证据以逐档 audit-<tag>-<width>.json 为准，日志仅作运行留痕。
  LOOKATME.md（按实测数字更新：测试 351→362 与 30→32 文件、构建体积与 index.css 体积、
              新增「移动端适配轮」小节含全部实测数字与 720px 遗留）
  _pipeline/02_EXEC_REPORT.md（本文件）
  _pipeline/archive/02_EXEC_REPORT_20260924_2154.md（旧报告归档副本，md5 与归档前一致）


-------------------------------------------------
十二、逐项对照「一、目标与验收清单」
-------------------------------------------------
[✔] 1. 桌面像素级不变：--compare baseline after --widths 1440,1024,768 → 3 档 12 页 6 锚点 4 维 + 4 字号
        全部 0；前后截图各 84 张入库（验收项 1 判据：命令 exit 0）
[✔] 2. 断点单一定义：tailwind.config.js screens.nav='720px'；src/** 任意值断点变体实测 0 处；
        breakpoints.test.ts 静态锁死（7 用例）
[✔] 3. 375/414 顶栏只显示「知微」+ 汉堡键（截图与探针双证）；抽屉可开合、Esc / 背景幕 / 点导航项收起 /
        焦点归还 16/16 全过；含全部 6 项 navRoutes() + 主题切换 + 空间切换（含新建 / 管理入口）
[✔] 4. 375/414 每页 documentElement.scrollWidth === clientWidth（图谱 / 报告两处容器内横滚除外，已列清单）
[✔] 5. <720 触控目标 ≥36px：全部走 max-nav: 作用域（5 处），桌面无作用域不生效
[✔] 6. 长串不再撑破容器：break-all / break-words 7 处落位（walk 覆盖不到的 3 处见「十、2)」）
[✔] 7. 安全区：viewport-fit=cover + index.css 单一来源 7 个工具类；BackToTop / Toast / 面板输入区 /
        抽屉底避让已接入；桌面 env()=0 ⇒ 与替换前同值
[✔] 8. Layout 地址栏伸缩不跳动：min-h-dvh，与 LoginPage 统一
[✔] 9. 测试全绿且分批可跑：三条各 exit 0（43 / 169 / 150 = 362）；tsc 三段 exit 0；
        build:web 通过（--outDir 等价命令，原命令受沙箱限制见「八、4)」）
[✔] 10. 业务红线：未改 answer/solution_steps 相关路径；未新增算法硬编码；令牌体系只做清偿
         （3 处裸 z 值 → 令牌，数值相同）；未引入组件内裸 hex（静态闸门 ④ 实测 0 处）


-------------------------------------------------
十三、清尾轮修正记录（2026-09-24 22:19–22:2x，基线 HEAD 61c1d3b）
-------------------------------------------------
背景：_pipeline/03_REVIEW.md（轮 2 审查，VERDICT: PASS，0H/1M/4L/4INFO）判 PASS 后，按项目惯例
清掉审查报告里列明的可修项。范围严格限定 5 件（T1–T5），未扩大。开工前复核：git status 里
他人未提交变更（_pipeline/01_PLAN.md、_pipeline/03_REVIEW.md、tools/e2e-smoke.cjs、
_pipeline/PR-tempdeploy.md、知微-项目介绍.md、archive/01_PLAN_*.md、archive/03_REVIEW_*.md）
一律未碰、未 stage。

T1（审查 M1）删除零使用点的安全区死类
  做什么：apps/web/src/index.css 的 @layer utilities 删掉 .pt-safe 与 .pb-safe 两条定义；
  段头注释改写为「本层只定义实际在用的 5 个类」，并写明 top-safe-16 已覆盖顶部安全区
  （Toast 定位）、pb-safe-3 覆盖底部安全区（MobileNav 抽屉滚动区 / ChatPanel 面板输入区）。
  **零使用点核实（实施前实测，非推断）**：grep -rn -E "pt-safe|pb-safe" apps/web/src
  → 命中仅在 index.css 自身的定义/注释处，无任何组件 class 使用点；全仓唯一「提及」是
  apps/web/index.html:9 的说明性注释（不含 class 使用）。判定为可安全删除，**未强删**
  （总控给的例外条件「若确有使用点就停下」未触发）。
  grep -rn -E "pt-safe|pb-safe" apps/web/src（改后）→ 只剩 .pb-safe-3（另一个类）与其注释，
  独立写法 .pt-safe / .pb-safe 定义已彻底消失。
  产物口径：这两类本就不进构建产物（Tailwind 按内容扫描，7.3 节已实测「未产出」），
  故本次删除对 CSS 体积与渲染的影响为 0；index.css 的安全区类由 7 个变 5 个。
  测试同步：apps/web/tests/breakpoints.test.ts ⑥ 原先锁 .pt-safe/.pb-safe 两个已删类，
  改为锁实际在用的 5 个类，且每个类**双查**「index.css 有定义 + src/** 至少一个使用点」，
  从机制上挡住「定义了却没人用」的死代码复现（测试注释写明这条纪律）。
  局部实测：vitest run apps/web/tests/breakpoints.test.ts → 7 passed（用例数不变：①⑥ 是改写）。

T2（审查 L2）跨组件硬编码 id 收敛为共享常量
  做什么：新增 apps/web/src/lib/ids.ts，导出 MOBILE_NAV_TOGGLE_ID / MOBILE_NAV_DRAWER_ID。
  TopNav.tsx 的 button id={…} 与 aria-controls={…}、MobileNav.tsx 的 aside id={…} 与焦点归还用的
  getElementById(…) 全部改引该常量；两个组件（含注释）里的 id 字面量清零。
  实测：grep -n -E "mobile-nav-toggle|mobile-nav-drawer" apps/web/src/components/TopNav.tsx
  apps/web/src/components/MobileNav.tsx → 0 行（grep exit=1）。
  测试同步：apps/web/tests/mobileNav.test.ts 新增 1 条静态断言（读两个组件源文件文本，仿
  stages.test.ts 直读源文件先例）：二者都不得含硬编码字面量 id、且都必须 import 该常量模块。
  断言里的 id 用数组 split/join **拆写**，避免断言文本自身成为匹配源（自证）。
  局部实测：vitest run apps/web/tests/mobileNav.test.ts → 5 passed（4 → 5）。
  范围说明：tools/responsive-audit.cjs --probe-nav 的 CDP eval 字符串里也引用这两个 id，
  但它是独立 .cjs 探针（不参与前端构建、无法 import 本模块），未纳入本轮收敛（已在 ids.ts 注明）。

T3（审查 L1）收紧 screens 解析正则
  做什么：breakpoints.test.ts ① 的 /screens:\s*\{([\s\S]*?)\}/ 改为 /screens:\s*\{([^}]*)\}/
  （只匹配平铺写法），并加注释：旧非贪婪正则在将来嵌套对象写法下会截断在第一个 } 之前、
  keys 提取失真；嵌套写法需同步改本断言。
  实测：改后 ① 读 tailwind.config.js 得 keys=['nav']、body 匹配 nav: '720px'，用例通过。

T4（审查 INFO-1）执行报告 720px 定性更正
  做什么：把本报告两处对 720px 处 68 → 88px 的错误定性（原写作顶栏排版行数发生了变化）改成
  实测事实，见「七、7.5 补充档」与「十、1)」：顶栏**仍是单行**，header.h 68 → 88px（+20px）只是
  分隔线（18px）+ 空间胶囊文字（约 90px）由「隐藏」恢复为「显示」把顶栏撑高的结果；
  88px 与 721–767 档、与桌面档（≥768）**同高**（767/768 档 header.h 实测同为 88、main.y 同为 88）；
  无溢出、可读可点；差异本质是 1px 的端点语义（max-width:720px 含端点 vs 719.98px 不含端点）。
  **保留了「未自行改断点、按总控要求上报、三个可选方向待裁决」的事实**。
  顺带把「十、3)」原先「.pt-safe/.pb-safe 保留」的旧结论标注为已由 T1 作废（同文件内的
  事实一致性，避免报告自相矛盾）；「十、1)」的备选方向 b) 加了一行注明「该方向是未实施的
  推演、非实测」，不写入未实测结论。
  自检（判据）：对报告全文按判据点名的两个措辞检索（第 41 行 B3 提交摘要的「输入区…」、
  第 211 行 JSX 空白规则说明各 1 处）→ 命中行里**没有一行含「720」**，即全篇再无把 720px 档
  描述成折行 / 多行的说法；原先那两处错误表述已整段删改为「顶栏仍是单行 / 排版行数未变」。
  另：基线档那句「顶栏 1 行内容正常容纳…」（第 100 行）是**如实**的单行描述，非本次要删的措辞。

T5 汇总验证（逐条独立命令，本次实测）
  $NODE $WS/node_modules/vitest/vitest.mjs run packages
      → Test Files 2 passed (2)    Tests 43 passed (43)     exit 0
  $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      → Test Files 14 passed (14)  Tests 169 passed (169)   exit 0
  $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      → Test Files 16 passed (16)  Tests 151 passed (151)   exit 0
      （逐文件：logoGeometry 17 / breakpoints 7 / sse 20 / authStore 5 / themeStore 7 / client 13 /
        dialogStore 7 / chatPanel 5 / richText 10 / **mobileNav 5** / stages 14 / graphSnapshot 10 /
        routerGuard 9 / phrases 6 / format 6 / bands 10）
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      → stdout 空，exit 0
  $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
      → **失败（环境原因，非代码）**：走到「✓ 664 modules transformed」后在 prepareOutDir 阶段被
        本机沙箱的安全删除闸门拦下，报 [safe-delete][SAFE_DELETE_BULK_REJECTED] count=54
        threshold=50 targets=["apps/web/dist/assets"]（与「八、4)」记录的同一限制：vite 会先
        emptyOutDir 清空 apps/web/dist/assets，其中 54 个文件触发批量删除拦截）。
        本次按指令**未重试、也未改用 --outDir 等价命令**，故「build 在最终代码上通过」本轮
        **不成立 / 未取得证据**（如实记录，不用等价结论冒充）。受影响面评估：本轮前端改动 =
        index.css 删两条零使用点定义 + 新 lib/ids.ts + 两个组件 import 替换，均经 tsc(exit 0) 与
        151 条前端用例覆盖；apps/web/dist 是 gitignore 的旧产物，程序侧无残留风险。
  全仓合计 43 + 169 + 151 = **363 用例**（原 362，+1 = T2 新增的那条断言；breakpoints ①⑥ 与
  mobileNav 原有 4 条是**改写**不是新增）。与总控预期「前端 151 / 全仓 363」逐数吻合。
  提交：逐文件 git add（显式路径，全程未用 git add -A / git add .），未把他人未提交变更
  （01_PLAN.md / 03_REVIEW.md / tools/e2e-smoke.cjs / PR-tempdeploy.md / 知微-项目介绍.md /
  archive 两份）扫进任何提交；apps/web/dist 经 git check-ignore 实测被 .gitignore 忽略，未入库。
    代码与测试提交（T1/T2/T3）：**a93f629**（6 files changed, 101 insertions(+), 31 deletions(-)，
      含新增 apps/web/src/lib/ids.ts；提交前 HEAD=61c1d3b（rev-list --count 97），提交后 98）
    本报告（T4 及其修正记录）落在紧随其后的第二次提交；该提交 hash 自指，故不写死，
    以 git log --oneline -1 为准。

与计划的偏差：无（本轮不适用 01_PLAN.md 的 B0–B6 批次，按总控下发的 T1–T5 清单执行；未碰
packages/engine/、functions/、apps/web/src/router.tsx、4 份冻结文档、tools/e2e-smoke.cjs）。

本轮遗留 / 需总控知悉（如实记录）：
  · ①「原地 vite build 在最终代码上通过」本轮未取得证据（沙箱删除闸门，见 T5）；若需闭环，
    请放行 apps/web/dist/assets 的清理，或授权改用 --outDir 临时目录。
  · ② apps/web/index.html:9 的注释仍写「由 index.css 的 pt-safe/pb-safe/bottom-safe-* 工具类按
    env() 避让」——T1 删掉那两个类后这句提及已略陈旧。本轮授权范围只到 index.css 与测试文件，
    **未改 index.html**（纯注释、无功能影响），留待下次触碰该文件时顺手更正。
  · ③ _pipeline/03_REVIEW.md 与 _pipeline/01_PLAN.md 仍是他人未提交状态，本轮未 stage（保持原样）。

（完）
