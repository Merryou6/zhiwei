# 知微 · API 契约（冻结版）

> 冻结于 2026-09-19。**字段名与接口签名以本文档为唯一依据。**
> 任何修改必须两人同意，并在 §11 变更记录留痕。单方面改动 = 联调事故。

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
        "reports": [ { "chapter": "二次函数", "level": 1|2|3|4|5 } ] }   // 章节粒度，≤6 项
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

---

## 11. 变更记录

| 日期 | 变更内容 | 提议 | 同意 |
| --- | --- | --- | --- |
| 2026-09-19 | 初版冻结（17 个接口 + 八张表字段） | 甲 | 乙 |
| 2026-09-19 | **自审修订 v1.1**：① 新增 recognitions 表与 GET /api/evidence/paper/{id}（识别结果持久化）；② verify 改传 answer、服务端判卷；③ diagnose/submit 增 mode、correct 仅测量模式返回；④ next 移除冗余 pool 参数；⑤ 新增 GET /api/attribution/{id}；⑥ path/suspect/dedup 统一完整 kp id；⑦ dedup 幂等不算 409；⑧ classify 枚举来源澄清；⑨ token 无状态签名机制；⑩ item_sequence 返回完整题对象。共 19 个接口 + 九张表 | 甲 | 乙 |
| 2026-09-24 | **v1.2**：① space/create 新增可选 `name`，空间唯一约束由「同学科」改为「同用户同名」（409 语义与 `existing_space_id` 保留，§0 错误码表 409 行同步改写——本版唯一一处原文字句修改）；② 新增 #20 GET /api/user/profile（只读，不下发 password_hash / ZHIWEI_LLM_API_KEY） | 项目方 | 总控 |
