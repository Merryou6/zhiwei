知微 · 迭代 3「前端 10 页面 + 端到端闭环」审查报告（终审）
=================================================
报告编号：03_REVIEW（第 3 版 · 迭代 3 · 项目终审）
审查日期：2026-09-20
审查角色：总控（依用户指令「不要调用子智能体，自己干活」，由总控直接执行只读审查；未修改任何业务代码）
审查对象：apps/web（10 页面 / stores / API 与 SSE 客户端 / 主题令牌）、functions/api（迭代 3 仅 D15 修复相关）、scripts、数据资产
上一版归档：_pipeline/archive/03_REVIEW_20260919_1853.md（迭代 2 版，只增不删，内容与本报告替换前的文件一致）

-------------------------------------------------
一、审查范围与方法
-------------------------------------------------

1.1 范围
  (1) 前端 10 页面与 PRD §2 P0 验收项逐项核对（#1–#12 前端侧）
  (2) 交互纪律（PRD §6 话术表 + 颜色语义）与颜色守恒（前端 vs 引擎）
  (3) ΔAccuracy 专项：迭代 3 交付时 accuracy[].delta 恒为 null，属 P0 #11 验收缺口候选，须判定
  (4) 测试与构建复核（vitest / tsc / 数据闸门 / 生产构建）
  (5) 迭代 2 遗留 MINOR-①④ 清偿核对
  (6) 范围纪律与安全纪律（answer 不下发、零密钥、无越界实现）

1.2 方法（全部由本次审查独立执行）
  a. 代码级核对：grep / 逐文件阅读（证据见各节「位置」列）
  b. 独立实跑：vitest 全量（分两批）、tsc 三段、validate_data.py、verify_items.py、vite build
  c. 端到端实测：自写两个临时探针（/tmp/zhiwei_e2e.py、/tmp/zhiwei_sse.py，均不入仓库），
     在同一 shell 调用内「起服务 → 探针 → 关服务」，避免长驻进程被环境回收
  d. 负例（401/403/409 等）由迭代 2 审查已覆盖（契约层本次未变更，仅 D15 改动 selection 与 diagnose）

1.3 环境常量
  $NODE=/Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS=/Users/Merryou/.workbuddy/binaries/node/workspace
  $PY=/Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  后端本地端口 ZHIWEI_API_PORT=8899（本次实测用）

-------------------------------------------------
二、10 页面 × PRD §2 P0 验收核对表
-------------------------------------------------

#  P0 要求                                       实现位置                                       证据 / 结论
-  --------------------------------------------------  ----------------------------------------------  ------------------------------------------
1  注册即建默认空间；token 存 localStorage 刷新不掉线  pages/LoginPage.tsx（handleSubmit）、stores/auth.ts  auth.ts 手动读写 localStorage（键与 router.STORAGE_KEYS 同源）、401/登出同时清内存与落盘；E2E：注册返回 200，space/list 立即含 `初中数学` is_default=true → 通过
2  自报章节级 5 档 ≤6 题、30 秒完成；写入 p_l0        pages/SelfReportPage.tsx（chapters/levels/handleSubmit） 章节取自 data/graphSnapshot（4 章节 ≤6 上限），提交 #6；E2E：updated=20（20 个知识点全部写入先验）→ 通过
3  测评不出已做题、不展示对错、收敛即停              pages/AssessmentPage.tsx（D11 注释 + 105 行「不读 data.correct」）  exclude_item_ids=本轮 doneIds（含跳过题）+ 服务端 evidence 兜底双保险；converged/item=null → 结束屏；E2E：diagnose 模式 submit 返回 correct=null → 通过
4  试卷上传→识别→逐题确认；unclear 必须手标无默认值   pages/PaperPage.tsx（43 行「无默认值，必须手标」、267 行 unclear 分支）  所有行对/错均不预选，suggested_result 仅作参考样式；识别阶段不产生证据、不更新掌握度（页面如实说明）→ 通过
5  加权 BKT 幂等 + mastery_logs 全留痕               （后端，迭代 2 已审）                           独立复跑 api 用例含 D7「同 kp 第二道不同题同小时正常计分」；本次未回归 → 通过
6  五类错误枚举输出；confidence<0.6 退回追问         pages/AttributionPage.tsx（ERROR_TYPE_LABEL 徽标）+ services/classify.ts  attribution_direction 服务端硬编码；低置信 → clarify（页面按澄清态渲染）→ 通过
7  归因定位：路径 + 根因 + 错误类型 + 反驳按钮       pages/AttributionPage.tsx（14 行「反驳按钮常驻」、173 行 reject、195-196 行 root_cause/error_type）  结果态含回溯路径步进条 + 根因高亮 + 错误类型徽标 + suspect 前三 + 验证区 + 常驻反驳；耗尽态诚实兜底文案；rejected_by_student → 「已记录你的反驳」→ 通过
8  对话 SSE；2 次方向提示、3 次解法；连续 3 轮无进展触发退出  pages/ChatPage.tsx（streamChat、next_action 映射）+ services/chat.ts  **独立实测**（见五、E2E-2）：ctype=text/event-stream；轮1 continue → 轮2 hint_down → 轮3 exit_channel；delta 段数 1→2→3 → 通过
9  归因结果页（★答辩主战场）                        pages/AttributionPage.tsx                    同 #7；附带 suspect 分数与验证题交互 → 通过
10 图谱四色着色 + 归因路径高亮 + 全局图例            pages/GraphPage.tsx（masteryHexOf、path 高亮、BandLegend）  ?path=kp1,kp2 → 路径节点描边加粗、边走主色、其余降透明；图例常驻右上（四色 + 归因/学习路径）→ 通过
11 复测闭环：双池零重叠（脚本校验）+ 报告页展示 ΔAccuracy  data/item_bank + scripts/validate_data.py + pages/ReportPage.tsx  双池零重叠由 §6-3/4 校验保证（本次复跑 PASS）；ΔAccuracy 见三、专项（实测 3 行 delta 非 null）→ 通过
12 学习报告页：掌握度分布 + 缺口清单 + 基线/复测对比   pages/ReportPage.tsx（三段布局：分布 / gaps / accuracy）  Δ>0 青绿、Δ<0 暖橙、null 显示「—」；E2E：mastery 20 条、gaps 0 条、accuracy 3 条 → 通过

  附加（PRD §5 页面 #10 云盘页，P1）：pages/DrivePage.tsx 预置资料只读列表 + 上传按钮 disabled
  + 非阻断 toast「自定义知识库即将开放」（PRD §3 P1 原文案）→ 通过

-------------------------------------------------
三、ΔAccuracy 专项判定（迭代 3 唯一的 P0 缺口候选）
-------------------------------------------------

3.1 问题回顾
  迭代 3 交付时（5fe5fb9）发现：GET /api/report/summary 的 accuracy[].delta 在正常演示路径下
  恒为 null，与 PRD §2 P0 #11「报告页展示 ΔAccuracy」及 §7 效果验证相冲突，属验收缺口候选。

3.2 根因（已定位）
  baseline 与 retest 的选题各自取「|mastery − 0.5| 最小」的知识点（ALGORITHM §2 信息增益）。
  基线作答后该 kp 掌握度变化，复测随即落到另一个 kp → report 按 kp 分组统计时单侧缺失
  → 契约 §10 规定「单侧缺失 → delta null」→ 恒 null。

3.3 修复（提交 `2b05a29` / 原 `bfa6abc`，D15 测量一致性）
  · packages/engine/src/selection.ts：新增可选入参 `measureKps`，mode='retest' 时把「已有基线
    证据的 kp」提前（纯函数、零 IO；缺省/空数组 → 原样返回，向后兼容）
  · functions/api/src/services/diagnose.ts：mode='retest' 时查询本 space 已有 baseline 证据事件的
    kp 集合并传入；mode=diagnose / baseline 行为逐字不变
  · 新增用例 7 条（引擎优先排序与回退 + 报告 accuracy 的 baseline/retest/delta 非 null）

3.4 本次实测（2026-09-20 14:05，重建 bundle 后复跑两次，结果一致）
  探针：/tmp/zhiwei_e2e.py（注册 → 默认空间 → 自报 → baseline 3 题 → retest 3 题 → report）
    基线 3 题（模拟干预前，1 对 2 错）
      baseline#1 q_cz_geometry_006  kp=geometry     correct=True   mastery_after=0.8455
      baseline#2 q_cz_applic_006    kp=application  correct=False  mastery_after=0.2444
      baseline#3 q_cz_eq_rel_006    kp=eq_relation  correct=False  mastery_after=0.2444
    复测 3 题（模拟干预后，全对）
      retest#1   q_cz_applic_007    kp=application  correct=True   mastery_after=0.6539
      retest#2   q_cz_geometry_007  kp=geometry     correct=True   mastery_after=0.9668
      retest#3   q_cz_eq_rel_007    kp=eq_relation  correct=True   mastery_after=0.6539
    report/summary：
      mastery 条目 = 20 ｜ gaps = 0 ｜ accuracy 行数 = 3，其中 delta 非 null 行数 = 3
        eq_relation   baseline=0  retest=1  delta=1
        application   baseline=0  retest=1  delta=1
        geometry      baseline=1  retest=1  delta=0
    基线 kp 集合 {application, eq_relation, geometry} == 复测 kp 集合（测量一致性成立）
  结论：ΔAccuracy 可计算、可复现；本次演示协议下均值 0.667（答辩可用，须注明作答协议，见 I-3）。
  判定：**不构成 P0 缺口**（原缺口已闭环）。

-------------------------------------------------
四、交互纪律与颜色守恒
-------------------------------------------------

4.1 颜色语义（PRD §6）
  · apps/web/src/theme/bands.ts 为前端**唯一取色入口**：阈值与状态带判定直接复用
    packages/engine/src/statusBand（源模块导入，非 barrel —— 注释已说明 barrel 会连带 params.ts
    的 node:fs/path 进浏览器 bundle）
  · BAND_HEX：待巩固 #E8894A / 不稳定 #D9B23F / 基本掌握 #79B8A6 / 已掌握 #2F9C7C（全部低饱和，
    无刺眼大红）；主色 PRIMARY_HEX #4E8FB0（低饱和青蓝）
  · 守恒由 apps/web/tests/bands.test.ts（10 例）锁定（导出常量 === engine 导出值 + tailwind 令牌一致）
  · 组件一律经 BAND_CLASS / masteryHexOf 取色，未发现硬编码 hex 的语义判断
4.2 语气（PRD §6 话术表）lib/phrases.ts 逐条落实：
  「这一环还有点晃，我们再稳一下」/「这个坑很常见，我们看看它是怎么来的」/
  「找到啦——真正卡住你的是这里」/「我们先往回看一眼「XX」，那里可能是关键」（带 kp 名插值），
  另含 verificationExhausted 诚实兜底话术
4.3 其他交互纪律
  · 采集不弹窗：证据采集为静默，用户可见提示仅非阻断 Toast（components/Toast.tsx）
  · 空间不占首屏：/spaces 与 /self-report 标记 nav=false，顶栏主导航为 5 项
  · 一屏一件事：10 页面均为单任务布局（页面顶部注释均引用 PRD §5 对应条目）

-------------------------------------------------
五、端到端实测记录
-------------------------------------------------

E2E-1 完整闭环（探针 /tmp/zhiwei_e2e.py，实跑两次一致）
  [1] register → 200 code=0（新建 u_*，token 下发）
  [2] space/list → 1 个空间：sp_* 名「初中数学」is_default=true（注册自动建默认空间，P0 #1）
  [3] self-report（4 章节 level=3）→ updated=20
  [4][5] baseline / retest 各 3 题（见三、3.4 明细；diagnose 模式 correct 恒 null 见 P0 #3）
  [6] report/summary → mastery 20 / gaps 0 / accuracy 3（delta 1,1,0）
  [7] 基线 kp 集合 == 复测 kp 集合

E2E-2 SSE 与退出通道（探针 /tmp/zhiwei_sse.py，三轮连续无进展）
  轮1 ctype=text/event-stream events=[delta, meta, done] next_action=continue    progress=False
  轮2 ctype=text/event-stream events=[delta, delta, meta, done] next_action=hint_down   progress=False
  轮3 ctype=text/event-stream events=[delta, delta, delta, meta, done] next_action=exit_channel progress=False
  → 事件序列、流式增量渲染、提示阶梯（第 2 轮方向提示）、连续 3 轮无进展触发退出通道，全部成立。
  （注：本地适配器的 progress 由触发词表判定，见 I-5；换真实模型后判定来源改变、状态机不变。）

E2E-3 构建
  前端：vite build exit=0（dist/assets/index-*.css 15.47 kB / gzip 3.73 kB；
        index-*.js 1,280.50 kB / gzip 423.65 kB），耗时 5.26s
  后端：esbuild bundle ⚡ Done in 16ms → functions/api/dist/server.js（95,350 B）
        ※ 构建命令须用 `$WS/node_modules/.bin/esbuild`（原生二进制），详见发现 M-1

-------------------------------------------------
六、测试与构建复核（全部由本次审查独立执行）
-------------------------------------------------

  全量单测：20 个测试文件 / **225 用例全绿**
    · 引擎 + 后端（13 文件）：161 用例（含 D15 新增 7 例）
    · 前端（7 文件）：64 用例（store / API 客户端 / SSE 解析 / 颜色守恒 / 路由守卫 / 图谱快照）
  类型检查：tsc --noEmit 三段（engine / api / web）exit=0
  数据闸门：validate_data.py 全 PASS（20 节点 / 74 典型错误 / 228 题：train 104 + retest 124）
            verify_items.py：覆盖 86 题、不一致 0、fill/short_answer 末步含 answer
  生产构建：见 E2E-3
  回归结论：迭代 1/2 的 150 用例零回归，迭代 3 新增 75 例

-------------------------------------------------
七、迭代 2 遗留 MINOR-①④ 清偿核对
-------------------------------------------------

  ① verify 校验 item 属候选集 → functions/api/src/services/attribution.ts:196-203
     （pending_candidates 非空时，item 必须命中候选集，否则拒绝）→ 已落实
  ④ 跨小时桶接口层用例 → functions/api/tests/diagnose.test.ts:345-347
     （T → T+3600s：dedup_key 不同、事件新增、掌握度正常更新、不误判幂等）→ 已落实
  ②（@types/node 入 devDependencies）③（pending_candidates 留痕）→ 迭代 2 已处理，本次复核仍在位

-------------------------------------------------
八、分类发现清单
-------------------------------------------------

M-1 【MINOR｜文档｜已修复】LOOKATME.md 与 AGENT.md 的后端构建命令写作
    `$NODE $WS/node_modules/esbuild/bin/esbuild ...`，把**原生二进制**交给 node 执行 →
    `SyntaxError: Invalid or unexpected token`（实测复现）。正确形式为
    `$WS/node_modules/.bin/esbuild ...`。本次审查已同步修正两份文档的命令。

I-1 【INFO】前端 JS 1,280.50 kB（gzip 423.65 kB）超出 vite 默认 500 kB 警告阈值，echarts 未单独拆包。
    演示环境无影响；若评委关注首屏性能，可后续用 manualChunks 把 echarts 拆出。
I-2 【INFO】无浏览器级渲染断言（迭代 3 计划明确排除 E2E 框架）。页面行为由「代码核对 + API 级测试 +
    端到端 curl 链路」三路间接覆盖，未做真实 DOM 断言。
I-3 【INFO】ΔAccuracy 演示值随作答协议变化（本次基线 1 对 2 错、复测 3 对 → delta 1/1/0，均值 0.667）。
    答辩引用时须同时注明作答协议；真实学生实验中应使用其真实作答。
I-4 【INFO】自报 level=3 → 先验 0.5，导致冷启动时 20 节点全为 0.5、gaps=0；测评/复测后才有分层。
    属设计预期（先验未观测），不是缺陷。
I-5 【INFO】本地对话适配器的 progress 来自触发词表（不会/不知道/没思路/随便/猜）；真实模型接入后
    progress 改由模型结构化输出，服务端状态机与证据纪律不变（接入点已在 localChat.ts 注释标明）。
I-6 【INFO】data/local_db/ 为本地演示用 JSON 存储（已 gitignore），与 CloudBase 适配器桩并存；
    部署形态切换不改业务代码。

-------------------------------------------------
九、总体结论
-------------------------------------------------

  判定依据逐条核验：
   · BLOCKER 判据：P0 验收项缺失/不可用 —— ΔAccuracy 专项已修复并实测可算（3 行 delta 全非 null），
     其余 11 项 P0 逐条通过 → 不成立
   · BLOCKER 判据：SSE 不可用 / 颜色语义违背（大红、自造阈值）/ 契约违背 / 范围越界 / 测试造假
     —— 均未发现：SSE 实跑通过；颜色由守恒测试锁定且无大红；answer 由
     `FORBIDDEN_CLIENT_KEYS = ['answer','solution_steps','distractors']` 拦在服务端；
     全域无真实模型密钥与云 SDK 激活；测试数字均可复跑
   · MAJOR 判据：未发现（唯一 MINOR 为文档命令错误，已随本次审查修复）
   · MINOR 1 条（已修复）；INFO 6 条（不阻塞，转迭代 4 / 材料阶段参考）

  迭代 3「前端 10 页面 + 端到端闭环」判定：通过。项目三项交付（引擎与数据、后端 19 接口、前端 10 页面
  与闭环）至此全部通过审查，达到 PRD §1 范围红线要求（1 默认空间 + 20 知识点 + ≥220 题 + 1 条完整闭环）。

VERDICT: PASS
