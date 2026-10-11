/**
 * 学生端 · 我的老师 & 老师推荐（v1.6 双端，MePage 挂载）
 *
 * 两个分节：
 *   ① 我的老师 —— 邀请码绑定（双向确认：preview → 确认卡 → confirm）+ 已绑定列表。
 *      确认卡把「老师能看到什么」讲清楚（学习地图 + 答题原文；不含对话），
 *      这是未成年人数据保护的界面落点。
 *   ② 老师推荐 —— assigned/viewed/in_progress 的推荐台账：「开始补」回执 in_progress
 *      并带去图谱；done 的行显示 ΔAccuracy（复测自动回写）。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.5（2026-10-11 第 4 轮）：**只换视觉**（Card 制式 →
 * SheetBlock 分节 + .bp-panel / .bp-tbl / Badge / Button / FormField+Input 原语，原型
 * PAGES.profile L3060-3095 的 02 我的老师 / 04 老师推荐台账）。业务逻辑逐行未动：
 * listMyTeachers / previewLink / confirmLink / listMyRecommendations /
 * recommendationFeedback 五个接口调用、load 的 useCallback、两个 useEffect 依赖、
 * 邀请码 trim+toUpperCase、busy 置位与 finally、四条 toast 文案、navigate 目标
 * （/graph?path=<kp_id>）、state 位与状态映射全部原样。
 * 新增的 `recommendationsOnly` 形参只决定「渲染哪一节」——供 /me 按原型分节顺序
 * （02 我的老师 + 03 当前空间并排，04 老师推荐台账另起一节）挂载用，不改任何数据流。
 * 本文件不在计划 P10.5 的「涉及」清单内，属共享件视觉重写（同 P10.1 的
 * SpaceCreateForm 先例，见执行报告 D-P10.5-1）。
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
import { Icon } from './blueprint/icons';
import { SheetBlock } from './blueprint/Sheet';
import { Badge, Button, FormField, Input } from './ui';
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

/**
 * 台账排序权重（原型 L3033-3036 的原样口径）：进行中优先 → 已下发 → 已查看 →
 * 已完成 → 已搁置 → 已过期；未知状态排最后（不丢行）。纯展示层排序，与数据流无关。
 */
const REC_ORDER: Record<string, number> = {
  in_progress: 0,
  assigned: 1,
  viewed: 2,
  done: 3,
  dismissed: 4,
  expired: 5,
};

// ------------------------------------------------------------ 我的老师

export function MyTeachersCard({ activeSpaceId }: { activeSpaceId: string | null }) {
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
    <SheetBlock no="02" title="我的老师">
      <p className="bp-note">
        老师给你一个 6 位邀请码；你确认后，他才能看到你的学习地图和答题记录——看不到你和学长的对话。
      </p>

      {teachers !== null && teachers.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {teachers.map((teacher) => (
            <li key={teacher.link_id} className="bp-panel flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="text-body-sm text-ink">{teacher.teacher_nickname}</p>
                <p className="tok">
                  {teacher.space_name} · {formatTime(teacher.linked_at)} 绑定
                </p>
              </div>
              <Badge tone="accent">
                <Icon name="tick" className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
                已绑定
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 绑定输入 + 确认卡（原型 L3075-3082 的 field / tick-list / row 结构）。 */}
      {preview ? (
        <div className="bp-panel border-accent p-3">
          <p className="text-body-sm text-ink">
            {preview.teacher_nickname} 想看你的学习地图（码 {preview.code}）
          </p>
          {/* 边界说明：老师能看到什么 / 看不到什么（未成年人数据保护的界面落点）。 */}
          <ul className="bp-tick-list mt-2">
            <li>能看到：掌握度分布、薄弱点、答题与错题原文</li>
            <li>看不到：你和学长的对话内容</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button variant="primary" loading={busy} onClick={() => void handleConfirm()}>
              <Icon name="tick" />
              看清了，确认绑定
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              先不绑
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2.5">
          <FormField
            label="邀请码 / CODE"
            hint="核验通过后，必须先看数据边界说明并确认，绑定才算完成。"
            className="w-40"
          >
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="6 位码"
              maxLength={6}
              className="font-mono tracking-[0.3em]"
            />
          </FormField>
          <Button variant="secondary" loading={busy} onClick={() => void handlePreview()}>
            <Icon name="key" />
            核验邀请码
          </Button>
          <span className="tok">{code.length} / 6 位</span>
        </div>
      )}
    </SheetBlock>
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

  const sorted = recs
    .slice()
    .sort((a, b) => (REC_ORDER[a.status] ?? 9) - (REC_ORDER[b.status] ?? 9));

  return (
    <SheetBlock
      no="04"
      title="老师推荐"
      right={
        <Badge tone="accent">{`进行中优先 · ${recs.length} 条`}</Badge>
      }
    >
      <p className="bp-note">老师根据你的地图推的薄弱点——补完做一次复测，提升会被记录下来。</p>

      {/* 推荐台账（原型 L3093-3095 的 `.tbl` 七列）：知识点 / 状态 / 附言 / 下发 / 完成 /
          效果回执 / 操作。窄档（≤899.98）走 .bp-tbl 既有制式转卡片，故每个 td 带
          data-label；「下发 = created_at / 完成 = finished_at」取本工程真字段
          （api/types.ts 的 TeacherRecommendation），不编数据。 */}
      <div className="bp-tbl-wrap">
        <table className="bp-tbl">
          <caption>推荐六态：已下发 / 已查看 / 进行中 / 已完成 / 已搁置 / 已过期</caption>
          <thead>
            <tr>
              <th scope="col">知识点</th>
              <th scope="col">状态</th>
              <th scope="col">附言</th>
              <th scope="col">下发</th>
              <th scope="col">完成</th>
              <th scope="col">效果回执</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((rec) => {
              const badge = REC_BADGE[rec.status] ?? REC_BADGE.assigned;
              const hasDelta = rec.delta_accuracy !== null;
              const improved = hasDelta && (rec.delta_accuracy as number) >= 0;
              return (
                <tr key={rec.recommendation_id}>
                  <td data-label="知识点" className="text-ink">
                    {rec.kp_name}
                  </td>
                  <td data-label="状态">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  {/* 附言：本工程的老师留言是纯文本（原型 mock 的附言列同义）。 */}
                  <td data-label="附言">{rec.note ? rec.note : <span className="tok">—</span>}</td>
                  <td data-label="下发" className="n">
                    {formatTime(rec.created_at)}
                  </td>
                  <td data-label="完成" className="n">
                    {rec.finished_at ? formatTime(rec.finished_at) : <span className="tok">—</span>}
                  </td>
                  {/* 回执（原型 anno②）：+ 用 ▲、− 用 ▼ 且写数值文字；未复测如实写
                      「暂无复测结果」「尚无回执」，不编零值。 */}
                  <td
                    data-label="效果回执"
                    className={cn('n', hasDelta && (improved ? 'up' : 'down'))}
                  >
                    {hasDelta ? (
                      <>
                        {improved ? '▲ ' : '▼ '}
                        {deltaPercent(rec.delta_accuracy as number)}
                      </>
                    ) : (
                      <span className="tok">{rec.status === 'done' ? '暂无复测结果' : '尚无回执'}</span>
                    )}
                  </td>
                  <td data-label="操作">
                    {isActiveRec(rec.status) ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => void act(rec, 'in_progress')}
                          disabled={rec.status === 'in_progress'}
                        >
                          <Icon name="branch" />
                          {rec.status === 'in_progress' ? '正在补' : '开始补'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void act(rec, 'dismissed')}>
                          先不了
                        </Button>
                      </div>
                    ) : (
                      <span className="tok">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SheetBlock>
  );
}

/**
 * MePage 的挂载入口。
 * `recommendationsOnly`（2026-10-11 P10.5 新增，纯渲染开关）：/me 按原型分节顺序把
 * 02 我的老师与 03 当前空间并排、04 老师推荐另起一节，故需要单独取「推荐」那一张卡。
 */
export default function StudentTeacherSection({
  activeSpaceId,
  recommendationsOnly = false,
}: {
  activeSpaceId: string | null;
  recommendationsOnly?: boolean;
}) {
  if (recommendationsOnly) {
    return <RecommendationListCard activeSpaceId={activeSpaceId} />;
  }
  return (
    <>
      <RecommendationListCard activeSpaceId={activeSpaceId} />
      <MyTeachersCard activeSpaceId={activeSpaceId} />
    </>
  );
}
