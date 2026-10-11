/**
 * 老师端 · 工作台（v1.6）：总览 + 邀请码 + 隐私边界 + 学生列表。
 *
 * 数据：#23 学生摘要列表（聚合层）+ #22 邀请码列表；生成邀请码走 #21（服务端复用语义）。
 * 页面职责只做编排与展示；摘要的口径（四状态带 / 缺口 Top3 / 活跃推荐数）由服务端快照决定。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P11.2（2026-10-11 第 4 轮）：视觉层按原型 PAGES.teacher
 * （tempui/prototypes/style-10/index.html L3120-3177）逐段复现，**业务逻辑一行不改**
 * （load 的 Promise.all([listTeacherStudents, listInvites])、活跃邀请码判据
 * status==='active' && used_count < max_uses、成功清 loadError、handleRetry、
 * handleCreateInvite 的 createInvite→toast(reused)→listInvites 三段、
 * handleCopyInviteCode 的 clipboard 可用性判定与失败手抄提示 —— 全部逐字符原样）：
 *   ① 页头 SheetHead（原型 L3143）：eyebrow「TEACHER CONSOLE / 邀请码与学情总览」+
 *      SHEET 10-15 + 需求 2.15 + h1「教师工作台」+ chip「T1 · 教师端」+ 动态 sub
 *      （原型口径「绑定 N 人 · 有学习记录 M 人 · 进行中推荐 K 条。」；学生为 0 时保留
 *      既有引导文案）。页头归页面自有（D24：Layout 登记 '/t'）。
 *   ② 01 总览（原型 L3147-3150 的 `.gstats` 四格 `.measure`）：绑定学生数 / 有学习记录 /
 *      进行中推荐 / 邀请码状态 —— 后三项仍由**已加载**的学生摘要派生（展示层统计，
 *      不发新请求、不改业务逻辑）。
 *   ③ 02 邀请码（原型 L3151-3159 的 `aside.panel`）：码本体（等宽大字号，始终完整可读）
 *      + `.bp-kv`（使用情况 / 有效期至 / 状态，取自同一份 invites 里匹配当前码的那一行）
 *      + 「复制邀请码」「生成新码」两颗既有动作 + 复制不可用时的手抄提示（原型 hint 口径）。
 *   ④ 03 隐私与数据边界（原型 L3161-3165）：既有隐私说明按 `.bp-note--warn` 制式常驻
 *      + 历史邀请码 `.bp-tbl`（既有 slice(0, 5) 口径不变）。
 *   ⑤ 04 学生列表（原型 L3166-3172）：`.bp-tbl` 九列（学生 / 空间 / 绑定 / 平均 / 档位 /
 *      四档计数 / 缺口靠前 / 进行中 / 最近活跃）；行可点进详情（原型 `data-rowlink`），
 *      目标 URL 与既有卡片墙**逐字符一致**（`/t/student/:id?space_id=…`）—— 见 D-P11.2-3。
 *
 * 【角色拦截】前端不做角色拦截（拍板）：学生身份访问本页时，数据请求由服务端
 *   requireTeacher 403 兜底 —— 本页把 403 当普通失败渲染成红章（不新增守卫分支）。
 *
 * 【四态（规范 §7 teacher 行，区域级）】
 *   loading（students === null）→ SkeletonLines
 *   error（loadError，含服务端 403）→ Stamp 红章 + 真重试（重发同一对请求）+ 一条出路
 *   empty（students.length === 0）→ EmptyState 虚线空盒 + 「复制邀请码」出路
 *   守卫分支顺序与迁移前一致（error 在前、loading 次之、数据态最后），见 3.1b。
 */

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../../api/client';
import { createInvite, listInvites, listTeacherStudents } from '../../api/endpoints';
import type { InviteListItem, TeacherStudentCard } from '../../api/types';
import { useBlueprintTier } from '../../components/blueprint/Board';
import { Icon } from '../../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../../components/blueprint/Sheet';
import SkeletonLines from '../../components/blueprint/SkeletonLines';
import Stamp from '../../components/blueprint/Stamp';
import EmptyState from '../../components/EmptyState';
import { Badge, Button } from '../../components/ui';
import { formatTime, percent } from '../../lib/format';
import { useUiStore } from '../../stores/ui';
import { BAND_ORDER, masteryBandOf } from '../../theme/bands';
import type { MasteryBand } from '../../theme/bands';

/** 图号与需求号（原型 sheetHead L3143 的 SHEET 10-15 / 需求 2.15）。 */
const SHEET_NO = '10-15';
const SECTION_NO = '2.15';

export default function TeacherDashboard() {
  const toast = useUiStore((state) => state.toast);
  const tier = useBlueprintTier();
  const navigate = useNavigate();
  const [students, setStudents] = useState<TeacherStudentCard[] | null>(null);
  const [invites, setInvites] = useState<InviteListItem[]>([]);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 【P2 整页错误可重试】重试请求期间的按钮态（禁用 + 「正在重试…」）
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [studentRes, inviteRes] = await Promise.all([listTeacherStudents(), listInvites()]);
      setStudents(studentRes.students);
      setInvites(inviteRes.invites);
      const active = inviteRes.invites.find(
        (row) => row.status === 'active' && row.used_count < row.max_uses,
      );
      setCurrentCode(active?.code ?? null);
      // 【P2 整页错误可重试】成功即清错误态，否则重试通过也停在错误卡上
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : '加载失败，请刷新重试');
    }
  }, []);

  /** 【P2 整页错误可重试】错误卡里的重试入口：留在错误卡上发请求，成功后由 load 清态。 */
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

  /**
   * 【P2 复制假成功】原实现不校验 clipboard 可用性就 toast「已复制」——
   * 非安全上下文 / 权限被拒时是假成功，老师以为发出去了、学生根本收不到码。
   * 改为 await 成功才报喜；失败明确告知手动抄写（邀请码始终大字号可见）。
   */
  async function handleCopyInviteCode(): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(currentCode ?? '');
      toast('邀请码已复制');
    } catch {
      toast('复制不可用，请手动抄写', 'warn');
    }
  }

  /** 页头（原型 sheetHead L3143）。**由页面自己渲染**（Layout 的 PAGE_OWNED_HEAD，D24）。 */
  function pageHead(sub: ReactNode): ReactElement {
    return (
      <SheetHead
        eyebrow="TEACHER CONSOLE / 邀请码与学情总览"
        sheetNo={SHEET_NO}
        section={SECTION_NO}
        title="教师工作台"
        sub={sub}
        chips={<Badge tone="warning">T1 · 教师端</Badge>}
        dim={sheetDimText(tier)}
      />
    );
  }

  // ── 失败态（含服务端 403 兜底）：整页取数没回来，红章 + 真重试（区域级 04 学生列表位）──
  if (loadError) {
    return (
      <>
        {pageHead('学生名单这一次没取回来——红章说的是取数失败，不是「你没有学生」。')}
        <SheetBlock no="04" title="学生列表" right={<Badge>取数失败</Badge>}>
          <Stamp
            seal="PAGE FETCH"
            reason={`${loadError}。学生列表整页取数失败：下面这张红章不代表「你没有学生」，请重试或稍后再看。`}
            onRetry={() => void handleRetry()}
            retrying={retrying}
            alt={{ label: '去推荐管理', to: '/t/recommendations' }}
          />
        </SheetBlock>
      </>
    );
  }

  // ── 加载态：骨架（静态发丝斜线，不 shimmer）──
  if (students === null) {
    return (
      <>
        {pageHead('正在取学生名单与邀请码…')}
        <SheetBlock no="01" title="总览">
          <SkeletonLines rows={3} block note="正在取班级数据 · 不伪造内容" />
        </SheetBlock>
      </>
    );
  }

  // 总览三项均由**已加载**的学生摘要派生（展示层统计），不发任何新请求、不改业务逻辑。
  const activeCount = students.filter((card) => card.last_active_at).length;
  const recommendationCount = students.reduce((sum, card) => sum + card.active_recommendations, 0);
  /** 当前码对应的那一行（仅为展示使用情况 / 有效期 / 状态，数据来自同一份 invites）。 */
  const currentInvite = currentCode
    ? invites.find((row) => row.code === currentCode) ?? null
    : null;

  const headSub =
    students.length === 0
      ? '把邀请码发到家长群，等学生确认绑定后，这里会出现他们的学习地图。'
      : `绑定 ${students.length} 人 · 有学习记录 ${activeCount} 人 · 进行中推荐 ${recommendationCount} 条。`;

  return (
    <>
      {pageHead(headSub)}

      {/* ── 01 总览 + 02 邀请码（原型 L3147-3159 的 `.split`：正文列 + 220px 栏位）── */}
      <section className="mb-8 grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <SheetBlock no="01" title="总览" className="mb-0">
            <div className="grid grid-cols-2 gap-3 sheet:grid-cols-4">
              <div className="bp-measure">
                <span className="tok">绑定学生数</span>
                <span className="big-num">{students.length}</span>
              </div>
              <div className="bp-measure">
                <span className="tok">有学习记录</span>
                <span className="big-num">{activeCount}</span>
              </div>
              <div className="bp-measure">
                <span className="tok">进行中推荐</span>
                <span className="big-num">{recommendationCount}</span>
              </div>
              <div className="bp-measure">
                <span className="tok">邀请码状态</span>
                {/* 状态只由「当前是否取到可用的码」这一既有判据派生，不新增请求。 */}
                <span className="big-num">{currentCode ? '有效' : '未生成'}</span>
              </div>
            </div>
          </SheetBlock>
        </div>

        <aside className="min-w-0">
          <SheetBlock
            no="02"
            title="邀请码"
            right={<Badge>{currentCode ? '可绑定' : '待生成'}</Badge>}
            className="mb-0"
          >
            {currentCode ? (
              <>
                <p className="mb-2">
                  <span className="num-mono text-title tracking-[0.18em] text-ink">{currentCode}</span>
                </p>
                <dl className="mb-0">
                  <div className="bp-kv">
                    <dt>使用情况</dt>
                    <dd className="num-mono">
                      {currentInvite ? `${currentInvite.used_count}/${currentInvite.max_uses}` : '—'}
                    </dd>
                  </div>
                  <div className="bp-kv">
                    <dt>有效期至</dt>
                    <dd className="num-mono">
                      {currentInvite ? formatTime(currentInvite.expire_at) : '—'}
                    </dd>
                  </div>
                  <div className="bp-kv">
                    <dt>状态</dt>
                    <dd>
                      <Badge tone={currentInvite?.status === 'disabled' ? 'neutral' : 'accent'}>
                        {currentInvite?.status === 'disabled' ? '停用' : '有效'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <EmptyState
                compact
                title="还没有可用的邀请码"
                hint="生成一个发给学生：学生在「我的 → 我的老师」输入这个码并确认后，你才看得到他的学习地图。"
              />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {currentCode ? (
                <Button variant="primary" onClick={() => void handleCopyInviteCode()}>
                  <Icon name="copy" />
                  复制邀请码
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => void handleCreateInvite()}>
                <Icon name="plus" />
                {currentCode ? '生成新码' : '生成绑定邀请码'}
              </Button>
            </div>

            {/* 原型 L3160：复制不可用时的出路 —— 码本体始终完整可读、可选中。 */}
            <p className="bp-note">
              复制不可用时请手动抄写这 6 位码——它始终完整可读、可选中。
            </p>
          </SheetBlock>
        </aside>
      </section>

      {/* ── 03 隐私与数据边界（原型 L3161-3165）──────────────────────────── */}
      <SheetBlock no="03" title="隐私与数据边界">
        <div className="bp-note bp-note--warn">
          <Icon name="lock" className="mr-1 inline h-4 w-4 align-text-bottom" />
          学生在「我的 → 我的老师」输入这个码并确认后，你才能看到他的学习地图（看不到对话内容）。
        </div>

        {invites.length > 0 ? (
          <div className="bp-tbl-wrap mt-3">
            <table className="bp-tbl">
              <caption>历史邀请码</caption>
              <thead>
                <tr>
                  <th scope="col">码</th>
                  <th scope="col" className="n">
                    使用
                  </th>
                  <th scope="col" className="n">
                    有效期
                  </th>
                  <th scope="col">状态</th>
                </tr>
              </thead>
              <tbody>
                {invites.slice(0, 5).map((invite) => (
                  <tr key={invite.code}>
                    <td data-label="码">
                      <span className="num-mono break-all text-ink">{invite.code}</span>
                    </td>
                    <td data-label="使用" className="n num-mono">
                      {invite.used_count}/{invite.max_uses}
                    </td>
                    <td data-label="有效期" className="n num-mono">
                      {invite.expire_at.slice(0, 10)} 前有效
                    </td>
                    <td data-label="状态">
                      <Badge tone={invite.status === 'active' ? 'accent' : 'neutral'}>
                        {invite.status === 'active' ? '有效' : '停用'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SheetBlock>

      {/* ── 04 学生列表（原型 L3166-3172）────────────────────────────────── */}
      <SheetBlock
        no="04"
        title="学生列表"
        right={<Badge>{students.length} 人</Badge>}
      >
        {students.length === 0 ? (
          <EmptyState
            tag="NO STUDENT"
            title="还没有学生绑定"
            hint="绑定是双向的：把邀请码发给学生，他确认之后你才看得到。"
            action={
              currentCode ? (
                <Button variant="secondary" onClick={() => void handleCopyInviteCode()}>
                  <Icon name="copy" />
                  复制邀请码
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => void handleCreateInvite()}>
                  <Icon name="plus" />
                  生成绑定邀请码
                </Button>
              )
            }
          />
        ) : (
          <div className="bp-tbl-wrap">
            <table className="bp-tbl">
              <caption>点击任意一行进入学生详情（图 10-16）</caption>
              <thead>
                <tr>
                  <th scope="col">学生</th>
                  <th scope="col">空间</th>
                  <th scope="col" className="n">
                    绑定
                  </th>
                  <th scope="col" className="n">
                    平均
                  </th>
                  <th scope="col">档位</th>
                  <th scope="col" className="num-mono">
                    四档计数
                  </th>
                  <th scope="col">缺口靠前</th>
                  <th scope="col" className="n">
                    进行中
                  </th>
                  <th scope="col">最近活跃</th>
                </tr>
              </thead>
              <tbody>
                {students.map((card) => {
                  const topBand = masteryBandOf(card.avg_mastery);
                  const detailHref = `/t/student/${card.student_id}?space_id=${card.space_id}`;
                  return (
                    <tr
                      key={`${card.student_id}:${card.space_id}`}
                      // 原型 data-rowlink：整行可点进详情。键盘路径由「学生」格里的真链接承担，
                      // 故点在链接/按钮上时不再重复导航（避免两次 push 同一条记录）。
                      className="cursor-pointer"
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('a,button')) return;
                        navigate(detailHref);
                      }}
                    >
                      <td data-label="学生" className="text-ink">
                        <Link to={detailHref} className="font-medium">
                          {card.nickname ?? '未署名学生'}
                        </Link>
                        <span className="num-mono block break-all text-caption text-ink-soft">
                          {card.student_id}
                        </span>
                      </td>
                      <td data-label="空间">{card.space_name}</td>
                      <td data-label="绑定" className="n num-mono">
                        {formatTime(card.linked_at)}
                      </td>
                      <td data-label="平均" className="n num-mono">
                        {percent(card.avg_mastery)}
                      </td>
                      <td data-label="档位">
                        <Badge band={topBand}>{topBand}</Badge>
                      </td>
                      <td data-label="四档计数" className="num-mono text-caption">
                        {BAND_ORDER.map((band: MasteryBand) => card.bands[band] ?? 0).join(' / ')}
                      </td>
                      <td data-label="缺口靠前">
                        {card.top_gaps.length === 0
                          ? '暂时没有明显缺口'
                          : card.top_gaps.map((gap) => gap.name).join(' · ')}
                      </td>
                      <td data-label="进行中" className="n num-mono">
                        {card.active_recommendations}
                      </td>
                      <td data-label="最近活跃">
                        {card.last_active_at ? (
                          formatTime(card.last_active_at)
                        ) : (
                          <span className="tok">还没有学习记录</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SheetBlock>
    </>
  );
}
