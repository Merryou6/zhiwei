知微 · style-10「青蓝蓝图」全站视觉迁移实施计划
=================================================
计划编号：01_PLAN（第 10 版：P7 结案 + 第 3 轮认领清偿 + P8–P12 全量细化版，
      对应需求《tempui/STYLE-10-迁移计划.md》定稿 2026-10-10）
编写日期：2026-10-11 14:58（本机时间）
编写角色：planner（只读规划，implementer 严格照办；执行歧义按「四、决策记录」D 编号裁决，
      不向总控提问）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
基线：git HEAD = bf3c7fe（tempui-doc 分支，rev-list --count HEAD = 197）。
      P0–P7 八批全部入库结案：P0–P5 共九个提交 2fe4ba3→e96c702，P6 六个
      d050fcb→fa20d8e，P7 六个 32aaec1(P7.0 记账) → 22d5628(P7.1 清偿) → fd1b2bb(P7.3
      /graph 主体) → 12acf95(P7b 走查修复) → 5069782(P7 走查产物) → bf3c7fe(第 3 轮报告)。
      第 1、2、3 轮审查 VERDICT 均 PASS（_pipeline/03_REVIEW.md 现为第 3 轮版，工作区 M）。
      工作区他人未提交变更（一律不碰、不回退、不纳入代码提交，仅记账提交按白名单入库）：
      M _pipeline/03_REVIEW.md（reviewer 第 3 轮 PASS 报告，本轮 P8.0 入库）、
      D tempui/纯前端需求文档.md、?? tempui/STYLE-10-迁移分析.md、?? tempui/STYLE-10-迁移计划.md、
      ?? tempui/prototypes/、?? tempui/qa-report.json、?? _pipeline/PR-tempdeploy.md、?? .workbuddy/、
      ?? node_modules/、?? package-lock.json、?? _pipeline/archive/03_REVIEW_20261011_1447.md
      （reviewer 第 3 轮归档件，untracked，本轮 P8.0 一并入库）、
      ?? _pipeline/archive/01_PLAN_20261011_1458.md（本次归档，P8.0 入库）。
      唯一视觉依据 = tempui/prototypes/style-10/index.html（4113 行；本轮用锚点：
      portal L1855-1911 / login L1912-1974 / cold-start L1974-1999 / self-report L1999-2040 /
      spaces L2040-2107 / assess L2107-2213 / paper L2213-2348 / practice L2348-2523 /
      chat L2523-2604 / attribution L2604-2760 / library L2990-3028 / profile L3028-3120 /
      teacher L3120-3177 / teacher/student L3177-3246 / teacher/recommendations L3246-3305；
      ROUTES 图号-需求登记表 L1304-1320；视觉参考规范 tempui/STYLE-10-设计系统规范.md
      第 10 章 17 页要素表 + 第 11 章接线清单）。
归档：旧版 01_PLAN.md（第 9 版：P7 细化版，499 行）已先复制归档为
      _pipeline/archive/01_PLAN_20261011_1458.md（md5 5ec47167aec1939fe68508e805afffa9
      两侧一致，归档只增不删），然后才覆写本文件。更早归档链见 _pipeline/archive/（只增不删）。
本轮范围边界（总控拍板，不再提问）：一轮完成全部剩余任务 = 第 3 轮认领清偿（M-1/L-1/
      INFO-1/INFO-2）→ P8(/chat) → P9(T0 四页) → P10(T1 六页) → P11(门户+教师 3 页+
      TeacherShell) → P12(收尾)。17 页逐页单提交红线不放松；批次顺序与页序照第 7/9 版，
      不得乱序。中途任何原因中断，按 D25 快照判据续完，不推倒重做。
无阻塞项。

环境常量（本计划全部命令使用，展开即完整路径）：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  工作目录：cd /Users/Merryou/LearnBuddy/zhiwei
  ⚠ 本机单条命令约 60 秒被 SIGKILL：vitest 一律分批；git diff 一律全局选项前置
    （git --no-pager diff）；dev server / 后端可 run_in_background 存活；走查按宽度/主题分档跑。
  ⚠ 沙箱批量删除闸门：原地 vite build 会因清空 dist/assets 被拦。build 一律采用等价口径
    --outDir /tmp/zhiwei-web-build-<批次名>（第 1 轮 L-1 留痕）。
测试基准数字（第 3 轮报告实测口径）：全仓 vitest 43 文件 462 用例
  （apps/web 22 文件 217 / packages 2 文件 43 / functions/api 19 文件 202）。
  apps/web/tests 22 文件（视觉门禁 = tokens 23 + bands 12 + breakpoints 9 + themeStore 9 +
  blueprint 7 + graphSymbol 9）。本轮各页结束用例总数只增不减。

-------------------------------------------------
一、目标与验收清单（逐条可勾选；★ = 本轮范围）
-------------------------------------------------
[✔] 2.【检查点①】设计系统规范 12 章零 React 代码（2fe4ba3）。
[✔] 3.【检查点②】组件库草案三节齐备（08b2d55）。
[✔] 4.【检查点③】三门禁 + themeStore 期望重写全绿（0be67ee / 7ee5dc6）。
[✔] 5. 双主题 token 体系落地（7ee5dc6）。
[✔] 6. 主题默认「跟随系统、优先白图」（7ee5dc6）。
[✔] 7. 字体自托管三族（7ee5dc6）。
[✔] 8.【检查点④】制图板外壳 + ChatPanel 三形态 + tabbar + 抽屉（f5d9aed+5d0630d+404e7bb）。
[✔] 9.【检查点⑤】/report 五节制式 + 四态 + 打印（P6 六提交 d050fcb→fa20d8e）。
[✔] 10.【检查点⑥】/graph 四档形状三重编码 + D8 六项分派留痕（P7 六提交
       32aaec1→bf3c7fe；462 用例全绿；第 3 轮 PASS）。
[✔] 11. 一行不动红线（P0–P7 全程成立）。
[★] 12.【第 3 轮认领清偿】M-1 画布标签叠压修复 + L-1 缩放下限口径统一（P8.1）+
       INFO-1 D18 空间基数 2→3 修正（D23，本版回写）+ INFO-2 PAGE_OWNED_HEAD 逐页预判
       （D24 登记表，P8 起逐页落地）。
[★] 13.【检查点⑦】P8 /chat：SSE 真流式接回 + 全屏页与常驻面板同构 + D4 双栏档位。
[★] 14.【检查点⑧~⑪】P9 T0 四页：/assessment → /practice → /paper → /attribution，
       含试卷识别刷新回显与错题缓存接回勾稽（规范第 11 章 #3）。
[★] 15.【检查点⑫~⑰】P10 T1 六页：/spaces → /start → /self-report → /login → /me →
       /drive，含登录真实链路接回（规范第 11 章 #6）。
[★] 16.【检查点⑱~㉑】P11 门户 /（拍板④ + D6）→ /t → /t/student/:studentId →
       /t/recommendations + TeacherShell 视觉迁移；教师 403 兜底不动。
[★] 17.【收尾】P12：nav 断点清退评估（D26 判据）、冻结区终检、全站走查汇总、
       LOOKATME/README 实测数字更新、执行报告。
[★] 18. 全程：单页单提交（可独立回滚）、冻结区零改动、用例只增不减、每页 PAGE_OWNED_HEAD
       预判落地无双 h1。

-------------------------------------------------
二、检查点映射（原计划检查点 → 本流水线产物 → 把关口径）
-------------------------------------------------
检查点①~⑥已由第 1/2/3 轮 reviewer VERDICT=PASS 把关结案（见 _pipeline/03_REVIEW.md 及归档）。
本轮：
  检查点⑦（/chat）      → P8 单页提交三件套 + sse/client/chatPanel/dialogStore 全绿。
  检查点⑧~⑪（T0 四页） → P9 各页单提交三件套（T0 页 4 档含 375 走查）+ 接线勾稽表。
  检查点⑫~⑰（T1 六页） → P10 各页单提交三件套 + routerGuard/authStore 全绿。
  检查点⑱~㉑（门户+教师）→ P11 四提交三件套 + 403 兜底不动取证。
  P12 收尾               → 全站走查汇总 + 冻结区终检 + 文档实测数字更新 + 执行报告。
把关口径（reviewer 参照）：①每页冻结语义零改动（3.1 追加红线逐页扩展）；②PAGE_OWNED_HEAD
  预判与登记一致、无双 h1；③接线勾稽逐项打勾（规范第 11 章）；④四态落点按规范 §7 逐页行；
  ⑤overflowPx=0（全档全页）；⑥用例只增不减；⑦M-1/L-1 清偿有前后对照取证（OBS-2）。

-------------------------------------------------
三、一行不动清单（冻结区红线）与逐批检查命令
-------------------------------------------------
3.1 冻结区（全程不碰，每批提交前用 3.2 命令复核）：
  · apps/web/src/router.tsx 全文件（ROUTES / STORAGE_KEYS / guardPath 原样；
    routerGuard.test.ts 锁定）
  · apps/web/src/stores/*（9 个）对外行为与落盘键 zhiwei_* 不变（auth 双写双清、
    chatPanel 不落盘、mobileNav 与 chatPanel 互斥、assessment/attribution/dialog/space/
    ui 行为不变）
  · apps/web/src/api/{client,sse,endpoints,types}.ts + components/chat/useChatSend.ts
    （三级降级链、401 副作用、36 接口映射、SSE 六事件原样——P8 关键冻结件）
  · packages/engine、functions/、data/、四份冻结契约（API_CONTRACT / ALGORITHM /
    DATA_SCHEMA / PRD）
  · theme/bands.ts 档名与阈值不变
  · 服务端教师 403 兜底（functions/api/src/services/teacher.ts requireTeacher）——P11 关键
  · P6 追加红线（ReportPage 冻结项）、P7 追加红线（GraphPage 及 graphLayout/graphMastery/
    graphSnapshot/poster 全文件冻结）继续全程有效。
  · P8 起逐页追加红线（各页通用条款，页特定条款见「五、」各页步骤）：
    a) 各页取数 useEffect（接口调用、cancelled 清理、依赖数组）逐字符不改；
    b) 守卫分支顺序不变（error 若需落红章，按 D15c 同口径插 loading 之后、数据态之前，留痕）；
    c) 各页业务语义不改：状态机（assessment 三阶段 / attribution 四步向导 / practice 分步
       批改 / paper 识别确认流转 / login 提交与演示账号 / spaces 409 与新建 / chat 发送与
       降级链 / teacher 下发与邀请码链路）、navigate 语义、既有文案常量（phrases 锁定项）；
    d) 视觉层重写不得引入新依赖、不得改包体结构（echarts 懒加载 chunk 保持）。
3.2 逐批检查命令（每批提交前跑，期望均为空输出）：
      cd /Users/Merryou/LearnBuddy/zhiwei
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
      # 区间口径（收尾与 reviewer 用，bf3c7fe 为本轮起点）：
      git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/stores apps/web/src/lib/graphLayout.ts apps/web/src/lib/graphMastery.ts apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts
  行为证据：routerGuard / sse / client / chatPanel / mobileNav / dialogStore / graphMastery /
  graphSnapshot / reveal / phrases / stages / authStore 这些测试文件本身不改，全绿即冻结区
  未被破坏。
3.3 测试改动口径（红线：重写期望不删断言、用例只增不减）：
  · 本轮预计改动的既有测试文件：预计 0 个（14 页均为表现层重写，纯逻辑层不动；phrases/
    routerGuard/sse/client/chatPanel/dialogStore/authStore 等 20 个既有测试文件全部不动、
    全绿即证据）。若某页实现确需改期望（如 Layout 装配相关 blueprint/breakpoints 既有断言
    受 PAGE_OWNED_HEAD 扩表影响），必须逐条在变更说明留痕且不删断言。
  · 允许新增（只增）：各页如抽出纯函数（类似 graphSymbol）可配套新测试文件；无则不强求。
  · 用例总数 462 起步只增不减。

-------------------------------------------------
四、决策记录（D1–D20 保留照旧，见 _pipeline/archive/01_PLAN_20261011_1458.md「四、」
    要点索引；本版新增 D21–D26）
-------------------------------------------------
D1–D15 照旧（断点/主题/ChatPanel 落位/文案/落地页/胶囊/ECharts/冲突裁决/四态/原型不足/
    图标/pad-frame/P6 细则）；D16–D20 已落地结案（token 消费/注释清偿/D18 空间约定/
    D19 页头登记/D8 六项分派）。要点：D4（ChatPage 双栏档位改挂 900/1180）P8 适用；
    D5（phrases 锁定文案不动）全程适用；D6（落地页保留叙事+逐字动画，视觉换蓝图）P11 适用；
    D9（规范冲突以原型为准、只增留痕修订）全程适用；D14（375 档 grid 子项 min-w-0 纪律）
    全程适用。
D21【M-1 认领裁决·planner 拍板】1440 档画布节点标签叠压修复，分层方案按序尝试、
   任一层收口即停并留痕：
   第一层（核实）：先实测核实 ECharts graph series 节点 label 的 width:96 +
     overflow:'truncate' 未生效原因（对照 ECharts 文档/源码或最小复现脚本放 /tmp，不入库）。
     若配置改法可达（如需配 labelLayout 或换 overflow 作用层级），按最小改动修复。
   第二层（若 truncate 确不可用）：series 级 labelLayout:{hideOverlap:true}（ECharts 内建
     避让，重叠标签自动隐藏）+ 视效果配合缩短标签（如超长章节名截断 N 字 + 省略号，
     完整名称由 05 文字清单/tooltip/详情卡承担——与 D8 拍板「文字编码多路径」一致）。
   第三层（兜底）：维持单行名称 + hideOverlap + 窄档 cw<700 不画标签现状（12acf95 已定），
     仅补 OBS-2 留痕。
   约束：不动冻结语义（点火/DIM_OPACITY/重绘机制/文字清单键盘语义）；修复后 375 档
     overflowPx=0 硬判据不回退；375 档「形状地图」取舍（OBS-1 已被第 3 轮接受）不推翻。
   取证：OBS-2 留痕 = 1440/1024 双主题修复前后对照图（sips 裁剪放大画布中部）+
     执行报告写明选型与差距。
D22【L-1 认领裁决·planner 拍板】缩放下限口径统一：GraphPage 常量 ZOOM_MIN 由 0.12 改
   0.3，与 12acf95 的 fitZoom 地板 0.3 同口径（键盘 +/- 与工具条缩放共用该常量，一处改），
   理由留痕「防节点成点」取舍一致性。若实现发现 0.3 以下仍有必要（如超大盘子图），则反向
   统一并留痕，禁止两口径并存。随 M-1 同一提交（P8.1）。
D23【INFO-1 认领裁决·planner 拍板】D18 空间基数修正：账号既有空空间基线由 2 修正为 3
   （初中数学 + 两个 P6 四态遗留，reviewer 实测）。本轮及以后走查/探针取证继续优先复用，
   新建空间计数以 3 为基数累计；若发现账号空空间数 ≠ 3，先查明来源再取证，禁止无感膨胀。
D24【INFO-2 认领裁决·planner 拍板】PAGE_OWNED_HEAD 预判登记表（P8 起逐页落地，吸取
   第 2/3 轮连续提示）：
   预判结论：原型 17 页全部自渲染 sheetHead/hero（锚点见「五、」各页步骤），故剩余 14 页
   预判全部「页面自有页头」，逐页迁入 Layout.tsx 的 PAGE_OWNED_HEAD 登记表
   （现为 Set(['/report','/graph'])，逐页扩表，每页恰好一行 + 注释）。
   动态路由特例：/t/student/:studentId 的 pathname 是运行时值，Set.has 精确匹配不命中——
   Layout.tsx 的判定改为「精确匹配 || 以 '/t/student/' 前缀匹配」的最小改法（一处、注释
   留痕），不做通配机制。
   登记表（本轮逐页填）：
     P8  /chat                    页面自有（原型 sheetHead L2535）
     P9  /assessment              页面自有（L2113）
     P9  /practice                页面自有（L2354）
     P9  /paper                   页面自有（L2218）
     P9  /attribution             页面自有（L2608）
     P10 /spaces                  页面自有（L2087）
     P10 /start                   页面自有（L1986）
     P10 /self-report             页面自有（L2018）
     P10 /login                   页面自有（L1951；登录页在外壳内渲染图纸制式）
     P10 /me                      页面自有（L3054）
     P10 /drive                   页面自有（L2994）
     P11 /                        页面自有 hero（L1881-1889；门户为 PUBLIC SHEET 制式，
                                   不套 SheetHead 件、自渲染 eyebrow/h1/lede/CTA）
     P11 /t                       页面自有（L3143）
     P11 /t/student/:studentId    页面自有（L3200；前缀匹配特例）
     P11 /t/recommendations       页面自有（L3266）
   每页走查复核点：页面顶部单 h1、无外壳通用页头残留（截图人工核对）。
D25【中断续完快照判据·planner 拍板】本轮范围大（清偿+14 页+收尾），任何时点中断后
   续完调用按以下五件证据判进度，不推倒重做：
   E1 代码：git log 含该页 commit hash（单页单提交）且工作区无该页未提交代码改动
      （git status 干净或改动经逐行复核属表现层续完，按 DEV-1 惯例独立提交）；
   E2 验证：vitest 三批全绿 + tsc 三段 exit 0 + build 等价口径成功（在续完时点复跑即可，
      不要求逐页留档全量输出；执行报告每页记一行结论）；
   E3 走查：该页所在批次档位的截图与审计 JSON 存在，且 mtime 晚于该页最后一次代码
      提交时间（新鲜度判据，同第 3 轮 DEV-2 口径）；
   E4 冻结区：3.2 双口径命令空输出；
   E5 记账：_pipeline/02_EXEC_REPORT.md「批次状态快照」表逐页一行
      （hash / 日期 / 状态 / 遗留），01_PLAN.md「五、」状态勾选同步。
   续完入口动作：先读本节 + 执行报告快照表 + git log 三者对齐，从第一个未完成页继续。
D26【nav 断点清退评估判据·planner 拍板（P12 执行）】：
   步骤：① grep 列出 apps/web/src 全部 nav:/max-nav: 用法及所在文件（命令见 P12.2）；
   ② 逐条分类：A 类 = 语义仍属「触控目标作用域」（D1 收窄口径，如 max-nav:min-h-9）→
   保留并留痕理由；B 类 = 引用组件/类所在页面已全部迁移、且新档（narrow/sheet/annos）
   有等价表达 → 换新档或删除，换档处须走查复核 375/768 档触控目标高度不回退；C 类 =
   死代码（无引用）→ 删除。
   判据：tailwind.config.js 的 nav:720 断点定义与 breakpoints.test 的 nav 断言保留不删
   （D1 口径「nav:720 保留，语义收窄」），本轮只清退「用法」不删「定义」；若最终 A 类
   为空且无任何 nav: 用法残留，才允许在留痕后评估删定义（预期不会发生，留痕即可）。
   产出：P12 执行报告「nav 断点清退评估」一节，逐条 A/B/C 分类 + 处置 + 复核证据。

-------------------------------------------------
五、实施步骤（批次划分与状态）
-------------------------------------------------
总顺序：P0–P7 已完成结案；本轮：P8.0 记账 → P8.1 第 3 轮认领清偿 → P8.2 /chat →
P9.1–P9.4（T0 四页串行）→ P10.1–P10.6（T1 六页串行）→ P11.1–P11.4（门户+教师串行）→
P12.1–P12.4（收尾）。页序照第 7/9 版，不得乱序；每页六步规程照旧（5.1）。

已完成批次状态表（hash 取自 git log，第 1/2/3 轮执行报告与审查报告背书）：
  [✔] P0 规范文档        commit 2fe4ba3　[✔] P1 组件库草案      commit 08b2d55
  [✔] P2 门禁期望重写     commit 0be67ee　[✔] P3 token/主题/字体 commit 7ee5dc6
  [✔] P4 外壳族+就地改造 commit dfa3623　[✔] P5 外壳切换+面板    commits f5d9aed+5d0630d+404e7bb
  [✔] P6 /report         commits d050fcb+ddc6eca+7935705+a169874+dcda2b9+fa20d8e
  [✔] P7 /graph          commits 32aaec1+22d5628+fd1b2bb+12acf95+5069782+bf3c7fe
      （P7.0 记账 / P7.1 L-1L-2 清偿 / P7.3 主体含测试 / P7b 走查修复 / 走查产物 /
       第 3 轮报告；第 3 轮审查 VERDICT PASS，M-1/L-1/INFO-1/INFO-2 由本轮 P8.1 认领。）

=================================================
P8.0 记账入库（第 1 个提交，最先做）
=================================================
    目的：把第 3 轮审查产物与本版计划入库，清偿工作区 _pipeline 未入库项。
    涉及（仅以下白名单，逐个显式 git add，禁 git add -A / git add .）：
      _pipeline/01_PLAN.md（第 10 版，本文件）
      _pipeline/archive/01_PLAN_20261011_1458.md（第 9 版归档件）
      _pipeline/03_REVIEW.md（reviewer 第 3 轮 PASS 报告，工作区 M）
      _pipeline/archive/03_REVIEW_20261011_1447.md（其归档件，untracked）
    做什么：仅提交上述 4 件；不改任何代码。
    预计影响：无代码影响；git status 中 _pipeline 相关未入库项清零
      （PR-tempdeploy.md、tempui/、.workbuddy/ 等是他人产物，不碰）。
    测试命令：
      git --no-pager diff --name-only HEAD -- _pipeline ; echo "exit=$?"   # 提交后期望空输出
    commit 草稿：「style10记账: 01_PLAN 第10版(清偿+P8–P12 全量细化+D21–D26 裁决)
      +第9版归档+第3轮审查报告入库」

=================================================
P8.1 第 3 轮认领清偿：M-1 标签叠压 + L-1 缩放口径（第 2 个提交，独立可 revert）
=================================================
    目的：清偿第 3 轮审查 M-1（1440/1024 档画布标签叠压成片不可读）与 L-1（ZOOM_MIN=0.12
      与 fit 地板 0.3 口径不自洽）。
    涉及：
      · apps/web/src/pages/GraphPage.tsx（label 配置与 ZOOM_MIN 常量，仅表现层）
      ·（视第一层核实需要）/tmp 最小复现脚本（不入库，DEV-4 惯例）
    准备修改的函数/模块：GraphPage label 配置块（width/overflow 或 labelLayout）+
      ZOOM_MIN 常量一处 + 相关注释。
    做什么：按 D21 分层方案（核实 → labelLayout:{hideOverlap:true} / 缩短标签 → 兜底留痕）
      + D22 口径统一（ZOOM_MIN 0.12 → 0.3，或反向统一并留痕，二选一禁止并存）。
      冻结语义零改动（3.1 P7 追加红线 a–d 全程有效）。
    预计影响：1440/1024 档画布标签恢复可读（或被避让隐藏，由文字清单/tooltip/详情卡承担）；
      375 档 OBS-1 取舍不推翻；全档 overflowPx=0 不回退。
    测试命令（独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p8a
      3.2 冻结区检查命令
      # 走查取证（OBS-2 前后对照；8 组合中至少 1440/1024 双主题重采 + 375 双主题复核）：
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      grep -A2 '"/graph"' _pipeline/screenshots/style10/audit-style10-375.json   # overflowPx 应为 0
      # 裁剪放大复核（M-1 取证）：修复前后画布中部对照
      sips -c 400 700 _pipeline/screenshots/style10/style10-1440-light-graph.png --out /tmp/m1-after.png
    commit 草稿：「style10P8a: 第3轮认领清偿——M-1 画布节点标签叠压修复(选型留痕:
      labelLayout hideOverlap/截断) + L-1 ZOOM_MIN 0.12→0.3 与 fit 地板口径统一;
      业务逻辑零改动」
    （走查产物若量大，按第 3 轮惯例可另起独立提交「style10P8走查: …」，执行报告留痕。）

=================================================
P8.2 批次3：/chat 全屏对话页【检查点⑦】（第 3 个提交，单页单提交）
=================================================
    目的：按原型 PAGES.chat（L2523-2604）复现全屏形态；SSE 真流式接回（接线清单 #1）+
      与常驻面板同构验证（#2）+ D4 双栏档位落地。
    涉及：
      · apps/web/src/pages/ChatPage.tsx（视觉层重写；发送/降级链/会话状态逻辑冻结）
      · apps/web/src/components/Layout.tsx（PAGE_OWNED_HEAD 登记 '/chat'，D24，一行+注释）
      ·（若需）apps/web/src/index.css（/chat 页制式类：消息气泡 stu/tutor/sys、推理折叠
        .prog、工具时间线、停滞出口、输入区制式；遵循 blueprint 命名纪律）
      · 对话七件套 components/chat/*（仅视觉随组件库，逻辑零改动——冻结区）
    逐段复现清单（对照原型行号；sheetHead/EmptyState/Stamp 用 P6/P7 已定型件）：
      ① 页头：sheetHead（L2535）eyebrow 'CHAT / 学长式引导'、SHEET 10-09、需求 2.9、
        h1 '对话辅导：卡在哪一步就聊哪一步'、sub 现有文案口径（D5：原型 mock 不采纳）；
        PAGE_OWNED_HEAD 登记（D24）。
      ② 01 会话设置区（模式 seg + 带入断点 note）：seg 分段选择制式；现有模式切换
        store 语义冻结。
      ③ 02 消息流：气泡三制式（学生/导师/系统）、推理折叠（.prog 口径 = ThoughtStream
        既有组件视觉）、工具时间线（ToolTimeline 视觉）、停滞出口（原型口径 = 停滞提示
        与出路；现有语义保留）。
      ④ 03 输入区：ChatComposer 视觉换刻度输入制式；发送/禁用/草稿保留语义冻结。
      ⑤ 双栏档位（D4）：≥1180 双栏（会话列表/消息流，若现有有此结构）/ 901-1179 与 ≤900
        单栏，切换阈值挂 annos/sheet 档（现有 min-[720px]→nav: 换新档，D14 纪律）。
    四态落点（规范 §7 chat 行，整页级）：
      loading → SkeletonLines；error → Stamp 红章 + 草稿保留提示（通道断开口径）；
      空集合（0 条消息）→ EmptyState 虚线空盒 + 现有开场引导文案（D5）；无空间 →
      guardPath 重定向（R19 取证口径）。
    接线勾稽（规范第 11 章，变更说明逐项打勾）：
      #1 SSE 真流式：六事件（phase/thought/tool/delta/meta/done）+ 三级降级链——
        useChatSend 零改动，sse.test/client.test 全绿为证据；
      #2 常驻面板同构：全屏页与 ChatPanel 共用七件套，跨路由保状态（chatPanel store
        冻结）；Esc/互斥行为不动；
      #5 守卫语义：guardPath 原样。
    测试改动口径：预计 0 个文件改期望；sse/client/chatPanel/dialogStore 单跑确认全绿。
    走查口径：常规页（4 档 1440/1024/768/375 × 双主题，沿用 P6/P7 全档口径）+ 专项：
      a) SSE 流式实拍（登录态发一条消息，流式过程与降级链触发各一张，探针模式）；
      b) 面板/全屏同构：同会话在 ChatPanel 与 /chat 间切换截图对照；
      c) 四态取证（无数据复用 D23 基线 3 空间之一；error/loading 探针注入）。
    测试命令（5.1 全套，独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p8
      3.2 冻结区检查命令
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/sse.test.ts apps/web/tests/client.test.ts
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/chatPanel.test.ts apps/web/tests/dialogStore.test.ts
      6.3 静态纪律四条（该页零一次性样式抽查改 ChatPage.tsx）
      # 走查 8 组合命令同 P8.1（6.2/6.4 口径）
    commit 草稿：「style10批3: /chat 全屏对话页——SSE 六事件真流式接回+三级降级链锚点
      全绿+与常驻面板同构验证+D4 双栏档位(1180/900)；七件套逻辑零改动」

=================================================
P9 批次4：T0 学习闭环四页（串行，每页单提交）【检查点⑧~⑪】
    页序：P9.1 /assessment → P9.2 /practice → P9.3 /paper → P9.4 /attribution（不得乱序）
    通用（四页共遵）：走查口径 = T0 页 4 档（1440/1024/768/375）× 双主题；
    5.1 六步规程全套；测试改动预计 0 文件（assessment/attribution store 冻结、phrases
    不动）；3.1 逐页追加红线（状态机/导航语义/取数冻结）逐页适用。
=================================================

P9.1 /assessment 测评页（第 4 个提交）
    原型锚点：PAGES.assess L2107-2213；sheetHead L2113 'ASSESS / 证据采集（静默通路）'、
      SHEET 10-06、需求 2.6。
    涉及：apps/web/src/pages/AssessmentPage.tsx（视觉层重写）+ Layout.tsx 登记
      '/assessment'（D24）+（视需）index.css 该页制式类。
    页头预判：页面自有（L2113 双分支若空态有变体则同 P7 双页头先例处理）。
    逐段复现：① STAGE1 选模式（seg 模式分段 + 随时可走出口）；② STAGE2 逐题作答
      （题干 panel + 符号键盘 + hbar 进度条）；③ STAGE3 结束反馈（L2151 静默纪律：
      不出现对错判定、不给答案解析——phrases 锁定文案照旧）。
    四态落点（规范 §7 assess 行，区域级）：题目 empty（本轮无题）→ EmptyState；
      error → Stamp 红章（区域级）。
    接线勾稽：#5 守卫语义（needSpace）；assessment store 冻结（3.1）。
    走查：T0 四档 × 双主题 + 四态取证（空题态用 D23 空间基线）。
    测试命令：5.1 全套 + 3.2 + 6.3（该页抽查 AssessmentPage.tsx）。
    commit 草稿：「style10批4-1: /assessment 测评——三阶段制式(选模式/逐题作答/静默结束
      反馈)+符号键盘+hbar 进度+区域级四态；状态机与静默纪律零改动」

P9.2 /practice 专项练习页（第 5 个提交）
    原型锚点：PAGES.practice L2348-2523；sheetHead L2354 'PRACTICE / 分步书写（明判
      通路）'、SHEET 10-08、需求 2.8。
    涉及：apps/web/src/pages/PracticePage.tsx + Layout.tsx 登记 '/practice' +
      （视需）index.css。
    页头预判：页面自有（L2354）。
    逐段复现：① 章节与阶梯（ladder）；② 概念卡（默认收起）；③ 分步作答（steps 步骤卡
      data-verdict 三态 + 三级提示逐级解锁——学长式纪律 phrases 锁定）；④ 战报
      （stamp-ok 口径）。
    四态落点（规范 §7 practice 行，区域级）：章节 empty（未练过）→ EmptyState。
    接线勾稽：#5 守卫；练习逐步批改业务流程一行不改（3.1c）。
    走查：T0 四档 × 双主题 + 作答过程专项（逐步批改 + 提示解锁实拍）。
    测试命令：5.1 全套 + 3.2 + 6.3（PracticePage.tsx）。
    commit 草稿：「style10批4-2: /practice 练习——章节阶梯+分步作答步骤卡(data-verdict)+
      三级提示逐级解锁+战报；批改流程零改动」

P9.3 /paper 试卷上传页（第 6 个提交）
    原型锚点：PAGES.paper L2213-2348；sheetHead L2218 'PAPER / 批量证据采集（三段）'、
      SHEET 10-07、需求 2.7。
    涉及：apps/web/src/pages/PaperPage.tsx + Layout.tsx 登记 '/paper' +（视需）index.css。
    页头预判：页面自有（L2218）。
    逐段复现：① STAGE1 预置文件库（文件行 check 多选 ≤5 拼卷）；② STAGE2 识别中
      （SkeletonLines 骨架）；③ STAGE3 逐题确认（确认表 guess 三态 + 知识点下拉）+
      结果。
    四态落点（规范 §7 paper 行，整页级）：空集合（0 份试卷）→ EmptyState；识别失败 →
      Stamp 红章 + 缓存完好提示。
    接线勾稽（本轮关键页）：#3 试卷识别刷新回显——进页先读 sessionStorage
      zhiwei_recognition_id 回显确认态；确认后写 zhiwei_paper_wrong_* 错题缓存
      （router.tsx 冻结区键位，一行不动；变更说明逐项打勾）；#5 守卫。
    走查：T0 四档 × 双主题 + 专项：刷新回显实拍（进页→刷新→确认态保留截图对照）+
      错题缓存写入后跳 /attribution 联动取证（勾稽 #3 全链）。
    测试命令：5.1 全套 + 3.2 + 6.3（PaperPage.tsx）。
    commit 草稿：「style10批4-3: /paper 试卷——三段制式(文件库多选≤5/识别骨架/逐题确认
      guess 三态)+刷新回显与错题缓存接回(zhiwei_recognition_id/zhiwei_paper_wrong_*)；
      识别流转零改动」

P9.4 /attribution 错题归因页（第 7 个提交）
    原型锚点：PAGES.attribution L2604-2760；sheetHead L2608 'ATTRIBUTION / 沿先修链回溯'、
      SHEET 10-10、需求 2.10。
    涉及：apps/web/src/pages/AttributionPage.tsx + Layout.tsx 登记 '/attribution' +
      （视需）index.css。
    页头预判：页面自有（L2608）。
    逐段复现：① 选错题（错题表）；② 复述核对（复述框）；③ 五类归因（归因 seg）；
      ④ 回溯结果（.path 回溯链 + .cands 候选 + 验证题 + 处方）。
    四态落点（规范 §7 attribution 行，整页级）：无可归因错题 → EmptyState；结果取不到
      → Stamp 红章（不给半截结论口径）。
    接线勾稽（与 P9.3 成对）：#3 第一步优先读 zhiwei_paper_wrong_* 缓存（从 /paper 确认
      跳入的联动勾稽，变更说明打勾）；#5 守卫；attribution store 冻结、四步向导业务
      流程一行不改（3.1c）。
    走查：T0 四档 × 双主题 + 专项：从 /paper 错题缓存直入第一步的联动实拍。
    测试命令：5.1 全套 + 3.2 + 6.3（AttributionPage.tsx）。
    commit 草稿：「style10批4-4: /attribution 归因——四步向导制式(选错题/复述核对/五类
      归因/回溯链与处方)+错题缓存优先读取接回；向导流程零改动」

P9 收尾（不单列提交，并入 P9.4 或按惯例独立提交，执行报告留痕）：全批 vitest 三批 +
tsc 三段 + build + 冻结区区间口径一次；T0 四页 8 组合走查齐全；接线 #3 勾稽表成文。

=================================================
P10 批次5：T1 六页（串行，每页单提交）【检查点⑫~⑰】
    页序：P10.1 /spaces → P10.2 /start → P10.3 /self-report → P10.4 /login →
          P10.5 /me → P10.6 /drive（不得乱序）
    通用（六页共遵）：走查口径 = 至少 1440/375 双主题两档（需求底线 ≥2 档），建议沿用
    4 档全量（批次收尾 8 组合一次跑齐，防超时分条）；5.1 六步规程；测试改动预计 0 文件
    （authStore/routerGuard 冻结证据）。
=================================================

P10.1 /spaces 学习空间页（第 8 个提交）
    原型锚点：PAGES.spaces L2040-2107；sheetHead L2087 'SPACES / 学习容器管理'、
      SHEET 10-05、需求 2.5。
    涉及：apps/web/src/pages/SpacesPage.tsx + Layout.tsx 登记 '/spaces' +（视需）index.css。
    页头预判：页面自有（L2087）。
    逐段复现：① 空间列表（空间卡 + 当前使用徽标 + chip n/30）；② 新建（紧凑表单）。
    四态落点（规范 §7 spaces 行，区域级）：列表 empty / error（区域级空盒/红章）。
    接线勾稽：#4 空间胶囊 + 409 ConfirmDialog + 新建表单紧凑态（Masthead/抽屉已落位，
      本页为列表与表单本体，409 流转语义冻结）；#5 守卫（无活跃空间回 /spaces 本页）。
    走查：4 档 × 双主题 + 409 冲突专项（新建重名空间触发 ConfirmDialog 实拍）。
    测试命令：5.1 全套 + 3.2 + 6.3（SpacesPage.tsx）。
    commit 草稿：「style10批5-1: /spaces 空间——列表卡片+当前使用徽标+紧凑新建表单+
      区域级四态；409 与切换语义零改动」

P10.2 /start 冷启动页（第 9 个提交）
    原型锚点：PAGES['cold-start'] L1974-1999；sheetHead L1986 'COLD START / 一次性引导'、
      SHEET 10-03、需求 2.3。
    涉及：apps/web/src/pages/StartPage.tsx + Layout.tsx 登记 '/start' +（视需）index.css。
    页头预判：页面自有（L1986）。
    逐段复现：① 四条路径（四张路径 panel：时间/负担/说明）。
    四态落点：无（静态引导页，规范 §7 明示）。
    接线勾稽：#5 守卫（auth 需登录、无空间可进）；四条路径导航 navigate 语义冻结。
    走查：4 档 × 双主题（登录态）。
    测试命令：5.1 全套 + 3.2 + 6.3（StartPage.tsx）。
    commit 草稿：「style10批5-2: /start 冷启动——四条路径 panel 制式；导航语义零改动」

P10.3 /self-report 起点自报页（第 10 个提交）
    原型锚点：PAGES['self-report'] L1999-2040；sheetHead L2018 'SELF REPORT / 30 秒先验'、
      SHEET 10-04、需求 2.4。
    涉及：apps/web/src/pages/SelfReportPage.tsx + Layout.tsx 登记 '/self-report' +
      （视需）index.css。
    页头预判：页面自有（L2018）。
    逐段复现：① 章节 × 五档（seg 五档 + 章节行，原型 srFill/srClear 辅助不迁移——mock
      实现手段，D5/12.3 口径）；② 操作区（主按钮 + 已记录态 stamp-h 口径 L2034-2036）。
    四态落点：无（提交失败走 toast，规范 §7 明示）。
    接线勾稽：zhiwei_sr_done_* 落盘键（现有工程侧偏好键，规范第 11 章末行）；自报提交
      业务语义冻结。
    走查：4 档 × 双主题 + 提交后已记录态实拍。
    测试命令：5.1 全套 + 3.2 + 6.3（SelfReportPage.tsx）。
    commit 草稿：「style10批5-3: /self-report 自报——章节×五档 seg+已记录态；提交链路
      与落盘键零改动」

P10.4 /login 登录注册页（第 11 个提交）
    原型锚点：PAGES.login L1912-1974；sheetHead L1951 'AUTH / 最小摩擦入口'、SHEET 10-02、
      需求 2.2。
    涉及：apps/web/src/pages/LoginPage.tsx + Layout.tsx 登记 '/login' +（视需）index.css。
    页头预判：页面自有（L1951；双 tab 标题切换「登录知微/注册知微」）。
    逐段复现：① 登录/注册分段（seg）；② 演示账号（panel + kv）。
    四态落点（规范 §7 login 行）：表单不整页四态；错误落在字段 .hint.bad（区域级）。
    接线勾稽（本轮关键页）：#6 登录真实链路——token 落盘 / 刷新不掉线 / 演示账号 /
      401 清理（auth store 冻结，authStore.test 全绿为证据）；#5 守卫（已登录访问
      /login 的既有跳转语义不变）。
    走查：4 档 × 双主题 + 专项：登录成功跳转与 token 落盘实拍（探针）、字段错误态实拍。
    测试命令：5.1 全套 + 3.2 + 6.3（LoginPage.tsx）+
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/authStore.test.ts apps/web/tests/routerGuard.test.ts
    commit 草稿：「style10批5-4: /login 登录——seg 分段+刻度输入+演示账号 panel+字段级
      错误态；token 落盘与 401 链路零改动」

P10.5 /me 我的页（第 12 个提交）
    原型锚点：PAGES.profile L3028-3120；sheetHead L3054 'PROFILE / 个人中心'、SHEET 10-14、
      需求 2.14。
    涉及：apps/web/src/pages/MePage.tsx + Layout.tsx 登记 '/me' +（视需）index.css。
    页头预判：页面自有（L3054）。
    逐段复现：① 学习概览（measure 概览格）；② 我的老师；③ 当前空间；④ 老师推荐
      （推荐台账）；⑤ 账号信息（kv）；⑥ 外观与模型（主题 seg——ThemeToggle 既有件）；⑦ 退出。
      （现有 /me 学习概览吸收旧控制台的既有结构保留，v7 P10 要点。）
    四态落点（规范 §7 profile 行，区域级）：概览 empty（无空间/无数据）。
    接线勾稽：主题切换键 zhiwei_theme（拍板①）；退出链路 auth store 冻结；绑定码输入
      语义冻结。
    走查：4 档 × 双主题 + 主题切换实拍（me 页切换后全站生效对照）。
    测试命令：5.1 全套 + 3.2 + 6.3（MePage.tsx）。
    commit 草稿：「style10批5-5: /me 我的——概览 measure+kv+推荐台账+主题 seg 七段制式；
      账号与退出链路零改动」

P10.6 /drive 云盘页（第 13 个提交）
    原型锚点：PAGES.library L2990-3028；sheetHead L2994/3005 'LIBRARY / 只读资料'、
      SHEET 10-13、需求 2.13。
    涉及：apps/web/src/pages/DrivePage.tsx + Layout.tsx 登记 '/drive' +（视需）index.css。
    页头预判：页面自有（L2994 无缺口态 / L3005 有关联态，双分支同 P7 先例）。
    逐段复现：① 预置教材文件（文件表）；② 与当前缺口相关（缺口建议 panel）；③ 自定义
      知识库（禁用态斜纹 + dis-banner）；④ 没有缺口时分支。
    四态落点（规范 §7 library 行，区域级）：列表 empty / noSpace 提示。
    接线勾稽：#5 守卫（needSpace）；只读语义（无上传——冻结）。
    走查：4 档 × 双主题 + noSpace 态取证（D23 空间基线）。
    测试命令：5.1 全套 + 3.2 + 6.3（DrivePage.tsx）。
    commit 草稿：「style10批5-6: /drive 云盘——预置文件表+缺口建议+自定义库禁用态(斜纹+
      dis-banner)+区域级四态；只读语义零改动」

=================================================
P11 批次6：门户 + 教师端（串行，四提交）【检查点⑱~㉑】
    页序：P11.1 / → P11.2 /t → P11.3 /t/student/:studentId → P11.4 /t/recommendations
    通用：走查 4 档 × 双主题；教师端走查需教师演示账号（tools/e2e-smoke.cjs 既有流程
    取；若无可用教师账号，降级为登录态 403 拦截截图 + 留痕，不伪造——R17）。
=================================================

P11.1 / 门户落地页（第 14 个提交）
    原型锚点：PAGES.portal L1855-1911；hero L1881-1889；SHEET 10-01、需求 2.1。
    涉及：apps/web/src/pages/LandingPage.tsx + Layout.tsx 登记 '/'（D24；portal 为
      PUBLIC SHEET，自渲染 hero，不套 SheetHead 件）+（视需）index.css。
    页头预判：页面自有 hero（eyebrow 'ZHIWEI / PUBLIC SHEET' + h1 + lede + CTA +
      hero-meta 数字行）。
    逐段复现（拍板④ + D6：现有四章叙事内容与信息架构保留，视觉层换蓝图）：
      ① hero（现有产品名/标语/入口 CTA 换 hero 制式；「纯前端原型·mock」chip 不迁移——
      D5/12.3 口径，产品文案以现有为准）；② 三条主张（三列 panel）；③ 五步闭环
      （num-list）；④ 两个入口（学生/教师）；⑤ 图纸目录表（bp-tbl 目录表对应现有导航
      目录结构；内容以现有为准）。逐字动画保留（拍板④组成部分），与原型克制动效观的
      冲突在变更说明留痕（D6）。
    四态落点：不适用（规范 §7 portal 行，门户无加载/错误态）。
    接线勾稽：未登录可访问（auth:false）；CTA 按登录态分流（现有语义）。
    走查：4 档 × 双主题 + 滚动叙事与逐字动画实拍（reduced-motion 双通道各一张）。
    测试命令：5.1 全套 + 3.2 + 6.3（LandingPage.tsx）。
    commit 草稿：「style10批6-1: / 门户——hero 制式+三条主张+五步闭环+图纸目录(内容保留
      拍板④, 视觉换蓝图 D6)；四章叙事与逐字动画保留」

P11.2 /t 教师工作台（第 15 个提交，含 TeacherShell）
    原型锚点：PAGES.teacher L3120-3177；sheetHead L3143 'TEACHER CONSOLE / 邀请码与学情
      总览'、SHEET 10-15、需求 2.15。
    涉及：apps/web/src/pages/teacher/TeacherDashboard.tsx +
      apps/web/src/components/teacher/TeacherShell.tsx（视觉层：教师端外壳制式随
      blueprint，角色校验链路一行不动）+ Layout.tsx 登记 '/t' +（视需）index.css。
    页头预判：页面自有（L3143）。
    逐段复现：① 总览（概览 measure）；② 邀请码（邀请码块 + 复制）；③ 隐私与数据边界
      （note 制式）；④ 学生列表（学生表）。
    四态落点（规范 §7 teacher 行，区域级）：学生列表 empty / error。
    接线勾稽：教师 403 兜底（requireTeacher 服务端冻结）；邀请码生成/复制链路冻结；
      前端不做角色拦截（拍板）。
    走查：4 档 × 双主题（教师账号；无则 R17 降级）+ 403 拦截截图（学生账号访问 /t）。
    测试命令：5.1 全套 + 3.2 + 6.3（TeacherDashboard.tsx / TeacherShell.tsx）。
    commit 草稿：「style10批6-2: /t 教师工作台+TeacherShell——总览 measure+邀请码块+
      学生表+区域级四态；角色校验与 403 兜底零改动」

P11.3 /t/student/:studentId 学生详情页（第 16 个提交）
    原型锚点：PAGES['teacher/student'] L3177-3246；sheetHead L3200 'STUDENT DOSSIER /
      教学必需的摘要'、SHEET 10-16、需求 2.16。
    涉及：apps/web/src/pages/teacher/TeacherStudentDetail.tsx + Layout.tsx 前缀匹配登记
      '/t/student/'（D24 特例，一处判定改法）+（视需）index.css。
    页头预判：页面自有（L3200，h1 含学生昵称）。
    逐段复现：① 概览（档案 header + L3206 掌握度日志/自报/测评/试卷 measure 格）；② 缺口
      与推荐下发（缺口表 + 下发表单 + 字数计数）；③ 已下发；④ 最近答题原文；⑤ 归因记录。
    四态落点（规范 §7 teacher/student 行，区域级）：无学生 → 页面级错误（Stamp）。
    接线勾稽：下发/撤回业务语义冻结；403 兜底不动。
    走查：4 档 × 双主题（教师账号）+ 无学生 id 的页面级错误态取证。
    测试命令：5.1 全套 + 3.2 + 6.3（TeacherStudentDetail.tsx）。
    commit 草稿：「style10批6-3: /t/student 学生详情——档案头+缺口下发+答题原文+归因
      记录+页面级无学生错误态；下发链路零改动」

P11.4 /t/recommendations 推荐管理页（第 17 个提交）
    原型锚点：PAGES['teacher/recommendations'] L3246-3305；sheetHead L3266
      'RECOMMENDATION OPS / 全生命周期'、SHEET 10-17、需求 2.17。
    涉及：apps/web/src/pages/teacher/TeacherRecommendations.tsx + Layout.tsx 登记
      '/t/recommendations' +（视需）index.css。
    页头预判：页面自有（L3266）。
    逐段复现：① 汇总（measure）；② 台账（台账表 + 六态 chip）；③ 状态口径（状态说明）。
    四态落点（规范 §7 teacher/recommendations 行，区域级）：台账 empty。
    接线勾稽：推荐生命周期状态机冻结；403 兜底不动。
    走查：4 档 × 双主题（教师账号）。
    测试命令：5.1 全套 + 3.2 + 6.3（TeacherRecommendations.tsx）。
    commit 草稿：「style10批6-4: /t/recommendations 推荐管理——汇总 measure+六态台账+
      状态口径+区域级空态；生命周期状态机零改动」

=================================================
P12 收尾（四步，预计 2~3 个提交）
=================================================

P12.1 冻结区终检 + 全量验证（不单列提交，证据入执行报告）
    目的：收尾前对全程红线做一次终检。
    测试命令（独立分条）：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests
      $NODE $WS/node_modules/vitest/vitest.mjs run packages
      $NODE $WS/node_modules/vitest/vitest.mjs run functions/api/tests
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p packages/engine/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p functions/api/tsconfig.json
      $NODE $WS/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p12
      git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only bf3c7fe..HEAD -- apps/web/src/stores apps/web/src/lib/graphLayout.ts apps/web/src/lib/graphMastery.ts apps/web/src/data/graphSnapshot.ts apps/web/src/lib/poster.ts
      6.3 静态纪律四条（全局）
    判据：462+ 用例全绿只增不减；tsc 三段 0；build 成功；冻结区双口径空输出；
      静态纪律无匹配。

P12.2 nav 断点清退评估（按 D26 判据执行，结论入执行报告；如有代码改动，独立提交）
    测试命令：
      grep -rn -E "(^|[^a-z-])(max-)?nav:" apps/web/src | grep -v node_modules ; echo "exit=$?"
      # 逐条分类 A/B/C（D26），B/C 类处置后复跑：
      $NODE $WS/node_modules/vitest/vitest.mjs run apps/web/tests/breakpoints.test.ts
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 768
    判据：nav 定义与断言保留（D1）；换档处触控目标高度走查不回退；A 类留痕理由成文。
    commit 草稿（若改动）：「style10收尾a: nav 断点用法清退(B/C 类 N 处换新档/删除,
      A 类 N 处留痕保留)；断点定义与断言保留」

P12.3 全站走查汇总（8 组合终态重跑，产物独立提交）
    目的：17 页全部迁完后，对最终态做一轮全量走查（此前各页走查为局部新鲜态）。
    做什么：8 组合（4 档 × 双主题）重跑 + 逐页 overflowPx 汇总表（node 脚本解析 8 份
      audit JSON，输出 17 路由 × 8 组合的 0/非 0 矩阵，期望全 0）+ D24 页头无双 h1
      逐页目验 + 四态/专项取证补缺（各页四态至少一档取证齐备）。
    测试命令（8 条独立分条，防 60s）：
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=dark  $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1440
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 1024
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 768
      ZHIWEI_AUDIT_OUT=/Users/Merryou/LearnBuddy/zhiwei/_pipeline/screenshots/style10 ZHIWEI_AUDIT_THEME=light $NODE tools/responsive-audit.cjs --tag style10 --widths 375
      # 汇总解析（reviewer 第 3 轮同款做法，脚本可放 /tmp 或 tools/ 只读）：
      $NODE -e 'const fs=require("fs");for(const w of[1440,1024,768,375])for(const t of["","-dark"]){const j=JSON.parse(fs.readFileSync(`_pipeline/screenshots/style10/audit-style10-${w}${t}.json`));for(const[r,v]of Object.entries(j.routes||j))if(v.overflowPx!==0)console.log("OVERFLOW",w,t,r,v.overflowPx)}console.log("done")'
    commit 草稿：「style10收尾b: 全站走查 8 组合终态重采+17 路由 overflowPx 全 0 汇总+
      四态取证补缺」

P12.4 文档与执行报告（最后一个提交）
    做什么：
      · LOOKATME.md / README.md 视觉章节实测数字更新：token/门禁用例数（462+ 终数）、
        断点四档口径、字体三族、17 页迁移完成说明、包体实测（echarts 独立 chunk 等）、
        _pipeline/screenshots/style10 产物指引；只更新实测数字与状态描述，不改结构。
      · _pipeline/02_EXEC_REPORT.md 第 4 轮版（旧版按规则归档
        _pipeline/archive/02_EXEC_REPORT_YYYYMMDD_HHMM.md）：逐步留痕（P8.0–P12 全部
        步骤 + D21–D26 逐条 + 中断续完快照表 + nav 评估 + 走查汇总矩阵 + M-1/L-1 清偿
        前后对照 OBS-2）。
      · 规范活文档回写（若实现中发现笔误，D9 口径同批留痕修订）。
    测试命令：
      grep -c "462" LOOKATME.md ; echo "exit=$?"      # 数字更新落点自查（以终数为准）
      git --no-pager diff --name-only HEAD -- _pipeline ; echo "exit=$?"   # 提交后期望空
    commit 草稿：「style10收尾c: LOOKATME/README 实测数字更新+第4轮执行报告(P8–P12 全程
      留痕+D21–D26+nav 评估+走查汇总)」
    交付后停，交 reviewer 按检查点⑦~㉑ + P12 口径 VERDICT 把关。

5.1 页面批次通用规程（P8.2~P11 每页必走六步，照旧）：
    ① 页面结构/视觉/交互按原型（对照该页 PAGES.* 锚点逐段复现）
    ② 业务逻辑按现有（接口调用/状态流转/守卫/表单校验一行不改）
    ③ 原型缺的能力接回（规范第 11 章清单逐项勾稽，变更说明打勾）
    ④ 所有视觉走组件库（页面零一次性样式；6.3 抽查该页文件）
    ⑤ 测试按新意图改期望（不删断言；本轮预计 0 文件，若有逐条留痕）
    ⑥ 单页单提交并停点（提交后按 D25 快照五件证据落盘，再进下一页）

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
      $NODE $WS/node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir /tmp/zhiwei-web-build-p8
      # 冻结区（期望空输出；工作区口径 + 区间口径见 3.2）
      git --no-pager diff --name-only HEAD -- apps/web/src/router.tsx apps/web/src/api packages/engine functions data
      git --no-pager diff --name-only HEAD -- apps/web/src/stores
6.2 真浏览器走查（复用既有基建；各页/批次档位口径见「五、」各步骤）：
      # 起服务（两条后台，可存活）
      $WS/node_modules/.bin/esbuild functions/api/src/server.ts --bundle --platform=node --format=cjs --outfile=functions/api/dist/server.js
      $NODE functions/api/dist/server.js            # 后台 :8787
      $NODE $WS/node_modules/vite/bin/vite.js --config apps/web/vite.config.ts   # 后台 :5173
      # 工具 tools/responsive-audit.cjs 与 tools/probe-*-states.cjs（基建可改，业务不可改）
      # 产物只增不删，入 _pipeline/screenshots/style10/；命令须带 ZHIWEI_AUDIT_OUT。
6.3 静态纪律复核（每页面批次收尾跑，期望无匹配行）：
      grep -rn -E "(min|max)-\[[0-9]+px\]:" apps/web/src ; echo "exit=$?"   # 任意值断点禁令
      grep -rn "z-\[" apps/web/src ; echo "exit=$?"
      grep -rn "fonts.googleapis\|fonts.gstatic" apps/web ; echo "exit=$?"  # 禁 CDN
      # 该页零一次性样式抽查（无裸 hex className / 无 min-w-[ 类）：
      grep -n -E "className=\"[^\"]*#[0-9a-fA-F]{3,8}|min-w-\[" apps/web/src/pages/<该页文件>.tsx ; echo "exit=$?"
6.4 走查超时预案：单档多路由贴近 60s 上限；被杀则单宽度 × 单主题逐条跑
      （每条 = 1 档 × 1 主题，同第 3 轮口径）。
6.5 四态取证探针：沿用 tools/probe-report-states.cjs / tools/probe-graph-states.cjs
      模式，新增页面按需新增 tools/probe-<page>-states.cjs（基建只取证不下结论、
      无写接口、遵守 D23 空间基数约定；命名与只增不删纪律同 P6 D21/第 3 轮惯例）。

-------------------------------------------------
七、风险与回滚
-------------------------------------------------
R1【高·规模】照旧：批次严格线性、单批独立提交可独立回滚；本轮虽「一轮完成全部」，
   但页序不乱、每页单提交，任意页后停下全站仍可用（已迁移 3 页 + 未迁移页过渡态）。
R2/R3/R4 已结案（门禁中间红 / 外壳切换 / ECharts 还原度）。
R5~R10 照旧（R6 字体体积已在 P3 实测留痕；R10 规范活文档 P12.4 回写）。
R11 已结案（M-1 全站波及，P6/P7 均验 0px）。
R12【中·四态取证依赖后端】照旧：error 态探针注入；无空间态若 guardPath 重定向取不到
   则留痕说明取证方式，不伪造（P6/P7 先例）；/start、/login、/me、/drive 等页的无空间/
   未登录分支按同口径处理。
R13 已结案（L-1 消费波及）。
R14 已结案（键盘/焦点环方案，第 3 轮留痕接受）。
R15【高·本轮范围极大（清偿+14 页+收尾），单轮 implementer 可能中断】缓解：
   a) 批次间停点：每页完成后必须满足 D25 五件证据（代码入库 / 验证绿 / 走查新鲜 /
      冻结区空 / 快照记账）才进下一页；
   b) 中断续完判据：D25 五件证据 + 续完入口动作（读 D25 + 快照表 + git log 对齐），
      从第一个未完成页继续，不推倒重做；
   c) 每页提交粒度小、互相独立 revert，最坏情况回滚单页不牵连；
   d) 若单轮调用时长不足，优先保证「当前页三件套齐备」再中断，禁止半页提交。
R16【中·M-1 修复技术不确定】ECharts label truncate 失效原因未定；缓解：D21 分层方案
   （核实 → labelLayout → 兜底留痕），任一层收口即停；修复不破 375 硬判据与 OBS-1 取舍。
R17【中·教师端走查账号】教师演示账号可能无数据或不可用；缓解：从 tools/e2e-smoke.cjs
   既有流程取；若无则降级为登录态 403 拦截截图 + 执行报告留痕（v7 P11 口径），不伪造。
R18【低·动态路由页头匹配】/t/student/:id 的 Set 精确匹配不命中；缓解：D24 前缀匹配
   最小改法（一处 + 注释），走查目验无双 h1。
R19【低·守卫页走查路径】/start /login /me 等页的未登录/无空间态被 guardPath 重定向，
   无法直接导航取证；缓解：R12 同口径留痕，或探针先造态再进页（登录后无空间组合）。
回滚总原则：本轮 17 个计划内提交（P8.0 记账 / P8.1 清偿 / P8.2 + P9×4 + P10×6 +
   P11×4 单页 / P12 2~3 个）各自独立 revert；页面提交间无类名依赖，回滚页面批需先于
   回滚 P5/P4/P3（依赖链反向）；走查修复/产物按惯例允许追加独立提交（执行报告留痕）；
   _pipeline/archive/ 与 _pipeline/screenshots/ 产物只增不删。

-------------------------------------------------
八、批次依赖与执行顺序总表（更新至第 10 版）
-------------------------------------------------
P0✔ → P1✔ → P2✔ → P3✔ → P4✔ → P5✔ → P6✔ → P7✔（hash 见「五、」状态表）
  → 本轮：P8.0 记账 → P8.1 M-1/L-1 清偿 → P8.2 /chat →
        P9.1 /assessment → P9.2 /practice → P9.3 /paper → P9.4 /attribution →
        P10.1 /spaces → P10.2 /start → P10.3 /self-report → P10.4 /login →
        P10.5 /me → P10.6 /drive →
        P11.1 / → P11.2 /t(+TeacherShell) → P11.3 /t/student/:id → P11.4 /t/recommendations →
        P12.1 终检 → P12.2 nav 评估 → P12.3 全站走查 → P12.4 文档与报告 → 停点交 reviewer
本轮提交数：计划内 17 个（记账 1 + 清偿 1 + 页面 14 + 收尾 2~3）；走查修复/走查产物
   按惯例允许追加独立提交（执行报告留痕）。

-------------------------------------------------
九、收尾数字与计划自查记录
-------------------------------------------------
本轮涉及文件（全量清单，预估）：
  新增：（视需）apps/web/src/index.css 各页制式类段落（并入既有文件，非新文件）、
    （视需）tools/probe-<page>-states.cjs 四态探针、_pipeline/screenshots/style10/ 走查
    新产物、_pipeline/archive/02_EXEC_REPORT_*.md（第 3 轮报告归档件）
  修改：apps/web/src/pages/ChatPage.tsx、AssessmentPage.tsx、PracticePage.tsx、
    PaperPage.tsx、AttributionPage.tsx、SpacesPage.tsx、StartPage.tsx、
    SelfReportPage.tsx、LoginPage.tsx、MePage.tsx、DrivePage.tsx、LandingPage.tsx、
    apps/web/src/pages/teacher/{TeacherDashboard,TeacherStudentDetail,
    TeacherRecommendations}.tsx、apps/web/src/components/teacher/TeacherShell.tsx、
    apps/web/src/components/Layout.tsx（PAGE_OWNED_HEAD 逐页扩表 + 前缀匹配一处）、
    apps/web/src/pages/GraphPage.tsx（仅 P8.1 清偿：label 配置 + ZOOM_MIN）、
    LOOKATME.md、README.md、_pipeline/02_EXEC_REPORT.md
  冻结不碰：router.tsx、api/ 全部、stores/ 全部、packages/engine、functions/、data/、
    四份契约文档、graphLayout/graphMastery/graphSnapshot/poster、useChatSend、
    20 个既有测试文件（3.3 不动清单）
预计测试改动：0 个文件改期望（若有逐条留痕）；用例总数 462 起步只增不减
  （各页如抽纯函数可配套新增测试，不强求）。
计划自查（planner 2026-10-11 14:58 完成）：
  · 每步具体性：21 个主步骤（P8.0/P8.1/P8.2/P9.1–P9.4/P10.1–P10.6/P11.1–P11.4/
    P12.1–P12.4），各有目的/文件/做法/影响/命令/commit 草稿 —— 是
  · 文件路径明确：全部绝对路径或仓库相对路径，原型行号仅作视觉依据锚点 —— 是
  · 测试命令可运行：全部沿用第 1–3 轮实测过的 $NODE/$WS 形态（含 ZHIWEI_AUDIT_OUT、
    /tmp build 等价口径、分批防 60s）—— 是
  · 避免修改业务代码：各页限表现层（3.1 逐页追加红线），冻结区 3.2 逐批把关 —— 是
  · 检查点映射：⑦~㉑ + P12 收尾全部对应到产物与把关口径 —— 是
  · 歧义裁决留痕：D21（M-1 分层方案）/ D22（L-1 口径统一）/ D23（D18 基数 3）/
    D24（PAGE_OWNED_HEAD 预判登记表 14 页 + 动态路由特例）/ D25（中断续完五件证据）/
    D26（nav 清退 A/B/C 判据）—— 是
  · 认领完整：第 3 轮 M-1 / L-1 / INFO-1 / INFO-2 四项均有裁决与落地步骤 —— 是
  · 范围边界：一轮完成全部剩余任务（总控拍板），页序照第 7/9 版不乱序 —— 是
