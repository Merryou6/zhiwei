/**
 * 老师端 · 学生详情（v1.6）：四区一屏——
 *   ① 概览（四状态带 + 行为计数 + 7 日活跃）
 *   ② 掌握度与缺口（缺口行 = 推荐下发入口）
 *   ③ 最近答题原文（答卷/答题/错题原文，批改讲评必需；对话原文不下发）
 *   ④ 归因与推荐（推荐状态机 + ΔAccuracy 效果回流）
 *
 * 数据：#24 学生快照（服务端白名单序列化）；推荐下发 #25。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { assignRecommendation, getTeacherStudent } from '../../api/endpoints';
import type { TeacherGapRow, TeacherStudentDetail } from '../../api/types';
import PageSkeleton from '../../components/PageSkeleton';
import { Badge, Button, Card, CardTitle } from '../../components/ui';
import { cn } from '../../lib/cn';
import { deltaPercent, formatTime, percent } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { BAND_ORDER, bandVeilHex } from '../../theme/bands';
import type { MasteryBand } from '../../theme/bands';

const REC_STATUS_BADGE: Record<string, { tone: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'outline'; label: string }> = {
  assigned: { tone: 'neutral', label: '已下发' },
  viewed: { tone: 'accent', label: '已查看' },
  in_progress: { tone: 'accent', label: '进行中' },
  done: { tone: 'positive', label: '已完成' },
  dismissed: { tone: 'outline', label: '已搁置' },
  expired: { tone: 'warning', label: '已过期' },
};

/** 一块可折叠语义区标题。 */
function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <CardTitle>{children}</CardTitle>
      {hint ? <span className="text-ui-sm text-ink-soft">{hint}</span> : null}
    </div>
  );
}

/** 推荐下发行：缺口行内联的「推给学生」动作。 */
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
    <div className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{gap.name}</p>
        <p className="text-ui-sm text-ink-soft">
          掌握 {percent(gap.mastery)}
          {gap.error_type_last ? ` · 最近错因 ${gap.error_type_last}` : ''}
        </p>
      </div>
      {recommended ? (
        <Badge tone="accent">已推荐</Badge>
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => onAssign(gap)}>
          推给他
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

  const [detail, setDetail] = useState<TeacherStudentDetail | null>(null);
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

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/t" className="text-ui-sm text-ink-soft hover:text-ink">
          ← 回工作台
        </Link>
        <Card>
          <p className="py-6 text-center text-sm text-ink-soft">{error}</p>
        </Card>
      </div>
    );
  }

  if (!detail) {
    return <PageSkeleton label="正在翻这位学生的学习地图…" rows={4} />;
  }

  const { student, summary, activity, gaps, recent_answers, attributions, recommendations } = detail;
  const maxActivity = Math.max(1, ...activity.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/t" className="text-ui-sm text-ink-soft hover:text-ink">
            ← 回工作台
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-ink">
            {student.nickname ?? '未署名学生'} · {student.space_name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            平均掌握 {percent(summary.avg_mastery)} · {summary.kp_total} 个知识点 · 绑定于{' '}
            {formatTime(student.linked_at)}
          </p>
        </div>
      </div>

      {/* ① 概览 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint={`掌握度日志 ${summary.mastery_log_count} 条`}>掌握度分布</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {BAND_ORDER.map((band: MasteryBand) => (
              <span
                key={band}
                className="rounded-md px-2.5 py-1 text-sm text-ink"
                style={{ backgroundColor: bandVeilHex(band) }}
              >
                {band}{' '}
                <span className="font-mono tabular-nums text-ink-soft">
                  {summary.bands[band] ?? 0}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-ui-sm text-ink-soft">学习行为（累计）</p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-ink-soft">
              <span>自报 {summary.behavior.self_report ?? 0}</span>
              <span>测评 {summary.behavior.diagnose ?? 0}</span>
              <span>试卷 {summary.behavior.paper ?? 0}</span>
              <span>归因 {summary.behavior.attributions ?? 0}</span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="最近 7 天">学习活跃</SectionTitle>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {activity.map((row) => (
              <div key={row.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-accent-veil"
                  style={{ height: `${Math.max(4, (row.count / maxActivity) * 72)}px` }}
                  title={`${row.date} · ${row.count} 条证据`}
                />
                <span className="text-caption text-ink-soft">{row.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ② 缺口 + 推荐下发 */}
      <Card>
        <SectionTitle hint="选一个缺口推给学生，学生确认后开始补">缺口与推荐</SectionTitle>
        {gaps.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">这位学生暂时没有明显缺口，不用催。</p>
        ) : (
          <div className="mt-2">
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
          <label htmlFor="teacher-note" className="text-ui-sm text-ink-soft">
            附一句话说明（可选，将随下一次「推给他」一起发出，学生会看到）
          </label>
          <input
            id="teacher-note"
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例：先把平移三步走顺，再回来做复测"
            className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </div>

        {recommendations.length > 0 ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-ui-sm text-ink-soft">推荐记录</p>
            <ul className="mt-2 space-y-2">
              {recommendations.map((rec) => {
                const badge = REC_STATUS_BADGE[rec.status] ?? REC_STATUS_BADGE.assigned;
                return (
                  <li
                    key={rec.recommendation_id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-ink">{rec.kp_name}</span>
                    <span className="flex items-center gap-2">
                      {rec.delta_accuracy !== null ? (
                        <span
                          className={cn(
                            'font-mono text-ui-sm tabular-nums',
                            rec.delta_accuracy >= 0 ? 'text-band-mastered' : 'text-band-weak',
                          )}
                        >
                          Δ {deltaPercent(rec.delta_accuracy)}
                        </span>
                      ) : null}
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                      <span className="text-ui-sm text-ink-soft">{formatTime(rec.created_at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* ③ 最近答题原文 */}
      <Card>
        <SectionTitle hint="批改讲评用 · 不含对话内容">最近答题原文</SectionTitle>
        {recent_answers.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有测评或试卷记录。</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-ui-sm text-ink-soft">
                  <th className="py-1 font-normal">时间</th>
                  <th className="py-1 font-normal">知识点</th>
                  <th className="py-1 font-normal">来源</th>
                  <th className="py-1 font-normal">结果</th>
                  <th className="py-1 font-normal">学生原答</th>
                  <th className="py-1 font-normal">错误码</th>
                </tr>
              </thead>
              <tbody>
                {recent_answers.map((row, index) => (
                  <tr key={`${row.created_at}:${row.item_id ?? index}`} className="border-t border-line">
                    <td className="py-2 text-ink-soft">{formatTime(row.created_at)}</td>
                    <td className="py-2 text-ink">{row.kp}</td>
                    <td className="py-2 text-ink-soft">
                      {row.source === 'paper' ? '试卷' : row.mode ? '测评' : '证据'}
                    </td>
                    <td className={cn('py-2', row.result === 'correct' ? 'text-band-mastered' : 'text-band-weak')}>
                      {row.result === 'correct' ? '对' : '错'}
                    </td>
                    <td className="max-w-[180px] truncate py-2 text-ink" title={row.student_answer ?? ''}>
                      {row.student_answer ?? '—'}
                    </td>
                    <td className="py-2 text-ink-soft">{row.matched_error_code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ④ 归因记录 */}
      <Card>
        <SectionTitle hint="根因链已翻译成知识点名">归因记录</SectionTitle>
        {attributions.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">还没有归因记录。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {attributions.map((row) => (
              <li key={row.attribution_id} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-ink">{row.from_kp}</span>
                  <span className="text-ink-soft">→ 根因</span>
                  <span className="font-medium text-ink">{row.root_cause}</span>
                  <Badge tone={row.verified ? 'positive' : 'warning'}>
                    {row.verified ? '已验证' : '待验证'}
                  </Badge>
                  <span className="text-ui-sm text-ink-soft">{formatTime(row.created_at)}</span>
                </div>
                <p className="mt-0.5 text-ui-sm text-ink-soft">
                  路径：{row.path.join(' ← ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="pb-4 text-center text-ui-sm text-ink-soft/70">
        想看这位学生的完整报告或对话，请让学生自己打开相应页面——老师端只提供教学必需的摘要与原文。
      </p>
    </div>
  );
}
