知微 · 赛前最终修整（轮 1）审查报告
================================================================================
审查角色：reviewer（只读审查；除本文件外未修改任何仓库文件）
审查日期：2026-09-24 17:16
审查范围：基线 f31643e → HEAD 714f690（分支 tempdeploy，12 个提交）
审查依据：需求（4 项用户反馈）> _pipeline/01_PLAN.md（第 4 版）> AGENT.md §6 红线
          > API_CONTRACT.md（冻结，v1.2）
环境：$NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
      $WS=/Users/Merryou/.workbuddy/binaries/node/workspace
      $PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
归档：本报告落盘前已先把旧的 03_REVIEW.md（迭代 3 版，16,699 B）复制归档为
      _pipeline/archive/03_REVIEW_20260924_1711.md（md5 双方一致 88da20fb42012151ee82455bc0a9cd0a，
      归档只增不删；该归档文件目前未提交，需总控入库）。

--------------------------------------------------------------------------------
结论
--------------------------------------------------------------------------------
VERDICT: FAIL

失败原因：不是红线问题，也不是测试被改弱——这两项我逐条复核后全部通过。FAIL 来自两处：
  H1（高）本轮核心交付「一键新建空间必成功」存在**可复现的输入路径必然失败**且无测试覆盖：
     前端名字上限 40 字 ≠ 服务端上限 30 字，且本地自动后缀不校验长度。
  M1（中）计划「十、总验收」第 5 条**浏览器走查未执行**，而该走查正是本轮唯一覆盖
     「浅色对比度」与「窄屏顶栏密度」两项新增回归风险的手段；本轮又恰好把顶栏密度推高了
     （主导航 5→6 项 + 新增 ThemeToggle），风险面被动扩大。
  L1–L4（低/文档）见「六、问题清单」。

关键提示：总控列出的 5 条「已亲验结论」我全部独立复跑并**全部成立**（见「九、可执行证据」）。
若只看这 5 条，本轮应判 PASS；FAIL 完全来自上述 5 条之外的新发现。

--------------------------------------------------------------------------------
一、输入完备性与范围核对
--------------------------------------------------------------------------------
1.1 必需输入存在且可读：
    _pipeline/01_PLAN.md        39,794 B  ✔
    _pipeline/02_EXEC_REPORT.md 23,992 B  ✔
    AGENT.md / API_CONTRACT.md  存在可读   ✔
1.2 改动文件清单（git diff --name-status f31643e..HEAD，30 文件）：
    源码/配置/文档 22 项 + pipeline 产物 8 项（01_PLAN、02_EXEC_REPORT、两份 archive、LOOKATME 等）。
1.3 越界检查（计划「一、1.3 明确排除」逐项比对，全部遵守）：
    git diff --name-only f31643e..HEAD -- apps/web/src/theme packages config data scripts packages
    → 输出为空 ⇒ packages/engine、data/**、config/params.json、scripts/**、theme/bands.ts 零改动 ✔
    PRD.md / ALGORITHM.md / DATA_SCHEMA.md / 参赛方案 v4 未出现在改动清单 ⇒ 未改 ✔
    functions/api/src/serialization.ts、apps/web/src/api/sse.ts 未改 ✔（红线：白名单 / SSE 降级不受影响）
    tools/e2e-smoke.cjs（他人已修改）、_pipeline/PR-tempdeploy.md、知微-项目介绍.md 未被任何 commit 包含 ✔
    结论：没有改计划范围外的文件，没有缩小范围，没有混提他人未提交变更。

--------------------------------------------------------------------------------
二、红线核查（AGENT.md §6 逐条，含 profile.ts 泄露面专项）
--------------------------------------------------------------------------------
2.1 answer / solution_steps 绝不下发：
    本轮新增/改动的后端仅 router.ts（+1 路由）、services/profile.ts（新增）、services/space.ts（create）。
    profile.ts 返回体只有 user / spaces / model 三个显式构造的对象（profile.ts:47-54、70-74），
    与题对象序列化无交集；serialization.ts 零改动。✔ 未破坏。
2.2 算法参数零硬编码（只来自 config/params.json）：
    config/params.json 与 packages/engine 零改动；新增 profile.ts 只读 process.env.ZHIWEI_MODEL_MODE /
    ZHIWEI_LLM_MODEL（模型运行信息，非算法参数）；space.ts 新增的 MAX_SPACE_NAME_LENGTH=30 是
    输入校验常量（契约 §2 v1.2 明文「1–30 字」），不属于算法参数。✔
2.3 状态带取色唯一入口 theme/bands.ts：
    apps/web/src/theme/ 零改动；新增组件未引入任何新的取色来源：
    ThemeToggle.tsx 全走语义令牌（border-line / text-ink-soft / hover:bg-raised），
    SpaceCreateForm.tsx 用 border-accent / bg-accent-veil / text-accent / text-on-accent，
    MePage.tsx 用 bg-accent-veil / text-accent（模型徽标，非状态带语义）。
    裸 hex 扫描：grep -rnE "(bg|text|border|from|to|via|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]" apps/web/src
    → 仅命中 LoginPage.tsx:51 / :179（计划 D3e 明确保留的常驻深色登录页）与 TopNav.tsx:22（注释文字）。
    ✔ 未破坏。
2.4 前端引用引擎常量必须从源模块导入（非 barrel）：
    本轮 diff 中 apps/web 新增 import 无一指向 engine/@zhiwei；
    全仓唯一引擎引用仍是 theme/bands.ts:24-25 从 '../../../../packages/engine/src/statusBand' 源模块导入。✔
2.5 SSE 必须有 JSON 降级：api/sse.ts 未改，sse.test.ts 13 例绿（见九）。✔
2.6 profile.ts 专项：password_hash / ZHIWEI_LLM_API_KEY 泄露面
    · user 视图逐字段挑，不 spread 整记录（profile.ts:46-54）；
    · 机密词只出现在注释（profile.ts:8、10），代码路径只读 ZHIWEI_MODEL_MODE / ZHIWEI_LLM_MODEL
      （profile.ts:61-62），API_KEY 在任何分支都取不到；
    · 测试以全文断言锁死：profile.test.ts:81-83 `JSON.stringify(res)` 不含 'password_hash' / 'salt'；
    · 无 space_id 入参 ⇒ 无越权面；401 由 authedUser 覆盖（profile.test.ts:53-55 实测 401）。✔ 未泄露。

--------------------------------------------------------------------------------
三、测试是否被「改弱」而非「更新」（逐条判定）
--------------------------------------------------------------------------------
3.1 functions/api/tests/space.test.ts create 组 4 → 9（净增 5，总计 15 例）
    判定：**语义随契约变更同步，且是加强，不是放宽**。证据：
    · 原「已存在同学科空间 → 409」→「不传 name 且已有同名空间 → 409」：断言结构不变
      （仍 `expect(res.data).toEqual({ existing_space_id: user.space_id })`）。
    · 新增 (b) 用例断言「已有默认空间（初中数学）时，再传 name='我的错题本' 走 kb_math_cz → 200
      且 list 共 2 个空间、新空间 is_default=false」——这条正是 v1.2 的核心行为，原口径下必红，
      是**真正的能力增强**（space.test.ts:108-127）。
    · (c) 同名 409、(d) 空串/全空白/32 字/非字符串 400、(e) kb_math_gz 缺省名=高中数学、
      (f) 首尾 trim + 恰 30 字为合法边界（space.test.ts:161-179）。边界用例是新增的，未删任何断言。
    · list 2 例 / drive 4 例 / 401 例原样保留。
    · 唯一「语义反转」的是原「200 成功路径」里传了 `name: '客户端不该传这个'`，v1.2 起 name 合法可传，
      故该入参删除并拆为 (a)–(f)。这是契约变更的必然结果，非放宽。
3.2 apps/web/tests/routerGuard.test.ts 断言变更
    判定：**随契约/路由变更同步，非放宽**。11→12 页、编号数组补 12、navRoutes 5→6（补 '/me'）、
    PROTECTED toHaveLength 10→11（/me 确为 requiresAuth，计数必然 +1），
    并在既有「STORAGE_KEYS 键名一致」用例内补 theme 断言（与 index.html 内联脚本同源，属正当）。
    守卫分支用例（未登录/无活跃空间/未知路径）一个未动，未删断言。
3.3 functions/api/tests/closedLoop.test.ts 19→20（D11）
    判定：**必须更新，且更新正确**。该用例是「路由表与契约逐项一致」的守门测试，
    19→20 并把 'GET /api/user/profile' 追加进 toEqual 清单；新增后确有 20 条路由
    （router.ts:107-108 追加于末尾，顺序与清单末位一致）。未删除任何一行。
3.4 D11 / D15 与计划不符的说明是否属实：
    D11：计划「八、总表」第 4 条写 closedLoop「不受影响」——实测该文件含精确路由计数，
         新增 #20 必然红（执行报告三.2 记录 expected 19 but got 20）。属实。
    D15：计划 C2 写「其余守卫用例不动」——/me 为 requiresAuth:true，PROTECTED 必然 10→11。属实。
    两处偏离方向均为「把断言改成与现状一致」，不是「把断言改成能过」。
3.5 「更新而非删除」总纪律：本轮测试改动为 3 个文件（space.test.ts 改+增、routerGuard.test.ts 改、
    closedLoop.test.ts 改）+ 3 个新增文件（stages/themeStore/profile），无整文件或整 describe 删除。
    结论：**不存在测试被改弱**。

--------------------------------------------------------------------------------
四、用户反馈是否真的被解决（以代码为证据）
--------------------------------------------------------------------------------
4.1 反馈①-a「根本没有地方可以选学科」→ **已解决**
    SpaceCreateForm.tsx:92-119 渲染 `fieldset > legend「选一个学科」+ STAGES.map(radio)`，
    两个 option（初中数学 / 高中数学）来自 lib/stages.ts:21-24；/spaces 页在 SpacesPage.tsx:154-165
    以完整态嵌入（loading 结束后始终显示），顶栏弹层以 compact 态嵌入（TopNav.tsx:155-174）。
    后端同用户同学科可多开（space.ts:114-134 只在同名时 409），并有 (b) 用例锁定。✔
4.2 反馈①-b「顶栏『管理空间』点了没反应」→ **已解决（有可见反馈）**
    TopNav.tsx:166-174 在「管理空间」Link 上方新增「+ 新建空间」按钮，点击原地展开紧凑态表单
    （TopNav.tsx:155-165），成功后 setActive + 刷新列表 + toast + 收起弹层（SpaceCreateForm.tsx:59-67、
    TopNav.tsx:160-163）。原先「已在 /spaces 时点 Link 无反馈」的场景现在弹层内也有完整可操作入口。✔
4.3 反馈③「主题写死深色」→ **已解决**（判定规则逐字一致，已核对）
    index.html:48-49  `var t = localStorage.getItem('zhiwei_theme'); var d = t !== 'light';`
    stores/theme.ts:33-35 `resolveInitialTheme(stored) => stored === 'light' ? 'light' : 'dark'`
    ⇒ 两者等价（非 'light' 一律深色），键名 'zhiwei_theme' 与 STORAGE_KEYS.theme（router.tsx:28）一致，
    有断言（routerGuard.test.ts:98）。meta theme-color 跟随：内联脚本 index.html:51-52 写
    '#070C14'/'#F5F8F9'，store THEME_COLOR（theme.ts:24-27）同值，运行期由 applyToDom 改写
    （theme.ts:61-70）。异常分支一致：脚本 catch 挂 dusk=深色，store readStored 失败返回 null=深色。✔
    落地验证：dev 与 build 产物均为 `<html lang="zh-CN">`（无硬编码 dusk），内联脚本位于
    theme-color meta 之后、样式块之前（见九）。
4.4 反馈②「没有『我的』页」→ **已解决（内容齐全）**
    MePage.tsx 五区块齐备：账号四行（109-112，昵称为空显示「未设置」）、当前学习空间 + 去管理
    （122-145）、主题 ThemeToggle（153）、对话模型只读徽标 + 固定文案「对话模型由服务端配置，
    不可在此自定义。」（158-169）、退出登录（172-182）。退出走 ConfirmDialog →
    clearAuth + clearSpace → navigate('/login')（MePage.tsx:83-89），守卫读落盘，顺序正确。
    路由 /me（router.tsx:63，page:12，requiresAuth:true，nav:true）+ App.tsx PAGE_COMPONENTS 已注册，
    navRoutes 6 项且有测试。✔
4.5 反馈④（模型配置只能由服务端提供）→ 未新增任何前端自定义入口（MePage 只展示 mode/name），
    profile.ts 也不下发 API_KEY。✔
4.6 但「提交是否一定能成功」**不成立** —— 见问题 H1。

--------------------------------------------------------------------------------
五、回归风险核查
--------------------------------------------------------------------------------
5.1 浅色主题残留硬编码颜色：全仓裸 hex 类名仅剩 LoginPage.tsx（计划 D3e 明确保留常驻深色）。
    另需实评三处（本次以静态方式评估，未做浏览器实测）：
    · Toast error 档（components/Toast.tsx:17）`border-tone-error bg-tone-error/12 text-ink`：
      tone-error=#C96A3A（tailwind.config.js:56），浅底上面纱 12% 极淡，正文仍是 text-ink
      #22303A 对白表面 ≈13:1，边框 3.5:1（非文本，可接受）。低风险，且此改动是**本轮之前**就有的。
    · ZhiweiLogo 渐变 #5FA8FF/#67E8F9/#7CF7B0（ZhiweiLogo.tsx:34-36）在浅色顶栏（白底）上
      #7CF7B0 对 #FFFFFF 约 1.2:1 —— 近乎不可见。属装饰图形非文本，不构成 AGENT §6 红线违反，
      但计划 D3f-3 把它明列为「B 批走查观察项，实测对比度异常再议」，而走查未做 ⇒ **观察项悬空**，
      计入 M1。注意 logoGeometry.test.ts（17 例）锁定了几何，未锁对比度。
    · SpacesPage 的 bg-band-mastered/10 为基线既有，非本轮引入。
5.2 窄屏（≤720px）顶栏密度：**未能实测（无浏览器），静态估算为中等风险**
    顶栏现有：品牌 + 6 个主导航项（测评/对话辅导/知识图谱/学习报告/云盘/我的）
    + ThemeToggle(36px) + 空间胶囊；本轮净增约 54px（「我的」）+ 40px（ThemeToggle，含 gap）。
    按 14px 全角字符与各类内边距估算，内容固有宽度约 640–660px（不含 px-6 的 48px），
    而现有媒体查询只在 max-[720px] 隐藏竖分隔线（TopNav.tsx:81）与空间名（:123）。
    即视口宽于 ~660px 尚可，窄于该值主导航文字将换行（NavLink 无 nowrap）或横向溢出，
    顶栏高度会跳变。**这是估算值而非实测值**，据此列入 M1 要求轮 2 前实测（640/720px 两档截断）。
5.3 stores/space.ts 回落逻辑与调用顺序：
    setSpaces（space.ts:48-54）= 保留仍在列表中的 activeSpaceId，否则回落 pickDefaultSpace。
    全仓 setSpaces/setActive 调用点（grep 结果）：
      SpaceCreateForm.tsx:62 setActive(新id) → :63 refresh() → :48 setSpaces(新列表)  ← 顺序正确
      SpaceCreateForm.tsx:158（409 切到已有空间后 refresh）
      TopNav.tsx:54（仅首次拉列表）、TopNav.tsx:138（切换空间）
      LoginPage.tsx:88（登录后写列表）、SpacesPage.tsx:52（页面加载）
    结论：本轮新增的唯一「建后即用」路径（SpaceCreateForm）遵守「先 setActive 再 setSpaces」，
    其余调用点不涉及新建，无顺序陷阱。✔（与执行报告七的结论一致，且为其提供了调用点证据）
5.4 其它回归面：/console 路由可达性未被本轮削弱 —— 原 SpacesPage 虽然 import 了 CONSOLE_PATH
    但全文未使用（git show f31643e:apps/web/src/pages/SpacesPage.tsx | grep -n CONSOLE_PATH
    仅命中第 20 行 import），本轮的删除是清理未使用导入，不是移除入口（/console 在改动前后
    都只靠手输 hash 可达，属基线既有状态，不计入本轮）。

--------------------------------------------------------------------------------
六、问题清单（按严重程度从高到低；只建议，不直接改）
--------------------------------------------------------------------------------
【H1 · 高 · 功能缺陷 + 测试缺口】前端空间名上限 40 与服务端 30 不一致，且自动后缀不校验长度
  位置：apps/web/src/components/SpaceCreateForm.tsx:129（maxLength={40}）
        apps/web/src/components/SpaceCreateForm.tsx:56-57（base/name 组装，无长度校验）
        apps/web/src/lib/stages.ts:39-44（suggestSpaceName 直接返回 `${base} ${index}`，无长度上限）
        functions/api/src/services/space.ts:79,108-110（服务端 MAX_SPACE_NAME_LENGTH=30，超限 400）
  现象（两条可复现路径，均由代码与既有测试共同证明）：
    (1) 用户输入 31–40 字自定义名 → 服务端必 400。证据：space.test.ts:(d) 断言
        `name:'一'.repeat(32)` 返回 400（space.test.ts:139-141），而前端 maxLength=40 允许输入 32 字。
    (2) 用户已有 30 字空间，再输入同名 30 字 → suggestSpaceName 返回 `${base} 2` = 32 字 → 同样 400。
        此时报错文案「name 至多 30 字」与用户实输 30 字相互矛盾。
  影响：直接违背本轮唯一目的所依赖的行为承诺（计划 D1d「保证『一键新建必成功』」）与
        契约 §2 v1.2「name 可选，1–30 字」；用户会在新建流程里撞到一个无法自解的报错
        （表单无任何 30 字提示，placeholder 只说「不填就用学科名」，提示语只说「名字不重复就行」）。
        注意定级依据：失败有 toast 反馈、非静默，且不触发原投诉的「永远无法创建」黑洞，
        故不是红线级；但它是本轮新引入的、在核心流程上的确定性缺陷，且**无任何测试覆盖**
        （stages.test.ts 4 例只覆盖不重名/加 2/连号/空数组，未覆盖 base 达 30 字的情形）。
  建议改法（择一，推荐 1+3+4）：
    1) 前端 maxLength 改 30（或改为与服务端同源的常量并从单一来源导入），并加提交前长度校验；
    2) suggestSpaceName 增加可选 maxLength 参数，超限时截断 base 后再加后缀（保证结果 ≤30）；
    3) 当后缀仍无法在 30 字内表达时，回退为截断后的名字 + 提示用户改名，而不是发出必然 400 的请求；
    4) 补测试：stages.test.ts 增「base=30 字且重名 → 结果长度 ≤30」；前端增「超长输入被拦在本地」。
【M1 · 中 · 计划验收项未执行 + 风险面被动扩大】浏览器走查（计划十、第 5 条）未做
  位置：_pipeline/02_EXEC_REPORT.md 六.1（自述未验证）；01_PLAN.md 335 行、489-490 行（验收第 5 条）
  事实：执行报告已如实声明「因 60 秒杀进程 + 后台任务同样被杀，无法跨调用做交互式走查」，
        并给出替代验证（落地 HTML 断言、themeStore 单测、#20 真实 HTTP 端到端）——声明是诚实的，
        替代验证也确实覆盖了「功能是否通电」，但没有覆盖「看起来对不对」。
  未验证且风险中等以上的具体项：
    a) 窄屏 ≤720px 顶栏溢出/换行（见 5.2，估算阈值 ~660px；本轮刚把主导航加到 6 项）；
    b) 浅色主题下 ZhiweiLogo 渐变对比度（计划 D3f-3 自列的观察项，浅底约 1.2:1，可能「看不见」）；
    c) /me 五区块真实渲染布局（无组件级渲染测试，只有 tsc + 接口测试）。
  影响：这三项都是「功能已通过、观感可能不达标」的性质，不影响红线与数据正确性，
        但赛事现场演示（评委看界面）会被直接看到。
  建议：轮 2 开工前用真实浏览器（agent-browser 或本机）在 1440/1024/720/375 四档宽度下截断
        顶栏与 /me、并在浅色主题下截图核对 logo 与状态带；若不达标，按 D3f 的处理方式改令牌
        （禁止在组件里写裸 hex 兜底）。本报告不将「未做走查」本身判为阻塞，仅要求补齐后再判 PASS。
【L1 · 低 · 文档一致性】closedLoop.test.ts describe 标题未同步
  位置：functions/api/tests/closedLoop.test.ts:174 `describe('closedLoop · 19 接口全链路（真实 HTTP）')`
  现象：同文件用例名已改为「E1 路由闭合：20 个接口全部挂载（契约 v1.2：#1–#20 逐项核对）」，
        但 describe 仍写 19；执行报告 D11 称「用例名与注释同步为 v1.2/#1–#20」，与实物不符。
  影响：评审材料自相矛盾（仅文案）。建议：describe 同步为 20，或改为不含计数的描述。
【L2 · 低 · 注释过期】index.css 主题注释与实现矛盾
  位置：apps/web/src/index.css:19-20
        「当前默认深色：index.html 的 <html class="dusk"> 常驻挂载。浅色只作为 :root 的基线保留，
          供将来做主题切换。」
  现象：本轮 D3 之后 dusk 已不再常驻，浅色也已真正可切；注释是主题改动的直接下游，未同步。
  影响：后续维护者会按注释误判机制（仅注释）。建议：改为「由 index.html head 内联脚本 / theme store
        按 zhiwei_theme 裁决」。
【L3 · 低 · 数字/表述不实】LOOKATME.md 两处
  位置：LOOKATME.md:9「累计 68 次提交」；LOOKATME.md:31「已交付 4 项用户反馈中的 3 项」下并列 4 条
  现象：实测 `git rev-list --count HEAD`=71、`--no-merges`=67、该文件提交点 e6d0b4f `--no-merges`=66，
        68 与任一常见口径都不吻合；且「3 项」后面列了 ①②③④（第 ④ 仓库卫生并非用户反馈，属计划 D5）。
  影响：本轮 D 批的自我定位就是「数字以实跑为准」，此处反例（仅文档）。建议：改成
        「累计 71 次提交（`git rev-list --count HEAD`）」并把条目改写为「3 项反馈 + 1 项仓库卫生」。
【L4 · 低 · 边界降级】本地预检依赖 store.spaces 的新鲜度，未新鲜时「必成功」降级为 409 弹窗
  位置：SpaceCreateForm.tsx:57 `taken = spaces.map(...)`；TopNav.tsx:48-62（列表懒加载，
        为空时才拉一次）
  现象：若用户刚登录/列表尚未返回就在顶栏弹层点「+ 新建空间」并提交，taken 为空数组 →
        name 取学科名「初中数学」→ 与注册时自动建的默认空间同名 → 服务端 409 →
        走 ConfirmDialog「切换过去」（有反馈，非静默，与计划 R4 的并发兜底一致）。
  影响：声称的「一键新建必成功」在该竞态下不成立，用户被引导到「切换过去」而非建成新空间，
        与「想建第二个空间」的意图相悖。建议：提交前若 spaces 为空则先 `await listSpaces()` 再预检；
        或在收到 409 且用户输入为空时自动改用 `base 2` 重试一次。
【INFO · 归档】_pipeline/archive/03_REVIEW_20260924_1711.md 已按纪律「先归档再覆写」生成，
        当前为未跟踪文件（审查是只读，未提交）。请总控随本轮入库，保持 archive 只增不删。

--------------------------------------------------------------------------------
七、契约与文档一致性（重点项 5）
--------------------------------------------------------------------------------
7.1 API_CONTRACT.md 是否只增不删：**是**。逐段核对 git diff f31643e..HEAD -- API_CONTRACT.md：
    · 唯一一处原文字句修改 = §0 错误码表 409 行（「同学科空间已存在」→「同名空间已存在」）；
    · §1 末尾纯追加 #20 接口块（res / 说明 / 认证 / 越权 四条）；
    · §2 create 小节在原代码块之后追加「v1.2 变更」块，上行原文保留（含「先明确不做」等说明）；
    · §11 追加 2026-09-24 v1.2 一行，且**显式自陈**「§0 错误码表 409 行同步改写——本版唯一一处
      原文字句修改」——留痕与实物一致。✔
7.2 契约与实际实现一致：#20 的 user 四字段、spaces 与 §2 list 同形、model.mode/name 取值、
    401 语义，均与 profile.ts + profile.test.ts 一致（含测试断言键集）。✔
    §2 v1.2 的「1–30 字」与后端 MAX_SPACE_NAME_LENGTH=30 一致——**恰恰是这处一致暴露出前端 40 的
    不一致（H1）**。
7.3 执行报告偏差 D11–D16 与代码是否相符：逐条复核
    D11 closedLoop 19→20 且补路由行          → 实物相符（已核 diff）✔
    D12 §11 v1.2 合并行确在 A3(f564cfe) 落盘  → `git show f564cfe -- API_CONTRACT.md` 命中该行，C3 未重复追加 ✔
    D13 内联脚本置于 theme-color meta 之后、样式之前 → dev 与 build 落地 HTML 均相符 ✔
    D14 注释不写尖括号标签名（Vite 注入误命中）    → dev 落地 HTML 中 @vite/client 与 react-refresh
        正常位于 head 顶部、未被塞进注释内（见九证据）✔
    D15 routerGuard PROTECTED 10→11          → 实物相符 ✔
    D16 .env.example 写 3 行注释块而非 1 行   → 实物相符（仍为注释，未激活任何变量）✔
    结论：6 条偏差均如实、可核对，无「报告写了代码没做」或反之。
7.4 LOOKATME 数字与实跑是否一致：测试 292 / 26 文件、tsc 三段 exit 0、数据闸门 6 项、
    契约 20 接口、路由表 12 页 —— 全部与我的复跑一致 ✔；仅提交数与「3 项/4 条」表述不实（L3）。

--------------------------------------------------------------------------------
八、测试缺口评估
--------------------------------------------------------------------------------
8.1 新增逻辑的测试覆盖：theme store（7 例，含隐私模式 + 模块重载恢复）、stages 一致性 + 纯函数
    （6 例，读真实 index.json 逐项比对）、profile #20（5 例，含机密词全文断言与 env 分支）——
    覆盖到位，且都是「真断言」不是快照式兜底。
8.2 未覆盖缺口（按风险排序）：
    a) 【对应 H1】空间名长度上限的前端侧（40 vs 30、后缀超限）——本轮唯一功能缺陷所在且无测试；
    b) 【对应 M1c】MePage 无组件级渲染测试（执行报告六.2 已声明未做，理由是超出计划测试范围）；
    c) 【对应 M1a/M1b】浅色对比度与窄屏布局无任何自动化断言（logoGeometry 只锁几何）；
    d) suggestSpaceName 与 store.spaces 空数组竞态（L4）无测试。
8.3 计划中的测试命令是否实际执行：计划各批验证命令与十、总验收 1–3 项，我均独立复跑通过
    （见九）；未被执行的是十、第 4–5 项中的浏览器走查部分（第 4 项 env 核查我已复跑通过）。
8.4 失败是否被忽略或未如实记录：执行报告三、如实记录了 3 个失败与修复（themeStore meta 复位、
    closedLoop 19→20、Vite 注入错位），且与我的独立复核一致。✔

--------------------------------------------------------------------------------
九、可执行证据（命令 + 关键输出）
--------------------------------------------------------------------------------
[1] 测试分批实跑（本机 60s 限制，分三条）
    $NODE $WS/node_modules/vitest/vitest.mjs run packages
      → Test Files 2 passed (2) / Tests 43 passed (43)        （bkt 20 + selection 23）
    $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      → Test Files 13 passed (13) / Tests 143 passed (143)    （space 15 / profile 5 在列）
    $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      → Test Files 11 passed (11) / Tests 106 passed (106)    （themeStore 7 / stages 6 在列）
    合计 43+143+106 = 292，文件 2+13+11 = 26 ⇒ **与执行报告 292/26 完全一致** ✔
[2] 基线对账（独立重算，证实 225 是过期快照、269 属实）
    for f in $(git ls-tree -r --name-only f31643e | grep tests/.*test.ts); do
      git show f31643e:$f | grep -cE "^\s+it\("; done
    → engine 23+20=43；api 18+16+15+15+11+11+10+8+8+8+8+5=133；web 17+13+13+10+10+10+9+6+5=93
      ⇒ 基线 269 例 / 23 文件（引擎43+后端133+前端93）
    space.test.ts create 组：基线 10 例（4+2+4）→ 现 15 例（9+2+4），净增 5 ✔
    292 = 269 + 5（A1 净增）+ 6（stages）+ 7（themeStore）+ 5（profile）+ 0（routerGuard 仅改断言）
      ⇒ **269→292 对账自洽** ✔（总控备忘中的「约 267」应为 269；「225」确为迭代 3 旧快照）
[3] 类型检查三段
    $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json  → engine exit=0
    $NODE $WS/.../tsc --noEmit -p functions/api/tsconfig.json                          → api exit=0
    $NODE $WS/.../tsc --noEmit -p apps/web/tsconfig.json                               → web exit=0  ✔
[4] 数据闸门
    $PY scripts/validate_data.py → [PASS] 全部阻断项通过（DATA_SCHEMA §6 校验 1–6 通过）；
      16 条非阻断 WARN，与执行报告一致 ✔
[5] 构建产物（复用总控 17:10 的 apps/web/dist，未重跑构建以免改动产物）
    grep -n "<html" apps/web/dist/index.html            → 5:<html lang="zh-CN">（无 class="dusk"）✔
    grep -n "class=\"dusk\"" apps/web/dist/index.html   → 无命中（OK）✔
    grep -n "<script>|</script>|<style>|type=\"module\"" apps/web/dist/index.html
      → 45:<script> … 57:</script>（内联主题脚本）  60:<style> … 67:</style>  68: 模块脚本
      ⇒ 内联脚本保留且先于样式 ✔
[6] 真实 dev 落地 HTML（同一条命令内 起 vite → node 忙等 8s → curl → pkill，收尾 pgrep 确认无残留）
    $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts --port 5179 --strictPort &
    curl -s http://localhost:5179/ | head -70
      → <html lang="zh-CN">（无 class="dusk"）
      → @vite/client 与 react-refresh 预置脚本位于 head **顶部**，未落入注释内（D14 成立）
      → 内联主题脚本在 <meta name="theme-color" content="#070C14"> 之后、<style> 之前（D13 成立）
      → html{background-color:#f5f8f9} / html.dusk{background-color:#070c14} 双分支在位
    pkill -f vite.js → pgrep -fl vite.js → "no vite left" ✔
[7] 仓库卫生
    git check-ignore -v .env .env.local deploy/zhiwei.env deploy/prod.env
      → .gitignore:17:.env / :18:.env.* / :22:deploy/*.env（四条全命中）
    git check-ignore -v .env.example deploy/zhiwei.env.example → 无输出、exit=1（模板不命中）✔
[8] 范围与红线
    git diff --name-only f31643e..HEAD -- apps/web/src/theme packages config data scripts packages → 空 ✔
    git diff --name-only f31643e..HEAD -- functions/api/src/serialization.ts apps/web/src/api/sse.ts → 空 ✔
    git status --short → M tools/e2e-smoke.cjs / ?? _pipeline/PR-tempdeploy.md / ?? 知微-项目介绍.md
      （他人三项未动）+ ?? _pipeline/archive/03_REVIEW_20260924_1711.md（本次归档，见 INFO）✔

--------------------------------------------------------------------------------
十、轮 2 开工前的修复建议（按顺序）
--------------------------------------------------------------------------------
1. 先修 H1（前端 30 字对齐 + suggestSpaceName 长度上限 + 两处边界测试）——这是本轮唯一的功能缺陷，
   一行 maxLength 的失误会被现场演示踩到。
2. 补 M1 的真实浏览器走查（至少 720/375 两档宽度 + 浅色主题全页截图），把顶栏窄屏与 logo 对比度
   两个观察项坐实；若 logo 在浅底不可读，按 D3f 的既定处置改令牌，不要用裸 hex 兜底。
3. 顺手清 L1（describe 19→20）、L2（index.css 注释）、L3（LOOKATME 提交数与「3 项/4 条」），
   L4（顶栏预检前确保列表已加载或 409 自动重试一次）可并入 H1 同一次改动。
4. 把 _pipeline/archive/03_REVIEW_20260924_1711.md 与本报告一并提交（archive 只增不删）。

VERDICT: FAIL
