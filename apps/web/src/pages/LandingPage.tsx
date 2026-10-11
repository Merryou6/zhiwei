/**
 * LandingPage · 公开入口门户（P11.1 style-10 迁移，2026-10-11 第 4 轮）
 *
 * 【口径】（不变）不属于 PRD §5 的 11 页学习链路：router.ROUTES、守卫、顶栏导航
 * 零改动。App.tsx 直接渲染（不套 Layout / TopNav），未登录可直达。
 * 「立即体验」落点 navigate(LOGIN_PATH)：未登录 → 登录页；已登录 → 守卫原样送进
 * #/spaces。同一条路径自动处理两种会话状态。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P11.1：按原型 PAGES.portal（tempui/prototypes/style-10/index.html
 * L1855-1911；hero L1881-1889）逐段复现**视觉层**，拍板④ + D6：
 *   · 保留现有四章滚动叙事的内容与信息架构（问题 / 方法 / 证据 / 开始）与**逐字动画**
 *     （KineticTitle，拍板④的组成部分）；本工程有真实后端，原型克制到「无后端 mock」的
 *     动效观只在制式层吸收（去 glass-card/噪点，改蓝图平面 bp-panel），不动叙事与逐字标题。
 *   · 视觉层换蓝图：hero 自渲染 eyebrow（ZHIWEI / PUBLIC SHEET · SHEET 10-01 · 需求 2.1）
 *     / h1 / lede / CTA / hero-meta 数字行（**不套 SheetHead 件**，D24 预判：portal 为
 *     PUBLIC SHEET，页面自有 hero）；分节走 SheetBlock 蓝图制式。
 * 逐段复现：
 *   ① hero（原型 L1881-1889）：eyebrow + KineticTitle（现有逐字标题）+ lede（现有标语）
 *      + hero-cta（立即体验 / 查看源码）+ hero-meta（现有 STATS 六数字，落 .bp-measure）。
 *   ② 01 三条主张（原型 L1892-1893 的 `.grid.g3`）：现有 PROOFS 三条 → 三列 bp-panel。
 *   ③ 02 五步闭环（原型 L1894-1896 的 `ol.num-list`）：现有 LOOP_STEPS → .bp-num-list。
 *   ④ 03 两个入口（原型 L1897-1900 的 aside）：学生 / 教师两条入口（现有双端 CTA，落点仍
 *      是 LOGIN_PATH，由登录页按身份分流——navigate 语义零改动）+ 仓库外部链接。
 *   ⑤ 04 证据（ΔAccuracy 叙事，原型 L1901 的 note 位）：现有「效果不靠感觉，靠 ΔAccuracy」
 *      叙事落旁注（六数字已在 hero-meta，不重复罗列）。
 *   ⑥ 05 图纸目录（原型 L1902-1908 的 `.tbl`）：现有 router.ROUTES 目录（图号=PRD 页面编号 /
 *      视图 / 路径 / 直达），内容以现有为准。
 *
 * 【不迁移 / 口径差（详见执行报告 D-P11.1-1~4）】
 *   · 原型 hero-cta 的「纯前端原型 · 全部 mock 数据 · 无后端」chip 不迁移（D5/12.3：本工程
 *     是真实前后端）。
 *   · 原型 aside 的「外部链接，原型不请求任何真实接口」半句不迁移（同因）。
 *   · 数字口径：STATS 以仓库 README 现状为准（知识节点 36 = 初中 24 + 高中 12、149 典型
 *     错误、404 校准题、41 测试文件、432 用例、20 接口），不随手改。
 */

import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

import { Icon } from '../components/blueprint/icons';
import { SheetBlock } from '../components/blueprint/Sheet';
import ParticleLogo from '../components/ParticleLogo';
import { Badge, Button } from '../components/ui';
import { buttonVariants } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { LOGIN_PATH, ROUTES } from '../router';
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
 * 升格为 04 证据节的 ΔAccuracy 叙事主句，不再重复罗列）。
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
            <Button onClick={enter}>立即体验</Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 annos:px-6">
        {/* -------------------------------- hero（原型 L1881-1889；自渲染，不套 SheetHead 件） */}
        <section className="py-14 annos:py-20">
          {/* eyebrow：眉标（等宽大写）+ 图号 + 需求号 + REV 行（原型 hero 的 .eyebrow） */}
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-tok uppercase tracking-widest text-accent-ink">
            <Icon name="compass" className="h-4 w-4" />
            <span>ZHIWEI / PUBLIC SHEET</span>
            <span className="num-mono">SHEET 10-01</span>
            <span>需求 2.1</span>
            <span className="num-mono">REV.A</span>
          </p>

          <div className="mt-3 flex flex-col items-center gap-10 annos:flex-row annos:gap-14">
            <div className="min-w-0 flex-1">
              <KineticTitle lines={['每一分丢在哪里，', '都有名字。']} />
              <p className="mt-5 max-w-[74ch] text-reading leading-relaxed text-ink-soft">
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

          {/* hero-meta：现有 STATS 六数字，落 .bp-measure 蓝图量块（原型 hero-meta 数字行） */}
          <div className="mt-12 grid grid-cols-2 gap-3 narrow:grid-cols-3 sheet:grid-cols-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="bp-measure">
                <span className="big-num">{stat.value}</span>
                <span className="tok">{stat.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------- 01 三条主张（原型 L1892-1893 的 `.grid.g3`） */}
        <SheetBlock no="01" title="三条主张" right={<span className="tok">CLAIMS</span>}>
          <div className="grid grid-cols-1 gap-4 sheet:grid-cols-3">
            {PROOFS.map((proof, index) => (
              <Reveal key={proof.title} delayMs={index * 70}>
                <article className="bp-panel h-full p-4">
                  <div className="tok">{String(index + 1).padStart(2, '0')} / CLAIM</div>
                  <h3 className="mt-1.5 font-disp text-title-sm tracking-tight text-ink">{proof.title}</h3>
                  <p className="mt-2 text-body-sm leading-relaxed text-ink-soft">{proof.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </SheetBlock>

        {/* -------------------------------- 02 五步闭环 + 03 两个入口（原型 L1894-1900 的 `.split`） */}
        <section className="mb-8 grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <SheetBlock no="02" title="五步闭环" className="mb-0">
              <ol className="bp-num-list">
                {LOOP_STEPS.map((step, index) => (
                  <li key={step.title}>
                    <span className="num-mono">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-body-sm text-ink">{step.title}</span>
                    <span className="tok">{step.sub}</span>
                  </li>
                ))}
              </ol>
              <p className="bp-note">
                <Icon name="tick" className="mr-1 inline h-4 w-4 align-text-bottom" />
                闭环里每一步都会落成证据：自报、测评、试卷确认、对话、练习。复测题与训练题零重叠，所以
                ΔAccuracy 才站得住。
              </p>
            </SheetBlock>
          </div>

          <aside className="min-w-0">
            <SheetBlock no="03" title="两个入口" className="mb-0">
              <div className="flex flex-col gap-2.5">
                <Button variant="primary" onClick={enter} {...magneticCta}>
                  <Icon name="arrow" />
                  我是学生，开始学
                </Button>
                <Button variant="secondary" onClick={enter} {...magneticCta}>
                  我是老师，看学情
                </Button>
              </div>
              <p className="tok mt-3">
                两条入口都先到登录页，由身份分流（学生 / 教师工作台）；仓库：
              </p>
              <p className="mt-1 break-all">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">
                  {GITHUB_URL}
                </a>
              </p>
            </SheetBlock>
          </aside>
        </section>

        {/* -------------------------------- 04 证据（ΔAccuracy 叙事；原型 L1901 的 note 位） */}
        <SheetBlock no="04" title="证据">
          <p className="bp-note">
            效果不靠感觉，靠 ΔAccuracy。干预后从与基线零重叠的新题池抽题复测，ΔAccuracy 达标才算补上——
            闭环由实测合上，不由感觉合上。掌握度不是问卷自评：0 到 1 的数由多源证据算出，四档阈值固定
            （低于 0.40 / 0.40–0.60 / 0.60–0.80 / 高于 0.80）。
          </p>
        </SheetBlock>

        {/* -------------------------------- 05 图纸目录（原型 L1902-1908 的 `.tbl`） */}
        <SheetBlock
          no="05"
          title="图纸目录"
          right={<Badge>{ROUTES.length} 张图纸 · 全部 hash 可达</Badge>}
        >
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <caption>学生端链路 · 内容与导航结构以本工程现有 router.ROUTES 为准</caption>
              <thead>
                <tr>
                  <th scope="col">图号</th>
                  <th scope="col">视图</th>
                  <th scope="col">路径</th>
                  <th scope="col">直达</th>
                </tr>
              </thead>
              <tbody>
                {ROUTES.map((route) => (
                  <tr key={route.path}>
                    <td data-label="图号" className="num-mono">
                      {String(route.page).padStart(2, '0')}
                    </td>
                    <td data-label="视图" className="text-ink">
                      {route.label}
                    </td>
                    <td data-label="路径" className="num-mono break-all">
                      {route.path}
                    </td>
                    <td data-label="直达">
                      <a href={`#${route.path}`} className="text-accent-ink hover:underline">
                        打开
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetBlock>
      </main>

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
