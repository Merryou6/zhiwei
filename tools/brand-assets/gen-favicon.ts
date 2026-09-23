/**
 * 生成 apps/web/public/favicon.svg（视觉改版 2026-09-22）
 *
 * 为什么不手写这份 SVG：标识几何是「粒子动画 + 界面图标 + 标签页图标」三处共用的源头，
 * 手抄一份必然漂移——今天挪了节点，标签页图标还是旧的。这里直接 import 同一份几何，
 * 改完几何重跑一次即可，三处永远同形。
 *
 * 用法（在仓库根执行；产物落进 node_modules/.cache 以免污染工作区）：
 *   esbuild tools/brand-assets/gen-favicon.ts --bundle --platform=node --format=cjs \
 *     --outfile=node_modules/.cache/gen-favicon.cjs && node node_modules/.cache/gen-favicon.cjs
 * 或直接：npm run brand:favicon
 */

import { writeFileSync } from 'node:fs';

import { LOGO_EYE, LOGO_LINKS, LOGO_NODES, eyeOutlinePaths, getLogoNode } from '../../apps/web/src/lib/logoGeometry';

/**
 * 小尺寸光学补偿：标签页图标只有 16–32px，
 * 界面上刚好的线宽在这里会糊成一团，所以要更粗、更满、更少细节。
 */
const OPTICS = {
  /** 标识实际占 x 17..83 / y 21..79，取正中的 80×80 视窗，留约 9% 边距。 */
  viewBox: '10 10 80 80',
  outlineWidth: 2.8,
  linkWidth: 1.8,
  irisWidth: 1.3,
  pupilRadius: 7.8,
  nodeScale: 1.2,
};

const body = [
  // 底板：圆角方块 + 原型表面三档渐变（raised #25344A → canvas #162945 → canvas-deep #122139）
  `<rect x="10" y="10" width="80" height="80" rx="18" fill="url(#bg)"/>`,
  // 叶形轮廓
  ...eyeOutlinePaths().map(
    (path) =>
      `<path d="${path}" fill="none" stroke="url(#mark)" stroke-width="${OPTICS.outlineWidth}" stroke-linecap="round" opacity="0.78"/>`,
  ),
  // 先修链
  ...LOGO_LINKS.map(([fromId, toId]) => {
    const start = getLogoNode(fromId);
    const end = getLogoNode(toId);
    if (!start || !end) return '';
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="url(#mark)" stroke-width="${OPTICS.linkWidth}" stroke-linecap="round" opacity="0.6"/>`;
  }),
  // 虹膜环
  `<circle cx="${LOGO_EYE.mid.x}" cy="${LOGO_EYE.mid.y}" r="${LOGO_EYE.irisRadius}" fill="none" stroke="url(#mark)" stroke-width="${OPTICS.irisWidth}" opacity="0.42"/>`,
  // 瞳孔（实心，小尺寸下的视觉重心）
  `<circle cx="${LOGO_EYE.mid.x}" cy="${LOGO_EYE.mid.y}" r="${OPTICS.pupilRadius}" fill="url(#pupil)"/>`,
  // 链上节点
  ...LOGO_NODES.filter((node) => !node.core).map(
    (node) =>
      `<circle cx="${node.x}" cy="${node.y}" r="${Math.round(node.r * OPTICS.nodeScale * 100) / 100}" fill="${node.key ? '#E8EDF3' : 'url(#mark)'}"/>`,
  ),
]
  .filter((line) => line.length > 0)
  .join('\n  ');

const svg = `<!-- 由 tools/brand-assets/gen-favicon.ts 生成，请勿手改；改标识请改 apps/web/src/lib/logoGeometry.ts 后重跑 npm run brand:favicon -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${OPTICS.viewBox}" width="64" height="64" role="img" aria-label="知微">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="130%">
      <stop offset="0%" stop-color="#25344A"/>
      <stop offset="58%" stop-color="#162945"/>
      <stop offset="100%" stop-color="#122139"/>
    </radialGradient>
    <linearGradient id="mark" gradientUnits="userSpaceOnUse" x1="${LOGO_EYE.a.x}" y1="${LOGO_EYE.a.y}" x2="${LOGO_EYE.b.x}" y2="${LOGO_EYE.b.y}">
      <stop offset="0%" stop-color="#2F92E6"/>
      <stop offset="52%" stop-color="#42A5F5"/>
      <stop offset="100%" stop-color="#5DB3F8"/>
    </linearGradient>
    <radialGradient id="pupil">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="62%" stop-color="#E8EDF3"/>
      <stop offset="100%" stop-color="#5DB3F8"/>
    </radialGradient>
  </defs>
  ${body}
</svg>
`;

const target = 'apps/web/public/favicon.svg';
writeFileSync(target, svg, 'utf8');
console.log(`已写出 ${target}（${svg.length} 字节）`);
