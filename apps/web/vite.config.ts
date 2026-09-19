import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 前端空壳配置：仅启动 dev server 用于脚手架验收（六、6.1）。
// root 固定为 apps/web，保证从仓库根（--config）或 apps/web 目录内启动都指向同一 index.html。
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
