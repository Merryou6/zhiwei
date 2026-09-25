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
 * 交互与纪律完全保留（本次只改版式，未动任何行为）：
 *   · 一屏一件事：一次只做登录或注册；
 *   · 错误一律走非阻断 toast（不弹窗），并附带字段级行内提示；
 *   · 演示账号一键进入：登录失败（该服务上还没建过）则自动注册；
 *   · 刷新不掉线：登录成功先落会话、再取空间、后导航。
 *
 * ── 重构 P3（2026-09-25 · 归队）──────────────────────────────────
 * 本页此前是全站**唯一未迁移的孤岛**：自己手写 fieldClass / fieldTone 两段样式字符串，
 * 行内错误色硬编码 hex，三处按钮各写各的，完全不用 ui/ 原语。后果不是「难看」，
 * 而是**同一件事在这里有第二套真相** —— 改全站输入框的聚焦表达时，这一页不会跟着变；
 * 而它恰好是 Demo 的开场镜头，也是最不该漂移的一页。
 *
 * 本次归队不含版式改动（上一轮版式批五的四条纪律全部保留），只做三件事：
 *   ① 控件走 FormField + Input tone="onDark"：标签关联、错误态、ARIA 关联、
 *      触控高度一次定死，本页不再维护任何控件样式；
 *   ② 行内错误色改 text-danger 令牌（深色下与硬编码的 #FFB088 逐位相同）；
 *   ③ 三处按钮走 Button 原语（primary / link），去掉三串手写样式 ——
 *      并借 size="lg" 的 44px 最小高度把主按钮压到触控目标下限上。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces, login, register } from '../api/endpoints';
import type { AuthData } from '../api/types';
import ParticleLogo from '../components/ParticleLogo';
import { Button, FormField, Input } from '../components/ui';
import { UI_TEXT } from '../lib/phrases';
import { SELF_REPORT_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { pickDefaultSpace, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

type Tab = 'login' | 'register';

/** 演示账号（与后端无耦合：本机/演示环境首次使用会自动创建）。 */
const DEMO_IDENTIFIER = 'demo_student';
const DEMO_PASSWORD = 'demo123456';

interface FieldErrors {
  identifier?: string;
  password?: string;
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const toast = useUiStore((state) => state.toast);

  /** 本地校验（行内提示用；服务端仍是最终裁判）。 */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (identifier.trim().length === 0) errors.identifier = '先填手机号或邮箱，我才能记住你';
    if (password.length === 0) errors.password = '密码还没填';
    else if (password.length < 6) errors.password = '密码至少 6 位';
    return errors;
  }

  /** 登录/注册成功后的公共收尾：落会话 → 取空间（失败不阻断）→ 导航。 */
  async function finishAuth(data: AuthData, isRegister: boolean): Promise<void> {
    setSession(data);

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
      navigate(SELF_REPORT_PATH, { replace: true });
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
          ? await register({ identifier: identifier.trim(), password, nickname: nickname.trim() || null })
          : await login({ identifier: identifier.trim(), password });

      await finishAuth(data, tab === 'register');
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  /** 演示账号一键进入：登录失败（多半是这台服务上还没建过）则自动注册一个。 */
  async function handleDemoEnter(): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setIdentifier(DEMO_IDENTIFIER);
    setPassword(DEMO_PASSWORD);

    try {
      let data: AuthData;
      let created = false;
      try {
        data = await login({ identifier: DEMO_IDENTIFIER, password: DEMO_PASSWORD });
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        data = await register({
          identifier: DEMO_IDENTIFIER,
          password: DEMO_PASSWORD,
          nickname: '演示同学',
        });
        created = true;
      }
      if (created) toast('已为这次演示创建示例账号');
      await finishAuth(data, created);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── 控件样式：已交给 ui/ 原语（2026-09-25 重构 P3）─────────────────
     收敛前这里有 fieldClass / fieldTone 两段手写字符串，是本页作为「未迁移孤岛」的
     最后两处痕迹；行内错误色还硬编码着 hex。

     现在走 `FormField + Input tone="onDark"`：
       · 表面与占位符的取值依据完整保留在 Input.tsx 的文件头（placeholder 用
         dusk-muted 落在 dusk-surface 上 4.79:1 过 AA；落在更亮的 raised 上只有
         4.13:1，所以输入框一律用 surface 档，不「再亮一层」）。
       · 边框策略：原版默认透明、聚焦才出现主色边；原语改为一律带 dusk-line 细边。
         这是有意的 —— 无边框输入框只在「用户已经知道这里是个框」时成立，
         对新用户而言少了一层可发现的边界。
       · 行内错误色改走 text-danger 令牌：深色下 = #FFB088，与原硬编码逐位相同；
         浅色下会自动换成 #C96A3A —— 硬编码做不到这件事。
     ⚠ 本页此后不再维护任何色值。 */

  return (
    <section className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-dusk-base px-6 py-10 text-dusk-body">
      {/* 背景氛围：单一品牌色相的极淡径向光，模拟夜里桌面上的一盏光。
          刻意只用一个色相——多色光晕是生成式页面的固定配色，也会让登录页冒出
          内页没有的第二套强调色。 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 [background-image:radial-gradient(122%_86%_at_50%_-12%,rgba(78,143,176,0.26),transparent_64%)]" />
      </div>

      {/* 粒子开场：全页唯一一处「被编排过的动效」，也是这一屏的主角。
          尺寸用 min(px, vw, vh) 三向夹取——只按宽度定尺寸的话，笔记本那种
          宽而矮的视口会把表单挤到折线以下，「一屏一件事」就断了。
          vh 这一项让标识随视口高度让位，屏矮时自动收小。 */}
      <ParticleLogo className="w-[min(264px,56vw,27vh)]" repulseRadius={88} />

      {/* 品牌字与一句话定位。标题的力度全部来自字号、字重与中文特有的宽字距，
          不用渐变填充——强调应当由字体本身承担。 */}
      <h1 className="mt-4 pl-[0.3em] text-display font-medium tracking-[0.3em] text-dusk-title sm:text-display-lg">
        知微
      </h1>
      <p className="mt-3 text-center text-ui-sm leading-relaxed text-dusk-muted">
        先弄清你卡在哪个知识点，再陪你把它补上
      </p>

      {/* 表单：没有外壳、没有分隔线、没有嵌套面板。
          字段标签交给 placeholder 承担（读屏器靠 sr-only label 仍能拿到），
          省掉两行可见文字——这是把 13 个元素压到 7 个的关键一步。 */}
      <form onSubmit={handleSubmit} noValidate className="mt-8 w-full max-w-[360px]">
        {/* 字段标签交给 placeholder 承担（读屏器靠 FormField 的 labelHidden 仍拿得到
            关联的 label），省掉两行可见文字 —— 这是把 13 个元素压到 7 个的关键一步。
            字段间距由 FormField 的外层 className 给；错误态与 ARIA 关联由 error
            一个入参同时决定（见 Input.tsx 的 FormField 说明）。 */}
        <FormField label="手机号或邮箱" labelHidden className="mt-3" error={fieldErrors.identifier}>
          <Input
            tone="onDark"
            fieldSize="lg"
            placeholder="手机号或邮箱"
            value={identifier}
            autoComplete="username"
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
          />
        </FormField>

        <FormField label="密码" labelHidden className="mt-3" error={fieldErrors.password}>
          <Input
            tone="onDark"
            fieldSize="lg"
            placeholder={tab === 'register' ? '设个密码，至少 6 位' : '密码'}
            type="password"
            value={password}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
          />
        </FormField>

        {tab === 'register' ? (
          <FormField label="称呼（可选）" labelHidden className="mt-3">
            <Input
              tone="onDark"
              fieldSize="lg"
              placeholder="怎么称呼你（可留空）"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </FormField>
        ) : null}

        {/* 主按钮：单色实底。深色下 bg-accent = #6FB3D4、text-on-accent = #070C14，
            与原来手写的 primary-lift + dusk-base 逐位同色，所以这次迁移本身不改观感。
            按下时压暗给出物理反馈；不用渐变填充 + 零偏移彩色外发光 —— 那层光晕
            不表示任何层级关系。
            size="lg" 的最小高度是 44px，正好压在触控目标下限上（Accessible & Ethical 的
            44×44 要求），这也是不再写死 min-h-12 的理由：档位化的值可被统一校验。 */}
        <Button type="submit" variant="primary" size="lg" full loading={submitting} className="mt-4">
          {submitting ? '正在处理…' : tab === 'login' ? '进去看看' : '注册并开始'}
        </Button>

        {/* 通道切换：退成一行纯文字，不再做成占一整个横条的分段控件 ——
            分段控件是「设置项」的语汇，这里只是换个入口。
            py-2：文字形态的按钮没有盒模型，默认的可点高度会低于 44px 下限，
            这里补回纵向内边距把它抬上去 —— 密度只压信息容器，不压交互目标。 */}
        <p className="mt-4 text-center text-ui-sm text-dusk-muted">
          {tab === 'login' ? '第一次来？' : '已经有账号了？'}
          <Button
            variant="link"
            onClick={() => {
              setTab(tab === 'login' ? 'register' : 'login');
              setFieldErrors({});
            }}
            className="ml-1.5 py-2"
          >
            {tab === 'login' ? '30 秒注册一个' : '去登录'}
          </Button>
        </p>
      </form>

      {/* 演示入口：压在页面最下方的一行低调文字。
          上一版把它做成了一个带边框的区域（说明段 + 账号 chip + 次级按钮 + 备注），
          体量与主表单相当，主次就反了。 */}
      <div className="mt-7 text-center">
        <Button
          variant="link"
          loading={submitting}
          onClick={handleDemoEnter}
          className="py-2 text-ui-sm text-dusk-muted hover:text-primary-lift"
        >
          只想先看看效果？用演示账号直接进入
        </Button>
        {/* 等宽 + 表格数字：字符数一眼可数，抄的时候不容易错 */}
        <p className="mt-1.5 font-mono text-caption tabular-nums text-dusk-muted">
          {DEMO_IDENTIFIER} · {DEMO_PASSWORD}
        </p>
      </div>
    </section>
  );
}
