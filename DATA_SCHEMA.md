# 知微 · 数据结构规格

> 静态数据（随仓库走）+ 运行时数据（CloudBase 文档数据库）的完整定义。
> 字段名与 API_CONTRACT.md 保持一致；两处冲突时以 API_CONTRACT.md 为准并立即同步。

---

## 1. 文件总览

```
config/params.json                    算法参数（定义见 ALGORITHM §0）
data/knowledge/index.json             学科索引
data/knowledge/math/cz.json           初中数学 20 节点知识图谱
data/item_bank/math/cz.json           题目库（≥200 题，双池）★方案缺口，本版补齐
scripts/validate_data.py              静态数据校验（CI 必跑）
scripts/seed.js                       item_bank 种子写入（幂等）
docs/PRD.md | API_CONTRACT.md | ALGORITHM.md | DATA_SCHEMA.md
```

---

## 2. 知识库 JSON

### 2.1 index.json

```json
{ "subjects": [ { "key": "math",
    "stages": [ { "key": "cz", "name": "初中数学", "kb_id": "kb_math_cz",
                  "file": "data/knowledge/math/cz.json" } ] } ] }
```

### 2.2 节点字段规格（cz.json → nodes[]）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | string | ✔ | `math.cz.{chapter}.{point}`，全局唯一 |
| `name` | string | ✔ | 中文展示名 |
| `subject` / `stage` / `grade` / `chapter` | string | ✔ | 分类信息 |
| `difficulty` | number | ✔ | 1–5 |
| `source.standard` | string | ✔ | 固定"义务教育数学课程标准（2022年版）" |
| `source.item` | string | ✔ | 课标条目（如"第三学段·数与代数·函数·二次函数"） |
| `source.type` | string | ✔ | `direct`（直接对应）/ `derived`（推导） |
| `prerequisites` | string[] | ✔ | 先修节点 id 列表（可为空数组） |
| `prerequisite_basis` | string | ✔ | 固定"教材章节顺序 + 学科逻辑推导，非课标直接规定" |
| `successors` | string[] | ✔ | 后继节点 id 列表（与 prerequisites 互逆） |
| `typical_errors` | object[] | ✔ | **每节点 3–5 条，必须配满** |
| `typical_errors[].code` | string | ✔ | 如 `sign_confusion`，节点内唯一 |
| `typical_errors[].desc` | string | ✔ | 识别特征，一句话 |
| `typical_errors[].error_type` | string | ✔ | 五类枚举之一 |
| `typical_errors[].remedy` | string | ✔ | 补救话术/策略 |
| `sample_items` | string[] | ✔ | 引用 item_bank 的 item_id（可先空数组） |

### 2.3 完整节点样例（可直接复制作模板）

```json
{
  "id": "math.cz.quadratic.vertex_form",
  "name": "二次函数的顶点式",
  "subject": "数学", "stage": "初中", "grade": "九年级",
  "chapter": "二次函数", "difficulty": 3,
  "source": {
    "standard": "义务教育数学课程标准（2022年版）",
    "item": "第三学段·数与代数·函数·二次函数", "type": "derived" },
  "prerequisites": ["math.cz.quadratic.completing_square", "math.cz.function.graph"],
  "prerequisite_basis": "教材章节顺序 + 学科逻辑推导，非课标直接规定",
  "successors": ["math.cz.quadratic.extremum"],
  "typical_errors": [
    { "code": "sign_confusion", "desc": "顶点坐标 h、k 的符号混淆",
      "error_type": "concept_confusion",
      "remedy": "用 y=(x−h)²+k 与 y=(x+2)²+3 对照，强化'括号内取反'规则" },
    { "code": "no_vertex_form", "desc": "不会用配方法把一般式化为顶点式",
      "error_type": "method_gap",
      "remedy": "演示配方法三步：提系数、配一次项一半的平方、还原" }
  ],
  "sample_items": ["q_cz_vertex_001"]
}
```

**结构约束**（校验脚本执行）：id 唯一；prerequisites/successors 引用存在且互逆；无环（DAG）；error_type ∈ 五类枚举；typical_errors 每节点 ≥3 条。

---

## 3. 题目库 JSON ★本版新增（方案 v3 的缺口）

文件：`data/item_bank/math/cz.json`

### 3.1 字段规格

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `item_id` | string | ✔ | `q_{stage}_{kp短名}_{序号}`，如 `q_cz_vertex_007`，全局唯一 |
| `knowledge_point` | string | ✔ | 所属知识点 id |
| `pool` | string | ✔ | `train` / `retest`，互斥 |
| `type` | string | ✔ | `choice` / `fill` / `short_answer` |
| `difficulty` | number | ✔ | 1–5 |
| `stem` | string | ✔ | 题干 |
| `options` | string[] |  | 选择题选项，其他题型为 null |
| `answer` | string | ✔ | 标准答案（服务端判定，不下发前端） |
| `solution_steps` | string[] | ✔ | 分步解答（讲解素材 + 自检对照） |
| `distractors` | object[] |  | 错误答案 → 典型错误绑定 |
| `distractors[].answer` | string | ✔ | 学生典型错误答案 |
| `distractors[].typical_error_code` | string | ✔ | 必须存在于该 kp 的 typical_errors |
| `distractors[].explanation` | string | ✔ | 一句话说明错因 |

### 3.2 题目样例

```json
{
  "item_id": "q_cz_vertex_003",
  "knowledge_point": "math.cz.quadratic.vertex_form",
  "pool": "retest", "type": "fill", "difficulty": 3,
  "stem": "抛物线 y = (x + 2)² + 3 的顶点坐标是____。",
  "options": null,
  "answer": "(-2, 3)",
  "solution_steps": ["顶点式 y=(x−h)²+k 中顶点为 (h,k)",
                     "y=(x+2)²+3 即 y=(x−(−2))²+3", "故 h=−2, k=3，顶点 (−2, 3)"],
  "distractors": [
    { "answer": "(2, 3)", "typical_error_code": "sign_confusion",
      "explanation": "未对括号内取反，h 符号错误" }
  ]
}
```

### 3.3 配额（校验脚本按此断言）

| 池 | 每知识点 | 说明 |
| --- | --- | --- |
| `train` | ≥ 5 | 覆盖难度 1–5；诊断 + 巩固 + 验证题共用 |
| `retest` | ≥ 6 | 基线 3 + 复测 3（同一学生两次测量不重复出题） |

20 节点 × ≥11 = **≥220 题**。**题目由模型生成后必须逐题人工验算**（AI 出数学题错误率不低，错题直接剔除）。

> `distractors` 的价值：错误诊断时学生答案可直接匹配 typical_error_code，置信度显著提升；同时它就是"归因认可率"实验的素材库。

---

## 4. 运行时九张表（CloudBase 文档数据库）

| 表 | 隔离键 | 写入方 | 索引 |
| --- | --- | --- | --- |
| `users` | — | register/login | identifier 唯一 |
| `spaces` | user_id | register / space/create | user_id |
| `mastery_profiles` | user_id + space_id | self-report / diagnose / paper / agent | (user_id, space_id) |
| `evidence_events` | space_id | 四路采集接口 | space_id；**dedup_key 唯一** |
| `mastery_logs` | space_id | 随掌握度更新 | space_id |
| `attributions` | space_id | attribution/* | space_id |
| `dialogs` | space_id | agent/chat | (space_id) |
| `item_bank` | —（静态种子，运行时只读） | seed 脚本 | pool + knowledge_point |
| `recognitions` | space_id | evidence/paper | space_id |

> 若平台不支持唯一索引，dedup 采用"提交前先查后写"实现，效果等价。

### 4.1 users
```json
{ "user_id": "u_1024", "identifier": "138****0000", "password_hash": "bcrypt",
  "nickname": "小林", "created_at": "2026-09-24T20:00:00Z" }
```

### 4.2 spaces
```json
{ "space_id": "sp_001", "user_id": "u_1024", "name": "初中数学", "subject": "数学",
  "knowledge_source": ["kb_math_cz"], "is_default": true,
  "created_at": "2026-09-24T20:00:00Z" }
```
> `knowledge_source` 存数组（一对多留后门，将来升级不改表）。

### 4.3 mastery_profiles（系统承重墙）
```json
{ "user_id": "u_1024", "space_id": "sp_001",
  "knowledge_point": "math.cz.quadratic.vertex_form",
  "mastery": 0.62, "evidence_count": 7, "p_l0": 0.50,
  "status": "active",
  "last_updated": "2026-09-24T20:15:00Z", "last_evidence_type": "paper" }
```
> `status`: `active` | `blocked_by_prerequisite`（退出通道写入）。

### 4.4 evidence_events（四路统一 schema，系统承重墙）
```json
{ "event_id": "evt_8821", "user_id": "u_1024", "space_id": "sp_001",
  "knowledge_point": "math.cz.quadratic.vertex_form",
  "item_id": null,
  "source": "paper", "mode": null, "result": "wrong", "weight": 0.80, "alpha": null,
  "raw": { "image_url": "cos://.../seq_3.jpg", "student_answer": "(2,3)" },
  "dedup_key": "u_1024:sp_001:math.cz.quadratic.vertex_form:paper:491588",
  "expire_at": "2026-10-24T20:10:00Z", "created_at": "2026-09-24T20:10:00Z" }
```
> `source`: `silent | paper | diagnose | self_report`（self_report 实际不落此表，枚举保留）。
> `mode`: `diagnose | baseline | retest | null`——**仅 source=diagnose 时非空**，用于报告页分组计算基线/复测正确率（ΔAccuracy 的数据来源）。
> `item_id`：diagnose 类事件必填；silent/paper 为 null（试卷题不在 item_bank 内）。
> `expire_at` 为试卷图片保留期限（合规项）。`dedup_key` 中 kp 用**完整 id**；小时桶 = floor(unix_ts / 3600)。

### 4.5 mastery_logs（可复现性）
```json
{ "log_id": "log_3391", "user_id": "u_1024", "space_id": "sp_001",
  "knowledge_point": "math.cz.quadratic.vertex_form",
  "before": 0.500, "p_obs": 0.818, "p_eff": 0.754, "after": 0.791,
  "weight": 0.80, "triggered_by": "evt_8821", "created_at": "2026-09-24T20:15:00Z" }
```

### 4.6 attributions
```json
{ "attribution_id": "attr_502", "user_id": "u_1024", "space_id": "sp_001",
  "from_kp": "math.cz.quadratic.extremum",
  "root_cause": "math.cz.quadratic.vertex_form",
  "error_type": "prerequisite_gap",
  "path": ["math.cz.quadratic.extremum", "math.cz.quadratic.vertex_form"],
  "suspect_scores": { "math.cz.quadratic.vertex_form": 0.43 },
  "verified": true, "verified_by": "evt_8825", "rejected_by_student": false,
  "created_at": "2026-09-24T20:20:00Z" }
```
> path / suspect_scores 的键一律用**完整 kp id**（归因结果页回显 + 图谱高亮直接可 join）。
> suspect_scores 必须由 ALGORITHM §4 公式算出（上限：d=1 → 0.60，d=2 → 0.36）。

### 4.7 dialogs
```json
{ "dialog_id": "dlg_001", "user_id": "u_1024", "space_id": "sp_001",
  "kp_id": "math.cz.quadratic.vertex_form",
  "messages": [
    { "role": "student", "content": "这道题我不会", "image_file_id": "cos://...", "ts": "..." },
    { "role": "agent", "content": "你先说说…", "progress": false,
      "progress_reason": "学生仍在猜顶点符号", "next_action": "hint_down", "ts": "..." } ],
  "consecutive_false": 2, "exit_count": 0, "status": "open",
  "created_at": "..." }
```
> `status`: `open` | `exited`（触发退出通道）| `closed`。

### 4.8 item_bank
结构同 §3 题目样例（种子脚本从静态 JSON 写入，运行时只读）。**answer 字段绝不下发前端**。

### 4.9 recognitions（试卷识别任务）★v1.1 新增
```json
{ "recognition_id": "rec_001", "user_id": "u_1024", "space_id": "sp_001",
  "file_id": "cos://.../paper.jpg",
  "status": "pending_confirm",
  "items": [ { "seq": 1, "stem_excerpt": "求y=x²-4x+7的最小值…",
               "kp_guess": "math.cz.quadratic.extremum",
               "student_answer": "x=2时最小值3",
               "suggested_result": "wrong",
               "crop_url": "cos://.../seq_1.jpg" } ],
  "created_at": "2026-09-24T20:05:00Z", "expire_at": "2026-10-24T20:05:00Z" }
```
> `status`: `pending_confirm | confirmed | failed`。识别结果落库后，
> 学生确认页刷新/重进可凭 recognition_id 回显（对应契约 GET /api/evidence/paper/{id}）。
> confirm 后 status → confirmed；30 天后随 expire_at 清理。

---

## 5. 云存储路径约定

```
{env}/paper/{space_id}/{recognition_id}/{seq}.jpg    试卷切分图
{env}/chat/{space_id}/{dialog_id}/{ts}.jpg           对话上传图
{env}/preset/                                        预置课标/教材 PDF（只读）
```

**合规**：evidence_events.expire_at 到期后清理 raw.image_url（保留统计值，删原图）；提供"删除我的试卷图片"入口。

---

## 6. 校验脚本（scripts/validate_data.py，CI 必跑）

| # | 校验项 | 失败处理 |
| --- | --- | --- |
| 1 | 图谱：id 唯一 / 引用存在 / prerequisites 与 successors 互逆 / DAG 无环 | 阻断 |
| 2 | typical_errors.error_type ∈ 五类枚举；每节点 ≥3 条 | 阻断 |
| 3 | 题库：item_id 全局唯一（即双池天然零重叠）/ kp 引用存在 / pool 合法 | 阻断 |
| 4 | 每知识点 train ≥5、retest ≥6 | 阻断（9/21 题库交付前必须全部满足） |
| 5 | distractors.typical_error_code 存在于该 kp 的 typical_errors | 阻断 |
| 6 | 输出统计报告：节点数 / 错误条数 / 题数 / 各池配额 | → 直接贴进 PPT"工程完整性"页 |

---

## 7. 种子脚本（scripts/seed.js）

读 `data/item_bank/math/cz.json` → 按 item_id upsert 写入 `item_bank` 表（幂等，可重复执行）。
知识库 JSON 不入库（体量小，随前端打包/云函数读取静态文件均可）。
