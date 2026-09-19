知微 · 迭代 1「地基冲刺」审查报告
=================================================
报告编号：03_REVIEW
审查日期：2026-09-19
审查角色：审查者（只读审查，未修改任何业务代码与数据文件）
被审对象：/Users/Merryou/LearnBuddy/zhiwei/（HEAD = 666a52f，工作树干净）
审查依据：需求文档（API_CONTRACT > ALGORITHM > DATA_SCHEMA > PRD > 方案 v4）
          + _pipeline/01_PLAN.md（计划）+ _pipeline/02_EXEC_REPORT.md（执行报告，含偏差 D1–D10）

说明：本报告为纯文本，不依赖 markdown 渲染。

-------------------------------------------------
一、审查范围与方法
-------------------------------------------------

1.1 审查任务（五项）
  (1) 计划符合性：对照 01_PLAN 第四章 30 行文件清单逐项核对；确认排除项零实现。
  (2) 算法正确性：bkt.ts / selection.ts / dedup.ts / statusBand.ts 逐行对照 ALGORITHM
      §1 / §2 / §6；config/params.json 17 键与 ALGORITHM §0 参数总表逐值核对。
  (3) 数据资产数学正确性抽查：题库每 kp 抽 2 题（共 40 题，覆盖全部 20 个 kp）独立复算；
      知识图谱对照计划 五、5.1 节点表独立校验；运行 validate_data.py 与单测复核。
  (4) 测试缺口：36 用例是否覆盖 3 个硬门槛及关键边界。
  (5) 安全与工程纪律：参数零硬编码 grep、密钥/敏感信息、git 历史 D8 并行写入一致性。

1.2 抽样量
  - 题库人工复算：40 题（每 kp 2 题，随机种子 20260919，覆盖 20/20 个 kp，
    train 与 retest 双池均有覆盖）。
  - 题库程序复算（审查者另写的解析+求解脚本，与 solution_steps 不同的实现路径）：
    二次函数族（顶点/对称轴/最值/交点个数/判别式/与 y 轴交点）31 题；
    方程求根族（直接开平/因式分解/配方法结果/公式法）24 题；
    关键词误分类后的人工补复核 18 题。合计独立复算覆盖约 68 题 ≈ 题库 30%。
  - 知识图谱：20/20 节点全量校验（非抽样）。
  - 题库结构性与一致性检查：228/228 题全量。
  - 干扰项：74/74 个典型错误码绑定覆盖全量核对；29 道 choice 题的每个错误选项
    是否都绑定了错误路径，全量核对。

1.3 实际运行过的命令（环境常量按执行报告第二章展开）
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace

  [C1]  6.2 参数完整性：17 键集合相等断言      → 「params OK: 17」
  [C2]  6.3 静态数据校验：$PY scripts/validate_data.py
                                              → 8 行 [PASS]、WARN 0、exit=0
  [C3]  6.4 引擎类型检查：tsc --noEmit -p packages/engine/tsconfig.json
                                              → 无输出、exit=0
  [C4]  6.5 单元测试：vitest.mjs run          → Test Files 2 passed (2)；Tests 36 passed (36)
  [C5]  6.1 前端空壳启动（复测，改用 5199 端口）→ VITE v5.4.8 ready；curl grep -c 知微 = 1；已终止
  [C6]  反硬编码 grep（0.1x/0.2/0.4x/0.6x/0.85）→ 仅 statusBand.ts 命中（注释 + 2 具名常量）
        补充 grep（任意小数，bkt/selection/dedup/params）→ 仅 selection.ts 的 TARGET_MASTERY = 0.5 与注释
  [C7]  范围自查 grep（git ls-files 全部非 .md 文件）
        EventSource|text/event-stream|SSE|openai|LLM|大模型|识别|OCR|jwt|bcrypt|password|
        secret|token|api_key|CloudBase|wx-server-sdk|collection(   → 仅 3 处注释命中，0 处实现命中
        fetch(|axios|http.|https.|mongodb|mysql（functions/packages/apps/web/src）→ 0 命中
  [C8]  BKT 差分测试：Python 独立参考实现 vs TS 引擎，输入网格
        pL∈{0,0.01,0.1,0.3,0.5,0.7,0.9,0.99,1,1.5} × 对错 × w∈{0,0.3,0.8,1} = 80 组，
        比较 before/p_obs/p_eff/after 四项      → 80/80 一致（误差 < 1e-12）
  [C9]  dedup 与状态带验证：五段格式、hour_bucket=floor(t/3600) 三点时刻；
        masteryToBand(0.39/0.4/0.59/0.6/0.79/0.8/0.9) → 均符合
  [C10] 图谱独立校验（审查者自写，不复用 validate_data.py）：计划 五、5.1 表逐行比对
        prerequisites、successors 双向互逆、DFS 三色判环、error_type 五类枚举、
        code 节点内唯一 → 0 错误
  [C11] validate_data.py 负例阻断自测（2 轮，坏数据集构造于 /tmp，不入仓库）
        第 1 轮：params 缺键、互逆破坏、三元环、非法 error_type、kp 悬空、配额清零 → 全捕获，exit=1
        第 2 轮：item_id 重复、pool 非法、difficulty=9、choice 无 options、fill 有 options → 5/5 捕获，exit=1
  [C12] git 历史与 D8 复核：git log --oneline --all（13 条）、git status --porcelain（空）、
        git log --merges（空）、5 份 .md 各仅 1 条提交、git show --stat cfdc441、
        q_cz_geometry_011 当前内容核对

1.4 审查方法说明
  - 算法正确性不采信执行报告结论，采用「独立参考实现 + 差分比对」验证。
  - 题目数学正确性不采信实现者自述的复算脚本（该脚本置于 /tmp，见偏差 D5），
    由审查者另写一套解析/求解实现，并逐题人工二法复算。
  - 校验脚本不作为免检依据：先验证其「有牙」（负例拦截），再采信其 PASS 结论。

-------------------------------------------------
二、分类发现清单
-------------------------------------------------

【BLOCKER】0 条。
【MAJOR】0 条。
【MINOR】5 条。

MINOR-1 / 位置：packages/engine/tests/selection.test.ts（S6、S6b）
  描述：收敛判定缺少「V 恰等于 CONV_VAR」的取等边界用例。S6 用 mastery=0.95
        （V=0.0475，明显小于阈值）验证收敛，S6b 用 0.5（V=0.25，明显大于）验证不收敛，
        两侧均有余量，未覆盖 V=0.10 的临界点（P≈0.1127 或 0.8873）。
  证据：selection.ts:118 实现为 `variance < params.CONV_VAR`（严格小于），与 ALGORITHM §2
        「V < CONV_VAR」字面一致；差分测试确认实现无误，故属覆盖缺口而非实现缺陷。
        （剪枝取等边界已由 S1b「mastery=0.4（= PRUNE_THRESHOLD）→ 后继可测」覆盖。）
  影响：低。实现正确，仅回归保护不完整。
  建议：迭代 2 补一条 V 恰等于 CONV_VAR 的用例，断言 converged=false。

MINOR-2 / 位置：package.json（根）devDependencies 未声明 @types/node
  描述：params.ts 使用 node:fs / node:path / process.cwd()，typecheck 依赖 @types/node，
        但该包只装在隔离 workspace（偏差 D1 已记录），未写入 package.json。
  证据：package.json devDependencies 列表无 @types/node；当前 tsc 通过是因为 node_modules
        软链指向已装好的 workspace。
  影响：低（本环境不重装依赖即可工作）；但按 package.json 重新安装后
        `npm run typecheck` 会失败，可复现性有缺口。
  建议：迭代 2 授权后把 @types/node@22.7.5 补入 devDependencies。

MINOR-3 / 位置：data/item_bank/math/cz.json · q_cz_opening_010
  描述：short_answer 题的 answer 相对题干不完整。题干要求「说明开口方向与对称轴，
        并指出 y 随 x 变化的情况」，answer 仅给出「开口向上，对称轴是直线 x = 2」，
        单调性结论只出现在 solution_steps 第 3 步，未进入 answer。
  证据：solution_steps[3] 含「x < 2 时 y 随 x 增大而减小…」，answer 字段不含。
  影响：低。数值全部正确（对称轴 x=2、单调性描述均正确），仅参考答案文本比题干少一项；
        若后续按字符串判等，可能判为不完全作答。
  建议：把单调性结论补进 answer，或将题干收敛为只问开口方向与对称轴。

MINOR-4 / 位置：.git 跟踪了 node_modules 软链（指向本机绝对路径）
  描述：node_modules 作为软链被提交，目标为
        /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules（本机绝对路径）。
  证据：git ls-files 含 node_modules；计划 四、清单将其列为交付项之一（软链），
        故属按计划执行，非越权。
  影响：低。换机 clone 后软链指向失效（.gitignore 已含 node_modules/，本迭代不部署）。
  建议：迭代 2 可考虑从版本控制中移除该软链，改由脚本/文档生成。

MINOR-5 / 位置：_pipeline/02_EXEC_REPORT.md 第五章「仓库跟踪文件共 36 个」
  描述：计数与当前实际不符，实际 git ls-files 为 38 个（清单 30 项 + 5 份既有 .md +
        01_PLAN.md + 02_EXEC_REPORT.md + validate_report.json）。
  证据：git ls-files | wc -l = 38；报告该句写于 02_EXEC_REPORT.md 与 validate_report.json
        入库之前，属时点口径而非数据错误。
  影响：无（纯文档计数）。
  建议：如需精确留痕，可补一句计数时点说明。

【INFO】6 条（不影响判定，仅改进建议）。

INFO-1 / selection.ts:52 `const TARGET_MASTERY = 0.5`：系 ALGORITHM §2「|mastery − 0.5|」
        的规格常量（非 §0 参数表项），以具名常量集中定义并注释指向规格，与 statusBand
        阈值同理，判定可接受。执行报告 二、6.4 的 grep 正则未含 0.5 故未列出该行；
        建议把正则补全或在报告中显式说明，避免复核者误判为漏报。

INFO-2 / selection.ts:124「全部可测 kp 的对应池均无题 → 返回 converged=true」：
        把「无题可出」与「已收敛」两种语义合并。代码注释已说明「无可出题即视为收敛
        （诚实停止，不硬凑题）」，计划 步骤 7d 未规定该情形，属实现者自主决策且方向合理。
        建议迭代 2 引入 reason 字段区分两者。

INFO-3 / 拓扑剪枝按「直接先修」判定（selection.ts:84 只检查 node.prerequisites）：
        直接先修达标而更上游不达标时，该 kp 仍可测。与计划 步骤 7d「全部先修
        mastery ≥ PRUNE_THRESHOLD」及 S1 用例注释口径一致；ALGORITHM §2「所有先修节点」
        可另解读为「全部祖先」。属规格留歧义，实现取了计划口径，判定可接受。
        建议迭代 2 与需求方确认是否需要传递式剪枝。

INFO-4 / statusBand 边界 0.8 的归属：ALGORITHM §6 表写「0.6–0.8 基本掌握」与
        「> 0.8 已掌握」，在 0.8 处本身重叠；计划 步骤 7e 明文统一为左闭右开
        （p≥0.8 已掌握）。实现与测试一致（0.79→基本掌握、0.8→已掌握），判定可接受。

INFO-5 / apps/web 启动日志出现 postcss.config.js 的 MODULE_TYPELESS_PACKAGE_JSON 警告：
        仅性能提示，不影响启动（vite ready、curl 命中「知微」=1）。
        建议后续在 apps/web/package.json 补 "type": "module"。

INFO-6 / 题库独立复算脚本与生成器置于 /tmp（偏差 D3/D5）：已如实记录，且未新增清单外
        文件，符合计划 四、的封闭清单要求；副作用是「50 题复算」证据无法在仓库内重跑。
        本次审查已由审查者另写一套实现重新覆盖，结论一致。
        建议迭代 2 授权新增 scripts/verify_items.py 将复算能力固化入库。

-------------------------------------------------
三、题目抽查验算明细表
-------------------------------------------------

3.1 主样本：每 kp 抽 2 题，共 40 题（随机种子 20260919）
    验算方法：answer 用与 solution_steps 不同的第二种方法复算；
              solution_steps 逐步复算并核对末步与 answer 一致；
              distractor 逐条验证是否为该 typical_error_code 描述错误路径的真实计算值。

  #  item_id                kp 短名            结论  备注（复算要点）
  ------------------------------------------------------------------------------
  1  q_cz_basic_011         algebra.basic      PASS  3(x+y)-5=3×4-5=7；干扰项 2 = 3+4=7 再 -5（先做加法）真路径
  2  q_cz_basic_002         algebra.basic      PASS  2a+1=6+1=7；干扰项 6 = (2+a)+1 = 5+1
  3  q_cz_identity_006      algebra.identity   PASS  (x+1)^2 按分配律展开 = x^2+2x+1
  4  q_cz_identity_003      algebra.identity   PASS  (x+3)^2-4 展开回代 = x^2+6x+5 ✓；(x+6)^2-31（未折半）、(x+3)^2+5（未减 9）均为真错误路径
  5  q_cz_func_concept_011  function.concept   PASS  4-x≥0 ⇒ -x≥-4 ⇒ x≤4（变号方向正确）
  6  q_cz_func_concept_006  function.concept   PASS  整式解析式定义域为全体实数
  7  q_cz_func_graph_007    function.graph     PASS  第二象限 (-3,5)；三干扰项分别落第三/第一/第四象限，(5,-3) 系横纵颠倒
  8  q_cz_func_graph_009    function.graph     PASS  x=0 ⇒ y=4 ⇒ (0,4)；干扰项 (4,0) 为 x 轴交点
  9  q_cz_linear_005        function.linear    PASS  b=1、k+1=-1⇒k=-2；y=-2x+1 代回 (0,1)(1,-1) 均成立
  10 q_cz_linear_001        function.linear    PASS  k≠0 定义判断，三干扰项错因说明均正确
  11 q_cz_applic_002        application        PASS  周长 20 ⇒ 两邻边和 10 ⇒ S=x(10-x)；干扰项漏除 2
  12 q_cz_applic_007        application        PASS  周长 24 ⇒ 两邻边和 12 ⇒ S=x(12-x)
  13 q_cz_comp_sq_002       completing_square  PASS  (6÷2)^2=9；干扰项 36=6^2（未折半）真路径
  14 q_cz_comp_sq_009       completing_square  PASS  (x+1)^2=-4 ⇒ 无实数根；干扰项 ±2-1 ⇒ -3、1 为真错误路径
  15 q_cz_concept_001       concept            PASS  y=3x^2-2x+5 ⇒ a=3,b=-2,c=5
  16 q_cz_concept_006       concept            PASS  a=1≠0 是二次函数；顶点 y=1-2+1=0 ≠ c=1，干扰项说明正确
  17 q_cz_eq_concept_010    eq_concept         PASS  x(x+2)=0 ⇒ 0、-2 ⇒ x1=-2,x2=0
  18 q_cz_eq_concept_001    eq_concept         PASS  x^2=16 ⇒ ±4；干扰项只取算术根
  19 q_cz_eq_rel_007        eq_relation        PASS  Δ=16-16=0 ⇒ 与 x 轴 1 个交点（(x-2)^2 复算一致）
  20 q_cz_eq_rel_001        eq_relation        PASS  (x-1)(x-3)=0 ⇒ (1,0) 和 (3,0)；干扰项 (0,3) 为 y 轴交点
  21 q_cz_extremum_001      extremum           PASS  配方法 (x-2)^2+3；另用 x=-b/2a=2 代入 4-8+7=3 互验
  22 q_cz_extremum_011      extremum           PASS  x=-1 代入 3-6+7=4；3(x+1)^2+4 展开回代 = 3x^2+6x+7 ✓
  23 q_cz_factoring_011     factoring          PASS  (x-3)(x-4) 展开 = x^2-7x+12 ✓；干扰项 (x+3)(x+4) 符号取反
  24 q_cz_factoring_008     factoring          PASS  x(x+3)=0 ⇒ 0、-3
  25 q_cz_formula_010       formula            PASS  Δ=4+4=8，x=(-2±2√2)/2 = -1±√2；干扰项为未约分形式
  26 q_cz_formula_004       formula            PASS  Δ=16-16=0 ⇒ 两个相等实数根
  27 q_cz_g2v_009           general_to_vertex  PASS  (x-1)^2-4 展开 = x^2-2x-3 ✓；干扰项 (x-1)^2-3 未减 1
  28 q_cz_g2v_001           general_to_vertex  PASS  (x+1)^2 = x^2+2x+1
  29 q_cz_geometry_005      geometry           PASS  A(-1,0)、B(3,0)，AB=4；C(0,3)，S=1/2×4×3=6
  30 q_cz_geometry_009      geometry           PASS  AB=2、h=|-1|=1 ⇒ S=1；顶点 (2,-1) 复算 4-8+3=-1 ✓
  31 q_cz_graph_009         graph_basic        PASS  y=±x^2 顶点均在原点，对称轴均为 y 轴
  32 q_cz_graph_003         graph_basic        PASS  a=3>0 开口向上；|a|=3>1 开口更窄（干扰项说反）
  33 q_cz_opening_003       opening            PASS  x=-b/2a=2/2=1；最小值 = 1-2+3=2，干扰项「最小值是 1」说明正确
  34 q_cz_opening_006       opening            PASS  x=-6/2=-3；干扰项漏负号得 3
  35 q_cz_three_pts_008     three_points       PASS  解方程组 a=2,b=-3,c=-1；三点代回 y=2x^2-3x-1 全部成立
  36 q_cz_three_pts_002     three_points       PASS  a=1,b=-3,c=0；三点代回 y=x^2-3x 全部成立
  37 q_cz_translate_002     translation        PASS  右移 2 ⇒ x→x-2 ⇒ y=(x-2)^2
  38 q_cz_translate_011     translation        PASS  左 3 下 1 ⇒ (x+3-1)^2+2-1=(x+2)^2+1；两干扰项均为真错误路径
  39 q_cz_vertex_001        vertex_form        PASS  y=(x-h)^2+k ⇒ 顶点 (1,2)；干扰项 (-1,2) 未取反
  40 q_cz_vertex_013        vertex_form        PASS  顶点 (m,1) 在 y 轴 ⇒ m=0；干扰项把常数项当横坐标

  主样本结论：40/40 题 answer 数学正确、solution_steps 可复算且末步与 answer 一致、
              distractor 均为所绑定错误路径的真实计算值。0 题错误。

3.2 补充复算（审查者程序复算中因关键词误分类而人工复核的条目，共 18 题，全部 PASS）
  q_cz_comp_sq_003   PASS  x^2+6x+5=0 ⇒ 移项加 9 ⇒ (x+3)^2=4；三干扰项（-14/-5-9、5/未同步加 9、(x+6)^2=31）均为真错误路径
  q_cz_comp_sq_004   PASS  (x-2)^2=3 ⇒ x=2±√3
  q_cz_comp_sq_008   PASS  x^2-2x=0 ⇒ 加 1 ⇒ (x-1)^2=1
  q_cz_formula_002   PASS  Δ=(-6)^2-4×1×5=36-20=16
  q_cz_formula_005   PASS  Δ=1-4=-3<0 ⇒ 实数根 0 个
  q_cz_formula_006   PASS  Δ=4+12=16
  q_cz_formula_009   PASS  Δ=9-20=-11<0 ⇒ 无实数根
  q_cz_formula_011   PASS  Δ>0 ⇒ 两个不相等实数根（概念题）
  q_cz_graph_002     PASS  y=-x^2 对称轴为 y 轴（x=0）
  q_cz_opening_004   PASS  a=1>0 对称轴 x=3，左侧递减 ⇒ 减小
  q_cz_opening_005   PASS  x=-4/(-2)=2，y=-4+8-1=3
  q_cz_opening_010   PASS  对称轴 x=2、单调性描述正确（answer 完整性见 MINOR-3）
  q_cz_opening_011   PASS  -b/2=2 ⇒ b=-4
  q_cz_factoring_002 PASS  x(x-3)=0 ⇒ 0、3
  q_cz_factoring_005 PASS  平方差 (x-3)(x+3) ⇒ ±3；干扰项 x(x-9) 得 0、9
  q_cz_factoring_006 PASS  x(x+2)=0 ⇒ 0、-2
  q_cz_eq_rel_005    PASS  (x-2)(x-3)=0 ⇒ 根 2、3；顶点横坐标 2.5 的干扰项说明正确
  q_cz_geometry_011  PASS  AB=2、C(0,3)、S=1/2×2×3=3；干扰项 -3 = 1/2×(1-3)×3 未取绝对值（D4 修复已生效）

3.3 全库一致性检查（228 题全量，非抽样）
  - choice 题 answer ∈ options、options 恰好 4 个且互不重复：0 违例
  - choice 题每个错误选项都绑定了错误路径：0 遗漏（29 道 choice 题全覆盖）
  - 干扰项 answer 与标准答案同值（伪干扰项）：0 处（D4 的「答案+括号评语」断言已生效，
    q_cz_geometry_011 修复结果已核对为 -3）
  - 非 choice 题 options 为 null：0 违例
  - fill/short_answer 末步含 answer：0 违例
  - difficulty ∈ 1–5：0 违例（分布 1:20、2:60、3:68、4:60、5:20）
  - item_id 全局唯一、双池零重叠：0 违例
  - 题干重复：0；同池内题干重复：0
  - 典型错误码绑定覆盖：74/74 全部被绑定（优于执行报告所述 73）
  - 计划 五、5.2 纪律：每 kp train 难度覆盖 1–5 ✓、retest 难度全部落在 2–4 ✓、
    每 kp ≥1 道 choice 且 ≥2 道 fill ✓、item_id 前缀与计划映射表一致 ✓，均 0 违例

3.4 知识图谱校验（20 节点全量，审查者独立实现，不复用 validate_data.py）
  - 节点数与 id 顺序 = 计划 五、5.1 表 20 行：完全一致
  - prerequisites 逐行比对计划表：20/20 一致（含 #7 追加 eq_concept，属计划 1.3(3) 已留痕）
  - successors 与 prerequisites 双向互逆：0 违例
  - 引用存在（无悬空先修）：0 违例
  - DFS 三色判环：无环
  - typical_errors 共 74 条；每节点 3–5 条；code 节点内唯一
  - error_type 五类枚举全覆盖：procedural_slip 29 / concept_confusion 26 /
    method_gap 8 / prerequisite_gap 6 / misreading 5，无任何越界取值
  - 节点字段与 DATA_SCHEMA §2.2 一致（含 source{standard,item,type} 与 prerequisite_basis）

-------------------------------------------------
四、计划符合性与范围自查结论
-------------------------------------------------

4.1 文件清单符合性（对照计划 四、30 行）
  30/30 项全部存在，无缺项。计划清单外新增文件仅 3 个，且均为非业务文件：
    _pipeline/01_PLAN.md（计划自身）、_pipeline/02_EXEC_REPORT.md（执行报告）、
    _pipeline/validate_report.json（计划 八、D2 建议留档，已作为 D9 记录）。
  修改类变更：0。5 份既有 .md 文档各仅 1 条 git 提交（脚手架），确认全程只读，
  符合计划 九、5「本计划未授权的任何文件一律不得修改」。

4.2 排除项零实现（范围越界检查）
  - functions/api/src/index.ts（34 行）：仅 CloudFunctionEvent/CloudFunctionContext
    两个空接口 + main() 返回 { code: 'NOT_IMPLEMENTED' }；19 个接口仅以注释形式导航，
    无任何实现。业务关键字（await/fetch/db./collection/http）在实现代码中计数 = 0。
  - apps/web/src/App.tsx（8 行）：仅占位文案「知微 · 地基冲刺」，无业务页面。
  - SSE / 大模型调用 / 试卷识别 / 认证：全仓非 .md 文件 grep，仅 3 处注释命中
    （functions/api/src/index.ts 两处范围声明、bkt.ts 一处「不调用大模型」），
    实现代码 0 命中。
  - 云部署 / CloudBase / 数据库读写：0 命中；引擎为纯函数（无 IO 调用），
    已由 tsc + 单测在纯函数上下文中验证。
  - 归因定位（§4）/ 错误诊断（§3）/ 退出通道（§5）：未实现，
    对应 6 个参数（EXIT_UPSTREAM_THRESHOLD、SUSPECT_BASE、MAX_DEPTH、MAX_EXIT_HOPS、
    CONF_ADOPT、CONSEC_FALSE_EXIT）仅完成外置，引擎侧无消费方，属计划预期。
  - scripts/seed.js：未创建，按计划推迟。
  结论：计划 一、1.2 六类排除项零实现，无范围越界。

4.3 算法与参数正确性（本迭代重中之重）
  - config/params.json：17 键与 ALGORITHM §0 参数总表逐值核对，17/17 完全一致
    （P_S 0.10 / P_G 0.20 / P_T 0.15 / W_DIAGNOSE 1.00 / W_PAPER 0.80 /
    ALPHA_SILENT 0.10 / PRIOR_MAP {1:0.10,2:0.30,3:0.50,4:0.70,5:0.85} /
    PRUNE_THRESHOLD 0.40 / EXIT_UPSTREAM_THRESHOLD 0.60 / SUSPECT_BASE 0.60 /
    MAX_DEPTH 3 / MAX_EXIT_HOPS 2 / CONF_ADOPT 0.60 / CONSEC_FALSE_EXIT 3 /
    MAX_ITEMS 10 / CONV_VAR 0.10 / CLAMP [0.01,0.99]）。无缺键、无多键、无错值。
  - bkt.ts 与 ALGORITHM §1 逐行转译：clamp 输入 → w===0 早退 → 贝叶斯后验对错两分支 →
    权重插值 → 学习迁移 → clamp 输出，中间量零舍入。80 组差分测试与 Python 独立
    参考实现完全一致（<1e-12）。三个硬门槛复算：0.8454545→0.845 ✓、
    0.7913636→0.791 ✓、0.2444444→0.244 ✓，偏差均 <0.0005，落在 ±0.001 内。
  - applyWeakNegative：0.5 × (1−0.10) = 0.45 ✓。
  - dedup.ts：五段冒号格式 {user_id}:{space_id}:{kp}:{source}:{hour_bucket} ✓，
    hour_bucket = floor(unixTs/3600) ✓（t、t+3599、t+3600 三点时刻实测正确）。
  - selection.ts 与 ALGORITHM §2：拓扑剪枝（PRUNE_THRESHOLD）→ |mastery−0.5| 最小
    （并列取先修链更长者、再按 id 稳定排序）→ mode→pool 推导（diagnose→train、
    baseline/retest→retest）→ 已做题排除与换次优 kp → 收敛判定
    （V=P(1−P)<CONV_VAR 或 answeredCount≥MAX_ITEMS）→ remaining=MAX_ITEMS−answeredCount
    下限 0。逐条与规格一致。
  - statusBand.ts 与 ALGORITHM §6：四区间映射正确，阈值集中具名定义并注释指向 §6，
    属计划 6.4 明文允许。

4.4 测试缺口评估
  - 3 个硬门槛（0.845 / 0.791 / 0.244）均有独立用例（T1/T2/T3，toBeCloseTo 容差 1e-3）
    且实测通过，符合 ALGORITHM §1「3 条全过才算实现完成」。
  - 关键边界覆盖：clamp 越界（T5、clamp 三分支）✓、w=0 早退（T4）✓、
    剪枝取等号（S1b）✓、收敛两侧（S6/S6b）✓、MAX_ITEMS 与 remaining 下限（S7/S7b）✓、
    dedup 确定性与跨小时桶（T8a–T8e）✓、状态带边界（0.39/0.4/0.59/0.6/0.79/0.8）✓。
  - 缺口：收敛取等边界（V 恰等于 CONV_VAR）未覆盖 → 见 MINOR-1，不影响判定。
  - 计划 八、C1–C7 逐项：C1 ✓、C2 ✓、C3（triggered_by 留痕）✓、C4 ✓、C5 ✓、C6 ✓、
    C7（Test Files 2 passed、Tests 36 ≥ 15）✓。

4.5 git 历史与 D8（并行写入）一致性复核
  - 工作树干净（git status --porcelain 为空），分支仅 main，无 merge 提交（无冲突残留）。
  - 13 条提交与执行报告 六、清单一致（报告清单截至 dfb6b76，之后另有 666a52f 报告补记）。
  - cfdc441（早期引擎+测试，31 用例）的 8 个文件已被后续 0146009（引擎重写）与
    8e91003（测试重写）覆盖；当前 HEAD 的引擎与测试与计划接口一致。
  - 旧版测试遗留符号排查：rankTestableKps 在 packages/engine 中 0 命中；
    SelectionResult 不再含 testable 字段，index.ts barrel 导出符号与当前实现一致。
  - 21c6d5d 与 9907833 为同一修复（q_cz_geometry_011 干扰项改 -3）的两次提交，
    当前 HEAD 内容已核对为 -3，且全库「答案+括号评语」伪干扰项扫描结果 = 0，
    修复生效、无回退。
  - bf75dd3（C3 triggered_by）已落在当前 updateMastery 签名与返回字段中，
    并有对应用例；单测 36 例全过。
  - 结论：D8 所述并行写入未在最终状态引入不一致；最终交付状态自洽。

4.6 安全与工程纪律
  - 密钥/敏感信息：全仓非 .md 文件扫描 secret/token/password/api_key/jwt/bcrypt 等
    关键字，0 命中（validate_data.py 命中的 "code" 为正则变量名，非凭证）。
  - 参数零硬编码：ALGORITHM §0 的 17 个参数在 bkt.ts / selection.ts / dedup.ts /
    params.ts / index.ts 中 0 命中；仅 statusBand.ts 保留 3 个具名阈值常量
    （计划 6.4 明文允许）与 selection.ts 的 TARGET_MASTERY = 0.5（§2 规格常量，见 INFO-1）。
  - 注入/越权/路径遍历/日志脱敏：本迭代引擎为纯函数、零 IO、无用户输入拼接、
    无网络与数据库访问，相关攻击面不存在；validate_data.py 仅读取仓库内固定路径的
    JSON，无外部输入拼接，无日志输出敏感字段。
  - 不安全依赖：根 package.json 依赖均为精确版本（无 ^/~ 浮动），
    与计划 步骤 1b 安装清单一致；未引入运行时第三方依赖（引擎零运行时依赖）。

-------------------------------------------------
五、总体结论
-------------------------------------------------

5.1 判定依据（对照本题判定标准）
  - BLOCKER 判据逐条核验：
    (a) 题目数学错误 —— 40 题人工复算 + 55 题程序复算 + 228 题全量一致性检查，
        answer 全对、distractor 全为所绑定错误路径真实值、伪干扰项 0 处：不成立。
    (b) BKT/选题公式与 ALGORITHM 不符 —— 80 组差分测试零差异，逐行对照规格：不成立。
    (c) params.json 参数值错误 —— 17 键与 §0 逐值核对全等：不成立。
    (d) 排除项被实现 —— 19 接口仅注释、App.tsx 仅占位、SSE/大模型/识别/认证/部署
        实现代码 0 命中：不成立。
    (e) 图谱结构错误 —— 引用 0 断裂、0 成环、prereq/succ 双向互逆 0 违例：不成立。
  - MAJOR 判据：覆盖不足方面仅发现收敛取等边界一条（MINOR-1，实现已由差分测试确认
    正确）；偏差方面，D1–D10 全部在执行报告中如实记录，本次复核未发现任何
    「与计划有未记录偏差」的项：不成立。

5.2 交付质量评价
  迭代 1 的六项验证（6.1–6.6）经审查者独立复跑全部为绿：params OK 17、validate exit=0
  （8 行 PASS、0 警告）、tsc exit=0、vitest 36/36 通过、vite 启动且探活命中。
  校验闸门经负例自测证明具备真实阻断能力（10 类故障全部捕获），因此其 PASS 结论可采信。
  数据资产（20 节点图谱 + 228 题题库）是本迭代最大质量风险点，经 40 题人工二法复算与
  55 题程序复算交叉验证，未发现任何数学错误，干扰项绑定质量达标（74/74 码全覆盖、
  choice 题每个错误选项均有真错误路径）。

5.3 遗留建议（不阻塞交付，建议纳入迭代 2）
  1. 补收敛取等边界用例（MINOR-1）。
  2. 将 @types/node 写入 devDependencies（MINOR-2）。
  3. 修正 q_cz_opening_010 的 answer 完整性（MINOR-3）。
  4. 授权新增 scripts/verify_items.py，把题库复算能力固化入库（INFO-6）。
  5. 明确「无题可出」与「已收敛」的语义区分（INFO-2）、拓扑剪枝是否传递（INFO-3）。

5.4 结论
  无 BLOCKER、无 MAJOR。5 条 MINOR 均为可复现性、参考答案文本完整性与回归覆盖建议，
  不影响本迭代验收结论；6 条 INFO 为改进建议。迭代 1「地基冲刺」判定通过。

VERDICT: PASS