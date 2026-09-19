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
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
});
