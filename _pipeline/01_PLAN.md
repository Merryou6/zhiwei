知微 · style-10「青蓝蓝图」全站视觉迁移实施计划
=================================================
计划编号：01_PLAN（第 8 版：P6 /report 首迁页批次细化版，对应需求《tempui/STYLE-10-迁移计划.md》定稿 2026-10-10）
编写日期：2026-10-11 12:39（本机时间）
编写角色：planner（只读规划，implementer 严格照办；执行歧义按「四、决策记录」D 编号裁决，不向总控提问）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD = e96c702（tempui-doc 分支，rev-list --count HEAD = 185）。
      P0–P5 六批 + 清尾 2 提交 + 执行报告已全部入库（2fe4ba3→e96c702 共 9 个提交，详见「五、」批次状态表）；
      第 1 轮审查 VERDICT PASS（_pipeline/03_REVIEW.md，工作区 M 状态未入库）。
      工作区他人未提交变更（一律不碰、不回退、不纳入本批代码提交，仅记账提交按 P6.0 白名单入库）：
      M _pipeline/01_PLAN.md（本文件）、M _pipeline/03_REVIEW.md（reviewer 的 PASS 报告）、
      D tempui/纯前端需求文档.md、?? tempui/STYLE-10-迁移分析.md、?? tempui/STYLE-10-迁移计划.md、
      ?? tempui/prototypes/、?? tempui/qa-report.json、?? _pipeline/PR-tempdeploy.md、?? .workbuddy/、
      ?? node_modules/、?? package-lock.json、?? _pipeline/archive/01_PLAN_20261010_2109.md、
      ?? _pipeline/archive/03_REVIEW_20261011_0029.md、?? _pipeline/archive/01_PLAN_20261011_1239.md（本次归档）。
      唯一视觉依据 = tempui/prototypes/style-10/index.html（4113 行；本版新锚点：Sheet 内边距 L140/L680/L681，
      PAGES.report L2911-2979、PAGES._reportEmpty L2981-2987，打印样式 L789-797，表格转卡片 L707-712）。
归档：旧版 01_PLAN.md（第 7 版：style-10 蓝图迁移首版计划，493 行）已先复制归档为
      _pipeline/archive/01_PLAN_20261011_1239.md（md5 c6bce3ae7dc9e9b0641ea7e0845d44dd 两侧一致，
      归档只增不删），然后才覆写本文件。第 7 版之前的归档链见 _pipeline/archive/ 目录（只增不删）。
本轮范围边界（总控明示）：仅 P6（/report 首迁页 + 三项并入裁决/修复 + 记账入库）。
      P7（/graph ECharts 改造）单独成轮，不在本轮；P8–P12 照旧排队。
无阻塞项。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL：vitest 一律分批；git diff 一律全局选项前置（git --no-pager diff，
    第 7 版写法 `git diff --no-pager` 在本机报 usage 错误，本版已修正，见 D-01 轮报告）；dev server /
    后端可 run_in_background 存活；走查脚本按宽度/主题分档跑防超时。
  ⚠ 沙箱批量删除闸门：原地 vite build 会因清空 dist/assets（641 件 > 阈值 500）被拦。
    本版起 6.1 的 build 命令直接采用等价口径 `--outDir /tmp/zhiwei-web-build-<批次名>`
    （第 1 轮审查 L-1 留痕；不绕闸门、不删仓库文件）。
测试基准数字（2026-10-11 第 1 轮报告实测口径）：全仓 vitest 42 文件 451 用例；
  apps/web/tests 21 文件 206 用例（视觉门禁 = tokens 21 + bands 12 + breakpoints 9 + themeStore 9 +
  blueprint 7）。P6 结束时用例总数只增不减。

-------------------------------------------------
一、目标与验收清单（逐条可勾选；★ = 本轮 P6 范围）
-------------------------------------------------
[✔] 2.【检查点①·已完成】tempui/STYLE-10-设计系统规范.md：12 章、零 React 代码、冲突留痕 12 处（commit 2fe4ba3）。
[✔] 3.【检查点②·已完成】tempui/STYLE-10-组件库草案.md：三节齐备（commit 08b2d55）。
[✔] 4.【检查点③·已完成】三门禁 + themeStore 期望重写全绿；451 用例全绿、tsc 三段 exit 0、
       build 等价命令通过（commits 0be67ee / 7ee5dc6）。
[✔] 5. 双主题 token 体系落地：--p-*/--c-* 全量换值、四档色值三处同源、档名/阈值不变（7ee5dc6）。
[✔] 6. 主题默认「跟随系统、优先白图」：resolveInitialTheme + index.html 首帧脚本，键沿用 zhiwei_theme（7ee5dc6）。
[✔] 7. 字体自托管：三族 @fontsource，全仓无 CDN（7ee5dc6）。
[✔] 8.【检查点④·已完成】制图板外壳一次切换 + ChatPanel 三形态（量化取证）+ 底部 5 项 tabbar +
       「全部图纸」抽屉；chatPanel/mobileNav store 零改动（f5d9aed + 清尾 5d0630d/404e7bb）。
[✔] 10. 一行不动红线（P0–P5 全程成立，df133d6→HEAD 对照只有 theme.ts）。
[★] 9a.【检查点⑤·本轮】/report 首迁页按原型 PAGES.report / PAGES._reportEmpty 复现视觉层，
       定通用件模板（细网格表格 / measure / 红章 / 空盒 / 打印样式），业务逻辑一行不改。
[★] 9b. M-1 裁决落地：Sheet 内边距补 spacing token 对齐规范 §4.2（D13）。
[★] 9c. F-01 修复：/report 375 档横向溢出 95px 归零（D14）。
[★] 9d. 记账入库：01_PLAN.md 第 8 版、第 7 版归档件、03_REVIEW.md 及其归档件（P6.0）。
[ ] 1./9 其余页（P7 起逐页）与 11（状态实验室不迁移）照旧排队，不在本轮。
[ ] 12 收尾（P12）照旧。

-------------------------------------------------
二、检查点映射（原计划检查点 → 本流水线产物 → 把关口径）
-------------------------------------------------
检查点①~④已由第 1 轮 reviewer VERDICT=PASS 把关结案（见 _pipeline/03_REVIEW.md「三、」）：
  检查点①（规范）→ P0 ✔ PASS　　检查点②（草案）→ P1 ✔ PASS
  检查点③（门禁+构建）→ P2/P3/P4 ✔ PASS　　检查点④（外壳+面板+tabbar）→ P5 ✔ PASS
本轮：
  检查点⑤（/report 首迁页验收）→ P6 产物（五节制式 + 四态 + 打印 + 双主题 × 4 档截图 +
    变更说明三件套）交 reviewer VERDICT 把关；任一 FAIL 则该批不通过。

-------------------------------------------------
三、一行不动清单（冻结区红线）与逐批检查命令
-------------------------------------------------
3.1 冻结区（全程不碰，每批提交前用 3.2 命令复核；P6 继续全程有效）：
  · apps/web/src/router.tsx 全文件（ROUTES / STORAGE_KEYS / guardPath 原样；routerGuard.test.ts 锁定）
  · apps/web/src/stores/*（9 个）对外行为与落盘键；唯一许可改动仍是 theme.ts（已完成的 D2 初始判定，
    本轮不再动任何 store 文件）
  · apps/web/src/api/{client,sse,endpoints,types}.ts + components/chat/useChatSend.ts
  · packages/engine、functions/、data/、四份冻结契约（API_CONTRACT / ALGORITHM / DATA_SCHEMA / PRD）
  · theme/bands.ts 档名与阈值不变
  · 服务端教师 403 兜底（functions/api/src/services/teacher.ts requireTeacher）
  · P6 追加红线：ReportPage.tsx 的 useEffect 取数（reportSummary 调用、cancelled 清理、依赖数组）、
    守卫分支顺序（!activeSpaceId → loading → 数据态）、summaryLine/percent/deltaPercent/kpName、
    UI_TEXT/ERROR_TYPE_LABEL 文案常量 —— 一行不改（表现层最小新增按 D15c 留痕）。
3.2 逐批检查命令（每批提交前跑，期望均为空输出；已按第 1 轮 D-01 修正命令形态）：
      cd /Users/Merryou/LearnBuddy/zhiwei
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
  （P6 不许可任何 store 改动，第二条连 theme.ts 也不应出现。）
  行为证据：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
  graphSnapshot / reveal / phrases / stages / authStore 这些测试文件本身不改，全绿即冻结区未被破坏。
3.3 测试改动口径（红线：重写期望不删断言、用例只增不减）：
  · 本轮改期望：仅 tokens.test.ts 因 D13 新增 pad-frame 断言（只增不改既有断言）。
  · 本轮预计 0 个既有纯逻辑测试改期望：/report 页无专属测试文件；format.test（percent/deltaPercent）、
    phrases.test、logoGeometry 等与该页相关的纯逻辑函数全部不动。
  · 不动清单照旧：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
    graphSnapshot / reveal / phrases / stages / bands / breakpoints / themeStore / blueprint。

-------------------------------------------------
四、决策记录（D1–D12 保留照旧，见 _pipeline/archive/01_PLAN_20261011_1239.md「四、」全文；
    本版新增 D13–D15，D1–D12 原文不重复抄录，要点索引如下）
-------------------------------------------------
D1 断点体系（narrow:420 / sheet:900 / annos:1180，nav:720 保留）—— 照旧，P6 延续。
D2 主题机制（跟随系统优先白图，键 zhiwei_theme）—— 已落地，本轮不再动。
D3 ChatPanel 落位（1180/900 三形态）—— 已落地。
D4 ChatPage 双栏档位 —— P8 适用。
D5 产品文案：phrases.test 逐字锁定的文案不动；原型 mock 文案不采纳；蓝图新增批注制式元素（.tok
   图号/比例/状态标签）属新增 UI 元素不进 phrases。P6 适用：总评措辞用现有 summaryLine，
   「不可算」属新增展示文案（D15b）。
D6 落地页逐字动画 —— P11 适用。
D7 空间胶囊与「全部图纸」抽屉 —— 已落地。
D8 ECharts 改造 —— P7 适用，本轮不做。
D9 规范冲突以原型为准、只增留痕修订 —— 本轮 D13 的 §4.2 补垂直值即按此口径。
D10 四态为组件正常实现（SkeletonLines 不 shimmer / 虚线空盒 / Stamp 红章真重试 / 斜纹禁用）——
   P6 首次逐页落位，是「区域级 vs 整页级」落位表（规范 §7）的第一实践页。
D11 原型 4 条已知不足的预裁决 —— 照旧。
D12 图标族 43 枚 blueprint/icons.tsx —— 已落地，P6 按需引用（print/arrow/compass 等）。
D13【M-1 裁决·planner 拍板】Sheet 内边距：补 spacing token，实现向规范 §4.2 对齐；不修订规范既有值。
   理由：规范 §4.2 的值忠实转录自原型（唯一视觉依据）——原型 L140
   `.sheet{padding:var(--pad-frame)/*=48px*/; padding-bottom:16px}`（xl/lg 档）、L680
   `#board[data-tier="md"] .sheet{padding:22px 18px 12px}`、L681
   `#board[data-tier="sm"] .sheet{padding:16px 12px 10px}`。规范与原型一致，修订规范即背离原型；
   实现的 24/16 系是 P4「取最近刻度」的近似，属实现偏差而非规范笔误（不适用 R10 的回写情形）。
   落地（四值中 16/12/48 在 Tailwind 默认刻度上：px-4/px-3/pt-12；22/18 不在，须补 token）：
   a) apps/web/tailwind.config.js extend.spacing 新增具名 token：
      pad-frame-md-y:'22px'、pad-frame-md-x:'18px'、pad-frame-md-b:'12px'、pad-frame-sm-b:'10px'
      （命名可由实现微调，但须语义化、集中一处、注释指向规范 §4.2 与原型 L140/L680/L681；禁裸任意值类）。
   b) apps/web/src/components/blueprint/Sheet.tsx 内边距类替换为（档位挂法同既有 narrow/sheet 变体，
      md 与原型 421 的 1px 端点差留痕，同 D-04/第 1 轮报告 D-04 性质）：
      base（≤420 sm）= pt-4 px-3 pb-2.5（16/12/10）
      narrow:（md 421–900）= pt-pad-frame-md-y px-pad-frame-md-x pb-pad-frame-md-b（22/18/12）
      sheet:（lg/xl ≥901）= pt-12 px-12 pb-4（48/48/16；annos 档同值，不再单列 annos:px-12）
   c) 三处同源同步（缺一不可，变更说明逐一勾稽）：
      ① tailwind.config.js（token 定义）；
      ② tempui/STYLE-10-设计系统规范.md §4.2（只增留痕修订：矩阵「Sheet 内边距」列补全垂直值
        ——xl/lg 上48·底16、md 上22·左右18·底12、sm 上16·左右12·底10，注明原型行号）；
      ③ apps/web/tests/tokens.test.ts（新增断言锁四个 token 的存在与值，用例只增）。
   d) 留痕：P6 变更说明写明 M-1 结论、三处同步清单、Sheet.tsx 前后值对照表。
   影响面：全站外壳 Sheet 的 lg 档内边距 24→48（图纸内容区变窄）、md 档 24→18、sm 档收紧；
   未迁移页同步受影响（共存策略口径）——P6 走查 4 档复核无横向溢出（F-01 修复同批验收）。
D14【F-01 修法·planner 拍板】/report 375 档横向溢出 95px：选结构修法（随 P6 主体重写消除根因），
   辅以双保险，不单独打补丁。
   理由：P6 本就整页重写视觉层；原型 PAGES.report（L2944-2979）为纵向 section.block 堆叠结构，
   根本没有 lg:grid-cols-2 双卡并排——按原型重写后该 grid 自然消失（根因消除）。
   双保险（防重写中再引入同类问题）：
   a) 任何保留的 grid 子项一律 min-w-0（阻断 min-width:auto 上传）；
   b) 表格改走 blueprint 细网格表制式并在 md/sm 档转卡片（原型 L707-712），
      min-w-[420px] 一类一次性最小宽类不得复用（页面零一次性样式纪律）。
   验收判据（硬性）：走查后 audit-style10-375.json 中 /report 的 overflowPx = 0。
   备选（若实现中发现某处确需保留双栏 grid）：显式 grid-cols-1 + 子卡 min-width:0
   （第 1 轮报告已实测两法均使 scrollWidth 470→375）。
D15【P6 执行细则小裁决】
   a) 原型 06 节「三种空状态（口径说明）」不复现——规范 §10 report 行已裁定该页为 01–05 五节；
      三种空态本身按四态落位实现（无空间/无数据/无对比），不在正文留说明节，变更说明留痕。
   b) Δ 复测缺失显示「不可算」+ 原因：采纳原型口径（anno②「不可算就是不可算」，不填 0、不画占位），
      替换现有 '—'；属新增展示文案，不进 phrases 锁定范围（D5 同口径），留痕。
   c) 错误态落位允许最小新增：组件内新增 error state + 重试回调（复用同一 reportSummary 取数函数），
      属四态落位（D10 Stamp 红章真重试）的表现层改动，非业务逻辑变更；取数 useEffect 与守卫分支零改动，留痕。
   d) 原型 17px 总评正文：用 fontSize blueprint 刻度最近令牌实现（不引任意值），若刻度无 17px
      取最接近值并留痕（R10 口径）。
   e) 动效：/report 仅区块 reveal 沿用现有 useReveal/revealItem 机制（属内容层交互，保留），
      不新增 800ms 描边（那是 LeaderLayer/图谱专属）；reduced-motion 双通道随组件库既有实现。

-------------------------------------------------
五、实施步骤（批次划分与状态）
-------------------------------------------------
总顺序：P0→P5 已完成；本轮 P6；P7(/graph 单独成轮)→P8→P9→P10→P11→P12 照旧排队。

已完成批次状态表（hash 取自 git log，第 1 轮执行报告/审查报告背书）：
  [✔] P0 规范文档        commit 2fe4ba3　[✔] P1 组件库草案      commit 08b2d55
  [✔] P2 门禁期望重写     commit 0be67ee　[✔] P3 token/主题/字体 commit 7ee5dc6
  [✔] P4 外壳族+就地改造 commit dfa3623　[✔] P5 外壳切换+面板    commits f5d9aed + 5d0630d + 404e7bb
  （P5 含两笔清尾：tabbar 贴视口底 + SheetHead sm 档对齐 + 走查复采；审查 PASS 后执行报告入库 e96c702。）

=================================================
P6 批次1：/report 首迁页【检查点⑤】——本轮全部内容，拆 6 步，预计 3 个提交
=================================================

P6.0 记账入库（第 1 个提交，最先做）
    目的：清偿第 1 轮审查指出的记账遗漏（01_PLAN 第 7 版未入库），并把本版计划与审查报告一并入库。
    涉及（仅以下白名单，逐个显式 git add，禁 git add -A / git add .）：
      _pipeline/01_PLAN.md（第 8 版，本文件）
      _pipeline/archive/01_PLAN_20261010_2109.md（第 6 版归档件，untracked）
      _pipeline/archive/01_PLAN_20261011_1239.md（第 7 版归档件，本次归档）
      _pipeline/03_REVIEW.md（reviewer 第 1 轮 PASS 报告，工作区 M）
      _pipeline/archive/03_REVIEW_20261011_0029.md（其归档件，untracked）
    做什么：仅提交上述文件；不改任何代码。
    预计影响：无代码影响；git status 中 _pipeline 相关未入库项清零（PR-tempdeploy.md 是他人产物，不碰）。
    测试命令：
      git --no-pager diff --name-only HEAD -- _pipeline ; echo "exit=$?"   # 提交后期望空输出
    commit 草稿：「style10记账: 01_PLAN 第8版(P6 细化+M-1/F-01 裁决)+第7版归档+第1轮审查报告入库」

P6.1 M-1 裁决落地：Sheet 内边距补 token 对齐规范 §4.2（第 2 个提交）
    目的：消除规范-实现漂移（审查 M-1），全站外壳四档内边距与原型逐值一致。
    涉及：
      · apps/web/tailwind.config.js（extend.spacing 增 4 个 pad-frame token，见 D13a）
      · apps/web/src/components/blueprint/Sheet.tsx（Sheet 组件内边距类替换，见 D13b；
        SheetHead/SheetBlock/aside 结构不动）
      · apps/web/tests/tokens.test.ts（新增 pad-frame 断言，只增不改，见 D13c③）
      · tempui/STYLE-10-设计系统规范.md（§4.2 矩阵补垂直值，只增留痕修订，见 D13c②）
    准备修改的函数/模块：Sheet 默认导出的 main 元素 className（L118 一行）；
      tailwind.config.js extend 对象；tokens.test.ts 追加 describe/it；规范 §4.2 表格一行。
    预计影响：全站所有页面的图纸区内边距变化（lg 档 24→48 变化最大）；未迁移页同步受影响
      （共存策略口径，非缺陷）；走查需复核 4 档无横向溢出、无内容被挤压破坏。
    测试命令（独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/tokens.test.ts
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p6m1
      3.2 冻结区检查命令
    commit 草稿：「style10P6a: Sheet 内边距按规范§4.2/原型补 token 对齐(M-1 裁决)——
      pad-frame 四 token 三处同源(tailwind/规范§4.2补垂直值/tokens.test 断言)；lg 48·md 22/18/12·sm 16/12/10」

P6.2 /report 视觉层重写 + F-01 修复（第 3 个提交，主体）
    目的：按原型 PAGES.report（L2911-2979）与 PAGES._reportEmpty（L2981-2987）逐段复现，
      定「细网格表格/measure/红章/空盒/打印」通用件模板；业务逻辑一行不改。
    涉及：
      · apps/web/src/pages/ReportPage.tsx（视觉层重写；取数/守卫/纯逻辑函数零改动，红线见 3.1 追加项）
      · apps/web/src/index.css（打印样式补齐：原型 L789-797 口径——外壳四层与浮层隐藏、
        图纸 padding 归零、panel/stamp/empty/tbl-wrap 白底黑边框、break-inside:avoid、
        链接后缀 URL 8pt、装饰 ::after 关闭；与现有 [data-print='hide'] + 13 角色变量机制合流；
        该文件属计划 P3 清单且 P3 明示「打印样式留 P6 前补齐」）
    逐段复现清单（对照原型行号，SheetHead/SheetBlock 用 blueprint 现成件）：
      ① 页头（L2944-2946）：SheetHead——eyebrow 'REPORT / 汇总与验证'、图号 SHEET 10-12、
        h1 '学习报告 · 按空间汇总'、sub 含空间名（num-mono）与生成信息、chip 'T0 · 可打印'。
      ② 打印条（L2947-2949，noprint）：btn primary「打印 / 留存为 PDF」——保留现有 window.print()
        与 data-print='hide' 接线（重构 P3-4 的成果不丢）+ tok 提示「打印样式：隐藏导航与标注、
        白底黑字、表格不截断」。
      ③ 01 一句话总评（L2950-2955）：panel #verdict——chip 红（summaryLine 三档措辞照用，D5）、
        tok 口径并列（缺口数 · 掌握度<0.4 节点数，两个数如实并列不改数值）、
        总评正文（17px 见 D15d）、hint 口径说明。anno①②③ 的标注按需挂 AnnoPin（≥1180 引线，
        由 LeaderLayer 既有机制承担；开关默认关，规范 §6.1）。
      ④ 02 掌握度四档分布（L2956-2963）：.dist 条形（BandMark + 档名 + 条形 + num-mono 计数，
        条宽=count/maxCount）+ 细网格表「分档明细」（档位/个数/占比/知识点 chips）。
      ⑤ 03 缺口清单（L2964-2966）：细网格表（知识点/掌握度/档位 bandTag/最近一次归因 longid
        完整可复制/出路：去补习·看先修链链接）；md/sm 档转卡片（原型 L707-712 表格转卡片，
        data-label 制式）。
      ⑥ 04 基线与复测对比（L2967-2970）：细网格表 ΔAccuracy（知识点/基线/复测/Δ▲提升▼回落/
        说明），复测缺失显示「不可算」+ 原因（D15b，替换现有 '—'）；
        主结果 note print-only（打印时保留主结果行）。
      ⑦ 05 从缺口出发（L2971-2973，noprint）：btn row（首按钮 primary）+「看技能树」text btn；
        现有 NextStepCard 的内容语义（缺口最前者 + 两条出路）并入此节，NextStepCard 组件不再
        被本页引用（组件本身保留供未迁移页，留痕）。
      ⑧ 原型 06 节不复现（D15a，变更说明留痕）。
    四态落点（规范 §7 report 行 = 整页级；图框/分层索引/标题栏照常显示）：
      · loading → SkeletonLines（发丝斜线静态骨架，替换 PageSkeleton；PageSkeleton 组件保留供未迁移页）
      · error → Stamp 红章 + 真重试（D15c 最小新增 error state + retry 回调复用同一取数函数；
        现有 toast 保留与否随 Stamp 落位一并留痕）
      · 无空间（!activeSpaceId）→ 虚线空盒 EmptyState「还没有选中的学习空间」+ 去选空间按钮
        （现有文案照用，D5；对应原型 L2914-2918 emptyBox 形态）
      · 无数据（hasData=false）→ _reportEmpty 两块虚线空盒并列：NO DATA（还没有学习数据 +
        自报/做题出路，对应现有引导）与 NO DELTA（还没有基线与复测的对比 + 去做基线测量）；
        两条件拆分用现有 hasData 与 accuracy.length 判定，不新增数据请求。
    F-01 修复（D14）：主体重写即结构修法——五节纵向堆叠，不引入 lg:grid-cols-2 双卡 grid；
      保留的任何 grid 子项 min-w-0；表格窄档转卡片后 min-w-[420px] 类清除。
    预计影响：/report 成为首迁模板页；sheetPadding 变化与 F-01 修复叠加后 375 档溢出归零；
      tokens/bands/breakpoints/themeStore/blueprint 门禁持续绿。
    测试命令（5.1 通用规程全套，独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p6
      3.2 冻结区检查命令
      6.3 静态纪律四条（含该页零一次性样式抽查）
    commit 草稿：「style10批1: /report 学习报告——五节制式(总评/四档分布/缺口清单/ΔAccuracy/
      从缺口出发)+细网格表(等宽数字右对齐, md/sm 转卡片)+四态落位(骨架/红章真重试/双空盒)+
      打印样式按原型 L789-797；375 档溢出 95px→0(F-01 结构修法)；业务逻辑零改动」

P6.3 测试改动（并入 P6.2 提交）
    目的：按 3.3 口径收口，不留测试债。
    做什么：既有测试零改期望（percent/deltaPercent/kpName/summaryLine/phrases 全部不动，
      预计 0 个纯逻辑测试改期望）；唯一新增 = tokens.test.ts 的 pad-frame 断言（已并入 P6.1）。
      /report 无渲染测试（沿用「不引渲染测试栈」纪律）；四态与版式由走查验收。
    测试命令：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests        # 206+ 用例全绿，只增不减
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests

P6.4 走查（T0 页口径：双主题 × 4 档 1440/1024/768/375）
    目的：检查点⑤截图验收物 + F-01 硬判据 + M-1 全站复核。
    做什么：起服务（6.2 两条后台命令）后按 8 条分档命令跑（每条 = 1 档 × 1 主题，防 60s）；
      产物入 _pipeline/screenshots/style10/（只增不删；同名覆盖允许、禁止删除）。
      复核点：a) /report 五节结构与原型对照；b) 375 档 /report overflowPx=0（F-01 判据，
      读 audit-style10-375.json）；c) M-1 后 4 档无横向溢出、页头不叠字；d) 四态截图
      （loading 骨架 / 无空间 / 无数据双空盒 / 正常态；error 态可用断后端模拟或留痕说明取证方式）；
      e) 768-light 本轮必采（清偿第 1 轮 D-05 留痕）。
    测试命令：
      ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      # F-01 判据：
      grep -A2 '"/report"' _pipeline/screenshots/style10/audit-style10-375.json   # overflowPx 应为 0

P6.5 交付物三件套与停点
    a) 双主题截图（4 档 × 2 主题，T0 页口径含 375）；
    b) 变更说明：原型段落复现清单（①–⑦ 逐段勾稽）+ 接回清单（打印接线保留/四态接回/文案口径）
       + 测试改动清单（tokens 新增断言）+ M-1 三处同步勾稽表 + D15a-e 逐条留痕；
    c) vitest/tsc/build 输出摘录（build 用 /tmp 等价口径并留痕 L-1）。
    交付后停，交 reviewer 按检查点⑤口径 VERDICT 把关。

P7 批次2：/graph 最难页（ECharts 改造）【检查点⑥】——不在本轮，单独成轮，照第 7 版原文执行
    （涉及 GraphPage.tsx；D8 落地；布局纯函数不动；graphMastery/graphSnapshot 保持绿；走查 4 档）。
P8 批次3：/chat【检查点⑦】、P9 批次4：T0 四页、P10 批次5：T1 六页、P11 批次6：门户+教师四页、
    P12 收尾 —— 全部照第 7 版原文执行（见 _pipeline/archive/01_PLAN_20261011_1239.md「五、」）。

5.1 页面批次通用规程（P6~P11 每页必走六步，照旧）：
    ① 页面结构/视觉/交互按原型　② 业务逻辑按现有　③ 原型缺的能力接回（规范 §11 清单勾稽）
    ④ 所有视觉走组件库（页面零一次性样式）　⑤ 测试按新意图改期望（不删断言）
    ⑥ 单页单提交并停（三件套齐备后交 reviewer）

-------------------------------------------------
六、测试与走查命令集（全部原样可执行；已按 D-01/L-1 修正形态）
-------------------------------------------------
6.1 每批必跑命令组（各自独立一条，勿合并防 60s 被杀）：
      # 类型检查三段
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      # 测试三批
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      # 前端构建（等价口径，规避沙箱删除闸门；L-1 留痕）
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p6
      # 冻结区（期望空输出；命令形态已修正为全局选项前置）
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
6.2 真浏览器走查（复用既有基建；P6 命令见 P6.4，档位 = T0 页四档 × 双主题）：
      # 起服务（两条后台，可存活）
      $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
      $NODE functions/api/dist/server.js            # 后台 :8787
      $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts   # 后台 :5173
      # 工具 tools/responsive-audit.cjs（基建可改，业务代码不可改）；产物只增不删
6.3 静态纪律复核（每页面批次收尾跑，期望无匹配行）：
      grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src ; echo "exit=$?"   # 任意值断点禁令
      grep -rn "z-\[" apps/web/src ; echo "exit=$?"
      grep -rn "fonts.googleapis\|fonts.gstatic" apps/web ; echo "exit=$?"  # 禁 CDN
      # 该页零一次性样式抽查（无裸 hex className / 无装饰性内联 style / 无 min-w-[420px] 类一次性最小宽）：
      grep -n -E "className=\"[^\"]*#[0-9a-fA-F]{3,8}|min-w-\[" apps/web/src/pages/ReportPage.tsx ; echo "exit=$?"
6.4 走查超时预案：单档多路由 ×（导航 0.7s + 采样）贴近 60s 上限；被杀则单宽度 × 单主题逐条跑。

-------------------------------------------------
七、风险与回滚
-------------------------------------------------
R1【高·规模】照旧：批次严格线性、单批独立提交可独立回滚；建议总控按批次拆多轮
   （当前进度：P0–P5 已结案，本轮 P6，其后 P7 单独成轮）。
R2（门禁中间红）已消解：P2/P3 已结案转绿。
R3（外壳切换）已结案。
R4【高·ECharts 还原度】P7 风险照旧，本轮不涉及。
R11【新·M-1 全站波及】Sheet 内边距是全站外壳属性，lg 档 24→48 波及全部未迁移页观感与内容可用宽
   （属规范正确值的落地，非回归）；缓解：P6.1 独立提交可单独 revert；走查 4 档复核无溢出、
   无挤压破坏；与 F-01 修复同轮验收（375 档 overflowPx=0 硬判据）。
R12【中·四态取证依赖后端】error 态（红章）截图需要后端失败注入：起本地服务后断开 :8787 或用
   devtools 离线模拟；取不到则留痕说明取证方式，不伪造。
R5~R10 照旧（R6 中文字体已实测未超阈值；R10 适用于 D13 的规范补垂直值——属只增留痕修订）。
回滚总原则：P6 内 3 个提交各自独立 revert（记账 → P6.1 token → P6.2 页面；P6.2 依赖 P6.1 的
   token，回滚 P6.1 须先回滚 P6.2）；_pipeline/archive/ 与 _pipeline/screenshots/ 产物只增不删。

-------------------------------------------------
八、批次依赖与执行顺序总表（更新至第 8 版）
-------------------------------------------------
P0✔ → P1✔ → P2✔ → P3✔ → P4✔ → P5✔（以上 hash 见「五、」状态表）
  → P6（本轮：P6.0 记账 → P6.1 M-1 token → P6.2/P6.3 /report 重写+测试 → P6.4 走查 → P6.5 停点）
  → P7(/graph，单独成轮) → P8(/chat) → P9(T0 四页) → P10(T1 六页) → P11(门户+教师) → P12(收尾)
本轮提交数：3（记账 1 + token 1 + 页面 1）。

-------------------------------------------------
九、收尾数字与计划自查记录
-------------------------------------------------
本轮涉及文件（全量清单）：
  新增：_pipeline/archive/01_PLAN_20261011_1239.md（已归档）、_pipeline/screenshots/style10/ 走查新产物
  修改：apps/web/tailwind.config.js、apps/web/src/components/blueprint/Sheet.tsx、
    apps/web/tests/tokens.test.ts、tempui/STYLE-10-设计系统规范.md（§4.2 只增留痕修订）、
    apps/web/src/pages/ReportPage.tsx、apps/web/src/index.css（打印样式补齐）
  冻结不碰：router.tsx、api/ 全部、stores/ 全部（本轮连 theme.ts 也不动）、packages/engine、
    functions/、data/、四份契约文档
预计测试改动：tokens.test.ts 新增 pad-frame 断言（只增）；其余 0 个文件改期望；
  用例总数 451 起步只增不减。
计划自查（planner 2026-10-11 12:39 完成）：
  · 每步具体性：P6 拆 6 步（P6.0–P6.5），各有目的/文件/做法/影响/命令/commit 草稿 —— 是
  · 文件路径明确：全部绝对路径或仓库相对路径，原型行号仅作视觉依据锚点 —— 是
  · 测试命令可运行：全部沿用第 1 轮实测过的 $NODE/$WS 形态，并已修正 D-01/L-1 两处命令形态 —— 是
  · 避免修改业务代码：P6.2 限表现层（3.1 追加红线 + D15c 最小新增留痕），冻结区 3.2 逐批把关 —— 是
  · 检查点映射：⑤ 对应 P6 产物三件套 —— 是
  · 歧义裁决留痕：D13（M-1 补 token）/ D14（F-01 结构修法）/ D15（a–e 细则）—— 是
  · 范围边界：仅 P6，P7 起不在本轮 —— 是
