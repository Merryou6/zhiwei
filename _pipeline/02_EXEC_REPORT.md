知微 · style-10 迁移 第 4 轮执行报告
====================================
执行角色：implementer；起点 HEAD=bf3c7fe；第3轮报告已归档 _pipeline/archive/02_EXEC_REPORT_20261011_1548.md
一、快照表（D25 E5）
P8.0 03da6ee 完成 记账
P8.1 087da5d+904ef8f 完成 清偿 M-1/L-1
P8.2 e5ee88f+2adb903 完成 /chat
P9.1-P9.4 未开始
P10.1-P10.6 未开始
P11.1-P11.4 未开始
P12.1-P12.4 未开始

二、本轮实际完成的三个批次
P8.0 记账：白名单显式 add 四件（01_PLAN 第10版 / 第9版归档 / 03_REVIEW 第3轮 / 其归档），
  提交后 git diff --name-only HEAD -- _pipeline 空输出；他人未提交项一律未碰。
P8.1 清偿（D21/D22）：见「三、」。
P8.2 /chat：见「四、」。

三、P8.1 清偿（M-1 + L-1）
文件：apps/web/src/pages/GraphPage.tsx（唯一代码改动，纯表现层）
D21 第一层核实：label 的 overflow 通路确实存在（echarts labelStyle.js L270
复制 overflow；zrender parseText.js L104 截断条件 width!=null；series.labelLayout
由 echarts/core 默认注册，export/core.js L50-51）。
但 1440/1024 实采放大目验证实：多列标签仍咬合成片不可读 —— 单列在屏间距 =
COLUMN_GAP 240 x 适应缩放 0.3 ≈ 72px，而 16 字名称渲染宽约 176px，
仅靠 label.width:96/overflow:'truncate' 控不住密度 → 采用 D21 第二层。
D21 第二层实现：series 级 labelLayout:{hideOverlap:true}（ECharts 内建避让；
hideOverlap 置 label.ignore=true 并保留 emphasis 态 ignore=false → 悬停仍可见该
节点名称）+ shortLabel() 把 >8 字名称截到 8 字 + 省略号（1024 说明见下）。
D22 实现：ZOOM_MIN 0.12 → 0.3，与 fitZoom 地板同口径，注释留痕「防节点成点」。
OBS-2 前后对照（均在 _pipeline/screenshots/style10/）：
 修复前 style10-1440-light-normal-before-m1.png / style10-1440-dark-graph-before-m1.png
 修复后 graph-1440-light-normal.png / graph-1440-dark-normal.png（探针重采）
 放大对照 obs2-m1-1440-light-before-crop.png / -after-crop.png 与深色同款
 （PIL 指定窗口裁剪 x380-1300 / y655-735 后 2 倍放大；sips 只能居中裁剪，故用
 PIL，脚本 /tmp/m1-crop.py 不入库，DEV-4 惯例）
目验结论：修复前 12 列标签相互穿插成连续文字带（不可读）；修复后为分离的短标签，
截断处带省略号且有留白（obs2 对照图可复看）。
1024 档如实说明：1024 画布容器 clientWidth < 700，第 3 轮 12acf95 既有策略「窄档
只留形状地图不画标签」在 1024 档已生效（git show 12acf95:…GraphPage.tsx 含
showLabels = cw >= 700），故 1024 档本无标签可叠压；1024 修复后图 graph-1024-
light-normal.png + obs2-m1-1024-light-shapemap-crop.png 留痕（非本轮引入）。
P8.1 命令与结果：apps/web vitest 22/217 全绿；tsc apps/web exit 0；
build --outDir /tmp/zhiwei-web-build-p8a ✓ built in 4.77s（echarts 434.35 kB
仍独立懒加载 chunk，GraphPage 24.17 kB）；3.2 冻结区两命令均空输出。
 走查：1440/1024/375（深+浅）6 组合重采，逐档「页面级溢出合计 0px」；
 8 份 audit JSON 解析（11 路由 × 8 组合）overflowPx 全 0（375 硬判据不回退）；
 探针 probe-graph-states.cjs 1440/1024 深+浅 4 次重采（含 OBS-2 数据态）。

四、P8.2 /chat（e5ee88f 代码 + 2adb903 走查）
变更文件：ChatPage.tsx（视觉层重写）；Layout.tsx（PAGE_OWNED_HEAD 加 '/chat'，D24）；
 index.css（新增「/chat 页制式」段：.bp-thread 气泡三制式与系统提示、.bp-composer
 细线分隔）。七件套零改动 —— 制式经 .bp-thread 作用域选择器锚在全屏页外壳上
 （与 .chat-stream 同手法），右侧常驻面板不受影响。
逐段复现：① SheetHead（CHAT / 学长式引导，SHEET 10-09，需求 2.9，h1「对话辅导：
卡在哪一步就聊哪一步」+ chip T0 · 双形态）；② 01 本轮对象（原型 kp-bar 对位）：
对象 chip + 置信度 chip（<60% 走 warning 档）+ 收进侧栏 + 侧栏状态 caption；
③ 02 消息流：气泡三制式 + 停滞出口（原型 stall → Stamp tone=amber）；
④ 03 发送：原型 .composer 顶部细线制式（原 glass-card 玻璃面按原型口径退场，
focus-glow 保留）；⑤ 双栏挂 annos（1180）新档，≤1179 单栏（原 nav: 档换新档）。
接线勾稽：#1 SSE 六事件真流式 —— useChatSend/sse.ts/client.ts 零改动，
 sse.test(20)+client.test(13) 全绿；#2 常驻面板同构 —— 同一套七件套，chatPanel.test(5)
 +dialogStore.test(7) 全绿；#5 守卫 guardPath 原样（router.tsx 未动）。
四态落点：空集合 → 共享件 EmptyState（既有文案，D5）；无空间 → guardPath 重定向
（R19 取证口径）；loading/error —— 见「五、偏差」D-P8.2-1。
测试：apps/web 22 文件 217 用例全绿；tsc apps/web exit 0；冻结区两命令空输出；
6.3 静态纪律四条 + ChatPage 抽查均无匹配。
走查：4 档（1440/1024/768/375）× 双主题共 8 组合重采，逐档「页面级溢出合计 0px」；
目验 1440 浅色截图：单 h1、01/02/03 三节与右侧链路栏（annos 双栏）落位正确。
未完成专项（如实）：(a) 登录态发消息的 SSE 流式实拍与降级链触发截图；
(b) 面板/全屏同构对照截图；(c) 四态探针（tools/probe-chat-states.cjs 未新建）。
原因：本轮输出容量不足，优先保证了「页面视觉 + 三件套 + 8 组合走查 + 单页提交」。

五、偏差与 D 编号裁决留痕
D-P8.1-1（D21 分层落点）：未走第三层兜底，采用第二层（labelLayout.hideOverlap +
 8 字截断）。理由与证据见「三、」。冻结语义零改动：取数 useEffect、守卫顺序、
 点火/重绘/DIM_OPACITY/文字清单键盘语义、poster 链路、文案常量全部原样
 （graphMastery/graphLayout 及其测试零改动，全绿）。
D-P8.2-1（四态 error/loading）：计划 §7 chat 行要求 error → Stamp 红章。
 实现按 3.1c（状态机与 store 冻结）保留既有落点 —— 失败是降级链末端由 useChatSend
 调 store.failAssistant 追加/改写的那条错误气泡（文案含「草稿还在输入框里」），
 未新增页面级红章（新增派生需匹配错误文案，脆弱且要碰 store 语义）。
 loading 同理不适用：本页无取数（对话在全局 store），无 loading 窗口。
 此为与计划的偏差，理由如上；如 reviewer 判定必须补红章，请在下一轮指示。
D-P8.2-2（原型模式 seg 不迁移）：原型「专注/陪伴」seg 由 S.flow.chat.mode 驱动，
 属原型 mock 交互；本工程无对应 store → 按 D5 不迁移（01 节改由既有 meta 驱动）。

六、未完成项与续完入口（D25 五件证据）
未完成：P9.1 /assessment、P9.2 /practice、P9.3 /paper、P9.4 /attribution、
 P10.1-P10.6（/spaces /start /self-report /login /me /drive）、
 P11.1-P11.4（/ /t /t/student/:id /t/recommendations + TeacherShell）、P12.1-P12.4。
状态：以上页面代码一行未动（工作区无这些页的未提交改动），计划勾选保持未勾。
续完入口：先读 01_PLAN「五、」+ 本快照表 + git log 三者对齐，从第一个未完成页
P9.1 /assessment 继续（锚点 PAGES.assess L2107-2213；Layout 登记 '/assessment'）。
本轮已入库提交（旧→新）：03da6ee P8.0 / 087da5d P8.1 代码 / 904ef8f P8.1 走查 /
 e5ee88f P8.2 代码 / 2adb903 P8.2 走查 / 7ae0559 报告记账。

七、全量验证与冻结区状态（本轮实测）
apps/web vitest：22 文件 217 用例全绿（P8.1、P8.2 各一次）。
七件套锚点单跑：sse+client+chatPanel+dialogStore = 4 文件 45 用例全绿。
tsc --noEmit -p apps/web/tsconfig.json：exit 0（P8.1、P8.2 各一次）。
vite build（--outDir /tmp/zhiwei-web-build-p8a）：✓ built in 4.77s；
 echarts 434.35 kB 仍为独立懒加载 chunk（GraphPage 24.17 / index 244.25 /
 react 165.57）；CSS 421.65 kB。
冻结区（工作区口径，P8.1/P8.2 提交前各一次）：
 git diff --name-only HEAD -- router.tsx api/ packages/engine functions data → 空
 git diff --name-only HEAD -- stores/ → 空
区间口径（bf3c7fe..HEAD）终检须在 P12.1 做（本轮未做，如实留痕）。
未在本轮复跑：packages 测试 43 例、functions/api 测试 202 例、packages 与
 functions 两段 tsc —— 本轮未触碰其代码，冻结区命令为空输出旁证；计划 6.1 全套
 须在批次收尾（P9/P10/P11 各批完成时）补跑，本轮未达该批次收尾点。
6.3 静态纪律四条：任意值断点 / z-[ / CDN 字体三条全局均无匹配；
 逐页抽查（GraphPage.tsx、ChatPage.tsx）裸 hex className 与 min-w-[ 均无匹配。

八、D23/D24 执行留痕
D23（空间基数 3）：本轮只读取证，实测账号共 4 个空间 ——
 sp_muf82zhx02br0 初中数学（0 证据，即 D23 记的空空间基线之一）、
 sp_mugfdmcl01qe6 UI 验收·先修薄弱（2 条证据，探针数据态即复用此空间）、
 sp_mv3d1i2g01js2 P6 四态取证空间（0）、sp_mv3d53em02iv2 P6四态1791695333756（0）——
 与 INFO-1/D23「3 个空空间 + 1 个有数据空间，共 4 个」一致，命名与时间戳均指向 P6
 遗留；本轮新建空间 0（探针复用既有空空间）。
D24（PAGE_OWNED_HEAD）：本轮扩表一处 —— Set(['/report','/graph','/chat'])，注释说明
 '/chat' 归页面自有（原型 L2535）；走查目验 1440 档 /chat 单 h1、无外壳通用页头残留。
 其余 13 页待逐页扩表（前缀匹配特例 /t/student/ 在 P11.3 落地）。
—— 第 4 轮执行报告（P8 段）完；P9–P12 未开始，续完入口见「六、」——
