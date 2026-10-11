/**
 * 路由装配（D1）：11 页路由表（router.tsx）+ 守卫 + 页面外壳。
 *
 * 守卫状态直接读 localStorage（与 stores/auth 的落盘键同源，见 router.tsx STORAGE_KEYS）：
 * 登录/登出/401 清理都会先同步写盘再导航，故守卫是「持久化会话」的纯函数，无额外订阅。
 *
 * 错误边界（前端优化批一）：页面级边界（保留顶栏，出错仍能切页）+ 顶层边界（Layout/守卫异常兜底）；
 * 均以当前路由 pathname 作 key，换页即复位，不会一直卡在兜底态。
 */

import { Suspense, lazy, type ComponentType, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import PageSkeleton from './components/PageSkeleton';
import ToastHost from './components/ToastHost';
import TeacherShell from './components/teacher/TeacherShell';
import { LOGIN_PATH, ROUTES, STORAGE_KEYS, guardPath } from './router';
import AssessmentPage from './pages/AssessmentPage';
import AttributionPage from './pages/AttributionPage';
import ChatPage from './pages/ChatPage';
import DrivePage from './pages/DrivePage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MePage from './pages/MePage';
import PaperPage from './pages/PaperPage';
import PracticePage from './pages/PracticePage';
import ReportPage from './pages/ReportPage';
import SelfReportPage from './pages/SelfReportPage';
import SpacesPage from './pages/SpacesPage';
import StartPage from './pages/StartPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherRecommendations from './pages/teacher/TeacherRecommendations';
import TeacherStudentDetail from './pages/teacher/TeacherStudentDetail';

/**
 * 图谱页按需加载（2026-09-20 风格走查）：它独占 echarts 依赖（主包一半以上体积），
 * 懒加载后首屏 JS 少掉约一半，进图谱页时才拉 echarts chunk（vite 已把它单独拆包）。
 */
const GraphPage = lazy(() => import('./pages/GraphPage'));

/** 路由 → 页面组件（11 页一一对应，键与 router.ROUTES 的 path 完全一致；
 *  页 11 控制台已于 v1.4 砍除，编号不复用）。 */
const PAGE_COMPONENTS: Record<string, ComponentType> = {
  '/login': LoginPage,
  '/self-report': SelfReportPage,
  '/spaces': SpacesPage,
  '/assessment': AssessmentPage,
  '/paper': PaperPage,
  '/chat': ChatPage,
  '/attribution': AttributionPage,
  '/graph': GraphPage,
  '/report': ReportPage,
  '/drive': DrivePage,
  '/me': MePage,
  // v2.1：冷启动分叉 + 专项练习（逐步批改）
  '/start': StartPage,
  '/practice': PracticePage,
};

/** 懒加载页面的占位（骨架屏，批三）：与页面内加载态同语气，避免白屏闪烁。 */
function PageLoading(): ReactElement {
  return <PageSkeleton label="正在准备这一页…" rows={2} />;
}

function persist(slot: string): string | null {
  try {
    return window.localStorage.getItem(slot);
  } catch {
    return null;
  }
}

/** 当前持久化会话（守卫输入）。 */
export function readSession(): { token: string | null; hasActiveSpace: boolean } {
  return {
    token: persist(STORAGE_KEYS.token),
    hasActiveSpace: persist(STORAGE_KEYS.activeSpace) !== null,
  };
}

/**
 * 守卫 + 外壳。
 *
 * bare（视觉改版 2026-09-22；现只服务教师端路由族 /t）：不套带顶栏的 Layout —— 教师端
 * 自带 TeacherShell，不需要学生端外壳。此时仍挂 ToastHost，保证校验/服务端错误照旧走
 * 非阻断提示（与内页同一份队列实现）。
 * ⚠ /login 曾用 bare（全屏深色开场 + 中央粒子标识）；2026-10-11 style-10 迁移 P10.4 起
 *   改为在壳内渲染（原型 login 就是外壳里的图纸），此处不再有登录页分支。
 */
function Guarded({ children, bare = false }: { children: ReactElement; bare?: boolean }) {
  const location = useLocation();
  const redirect = guardPath(location.pathname, readSession());
  if (redirect) return <Navigate to={redirect} replace />;

  if (bare) {
    return (
      <>
        {children}
        <ToastHost />
      </>
    );
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  const location = useLocation();

  return (
    // 顶层边界：Layout / 守卫自身异常也不白屏（此时无导航，兜底卡片自带出口）
    <ErrorBoundary key={`root:${location.pathname}`}>
      {/* 路线级转场（2026-10-10 awwwards 包 G）：key 取 pathname，换页即整树重挂，
          每次切换整页 180ms fade+rise 进场（.route-view，见 index.css）。转场是获奖站
          「无缝体验」的基础盘；180ms 克制不打断学习动线，reduced-motion 自动瞬时化。 */}
      <div key={location.pathname} className="route-view">
        <Routes>
        {/* 公开入口门户（2026-09-25 收尾轮）：站外访客的第一脚，无守卫、无顶栏外壳，
            不进 router.ROUTES 的 11 页口径。「立即体验」→ /login，未登录进登录页、
            已登录被守卫直接送进 #/spaces，一条路径自动分状态。 */}
        <Route path="/" element={<LandingPage />} />

        {/* v1.6 双端：/t/* 老师端路由族——独立壳（TeacherShell），不进学生 11 页口径。
            守卫只要求登录；角色校验由页面数据请求的服务端 403 兜底（学生调老师端接口即被拒）。 */}
        <Route
          path="/t"
          element={
            <Guarded bare>
              <ErrorBoundary key="page:/t">
                <Suspense fallback={<PageLoading />}>
                  <TeacherShell>
                    <TeacherDashboard />
                  </TeacherShell>
                </Suspense>
              </ErrorBoundary>
            </Guarded>
          }
        />
        <Route
          path="/t/recommendations"
          element={
            <Guarded bare>
              <ErrorBoundary key="page:/t/recommendations">
                <Suspense fallback={<PageLoading />}>
                  <TeacherShell>
                    <TeacherRecommendations />
                  </TeacherShell>
                </Suspense>
              </ErrorBoundary>
            </Guarded>
          }
        />
        <Route
          path="/t/student/:studentId"
          element={
            <Guarded bare>
              <ErrorBoundary key="page:/t/student">
                <Suspense fallback={<PageLoading />}>
                  <TeacherShell>
                    <TeacherStudentDetail />
                  </TeacherShell>
                </Suspense>
              </ErrorBoundary>
            </Guarded>
          }
        />

        {ROUTES.map((route) => {
          const Page = PAGE_COMPONENTS[route.path];
          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                // 【2026-10-11 style-10 迁移 P10.4】/login 不再走 bare：原型 PAGES.login
                // 是**画在外壳里**的图纸（原型 L1951 的 sheetHead + 左右分栏，左侧分层索引
                // 可见），D24 登记表也写明「登录页在外壳内渲染图纸制式」。旧 bare 形态是
                // 2026-09-22「全屏深色开场 + 中央粒子标识」那一版的产物，与本迁移的视觉
                // 唯一依据（原型）冲突，故此处去掉 bare 分支 —— 见执行报告 D-P10.4-1。
                // （`Guarded` 的 bare 形参本身保留：/t 教师端路由族仍在用。）
                <Guarded>
                  {/* 页面级边界：只兜内容区，顶栏导航保留 → 出错也能切到别的页 */}
                  <ErrorBoundary key={`page:${route.path}`}>
                    <Suspense fallback={<PageLoading />}>
                      <Page />
                    </Suspense>
                  </ErrorBoundary>
                </Guarded>
              }
            />
          );
        })}
        <Route path="*" element={<Navigate to={LOGIN_PATH} replace />} />
        </Routes>
      </div>
    </ErrorBoundary>
  );
}
