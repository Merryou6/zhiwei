import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// 拉丁字母与数字的自托管可变字体（含全字重轴）。
// 汉字不在 Geist 的字形集内，会由 tailwind fontFamily.sans 的后续栈回落到系统中文。
// 之所以自托管而不走 CDN：离线/内网环境同样生效，也没有第三方请求与隐私成本。
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';

import App from './App';
import './index.css';

// HashRouter（D1）：静态预览与未来云函数静态托管都免服务端 rewrite 配置。
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
