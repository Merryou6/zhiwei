/**
 * 老师端 · 推荐管理（v1.6）：全部下发的推荐 + 闭环状态。
 *
 * 「效果」列读 delta_accuracy——它由复测闭环自动回写（diagnose 服务钩子），
 * 老师看到的不是「我布置过」，而是「布置了、做了、提升了多少」。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { listTeacherRecommendations, listTeacherStudents } from '../../api/endpoints';
import type { TeacherRecommendation, TeacherStudentCard } from '../../api/types';
import PageSkeleton from '../../components/PageSkeleton';
import { Badge, Card } from '../../components/ui';
import { cn } from '../../lib/cn';
import { deltaPercent, formatTime } from '../../lib/format';
import { useUiStore } from '../../stores/ui';

const STATUS_BADGE: Record<string, { tone: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning' | 'outline'; label: string }> = {
  assigned: { tone: 'neutral', label: '已下发' },
  viewed: { tone: 'accent', label: '已查看' },
  in_progress: { tone: 'accent', label: '进行中' },
  done: { tone: 'positive', label: '已完成' },
  dismissed: { tone: 'outline', label: '已搁置' },
  expired: { tone: 'warning', label: '已过期' },
};

export default function TeacherRecommendations() {
  const toast = useUiStore((state) => state.toast);
  const [rows, setRows] = useState<TeacherRecommendation[] | null>(null);
  const [students, setStudents] = useState<TeacherStudentCard[]>([]);

  const load = useCallback(async () => {
    try {
      const [recRes, studentRes] = await Promise.all([
        listTeacherRecommendations(),
        listTeacherStudents(),
      ]);
      setRows(recRes.recommendations);
      setStudents(studentRes.students);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '加载失败', 'warn');
      setRows([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const nicknameOf = (studentId: string) =>
    students.find((card) => card.student_id === studentId)?.nickname ?? '学生';

  if (rows === null) {
    return <PageSkeleton label="正在整理推荐记录…" rows={3} />;
  }

  const doneRows = rows.filter((row) => row.status === 'done' && row.delta_accuracy !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">推荐管理</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {rows.length === 0
            ? '还没有下发给学生的推荐——去工作台打开学生详情，从缺口里选一个推给他。'
            : `共 ${rows.length} 条推荐${doneRows.length > 0 ? `，其中 ${doneRows.length} 条已由复测验证效果` : ''}。`}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-sm text-ink-soft">
            推荐是一条闭环：下发 → 学生查看 → 开始补 → 复测后这里会自动记下 ΔAccuracy。
          </p>
        </Card>
      ) : (
        <Card>
          <ul>
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.assigned;
              return (
                <li
                  key={row.recommendation_id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-medium">{row.kp_name}</span>
                      <span className="ml-2 text-ink-soft">→ {nicknameOf(row.student_id)}</span>
                    </p>
                    {row.note ? (
                      <p className="mt-0.5 max-w-[420px] truncate text-ui-sm text-ink-soft" title={row.note}>
                        {row.note}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-ui-sm text-ink-soft/70">
                      下发于 {formatTime(row.created_at)}
                      {row.finished_at ? ` · 完成于 ${formatTime(row.finished_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {row.delta_accuracy !== null ? (
                      <span
                        className={cn(
                          'font-mono text-sm tabular-nums',
                          row.delta_accuracy >= 0 ? 'text-band-mastered' : 'text-band-weak',
                        )}
                      >
                        Δ {deltaPercent(row.delta_accuracy)}
                      </span>
                    ) : null}
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="pb-4 text-center text-ui-sm text-ink-soft/70">
        <Link to="/t" className="hover:text-ink">
          回工作台看学生卡片 →
        </Link>
      </p>
    </div>
  );
}
