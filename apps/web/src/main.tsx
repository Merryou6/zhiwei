import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

// 字体三栈（style-10「青蓝蓝图」迁移 P3，规范第 3 章）：
//   Chivo          标题 / 品牌字（--disp）
//   Noto Sans SC   正文与汉字（--body）
//   IBM Plex Mono  批注制式 .tok / 数值 / 图号（--mono）
// 三族全部 @fontsource 自托管（**禁 CDN**）：离线/内网环境同样生效，
// 没有第三方请求与隐私成本。原型里那份 Google Fonts 网络链接是单文件原型的
// 零构建例外，不是产品例外（静态闸门会拦下任何回流的 CDN 域名写法）。
// 只引实际用到的字重（400/500/600/700），Noto Sans SC 按 unicode-range 分片
// 自动按需加载 —— 中文全量字表很大，引入整包会拖垮首屏。
import '@fontsource/chivo/400.css';
import '@fontsource/chivo/600.css';
import '@fontsource/chivo/700.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

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
