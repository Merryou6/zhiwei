知微 · style-10 迁移 第 4 轮审查报告（P8.0–P12.4 全量交付把关）
==============================================================
审查角色：reviewer（只读审查；本文件为唯一写入产物）
审查日期：2026-10-11 20:39（本机时间）
审查输入：tempui/STYLE-10-迁移计划.md（需求定稿）、_pipeline/01_PLAN.md（第 10 版，
  D21–D26 裁决）、_pipeline/02_EXEC_REPORT.md（第 4 轮终版 964 行）、
  代码差异 bf3c7fe..HEAD（HEAD = 338ef49，实测 46 个提交，与报告计数一致）。
审查方法：全部结论基于本机独立取证（git --no-pager log/diff、独立复跑测试与类型检查、
  自行解析 8 份审计 JSON / 6 类探针 JSON / 8 份 h1check JSON / 汇总矩阵产物），
  不采信报告中未经验证的数字。审查前旧版报告已归档
  _pipeline/archive/03_REVIEW_20261011_2039.md（md5 两侧一致，只增不删）。

--------------------------------------------------------------
一、总体结论
--------------------------------------------------------------
第 4 轮 21 个主步骤（P8.0 记账 / P8.1 清偿 / P8.2 /chat / P9.1–P9.4 / P10.1–P10.6 /
P11.1–P11.4 / P12.1–P12.4）全部完成且证据链可核查；P0–P7 已 PASS 结案的 9+6+6 个
提交未受波及。总验收清单（01_PLAN「一、」第 12–18 项）逐条核过：17 页
（学生端 13 路由 + 门户 / + 教师端 3 页，页面文件实测 14+3）全部迁移完成，
PAGE_OWNED_HEAD 登记表 17 条 + /t/student/ 前缀特例与 D24 预判登记表逐条一致；
冻结区一行未动（独立复核空输出）；462 用例只增不减（独立复跑全绿）；
单页单提交红线全程成立（46 提交逐条核对，每页代码/走查/报告各自独立提交）。
发现 2 项 L 级、5 项 INFO 级问题（见「四、」），无 H/M 级，均不构成本轮 FAIL 依据。

VERDICT: PASS

--------------------------------------------------------------
二、逐项审查结论（对照审查要点 1–7）
--------------------------------------------------------------

【要点 1：冻结区终检独立复核】—— 通过
独立执行（区间口径 bf3c7fe..HEAD）：
  a) router.tsx + api/ + packages/engine + functions/ + data/（四份冻结契约在 data/ 下）
     → 空输出；
  b) stores/ + graphLayout/graphMastery/graphSnapshot/poster → 空输出；
  c) apps/web/tests + packages/engine + functions/api/tests（覆盖
     routerGuard/sse/client/chatPanel/mobileNav/dialogStore/reveal/phrases/stages/
     authStore/graphMastery/graphSnapshot/graphLayout/poster 等全部冻结测试文件）
     → 空输出，即本轮 0 个既有测试文件被改动，「只增不减 = 起点 462 = 终态 462」
     由 diff 直接成立，不依赖报告转述。
工作区口径复核同样空输出（工作区现存未提交项仅他人产物 tempui/、.workbuddy/、
package-lock.json 与已删除的 tempui/纯前端需求文档.md，均未被本轮触碰，符合计划约定）。

【要点 2：17 页逐页抽查】—— 通过（深查 9 页 + 其余轻查）
深查页与结论：
  · P8.2 /chat（代码 e5ee88f）：ChatPage 现文件逐行读完并与 bf3c7fe 版对照——
    store 消费（useDialogStore/useChatPanelStore/useSpaceStore）、exitNotice 派生
    （next_action=exit_channel + exitChannelText）、收进侧栏 setPanelOpen(true)+
    navigate(ME_PATH)、ChatComposer disabled=store.streaming 全部原样；七件套为共享
    import 零改动；双栏档位由 nav: 换 annos:1180（D4）。逻辑零改动确认。
  · P9.3 /paper（代码 39b3ea1）：取数 effect 与迁移前逐字符对照——drive()/getPaper()
    回显链、cancelled 清理、依赖数组 [activeSpaceId] 原样；仅新增 D-P9.3-1 声明的
    三个表现层状态位（filesLoading/loadFailed/recognizeFailed，均在既有 catch/finally
    内置位）+ retryLoad（重发同一个 drive()，D15c 真重试口径）。无业务语义改动。
  · P9.4 /attribution（代码 b9ca011 + 修复 a11e7e5）：回显 effect 对照确认仅加
    viewFailed（D-P9.4-1）；a11e7e5 仅改嫌疑分文案与 aria-label（D-P9.4-2 留痕，
    原型「合计为 1」确与本工程不归一的 suspect_scores 语义冲突，以真实为准正确）。
  · P10.4 /login（代码 7653b2b）：LoginPage 的 finishAuth/handleSubmit/handleDemoEnter/
    DEMO_ACCOUNTS/两处 navigate 逐行未动（diff 中无相关 +/- 行）；App.tsx 去掉
    /login 的 bare 为计划外必要改动（D-P10.4-1，一处 + 注释，Guarded bare 形参保留
    供 /t 用），ToastHost 仅注释三行——两处均如实披露且可单条 revert。
  · P10.5 /me（代码 1b3f41d，半页收口）：MePage 的 reportSummary effect（cancelled/
    依赖 [spaceId]）、handleLogout 链路原样；StudentTeacherSection 的 5 个接口调用、
    load useCallback、两 effect 依赖、toast 文案、navigate 目标逐行未动；新增
    recommendationsOnly 为纯渲染开关，REC_ORDER 为展示排序（详见 INFO-3）。
  · P11.2–P11.4 教师三页（efa18e8/f8b74c8/152800f）：diff 中无任何前端角色拦截新增；
    403 由服务端 requireTeacher 兜底（functions/ 区间 diff 空输出 = 零改动）；
    下发/撤回 activeKpIds 三态集合与详情链接逐字一致。
  · P8.1 GraphPage（087da5d）：见要点 3。
  · P10.2 /start（52212c6）：SHEET 10-03 / COLD START 页头与原型锚点一致，
    四路径 CTA 去向（PAPER/ASSESSMENT/SELF_REPORT/GRAPH）与迁移前逐一对应。
  · Layout.tsx：PAGE_OWNED_HEAD 17 条登记 + ownsHead 前缀匹配一处（/t/student/），
    与 D24 登记表逐条一致；'/' 登记暂无实效已留痕（D-P11.1-4，门户不经 Layout）。
轻查页（/assessment /practice /spaces /self-report /drive / 门户 /）：提交范围核对
（每页 = 页面文件 + Layout 登记 + 视需 index.css，走查产物独立提交）+ 静态纪律抽查
无一次性样式 + h1check 全绿，未见业务逻辑夹带。

【要点 3：P8.1 清偿质量】—— 通过
M-1（D21）：完整读取 087da5d diff——选型为第二层（series 级 labelLayout:
{hideOverlap:true} + shortLabel 8 字截断 + 省略号），选型依据（列距×缩放的屏间距
vs 16 字渲染宽）写入注释；emphasis 态保留、点火/DIM_OPACITY/重绘/文字清单键盘语义
未动。OBS-2 前后对照产物 9 件在库（before/after 整页 4 张 + 1440 双主题放大 crop
4 张 + 1024 形状地图留痕 1 张），本审查抽查 obs2-m1-1440-light-before/after-crop.png
存在且成对。L-1（D22）：ZOOM_MIN 0.12→0.3 一处常量 + 注释「防节点成点」，
与 fitZoom 地板同口径，无第二口径并存。375 档 overflowPx 全 0 未回退（见要点 5）。

【要点 4：P12 收尾核验】—— 通过
  · overflowPx 矩阵真实性（不读汇总文件、自行解析原始 JSON）：
    - 8 份 audit-style10-*.json：11 路由 × 8 组合 = 88 单元 overflowPx 全 0，
      每份 width/theme 字段与文件名一致（无「深色数据冒充满色」）；
    - 6 类专项探针（practice 5 态 / start 1 态 / landing 2 态 / teacher-t 4 态 /
      teacher-student 4 态 / teacher-recommendations 4 态）× 8 组合 = 48 份 JSON
      全部存在且 overflowPx 全 0；
    - 8 份 h1check-*.json：14 路由 × 8 组合 = 112 单元 overflowPx 全 0、
      h1AllCount 全 1、h1MainCount 全 1；
    - 合计 17 路由 × 8 组合 = 136 单元与 overflow-matrix-17x8.md 汇总一致，
      非 0 / 缺失单元实测 0。
  · nav 零清退结论（自行 grep 盘点）：真实类名用法确为 3 处 max-nav:min-h-9
    （ChatPanel L58/L67、Toast L75），与报告 A 类清单逐字一致；B/C 类 0 处
    （ChatPage 的 nav: 已换 annos:、MobileNav 的 nav:hidden 已在 P5 换档，两文件
    本轮区间 diff 实测为空）；tailwind.config.js nav:720 定义与 breakpoints.test
    断言逐字保留。Toast/ChatPanel/MobileNav 三文件本轮零改动，触控目标不可能回退。
  · README/LOOKATME：diff 逐行核对——仅数字与状态描述更新（462/43 文件/四档/
    17 路由口径/产物指引），结构未动，历史段按期留痕未改。LOOKATME「累计 242
    次提交」为写行时点口径（终态实测 243 = bf3c7fe 的 197 + 本轮 46），行内自带
    「以命令实测为准」说明，非虚报。
  · D-P12.2-1（两条 audit 重采未跑，以 diff 空 + 终态数据替代）：成立。理由成立
    三要素均复核过——本步零代码改动、audit 工具采样字段确不含触控目标高度、
    A 类三文件区间 diff 确为空。重采不产生新信息，替代证据反而更强。

【要点 5：测试与构建独立复跑】—— 通过
  · vitest apps/web/tests → 22 文件 217 用例全绿（独立复跑）；
  · vitest packages → 2 文件 43 用例全绿（独立复跑）；
  · vitest functions/api/tests → 19 文件 202 用例全绿（独立复跑）；
    合计 462 与第 3 轮基准逐项一致，无删减、无新增（3.3 预计 0 文件改动，实测 0）。
  · tsc 三段（packages/engine / functions/api / apps/web）独立复跑全部 exit 0。
  · 6.3 静态纪律四条独立复跑：任意值断点变体 / 裸 z-[ / CDN 字体均无匹配；
    页面文件裸 hex className 与 min-w-[ 无匹配；index.css 新增 623 行全部
    .bp-* 制式类命名（blueprint 纪律）。
  · 报告真实性抽查共 11 项（462 用例 / tsc 三段 / 冻结区空 / nav 3 处 / 矩阵
    136 单元 / h1check 112 单元 / paper-attribution 七态探针含 injected 标注 /
    OBS-2 产物 9 件 / 46 提交计数 / A 类文件 diff 空 / 静态纪律），未发现虚报；
    快照表 27 个 hash 与 git log 逐条对上（含 7396743/68e7828/338ef49 收尾三提交）。
  · 探针工具安全抽查：PROFILE 均为 tmpdir 浏览器档案（rmSync 自清理）；POST 调用
    仅 auth/login、auth/register（演示流程，报告披露）、evidence/self-report、试卷
    确认链（D23 记账）与 409 专项的真 create 判定（409 即失败、不落库，注入脚本
    只拦 list 并透传 create）——无删除类端点、无伪造业务数据写入路径；
    /tmp/fix-demo-teacher.cjs 修复 local_db 的事件已如实留痕（「十四、」）且
    data/local_db 为 gitignore 运行时数据，非冻结区。

【要点 6：报告自曝缺口评估】—— 均可放行（详见四、L-1/INFO-2）
  · /chat 三项缺口（SSE 流式实拍 / 面板全屏同构对照 / probe-chat-states 未建）：
    放行依据——①发送链路全部位于冻结区（sse.ts/client.ts/useChatSend.ts/dialog
    store），区间 diff 空输出即「行为与第 3 轮 PASS 时完全相同」；②sse(20)+
    client(13)+chatPanel(5)+dialogStore(7) 全绿；③本审查逐行确认 ChatPage 复用
    同一套七件套（非重实现），同构性由代码结构保证；④01_PLAN「二、」对检查点⑦
    的把关口径原文即「P8 单页提交三件套 + sse/client/chatPanel/dialogStore 全绿」，
    该口径已满足；走查专项 a/b 属 P8.2 步骤内要求，未做已如实自曝（未隐藏），
    且 8 组合常态走查覆盖了页面壳对消息流渲染的干扰面。残留风险低，记 L-1 留档。
  · D-P12.2-1：见要点 4，成立。

【要点 7：执行偏差抽查（续完与半页收口）】—— 通过
  · 快照表与 git log 对齐抽查（21 条全部核对）无出入；
  · P10.3 /self-report 与 P10.5 /me 两处半页收口：Layout 改动均为 D24 同款登记，
    页面改动经逐行对照判定后收口，本审查独立复核 MePage/SelfReportPage 未发现
    业务逻辑夹带；D-P10.5-1/2/3、D-P10.3-1~4 留痕与实际 diff 相符；
  · 计划外文件四处（SpaceCreateForm / StudentTeacherSection / App.tsx / ToastHost）
    均在报告特此标明、给出理由（不迁移则视觉不完整 / 另写会复制业务逻辑，违反
    「业务逻辑一行不改」与单一来源）且可单条 revert——本审查核对四处 diff 确为
    仅视觉 + 注释 + 纯渲染开关，判定属「最小必要扩围 + 完整留痕」，可接受。

--------------------------------------------------------------
三、总验收清单把关（01_PLAN「一、」第 12–18 项）
--------------------------------------------------------------
  · 第 12 项 认领清偿：M-1 / L-1 / INFO-1(D23 基数) / INFO-2(D24 登记) 全部落地，
    OBS-2 取证在库 —— 通过。
  · 第 13 项 检查点⑦ /chat：三件套 + 四测试全绿（计划§二口径），视觉迁移完成 ——
    通过（L-1 取证缺口留档）。
  · 第 14 项 检查点⑧~⑪ T0 四页：逐页单提交 + 4 档双主题走查 + 勾稽 #3 全链
    真浏览器取证（刷新回显 / 错题缓存写入 → /attribution 联动，含幂等键口径的
    如实说明）—— 通过。
  · 第 15 项 检查点⑫~⑰ T1 六页：含 /login 真实链路七状态取证（token 落盘 / 刷新
    不掉线 / 401 回清 / 演示账号双分支）—— 通过（D-P10.4-1 计划外扩围见要点 7）。
  · 第 16 项 检查点⑱~㉑ 门户+教师四提交：403 兜底零改动取证、R17 无降级 —— 通过。
  · 第 17 项 P12 收尾：D26 零清退（结论成立）、冻结区终检、矩阵 136 单元、
    LOOKATME/README 实测数字 —— 通过。
  · 第 18 项 全程红线：单页单提交 46 个核对无混批；冻结区零改动；462 只增不减；
    PAGE_OWNED_HEAD 逐页落地、h1check 112 单元全 1（无双 h1）—— 通过。
  结论：总控拍板的「一轮完成全部剩余任务」范围内，17 页全量迁移完成度达标，
  验收清单可勾。

--------------------------------------------------------------
四、问题分级（无 H / 无 M；L×2、INFO×5）
--------------------------------------------------------------
L-1【/chat 计划内走查专项三项未做，且已无后续轮次兜底】
  文件：apps/web/src/pages/ChatPage.tsx（影响面）；计划 01_PLAN「五、P8.2 走查口径
    a/b/c」。
  问题：SSE 登录态流式实拍、面板/全屏同构对照截图、tools/probe-chat-states.cjs
    三项计划明确列出的取证未做，P12.3 亦未回补（报告「二十一、」如实自曝）。
  影响：检查点⑦的行为证据完全依赖冻结区 diff + 四个测试文件全绿 + 代码结构复核
    （本审查已做），属「推断充分、实证缺位」；若未来改动 /chat 页壳或七件套，
    缺一组同口径的基线实拍可对照。
  建议：如项目继续迭代，优先补做这三项（探针模式可复用 probe-login-states 的
    登录链路）；至少补 a) 一张流式过程截图与 b) 一组面板/全屏同会话对照。

L-2【组件库 Button size="sm" 的 text-tok 类未进 cn.ts 合并组，primary sm 按钮对比度
    不达 AA（既有缺陷，非本轮引入）】
  文件：apps/web/src/components/ui/Button.tsx L67（sm 档含 text-tok）+
    apps/web/src/lib/cn.ts（font-size 组缺 tok / mono-xs / body-sm / title-sm /
    title / num-lg 六个字号令牌登记）。
  问题：tailwind-merge 把 text-tok 当颜色类，在 cva 合并中顶掉 text-on-accent；
    执行方已取证：/login 两颗「一键进入」计算样式 ≈2.3:1（不到 AA）。全站
    size="sm" 实测 29 处（其中非 secondary/quiet/link 变体 22 处受影响）。系
    P3/P4 落令牌时的漏登记（第 1 轮引入），本轮 D-P10.4-4 已完整举证 + /login
    单页改 md 档规避 + 明确建议下一轮认领修根因。
  影响：已交付站点上 sm primary 按钮存在可访问性缺陷（多为次要操作键，视觉上
    「蓝底深蓝字」仍可辨读，但低于 AA 标准）。
  建议：下一轮认领（与第 3 轮 M-1/L-1 同性质）：向 cn.ts 的 font-size 组补登
    6 个字号令牌，一处修全站；修完对含 sm primary 按钮的页面（/chat 收进侧栏、
    ChatPanel 全屏打开等）补一次走查快照，并复核 22 处非 sm-variant 位的视觉
    无回归。

INFO-1【breakpoints.test 的 nav: min 侧「真实使用点」断言已空转】
  说明：B 类清退后 src 内 min 侧 nav: CSS 类用法归零（本轮 ChatPage 换 annos: 是
    最后一处），该测试的 hits(/[^\w-]nav:/) 断言现仅由注释行与 router.tsx 的
    nav 布尔属性命中满足。「防拼写静默失效」保护对 min 侧不再有实际约束力。
    测试文件按红线不可改，D26 亦未要求处理；建议后续修订断言口径（剔除注释）
    或留痕接受现状。max-nav: 侧（3 处真实用法）不受影响。

INFO-2【D-P12.2-1 替代取证口径成立】见要点 4，无需行动。

INFO-3【StudentTeacherSection 展示层新逻辑】REC_ORDER 排序（原 active/settled 两组
    分列 → 单表按状态序，??9 兜底）与 recommendationsOnly 渲染开关为展示层新增，
    数据流/接口/导航逐行未动（已独立核对）；已留痕 D-P10.5-1。可接受。

INFO-4【PaperPage retryLoad / AttributionPage viewFailed 等真重试实现】属 D15c
    同口径的表现层状态位 + 重发同一请求（非新开取数路径）；既有 effect 的接口
    参数 / cancelled / 依赖数组逐字符未动（已逐字符对照）。已留痕，可接受。

INFO-5【LOOKATME 242/243 口径】见要点 4，行内自带口径说明，非虚报。

--------------------------------------------------------------
五、审查声明
--------------------------------------------------------------
本报告全部结论有独立取证支撑（命令与输出要点已内嵌各节）；无「信息不足无法判断」
的阻塞项。除本文件与归档件外未修改任何文件。

VERDICT: PASS
