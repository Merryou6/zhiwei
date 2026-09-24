知微 · 赛前最终修整（4 项用户反馈）实施计划
=================================================
计划编号：01_PLAN（第 4 版，功能冻结日修整轮，非新功能迭代）
编写日期：2026-09-24
编写角色：planner（只读规划，implementer 严格照办；执行歧义按本计划「二、决策记录」裁决）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD = f31643e（分支 tempdeploy，已含 main b196b09 的合并；工作区存在他人未提交
      变更：tools/e2e-smoke.cjs 已修改、_pipeline/PR-tempdeploy.md 与 知微-项目介绍.md 未跟踪
      —— 本计划不碰、不提交、不回退它们，见 D10）
权威依据：API_CONTRACT.md（冻结，本计划经项目方同意以「变更记录」形式追加，见三）> ALGORITHM.md
      > DATA_SCHEMA.md > PRD.md > 方案 v4。
测试基线：225 用例全绿（引擎 38 + 后端 123 + 前端 64，20 文件）；tsc 三段 exit 0。
提问纪律：总控已声明优先自行裁决。本计划无阻塞性疑问；全部歧义已在「二」留 D 编号决策记录。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL；需等待用 node 忙等；起服务做端到端必须在同一调用内「起→探→杀」。

-------------------------------------------------
一、目标与范围
-------------------------------------------------
1.1 用户反馈（项目方 2026-09-24 实机使用后提出，本计划负责 4 条，第 5 条对话链路留轮 2）：
  (1) 空间无法新建：SpacesPage 的 STAGES 常量只用于 stageLabel() 显示，从未渲染成选择器，
      stage 恒为 kb_math_cz；注册时服务端已自动建同学科默认空间 → POST /api/space/create
      必命中「同学科空间已存在」409 → ConfirmDialog 只给「取消 / 切换过去」。用户原话：
      「根本没有地方可以选学科」。另 TopNav「管理空间」只是 Link，已在 /spaces 时无反馈。
  (2) 没有「我的」页面。
  (3) 主题写死深色（index.html class="dusk" 常驻），需要可切换深浅且首帧不闪。
  (4) 对话模型配置：模型由服务端环境变量提供，前端不提供自定义入口；env 真值绝不能入库。
1.2 批次划分（每批可独立提交、独立回滚；顺序 A→B→C→D 串行，见 D8）：
  A 空间体系（后端规则 + 前端选择器 + 顶栏面板，D1/D2）
  B 深浅主题（D3）
  C 「我的」页 + 只读接口 #20（D4）
  D 仓库卫生 + 文档收尾（D5）
1.3 明确排除（一行相关代码都不写）：
  (1) 对话链路改造（用户反馈第 5 条，轮 2 处理）。
  (2) packages/engine/**、data/knowledge/**、data/item_bank/**、config/params.json、
      scripts/validate_data.py、scripts/verify_items.py 零改动。
  (3) 算法参数、状态带取色入口（theme/bands.ts 守恒区）、SSE 降级、序列化白名单——红线不动。
  (4) PRD / ALGORITHM / DATA_SCHEMA / 方案 v4 不改（仅 API_CONTRACT.md 按三、的裁剪式追加，见 D9）。
  (5) 新依赖零安装（不装 jsdom 之外的任何包；jsdom 已在用——前端测试以
      `// @vitest-environment jsdom` 文件级 pragma 声明，authStore.test.ts 先例）。
1.4 关键现状核对（编写本计划时实测）：
  - .gitignore 已挡 .env / .env.* / deploy/zhiwei.env（!.env.example 例外）；
    `git log --all --oneline -- .env '*.env'` 输出为空（无历史真值提交）；
    `git ls-files` 中 env 相关仅 .env.example 一条 → 无泄漏，见 D5。
  - .env.example 缺 ZHIWEI_MODEL_MODE（deploy/zhiwei.env.example 有）→ 两模板变量集不一致，D5 修。
  - models/index.ts：process.env.ZHIWEI_MODEL_MODE === 'remote' ? remote : local，默认 local。
  - 前端无 bg-white / text-black 残留（2026-09-22 视觉批四已令牌化）；硬编码色审计见 D3。
  - GraphPage 已通过 themeColor() 读 CSS 变量（--c-ink/--c-line/--c-accent），天然支持主题切换。
  - LoginPage 全部使用字面 dusk-* 令牌（bg-dusk-base 等），不依赖 html.dusk 开关 → 两主题下均深色。
  - 前端测试位于 apps/web/tests/（9 文件）；后端测试 functions/api/tests/（13 文件）；
    全量命令跑三者 + 引擎。
  - Store 接口已有 listSpacesByUser(userId)，足以实现「同用户同名查重」，无需改 Store/双实现（D1c）。

-------------------------------------------------
二、决策记录（D1–D10）
-------------------------------------------------
D1 空间创建规则变更（总控裁决，落实为契约 §2 变更，全文见「三、」）
  a) 新建空间 = 真正的学科选择器（选项 = data/knowledge/index.json 的 stages：kb_math_cz
     初中数学 / kb_math_gz 高中数学）+ 可选自定义空间名。取消「每学科每用户限一个空间」，
     改为同一用户内「空间名」唯一。请求体新增可选 name（缺省服务端取知识库名，向后兼容）；
     仅同名时 409（data.existing_space_id 语义保留）。
  b) name 校验：非字符串 / trim 后为空 / trim 后超 30 字符 → 400。空串不视为缺省
     （与「试卷 unclear 拒绝默认值」同一纪律：宁拒收不猜测）。
  c) 服务端实现：同名查重用现有 ctx.store.listSpacesByUser(user.user_id) 内存过滤，
     不新增 Store 方法（避免动 db/types.ts + jsonStore + cloudbaseStore 三处）。
  d) 前端防卡死设计：提交前用 store 中已有空间名做本地预检，未填自定义名时自动取学科名，
     重名则自动追加序号（「初中数学 2」「初中数学 3」…）再提交——保证「一键新建必成功」；
     服务端 409 仅作并发兜底，收到后走既有 ConfirmDialog「切换过去」。
  e) 依据：用户「根本没有地方可以选学科」+ 总控 D1 原文；409 路径与 existing_space_id
     字段保留，SpacesPage 的 ConfirmDialog 结构可复用仅改文案。

D2 顶栏「管理空间」真实反馈（总控裁决）
  a) TopNav 空间下拉不再只有「管理空间」Link：下拉底部新增「+ 新建空间」按钮，点击原地
     展开内嵌新建表单（SpaceCreateForm 紧凑态：学科单选 + 可选名 + 提交）；成功后
     setActive + 刷新空间列表 + toast + 收起弹层——任意页面都有看得见的反馈。
  b) 「管理空间」Link 保留（不在 /spaces 时点击即导航，本身有反馈；新增表单后即使
     在 /spaces 页弹层内也有完整操作）。
  c) 职责划分（避免两套新建入口各自为政）：新建逻辑抽成唯一共享组件
     components/SpaceCreateForm.tsx，/spaces 页（完整表单态）与 TopNav 弹层（紧凑态）
     复用同一组件与同一套提交/预检/409 处理；顶栏弹层 = 快速切换 + 快速新建（轻量内联），
     /spaces 页 = 完整管理（列表、进入学习、新建、空状态引导）。
  d) STAGES 常量从 SpacesPage 迁到 lib/stages.ts（SpacesPage / SpaceCreateForm / 一致性测试
     三处共用），见 D6。

D3 深浅主题（总控裁决）
  a) theme: 'dark' | 'light'，localStorage 键 zhiwei_theme（进 router.tsx STORAGE_KEYS，
     与既有落盘键集中管理）；默认 dark（保持现有观感，上线不变样）。
  b) 首帧不闪：index.html 去掉 <html class="dusk"> 硬编码，改为 <head> 最早处的内联同步脚本
     读 localStorage 决定是否挂 dusk class（读不到/异常 → dark，与默认一致）；内联 <style>
     的 html 底色改为双分支（html{#F5F8F9} / html.dusk{#070C14}），脚本在样式前执行亦可。
  c) <meta name="theme-color">：初始 content 保持 #070C14（默认深色）；内联脚本在浅色时
     改写为 #F5F8F9；运行期切换由 theme store 同步改写 meta。
  d) 切换入口：顶栏 ThemeToggle 图标按钮（空间胶囊左侧）+「我的」页内一组，两处共用
     useThemeStore。
  e) 登录页常驻深色不随主题切换（自行裁决）：LoginPage 的 dusk-* 均为字面令牌（不随
     html.dusk 变量切换），粒子标识与 #FFB088 错误色按深底标定，浅底需整套重调对比度，
     赛前不值得冒险；登录是「开场」而非「工作区」，主题偏好在登录后立即生效。
  f) 硬编码颜色审计结论（逐一列出与改法）：
     1. components/TopNav.tsx:104 `text-[#93a0b4]`（下拉箭头）→ 改 `text-ink-soft`
        （B 批修；浅色下 #93a0b4 对白底仅约 2.9:1，且违反「组件只写语义类名」纪律）。
     2. pages/LoginPage.tsx `text-[#FFB088]` / `border-[#FFB088]/70` / 全部 dusk-* 类
        → 不改（登录页常驻深色，见 e）。
     3. components/ZhiweiLogo.tsx 渐变 #5FA8FF/#67E8F9/#7CF7B0 与白色高光 → 品牌装饰，
        两主题通用评估为可接受，不改；列入 B 批走查观察项，实测对比度异常再议。
     4. pages/GraphPage.tsx EDGE/TEXT_COLOR_FALLBACK（#C9D3D8 / #22303A）→ 已是「读不到
        CSS 变量时的兜底」，正常路径走 themeColor() 读变量，不改。
     5. index.css 内散写 hex（focus 环 / 滚动条 / caret 等）→ 已按 html / html.dusk 双分支
        覆盖，属主题机制本体，不改。
     6. Toast / BandLegend / EmptyState 等组件 → 已全语义令牌化（grep 证实无 bg-white /
        text-black / 裸 hex 类名），无需改。
     7. theme/bands.ts 的 bandVeilHex() → 实色低透明度方案本身两主题通用（文件内注释已
        论证），不新增取色入口，不违红线。
  g) tailwind.config.js 守恒区（primary/band-*/tone-error 等字面 hex）一律不动
     （tests/bands.test.ts 逐键断言）；主题切换只动 html class 与变量解析，零改令牌。

D4 新增「我的」页 + 只读接口 #20（总控裁决）
  a) 路由 /me（label「我的」，page: 12，requiresAuth: true，nav: true → 进顶栏主导航）。
  b) 页面内容：账号信息（identifier / nickname / user_id / 注册时间）、当前学习空间
     （读 space store 的 activeSpace，附「去管理」链接 /spaces）、主题切换（ThemeToggle）、
     当前对话模型（只读展示，明示「由服务端配置，不可自定义」）、退出登录
     （useAuthStore.clear + useSpaceStore.clear + 导航 /login）。
  c) 新接口 #20 GET /api/user/profile（只读，契约全文见「三、」）：
     data = { user: {user_id, identifier, nickname, created_at},
              spaces: [SpaceView…（复用 §2 list 的序列化）],
              model: { mode: 'local'|'remote', name: string|null } }
     — user 视图为显式构造的字面对象，password_hash 绝不进入响应（不整记录透传）；
     — model.mode 取 ZHIWEI_MODEL_MODE（=== 'remote' 才 remote，否则 local），
       model.name 仅 remote 时取 ZHIWEI_LLM_MODEL（可为 null），API_KEY 绝不下发；
     — 无 space_id 入参 → 无越权面；401 由 requireAuth 覆盖（与全接口一致）；
     — answer / solution_steps 与本接口无交集，红线不受影响。
  d) 接口编号沿用 #1–#19 惯例 → #20；字段命名沿用 §1 小写蛇形 + §0 统一响应体。

D5 仓库卫生（总控裁决）
  a) 已核查（planner 2026-09-24 预跑留痕，implementer 复跑确认）：
     `git log --all -p -- .env '*.env' | head` → 空（无任何真值提交）；
     `git ls-files | grep -iE env` → 仅 .env.example。无泄漏，无需历史清洗步骤。
  b) .gitignore 收紧：`deploy/zhiwei.env` 单条改为通配 `deploy/*.env` +
     `!deploy/*.env.example`（挡住将来新增的 deploy/prod.env 等；模板仍可入库）。
     根部 `.env` / `.env.*` / `!.env.example` 已正确，保留。
  c) .env.example 补一行注释 `# ZHIWEI_MODEL_MODE=local`（说明：local 为默认；remote 时
     需 ZHIWEI_LLM_* 三项），与 deploy/zhiwei.env.example 变量集对齐（其余变量两模板已一致）。
  d) ZHIWEI_MODEL_MODE 默认值与注释对齐：models/index.ts 默认 local（代码即默认，无需 env
     也能跑）=「默认提供一个模型」（本地规则适配器）；两个模板注释均写「local（默认）」，
     D 批核对即可，不改代码。

D6 STAGES 前端静态副本 + 一致性测试（自行裁决）
  依据：后端无「学段清单」下发接口，且不为本轮新增；前端已有静态副本先例（知识图谱
  snapshot，迭代 3 D7）。做法：lib/stages.ts 导出 STAGES（自 SpacesPage 迁出，注释指向
  data/knowledge/index.json）+ suggestSpaceName(base, taken)；新增
  apps/web/tests/stages.test.ts 断言 STAGES === index.json 的 stages（kb_id + name 逐项），
  防两处漂移。

D7 findSpaceByUserAndKnowledgeSource 保留不删（自行裁决）
  D1 后 services/space.ts 不再调用它，但 Store 接口 + jsonStore + cloudbaseStore 三处的
  方法定义保留（删它 = 三处改动换零收益，且 dist 由构建再生）。在 services/space.ts 的
  D1 改动处以注释说明「查重口径已改为同名（v1.2），该方法暂无调用方，保留备查」。

D8 批次顺序与多写手冲突避免（自行裁决）
  顺序严格 A → B → C → D，每批内部再按 A1→A2→A3 等子步串行；每子步完成即 commit，
  下一子步开工前用 `git log --oneline -3` 确认上一子步已落盘。TopNav.tsx 被 A（下拉内嵌
  新建）与 B（ThemeToggle）两批修改 → B 批动 TopNav 前必须确认 A 批已 commit；
  router.tsx 被 B（STORAGE_KEYS）与 C（ROUTES）修改 → 同规则。任何时刻同一文件只有一个
  写手（单 implementer 串行执行即天然满足；若总控重派，先按 AGENT §8-2 查活跃再转复核）。

D9 冻结文档修改边界（自行裁决）
  仅 API_CONTRACT.md 按「三、」追加/标注（项目方已同意）；PRD.md §5 页面清单不改
  （「我的」属账号辅助页，学习主链路 10 页口径不变，偏差在执行报告留痕）；LOOKATME.md
  非冻结文档，D 批更新进度快照与新数字。

D10 分支与工作区纪律（自行裁决）
  在当前分支 tempdeploy（HEAD f31643e）继续作业与提交（它已含 main 全部能力 + 部署增强）；
  不切分支、不 rebase、不回退他人未提交变更（tools/e2e-smoke.cjs / PR-tempdeploy.md /
  知微-项目介绍.md）；本计划的 commit 不得包含上述文件。

-------------------------------------------------
三、API_CONTRACT.md 变更内容（A3 / C3 两个文档 commit 落地，追加式，不删改原条款语义）
-------------------------------------------------
3.1 §2 POST /api/space/create 小节：在原代码块后追加「v1.2 变更」标注块（原文保留）：
    req 增加 `"name": "可选，1–30 字，缺省由服务端取知识库名"`；
    说明行改为两条：「v1.2 起取消每学科每用户限一个空间，改为同一用户内空间名唯一；
    name 由「不接受客户端传入」改为可选传入（旧行为见上行原文）」；
    错误行改为「409 该用户已有同名空间，data = { "existing_space_id": "sp_001" }
    （前端收到 409 后弹窗，默认按钮仍是“切换过去”）」。
3.2 §1 认证小节末尾追加新接口块（纯新增，编号沿用 #20）：
    ### GET /api/user/profile  【#20 · v1.2 新增，只读】
    res: data = { "user": { "user_id", "identifier", "nickname": string | null, "created_at" },
                  "spaces": [ { "space_id", "name", "subject", "knowledge_source": [],
                                "is_default", "created_at" } ],
                  "model": { "mode": "local" | "remote", "name": "模型名（仅 remote 有值）" } }
    认证：需 Bearer token（401 同 §0）。
    规则：只读；password_hash / ZHIWEI_LLM_API_KEY 绝不下发；spaces 序列化与 §2 list 一致；
          model.mode 取 ZHIWEI_MODEL_MODE（默认 local），model.name 取 ZHIWEI_LLM_MODEL。
3.3 §0 错误码表 409 行：含义由「冲突（identifier 已注册 / 同学科空间已存在）」改为
    「冲突（identifier 已注册 / 同名空间已存在）」——此为唯一一处原文字句修改，
    在 §11 变更记录中显式留痕（3.4）。
3.4 §11 变更记录追加两行：
    | 2026-09-24 | v1.2：① space/create 新增可选 name，空间唯一约束由「同学科」改为
      「同用户同名」（409 语义与 existing_space_id 保留，错误码表 409 行同步）；
      ② 新增 #20 GET /api/user/profile（只读，不下发机密） | 项目方 | 总控 |
    （一行合并记录，避免表格碎片化。）

-------------------------------------------------
四、批次 A：空间体系（D1 + D2）
-------------------------------------------------
A1 后端：空间创建规则
  涉及文件：
    functions/api/src/services/space.ts（create 函数重写）
  改动要点（函数级）：
    - create()：新增解析 req.body.name —— undefined/null → 缺省；typeof 非 string → 400
      「name 必须是字符串」；trim 后空 → 400「name 不能为空白」；trim 后长度 >30 → 400
      「name 至多 30 字」。
    - 知识库校验不变（kbIds() 白名单，400 话术保留）。
    - finalName = 客户端 trim 后的 name ?? ctx.data.kbName(kb) ?? '学习空间'。
    - 查重：const mine = await ctx.store.listSpacesByUser(user.user_id);
      const dup = mine.find(s => s.name === finalName);
      dup → httpError.conflict('同名空间已存在', { existing_space_id: dup.space_id })。
    - 插入记录 name = finalName（subject / is_default / created_at 逻辑不变）。
    - 文件头注释更新为 v1.2 语义；按 D7 注释说明旧查重方法去向。
  测试（修改 functions/api/tests/space.test.ts，重写「create」describe，list/drive 不动）：
    - 「已存在同学科空间 → 409」用例改写为「不传 name 且已有同名（默认空间名=初中数学）
      → 409 且 data={existing_space_id}」（断言结构不变，仅用例名与注释更新为同名语义）。
    - 「非法 knowledge_source → 400」保留原样。
    - 原「无同学科空间时 create 成功」拆为 5 个用例：
      (a) 清空 spaces 表后不传 name → 200，name='初中数学'，键恰为 [name, space_id]；
      (b) 已有默认空间时传 name='我的错题本'（同学科 kb_math_cz）→ 200，list 共 2 个空间，
          新空间 is_default=false（同学科多空间，D1 核心行为）；
      (c) 传与已有空间相同 name → 409 + existing_space_id；
      (d) name 空串 / 全空白 / 32 字 / 数字类型 → 400；
      (e) knowledge_source='kb_math_gz' 不传 name → 200，name='高中数学'。
    - 「未认证 → 401」保留。
  验证命令：
    cd /Users/Merryou/LearnBuddy/zhiwei && /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests/space.test.ts
  commit 草案：「空间创建 v1.2：可选 name + 同用户同名唯一（409 保留 existing_space_id），
    取消同学科限制；space 测试 create 组 4→9 用例」

A2 前端：学科选择器 + 共享新建表单 + 顶栏面板
  涉及文件（精确路径）：
    apps/web/src/lib/stages.ts（新增）
    apps/web/src/components/SpaceCreateForm.tsx（新增）
    apps/web/src/pages/SpacesPage.tsx（改造）
    apps/web/src/components/TopNav.tsx（改造下拉）
    apps/web/src/api/types.ts（SpaceCreateRequest 增 name?: string，注释更新）
  改动要点：
    - lib/stages.ts：STAGES 常量（自 SpacesPage 迁出，注释指向 data/knowledge/index.json）
      + suggestSpaceName(base: string, taken: readonly string[]): string —— base 未占用
      返回 base；占用则依次试 `${base} 2`、`${base} 3`…（纯函数，便于测试）。
    - SpaceCreateForm.tsx：props { compact?: boolean; onCreated?: (space) => void }；
      学科单选（radio 组，选项映射 STAGES，初中数学 / 高中数学）+ 可选空间名输入框
      （placeholder「不填就用学科名」）；提交：base = 输入 trim || 所选学科 label，
      name = suggestSpaceName(base, store.spaces.map(s => s.name))；
      POST createSpace({ knowledge_source: 所选 kb, name })；成功 → toast + setActive +
      拉取 listSpaces 刷新 store（+ onCreated 回调收起弹层）；409 → ConfirmDialog
      「已有同名空间」+「切换过去」（复用现有结构）；creating 态防连点。
    - SpacesPage.tsx：删除头部一键「+ 新建空间」按钮与 handleCreate / stage state /
      ConfirmDialog 逻辑（全部移入 SpaceCreateForm）；页面以完整态嵌入 SpaceCreateForm
      （放在 header 下方独立卡片）；空状态 EmptyState 的 action 改为展开同一表单；
      STAGES 改从 lib/stages 导入（stageLabel 保留）。
    - TopNav.tsx：下拉底部「管理空间」Link 之前插入「+ 新建空间」按钮（展开
      SpaceCreateForm compact 态，成功后 setActive + 收起弹层）；Link 保留（D2b）。
      注意：本批不动 TopNav 其他部分（箭头色、ThemeToggle 留 B 批，D8 顺序）。
    - api/types.ts：SpaceCreateRequest 加 name?: string（注释：可选，1–30 字，
      缺省服务端取知识库名，契约 v1.2）。
  测试：
    新增 apps/web/tests/stages.test.ts（文件头 `// @vitest-environment jsdom` 不需要——
    纯 node 即可）：
      - STAGES 与 data/knowledge/index.json 逐项一致（kb_id + name，读文件断言，D6）；
      - suggestSpaceName：不重名原样 / 重名加 2 / 连号 3 / taken 为空数组。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests/stages.test.ts apps/web/tests/client.test.ts
  commit 草案：「空间新建真学科选择器（D1/D2）：共享 SpaceCreateForm（/spaces 完整态 +
    顶栏弹层紧凑态）、可选空间名 + 重名本地自动后缀；STAGES 迁 lib/stages + 一致性测试」

A3 契约文档（本批收尾，逻辑分离成独立 commit）
  涉及文件：API_CONTRACT.md（仅「三、3.1 + 3.3 + 3.4」三处，3.2 留 C3）
  验证命令：cd /Users/Merryou/LearnBuddy/zhiwei && git diff --stat API_CONTRACT.md
    （人工核对：只增不删原条款行，409 行为唯一字句修改且有 §11 留痕）
  commit 草案：「契约 v1.2 变更记录（空间）：create 增可选 name、同名唯一、409 行说明同步」

-------------------------------------------------
五、批次 B：深浅主题（D3）
-------------------------------------------------
涉及文件（精确路径）：
  apps/web/index.html
  apps/web/src/router.tsx（STORAGE_KEYS 增 theme: 'zhiwei_theme'）
  apps/web/src/stores/theme.ts（新增）
  apps/web/src/components/ThemeToggle.tsx（新增）
  apps/web/src/components/TopNav.tsx（加 ThemeToggle + 修 text-[#93a0b4]）
  apps/web/tests/themeStore.test.ts（新增）
改动要点（函数级）：
  - index.html：
    1) <html lang="zh-CN"> 去掉 class="dusk"；
    2) <head> 内、charset 之后插入内联同步脚本：
       (function(){try{var t=localStorage.getItem('zhiwei_theme');var d=t!=='light';
       if(d)document.documentElement.classList.add('dusk');
       var m=document.querySelector('meta[name="theme-color"]');
       if(m)m.setAttribute('content',d?'#070C14':'#F5F8F9');}
       catch(e){document.documentElement.classList.add('dusk');}})();
       （异常兜底 = 深色，与默认一致；注释说明用途与键名。）
    3) 原内联 <style> 的 html{background-color:#070c14} 改双分支：
       html{background-color:#F5F8F9} html.dusk{background-color:#070C14}。
    4) 顶部注释「dusk 常驻」改写为首帧主题裁决说明。
    5) meta theme-color 初始 content 保持 #070C14（默认深色）。
  - stores/theme.ts：
    export type Theme = 'dark' | 'light';
    THEME_COLOR: Record<Theme, string> = { dark: '#070C14', light: '#F5F8F9' }（meta 用）；
    resolveInitialTheme(stored: string | null): Theme（'light' → light，其余 → dark，纯函数）；
    useThemeStore：state.theme 初始 = resolveInitialTheme(localStorage 读 zhiwei_theme)，
    setTheme(theme) = 写 localStorage + documentElement.classList.toggle('dusk', theme==='dark')
    + 改写 meta[name=theme-color] + set({theme})；toggle() = 切换。DOM 操作全部 try/catch
    （隐私模式不崩，与 auth store 同款纪律）。
  - ThemeToggle.tsx：图标按钮（太阳/月亮线性 SVG，aria-label「切换深浅主题」），读
    useThemeStore；按钮样式走语义令牌（bg-surface/border-line/text-ink-soft），触控目标
    ≥36px（沿用触控纪律）。
  - TopNav.tsx：空间胶囊左侧插 ThemeToggle；line 104 `text-[#93a0b4]` → `text-ink-soft`。
  - 不改：LoginPage（常驻深色，D3e）、tailwind.config.js 守恒区（D3g）、index.css 既有
    双分支变量体系（浅色基线已在 :root 完整保留）。
测试（apps/web/tests/themeStore.test.ts，文件头 `// @vitest-environment jsdom`）：
  - resolveInitialTheme：null/'dark'/'garbage' → dark；'light' → light；
  - setTheme('light')：html 无 dusk class、meta content=#F5F8F9、localStorage 写入；
  - setTheme('dark')：dusk class 挂回、meta=#070C14；
  - localStorage 不可用（spy 抛错）不崩（参照 authStore.test.ts 手法）。
验证命令：
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
  /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests/themeStore.test.ts apps/web/tests/bands.test.ts
  （bands.test.ts 必须仍全绿——守恒区未被破坏的回归哨兵。）
  首帧不闪验证（同一条命令内起→探→杀，遵守 60 秒限制）：
  ZHIWEI_API_PORT=8791 与 vite 并起后 curl 抓 / 落地 HTML 断言：无 class="dusk" 硬编码、
  内联脚本先于 <style>；真实浏览器走查（可选，agent-browser）目测切换与首帧。
commit 草案：「深浅主题切换（D3）：默认深色 + localStorage 记忆 + 首帧内联脚本防闪 +
  theme-color 跟随；顶栏与（待 C 批）我的页共用 store；修 TopNav 硬编码灰」

-------------------------------------------------
六、批次 C：「我的」页 + 接口 #20（D4）
-------------------------------------------------
C1 后端：GET /api/user/profile
  涉及文件：
    functions/api/src/services/profile.ts（新增）
    functions/api/src/router.ts（createRoutes 追加一条）
  改动要点：
    - services/profile.ts：export async function profile(req, ctx)：
      const user = await authedUser(req, ctx)（401 统一）；
      const spaces = await ctx.store.listSpacesByUser(user.user_id)；
      返回 ok({ user: { user_id, identifier, nickname, created_at }（显式字面构造，
      password_hash 不进入任何对象）, spaces: spaces.map(toSpaceView)（自 services/space
      导入）, model: { mode: process.env.ZHIWEI_MODEL_MODE === 'remote' ? 'remote' : 'local',
      name: process.env.ZHIWEI_MODEL_MODE === 'remote' ? (process.env.ZHIWEI_LLM_MODEL?.trim()
      || null) : null } })。
    - router.ts：追加 { method: 'GET', pattern: '/api/user/profile', handler: profile }
      （静态段，与既有路由无前缀冲突，追加在报告接口之后并注释「#20 · v1.2」）。
  测试（新增 functions/api/tests/profile.test.ts）：
    - 未认证 → 401；
    - 注册后 GET：code=0；user 键恰为 [user_id, identifier, nickname, created_at]，
      spaces 为 1 条且键与 §2 list 一致，model.mode='local'、model.name=null；
    - JSON.stringify(整个响应) 不含 'password_hash' 与 'salt'（红线断言）；
    - 传 nickname 注册 → profile.user.nickname 透传；未传 → null；
    - （环境变量分支）vi.stubEnv('ZHIWEI_MODEL_MODE','remote') +
      vi.stubEnv('ZHIWEI_LLM_MODEL','deepseek-chat') → mode='remote'、name='deepseek-chat'；
      afterAll unstub。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run functions/api/tests/profile.test.ts
  commit 草案：「新增 #20 GET /api/user/profile（只读）：账号信息 + 空间概览 + 模型运行
    信息（mode/name），password_hash 与 API_KEY 绝不下发；5 用例」

C2 前端：「我的」页
  涉及文件：
    apps/web/src/router.tsx（ROUTES 追加 /me 条目，page: 12）
    apps/web/src/App.tsx（PAGE_COMPONENTS 增 '/me': MePage）
    apps/web/src/pages/MePage.tsx（新增）
    apps/web/src/api/endpoints.ts（追加 #20 getUserProfile）
    apps/web/src/api/types.ts（追加 ProfileData / ProfileView / ProfileModel 类型）
    apps/web/tests/routerGuard.test.ts（更新断言，见下）
  改动要点：
    - MePage.tsx：五个区块（一屏一件事，沿用 max-w-3xl 卡片结构）：
      1) 账号：identifier / nickname（空显示「未设置」）/ user_id / 注册时间（formatTime）；
      2) 当前学习空间：activeSpace 名称 + 学科标签（STAGES）+「去管理」Link /spaces；
      3) 主题：ThemeToggle（与顶栏同一 store）；
      4) 对话模型：mode 徽标（本地规则 / 远程大模型）+ 模型名（remote 时）+
         固定说明文案「对话模型由服务端配置，不可在此自定义」；
      5) 退出登录：确认后 useAuthStore.clear() + useSpaceStore.clear() + navigate(LOGIN_PATH)。
      数据源：进入时 getUserProfile() 拉账号/空间/模型；当前空间另读 useSpaceStore。
    - router.tsx：{ path: '/me', label: '我的', page: 12, requiresAuth: true, nav: true }，
      追加在 ROUTES 末尾（顶栏顺序：测评/对话/图谱/报告/云盘/我的）。
    - guardPath 无需改（requiresAuth 走既有分支；/me 不在无活跃空间豁免名单，行为合理）。
  测试（修改 apps/web/tests/routerGuard.test.ts，更新而非删除）：
    - 「11 页齐全」→「12 页齐全、路径唯一、编号 1–12 各一次」（数组补 12）；
    - navRoutes 断言数组补 '/me'（6 项）；
    - 其余守卫分支用例不动（PROTECTED 自动含 /me，未登录 → /login 自动覆盖）。
  验证命令：
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
    /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules/vitest/vitest.mjs run apps/web/tests/routerGuard.test.ts apps/web/tests/authStore.test.ts
  commit 草案：「新增『我的』页（/me，nav）：账号信息/当前空间/主题切换/模型只读展示/
    退出登录；路由表 12 页，routerGuard 断言同步更新」

C3 契约文档（本批收尾）
  涉及文件：API_CONTRACT.md（追加「三、3.2」接口块 + §11 变更记录行见 3.4）
  验证命令：git diff API_CONTRACT.md（人工核对 §1 末尾纯追加 + §11 只增行）
  commit 草案：「契约 v1.2 变更记录（用户）：新增 #20 GET /api/user/profile（只读）」

-------------------------------------------------
七、批次 D：仓库卫生 + 文档收尾（D5 + D9）
-------------------------------------------------
涉及文件：
  .gitignore
  .env.example
  LOOKATME.md（非冻结，更新进度快照：本轮 4 项反馈修复、测试总数、契约 v1.2）
改动要点：
  - .gitignore：`deploy/zhiwei.env` 行替换为 `deploy/*.env` 与 `!deploy/*.env.example`
    （注释同步说明：部署真值 env 一律不入库，模板可入库）。
  - .env.example：模型段补 `# ZHIWEI_MODEL_MODE=local`（注释：默认本地规则适配器，
    remote 时需上方 ZHIWEI_LLM_* 三项），使两模板变量集一致。
  - LOOKATME.md：一句话进度 + 快照表追加「赛前修整轮（2026-09-24）」行；关键数字更新
    （测试总数以实跑为准）；「必读文档」表 API_CONTRACT 行补注 v1.2。
测试与核查命令（全部可执行）：
  cd /Users/Merryou/LearnBuddy/zhiwei && git check-ignore -v .env .env.local deploy/zhiwei.env deploy/prod.env
    （四条均应输出命中规则；.env.example 与 deploy/zhiwei.env.example 应【不】命中——
     git check-ignore -v .env.example 退出码非 0 即正确）
  git log --all -p -- .env '*.env' | head
    （应只出现 .env.example 的提交记录，无任何真值）
  git ls-files | grep -iE '(^|/)\.env|\.env$'
    （应仅 .env.example 与 deploy/zhiwei.env.example）
  $PY scripts/validate_data.py（确认数据闸门不受本轮影响）
commit 草案：「仓库卫生：env 忽略规则收紧为 deploy/*.env 通配（模板例外）、.env.example
  对齐 ZHIWEI_MODEL_MODE；核查无历史机密入库（命令与结论留痕执行报告）」
  另一条：「LOOKATME 更新赛前修整轮进度与 v1.2 契约注记」

-------------------------------------------------
八、测试影响总表（225 用例的账）
-------------------------------------------------
既有用例被本次改动影响（更新而非删除）：
  1. functions/api/tests/space.test.ts「create」组 4 用例 → 重写为 9 用例（A1）：
     原 409 用例语义由「同学科」改「同名」（断言结构不变）；原「拒收客户端 name」用例
     语义反转，拆为 (a)–(e) 五例。list / drive 组 9 用例零改动。
  2. apps/web/tests/routerGuard.test.ts 2 处断言更新（11→12 页、navRoutes 5→6 项，
     数组补 '/me' 与编号 12）——C2。其余守卫用例不动。
  3. apps/web/tests/client.test.ts（createSpace 调用）→ 类型加可选 name 后无需改
     （A2 验证命令已含回归跑）。
  4. closedLoop.test.ts / 其余后端 123 例 → 不受影响（注册默认空间、走 default space 流；
     A 批后跑 functions 全量确认）。
新增用例：stages.test.ts 4 + themeStore.test.ts 4 + profile.test.ts 5 ≈ 13；
预计总数 225 − 0（无删除）+ 重写净增 5（space 组）+ 13 ≈ 243（以实跑为准，写入执行报告）。

-------------------------------------------------
九、风险与回滚
-------------------------------------------------
R1 契约变更导致既有测试失效
  面：space.test.ts 409/成功路径（已在 A1 同步重写）；前端 client.test.ts（可选字段，
  天然兼容）；若 closedLoop / auth.test 有隐式依赖「同学科 409」的断言（planner 已读
  auth.test 与 helpers 无此依赖），A1 验证命令扩跑 functions 全量兜底。
  回滚：A1/A2/A3 各自独立 commit，git revert <A1> 即回到 v1.1 行为（契约文档 revert A3）。
R2 主题切换导致某页对比度不达标
  面：浅色下 tone-error、BandLegend、Toast error、ZhiweiLogo 渐变（观察项）。
  对策：D3f 审计清单 + B 批走查（起服务截图重点看报告页/图谱页/Toast）；变量体系本身
  是 2026-09-22 按双主题设计的（浅色基线逐字保留），风险集中在少数硬编码点。
  回滚：revert B 批 commit → 回到常驻深色（index.html 的 dusk 由内联脚本默认挂回，
  与现状观感一致）。
R3 新增接口的越权与认证
  面：#20 无 space_id 入参、只读、authedUser 强制 401 → 越权面为设计上不存在；
  对策：profile.test 的 401 用例 + 「响应不含 password_hash / salt」断言锁死；
  code review 附加检查：profile.ts 不得出现 ctx.store 之外的写方法调用。
R4 同名后缀与并发 409
  面：本地预检在多端/并发下可能失手 → 服务端 409 兜底 + ConfirmDialog「切换过去」，
  用户可改名重试；单实例 JSON 存储无并发锁是既有已知限制（LOOKATME），不新增风险。
R5 225 → 243 中「更新而非删除」纪律
  对策：八、的总表把每一条被改用例的去向写死；reviewer 按表核对 git diff 中测试文件
  只见改写与新增、无整段删除。
R6 首帧闪变（浅色用户看到深色一帧 / 反之）
  对策：内联脚本置于 head 最早处 + 异常兜底深色 + 双分支底色 style；B 批验证命令
  抓落地 HTML 断言脚本位置。回滚同 R2。
R7 双写手 / 中断续接
  对策：D8 串行 + 每子步即 commit；中断后凭 git log 定位续接点，不重派并行写手。

-------------------------------------------------
十、总验收标准（D 批结束后一次性跑齐）
-------------------------------------------------
  1. $NODE $WS/node_modules/vitest/vitest.mjs run          → 全绿（预计 ~243 用例，0 skip）
  2. 三段 tsc --noEmit（engine / functions/api / apps/web）→ 全部 exit 0
  3. $PY scripts/validate_data.py                          → 6 项校验通过
  4. git log --all -p -- .env '*.env' | head               → 无真值；
     git check-ignore -v .env deploy/zhiwei.env            → 命中；.env.example 不命中
  5. 手动/agent-browser 走查：/spaces 选「高中数学」一键新建成功；顶栏弹层内新建有反馈；
     主题切换两处入口生效且刷新后保持、首帧不闪；/me 五区块齐全、模型只读文案在位；
     退出登录回到登录页且再进需重新登录。
  6. API_CONTRACT.md diff 审阅：只增不删原条款，409 行唯一字句修改有 §11 留痕。

-------------------------------------------------
十一、执行纪律
-------------------------------------------------
  - 顺序 A1→A2→A3→B→C1→C2→C3→D，每子步 commit 后再开下一步；commit 信息用中文并带
    关键数字（AGENT §7；本计划各批已给草案）。
  - 不碰 D10 列出的他人未提交变更；不修改 engine / data / config / scripts；
    状态带取色唯一入口 theme/bands.ts 不动；SSE 降级不涉及。
  - 执行报告 _pipeline/02_EXEC_REPORT.md 按批记录：实际测试数、偏差清单（若有计划外
    裁决按 D 编号续写 D11+）、本计划「八」总表的实跑对账。
  - 阻塞项：无（总控已裁决全部关键方向；剩余歧义已按 D6/D7/D8/D9/D10 自行裁决留痕）。
