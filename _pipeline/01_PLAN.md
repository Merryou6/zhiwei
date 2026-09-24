知微 · 用户反馈第 5 条（对话链路透出 + 右侧常驻面板）实施计划
=================================================
计划编号：01_PLAN（第 5 版，赛前修整轮 2：对话链路，最后一条用户反馈）
编写日期：2026-09-24 17:33
编写角色：planner（只读规划，implementer 严格照办；执行歧义按本计划「二、决策记录」裁决）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD = 20051db（分支 tempdeploy，rev-list --count HEAD = 74；测试 300 例全绿 / 26 文件，
      tsc 三段 exit 0）。工作区他人未提交变更：M _pipeline/03_REVIEW.md、M tools/e2e-smoke.cjs、
      ?? _pipeline/PR-tempdeploy.md、?? _pipeline/archive/03_REVIEW_20260924_1711.md、
      ?? 知微-项目介绍.md —— 本计划不碰、不提交、不回退它们（D13）。
归档：旧计划已先复制归档为 _pipeline/archive/01_PLAN_20260924_1729.md（md5 一致
      8d939b8654a1b2ed57dc147030cbeac0，归档只增不删），然后才覆写本文件。
权威依据：API_CONTRACT.md（冻结，本项目方已同意以 §9 追加 + §11 留痕方式演进，见 D2）
      > ALGORITHM.md §5（退出通道状态机）> DATA_SCHEMA.md > PRD.md > 方案 v4。
提问纪律：总控已声明优先自行裁决 + 决策记录留痕。本轮方向已由总控以 RD1–RD7 定死，
      细节歧义全部在「二」留 D 编号决策记录；无阻塞项。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/LearnBuddy/binaries/node/workspace
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL：测试一律分批跑；git diff 一律加 --no-pager；
    起前后端做端到端只能在同一调用内「起→探→杀」；需等待用 node 忙等。

-------------------------------------------------
一、目标与范围
-------------------------------------------------
1.1 用户原话（第 5 条，最后一条）：
  「对话辅导的思维链、调用的工具链之类的要整的写炫酷一点，流式传输」。
  此前已确认的取舍：对话做成**右侧常驻面板**（不替换顶栏导航）；链路**后端真实透出**
  （不是前端拿现有 meta 演示）；模型**默认提供一个、不支持自定义**（配置只在服务端 env）。
1.2 总控已定方向（RD1–RD7，本计划落实为 D1–D7 并给理由与依据）：
  RD1 形态：右侧常驻面板 + 顶栏按钮 + /chat 全屏保留 + 面板/全屏共用视图组件。
  RD2 事件契约：SSE 新增 thought / tool / phase 三类过程事件，delta / meta / done / error
      语义不变；JSON 降级响应体同携 trace（详见「三、」字段表，F 批照此实现）。
  RD3 远程模型真流式：stream: true + 结构化 JSON 固定字段序（thought → reply → progress →
      progress_reason → kp_match → top_candidates）+ 服务端增量抽取 thought / reply。
  RD4 本地模式真实链路：按 runChat 真实执行顺序产出事件，tool.args/result 填真实中间量，
      严禁编造没有发生的步骤（边界定义见 D4）。
  RD5 可视化：思考流打字机 + 工具链竖向时间轴 + 状态指示 + 步骤计数/阶段进度；语义令牌、
      双主题、prefers-reduced-motion、窄屏、面板不挤压正文到不可读。
  RD6 模型只读展示：数据源 = #20 GET /api/user/profile 的 model 字段，文案明示
      「由服务端配置，不可自定义」；不新增任何切换/自定义 UI。
  RD7 环境变量复核：模型配置只在服务端、两 env 模板对齐、真值不入库（轮 1 已做，
      本轮只复核并在执行报告留痕）。
1.3 批次划分（每批可独立提交、独立回滚；E 必须先落地并冻结契约，F 才能开工，见 D8）：
  E 批（后端链路透出）：
    E1 契约 v1.3 冻结（文档 + 后端类型 + trace 模块骨架）
    E2 本地模式真实链路（services/chat.ts 拆分重构 + 事件产出）
    E3 远程模型真流式（models/remoteChat.ts stream:true + 增量抽取）
    E4 云函数入口对齐 + 后端全量回归
  F 批（前端面板 + 可视化，消费 E 冻结的契约）：
    F1 前端消费层（types / sse.ts / dialog store 追加 trace 状态 / chatPanel store）
    F2 共享对话视图组件（消息流 / 输入区 / 思考流 / 工具时间轴）+ ChatPage 瘦身复用
    F3 右侧常驻面板挂 Layout + 顶栏按钮改造
    F4 视觉走查（双主题 × 四档宽度）+ env 复核 + 文档收尾
1.4 现状核对（planner 编写本计划时实测读取代码所得）：
  - services/chat.ts：runChat() 整轮算完后 toSseStream() 一次性吐 delta(1–3) → meta → done，
    无真实流式过程；chat() 先 await runChat 再决定 JSON/SSE，故 401/403/400/404 均在
    流开始前以普通 JSON 错误体返回（chat.test.ts 第 9/11 例依赖此行为，E2 必须保住）。
  - functions/api/src/router.ts:36-39 SseEvent 的 event 联合类型只有
    'delta' | 'meta' | 'done' | 'error' —— E1 需扩展。
  - functions/api/src/index.ts:106-117（云函数入口）把生成器缓冲成
    { reply, meta } JSON —— E4 需同步收集 trace，保证与 SSE/JSON 降级三路同形。
  - models/remoteChat.ts：stream:false + response_format json_object（400 时去参重试一次）；
    任何失败回落 localChat（E3 将改掉 response_format 重试语义，见测试总表）。
  - apps/web/src/api/sse.ts dispatchSseMessage：default 分支忽略未知事件（向前兼容已具备，
    有 sse.test.ts 用例锁定）；降级链三段式不变。
  - apps/web/src/stores/dialog.ts：全局 zustand store（不挂组件），跨路由天然存活
    —— 面板跨页保留上下文的数据基础已存在。
  - apps/web/src/components/Layout.tsx：TopNav + main(max-w-5xl) + ToastHost，挂面板的宿主。
  - tailwind.config.js z-index 刻度：nav=40 / overlay=50 / toast=60（禁 z-[9999]）。
  - lib/motion.ts：prefersReducedMotion() / scrollBehavior() 先例。
  - /chat 路由：router.tsx ROUTES 不含面板概念；navRoutes() 含 '/chat'；TopNav 用
    NavLink 渲染全部 nav 项。ROUTES 保持零改动 ⇒ guardPath 与 routerGuard.test.ts
    全部用例零影响（D1c）。
  - #20 GET /api/user/profile 已返回 model: { mode, name }；MePage 已有只读模型展示先例。
1.5 明确排除（一行相关代码都不写）：
  (1) packages/engine/**、data/**、config/params.json、scripts/** 零改动。
  (2) PRD.md / ALGORITHM.md / DATA_SCHEMA.md / 参赛方案 v4 不改；
      API_CONTRACT.md 只做 §9 追加 + §11 留痕（D2），其余章节一字不动。
  (3) 序列化白名单（serialization.ts）、theme/bands.ts、tailwind.config.js 守恒区不动。
  (4) 不新增后端接口编号（仍是 #18，只扩事件）；不装任何新依赖。
  (5) 不碰 D13 列出的他人未提交变更。
  (6) 不给本地模式伪造耗时 / 伪造模型独白（D4 边界）。

-------------------------------------------------
二、决策记录（D1–D13）
-------------------------------------------------
D1 形态：右侧常驻面板（RD1 落实）
  a) 挂载点：Layout.tsx 内新增 <ChatPanelDock />（登录页 bare 外壳不含 Layout，天然无面板）。
     面板开合状态放新 zustand store stores/chatPanel.ts（会话级、不落盘，默认关闭）——
     Layout 随路由切换会重挂载，组件态会丢，store 态不会；对话上下文本就在全局
     useDialogStore，跨页面保留上下文由此达成。
  b) 挤压 vs 覆盖（总控提问点，planner 裁决）：≥1280px（xl）无背景幕，正文列
     （main 容器）加与面板等宽的 padding-right（transition-[padding] 平滑过渡），
     即「挤压正文列但保证可读」；<1280px 改为覆盖式：fixed 右侧抽屉 + 半透明背景幕
     （bg-canvas/60，点击关闭），正文不动。理由：max-w-5xl(1280px) 的正文列在 1280
     以下本就贴边，再挤压必不可读；覆盖式 + 可关闭是窄屏唯一不牺牲正文的形态。
  c) z-index 走 z-overlay（50）档：单一 fixed 容器（内部先背景幕后面板本体）；
     面板 top 从顶栏下缘起（top-[56px]），不遮 TopNav；Toast(z-toast=60) 仍在最上层。
  d) 顶栏「对话辅导」：TopNav 渲染 navRoutes() 时对 path==='/chat' 特判为 button
     （aria-pressed={panel.open}，点击 toggle），其余项仍 NavLink。ROUTES / navRoutes /
     guardPath 数据结构零改动 ⇒ routerGuard.test.ts 全部用例零影响（含 12 页计数、
     navRoutes 6 项、PROTECTED 计数——均不因渲染层特判而变）。
  e) /chat 路由保留为全屏形态（requiresAuth: true, nav: true 原样）；全屏页头部提供
     「收进侧栏」入口（关闭面板态提示），面板头部提供「全屏打开」Link to /chat。
     两形态共用 F2 的同一套视图组件，禁止复制两份实现（对照 A 批 SpaceCreateForm
     完整态/紧凑态先例）。
  f) Esc 关闭面板；面板内消息区自管滚动（overflow-y-auto），不劫持页面滚动。
  依据：总控 RD1 原文 + 用户此前确认「右侧常驻面板，不是替换顶栏导航」。

D2 事件契约 v1.3（RD2 落实，本轮核心）：
  a) SSE 在既有 delta / meta / done / error 之外新增三类事件：thought / tool / phase。
     原四类事件的字段、语义、相对顺序（delta…→meta→done，error 仅异常时）一字不改
     —— 旧客户端 dispatchSseMessage 的 default 分支直接忽略新事件（向前兼容已具备
     且有测试锁定），新客户端不解析也不会破坏 delta 拼接。
  b) JSON 降级（Accept: application/json 或 X-Response-Format: json）响应体 data 在
     { reply, meta } 基础上增 trace: TraceStep[]（顺序即执行顺序），保证降级时
     前端把 trace 重放为 onThought/onTool/onPhase，视觉不塌。
  c) 精确字段表 + 工具名与真实动作对照表见「三、」（F 批照此实现，E1 文档照此追加）。
  d) API_CONTRACT.md 修改边界：§9 在原代码块之后追加「v1.3 变更」标注块（原文逐行
     保留，沿用 v1.2 的裁剪式追加惯例）；§11 追加一行变更记录。其余章节零改动。
  依据：总控 RD2 原文；「只增不删原条款语义」是 v1.2 已获项目方同意的演进方式。

D3 远程模型真流式（RD3 落实）：
  a) models/remoteChat.ts 改 stream: true，并**去掉 response_format: json_object**
     （多数服务商不允许与 stream 组合；结构化输出改由系统提示约束固定字段序 +
     增量抽取 + 最终完整解析三层保证）。原「400 去 response_format 重试」逻辑删除
     —— remoteChat.test.ts 对应用例改为断言「stream:true 且不带 response_format」
     （更新而非删除，见六、）。
  b) 系统提示改为要求按固定字段序输出单个 JSON 对象：
     {"thought", "reply", "progress", "progress_reason", "kp_match", "top_candidates"}；
     thought 语义 = 「写给学生看的推理自述（此刻在想什么、为什么这么引导），1–2 句」，
     不是隐藏 CoT。历史回传锚定格式维持现状（{"reply": ...}）。
  c) 增量抽取（新纯状态机，导出可单测）：扫描流缓冲区定位 "thought": 与 "reply": 的
     字符串值，逐段解码后增量回调 onIncrement({field, text})；转义序列（\n \" \uXXXX）
     跨 chunk 未完整时暂存 pending 不回调（防止发错字）；字段值闭合后锁定；模型不守
     字段序 → 增量为空、最终 extractJsonObject 完整解析兜底（不判失败）。
     thought 增量 → 服务层转发 SSE thought 事件；reply 增量 → 转发 SSE delta 事件
     （即远程模式下 reply 是真流式到达，先于 meta）。
  d) 「半截即断，不拼接」规则（回落纪律的流式版）：适配器若在已发出 reply 增量之后
     失败（网络断 / 最终 JSON 解析不出），**不再回落 localChat 把模板文拼在半截文本后**
     （用户会看到两段不连贯文字），而是上抛；服务层对该轮发 SSE error 事件 + done
     收尾，前端保留已到文本并出错误气泡（sse.ts 现有 failAssistant 语义正好如此：
     text 非空保留原文）。失败发生在任何 reply 增量之前 → 维持现状干净回落 localChat。
  e) 守住的纪律（不变）：适配器只产结构化字段；next_action 恒由服务层状态机裁决
     （不采信模型）；kp_id 必须命中图谱（sanitizeKpFields 原样）；answer /
     solution_steps 与本链路无交集。
  依据：总控 RD3 原文 + 「失败回落 localChat、禁白屏」既有纪律；d) 是对「回落」在
     流式半截场景的必要细化，避免「回落」反而制造更差的体验。

D4 本地模式真实链路（RD4 落实，边界声明）：
  a) 事件只允许对应 services/chat.ts 里**真实执行**的动作，枚举闭集见「三、」工具名
     对照表（load_graph / model_call / kp_match / dedup_check / apply_evidence /
     state_machine / exit_channel）。每个 tool.args / result 填真实中间量：真实 kp_id、
     真实置信度、真实 before/after 掌握度、真实去重命中与否、真实 consecutive_false /
     exit_count。测试断言 trace 步骤名 ⊆ 枚举闭集（防将来有人加「演」的步骤）。
  b) thought 的边界（写给 implementer 的红线）：本地模式的 thought 是**由真实中间量
     拼成的确定性推理摘要**（模板句 + 真实数值，见「三、3.4」示例），**不是**伪装成
     大模型独白的文本；禁止出现任何「让我想想…」式的拟态话术。前端 UI 文案配合区分：
     本地模式思考区标题显示「推理摘要」，远程模式显示「思考过程」（依 #20 的
     model.mode 切换，数据同源，不额外开判断入口）。
  c) 节奏诚实声明：本地计算在毫秒级完成，后端不人为 delay、不伪造 ms（ms 字段 = 真实
     执行耗时，本地通常 <5ms）。「炫酷的流式感」由前端打字机动画呈现（D5），后端只
     保证**顺序真实、内容真实**。此边界同时写进 API_CONTRACT §9 v1.3 变更块的说明行。
  依据：总控 RD4 原文「严禁编造没有发生的步骤」「避免落进演的范畴」。

D5 可视化（RD5 落实）：
  a) 组件拆分与 props 见「五、F2」；取色全部走语义令牌（bg-surface / border-line /
     text-ink-soft / text-accent / band-basic（成功）/ tone-error（失败）/ bg-canvas），
     禁止硬编码 hex；状态带语义色复用既有 band 令牌，不新增取色入口。
  b) 打字机（ThoughtStream）：rAF/interval 按字符渐进揭示，文本增长时追赶至最新；
     prefersReducedMotion() 为 true 时直接全文显示（沿用 lib/motion.ts 先例；
     CSS 侧 index.css 既有 reduced-motion 媒体查询管 spinner 等过渡）。
  c) 工具时间轴（ToolTimeline）：竖向卡片，节点状态图标 = running（旋转 spinner）/
     ok（✓，band-basic）/ error（tone-error）；显示 label + name + ms + 步骤计数
     「第 n 步」+ 当前 phase 进度；args/result 以紧凑 key:value 行渲染（值过长截断）。
  d) 同 id 的 tool 事件（running → ok/error）前端按 id upsert，不重复插卡。
  e) 双主题达标：所有新组件类名只用变量化令牌（dusk 切换自动生效）；F4 走查必须
     深浅两主题各截一轮对话链路。
  f) 窄屏可用：面板 <1280 为覆盖式抽屉（D1b）；全屏页思考区/时间轴在 <720 折叠为
     手风琴（默认收起，流式期间自动展开）。
  依据：总控 RD5 原文 + AGENT §6 状态带唯一来源 + 轮 1 审查 M1 的走查教训。

D6 模型只读展示（RD6 落实）：
  数据源 = #20 GET /api/user/profile 的 model: { mode, name }（apps/web/src/api/
  endpoints.ts 的 getUserProfile 已存在）；面板头部与 /chat 全屏页头部共用
  ModelBadge 组件（props { mode, name }）：mode='local' 显示「本地规则适配器」、
  'remote' 显示模型名；固定副文案「由服务端配置，不可自定义」。不新增任何模型
  切换 / 自定义 UI（红线复核项）。依据：总控 RD6 + #20 契约。

D7 环境变量复核（RD7 落实，只复核不改）：
  F4 执行并留痕（命令见五、F4）：git check-ignore -v .env deploy/zhiwei.env 命中、
  .env.example 与 deploy/zhiwei.env.example 不命中；git ls-files 环境变量相关仅两模板；
  两模板变量集一致（含 ZHIWEI_MODEL_MODE 注释）；models/index.ts 默认 local 不动。
  依据：轮 1 D5 已做且审查通过；本轮因新增 model_call 事件的 args.mode 读同一
  环境变量，故需复核无新增读取面。

D8 批次依赖与契约冻结（总控要求落实）：
  E 必须先落地：E1 把「三、」字段表写进 API_CONTRACT.md §9 并提交（契约冻结点），
  F1 才允许动 apps/web 的 types/sse/store——F 消费的是 E1 冻结的事件名与字段，
  若 F 先行等于前端自造契约，联调必炸。E2/E3/E4 也都以 E1 的类型定义为编译基准。
  子步严格串行 E1→E2→E3→E4→F1→F2→F3→F4，每子步完成即 commit，开工前用
  git log --oneline -3 确认上一步已落盘（沿用上轮 D8 纪律）。

D9 services/chat.ts 重构形态（E2 的实现路线，planner 裁决）：
  a) 拆两段保住「流开始前错误走 JSON 错误体」的现状（chat.test 第 9/11 例 + 前端
     降级链依赖）：prepareChat(req, ctx) = 认证 + 空间归属 + message/image_file_id
     校验 + dialog 加载（401/403/400/404 全在这里抛，行为与现状逐字一致）；
     runChat(prepared, ctx, emit) = 其余全部（模型调用 / 证据 / 状态机 / 分段 /
     落库），过程中通过 emit 产出 phase/thought/tool 事件（含远程转发的
     thought/delta 增量）。
  b) SSE 桥接：chat() 对 SSE 路径返回 AsyncGenerator（async 队列桥）：emit 同步推
     事件入队，生成器逐个 yield（远程模式下模型流的增量即到即发，真流式）；
     runChat 完成后生成器补发 meta → done；runChat 抛错且队列已产出过事件 → 由
     server.ts 既有 catch 输出 error + done（现状语义）；未产出过事件即抛错 =
     理论上只剩模型适配器内部已兜底的错误面，不会破坏 JSON 错误路径。
  c) JSON 路径：emit 换成收集器，runChat 完成后返回 ok({ reply, meta, trace })。
  d) ChatResult（meta/deltas/reply）结构保留（closedLoop / 前端降级消费 reply），
     deltas 数组保留但 SSE 的 delta 发送统一走 emit（远程=流式增量+收尾附加段，
     本地=收尾一次性分段），保证「拼接即 reply」不变式仍成立（测试断言拼接 ==
     reply / == dialog.messages 落库值）。
  e) applySilentEvidence / applyExitChannel 签名扩展为返回真实中间量
     （{ written, dedupHit, before, after } / ExitOutcome 已有 + exit_count），
     供 tool.result 填充；行为零改动（证据三表写入逻辑一行不动）。

D10 trace 归属范围（planner 裁决）：trace 状态（thought / toolSteps / phase）只保留
  **最新一轮**（startAssistant 时 reset），不落库、不进 dialog.messages。理由：
  面板空间有限，链路可视化的价值在「正在发生」的过程；历史轮次的结论已沉淀在
  meta / mastery / 图谱里，回放每轮链路会显著推高 store 与 UI 复杂度，赛前来不及。
  JSON 降级的 trace 同理只含当轮。

D11 前端共享组件纪律（RD1「不复制两份」落实）：ChatMessageList / ChatComposer /
  useChatSend / ThoughtStream / ToolTimeline / ChatTracePanel / ModelBadge 七件全部
  从 ChatPage.tsx 抽出放 components/chat/，全屏页与面板只做布局壳（宽度、滚动容器、
  开合件），业务与视觉一律在共享组件内（对照 SpaceCreateForm 完整态/紧凑态先例）。

D12 远程模式下 delta 与 tool 事件的交错顺序（契约细节，planner 裁决）：远程模式
  thought 增量与 reply 的 delta 增量在 phase retrieve 期间可交错到达（按模型实际
  输出序），随后 judge/generate 阶段的 tool 事件与附加段 delta 依次发出；
  meta 与 done 恒为最后两个事件。契约 §9 v1.3 说明行按此措辞（不承诺严格
  「先全部 thought 后全部 delta」）。

D13 分支与他人未提交变更（沿用上轮 D10）：在 tempdeploy 继续，不切分支、不 rebase；
  M _pipeline/03_REVIEW.md、M tools/e2e-smoke.cjs、?? _pipeline/PR-tempdeploy.md、
  ?? _pipeline/archive/03_REVIEW_20260924_1711.md、?? 知微-项目介绍.md 不进本计划
  任何 commit。

-------------------------------------------------
三、事件契约 v1.3 · 精确字段表（E1 文档照此追加，F 批照此实现）
-------------------------------------------------
3.1 SSE 事件总表（#18 POST /api/agent/chat，Content-Type: text/event-stream）
  ┌─────────┬───────────────────────────────────────────┬──────────────────────┐
  │ event   │ data 字段                                  │ 说明                 │
  ├─────────┼───────────────────────────────────────────┼──────────────────────┤
  │ phase   │ { "name": "analyze"|"retrieve"|"judge"     │ 阶段标记，可重复出现 │
  │         │         |"generate",                       │ （judge 后回         │
  │         │   "label": "分析"|"检索"|"判定"|"生成" }    │ generate 等）        │
  │ thought │ { "text": "增量文本" }                     │ 拼接即本轮完整思考； │
  │         │                                           │ 语义见 3.4           │
  │ tool    │ { "id": "step_1",                         │ 同 id 至多两次下发   │
  │         │   "name": <ToolName 枚举，见 3.2>,        │ （running→终态），    │
  │         │   "label": "中文可读名",                   │ 前端按 id upsert     │
  │         │   "status": "running"|"ok"|"error",       │                      │
  │         │   "args"?: object, "result"?: object,     │ 真实中间量（D4a）    │
  │         │   "ms"?: number }                          │ 真实耗时（D4c）      │
  │ delta   │ { "text": "增量文本" }（v1.1 原样不变）    │                      │
  │ meta    │ 五字段（v1.1 原样不变）                    │ 恒在 done 前         │
  │ done    │ { }（原样不变）                            │ 恒为最后一个事件     │
  │ error   │ { "msg" }（原样不变）                      │ 仅异常时             │
  └─────────┴───────────────────────────────────────────┴──────────────────────┘
  顺序约定：本地模式 phase/thought/tool 全部先于首个 delta；远程模式 thought 与
  delta 可在 retrieve 阶段交错（D12）；meta → done 恒为末两个。旧客户端忽略新事件。

3.2 ToolName 枚举与真实动作对照表（闭集，本地+远程共用）
  ┌────────────────┬──────────────────┬────────────────────────────────────┐
  │ name           │ label            │ 真实动作（代码落点，均真实执行）    │
  ├────────────────┼──────────────────┼────────────────────────────────────┤
  │ load_graph     │ 加载知识图谱     │ prepareChat: nodesForKb(           │
  │                │                  │ space.knowledge_source[0])         │
  │                │ args { kb, node_count }（result 省略）                │
  │ model_call     │ 调用对话模型     │ createModels().chatTurn(...)       │
  │                │                  │ args { mode: 'local'|'remote' }    │
  │                │                  │ result { kp_id, confidence,        │
  │                │                  │ progress }                         │
  │ kp_match       │ 知识点匹配与采纳 │ CONF_ADOPT 判定 + 图谱命中校验     │
  │                │                  │ args { message_excerpt(≤20字) }    │
  │                │                  │ result { kp_id, confidence,        │
  │                │                  │ threshold, adopted,                │
  │                │                  │ fallback_kp_id? }                  │
  │ dedup_check    │ 弱负证据去重检查 │ applySilentEvidence 内             │
  │                │ （仅采纳时）     │ buildDedupKey+findEventsByDedupKey │
  │                │                  │ args { kp_id } result { hit }      │
  │ apply_evidence │ 写入证据与掌握度 │ applySilentEvidence 写三表         │
  │                │ （仅 dedup 未命中）│ args { kp_id } result            │
  │                │                  │ { before, after, event_id }        │
  │ state_machine  │ 状态机判定       │ consecutive_false / next_action    │
  │                │                  │ args { progress } result           │
  │                │                  │ { consecutive_false, next_action,  │
  │                │                  │ exit_threshold }                   │
  │ exit_channel   │ 退出通道·上游回溯│ applyExitChannel: searchUpstream   │
  │                │ （仅触发时）     │ + MAX_EXIT_HOPS                    │
  │                │                  │ args { current_kp_id } result      │
  │                │                  │ { upstream_kp_id?, upstream_name?, │
  │                │                  │ jumped, exit_count, hop_limit }    │
  └────────────────┴──────────────────┴────────────────────────────────────┘
  phase 与动作的对应：analyze(load_graph) → retrieve(model_call, kp_match；远程
  另有 thought/delta 增量) → judge(dedup_check, apply_evidence, state_machine,
  exit_channel) → generate(附加段 delta)。

3.3 JSON 降级（Accept: application/json / X-Response-Format: json）
  data = { "reply": string, "meta": {...原样}, "trace": TraceStep[] }
  TraceStep（顺序即执行顺序，前端重放为对应回调）：
    { "type": "phase",  "name", "label" }
    { "type": "tool",   "id", "name", "label", "status"（恒为终态 ok|error）,
                        "args"?, "result"?, "ms"? }
    { "type": "thought", "text": "该步思考文本（该 thought 增量原样）" }
  云函数入口（functions/api/src/index.ts）缓冲结果与上形完全一致（E4）。

3.4 thought 文案规范（本地模式，确定性拼接，D4b 边界）
  模板句 + 真实数值，例（{} 内为真实中间量）：
    - 匹配后：「学生这句话匹配到知识点「{kp name}」（{kp_id}），置信度 {confidence}
      {≥|<} 采纳阈值 {CONF_ADOPT}，{采纳为本轮知识点|沿用上轮知识点}」
    - 证据后：「写入弱负证据：掌握度 {before} → {after}」或「同小时已有证据，跳过写入」
    - 状态机后：「本轮{无|有}有效进展，连续无进展 {n} 轮{，降至提示阶梯第 2 档|，
      达到 {CONSEC_FALSE_EXIT} 轮，进入退出通道}」
    - 退出后：「回溯先修：最近低掌握上游为「{upstream name}」，{执行跳转|已达跳转
      上限 {MAX_EXIT_HOPS}，只提示不跳转}」
  远程模式 thought = 模型流式输出的 thought 字段增量原样转发（不采信其决策字段）。

3.5 API_CONTRACT.md 追加内容（E1 落地，只增不删）
  a) §9 POST /api/agent/chat 代码块之后追加「v1.3 变更（2026-09-24，见 §11；
     上行原文保留，本节为现行口径）」块：新增事件 thought / tool / phase 的字段表
     （3.1 全文）+ ToolName 对照表（3.2 全文）+ 顺序约定 + trace 降级字段（3.3）+
     thought 语义边界两行（本地=确定性推理摘要 / 远程=模型自述增量）+ 兼容性说明一行
     （旧客户端忽略新事件，delta/meta/done/error 语义不变）。
  b) §11 变更记录追加一行：
     | 2026-09-24 | **v1.3**：① #18 /api/agent/chat 新增 SSE 过程事件 phase/thought/
     tool（工具名闭集 7 项，tool.args/result 为服务端真实中间量）与 JSON 降级 trace
     字段（delta/meta/done/error 语义不变，向后兼容）；② 远程模型适配器改 stream:true
     增量抽取（结构化字段序 thought→reply→…，失败回落纪律不变） | 项目方 | 总控 |

-------------------------------------------------
四、E 批：后端链路透出（先冻结契约）
-------------------------------------------------
E1 契约 v1.3 冻结（文档 + 后端类型 + trace 模块）
  涉及文件（精确路径）：
    API_CONTRACT.md（仅 §9 追加 + §11 一行，见三、3.5）
    functions/api/src/router.ts（SseEvent.event 联合类型扩展为
      'delta'|'meta'|'done'|'error'|'phase'|'thought'|'tool'）
    functions/api/src/services/chatTrace.ts（新增）：
      export type ChatPhaseName = 'analyze'|'retrieve'|'judge'|'generate';
      export type ChatToolName = 'load_graph'|'model_call'|'kp_match'|'dedup_check'
        |'apply_evidence'|'state_machine'|'exit_channel';
      export type ChatToolStatus = 'running'|'ok'|'error';
      export interface ChatToolStep { id; name: ChatToolName; label; status:
        ChatToolStatus; args?; result?; ms? }
      export type ChatTraceStep = { type:'phase'; name; label } | { type:'tool';
        ChatToolStep } | { type:'thought'; text };
      export const PHASE_LABEL: Record<ChatPhaseName,string>
        = { analyze:'分析', retrieve:'检索', judge:'判定', generate:'生成' };
      export const TOOL_LABEL: Record<ChatToolName,string>（与 3.2 的 label 逐字一致）;
      createTraceRecorder()（双模式收集器：emit(ev) 转 trace 数组 + id 自增器，
      E2 的 JSON 路径与测试复用）
  改动要点：本子步**不改任何运行逻辑**，只落类型、常量表与文档；chat.ts / remoteChat.ts
    尚不消费（E2/E3 才接线），tsc 必须已过。
  新增测试：functions/api/tests/chatTrace.test.ts（新，~5 例）：TOOL_LABEL 键集 ===
    3.2 枚举闭集；PHASE_LABEL 四值；createTraceRecorder 的 phase/tool(running→ok)/
    thought 事件转 trace 顺序与形态；tool id 唯一递增；契约文档 grep 断言（§9 含
    'v1.3 变更' 且原文 delta 行仍在——文档回归哨兵，防只增不删被破坏）。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests/chatTrace.test.ts
    git --no-pager diff --stat API_CONTRACT.md（人工核对：仅 §9 追加块 + §11 一行）
  commit 草案：「契约 v1.3 冻结：#18 新增 phase/thought/tool 过程事件 + JSON 降级
    trace 字段（delta/meta/done/error 语义不变）；后端 SseEvent 类型扩展 + chatTrace
    类型模块与标签表 + 5 例」

E2 本地模式真实链路（services/chat.ts 拆分 + 事件产出）
  涉及文件：
    functions/api/src/services/chat.ts（按 D9 重构）
    functions/api/tests/chat.test.ts（更新 6 例 + 新增 describe，见六、）
  改动要点（函数级）：
    - 拆 prepareChat(req, ctx)（认证/归属/校验/dialog 加载，抛错行为与现状逐字一致）
      与 runChat(prepared, ctx, emit)。
    - runChat 内按真实执行序 emit：phase analyze → tool load_graph → phase retrieve
      → tool model_call → tool kp_match → thought(匹配摘要) →（采纳时）phase judge →
      tool dedup_check →（未命中时）tool apply_evidence → tool state_machine →
      thought(状态机摘要) →（触发时）tool exit_channel → phase generate →
      thought(生成摘要，仅 hint/exit 时) → delta 各段 → meta → done。
    - applySilentEvidence 扩展返回 { written, dedupHit, before, after }（写入逻辑
      零改动）；applyExitChannel 返回值补 exit_count / hop_limit。
    - chat()：wantsJson → 收集器跑 runChat 后 ok({ reply, meta, trace })；
      SSE → async 队列桥生成器（D9b）。
    - tool 事件两段式（先 running 后 ok）仅对耗时可见的动作（本地即 load_graph/
      model_call 也毫秒级——**统一只发终态 ok 一次**，running 状态留给远程 model_call
      真流场景；此为 planner 裁决：本地不演耗时，契约允许同 id 至多两次、至少一次）。
      ——更正与简化：本地全部 tool 事件只发终态一次（status:'ok'），running 转换
      仅远程 model_call 出现；「三、」字段表已兼容（status 枚举含 running）。
    - model_call 的 args.mode 读 process.env.ZHIWEI_MODEL_MODE === 'remote' ?
      'remote' : 'local'（与 models/index.ts 同源判定，不新开配置）。
  新增测试（chat.test.ts 新 describe「过程链路 trace」~7 例）：
    (1) 事件全序列：以 phase analyze 开头、meta/done 收尾；delta 前存在
        load_graph/model_call/kp_match/state_machine 四个 tool 事件；
    (2) tool 事件字段形态：name ∈ 枚举闭集、label 与 TOOL_LABEL 一致、
        kp_match.result = 真实 { kp_id, confidence, threshold, adopted:true }；
    (3) dedup 第二轮：dedup_check.result.hit === true 且无 apply_evidence 事件；
    (4) 证据事件：apply_evidence.result.before/after === 0.5/0.45（与 mastery_logs
        对账）；thought 文本含真实数值「0.5 → 0.45」；
    (5) 第 3 轮：exit_channel.result.upstream_kp_id === 'math.cz.function.graph'、
        jumped===true、exit_count===1、hop_limit === params.MAX_EXIT_HOPS；
    (6) clarify 轮（无关键词）：无 dedup_check/apply_evidence 事件（未发生的步骤
        不出现——「不演」的回归锚点）；
    (7) JSON 降级：data.trace 与 SSE 事件序列一一对应（同请求参数两次调用比对
        步骤名序列一致）、Object.keys 含 reply/meta/trace 三键。
  既有 11 例去向见六、总表（6 改 5 不动）。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests/chat.test.ts functions/api/tests/chatTrace.test.ts
  commit 草案：「对话链路透出（本地）：prepareChat/runChat 拆分 + 真实执行序产出
    phase/thought/tool 事件（tool.args/result 全真实中间量，未发生步骤零出现）；
    JSON 降级携 trace；chat 测试 11→18 例」

E3 远程模型真流式（models/remoteChat.ts）
  涉及文件：
    functions/api/src/models/remoteChat.ts（D3 全部）
    functions/api/src/models/types.ts（ChatTurnInput 增可选
      onIncrement?: (chunk: { field: 'thought'|'reply'; text: string }) => void）
    functions/api/src/services/chat.ts（model_call 改带 onIncrement 转发：thought 增量
      → emit thought 事件；reply 增量 → emit delta 事件并置 liveReplySent；适配器
      上抛的「半截失败」→ emit error 事件 + done 后终止，见 D3d）
    functions/api/tests/remoteChat.test.ts（7 例改造 + ~7 新增，见六、）
  改动要点：
    - callChatCompletions 改 stream:true：body 带 stream:true、去 response_format；
      读 response.body reader，逐行解析 OpenAI 流（data: {…} 行取 choices[0].
      delta.content，data: [DONE] 结束）——新增导出纯函数 parseOpenAiStreamLines
      （buffer 状态机，跨 chunk 断行安全，可单测）。
    - 新增导出 createFieldStreamExtractor()（D3c）：push(chunk) 累积缓冲，对
      thought/reply 两字段做定位→字符串增量解码（转义未完整暂存），每有确定增量
      回调 onIncrement；字段闭合即锁定；finish() 返回完整累积文本。
    - chatTurn(input, onIncrement?)：流式调用 → extractor 增量 → 流结束完整文本
      extractJsonObject（原函数复用）→ 既有字段映射（sanitizeKpFields 原样）。
      失败分支：任何 reply 增量已发出后的失败（网络/解析）→ 不回落，上抛
      RemoteChatAborted（新导出错误类）；零增量失败 → 回落 localChatTurn（现状）。
    - system prompt 改造（D3b 固定字段序 + thought 字段说明）。
    - 远程 model_call 的 tool 事件：running 先发（真发起模型流时）、终态 ok/error
      后发 —— 远程模式是唯一出现 status:'running' → 终态两段式的地方。
  新增测试（remoteChat.test.ts ~7 例）：
    (1) 请求体断言：stream === true 且无 response_format（替代原「400 重试」用例语义）；
    (2) 流式 mock（ReadableStream 分块吐 data: 行）：thought/reply 增量按块到达、
        顺序与内容正确（onIncrement 断言）；
    (3) 转义跨 chunk：\" 与 \u4e2d 被拆在两块 → 增量文本正确解码、无错字；
    (4) data: [DONE] 结束 + 完整 JSON 解析成功 → ChatTurnOutput 字段映射不变；
    (5) 字段乱序（reply 在 thought 前）→ 无 thought 增量但不失败，最终输出正确；
    (6) 流中段 network error 且已有 reply 增量 → 抛 RemoteChatAborted（不回落）；
    (7) 流开始即失败（零增量）→ 回落 localChat（现状用例改流式 mock 后保留语义）。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests/remoteChat.test.ts functions/api/tests/chat.test.ts
  commit 草案：「远程模型真流式：stream:true + 固定字段序结构化输出 + thought/reply
    增量抽取（转义跨块安全）；半截即断不拼接、零增量干净回落本地；15→22 例」

E4 云函数入口对齐 + 后端全量回归
  涉及文件：
    functions/api/src/index.ts（main() 生成器消费：delta 拼 reply 之外收集
      phase/tool/thought → data.trace，与 wantsJson 降级同形（D9c/3.3））
    functions/api/tests/closedLoop.test.ts（1 例更新：SSE 事件序列断言
      events).toEqual(['delta','meta','done']) → 改为断言序列以 phase 开头、
      以 meta/done 收尾、过滤后 delta→meta→done 相对序不变 + text 含 '"trace"' 的
      JSON 降级断言；更新而非删除，见六、）
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests
  commit 草案：「云函数入口与本地降级同形（trace 收集）；closedLoop SSE 序列断言
    同步 v1.3；后端全量回归」

-------------------------------------------------
五、F 批：前端面板 + 可视化（消费 E 冻结的契约）
-------------------------------------------------
F1 前端消费层（types / sse / store）
  涉及文件：
    apps/web/src/api/types.ts（新增 ChatToolStep / ChatPhaseStep / ChatTraceStep /
      ChatSseToolData 等；ChatJsonData 增 trace?: ChatTraceStep[]——字段名与
      契约 3.3 逐字一致）
    apps/web/src/api/sse.ts（ChatStreamHandlers 增可选 onThought?/onTool?/onPhase?；
      dispatchSseMessage 增 'thought'|'tool'|'phase' 三 case；renderJson 在
      onDelta(reply) 前按 trace 顺序重放 onPhase/onTool/onThought——降级视觉不塌）
    apps/web/src/stores/dialog.ts（增 trace 状态：thought: string、toolSteps:
      ChatToolStep[]、phase: {name;label}|null；动作 appendThought / upsertTool
      （按 id upsert，running→终态覆盖）/ setPhase；startAssistant 内 resetTrace
      （D10 只留最新一轮））
    apps/web/src/stores/chatPanel.ts（新增：{ open: boolean; setOpen; toggle }，
      会话级不落盘）
    apps/web/tests/sse.test.ts（13 例不动 + 新增 ~6：三新事件路由、trace 重放、
      tool 同 id upsert 语义、未知事件忽略仍生效）
    apps/web/tests/dialogStore.test.ts（新增 ~6：appendThought 拼接、upsertTool
      running→ok 覆盖不重复、setPhase、startAssistant 清 trace、finishAssistant
      不清 trace（完成后仍可见）、reset）
    apps/web/tests/chatPanel.test.ts（新增 ~3：默认关、toggle、setOpen）
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests/sse.test.ts apps/web/tests/dialogStore.test.ts apps/web/tests/chatPanel.test.ts
  commit 草案：「前端消费层：SSE 三新事件路由 + JSON 降级 trace 重放；dialog store
    追加 thought/toolSteps/phase（仅最新一轮）；chatPanel store；22 例」

F2 共享对话视图组件 + ChatPage 瘦身（D11）
  涉及文件（均新增，目录 apps/web/src/components/chat/）：
    useChatSend.ts（hook：现 ChatPage.send() 逻辑迁入 + onThought/onTool/onPhase
      接线到 dialog store；暴露 { send, streaming }）
    ChatMessageList.tsx（props { messages: ChatMessage[] }：气泡/徽标/注脚/notice，
      自 ChatPage 原样迁出；流式追加贴底滚动 + scrollBehavior() 保留）
    ChatComposer.tsx（props { disabled: boolean }：输入框 + 传图读题 picker +
      发送，内部用 useChatSend；演示态标注保留）
    ThoughtStream.tsx（props { text: string; done: boolean }：打字机渐进揭示，
      prefersReducedMotion() → 直接全文；文本增长时追赶；无文本且 !done 显示
      「正在整理思路…」骨架点）
    ToolTimeline.tsx（props { steps: ChatToolStep[]; phase: {name;label}|null }：
      竖向时间轴卡片 + 状态图标（running spinner / ok ✓ band-basic / error
      tone-error）+ 步骤计数「第 n 步 / 共 N 步」+ phase 进度条；args/result
      紧凑 key:value 行，超长截断）
    ChatTracePanel.tsx（props { thought: string; toolSteps; phase; streaming:
      boolean }：折叠条「思考与工具链」，流式期间自动展开、完成后可折叠（组件
      本地态）；内部组合 ThoughtStream + ToolTimeline）
    ModelBadge.tsx（props { mode: 'local'|'remote'; name: string | null }：徽标 +
      固定文案「由服务端配置，不可自定义」；数据由调用方从 getUserProfile() 取，
      页面/面板各自缓存一次）
  改造：apps/web/src/pages/ChatPage.tsx 瘦身为布局壳：宽屏两栏（左消息流 max-w-2xl +
    右 ChatTracePanel），<720 上下堆叠且 ChatTracePanel 折叠为手风琴（D5f）；
    头部加 ModelBadge + 「收进侧栏」提示文案；文案/交互语义零变化。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests
  commit 草案：「对话视图组件化（全屏/侧栏共用一套）：useChatSend + 消息流 + 输入区 +
    思考流打字机（尊重 reduced-motion）+ 工具链时间轴 + 模型徽标；ChatPage 瘦身为
    布局壳，行为零变化」

F3 右侧常驻面板 + 顶栏按钮（D1）
  涉及文件：
    apps/web/src/components/chat/ChatPanel.tsx（新增：头部（标题 + ModelBadge +
      「全屏打开」Link to /chat + 关闭按钮）+ ChatMessageList + ChatTracePanel +
      ChatComposer；消息区 overflow-y-auto 自管滚动；Esc 关闭）
    apps/web/src/components/Layout.tsx（挂 <ChatPanelDock />：内部渲染 ChatPanel；
      ≥1280 且 open → main 容器 padding-right = 面板宽（transition-[padding]）；
      <1280 且 open → 背景幕；容器 z-overlay）
    apps/web/src/components/TopNav.tsx（navRoutes().map 中 path==='/chat' 特判渲染
      button（aria-pressed、toggle 面板），其余 NavLink 原样；不改 ROUTES 数据）
  注意：App.tsx / router.tsx / routerGuard.test.ts 零改动（D1c/d 已论证）。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests/routerGuard.test.ts apps/web/tests/chatPanel.test.ts apps/web/tests/sse.test.ts
  commit 草案：「右侧常驻对话面板：Layout 挂 dock（≥1280 挤压正文列 / <1280 覆盖式
    抽屉 + 背景幕，z-overlay）；顶栏「对话辅导」改开合按钮（aria-pressed）；
    /chat 全屏保留；ROUTES 与守卫零改动」

F4 视觉走查 + env 复核 + 文档收尾
  涉及文件：LOOKATME.md（非冻结，更新进度快照与本轮数字）；_pipeline/02_EXEC_REPORT.md
    （implementer 产物，走查留痕写在这里，本计划只定要求）。
  走查要求（轮 1 审查 M1 教训：不可静默跳过）：
    - 优先用 agent-browser（或本机浏览器）真实截图：四档宽度 1440/1024/720/375 ×
      深浅两主题，至少覆盖：面板展开态正文可读性、链路面板两主题对比度、
      ToolTimeline running/ok 两态、窄屏面板抽屉 + 背景幕、/chat 全屏两栏与 <720 堆叠；
    - 若环境不允许（60 秒杀进程），改在同一调用内「起后端 + 起 vite → node 忙等 →
      curl 探活 → pkill」验证服务可用，截图部分在执行报告显式标注「未实测 + 原因」，
      并以静态兜底：grep 新组件无裸 hex 类名、tsc/tests 全绿。
  env 复核命令（RD7，结果贴执行报告）：
    git check-ignore -v .env deploy/zhiwei.env          → 两条均命中
    git check-ignore -v .env.example deploy/zhiwei.env.example → 不命中（exit 非 0）
    git ls-files | grep -iE '(^|/)\.env|\.env$'          → 仅两模板
    git --no-pager diff --stat .env.example deploy/zhiwei.env.example（本轮应为零改动）
  验证命令（F 批总回归 + 构建）：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vite/bin/vite.js build apps/web
      （以 vite.config.ts 的实际调用形态为准：--config apps/web/vite.config.ts）
    $PY scripts/validate_data.py（确认数据闸门不受影响）
  commit 草案：「LOOKATME 更新轮 2 进度（对话链路 v1.3 + 右侧面板）」+ 走查截图/
    结论随执行报告入库。

-------------------------------------------------
六、测试影响总表（300 例的账；更新而非删除/放宽——上轮 reviewer 专项查过，本轮照此）
-------------------------------------------------
既有用例逐条去向：
  1. functions/api/tests/chat.test.ts（11 例，E2）：
     (1)「事件序列 delta→meta→done」→ 改：全序列以 phase analyze 开头、meta/done
         收尾；过滤 delta/meta/done 后相对序 ['delta','meta','done'] 不变（保留原
         断言精神）+ 新断言 delta 前有 tool 事件。
     (2)「第 2/3 轮 hint_down/exit（序列数组）」→ 改：两处 toEqual(['delta',…]) 数组
         断言改为 delta 段数断言（deltaTexts 长度 2/3）+ 相对序；texts[1]/texts[2]
         内容断言原样保留。
     (3)「exit 上游回溯」→ 不动（只读 metaOf/dialog，无事件序列断言）。
     (4)「silent 弱负证据」→ 不动。
     (5)「dedup 命中」→ 不动。
     (6)「clarify 零证据」→ 改：events[0].data 取首个 delta 事件（原 events[0] 将是
         phase 事件）；其余断言原样。
     (7)「首轮带图读题」→ 改：同 (6)，events[0] → 首个 delta。
     (8)「Accept: application/json 降级」→ 改：键集 ['meta','reply'] →
         ['meta','reply','trace']。
     (9)「X-Response-Format: json」→ 不动（reply any String 仍成立）。
     (10)「续聊/403/404」→ 不动（prepareChat 保住流前 JSON 错误路径）。
     (11)「400/403/401」→ 不动（同上）。
     净：6 改 5 不动，另新增 trace describe 7 例（E2 清单）→ 11→18。
  2. functions/api/tests/remoteChat.test.ts（15 例，E3）：
     readRemoteChatConfig 2 例不动；extractJsonObject 6 例不动；chatTurn describe
     7 例全部改流式 mock（okResponse → ReadableStream 分块 data: 行；断言主体
     保留：结构化映射 / 伪造 kp 丢弃 / 网络失败回落 / 非 JSON 回落 / 历史回传
     {"reply":…} / 未配置零请求），其中「response_format 400 重试」1 例语义更新为
     「stream:true 且无 response_format」（D3a，契约行为变更的必然同步，非放宽）。
     净：7 改 8 不动，另新增 7 例（E3 清单）→ 15→22。
  3. functions/api/tests/closedLoop.test.ts（20 例，E4）：仅「真实 SSE 流式通路」
     1 例的事件序列断言更新（含降级 trace 断言）；路由表 20 条断言不动（无新接口）。
  4. apps/web/tests/sse.test.ts（13 例，F1）：parseSseBuffer 6 + dispatch 2 +
     streamChat 5 全部不动（delta/meta/done/error 语义未变）；新增 ~6 例。
  5. apps/web/tests/routerGuard.test.ts（12 页断言等）：零改动（ROUTES 未动，D1c）。
  6. apps/web/tests/bands.test.ts / themeStore / stages / profile / 其余后端
     （auth/space/diagnose/report/…）：零改动；E4/F 的全量回归跑覆盖其不受影响。
  新增文件：chatTrace.test.ts（E1，~5）+ dialogStore.test.ts（F1，~6）+
    chatPanel.test.ts（F1，~3）。
  预计总数：300 + 7(chat) + 7(remoteChat) + 5(chatTrace) + 6(sse) + 6(dialogStore)
    + 3(chatPanel) ≈ 334（以实跑为准，写入执行报告对账；任何用例不得删除或放宽，
    reviewer 按本表核对 git diff 只见改写与新增）。

-------------------------------------------------
七、风险与回滚
-------------------------------------------------
R1 流式改造破坏既有 11 例 chat 用例
  面：事件序列断言（(1)(2)(6)(7)(8)）与错误路径行为。
  对策：六、总表逐条写死去向；prepareChat 前置全部校验错误（401/403/400/404 四类
    用例零改动是验收锚点——若它们红了说明拆分破坏了「流前 JSON 错误」契约）；
    (3)(4)(5)(9)(10)(11) 七例不动本身即回归哨兵。
  回滚：E2 独立 commit，git revert <E2> 即回到 v1.2 行为（契约文档 revert E1）。
R2 远程流式解析失败 / 半截文本（remote 模式专属，默认 local 不受影响）
  面：转义跨块错字、字段乱序、流中断。
  对策：D3c 转义未完整暂存不回调；乱序 → 增量为空最终解析兜底；半截即断不拼接
    （D3d，error 事件 + 前端保留半截文本出气泡，sse.ts failAssistant 现有语义）；
    零增量失败干净回落 localChat（现状）；单测 (2)(3)(5)(6)(7) 逐面覆盖。
  回滚：revert E3 → 回到 stream:false（chat.ts 的 onIncrement 参数可选、E2 不依赖）。
R3 面板与既有页面布局冲突
  面：GraphPage 最小宽 720 横滚、报告表格、max-w-5xl 左基线。
  对策：<1280 覆盖式抽屉不挤压；≥1280 挤压但正文列仍有 ≥880px（1280-400）；
    F4 四档宽度走查含图谱页 + 报告页各一张截图；z-overlay 不与 nav/toast 冲突。
  回滚：revert F3 → 顶栏回到 NavLink（F2 组件仍在但仅全屏页使用，无副作用）。
R4 新事件在旧客户端上的兼容
  面：旧前端（已部署 dist）遇到 thought/tool/phase。
  对策：sse.ts default 分支忽略未知事件（现状即有 + 有测试）；契约 v1.3 只增不改
    delta/meta/done/error；JSON 降级增 trace 键，旧前端按多余键忽略（renderJson 只
    读 reply/meta）——E1 文档兼容性说明行写明。
R5 本地与远程链路表现不一致
  面：thought 语义差异（确定性摘要 vs 模型自述）、running 状态只在远程出现。
  对策：事件契约同一套（工具名闭集共用）；差异点在契约 3.4 与 UI 文案（「推理摘要」/
    「思考过程」按 #20 model.mode 切换）显式声明，不藏着；本地不发 running 不发
    伪造 ms（D4c），一致性以「步骤名序列在同等输入下相同」为准（chat 测试 (7) 的
    JSON/SSE 比对即对账锚点）。
R6 60 秒 SIGKILL / 走查做不了
  对策：测试三条分批；起服务同调用「起→探→杀」；走查优先 agent-browser，不行则
    执行报告显式标注未实测 + 静态兜底（上轮 M1 教训：不可静默跳过）。
R7 双写手 / 中断续接
  对策：D8 串行 + 每子步即 commit；重派前按 AGENT §8-2 查文件 mtime / commit 活跃。
R8 契约只增不删被破坏
  对策：E1 的 chatTrace.test.ts 含契约文档 grep 哨兵（原文 delta 行仍在 + v1.3
    块存在）；reviewer 复核 git diff API_CONTRACT.md 仅 §9 追加 + §11 一行。

-------------------------------------------------
八、总验收标准（F4 结束后一次性跑齐）
-------------------------------------------------
  1. 三批测试全绿（分三条跑）：
     $NODE $WS/node_modules/vitest/vitest.mjs run packages
     $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
     $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
     → 预计 ~334 例 / 0 skip（六、总表对账，数字以实跑为准）。
  2. 三段 tsc --noEmit（engine / functions/api / apps/web）→ 全部 exit 0。
  3. $PY scripts/validate_data.py → 6 项校验通过（本轮不碰数据，应零变化）。
  4. vite build 通过（F4 命令）；后端 esbuild bundle 可选复核。
  5. 真实走查留痕（执行报告）：四档宽度 × 两主题截图齐备（或显式标注未实测 + 静态
     兜底证据）；面板展开正文可读、时间轴 running/ok 两态、reduced-motion 下无
     打字机动画且全文完整。
  6. git --no-pager diff API_CONTRACT.md（对基线）：仅 §9 v1.3 追加块 + §11 一行。
  7. env 复核四条命令输出贴执行报告（RD7）；模型相关零新增前端入口（grep
     apps/web/src 无 model 配置表单）。
  8. 红线复核：serialization.ts / theme/bands.ts / engine / data / config / scripts
     零改动；answer / solution_steps 不进任何新事件字段（trace 的 args/result 只装
     D4a 列出的真实中间量，其中不含题库答案字段——apply_evidence.result 只有数值
     与 event_id，solutionText 的完整解法只走既有 delta 文本通道）。

-------------------------------------------------
九、执行纪律
-------------------------------------------------
  - 顺序 E1→E2→E3→E4→F1→F2→F3→F4 严格串行，每子步 commit 后再开下一步
    （AGENT §7：中文信息 + 关键数字）；E1 是契约冻结点，F 批禁止先于 E1 开工（D8）。
  - 不碰 D13 他人未提交变更；不修改 engine / data / config / scripts / 冻结文档
    （API_CONTRACT 仅按三、3.5 追加）。
  - 执行报告 _pipeline/02_EXEC_REPORT.md 按批记录：实际测试数、六、总表的实跑对账、
    计划外裁决按 D 编号续写 D14+、走查截图或未实测声明。
  - reviewer 重点核对：测试只改写不删除（六、逐条）、契约只增不删（R8 哨兵）、
    tool 事件无编造步骤（chat 测试 (6) 锚点）、面板不挤压正文到不可读（走查）。
  - 阻塞项：无（总控 RD1–RD7 已定方向；细节歧义已按 D1–D13 自行裁决留痕）。
