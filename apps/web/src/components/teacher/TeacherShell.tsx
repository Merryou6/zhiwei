/**
 * 老师端壳（v1.6 双端）：/t/* 路由族的图纸外壳。
 *
 * 与学生端 Layout 分离的理由：导航真相不同——老师不需要测评/对话/云盘入口，
 * 需要的是「工作台 / 推荐管理」两个视图 + 随时回学生端的能力（demo 双端切换）。
 * 主题与 Toast 与学生端同源（useThemeStore / ToastHost 已在 App 层挂载）。
 *
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P11.2（2026-10-11 第 4 轮）：**只换视觉制式，链路一行不动**。
 * 角色校验链路（Guarded → guardPath 只要求登录；服务端 requireTeacher 403 兜底）不在本文件，
 * 本文件也不新增任何前端角色拦截；clearAuth → clearSpaces → toast → navigate(LOGIN_PATH,
 * replace) 四步顺序与语义逐字符未动；NAV_ITEMS（工作台 / 推荐管理）与 active 判据未动。
 *
 * 换的三件事（对齐学生端图纸语言，规范 §4）：
 *   ① Board（图板：底色 + 四角十字标记 + 图幅档 data-tier + 跳图纸主体的 skip link）
 *      —— 学生端 Layout 的最外层，这里复用同一件，保证两端同一个「板」；
 *   ② 图签条形态的顶栏：等宽大写眉标（知微 · 老师端 / TEACHER CONSOLE）+ 两个图纸入口
 *      + 右区「学生端 / 退出」；active 态走 border-accent + text-accent-ink（与学生端
 *      Rail / MobileNav 同一条「当前视图」表达），触控目标 min-h-9（D1 收窄口径）；
 *   ③ Sheet（图纸区）：与页面自渲染的 SheetHead 合起来構成一张完整图纸（页头 + 分节）。
 *
 * ⚠ 本壳**不渲染 TitleBlock**：右下标题栏的 8 格里「比例 / SCALE」要用 Layout.tsx 的
 *   TIER_SCALE、「日期」要用其 ISSUE_DATE，那两个常量都只存在于 Layout 内部（未导出）。
 *   为不把同一份常量抄第二遍（同源纪律），教师端壳不画标题栏 —— 图纸身份由各页 SheetHead
 *   的 SHEET 10-15/10-16/10-17 + 需求号承担。见执行报告 D-P11.2-1。
 * ⚠ 教师端路由当前**不经** Layout（App.tsx 用 `Guarded bare` + TeacherShell），
 *   故 Layout.tsx 的 PAGE_OWNED_HEAD 登记（'/t' / '/t/student/' / '/t/recommendations'）
 *   对本路由族**暂无实际效果**，登记只为 D24 登记表完整（同 '/' 门户的处置）。
 */

import type { ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { LOGIN_PATH, SPACES_PATH } from '../../router';
import { useAuthStore } from '../../stores/auth';
import { useSpaceStore } from '../../stores/space';
import { useUiStore } from '../../stores/ui';
import { cn } from '../../lib/cn';
import Board, { useBlueprintTier } from '../blueprint/Board';
import { Icon } from '../blueprint/icons';
import Sheet from '../blueprint/Sheet';

const NAV_ITEMS = [
  { to: '/t', label: '工作台', exact: true },
  { to: '/t/recommendations', label: '推荐管理', exact: false },
] as const;

export default function TeacherShell({ children }: { children: ReactElement }) {
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clear);
  const clearSpaces = useSpaceStore((state) => state.clear);
  const toast = useUiStore((state) => state.toast);
  const tier = useBlueprintTier();

  function handleLogout(): void {
    clearAuth();
    clearSpaces();
    toast('已退出老师端');
    navigate(LOGIN_PATH, { replace: true });
  }

  return (
    <Board tier={tier} view="shell">
      {/* 顶栏 = 学生端图签条的教师端同构：品牌块 + 图纸入口 + 右区操作簇。
          窄档允许换行（flex-wrap + min-h-14）：学生端图签条在 ≤900 会把索引/标注开关收起，
          这里是独立两路由，直接让入口簇整体折行，不会挤破 375 档。 */}
      <header className="sticky top-0 z-nav border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2">
          <Link to="/t" className="flex flex-none items-center gap-2.5">
            <span className="grid h-[34px] w-[34px] flex-none place-items-center border border-line text-accent-ink">
              <Icon name="desk" className="h-5 w-5" />
            </span>
            <span className="font-disp text-title leading-none tracking-widest text-ink">
              知微
              <small className="mt-1 block font-mono text-mono-xs font-normal uppercase tracking-widest text-ink-soft">
                TEACHER CONSOLE · 老师端
              </small>
            </span>
          </Link>

          <nav aria-label="老师端导航" className="flex items-center gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-control border px-3 font-mono text-tok uppercase tracking-widest transition-colors',
                    active
                      ? 'border-accent text-accent-ink'
                      : 'border-transparent text-ink-soft hover:border-line hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              to={SPACES_PATH}
              className="inline-flex min-h-9 items-center rounded-control border border-transparent px-3 font-mono text-tok uppercase tracking-widest text-ink-soft transition-colors hover:border-line hover:text-ink"
            >
              <Icon name="swap" className="mr-1.5 h-4 w-4" />
              学生端
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-9 items-center rounded-control border border-transparent px-3 font-mono text-tok uppercase tracking-widest text-ink-soft transition-colors hover:border-line hover:text-ink"
            >
              <Icon name="close" className="mr-1.5 h-4 w-4" />
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 图纸区：与页面自渲染的 SheetHead 拼成一张完整图纸（页头 + 分节）。 */}
      <div className="mx-auto w-full">
        <Sheet>{children}</Sheet>
      </div>
    </Board>
  );
}
