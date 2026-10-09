/**
 * LandingPage · 公开入口门户（2026-10-09 awwwards 适配包 1：四章滚动叙事）
 *
 * 【口径】（不变）不属于 PRD §5 的 11 页学习链路：router.ROUTES、守卫、顶栏导航
 * 零改动。App.tsx 以 bare 方式渲染（不套 Layout / TopNav），未登录可直达。
 * 「立即体验」落点 navigate(LOGIN_PATH)：未登录 → 登录页；已登录 → 守卫原样送进
 * #/spaces。同一条路径自动处理两种会话状态。
 *
 * 【本轮改了什么】从「企业门户式分区」改为四章滚动叙事：
 *   ① 问题（hero 全屏，kinetic 逐字标题）→ ② 方法（五步闭环）→
 *   ③ 证据（ΔAccuracy + 数据资产）→ ④ 开始（双端 CTA）。
 * 参考 awwwards 2026 获奖趋势的三条原则，且每条都做了本地化取舍：
 *   · editorial art direction —— 章节眉标 + 超大 display 标题，让版式与留白说话，
 *     不堆装饰；标题字号在既有 display 令牌基础上放到 clamp 级（2.5rem→5rem）。
 *   · directed motion —— kinetic 逐字入场与滚动揭示都指向阅读动线；错峰只在
 *     一屏之内（≤0.3s 级），不做长程编排。
 *   · restraint（克制）—— **刻意不做 scroll-jacking**：不劫持滚动、不做分页
 *     吸附、不设 sticky 章节轨，全部保持自然滚动。学习产品的人设是「学长」，
 *     不施压、不说教——滚动体验也应当让用户掌舵，分章感只靠 min-h 段落与
 *     留白表达。这是本包最关键的产品决策，故写明。
 *
 * 【主题】全部颜色走语义令牌（canvas/surface/line/ink/ink-soft/accent-ink…），
 * 深浅两套主题同时成立。玻璃面（.glass-card）与全局噪点（body::after）由
 * index.css 提供，只做「面」；文字一律用既有 text-* 令牌，对比度不受影响。
 *
 * 【数字口径】STATS 以仓库 README 现状为准（知识图谱 36 节点 = 初中 24 + 高中 12、
 * 149 典型错误、404 校准题、41 个测试文件 432 用例全绿），不随手改。
 */

import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import ParticleLogo from '../components/ParticleLogo';
import { Button } from '../components/ui';
import { buttonVariants } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { LOGIN_PATH } from '../router';
import { useReveal } from '../lib/useReveal';

const GITHUB_URL = 'https://github.com/Merryou6/zhiwei';

/** 五步闭环（与 README §二同口径，仅文案压缩到短语）。 */
const LOOP_STEPS: ReadonlyArray<{ title: string; sub: string }> = [
  { title: '采集证据', sub: '自报先验 · 测评 · 试卷 · 对话' },
  { title: '诊断掌握度', sub: 'BKT 建模 · 四档状态带' },
  { title: '定位根因', sub: '图谱回溯先修链' },
  { title: '生成处方', sub: '学长式引导 · 一步一小步' },
  { title: '新题验证', sub: '零重叠复测 · ΔAccuracy' },
];

/** 实物数字（以仓库 README 现状为准，勿随手改）。 */
const STATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '36', label: '知识节点（初中 24 + 高中 12）' },
  { value: '149', label: '典型错误' },
  { value: '404', label: '校准题目' },
  { value: '41', label: '测试文件' },
  { value: '432', label: '自动化用例全绿' },
  { value: '20', label: 'REST / SSE 接口' },
];

/**
 * 「为什么可信」三条证据卡（原四大亮点的其余三条；第四条「效果用硬指标说话」
 * 升格为本章的 ΔAccuracy 叙事主句，不再重复罗列）。
 */
const PROOFS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: '图谱归因，不是题库匹配',
    body: '每道错题归到具体的知识节点与错误类型，再沿先修链向上找松动点——不说「你不行」，说「卡在对称轴，上游配方法也松了」。',
  },
  {
    title: '掌握度是算出来的',
    body: '贝叶斯知识追踪（BKT）逐题更新掌握概率；引擎纯函数、零 IO，17 个教育学假设全部外置在参数文件里，可调参、可审计。',
  },
  {
    title: '对话有教育学纪律',
    body: '像耐心的学长：一次只给一小步提示，不抛答案。远程大模型一键接入，任何失败自动回落本地规则模型，永不白屏。',
  },
];

/** 章节眉标：editorial art direction 的最小单元——编号 + 一词定性。 */
function ChapterMark({ no, name }: { no: string; name: string }) {
  return (
    <p className="text-ui-sm font-medium tracking-widest text-accent-ink">
      {no} · {name}
    </p>
  );
}

/**
 * 章节揭示容器：进入视口一次性揭示（once），由 lib/useReveal 提供 inView。
 * delayMs 用于同屏多卡片的轻微错峰（directed motion：错峰只在一屏之内）。
 */
function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const { ref, inView } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn('reveal-section', inView && 'is-revealed', className)}
      style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * kinetic 逐字标题（基建在 index.css：kinetic-in / .kinetic-char）。
 * 逐字延迟由 inline animationDelay 编排；逐字 span 对读屏隐藏，
 * 完整句子走 aria-label——动效不破坏无障碍语义。
 */
function KineticTitle({ lines }: { lines: ReadonlyArray<string> }) {
  let charIndex = 0;
  return (
    <h1
      aria-label={lines.join('')}
      className="mt-4 text-[clamp(2.5rem,8vw,5rem)] font-bold leading-tight"
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} aria-hidden="true">
          {[...line].map((char, i) => {
            const delay = charIndex++ * 45;
            return (
              <span key={`${i}-${char}`} className="kinetic-char" style={{ animationDelay: `${delay}ms` }}>
                {char}
              </span>
            );
          })}
          {lineIndex < lines.length - 1 && <br />}
        </span>
      ))}
    </h1>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const enter = () => navigate(LOGIN_PATH);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* ---------------------------------- 顶栏（门户自己的，不进应用） */}
      <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 nav:px-6">
        <div className="flex items-center gap-2 text-reading font-semibold">
          <img src="./favicon.svg" alt="" className="h-6 w-6" />
          知微 · ZhiWei
        </div>
        <nav className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'quiet', size: 'md' }))}
          >
            GitHub
          </a>
          <Button size="sm" onClick={enter}>
            立即体验
          </Button>
        </nav>
      </header>

      {/* ---------------------------------- 章 1 · 问题（hero 全屏） */}
      {/* min-h 吃掉顶栏高度让首屏恰好满屏；不设 sticky、不劫持滚动。 */}
      <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col justify-center px-4 py-16 nav:px-6 nav:py-20">
        <div className="flex flex-col items-center gap-12 nav:flex-row nav:gap-16">
          <div className="flex-1 animate-rise">
            <p className="text-ui-sm font-medium tracking-widest text-accent-ink">
              粤港澳大湾区 AI Coding 创新赛 · 参赛作品
            </p>
            <KineticTitle lines={['每一分丢在哪里，', '都有名字。']} />
            <p className="mt-6 max-w-prose text-reading leading-relaxed text-ink-soft">
              知微把「这孩子二次函数不行」翻译成「卡在对称轴、属于概念类错误、上游配方法也松了」，
              再用一个不抛答案的 AI 学长陪他走回正轨——最后用三道没见过的新题，证明这条路真的走对了。
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button size="lg" className="px-8 text-reading shadow-overlay" onClick={enter}>
                立即体验
              </Button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }))}
              >
                查看源码
              </a>
            </div>
          </div>
          <div className="shrink-0">
            <ParticleLogo className="w-[min(300px,60vw)]" repulseRadius={88} />
          </div>
        </div>
      </section>

      {/* ---------------------------------- 章 2 · 方法（五步闭环，逐条一行） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 nav:px-6 nav:py-32">
        <Reveal>
          <ChapterMark no="02" name="方法" />
          <h2 className="mt-3 text-2xl font-bold leading-snug nav:text-3xl">
            五步教学法的产品化闭环
          </h2>
          <p className="mt-3 max-w-prose text-reading leading-relaxed text-ink-soft">
            自报先验 → 测评建图 → 归因 → 处方练习 → 复测回流：每一步都留下证据，每一步都被下一步使用。
          </p>
        </Reveal>
        <ol className="mt-10 space-y-3">
          {LOOP_STEPS.map((step, index) => (
            <li key={step.title}>
              <Reveal delayMs={index * 70}>
                <div className="glass-card flex items-baseline gap-5 rounded-surface px-5 py-4">
                  <span className="text-ui-sm font-semibold text-accent-ink">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-reading font-semibold">{step.title}</span>
                  <span className="text-ui-sm text-ink-soft nav:ml-auto">{step.sub}</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------- 章 3 · 证据（ΔAccuracy + 数据资产） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 nav:px-6 nav:py-32">
        <Reveal>
          <ChapterMark no="03" name="证据" />
          <h2 className="mt-3 text-2xl font-bold leading-snug nav:text-3xl">
            效果不靠感觉，靠 ΔAccuracy。
          </h2>
          <p className="mt-3 max-w-prose text-reading leading-relaxed text-ink-soft">
            干预后从与基线零重叠的新题池抽题复测，ΔAccuracy 达标才算补上——闭环由实测合上，不由感觉合上。
          </p>
        </Reveal>
        <dl className="mt-10 grid grid-cols-2 gap-4 nav:grid-cols-3">
          {STATS.map((stat, index) => (
            <div key={stat.label}>
              <Reveal delayMs={(index % 3) * 70}>
                <div className="glass-card h-full rounded-surface p-6 text-center">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="block text-display font-bold text-accent-ink">{stat.value}</span>
                    <span className="mt-2 block text-caption text-ink-soft">{stat.label}</span>
                  </dd>
                </div>
              </Reveal>
            </div>
          ))}
        </dl>
        <div className="mt-4 grid gap-4 nav:grid-cols-3">
          {PROOFS.map((proof, index) => (
            <div key={proof.title}>
              <Reveal delayMs={index * 70}>
                <article className="glass-card h-full rounded-surface p-6">
                  <h3 className="text-reading font-semibold">{proof.title}</h3>
                  <p className="mt-3 text-ui-sm leading-relaxed text-ink-soft">{proof.body}</p>
                </article>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------- 章 4 · 开始（双端 CTA） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 text-center nav:px-6 nav:py-36">
        <Reveal>
          <ChapterMark no="04" name="开始" />
          <h2 className="mt-3 text-2xl font-bold leading-snug nav:text-4xl">
            看见裂缝，也看见补上的路。
          </h2>
          <p className="mx-auto mt-4 max-w-prose text-reading leading-relaxed text-ink-soft">
            注册即用，走通「自报 → 测评 → 归因 → 辅导 → 复测」完整链路；登录后可选身份，学长相伴，不施压。
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="px-8 text-reading shadow-overlay" onClick={enter}>
              我是学生，开始学
            </Button>
            <Button size="lg" variant="secondary" className="px-8 text-reading" onClick={enter}>
              我是老师，看学情
            </Button>
          </div>
          <div className="mt-6">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'link', size: 'md' }))}
            >
              或先到 GitHub 看看
            </a>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------- 页脚 */}
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-8 text-caption text-ink-soft nav:flex-row nav:justify-between nav:px-6">
          <span>知微 · ZhiWei — 基于知识图谱归因的一对一 AI 学习伴侣</span>
          <span>深圳大学计算机与软件学院 · @Merryou6 / @congming666 · GPL-3.0</span>
        </div>
      </footer>
    </div>
  );
}
