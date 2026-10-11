# STYLE-10「青蓝蓝图」设计系统规范

> 唯一视觉依据：`tempui/prototypes/style-10/index.html`（4113 行单文件原型；CSS 正文 L19–935、
> 内联 SVG 图标族 L936–995、MOCK L1039–1300、17 个渲染函数 L1855–3305、事件装配 L3890–4110）。
> 本文是该原型的**可执行提炼**：后续所有批次（组件库、外壳、17 页迁移）以本文的锁定值为准。
> 纯 Markdown、零 React 代码。任何与本文冲突的旧文档/旧实现，一律以原型为准（冲突清单见第 12 章）。

角色分工：原型 = 视觉事实源；本文 = 工程口径（token 命名、落位、验收判据）；
`_pipeline/01_PLAN.md` = 批次与顺序。三者冲突时按上一条优先级。

---

## 1. 设计意图与隐喻

### 1.1 一句话

把「学习诊断」画成一张**能被核对的工程图纸**：底是制图板（board），内容是一张图纸（sheet），
四周是可索引的图层（rail），右下是图签栏（title block），关键结论挂着编号标注（callout）与虚线引线（leader）。
所有数字都有单位与出处，所有空/错/加载都长成图纸上的批注，而不是通用 UI 的空状态插画。

### 1.2 四件套隐喻与各自承担的信息

| 隐喻件 | 原型实现 | 承担的信息 | 不许承担的东西 |
| --- | --- | --- | --- |
| 制图板 Board | `#board` + 四角十字标记 `.corner` | 底色、图幅、当前视口档（`data-tier`）、图层开关（`data-rail`/`data-annos`） | 不放内容、不放导航 |
| 图签条 Masthead | `.masthead`（`.mast-left` 品牌 + `.mast-meta` 图签 + `.mast-right` 操作） | 项目 / 图号 / 比例 / 日期四项固定图签；身份芯片；索引与标注开关；全部图纸入口；对话面板开合 | 不放大段文案；`≤900` 时 `.mast-meta` 收掉 |
| 分层索引 Rail | `.rail` + `.sheet-index`（`.dwg` 图号 + `.ttl` 标题 + `.pr` 优先级） | 15 项学生图纸 / 4 项教师图纸；`aria-current="page"`；底部图层说明与当前空间 | 不放新建表单（那是抽屉/顶栏的职责） |
| 图纸 Sheet | `.sheet`（`--pad-frame` 内边距）+ `.sheet-grid`（draft ⊕ annos） | 页头（eyebrow / h1 / sub / dim）+ `section.block` 分节 + 右下图签栏 | 不自己决定宽度上限（由 `--pad-frame` 与档位决定） |
| 标题栏 TitleBlock | `#tb` 的 8 格 `dl` | 项目 / 图号 / 比例 / 日期 / 视图 / 制图 / 状态 / 签发 | 不做交互 |

### 1.3 三条气质纪律（贯穿所有组件）

1. **工程可核查感**：`掌握度是算出来的、根因是回溯出来的`。表现层 = 等宽数字 + 单位 + 出处 + 阈值刻度线，
   绝不出现无出处的装饰性数字（`尚无可用的数` 是合法内容，见 7.4）。
2. **发丝线与框图**：0–2px 圆角、1px 细线、无阴影（浮层除外）、半透明面板**不加**毛玻璃。
   图纸感来自「线」，不来自「玻璃」。
3. **批注制式**：所有元信息（图号、单位、状态、比例、档位）走等宽大写 `.tok` 制式；
   正文走 body 栈。同一屏最多三种字号参与「制式」，不靠字号差堆层级。

---

## 2. Token 全表

### 2.1 两套主题（蓝图 / 白图）

主题开关沿用 `<html class="dusk">`（挂上 = 蓝图深色，去掉 = 白图浅色）。
原型用的是 `<html data-theme="dark|light">`，本工程**不采纳**该属性名 —— 现有 `dusk` class 与
`index.html` 首帧脚本、`stores/theme.ts` 已形成单一真相，改名会让首帧脚本与 store 两处漂移。

| 语义角色（工程 `--c-*`） | 白图（`:root`，默认） | 蓝图（`html.dusk`） | 原型对应 |
| --- | --- | --- | --- |
| canvas（页面底） | `#F4F7FA` | `#0B1B2B` | `--bg` |
| canvas-deep（板外底） | `#E4EBF2` | `#071422` | `--bg-deep` |
| raised（抬升面 / 板面） | `#EDF2F7` | `#0d2033` | `--bg-plate` |
| surface（面板合成底） | `#FFFFFF` | `#0F273C` | `--surface`（深色为 `rgba(16,44,66,.72)` 合于 canvas） |
| surface-3（次表面 / 输入底） | `#E8F0F8` | `#163346` | `--surface-3` |
| ink（正文 / 标题） | `#12395A` | `#DCEBF7` | `--fg` |
| ink-soft（次要文字） | `#3D5E75` | `#9FBBD4` | `--fg-2` |
| ink-faint（元信息文字） | `#4A6C83` | `#8CA9C2` | `--fg-3` |
| line（控件边界线，`.50` 档） | `#A3B5C2` | `#516575` | `--line-2` |
| line-soft（分隔线，`.34` 档） | `#C6D3DC` | `#3B4E5F` | `--line` |
| line-faint（装饰线，`.16` 档） | `#E1E8ED` | `#28394A` | `--line-faint` |
| accent（天蓝，**非小字**） | `#1A5FB4` | `#5AC8E8` | `--cyan` / `--azure` |
| accent-veil（同色面纱） | `#E8F0F8` | `#163346` | `--leader-fill` / `--surface-3` |
| accent-ink（accent 作文字） | `#14509C` | `#5AC8E8` | `--b3-t` |
| on-accent（落在 accent 上的字） | `#FFFFFF` | `#04121E` | `::selection{color:#04121e}` |
| amber（警告） | `#7A4F00` | `#F2B441` | `--amber` |
| red（失败） | `#B3261E` | `#F16A6A` | `--red` |
| danger（危险前景） | `#B3261E` | `#F16A6A` | `--b1-t` |
| focus（焦点环） | `#0B4F71` | `#5AC8E8` | `--focus` |
| focus-halo（焦点光晕） | `rgba(11,79,113,.24)` | `rgba(90,200,232,.30)` | `--focus-halo` |
| leader（引线） | `rgba(37,80,110,.8)` | `rgba(159,187,212,.85)` | `--leader` |
| hatch（斜纹 / 禁用） | `rgba(37,80,110,.14)` | `rgba(159,187,212,.16)` | `--hatch` |
| scroll-thumb / hover | `#C3D0D8` / `#A9BAC5` | `#334154` / `#516575` | 工程新增（原型无） |

### 2.2 四档状态色（色 + 形状 + 文字 三重编码）

档名与阈值**不动**（复用 `packages/engine/src/statusBand.ts`，前端不得另写阈值）：

| 档 | 阈值 | 形状（原型 `BAND_SHAPE`） | 白图 色 / 文本色 | 蓝图 色 / 文本色 |
| --- | --- | --- | --- | --- |
| 待巩固 | `< 0.40` | 菱形 `12,2.4 21.6,12 12,21.6 2.4,12` | `#B3261E` / `#B3261E` | `#F16A6A` / `#F58C8C` |
| 不稳定 | `0.40 – 0.60` | 五边形 `12,2.4 21.3,9.1 17.7,19.8 6.3,19.8 2.7,9.1` | `#7A4F00` / `#7A4F00` | `#F2B441` / `#F6C561` |
| 基本掌握 | `0.60 – 0.80` | 六边形 `7.7,3.2 16.3,3.2 20.6,12 16.3,20.8 7.7,20.8 3.4,12` | `#1A5FB4` / `#14509C` | `#4E86D6` / `#7FB2EA` |
| 已掌握 | `> 0.80` | 圆形 `r=9.2` | `#00567A` / `#00567A` | `#5AC8E8` / `#8FD3EE` |
| 未接触 | 无证据 | 双圈 `r=8.6` + `r=2.2` | `#4A6C83` | `#9FBBD4` |
| 未解锁 | 先修未开 | 空方框 + 横线 | `#4A6C83` | `#9FBBD4` |
| 低置信 | 试卷估计 | 菱形 + 横线 | `#4A6C83` | `#9FBBD4` |

**三处同源纪律（冻结区）**：`apps/web/src/theme/bands.ts` 的 `BAND_HEX` ↔
`apps/web/tailwind.config.js` 的 `band-*` 六个字面 hex ↔ `apps/web/tests/bands.test.ts` 的逐字断言。
守恒区只能容纳**一套**字面 hex，取**白图**那一套（默认主题是白图，见 D2 拍板①）；
蓝图那一套经 `--c-band-*` 变量在 `html.dusk` 下生效，供新外壳族组件消费，不进守恒区。

### 2.3 四档文本色用 `-t` 浅一档系列（小字达标口径）

- 四档**文本**一律取 `-t` 系列（原型 `.band.b1{color:var(--b1-t)}`）。
  白图下 `-t` 与实色同值（原型定义如此）；蓝图下 `-t` 比实色**浅一档**。
- 白图 `-t` 四色在 `#F4F7FA` 底上的实测对比度：`#B3261E` 6.08:1、`#7A4F00` 6.63:1、
  `#14509C` 5.84:1、`#00567A` 7.47:1 —— 四档全部 ≥ AA 小字 4.5:1（由
  `tests/bands.test.ts` 新增一条实测断言锁定）。

### 2.4 天蓝 `#4E86D6` 不做小字文本

- 面板合成底（蓝图 `#0F273C`）上天蓝实色 `#4E86D6` 只有 **4.15:1**，且它在色相上是「中间亮度的蓝」，
  小字场景既压不住底色也不足以当正文。
- 锁定口径：天蓝**只作形状 / 线 / 大图形**（图谱节点描边与填充、图例形状、条形填充、`::selection`、
  焦点环、引线高亮点）；**任何 13px 以下文字不得用天蓝**，需要蓝色文字时用 `accent-ink`
  （白图 `#14509C` / 蓝图 `#5AC8E8`）。
- ECharts 节点标签必须遵守本条：标签色取 `-t` 系列或 ink 系（详见第 10 章 graph 行与 D8）。

### 2.5 空间与形状

| 项 | 值 | 原型 |
| --- | --- | --- |
| `--pad-frame`（图纸外框内边距） | 桌面 `48px`；`≤900` `22px 18px`；`≤420` `16px 12px` | `.sheet` 与第 19 节档位覆盖 |
| `--gap`（栅格间距） | `16px` | `.grid{gap:var(--gap)}` |
| `--bh`（主控件触控高） | `44px`（移动档与 `pointer:coarse` 一律抬到 44） | `.btn{--bh:44px}` |
| 圆角刻度 | `0px`（chip / 方块章 / 条形 / 注记）与 `2px`（面板 / 按钮 / 输入 / 卡片）；**无第三档** | `--r:2px` `--r0:0px` |
| 阴影 | 静态面一律 `none`；仅浮层（anno-pop / 抽屉 / 模态 / toast）可用 `0 12px 30px rgba(2,12,20,.42)` | `.anno-pop{box-shadow:0 12px 30px rgba(2,12,20,.42)}` |
| z-index 刻度 | `nav 30 / leader 6 / tabbar 40 / overlay 50 / toast 60` | 原型 `.masthead{z-index:30}` `.tabbar{z-index:40}` `.drawer{z-index:70}` |

---

## 3. 字体系统

### 3.1 三栈（角色表）

| 栈 | 字族（自托管） | 用途 | 关键制式 |
| --- | --- | --- | --- |
| `--disp` 标题栈 | Chivo 400/600/700 → Noto Sans SC → 系统中文 | h1–h4、品牌字、大数字标签、`.btn.primary` 文案 | `letter-spacing:.01em`、`line-height:1.25`、`font-weight:600` |
| `--body` 正文栈 | Noto Sans SC 400/500/700 → 系统中文 | 正文、列表、表单值、表格 | `15px/1.65`、`text-wrap:pretty`、`font-feature-settings:'palt' 1` |
| `--mono` 等宽栈 | IBM Plex Mono 400/500/600 → ui-monospace | 全部批注制式 `.tok`、图号、数值、单位、状态、表头、按钮文案 | 大写 + `letter-spacing:.1em~.2em`、`font-variant-numeric:tabular-nums` |

### 3.2 `.tok` 批注制式（唯一元信息书写方式）

```
.tok { font-family: var(--mono); font-size: 11px; letter-spacing: .1em;
       color: var(--c-ink-soft); text-transform: uppercase; }
```

- 尺寸渐变：极小档 `10.5px`（图签 / 表头 / chip / 章面），常规档 `11px`（`.tok`），
  数据档 `12.5–13px`（表格数字 / 徽标数值），大字档 `26px`（`.big-num` 尺寸块主数字）。
- 中文批注可读性：中文出现在等宽批注里时取**上限档 11px**，不再下探 `10.5px`
  （原型已知不足，见 12.3）。
- 数值制式：`.num-mono` = 等宽 + `tabular-nums` + `letter-spacing:.02em`；
  表中数值列右对齐（`td.n`），单位与数值之间不留空格、单位走同一 `.tok`。

### 3.3 自托管纪律（禁 CDN）

- Chivo / IBM Plex Mono / Noto Sans SC 三族全部走 `@fontsource` 管线（`npm i` 到本仓依赖，
  `main.tsx` 引入 CSS），**原型里的 `fonts.googleapis.com` 链接不采纳**——原型走 CDN 是单文件原型的
  零构建例外，不是产品例外（国内部署 CDN 不可达）。
- 静态闸门：`grep -rn "fonts.googleapis\|fonts.gstatic" apps/web` 必须无输出。
- Noto Sans SC 全量数 MB，走 `@fontsource` 的 `unicode-range` 分片按需加载；构建体积实测留痕
  （见 12.5）。

---

## 4. 布局骨架

### 4.1 四层结构（DOM 顺序即阅读顺序）

```
Board（制图板：底色 + 四角十字标记 + data-tier / data-rail / data-annos）
├─ skip link（跳到图纸主体）
├─ Masthead（吸顶图签条：品牌 ⊕ 四项图签 ⊕ 右区操作）
├─ workbench（grid）
│  ├─ Rail（左：分层索引；可隐藏）
│  └─ Sheet（图纸）
│     ├─ sheet-grid（draft ⊕ annos）
│     └─ LeaderLayer（SVG 虚线引线层，仅 xl 档绘制）
├─ tabbar（底部 5 项主导航；≤900 档才出现）
├─ TitleBlock（右下 8 格标题栏）
├─ Drawer（全部图纸索引；≡ MobileNav 抽屉形态）
└─ 浮层：ConfirmDialog / Toast / ChatPanel
```

### 4.2 四档视口行为矩阵

| 档位 | 视口 | Rail | Sheet 内边距 | 标注列 annos | LeaderLayer 引线 | 底部 tabbar | `.mast-meta` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `xl` | `≥1180` | 显示（236px 列） | `48px`（上 48 · 左右 48 · 底 16） | 右侧 296px 列（sticky） | 绘制 | 不显示 | 显示 |
| `lg` | `901–1179` | 显示 | `48px`（上 48 · 左右 48 · 底 16） | 降级：上标 + 列表（下方） | **不绘制** | 不显示 | 显示 |
| `md` | `421–900` | 隐藏（进抽屉） | `22px 18px`（上 22 · 左右 18 · 底 12） | 降级：上标 + 列表 | 不绘制 | 显示（正文底部让位 66px） | 隐藏 |
| `sm` | `≤420` | 隐藏（进抽屉） | `16px 12px`（上 16 · 左右 12 · 底 10） | 降级：上标 + 列表 | 不绘制 | 显示 | 隐藏 |

> **Sheet 内边距的垂直值（2026-10-11 迁移 P6a / M-1 留痕补全，只增不改原值）**
> 上表「Sheet 内边距」列此前只记到 xl/lg 的 `48px` 与 md/sm 的「上 + 左右」，
> 下内边距散落在原型各档覆盖里。本轮按唯一视觉依据补全，**不修订任何既有值**：
> 原型 L140 `.sheet{padding:var(--pad-frame); padding-bottom:16px}` + L40 `--pad-frame:48px`
> （xl/lg → 上 48 · 左右 48 · 底 16）；原型 L680 `#board[data-tier="md"] .sheet{padding:22px 18px 12px}`
> （md → 上 22 · 左右 18 · 底 12）；原型 L681 `#board[data-tier="sm"] .sheet{padding:16px 12px 10px}`
> （sm → 上 16 · 左右 12 · 底 10）。工程落地：22 / 18 不在 Tailwind 默认刻度上，
> 故在 `apps/web/tailwind.config.js` 的 `extend.spacing` 增 `pad-frame-md-y / -md-x / -md-b / -sm-b`
> 四个具名 token，由 `Sheet` 单点消费、`apps/web/tests/tokens.test.ts` ⑬ 锁定 —— 实现向本表对齐。

`data-tier` 由原型 JS 按 `clientWidth` 计算（`≤420 sm / ≤900 md / ≤1179 lg / ≥1180 xl`）。
**工程落地用 `@media` 具名断点**（D1）：`narrow:420px` `sheet:900px` `annos:1180px`；
需要 JS 知道档位的地方（引线开关）用组件内 `matchMedia` 监听，不引入全局 `data-tier` 驱动布局。
`nav:720px` 保留不删，语义收窄为「触控目标作用域」（`max-nav:min-h-9` 等既有用法）。

### 4.3 图签条 / 分层索引 / 标题栏规格

- **Masthead**：`.mast-left` 品牌（34px 方框 sigil + 18px 字标 + 10px 大写副标）；
  `.mast-meta` 四项（项名 `10.5px` 大写等宽 + 值 `13px` 标题栈），项间 1px 细线分隔，`≤900` 整块收掉；
  `.mast-right` 身份芯片 + 索引开关 + 标注开关 + 全部图纸 +（本工程的）对话面板开合钮。
- **Rail**：标题行 `分层索引` + 张数；列表项 = 图号（`.dwg` 等宽 `10.5px`，宽 46px）+ 标题（`13.5px`）
  + 优先级（`.pr` 等宽 `9.5px`，宽 22px 右对齐）；当前项 `aria-current="page"` + `inset 2px 0 0 accent`；
  项高 `≥44px`；底部 `.rail-note` 列出图层说明与当前空间。
- **TitleBlock**：8 格 `dl`（项目 / 图号 / 比例 / 日期 / 视图 / 制图 / 状态 / 签发），
  `dt` 等宽 `9.5px` 大写，`dd` 等宽 `12.5px`；`md/sm` 档降为 2 列；打印时保留并转黑白。
- 图号制式：学生图纸 `10-01 … 10-14`、教师图纸 `10-15 … 10-17`；比例按档位取
  `xl 1:1 / lg 1:2 / md 1:5 / sm 1:10`。

---

## 5. 组件规范

每个组件给「结构 / 视觉规格 / 四态 / 无障碍」四项。视觉规格里的值一律取第 2 章 token。

### 5.1 按钮 Button

- 结构：`button` 或 `a`，内部 `图标 + 文案`；`::after` 一条 `inset:3px` 的 1px 内偏移框。
- 视觉：`min-height:44px`、`padding:8px 16px`、`border:1px solid line`、`radius:2px`、
  等宽 `12px`/字距 `.14em`/大写；hover `background:accent-veil` + `border:accent` + 内框线转 `line`；
  active `background:surface-3`。
- variant：`primary`（实底 accent + `on-accent` 文字）、`danger`（红边 + `b1-t` 文字）、
  `text`（无边、body 栈、14px、`min-height:44px`）、`sm`（`11px`/`.1em`）、`wide`（`width:100%`）。
- 四态：default / hover / active / **disabled** = 虚线边 + `repeating-linear-gradient(135deg, …
  hatch 5px 6px)` 斜纹 + 前置 `[停用] ` 字样（`::before`）+ `cursor:not-allowed`。
- 无障碍：禁用一律用真 `disabled`（`aria-disabled` 仅用于链接形态）；图标 `aria-hidden`；
  `pointer:coarse` 与 `md/sm` 档强制 `min-height:44px`。

### 5.2 图标按钮 IconButton

- 结构：44×44 `grid place-items-center`；图标 17×17（`sm` 转 44×44 保底）。
- 视觉：1px `line` 边、透明底、`ink-soft` 图标；hover 转 accent 边 + accent 图标 + `accent-veil` 底。
- 无障碍：`aria-label` 必填（签名级约束）；`aria-expanded` / `aria-pressed` / `aria-controls` 按语义挂。

### 5.3 输入 Input / Textarea / Select / FormField → 下划线刻度制式

- 结构：`field-label`（等宽 11px 大写 + 可选 `.req` 必填星）→ `.ctl`（相对定位容器）→ 原生控件 →
  `.hint`（12.5px 等宽，`bad` 时转 `b1-t`）。
- 视觉：控件 `min-height:44px`、透明/`surface-3` 底、**只留 1px 下边框**（`line` 档）、上圆角 0；
  聚焦时下边框转 accent 且底色转 `surface`；`.ctl::before/::after` 是**两端 7px 刻度脚**
  （左下角与右下角各一段 7×7 的 accent 折线）。
- 四态：normal / focus / **invalid**（`data-invalid="1"` → 下边框与刻度脚转 red，`.hint.bad` 输出
  「原因 + 下一步」） / **readonly**（`data-readonly="1"` → 透明底 + 点线下边框 + 刻度脚 35% 透明）。
  禁用态由外层 `[data-state="disabled"]` 统一给虚线 + 斜纹。
- Select：`appearance:none` + 右侧 12px caret 图标（accent）+ 等宽 13px。
- 无障碍：`label` 与控件用 `for/id` 关联；错误用 `aria-invalid` + `aria-describedby`；
  错误文案容器 `role="alert"`；禁止用 placeholder 代替 label。

### 5.4 卡片 / 面板 Panel（双线制图感）

- 结构：外层 1px `line` 边 + `radius:2px` + `surface` 底；`::after` 一条 `inset:3px` 的 1px
  `line-faint` 内框线（这就是「双线」）。
- variant：`solid`（`surface-2` 实底）、`flat`（无底、无内框线，用于侧栏块）。
- 无障碍/语义：面板标题走 `h3/h4`（不跳级）；装饰性内框线 `pointer-events:none`。

### 5.5 徽标 Badge / chip

- 结构：`.chip` = 边框 1px + `min-height:22px` + `padding:2px 9px` + 等宽 10.5px 大写。
- variant：default（`surface-3` 底）/ `cyan`（accent 边 + accent 文字）/ `amber` / `red`
  （`b1-t` 文字 + 红边）/ `plain`（无底）/ `solid`。
- 纪律：chip 只承载「状态 / 计数 / 类型」短语；不允许内嵌交互控件。

### 5.6 细网格表格 Table

- 结构：`.tbl-wrap`（1px 外框 + `overflow-x:auto`）→ `table.tbl`（`caption` 在最上，
  等宽 10.5px 大写）。
- 视觉：单元格 `1px line-faint` 下/右分隔线（最后一列无右线）；表头 `surface-3` 底 +
  等宽 10.5px 大写 + `position:sticky; top:0`；行 hover `accent-veil`；
  行可点（`data-rowlink`）时 hover 追加 `inset 2px 0 0 accent`。
- 数值列：`td.n` 等宽 + `tabular-nums` + 右对齐 + `white-space:nowrap`。
- 升降：`td.up` → `b4-t`、`td.down` → `b1-t`。
- 窄档转卡片：`md/sm` 档 `thead` 视觉隐藏（`clip` 手法），`tr/td` 转 `display:block`，
  每格 `display:flex` 左右分栏，左侧用 `td::before{content:attr(data-label)}` 输出列名
  —— 因此**每个 `td` 必须带 `data-label`**。
- 无障碍：`caption` 提供表格用途；行转卡片是纯视觉改写（DOM 语义仍是 table）。

### 5.7 四档标记 BandMark + 条形 Bar

- 结构：`svg.sh`（形状，18×18，`stroke-width:1.5`，无填充）+ `.bl`（档位文字，body 栈 500）+ 
  `.bv`（数值，等宽 12.5px `tabular-nums`）。
- 形状取 2.2 表；颜色：形状与文字同色（`-t` 系列），`b0` 用中性色。
- 条形 `.bar`：高 8px、1px `line` 边、`surface-3` 底；填充 `<i>` 取实色（非 `-t`）；
  阈值刻度 `<b>` 三条竖线落在 40% / 60% / 80%。
- 无障碍：整条条形 `role="img"` + `aria-label="<档位> 掌握度 <数值>"`；形状 `aria-hidden`。

### 5.8 红章 Stamp（错误态）

- 结构：`role="alert"` + 外框 1px 红实线 + `::after` `inset:4px` 红虚线（55% 透明）+
  右上 `.seal` 方块章（`bg` 底 + 红边 + 等宽 9.5px 大写，如 `RED STAMP`）+
  章头 `!! 数据获取失败`（等宽 13px 600）+ 说明段（13.5px，`max-width:64ch`）+ 操作行。
- 操作行固定形态：主按钮「重试一次」（真重试，重新发起同一请求）+ 一条出路（换个入口）+
  文本按钮（本工程不提供状态实验室入口，见第 12 章拍板③）。
- 禁止：不得用「出错啦」这类无信息文案；不得吞掉失败原因；不得把失败渲染成空态。

### 5.9 虚线空盒 EmptyState（空态）

- 结构：`1px dashed line` 外框 + `::before` `inset:5px` 更浅虚线（双层虚框）+ `.tag`（等宽 10.5px 大写，
  如 `EMPTY SET · 空集合`）+ `h3` + 说明段 + 出路行。
- 语义纪律：**空态只引导、不重试**（重试按钮属红章）；空态必须给出「为什么是空的」与 ≥1 条出路；
  空态不显示假数据/假图表。

### 5.10 骨架 SkeletonLines（加载态）

- 结构：`.sk`（flex 列）+ N 条 `.sk-line`（高 14px，宽度递减 `100% - i*9%`，最小 40%）+
  一块 `.sk-block`（高 104px）+ 一行 `.sk-note`（等宽 10.5px 大写：`取数中 · 不伪造内容`）。
- 视觉：`repeating-linear-gradient(90deg, hatch 0 6px, transparent 6px 12px)`（发丝斜线）+
  1px dashed `line` 边；`.sk-block` 用 135° 斜纹。
- **禁止 shimmer / 呼吸 / 循环动画** —— 原型明确「静态发丝斜线 + 标注取数中」，动效观感属噪音。
- 无障碍：容器 `role="status"` + `aria-live="polite"`。

### 5.11 斜纹禁用 Disabled

- `.btn[disabled]`、`[data-state="disabled"]` 下的输入 / 分段选择、`.dis-banner` 三处统一：
  虚线边 + `repeating-linear-gradient(135deg, transparent 0 5px, hatch 5px 6px)` + `ink-faint` 文字。
- 区块级禁用必须在区块顶部加 `.dis-banner`（`role="status"`，等宽 11px 大写，`lock` 图标 +
  「控件状态：禁用态 · <原因>」），保证「为什么不能点」有答案。

### 5.12 MeasureBox 尺寸块 / KV 列表 / 路径 / 概念卡

- `.measure`：`tok` 标签（下方 1px 虚线）+ `big-num`（等宽 26px，accent 色）；承载「一个数 + 它的名字」。
- `.kv`：左 `dt` 等宽 11px 大写右 `dd`（14px，数值走 `num-mono`），行间 1px dashed 底。
- `.path`（归因回溯路径）：`li` 左侧 48px 等宽「PL」阶号栏 + 1px dashed 分隔；末项 `.root` 转红框。
- `.cands` / `.dist`（候选根因 / 四档分布）：名称列 + 条形列 + 数值列三列；窄档转两行制。
- 概念卡：`details` + `.blk-sum`（等宽 14px 公式 + 右侧 `tok` 状态，`min-height:44px`），
  默认收起（`collapsedByDefault`）。

### 5.13 Toast（非阻断批注条）

- 结构：固定右下（`≤900` 档左右各 12px、`bottom:76px` 让位 tabbar）；1px `line` 边 +
  **左边 3px 语义色条** + 等宽 12.5px 文案；入场 `opacity + translateY(6px)`，`160ms`。
- 语义：`info`（accent 条）/ `warn`（amber 条）/ `ok`（b4 条）；`role="status"` + `aria-live="polite"`。
- 纪律：采集类动作一律不弹模态，只用 toast（原型 `toast()` 的唯一用法）。

### 5.14 确认模态 ConfirmDialog

- 仅**破坏性操作**使用（解除教师绑定 / 退出登录 / 切空间 409）。
- 结构：`.sheet-modal`（最大 520px）+ 页眉 eyebrow + h2 + 正文 + 页脚（左：口径说明文字；右：取消 + 确认）。
- 视觉：`raised` 底 + 1px `line` 边 + `::after` 内框线；幕布 `rgba(4,12,20,.72)`（白图 `rgba(18,57,90,.42)`）。
- 无障碍：`role="alertdialog"` + `aria-modal="true"` + `aria-labelledby/describedby`；
  焦点陷阱（Tab 循环 + 反向循环）+ Esc 关闭 + 关闭后焦点归还触发元素；打开后焦点落在确认键。
- 确认键用 `danger` variant，且带明确动作动词（「确认退出 / 确认解除」），不用「确定」。

### 5.15 底部 tabbar + 全部图纸抽屉

- tabbar：固定底部居中，`≤900` 档显示；项数 **严格 ≤5**（学生：空间 / 测评 / 练习 / 图谱 / 报告；
  教师：工作台 / 学生 / 推荐 / 我的）；项 = 20px 图标 + 11.5px 文字，`min-height:52px`；
  当前项 `aria-current="page"` + 顶部 2px accent 条。
- 抽屉：右侧滑入 `min(420px, 92vw)`，`role="dialog" aria-modal="true"`；
  内容 = 全部 17 张图纸索引（图号 + 标题 + 优先级）+ 图号口径说明；
  承载空间切换 / 新建空间紧凑表单 / 管理入口（落在「全部图纸」抽屉底部，见第 11 章）。
- 无障碍：抽屉焦点陷阱 + Esc + 焦点归还；幕布点击关闭；打开期间正文 `aria-hidden`。

### 5.16 分段选择 Seg / 复选 Check / 阶梯 Ladder / 符号键盘

- `.seg`：label 形态（`input` 视觉隐藏 + `:has(input:checked)` 上样式），选中 = accent 边 +
  `accent-veil` 底 + `inset 0 0 0 1px accent`；`min-height:44px`；`vertical` 变体用于状态/身份选择。
- `.check`：18px 方框 + accent 对勾（未选时 `opacity:0`），`min-height:44px`。
- `.ladder`：26px 高、14px 宽竖条序列，`data-on="1"` 转 accent、`data-cur="1"` 转 amber。
- `.sym-pad`：数学符号键，`min 44×44`，hover 转 accent；用于测评/练习输入。
- 无障碍：分段选择用真 `radio` + `fieldset/legend`；对勾与方框走 `:focus-visible` 焦点环。

---

## 6. 标注系统

### 6.1 三种呈现（按档位 + 开关切换，同一份标注数据）

| 形态 | 出现条件 | 表现 |
| --- | --- | --- |
| 编号徽标（按需展开） | 标注开关**关**（默认）且该块有标注 | 目标块右上角 24×24 圆形徽标（编号），hover / `focus-within` / 点击展开 320px 宽的浮层正文 |
| 上标降级 + 列表 | 标注开关**开** 且档位 `≠ xl` | 目标上附加 `sup.amark`（`[编号]`，等宽 10px accent）；标注正文在图纸下方按同序成列表 |
| SVG 虚线引线 | 标注开关**开** 且档位 `= xl` | 右侧 296px 标注列 + `#leaderLayer` 画 `stroke-dasharray:4 3` 的虚线折线（起手 14px 短干 + 膝点 + 水平段）+ 端点圆 + 编号小方块 |

### 6.2 交互与状态机

- 徽标：`aria-expanded` + `aria-controls` 关联浮层（`role="tooltip"`）；Esc 关闭所有展开项；
  点击其它徽标时前方关闭（单一展开）。
- 引线：`requestAnimationFrame` 合并重绘（`syncLeaders`），监听 `resize` / `scroll` / `ResizeObserver`；
  目标与标注卡的间距 `< 24px` 时不画线（避免遮挡）。
- 联动：hover 标注卡 → 对应引线转 accent 实线（`.hi`）+ 目标块 `data-hint="on"`（描边转 accent）；
  hover 图谱节点同理。`.jump` 按钮（30×30，`pointer:coarse` 抬到 44）把视口滚到目标位置。
- 入场：`[data-draw="1"]` 时引线走 `stroke-dashoffset 1200 → 0` 的 `800ms` 描边动画（唯一大动效）。
- 开关记忆：顶栏「标注」按钮 `aria-pressed`，状态落 `localStorage`（工程侧键名另定，见第 11 章）。

### 6.3 无障碍（D11 拍板）

原型用 `aria-details` 关联引线与标注卡；该属性浏览器支持不全。**工程落地改用
`aria-expanded` + `aria-controls` 组合**：徽标按钮声明展开态与受控浮层 id，
`role="tooltip"` 只在展开时存在；上标形态挂 `tabindex="-1"` + `aria-label="标注 N，见右侧标注列表"`。

---

## 7. 状态系统

### 7.1 四态定义（语义严格区分）

| 态 | 触发 | 表现 | 允许的动作 |
| --- | --- | --- | --- |
| loading | 请求在途 | `SkeletonLines`（静态发丝斜线 + 「取数中 · 不伪造内容」） | 无（不阻塞页面其它区块） |
| empty | 请求成功、返回 0 项 | 虚线空盒（`EMPTY SET · 空集合`） | 只引导：去别处产生数据 |
| error | 请求失败 / 超时 / 5xx | 红章（`!! 数据获取失败` + 原因 + 真重试 + 一条出路） | 真重试 + 换入口 |
| disabled | 权限/前置缺失（非失败） | 斜纹 + `.dis-banner` 说明原因 | 无（但必须解释「为什么」） |

**语义红线**：空 ≠ 失败。空集合绝不渲染红章；失败绝不渲染成空盒；不到数据的地方**不画假图形**
（原型原话：`没有数就不画假节点`）。

### 7.2 区域级 vs 整页级落位表

| 层级 | 判据 | 表现 | 落位 |
| --- | --- | --- | --- |
| 区域级 | 单块数据（一个面板 / 一张表 / 一个图）取不到 | 该块内换成对应四态，页面其余部分照常 | graph 画布 / report 分布块 / drive 列表 / space 列表 / teacher 学生表 |
| 整页级 | 页面第一取数就是它（列表/详情页的主数据） | 整张图纸内容区换成对应四态；图框、分层索引、标题栏**照常显示** | paper 确认结果 / chat 会话 / attribution 结果 / graph 节点集 / report 汇总 |

整页级四态的文案与出路必须逐页定制（原型 `PAGE_LEVEL` 表：每页 `errWhy` 说明「失败的是什么」、
`emptyWhy` 说明「为什么是空的」、`emptyActs` 给 2–3 条出路），**不得复用一句通用文案**。

### 7.3 真实业务态与四态的接线口径

- 已有接口的页面（17 页全部）在 P6 起把四态接到真实请求：
  loading = 请求在途；empty = 返回值长度 0；error = 抛错/非 2xx。
- `disabled` 不由接口驱动，只由「前置缺失」驱动（如未登录/无空间/未确认试卷时按钮不可用），
  且必须同时给出 `.dis-banner` 或 `.hint` 解释。
- 状态实验室（原型 Alt+S 六组开关）**不迁移**（拍板③），四态由测试 + 截图走查覆盖。

### 7.4 「尚无可用的数」

`null` 数值不渲染 `0`、不渲染 `—`，渲染等宽 `尚无可用的数`（原型 `mval`/`mpct`）。
比例类（ΔAccuracy）在基线或复测缺失时渲染 `不可算` 并附一句原因。

---

## 8. 动效规范

### 8.1 三条 token

| token | 值 | 用途 |
| --- | --- | --- |
| `--t-ui` | `160ms` | 所有 UI 过渡：hover / focus / 边框 / 底色 / 面板开合 |
| `--t-fast` | `110ms` | 微交互（徽标 hover、skip link 落位、caret 闪烁节奏） |
| `--t-draw` | `800ms` | **唯一大动效**：引线描边入场（`stroke-dashoffset`），图谱边描边入场 |
| `--ease-ui` | `cubic-bezier(.2,.7,.3,1)` | 全站唯一缓动 |

### 8.2 纪律

- **无循环动效**：不用呼吸、不用 shimmer、不用旋转 loading（骨架是静态的）。
- **大动效只给两类对象**：标注引线层、图谱边。其余一律 ≤160ms。
- **入场只做透明度与 ≤6px 位移**：几何锚点（走查脚本量取的 `main` 几何）必须在动画期间可复现。
- 图谱边描边入场在 ECharts 上无原生对应（D8），落地时用 `animation` 回调模拟，
  做不到则在变更说明记录差距（见 12.4）。

### 8.3 `prefers-reduced-motion` 双通道

1. **CSS 通道**：`@media (prefers-reduced-motion: reduce)` 下把 `--t-ui/--t-draw/--t-fast` 置 0，
   并 `animation-duration:.001ms; animation-iteration-count:1; transition-duration:.001ms;
   animation-delay:0s; transition-delay:0s`；引线直接落终态（`stroke-dashoffset:0`）。
2. **JS 通道**：滚动揭示等渐进增强机制在 reduce 下**不挂开关属性**（隐藏是被授予的权限，不是默认状态）。

---

## 9. 无障碍规范

| 项 | 规格 |
| --- | --- |
| 焦点环 | `outline:2px solid var(--c-accent)` + `outline-offset:2px` + `box-shadow:0 0 0 4px var(--c-focus-halo)`（双环）。实测对比：白图 `#0B4F71` 对 canvas 7.89:1、蓝图 `#5AC8E8` 对 canvas 9.01:1 |
| 触控底线 | 主控件 `≥44×44`；`pointer:coarse` 与 `md/sm` 档下 IconButton / 徽标 / 分段项 / 列表项 / 抽屉项 / 汇总行一律抬到 44 |
| 键盘可达 | 全站 Tab 序与阅读序一致；skip link 第一跳「跳到图纸主体」；图谱节点 Tab + 方向键平移 + `+/-` 缩放 |
| 焦点陷阱 | 模态 / 抽屉 / 面板：Tab 循环、Shift+Tab 反向循环、Esc 关闭、关闭后焦点归还触发元素 |
| 语义结构 | 一页一个 `h1`；`section.block` 用 `aria-labelledby` 指向 `.block-title`；图签条 `dl`、标题栏 `dl`、表格 `caption` |
| 读屏 | 装饰性元素（四角标记、形状、分隔线、内框线、图案）一律 `aria-hidden`；数值条形 `role="img"` + `aria-label` |
| 对比度 | 正文 ≥4.5:1、大字与图形（非文本）≥3:1；天蓝不做小字（2.4）；四档文本用 `-t` 系列（2.3） |
| 语言 | `<html lang="zh-CN">`；中文与数字混排不依赖字距表达语义 |
| forced-colors | 补 `@media (forced-colors: active)` 最小适配：边框转 `CanvasText`、图形保留可见描边、禁用态保留虚线 |

---

## 10. 17 页逐页要素表

图号口径（原型 `ROUTES`）与工程路由（`apps/web/src/router.tsx`）一一对应：

| 图号 | 原型页 | 工程路由 | eyebrow | 主区块（原型 `blockTitle` 序号） | 用到的关键组件 | 四态落点 |
| --- | --- | --- | --- | --- | --- | --- |
| 10-01 | portal | `/` | `ZHIWEI / PUBLIC SHEET` | 无序号 hero + 01 三条主张 + 02 五步闭环 + 03 两个入口 + 05 图纸目录 | hero / 三列 panel / `num-list` 五步 / 目录表 | **不适用**（门户无加载/错误态，拍板） |
| 10-02 | login | `/login` | `AUTH / 最小摩擦入口` | 01 登录/注册分段 + 02 演示账号 | `seg` 分段 / 刻度输入 / 演示账号 panel / kv | 表单不整页四态；错误落在字段 `.hint.bad` |
| 10-03 | cold-start | `/start` | `COLD START / 一次性引导` | 01 四条路径 | 四张路径 panel（时间 / 负担 / 说明） | 无（静态引导页） |
| 10-04 | self-report | `/self-report` | `SELF REPORT / 30 秒先验` | 01 章节 × 五档 + 02 操作 | `seg` 五档 / 章节行 / 主按钮 | 无（提交失败走 toast） |
| 10-05 | spaces | `/spaces` | `SPACES / 学习容器管理` | 01 空间列表（chip n/30）+ 02 新建 | 空间卡（当前使用徽标）/ ConfirmDialog（409）/ 紧凑表单 | 区域级：列表 empty / error |
| 10-06 | assess | `/assessment` | `ASSESS / 证据采集（静默通路）` | STAGE1 01 选模式 + 02 随时可走；STAGE2 01 逐题作答；STAGE3 01 本轮结束 | `seg` 模式 / 题干 panel / 符号键盘 / `hbar` 进度 / 静默纪律 note | 区域级：题目 empty（本轮无题）；error 红章 |
| 10-07 | paper | `/paper` | `PAPER / 批量证据采集（三段）` | STAGE1 01 预置文件库（多选 ≤5 拼卷）；STAGE2 识别中骨架；STAGE3 01 逐题确认 + 结果 | 文件行（check）/ SkeletonLines / 确认表（guess 三态 + 知识点下拉）| **整页级**：空集合（0 份试卷）/ 红章（识别失败）+ 缓存完好提示 |
| 10-08 | practice | `/practice` | `PRACTICE / 逐步批改` | 01 章节与阶梯 + 02 概念卡（默认收起）+ 03 分步作答 + 04 战报 | `ladder` / `steps` 步骤卡（data-verdict）/ 三级提示 / `stamp-ok` | 区域级：章节 empty（未练过） |
| 10-09 | chat | `/chat` | `CHAT / 对话辅导` | 01 会话设置（模式 seg + 带入断点 note）+ 02 消息流 + 03 输入 | 消息气泡（stu/tutor/sys）/ 推理折叠（`.prog`）/ 工具时间线 / 停滞出口 | **整页级**：空集合（0 条消息）/ 红章（通道断开，草稿保留） |
| 10-10 | attribution | `/attribution` | `ATTR / 四步向导` | 01 选错题 + 02 复述核对 + 03 五类归因 + 04 回溯结果 | 错题表 / 复述框 / 归因 `seg` / `.path` 回溯链 / `.cands` 候选 / 验证题 / 处方 | **整页级**：无可归因错题 / 红章（结果取不到 → 不给半截结论） |
| 10-11 | graph | `/graph` | `GRAPH / 先修关系` | 01 画布 + 图例 + 文字版清单 + 02 节点明细 | 画布（四档形状 + 边样式）/ `.gwrap-legend` / `gstats` / 节点明细卡 | **整页级**：0 节点空集合 / 红章（不画假节点） |
| 10-12 | report | `/report` | `REPORT / 学习报告` | 01 总评 + 02 四档分布 + 03 缺口清单 + 04 ΔAccuracy + 05 下一步 | 细网格表 / `.dist` 分布 / `measure` / 红章 / 空盒 / 打印样式 | **整页级**：无数据空集合 / 红章（不铺假图表） |
| 10-13 | library | `/drive` | `LIBRARY / 只读资料` | 01 预置教材文件 + 02 与当前缺口相关 + 03 自定义知识库 + 04 没有缺口时 | 文件表 / 缺口建议 panel / 禁用态（自定义库） | 区域级：列表 empty / noSpace 提示 |
| 10-14 | profile | `/me` | `PROFILE / 个人中心` | 01 学习概览 + 02 我的老师 + 03 当前空间 + 04 老师推荐 + 05 账号信息 + 06 外观与模型 + 07 退出 | `measure` 概览格 / kv / 绑定码输入 / 主题 seg / 推荐台账 | 区域级：概览 empty（无空间/无数据） |
| 10-15 | teacher | `/t` | `TEACHER CONSOLE / 邀请码与学情总览` | 01 总览 + 02 邀请码 + 03 隐私与数据边界 + 04 学生列表 | 概览 measure / 邀请码块（复制）/ 学生表 | 区域级：学生列表 empty / error |
| 10-16 | teacher/student | `/t/student/:studentId` | `STUDENT DOSSIER / 教学必需的摘要` | 01 概览 + 02 缺口与推荐下发 + 03 已下发 + 04 最近答题原文 + 05 归因记录 | 档案 header / 缺口表 / 下发表单（字数计数）/ 答题原文 | 区域级：无学生 → 页面级错误 |
| 10-17 | teacher/recommendations | `/t/recommendations` | `RECOMMENDATION OPS / 全生命周期` | 01 汇总 + 02 台账 + 03 状态口径 | 汇总 measure / 台账表（六态 chip）/ 状态说明 | 区域级：台账 empty |

每页 `sheetHead` 四件：eyebrow（等宽大写 + 图标 + `SHEET 图号` + `需求 2.NN`）、`h1`、
`sheet-sub`（≤74ch）、`.dim`（右对齐等宽：`图幅 <档> · <宽度>px` + `基准 15px / IBM Plex Mono 批注`）。

---

## 11. 现有能力接线清单（原型缺失、必须逐页接回）

原型是纯前端 mock，以下能力**只存在于现有工程**，迁移时按页勾稽（P6 起每页变更说明逐项打勾）：

| # | 能力 | 现有实现（冻结） | 落位口径 |
| --- | --- | --- | --- |
| 1 | SSE 真流式 | `src/api/sse.ts` + `components/chat/useChatSend.ts`（phase/thought/tool/delta/meta/done 六事件 + 三级降级链） | `/chat` 与常驻面板共用；视觉层换成蓝图气泡与推理折叠，事件处理零改动 |
| 2 | 常驻对话面板 | `components/chat/ChatPanel.tsx` + `stores/chatPanel.ts` | 落**图纸右侧栏位**（原型 `.annos` 位）：`≥1180` 挤压图纸宽；`901–1179` 覆盖抽屉 + 幕布；`≤900` 全屏覆盖。store / Esc / 与移动导航互斥 / 跨路由保状态零改动 |
| 3 | 试卷识别刷新回显 + 错题缓存 | `router.ts` 的 `zhiwei_recognition_id` / `zhiwei_paper_wrong_*`（sessionStorage） | `/paper` 进页先读 recognition id 回显确认态；确认后写错题缓存；`/attribution` 第一步优先读缓存 |
| 4 | 空间胶囊 + 409 确认 + 新建表单 | `TopNav` 空间下拉 + `SpaceCreateForm` + `ConfirmDialog` | 胶囊迁入 Masthead 右区；「全部图纸」抽屉承载空间切换与新建紧凑态；409 仍走 ConfirmDialog |
| 5 | 路由守卫语义 | `router.tsx` `guardPath`（无活跃空间回 `/spaces`） | 一行不动；无空间时页面内提示改用蓝图红章/空盒样式 |
| 6 | 登录真实链路 | `stores/auth`（token 落盘、演示账号、401 清理） | `/login` 视觉换蓝图，链路零改动；演示账号块保留 |
| 7 | 标注列让位与面板互斥 | `--panel-dock-offset`（`panelDock.ts`）机制 | 保留机制、改阈值到 `annos/sheet` 档；面板打开时 LeaderLayer 停用、TitleBlock 层级高于幕布 |
| 8 | 打印样式 | `@media print` + `[data-print='hide']` | `/report` 打印：隐藏 masthead / rail / tabbar / 浮层；面板与表格转黑白边框 |

工程侧偏好键沿用现有：`zhiwei_theme`（主题，拍板①）、`zhiwei_active_space`、`zhiwei_token`、
`zhiwei_role`、`zhiwei_sr_done_*`。新增的标注/索引开关**落盘键另起**（不得占用上表键），
且不得进入 `router.ts` 的 `STORAGE_KEYS`（该文件是冻结区）。

---

## 12. 取舍记录

### 12.1 原型 4 条已知不足（D11 逐条拍板）

| # | 原型自认不足 | 拍板 | 落地口径 |
| --- | --- | --- | --- |
| 1 | `aria-details` 关联引线与标注卡 | **落地时补** | 改用 `aria-expanded` + `aria-controls` 组合（`aria-details` 浏览器支持不全），见 6.3 |
| 2 | `lg` 档（901–1179）也降级为「上标 + 列表」 | **按原样** | 不额外实现 1000–1179 的中间态；引线仅 `≥1180` 绘制 |
| 3 | 未做 `forced-colors` 适配 | **落地时补最小集** | `@media (forced-colors: active)` 下系统色 + 保留边框与虚线语义，见第 9 章末行 |
| 4 | 未做真机验证 | **不在本流水线范围** | 本工程无真机环境，留待用户；走查只覆盖桌面 headless 三/四档 |

### 12.2 与现有 md 规范冲突处 → 一律「以原型为准」（逐条留痕）

| 冲突点 | 现有 md 口径 | 原型口径 | 裁决 |
| --- | --- | --- | --- |
| 圆角刻度 | PRD §6 视觉段与 tailwind 注释锁「三档 6/10/16px」 | `--r:2px / --r0:0px`，无第三档 | **以原型为准**：圆角收敛为 0/2px 两档，`rounded-md` 等内置档在迁移页内清退 |
| 卡片阴影 | 工程 `--shadow-card` 有静态阴影（浅色双段晕） | 静态面一律无阴影（`无阴影` 写在原型文件头）、半透明面板不加模糊 | **以原型为准**：`--shadow-card: none`；仅浮层保留一层投影 |
| 主色 | PRD §6「主色低饱和青蓝 `#4E8FB0`」 | 白图 `#1A5FB4` / 蓝图 `#5AC8E8`（天蓝 `#4E86D6` 只作图形） | **以原型为准**：`PRIMARY_HEX` 换新值；`#4E86D6` 限图形用途（2.4） |
| 四档色名 | PRD §6「暖橙/黄/浅青绿/青绿」，禁大红 | 红 / 黄 / 蓝 / 青（`#F16A6A`…） | **以原型为准**：hex 换新系；engine 的语义色名（`BAND_COLORS`）属冻结区不改，二者不一致在此留痕 |
| 字体 | 工程用 Geist Variable + 系统中文，PRD 未锁字族 | Chivo / IBM Plex Mono / Noto Sans SC 三栈 | **以原型为准**：三族经 `@fontsource` 自托管（禁 CDN）；Geist 退出 `sans`/`mono` 栈 |
| 字号刻度 | tailwind `caption/ui-sm/reading/display/display-lg` 五档 | 15px 正文基线 + 26/20/17/13.5/12.5/11/10.5 的离散刻度 | **以原型为准**：在既有五档基础上增补 blueprint 刻度（`tok`/`mono-xs`/`num-lg`/`title`/`title-sm`/`body-sm`），仍禁任意值字号 |
| 动效 | 工程 token：rise 320ms / slide-in-panel 240ms / route-in 280ms，多条缓动 | `--t-ui:160ms` / `--t-fast:110ms` / `--t-draw:800ms` + **单一缓动** | **以原型为准**：三条时长 + 一条 `cubic-bezier(.2,.7,.3,1)`；既有动画令牌重写映射到这三档 |
| 主题默认 | v1.2 起「默认深色，可切浅色」 | 原型 `theme:'system'`（跟随系统，且系统浅色即浅色）| **以原型为准 + 拍板①**：跟随系统、优先白图；显式偏好最高、键沿用 `zhiwei_theme` |
| 断点 | 单一 `nav:720px`（移动端适配轮 D1/D2） | `data-tier` 四档（420/900/1180） | **以原型为准 + D1**：新增具名 `narrow/sheet/annos` 三档；`nav:720px` 保留不删（语义收窄） |
| 标签栏 | 顶栏 6 项主导航 + `<720` 汉堡抽屉 | 左侧分层索引 + `≤900` 底部 5 项 tabbar + 全部图纸抽屉 | **以原型为准**：外壳重构（P5），路由数据与守卫不动 |

### 12.3 原型 README 取舍 1–14 的工程口径（落地摘要）

- 单文件零构建是原型约束，不是产品约束：样式一律进 `index.css` / tailwind 令牌，组件零一次性样式。
- CDN 字体、`inline style` 装饰、`data-act` 全局事件代理、`innerHTML` 字符串渲染都是原型的实现手段，
  **不迁移**；只迁移其视觉与交互结果。
- 等宽批注中文可读性：中文批注取 11px 上限档（原型 10.5px 对小号中文偏小），已在 3.2 写死。
- 状态实验室、窄屏模拟开关、`data-tier` 全局驱动：不迁移（拍板③ / D1）。

### 12.4 落地时才可能暴露的差距（先登记，后留痕）

| 项 | 风险 | 处置 |
| --- | --- | --- |
| ECharts 键盘漫游 / 节点焦点环 / 800ms 描边入场 | ECharts canvas 无原生对应 | P7 批次按 D8 评估落地；做不到的逐项写入该批变更说明（记录，不静默砍） |
| 引线层与常驻面板同屏 | 面板挤压图纸后引线锚点会漂移 | P5 处置：面板打开时 LeaderLayer 停用；TitleBlock 层级高于幕布 |
| Noto Sans SC 体积 | 全量数 MB | `unicode-range` 分片按需；P3 末记录 `vite build` 产物体积实测 |
| 面板打开挤压 vs 顶栏左基线 | 破坏「内容列与顶栏共用左基线」不变量 | 沿用 `--panel-dock-offset` 单一来源机制（第 11 章 #7） |

**本章为活文档**：实现过程中发现规范笔误时，同批提交回写本章（只增与留痕修订，不静默改）。
