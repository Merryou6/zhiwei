/**
 * 老师端 · 工作台（v1.6）：学生卡片墙 + 邀请码面板。
 *
 * 数据：#23 学生摘要列表（聚合层）+ #22 邀请码列表；生成邀请码走 #21（服务端复用语义）。
 * 页面职责只做编排与展示；摘要的口径（四状态带 / 缺口 Top3 / 活跃推荐数）由服务端快照决定。
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { createInvite, listInvites, listTeacherStudents } from '../../api/endpoints';
import type { InviteListItem, TeacherStudentCard } from '../../api/types';
import PageSkeleton from '../../components/PageSkeleton';
import { Badge, Button, Card, CardTitle } from '../../components/ui';
import { percent, formatTime } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { masteryBandOf, BAND_HEX } from '../../theme/bands';

/** 空态：还没有学生绑定（引导先发邀请码）。 */
function EmptyStudents({ hint }: { hint: string }) {
  return (
    <Card>
      <div className="py-10 text-center">
        <p className="text-sm text-ink">还没有学生绑定到你</p>
        <p className="mt-1 text-ui-sm text-ink-soft">{hint}</p>
      </div>
    </Card>
  );
}

/** 单个学生摘要卡（点击进详情）。 */
function StudentCard({ card }: { card: TeacherStudentCard }) {
  const topBand = masteryBandOf(card.avg_mastery);
  return (
    <Link to={`/t/student/${card.student_id}?space_id=${card.space_id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-medium text-ink">{card.nickname ?? '未署名学生'}</p>
            <p className="mt-0.5 text-ui-sm text-ink-soft">
              {card.space_name} · 绑定于 {formatTime(card.linked_at)}
            </p>
          </div>
          <span
            className="rounded-md px-2 py-0.5 text-xs text-ink"
            style={{ backgroundColor: `${BAND_HEX[topBand]}26` }}
          >
            均值 {percent(card.avg_mastery)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-ink-soft">
          {Object.entries(card.bands).map(([band, count]) => (
            <span key={band} className="rounded-md bg-canvas px-2 py-0.5">
              {band} <span className="font-mono tabular-nums text-ink">{count}</span>
            </span>
          ))}
        </div>

        <div className="mt-3 border-t border-line pt-2 text-ui-sm text-ink-soft">
          {card.top_gaps.length === 0 ? (
            '暂时没有明显缺口'
          ) : (
            <span>
              缺口靠前：
              {card.top_gaps.map((gap) => gap.name).join('、')}
            </span>
          )}
        </div>

        {card.active_recommendations > 0 ? (
          <p className="mt-2 text-ui-sm text-accent-ink">
            进行中的推荐 {card.active_recommendations} 条
          </p>
        ) : null}

        <p className="mt-2 text-ui-sm text-ink-soft/70">
          {card.last_active_at ? `最近活跃 ${formatTime(card.last_active_at)}` : '还没有学习记录'}
        </p>
      </Card>
    </Link>
  );
}

export default function TeacherDashboard() {
  const toast = useUiStore((state) => state.toast);
  const [students, setStudents] = useState<TeacherStudentCard[] | null>(null);
  const [invites, setInvites] = useState<InviteListItem[]>([]);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [studentRes, inviteRes] = await Promise.all([listTeacherStudents(), listInvites()]);
      setStudents(studentRes.students);
      setInvites(inviteRes.invites);
      const active = inviteRes.invites.find(
        (row) => row.status === 'active' && row.used_count < row.max_uses,
      );
      setCurrentCode(active?.code ?? null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : '加载失败，请刷新重试');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateInvite(): Promise<void> {
    try {
      const info = await createInvite();
      setCurrentCode(info.code);
      toast(info.reused ? '邀请码仍在有效期内，已为你取出' : '新邀请码已生成');
      const inviteRes = await listInvites();
      setInvites(inviteRes.invites);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : '生成失败', 'warn');
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">工作台</h1>
        <Card>
          <p className="py-6 text-center text-sm text-ink-soft">{loadError}</p>
        </Card>
      </div>
    );
  }

  if (students === null) {
    return <PageSkeleton label="正在看班级这一周…" rows={3} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">工作台</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {students.length === 0
              ? '把邀请码发到家长群，等学生确认绑定后，这里会出现他们的学习地图。'
              : `${students.length} 个学生的地图都在这里，点开任何一个看细节。`}
          </p>
        </div>
        <Button variant="primary" onClick={() => void handleCreateInvite()}>
          {currentCode ? '查看我的邀请码' : '生成绑定邀请码'}
        </Button>
      </div>

      {/* 邀请码面板 */}
      {currentCode ? (
        <Card>
          <CardTitle>绑定邀请码</CardTitle>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-canvas px-4 py-2 font-mono text-xl tracking-[0.3em] text-ink">
              {currentCode}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(currentCode);
                toast('邀请码已复制');
              }}
            >
              复制
            </Button>
            <span className="text-ui-sm text-ink-soft">
              学生在「我的 → 我的老师」输入这个码并确认后，你才能看到他的学习地图（看不到对话内容）。
            </span>
          </div>

          {invites.length > 0 ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-ui-sm text-ink-soft">历史邀请码</p>
              <ul className="mt-2 space-y-1">
                {invites.slice(0, 5).map((invite) => (
                  <li key={invite.code} className="flex items-center gap-3 text-ui-sm">
                    <span className="font-mono text-ink">{invite.code}</span>
                    <span className="text-ink-soft">
                      {invite.used_count}/{invite.max_uses} · {invite.expire_at.slice(0, 10)} 前有效
                    </span>
                    <Badge tone={invite.status === 'active' ? 'accent' : 'neutral'}>
                      {invite.status === 'active' ? '有效' : '停用'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* 学生卡片墙 */}
      {students.length === 0 ? (
        <EmptyStudents hint="生成邀请码并发给学生，绑定是双向的：学生确认后你才看得到。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((card) => (
            <StudentCard key={`${card.student_id}:${card.space_id}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
