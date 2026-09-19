# ⚠ 先看这里 · LOOKATME

> **知微项目当前进度与交接单**——任何新会话、新 Agent、新协作者进入本仓库，请**按顺序读**：
>
> 1. **本文件**（进度 + 下一步）
> 2. **`AGENT.md`**（工作流与配置：权威文档优先级、流水线纪律、环境常量、常用命令、红线）
> 3. **`.learnbuddy/memory/MEMORY.md`** + **`.learnbuddy/memory/2026-09-19.md`**（项目长期记忆 + 今日详细日志与续接步骤）

最后更新：2026-09-19 20:15 ｜ 维护：总控（三子 Agent 流水线）｜ 分支：`main`，累计 35 次提交

---

## 一句话进度

**三个开发迭代的主体全部完成并提交。算法引擎、数据资产、后端 19 接口、前端 10 页面、端到端闭环全部就绪；测试 225 用例全绿、构建通过。仅剩 1 项收尾：迭代 3 终审。**

---

## 进度快照

| 迭代 | 交付内容 | 状态 | 审查 |
| --- | --- | --- | --- |
| 迭代 1 | 工程脚手架 + BKT 引擎（三段式/弱负证据/dedup/自适应选题/状态带）+ 20 节点知识图谱 + 228 题双池题库 + 静态数据校验闸门 | 完成 | **PASS** |
| 迭代 2 | 后端 19 接口全量（认证/空间/自报/测评/试卷/诊断/归因/处方/对话 SSE/报告；本地 HTTP + CloudBase 双入口；DB 与模型适配层）+ 迭代 1 遗留 5 条 MINOR 清偿 | 完成 | **PASS** |
| 迭代 3 | 前端 10 页面（登录/自报/空间/测评/试卷/对话/归因/图谱/报告/云盘）+ Zustand 状态层 + API/SSE 客户端 + ECharts 图谱 + 端到端演示 | 完成 | 待终审 |
| 修复 | ΔAccuracy 不可计算（测量一致性 D15）：复测优先落在已有基线证据的知识点 | 完成，已提交 `bfa6abc` | 待并入终审 |

**关键数字（均已实跑核对）**

- 测试：**225 用例全绿**（引擎 38 + 后端 123 + 前端 64，共 20 个测试文件）
- 构建：前端 `apps/web/dist/`（gzip 约 424 kB）、后端 `functions/api/dist/server.js` 均已产出
- 数据资产：知识图谱 20 节点 / 74 条典型错误；题库 228 题（train 104 + retest 124，双池零重叠）；题库复算 86 题 0 不一致
- 端到端：注册 → 自报 → 测评 → 试卷确认 → 归因 → 处方 → 对话 SSE → 基线/复测 → 报告，10 步全通

---

## 下一步（唯一待办）

1. **补迭代 3 终审** → `_pipeline/03_REVIEW.md` 目前仍是**迭代 2 版**。上次终审者被中断在"归档完旧报告、还没写新报告"那一刻，需重跑一轮限范围终审：
   - 10 页面 × `PRD.md` §2 P0 验收项逐项核对
   - ΔAccuracy 专项（修复后应可算出实测值，**顺手把实测数值记下来，答辩 PPT 直接可用**）
   - 交互纪律与颜色语义守恒（`PRD.md` §6）+ 测试/构建 + 端到端实测
2. 终审 PASS 即视为项目收官；随后可进入排期的功能冻结（9/24）与材料准备（Demo 视频、PPT）

---

## 怎么跑起来（复制即用）

```bash
# 环境（本机固定路径，勿用系统默认版本）
NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
WS=/Users/Merryou/.workbuddy/binaries/node/workspace
PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3

cd /Users/Merryou/LearnBuddy/zhiwei

# 1) 全量测试（20 文件 225 用例）
$NODE $WS/node_modules/vitest/vitest.mjs run

# 2) 类型检查（三段）
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json

# 3) 静态数据闸门 + 题库复算
$PY scripts/validate_data.py
$PY scripts/verify_items.py

# 4) 起后端（默认 http://localhost:8787，可用 ZHIWEI_API_PORT 覆盖）
$NODE $WS/node_modules/esbuild/bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
$NODE functions/api/dist/server.js

# 5) 起前端（http://localhost:5173，/api 已 proxy 到 8787）
$NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts
```

---

## 红线（不得违反）

- 根目录 5 份规格文档（`API_CONTRACT.md` / `ALGORITHM.md` / `DATA_SCHEMA.md` / `PRD.md` / 知微-参赛完整方案-v4.md）为**冻结版**，只读；冲突时优先级 `API_CONTRACT > ALGORITHM > DATA_SCHEMA > PRD > 方案叙事`
- `answer` / `solution_steps` 绝不下发前端；算法参数零硬编码（只改 `config/params.json`）
- `_pipeline/archive/` 只增不删；每个模块完成立即 commit（中文信息，留痕即评分材料）
- 详细纪律与已知坑见 `AGENT.md`
