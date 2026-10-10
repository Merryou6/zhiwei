/**
 * 页 9 · 学习报告（PRD §5 #9「掌握度分布 + ΔAccuracy」；P0 #12）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx → { mastery[], gaps[], accuracy[] }
 * 三段布局：① 掌握度分布（四状态带计数 + 每带节点 chip）② 缺口清单（<0.4，含最近错误类型）
 *          ③ 基线 vs 复测（accuracy：baseline / retest / delta；Δ>0 青绿、Δ<0 暖橙、null 显示「—」）
 * 空态：未自报未测评（全部 0 且无 accuracy）→ 引导先自报/先测评，不伪造数据（D12）。
 *
 * ── 重构 P3-4（2026-09-25）───────────────────────────────────────
 * ① **补上打印 / 存为 PDF 按钮**。在此之前这是本项目最典型的一处「装了却没接线」：
 *    index.css 的 @media print 早就准备好了（强制浅色、[data-print='hide'] 隐藏外壳、
 *    去阴影、覆盖 13 个角色变量，还有 tokens.test.ts ⑨ 两条断言锁着），
 *    但业务代码里**没有任何 window.print() 调用** —— 整套机制从来没被触发过。
 * ② 打印块补 `animation / transition: none`：打印只有终态这一帧，
 *    若在路由入场（280ms）未完成时点打印，会印出半透明正文。
 * ③ 版式接入 PageContainer（standard；空态与无空间态用 prose）+ PageHeader。
 * ④ 三处按钮 Link 复用 buttonVariants，不再抄第二套按钮 class。
 * ⑤ 所有数值（计数、掌握度、基线 / 复测、ΔAccuracy）改等宽 + 表格数字：
 *    这张表的核心就是「同一列上下对齐着比」，比例字体下每次改数都会错位。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import EmptyState from '../components/EmptyState';
import NextStepCard from '../components/NextStepCard';
import PageSkeleton from '../components/PageSkeleton';
// 完成奖励（awwwards 适配包 2）：复测较基线提升时刻的小号描边对勾
import SuccessMark from '../components/SuccessMark';
import { Button, PageContainer, PageHeader, buttonVariants } from '../components/ui';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import { kpName } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { deltaPercent, percent } from '../lib/format';
import { ERROR_TYPE_LABEL, UI_TEXT } from '../lib/phrases';
import { revealItem, useReveal } from '../lib/reveal';
import { SPACES_PATH } from '../router';
import { BAND_CLASS, BAND_HEX, BAND_ORDER, bandVeilHex, masteryBandOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 顶部一句总结：按缺口数量选话术（学长语气，不评判）。 */
function summaryLine(gapCount: number): string {
  if (gapCount === 0) {
    return '这二十个点看着都稳，接下来挑一两道综合题试试就好。';
  }
  if (gapCount <= 3) {
    return `现在还有 ${gapCount} 处有点晃，我们先挑最靠上游的那个补，其他会跟着松。`;
  }
  return `还有 ${gapCount} 处晃着，别急着一次全补——从最靠前的那一环开始，走过来会越来越快。`;
}

export default function ReportPage() {
  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  /** 滚动揭示（Motion-Driven 的 reveal 词汇）见 lib/reveal.ts 的三段式：
      环境不允许时钩子什么都不做，区块按 CSS 默认保持可见。
      文档级作用域、不需要容器 ref —— 少包一层 div 就不会改动取证锚点的取法。
      deps 传 loading（2026-10-08）：报告区块是数据到达后才挂载的，
      钩子需在数据就绪后重新观察，否则新区块永远 opacity:0（首屏空白根因）。 */
  useReveal([loading, report]);

  useEffect(() => {
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await reportSummary(activeSpaceId);
        if (!cancelled) setReport(data);
      } catch (error) {
        if (!cancelled) toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId]);

  if (!activeSpaceId) {
    return (
      <PageContainer width="prose">
        <PageHeader title="学习报告" />
        <div className="mt-5 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有选中的学习空间"
            hint={UI_TEXT.needSelfReport}
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                去选空间
              </Link>
            }
          />
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer width="standard">
        <PageSkeleton label="正在整理你的报告…" rows={3} />
      </PageContainer>
    );
  }

  const mastery = report?.mastery ?? [];
  const gaps = report?.gaps ?? [];
  const accuracy = report?.accuracy ?? [];
  const hasData = accuracy.length > 0 || mastery.some((row) => row.mastery > 0);

  if (!hasData) {
    return (
      <PageContainer width="prose">
        <PageHeader title="学习报告" />
        <div className="mt-5 rounded-surface border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有你的学习数据"
            hint={`${UI_TEXT.needSelfReport}做完自报或几道题，这里就会长出掌握度分布和缺口清单。`}
            action={
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/self-report" className={cn(buttonVariants({ variant: 'primary' }))}>
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
                  直接做几道题
                </Link>
              </div>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const byBand = BAND_ORDER.map((band) => ({
    band,
    rows: mastery.filter((row) => masteryBandOf(row.mastery) === band),
  }));
  const maxBandCount = Math.max(1, ...byBand.map((entry) => entry.rows.length));

  // 编辑式大数字头版（awwwards SOTD 超大字排版）：取 Δ 最大的一条作「主结果」上头版，
  // 展示层取舍，不改数据请求；无 accuracy 时不出头版。
  const heroRow =
    accuracy.length > 0
      ? accuracy.reduce((best, row) => ((row.delta ?? -Infinity) > (best.delta ?? -Infinity) ? row : best))
      : null;

  return (
    <PageContainer width="standard">
      <PageHeader
        title="学习报告"
        actions={
          // 打印 / 存为 PDF（2026-09-25 重构 P3 补上）。
          // 这是**纯客户端** window.print()，服务端没有导出端点 —— index.css 的 @media print
          // 早就为它准备好了（强制浅色、[data-print='hide'] 隐藏外壳、去阴影），
          // 但按钮一直没接，等于整套机制装好了却没接线。
          // data-print="hide"：按钮自己不该被印到纸上。
          <Button variant="secondary" size="sm" data-print="hide" onClick={() => window.print()}>
            打印 / 存为 PDF
          </Button>
        }
      />
      <p className="mt-4 rounded-surface bg-surface px-4 py-3 text-reading leading-relaxed text-ink">
        {summaryLine(gaps.length)}
      </p>

      {/* 首屏双栏（2026-10-08 用户走查修复：此前首屏只有一句总结，分布与缺口都要滚动才见）。
          桌面两列并排（分布条 | 缺口表），一屏看全"现状 + 最该补什么"；窄屏自动回落单列。 */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* ① 掌握度分布（状态带计数条） */}
        <div className="rounded-surface border border-line bg-surface p-4 shadow-card" {...revealItem}>
          <h2 className="text-base font-medium text-ink">
            掌握度分布（<span className="font-mono tabular-nums">{mastery.length}</span> 个知识点）
          </h2>

          <ul className="mt-3 space-y-2">
            {byBand.map(({ band, rows }) => (
              <li key={band} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-ui-sm text-ink-soft">{band}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(rows.length / maxBandCount) * 100}%`, backgroundColor: BAND_HEX[band] }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-ui-sm tabular-nums text-ink-soft">
                  {rows.length}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-ui-sm text-ink-soft">每个点的具体掌握度在下方「分状态带明细」。</p>
        </div>

        {/* ② 缺口清单 */}
        <div className="rounded-surface border border-line bg-surface p-4 shadow-card" {...revealItem}>
          <h2 className="text-base font-medium text-ink">需要先补的地方（掌握度 &lt; 40%）</h2>
          {gaps.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">暂时没有明显缺口。</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-ui-sm text-ink-soft">
                  <th className="py-1 font-normal">知识点</th>
                  <th className="py-1 font-normal">掌握度</th>
                  <th className="py-1 font-normal">最近一次归因</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((row) => (
                  <tr key={row.kp_id} className="border-t border-line">
                    <td className="py-2 text-ink">{row.name}</td>
                    <td className={cn('py-2 font-mono tabular-nums', BAND_CLASS['待巩固'].text)}>
                      {percent(row.mastery)}
                    </td>
                    <td className="py-2 text-ink-soft">
                      {row.error_type_last ? ERROR_TYPE_LABEL[row.error_type_last] : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* 下一步路标（2026-10-08 用户走查）：有缺口时把"去哪补"显式递出来 */}
      {gaps.length > 0 ? (
        <NextStepCard
          className="mt-5"
          status={`缺口清单里排最前的是「${gaps[0]?.name ?? ''}」`}
          hint="去对话页把这处晃的地方补稳——学长会一次只给一小步，不直接抛答案。"
          actions={[
            { label: '去对话页补一补', to: '/chat', primary: true },
            { label: '在图谱里看它的先修链', to: '/graph' },
          ]}
        />
      ) : null}

      {/* ①b 分状态带明细（chips） */}
      <div className="mt-5 rounded-surface border border-line bg-surface p-4 shadow-card" {...revealItem}>
        <h2 className="text-base font-medium text-ink">分状态带明细</h2>
        <div className="mt-3 space-y-3">
          {byBand.map(({ band, rows }) => (
            <div key={band}>
              <p className="text-ui-sm text-ink-soft">
                {band}（<span className="font-mono tabular-nums">{rows.length}</span>）
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <span
                    key={row.kp_id}
                    className="rounded-md px-2 py-0.5 text-xs text-ink"
                    style={{ backgroundColor: bandVeilHex(band as MasteryBand) }}
                    title={`${row.name} · ${percent(row.mastery)}`}
                  >
                    {row.name}{' '}
                    <span className="font-mono tabular-nums text-ink-soft">{percent(row.mastery)}</span>
                  </span>
                ))}
                {rows.length === 0 ? <span className="text-ui-sm text-ink-soft/60">—</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ③ 基线 vs 复测 —— 本页的「主结果卡」：提升发生在这里被看见。
          glass-card（跨包契约，包 1 落地）：只此一张换玻璃面，保持克制 */}
      <div className="glass-card mt-5 rounded-surface border border-line bg-surface p-4 shadow-card" {...revealItem}>
        <h2 className="text-base font-medium text-ink">基线 vs 复测（ΔAccuracy）</h2>
        {heroRow ? (
          // 编辑式大数字（awwwards SOTD）：数字当主角——超大、细字重、tabular-nums，
          // 标签保持小号令牌色；min-w-0/truncate 防窄屏挤压溢出。
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="min-w-0">
              <p className="text-ui-sm text-ink-soft">复测正确率 · {kpName(heroRow.kp_id)}</p>
              <p className="truncate text-4xl font-light tabular-nums text-ink sm:text-5xl">
                {percent(heroRow.retest)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-ui-sm text-ink-soft">ΔAccuracy（基线 {percent(heroRow.baseline)}）</p>
              {heroRow.delta === null ? (
                <p className="truncate text-2xl font-light tabular-nums text-ink-soft sm:text-3xl">—</p>
              ) : (
                <p
                  className={cn(
                    'truncate text-2xl font-light tabular-nums sm:text-3xl',
                    heroRow.delta > 0
                      ? // 正 Δ：accent 渐变文字（bg-clip-text），色值走 band 令牌——令牌闸门禁止 accent 直接做文字色
                        'bg-gradient-to-r from-band-mastered to-band-basic bg-clip-text text-transparent'
                      : // 负 Δ：保持 danger 语义令牌（band-weak），不加动效
                        'text-band-weak',
                  )}
                >
                  {deltaPercent(heroRow.delta)}
                </p>
              )}
            </div>
          </div>
        ) : null}
        {accuracy.length === 0 ? (
          <EmptyState
            compact
            title="还没有测量数据"
            hint="先做一次基线测量，干预后再复测一次，这里就会出现变化。"
            action={
              <Link to="/assessment" className="text-ui-sm text-accent-ink hover:underline">
                去做基线测量 →
              </Link>
            }
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-ui-sm text-ink-soft">
                <th className="py-1 font-normal">知识点</th>
                <th className="py-1 font-normal">基线</th>
                <th className="py-1 font-normal">复测</th>
                <th className="py-1 font-normal">ΔAccuracy</th>
              </tr>
            </thead>
            <tbody>
              {accuracy.map((row) => (
                <tr key={row.kp_id} className="border-t border-line">
                  <td className="py-2 text-ink">{kpName(row.kp_id)}</td>
                  <td className="py-2 font-mono tabular-nums text-ink-soft">{percent(row.baseline)}</td>
                  <td className="py-2 font-mono tabular-nums text-ink-soft">{percent(row.retest)}</td>
                  <td className="py-2">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 font-mono text-xs tabular-nums',
                        row.delta === null
                          ? 'bg-canvas text-ink-soft'
                          : row.delta > 0
                            ? 'bg-band-mastered/10 text-band-mastered'
                            : 'bg-band-weak/10 text-band-weak',
                      )}
                    >
                      {deltaPercent(row.delta)}
                    </span>
                    {/* 提升奖励（awwwards「reward attention」）：Δ>0 的行内右侧给一枚小对勾定格进步，
                        视觉图形 aria-hidden，语义由 sr-only「较基线提升」承担 */}
                    {row.delta !== null && row.delta > 0 ? (
                      <span className="ml-1.5 inline-flex align-middle">
                        <SuccessMark size={18} tone="positive" label="较基线提升" />
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
