/**
 * 路由装配（D1）：10 页路由表（router.tsx）+ 守卫 + 页面外壳。
 *
 * 守卫状态直接读 localStorage（与 stores/auth 的落盘键同源，见 router.tsx STORAGE_KEYS）：
 * 登录/登出/401 清理都会先同步写盘再导航，故守卫是「持久化会话」的纯函数，无额外订阅。
 */

import { Suspense, lazy, type ComponentType, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Layout from './components/Layout';
import { LOGIN_PATH, ROUTES, STORAGE_KEYS, guardPath } from './router';
import AssessmentPage from './pages/AssessmentPage';
import AttributionPage from './pages/AttributionPage';
import ChatPage from './pages/ChatPage';
import DrivePage from './pages/DrivePage';
import LoginPage from './pages/LoginPage';
import PaperPage from './pages/PaperPage';
import ReportPage from './pages/ReportPage';
import SelfReportPage from './pages/SelfReportPage';
import SpacesPage from './pages/SpacesPage';

/**
 * 图谱页按需加载（2026-09-20 风格走查）：它独占 echarts 依赖（主包一半以上体积），
 * 懒加载后首屏 JS 少掉约一半，进图谱页时才拉 echarts chunk（vite 已把它单独拆包）。
 */
const GraphPage = lazy(() => import('./pages/GraphPage'));

/** 路由 → 页面组件（10 页一一对应，键与 router.ROUTES 的 path 完全一致）。 */
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
};

/** 懒加载页面的占位（与页面内加载态同语气，避免白屏闪烁）。 */
function PageLoading(): ReactElement {
  return <p className="py-10 text-[13px] text-ink-soft">正在准备这一页…</p>;
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

function Guarded({ children }: { children: ReactElement }) {
  const location = useLocation();
  const redirect = guardPath(location.pathname, readSession());
  if (redirect) return <Navigate to={redirect} replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      {ROUTES.map((route) => {
        const Page = PAGE_COMPONENTS[route.path];
        return (
          <Route
            key={route.path}
            path={route.path}
            element={
              <Guarded>
                <Suspense fallback={<PageLoading />}>
                  <Page />
                </Suspense>
              </Guarded>
            }
          />
        );
      })}
      <Route path="*" element={<Navigate to={LOGIN_PATH} replace />} />
    </Routes>
  );
}
