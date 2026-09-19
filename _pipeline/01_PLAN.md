知微 · 迭代 3「前端 10 页面 + 端到端闭环」实施计划
=================================================
计划编号：01_PLAN（第 3 版，迭代 3 = 本项目最后一个开发迭代）
编写日期：2026-09-19
编写角色：规划者（本计划只做规划，implementer 严格照办；执行中一切歧义按本计划 二、 决策记录裁决）
工作区：/Users/Merryou/LearnBuddy/zhiwei/（git main，基线 52fe185）
权威依据：API_CONTRACT.md（v1.1）> ALGORITHM.md > DATA_SCHEMA.md > PRD.md > 知微-参赛完整方案-v4.md。
提问纪律：总控已声明不接受中途提问。本计划对全部已知歧义自行裁决并在 二、 留痕（D 编号 + 理由 + 依据），
         implementer 不得再就计划内事项提问；计划外新歧义按同一优先级链自行裁决并写入执行报告偏差清单。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $NPM  = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  依赖安装纪律：一律 `cd $WS && $NPM install --no-fund --no-audit <pkg>@<精确版本>`，禁 -g，
  禁装进工程内真实 node_modules（工程 node_modules 是指向 $WS/node_modules 的软链，已存在）。

-------------------------------------------------
一、目标与范围
-------------------------------------------------

1.1 迭代目标（按优先级）：
  (1) 前端 10 页面全部落地（PRD §5）：登录/注册、自报问卷、空间列表、测评页、试卷上传页、
      对话辅导页、归因结果页、知识图谱页（兼学习路径页）、学习报告页、云盘页（P1 只读 + 禁用占位）。
  (2) 状态管理（Zustand 切片）+ 统一 API 客户端（Bearer / {code,msg,data} 解包 / 401 跳登录 /
      403/409/502/504 用户可读提示）+ SSE 流式客户端（fetch + ReadableStream 解析，中断降级 JSON 不白屏）。
  (3) 端到端可演示闭环：本地两条命令起 api + web（vite proxy 联调），一条完整演示路径
      注册→自报→测评→（预置文件模拟）试卷→归因→处方→对话→复测→报告→图谱。
  (4) 迭代 2 遗留 MINOR 清偿（03_REVIEW §7 四条，裁决见 D13：①④改代码，②③留痕）。
  (5) 前端纯逻辑层测试（store / client / SSE 解析器 / 颜色映射 / 图谱快照一致性 / 路由守卫），
      引擎与 api 既有 150 用例零回归。

1.2 明确排除（一行相关代码都不写）：
  (1) 真实大模型调用、真实云存储直传、云部署执行（CloudBase 薄壳维持现状不动）。
  (2) 5 份既有 .md（PRD/API_CONTRACT/ALGORITHM/DATA_SCHEMA/方案 v4）一律不改（含 MINOR-② 的
      契约文档收敛——以留痕代替，见 D13）。
  (3) 教师视角真实页面、报告导出 PDF、语音提问、第二学科（PRD §4）。
  (4) 后端新接口 / 新路由 / 错误码扩展（九码冻结）；MINOR-① 是既有接口内的入参校验收紧，
      不属于"新接口"。
  (5) packages/engine/src、data/knowledge、data/item_bank、config/、scripts/validate_data.py、
      scripts/verify_items.py 零改动。
  (6) 组件快照测试 / E2E 框架（Playwright/Cypress）/ @testing-library 全家桶（不装，见 D9）。

1.3 现状基线（编写本计划时实测核对）：
  - git：52fe185，工作区仅 _pipeline 留档变更；150 用例全绿（02_EXEC_REPORT 三、7.3 / 03_REVIEW R2）。
  - apps/web 仅有空壳 8 文件（index.html / package.json / tsconfig.json / vite.config.ts /
    tailwind.config.js / postcss.config.js / src/{main,App,index.css}），无业务代码。
  - 本地 API server（functions/api/dist/server.js，npm run api，默认 8787 端口）**不设置任何 CORS 头**
    （server.ts 实测核对）→ 前端联调必须走 vite proxy（D4）。
  - 知识图谱 4 章节（代数式 2 / 函数 3 / 一元二次方程 4 / 二次函数 11）共 20 节点；
    19 接口无任何"图谱结构/章节清单"下发接口 → 前端需静态副本（D7）。
  - 引擎状态带：packages/engine/src/statusBand.ts 导出 BAND_THRESHOLD_*（0.4/0.6/0.8）、
    masteryToBand、BAND_COLORS、masteryToColor；语义色名为中文（暖橙/黄/浅青绿/青绿），
    无 hex。前端 hex 令牌由本计划 D6 定义并守恒（引擎常量为阈值与语义色名的唯一来源）。

-------------------------------------------------
二、总体目录结构与关键决策（D1–D14）
-------------------------------------------------

2.1 目标目录树（apps/web 最终形态，★=新建，△=修改）：

  apps/web/
  ├── index.html                       △（title 改"知微 · 学习伴侣"）
  ├── package.json                     △（仅描述更新，依赖仍由根统一管理）
  ├── tsconfig.json                    △（include 增加 "tests"）
  ├── vite.config.ts                   △（server.proxy：'/api' → http://127.0.0.1:8787）
  ├── tailwind.config.js               △（theme.extend.colors 令牌化，与 bands.ts 守恒）
  ├── postcss.config.js                （不动）
  └── src/
      ├── main.tsx                     △（挂 HashRouter）
      ├── App.tsx                      △（Routes 装配 + 路由守卫）
      ├── index.css                    △（@tailwind 指令保留 + 全局底色/字体两行）
      ├── router.tsx                   ★（路由表 + requireAuth 守卫逻辑）
      ├── theme/bands.ts               ★（掌握度→状态带→hex→tailwind class，单一事实源）
      ├── data/graphSnapshot.ts        ★（20 节点 + 边 + 章节清单 + kp 名称表的静态副本）
      ├── api/
      │   ├── types.ts                 ★（19 接口 DTO 类型，逐字对照契约）
      │   ├── client.ts                ★（fetch 封装：token / 解包 / ApiError / 401 处理）
      │   ├── endpoints.ts             ★（19 接口类型化函数）
      │   └── sse.ts                   ★（SSE 流客户端 + 纯函数解析器 + JSON 降级）
      ├── stores/
      │   ├── auth.ts                  ★（token/user_id，localStorage 持久化）
      │   ├── space.ts                 ★（空间列表 + 活跃空间，localStorage 持久化）
      │   ├── ui.ts                    ★（toast / 非阻断气泡队列）
      │   ├── assessment.ts            ★（测评会话：mode / doneIds / remaining / converged）
      │   ├── dialog.ts                ★（对话会话：dialog_id / 消息流 / meta）
      │   └── attribution.ts           ★（归因会话：classify 结果 / 当前 attribution）
      ├── lib/
      │   ├── phrases.ts               ★（PRD §6 话术表 + 五类错误中文名映射）
      │   ├── format.ts                ★（百分比、kp 短名显示、时间格式化）
      │   └── graphLayout.ts           ★（拓扑分层坐标计算，纯函数）
      ├── components/
      │   ├── Layout.tsx               ★（页面外壳 + TopNav + Toast 出口）
      │   ├── TopNav.tsx               ★（紧凑顶栏：图谱/测评/对话/报告/云盘 + 空间切换入口收进二级菜单）
      │   ├── Toast.tsx                ★（用户可读错误提示，非阻断）
      │   ├── ItemCard.tsx             ★（题目渲染：stem + options 单选/文本作答）
      │   ├── BandLegend.tsx           ★（四色全局图例组件）
      │   ├── ProgressBar.tsx          ★（测评进度条）
      │   └── ConfirmDialog.tsx        ★（409 同学科空间"切换过去"默认按钮对话框）
      └── pages/
          ├── LoginPage.tsx            ★（页 1：登录/注册）
          ├── SelfReportPage.tsx       ★（页 2：4 章节 × 5 档）
          ├── SpacesPage.tsx           ★（页 3：空间列表，新建为次要按钮）
          ├── AssessmentPage.tsx       ★（页 4：模式选择屏→单题屏→结束屏）
          ├── PaperPage.tsx            ★（页 5：选预置文件→识别→逐题确认）
          ├── ChatPage.tsx             ★（页 6：SSE 流式对话）
          ├── AttributionPage.tsx      ★（页 7：classify 向导 + 归因结果 + 验证 + 反驳）
          ├── GraphPage.tsx            ★（页 8：ECharts 四色 + 路径高亮 + 图例）
          ├── ReportPage.tsx           ★（页 9：分布 + 缺口 + ΔAccuracy）
          └── DrivePage.tsx            ★（页 10：只读列表 + 禁用上传占位）
  apps/web/tests/                      ★（Vitest 纯逻辑层，见 2.2 D9 与 四、）
  functions/api/src/services/attribution.ts   △（MINOR-① 校验，约 +10 行）
  functions/api/tests/attribution.test.ts     △（+2 用例）
  functions/api/tests/diagnose.test.ts        △（+1 用例，MINOR-④）
  package.json（根）                   △（scripts + devDependencies 登记）
  .gitignore                           △（+1 行 apps/web/dist/）

2.2 关键决策记录（执行遇歧义按此裁决；每条含理由与依据）：

  D1 路由方案：react-router-dom@6.26.2，用 HashRouter。
     理由：10 页面需要多路由 + 守卫 + 查询参数（?attribution_id / ?path / ?mode），自研轻路由
     需要自造守卫/参数解析，成本高于引入 12KB 级成熟库；HashRouter 不依赖服务端 history 回退
     配置（本地静态预览与未来云函数静态托管均免 rewrite）。react-router-dom 6.26.x 与
     react 18.3.1 官方兼容（依据：其 peerDependencies react >=16.8）。
     路由表：#/login（页1）、#/self-report（页2）、#/spaces（页3）、#/assessment?mode=…（页4）、
     #/paper（页5）、#/chat（页6）、#/attribution（页7，?attribution_id= 回显 / 无参进向导）、
     #/graph（页8，?path=kp1,kp2 高亮）、#/report（页9）、#/drive（页10）。
  D2 状态管理：Zustand 4.5.5（已装），切片 = auth / space / ui / assessment / dialog / attribution；
     仅 auth（zhiwei_token / zhiwei_user_id）与 space（zhiwei_active_space）落 localStorage
     （手动读写，不用 persist 中间件，便于测试注入与 401 清理）。
     理由：PRD P0 #1 要求"token 存 localStorage 刷新不掉线"；其余会话态不持久化，刷新即重取。
  D3 API 客户端：src/api/client.ts 单一出口 request<T>()：
     - 基址 ''（同源，经 vite proxy，见 D4）；自动附 Authorization: Bearer <token>（login/register 除外）；
     - 解包：HTTP 200 且 body.code===0 → 返回 body.data；code!==0 → 抛 ApiError{code,msg,data}；
     - code===401 → 清空 authStore + location.hash='#/login'（HashRouter 下可用 hash 跳转，
       不依赖 router 实例，测试可覆盖）；
     - 400/403/404/409/500/502/504 → 抛 ApiError 由调用方用 toast 呈现 msg（服务端 msg 已是
       用户可读话术，前端不二次翻译，只包装语气，见 phrases.ts）；
     - 网络错误（fetch reject）→ ApiError{code:0, msg:'网络开小差了，稍后再试一次'}。
     依据：契约 §0 统一响应体 + 错误码表（九码不扩展，前端不发明新码）。
  D4 联调方式：vite dev server proxy。vite.config.ts 增加
     server.proxy = { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } }。
     理由（实测依据）：本地 server.ts 不设 CORS 头，浏览器直连 8787 会被 CORS 拦截；proxy 同源转发
     一劳永逸，且 vite http-proxy 对 text/event-stream 透传（服务端已设 X-Accel-Buffering:no、
     server.ts 手写 chunked flush）。备选 CORS 方案需要改后端（越界），弃。
     端口约定：API 8787（DEFAULT_API_PORT），web 5173（既有 strictPort）。
  D5 SSE 客户端：src/api/sse.ts。EventSource 不支持 POST + 请求头（规范限制），故用
     fetch POST + response.body.getReader() + TextDecoder 增量解析：
     - 纯函数 parseSseBuffer(buffer) → { events: [{event,data}], rest }（可单测，处理跨 chunk
       断行 / 多事件 / 不完整尾块）；
     - 事件回调 onDelta(text) / onMeta(meta) / onDone() / onError(msg)；
     - 降级链（契约 §9"禁止白屏"）：响应 Content-Type 非 event-stream（或流中断/异常）→
       自动用 Accept: application/json 重发一次原请求，取 {reply, meta} 整段渲染，
       并 toast「刚才网络卡了一下，已转为普通回复」。重发也失败 → 错误气泡，不白屏。
  D6 颜色令牌：src/theme/bands.ts 是前端唯一事实源：
     - 从 engine 相对导入 BAND_THRESHOLD_* / MasteryBand（见 D8），masteryBandOf(p) 直接复用
       engine.masteryToBand，前端不得另写阈值；
     - BAND_HEX: Record<MasteryBand, string> = { 待巩固:'#E8894A'（暖橙）, 不稳定:'#D9B23F'（黄）,
       基本掌握:'#79B8A6'（浅青绿）, 已掌握:'#2F9C7C'（青绿）}；
     - PRIMARY='#4E8FB0'（主色低饱和青蓝）；无 danger 红——错误/警示一律复用暖橙；
     - tailwind.config.js extend.colors 写同一组 hex（band-weak/band-unstable/band-basic/
       band-mastered/primary）；
     - 守恒测试（apps/web/tests/bands.test.ts）import tailwind.config.js 断言两组 hex 逐字相等，
       且阈值常量 === engine 导出值（杜绝前端另立一套）。
     依据：PRD §6 颜色语义 + 引擎 statusBand.ts 注释「供前端后续消费」。hex 具体取值为本计划
     裁决（PRD 只给语义名与"低饱和/不刺眼"约束），四色均为低饱和暖色系/青绿系，无大红。
  D7 图谱/章节静态副本：src/data/graphSnapshot.ts。内容 = 20 节点
     {id, name, chapter, difficulty, prerequisites, successors} + 章节清单（4 章）+
     kpId→name 映射表。来源 data/knowledge/math/cz.json（冻结数据）。
     守恒测试（tests/graphSnapshot.test.ts）用 node:fs 读 ../../data/knowledge/math/cz.json，
     断言节点数 20、id/name/chapter/prerequisites/successors 逐项相等、prereq↔successor 互逆。
     理由：19 接口无图谱下发接口，新增后端接口越界（总控：不得新增未授权后端接口）；
     数据冻结 + 守恒测试 = 副本不会漂移。归因页/图谱页/试卷页的 kp 名称与下拉均查此表。
  D8 引擎消费：apps/web/src 内以相对路径
     `import { masteryToBand, BAND_THRESHOLD_UNSTABLE, ... } from '../../../packages/engine/src/index'`
     （与 functions/api/src/context.ts 同款先例）。TS 编译自动跟随 include 外导入（noEmit 无
     rootDir 限制），vite 打包可直接吃仓库内 TS 源。apps/web/tsconfig.json 不需要 paths。
     理由：保证"引擎无 if(subject) 分支 + 前后端同一份 BKT/状态带"的架构证明（迭代 1 D1 延续）。
  D9 前端测试栈：Vitest 2.1.1（已装）+ 新增 jsdom@25.0.1（devDep，仅给需要 localStorage/DOM 的
     store 用例，文件头加 `// @vitest-environment jsdom` docblock，其余用例默认 node 环境零开销）。
     不装 @testing-library/*：总控明示"不要求全组件快照覆盖"，纯逻辑层（store/client/sse/bands/
     snapshot/守卫）不需要渲染测试，省依赖。
  D10 ECharts 图谱布局：预计算拓扑分层坐标（lib/graphLayout.ts 纯函数：按"到根级节点的最长
     先修链深度"分列 + 同列按章节聚簇排序），echarts graph series type='none' + 自算 x/y 连线。
     理由：force 力导向每次渲染位置抖动、答辩演示不可控；分层布局与"先修链"语义一致
     （左→右 = 上游→下游），归因路径高亮（沿 path 的边加重 + 节点描边）视觉上是"往回看"。
     图例：BandLegend 组件常驻右上（四色 + "归因路径"一项），点击图例项不做过滤（P0 无此要求）。
  D11 测评对错展示口径：diagnose / baseline / retest 三种模式**一律不即时展示对错**
     （服务端 diagnose 恒返回 correct=null；baseline/retest 虽返回 correct 但前端不渲染），
     结果统一由报告页 ΔAccuracy 呈现。
     理由：PRD P0 #3"不展示对错"字面只约束诊断模式，但 PRD §5 页 4 核心任务写"无对错反馈"、
     §6 语气纪律（不评判），测量模式即时判分违背同一交互人格；且不展示不影响 P0 #11（ΔAccuracy
     在报告页）。裁决取更严一侧，留痕于此。
  D12 演示种子与"新用户冷启动"：不造任何新接口/脚本写库。演示路径即真实用户路径：
     注册（自动建默认空间）→ 自报（4 章节建议默认档 3，避免 INFO-1"全零掌握度立即收敛"）→
     后续全流程。既有 data/local_db/（demo@zhiwei.dev）保持原样不动；每次演示注册新 identifier
     即得全新干净账号。图谱/报告页对"无数据"新用户显示空态引导文案（先自报/先测评），
     不伪造数据。依据：03_REVIEW INFO-1（先自报 level≥3 再测评）+ 总控"不得新增未授权后端接口"。
  D13 迭代 2 遗留 MINOR 四条裁决（03_REVIEW §7）：
     MINOR-①（verify 不校验 item_id 属候选集）→ **本迭代修**（步骤 7）：verify 入口在
       record.pending_candidates 非空时校验 item.knowledge_point ∈ record.pending_candidates，
       否则 400「这不是当前的验证题，先完成手头这道」。理由：前端归因页"验证/反驳"流程会把
       verification_item 直接回传，但反驳（reject）追加题、刷新回显等路径都可能让前端传旧题，
       服务端必须自防（总控建议"①必做"）。
     MINOR-②（#14 响应为 analyze 超集）→ **留痕不收敛**：实现不动（回显字段 from_kp/error_type/
       verified/verified_by 对归因页刷新回显有实益，契约 §7 括号已认可超集方向）；5 份 .md 不改，
       在迭代 3 执行报告偏差清单正式留痕（补上 MINOR-3 的 pending_candidates 一并写清）。
     MINOR-③（pending_candidates 内部字段未留痕）→ **留痕**：同上，写入迭代 3 执行报告偏差清单；
       DATA_SCHEMA 不改（排除项 1.2(2)）。
     MINOR-④（跨小时桶接口层用例缺失）→ **本迭代补**（步骤 7）：diagnose.test.ts +1 用例，
       now 从 T 推进到 T+3600 提交同 kp 另一题 → 事件新增且掌握度正常更新。
  D14 前端产物与脚本：根 package.json scripts 增补：
     "typecheck:web": "tsc --noEmit -p apps/web/tsconfig.json"
     "build:web":     "vite build --config apps/web/vite.config.ts"
     "typecheck:all" 追加 web 段（api → engine → web 三段）。
     .gitignore 增 apps/web/dist/。依赖登记：dependencies +react-router-dom 6.26.2；
     devDependencies +jsdom 25.0.1（同时出现在 $WS/package.json，由 npm install 自动写入）。

2.3 页面 ↔ 契约接口映射（implementer 据此写 endpoints.ts，勿遗漏）：
  页1 Login      → #1 register / #2 login
  页2 SelfReport → #6 self-report（章节清单查 graphSnapshot）
  页3 Spaces     → #3 list / #4 create（409 → ConfirmDialog 默认"切换过去"）
  页4 Assessment → #7 next / #8 submit（exclude_item_ids 由 assessment store 维护）
  页5 Paper      → #5 drive（选预置文件）/ #9 paper / #10 回显（刷新凭 recognition_id）/
                   #11 confirm（unclear 必须手标，radio 无默认选中，未标全则提交禁用）
  页6 Chat       → #18 chat（SSE；dialog_id 续聊；image_file_id 用预置文件演示，见 D15 注）
  页7 Attribution→ #12 classify（向导第一步，低置信 clarify 就地追问输入框）/
                   #13 analyze / #14 回显 / #15 verify / #16 reject；#17 plan（处方按钮）
  页8 Graph      → #19 report/summary（全节点掌握度着色）+ graphSnapshot（结构）+
                   ?path= 高亮（来自页 7 跳转或 #17 plan.path）
  页9 Report     → #19 report/summary（mastery 分布 + gaps + accuracy Δ）
  页10 Drive     → #5 drive（只读）+ 禁用上传占位
  D15 注（传图读题）：本地无云存储直传接口（契约 §9"前端先直传云存储"指向云环境），
  ChatPage「传图读题」按钮在本地演示态弹出**预置文件选择**（file_preset_001/002），选中后以
  image_file_id 随消息发送；按钮旁标注"演示态"。真实直传留待云部署，不伪造上传假象。
  该选择器是用户主动触发的操作面板，不是采集弹窗（PRD §5"采集永不弹窗"纪律不冲突）。

-------------------------------------------------
三、步骤拆解（8 个批次，每批独立可验证、独立 commit）
-------------------------------------------------

步骤 1：前端基座 + 设计令牌 + 路由骨架（可 commit：「iter3 前端基座：依赖/令牌/路由骨架」）
  目的：装依赖、打通 vite proxy、落地颜色令牌与图谱快照、10 路由可导航（占位页），守恒测试先行。
  涉及文件：
    package.json（根，△）/ .gitignore（△）/ apps/web/vite.config.ts（△）/
    apps/web/tailwind.config.js（△）/ apps/web/index.html（△）/ apps/web/tsconfig.json（△）/
    apps/web/src/{main,App,index.css}（△）/ apps/web/src/router.tsx（★）/
    apps/web/src/theme/bands.ts（★）/ apps/web/src/data/graphSnapshot.ts（★）/
    apps/web/src/lib/{phrases,format,graphLayout}.ts（★）/
    apps/web/src/components/{Layout,TopNav,Toast,BandLegend}.tsx（★）/
    apps/web/src/pages/*10 个占位页（★）/ apps/web/tests/{bands,graphSnapshot,phrases}.test.ts（★）
  准备修改的函数/模块：无存量业务函数（App.tsx 占位重写为路由装配）。
  具体动作：
    a. 依赖：cd $WS && $NPM install --no-fund --no-audit react-router-dom@6.26.2 jsdom@25.0.1；
       根 package.json 登记两依赖（D14）。
    b. vite proxy（D4）；tailwind 令牌（D6）；bands.ts / graphSnapshot.ts（D6/D7）。
    c. router.tsx：路由表 + requireAuth（无 token → 重定向 #/login，纯函数可测）；
       10 个 pages/*.tsx 先放"施工占位"文案（本批只保证可导航与守卫生效）。
    d. 守恒测试：bands（阈值===engine、tailwind hex===bands hex、四区间边界值 0.399/0.4/0.599/
       0.6/0.799/0.8 映射）、graphSnapshot（20 节点逐项、互逆、章节清单）、
       phrases（五类错误枚举与中文名齐全、话术表四场景键存在且无"错误/差"等评判词）。
  预计影响：纯前端新增；后端/引擎零改动。验证命令见 五、V1–V4。
  预计影响：无存量代码回归面。

步骤 2：状态切片 + API/SSE 客户端（可 commit：「iter3 状态与 API/SSE 客户端」）
  目的：全部数据通路（非 UI）就绪并被单测锁定。
  涉及文件：
    apps/web/src/api/{types,client,endpoints,sse}.ts（★）/
    apps/web/src/stores/{auth,space,ui,assessment,dialog,attribution}.ts（★）/
    apps/web/tests/{client,sse,authStore,routerGuard}.test.ts（★）
  准备修改的函数/模块：无（纯新增）。
  具体动作：
    a. types.ts 逐字对照契约 §1–§10 写 DTO（含 item 序列化三键 item_id/stem/options、
       verification_item、next_candidate、ChatMeta 五字段、SSE 事件三型 + error）。
    b. client.ts：request<T>()（D3 全部分支：code=0 解包 / 401 清 token 跳登录 / 其余码抛
       ApiError / 网络异常 ApiError）+ setToken 注入口（测试用）。
    c. sse.ts：parseSseBuffer 纯函数（跨 chunk 断行、多事件块、残尾缓冲、event 缺省为 message、
       data 非 JSON 容错）+ streamChat()（fetch POST → 分支 Content-Type：event-stream 逐事件回调；
       json 直接整段回调；流异常 → JSON 降级重发一次 → 仍失败 onError）。
    d. stores：auth（login/register/logout/setToken，读写 localStorage 'zhiwei_token'/'zhiwei_user_id'）、
       space（list/active/切换，'zhiwei_active_space'）、ui（toast 队列）、assessment（mode/doneIds/
       remaining/converged/会话重置）、dialog（dialog_id/messages/meta/appendDelta）、
       attribution（classifyResult/current/verifyState）。
    e. 测试：client（mock fetch：解包 / code!==0 / 401 副作用 / 网络错 / token 头）、
       sse（解析器 8+ 用例 + 降级链 3 用例，mock fetch 与 ReadableStream）、
       authStore（jsdom：localStorage 持久化、logout 清理）、routerGuard（有/无 token 两分支）。
  预计影响：纯新增。验证命令见 五、V4。

步骤 3：认证 + 空间 + 自报（页 1/2/3，可 commit：「iter3 认证/空间/自报三页」）
  目的：P0 #1 #2 打通——注册即默认空间、token 刷新不掉线、自报 30 秒完成。
  涉及文件：
    apps/web/src/pages/{LoginPage,SpacesPage,SelfReportPage}.tsx（替换占位，下同不再注明）/
    apps/web/src/components/ConfirmDialog.tsx（★）/ apps/web/src/components/ItemCard.tsx（★，供后续批共用）
  准备修改的函数/模块：pages 三文件（步骤 1 占位实现替换）。
  具体动作：
    a. LoginPage：登录/注册双 tab（一屏一件事：表单 + 主按钮）；注册成功提示"已为你建好
       「初中数学」学习空间"并直接进 self-report；409/401 用 toast 呈现服务端 msg。
    b. SpacesPage：空间列表（默认空间置顶徽标）+「+ 新建空间」次要按钮；新建 409 →
       ConfirmDialog 默认按钮"切换过去"（契约 §2 明文），次按钮"取消"。
    c. SelfReportPage：4 章节卡片（graphSnapshot.chapters）× 5 档单选（默认全部不选，
       提交前可一键"按 3 档填"加速 30 秒目标）；提交显示"已更新 N 个知识点的起点"后
       引导进测评；页面顶部一句话解释（学长语气）。
    d. 登录后首跳逻辑：无 token → /login；有 token 无 active space → /spaces；
       spaces 页主按钮按 localStorage 标记（zhiwei_sr_done_<spaceId>）显示"开始 30 秒自报"
       或"进入测评"。刷新不掉线由 D2 持久化保证（验收时手测 + authStore 测试锁定）。
  预计影响：纯前端。验证命令见 五、V4 + V7（联调冒烟）。

步骤 4：测评 + 试卷（页 4/5，可 commit：「iter3 测评页与试卷确认页」）
  目的：P0 #3 #4 #11（测量侧）——不出已做题、不展示对错、收敛即停、unclear 必须手标。
  涉及文件：
    apps/web/src/pages/{AssessmentPage,PaperPage}.tsx /
    apps/web/src/components/{ProgressBar}.tsx（★）
  准备修改的函数/模块：pages 两文件。
  具体动作：
    a. AssessmentPage 三屏状态机（选择屏 → 作答屏 → 结束屏）：
       模式选择（诊断测评 / 基线测量 / 复测测量三卡，说明文案区分 train/retest 池）；
       作答屏单题 ItemCard（options 单选或文本输入）+ ProgressBar（remaining 计数）+
       「跳过这道」次按钮（跳过题记入 doneIds 并 next）；
       提交后从 submit 响应的 next_item 取下一题（少一次往返）；converged=true 或 item=null →
       结束屏（"这一轮先到这里，我们去看看你的地图"→ 引导图谱/报告）；
       exclude_item_ids = store.doneIds（含跳过题）；对错一律不展示（D11）。
       空态防御：未自报直接测评若立即 converged（INFO-1），结束屏文案引导"先花 30 秒自报"。
    b. PaperPage 三段式：选预置文件（调 #5 drive 列出，file_preset_001/002）→
       识别中（调 #9，展示 status）→ 逐题确认列表（seq/stem_excerpt/kp_guess 可改为
       graphSnapshot 下拉、student_answer 展示、result 三态 radio：对/错必选其一，
       suggested_result 仅作参考样式，**unclear 行强制无默认且未标注时提交按钮禁用**，
       行首暖橙提示"这题我没看清，麻烦你标一下"）；提交 #11 成功 → 展示 events_created 与
       mastery_updates 变化气泡（非阻断）；409 已确认 → toast 引导去归因；刷新页面凭
       recognition_id 走 #10 回显（识别 id 存 sessionStorage）。
  预计影响：纯前端。验证命令见 五、V4 + V7。

步骤 5：对话 + 归因（页 6/7，可 commit：「iter3 对话 SSE 与归因结果页」★答辩主战场）
  目的：P0 #6 #7 #8 #9 前端侧——SSE 流式、2 提示/3 解法/退出提示、五类枚举 + 低置信追问、
       回溯路径 + 根因 + 错误类型 + 反驳。
  涉及文件：
    apps/web/src/pages/{ChatPage,AttributionPage}.tsx /
    apps/web/src/stores/{dialog,attribution}.ts（补充 UI 态字段）
  准备修改的函数/模块：pages 两文件 + 两 store。
  具体动作：
    a. ChatPage：消息流（学生右 / 学长左，delta 增量追加渲染，流式期间显示输入等待态）；
       输入框 + 发送（流式期间禁发）；「传图读题」演示态选择器（D15）；
       meta 呈现：kp_match.confidence<0.6 时在学长气泡下加浅色注脚"我不太确定说的是哪个知识点，
       可以再描述一下吗"（对应服务端 clarify 行为，前端只读 meta 不自行判断）；
       next_action=hint_down → 气泡标"方向提示"徽标；exit_channel → 显著退出提示条
       "我们先往回看一眼「XX」"（phrases.ts，话术表照抄 PRD §6）+ 提供"去图谱看看"链接；
       dialog_id 存 store 供续聊；SSE 降级由 sse.ts 兜底（D5），页面永不白屏。
    b. AttributionPage 两种形态：
       向导态（无 ?attribution_id）：第一步选错题来源（试卷错题 sessionStorage 缓存 / 手填
       stem + student_answer + kp 下拉）；第二步 classify 结果屏——五类错误枚举卡片
       （phrases.ERROR_TYPES 中文名 + 一句学长式解释）、confidence 与 evidence 展示、
       adopted 才显示"看看真正的根源"按钮；clarify（低置信）→ 就地追问输入框，学生补充后重发
       classify（不自动 analyze，PRD #6"退回追问"）；procedural_slip / misreading → 明确文案
       "这类小失误不用归因，下次稳一点就好"且**不出现 analyze 按钮**（契约 §7 前置，
       前端不得调用）；第三步 analyze → 结果态。
       结果态（含 ?attribution_id= 回显走 #14）：回溯路径纵向步进条（from_kp → … → 根因，
       节点名查 graphSnapshot，根因节点高亮 + "找到啦——真正卡住你的是这里"）+ 错误类型徽标 +
       suspect_scores 前三展示；验证区（verification_item 存在时）：ItemCard 作答 → #15 verify，
       答对 → "验证通过"徽标 + 处方按钮（#17 → 展示 strategy/讲解大纲/题目序列，附"去图谱看
       学习路径"链接带 path）；答错 → 服务端 next_candidate 自动换题继续验证；
       **反驳按钮**（常驻，PRD ★）：点击 → 可填一句理由（可选）→ #16 reject → 展示追加的
       再验证题继续流程；耗尽（verification_item=null）→ 诚实兜底文案"暂时没找到更深的根源，
       我们就从这一环开始稳"；rejected_by_student=true 时结果态显示"已记录你的反驳"徽标。
    c. 本批必须真实联调（起 api + dev，走通 classify→analyze→verify→reject→plan 全链，
       见 五、V7）。
  预计影响：纯前端。

步骤 6：图谱 + 报告 + 云盘（页 8/9/10，可 commit：「iter3 图谱/报告/云盘三页」）
  目的：P0 #10 #12 + P1 云盘——四色着色 + 路径高亮 + 全局图例 + 掌握度分布 + 缺口 + ΔAccuracy。
  涉及文件：
    apps/web/src/pages/{GraphPage,ReportPage,DrivePage}.tsx
  准备修改的函数/模块：pages 三文件。
  具体动作：
    a. GraphPage：echarts（import * as echarts from 'echarts'，全量引入即可，不做按需裁剪）；
       节点 = graphSnapshot，节点颜色 = bands.masteryBandOf(report.mastery) 的 hex（数据源 #19），
       未出现在 mastery 列表的节点按 0（待巩固）兜底；边 = prerequisites（有向，箭头淡显）；
       布局 = graphLayout 分层坐标（D10）；?path=kp1,kp2 → 沿路径的节点描边加粗 + 边高亮
       （青蓝主色）+ 其余节点降透明度；BandLegend 常驻 + "归因/学习路径"图例项；
       节点点击 → 侧边小卡（名称/章节/掌握度/状态带）；空态（无自报无测评）→ 引导文案。
       学习路径模式：?path= 来自 #17 plan.path 时顶部显示 strategy 一行（兼做"学习路径页"）。
    b. ReportPage：三段布局——掌握度分布（四状态带节点数条形图 + 每带节点 chip 列表）、
       缺口清单（gaps 表：名称/掌握度/最近错误类型，空则"暂时没有明显缺口"）、
       基线 vs 复测（accuracy 表：kp / 基线 / 复测 / ΔAccuracy 徽标，Δ>0 青绿、Δ<0 暖橙，
       null 显示"—"）；顶部一句学长式总结（按 gaps 数量选话术）。
    c. DrivePage：#5 只读列表（file_id/name/type/size，size 用 format.ts 人性化）+
       「上传自定义知识库」按钮禁用态 + 点击 toast"自定义知识库即将开放"（PRD §3 P1 原文案）。
  预计影响：纯前端。验证命令见 五、V4 + V6 + V7。

步骤 7：MINOR 清偿（后端两处小改 + 用例）+ 联调演示验收（可 commit：「iter3 MINOR①④清偿 + 联调」）
  目的：D13 裁决落地；端到端演示路径实测留证。
  涉及文件：
    functions/api/src/services/attribution.ts（△ MINOR-①）/
    functions/api/tests/attribution.test.ts（△ +2 用例：非候选 item_id → 400；候选内 item_id 正常通过）
    functions/api/tests/diagnose.test.ts（△ +1 用例：now T→T+3600 同 kp 另一题 → 事件新增且
    掌握度更新，锁定跨小时桶接口层语义）
  准备修改的函数/模块：attribution.ts 的 verify()（在 loadOwned 与 item 查询之后、gradeItem 之前
    插入校验：record.pending_candidates.length>0 且 !record.pending_candidates.includes(
    item.knowledge_point) → httpError.badRequest('这不是当前的验证题，先完成手头这道')；
    pending 为空（已 verified / self 型）时维持既有幂等行为不变）。
  具体动作：
    a. MINOR-① 校验 + 2 用例（既有 14 用例零回归）。
    b. MINOR-④ 跨小时用例（helpers.createTestApp 的 now 注入推进 3600_000ms）。
    c. 联调验收：V7 全套（起 api + dev 双服务，curl 过 proxy 探活 + 前端入口页可达 + SSE 过
       proxy 冒烟），并按 一、1.1(3) 演示路径手动走一遍全闭环（留执行报告素材）。
    d. MINOR-②③ 留痕素材整理（写入迭代 3 执行报告偏差清单 D 条目，见步骤 8）。
  预计影响：verify 增加一个 400 分支；前端归因页正常流程传服务端下发的 verification_item，
    不受影响（此为防御纵深）。150+3 用例全绿。

步骤 8：收尾与全量回归（可 commit：「iter3 收尾：全量回归 + 执行报告」）
  目的：三段 typecheck + 全量测试 + 双构建 + 数据闸门全绿；执行报告 + 归档留痕。
  涉及文件：_pipeline/02_EXEC_REPORT.md（重写为迭代 3 版，旧版先归档）、
    _pipeline/archive/02_EXEC_REPORT_20260919_*.md（归档副本，只增不删）。
  具体动作：
    a. 依序跑 五、V1–V8 全量（含引擎/api 150 用例零回归、数据闸门）。
    b. 执行报告逐批记录提交号、偏差清单（含 MINOR-②③ 留痕条目、D11/D12/D15 裁决执行情况）、
       演示路径实测记录。
    c. 归档旧执行报告（cp 到 archive/，文件名取其 mtime YYYYMMDD_HHMM）。
  预计影响：仅 _pipeline 文件。

批次间依赖：1 → 2 → 3/4/5/6（3–6 依赖 1+2，彼此无依赖，但按序提交）→ 7 → 8。
implementer 中断恢复纪律：每批结束必须 git commit + 该批验证命令全绿后才进入下一批；
中断后从「最后一个已 commit 批次的下一批」重启，禁止跨批合并提交。

-------------------------------------------------
四、文件清单（完整路径；★新建 △修改；统计：新建 48 / 修改 12）
-------------------------------------------------

★ 新建（前端 45 + 后端测试 0 新文件，后端仅改既有文件）：
  apps/web/src/router.tsx
  apps/web/src/theme/bands.ts
  apps/web/src/data/graphSnapshot.ts
  apps/web/src/api/types.ts
  apps/web/src/api/client.ts
  apps/web/src/api/endpoints.ts
  apps/web/src/api/sse.ts
  apps/web/src/stores/auth.ts
  apps/web/src/stores/space.ts
  apps/web/src/stores/ui.ts
  apps/web/src/stores/assessment.ts
  apps/web/src/stores/dialog.ts
  apps/web/src/stores/attribution.ts
  apps/web/src/lib/phrases.ts
  apps/web/src/lib/format.ts
  apps/web/src/lib/graphLayout.ts
  apps/web/src/components/Layout.tsx
  apps/web/src/components/TopNav.tsx
  apps/web/src/components/Toast.tsx
  apps/web/src/components/ItemCard.tsx
  apps/web/src/components/BandLegend.tsx
  apps/web/src/components/ProgressBar.tsx
  apps/web/src/components/ConfirmDialog.tsx
  apps/web/src/pages/LoginPage.tsx
  apps/web/src/pages/SelfReportPage.tsx
  apps/web/src/pages/SpacesPage.tsx
  apps/web/src/pages/AssessmentPage.tsx
  apps/web/src/pages/PaperPage.tsx
  apps/web/src/pages/ChatPage.tsx
  apps/web/src/pages/AttributionPage.tsx
  apps/web/src/pages/GraphPage.tsx
  apps/web/src/pages/ReportPage.tsx
  apps/web/src/pages/DrivePage.tsx
  apps/web/tests/bands.test.ts
  apps/web/tests/graphSnapshot.test.ts
  apps/web/tests/phrases.test.ts
  apps/web/tests/client.test.ts
  apps/web/tests/sse.test.ts
  apps/web/tests/authStore.test.ts
  apps/web/tests/routerGuard.test.ts
  （注：pages 10 文件在步骤 1 以占位形态新建、步骤 3–6 逐一替换为完整实现——同一文件不重复计数）

△ 修改：
  package.json（根：scripts 三条 + react-router-dom/jsdom 依赖登记）
  .gitignore（+apps/web/dist/）
  apps/web/index.html（title）
  apps/web/tsconfig.json（include + "tests"）
  apps/web/vite.config.ts（server.proxy）
  apps/web/tailwind.config.js（extend.colors 令牌）
  apps/web/package.json（描述更新，可选）
  apps/web/src/main.tsx（HashRouter 挂载）
  apps/web/src/App.tsx（Routes 装配）
  apps/web/src/index.css（全局底色/字体两行，@tailwind 指令保留）
  functions/api/src/services/attribution.ts（MINOR-①，约 +10 行 / 0 删）
  functions/api/tests/attribution.test.ts（+2 用例）
  functions/api/tests/diagnose.test.ts（+1 用例）

明确不动（git diff 必须为空）：
  packages/engine/**、data/knowledge/**、data/item_bank/**、config/**、
  scripts/validate_data.py、scripts/verify_items.py、5 份需求 .md、
  functions/api 除上述 3 文件外全部、apps/web/postcss.config.js、data/local_db/**（不入库）。

运行时生成（不入库，gitignore 覆盖核对）：apps/web/dist/、functions/api/dist/、data/local_db/。

-------------------------------------------------
五、测试与验证命令（真实可运行；单条 ≤60 秒）
-------------------------------------------------

V1 依赖安装与核对（步骤 1）
  cd /Users/Merryou/.workbuddy/binaries/node/workspace && \
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm install --no-fund --no-audit \
    react-router-dom@6.26.2 jsdom@25.0.1
  cd /Users/Merryou/LearnBuddy/zhiwei && \
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node -e \
    "for(const p of ['react-router-dom','jsdom'])console.log(p, require(p+'/package.json').version)"
  期望：react-router-dom 6.26.2 / jsdom 25.0.1

V2 前端类型检查（步骤 1 起每批必跑）
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node \
    /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc \
    --noEmit -p apps/web/tsconfig.json
  期望：exit=0 无输出

V3 后端/引擎类型检查回归（步骤 7、8 必跑）
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node \
    /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc \
    --noEmit -p functions/api/tsconfig.json && \
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node \
    /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc \
    --noEmit -p packages/engine/tsconfig.json
  期望：两段 exit=0

V4 前端测试（步骤 1 起每批必跑；apps/web 过滤）
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node \
    /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web
  期望：本批及此前批次新增用例全过、0 失败（步骤 1 起步约 20+ 用例，逐步累加至 50+）

V5 全量测试（步骤 7、8 必跑；引擎 38 + api 112+3 + 前端全部）
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node \
    /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run
  期望：13+7=20 个测试文件、150+3+前端用例全部 passed、exit=0

V6 前端构建（步骤 6、8）
  /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/.bin/vite build \
    --config /Users/Merryou/LearnBuddy/zhiwei/apps/web/vite.config.ts \
    --outDir dist --emptyOutDir
  期望：exit=0，产物 apps/web/dist/index.html 存在（echarts 体积警告可接受）

V7 联调冒烟（步骤 3/4/5/6/7 各跑一次；两个终端或后台任务）
  终端 1（API，先起）：
    cd /Users/Merryou/LearnBuddy/zhiwei && \
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm run api
    （即 build:api + node functions/api/dist/server.js，监听 8787）
  终端 2（Web，后起）：
    cd /Users/Merryou/LearnBuddy/zhiwei && \
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm run dev
    （vite 5173，proxy /api → 8787）
  冒烟命令（第三个 shell）：
    curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/                 → 200
    curl -s http://127.0.0.1:5173/api/space/list                                  →
      {"code":401,"msg":"缺少 Authorization 请求头","data":null}（proxy 生效 + 后端可达）
    TOKEN=$(curl -s -X POST http://127.0.0.1:5173/api/auth/register \
      -H 'Content-Type: application/json' \
      -d '{"identifier":"13800001111","password":"secret123","nickname":"演示"}' \
      | /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node -e \
      "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.token))")
    curl -s -N -X POST http://127.0.0.1:5173/api/agent/chat \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d '{"space_id":"<上一步 space/list 取到的 space_id>","message":"二次函数的顶点式我不会"}' \
      | head -c 400
      期望：含 "event: delta"（SSE 过 vite proxy 流式到达，不整体缓冲）
  一键启动说明（写入执行报告 + 根 package.json scripts 注释行）：
    1) npm run api   2) npm run dev   3) 浏览器开 http://127.0.0.1:5173
  （不引入 concurrently 之类新依赖把两条命令合成一条——进程管理交给两个终端，最少依赖原则）

V8 数据闸门回归（步骤 8；证明静态资产未被前端批次误伤）
  /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3 scripts/validate_data.py
  /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3 scripts/verify_items.py
  期望：两脚本 exit=0（validate 8×PASS；verify_items 覆盖 ≥80、不一致 0）

V9 范围自查（步骤 8；grep + git diff）
  git diff --stat 52fe185..HEAD -- packages/engine data/knowledge data/item_bank config \
    scripts/validate_data.py scripts/verify_items.py PRD.md API_CONTRACT.md ALGORITHM.md \
    DATA_SCHEMA.md 知微-参赛完整方案-v4.md
  期望：输出为空
  git status --short
  期望：无 apps/web/dist/ 与 data/local_db/ 未忽略条目

前端用例规划（V4/V5 的构成，纯逻辑层，预计 50–60 例）：
  bands.test.ts       约 10 例（阈值=engine、hex 守恒、边界 0.399/0.4/0.599/0.6/0.799/0.8）
  graphSnapshot.test.ts 约 8 例（20 节点、逐字段、互逆、章节清单、kp 名表完备）
  phrases.test.ts     约 6 例（五类枚举齐全、话术四场景、无评判词）
  client.test.ts      约 10 例（解包/错误码分支/401 副作用/网络错/token 头/GET query）
  sse.test.ts         约 12 例（解析器跨 chunk/多事件/残尾/非 JSON data；降级链三态）
  authStore.test.ts   约 6 例（jsdom：持久化/恢复/logout 清理）
  routerGuard.test.ts 约 4 例（守卫两分支 + 路由表 10 页齐全）

-------------------------------------------------
六、风险与回滚
-------------------------------------------------

R1 vite proxy 对 SSE 的透传不确定性
   风险：http-proxy 理论上透传 chunked，但若出现整体缓冲则流式演示退化。
   缓解：V7 的 curl -N 过 proxy 冒烟即为专项验证；万一缓冲，fallback 是 vite proxy 配置
   加 buffer:false（一行配置，仍在授权范围内）；终极兜底是 sse.ts 的 JSON 降级（D5）不白屏。
R2 engine TS 源进 vite bundle 的解析问题
   风险：vite 对 root 外 TS 文件的预构建（engine 无依赖、纯 ESM，风险低）。
   缓解：V2 typecheck + V6 build 早在步骤 1 即可暴露；如遇问题，改用 vite alias
   '@engine' → 绝对路径（仍零业务改动）。
R3 react-router-dom 6.26.2 与 react 18.3.1 兼容（peer 范围内，风险低）；jsdom 25 与
   vitest 2.1.1 环境加载（主流组合，风险低）。
   缓解：V1 安装即校验版本；不兼容则降至 react-router-dom@6.26.1 / jsdom@24.1.0（同大版本
   补丁级回退，写入偏差清单即可）。
R4 MINOR-① 收紧 verify 入参对既有 150 用例的影响
   风险：既有 attribution 14 用例若有直接传非候选 item_id 的用例会被 400 击穿。
   缓解：03_REVIEW 实测既有用例均传服务端下发的 verification_item（review §三 #15 全链实测）；
   步骤 7 先跑 attribution.test.ts 旧 14 例确认零回归再加新用例。
R5 INFO-1 冷启动立即收敛影响演示观感
   缓解：D12 演示路径强制先自报（默认 3 档）+ AssessmentPage 空态引导文案；不改引擎。
R6 echarts 全量引入致构建体积大（~1MB gzip 前）
   裁决：可接受（本地演示 + 未来云函数静态托管无硬性体积红线）；不为此引入按需裁剪复杂度。
R7 演示库污染：data/local_db/ 是共享演示态
   缓解：联调冒烟一律注册新 identifier；不动 demo@zhiwei.dev 既有数据；探活脚本（如有临时
   脚本）落 /tmp 不入库（沿用迭代 2 先例）。
回滚方案：
  每批次独立 commit（步骤 1–8 八个提交），任一批次出问题 `git revert <该批提交>` 即回滚该批，
  不影响其他批次；后端仅步骤 7 触碰 functions/api 三个文件，revert 单提交即恢复迭代 2 形态；
  前端整次迭代可 `git revert` 步骤 1–7 全部提交回到"apps/web 空壳"。数据资产全程未动，
  无数据回滚需求。

-------------------------------------------------
七、验收清单（对照 PRD §2 P0 / §6 交互纪律 / 迭代 3 范围逐项）
-------------------------------------------------

A. PRD §2 P0 前端侧逐项（验收时逐条勾选）：
  [ ] #1  注册即自动建默认空间（注册成功提示 + space/list 可见）；token 存 localStorage，
        刷新页面不掉线（authStore 测试 + 手测）
  [ ] #2  自报 ≤6 题（实际 4 章节）5 档、30 秒可完成（含"按 3 档填"一键）；提交后 updated 展示
  [ ] #3  测评不出已做题（doneIds + exclude_item_ids 双保险）、不展示对错（D11）、
        converged 即停进结束屏
  [ ] #4  试卷：预置文件→识别→逐题确认；unclear 行无默认值、未标全禁止提交；确认后批量更新展示
  [ ] #6  classify 五类枚举卡片展示；confidence<0.6 clarify 就地追问（不自动 analyze）；
        先复述错误（evidence 展示）再判定
  [ ] #7  procedural_slip/misreading 无归因按钮（前端不调用）；self 不回溯（path 单节点正确渲染）；
        upstream 回溯路径 + 验证题全流程
  [ ] #8  SSE 流式渲染（V7 冒烟 + 页面实测）；hint_down/exit_channel 视觉区分；退出提示
        "我们先往回看一眼 XX"；中断降级 JSON 不白屏（sse.test 降级链用例）
  [ ] #9  归因结果页：回溯路径步进条 + 根因高亮 + 错误类型徽标 + 反驳按钮（reason 可选）+
        reject 追加再验证题 + 耗尽诚实兜底文案；?attribution_id= 刷新回显（#14）
  [ ] #10 图谱四色着色（bands hex，阈值=engine）+ 归因/处方路径高亮 + 全局图例常驻
  [ ] #11 复测闭环前端侧：assessment 支持 baseline/retest 模式选择；报告页 ΔAccuracy 展示
  [ ] #12 报告页：掌握度分布 + 缺口清单 + 基线/复测对比三段齐全

B. PRD §6 交互纪律：
  [ ] 一屏一件事（登录单表单 / 测评单题 / 试卷逐题列表一屏内滚动 / 归因向导分步）
  [ ] 第一屏就让用户开始（登录后无自报 → 直接引导自报 → 引导测评）
  [ ] 采集永不弹窗（silent 证据、识别、判定全程无 modal；仅 ConfirmDialog 用于 409 空间切换
      这种用户主动操作的确认，非采集行为）
  [ ] 空间不占首屏（TopNav 内二级入口，主内容区不摆空间管理）
  [ ] 语气=耐心的学长（phrases.ts 话术表，四场景文案照抄 PRD §6；测试锁定无评判词）
  [ ] 颜色语义全局一致（D6 单一事实源 + 守恒测试；无刺眼大红，警示=暖橙）

C. 迭代 3 范围逐项（总控任务书 1–7）：
  [ ] 1  10 页面全部可导航可用（云盘页为 P1 只读 + 禁用占位）
  [ ] 2  交互纪律 B 全项
  [ ] 3  P0 验收 A 全项
  [ ] 4  技术形态：React Router + Zustand 切片 + 统一 client + SSE 客户端 + ECharts +
        Tailwind 令牌（D1–D6/D8/D10）
  [ ] 5  端到端演示：npm run api → npm run dev 两命令、V7 冒烟通过、演示路径 10 步可走通
        （注册→自报→测评→试卷→归因→处方→对话→复测→报告→图谱）
  [ ] 6  MINOR：①代码+用例落地；②③留痕于执行报告；④用例落地（D13）
  [ ] 7  前端测试 ≥50 用例纯逻辑层全绿；既有 150 用例零回归（V5）

D. 工程纪律：
  [ ] 每批独立 commit（8 提交）；V9 范围自查 diff 为空；错误码九码不扩展（前端只消费不发明）；
      5 份 .md 零改动；data/local_db / dist 产物不入库；依赖仅 +react-router-dom +jsdom 两个。

-------------------------------------------------
（本计划完。implementer 自查要点：每步是否具体可执行、文件路径是否完整、验证命令是否可直接
 复制运行、是否未触碰本计划外的业务代码。）
