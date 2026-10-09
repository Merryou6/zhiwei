/**
 * 页 13 · 冷启动分叉（v2.1「不刷题也能开始」）
 *
 * 战略：注册成功后不强制做题 —— 给两条建图路径让家庭自己选：
 *   A. 拍一张最近的试卷（推荐，零负担，一分钟建图）→ /paper
 *   B. 先做几道摸底题（原有 diagnose/baseline 链路）→ /assessment
 * 都不想现在做 → 先自报个大概（/self-report，原有起点自报）。
 *
 * 这是「拍搜工具 vs 学伴」差异在产品入口层的表达：第一屏就是「认识你」，不是「考你」。
 */

import { Link, useNavigate } from 'react-router-dom';

import { Button, PageContainer, PageHeader } from '../components/ui';
import { cn } from '../lib/cn';
import { useReveal } from '../lib/useReveal';
import { ASSESSMENT_PATH, PAPER_PATH, SELF_REPORT_PATH } from '../router';

const OPTIONS = [
  {
    to: PAPER_PATH,
    title: '拍一张最近的试卷',
    hint: '月考卷 / 答题卡 / 平时作业都行',
    desc: '我按卷面错题建你的知识地图，一分钟就好——不用当场刷题。',
    primary: true,
  },
  {
    to: ASSESSMENT_PATH,
    title: '先做几道摸底题',
    hint: '大约 10 分钟',
    desc: '边做我边记：哪里稳、哪里晃，地图随着作答一格格亮起来。',
    primary: false,
  },
] as const;

export default function StartPage() {
  const navigate = useNavigate();

  // 章节揭示（awwwards 入场）：标题块先落定，两张路径卡随后错峰（directed motion）。
  // once + reduced-motion 直出由 useReveal 兜底。
  const header = useReveal<HTMLDivElement>();
  const list = useReveal<HTMLUListElement>();

  return (
    <PageContainer width="prose">
      <div ref={header.ref} className={cn('reveal-section', header.inView && 'is-revealed')}>
        <PageHeader
          title="两种方式认识你"
          description="选一条路，先把你的知识地图建起来。之后随时可以换另一条，两边都会记账。"
        />
      </div>

      <ul ref={list.ref} className="mt-6 space-y-3">
        {OPTIONS.map((option, index) => (
          <li
            key={option.to}
            className={cn('reveal-section', list.inView && 'is-revealed')}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <button
              type="button"
              onClick={() => navigate(option.to)}
              // 玻璃面 + hover 轻提升：路径层次与可点反馈（awwwards layered depth）
              className={cn(
                'glass-card w-full rounded-surface border p-5 text-left shadow-card transition hover:border-accent hover:-translate-y-0.5',
                option.primary ? 'border-accent' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-base font-medium text-ink">{option.title}</span>
                {option.primary ? (
                  <span className="rounded-control bg-accent-veil px-2 py-0.5 text-caption text-accent-ink">
                    推荐 · 零负担
                  </span>
                ) : (
                  <span className="font-mono text-ui-sm tabular-nums text-ink-soft">{option.hint}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{option.desc}</p>
              {option.primary ? (
                <p className="mt-1 text-ui-sm text-ink-soft">{option.hint}</p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(SELF_REPORT_PATH)}>
          都先不了，花 30 秒自报个大概
        </Button>
        <Link to="/graph" className="text-ui-sm text-ink-soft underline-offset-2 hover:underline">
          先去空白的技能树看看
        </Link>
      </div>
    </PageContainer>
  );
}
