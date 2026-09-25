/**
 * 设计令牌纪律的静态闸门（2026-09-25 视觉重构 P1c）
 *
 * 与 breakpoints.test.ts 同一手法：直接读源文件 / 配置文本 + 正则断言，不拉起组件树。
 * 与它的分工：breakpoints 管「断点与安全区」，本文件管「字号、透明度、主题变量、动效」。
 *
 * 【为什么必须存在】
 * 本轮重构前的审计发现：这个项目最大的问题不是「样式难看」，而是**大量样式在
 * 静默失效** —— 写了不存在的类、用了不存在的令牌，浏览器不报错、构建不报错、
 * 测试也不报错，只是那一条样式没生效。靠人眼和 grep 守不住，因为它们全都
 * 「看起来是对的」。以下每条断言都对应一个真实发生过的缺陷：
 *
 *   ① 任意值字号   —— 收敛前 text-[13px] 有 96 处，字号从未被令牌化
 *   ② 透明度刻度   —— Tailwind 默认 opacity 只认 5 的倍数，全站 12 处「band 色 + /12」
 *                     一直在无声失效（「已验证」「当前使用」等徽标其实没有底色）
 *   ③ 主题变量成对 —— tailwind 里 rgb(var(--c-X)) 引用的每个变量，必须在
 *                     :root（浅色）与 html.dusk（深色）**两边都有值**，
 *                     否则切到某一套主题时该颜色会直接失效（inherit 成黑或透明）
 *   ④ 浏览器部件   —— :focus-visible / ::selection / caret-color / 滚动条
 *                     必须消费变量而不是硬编码 hex，否则深色主题要靠第二份
 *                     覆盖去打补丁（同一件事两个真相）
 *   ⑤ 动效引用     —— theme.animation 里引用的 keyframe 名必须真实存在于
 *                     theme.keyframes，否则动画静默不播放
 *   ⑥ 字号禁元组   —— fontSize 必须用单值字符串。写成 [size, { lineHeight }]
 *                     会额外注入 line-height，改变行高与布局（本轮刻意规避的隐性变更）
 *   ⑦ 已修死类     —— 收录本轮修掉的三个不存在的类，防止复制粘贴时回流
 *
 * ⚠ 这套闸门只覆盖「能静态判定」的部分。它不能替代截图走查 ——
 *   一个类名合法但视觉平庸的页面，这里全绿。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** apps/web/tests → 仓库根 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WEB = resolve(REPO_ROOT, 'apps/web');
const SRC = resolve(WEB, 'src');

function scanSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
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

function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    file.text.split('\n').forEach((line, index) => {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      if (re.test(line)) found.push(`${file.rel}:${index + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return found;
}

const CONFIG = readFileSync(resolve(WEB, 'tailwind.config.js'), 'utf8');

/**
 * CSS **正文**：先剥掉注释再断言。
 * 理由是本闸门第一次跑就踩到的坑 —— 注释里写了一句
 * 「深色主题必须再写一条 `html.dusk :focus-visible { ... }` 去打补丁」，
 * 结果「深色专版覆盖已删除」这条断言把注释当成了残留规则直接失败。
 * 断言必须对真实规则生效，否则注释能同时制造假失败与假通过。
 */
const CSS = readFileSync(resolve(SRC, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** 取出 CSS 里第一个 `选择器 { ... }` 的声明体（本项目这些块内不含嵌套花括号）。 */
function cssBlock(selectorPattern: RegExp): string {
  const match = selectorPattern.exec(CSS);
  return match ? match[1] : '';
}

/** Tailwind 默认 opacity 刻度：5 的倍数。 */
const OPACITY_SCALE = new Set(
  Array.from({ length: 21 }, (_unused, index) => index * 5),
);

describe('① 字号令牌（禁止任意值字号回流）', () => {
  it('src/** 无 text-[NNpx] 任意值字号（全部走 fontSize 令牌）', () => {
    expect(hits(/text-\[\d+px\]/)).toEqual([]);
  });

  it('⑥ fontSize 令牌必须用单值字符串，禁止 [size, { lineHeight }] 元组', () => {
    // 元组写法会额外注入 line-height，凭空改变行高与兄弟元素位置 ——
    // 这正是本轮把 96 处 text-[13px] 换成 text-ui-sm 时必须避开的隐性布局变更。
    const block = /fontSize:\s*\{([^}]*)\}/.exec(CONFIG);
    expect(block, 'tailwind.config.js 里找不到 fontSize 定义').not.toBeNull();

    // 逐行断言：形如 `'ui-sm': '13px',` 合法；出现 `[` 即元组，直接失败。
    const lines = block![1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line, `fontSize 令牌疑似写成元组（会注入 line-height）：${line}`).not.toContain('[');
      expect(line).toMatch(/^['"]?[\w-]+['"]?\s*:\s*['"][\d.]+(px|rem)['"],?$/);
    }
  });
});

describe('② 透明度刻度（非 5 的倍数会整条静默失效）', () => {
  it('src/** 的颜色类透明度分母必须是 5 的倍数', () => {
    // 两类写法都要查：命名色（bg-band-weak/12）与任意值色（text-[#fff]/12）。
    const patterns = [
      /\b(?:bg|text|border|ring|divide|outline|fill|stroke|placeholder|from|via|to|caret|decoration|shadow)-[a-z0-9-]+\/(\d{1,3})(?![0-9\]%/])/g,
      /\[[^\]\s]+\]\/(\d{1,3})(?![0-9\]%/])/g,
    ];
    const bad: string[] = [];
    for (const file of FILES) {
      file.text.split('\n').forEach((line, index) => {
        for (const pattern of patterns) {
          const re = new RegExp(pattern.source, 'g');
          let match: RegExpExecArray | null;
          while ((match = re.exec(line)) !== null) {
            const n = Number(match[1]);
            if (!OPACITY_SCALE.has(n)) {
              bad.push(`${file.rel}:${index + 1}: ${match[0]}（/${n} 不在刻度内）`);
            }
          }
        }
      });
    }
    expect(bad).toEqual([]);
  });
});

describe('③ 主题变量成对（浅色与深色都必须有值）', () => {
  it('tailwind 引用的每个 --c-* 变量，在 :root 与 html.dusk 里都有定义', () => {
    const referenced = [
      ...new Set([...CONFIG.matchAll(/rgb\(var\(--(c-[a-z-]+)\)/g)].map((m) => m[1])),
    ];
    expect(referenced.length, 'tailwind.config.js 里没解析到任何 --c-* 变量引用').toBeGreaterThan(5);

    const light = cssBlock(/:root\s*\{([^}]*)\}/);
    const dark = cssBlock(/html\.dusk\s*\{([^}]*)\}/);
    expect(light).not.toBe('');

    for (const name of referenced) {
      expect(light, `:root 缺少 --${name}（浅色主题下该颜色会失效）`).toContain(`--${name}:`);
      expect(dark, `html.dusk 缺少 --${name}（深色主题下该颜色会失效）`).toContain(`--${name}:`);
    }
  });

  it('--shadow-card / --shadow-overlay 在两套主题下都有定义', () => {
    const light = cssBlock(/:root\s*\{([^}]*)\}/);
    const dark = cssBlock(/html\.dusk\s*\{([^}]*)\}/);
    for (const name of ['--shadow-card', '--shadow-overlay']) {
      expect(light, `:root 缺少 ${name}`).toContain(`${name}:`);
      expect(dark, `html.dusk 缺少 ${name}`).toContain(`${name}:`);
    }
  });
});

describe('④ 浏览器部件变量化（禁止硬编码 hex 与深色专版覆盖）', () => {
  it('焦点环 / 选中色 / 插入符 / 滚动条 消费变量', () => {
    expect(CSS).toContain('outline: 2px solid rgb(var(--c-accent))');
    expect(CSS).toContain('background-color: rgb(var(--c-accent) / 0.26)');
    expect(CSS).toContain('caret-color: rgb(var(--c-accent))');
    expect(CSS).toContain('scrollbar-color: rgb(var(--c-scroll-thumb)) transparent');
    expect(CSS).toContain('background-color: rgb(var(--c-scroll-thumb-hover))');
  });

  it('不再保留 ::selection / caret / 滚动条 / focus-visible 的深色专版覆盖（变量化后它们只是第二份真相）', () => {
    for (const stale of [
      'html.dusk ::selection',
      'html.dusk ::-webkit-scrollbar-thumb',
      'html.dusk :focus-visible',
    ]) {
      expect(CSS, `${stale} 应已删除（改由变量自动跟随主题）`).not.toContain(stale);
    }
    // caret-color 的深色覆盖同样不该在（选择器是 html.dusk input 起的多行列表）
    expect(CSS).not.toMatch(/html\.dusk\s+input,\s*\nhtml\.dusk\s+textarea/);
  });
});

describe('⑤ 动效引用完整（animation 引用的 keyframe 必须存在）', () => {
  it('theme.animation 里每个动画名的 keyframe 都在 theme.keyframes 中定义', () => {
    const kfBlock = /keyframes:\s*\{([\s\S]*?)\n      \},/.exec(CONFIG);
    const animBlock = /animation:\s*\{([^}]*)\}/.exec(CONFIG);
    expect(kfBlock, '找不到 keyframes 定义').not.toBeNull();
    expect(animBlock, '找不到 animation 定义').not.toBeNull();

    const defined = new Set(
      [...kfBlock![1].matchAll(/^\s{8}['"]?([\w-]+)['"]?\s*:/gm)].map((m) => m[1]),
    );
    const used = [...animBlock![1].matchAll(/:\s*['"]?([\w-]+)\s/gm)].map((m) => m[1]);

    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(defined, `animation 引用了未定义的 keyframe「${name}」——动画会静默不播放`).toContain(name);
    }
  });
});

describe('⑦ 已修死类不回流', () => {
  it('不存在的类不再出现（bg-sunken / card-hover / fab-rise）', () => {
    // 这三个类在本轮之前一直存在，且全仓没有任何定义：
    //   bg-sunken —— tailwind 里没有这个令牌（意图是下沉底色，已改 bg-canvas）
    //   card-hover —— 全仓无定义
    //   fab-rise  —— index.css 里没有任何 @keyframes（已改令牌动画 animate-rise）
    // 说明：完整的「未知类检测器」需要把 Tailwind 全部默认刻度复刻一遍，代价高且脆弱；
    // 这里只锁回归，新类名仍需靠人审 + 截图走查。
    for (const dead of ['bg-sunken', 'card-hover', 'fab-rise']) {
      const found = hits(new RegExp(`\\b${dead}\\b`));
      // BackToTop.tsx 的说明性注释里会提到 fab-rise，属合法；只拦「当类名用」的场合。
      const asClass = found.filter((line) => !line.includes('*'));
      expect(asClass, `死类 ${dead} 又回到代码里了`).toEqual([]);
    }
  });
});

describe('⑧ accent 只做填充与描边，文字一律走 accent-ink', () => {
  it('src/** 不再出现 text-accent（应为 text-accent-ink）', () => {
    // 为什么单独设一条：accent 在浅色下是 #4E8FB0，当文字只有 3.57:1（白底）/
    // 3.15:1（accent-veil 上），不达 AA。这类写法「看起来完全正确」，渲染出来也不报错，
    // 只是读起来费力 —— 项目此前已经踩过一次（ChatTracePanel 里把「进行中」降级成灰色）。
    // accent-ink = #2E6B87（白底 5.95:1 / veil 上 5.26:1），是同一个「accent 作为文字」角色。
    // 注释行不算 —— 注释里提到 text-accent 多半是在记录历史结论，改掉会让历史失真。
    const found: string[] = [];
    for (const file of FILES) {
      file.text.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (/text-accent(?![\w-])/.test(line)) {
          found.push(`${file.rel}:${index + 1}: ${trimmed.slice(0, 110)}`);
        }
      });
    }
    expect(found).toEqual([]);
  });
});

describe('⑨ 打印块必须完整中性化深色主题', () => {
  it('@media print 覆盖全部前景/表面角色变量', () => {
    // 为什么需要这条：@media print 里的 html.dusk { ... } 是**追加**覆盖 ——
    // 没被列出的变量会保留上面那套深色取值。于是「深色主题 + 打印」会出现
    // 浅色文字落在白纸上（例如漏掉 --c-accent-ink 就是 #6FB3D4 on white = 2.31:1）。
    // 这类漏项不会报错，只会打出一张几乎读不清的纸。
    const printPart = CSS.slice(CSS.indexOf('@media print'));
    expect(printPart.length, 'index.css 里找不到 @media print 块').toBeGreaterThan(0);

    for (const name of [
      '--c-canvas',
      '--c-surface',
      '--c-raised',
      '--c-ink',
      '--c-ink-soft',
      '--c-line',
      '--c-accent',
      '--c-accent-ink',
      '--c-accent-veil',
      '--c-on-accent',
      '--c-danger',
      '--shadow-card',
      '--shadow-overlay',
    ]) {
      expect(printPart, `打印块缺少 ${name} —— 深色主题下会打出不可读的对比度`).toContain(
        `${name}:`,
      );
    }
  });

  it('外壳元素靠 [data-print=hide] 显式标记，不用 header / aside 这类结构选择器', () => {
    // 页面自身的 <header> 也要打印，靠标签名会连它一起干掉。
    expect(CSS).toContain("[data-print='hide']");
  });
});
