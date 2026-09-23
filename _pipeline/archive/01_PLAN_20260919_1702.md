知微 · 迭代 2「后端 19 接口 + MINOR 清偿」实施计划
=================================================
计划编号：01_PLAN（第 2 版）
编写日期：2026-09-19
编写角色：规划者（本计划只做规划，implementer 严格照办）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
权威依据：施工文档优先于方案叙事；冲突裁决顺序 API_CONTRACT > ALGORITHM > DATA_SCHEMA >
          PRD > 知微-参赛完整方案-v4。契约 v1.1（19 接口 + 九张表）为本次核心依据。
迭代 1 状态：VERDICT: PASS（03_REVIEW.md；36 引擎用例全过、数据闸门全绿、git main 分支）。

归档记录：本文件写入前，迭代 1 旧计划已复制归档为
  _pipeline/archive/01_PLAN_20260919_1657.md（归档文件只增不删，不修改、不删除）。

提问纪律（本轮最高纪律，总控已冻结）：本轮不向主控 / 用户提问。所有文档矛盾与歧义
由本计划自行裁决并逐条留痕（见 二、2.2 决策记录 D1–D16，含理由与依据优先级）。
implementer 执行中发现新的矛盾：同样不得提问，按上述优先级自行裁决并在执行报告
偏差清单中留痕（记录冲突原文、裁决、理由），禁止静默假设。

-------------------------------------------------
一、目标与范围
-------------------------------------------------

1.1 迭代目标（按优先级）：
  (1) 后端 API_CONTRACT v1.1 全部 19 个接口在本地可运行、可测试、可演示：
      共享 handler 核心（路由 + 业务逻辑）+ 双入口（本地 Node HTTP server / CloudBase
      云函数薄适配层），`npm run api` 一键起服务。
  (2) DB 适配层：九张表（DATA_SCHEMA §4）读写语义的 Store 接口 + 本地 JSON 文件实现
      （data/local_db/，.gitignore）+ CloudBase 适配器留桩；dedup 幂等按契约"先查后写"。
  (3) 模型适配层：ModelAdapter 接口 + 本地确定性适配器（classify / 试卷识别 / chat），
      保证 19 接口零外部依赖跑通闭环；真实大模型接入点留桩注释；模型输出后处理规则
      （CONF_ADOPT 阈值、attribution_direction 服务端硬编码映射、结构化字段解析）真实实现。
  (4) ALGORITHM §4 归因定位在服务端补齐（迭代 1 未实现）：BFS 反向回溯 + 嫌疑分公式 +
      验证题降序排除 + 全排除诚实回落；§5 退出通道状态机 + 提示阶梯在 chat 落地。
  (5) SSE：本地 HTTP server 支持 text/event-stream 流式输出（agent/chat），含 JSON 降级路径。
  (6) 统一工程纪律：错误码表全接口共用（契约 §0，不扩展）；space_id 归属校验 403；
      时间 ISO8601 UTC；ID 前缀 u_/sp_/evt_/log_/attr_/dlg_/q_/rec_；知识点一律完整 id；
      answer / solution_steps 绝不下发前端（序列化白名单强制）。
  (7) 清偿迭代 1 遗留 5 条 MINOR（03_REVIEW §5.3）：①收敛取等边界用例；②@types/node
      写入根 package.json devDependencies；③q_cz_opening_010 answer 完整性；④新增
      scripts/verify_items.py 固化题库复算；⑤"无题可出 vs 已收敛"语义区分与剪枝传递性
      （裁决见 D8/D9，引擎层面落实，向后兼容）。
  (8) 接口级测试（vitest，Node 环境）：覆盖注册登录 token 流、space 403 越权、测评闭环
      （含幂等重交不重复扣分）、试卷确认流、classify 低置信 clarify、归因回溯与验证分支、
      chat 连续 3 轮 false 触发退出、report ΔAccuracy；引擎既有 36 用例不得回归。

1.2 明确排除（本迭代一行相关代码都不写，防止范围蔓延）：
  (1) 前端 10 个业务页面（迭代 3；apps/web 保持空壳不动）。
  (2) 云部署执行、CloudBase 真实环境、wx-server-sdk / @cloudbase/node-sdk 实际调用
      （适配器仅留桩 + SDK 调用点注释，允许在无环境下不激活）。
  (3) 真实大模型 API Key / 真实 HTTP 模型调用（remote 适配器留桩）。
  (4) scripts/seed.js 真实云端写入（可留桩：读静态题库并打印将写入的条目数，不连云）。
  (5) SSE 断线续传、并发锁 / 事务（ALGORITHM §8、PRD §4 明确不做）。
  (6) 掌握度历史快照、按学科参数隔离、BKT 更新调模型（ALGORITHM §8 明确不做）。
  (7) 修改 5 份需求文档（API_CONTRACT / ALGORITHM / DATA_SCHEMA / PRD / 方案 v4）——
      契约已冻结，任何字段分歧以裁决 + 留痕方式处理，不改契约。
  (8) packages/engine 既有函数签名与行为的破坏性变更（只允许 D8/D9 授权的向后兼容
      增补与注释级修改）。

1.3 冲突裁决总则（本轮不提问，全部自行裁决并留痕）：
  所有裁决集中在 二、2.2 决策记录（D1–D16），每条含【冲突/歧义原文】【裁决】【依据】
  【理由】。implementer 遇到本计划未覆盖的新冲突，按同格式自行裁决留痕，禁止提问、
  禁止静默假设。

-------------------------------------------------
二、总体目录结构与关键决策
-------------------------------------------------

2.1 目标目录树（仅列本迭代新增/修改部分；未提及的既有目录保持不变）：

  zhiwei/
  ├── package.json                        修改：+scripts(api/build:api/typecheck:all)
  │                                         +devDependencies(@types/node、esbuild)
  ├── .gitignore                          修改：+data/local_db/、+functions/api/dist/
  ├── scripts/
  │   ├── validate_data.py                既有，不动
  │   └── verify_items.py                 新建：题库复算固化（MINOR-④）
  ├── data/
  │   ├── item_bank/math/cz.json          修改：q_cz_opening_010 answer 补全（MINOR-③）
  │   └── local_db/                       运行时生成，不入库（本地 JSON 持久化）
  │       ├── users.json  spaces.json  mastery_profiles.json  evidence_events.json
  │       ├── mastery_logs.json  attributions.json  dialogs.json  recognitions.json
  │       └── （item_bank 不落此目录：本地实现直接只读 data/item_bank 静态文件）
  ├── packages/engine/
  │   ├── src/selection.ts                修改：SelectionResult 增可选 stopReason（D8）
  │   │                                     + 顶部注释补剪枝口径说明（D9，行为不变）
  │   └── tests/selection.test.ts         修改：+2 收敛边界用例（MINOR-①，见 五、步骤 3）
  └── functions/
      └── api/
          ├── package.json                修改：元数据更新（依赖仍由根统一管理，不装包）
          ├── tsconfig.json               新建：extends ../../tsconfig.base.json + types:["node"]
          ├── src/
          │   ├── index.ts                修改：CloudBase 云函数入口（薄适配 → router，D1）
          │   ├── server.ts               新建：本地 Node HTTP 入口（`npm run api`，D2）
          │   ├── router.ts               新建：method+path 匹配 → service 分发表（19 路由）
          │   ├── context.ts              新建：请求上下文（token 鉴权、space 归属校验 403、
          │   │                              统一响应封装 {code,msg,data}、HTTP 状态映射 D11）
          │   ├── errors.ts               新建：契约 §0 错误码表 + ApiError（不扩展）
          │   ├── ids.ts                  新建：ID 生成（u_/sp_/evt_/log_/attr_/dlg_/rec_ 前缀）
          │   ├── grading.ts              新建：作答判定（归一化判等 + distractor 命中，D10）
          │   ├── serialization.ts        新建：toClientItem 字段白名单（answer/solution_steps
          │   │                              绝不下发，供 next/submit/verify/plan 复用）
          │   ├── db/
          │   │   ├── types.ts            新建：九张表记录类型（DATA_SCHEMA §4）+ Store 接口
          │   │   ├── jsonStore.ts        新建：本地 JSON 实现（整文件读-改-写 + 先查后写）
          │   │   ├── cloudbaseStore.ts   新建：CloudBase 适配器桩（SDK 调用点注释，不激活）
          │   │   └── index.ts            新建：createStore 工厂（ZHIWEI_DB=json|cloudbase）
          │   ├── models/
          │   │   ├── types.ts            新建：ModelAdapter 接口（classify/recognizePaper/chatTurn）
          │   │   ├── localClassify.ts    新建：确定性诊断适配器（规则见 四、4.1）
          │   │   ├── localRecognize.ts   新建：确定性试卷识别适配器（规则见 四、4.2）
          │   │   ├── localChat.ts        新建：脚本化对话适配器（规则见 四、4.3）
          │   │   └── index.ts            新建：createModels 工厂（真实模型接入点留桩注释）
          │   ├── data/
          │   │   └── staticData.ts       新建：图谱 + 题库加载（data/knowledge、data/item_bank，
          │   │                              进程内缓存；CloudBase 形态下等价于读 item_bank 表）
          │   ├── attribution/
          │   │   └── attributionCore.ts  新建：ALGORITHM §4 纯计算（BFS 回溯、嫌疑分公式、
          │   │                              验证题选择），供 services/attribution.ts 调用
          │   └── services/               新建 10 文件（一接口组一文件，见 三、逐接口规格）
          │       ├── auth.ts             register / login（HMAC token、scrypt、默认空间）
          │       ├── space.ts            list / create / drive
          │       ├── selfReport.ts       自报先验
          │       ├── diagnose.ts         next / submit（复用 engine）
          │       ├── paper.ts            paper POST / GET / confirm
          │       ├── classify.ts         error/classify（后处理真实实现）
          │       ├── attribution.ts      analyze / get / verify / reject
          │       ├── plan.ts             plan/generate
          │       ├── chat.ts             agent/chat（SSE + 退出通道状态机）
          │       └── report.ts           report/summary
          └── tests/                      新建 12 文件（vitest，Node 环境）
              ├── helpers.ts              测试应用工厂（mkdtemp 临时 db 目录 + 直接调 handler）
              ├── auth.test.ts  space.test.ts  selfReport.test.ts  diagnose.test.ts
              ├── paper.test.ts  classify.test.ts  attribution.test.ts  plan.test.ts
              ├── chat.test.ts  report.test.ts
              └── closedLoop.test.ts      集成闭环（真实 HTTP server + fetch，含 SSE 探测）

  既有 functions/api/package.json + src/index.ts 的改造方式（迭代 1 已存在）：
  - src/index.ts：从"空入口 + 导航注释"改写为 CloudBase 薄适配层：解析 event（path/method/
    body/headers）→ 调 router.dispatch → 回包；保留 CloudFunctionEvent/CloudFunctionContext
    接口；wx-server-sdk / @cloudbase/node-sdk 的初始化与 DB 绑定位置以注释标出（不激活）。
  - package.json：仅更新 description 与私有元数据；不新增 dependencies（依赖装隔离 workspace，
    由根 package.json 声明，沿用迭代 1 纪律）。

2.2 关键决策记录（D1–D16，本轮全部自行裁决，理由留痕）：

  D1 双入口形态：路由与全部业务逻辑落在 router.ts + services/*（纯模块，可被 vitest
     直接 import 调用）；server.ts（本地 Node http.createServer）与 index.ts（CloudBase
     适配）都只是薄壳：解析请求 → router.dispatch → 序列化响应。业务零入口耦合，
     测试不需要起真实端口（closedLoop.test.ts 例外：它专门验证真实 HTTP + SSE 通路）。
     【理由】implementer 单批执行可能中断，纯模块 + 薄入口让每批都能独立验证与提交。

  D2 TypeScript 运行方式：测试由 vitest 直跑 TS（既有能力）；本地 server 用 esbuild
     打包（functions/api/src/server.ts --bundle --platform=node --format=cjs →
     functions/api/dist/server.js）后由 node 运行。esbuild 是 vite@5.4.8 的传递依赖，
     本迭代显式声明并安装 esbuild@0.21.5 到隔离 workspace（禁 -g）。
     【理由】不用 node --experimental-strip-types：其 import 必须带 .ts 扩展名，与
     tsconfig moduleResolution:"bundler" 的无扩展名风格冲突，且行为随 Node 版本浮动；
     esbuild 打包路径与 vitest/tsc 三方零歧义。

  D3 DB 适配层：db/types.ts 定义 Store 接口，方法按九张表语义划分（如
     findUserByIdentifier / insertUser / listSpacesByUser / getSpace /
     listProfiles / upsertProfile / findEventByDedupKey / insertEvent / insertLog /
     getAttribution / updateAttribution / getDialog / upsertDialog / insertRecognition /
     getRecognition / updateRecognition）。本地实现 LocalJsonStore：每表一个 JSON 文件，
     整文件读-改-写（demo 规模足够；ALGORITHM §8 明确不做并发锁）；目录由构造参数注入
     （默认 data/local_db/，测试注入 mkdtemp 临时目录）。dedup 幂等 = 写入前
     findEventByDedupKey 先查后写（DATA_SCHEMA §4 注："若平台不支持唯一索引，dedup
     采用提交前先查后写实现"——本地即此形态）。
     CloudBaseStore 留桩：每个方法体为 `throw new Error('CLOUDBASE_NOT_CONFIGURED')`
     + 注释标注等价的 collection(db).where(...).get()/add()/update() 调用点；不引入 SDK。
     【理由】总控冻结的架构形态；测试隔离靠目录注入，不靠清库。

  D4 模型适配层：models/types.ts 定义 ModelAdapter（三方法：classify(input)→
     {error_type,matched_typical_error,confidence,evidence}；recognizePaper(input)→
     items[]；chatTurn(input)→{reply,progress,progress_reason,next_action,kp_match}）。
     本地确定性实现见 四、。后处理规则（confidence<CONF_ADOPT→clarify、
     attribution_direction 服务端硬编码映射、matched∈该 kp typical_errors 校验、
     error_type 五值枚举校验、结构化字段解析、kp 完整 id 校验）全部实现在
     services/classify.ts / chat.ts 的代码侧，不采信适配器自觉——即使将来换成真实
     模型，后处理纪律不变（ALGORITHM §3"后处理（代码侧，不采信模型）"）。

  D5 密码哈希：node:crypto scrypt（salt 16 字节随机 + N=16384）存 "salt:hash" 十六进制
     拼接，字段名仍用 password_hash。
     【冲突】DATA_SCHEMA §4.1 标注 "password_hash": "bcrypt"。【裁决】scrypt。
     【依据】API_CONTRACT（更高优先级）对哈希算法无要求；PRD §4 明确不做复杂认证，
     且 bcrypt 需第三方原生依赖，与"依赖装隔离 workspace + 零运行时新依赖"的既有纪律
     冲突；scrypt 为 Node 内置且强度等价。【理由】字段名不变，表结构兼容，仅算法实现
     差异，云上换 bcrypt 不改表。

  D6 无状态 token：token = base64url(JSON.stringify({user_id, iat, exp})) + "." +
     HMAC-SHA256(payload, SERVER_SECRET)。SERVER_SECRET 读环境变量
     ZHIWEI_SERVER_SECRET；本地缺省回落常量 "zhiwei-dev-secret"（源码注释标明"仅本地
     演示，云函数必须由环境变量注入"）。校验 = 解 payload + 验签 + exp 未过期（exp
     = iat + 30 天）。不落库（契约 §1 明确无状态签名）。

  D7 diagnose 幂等粒度（本轮最重要的裁决）：dedup_key 仍按 ALGORITHM §1 公式构造并
     存储（五段，不含 item_id，存储值与规格逐字一致）；但 diagnose/submit 的幂等命中
     判定 = 已存在事件中 dedup_key 相同且 item_id 相同 → 跳过整个更新流程、静默返回
     当前状态（HTTP 200）。silent / paper 事件 item_id=null，dedup_key 单独生效。
     【冲突】ALGORITHM §1 字面"dedup_key 命中则跳过"会让同一小时内同 kp 的第二道
     不同题被吞（diagnose 选题常连续出同 kp 的题），测评闭环无法推进；而契约 §4 与
     PRD P0 #5 的幂等语义是"重复提交（同一提交）不重复扣分"。【裁决】事件级幂等
     （dedup_key + item_id 双匹配）。【依据】优先级 API_CONTRACT > ALGORITHM。
     【理由】dedup_key 字段格式与存储完全遵循 ALGORITHM（不改动规格定义的键结构），
     仅命中判定收紧到事件级，同时满足"重复提交不重复扣分"与"同 kp 多题正常计分"。

  D8 "无题可出 vs 已收敛"语义区分（MINOR-⑤/INFO-2，引擎层面落实）：
     SelectionResult 增可选字段 stopReason?: 'variance' | 'max_items' | 'no_items'
     （方差收敛 / 题量上限 / 全池无题），nextItem 三个终止出口各自标因。
     向后兼容（可选字段，36 用例不破坏）；契约 §4 响应不加字段（契约冻结，converged
     语义保持"前端结束测评"）。stopReason 供服务端日志与接口测试断言使用。
     【理由】区分两种停止原因可避免把"题池耗尽"误报为"已收敛"；引擎层面落实（总控
     授权"引擎或文档层面，你裁决"）。

  D9 拓扑剪枝传递性（INFO-3）：维持"直接先修达标即可测"的既有口径（迭代 1 已实现并
     经审查确认正确），在 selection.ts 顶部注释补一句口径声明："剪枝按直接先修判定，
     更上游不达标不阻断本节点（ALGORITHM §2 '所有先修节点' 取直接先修解读）"。
     【理由】20 节点图链深浅，直接先修口径已由 S1/S1b 用例锁定；传递式剪枝会改变既有
     行为并动摇 36 用例，收益不成比例。注释级修改，行为零变更。

  D10 作答判定（grading.ts，全接口共用）：
     normalize(s) = s.trim() → 全角转半角（（）－，；：空格等）→ 英文统一小写 →
     去全部空白 → 中文顿号/分号统一为英文逗号。
     判定顺序：① normalize(student_answer) 与该题 distractors[].answer 逐条判等 →
     wrong（返回命中的 typical_error_code，供 classify 复用）；② 与标准 answer 判等 →
     correct；③ 其余 → wrong（无错误码）。choice 题按选项文本判等（同规则）。
     空作答（normalize 后为空串）→ wrong。
     【理由】PRD 未要求语义判分（自然语言判卷属模型能力），确定性规则保证可测可复现；
     distractors 命中优先使"答错→错误码"链路（classify 的素材）在后端真实可用。

  D11 HTTP 状态码映射：响应体 {code,msg,data} 恒按契约；HTTP status = code（code>=400
     时 status=code，code=0 时 status=200；500/502/504 同理）。SSE 接口（chat）：流
     开始前发生错误 → 普通 JSON 错误体；流开始后异常 → 依次输出 event:error（data 含
     用户可读降级话术）+ event:done 后结束。降级路径：请求头 Accept: application/json
     或 X-Response-Format: json → chat 不走 SSE，直接返回 {reply(全文), meta} 的普通
     JSON（契约 §9"降级：退化为普通 JSON，禁止白屏"的可验证实现）。

  D12 report 无画像知识点与 error_type_last 来源：mastery 列表输出全部 20 节点，无
     mastery_profiles 记录者 mastery=0、status_band="待巩固"（语义成立：低于剪枝阈值
     即不可作为合格先修）；gaps[].error_type_last 取该 kp 最近一条 attributions 记录
     的 error_type，无归因记录 → null。【理由】九张表中只有 attributions 持久化
     error_type（classify 无独立表），报告页需要全节点覆盖供图谱四色着色。

  D13 弱负证据留痕：agent/chat 产生弱负证据时写 evidence_events(source="silent",
     alpha=0.10, item_id=null, dedup 1 小时) + mastery_logs（before/after 真实值，
     p_obs=p_eff=after（无三段式中间量）、weight=0、triggered_by=该 evt_id）。
     【理由】ALGORITHM §1"每次更新写 mastery_logs"适用于弱负证据路径；DATA_SCHEMA §4.5
     字段为数值类型，无中间量时以 after 填充并在本计划留痕。

  D14 试卷识别本地模拟：以 file_id 字符串哈希为随机种子，从题库确定性抽 3 题；每题
     stem_excerpt = 题干前 24 字符 + "…"，kp_guess = 题的 knowledge_point，
     student_answer = 该题 distractors[0].answer（模拟真实答错），suggested_result =
     "wrong"；seq%3===0 的项改为 student_answer=""、suggested_result="unclear"（专供
     "unclear 必须手标"测试与演示）。crop_url 按 DATA_SCHEMA §5 路径约定拼
     "local://paper/{space_id}/{recognition_id}/{seq}.jpg"。
     【理由】总控指定"题库抽样模拟"；确定性种子保证测试可复现。

  D15 巩固题序列（plan/generate）：取根因节点的先修链（全部祖先 + 根因自身），按拓扑
     序上游在前；每节点从 train 池取未做过（排除该 space evidence_events.item_id）
     的题按难度升序；链长 ≤4 时每节点 2 题、>4 时每节点 1 题，总量 ≤8。path = 该链
     完整 id 列表（图谱高亮用）。strategy 枚举硬编码映射（ALGORITHM §4）：
     concept_confusion→"对比辨析"；method_gap→"思路示范"；prerequisite_gap→
     "先补上游 + 上游讲解"。explanation_outline 取根因 kp typical_errors 各条的
     desc/remedy 生成 3–5 条提纲。
     【理由】"从根因沿先修正向排布、难度递增"解释为先修链拓扑序（上游→根因），
     难度沿链递增；数量上限防止响应体膨胀。

  D16 login 失败统一 401：identifier 不存在与密码错误都返回 401（msg 统一"账号或密码
     不正确"），不泄露 identifier 存在性。【理由】契约 §0 401="未认证/token 无效"
     语义可覆盖；register 的 409（已注册）已能区分场景。

  （与 03_REVIEW INFO 项的关系：INFO-1 grep 正则属报告措辞，无需动作；INFO-4 状态带
   0.8 归属已由既有用例锁定，不动；INFO-5 apps/web package.json "type":"module" 属
   前端迭代，不动。）

-------------------------------------------------
三、19 接口逐个实现规格
-------------------------------------------------

约定：下表"表"列指该接口读写的运行时九张表（DATA_SCHEMA §4）；"引擎"列指复用的
@zhiwei/engine 导出（packages/engine/src/index.ts，一律相对路径 import，不得重写）；
测试要点均在 functions/api/tests/ 对应文件落实（详见 五、步骤拆解）。

  #1 POST /api/auth/register（契约 §1）
     请求：identifier / password(≥6，否则 400) / nickname 可选
     响应：data = { user_id: "u_…", token }
     副作用：自动创建默认空间（name="初中数学"、knowledge_source=["kb_math_cz"]、
             is_default=true）；users + spaces 各写一条
     表：users、spaces；引擎：无
     测试：注册成功返回 token 且 space/list 可见默认空间；重复 identifier → 409；
           password<6 → 400；nickname 缺省可注册

  #2 POST /api/auth/login（契约 §1）
     请求：identifier / password；响应：data = { user_id, token }
     表：users（只读）；引擎：无
     测试：正确凭证返回可用 token（调 space/list 验证）；错误密码 / 不存在账号 → 401
           （D16 统一话术）；伪造 token 调受保护接口 → 401；过期 token → 401

  #3 GET /api/space/list（契约 §2）
     响应：data = { spaces: [{space_id,name,subject,knowledge_source,is_default,created_at}] }
     表：spaces；引擎：无
     测试：新用户仅见 1 个默认空间；字段与 DATA_SCHEMA §4.2 一致

  #4 POST /api/space/create（契约 §2）
     请求：knowledge_source（当前唯一合法值 "kb_math_cz"，其他 → 400）
     响应：data = { space_id, name }（name 服务端取知识库名，拒收客户端传入）
     错误：同学科空间已存在 → 409，data = { existing_space_id }
     表：spaces；引擎：无
     测试：二建同 kb → 409 且返回 existing_space_id；非法 knowledge_source → 400

  #5 GET /api/space/{space_id}/drive（契约 §2，P1 一并实现）
     响应：data = { files: [{file_id,name,type,size}] }
     实现：预置清单常量（课标 PDF / 教材 PDF 两条，file_id 形如 file_preset_001）+
           用户文件（本地恒为空数组）；真实云盘列目录留桩注释
     表：无；引擎：无
     测试：返回预置 2 条；越权 space_id → 403

  #6 POST /api/evidence/self-report（契约 §3）
     请求：space_id + reports: [{chapter, level:1–5}]（章节粒度，≤6 项，超限 → 400）
     响应：data = { updated }
     规则：level→P(L0) 用 engine.priorFor（PRIOR_MAP）；仅初始化/覆盖 mastery_profiles
           的 p_l0 与 mastery；evidence_count>0 的 kp 不覆盖；不写 evidence_events
     表：mastery_profiles；引擎：priorFor
     测试：章节"二次函数" level 2 → 该章节全部 kp p_l0=0.30、mastery=0.30；已有
           证据的 kp 不被覆盖（updated 计数不含）；非法章节/level → 400；7 项 → 400

  #7 POST /api/diagnose/next（契约 §4）
     请求：space_id / mode∈{diagnose,baseline,retest} / scope_chapter 可选 /
           exclude_item_ids 可选（前端已出题列表）
     响应：data = { item: {item_id,stem,options}|null, remaining, converged }
     规则：usedItemIds = 请求 exclude_item_ids ∪ 该 space 全部 evidence_events 的
           item_id；answeredCount = 该 space source="diagnose" 且 mode=本次 mode 的
           事件数；scope_chapter 非空 → 图谱先按章节过滤再进选题；池由 mode 推导
           （engine.poolForMode）；序列化用 toClientItem（无 answer/solution_steps）
     表：mastery_profiles、evidence_events（读）；引擎：nextItem（含 D8 stopReason）
     测试：diagnose 出 train 池题；baseline 出 retest 池题；不重复出已做题；先修未达
           0.4 的 kp 被剪枝（不出现其题目）；converged=true 时 item=null；remaining
           递减；响应不含 answer/solution_steps 键

  #8 POST /api/diagnose/submit（契约 §4）
     请求：space_id / item_id / answer / mode
     响应：data = { correct(true|null), mastery_before, mastery_after, converged,
                    next_item|null }
     规则：correct 仅 baseline/retest 返回（diagnose 恒 null，防反推答案）；判定用
           grading.ts（D10）；dedup 按 D7（同 dedup_key 且同 item_id 命中 → 200 静默
           返回当前状态，不写事件不更新掌握度）；命中不重复写 evidence_events、
           mastery_logs；w = W_DIAGNOSE = 1.0；next_item 用更新后的 mastery 复跑 nextItem
     表：evidence_events、mastery_logs、mastery_profiles；引擎：updateMastery、
           buildDedupKey、nextItem、poolForMode
     测试：答对（提交标准答案）mastery 上升（对照 0.845 自检值场景）；答错下降；
           幂等：同 item 同答案重交 → mastery_after 不变、evidence_events 不新增；
           同 kp 第二道不同题同小时内正常计分（D7 核心断言）；diagnose 模式 correct
           恒为 null；baseline 模式 correct 有值；mastery_logs 落 before/p_obs/p_eff/
           after/weight/triggered_by 全字段

  #9 POST /api/evidence/paper（契约 §5）
     请求：space_id / file_id；响应：data = { recognition_id, status:"pending_confirm",
             items:[{seq,stem_excerpt,kp_guess,student_answer,suggested_result}] }
     规则：本地用 localRecognize（D14）确定性模拟；结果整体写 recognitions 表（刷新
           可回显）；识别结果不产生证据、不更新掌握度（确认才生效）
     表：recognitions；模型：recognizePaper；引擎：无
     测试：返回 3 项、含至少 1 项 unclear；recognitions 表落库；同 file_id 两次调用
           结果一致（确定性）；space 越权 → 403

  #10 GET /api/evidence/paper/{recognition_id}（契约 §5）
     响应：data 同 #9（确认前刷新回显；确认后 status="confirmed"）
     表：recognitions；引擎：无
     测试：确认前回显 pending_confirm 全量 items；确认后再取 status="confirmed"；
           不存在 → 404；他人 recognition → 403

  #11 POST /api/evidence/paper/confirm（契约 §5）
     请求：recognition_id / space_id / items: [{seq, kp_id, result∈{correct,wrong}}]
     响应：data = { events_created, mastery_updates: [{knowledge_point,before,after}] }
     规则：recognition 中 suggested_result="unclear" 的 seq 必须在请求中显式标注
           result，缺失 → 400（拒绝默认值，PRD P0 #4）；kp_id 校验存在于知识库；
           与 kp_guess 不一致视为学生修正（允许）；recognition 必须 status=
           "pending_confirm"（重复确认 → 409，防双击重复计分）；逐题写
           evidence_events(source="paper", w=W_PAPER=0.8, item_id=null, raw 含
           crop_url 与 student_answer, dedup 先查后写)；updateMastery(w=0.8) +
           mastery_logs；确认后 status→confirmed；expire_at = now+30d
     表：recognitions、evidence_events、mastery_logs、mastery_profiles；
         引擎：updateMastery、buildDedupKey
     测试：确认 3 题 → events_created=3、mastery_updates 长度按去重后 kp 数；
           unclear 项未手标 → 400；kp_id 非法 → 400；重复 confirm → 409；w=0.8 的
           掌握度变化与引擎 T2 用例（0.791）量级一致

  #12 POST /api/error/classify（契约 §6）
     请求：space_id / item_id 可选（题库内，给出则补 stem 上下文）/ stem（item_id 空
           时必填，否则 400）/ student_answer / kp_id（校验存在，否则 400）
     响应（采纳）：data = { status:"adopted", knowledge_point, error_type(五值枚举),
                matched_typical_error(code|null), confidence, evidence,
                attribution_direction(upstream|self|none) }
     响应（低置信）：data = { status:"clarify", question }
     规则（后处理，代码侧真实实现）：confidence < CONF_ADOPT(0.60) → 一律 clarify
           禁止采纳；attribution_direction 由服务端映射表从 error_type 硬编码
           （ALGORITHM §3 表：prerequisite_gap→upstream；concept_confusion/method_gap
           →self；procedural_slip/misreading→none）；matched_typical_error 只能取自
           该 kp typical_errors[].code（校验，越界→回退 null）
     表：无（模型受约束调用，不落表）；模型：classify（localClassify）；
         引擎：无（规则在后处理层）
     测试：作答命中 distractor（如 vertex_form 题 sign_confusion 路径）→ adopted、
           confidence=0.90、matched=对应 code、direction 与映射表一致；未命中任何
           已知错误路径 → clarify（confidence 0.45 < 0.6）；作答正确 → clarify
           （D-4.1 规则 2）；五类 error_type 的 direction 映射逐一断言（用图谱中
           五类各自的典型 distractor 样本）

  #13 POST /api/attribution/analyze（契约 §7）
     请求：space_id / kp_id / error_type / evidence_event_id 可选
     响应：data = { attribution_id, root_cause, path[](完整 id，终点=根因),
                    suspect_scores{}(完整 id 键), verification_item{item_id,stem,options}|null }
     规则：error_type∈{procedural_slip,misreading} → 400（前端不得调用，服务端防御，
           契约 §7 前置 + ALGORITHM §3 direction=none 不进归因）；direction=self →
           path=[kp_id]、root_cause=kp_id、verification_item=null、suspect_scores={}；
           direction=upstream → attributionCore：沿 prerequisites 反向 BFS 深度 ≤
           MAX_DEPTH(3)，suspect[a] = SUSPECT_BASE(0.60)^dist × (1−mastery(a))，
           降序排列；验证题 = 每个候选 kp 的 train 池难度最低未做题；path = from_kp →
           按嫌疑序回溯到根因候选的先修路径（BFS 父指针还原）；写 attributions
           （verified=false, rejected_by_student=false）
     表：attributions（写）、mastery_profiles（读嫌疑分）、evidence_events（读排除已
         做）；引擎（attributionCore 内纯计算，参数全部来自 config）：SUSPECT_BASE、
         MAX_DEPTH 经 loadParams 注入
     测试：prerequisite_gap → path 终点为上游节点、suspect_scores 上界断言（d=1 ≤0.60、
           d=2 ≤0.36，ALGORITHM §4 勘误公式）；concept_confusion → path=[kp]、
           verification_item=null；procedural_slip → 400；嫌疑分降序与 (1−mastery)
           单调性断言；attribution_id 前缀 attr_

  #14 GET /api/attribution/{attribution_id}（契约 §7）
     响应：data 同 #13（含 rejected_by_student 字段，回显用）
     表：attributions；引擎：无
     测试：analyze 后立即 GET 字段一致；404；他人 attribution → 403

  #15 POST /api/attribution/verify（契约 §7）
     请求：attribution_id / item_id（验证题）/ answer
     响应：data = { verified, correct, root_cause, next_candidate:{kp_id,suspect_score,
                    verification_item}|null }
     规则：correct 由服务端判定（grading，D10）；验证题作答写
           evidence_events(source="diagnose", mode="diagnose", w=1.0, item_id=验证题)
           并走 BKT 更新 + mastery_logs；答对 → 当前候选确认为根因，verified=true、
           verified_by=该 evt_id、root_cause=候选 kp；答错 → 排除当前候选，
           next_candidate=次高嫌疑及其验证题（verified 保持 false）；候选全部排除 →
           root_cause 回落 from_kp（诚实兜底）、verified=true
     表：attributions、evidence_events、mastery_logs、mastery_profiles；
         引擎：updateMastery、grading（本地）
     测试：答对分支 verified=true 且 root_cause=首候选；答错一次 → next_candidate=
           次高嫌疑；连续答错至全部排除 → root_cause=from_kp、verified=true；验证题
           作答产生 diagnose 证据（事件可查）

  #16 POST /api/agent/reject（契约 §7）
     请求：attribution_id / reason 可选；响应：data = { verification_item }
     副作用：attributions.rejected_by_student = true；追加一道再验证题（取次高嫌疑
           候选的验证题）；无剩余候选 → 按 #15 回落规则 root_cause=from_kp 后
           verification_item = null（留痕：契约样例为有候选的成功路径，空值为诚实兜底）
     表：attributions；引擎：attributionCore（候选序）
     测试：reject 后 GET 可见 rejected_by_student=true 且返回新验证题；候选耗尽 →
           verification_item=null

  #17 POST /api/plan/generate（契约 §8）
     请求：space_id / root_cause / error_type
     响应：data = { strategy(枚举), explanation_outline[], item_sequence:[{item_id,stem,
                    options,difficulty}](完整题对象、无 answer), path[](完整 id) }
     规则：D15（策略映射 + 先修链正向 + 难度递增 + train 池 + 排除已做）
     表：evidence_events（读排除已做）；引擎：无（读图谱/题库静态数据）
     测试：concept_confusion → strategy="对比辨析"；prerequisite_gap → "先补上游 +
           上游讲解"；item_sequence 难度非降序断言（沿链拓扑序）；全部来自 train 池；
           path 完整 id 且首元素为链最上游；响应无 answer/solution_steps

  #18 POST /api/agent/chat（契约 §9，SSE）
     请求：space_id / dialog_id 续聊时传 / message / image_file_id 可选
     响应：Content-Type: text/event-stream；事件序列 delta(增量文本) → meta
           {dialog_id, kp_match{kp_id,confidence}, progress, progress_reason,
            next_action∈{continue,hint_down,give_solution,exit_channel}} → done
     规则：首轮带 image_file_id → 先"读题"（local：从题库抽 3 题构造 Top-3 候选，
           meta 返回最优一个）；kp 匹配置信度 <0.6 → 先追问澄清、不产生证据；
           ≥0.6 → 产生弱负证据（applyWeakNegative + evidence_events(source="silent",
           alpha=0.10) + dedup 1 小时 + mastery_logs，D13）；progress 只读结构化字段
           （localChat 规则表，四、4.3），不解析自然语言；状态机（ALGORITHM §5）：
           consecutive_false 计数（progress=true 清零）；第 2 轮 false → 提示阶梯
           hint_down（方向性提示 = kp typical_errors remedy）；第 3 轮 false → 完整
           解法（= train 首题 solution_steps 拼接）与退出通道合并处理（next_action=
           exit_channel，delta 文本先解法后退出话术，PRD §6 话术"我们先往回看一眼
           XX，那里可能是关键"）；触发时当前 kp 置 blocked_by_prerequisite、沿先修
           找最近 mastery<EXIT_UPSTREAM_THRESHOLD(0.6) 上游重启引导；连续跳转
           exit_count ≤ MAX_EXIT_HOPS(2)，超限只提示不跳转；找不到达标上游 → 不跳转
           仍标记并改用基础巩固话术（以上状态机细节均留痕，冲突裁决见四、4.3 注）
     降级：D11（Accept: application/json → 全文 reply + meta 普通 JSON）
     表：dialogs（upsert，messages 全量留痕 + consecutive_false + exit_count +
         status）、evidence_events、mastery_logs、mastery_profiles；引擎：
         applyWeakNegative、buildDedupKey
     测试：SSE 事件序列 delta→meta→done 顺序断言（消费 AsyncGenerator）；消息含 kp
           名（"二次函数的顶点式我不会"）→ kp_match.confidence≥0.6 且产生 silent
           弱负证据（mastery ×0.9 断言）；同小时同 kp 第二轮 → dedup 命中不新增事件；
           消息无关键词 → 澄清且零证据；连续 3 轮 "不会" → 第 3 轮 next_action=
           exit_channel、dialogs.consecutive_false=3、kp status=blocked_by_prerequisite
           （+ 存在低掌握上游时 meta.kp_match 切到上游）；第 2 轮 false → hint_down；
           续聊传 dialog_id 复用同一 dialogs 记录；JSON 降级路径返回完整 reply

  #19 GET /api/report/summary?space_id=xxx（契约 §10）
     响应：data = { mastery:[{kp_id,name,mastery,status_band}], gaps:[{kp_id,name,
                    mastery,error_type_last}], accuracy:[{kp_id,baseline,retest,delta}] }
     规则：mastery 全 20 节点（D12，无画像 mastery=0）；status_band 用
           engine.masteryToBand；gaps = mastery<0.4 清单；accuracy 按
           evidence_events(source="diagnose") 分组：mode=baseline 事件算基线正确率、
           mode=retest 算复测正确率，delta = retest−baseline（单侧缺失 → 该侧 null、
           delta null；双侧皆无 → 该 kp 不进 accuracy 列表）
     表：mastery_profiles、attributions、evidence_events；引擎：masteryToBand
     测试：预置某 kp baseline 1/3 对、retest 3/3 对 → baseline≈0.33、retest=1.0、
           delta≈0.67；无测量 kp 不出现在 accuracy；gaps 仅含 mastery<0.4；
           status_band 边界值（0.39/0.4/0.8）与引擎一致

  路由汇总（router.ts 注册顺序注意：静态段优先于参数段，
  /api/evidence/paper/confirm 先于 /api/evidence/paper/{recognition_id} 匹配）：
    POST /api/auth/register | POST /api/auth/login
    GET  /api/space/list | POST /api/space/create | GET /api/space/:spaceId/drive
    POST /api/evidence/self-report
    POST /api/diagnose/next | POST /api/diagnose/submit
    POST /api/evidence/paper | GET /api/evidence/paper/:recognitionId |
    POST /api/evidence/paper/confirm
    POST /api/error/classify
    POST /api/attribution/analyze | GET /api/attribution/:attributionId |
    POST /api/attribution/verify | POST /api/agent/reject
    POST /api/plan/generate | POST /api/agent/chat | GET /api/report/summary

-------------------------------------------------
四、本地模型适配器确定性规则（ModelAdapter 本地实现）
-------------------------------------------------

4.1 localClassify.classify({stem, student_answer, kp})（服务层补 kp 的题与典型错误
    上下文后调用）：
    规则 1：normalize(student_answer)（D10 同一函数）命中该 kp 任一题的
            distractors[].answer → { confidence:0.90, error_type:该 code 对应
            typical_errors[].error_type, matched_typical_error:code,
            evidence:该 distractor.explanation }
    规则 2：命中标准答案（作答正确）→ 服务层直接走 clarify（question："这次做对了，
            说说你当时卡在哪一步？"）。【留痕】classify 语义是"错误分类"，正确作答
            无错误可诊断；真实模型场景同样会退化为低置信，clarify 是诚实行为。
    规则 3：未命中任何已知错误路径 → { confidence:0.45, error_type:null,
            matched_typical_error:null, evidence:null } → 服务层 CONF_ADOPT 阈值
            拦截 → clarify（question："你这一步是怎么算的？能写一下吗？"）
    服务层后处理（真实实现，不依赖适配器）：CONF_ADOPT 判定、direction 硬编码映射、
    matched∈该 kp codes 校验、error_type 五值枚举校验、kp 完整 id 校验。

4.2 localRecognize.recognizePaper({space_id, file_id, recognition_id})：D14（哈希种子
    确定性抽 3 题；seq%3===0 项 unclear）。

4.3 localChat.chatTurn({dialog 历史, message, image_file_id, kp 图谱})：
    kp_match 置信度：message 含 kp.name → 0.85；含 chapter 名 → 0.70；含该 kp
      typical_errors.desc 的特征关键词（取 desc 前 6 字符做包含匹配）→ 0.65；否则
      0.30（<0.6 → 澄清）。多命中取最高。
    progress：message 命中触发词表 ["不会","不知道","没思路","随便","猜"] →
      { progress:false, progress_reason:"学生仍未能给出有效一步" }；否则
      { progress:true, progress_reason:null }。
    reply 文案模板（语气遵守 PRD §6"耐心的学长"）：澄清模板 / 引导模板（"我们先把
      XX 的定义过一遍…"）/ 方向提示模板（remedy）/ 完整解法模板（solution_steps
      分步输出）/ 退出话术模板（"我们先往回看一眼 XX，那里可能是关键"）。
    next_action 由服务层状态机计算（chat.ts，真实实现）：基于 dialogs 持久化的
      consecutive_false 计数（D-#18 规则）；适配器只产出 reply 文本与 progress
      结构化字段——"代码只读字段，不解析自然语言"纪律的落点。
    首轮 image_file_id：适配器先输出"读题"reply（"我看到了这道题，它考的是 XX…"，
      XX 取 Top-1 候选 kp 名），meta.kp_match 返回最优候选（置信度同上规则）。
    【留痕】ALGORITHM §5 内部冲突：提示阶梯"≥3 次给完整解法"与状态机"连续 3 轮
    false 触发退出"在 n=3 重叠，而契约 next_action 为单值——裁决为第 3 轮合并处理
    （解法文本 + exit_channel），理由：PRD P0 #8 原文即"3 次给完整解法；连续 3 轮
    false 触发退出通道"并列，两者都不可丢，单值 next_action 以退出通道优先（它是
    更强的终止信号，前端据此离开当前 kp）。

-------------------------------------------------
五、步骤拆解（8 个批次，编号即执行顺序；每批独立可验证、可 commit）
-------------------------------------------------

步骤 1：工程基座（路由骨架 + DB 层 + 双入口）
  目的：搭好"本地可运行"的骨架，业务未动但 404/401 通路已通。
  产出文件：
    /Users/Merryou/LearnBuddy/zhiwei/functions/api/tsconfig.json（新建）
    functions/api/src/{server,router,context,errors,ids,grading,serialization}.ts（新建 7）
    functions/api/src/db/{types,jsonStore,cloudbaseStore,index}.ts（新建 4）
    functions/api/src/data/staticData.ts（新建）
    functions/api/src/index.ts（改写为 CloudBase 薄适配层，D1）
    functions/api/package.json（修改元数据）
    package.json（根，修改：scripts + devDependencies @types/node@22.7.5 +
      esbuild@0.21.5 —— MINOR-② 在此清偿）
    .gitignore（修改：+ data/local_db/ + functions/api/dist/）
  准备修改的函数/模块：
    router.ts：dispatch(method, path, body, headers) → Promise<ApiResponse>；
      路由表先注册 0 个业务路由（全 404），后续批次逐批挂载。
    context.ts：requireAuth(headers)（D6 验签）、requireSpaceOwnership(userId,
      spaceId)（403）、ok(data)/fail(code,msg) 封装。
    jsonStore.ts：LocalJsonStore 实现 Store 接口全部方法；ensureDir + 惰性建表文件。
    grading.ts / serialization.ts：D10 / toClientItem 白名单（本轮先落函数与单测级
      自检，业务接入随各批次）。
    server.ts：http.createServer → router.dispatch；SSE 写出器（writeEvent(name,
      data)）；端口 env ZHIWEI_API_PORT 默认 8787；SIGINT 优雅退出。
  预计影响：纯新增 + 3 个文件修改；不触碰引擎与数据。
  验证命令：七、7.2 / 7.4 / 7.5（typecheck + 构建 + 启动探活 404/405 JSON 形态）。
  commit 建议：iter2 基座：api 工程配置 + 路由/上下文/DB 适配层 + 双入口骨架。

步骤 2：认证 + 空间（接口 #1–#5）
  目的：token 流与 space 归属校验先行，后续所有接口的安全基座。
  产出文件：
    functions/api/src/services/{auth,space}.ts（新建 2）
    functions/api/tests/{helpers,auth,space}.test.ts（新建 3）
  准备修改的函数/模块：
    auth.ts：register（scrypt + 默认空间副作用 + HMAC token）、login（D16）；
    space.ts：list / create（409 existing_space_id）/ drive（预置常量）；
    router.ts：挂载 5 条路由。
  预计影响：users/spaces 两表开始有写入。
  验证命令：七、7.3（vitest run functions/api/tests/auth.test.ts 等）+ 7.5 curl 演示。
  commit 建议：iter2 认证与空间：register/login + space list/create/drive（含 403 基座）。

步骤 3：自报 + 测评 + 引擎 MINOR 清偿（接口 #6–#8，MINOR-①③⑤）
  目的：打通"先验→选题→提交→幂等→收敛"核心链路；清偿三条引擎/数据侧 MINOR。
  产出文件：
    functions/api/src/services/{selfReport,diagnose}.ts（新建 2）
    functions/api/tests/{selfReport,diagnose}.test.ts（新建 2）
    packages/engine/src/selection.ts（修改：SelectionResult 增可选 stopReason 三个
      终止出口各自标因 + 顶部注释补剪枝口径，D8/D9，向后兼容）
    packages/engine/tests/selection.test.ts（修改：+2 用例 S6c/S6d，MINOR-①——
      V 恰等于 CONV_VAR 的双侧夹逼：构造 p_lo 使 V=0.10−1e-9 → converged=true、
      p_hi 使 V=0.10+1e-9 → converged=false；附注释说明 IEEE754 无法精确表示 0.10，
      取等边界以 ±1e-9 双侧夹逼锁定（03_REVIEW MINOR-1 的可确定性实现），并断言
      stopReason 分别为 'variance' 与 undefined（非收敛出口））
    data/item_bank/math/cz.json（修改：q_cz_opening_010 的 answer 补单调性结论，
      与 solution_steps 末步一致，MINOR-③；改后跑 7.6 数据闸门）
  准备修改的函数/模块：
    selfReport.ts：章节→kp 展开、priorFor 映射、evidence_count>0 跳过、≤6 项校验；
    diagnose.ts：next（usedItemIds/answeredCount 口径见三、#7）与 submit（D7 幂等、
      grading、updateMastery w=1.0、mastery_logs、next_item 复跑）。
  预计影响：mastery_profiles/evidence_events/mastery_logs 开始有写入；引擎可选字段
    增补不破坏 36 用例（7.3 全量回归验证）。
  验证命令：七、7.3（全量，引擎 36+2 不得回归）+ 7.6（数据闸门，确认 MINOR-③ 改动
    不破坏校验）。
  commit 建议：iter2 自报与测评闭环 + 引擎 stopReason/边界用例 + opening_010 答案补全。

步骤 4：模型适配层 + 试卷三接口（接口 #9–#11）
  目的：ModelAdapter 接口落地 + 试卷上传确认流（w=0.8 通路）。
  产出文件：
    functions/api/src/models/{types,localRecognize,index}.ts（新建 3）
    functions/api/src/services/paper.ts（新建 1）
    functions/api/tests/paper.test.ts（新建 1）
  准备修改的函数/模块：
    localRecognize.ts：D14 规则；paper.ts：上传（写 recognitions）、GET 回显、
      confirm（unclear 必须手标 400、kp 校验、409 重复确认、逐题事件 + w=0.8 更新 +
      日志、status→confirmed、expire_at 30d）；router.ts 挂 3 路由（confirm 先于
      :recognitionId）。
  预计影响：recognitions 表启用；models 目录成型（localClassify/localChat 下批补）。
  验证命令：七、7.3 + 7.4（新增文件纳入 typecheck/build）。
  commit 建议：iter2 模型适配层接口 + 试卷上传/回显/确认流。

步骤 5：classify + 归因四接口（接口 #12–#16，ALGORITHM §4 服务端补齐）
  目的：错误诊断受约束调用 + 归因回溯/验证/反驳全流程（迭代 1 未实现的 §4 在此落地）。
  产出文件：
    functions/api/src/models/localClassify.ts（新建 1）
    functions/api/src/attribution/attributionCore.ts（新建 1）
    functions/api/src/services/{classify,attribution}.ts（新建 2）
    functions/api/tests/{classify,attribution}.test.ts（新建 2）
  准备修改的函数/模块：
    attributionCore.ts（纯函数，服务端，不进 engine 包——总控明示"在服务端实现"）：
      buildSuspects(graph, mastery, fromKp, params)（BFS 反向 ≤MAX_DEPTH +
      SUSPECT_BASE^dist×(1−mastery) + 降序）、pickVerificationItem(bank, kp, used)、
      buildPath(graph, fromKp, rootCause)（BFS 父指针还原完整 id 路径）；
    classify.ts：CONF_ADOPT 后处理 + direction 硬编码映射表 + 枚举/码校验；
    attribution.ts：analyze（self/upstream 分支 + 写表）/ get / verify（判分 + 证据 +
      BKT + 候选推进/全排除回落）/ reject（rejected_by_student + 追加验证题）。
  预计影响：attributions 表启用；六参数中 SUSPECT_BASE/MAX_DEPTH/CONF_ADOPT 首次
    获得消费方（EXIT_* 三参数在步骤 6 chat 消费）。
  验证命令：七、7.3（重点：classify.test.ts 五类映射断言、attribution.test.ts
    嫌疑分上界 0.60/0.36 断言）。
  commit 建议：iter2 错误诊断 + 归因回溯/验证/反驳（ALGORITHM §4 服务端落地）。

步骤 6：处方 + 对话 SSE（接口 #17–#18，ALGORITHM §5 退出通道落地）
  目的：plan 策略枚举 + 巩固题序列；chat SSE 流式 + 状态机 + 弱负证据 + 提示阶梯。
  产出文件：
    functions/api/src/models/localChat.ts（新建 1）
    functions/api/src/services/{plan,chat}.ts（新建 2）
    functions/api/tests/{plan,chat}.test.ts（新建 2）
  准备修改的函数/模块：
    plan.ts：D15 策略映射 + 先修链拓扑序 + 难度递增取题 + path；
    chat.ts：chatStream(ctx, req) 返回 AsyncGenerator<SseEvent>（delta 多段 → meta →
      done）；服务层状态机（consecutive_false 计数、第 2 轮 hint_down、第 3 轮
      give_solution+exit_channel 合并、EXIT_UPSTREAM_THRESHOLD 最近上游跳转、
      MAX_EXIT_HOPS、blocked_by_prerequisite 写入、applyWeakNegative + silent 证据 +
      dedup）；dialogs upsert（messages 全量留痕）；server.ts 的 SSE 写出器对接；
      JSON 降级路径（D11）。
  预计影响：dialogs 表启用；EXIT_UPSTREAM_THRESHOLD/MAX_EXIT_HOPS/CONSEC_FALSE_EXIT/
    ALPHA_SILENT 四参数获得消费方——至此 §0 十七参数全部有消费方。
  验证命令：七、7.3 + 7.7（SSE curl 演示，需 7.4 构建后起服务）。
  commit 建议：iter2 处方生成 + 对话 SSE 与退出通道状态机（ALGORITHM §5 落地）。

步骤 7：报告 + 集成闭环测试（接口 #19 + 全链路验证）
  目的：report/summary 收口；真实 HTTP + fetch 的闭环集成测试（含 answer 不下发
    全局断言）。
  产出文件：
    functions/api/src/services/report.ts（新建 1）
    functions/api/tests/{report,closedLoop}.test.ts（新建 2）
  准备修改的函数/模块：
    report.ts：D12 规则（全 20 节点 + masteryToBand + gaps + accuracy 按 mode 分组）；
    closedLoop.test.ts：在随机端口起真实 server（复用 server.ts 导出的工厂函数），
      fetch 驱动全链路：register → self-report（二次函数 level 2）→ diagnose 若干题
      （错答用 distractor 答案制造 prerequisite_gap 证据）→ paper 上传+确认 →
      classify（命中 distractor）→ attribution/analyze → verify（答错至全排除回落
      与答对确认两条子场景）→ plan/generate → baseline 3 题（retest 池）→ retest
      3 题（另题）→ report/summary 断言 ΔAccuracy>0；对全程捕获的全部响应 JSON
      字符串断言不含 "answer" 与 "solution_steps" 键（序列化白名单的全局验证）；
      另含 403 越权（B 用户 token 访问 A 空间）与 SSE 流（fetch 流式读 event 序列）。
  预计影响：19 接口全部挂载完毕，路由表闭合（19/19）。
  验证命令：七、7.3（全量）+ 7.5（curl 全接口演示）。
  commit 建议：iter2 学习报告 + 闭环集成测试（19 接口齐备）。

步骤 8：题库复算固化 + 全量回归 + 交付留痕（MINOR-④ 收尾）
  目的：scripts/verify_items.py 入库；全量闸门一次性跑绿；git 留痕。
  产出文件：
    /Users/Merryou/LearnBuddy/zhiwei/scripts/verify_items.py（新建，MINOR-④：
      仅标准库；按题干模板族解析系数并独立重算（覆盖迭代 1 复算脚本已验证的族：
      顶点坐标/对称轴/最值/取最值时的 x/判别式/方程解/与 x 轴交点及个数/与 y 轴交点/
      因式分解/配方补项/顶点式互化/单步平移/线段长/三角形面积/待定系数三点反代），
      与 answer 比对；同时校验 fill/short_answer 的 solution_steps 末步包含 answer；
      不一致 → 逐题打印定位并 exit=1；覆盖率仅报告不阻断（目标 ≥80 题））
  具体动作：
    a. 运行 7.6（validate_data.py + verify_items.py 双闸门）；
    b. 运行 7.2→7.4→7.3→7.5→7.7 全量回归；
    c. 范围自查（grep）：functions/api 与 packages 中无真实模型 HTTP 调用
       （fetch/axios/openai/api_key 等仅允许出现在注释与桩文件）；apps/web 零改动；
       5 份需求文档零改动（git diff 验证）；
    d. 按批次补齐 commit（若步骤 1–7 已逐批提交则本步仅收尾提交）；
    e. 执行报告写入 _pipeline/02_EXEC_REPORT.md（覆盖更新前先归档旧版至
       _pipeline/archive/，归档命名规则同 01_PLAN）——本条为 implementer 指引，
       归档动作同样只增不删。
  验证命令：七、全部。

-------------------------------------------------
六、涉及文件清单（完整路径，新建/修改标注）
-------------------------------------------------

  新建（functions/api，src 28 + tests 12 + tsconfig 1 = 41 项）：
    functions/api/tsconfig.json
    functions/api/src/server.ts
    functions/api/src/router.ts
    functions/api/src/context.ts
    functions/api/src/errors.ts
    functions/api/src/ids.ts
    functions/api/src/grading.ts
    functions/api/src/serialization.ts
    functions/api/src/db/types.ts
    functions/api/src/db/jsonStore.ts
    functions/api/src/db/cloudbaseStore.ts
    functions/api/src/db/index.ts
    functions/api/src/models/types.ts
    functions/api/src/models/localClassify.ts
    functions/api/src/models/localRecognize.ts
    functions/api/src/models/localChat.ts
    functions/api/src/models/index.ts
    functions/api/src/data/staticData.ts
    functions/api/src/attribution/attributionCore.ts
    functions/api/src/services/auth.ts
    functions/api/src/services/space.ts
    functions/api/src/services/selfReport.ts
    functions/api/src/services/diagnose.ts
    functions/api/src/services/paper.ts
    functions/api/src/services/classify.ts
    functions/api/src/services/attribution.ts
    functions/api/src/services/plan.ts
    functions/api/src/services/chat.ts
    functions/api/src/services/report.ts
    functions/api/tests/helpers.ts
    functions/api/tests/auth.test.ts
    functions/api/tests/space.test.ts
    functions/api/tests/selfReport.test.ts
    functions/api/tests/diagnose.test.ts
    functions/api/tests/paper.test.ts
    functions/api/tests/classify.test.ts
    functions/api/tests/attribution.test.ts
    functions/api/tests/plan.test.ts
    functions/api/tests/chat.test.ts
    functions/api/tests/report.test.ts
    functions/api/tests/closedLoop.test.ts

  新建（其他）：
    scripts/verify_items.py                                              （MINOR-④）

  修改（7 项，全部有明确授权依据）：
    package.json（根）            scripts + devDependencies（MINOR-②，步骤 1）
    .gitignore                    + data/local_db/ + functions/api/dist/（步骤 1）
    functions/api/package.json     元数据更新（步骤 1）
    functions/api/src/index.ts     空入口 → CloudBase 薄适配层（步骤 1，D1）
    packages/engine/src/selection.ts    可选 stopReason + 注释（MINOR-⑤，步骤 3，D8/D9）
    packages/engine/tests/selection.test.ts  +2 边界用例（MINOR-①，步骤 3）
    data/item_bank/math/cz.json    q_cz_opening_010 answer 补全（MINOR-③，步骤 3）

  运行时生成（不提交，.gitignore 覆盖）：
    functions/api/dist/（esbuild 产物）
    data/local_db/*.json（本地 DB）

  归档（只增不删）：
    _pipeline/archive/01_PLAN_20260919_1657.md（本计划写入前已完成）
    _pipeline/archive/02_EXEC_REPORT_YYYYMMDD_HHMM.md（步骤 8e，implementer 执行）

  明确不动：apps/web 全部、packages/engine 其余源码与测试、config/params.json、
  data/knowledge/*、data/item_bank 除 MINOR-③ 单题外的全部内容、
  scripts/validate_data.py、5 份需求文档。

-------------------------------------------------
七、测试与验证命令（全部真实可运行）
-------------------------------------------------

  环境常量（下文以 $NODE/$NPM/$WS/$PY 简写，实际执行须展开完整路径）：
    $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
    $NPM  = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm
    $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
    $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
    （隔离 workspace 已存在；所有安装禁 -g）

7.1 依赖安装（步骤 1 前置；@types/node@22.7.5 迭代 1 已装，本次仅补 esbuild）
    cd /Users/Merryou/.workbuddy/binaries/node/workspace && /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm install --no-fund --no-audit esbuild@0.21.5
    预期：安装成功 exit=0；$WS/node_modules/esbuild/bin/esbuild 存在。

7.2 类型检查（每批次收尾必跑）
    cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json && $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
    预期：两段均无输出、exit=0。

7.3 全量单元/接口测试（每批次收尾必跑；引擎 36+2 用例不得回归）
    cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/vitest/vitest.mjs run
    预期：Test Files 全部 passed；引擎两个文件 ≥38 例（36+新增 2）全过；
          functions/api/tests 各文件全过。分批验证时可用：
    $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests/diagnose.test.ts
    （vitest 支持按文件路径过滤；后续批次同理替换文件名）

7.4 本地 server 构建
    cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/esbuild/bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
    预期：打印 bundle 字节数、exit=0，生成 functions/api/dist/server.js。
    （等价 npm script：npm run build:api —— 走 node_modules/.bin，二选一）

7.5 启动与接口探活（演示路径；每批新增接口后可重复使用）
    cd /Users/Merryou/LearnBuddy/zhiwei && ZHIWEI_API_PORT=8787 $NODE functions/api/dist/server.js &
    sleep 1
    curl -s -X POST http://localhost:8787/api/auth/register -H 'Content-Type: application/json' -d '{"identifier":"13800000000","password":"secret123","nickname":"小林"}'
    预期：{"code":0,…,"data":{"user_id":"u_…","token":"…"}}，且 data/local_db/users.json 生成。
    curl -s http://localhost:8787/api/space/list
    预期：{"code":401,…}（未带 token）。
    TOKEN=<上一步返回的 token>; curl -s http://localhost:8787/api/space/list -H "Authorization: Bearer $TOKEN"
    预期：{"code":0,…,"data":{"spaces":[…默认空间…]}}。
    curl -s http://localhost:8787/api/nonexistent
    预期：{"code":404,…}（路由 404 JSON 形态）。
    验证后 kill %1 终止后台进程（演示与联调期间可保持运行）。

7.6 数据闸门（步骤 3 改题库后、步骤 8 收尾必跑）
    cd /Users/Merryou/LearnBuddy/zhiwei && $PY scripts/validate_data.py; echo "exit=$?"
    预期：8 行 [PASS]、WARN 0、exit=0（MINOR-③ 改动后仍须全绿）。
    $PY scripts/verify_items.py; echo "exit=$?"
    预期：打印覆盖题数（目标 ≥80）与"不一致 0 题"、exit=0（步骤 8 起纳入）。

7.7 SSE 演示（步骤 6 完成后）
    （服务已按 7.5 启动，TOKEN/SPACE_ID 已取得）
    curl -sN -X POST http://localhost:8787/api/agent/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"space_id":"'"$SPACE_ID"'","message":"二次函数的顶点式我不会"}'
    预期：响应头含 Content-Type: text/event-stream；正文依次出现
          event: delta（≥1 段）→ event: meta（含 kp_match 与 progress 字段）→
          event: done。
    JSON 降级路径：
    curl -s -X POST http://localhost:8787/api/agent/chat -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -H 'Accept: application/json' -d '{"space_id":"'"$SPACE_ID"'","message":"顶点式怎么配"}'
    预期：普通 JSON，data 含 reply 全文与 meta（无 event: 前缀）。

7.8 全量回归（步骤 8 交付前一次性执行，依序）
    7.1（幂等可省）→ 7.2 → 7.4 → 7.3 → 7.5 → 7.6 → 7.7，全绿即交付。

-------------------------------------------------
八、风险与回滚方案
-------------------------------------------------

8.1 风险矩阵
  R1 判分规则与真实作答风格不匹配（概率：高；影响：中——闭环演示中学生自由作答
     判为 wrong）
     缓解：D10 归一化规则覆盖全角/空白/大小写/标点；演示与测试统一用"标准答案原文
     或 distractor 答案"作答（数据侧已保证 distractor 是真实错误路径值）；规则表
     集中在 grading.ts 单文件，后续加规则只改一处。
     回滚：规则放宽仅需改 normalize 函数；不影响存储与事件结构。

  R2 dedup 幂等与测评推进冲突（概率：中；影响：高——测评闭环卡死）
     缓解：D7 事件级幂等裁决（dedup_key + item_id 双匹配），diagnose.test.ts 专项
     断言"同 kp 第二道不同题同小时正常计分"；键格式仍逐字遵循 ALGORITHM。
     回滚：如评审否决 D7，改回键单独命中仅需改 diagnose.ts/paper.ts 各一处判断，
     事件与日志结构不变。

  R3 引擎增补破坏 36 用例（概率：低；影响：高——迭代 1 验收成果回归）
     缓解：stopReason 为可选字段、纯增量；剪枝口径仅注释；7.3 每批次全量回归，
     引擎两测试文件是硬门槛。
     回滚：git revert 步骤 3 中引擎两个文件的变更即可（API 侧 stopReason 消费点
     仅日志与测试断言，revert 后编译仍通过）。

  R4 SSE 在本地 Node server 的兼容问题（概率：低；影响：中——chat 演示降级）
     缓解：server.ts 手写 chunked 写出（res.write + flushHeaders），不依赖框架；
     AsyncGenerator 设计使 SSE 逻辑可在无网络环境直接测试；JSON 降级路径（D11）
     保证"禁止白屏"。
     回滚：降级路径即回滚方案——前端与演示可全程走 JSON 模式。

  R5 本地模型模拟与真实模型行为偏差（概率：确定存在；影响：低——迭代目标本就
     是"本地确定性跑通闭环"）
     缓解：ModelAdapter 接口隔离，后处理纪律（CONF_ADOPT/映射表/枚举校验）在服务层
     与适配器解耦——换真实模型不动后处理；桩内注释标明接入点。
     回滚：不适用（无真实模型即无回归面）；接模型属后续迭代。

  R6 JSON 文件存储损坏 / 并发写覆盖（概率：低——单演示用户；影响：中）
     缓解：LocalJsonStore 写入用"临时文件 + rename"原子替换；不做并发锁（ALGORITHM
     §8 明确不做）；data/local_db/ 随时可删重建（演示数据非资产）。
     回滚：删除 data/local_db/ 目录即恢复出厂状态。

  R7 范围蔓延（概率：中；影响：高——里程碑失守）
     缓解：一、1.2 排除清单 + 步骤 8c 的 grep 范围自查（真实模型调用/前端页面/文档
     修改零命中）；implementer 发现"顺手可做"的排除项必须停下并在执行报告留痕，
     不得自行实现。
     回滚：越界产物按 git 单文件 revert。

  R8 契约理解偏差导致字段名错误（概率：中；影响：高——联调事故）
     缓解：三、逐接口规格全部从 API_CONTRACT v1.1 逐字转录字段名；测试断言响应
     键名集合（closedLoop 全程响应捕获）；发现契约内部矛盾按优先级裁决并留痕，
     禁止改契约、禁止发明字段。

8.2 总体回滚策略
  - 每批次独立 commit（步骤 1–8 各一条），任何批次出问题 git revert 该批次提交，
    不级联（批次间仅通过 router 挂载点与 Store 接口耦合，均为增量）。
  - data/local_db/ 与 functions/api/dist/ 为可再生产物，删除即"回滚数据"。
  - 引擎与题库的修改（步骤 3）独立成 commit，可单独 revert 而不影响 API 主体。
  - 最坏情况整体回滚：revert 迭代 2 全部提交 → 回到迭代 1 PASS 状态（HEAD 666a52f
    之后追加归档文件除外，归档只增不删）。

-------------------------------------------------
九、验收清单（与 PRD §2 P0 接口侧对齐 + MINOR 清偿 + 引擎不回归）
-------------------------------------------------

  P0 接口侧（PRD §2 对齐）：
  [ ] P1（#1 极简认证）register 自动建默认空间；token 无状态可用；409/401 行为正确
  [ ] P2（#2 自报）章节 5 档 ≤6 项 → mastery_profiles 落 p_l0；evidence_count>0 不覆盖
  [ ] P3（#3 测评收敛即停）不出已做题、diagnose 不回传 correct、converged=true 时
      item=null（V<CONV_VAR 或 ≥MAX_ITEMS）
  [ ] P4（#4 试卷确认流）上传→识别→回显→确认批量更新；unclear 未手标 → 400；
      重复确认 → 409
  [ ] P5（#5 BKT 幂等留痕）三段式复用引擎；重复提交不重复扣分（D7 事件级幂等）；
      mastery_logs 全字段留痕（含弱负证据路径 D13）
  [ ] P6（#6 错误诊断）五类枚举；confidence<0.6 → clarify；direction 服务端硬编码映射；
      matched 限定该 kp codes
  [ ] P7（#7 归因）procedural_slip/misreading → 400 不进归因；self 不回溯；upstream
      回溯 + 验证题 + 全排除诚实回落；suspect_scores 符合公式上界
  [ ] P8（#8 对话 SSE 退出通道）SSE 流式；2 次答不上 hint_down、3 次给完整解法并
      exit_channel；连续 3 轮 false 触发退出（blocked_by_prerequisite + 上游跳转
      ≤MAX_EXIT_HOPS）
  [ ] P11（#11 复测闭环接口侧）baseline/retest 同池不同题、mode 分组统计、
      ΔAccuracy = retest−baseline 可算且闭环测试断言 >0

  MINOR 清偿（03_REVIEW §5.3 五条）：
  [ ] M1 收敛取等边界用例入库（S6c/S6d 双侧夹逼，±1e-9，含取等不可精确表示的注释）
  [ ] M2 根 package.json devDependencies 含 @types/node@22.7.5
  [ ] M3 q_cz_opening_010 answer 含单调性结论，与 solution_steps 末步一致；7.6 全绿
  [ ] M4 scripts/verify_items.py 入库，独立重算不一致 0、覆盖 ≥80 题
  [ ] M5 stopReason 区分 variance/max_items/no_items（D8）+ 剪枝口径注释（D9）

  工程纪律：
  [ ] E1 19 接口全部实现且路由闭合（19/19，三、清单逐项可勾）
  [ ] E2 错误码表全接口共用且不扩展（契约 §0 九个码）
  [ ] E3 space_id 归属校验：跨用户访问 → 403（closedLoop 断言）
  [ ] E4 时间 ISO8601 UTC；ID 前缀正确；知识点完整 id（测试断言）
  [ ] E5 answer/solution_steps 零下发（toClientItem 白名单 + closedLoop 全响应断言）
  [ ] E6 引擎 36+2 用例全过（7.3）；packages/engine 除 D8/D9 授权改动外零变更
  [ ] E7 5 份需求文档、apps/web、config/params.json 零改动（git diff 验证）
  [ ] E8 `npm run api`（7.4+7.5）一键起服务，curl 全流程可演示；SSE（7.7）与 JSON
      降级双通路可演示
  [ ] E9 无真实模型调用 / 云 SDK 调用 / 云部署动作（grep 自查仅注释命中）
  [ ] E10 每批次独立 commit；data/local_db/ 与 dist/ 未入库

-------------------------------------------------
十、附：implementer 执行提示
-------------------------------------------------

  1. 执行顺序严格按步骤 1→8；每批次收尾跑 7.2 + 7.3（+ 该批相关命令）并 commit，
     一次中断后从上一批次终点续跑，不重复已完成批次。
  2. 所有命令中的 $NODE/$NPM/$WS/$PY 必须展开为 七、开头的完整路径后再执行；
     依赖只装隔离 workspace，禁 -g。
  3. services 层 import 引擎一律相对路径（如
     import { nextItem } from '../../../packages/engine/src/index'），不得复制引擎
     代码、不得在 functions/api 内重写 BKT/选题/dedup 逻辑。
  4. 每个接口的字段名以 API_CONTRACT v1.1 逐字为准；发现契约与 ALGORITHM/
     DATA_SCHEMA/PRD 冲突：按 一、1.3 优先级自行裁决，写入执行报告偏差清单
     （格式：冲突原文 / 裁决 / 理由），禁止提问、禁止静默假设、禁止修改契约。
  5. 测试中的用户输入统一用标准答案原文或 distractors[].answer（题库已保证后者是
     真实错误路径值），不要发明题库里不存在的作答文本。
  6. 涉及 data/local_db/ 的演示数据可随时删除重建；不要把演示数据当作资产提交。
  7. 本计划未授权的任何文件（含 5 份需求文档、apps/web、config/params.json）一律
     不得修改；packages/engine 仅允许 六、清单列明的 2 处授权改动。
