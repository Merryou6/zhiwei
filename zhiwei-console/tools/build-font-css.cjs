/* 把 Inter 可变字体内联为 base64，使原型在 file:// 下也能正确渲染 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'assets');
const files = [
  { file: 'inter-latin-wght-normal.woff2', range: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' }
];

let out = '/* Inter (variable, latin) — 内联 base64，无外部依赖 */\n';
for (const f of files) {
  const p = path.join(dir, f.file);
  if (!fs.existsSync(p)) { console.error('MISSING ' + p); process.exit(1); }
  const b64 = fs.readFileSync(p).toString('base64');
  out += `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;` +
    `src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${f.range};}\n`;
}
fs.writeFileSync(path.join(dir, 'inter.css'), out, 'utf8');
fs.writeFileSync(path.resolve(__dirname, '..', '..', '_font-css.txt'),
  `inter.css bytes=${fs.statSync(path.join(dir, 'inter.css')).size}`, 'utf8');
