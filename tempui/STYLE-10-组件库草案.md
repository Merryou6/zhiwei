# STYLE-10「青蓝蓝图」组件库草案

> 配套文档：`tempui/STYLE-10-设计系统规范.md`（视觉依据，本文的取值全部引用它）、
> `_pipeline/01_PLAN.md`（批次与顺序）。
> 本文是**实现前的三样草案**：目录结构 / 组件清单 / 每件 props 与 variant 的 API 草案。
> 零实现细节（不写 JSX），只锁签名、变体、状态与「不动点」。

---

## 1. 目录结构

### 1.1 新增：`apps/web/src/components/blueprint/`（外壳族，13 件）

```
apps/web/src/components/blueprint/
├─ icons.tsx          # 统一笔画 SVG 图标族（导出 ICONS 表 + Icon 组件）
├─ Board.tsx          # 制图板：底色 + 四角十字标记 + 图幅档上下文
├─ Masthead.tsx       # 吸顶图签条：品牌 ⊕ 四项图签 ⊕ 右区操作
├─ Rail.tsx           # 左侧分层索引（学生/教师两套项表）
├─ Sheet.tsx          # 图纸区：sheet-head + section.block 组织
├─ TitleBlock.tsx     # 右下 8 格标题栏（dl/dt/dd）
├─ AnnoPin.tsx        # 标注编号徽标 + 按需展开浮层（aria-expanded/controls）
├─ AnnoPop.tsx        # 标注浮层正文（role=tooltip）
├─ LeaderLayer.tsx    # xl 档 SVG 虚线引线层（rAF 合并重绘 + hover 联动）
├─ BandMark.tsx       # 四档形状标记（形状 + 文字 + 等宽数值三重编码）
├─ Stamp.tsx          # 红章错误态（外实线 + 内虚线 + 方块章 + 真重试）
├─ MeasureBox.tsx     # 尺寸块（tok 标签 + big-num）
└─ SkeletonLines.tsx  # 静态发丝斜线骨架（不 shimmer）
```

- `tokens.css` **不单独成文件**（草案决定）：双主题 token 全部并入既有 `apps/web/src/index.css`
  （`--p-*` 原语层 + `--c-*` 角色层），理由是该文件已是全站唯一 token 真相且被
  `tests/tokens.test.ts` 直接读取 —— 拆成两个文件会让闸门要读两处，且 `@config` 绑定关系变复杂。
- 蓝图小组件（如 `Tok`、`SectionTitle`）**不进本目录**：`Sheet.tsx` 与 `index.css` 的
  `.bp-*` 制式类已覆盖，避免造第三套 UI 原语。

### 1.2 改造：`apps/web/src/components/`（16 件，就地改、路径不变）

```
components/
├─ ui/Button.tsx ui/Input.tsx ui/Card.tsx ui/Badge.tsx ui/IconButton.tsx ui/PageContainer.tsx
├─ ConfirmDialog.tsx Toast.tsx PageSkeleton.tsx BandLegend.tsx EmptyState.tsx
├─ ItemCard.tsx NextStepCard.tsx ThemeToggle.tsx
├─ MobileNav.tsx      # 重构为「底部 tabbar + 全部图纸抽屉」
└─ Layout.tsx         # 改为 Board/Masthead/Rail/Sheet/TitleBlock 装配
```

### 1.3 挂接关系

- `blueprint/` 只依赖 `lib/cn.ts`、`theme/bands.ts`（取色）与自身；**不 import 页面**。
- `ui/` 原语保持「无业务依赖」；蓝图视觉规格经令牌与 `.bp-*` 制式类落地，`ui/` 不 import `blueprint/`。
- `blueprint/` 可 import `ui/IconButton`（Masthead 的开关按钮复用原语，避免第二套图标按钮）。
- 页面（`pages/*`）从 `components/ui` 与 `components/blueprint` 取件，**不 import 彼此**。

---

## 2. 组件清单

### 2.1 新增外壳族 13 件（对应 `blueprint/` 13 个文件）

| 组件 | 职责 | 关键状态 | 无障碍要点 |
| --- | --- | --- | --- |
| `Board` | 制图板容器：底色、四角十字标记、图幅档（`data-tier`）、图层开关（`data-rail`/`data-annos`）、landing 变体 | tier、railOpen、annosOpen、view | 四角标记 `aria-hidden`；skip link 第一跳 |
| `Masthead` | 吸顶图签条：品牌 / 四项图签 / 身份芯片 / 索引开关 / 标注开关 / 全部图纸 / 对话面板开合 | 索引与标注的展开态（受控） | `aria-expanded` + `aria-controls` + `aria-pressed` |
| `Rail` | 分层索引：图号 + 标题 + 优先级，当前项高亮 | 当前路由（由 `NavLink` 派生） | `nav` + `aria-label`；`aria-current="page"` |
| `Sheet` | 图纸区：`sheet-head` + `section.block` + 右侧标注列槽位 | 无 | `main` + 一页一个 `h1` |
| `TitleBlock` | 右下 8 格标题栏 | 无（值由外壳注入） | `dl/dt/dd` 语义；打印保留 |
| `AnnoPin` | 编号徽标 + 展开浮层触发器 | `open`（单一展开） | `aria-expanded` + `aria-controls` + Esc 收起 |
| `AnnoPop` | 浮层正文（220–320px） | 无 | `role="tooltip"`；仅展开时存在 |
| `LeaderLayer` | xl 档虚线引线层 | 引线几何（rAF 合并）、hover 高亮 | `aria-hidden` + `focusable="false"` |
| `BandMark` | 四档形状标记（形状 + 文字 + 数值） | 无 | 形状 `aria-hidden`，文字为可读内容 |
| `Stamp` | 红章错误态 | 重试在途 | `role="alert"`；重试按钮真 disabled |
| `MeasureBox` | 尺寸块（tok + 大数字） | 无 | 数值 `num-mono`；缺失值输出「尚无可用的数」 |
| `SkeletonLines` | 静态发丝斜线骨架 | 无（静态） | `role="status"` + `aria-live="polite"` |
| `icons.tsx` | 43 枚统一笔画 SVG（`viewBox 24` / `stroke-width 1.25` / `linecap square` / `fill none`） | 无 | 默认 `aria-hidden`，需要时可读名 |

### 2.2 就地改造 16 件

| 组件 | 改造点 | **不动点** |
| --- | --- | --- |
| `ui/Button` | 换双线制图规格（1px 边 + inset 3px 内框 + 等宽大写 + hover 8% 青底）；`disabled` 转虚线 + 斜纹 + `[停用]` | `variant`/`size` 名称与语义、`as`/`href` 用法、`className` 合并行为、props 签名 |
| `ui/Input`（含 Textarea/Select/FormField） | 换下划线刻度制式（两端 7px 刻度脚 + 1px 下边 + focus 转 accent）；错误态转 red + `role="alert"` | `value/onChange/error/hint/label/required` 契约、`id` 生成规则、`autoComplete` 透传 |
| `ui/Card` | 换双线面板（`surface` 底 + `inset 3px` 内框线 + 2px 圆角）；`variant` 映射到 `solid/flat` | `as`/`padding`/`variant` 契约、children 语义 |
| `ui/Badge` | 换 chip 规格（等宽 10.5px 大写 + 22px 高 + 0 圆角）；`tone` 映射到 accent/amber/red/neutral | `tone` 取值集合、`children` 契约 |
| `ui/IconButton` | 44×44 保底 + hover 转 accent 边与图标；`size="sm"` 在移动档抬到 44 | `aria-label` 必填、`variant`、`id`/`aria-*` 透传 |
| `ui/PageContainer` / `PageHeader` | PageHeader 换「eyebrow + h1 + sub + dim」四件；PageContainer 换 `--pad-frame` 内边距 | 组件名与 props、页面调用方式（迁移页逐个替换，未迁移页不受影响） |
| `ConfirmDialog` | 换图纸模态规格（sheet-modal + 内框线 + danger 确认键 + 幕布双主题） | `open/onConfirm/onCancel/title/body` 契约、焦点陷阱、Esc、焦点归还 |
| `Toast` | 换右下等宽批注条（左边 3px 语义条 + 110/160ms 过渡）；`bottom` 让位 tabbar | 队列语义、`kind` 取值、`role="status"` |
| `PageSkeleton` | 换 `SkeletonLines`（**静态**斜线，不 shimmer） | props（`label`/`rows`）与页面调用方式 |
| `BandLegend` | 换「形状 + 色 + 文字 + 区间」四列图例（形状取四档 + 未接触/未解锁/低置信） | `BAND_ORDER` 顺序来源、取值入口（`theme/bands.ts`） |
| `EmptyState` | 换虚线空盒（双层虚框 + `EMPTY SET · 空集合` 标签） | props（`title`/`description`/`actions`）与「只引导不重试」语义 |
| `ItemCard` | 换双线面板 + 图号/比例批注位 + 右侧操作列 | 现有 props 与在页面中的语义（列表项 / 可点行） |
| `NextStepCard` | 换「下一步」图纸制式（编号 + 标题 + 出口按钮组） | 现有 props（步骤/出口）与顺序语义 |
| `ThemeToggle` | 换 44×44 图标按钮 + 三态（跟随系统 / 浅色 / 深色）下拉；沿用 `useThemeStore` | store 接口、落盘键 `zhiwei_theme`、与 `/me` 页共用同一状态 |
| `MobileNav` | 重构为「底部 5 项 tabbar + 全部图纸抽屉」（承载空间切换 + 新建紧凑态 + 管理入口） | `mobileNav` store 行为、焦点陷阱、Esc、与 `chatPanel` 互斥、`lib/ids.ts` 的 id 常量、路由联动 |
| `首帧脚本 + themeStore` | 按拍板①重写初始判定（跟随系统、优先白图）；`THEME_COLOR` 换新双主题底色 | 落盘键 `zhiwei_theme`、`setTheme/toggle` 契约、DOM 开关仍是 `html.dusk` |
| `Layout` | 改为 Board/Masthead/Rail/Sheet/TitleBlock 装配 + ChatPanel 落位图纸右侧栏位 | `children` 契约、`min-h-dvh`、`chatPanel`/`mobileNav` store 零改动、面板让位 `--panel-dock-offset` 单一来源 |

---

## 3. API 草案（props / variant）

约定：所有组件 `className?: string`（经 `cn()` 合并到根节点）与 `...rest` 透传；
`tone` 类字段一律取**语义名**，不暴露 hex。

### 3.1 `blueprint/Board.tsx`

```ts
export type BlueprintTier = 'xl' | 'lg' | 'md' | 'sm';       // ≥1180 / 901–1179 / 421–900 / ≤420
export interface BoardProps {
  tier?: BlueprintTier;         // 缺省由内部 matchMedia 三档推导
  view?: 'shell' | 'landing';   // landing：无 rail / 无 annos / 无标题栏（门户页）
  railOpen?: boolean;           // 缺省 true
  annosOpen?: boolean;          // 缺省 false（原型：标注默认收起）
  onRailToggle?: () => void;
  onAnnosToggle?: () => void;
  children: ReactNode;
}
```
- variant：`view='landing'` 时 `#board` 相关装饰块（rail / annos / leaderLayer / titleblock /
  tabbar / 索引与标注开关 / 四项图签）整体不渲染（原型 `#board[data-view="landing"]` 的 `display:none` 组）。
- 不动点：不接管路由、不读 store；`railOpen/annosOpen` 是受控 props（落盘由外壳层做）。

### 3.2 `blueprint/Masthead.tsx`

```ts
export interface MastheadProject { project: string; sheetNo: string; scale: string; date: string }
export interface MastheadProps {
  /** 四项图签（项目/图号/比例/日期）。≤900 档整块收起（CSS）。 */
  meta: MastheadProject;
  /** 身份芯片：未登录 / 学生 · 昵称 / 教师 · 昵称。 */
  identity: { role: 'guest' | 'student' | 'teacher'; nickname?: string };
  railOpen: boolean;
  annosOpen: boolean;
  onRailToggle: () => void;
  onAnnosToggle: () => void;
  onOpenIndex: () => void;      // 全部图纸抽屉
  onTogglePanel: () => void;    // 常驻对话面板（D3：开合钮落在 .mast-right）
  panelOpen: boolean;
  /** 空间胶囊与主题钮槽位（由外壳注入，避免 Masthead 依赖 store）。 */
  trailing?: ReactNode;
}
```
- variant：无；宽度档位差异全部由 CSS（`sheet:` / `narrow:` 变体）表达。
- 无障碍：索引开关 `aria-expanded`、标注开关 `aria-pressed`、面板开合 `aria-pressed`。

### 3.3 `blueprint/Rail.tsx`

```ts
export interface RailItem { path: string; dwg: string; label: string; pr: 'T0' | 'T1' | 'T2' }
export interface RailProps {
  items: RailItem[];
  /** 当前路径（由外壳从 useLocation 取，Rail 自身不依赖路由）。 */
  current?: string;
  title?: string;        // 缺省「分层索引」
  note?: ReactNode;      // 底部图层说明 / 当前空间 / 证据计数
}
```
- variant：`dense`（抽屉内复用：去掉左侧 padding）。

### 3.4 `blueprint/Sheet.tsx`

```ts
export interface SheetHeadProps {
  eyebrow: string;
  sheetNo: string;       // 如 '10-12'
  section?: string;      // 需求编号，如 '2.12'
  title: string;
  sub?: string;
  /** 右对齐 dim 行，缺省自动输出「图幅 <档> · <宽度>px」+ 基准说明。 */
  dim?: string;
  chips?: ReactNode;
}
export interface SheetProps {
  head?: SheetHeadProps;
  /** 右侧栏位（原型 .annos 位）：标注列 / 常驻面板 / 都放空。 */
  aside?: ReactNode;
  annosOpen?: boolean;
  children: ReactNode;
}
export interface BlockProps {
  no?: string;           // 分节号 '01'
  title: string;
  right?: ReactNode;     // 分节右侧的 tok / chip
  children: ReactNode;
}
```
- variant：`Sheet` 的 `aside` 空 / 非空决定 `.sheet-grid` 单栏或两栏（`annos:` 档两栏 296px）。

### 3.5 `blueprint/TitleBlock.tsx`

```ts
export interface TitleCell { label: string; value: string }
export interface TitleBlockProps {
  cells: TitleCell[];    // 固定 8 格：项目/图号/比例/日期/视图/制图/状态/签发
  dataPrint?: 'hide' | undefined;   // 打印时保留（默认不传）
}
```
- variant：无；`md/sm` 档 CSS 转 2 列。

### 3.6 `blueprint/AnnoPin.tsx` / `AnnoPop.tsx`

```ts
export interface AnnoPopProps { no: string; title: string; body: string; id?: string }
export interface AnnoPinProps {
  no: string;            // '①' / 'A1'
  title: string;
  body: string;
  /** 受控展开（单一展开由父容器保证）。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 徽标尺寸：xl 档 24px；md/sm 档与 pointer:coarse 一律 44px（CSS 表达）。 */
}
```
- variant：`pin`（编号徽标 / 默认收起）、`supplement`（上标 + 列表形态，非 xl 档）。
- 无障碍：`aria-expanded` + `aria-controls={popId}`；浮层 `role="tooltip"`；Esc 收起（D11 拍板）。

### 3.7 `blueprint/LeaderLayer.tsx`

```ts
export interface LeaderTarget { no: string; sourceRef: string; cardRef: string }
export interface LeaderLayerProps {
  /** 引线对：source（图纸上的目标）→ card（标注卡）。 */
  lines: LeaderTarget[];
  /** false（面板打开 / annos 关 / 非 xl 档）时整层不渲染。 */
  active?: boolean;
  /** 入场描边动画（800ms，仅首次挂载）。 */
  draw?: boolean;
  highlightNo?: string | null;
}
```
- 内部：`ResizeObserver` + `scroll`/`resize` 监听，`requestAnimationFrame` 合并重绘；
  间距 < 24px 的对不绘制。
- 不动点：不持有业务状态；几何计算是纯函数（可单测）。

### 3.8 `blueprint/BandMark.tsx`

```ts
export type BandKey = '待巩固' | '不稳定' | '基本掌握' | '已掌握' | '未接触' | '未解锁' | '低置信';
export interface BandMarkProps {
  band: BandKey;          // 引擎档名，前端不另写阈值
  mastery?: number | null;
  text?: string;          // 缺省 = band
  showValue?: boolean;    // 缺省 true 且 mastery != null
  size?: 'sm' | 'md';     // 16 / 18px
  bar?: boolean;          // 追加条形（含 40/60/80 刻度）
}
```
- variant：形状由 `band` 决定（菱形/五边形/六边形/圆形/双圈/空框）；颜色取 `-t` 系列。

### 3.9 `blueprint/Stamp.tsx`

```ts
export interface StampProps {
  title: string;            // 缺省「!! 数据获取失败」
  seal?: string;            // 方块章文字，缺省 'RED STAMP'
  reason: string;           // 失败的是什么 + 为什么
  onRetry?: () => void;     // 有则渲染主按钮；真重试，在途时 disabled
  retrying?: boolean;
  alt?: { label: string; to: string };   // 一条出路
  tone?: 'red' | 'amber';   // amber = 角色/权限类提示章（非失败）
}
```
- 无障碍：`role="alert"`；`title` 作为报警可访问名。
- 纪律：**不提供**「状态实验室」文本按钮（拍板③不迁移）。

### 3.10 `blueprint/MeasureBox.tsx`

```ts
export interface MeasureBoxProps {
  label: string;                    // tok 标签
  value: string | number | null;    // null → 「尚无可用的数」
  suffix?: string;                  // 单位（同一 tok 制式）
  tone?: 'default' | 'accent' | 'red' | 'amber';
}
```

### 3.11 `blueprint/SkeletonLines.tsx`

```ts
export interface SkeletonLinesProps {
  rows?: number;       // 缺省 3；宽度按 100% - i*9%（下限 40%）
  block?: boolean;     // 追加 104px 斜纹块
  note?: string;       // 缺省「取数中 · 不伪造内容」
}
```
- 硬约束：**无动画**（不 shimmer、不呼吸）；容器 `role="status"`。

### 3.12 `blueprint/icons.tsx`

```ts
export type IconName = keyof typeof ICONS;   // 43 枚
export interface IconProps {
  name: IconName;
  size?: number | string;     // 缺省 16，组内以 CSS 类控制（.ic / .sh）
  className?: string;
  title?: string;             // 有 title 时 aria-hidden 撤下并输出可访问名
}
export declare const ICONS: Record<IconName, ReactNode>;  // 仅供 BandMark 之外的原语内部使用
```
- 规格锁死：`viewBox="0 0 24 24"`、`fill="none"`、`stroke="currentColor"`、`strokeWidth 1.25`、
  `strokeLinecap="square"`、`strokeLinejoin="miter"`。

---

## 4. 就地改造的 API 变化预告（细化到签名）

| 组件 | 新增 props | 语义变更 | 兼容性 |
| --- | --- | --- | --- |
| `ui/Button` | 无 | 视觉规格换蓝图；`disabled` 文案前缀 `[停用] ` 由 CSS `::before` 输出 | 完全兼容（旧调用零改动） |
| `ui/Input` | `state?: 'normal' \| 'readonly' \| 'disabled'` | 下划线制式；`error` 从「红字提示」升级为「红边 + 刻度脚 + `role="alert"`」 | 兼容（缺省 normal） |
| `ui/Card` | `variant?: 'panel' \| 'solid' \| 'flat'`（合并旧值） | 双线面板；`shadow` 概念删除（一律无阴影） | 旧 variant 值保留映射 |
| `ui/Badge` | 无 | chip 规格；`tone` 集合不变 | 兼容 |
| `ui/IconButton` | 无 | 尺寸保底 44；hover 规格 | 兼容 |
| `ui/PageContainer` | `frame?: 'sheet' \| 'bare'` | `--pad-frame` 制式 | 兼容 |
| `ui/PageHeader` | 无（props 不变） | 四件式（eyebrow/h1/sub/dim） | 兼容 |
| `ConfirmDialog` | 无 | 图纸模态视觉 | 兼容（焦点陷阱/Esc 行为不变） |
| `Toast` | 无 | 右下批注条；`bottom` 让位 tabbar | 兼容 |
| `PageSkeleton` | 无 | 换 `SkeletonLines` | 兼容 |
| `BandLegend` | `variant?: 'full' \| 'compact'` | 形状+色+文字+区间四列 | 兼容 |
| `EmptyState` | 无 | 虚线空盒 | 兼容 |
| `ItemCard` | `dwg?: string` | 图号批注位 | 兼容 |
| `NextStepCard` | `no?: string` | 分节编号 | 兼容 |
| `ThemeToggle` | 无（仍是 `useThemeStore`） | 三态下拉（跟随系统/浅色/深色） | store 契约不变 |
| `MobileNav` | 无（id 常量不变） | 抽屉内容扩展为「全部图纸 + 空间切换 + 新建」 | `lib/ids.ts` 契约不变 |
| `Layout` | 无（`children`） | 四层骨架装配 | `children` 契约不变 |

---

## 5. 测试影响预告

- 已锁定将被改期望的 4 个门禁文件：`tokens.test.ts`、`bands.test.ts`、`breakpoints.test.ts`、
  `themeStore.test.ts`（**只换值、不删断言、用例数只增不减**）。
- 预计不动：`routerGuard` / `sse` / `client` / `chatPanel` / `mobileNav` / `dialogStore` /
  `graphMastery` / `graphSnapshot` / `reveal` / `phrases` / `stages` / `authStore` /
  `format` / `richText` / `useCountUp` / `logoGeometry`。
- 可新增（纯逻辑，不引渲染测试栈）：引线几何纯函数（`LeaderLayer` 的 `computeLeaderPath`）、
  `AnnoPin` 单一展开状态机、`icons.tsx` 的 43 枚名称集合与规格约束。
