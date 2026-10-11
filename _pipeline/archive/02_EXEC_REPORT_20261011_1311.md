知微 · style-10「青蓝蓝图」全站视觉迁移（第 7 版计划）执行报告 · 第 1 轮
==============================================================
计划文件：_pipeline/01_PLAN.md（第 7 版：style-10 蓝图迁移，493 行；批次 P0–P12、D1–D12 决策记录、R1–R10 风险）
执行角色：implementer（严格按计划实现；执行歧义按 D1–D12 自行裁决，未向总控提问）
本轮范围（总控裁量 R1）：P0 → P1 → P2 → P3 → P4 → P5（最小可交付链），六批全部在范围内
执行时间：2026-10-10 22:52 – 2026-10-11 00:3x（本机时间）
工作区：/Users/Merryou/LearnBuddy/zhiwei    分支：tempui-doc
本轮开始时的 HEAD：f5d9aed（rev-list --count = 182）
本轮结束时的 HEAD：404e7bb（rev-list --count = 184，本轮新增 2 次提交）
环境常量：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
          $WS=/Users/Merryou/.workbuddy/binaries/node/workspace

本报告所有数字都是本次亲自跑出来的；跑不了的写「未跑 + 原因」，不写「应该 / 预计」。


--------------------------------------------------------------
零、开工前的状态复核（本轮最重要的一条背景）
--------------------------------------------------------------
本轮开工时，工作区里 P0–P5 六个批次**已经存在**，是同一流水线的**上一轮 implementer**
在我之前用计划给出的 commit message 落地并提交的（提交时间 21:17–22:44），但它**中断在
「归档完、未写报告」这个脆弱窗口**（AGENT §2 点名的高危窗口：归档与写报告之间）：
  · 旧版 _pipeline/02_EXEC_REPORT.md（移动端适配轮的）已在 21:16 被归档为
    _pipeline/archive/02_EXEC_REPORT_20261010_2116.md（未入库）；
  · 新的 style-10 执行报告始终没有落盘 —— 也就是本轮我要交的东西。
我没有推倒重做（重做只会产生与既有提交重复的空提交），而是按计划逐批**逐条复核 + 复跑全部
验证命令**，并对复核中发现的缺陷做了两处清尾修复（见「五、」）。

开工时复核（实测）：
  git --no-pager log --oneline -6
    2fe4ba3 style10阶段一: 设计系统规范 12 章…            （= 计划 P0）
    08b2d55 style10阶段二草案: blueprint 外壳族 13 件 API 草案…（= 计划 P1）
    0be67ee style10门禁: 三门禁+themeStore 期望按新设计意图重写…（= 计划 P2）
    7ee5dc6 style10批3: 双主题 token 换值…                （= 计划 P3）
    dfa3623 style10批4: blueprint 外壳族 13 件 + ui 族 14 件就地改造…（= 计划 P4）
    f5d9aed style10批0: 制图板外壳一次切换…                （= 计划 P5）
  六个提交的 message 与计划「commit 草稿」逐字对应；batch 依赖顺序（P2 先于 P3、P3 先于 P4、
  P5 最后）成立。
  他人未提交变更（**一律未碰、未 stage、未回退**，实测 git status）：
    M _pipeline/01_PLAN.md（planner 的）、D tempui/纯前端需求文档.md、
    ?? tempui/STYLE-10-迁移分析.md、?? tempui/STYLE-10-迁移计划.md、?? tempui/prototypes/、
    ?? tempui/qa-report.json、?? _pipeline/PR-tempdeploy.md、?? .workbuddy/、?? node_modules/、
    ?? package-lock.json、?? _pipeline/archive/01_PLAN_20261010_2109.md
    （最后两项是上轮 planner / 上轮 implementer 的产物，按惯例不由我纳入提交）


--------------------------------------------------------------
一、逐批完成状态（P0 → P5）
--------------------------------------------------------------
[✔] P0 阶段一：设计系统规范【检查点①】
    产物：tempui/STYLE-10-设计系统规范.md（565 行，唯一产物，零代码）
    commit：2fe4ba3（1 file changed, 565 insertions）
    计划自查命令（实跑）：
      grep -c "^## " tempui/STYLE-10-设计系统规范.md      → 12   （计划要求 ≥12 章）✔
      grep -c "以原型为准" 同文件                          → 12   （计划要求 ≥1 条冲突留痕）✔
    零 React 代码自查（实跑）：
      grep -nE "<(div|span|section|button|svg)|import .* from|=>" 该文件 → 0 命中 ✔
    复核要点：12 章标题与需求文档 §2 的章节序列一致；§4.2 四档视口矩阵给出
    「档位 / Rail / Sheet 内边距 / annos / 引线 / tabbar / mast-meta」七列（P3/P4/P5 的落地依据）；
    §6 冲突表列出「以原型为准」的逐条落点（PRD §6 等）。
[✔] P1 阶段二草案：组件库草案【检查点②】
    产物：tempui/STYLE-10-组件库草案.md（338 行）
    commit：08b2d55（1 file changed, 338 insertions）
    计划自查（实跑）：grep -c "目录结构" / "组件清单" / "API 草案" → 2 / 2 / 2（三节标题齐备）✔
    复核要点：外壳族 13 件逐件 props/variant；就地改造清单 16 件（ui 6 + 布局/浮层 8 + 首帧脚本
    与 store + Layout）；目录结构写明与现有 src/ 的挂接关系。
[✔] P2 门禁期望值重写
    产物：apps/web/tests/{tokens,bands,breakpoints,themeStore}.test.ts
    commit：0be67ee（4 files changed, +351 / -105）
    用例数变化（只增不减，实测）：tokens 12→21、bands 10→12、breakpoints 8→9、themeStore 7→9；
    断言结构保留、只换值；测试文件本身零删除。
    计划的两条分批测试命令（本轮实跑，均已转绿 —— P3 落地后）：
      vitest run apps/web/tests/tokens.test.ts apps/web/tests/bands.test.ts
        → Test Files 2 passed / Tests 33 passed（tokens 21 + bands 12）
      vitest run apps/web/tests/breakpoints.test.ts apps/web/tests/themeStore.test.ts
        → Test Files 2 passed / Tests 18 passed（breakpoints 9 + themeStore 9）
    （R2 的「P2 红 → P3 绿」中间态：本轮只能看到终态绿，红态属上一轮执行期状态，本报告不对其
      作断言；此处如实标注。）
[✔] P3 token 层 / 主题 / 字体落地（三门禁转绿）
    commit：7ee5dc6（7 files changed, +514 / -170）
      apps/web/tailwind.config.js  screens 增 narrow/sheet/annos（nav 保留）+ fontSize 增
                                  blueprint 刻度（tok/mono-xs/body-sm/title-sm/title/num-lg）
                                  + borderRadius 收敛 0/2px + animation 三 token 换值（160/110/800ms
                                  + 单一缓动 cubic-bezier(.2,.7,.3,1)）+ fontFamily 三栈 + 守恒区六 hex
      apps/web/src/index.css      --p-* / --c-* 双主题全量换值（:root 白图 / html.dusk 蓝图）
      apps/web/src/theme/bands.ts 四档色值换新系（档名/阈值/接口签名不动）
      apps/web/src/stores/theme.ts resolveInitialTheme(stored, prefersDark) 重写 + THEME_COLOR 新值
      apps/web/index.html         首帧内联脚本重写 + meta theme-color（#F4F7FA / #0B1B2B）
      apps/web/src/main.tsx       三族 @fontsource 引入
      package.json                @fontsource/{chivo,ibm-plex-mono,noto-sans-sc} ^5.3.0（计划 P3 明示）
    复核（本轮实跑）：
      grep -c "fontsource" apps/web/src/index.css apps/web/src/main.tsx → 0 / 10（≥1 处证据成立）✔
      grep -rn "fonts.googleapis\|fonts.gstatic" apps/web/src apps/web/index.html → 无命中（禁 CDN）✔
      theme.ts 与 index.html 内联脚本逐条对齐：'dark'→挂 dusk、'light'→不挂、其余看
      (prefers-color-scheme: dark)，键名同为 zhiwei_theme（老用户偏好不丢）✔
[✔] P4 组件库实现：外壳族 13 件 + 就地改造
    commit：dfa3623（29 files changed, +2293 / -171）
      新增 apps/web/src/components/blueprint/ ×13：Board / Masthead / Rail / Sheet / TitleBlock /
        AnnoPin / AnnoPop / LeaderLayer / BandMark / Stamp / MeasureBox / SkeletonLines / icons(43 枚)
      就地改造 14 件：ui/{Button,Input,Card,Badge,IconButton,PageContainer} + ConfirmDialog / Toast /
        PageSkeleton / BandLegend / EmptyState / ItemCard / NextStepCard / ThemeToggle
      index.css +191：.bp-btn / .bp-field / .bp-ctl / .bp-chip / .bp-empty / .bp-stamp / .ic / .sh /
        .bp-band-* 制式类（按 P1 草案落点：制式类入 index.css，不进 @layer utilities 以免被扫描裁掉）
      新增 apps/web/tests/blueprint.test.ts（7 用例，纯静态/纯函数，不引渲染栈）
    复核：vitest run apps/web/tests/blueprint.test.ts → 7 passed ✔（本轮全量复跑亦绿）
[✔] P5 批次0：外壳一次切换 + ChatPanel 落位 + 底部导航【检查点④】
    commit：f5d9aed（93 files changed, +3386 / -562；其中代码/配置 8 件 + 走查产物 85 件）
      代码：Layout.tsx（四层装配：Board/Masthead/Rail/Sheet/TitleBlock + 三形态面板 + MobileNav +
            BackToTop + ToastHost）、TopNav.tsx（退役为图签条内的位）、MobileNav.tsx（重构为
            ≤900 底部 5 项 tabbar + 「全部图纸」抽屉）、chat/ChatPanel.tsx、BackToTop.tsx、
            blueprint/{Board,Masthead}.tsx、tools/responsive-audit.cjs（探针改挂新外壳）
    P5 的三条验收（本轮实跑，见「四、走查」）：
      ① 外壳四层：1440 截图可见图签条（PROJECT/SHEET/SCALE/DATE + 身份芯片 + 三开关 + 全部图纸）+
         左侧分层索引（12 张，含 T0/T1/T2 优先级）+ 图纸（页头四件 + dim）+ 右下标题栏；
      ② 面板三形态（量化取证，D3）：1440 挤压 400px（--panel-dock-offset: 400px，无幕布）；
         1024 覆盖 + 全屏幕布（不改图纸宽）；375 全屏覆盖（面板 = 整个视口）；
      ③ 底部 tabbar + 全部图纸抽屉：探针 16 通过 / 0 失败（含互斥、Esc、焦点陷阱、焦点归还）。
    P5 另有两处缺陷由本轮复核发现并修复（见「五、」），故 P5 净含 3 个提交：
      f5d9aed（上轮）→ 5d0630d（清尾修复）→ 404e7bb（走查复采）。


--------------------------------------------------------------
二、本轮提交清单（hash + 变更文件）
--------------------------------------------------------------
本轮的 6 个批次提交全部由上一轮 implementer 产出（hash 见下），本轮新增 2 个清尾提交：

  2fe4ba3  P0  tempui/STYLE-10-设计系统规范.md（1 file, +565）
  08b2d55  P1  tempui/STYLE-10-组件库草案.md（1 file, +338）
  0be67ee  P2  apps/web/tests/{tokens,bands,breakpoints,themeStore}.test.ts（4 files, +351/-105）
  7ee5dc6  P3  apps/web/{tailwind.config.js,index.html} + src/{index.css,main.tsx,stores/theme.ts,
               theme/bands.ts} + package.json（7 files, +514/-170）
  dfa3623  P4  apps/web/src/components/blueprint/×13（新）+ 就地改造 14 件 + src/index.css +
               tests/blueprint.test.ts（29 files, +2293/-171）
  f5d9aed  P5  Layout/TopNav/MobileNav/BackToTop/chat/ChatPanel/blueprint/{Board,Masthead} +
               tools/responsive-audit.cjs + _pipeline/screenshots/style10/（93 files, +3386/-562）
  —— 本轮新增 ——
  5d0630d  P5 清尾：apps/web/src/index.css + apps/web/src/components/blueprint/Sheet.tsx +
               apps/web/tailwind.config.js（3 files, +35/-3）
  404e7bb  P5 走查复采：_pipeline/screenshots/style10/（38 files，同名覆盖，无删除）
  紧随其后：本报告落盘提交（hash 自指，故不写死；取 git log --oneline -1）
  另：_pipeline/archive/02_EXEC_REPORT_20261010_2116.md 随报告一并入库（AGENT §7：归档文件入库）

提交纪律：全部 `git add` **显式路径**，全程未用 git add -A / git add .；未把他人未提交变更
（01_PLAN.md、tempui 迁移分析/迁移计划/prototypes/qa-report.json、PR-tempdeploy.md、.workbuddy/、
node_modules/、package-lock.json、archive/01_PLAN_*.md）扫进任何提交（实测 git status 复核）。


--------------------------------------------------------------
三、验证命令与逐条实测结果（本轮亲自跑）
--------------------------------------------------------------
3.1 类型检查三段（各自独立一条命令，全部 exit 0）
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json   → exit 0
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json     → exit 0
  $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json          → exit 0
  （web 段在清尾修复后复跑一次，仍 exit 0）

3.2 测试三批（分批跑防 60s；各自 exit 0）
  $NODE $WS/node_modules/vitest/vitest.mjs run packages
      → Test Files 2 passed (2)     Tests 43 passed (43)      Duration 1.20s
        （bkt.test 20 / selection.test 23）
  $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      → Test Files 19 passed (19)   Tests 202 passed (202)    Duration 5.99s
  $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      → Test Files 21 passed (21)   Tests 206 passed (206)    Duration 4.55s
        逐文件：routerGuard 9 / graphMastery 7 / breakpoints 9 / stages 14 / graphSnapshot 10 /
        tokens 21 / logoGeometry 17 / blueprint 7 / bands 12 / phrases 6 / format 6 / useCountUp 3 /
        mobileNav 5 / dialogStore 7 / reveal 11 / sse 20 / client 13 / themeStore 9 / authStore 5 /
        chatPanel 5 / richText 10
  全仓合计：2+19+21 = **42 个测试文件 / 43+202+206 = 451 条用例，全绿**。
  与计划基线（41 文件 / 432 用例；apps/web 20 文件）对照：文件 +1、用例 +19，**只增不减** ✔。
  清尾修复后复跑 apps/web/tests 一次：21 文件 / 206 用例仍全绿 ✔。

3.3 前端构建
  计划原命令：$NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts
    → **失败（环境原因，非代码）**：[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED]
      {"count":641,"threshold":500,"targets":["…/apps/web/dist/assets"]}
      根因：vite 构建前会 emptyOutDir 清空 apps/web/dist/assets（641 个文件 > 沙箱批量删除阈值 500），
      被本机安全删除闸门拦下。**未重试、未放行删除**。复核：构建失败后 apps/web/dist/assets 仍有
      641 个文件（闸门是「拒绝执行」而不是「执行到一半」，无残留损失）。
  等价命令（不删任何仓库内文件）：
    $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts \
        --outDir /tmp/zhiwei-web-build-style10
      → ✓ built in 3.61s（704 modules transformed）
        产物：index-*.js 238.86 kB / react 165.57 kB / echarts 434.35 kB /
              index-*.css **418.29 kB（gzip 161.96 kB）** + Noto Sans SC 分片 woff2/woff 若干
    （清尾修复后复跑 → --outDir /tmp/zhiwei-web-build-style10b，✓ built in 5.38s，
      index.css 418.53 kB / gzip 162.02 kB；产物内含 .max-narrow\:static 与 .text-title，
      即本轮 SheetHead sm 档改动已编译进产物 ✔）
  cwd 影响复核：以 apps/web 为 cwd 再构建一次（--outDir /tmp/zhiwei-web-build-cwdweb）
      → ✓ built，CSS 与仓库根 cwd 版本**逐字节相同**（418537 B）；两者都含
      .p-4 / .min-w-\[420px\] / .lg\:grid-cols-2 / .max-narrow\:static / .text-title 各 1 份
      → 工具类无重复、无缺失。
  体积留痕（R6）：index.css 从移动端轮的 34.06 kB 涨到 418 kB，增量几乎全部是
  @fontsource 的 @font-face + unicode-range 分片声明（字体本体按需分片加载）；
  未超「主包 +1MB」阈值，故未做子集化裁剪。

3.4 冻结区检查（计划 3.2；每批必跑，期望空输出）
  ⚠ 计划给出的写法 `git diff --no-pager --name-only HEAD -- …` 在本机 git 下报
    `usage: git diff …`（--no-pager 是 git 全局选项，必须写在子命令之前）。改用**语义等价**的
    `git --no-pager diff --name-only HEAD -- …` 执行（见「六、D-01」）。结果：
    A) git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api \
         packages/engine functions data      → 空输出（exit 0，无文件）✔
    B) git --no-pager diff --name-only HEAD -- apps/web/src/stores | grep -v stores/theme.ts
                                            → 空输出（grep exit 1 = 无匹配）✔
  更严格的对照（比 HEAD 对照更强，本轮新增）：基线 df133d6 → HEAD 全量差异
    A') git --no-pager diff --name-only df133d6 HEAD -- router.tsx api packages/engine functions data
        → 空输出 ✔（P0–P5 六个提交 + 本轮两个提交都没碰冻结区）
    B') git --no-pager diff --name-only df133d6 HEAD -- apps/web/src/stores
        → 只有 apps/web/src/stores/theme.ts（D2 明示的唯一许可改动：初始判定重写）✔
  行为证据（不动的测试文件全绿即冻结区未被破坏）：routerGuard 9 / sse 20 / client 13 /
  chatPanel 5 / mobileNav 5 / dialogStore 7 / graphMastery 7 / graphSnapshot 10 / reveal 11 /
  phrases 6 / stages 14 / authStore 5 —— 共 12 个文件 112 条用例全绿 ✔

3.5 静态纪律复核（计划 6.3，期望无匹配行）
  grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src   → 无匹配（exit 1）✔ 任意值断点禁令成立
  grep -rn "z-\[" apps/web/src                         → 无匹配（exit 1）✔
  grep -rn "fonts.googleapis\|fonts.gstatic" apps/web  → 清尾前 **1 处假命中**
        （apps/web/tailwind.config.js:331 的注释里写了字面 host 名，用于说明「原型那条 CDN 外链
          不是产品例外」）；本轮把该注释改写为不含字面 host 的表述 → 改后**无匹配（exit 1）**✔
        （见「五、3)」）
  另：计划 P3 的字体证据两条已在上文 3.2/§一 P3 给出（fontsource 10 处、CDN 0 处）。


--------------------------------------------------------------
四、真浏览器走查（计划 6.2；P5 检查点④判据）
--------------------------------------------------------------
起服务（两条，后台存活；本轮实测可用）：
  $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs \
      --outfile=functions/api/dist/server.js                      → 174.2kb，22ms
  $NODE functions/api/dist/server.js                              → :8787（nohup 后台，日志确认 ready）
  $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts → :5173（ready in 227ms）
浏览器：Microsoft Edge 155.0.4283.45（--headless=new --no-sandbox --hide-scrollbars）

4.1 走查产物清单（_pipeline/screenshots/style10/，共 85 件）
  style10-1440-dark-<route>.png  × 11      style10-1440-light-<route>.png  × 11
  style10-1024-dark-<route>.png  × 11      style10-1024-light-<route>.png  × 11
  style10-375-dark-<route>.png   × 11      style10-375-light-<route>.png   × 11
  style10-768-dark-<route>.png   × 11      probe-375-drawer-open.png / -open-2.png × 2
  audit-style10-{375,768,1024,1440}.json × 4      last-sample-style10-log.txt / last-probe-log.txt
  11 条路由：/login /self-report /spaces /assessment /paper /chat /attribution /graph /report
            /drive /me
  档位口径核对（计划 6.2）：P5 要求「双主题 × 1440/1024/375 三档」→ 6 套齐备 ✔；
  768-dark 为超出要求的补充档（md 档留档，本轮的 tabbar 修复即由它取证）。
  逐页页面级溢出（实测，含本轮重采）：
    1440 11 页 0px   1024 11 页 0px   768 11 页 0px
    375  10 页 0px + /report 95px（**基线既有缺陷**，非本轮引入，见「七、F-01」）
    375-light 与 375-dark 逐页 anchors/overflow/fonts 全等（11/11 无差异）→ 主题不改几何 ✔

4.2 抽屉 / tabbar 交互探针（16 通过 / 0 失败；本轮共跑 3 次：清尾前 1 次、清尾后 2 次
    —— 其中 1 次独立复跑到 /tmp，结果一致）
  [OK] 已登录、汉堡键存在且可见                [OK] ≤900 主导航改由底部 tabbar 承担（图签条无
  [OK] 初始抽屉不存在                                导航 ul + tabbar 可见且 ≤5 项：实测 5 项）
  [OK] 点击汉堡键后抽屉出现                    [OK] 抽屉 role=dialog / aria-modal=true
  [OK] 汉堡键 aria-expanded=true               [OK] 抽屉从右侧滑入（right ≈ 视口宽）
  [OK] 焦点移入抽屉                            [OK] 25 次 Tab 后焦点仍在抽屉内（焦点陷阱）
  [OK] Esc 关闭抽屉                            [OK] Esc 后焦点归还汉堡键
  [OK] 点背景幕关闭抽屉（指针路径）             [OK] 点抽屉内「学习报告」→ 抽屉收起
  [OK] 点抽屉内「学习报告」→ 路由跳转            [OK] 抽屉内「对话辅导」→ 抽屉收起且面板打开（互斥 D4）
  [OK] 面板开着时点汉堡键 → 面板关闭、抽屉打开（互斥兜底）

4.3 面板三形态量化取证（D3；本轮新增的取证，用一次性 /tmp 脚本读几何，未入库、未改工具）
  1440（xl，≥1180）：关闭时 sheet x=236 w=1204 / article w=1108；打开后面板 x=1040 w=400
    （right=1440）、**无幕布**、sheet w=804 / article w=708、板根 --panel-dock-offset=400px
    → 「挤压图纸宽 400px」成立 ✔（图签条一并让位，内容换行后无重叠：面板左边界 1040 与
      图签条右端 1035 不交叠）
  1024（lg，901–1179）：打开后面板 x=624 w=400 y=56 h=844、**幕布 = 视口**（0,56,1024×844）、
    sheet/article 宽不变 → 「覆盖抽屉 + 幕布」成立 ✔
  375（md/sm，≤900）：打开后面板 = 整个视口（0,0,470×1018，mobile 布局视口）、幕布同尺寸
    → 「全屏覆盖」成立 ✔
  另：375 档页头 h1 高度 25px（= 20px 字号 → 本轮 sm 档对齐后的值；清尾前为 32.5px = 26px）。

4.4 视觉抽查（人工看图，非几何量）
  1440 dark /report：图签条四项 + 左侧 12 张分层索引（T0/T1/T2）+ 图纸页头四件 + 右下图签栏 ✔
  1440 dark /report（面板开）：右侧 400px 面板 + 图纸让位，无横向滚动条 ✔
  375 light+dark 各页：底部 tabbar 常驻、5 项、当前项高亮；页头三行不叠字（清尾前叠字，见五）


--------------------------------------------------------------
五、本轮清尾修复（2 个提交；均为复核发现的缺陷，改动文件全部在计划列出的文件内）
--------------------------------------------------------------
1) 底部 tabbar 在 ≤900 档不可见（P5 交付物缺陷）— commit 5d0630d
   症状（实测，375×812）：`nav[aria-label="主导航"]` 的 rect y=1251.6 / bottom=1316.6，
   而 innerHeight=812、文档高 1317 —— 即主导航被放在**文档最底部**，视口内根本看不到，
   必须滚到页面尽头才出现（375 档截图里看不到 tabbar，Layout 却已经为它预留
   `max-sheet:pb-[76px]`，说明意图是「常驻视口底」）。
   根因（浏览器内逐层读 computed style 定位）：`.route-view` 的动画是
   `route-in 180ms … both`；`both` 让动画结束后仍保留 to 帧的值，而 to 帧写 `transform:none`
   —— 动画里的 none 会被浏览器折算成 identity matrix `matrix(1,0,0,1,0,0)`，**计算值不是 none**，
   于是该层一直建立「fixed 定位的包含块」：所有 `position:fixed` 的后代（P5 新增的底部 tabbar、
   以及 BackToTop、面板定位层）都以这块 1317px 高的容器为基准而不是视口。
   修法：`.route-view` 的填充模式 `both` → `backwards`（只保留起播前状态，结束后把 transform
   交还基础样式 none）；动画本身与终态观感一字未改。文件：apps/web/src/index.css（计划 P3/P4
   文件清单内），并在注释里写清机制与实测数字。
   修后实测：375 档 tabbar bottom=812=视口高；768 档 bottom=900=视口高；1440 档仍 display:none
   （≥900 不渲染，grid 追踪 rect 为 0）；探针复跑 16/0；375/768 截图可见 tabbar ✔
2) ≤420 档页头眉标与 dim 叠字（P5/P4 交付物缺陷）— commit 5d0630d
   症状：375 档页头第三行出现两层文字叠印（截图可见「学习空间 / T2 图纸 SHEET 10-05」与
   「图幅 SM · 基准 15px / IBM Plex Mono 批注」重叠），可读性被破坏。
   依据：原型 tempui/prototypes/style-10/index.html L699
   `#board[data-tier="sm"] .dim{position:static; text-align:left; margin-top:10px}`，
   以及 L696-697 `#board[data-tier="sm"] h1{font-size:20px}` / `.sheet-head h1{word-break:break-word}`
   —— 原型在 sm 档把 dim 降级为普通流左对齐，本工程此前一直绝对定位。
   修法（apps/web/src/components/blueprint/Sheet.tsx，按 D1 用具名断点，不引全局 data-tier）：
   dim 加 `max-narrow:static max-narrow:mt-2.5 max-narrow:text-left`；
   h1 加 `max-narrow:text-title`（20px 令牌）与 `max-narrow:break-words`。
   修后实测：375 档页头三行（eyebrow / h1 20px / dim 左对齐）各占一行；h1 高度 32.5→25px；
   768 与 1440 档完全不变（dim 仍在右上、h1 仍 26px；截图复核）。
3) 计划 6.3「禁 CDN」复查的假命中 — commit 5d0630d
   apps/web/tailwind.config.js 的 fontFamily 注释里写了字面 host 名（这正是 6.3 那条 grep 的
   匹配串），使复查出现 1 处「无 CDN」但 grep 非空的矛盾。改写注释为不含字面 host 的表述并说明
   原因 → 复查零命中。**不是删注释、不是放宽门禁**；注释语义（禁 CDN、原型链接不是产品例外）
   一字不减。
4) 走查产物复采（commit 404e7bb）：因为 1) 2) 改变了 ≤900 档与 ≤420 档的渲染，上一轮入库的
   375/768 截图已与代码不符，按 6.2 原样复跑重采 38 件（同名覆盖，**未删除任何文件**）。
   旧证据的内容差异（tabbar 不可见、dim 叠字）已在 commit message 与本报告中留痕。


--------------------------------------------------------------
六、与计划的偏差及裁决留痕
--------------------------------------------------------------
D-01（命令形态 · 计划文本缺陷）计划 3.2/6.1 写的
     `git diff --no-pager --name-only HEAD -- …` 在本机 git 上报 usage 错误（--no-pager 属 git
     全局选项）。改用 `git --no-pager diff --name-only HEAD -- …`（语义等价），并在 3.4 同时给出
     更强的 df133d6→HEAD 对照。未改动计划文件本身（01_PLAN.md 是别人未提交的，我只读）。
D-02（构建命令）原地 `vite build` 被本机沙箱批量删除闸门拦下（apps/web/dist/assets 641 件 >
     阈值 500），改用 `--outDir /tmp/…` 等价命令并如实标注「原地构建在本机**未取得**通过证据」。
     与上一轮报告 §八4) 记录的是同一环境限制；未尝试绕过安全闸门。
D-03（本轮为何有 2 个额外提交）按总控给的 R1 范围，本轮应产出 P0–P5 六批。实际情形是这六批
     已由上一轮 implementer 提交完毕、但报告未落盘；我按「逐批复核 + 复跑全部命令」的方式完成
     本轮，并在复核中发现 3 处问题（§五 的 1/2/3，其中 1 是功能性缺陷：主导航在 ≤900 不可见）。
     修复只落在计划文件清单内的三个文件（index.css / Sheet.tsx / tailwind.config.js），另加走查
     产物同名复采。若总控认为「复核轮不应再改代码」，可单独 revert 5d0630d 与 404e7bb —— 两者
     与 P0–P4 无依赖关系（P5 外壳其余部分照旧可用）。
D-04（D1 端点语义）D2... （不适用）本轮新增的 `max-narrow:` 与原型「≤420」在恰好 420px 处差
     1px（具名断点 max 侧为 ≤419.98），性质与既有 nav:720 的 1px 端点留痕完全相同；未为此新增
     断点（遵守「断点单一来源 + 禁任意值断点」）。
D-05（走查覆盖）教师端 3 页（/t、/t/student/:id、/t/recommendations）本轮无样本：需要教师演示
     账号，且它们属计划 P11 批次。计划 6.2 允许「无账号则留痕并降级」，此处如实留痕为**未采**。
     768 档只采了深色一套（P5 只要求 1440/1024/375 × 双主题，已满足；768-light 未采）。
D-06（依赖新增）P3 在 package.json 增加了三项 @fontsource 依赖（chivo / ibm-plex-mono /
     noto-sans-sc ^5.3.0）—— 这是计划 P3 明确要求的字体自托管落地方式，不是「依赖升级」；
     无其它依赖变动（实测 diff 只有这 3 行）。
D-07（未改的小瑕疵，留痕不动作）apps/web/index.html 顶部注释仍写「由 index.css 的
     pt-safe/pb-safe/bottom-safe-* 工具类按 env() 避让」，而 .pt-safe/.pb-safe 已在移动端适配轮
     T1 删除（上轮报告 §十② 已记录）。纯注释、无功能影响；本轮未改（P3 虽动过该文件，但该注释
     属他人轮的遗留，改动会引入与批次无关的 diff）。


--------------------------------------------------------------
七、未完成项 / 发现的问题（如实列出，不隐藏）
--------------------------------------------------------------
F-01【基线既有缺陷，非本轮引入】/report 在 375 档页面级横向溢出 95px。
    证据链：
      · 本轮重采（修复前后均复现）：audit-style10-375.json → /report overflowPx=95，
        溢出元素首位是 `div.rounded-surface border border-line bg-surface p-4 shadow-card`（w=454，
        left=16 → right=470），其后是它的 h2/ul/li；
      · 浏览器内探针（/tmp 临时脚本）：文档 clientWidth=375 / scrollWidth=470，
        祖先链 computed style 显示 `div.mt-5.grid.gap-5.lg:grid-cols-2` 的
        grid-template-columns = **454px**（单条隐式轨道），其子卡 `min-width: auto`（w=454）；
      · 移动端适配轮（2026-09-24）的 audit-after-375.json 里 /report 的溢出元素**只有 table 及
        其后代**（说明当时没有这条把两卡并排的 grid）—— 该 grid 是 2026-10-08 的页面级改动，
        晚于那轮走查；而它在**本次迁移的基线提交 df133d6 里已经存在**（实测
        `git show df133d6:apps/web/src/pages/ReportPage.tsx` L181/L215/L331 就是这条 grid 与
        min-w-[420px] 表格）→ **缺陷属于基线，不是 P0–P5 引入的**。
    根因：<1024 时 `lg:grid-cols-2` 不生效，grid 只剩一条**隐式 auto 轨道**，轨道基尺寸取子项的
    内容最小尺寸；子项 2（缺口卡）内 `min-w-[420px]` 的表格在 `overflow-x-auto` 里，但
    「滚动容器的最小子尺寸」只在**该元素自身**作为 flex/grid 子项时才归零，作为普通块级后代时
    仍把 420px 传到卡（+padding/border = 454）→ 轨道 454 > 可用 343。
    浏览器内实验（两种修法都实测有效，未落盘）：`grid-template-columns: repeat(1, minmax(0,1fr))`
    （= Tailwind `grid-cols-1`）→ scrollWidth 470→**375**；两卡各加 `min-width:0` → 同样 **375**。
    建议：P6（/report 首迁页）顺手修，一行即可（`grid gap-5 lg:grid-cols-2` → 加 `grid-cols-1`）。
    本轮**未改** ReportPage.tsx：它是 P6 的涉及文件、且该页马上要整页重写视觉层（批次顺序红线）。
F-02【偏差未留痕，交裁决】Sheet 的内边距与规范 §4.2 矩阵不一致。
    规范：xl `48px` / lg `48px` / md `22px 18px` / sm `16px 12px`；
    实现（Sheet.tsx）：`annos:px-12`(48) / `sheet:px-6`(24) / `px-4`(16)、`pt-6`/`pb-4`。
    即 lg 档 24 vs 48、md 档 24 vs 18、sm 档 16 vs 12（实测 375 档主内容左边 16px、768 档 24px）。
    PageContainer 的注释声称 `--pad-frame` 由 Sheet 单一承担，说明意图存在；P4 的变更说明留痕了
    4 条偏差（均与字号/颜色有关），**没有这条**。
    未动的理由：22px / 18px 不在现有 spacing 刻度里，补齐要用任意值或新增 spacing token —— 属
    设计体系决策（上一次同类情况 P4 也选择了「取最接近的令牌并留痕」），不宜由复核轮单方面决定。
F-03【原型细节的另一半】原型 L696 的 `#board[data-tier="sm"] h1{font-size:20px}` 是**全档 h1**，
    本轮只把 SheetHead 的页级 h1 对齐（迁移页的标题都走 SheetHead）；未迁移页（如各页内 h2/h3、
    落地页 hero）的字号不在本轮范围，P6 起逐页对照。
F-04【构建告警，无功能影响】构建时出现 `warn - The content option in your Tailwind CSS
    configuration is missing or empty`。实测两者产出的 CSS **逐字节相同**（418537 B）、
    工具类各 1 份（`.grid{display:grid}` 恰 1 处），且以 apps/web 为 cwd 构建时该告警消失
    → 属 cwd 解析产生的噪声告警（工具人可后续把 postcss 的 config 路径显式化）。未处理。
F-05【未跑】下列项本轮未取得证据，如实标注：
    · 计划 6.2 的教师端 3 页走查（无教师演示账号；属 P11）；
    · 768 档浅色一套截图（P5 只要求 1440/1024/375 × 双主题，已满足）；
    · 原地 `vite build`（沙箱删除闸门，见 D-02）；
    · P6 起的 17 页迁移、T0 页 4 档走查、状态实验室（拍板③不迁移）——全部不在 R1 范围。


--------------------------------------------------------------
八、逐条对照「一、目标与验收清单」（本轮 R1 = P0–P5）
--------------------------------------------------------------
[✔] 2.【检查点①】tempui/STYLE-10-设计系统规范.md：12 章、零 React 代码、冲突留痕 12 处
[✔] 3.【检查点②】tempui/STYLE-10-组件库草案.md：目录结构 + 组件清单 + API 草案三节齐备
[✔] 4.【检查点③】三门禁（tokens 21 / bands 12 / breakpoints 9）+ themeStore 9 全绿；
        npm test 451 条全绿；tsc 三段 exit 0；build（等价命令）通过
[✔] 5. 双主题 token 体系落地：--p-*/--c-* 全量换值、四档色值三处同源（bands.ts +
        tailwind.config.js + bands.test.ts 全绿即证）、档名/阈值不变
[✔] 6. 主题默认「跟随系统、优先白图」：resolveInitialTheme 与 index.html 首帧脚本逐条对齐，
        键沿用 zhiwei_theme
[✔] 7. 字体自托管：三族走 @fontsource（main.tsx 10 处引用），全仓无 CDN 命中
[✔] 8.【检查点④】新制图板外壳一次切换 + ChatPanel 三形态（量化取证）+ 底部 5 项 tabbar +
        「全部图纸」抽屉；chatPanel/mobileNav store 零改动（3.2 复核空输出）
[✔] 10. 一行不动红线：3.2 两命令空输出；更强的 df133d6→HEAD 对照同样只有 theme.ts
[—] 1./9./11.（17 页全量迁移、逐页单提交与截图、状态实验室不迁移）不在本轮范围（P6 起）
     —— 其中「状态实验室不迁移」在本轮无适用面（P0–P5 未涉及该实验室）


--------------------------------------------------------------
九、本轮结束时的工作区状态
--------------------------------------------------------------
HEAD = 404e7bb（+ 本报告提交）；rev-list --count = 184 → 185（含报告提交）
git status（非本轮产物）：仍是他人未提交变更，原样未动：
  M _pipeline/01_PLAN.md、D tempui/纯前端需求文档.md、
  ?? tempui/{迁移分析,迁移计划,prototypes,qa-report.json}、?? _pipeline/PR-tempdeploy.md、
  ?? .workbuddy/、?? node_modules/、?? package-lock.json、?? _pipeline/archive/01_PLAN_20261010_2109.md
归档：旧版报告已是**逐字节副本**（md5 2ebe2d6fc6cbca3f349e3110fb00cbc0，
      _pipeline/02_EXEC_REPORT.md 与 _pipeline/archive/02_EXEC_REPORT_20261010_2116.md 两侧一致），
      故未重复归档；按 AGENT §7「归档文件入库」把该归档副本随本报告一并提交。
临时产物：/tmp 下的诊断脚本（zhiwei-diag.cjs / zhiwei-tab.cjs / zhiwei-panel.cjs / ra-lib.cjs）
      与截图**未入库**（属一次性取证工具，非仓库产物）；走查起的两条本地服务在报告落盘后停止。

（完）
