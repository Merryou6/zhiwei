/**
 * Toast 出口（视觉改版 2026-09-22）
 *
 * 从 Layout 里抽出来单独成组件：登录页现在走「无外壳」路由（全屏深色开场、不带顶栏），
 * 但它同样需要非阻断提示（本地校验、服务端 msg），所以提示出口独立，
 * 由「有外壳」的 Layout 和「无外壳」的登录页共用——避免两处各写一遍队列。
 */

import { useUiStore } from '../stores/ui';
import ToastList from './Toast';

export default function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismiss);

  return <ToastList items={toasts} onDismiss={dismiss} />;
}
