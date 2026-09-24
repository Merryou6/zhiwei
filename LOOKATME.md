# ⚠ 先看这里 · LOOKATME

> **知微项目当前进度与交接单**——任何新会话、新 Agent、新协作者进入本仓库，请**按顺序读**：
>
> 1. **本文件**（进度 + 下一步）
> 2. **`AGENT.md`**（工作流与配置：权威文档优先级、流水线纪律、环境常量、常用命令、红线）
> 3. **`.learnbuddy/memory/MEMORY.md`** + **`.learnbuddy/memory/2026-09-19.md`**（项目长期记忆 + 今日详细日志与续接步骤）

最后更新：2026-09-21 10:40（设计与前端优化两批完成）｜ 维护：总控 ｜ 分支：`main`，累计 41 次提交（截至本文件更新时）

---

## 🔴 必读文档（动手前先读，按权威优先级）

| # | 文档（仓库根目录） | 管什么 | 什么时候必须先翻它 |
| --- | --- | --- | --- |
| 1 | **`API_CONTRACT.md`** | 19 个接口的冻结契约：路由 / 请求与响应字段 / 错误码表 / ID 前缀 / 认证方式 | 改接口、联调、写前端调用、加字段——**字段名以它逐字为准，单方面改动 = 联调事故** |
| 2 | **`ALGORITHM.md`** | 算法规格：参数总表（§0）/ BKT 三段式（§1）/ 自适应选题（§2）/ 错误诊断（§3）/ 归因定位（§4）/ 退出通道（§5）/ 掌握度状态带（§6）/ 复测指标（§7） | 动 `packages/engine/`、调参、核对归因与掌握度口径 |
| 3 | **`DATA_SCHEMA.md`** | 数据结构：知识图谱与题库的静态字段规格 + 运行时九张表 + 校验脚本要求（§6） | 改 `data/**`、改 `scripts/validate_data.py`、加表字段 |
| 4 | **`PRD.md`** | 范围与验收：P0 清单（§2）/ 10 页面与设计原则（§5）/ 交互纪律与颜色语义（§6）/ 效果验证两项硬指标（§7） | 做页面、判验收、写用户文案与配色 |
| 5 | **`知微-参赛完整方案-v4.md`** | 叙事与答辩素材（含勘误说明） | 写 PPT / 答辩稿；与第 1–4 份冲突时**以第 1–4 份为准** |

> **冲突裁决顺序**：`API_CONTRACT` > `ALGORITHM` > `DATA_SCHEMA` > `PRD` > 方案叙事。
> 另有两份"单一来源"文件：`config/params.json`（17 个算法参数的唯一来源，调参只改这里）与 `AGENT.md`（工作流 / 环境常量 / 常用命令 / 红线）。

---

## 一句话进度

**项目已收官：三个开发迭代（引擎与数据、后端 19 接口、前端 10 页面与闭环）全部完成并通过审查（3/3 PASS）；测试 225 用例全绿、构建通过、端到端闭环与 SSE 退出通道均已实测。**
剩余为排期上的材料阶段（Demo 视频 / PPT / 教师审阅），无未完成开发项；已知 INFO 级优化点见文末。

---

## 进度快照

| 迭代 | 交付内容 | 状态 | 审查 |
| --- | --- | --- | --- |
| 迭代 1 | 工程脚手架 + BKT 引擎（三段式/弱负证据/dedup/自适应选题/状态带）+ 20 节点知识图谱 + 228 题双池题库 + 静态数据校验闸门 | 完成 | **PASS** |
| 迭代 2 | 后端 19 接口全量（认证/空间/自报/测评/试卷/诊断/归因/处方/对话 SSE/报告；本地 HTTP + CloudBase 双入口；DB 与模型适配层）+ 迭代 1 遗留 5 条 MINOR 清偿 | 完成 | **PASS** |
| 迭代 3 | 前端 10 页面（登录/自报/空间/测评/试卷/对话/归因/图谱/报告/云盘）+ Zustand 状态层 + API/SSE 客户端 + ECharts 图谱 + 端到端演示 | 完成 | **PASS** |
| 修复 | ΔAccuracy 不可计算（测量一致性 D15）：复测优先落在已有基线证据的知识点 | 完成（已提交） | **PASS**（已并入终审；实测 delta 1/1/0 非 null） |

**关键数字（均已实跑核对）**

- 测试：**225 用例全绿**（引擎 38 + 后端 123 + 前端 64，共 20 个测试文件）
- 构建：前端已拆包 —— 首屏 `index` 86.69 kB + `react` 165.48 kB（合计约 252 kB，原为 1,280.50 kB 单包）；`echarts` 1,031.72 kB 改为**进图谱页才加载**；后端 `functions/api/dist/server.js` 95,350 B
- 数据资产：知识图谱 20 节点 / 74 条典型错误；题库 228 题（train 104 + retest 124，双池零重叠）；题库复算 86 题 0 不一致
- 端到端：注册 → 自报 → 测评 → 试卷确认 → 归因 → 处方 → 对话 SSE → 基线/复测 → 报告，10 步全通

---

## 收官状态与后续建议

**迭代 3 终审已于 2026-09-20 通过（VERDICT: PASS）** → `_pipeline/03_REVIEW.md` 现为迭代 3 版（迭代 2 版已归档 `_pipeline/archive/03_REVIEW_20260919_1853.md`）。三项交付 3/3 PASS，项目达到 `PRD.md` §1 范围红线。

**可直接用于答辩的实测数字**（本次终审实跑）

- 测试 225 用例全绿（20 文件：引擎+后端 161 / 前端 64）；tsc 三段 exit=0
- 数据闸门：图谱 20 节点 / 74 条典型错误；题库 228 题（train 104 + retest 124，双池零重叠）；复算 86 题 0 不一致
- **ΔAccuracy 实测（D15 修复后）**：基线 1 对 2 错 → 复测 3 对 → 报告 delta = **1 / 1 / 0**，3 行全部非 null，均值 **0.667**；基线 kp 集合 == 复测 kp 集合。⚠ 引用时注明作答协议（真实实验须用学生真实作答）
- SSE 退出通道实测：轮 1 `continue` → 轮 2 `hint_down` → 轮 3 `exit_channel`（连续 3 轮 progress=false）
- 构建：前端 gzip 423.65 kB；后端 bundle 95,350 B

**设计与前端优化（9/20–9/21，两批，提交 `f0de6eb` / `97f74eb`）**

- 走查方式：起本地服务 + 真实浏览器逐页截图 + **几何量化**（读 `getBoundingClientRect()` 而非目测），含改前/改后对照
- 设计系统固化：令牌集中在 `apps/web/tailwind.config.js`（新增 `tone-error` 与 `shadow-card`，压深 `canvas`、提对比 `line`）；前端取色唯一入口 `theme/bands.ts`（**从引擎源模块导入，不引 barrel**，否则 node:fs 污染浏览器 bundle）；空状态统一为 `components/EmptyState.tsx`（接入 5 处）
- 对齐与层次：内容列与顶栏统一到同一条左基线（实测 1280 视口下同为 152px）；21 处白底卡片获得可感知边界
- 可用性：触控目标 28→36px、主按钮→44px；Toast 由底部居中（会压住主按钮）改右上堆叠并新增 error 语义分档；全局 `:focus-visible` 键盘焦点环
- 字号档位：页面标题 20 / 区块标题 16 / 正文 14 / 信息标签 13 / 徽标图例 12
- 窄屏：图谱最小宽 720 并横向滚动、图例窄屏转静态行；报告表格可横向滚动

**后续（无开发待办，属材料阶段）**

1. 按排期推进 9/24 功能冻结（当前已无未完成开发项）、9/25 Demo 视频与 PPT、9/26 上午提交
2. 可选优化（INFO 级，不阻塞）：echarts 按需引入（`echarts/core` 树摇，可从 1.03 MB 再降到约 400 kB）、补浏览器级渲染断言、把对话 progress 判定接入真实模型
3. 已知本地形态差异：`data/local_db/` 为本地演示存储（已 gitignore），真实部署切 CloudBase 适配器，业务代码不改

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
$WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
$NODE functions/api/dist/server.js

# 5) 起前端（http://localhost:5173，/api 已 proxy 到 8787）
$NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts
```

## 部署到服务器（Docker 单容器）

完整教程见 **`deploy/DEPLOY.md`**（三步：上传代码 → `cp deploy/zhiwei.env.example deploy/zhiwei.env` 改 `ZHIWEI_SERVER_SECRET`（唯一必改项，`openssl rand -hex 32` 生成）→ `docker compose up -d --build`）。

- 形态：一个容器 = 静态前端 + `/api` 同源流式反代（`deploy/serve.js`，SSE 直通已实测），对外仅 8080 一个口
- 数据：用户/作答记录在 volume `zhiwei-data`（`/app/data/local_db`），不进镜像；备份恢复命令见教程
- 模型：默认本地规则适配器（零外部依赖）；可选接 DeepSeek 等 OpenAI 兼容接口（`ZHIWEI_MODEL_MODE=remote`，教程第四节）
- 限制：单实例（JSON 存储无并发锁）；CloudBase 适配器是桩

---

## 红线（不得违反）

- 根目录 5 份规格文档（`API_CONTRACT.md` / `ALGORITHM.md` / `DATA_SCHEMA.md` / `PRD.md` / 知微-参赛完整方案-v4.md）为**冻结版**，只读；冲突时优先级 `API_CONTRACT > ALGORITHM > DATA_SCHEMA > PRD > 方案叙事`
- `answer` / `solution_steps` 绝不下发前端；算法参数零硬编码（只改 `config/params.json`）
- `_pipeline/archive/` 只增不删；每个模块完成立即 commit（中文信息，留痕即评分材料）
- 详细纪律与已知坑见 `AGENT.md`
