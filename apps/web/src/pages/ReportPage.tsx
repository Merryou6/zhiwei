/**
 * 页 9 · 学习报告（PRD §5 #9「掌握度分布 + ΔAccuracy」；P0 #12）
 *
 * 契约：#19 GET /api/report/summary?space_id=xxx → { mastery[], gaps[], accuracy[] }
 *
 * ── style-10「青蓝蓝图」迁移 P6（2026-10-11）：首个迁移页 = 通用件模板 ──────────
 * 视觉层按原型 PAGES.report（tempui/prototypes/style-10/index.html L2911-2979）与
 * PAGES._reportEmpty（L2981-2987）逐段复现，**业务逻辑一行不改**：
 *
 *   ① 页头        SheetHead：eyebrow「REPORT / 汇总与验证」+ SHEET 10-12 + 需求 2.12
 *                 + h1 + sub（含空间名）+ chip「T0 · 可打印」（原型 L2944-2946）
 *   ② 打印条      noprint：btn primary + 打印口径 tok（P3-4 的 window.print 与
 *                 data-print='hide' 接线原样保留，成果不丢）（L2947-2949）
 *   ③ 01 一句话总评     panel #verdict：chip + 两个口径如实并列 + 总评正文（17px）
 *                 + 口径 hint（L2950-2955）
 *   ④ 02 掌握度四档分布 .dist 条形（档名 + 条形 + 等宽计数）+ 细网格表「分档明细」
 *                 （L2956-2963）
 *   ⑤ 03 缺口清单      细网格表：知识点 / 掌握度 / 档位 / 最近一次归因 / 出路
 *                 （L2964-2966）
 *   ⑥ 04 基线与复测对比 细网格表 ΔAccuracy：复测缺失写「不可算」+ 原因（D15b），
 *                 末尾 note print-only 给主结果（L2967-2970）
 *   ⑦ 05 从缺口出发     noprint：btn row（首按钮 primary）+「看技能树」（L2971-2973）
 *   （原型 06「三种空状态（口径说明）」不复现 —— 规范 §10 report 行已裁定本页为
 *     01–05 五节，三种空态本身按四态落位实现，D15a）
 *
 * 【表格与窄档】表格一律走 `.bp-tbl` 细网格制式（index.css，原型 L324-339），
 * 窄档（≤900）由同理的媒体查询转成 data-label 卡片（原型 L707-720）。
 * 复制自原型的要点：等宽数字右对齐（同一列上下逐位对齐）、表头每页重复。
 *
 * 【F-01 修复（D14）】375 档横向溢出 95px 的根因是「双卡 grid 的轨道被表里的固定
 * 最小宽（420px）撑到 454px」——本轮按原型改成**纵向五节堆叠**（原型本就没有
 * lg:grid-cols-2 双卡），根因随之消失；保留的 grid 子项一律 min-w-0，
 * 一次性最小宽类与横滚表全部退场（页面零一次性样式纪律）。
 *
 * 【四态（规范 §7：本页是**整页级**落位；图框 / 分层索引 / 标题栏照常显示）】
 *   loading → SkeletonLines（静态发丝斜线，不 shimmer；PageSkeleton 留给未迁移页）
 *   失败     → Stamp 红章 + 真重试（D15c 的最小新增，见下）
 *   无空间   → 虚线空盒 EmptyState（现有文案照用，D5）
 *   无数据   → 两块虚线空盒并列（NO DATA / NO DELTA，原型 _reportEmpty 双盒）
 *
 * 【计划 3.1 追加红线（逐条遵守）】
 *   · 取数 useEffect（reportSummary 调用 / cancelled 清理 / 依赖数组）**一个字符不动**；
 *   · 守卫分支顺序仍是「无空间 → loading → 数据态」；
 *   · summaryLine / percent / deltaPercent / kpName 与 UI_TEXT / ERROR_TYPE_LABEL
 *     文案常量原样沿用。
 *
 * 【D15c 的最小新增：失败态】取数 effect 是冻结红线，所以失败**派生**出来而不是
 * 上报进去（成功必然落 report，故「首次取数已落定且 report 仍为空」⇔ 失败）；
 * 重试复用同一个 reportSummary，是真重试（D10）。留痕见 02_EXEC_REPORT。
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { reportSummary } from '../api/endpoints';
import type { ReportSummaryData } from '../api/types';
import EmptyState from '../components/EmptyState';
import BandMark from '../components/blueprint/BandMark';
import { useBlueprintTier } from '../components/blueprint/Board';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import Stamp from '../components/blueprint/Stamp';
import { Icon } from '../components/blueprint/icons';
import { Badge, Button, buttonVariants } from '../components/ui';
import { kpName } from '../data/graphSnapshot';
import { cn } from '../lib/cn';
import { deltaPercent, percent } from '../lib/format';
import { ERROR_TYPE_LABEL, UI_TEXT } from '../lib/phrases';
import { revealItem, useReveal } from '../lib/reveal';
import { SPACES_PATH } from '../router';
import { BAND_ORDER, masteryBandOf } from '../theme/bands';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 模板页的固定元信息（原型 sheetHead 的图号与需求号，规范 §10 / 原件 2.12）。 */
const SHEET_NO = '10-12';
const SECTION_NO = '2.12';

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

/**
 * 总评 chip 的档位短标（原型 `.chip.red` 里放的是三档措辞）。
 *
 * ⚠ 阈值必须与 `summaryLine` 的取句边界**逐条一致**（0 / 1–3 / ≥4）：chip 说
 *   「缺口较多」而正文说「还有 4 处有点晃」的话，同一张 panel 里就有两种口径。
 *   这里的 0 / 3 是 summaryLine 的既有边界，不是新引入的阈值
 *   （需求 2.12 原文写的是 ≥5 / 1–4 / 0，那是原型 MOCK 的口径，本页不据此改文案）。
 * ⚠ 「没有缺口 / 少量缺口 / 缺口较多」是新增展示文案（D5 / D15b 同口径：
 *   新增展示文案不进 phrases 的逐字锁定范围），已写进执行报告留痕。
 */
function verdictTier(gapCount: number): string {
  if (gapCount === 0) return '没有缺口';
  return gapCount <= 3 ? '少量缺口' : '缺口较多';
}

export default function ReportPage() {
  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  /** 失败态与重试在途（D15c 最小新增）。 */
  const [retrying, setRetrying] = useState(false);
  /** 已落定的那次取数属于哪个空间（失败判定的前提，见下方 `failed`）。 */
  const [loadedSpaceId, setLoadedSpaceId] = useState<string | null>(null);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const spaces = useSpaceStore((state) => state.spaces);
  const toast = useUiStore((state) => state.toast);
  const tier = useBlueprintTier();
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

  /**
   * 「哪一次取数已经落定」的记账：取数 effect 只在**首次挂载**时把 loading 置 true
   * （切换空间时它不再置位），所以「已落定」这件事只能这样记 —— 记下空间 id 而不是
   * 一个布尔值，才有办法区分「首次取数失败」与「切空间后在途」。
   */
  useEffect(() => {
    if (!loading && activeSpaceId) setLoadedSpaceId(activeSpaceId);
  }, [loading, activeSpaceId]);

  /**
   * 失败态（D15c）。派生而非上报：取数 effect 一个字符不动，所以失败由
   * 「取数已落定（loading=false，且落定的正是当前空间）+ 报告仍为空」唯一确定
   * —— 成功必然落 report，report 为空只可能是请求失败。
   *
   * ⚠ 为什么要带 `loadedSpaceId === activeSpaceId` 这一条：切换空间时 UI 侧
   *   loading 不会重新置位，若只看 loading，切空间的在途窗口会被误判成失败、
   *   闪一顶红章。记了空间 id 之后，切空间期间（两者不等）一律不判失败。
   */
  const failed = !loading && report === null && loadedSpaceId !== null && loadedSpaceId === activeSpaceId;

  /**
   * 真重试（规范 5.8 / D10）：复用**同一个** reportSummary 取数函数（不新开请求路径），
   * 在途时 Stamp 的重试键禁用。失败仍走既有 toast 话术（toast 保留，见执行报告留痕）。
   */
  async function reload(): Promise<void> {
    if (!activeSpaceId) return;
    setRetrying(true);
    try {
      const data = await reportSummary(activeSpaceId);
      setReport(data);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setRetrying(false);
    }
  }

  const spaceName = spaces.find((space) => space.space_id === activeSpaceId)?.name ?? '未选择';

  /**
   * 页头（原型 sheetHead L2944-2946）。**由页面自己渲染**：外壳对此页不再补通用页头
   * （Layout 的 PAGE_OWNED_HEAD，D16）—— 否则一页会出现两个 h1。
   */
  const pageHead = (
    <SheetHead
      eyebrow="REPORT / 汇总与验证"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="学习报告 · 按空间汇总"
      sub={
        <>
          空间 <b className="num-mono">{spaceName}</b> · 汇总掌握度四档分布、缺口清单与
          ΔAccuracy（数据来自本空间的诊断与复测记录）。
        </>
      }
      chips={<Badge tone="accent">T0 · 可打印</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  if (!activeSpaceId) {
    return (
      <>
        {/* 原型 L2915-2917：无空间态仍是完整图纸 —— 页头换成本页用途说明 + 01 空状态 */}
        <SheetHead
          eyebrow="REPORT / 汇总与验证"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="学习报告"
          sub="打印或留存为 PDF；输出完整可读。"
          chips={<Badge>T0</Badge>}
          dim={sheetDimText(tier)}
        />
        <SheetBlock no="01" title="空状态：没有空间">
          <EmptyState
            tag="NO SPACE"
            title="还没有选中的学习空间"
            hint={UI_TEXT.needSelfReport}
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                去选空间
              </Link>
            }
          />
        </SheetBlock>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {pageHead}
        <SkeletonLines rows={4} block />
      </>
    );
  }

  if (failed) {
    return (
      <>
        {pageHead}
        <Stamp
          reason="这一次没能取到本空间的报告汇总（网络中断，或服务暂时没有响应）。你已有的学习数据没有丢，重试一次通常就能取到；一直取不到时可以先去学习空间确认它还在。"
          onRetry={() => {
            void reload();
          }}
          retrying={retrying}
          alt={{ label: '回到学习空间', to: SPACES_PATH }}
        />
      </>
    );
  }

  const mastery = report?.mastery ?? [];
  const gaps = report?.gaps ?? [];
  const accuracy = report?.accuracy ?? [];
  const hasData = accuracy.length > 0 || mastery.some((row) => row.mastery > 0);

  if (!hasData) {
    return (
      <>
        {pageHead}
        {/* 原型 _reportEmpty（L2981-2987）：两块虚线空盒，先「没有数据」再「没有对比」 */}
        <EmptyState
          tag="NO DATA"
          title="还没有可汇总的数据"
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
        <EmptyState
          className="mt-3"
          tag="NO DELTA"
          title="还没有基线与复测的对比"
          hint="先做一次基线测量，干预后再复测一次，这里就会出现变化。"
          action={
            <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
              去做基线测量
            </Link>
          }
        />
      </>
    );
  }

  const byBand = BAND_ORDER.map((band) => ({
    band,
    rows: mastery.filter((row) => masteryBandOf(row.mastery) === band),
  }));
  /** 占比分母 = 参与汇总的知识点数（原型用它的 MOCK 总数，这里用真实总数）。 */
  const total = mastery.length;
  /**
   * 「口径 B：掌握度低于 0.40 的节点数」。阈值不在这里重写：待巩固 ⇔ mastery < 0.40
   * 是 bands.ts（engine 同源）的判定，故直接数待巩固档 —— 前端只有一份阈值。
   */
  const lowMasteryCount = byBand.find((entry) => entry.band === '待巩固')?.rows.length ?? 0;

  // 编辑式大数字头版（awwwards SOTD 超大字排版）：取 Δ 最大的一条作「主结果」上头版，
  // 展示层取舍，不改数据请求；无 accuracy 时不出头版。
  const heroRow =
    accuracy.length > 0
      ? accuracy.reduce((best, row) => ((row.delta ?? -Infinity) > (best.delta ?? -Infinity) ? row : best))
      : null;
  /** 主结果文本（原型 RP.mainResult）：chip 与纸上专有行共用同一句。 */
  const mainResult =
    heroRow && heroRow.delta !== null
      ? `${kpName(heroRow.kp_id)} ΔAccuracy ${deltaPercent(heroRow.delta)}`
      : null;

  return (
    <>
      {pageHead}

      {/* ② 打印条（原型 L2947-2949）。data-print='hide'：这一条是屏幕上的操作提示，
          不该被印到纸上（打印按钮自己不打印）。 */}
      <section className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2" data-print="hide">
        <Button variant="primary" onClick={() => window.print()}>
          <Icon name="print" className="h-4 w-4" />
          打印 / 留存为 PDF
        </Button>
        <span className="tok">打印样式：隐藏导航与标注、白底黑字、表格不截断</span>
      </section>

      {/* ③ 01 一句话总评（原型 L2950-2955） */}
      <SheetBlock no="01" title="一句话总评">
        <div className="bp-panel p-4" {...revealItem}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Badge tone="negative">{verdictTier(gaps.length)}</Badge>
            <span className="tok">
              口径 A：缺口清单 {gaps.length} 处 · 口径 B：掌握度低于 0.40 的节点{' '}
              {lowMasteryCount} 个
            </span>
          </div>
          {/* 17px：走 blueprint 字号刻度的 title-sm（D15d：不引任意值字号） */}
          <p className="mt-2.5 text-title-sm leading-relaxed text-ink">{summaryLine(gaps.length)}</p>
          <p className="mt-2 max-w-[64ch] text-body-sm leading-relaxed text-ink-soft">
            三档措辞按缺口数量取句，不出现评价词。两个口径不一致时如实并列，不改动数值。
          </p>
        </div>
      </SheetBlock>

      {/* ④ 02 掌握度四档分布（原型 L2956-2963） */}
      <SheetBlock
        no="02"
        title="掌握度四档分布"
        right={<Badge>{total} 个知识点</Badge>}
      >
        {/* .dist 条形：档名（形状 + 文字）· 条形（宽度 = 占比）· 等宽计数。
            窄档（≤419.98）改两行制：档名 | 计数 在上，条形独占一行（原型 L739-740）。
            ⚠ 色键取自 BAND_ORDER 的序（1..4）：形状/色键在 BandMark 与 BandLegend
              里各有一张同名表，这里不再抄第三份 —— 四档序是 bands.ts 的既成事实。 */}
        <div className="flex flex-col gap-2.5" {...revealItem}>
          {byBand.map(({ band, rows }) => {
            const bandKey = BAND_ORDER.indexOf(band) + 1;
            const share = total > 0 ? Math.round((rows.length / total) * 100) : 0;
            return (
              <div
                key={band}
                className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-2.5 gap-y-1.5 narrow:grid-cols-[150px_minmax(0,1fr)_44px]"
              >
                <span className="order-1 min-w-0">
                  <BandMark band={band} showValue={false} size="sm" />
                </span>
                <span
                  className={cn(
                    'relative order-3 col-span-full h-2.5 min-w-0 border border-line bg-raised narrow:order-2 narrow:col-auto',
                    `bp-band-${bandKey}`,
                  )}
                  aria-hidden="true"
                >
                  <i
                    className="absolute bottom-px left-px top-px block bg-current"
                    style={{ width: `calc(${share}% - 2px)` }}
                  />
                </span>
                <span className="num-mono order-2 text-right text-ui-sm text-ink narrow:order-3">
                  {rows.length}
                </span>
              </div>
            );
          })}
        </div>

        {/* 细网格表「分档明细」：等宽数字右对齐 + 知识点 chips（窄档转卡片） */}
        <div className="bp-tbl-wrap mt-3.5" {...revealItem}>
          <table className="bp-tbl">
            <caption>分档明细</caption>
            <thead>
              <tr>
                <th scope="col">档位</th>
                <th scope="col" className="n">
                  个数
                </th>
                <th scope="col" className="n">
                  占比
                </th>
                <th scope="col">知识点</th>
              </tr>
            </thead>
            <tbody>
              {byBand.map(({ band, rows }) => (
                <tr key={band}>
                  <td data-label="档位">
                    <BandMark band={band} showValue={false} size="sm" />
                  </td>
                  <td data-label="个数" className="n">
                    {rows.length}
                  </td>
                  <td data-label="占比" className="n">
                    {total > 0 ? Math.round((rows.length / total) * 100) : 0}%
                  </td>
                  <td data-label="知识点">
                    {rows.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {rows.map((row) => (
                          <Badge key={row.kp_id} band={band}>
                            {row.name}{' '}
                            <span className="num-mono text-mono-xs">{percent(row.mastery)}</span>
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span className="tok">明细见缺口清单与图谱</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SheetBlock>

      {/* ⑤ 03 缺口清单（原型 L2964-2966） */}
      <SheetBlock
        no="03"
        title="缺口清单"
        right={<span className="tok">掌握度低于 40% 口径 + 报告口径并列</span>}
      >
        {gaps.length === 0 ? (
          <p className="text-body-sm text-ink-soft">暂时没有明显缺口。</p>
        ) : (
          <div className="bp-tbl-wrap" {...revealItem}>
            <table className="bp-tbl">
              <caption>缺口 · 掌握度低于 40%（服务端口径）</caption>
              <thead>
                <tr>
                  <th scope="col">知识点</th>
                  <th scope="col" className="n">
                    掌握度
                  </th>
                  <th scope="col">档位</th>
                  <th scope="col">最近一次归因</th>
                  <th scope="col">出路</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((row) => (
                  <tr key={row.kp_id}>
                    <td data-label="知识点" className="text-ink">
                      {row.name}
                    </td>
                    <td data-label="掌握度" className="n">
                      {percent(row.mastery)}
                    </td>
                    <td data-label="档位">
                      <BandMark band={masteryBandOf(row.mastery)} showValue={false} size="sm" />
                    </td>
                    {/* 「完整可复制、打印不截断」（原型 anno③）：单元格不截断、可换行。
                        归因编号本身（原型是 ATTR-…）不在契约 #19 的字段里，故这一列
                        仍按既有语义给错误类型名（D5 文案照用）。 */}
                    <td data-label="最近一次归因" className="break-words text-ink-soft">
                      {row.error_type_last ? ERROR_TYPE_LABEL[row.error_type_last] : '—'}
                    </td>
                    <td data-label="出路">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <Link to="/chat" className="text-accent-ink hover:underline">
                          去补习
                        </Link>
                        <span aria-hidden="true" className="text-ink-soft">
                          ·
                        </span>
                        <Link
                          to={`/graph?path=${encodeURIComponent(row.kp_id)}`}
                          className="text-accent-ink hover:underline"
                        >
                          看先修链
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetBlock>

      {/* ⑥ 04 基线与复测对比（原型 L2967-2970） */}
      <SheetBlock
        no="04"
        title="基线与复测对比"
        right={mainResult ? <Badge tone="accent">{mainResult}</Badge> : null}
      >
        {accuracy.length === 0 ? (
          <EmptyState
            tag="NO DELTA"
            title="还没有基线与复测的对比"
            hint="先做一次基线测量，干预后再复测一次，这里就会出现变化。"
            action={
              <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
                去做基线测量
              </Link>
            }
          />
        ) : (
          <div className="bp-tbl-wrap" {...revealItem}>
            <table className="bp-tbl">
              <caption>逐知识点 ΔAccuracy（▲ 提升 / ▼ 回落 / 不可算）</caption>
              <thead>
                <tr>
                  <th scope="col">知识点</th>
                  <th scope="col" className="n">
                    基线
                  </th>
                  <th scope="col" className="n">
                    复测
                  </th>
                  <th scope="col" className="n">
                    ΔAccuracy
                  </th>
                  <th scope="col">说明</th>
                </tr>
              </thead>
              <tbody>
                {accuracy.map((row) => {
                  // 复测缺失（retest 为 null）：原型 anno② 与 D15b —— 写「不可算」并给原因，
                  // 不填 0、不画占位柱、不用破折号糊过去。
                  const na = row.retest === null;
                  return (
                    <tr key={row.kp_id}>
                      <td data-label="知识点" className="text-ink">
                        {kpName(row.kp_id)}
                      </td>
                      <td data-label="基线" className="n">
                        {percent(row.baseline)}
                      </td>
                      <td data-label="复测" className="n">
                        {na ? <span className="tok">尚无可用的数</span> : percent(row.retest)}
                      </td>
                      <td
                        data-label="ΔAccuracy"
                        className={cn(
                          'n',
                          row.delta === null ? '' : row.delta > 0 ? 'up' : 'down',
                        )}
                      >
                        {row.delta === null
                          ? '不可算'
                          : `${row.delta > 0 ? '▲ ' : '▼ '}${deltaPercent(row.delta)}`}
                      </td>
                      <td data-label="说明" className="text-ink-soft">
                        {row.delta === null
                          ? '这一项复测还没出题，算不出变化 —— 先补一次复测再回来对齐。'
                          : row.delta > 0
                            ? '复测高于基线'
                            : '复测低于基线，我们再看'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* 纸上专有行（原型 .print-only）：打印件脱屏传阅，主结果要自成一句。
            屏幕上同一信息已由区块右侧的 chip 承担，故屏幕侧隐藏（index.css）。 */}
        {mainResult ? <p className="print-only mt-2.5 border-l-2 border-line pl-3 text-body-sm text-ink-soft">主结果：{mainResult}</p> : null}
      </SheetBlock>

      {/* ⑦ 05 从缺口出发（原型 L2971-2973）。此前是 NextStepCard；内容语义（缺口最前者
          + 两条出路）并入本节，组件本身保留供未迁移页。
          data-print='hide'：屏幕上的路标，不该被印进报告（原型 .noprint）。 */}
      {gaps.length > 0 ? (
        <div data-print="hide">
          <SheetBlock no="05" title="从缺口出发">
            <div className="flex flex-wrap items-center gap-2.5" {...revealItem}>
              <Link to="/chat" className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="arrow" className="h-4 w-4" />
                去对话页补一补
              </Link>
              <Link to="/graph" className={cn(buttonVariants({ variant: 'secondary' }))}>
                看技能树
              </Link>
            </div>
            <p className="mt-3 max-w-[74ch] text-body-sm leading-relaxed text-ink-soft">
              缺口清单里排最前的是「{gaps[0]?.name ?? ''}」——去对话页把这处晃的地方补稳，
              学长会一次只给一小步，不直接抛答案；想先看它在先修链上的位置，去图谱页。
            </p>
          </SheetBlock>
        </div>
      ) : null}
    </>
  );
}
