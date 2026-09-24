/**
 * 路由装配（D1）：12 页路由表（router.tsx）+ 守卫 + 页面外壳。
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
import { LOGIN_PATH, ROUTES, STORAGE_KEYS, guardPath } from './router';
import AssessmentPage from './pages/AssessmentPage';
import AttributionPage from './pages/AttributionPage';
import ChatPage from './pages/ChatPage';
import ConsoleHomePage from './pages/ConsoleHomePage';
import DrivePage from './pages/DrivePage';
import LoginPage from './pages/LoginPage';
import MePage from './pages/MePage';
import PaperPage from './pages/PaperPage';
import ReportPage from './pages/ReportPage';
import SelfReportPage from './pages/SelfReportPage';
import SpacesPage from './pages/SpacesPage';

/**
 * 图谱页按需加载（2026-09-20 风格走查）：它独占 echarts 依赖（主包一半以上体积），
 * 懒加载后首屏 JS 少掉约一半，进图谱页时才拉 echarts chunk（vite 已把它单独拆包）。
 */
const GraphPage = lazy(() => import('./pages/GraphPage'));

/** 路由 → 页面组件（12 页一一对应，键与 router.ROUTES 的 path 完全一致）。 */
const PAGE_COMPONENTS: Record<string, ComponentType> = {
  '/login': LoginPage,
  '/self-report': SelfReportPage,
  '/spaces': SpacesPage,
  '/console': ConsoleHomePage,
  '/assessment': AssessmentPage,
  '/paper': PaperPage,
  '/chat': ChatPage,
  '/attribution': AttributionPage,
  '/graph': GraphPage,
  '/report': ReportPage,
  '/drive': DrivePage,
  '/me': MePage,
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
 * bare（视觉改版 2026-09-22）：登录页是「全屏深色开场 + 中央粒子标识」，不套带顶栏的
 * Layout —— 未登录的人看到导航没有意义，而且深色开场必须占满视口。此时仍挂 ToastHost，
 * 保证校验/服务端错误照旧走非阻断提示（与内页同一份队列实现）。
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
      <Routes>
        {ROUTES.map((route) => {
          const Page = PAGE_COMPONENTS[route.path];
          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Guarded bare={route.path === LOGIN_PATH}>
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
    </ErrorBoundary>
  );
}
