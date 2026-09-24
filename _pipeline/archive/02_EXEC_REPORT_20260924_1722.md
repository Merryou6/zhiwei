知微 · 赛前最终修整（4 项用户反馈）执行报告 —— 批次 B / C / D（轮 1，接续批 A）
====================================================================================
执行角色：implementer（接续；上一任实现者完成批 A 后因网络故障中断）
执行日期：2026-09-24
工作区：/Users/Merryou/LearnBuddy/zhiwei（分支 tempdeploy，不切分支、不 rebase）
依据：_pipeline/01_PLAN.md 第 4 版（严格照办；执行歧义按「二、决策记录」裁决，计划外裁决续写 D11+）
本报告归档说明：本轮开工前的 02_EXEC_REPORT.md（迭代 3 版，45,575 B）已先复制归档为
  _pipeline/archive/02_EXEC_REPORT_20260924_1708.md，然后才覆写本文件（先归档再覆写，归档只增不删）。
接手时 HEAD：8a52835（= 01_PLAN 第 4 版入库 commit；批 A 的 4 个 commit 均已落盘）

------------------------------------------------------------------------------------
一、实际做了什么（按批）
------------------------------------------------------------------------------------
【批 A —— 未重做】前任实现者已完成并提交，总控亲验通过：
  23c9f81 空间创建 v1.2（后端）/ 1599e42 前端学科选择器 + 共享 SpaceCreateForm + 顶栏弹层 /
  f564cfe 契约 §2/§0/§11 变更记录 / 890e4cf 修复 Layout.tsx 未使用导入（基线遗留，apps/web tsc 曾红）。
  本轮我没有改动 A 批任何文件；但通过分批跑 functions/api/tests 与 apps/web/tests 全量，
  重新覆盖了 A 批引入的 space.test.ts（15 例）与 stages.test.ts（6 例），均绿（见三）。

【批 B —— 深浅主题（D3）】commit e6e8288
  1. apps/web/index.html：
     - <html lang="zh-CN"> 去掉硬编码 class="dusk"；
     - head 区新增内联同步脚本（读 localStorage 'zhiwei_theme'，只有 === 'light' 才不挂 dusk；
       同时改写 meta[name=theme-color]；catch 兜底挂 dusk = 深色，与默认一致）；
     - 首屏底色由单值 #070c14 改为双分支：html{background-color:#f5f8f9} / html.dusk{...:#070c14}；
     - 顶部注释改为「首帧主题裁决」说明；meta theme-color 初始 content 保持 #070C14。
  2. apps/web/src/stores/theme.ts（新增）：Theme 类型、THEME_COLOR 映射、resolveInitialTheme 纯函数、
     useThemeStore（setTheme = 写 localStorage + classList.toggle('dusk', dark) + 改写 meta + set；
     toggle = 互切）；DOM 与 localStorage 操作全部 try/catch（隐私模式不崩，与 auth/space store 同款纪律）。
  3. apps/web/src/components/ThemeToggle.tsx（新增）：36×36 触控目标，太阳/月亮线框 SVG（aria-hidden），
     aria-label「切换深浅主题」、aria-pressed、title 文案随当前主题；样式全走语义令牌（border-line /
     text-ink-soft / hover:bg-raised），零裸 hex。
  4. apps/web/src/components/TopNav.tsx：空间胶囊左侧挂 <ThemeToggle />；
     下拉箭头 className 由 text-[#93a0b4] 改 text-ink-soft（D3f-1：浅底对比度约 2.9:1 不达标 + 违反
     「组件只写语义类名」纪律）；文件头补主题相关说明。本批未动 TopNav 其他部分。
  5. apps/web/src/router.tsx：STORAGE_KEYS 增 theme: 'zhiwei_theme'（注释同步）。
  6. apps/web/tests/themeStore.test.ts（新增 7 例）。
  未改（按计划不改）：pages/LoginPage.tsx（D3e 登录页常驻深色）、tailwind.config.js 守恒区（D3g）、
  index.css 既有双分支变量体系（D3f-5）。

【批 C1 —— 后端 #20 GET /api/user/profile（D4c）】commit 7347125
  1. functions/api/src/services/profile.ts（新增）：profile(req, ctx) →
     authedUser（401 统一）→ listSpacesByUser → ok({ user, spaces, model })；
     - user 为显式字面构造（user_id / identifier / nickname / created_at），不 spread 整记录，
       password_hash 无法进入响应；
     - spaces 复用 services/space 的 toSpaceView（与 §2 list 完全同形）；
     - model.mode = ZHIWEI_MODEL_MODE === 'remote' ? 'remote' : 'local'；model.name 仅 remote 时取
       ZHIWEI_LLM_MODEL（trim 后非空，否则 null）；API Key 绝不出现在任何分支。
  2. functions/api/src/router.ts：追加 { GET, '/api/user/profile', userProfile }（第 8 组，注释 #20 · v1.2）；
     文件头「19 个接口」注释改为 20。
  3. functions/api/tests/profile.test.ts（新增 5 例）：未认证 401 / 键集与 §2 同形 + model 默认 local /
     全文不含 password_hash 与 salt / nickname 透传与 null / stubEnv remote 分支（含非 remote 值名不下发）。
  4. functions/api/tests/closedLoop.test.ts：E1「路由闭合」由 19 → 20 并补 'GET /api/user/profile'
     （更新而非删除；计划八、总表未列此用例 —— 见 D11）。

【批 C2 —— 前端「我的」页（D4a/D4b）】commit 33b4931
  1. apps/web/src/router.tsx：新增 ME_PATH = '/me'；ROUTES 追加 { path:'/me', label:'我的', page:12,
     requiresAuth:true, nav:true }（末位）→ 路由表 12 页；文件头注释同步 11 页→12 页。
  2. apps/web/src/App.tsx：PAGE_COMPONENTS 增 '/me': MePage（import MePage）；注释 10 页→12 页。
  3. apps/web/src/pages/MePage.tsx（新增）：五区块（账号 / 当前学习空间 / 主题 / 对话模型只读 / 退出登录），
     沿用 max-w-3xl + rounded-2xl border border-line bg-surface shadow-card 卡片结构；
     - 数据源 getUserProfile()（进入时拉账号 + 空间 + 模型），当前空间另读 useSpaceStore 的 activeSpaceOf；
     - 昵称为空显示「未设置」；注册时间用 lib/format.ts 的 formatTime；
     - 空间区块用 lib/stages.ts 的 stageLabel 显示学科，附「去管理」→ /spaces（无活跃空间时给「去选空间」）；
     - 模型区只展示 mode 徽标（本地规则 / 远程大模型）+ remote 模型名 + 固定文案
       「对话模型由服务端配置，不可在此自定义。」—— 不提供任何自定义入口（用户反馈第 4 条）；
     - 退出登录走 ConfirmDialog（全站唯一 modal）→ useAuthStore.clear() + useSpaceStore.clear() → navigate('/login')。
  4. apps/web/src/api/endpoints.ts：追加 getUserProfile()（#20；请求头注释 19→20 接口）。
  5. apps/web/src/api/types.ts：追加 ProfileUserView / ProfileModelView / ProfileData（末尾 §1 #20 段）；
     文件头 19→20 接口、v1.1→v1.2。
  6. apps/web/tests/routerGuard.test.ts（更新而非删除）：11 页→12 页、编号数组补 12、navRoutes 补 '/me'（6 项）、
     PROTECTED 10→11、另补 STORAGE_KEYS.theme === 'zhiwei_theme' 断言（见 D15）。

【批 C3 —— 契约文档（D4c 文档侧）】commit 8eff2e3
  API_CONTRACT.md §1 认证小节末尾纯追加 #20 接口块（res / 说明 / 认证 / 越权 四条）。
  §11 变更记录的 v1.2 合并行（含 ② 新增 #20）在 A3 已落盘，本批未重复追加（见 D12）。

【批 D —— 仓库卫生 + 文档收尾（D5 + D9）】commit afb7796（卫生）+ e6d0b4f（文档）
  1. .gitignore：`deploy/zhiwei.env` 单条 → `deploy/*.env` + `!deploy/*.env.example`（注释同步）。
  2. .env.example：模型段前补 ZHIWEI_MODEL_MODE 说明块（`# ZHIWEI_MODEL_MODE=local` + local 默认 /
     remote 需 ZHIWEI_LLM_* 三项），与 deploy/zhiwei.env.example 变量集对齐。
  3. LOOKATME.md：最后更新行（2026-09-24 / 分支 tempdeploy / 68 次提交）、必读文档表 API_CONTRACT 行标注
     v1.2 与「20 个接口」、一句话进度、进度快照表追加「赛前修整轮」行、关键数字改为实跑口径、
     「怎么跑起来」补分批跑测试提示、迭代 3 终审的 225 用例口径标注为「历史快照」。
  未改：PRD.md（D9 明确不改）；未触碰 tools/e2e-smoke.cjs / _pipeline/PR-tempdeploy.md / 知微-项目介绍.md。

【提交清单（本轮，均为中文 commit，逻辑分离）】
  e6e8288  深浅主题（B）
  7347125  后端 #20（C1）
  33b4931  「我的」页（C2）
  8eff2e3  契约 #20 文档（C3）
  afb7796  仓库卫生（D · 1/2）
  e6d0b4f  LOOKATME 更新（D · 2/2）

------------------------------------------------------------------------------------
二、运行的测试命令与逐条结果（全量按批实跑，遵守 60 秒限制）
------------------------------------------------------------------------------------
说明：本机单条命令约 60 秒被 SIGKILL，故**不跑**单条全量 `vitest run`，改为三条分批；所有 git 命令
      一律加 --no-pager（默认分页器会挂住直至被杀）。

逐子步局部验证（按实施顺序）
  [B]  tsc --noEmit -p apps/web/tsconfig.json                      → exit 0
  [B]  vitest run apps/web/tests/themeStore.test.ts apps/web/tests/bands.test.ts
                                                                   → 2 files / 17 passed
                                                                     （themeStore 7 + bands 10；bands 为守恒区回归哨兵，全绿）
  [B]  起 vite（--port 5179 --strictPort）→ node 忙等 6s → curl / → pkill（同一调用内）
       → 落地 HTML 断言：<html lang="zh-CN"> 无 class="dusk"；内联主题脚本（含 zhiwei_theme）
         出现在样式块之前；零散 <style> 已为双分支（#f5f8f9 / #070c14）
  [C1] tsc --noEmit -p functions/api/tsconfig.json                 → exit 0
  [C1] vitest run functions/api/tests/profile.test.ts               → 1 file / 5 passed
  [C1] vitest run functions/api/tests                             → 13 files / 143 passed
  [C2] tsc --noEmit -p apps/web/tsconfig.json                      → exit 0
  [C2] vitest run apps/web/tests/routerGuard.test.ts apps/web/tests/authStore.test.ts
                                                                   → 2 files / 14 passed
  [C2] vitest run apps/web/tests                                   → 11 files / 106 passed
  [D]  git check-ignore -v .env .env.local deploy/zhiwei.env deploy/prod.env
       → 四条全部命中：.env→.gitignore:17:.env；.env.local→.gitignore:18:.env.*；
         deploy/zhiwei.env 与 deploy/prod.env→.gitignore:22:deploy/*.env
       git check-ignore -v .env.example / deploy/zhiwei.env.example
       → 两者均不命中（退出码非 0，正确）
  [D]  git --no-pager log --all -p -- .env '*.env' | head          → 输出为空（历史无任何真值 env 提交）
       git ls-files | grep -i env                                  → 仅 .env.example 与 deploy/zhiwei.env.example
  [D]  python3 scripts/validate_data.py                            → [PASS] 数据闸门 6 项阻断校验全通过
                                                                     （16 条非阻断提醒，与上轮一致）

收尾全量（分批）实跑
  批次 1/3  vitest run packages              → 2 files / **43 passed**（bkt 20 + selection 23）
  批次 2/3  vitest run functions/api/tests   → 13 files / **143 passed**
  批次 3/3  vitest run apps/web/tests        → 11 files / **106 passed**
  ── 合计：26 个测试文件 / **292 例全绿，0 failed，0 skipped**
  三段 tsc：engine=0 / functions/api=0 / apps/web=0
  （另外单独复跑过 apps/web/tests 与 functions/api/tests 各多次，结果一致，无 flaky 现象）

额外端到端验证（真实 HTTP，非 dispatch 直调；补偿「不能起常驻服务」的限制）
  同一条命令内：esbuild 打包 server.ts → 临时 storeDir（/tmp mkdtemp，不污染 data/local_db）→
  startApiServer(:8791) → 真实 fetch 注册 + fetch #20 → 关闭并删临时目录。
  实测响应：{"code":0,"msg":"success","data":{"user":{"user_id":"u_...","identifier":"e2e...@example.com",
  "nickname":"小测","created_at":"2026-09-24T09:08:20Z"},"spaces":[{"space_id":"sp_...","name":"初中数学",
  "subject":"数学","knowledge_source":["kb_math_cz"],"is_default":true,...}],"model":{"mode":"local","name":null}}}
  断言：code=0 ✓；user 键集恰为 created_at,identifier,nickname,user_id ✓；spaces 1 条且与 §2 同形 ✓；
  model={"mode":"local","name":null} ✓；响应全文不含 password_hash ✓、不含 salt ✓；
  未带 token 的真实 HTTP → 状态 401、body code=401 ✓

------------------------------------------------------------------------------------
三、失败详情与修复尝试
------------------------------------------------------------------------------------
1. [已修复] apps/web/tests/themeStore.test.ts 首跑 1 例红：
   setTheme('light') 后 meta content 仍为 '#070C14'（expected '#F5F8F9'）。
   原因：测试辅助函数 ensureMeta() 每次调用都重写 document.head.innerHTML（重建 meta，把 content 复位）。
   修复：把「建 meta」与「读 meta」拆成两个函数（ensureMeta 仅 beforeEach 调用；新增只读 metaContent()）。
   重跑：17/17 绿。属测试自身缺陷，非产品代码问题。
2. [已修复] functions/api/tests/closedLoop.test.ts E1 用例红：
   expected routes to have length 19 but got 20。
   原因：新增 #20 路由后，既有「路由闭合」断言与精确路由清单需同步 —— 计划八、总表判断该文件
   「不受影响」有误（见 D11）。修复：19→20 并补 'GET /api/user/profile' 一行（更新而非删除）。
   重跑：functions/api/tests 143/143 绿。
3. [已修复] 首帧脚本被 Vite 注入错位（实测发现，非测试红）：
   首版 index.html 的 HTML 注释里写了尖括号标签名，Vite 的 head 注入正则误命中注释内的标签名，
   把 @vite/client 与 react-refresh 预置脚本注入了**注释内部**（脚本不执行 → dev HMR 失效）。
   证据：curl 落地 HTML 显示注入脚本落在 <!-- ... --> 中间。
   修复：注释改写为非标签写法，并留「注释里不要写尖括号标签名」的警示；重跑落地 HTML 断言，
   注释完整、注入脚本正常位于 head 内。此问题为运行时实测发现，静态 tsc/vitest 均无法覆盖。
（无遗留失败：收尾全量 292 例 0 failed、三段 tsc exit 0、数据闸门 PASS。）

------------------------------------------------------------------------------------
四、计划「八、测试影响总表」实跑对账
------------------------------------------------------------------------------------
计划口径：基线 225 用例（引擎 38 + 后端 123 + 前端 64，20 文件）；预计总数 ≈ 243。
实跑口径（开工前 commit f31643e 逐文件核数）：**269 例 / 23 文件**（引擎 43 + 后端 133 + 前端 93）。
  → 计划的 225 是迭代 3 时期的旧快照，未计入 b8d5581 合并 main 引入的测试（如 remoteChat.test.ts 15 例）
    等增量。以实跑为准，不以此改写计划（计划只读）。
逐条对账（计划表 4 条 + 新增用例）：
  1. space.test.ts「create」组 4 → 9 例（A1）               —— 已落实（本轮实跑 space.test.ts 15 例绿）。
     明细：409 默认同名 / 非法 kb 400 / (a) 清表后不传 name / (b) 同学科多空间 / (c) 同名 409 /
     (d) name 空串·空白·32 字·非字符串 400 / (e) kb_math_gz 缺省名 / (f) trim 与恰 30 字边界 /
     未认证 401，共 9；list 2 + drive 4 未动。
  2. routerGuard.test.ts「2 处断言更新」（C2）              —— 已落实，且**必须多改 1 处**：
     11→12 页与编号 1–12、navRoutes 5→6 项（补 '/me'）之外，PROTECTED toHaveLength(10) 必须改 11
     （requiresAuth 的页面由 10 增至 11），计划「其余守卫用例不动」在此处不成立（见 D15）。
     另在同一用例内补 STORAGE_KEYS.theme 断言（该用例本就以「STORAGE_KEYS 键名一致」为主题）。
  3. client.test.ts（createSpace 可选 name）                —— 无需改：13 例原样全绿。
  4. closedLoop.test.ts / 其余后端例「不受影响」             —— **不符**：closedLoop E1 路由闭合断言 19→20
     （更新而非删除），见 D11；其余后端例确实不受影响。
  新增用例实跑：stages.test.ts **6**（计划写 4；A2 实际落 6）+ themeStore.test.ts **7**（计划写 4）
     + profile.test.ts **5** = 18；计划预计 13。
  总数实跑：269（基线，非 225）+ 5（A1 space 净增）+ 6（A2 stages）+ 7（B themeStore）+ 5（C1 profile）
     + 0（C2 routerGuard 更新不增例）= **292 / 26 文件**，与三条分批实跑汇总完全一致。
  「更新而非删除」纪律：本轮所有测试改动均为改断言或新增文件，无整段删除（见 git diff --stat：
     closedLoop.test.ts 改 2 处；routerGuard.test.ts 改 4 处；其余为新增文件）。

------------------------------------------------------------------------------------
五、与计划的偏差清单（计划外裁决续写 D11+）
------------------------------------------------------------------------------------
D11【必须偏离，计划判断有误】closedLoop.test.ts 的「E1 路由闭合：19 个接口全部挂载」用例
  计划八、总表第 4 条判断 closedLoop.test.ts「不受影响」，但该用例含精确路由计数与清单断言，
  新增 #20 后必然红。裁决：按「更新而非删除」纪律把 19 → 20 并补一行路由断言，用例名与注释同步为
  v1.2/#1–#20。理由：该断言正是「路由表与契约逐项一致」的守门测试，删它等于丢护栏。
D12【偏离】计划三、3.4 要求 C3 在 §11 追加 v1.2 合并行（①②）。实际 A3（f564cfe）已把该合并行落盘
  （含「② 新增 #20 GET /api/user/profile」）。裁决：C3 只补 3.2 的 §1 接口块，不重复追加 §11 行
  （重复 = 表格碎片化，违背 3.4「避免表格碎片化」的本意）。
D13【自行裁决】index.html 内联脚本的插入位置。计划 D3b 只说「head 内、charset 之后」，而 3.2 步的
  验证又要求「内联脚本先于 style」，同时 D3c 要求脚本改写 meta theme-color。若把脚本放在 charset
  正后方，则 document.querySelector('meta[name="theme-color"]') 取不到（meta 尚未解析）→ 浅色首帧
  theme-color 无法被改写。裁决：置于 theme-color meta 之后、样式块之前 —— 同时满足「charset 之后」
  「先于 style」「能改写 meta」三条。实测（curl 落地 HTML）三者均成立。
D14【自行裁决 + 实测修复】HTML 注释禁止出现尖括号标签名。首版注释含标签名写法，被 Vite 的 head
  注入正则误命中，导致 @vite/client / react-refresh 预置脚本被注入注释内部（dev HMR 失效）。
  裁决：注释改用非标签写法，并在文件内留警示注释。理由：这是构建链的实际行为，不是风格偏好。
D15【必须偏离，计划语句不准确】routerGuard.test.ts 的 PROTECTED toHaveLength(10) 必须改 11。
  计划 C2 写「其余守卫用例不动」；但 /me 为 requiresAuth:true，该断言必然从 10 变 11。
  裁决：改 11 并在用例内加注释说明来源；同用例补 STORAGE_KEYS.theme 断言（主题键与 index.html
  内联脚本同源，属该用例主题范围内的正当补充，非新增用例，例数不变）。
D16【轻微偏离】.env.example 的 MODEL_MODE 说明。计划 D5c 说「补一行注释」；实际写了 3 行注释块
  （模式含义 + remote 前提），与 deploy/zhiwei.env.example 的写法风格对齐（后者也是多行说明）。
  内容为纯注释、不激活任何变量（仍是 `# ZHIWEI_MODEL_MODE=local`），无功能影响。

------------------------------------------------------------------------------------
六、未完成项与未验证项及原因
------------------------------------------------------------------------------------
1.【未验证 · 环境限制】计划十、总验收第 5 条的**浏览器走查**未做：/spaces 选「高中数学」一键新建、
   顶栏弹层内新建反馈、主题切换两处入口生效且刷新保持、/me 五区块目视、退出登录回登录页。
   原因：本机单条命令约 60 秒被 SIGKILL，且**后台任务同样被杀**——无法在「起后端 + 起前端」与服务
   存活的前提下跨多次工具调用做交互式浏览器操作。已做的补偿验证：
   - 落地 HTML 断言（无硬编码 dusk、内联脚本先于样式）+ themeStore 单测 7 例（DOM/meta/localStorage 双写、隐私模式不崩）；
   - #20 真实 HTTP 端到端（注册 → profile → 401 未认证）与 5 例契约用例；
   - A 批前端学科选择器 / 顶栏弹层的有测试覆盖部分（stages 6 例）复跑全绿。
   仍**未验证**的观感类事实：浅色下各页对比度（D3f 的观察项 ZhiweiLogo 渐变）、主题切换后刷新保持的
   端到端表现、/me 页真实渲染布局。
2.【未做（计划未要求）】MePage 的组件级渲染测试（jsdom + react-dom）未新增，避免超出计划测试范围；
   该页数据路径已被 profile.test.ts（后端）+ tsc 覆盖，但「五区块渲染是否齐全」无自动化断言。
3.【未做（计划未列为本轮验证项）】生产构建（vite build / esbuild 后端产物）未重跑；LOOKATME 中的构建
   体积数字沿用上轮实测值并已标注。
4.【未做（轮 2 范围）】用户反馈第 5 条（对话链路改造 + 右侧常驻面板）：本轮零代码，未触碰 Layout.tsx。
5.【未做（明确排除项）】packages/engine、data/**、config/params.json、scripts/** 零改动；
   PRD / ALGORITHM / DATA_SCHEMA / 参赛方案 v4 未改；状态带取色入口 theme/bands.ts 未改（bands.test 10 例回归绿）。
6. 工作区他人未提交变更（tools/e2e-smoke.cjs 已修改、_pipeline/PR-tempdeploy.md 与 知微-项目介绍.md
   未跟踪）全程未暂存、未提交、未回退；本轮 6 个 commit 均不含它们（已逐次以 git status 核对暂存清单）。

------------------------------------------------------------------------------------
七、B 批「调用顺序陷阱」的验证说明（总控指定要点 2）
------------------------------------------------------------------------------------
本轮 B 批（主题）未触及 stores/space.ts 的 setActive/setSpaces 流程，C 批 MePage 也不新建空间，
故本轮没有新增「新空间被回落逻辑顶掉」的风险点。为确认该机制未被破坏，我做了两项核对：
  1. 复跑 A2 的 stages.test.ts（6 例）与 A 批后的 space.test.ts（15 例）、functions/api/tests 全量 143 例，
     全部绿 —— A2 已按「先 setActive(新id) 再 setSpaces(新列表)」实现（SpaceCreateForm.tsx 第 61-63 行
     有显式注释与顺序），本轮无改动。
  2. 阅读确认 stores/space.ts 的 setSpaces 仍是「保留原 activeSpaceId，否则回落 pickDefaultSpace」语义，
     本轮对其零改动（apps/web/src/stores/space.ts 在 git diff 中不存在）。
结论：本轮改动不引入该陷阱；调用顺序纪律仍由 SpaceCreateForm 内注释 + A2 落的 stages.test.ts 守住。

------------------------------------------------------------------------------------
八、结论
------------------------------------------------------------------------------------
批次 B / C1 / C2 / C3 / D 全部按计划落地并各自 commit；收尾分批实跑 292 例全绿（26 文件）、
三段 tsc 全 exit 0、数据闸门 PASS、#20 真实 HTTP 端到端通过；无遗留失败。
与计划的偏差 6 条（D11–D16）：2 条为计划判断/语句与现状不符的必须偏离（D11、D15），
2 条为计划未覆盖细节的自行裁决（D13、D14，其中 D14 为实测发现的构建链问题），
2 条为轻微/记录性偏离（D12、D16）。最需注意的未验证项是浏览器走查（环境限制，见六.1）。
