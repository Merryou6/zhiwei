/**
 * 页 3 · 学习空间列表（PRD §5 #3「默认已有空间；新建是次要按钮」；P0 #1）
 *
 * 契约：#3 GET /api/space/list、#4 POST /api/space/create
 *       409 → data={existing_space_id} → ConfirmDialog，**默认按钮「切换过去」**（契约 §2 明文）
 * 交互：主内容只放学习入口（主按钮按是否已自报切换文案）；空间管理本身是次要动作。
 *
 * D2c 职责划分（v1.2）：本页 = 完整管理（列表 / 进入学习 / 新建 / 空状态引导），
 * 新建表单抽到 components/SpaceCreateForm 完整态嵌入（顶栏弹层复用同一组件的紧凑态），
 * 故本文件不再持有 handleCreate / stage / ConfirmDialog 逻辑。
 * STAGES 与 stageLabel 迁至 lib/stages（SpacesPage / SpaceCreateForm / 一致性测试三处共用）。
 *
 * 【P1/P3 2026-10-09 双端切换轮】teacher 访问本页只给「回老师端」指引（老师没有学习空间）；
 * 主按钮改并列双入口「进入学习 / 自报·拍卷建图」，不再依赖本机 isSelfReportDone 标记。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.1（2026-10-11 第 4 轮）：视觉层按原型 PAGES.spaces
 * （tempui/prototypes/style-10/index.html L2040-2107）逐段复现，**业务逻辑一行不改**
 * （listSpaces 取数、setSpaces / setActive、409 流转、teacher 分支、navigate 目标、
 * 文案常量 PRIMARY_ENTRY / BUILD_ENTRY 全部原样）：
 *   ① 页头 SheetHead：eyebrow「SPACES / 学习容器管理」+ SHEET 10-05 + 需求 2.5 +
 *     h1「学习空间：给证据找一个落点」+ chip「T1」；页头归页面自有（D24：Layout 的
 *     PAGE_OWNED_HEAD 登记 '/spaces'，外壳不再补第二份 h1）
 *   ② 01 空间列表（原型 L2090）：计数 chip + 空间卡（bp-panel + 「当前使用」徽标 +
 *     「默认空间」徽标 + 学科 tok + 默认空间 / 创建时间 kv + 动作行）+ 活跃空间纪律旁注
 *     （原型 anno ① L2085 的正文）
 *   ③ 02 新建（原型 L2091-2094）：新建按钮行 / 新建表单（共享件 SpaceCreateForm，
 *     D2c 单一入口；409 → ConfirmDialog「切换过去」由它内部承担）
 *
 * 【四态（规范 §7 spaces 行，区域级）】
 *   loading → SkeletonLines（静态发丝斜线，不 shimmer）
 *   empty（0 个空间）→ EmptyState 虚线空盒（既有出路文案，D5）
 *   error（列表取不到）→ Stamp 红章 + **真重试**（重发同一个 listSpaces()）
 *   —— 空 ≠ 失败（规范 7.1）：列表没取回来时明说「这不是你没有空间」。
 *
 * 【D15c 同口径的最小新增（表现层，留痕）】`loadFailed` 的置位 / 复位写在**既有**
 *   load() 的成功与 catch 分支内；接口调用、依赖数组（[]）、effect 体逐字符未动。
 *   与 P6 /report、P7 /graph、P9.2 /paper、P9.4 /attribution 同一口径。
 *
 * 【本工程没有「空间数量上限」——原型计数 chip 的口径修正，见执行报告 D-P10.1-1】
 *   原型 01 的计数 chip 写 `n / 30`（MOCK.spaces.limit = 30），但本工程后端只有
 *   **空间名长度上限**（MAX_SPACE_NAME_LENGTH = 30 / services/space.ts），没有空间数量上限。
 *   照抄「/ 30」等于告诉学生一个并不存在的上限，故计数 chip 只给真实计数「N 个空间」。
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces } from '../api/endpoints';
import { Icon } from '../components/blueprint/icons';
import { SheetBlock, SheetHead, sheetDimText } from '../components/blueprint/Sheet';
import { useBlueprintTier } from '../components/blueprint/Board';
import Stamp from '../components/blueprint/Stamp';
import EmptyState from '../components/EmptyState';
import PageSkeleton from '../components/PageSkeleton';
import SpaceCreateForm from '../components/SpaceCreateForm';
import { Badge, Button } from '../components/ui';
import { formatTime } from '../lib/format';
import { UI_TEXT } from '../lib/phrases';
import { SPACE_NAME_MAX, STAGES, stageLabel } from '../lib/stages';
import { START_PATH, TEACHER_HOME } from '../router';
import { useAuthStore } from '../stores/auth';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

/**
 * 【P3 主按钮口径】不再按本机 isSelfReportDone 标记分流：走「拍试卷建图」路径的学生
 * 永远不会写这个标记，回到空间页仍被推「开始 30 秒自报」，口径是错的。
 * 改为并列双入口：主按钮「进入学习」（测评链路），次按钮「自报 / 拍卷建图」落
 * 冷启动分叉页 /start（那里本就提供拍试卷与做摸底题两种方式），两种建图路径
 * 随时可补，谁也不挤谁。
 */
const PRIMARY_ENTRY = { label: '进入学习', path: '/assessment' } as const;
const BUILD_ENTRY = { label: '自报 / 拍卷建图', path: START_PATH } as const;

/** 图号与需求号（原型 sheetHead L2087 的 SHEET 10-05 / 需求 2.5）。 */
const SHEET_NO = '10-05';
const SECTION_NO = '2.5';

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  /** 列表这一次没取到（区域级红章依据，见文件头「D15c 同口径的最小新增」）。 */
  const [loadFailed, setLoadFailed] = useState(false);
  /** 空状态下点「新建学习空间」才展开表单，避免一屏两个主按钮互相抢注意力。 */
  const [formOpen, setFormOpen] = useState(false);

  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  const toast = useUiStore((state) => state.toast);
  const navigate = useNavigate();
  // 【P1 双端切换回路】页面级判断：teacher 账号没有学习空间，本页对它只做指引不做建空间
  const isTeacher = useAuthStore((state) => state.role) === 'teacher';
  const tier = useBlueprintTier();

  async function load(): Promise<void> {
    setLoadFailed(false);
    try {
      const data = await listSpaces();
      setSpaces(data.spaces);
    } catch (error) {
      setLoadFailed(true);
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 红章的真重试（D15c 口径）：重发**同一个**取数请求，不新开取数路径。 */
  function retryLoad(): void {
    setLoading(true);
    void load();
  }

  const ordered = [...spaces].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  // 【P1 双端切换回路】teacher 不渲染新建表单：老师账号建空间没有意义（见下方指引卡）
  const showForm = isTeacher ? false : loading ? false : ordered.length > 0 || formOpen;

  /** 页头（原型 sheetHead L2087）。**由页面自己渲染**：外壳对此页不再补通用页头
   *  （Layout 的 PAGE_OWNED_HEAD，D24）—— 否则一页会出现两个 h1。 */
  const pageHead = (
    <SheetHead
      eyebrow="SPACES / 学习容器管理"
      sheetNo={SHEET_NO}
      section={SECTION_NO}
      title="学习空间：给证据找一个落点"
      sub={`空间名唯一、上限 ${SPACE_NAME_MAX} 字、留空取学科名、重名自动追加序号。学科覆盖 ${STAGES.map(
        (stage) => stage.label,
      ).join(' · ')}。`}
      chips={<Badge>T1</Badge>}
      dim={sheetDimText(tier)}
    />
  );

  // ============================================================ 教师账号：只做指引
  // 【P1 双端切换回路】teacher 访问本页只给指引：不建空间、不引导学习链路，
  // 一颗「回老师端」把唯一的正确去向放在眼前（原来只会看到「还没有学习空间」空态）。
  if (isTeacher) {
    return (
      <>
        {pageHead}
        <SheetBlock no="01" title="教师端导航">
          <div className="bp-panel p-4">
            <EmptyState
              tag="TEACHER · 无需空间"
              title="老师账号不用建学习空间"
              hint="你的学生在绑定后自动出现——回老师端就能看到他们的学习地图。"
              action={
                <Button variant="primary" onClick={() => navigate(TEACHER_HOME)}>
                  回老师端
                </Button>
              }
            />
          </div>
        </SheetBlock>
      </>
    );
  }

  return (
    <>
      {pageHead}

      {/* ── 01 空间列表（原型 L2090 / 空间卡 L2045-2057）────────────────── */}
      <SheetBlock
        no="01"
        title="空间列表"
        right={<Badge>{ordered.length > 0 ? `${ordered.length} 个空间` : '暂无空间'}</Badge>}
      >
        {loading ? (
          <PageSkeleton label="正在取你的空间…" rows={2} />
        ) : loadFailed ? (
          <Stamp
            reason="空间列表没有取回来。这不是「你没有空间」——列表和空集合是两回事，下面这张红章只表示请求失败。"
            onRetry={retryLoad}
            retrying={loading}
            alt={{ label: '去云盘看预置资料', to: '/drive' }}
          />
        ) : ordered.length === 0 ? (
          <EmptyState
            title="还没有学习空间"
            hint="一个空间就是一个学科的知识地图。先建一个，我再按你的自报给你排学习顺序。"
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                新建学习空间
              </Button>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {ordered.map((space) => {
                const isActive = space.space_id === activeSpaceId;
                return (
                  <li key={space.space_id} className="bp-panel p-4" data-active={isActive ? '1' : '0'}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-disp text-title-sm tracking-tight text-ink">
                          {space.name}
                        </h3>
                        {isActive ? <Badge tone="accent">当前使用</Badge> : null}
                        {space.is_default ? <Badge>默认空间</Badge> : null}
                      </div>
                      <span className="tok">{stageLabel(space.knowledge_source[0])}</span>
                    </div>

                    <dl className="mt-2">
                      <div className="bp-kv">
                        <dt>默认空间</dt>
                        <dd>{space.is_default ? '是' : '否'}</dd>
                      </div>
                      <div className="bp-kv">
                        <dt>创建时间</dt>
                        <dd className="num-mono">{formatTime(space.created_at)}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      {isActive ? (
                        <>
                          {/* 【P3 主按钮口径】并列双入口：进学习不再依赖本机自报标记，
                              拍卷建图的学生也不会再被推去「开始 30 秒自报」 */}
                          <Button onClick={() => navigate(PRIMARY_ENTRY.path)}>
                            <Icon name="arrow" />
                            {PRIMARY_ENTRY.label}
                          </Button>
                          <Button variant="secondary" onClick={() => navigate(BUILD_ENTRY.path)}>
                            {BUILD_ENTRY.label}
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={() => setActive(space.space_id)}>
                          <Icon name="swap" />
                          切到这个空间
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* 原型 anno ①（L2085）的正文：纪律说成一句旁注，不占一个标注列 */}
            <p className="bp-note">
              任一时刻只有一个活跃空间：切换会把「当前使用」挪过去，两个空间的掌握度与证据互不写入。
            </p>
          </>
        )}
      </SheetBlock>

      {/* ── 02 新建（原型 L2091-2094 / 表单 L2067-2083）─────────────────
          空态下不重复渲染本区块：空盒自带的「新建学习空间」就是那一条出路（空态必须给
          出路，规范 5.9），两个同文案按钮同屏只会互相抢注意力。 */}
      {showForm ? (
        <SheetBlock no="02" title="新建">
          <div className="bp-panel p-4">
            <p className="bp-note mt-0">
              选一个学科；空间名不填就用学科名。同名会自动加序号，放心建。
            </p>
            {/* 完整态共享表单（顶栏弹层用同一组件的 compact 态，D2c）；
                409「已有同名空间」→ ConfirmDialog「切换过去」也在它内部 */}
            <SpaceCreateForm />
          </div>
        </SheetBlock>
      ) : null}
    </>
  );
}
