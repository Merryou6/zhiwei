/**
 * 老师端 · 学生详情（v1.6）：五区一屏——
 *   ① 概览（掌握度日志 / 自报 / 测评 / 试卷 / 归因 / 平均掌握度 / 待巩固 / 已掌握 + 四档分布 + 近 7 日活跃）
 *   ② 缺口与推荐下发（缺口表 = 逐条「推给他」+ 附言表单 + 200 字计数）
 *   ③ 已下发（推荐台账 + ΔAccuracy 效果回流）
 *   ④ 最近答题原文（答卷/答题/错题原文，批改讲评必需；对话原文不下发）
 *   ⑤ 归因记录（表面知识点 → 根因 + 验证状态 + 路径链）
 *
 * 数据：#24 学生快照（服务端白名单序列化）；推荐下发 #25。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P11.3（2026-10-11 第 4 轮）：视觉层按原型
 * PAGES['teacher/student']（tempui/prototypes/style-10/index.html L3177-3245）逐段复现，
 * **业务逻辑一行不改**（load 的 studentId/spaceId 双参数判据与「链接缺少学生或空间参数」、
 * getTeacherStudent 取数、cancelled 无（本页为 setState 后调用 load 重取）、activeKpIds 的
 * assigned/viewed/in_progress 三态集合、handleAssign 的 busyKp 置位 → assignRecommendation
 * →toast→setNote('')→load() 顺序、失败 toast warn、finally 清 busyKp —— 全部逐字符原样）：
 *   ① 页头 SheetHead（原型 L3200）：eyebrow「STUDENT DOSSIER / 教学必需的摘要」+
 *      SHEET 10-16 + 需求 2.16 + h1「学生详情 · 昵称」+ 动态 sub（用户标识 / 空间 / 绑定于）+
 *      chip「T1」；页头归页面自有（D24：Layout 按 '/t/student/' 前缀登记，R18 特例）。
 *   ② 隐私声明（原型 L3204 的 `div.note`）：既有「教师端只提供教学必需的摘要与原文」口径，
 *      按原型位置移到页头之下常驻（迁移前在页尾，属视觉重排，见 D-P11.3-2）。
 *   ③ 01 概览（原型 L3205-3217）：八格 `.bp-measure`（两排四格）+ 四档分布条 `.dist` 制式
 *      （与 /report 02 / /me 01 同源）+ 近 7 日活跃（原型 chips；本工程 activity 带计数，
 *      故芯片写「MM-DD · N 条」，全 0 时按原型写「近 7 日无活跃」）。
 *   ④ 02 缺口与推荐下发 + 03 已下发（原型 `.split` 的正文列 + 栏位）：缺口表逐条「推给他」
 *      （既有交互），附言输入保留既有 maxLength=200，并按原型补**字数计数**。
 *      ⚠ 与原型差异：原型「附言为空时不可下发」，本工程附言自 v1.6 起即为**可选**
 *      （随下一次「推给他」一起发出）—— 属业务语义，按 3.1c 冻结不动，见 D-P11.3-1。
 *   ⑤ 04 最近答题原文 / 05 归因记录（原型 L3235-3244）：`.bp-tbl` 表制式；
 *      原型 05 末尾的「在归因页打开这条结果」是**新增导航**（教师端 → 学生端归因页），
 *      超出「只改视觉」，不迁移（同 P10.6 口径），见 D-P11.3-3。
 *
 * 【四态（规范 §7 teacher/student 行，页面级）】
 *   loading（!detail）→ SkeletonLines
 *   无学生 / 取不到（error 含服务端 403）→ 页面级 Stamp 红章 + 一条出路（回工作台）
 *   守卫分支顺序与迁移前一致（error 在前、loading 次之、数据态最后），见 3.1b。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { assignRecommendation, getTeacherStudent } from '../../api/endpoints';
import type { TeacherGapRow, TeacherStudentDetail as TeacherStudentDetailData } from '../../api/types';
import BandMark from '../../components/blueprint/BandMark';
import { useBlueprintTier } from '../../components/blueprint/Board';
import { Icon } from '../../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../../components/blueprint/Sheet';
import SkeletonLines from '../../components/blueprint/SkeletonLines';
import Stamp from '../../components/blueprint/Stamp';
import { Badge, Button, Input, buttonVariants } from '../../components/ui';
import { cn } from '../../lib/cn';
import { deltaPercent, formatTime, percent } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { BAND_ORDER } from '../../theme/bands';
import type { MasteryBand } from '../../theme/bands';

/** 图号与需求号（原型 sheetHead L3200 的 SHEET 10-16 / 需求 2.16）。 */
const SHEET_NO = '10-16';
const SECTION_NO = '2.16';
/** 附言上限（原型 recForm.noteMax = 200；与本工程既有输入 maxLength 同值）。 */
const NOTE_MAX = 200;

const REC_STATUS_BADGE: Record<
  string,
  { tone: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'outline'; label: string }
> = {
  assigned: { tone: 'neutral', label: '已下发' },
  viewed: { tone: 'accent', label: '已查看' },
  in_progress: { tone: 'accent', label: '进行中' },
  done: { tone: 'positive', label: '已完成' },
  dismissed: { tone: 'outline', label: '已搁置' },
  expired: { tone: 'warning', label: '已过期' },
};

/** 推荐台账行的完成时间（原型 03 的「完成 —」口径）。 */
function finishedAtOf(row: { finished_at: string | null }): string {
  return row.finished_at ? formatTime(row.finished_at) : '—';
}

/** 推荐下发行：缺口行内联的「推给他」动作（既有交互，只换制式）。 */
function GapRowView({
  gap,
  busy,
  recommended,
  onAssign,
}: {
  gap: TeacherGapRow;
  busy: boolean;
  recommended: boolean;
  onAssign: (gap: TeacherGapRow) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line/60 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-body-sm text-ink">{gap.name}</p>
        <p className="tok mt-0.5">
          掌握 <span className="num-mono text-ink">{percent(gap.mastery)}</span>
          {gap.error_type_last ? ` · 最近错因 ${gap.error_type_last}` : ''}
        </p>
      </div>
      {recommended ? (
        <Badge tone="accent">已推荐</Badge>
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => onAssign(gap)}>
          {busy ? '下发中…' : '推给他'}
        </Button>
      )}
    </div>
  );
}

export default function TeacherStudentDetail() {
  const { studentId = '' } = useParams();
  const [search] = useSearchParams();
  const spaceId = search.get('space_id') ?? '';
  const toast = useUiStore((state) => state.toast);
  const tier = useBlueprintTier();

  const [detail, setDetail] = useState<TeacherStudentDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKp, setBusyKp] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!studentId || !spaceId) {
      setError('链接缺少学生或空间参数');
      return;
    }
    try {
      setDetail(await getTeacherStudent(studentId, spaceId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '加载失败，请刷新重试');
    }
  }, [studentId, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKpIds = useMemo(
    () =>
      new Set(
        (detail?.recommendations ?? [])
          .filter((row) => ['assigned', 'viewed', 'in_progress'].includes(row.status))
          .map((row) => row.kp_id),
      ),
    [detail],
  );

  async function handleAssign(gap: TeacherGapRow): Promise<void> {
    if (!detail) return;
    setBusyKp(gap.kp_id);
    try {
      await assignRecommendation({ space_id: detail.student.space_id, kp_id: gap.kp_id, note });
      toast(`已把「${gap.name}」推给学生，他确认后开始补`);
      setNote('');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '下发失败', 'warn');
    } finally {
      setBusyKp(null);
    }
  }

  // ── 无学生 / 取不到（含服务端 403 兜底）：页面级红章 + 一条出路 ──
  if (error) {
    return (
      <>
        <SheetHead
          eyebrow="STUDENT DOSSIER / 教学必需的摘要"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="学生详情"
          sub="只显示教学必需的信息：掌握度摘要、缺口、最近答题原文与归因记录。"
          chips={<Badge tone="warning">T1</Badge>}
          dim={sheetDimText(tier)}
        />
        <Stamp
          seal="NO STUDENT"
          reason={`${error}。这条链接拿不到学生快照：可能是参数不全、学生已解绑，或你的身份取不到这份数据。`}
          alt={{ label: '回工作台', to: '/t' }}
        />
      </>
    );
  }

  // ── 加载态：骨架（静态发丝斜线，不 shimmer）──
  if (!detail) {
    return (
      <>
        <SheetHead
          eyebrow="STUDENT DOSSIER / 教学必需的摘要"
          sheetNo={SHEET_NO}
          section={SECTION_NO}
          title="学生详情"
          sub="正在翻这位学生的学习地图…"
          chips={<Badge tone="warning">T1</Badge>}
          dim={sheetDimText(tier)}
        />
        <SheetBlock no="01" title="概览">
          <SkeletonLines rows={4} block note="正在取学生快照 · 不伪造内容" />
        </SheetBlock>
      </>
    );
  }

  const { student, summary, activity, gaps, recent_answers, attributions, recommendations } = detail;
  const activeTotal = activity.reduce((sum, row) => sum + row.count, 0);
  const bandCount = (band: MasteryBand): number => summary.bands[band] ?? 0;

  return (
    <>
      {/* 页头（原型 sheetHead L3200）：h1 含学生昵称。**由页面自己渲染**（D24 前缀登记）。 */}
      <SheetHead
        eyebrow="STUDENT DOSSIER / 教学必需的摘要"
        sheetNo={SHEET_NO}
        section={SECTION_NO}
        title={`学生详情 · ${student.nickname ?? '未署名学生'}`}
        sub={
          <>
            用户标识 <span className="num-mono break-all">{student.student_id}</span> · 空间{' '}
            {student.space_name} · 绑定于 {formatTime(student.linked_at)}
          </>
        }
        chips={<Badge tone="warning">T1</Badge>}
        dim={sheetDimText(tier)}
      />

      <p className="bp-note mb-6">
        <Icon name="lock" className="mr-1 inline h-4 w-4 align-text-bottom" />
        学生确认数据边界后教师才看得到学习地图；这里只到答题过程为止，对话内容永远看不到。
      </p>

      {/* ── 01 概览（原型 L3205-3217）────────────────────────────────────── */}
      <SheetBlock no="01" title="概览" right={<Badge>{summary.kp_total} 个知识点</Badge>}>
        <div className="grid grid-cols-2 gap-3 sheet:grid-cols-4">
          <div className="bp-measure">
            <span className="tok">掌握度日志</span>
            <span className="big-num">{summary.mastery_log_count}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">自报</span>
            <span className="big-num">{summary.behavior.self_report ?? 0}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">测评</span>
            <span className="big-num">{summary.behavior.diagnose ?? 0}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">试卷</span>
            <span className="big-num">{summary.behavior.paper ?? 0}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sheet:grid-cols-4">
          <div className="bp-measure">
            <span className="tok">归因</span>
            <span className="big-num">{summary.behavior.attributions ?? 0}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">平均掌握度</span>
            <span className="big-num">{percent(summary.avg_mastery)}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">待巩固</span>
            <span className="big-num">{bandCount('待巩固')}</span>
          </div>
          <div className="bp-measure">
            <span className="tok">已掌握</span>
            <span className="big-num">{bandCount('已掌握')}</span>
          </div>
        </div>

        {/* 四档分布（与 /report 02、/me 01 同一套制式；色键取自 BAND_ORDER 序，不抄第四份）。 */}
        <div className="mt-4 flex flex-col gap-2.5">
          {BAND_ORDER.map((band) => {
            const n = bandCount(band);
            const bandKey = BAND_ORDER.indexOf(band) + 1;
            const share = summary.kp_total > 0 ? Math.round((n / summary.kp_total) * 100) : 0;
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
                  {n}
                </span>
              </div>
            );
          })}
        </div>

        {/* 近 7 日活跃（原型 chips；本工程 activity 带计数，芯片写「MM-DD · N 条」）。 */}
        <p className="bp-note mt-4 mb-0">
          <span className="tok block">最近 7 日活跃</span>
          {activeTotal === 0 ? (
            <span className="tok">近 7 日无活跃</span>
          ) : (
            <span className="mt-1 flex flex-wrap gap-1.5">
              {activity.map((row) => (
                <Badge key={row.date}>
                  {row.date.slice(5)} · {row.count}
                </Badge>
              ))}
            </span>
          )}
        </p>
      </SheetBlock>

      {/* ── 02 缺口与推荐下发 + 03 已下发（原型 L3218-3232 的 `.split`）────── */}
      <section className="mb-8 grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <SheetBlock
            no="02"
            title="缺口与推荐下发"
            right={<Badge>{gaps.length} 个缺口</Badge>}
            className="mb-0"
          >
            {gaps.length === 0 ? (
              <p className="bp-note mt-0">这位学生暂时没有明显缺口，不用催。</p>
            ) : (
              <div>
                {gaps.map((gap) => (
                  <GapRowView
                    key={gap.kp_id}
                    gap={gap}
                    busy={busyKp === gap.kp_id}
                    recommended={activeKpIds.has(gap.kp_id)}
                    onAssign={(row) => void handleAssign(row)}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-line pt-3">
              {/* 【P2 附言时点】注明随下一次「推给他」一起发出：老师不会误以为填了就立刻送达
                  （实现上 handleAssign 读当下 note 后清空，语义以此为准） */}
              <label htmlFor="teacher-note" className="tok block">
                附言（可选，将随下一次「推给他」一起发出，学生会看到）
              </label>
              <Input
                id="teacher-note"
                value={note}
                maxLength={NOTE_MAX}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例：先把平移三步走顺，再回来做复测"
                className="mt-1.5"
              />
              {/* 字数计数（原型 recForm 的 aria-live 位）：本工程附言可选，故只报数不拦提交。 */}
              <span className="tok mt-1 block" aria-live="polite">
                {note.length} / {NOTE_MAX} 字
                {note.length >= NOTE_MAX ? ' · 已到上限，需删减后才能再加字' : ''}
              </span>
            </div>
          </SheetBlock>
        </div>

        <aside className="min-w-0">
          <SheetBlock
            no="03"
            title="已下发"
            right={<Badge>{recommendations.length} 条</Badge>}
            className="mb-0"
          >
            {recommendations.length === 0 ? (
              <p className="bp-note mt-0">还没给这位学生下发过推荐。</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {recommendations.map((rec) => {
                  const badge = REC_STATUS_BADGE[rec.status] ?? REC_STATUS_BADGE.assigned;
                  return (
                    <li key={rec.recommendation_id} className="border-b border-dashed border-line/60 pb-2.5 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                        <span className="text-body-sm text-ink">{rec.kp_name}</span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-ui-sm">
                        {rec.delta_accuracy !== null ? (
                          <span
                            className={cn(
                              'num-mono tabular-nums',
                              rec.delta_accuracy >= 0 ? 'text-band-mastered' : 'text-band-weak',
                            )}
                          >
                            {rec.delta_accuracy >= 0 ? '▲ ' : '▼ '}Δ {deltaPercent(rec.delta_accuracy)}
                          </span>
                        ) : (
                          <span className="tok">回执尚未产生</span>
                        )}
                        <span className="tok">
                          完成 <span className="num-mono">{finishedAtOf(rec)}</span> · 下发{' '}
                          <span className="num-mono">{formatTime(rec.created_at)}</span>
                        </span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </SheetBlock>
        </aside>
      </section>

      {/* ── 04 最近答题原文（原型 L3235-3241）────────────────────────────── */}
      <SheetBlock
        no="04"
        title="最近答题原文"
        right={<Badge>供批改讲评 · 不含对话内容</Badge>}
      >
        {recent_answers.length === 0 ? (
          <p className="bp-note mt-0">还没有测评或试卷记录。</p>
        ) : (
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">知识点</th>
                  <th scope="col">来源</th>
                  <th scope="col">判定</th>
                  <th scope="col">学生原答</th>
                  <th scope="col">错误码</th>
                </tr>
              </thead>
              <tbody>
                {recent_answers.map((row, index) => (
                  <tr key={`${row.created_at}:${row.item_id ?? index}`}>
                    <td data-label="时间" className="num-mono">
                      {formatTime(row.created_at)}
                    </td>
                    <td data-label="知识点" className="text-ink">
                      {row.kp}
                    </td>
                    <td data-label="来源">{row.source === 'paper' ? '试卷' : row.mode ? '测评' : '证据'}</td>
                    <td data-label="判定">
                      <Badge tone={row.result === 'correct' ? 'positive' : 'negative'}>
                        {row.result === 'correct' ? '对' : '错'}
                      </Badge>
                    </td>
                    <td data-label="学生原答">
                      <span className="block truncate" title={row.student_answer ?? ''}>
                        {row.student_answer ?? '—'}
                      </span>
                    </td>
                    <td data-label="错误码" className="num-mono">
                      {row.matched_error_code ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetBlock>

      {/* ── 05 归因记录（原型 L3242-3244）────────────────────────────────── */}
      <SheetBlock no="05" title="归因记录" right={<Badge>{attributions.length} 条</Badge>}>
        {attributions.length === 0 ? (
          <p className="bp-note mt-0">还没有归因记录。</p>
        ) : (
          <>
            <div className="bp-tbl-wrap">
              <table className="bp-tbl">
                <thead>
                  <tr>
                    <th scope="col">表面知识点</th>
                    <th scope="col">根因</th>
                    <th scope="col">验证状态</th>
                    <th scope="col">路径链</th>
                  </tr>
                </thead>
                <tbody>
                  {attributions.map((row) => (
                    <tr key={row.attribution_id}>
                      <td data-label="表面知识点">{row.from_kp}</td>
                      <td data-label="根因" className="text-ink">
                        {row.root_cause}
                      </td>
                      <td data-label="验证状态">
                        <Badge tone={row.verified ? 'positive' : 'warning'}>
                          {row.verified ? '已验证' : '待验证'}
                        </Badge>
                      </td>
                      <td data-label="路径链" className="num-mono text-caption">
                        {row.path.join(' ← ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tok mt-2">
              根因链已翻译成知识点名；归因时间见学生自己的归因页
              （<span className="num-mono">{formatTime(attributions[0].created_at)}</span> 起）。
            </p>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link to="/t" className={cn(buttonVariants({ variant: 'secondary' }))}>
            <Icon name="arrow" />
            回工作台
          </Link>
        </div>
      </SheetBlock>
    </>
  );
}
