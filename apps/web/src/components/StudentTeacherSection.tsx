/**
 * 学生端 · 我的老师 & 老师推荐（v1.6 双端，MePage 挂载）
 *
 * 两个 Card：
 *   ① 我的老师 —— 邀请码绑定（双向确认：preview → 确认卡 → confirm）+ 已绑定列表。
 *      确认卡把「老师能看到什么」讲清楚（学习地图 + 答题原文；不含对话），
 *      这是未成年人数据保护的界面落点。
 *   ② 老师推荐 —— assigned/viewed/in_progress 的推荐卡：查看即回执 viewed，
 *      「开始补」回执 in_progress 并带去图谱；done 的卡显示 ΔAccuracy（复测自动回写）。
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import {
  confirmLink,
  listMyRecommendations,
  listMyTeachers,
  previewLink,
  recommendationFeedback,
} from '../api/endpoints';
import type { LinkPreview, MyTeacher, TeacherRecommendation } from '../api/types';
import { Badge, Button, Card, CardTitle } from './ui';
import { cn } from '../lib/cn';
import { deltaPercent, formatTime } from '../lib/format';
import { useUiStore } from '../stores/ui';

const REC_BADGE: Record<string, { tone: 'neutral' | 'accent' | 'positive' | 'warning' | 'outline'; label: string }> = {
  assigned: { tone: 'neutral', label: '老师刚推的' },
  viewed: { tone: 'accent', label: '看过了' },
  in_progress: { tone: 'accent', label: '正在补' },
  done: { tone: 'positive', label: '已验证' },
  dismissed: { tone: 'outline', label: '已搁置' },
  expired: { tone: 'warning', label: '已过期' },
};

/** 状态为「待行动」的推荐（ assigned / viewed / in_progress）置顶展示。 */
function isActiveRec(status: string): boolean {
  return status === 'assigned' || status === 'viewed' || status === 'in_progress';
}

// ------------------------------------------------------------ 我的老师

function MyTeachersCard({ activeSpaceId }: { activeSpaceId: string | null }) {
  const toast = useUiStore((state) => state.toast);
  const [teachers, setTeachers] = useState<MyTeacher[] | null>(null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listMyTeachers();
      setTeachers(res.teachers);
    } catch {
      setTeachers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePreview(): Promise<void> {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 0) {
      toast('先把老师给的 6 位邀请码填进来', 'warn');
      return;
    }
    setBusy(true);
    try {
      setPreview(await previewLink(trimmed));
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '邀请码核验失败', 'warn');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!preview) return;
    if (!activeSpaceId) {
      toast('先在空间页选一个学习空间', 'warn');
      return;
    }
    setBusy(true);
    try {
      const result = await confirmLink({ invite_code: preview.code, space_id: activeSpaceId });
      toast(
        result.duplicated
          ? '你已经绑定过这位老师了'
          : `已绑定 ${result.teacher_nickname ?? '老师'}，他可以看到你的学习地图`,
      );
      setPreview(null);
      setCode('');
      await load();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '绑定失败', 'warn');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>我的老师</CardTitle>
      <p className="mt-1 text-ui-sm text-ink-soft">
        老师给你一个 6 位邀请码；你确认后，他才能看到你的学习地图和答题记录——看不到你和学长的对话。
      </p>

      {teachers !== null && teachers.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {teachers.map((teacher) => (
            <li
              key={teacher.link_id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0"
            >
              <div>
                <p className="text-sm text-ink">{teacher.teacher_nickname}</p>
                <p className="text-ui-sm text-ink-soft">
                  {teacher.space_name} · {formatTime(teacher.linked_at)} 绑定
                </p>
              </div>
              <Badge tone="accent">已绑定</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 绑定输入 + 确认卡 */}
      {preview ? (
        <div className="mt-3 rounded-surface border border-accent/40 bg-accent-veil p-3">
          <p className="text-sm text-ink">
            {preview.teacher_nickname} 想看你的学习地图（码 {preview.code}）
          </p>
          <p className="mt-1 text-ui-sm text-ink-soft">
            他能看到：掌握度分布、薄弱点、答题与错题原文。看不到：你和学长的对话内容。
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" loading={busy} onClick={() => void handleConfirm()}>
              确认绑定
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              先不绑
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="输入 6 位邀请码"
            maxLength={6}
            aria-label="老师邀请码"
            className="w-40 rounded-control border border-line bg-surface px-3 py-2 font-mono tracking-[0.2em] text-sm text-ink outline-none focus:border-accent"
          />
          <Button variant="secondary" loading={busy} onClick={() => void handlePreview()}>
            核验
          </Button>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------ 老师推荐

function RecommendationListCard({ activeSpaceId }: { activeSpaceId: string | null }) {
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  const [recs, setRecs] = useState<TeacherRecommendation[] | null>(null);

  const load = useCallback(async () => {
    if (!activeSpaceId) {
      setRecs([]);
      return;
    }
    try {
      const res = await listMyRecommendations(activeSpaceId);
      setRecs(res.recommendations);
    } catch {
      setRecs([]);
    }
  }, [activeSpaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(rec: TeacherRecommendation, action: 'viewed' | 'in_progress' | 'dismissed'): Promise<void> {
    try {
      await recommendationFeedback(rec.recommendation_id, action);
      if (action === 'in_progress') {
        toast(`正在补「${rec.kp_name}」，补完做一次复测，效果会自动记给老师看`);
        navigate(`/graph?path=${encodeURIComponent(rec.kp_id)}`);
      } else if (action === 'dismissed') {
        toast('先搁置了，随时可以从这里再开始');
      }
      await load();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '操作失败', 'warn');
    }
  }

  if (recs === null || recs.length === 0) {
    return null; // 没有推荐时不占版面
  }

  const active = recs.filter((row) => isActiveRec(row.status));
  const settled = recs.filter((row) => !isActiveRec(row.status));

  return (
    <Card>
      <CardTitle>老师推荐</CardTitle>
      <p className="mt-1 text-ui-sm text-ink-soft">老师根据你的地图推的薄弱点——补完做一次复测，提升会被记录下来。</p>

      <ul className="mt-3 space-y-3">
        {[...active, ...settled].map((rec) => {
          const badge = REC_BADGE[rec.status] ?? REC_BADGE.assigned;
          return (
            <li
              key={rec.recommendation_id}
              className={cn(
                'rounded-surface border p-3',
                isActiveRec(rec.status) ? 'border-accent/40 bg-accent-veil' : 'border-line bg-surface',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{rec.kp_name}</p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              {rec.note ? <p className="mt-1 text-ui-sm text-ink-soft">老师的话：{rec.note}</p> : null}
              {rec.status === 'done' && rec.delta_accuracy !== null ? (
                <p className="mt-1 text-ui-sm text-ink-soft">
                  复测效果：
                  <span
                    className={cn(
                      'font-mono tabular-nums',
                      rec.delta_accuracy >= 0 ? 'text-band-mastered' : 'text-band-weak',
                    )}
                  >
                    Δ {deltaPercent(rec.delta_accuracy)}
                  </span>
                  （相对基线）
                </p>
              ) : null}

              {isActiveRec(rec.status) ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => void act(rec, 'in_progress')}
                    disabled={rec.status === 'in_progress'}
                  >
                    {rec.status === 'in_progress' ? '正在补' : '开始补'}
                  </Button>
                  <Button variant="ghost" onClick={() => void act(rec, 'dismissed')}>
                    先不了
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** MePage 的挂载入口：两张卡一起出（推荐为空时自动隐藏）。 */
export default function StudentTeacherSection({ activeSpaceId }: { activeSpaceId: string | null }) {
  return (
    <div className="mt-6 space-y-6">
      <RecommendationListCard activeSpaceId={activeSpaceId} />
      <MyTeachersCard activeSpaceId={activeSpaceId} />
    </div>
  );
}
