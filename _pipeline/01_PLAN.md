知微 · 迭代 1「地基冲刺」实施计划
=================================================
计划编号：01_PLAN
编写日期：2026-09-19
编写角色：规划者（本计划只做规划，implementer 严格照办）
迭代窗口：9/19–9/21（甲乙线核心冲刺）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
权威依据：施工文档优先于方案叙事；四份施工文档冲突时以 API_CONTRACT.md 为准。
规格依据分工：算法与参数 = ALGORITHM.md；静态数据字段 = DATA_SCHEMA.md；范围与验收 = PRD.md；接口与命名 = API_CONTRACT.md。

-------------------------------------------------
一、目标与范围
-------------------------------------------------

1.1 迭代目标（按优先级）：
  (1) 项目脚手架可运行：前端 Vite+React+TS 空壳可 dev 启动；云函数目录骨架就位；共享算法层目录落位。
  (2) 算法参数全外置：config/params.json（ALGORITHM §0 参数总表全部条目，代码零硬编码）。
  (3) 知识图谱数据资产：学科索引 + 20 节点知识图谱，每节点 typical_errors 配满 3–5 条，DAG、prerequisites/successors 互逆。
  (4) 题库数据资产：≥220 题，每知识点 train≥5 + retest≥6，item_id 全局唯一（双池零重叠），distractors 绑定典型错误。
  (5) 校验闸门：scripts/validate_data.py 覆盖 DATA_SCHEMA §6 全部 6 项校验，CI 必跑。
  (6) BKT 引擎（TypeScript）：加权三段式更新 + 弱负证据 + dedup_key + 自适应选题与拓扑剪枝 + 掌握度状态带。
  (7) BKT 单元测试：ALGORITHM §1 的 3 个自检用例全过（±0.001 容差）。

1.2 明确排除（本迭代一行相关代码都不写，防止范围蔓延）：
  (1) 后端 19 个 API 接口的任何实现逻辑（只搭 functions/api/ 目录骨架与空入口文件）。
  (2) 前端 10 个业务页面（App.tsx 仅放占位文案）。
  (3) SSE、大模型调用、试卷识别、认证逻辑。
  (4) 云部署、CloudBase 环境、数据库读写（引擎全部为纯函数）。
  (5) 归因定位（ALGORITHM §4）、错误诊断（§3）、退出通道（§5）——本迭代不做。
  (6) scripts/seed.js（DATA_SCHEMA §7，依赖云环境，推迟到部署迭代）。

1.3 留痕说明（疑点记录，非阻塞）：
  (1) 任务描述称参数"16 个"，ALGORITHM §0 实际为 17 行参数表。以规格表为准：全部 17 项外置
      （P_S、P_G、P_T、W_DIAGNOSE、W_PAPER、ALPHA_SILENT、PRIOR_MAP、PRUNE_THRESHOLD、
      EXIT_UPSTREAM_THRESHOLD、SUSPECT_BASE、MAX_DEPTH、MAX_EXIT_HOPS、CONF_ADOPT、
      CONSEC_FALSE_EXIT、MAX_ITEMS、CONV_VAR、CLAMP）。
  (2) ALGORITHM §1 自检期望值已用 Python 独立复算：0.8454545 / 0.7913636 / 0.2444444，
      与规格期望 0.845 / 0.791 / 0.244 的偏差均 < 0.0005，落在 ±0.001 容差内，无需澄清。
  (3) 方案附录 A 中 completing_square 的 prerequisites 为 [math.cz.algebra.identity]，
      本计划完整图谱为其追加先修 eq_concept（先学"什么是一元二次方程"再学配方法），
      属于叙事文档向完整数据的扩充，不违反任何施工文档约束。

-------------------------------------------------
二、总体目录结构（关键决策 D1–D5）
-------------------------------------------------

2.1 目标目录树（/Users/Merryou/LearnBuddy/zhiwei/）：

  zhiwei/
  ├── package.json                    根工程：依赖声明 + scripts（单一工程，不用 npm workspaces）
  ├── tsconfig.base.json              共享编译选项
  ├── .gitignore
  ├── config/
  │   └── params.json                 算法参数（ALGORITHM §0 全表）
  ├── data/
  │   ├── knowledge/
  │   │   ├── index.json              学科索引（DATA_SCHEMA §2.1）
  │   │   └── math/
  │   │       └── cz.json             20 节点知识图谱（DATA_SCHEMA §2.2/2.3）
  │   └── item_bank/
  │       └── math/
  │           └── cz.json             题目库 ≥220 题（DATA_SCHEMA §3）
  ├── scripts/
  │   └── validate_data.py            静态数据校验（DATA_SCHEMA §6）
  ├── packages/
  │   └── engine/                     共享算法层（纯 TS，零运行时依赖，零 IO）
  │       ├── package.json            name: @zhiwei/engine（不发布，仅占位元数据）
  │       ├── tsconfig.json
  │       ├── src/
  │       │   ├── params.ts           参数加载与类型（读 config/params.json）
  │       │   ├── bkt.ts              updateMastery / weakNegative / clamp
  │       │   ├── dedup.ts            dedup_key 构造（hour_bucket）
  │       │   ├── selection.ts        nextItem：拓扑剪枝 + 信息增益 + 池推导 + 收敛
  │       │   ├── statusBand.ts       掌握度状态带映射（ALGORITHM §6）
  │       │   └── index.ts            barrel 导出
  │       └── tests/
  │           ├── bkt.test.ts         3 个自检用例 + 边界用例（Vitest）
  │           └── selection.test.ts   剪枝/选题/收敛用例（Vitest）
  ├── apps/
  │   └── web/                        前端空壳（Vite + React 18 + TS + Tailwind）
  │       ├── package.json            占位元数据（依赖由根 package.json 统一管理）
  │       ├── tsconfig.json
  │       ├── vite.config.ts
  │       ├── tailwind.config.js
  │       ├── postcss.config.js
  │       ├── index.html
  │       └── src/
  │           ├── main.tsx
  │           ├── App.tsx             占位文案"知微 · 地基冲刺"，无业务
  │           └── index.css           @tailwind 指令
  └── functions/
      └── api/                        云函数骨架（无实现）
          ├── package.json            占位元数据
          └── src/
              └── index.ts            空入口 + TODO 注释（迭代 2 起填 19 接口）

2.2 关键决策记录：
  D1 共享算法层落位：独立 packages/engine/（非 apps/web/src 下），保证云函数与前端
     未来都能 import 同一份 BKT 实现，"引擎无 if(subject) 分支"的架构证明落在目录结构上。
  D2 不用 npm workspaces：本机 npm 包必须安装到
     /Users/Merryou/.workbuddy/binaries/node/workspace（隔离约束），workspaces 需要工程内
     真实 node_modules，与该约束冲突。替代方案见步骤 1：workspace 安装 + 项目根 node_modules
     软链 + 运行时 NODE_PATH 双保险。
  D3 测试框架选 Vitest 2.x：与 Vite 5 同生态、esbuild 原生跑 TS、零额外转译配置；
     不引入 Jest（ts-jest 配置成本高，PRD §4 明确"单测只覆盖 BKT 模块"，不值得）。
  D4 校验脚本仅用 Python 标准库（json/re/sys/os/pathlib/argparse），零 pip 依赖，
     直接用 venv 的 python3 运行。
  D5 BKT 引擎为纯函数：不读数据库、不发请求；mastery_logs 的留痕由引擎返回完整字段
     （before/p_obs/p_eff/after/weight/triggered_by），调用方负责落库——满足 PRD P0 #5
     "mastery_logs 全留痕"的数据结构要求，而不在本迭代实现存储。

-------------------------------------------------
三、步骤拆解（共 9 步，编号即执行顺序）
-------------------------------------------------

步骤 1：脚手架与依赖基座
  目的：建立目录骨架、根 package.json、tsconfig、依赖安装与软链，前端空壳可 dev 启动。
  产出文件：
    /Users/Merryou/LearnBuddy/zhiwei/package.json（新建）
    /Users/Merryou/LearnBuddy/zhiwei/tsconfig.base.json（新建）
    /Users/Merryou/LearnBuddy/zhiwei/.gitignore（新建，含 node_modules、dist、.DS_Store）
    /Users/Merryou/LearnBuddy/zhiwei/apps/web/ 下 9 个文件（见 2.1 目录树，全部新建）
    /Users/Merryou/LearnBuddy/zhiwei/functions/api/ 下 3 个文件（占位，新建）
    /Users/Merryou/LearnBuddy/zhiwei/packages/engine/ 的 package.json、tsconfig.json（新建）
    /Users/Merryou/LearnBuddy/zhiwei/node_modules（软链 → workspace/node_modules）
  依赖前置：无（首步）。
  涉及模块：根 package.json 的 scripts（dev/test/typecheck/validate）；apps/web 的
    vite.config.ts、src/main.tsx、src/App.tsx。
  具体动作：
    a. 建目录：config data/knowledge/math data/item_bank/math scripts packages/engine/src
       packages/engine/tests apps/web/src functions/api/src
    b. 依赖安装（精确版本，禁止 -g）：
       mkdir -p /Users/Merryou/.workbuddy/binaries/node/workspace
       cd /Users/Merryou/.workbuddy/binaries/node/workspace && （若该目录无 package.json 则先
       /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm init -y）
       /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm install --no-fund --no-audit \
         react@18.3.1 react-dom@18.3.1 typescript@5.5.4 vite@5.4.8 @vitejs/plugin-react@4.3.2 \
         vitest@2.1.1 tailwindcss@3.4.13 postcss@8.4.47 autoprefixer@10.4.20 \
         zustand@4.5.5 echarts@5.5.1 @types/react@18.3.5 @types/react-dom@18.3.0
    c. 软链：ln -sfn /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules \
       /Users/Merryou/LearnBuddy/zhiwei/node_modules
    d. 根 package.json scripts 约定：
       "dev": "vite --config apps/web/vite.config.ts"（apps/web 设为 root 或用 --config，二选一，以能启动为准）
       "test": "vitest run"
       "typecheck": "tsc --noEmit -p packages/engine/tsconfig.json"
       "validate": "python3 scripts/validate_data.py"（实际命令见六、，npm script 里写绝对 venv 路径不可移植，可省略此 script）
  预计影响：无存量代码，纯新建；不触碰 data/config/scripts 中将由后续步骤生成的文件。
  验证命令：见六、6.1（vite 启动 + curl 探活）。

步骤 2：config/params.json（参数外置）
  目的：ALGORITHM §0 参数总表 17 项全部外置，作为引擎唯一参数来源。
  产出文件：/Users/Merryou/LearnBuddy/zhiwei/config/params.json（新建）
  依赖前置：步骤 1（目录）。
  涉及模块：无代码；为步骤 7 的 packages/engine/src/params.ts 提供输入。
  具体动作：按 ALGORITHM §0 逐项转录，键名与规格表完全一致（P_S=0.10、P_G=0.20、P_T=0.15、
    W_DIAGNOSE=1.00、W_PAPER=0.80、ALPHA_SILENT=0.10、PRIOR_MAP={"1":0.10,"2":0.30,"3":0.50,"4":0.70,"5":0.85}
    （JSON 键为字符串）、PRUNE_THRESHOLD=0.40、EXIT_UPSTREAM_THRESHOLD=0.60、SUSPECT_BASE=0.60、
    MAX_DEPTH=3、MAX_EXIT_HOPS=2、CONF_ADOPT=0.60、CONSEC_FALSE_EXIT=3、MAX_ITEMS=10、
    CONV_VAR=0.10、CLAMP=[0.01, 0.99]）。
  预计影响：无；后续所有调参只改此文件。
  验证命令：见六、6.2（jq 或 python -c 打印键数=17）。

步骤 3：data/knowledge/index.json（学科索引）
  目的：建立学科→学段→知识库文件的路由索引。
  产出文件：/Users/Merryou/LearnBuddy/zhiwei/data/knowledge/index.json（新建）
  依赖前置：步骤 1。
  具体动作：严格按 DATA_SCHEMA §2.1 样例：subjects[0] = { key:"math",
    stages:[ { key:"cz", name:"初中数学", kb_id:"kb_math_cz",
    file:"data/knowledge/math/cz.json" } ] }。
  预计影响：无。
  验证命令：随步骤 5 的 validate_data.py 一并校验（脚本经 index.json 定位图谱文件）。

步骤 4：scripts/validate_data.py（校验闸门先行）
  目的：先建闸门再产数据，数据生产全程即时反馈。
  产出文件：/Users/Merryou/LearnBuddy/zhiwei/scripts/validate_data.py（新建）
  依赖前置：步骤 1；运行依赖步骤 3/5/6 的数据文件（缺文件时报错退出，属预期）。
  涉及模块（单文件内函数划分）：
    load_json(path) / load_graph()（经 index.json 定位）/ check_graph_structure()（§6-1：
    id 唯一、引用存在、prereq/succ 互逆、DAG 无环——拓扑排序或 DFS 染色判环）/
    check_typical_errors()（§6-2：error_type ∈ 五类枚举，每节点 ≥3 条，code 节点内唯一）/
    check_item_bank()（§6-3：item_id 全局唯一、knowledge_point 引用存在、pool ∈ {train,retest}）/
    check_quota()（§6-4：每 kp train≥5、retest≥6）/
    check_distractors()（§6-5：typical_error_code 存在于该 kp 的 typical_errors[].code）/
    report_stats()（§6-6：节点数/错误条数/题数/各池配额，人类可读表格输出）/
    main()：逐项执行，任一阻断项失败 → 收集全部错误后 sys.exit(1)，全过 → 打印统计 + exit 0。
  附加校验（超出 §6 但低成本高价值，做成"警告不阻断"，并单独注明）：
    a. params.json 存在且包含 §0 全部 17 键（缺失→阻断；类型错误→阻断）。
    b. train 池难度覆盖 1–5（缺档→警告不阻断，§6 未列为阻断项）。
    c. sample_items 非空引用存在性（缺失→阻断，引用完整性同类问题）。
    d. 题型枚举 type ∈ {choice,fill,short_answer}；choice 必有 options，其余 options=null（阻断）。
    e. difficulty ∈ 1–5（阻断）。
  预计影响：无业务代码。
  验证命令：见六、6.3。开发期数据未齐时允许报错，交付前必须 exit 0。

步骤 5：data/knowledge/math/cz.json（20 节点知识图谱）
  目的：产出本迭代最重要的静态数据资产之一。
  产出文件：/Users/Merryou/LearnBuddy/zhiwei/data/knowledge/math/cz.json（新建）
  依赖前置：步骤 1、4（边产边校验）。
  涉及模块：无代码；消费方为校验脚本（步骤 4）与步骤 7 selection.ts 的图结构输入。
  具体动作：节点清单、先修关系、难度建议见五、5.1（20 节点表，DAG 且编号递增即无环）。
    每节点字段严格按 DATA_SCHEMA §2.2；successors 由 prerequisites 推导生成（建议写生成
    脚本一次性生成，或人工推导后用校验脚本 §6-1 互逆校验兜底）。
    typical_errors 每节点 3–5 条，code 节点内唯一，error_type 覆盖见五、5.3。
    文件顶层结构带 meta（照附录 A：subject/stage/version/primary_standard）+ nodes[]。
  预计影响：无。
  验证命令：见六、6.3（校验 §6-1/2 通过 + 统计报告节点数=20）。

步骤 6：data/item_bank/math/cz.json（题库 ≥220 题）
  目的：产出闭环"子弹"，满足双池配额与典型错误绑定。
  产出文件：/Users/Merryou/LearnBuddy/zhiwei/data/item_bank/math/cz.json（新建）
  依赖前置：步骤 5（kp id 与 typical_errors code 是绑定目标）。
  涉及模块：无代码。
  具体动作：配额分配见五、5.2；字段严格按 DATA_SCHEMA §3.1/3.2；题目生成与验算纪律见五、5.4。
    顶层结构建议 { "meta": {...}, "items": [...] }。
  预计影响：无。
  验证命令：见六、6.3（§6-3/4/5 全过 + 统计报告题数 ≥220）。

步骤 7：BKT 引擎（packages/engine）
  目的：实现 ALGORITHM §1/§2/§6 的全部纯计算逻辑。
  产出文件（全部新建）：
    packages/engine/src/params.ts
    packages/engine/src/bkt.ts
    packages/engine/src/dedup.ts
    packages/engine/src/selection.ts
    packages/engine/src/statusBand.ts
    packages/engine/src/index.ts
  依赖前置：步骤 2（params.json）；selection.ts 需要步骤 5/6 的数据文件作为测试夹具
    （实现本身只依赖类型定义，不读文件——数据由调用方/测试注入）。
  函数级规格：
    a. params.ts：
       export interface Params { P_S:number; P_G:number; P_T:number; W_DIAGNOSE:number;
         W_PAPER:number; ALPHA_SILENT:number; PRIOR_MAP:Record<string,number>;
         PRUNE_THRESHOLD:number; EXIT_UPSTREAM_THRESHOLD:number; SUSPECT_BASE:number;
         MAX_DEPTH:number; MAX_EXIT_HOPS:number; CONF_ADOPT:number; CONSEC_FALSE_EXIT:number;
         MAX_ITEMS:number; CONV_VAR:number; CLAMP:[number,number]; }
       export function loadParams(path?: string): Params —— 默认路径 config/params.json
       （相对仓库根，路径解析用 process.cwd() 约定），加载后做键完整性断言。
       export const DEFAULT_PARAMS 相关常量一律来自该文件，禁止散落字面值。
    b. bkt.ts —— ALGORITHM §1 逐行转译：
       export interface MasteryUpdateResult { before:number; p_obs:number; p_eff:number;
         after:number; weight:number; }
       export function updateMastery(pL:number, isCorrect:boolean, w:number,
         params:Params): MasteryUpdateResult
       实现顺序：clamp 输入 → w===0 早退（返回三个 pL 相等）→ 贝叶斯后验（对/错两分支）
       → 权重插值 → 学习迁移 → clamp 输出。中间量不做任何四舍五入（只在最终 clamp）。
       export function applyWeakNegative(pL:number, params:Params): number
       —— 返回 pL × (1 − ALPHA_SILENT)，不走 BKT。
    c. dedup.ts —— ALGORITHM §1 去重：
       export function buildDedupKey(input:{ userId:string; spaceId:string; kp:string;
         source:'silent'|'paper'|'diagnose'|'self_report'; unixTs:number }): string
       —— 格式 {user_id}:{space_id}:{kp}:{source}:{hour_bucket}，hour_bucket =
       Math.floor(unixTs/3600)。另导出 isDuplicateKey(seen:Set<string>, key) 之类的纯判断，
       数据库查重属调用方职责（本迭代不实现存储）。
    d. selection.ts —— ALGORITHM §2：
       export interface GraphNode { id:string; prerequisites:string[]; }
       export interface BankItem { item_id:string; knowledge_point:string;
         pool:'train'|'retest'; difficulty:number; }
       export interface SelectionState { mastery:Record<string,number>;
         answeredCount:number; usedItemIds:Set<string> | string[]; }
       export function nextItem(input:{ graph:GraphNode[]; bank:BankItem[];
         mastery:Record<string,number>; mode:'diagnose'|'baseline'|'retest';
         usedItemIds:string[]; answeredCount:number; params:Params }):
         { item:BankItem | null; converged:boolean; remaining:number;
           prunedKps:string[] }
       实现：① 拓扑剪枝：先修全为空或全部先修 mastery ≥ PRUNE_THRESHOLD 的 kp 可测，
       其余记入 prunedKps（"未具备学习条件"）；② 可测集合中选 |mastery − 0.5| 最小者
       （并列取先修链更长者或稳定排序，保证确定性）；③ 池推导：mode=diagnose→train，
       baseline/retest→retest（服务端推导，调用方不传 pool）；排除 usedItemIds；
       该 kp 对应池为空 → 换次优 kp（全部无题 → item=null）；④ 收敛：所选 kp 的
       V = P(1−P) < CONV_VAR 或 answeredCount ≥ MAX_ITEMS → converged=true 且 item=null
       （收敛判定优先于出题）；⑤ remaining = MAX_ITEMS − answeredCount（下限 0）。
    e. statusBand.ts —— ALGORITHM §6：
       export type MasteryBand = '待巩固' | '不稳定' | '基本掌握' | '已掌握';
       export function masteryToBand(p:number): MasteryBand
       —— 边界约定（规格区间含糊处统一）：p<0.4 待巩固；0.4≤p<0.6 不稳定；
       0.6≤p<0.8 基本掌握；p≥0.8 已掌握。颜色常量同文件导出（'暖橙'|'黄'|'浅青绿'|'青绿'），
       与 PRD §6 颜色语义一致，供前端后续消费。
    f. index.ts：barrel 导出全部公共符号 + 类型。
  预计影响：纯新增；前端与云函数骨架不 import（避免本迭代耦合）。
  验证命令：见六、6.4（typecheck）。

步骤 8：BKT 单元测试（packages/engine/tests）
  目的：满足 ALGORITHM §1"3 条全过才算实现完成"的硬门槛。
  产出文件（全部新建）：
    packages/engine/tests/bkt.test.ts
    packages/engine/tests/selection.test.ts
  依赖前置：步骤 2、7。
  用例清单：
    bkt.test.ts（必须全过）：
      T1 P_L=0.5、答对、w=1.0 → after ≈ 0.845（toBeCloseTo(0.845, 3)）
      T2 P_L=0.5、答对、w=0.8 → after ≈ 0.791
      T3 P_L=0.5、答错、w=1.0 → after ≈ 0.244
      T4 w=0 → 三值相等且等于 clamp 后的输入（规格早退分支）
      T5 输入越界 clamp：pL=0 / 1.5 → 结果落在 [0.01, 0.99]
      T6 弱负证据：pL=0.5 → 0.45（0.5 × 0.9）
      T7 中间量对照：T1 场景 p_obs ≈ 0.818、p_eff ≈ 0.818；T2 场景 p_eff ≈ 0.754
      T8 dedup_key：同一时间戳两次构造结果一致；跨小时桶（t 与 t+3600）结果不同；
         格式五段冒号分隔
    selection.test.ts（建议全过，属引擎内模块，不违反 PRD"单测只覆盖 BKT 模块"）：
      S1 拓扑剪枝：先修 mastery=0.3 < 0.40 → 后继不可测，出现在 prunedKps
      S2 根节点（先修为空）天然可测
      S3 信息增益：mastery 0.5 的 kp 优先于 0.9 的 kp
      S4 池推导：mode=baseline → 从 retest 池取题；mode=diagnose → train 池
      S5 排除已做：usedItemIds 命中后取同 kp 次题
      S6 收敛：mastery=0.95 → V=0.0475 < 0.10 → converged=true、item=null
      S7 收敛：answeredCount ≥ MAX_ITEMS → converged
    测试数据用内联 fixture（小图 3–5 节点 + 小题库 8–12 题），不依赖 data/ 真实文件
      （数据资产正确性由 validate_data.py 负责，职责分离）。
  验证命令：见六、6.5。
  预计影响：无。

步骤 9：全量验收与交付留痕
  目的：一次性跑通全部闸门，形成可勾选的验收记录。
  依赖前置：步骤 1–8 全部完成。
  具体动作：
    a. 依次执行六、6.1–6.5 全部命令并记录输出（validate 统计报告留档，可直接贴 PPT）。
    b. 范围自查：grep 确认 functions/api/src/index.ts 无业务逻辑、apps/web/src/App.tsx
       无业务页面；确认未出现 SSE/大模型/部署相关代码。
    c. 若步骤 1 已 git init：按模块分批 commit（脚手架 / 数据资产 / 引擎 / 测试），
       满足 PRD §9"每完成一个模块立刻 commit"的留痕纪律；未 init 也可在交付前一次性补：
       cd /Users/Merryou/LearnBuddy/zhiwei && git init && git add -A && git commit -m "iter1: 地基冲刺（脚手架+图谱+题库+校验+BKT引擎+单测）"
  验证命令：见六、全部。

-------------------------------------------------
四、涉及文件清单（完整路径，新建/修改标注）
-------------------------------------------------

（全部为新建；工作区现状为 5 份文档 + 零代码，无任何修改类变更）

  /Users/Merryou/LearnBuddy/zhiwei/package.json                         新建
  /Users/Merryou/LearnBuddy/zhiwei/tsconfig.base.json                   新建
  /Users/Merryou/LearnBuddy/zhiwei/.gitignore                           新建
  /Users/Merryou/LearnBuddy/zhiwei/node_modules                         软链（→ workspace/node_modules）
  /Users/Merryou/LearnBuddy/zhiwei/config/params.json                   新建
  /Users/Merryou/LearnBuddy/zhiwei/data/knowledge/index.json            新建
  /Users/Merryou/LearnBuddy/zhiwei/data/knowledge/math/cz.json          新建
  /Users/Merryou/LearnBuddy/zhiwei/data/item_bank/math/cz.json          新建
  /Users/Merryou/LearnBuddy/zhiwei/scripts/validate_data.py             新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/package.json         新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tsconfig.json        新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/params.ts        新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/bkt.ts           新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/dedup.ts         新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/selection.ts     新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/statusBand.ts    新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/index.ts         新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tests/bkt.test.ts   新建
  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tests/selection.test.ts 新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/package.json                新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/tsconfig.json               新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/vite.config.ts              新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/tailwind.config.js          新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/postcss.config.js           新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/index.html                  新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/main.tsx                新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/App.tsx                 新建
  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/index.css               新建
  /Users/Merryou/LearnBuddy/zhiwei/functions/api/package.json           新建
  /Users/Merryou/LearnBuddy/zhiwei/functions/api/src/index.ts           新建（空入口占位）

  合计：32 个文件（30 新建 + 1 软链 + .gitignore）。
  修改类：无。本迭代不改动任何既有文档（5 份 .md 保持只读）。

-------------------------------------------------
五、数据资产生产规格
-------------------------------------------------

5.1 知识点清单（20 节点，id / 名称 / 章节 / 难度建议 / 先修；编号递增即保证 DAG 无环）

  注：id 令牌沿用既有文档样例（algebra / function / quadratic 三个令牌覆盖四个章节名，
  与附录 A、DATA_SCHEMA §2.3 的既有 id 完全兼容）；章节字段存中文名。

  #  id                                        名称                          章节        难度  先修
  1  math.cz.algebra.basic                    代数式与代入求值              代数式      1     []
  2  math.cz.algebra.identity                 完全平方公式与配方变形        代数式      2     [1]
  3  math.cz.function.concept                 函数的概念与自变量取值范围    函数        2     []
  4  math.cz.function.graph                   函数的图像与描点法            函数        2     [3]
  5  math.cz.function.linear                  一次函数与待定系数法          函数        3     [3, 1]
  6  math.cz.quadratic.eq_concept             一元二次方程的概念与直接开平方法  一元二次方程 2  [2]
  7  math.cz.quadratic.completing_square      配方法解一元二次方程          一元二次方程 3     [2, 6]
  8  math.cz.quadratic.formula                公式法与根的判别式            一元二次方程 3     [7]
  9  math.cz.quadratic.factoring              因式分解法解一元二次方程      一元二次方程 3     [6]
  10 math.cz.quadratic.concept                二次函数的概念与一般式        二次函数    2     [3, 6]
  11 math.cz.quadratic.graph_basic            y=ax² 的图像与性质            二次函数    2     [10, 4]
  12 math.cz.quadratic.opening                开口方向、对称轴与增减性      二次函数    3     [11]
  13 math.cz.quadratic.vertex_form            二次函数的顶点式              二次函数    3     [7, 4]
  14 math.cz.quadratic.general_to_vertex      一般式与顶点式互化            二次函数    4     [13, 11]
  15 math.cz.quadratic.translation            抛物线的平移变换              二次函数    3     [13]
  16 math.cz.quadratic.extremum               二次函数的最值                二次函数    3     [13]
  17 math.cz.quadratic.three_points           待定系数法求二次函数解析式    二次函数    4     [10, 5]
  18 math.cz.quadratic.eq_relation            二次函数与一元二次方程的关系  二次函数    4     [12, 8]
  19 math.cz.quadratic.application            二次函数的实际应用            二次函数    4     [16]
  20 math.cz.quadratic.geometry               抛物线与几何综合              二次函数    5     [19, 17]

  其中 #7、#13、#16 的 id 与先修（#13 含 function.graph、#7 含 algebra.identity）与
  DATA_SCHEMA §2.3 / 附录 A 既有样例保持一致；#7 追加 eq_concept 为先修（见 1.3 留痕）。
  grade 建议：#1–#5 八年级，#6–#20 九年级。
  successors：由 prerequisites 全表推导（A 的 prerequisites 含 B ⇔ B 的 successors 含 A），
  交由 validate_data.py §6-1 互逆校验兜底。

5.2 题量分配表（目标总量 228，下限 220）

  基础配额：20 节点 × (train 5 + retest 6) = 220
  核心加量（归因回溯与演示高频节点，各 +1 train +1 retest）：
    #7 completing_square、#13 vertex_form、#14 general_to_vertex、#16 extremum → +8
  合计：train 104 + retest 124 = 228 题（校验下限仍为每 kp train≥5、retest≥6，总量 ≥220）

  kp 短名 → item_id 前缀映射（q_cz_{短名}_{三位序号}，同 kp 内序号连续、池由 pool 字段区分）：
    1 basic        2 identity     3 func_concept 4 func_graph   5 linear
    6 eq_concept   7 comp_sq      8 formula      9 factoring    10 concept
    11 graph       12 opening     13 vertex      14 g2v         15 translate
    16 extremum    17 three_pts   18 eq_rel      19 applic      20 geometry
  （示例：q_cz_vertex_001 … q_cz_vertex_012，其中 #13 配 train 6 + retest 7）

  难度与题型分布纪律：
    a. train 池：每 kp 难度覆盖 1–5（5 题即各难度 1 题；6 题的加量题取难度 3）。
    b. retest 池：难度以 2–4 为主（基线/复测同池可比性；禁止整 kp 全难度 5）。
    c. 题型混合：每 kp 至少含 1 道 choice（配 4 个选项）+ 2 道 fill；short_answer 用于
       application/geometry 等节点；choice 必有 options，fill/short_answer 的 options=null。
    d. distractors：choice 与 fill 尽量配 1–3 条；typical_error_code 必须取自该 kp 的
       typical_errors[].code（校验 §6-5 阻断）。绑定目标是步骤 5 产出的 code 全集。

5.3 typical_errors 编写规格（每节点 3–5 条）

  a. code：小写蛇形英文，节点内唯一，语义可跨节点复用同名（如 sign_confusion）。
  b. error_type 分布要求：每节点至少覆盖 2 种不同 error_type；五类枚举
     (prerequisite_gap / concept_confusion / method_gap / procedural_slip / misreading)
     在全图谱均须出现。prerequisite_gap 类条目（如"依赖配方法但未掌握"）是归因演示素材，
     建议在 #12/#14/#16/#18/#19 各配 1 条。
  c. desc：一句话可操作识别特征（写"学生把 y=(x+2)²+3 顶点写成 (2,3)"，不写"概念不清"）。
  d. remedy：给出具体补救动作或话术，语气遵守 PRD §6（像耐心的学长）。

5.4 题目生成与验算纪律（数学正确性是本迭代最大质量风险）

  a. 生成顺序：先定 kp 的 typical_errors code 全集 → 再出题，让 distractors 有绑定目标。
  b. 每题自洽三查（写入题目前的硬性检查，implementer 逐题执行）：
     查1：answer 本身正确——独立用第二种方法验算（如求顶点：配方法 + x=-b/2a 各算一遍）。
     查2：solution_steps 每一步可复算，末步结论与 answer 完全一致（数值、格式、符号）。
     查3：distractors 的每条错误答案，必须是"按该 typical_error_code 描述的错误路径真实
          会得到的答案"（如 sign_confusion 得 (2,3)），而不是随意编造的错误值。
  c. 数值设计纪律：系数取小整数（|a|≤3、|b|,|c|≤9），顶点/对称轴/判别式结果均为整数或
     简单分数，避免手工验算出错；application 题的函数由设计目标反推（先定顶点再展开系数）。
  d. 填空题 answer 格式统一约定（避免判卷歧义）：坐标写 "(−2, 3)"，解集写 "x1=1, x2=−3"，
     最值写 "最小值 3" 或 "y=3"；中文负号统一用普通连字符 "-" 或全角"−"二选一并在
     文件内保持一致（建议普通连字符，方便服务端字符串判等）。
  e. 抽检兜底：全部题目完成后，对每 kp 随机抽 2 题（约 40 题）做第三方复算（另一实现者
     或独立脚本），发现 1 错 → 该 kp 全量复检。
  f. 剔错补题：错题直接删除并补同 kp、同池、同难度的替换题，保持配额不变。

-------------------------------------------------
六、测试与验证命令（全部真实可运行）
-------------------------------------------------

  环境常量（下文以 $NODE / $WS 简写，实际执行须展开完整路径）：
    $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
    $NPM  = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm
    $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
    $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
    （venv 已确认存在，无需创建；validate_data.py 仅标准库，$PY 直接可跑）

6.1 前端空壳启动（步骤 1 验收）
    cd /Users/Merryou/LearnBuddy/zhiwei/apps/web && $NODE $WS/node_modules/vite/bin/vite.js
    （后台启动后）curl -s http://localhost:5173/ | grep -c "知微"
    预期：输出 ≥ 1（index.html 或挂载内容包含"知微"占位文案）；终止后台进程后无残留报错。
    备用（若软链解析异常）：
    cd /Users/Merryou/LearnBuddy/zhiwei && NODE_PATH=$WS/node_modules $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts

6.2 params.json 完整性（步骤 2 验收）
    $PY -c "import json;d=json.load(open('/Users/Merryou/LearnBuddy/zhiwei/config/params.json'));ks={'P_S','P_G','P_T','W_DIAGNOSE','W_PAPER','ALPHA_SILENT','PRIOR_MAP','PRUNE_THRESHOLD','EXIT_UPSTREAM_THRESHOLD','SUSPECT_BASE','MAX_DEPTH','MAX_EXIT_HOPS','CONF_ADOPT','CONSEC_FALSE_EXIT','MAX_ITEMS','CONV_VAR','CLAMP'};assert set(d)==ks,(set(d)^ks);print('params OK:',len(d))"
    预期输出：params OK: 17

6.3 静态数据校验（步骤 4/5/6 验收，CI 必跑）
    cd /Users/Merryou/LearnBuddy/zhiwei && $PY scripts/validate_data.py; echo "exit=$?"
    预期输出（全部满足才算过）：
      - 校验 1–5 各打印 [PASS]（图谱结构/典型错误/题库引用/配额/干扰项绑定）
      - 校验 6 打印统计报告：节点数=20、错误条数 60–100、题目数 ≥220（目标 228）、
        每 kp train≥5 / retest≥6 的逐 kp 明细
      - exit=0
    失败样例（任意一项）：打印 [FAIL] + 具体节点/题目定位信息，exit=1。

6.4 引擎类型检查（步骤 7 验收）
    cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
    预期：无输出、exit 0。
    附带反硬编码检查（参数不得以字面值散落在引擎源码）：
    grep -nE "0\.1[05]?|0\.2[0]?|0\.4[05]?|0\.6[05]?|0\.85" packages/engine/src/*.ts
    预期：仅 params.ts（若有默认值兜底）与注释命中；bkt.ts / selection.ts / statusBand.ts
    零命中（状态带阈值 0.4/0.6/0.8 属规格常量，允许以命名常量定义于 statusBand.ts 顶部，
    但必须集中、具名、注释指向 ALGORITHM §6）。

6.5 BKT 单元测试（步骤 8 验收，迭代硬门槛）
    cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/vitest/vitest.mjs run
    预期输出：Test Files  2 passed (2)，Tests  ≥ 15 passed；其中 bkt.test.ts 的
    T1/T2/T3 三个自检用例（期望 0.845 / 0.791 / 0.244，toBeCloseTo 容差 1e-3）必须通过。
    备用：NODE_PATH=$WS/node_modules $NODE $WS/node_modules/vitest/vitest.mjs run --root /Users/Merryou/LearnBuddy/zhiwei

6.6 全量回归（步骤 9 交付前一次性执行）
    依序执行 6.2 → 6.3 → 6.4 → 6.5 → 6.1，五项全绿即交付。

-------------------------------------------------
七、风险与回滚方案
-------------------------------------------------

7.1 风险矩阵

  R1 数学题错误（概率：高；影响：致命——错题直接污染闭环与实验数据）
     缓解：五、5.4 的逐题三查 + 抽检兜底 + 校验脚本结构性校验（answer/solution_steps
     必填非空、distractors 绑定阻断）。
     回滚：删除错题 → 补同 kp/同池/同难度替换题 → 重跑 6.3。若已 commit，单题级
     git revert 或直接修正后新 commit（数据文件为纯 JSON，无迁移成本）。

  R2 图谱引用断裂 / prereq 与 succ 不互逆（概率：中；影响：剪枝与归因基础设施失效）
     缓解：校验 §6-1 阻断；successors 建议由脚本从 prerequisites 推导生成而非手写。
     回滚：按校验输出的定位信息修正对应节点边；DAG 判环报告会给出成环节点列表，
     按编号递增原则（五、5.1）重排边方向。

  R3 DAG 成环（概率：低；影响：拓扑剪枝死循环/归因 BFS 不终止）
     缓解：五、5.1 的节点表编号严格递增设计 + 校验脚本 DFS 染色判环（阻断）。
     回滚：同 R2，按报告修正单条边。

  R4 配额不达标（概率：中；影响：PRD 范围红线失守，9/21 交付受阻）
     缓解：校验 §6-4 阻断 + 统计报告逐 kp 明细，缺口一目了然。
     回滚：按明细逐 kp 补题至下限（train 5 / retest 6），优先保证下限 220 而非加量 228。

  R5 浮点精度（概率：中；影响：自检用例失败或引擎结果不可复现）
     缓解：引擎中间量零舍入、仅最终 clamp；单测用 toBeCloseTo(±0.001)；期望值已经
     Python 独立复算确认（0.8455/0.7914/0.2444）。
     回滚：若超差，对照复算脚本逐步打印 p_obs/p_eff 定位是公式实现误差还是容差设定
     问题；禁止用"调容差"掩盖公式实现错误。

  R6 依赖安装失败 / 软链失效（概率：低；影响：vite/vitest 无法运行）
     缓解：版本全部精确锁定（react 18.3.1 / vite 5.4.8 / vitest 2.1.1 等已验证共存）；
     软链 + NODE_PATH 双通道。
     回滚：单个包安装失败 → 降一级补丁版本重装（如 vite@5.4.7）；整体失败 → 检查
     workspace package.json 状态后删除 node_modules 重装（安装动作幂等，无项目侧损失）。

  R7 范围蔓延（概率：中；影响：9/21 里程碑失守）
     缓解：一、1.2 排除清单 + 步骤 9b 的 grep 范围自查；implementer 发现"顺手可做"的
     排除项时必须停下并回报，不得自行实现。

7.2 总体回滚策略
  - 本迭代零数据库、零部署、零对既有文件的修改，全部产物为新增文件：任何一步回滚 =
    删除/还原对应新增文件，无级联影响。
  - 建议步骤 1 完成后即 git init 并逐模块 commit（脚手架/图谱/题库/校验/引擎/测试），
    使每个数据资产都有独立可回退的快照；commit 记录本身是赛事"AI 工具使用"评分材料。
  - 数据文件级回滚优先于代码回滚（校验失败 90% 概率是数据问题而非脚本问题）。

-------------------------------------------------
八、验收清单（与 PRD §2 P0 #5 及 DATA_SCHEMA §6 对齐）
-------------------------------------------------

  脚手架与配置：
  [ ] A1 前端空壳 vite dev 启动成功，页面含"知微"占位（六、6.1 通过）
  [ ] A2 config/params.json 含 ALGORITHM §0 全部 17 键（六、6.2 输出 params OK: 17）
  [ ] A3 引擎源码零参数硬编码（六、6.4 的 grep 检查通过）
  [ ] A4 functions/api 仅有空骨架，无任何接口实现（步骤 9b 自查）
  [ ] A5 未出现 SSE/大模型/试卷识别/认证/部署代码（步骤 9b 自查）

  数据资产（DATA_SCHEMA §6 全过）：
  [ ] B1 校验 1：20 节点 id 唯一、引用存在、prereq/succ 互逆、DAG 无环 —— 阻断项通过
  [ ] B2 校验 2：error_type ∈ 五类枚举，每节点 typical_errors ≥3 条 —— 通过
  [ ] B3 校验 3：item_id 全局唯一（双池零重叠）、kp 引用存在、pool 合法 —— 通过
  [ ] B4 校验 4：每 kp train ≥5、retest ≥6，总量 ≥220 —— 通过
  [ ] B5 校验 5：distractors.typical_error_code 均存在于该 kp 的 typical_errors —— 通过
  [ ] B6 校验 6：统计报告输出（节点数/错误条数/题数/各池配额），已留档可贴 PPT

  BKT 引擎（PRD §2 P0 #5「加权 BKT」验收项对齐）：
  [ ] C1 三段式更新（贝叶斯后验 → 权重插值 → 学习迁移）实现且 3 个自检用例全过
      （0.845 / 0.791 / 0.244，±0.001）——对应 P0 #5"单测过 3 个自检用例"
  [ ] C2 幂等设计就绪：dedup_key 构造（含 hour_bucket）实现并有确定性测试
      ——对应 P0 #5"幂等（重复提交不重复扣分）"的算法侧（查重落库属迭代 2）
  [ ] C3 留痕就绪：updateMastery 返回 before/p_obs/p_eff/after/weight/triggered_by
      完整字段，可直接映射 mastery_logs ——对应 P0 #5"mastery_logs 全留痕"
  [ ] C4 弱负证据：applyWeakNegative 实现（P × (1 − ALPHA_SILENT)）并有测试
  [ ] C5 自适应选题：拓扑剪枝 + |mastery−0.5| 最小 + 池按 mode 推导 + 已做题排除
      + 收敛判定（V=P(1−P)<CONV_VAR 或 ≥MAX_ITEMS）实现并有测试
  [ ] C6 掌握度状态带：四区间映射（<0.4 / 0.4–0.6 / 0.6–0.8 / ≥0.8）实现并有测试
  [ ] C7 六、6.5 输出 Test Files 2 passed、Tests ≥15 passed

  交付物：
  [ ] D1 全量回归六、6.6 五项全绿
  [ ] D2 validate_data.py 统计报告已保存留档（建议存 _pipeline/ 或直接贴入交付说明）
  [ ] D3 （若 git init）逐模块 commit 完成留痕

-------------------------------------------------
九、附：implementer 执行提示
-------------------------------------------------

  1. 执行顺序严格按步骤 1→9；步骤 4（校验器）先于步骤 5/6（数据）完成，
     数据生产全程"改一点跑一次 6.3"。
  2. 题库体量大（228 题），建议按 kp 分批生产：每完成一个 kp 的题目立即跑 6.3，
     不要 228 题写完才首次校验。
  3. 所有命令中的 $NODE/$NPM/$WS/$PY 必须展开为六、开头的完整路径后再执行。
  4. 发现本计划与四份施工文档冲突时：停止执行，按"API_CONTRACT > ALGORITHM >
     DATA_SCHEMA > PRD > 方案叙事"的优先级复核；无法裁决时向主控提问，禁止自行假设。
  5. 本计划未授权的任何文件（含 5 份既有 .md 文档）一律不得修改。
