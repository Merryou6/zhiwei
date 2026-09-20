# AGENT.md · 知微项目工作流与配置（Agent 必读）

> 本文件是本仓库的**工作约定单一来源**：任何 Agent（含总控、planner、implementer、reviewer）在本仓库作业前必须先读本文件。
> 进度与交接见根目录 **`LOOKATME.md`**；项目记忆见 **`.learnbuddy/memory/MEMORY.md`** 与当日日志。

---

## 1. 项目与权威依据

- **知微**：基于知识图谱归因的一对一定制 AI 学习伴侣（粤港澳大湾区 AI Coding 创新赛 · 方向一），首批锚定**初中数学 · 二次函数主线 · 20 个知识点**
- 技术栈：React 18 + TypeScript + Vite + Tailwind + Zustand + ECharts ／ 后端 CloudBase 云函数形态（本地可运行的 Node HTTP 入口）
- **文档权威优先级（冲突时严格按序裁决）**：
  `API_CONTRACT.md` > `ALGORITHM.md` > `DATA_SCHEMA.md` > `PRD.md` > `知微-参赛完整方案-v4.md`
- 上述 5 份文档位于仓库根目录，**已冻结，只读**；任何修改须双方同意并留变更记录

---

## 2. 三子 Agent 流水线（本仓库唯一开发流程）

```
总控（不写业务代码）
 ├─ planner     只读，产出 _pipeline/01_PLAN.md（先归档旧计划，归档只增不删）
 ├─ implementer 严格按计划实现 + 跑计划中的验证命令，产出 _pipeline/02_EXEC_REPORT.md
 └─ reviewer    只读审查，产出 _pipeline/03_REVIEW.md，末行 VERDICT: PASS | FAIL
```

**纪律**

- 每轮 = 计划 → 实现 → 审查；`VERDICT: FAIL` 最多返工 3 轮，仍 FAIL 则报告阻塞并停止自动尝试
- **总控不直接改业务代码**；直接模式仅限"≤2 文件、局部改动、有现成测试"的极低风险场景，且须显式降级声明
- **不确定就问 vs 不许问**：默认若需求有歧义，planner 可向总控提问；但一旦用户声明"不接受中途提问"，则改为**自行裁决 + 决策记录（D 编号 + 理由 + 依据）留痕**
- `_pipeline/archive/` 存放历史计划/报告/审查，**只增不删**
- **报告落盘优先于归档**：派发审查任务时必须先写报告骨架再归档——曾发生审查者中断在"归档完、未写入"导致整轮审查需重做

---

## 3. 运行环境（本机固定路径，勿用系统默认）

| 用途 | 路径 |
| --- | --- |
| Node 22.22.2 | `/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node`（npm 同目录） |
| Node 依赖隔离安装目录 | `/Users/Merryou/.workbuddy/binaries/node/workspace`（项目根 `node_modules` 为软链） |
| Python（venv） | `/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3` |

- **禁止 `npm install -g`**；新依赖一律装进隔离 workspace，并在计划中列出精确版本
- 运行需要 workspace 依赖的脚本时可加 `NODE_PATH=/Users/Merryou/.workbuddy/binaries/node/workspace/node_modules`

---

## 4. 常用命令

```bash
NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
WS=/Users/Merryou/.workbuddy/binaries/node/workspace
PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
cd /Users/Merryou/LearnBuddy/zhiwei

$NODE $WS/node_modules/vitest/vitest.mjs run              # 全量测试
$NODE $WS/node_modules/vitest/vitest.mjs run packages functions   # 仅引擎+后端
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json   # 引擎类型检查
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json      # 后端类型检查
$NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json           # 前端类型检查
$PY scripts/validate_data.py                              # 静态数据闸门（6 项校验 + 统计报告）
$PY scripts/verify_items.py                               # 题库数学复算
$WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
# ⚠ esbuild 是**原生二进制**，不要写成 `$NODE .../esbuild/bin/esbuild` —— node 执行二进制会报
#   `SyntaxError: Invalid or unexpected token`（2026-09-20 终审实测复现并修正）
$NODE functions/api/dist/server.js                        # 后端本地服务 :8787
$NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts   # 前端 :5173（/api proxy → 8787）
```

**注意**：本机对单条命令有约 60 秒硬限制（超时命令会被 SIGKILL，`sleep`/`ping` 延时与后台监控任务同样会被杀）。需要等待时，唯一可行方式是 node 忙等做短延时：

```bash
$NODE -e "const t=Date.now();while(Date.now()-t<4000){}"   # 约 4 秒
```

长任务（dev server、全量构建）请用"启动→探活→杀进程"模式，不要指望后台任务存活。

---

## 5. 目录布局

```
zhiwei/
├─ LOOKATME.md              进度与交接（先看）
├─ AGENT.md                 本文件：工作流与配置
├─ 5 份冻结规格文档          API_CONTRACT / ALGORITHM / DATA_SCHEMA / PRD / 参赛方案 v4
├─ config/params.json       17 个算法参数（调参只改这里，代码零硬编码）
├─ data/
│  ├─ knowledge/math/cz.json      20 节点知识图谱（74 条典型错误，DAG 且先修互逆）
│  ├─ item_bank/math/cz.json      228 题双池（train 104 / retest 124，零重叠）
│  └─ local_db/                   本地 DB 实现的数据落盘（已 gitignore）
├─ packages/engine/         BKT 引擎（纯函数零 IO）：params/bkt/dedup/selection/statusBand + 测试
├─ functions/api/           19 接口：router/services/db(Store 适配)/models(模型适配)/attribution + 测试
├─ apps/web/                10 页面：pages/stores/api/components/theme/lib + 测试
├─ scripts/                 validate_data.py、verify_items.py
└─ _pipeline/               01_PLAN.md / 02_EXEC_REPORT.md / 03_REVIEW.md + archive/
```

---

## 6. 领域与代码红线

- **`answer` / `solution_steps` 绝不下发前端**（序列化白名单）；诊断模式 `correct` 恒为 `null`，防反推答案
- **参数零硬编码**：算法数值只来自 `config/params.json`；状态带阈值以具名常量集中定义并注释指向 `ALGORITHM §6`
- **状态带唯一来源**：前端四色语义必须复用引擎导出（<0.4 待巩固/暖橙、0.4–0.6 不稳定/黄、0.6–0.8 基本掌握/浅青绿、>0.8 已掌握/青绿；主色低饱和青蓝；禁用刺眼大红）
- **幂等语义（D7）**：`diagnose/submit` 以 `dedup_key + item_id` **双匹配**才跳过；同知识点第二道不同题在同一小时桶内**必须正常计分**
- **归因边界**：`procedural_slip` / `misreading` **不进归因**；`self` 类型不回溯；回溯深度 ≤ `MAX_DEPTH`
- **试卷确认**：`unclear` 项必须学生手动标注，服务端**拒绝默认值**
- **对话**：只读模型返回的结构化字段判进度，**不解析自然语言**；连续 3 轮无进展触发退出通道；跳转 ≤ `MAX_EXIT_HOPS`
- **SSE 必须有 JSON 降级**，禁止白屏
- 未列范围内的功能（真实大模型接入、云部署、教师视角真实页面、报告导出、第二学科）一律**不做**

---

## 7. 提交与留痕规范

- 每完成一个模块**立即 commit**，信息用中文、写清"做了什么 + 关键数字"（提交历史即赛事"AI 工具使用"评分材料）
- 逻辑分离地分批提交（代码修复 / 文档产物 / 测试各成条目），不混提
- 归档文件与 `_pipeline` 产物同样入库；`.learnbuddy/`、`node_modules/`、`dist/`、`data/local_db/` 已 gitignore

---

## 8. 已知协作坑（血泪经验）

1. **子 Agent 长任务常"返回空结果"但仍在后台产出** → 进度判断必须以工作区实物为准（`git log`、文件 mtime、变更数），不要依赖其回话
2. **双写手风险**：若误判中断而重派实现者，两个写手会同时改同一批文件 → 派发前先查是否仍活跃（文件 mtime / commit 变化），发现并行立即让后来者转"独立复核"而非继续生产
3. **总控必须亲验**：不采信 agent 自述，关键验证命令亲自复跑一遍再汇报
4. **审查者中断高危**：归档与写报告之间是脆弱窗口（见 §2 纪律）
5. **工作计划必须按"可独立提交的批次"切分**：单次实现者执行体量过大必然中断，批次化 + 每批 commit 才能无损续接
