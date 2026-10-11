/**
 * 断点与令牌纪律的静态闸门（2026-09-24 移动端适配轮建立；2026-10-10 style-10 蓝图迁移 P2 换值）
 *
 * 与 stages.test.ts 同一手法：直接读源文件文本 + 正则断言，不拉起组件树。
 *
 * 【2026-10-10 style-10 迁移 P2 的换值口径（D1）】
 *   原型用 `data-tier` 四档（≤420 sm / ≤900 md / 901–1179 lg / ≥1180 xl）。
 *   工程**不引入**全局 JS data-tier 驱动布局，改为 @media 具名断点扩展：
 *     narrow: '420px'   单列极窄档（标注列降级、表格转卡片的下界）
 *     sheet:  '900px'   图纸档（≤900 底部 tabbar + 侧栏进抽屉 + ChatPanel 全屏覆盖）
 *     annos:  '1180px'  标注档（≥1180 画 SVG 虚线引线 + ChatPanel 挤压图纸）
 *   nav: '720px' **保留不删**，语义收窄为「触控目标作用域」（max-nav:min-h-9 等既有用法），
 *   未迁移页面的 nav:* 类零破坏。断点值仍是原型 data-tier 的四个边界，只是命名化。
 *
 *   闸门条目：
 *   ① 断点单一定义    —— screens 四档具名断点 + nav 两侧变体真有用点（防拼写静默失效）
 *   ② 任意值断点清零  —— src/** 不得再出现 min-[NNNpx]: / max-[NNNpx]:
 *   ③ 裸 z-index 清零 —— src/** 不得出现 z-[
 *   ④ 裸 hex 清零     —— src/** 的 className 字面量属性不得出现 #rrggbb
 *   ⑤ viewport-fit    —— index.html 的 viewport 必须含 viewport-fit=cover
 *   ⑥ 全局 CSS        —— index.css 必须含 overscroll-behavior / touch-action，且其中的安全区
 *                        工具类每个都有真实使用点
 *   ⑦ 外壳高度单位    —— Layout.tsx 用 min-h-dvh，且不再有 min-h-screen
 *   ⑧ 断点两处同源    —— MobileNav.tsx 的 NAV_COLLAPSE_MIN_WIDTH_PX（JS 侧「越界自动关闭」用）
 *                        必须与 screens 的某一档同值且真接线（P5 起挂 sheet 档）
 *   ⑨ 四档哲学        —— 三档新断点的取值必须就是原型 data-tier 的边界，且命名必须具名
 *
 * ⚠ 「合法保留」白名单（以下**不在**断言范围，别把它们当成破绽删掉）：
 *   · src/theme/bands.ts、src/stores/theme.ts、tailwind.config.js 的 colors：
 *     令牌源本身，按定义就是字面 hex；
 *   · GraphPage 的 ECharts 画布回退色：canvas 绘制参数，不是 CSS 类名。
 *   · （2026-10-11 P7a / L-2 裁决 D17）曾列入白名单的 ReportPage min-w-[420px]
 *     已随 P6 清除，此处不再保留该项；② 的正则仍带冒号后缀，是为防误伤将来任何
 *     「宽度工具类」（形如 min-w-[NNNpx]，任意值后面没有冒号）这类合法宽度写法。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** apps/web/tests → 仓库根 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WEB = resolve(REPO_ROOT, 'apps/web');
const SRC = resolve(WEB, 'src');

/** 递归收集 .ts/.tsx 源文件（排序保证断言输出稳定）。 */
function scanSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) scanSources(full, out);
    else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const FILES = scanSources(SRC).map((file) => ({
  path: file,
  rel: relative(WEB, file),
  text: readFileSync(file, 'utf8'),
}));

/** 逐行找出匹配项（返回 `${相对路径}:${行号}: ${该行 trim}` 便于排障）。 */
function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    file.text.split('\n').forEach((line, index) => {
      if (pattern.test(line)) found.push(`${file.rel}:${index + 1}: ${line.trim().slice(0, 120)}`);
      pattern.lastIndex = 0;
    });
  }
  return found;
}

/** tailwind.config.js 的 screens 块正文（平铺写法，值直接是字符串）。 */
function screensBody(): string {
  const config = readFileSync(resolve(WEB, 'tailwind.config.js'), 'utf8');
  // 只匹配**平铺**写法：screens 的值直接是字符串，body 里不该出现 `}`。
  // 旧写法 /screens:\s*\{([\s\S]*?)\}/ 是非贪婪的，会把将来嵌套对象写法
  // （如 nav: { min: '720px' }）截断在第一个 `}` 之前，keys 提取失真。
  // ⚠ 若将来 config 真的改成嵌套写法，本断言必须同步改写（此处不支持嵌套解析）。
  const screens = /screens:\s*\{([^}]*)\}/.exec(config);
  expect(screens, 'tailwind.config.js 里找不到 screens 定义').not.toBeNull();
  return screens![1];
}

describe('断点单一定义（tailwind.config.js 的 screens）', () => {
  it('screens 定义四档具名断点，且 nav 两侧变体都真的用上了（防拼写错误静默失效）', () => {
    const body = screensBody();
    const keys = [...body.matchAll(/^\s*['"]?([A-Za-z][\w-]*)['"]?\s*:/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['annos', 'narrow', 'nav', 'sheet']);
    expect(body).toMatch(/nav:\s*['"]720px['"]/);

    // 断点写对了但类名写错（nav:/max-nav: 拼错）时样式会静默失效，故两侧都要求有使用点
    // （[^\w-] 前缀排除 max-nav: 的误命中——它的 nav: 前面是连字符）
    expect(hits(/[^\w-]nav:/).length).toBeGreaterThan(0);
    expect(hits(/\bmax-nav:/).length).toBeGreaterThan(0);
  });

  it('src/** 无任意值断点变体（/(min|max)-[NNNpx]:/，判别特征是任意值后紧跟冒号）', () => {
    expect(hits(/(?:min|max)-\[\d+px\]:/)).toEqual([]);
  });

  it('MobileNav 的 JS 侧收纳断点常量必须与 screens 的某一档同值（CSS 一份 + JS 一份，禁止漂移）', () => {
    // 抽屉的隐藏由 CSS 负责，但「越到宽档就自动关闭」必须由 JS 判断，于是同一个数字
    // 存在两处。漂移的后果是真实缺陷（见 MobileNav.tsx 的注释：拉宽后 open 残留 →
    // 正文 aria-hidden 不撤 + Tab 焦点陷阱对隐藏子树无效）。
    //
    // ⚠ P2 换值留痕：断言从「必须等于 nav:720」改为「必须等于 screens 里的**某一档**」
    //   —— P5 起 MobileNav 的阈值要挂 sheet 档（900，覆盖式抽屉的下界），
    //   而 P2 这一步 src 尚未落地（仍为 720 = nav 档），两态都必须绿。
    //   真正的纪律没变：**这个数字只能来自 screens，不能是第三个数**。
    const nav = readFileSync(resolve(SRC, 'components/MobileNav.tsx'), 'utf8');
    const declared = /NAV_COLLAPSE_MIN_WIDTH_PX\s*=\s*(\d+)/.exec(nav);
    expect(declared, 'MobileNav.tsx 里找不到 NAV_COLLAPSE_MIN_WIDTH_PX 常量').not.toBeNull();
    const px = Number(declared![1]);

    const widths = [...screensBody().matchAll(/:\s*['"](\d+)px['"]/g)].map((m) => Number(m[1]));
    expect(widths.length, 'screens 里没解析到任何断点值').toBeGreaterThan(1);
    expect(
      widths,
      `MobileNav 的 JS 常量 ${px} 与 screens 的任何一档都不同值 —— 两份真相已漂移`,
    ).toContain(px);

    // 常量必须真被用于判定（只声明不接线 = 缺陷仍在）
    expect(nav).toContain('useViewportAtLeast(NAV_COLLAPSE_MIN_WIDTH_PX)');
    // 且越界分支必须真的关闭抽屉
    expect(nav).toMatch(/if\s*\(wide\)\s*setOpen\(false\)/);
  });
});

describe('令牌纪律（裸值清零）', () => {
  it("src/** 无任意值 z-index（'z-['）", () => {
    expect(hits(/z-\[/)).toEqual([]);
  });

  it('src/** 的 className 字面量属性不出现裸 hex（令牌源 / JS 常量白名单见文件头）', () => {
    expect(hits(/className="[^"]*#[0-9a-fA-F]{3,8}/)).toEqual([]);
  });
});

describe('安全区与全局行为（D14 / R9 / R10）', () => {
  it('index.html 的 viewport 含 viewport-fit=cover', () => {
    const html = readFileSync(resolve(WEB, 'index.html'), 'utf8');
    const meta = /<meta\s+name="viewport"[\s\S]*?\/>/.exec(html);
    expect(meta, 'index.html 里找不到 viewport meta').not.toBeNull();
    expect(meta![0]).toContain('viewport-fit=cover');
    expect(meta![0]).toContain('width=device-width');
    expect(meta![0]).toContain('initial-scale=1.0');
  });

  it('index.css 含 overscroll-behavior / touch-action（限 coarse 指针）；安全区工具类只锁实际在用的类', () => {
    const css = readFileSync(resolve(SRC, 'index.css'), 'utf8');
    expect(css).toContain('overscroll-behavior-y: none');
    expect(css).toContain('@media (pointer: coarse)');
    expect(css).toContain('touch-action: manipulation');

    // 安全区工具类是单一来源。清尾轮 T1 的教训：**断言的类必须是真实存在的使用点**
    // （Tailwind 按内容扫描产出，无使用点的定义不进构建产物），否则这条断言等于在给
    // 死代码背书。故下面每个类都双查：index.css 有定义 + src/** 至少一个使用点。
    for (const cls of ['top-safe-16', 'right-safe-4', 'bottom-safe-6', 'right-safe-6', 'pb-safe-3']) {
      expect(css, `index.css 缺少 .${cls} 定义`).toContain(`.${cls} {`);
      expect(
        hits(new RegExp(`\\b${cls}\\b`)),
        `.${cls} 在 src/** 里没有任何使用点（死代码，不该留在 index.css）`,
      ).not.toEqual([]);
    }
    expect(css).toContain('env(safe-area-inset-bottom, 0px)');
    expect(css).toContain('env(safe-area-inset-top, 0px)');
  });
});

describe('页面外壳高度单位（R4）', () => {
  it('Layout.tsx 用 min-h-dvh，且不再出现 min-h-screen', () => {
    const layout = readFileSync(resolve(SRC, 'components/Layout.tsx'), 'utf8');
    expect(layout).toContain('min-h-dvh');
    expect(layout).not.toContain('min-h-screen');
  });
});

describe('四档断点哲学（D1：原型 data-tier 四个边界具名化）', () => {
  it('narrow/sheet/annos 三档取值 === 原型 data-tier 的 420/900/1180，nav 保留 720', () => {
    // 取值不得自定义：420 是「单列极窄档」、900 是「图纸档」、1180 是「标注档」，
    // 三者都直接来自原型 computeTier()（≤420 sm / ≤900 md / ≤1179 lg / ≥1180 xl）。
    // 改名成数字档（bp1/bp2）或换值都会让「原型是唯一视觉依据」这条失去锚点。
    const body = screensBody();
    expect(body).toMatch(/narrow:\s*['"]420px['"]/);
    expect(body).toMatch(/sheet:\s*['"]900px['"]/);
    expect(body).toMatch(/annos:\s*['"]1180px['"]/);
    expect(body).toMatch(/nav:\s*['"]720px['"]/);

    // 具名纪律：断点名必须是语义词，不得是 bp1 / xl2 这类序号
    const keys = [...body.matchAll(/^\s*['"]?([A-Za-z][\w-]*)['"]?\s*:/gm)].map((m) => m[1]);
    expect(keys).toEqual(['narrow', 'sheet', 'annos', 'nav']);
  });
});
