# 知微 · API 契约（冻结版）

> 冻结于 2026-09-19。**字段名与接口签名以本文档为唯一依据。**
> 任何修改必须两人同意，并在 §12 变更记录留痕。单方面改动 = 联调事故。

---

## 0. 全局约定

- 部署：腾讯云 CloudBase 云函数，路径前缀 `/api`
- 认证：除 `register` / `login` 外，所有请求头必须带 `Authorization: Bearer <token>`
- 统一响应体：`{ "code": number, "msg": string, "data": T | null }`
- 时间格式：ISO8601 UTC 字符串（如 `2026-09-24T20:10:00Z`）
- ID 前缀：用户 `u_`、空间 `sp_`、证据事件 `evt_`、掌握度日志 `log_`、归因 `attr_`、对话 `dlg_`、题目 `q_`、识别任务 `rec_`
- 知识点 ID 格式：`math.cz.{chapter}.{point}`，全集见 `data/knowledge/math/cz.json`
- **运行时表除 `users` / `item_bank` / `recognitions` 外全部带 `space_id`；所有写接口必须校验 `space_id` 归属当前用户，否则返回 403**
- 枚举值一律小写，区分大小写
- 知识点在请求/响应/存储中一律使用**完整 id**（如 `math.cz.quadratic.vertex_form`），禁止短名

**错误码表（全部接口共用，不扩展）：**

| code | 含义 |
| --- | --- |
| 0 | 成功 |
| 400 | 参数缺失/非法 |
| 401 | 未认证 / token 无效 |
| 403 | 越权（space_id 不属于当前用户） |
| 404 | 资源不存在 |
| 409 | 冲突（identifier 已注册 / 同名空间已存在） |
| 500 | 内部错误 |
| 502 | 模型上游失败（msg 需含用户可读降级话术） |
| 504 | 模型超时 |

---

## 1. 认证

### POST /api/auth/register
```
req:  { "identifier": "手机号或邮箱", "password": "≥6位", "nickname": "可选" }
res:  data = { "user_id": "u_1024", "token": "长期token" }
错误:  409 identifier 已注册
副作用: 注册成功后服务端【自动创建默认空间】
        （name="初中数学"，knowledge_source=["kb_math_cz"]，is_default=true）
```

### POST /api/auth/login
```
req:  { "identifier": "...", "password": "..." }
res:  data = { "user_id": "u_1024", "token": "..." }
```

> 明确不做：验证码、密码找回、刷新 token、登出接口（前端删 localStorage 即可）。
> Token 机制：**无状态签名** `token = HMAC(user_id, SERVER_SECRET)`，不落库；SERVER_SECRET 放云函数环境变量。校验 = 解出 user_id + 验签。

### GET /api/user/profile  【#20 · v1.2 新增，只读】
```
res:  data = { "user":  { "user_id": "u_1024", "identifier": "手机号或邮箱",
                          "nickname": "可选，未设置为 null", "created_at": "2026-09-24T20:10:00Z" },
               "spaces": [ { "space_id", "name", "subject", "knowledge_source": [],
                             "is_default", "created_at" } ],
               "model": { "mode": "local", "name": "模型名（仅 mode=remote 有值，否则 null）" } }
```
说明: 只读（无写路径）；`user` 为服务端显式构造的字段视图，`password_hash` 绝不下发；
      `spaces` 序列化与本契约 §2 的 list 完全一致（前端一套类型两处复用）；
      `model.mode` 取环境变量 ZHIWEI_MODEL_MODE（`=== "remote"` 才是 `"remote"`，否则 `"local"` 默认），
      `model.name` 仅 remote 时取 ZHIWEI_LLM_MODEL（可为 null）；**ZHIWEI_LLM_API_KEY 绝不下发**。
认证: 需 `Authorization: Bearer <token>`（401 同 §0）。
越权: 无 space_id 入参，越权面在设计上不存在。

---

## 2. 学习空间

### GET /api/space/list
```
res: data = { "spaces": [ { "space_id", "name", "subject", "knowledge_source": [], "is_default", "created_at" } ] }
```

### POST /api/space/create
```
req:  { "knowledge_source": "kb_math_cz" }        // 当前唯一合法值
res:  data = { "space_id": "sp_xxx", "name": "初中数学" }
说明: name 由服务端取知识库名，【不接受客户端传入】（防多空间同学科）
错误:  409 同学科空间已存在，data = { "existing_space_id": "sp_001" }
      前端收到 409 后弹窗，默认按钮是"切换过去"而非"仍要新建"
```

**v1.2 变更（2026-09-24，见 §11；上行原文保留，本节为现行口径）**
```
req:  { "knowledge_source": "kb_math_cz", "name": "可选，1–30 字，缺省由服务端取知识库名" }
      // 合法值：data/knowledge/index.json 的任一 stage.kb_id（kb_math_cz / kb_math_gz）
说明: v1.2 起取消「每学科每用户限一个空间」，改为同一用户内空间名唯一；
      name 由「不接受客户端传入」改为可选传入（旧行为见上行原文）；
      显式传入时校验：非字符串 / trim 后为空 / trim 后超 30 字 → 400（空串不视为缺省）
错误:  409 该用户已有同名空间，data = { "existing_space_id": "sp_001" }
      前端收到 409 后弹窗，默认按钮仍是"切换过去"
```

### GET /api/space/{space_id}/drive  【P1】
```
res: data = { "files": [ { "file_id", "name", "type", "size" } ] }   // 预置课标/教材 + 用户文件
```

---

## 3. 自报先验（通路四）

### POST /api/evidence/self-report
```
req:  { "space_id": "sp_001",
        "reports": [ { "chapter": "二次函数", "level": 1|2|3|4|5 } ] }   // 章节粒度，≤6 项【v1.4 起为 ≤8，见 §11 变更记录】
res:  data = { "updated": 12 }     // 被写入先验的知识点数
规则: level → P(L0) 映射 {1:0.10, 2:0.30, 3:0.50, 4:0.70, 5:0.85}
      仅初始化/覆盖 mastery_profiles 的 p_l0 与 mastery
      【不产生 evidence_events】（自报是先验，不是观测）
      evidence_count > 0 的知识点【不覆盖】（真实证据优先）
```

---

## 4. 测评（通路三，w = 1.0）

### POST /api/diagnose/next
```
req:  { "space_id", "mode": "diagnose" | "baseline" | "retest",
        "scope_chapter": "可选，如'二次函数'",
        "exclude_item_ids": ["可选，前端维护的已出题列表"] }
res:  data = { "item": { "item_id", "stem", "options": [] | null },
               "remaining": 7, "converged": false }
规则: 题池由服务端按 mode 推导（diagnose → train 池；baseline/retest → retest 池），
      【请求不传 pool】，防止两者矛盾
      选题算法见 ALGORITHM §2（拓扑剪枝 + 信息增益 + 已做题排除）
      converged=true 时 item 为 null，前端结束测评
```

### POST /api/diagnose/submit
```
req:  { "space_id", "item_id", "answer": "学生作答原文", "mode": "同 next" }
res:  data = { "correct": true | null,             // 仅 baseline/retest 模式返回；
                                             // diagnose 模式恒为 null，防反推答案
               "mastery_before": 0.50, "mastery_after": 0.845,
               "converged": false,
               "next_item": { ... } | null }
副作用: 判定在服务端（查 item_bank.answer）
        写 evidence_events(source="diagnose", mode=本次mode, w=1.0) + mastery_logs
        幂等：dedup_key 命中【不算错误】，静默返回当前状态、不重复更新（HTTP 200）
```

**v2.1 新增通路（2026-10-08，见 §11）：专项练习 · 逐步批改（source="practice"，w = W_PRACTICE = 0.7）**

取题复用 #7 POST /api/diagnose/next（mode="diagnose"，可选 `scope_chapter` 按章节取题，只取题不落证据）。

### POST /api/grade/steps  【#33 · v2.1 新增】
```
req:  { "space_id", "item_id", "steps": ["第 1 步过程", …] }
                                                   // 1–8 步；元素也可为 { "text": "…" }（两态兼容）
res:  data = { "step_results": [ { "index": 0, "verdict": "pass" | "slip" | "concept_gap" | "unclear",
                                   "matched_error_code": "typical_errors 项 | null",
                                   "feedback": "处方话术（已值级清洗）", "hint": "string | null" } ],
               "overall": { "correct": true | false,        // 最终答案归一化判等
                            "pass_ratio": 0.75,             // pass 步数 / 总步数
                            "first_break_step": 2 | null,   // 首个非 pass 步下标（断点定位）
                            "kp_id", "kp_name" },
               "evidence_written": true,          // dedup 命中幂等时 false
               "weight_applied": 0.7 }            // 实际权重（见下）
规则: 两层匹配——① 步文本与 item.solution_steps 归一化互为包含 → pass；
      ② 步文本命中 item.distractors → slip（procedural_slip / misreading）或 concept_gap；
      ③ ①② 均未命中且该步之后存在 pass → 升格 concept_gap（参照后置正证据）；
         否则 unclear（不计证据、不计 pass）；
      权重：correct ? W_PRACTICE : W_PRACTICE × (1 − pass_ratio / 2)
      （答错但部分步骤正确 → 部分正证据折算；W_PRACTICE ∈ config/params.json，PARAM_KEYS 同步断言）；
      写 evidence_events(source="practice", w=weight_applied) + mastery_logs；
      幂等同 #8：dedup_key 命中不算错误，静默返回当前状态（HTTP 200，evidence_written=false）；
      feedback / hint 经 scrubFeedback 值级清洗：话术片段与 answer 归一化相等且题干未含该值 →
      替换为安全话术（题干本身含该值的豁免，防误伤）；响应过 assertNoForbiddenKeys——
      answer / solution_steps / distractors 永不下发（solution_steps 仅服务端比对用）。
```

---

## 5. 试卷上传（通路二，w = 0.8）

### POST /api/evidence/paper
```
req:  { "space_id", "file_id": "云存储文件ID" }    // 前端先直传云存储拿 file_id
res:  data = { "recognition_id": "rec_001", "status": "pending_confirm",
               "items": [ { "seq": 1, "stem_excerpt": "求y=x²-4x+7的最小值…",
                            "kp_guess": "math.cz.quadratic.extremum",
                            "student_answer": "x=2时最小值3",
                            "suggested_result": "correct" | "wrong" | "unclear" } ] }
持久化: 识别结果整体写入 recognitions 表（九表之一，见 DATA_SCHEMA §4.9），
        刷新页面后可凭 recognition_id 重新拉取，不丢
错误:  502 / 504 → msg = "这道题我没看清，麻烦你手动标一下对错"（用户可读）
```

### GET /api/evidence/paper/{recognition_id}
```
res:  同 /api/evidence/paper 的 data（确认前刷新页面时回显用）
```

### POST /api/evidence/paper/confirm
```
req:  { "recognition_id", "space_id",
        "items": [ { "seq": 1, "kp_id": "math.cz.quadratic.extremum",
                     "result": "correct" | "wrong" } ] }
res:  data = { "events_created": 8,
               "mastery_updates": [ { "knowledge_point", "before": 0.5, "after": 0.79 } ] }
规则: 【unclear 项必须由学生手动标注，服务端拒绝默认值】
      服务端校验 kp_id 存在于知识库，且与 recognitions 记录的 kp_guess 一致或为学生修正值
      逐题写 evidence_events(source="paper", w=0.8, item_id=null, raw 含切分图 URL)
      确认后 recognitions.status → confirmed
      expire_at = now + 30d（试卷图片保留期限，合规项）
```

**v2.1 变更（2026-10-08，见 §11；上行原文保留，本节为现行口径）**

#9 两端点扩展（向后兼容，旧客户端不受影响）：

- `POST /api/evidence/paper` 请求新增**可选** `file_ids: string[]`（多页整卷，1–5 张；
  空数组或超 5 张 → 400，用户可读文案「一次最多传 5 张」）。传 `file_ids` 时优先、忽略 `file_id`，
  recognitions 记 `file_ids` 数组（识别文本按 item_id 跨页去重、seq 重排）；不传时单图行为与 v1.6 一字不变。
- `POST /api/evidence/paper/confirm` 响应 data 追加**冷启动摘要**（追加式，既有字段不变）：
  `bootstrap: { "covered_kps": 8, "band_counts": { "待巩固": 0, "不稳定": 0, "基本掌握": 0, "已掌握": 0 } }`
  ——逐题证据落库后按 engine.masteryToBand 同源统计（四带补 0 口径），
  供前端「初始图谱已生成」横幅与技能树首屏（冷启动叙事：拍一张月考卷就能建图）。

---

## 6. 错误类型诊断（模型受约束调用）

### POST /api/error/classify
```
req:  { "space_id", "item_id": "可选（题库内）",
        "stem": "题干（item_id 为空时必填）", "student_answer": "学生作答原文",
        "kp_id": "匹配到的知识点" }
res(采纳): data = { "status": "adopted",
    "knowledge_point": "...",
    "error_type": "prerequisite_gap|concept_confusion|method_gap|procedural_slip|misreading",
    "matched_typical_error": "sign_confusion | null",
    "confidence": 0.82,
    "evidence": "学生把 y=(x+2)²+3 的顶点写成 (2,3)，未掌握 h 符号规则",
    "attribution_direction": "upstream|self|none" }
res(低置信): data = { "status": "clarify", "question": "你这一步是怎么算的？能写一下吗？" }
规则: confidence < 0.6 → 一律退回 clarify，禁止采纳
      error_type 从【五值全局枚举】中选；matched_typical_error 只能从该 kp 的
      typical_errors[].code 中选（无匹配可为 null）——两者约束来源不同
      attribution_direction 由服务端映射表硬编码，不采信模型输出
```

---

## 7. 归因

### POST /api/attribution/analyze
```
req:  { "space_id", "kp_id": "出错知识点", "error_type": "...", "evidence_event_id": "可选" }
res:  data = { "attribution_id": "attr_502",
               "root_cause": "math.cz.quadratic.completing_square",
               "path": ["math.cz.quadratic.extremum", "math.cz.quadratic.vertex_form",
                        "math.cz.quadratic.completing_square"],   // 完整 id，终点=根因
               "suspect_scores": { "math.cz.quadratic.vertex_form": 0.43,
                                   "math.cz.quadratic.completing_square": 0.29 },
               "verification_item": { "item_id", "stem", "options" } | null }
规则: error_type ∈ {concept_confusion, method_gap}（self）时
      path=[kp_id]、verification_item=null（根因即本节点，无需验证）
前置: error_type 为 procedural_slip / misreading 时【前端不得调用本接口】（不进归因）
算法: ALGORITHM §4
```

### GET /api/attribution/{attribution_id}
```
res:  data = 同 analyze 的 data（归因结果页刷新回显用，含 rejected_by_student）
```

### POST /api/attribution/verify
```
req:  { "attribution_id", "item_id": "验证题", "answer": "学生作答原文" }
res:  data = { "verified": true, "correct": true,        // 对错由服务端判定
               "root_cause": "...",
               "next_candidate": { "kp_id", "suspect_score", "verification_item" } | null }
规则: correct=false → 排除当前候选，返回次高嫌疑及其验证题
      候选全部排除 → root_cause 回落为本节点（from_kp），verified=true
      验证题作答写 evidence_events(source="diagnose", mode="diagnose", w=1.0)
```

### POST /api/agent/reject
```
req:  { "attribution_id", "reason": "可选，学生反驳理由" }
res:  data = { "verification_item": { ... } }     // 追加一道再验证题
副作用: attributions.rejected_by_student = true
```

---

## 8. 处方生成

### POST /api/plan/generate
```
req:  { "space_id", "root_cause": "kp_id", "error_type": "..." }
res:  data = { "strategy": "对比辨析",              // 按错误类型选择，枚举见 ALGORITHM §4
               "explanation_outline": ["..."],
               "item_sequence": [ { "item_id", "stem", "options", "difficulty" } ],
                                                   // 完整题对象，从根因正向排布、难度递增
               "path": ["kp_id 完整id", ...] }      // 图谱高亮用
```

---

## 9. 智能体对话（SSE）

### POST /api/agent/chat
```
req:  { "space_id", "dialog_id": "续聊时传", "message": "学生发言",
        "image_file_id": "可选，读题图片" }
Content-Type: text/event-stream，事件序列：
  event: delta   data: { "text": "增量文本" }
  event: meta    data: { "dialog_id", "kp_match": { "kp_id", "confidence" },
                         "progress": false, "progress_reason": "仍在猜顶点符号…",
                         "next_action": "continue|hint_down|give_solution|exit_channel" }
  event: done    data: { }
降级: SSE 中断时退化为普通 JSON（结构 = 全文 reply + meta），禁止白屏
规则: 首轮带 image_file_id → 先读题（模型给出 Top-3 候选，meta 中返回最优一个）
      kp 匹配置信度 < 0.6 → 智能体先追问澄清题目内容，【不产生证据】
      匹配置信度 ≥ 0.6 → 产生弱负证据（source="silent", α=0.10，1 小时去重，见 ALGORITHM §1）
      progress 由代码读结构化字段判定，不解析自然语言
      连续 3 轮 progress=false → 服务端将 next_action 置为 exit_channel（状态机见 ALGORITHM §5）
```

**v1.5 变更（2026-10-08，见 §11；上行原文保留，本节为现行口径）**

#18 /api/agent/chat 请求新增**可选**字段 `image_data`（传图读题的图片本体）：

- 形态：`data:image/*;base64,…` 的 data URL；服务端校验前缀，长度上限 400,000 字符（约对应 300KB 图片），超限 400（用户可读文案「图片太大…」）；
- 允许**纯图发送**：`message` 为空且带 `image_data` 时服务端以中性占位「（发来一张题图）」入库（dialogs 可读、kp 匹配可跑）；纯文本消息仍要求非空；
- **图片不落库**：`image_data` 只在当轮转发给模型适配器；dialogs 仍只记 `image_file_id`（客户端标记，契约字段不变）；
- 适配器行为：远程模式（OpenAI 兼容）将带图轮次升级为 `text + image_url` 多模态 content 块（视觉读题）；本地规则模式无视觉能力，诚实回复看不了图、引导学生改用文字描述（不再伪造读题，D4「未发生的步骤零事件」精神）；
- `image_file_id` 为空 / 未带图的行为与 v1.4 完全一致（向后兼容）。

```

**v1.3 变更（2026-09-24，见 §11；上行原文保留，本节为现行口径）**

新增三类**过程事件**（delta / meta / done / error 四类字段与语义一字不变，旧客户端忽略未知事件即向前兼容）：

| event | data 字段 | 说明 |
| --- | --- | --- |
| phase | `{ "name": "analyze"\|"retrieve"\|"judge"\|"generate", "label": "分析"\|"检索"\|"判定"\|"生成" }` | 阶段标记，同一次请求内可重复出现（judge 之后可回 generate） |
| thought | `{ "text": "增量文本" }` | 拼接即本轮完整思考（语义见下「thought 文案边界」） |
| tool | `{ "id": "step_1", "name": "<ToolName，见下表>", "label": "中文可读名", "status": "running"\|"ok"\|"error", "args"?: object, "result"?: object, "ms"?: number }` | 同 id 至多两次下发（running → 终态），前端按 id upsert；`ms` 为**真实执行耗时** |

**ToolName 闭集（7 项）与真实动作对照**（`args` / `result` 均为服务端真实中间量；未发生的步骤零事件）：

| name | label | 真实动作（代码落点） | args / result |
| --- | --- | --- | --- |
| load_graph | 加载知识图谱 | `nodesForKb(space.knowledge_source[0])` | args `{ kb, node_count }`（无 result） |
| model_call | 调用对话模型 | `createModels().chatTurn(...)` | args `{ mode: "local"\|"remote" }`；result `{ kp_id, confidence, progress }` |
| kp_match | 知识点匹配与采纳 | `CONF_ADOPT` 判定 + 图谱命中校验 | args `{ message_excerpt（≤20 字）}`；result `{ kp_id, confidence, threshold, adopted, fallback_kp_id? }` |
| dedup_check | 弱负证据去重检查（仅采纳时） | `buildDedupKey` + `findEventsByDedupKey` | args `{ kp_id }`；result `{ hit }` |
| apply_evidence | 写入证据与掌握度（仅 dedup 未命中时） | 证据三表写入 | args `{ kp_id }`；result `{ before, after, event_id }` |
| state_machine | 状态机判定 | `consecutive_false` / `next_action` | args `{ progress }`；result `{ consecutive_false, next_action, exit_threshold }` |
| exit_channel | 退出通道·上游回溯（仅触发时） | `searchUpstream` + `MAX_EXIT_HOPS` | args `{ current_kp_id }`；result `{ upstream_kp_id?, upstream_name?, jumped, exit_count, hop_limit }` |

phase 与动作的对应：analyze(load_graph) → retrieve(model_call, kp_match；远程模式另有 thought / delta 增量)
→ judge(dedup_check, apply_evidence, state_machine, exit_channel) → generate(附加段 delta)。

顺序约定：本地模式 phase / thought / tool 全部先于首个 delta；远程模式 thought 与 delta 可在 retrieve 阶段
按模型实际输出序交错到达（不承诺严格「先全部 thought 后全部 delta」）；meta → done 恒为末两个事件。

**JSON 降级（`Accept: application/json` 或 `X-Response-Format: json`）**

`data = { "reply": string, "meta": {…原样…}, "trace": TraceStep[] }`，`trace` 顺序即执行顺序，前端重放为对应回调：

```
{ "type": "phase",   "name", "label" }
{ "type": "tool",    "id", "name", "label", "status"（恒为终态 ok|error）, "args"?, "result"?, "ms"? }
{ "type": "thought", "text" }
```

云函数入口（无法长连接）收集到的缓冲结果与上形完全一致；旧前端只读 reply / meta，多余键自然忽略。

**thought 文案边界（两类模式显式区分，不藏差异）**

- 本地模式：**确定性推理摘要** —— 模板句 + 真实中间量拼成（例：`写入弱负证据：掌握度 0.5 → 0.45`），
  不是伪装成大模型独白的话术；前端思考区标题显示「推理摘要」。
- 远程模式：模型流式输出的 `thought` 字段增量**原样转发**（模型的自述，非隐藏 CoT）；前端标题显示「思考过程」。
- 节奏诚实声明：本地计算在毫秒级完成，服务端**不人为 delay、不伪造 ms**（`tool.ms` 为真实耗时）；
  「流式感」由前端打字机动画呈现，服务端只保证顺序真实、内容真实。

兼容性一行：delta / meta / done / error 的字段与相对顺序（delta… → meta → done，error 仅异常时）一字未改。

---

## 10. 学习报告

### GET /api/report/summary?space_id=xxx
```
res: data = {
  "mastery": [ { "kp_id", "name", "mastery": 0.62, "status_band": "不稳定" } ],
  "gaps": [ { "kp_id", "name", "mastery", "error_type_last" } ],      // <0.4 清单
  "accuracy": [ { "kp_id", "baseline": 0.33, "retest": 0.80, "delta": 0.47 } ] }
规则: accuracy 按 evidence_events(source="diagnose") 分组统计——
      mode=baseline 的事件算基线正确率，mode=retest 的事件算复测正确率
```

**v2.1 新增（2026-10-08，见 §11）：#32 GET /api/graph/mastery —— 技能树唯一数据源**

### GET /api/graph/mastery?space_id=xxx  【#32 · v2.1 新增】
```
res:  data = {
  "space_id": "sp_001",
  "nodes": [ { "kp_id", "name", "chapter", "mastery": 0.62,
               "band": "四带（engine.masteryToBand，与 #19 status_band 同源）",
               "evidence_count": 5,
               "last_evidence_type": "silent | paper | diagnose | self_report | practice | null",
               "last_updated": "ISO8601 | null",
               "confidence": "normal" | "low" } ],
  "summary": { "total_kp", "covered_kp",
               "band_counts": {四带，补 0 口径},
               "evidence_total": 42,
               "newly_mastered_7d": 3,           // mastery_logs 近 7 天跨入「已掌握」阈值的节点数
               "weakest": [ { "kp_id", "name", "mastery" } ] } }  // 待巩固按 mastery 升序前 3
规则: band 一律服务端 engine.masteryToBand 同源计算，前端只消费不重算（纪律同 #19）；
      confidence = "low" ⇔ last_evidence_type ∈ {paper, self_report}
      （仅旧试卷/自报触达，建议复测校准；前端渲染为节点 ？ 角标）；
      零证据空间正常返回：全节点待巩固、summary 全 0 口径（冷启动「先看空白树」入口）；
      响应显式字面构造，不下发 answer / 对话原文 / 分数明细（成长海报数据面同口径）。
```

---

## 11. 专项练习与概念知识库  【v2.2-m1 新增】

> v2.2 支柱②「系统性刷题」+ 支柱⑤「概念给体系」+ 支柱⑥「推理给阶梯」的接口层。
> 三个端点全部为只读 GET；practice 证据仍只由 #33 grade/steps 写入（本节端点不落证据）。

### GET /api/practice/ladder?space_id=xxx&chapter=yyy[&size=n]  【#34 · v2.2-m1 新增】
```
res:  data = {
  "space_id", "chapter",
  "requested_size": 5,               // 缺省 5，服务端夹取 [1, 8]
  "refilled": false,                 // 剩余新题不足时回流整章题库（第二轮起 true）
  "items": [ { "item_id", "seq", "kp_id", "kp_name", "chapter", "difficulty",
               "type", "stem", "options", "approach", "hint" } ] }
规则: train 池按章过滤 → 排除该学生 practice 证据已练 item_id → 不足 requested_size 时
      回流整章（refilled=true，阶梯可反复刷）→ 难度升序（同难度按 item_id 稳定排序）；
      approach / hint 为提示链 L1/L2（概念卡核心方法与通俗思路，知识点级），
      **不含本题解答、不泄题**；第三级引导就是 #33 逐步批改本身；
      响应显式字面构造，无 answer / solution_steps / distractors（assertNoForbiddenKeys）。
错误: 401 / 403 / 400（缺参、章节不存在、该章暂无练习题）
```

### GET /api/practice/progress?space_id=xxx[&chapter=yyy]  【#35 · v2.2-m1 新增】
```
res:  data = {
  "space_id",
  "chapters": [ { "chapter", "submissions", "practiced_items", "correct",
                  "avg_pass_ratio": 0.75 | null, "last_practiced_at": "ISO8601" | null } ],
  "overall": { 同单章结构，跨章求和口径 } }
规则: 对 practice 证据（source="practice"）按章聚合——submissions 提交次数、
      practiced_items 去重题数、correct 全对题次、avg_pass_ratio 为 raw.pass_ratio 均值
      （无数据 null）；可按 chapter 过滤；纯只读聚合，不落任何证据。
错误: 401 / 403 / 400（缺参）
```

### GET /api/concepts?space_id=xxx[&chapter=yyy]  【#36 · v2.2-m1 新增】
```
res:  data = {
  "space_id", "count",
  "cards": [ { "kp_id", "name", "chapter", "definition", "key_points": [],
               "method", "hint",                    // method = 提示链 L1 · hint = 提示链 L2
               "classic_example": { "stem", "steps": [] },  // 独立撰写的典型例（讲透，非题库题）
               "common_errors": [], "related": [] } ] }     // related 为关联知识点完整 id
规则: 数据源 data/knowledge/math/cz_concepts.json（24 卡，与 cz.json 节点一一对应，人工撰写）；
      概念问答给体系（支柱⑤）：概念不是不给答案，而是给完整知识体系、做到触类旁通——
      classic_example 是独立撰写的示例题，因此可以完整讲透；
      题库题的 answer / solution_steps 红线不变；
      kb 隔离：按 kp_id 是否属于该空间知识库过滤（gz 空间自然得空集 count=0）。
错误: 401 / 403 / 400（缺参、知识库为空、章节无卡）
```

**数据资产（v2.2-m1）**：`data/knowledge/math/cz_concepts.json` —— 24 张概念卡，每卡
definition / key_points / method(L1) / hint(L2) / classic_example{stem, steps} /
common_errors / related；与 cz.json 的 24 节点一一对应；内容依据课标与教材人工撰写，
扩充新学段 / 新知识点时同步追加（持续工程）。

---

## 12. 变更记录

| 日期 | 变更内容 | 提议 | 同意 |
| --- | --- | --- | --- |
| 2026-09-19 | 初版冻结（17 个接口 + 八张表字段） | 甲 | 乙 |
| 2026-09-19 | **自审修订 v1.1**：① 新增 recognitions 表与 GET /api/evidence/paper/{id}（识别结果持久化）；② verify 改传 answer、服务端判卷；③ diagnose/submit 增 mode、correct 仅测量模式返回；④ next 移除冗余 pool 参数；⑤ 新增 GET /api/attribution/{id}；⑥ path/suspect/dedup 统一完整 kp id；⑦ dedup 幂等不算 409；⑧ classify 枚举来源澄清；⑨ token 无状态签名机制；⑩ item_sequence 返回完整题对象。共 19 个接口 + 九张表 | 甲 | 乙 |
| 2026-09-24 | **v1.2**：① space/create 新增可选 `name`，空间唯一约束由「同学科」改为「同用户同名」（409 语义与 `existing_space_id` 保留，§0 错误码表 409 行同步改写——本版唯一一处原文字句修改）；② 新增 #20 GET /api/user/profile（只读，不下发 password_hash / ZHIWEI_LLM_API_KEY） | 项目方 | 总控 |
| 2026-09-24 | **v1.3**：① #18 /api/agent/chat 新增 SSE 过程事件 phase / thought / tool（工具名闭集 7 项，tool.args / tool.result 为服务端真实中间量）与 JSON 降级 `trace` 字段（delta / meta / done / error 语义不变，向后兼容）；② 远程模型适配器改 `stream:true` 增量抽取（结构化字段序 thought → reply → …，失败回落纪律不变） | 项目方 | 总控 |
| 2026-09-25 | **v1.4**：#6 self-report `reports` 上限 **≤6 → ≤8**（用户实测 bug：页 2 明示 8 章节可全选、一键「按 3 档填上」也填满 8，提交必 400「reports 最多 6 项」——cz/gz 实测各 8 章节，6 的上限在两个学段都锁不住满选；接口签名与其余语义不变，前端 MAX_REPORTS 同步 + selfReport.test.ts 边界断言改 8/9） | 项目方 | 总控 |
| 2026-09-25 | **v1.4 伴随前端路由收敛（接口层零变更）**：前端路由 `/console`（PRD 页 11 · B 端教师控制台）砍除，其「学习概览」并入 `/me`（页 12 我的）；对话辅导「收进侧栏」导航目标由 `#/console` 改为 `#/me`；前端路由 12 → 11 | 项目方 | 总控 |
| 2026-09-25 | **v1.4 伴随新增公开门户页（接口层零变更）**：新增前端路由 `/`（LandingPage 公开入口门户，介绍项目 / 数据资产 / GitHub 链接 / 「立即体验」CTA）。它**不占 PRD §5 页面编号、不进 ROUTES 11 页口径**（App.tsx 直挂 Route，无守卫无顶栏外壳）；「立即体验」→ `/login` 由既有守卫按会话状态分流（未登录进登录页、已登录直送 `#/spaces`） | 项目方 | 总控 |
| 2026-10-08 | **v1.5**：① #18 /api/agent/chat 新增可选 `image_data`（传图读题图片本体，data URL ≤400K 字符，服务端校验前缀与大小；纯图消息允许 message 为空并以「（发来一张题图）」占位入库；**图片不落库**，dialogs 仍只记 `image_file_id`；远程适配器升级 vision 多模态 content 块，本地适配器诚实告知看不了图，不再伪造读题）；② #7/#8 及全部题目下发接口的 `options` 字段启用「选项化合成」：`type=fill` 且 distractors≥2 的题由服务端把 [标准答案+至多 3 条干扰项答案] 以 item_id 为种确定性洗牌后作为 options 下发（**响应结构零变更**——options 本就是 `string[]\|null`；answer/solution_steps/distractors 对象仍绝不下发；判分仍按归一化文本判等，选错干扰项照常命中 typical_error_code）。两条均为向后兼容的可选增量，旧客户端不受影响 | 项目方 | 总控 |
| 2026-10-08 | **v1.6 双端（老师端 + 学生端增量，#21–#31）**：① `users` 加可选 `role`（`student`（缺省，旧记录读取侧兜底）/`teacher`），register 请求可选 `role`、register/login 响应新增 `role`；② 三张新表 `invite_codes`（6 位码、7 天有效、限 30 人）/`links`（师生绑定，归属到 space）/`recommendations`（推荐闭环 assigned→viewed→in_progress→done/dismissed/expired，`delta_accuracy` 由复测闭环自动回写）；③ 老师端 6 端点（#21 生成邀请码【同师复用活跃码】/#22 码列表/#23 学生摘要列表【聚合层】/#24 学生详情快照【含答卷/答题/错题原文与归因，**对话原文永不下发**】/#25 下发推荐【同生活跃推荐幂等】/#26 推荐列表）；④ 学生端 5 端点（#27 邀请码预览/#28 确认绑定【双向确认：preview 只回老师昵称，confirm 才建立关系；码大小写归一】/#29 我的老师/#30 我的推荐【超窗 14 天未开始视图层标 expired】/#31 推荐反馈【终态不可逆】）；⑤ #8 diagnose/submit 在 mode=retest 落库后回写该 kp 未完结推荐的 ΔAccuracy（同 report 口径 baseline/retest 正确率差），首次回写置 done；⑥ 三条服务端守卫：requireTeacher / requireLinkedSpace / requireStudent。路由表 20 → 31（closedLoop E1 同步）。全部为追加式变更，旧客户端不受影响 | 项目方 | 总控 |
| 2026-10-08 | **v2.1 三张牌（技能树 + 拍卷冷启动 + 逐步批改，#32–#33）**：① 新增 #32 GET /api/graph/mastery（技能树唯一数据源：nodes 全量 kp 掌握度 + band 同源 + confidence{normal,low} + summary{band_counts 补 0、evidence_total、newly_mastered_7d、weakest 前 3}，见 §10 注记）；② 新增 #33 POST /api/grade/steps（分步提交 → 两层匹配逐步判定 pass/slip/concept_gap/unclear + first_break_step 断点定位 + scrubFeedback 值级清洗 + practice 证据 `weight = correct ? W_PRACTICE : W_PRACTICE × (1 − pass_ratio/2)`，幂等同 #8，见 §4 注记）；③ #9 试卷上传扩展（上传可选 `file_ids[]` 多页整卷 1–5 张、file_ids 优先；confirm 响应追加 `bootstrap{covered_kps, band_counts}` 冷启动摘要，见 §5 注记）；④ `EvidenceSource` 枚举追加 `'practice'`（db/types.ts 与 packages/engine/src/dedup.ts 两处同步）；⑤ `config/params.json` 新增 `W_PRACTICE: 0.7`（PARAM_KEYS 17 → 18 项，完整性断言同步）。路由表 31 → 33（closedLoop E1 同步）。全部为追加式变更，旧客户端不受影响 | 项目方 | 总控 |
| 2026-10-09 | **v2.2-m1（系统性刷题 + 概念给体系 + 提示链，#34–#36）**：① 新增 #34 GET /api/practice/ladder（专项阶梯：train 池按章过滤 → 排除已练 item_id → 不足回流整章 refilled=true → 难度升序组一梯子题 [1,8]，每题附提示链 approach(L1)/hint(L2)——概念卡知识点级提示，不含本题解答、不泄题，见 §11）；② 新增 #35 GET /api/practice/progress（练习进度：practice 证据按章聚合 submissions/practiced_items/correct/avg_pass_ratio/last_practiced_at，overall 求和口径，纯只读）；③ 新增 #36 GET /api/concepts（概念知识库：24 张概念卡 definition/key_points/method/hint/classic_example/common_errors/related，kb 隔离过滤，classic_example 为独立撰写示例可完整讲透——「概念不是不给答案，而是给体系」的落点）；④ 新增数据资产 data/knowledge/math/cz_concepts.json（24 卡与 cz.json 节点一一对应）。三个端点均只读、不落证据；practice 证据仍只由 #33 写入。路由表 33 → 36（closedLoop E1 同步）。全部为追加式变更，旧客户端不受影响 | 项目方 | 总控 |
