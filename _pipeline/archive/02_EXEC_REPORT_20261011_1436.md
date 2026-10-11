知微 · style-10「青蓝蓝图」全站视觉迁移 —— 第 2 轮执行报告（P6 /report 首迁页）
================================================================================
执行角色：implementer（严格按 _pipeline/01_PLAN.md 第 8 版逐项执行）
执行日期：2026-10-11（本机时间 12:39 起）
依据计划：_pipeline/01_PLAN.md 第 8 版（2026-10-11 12:39，P6 细化版 + D13/D14/D15 裁决）
基线：git HEAD = e96c702（tempui-doc 分支，rev-list --count = 185）
结束：git HEAD = dcda2b9（rev-list --count = 190，本轮 5 个提交）
工作目录：/Users/Merryou/LearnBuddy/zhiwei
$NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
$WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
归档：旧版执行报告（P0–P5 轮）已先复制为
  _pipeline/archive/02_EXEC_REPORT_20261011_1311.md
  （两侧 md5 = 6acad0a321383af829c423d97c218dd1，一致；归档只增不删）


--------------------------------------------------------------------------------
一、结论摘要
--------------------------------------------------------------------------------
P6.0–P6.5 全部完成，检查点⑤要求的产物齐备，验收判据全部取得证据、全部达成：

  · vitest 三批全绿：apps/web 208 / packages 43 / functions 202 = 453 用例
    （42 个测试文件；基线 451 → +2，只增不减）
  · tsc 三段 exit 0（packages/engine · functions/api · apps/web）
  · build 等价口径通过：vite build --outDir /tmp/zhiwei-web-build-p6（exit 0）
  · F-01 判据：audit-style10-375.json 中 /report 的 overflowPx = 0
    （浅色档 0；暗色档副本 audit-style10-375-dark.json 同为 0）
  · 走查：双主题 × 1440/1024/768/375 四档，8 组合 × 11 路由 = 88 张截图，
    页面级横向溢出全档全页 0px（768-light 本轮必采，清偿第 1 轮 D-05）
  · 冻结区检查：两条 git --no-pager diff 命令均为空输出（exit 0）

本轮提交 5 个（计划预计 3 个；多出的 2 个是走查修复与走查产物，见「七、偏差」D16/D17）：
  d050fcb  P6.0 记账入库（计划第 3 个提交位之外的第 1 个，计划内）
  ddc6eca  P6.1 M-1 裁决落地：Sheet 内边距补 token 对齐规范 §4.2
  7935705  P6.2 /report 视觉层重写 + F-01 修复（主体）
  a169874  P6b 走查修复（计划外第 4 提交，偏差 D17）
  dcda2b9  P6 走查产物重采 + /report 四态取证探针（计划外第 5 提交，偏差 D17）


--------------------------------------------------------------------------------
二、逐步执行状态（P6.0 → P6.5）
--------------------------------------------------------------------------------

P6.0 记账入库 —— 完成
  commit d050fcb「style10记账: 01_PLAN 第8版(P6 细化+M-1/F-01 裁决)+第7版归档+第1轮审查报告入库」
  变更文件（白名单显式 git add，逐个列出，未用 git add -A / .）：
    _pipeline/01_PLAN.md（第 8 版）
    _pipeline/03_REVIEW.md（第 1 轮 PASS 报告）
    _pipeline/archive/01_PLAN_20261010_2109.md（第 6 版归档件，untracked → 入库）
    _pipeline/archive/01_PLAN_20261011_1239.md（第 7 版归档件 → 入库）
    _pipeline/archive/03_REVIEW_20261011_0029.md（审查报告归档件 → 入库）
  检查命令与结果：
    git --no-pager diff --name-only HEAD -- _pipeline   → 空输出（exit 0）✔
  未触碰：_pipeline/PR-tempdeploy.md（他人产物）仍在 untracked，未入库。

P6.1 M-1 裁决落地：Sheet 内边距补 token 对齐规范 §4.2 —— 完成
  commit ddc6eca「style10P6a: Sheet 内边距按规范§4.2/原型补 token 对齐(M-1 裁决)」
  变更文件与关键位置：
    apps/web/tailwind.config.js —— theme.extend 新增 spacing 块（+34 行）：
      pad-frame-md-y '22px' / pad-frame-md-x '18px' / pad-frame-md-b '12px' /
      pad-frame-sm-b '10px'，注释指向规范 §4.2 与原型 L40/L140/L680/L681
    apps/web/src/components/blueprint/Sheet.tsx —— 抽出 SHEET_PADDING 常量并替换
      main 的 className（原 L118 一行 → 常量 + 注释块，前后值对照见「五、M-1」）；
      SheetHead / SheetBlock / aside 结构一行未动
    apps/web/tests/tokens.test.ts —— 新增 describe「⑬ 图纸内边距 token」2 条用例
      （只增；既有 21 条断言一字未改，文件头 ①–⑫ 清单补一行 ⑬）
    tempui/STYLE-10-设计系统规范.md —— §4.2 矩阵四行「Sheet 内边距」列补垂直值
      （原值 '48px' / '22px 18px' / '16px 12px' 逐字保留）+ 表下一段只增留痕说明
  测试命令与逐条结果（各条独立执行）：
    $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/tokens.test.ts
      → 首跑 1 failed / 22 passed：我新加的断言把 Sheet.tsx 注释里举例的
        「pt-[22px]」当成裸任意值命中（注释行未排除）。按本文件 ⑧/⑩/⑪ 既有口径
        （注释行不算）修正为跳过注释行后复跑 → 23 passed（21 原始 + 2 新增）✔
    $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests → 21 files / 208 passed ✔
    $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json → exit 0 ✔
    $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
      --outDir /tmp/zhiwei-web-build-p6m1 → built in 3.77s, exit 0 ✔
    产物抽验：dist CSS 中 narrow\:pt-pad-frame-md-y{padding-top:22px}、
      sheet\:pt-12{padding-top:3rem}、sheet\:px-12{padding-left/right:3rem} 均在 ✔
    3.2 冻结区检查 → 两条命令空输出（exit 0）✔

P6.2 /report 视觉层重写 + F-01 修复（主体） —— 完成
  commit 7935705「style10批1: /report 学习报告——五节制式+细网格表+四态落位+打印样式」
  变更文件与关键位置：
    apps/web/src/pages/ReportPage.tsx —— 整页重写（+703/-237 计）
    apps/web/src/index.css —— 新增 .bp-tbl-wrap/.bp-tbl 细网格表制式（含 ≤900 转卡片）
      + 打印块补齐（按原型 L784-804）+ .print-only（+226 行）
    apps/web/src/components/blueprint/Sheet.tsx —— 新增导出 sheetDimText()（+13 行）
    apps/web/src/components/Layout.tsx —— 新增 PAGE_OWNED_HEAD 登记表 + head 传 undefined
      + dim 改用 sheetDimText（+37/-6）**计划外文件，偏差 D16，见「七、」**
  逐段复现勾稽（对照原型行号）：
    ① 页头 L2944-2946 → SheetHead{eyebrow 'REPORT / 汇总与验证'、sheetNo '10-12'、
       section '2.12'、h1 '学习报告 · 按空间汇总'、sub 含空间名（num-mono）、
       chips <Badge tone="accent">T0 · 可打印</Badge>、dim sheetDimText(tier)} ✔
    ② 打印条 L2947-2949 → <section data-print="hide"> btn primary「打印 / 留存为 PDF」
       + tok「打印样式：隐藏导航与标注、白底黑字、表格不截断」；
       window.print() 与 data-print='hide' 接线（P3-4 成果）原样保留 ✔
    ③ 01 一句话总评 L2950-2955 → .bp-panel #verdict：Badge tone="negative" 档位短标
       + tok 两口径如实并列（缺口清单 N 处 · 掌握度低于 0.40 节点 M 个）
       + text-title-sm(17px) 正文（summaryLine 原样）+ 口径 hint ✔
    ④ 02 掌握度四档分布 L2956-2963 → .dist 条形（BandMark 档名 + 条形 + num-mono 计数）
       + .bp-tbl「分档明细」（档位/个数/占比/知识点 chips）✔
    ⑤ 03 缺口清单 L2964-2966 → .bp-tbl（知识点/掌握度/档位/最近一次归因/出路
       「去补习」·「看先修链」）✔
    ⑥ 04 基线与复测对比 L2967-2970 → .bp-tbl ΔAccuracy（▲/▼/不可算）+ 说明列
       + print-only「主结果」行 ✔
    ⑦ 05 从缺口出发 L2971-2973 → data-print="hide" 包裹；btn primary「去对话页补一补」
       + secondary「看技能树」+ NextStepCard 内容语义（缺口最前者 + 两条出路）并入 ✔
    原型 06「三种空状态（口径说明）」不复现（D15a）✔
  四态落位：
    loading → SkeletonLines rows=4 block（PageSkeleton 不再被本页引用，组件保留）✔
    失败    → Stamp 红章 + 真重试 + alt「回到学习空间」；toast 保留（见偏差 D18）✔
    无空间  → SheetHead（本页用途说明版）+ EmptyState tag="NO SPACE" 现有文案 ✔
    无数据  → 两块虚线空盒 NO DATA / NO DELTA（原型 _reportEmpty 双盒）✔
  F-01（D14 结构修法）：五节纵向堆叠，无 lg:grid-cols-2 双卡、无 min-w-[420px]、
    无横滚表；保留的 grid 子项一律 min-w-0（dist 行 / 表格容器）✔
  测试命令与逐条结果：
    tsc apps/web → 首跑 2 处 TS2322（我误把 Sheet 默认导出当 SheetHead 导入）→ 改为
      具名导入 { SheetBlock, SheetHead, sheetDimText } 后 → exit 0 ✔
    $NODE .../vitest.mjs run apps/web/tests → 208 passed ✔
    tsc packages/engine → exit 0 ✔ ; tsc functions/api → exit 0 ✔
    vite build --outDir /tmp/zhiwei-web-build-p6 → exit 0 ✔
    产物抽验：bp-tbl 制式、attr(data-label)、not all and (min-width: 900px)、
      #sheet{padding:0!important}、.print-only{display:none}/{display:block!important} 均在 ✔
    6.3 静态纪律四条（含该页零一次性样式抽查）：
      grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src → 无匹配（exit 1）✔
      grep -rn "z-\[" apps/web/src → 无匹配 ✔
      grep -rn "fonts.googleapis\|fonts.gstatic" apps/web → 无匹配 ✔
      grep -n -E "className=\"[^\"]*#[0-9a-fA-F]{3,8}|min-w-\[" .../ReportPage.tsx
        → 首跑命中 1 行：文件头注释里举例写的「min-w-[420px]」（非类名）。改写该注释后
          复跑无匹配 ✔（页面内唯一的 inline style 是条形宽度 calc(share% - 2px)，
          属数据驱动几何，与 BandMark 既有写法同源，非装饰性内联样式）
    3.2 冻结区检查 → 空输出 ✔

P6.3 测试收口（并入 P6.2 提交） —— 完成
  既有纯逻辑测试 0 个改期望（percent/deltaPercent/kpName/summaryLine/phrases/
  routerGuard/sse/client/chatPanel/mobileNav/dialogStore/graphMastery/graphSnapshot/
  reveal/phrases/stages/bands/breakpoints/themeStore/blueprint 全部一字未改）；
  唯一新增 = tokens.test.ts ⑬ 的 pad-frame 断言（2 条）+ 文件头 ⑬ 清单行（新增）。
  /report 无渲染测试（沿用不引渲染测试栈的纪律），四态与版式由走查验收。
  用例总数：451（基线）→ 453（+2），只增不减 ✔
  最终全量三批：208 / 43 / 202 全绿。

P6.4 走查（双主题 × 1440/1024/768/375） —— 完成
  服务：esbuild 打包 functions/api/src/server.ts → dist/server.js；$NODE 后台运行
  :8787（日志 /tmp/zhiwei-api-p6.log）；vite --config apps/web/vite.config.ts 后台
  :5173（日志 /tmp/zhiwei-web-p6.log）；两端均就绪（web 200）。
  命令形态说明（偏差 D19）：计划 P6.4 的 8 条命令未含 ZHIWEI_AUDIT_OUT，脚本默认产物
  目录是 _pipeline/screenshots/mobile；本轮按 P5 既有产物目录补
  ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10。
  八条命令（逐条独立跑，防 60s SIGKILL）与结果：
    dark 1440 → 页面级溢出合计 0px；/report 0px
    dark 1024 → 0px；/report 0px
    dark  768 → 0px；/report 0px
    dark  375 → 0px；/report 0px
    light 1440 → 0px；/report 0px
    light 1024 → 0px；/report 0px
    light  768 → 0px；/report 0px（本轮必采：清偿第 1 轮 D-05）
    light  375 → 0px；/report 0px
  首采后走查发现两处版式缺陷，修复（commit a169874）后**八条全部重采一遍**，
  上表即重采结果（截图与 JSON 与最终代码一致）：
    缺陷 1（768/≤900 档）：.bp-tbl 转 display:block 后 caption（display:table-caption）
      在块级父盒里退化成最小内容宽度，「分档明细」被压成一列竖字 → 窄档补
      .bp-tbl caption{display:block;width:100%}（原型 L707-720 未覆盖，按 D9 只增留痕）
    缺陷 2（1440 档）：分档明细「档位」列被宽列挤窄，「待巩 / 固」拆两行 →
      两处表格的档位单元格加 whitespace-nowrap
  产物清单（只增不删，同名覆盖允许）：
    走查截图 88 张：style10-<1440|1024|768|375>-<dark|light>-<11 路由>.png
      （8 组合 × 11 路由；本次重采全部刷新）
    审计 JSON 8 份：audit-style10-<档>.json（= 浅色档，最后一次采样）+
      audit-style10-<档>-dark.json（暗色档副本，只增；脚本按宽度命名会覆盖同名文件，
      故暗色档先复制留证，两套数字都在）
    四态截图 8 张：state-1440-light-<normal|loading|error|no-data>.png、
      state-375-dark-<同四态>.png
    探针日志 2 份：last-state-probe-1440-light-log.txt、last-state-probe-375-dark-log.txt
  复核点：
    a) 五节结构与原型对照 —— 逐段勾稽见上（P6.2 ①–⑦），1440/768 截图人工核对 ✔
    b) 375 档 /report overflowPx=0 —— 见「六、F-01」✔
    c) M-1 后 4 档无横向溢出、页头不叠字 —— 8 组合全 0px；页头为单 h1（D16 后外壳不再
       补第二份）✔
    d) 四态截图：loading（骨架）/ error（红章）/ no-data（双空盒）三态已取到真图；
       **无空间态取不到**——router.guardPath（冻结区）在「已登录 + 无活跃空间」时把
       /report 重定向到 /spaces，该分支只能由「页面已挂载时空间被清空」触发，
       无导航取证路径；探针按 R12 口径如实记录，不伪造（见「八、」）
    e) 768-light 已采 ✔

P6.5 交付物三件套与停点 —— 完成
  a) 双主题截图：4 档 × 2 主题 = 8 组合 × 11 路由 88 张（含 375 档）+ 四态 8 张
  b) 变更说明：本报告第三/五/六/七节即逐段复现清单、接回清单、测试改动清单、
     M-1 三处同源勾稽表、D15a–e 逐条留痕
  c) vitest/tsc/build 输出摘录：见「四、」；build 用 /tmp 等价口径（L-1 留痕）
  停点：本轮交付后停，交 reviewer 按检查点⑤口径 VERDICT。


--------------------------------------------------------------------------------
三、计划步骤完成状态一览
--------------------------------------------------------------------------------
  [✔] P6.0 记账入库（d050fcb）        检查命令空输出
  [✔] P6.1 M-1 token 对齐（ddc6eca）  三处同源齐备，门禁 +2 用例全绿
  [✔] P6.2 /report 重写 + F-01（7935705）  逐段复现 ①–⑦ 全落，业务逻辑零改动
  [✔] P6.3 测试收口（并入 7935705）   0 个既有测试改期望，用例只增（451→453）
  [✔] P6.4 走查（dcda2b9）            8 组合 × 11 路由全 0px + 四态 6 张真图
  [✔] P6.5 三件套                     本报告 + 截图 + 输出摘录
  [ ] P7（/graph ECharts）不在本轮（照旧排队）


--------------------------------------------------------------------------------
四、测试 / 类型 / 构建输出摘要（最终代码）
--------------------------------------------------------------------------------
  1) $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
     → Test Files 21 passed (21) / Tests 208 passed (208)（tokens 23 含新增 2 条）
  2) $NODE $WS/node_modules/vitest/vitest.mjs run packages
     → Test Files 2 passed (2) / Tests 43 passed (43)
  3) $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
     → Test Files 19 passed (19) / Tests 202 passed (202)
     合计 42 files / 453 tests 全绿（基线 451，只增不减）
  4) $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
     → exit 0
  5) $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
     → exit 0
  6) $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
     → exit 0
  7) $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
       --outDir /tmp/zhiwei-web-build-p6
     → ✓ built in 4.43s，exit 0（等价口径，规避沙箱批量删除闸门；L-1 留痕）
  8) 冻结区检查（每批提交前 + 收尾各跑，期望空输出）：
     git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api
       packages/engine functions data   → 空输出（exit 0）
     git --no-pager diff --name-only HEAD -- apps/web/src/stores → 空输出（exit 0）
     （P6 未动任何 store，本轮连 theme.ts 也未触碰 ✔）
  9) 6.3 静态纪律四条 → 全部无匹配（任意值断点 / 裸 z-index / CDN / 该页一次性样式）
 10) 冻结区行为证据：routerGuard / sse / client / chatPanel / mobileNav / dialogStore /
     graphMastery / graphSnapshot / reveal / phrases / stages / authStore 等测试文件
     本身未改且全绿 ⇒ 冻结区未被破坏。


--------------------------------------------------------------------------------
五、M-1 落地证据（Sheet 内边距向规范 §4.2 对齐）
--------------------------------------------------------------------------------
  Sheet.tsx 前后值对照（四档，值 = 上/左右/下）：

    档位（工程断点）              改前                改后              依据
    ─────────────────────────────────────────────────────────────────────────────
    base（sm，<420）              24/16/16            16/12/10          原型 L681
    narrow:（md，420–899.98）     24/16/16            22/18/12          原型 L680
    sheet:（lg/xl，≥900）         24/24/16            48/48/16          原型 L140+L40
    annos:（≥1180）              12/48/16（单列）    同 lg/xl（删 annos:px-12 分支）

  改前类串：px-4 pb-4 pt-6 narrow:px-4 sheet:px-6 annos:px-12
  改后类串：pt-4 px-3 pb-2.5 narrow:pt-pad-frame-md-y narrow:px-pad-frame-md-x
            narrow:pb-pad-frame-md-b sheet:pt-12 sheet:px-12 sheet:pb-4
  三处同源（缺一不可，已逐一勾稽）：
    ① tailwind.config.js：extend.spacing 四个具名 token（pad-frame-md-y 22px /
       pad-frame-md-x 18px / pad-frame-md-b 12px / pad-frame-sm-b 10px）
    ② tempui/STYLE-10-设计系统规范.md §4.2：矩阵四行补垂直值（原值逐字保留）+ 留痕说明
    ③ apps/web/tests/tokens.test.ts ⑬：两条断言（token 存在且值对 + Sheet 内边距
       无裸任意值类）
  端点点差留痕（D13b 性质，同既有 nav:720）：原型 md 档是 421–900、lg 档 901 起；
  工程断点 narrow:420 / sheet:900（D1 具名断点）⇒ 恰好 420px 与 900px 两处归属相差
  1px，不为此改断点（D1 的价值是全站只有一套边界）。
  token 使用情况说明：四个 token 中 pad-frame-sm-b(10px) 本轮**未被类名引用** ——
  计划 D13b 明确指定 base 档用默认刻度的 pb-2.5（同为 10px），故 token 按 D13a 定义、
  由 ⑬ 断言锁定，作为「规范值的具名来源」保留；md 三个 token 已被 Sheet 实际消费
  （产物 CSS 可见 narrow\:pt-pad-frame-md-y{padding-top:22px}）。
  影响面（R11）与实测：lg 档图纸内边距 24→48（内容区变窄）波及全部未迁移页 —— 属规范
  正确值落地而非回归；本轮 8 组合走查全站 0px 溢出、页头无叠字，未迁移页无挤压破坏。


--------------------------------------------------------------------------------
六、F-01 落地证据（375 档横向溢出 95px → 0）
--------------------------------------------------------------------------------
  根因（第 1 轮取证 + 本轮复看 audit-style10-375.json 溢出元素清单）：
    旧页面 lg:grid-cols-2 双卡 grid 里放了带 min-w-[420px] 的表格 ⇒ 单列轨道的
    min-content 被撑到 454px（溢出元素 cls="rounded-surface border border-line
    bg-surface p-4 shadow-card" w=454，左右 16→470）⇒ 页面级 scrollWidth 470。
  修法（D14 结构修法）：按原型 PAGES.report 的纵向 section.block 堆叠重写 ——
    双卡 grid 与 min-w-[420px] 同时消失（根因消除）；保留的 grid 子项一律 min-w-0；
    表格窄档走 .bp-tbl 的 data-label 转卡片（原型 L707-720），不再需要横滚。
  判据数据（最终代码，重采后）：
    audit-style10-375.json（浅色档）：/report overflowPx = 0，innerWidth 375，
      scrollWidth 375，溢出元素清单长度 0
    audit-style10-375-dark.json（暗色档）：/report overflowPx = 0
    其余三档（1440/1024/768）双主题：/report 0px；页面级合计 0px


--------------------------------------------------------------------------------
七、执行偏差与裁决留痕（逐条）
--------------------------------------------------------------------------------
D16【计划外文件 · Layout.tsx】迁移页自持页头（新增登记表 + dim 同源）
  现象：外壳 Layout 给**每个**页面都补一份通用页头（eyebrow = 路由 label、h1 = 路由
    label、dim）。P6.2 要求 /report 按原型渲染自己的页头（eyebrow 'REPORT / 汇总与验证'、
    h1 '学习报告 · 按空间汇总'、sub 内嵌当前空间名、chip 'T0 · 可打印'）——这些数据
    只有页面拿得到。若外壳照旧补一份，一页会出现两个 h1（P5 截图实测已存在
    「学习报告」+ 页面标题两份，迁移后会更明显）。
  处置：在 Layout.tsx 增 PAGE_OWNED_HEAD 登记表（'/' 到 '/report' 一行），登记的路径
    head 传 undefined，由页面渲染；同时把 dim 文本抽成 Sheet.tsx 导出函数
    sheetDimText(tier)，外壳与页面共用一份（避免第二份格式串）。
  性质：**计划未列 Layout.tsx**（P6.2 涉及文件只写 ReportPage.tsx + index.css），
    属计划外改动。理由与最小性：这是「首个迁移页」必然带出的外壳机制，且是达成
    计划 ① 页头复现与「一页一个 h1」的最低成本做法（备选「页面不管页头」会丢掉
    原型页头文案与 T0 chip，且外壳仍会给出与原型不符的标题）。
  影响面：仅 /report 一行；未迁移页继续吃通用页头（共存策略不变）；
    router.tsx / 守卫 / 外壳结构一行未动。
  留痕：Layout.tsx 内注释指回本条。

D17【计划 3 个提交 → 实际 5 个】走查修复与走查产物各占一个提交
  计划：本轮提交数 3（记账 1 + token 1 + 页面 1）。
  实际：走查发现两处版式缺陷（表格 caption 竖排、档位列折行），修复需落在独立提交
    才可单独 revert ⇒ a169874；走查/探针产物按 P5 惯例单独入库 ⇒ dcda2b9。
  回滚关系不变：P6.1 token 与 P6.2 页面的依赖关系照旧（回滚 P6.1 须先回滚 P6.2）。

D18【D15c 的实现取法】失败态「派生」而不是在冻结的取数 effect 里上报
  计划冲突点：D15c 要求「组件内新增 error state + 重试回调」，同时要求「取数
    useEffect 与守卫分支零改动」。两条同时满足的唯一做法是：失败由既有状态**推导**——
    成功必然落 report，故「取数已落定（loading 已转 false）且 report 仍为空」⇔ 首次
    取数失败。为此新增两条最小状态：retrying（重试在途）与 loadedSpaceId（落定的那次
    取数属于哪个空间；用它挡住「切换空间在途窗口被误判为失败、闪一顶红章」）。
  改动边界：取数 useEffect **逐字符未改**（含 reportSummary 调用、cancelled 清理、
    依赖数组 [activeSpaceId]）；守卫顺序仍是「无空间 → loading → 数据态」，失败分支
    插在 loading 之后、数据态之前（属新增落点，D15c 授权）；重试复用同一
    reportSummary（真重试，D10）。
  toast 保留：冻结 effect 内的 catch 仍走既有 toast 话术（未动），故失败时红章与
    非阻断 toast 并存；按计划「保留与否随 Stamp 落位一并留痕」→ 保留（避免改动冻结块）。
  验证：tests/probe 注入 report/summary 失败后获得真图
    （state-1440-light-error.png：红章 + 原因 + 重试一次 + 回到学习空间）。

D19【走查命令形态】计划 P6.4 八条命令补 ZHIWEI_AUDIT_OUT
  计划给的命令只带 ZHIWEI_AUDIT_THEME；脚本默认产物目录是 _pipeline/screenshots/mobile。
  本轮补 ZHIWEI_AUDIT_OUT=.../_pipeline/screenshots/style10，与 P5 既有产物同目录
  （否则会污染 mobile 基线目录）。八条命令其余部分逐字照用。

D20【原型 vs 计划的细节取舍（逐条，均为「以原型为准」口径）】
  a) 02 节条形分母：计划 ④ 括注写「条宽 = count/maxCount」，原型 L2960 是
     count/总知识点数。取原型（占比与相邻「占比」列同义，且 5.1① 规定版式按原型）；
     遂删去 maxCount 中间量。留痕。
  b) 总评 chip 文案：原型 chip 里放三档措辞短标。本工程 summaryLine 是整句，故 chip
     用同阈值的档位短标（没有缺口 / 少量缺口 / 缺口较多），正文用 summaryLine 整句；
     短标属**新增展示文案**（D5 / D15b 同口径，不进 phrases 逐字锁定范围）。
  c) 口径 hint 不写数字阈值：原型 hint 抄需求 2.12 的「缺口 ≥5 / 1–4 / 0」，而本工程
     summaryLine（冻结、一行不改）的边界是 0 / 1–3 / ≥4，写前者会与界面实际行为不符，
     故 hint 改为不含量化阈值的口径说明（不改动 summaryLine 的阈值）。
  d) 03 节「最近一次归因」列：原型展示归因长编号（ATTR-…），但契约 #19 只给
     error_type_last（枚举），故该列沿用既有语义（ERROR_TYPE_LABEL 或 '—'，D5 文案照用），
     并以「不截断、可换行」满足「完整可复制」的原型意图；不为此新增数据请求。
  e) 03 节表 caption：原型写「缺口 · 按掌握度升序」，而服务端 gaps 由 mastery 按图谱
     顺序过滤而来（非升序），故 caption 改为「缺口 · 掌握度低于 40%（服务端口径）」，
     避免 caption 与真实排序不符。
  f) 06 节（三种空状态口径说明）不复现（D15a 已裁决）。
  g) 04 节的 awwwards 大数字头版（旧页 heroRow 编辑式排版）按原型 04 段取消，
     改为节标题右侧 chip + 纸上 print-only 行；heroRow（Δ 最大者的选取）逻辑保留，
     仍用于这两处；SuccessMark 在本页不再引用（组件本身仍被 PracticePage/GraphPage 使用）。
  h) 05 节仅在 gaps.length > 0 时渲染（沿用旧页「有缺口才给路标」的既有语义；原型是
     MOCK 常量常显）。
  i) 无数据态 NO DATA 盒标题取原型「还没有可汇总的数据」（hint 与两条出路照用现有引导）。

D21【新增基建文件】tools/probe-report-states.cjs（四态取证）
  计划 P6.4 d) 要求四态截图，但走查工具每个路由只采默认态、无法注入条件；按既有惯例
  （probe-dock-click.cjs / probe-nav-rotate.cjs）新增一个**只取证、不下结论、不打闸门**
  的探针（计划 6.2 明示 tools/ 属基建可改）。它用 CDP 向页面注入 fetch 包装
  （report/summary 失败 / 挂起）与真实调 /api/space/create 建空空间，不碰任何业务代码、
  不改后端。产物命名 state-<宽>-<主题>-<态>.png，与走查截图同目录、只增不删。
  已知副作用：探针在 e2e 账号下建了 2 个空空间（无删除接口），但 /api/space/list 的首项
  仍是原空间 sp_muf82zhx02br0（实测清单首项 = 初中数学），故走查脚本选空间的行为不变、
  证据可复现；两条空间仅是多出来的记录。

D22【已知陈旧注释，未改】apps/web/tests/breakpoints.test.ts 文件头白名单注释里仍写着
  「ReportPage 的 min-w-[420px]：宽度工具类……是 ② 的合法保留项」。本轮该写法已从
  ReportPage 移除，注释随之陈旧；按计划 3.3「本轮改期望仅 tokens.test.ts」的口径，
  未改动该测试文件（连注释也未动），在此留痕。


--------------------------------------------------------------------------------
八、未完成项与已知限制（如实记录，不隐藏）
--------------------------------------------------------------------------------
1) 无空间态截图未取得（探针如实记录，非伪造）：
   router.guardPath（冻结区）在「已登录 + 无活跃空间」时把 /report 重定向到 /spaces，
   该分支只能由「页面已挂载后空间被清空」触发，无导航取证路径。按 R12 口径留痕说明，
   不伪造截图；分支本身已按原型 L2914-2918 实现（代码可见，测试未覆盖，走查未截图）。
2) 四态截图覆盖的主题/宽度：error / loading / no-data 三态在 1440-light 与 375-dark
   各一套（8 张）；未再按 4 档 × 双主题穷举（计划只要求「四态截图」，未指定档位组合）。
3) pad-frame-sm-b token 本轮无类名引用（原因见「五、」末尾），由 ⑬ 断言锁定。
4) 探针在 e2e 账号留下 2 个空空间（服务端无删空间接口）；不影响走查选空间与结果。
5) 未参与本轮的功能面（照计划边界）：P7 /graph ECharts 改造、P8–P12 各页、状态实验室
   不迁移；NextStepCard / PageSkeleton / SuccessMark 组件保留未删（供未迁移页）。


--------------------------------------------------------------------------------
九、工作区与红线遵守声明
--------------------------------------------------------------------------------
· 冻结区一行未动：router.tsx 全文件、api/ 全部、stores/ 全部（本轮连 theme.ts 也未动，
  第二条冻结区检查多次复跑均为空输出）、packages/engine、functions/、data/、四份契约文档。
· ReportPage 冻结项零改动：取数 useEffect（reportSummary 调用 / cancelled 清理 /
  依赖数组）逐字符未改；守卫分支顺序（!activeSpaceId → loading → 数据态）未变；
  summaryLine / percent / deltaPercent / kpName 与 UI_TEXT / ERROR_TYPE_LABEL 文案常量未改。
· 测试：不删断言、用例只增（208/43/202，合计 453 ≥ 451）；仅 tokens.test.ts 新增 2 条。
· 他人未提交变更一律未碰：tempui/需求输入（含 D tempui/纯前端需求文档.md 的删除状态）、
  tempui/prototypes/、tempui/qa-report.json、_pipeline/PR-tempdeploy.md、.workbuddy/、
  node_modules/、package-lock.json 均未 add、未改、未回退。
· 无无关格式化/重构/依赖升级；INDEX/依赖清单未变（无 package.json 改动）。
· 未删除 _pipeline/01_PLAN.md（仅 P6.0 原样入库）；_pipeline/archive/ 与
  _pipeline/screenshots/ 产物只增不删。


--------------------------------------------------------------------------------
十、提交清单（本轮，全部入库）
--------------------------------------------------------------------------------
  d050fcb  style10记账: 01_PLAN 第8版 + 第7版归档 + 第1轮审查报告入库
  ddc6eca  style10P6a: Sheet 内边距按规范§4.2/原型补 token 对齐(M-1 裁决)
  7935705  style10批1: /report 学习报告——五节制式+细网格表+四态落位+打印样式
  a169874  style10P6b: 走查修复——表格 caption 转块级 + 档位列 nowrap
  dcda2b9  style10P6走查: 双主题×4档截图与审计 JSON 重采 + /report 四态取证探针
  归档（不在功能提交内，只增）：_pipeline/archive/02_EXEC_REPORT_20261011_1311.md
  本报告：_pipeline/02_EXEC_REPORT.md（本轮第 2 版，覆盖前已归档旧版）
================================================================================
