import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// root 固定为 apps/web，保证从仓库根（--config）或 apps/web 目录内启动都指向同一 index.html。
//
// 联调方式（D4）：本地 API server（functions/api/dist/server.js，8787）**不设置 CORS 头**，
// 浏览器直连会被拦；故经 vite dev proxy 同源转发 /api → 127.0.0.1:8787，
// 且 http-proxy 对 text/event-stream 透传（服务端已设 X-Accel-Buffering:no + 手写 chunked flush）。
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // 禁用一切缓存（2026-09-22）：此前出现「改了代码、页面重载后仍是旧样式」的
    // 反复困扰，根因是浏览器侧缓存/回退缓存拿旧响应。dev 阶段不需要缓存，
    // 直接把 no-store 铺满，让任何一次重载都必然走网络拿最新代码。
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
    // 自托管字体放行：@fontsource-variable/* 的 .woff2 实际落在仓库根的 node_modules，
    // 而本工程 root 固定在 apps/web —— dev 模式下这类「root 之外的静态资源」
    // 会被 vite 的 fs 白名单挡掉（报 outside of Vite serving allow list）。
    // 构建不受影响（字体已被打进 dist/assets），只有 dev 需要这条。
    fs: {
      allow: [__dirname, resolve(__dirname, '../../node_modules/@fontsource-variable')],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  // 静态预览通道（2026-09-22）：用生产构建产物在 4173 上再开一个入口。
  // 存在的意义不是「更像生产」，而是给一个**全新 URL** —— 全新 URL 不命中任何
  // 历史缓存、不依赖 HMR websocket，打开即是当前代码，用来排除
  // 「dev server 被重启过很多次、旧标签页与之失联」这类假象。
  // 同样配 /api 代理，否则页面能开但接口全 404。
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  build: {
    // 拆包（2026-09-20 风格走查）：echarts 体积占主包一半以上，且只有图谱页用到。
    // 单独成 chunk 后：首屏 JS 减少约 1/2，图谱页按需加载；同时消掉 vite 的 500 kB 告警。
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'echarts';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
