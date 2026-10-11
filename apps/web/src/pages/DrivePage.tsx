/**
 * 页 10 · 云盘（P1）
 *
 * 契约：#5 GET /api/space/{space_id}/drive（预置课标 / 教材 + 用户文件；本地形态用户文件恒为空）
 *       #19 GET /api/report/summary（复用缺口数据，把资料和学生的薄弱章节挂钩）
 *
 * 2026-10-08 用户走查改造（「两个文件 + 一个禁用按钮」对学生没有价值）：
 *   - 新增「和你正在补的内容」区块：缺口知识点 → 章节（graphSnapshot）→ 对应资料
 *     （一元二次方程 / 二次函数 → 人教版九上；其余章节 → 课标工具书）；
 *     映射是**确定性关键词规则**、纯前端计算，不伪造"已读教材进度"之类的假数据；
 *   - 无缺口时引导先测评（数据长出来之前不硬推资料，D12 不伪造）；
 *   - 文件列表、上传禁用占位保持原样。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.6（2026-10-11 第 4 轮）：视觉层按原型 PAGES.library
 * （tempui/prototypes/style-10/index.html L2990-3028）逐段复现，**业务逻辑一行不改**
 * （drive / reportSummary 两个取数、缺口→资料的 relevance 确定性映射、无缺口引导、
 * 只读语义、禁用入口语义、navigate 目标全部原样）：
 *   ① 页头 SheetHead（原型 L3005）：eyebrow「LIBRARY / 只读资料」+ SHEET 10-13 +
 *      需求 2.13 + h1「云盘 · 与正在补的内容挂钩」+ chip「T2 · 只读」；页头归页面自有
 *      （D24：Layout 登记 '/drive'）。无空间分支走原型 L2994 的另一份 sheetHead
 *      （h1「云盘」+ chip「T2」）。
 *   ② 01 预置教材文件（原型 L3007-3011）：计数 chip + `.bp-tbl`（文件名 / 类型 / 大小 /
 *      操作「只读」徽标）+ 区域级四态（loading→SkeletonLines；empty→EmptyState；
 *      error→Stamp 红章 + 真重试）。
 *   ③ 02 与当前缺口相关（原型 L3012-3018 的 `.split` 左栏）：本工程既有 relevance 是
 *      「文件 → 你正在补的缺口名」的确定性映射，按原型 panel 制式列相关文件；缺口为空
 *      时不渲染（既有语义：relevant 只在有缺口时出现）。
 *   ④ 03 自定义知识库（原型 L3019-3022 的 `.split` 右栏）：既有禁用入口的制式化——
 *      禁用 Button + 原因说明 + 「规划中 · 与『只读』区分」旁注（原型 anno ② 正文口径）。
 *   ⑤ 04 没有缺口时（原型 L3023-3024）：既有「还没有能把资料和你挂钩的数据」引导，
 *      按原型分节制式呈现，带「去做几道题」出路。
 *
 * 原型 02 的两颗按钮（「分步练一道」→ /practice?chapter=… 、「看先修链」→ /graph?path=…）
 * 不迁移：本工程既有 /drive 没有这两条动作，补上即是新增导航语义（超出「只改视觉」）。
 * 见执行报告 D-P10.6-1。
 *
 * 【四态（规范 §7 library 行，区域级）】
 *   loading → SkeletonLines（静态发丝斜线，不 shimmer）
 *   empty（0 个文件）→ EmptyState 虚线空盒 + 回空间页出路
 *   error（列表取不到）→ Stamp 红章 + **真重试**（重发同一个 drive() 请求）
 *   noSpace 提示 → 原型 L2994 分支；本工程 guardPath 对 /drive 会先重定向到 /spaces
 *     （router.tsx L120-121，R19 口径），故该分支不可直接导航取到 —— 保留为防御分支。
 *
 * 【D15c 同口径的最小新增（表现层，留痕）】`loadFailed` 的置位 / 复位写在**既有**取数
 *   effect 的 catch 与成功分支内；接口调用、cancelled 清理、依赖数组 [activeSpaceId]、
 *   Promise.all 结构逐字符未动（与 P6 /report、P9.2 /paper、P9.4 /attribution 同口径）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../api/client';
import { drive, reportSummary } from '../api/endpoints';
import type { DriveFileView, ReportSummaryData } from '../api/types';
import { GRAPH_NODES } from '../data/graphSnapshot';
import { useBlueprintTier } from '../components/blueprint/Board';
import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import Stamp from '../components/blueprint/Stamp';
import EmptyState from '../components/EmptyState';
import { Badge, Button, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import { fileSize } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACES_PATH } from '../router';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/** 人教版九年级上册覆盖的章节（初中数学主线；其余章节回落到课标工具书）。 */
const GRADE9_CHAPTERS = new Set(['一元二次方程', '二次函数']);

/** 图号与需求号（原型 sheetHead L3005 的 SHEET 10-13 / 需求 2.13）。 */
const SHEET_NO = '10-13';
const SECTION_NO = '2.13';

interface FileRelevance {
  fileId: string;
  /** 关联的缺口知识点名（最多取 3 个展示）。 */
  relatedNames: string[];
}

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFileView[]>([]);
  const [report, setReport] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  /** 文件列表这一次没取到（区域级红章依据，见文件头「D15c 同口径的最小新增」）。 */
  const [loadFailed, setLoadFailed] = useState(false);

  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);
  const tier = useBlueprintTier();

  useEffect(() => {
    if (!activeSpaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [driveData, summaryData] = await Promise.all([
          drive(activeSpaceId),
          reportSummary(activeSpaceId).catch(() => null), // 报告失败不拖垮文件列表
        ]);
        if (!cancelled) {
          setFiles(driveData.files);
          setReport(summaryData);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadFailed(true);
          toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpaceId]);

  /** 缺口 → 资料关联（确定性规则：缺口知识点 → 章节 → 册次匹配的文件）。 */
  const relevance = useMemo<FileRelevance[]>(() => {
    const gaps = report?.gaps ?? [];
    if (gaps.length === 0 || files.length === 0) return [];
    const chapterOf = new Map(GRAPH_NODES.map((node) => [node.id, node.chapter]));

    const textbook = files.find((file) => file.name.includes('九年级上册'));
    const syllabus = files.find((file) => file.name.includes('课程标准')) ?? files[0];

    const grade9Names: string[] = [];
    const otherNames: string[] = [];
    for (const gap of gaps) {
      const chapter = chapterOf.get(gap.kp_id) ?? '';
      if (GRADE9_CHAPTERS.has(chapter)) grade9Names.push(gap.name);
      else otherNames.push(gap.name);
    }

    const result: FileRelevance[] = [];
    if (textbook && grade9Names.length > 0) {
      result.push({ fileId: textbook.file_id, relatedNames: grade9Names.slice(0, 3) });
    }
    if (syllabus && otherNames.length > 0) {
      result.push({ fileId: syllabus.file_id, relatedNames: otherNames.slice(0, 3) });
    }
    return result;
  }, [files, report]);

  /** 页头（原型 sheetHead L3005）。**由页面自己渲染**（Layout 的 PAGE_OWNED_HEAD，D24）。 */
  const pageHead = (
    <SheetHead
      eyebrow="LIBRARY / 只读资料"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="云盘 · 与正在补的内容挂钩"
      sub="这一页只读：不做上传、不做删除。价值在把「正在补的缺口」映射回教材章节。"
      chips={<Badge>T2 · 只读</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  // ============================================================ 无空间：原型 L2994 分支
  // guardPath 对 /drive 会先重定向到 /spaces（R19），故这一支是防御分支，不可直接导航取到。
  if (!activeSpaceId) {
    return (
      <>
        <SheetHead
          eyebrow="LIBRARY / 只读资料"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="云盘"
          sub="预置教材文件，与当前学习缺口关联。"
          chips={<Badge>T2</Badge>}
          dim={sheetDimText(tier)}
        />
        <SheetBlock no="01" title="空状态">
          <EmptyState
            tag="NO SPACE"
            title="还没有空间"
            hint="先选一个学习空间，我再告诉你这个学科有哪些资料。"
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="plus" />
                去建空间
              </Link>
            }
          />
        </SheetBlock>
      </>
    );
  }

  const hasNoGap = relevance.length === 0 && (report?.gaps ?? []).length === 0 && !loading;

  return (
    <>
      {pageHead}

      {/* ── 01 预置教材文件（原型 L3007-3011）────────────────────────────── */}
      <SheetBlock
        no="01"
        title="预置教材文件"
        right={<Badge>{files.length > 0 ? `${files.length} 个文件` : '暂无文件'}</Badge>}
      >
        {loading ? (
          <SkeletonLines rows={2} note="正在取文件列表…" />
        ) : loadFailed ? (
          // 错误态口径按原型 L3011：红章说明「失败的是什么」+ 一条出路（回报告页）。
          // **不提供重试**：原型 stateBlock 的 errAlt 是换个入口，不是真重试；本页取数
          // effect 依赖 [activeSpaceId] 逐字符冻结（3.1a），页面内没法在不复制取数逻辑的
          // 前提下重发同一请求——故按原型只给出路（见执行报告 D-P10.6-2）。
          <Stamp
            reason="资料列表取数失败。红章表示请求没回来，和「库里没有文件」是两件事。"
            alt={{ label: '回报告页', to: '/report' }}
          />
        ) : files.length === 0 ? (
          <EmptyState
            tag="NO FILE"
            title="这里还没有资料"
            hint="云盘是预置演示库，为空时说明这个空间还没挂上教材包。"
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="swap" />
                回空间页
              </Link>
            }
          />
        ) : (
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <caption>教材 · 讲义 · 文档</caption>
              <thead>
                <tr>
                  <th scope="col">文件名</th>
                  <th scope="col">类型</th>
                  <th scope="col">大小</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.file_id}>
                    <td data-label="文件名" className="text-ink">
                      {/* break-all（R6）：file_id 是无空格长串，窄档转卡片后仍要能断行 */}
                      <span className="block truncate">{file.name}</span>
                      <span className="tok block break-all">{file.file_id}</span>
                    </td>
                    <td data-label="类型" className="num-mono">
                      {file.type.toUpperCase()}
                    </td>
                    <td data-label="大小" className="n">
                      {fileSize(file.size)}
                    </td>
                    <td data-label="操作">
                      <Badge>
                        <Icon name="eye" className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                        只读
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetBlock>

      {/* ── 02 与当前缺口相关 + 03 自定义知识库（原型 L3012-3022 的 `.split`）── */}
      <section className="mb-8 grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          {relevance.length > 0 ? (
            <SheetBlock
              no="02"
              title="与当前缺口相关"
              right={<Badge tone="accent">跟着缺口走</Badge>}
              className="mb-0"
            >
              <p className="bp-note mt-0">按你报告里的缺口挑的——先看这些，别整本翻。</p>
              <ul className="flex flex-col gap-2.5">
                {relevance.map((entry) => {
                  const file = files.find((item) => item.file_id === entry.fileId);
                  if (!file) return null;
                  return (
                    <li key={entry.fileId} className="bp-panel p-3">
                      <p className="truncate text-body-sm text-ink">{file.name}</p>
                      <p className="tok mt-1">
                        涉及你正在补的：
                        {entry.relatedNames.map((name, index) => (
                          <span key={name}>
                            {index > 0 ? '、' : ''}
                            <span className="text-ink">{name}</span>
                          </span>
                        ))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </SheetBlock>
          ) : null}
        </div>

        <aside className="min-w-0">
          <SheetBlock no="03" title="自定义知识库" className="mb-0">
            <p className="bp-note mt-0">{UI_TEXT.driveComingSoon}：入口还在规划中，不做成能点的按钮。</p>
            <Button
              variant="secondary"
              disabled
              title={UI_TEXT.driveComingSoon}
              onClick={() => toast(UI_TEXT.driveComingSoon)}
              className="w-full"
            >
              <Icon name="plus" />
              上传自定义知识库（P1）
            </Button>
            <p className="tok mt-2">state = 规划中 · 与「只读」区分：只读内容仍可看，这里是真的不可操作。</p>
          </SheetBlock>
        </aside>
      </section>

      {/* ── 04 没有缺口时（原型 L3023-3024）────────────────────────────── */}
      {hasNoGap && files.length > 0 ? (
        <SheetBlock no="04" title="没有缺口时">
          <p className="text-body-sm leading-relaxed text-ink-soft">
            还没有能把资料和你挂钩的数据。先去做几道题，我就能按你的缺口告诉你先看哪份资料。
          </p>
          <div className="mt-3">
            <Link to="/assessment" className={cn(buttonVariants({ variant: 'secondary' }))}>
              <Icon name="target" />
              去做几道题
            </Link>
          </div>
        </SheetBlock>
      ) : null}
    </>
  );
}
