知微 · 赛前修整轮返工（轮 1 审查 FAIL 后）执行报告
====================================================================================
执行角色：implementer（返工轮：修 reviewer 在 _pipeline/03_REVIEW.md「六、问题清单」列出的 H1 + L1/L2/L3/L4）
执行日期：2026-09-24 17:18–17:23
工作区：/Users/Merryou/LearnBuddy/zhiwei（分支 tempdeploy，不切分支、不 rebase）
基线：f31643e（轮 1 起点）→ 轮 1 末 714f690（审查对象）→ 本报告落盘时 HEAD 94c96aa
依据：用户（项目方）本次返工指令 > _pipeline/03_REVIEW.md 问题清单 > _pipeline/01_PLAN.md 第 4 版 > AGENT.md §6 红线
环境：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
      $WS=/Users/Merryou/.workbuddy/binaries/node/workspace

--------------------------------------------------------------------------------
零、结论速览
--------------------------------------------------------------------------------
- H1（唯一功能缺陷）：已修，且「任何输入长度下提交都不会因长度被 400」经**真实 HTTP 实验**证明（见四）。
- L1 / L2 / L3：已清（L1 只改 describe 标题这一行字符串，断言零改动）。
- L4：裁决为「需要最小化改动」——列表为空时提交前补拉一次再预检；残留的「列表非空但过期」仍走 409 兜底，
  已在代码注释写明前提（见五）。
- 全部验证命令亲自跑过并全绿：4 条 vitest 分批 + 3 段 tsc（见三）。
- 未完成项：无（本轮用户指令列出的 4 项问题全部落地）。M1（浏览器走查）属 reviewer 给轮 2 的建议、不在本次指令范围。

--------------------------------------------------------------------------------
一、实际做了什么（按问题编号）
--------------------------------------------------------------------------------
H1 空间名长度上限不一致（前端 40 / 服务端 30）
  1) apps/web/src/lib/stages.ts
     - 新增导出 `SPACE_NAME_MAX = 30`，注释写明「与后端 functions/api/src/services/space.ts 的
       MAX_SPACE_NAME_LENGTH 同值同源（契约 §2 v1.2「1–30 字」），改一处必须同步另一处」，
       并点明 H1 的两种必 400 路径（31–40 字直输、30 字重名自动后缀拼成 32 字）。
     - 重写 `suggestSpaceName(base, taken)`：
       · 先 `base.trim()`（后端校验与入库都用 trim 后的名字；不 trim 会出现「返回带尾随空格的名字、被
         后端 trim 后撞上已有空间名」的假预检）、再 `slice(0, SPACE_NAME_MAX)`；
       · base 为空/纯空白 → 退回 `学习空间`（与后端 create 的 `?? '学习空间'` 兜底一致，绝不返回空串，
         否则服务端 400「name 不能为空白」）；
       · 追加序号时**先给后缀预留字符**：`head = safeBase.slice(0, SPACE_NAME_MAX - suffix.length)`，
         故 30 字原名已占用时得到「前 28 字 + ' 2'」= 恰好 30 字；连号 →「前 28 字 + ' 3'」…
       · 返回值长度恒 ≤ 30（有全长度扫描测试锁死）；截断后仍保留 base 的可辨识前缀，不退化成空串或纯序号；
       · 序号循环加了 999 上界，保证必然终止（该分支实际不可达，已在注释说明此时退回截断名、冲突交 409 兜底）。
  2) apps/web/src/components/SpaceCreateForm.tsx
     - `maxLength={40}` → `maxLength={SPACE_NAME_MAX}`（单一来源，前端不再有自己的魔数）。
     - 表单提示文案补「（最多 30 字）」——reviewer 指出用户撞 400 时表单里没有任何字数提示。
     - L4：`taken` 的组装改为「store.spaces 为空时先 `await listSpaces()` 补拉一次」，只用于本次预检、
       不写 store（不干扰 activeSpace）；补拉失败则退回本地列表，不阻断提交。
     - 文件头补两段说明：长度口径（H1）+ 本地预检的前提与残留风险（L4）。
  3) apps/web/tests/stages.test.ts：6 → 14 例（新增 8 例，明细见三）。

L1 functions/api/tests/closedLoop.test.ts:174
  `describe('closedLoop · 19 接口全链路（真实 HTTP）')` → `... 20 接口 ...`。
  只改这一处字符串；`git diff` 实测 1 file / 1 insertion / 1 deletion。
  同文件的 `#19 报告`（第 400 行，是接口编号本身）与第 519 行注释「路由表计数 19 → 20」语义本来就对，未动。
  断言零改动，跑完 functions/api/tests 仍 143 全绿。

L2 apps/web/src/index.css:19-20
  过期注释「当前默认深色：index.html 的 <html class="dusk"> 常驻挂载。浅色只作为 :root 的基线保留，
  供将来做主题切换。」改写为现状：默认深色、可切浅色；根元素不再常驻 dusk，改由 index.html head 区
  内联同步脚本按 localStorage 的 zhiwei_theme 裁决（读不到/抛异常 → 深色，首帧不闪）；运行期切换由
  src/stores/theme.ts 改写同一处 class 与 theme-color；:root 浅色基线 + html.dusk 深色覆盖并存。
  新注释**不含尖括号标签名**（D14 坑：Vite 按 head 标签注入会误命中注释）。
  说明：本文件原有第 23 行的 `<alpha-value>` 属轮 1 之前就存在的 CSS 注释，与本问题无关，未动（不扩大范围）。

L3 LOOKATME.md
  · 提交数：`68` → 实测口径。实测 `git rev-list --count HEAD`：轮 1 末 714f690 = 71 次；本轮返工 +3 = 74 次
    （写完时 HEAD 94c96aa = 73，本报告 commit 落盘后为 74）；`--no-merges` = 70 次。文中已标注口径命令。
  · 「4 项用户反馈中的 3 项」→「3 项用户反馈 + 1 项仓库卫生（属计划 D5、非用户反馈）」，
    并把第 5 条（对话链路）与 4 项的界线说清；表格行同步改写。
  · 顺带把本轮会变动的测试数字一并按实跑改正：292 → 300（26 文件；引擎 43 + 后端 143 + 前端 106→114）。
  · 「本轮逐项落点」补第 4 条（仓库卫生）与 H1 返工说明（否则该节只有 3 条，与「4 项」口径仍不自洽）。

L4 SpaceCreateForm 本地重名预检依赖 store.spaces 新鲜度 —— 裁决「改，最小化」：
  详见五、裁决记录 D18。

--------------------------------------------------------------------------------
二、改了哪些文件及关键位置
--------------------------------------------------------------------------------
commit 58de0eb（H1 代码 + 测试）：
  apps/web/src/lib/stages.ts                    新增 SPACE_NAME_MAX / FALLBACK_SPACE_NAME /
                                                MAX_SUFFIX_INDEX；重写 suggestSpaceName（第 34–72 行区段）
  apps/web/src/components/SpaceCreateForm.tsx   头注释（长度 + L4 前提）；import 加 SPACE_NAME_MAX；
                                                handleSubmit 的 taken 补拉；maxLength；
                                                提示文案（第 62–82、147、165 行附近）
  apps/web/tests/stages.test.ts                 新增 describe「空间名长度上限（H1）」，8 例

commit 94c96aa（四条文档瑕疵 L1/L2/L3）：
  functions/api/tests/closedLoop.test.ts:174    describe 标题 19 → 20（仅此一行）
  apps/web/src/index.css:19-22                  主题注释改写为现状（无尖括号标签名）
  LOOKATME.md:9 / 30-34 / 46 / 50 / 58-66 / 108 提交数与口径、「3 项反馈 + 1 项仓库卫生」表述、
                                                测试数 292 → 300、逐项落点补仓库卫生与 H1 返工

本报告 commit（本文件 + 归档）：
  _pipeline/02_EXEC_REPORT.md                   覆写为本轮报告
  _pipeline/archive/02_EXEC_REPORT_20260924_1722.md   轮 1 执行报告原件归档（只增不删），
                                                md5 = dc7d0017fc337629f1b0c21e45916738，与覆写前文件一致

未改（明确不动）：packages/engine/**、data/**、config/params.json、scripts/**、PRD/ALGORITHM/DATA_SCHEMA/
  参赛方案 v4、API_CONTRACT.md（契约已定稿，服务端上限 30 这个数字未动，改的是前端对齐）、
  functions/api/**（本轮零后端改动）、tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、知微-项目介绍.md
  （后三项是他人未提交变更，未 add、未提交、未回退）。

--------------------------------------------------------------------------------
三、运行的测试命令与逐条结果（全部亲自实跑）
--------------------------------------------------------------------------------
[1] $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/stages.test.ts
    → Test Files 1 passed (1) / Tests 14 passed (14)   （改前 6 例 → 新增 8 例）
[2] $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
    → Test Files 11 passed (11) / Tests 114 passed (114)   （改前 106 → +8，符合「比 106 多出新增用例数」）
[3] $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
    → Test Files 13 passed (13) / Tests 143 passed (143)   （与 L1 前一致 ⇒ L1 只改标题、没伤断言）
[4] $NODE $WS/node_modules/vitest/vitest.mjs run packages
    → Test Files 2 passed (2) / Tests 43 passed (43)       （引擎未受影响）
    合计 43 + 143 + 114 = 300 用例 / 26 文件
[5] tsc --noEmit -p apps/web/tsconfig.json          → exit 0
[6] tsc --noEmit -p functions/api/tsconfig.json     → exit 0
[7] tsc --noEmit -p packages/engine/tsconfig.json   → exit 0（附跑，确认无跨包影响）

新增 8 个用例（stages.test.ts）逐条：
  1. SPACE_NAME_MAX 与后端 MAX_SPACE_NAME_LENGTH 同值（**读 functions/api/src/services/space.ts 源文件**
     正则取字面量，防两处漂移）+ 断言等于 30（契约口径）
  2. base 恰 30 字且未占用 → 原样返回、长度 = 30
  3. base 恰 30 字且已占用 → 长度 ≤ 30、不与 taken 冲突、以 base 的可辨识前缀开头（断言 head 恰为
     base 前 28 字、以 ' 2' 结尾，排除「退化成空串或纯序号」）
  4. base 恰 30 字且连号占用 → 依次拿到 2、3，长度都 ≤ 30
  5. base 超长（40 字）→ 返回值 ≤ 30，且等于 base 前 30 字（不把超长名原样发服务端）
  6. base 自带首尾空格 → 先 trim 再判重（`'初中数学  '` + taken ['初中数学'] → '初中数学 2'）
  7. base 为空 / 纯空白 → 退回「学习空间」（不返回空串）
  8. 性质扫描：base 长度 0–60 × 5 种占用情形 → 结果恒非空、恒 ≤ 30、恒不与 taken 冲突

--------------------------------------------------------------------------------
四、H1 的「不会因长度被 400」如何证明（不靠结论，靠实验）
--------------------------------------------------------------------------------
新用例本身不是空断言：用旧实现复算，`suggestSpaceName(base30, [base30])` 返回 32 字、
`(base40, [])` 返回 40 字——两条都违反新用例的「≤ 30」断言，即旧代码下这些用例必红。

更强的一条：**真实 HTTP 端到端实验**（独立进程起真实服务端，非单测桩）
  · 数据隔离：ZHIWEI_ROOT=/tmp/zw_root（knowledge/item_bank/config 软链到仓库，local_db 在临时根内新建），
    仓库 data/local_db 的 mtime 实测未变（仍 15:52），无污染；
  · 服务端形态：因 functions/api/dist/server.js 是轮 1 之前的旧 bundle（grep 无「同名空间已存在」），
    先用 esbuild 按当前源码重建 dist，实验后已用备份按 md5 还原（aa6418b08a233077fd29e5de32cb2176 一致）；
  · 被测函数：**真实 lib/stages.ts**（`node --experimental-strip-types` 直接 import 源文件，非手写复刻）；
  · 结果：
      旧路径 40 字直输              → 提交 40 字 → HTTP 400（复现 H1 路径 1）
      旧路径 base30 + ' 2'（32 字）  → 提交 32 字 → HTTP 400（复现 H1 路径 2）
      suggestSpaceName(base30, 0 占用) → 提交 30 字 → HTTP 200
      suggestSpaceName(base30, 1 占用) → 提交 30 字 → HTTP 200
      suggestSpaceName(base30, 2 占用) → 提交 30 字 → HTTP 200
      **全长度扫描：base 长度 0–45 各提交一次（46 次），因长度被 400 的次数 = 0**，
     累计占用名 49 个，最长 30 字。
  · 结论链：suggestSpaceName 返回值恒 ≤ 30（性质扫描测试锁死）∧ 服务端对 ≤ 30 字一律接受
    （space.test.ts (f) 恰 30 字 → 200；(d) 32 字 → 400）⇒ 表单提交的名字不可能因长度被 400。
    SpaceCreateForm 的 maxLength 与预检都走同一常量，故输入框也不让用户打出 31+ 字。
  · 清理：kill 服务端并 `pgrep -fl dist/server.js` 确认无残留；dist 已还原；实验脚本在 /tmp（不入库）。

--------------------------------------------------------------------------------
五、裁决记录（续轮 1 的 D1–D16，按计划「十一、」要求继续编号）
--------------------------------------------------------------------------------
D17 长度常量的「单一来源」落在 lib/stages.ts（用户建议方案的落地）
  采用 `export const SPACE_NAME_MAX = 30` + 注释「与后端 MAX_SPACE_NAME_LENGTH 同值同源」，
  并**加了一条读后端源文件核对的测试**——比只写注释更强：两处一旦漂移，测试直接红。
  未采用「前端从后端 import」：functions/api 与 apps/web 是两个 tsconfig / 两个构建目标，
  跨包 import 会把服务端代码拉进浏览器 bundle，得不偿失（与 D6「静态副本 + 一致性测试」同一手法）。
  服务端 30 这个数字**未改**（契约已定稿 1–30 字，且不是本轮授权范围）。
D18 L4 裁决：**接受「并发/过期」的 409 降级，但消除「列表为空」这一可自解路径**（= 最小化改动）
  理由：列表为空是**非并发**场景（刚登录 / 顶栏懒加载未回），用户完全可自解，且会让「一键新建必成功」
  在该窗口静默退化为「切到已有空间」，与「想建第二个空间」的意图相悖 → 值得修，成本 6 行。
  残留：store.spaces 非空但过期（多端并发新建）仍可能 409 → 走既有 ConfirmDialog「切换过去」。
  该残留**接受**，依据：单实例 JSON 存储无并发锁是项目已知限制（LOOKATME「限制」节），
  409 有明确反馈、非静默，与计划 R4「服务端 409 仅作并发兜底」一致；已在 SpaceCreateForm 头注释写明该前提。
  未采用 reviewer 的备选方案「409 且用户输入为空时自动改用 base 2 重试一次」：会让「切到已有 vs 再建一个」
  的语义变模糊（用户看到的名字与他预期不符），且与契约 §2「409 默认按钮仍是切换过去」的既定交互冲突。
D19 suggestSpaceName 额外加了 trim 与空 base 兜底（reviewer 未明确要求，属边界正确性）
  用户指令要求「base 自带尾随空格等边界都要正确」。若不 trim：返回 '初中数学 '（带空格）会被后端 trim 成
  '初中数学' → 可能正好撞上已有空间名 → 本地预检失效、仍吃 409。空 base 若不兜底会返回空串 → 服务端 400
  「name 不能为空白」。两处都按「与后端行为对齐」处理并写了测试，未改变非空 base 的既有行为（原 4 例全绿）。
D20 表单提示文案补「（最多 30 字）」
  依据 reviewer H1 的定级说明「表单无任何 30 字提示」。属 H1 的下游一致性，同批改动，未新增组件或令牌。
D21 归档口径：覆写 _pipeline/02_EXEC_REPORT.md 前先把轮 1 报告归档
  实测 _pipeline/archive/ 里只有迭代 3 版（02_EXEC_REPORT_20260924_1708.md 内容是「迭代 3」版），
  轮 1 报告并未归档 → 直接覆写会毁掉审查依据，违反 AGENT §2「archive 只增不删」。
  故按 reviewer 处理 03_REVIEW 的同款纪律（先归档再覆写）生成 02_EXEC_REPORT_20260924_1722.md。
  与用户「只修改计划列出的文件」的关系：_pipeline/ 产物不是业务文件，且这是纪律要求，已在九、留痕。

--------------------------------------------------------------------------------
六、失败详情与修复尝试
--------------------------------------------------------------------------------
本轮**没有出现测试失败**（含改前基线）。为可核对，记录两类「差点踩」的点：
  1) dist/server.js 陈旧：首次实验前 grep 发现 bundle 里没有 v1.2 的「同名空间已存在」，
     说明它是轮 1 之前的构建。若直接用它跑 HTTP 实验，测的是 v1.1 服务端（name 会被忽略），
     实验结论会误导。处置：用 esbuild 按当前源码重建、实验后按 md5 还原（见四）。
  2) LOOKATME 的提交数是「会随本轮提交变化」的量：先按实测算出 714f690 = 71，本轮 3 个提交 → 74，
     并在文中标注口径命令与参考点，避免再次出现「68 与任何口径都不吻合」的问题。
未隐藏任何失败；无未修复的红项。

--------------------------------------------------------------------------------
七、未完成项
--------------------------------------------------------------------------------
- 无（用户指令列出的 H1 与 L1–L4 全部落地）。
- 明确不在本轮范围、故未做（避免擅自扩大范围，仅登记）：
  a) M1 浏览器走查（reviewer 给轮 2 的建议：720/375 两档顶栏、浅色下 ZhiweiLogo 对比度、/me 真实渲染）；
  b) MePage 组件级渲染测试（reviewer 8.2b 缺口）；
  c) LOOKATME.md:71 仍写「_pipeline/03_REVIEW.md 现为迭代 3 版」——轮 1 审查已覆写该文件，此句同样过期，
     但不在用户点名的 L1–L3 范围内，未擅自改动，特此留痕供总控裁决；
  d) _pipeline/archive/03_REVIEW_20260924_1711.md 仍是未跟踪文件（reviewer 的 INFO 项，请总控随轮入库）；
  e) _pipeline/03_REVIEW.md 在本轮开工前就是「已修改未提交」（reviewer 的产物），非我改动，未 add。

--------------------------------------------------------------------------------
八、与计划的偏差和原因
--------------------------------------------------------------------------------
本轮是「审查返工」，_pipeline/01_PLAN.md（第 4 版）里没有对应条目，故按用户本次返工指令执行；
所有偏离都在上面 D17–D21 留痕。与计划文本直接相关的 3 处说明：
  1) 计划「八、测试影响总表」写 closedLoop「不受影响」——轮 1 已按 D11 改为 19→20，本轮 L1 只补 describe
     标题（该表的口径问题在轮 1 已发生，本轮不改计划文件）。
  2) 计划 D1d「保证『一键新建必成功』」——H1 正是该保证被长度上限打破；本轮修法与该承诺同向，
     并把「本地预检残留风险」的边界写进代码注释（D18），避免再次出现「注释承诺 > 实际保证」。
  3) 计划「十、总验收」第 4 项 env 核查、第 5 项浏览器走查本轮未跑：env 规则本轮未动（且已由轮 1 审查复跑通过）；
     走查属 M1、留给轮 2（用户本轮指令未要求）。
另外，本轮比用户建议的「2 条 commit」多 1 条：报告与归档单独成条（AGENT §7「代码修复 / 文档产物 / 测试各成条目」、
「归档文件与 _pipeline 产物同样入库」）。用户原文是「建议」，故按其精神再分一层，不混提。

--------------------------------------------------------------------------------
九、本轮工作区与入库留痕
--------------------------------------------------------------------------------
commit 58de0eb  H1 修复：空间名长度上限前端与服务端对齐为 30（唯一来源 SPACE_NAME_MAX）
commit 94c96aa  文档瑕疵清偿：closedLoop 标题 19→20、index.css 主题注释对齐实现、LOOKATME 数字与表述按实测改正
commit <本报告>  执行报告 + 轮 1 报告归档
提交数实测：轮 1 末 714f690 = 71 次 → 本报告落盘后 `git rev-list --count HEAD` = 74 次（--no-merges = 70）。
他人未提交变更（tools/e2e-smoke.cjs、_pipeline/PR-tempdeploy.md、知微-项目介绍.md）与 reviewer 的
_pipeline/03_REVIEW.md、_pipeline/archive/03_REVIEW_20260924_1711.md 均未被本轮的 commit 包含。
