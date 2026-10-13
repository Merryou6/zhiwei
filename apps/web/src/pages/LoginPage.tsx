/**
 * 页 1 · 登录 / 注册（PRD §5 #1「一件事：进得来」；P0 #1）
 *
 * 契约：#1 POST /api/auth/register（注册成功服务端自动建默认空间）
 *       #2 POST /api/auth/login
 *       #3 GET /api/space/list（登录后取空间，落 activeSpace，刷新不掉线）
 *
 * ── 视觉批五（2026-09-22 · 版式重做）──────────────────────────────
 * 用户反馈「界面还是这个界面」。核对后确认：深色主题确实已生效，
 * 问题出在**只换了配色、没动版式** —— 结构仍是「logo 在上 + 一张带边框的居中卡片」，
 * 那是任何后台系统的登录页写法，不是 AI 产品开场。
 *
 * 对照 DeepSeek 官网这类开场，差别不在颜色，在四条版式纪律：
 *   1. **没有卡片**。表单直接浮在画面上，元素靠间距与层级组织，不靠外框圈起来。
 *      一条 border + 一层 shadow 就会把「开阔」立刻收窄成「表单框」。
 *   2. **标识是主角**。粒子标识从 168/204px 放大到 216/272px，让它真的占住视野中心。
 *   3. **元素极少**。旧版一屏挤了 13 个元素（分段控件 / 两个卡片内标签 / 分隔线 /
 *      账号密码 chip / 次级按钮 / 两段说明小字）。现在压到 7 个：
 *      标识、标题、一句话、两个输入、主按钮、切换行、演示入口。
 *      字段标签改为占位符承担（保留 sr-only label 供读屏器），省掉两行可见文字。
 *   4. **留白与字号对比拉开**。标题 38/44px，正文 13px，两者差 3 倍以上；
 *      标识与表单之间留 40px 空档，而不是贴着。
 *
 * ── 重构 P3（2026-09-25 · 归队）──────────────────────────────────
 * 本页此前是全站**唯一未迁移的孤岛**：自己手写 fieldClass / fieldTone 两段样式字符串，
 * 行内错误色硬编码 hex，三处按钮各写各的，完全不用 ui/ 原语。本次归队改为
 * FormField + Input tone="onDark"、行内错误色走 text-danger 令牌、三处按钮走 Button 原语。
 *
 * ── 双端开场（2026-10-09）────────────────────────────────────────
 * v1.6 落了双端（role 决定去向），但身份选择只在**注册**时出现——登录时整个
 * 页面是学生视角。本次把身份提为**常驻**，且放表单首位：进门先说我是谁，再填账号。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.4（2026-10-11 第 4 轮）：视觉层按原型 PAGES.login
 * （tempui/prototypes/style-10/index.html L1912-1974）逐段复现，**业务逻辑一行不改**
 * （tab/role/identifier/password/nickname/submitting/fieldErrors 七个状态位、validate、
 * finishAuth 的落会话→取空间→按角色导航、handleSubmit 的三道分支与温和纠正 toast、
 * handleDemoEnter 的「先登录后自动注册」、两条 navigate 目标与 replace 语义、全部
 * 既有文案常量）：
 *   ① 页头 SheetHead（L1951）：eyebrow「AUTH / 最小摩擦入口」+ SHEET 10-02 +
 *      需求 2.2 + 标题随 tab 切换「登录知微 / 注册知微」+ chip「T1」；页头归页面自有
 *      （D24：Layout 的 PAGE_OWNED_HEAD 登记 '/login'）。
 *   ② 左栏（原型 `.split` 的 1fr 列）：登录/注册分段（`.bp-seg` + 真 radio，即原型
 *      `div.seg[role=tablist]` 的两个选项）+ 表单（期望身份分段 = 原型 roleSeg →
 *      既有「我是学生 / 我是老师」两项与说明；字段 = 手机号或邮箱 / 密码 /（注册时）
 *      昵称，走 FormField + Input 原语，标签可见 + 必填星 + 提示行；提交行 = 主键 +
 *      「先看看门户图」次键 + 提交反馈行）。
 *   ③ 右栏（原型 `aside.panel.flat` = `.split` 的 220px 列）：02 演示账号 ——
 *      两张演示卡（学生端 / 教师端 chip + 一键进入 + 账号/密码 kv）+ 注册后冷启动说明。
 *
 * 【外壳形态的变化（P10.4 计划外改动 D-P10.4-1；2026-10-13 用户验收修订推翻）】
 * P10.4 曾按原型 PAGES.login 把登录页画进外壳（sheetHead + 左右分栏 + 左栏分层索
 * 引可见），App.tsx 的 `bare` 由 true 改 false。用户验收否决了这一形态：未登录态下
 * 外壳的整列导航全部被守卫弹回 /login，「看得见、点不动」。2026-10-13 恢复独立全屏
 * 渲染（App.tsx `/login` 重走 `Guarded bare`），页面自带品牌顶栏与「返回门户」出
 * 口；表单、演示账号与全部交互逻辑（finishAuth 落会话→取空间→按角色导航、演示账
 * 号一键进入、温和纠正 toast）一字未动。
 * 随之退场的是旧开场的三件动效资产（ParticleLogo 粒子标识 / aurora 氛围斑 / 表单入场
 * 揭示与磁性 CTA）—— 它们只服务于「全屏开场」这一种形态，原型 login 页里没有；
 * ParticleLogo 仍在门户 /（P11.1）与 ZhiweiLogo 里使用，未被删除。
 *
 * 【四态】表单不整页四态（规范 §7 login 行）：错误落在**字段级**（FormField 的 error
 * 行 = 规范 5.3 的 `.hint.bad` 位，role="alert" 即时念出），另有既有非阻断 toast 兜底。
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces, login, register } from '../api/endpoints';
import type { AuthData } from '../api/types';
import { Icon } from '../components/blueprint/icons';
import { useBlueprintTier } from '../components/blueprint/Board';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import ZhiweiLogo from '../components/ZhiweiLogo';
import { Badge, Button, FormField, Input } from '../components/ui';
import { buttonVariants } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH, START_PATH, TEACHER_HOME } from '../router';
import { useAuthStore } from '../stores/auth';
import { pickDefaultSpace, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

type Tab = 'login' | 'register';

/** 演示账号（与后端无耦合：本机/演示环境首次使用会自动创建；双端开场后各一个）。 */
const DEMO_PASSWORD = 'demo123456';
const DEMO_ACCOUNTS = {
  student: { identifier: 'demo_student', nickname: '演示同学', role: 'student' },
  teacher: { identifier: 'demo_teacher', nickname: '演示老师', role: 'teacher' },
} as const;

/** 图号与需求号（原型 sheetHead L1951 的 SHEET 10-02 / 需求 2.2）。 */
const SHEET_NO = '10-02';
const SECTION_NO = '2.2';

/** 演示账号提示行（原型 f('account', …) 的 hint 位；此处给本工程真实账号，不照抄 mock）。 */
const DEMO_HINT = `演示账号：${DEMO_ACCOUNTS.student.identifier} · ${DEMO_ACCOUNTS.teacher.identifier}（密码 ${DEMO_PASSWORD}）`;

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  /** v1.6 双端 + 2026-10-09 双端开场：身份常驻（注册 = 提交的 role；登录 = 身份期望）。 */
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const navigate = useNavigate();
  const tier = useBlueprintTier();
  const setSession = useAuthStore((state) => state.setSession);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const toast = useUiStore((state) => state.toast);

  /** 本地校验（行内提示用；服务端仍是最终裁判）。
      【P3 人设随身份】学生端文案是学长口吻，老师身份下改中性，不让老师被「记住你」。 */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (identifier.trim().length === 0) {
      errors.identifier = role === 'teacher' ? '先填手机号或邮箱' : '先填手机号或邮箱，我才能记住你';
    }
    if (password.length === 0) errors.password = '密码还没填';
    else if (password.length < 6) errors.password = '密码至少 6 位';
    return errors;
  }

  /** 登录/注册成功后的公共收尾：落会话 → 取空间（失败不阻断）→ 按角色导航。 */
  async function finishAuth(data: AuthData, isRegister: boolean): Promise<void> {
    setSession(data);

    // v1.6 双端：老师不进学习链路（无自报/测评），登录后直送老师工作台
    if (data.role === 'teacher') {
      navigate(TEACHER_HOME, { replace: true });
      return;
    }

    // 取空间列表：注册后服务端已自动建默认空间；此处落 activeSpace（刷新不掉线）
    let defaultName = '初中数学';
    try {
      const { spaces } = await listSpaces();
      setSpaces(spaces);
      defaultName = pickDefaultSpace(spaces)?.name ?? defaultName;
    } catch {
      /* 空间取不到不阻断登录：页 3 会重试 */
    }

    if (isRegister) {
      toast(`已为你建好「${defaultName}」学习空间`);
      // v2.1 冷启动分叉：注册后先选「拍试卷 / 做摸底题」，不再强制先做题
      navigate(START_PATH, { replace: true });
    } else {
      navigate(SPACES_PATH, { replace: true });
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    const firstError = errors.identifier ?? errors.password;
    if (firstError) {
      // 保留原有非阻断 toast：行内提示更精确，toast 保证不遗漏
      toast(firstError, 'warn');
      return;
    }

    setSubmitting(true);
    try {
      const data =
        tab === 'register'
          ? await register({
              identifier: identifier.trim(),
              password,
              nickname: nickname.trim() || null,
              role,
            })
          : await login({ identifier: identifier.trim(), password });

      // 双端开场：服务端 role 是唯一真相（导航按它走）；若与所选身份不符，温和纠正不打断
      if (tab === 'login' && role !== data.role) {
        toast(
          data.role === 'teacher'
            ? '这个账号是老师身份——已按老师端进入'
            : '这个账号是学生身份——已按学生端进入',
          'info',
        );
      }

      await finishAuth(data, tab === 'register');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  /** 演示账号一键进入：登录失败（多半是这台服务上还没建过）则按对应身份自动注册一个。 */
  async function handleDemoEnter(demoRole: keyof typeof DEMO_ACCOUNTS): Promise<void> {
    if (submitting) return;
    const demo = DEMO_ACCOUNTS[demoRole];
    // 【P3 演示进入同步身份】一句话定位立即切到对应身份，不能还停在「我是学生」
    setRole(demoRole);
    setSubmitting(true);
    setFieldErrors({});
    setIdentifier(demo.identifier);
    setPassword(DEMO_PASSWORD);

    try {
      let data: AuthData;
      let created = false;
      try {
        data = await login({ identifier: demo.identifier, password: DEMO_PASSWORD });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        data = await register({
          identifier: demo.identifier,
          password: DEMO_PASSWORD,
          nickname: demo.nickname,
          role: demo.role,
        });
        created = true;
      }
      if (created) toast(`已为这次演示创建${demoRole === 'teacher' ? '老师' : '学生'}示例账号`);
      await finishAuth(data, created);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  /** 通道切换（原型 `.seg` 的两个选项）：与迁移前的文字切换**同一套状态变更**（换 tab +
   *  清字段错误），只是控件从「一行文字按钮」变成分段选择制式。 */
  function switchTab(next: Tab): void {
    setTab(next);
    setFieldErrors({});
  }

  /** 页头（原型 sheetHead L1951）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。
   *  title 随 tab 切换（原型同一行的三元：`tab === 'register' ? '注册知微' : '登录知微'`）。 */
  const pageHead = (
    <SheetHead
      eyebrow="AUTH / 最小摩擦入口"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title={tab === 'register' ? '注册知微' : '登录知微'}
      sub="两种身份共用一张图：注册时决定账号角色，登录时表达期望身份。"
      chips={<Badge>T1</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  /** 身份两项（原型 roleSeg 的 [['student','学生',…],['teacher','教师',…]]；本工程沿用
   *  既有的措辞「我是学生 / 我是老师」与两条定位说明）。 */
  const ROLE_OPTIONS = [
    { value: 'student', label: '我是学生', hint: '完整学习链路' },
    { value: 'teacher', label: '我是老师', hint: '带学生看学情' },
  ] as const;

  return (
    // 【2026-10-13 用户验收修订】独立全屏登录页（App.tsx 恢复 bare）：自带品牌顶栏与
    // 「返回门户」出口——未登录态不再呈现应用外壳（外壳整列导航会被守卫弹回，观感
    // 「卡着不让去其他页面」）。表单、演示账号、全部交互逻辑一字未动。
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 annos:px-6">
          <div className="flex items-center gap-2 font-disp text-reading font-semibold">
            <ZhiweiLogo size={24} />
            知微 · ZhiWei
          </div>
          <Link to="/" className={cn(buttonVariants({ variant: 'quiet', size: 'md' }))}>
            返回门户
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 annos:px-6 annos:py-20">
      {pageHead}

      {/* 原型 `<section class="block">` 无分节号（左侧表单列直接落进 .split 的 1fr，
          右侧 aside 自带分节号 02）—— 故这里用无编号的 section 容器，不写 01。 */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_220px]">
          {/* ── 左栏：登录 / 注册（原型 .split 的 1fr 列）──────────────────── */}
          <div className="min-w-0">
            {/* 通道切换：分段选择制式（原型 div.seg[role=tablist] 的两个 radio 选项）。
                ⚠ 原型把它标成 role="tablist" 而控件是 radio —— 这里按控件如实标
                role="radiogroup"（与本轮 /self-report /paper 的分段同一条口径：
                真控件 + 真语义，不自绘、不重造键盘行为）。 */}
            <div className="bp-seg mb-4" role="radiogroup" aria-label="登录或注册">
              {(
                [
                  { value: 'login', label: '登录' },
                  { value: 'register', label: '注册' },
                ] as const
              ).map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="auth-tab"
                    value={option.value}
                    checked={tab === option.value}
                    onChange={() => switchTab(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* 期望身份（原型 roleSeg）：真 radio 的 `.bp-seg`，选中态与焦点环由
                  :has() 表达；说明行取原型 MOCK.auth.identityNote 的正文 + anno① 的
                  「不符不拦人」口径（本工程 handleSubmit 里本来就是这个行为）。 */}
              <div className="bp-seg" role="radiogroup" aria-label="期望身份">
                {ROLE_OPTIONS.map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="auth-role"
                      value={option.value}
                      checked={role === option.value}
                      onChange={() => setRole(option.value)}
                    />
                    <Icon
                      name={role === option.value ? 'tick' : 'user'}
                      className="h-4 w-4 shrink-0"
                    />
                    <span>
                      <span className="font-medium">{option.label}</span>
                      <span className="tok block">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="bp-note">
                注册时决定账号角色；登录时选择的身份只是期望，与实际不符会按实际身份进入并温和说明，不拦人。
              </p>

              {/* 字段：FormField 负责标签关联 / 必填 / 错误态与 ARIA（规范 5.3），
                  错误落点是字段级（四态不整页）。placeholder 仍保留，方便快速辨认。 */}
              <FormField
                label="手机号或邮箱 / ACCOUNT"
                required
                hint={DEMO_HINT}
                error={fieldErrors.identifier}
                className="mt-4"
              >
                <Input
                  fieldSize="lg"
                  placeholder="手机号或邮箱"
                  value={identifier}
                  autoComplete="username"
                  onChange={(event) => {
                    setIdentifier(event.target.value);
                    if (fieldErrors.identifier) {
                      setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                    }
                  }}
                />
              </FormField>

              <FormField
                label="密码 / PASSWORD"
                required
                hint="至少 6 位"
                error={fieldErrors.password}
                className="mt-4"
              >
                <Input
                  fieldSize="lg"
                  placeholder={tab === 'register' ? '设个密码，至少 6 位' : '密码'}
                  type="password"
                  value={password}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                />
              </FormField>

              {tab === 'register' ? (
                <FormField label="昵称 / NICKNAME" hint="可以留空" className="mt-4">
                  <Input
                    fieldSize="lg"
                    placeholder="怎么称呼你（可留空）"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                  />
                </FormField>
              ) : null}

              {/* 提交行（原型 `.row`：主键 + 门户次键 + 反馈行）。按钮文案沿用既有
                  「进去看看 / 注册并开始」与 loading 文案「正在处理…」（这批只在原型
                  明确要求处换文案，其余保持既有说法，见执行报告 D-P10.4-3）。 */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" size="lg" loading={submitting}>
                  <Icon name="key" />
                  {submitting ? '正在处理…' : tab === 'login' ? '进去看看' : '注册并开始'}
                </Button>
                {/* 门户次键（原型 `a.btn.text` → #/portal）：本工程门户就是 '/'（P11.1
                    迁移对象），故指到真实存在的路由，不造 /portal 这个不存在的路径。 */}
                <Button variant="secondary" onClick={() => navigate('/')}>
                  <Icon name="arrow" />
                  先看看门户图
                </Button>
              </div>
              <p className="tok mt-3" aria-live="polite">
                提交中有进行中反馈；失败不会白屏。
              </p>
            </form>
          </div>

          {/* ── 右栏：演示账号（原型 aside.panel.flat + blockTitle('02','演示账号')）── */}
          <aside className="bp-panel p-3">
            <SheetBlock no="02" title="演示账号" className="mb-0">
              <div className="flex flex-col gap-3">
                {(
                  [
                    { demoRole: 'student', tone: 'accent' as const, label: '学生端' },
                    { demoRole: 'teacher', tone: 'warning' as const, label: '教师端' },
                  ] as const
                ).map((item) => {
                  const account = DEMO_ACCOUNTS[item.demoRole];
                  return (
                    <div key={item.demoRole} className="bp-panel p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <Badge tone={item.tone}>
                          {item.label} {account.nickname}
                        </Badge>
                        {/* ⚠ 档位说明（偏差留痕 D-P10.4-4）：原型这里用 `.btn.sm`，本工程改用
                            **默认 md 档**——Button 的 sm 档带 `text-tok`，而 cn.ts 的字号
                            登记表里没有 tok（只有 caption/ui-sm/reading/display/display-lg），
                            tailwind-merge 会把 `text-tok` 当成颜色类，吃掉 primary 的
                            `text-on-accent`，实测得到「蓝底 + 深蓝字」（rgb(18,57,90) on
                            rgb(26,95,180) ≈ 2.3:1，不到 AA）。md 档带 `text-ui-sm`（已登记）
                            不受影响，顺带把触控目标抬到 44px。根因属组件库层，见执行报告。 */}
                        <Button
                          loading={submitting}
                          onClick={() => void handleDemoEnter(item.demoRole)}
                        >
                          <Icon name="arrow" />
                          一键进入
                        </Button>
                      </div>
                      <dl className="mt-2">
                        <div className="bp-kv">
                          <dt>账号</dt>
                          <dd className="num-mono">{account.identifier}</dd>
                        </div>
                        <div className="bp-kv">
                          <dt>密码</dt>
                          <dd className="num-mono">{DEMO_PASSWORD}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
              <p className="tok mt-3">
                注册成功后自动创建默认空间，并经过一次冷启动引导
              </p>
            </SheetBlock>
          </aside>
        </div>
      </section>
      </main>
    </div>
  );
}
