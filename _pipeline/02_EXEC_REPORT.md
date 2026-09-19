知微 · 迭代 1「地基冲刺」执行报告
=================================================
报告编号：02_EXEC_REPORT
执行日期：2026-09-19
执行依据：_pipeline/01_PLAN.md（唯一执行依据，未修改）
工作区：/Users/Merryou/LearnBuddy/zhiwei/
执行者角色：实现者（严格按计划步骤 1→9 顺序执行，不扩大范围）

说明：本报告为纯文本，不依赖 markdown 渲染。

-------------------------------------------------
一、逐步骤执行结果
-------------------------------------------------

步骤 1：脚手架与依赖基座 —— 状态：完成
  实际产出：
    - 目录：config data/knowledge/math data/item_bank/math scripts
            packages/engine/{src,tests} apps/web/src functions/api/src
    - 根 package.json（scripts: dev / test / typecheck；依赖声明为精确版本）
    - tsconfig.base.json、.gitignore（含 node_modules/ dist/ .DS_Store .learnbuddy/）
    - apps/web 9 个文件（package.json / tsconfig.json / vite.config.ts /
      tailwind.config.js / postcss.config.js / index.html / src/main.tsx /
      src/App.tsx / src/index.css），App.tsx 仅占位文案「知微 · 地基冲刺」
    - functions/api 2 个文件（package.json + src/index.ts 空入口，仅 NOT_IMPLEMENTED 返回）
    - packages/engine 的 package.json、tsconfig.json
    - node_modules 软链 → /Users/Merryou/.workbuddy/binaries/node/workspace/node_modules
    - 依赖安装：npm install 到隔离 workspace（170 packages），无 -g
    - git init 已于本步骤完成后执行（首次提交 9b4257d）
  与计划的偏差：安装清单外增装 @types/node@22.7.5（见 三、偏差 D1）

步骤 2：config/params.json —— 状态：完成
  实际产出：ALGORITHM §0 全部 17 项外置（PRIOR_MAP 键为字符串 "1"–"5"，CLAMP=[0.01,0.99]）
  验证：六、6.2 输出「params OK: 17」
  与计划的偏差：无

步骤 3：data/knowledge/index.json —— 状态：完成
  实际产出：subjects[0].key=math，stages[0]={cz, 初中数学, kb_math_cz,
            data/knowledge/math/cz.json}，严格照 DATA_SCHEMA §2.1
  验证：随 6.3 通过（validate_data.py 经 index.json 定位图谱文件）
  与计划的偏差：无

步骤 4：scripts/validate_data.py（校验闸门先行）—— 状态：完成
  实际产出：单文件，函数划分 load_json / find_knowledge_file / check_graph_structure /
            check_graph_meta / check_node_style / check_typical_errors / check_item_bank /
            check_quota / check_distractors / check_params / check_sample_items /
            check_bank_consistency / check_node_style / pool_stats / report_stats / main
            覆盖 DATA_SCHEMA §6 全部 6 项（1–5 阻断、6 统计报告），并实现计划授权的附加校验
            a（params 17 键，阻断）b（train 难度覆盖 1–5，警告）c（sample_items 引用，阻断）
            d（题型枚举 + options 规则，阻断）e（difficulty 1–5，阻断）
  额外证据（负例阻断自测）：构造 /tmp/zw_bad 坏数据集运行本脚本 → exit=1，输出 27 条阻断项，
            覆盖 id 重复、互逆失败、typical_errors 不足、kp 引用不存在、pool 非法、
            item_id 双池重叠、difficulty 越界、options 规则、干扰项 code 不存在、sample_items 悬空；
            另以 3 组内联用例单测 DAG 判环（三元环通过、无环链通过、自环通过）
  验证：六、6.3 exit=0（数据齐备后）
  与计划的偏差：无（超出 §6 的附加项均为计划 步骤 4 明确授权）

步骤 5：data/knowledge/math/cz.json（20 节点知识图谱）—— 状态：完成
  实际产出：meta{subject,stage,kb_id,version,primary_standard,node_count,updated_at} + nodes[20]
            20 节点字段严格按 DATA_SCHEMA §2.2；节点清单/章节/难度/先修/grade 按计划 五、5.1
            successors 由 prerequisites 全表推导生成（保证互逆），按节点序号稳定排序
            typical_errors 每节点 3–5 条共 74 条；code 节点内唯一；每节点 error_type ≥2 种；
            五类枚举全覆盖（procedural_slip 29 / concept_confusion 26 / method_gap 8 /
            prerequisite_gap 6 / misreading 5）；prerequisite_gap 落在 #12/#14/#16/#18/#19
            sample_items 指向本 kp 的首个 train 题与首个 retest 题（题库产出后引用成立）
  验证：六、6.3 校验 1/2 PASS + 附加c PASS；统计报告节点数=20、错误条数=74
  与计划的偏差：无（#7 追加 eq_concept 先修属计划 1.3(3) 已留痕事项）

步骤 6：data/item_bank/math/cz.json（题库 228 题）—— 状态：完成
  实际产出：meta + items[228]，配额与计划 五、5.2 完全一致：
            train 104 + retest 124 = 228；#7/#13/#14/#16 四个加量 kp 为 train 6 + retest 7，
            其余 16 个 kp 为 train 5 + retest 6；20 个 kp 全部满足 train≥5、retest≥6
            item_id 全局唯一、双池零重叠，短名前缀与计划映射表一致
            train 池难度覆盖 1–5；retest 池难度落在 2–4；每 kp 至少 1 道 choice（4 选项）、≥2 道 fill
            distractors 绑定 73 个 typical_error code（图谱 code 全集的 100%，无未绑定 code）
  生产纪律（计划 五、5.4）：
    生成顺序：先定 kp 的 typical_errors code 全集 → 再出题（生成器断言 code ∈ 该 kp 集合）
    查1：所有数值答案由公式计算并用第二种方法复算后断言相等（顶点：4ac−b²/4a 与代回求值互验；
         方程根：代回原方程断言为 0；配方/展开：展开系数回代比对）
    查2：生成时断言 fill/short_answer 的 solution_steps 末步文本必须包含 answer，全部通过
    查3：每条 distractor 的值由该 typical_error_code 描述的错误路径显式计算，
         并新增断言禁止「答案+括号评语」式伪干扰项（该断言已捕获并修掉 1 处，见 三、偏差 D4）
    数值设计：|a|≤3、|b|,|c|≤9，顶点/对称轴/根/判别式均为整数或简单分数；负号统一用普通连字符 "-"
    抽检兜底：独立编写的复算脚本（另一套解析+推导实现，位于 /tmp 不入仓库）从落盘 JSON 的题干
         重新解析系数并重算答案，覆盖 50 题（>计划要求的约 40 题）、不一致 0 题
  验证：六、6.3 校验 3/4/5 PASS；统计报告题数 228（train 104 + retest 124）
  与计划的偏差：D3（生成方式为参数化模板生成器而非逐题手写，成品为纯 JSON 数据资产）、
                D5（抽检脚本置于 /tmp 以不新增清单外文件）；生成器与复算脚本内容不落仓库

步骤 7：BKT 引擎 packages/engine/src —— 状态：完成
  实际产出（6 文件，全部新建）：
    params.ts：Params 接口（17 键）、PARAM_KEYS、DEFAULT_PARAMS_PATH、loadParams（默认
               config/params.json，resolve(process.cwd(), path)，加载后做键完整性断言）、
               priorFor（PRIOR_MAP 查询）；源码无任何参数字面值
    bkt.ts：clamp / updateMastery（clamp 输入 → w===0 早退 → 贝叶斯后验 → 权重插值 →
            学习迁移 → clamp 输出，中间量零舍入）/ applyWeakNegative（P×(1−ALPHA_SILENT)）
    dedup.ts：SECONDS_PER_HOUR / hourBucket / buildDedupKey（五段冒号）/
              isDuplicateKey / isDuplicateEvidence（纯判断，查重落库属迭代 2）
    selection.ts：GraphNode / BankItem / SelectionState / SelectionMode / nextItem
              （① 拓扑剪枝 → ② |mastery−0.5| 最小 + 先修链更长者并列规则 → ③ mode 推导池 +
              排除已做 + 无题换次优 kp → ④ 收敛判定优先于出题 → ⑤ remaining 下限 0）；
              poolForMode 单独导出便于契约测试
    statusBand.ts：四区间映射（<0.4 待巩固 / 0.4–0.6 不稳定 / 0.6–0.8 基本掌握 / ≥0.8 已掌握）
              与颜色常量（暖橙/黄/浅青绿/青绿）
    index.ts：barrel 导出全部公共符号与类型
  验证：六、6.4 tsc --noEmit 无输出、exit 0；反硬编码 grep 结果见 二、6.4
  与计划的偏差：D2（statusBand.ts 保留三个具名阈值常量，为计划 6.4 明文允许）、
                D6（params.ts 增 priorFor 小工具；updateMastery 增第 5 个可选留痕参数）

步骤 8：BKT 单元测试 packages/engine/tests —— 状态：完成
  实际产出（2 文件）：bkt.test.ts 20 例、selection.test.ts 16 例
    bkt.test.ts：T1 0.845 / T2 0.791 / T3 0.244（toBeCloseTo 容差 1e-3，即 ±0.001）
                 T4 w=0 早退四值相等、T5 越界 clamp、T6 弱负证据 0.45
                 T7 中间量（p_obs≈0.818、p_eff≈0.818、T2 p_eff≈0.7545）
                 T8a–T8e dedup_key 确定性/跨小时桶/五段格式/source 与 kp 隔离/纯判断
                 另含 params 17 键与 PRIOR_MAP/CLAMP 校验、三段式独立复算、
                 状态带四区间与颜色（验收 C6）、C3 留痕字段用例
    selection.test.ts：S1 剪枝（0.3<阈值 → 后继不可测并记入 prunedKps）、S1b 阈值取等号边界、
                 S2 根节点天然可测、S3 信息增益 0.5 优于 0.9、并列取先修链更长者、
                 S4 池推导（diagnose→train / baseline→retest）、S5 已做排除与换次优 kp、
                 S6 收敛（0.95 → V=0.0475<0.1）、S7 收敛（answeredCount≥MAX_ITEMS）与 remaining
                 测试数据为内联 fixture（4 节点小图 + 10 题），不依赖 data/ 真实文件
  验证：六、6.5 Test Files 2 passed (2) / Tests 36 passed (36)
  与计划的偏差：D7（工作区已存在一版与计划 API 不一致的旧测试，已备份 /tmp 后按计划重写）

步骤 9：全量验收与交付留痕 —— 状态：完成
  实际动作：a 依序执行 6.2→6.3→6.4→6.5→6.1（全部通过，输出见 二）
            b 范围自查：全仓 grep 未发现 SSE/大模型/识别/认证/部署实现类代码，
              仅 3 处注释型命中（functions/api/src/index.ts 的接口导航注释与排除声明、
              bkt.ts 的「不调用大模型」注释）；functions/api/src/index.ts 共 34 行、
              业务关键字（await/fetch/db./collection/http）计数 = 0；apps/web/src/App.tsx
              仅占位文案，无业务页面
            c 校验统计报告落盘 _pipeline/validate_report.json（计划 八、D2 建议）
            d 按模块分批 commit（见 五）
  与计划的偏差：无

-------------------------------------------------
二、全部验证命令的实际输出摘要
-------------------------------------------------

环境常量展开：
  $NODE = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/node
  $NPM  = /Users/Merryou/.workbuddy/binaries/node/versions/22.22.2/bin/npm
  $WS   = /Users/Merryou/.workbuddy/binaries/node/workspace
  $PY   = /Users/Merryou/.workbuddy/binaries/python/envs/default/bin/python3 (Python 3.13.12)

[6.1] 前端空壳启动（关键数字）
  命令：cd /Users/Merryou/LearnBuddy/zhiwei/apps/web && $NODE $WS/node_modules/vite/bin/vite.js
        curl -s http://localhost:5173/ | grep -c "知微"
  输出：VITE v5.4.8 ready in 206 ms，Local: http://127.0.0.1:5173/
        curl grep -c 知微 = 1（预期 ≥1，符合）
        附加探活 curl -o /dev/null -w "%{http_code}" /src/App.tsx = 200
  结果：通过（后台进程已终止，无残留报错）

[6.2] params.json 完整性（关键数字）
  输出：params OK: 17
  结果：通过（17 键与 ALGORITHM §0 完全一致，无缺键、无多余键）

[6.3] 静态数据校验（关键数字）
  命令：cd /Users/Merryou/LearnBuddy/zhiwei && $PY scripts/validate_data.py
  输出（逐行）：
    [PASS] 校验 附加a params.json 参数表（ALGORITHM §0 全部 17 键）
    [PASS] 校验 1 图谱结构（id 唯一 / 引用存在 / prereq-succ 互逆 / DAG 无环；阻断）
    [PASS] 校验 2 typical_errors（五类枚举 / 每节点 ≥3 条；阻断）
    [PASS] 校验 3 题库（item_id 全局唯一 / kp 引用 / pool 合法 / 字段完整；阻断）
    [PASS] 校验 4 配额（每 kp train ≥5、retest ≥6、总量 ≥220；阻断）
    [PASS] 校验 5 distractors 绑定（typical_error_code 存在于该 kp；阻断）
    [PASS] 校验 附加c sample_items 引用存在性（阻断）
    [STATS] 校验 6 · 静态数据统计报告
            知识图谱：节点数 = 20；typical_errors 总条数 = 74
            题库总量：228 题（train 104 + retest 124）
    [PASS] 全部阻断项通过（DATA_SCHEMA §6 校验 1–6 通过）
  exit=0；PASS 行数 8；WARN 0 条
  逐 kp 配额明细（统计报告，与计划 五、5.2 一致）：
    algebra.basic 5+6 | algebra.identity 5+6 | function.concept 5+6 | function.graph 5+6
    function.linear 5+6 | eq_concept 5+6 | completing_square 6+7 | formula 5+6
    factoring 5+6 | concept 5+6 | graph_basic 5+6 | opening 5+6 | vertex_form 6+7
    general_to_vertex 6+7 | translation 5+6 | extremum 6+7 | three_points 5+6
    eq_relation 5+6 | application 5+6 | geometry 5+6
  统计报告已另存：_pipeline/validate_report.json

[6.4] 引擎类型检查（关键数字）
  命令：cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/typescript/bin/tsc --noEmit
        -p packages/engine/tsconfig.json
  输出：无输出；exit=0（输出行数 0）
  反硬编码 grep：grep -nE "0\.1[05]?|0\.2[0]?|0\.4[05]?|0\.6[05]?|0\.85" packages/engine/src/*.ts
  命中明细（共 7 行，全部位于 statusBand.ts）：
    statusBand.ts:5/6/7/10/11 —— 注释中的规格区间说明
    statusBand.ts:16/17 —— BAND_THRESHOLD_UNSTABLE = 0.4、BAND_THRESHOLD_MASTERY = 0.6
  零命中文件：bkt.ts、selection.ts、params.ts、dedup.ts、index.ts
  结果：通过（阈值以具名常量集中定义于 statusBand.ts 顶部并注释指向 ALGORITHM §6，
        属计划 6.4 明文允许项；参数类数值在引擎源码中零硬编码）

[6.5] BKT 单元测试（迭代硬门槛，关键数字）
  命令：cd /Users/Merryou/LearnBuddy/zhiwei && $NODE $WS/node_modules/vitest/vitest.mjs run
  输出：
    RUN  v2.1.1 /Users/Merryou/LearnBuddy/zhiwei
    ✓ packages/engine/tests/selection.test.ts  (16 tests)
    ✓ packages/engine/tests/bkt.test.ts        (20 tests)
    Test Files  2 passed (2)
    Tests       36 passed (36)
  预期核对：Test Files 2 passed ✓；Tests ≥15（实际 36）✓；
            T1 0.845 / T2 0.791 / T3 0.244 三个自检用例全过 ✓
  结果：通过，exit=0

[6.6] 全量回归
  依序 6.2 → 6.3 → 6.4 → 6.5 → 6.1：五项全绿（exit 0 / 0 / 0 / 0 / grep=1），交付条件满足

[附] 题库独立复算（计划 五、5.4e 抽检兜底，非计划六命令）
  输出：独立复算覆盖：50 题通过；跳过（非模板族）178 题；不一致 0 题
        查2（fill/short_answer 末步含 answer）全部通过
  覆盖族：顶点坐标/对称轴/最值/取最值时的 x/判别式/方程解/与 x 轴交点及个数/与 y 轴交点/
          因式分解/配方补项/顶点式互化/单步平移/线段长/三角形面积/待定系数法三点反代
  结果：通过

-------------------------------------------------
三、与计划的偏差清单
-------------------------------------------------

D1【依赖清单外增装 @types/node@22.7.5】原因：计划 步骤 7a 要求 params.ts 读 config/params.json
   并使用 process.cwd() 解析路径，而 tsc --noEmit 需要 node 类型（fs/path/process）；计划 步骤 1b
   的安装清单未含该包。处置：在隔离 workspace 增装该开发期类型包（零运行时依赖，仅类型），
   已记录并纳入 6.4 实测。影响：无运行时代码与依赖树变更（workspace 由 170 增至 173 packages）。

D2【statusBand.ts 保留 0.4/0.6/0.8 具名阈值常量】原因：计划 6.4 一处要求三文件「零命中」，
   另一处明文允许「状态带阈值属规格常量，允许以命名常量集中定义于 statusBand.ts 顶部，
   并注释指向 ALGORITHM §6」。处置：按后者的明文允许执行（不做 4/10 之类的改写以保持可读性），
   并在 二、6.4 如实列出全部 7 行命中明细，供复核。影响：仅注释与 2 个阈值常量命中。

D3【题库生产方式为参数化模板生成器】原因：228 题要求数值小整数、答案整数或简单分数、
   干扰项须为错误路径真实值；模板化生成 + 内置双方法断言可显著降低人工验算出错概率。
   处置：生成器置于 /tmp（不入仓库、不新增清单外文件），成品为纯 JSON 数据资产；每题仍是
   独立题目（独立数值、独立题干、独立解答步骤与干扰项）。影响：题库内容无差异。

D4【新增“禁止答案+括号评语式伪干扰项”断言并修掉 1 处】原因：复核时发现 q_cz_geometry_011
   的干扰项原写作「3（把高写成横坐标相减的结果）」，其数值与标准答案 3 相同，属伪干扰项。
   处置：改为错误路径真实值 -3（底算成 1-3=-2，面积 1/2×(-2)×3=-3），并在生成器中加入断言
   防止同类问题；修复后重跑 6.3（exit 0）与独立复算（0 不一致）。影响：仅该题 1 条干扰项。

D5【抽检复算脚本置于 /tmp，不进仓库】原因：计划四、为封闭的 32 项清单，未授权新增脚本文件。
   处置：独立复算脚本与题库生成器均放 /tmp，执行结果在本报告留档（50 题 0 差异）。
   影响：复算能力不可在仓库内重跑；如需固化，建议迭代 2 授权 scripts/ 下新增脚本。

D6【引擎接口的 2 处小幅增补】原因与处置：
   (a) updateMastery 增加第 5 个可选参数 triggeredBy（默认 null）并在结果中返回 triggered_by，
       以满足验收 C3「updateMastery 返回 before/p_obs/p_eff/after/weight/triggered_by」
       与 ALGORITHM §1「留痕」。该字段不参与任何计算，计划 步骤 7b 的 6 个字段保持不变。
   (b) params.ts 增导 priorFor(selfReport, params)（PRIOR_MAP 查询）与 DEFAULT_PARAMS_PATH 常量，
       便于调用方使用自报档位映射，不引入新参数、不改变 §0 参数表。
   影响：向后兼容（原 4 参调用行为不变，单测覆盖）。

D7【重写工作区中已存在的旧版测试文件】原因：执行 步骤 8 时发现 packages/engine/tests 下已存在
   一版测试，其 API 与计划不一致（引用未实现的 rankTestableKps、以 clamp(x, CLAMP) 形式调用、
   nextItem 返回 testable 字段而非计划的 {item, converged, remaining, prunedKps}）。
   处置：先备份至 /tmp/stale_bkt.test.ts、/tmp/stale_selection.test.ts，再按计划 步骤 8 的
   T1–T8 / S1–S7 清单重写。影响：测试与计划接口一致（6.4/6.5 均以当前版本实测）。

D8【工作区存在非本报告作者显式发起的提交】现象：git log 中出现 cfdc441（早期一版引擎+测试，
   31 用例）、21c6d5d（题库干扰项复核修正）、bf75dd3（补齐 C3 的 triggered_by 字段与用例）、
   26f4d52（图谱，提交信息形态与本报告命令不同）。除 21c6d5d（与 D4 同内容）与 bf75dd3（与
   D6a 同内容）外，其余提交的产物已被本报告的后续步骤覆盖或用重写版本替代。处置：不删除、
   不回滚这些提交；对当前工作树独立复验（6.3 exit 0、6.4 exit 0、6.5 36 用例全过、独立复算
   0 不一致），确认最终交付状态自洽。影响：历史含一版被取代的测试实现（其测试文件已被重写）。

D9【清单外文件 1 个】_pipeline/validate_report.json：为计划 八、D2「统计报告已保存留档
   （建议存 _pipeline/）」建议产物，非业务文件，非清单四、的 32 项内容。

D10【计划四、计数口径】计划 四、写「合计：32 个文件（30 新建 + 1 软链 + .gitignore）」，
   但清单实际列出 30 行且 node_modules 软链与 .gitignore 已在其中。实际核对：清单 30 行全部就位，
   无缺项、无额外业务文件。

-------------------------------------------------
四、未完成项与阻塞项
-------------------------------------------------

阻塞项：无。步骤 1–9 全部完成，六、6.1–6.6 五项全绿。

未完成项：无属于本迭代范围的项目遗留。以下为按计划 一、1.2「明确排除」而有意未实现的内容，
已按纪律未写一行相关代码（发现「顺手可做」时停止并在此留痕）：
  - 后端 19 个 API 接口逻辑（functions/api/src/index.ts 仅空入口 + TODO 与 19 接口导航注释）
  - 前端 10 个业务页面（App.tsx 仅占位文案）
  - SSE、大模型调用、试卷识别、认证逻辑（全仓 grep 无实现类命中）
  - 云部署 / CloudBase 环境 / 数据库读写（引擎为纯函数，无 IO 调用）
  - 归因定位（§4）、错误诊断（§3）、退出通道（§5）——因此 config/params.json 中的
    EXIT_UPSTREAM_THRESHOLD、SUSPECT_BASE、MAX_DEPTH、MAX_EXIT_HOPS、CONF_ADOPT、
    CONSEC_FALSE_EXIT 仅完成外置，引擎侧暂无消费方（属本迭代预期）
  - scripts/seed.js（依赖云环境，计划明确推迟）
  另有 1 处「可顺手做但未做」记录：workspace 中可另建 vitest 配置文件以显式声明 include，
  当前依赖 vitest 默认发现规则（已验证可正确发现 2 个测试文件），故未新增清单外文件。

-------------------------------------------------
五、最终文件清单核对（对照计划 四、）
-------------------------------------------------

清单共 30 行，逐项核对结果（全部存在；新建/软链标注与实际一致）：
  OK  /Users/Merryou/LearnBuddy/zhiwei/package.json                        新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/tsconfig.base.json                  新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/.gitignore                          新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/node_modules                        软链 → workspace/node_modules
  OK  /Users/Merryou/LearnBuddy/zhiwei/config/params.json                  新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/data/knowledge/index.json           新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/data/knowledge/math/cz.json         新建（20 节点 / 1004 行）
  OK  /Users/Merryou/LearnBuddy/zhiwei/data/item_bank/math/cz.json         新建（228 题 / 5689 行）
  OK  /Users/Merryou/LearnBuddy/zhiwei/scripts/validate_data.py            新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/package.json        新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tsconfig.json       新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/params.ts       新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/bkt.ts          新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/dedup.ts        新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/selection.ts    新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/statusBand.ts   新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/src/index.ts        新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tests/bkt.test.ts   新建（20 用例）
  OK  /Users/Merryou/LearnBuddy/zhiwei/packages/engine/tests/selection.test.ts 新建（16 用例）
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/package.json               新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/tsconfig.json              新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/vite.config.ts             新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/tailwind.config.js         新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/postcss.config.js          新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/index.html                 新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/main.tsx               新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/App.tsx                新建（占位文案，无业务）
  OK  /Users/Merryou/LearnBuddy/zhiwei/apps/web/src/index.css              新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/functions/api/package.json          新建
  OK  /Users/Merryou/LearnBuddy/zhiwei/functions/api/src/index.ts          新建（空入口占位）

仓库跟踪文件共 36 个 = 清单 30 项 + 5 份既有 .md（只读，未修改）+ _pipeline/01_PLAN.md。
修改类变更：无。5 份既有 .md 文档均未修改（只读遵守）。
清单外文件：_pipeline/02_EXEC_REPORT.md（本报告）、_pipeline/validate_report.json（计划 D2 建议留档）。

验收清单（计划 八、）逐项结论：
  A1 通过（6.1：vite 启动 + curl 命中「知微」）        A2 通过（6.2：params OK: 17）
  A3 通过（6.4 grep：仅 statusBand.ts 具名阈值与注释命中）  A4 通过（范围自查）
  A5 通过（范围自查：无 SSE/大模型/识别/认证/部署实现代码）
  B1–B5 通过（6.3 校验 1–5 全 PASS）                   B6 通过（校验 6 统计报告 + JSON 留档）
  C1 通过（T1/T2/T3）                                  C2 通过（dedup_key 确定性 + 小时桶测试）
  C3 通过（triggered_by 留痕字段 + 用例）               C4 通过（applyWeakNegative 0.5→0.45）
  C5 通过（剪枝/信息增益/池推导/已做排除/收敛 均有测试） C6 通过（状态带四区间 + 颜色）
  C7 通过（Test Files 2 passed、Tests 36 passed）
  D1 通过（6.6 五项全绿）                              D2 通过（validate_report.json 留档）
  D3 通过（分模块 commit，见 六、）

-------------------------------------------------
六、git commit 记录摘要（留痕纪律：每完成一个模块立刻 commit）
-------------------------------------------------

按时间顺序（仓库：/Users/Merryou/LearnBuddy/zhiwei，分支 main）：
  9b4257d  iter1 脚手架：目录骨架、根 package.json/tsconfig、前端空壳、云函数空入口、引擎包骨架
           （依赖装至隔离 workspace + node_modules 软链）
  8ac76eb  iter1 参数与校验闸门：config/params.json（17 键外置）+ data/knowledge/index.json +
           scripts/validate_data.py（DATA_SCHEMA §6 全 6 项校验，含负例阻断自测）
  26f4d52  iter1 知识图谱：20 节点 + 74 条典型错误
  f20cce8  iter1 题库：228 题（train 104 + retest 124），item_id 全局唯一，
           distractors 绑定 73 个 typical_error code（独立复算 50 题零差异）
  cfdc441  iter1 BKT 引擎：params/bkt/dedup/selection/statusBand 六文件 + 单测 2 文件
           （31 用例全过，含 ALGORITHM §1 三个自检用例）  ※另一次执行的产物，见偏差 D8
  21c6d5d  iter1 题库复核修正：q_cz_geometry_011 干扰项答案改为错误路径真实值（-3）  ※同上
  0146009  iter1 BKT 引擎：params/bkt/dedup/selection/statusBand/index
           （纯函数零 IO，参数全部外置，typecheck 通过）
  8e91003  iter1 单测：bkt.test.ts(T1-T8+C6) + selection.test.ts(S1-S7)，Tests 35 passed
  9907833  iter1 题库复核修正：q_cz_geometry_011 干扰项改为 -3，生成器新增伪干扰项断言
  bf75dd3  iter1 补齐验收 C3：updateMastery 返回 triggered_by 留痕字段 + 对应用例  ※同上

说明：工作区中出现的另一次执行产物（cfdc441 / 21c6d5d / bf75dd3）未被删除或回滚，
其有效内容（C3 留痕字段、题库干扰项修正）已纳入最终交付并经独立复验；其被取代的旧版测试
文件已按计划重写（偏差 D7）。

-------------------------------------------------
七、结论
-------------------------------------------------

迭代 1「地基冲刺」按计划 步骤 1→9 顺序执行完毕：脚手架可启动、参数全部外置、20 节点知识图谱
（74 条典型错误、DAG 且引用互逆）、228 题题库（train 104 + retest 124、干扰项绑定 73 个错误码、
独立复算 50 题零差异）、校验闸门覆盖 DATA_SCHEMA §6 全部 6 项（并具备负例阻断能力）、
BKT 引擎（三段式 + 弱负证据 + dedup + 自适应选题 + 状态带）typecheck 无错误、
单元测试 36 例全过（含 ALGORITHM §1 三个硬门槛用例），六、6.1–6.6 全量回归五项全绿。
无未完成阻塞项；计划 一、1.2 的排除项均未实现任何代码。
