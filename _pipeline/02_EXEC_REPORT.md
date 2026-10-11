知微 · style-10 迁移 第 4 轮执行报告
====================================
执行角色：implementer；起点 HEAD=bf3c7fe；第3轮报告已归档 _pipeline/archive/02_EXEC_REPORT_20261011_1548.md
本文件在本轮内被多次续写（D25 续完口径）：P8 段 → P9.1 → P9.2 收口 → P9.3 → P9.4。
报告随每次续写提交入库；「一、快照表」永远反映当前真实进度。

一、快照表（D25 E5；hash 取自 git log）
P8.0 03da6ee 完成 记账（01_PLAN 第10版 + 第9版归档 + 第3轮审查报告）
P8.1 087da5d+904ef8f 完成 清偿 M-1（labelLayout.hideOverlap + 8 字截断）/ L-1（ZOOM_MIN 0.12→0.3）
P8.2 e5ee88f+2adb903 完成 /chat（8 组合 overflowPx 全 0）
P9.1 78b236b+c2ef68e 完成 /assessment（8 组合 overflowPx 全 0，截图新鲜）
P9.2 36948ae+5f9a72b 完成 /practice（代码 36948ae；8 组合重采 + 提示链专项 5f9a72b）
P9.3 39b3ea1+c9d1494 完成 /paper（代码 39b3ea1；8 组合 + 三段流转专项 c9d1494）
P9.4 b9ca011+a11e7e5+88baf44 完成 /attribution（代码 b9ca011；走查修复 a11e7e5；
     8 组合 + 向导五步专项 88baf44）
P9 收尾 — 完成（6.1 全套 + 冻结区双口径，见「六、」；不单列提交）
P10.1 完成 /spaces（代码 bcc253a；4 状态探针 + 409 专项 1440/375 双主题；1440/1024/375
     双主题 6 组合 overflowPx 全 0；h1=1 无双页头；D-P10.1-1/2/3 三条偏差已留痕）
P10.2-P10.6 未开始
P11.1-P11.4 未开始
P12.1-P12.4 未开始

本次调用（P9.2 收口 + P9.3 + P9.4 + P9 收尾）入库提交（旧→新）：
5f9a72b P9.2 走查 / 39b3ea1 P9.3 代码 / c9d1494 P9.3 走查 /
b9ca011 P9.4 代码 / a11e7e5 P9.4 走查修复 / 88baf44 P9.4 走查 /（本报告）

二、本次调用做了什么（逐项）
1) P9.2 收口（不推倒重做，按 D25 E1–E5 判进度）
   核实：/practice 代码 36948ae（16:17:55）之后，只有 1440 深色档（16:18:17）与 1440 浅色
   探针（16:19:28）是新鲜的；浅色档 8 组合其余 6 档的截图/JSON 早于代码提交（16:10-16:15），
   按 E3 新鲜度判据属证据过期 ⇒ 全部重采。
   做法：1440/1024/768/375 × 双主题共 8 条走查命令逐条重跑（深色采完归档一份 -dark.json，
   同第 3 轮惯例），逐档「页面级溢出合计 0px」。
   补缺：tools/probe-practice-states.cjs 增加 hint-l1 / hint-l2 两个状态（点选
   input[name="hint-level"][value=1|2] 走真实用户路径），覆盖计划要求的「三级提示逐级解锁
   实拍」；1440 双主题各跑一次，5 个状态全部 overflowPx=0、h1=1（无双 h1）。
   提交：走查产物独立提交 5f9a72b（不混入代码）。

2) P9.3 /paper（原型 PAGES.paper L2213-2348；单页单提交）
   代码 39b3ea1，三个文件：apps/web/src/pages/PaperPage.tsx（视觉层重写）、
   apps/web/src/components/Layout.tsx（D24 登记 '/paper'，一行 + 注释）、
   apps/web/src/index.css（新增 .bp-check 勾选框制式，转录原型 .check L303-309）。
   逐段复现：① sheetHead（PAPER / 批量证据采集（三段）· SHEET 10-07 · 需求 2.7 ·
   h1 拍一张最近的试卷 · chip T0 · 明判草稿）；② 阶段条 01 选文件 / 02 逐题确认 / 03 完成 +
   「三段之间单向推进」；③ STAGE1 预置文件库（已选 n/5 chip + 清空 + bp-tbl 细网格表：
   勾选框 / 文件名 + file_id / 类型 / 大小 / 备注「预选第一份」+ 开始识别主键与禁用说明）；
   ④ 识别中 → SkeletonLines 骨架（bp-note 说明识别只出草稿）；⑤ STAGE2 逐题确认
   （已判定 chip + 一键采纳 + 每题 bp-panel：卷面识别 tok / 题干 / bp-kv 识别出的作答
   （空 → 「识别为空」红 chip）/ VERDICT 分段（真 radio，含 label:has 焦点环）/
   知识点（识别猜的 → 徽标按钮展开分组 select 的既有交互保留）+ 低置信行 bp-note--alert
   点名「不允许默认」）；⑥ 提交前缺口红章（复用 Stamp 组件，seal=INCOMPLETE，
   逐条列出第几题缺什么）；⑦ STAGE3 完成（bp-measure 四格 + 掌握度前后变化 bp-tbl
   （前/后/变化 ↑↓ + up/down 色 + 档位走 masteryBandOf）+ 错题缓存 bp-note--ok +
   随情形变的主出口）。
   四态（整页级）：loading → SkeletonLines；empty（0 份试卷）→ EmptyState（给回学习空间出路）；
   error（列表失败 / 识别失败）→ Stamp 红章 + 真重试（重发同一个 drive() / startRecognize()）。
   接线勾稽（规范第 11 章 #3，本轮关键页）——**全链已在真浏览器取证**（c9d1494 的 JSON）：
   · 刷新回显：zhiwei_recognition_id 在识别后写入（probe 实测「刷新前有 → 刷新后有」，
     刷新后仍是 STAGE 2 / 3 且题数 3），确认后被清空（submitted 态 recId=false）；
   · 错题缓存：确认后 sessionStorage zhiwei_paper_wrong_<space> 写入 3 条，紧接着进
     /attribution 同会话可见（联动）。
   router.tsx（键位定义）与 api/* 一行未动 —— 冻结区命令空输出。

3) P9.4 /attribution（原型 PAGES.attribution L2604-2760；单页单提交）
   代码 b9ca011（AttributionPage.tsx 视觉层重写 + Layout.tsx 登记 '/attribution' +
   index.css 新增 .bp-path / .bp-cands / .bp-bar 三段制式类，逐条转录原型 L397-414 / L318-321，
   含 md/sm 档分叉），走查修复 a11e7e5（见「七、D-P9.4-2」）。
   逐段复现：① sheetHead（ATTRIBUTION / 沿先修链回溯 · SHEET 10-10 · 需求 2.10 ·
   h1 错题归因：往上找真正卡住你的那一环 · chip T0 · 回溯）；② 步骤条五步
   （01 挑一道错题 … 05 结果与验证，当前步 accent + aria-current 语义位 + 已过步降透明）；
   ③ STEP1 挑一道错题（左：错题表 —— 题 / 题干 / 知识点 / 你的作答 / 「用这道」，
   chip「N 题可带出 / 暂无缓存」；缓存为空 → EmptyState 如实说没有并给「先去传一张卷子」
   出路；右：手动填一道 —— 题干 / 你的作答 / 知识点，走同一套流程）；
   ④ STEP2 复述确认（bp-panel + bp-kv 三行 + 两个动作）；⑤ STEP3-A 低置信追问
   （bp-panel.border-band-weak + 再判一次 / 回到上一步）；⑥ STEP3-B 五类闭集
   （bp-tbl，命中行走 tr[data-current=true] 高亮 + 命中 chip + 把握读数）；
   ⑦ STEP4 分流（direction=none → 「SMALL MISTAKE · 不再向上回溯」既不出现 analyze
   键也给出路；否则「这一类值得往上走」+ 看看真正的根源）；⑧ 结果态：05 结论块
   （根因 / 错误类型 chip / 已验证 / 已记录反驳 / 归因编号 + 层数 + 当前状态 + 为什么 +
   去验证锚点键）+ 01 回溯路径（ol.bp-path，L 层号窄栏 + 根因那一节红框 +「根因在此」）+
   02 候选根因排序（ul.bp-cands + bp-bar 贡献度条 + 读数）+ 03 验证环节（ItemCard 既有件）+
   04 处方（验证通过才给；给出后是策略 + 大纲 + 题目序列表 + 去图谱）+ 页脚反驳常驻。
   四态（整页级）：loading（?attribution_id= 回显中）→ SkeletonLines + 「载入该次归因结果」
   分节；error（回显取不到）→ Stamp 红章 + 真重试（重发同一个 #14 请求），不拿向导态冒充结果；
   empty（本会话无错题）→ EmptyState；无空间 → guardSpace 既有语义。
   **D24 双 h1 消除已取证**：迁移前 /attribution 走查实测 h1=2（外壳通用页头 + 页面
   PageHeader 各一份），迁移并登记 PAGE_OWNED_HEAD 后实测 h1=1（两次专项 JSON 与 8 组合
   截图均为 1）。

4) P9 批次收尾验证（6.1 全套 + 冻结区）——见「六、」。

三、P9.2 /practice 收口细节（诚实的取证边界）
· 8 组合重采后逐档审计 JSON 的 overflowPx 全 0；8 份 JSON 的 theme 字段与文件名一致
  （深色档另存 -dark.json），避免「用深色数据冒充满色」这类不可核查的写法。
· 提示链专项：L1「给个方向」→ L2「再给点思路」逐级解锁，双主题各 5 个状态
  （normal / concept / drill / hint-l1 / hint-l2）全部 overflowPx=0、h1=1。
· 目验：1440 浅色 drill 截图 —— 单 h1、SHEET 10-08 页头、阶段条、阶梯、STEP 01 步骤卡齐备。
· 未做（如实）：L2 之后「第三级提示 = 逐步批改本身」的执行与判后重试回路未单独截图
  （属 /practice 既有业务链，本轮未改动，且不在计划要求的专项清单里）。

四、P9.3 /paper 专项取证（c9d1494 的 paper-1440-{light,dark}.json）
· 状态链：select（预置文件库，已选 1/5）→ recognized（点开始识别，STAGE 2，3 题，
  缺口红章在）→ reload（**刷新页面**，仍 STAGE 2、题数 3、recognition_id 仍在）→
  submitted（一键采纳 + 手标 1 题 + 提交，STAGE 3，events/掌握度表、错题缓存 3 条，
  recognition_id 已清）→ attribution（同会话进归因页，缓存 3 条可带出）。
· 数据口径（如实）：确认服务的幂等键是「同用户 × 同空间 × 同知识点 × 同来源 × 同小时」
  （packages/engine/src/dedup.ts 的 hourBucket）⇒ 同一小时内重复确认同一份文件（同 kp）
  会得到 events_created=0，那是真实业务结果而非缺陷。为使「完成态」取到非零样本，探针支持
  换选第 N 份预置文件（ZHIWEI_STATE_FILE_INDEX）：浅色档用第 2 份得到
  新增证据 2 / 更新知识点 2 的完整表；深色档在另一个零证据取证空间得到
  新增证据 3 / 更新知识点 3 / 三条掌握度前后变化（+14% ↑ / 档位 待巩固）的完整表。
· 目验：1440 浅色 select / recognized / submitted 三张与 1440 深色 submitted 均已目验。

五、P9.4 /attribution 专项取证（88baf44 的 attribution-1440-{light,dark}.json）
· 前置真实链路：探针先真做一遍 /paper「选文件 → 识别 → 一键采纳 + 手标 → 确认」，
  得到 3 条错题缓存（**不作假态、不直接写 sessionStorage**），再进 /attribution。
· 状态链：step1（错题表 3 行 + 「3 题可带出」chip —— 勾稽 #3 联动实测）→ step2（复述确认，
  题目 / 你的作答 / 知识点三行）→ step3（五类闭集表 + 把握读数）→ step4 → result。
· 分类落点如实记录：用试卷错题那份数据时，判定落在低置信追问（clarify）分支
  （JSON 的 hasClarify=true）—— 这是真实数据的真实结果，不是缺陷；为取到「深挖 → 结果态」
  的样本，探针另走产品本来就有的「或者手动填一道」入口，用真实题库数据填
  （q_cz_g2v_006：kp=math.cz.quadratic.general_to_vertex，作答 y = (x + 2)^2 - 7，
  命中 prerequisite_completing_square_gap → prerequisite_gap → direction=upstream）：
  结果态实测 回溯链 2 层（L02 一般式与顶点式互化 / L01 y=ax2 的图像与性质 + 根因在此）、
  候选根因 3 条（0.60 / 0.60 / 0.36）、验证环节、处方「验证通过后给出」。
· 目验：1440 浅色 step1（错题表 + 手填栏）与 result（05 结论 / 01 回溯链 / 02 候选条）均目验。
· 未做（如实）：验证环节的作答与反驳（#15 / #16）未在本轮实拍；处方生成（#17）按钮未点。
  这三处是既有业务链、本轮视觉层未改动其交互；P12.3「四态/专项取证补缺」可补。

六、P9 批次收尾：6.1 全套 + 冻结区（全部实测）
类型检查三段：
  tsc --noEmit -p packages/engine/tsconfig.json → exit 0
  tsc --noEmit -p functions/api/tsconfig.json → exit 0
  tsc --noEmit -p apps/web/tsconfig.json → exit 0（P9.3、P9.4 各一次）
测试三批（用例只增不减：462 = 217 + 43 + 202，与第 3 轮基准一致，无删减）：
  vitest run apps/web/tests     → 22 文件 217 用例全绿（P9.3 一次、P9.4 两次）
  vitest run packages           → 2 文件 43 用例全绿
  vitest run functions/api/tests→ 19 文件 202 用例全绿
构建（等价口径，规避沙箱删除闸门）：
  vite build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p9
  → ✓ built in 3.84s；echarts 434.35 kB 仍为独立懒加载 chunk（GraphPage 24.98 kB /
    index 256.88 kB / react 165.57 kB）；CSS 429.24 kB
冻结区（3.2 双口径，均空输出）：
  git diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data → 空
  git diff --name-only HEAD -- apps/web/src/stores → 空
  git diff --name-only bf3c7fe..HEAD --（同上两组 + graphLayout/graphMastery/graphSnapshot/poster）→ 空
6.3 静态纪律四条（任意值断点 / z-[ / CDN 字体）全局无匹配；
  逐页抽查 PaperPage.tsx / AttributionPage.tsx 的裸 hex className 与 min-w-[ 均无匹配。
走查（T0 四页齐全，均在本页最后一次代码提交之后重采）：
  每页 8 组合（1440/1024/768/375 × 双主题）× overflowPx=0；四页专项探针双主题齐全。

七、偏差与 D 编号裁决留痕
D-P9.3-1（取数 effect 的最小新增·表现层）：/paper 的取数 effect 里加了
  filesLoading（finally 落定）/ loadFailed（既有 catch 内置位）/ recognizeFailed
  （startRecognize 既有 catch 内置位）三个 setter —— 与 P6 /report、P7 /graph 的
  D15c 先例同口径（接口调用参数、cancelled 清理、依赖数组 [activeSpaceId] 逐字符未动）。
  不加的话，「取到了但一份都没有」与「取不到」无法区分，四态里的空态与失败态必然混淆
  （空 ≠ 失败，规范 7.1）。
D-P9.4-1（同上）：/attribution 的回显 effect catch 里加 viewFailed（接口调用、cancelled
  清理、依赖数组 [attributionId] 逐字符未动），用于「结果取不到 → 红章 + 真重试」。
D-P9.4-2（走查修复·口径纠正）：原型 L2732 的旁注写「贡献度合计为 1」，照抄会与数据不符
  —— 本工程 view.suspect_scores 是引擎的**嫌疑分**（先修距离越近越高，上界 d=1 0.60 /
  d=2 0.36 / d=3 0.216，不归一；第 1 轮审查实测六项合计 ≈2.5）。故 a11e7e5 独立提交把
  该块文案改为「嫌疑分按先修距离排（越近越高），不归一；排第一的是本次认定的根因」，
  aria-label 同步改为「嫌疑分 x.xx」。业务逻辑零改动。这是「只增留痕、不照搬 mock 口径」
  的一次执行（D9：规范/原型冲突以原型为准，但当原型口径与真实字段语义冲突时以真实为准并留痕）。
D-P9.4-3（区块按数据不渲染）：候选根因排序块只在 suspect_scores 非空时出现（既有语义：
  direction=self 时为空、不回溯）。所以单层回溯的真实数据下该块不渲染 —— 已用 upstream
  数据补到链 2 / 候选 3 的实拍样本，块样式有证。
D-P9-4（提交口径的一处偏差）：c9d1494 与 88baf44 两个走查提交用
  `git add -- _pipeline/screenshots/style10 tools/probe-*.cjs`（目录级 + 单个工具文件），
  而非逐文件显式列举（P9.2 的 5f9a72b 是逐文件列举）。理由：本页走查涉及 8 份审计 JSON +
  30 余张重采 png，逐条列举易漏。风险控制：提交前先跑
  `git status --porcelain -- _pipeline/screenshots/style10 tools` 逐行核对，确认范围**仅**
  走查产物与探针工具（不含任何他人未提交项与代码文件），提交后 `git show --stat` 复核。
  纪律边界未破：仍禁 git add -A / git add .，且未动 tempui/、.workbuddy/ 等他人产物。
D-P9-5（走查顺序留痕）：P9.2 收口时先补齐 8 组合与专项，再按白名单提交；P9.3/P9.4 采取
  「先提交代码 → 再重采走查 → 走查独立提交」，使 D25 E3 的新鲜度判据（产物 mtime 晚于
  该页最后一次代码提交）在提交时点即可被验证。
D-P9-6（能力边界·未取证项）：P9.3 与 P9.4 的四态里，error（红章）与 empty（空盒）两份
  取证未单独截图 —— 分支代码已实现且类型/测试通过，但「error/empty 态实拍」需注入失败与
  空数据。列入 P12.3「四态取证补缺」清单，不伪造、不占用本轮剩余容量。

八、D23 空间记账（本轮探针的真实副作用，如实登记）
· 本轮新建空间 0（所有探针都只挑不建）。
· 试卷确认/归因探针会在**取证空间**里真实落证据，本轮发生在：
  sp_mv3d1i2g01js2（P6 四态取证空间）：多份试卷确认（浅色/深色/专项多次，同小时同 kp 命中
    幂等键的那几次 events_created=0）；
  sp_mv3d53em02iv2（P6四态1791695333756）：深色档试卷确认一次（该空间此前零证据）。
· 因此账号「零证据空空间」由 3 个减为 1 个（sp_muf82zhx02br0 初中数学仍为零证据，四态取证
  继续优先用它）；sp_mugfdmcl01qe6（有数据）不变。后续页面若需要空数据空间，按 D23
  「先查明来源再取证」，并优先复用 初中数学。

九、未完成项与续完入口（D25 五件证据）
未完成：P10.2-P10.6（/start /self-report /login /me /drive）、
  P11.1-P11.4（/ /t /t/student/:id /t/recommendations + TeacherShell）、
  P12.1-P12.4（终检 / nav 断点清退评估 / 全站走查汇总 / 文档与报告）。
状态：P10.1 /spaces 已结（代码 bcc253a + 走查产物 + 本报告），其余页面代码一行未动。
续完入口：先读 01_PLAN「五、」+ 本快照表 + git log 三者对齐，从第一个未完成页
  P10.2 /start 继续（原型 PAGES['cold-start'] L1974-1999；sheetHead L1986
  「COLD START / 一次性引导」、SHEET 10-03、需求 2.3；Layout 登记 '/start'；
  /start **不在** tools/responsive-audit.cjs 的 11 页 ROUTES 表里，故该页需按 6.5
  另起 tools/probe-start-states.cjs 取证，并在走查里说明）。
P10 批次收尾待办：8 组合一次跑齐（补 768 档）+ 快照表与「五、」勾选同步。
本页（P9）留下的两条尾账：P9.3/P9.4 的 error/empty 四态实拍（见 D-P9-6）；
  验证/反驳/处方三个既有交互的实拍（见「五、」未做）。

十一、P10 段（T1 六页；本段随每页续写）
P10.1 /spaces（原型 PAGES.spaces L2040-2107；代码 bcc253a）
· 涉及文件：apps/web/src/pages/SpacesPage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/spaces'，一行 + 注释）、
  apps/web/src/index.css（新增 .bp-panel[data-active='1'] 选中态边框，10 行）、
  **apps/web/src/components/SpaceCreateForm.tsx（计划清单之外，仅视觉，见 D-P10.1-3）**。
· 逐段复现：① sheetHead（SPACES / 学习容器管理 · SHEET 10-05 · 需求 2.5 ·
  h1「学习空间：给证据找一个落点」· chip T1）；② 01 空间列表（计数 chip + 空间卡
  bp-panel + data-active 边框 + 「当前使用」/「默认空间」徽标 + 学科 tok +
  默认空间/创建时间 .bp-kv + 动作行「进入学习 / 自报 · 拍卷建图」（活跃）或
  「切到这个空间」（非活跃））+ 活跃空间纪律旁注（原型 anno①正文）；
  ③ 02 新建（新建表单本体 = 共享件 SpaceCreateForm）。
· 四态（区域级，探针实测四份 JSON）：loading → PageSkeleton/SkeletonLines；
  normal → 5 张卡；empty（注入空集合）→ .bp-empty；error（注入列表失败）→ .bp-stamp
  + **真重试**（重发同一个 listSpaces()）。四态 overflowPx 全 0、main h1 全 1。
· 409 冲突专项（真链路）：注入 stale 列表（在**真实** list 响应上滤掉一个已占用名）
  ⇒ 在真表单里提交那个名字 ⇒ **真 POST /api/space/create 返回 409** ⇒
  ConfirmDialog「已有同名空间 / 切换过去（autoFocus）」实拍（1440/375 × 双主题各一张）。
  复核：该次提交未落库（空间数前后一致）。
· 走查：1440/1024/375 × 双主题共 6 组合，/spaces overflowPx 全 0（768 档留到 P10 批次
  收尾一次跑齐，届时全部页面的证据相对各自代码提交均为新鲜）。目验 1440 浅色正常态 /
  1440 浅色 409 态 / 375 浅色正常态：单 h1、无外壳通用页头残留、无溢出。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；
  6.3 静态纪律四条无匹配、SpacesPage/SpaceCreateForm 无裸 hex 与 min-w-[。

D-P10.1-1（计数 chip 口径偏差）：原型 01 的 chip 是 `n / 30`（MOCK.spaces.limit=30），
  本工程后端只有**空间名长度上限** 30（services/space.ts MAX_SPACE_NAME_LENGTH），
  **没有空间数量上限**。照抄「/ 30」等于向学生宣告一个不存在的上限，故 chip 只给真实计数
  「N 个空间」，sheetHead 的 sub 同样去掉「上限 30 个空间」那句。属「原型 mock 口径 vs
  工程真实口径」冲突，按 P9.4 的 D-P9.4-2 同一裁决法：以真实为准并留痕。
D-P10.1-2（kv 行口径偏差）：原型空间卡第三行 kv 是「空间内证据：N 条（本次会话新增）/
  与当前空间彼此隔离」。本工程没有「本会话新增证据数」这个数据源（会话级计数不存在），
  故该行不迁移，改用真实字段「默认空间 / 创建时间」两行 kv；原型那句隔离纪律改写成
  列表末尾的一条旁注（内容是原型 anno① 的正文，不是编造的话）。
D-P10.1-3（计划外文件·共享件视觉重写）：/spaces 的 02 新建区块本体是共享件
  components/SpaceCreateForm（D2c 单一入口，顶栏弹层与移动抽屉复用同一组件），
  该文件不在计划 P10.1 的「涉及」清单里。不迁移则该页 02 区块仍是迁移前的圆角/实心蓝
  按钮语汇，页面视觉不完整；另起一份表单会复制 409/预检/提交顺序这套业务逻辑（违反
  「业务逻辑一行不改」与 D2c 单一来源）。故按最小范围只换视觉：学科单选 → .bp-seg 分段、
  名字输入 → ui 原语 FormField+Input（顺带补上 label↔控件关联）、提交键 → ui 原语 Button、
  说明文案 → 批注制式。**业务逻辑逐行未动**（handleSubmit / refresh / 本地重名预检 /
  suggestSpaceName / 409 → ConfirmDialog / setActive→refresh 顺序 / maxLength / 兜底文案）。
  影响面：顶栏弹层与移动抽屉里的紧凑态同步换制式（与 P5 已迁移的外壳一致）。这是本次
  唯一的计划外文件改动，特此标明；reviewer 若判定超出范围，可单条 revert 该文件。
D-P10.1-4（D23 空间记账·1 个探针空间）：本页第一次跑 409 专项时用的是「先建一个重名空间
  制造 store 过期」的旧探针，真实新建了 1 个空间：**P10-1-409-1791710050756**（账号空间数
  4 → 5）。随即改探针为「stale 列表注入 + 真实 409 判定」的零副作用方式并重跑，此后 4 组
  探针（1440/375 × 双主题）不再新建任何空间。后续走查/探针按 D23 以「现为 5」为基数记账；
  该探针空间无证据、可留可清（无删除接口，故保留并如实记账）。

十、当前状态一句话
P9 四页（/assessment /practice /paper /attribution）全部完成：每页代码单提交 + 走查独立提交，
  8 组合 overflowPx 全 0、无双 h1、勾稽 #3（试卷识别刷新回显 + 错题缓存接回）在真浏览器
  全链取证；6.1 全套（462 用例 / 三段 tsc / build）与冻结区双口径全绿；下一站 P10.1 /spaces。
—— 第 4 轮执行报告（P8 + P9 段）完；P10–P12 未开始，续完入口见「九、」——
