/**
 * 页 9 · 学习报告（PRD §5 #9「掌握度分布 + ΔAccuracy」；P0 #12）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx → { mastery[], gaps[], accuracy[] }
 * 三段布局：① 掌握度分布（四状态带计数 + 每带节点 chip）② 缺口清单（<0.4，含最近错误类型）
 *          ③ 基线 vs 复测（accuracy：baseline / retest / delta；Δ>0 青绿、Δ<0 暖橙、null 显示「—」）
 * 空态：未自报未测评（全部 0 且无 accuracy）→ 引导先自报/先测评，不伪造数据（D12）。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import { kpName } from '../data/graphSnapshot';
import { deltaPercent, percent } from '../lib/format';
import { ERROR_TYPE_LABEL, UI_TEXT } from '../lib/phrases';
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
      <section className="max-w-2xl">
        <h1 className="text-xl font-medium text-ink">学习报告</h1>
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有选中的学习空间"
            hint={UI_TEXT.needSelfReport}
            action={
              <Link to={SPACES_PATH} className="inline-block min-h-9 rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90">
                去选空间
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="max-w-3xl">
        <PageSkeleton label="正在整理你的报告…" rows={3} />
      </section>
    );
  }

  const mastery = report?.mastery ?? [];
  const gaps = report?.gaps ?? [];
  const accuracy = report?.accuracy ?? [];
  const hasData = accuracy.length > 0 || mastery.some((row) => row.mastery > 0);

  if (!hasData) {
    return (
      <section className="max-w-2xl">
        <h1 className="text-xl font-medium text-ink">学习报告</h1>
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <EmptyState
            title="还没有你的学习数据"
            hint={`${UI_TEXT.needSelfReport}做完自报或几道题，这里就会长出掌握度分布和缺口清单。`}
            action={
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/self-report" className="min-h-9 rounded-lg bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90">
                  花 30 秒自报
                </Link>
                <Link to="/assessment" className="min-h-9 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-raised">
                  直接做几道题
                </Link>
              </div>
            }
          />
        </div>
      </section>
    );
  }

  const byBand = BAND_ORDER.map((band) => ({
    band,
    rows: mastery.filter((row) => masteryBandOf(row.mastery) === band),
  }));
  const maxBandCount = Math.max(1, ...byBand.map((entry) => entry.rows.length));

  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-medium text-ink">学习报告</h1>
      <p className="mt-3 rounded-xl bg-surface px-4 py-3 text-sm leading-relaxed text-ink">
        {summaryLine(gaps.length)}
      </p>

      {/* ① 掌握度分布 */}
      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 className="text-base font-medium text-ink">掌握度分布（{mastery.length} 个知识点）</h2>

        <ul className="mt-3 space-y-2">
          {byBand.map(({ band, rows }) => (
            <li key={band} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[13px] text-ink-soft">{band}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(rows.length / maxBandCount) * 100}%`, backgroundColor: BAND_HEX[band] }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-[13px] text-ink-soft">{rows.length}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-3">
          {byBand.map(({ band, rows }) => (
            <div key={band}>
              <p className="text-[13px] text-ink-soft">
                {band}（{rows.length}）
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <span
                    key={row.kp_id}
                    className="rounded-md px-2 py-0.5 text-xs text-ink"
                    style={{ backgroundColor: bandVeilHex(band as MasteryBand) }}
                    title={`${row.name} · ${percent(row.mastery)}`}
                  >
                    {row.name} {percent(row.mastery)}
                  </span>
                ))}
                {rows.length === 0 ? <span className="text-[13px] text-ink-soft/60">—</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ② 缺口清单 */}
      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 className="text-base font-medium text-ink">需要先补的地方（掌握度 &lt; 40%）</h2>
        {gaps.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">暂时没有明显缺口。</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-[13px] text-ink-soft">
                <th className="py-1 font-normal">知识点</th>
                <th className="py-1 font-normal">掌握度</th>
                <th className="py-1 font-normal">最近一次归因</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((row) => (
                <tr key={row.kp_id} className="border-t border-line">
                  <td className="py-2 text-ink">{row.name}</td>
                  <td className={`py-2 ${BAND_CLASS['待巩固'].text}`}>{percent(row.mastery)}</td>
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

      {/* ③ 基线 vs 复测 */}
      <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h2 className="text-base font-medium text-ink">基线 vs 复测（ΔAccuracy）</h2>
        {accuracy.length === 0 ? (
          <EmptyState
            compact
            title="还没有测量数据"
            hint="先做一次基线测量，干预后再复测一次，这里就会出现变化。"
            action={
              <Link to="/assessment" className="text-[13px] text-accent hover:underline">
                去做基线测量 →
              </Link>
            }
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="text-[13px] text-ink-soft">
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
                  <td className="py-2 text-ink-soft">{percent(row.baseline)}</td>
                  <td className="py-2 text-ink-soft">{percent(row.retest)}</td>
                  <td className="py-2">
                    <span
                      className={[
                        'rounded-md px-2 py-0.5 text-xs',
                        row.delta === null
                          ? 'bg-canvas text-ink-soft'
                          : row.delta > 0
                            ? 'bg-band-mastered/12 text-band-mastered'
                            : 'bg-band-weak/12 text-band-weak',
                      ].join(' ')}
                    >
                      {deltaPercent(row.delta)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </section>
  );
}
