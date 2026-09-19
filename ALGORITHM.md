# 知微 · 算法规格（实现的唯一依据）

> 本文件把方案 v3 中所有"涉及计算"的部分改写为可直接转代码的规格。
> AI 实现时以本文件为准；与叙事文档冲突时，**以本文件为准**。

---

## 0. 参数总表（全部外置 `config/params.json`，禁止硬编码）

| 参数 | 默认值 | 用途 |
| --- | --- | --- |
| `P_S` | 0.10 | 失误率 |
| `P_G` | 0.20 | 猜测率 |
| `P_T` | 0.15 | 学习迁移率 |
| `W_DIAGNOSE` | 1.00 | 测评证据权重 |
| `W_PAPER` | 0.80 | 试卷证据权重 |
| `ALPHA_SILENT` | 0.10 | 静默弱负证据衰减 |
| `PRIOR_MAP` | {1:0.10, 2:0.30, 3:0.50, 4:0.70, 5:0.85} | 自报 → P(L0) |
| `PRUNE_THRESHOLD` | 0.40 | 拓扑剪枝阈值 |
| `EXIT_UPSTREAM_THRESHOLD` | 0.60 | 退出通道回溯阈值 |
| `SUSPECT_BASE` | 0.60 | 嫌疑分衰减底数 |
| `MAX_DEPTH` | 3 | 归因回溯最大跳数 |
| `MAX_EXIT_HOPS` | 2 | 退出通道连续跳转上限 |
| `CONF_ADOPT` | 0.60 | 诊断采纳阈值 |
| `CONSEC_FALSE_EXIT` | 3 | 连续无进展轮数触发退出 |
| `MAX_ITEMS` | 10 | 单次测评题量上限 |
| `CONV_VAR` | 0.10 | 收敛方差代理阈值 |
| `CLAMP` | [0.01, 0.99] | P(L) 取值夹取 |

**全部参数学科无关、全局共用**。调参（9/24）只改此文件，不动代码。

---

## 1. 加权 BKT 更新（纯计算，全程不调用大模型）

```text
function update_mastery(P_L, is_correct, w):
    P_L = clamp(P_L, 0.01, 0.99)
    if w == 0: return (P_L, P_L, P_L)            # 完全不采纳
    # ① 标准贝叶斯后验
    if is_correct:
        P_obs = P_L*(1-P_S) / ( P_L*(1-P_S) + (1-P_L)*P_G )
    else:
        P_obs = P_L*P_S   / ( P_L*P_S   + (1-P_L)*(1-P_G) )
    # ② 证据权重插值
    P_eff = w*P_obs + (1-w)*P_L
    # ③ 学习迁移
    P_new = P_eff + (1-P_eff)*P_T
    return (P_obs, P_eff, clamp(P_new))
```

**自检用例（必须写成单元测试，3 条全过才算实现完成）：**

| P_L | 对错 | w | 期望 P_new |
| --- | --- | --- | --- |
| 0.5 | 对 | 1.0 | **0.845** |
| 0.5 | 对 | 0.8 | **0.791** |
| 0.5 | 错 | 1.0 | **0.244** |

**弱负证据（静默/对话传图求助）**：不走 BKT，`P_new = P_L × (1 − ALPHA_SILENT)`。
**去重**：`dedup_key = {user_id}:{space_id}:{kp}:{source}:{hour_bucket}`（hour_bucket = floor(unix/3600)），同 key 1 小时内只计一次。
**幂等**：更新前查 evidence_events.dedup_key，命中则跳过整个更新流程。
**留痕**：每次更新写 mastery_logs（before / p_obs / p_eff / after / weight / triggered_by）——答辩"可解释"的实证。

---

## 2. 自适应选题

```text
function next_item(space, mode):
    # ① 拓扑剪枝：所有先修节点 mastery ≥ PRUNE_THRESHOLD 的知识点才可测
    #    （先修为空的根节点天然可测；被剪枝点标记"未具备学习条件"）
    # ② 在可测集合中选 |mastery − 0.5| 最小者（信息增益最大）
    # ③ 从对应 pool 取题，排除 evidence_events 中已出现过的 item_id
    #    mode=diagnose  → train 池；mode=baseline/retest → retest 池
    #    （pool 由服务端按 mode 推导，前端不传 pool）
    # ④ 收敛判定：方差代理 V = P*(1−P) < CONV_VAR，或已答 ≥ MAX_ITEMS
    # ⑤ 提交时 evidence_events 落 mode 字段（diagnose/baseline/retest）
    #    ——报告页 ΔAccuracy 按 mode 分组统计
```

> 方案原文"后验方差低于阈值"的工程实现取 `P(1−P)` 代理（V<0.10 等价于 P<0.112 或 P>0.888）。
> 诊断模式 `correct` 字段不回传前端（防学生反推答案污染数据）。

---

## 3. 错误类型诊断（模型受约束的结构化调用）

**输入**：题干 + 学生作答原文 + 该 kp 的 `typical_errors` 列表。

**Prompt 三条硬规则**：
1. 先复述"学生具体错在哪一步"，**再**判定类型（先观察后判断）
2. `error_type` 只能从五值枚举选；`matched_typical_error` 只能从给定列表的 code 里选，**禁止发明**
3. 严格输出 JSON（schema 见 API_CONTRACT §6）

**后处理（代码侧，不采信模型）**：
- `confidence < CONF_ADOPT` → status=clarify，向学生追问
- `attribution_direction` 由服务端映射表硬编码：

| error_type | direction | 后续动作 |
| --- | --- | --- |
| prerequisite_gap | upstream | 触发先修回溯 |
| concept_confusion | self | 根因即本节点，直接处方 |
| method_gap | self | 根因即本节点，直接处方 |
| procedural_slip | none | 转熟练度训练，**不进归因** |
| misreading | none | 转审题训练，**不进归因** |

---

## 4. 归因定位

```text
function attribute(kp, error_type):
    direction = MAP[error_type]                     # §3 映射表
    if direction == "self":
        root_cause = kp; path = [kp]                # 不回溯
        → plan.generate(strategy 按 error_type)
    if direction == "upstream":
        candidates = BFS 反向沿先修, 深度 ≤ MAX_DEPTH
        for a in candidates:
            suspect[a] = SUSPECT_BASE^dist(a) * (1 − mastery(a))
        降序逐个出最小验证题（train 池, 难度取该 kp 最低）:
            答对 → 确认根因, verified=true, 记录 verified_by=evt_id
            答错 → 排除, 取次高嫌疑继续
        全部排除 → root_cause 回落为本节点（诚实兜底, 不硬猜）
    写 attributions(path, suspect_scores, verified, rejected_by_student=false)
```

**处方策略枚举**（plan.strategy 由 error_type 决定）：concept_confusion → 对比辨析；method_gap → 思路示范；prerequisite_gap → 先补上游 + 上游讲解。
**巩固题序列**：从根因沿先修**正向**排布，难度递增，全部来自 train 池。

> ⚠️ 勘误：方案原文 `suspect_scores` 示例中 0.72 超出公式上界（d=1 最大 0.60，d=2 最大 0.36），属笔误。**以本规格公式为准**，演示数据需按公式重新生成。

---

## 5. 退出通道（状态机）

**每轮对话模型输出结构化字段**（代码只读字段，不解析自然语言）：

```json
{ "reply": "...", "progress": false,
  "progress_reason": "学生仍在猜测顶点坐标的符号",
  "next_action": "continue" }
```

**状态机**：
- `consecutive_false` 计数器：progress=true 清零，false 加一
- `consecutive_false ≥ CONSEC_FALSE_EXIT(3)` → 触发：
  1. 当前 kp 置 `blocked_by_prerequisite`
  2. 沿先修找**最近**的 `mastery < EXIT_UPSTREAM_THRESHOLD(0.6)` 上游
  3. 输出告知话术（PRD §6），不让学生以为是自己笨
  4. 在上游节点重启引导
- 连续跳转 ≤ `MAX_EXIT_HOPS(2)`，防止一路滑到底

**提示阶梯**：连续 2 次答不上 → 方向性提示；≥3 次 → 完整解法 + "想直接看解法"出口。

**反向校验（离线）**：脚本比对 `dialogs.progress` 与该 kp 下一题 evidence_events 实际结果，输出校准报告——演示"误判率可控"用，不做实时逻辑。

---

## 6. 掌握度状态带（界面呈现）

| 区间 | 状态 | 颜色 |
| --- | --- | --- |
| `< 0.4` | 待巩固 | 暖橙 |
| `0.4 – 0.6` | 不稳定 | 黄 |
| `0.6 – 0.8` | 基本掌握 | 浅青绿 |
| `> 0.8` | 已掌握 | 青绿 |

---

## 7. 复测指标计算

```
ΔAccuracy = retest_accuracy − baseline_accuracy
缺口已修复 ⇔ ΔAccuracy ≥ 0.3 且 retest_accuracy ≥ 0.75
```

- baseline / retest 均从 **retest 池**取题（不同题、同池），与 train 池 item_id 零重叠
- 隔离由校验脚本保证（DATA_SCHEMA §6），不由人肉核验

---

## 8. 明确不做（防止 AI"顺手实现"）

- 不存掌握度历史快照（只存当前值 + 日志）
- 不做并发锁 / 事务
- 不做参数按学科隔离（全部全局共用）
- BKT 更新全程**不调用大模型**
- 归因回溯不超出 MAX_DEPTH；退出跳转不超出 MAX_EXIT_HOPS
- 不解析模型自然语言输出做任何决策（一切以结构化字段 + 服务端映射表为准）
