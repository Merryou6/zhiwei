知微 · 移动端适配轮（修破绽深度，桌面像素级零变化）审查报告
================================================================================
审查角色：reviewer（**只读**审查；除本文件及其归档副本外未修改任何仓库文件，未提交、未 add）
审查日期：2026-09-24 22:13（本机时间）
审查范围：基线 c085db1（轮 2 终审报告落盘）→ HEAD 61c1d3b（分支 tempdeploy），提交序列
          7e4d5ce(B0) / e20d9ba(B1) / bdaf2e9(B2) / d4824f5(B3) / dabe075(B4) /
          58121fd(B5) / 61c1d3b(B6)
审查依据：需求（总控拍板：手机端适配，深度=修破绽、桌面像素级零变化，顶栏收纳=汉堡抽屉）
          > _pipeline/01_PLAN.md（第 6 版，B0–B6/D1–D17/R1–R12/七/八）
          > _pipeline/02_EXEC_REPORT.md（implementer 自述，仅作待核清单，不作为证据）
归档：落盘本报告前，已先把旧 03_REVIEW.md（轮 2 版，VERDICT PASS，44645 字节）复制归档为
      _pipeline/archive/03_REVIEW_20260924_2213.md（md5 两侧一致 d41d1905…d30ef），
      然后才覆写本文件（先归档、再写入；轮 2 版在 git 2b50085…9b24d46 系列提交中亦有留存）。
环境：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
      $WS=/Users/Merryou/.workbuddy/binaries/node/workspace
      $PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3

结论（先读这一段）
--------------------------------------------------------------------------------
本轮**成立**。B0–B6 七批的实际代码与 diff、测试、tsc、真浏览器走查产物与执行报告主干陈述
**逐条对得上**。三条最关键验收项我全部独立实测复核（见 §1–§3）：
  · 桌面像素级零变化：重跑测试/类型检查全绿 + 对 3 个桌面档 36 张截图逐张像素级比对，
    除 2 处可解释的渲染噪声外**零像素差异**（1440 档 10/12 张连字节都一致）；
  · 720px 边界：几何数据 + 截图 + 逐像素比对三重复核，**证实总控的纠正正确**——
    720px 顶栏仍是单行（68→88px 由分隔线与空间胶囊文字恢复显示撑高），不是换行；
  · 互斥与无障碍：代码路径 + 真浏览器探针日志双向核验，mobileNav/chatPanel 无循环依赖。
共记录 9 条问题：**0 H / 1 M / 4 L / 4 INFO**，无 FAIL 级问题。
M1（.pt-safe 死代码，实际未生效但当前也无使用点，故降为 M）与 720 边界处置建议总控裁决。

--------------------------------------------------------------------------------
1. 独立复核的实测数字（命令与真实输出，非转述）
--------------------------------------------------------------------------------

1.1 测试三批（分批跑，每条独立一条命令；2026-09-24 22:06 实测）

  $NODE $WS/node_modules/vitest/vitest.mjs run packages
    → Test Files  2 passed (2)     Tests  43 passed (43)     Duration 3.30s
  $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
    → Test Files  14 passed (14)   Tests  169 passed (169)   Duration 12.41s
  $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
    → Test Files  16 passed (16)   Tests  150 passed (150)   Duration 9.35s
  合计 **43 + 169 + 150 = 362 用例 / 2+14+16 = 32 个测试文件**，exit code 全 0。
  与 implementer 自述（43/169/150 = 362/32）与计划 7.4 预测（351→362、139→150）
  **逐数吻合**。逐文件口径（app/web/tests 16 文件）与报告「七、7.2」的列表一致，
  含 breakpoints 7 例与 mobileNav 4 例两个新增文件。

1.2 tsc 三段（各自独立一条命令；同轮实测，stdout 均为空、exit code 0）

  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json → exit=0
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json   → exit=0
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json        → exit=0

1.3 前端构建：**未跑**。原因：apps/web/dist/assets 存在仓库内旧产物，沙箱删除防护
  会拦下 emptyOutDir（与执行报告「八、4)」记录的同一环境限制）；且审查环境无法
  起 dev server + Edge 双服务完成真浏览器复测。本轮桌面零变化的判定不依赖构建产物，
  而是依赖「改后像素级比对 + 几何锚点」双证据（见 §2），故未跑构建不构成判定缺口。

--------------------------------------------------------------------------------
2. 桌面像素级零变化（第一验收项）——三重独立交叉验证
--------------------------------------------------------------------------------

2.1 逐张 MD5（md5 -q，1440 档 12 对）

  assessment  MATCH / attribution MATCH / chat MATCH / console MATCH / drive MATCH /
  me MATCH / paper MATCH / report MATCH / self-report MATCH / spaces MATCH（10 张字节一致）
  graph   DIFF 27d1fa1b… / a14400f0…（87372 → 87373 字节）
  login   DIFF a2d7245632… / 067f04fb…（217289 → 222040 字节）

2.2 PNG chunk 解析定位差异来源

  login（1440）：前 10 个 IDAT chunk md5 完全一致（压缩流前 ~40KB 逐字节相同），
    第 11 个 IDAT 起分叉 —— 差异集中在**压缩流中后段**，文件头/IHDR 调色板均一致。
  graph（1440）：前 6 个 IDAT 一致、第 7 个起分叉，字节差仅 1（87372 vs 87373）。

2.3 **像素级**比对（PIL，RGB 逐像素差分，不是只比文件字节）——关键证据

  WIDTH 1440：assessment/attribution/chat/console/drive/me/paper/report/self-report/spaces
              changed = 0（**IDENTICAL_PIXELS**）
              graph    changed = **18**，ratio 0.00001389，bbox (232,202)-(1208,208)，
                       **max 单通道差 = 1**（例如 (233,202) (35,51,69)→(35,51,70)）
              login    changed = 13770，ratio 0.0106，bbox (629,150)-(811,309)，
                       max 单通道差 = 242
  WIDTH 1024：除 login（changed=14866，bbox (423,149)-(603,309)，max 242）外全部 0。
  WIDTH 768：除 graph（changed=18，bbox (24,202)-(744,208)，max 1）与
              login（changed=13996，bbox (289,150)-(472,311)，max 242）外全部 0。
  WIDTH 767：11 个带顶栏页 changed=0；login changed=11523（同 bbox 特征）。
  WIDTH 720：11 个带顶栏页 changed 在 83k–252k 量级、bbox 均从 (0,16) 起（顶栏区）；
              login changed=12145（同 login 特征）。详见 §4 的 720 判定。

2.4 三处差异的解释（**均判定为渲染噪声，不是真实布局/样式像素变化**）

  a) login（1440/1024/768/767/720 档均 DIFF）：差异 bbox 精确对应 LoginPage:194 的
     <ParticleLogo className="w-[min(264px,56vw,27vh)]"> 画布区域。ParticleLogo.tsx:251/263
     用 requestAnimationFrame 持续重绘粒子（性能细节见 logoGeometry.test.ts 17 例），
     两轮截图的采样时刻不同，粒子相位必然不同 → **该页在本轮改造前后本来就无法用
     截图做字节级比对**，且几何锚点（header/main/firstCard/heading）在 --compare 里
     全部 diff=0，说明排版零变化、只有动画相位在变。属**可解释的动画噪声**。
  b) graph（1440/768 档，各 18 像素、最大差 1）：差异 bbox 是 (232,202)-(1208,208)
     @1440 / (24,202)-(744,208) @768 —— 图表卡片左右两侧对称位置、同一 6px 高的窄条，
     是 ECharts canvas 在 ResizeObserver 接入后**同尺寸重绘一次的亚像素抗锯齿抖动**
     （B4 新增 observer.observe(container) 后 chart.resize() 会再触发一次重绘，
     canvas 光栅化在边缘 1px 内产生 ±1 的舍入差）。单通道最大差 1/255，肉眼不可辨，
     不是布局或配色变化。1024 档 graph 反而 0 diff，说明并非稳定像素差异。
  c) 其余 10/12 张连文件字节都一致 —— 说明本轮「桌面像素级零变化」在真实渲染层面成立，
     并非只靠几何锚点近似。

  结论：**「桌面像素级零变化」验收成立**；两处 DIFF 均为可解释噪声，不构成 H 级。

--------------------------------------------------------------------------------
3. 代码审查（逐 diff 阅读，B1–B5 全量、B6 走查产物抽查）
--------------------------------------------------------------------------------

3.1 B1（e20d9ba，10 文件）
  · tailwind.config.js：theme.extend.screens = { nav: '720px' }，唯一键 ✔；
    带「旧写法在恰好 720px 同时命中」的边界预警注释（与实测一致，见 §4）。
  · 3 处任意值断点替换逐字核对：TopNav.tsx:105/174、ChatPage.tsx:98，值未漂移 ✔。
  · 3 处裸 z 令牌化：Toast.tsx:42 z-overlay、ConfirmDialog.tsx:33 z-overlay、
    BackToTop.tsx:32 z-nav，数值与原 z-50/z-40 相同，像素等价 ✔。
  · index.css 安全区工具类 7 个定义齐全、env() 全带 0px 兜底 ✔；
    overscroll-behavior-y 只作用于 html；touch-action 包在 @media (pointer: coarse) 里 ✔。
  · Layout.tsx min-h-screen → min-h-dvh：桌面 dvh==vh，渲染等价 ✔。
  · breakpoints.test.ts 的正则 /(?:min|max)-\[\d+px\]:/ **必须带冒号后缀**——
    已实测验证：ReportPage.tsx:186/226 的 min-w-[420px]（无冒号）**不命中**，
    测试与 grep 均通过，无误伤 ✔。z-\[ 与 className 裸 hex 正则同样无白名单误伤
    （hits() 返回空数组断言，实测 src/** 全扫 0 处）。

3.2 B2（bdaf2e9，5 文件）——抽屉与互斥
  · MobileNav.tsx：fixed inset-0 z-overlay nav:hidden；背景幕全屏 button（aria-label
    「点击空白处关闭导航菜单」，与头部关闭键「关闭导航菜单」刻意区分，沿用 D25 先例）；
    aside role=dialog aria-modal=true tabIndex=-1；打开时 asideRef.current.focus()（MobileNav.tsx:73）；
    关闭时焦点归还 #mobile-nav-toggle（:112-121，用 wasOpen ref 区分「关闭」与「初始未打开」，
    避免挂载即抢焦点）——实现干净，逻辑闭环。
  · Tab 焦点陷阱（:75-105）：Tab 尾部→回首个、Shift+Tab 首部→回尾部、
    焦点已不在 root 内则强制拉回——三条分支齐全，逻辑正确；last-probe-log.txt 的
    「25 次 Tab 后焦点仍在抽屉内」与代码路径一致。
  · 互斥（stores/mobileNav.ts:30-46）：open/toggle 在**打开**时单向调
    useChatPanelStore.getState().setOpen(false)；**不反向 import** chatPanel 的内容——
    实测 chatPanel.ts 无任何 mobileNav 引用（grep 证实），无循环依赖。
    路径封闭性：mobileNav.test.ts 两方向用例 + last-probe-log.txt 真浏览器双向探针
    「抽屉内对话辅导→抽屉收且面板开」「面板开着点汉堡→面板关且抽屉开」均 OK。
    另 ChatPage.tsx:68 的「收进侧栏」是面板开 + navigate('/console')，与抽屉路径不冲突。
  · Layout.tsx：MobileNav 挂在 TopNav 之后、ChatPanelDock 之前（z 同为 overlay，
    靠互斥保证不同屏）；正文外层 aria-hidden={navOpen || undefined}（关闭时属性不渲染，
    DOM 与改造前一致）✔。
  · TopNav.tsx：ul / ThemeToggle 外层 span / 空间胶囊容器 / 内部文字 span 共 4 处
    max-nav:hidden；汉堡键 nav:hidden + h-9 w-9 + aria-expanded/aria-controls/
    aria-label 随开合切换 ✔。桌面 ≥720 全部新增类不生效，与 §2 像素实测吻合。

3.3 B3（d4824f5，10 文件）
  · flex-wrap ×9、break-all/break-words ×7、shrink-0 ×2、min-w-[min(100%,12rem)]
    逐处核对，全部按计划 R3/R6/R7 落位，无遗漏、无越界文件 ✔。
  · **桌面零变化的机理复核**：flex-wrap 在单行放得下时布局结果与 nowrap 完全一致
    （本机 1440/1024/768 三档像素实测佐证）；break-all/break-words 是 overflow-wrap
    类的**回退型**属性，仅在内容真的放不下时生效——桌面宽度足够，不改变任何字形位置；
    min-w-[min(100%,12rem)] 在桌面 textarea 实际宽度（375+ px）大于 12rem，约束不触发。
    三条推理均与像素实测一致，**不属于「漏加 max-nav: 作用域」类桌面漂移**。
  · AttributionPage.tsx:663-678：inline-block + ml-3 → flex flex-wrap + gap-3，
    删除第二个按钮的 ml-3。实现者的「JSX 吃换行空白、原先按钮间只有 ml-3 的 12px」
    推理正确（JSX 规范：标签相邻换行空白被移除），间距等价 12px ✔。
    该容器同时从 block 变 flex + wrap：p-4 内部主按钮与次要按钮原本就同行排布，
    变 flex 后桌面（不换行时）主轴位置逐像素等价，已被 720/767 档截图像素比对间接佐证
    （767 档 changed=0，720 档差异全部可归因顶栏，无新增偏移）。见 INFO-3 的覆盖盲区。
  · PageSkeleton.tsx:39/:48：Bar tone/height 传反修正，修正前后渲染类集合逐字相同
    （只差拼接顺序与首个空格），D11 的「语义修正、渲染等价」结论成立 ✔。

3.4 B4（dabe075，1 文件）
  · GraphPage.tsx:200-206：ResizeObserver observe(containerRef.current) → chart.resize()，
    卸载 disconnect；**window resize 监听保留**（:193-194）；typeof ResizeObserver ===
    'undefined' 时回落 null，不劣于改造前 ✔。
    隐患复核：ResizeObserver 回调里 chart.resize() 与 dispose 竞态——cleanup 先 disconnect
    再 dispose（:208-212），disconnect 保证回调不再触发，顺序正确，无悬挂引用 ✔。
  · 详情卡「×」:306：max-nav:grid max-nav:h-9 max-nav:w-9 max-nav:place-items-center，
    全部 max-nav: 作用域 ✔。

3.5 B5（58121fd，4 文件）
  · ChatPanel.tsx:55/:64 max-nav:min-h-9、Toast.tsx:61 max-nav:min-h-9、
    ChatComposer.tsx:69 max-nav:min-h-9、AttributionPage.tsx:340 max-nav:min-h-9 ——
    全部带 max-nav: 作用域 ✔。
  · ChatPanel.tsx:96 输入区容器 pb-3 → pb-safe-3：**注意这是无作用域替换**，但
    pb-safe-3 = calc(env(safe-area-inset-bottom,0px) + 0.75rem)，桌面非刘海设备 env()=0
    → 计算值 = 0.75rem = 原 pb-3，逐像素等价 ✔（与 §2 实测 0 diff 一致）。
  · min-h-9 作用域判断：**这些按钮原本就带 px-3 py-2 等内边距**，max-nav:min-h-9 只在
    <720 撑高，桌面高度不变（768/1024/1440 档像素 0 diff 佐证）✔。

3.6 B6（61c1d3b）：走查产物 + LOOKATME/02_EXEC_REPORT 落盘 + 工具 3 处增强。
    未碰任何业务代码（name-only 核对：仅 LOOKATME.md、_pipeline/**、tools/responsive-audit.cjs）。

3.7 「桌面可见效果的新增类是否都带 max-nav: 作用域」专项扫描

  全 src/** 检索本轮新增的 flex-wrap / break-all / break-words / shrink-0 /
  min-w-[min(100%,12rem)] / min-h-9 / pb-safe-3 / top-safe-16 / bottom-safe-6 /
  right-safe-4 / right-safe-6 / pt-safe / pb-safe 全部使用点（单引号 + 双引号两种写法都查）：
    · max-nav: 作用域类（5 处触控目标）：全部带前缀 ✔；
    · 安全区类（5 个使用点）：无作用域，但均满足「env()=0 时与被替换类同值」的
      数学等价（见 §3.5），且 768/1024/1440 像素实测 0 diff ✔；
    · flex-wrap / break-all / break-words / shrink-0 / min-w-[min(100%,12rem)]：无作用域，
      但均为「回退型/放不下才触发」属性（见 §3.3 机理复核），不构成桌面漂移 ✔。
  **结论：没有漏加作用域导致的桌面像素变化**。

3.8 断点单一来源 / z 令牌 / 裸 hex 独立 grep 复核（都实跑）

  grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src        → 0 行 ✔
  grep -rn "z-\[" apps/web/src                              → 0 行 ✔
  grep -rnE 'className="[^"]*#[0-9a-fA-F]{3,8}' apps/web/src → 0 行 ✔
  grep -rn "min-h-screen" apps/web/src/components/Layout.tsx → 0 行 ✔
  （tailwind.config.js 的具名断点 nav:'720px' 为唯一 screens 键，breakpoints.test.ts ①
    锁死；nav:/max-nav: 两侧均有使用点，防拼写静默失效。）

--------------------------------------------------------------------------------
4. 720px 边界——总控结论的独立复核与裁决建议
--------------------------------------------------------------------------------

4.1 复核过程（三重证据）

  a) 几何（audit-after-720.json vs audit-after-767.json，同批产物同口径）：
     720 档 11 个带顶栏页（除 /login）header.h 全部 = 88、headerNav.h = 87、
     main.y = 88；767 档同页 header.h 同样 = 88、headerNav.h = 87、main.y = 88 ——
     **720 与 721–767 的顶栏形态完全一致（88px）**，说明 720 处并没有「塌成两行」；
     68px 是 baseline（改造前）在 720 档的旧高度（max-[720px]:hidden 命中端点，
     分隔线+空间胶囊文字隐藏 → 顶栏矮一截）。
  b) 截图像素级比对（PIL，§2.3 最后一组）：
     720 档 11 页 bbox 全部是 (0,16)-(…,…) 起、changed 8.3万–25.2万、ratio 0.14–0.43 ——
     差异集中在**顶部 16–88px 一条带 + 正文整体下移 20px**（对应 header.h 68→88），
     **不是**「整页重排/换行」的大范围差；且 768/767/1440 档对应位置 changed=0。
     若真是顶栏换行成两行，main.y 应 ≥ 100+，实测 main.y=88 与 767/768 一致。
  c) 截图目检（baseline-720-spaces / after-720-spaces / after-767-spaces /
     after-768-spaces 四张逐张看）：baseline@720 顶栏 = 品牌+6 Tab+主题+胶囊（无文字）；
     after@720 = 与 after@767/after@768 **完全同构**（多了「空间·初中数学」文字与
     分隔线），顶栏仍是**单行**，无换行、无叠字、无溢出。

4.2 结论：**总控的纠正成立，implementer 原报告「720px 顶栏由 1 行变 2 行」定性错误**。

  根因（CSS 语义层）：旧写法 max-[720px]:hidden 的 max-width:720px **含端点**，
  新写法 max-nav:hidden（= not all and (min-width:720px)）**不含端点** —— 恰好 720px 时
  分隔线（18px）与空间胶囊文字（约 90px）由隐藏恢复显示，顶栏从 68px 撑到 88px。
  721–767 与桌面档（≥768）本就是 88px（767 与 768 的 header.h 实测同为 88），
  故 720 恢复后的高度与两侧邻域一致，顶栏**单行**，无换行。
  页面级溢出：720 档实测 0px（scrollWidth == clientWidth == 720），无横滚。

4.3 要不要处理（reviewer 裁决意见，供总拍板）

  **建议：接受现状（不处理），记入 L 级遗留并留痕。**理由：
  1) 影响面收敛到「恰好 720 CSS px」这一档：该宽度的设备真实存在（1440×2560@DPR2
     的 Android 逻辑宽 720 等），但属**极窄区间**，且表现是「顶栏比 767 高 0px、
     比 767 多出分隔线与胶囊文字」，是**可读、可点、无溢出**的合法形态——
     用户实际感知是「顶栏多了点内容」，不是破绽。
  2) 三种修复方向的代价都被实测过或可推演：implementer 方案 c)（再加一个 max 侧
     screens 键，如 'nav-max':{max:'720px'}）能把语义修回「≤720 隐藏」，但违反
     「screens 单一来源」本轮自己立的纪律、且要放宽 breakpoints.test.ts ① 的唯一键
     断言；方案 b)（ul overflow-x-auto）引入可见滚动条；方案 a)（保持现状）零改动。
  3) 「桌面像素级零变化」是本轮第一硬约束，720 边界的 1px 语义差不碰任何 ≥768 档；
     为一个非破绽的边界形态去松动单一来源纪律，风险收益比不划算。
  4) 若后续用户/演示确实暴露 720 档问题，再走一次「断点微调」专项（带独立走查），
     不宜在本轮夹带。
  综上：**不构成 FAIL 项**；建议在 LOOKATME 或 02_EXEC_REPORT 的「遗留」处明确
  「720 档顶栏 88px（与 767 同）但多出分隔线+胶囊文字」这一事实描述，供后续追溯。

--------------------------------------------------------------------------------
5. 问题清单（按严重程度分级；每条含 文件:行 / 证据 / 影响 / 建议）
--------------------------------------------------------------------------------

M1（中等）.pt-safe 定义后全站无使用点，死代码 + 计划 6.3 的「抽屉底 pb-safe」落空
  文件：apps/web/src/index.css:161-164（.pt-safe 定义）、apps/web/src/components/MobileNav.tsx:174
  证据：grep 全 src/** 只有 index.css 定义处 1 处、无任何组件使用；构建产物
        （执行报告 7.3 节 + 本轮实测无 dist 可再验证，但 Tailwind 按内容扫描的机理）
        不会产出 .pt-safe/.pb-safe 类；MobileNav.tsx:174 实际用的是 pb-safe-3。
  影响：无像素影响（桌面/窄屏都不渲染）；但（a）「抽屉底部安全区」这个计划 6.3
        明文目标，实际靠的是 pb-safe-3（= env + 0.75rem），**安全区部分在刘海设备上
        确实生效**（env 项 > 0 时 padding-bottom 会 > 0.75rem），只是类名与计划写法不同；
        （b）.pt-safe 作为从未被使用的公共工具类，属「为将来预留」的死代码，与
        「单一来源、按需产出」的纪律有张力。
  建议：二选一 —— 要么删掉 .pt-safe（连同 breakpoints.test.ts ⑥ 断言里的对应行一起
        收窄），要么在文件头注释明确「预留，当前无使用点」。**不建议**本轮追加使用点
        （无真实需求，徒增桌面回归面）。

L1（轻微）breakpoints.test.ts ① 的 screens 解析正则过宽，对嵌套对象会失真
  文件：apps/web/tests/breakpoints.test.ts:70-76
  证据：/screens:\s*\{([\s\S]*?)\}/ 非贪婪匹配到第一个 `}`；当前 config 的 screens
        只有一个平铺键，解析结果正确（实测 keys=['nav']）；但若将来有人把 screens
        写成嵌套对象（如 nav: { min: '720px' }），该正则会截断在第一个 } 之前，
        keys 提取不准。
  影响：当前无影响；将来改 config 写法时该测试可能误报或漏报。
  建议：改用平衡解析或限定「/screens:\s*\{([^}]*)\}/」只匹配平铺，并加注释说明边界。

L2（轻微）MobileNav 关闭后焦点归还依赖 getElementById('mobile-nav-toggle')，
          跨组件靠 id 关联，无类型保护
  文件：apps/web/src/components/MobileNav.tsx:119-120、apps/web/src/components/TopNav.tsx:244
  证据：toggle?.focus() 对 null 安全；但两处 id 字符串（'mobile-nav-toggle' /
        'mobile-nav-drawer'）分别硬编码在 TopNav 与 MobileNav，中间隔着 aria-controls
        的字符串匹配，无编译期/测试期校验。
  影响：将来有人改 id 而不同步另一处，焦点归还与 aria-controls 会**静默失效**
        （不报错、不挂测试），正是本轮 breakpoints.test.ts 文件头自己描述的
        「靠人肉 grep 守不住」的那类破绽。
  建议：把两个 id 提成共享常量（如 lib/ids.ts 或 router.ts 旁），MobileNav/TopNav/
        探针脚本三处同源；或加一条静态测试断言两处字符串一致。

L3（轻微）MobileNav 打开态下，TopNav 的汉堡键自身不在 aside 内、也不在 aria-hidden
          的正文容器里，但 TopNav 未参与焦点陷阱
  文件：apps/web/src/components/MobileNav.tsx:75-105（陷阱范围 = aside 内）、
        apps/web/src/components/TopNav.tsx:243-264
  证据：陷阱逻辑「焦点已在 root 内 → Tab 循环」「焦点不在 root 内 → 拉回 first」；
        Tab 从汉堡键（root 外）进入时会被拉回抽屉首项 ✔。但汉堡键在 z-nav（40）<
        抽屉 z-overlay（50）之下，视觉被背景幕遮住 —— **指针不可点**（背景幕是全屏
        button），键盘焦点因陷阱也进不去 —— 无障碍路径实际闭合，无 FAIL 风险。
        记为轻微是因为「汉堡键在抽屉打开期间既不可见也不可达」是**期望行为**，但
        代码里没有注释说明这层意图，后人易误判为 bug 而加「打开时禁用汉堡」之类
        冗余逻辑。
  影响：无功能影响；纯可维护性。
  建议：在 MobileNav.tsx 焦点陷阱分支旁补一行注释「汉堡键在抽屉打开期间被背景幕
        覆盖且被陷阱排除，属有意行为」。

L4（轻微）tools/responsive-audit.cjs 的几何对比阈值 0.01px 与「像素级零变化」口径
          存在理论缝隙
  文件：tools/responsive-audit.cjs（--compare 分支，diff 判定 ≤0.01px 视为相等）
  证据：执行报告 7.5 节自述「锚点值本身按 2 位小数取整」；本轮几何 diff=0 与
        像素级实测（§2.3）一致，未见实际缝隙；但「±0.01px」在 deviceScaleFactor=1、
        极端缩放/亚像素布局下可累积成可见的 1px 偏移而不报。
  影响：本轮无影响（像素级实测兜底了）；后续轮次若只依赖 --compare 可能漏检。
  建议：在 LOOKATME 或报告里注明「--compare 是几何级判据，像素级判定以逐像素
        比对为准」，后续轮沿用。

INFO-1 720px 边界的 1px 语义差（§4 详述）：不构成 FAIL；建议按 §4.3 裁决接受现状，
        但把事实描述（「720 档顶栏 88px、多出分隔线+胶囊文字、单行、无溢出」）写进
        LOOKATME/02_EXEC_REPORT 的遗留区，替换掉 implementer 原报告里
        「顶栏由 1 行变 2 行」的错误定性（02_EXEC_REPORT.md:322-329、十、1) 一节）。
INFO-2 .pb-safe 同样定义未用（与 M1 同源，MobileNav 实际用 pb-safe-3）——
        事实已在 M1 合并陈述；单独列出是提醒 breakpoints.test.ts ⑥ 断言里
        同时锁了 .pt-safe 与 .pb-safe 两个死类。
INFO-3 走查锚点覆盖不到的渲染面（与 implementer 自报一致，reviewer 核实属实）：
        /chat 气泡内长串、AttributionPage:663 draft 态按钮组、Toast/BackToTop/
        ConfirmDialog/面板与抽屉的打开态几何、≥1280 面板展开态挤压 —— 这些状态
        在几何走查里没有锚点。reviewer 的替代证据：
        · AttributionPage:663：ml-3→gap-3 的 12px 等价推理 + JSX 空白规则，
          数学上封闭（§3.3）；
        · /chat 气泡 break-all/break-words：CSS overflow-wrap 是回退型属性，
          桌面 0 diff 已实证「放得下时不触发」，窄屏「放不下时生效」是 CSS 规范
          保证的行为，不依赖实测；
        · Toast/BackToTop 的 pb-safe-* 替换为 env()+0 数学等价（§3.5）；
        · ≥1280 面板展开态：本轮所有新增类对 ≥1280 桌面均不生效（§3.7 扫描），
          唯一桌面可见变化是 GraphPage 的 ResizeObserver（§2.4 已定位为噪声）。
        综合判断：**覆盖盲区均有替代证据链，残余风险为 L 级以下**。
INFO-4 「原地 vite build」未在最终代码上跑（§1.3 原因）——与 implementer 自述一致，
        属环境限制非代码问题；构建通过的证据来自 implementer 的 --outDir 版本 +
        本轮像素级实测（构建产物是像素差异的间接载体，像素 0 diff 反向佐证产物正常）。

--------------------------------------------------------------------------------
6. 计划偏离清单（逐条核对，均已在 implementer 报告 D-01~D-05/E-01/E-02 自报）
--------------------------------------------------------------------------------

P-01  Layout.tsx 的 min-h-screen→min-h-dvh 提前到 B1（计划排 B3）—— 理由成立
      （breakpoints.test.ts ⑦ 同批新增，拆批会留红用例），影响面 1 行，像素等价。**接受**。
P-02  Layout.tsx 的 px-6→px-4 nav:px-6 随 B2（计划排 B3）—— 理由成立（D9 要求
      TopNav 与 Layout 同批保左基线不变量，避免破窗期）。**接受**。
P-03  MobileNav 抽屉底 pb-safe→pb-safe-3 —— 数学上 pb-safe 单独用会把非刘海设备的
      12px 底距变 0，pb-safe-3 才是「避让 + 原 pb-3」的本意。**接受**（并衍生 M1）。
P-04  背景幕 aria-label 用「点击空白处关闭导航菜单」而非计划 4.3 的「关闭导航菜单」
      —— 沿用 Layout.tsx:96 既有裁决 D25（同名会读屏歧义），与头部关闭键区分。**接受**。
P-05  B3 不再改 Layout.tsx —— 是 P-01/P-02 的结果。**接受**。
E-01  responsive-audit.cjs 额外实现 --probe-nav —— 属工具自研范围，未碰业务代码，
      是抽屉无障碍的唯一可复算取证手段。**接受**。
E-02  走查宽度 5 档扩到 7 档（+767/+720）—— 按总控补充要求。**接受**。
（P-01~P-05/E-01/E-02 均已在 implementer 报告「九、」自报，与实盘 commit 内容一致，
  无隐瞒偏离；无未自报的发现。）

--------------------------------------------------------------------------------
7. 红线与纪律核查（逐条实测）
--------------------------------------------------------------------------------

· answer/solution_steps 未下发：本轮 7 个 commit 的 name-only 清单中**无任何**
  functions/ 或 packages/ 文件（仅 apps/web/**、tools/responsive-audit.cjs、
  _pipeline/**、LOOKATME.md），后端红线无接触面。**通过**。
· 算法参数零硬编码：grep 全部改动文件，无 BKT/选题/归因相关常量；无任何引擎文件
  被改。**通过**。
· router.tsx 的 ROUTES/navRoutes 未改：git diff c085db1..61c1d3b -- apps/web/src/router.tsx
  输出为空（逐字验证）。**通过**。
· 4 份冻结文档未改：git diff c085db1..61c1d3b -- README.md 知微-项目介绍.md
  _pipeline/PR-tempdeploy.md tools/e2e-smoke.cjs 输出为空（逐字验证）；LOOKATME.md
  的改动（61c1d3b）属计划 B6 明文允许的文档更新。**通过**。
· 每批独立 commit 且未混提：7 个 commit 的 name-only 逐条核对（§3.6 之外另核），
  B0 仅工具+基线产物、B1–B5 各自文件与计划「九、」清单一一对应、B6 仅文档/走查
  产物/工具增强；**无跨批混提、无把 README.md/知微-项目介绍.md/_pipeline/PR-tempdeploy.md/
  tools/e2e-smoke.cjs 扫进提交**（git log 逐 commit name-only 验证）。
  工作区当前仍有他人未提交变更（M tools/e2e-smoke.cjs、M _pipeline/01_PLAN.md、
  ?? _pipeline/PR-tempdeploy.md、?? 知微-项目介绍.md、?? _pipeline/archive/01_PLAN_*.md），
  与计划基线描述一致，未被本轮污染。**通过**。
· _pipeline 归档纪律：_pipeline/archive/ 下已有 01_PLAN_20260924_2047.md、
  02_EXEC_REPORT_20260924_2154.md、03_REVIEW_20260924_1915.md、
  03_REVIEW_20260924_2213.md（本轮 reviewer 自己追加），全部只增不删。**通过**。

--------------------------------------------------------------------------------
8. 未覆盖项与残余风险（诚实盘点，reviewer 判定）
--------------------------------------------------------------------------------

U1  「原地 vite build」未跑（INFO-4）—— 残余风险 L：像素实测与 implementer 的
    --outDir 构建证据足以支撑判定；若需闭环，可在非沙箱环境补跑一次。
U2  沙箱无法起 dev server + Edge 复跑真浏览器走查 —— 本轮抽屉交互与窄屏采样的
    证据采信的是入库的 audit JSON / compare JSON / probe 日志 / 截图（reviewer
    逐份读过并做了独立像素级与几何级复核，非仅看日志结论）；残余风险 L。
U3  面板打开态（≥1280 挤压正文列）下的几何对比未跑（implementer 与本轮同）——
    但本轮所有新增类对 ≥1280 不生效（§3.7），唯一桌面可见变化是 GraphPage 的
    ResizeObserver（§2.4），故该盲区的实际风险为 INFO 级。
U4  720 边界的后续处置（§4.3）：建议保持现状 + 把正确事实写进遗留；若总控选择
    修复，须单独立项并带独立走查。

--------------------------------------------------------------------------------
9. 判定依据汇总
--------------------------------------------------------------------------------

· 桌面像素级零变化（第一验收项）：像素级 + 几何级 + 字节级三重证据一致成立；
  两处 DIFF（login 动画相位 / graph 亚像素抗锯齿）均已定位到机制且不涉及布局。
· 互斥/无障碍路径：代码分支 + 真浏览器探针日志双向闭合，无循环依赖。
· 断点单一来源、z 令牌、裸 hex、min-h-dvh、viewport-fit：独立 grep 全部 0 命中；
  breakpoints.test.ts 的禁止清单正则经实测无误伤。
· 测试/类型检查：reviewer 亲跑三批 + 三段，exit 0，362/32 与自述与计划逐数吻合。
· 红线与纪律：7 项逐条实测通过。
· 唯一 M 级问题（.pt-safe 死代码）不涉及像素/功能/安全；L 级 4 条均为可维护性
  或工具精度类；无 H 级问题。

按判定纪律（只有 L/INFO 则 PASS；存在 H 必 FAIL）：**本审查判 PASS**。

审查人：reviewer（AI）
本报告完
VERDICT: PASS