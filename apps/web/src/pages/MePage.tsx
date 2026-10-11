/**
 * 页 12 · 我的（v1.2，D4b；v1.4 吸收旧控制台页 11 的「学习概览」）
 *
 * 契约：#20 GET /api/user/profile（只读）——账号信息 / 空间概览 / 对话模型运行信息。
 *       概览块走 #9 GET /api/report/summary（与学习报告同一数据源，实时）。
 * 页面另读 useSpaceStore 拿「当前学习空间」，并复用顶栏同一份 useThemeStore 做主题切换。
 *
 * 红线：模型区只展示服务端下发的 mode/name，**不提供任何自定义入口**（用户反馈第 4 条：
 * 模型由服务端环境变量提供）；页面不做任何写接口调用。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.5（2026-10-11 第 4 轮）：视觉层按原型 PAGES.profile
 * （tempui/prototypes/style-10/index.html L3028-3120）逐段复现，**业务逻辑一行不改**
 * （两个取数 effect 的接口调用 / cancelled 清理 / 依赖数组逐字符未动；退出链路的
 * clearAuth→clearSpace→navigate(LOGIN_PATH, replace) 顺序与 ConfirmDialog 语义、
 * 概览的分档阈值 masteryBandOf、空态与失败兜底文案全部原样）：
 *   ① 页头 SheetHead（L3054）：eyebrow「PROFILE / 个人中心」+ SHEET 10-14 + 需求 2.14 +
 *      h1「我的页」+ chip「T1」；页头归页面自有（D24：Layout 登记 '/me'）。
 *   ② 01 学习概览：四格 `.bp-measure`（知识点总数 / 已掌握 / 待巩固 / 薄弱项）+
 *      四档分布行 `.dist`（档名 + 条形 + 等宽计数；与学习报告 02 同一套制式）+
 *      平均掌握度旁注；loading → SkeletonLines，无数据 → 虚线空盒 + 两条出路（区域级四态）。
 *   ③ 02 我的老师 + 04 老师推荐：本体是共享件 components/StudentTeacherSection
 *      （该文件不在计划清单内，仅视觉随组件库，见执行报告 D-P10.5-1）。
 *   ④ 03 当前空间（原型把 02/03 并排成 `.split`）：空间名 + 学科档 + 角色 kv +
 *      「切换空间」→ /spaces。
 *   ⑤ 05 账号信息（`.bp-kv`：账号 / 昵称（空显示「未设置」，不编名字）/ 用户标识 /
 *      注册时间 / 角色）；角色来自 auth store（服务端 role 的本地落盘，只读）。
 *   ⑥ 06 外观与模型：主题切换沿用既有件 ThemeToggle（两态开关；原型的三态 seg 需要
 *      zhiwei_theme 新增取值，属 store 行为变更，超出「表现层」范围，见 D-P10.5-2）+
 *      对话模型只读说明（规范 5.6 的只读表达）。
 *   ⑦ 07 退出：danger 主键 + 既有 ConfirmDialog（破坏性操作确认）。
 *
 * 原型推荐台账的「下发 / 完成」两列本工程有真字段（created_at / finished_at，
 * 见 api/types.ts 的 TeacherRecommendation），按原型复现；只有「05 账号信息」里的
 * 「复制用户标识」键本工程既无既有动作、也不该为凑视觉新增动作，故不迁移（不编数据、
 * 不新增动作，详见执行报告 D-P10.5-3）。
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getUserProfile, reportSummary } from '../api/endpoints';
import type { ProfileData, ReportSummaryData } from '../api/types';
import BandMark from '../components/blueprint/BandMark';
import { useBlueprintTier } from '../components/blueprint/Board';
import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import SkeletonLines from '../components/blueprint/SkeletonLines';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import StudentTeacherSection, { MyTeachersCard } from '../components/StudentTeacherSection';
import ThemeToggle from '../components/ThemeToggle';
import { Badge, Button, buttonVariants } from '../components/ui';
import { cn } from '../lib/cn';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { stageLabel } from '../lib/stages';
import { LOGIN_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { activeSpaceOf, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';
import { BAND_ORDER, masteryBandOf } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';

/** 模型模式 → 中文徽标（只读展示，两种取值来自契约 #20）。 */
const MODEL_MODE_LABEL: Record<ProfileData['model']['mode'], string> = {
  local: '本地规则',
  remote: '远程大模型',
};

/** 只读展示：可填「不可自定义」说明文案（用户反馈第 4 条）。 */
const MODEL_NOTE = '对话模型由服务端配置，不可在此自定义。';

/** 图号与需求号（原型 sheetHead L3054 的 SHEET 10-14 / 需求 2.14）。 */
const SHEET_NO = '10-14';
const SECTION_NO = '2.14';

/**
 * 学习概览（#9 实时数据；v1.4 自控制台迁入，数据源与学习报告同一条）。
 *
 * 四态（区域级）：loading → SkeletonLines；无数据 → EmptyState（虚线空盒 + 出路）；
 * 取不到 → 既有 catch 走 toast + 如实说明行（不伪造数字）。
 */
function Overview({ spaceId }: { spaceId: string }) {
  const [data, setData] = useState<ReportSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useUiStore((state) => state.toast);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const result = await reportSummary(spaceId);
        if (!cancelled) setData(result);
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
  }, [spaceId]);

  const distribution = useMemo(() => {
    const counts: Record<MasteryBand, number> = { 待巩固: 0, 不稳定: 0, 基本掌握: 0, 已掌握: 0 };
    const total = data ? data.mastery.length : 0;
    const avg = total > 0 && data ? data.mastery.reduce((sum, row) => sum + row.mastery, 0) / total : 0;
    const gaps = data ? data.gaps.length : 0;
    if (data) for (const row of data.mastery) counts[masteryBandOf(row.mastery)] += 1;
    return { counts, total, avg, gaps };
  }, [data]);

  /** 平均掌握度的档位（engine 唯一来源；只用于徽标着色）。 */
  const avgBand = masteryBandOf(distribution.avg);

  return (
    <SheetBlock no="01" title="学习概览" right={<span className="tok">实时取自当前空间</span>}>
      {loading ? (
        <SkeletonLines rows={2} note="正在拉取概览…" />
      ) : distribution.total === 0 ? (
        <EmptyState
          compact
          title="这个空间还没有学习数据"
          hint="概览由证据算出来：先做一次测评，或者到云盘传一份试卷，它就会出现在这里。"
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              <Link to="/assessment" className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="target" />
                做一次测评
              </Link>
              <Link to="/drive" className={cn(buttonVariants({ variant: 'secondary' }))}>
                <Icon name="cloud" />
                去云盘传试卷
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {/* 四格 measure（原型 `.gstats` 的四个 .measure）：数字是主角，单位另起一行 tok。 */}
          <div className="mb-3 grid grid-cols-2 gap-3 sheet:grid-cols-4">
            <div className="bp-measure">
              <span className="tok">知识点总数</span>
              <span className="big-num">{distribution.total}</span>
              <span className="tok">个</span>
            </div>
            <div className="bp-measure">
              <span className="tok">已掌握</span>
              <span className="big-num">{distribution.counts['已掌握']}</span>
              <span className="tok">个</span>
            </div>
            <div className="bp-measure">
              <span className="tok">待巩固</span>
              <span className="big-num">{distribution.counts['待巩固']}</span>
              <span className="tok">个</span>
            </div>
            <div className="bp-measure">
              <span className="tok">薄弱项</span>
              <span className="big-num">{distribution.gaps}</span>
              <span className="tok">个</span>
            </div>
          </div>

          {/* 四档分布 `.dist`（原型 L3061-3064）：档名（形状 + 文字）· 条形（宽度 = 占比）·
              等宽计数 —— 与学习报告 02 同一套制式（ReportPage L367-396 已定型）。
              窄档（≤419.98）改两行制：档名 | 计数 在上，条形独占一行（原型 L739-740）。
              ⚠ 色键取自 BAND_ORDER 的序（1..4），与 ReportPage / BandMark 同源，不抄第四份。 */}
          <div className="flex flex-col gap-2.5">
            {BAND_ORDER.map((band) => {
              const n = distribution.counts[band];
              const bandKey = BAND_ORDER.indexOf(band) + 1;
              const share = distribution.total > 0 ? Math.round((n / distribution.total) * 100) : 0;
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
                  <span className="num-mono order-2 text-right text-ui-sm text-ink narrow:order-3">{n}</span>
                </div>
              );
            })}
          </div>

          <p className="bp-note">
            平均掌握度 <span className="num-mono text-ink">{Math.round(distribution.avg * 100)}%</span>（
            <Badge band={avgBand}>{avgBand}</Badge>
            ）。分档阈值与学习报告同源（engine 的四状态带口径）。
          </p>
        </>
      )}
    </SheetBlock>
  );
}

export default function MePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const tier = useBlueprintTier();
  const activeSpace = useSpaceStore(activeSpaceOf);
  const clearSpace = useSpaceStore((state) => state.clear);
  const clearAuth = useAuthStore((state) => state.clear);
  const role = useAuthStore((state) => state.role);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getUserProfile();
        if (!cancelled) setProfile(data);
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
  }, []);

  function handleLogout(): void {
    // 顺序：先清两个 store（含 localStorage），再导航——守卫读落盘，必须先落盘再跳转
    clearAuth();
    clearSpace();
    setConfirmLogout(false);
    navigate(LOGIN_PATH, { replace: true });
  }

  return (
    <>
      {/* 页头（原型 sheetHead L3054）。**由页面自己渲染**：外壳对此页不再补通用页头
          （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */}
      <SheetHead
        eyebrow="PROFILE / 个人中心"
        sheetNo={SHEET_NO}
        section={SECTION_NO}
        title="我的页"
        sub="学习概览、师生关系、推荐、账号与偏好都在这张图上；对话模型只读，因为由服务端配置。"
        chips={<Badge>T1</Badge>}
        dim={sheetDimText(tier)}
      />

      {/* 0) 学习概览：自己管取数与加载态，不被账号信息的 loading 挡住（先到先渲染）。 */}
      {activeSpace ? (
        <Overview spaceId={activeSpace.space_id} />
      ) : (
        <SheetBlock no="01" title="学习概览" right={<span className="tok">实时取自当前空间</span>}>
          <EmptyState
            compact
            title="还没选中的学习空间"
            hint="概览按空间算：先选一个空间，这张图上才有数字。"
            action={
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'primary' }))}>
                <Icon name="swap" />
                去选空间
              </Link>
            }
          />
        </SheetBlock>
      )}

      {/* 02 我的老师 + 03 当前空间（原型 `.split`：正文列 + 220px 栏位）。 */}
      <section className="mb-8 grid grid-cols-1 gap-6 annos:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <MyTeachersCard activeSpaceId={activeSpace?.space_id ?? null} />
        </div>
        <aside className="bp-panel p-3">
          <SheetBlock no="03" title="当前空间" className="mb-0">
            <dl>
              <div className="bp-kv">
                <dt>空间</dt>
                <dd>{activeSpace ? activeSpace.name : '未选择'}</dd>
              </div>
              <div className="bp-kv">
                <dt>学科</dt>
                <dd>{activeSpace ? stageLabel(activeSpace.knowledge_source[0]) : '—'}</dd>
              </div>
              <div className="bp-kv">
                <dt>角色</dt>
                <dd>{role === 'teacher' ? '教师' : '学生'}</dd>
              </div>
            </dl>
            <div className="mt-3">
              <Link to={SPACES_PATH} className={cn(buttonVariants({ variant: 'secondary' }))}>
                <Icon name="swap" />
                切换空间
              </Link>
            </div>
          </SheetBlock>
        </aside>
      </section>

      {/* 04 老师推荐（推荐为空时整块不渲染 —— 既有语义，见 StudentTeacherSection）。 */}
      {activeSpace ? <RecommendationsOnly activeSpaceId={activeSpace.space_id} /> : null}

      {/* 05 账号信息 / 06 外观与模型 / 07 退出：三栏（原型 `.grid.g3`，窄档单列）。 */}
      <div className="grid grid-cols-1 gap-5 narrow:grid-cols-2 sheet:grid-cols-3">
        <div className="bp-panel p-3">
          <SheetBlock no="05" title="账号信息" className="mb-0">
            {loading ? (
              <SkeletonLines rows={2} note="正在取你的账号信息…" />
            ) : profile ? (
              <dl>
                <div className="bp-kv">
                  <dt>账号</dt>
                  <dd className="num-mono">{profile.user.identifier}</dd>
                </div>
                <div className="bp-kv">
                  <dt>昵称</dt>
                  {/* 昵称为空不编名字（原型 anno③）：如实写「未设置」。 */}
                  <dd>{profile.user.nickname ?? '未设置'}</dd>
                </div>
                <div className="bp-kv">
                  <dt>用户标识</dt>
                  <dd className="num-mono">{profile.user.user_id}</dd>
                </div>
                <div className="bp-kv">
                  <dt>注册时间</dt>
                  <dd className="num-mono">{formatTime(profile.user.created_at)}</dd>
                </div>
                <div className="bp-kv">
                  <dt>角色</dt>
                  {/* 原型 L3103 的 account.role 行：本工程角色来自 auth store 的本地落盘
                      （服务端 role 的只读投影），与 03 当前空间里的那一行同源。 */}
                  <dd>{role === 'teacher' ? '教师' : '学生'}</dd>
                </div>
              </dl>
            ) : (
              <p className="bp-note bp-note--warn">
                账号信息暂时取不到（已按非阻断提示告知）；刷新后再看一眼，学习数据不受影响。
              </p>
            )}
          </SheetBlock>
        </div>

        <div className="bp-panel p-3">
          <SheetBlock no="06" title="外观与模型" className="mb-0">
            <p className="tok mb-2">外观主题（写入 zhiwei_theme）</p>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <span className="tok">与顶栏同一开关</span>
            </div>
            <p className="bp-note">
              <Icon name="lock" className="mr-1 inline h-4 w-4 align-text-bottom" />
              {MODEL_NOTE}
              <br />
              <span className="tok">READ ONLY · 与「禁用」不同，这里表示按设计不可改</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{profile ? MODEL_MODE_LABEL[profile.model.mode] : '—'}</Badge>
              {profile?.model.name ? <span className="text-body-sm text-ink">{profile.model.name}</span> : null}
            </div>
          </SheetBlock>
        </div>

        <div className="bp-panel p-3">
          <SheetBlock no="07" title="退出" className="mb-0">
            <p className="text-body-sm leading-relaxed text-ink-soft">
              退出后要重新登录才能接着学，学习记录不会丢。
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={() => setConfirmLogout(true)}>
                <Icon name="close" />
                退出登录
              </Button>
            </div>
            <p className="tok mt-2">需要确认：是（破坏性操作，全站少数模态之一）</p>
          </SheetBlock>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="要退出登录吗？"
        description="退出后需要重新登录，你的空间和学习记录都会保留。"
        confirmLabel="退出登录"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </>
  );
}

/** 04 老师推荐：与 StudentTeacherSection 同一份实现（这里只取推荐台账那一张卡）。 */
function RecommendationsOnly({ activeSpaceId }: { activeSpaceId: string }) {
  return <StudentTeacherSection activeSpaceId={activeSpaceId} recommendationsOnly />;
}
