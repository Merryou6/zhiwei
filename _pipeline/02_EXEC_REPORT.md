知微 · 赛前修整轮 2（用户反馈第 5 条）执行报告 —— E1–F4 全批次对账 + F3/F4 实施记录
==================================================================================
编写者：implementer（接续者。上任实现者完成 F2 后因网络故障中断，本人接续 F3 → F4）
编写时间：2026-09-24 18:52 起（写入时点见文末）
仓库 / 分支：/Users/Merryou/LearnBuddy/zhiwei @ tempdeploy（不切分支、不 rebase）
计划依据：_pipeline/01_PLAN.md（第 5 版，**未改动**：md5 = e18ebf4940394473854d1878a10b8f37，
      `git diff 301708c..HEAD -- _pipeline/01_PLAN.md` 无输出）
基线：301708c（轮 2 计划落盘；实测 git rev-list --count HEAD = 75）
现行 HEAD：4b63568（F3）→ 本报告与 F4 一起提交（提交 hash 见文末补记行）
归档：覆写本文件前，旧报告（轮 1 返工版）已先归档为
      _pipeline/archive/02_EXEC_REPORT_20260924_1852.md（225 行；md5 两侧一致 = 22102dbeae8649c0802fc809e07d3890）
环境：Node 22.22.2 / vitest 2.1.1 / 单条命令约 60 秒被 SIGKILL（测试分批跑）/ git diff 一律 --no-pager

0. 本报告为什么是「补课」
-------------------------------------------------
上任实现者在 F2 完成后中断，E1–F2 与 F3 前半段的执行报告**未落盘**（工作区里 02_EXEC_REPORT.md 停在轮 1 返工版）。
按 AGENT.md §8-1「进度判断必须以工作区实物为准，不要依赖回话」，本报告：

  · E1–F2 的对账由本人从 **git 提交记录 + git diff + 实跑测试输出** 重建，凡未亲验的都标出证据来源（commit / 命令输出）；
  · F3、F4 是本人亲手实施（含全部验证命令的实跑）；
  · 任何无法从实物核实的说法一律不写，或显式标注「无法核实」。

1. 批次总览（E1→F4 八子步，全部已提交）
-------------------------------------------------
┌──────┬───────────┬───────────────────────────────────────────────────────────────────────────┐
│ 子步 │ commit    │ 交付（一句话）+ 该步实跑验证                                              │
├──────┼───────────┼───────────────────────────────────────────────────────────────────────────┤
│ E1   │ 7171083   │ 契约 v1.3 冻结：API_CONTRACT §9 追加 phase/thought/tool + ToolName 七项闭集 │
│      │           │ + JSON 降级 trace；后端 SseEvent 联合类型扩展；新增 services/chatTrace.ts  │
│      │           │ 验证：tsc(functions/api) exit 0；chatTrace.test.ts 7 例通过                 │
│ E2   │ d98cc59   │ 本地链路真透出：prepareChat（认证/归属/校验/加载，抛错语义逐字不变）与       │
│      │           │ runChat(prepared, ctx, emit) 拆分；按真实执行序 emit，args/result 全真实    │
│      │           │ 验证：tsc exit 0；chat.test.ts 11→19 例（含「未发生步骤零事件」锚点）       │
│ E3   │ 150b57c   │ 远程真流式：remoteChat stream:true + 去 response_format + parseOpenAiStreamLines│
│      │           │ + 增量抽取器（转义跨块暂存）；半截即断不拼接、零增量干净回落                │
│      │           │ 验证：tsc exit 0；remoteChat.test.ts 15→26 例 + chat.test 集成例            │
│ E4   │ 6f790fe   │ 云函数入口（index.ts）收集 trace 与 JSON 降级同形；closedLoop 1 例断言同步   │
│      │           │ 验证：tsc exit 0；functions/api/tests 全量 169 例通过（14 文件）            │
│ F1   │ 7c13687   │ 前端消费层：types 增 v1.3 类型；sse.ts 三新事件 + 降级 trace 重放；          │
│      │           │ dialog store 增 thought/toolSteps/phase（startAssistant 清空=只留最新轮）； │
│      │           │ chatPanel store 新增                                                       │
│      │           │ 验证：tsc(apps/web) exit 0；sse 13→20 + dialogStore 新增 7 + chatPanel 3   │
│ F2   │ 296cfc6   │ components/chat/ 七件套（useChatSend / ChatMessageList / ChatComposer /     │
│      │           │ ThoughtStream / ToolTimeline / ChatTracePanel / ModelBadge）；ChatPage 瘦身 │
│      │           │ 验证：tsc exit 0；apps/web/tests 全量 131 例通过                            │
│ ——   │ 2b50085   │ （轮 1 审查报告落盘，非轮 2 子步；总控已亲验）                              │
│ F3   │ 4b63568   │ 右侧常驻面板：ChatPanel + Layout 的 ChatPanelDock（≥1280 让位 / <1280 覆盖  │
│      │           │ 抽屉 + 背景幕，z-overlay）+ 顶栏「对话辅导」改 aria-pressed 开合按钮        │
│      │           │ 验证：tsc exit 0；routerGuard 9 + chatPanel 5 + sse 20 = 34 例通过；        │
│      │           │ apps/web/tests 全量 133 例通过                                              │
│ F4   │ 本报告    │ 真浏览器走查（14 张截图 + 几何/对比度/reduced-motion 实测）+ env 复核 +     │
│      │           │ LOOKATME 与本报告；走查发现并修掉本轮组件浅色对比度 3 处不达 AA            │
│      │           │ 验证：三批全量 345 例 + tsc 三段 exit 0 + vite build 通过 + 数据闸门        │
└──────┴───────────┴───────────────────────────────────────────────────────────────────────────┘
提交纪律核对（AGENT §7）：每子步独立 commit、中文信息带关键数字；工作区他人未提交变更
（tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、知微-项目介绍.md）全程未 add / 未改 / 未回退。

2. 计划「六、测试影响总表」逐条对账（更新而非删除/放宽）
-------------------------------------------------
基线实测（命令：git show 301708c:<file> | grep -cE '^\s*it\('，逐文件加总）：
  引擎 43 / 后端 143 / 前端 114 = **300 例 / 26 文件** —— 与计划基线口径一致（可核实）。

2.1 逐条去向与实测计数
  ┌──────────────────────────────┬──────┬─────┬──────┬──────────────┬─────────────────────────────┐
  │ 测试文件                     │ 基线 │ 现 │ 净变 │ 计划预期     │ 实测说明                    │
  ├──────────────────────────────┼──────┼─────┼──────┼──────────────┼─────────────────────────────┤
  │ functions/api/tests/chat     │  11  │ 19  │ +8   │ 11→18（6 改  │ 计划外多 1 例：E2 另加了     │
  │                              │      │     │      │ +7 新增）    │ JSON/SSE 同输入步骤序对账例  │
  │ .../remoteChat               │  15  │ 26  │ +11  │ 15→22（7 改  │ 计划外多 4 例：E3 覆盖更细    │
  │                              │      │     │      │ +7 新增）    │ （含 service 端 running→ok） │
  │ .../chatTrace（新）          │  —   │  7  │ +7   │ ~5           │ 含契约文档 grep 哨兵 1 例    │
  │ .../closedLoop               │   5  │  5  │  0   │ 「20 例，1 例│ 实为 5 例（计划把「路由表  │
  │                              │      │     │      │ 更新」       │ 20 条断言」误写成 20 例）； │
  │                              │      │     │      │              │ 计数不变，1 例改写为 v1.3 序 │
  │ apps/web/tests/sse           │  13  │ 20  │ +7   │ 13→19（+6）  │ 三新事件 + trace 重放 + upsert│
  │ .../dialogStore（新）        │  —   │  7  │ +7   │ ~6           │ trace 状态 6 例 + reset      │
  │ .../chatPanel（新）          │  —   │  5  │ +5   │ ~3           │ F1 建 3 例；F3 追加 2 例（关闭│
  │                              │      │     │      │              │ 后上下文保留 / 与路由无关）   │
  │ .../routerGuard              │   9  │  9  │  0   │ 0（零改动）  │ ✔ ROUTES/navRoutes 未动      │
  │ 其余（bands/themeStore/stages│  —   │  —  │  0   │ 0            │ 全量回归覆盖，未改动         │
  │ /profile/auth/…）            │      │     │      │              │                             │
  ├──────────────────────────────┼──────┼─────┼──────┼──────────────┼─────────────────────────────┤
  │ 分批合计                      │ 300  │ 345 │ +45  │ ≈334（+34）  │ 差异 +11：全部为「新增用例  │
  │ 引擎 43 / 后端 169 / 前端 133 │      │     │      │              │ 比计划更多」，无删除、无放宽 │
  └──────────────────────────────┴──────┴─────┴──────┴──────────────┴─────────────────────────────┘
  说明：计划对 chatTrace/dialogStore/chatPanel 用的是「~5/~6/~3」约数，实跑分别是 7/7/5；
  chat 与 remoteChat 的计划数是硬数字，实测各多 1 例与 4 例（都是**新增**，不是改写占位）。
  唯一「数字口径更正」：closedLoop.test.ts 是 5 例（不是 20 例）——由 git 基线核对得出，
  E4 只改写了其中「真实 SSE 流式通路」1 例的断言，计数前后一致。

2.2 计划点名的回归哨兵（逐条核）
  · chat.test 的 (3) exit 上游回溯 / (4) silent 弱负证据 / (5) dedup 命中 / (9) X-Response-Format json /
    (10) 续聊+403+404 / (11) 400+403+401 —— 六例**内容未改**（E2 的 prepareChat 拆分保住「流开始前
    的错误走普通 JSON 错误体」契约）。核实方式：git diff 301708c..HEAD 只在这些文件里出现新增块，
    原断言行未被删除（本报告第 2.3 节给出删除行计数）。
  · 契约只增不删哨兵（R8）：见 2.3。
  · 「不演」锚点（D4a）：chat.test 的 clarify 轮无 dedup_check/apply_evidence 事件，仍在。
  · 本轮 UI 走查新证据（F4）：真实一轮消息产出 **6 个 tool 步骤**，args/result 全是真实中间量
    （kb_math_cz / node_count 24 / confidence 0.85 / threshold 0.6 / adopted true / ms 0.018–0.386），
    见 _pipeline/screenshots/round2/panel_typewriter_mid_1440_dark.png 与 walkthrough.json。

2.3 计划「八、总验收标准」逐条核（实跑）
  ① 三批测试全绿（分批实跑，非单条全量）：
     $NODE $WS/node_modules/vitest/vitest.mjs run packages            → 2 文件  **43 例通过**
     $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests → 14 文件 **169 例通过**
     $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests      → 13 文件 **133 例通过**
     合计 29 文件 / 345 例 / 0 skip（计划预估 ~334，差异见 2.1）
  ② 三段 tsc --noEmit：engine exit 0 / functions/api exit 0 / apps/web exit 0
  ③ $PY scripts/validate_data.py：6 项阻断校验通过（本轮不碰数据；输出与上轮同结论）
  ④ vite build：通过（3.76s）——index 123.01 kB(gz 39.29) + react 165.48 kB + echarts 434.35 kB
     + index.css 33.26 kB；GraphPage chunk 7.22 kB
  ⑤ 真实走查留痕：见第 4 节（14 张截图 + 几何/对比度/reduced-motion 原始数据）
  ⑥ git --no-pager diff 301708c..HEAD -- API_CONTRACT.md：**+51 行 / -0 行**（删除行计数 0 ⇒ 只增不删）；
     内容为 §9「v1.3 变更」块 + §11 一行
  ⑦ env 复核四条命令输出见第 5 节；模型相关前端入口零新增（grep 见第 7 节）
  ⑧ 红线复核：packages/engine、data、config、scripts、PRD/ALGORITHM/DATA_SCHEMA/参赛方案 v4、
     tailwind.config.js、theme/bands.ts、serialization.ts、两个 env 模板 —— 本轮提交内**全部零改动**
     （命令：git diff --name-only 301708c..HEAD | grep -E '^(packages/engine|data/|config/|scripts/|…)' → 无命中）；
     answer / solution_steps 在新增前端代码中零命中（grep 见第 7 节）

3. F3 实施记录（本人亲手）
-------------------------------------------------
涉及文件（严格按计划清单）：
  A 新增 apps/web/src/components/chat/ChatPanel.tsx
  M apps/web/src/components/Layout.tsx
  M apps/web/src/components/TopNav.tsx
  M apps/web/tests/chatPanel.test.ts（3 → 5 例）
零改动（与计划一致）：App.tsx / router.tsx / routerGuard.test.ts 一行未动。

3.1 面板布局实现方式（计划 D1b 落实）
  · 单一 `fixed` 容器走 `z-overlay`（tailwind 已有令牌，未新写 z 值）：`inset-x-0 bottom-0 top-[56px]`，
    内部顺序 = 背景幕（仅覆盖态）→ 面板本体 `absolute right-0 top-0 bottom-0`，宽 400px / `max-w-[92vw]`。
    面板从顶栏下缘起，不遮 TopNav；Toast(z-toast=60) 仍最上层无障碍。
  · **≥1280（常驻）**：无背景幕；正文外层让出 400px `padding-right` 并带 `transition-[padding]`。
  · **<1280（覆盖）**：半透明背景幕 `bg-canvas/60`（点击关闭）+ 右侧抽屉，正文**完全不动**。
  · 断点判定：`matchMedia('(min-width: 1280px)')` 订阅式 hook（不支持 matchMedia 的环境按窄屏处理，
    即宁可不挤压正文也不冒险）。
  · Esc 关闭：ChatPanel 内 window keydown（清理函数已写）；消息区 `min-h-0 flex-1 overflow-y-auto` 自管滚动，
    输入区 `flex-none` 钉在面板底部。
  · 顶栏：`navRoutes().map` 里对 `path === '/chat'` 特判为 `<button aria-pressed={panel.open}>`，
    其余仍是 `<NavLink>`；ROUTES/navRoutes/guardPath 数据结构零改动（routerGuard 9 例全绿为证）。

3.2 F3 局部验证（实跑）
  tsc --noEmit -p apps/web/tsconfig.json → exit 0
  vitest run routerGuard.test.ts chatPanel.test.ts sse.test.ts → 3 文件 **34 例通过**
  vitest run apps/web/tests → 13 文件 **133 例通过**

4. F4 真实浏览器走查（本人亲手；**未静默跳过**）
-------------------------------------------------
4.1 方法与为什么不走「起服务→curl 探活」的兜底
  计划给了兜底方案（环境做不到就证明服务可用 + 标注未实测）。实际做到了**真浏览器交互**，故按优先方案执行：
  · 本机限制：后台子进程在命令结束时会被收掉 ⇒ 必须把「起后端 + 起前端 + 开浏览器 + 交互 + 截图」放进**同一条命令**；
  · 用一个临时 Node 脚本（不入库，落在 /tmp/zw-walkthrough.cjs）串起来：
    spawn 后端(8787) + vite dev(5173) → 轮询探活 → 真实接口注册(#1)/取空间(#3) 拿真 token+space_id →
    spawn **真实 Chrome 145 headless**（本机沙箱内必须 `--no-sandbox` + 软件渲染，否则 GPU 进程 FATAL）→
    WebSocket 直连 DevTools 协议（CDP）→ 注入 localStorage 登录态（键与前端 store 同源）→
    真实点击顶栏「对话辅导」开面板 → 真实输入消息并点「发送」（真跑 #18 SSE）→
    Emulation.setDeviceMetricsOverride 切四档宽度 + 真点主题开关切两主题 → Page.captureScreenshot 落 PNG。
  · 关于 CDP：本机 Node 22 自带 WebSocket；Chrome 需 `--remote-allow-origins=*`（否则握手被拒，实测复现）。
  · 关于「是否伪造」：所有截图都是真浏览器渲染真页面的结果，消息/推理摘要/工具步骤全部由后端真实产出；
    未注入任何假数据、未人为延时。

4.2 截图清单（14 张，全部入库 _pipeline/screenshots/round2/，附 walkthrough.json 原始量测）
  panel_console_1440_dark / _dark_1024 / _dark_720 / _dark_375          面板展开 × 四档宽度 × 深色
  panel_console_1440_light / _light_1024 / _light_720 / _light_375      同上 × 浅色
  panel_typewriter_mid_1440_dark                                        打字机中途（已揭示 42 / 全文 130 字）
  panel_graph_1440_light / panel_report_1440_light                      R3 关注页（图谱页 / 报告页）面板展开
  chat_full_1440_dark / _720 / _375                                     /chat 全屏两栏 / 窄档堆叠
  walkthrough.json                                                      几何 + 对比度 + reduced-motion 原始数据

4.3 几何量化（读 getBoundingClientRect，非目测）
  ┌───────┬──────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬──────────┐
  │ 视口  │ 外层 padding │ main 宽    │ 正文内容宽 │ 正文右缘   │ 面板左缘   │ 重叠       │ 背景幕   │
  ├───────┼──────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼──────────┤
  │ 1440  │ 400px        │ 1024       │ **976**    │ 1008       │ 1040       │ 否（差 32）│ 无（常驻）│
  │ 1024  │ 0            │ 1024       │ **976**    │ 1000       │ 624        │ 覆盖（设计）│ 有       │
  │ 720   │ 0            │ 720        │ **672**    │ 696        │ 320        │ 覆盖（设计）│ 有       │
  │ 375   │ 0            │ 375        │ **327**    │ 351        │ 30(345 宽) │ 覆盖（设计）│ 有       │
  └───────┴──────────────┴────────────┴────────────┴────────────┴────────────┴────────────┴──────────┘
  读法：常驻态（1440）面板与正文**不重叠**且无死区；覆盖态（<1280）正文宽度与关闭面板时**完全一致**
  （1024/720/375 分别 976/672/327），即「窄屏不挤压正文」这一 D1b 承诺成立。
  另测：面板输入区文本域底边始终在面板底边之上 12px（`overflowPx = -12`，四档宽度 × 两主题共 8 次采样一致）
  ⇒ 输入区无被裁切。
  /chat 全屏：1440 两栏（main 1024，面板已收起）、720 两栏、375 上下堆叠（符合 D5f）。

4.4 对比度实测（含 alpha 合成的 WCAG 对比度，采样自真实渲染的 computed style）
  修前（浅色）→ 修后（浅色）：
    推理摘要标签 11px   3.61 → **5.51**   （`text-ink-soft/80` → `text-ink-soft`）
    工具名/计数器 10px  2.97 → **5.51**   （`text-ink-soft/70` → `text-ink-soft`）
    步骤标签/键值 13・11px 13.14 ~ 13.53（本来达标）；正文 14px 5.17（达标）
    模型徽标「本地规则」11px 3.15（未修，见 D27）
  深色侧（修前 → 修后）：推理摘要 5.57 → **8.01**；工具名 4.57 → **8.01**；其余 7.26 ~ 16.76
  结论：**被采样的这些节点**浅色全部 ≥5.17:1（AA 需 4.5:1）；深色全部 ≥7.26:1。
  ⚠ 措辞更正（清尾轮，审查 L2/L3；原句为「本轮新建组件的浅色小字已**全部** ≥5.17:1」，过宽，留痕在此）：
    该结论只对本次采样清单里的节点成立 —— 清单里**没有**折叠条「进行中」（它只在流式成立的
    ~100ms 窗口内存在，250ms 采样必然错过），新建组件内也仍有 `text-accent` 小字。
    清尾轮已把「进行中」（浅色实测 3.57:1 → 5.51:1）与 ChatPage「收进侧栏」提示行
    （3.45:1 → 5.17:1）一并修掉，实测值见文末「清尾轮」节；全站仍存的已知例外只剩
    ModelBadge 的 accent-on-accent-veil 3.15:1（D27，与顶栏 active tab 同款既有配对，声明不修）。

4.5 reduced-motion 实测（打字机降级是否真生效）
  同一时刻（发送后 250ms）读「思考流已揭示字数」：
    prefers-reduced-motion: reduce          → 匹配 true，已揭示 **135 字**，本轮全文 **135 字**（= 全文，无动画）
    prefers-reduced-motion: no-preference  → 匹配 false，已揭示 **20 字**，全文 135 字（打字机逐字揭示中）
  ⇒ 二者对照证明：reduce 下打字机确实被降级为全文直出，非「看起来像」。

4.6 走查发现与处置
  (1) 【已修】≥1280 常驻态正文被过度挤压：计划原写「main 加 padding-right = 面板宽」，但 max-w-5xl
      = 64rem = **1024px**（不是计划里写的 1280px），padding 落在 main 盒内时 1440 下正文只剩 600px，
      且与面板之间留下 208px 死区（实测首轮走查截图可见 3 列卡片被挤到换行）。改为把让位 padding 放到
      **外层包装**，main 的 max-width 作用在「面板左边的可用宽度」上 → 正文 976px、无死区。见 D24。
  (2) 【已修】本轮组件浅色主题 3 处小字不达 AA（2.97 / 3.61:1），已按 4.4 修正。见 D26。
  (3) 【已修】面板头部关闭键与覆盖态背景幕共用同一可访问名「关闭对话面板」→ 读屏歧义，
      背景幕改为「点击空白处关闭对话面板」。见 D25。
  (4) 【未修·既有】模型徽标浅色 3.15:1：`text-accent` 落在 `bg-accent-veil` 上，是**全站既有**配对
      （顶栏 active tab 同款），且浅色 accent = primary #4E8FB0 在白底上先天只有 3.57:1 —— 修它等于
      动全站强调色口径（冻结的 bands/主色语义），超出本轮范围，记录不修。见 D27。
  (5) 【未实测·有据】ToolTimeline 的 `running` 态截图：契约规定 running 只在**远程真流**出现
      （本地模式毫秒级完成，从不发 running），本机无 `ZHIWEI_LLM_*` 真值也无外部网络调用授权，
      故**未实测**。静态兜底：ToolTimeline.tsx 的 running 分支 = SVG 旋转环 + `animate-spin`（text-accent），
      且 index.css 的 `@media (prefers-reduced-motion: reduce)` 会把动画时长压到 0.01ms（不转但图标仍在）。
      `error` 态同理（仅远程适配器失败时出现）未实测。
  (6) 【未覆盖·声明】仅以 1440 一档呈现了「面板展开下的图谱页/报告页」（R3 关注页）；未做 1024/720/375
      的风险页截图（时间预算：单命令 60s 硬限制，一次完整走查约 55s）。
  (7) 【声明】面板头部的模型徽标在远程模式下会显示模型名（`ZHIWEI_LLM_MODEL`）——本轮只跑本地模式，
      远程形态未走查（无 key）。
  (8) 【观察·非产品缺陷】走查往返中曾出现一次「风险页截图前面板处于关闭态」；为此专门做了两次独立验证
      （同一 harness 加探针重跑 + 独立微测试脚本 /tmp/zw-persistence.cjs）：在 `#/console → #/graph →
      #/report → #/me` 连续切换下，面板恒为展开（`aria-pressed=true`），375 与 1440 两档各验一次，
      关闭/主题切换均正常 ⇒ **面板跨路由保持展开的产品行为正确**（D1a 达成），该现象属走查脚本自身状态问题，
      已改用「切换宽度后再导航」的稳定顺序重取证据。
  (9) 【观察·既有】375 宽度下顶栏 6 项导航换行拥挤（本轮之前即如此，非 F3 引入），未修，列为遗留。

5. env 复核（RD7，结果原样贴）
-------------------------------------------------
  $ git check-ignore -v .env deploy/zhiwei.env
    .gitignore:17:.env	            .env
    .gitignore:22:deploy/*.env	    deploy/zhiwei.env        → 两条均命中 ✔
  $ git check-ignore -v .env.example deploy/zhiwei.env.example
    （无输出）exit=1                                          → 两模板均不命中 ✔
  $ git ls-files | grep -iE '(^|/)\.env|\.env$'
    .env.example                                              → ⚠ 口径更正
      说明：计划预期「仅两模板」，但该正则只匹配路径段恰为 `.env` 或结尾为 `.env` 的名字，
      而 `deploy/zhiwei.env.example` 两者都不匹配 ⇒ 它天然不会出现在结果里。
      改用 `git ls-files | grep -i env` 实测得：`.env.example` 与 `deploy/zhiwei.env.example` 两条，
      真值文件（`.env` / `deploy/zhiwei.env`）**零条目** ✔
  $ git --no-pager diff --stat .env.example deploy/zhiwei.env.example
    （无输出）                                                → 本轮两模板零改动 ✔
  $ 变量集核对：两模板的模型相关 5 个变量完全一致
    ZHIWEI_MODEL_MODE / ZHIWEI_LLM_BASE_URL / ZHIWEI_LLM_API_KEY / ZHIWEI_LLM_MODEL / ZHIWEI_LLM_TIMEOUT_MS
    deploy 模板另含 3 个**部署专用**键（ZHIWEI_SERVER_SECRET / ZHIWEI_HOST_PORT / ZHIWEI_DB）——设计如此，
    非「模板错位」（更正计划「两模板变量集一致」的措辞：一致的是模型相关变量集）
  $ .gitignore 相关行：17 `.env` / 18 `.env.*` / 19 `!.env.example` / 22 `deploy/*.env` / 23 `!deploy/*.env.example`
  结论：模型配置仍只在服务端 env（前端零新增读取面，见第 7 节），真值未入库。

6. F4 交付物与提交
-------------------------------------------------
  · 走查证据：_pipeline/screenshots/round2/（14 PNG + walkthrough.json，约 4.2 MB）
  · 文档：LOOKATME.md（轮 2 进度、实测数字 345 例 / 29 文件、构建体积、走查结论、逐项落点）
  · 本文件：_pipeline/02_EXEC_REPORT.md（旧报告先归档再覆写）
  · 代码（走查后修正，均为计划 F3/F4 范围内的文件）：
      apps/web/src/components/Layout.tsx            让位 padding 移到外层包装 + 背景幕可访问名
      apps/web/src/components/chat/ChatTracePanel.tsx / ToolTimeline.tsx /
        ChatMessageList.tsx / ChatComposer.tsx / ModelBadge.tsx   小字去掉半透明降级（对比度）
  · 提交信息会写明：走查结论 + 对比度实测数字 + 面板几何实测数字。

7. 偏差清单（续写；轮 1 已用到 D21，故本轮续编 D22+）
-------------------------------------------------
  编号口径说明：计划要求「计划外裁决按 D 编号续写 D14+」。轮 2 的 E1–F2 段执行报告缺失，
  本人无法确认上任实现者是否曾用掉 D22…… 为避免覆盖他人编号，明确声明：**D22–D27 由本次 F3/F4 使用**，
  如后续发现轮 2 前半段另有编号，以本节为准并请 reviewer 指出。

  D22 面板「全屏打开」时一并收起面板（计划未写）
      理由：/chat 全屏页与常驻面板共存会让正文列被挤压且出现两个对话区；与全屏页「收进侧栏」
      （打开面板 + 回控制台）互为反向操作。依据 RD1「两形态共用一套视图」的意图。
  D23 顶栏 /chat 特判的路径常量写在 TopNav 内（`const CHAT_PATH = '/chat'`）
      理由：router.tsx 未导出 CHAT_PATH，而计划要求 router 零改动 ⇒ 在渲染层写常量并注释与 ROUTES 同值。
  D24 ≥1280 让位方式：padding 放外层包装而非 main 自身（**与计划字面不同**）
      计划原文：「main 容器 padding-right = 面板宽」「正文列仍有 ≥880px（1280-400）」。
      实测：max-w-5xl = 1024px，padding 落在 main 盒内时 1440 下正文仅 600px 且与面板间有 208px 死区。
      裁决：padding 移到 main 外层包装（仍 `transition-[padding]`），实测正文 976px（1440）、832px（1280），
      无死区、无重叠。**这是计划数字前提有误导致的实现差异，非范围扩大**（只改 Layout.tsx 一个文件）。
  D25 覆盖态背景幕的 aria-label 改为「点击空白处关闭对话面板」
      理由：与面板头部关闭键同名会造成读屏歧义（走查发现）。
  D26 本轮组件小字去掉半透明降级（`text-ink-soft/70`、`/80` → 纯 `text-ink-soft`）
      理由：浅色主题实测 2.97:1 / 3.61:1，不达 WCAG AA（4.5:1）；改后 5.51:1。
      范围：ChatTracePanel / ToolTimeline / ChatMessageList / ChatComposer / ModelBadge 五个**本轮新建文件**的
      类名替换，零行为变化、零测试影响（无测试断言类名）。
  D27 不修模型徽标浅色 3.15:1（`text-accent` on `bg-accent-veil`）
      理由：该配对是全站既有强调色用法（顶栏 active tab 同款），且浅色 accent=primary #4E8FB0 在白底先天 3.57:1；
      修它等于改全站强调色口径（涉及守恒区语义）。**记录为遗留，交由总控决定**。
  D28 走查证据落在 _pipeline/screenshots/round2/（计划未列目录）
      理由：计划 F4 的 commit 草案写明「走查截图/结论随执行报告入库」，但未给目录；
      选 _pipeline 下新建一个只增不删的证据目录，避免塞进 apps/web 或仓库根。
  D29 走查脚本不入库（临时在 /tmp/zw-walkthrough.cjs）
      理由：不新增任何计划外代码文件；脚本要点已在本报告 4.1 逐条写清，量测原始数据以 walkthrough.json 入库。

8. 未完成项 / 未验证项（如实列，不隐藏）
-------------------------------------------------
  1) ToolTimeline `running` 与 `error` 两态的**真实截图**未得（原因见 4.6(5)：本地模式按契约不产生 running，
     远程模式无 key/无网络授权）。替代证据：源码分支 + index.css 的 reduced-motion 降级规则（已 grep 贴出）。
  2) 远程模型真流式的**真实网络**链路未实测（E3 仅单测覆盖：ReadableStream mock + 增量抽取 + 半截失败/零增量回落；
     无 `ZHIWEI_LLM_*` 真值 ⇒ 不做假测）。
  3) R3 风险页只有 1440 一档截图（4.6(6)）。
  4) 面板与 /chat 全屏页**同时**打开的形态未走查（当前设计是「进全屏即收面板」，故该形态不可达——D22）。
  5) 数据闸门、题库复算按「本轮不碰数据」执行，只跑 validate_data.py；verify_items.py 未跑（无需）。
  6) 轮 2 前半段（E1–F2）的**原始**实施记录无法复原（上任实现者未落盘），本报告只做**物证重建**：
     提交记录、diff 统计、实跑测试数为其全部依据；未写任何「据称做过」的内容。

9. 红线复核（本轮全量）
-------------------------------------------------
  · answer / solution_steps 不下发：新增前端代码（components/chat/**、api/sse.ts、stores/dialog.ts）grep 零命中；
    新增事件字段只装 D4a 列出的真实中间量（不含题库答案字段）。
  · 参数零硬编码：本轮未动 config/params.json、未新增算法常量（面板宽度 400 / 断点 1280 是布局尺寸，
    以具名常量 PANEL_WIDTH_PX、DOCK_MIN_WIDTH_PX、TOPNAV_HEIGHT_PX 集中定义并注释）。
  · 前端引用引擎常量：本轮新增组件未引用引擎常量；既有 theme/bands.ts 仍从 statusBand **源模块**导入（未动）。
  · SSE JSON 降级未坏：sse.test.ts 20 例（含降级链）全绿；chatTrace 的契约哨兵例在跑。
  · 状态带/配色唯一来源：未动 theme/bands.ts 与 tailwind.config.js；新组件只用语义令牌
    （静态兜底 grep：components/chat 与 Layout/TopNav 内无 `bg-[#…]` / `text-[#…]` 实际用法，命中的两处是注释文本）。
  · z 值：只用 z-overlay 令牌（grep 无 `z-[…]` 实际用法）。
  · 未提交他人变更：tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、知微-项目介绍.md 全程未动。

10. 给 reviewer 的核对清单
-------------------------------------------------
  a) 测试只改写不删除：git diff 301708c..HEAD -- '*test.ts' 抽查 chat/remoteChat/closedLoop/sse 的删除行
     是否只落在「被改写的那几例」（计划六、总表逐条对应）。
  b) 契约只增不删：git diff 301708c..HEAD -- API_CONTRACT.md 应为 51 插入 0 删除。
  c) 面板几何：_pipeline/screenshots/round2/walkthrough.json 的 geometry 段（contentWidth/contentRightEdge/panelRect）。
  d) 对比度：同文件 contrast 段（light/dark × 9 个文本节点）+ 4.4 的修前/修后对照。
  e) reduced-motion：同文件 reducedMotion 段（reduce 直接全文、no-preference 逐字）。
  f) 「不演」：chat.test.ts 的 clarify 轮无 dedup_check/apply_evidence 事件；截图里 6 步 args/result 全真实。
  g) D24 的合理性：可直接读 Layout.tsx 的注释块（文件头）+ 本报告 4.6(1)。

—— 本报告所引用的每条命令输出，均为本次会话实跑所得；未跑的命令不写结果。

补记：F4 = **本报告所在的那次提交**（定位：`git log --oneline -1 -- _pipeline/02_EXEC_REPORT.md` 或 HEAD；
      报告内容本身参与该提交的 hash，故此处不写死自身 hash）；F3 commit = **4b63568**。
      轮 2 八子步 commit 依次为：
      7171083(E1) / d98cc59(E2) / 150b57c(E3) / 6f790fe(E4) / 7c13687(F1) / 296cfc6(F2) / 4b63568(F3) / F4=本提交。
      提交后实测：git rev-list --count HEAD = 84（--no-merges = 80），与 LOOKATME 口径一致。

================================================================================
11. 清尾轮（审查 L2/L3/L4/L8/L9/L11 中「用户看得见的 4 条」）—— 2026-09-24 追加
================================================================================
追加者：implementer（清尾轮；本文件为**追加**，未覆写旧内容——除 §4.4 那一句结论按审查要求
       就地收紧并在旁保留原句留痕，见下 11.6）
输入依据：_pipeline/03_REVIEW.md（末行 VERDICT: PASS），问题清单 L2 / L3 / L4 / L8 / L9 / L11
本轮起点：HEAD 9b24d46（实测 git rev-list --count HEAD = 85，--no-merges = 81）
本轮范围：只做这 4 件事；未碰 packages/engine/**、data/**、config/params.json、scripts/**、
        5 份冻结文档（API_CONTRACT.md 一字未动）、theme/bands.ts、tailwind.config.js；
        未碰他人未提交变更（tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、知微-项目介绍.md）
提交：18f348f（L11）/ b229a13（L2+L4）/ 本次文档提交（L8+L9）

11.1 L11 —— 顶栏与正文列共用同一条左基线（本轮最重）
  现象（修前实测，真实 Chrome 145 headless + CDP，1440，deviceScaleFactor 2）：
    收起态：顶栏内容左缘 232 = 正文列左缘 232（差 0）✔
    展开态：顶栏内容左缘 **232** vs 正文列左缘 **32**（差 **200px**）✘ —— 顶栏仍按整宽居中
  实现（不做第二份 400px 常量）：新增 apps/web/src/components/panelDock.ts 作单一来源 ——
    · 写入侧（只有 Layout 调）dockOffsetVarStyle(px) → CSS 自定义属性 --panel-dock-offset
      挂在外壳根节点，值就是 Layout 里唯一的 PANEL_WIDTH_PX（面板关 / <1280 覆盖态 = 0px）；
    · 读取侧 DOCK_OFFSET_STYLE = { paddingRight: 'var(--panel-dock-offset, 0px)' }，
      TopNav 的 header 与正文列外层各读同一个变量 → 恒同值、同一份 transition-[padding]；
    · padding 落在 header 上（不是取代其整宽背景），故顶栏底色与下边框仍是整宽；
      面板自 y=56 起，不与顶栏重叠（顶栏内容右缘 1032 < 面板左缘 1040）。
  修后实测（1440，getBoundingClientRect().left，内容盒左缘）：
    收起态：顶栏 232 / 正文 232 → 差 **0px**（header 计算样式 padding-right = 0px）
    展开态：顶栏 32  / 正文 32  → 差 **0px**（header 计算样式 padding-right = 400px）
    深浅两主题各测一次，数值一致；1440 展开态面板左缘仍 1040，正文列宽仍 976（不与面板重叠）
  证据截图（入库 _pipeline/screenshots/round2/，两态 × 两主题 4 张，名称可区分）：
    align_1440_closed_dark.png / align_1440_closed_light.png / align_1440_open_dark.png / align_1440_open_light.png
  · 窄档复测（提交后补做，见 11.7）：**1024 / 720 / 375 三档 × 开合两态，左基线差实测亦为 0px**；
    <1280 覆盖态 header padding-right = 0px、正文宽 976 / 672 / 327、面板左缘 624 / 320 / 30（宽 345）
    —— 与 F4 修前实测逐项相同，覆盖态零回归。
  ⚠ 未实测项：窄档只做了几何量化（见 11.7），**未重拍那三档的左基线截图**（截图以 1440 两态 × 两主题为准）。

11.2 L2 —— 两处浅色小字补达 AA（都实测过，修前修后都有数）
  测法：真实渲染的 computed style（color 含 alpha）+ 逐层背景合成 → WCAG 相对亮度公式实算。
  ① components/chat/ChatTracePanel.tsx 折叠条「进行中」11px
     修前：class `text-accent`，实测 color rgb(78,143,176) on rgb(255,255,255) → **3.57:1**（不达 AA 4.5:1）
     修后：class `text-ink-soft`，实测 color rgb(91,107,118) on rgb(255,255,255) → **5.51:1** ✔
     说明：强调色只留在左侧会呼吸的圆点（bg-accent，非文本装饰；浅色 3.57:1 ≥ 非文本 3:1 要求）。
     为什么之前漏掉：它只在流式成立的 ~100ms 窗口内存在（本地一轮 SSE 在 250ms 前就结束），
     F4 的 250ms 采样必然错过 —— 本轮改用页内 MutationObserver + 10ms 轮询抓「出现的第一帧」才采到。
  ② apps/web/src/pages/ChatPage.tsx 「收进侧栏」提示行 11px
     修前：class `text-ink-soft/80`，实测 rgba(91,107,118,0.8) 合成于 rgb(245,248,249) → **3.45:1**
     （注：审查者给出的同一配对数 3.61:1，差异来自底色取 bg-surface #FFF 还是 bg-canvas #F5F8F9，
      两者都 < 4.5；此处的页面底色是 canvas，故本报告采用 3.45）
     修后：class `text-ink-soft`，实测 rgb(91,107,118) on rgb(245,248,249) → **5.17:1** ✔
  零新增 hex：只做令牌替换；theme/bands.ts 与 tailwind.config.js 守恒区零改动（不在 diff 名单）。
  未实测项：未逐一提测组件内其余文本节点（沿用 F4 的 9 节点采样 + 本轮补测的 2 处）；
    全站仍存的已知例外只有 ModelBadge accent-on-accent-veil 3.15:1（D27 声明不修，本轮未动）。

11.3 L4 —— 工具卡的原始浮点只在显示层收敛
  现象（修前实测原文抓取）：apply_evidence 卡片 `after` 一栏显示 **0.009000000000000001**，
    而同轮推理摘要写的是「0.01」——同一份数据在一屏里长出两个样子。
  做法：apps/web/src/lib/format.ts 新增纯函数 `metric(value, digits = 3)`：最多 3 位小数、去掉尾随 0；
    极小非零值（四舍五入会变成 '0'）退回 3 位有效数字，宁可难看也不写失真；非有限值 → '—'。
    ToolTimeline 的 args/result 值（formatValue 的数字分支）与 ms 显示改走它。
  ⚠ 只改显示：tool.result / tool.ms 的**真实值一字未动**（契约 §9 的字段语义是真实中间量 / 真实耗时）；
    metric 是纯函数，不回写任何 store / 事件。ms 侧本来就是服务端 `Math.round(x*1000)/1000` 三位小数，
    经 metric 显示结果不变（仅统一了口径）。
  修后实测（同一轮真实链路，原文抓取工具卡键值）：`before 0` / `after **0.009**` / `event_id evt_…`；
    ms 显示 0.017 / 0.89 / 0.021 / 2.043 / 11.17 / 0.013（全为服务端真实值）。
  新增测试：apps/web/tests/format.test.ts 6 例（浮点噪声、整数不补小数点、尾随 0、超 3 位四舍五入、
    极小非零值不失真、非有限值降级、纯函数性）→ 前端用例 133 → **139**。

11.4 L8 / L9 —— 文档数字与措辞按实测改正
  LOOKATME.md（非冻结文档）：
    · 提交数：原「累计 84 次提交（E1–F4 八子步 +9；非合并 80）」→ 实测改为「88 次」（口径与算式写全：
      轮 2 起点 301708c = 75，E1–F4 八子步 + 轮 1 报告落盘 2b50085 + 断句修复 9b24d46 共 +10 = 85，
      清尾轮 3 次 = 88；非合并 84）。
      实测命令：git --no-pager rev-list --count HEAD（85 → 清尾后 88）/ --no-merges（81 → 84）。
      ⚠ 随后清尾轮又补了一次「窄档复测留痕」提交（见 12 节），LOOKATME 的同两处数字随之改为
        **89 / 85（清尾轮 4 次）**并再次按实测核对 —— 故以 HEAD 时的 LOOKATME 为准（89），此处 88 为中间态。
    · ChatPage 行数：原「由 298 行瘦身为布局壳」（298 是 diff 改动行数口径）→ 改为实测
      「由 **286 行**（git show 301708c:apps/web/src/pages/ChatPage.tsx | wc -l）瘦身为布局壳（清尾轮后 125 行）」。
    · 补记 9b24d46（推理摘要断句修复）与 79675f6（F4），并注明 F4 的 14 张截图拍于 9b24d46 之前
      （截图里的推理摘要仍是补「。」之前的旧文案；差异仅句末标点，未重拍，故本轮 4 张新截图 + 此说明）。
    · 措辞收紧：原「本轮组件浅色小字已修 3 处」→ 明确「这 3 处是**被采样的那几处**；采样清单未含
      「进行中」，该处与 ChatPage 提示行由清尾轮补修」，并列出全站唯一已知例外（ModelBadge 3.15:1，D27）。
    · 同批按实测更新：测试 345 → **351 例**（29 → 30 文件，前端 133 → 139）、走查截图 14 → **18 张**
      （+ 清尾轮开合两态 × 两主题）、补左基线实测数值、进度快照里轮 2 的审查列由「待审查」改为「PASS（11 条 L/INFO，无 H/M）」。
  02_EXEC_REPORT.md §4.4：结论句就地收紧（保留原句留痕），见 11.6。

11.5 本轮验证命令与结果（逐条实跑）
  1) tsc --noEmit -p apps/web/tsconfig.json                     → exit 0
  2) vitest run apps/web/tests                                  → 14 文件 **139 例全绿**（133 + 新增 6）
  3) vitest run functions/api/tests（第 1 次）                    → **7 例失败**：全部是
     `Error: ENOTEMPTY: directory not empty, rmdir '/var/folders/…/T/zhiwei-db-XXXX'`
     （测试收尾删临时库目录时的文件系统竞态，无一条是断言失败；本轮只改 apps/web，后端零改动）
  4) vitest run functions/api/tests（第 2 次，同一条命令原样重跑）  → 14 文件 **169 例全绿**
     判定：3) 属本机沙箱的临时目录清理抖动（同一命令重跑即绿），不是本轮引入，也未被隐藏；
     如实记录两次结果供 reviewer 复核。后续若复现，建议核查各测试的 afterAll 清理是否对并行文件敏感。
  5) 真实浏览器走查（Chrome headless + CDP，同一条命令内「起后端 + 起 vite → 探活 → 测量/截图 → 杀」）：
     - 修前基线：折线左缘 232/232（收起）、232 vs 32（展开）；「进行中」3.57:1；提示行 3.45:1；
       apply_evidence.after 显示 0.009000000000000001
     - 修后：232/232 与 32/32（差均 0px）、5.51:1、5.17:1、0.009 —— 见 11.1–11.3
  6) 截图入库：_pipeline/screenshots/round2/align_1440_{closed,open}_{dark,light}.png（4 张，只增不删）

11.6 与计划的偏差 / 需要总控知道的取舍
  a) 新增了 1 个源文件 apps/web/src/components/panelDock.ts：这是 L11「单一来源」要求的落点
     （审查建议原文即「让顶栏 nav 容器复用同一个让位值/变量」），不是顺手重构；未改动任何既有常量。
  b) 新增了 1 个测试文件 apps/web/tests/format.test.ts：L4 要求「没有合适的就加纯函数并补测试」，
     故补 6 例；这使项目用例总数由 345 → 351、测试文件 29 → 30，LOOKATME 已同步。
  c) 02_EXEC_REPORT.md 是本轮唯一「就地改」而非纯追加的地方：§4.4 那句过宽结论按审查 L3 要求收紧，
     原句以「原句为…」形式保留在同一段内（未删旧内容、未覆写全文），并在 11.2/11.6 交叉引用。
  d) LOOKATME 额外同步了「进度快照」里轮 2 的审查结论（原「待审查（轮 2 审查报告未出）」实际已出 PASS）
     与测试/截图计数 —— 属同一类「文档数字与事实不符」，一并改准，未做任何其它改写。
  e) 未做（不在本轮范围，明确留给后续）：L1（hint 阶梯 2 硬编码）、L3（D 编号两系列）、L5（云函数入口无测试）、
     L6（SSE 半截即断无集成测试）、L7（远程回落无 trace 标记）、INFO-1/2/3；

—— 本节所引用的每条命令输出与每个截图，均为本轮会话实跑所得；未实测项已在 11.1/11.2 明确标注。

================================================================================
12. 11.1 的窄档复测（补充实测，提交后补做）—— 2026-09-24
================================================================================
为什么补：11.1 原写「除 1440 外未重拍」，但 L11 改的是**顶栏 + 正文列共用的容器层**，
窄档（<1280 覆盖态）是否被带坏必须实测，不能只靠「变量恒 0px」的推理。故提交后补跑一次
真实浏览器几何量化（同一调用内「起后端 + 起 vite → 探活 → 8 次采样 → 杀」，无截图）。

命令：node /tmp/zw-narrow-check.cjs   （临时脚本，不入库；Chrome 145 headless + CDP，
      deviceScaleFactor 1，reduced-motion: reduce 以消掉过渡）

实测（内容盒左缘 getBoundingClientRect().left；diff = |顶栏内容左缘 − 正文列左缘|）：
  ┌──────┬────────┬────────────────┬──────────────┬──────────┬──────────┬──────────────┬────────┐
  │ 视口 │ 面板   │ 顶栏内容左缘   │ 正文列左缘   │ diff     │ 正文宽   │ header pad-R │ 背景幕 │
  ├──────┼────────┼────────────────┼──────────────┼──────────┼──────────┼──────────────┼────────┤
  │ 1440 │ 收起   │ 232            │ 232          │ **0**    │ 976      │ 0px          │ 无     │
  │ 1024 │ 收起   │ 24             │ 24           │ **0**    │ 976      │ 0px          │ 无     │
  │ 720  │ 收起   │ 24             │ 24           │ **0**    │ 672      │ 0px          │ 无     │
  │ 375  │ 收起   │ 24             │ 24           │ **0**    │ 327      │ 0px          │ 无     │
  │ 1440 │ 展开   │ 32             │ 32           │ **0**    │ 976      │ 400px        │ 无     │
  │ 1024 │ 展开   │ 24             │ 24           │ **0**    │ 976      │ 0px          │ 有     │
  │ 720  │ 展开   │ 24             │ 24           │ **0**    │ 672      │ 0px          │ 有     │
  │ 375  │ 展开   │ 24             │ 24           │ **0**    │ 327      │ 0px          │ 有     │
  └──────┴────────┴────────────────┴──────────────┴──────────┴──────────┴──────────────┴────────┘
  8/8 采样 diff = 0px；面板左缘/宽度（展开态）：1440 → 1040/400（常驻，无背景幕）、
  1024 → 624/400、720 → 320/400、375 → 30/345（覆盖式 + 背景幕）。

结论：① 左基线不变量在四档宽度、开合两态下**全部成立**（不只 1440）；
      ② <1280 覆盖态**零回归** —— 正文宽 976/672/327 与 F4 修前实测值逐项相同，
      header padding-right = 0px、背景幕与面板几何（624/320/30、345 宽）也与 F4 一致；
      ③ 1440 展开态 header 吃到 400px 让位、面板左缘仍 1040，两者不重叠（顶栏内容右缘 1032）。

未实测项：窄档只有几何量化，未出截图（截图证据仍为 11.1 的 1440 两态 × 两主题 4 张）。
本节的数字为提交后补跑所得，代码与 18f348f 一致（此后仅文档提交，未改代码）。
