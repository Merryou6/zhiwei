/**
 * 断点与令牌纪律的静态闸门（2026-09-24 移动端适配轮，计划 3.4 / 7.1）
 *
 * 与 stages.test.ts 同一手法：直接读源文件文本 + 正则断言，不拉起组件树。
 * 存在的意义：本轮把「导航收纳断点」收敛成 tailwind 的具名断点 nav:720px，
 * 并清掉了 3 处裸 z 值；这类纪律靠人肉 grep 守不住（写错只是样式静默失效，
 * 不报错、不挂测试），所以固化成闸门：
 *
 *   ① 断点单一定义    —— tailwind.config.js 的 screens 里必须有 nav: '720px'
 *   ② 任意值断点清零  —— src/** 不得再出现 min-[NNNpx]: / max-[NNNpx]:
 *   ③ 裸 z-index 清零 —— src/** 不得出现 z-[
 *   ④ 裸 hex 清零     —— src/** 的 className 字面量属性不得出现 #rrggbb
 *   ⑤ viewport-fit    —— index.html 的 viewport 必须含 viewport-fit=cover
 *   ⑥ 全局 CSS        —— index.css 必须含 overscroll-behavior / touch-action，且其中的安全区
 *                        工具类每个都有真实使用点（清尾轮 T1：.pt-safe/.pb-safe 两个零使用点的
 *                        死类已删，断言随之改锁实际在用的类）
 *   ⑦ 外壳高度单位    —— Layout.tsx 用 min-h-dvh，且不再有 min-h-screen
 *   ⑧ 断点两处同源    —— MobileNav.tsx 的 NAV_COLLAPSE_MIN_WIDTH_PX（JS 侧「越界自动关闭」用，
 *                        总控直接模式补丁，改后审查）必须与 tailwind 的 screens.nav 同值且真接线
 *
 * ⚠ 「合法保留」白名单（以下**不在**断言范围，别把它们当成破绽删掉）：
 *   · LoginPage.tsx 的 ERROR_TEXT 常量 text-[#FFB088]（深底既有色，实测 11.0:1）
 *     —— 它是 JS 常量、不是 className 字面量属性，故 ④ 天然扫不到；
 *   · src/theme/bands.ts、src/stores/theme.ts、tailwind.config.js 的 colors：
 *     令牌源本身，按定义就是字面 hex；
 *   · GraphPage 的 ECharts 画布回退色：canvas 绘制参数，不是 CSS 类名；
 *   · ReportPage 的 min-w-[420px]：**宽度工具类**（任意值后面没有冒号），
 *     是 ② 的合法保留项——正则带冒号后缀正是为了不误伤它。
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

describe('断点单一定义（tailwind.config.js 的 screens.nav）', () => {
  it("tailwind.config.js 的 screens 只定义 nav: '720px'，且 src/** 两侧变体都真的用上了（防拼写错误静默失效）", () => {
    const config = readFileSync(resolve(WEB, 'tailwind.config.js'), 'utf8');

    // 只匹配**平铺**写法：screens 的值直接是字符串，body 里不该出现 `}`。
    // 旧写法 /screens:\s*\{([\s\S]*?)\}/ 是非贪婪的，会把将来嵌套对象写法
    // （如 nav: { min: '720px' }）截断在第一个 `}` 之前，keys 提取失真。
    // ⚠ 若将来 config 真的改成嵌套写法，本断言必须同步改写（此处不支持嵌套解析）。
    const screens = /screens:\s*\{([^}]*)\}/.exec(config);
    expect(screens, 'tailwind.config.js 里找不到 screens 定义').not.toBeNull();

    const body = screens![1];
    const keys = [...body.matchAll(/^\s*['"]?([A-Za-z][\w-]*)['"]?\s*:/gm)].map((m) => m[1]);
    expect(keys).toEqual(['nav']);
    expect(body).toMatch(/nav:\s*['"]720px['"]/);

    // 断点写对了但类名写错（nav:/max-nav: 拼错）时样式会静默失效，故两侧都要求有使用点
    // （[^\w-] 前缀排除 max-nav: 的误命中——它的 nav: 前面是连字符）
    expect(hits(/[^\w-]nav:/).length).toBeGreaterThan(0);
    expect(hits(/\bmax-nav:/).length).toBeGreaterThan(0);
  });

  it('src/** 无任意值断点变体（/(min|max)-[NNNpx]:/，判别特征是任意值后紧跟冒号）', () => {
    expect(hits(/(?:min|max)-\[\d+px\]:/)).toEqual([]);
  });

  it('MobileNav 的 JS 侧收纳断点常量与 tailwind screens.nav 同值（CSS 一份 + JS 一份，必须同源）', () => {
    // 抽屉的隐藏由 CSS（nav:hidden）负责，但「越到 ≥720 就自动关闭」必须由 JS 判断，
    // 于是同一个数字存在两处。漂移的后果是真实缺陷（见 MobileNav.tsx 的注释：
    // 拉宽后 open 残留 → 正文 aria-hidden 不撤 + Tab 焦点陷阱对隐藏子树无效），
    // 所以此处把「同值」与「真的接上了」一起固化成断言。
    const nav = readFileSync(resolve(SRC, 'components/MobileNav.tsx'), 'utf8');
    const declared = /NAV_COLLAPSE_MIN_WIDTH_PX\s*=\s*(\d+)/.exec(nav);
    expect(declared, 'MobileNav.tsx 里找不到 NAV_COLLAPSE_MIN_WIDTH_PX 常量').not.toBeNull();
    const px = Number(declared![1]);

    const config = readFileSync(resolve(WEB, 'tailwind.config.js'), 'utf8');
    expect(config, `tailwind screens.nav 与 JS 常量（${px}）不同值`).toMatch(
      new RegExp(`nav:\\s*['"]${px}px['"]`),
    );

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
    // 死代码背书——原先这里锁的 .pt-safe / .pb-safe 全站零使用点，已于清尾轮删除。
    // 故下面每个类都双查：index.css 有定义 + src/** 至少一个使用点。
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
