知微 · 迭代 2「后端 19 接口 + MINOR 清偿」执行报告
=================================================
报告编号：02_EXEC_REPORT（第 2 版）
执行日期：2026-09-19
执行依据：_pipeline/01_PLAN.md（迭代 2 版，984 行，唯一执行依据，未修改）
工作区：/Users/Merryou/LearnBuddy/zhiwei/（git main 分支）
执行者角色：收尾补写（代码实现已由前序执行完成；本轮只做核对现状、跑全量回归取真实输出、
            补写本报告、commit；未修改任何业务代码）

说明：本报告为纯文本，不依赖 markdown 渲染。
说明：本报告中每一个数字均来自本轮实际运行的命令输出，未照抄旧报告、未凭空填写。
      （运行环境常量：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node；
        $WS=/Users/Merryou/.workbuddy/binaries/node/workspace；
        $PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3）

归档记录（只增不删，动作已执行）：
  旧版执行报告（迭代 1 版，mtime 20260919_1525）已复制归档为
    _pipeline/archive/02_EXEC_REPORT_20260919_1525.md（29541 字节）
  迭代 1 计划归档 _pipeline/archive/01_PLAN_20260919_1657.md 保持原样。
  归档仅新增副本，未删除、未修改任何旧文件。

-------------------------------------------------
一、逐批次执行结果表
-------------------------------------------------

批次 / 状态 / 提交号 / 该提交文件变动 / 偏差
  步骤 1 工程基座（路由骨架 + DB 层 + 双入口）
    状态：完成
    提交号：cf21111
    文件变动：20 files changed, 3754 insertions(+), 566 deletions(-)
    偏差：无
  步骤 2 认证 + 空间（#1–#5）
    状态：完成
    提交号：7689970
    文件变动：6 files changed, 708 insertions(+)
    偏差：无
  步骤 3 自报 + 测评 + 引擎 MINOR 清偿（#6–#8，MINOR-①③⑤）
    状态：完成
    提交号：441185f
    文件变动：8 files changed, 989 insertions(+), 5 deletions(-)
    偏差：无
  步骤 4 模型适配层 + 试卷三接口（#9–#11）
    状态：完成
    提交号：895fa45
    文件变动：6 files changed, 864 insertions(+)
    偏差：无
  步骤 5 classify + 归因四接口（#12–#16）
    状态：完成
    提交号：3456775
    文件变动：8 files changed, 1238 insertions(+), 4 deletions(-)
    偏差：无
  步骤 6 处方 + 对话 SSE（#17–#18）
    状态：完成
    提交号：e97853c
    文件变动：5 files changed, 611 insertions(+), 5 deletions(-)
    偏差：本批的 plan/chat 测试用例未随本批提交，被拆到下一步独立提交（见偏差 D3）
  步骤 6b 处方 + 对话模块测试（额外提交）
    状态：完成
    提交号：24cb6ec（提交信息：iter2 处方+对话模块测试（chat 11 用例 / plan 6 用例，全套 101 绿））
    文件变动：2 files changed, 501 insertions(+)
    偏差：计划为 8 批次，实际 9 个提交，本提交为步骤 6 的测试拆分（见偏差 D3）
  步骤 7 报告 + 集成闭环测试（#19 + 全链路）
    状态：完成
    提交号：8e8901a
    文件变动：4 files changed, 893 insertions(+)
    偏差：无
  步骤 8 题库复算固化 + 全量回归 + 交付留痕（MINOR-④）
    状态：完成
    提交号：99f8333
    文件变动：1 file changed, 814 insertions(+)
    偏差：无

批次小结：8 个计划批次全部完成（状态均为「完成」），因步骤 6 测试独立提交，实际形成 9 个
迭代 2 提交。19 个接口在步骤 7 结束时挂载闭合。

-------------------------------------------------
二、19 接口实现状态清单
-------------------------------------------------

列义：路由 → router.ts 挂载位（行号）→ 服务文件 → 测试文件（用例数为测试文件级，
      因实现按 service 分组而非按 route 拆分；closedLoop 为跨接口集成，不重复计入）

  #1  POST   /api/auth/register                    → router.ts:75  → services/auth.ts        → tests/auth.test.ts        (11)
  #2  POST   /api/auth/login                       → router.ts:76  → services/auth.ts        → tests/auth.test.ts        (11)
  #3  GET    /api/space/list                       → router.ts:77  → services/space.ts       → tests/space.test.ts       (10)
  #4  POST   /api/space/create                     → router.ts:78  → services/space.ts       → tests/space.test.ts       (10)
  #5  GET    /api/space/:spaceId/drive             → router.ts:79  → services/space.ts       → tests/space.test.ts       (10)
  #6  POST   /api/evidence/self-report             → router.ts:82  → services/selfReport.ts  → tests/selfReport.test.ts  (8)
  #7  POST   /api/diagnose/next                    → router.ts:83  → services/diagnose.ts    → tests/diagnose.test.ts    (16)
  #8  POST   /api/diagnose/submit                  → router.ts:84  → services/diagnose.ts    → tests/diagnose.test.ts    (16)
  #9  POST   /api/evidence/paper                   → router.ts:88  → services/paper.ts       → tests/paper.test.ts       (15)
  #10 GET    /api/evidence/paper/:recognitionId    → router.ts:90  → services/paper.ts       → tests/paper.test.ts       (15)
  #11 POST   /api/evidence/paper/confirm           → router.ts:89  → services/paper.ts       → tests/paper.test.ts       (15)
  #12 POST   /api/error/classify                   → router.ts:94  → services/classify.ts    → tests/classify.test.ts    (8)
  #13 POST   /api/attribution/analyze              → router.ts:95  → services/attribution.ts → tests/attribution.test.ts (14)
  #14 GET    /api/attribution/:attributionId       → router.ts:98  → services/attribution.ts → tests/attribution.test.ts (14)
  #15 POST   /api/attribution/verify               → router.ts:96  → services/attribution.ts → tests/attribution.test.ts (14)
  #16 POST   /api/agent/reject                     → router.ts:97  → services/attribution.ts → tests/attribution.test.ts (14)
  #17 POST   /api/plan/generate                    → router.ts:101 → services/plan.ts        → tests/plan.test.ts        (8)
  #18 POST   /api/agent/chat                       → router.ts:102 → services/chat.ts        → tests/chat.test.ts        (11)
  #19 GET    /api/report/summary                   → router.ts:105 → services/report.ts      → tests/report.test.ts      (6)

  跨接口集成：tests/closedLoop.test.ts (5)（真实 HTTP + fetch 全链路，含 SSE 与 403 越权）

实现状态：19/19 全部已挂载且本轮实时探活全部返回预期（见 三、7.5-19 接口）。
用例数汇总核对：11+10+8+16+15+8+14+8+11+6 = 107，加 closedLoop 5 = 112（与 7.3 的 api 侧
112 用例逐字吻合）。
注册顺序要点（router.ts 内注释与实现一致）：
  /api/evidence/paper/confirm（88 静态段）先于 /api/evidence/paper/:recognitionId（90 参数段）；
  /api/attribution/analyze(95)、/verify(96) 先于 /api/attribution/:attributionId(98)。

-------------------------------------------------
三、验证命令实际输出摘要（计划 七、7.1–7.8）
-------------------------------------------------

编号说明（偏差 D2）：任务书对 7.x 的编号与计划文件不一致。本报告以**计划文件 七、**的
官方编号为准（7.1 依赖 / 7.2 类型检查 / 7.3 全量测试 / 7.4 构建 / 7.5 探活 / 7.6 数据闸门 /
7.7 SSE / 7.8 全量回归），并在括号内标注任务书等价项，两边都可对号入座。

7.1 依赖核对（任务书「依赖核对」）
  ts=typescript 5.5.4；vitest 2.1.1；esbuild 0.21.5；@types/node 22.7.5
  根 package.json devDependencies 含 "@types/node": "22.7.5"、"esbuild": "0.21.5"（MINOR-②）
  scripts 含 api / build:api / typecheck / typecheck:all（见 六、②）
  结果：通过（依赖齐备，无缺件）

7.2 类型检查（两段）
  命令：$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
        → exit=0（无任何输出）
        $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
        → exit=0（无任何输出）
  结果：两段均通过

7.3 全量 vitest
  命令：$NODE $WS/node_modules/vitest/vitest.mjs run
  输出（尾部摘要）：
    Test Files  13 passed (13)
         Tests  150 passed (150)
      Start at  18:12:13
      Duration  3.75s (transform 1.31s, setup 0ms, collect 3.81s, tests 15.07s, environment 4ms, prepare 1.50s)
    VITEST_EXIT=0
  逐文件用例数（来自同一输出）：
    packages/engine/tests/selection.test.ts   18
    packages/engine/tests/bkt.test.ts         20            → 引擎小计 38
    functions/api/tests/attribution.test.ts   14
    functions/api/tests/auth.test.ts          11
    functions/api/tests/chat.test.ts          11
    functions/api/tests/classify.test.ts       8
    functions/api/tests/closedLoop.test.ts     5
    functions/api/tests/diagnose.test.ts      16
    functions/api/tests/paper.test.ts         15
    functions/api/tests/plan.test.ts           8
    functions/api/tests/report.test.ts         6
    functions/api/tests/selfReport.test.ts     8
    functions/api/tests/space.test.ts         10            → api 小计 112
  核对：引擎 38（36 基线 + 2 新增 S6c/S6d，未回归）+ api 112 = 150，与预期一致。
  结果：通过（0 失败）

7.4 本地 server 构建（任务书未单列）
  计划字面命令：$NODE $WS/node_modules/esbuild/bin/esbuild functions/api/src/server.ts --bundle
                --platform=node --format=cjs --outfile=functions/api/dist/server.js
  实测（字面命令）：SyntaxError: Invalid or unexpected token（exit=1）
    原因：$WS/node_modules/esbuild/bin/esbuild 经 `file` 判定为
          「Mach-O 64-bit executable arm64」原生可执行文件，不是 JS，不能用 $NODE 解释执行。
  改用计划同时授权的等价路径（七、7.4 括注「走 node_modules/.bin，二选一」）：
    $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node
    --format=cjs --outfile=functions/api/dist/server.js
    输出：functions/api/dist/server.js  91.5kb   ⚡ Done in 16ms   DIRECT_EXIT=0
    产物：functions/api/dist/server.js 93660 字节（先 rm 后重建，确认为本轮真实产物）
  结果：通过（见偏差 D1）

7.5 启动与接口探活（任务书「19 路由抽样」）
  启动：ZHIWEI_API_PORT=8787 $NODE functions/api/dist/server.js
       → [zhiwei-api] listening on http://localhost:8787 / [zhiwei-api] ready (port=8787)
  计划样例四条：
    POST /api/auth/register {"identifier":"13800000000","password":"secret123","nickname":"小林"}
      → {"code":0,"msg":"success","data":{"user_id":"u_mu88bpyc01tbz","token":"eyJ1c2VyX2lkIjoi…"}}
    GET /api/space/list（无 token）
      → {"code":401,"msg":"缺少 Authorization 请求头","data":null}
    GET /api/space/list（带 token）
      → {"code":0,"msg":"success","data":{"spaces":[{"space_id":"sp_mu88bpzo029v6","name":"初中数学",
        "subject":"数学","knowledge_source":["kb_math_cz"],"is_default":true,"created_at":"2026-09-19T10:13:13Z"}]}}
    GET /api/nonexistent
      → {"code":404,"msg":"接口不存在：GET /api/nonexistent","data":null}
    副作用核对：data/local_db/ 生成 users.json + spaces.json
  追加（19 接口全量实时探活，一次连续会话，23 条请求全绿；服务起后即测、测毕杀进程）：
    #1  register(A)                HTTP 200 code=0   user_id u_mu88df0c013i7
    #1b register(B)                HTTP 200 code=0   user_id u_mu88df1z03t9c
    #2  auth/login                 HTTP 200 code=0
    #3  space/list                 HTTP 200 code=0   space_id sp_mu88df1m02kvz（默认空间「初中数学」）
    #4  space/create               HTTP 409 code=409 data.existing_space_id=sp_mu88df1m02kvz（同学科预期 409）
    #5  space/:id/drive            HTTP 200 code=0   files: file_preset_001…（预置 2 条）
    #6  self-report（level 3）      HTTP 200 code=0   updated=11
    #7  diagnose/next              HTTP 200 code=0   item=q_cz_geometry_001，remaining=10，converged=false
    #8  diagnose/submit（distractor）HTTP 200 code=0 correct=null，mastery 0.5→0.24444444444444446（w=1.0）
    #7b diagnose/next(2)           HTTP 200 code=0   item=q_cz_applic_001（与第 1 题不同题=true），remaining=9
    #9  evidence/paper             HTTP 200 code=0   recognition_id=rec_mu88df5j079am，status=pending_confirm
    #10 evidence/paper/:recId      HTTP 200 code=0   识别 3 条，其中 unclear 1 条
    #11 evidence/paper/confirm     HTTP 200 code=0   events_created=3，mastery_updates 有值
    #12 error/classify             HTTP 200 code=0   status=adopted，error_type=concept_confusion，matched 有值
    #13 attribution/analyze        HTTP 200 code=0   root_cause=math.cz.function.graph，
                                                     path=["math.cz.quadratic.vertex_form","math.cz.function.graph"]，
                                                     verification_item=q_cz_func_graph_001
    #14 attribution/:attrId        HTTP 200 code=0   字段与 analyze 一致
    #15 attribution/verify（答错）  HTTP 200 code=0   verified=false，correct=false，
                                                     next_candidate.kp_id=math.cz.quadratic.completing_square
    #16 agent/reject               HTTP 200 code=0   verification_item.item_id=q_cz_identity_001
    #13b attribution/analyze(2)    HTTP 200 code=0   attr_mu88df670hn25
    #15b attribution/verify（答对）HTTP 200 code=0   verified=true，correct=true，next_candidate=null
    #17 plan/generate              HTTP 200 code=0   strategy="先补上游 + 上游讲解"（prerequisite_gap 映射）
    #19 report/summary             HTTP 200 code=0   mastery 全节点，status_band="待巩固"
    E3  B token 访问 A 空间        HTTP 403 code=403 {"msg":"无权访问该空间"}
    E2  无 token 打受保护接口      HTTP 401 code=401
    E5  白名单抽查                 含 "answer"/"solution_steps" 的响应数 = 0
  结果：通过（19/19 实时可调用；403/401 越权路径符合预期）

7.6 数据闸门（任务书「validate_data.py」「verify_items.py」）
  a) $PY scripts/validate_data.py ; echo "exit=$?"
     输出 8 行 [PASS]（附加a params 17 键；校验 1 图谱结构；校验 2 typical_errors；校验 3 题库；
     校验 4 配额；校验 5 distractors 绑定；附加c sample_items；末行「全部阻断项通过」）；
     STATS：节点数 20，typical_errors 74，题库 228 题（train 104 + retest 124）；
     末行 [PASS] 全部阻断项通过（DATA_SCHEMA §6 校验 1–6 通过）
     VALIDATE_EXIT=0
  b) $PY scripts/verify_items.py ; echo "exit=$?"
     输出：题库总量 228 题；覆盖重算 86 题（目标 >= 80）；未覆盖 142 题；
          [PASS] 复算不一致 0 题；
          [PASS] fill/short_answer 的 solution_steps 末步均包含 answer；
          末行 [PASS] 题库复算通过（覆盖 86 题，不一致 0 题）。
     VERIFY_EXIT=0
  结果：两闸门均通过（validate 全绿；verify_items 覆盖 86≥80、不一致 0）

7.7 SSE 演示
  命令：curl -sN -X POST http://localhost:8787/api/agent/chat -H "Authorization: Bearer $TOKEN"
        -H 'Content-Type: application/json' -d '{"space_id":"…","message":"二次函数的顶点式我不会"}'
  响应头：Content-Type: text/event-stream; charset=utf-8（已验证）
  正文（原文摘录）：
    event: delta
    data: {"text":"我们先把「二次函数的顶点式」的定义过一遍：将 y=(x+2)^2+3 的顶点写成 (2,3)
          （括号内未取反）。你先按这个思路试一步，写完发我。"}
    event: meta
    data: {"dialog_id":"dlg_mu88cbt405ssl","kp_match":{"kp_id":"math.cz.quadratic.vertex_form",
          "confidence":0.85},"progress":false,"progress_reason":"学生仍未能给出有效一步",
          "next_action":"continue"}
    event: done
    data: {}
  事件序列断言：["delta","meta","done"]（顺序正确，delta ≥1 段）
  JSON 降级路径：
    请求头加 Accept: application/json → HTTP 200，Content-Type: application/json; charset=utf-8，
    code=0，data.reply 为字符串（全文）、data.meta 存在（无 event: 前缀）
  结果：通过（SSE 与 JSON 降级双通路均可演示）

7.8 全量回归 + 范围自查
  依序复跑 7.2 → 7.4 → 7.3 → 7.6 → 7.5 → 7.7，全部通过（数字见上）。
  范围自查（grep）：
    a) 真实模型 / 云 SDK 调用：grep -rnE "openai|api_key|apiKey|axios|@cloudbase/node-sdk|wx-server-sdk"
       functions/api/src packages/engine/src → 命中 3 处，全部为注释：
         functions/api/src/db/cloudbaseStore.ts:8（说明不引入 SDK）
         functions/api/src/db/cloudbaseStore.ts:11（注释标注 SDK 调用点）
         functions/api/src/index.ts:8（注释标注 SDK 初始化位置）
       实际调用 0 处（无 fetch(、无 SDK import）→ 符合 E9
    b) src 内 fetch( 命中 0 处（无真实网络模型调用）
    c) docs / apps/web / config / packages/engine/src/index.ts 相对 666a52f..HEAD 零改动
       （git diff --stat 输出为空）→ 符合 E7
  结果：通过

-------------------------------------------------
四、偏差清单（D 格式：现象 / 裁决 / 理由）
-------------------------------------------------

D1 计划 7.4 构建命令字面不可执行
  现象：计划字面 $NODE $WS/node_modules/esbuild/bin/esbuild … 报
        SyntaxError: Invalid or unexpected token（exit=1）。该路径经 file 判定为
        Mach-O 64-bit executable arm64（原生二进制），不能用 node 解释。
  裁决：改用计划 7.4 括注已授权的等价路径 $WS/node_modules/.bin/esbuild（或 npm run build:api）
        直接执行；构建成功（91.5kb，exit=0）。
  理由：计划自身给出「二选一」授权；字面命令为笔误（对原生二进制加了 $NODE 前缀），
        改用 .bin 与「npm run build:api」语义完全等价，未扩大范围、未改任何业务代码。

D2 任务书 7.x 编号与计划文件 7.x 编号不一致
  现象：任务书列 7.4=validate_data.py、7.5=verify_items.py、7.6=SSE、7.7=curl 探活、7.8=grep 自查；
        计划文件列 7.4=本地 server 构建、7.5=启动探活、7.6=数据闸门（validate+verify_items）、
        7.7=SSE、7.8=全量回归依序。
  裁决：以计划文件 七、 为权威编号组织本报告 三、，并逐项标注任务书等价项，两边映射齐备。
  理由：任务书明示「命令与环境常量见计划七、」；计划为唯一执行依据（本报告依据），
        以计划编号为准可避免后续复核对号错位。

D3 计划 8 批次，实际 9 个迭代 2 提交
  现象：步骤 6（e97853c）未随批提交其 plan/chat 测试用例，测试被拆到独立提交 24cb6ec。
  裁决：保留现状（视为步骤 6 = 实现 + 6b = 测试 的拆分），记录于此。
  理由：24cb6ec 内容属于步骤 6 交付面（处方 + 对话测试），未引入计划外文件或范围；
        每批独立可回滚的纪律未被破坏（8.2 仅要求「每批独立 commit」，拆分不违反）。
        未改动历史提交（改写历史风险大于收益，且总控已声明 8 批次均已 commit）。

D4 self-report level 2 后 diagnose/next 立即 converged=true（判定为非 bug，不改代码）
  现象：本轮探活先用「二次函数 level 2」自报，随后 diagnose/next 返回
        {"item":null,"remaining":10,"converged":true}，无法进入测评闭环。
  定位：level 2 → PRIOR_MAP=0.30，低于 PRUNE_THRESHOLD(0.4)，故「二次函数」11 节点因
        其直接先修未达标被拓扑剪枝（selection.ts:96-102）；剩余可测的根级 kp 掌握度=0
        → V = 0×(1−0) = 0 < CONV_VAR(0.1) → 按 selection.ts:131 返回 converged=true、
        stopReason='variance'。这与 P2「level 2 → 0.30」与 P3「V<CONV_VAR → converged」
        两条既有规格一致，是规则叠加的可预期结果，不是实现缺陷。
  旁证：closedLoop.test.ts:182 与 diagnose.test.ts:66 均用 level 3（0.50，V=0.25 且 ≥0.4）
        驱动闭环，与本判定自洽。
  裁决：不修改任何代码；把探针驱动参数改为 level 3（与既有测试一致）以演示闭环；
        同时记录 level 2 的 updated=11（验证 P2 断言成立，见 7.5 #6）。
  理由：修改引擎阈值或服务层会动摇迭代 1 已锁定的规格与 38 条引擎用例（8.1 R3 明确列为高影响），
        且计划未授权。此现象属「先验过低 → 诚实不可测」，语义正确。

D5 GET 打 POST 路由返回 code=404（msg「请求方法不被支持」）而非 405
  现象：GET /api/auth/login（该路径仅注册 POST）→ {"code":404,"msg":"请求方法不被支持：GET /api/auth/login"}。
  裁决：保持现状，不引入 405。
  理由：契约 §0 错误码表仅九个码，无 405；计划 一、(6) 明确「错误码表全接口共用（不扩展）」。
        以 404 承载「路径+方法不匹配」在既定码表内自洽，且 msg 已精确区分语义。

D6 新增文件数 44 ≠ 计划 42
  现象：git diff --diff-filter=A 于 666a52f..HEAD 列出 44 个新增文件。
  差异构成：42 项为计划文件（41 项 functions/api + scripts/verify_items.py，见 五、逐项核对）；
            另 2 项为流程留档：_pipeline/03_REVIEW.md、_pipeline/archive/01_PLAN_20260919_1657.md。
  裁决：视为合规（流程留档，非业务文件）。
  理由：二者均属 _pipeline 流水线产物（审查结论与旧计划归档），计划 六、「归档（只增不删）」
        与 二、2.1 的流水线约定允许存在；未新增任何计划外业务文件。

D7 修改文件数 8 ≠ 计划 7
  现象：git diff --diff-filter=M 列出 8 项修改。
  差异构成：计划 六、列明的 7 项修改全部命中（package.json / .gitignore /
            functions/api/package.json / functions/api/src/index.ts /
            packages/engine/src/selection.ts / packages/engine/tests/selection.test.ts /
            data/item_bank/math/cz.json）；第 8 项为 _pipeline/01_PLAN.md。
  裁决：视为合规。_pipeline/01_PLAN.md 的变更即「计划重写为迭代 2 版」本身（规划者动作），
        非 implementer 业务改动；计划 六、未将自身列入修改清单属表述惯例。
  理由：计划文件是执行依据，其版本更新为流程必需；本轮未修改 01_PLAN.md。

D8 提交信息与实际用例数不一致（历史提交措辞）
  现象：24cb6ec 提交信息记「chat 11 用例 / plan 6 用例，全套 101 绿」；本轮实测 plan.test.ts = 8、
        chat.test.ts = 11、全量 150。
  裁决：以本轮实跑数字为准（三、7.3），不追改历史提交信息。
  理由：plan.test.ts 在 24cb6ec 之后被后续批次增补至 8 例，提交信息记录的是提交当时状态，
        非错误；本轮报告已用当前真实数字覆盖，无信息断层。

-------------------------------------------------
五、计划文件清单核对（四、42 新建 + 7 修改）
-------------------------------------------------

A. 新建 42 项逐项核对（计划 六、清单 → 实际）
  functions/api/tsconfig.json                                    OK
  functions/api/src/server.ts                                    OK
  functions/api/src/router.ts                                    OK
  functions/api/src/context.ts                                   OK
  functions/api/src/errors.ts                                    OK
  functions/api/src/ids.ts                                       OK
  functions/api/src/grading.ts                                   OK
  functions/api/src/serialization.ts                             OK
  functions/api/src/db/types.ts                                  OK
  functions/api/src/db/jsonStore.ts                              OK
  functions/api/src/db/cloudbaseStore.ts                         OK
  functions/api/src/db/index.ts                                  OK
  functions/api/src/models/types.ts                              OK
  functions/api/src/models/localClassify.ts                      OK
  functions/api/src/models/localRecognize.ts                     OK
  functions/api/src/models/localChat.ts                          OK
  functions/api/src/models/index.ts                              OK
  functions/api/src/data/staticData.ts                           OK
  functions/api/src/attribution/attributionCore.ts               OK
  functions/api/src/services/auth.ts                             OK
  functions/api/src/services/space.ts                            OK
  functions/api/src/services/selfReport.ts                       OK
  functions/api/src/services/diagnose.ts                         OK
  functions/api/src/services/paper.ts                            OK
  functions/api/src/services/classify.ts                         OK
  functions/api/src/services/attribution.ts                      OK
  functions/api/src/services/plan.ts                             OK
  functions/api/src/services/chat.ts                             OK
  functions/api/src/services/report.ts                           OK
  functions/api/tests/helpers.ts                                 OK
  functions/api/tests/auth.test.ts                               OK
  functions/api/tests/space.test.ts                              OK
  functions/api/tests/selfReport.test.ts                         OK
  functions/api/tests/diagnose.test.ts                           OK
  functions/api/tests/paper.test.ts                              OK
  functions/api/tests/classify.test.ts                           OK
  functions/api/tests/attribution.test.ts                        OK
  functions/api/tests/plan.test.ts                               OK
  functions/api/tests/chat.test.ts                               OK
  functions/api/tests/report.test.ts                             OK
  functions/api/tests/closedLoop.test.ts                         OK
  scripts/verify_items.py                                        OK
  小计：42/42 OK，0 差异（src 28 + tests 12 + tsconfig 1 = 41，加 scripts/verify_items.py = 42）。

B. 修改 7 项逐项核对
  package.json（根）                       OK（scripts: api/build:api/typecheck/typecheck:all；
                                               devDependencies: @types/node 22.7.5、esbuild 0.21.5）
  .gitignore                              OK（+2 行：functions/api/dist/ 、data/local_db/）
  functions/api/package.json               OK（元数据更新；未新增 dependencies）
  functions/api/src/index.ts               OK（空入口 → CloudBase 薄适配层）
  packages/engine/src/selection.ts         OK（+19/-… ：可选 stopReason + D9 剪枝口径注释）
  packages/engine/tests/selection.test.ts  OK（+38 行，纯新增：S6c/S6d 两用例）
  data/item_bank/math/cz.json              OK（q_cz_opening_010 answer 补单调性结论）
  小计：7/7 OK，0 差异。

C. 运行时生成（不入库）核对
  functions/api/dist/      → git ls-files 无记录；git check-ignore 命中 .gitignore:4   OK
  data/local_db/*.json     → git ls-files 无记录；git check-ignore 命中 .gitignore:5   OK

D. 明确不动项核对
  apps/web / config / data/knowledge / scripts/validate_data.py / 5 份需求文档 / 
  packages/engine 其余源码与测试 → 相对 666a52f..HEAD 零改动（git diff --stat 为空）  OK

-------------------------------------------------
六、MINOR-① 至 ⑤ 清偿证据
-------------------------------------------------

① 收敛取等边界用例
   证据文件：packages/engine/tests/selection.test.ts（+38 行）
   新增用例（git diff 原文摘录）：
     it('S6c 取等边界（下侧）：V = CONV_VAR − 1e-9 → converged=true、stopReason="variance"', …)
     it('S6d 取等边界（上侧）：V = CONV_VAR + 1e-9 → 正常出题、stopReason 保持 undefined', …)
     // IEEE754 无法精确表示 0.10，故先按解析解反解 p = (1 − √(1 − 4V)) / 2，再以 ±1e-9 双侧夹逼
     expect(r.stopReason).toBe('variance');        // S6c
     expect(r.stopReason).toBeUndefined();         // S6d
   实测：selection.test.ts 由迭代 1 的 16 例增至 18 例（7.3 输出逐字为 (18)）→ 清偿 OK

② @types/node 写入根 package.json devDependencies
   证据：根 package.json devDependencies 含 "@types/node": "22.7.5"；隔离 workspace 实装
        版本号经 require 读取为 22.7.5（7.1）→ 清偿 OK

③ q_cz_opening_010 answer 完整性
   证据：git diff 显示 answer 由「开口向上，对称轴是直线 x = 2」改为
        「开口向上，对称轴是直线 x = 2，x < 2 时 y 随 x 增大而减小，x > 2 时 y 随 x 增大而增大」，
        且 solution_steps 末步同步改为「所以开口向上，对称轴是直线 x = 2，x < 2 时 y 随 x 增大而减小，
        x > 2 时 y 随 x 增大而增大。」
   运行时读回核对：answer 与 solution_steps 末步（去句末句号后）逐字一致。
   数据闸门：validate_data.py 全绿 + verify_items.py「solution_steps 末步均包含 answer」PASS → 清偿 OK

④ scripts/verify_items.py 固化题库复算
   证据：文件存在，814 行；顶部导入仅标准库（json / math / re / sys / pathlib / __future__），
        无第三方依赖；实测 exit=0，覆盖 86 题（目标 ≥80），复算不一致 0 题 → 清偿 OK

⑤ 「无题可出 vs 已收敛」语义区分 + 剪枝传递性口径
   证据（packages/engine/src/selection.ts，git diff 摘录）：
     stopReason?: 'variance' | 'max_items' | 'no_items';   （可选字段，向后兼容）
     三个终止出口各自标因：max_items / variance / no_items
     顶部注释补 D9 口径声明：「剪枝口径声明（D9）按直接先修判定：更上游的节点不达标不阻断本节点」
   用例断言（同一 selection.test.ts）：stopReason 分别为 'max_items'、'variance'、'no_items' 与 undefined
        （S6c/S6d + 既有出口断言），三值互不相同，区分成立。
   向后兼容核对：引擎 38 例（36 基线 + 2 新增）全过；契约 §4 响应未加字段（零下发变更）→ 清偿 OK

-------------------------------------------------
七、git commit 记录（迭代 2 全部条目）
-------------------------------------------------

  cf21111  iter2 基座：api 工程配置 + 路由/上下文/DB 适配层 + 双入口骨架
           20 files changed, 3754 insertions(+), 566 deletions(-)
  7689970  iter2 认证与空间：register/login + space list/create/drive（含 403 基座）
           6 files changed, 708 insertions(+)
  441185f  iter2 自报与测评闭环 + 引擎 stopReason/边界用例 + opening_010 答案补全
           8 files changed, 989 insertions(+), 5 deletions(-)
  895fa45  iter2 模型适配层接口 + 试卷上传/回显/确认流
           6 files changed, 864 insertions(+)
  3456775  iter2 错误诊断 + 归因回溯/验证/反驳（ALGORITHM §4 服务端落地）
           8 files changed, 1238 insertions(+), 4 deletions(-)
  e97853c  iter2 处方生成 + Agent 对话（chatTurn 本地适配器装配，步骤 6）
           5 files changed, 611 insertions(+), 5 deletions(-)
  24cb6ec  iter2 处方+对话模块测试（chat 11 用例 / plan 6 用例，全套 101 绿）
           2 files changed, 501 insertions(+)
  8e8901a  iter2 学习报告 + 闭环集成测试（19 接口齐备）
           4 files changed, 893 insertions(+)
  99f8333  iter2 题库复算固化 + 全量回归留痕（MINOR-④）
           1 file changed, 814 insertions(+)
  [本轮]   iter2 执行报告（8 批次/19 接口/150 用例）+ 归档旧版
           本提交新增 _pipeline/archive/02_EXEC_REPORT_20260919_1525.md（旧报告归档副本）
           并覆盖写 _pipeline/02_EXEC_REPORT.md 为迭代 2 版（即本文件）

  迭代 2 区间整体统计（666a52f..HEAD，报告提交前）：
    52 files changed, 10363 insertions(+), 571 deletions(-)
    其中：新增 44（42 计划文件 + 2 流程留档）、修改 8（7 计划文件 + _pipeline/01_PLAN.md）、删除 0

-------------------------------------------------
八、未完成项与阻塞项
-------------------------------------------------

无。

补充说明（非阻塞、供复核知悉）：
  - 计划 七、7.7/7.5 演示所需的 19 接口全程探活脚本为本轮临时核对产物，落盘于仓库外
    /tmp/zhiwei_probe.mjs，未提交（计划文件清单未授权此文件，遵循 一、1.2 与 六、不扩范围）。
  - 探活使用 data/local_db/（本地演示库，已 gitignore）。为不改动既有演示态，本轮探活前将
    原库备份至 /tmp 临时目录、探活后原样恢复（当前 data/local_db/ 为原 demo@zhiwei.dev 状态）；
    探活期间生成的库文件为可再生产物（8.1 R6：删除即恢复出厂状态）。

-------------------------------------------------
九、结论
-------------------------------------------------

迭代 2「后端 19 接口 + MINOR 清偿」全部完成并验收通过：
  1) 8 个计划批次全部「完成」，形成 9 个迭代 2 提交（步骤 6 测试独立提交，偏差 D3 已留痕）。
  2) 19 个接口全部实现、路由闭合（19/19），本轮实时探活全部符合契约预期（含 403/401 越权）。
  3) 全量回归 13 文件 / 150 用例全绿（引擎 38 = 36 基线 + 2 新增；api 112），无回归。
  4) typecheck 两段 exit=0；server 构建成功（91.5kb）；数据双闸门全绿
     （validate 全 PASS；verify_items 覆盖 86≥80、不一致 0）。
  5) SSE（delta→meta→done）与 JSON 降级双通路均可演示。
  6) MINOR-① 至⑤ 五条全部清偿，逐条有证据（见 六、）。
  7) 工程纪律核对通过：错误码表未扩展、space 归属 403、answer/solution_steps 零下发、
     需求文档/apps/web/config 零改动、无真实模型与云 SDK 调用、运行时产物未入库。
  8) 旧版执行报告已归档（只增不删），本文件为迭代 2 版执行报告。

VERDICT: PASS（迭代 2）
