/**
 * LandingPage · 公开入口门户（2026-09-25 收尾轮：企业门户式「大气而简约」）
 *
 * 【口径】它不属于 PRD §5 的 11 页学习链路：router.ROUTES、守卫、顶栏导航零改动，
 * 它是「站外的人第一脚踩到的地方」——介绍项目、数据资产、核心亮点与源码入口。
 * App.tsx 里以 bare 方式渲染（不套 Layout / TopNav），未登录可直达。
 *
 * 【「立即体验」的落点】navigate(LOGIN_PATH)：未登录 → 登录页；已登录 → 守卫
 * 原样送进 #/spaces。同一条路径自动处理两种会话状态，不另造分流逻辑。
 *
 * 【主题】全部颜色走语义令牌（canvas/surface/raised/line/ink/accent…），
 * 深浅两套主题同时成立；入场只用既有 animate-fade/animate-rise（基态可见，
 * reduced-motion 安全），不引新 keyframe。
 */

import { useNavigate } from 'react-router-dom';

import ParticleLogo from '../components/ParticleLogo';
import { Button } from '../components/ui';
import { buttonVariants } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { LOGIN_PATH } from '../router';

const GITHUB_URL = 'https://github.com/Merryou6/zhiwei';

/** 五步闭环（与 README §二同口径，仅文案压缩到短语）。 */
const LOOP_STEPS: ReadonlyArray<{ title: string; sub: string }> = [
  { title: '采集证据', sub: '自报 · 测评 · 试卷 · 对话' },
  { title: '诊断掌握度', sub: 'BKT 建模 · 四档状态带' },
  { title: '定位根因', sub: '图谱回溯先修链' },
  { title: '生成处方', sub: '学长式引导 · 一步一小步' },
  { title: '新题验证', sub: '零重叠复测 · ΔAccuracy' },
];

/** 实物数字（以仓库现状为准，勿随手改）。 */
const STATS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '36', label: '知识节点' },
  { value: '149', label: '典型错误' },
  { value: '404', label: '校准题目' },
  { value: '20', label: 'REST / SSE 接口' },
  { value: '389', label: '自动化用例全绿' },
  { value: '17', label: '外置算法参数' },
];

/** 四大亮点（压自 README §四，每条一句硬话）。 */
const FEATURES: ReadonlyArray<{ title: string; body: string }> = [
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
    body: '像耐心的学长：一次只给一小步提示，不抛答案。远程大模型（OpenAI 兼容）一键接入，任何失败自动回落本地规则模型，永不白屏。',
  },
  {
    title: '效果用硬指标说话',
    body: '干预后从与基线零重叠的新题池抽题复测，ΔAccuracy 达标才算补上——闭环由实测合上，不由感觉合上。',
  },
];

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

      {/* ---------------------------------- Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 nav:px-6 nav:pt-20">
        <div className="flex flex-col items-center gap-10 nav:flex-row nav:gap-14">
          <div className="flex-1 animate-rise">
            <p className="text-ui-sm font-medium tracking-widest text-accent-ink">
              粤港澳大湾区 AI Coding 创新赛 · 参赛作品
            </p>
            <h1 className="mt-4 text-display-lg font-bold leading-tight">
              每一分丢在哪里，
              <br />
              都有名字。
            </h1>
            <p className="mt-5 max-w-prose text-reading leading-relaxed text-ink-soft">
              知微把「这孩子二次函数不行」翻译成「卡在对称轴、属于概念类错误、上游配方法也松了」，
              再用一个不抛答案的 AI 学长陪他走回正轨——最后用三道没见过的新题，证明这条路真的走对了。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
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

      {/* ---------------------------------- 五步闭环 */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 nav:px-6">
          <h2 className="text-center text-lg font-semibold text-ink-soft">五步教学法的产品化闭环</h2>
          <ol className="mt-8 grid grid-cols-2 gap-4 nav:grid-cols-5">
            {LOOP_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-surface border border-line bg-canvas px-4 py-4"
              >
                <span className="text-caption font-semibold text-accent-ink">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="mt-1 text-ui-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-caption text-ink-soft">{step.sub}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------- 数据资产 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-14 nav:px-6">
        <dl className="grid grid-cols-2 gap-8 nav:grid-cols-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-display font-bold text-accent-ink">{stat.value}</span>
                <span className="mt-1 block text-caption text-ink-soft">{stat.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------------------------------- 核心亮点 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 nav:px-6">
          <h2 className="text-center text-lg font-semibold text-ink-soft">和刷题软件不一样的四件事</h2>
          <div className="mt-10 grid gap-4 nav:grid-cols-2">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-surface border border-line bg-canvas p-6"
              >
                <h3 className="text-reading font-semibold">{feature.title}</h3>
                <p className="mt-3 text-ui-sm leading-relaxed text-ink-soft">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------- CTA 收尾 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center nav:px-6">
        <h2 className="text-display font-bold leading-snug">
          看见裂缝，也看见补上的路。
        </h2>
        <p className="mx-auto mt-4 max-w-prose text-reading text-ink-soft">
          注册即用，走通「自报 → 测评 → 归因 → 辅导 → 复测」完整链路。
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button size="lg" className="px-10 shadow-overlay" onClick={enter}>
            立即体验
          </Button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'link', size: 'md' }))}
          >
            或先到 GitHub 看看
          </a>
        </div>
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
