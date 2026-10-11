知微 · style-10「青蓝蓝图」全站视觉迁移实施计划
=================================================
计划编号：01_PLAN（第 9 版：P7 /graph ECharts 改造批次细化版，对应需求《tempui/STYLE-10-迁移计划.md》定稿 2026-10-10）
编写日期：2026-10-11 13:36（本机时间）
编写角色：planner（只读规划，implementer 严格照办；执行歧义按「四、决策记录」D 编号裁决，不向总控提问）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD = fa20d8e（tempui-doc 分支，rev-list --count HEAD = 191）。
      P0–P6 七批 + 记账与执行报告已全部入库（2fe4ba3→fa20d8e 共 15 个提交：P0–P5 九个
      2fe4ba3→e96c702，P6 六个 d050fcb→ddc6eca→7935705→a169874→dcda2b9→fa20d8e，
      详见「五、」批次状态表）。第 1、2 轮审查 VERDICT 均 PASS（_pipeline/03_REVIEW.md）。
      工作区他人未提交变更（一律不碰、不回退、不纳入代码提交，仅记账提交按 P7.0 白名单入库）：
      M _pipeline/03_REVIEW.md（reviewer 第 2 轮 PASS 报告，本轮 P7.0 入库）、
      D tempui/纯前端需求文档.md、?? tempui/STYLE-10-迁移分析.md、?? tempui/STYLE-10-迁移计划.md、
      ?? tempui/prototypes/、?? tempui/qa-report.json、?? _pipeline/PR-tempdeploy.md、?? .workbuddy/、
      ?? node_modules/、?? package-lock.json、?? _pipeline/archive/03_REVIEW_20261011_1319.md、
      ?? _pipeline/archive/01_PLAN_20261011_1336.md（本次归档）。
      唯一视觉依据 = tempui/prototypes/style-10/index.html（4113 行；本版新锚点：
      PAGES.graph L2793-2908、graphLayout/bandShapePath L2761-2792、图谱 CSS L547-573、
      描边动画与 reduced-motion L570/L772/L777、路由登记（10-11/2.11/T0）L1314、
      sheetHead 制式 L1604-1609、打印样式 L784-804（graph 页不适用打印，见 D20 注））。
归档：旧版 01_PLAN.md（第 8 版：P6 细化版，392 行）已先复制归档为
      _pipeline/archive/01_PLAN_20261011_1336.md（md5 c0ffea559795e03646dbbff898d029c7 两侧一致，
      归档只增不删），然后才覆写本文件。更早归档链见 _pipeline/archive/ 目录（只增不删）。
本轮范围边界（总控明示）：仅 P7（/graph ECharts 改造 + 四项认领裁决落地 + 记账入库）。
      P8（/chat）起不在本轮；P9–P12 照旧排队。
无阻塞项。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL：vitest 一律分批；git diff 一律全局选项前置
    （git --no-pager diff）；dev server / 后端可 run_in_background 存活；走查脚本按宽度/主题分档跑防超时。
  ⚠ 沙箱批量删除闸门：原地 vite build 会因清空 dist/assets（641 件 > 阈值 500）被拦。
    build 命令一律采用等价口径 --outDir /tmp/zhiwei-web-build-<批次名>（第 1 轮 L-1 留痕）。
测试基准数字（第 2 轮报告实测口径）：全仓 vitest 42 文件 453 用例
  （apps/web 208 / packages 43 / functions/api 202）；apps/web/tests 21 文件（视觉门禁 =
  tokens 23 + bands 12 + breakpoints 9 + themeStore 9 + blueprint 7）。P7 结束时用例总数只增不减。

-------------------------------------------------
一、目标与验收清单（逐条可勾选；★ = 本轮 P7 范围）
-------------------------------------------------
[✔] 2.【检查点①】tempui/STYLE-10-设计系统规范.md：12 章、零 React 代码（commit 2fe4ba3）。
[✔] 3.【检查点②】tempui/STYLE-10-组件库草案.md：三节齐备（commit 08b2d55）。
[✔] 4.【检查点③】三门禁 + themeStore 期望重写全绿（commits 0be67ee / 7ee5dc6）。
[✔] 5. 双主题 token 体系落地：--p-*/--c-* 全量换值、四档色值三处同源（7ee5dc6）。
[✔] 6. 主题默认「跟随系统、优先白图」，键沿用 zhiwei_theme（7ee5dc6）。
[✔] 7. 字体自托管：三族 @fontsource，全仓无 CDN（7ee5dc6）。
[✔] 8.【检查点④】制图板外壳一次切换 + ChatPanel 三形态 + tabbar + 抽屉（f5d9aed + 5d0630d/404e7bb）。
[✔] 9.【检查点⑤·第 2 轮 PASS】/report 首迁页五节制式 + 四态 + 打印 + F-01 修复（overflowPx=0）
       + M-1 pad-frame token 三处同源；业务逻辑零改动（P6 六提交 d050fcb→fa20d8e；
       453 用例全绿；走查 88+8 张）。
[✔] 10. 一行不动红线（P0–P6 全程成立）。
[★] 11a.【检查点⑥·本轮】/graph 按 PAGES.graph（L2793-2908）逐段复现视觉层：四档形状
       三重编码（D20①）、页头自有登记（D19）、证据统计四格、画布工具条与图例制式、
       节点详情双栏、文字版清单全档常在（非折叠）、空态分支；业务逻辑一行不改。
[★] 11b. D8 六项按已拍板分派落地：①形状 symbol ②天蓝不做小字 ③主题切换重绘不重播
       = 执行项；④键盘操作 ⑤800ms 描边入场 ⑥节点焦点环 = 评估先行尽力项
       （做不到则执行报告逐项留痕「做了/没做/差距/原因」，见 D20）。
[★] 11c. 四项认领裁决落地：L-1 token 消费（D16）、L-2 注释清偿（D17）、
       L-3 走查取证约定（D18）、/graph 页头归属 PAGE_OWNED_HEAD 登记（D19）。
[★] 11d. 记账入库：01_PLAN.md 第 9 版、第 8 版归档件、03_REVIEW.md 第 2 轮及其归档件（P7.0）。
[ ] 12. 其余页（P8 /chat 起）与状态实验室不迁移，照旧排队，不在本轮。
[ ] 13. 收尾（P12）照旧。

-------------------------------------------------
二、检查点映射（原计划检查点 → 本流水线产物 → 把关口径）
-------------------------------------------------
检查点①~⑤已由第 1、2 轮 reviewer VERDICT=PASS 把关结案（见 _pipeline/03_REVIEW.md）。
本轮：
  检查点⑥（/graph ECharts 改造验收）→ P7 产物（五节制式 + D8 六项分派结果留痕 +
    四态 + 双主题 × 4 档截图 + 变更说明三件套）交 reviewer VERDICT 把关；任一 FAIL 则该批不通过。
  把关重点（reviewer 参照）：①D8 六项逐项「做了/没做/差距/原因」留痕是否如实（禁伪造）；
  ②冻结区两种 diff 口径（工作区 vs HEAD、e96c702..HEAD 同类区间口径）零改动；
  ③/graph 全档 overflowPx=0；④graphMastery/graphSnapshot 全绿；⑤用例只增不减。

-------------------------------------------------
三、一行不动清单（冻结区红线）与逐批检查命令
-------------------------------------------------
3.1 冻结区（全程不碰，每批提交前用 3.2 命令复核；P7 继续全程有效）：
  · apps/web/src/router.tsx 全文件（ROUTES / STORAGE_KEYS / guardPath 原样；routerGuard.test.ts 锁定）
  · apps/web/src/stores/*（9 个）对外行为与落盘键（P6 全程零 store 改动，本轮同样不许可）
  · apps/web/src/api/{client,sse,endpoints,types}.ts + components/chat/useChatSend.ts
  · packages/engine、functions/、data/、四份冻结契约（API_CONTRACT / ALGORITHM / DATA_SCHEMA / PRD）
  · theme/bands.ts 档名与阈值不变
  · 服务端教师 403 兜底（functions/api/src/services/teacher.ts requireTeacher）
  · P6 追加红线（ReportPage 冻结项）继续有效。
  · P7 追加红线（GraphPage 及其依赖库，一行不改）：
    a) 取数 useEffect（getGraphMastery 调用、cancelled 清理、依赖数组 [activeSpaceId]）逐字符不改；
    b) 守卫分支顺序（!activeSpaceId → loading → 空态/数据态）不变（error 落位若做，按 D15c
       同口径插在 loading 之后、数据态之前，留痕）；
    c) 派生与机制语义不改：byKp/summary/badges/counts 派生、六态视觉机
       （treeNodeState/edgeLit/masteryByKpOf）、点火机制（IGNITE_BASE_MS/IGNITE_STAGGER_MS/
       ignitionLandingMs/lastIgnitionSourceRef 重绘不重播判定）、主题重绘机制（theme 进
       effect deps + themeColor 读 CSS 变量）、poster 链路（sharePoster/buildGrowthPoster/
       downloadPoster 全链路）、文字清单键盘行为语义（Tab 聚焦、回车开同一张详情卡、
       滚动移交焦点）、UI_TEXT/STATE_HINT/EVIDENCE_LABEL 文案常量；
    d) 全文件冻结：apps/web/src/lib/graphLayout.ts（computeGraphLayout/isPathEdge/parsePathParam
       布局纯函数）、apps/web/src/lib/graphMastery.ts（graphMastery.test.ts 锁定）、
       apps/web/src/data/graphSnapshot.ts（graphSnapshot.test.ts 锁定）、apps/web/src/lib/poster.ts。
3.2 逐批检查命令（每批提交前跑，期望均为空输出）：
      cd /Users/Merryou/LearnBuddy/zhiwei
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
      # 区间口径（收尾与 reviewer 用，fa20d8e 为本轮起点）：
      git --no-pager diff --name-only fa20d8e..HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only fa20d8e..HEAD -- apps/web/src/stores apps/web/src/lib/graphLayout.ts apps/web/src/lib/graphMastery.ts apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts
  行为证据：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
  graphSnapshot / reveal / phrases / stages / authStore 这些测试文件本身不改，全绿即冻结区未被破坏。
3.3 测试改动口径（红线：重写期望不删断言、用例只增不减）：
  · 本轮许可改动的既有测试文件仅 1 个：apps/web/tests/breakpoints.test.ts —— L2 认领（D17），
    只改文件头「合法保留」白名单注释（删 ReportPage min-w-[420px] 三行陈旧描述），
    断言与扫描逻辑零改动。
  · 本轮新增（只增，视 P7.3 提取情况）：apps/web/tests/graphSymbol.test.ts —— 形状 path 纯函数
    断言（四边形 4 点 / 五边形 5 点 / 六边形 6 点 / 圆 arc / 未解锁方形 4 角）。
  · 该页相关既有纯逻辑测试改期望清单：预计 0 个（format/kpName/useCountUp/reveal/phrases 不动）。
  · 不动清单照旧：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
    graphSnapshot / reveal / phrases / stages / bands / breakpoints(断言) / themeStore / blueprint /
    tokens / logoGeometry / richText / authStore / format / useCountUp。
  · 用例总数 453 起步只增不减。

-------------------------------------------------
四、决策记录（D1–D15 保留照旧，见 _pipeline/archive/01_PLAN_20261011_1336.md「四、」全文；
    本版新增 D16–D20，D1–D15 原文不重复抄录，要点索引如下）
-------------------------------------------------
D1 断点体系（narrow:420 / sheet:900 / annos:1180，nav:720 保留）—— 照旧。
D2 主题机制（跟随系统优先白图，键 zhiwei_theme）—— 已落地。
D3 ChatPanel 落位（1180/900 三形态）—— 已落地。
D4 ChatPage 双栏档位 —— P8 适用。
D5 产品文案：phrases.test 逐字锁定的文案不动；原型 mock 文案不采纳；新增展示文案
   （图例「低置信」chip、「已打通」等）不进 phrases。P7 适用。
D6 落地页逐字动画 —— P11 适用。
D7 空间胶囊与「全部图纸」抽屉 —— 已落地。
D8 ECharts 改造总决策 —— 本轮落地的总纲：保留 ECharts 生态与懒加载 chunk；不引入原型
   SVG 自绘；布局纯函数复用；本版按 D20 落细为六项分派。
D9 规范冲突以原型为准、只增留痕修订 —— 照旧。
D10 四态为组件正常实现 —— P7 第二个四态落位页（区域级 vs 整页级按规范 §7 graph 行）。
D11 原型 4 条已知不足的预裁决 —— 照旧。
D12 图标族 43 枚 blueprint/icons.tsx —— 已落地（zoomin/zoomout/target/download/branch/image
   等 P7 直接引用）。
D13 Sheet 内边距 pad-frame token 三处同源 —— 已落地（P6a，ddc6eca）。
D14 /report 375 档溢出结构修法 —— 已落地；其纪律（grid 子项 min-w-0、禁一次性最小宽类）
   对 P7 画布区同样适用。
D15 P6 执行细则（a–e）—— 已落地；D15c「最小新增 error state」口径 P7 若落红章沿用。
D16【L-1 认领裁决·planner 拍板】pad-frame-sm-b(10px) token 改为「消费」而非移除：
   Sheet.tsx base 档内边距类 pb-2.5 → pb-pad-frame-sm-b（同值 10px，SHEET_PADDING 常量一处替换，
   注释块同步说明）。理由：md 三 token 已被实际消费，唯独 sm-b 只定义不消费，构成
   「改它不影响任何页面」的漂移藏身处（第 2 轮审查 L-1）；消费后四 token 全部有类名引用，
   漂移面清零。不移除的原因：10px 值仍是规范 §4.2 sm 档底边距的事实源，移除即回到
   「无具名来源的魔法数」。三处同源不破：tailwind token 定义不动、tokens.test ⑬ 两条断言
   均仍绿（第一条锁定义、第二条禁裸任意值——具名类合法）、规范 §4.2 不动（值未变）。
   验收：build 产物 CSS 出现 pb-pad-frame-sm-b{padding-bottom:10px}；全站 sm 档零视觉变化。
D17【L-2 认领裁决·planner 拍板】breakpoints.test.ts 文件头白名单注释（L32-33 起
   「ReportPage 的 min-w-[420px]」三行）本轮顺手清偿：改写为「该写法已随 P6 清除；正则带
   冒号后缀是为防误伤宽度工具类」的现状描述。断言与扫描逻辑零改动（3.3 已列入许可）。
D18【L-3 认领裁决·planner 拍板】走查/探针对 e2e 账号的空间污染约定：
   a) P7 四态取证优先复用账号中已有的 2 个空空间（P6 探针遗留，正好可用于 /graph
      无证据态），不再新建空间；
   b) 若确需新建（如需「有空间但零证据」以外的新条件），须先在探针注释中累计计数并
      在执行报告留痕，禁止无感膨胀；
   c) 服务端无删除/归档接口属已知限制，不在本轮补（functions/ 属冻结区）。
D19【INFO-1 认领裁决·planner 拍板】/graph 页头归属：页面自有。原型 PAGES.graph 两个分支
   （有证据 L2865 / 空图谱 L2854）都渲染自己的 sheetHead（eyebrow 'KNOWLEDGE GRAPH /
   先修链全景'、SHEET 10-11、需求 2.11、chip 'T0 · 三重编码'；空态标题不同），且 sub/chip
   数据只有页面拿得到 → 本轮 P7.3 把 '/graph' 加入 Layout.tsx PAGE_OWNED_HEAD 登记表
   （new Set(['/report', '/graph'])），避免双 h1。本版起 P8+ 各页计划须预判页头归属并把
   Layout.tsx 列入涉及文件（吸取第 2 轮 D16 自曝教训）。
D20【D8 六项落地分派·planner 拍板（总控已拍板方向的落细）】验收口径：执行项必须做且
   有取证；尽力项评估先行（P7.2），能落则落，做不到则在执行报告逐项留痕
   「做了/没做/差距/原因」，禁伪造、禁静默缩水。
   ① 四档形状 symbol【执行项】：菱形=待巩固 / 五边形=不稳定 / 六边形=基本掌握 / 圆=已掌握；
     未解锁=方形（原型 L2790 0.8r 方）、未接触=虚线空心圆。ECharts 节点 symbol 支持
     'circle'/'diamond' 内建与 'path://…' 自定义——菱形/五边形/六边形/方形的 path 从原型
     bandShapePath（L2784-2792）转写为纯函数（新文件 apps/web/src/lib/graphSymbol.ts，
     顶点生成公式逐字对照），symbol: 'path://…' 挂到 per-node data。图例同步形状
     （BandLegend 若 P4 已是三重编码则直接用，否则微调并留痕）。
   ② 天蓝不做小字【执行项】：节点环内百分数（原型 nsh 10px）、编号（nlab 9.5px）等小字
     文本不得使用天蓝 #4E86D6（面板合成底 4.15:1，迁移计划已禁）——改用当前 token 体系
     中对比达标的可读色（如 --c-ink / --c-accent-ink 实测为准），色值选择在执行报告留痕。
   ③ 主题切换重绘不重播【执行项·既有机制保持】：现有实现（theme 进 effect deps + CSS 变量
     重取 + lastIgnitionSourceRef 判定）已满足，P7 重写视觉层时该机制原样保留并取证
     （切主题前后截图对照：节点位置不变、点火不重播）。
   ④ 键盘操作【尽力项·评估先行】：原型口径 = 节点可 Tab + role=button + aria-label +
     aria-current（L2808-2810）；画布容器 tabindex=0 方向键平移、加减号缩放（L2872）。
     ECharts canvas 无 DOM 节点。候选 A（画布级）：容器 tabIndex=0 + keydown 映射
     setOption 更新 series zoom/center（平移缩放）；候选 B（节点级）：节点 Tab 遍历在 canvas
     上不可行，节点级键盘选中走文字版清单（本轮起全档常在、真实按钮，本就是键盘路径）+
     可选「画布 Enter 选中视口中心最近节点」（convertFromPixel/containPixel 计算）。
     判据：不引渲染测试栈、不碰冻结区、不加大包体。评估结论记入 P7.2 产出。
   ⑤ 800ms 描边入场【尽力项·评估先行】：原型 = .drawn .edge stroke-dashoffset 900→0
     动画（L570，--t-draw 800ms）+ reduced-motion 双通道关闭（L772/L777）。ECharts graph
     edge 无描边动画能力。候选 A：不做，由既有节点错落点火（IGNITE 机制，冻结语义）承担
     入场仪式感并留痕差距；候选 B：边 lineStyle opacity/width 渐入（ECharts animation 可达，
     属「近似而非描边」，留痕口径）；候选 C 自绘 SVG 已被 D8 排除。倾向与取舍记入 P7.2。
   ⑥ 节点焦点环【尽力项·评估先行】：原型 = focus-visible 时 shape stroke 3px + halo 6px
     （L565-567）。canvas 无 focus 事件，结论依赖 ④。候选：键盘选中态用
     emphasis.itemStyle（borderWidth 3）+ halo 近似表达，走查对照度复核；文字清单行的
     焦点环走 CSS（现有 ui 焦点环 token，天然可达）。评估结论记入 P7.2。
   注：原型打印样式（L784-804）只覆盖 report 页，graph 页不扩展打印（留痕：无打印需求）。

-------------------------------------------------
五、实施步骤（批次划分与状态）
-------------------------------------------------
总顺序：P0→P6 已完成；本轮 P7；P8(/chat)→P9(T0 四页)→P10(T1 六页)→P11(门户+教师四页)→P12 照旧排队。

已完成批次状态表（hash 取自 git log，第 1/2 轮执行报告与审查报告背书）：
  [✔] P0 规范文档        commit 2fe4ba3　[✔] P1 组件库草案      commit 08b2d55
  [✔] P2 门禁期望重写     commit 0be67ee　[✔] P3 token/主题/字体 commit 7ee5dc6
  [✔] P4 外壳族+就地改造 commit dfa3623　[✔] P5 外壳切换+面板    commits f5d9aed + 5d0630d + 404e7bb
  [✔] P6 /report 首迁页  commits d050fcb + ddc6eca + 7935705 + a169874 + dcda2b9 + fa20d8e
      （P6.0 记账 / P6.1 M-1 token / P6.2 页面主体 / P6b 走查修复 / 走查产物 / 执行报告；
       第 2 轮审查 VERDICT PASS，L-1/L-2/L-3 留痕事项由本轮 D16–D18 认领。）

=================================================
P7 批次2：/graph 最难页（ECharts 改造）【检查点⑥】——本轮全部内容，拆 7 步，预计 3 个提交
=================================================

P7.0 记账入库（第 1 个提交，最先做）
    目的：把第 2 轮审查产物与本版计划入库，清偿工作区 _pipeline 未入库项。
    涉及（仅以下白名单，逐个显式 git add，禁 git add -A / git add .）：
      _pipeline/01_PLAN.md（第 9 版，本文件）
      _pipeline/archive/01_PLAN_20261011_1336.md（第 8 版归档件）
      _pipeline/03_REVIEW.md（reviewer 第 2 轮 PASS 报告，工作区 M）
      _pipeline/archive/03_REVIEW_20261011_1319.md（其归档件，untracked）
    做什么：仅提交上述文件；不改任何代码。
    预计影响：无代码影响；git status 中 _pipeline 相关未入库项清零
      （PR-tempdeploy.md 是他人产物，不碰）。
    测试命令：
      git --no-pager diff --name-only HEAD -- _pipeline ; echo "exit=$?"   # 提交后期望空输出
    commit 草稿：「style10记账: 01_PLAN 第9版(P7 细化+D8 六项分派+L-1/L-2/L-3/D19 认领裁决)
      +第8版归档+第2轮审查报告入库」

P7.1 认领清偿：L-1 token 消费 + L-2 注释更新（第 2 个提交）
    目的：清偿第 2 轮审查 L-1（token 无消费的漂移藏身处）与 L-2（陈旧注释误导）。
    涉及：
      · apps/web/src/components/blueprint/Sheet.tsx（SHEET_PADDING 常量 base 档
        pb-2.5 → pb-pad-frame-sm-b 一处；文件头注释块同步说明，见 D16）
      · apps/web/tests/breakpoints.test.ts（仅文件头「合法保留」白名单注释改写，
        断言与扫描逻辑零改动，见 D17）
    准备修改的函数/模块：Sheet.tsx 的 SHEET_PADDING 常量（L144 一行）+ 注释块；
      breakpoints.test.ts L28-34 注释段。
    预计影响：全站 Sheet sm 档底边距值不变（10px 同值替换），零视觉变化；
      产物 CSS 从 pb-2.5{padding-bottom:.625rem} 变为 pb-pad-frame-sm-b{padding-bottom:10px}。
    测试命令（独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/tokens.test.ts
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/breakpoints.test.ts
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p7a
      grep -o 'pb-pad-frame-sm-b{padding-bottom:10px}' /tmp/zhiwei-web-build-p7a/assets/*.css ; echo "exit=$?"
      3.2 冻结区检查命令
    commit 草稿：「style10P7a: 认领清偿——L-1 Sheet base 档底边距改消费 pad-frame-sm-b
      token(10px 同值, 四 token 全有消费) + L-2 breakpoints.test 陈旧注释更新(断言零改)」

P7.2 D8 ④⑤⑥ 评估先行（不提交，产出评估记录并入执行报告）
    目的：键盘操作 / 描边入场 / 节点焦点环三项在动手前先定可行性与选型（D20），
      避免实现中途反复；结论决定 P7.3 的实现范围与留痕口径。
    做什么（纯评估，不改代码、不提交；候选方案与判据见 D20④⑤⑥）：
      a) 键盘操作：按候选 A（画布级 keydown → setOption zoom/center）+ 候选 B（节点级走
         文字清单 + 可选 Enter 选中中心最近节点）逐项评估，含包体影响
         （$NODE $WS/node_modules/vite/bin/vite.js build 后看 graph chunk 体积变化预估）；
      b) 800ms 描边入场：按候选 A（不做，点火承担 + 留痕差距）/ 候选 B（lineStyle 渐入，
         留痕「近似而非描边」）二选一并写明理由；
      c) 节点焦点环：随 a) 结论联动（emphasis.itemStyle + halo 近似 / 文字清单 CSS 焦点环）。
    产出：执行报告「D8 评估记录」一节，逐项写「选型 / 理由 / 预计影响 / 是否留痕差距」；
      P7.3 严格按结论实现，超范围留痕。
    测试命令：无（纯评估步骤；如需跑 build 预估包体，用 P7.1 的 /tmp 等价口径）。

P7.3 /graph 视觉层重写（第 3 个提交，主体；P7.4 测试并入本提交）
    目的：按原型 PAGES.graph（L2793-2908）逐段复现，D8 六项按 D20 分派落地；
      业务逻辑一行不改（红线见 3.1 追加项）。
    涉及：
      · apps/web/src/pages/GraphPage.tsx（视觉层重写；取数/守卫/派生/点火/poster/键盘
        语义冻结，见 3.1c/3.1d）
      · apps/web/src/components/Layout.tsx（PAGE_OWNED_HEAD 登记 '/graph'，D19，仅一行改动）
      · apps/web/src/lib/graphSymbol.ts（新增：四档+未解锁形状 path 纯函数，转写原型
        L2784-2792；同时供图例复用）
      · apps/web/src/index.css（图谱画布区制式类：gcanvas-wrap 容器（边框 1px/圆角 var(r)/
        overflow:hidden 口径 L547）、工具条（右侧竖排 L571）、图例底条（border-top 分隔
        L572）、窄屏降级 note；命名与挂法遵循既有 blueprint 制式与 D14 纪律）
      · apps/web/src/components/BandLegend.tsx（仅当 P4 版未达「形状+色+文字」三重图例时
        微调；已达标则不动并在执行报告留痕核对结论）
      · apps/web/tests/graphSymbol.test.ts（新增，见 P7.4）
    逐段复现清单（对照原型行号；SheetHead/SheetBlock/EmptyState/Stamp/bp-tbl 用 P6 已定型件）：
      ① 页头（有证据 L2865 / 空图谱 L2854，双分支）：SheetHead——eyebrow 'KNOWLEDGE GRAPH /
        先修链全景'、SHEET 10-11、需求 2.11、h1 有证据态「知识图谱 · 也是学习路径页」/
        空态「知识图谱：现在是空的」、sub 用现有描述文案口径（D5：现有「颜色是掌握度…」
        语义保留，原型 mock welcome 不采纳）、chip 'T0 · 三重编码'（cyan）；PAGE_OWNED_HEAD
        登记（D19）。
      ② 01 证据统计（L2867-2870）：四格 measure（总证据 evidence_total / 本周新点亮
        newly_mastered_7d / 覆盖进度 covered_kp/total_kp / 章节通关 complete 章数）——
        数据全部来自既有 summary/badges，不新增请求；「本周点亮」WeekCount 随点火爬升 +
        badge-pop 尾注机制保留（冻结）。
      ③ 02 画布（L2871-2889）：gcanvas-wrap 制式容器 + 工具条四钮（放大/缩小/复位/导出海报，
        IconButton + zoomin/zoomout/target/download 图标；海报按钮链路冻结不动）+ ECharts
        画布（roam 保留）+ 窄屏（sm/md 档）降级说明 note「画布保留，完整可读的表格在
        下一节」+ 图例底条（BandLegend）+ 底部 row（缩放倍数 tok / 拖拽平移提示 chip /
        路径高亮 chip「路径已高亮 · N 段」/「未带入路径」态 / 导出海报 btn）；原型
        「模拟从报告带入路径」演示按钮不复现（D5 口径留痕）。
      ④ 画布内节点/边视觉（L2802-2831 生成逻辑 + L550-573 CSS）：
        形状=四档 symbol + 未解锁方形 + 未接触虚线空心圆（D20①）；
        节点三文本=编号（上，num-mono 9.5px 口径）/ 百分数（环内 inside）/ 名称（下 11px），
        小字配色遵守 D20②；ECharts label 多段文本的能力边界（position/formatter 组合）
        在实现中取舍并留痕；
        低置信=原型内环虚线（L2813）若 ECharts 单 symbol 无法双 path，则以 borderType
        dashed + 详情面板/图例「低置信」标注补偿，留痕；
        边=hl 段加粗 accent 色、done 段（两端已掌握）四档色加粗 +「已打通」角标
        （ECharts edge label 可承担则做，否则详情面板体现，留痕）；箭头 edgeSymbol 保留；
        路径高亮时其余节点/边降透明（DIM_OPACITY 机制冻结）；
        点火动画机制冻结（animationDuration/Delay 与本周点亮联动不动）；主题重绘不重播
        机制冻结（D20③）。
      ⑤ 03 节点详情 + 04 为什么是这张图（L2890-2906）：split 双栏（annos 档以上）；
        详情 panel = kv 清单（章节/难度/掌握度与档位 bandTag/证据条数/低置信来源/
        先修链 num-mono）+ 掌握度条 bar + actions（去攻克/分步练一道/薄弱复测 CTA——
        navigate 语义冻结）+ hint「详情面板随选中节点更新」；已掌握对勾 SuccessMark 保留；
        aside 04 = 分层排布说明（先修深度越靠左越浅）+ tick-list 口径四条
        （掌握度 0–1 四档阈值固定 / 未接触 vs 未解锁 / 低置信=试卷估计 / 边数统计）。
      ⑥ 05 非图形文字版清单（L2841-2851 + L2907）：bp-tbl 细网格表**全档常在**（替换现有
        details 折叠——D8 已拍板的新需求）：列=知识点（num-mono 编号 + 名称 + 低置信 chip）/
        章节 / 掌握度（无数据走「尚无可用的数」tok 口径，现有语义）/ 档位 bandTag / 证据 /
        先修链（num-mono 12px，'无先修' 口径）；行可点开同一张详情卡（键盘回车保留现有语义，
        3.1c 冻结）；行选中态用 inset 边线表达（对应原型 box-shadow:inset 2px cyan）；
        md/sm 档转卡片（bp-tbl 既有 data-label 制式，P6 已定型）。
      ⑦ 空态分支（L2852-2859）：!hasAnyEvidence → 空态版页头（D19 同登记）+ 01 空状态
        emptyBox（现有三条冷启动出路文案与链接：拍试卷/自报/做题——对应原型
        emptyStates.noEvidence）+ 02 口径图例；不放示例节点（现有纪律同源）。
    四态落点（规范 §7 graph 行）：
      · loading → SkeletonLines（替换 PageSkeleton 引用；组件保留供未迁移页）；
      · error → 现状为 toast + 空态；是否落 Stamp 红章由 P7.2 评估后决定（若做，按 D15c
        同口径最小新增、插 loading 之后数据态之前，留痕；若不做，现状行为保留并留痕）；
      · 无空间（!activeSpaceId）→ 虚线空盒 EmptyState「还没有选中的学习空间」+ 去选空间
        按钮（现有文案，D5）；
      · 无数据 → ⑦ 空态分支。
    375 档纪律（D14 精神）：画布区不引入页面级横向溢出——现有容器
      minWidth: Math.max(720, layout.width+200) 内联 style 属数据驱动几何，本轮评估是否
      改走「画布内缩放（series zoom 初始 fit）+ 窄屏分层清单降级」以消除横滚；
      目标：audit-style10-375.json 中 /graph overflowPx = 0（硬判据，同 F-01 口径）。
    预计影响：/graph 成为本轮唯一迁移页；PAGE_OWNED_HEAD 登记后 /graph 不再吃外壳通用
      页头（单 h1）；未迁移页零影响（P7.1 token 同值替换无视觉变化）。
    测试命令（5.1 通用规程全套，独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p7
      3.2 冻结区检查命令（含区间口径两条）
      6.3 静态纪律四条（该页零一次性样式抽查改为 GraphPage.tsx）
    commit 草稿：「style10批2: /graph 知识图谱——四档形状三重编码(path symbol+图例)+
      证据统计四格+画布工具条与图例制式+节点详情双栏+文字版清单全档常在(非折叠)+
      空态分支；D8④⑤⑥按评估结论落地/留痕；PAGE_OWNED_HEAD 登记；业务逻辑零改动」

P7.4 测试收口（并入 P7.3 提交）
    目的：按 3.3 口径收口，不留测试债。
    做什么：
      · graphMastery.test.ts / graphSnapshot.test.ts 零改动（冻结区行为证据，全绿即未破坏）；
        graphLayout.ts / poster.ts 零改动（无专属测试文件，布局/海报行为由走查复核）。
      · 该页相关既有纯逻辑测试改期望：预计 0 个（format/kpName/useCountUp/reveal/phrases
        全部不动）。
      · 唯一新增 = apps/web/tests/graphSymbol.test.ts（形状 path 纯函数断言：菱形 4 顶点 /
        五边形 5 顶点 / 六边形 6 顶点 / 圆含 arc / 未解锁方形 4 角；只增不减）。
      · /graph 不引渲染测试（沿用纪律），四态与版式由走查验收。
    测试命令：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests        # 208+ 用例全绿，只增不减
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests

P7.5 走查（双主题 × 4 档 1440/1024/768/375 + 专项取证）
    目的：检查点⑥截图验收物 + 375 档 overflowPx=0 硬判据 + D8 六项取证。
    做什么：起服务（6.2 两条后台命令）后按 8 条分档命令跑（每条 = 1 档 × 1 主题，防 60s；
      命令须带 ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10，
      第 2 轮 D19 教训）；产物只增不删。复核点：
      a) /graph 逐段结构与原型对照（①–⑦）；
      b) 全档全页 overflowPx=0；375 档 /graph overflowPx=0（硬判据）；
      c) 四态取证：无数据态**复用 e2e 账号已有空空间**（D18，不再新建）；loading/error
         按 P6 探针模式（tools/probe-report-states.cjs 属基建可改，或新增
         tools/probe-graph-states.cjs，命名与只取证纪律同 P6 D21，遵守 D18 约定）；
      d) 键盘操作/焦点环按 P7.2 评估结论取证（探针 CDP 注入 keydown 或人工留痕说明）；
      e) 主题切换重绘不重播取证：切主题前后同空间截图对照（节点位置不变、点火不重播）；
      f) reduced-motion（系统偏好 + 手动开关）下点火/描边类动效降级取证。
    测试命令：
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      # 硬判据：
      grep -A2 '"/graph"' _pipeline/screenshots/style10/audit-style10-375.json   # overflowPx 应为 0

P7.6 交付物三件套与停点
    a) 双主题截图（4 档 × 2 主题 × 11 路由）+ 四态与专项取证图；
    b) 变更说明：原型段落复现清单（①–⑦ 逐段勾稽）+ D8 六项分派结果逐项留痕
       （做了/没做/差距/原因，禁伪造）+ 接回清单（海报链路/键盘语义/点火机制/文案口径）
       + 测试改动清单（breakpoints 注释 / graphSymbol 新增）+ D16–D20 逐条留痕；
    c) vitest/tsc/build 输出摘录（build 用 /tmp 等价口径并留痕）。
    交付后停，交 reviewer 按检查点⑥口径 VERDICT 把关。

P8 批次3：/chat【检查点⑦】、P9 批次4：T0 四页、P10 批次5：T1 六页、P11 批次6：门户+教师四页、
    P12 收尾 —— 照第 7 版原文执行（见 _pipeline/archive/01_PLAN_20261011_1239.md「五、」）。

5.1 页面批次通用规程（P6~P11 每页必走六步，照旧）：
    ① 页面结构/视觉/交互按原型　② 业务逻辑按现有　③ 原型缺的能力接回（规范 §11 清单勾稽）
    ④ 所有视觉走组件库（页面零一次性样式）　⑤ 测试按新意图改期望（不删断言）
    ⑥ 单页单提交并停（三件套齐备后交 reviewer）

-------------------------------------------------
六、测试与走查命令集（全部原样可执行）
-------------------------------------------------
6.1 每批必跑命令组（各自独立一条，勿合并防 60s 被杀）：
      # 类型检查三段
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      # 测试三批
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      # 前端构建（等价口径，规避沙箱删除闸门）
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p7
      # 冻结区（期望空输出；工作区口径 + 区间口径各两条，见 3.2）
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
6.2 真浏览器走查（复用既有基建；P7 命令见 P7.5，档位 = 4 档 × 双主题）：
      # 起服务（两条后台，可存活）
      $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
      $NODE functions/api/dist/server.js            # 后台 :8787
      $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts   # 后台 :5173
      # 工具 tools/responsive-audit.cjs（基建可改，业务代码不可改）；产物只增不删
6.3 静态纪律复核（每页面批次收尾跑，期望无匹配行）：
      grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src ; echo "exit=$?"   # 任意值断点禁令
      grep -rn "z-\[" apps/web/src ; echo "exit=$?"
      grep -rn "fonts.googleapis\|fonts.gstatic" apps/web ; echo "exit=$?"  # 禁 CDN
      # 该页零一次性样式抽查（无裸 hex className / 无 min-w-[ 类；画布尺寸内联 style
      # 属数据驱动几何，允许，同 P6 条形宽度口径）：
      grep -n -E "className=\"[^\"]*#[0-9a-fA-F]{3,8}|min-w-\[" apps/web/src/pages/GraphPage.tsx ; echo "exit=$?"
6.4 走查超时预案：单档多路由 ×（导航 0.7s + 采样）贴近 60s 上限；被杀则单宽度 × 单主题逐条跑。

-------------------------------------------------
七、风险与回滚
-------------------------------------------------
R1【高·规模】照旧：批次严格线性、单批独立提交可独立回滚；总控按批次拆多轮
   （当前进度：P0–P6 已结案，本轮 P7，其后 P8 单独成轮）。
R2（门禁中间红）/ R3（外壳切换）—— 已结案。
R4【高·ECharts 还原度】本轮主险，缓解三件套：
   a) D8/D20 分派：三项执行项有明确锚点（原型行号 + CSS 行号），三项尽力项评估先行
      （P7.2）+「做不到则逐项留痕」验收口径，禁止静默缩水与伪造；
   b) 走查 8 组合 + 专项取证（键盘/主题切换/reduced-motion）覆盖 D8 各项；
   c) 冻结区（3.1 追加 a–d）保证最坏情况下数据链路与六态语义零回归，回滚仅还原表现层。
R5~R10 照旧（R10 适用于规范侧；本轮预计无规范改动）。
R11（M-1 全站波及）—— P6 已验（8 组合 0px），本轮 P7.1 同值替换零增量风险。
R12【中·四态取证依赖后端】照旧：error 态探针注入（R12 预案）；无空间态可能与 /report
   同样无导航取证路径（guardPath 重定向）——取不到则留痕说明取证方式，不伪造（P6 已有先例）。
R13【低·L-1 消费波及】pb-pad-frame-sm-b 替换是 10px 同值替换，全站 sm 档零视觉变化；
   提交独立（P7.1），可单独 revert。
R14【中·键盘/焦点环方案不稳】若 P7.2 评估选型在实现中推翻（如 setOption zoom/center
   与 roam 冲突），允许降级到「文字清单为键盘主路径 + 画布容器基础可达」并在执行报告
   留痕差距；不为此引入 e2e 测试栈或改冻结区。
回滚总原则：本轮 3 个计划内提交各自独立 revert（P7.0 记账 → P7.1 清偿 → P7.3 页面）；
   P7.3 与 P7.1 无类名依赖，可独立回滚；走查修复/产物若追加提交（P6 D17 惯例），
   同样独立 revert；_pipeline/archive/ 与 _pipeline/screenshots/ 产物只增不删。

-------------------------------------------------
八、批次依赖与执行顺序总表（更新至第 9 版）
-------------------------------------------------
P0✔ → P1✔ → P2✔ → P3✔ → P4✔ → P5✔ → P6✔（以上 hash 见「五、」状态表）
  → P7（本轮：P7.0 记账 → P7.1 L-1/L-2 清偿 → P7.2 D8 评估 → P7.3/P7.4 /graph 重写+测试
        → P7.5 走查 → P7.6 停点）
  → P8(/chat，单独成轮) → P9(T0 四页) → P10(T1 六页) → P11(门户+教师) → P12(收尾)
本轮提交数：计划内 3（记账 1 + 清偿 1 + 页面含测试 1）；走查修复/走查产物按 P6 惯例
  允许追加独立提交（执行报告留痕，同第 2 轮 D17 口径）。

-------------------------------------------------
九、收尾数字与计划自查记录
-------------------------------------------------
本轮涉及文件（全量清单）：
  新增：_pipeline/archive/01_PLAN_20261011_1336.md（已归档）、apps/web/src/lib/graphSymbol.ts、
    apps/web/tests/graphSymbol.test.ts、_pipeline/screenshots/style10/ 走查新产物、
    （可选）tools/probe-graph-states.cjs（若新增，基建可改范围）
  修改：apps/web/src/components/blueprint/Sheet.tsx（L-1 一处类名 + 注释）、
    apps/web/tests/breakpoints.test.ts（L-2 仅注释）、apps/web/src/pages/GraphPage.tsx、
    apps/web/src/components/Layout.tsx（PAGE_OWNED_HEAD 一行）、apps/web/src/index.css
    （图谱画布区制式）、（视评估）apps/web/src/components/BandLegend.tsx
  冻结不碰：router.tsx、api/ 全部、stores/ 全部、lib/graphLayout.ts、lib/graphMastery.ts、
    data/graphSnapshot.ts、lib/poster.ts、packages/engine、functions/、data/、四份契约文档
预计测试改动：breakpoints.test.ts 仅注释（断言零改）；新增 graphSymbol.test.ts（只增）；
  其余 0 个文件改期望；用例总数 453 起步只增不减。
计划自查（planner 2026-10-11 13:36 完成）：
  · 每步具体性：P7 拆 7 步（P7.0–P7.6），各有目的/文件/做法/影响/命令/commit 草稿 —— 是
  · 文件路径明确：全部绝对路径或仓库相对路径，原型行号仅作视觉依据锚点 —— 是
  · 测试命令可运行：全部沿用第 1/2 轮实测过的 $NODE/$WS 形态（含 ZHIWEI_AUDIT_OUT 补正）—— 是
  · 避免修改业务代码：P7.3 限表现层（3.1 追加红线 a–d），冻结区 3.2 逐批把关 —— 是
  · 检查点映射：⑥ 对应 P7 产物三件套 + D8 六项留痕口径 —— 是
  · 歧义裁决留痕：D16（L-1 消费）/ D17（L-2 注释）/ D18（L-3 取证约定）/ D19（页头归属）/
    D20（D8 六项分派）—— 是
  · 认领完整：第 2 轮 L-1/L-2/L-3/INFO-1 四项均有裁决与落地步骤 —— 是
  · 范围边界：仅 P7，P8 起不在本轮 —— 是
