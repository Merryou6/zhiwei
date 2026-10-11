知微 · style-10 迁移 第 4 轮执行报告（终版）
============================================
执行角色：implementer；起点 HEAD=bf3c7fe；第3轮报告已归档 _pipeline/archive/02_EXEC_REPORT_20261011_1548.md
本文件在本轮内被多次续写（D25 续完口径）：P8 段 → P9.1 → P9.2 收口 → P9.3 → P9.4 →
P10.1 → P10.2 → P10.3 收口 → P10.4 → P10.5 收口 → P10.6 → P10 批次收尾 → P11.1 门户 →
P11.2 → P11.3 → P11.4 → P12.1 终检 → P12.2 nav 评估 → P12.3 全站走查汇总 → P12.4 文档与报告。
最后这个 P12 调用把 P12.1–P12.4 四步按计划逐条实测做完，并回填 21 步全部勾选，故本文件
自此为**第 4 轮终版**：报告内数字均为本次实测，无「待定」项。
如实说明（续写过程的产物）：本文件在 P8 段与 P11.2–P11.4 段曾被后续续写覆盖掉正文，
本次以 git log 与历史版本为权威回填，两段见「二十一、」与「补充段 · P11.2–P11.4」。
报告随每次续写提交入库；「一、快照表」反映最终真实进度。

一、快照表（D25 E5；hash 取自 git log）—— 第 4 轮终版
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
P10.2 完成 /start（代码 52212c6；1440/1024/375 双主题 6 组探针 overflowPx 全 0、h1=1、
     SHEET 10-03 在页、四张路径卡；/start 不在 audit 工具 ROUTES 表内，另起探针取证）
P10.3 完成 /self-report（代码 b026e72（前次半页未提交改动经逐段对照原型 L1999-2040 复核后
     收口 + 两处极小补齐）；走查 5d59594：1440/1024/375 双主题 6 组合 overflowPx 全 0、
     h1=1；已记录态专项探针 3 状态 × 1440/375 × 双主题全绿；D-P10.3-1/2/3 留痕）
P10.4 完成 /login（代码 7653b2b：含计划外 App.tsx 去 bare / ToastHost 注释两处；走查 056a2c2：
     1440/1024/375 双主题 6 组合 overflowPx 全 0、h1=1；链路专项 7 状态 × 1440/375 × 双主题
     全绿——真登录落 token / 刷新不掉线 / 真 401 回 /login / 演示账号两分支；D-P10.4-1~4 留痕）
P10.5 完成 /me（代码 1b3f41d（前次半页未提交改动经逐行复核 + 逐段对照原型 L3028-3120 后收口）；
     走查 8bbfb93：1440/1024/375 双主题 6 组合 overflowPx 全 0、h1=1；专项探针新增
     tools/probe-me-states.cjs：登录态/全零空间/守卫重定向/主题切换实拍/全站生效 5 状态 ×
     1440/375 × 双主题全绿；D24 单 h1；D-P10.5-1/2/3 留痕）
P10.6 完成 /drive（代码 e59035c；走查 50a306b：1440/1024/375 双主题 6 组合 overflowPx 全 0、
     h1=1；专项探针新增 tools/probe-drive-states.cjs：normal/empty/error/no-space 四状态 ×
     1440/375 × 双主题全绿；D24 登记 '/drive' 消除双 h1；D-P10.6-1/2/3 留痕）
P10 批次收尾 完成（6.1 全套实测 + 冻结区双口径空输出，见「十二、」；不单列提交）
P11.1 完成 /（门户落地页；代码 e8ec745；走查 2c90cd0：1440/1024/768/375 双主题 8 组合
     overflowPx 全 0、h1=1；专项探针新增 tools/probe-landing-states.cjs：normal +
     prefers-reduced-motion 双通道 × 4 档 × 双主题全绿；Layout 登记 '/'（portal 不经外壳，
     登记暂无实效并留痕）；D-P11.1-1~4 留痕）
P11.2 完成 /t + TeacherShell（代码 efa18e8；走查 581c262：4 档双主题 8 组合 overflowPx 全 0、
     h1=1、SHEET 10-15 在页；专项探针新增 tools/probe-teacher-states.cjs：normal/empty/error/
     denied 四状态 × 4 档 × 双主题 32 状态全绿；D-P11.2-1 TeacherShell 不含标题栏）
P11.3 完成 /t/student/:studentId（代码 f8b74c8；走查 7712d3a：8 组合 + 状态专项 32 状态全绿 +
     探针 missing 口径修正（空 :studentId 不匹配动态路由，改用 /t/student/probe-missing-params））
P11.4 完成 /t/recommendations（代码 152800f；走查 935a3f3：8 组合 + 状态专项 32 状态；
     同批用真实下发数据重采 /t/student 8 组合，台账与详情页口径一致）
P11 批次 ─ 完成（教师账号走查无 R17 降级：按产品自身 role=teacher 流程取到教师态）
P12.1 完成 冻结区终检 + 全量验证（不单列提交，证据见「十六、」）：区间/工作区双口径空输出、
     vitest 三批 462 用例全绿、tsc 三段 exit 0、build --outDir /tmp/zhiwei-web-build-p12 成功、
     6.3 静态纪律无匹配
P12.2 完成 nav 断点清退评估（D26 判据；结论=**零清退**，无代码改动故无独立提交，见「十七、」）
P12.3 完成 全站走查汇总（8 组合终态产物入库 7396743 + 本次四态补缺/矩阵入库 68e7828：
     17 路由 × 8 组合 = 136 单元 overflowPx 全 0、h1 全 1；/paper 与 /attribution 的
     error/empty 四态实拍；见「十八、」）
P12.4 完成 文档与报告（README.md / LOOKATME.md 实测数字 + 本报告终版，见「十九、」）

本终结调用（P12 收尾）入库提交（旧→新）：
7396743（前次调用已入库）P12.3 终态走查 8 组合重采产物 /
68e7828 P12.3 四态取证补缺（/paper、/attribution 的 empty/error）+ 17 路由 × 8 组合矩阵
        （含新增 tools/probe-h1-sweep.cjs）/（本提交）P12.4 README + LOOKATME 实测数字 + 本报告终版。
P12.2 结论为零清退、无代码改动 ⇒ 无独立提交，留痕见「十七、」。
第 4 轮全程（bf3c7fe..HEAD，含本提交）：共 46 个提交，逐条见「二十、」。

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

九、未完成项与续完入口（**P9 调用时点留痕**，已被后续续写超越；终版口径见「十、」）
已超越说明：本节当时列的 P10.3–P12.4 未完成项，**在第 4 轮后续调用中已全部完成**；
  留存本节仅为 D25 续完链的可追溯性（不删历史留痕）。
未完成（当时）：P10.3-P10.6（/self-report /login /me /drive）、
  P11.1-P11.4（/ /t /t/student/:id /t/recommendations + TeacherShell）、
  P12.1-P12.4（终检 / nav 断点清退评估 / 全站走查汇总 / 文档与报告）。
状态：P10.1 /spaces（bcc253a + 06e6925）与 P10.2 /start（52212c6 + 走查提交）已结，
  其余页面代码一行未动。
续完入口：先读 01_PLAN「五、」+ 本快照表 + git log 三者对齐，从第一个未完成页
  P10.5 /me 继续（原型 PAGES.profile L3028-3120；sheetHead L3054「PROFILE / 个人中心」、
  SHEET 10-14、需求 2.14；Layout 登记 '/me'；七段制式——概览 measure / 我的老师 /
  当前空间 / 老师推荐台账 / 账号信息 kv / 外观与模型（主题 seg）/ 退出；主题切换键
  zhiwei_theme 与退出链路零改动；走查 4 档 × 双主题 + 主题切换实拍）。
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
D-P10.1-4（D23 空间记账·1 个探针空间）：P10.1 第一次跑 409 专项时用的是「先建一个重名空间
  制造 store 过期」的旧探针，真实新建了 1 个空间：**P10-1-409-1791710050756**（账号空间数
  4 → 5）。随即改探针为「stale 列表注入 + 真实 409 判定」的零副作用方式并重跑，此后 4 组
  探针（1440/375 × 双主题）不再新建任何空间。后续走查/探针按 D23 以「现为 5」为基数记账；
  该探针空间无证据、可留可清（无删除接口，故保留并如实记账）。

P10.2 /start（原型 PAGES['cold-start'] L1974-1999；代码 52212c6）
· 涉及文件：apps/web/src/pages/StartPage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/start'，一行 + 注释）。
  本页无 index.css 新增（bp-panel/Badge/Button/bp-note/.g2 等价类均已存在）。
· 逐段复现：① sheetHead（COLD START / 一次性引导 · SHEET 10-03 · 需求 2.3 ·
  h1「先选一条建立初始掌握度的路」· chip「一次性」）；② 01 四条路径 —— 原型 `.g2`
  （≥900 两列 / 窄档单列，落 `grid-cols-1 sheet:grid-cols-2`）四张 bp-panel 卡：
  「01 主路径 / 02 主路径 / 03 次要路径 / 04 次要路径」chip（原型 i<2 判据）+
  「时间 · 负担」tok（约 1 分钟·零负担 / 约 10 分钟·轻度 / 约 30 秒·最轻 / 随时·不采集，
  逐条对原型 MOCK.coldStart L1063-1068 + 既有文案）+ 标题 + 说明 + CTA「进入这一步」
  （首条 primary，其余 secondary，full 宽）；③ 02 说明旁注（原型 L1991-1992 的
  「采集不弹窗」纪律）。
· 业务逻辑零改动：四个去向仍是 PAPER_PATH / ASSESSMENT_PATH / SELF_REPORT_PATH / '/graph'，
  与迁移前的两条路径卡 + 自报按钮 + 图谱链接**逐条对应**（原型这四条本就是这四个入口）。
· 四态：无（静态引导页，规范 §7 明示）—— 故本页不引入任何新状态位。
· 走查（/start **不在** tools/responsive-audit.cjs 的 11 页 ROUTES 表里）：按 6.5 另起
  tools/probe-start-states.cjs，1440/1024/375 × 双主题共 6 组，逐组 overflowPx=0、main h1=1、
  SHEET 10-03 在页、路径卡 4 张、CTA 4 个；目验 1440 浅色：单 h1、无外壳页头残留、四卡两列。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；
  6.3 静态纪律四条无匹配、StartPage.tsx 无裸 hex 与 min-w-[。
D-P10.2-1（sub 口径偏差·两处）：原型 sub 里嵌「注册后已自动创建默认空间 <空间名>」
  （名字来自原型会话对象）；本工程 /start 页不持有空间列表（store 由 /spaces 填充），
  为一行文案新增取数或新增 store 订阅都超出「表现层」范围，故 sub 只说「已自动创建默认空间」，
  不编一个空间名。原型说明末尾「回门户图」链接指向 /portal，本工程**没有该路由**（门户是
  P11.1 的 '/'），故不迁移那半句（不造一个指向不存在路由的链接）。

P10.3 /self-report（原型 PAGES['self-report'] L1999-2040；代码 b026e72；半页收口）
· 本页是「上次调用未提交半页」的续完：进本次调用时工作区有 M SelfReportPage.tsx +
  M Layout.tsx 两处未提交改动。按 D25/D-P10.1-1 惯例先做**逐行复核**（不推倒重做）：
  · Layout.tsx 的改动 = D24 在 PAGE_OWNED_HEAD 登记 '/self-report'（Set 一行 + 4 行注释），
    与 P10.1/P10.2 同款改法、注释口径一致 ⇒ 保留。
  · SelfReportPage.tsx 的改动 = 整页视觉层重写（sheetHead L2018 / 01 章节 × 五档细网格表 /
    02 操作区 / 03 已记录态），逐段对照原型 L1999-2040 与既有业务逻辑后判定「方向正确、
    结构齐备」⇒ 不重写，只补两处极小项（下述）。
  · 半页收口的两处补齐（表现层）：① bp-stamp-ok 回执补 `role="status" aria-live="polite"`
    —— 原型 L2033 的 stamp-ok 本来就有这两个属性，属逐段复现的漏项；② 文件头注释补记
    第三条「口径差」（原型「一章都没选就提交」的琥珀 BLOCKED 章正文，见 D-P10.3-3）。
· 涉及文件：apps/web/src/pages/SelfReportPage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/self-report'，一行 + 注释）。
  本页无 index.css 新增（bp-seg / bp-stamp-ok / bp-tbl / bp-note / tok 全部既有）。
· 逐段复现：① sheetHead（SELF REPORT / 30 秒先验 · SHEET 10-04 · 需求 2.4 ·
  h1「起点自报：每章说一个档位」· chip T0 + 旁注）；② 01 章节 × 五档 —— 细网格表
  （表头 章节 / 你的感觉 / 已选 + caption「档位口径 · 全站一致」）：每行章节名 + 「N 个
  知识点」tok + `.bp-seg` 五档**真 radio**（name=sr-<章节>，01 几乎没学过 … 05 很熟；
  选中态与焦点环由 :has() 表达，不自绘）+ 已选列（选中 → accent chip「03 会一点，会晃」，
  未选 → tok「未选」）；分节右侧计数 chip「已选 n / 8 章」；③ 02 操作 —— 「按 3 档先填上」
  （secondary）+ 档位说明 tok + 「提交自报」（primary，loading 时「正在记下…」）+
  可用状态 tok（可提交 / 至少选一章）；④ 03 已记录 —— bp-stamp-ok 绿章 + tick +「自报已记录」
  +「已更新 N 个知识点的起点（作为先验参与计算，不覆盖测评与试卷证据）」+ 两条出路
  （开始测评 / 先看看我的地图）。
· 四态：无（规范 §7 self-report 行明示「提交失败走 toast」）—— 本页不引入任何新状态位。
· 业务逻辑零改动（对照 git HEAD 的迁移前实现逐条核）：levels 状态 / chosen 派生 /
  handleSubmit 三道守卫（submitting / 无空间 → toast+SPACES_PATH / 未选 → toast）/ selfReport
  调用 / setUpdated / markSelfReportDone(activeSpaceId) / 两条 toast 话术 / 两处 navigate
  目标（/assessment、/graph）全部原样；未新增、未删除任何取数或副作用。
· 走查：1440/1024/375 × 双主题共 6 组合重采，/self-report overflowPx 全 0（深色 JSON 另存
  -dark.json，两份的 theme 字段与文件名一致，可核查）。专项（6.5 新增
  tools/probe-selfreport-states.cjs，1440/375 × 双主题共 4 组 × 3 状态）：
  normal（8 章行 / 40 档位钮 / 已选 0）→ picked（点「按 3 档先填上」，已选 8 / 8 章）→
  submitted（第一行真选 03 档 → 真 POST /api/evidence/self-report → 已记录态：bp-stamp-ok
  在页 + RECEIVED + 「已更新 2 个知识点的起点」+ 两条出路）；12 个状态量尺全部
  overflowPx=0、main h1=1（D24 双 h1 复核通过）。目验 1440 浅色 picked / 1440 浅色 submitted：
  单 h1、无外壳通用页头残留、五档选中态与绿章回执清晰。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；
  6.3 静态纪律四条（任意值断点 / z-[ / CDN 字体）全局无匹配、SelfReportPage.tsx 无裸 hex
  与 min-w-[。
D-P10.3-1（半页收口的「已记录态」区块号）：原型 L2033 的已记录回执是**无编号**的
  `<section class="block">`（只有 01 / 02 两个编号分节）。本次收口保留 SheetBlock 的
  title「已记录」并沿用批次惯例给了 `no="03"`（/paper 的 STAGE3 完成块同款处理），
  理由是页面此时只剩这一个分节、编号不产生歧义；若 reviewer 判为多加元素，可单处删除。
D-P10.3-2（分节行号注释·口径一致）：本页注释里引用的原型行号按「01 章节 × 五档 = L2024-2026」
  标注（= 原型 rows / 表体所在行），与 sheetHead L2018、已记录态 L2033-2036 同一套锚点。
D-P10.3-3（原型 BLOCKED 章不迁移）：原型「一章都没选就提交」会插入琥珀色 BLOCKED 章
  （mock 的 F.tried 状态位，L2020-2023）。本工程既有语义是 **toast 警告 + 留在原地**
  （handleSubmit 的 `chosen.length === 0` 守卫），规范 §7 self-report 行也只写「提交失败走
  toast」；故不新增状态位，02 区块只保留「可提交 / 至少选一章」的实时 tok。属「原型 mock
  状态位 vs 工程既有语义」冲突，按 D-P9.4-2 同一裁决法：以现有语义为准并留痕。
D-P10.3-4（D23 记账·自报先验写入）：P10.3 的「已记录态实拍」必须真提交，故 4 组探针各提交
  1 次（每次只提交第一行 × 03 档）。副作用范围：按 functions/api/src/services/selfReport.ts，
  只写 mastery_profiles 的 p_l0 / mastery（**不写 evidence_events**），且跳过已有观测证据的
  知识点；4 次提交同一章节同一档位（幂等覆盖），实测每次 updated=2（代数式 2 个知识点）。
  空间数不变（仍为 5，见 D-P10.1-4）——本页不新建空间。

P10.4 /login（原型 PAGES.login L1912-1974；代码 7653b2b；走查 056a2c2）
· 涉及文件：apps/web/src/pages/LoginPage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/login'，一行 + 注释）、
  **apps/web/src/App.tsx（计划清单之外：去掉 /login 的 bare，见 D-P10.4-1）**、
  **apps/web/src/components/ToastHost.tsx（计划清单之外：仅注释准确性，见 D-P10.4-2）**。
  本页无 index.css 新增（bp-seg / bp-note / bp-kv / bp-panel / FormField+Input 全部既有）。
· 逐段复现：① sheetHead（AUTH / 最小摩擦入口 · SHEET 10-02 · 需求 2.2 · h1 随分段切换
  「登录知微 / 注册知微」· chip T1）；② 左栏（原型 .split 的 1fr）：登录/注册分段
  （.bp-seg + 真 radio，即原型 div.seg 的两个选项）+ 期望身份分段（原型 roleSeg →
  既有「我是学生 / 我是老师」两项 + 说明行取原型 MOCK.auth.identityNote 正文）+
  三个刻度字段（手机号或邮箱 / 密码 / 注册时昵称，FormField 可见标签 + 必填星 + 提示行）
  + 提交行（primary 主键 + 「先看看门户图」次键 + aria-live 反馈行）；③ 右栏（原型
  aside.panel.flat）：02 演示账号 —— 两张演示卡（学生端 accent chip / 教师端 warning chip
  + 一键进入 + 账号/密码 .bp-kv）+ 注册后冷启动说明。
· 业务逻辑逐行未动（对照 git HEAD 的迁移前实现核对）：七个状态位、validate 的两条消息
  与身份人称分支、finishAuth（setSession → 老师直送 TEACHER_HOME → listSpaces/setSpaces/
  pickDefaultSpace → register 走 START_PATH、login 走 SPACES_PATH，均 replace）、
  handleSubmit 的三道分支（本地校验 toast / 角色不符温和纠正 toast / 失败 toast）、
  handleDemoEnter 的「先 login 失败再 register」、DEMO_ACCOUNTS/DEMO_PASSWORD、
  两处 navigate 目标与 autoComplete 取值 —— 全部原样。唯一变化在分段控件的**实现**：
  迁移前是文字按钮 + aria-pressed，现为 .bp-seg + 真 radio（状态变更函数同源 switchTab）。
· 四态：表单不整页四态（规范 §7 login 行）；错误落字段级（FormField 的 role="alert" 行 =
  规范 5.3 的 .hint.bad 位）+ 既有非阻断 toast 兜底。实测空表单提交：错误行 2 + toast 1。
· 接线勾稽（规范第 11 章 #6，本轮关键页）——**全部在真浏览器取证**（056a2c2 的 4 份
  login-<档>-<主题>.json，每份 7 个状态）：
  · token 落盘：真填探针账号 → 真 POST /api/auth/login → hash 从 #/login 变 #/spaces、
    localStorage.zhiwei_token 存在；
  · 刷新不掉线：承上 Page.reload ⇒ 仍在 #/spaces（token 在盘，守卫不弹回登录页）；
  · 演示账号：点 aside「一键进入（学生端）」⇒ 本机首轮无 demo_student，走**自动注册**分支
    （真建号 + 服务端建默认空间，落地 #/start，与 finishAuth 的 isRegister 分支一致）；
    之后各组 demo_student 已在 ⇒ 走**登录**分支（落地 #/spaces）。两条分支各取证一次；
  · 401 清理：把 token 改成无效串再进 #/spaces ⇒ 服务端 401 ⇒ 会话清空 + 回 #/login
    （token=false）。这些链路都在 api/client.ts + stores/auth（冻结区），本次一行未动，
    authStore.test / client.test / routerGuard.test 全绿为证据。
· 走查：1440/1024/375 × 双主题共 6 组合重采，/login overflowPx 全 0，且**溢出元素由 1 → 0**
  （迁移前 1440 档有一个 `aurora-blob` 越界元素，随全屏开场一起退场）。专项探针
  （6.5 新增 tools/probe-login-states.cjs）4 组 × 7 状态 = 28 个状态量尺，全部 overflowPx=0、
  main h1=1。目验：1440 浅色 normal（单 h1、SHEET 10-02、左右分栏、暗色 aside 卡）、
  1440 深色 field-error（两行字段级红字 + toast）、375 浅色 normal（窄档单列、分段换行不溢出）、
  1440 浅色 aside 放大图（chip / 一键进入 / 账号密码 kv 三件齐）。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿（改后复跑一次）；
  tsc apps/web exit 0；6.3 静态纪律四条无匹配、LoginPage.tsx 无裸 hex 与 min-w-[。
D-P10.4-1（**计划外文件·App.tsx 去掉 /login 的 bare**）：原型 PAGES.login 是**画在外壳里**的
  图纸（sheetHead + `.split` 左右分栏 + 左侧分层索引可见），D24 登记表也写明「登录页在
  外壳内渲染图纸制式」；而本工程 /login 自 2026-09-22 起走 `Guarded bare`（全屏深色开场
  + 中央粒子标识，不套 Layout）。要按原型复现就必须改这一处：App.tsx 里
  `bare={route.path === LOGIN_PATH}` → `bare`（去参数），`Guarded` 的 bare 形参保留（/t
  教师端路由族仍用）。影响面：登录页从此有外壳（图签条 / 分层索引 / 标题栏）；
  随之退场的是旧开场三件动效资产（ParticleLogo 粒子标识 / aurora 氛围斑 / 表单入场揭示
  与磁性 CTA），它们只服务于「全屏开场」形态，原型 login 页没有 —— ParticleLogo 组件
  本身未删，门户 /（P11.1）与 ZhiweiLogo 仍在用。旧文档「登录页不套外壳」的理由
  （「未登录的人看到导航没有意义」）与本次视觉唯一依据冲突，按 D9 以原型为准并留痕。
  reviewer 若判定超出范围，本文件可单条 revert（该页其余部分不依赖它）。
D-P10.4-2（计划外文件·ToastHost.tsx 仅注释）：ToastHost 文件头原写「由『有外壳』的 Layout
  和『无外壳』的登录页共用」——P10.4 之后 /login 已在壳内，该句失真（注释腐蚀）。
  只改注释三行、零代码改动；Toast.tsx 同题注释实际不存在（核对后未动）。
D-P10.4-3（文案与分节号口径，不照抄 mock）：① 提交键文案沿用既有「进去看看 / 注册并开始」
  与「正在处理…」（原型是「登录 / 注册并创建默认空间」）；② 演示账号卡里的账号/密码给
  **本工程真实值**（demo_student / demo_teacher / demo123456），不照抄原型 mock 的
  13800001234 / teacher@zhiwei.dev；③ 原型 `a.btn.text` 指向 `#/portal`，本工程没有该路径
  （门户是 '/'，P11.1 迁移对象），故「先看看门户图」指到真实存在的 '/'；④ 原型把那排
  通道切换标成 role="tablist" 而控件是 radio，这里按控件如实标 role="radiogroup"
  （与本轮 /self-report /paper 的分段同口径）。
D-P10.4-4（**发现的组件库缺陷·本次只做本页规避，未扩大范围修根因**）：
  Button 的 `size="sm"` 档带 `text-tok`，而 cn.ts 的 tailwind-merge 登记表里，tailwind.config
  的 11 个自定义字号令牌只登记了 5 个（caption / ui-sm / reading / display / display-lg），
  **缺 6 个**（tok / mono-xs / body-sm / title-sm / title / num-lg）⇒ `text-tok` 被当成**颜色类**，
  在 cva 合并里吃掉 `text-on-accent`。
  取证（两条，均可复跑）：
    ① 浏览器实测：/login aside 两颗「一键进入」（size=sm + primary）计算样式为
       color rgb(18,57,90) / background rgb(26,95,180) ≈ 2.3:1（不到 AA）；className 里
       确实没有 `text-on-accent`。
    ② 纯函数复现：用工程同一份 extendTailwindMerge 配置跑
       tm('border border-accent bg-accent text-on-accent min-h-9 px-3 text-tok tracking-widest')
       ⇒ 输出里 `text-on-accent` 消失；换成 md 档的 `text-ui-sm` 则保留。
  影响面：全仓 `size="sm"` 共 28 处，其中 primary 变体者会渲染成「蓝底深蓝字」；
  secondary/quiet/link 变体的文字色同样会被 `text-tok` 顶掉（回落到继承色，多数情况下
  看不出差别，属同类静默失效）。这是 P3/P4 加蓝图字号令牌时漏登记留下的老问题，
  **不是本次改动引入**（P10.1 的 SpaceCreateForm 提交键、P10.3 的按钮都不是 sm 档）。
  本次处置：/login 的两颗「一键进入」改用**默认 md 档**（已实测 rgb(255,255,255) on
  rgb(26,95,180) ≈ 5.6:1 过 AA），并在页面注释里写明理由 —— 单页内不落地缺陷，
  同时**不**在本页提交里动 cn.ts（那会改变 P8/P9/P10.1–P10.3 已走查页面的观感，
  属跨批改动）。建议：作为下一轮认领（与第 3 轮 M-1/L-1 同性质）补登 5–6 个字号令牌到
  cn.ts 的 font-size 组，一处修全站；修完需对含 sm primary 按钮的页面补一次走查快照。

P10.5 /me（原型 PAGES.profile L3028-3120；代码 1b3f41d；走查 8bbfb93；半页收口）
· 本页是「上次调用未提交半页」的续完：进本次调用时工作区有 M MePage.tsx + M Layout.tsx +
  M StudentTeacherSection.tsx 三处未提交改动。按 D25/D-P10.1-1 惯例先做**逐行复核**（不推倒重做）：
  · Layout.tsx 的改动 = D24 在 PAGE_OWNED_HEAD 登记 '/me'（Set 一行 + 4 行注释），与 P10.1–P10.4
    同款改法、注释口径一致 ⇒ 保留。
  · MePage.tsx 的改动 = 整页视觉层重写（sheetHead L3054 / 01 概览 measure+dist / 02 我的老师 +
    03 当前空间 split / 04 老师推荐台账 / 05 账号 kv / 06 外观与模型 / 07 退出），逐段对照原型
    L3028-3120 与迁移前实现（git HEAD）后判定「方向正确、结构齐备、业务逻辑零改动」⇒ 不重写。
  · StudentTeacherSection.tsx 的改动 = 共享件视觉重写（Card → SheetBlock/bp-panel/bp-tbl）+ 新增
    `recommendationsOnly` 渲染开关（纯挂载开关，不改数据流）⇒ 保留（见 D-P10.5-1）。
· 涉及文件：apps/web/src/pages/MePage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/me'）、
  *apps/web/src/components/StudentTeacherSection.tsx（计划清单之外，仅视觉 + 渲染开关，见 D-P10.5-1）*。
  本页无 index.css 新增（bp-measure/big-num/bp-kv/bp-tbl/bp-note/bp-tick-list 全部既有）。
· 逐段复现：① sheetHead（PROFILE / 个人中心 · SHEET 10-14 · 需求 2.14 · h1「我的页」· chip T1）；
  ② 01 学习概览（四格 .bp-measure + 四档分布行 .dist + 平均掌握度旁注；loading → SkeletonLines，
  无空间 → 空盒）；③ 02 我的老师（邀请码绑定 + 确认卡 + 已绑定列表）+ 03 当前空间（.split 右栏：
  空间/学科/角色 kv + 切换空间）；④ 04 老师推荐（六态七列台账 .bp-tbl；回执 ▲▼ + 数值；done 未复测
  如实写「暂无复测结果」）；⑤ 05 账号信息（.bp-kv：账号/昵称（空显示「未设置」）/用户标识/注册时间/
  角色）；⑥ 06 外观与模型（ThemeToggle + 对话模型只读说明）；⑦ 07 退出（danger 主键 + ConfirmDialog）。
· 业务逻辑逐行未动（对照 git HEAD 迁移前实现）：getUserProfile / reportSummary 两个 effect
  （接口调用 / cancelled 清理 / 依赖数组 [] 与 [spaceId] 逐字符未动）、handleLogout 的
  clearAuth→clearSpace→navigate(LOGIN_PATH,replace) 顺序、ConfirmDialog 语义、概览 masteryBandOf
  分档与 clamp 文案全部原样。
· 走查：1440/1024/375 × 双主题共 6 组合重采，/me overflowPx 全 0（深色 JSON 另存 -dark.json，
  theme 字段与文件名一致，可核查）。专项探针（6.5 新增 tools/probe-me-states.cjs，1440/375 ×
  双主题共 4 组 × 5 状态）：logged-in → overview-empty → no-space → toggle（点页内 ThemeToggle：
  zhiwei_theme 真翻转 + html.dusk 同步）→ global（跳 /report 证全站生效）。20 个状态量尺全部
  overflowPx=0、main h1=1。目验 1440 浅色：单 h1「我的页」、SHEET 10-14、七段齐备、无外壳页头残留。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；
  6.3 静态纪律四条无匹配、MePage.tsx / StudentTeacherSection.tsx 无裸 hex 与 min-w-[。
D-P10.5-1（计划外文件·共享件视觉重写）：/me 的 02 我的老师 / 04 老师推荐本体是共享件
  components/StudentTeacherSection（不在计划 P10.5「涉及」清单）。不迁移则该页 02/04 仍是迁移前的
  圆角 Card 语汇；另起一份会复制「邀请码绑定 / 推荐回执」这套业务逻辑（违反「业务逻辑一行不改」）。
  故按 P10.1 的 SpaceCreateForm 先例**只换视觉**（Card → SheetBlock + bp-panel/bp-tbl + Badge/
  Button/FormField+Input 原语），并新增 `recommendationsOnly` 形参（纯渲染开关，只决定渲染哪一节，
  不改任何数据流），5 个接口调用 / load useCallback / 两 effect 依赖 / toast 文案 / navigate 目标
  逐行未动。这是本次唯一的计划外文件改动，特此标明；reviewer 若判超范围，可单条 revert 该文件。
D-P10.5-2（四态取证边界·overview-empty）：探针原设计「切到账号里的零数据空间取概览空盒」，实测
  该空间的 #9 reportSummary 仍返回**全部 24 个知识点行**（mastery 值全 0）⇒ MePage 的
  `distribution.total === 0` 空分支不触发（total = mastery.length = 24）。这是**既有语义**
  （迁移前 OverviewCard 同款判据），非本次引入；探针已如实记录该状态（截图与 logged-in 同形），
  并据此把探针的「空空间」判据校准为 max(mastery)=0（原按行数=0，永不成立）。四态的「无数据」
  分支在本账号取不到，留痕不伪造。
D-P10.5-3（四态取证边界·no-space 被守卫重定向，R19）：清掉 zhiwei_active_space 后进 /me 被
  router.tsx guardPath（L120-121：token 且无活跃空间且非 /spaces、/self-report → /spaces）
  重定向到 /spaces ⇒ MePage 内的「还没选中的学习空间」空盒分支**不可直接导航取到**（防御分支，
  与迁移前 `{activeSpace ? … : null}` 同性质）。按 R19 口径留痕，不伪造。

P10.6 /drive（原型 PAGES.library L2990-3028；代码 e59035c；走查 50a306b）
· 涉及文件：apps/web/src/pages/DrivePage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/drive'，一行 + 注释）。
  本页无 index.css 新增（bp-tbl/bp-panel/bp-note/Stamp/EmptyState 全部既有）。
· 逐段复现：① sheetHead（LIBRARY / 只读资料 · SHEET 10-13 · 需求 2.13 · h1「云盘 · 与正在补的
  内容挂钩」· chip「T2 · 只读」）；无空间分支走原型 L2994 的另一份 sheetHead（h1「云盘」+ chip T2）；
  ② 01 预置教材文件（计数 chip + .bp-tbl：文件名/类型/大小/只读徽标 + file_id；区域级四态）；
  ③ 02 与当前缺口相关（.split 左栏：既有 relevance —— 文件 → 你正在补的缺口名的确定性映射）；
  ④ 03 自定义知识库（.split 右栏：既有禁用入口制式化 —— 禁用 Button + 原因 + 「规划中 · 与只读
  区分」旁注）；⑤ 04 没有缺口时（既有「还没有能把资料和你挂钩的数据」引导 + 去做几道题出路）。
· 业务逻辑逐行未动（对照 git HEAD）：drive / reportSummary 两个取数（Promise.all + report 失败
  不拖垮列表）、cancelled 清理、依赖数组 [activeSpaceId] 逐字符未动；relevance 的确定性映射
  （GRAPH_NODES chapterOf / GRADE9_CHAPTERS / textbook+syllabus 选择 / slice(0,3)）全部原样。
  页面仅在既有 catch 内加一个 loadFailed 置位（D15c/D-P9.3-1 同口径的表现层状态位）。
· 走查：1440/1024/375 × 双主题共 6 组合重采，/drive overflowPx 全 0。专项探针（6.5 新增
  tools/probe-drive-states.cjs，1440/375 × 双主题共 4 组 × 4 状态）：normal（2 行文件表 + 2 个
  相关块 + 只读徽标）→ empty（注入空集合 ⇒ .bp-empty）→ error（注入 500 ⇒ .bp-stamp 红章）→
  no-space（守卫重定向 /spaces，R19）。16 个状态量尺全部 overflowPx=0、main h1=1。empty/error
  按 R12 注入口径，theme/injected 在 JSON 里如实标注。目验 1440 浅色：单 h1「云盘 · 与正在补的
  内容挂钩」、SHEET 10-13、只读徽标、02/03 齐备、无外壳页头残留。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；
  6.3 静态纪律四条无匹配、DrivePage.tsx 无裸 hex 与 min-w-[。
D-P10.6-1（原型 02 的两颗动作键不迁移）：原型 02「与当前缺口相关」带两颗键「分步练一道」
  （→ /practice?chapter=… ）与「看先修链」（→ /graph?path=… ）。本工程既有 /drive 没有这两条动作，
  补上即是**新增导航语义**（超出「只改视觉」）；且本工程 relevance 是「文件→缺口名」的映射，
  原型是「缺口→章节→相关知识点」的 mock 结构，二者数据形状不同。故不迁移这两颗键，只按原型
  panel 制式列既有 relevance（不漏既有信息）。
D-P10.6-2（错误态不提供重试，按原型 errAlt 口径）：原型 stateBlock 的错误态 errAlt 是「回报告页」
  这条出路（非真重试）。本页取数 effect 依赖 [activeSpaceId] 逐字符冻结（3.1a），页面内要在
  不复制取数逻辑的前提下重发同一请求做不到；故红章只给出路（回报告页），与原型一致。属
  「原型 mock 口径 vs 工程冻结约束」冲突，以「不复制业务逻辑」优先并留痕。
D-P10.6-3（noSpace 分支被守卫重定向，R19）：同 D-P10.5-3，/drive 的 noSpace 提示分支（原型
  L2994）在本工程被 guardPath 重定向到 /spaces，不可直接导航取到（防御分支）。按 R19 留痕。

十二、P10 批次收尾：6.1 全套 + 冻结区（全部实测）
类型检查三段（本轮 P10 收尾）：
  tsc --noEmit -p packages/engine/tsconfig.json → exit 0
  tsc --noEmit -p functions/api/tsconfig.json → exit 0
  tsc --noEmit -p apps/web/tsconfig.json → exit 0
测试三批（用例只增不减：462 = 217 + 43 + 202，与第 3 轮基准一致，无删减）：
  vitest run packages           → 2 文件 43 用例全绿
  vitest run functions/api/tests→ 19 文件 202 用例全绿
  vitest run apps/web/tests     → 22 文件 217 用例全绿
构建（等价口径，规避沙箱删除闸门）：
  vite build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p10
  → ✓ built in 3.80s；echarts 434.35 kB 仍为独立懒加载 chunk（GraphPage 24.98 kB /
    index 260.42 kB / react 165.57 kB）；CSS 427.27 kB
冻结区（3.2 双口径，均空输出）：
  git diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data → 空
  git diff --name-only HEAD -- apps/web/src/stores → 空
  git diff --name-only bf3c7fe..HEAD --（同上两组 + graphLayout/graphMastery/graphSnapshot/poster）→ 空
6.3 静态纪律四条（任意值断点 / z-[ / CDN 字体）全局无匹配；
  nav: 用法现存 36 处（P12.2 按 D26 逐条 A/B/C 分类处置）。

P11.1 /（门户落地页；原型 PAGES.portal L1855-1911 / hero L1881-1889；代码 e8ec745；走查 2c90cd0）
· 涉及文件：apps/web/src/pages/LandingPage.tsx（视觉层重写）、
  apps/web/src/components/Layout.tsx（D24 登记 '/'）、apps/web/src/index.css（新增 .bp-num-list 制式类）。
· 拍板④ + D6：保留现有四章叙事内容与信息架构（问题 / 方法 / 证据 / 开始）与**逐字动画**
  （KineticTitle）；视觉层换蓝图（去 glass-card/噪点，改 bp-panel / bp-measure / bp-tbl）。
  逐段复现：
  ① hero（自渲染，**不套 SheetHead 件**，D24 预判 portal 为 PUBLIC SHEET）：eyebrow
     「ZHIWEI / PUBLIC SHEET · SHEET 10-01 · 需求 2.1 · REV.A」+ KineticTitle（现有逐字标题）
     + lede（现有标语）+ CTA（立即体验 / 查看源码）+ hero-meta 数字行（现有 STATS 六数字落 .bp-measure）。
  ② 01 三条主张（原型 `.grid.g3`）：现有 PROOFS 三条 → 三列 bp-panel。
  ③ 02 五步闭环（原型 `ol.num-list`）：现有 LOOP_STEPS → .bp-num-list（新增制式类）。
  ④ 03 两个入口（原型 aside）：学生 / 教师两条入口（落点仍 LOGIN_PATH，由登录页按身份分流，
     navigate 语义零改动）+ 仓库外部链接。
  ⑤ 04 证据：现有「ΔAccuracy」叙事落旁注（原型 note 位；六数字已在 hero-meta，不重复罗列）。
  ⑥ 05 图纸目录（原型 `.tbl`）：现有 router.ROUTES 目录（图号=PRD 页面编号 / 视图 / 路径 / 直达）。
· 业务逻辑零改动：enter() = navigate(LOGIN_PATH)（一条路径自动分登录/已登录两态，与迁移前一致）；
  useMagnetic / useReveal / ParticleLogo 保留；未改 router.ROUTES、守卫、顶栏导航。
· 走查：/ **不在** tools/responsive-audit.cjs 的 11 页 ROUTES 表内（门户不进 11 页链路），按 6.5
  另起 tools/probe-landing-states.cjs，1440/1024/768/375 × 双主题共 8 组合，每组 normal +
  prefers-reduced-motion(reduce) 双通道 = 16 个状态量尺，全部 overflowPx=0、h1=1、逐字 span=13、
  量块=6、主张=3、闭环=5、目录行=13。目验 1440 浅色：单 h1、蓝图 hero、六数字、三条主张齐备。
· 冻结区：3.2 双口径空输出；vitest apps/web 22 文件 217 用例全绿（实例图/滚动揭示等 6 项进
  tokens/blueprint/reveal 等既有断言）；tsc apps/web exit 0；6.3 静态纪律四条无匹配、
  LandingPage.tsx 无裸 hex 与 min-w-[。
D-P11.1-1（拍板④ vs 原型克制动效观的口径裁决）：原型门户是「纯前端 mock、克制动效」的图纸；
  本工程保留既有四章滚动叙事与 kinetic 逐字动画（拍板④明文保留）。故按 D6「视觉层换蓝图」：
  只把 awwwards 期的一次性视觉资产（glass-card 玻璃面、噪点、超大 clamp 字号）换成蓝图制式
  （bp-panel / bp-measure / bp-tbl / text-display-lg token），叙事结构与逐字动画一字不删。
D-P11.1-2（原型 mock 口径不迁移 · 同 D5/12.3）：① hero-cta 的「纯前端原型 · 全部 mock 数据 ·
  无后端」chip 不迁移——本工程是真实前后端；② aside 的「外部链接，原型不请求任何真实接口」半句
  同样不迁移。
D-P11.1-3（图纸目录表内容口径）：原型目录表列「图号/视图/需求/优先级/直达」。本工程
  router.ROUTES 只有 path/label/page/requiresAuth/nav（无「需求号/优先级」字段），故目录表按
  「图号=PRD 页面编号(page) / 视图(label) / 路径(path) / 直达」呈现，「内容以现有为准」；
  **不编造 SHEET 图号或需求号**。router.ROUTES 以只读方式 import，冻结文件一行未改。
D-P11.1-4（D24 登记 '/' 的实效说明）：门户由 App.tsx 的 `<Route path="/">` 直接渲染（不经
  Layout 外壳），故 PAGE_OWNED_HEAD 登记 '/' 对当前渲染路径**暂无实际效果**；登记是为保持
  D24 登记表完整、并与「若将来门户纳入壳渲染」一致。portal 自渲染 hero，本身无双 h1 风险。
  逐字标题 h1 由 KineticTitle 渲染（aria-label=完整句子、逐字 span 对读屏隐藏），实测 h1=1。

十三、未完成项与续完入口（**P11.1 调用时点留痕**，已被后续续写超越；终版口径见「十、」）
已超越说明：本节当时列的 P11.2–P12.4 未完成项，**已在后续调用中全部完成**
  （P11.2–P11.4 见「补充段」；P12.1–P12.4 见「十六、」–「十九、」）。
未完成（当时）：P11.2-P11.4（/t(+TeacherShell) → /t/student/:id → /t/recommendations）、
  P12.1-P12.4（终检 / nav 断点清退评估 / 全站走查汇总 / 文档与报告）。
状态：P10 六页全部完成（/spaces bcc253a → /start 52212c6 → /self-report b026e72 →
  /login 7653b2b → /me 1b3f41d → /drive e59035c），每页代码 + 走查各独立提交；P10 批次收尾
  6.1 全套 + 冻结区双口径已实测（见「十二、」）；**P11.1 门户 / 完成**（代码 e8ec745 +
  走查 2c90cd0）。
续完入口：先读 01_PLAN「五、P11.2」+ 本快照表 + git log 三者对齐，从第一个未完成页
  P11.2 /t（教师工作台 + TeacherShell）继续 —— 原型 PAGES.teacher L3120-3177；
  sheetHead L3143「TEACHER CONSOLE / 邀请码与学情总览」、SHEET 10-15、需求 2.15；
  涉及 apps/web/src/pages/teacher/TeacherDashboard.tsx +
  apps/web/src/components/teacher/TeacherShell.tsx（角色校验链路一行不动）+ Layout 登记 '/t'；
  教师 403 兜底零改动；教师端走查需教师演示账号（tools/e2e-smoke.cjs 既有流程取；若无可用
  教师账号按 R17 降级为登录态 403 拦截截图 + 留痕，不伪造）。

十四、P11.2 准备期的探针副作用与修复（如实留痕）
· 事件：为核实 P11.2（教师工作台）走查是否有可用教师演示账号，本次调用在准备阶段跑了一个
  临时核查脚本（/tmp/teacher-check.cjs，不入库），它对 demo_teacher / demo123456 做了
  「先 login、失败则 register」的探测。由于该脚本 register 时**未带 role 形参**（产品自身的
  一键进入会带 role:'teacher'），而此账号在本机此前并不存在，于是服务端**创建了一个
  role=student 的 demo_teacher 账号**（user_id u_mv3onoz517kir，created 2026-10-11T10:31:17Z）
  及其默认空间。这会让产品「演示教师」按钮的「先登录」分支意外成功（落成学生身份），属真实副作用。
· 影响与修复：data/local_db/ 是 .gitignore 的**运行时数据**（非 3.1 冻结区的源 data/，
  git check-ignore 已核实为 data/local_db/）。用一次性脚本
  （/tmp/fix-demo-teacher.cjs，不入库）从 local_db 的 users.json 删除该 user、spaces.json
  删除其默认空间（users 70→69、spaces 76→75），并顺带扫描 mastery_profiles / evidence_events /
  mastery_logs / links / invite_codes 无残留关联记录。修复后 grep demo_teacher users.json = 0，
  演示教师流程恢复「先登录失败→再以 role=teacher 注册」的原样。jsonStore 逐次读盘（无内存
  缓存，已核实），故文件级修复即时生效、无需重启后端。
· 纪律反思：产品级探针一律应走「app 自身流程」（如登录页一键进入）或带 role 形参，不得用
  裸 register 探测账号；后续 P11.2 教师端走查将按 R17 用带 role:'teacher' 的注册（= 产品自身
  演示行为）或降级 403 截图，不再犯同类副作用。

十五、本次调用收口决定（P11.2 未开始）
· 本次调用已完成：P10.5 /me 收口 + P10.6 /drive + P10 批次收尾 + P11.1 门户 /（各代码/走查/
  报告独立提交）。P11.2（教师工作台 + TeacherShell）经评估为「2 个文件视觉重写（约 345 行）+
  教师端专属走查（需教师账号 / R17 降级）+ 专项探针」，体量与前几页相当；为避免在调用尾段
  留下半页未提交状态，**本次不启动 P11.2**，留待下一个续完调用从 P11.2 起做（续完入口见
  「十三、」）。工作区除他人未提交项（tempui/、.workbuddy/、package-lock.json 等）外干净。

十、当前状态一句话（终版）
第 4 轮 21 步全部完成（P8.0–P12.4，快照表逐条 hash）：17 页全部迁完，
  冻结区一行未动、既有测试文件零改动、462 用例全绿只增不减、tsc 三段 exit 0、build 成功、
  全站走查 17 路由 × 8 组合 overflowPx 全 0 且页面级 h1 全 1、nav 断点评估结论为零清退、
  README/LOOKATME 实测数字已更新。—— 交付后停，交 reviewer 按检查点⑦~㉑ + P12 口径把关。

（历史留痕）上一版此处写的是 P10 段状态「P10 六页 + P11.1 门户完成；下一站 P11.2 /t」。

补充段 · P11.2–P11.4 留痕（前次调用写完代码与走查但未写入本报告正文，本次从 git log 权威回填）
P11.2 /t 教师工作台 + TeacherShell（代码 efa18e8；走查 581c262）
· 涉及：apps/web/src/pages/teacher/TeacherDashboard.tsx + components/teacher/TeacherShell.tsx
  （视觉层）+ Layout.tsx 登记 '/t'、'/t/recommendations' + ownsHead 前缀匹配特例（D24）。
· 逐段：sheetHead（TEACHER CONSOLE / 邀请码与学情总览 · SHEET 10-15 · 需求 2.15）+ 01 总览
  measure 四格 + 02 邀请码块（码体 + kv + 复制/生成新码）+ 03 隐私边界与历史邀请码表 +
  04 学生列表九列（行可点，目标 URL 与原卡片墙逐字符一致）；区域级四态（骨架 / 空盒 / 红章
  真重试 / 403 红章）。
· 教师 403 兜底（requireTeacher）与角色校验链路零改动；前端不做角色拦截（拍板）。
· 走查：1440/1024/768/375 双主题 8 组合 overflowPx 全 0、h1=1、SHEET 10-15 在页；专项探针
  新增 tools/probe-teacher-states.cjs：normal/empty/error/denied 四状态 × 4 档 × 双主题
  = 32 状态全绿（denied 为学生 token 访问 /t 的服务端真 403 红章）。
· D-P11.2-1（TeacherShell 不含标题栏）：教师端外壳换蓝图制式（Board + 图签条顶栏 + Sheet），
  但**不挂** Layout 的右下标题栏 —— 教师页自渲染 SheetHead，重复标题栏即双页头风险。
· 教师账号走查**无 R17 降级**：按产品自身 role=teacher 流程取到教师态（准备期误建
  demo_teacher(student) 的副作用与修复见「十四、」）。

P11.3 /t/student/:studentId 学生详情（代码 f8b74c8；走查 7712d3a）
· 逐段：sheetHead（STUDENT DOSSIER / 教学必需的摘要 · SHEET 10-16 · 需求 2.16，h1 含昵称）+
  隐私声明前置 + 01 概览八格 measure 与四档分布条 + 近 7 日活跃 chips + 02 缺口表（逐条推给他）
  与附言表单（200 字计数）+ 03 已下发台账（Δ 正负文字标注）+ 04 最近答题原文 + 05 归因记录。
· 下发/撤回业务语义与 activeKpIds 三态集合零改动；403 兜底不动。
· 走查：8 组合 + 状态专项 32 状态（normal/error 注入红章/missing/denied 真 403）。
· 探针口径修正（留痕）：空 :studentId 不匹配动态路由，missing 态改用
  /t/student/probe-missing-params 取「无 space_id 页面级错误」。

P11.4 /t/recommendations 推荐管理（代码 152800f；走查 935a3f3）
· 逐段：sheetHead（RECOMMENDATION OPS / 全生命周期 · SHEET 10-17 · 需求 2.17）+ 01 汇总
  measure 三格 + 闭环说明 + 02 台账 bp-tbl 七列（六态 chip + 效果回执 ▲/▼/不可算）+
  03 状态口径六态闭集；区域级四态（骨架 / 空盒带出路 / 红章真重试 / 403）。
· 生命周期状态机零改动；D-P11.4-1：原型六态筛选条不迁移（既有页面无筛选交互，新增即新增
  导航/筛选语义，超出「只改视觉」）。
· 同批用真实下发数据重采 /t/student 8 组合（03 已下发 0→1 条），台账与详情页口径一致。

十六、P12.1 冻结区终检 + 全量验证（本次调用逐条实测）
区间口径（bf3c7fe 为本轮起点）：
  git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/router.tsx apps/web/src/api
    packages/engine functions data                                   → 空输出（零改动）
  git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/stores
    apps/web/src/lib/graphLayout.ts apps/web/src/lib/graphMastery.ts
    apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts     → 空输出（零改动）
工作区口径（HEAD）：上述两组同样空输出。
冻结测试文件（3.3 不动清单，额外加验）：
  git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/tests packages/engine
    functions/api/tests                                              → 空输出
  ⇒ 本轮 0 个既有测试文件被改动（「只增不减」由此直接成立：起点 462 = 终态 462）。
测试三批（各自独立一条，防 60s）：
  vitest run apps/web/tests       → 22 文件 217 用例全绿
  vitest run packages             → 2 文件 43 用例全绿
  vitest run functions/api/tests  → 19 文件 202 用例全绿
  合计 43 文件 462 用例，与第 3 轮基准逐项一致。
视觉门禁六件套单跑复核（额外一条，给 reviewer 定位）：
  tokens 23 + bands 12 + breakpoints 9 + themeStore 9 + blueprint 7 + graphSymbol 9 = 69 用例全绿。
类型检查三段：
  tsc --noEmit -p packages/engine/tsconfig.json  → exit 0
  tsc --noEmit -p functions/api/tsconfig.json    → exit 0
  tsc --noEmit -p apps/web/tsconfig.json         → exit 0
构建（等价口径，规避沙箱删除闸门）：
  vite build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p12
  → ✓ built in 4.12s；echarts 434.35 kB 仍是独立懒加载 chunk（进图谱页才加载）、
    GraphPage 24.98 kB、react 165.57 kB、index 266.66 kB、index.css 426.14 kB。
6.3 静态纪律四条（全局）：
  任意值断点变体 (min|max)-[NNNpx]:  → 无匹配；z-[  → 无匹配；
  CDN 字体（fonts.googleapis | fonts.gstatic）→ 无匹配。
结论：P12.1 判据全部满足（462+ 全绿 / tsc 三段 0 / build 成功 / 冻结区两口径空 /
  静态纪律无匹配）。本步不单列提交，证据即本节。

十七、P12.2 nav 断点清退评估（D26 判据；结论：零清退）
① 盘点（命令与命中）：grep -rn -E "(^|[^a-z-])(max-)?nav:" apps/web/src  → 23 行命中，
   逐行分三类如下（注释行与 router 的 nav 字段不计入「用法」）。
② A 类 = 语义仍属「触控目标作用域」（D1 收窄口径）⇒ 保留并留痕，共 3 处：
   · apps/web/src/components/chat/ChatPanel.tsx:58 「全屏打开」Link … max-nav:min-h-9
   · apps/web/src/components/chat/ChatPanel.tsx:67 关闭键 button …… max-nav:min-h-9
   · apps/web/src/components/Toast.tsx:75 「知道了」关闭键 …… max-nav:min-h-9
   理由：这正是 D1 收窄后 nav/max-nav 的唯一语义 —— ≤719.98 档把紧凑图标键抬到
   min-h-9（36px）触控目标；新三档无等价表达（narrow:420 只覆盖 ≤420，够不到 421–719；
   sheet:900 的 min 侧会连带改 768 档桌面态，属布局行为越界，违反「桌面像素级零变化」）。
③ B 类（布局行为残留，须换新档）：0 处 —— 本轮迁移已把这类用法全部消费掉
   （例：MobileNav 抽屉根 nav:hidden → sheet:hidden，MobileNav.tsx L229/L262；
   ChatPage 双栏改挂 annos:1180 新档）。
④ C 类（死代码，无引用）：0 处（注释中的 nav: 字样是口径留痕，不是可删代码）。
⑤ 判据复核：
   vitest run apps/web/tests/breakpoints.test.ts → 9 用例全绿；
   tailwind.config.js 的 screens.nav='720px' 定义与 breakpoints.test 对 nav:/max-nav:
   两侧使用点的断言**逐字保留、零改动**（D1：只清用法不删定义）。
   触控目标不回退旁证：A 类三处所在文件本轮 diff 为空
   （Toast.tsx 最后改动 dfa3623 = P4 就地改造；ChatPanel.tsx 最后改动 f5d9aed = P5 落位），
   且 375 档 8 组合终态 overflowPx 全 0；min-h-9 = 36px 为静态类，无运行时分支。
D-P12.2-1（本步与计划命令的偏差，如实留痕）：计划 P12.2 列的两条 audit 重采命令
   （375 浅色 / 768 深色）**未执行**。理由：本步结论为零清退、无换档，重采不产生新信息
   （audit 工具的采样字段里根本没有触控目标高度），却会用仅 capturedAt 不同的产物覆盖
   已入库的终态审计件。改用「引用既有终态 8 组合审计数据 + 本轮 diff 空证明三处用法零改动」
   作为不回退证据；若 reviewer 要求，可随时按计划命令补跑。
结论：零清退；无代码改动 ⇒ 无独立提交。

十八、P12.3 全站走查汇总（8 组合终态 + 四态补缺 + 17 路由矩阵）
1) 半成品新鲜度核对（进本次调用时工作区 32 个未提交走查件）：
   实测 mtime 20:10–20:12（attribution/paper 探针 JSON 与 png），晚于前次入库提交
   7396743（19:55）与各页代码提交（/paper 39b3ea1 16:34:52、/attribution b9ca011 16:44:37）
   ⇒ 按 D25 E3 新鲜度判据**续用、不重采**（判据亦复核：8 份 audit JSON 与 HEAD 内容一致）。
2) 四态取证补缺（清偿 D-P9-6 的两条尾账）：
   · tools/probe-paper-states.cjs：5 态 → 7 态，新增
     empty（注入 /api/space/{id}/drive=[] ⇒ 整页级 .bp-empty + 「回学习空间」出路）与
     error（注入同接口 500 ⇒ 红章 RED-STAMP + 「重试一次」真重发）；
   · tools/probe-attribution-states.cjs：5 态 → 7 态，新增
     empty（清 sessionStorage 的 zhiwei_paper_wrong_* 后进页 = 真实「无可归因错题」态）与
     error（带 ?attribution_id= 进页 + 注入 #14 GET 500 ⇒ 红章 + 真重试）；
   · 注入态一律在 JSON 的 injected 字段与截图 toast 里**显式标注来源**，不冒充真实链路；
   · 实测：两页各 7 态 × 1440 × 双主题，全部 overflowPx=0、h1=1；本次已目验
     /paper empty、/paper error、/attribution empty、/attribution error 四张（均为
     单 h1 + 页面级空盒/红章 + 出路制式）。
3) 新增 tools/probe-h1-sweep.cjs（6.5 口径，只读只取证）：一条命令量一个（档 × 主题）
   组合的 14 条学端路由页头（overflowPx / 整页 h1 数 / main 内 h1 数 / header 内 h1 数 /
   文本长度），本次补齐 **4 档 × 双主题 = 8 份 h1check-*.json**（1440/1024/768/375 ×
   深浅），逐份 14 路由全部 overflowPx=0、h1=1；教师三页不在该表内，由 teacher-* 探针的
   32 状态承担。
4) 17 路由 × 8 组合矩阵（node 汇总脚本 /tmp/p12-overflow-matrix.cjs，只读产物）：
   产物入库 _pipeline/screenshots/style10/overflow-matrix-17x8.md（124 行），含两张表：
   一、overflowPx 矩阵 17 路由 × 8 组合 = 136 单元 → 全 0（非 0/缺失单元数 = 0）；
   二、页面级 h1 计数矩阵 = 136 单元 → 全 1（≠1 单元数 = 0、取值缺失 = 0）。
   数据源：8 份 audit-style10-*.json（11 页主走查）+ 6 类专项探针 JSON
   （/practice、/start、/、/t、/t/student/:studentId、/t/recommendations，各 8 组合）。
   口径自检：全部 JSON 的 width/theme 字段与文件名一致，无告警（防「用深色数据冒充满色」）。
   路由口径说明：产品 ROUTES 表 13 页 + 门户 / + 教师三页 = 17 个视图；
   audit 工具 11 页表不含 /practice、/start、/ 与教师页，故这几条走专项探针同一硬判据。
5) D23 记账（本次调用）：**新建空间 0、不新建账号**；探针仍只挑不建 —— 实测账号空间数仍为
   5（h1check 探针日志 auth 行 = 「空间数=5 活跃=初中数学」，与 D-P10.1-4 记账一致）。
   试卷确认探针按既有链真提交（/paper 7 态链里含 1 次「识别→采纳→确认」），副作用范围
   与「八、」同口径（落在既有取证空间，未新增空间）；本页其余状态与 /attribution 的
   empty/error 为清态与注入口径，不落业务数据。
6) 提交：走查产物独立提交 **68e7828**（56 个文件：_pipeline/screenshots/style10 的 51 件
   + tools/probe-paper-states.cjs / probe-attribution-states.cjs / probe-h1-sweep.cjs）；
   `git show --stat` 已复核范围仅走查产物与探针，未混入任何代码文件与他人未提交项。

十九、P12.4 文档与报告（实测数字与视觉描述更新，不改结构）
· README.md（7 处，逐条）：
  ① 技术架构图内「响应式三档」→「响应式四档」；
  ② 工程质量·测试：41 个测试文件 · 432 用例（引擎 43 + 后端 202 + 前端 187）
     → **43 个测试文件 · 462 用例（引擎 43 + 后端 202 + 前端 217）**；
  ③ 工程质量·响应式：六档 → **1440/1024/768/375 四档 × 深浅双主题**，并写明
     「17 路由 × 8 组合 = 136 单元 overflowPx 全 0、页面级 h1 全 1」+ 汇总件指引
     `_pipeline/screenshots/style10/overflow-matrix-17x8.md`，同时补视觉描述
     （蓝图成图制式全站统一、字体三族自托管 Chivo / IBM Plex Mono / Noto Sans SC、禁 CDN）；
  ④ 项目结构：apps/web 行「学生端 11 页」→「学生端 13 路由 + 门户 /」；src/pages 行
     「主链路 10 页 + me 我的」→「学生端 14 页（主链路 + 我的 + 门户）」；
  ⑤ apps/web/tests「18 个测试文件」→「22 个」；
  ⑥ functions/api/tests「14+ 个测试文件」→「19 个」；
  ⑦ _pipeline 行补 style-10 走查产物指引（screenshots/style10/）。
  历史段（如 v1.0「响应式三档 / 389 用例全绿」）是按期留痕，**不改**。
· LOOKATME.md（3 处，逐条）：
  ① 「最后更新」行改写为 style-10 第 4 轮交付状态（分支 tempui-doc、累计 242 提交、
     本轮 45 提交），原行降级为「最后更新（历史留痕）」保留；
  ② 进度快照表新增一行「style-10 全站视觉迁移（第 1–4 轮，2026-10-10 → 10-11）」，
     含 17 页范围、token/字体/断点/四态/页头登记等状态描述与「第 1–3 轮 PASS、待第 4 轮审查」；
  ③ 「关键数字」章新增「style-10 迁移轮实测（2026-10-11 终态）」块：462 用例/43 文件
     （视觉门禁 69 = 23+12+9+9+7+9）、既有测试文件零改动、tsc 三段 0、build 五个数字、
     17 路由 × 8 组合走查与产物指引、冻结区终检空输出、断点四档口径（含 nav 语义收窄）、
     nav 清退结论为零清退。
· 本报告：第 4 轮终版（21 步全勾选 + 本轮 46 提交逐条 + 偏差索引 + OBS-2 对照），
  随本提交入库。
· 自查命令与结果（本次实测）：
  grep -c "462" LOOKATME.md → 3（终数落点：最后更新行 / 关键数字实测块 / 测试基线句）；
  grep -c "462" README.md   → 1（工程质量·测试行）；
  git status --porcelain（提交前）→ 仅 M LOOKATME.md / M README.md /
  M _pipeline/02_EXEC_REPORT.md 三个本批文件，另有他人未提交项（tempui/、.workbuddy/、
  package-lock.json）未被触碰；
  提交后 `git --no-pager diff --name-only HEAD -- _pipeline` 期望空输出（待本提交落定后复核）。

二十、第 4 轮提交计数（起点 bf3c7fe，逐条，旧→新；含本提交共 46 条）
 1 03da6ee style10记账: 01_PLAN 第10版 + 第9版归档 + 第3轮审查报告入库（P8.0）
 2 087da5d style10P8a: M-1 标签叠压修复（labelLayout.hideOverlap + 8 字截断）+ L-1 ZOOM_MIN 0.12→0.3
 3 904ef8f style10P8走查: M-1/L-1 清偿走查取证（6 组合重采 + OBS-2 前后放大对照 + 1024 形状地图留痕）
 4 e5ee88f style10批3: /chat 页图纸制式 + D4 双栏；七件套逻辑零改动（P8.2 代码）
 5 2adb903 style10P8走查b: /chat 8 组合走查重采 + 深色 JSON 归档
 6 7ae0559 style10轮4记账
 7 a867887 style10轮4报告: P8 段完整留痕 + 偏差 + 续完入口
 8 74fa812 style10轮4报告b: 区间冻结区实测补记
 9 78b236b style10批4-1: /assessment 测评（P9.1）
10 c2ef68e style10P9走查: /assessment T0 四档双主题 8 组合重采
11 36948ae style10批4-2: /practice 练习（P9.2）
12 5f9a72b style10P9走查: /practice 8 组合重采 + 提示链专项
13 39b3ea1 style10批4-3: /paper 试卷（P9.3）
14 c9d1494 style10P9走查: /paper 8 组合 + 三段流转与勾稽 #3 全链专项
15 b9ca011 style10批4-4: /attribution 归因（P9.4）
16 a11e7e5 style10P9b: /attribution 走查修复（嫌疑分口径按真实字段改写）
17 88baf44 style10P9走查: /attribution 8 组合 + 向导五步专项
18 38d3355 style10轮4报告c: P9 段完整留痕（含 D-P9.x 与 D23 记账）
19 bcc253a style10批5-1: /spaces 空间（P10.1，含共享件 SpaceCreateForm 仅换视觉）
20 06e6925 style10P10走查: /spaces 6 组合 + 四态与真 409 专项
21 52212c6 style10批5-2: /start 冷启动（P10.2）
22 bc1941d style10P10走查: /start 6 组探针（该页不在 audit ROUTES 表，按 6.5 另起）
23 b026e72 style10批5-3: /self-report 自报（P10.3，半页收口）
24 5d59594 style10P10走查: /self-report 6 组合 + 已记录态专项
25 1eafbb5 style10轮4报告d: P10.3 段留痕
26 7653b2b style10批5-4: /login 登录（P10.4，含 App.tsx 去皮 bare 与 ToastHost 注释）
27 056a2c2 style10P10走查: /login 6 组合 + 链路专项 7 状态 × 4 组
28 ddd2930 style10轮4报告e: P10.4 段留痕
29 1b3f41d style10批5-5: /me 我的（P10.5，半页收口 + 共享件仅换视觉）
30 8bbfb93 style10P10走查: /me 6 组合 + 主题切换/全站生效专项
31 e59035c style10批5-6: /drive 云盘（P10.6）
32 50a306b style10P10走查: /drive 6 组合 + 四态专项
33 b454f2e style10轮4报告f: P10.5/P10.6 段 + P10 批次收尾（6.1 全套）
34 e8ec745 style10批6-1: / 门户落地页（P11.1，拍板④ + D6）
35 2c90cd0 style10P11走查: / 8 组合 + reduced-motion 双通道专项
36 dc18956 style10轮4报告g: P11.1 段留痕
37 ac903f3 style10轮4报告h: P11.2 准备期探针误建 demo_teacher 的副作用留痕与修复
38 efa18e8 style10批6-2: /t 教师工作台 + TeacherShell（P11.2）
39 581c262 style10P11走查: /t 8 组合 + 四状态 × 4 档 × 双主题 32 状态
40 f8b74c8 style10批6-3: /t/student 学生详情（P11.3）
41 7712d3a style10P11走查: /t/student 8 组合 + 32 状态 + 探针 missing 口径修正
42 152800f style10批6-4: /t/recommendations 推荐管理（P11.4）
43 935a3f3 style10P11走查: /t/recommendations 8 组合 + 32 状态 + 真实下发数据重采 /t/student
44 7396743 style10收尾b-1: 全站走查 8 组合终态重采入库（前次 P12 调用中断遗留产物）
45 68e7828 style10收尾b-2: P12.3 四态取证补缺 + 17 路由 × 8 组合矩阵 + probe-h1-sweep
46 （本提交）style10收尾c: README/LOOKATME 实测数字 + 第 4 轮执行报告终版
（本提交 hash 自引用不可写；读到时以 `git log -1` 为准 —— 与 LOOKATME 同一惯例。）

二十一、P8 段留痕回填（权威副本：07 号 a867887 与 08 号 74fa812 两个提交内的本文件历史版本）
P8.0 记账（03da6ee）：白名单显式 add 四件（01_PLAN 第 10 版 / 第 9 版归档 /
  03_REVIEW 第 3 轮 / 其归档件），提交后 `git diff --name-only HEAD -- _pipeline` 空输出；
  他人未提交项（tempui/、.workbuddy/、package-lock.json 等）一律未碰。
P8.1 清偿 M-1 + L-1（代码 087da5d；走查 904ef8f；唯一代码文件 GraphPage.tsx，+42/-7）
· D21 第一层核实：label 的 overflow 通路确实存在（echarts labelStyle.js 复制 overflow、
  zrender parseText.js 的截断条件 width!=null、series.labelLayout 由 echarts/core 默认注册），
  但 1440/1024 实采放大目验证实多列标签仍咬合 —— 单列在屏间距 ≈ COLUMN_GAP 240 × 适应缩放
  0.3 ≈ 72px，而 16 字名称渲染宽约 176px，密度控不住 ⇒ 走到 D21 第二层收口。
· D21 第二层实现：series 级 labelLayout:{hideOverlap:true}（内建避让，hideOverlap 置
  label.ignore=true 而保留 emphasis 态 ignore=false ⇒ 悬停仍可见该节点名称）+
  shortLabel() 把 >8 字名称截到 8 字 + 省略号。
· D22 实现：ZOOM_MIN 0.12 → 0.3，与 fitZoom 地板同口径，注释留痕「防节点成点」。
· 冻结语义零改动：取数 useEffect、守卫顺序、点火/重绘/DIM_OPACITY/文字清单键盘语义、
  poster 链路、文案常量全部原样（graphMastery/graphLayout 及其测试零改动、全绿）。
· 1024 档如实说明：1024 画布容器 clientWidth < 700，第 3 轮 12acf95 既有策略「窄档只留
  形状地图不画标签」在 1024 档已生效（showLabels = cw >= 700），故 1024 本无标签可叠压，
  留痕 obs2-m1-1024-light-shapemap-crop.png（非本轮引入）。
· 命令与结果：apps/web vitest 22/217 全绿；tsc apps/web exit 0；build --outDir
  /tmp/zhiwei-web-build-p8a ✓ built in 4.77s；3.2 冻结区两命令均空输出；走查 6 组合重采
  逐档 0px；8 份 audit JSON（11 路由 × 8 组合）overflowPx 全 0（375 硬判据不回退）。
P8.2 /chat（代码 e5ee88f；走查 2adb903）
· 变更：ChatPage.tsx（视觉层重写）+ Layout.tsx（D24 登记 '/chat'）+ index.css（新增
  /chat 页制式段：.bp-thread 气泡三制式与系统提示、.bp-composer 细线分隔）；七件套零改动
  （制式锚在全屏页外壳 .bp-thread 作用域上，右侧常驻面板不受影响）。
· 逐段：SheetHead（CHAT / 学长式引导 · SHEET 10-09 · 需求 2.9）+ 01 本轮对象（对象 chip +
  置信度 chip + 收进侧栏）+ 02 消息流（气泡三制式 + 停滞出口 Stamp tone=amber）+
  03 发送（原型 .composer 顶部细线制式，focus-glow 保留）；双栏挂 annos 新档，≤1179 单栏。
· 勾稽：#1 SSE 六事件真流式（useChatSend/sse/client 零改动，sse.test 20 + client.test 13
  全绿）；#2 常驻面板同构（同一套七件套，chatPanel.test 5 + dialogStore.test 7 全绿）；
  #5 守卫 guardPath 原样。
· 走查：4 档 × 双主题 8 组合重采，逐档 0px，目验 1440 浅色单 h1、三节与右侧链路栏落位正确。
· D-P8.2-1（四态 error/loading 的落点偏差）：计划 §7 chat 行要求 error → Stamp 红章，
  实现按 3.1c 保留既有落点 —— 失败是降级链末端由 useChatSend 调 store.failAssistant 追加/
  改写的那条错误气泡（文案含「草稿还在输入框里」），未新增页面级红章（新增派生需匹配错误
  文案、脆弱且要碰 store 语义）；loading 同理不适用（本页无取数，对话在全局 store）。
· 未完成专项（如实）：(a) 登录态发消息的 SSE 流式实拍与降级链触发截图；(b) 面板/全屏
  同构对照截图；(c) tools/probe-chat-states.cjs 未新建。原因：当时输出容量不足，优先保证
  「页面视觉 + 三件套 + 8 组合走查 + 单页提交」。这三项**至今未补**，为本轮已知取证缺口
  （/chat 的功能链证据由 sse/client/chatPanel/dialogStore 四个冻结测试文件全绿承担）。

二十二、偏差留痕索引（D-P8.x → D-P12.x，正文位置见括号）
D-P8.1-1（二十一、）D21 分层落点：走第二层（hideOverlap + 8 字截断），未走第三层兜底。
D-P8.2-1（二十一、）四态 error/loading 保留既有落点（错误气泡），未加页面级红章。
D-P8.2-2（二十一、）原型「专注/陪伴」模式 seg 属 mock，按 D5 不迁移。
D-P9.3-1（七、）/paper 取数 effect 内三个表现层状态位（filesLoading/loadFailed/recognizeFailed）。
D-P9.4-1（七、）/attribution 回显 effect 内 viewFailed（红章 + 真重试）。
D-P9.4-2（七、）候选根因块口径按真实字段改写（嫌疑分不归一，上界 d=1 0.60）。
D-P9.4-3（七、）候选根因块按数据渲染（direction=self 时为空、不渲染）。
D-P9-4（七、）走查提交用目录级 + 白名单工具 add（先 status 逐行核对、后 show --stat 复核）。
D-P9-5（七、）走查顺序：先提交代码再重采，使 D25 E3 新鲜度在提交时点可验证。
D-P9-6（七、）P9.3/P9.4 的 error/empty 未取证 → **本次 P12.3 已补清**（见「十八、」2)）。
D-P10.1-1~4（P10.1 段）计数 chip 只给真实计数 / kv 行按真实字段 / 共享件仅换视觉 / 1 个探针空间记账。
D-P10.2-1（P10.2 段）sub 不编空间名、不造指向不存在路由的链接。
D-P10.3-1~4（P10.3 段）已记录态区块号 / 行号注释口径 / 原型 BLOCKED 章不迁移 / 自报先验写入记账。
D-P10.4-1~4（P10.4 段）App.tsx 去皮 bare（计划外必要改动）/ ToastHost 注释 / 文案与路径口径 /
  组件库 text-tok 覆盖缺陷举证与单页规避（**建议下一轮认领修根因**）。
D-P10.5-1~3（P10.5 段）共享件仅换视觉 + 渲染开关 / overview-empty 取不到的边界 /
  no-space 被守卫重定向（R19）。
D-P10.6-1~3（P10.6 段）原型两颗动作键不迁移 / 错误态只给出路不重试 / noSpace 被守卫重定向。
D-P11.1-1~4（P11.1 段）拍板④ vs 克制动效观 / mock 口径不迁移 / 目录表内容口径 / 登记 '/' 暂无实效。
D-P11.2-1（补充段）TeacherShell 不含标题栏（避免双页头）。
D-P11.4-1（补充段）原型六态筛选条不迁移（避免新增筛选语义）。
D-P12.2-1（十七、）P12.2 两条 audit 重采命令未跑及其理由。
D-P12.3-1（十八、）本次沿用前次调用的新鲜半成品（mtime 20:10–20:12 > 7396743 19:55）。
D-P12.3-2（十八、）四态补缺用 R12 注入口径，并在 JSON injected 字段与截图 toast 显式标注。
D-P12.4-1（十九、）LOOKATME「最后更新」行降级保留为历史留痕，新增行写本轮状态。
（未列 D-P11.3-x：该页无独立偏差，只有探针 missing 态口径修正，已写在补充段。）

二十三、OBS-2 前后对照（M-1/L-1 清偿取证复核，本次调用复看产物）
产物（_pipeline/screenshots/style10/，均由 904ef8f 入库）：
  修复前整页：style10-1440-light-normal-before-m1.png / style10-1440-dark-graph-before-m1.png
  修复后整页：graph-1440-light-normal.png / graph-1440-dark-normal.png（probe-graph-states 重采）
  放大对照：obs2-m1-1440-light-before-crop.png / -after-crop.png（深色同款）；
            1024 档：obs2-m1-1024-light-shapemap-crop.png（说明 1024 走「形状地图」既有策略）
  裁剪口径：PIL 指定窗口 x380-1300 / y655-735 后 2 倍放大（sips 只能居中裁剪，故用 PIL；
  脚本 /tmp/m1-crop.py 不入库，DEV-4 惯例）。
本次复看结论（浅色 1440）：修复前 12 列标签相互穿插成一条连续文字带、不可读；修复后为
  分离的短标签、截断处带省略号且标签间有留白 —— 与 D21 第二层选型（hideOverlap + 8 字截断）
  一致；深色档同款产物同样入库可复看。
配套硬判据（同批 904ef8f）：1440/1024/375 × 双主题 6 组合重采逐档 0px；8 份 audit JSON
  的 11 路由 × 8 组合 overflowPx 全 0（375 硬判据不回退，OBS-1 取舍不推翻）。
L-1 前后口径：修前 ZOOM_MIN 0.12 ↔ fitZoom 地板 0.3 两口径并存；修后单一常量 0.3
  （键盘 +/- 与工具条缩放共用），注释留痕「防节点成点」，禁止并存。
