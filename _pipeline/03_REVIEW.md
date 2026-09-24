知微 · 赛前修整轮 2（对话链路真实透出 + 右侧常驻面板 + 可视化）审查报告
================================================================================
审查角色：reviewer（**只读**审查；除本文件外未修改任何仓库文件，未提交、未 add）
审查日期：2026-09-24 19:15（本机时间）
审查范围：基线 301708c（轮 2 计划落盘）→ HEAD 9b24d46（分支 tempdeploy），提交序列
          7171083(E1) / d98cc59(E2) / 150b57c(E3) / 6f790fe(E4) / 7c13687(F1) /
          296cfc6(F2) / 2b50085(轮 1 报告落盘) / 4b63568(F3) / 79675f6(F4) / 9b24d46(断句修复)
审查依据：需求（用户反馈第 5 条）> _pipeline/01_PLAN.md（第 5 版）> AGENT.md（§6 红线 / §2 纪律）
          > API_CONTRACT.md（冻结；本轮按计划 D2 允许 §9 追加 + §11 留痕）
环境：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
      $WS=/Users/Merryou/.workbuddy/binaries/node/workspace
      $PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
归档：落盘本报告前，已先把旧的 03_REVIEW.md（**轮 1 版，VERDICT FAIL**，347 行）复制归档为
      _pipeline/archive/03_REVIEW_20260924_1915.md（md5 两侧一致 c31a836f0786e0e53a43872117a76c2b），
      然后才覆写本文件（先归档、再写入；另：轮 1 版在 git 2b50085 中亦有留存）。

结论（先读这一段）
--------------------------------------------------------------------------------
本轮**成立**：E1–F4 与 9b24d46 的实际代码、测试、契约文档、走查证据与执行报告的主干陈述
**逐条对得上**，且我把三条「最易被演过去」的点都做了独立实测（真实 HTTP 流前错误路径、
真实 SSE 工具链中间量、云函数入口 trace 行为）。**未发现 FAIL 级问题**：无红线违反、
无测试放宽、无伪造步骤/伪造耗时、无契约破坏。
共记录 11 条问题，**全部为 L（低）或 INFO 级**，不影响交付判定；其中 L2 / L4 / L7 与 L11
建议下一轮（或材料阶段）顺手处理。

--------------------------------------------------------------------------------
0. 复核总控「已亲验结论」——四条全部复现（我亲自重跑）
--------------------------------------------------------------------------------
0.1 测试三批独立实跑：**345 例 / 29 文件全绿，0 skip**（与总控口径完全一致）

  cd /Users/Merryou/LearnBuddy/zhiwei
  $NODE $WS/node_modules/vitest/vitest.mjs run packages functions/api/tests
    → Test Files 16 passed (16)   Tests 212 passed (212)
      （packages 2 文件 43 例；functions/api/tests 14 文件 169 例）
  $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
    → Test Files 13 passed (13)   Tests 133 passed (133)
  合计 43 + 169 + 133 = 345 例 / 2 + 14 + 13 = 29 文件 ✔

  另按文件核对用例数（grep -cE '^\s*it\(' 逐文件加总，与实跑一致）：
    后端：attribution 16 / auth 11 / chat 19 / chatTrace 7 / classify 8 / closedLoop 5 /
          diagnose 18 / paper 15 / plan 8 / profile 5 / remoteChat 26 / report 8 /
          selfReport 8 / space 15 = 169
    前端：authStore 5 / bands 10 / chatPanel 5 / client 13 / dialogStore 7 /
          graphSnapshot 10 / logoGeometry 17 / phrases 6 / richText 10 / routerGuard 9 /
          sse 20 / stages 14 / themeStore 7 = 133
    → 基线 300（引擎 43 + 后端 143 + 前端 114）→ 345，**净增 45，无删除**。

0.2 tsc 三段 + 数据闸门 + 构建

  $NODE .../tsc --noEmit -p packages/engine/tsconfig.json   → exit=0
  $NODE .../tsc --noEmit -p functions/api/tsconfig.json     → exit=0
  $NODE .../tsc --noEmit -p apps/web/tsconfig.json          → exit=0
  $PY scripts/validate_data.py → [PASS] 全部阻断项通过（DATA_SCHEMA §6 校验 1–6）
      附 16 条既有非阻断提醒（缺难度档 / typical_errors 条数），与上轮同结论。
  vite build：直接跑（默认 outDir）时**被本机沙箱的 safe-delete shim 拦下**
      `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":63,...,"targets":[".../apps/web/dist/assets"]}`
      —— 这是**审查环境**对 `emptyOutDir → rmSync` 的拦截，不是代码缺陷（dist 未被删除，
      ls apps/web/dist/assets 仍 16 个文件）。
      改用 `--outDir /tmp/zw-build-web --emptyOutDir` 复跑：**✓ built in 3.63s**，
      `index 123.01 kB (gz 39.29) / react 165.48 / echarts 434.35 / index.css 33.26 /
      GraphPage 7.22 kB` —— 与执行报告 §2.3④ 的数字**逐项一致**。

0.3 工作区洁净（不碰他人变更）

  git status --porcelain →
    M tools/e2e-smoke.cjs
    ?? _pipeline/PR-tempdeploy.md
    ?? 知微-项目介绍.md
  与总控、执行报告 §1 完全一致：本轮 commit 未包含这三项，也未回退它们 ✔

0.4 走查证据实存且量测自洽（14 张 + walkthrough.json）

  ls _pipeline/screenshots/round2 → 14 PNG + walkthrough.json（13,170 B）✔
  walkthrough.json 关键原始量测（我自己解析，非引用报告结论）：
    geometry.dark_1440：outerPaddingRight="400px"，mainRect.width=1024，
      contentWidth=976，contentRightEdge=1008，panelRect.left=1040 → **不重叠（差 32px）**
    geometry.{dark,light}_{1024,720,375}：outerPaddingRight="0px"，backdrop=true，
      正文宽 976 / 672 / 327 → 与关门时的正文宽度一致（窄屏不挤压成立）
    composer.overflowPx = -12（四档 × 两主题共 8 次采样一致）
    reducedMotion：reduce → 250ms 已揭示 135/135 字；no-preference → 20/135
    contrast：light thoughtLabel 5.51、dark 8.01、light modelNote 3.15（D27 声明不修）
  我另**目视**抽查 3 张（panel_console_1440_dark / panel_console_1440_light /
  panel_console_375_dark / chat_full_720_dark）：面板与正文不重叠、窄屏为覆盖式抽屉 +
  背景幕、链路面板为真实数据（load_graph kb_math_cz / node_count 24；model_call local；
  kp_match message_excerpt + threshold 0.6 + adopted true；真实 ms 0.032/0.591/0.024）、
  /chat 720 为两栏、375 为堆叠。**截图是真渲染，未见伪造痕迹**。

0.5 我补做的三项独立实测（计划点名的「最易踩点」，报告未给 HTTP 级证据的）
  (a) **流开始前的 401/403/400/404 仍以普通 JSON 错误体返回**（本轮最易踩点）
      做法：esbuild 把 server.ts 打包到 /tmp（不写仓库），以 storeDir=/tmp 起真服务，
      带 `Accept: text/event-stream` 发真请求。实测输出（原样）：
        401 无 token            | status=401 | content-type=application/json | {"code":401,"msg":"缺少 Authorization 请求头"}
        400 message 空          | status=400 | application/json | {"code":400,"msg":"message 不能为空"}
        404 dialog 不存在        | status=404 | application/json | {"code":404,"msg":"对话不存在"}
        403 越权 space          | status=403 | application/json | {"code":403,"msg":"无权访问该空间"}
      ⇒ **四个状态码都没有变成流内 error 事件**，prepareChat/runChat 拆分（D9a）的契约成立。
  (b) 真实 SSE 一轮（同一探针）：
        事件序列 = ["phase","tool","phase","tool","tool","thought","phase","tool","tool",
                   "thought","tool","thought","phase","delta","meta","done"]
        tool 6 步真实中间量（原样）：
          step_1 load_graph     args {kb:"kb_math_cz",node_count:24} ms 0.026
          step_2 model_call     args {mode:"local"} result {kp_id:"math.cz.quadratic.vertex_form",
                                confidence:0.85,progress:false} ms 0.491
          step_3 kp_match       args {message_excerpt:"二次函数的顶点式我不会"}
                                result {kp_id,confidence:0.85,threshold:0.6,adopted:true} ms 0.02
          step_4 dedup_check    args {kp_id} result {hit:false} ms 2.54
          step_5 apply_evidence args {kp_id} result {before:0,after:0.009000000000000001,
                                event_id:"evt_..."} ms 3.244
          step_6 state_machine  args {progress:false} result {consecutive_false:1,
                                next_action:"continue",exit_threshold:3} ms 0.013
        阶段序 = analyze → retrieve → judge → generate（4 次，恒为此序）
        JSON 降级（Accept: application/json）：data 键 = ["reply","meta","trace"]；
          trace 长度 12，首步 {"type":"phase","name":"analyze","label":"分析"}；
          trace 里不含 delta 文本；body 不含 "answer"/"solution_steps"。
      ⇒ 「tool.args/result 全真实中间量」「ms 真实」「phase 序」「JSON 降级携 trace」成立。
  (c) 云函数入口（E4 的改动点，仓库内**无任何测试覆盖**）：把 index.ts 打包后用
      ZHIWEI_ROOT 指向 /tmp 副本（不碰仓库 data/）调 main()：
        statusCode=200，data 键 = ["reply","meta","trace"]，trace 13 步，
        tool 序列 = ["load_graph","model_call","kp_match","dedup_check","apply_evidence","state_machine"]，
        与 SSE 路径**同形同序**；trace 不含 delta。
      ⇒ E4 的「云函数入口与本地降级同形」成立（我实测，非采信报告）。

0.6 9b24d46（总控直接模式）逐条核实
  · 只动 2 文件：`git diff --stat 79675f6..HEAD` = chat.ts(+27/-11 内) + chat.test.ts(+4/-1) ✔
  · **只影响本地模式文案**：改动集中在 matchThought / evidenceThought / stateMachineThought /
    exitThought / generateThought（本地确定性摘要模板）补句末「。」；远程 thought 通道
    （模型增量原样转发）未动：emitThought 仍为 `if (!isRemote) emit.event(thoughtEvent(text))`，
    runChat 里没有任何对模型增量文本的加工 ✔
  · **断言是被更新而非放宽**：chat.test.ts 由
      toContain('写入弱负证据：掌握度 0.5 → 0.45')
    改为 toContain('写入弱负证据：掌握度 0.5 → 0.45。') —— 仍是精确串 + 真实数值 0.5 → 0.45，
    且同例仍对账 mastery_logs（before/after/event_id 与库内一致）✔
  · 复核目的成立：截图里的旧文案（「…掌握度 0 → 0.01本轮有有效进展…」）确为相邻两步摘要黏连，
    修复后每条模板自成语义完整的句子。

--------------------------------------------------------------------------------
1. 审查项 1（本轮最重）：诚实性 —— 逐条对照实现，未发现「演」
--------------------------------------------------------------------------------
1.1 7 个工具名是否都对应真实执行的代码（对照 services/chat.ts 行号）

  load_graph      chat.ts:414-424 —— prepareChat:160-162 真实调用 ctx.data.nodesForKb(kb)，
                  args{kb,node_count} 取自真实 nodes.length，ms=真实测得的 graphMs ✔
  model_call      chat.ts:428-485 —— 真实 createModels().chatTurn()；args.mode 与 models/index.ts
                  同源判定（process.env.ZHIWEI_MODEL_MODE==='remote'），result 取自真实 turn ✔
  kp_match        chat.ts:494-519 —— 真实 CONF_ADOPT 判定 + ctx.data.nodeById.has() 图谱命中校验，
                  result{threshold:ctx.params.CONF_ADOPT, adopted, fallback_kp_id?} 全真实 ✔
  dedup_check     chat.ts:536-549 —— applySilentEvidence 内真实 buildDedupKey + findEventsByDedupKey，
                  result.hit 为真实命中与否，ms=dedupMs（真实查询耗时）✔
  apply_evidence  chat.ts:550-561 —— 真实插入 evidence_events / mastery_logs / profile 三表，
                  result{before,after,event_id} 取自真实写入结果，ms=writeMs ✔
                  （写入逻辑本身与基线逐行一致，仅扩返回值）
  state_machine   chat.ts:566-589 —— 真实 consecutive_false / next_action 计算 ✔
  exit_channel    chat.ts:600-623 —— 真实 applyExitChannel（blocked_by_prerequisite +
                  searchUpstream + hop 上限），result 含真实 upstream/jumped/exit_count/hop_limit ✔

1.2 「未发生就不出现」的负断言是否真覆盖
  · chat.test.ts:498-512（clarify 轮）：**精确等值**断言
      expect(toolNames(events)).toEqual(['load_graph','model_call','kp_match','state_machine'])
    且断言 kp_match.result.adopted===false、并断言**没有** generate 阶段 thought（无附加段）。
    —— 这是最强形态的负断言（等值而非 not.toContain），澄清轮若被塞进 dedup/evidence 必红。
  · chat.test.ts:439-454（dedup 命中轮）：dedup_check.result=== {hit:true} 且
    toolNames(second) 不含 apply_evidence；同时用第一轮做正向对照（hit:false 且有 apply_evidence）。
  · chat.test.ts:379-404（首轮全序列）：delta 之前的 tool 序列**等值**为
    ['load_graph','model_call','kp_match','dedup_check','apply_evidence','state_machine']
    → 首轮无 exit_channel 也被这条钉住。
  · chatTrace.test.ts:38-59：TOOL_LABEL 键集 === 契约闭集；chat.test.ts:26-34 另存一份闭集副本，
    name ∉ 闭集即红（防将来有人加「演」的步骤）。
  · 我在 §0.5(b) 的真实 HTTP 实测也复核了同一结论（clarify 轮 = 4 步、首轮 = 6 步）。

1.3 有没有为了动画好看插入人为延时
  · 后端：grep setTimeout/sleep/delay 于 chat.ts / chatTrace.ts / remoteChat.ts，
    **唯一命中**是 remoteChat.ts:391 `setTimeout(() => controller.abort(), config.timeoutMs)`
    —— 这是 LLM 请求超时中止，不是演出延时 ✔
  · 本地模式 tool 只发终态一次（不发 running、不伪造 ms）——chat.ts:431-435 注释与实现一致，
    running 只出现在远程 model_call 真发起模型流时 ✔
  · 「流式感」全部在前端：ThoughtStream 打字机（24ms / 2 字）+ CSS 动画；
    已由 reduced-motion 对照实测证明其**只是呈现层**（reduce 下 250ms 即 135/135 全文）✔
  · thought 文案：本地 = 模板句 + 真实数值（before/after、consecutive_false、hop_limit、
    confidence/threshold 均取自真实中间量），无「让我想想…」式拟态话术 ✔
  · 契约 §9 v1.3 明写「服务端不人为 delay、不伪造 ms」并把差异显式声明（本地=推理摘要 /
    远程=模型自述），前端标题按 #20 model.mode 切换（ChatTracePanel:35-41）✔

1.4 结论：**未发现任何伪造步骤、伪造数值、伪造耗时或人为延时**。总控与本轮实现者在
    「诚实性」这条最重的要求上站得住。

--------------------------------------------------------------------------------
2. 审查项 2：契约兼容与降级
--------------------------------------------------------------------------------
2.1 delta / meta / done / error 语义未变（旧客户端）
  · 契约侧：git diff 301708c..HEAD -- API_CONTRACT.md = **+51 / -0**（删除 0 行），
    原文 v1.1 的 delta/meta/done 行逐字保留（chatTrace.test.ts:124-141 有 grep 哨兵
    直接读 API_CONTRACT.md 断言「delta 行仍在」「§11 v1.0–v1.2 三行仍在」）✔
  · 代码侧：旧四类分支未改（sse.ts:126-148 与基线一致），新三 case 追加在 default 之前；
    default 仍「未知事件忽略」（有测试锁定）✔
  · 序列侧：本地模式过滤后仍恒为 ['delta','meta','done'] / ['delta','delta',...] （chat.test.ts
    与 closedLoop.test.ts 均保留了**过滤后相对序**断言，不是只查存在性）✔
  · 旧前端遇新事件：sse.test.ts 有「未知事件（metrics/heartbeat）仍被忽略，不影响 delta 拼接」；
    旧服务端（无 trace）JSON 降级 → 行为与 v1.2 一致（sse.test.ts:369+）✔

2.2 JSON 降级路径携完整 trace 且能重放
  · 后端：chat() 的 wantsJson 分支 JSON 路径 = createTraceRecorder() 收集 → ok({reply, meta, trace})；
    trace 只含 phase/tool/thought（delta 不进 trace，chatTrace.ts:152-173）✔
  · 实测（§0.5b）：data 键恰为 reply/meta/trace；trace[0] = {type:'phase',name:'analyze',label:'分析'} ✔
  · 前端重放：sse.ts:213-221 在 onDelta(reply) 之前按 trace 顺序重放 onPhase/onThought/onTool，
    且旧服务端无 trace 时按原行为整段渲染；sse.test.ts 对「携 trace」与「无 trace」两种
    响应都做了逐事件序列断言（['fallback','phase','tool','thought','phase','delta','meta','done']）✔
  · 云函数入口（E4）实测同形（§0.5c）✔

2.3 流开始前的 401/403/400/404 = 普通 JSON 错误体 —— **已实测，未变成流内 error 事件**
  见 §0.5(a) 四条原始输出。机制上也站得住：chat() 先 await prepareChat（401/403/400/404 在此抛）
  再决定返回生成器；dispatcher 的 catch 把 ApiError 转成 fail(code)，server.ts 对非生成器结果
  走 writeJson。单测层面 chat.test.ts:324-375 仍以「dispatch 返回 ApiResponse 而非生成器」
  为断言（helpers.call 在拿到生成器时会直接抛错），是双重保险。

--------------------------------------------------------------------------------
3. 审查项 3：红线
--------------------------------------------------------------------------------
3.1 answer / solution_steps 不下发
  · 新增前端代码（components/chat/**、api/sse.ts、stores/dialog.ts）grep 零命中；
    chatTrace.ts / chat.ts 的命中仅为注释与既有 solutionText 文案通道（v1.2 既有，非本轮新增）✔
  · 新事件字段只装 D4a 列出的真实中间量：白名单核对 7 组 args/result（§1.1），无题库答案字段 ✔
  · closedLoop 的 E5 全局禁发断言本轮**被加强**：现在把 JSON 降级响应体也 push 进 captured
    （closedLoop.test.ts:501），连同新 trace 一起受「不含 "answer"/"solution_steps"」检查 ✔
  · 我实测的 JSON 降级 body 亦不含这两个键（§0.5b）✔

3.2 算法参数零硬编码
  · chat.ts 中 CONF_ADOPT / CONSEC_FALSE_EXIT / MAX_EXIT_HOPS / ALPHA_SILENT /
    EXIT_UPSTREAM_THRESHOLD 全部读 ctx.params（config/params.json）✔
  · 面板宽度 400 / 断点 1280 / 顶栏高 56 为**布局尺寸**且以具名常量集中定义
    （Layout.tsx:35-41）并注释；非算法参数 ✔
  · 唯一数值字面量 `consecutiveFalse === 2`（chat.ts:573）**是基线既有**（301708c:274 同款），
    本轮未新增 —— 见 L1（既有项，非本轮回归）。

3.3 状态带取色唯一入口
  · theme/bands.ts / tailwind.config.js 本轮**零改动**（不在 diff 名单内）；
    bands.ts 仍从 `packages/engine/src/statusBand` **源模块**导入（非 barrel）✔
  · 新组件取色只用语义令牌：band-basic / tone-error / ink / ink-soft / accent / accent-veil /
    surface / canvas / line / shadow-card / raised；grep 无 `bg-[#…]`、`text-[#…]`、
    `z-[…]` 实际用法（仅 TopNav 注释里出现过历史 hex 说明）✔
  · z-index：单一 fixed 容器走 `z-overlay`（=50，tailwind.config.js:138）✔

3.4 其它红线
  · 无新依赖（package.json 未改动）；未动 engine / data / config / scripts / 冻结文档
    （API_CONTRACT 仅按 D2 追加）✔
  · 前端零新增模型配置入口（grep ZHIWEI_LLM / api_key / 模型切换 = 无；只有只读展示）✔
  · 未提交他人变更（§0.3）✔

--------------------------------------------------------------------------------
4. 审查项 4：测试是否被改弱（逐条判「随契约同步」还是「为通过放宽」）
--------------------------------------------------------------------------------
4.1 全局口径：测试文件改动 = chat.test.ts(+344/-18)、remoteChat.test.ts(+300/-57)、
    closedLoop.test.ts(+24/-2)、sse.test.ts(+155/-6)、chatPanel.test.ts(+78/-0)、
    dialogStore.test.ts(+146/-0)、chatTrace.test.ts(+141/-0)
    —— 全部**只改写/新增**，删除行合计 82 行，逐行归因如下，无「为通过而放宽」。
4.2 chat.test.ts 的 18 删除行：全部落在计划「六、总表」点名的 6 改用例
    （事件序列→过滤后序列 + firstDelta()、键集加 trace、events[0]→首个 delta、头注释、
    9b24d46 的 thought 文案断句）。
    判定：**随契约同步**。强度对比——原 `toEqual(['delta','meta','done'])` 现在等价为
    `names[0]==='phase'` + `slice(-2)===['meta','done']` + **过滤后等值**
    `['delta','meta','done']`，并额外加「delta 前有 4 个真实 tool」等断言 ⇒ 更强。
    计划点名的 6 个回归哨兵（exit 上游 / silent 弱负证据 / dedup 命中 / X-Response-Format /
    续聊+403+404 / 400+403+401）**内容未改**，我在源码中逐条确认仍在（chat.test.ts:204-222、
    226-250、252-265、313-322、324-346、348-375）。
4.3 remoteChat.test.ts 的 57 删除行 = 旧 `okResponse`（非流式）辅助 + 旧「response_format=json_object
    且 400 去参重试」用例 + 相应 mock 样板。
    判定：**契约行为变更的必然同步**（D3a 明确「更新而非删除」）。旧 7 例的主体语义全部保留：
    结构化映射（改写为流式 mock，现 remoteChat.test.ts:258）、伪造 kp 丢弃、网络失败回落、
    非 JSON 回落（:305）、历史回传 {"reply":…}（:330 附近）、
    未配置零请求；新增 13 例覆盖转义跨块、字段乱序、[DONE] 语义、半截即断抛 RemoteChatAborted、
    零增量回落。**没有任何一例被放宽**（半截例还新增「已到达的增量不被本地模板文拼接」断言）。
4.4 closedLoop.test.ts：**未退化为只查存在性**。
    原 `events).toEqual(['delta','meta','done'])` → 现为
      events[0]==='phase'  ∧  events.slice(-2)==['meta','done']  ∧
      events.filter(∈{delta,meta,done}) === ['delta','meta','done']   ← **严格相对序仍在**
    并新增 thought/tool 存在、node_count/adopted 真实字段、JSON 降级 trace 首步与 tool 计数、
    以及把降级 body 纳入 E5 禁发检查。判定：**加强 + 同步**。
4.5 sse.test.ts（13→20）+ chatPanel（3→5）+ dialogStore（0→7）+ chatTrace（0→7）：
    全部新增/追加，无删除语义（sse 的 6 删除行只是 jsonChatResponse 辅助函数签名扩 trace）。
4.6 计划「六、总表」对账差异：chat 11→19（计划 18）、remoteChat 15→26（计划 22）、
    sse 13→20（计划 19）、chatTrace 7（计划 ~5）、dialogStore 7（~6）、chatPanel 5（~3）
    —— **全部是「比重更多」，无删除、无放宽**；closedLoop 实为 5 例（计划误写 20 例，
    执行报告 §2.1 已自查更正为「路由表 20 条断言」，与我核对 git 基线一致）✔
4.7 计划中的验证命令是否实际执行 / 失败是否被如实记录
    · 计划 E1–F4 的 tsc / vitest / diff / env 命令我均按等价命令重跑通过（§0.2/§0.3）。
    · 执行报告**如实列出未完成项**（§8）：ToolTimeline running/error 两态无真实截图、
      远程真流网络链路未实测（无 key）、风险页仅 1440 一档、6 个新组件的对比度采样覆盖有限。
      —— 未发现「静默跳过」或「把没跑的写成跑了」。**唯一不精确的措辞**见 L3。

--------------------------------------------------------------------------------
5. 审查项 5：前端实现质量
--------------------------------------------------------------------------------
5.1 面板布局与 D24 偏差判定：**合理修正（计划数字前提有误），非掩盖问题**
    · 事实核对：tailwind `max-w-5xl` = 64rem = **1024px**（不是计划写的 1280px）。计划 D1b
      原文「main 容器加 padding-right」「正文列仍有 ≥880px（1280-400）」两处前提都不成立。
    · 算术复核实现后的两个数字（与 walkthrough.json 实测一致）：
        1440：可用宽 1440-400=1040 → main=min(1024,1040)=1024 → 正文 1024-48=**976** ✔
        1280：可用宽 880 → main=880 → 正文 880-48=**832**（与 D24 声称一致）✔
      若按计划字面（padding 落在 main 盒内）：1440 下正文 =1024-400-48=576 ≈ 报告所说 600，
      且与面板之间留 ~200px 死区 —— 报告描述的「改前」现象在算术上成立。
    · 走查实测（我解析 walkthrough.json 而非采信报告）：1440 正文 976 / 右缘 1008 <
      面板左缘 1040（不重叠、无死区）；1024/720/375 覆盖态正文宽 976/672/327 **等于关门值**；
      8 次采样的输入区底边余量恒 -12px。⇒ 偏差解决了真问题，且未掩盖任何东西。
    · 副作用见 L11（顶栏与正文左基线错位），报告未记录。
5.2 <1280 覆盖式抽屉 + 背景幕：正确
    · 断点判定 matchMedia('(min-width:1280px)') 订阅式 hook，不支持 matchMedia 时按窄屏（宁可不挤压）；
    · 覆盖态 = 单 fixed 容器（top 56px）→ 半透明背景幕（bg-canvas/60，可点关闭）→ 右侧抽屉；
      正文完全不动（实测三档正文宽不变）；关闭时不渲染任何 DOM。
    · 可访问名区分：背景幕「点击空白处关闭对话面板」vs 头部「关闭对话面板」（D25）✔
    · z-overlay 走令牌、Toast(z-toast=60) 仍最上层 ✔
5.3 TopNav 特判未污染路由数据
    · TopNav 仅对 `route.path === CHAT_PATH`（文件内常量 '/chat'，D23）渲染 <button aria-pressed>，
      其余仍 NavLink；`apps/web/src/router.tsx` **不在本轮 diff 名单**，
      `routerGuard.test.ts` **零改动**（9 例全绿）—— 计划 D1c/D1d 的承诺成立 ✔
5.4 新组件零硬编码颜色 / 尊重 prefers-reduced-motion
    · 颜色：全部语义令牌（§3.3）；`prefersReducedMotion()` 用于 ThoughtStream（直接全文）与
      ChatMessageList（scrollBehavior）；index.css 既有 `@media (prefers-reduced-motion: reduce)`
      把 animation/transition 压到 0.01ms，覆盖 spinner/pulse ✔
    · 对照实测（walkthrough.json reducedMotion）：reduce 250ms 135/135 字 vs no-preference 20/135 ✔
5.5 ChatPanel 与 /chat 全屏态**共用同一套视图组件**（计划明确禁止复制两份）
    · ChatPanel.tsx 与 pages/ChatPage.tsx 都只 import components/chat 的
      ChatMessageList / ChatComposer / ChatTracePanel / ModelBadge（+ useChatSend 在 Composer 内）；
      两处都只做布局壳（宽度/滚动容器/开合件/两栏堆叠）；grep 未发现第二份消息流或时间轴实现 ✔
    · /chat 保留在 ROUTES（requiresAuth true），入口：面板头部「全屏打开」（并收起面板 D22）、
      全屏页「收进侧栏」（打开面板 + 回控制台）✔

--------------------------------------------------------------------------------
6. 审查项 6：文档一致性
--------------------------------------------------------------------------------
6.1 API_CONTRACT.md §9 v1.3 追加块：**只增不删，字段表与实现逐字一致**
    · diff 基线核对：`git diff --numstat 301708c..HEAD -- API_CONTRACT.md` = 51 / 0 ✔
    · 我逐项把契约表与 chat.ts 的实际产出对齐：
        phase{name,label}、thought{text}、tool{id,name,label,status,args?,result?,ms?}、
        delta/meta/done/error 原样 —— 一致；
        7 个工具的 args/result 键名逐字一致（含 kp_match 的 fallback_kp_id? 条件出现、
        exit_channel 的 upstream_kp_id?/upstream_name? 条件出现、apply_evidence 的 event_id）✔
        顺序约定（本地过程事件先于首个 delta、meta→done 恒为末两个）与实测一致 ✔
        JSON 降级 {reply, meta, trace} 与 TraceStep 形态与实测一致 ✔
    · §11 追加一行变更记录 ✔（chatTrace.test.ts 有哨兵锁定 v1.0/v1.1/v1.2 行仍在）
6.2 执行报告 D22–D29 与实际代码相符（逐条查）
    D22 全屏打开时收起面板 → ChatPanel.tsx:52-58 的 Link onClick setOpen(false) ✔
    D23 CHAT_PATH 常量写在 TopNav 内 → TopNav.tsx:43 ✔
    D24 让位 padding 在外层包装 → Layout.tsx:118-123 + 文件头注释 ✔（判定见 5.1）
    D25 背景幕 aria-label 改名 → Layout.tsx:84-90 ✔
    D26 五个新建组件去掉 /70 /80 半透明小字 → grep 确认新组件内已无该类实际用法 ✔（附 L2/L3）
    D27 不修 modelNote 浅色 3.15:1 → ModelBadge.tsx:63 仍 text-accent on bg-accent-veil，
        与 walkthrough.json 采样 3.15 一致 ✔（遗留声明属实）
    D28 证据目录 _pipeline/screenshots/round2/ 只增不删 ✔
    D29 走查脚本不入库 ✔（本轮 diff 无任何新脚本文件）
    · 编号声明核对：执行报告称「D22–D27 由本次 F3/F4 使用，如后续发现前半段另有编号请指出」
      → 我核对本轮所有新文件的 D 编号引用（chat.ts: D11/D13；ChatPage: D11/D15；
      Layout: D24/D25；ChatPanel: D1/D11/D22；新组件: D4b/D5x/D26）：
      **D22–D27 无他人占用**（未发生覆盖），但存在**两个 D 系列混用**的表述风险 → 见 L(INFO) 项。
6.3 LOOKATME.md 数字与实跑核对：345 例 / 29 文件 ✔、tsc 三段 exit 0 ✔、数据闸门 ✔、
    构建体积逐项一致 ✔、14 张截图 ✔、面板几何 976/1008/1040 ✔、6 个 tool 步骤 ✔、
    「ROUTES 零改动 / 20 接口/12 页」✔。**不一致项**见 L8（ChatPage 行数、提交数、
    motion.ts 归属）与 L9（未记录 9b24d46）。

--------------------------------------------------------------------------------
7. 问题清单（按严重程度从高到低；本轮**无 H/M 级问题**，以下均为 L / INFO）
--------------------------------------------------------------------------------
L1 既有：hint 阶梯档位阈值硬编码
    文件：functions/api/src/services/chat.ts:573（`consecutiveFalse === 2`）
    现象：`2` 不是 config/params.json 的键（params 只有 CONSEC_FALSE_EXIT=3 与 MAX_EXIT_HOPS=2），
          与 AGENT §6「算法参数零硬编码」的口径存在张力。
    影响：若后续调整提示阶梯档位需改代码；对本轮功能无影响（且与基线 301708c:274 完全一致，
          **非本轮引入、本轮未扩大**）。
    建议：总控裁决是否在 params.json 增 HINT_LADDER_AT 键（需同时改 ALGORITHM §5 口径），
          或在代码注释中显式声明「提示阶梯档位属交互设计常量、非算法参数」；本轮不建议改。

L2 本轮新增/改动代码仍有 2 处小字不达 WCAG AA，且执行报告 §4.4 的结论措辞过宽
    (a) apps/web/src/components/chat/ChatTracePanel.tsx:54
        `<span className="… text-[11px] text-accent">进行中</span>`（bg-surface＝浅色 #FFFFFF）
        浅色 accent = #4E8FB0（index.css:34）→ 约 3.57:1（报告自己算过这个数），< AA 4.5:1。
    (b) apps/web/src/pages/ChatPage.tsx:75
        `<span className="text-[11px] text-ink-soft/80">收进侧栏后，任何页面都能接着聊…</span>`
        —— 与本轮 D26 修掉的那类半透明降级**同款**（报告自测该配对浅色 3.61:1），
        但 D26 的处置范围被限定为「本轮**新建**文件」，ChatPage 是**改动**文件，故漏改。
    影响：小字可读性不达 AA；执行报告 4.4「本轮新建组件的浅色小字已全部 ≥5.17:1」只对
          walkthrough 采样的 9 个节点成立（采样清单里没有「进行中」，也没有 ChatPage 那行）。
          D27 的「既有配对」理由只覆盖 accent-on-accent-veil，不覆盖 accent-on-surface。
    建议：把 (a)(b) 改为 text-ink-soft / text-ink（一行类名替换，行为零变化），或把 D27 扩写为
          「accent 小字在浅色底上的上限」并把上述两处一并列进遗留清单与 LOOKATME。

L3 执行报告 §4.4 结论与 D26 范围的措辞需收紧（与 L2 同源，单列以便留痕）
    现象：报告写「本轮新建组件的浅色小字已**全部** ≥5.17:1」；实际是「本轮**被采样的**节点
          全部 ≥5.17:1，且新建组件内仍存在 text-accent 小字未纳入采样」。
    影响：读者可能据此认为浅色小字问题已清零。
    建议：改为「本组件内做半透明降级的 3 处已修；accent 小字（徽标/进行中）为已知遗留」。

L4 工具卡直接渲染原始浮点数
    文件：apps/web/src/components/chat/ToolTimeline.tsx:21-28（formatValue）+ :65
    现象：apply_evidence.result.after 实测为 0.009000000000000001（§0.5b 探针原样输出），
          面板会显示这串长尾数字，而同轮 thought 文案显示的是「0.01」。
    影响：面板观感不一致，可能被读成两个不同数值（数值本身是真实的，不该改数据）。
    建议：仅在显示层格式化（数值类型 → 保留 2–4 位小数；字符串/对象维持现状），并把
          「真实值不改、只改显示」写进注释。

L5 云函数入口（E4 改动点）无任何测试覆盖
    文件：functions/api/src/index.ts:112-136；仓库内无测试 import 该模块（我 grep 过 tests/**）
    现象：trace 收集分支只有 tsc 覆盖。我已用临时探针实测行为正确（§0.5c），但仓库内无回归网。
    影响：将来改 dispatch/事件形状时，云函数入口可能静默与 SSE/JSON 路径不同形。
    建议：补 1 例（可复用临时上下文直接调 main()，断言 data 键 = reply/meta/trace、
          trace[0].type==='phase'）；此项属**计划 E4 自身遗漏**，不是实现者偏差。

L6 远程「半截即断」在**服务层**的落点无测试
    文件：functions/api/src/services/chat.ts:459-471（emit model_call error → 上抛）
          + server.ts:118-125（catch → event:error + event:done）
    现象：适配器层有 RemoteChatAborted 例（remoteChat.test.ts:453），但「SSE 流已出部分 delta
          之后收到 error 事件且以 done 收尾」没有集成断言。前端 failAssistant 保留半截文本
          的语义也只有既有的降级链用例间接覆盖。
    影响：D3d 的端到端承诺（保留半截文本 + 不白屏）缺一层回归保护。
    建议：补 1 例：mock fetch 分块吐 reply 增量后中断 → 断言事件序列尾部含 error 与 done，
          且 delta 拼接等于已到达的半截文本（不掺本地模板文）。

L7（诚实性相关，INFO→低）远程回落本地时，trace 仍显示 mode=remote，无「已回落」标记
    文件：functions/api/src/services/chat.ts:428/476（args.mode 来自环境配置，而非实际产出适配器）
          + models/remoteChat.ts:491-500（零增量失败静默回落 localChatTurn）
    现象：远端不可用而回落本地时，tool 事件 args.mode='remote'，result 却来自本地规则适配器，
          且没有 fallback 字段；可视化上可能被读成「这段话是远端模型产出的」。
    影响：不构成事实造假（mode 表示配置模式），但削弱「链路可解释」的说服力，属可改进点。
    建议：契约层加 `result.fallback: true`（或 args.adapter），由总控决定是否走 §9 v1.4 追加；
          若不加，建议在契约说明行里明写「mode 为服务端配置模式，不代表本轮实际产出来源」。

L8 文档数字/归属小瑕疵（3 处）
    (a) LOOKATME.md:95「ChatPage 由 298 行瘦身为布局壳」——实测原文 **286** 行
        （git show 301708c:apps/web/src/pages/ChatPage.tsx | wc -l = 286），现 124 行；
        「298」是 git diff 的改动行数口径，F2 提交信息里用的是「230」（同一口径的另一半）。
    (b) LOOKATME.md:9「累计 84 次提交」——9b24d46 之后实测 `git rev-list --count HEAD` = **85**
        （--no-merges = 81），且 LOOKATME 未记录 9b24d46 与断句修复。
    (c) F2 提交信息「lib/motion.ts 新增 prefersReducedMotion」不实：该函数自 dba10f3
        （2026-09-22 前端优化批）即存在，本轮**未改** motion.ts（不在 diff 名单）。
    影响：仅文档追溯精度，不影响交付。
    建议：材料阶段一次性校正（数字 + 补记 9b24d46）。

L9 走查证据早于最后一次代码改动（9b24d46）
    现象：14 张截图拍于 79675f6，其中推理摘要仍是「…掌握度 0 → 0.01本轮有有效进展…」的旧文案；
          最终代码已补句末「。」。执行报告 §4 亦未记录 9b24d46（报告在它之前落盘）。
    影响：截图与最终代码存在**纯文案标点**差异；不影响任何结论，但若不说明，复核者会对不上。
    建议：要么重拍 1 张 1440 面板图覆盖旧图，要么在报告 §4.1 加一行「截图时点 79675f6，
          之后 9b24d46 仅改本地 thought 句末标点，未重拍」。

L10 归档提交与计划 D13 的字面冲突（已合理处置，仅留痕）
    现象：2b50085 提交了 _pipeline/03_REVIEW.md 与 _pipeline/archive/03_REVIEW_20260924_1711.md，
          而计划 D13 明列这两项「不进本计划任何 commit」。
    影响：无实质损失 —— AGENT §7 要求「归档文件与 _pipeline 产物同样入库」，
          且轮 1 报告此时已完成使命（VERDICT FAIL 已返工）。
    建议：不返工；建议后续计划把「pipeline 产物必须入库」与 D 类排除项分开表述，避免再冲突。

L11 D24 的副作用未被报告记录：面板展开时顶栏与正文列左基线错位约 200px
    文件：apps/web/src/components/Layout.tsx:113-124（padding 只加在 main 外层包装，TopNav 不在其中）
    现象：1440 实测 nav 内容左缘 = (1440-1024)/2 + 24 ≈ 232px（截图 0.75 缩放下 ≈174），
          正文列左缘 = 8 + 24 = 32px（截图 ≈24）→ 两者错位约 200px；而 9/20–9/21 设计固化项
          明写「内容列与顶栏统一到同一条左基线」。截图可复现（panel_console_1440_dark/light）。
    影响：纯视觉一致性（面板展开态），不影响可读性与功能。
    建议：把同一让位 padding 也施加到 TopNav 的内层容器（nav 随正文一起左移），
          或在报告/Layout 注释里显式记录「面板展开态放弃左右基线对齐」这一取舍。

INFO-1 两个 D 编号系列在同一轮代码里混用
    现象：chat.ts:9/751「降级（D11）」= 既有执行报告的 D11（JSON 降级）；ChatPage.tsx:15 /
          ChatPanel.tsx:2「D11」= 轮 2 计划的 D11（共享组件不复制两份）。同一编号两义。
    影响：阅读注释时需靠上下文推断；无害但降低可追溯性。
    建议：后续统一写成「计划 Dn」/「报告 Dn」，或在 03_REVIEW/执行报告里维护一份编号对照。

INFO-2 面板内未做焦点管理（覆盖态抽屉无焦点陷阱）
    文件：apps/web/src/components/chat/ChatPanel.tsx（Esc 关闭已做）
    影响：键盘 Tab 可走到背景页面，非阻断（面板非模态阻塞式交互，正文仍可用）。
    建议：材料阶段可选优化；不阻塞。

INFO-3 message_excerpt 用 slice(0,20) 截断，可能切断代理对（emoji）
    文件：functions/api/src/services/chat.ts:515
    影响：极端输入下面板显示半个字符（React 会渲染替换符），不影响逻辑。
    建议：如需严格，用 Array.from(message).slice(0,20).join('')。

--------------------------------------------------------------------------------
8. 已检查项（正面清单，全部基于实跑/实读）
--------------------------------------------------------------------------------
[1] 三批测试 345 例 / 29 文件全绿，无 skip；用例数逐文件核对一致。
[2] tsc 三段 exit 0；validate_data.py 阻断项全过；vite build 通过（体积与报告一致）。
[3] 工作区仅 3 项他人未提交变更，未被卷入本轮 commit。
[4] 契约只增不删（+51/-0）+ §11 留痕 + 文档哨兵测试；字段表与实现逐字一致。
[5] 事件契约 v1.3 三新事件、JSON 降级 trace、顺序约定与实测逐条吻合。
[6] 流前 401/403/400/404 → 普通 JSON 错误体（**真 HTTP 实测**）。
[7] 7 个工具事件全部对应真实执行代码；未发生步骤零事件（等值型负断言锚点）。
[8] tool.args/result/ms 全为真实中间量/真实耗时；无人为延时、无伪造数值。
[9] 本地 thought = 真实中间量拼成的确定性摘要；远程 thought = 模型增量原样转发，两通道不混。
[10] 9b24d46 只影响本地文案、断言更新未放宽（精确串 + 真实数值 + 库对账）。
[11] 前端三新事件路由 + JSON 降级 trace 重放 + 未知事件忽略；旧四类语义未改。
[12] dialog store 只保留最新一轮（startAssistant 清空），完成后仍可见；upsertTool 按 id 覆盖。
[13] 共享视图七件套，全屏与面板共用同一实现，无复制两份。
[14] ≥1280 让位 / <1280 覆盖 + 背景幕；z-overlay 令牌；Esc 关闭；自管滚动；不重叠、正文不被挤压。
[15] 新组件零硬编码颜色，语义令牌；尊重 prefers-reduced-motion（代码 + 实测对照）。
[16] TopNav 特判未动 ROUTES / navRoutes / guardPath，routerGuard 9 例零改动。
[17] 红线：answer/solution_steps 零命中（含降级 body）；参数走 params.json；
     bands.ts 唯一取色入口且从源模块导入；无新依赖；无模型配置前端入口。
[18] 云函数入口 trace 同形（我实测）。
[19] 文档：§9 只增、§11 留痕、D22–D29 与代码相符、LOOKATME 关键数字与实跑一致（瑕疵见 L8/L9）。
[20] 测试只改写/新增，无删除、无放宽、无静默跳过；未完成项在报告 §8 如实列出。

--------------------------------------------------------------------------------
9. 「本轮是否存在演的成分」的正面回答
--------------------------------------------------------------------------------
**不存在实质性的「演」。** 三条支撑：
  (1) 数据真：我独立起了真服务，tool.args/result 是服务端跑出来的真实中间量
      （kb_math_cz / node_count 24 / confidence 0.85 / threshold 0.6 / hit false /
      before 0 → after 0.009… / event_id evt_xxx / consecutive_false 1 / exit_threshold 3），
      ms 是实测毫秒（0.013–3.244），不是常数、不是模板。
  (2) 步骤真：7 个工具与 chat.ts 的真实代码位置一一对应；澄清轮只出 4 步、dedup 命中轮不出
      apply_evidence、首轮不出 exit_channel，都有等值型负断言与我的实测双重支撑。
  (3) 节奏真：后端零延时（全局唯一 setTimeout 是 LLM 超时中止）；「流式感」只在前端打字机，
      且 reduced-motion 对照实测（135/135 vs 20/135）证明它只是呈现层。
  唯一需要读者注意的表述尺度问题是 L2/L3（对比度结论覆盖范围）与 L7（远程回落不标注），
  二者都不构成伪造，属「说法比事实更满一点」的可改进项。

--------------------------------------------------------------------------------
10. 阻塞项
--------------------------------------------------------------------------------
无。信息充分，已能对 E1–F4 与 9b24d46 全部改动做出判断；上述 L1–L11 与 INFO 项均为
可留待下一轮或材料阶段处理的改进项，不构成返工要求。

--------------------------------------------------------------------------------
11. 给总控的下一步建议（按优先级）
--------------------------------------------------------------------------------
1. 顺手清 L2（两处小字对比度）+ L3（收紧 4.4 措辞），一行类名替换，零行为风险。
2. L4 在 ToolTimeline 显示层格式化数值；L9 重拍或标注 1 张截图时点。
3. L5/L6 各补 1 例测试（云函数入口 trace、SSE 半截即断），把本轮新增的两条真实链路
   纳入回归网。
4. L7 是否给远程回落加 trace 标记，需契约层裁决（若加，走 §9 追加 + §11 留痕，沿用 v1.3 惯例）。
5. L1 / L11 / INFO-1 属口径与编号治理，建议在材料阶段一次性收敛，不要为本轮返工。

--------------------------------------------------------------------------------
本报告所引用的每条命令输出均为本次审查会话实跑所得；未跑的命令不写结果，
无法核实的内容一律标注为「报告自述」（本报告中为零处，均已有实物或实测对应）。

VERDICT: PASS
