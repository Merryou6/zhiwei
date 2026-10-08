# 知微 · 双端架构设计方案（学生端 + 老师端）

> 版本 v1.0 · 2026-10-08 · 配套契约变更：API_CONTRACT **v1.6**（追加式，本文档 §8 有草稿）
> 定位：在**不破坏现有学生端任何行为**的前提下，为「AI + 教学管理助手」的参赛方向补上老师视角。

---

## 0. 一句话定位

> **学生端回答"我现在该学什么"，老师端回答"我的学生们整体怎么样、我该推谁一把"。**

三条设计原则，全文所有决策都向它们对齐：

1. **学生端零破坏** —— 老师端全部走增量：新角色字段缺省 student、新路由 `/t/*`、新表追加。老用户升级后行为一字不变。
2. **老师是"专业旁观者 + 干预者"，不是家长** —— 现有"多空间切换"是家长替孩子操作；老师端是**只读观察 + 下发推荐**，绝不替学生答题、绝不看学生对话原文（教育信任红线，§1.3）。
3. **推荐必须可度量** —— 老师下发知识点推荐后，学生补完、复测，ΔAccuracy 自动回流到推荐记录上。老师看到的不只是"我布置过"，而是"布置了、做了、提升了 +8%"。这是和"喊话式"教学工具的本质区别。

---

## 1. 产品设计

### 1.1 角色定义

| | 学生端（现状） | 老师端（新增） |
|---|---|---|
| 核心动作 | 自报 → 测评 → 对话 → 归因 → 干预 | **看**（掌握地图）→ **判**（共性/个性缺口）→ **推**（下发知识点）→ **验**（效果回流） |
| 数据身份 | 每个学生一个 space（现有 SpaceRecord） | 一个老师账号绑定多个学生的 space |
| 登录后去向 | `/spaces`（现状） | `/t/students`（教师工作台） |
| 产品人设 | "学长" | "老师"——语气纪律延续：不施压、不说教，"我看了你的地图，这周先把这一环补上" |

### 1.2 用户故事（老师端验收基准）

1. **作为老师，我要能绑定我的学生**：我生成一个邀请码发到家长群，学生在 App 里输入，绑定完成——不需要收集任何手机号/真实姓名。
2. **作为老师，我要一眼看到全班的掌握概况**：打开工作台，每张学生卡片有平均掌握度、薄弱点 Top3、最近活跃时间、7 日趋势箭头。
3. **作为老师，我要能点进一个学生看细节**：他的知识图谱（只读）、缺口清单（复用学生端报告页口径）、最近测评记录、掌握度趋势。
4. **作为老师，我要能给学生布置"补什么"**：在他的缺口里勾选 2–3 个知识点，附一句话留言，下发。
5. **作为老师，我要知道我布置的东西有没有用**：推荐列表里每一条显示状态（已下发/进行中/已完成/已搁置）和完成后的 ΔAccuracy。

### 1.3 隐私红线（写进契约和代码白名单，不是口号）

**老师看得到：**
- 聚合掌握度（kp 级 mastery%、状态带、缺口清单）
- 掌握度趋势（mastery_logs 聚合，按天）
- 行为**计数**（近 7 日：证据事件数、测评提交数、对话轮数）
- 时间戳类事件（"昨天完成了诊断测评"）

**老师看得到（2026-10-08 v1.1 修订：教学必需的原文开放）：**
- ✅ 答卷原文、答题原文、错题原文 —— 老师批改讲评与归因复核的基础；详情页新增「答卷视图」Tab，直接关联 attribution / recognitions 记录呈现
- ✅ 聚合掌握度、趋势、行为计数、事件时间戳

**老师看不到：**
- ❌ 对话原文（学长和学生聊了什么——内部辅导过程；如需开放须家长/学生逐次授权，本版不做）
- ❌ 学生真实身份信息（产品本就不收集）

**实现纪律**：老师端数据由**专用序列化函数** `toTeacherSnapshot()` / `toTeacherDetail()` 产出（services/teacher/snapshot.ts），不走学生端序列化路径——白名单字段按「摘要层 / 详情层」两级可见性逐一列在代码注释里，新增字段必须先改契约再改代码。绑定必须**双向确认**（§2.2），未成年人数据不经学生/家长同意不得被第三方查看。

---

## 2. 数据模型（三张新表 + 一个字段）

### 2.1 UserRecord 加 role 字段（向后兼容）

```ts
export interface UserRecord {
  user_id: string;
  identifier: string;
  password_hash: string;
  nickname: string | null;
  /** v1.6 新增：'student' | 'teacher'。旧记录无此字段 → 读取时按 'student' 兜底。 */
  role?: 'student' | 'teacher';
  created_at: string;
}
```

- 注册接口加可选 `role` 参数（缺省 'student'）；登录/注册响应增加 `role` 字段，前端据此决定进入哪个壳。
- 老师也可以有自己的 space（老师自己想体验学生端完全不受影响）。

### 2.2 TeacherLinkRecord —— 绑定关系（新表 `links`）

```ts
export interface TeacherLinkRecord {
  link_id: string;            // 'lnk_xxx'
  teacher_user_id: string;    // 老师账号
  student_space_id: string;   // 绑定到学生的【空间】（数据单位是 space，不是 user——与现有五步闭环的数据归属一致）
  student_user_id: string;    // 冗余存一份，便于反查
  /** pending（学生已输入码，待确认）→ active → removed（任一方解绑，软删留痕） */
  status: 'pending' | 'active' | 'removed';
  note: string | null;        // 学生输入码时可备注"我是三班王某某的家长"
  created_at: string;
  confirmed_at: string | null;
  removed_at: string | null;
}

export interface InviteCodeRecord {
  code: string;               // 6 位大写字母数字（去掉易混淆的 0/O/1/I）
  teacher_user_id: string;
  max_uses: number;           // 默认 30（一个班）
  used_count: number;
  expires_at: string;         // 默认 7 天
  created_at: string;
}
```

**绑定流程（双向确认，未成年人保护）：**

```
老师端"我的学生"页 → 生成邀请码（6 位，7 天有效，最多 30 人）
        │  发到家长群
        ▼
学生端「我的」页 → 新区块"我的老师" → 输入邀请码
        │  显示确认卡片：「老师【昵称】想看到你的学习地图（不含对话和答卷原文）」
        ▼
学生点"同意绑定" → link 状态 active → 双方立即互见
```

### 2.3 TeacherRecommendationRecord —— 推荐（新表 `recommendations`）

```ts
export interface TeacherRecommendationRecord {
  rec_id: string;             // 'rec_xxx'
  link_id: string;            // 经哪个绑定关系下发（权限校验的锚点）
  teacher_user_id: string;
  student_space_id: string;
  kp_ids: string[];           // 推荐补的知识点（完整 kp id，1–5 个）
  kp_names: string[];         // 下发时快照名称（图谱改名不影响历史显示）
  note: string | null;        // 老师留言（≤100 字）
  /** assigned → viewed → in_progress → done | dismissed | expired */
  status: 'assigned' | 'viewed' | 'in_progress' | 'done' | 'dismissed' | 'expired';
  /** 效果回流：done 时由复测闭环自动写入 */
  delta_accuracy: number | null;   // 该 kp 集合复测 ΔAccuracy（-1 ~ 1）
  done_at: string | null;
  created_at: string;
}
```

**推荐状态机：**

```
assigned（老师下发）
   │ 学生端打开推荐卡          └── 30 天无任何动作 → expired（服务端惰性置位）
   ▼
viewed ──学生点"开始补"──▶ in_progress
                              │ 该 kp 集合完成复测且 ΔAccuracy ≥ 0
                              ▼
                             done（delta_accuracy 自动回写）
   学生点"暂时不需要" ──▶ dismissed（老师端可见，可重新下发）
```

- 学生点"开始补"→ 跳对话页并携带 kp 上下文（复用对话页已有的 kp 定向能力）。
- **效果回写是自动的**：复测（mode=retest）落证据时，服务端检查该 space 是否有 in_progress 的推荐覆盖了被复测的 kp——命中则聚合 ΔAccuracy 写回。老师端零操作。

---

## 3. "及时查看"的实现：快照聚合，零新数据依赖

老师端**不需要学生上传任何新数据**——五步闭环产生的数据本来就够。新增一个聚合服务：

```
services/teacher/snapshot.ts
  studentSummary(space_id)   → 单学生摘要（卡片用）
  studentDetail(space_id)    → 单学生详情（详情页用）
  classOverview(link 集合)   → 按学生列表聚合
```

| 指标 | 来源 | 口径 |
|---|---|---|
| 平均掌握度 | mastery_profiles | 该 space 全部 kp mastery 均值 |
| 掌握度带分布 | mastery_profiles | 按 status 分带计数（牢固/一般/薄弱，复用报告页 BAND 口径） |
| 缺口 Top N | mastery_profiles | mastery < 40% 升序，复用报告页 gaps 口径 |
| 7 日趋势 | mastery_logs | 按天聚合 (after - before)，出箭头 ↑↓→ |
| 最近活跃 | evidence_events | 最新一条 created_at + 近 7 日按 source 计数 |
| 复测记录 | evidence_events (mode=retest) | 最近一次复测时间与 ΔAccuracy |

**性能与实时性**：dev/单机阶段读 JSON store，快照聚合全内存完成，30 个学生 < 10ms；前端工作台 30s 轮询（React Query 式 refetchOnInterval 或简单 setInterval）。**预留 SSE 升级位**：`/api/teacher/stream`（复用 agent/chat 的 SSE 基建），P2 再接——现阶段轮询完全够"及时"。

---

## 4. API 设计（契约 v1.6，全部追加式）

### 4.1 新增端点（8 个）

| # | 端点 | 方法 | 说明 |
|---|---|---|---|
| 21 | `/api/teacher/link/code` | POST | 老师生成邀请码 `{max_uses?, days?}` → `{code, expires_at, max_uses}` |
| 22 | `/api/teacher/students` | GET | 老师的学生摘要列表（快照聚合） |
| 23 | `/api/teacher/student/:spaceId` | GET | 单学生详情快照（权限：存在 active link） |
| 24 | `/api/teacher/recommendations` | POST | 下发推荐 `{space_id, kp_ids[], note?}` |
| 25 | `/api/teacher/recommendations` | GET | `?space_id=` 查已下发推荐及状态/效果 |
| 26 | `/api/link/bind` | POST | 学生端 `{code}` → 创建 pending → 响应带老师昵称供确认卡片展示；`{code, confirm: true}` 二次调用 → active |
| 27 | `/api/link/list` | GET | 学生端：我的老师列表 |
| 28 | `/api/recommendations` | GET | 学生端：收到的推荐（`?status=` 过滤） |
| 29 | `/api/recommendations/:recId/feedback` | POST | 学生端 `{action: 'viewed'\|'in_progress'\|'dismissed'}` |

**另有 2 个既有端点的兼容性扩展**（非破坏）：
- `/api/auth/register`：body 加可选 `role`；响应加 `role`。
- `/api/auth/login`：响应加 `role`。

### 4.2 权限模型（新守卫函数）

```
requireTeacher(req, ctx)                  → UserRecord.role === 'teacher'
requireActiveLink(ctx, teacherId, spaceId) → TeacherLinkRecord 存在且 active
requireLinkOwned(ctx, teacherId, linkId)  → 推荐操作时校验 link 归属
```

- 所有 `/api/teacher/*` 先过 `requireTeacher`，再过 `requireActiveLink`。
- 学生端 `/api/recommendations*` 校验 rec 的 `student_space_id` 属于当前用户（复用 `requireSpaceOwnership` 思路）。
- 解绑后（status=removed）老师立即失去查看权；推荐记录保留但只读。

### 4.3 响应结构示例（老师端白名单的可视化）

```jsonc
// GET /api/teacher/students → data.students[]
{
  "space_id": "sp_1",
  "nickname": "小测",              // 学生注册时的称呼（可空 → "未署名学生"）
  "bound_at": "2026-10-08T10:00:00Z",
  "avg_mastery": 0.62,
  "bands": { "牢固": 8, "一般": 9, "薄弱": 6 },
  "top_gaps": [                    // 最多 3 条
    { "kp_id": "math.cz.qhhs.dbsx", "name": "二次函数顶点式", "mastery": 0.21 }
  ],
  "trend_7d": +0.04,               // 7 日 mastery 净变化；null = 无日志
  "last_active_at": "2026-10-08T18:02:00Z",
  "activity_7d": { "diagnose": 12, "chat": 5, "attribution": 2 },  // 计数，无原文
  "open_recommendations": 1        // 未完成推荐数
}
```

---

## 5. 前端设计（4 个新页面 + 学生端 2 处增量）

### 5.1 双壳路由

```
App.tsx
 ├─ role === 'student'（或缺省）→ 现有 11 页路由，一字不动
 └─ role === 'teacher'         → TeacherShell（/t/* 子路由）
      ├─ /t/students              TeacherStudentsPage    班级总览（默认落地页）
      ├─ /t/students/:spaceId     TeacherStudentDetailPage 单学生详情
      ├─ /t/recommendations       TeacherRecsPage        推荐管理与效果
      └─ /t/invite                TeacherInvitePage      邀请码管理（可并入 students 页）
```

- `Guarded` 组件扩展：登录响应带 role，session 存储 role；`/t/*` 路由守卫校验 `role==='teacher'`，学生访问 `/t/*` 重定向回 `/spaces`，反之亦然。
- 老师端导航独立（不复用学生端底部栏）：左侧/顶部简洁导航"我的学生 · 推荐记录 · 邀请码 · 退出"。

### 5.2 页面信息架构

**① TeacherStudentsPage（班级总览，默认页）**

```
┌────────────────────────────────────────────────────────────┐
│ 我的学生（6）                    [+ 生成邀请码] [⟳ 30s 自动刷新] │
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 小测      │ │ 未署名    │ │ …        │ │ …        │        │
│ │ 62% ▲4%  │ │ 48% →0%  │ │          │ │          │        │
│ │ 薄弱 6 点 │ │ 薄弱 11 点│ │          │ │          │        │
│ │ 最紧:顶点式│ │ 最紧:因式 │ │          │ │          │        │
│ │ 2h 前活跃 │ │ 3d 未活跃 │ │          │ │          │        │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│   （3 天未活跃的学生卡片置灰 + "该提醒了"徽标）                  │
└────────────────────────────────────────────────────────────┘
```

**② TeacherStudentDetailPage（单学生详情，4 个 Tab）**

```
[掌握地图] [缺口清单] [最近动态] [推荐记录]
 ├ 掌握地图：复用学生端图谱组件（只读模式，禁编辑/对话入口）
 ├ 缺口清单：复用报告页 gaps 表 + 每行 checkbox → 底部浮出推荐条
 │    「已选 2 个知识点 [留言框：这周先把这两个补了？] [下发]」
 ├ 最近动态：事件时间线（"昨天 · 诊断测评 12 题""3 天前 · 补了顶点式"）——只有事件，无原文
 └ 推荐记录：对该生历史推荐 + 状态 + ΔAccuracy
```

**③ TeacherRecsPage（跨学生推荐管理）**
- 表格：学生 / 知识点 / 下发时间 / 状态 / ΔAccuracy / 重推按钮
- 顶部小统计：本周期下发 N 条 · 已完成 X 条 · 平均提升 Y%

**④ 学生端增量**
- **MePage** 新区块"我的老师"：已绑定老师列表 + [输入邀请码] 入口 + 解绑。
- **推荐卡（全局）**：新组件 `RecommendCard`——有 assigned/in_progress 推荐时，报告页顶部与对话页入口旁出现："老师【昵称】建议你先补：二次函数顶点式、配方法 → [开始补] [暂时不需要]"。
  - 点"开始补"→ 跳对话页带 kp 上下文（复用现有对话定向能力），状态推进 in_progress。

### 5.3 复用组件清单（不重造轮子）

| 复用 | 用途 |
|---|---|
| 图谱组件（GraphPage 画布） | 详情页"掌握地图"Tab，加 `readonly` prop |
| 报告页 BAND 配色/percent 工具 | 学生卡片、缺口表 |
| `NextStepCard` | 老师端引导文案容器（"还没有学生？生成邀请码发到家长群"） |
| ui 基件（Button/Card/PageHeader） | 全部新页面 |
| 语气文案走 `lib/phrases.ts` 集中管理（UI_TEXT 加 teacher 段） | 语气纪律延续 |

---

## 6. 老师端文案基调（延续产品语气纪律）

产品最被称道的是语气纪律，老师端不能变成"管理后台腔"。基调：**老师是加油站，不是监控器。**

- 空态："还没有学生。生成一个邀请码发到家长群，剩下的交给时间。"
- 学生 3 天未活跃（卡片徽标）："3 天没来了——也许是忙，不催，但可以问问。"
- 推荐下发成功："布置好了。等 TA 复测，你会看到变化。"
- 推荐完成（ΔAccuracy +8%）："顶点式 +8%。你推的这一把，TA 接住了。"
- 学生 dismissed："TA 说暂时不需要。尊重这个选择，也可以问问为什么。"

**明令禁止**：排行榜、红色警示、"落后于班级平均"类对比话术——与产品"不制造焦虑"的立身之本冲突。

---

## 7. 实施排期

### P0 · 可演示闭环（预计 1 个工作日的改造量）
**后端**（functions/api/src）
1. `db/types.ts`：UserRecord.role + 三个新 Record 类型
2. `db/jsonStore.ts` + `db/cloudbaseStore.ts`：links / invite_codes / recommendations 三表 CRUD（jsonStore 为主，cloudbase 按既有桩模式补签名）
3. `services/teacher/`：snapshot.ts（聚合）、link.ts（邀请码+绑定）、recommend.ts（下发+反馈+效果回写钩子）
4. `services/diagnose.ts`：retest 提交后调用推荐效果回写钩子（~15 行）
5. `services/auth.ts`：role 字段透传
6. `router.ts`：9 条新路由 + 3 个守卫函数
7. `serialization.ts`：toTeacherSnapshot 白名单序列化
8. 测试：teacher.test.ts（绑定流程/权限边界/快照口径/效果回写）、link 权限负例（老师看未绑定空间必须 403）

**前端**（apps/web/src）
1. session 存 role；App.tsx 双壳路由 + /t/* 守卫
2. TeacherShell + 3 页（students / detail / recommendations）
3. 学生端 MePage"我的老师"区块 + RecommendCard 全局组件
4. phrases.ts teacher 段文案

**验收**：注册老师→生成码→学生绑定→老师看板看到学生→勾缺口下发→学生端见卡→点开始补→做复测→老师端推荐变 done 且带 ΔAccuracy。

### P1 · 教学管理纵深（P0 之后）
1. **班级共性分析**：聚合全部绑定学生的缺口 → "全班 62% 在『一元二次方程判别式』上薄弱"（老师端总览页顶部横幅）——这是"教学管理"最直给的落点，数据全现成。
2. 推荐模板：常用推荐话术保存/一键套用。
3. 掌握度趋势折线图（学生详情页，mastery_logs 按天）。
4. 学生端推荐执行引导强化（推荐卡 → 直接预填对话提问）。

### P2 · 班级化与外延
1. 班级模型（teacher → class → students），邀请码按班发放；当前 P0 的"扁平绑定"在数据上可无损升级（加 class_id 可空字段）。
2. 班级周报 PDF 导出（复用报告页打印能力）。
3. 作业布置（题目级，复用题库 item_id + distractors 基建）。
4. SSE 实时推送（复用对话流基建）。

### 明确不做（记录决策）
- 老师替学生作答/代操作 —— 违反"老师是旁观者"定位
- 老师看对话原文 —— 隐私红线（§1.3）
- 班级排名/横向对比 —— 语气红线（§6）

---

## 8. API_CONTRACT v1.6 变更条目（草稿，实施时追加）

```
| 2026-10-XX | **v1.6 双端架构（教师工作台）**：① /api/auth/register|login 增加
role 字段（可选入参 'teacher'，缺省 'student'；响应新增 role，向后兼容）；
② 新增教师端接口 #21–#25（邀请码 / 学生快照 / 推荐下发与查询）与学生端接口
#26–#29（绑定 / 我的老师 / 推荐查询与反馈）；③ 新增三表 links、invite_codes、
recommendations；④ 快照白名单纪律：教师端仅可见聚合掌握度、趋势、行为计数与
事件时间戳，**对话原文、答卷原文、答题原文永不下发教师端**（序列化走
toTeacherSnapshot 专用白名单）；⑤ 推荐效果自动回写：retest 闭环在推荐覆盖的
kp 集合完成复测后，将 ΔAccuracy 写回推荐记录（status=done）。全部为向后兼容
的追加式变更，学生端既有接口行为零变化 | 项目方 | 总控 |
```

---

## 9. 答辩演示脚本（90 秒）

1. **画面 1（10s）**：老师登录 → 工作台。"我刚带了两个班，打开知微，每个学生的情况一屏看完。"
2. **画面 2（20s）**：点进一个学生 → 掌握地图 + 缺口清单 → 勾选 2 个知识点，留言"这周先把这两个补了？" → 下发。
3. **画面 3（20s）**：切到学生手机 → 报告页出现老师的推荐卡 → 点"开始补" → 学长定向辅导 → 做复测。
4. **画面 4（20s）**：切回老师端 → 推荐状态变"已完成 · ΔAccuracy +8%"。
5. **收尾（20s）**："学生端管学，老师端管教，中间靠一条**可度量的推荐闭环**连起来——不是布置了就完了，是布置了、做了、看得见效果。"

---

## 10. 风险与备选

| 风险 | 缓解 |
|---|---|
| JSON 存储并发（README 已承认单实例限制） | 老师端是**读多写少**（读快照、写绑定/推荐），JSON store 压力增量小；P1 前落 SQLite 时三张新表一并迁移（表结构即 schema） |
| 老师误绑/恶意绑定 | 双向确认 + 随时可解绑 + 老师端只读白名单数据，最坏泄露面 = 聚合掌握度 |
| 快照聚合在大班额（50+ 人）下变慢 | 单 space 聚合 O(kp 数)，50 学生 × 30 kp ≈ 1500 行内存聚合，毫秒级；不够再加缓存层 |
| role 字段与旧 token 不兼容 | 无状态 token 只含 user_id，role 每次从库读——旧 token 天然兼容，无需重登录 |
