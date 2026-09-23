/**
 * 路由级错误边界（前端优化批一 · 2026-09-22）
 *
 * 背景：原先只有 Suspense 兜懒加载，页面渲染抛异常（数据形态意外、第三方图表组件报错等）
 * 会直接整屏白屏——与项目「禁止白屏」纪律不一致（api/client.ts 连空响应/非 JSON 都兜了，
 * 渲染层却没有兜底）。本组件补上这一层。
 *
 * 行为（沿用既有约定）：
 *   - 捕获子树渲染异常 → 固定兜底话术（不暴露堆栈/内部信息，与 server.ts 的 500 处理同纪律）；
 *   - 提供「重新打开这一页」（重置边界）与「回到学习空间」两个出口，沿用主色按钮 + 触控目标 min-h-11；
 *   - 不做自动重试：异常态下自动刷会抖动，交给用户点一下；
 *   - 路由切换时由调用方以 key 重置（见 App.tsx），避免进过错误页后一直停在兜底态。
 *
 * 双层用法（App.tsx）：页面级边界（保留顶栏导航）+ 顶层边界（Layout/守卫自身异常兜底）。
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 详情只进控制台（排查用），不呈现给用户
    console.error('[zhiwei-web] 页面渲染异常：', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private handleBackToSpaces = (): void => {
    try {
      window.location.hash = '#/spaces';
    } catch {
      /* 非浏览器环境（测试）忽略 */
    }
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="mx-auto max-w-md py-10">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h1 className="text-base font-medium text-ink">这一页没能打开</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            不是你操作的问题，是页面自己出了点状况。你的学习记录都在，重开一下就好。
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="min-h-11 rounded-lg bg-accent px-4 py-2 text-sm text-on-accent transition-opacity hover:opacity-90"
            >
              重新打开这一页
            </button>
            <button
              type="button"
              onClick={this.handleBackToSpaces}
              className="min-h-11 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-raised"
            >
              回到学习空间
            </button>
          </div>
        </div>
      </section>
    );
  }
}
