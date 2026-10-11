/**
 * 老师端 · 推荐管理（v1.6）：全部下发的推荐 + 闭环状态。
 *
 * 「效果」列读 delta_accuracy——它由复测闭环自动回写（diagnose 服务钩子），
 * 老师看到的不是「我布置过」，而是「布置了、做了、提升了多少」。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P11.4（2026-10-11 第 4 轮）：视觉层按原型
 * PAGES['teacher/recommendations']（tempui/prototypes/style-10/index.html L3246-3305）
 * 逐段复现，**业务逻辑一行不改**（load 的 Promise.all([listTeacherRecommendations,
 * listTeacherStudents])、成功清 loadError、失败保留 rows 原状（不吞进空态）、
 * handleRetry 的 retrying 置位/清位、nicknameOf 的 student_id → 昵称查找 ——
 * 全部逐字符原样）：
 *   ① 页头 SheetHead（原型 L3266）：eyebrow「RECOMMENDATION OPS / 全生命周期」+
 *      SHEET 10-17 + 需求 2.17 + h1「推荐管理」+ 动态 sub（原型口径「共 N 条推荐，
 *      其中 M 条已由复测验证效果」）+ chip「T2」；页头归页面自有（D24：Layout 登记
 *      '/t/recommendations'）。
 *   ② 01 汇总（原型 L3269-3272）：三格 `.bp-measure`（推荐总数 / 已验证效果 / 状态口径）
 *      —— 原型第四格「本页台账」在本工程与「推荐总数」**恒等**（#26 一次返回我的全部
 *      推荐，无分页），故不重复画两格同值（见 D-P11.4-2）+ 闭环说明 `.bp-note`。
 *   ③ 02 台账（原型 L3273-3291）：`.bp-tbl` 七列（知识点 / 目标学生 / 附言 / 下发时间 /
 *      完成时间 / 效果回执 / 状态六态 chip）；效果回执按原型「▲ / ▼ 文字 + 不可算」口径。
 *      区域级四态：loading → SkeletonLines；empty → EmptyState（闭环讲一遍 + 一条出路）；
 *      error（含服务端 403）→ Stamp 红章 + **真重试**。守卫分支顺序与迁移前一致（3.1b）。
 *      ⚠ 原型 02 顶部的「六态筛选条」是**新增交互**（本页迁移前无筛选），不迁移；
 *        六态闭集改由 03 状态口径逐条列全（原型 anno ① 的语义由此承担），见 D-P11.4-1。
 *   ④ 03 状态口径（原型 L3292-3294）：六态清单 + 「回执只在已完成 + 做过复测时出现」
 *      的既有口径说明。
 *
 * 【生命周期状态机】六态标签取自本工程 RecommendationStatus（assigned / viewed /
 *   in_progress / done / dismissed / expired），与既有 REC_STATUS_BADGE 同源，不新增状态。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { listTeacherRecommendations, listTeacherStudents } from '../../api/endpoints';
import type { RecommendationStatus, TeacherRecommendation, TeacherStudentCard } from '../../api/types';
import { useBlueprintTier } from '../../components/blueprint/Board';
import { Icon } from '../../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../../components/blueprint/Sheet';
import SkeletonLines from '../../components/blueprint/SkeletonLines';
import Stamp from '../../components/blueprint/Stamp';
import EmptyState from '../../components/EmptyState';
import { Badge, buttonVariants } from '../../components/ui';
import { cn } from '../../lib/cn';
import { deltaPercent, formatTime } from '../../lib/format';

/** 图号与需求号（原型 sheetHead L3266 的 SHEET 10-17 / 需求 2.17）。 */
const SHEET_NO = '10-17';
const SECTION_NO = '2.17';

/** 六态闭集（顺序 = 生命周期顺序；与 api/types.ts 的 RecommendationStatus 同源）。 */
const STATUS_ORDER: readonly RecommendationStatus[] = [
  'assigned',
  'viewed',
  'in_progress',
  'done',
  'dismissed',
  'expired',
] as const;

const STATUS_BADGE: Record<
  RecommendationStatus,
  { tone: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'outline'; label: string }
> = {
  assigned: { tone: 'neutral', label: '已下发' },
  viewed: { tone: 'accent', label: '已查看' },
  in_progress: { tone: 'accent', label: '进行中' },
  done: { tone: 'positive', label: '已完成' },
  dismissed: { tone: 'outline', label: '已搁置' },
  expired: { tone: 'warning', label: '已过期' },
};

export default function TeacherRecommendations() {
  const tier = useBlueprintTier();
  const [rows, setRows] = useState<TeacherRecommendation[] | null>(null);
  const [students, setStudents] = useState<TeacherStudentCard[]>([]);
  // 【P2 失败与空态可区分】加载失败不再吞进「暂无推荐」空态：常驻错误 + 重试
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recRes, studentRes] = await Promise.all([
        listTeacherRecommendations(),
        listTeacherStudents(),
      ]);
      setRows(recRes.recommendations);
      setStudents(studentRes.students);
      // 成功即清错误态（重试通过后要回到正常渲染）
      setLoadError(null);
    } catch (error) {
      // 【P2】失败时保留 rows 原状（首载仍为 null），由错误卡接管渲染，不再 setRows([])
      setLoadError(error instanceof ApiError ? error.message : '加载失败，请刷新重试');
    }
  }, []);

  /** 【P2】错误卡内的重试入口：期间禁用按钮。 */
  async function handleRetry(): Promise<void> {
    setRetrying(true);
    try {
      await load();
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const nicknameOf = (studentId: string) =>
    students.find((card) => card.student_id === studentId)?.nickname ?? '学生';

  /** 页头（原型 sheetHead L3266）。**由页面自己渲染**（Layout 的 PAGE_OWNED_HEAD，D24）。 */
  const pageHead = (
    <SheetHead
      eyebrow="RECOMMENDATION OPS / 全生命周期"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="推荐管理"
      sub={
        rows === null
          ? '正在整理推荐记录…'
          : rows.length === 0
            ? '还没有下发给学生的推荐——去工作台打开学生详情，从缺口里选一个推给他。'
            : `全部下发记录的台账：共 ${rows.length} 条推荐。`
      }
      chips={<Badge tone="warning">T2</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  // ── 失败态（含服务端 403 兜底）：红章 + 真重试（区域级 02 台账位）──
  if (loadError) {
    return (
      <>
        {pageHead}
        <SheetBlock no="02" title="台账" right={<Badge>取数失败</Badge>}>
          <Stamp
            seal="LEDGER FETCH"
            reason={`${loadError}。台账取数失败。它和「一条推荐都没下发过」不同：请看红章，重试即可。`}
            onRetry={() => void handleRetry()}
            retrying={retrying}
            alt={{ label: '回教师工作台', to: '/t' }}
          />
        </SheetBlock>
      </>
    );
  }

  // ── 加载态：骨架（静态发丝斜线，不 shimmer）──
  if (rows === null) {
    return (
      <>
        {pageHead}
        <SheetBlock no="01" title="汇总">
          <SkeletonLines rows={3} block note="正在整理推荐记录 · 不伪造内容" />
        </SheetBlock>
      </>
    );
  }

  const doneRows = rows.filter((row) => row.status === 'done' && row.delta_accuracy !== null);

  return (
    <>
      {pageHead}

      {/* ── 01 汇总（原型 L3269-3272）────────────────────────────────────── */}
      <SheetBlock no="01" title="汇总">
        <div className="grid grid-cols-2 gap-3 sheet:grid-cols-3">
          <div className="bp-measure">
            <span className="tok">推荐总数</span>
            <span className="big-num">{rows.length}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">已验证效果</span>
            <span className="big-num">{doneRows.length}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">状态口径</span>
            <span className="big-num">{STATUS_ORDER.length}</span>
          </div>
        </div>
        <p className="bp-note">
          推荐是一条闭环：下发 → 学生查看 → 开始补 → 复测后这里会自动记下 ΔAccuracy。
        </p>
      </SheetBlock>

      {/* ── 02 台账（原型 L3273-3291）────────────────────────────────────── */}
      <SheetBlock no="02" title="台账" right={<Badge>共 {rows.length} 条</Badge>}>
        {rows.length === 0 ? (
          <EmptyState
            tag="LEDGER EMPTY"
            title="还没有下发过推荐"
            hint="闭环是这样的：下发 → 学生查看 → 开始补 → 复测后自动记下效果。现在一条都没有，所以台账是空的。"
            action={
              <Link to="/t" className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="target" />
                去学生详情下发
              </Link>
            }
          />
        ) : (
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <thead>
                <tr>
                  <th scope="col">知识点</th>
                  <th scope="col">目标学生</th>
                  <th scope="col">附言</th>
                  <th scope="col" className="n">
                    下发时间
                  </th>
                  <th scope="col" className="n">
                    完成时间
                  </th>
                  <th scope="col" className="n">
                    效果回执
                  </th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.assigned;
                  const positive = row.delta_accuracy !== null && row.delta_accuracy >= 0;
                  return (
                    <tr key={row.recommendation_id}>
                      <td data-label="知识点" className="text-ink">
                        {row.kp_name}
                      </td>
                      <td data-label="目标学生">{nicknameOf(row.student_id)}</td>
                      <td data-label="附言">
                        {row.note ? (
                          <span className="block truncate" title={row.note}>
                            {row.note}
                          </span>
                        ) : (
                          <span className="tok">无附言</span>
                        )}
                      </td>
                      <td data-label="下发时间" className="n num-mono">
                        {formatTime(row.created_at)}
                      </td>
                      <td data-label="完成时间" className="n num-mono">
                        {row.finished_at ? formatTime(row.finished_at) : <span className="tok">未完成</span>}
                      </td>
                      <td
                        data-label="效果回执"
                        className={cn(
                          'n num-mono',
                          row.delta_accuracy !== null && (positive ? 'up' : 'down'),
                        )}
                      >
                        {row.delta_accuracy !== null ? (
                          `${positive ? '▲' : '▼'} Δ ${deltaPercent(row.delta_accuracy)}`
                        ) : (
                          <span className="tok">不可算 · 还没复测</span>
                        )}
                      </td>
                      <td data-label="状态">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SheetBlock>

      {/* ── 03 状态口径（原型 L3292-3294）────────────────────────────────── */}
      <SheetBlock no="03" title="状态口径" right={<Badge>六态闭集</Badge>}>
        <ul className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((status) => (
            <li key={status}>
              <Badge tone={STATUS_BADGE[status].tone}>{STATUS_BADGE[status].label}</Badge>
            </li>
          ))}
        </ul>
        <p className="bp-note">
          回执只在「已完成 + 做过复测」时出现；没有复测就写不可算，不编数值。
        </p>
        <p className="tok">
          <Link to="/t" className="text-accent-ink hover:underline">
            回工作台看学生卡片 →
          </Link>
        </p>
      </SheetBlock>
    </>
  );
}
