# 知微 v2.1 实施方案：技能树 · 拍卷冷启动 · 逐步批改

> 对应战略三张牌：①让"越用越懂你"被看见（技能树 2.0）②不刷题也能开始（拍卷建图）③逐步批改做专业感（思路断点定位）。
> 本方案基于 2026-10 代码库现状（v1.6，31 端点）逐文件核对后编写，所有路径与符号均为真实存在的代码。

---

## 0. 现状盘点：地基比想象中好

| 能力 | 现状 | 缺口 |
|---|---|---|
| 知识图谱结构 | `data/knowledge/math/cz.json`：24 节点 / 8 章节，含 `prerequisites`/`successors`/`difficulty`，前端有冻结副本 `apps/web/src/data/graphSnapshot.ts` | 无（结构即用） |
| 图谱可视化 | `apps/web/src/pages/GraphPage.tsx` + `lib/graphLayout.ts`（拓扑分层布局，DAG 确定性坐标） | 只画结构，**没有叠加掌握度** |
| 掌握度数据 | `mastery_profiles` 表 + `statusBand.masteryToBand` 四带口径；前端 `theme/bands.ts` 唯一颜色事实源 | **学生端没有"拉取自己全图谱掌握度"的接口**（老师端有 bandCounts，学生端只有 report/summary 聚合） |
| 试卷通路 | `services/paper.ts`：upload→recognize→confirm，确认后逐题写 `evidence_events(source='paper', w=0.8)`，30 天图片过期合规 | 单图上传（`file_id` 单数）；入口埋在云盘页深处，没当冷启动入口用 |
| 错误知识 | `cz.json` 每节点带 `typical_errors[{code,desc,error_type,remedy}]`（如 `negative_sign_drop` 漏负号+处方话术） | 没有被逐步批改消费 |
| 题库 | `data/item_bank/math/`，含 `answer`/`solution_steps`/`distractors`（禁下发） | 无分步评分规则（rubric） |
| 证据四路 | `EvidenceSource = 'silent' | 'paper' | 'diagnose' | 'self_report'` | 无"练习批改"来源 |

**结论**：三张牌全部是"在既有承重墙上加层"，不需要动九张表结构。

---

## 1. Feature A：技能树 2.0 —— 让"越用越懂你"被看见

### 1.1 新契约 #32：`GET /api/graph/mastery?space_id=`

学生端全图谱掌握度一次拉齐（当前最大缺口）。

```
响应 data:
{
  space_id,
  nodes: [{ kp_id, mastery, band,            // band 用 engine masteryToBand 同源计算，禁止前端重算
            evidence_count, last_evidence_type,
            last_updated,
            confidence: 'low' | 'normal' }], // low = 仅 paper/self_report 单路证据（配合 Feature B）
  summary: {
    band_counts: { 待巩固, 不稳定, 基本掌握, 已掌握 },
    evidence_total,                           // Σ evidence_count → "这张图谱记录了你 N 条学习证据"
    newly_mastered_7d,                        // mastery_logs 中 7 天内 after≥0.8 且 before<0.8 的次数
    weakest: [kp_id...]                       // band 待巩固按 mastery 升序前 3
  }
}
```

实现：新文件 `functions/api/src/services/graph.ts`；`listProfiles` + `listLogsBySpace` 已在 Store 接口中，纯组装。响应显式字面构造，遵守序列化白名单纪律。`router.ts` 注册静态段 `/api/graph/mastery`，与既有参数段无前缀冲突。

### 1.2 GraphPage 升级：从"结构图"到"技能树"

改 `GraphPage.tsx`（353 行）+ `graphLayout.ts`，布局算法不动（分层坐标已确定性，演示可控是既有设计决策）。

**节点视觉状态机**（颜色全部取 `theme/bands.ts` 的 `BAND_HEX`，组件内禁止硬编码 hex）：

| 状态 | 视觉 | 语义 |
|---|---|---|
| 已掌握 | `BAND_HEX` 青绿实心 + 微光环 | 灯亮了 |
| 基本掌握 | 浅青绿实心 | 快亮了 |
| 不稳定 | 黄实心 | 闪断 |
| 待巩固 | 暖橙实心 + 脉动动画（`lib/motion.ts`，2s 循环） | 攻打目标 |
| 未触及（无 profile） | 描边空心 | 未点亮 |
| 锁定 | 灰 + 锁形 icon：任一 prerequisite 处于待巩固/未触及 | 游戏化"暂不可达" |
| 聚焦 | 点击态：光环 + 右侧详情抽屉 | 当前操作对象 |

**先修边着色**：两端均已掌握 → 亮线（"这条路打通了"）；否则灰虚线。打通率是天然的游戏进度感来源。

**节点详情抽屉**（点击展开，字段全部来自 #32 + 归因表）：
- 掌握度百分比 + band 徽章 + 证据数
- 证据时间线（最近 3 条：`10-05 做题 ✓ / 10-07 复测 ✗ / 09-28 月考卷 ✓`）
- 当前归因结论（attributions 表已有：root_cause + path）
- 主按钮："去攻克"（跳 diagnose/next 带 kp 过滤）或"去复测"

### 1.3 游戏化层（克制版，不做数值膨胀）

1. **点亮时刻**：复测升级为已掌握的瞬间，节点播放"点火"动画（复用 `useReveal` / motion.ts），文案："「配方法」已点亮 —— 4 条证据把你带到这里"。
2. **章节徽章**：章内全部节点 ≥基本掌握 → 章节标题挂徽章（纯前端从 #32 数据推导）。
3. **证据计数器**：图谱页常驻一行："这张图谱记录了你 **47** 条学习证据，覆盖 **18/24** 个知识点"——"越用越懂你"的直接量化。
4. **本周战报**：`newly_mastered_7d > 0` 时顶栏显示 "本周点亮 +2"。

### 1.4 分享：成长海报（客户端生成，零后端）

- `apps/web/src/lib/poster.ts`（新）：canvas 手绘 750×1334 海报 → `toBlob()` 下载/系统分享。内容：四带计数环形图、章节进度条、本周点亮数、薄弱前三（只出 kp 名，**不出分数明细、不出对话原文**）、知微 logo（复用 `ParticleLogo` 几何常量 `lib/logoGeometry.ts`）。
- 数据源就是 #32 的 summary，不需要新后端、不需要鉴权面。
- 老师侧已能看到同等信息（toTeacherSnapshot bandCounts），v2.1 不做"老师只读树链接"（列入 v2.2，避免新增公开鉴权面）。

### 1.5 验收标准

- [ ] #32 返回 24 节点全量 band，与 report/summary 的 band_counts 数值一致（同源断言测试）
- [ ] GraphPage 节点颜色与 BandLegend 图例逐色一致（既有 tokens/bands 测试延伸）
- [ ] 新注册零证据用户：全空心 + 锁定态正确、无 NaN
- [ ] 海报导出 PNG 成功，内容不含 answer/solution_steps/对话原文字段

---

## 2. Feature B：拍卷冷启动 —— 不刷题也能开始

### 2.1 产品判断：这不是新功能，是"换入口 + 补两块板"

试卷通路上传→识别→确认→写证据（w=0.8）**已经存在**。冷启动 = 让它成为第一动作：

**Onboarding 分叉**（`LoginPage` 注册成功后 / `LandingPage`）：

```
欢迎来到知微。两种方式认识你：
┌──────────────────────┐  ┌──────────────────────┐
│  📷 拍一张最近的试卷    │  │  ✏️ 先做 8 道摸底题    │
│  月考卷 / 答题卡 / 作业 │  │  大约 10 分钟          │
│  一分钟生成你的图谱     │  │  边做边建图            │
└──────────────────────┘  └──────────────────────┘
       （推荐，零负担）          （原有 diagnose/baseline 流程）
```

### 2.2 技术改造（三块板）

1. **多页整卷**：`RecognitionRecord` 追加可选字段 `file_ids?: string[]`（append-only，`file_id` 保留兼容）；`uploadPaper` 接受 `file_ids`（≤5 张，逐张走既有压缩管线 `ChatComposer` 同款：长边 1280 JPEG）。识别模型侧多图拼卷。
2. **快捷标注**：`PaperPage`（399 行）确认交互提速——识别结果带 `suggested_result` 默认值，学生**单击翻转**对/错，unclear 仍强制手标（PRD P0 #4 不放松）。目标：22 题的卷子 30 秒标完。
3. **建图完成页**（新组件 `BootstrapDone.tsx`）：confirm 成功后不再跳报告，改跳本页——"你的初始图谱已生成：覆盖 **9** 个知识点，**3** 个待巩固"，主按钮"看看你的技能树"（→ GraphPage），副按钮"先攻克最弱的「有理数运算」"（→ diagnose/next）。可选填卷面总分用于话术校准（"这卷你拿了 86/120，主要丢在…"）。

### 2.3 低置信标记（与 Feature A 咬合）

仅被 `source='paper'` 或 `'self_report'` 触达的 profile，#32 返回 `confidence:'low'`；技能树上节点带虚线描边 + 角标"?"，文案："这是从旧试卷估的，做 2 道复测题会更准"。→ 冷启动用户自然滑向复测闭环，图谱自我校准。

### 2.4 契约追加

- #9 upload 扩展：body 新增可选 `file_ids: string[]`（追加式留痕 API_CONTRACT.md，旧客户端零破坏）
- confirm 响应追加可选 `bootstrap: { covered_kps, band_counts }`（服务端从写入的 evidence 聚合，客户端免二次请求）

### 2.5 边界与降级

- 识别失败 → 既有 `PAPER_FALLBACK_MSG` 话术 + 手动标注兜底（已有）
- kp_guess 映射不到知识库 → 现行流程要求 kp 必须存在；补充：映射失败的题进入"待归类"列表，引导学生走 self-report（evidence source='self_report' 已有），不阻塞其余题建图
- 图片合规沿用 30 天 `expire_at`，**冷启动不改变任何存储红线**

### 2.6 验收标准

- [ ] 注册 → 拍 3 页月考卷 → 30 秒标注 → 看到技能树，全程无强制做题
- [ ] 建图后 weakest 前三与卷面错题归因一致
- [ ] 旧版单图 file_id 上传回归通过（向后兼容测试）

---

## 3. Feature C：逐步批改 —— "断在第几步"是专业感来源

### 3.1 两层评分模型（不重造轮子）

**第一层（节点级，立即可用）**：`cz.json.typical_errors` 已含错误码+处方。学生某步命中典型错误模式（本地规则：正则/符号模式，如 `-2^2` 漏括号、`3x 与 3+x 合并`）→ 直接产出"断点诊断 + remedy 话术"。

**第二层（题目级，渐进补充）**：`BankItemRecord` 追加可选 `step_rubric`：

```jsonc
// data/item_bank/math/ 二次函数章先行（11 个 kp 的题目），其余章按需补
"step_rubric": [
  { "expect": "设 y = a(x-h)^2 + k",        "common_error": "漏掉 a 直接写顶点式" },
  { "expect": "代入顶点坐标求 k",            "common_error": "把 x=h 与 y=k 代反" },
  { "expect": "展开核对与一般式系数一致",      "common_error": "展开后忘核对，符号错" }
]
```

匹配策略：步数对齐（编辑距离/最长公共子序列）→ 逐步三态判定。**本地模型**用规则保守判定（pass / slip 计算失误 / concept_gap 思路断 / unclear）；**远程模型**逐步对比 expected 与学生步骤，prompt 硬约束"反馈中不得出现最终答案"，响应 JSON schema 校验。

### 3.2 新契约 #33：`POST /api/grade/steps`

```
请求:  { space_id, item_id, steps: [{ index, text }] }   // 每步文本或转录
响应:  {
  step_results: [{ index, verdict: 'pass'|'slip'|'concept_gap'|'unclear',
                   matched_error_code?,     // 命中 typical_errors 的 code
                   feedback,                // 通俗话术，来自 remedy / rubric / 模型
                   hint }],                 // "下一步想想 a 的符号"——只指方向不给内容
  overall: { pass_ratio, first_break_step|null, breakdown_kps: [kp_id...] },
  evidence_written: true
}
```

**红线（写入服务端测试）**：响应里 `feedback`/`hint` 与 `answer`/`solution_steps` 无子串泄漏；`step_rubric.expect` 永不出现在响应。新文件 `functions/api/src/services/grade.ts`，挂 `/api/grade/steps` 静态段。

### 3.3 证据沉淀（闭环的关键）

- 每次批改落 `evidence_events`：新增 `EvidenceSource` 追加 `'practice'`（枚举追加，dedup_key 含 source 无碰撞；`config/params.json` 加 `W_PRACTICE=0.7`）。
- `overall.result` 对错写主证据（驱动 BKT）；`breakdown_kps` 为各步归属知识点——**答错但前两步对的题，给前置 kp 记部分正证据**（这是"逐步"相对"只判对错"在数据层的本质优势）。
- 断点记录进 raw：`{ first_break_step, matched_error_code }` → 错题本每条错题新增一行"断点：第 2 步 · 漏负号"，归因链自动更准。

### 3.4 UI：分步编辑器 + 批改结果

- `ItemCard` 扩展"分步作答"模式：有序步骤列表（添加/删除/上移），每步文本框 + 拍照按钮（复用压缩管线）。
- 批改结果：步骤行左侧 verdict 徽章（✓ / ⚠ 计算失误 / ✗ 思路断点 / ? 未识别），断点行高亮，"为什么？"展开 remedy 通俗解释；支持**单步重交**（只重批该步）。
- 收尾卡："这个断点已加入你的复测计划"→ NextStepCard 指向同 kp 复测。

### 3.5 验收标准

- [ ] 构造 `(-2)^2` 漏括号步骤 → 命中 `negative_sign_drop`，feedback 为 remedy 原文
- [ ] 前置 kp 部分正证据落库（mastery_logs before/after 可复现）
- [ ] 泄漏断言测试：200 组随机批改响应无 answer 子串
- [ ] 本地模型（无网络）全流程可走通，unclear 优雅降级

---

## 4. 三张牌怎么互相咬合（这也是对外叙事的顺序）

```
拍一张旧试卷（B）──填满──▶ 技能树（A）◀──喂证据──逐步批改（C）
                              │
                    老师端 bandCounts / 推荐闭环（v1.6 已有）
```

- B 让图谱**第一天就不空**：冷启动用户的技能树不是等待做满题才出现的进度条，而是扫一眼旧卷就点亮的地图。
- A 是所有功能的**展示舞台**：C 的断点、老师的推荐、复测的 ΔAccuracy，最终都落成树上一个节点的颜色变化。
- C 是**数据质量的放大器**：部分正证据 + 断点归因，让 BKT 的估计比"全对/全错"细一个量级——这是拍搜工具在结构上做不到的。

### 突出策略（surface checklist，实现完成即上线这些"被看见"的点）

| 触点 | 动作 | 话术示例 |
|---|---|---|
| LandingPage 首屏 | 技能树动图 + 两个主张 | "拍张试卷，一分钟点亮你的知识地图" / "不说『答案错了』，告诉你断在第几步" |
| 注册后 onboarding | B 的分叉卡 | "两种方式认识你" |
| 图谱页常驻 | 证据计数器 | "这张图谱记录了你 47 条学习证据" |
| 复测点亮瞬间 | 点火动画 + 战报 | "「配方法」已点亮 —— 4 条证据把你带到这里" |
| 错题本 | 每条错题带断点行 | "断点：第 2 步 · 漏负号" |
| 家长分享 | 海报 PNG | 四带分布 + 本周点亮 + 薄弱前三 + 二维码 |
| 老师端详情页 | （v2.2）只读技能树链接 | "看看学生的树" |
| README/答辩 | 差异化叙事 | 用 §4 的飞轮图讲，不罗列功能 |

---

## 5. 里程碑

| 版本 | 内容 | 预估 | 交付判据 |
|---|---|---|---|
| v2.1.0 | #32 接口 + 技能树 2.0（覆盖/锁定/聚焦/点亮动画）+ 海报 | 2–3 天 | 契约测试 + 前端 tokens 测试全绿 |
| v2.1.1 | 多图上传 + onboarding 分叉 + 快捷标注 + 建图完成页 + 低置信标记 | 2 天 | E2E：注册→拍卷→树 |
| v2.1.2 | step_rubric（二次函数章）+ #33 + 证据沉淀 + 分步 UI | 3–4 天 | 泄漏断言 + 归因回归 |

依赖顺序：v2.1.0 → v2.1.1 → v2.1.2（B 与 C 都往 A 的舞台上落；#33 依赖 #32 的 band 同源纪律先立住）。

## 6. 隐私与契约红线（继承 + 新增）

继承：`answer`/`solution_steps`/`distractors` 禁下发；对话原文永不下发；学生端不看老师备注以外的他人数据；图片 30 天过期。
新增：#33 响应白名单 + 泄漏断言测试；`file_ids` 不改变图片保留策略；海报为客户端生成、内容仅含聚合带值与 kp 名。
