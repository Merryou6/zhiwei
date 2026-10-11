知微 · style-10「青蓝蓝图」全站视觉迁移 —— 第 3 轮执行报告（P7 /graph ECharts 改造）
================================================================================
执行角色：implementer（严格按 _pipeline/01_PLAN.md 第 9 版逐项执行；本轮为「续完调用」：
          前一次 implementer 已完成大部分工作但在收尾阶段中断，本次只做逐条复核 +
          完成剩余步骤 + 落盘报告，不推倒重做）
执行日期：2026-10-11（本机时间；续完阶段 14:14 起，报告落盘 14:37）
依据计划：_pipeline/01_PLAN.md 第 9 版（2026-10-11 13:36，P7 细化版 + D16–D20 裁决）
基线：git HEAD = fa20d8e（tempui-doc 分支，rev-list --count = 191）
结束：git HEAD = 5069782（本轮计划内 3 个提交 32aaec1 / 22d5628 / fd1b2bb 已于前次入库；
      本次续完追加 2 个提交 12acf95（走查修复）、5069782（走查产物）+ 1 个报告提交）
工作目录：/Users/Merryou/LearnBuddy/zhiwei
$NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
$WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
归档：第 2 轮执行报告（P6 版，413 行）已先复制为
  _pipeline/archive/02_EXEC_REPORT_20261011_1436.md
  （两侧 md5 = 42a79ba3bedd9debd9caf74e627242c9，一致；归档只增不删）
红线遵守：01_PLAN.md 未删未改；冻结区两口径零改动；四项测试零改动；前次三个 P7 提交未
  revert/amend；未碰他人未提交变更（tempui/ 增删、.workbuddy/、node_modules/、
  package-lock.json、_pipeline/PR-tempdeploy.md 一律未动、未入库）


--------------------------------------------------------------------------------
零、结论摘要
--------------------------------------------------------------------------------
检查点⑥（/graph ECharts 改造）本轮要求的产物齐备，验收判据全部取得证据、全部达成：

  · 计划内 3 个提交（P7.0 记账 / P7.1 清偿 / P7.3 页面含测试）前次已完成并入库，
    本次逐条复核，与计划要求一致（详见「三、」逐条复核）。
  · 本次续完补齐 3 项前次中断遗留：
      (a) 前次未提交的 GraphPage.tsx 表现层细化（走查修复），复核无冻结语义改动后
          以独立提交 12acf95 入库（可单独 revert）；
      (b) 375 档专项取证：前次 375-dark 仅采到部分且日志缺失、375-light 完全缺失，
          本次重采 375-dark 全量 + 新增 375-light（双主题齐备）；
      (c) 第 3 轮执行报告（本文件）。
  · 全量验证在**最终提交态**复跑：vitest 三批 43 文件 462 用例全绿（基线 42/453，
    只增不减）；tsc 三段 0；build 等价口径成功；L-1 判据命中；冻结区双口径空输出。
  · D8 六项按 D20 分派逐项留痕（三项执行项全落地，三项尽力项 = 键盘已落地、描边入场
    未做、焦点环近似），本文件「五、」逐项写「做了/没做/差距/原因」。
  · 唯一需 reviewer 关注项：375 档适配视图下画布节点极小、近空白观感（实测见「九、」
    OBS-1），属已定设计取舍（窄档画布退化为「形状地图」，完整内容由 05 文字清单承担），
    本次复核未改设计、如实留痕。


--------------------------------------------------------------------------------
一、前次已完成 / 本次续完（区分标注）
--------------------------------------------------------------------------------
【前次 implementer 已完成并已入库】
  · P7.0 记账         提交 32aaec1
  · P7.1 L-1/L-2 清偿  提交 22d5628
  · P7.2 D8④⑤⑥ 评估   以代码注释随 P7.3 落地（无独立提交；评估记录并入本报告「五、」）
  · P7.3/P7.4 /graph 主体 + 测试  提交 fd1b2bb
  · P7.5 走查主产物（双主题 × 4 档截图 + 审计 JSON，1440 双主题专项，375-dark 部分）

【本次续完（第 3 轮续完调用）】
  · 逐条复核 P7.0/P7.1/P7.3 交付物与计划一致性（读代码与 diff）
  · 复核并补做 P7.2 的 D8 六项评估记录（写入本报告「五、」）
  · 复核发现并处理 3 项遗留（见「零、」）：
      1) GraphPage.tsx 未提交表现层改动 → 复核后提交 12acf95
      2) 375 档专项取证不全/部分过期 → 重采 375-dark 全量 + 新增 375-light
      3) 第 3 轮报告未落盘 → 本文件
  · P7.4 测试收口：在最终态复跑 vitest 三批 + tsc 三段 + build（等价口径）
  · P7.5 走查收尾：核对产物新鲜度、补采、按白名单显式路径提交（5069782）
  · 验收判据取证：L-1 CSS / 375px overflowPx=0 / 冻结区双口径
  · P7.6：产物三件套齐备，停点交 reviewer


--------------------------------------------------------------------------------
二、提交清单与变更文件（本轮全部）
--------------------------------------------------------------------------------
1) 32aaec1  style10记账: 01_PLAN 第9版 + 第8版归档 + 第2轮审查报告入库
   _pipeline/01_PLAN.md                              （第 9 版）
   _pipeline/03_REVIEW.md                            （reviewer 第 2 轮 PASS，工作区 M）
   _pipeline/archive/01_PLAN_20261011_1336.md        （第 8 版归档件）
   _pipeline/archive/03_REVIEW_20261011_1319.md      （归档件）
   4 files changed, 1151 insertions(+), 418 deletions(-)

2) 22d5628  style10P7a: 认领清偿 L-1/L-2
   apps/web/src/components/blueprint/Sheet.tsx       （SHEET_PADDING base 档 pb-2.5 → pb-pad-frame-sm-b；
                                                      文件头注释块同步说明；10px 同值替换）
   apps/web/tests/breakpoints.test.ts                （仅文件头「合法保留」白名单注释改写；断言/扫描零改）
   2 files changed, 10 insertions(+), 4 deletions(-)

3) fd1b2bb  style10批2: /graph 知识图谱（主体）
   apps/web/src/components/Layout.tsx                （PAGE_OWNED_HEAD 登记 '/graph'，D19，1 行 + 注释）
   apps/web/src/index.css                            （图谱画布区制式类 bp-gcanvas / bp-gcanvas__viewport /
                                                      bp-gtools / bp-gcanvas__note / 图例底条 / 文字清单选中行）
   apps/web/src/lib/graphSymbol.ts                   （新增：六种形状 path 纯函数 + 六态 → symbol 映射）
   apps/web/src/pages/GraphPage.tsx                  （视觉层重写；取数/守卫/派生/点火/poster/键盘语义冻结）
   apps/web/tests/graphSymbol.test.ts                （新增：9 用例）
   5 files changed, 964 insertions(+), 259 deletions(-)

4) 12acf95  style10P7b: /graph 走查修复【本次续完新增】
   apps/web/src/pages/GraphPage.tsx                  （仅表现层：画布标签由双行(名称+百分数)收敛为单行名称；
                                                      窄档 cw<700px 不画节点标签；适配缩放下限 0.12 → 0.3；
                                                      文件头与行内注释同步；业务逻辑零改动）
   1 file changed, 29 insertions(+), 24 deletions(-)

5) 5069782  style10P7走查: /graph 截图与审计 JSON 重采 + 专项探针 + 375 双主题补齐【本次续完新增】
   _pipeline/screenshots/style10/**                  （8 审计 JSON + 路由截图重采 + graph-* 专项图）
   tools/probe-graph-states.cjs                      （新增：/graph 四态与专项只取证探针）

6) （本报告提交）style10轮3执行报告：P7 逐步复核 + D8 六项留痕 + 续完 3 项 + 全量验证
   _pipeline/02_EXEC_REPORT.md                       （第 3 轮版；旧版归档见文件头「归档」）
   _pipeline/archive/02_EXEC_REPORT_20261011_1436.md （第 2 轮旧版归档件）

涉及的新增/修改代码文件全量（去重）：
  新增：apps/web/src/lib/graphSymbol.ts、apps/web/tests/graphSymbol.test.ts、
        tools/probe-graph-states.cjs、_pipeline/screenshots/style10/ 走查新产物
  修改：apps/web/src/pages/GraphPage.tsx、apps/web/src/components/Layout.tsx、
        apps/web/src/index.css、apps/web/src/components/blueprint/Sheet.tsx、
        apps/web/tests/breakpoints.test.ts
  按计划「视评估」列入但实际**未改**：apps/web/src/components/BandLegend.tsx（原因见「七、」）


--------------------------------------------------------------------------------
三、P7.0–P7.6 逐步完成状态与逐条复核
--------------------------------------------------------------------------------
P7.0 记账入库 —— 【前次已完成，本次复核通过】
  要求：仅提交 _pipeline 白名单 4 件（01_PLAN 第 9 版 / 01_PLAN 第 8 版归档 /
        03_REVIEW 第 2 轮 / 03_REVIEW 归档件）；不改代码。
  实际：32aaec1 恰为该 4 件（见「二、」1)），无代码文件混入。
  复核命令：git --no-pager diff --name-only fa20d8e..32aaec1 → 恰 4 个 _pipeline 路径。
  结论：一致。

P7.1 认领清偿 L-1 + L-2 —— 【前次已完成，本次复核通过】
  L-1（D16）：Sheet.tsx SHEET_PADDING base 档 pb-2.5 → pb-pad-frame-sm-b，文件头注释同步，
             10px 同值替换；tailwind token 定义与 tokens.test 未动、规范 §4.2 未动。
  L-2（D17）：breakpoints.test.ts 仅文件头注释块改写（删「ReportPage min-w-[420px]」陈旧三行），
             断言与扫描逻辑零改动（diff 逐行确认，仅注释行）。
  复核：git --no-pager diff fa20d8e..22d5628 -- apps/web/tests/breakpoints.test.ts -U0
        → 增删行全部落在 /** */ 注释块内（见「八、」冻结区证据）。
  结论：一致；L-1/L-2 清偿成立。

P7.2 D8④⑤⑥ 评估先行 —— 【前次以代码注释落地，本次复核并补做成文记录】
  说明：计划要求产出「评估记录并入执行报告」（不提交、不改代码）。前次的具体选型已体现在
        P7.3 实现与行内注释中，但未成文；本次据实现与注释复核，补齐「五、」的逐项记录。
  结论：记录见「五、」。

P7.3 /graph 视觉层重写 —— 【前次已完成（fd1b2bb），本次复核 + 表现层细化提交 12acf95】
  逐段复现清单对照（原型 tempui/prototypes/style-10/index.html L2793-2908）：
    ① 页头双分支（有证据 / 空图谱）：GraphPage 两处 SheetHead（eyebrow 'KNOWLEDGE GRAPH /
       先修链全景'、SHEET 10-11、需求 2.11、chip 'T0 · 三重编码'，空态切标题）+ D19 页头自有登记。
       ✓ 代码存在；Layout.tsx PAGE_OWNED_HEAD = Set(['/report','/graph'])。
    ② 01 证据统计四格：MeasureBox 总证据 / 本周新点亮(WeekCount+badge-pop 冻结) / 覆盖进度 /
       章节通关；数据全部来自既有 summary/badges，无新增请求。✓
    ③ 02 画布：bp-gcanvas 制式容器 + 工具条四钮（zoomin/zoomout/target/download）+ ECharts
       画布（roam 保留）+ 窄屏降级 note + BandLegend 底条 + 底部 row（缩放倍数 / 平移提示 /
       路径高亮 chip / 导出海报）。原型「模拟从报告带入路径」演示按钮未复现（D5，留痕）。✓
    ④ 画布内节点/边：四档形状 symbol（graphSymbol，D20①）+ 标签（D20② ink 令牌）+ 低置信边框
       虚线补偿 + 边 hl/done「已打通」角标 + 箭头 + 路径高亮降透明（DIM_OPACITY 冻结）。✓
    ⑤ 03 节点详情 + 04 为什么是这张图：annos 档双栏；kv 清单 + 掌握度条 + CTA（navigate 冻结）
       + tick-list 四条。✓
    ⑥ 05 文字版清单：bp-tbl 细网格表**全档常在**（替换旧 details 折叠）；列齐备；行可点开同一
       详情卡；行选中态 inset 边线。✓
    ⑦ 空态分支：!hasAnyEvidence → 空态版页头 + 01 emptyBox（三条冷启动出路）+ 02 口径图例。✓
  四态落点：loading → SkeletonLines；error → Stamp 红章 + 真重试（D15c 最小新增）；
            无空间 → EmptyState；无数据 → ⑦。✓（代码存在；取证见「六、」）
  375 档纪律：旧内联 minWidth 去除，改画布内缩放；audit-375 /graph overflowPx=0（硬判据达成）。
  冻结复核：12acf95 的 diff 仅涉 label 配置 / fitZoom 下限 / 注释；取数 useEffect、守卫顺序、
            派生、点火（IGNITE_*、lastIgnitionSourceRef）、theme deps、poster 链路、文字清单键盘
            语义、UI_TEXT/STATE_HINT/EVIDENCE_LABEL 常量均未动（逐行 diff 确认）。
  结论：一致。

P7.4 测试收口 —— 【前次已并入 fd1b2bb，本次在最终态复跑复核】
  见「四、」测试/tsc/build 摘要。四项零改动、三批全绿、用例只增。

P7.5 走查 —— 【前次已完成大部分，本次复核新鲜度 + 补采 + 提交】
  复核发现（重要）：
    · 主走查路由截图与 8 份审计 JSON：mtime 14:08:54–14:11:08，均晚于 GraphPage 表现层
      改动（14:00:01）→ 新鲜有效。
    · 1440 双主题专项探针图：mtime 14:11:25–14:12:10 → 新鲜有效。
    · 375-dark 专项：normal/keyboard/theme-before 三张 mtime 14:12:25–29（新），其余 6 张
      mtime 13:58（早于 14:00 改动，**stale**），且探针日志 mtime 13:58（日志只在探针跑完时
      写盘）→ 判定前次 375-dark 探针在采到第 3 张后中断、未跑完。
    · 375-light 专项：**完全缺失**。
  处理：重采 375-dark 全量（9 张 + 日志）+ 新增 375-light（9 张 + 日志），
        探针严格按 D18 复用账号既有空空间（不新建）。
  提交：走查产物独立提交 5069782（可 revert）。
  结论：双主题 × 4 档主走查齐备；专项探针 1440（双主题）+ 375（双主题）齐备。

P7.6 交付物三件套与停点 —— 【本次完成】
  a) 双主题截图 4 档 × 2 主题 × 11 路由 + 四态与专项取证图：齐备。
  b) 变更说明：原型段落复现清单（①–⑦）+ D8 六项分派结果 + 接回清单 + 测试改动清单 +
     D16–D20 留痕：见本报告「三、」「五、」「七、」「八、」。
  c) vitest/tsc/build 输出摘录：见「四、」。
  停点：交 reviewer 按检查点⑥口径 VERDICT 把关。


--------------------------------------------------------------------------------
四、测试 / tsc / build 摘要（命令与逐条结果，均在最终提交态复跑）
--------------------------------------------------------------------------------
vitest 三批（分批跑，防 60s SIGKILL）：
  $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
    → Test Files 22 passed (22)；Tests 217 passed (217)；Duration 5.49s
  $NODE $WS/node_modules/vitest/vitest.mjs run packages
    → Test Files 2 passed (2)；Tests 43 passed (43)；Duration 1.73s
  $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
    → Test Files 19 passed (19)；Tests 202 passed (202)；Duration ~7s
  合计：43 文件 462 用例全绿。
  基线（第 2 轮口径）：42 文件 453 用例（apps/web 208 / packages 43 / functions/api 202）。
  变化：文件 +1（graphSymbol.test.ts），用例 +9（apps/web 208 → 217），**只增不减**。

tsc 类型检查三段（$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p ...）：
  packages/engine/tsconfig.json   → exit 0
  functions/api/tsconfig.json     → exit 0
  apps/web/tsconfig.json          → exit 0

前端构建（沙箱删除闸门规避的等价口径，第 1 轮 L-1 留痕）：
  $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts \
        --outDir /tmp/zhiwei-web-build-p7a
  → ✓ built in 3.73s
  产物关键块：index.css 421.65 kB(gzip 162.71) / GraphPage 24.07 kB(gzip 10.53) /
             react 165.57 kB / index 244.25 kB / echarts 434.35 kB(gzip 146.15，独立懒加载 chunk)
  说明：echarts 仍为独立 chunk，未并入主包；改前本轮未新增依赖，包体口径无异常增长。

静态纪律四条（6.3，期望无匹配行）：
  grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src        → 无匹配（exit 1）
  grep -rn "z-\[" apps/web/src                             → 无匹配（exit 1）
  grep -rn "fonts.googleapis\|fonts.gstatic" apps/web       → 无匹配（exit 1）
  grep -n -E "className=\"[^\"]*#[0-9a-fA-F]{3,8}|min-w-\[" apps/web/src/pages/GraphPage.tsx
                                                           → 无匹配（exit 1）

测试改动清单（3.3 口径）：
  · 唯一改动的既有测试文件：apps/web/tests/breakpoints.test.ts（仅文件头注释，断言/扫描零改）。
  · 唯一新增：apps/web/tests/graphSymbol.test.ts（9 用例：顶点数 / 圆含 arc / 方形 4 角 /
    path:// 前缀 / 六态映射 / 六形状两两不同）。
  · 该页既有纯逻辑测试改期望：0 个。


--------------------------------------------------------------------------------
五、D8 六项逐项结论（做了 / 没做 / 差距 / 原因）—— 计划红线，不静默砍
--------------------------------------------------------------------------------
① 四档形状 symbol（执行项）——【做了】
  做：新增 apps/web/src/lib/graphSymbol.ts，把原型 bandShapePath()（L2784-2792）的顶点公式
      逐字转写为纯函数：菱形=待巩固（4 顶点，step 90）/ 五边形=不稳定（5）/ 六边形=基本掌握（6）/
      圆=已掌握（两段弧闭合）/ 方形=未解锁（0.8r 四角）/ 未接触=虚线空心圆（形状同为圆，由边框
      虚线表达空心）。ECharts 节点 symbol 逐点挂 `path://…`。
  取证：graphSymbol.test.ts 9 用例全绿；画布截图可见形状差异；BandLegend 复用 BandShape 承担
        图例形状编码。
  差距：无（形状语义与原型一致）。

② 天蓝不做小字（执行项）——【做了】
  做：画布标签文字色取 --c-ink 令牌（themeColor('--c-ink', …)），不再使用天蓝 #4E86D6。
  取证：代码；1440 双主题截图标签为 ink 家族色；tokens.test 仍绿。
  差距：无。色值选择留痕：textColor = themeColor('--c-ink')，兜底 TEXT_COLOR_FALLBACK='#22303A'。

③ 主题切换重绘不重播（执行项·既有机制保持）——【做了（机制原样保留 + 取证）】
  做：theme 进图表 effect deps + 重取 CSS 变量重绘；lastIgnitionSourceRef 判定 byKp 变化才重播，
      主题/路径重绘不重播。
  取证（探针四组，切主题前后对照）：
    1440-dark ：缩放 tok 切换前 0.55× / 切换后 0.55×；画布墨量 350ms=16747 == 稳态=16747
    1440-light：缩放 tok 0.55× → 0.55×；墨量 350ms=16747 == 稳态=16747
    375-dark  ：缩放 tok 0.30× → 0.30×；墨量 350ms=1897 == 稳态=1897
    375-light ：缩放 tok 0.30× → 0.30×；墨量 350ms=1897 == 稳态=1897
  读法：点火若被重播，350ms 处只有最早若干节点落位 → 墨量远小于稳态、且缩放回退；实测两值相等
        → 未重播。节点位置不变（缩放/中心未变）。
  差距：无。

④ 键盘操作（尽力项·评估先行）——【做了（候选 A 落地 + 候选 B 落地）】
  评估结论：候选 A（画布级）可行且包体零增量 —— 容器 tabIndex=0 + onKeyDown 映射方向键平移 /
           加减号缩放，走 setOption({series:[{id:'graph',zoom,center}]}) 更新视图，不重建图表；
           候选 B（节点级）：canvas 无 DOM 节点、节点级 Tab 遍历不可行，改由 05 文字清单的真实
           <button> 承担节点级键盘选中（全档常在，回车开同一张详情卡，焦点移交详情卡）。
  做：GraphPage 画布视口 role="group" tabIndex=0 + onCanvasKeyDown（ArrowLeft/Right/Up/Down 平移、
      +/- 缩放）；文字清单行内按钮 aria-current + 回车开卡。
  取证：探针键盘注入 {ok:true, focused:true}；注入方向键+加号后缩放读数变化
        1440-light 0.55× → 0.79×；375-dark 0.30× → 0.43×；375-light 0.30× → 0.43×。
  差距：canvas 内「点中最近节点」的 Enter 选中（D20④ 可选增强）未做 —— 未纳入必须项，
        键盘主路径已由文字清单承担。
  原因：不引渲染测试栈、不碰冻结区、不加大包体（判据）全部满足；可选增强为避免复杂度未做。

⑤ 800ms 描边入场（尽力项·评估先行）——【没做（按候选 A 取舍，留痕差距）】
  评估：原型 = .drawn .edge stroke-dashoffset 900→0（L570，--t-draw 800ms）+ reduced-motion
        双通道关闭。ECharts graph edge 无 stroke-dashoffset / 描边生长能力；候选 B（lineStyle
        opacity/width 渐入）只是「近似而非描边」；候选 C（自绘 SVG）已被 D8 排除。
  选型：候选 A —— 不做描边入场，由既有节点错落点火（IGNITE 机制，冻结语义）承担入场仪式感。
  差距：无「边描边生长」动画，与原型存在可见差异。
  原因：ECharts edge 能力不足；不为此自绘 SVG（D8 已排除）；reduced-motion 已由点火机制降级覆盖
        （见「六、」f）。
  是否留痕差距：是（本条）。

⑥ 节点焦点环（尽力项·评估先行）——【部分做（近似表达 + 文字清单 CSS 焦点环）】
  评估：canvas 无 focus 事件，结论依赖 ④。
  做：画布键盘/选中态用 emphasis 近似 —— 选中/高亮节点 borderWidth 3（原型 focus 的 3px 描边
      近似）；画布容器 :focus-visible 有 outline（.bp-gcanvas__viewport:focus-visible）；
      05 文字清单行的键盘焦点走既有 UI 焦点环 token（天然可达）。
  差距：canvas 内节点无「真 focus 环 + halo 6px」（原型 L565-567）；只有 borderWidth 近似的选中
        态，且无 halo。
  原因：canvas 节点无 DOM 焦点；精确复现需自绘（D8 排除）或引渲染测试栈（判据禁止）。
  是否留痕差距：是（本条）。

注（D20 尾注）：原型打印样式（L784-804）只覆盖 report 页，/graph 不扩展打印（留痕：无打印需求）。


--------------------------------------------------------------------------------
六、走查清单（P7.5）
--------------------------------------------------------------------------------
服务：vite :5173（PID 93824）+ functions/api/dist/server.js :8787（PID 93822），登录探活 200。
主走查（8 组合 = 4 档 × 2 主题，每组合 11 路由）：
  ZHIWEI_AUDIT_OUT=.../screenshots/style10 ZHIWEI_AUDIT_THEME={dark,light} \
    $NODE tools/responsive-audit.cjs --tag style10 --widths {1440,1024,768,375}
  产物：audit-style10-{1440,1024,768,375}[-dark].json（8 份，各 11 路由）
        + style10-{w}[-dark]-{route}.png。
  溢出判据：8 份 JSON 全部 11 路由 overflowPx = 0（全档全页）；/graph 各档：
        1440=0 / 1024=0 / 768=0 / 375=0（双主题相同）。→ 375 档 /graph overflowPx=0 硬判据
        **达成**（F-01 同口径）。
专项探针 tools/probe-graph-states.cjs（新增，基建；只取证不下结论）：
  ZHIWEI_STATE_THEME={dark,light} ZHIWEI_STATE_WIDTH={1440,375} $NODE tools/probe-graph-states.cjs
  四组齐备（1440-dark / 1440-light / 375-dark / 375-light），每组 9 图 + 1 日志：
    normal / keyboard / theme-before / theme-after-350ms / theme-after-settled /
    reduced-motion / no-data / loading / error
  专项图共 36 张（graph-{w}-{theme}-{state}.png）+ 4 份日志（last-graph-probe-{w}-{theme}-log.txt）。
  （375 两组为本轮续完重采/新增；1440 两组为前次 14:11–14:12 采集，新鲜。）

  c) 四态取证：
     · 无数据态：**复用账号既有空空间**（sp_muf82zhx02br0「初中数学」，evidence=0；D18，不新建）。
     · loading：注入 graph/mastery 请求永不落地 → SkeletonLines 骨架。
     · error：注入 graph/mastery 请求失败 → Stamp 红章 + 真重试。
     · 无空间态：**采不到** —— router.guardPath 在「已登录 + 无活跃空间」时把 /graph 重定向到
       /spaces（router.tsx 冻结区）；该分支只在「页面已挂载时空间被清空」出现，无导航取证方式。
       如实记录，不伪造（R12 口径，与 P6 /report 同）。
  d) 键盘操作/焦点环：探针 CDP 注入 keydown 取证（见「五、」④⑥）。
  e) 主题切换重绘不重播：切主题前后同空间截图对照（见「五、」③）。
  f) reduced-motion：Emulation.setEmulatedMedia(prefers-reduced-motion: reduce) 后重进 /graph，
     四次探针 matchMedia 均返回 true；截图节点瞬时到位（点火/入场动效降级）。
  g) D18（L-3）空间污染：本轮探针/走查**新建空间 0 个**（累计计数 = 0；账号内既有的 2 个
     「P6 四态」空间为 P6 遗留，本轮未增）。探针日志逐条记录所选空空间，可追溯。

走查产物目录最终计数：png 134 张（含 88 路由主截图 + 36 graph 专项 + 其余专项/历史）、
  audit JSON 8 份、探针日志 4 份；本次新增/改动由提交 5069782 入库。


--------------------------------------------------------------------------------
七、验收判据取证
--------------------------------------------------------------------------------
1) L-1 判据（build 产物 CSS 含 pb-pad-frame-sm-b{padding-bottom:10px}）——【达成】
   命令：$NODE … vite build … --outDir /tmp/zhiwei-web-build-p7a
         grep -o 'pb-pad-frame-sm-b{padding-bottom:10px}' /tmp/zhiwei-web-build-p7a/assets/*.css
   结果：/tmp/zhiwei-web-build-p7a/assets/index-Q67eXV_O.css:pb-pad-frame-sm-b{padding-bottom:10px}
         （exit 0）；旁证 pb-pad-frame-md-b{padding-bottom:12px} 亦在产物中。
2) /graph 375px overflowPx = 0 ——【达成】
   audit-style10-375.json 与 audit-style10-375-dark.json 中 /graph：
    overflowPx=0，scrollWidth=375=clientWidth。
3) 冻结区双口径检查空输出 ——【达成】（见「八、」）。

BandLegend.tsx 复核结论（P7.3 条件项「已达标则不动并留痕」）：
  P4 起 BandLegend 已是四列信息（BandShape 形状 + 色 + 名称 + 区间），即「色 + 形状 + 文字」三重
  图例已达标 → **本轮未改** BandLegend.tsx，符合计划的「已达标则不动」分支。空态截图中可见图例
  形状（◇ 待巩固 / ⬠ 不稳定 / ⬡ 基本掌握 / ⬤ 已掌握）。


--------------------------------------------------------------------------------
八、冻结区结果（计划 3.1 红线）
--------------------------------------------------------------------------------
工作区口径（对 HEAD）——期望空输出，实测空：
  git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api \
      packages/engine functions data        → 空（exit 0）
  git --no-pager diff --name-only HEAD -- apps/web/src/stores  → 空（exit 0）
区间口径（fa20d8e..HEAD）——期望空输出，实测空：
  git --no-pager diff --name-only fa20d8e..HEAD -- apps/web/src/router.tsx apps/web/src/api \
      packages/engine functions data        → 空（exit 0）
  git --no-pager diff --name-only fa20d8e..HEAD -- apps/web/src/stores \
      apps/web/src/lib/graphLayout.ts apps/web/src/lib/graphMastery.ts \
      apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts  → 空（exit 0）

四项测试/冻结文件零改动（fa20d8e..HEAD，空输出确认）：
  apps/web/tests/graphMastery.test.ts / graphSnapshot.test.ts /
  apps/web/src/lib/graphLayout.ts / poster.ts（并含 graphMastery.ts / graphSnapshot.ts）→ 均空。

3.3「不动清单」既测试文件（fa20d8e..HEAD）：仅 breakpoints.test.ts 被改（许可的注释项）；
  其余 18 个测试文件（routerGuard/sse/client/chatPanel/mobileNav/dialogStore/reveal/phrases/
  stages/bands/themeStore/blueprint/tokens/logoGeometry/richText/authStore/format/useCountUp）
  零改动。
  且 breakpoints.test.ts 改动逐行确认落在文件头注释块内，断言与扫描逻辑零改动。

行为证据：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
  graphSnapshot / reveal / phrases / stages / authStore 等测试文件未改，全绿 → 冻结区未被破坏。

服务端教师 403 兜底（functions/api/src/services/teacher.ts）在冻结区，未动（functions 口径空输出）。


--------------------------------------------------------------------------------
九、L 级清偿证据与偏差 / 观察留痕
--------------------------------------------------------------------------------
L-1（D16）token 消费 ——【已清偿】
  Sheet.tsx base 档底边距改 pb-pad-frame-sm-b；产物 CSS 出现该类（见「七、」1)）；
  pad-frame-* 四 token（sm-b / md-y / md-x / md-b）全部有类名消费，漂移藏身处清零；
  tokens.test ⑬ 两条断言仍绿（tokens.test 23 用例全绿）。

L-2（D17）陈旧注释 ——【已清偿】
  breakpoints.test.ts 文件头白名单删除「ReportPage min-w-[420px]」陈旧描述，改写为「该写法
  已随 P6 清除」现状；断言/扫描零改；breakpoints.test.ts 9 用例全绿。

L-3（D18）走查/探针空间污染约定 ——【已遵守】
  无数据态复用账号既有空空间（sp_muf82zhx02br0，evidence=0）；本轮新建空间 0 个（累计 = 0）；
  探针日志记录所选空空间；服务端无删除/归档接口属已知限制，本轮不补（functions 冻结）。

D19 / INFO-1（/graph 页头归属）——【已落地】
  Layout.tsx PAGE_OWNED_HEAD = new Set(['/report','/graph'])，/graph 不再吃外壳通用页头，无双 h1。

偏差 / 观察留痕（本次续完实际发生的偏差，均已记录）：
  DEV-1（前次未提交改动的处置）：本次接手时发现 apps/web/src/pages/GraphPage.tsx 有未提交
    表现层改动（标签收敛 / 窄档不画标签 / 适配缩放下限 0.3）。经逐行 diff 复核，确认仅涉表现层，
    不触 3.1 追加红线（取数/守卫/派生/点火/poster/键盘语义/文案常量）。按计划 R1 与 P6 D17
    「走查修复独立提交」惯例，以**独立提交 12acf95** 入库（可单独 revert），未 amend 历史。
    属计划 P7.3 表现层细化的续完，非新增范围。
  DEV-2（走查产物新鲜度）：前次 375-dark 专项探针在采到第 3 张后中断（其余 6 张与日志停留在
    13:58，早于 14:00 的 GraphPage 改动），且 375-light 专项缺失。判定前次产物**部分 stale**，
    本次重采 375-dark 全量 + 新增 375-light（双主题齐备），并复核确认主走查与 1440 双主题专项
    均晚于改动时间、新鲜有效。合入提交 5069782。
  DEV-3（文件头注释同步）：GraphPage 文件头 ④ 行原写「节点双行文本（名称/百分数）」，与实现
    收敛后的单行标签不符；本次随 12acf95 同步为准确描述，并补 375 档取舍说明。仅注释，不涉行为。
  DEV-4（脚本调试副作用，不入库）：为核实 375 档画布可见性，本次在 /tmp 写了一个只读核实脚本
    （/tmp/graphcheck.cjs）；调试中发现「同一 URL 仅 hash 变化属同文档导航、zustand store 不重新
    水合」导致首轮取不到 .bp-gcanvas__viewport，改不同 query 后正常。该脚本与 /tmp 产物均不入库，
    对仓库零影响。此现象与 P7 代码无关（是探针/核实脚本的导航写法问题）。

OBS-1（需 reviewer 关注·未改设计，如实留痕）：375 档 /graph 正常态适配视图下，画布节点极小、
    近空白观感。实测（本次只读核实，W=375 T=light，活跃空间 UI 验收·先修薄弱）：
      · 画布 349×340；适配缩放读数 0.30×（= 新下限；字面 fit 约 0.152，被地板截断）。
      · 画布非透明像素 1897，包围盒 x∈[124,224]、y∈[157,182]（约 100×25 px）。
    对照 1440：画布 1106×460，缩放 0.55×，墨迹包围盒约 569×82 px。
    成因：布局为 9 列 × 24 节点（width=1920 / height=180）；窄档适配被下限 0.3 截断后，可视数据
    窗口只落入图的中部若干列，且 375 档刻意不画节点文字，多数节点为未填充态（仅细描边），
    故观感接近空白。
    定性：属已定设计取舍（窄档画布退化为「形状地图」，完整可读内容由 05 文字清单 + 03 详情承担，
    页面另有「窄屏降级：画布保留，完整可读的表格在下一节」提示）；375 硬判据 overflowPx=0 仍达成。
    本次**未改设计**（避免推倒重做），仅如实留痕并提示 reviewer 复核「窄档画布是否达标」。


--------------------------------------------------------------------------------
十、未完成项
--------------------------------------------------------------------------------
· 无「计划内未完成项」。P7.0–P7.6 全部落地并取证。
· D8 分派中明确的「不做/近似项」按 D20 口径即属预期（非未完成）：
    ⑤ 800ms 描边入场 = 候选 A（由点火承担，不做）
    ⑥ canvas 节点真焦点环/halo = 近似表达（borderWidth 3 + 容器 :focus-visible + 文字清单焦点环）
    ④ 的「Enter 选中视口中心最近节点」可选增强 = 未做
  三项均在「五、」逐项写明差距与原因，未静默缩水。
· 待 reviewer 判定项：OBS-1（375 档画布观感）。


--------------------------------------------------------------------------------
十一、复现命令速查（本轮实际执行、可直接复用）
--------------------------------------------------------------------------------
# 冻结区（期望空）
git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
git --no-pager diff --name-only HEAD -- apps/web/src/stores
git --no-pager diff --name-only fa20d8e..HEAD -- apps/web/src/stores apps/web/src/lib/graphLayout.ts \
    apps/web/src/lib/graphMastery.ts apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts
# 测试（分批）
$NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
$NODE $WS/node_modules/vitest/vitest.mjs run packages
$NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
# 类型
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
# 构建（等价口径）
$NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p7a
grep -o 'pb-pad-frame-sm-b{padding-bottom:10px}' /tmp/zhiwei-web-build-p7a/assets/*.css
# 走查（主 8 组合）
ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
#   （其余组合 = THEME×WIDTH 组合，逐条跑）
# 专项探针（四组）
ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=1440 $NODE tools/probe-graph-states.cjs
ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=1440 $NODE tools/probe-graph-states.cjs
ZHIWEI_STATE_THEME=dark  ZHIWEI_STATE_WIDTH=375  $NODE tools/probe-graph-states.cjs
ZHIWEI_STATE_THEME=light ZHIWEI_STATE_WIDTH=375  $NODE tools/probe-graph-states.cjs
# 硬判据
grep -A2 '"/graph"' _pipeline/screenshots/style10/audit-style10-375.json   # overflowPx 应为 0

—— 报告完（第 3 轮，2026-10-11 14:37 落盘）——
