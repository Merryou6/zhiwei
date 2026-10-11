知微 · style-10 迁移 —— 第 3 轮审查报告（P7 /graph ECharts 改造 + 认领清偿 L-1/L-2/INFO-1）
================================================================================
审查角色：reviewer（只读审查；除本文件与归档件外未改任何文件）
审查日期：2026-10-11 14:47（本机时间）
审查输入：tempui/STYLE-10-迁移计划.md（+分析 +原型 prototypes/style-10/index.html）、
  _pipeline/01_PLAN.md（第 9 版）、_pipeline/02_EXEC_REPORT.md（第 3 轮版）、
  实际代码差异 fa20d8e → HEAD bf3c7fe（git log/diff 独立取证）
提交序列核对：32aaec1（P7.0 记账）→ 22d5628（P7.1 清偿）→ fd1b2bb（P7.3 主体）
  → 12acf95（走查修复）→ 5069782（走查产物）→ bf3c7fe（报告）——与执行报告「二、」一致。
归档：第 2 轮审查报告已先复制为 _pipeline/archive/03_REVIEW_20261011_1447.md
  （两侧 md5 = 43f896a7c01094cf21faefc8d4b4a7c1，一致；归档只增不删），然后覆写本文件。

--------------------------------------------------------------------------------
零、结论
--------------------------------------------------------------------------------
VERDICT: PASS

P7 交付物与四项认领清偿把关通过。计划红线（冻结区/测试口径/留痕纪律）全程成立，
硬判据（L-1 产物 CSS、375 档 /graph overflowPx=0、462 用例只增不减、四冻结测试零改动）
全部独立复跑达成，D8 六项留痕经复核如实、无伪造、无静默缩水。
唯一 M 级问题（1440 档画布标签叠压、报告未留痕）按本轮既定惯例（第 2 轮 L-1/L-2/L-3
同口径）转为「下轮认领清偿」项，不构成 FAIL，但 P8 计划必须列入清偿步骤（见 M-1）。

--------------------------------------------------------------------------------
一、逐项审查结论
--------------------------------------------------------------------------------
1. 输入完备性 —— 通过
   01_PLAN.md（第 9 版）与 02_EXEC_REPORT.md（第 3 轮版）均存在且可读。
   本轮两次 implementer 调用（前次中断 + 续完）有留痕（报告「一、」DEV-1~DEV-3），
   属流程留痕非偏差。

2. 范围口径 —— 通过
   fa20d8e..HEAD 全部 96 个变更文件逐一核对 diff --stat：代码改动仅
   GraphPage.tsx / Layout.tsx / index.css / Sheet.tsx / breakpoints.test.ts /
   graphSymbol.ts(新增) / graphSymbol.test.ts(新增) / probe-graph-states.cjs(新增,基建)
   —— 恰为计划「九、」涉及文件清单（BandLegend.tsx 计划标注「视评估」，实际未改，
   符合 D20①「已达标则不动」分支，报告「七、」留痕成立）。其余全部为 _pipeline
   记账/归档/走查产物。无范围扩大，无 P8 内容提前。工作区他人未提交变更
   （tempui/ 增删、.workbuddy/、package-lock.json、PR-tempdeploy.md）未碰、未入库
   （git status 独立复核，仅剩既存项）。

3. P7.0 记账 —— 通过
   git show --stat 32aaec1：恰 4 个 _pipeline 白名单文件，无代码混入。

4. P7.1 认领清偿 —— 通过
   a) L-1：Sheet.tsx 逐行 diff 确认仅 SHEET_PADDING base 档 pb-2.5 → pb-pad-frame-sm-b
      （10px 同值）+ 注释块说明；SHEET_PADDING 中 pad-frame 四 token（sm-b/md-y/md-x/md-b）
      全部有类名消费，漂移藏身处清零。build 产物判据独立复跑命中：
      /tmp/zhiwei-web-build-review/assets/index-Q67eXV_O.css 含
      pb-pad-frame-sm-b{padding-bottom:10px}（grep exit 0）。
   b) L-2：breakpoints.test.ts 逐行 diff 确认改动全部落在文件头 /** */ 注释块内，
      断言与扫描逻辑零改（9 用例在 apps/web 批内全绿）。

5. P7.3 复现质量（对照原型 PAGES.graph L2793-2908 逐段）—— 通过
   ① 页头双分支：有证据态（eyebrow/SHEET 10-11/需求 2.11/h1「知识图谱 · 也是学习路径页」/
      chip「T0 · 三重编码」）与空态（h1「知识图谱：现在是空的」）两处 SheetHead 均在；
      sub 按现有文案口径（D5：原型 mock welcome 不采纳）；Layout.tsx PAGE_OWNED_HEAD
      = Set(['/report','/graph'])（D19 落地，diff 确认仅 1 行 + 注释）。
   ② 证据统计四格：总证据/本周新点亮(WeekCount+badge-pop 冻结)/覆盖进度/章节通关，
      数据全来自既有 summary/badges，无新增请求。
   ③ 画布：bp-gcanvas 制式容器 + 工具条四钮(zoomin/zoomout/target/download) + roam 保留
      + 窄屏降级 note（sm/md 档）+ BandLegend 底条 + 底部 row（缩放 tok/平移 chip/
      路径高亮 chip/导出海报）；原型「模拟从报告带入路径」演示按钮按 D5 不复现（留痕）。
   ④ 节点/边：四档形状 symbol（见 6）+ 单行名称标签 + 低置信虚线边框补偿（D20 预裁决
      口径留痕）+ 边 done「已打通」label + edgeSymbol 箭头 + DIM_OPACITY 降透明（冻结）。
   ⑤ 详情 + aside：kv 清单（章节/难度/掌握度与档位/证据条数/低置信来源/先修链）+ bar
      + 三 CTA（navigate 语义冻结）+ hint + SuccessMark + tick-list 四条，annos 档双栏。
   ⑥ 文字版清单：bp-tbl 全档常在（替换旧 details 折叠，D8 拍板项）；六列齐备；行内
      真实 <button>（aria-current）+ data-current inset 选中线（CSS 对照原型
      box-shadow:inset 2px）；「尚无可用的数」tok 口径保留；键盘回车语义经 openNode
      旧新比对一致（setSelected + scrollIntoView + focus 移交）。
   ⑦ 空态分支：空态页头 + emptyBox 三条冷启动出路 + 02 口径图例；不放示例节点。
   四态：loading→SkeletonLines；error→Stamp 红章+真重试（D15c 最小新增，插 loading 后
      数据态前，守卫顺序红线遵守）；无空间→EmptyState；无数据→⑦。
   零一次性样式抽查：grep 四条独立复跑均无匹配（含 GraphPage 专条）。

6. graphSymbol 转写正确性 —— 通过
   与原型 bandShapePath（L2784-2792）逐公式对照：菱形=四点 90° 步进（顶点 ±r 落上下左右）、
   五边形 72°、六边形 60°、圆=两段弧 0.01 闭合、方形=0.8r——顶点角度公式 (-90+i*step)
   逐字一致；坐标口径差异（r=15→10）有文件头说明且经 symbolSize 缩放无影响。
   graphSymbol.test.ts 9 用例（顶点数/圆含 arc 无 L/方形 4 角/path:// 前缀/六态映射/
   六形状两两不同）审阅通过、全绿。

7. D8 六项留痕真实性 —— 通过（逐项复核，无伪造）
   ①形状【执行项·做了】：见 6；画布截图形状差异可见。
   ②天蓝不做小字【执行项·做了】：textColor = themeColor('--c-ink')，天蓝 #4E86D6 不在
      画布文字路径；tokens.test 23 用例绿。
   ③重绘不重播【执行项·做了】：旧新比对机制逐字符保留（lastIgnitionSourceRef/animation
      条件）；探针四组墨量 350ms==稳态、缩放 tok 不回退，证据链成立。
   ④键盘【尽力项·做了】：候选 A 画布级（role=group + tabIndex + onKeyDown 四向平移/
      加减缩放/setOption 合并更新）+ 候选 B 文字清单按钮；探针 {ok:true,focused:true}、
      缩放读数 0.30×→0.43×（375）/0.55×→0.79×（1440）。可选增强（Enter 选中中心最近
      节点）未做已留痕，属计划标注「可选」项，不构成缩水。
   ⑤描边入场【尽力项·没做·候选 A】：复核「ECharts graph edge 无 stroke-dashoffset/
      描边生长能力」的技术判断——属实（ECharts 无 path 描边进度 API，仅 opacity/width
      渐变近似；自绘 SVG 已被 D8 排除）。「做不到」成立，非借留痕偷懒；reduced-motion
      由点火动画 JS 侧降级覆盖（代码证据：animationDuration reduced→0）。
   ⑥焦点环【尽力项·部分做】：canvas 无 DOM 焦点属实；近似表达（emphasis borderWidth 3
      + .bp-gcanvas__viewport:focus-visible + 清单焦点环）与留痕一致。
   三项执行项全落地、三项尽力项评估/取舍全部成文（报告「五、」+ 代码注释），符合
   D20「评估先行、做不到留痕不静默砍」口径。

8. 冻结区 —— 通过（双口径独立复跑均空输出）
   · git diff --name-only fa20d8e..HEAD -- router.tsx api/ packages/engine functions data
     → 空；stores/ + graphLayout.ts + graphMastery.ts + graphSnapshot.ts + poster.ts → 空。
   · graphMastery.test / graphSnapshot.test / graphLayout / poster 四冻结件零改动。
   · GraphPage 冻结语义旧新逐块比对一致：取数 useEffect（getGraphMastery/cancelled/
     deps [activeSpaceId]）逐字符相同；守卫顺序未变（error 为派生态插入，未改分支顺序
     语义）；byKp/summary/badges/counts 派生、STATE_HINT/EVIDENCE_LABEL/IGNITE_*、
     ignitionLandingMs/WeekCount、themeColor、sharePoster、tooltip formatter、selectedIsWeak
     均原样保留。graphMastery.test 不动且全绿即布局纯函数与数据流未动的行为证据成立。
   · 3.3 测试口径：唯一改动的既有测试 = breakpoints.test.ts（许可的注释项）；唯一新增 =
     graphSymbol.test.ts；其余 18 个不动清单测试文件零改动（diff --stat 核对）。

9. 12acf95（前次中断遗留改动入库）—— 通过
   逐行 diff 确认仅：label rich 双行 → 单行名称（labelText=name）、新增 showLabels=cw>=700
   开关、fitZoom 地板 0.12→0.3、文件头与行内注释同步。无取数/守卫/派生/点火/poster/
   键盘语义/文案常量改动，纯表现层，独立可 revert，未 amend 历史。处置合规（DEV-1）。

10. 测试与构建（独立复跑）—— 通过
    · vitest：apps/web 22 文件 217 用例 / packages 2 文件 43 / functions/api 19 文件 202
      —— 462 全绿（基线 42/453 → 只增不减，增量恰为 graphSymbol.test 9 用例）。
    · tsc：apps/web exit 0（本轮变更面）；packages/functions 两段报告记 0，本轮以
      冻结区空输出 + 两批测试全绿旁证。
    · build 等价口径（--outDir /tmp/zhiwei-web-build-review）：成功；echarts 434.35 kB
      仍为独立懒加载 chunk，GraphPage 24.07 kB，与报告一致，无异常包体增长。
    · 静态纪律四条：无匹配。

11. 走查证据 —— 通过
    · 8 份审计 JSON 独立解析：每份 11 路由 overflowPx 全 0；/graph 各档
      1440/1024/768/375（双主题）overflowPx=0、scrollWidth==clientWidth —— 375 硬判据达成。
    · 主走查截图 capturedAt 14:09（晚于 14:00 表现层改动）新鲜；375 双主题专项
      9 图 + 日志 14:19 新采（DEV-2 stale 处置属实、得当）；1440 专项 14:11–12。
    · 键盘/主题切换/reduced-motion 专项取证见 7③④；无空间态采不到的原因
      （guardPath 冻结重定向）属实，R12 留痕口径与 P6 一致。
    · D18：探针脚本只读取证（fetch 仅 login/space/list/graph/mastery，无 create/写接口）；
      日志记录复用既有空空间 sp_muf82zhx02br0，本轮新建空间 0。
    · OBS-1（375 档画布近空白）处置恰当：实测属实（375-light-normal 画布 349×340、
      0.30× 地板、近空白观感确认），已定取舍口径（形状地图 + 05 文字清单承担 + 降级
      note），硬判据仍达成，报告如实留痕未改设计 —— 接受该取舍，不另立问题项。

--------------------------------------------------------------------------------
二、问题分级（只建议不代改；FAIL 不适用，以下为认领/留痕事项）
--------------------------------------------------------------------------------
M-1（下轮必清偿）1440 档画布节点标签相互叠压、成片不可读
  文件：apps/web/src/pages/GraphPage.tsx（label 配置：width:96 + overflow:'truncate'）
  问题：本次审查裁剪放大 graph-1440-light-normal.png 画布中部确证：多列节点的名称标签
        相互叠压成片、不可读；且可见文本宽度明显超过 96px，width/truncate 疑似对 graph
        节点 label 未生效（或被 formatter 路径绕过），与代码注释「width:96 截断控密度」
        的意图不符。1024 档同结构可推。执行报告未留痕此现象（其自采 1440 截图已可见；
        报告 ② 项仅记颜色达标，OBS-1 只覆盖 375）——按 D20「禁静默缩水」口径，
        该取舍后果须补留痕并修复。
  影响：主桌面档「三重编码」的文字编码（名称）不可读，观感明显低于原型（原型节点名
        清晰分列）；但数据信息由 05 文字清单/tooltip/详情卡完整承担，硬判据不破。
  建议：P8 计划列入独立走查修复提交（不动冻结语义）：①先核实 width/truncate 失效原因；
        ②若确不可用，用 series 级 labelLayout:{hideOverlap:true}（ECharts 内建避让）
        或缩短标签/增大可视列距；③执行报告补 OBS-2 留痕（1440/1024 修复前后对照图）。
  不判 FAIL 的依据：不触红线、不破本轮任何硬判据；标签密度本属 D20④ 明示「ECharts
        label 能力边界在实现中取舍并留痕」的许可取舍区，缺的是对该取舍后果的留痕，
        按本轮 L 级认领惯例转下轮清偿。

L-1（下轮顺手）两处缩放下限口径不一致
  文件：apps/web/src/pages/GraphPage.tsx（ZOOM_MIN=0.12 与 fitZoom 地板 0.3）
  问题：fit 地板取 0.3 的理由是「防节点成点」，但键盘/工具条缩放下限仍为 0.12，
        键盘缩到 0.12 时同样会「节点成点」，与取舍口径不自洽。
  建议：统一为 0.3（或留痕说明保留 0.12 的理由），随 M-1 同一提交处理。

INFO-1 D18 计数基线更新
  探针日志显示账号现有 3 个空空间（初中数学 + 两个 P6 四态遗留），非计划 D18a
  所记 2 个。本轮新建 0 成立（命名与时间戳均指向 P6 遗留），但 P8 计划的 D18
  基线应更新为 3，避免下轮误判膨胀。

INFO-2 专项图命名易误读
  graph-1440-dark-theme-after-settled.png 实为切主题后的 light 态（探针切换主题的
  自然结果，theme-before-dark 提供了 dark 对照），证据有效，但文件名不含「切后」语义，
  建议下轮探针日志或报告注明读法（本轮报告「五、」③ 已有读法说明，仅提示存档口径）。

--------------------------------------------------------------------------------
三、独立复跑证据汇总（reviewer 本机实测，非转录报告）
--------------------------------------------------------------------------------
1. git log/diff：fa20d8e..HEAD 6 提交 96 文件；冻结区两口径空输出（exit 0）。
2. vitest：apps/web 22/217 全绿（6.41s）；packages 2/43 全绿（1.78s）；
   functions/api 19/202 全绿（7.54s）。
3. tsc --noEmit -p apps/web/tsconfig.json → exit 0。
4. vite build --outDir /tmp/zhiwei-web-build-review → ✓ built in 3.87s；
   grep 'pb-pad-frame-sm-b{padding-bottom:10px}' assets/*.css → 命中（L-1 判据）。
5. 审计 JSON 解析（node 脚本）：8 份 × 11 路由 overflowPx 全 0，/graph 各档 0。
6. 静态纪律四条 grep → 均无匹配。
7. 探针日志 375-light：键盘 {ok,focused} + 缩放 0.30→0.43；主题墨量 350ms=1897==稳态；
   reduced-motion matchMedia=true；空空间复用记录在案。
8. 截图目验：graph-1440-light-normal / graph-1440-dark-theme-after-settled /
   graph-375-light-normal（含 sips 裁剪放大取证 M-1）。
9. 工作区 git status：仅他人既存未提交项，无新增未入库代码。
10. 归档 md5 校验：43f896a7c01094cf21faefc8d4b4a7c1 两侧一致。

--------------------------------------------------------------------------------
四、对 P7 交付物与认领清偿的把关结论
--------------------------------------------------------------------------------
· 检查点⑥（/graph ECharts 改造）：产物三件套齐备，原型 ①–⑦ 逐段复现成立，
  四态落位合规，D8 六项分派按 D20 落地且留痕真实 —— 把关通过。
· L-1（token 消费）：清偿成立，产物 CSS 判据独立命中。
· L-2（注释清偿）：清偿成立，断言零改。
· L-3/INFO-1（D18 空间约定 / D19 页头登记）：遵守/落地成立。
· 遗留：M-1（1440 标签叠压）+ L-1（缩放下限口径）转下轮认领，P8 计划（第 10 版）
  必须列入清偿步骤并回写本报告问题编号的处置结果。

—— 第 3 轮审查完（2026-10-11 14:47）——
VERDICT: PASS
