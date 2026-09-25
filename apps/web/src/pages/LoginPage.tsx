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
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces, login, register } from '../api/endpoints';
import type { AuthData } from '../api/types';
import ParticleLogo from '../components/ParticleLogo';
import { UI_TEXT } from '../lib/phrases';
import { SELF_REPORT_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { pickDefaultSpace, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

type Tab = 'login' | 'register';

/** 演示账号（与后端无耦合：本机/演示环境首次使用会自动创建）。 */
const DEMO_IDENTIFIER = 'demo_student';
const DEMO_PASSWORD = 'demo123456';

/** 行内错误文字色。深底上 #FFB088 实测 11.0:1；tone-error(#C96A3A) 在深底上会偏暗。 */
const ERROR_TEXT = 'text-[#FFB088]';

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

  /* ── 控件样式 ─────────────────────────────────────────────────────
     版式批五：表单不再有外壳，输入框必须自己立住，所以给它们一块实心底
     （dusk-surface #111A26，比页面底 #070C14 亮一档 ≈1.12:1，边界可感知）。

     表面选择有依据，不是随手取：
       placeholder 用 dusk-muted(#7A8798) 落在 surface 上是 **4.79:1**，过 AA；
       落在更亮的 raised(#18222F) 上只有 4.13:1，不到 AA。
     所以输入框一律用 surface 档，不要"再亮一层"。

     边框策略：默认无边框（靠底色分层），聚焦时才出现主色边 + 柔 ring。
     深色下「无边框 + 实心底」比「有边框 + 透明底」更干净，也更接近我们要的开场感。 */
  const fieldClass = [
    'mt-3 block min-h-12 w-full rounded-control border bg-dusk-surface px-4 py-3',
    'text-reading text-dusk-title placeholder:text-dusk-muted',
    'transition-colors duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lift/45',
  ].join(' ');
  const fieldTone = (invalid: boolean): string =>
    invalid ? 'border-[#FFB088]/70' : 'border-transparent focus:border-primary-lift';

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
        <label className="block">
          <span className="sr-only">手机号或邮箱</span>
          <input
            className={`${fieldClass} ${fieldTone(Boolean(fieldErrors.identifier))}`}
            placeholder="手机号或邮箱"
            value={identifier}
            autoComplete="username"
            aria-invalid={fieldErrors.identifier ? true : undefined}
            aria-describedby={fieldErrors.identifier ? 'field-error-identifier' : undefined}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
          />
        </label>
        {fieldErrors.identifier ? (
          <p id="field-error-identifier" className={`mt-2 text-ui-sm ${ERROR_TEXT}`}>
            {fieldErrors.identifier}
          </p>
        ) : null}

        <label className="block">
          <span className="sr-only">密码</span>
          <input
            className={`${fieldClass} ${fieldTone(Boolean(fieldErrors.password))}`}
            placeholder={tab === 'register' ? '设个密码，至少 6 位' : '密码'}
            type="password"
            value={password}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'field-error-password' : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
          />
        </label>
        {fieldErrors.password ? (
          <p id="field-error-password" className={`mt-2 text-ui-sm ${ERROR_TEXT}`}>
            {fieldErrors.password}
          </p>
        ) : null}

        {tab === 'register' ? (
          <label className="block">
            <span className="sr-only">称呼（可选）</span>
            <input
              className={`${fieldClass} border-transparent`}
              placeholder="怎么称呼你（可留空）"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
        ) : null}

        {/* 主按钮：单色实底。按下时下沉 1px 并压暗，给出物理反馈；
            不用渐变填充 + 零偏移彩色外发光（那层光晕不表示任何层级关系）。 */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 min-h-12 w-full rounded-control bg-primary-lift px-4 py-3 text-reading font-medium text-dusk-base transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:translate-y-px active:brightness-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
        >
          {submitting ? '正在处理…' : tab === 'login' ? '进去看看' : '注册并开始'}
        </button>

        {/* 通道切换：退成一行纯文字，不再做成占一整个横条的分段控件——
            分段控件是「设置项」的语汇，这里只是换个入口。 */}
        <p className="mt-4 text-center text-ui-sm text-dusk-muted">
          {tab === 'login' ? '第一次来？' : '已经有账号了？'}
          <button
            type="button"
            onClick={() => {
              setTab(tab === 'login' ? 'register' : 'login');
              setFieldErrors({});
            }}
            className="ml-1.5 rounded-[4px] text-primary-lift underline-offset-[0.25em] hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {tab === 'login' ? '30 秒注册一个' : '去登录'}
          </button>
        </p>
      </form>

      {/* 演示入口：压在页面最下方的一行低调文字。
          上一版把它做成了一个带边框的区域（说明段 + 账号 chip + 次级按钮 + 备注），
          体量与主表单相当，主次就反了。 */}
      <div className="mt-7 text-center">
        <button
          type="button"
          onClick={handleDemoEnter}
          disabled={submitting}
          className="rounded-[4px] text-ui-sm text-dusk-muted underline-offset-[0.25em] transition-colors duration-150 ease-out hover:text-primary-lift hover:underline disabled:cursor-not-allowed disabled:opacity-55"
        >
          只想先看看效果？用演示账号直接进入
        </button>
        {/* 等宽 + 表格数字：字符数一眼可数，抄的时候不容易错 */}
        <p className="mt-1.5 font-mono text-caption tabular-nums text-dusk-muted">
          {DEMO_IDENTIFIER} · {DEMO_PASSWORD}
        </p>
      </div>
    </section>
  );
}
