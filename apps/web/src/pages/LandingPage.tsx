/**
 * LandingPage · 公开入口门户（P11.1b 用户验收修订，2026-10-11）
 *
 * 【口径】（不变）不属于 PRD §5 的 11 页学习链路：router.ROUTES、守卫、顶栏导航
 * 零改动。App.tsx 直接渲染（不套 Layout / TopNav），未登录可直达。
 * 「立即体验」落点 navigate(LOGIN_PATH)：未登录 → 登录页；已登录 → 守卫原样送进
 * #/spaces。同一条路径自动处理两种会话状态。
 *
 * ─────────────────────────────────────────────────────────────────────
 * 【P11.1b 修订原因】用户验收反馈（检查点㉑）否决了 P11.1 的两处偏离：
 *   ① P11.1 把 main 系「四章滚动叙事」的信息架构（问题/方法/证据/开始）改成了
 *     原型 portal 的五节目录结构，证据章被压成一段旁注、收尾章丢失——信息量倒退；
 *     本版恢复四章滚动叙事的完整内容与信息架构（拍板④的本意：内容与 IA 不动，
 *     只换视觉层）。
 *   ② 删除 P11.1 的「05 图纸目录」（router.ROUTES 全量路由表）——原型的图纸目录
 *     是蓝图标题页的制式隐喻，把内部路由当产品信息罗列不成立；「03 两个入口」
 *     aside 的职责由章 4 双端 CTA 承担，不再单列。
 *   保留 P11.1 的蓝图视觉制式（eyebrow 批注 / bp-measure 量块 / bp-panel 面板 /
 *   bp-note 旁注 / 蓝图字阶 token）与拍板④保留的动效（KineticTitle 逐字、
 *   Reveal 错峰揭示、磁性 CTA、btn-sheen 扫光）。
 *
 * 【数字口径】STATS 以仓库 README 现状为准，勿随手改。
 */

import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Icon } from '../components/blueprint/icons';
import ParticleLogo from '../components/ParticleLogo';
import ZhiweiLogo from '../components/ZhiweiLogo';
import { Button } from '../components/ui';
import { buttonVariants } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { LOGIN_PATH } from '../router';
import { useMagnetic } from '../lib/useMagnetic';
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
 * 「为什么可信」三条主张（原四大亮点的其余三条；第四条「效果用硬指标说话」
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

/**
 * 章节眉标（蓝图制式：编号 + 一词定性，落 .tok 批注刻度——
 * P11.1b 用 tok 替换 main 版的 text-ui-sm，视觉层保持蓝图制式）。
 */
function ChapterMark({ no, name }: { no: string; name: string }) {
  return (
    <p className="font-mono text-tok uppercase tracking-widest text-accent-ink">
      {no} · {name}
    </p>
  );
}

/**
 * 章节揭示容器：进入视口一次性揭示（once），由 lib/useReveal 提供 inView。
 * delayMs 用于同屏多卡片的轻微错峰（directed motion：错峰只在一屏之内，拍板④保留）。
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
 * kinetic 逐字标题（基建在 index.css：kinetic-in / .kinetic-char）——拍板④保留的逐字动画。
 * 逐字延迟由 inline animationDelay 编排；逐字 span 对读屏隐藏，完整句子走 aria-label——
 * 动效不破坏无障碍语义。字号走蓝图 token（text-display-lg，D6：视觉换蓝图）。
 */
function KineticTitle({ lines }: { lines: ReadonlyArray<string> }) {
  let charIndex = 0;
  return (
    <h1
      aria-label={lines.join('')}
      className="mt-4 font-disp text-display-lg font-bold leading-tight tracking-tight text-ink max-narrow:text-num-lg"
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

  // 磁性 CTA（awwwards 包 G · micro-interactions）：主 CTA 悬停向光标轻微吸引（max 6px，
  // 幅度 0.2 保守）。handler 读 event.currentTarget，同一实例可 spread 到多个按钮；
  // reduced-motion 由 hook 内 no-op，触屏无 mousemove 天然无效。拍板④保留。
  const magneticCta = useMagnetic(0.2);

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      {/* ---------------------------------- 公门户自带顶栏（蓝图制式：图纸签署条下沿） */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 annos:px-6">
          <div className="flex items-center gap-2 font-disp text-reading font-semibold">
            <ZhiweiLogo size={24} />
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
            <Button onClick={enter}>立即体验</Button>
          </nav>
        </div>
      </header>

      {/* ---------------------------------- 章 1 · 问题（hero 全屏；min-h 吃掉顶栏高度让首屏恰好满屏） */}
      <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-col justify-center px-4 py-16 annos:px-6 annos:py-20">
        <div className="flex flex-col items-center gap-10 annos:flex-row annos:gap-14">
          <div className="min-w-0 flex-1 animate-rise">
            <p className="text-ui-sm font-medium tracking-widest text-accent-ink">
              粤港澳大湾区 AI Coding 创新赛 · 参赛作品
            </p>
            <KineticTitle lines={['每一分丢在哪里，', '都有名字。']} />
            <p className="mt-5 max-w-prose text-reading leading-relaxed text-ink-soft">
              知微把「这孩子二次函数不行」翻译成「卡在对称轴、属于概念类错误、上游配方法也松了」，
              再用一个不抛答案的 AI 学长陪他走回正轨——最后用三道没见过的新题，证明这条路真的走对了。
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {/* 主 CTA：btn-sheen 扫光 + 磁性吸引（实底按钮才加扫光，拍板④保留） */}
              <Button size="lg" className="px-8 text-reading btn-sheen" onClick={enter} {...magneticCta}>
                <Icon name="arrow" />
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
            {/* ParticleLogo 保留：门户的中央标识（P10.4 注释已声明门户仍在用），
                与逐字标题同属拍板④保留的动效资产。 */}
            <ParticleLogo className="w-[min(300px,60vw)]" repulseRadius={88} />
          </div>
        </div>
      </section>

      {/* ---------------------------------- 章 2 · 方法（五步闭环，逐条一行） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 annos:px-6 annos:py-32">
        <Reveal>
          <ChapterMark no="02" name="方法" />
          <h2 className="mt-3 font-disp text-title font-bold leading-snug tracking-tight text-ink">
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
                <div className="bp-panel flex items-baseline gap-5 px-5 py-4">
                  <span className="num-mono text-accent-ink">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-reading font-semibold">{step.title}</span>
                  <span className="tok annos:ml-auto">{step.sub}</span>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------- 章 3 · 证据（ΔAccuracy 主句 + 数据资产 + 三条主张） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 annos:px-6 annos:py-32">
        <Reveal>
          <ChapterMark no="03" name="证据" />
          <h2 className="mt-3 font-disp text-title font-bold leading-snug tracking-tight text-ink">
            效果不靠感觉，靠 ΔAccuracy。
          </h2>
          <p className="mt-3 max-w-prose text-reading leading-relaxed text-ink-soft">
            干预后从与基线零重叠的新题池抽题复测，ΔAccuracy 达标才算补上——闭环由实测合上，不由感觉合上。
            掌握度不是问卷自评：0 到 1 的数由多源证据算出，四档阈值固定（低于 0.40 / 0.40–0.60 / 0.60–0.80 / 高于 0.80）。
          </p>
        </Reveal>
        {/* 数据资产六数字：main 版 dl 语义结构，卡片换蓝图量块制式（bp-measure）*/}
        <dl className="mt-10 grid grid-cols-2 gap-3 sheet:grid-cols-3 annos:gap-4">
          {STATS.map((stat, index) => (
            <div key={stat.label}>
              <Reveal delayMs={(index % 3) * 70}>
                <div className="bp-measure h-full">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className="big-num">{stat.value}</span>
                    <span className="tok">{stat.label}</span>
                  </dd>
                </div>
              </Reveal>
            </div>
          ))}
        </dl>
        {/* 三条主张：main 版三卡结构，卡片换蓝图双线面板制式（bp-panel）*/}
        <div className="mt-4 grid gap-4 annos:grid-cols-3">
          {PROOFS.map((proof, index) => (
            <div key={proof.title}>
              <Reveal delayMs={index * 70}>
                <article className="bp-panel h-full p-4">
                  <div className="tok">{String(index + 1).padStart(2, '0')} / CLAIM</div>
                  <h3 className="mt-1.5 font-disp text-title-sm tracking-tight text-ink">{proof.title}</h3>
                  <p className="mt-2 text-body-sm leading-relaxed text-ink-soft">{proof.body}</p>
                </article>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------- 章 4 · 开始（双端 CTA） */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 text-center annos:px-6 annos:py-36">
        <Reveal>
          <ChapterMark no="04" name="开始" />
          <h2 className="mt-3 font-disp text-title font-bold leading-snug tracking-tight text-ink">
            看见裂缝，也看见补上的路。
          </h2>
          <p className="mx-auto mt-4 max-w-prose text-reading leading-relaxed text-ink-soft">
            注册即用，走通「自报 → 测评 → 归因 → 辅导 → 复测」完整链路；登录后可选身份，学长相伴，不施压。
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            {/* 章 4 双端 CTA（拍板④保留）：实底的学生按钮加扫光 + 磁性；
                次级（描边）老师按钮只加磁性——扫光是「实底被点亮」的语汇，描边面不加 */}
            <Button size="lg" className="px-8 text-reading btn-sheen" onClick={enter} {...magneticCta}>
              我是学生，开始学
            </Button>
            <Button size="lg" variant="secondary" className="px-8 text-reading" onClick={enter} {...magneticCta}>
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
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-8 text-caption text-ink-soft annos:flex-row annos:justify-between annos:px-6">
          <span>知微 · ZhiWei — 基于知识图谱归因的一对一 AI 学习伴侣</span>
          <span>深圳大学计算机与软件学院 · @Merryou6 / @congming666 · GPL-3.0</span>
        </div>
      </footer>
    </div>
  );
}
