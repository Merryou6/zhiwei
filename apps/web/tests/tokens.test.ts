/**
 * 设计令牌纪律的静态闸门（2026-09-25 视觉重构 P1c 建立；2026-10-10 style-10 蓝图迁移 P2 换值）
 *
 * 与 breakpoints.test.ts 同一手法：直接读源文件 / 配置文本 + 正则断言，不拉起组件树。
 * 与它的分工：breakpoints 管「断点与安全区」，本文件管「字号、透明度、主题变量、动效、形状」。
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
 *                     :root（白图）与 html.dusk（蓝图）**两边都有值**，
 *                     否则切到某一套主题时该颜色会直接失效（inherit 成黑或透明）
 *   ④ 浏览器部件   —— :focus-visible / ::selection / caret-color / 滚动条
 *                     必须消费变量而不是硬编码 hex，否则蓝图主题要靠第二份
 *                     覆盖去打补丁（同一件事两个真相）
 *   ⑤ 动效引用     —— theme.animation 里引用的 keyframe 名必须真实存在于
 *                     theme.keyframes，否则动画静默不播放
 *   ⑥ 字号禁元组   —— fontSize 必须用单值字符串。写成 [size, { lineHeight }]
 *                     会额外注入 line-height，改变行高与布局（本轮刻意规避的隐性变更）
 *   ⑦ 已修死类     —— 收录此前修掉的三个不存在的类，防止复制粘贴时回流
 *   ⑧ accent 作文字 —— accent 只做填充与描边，文字走 accent-ink（对比度纪律）
 *   ⑨ 打印块完整   —— @media print 必须逐个覆盖前景/表面角色变量
 *   ⑩ 任意值圆角   —— 圆角只有「0 与 2px」两档（style-10 蓝图纪律）
 *   ⑪ 裸 band 令牌 —— 缺前缀的 band-* 不是 tailwind 类
 *   ⑫ 蓝图 token   —— 动效三 token（160/110/800ms + 单一缓动）与圆角刻度值
 *   ⑬ 图纸内边距   —— Sheet 的四档内边距走具名 token（M-1：实现向规范 §4.2 对齐）
 *
 * ⚠ 这套闸门只覆盖「能静态判定」的部分。它不能替代截图走查 ——
 *   一个类名合法但视觉平庸的页面，这里全绿。
 *
 * 【2026-10-10 style-10 迁移 P2 的改动口径】
 *   断言结构保留、只换值：主题名从「深色/浅色」改称「蓝图/白图」（**同一个 dusk class 开关**，
 *   见 tempui/STYLE-10-设计系统规范.md 第 2 章），新增 ⑫ 组三条蓝图 token 断言。
 *   本轮的 src 尚未落地，故 P2 这一步本文件为红是**预期中间态**，P3 末转绿。
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
 * 「蓝图主题必须再写一条 `html.dusk :focus-visible { ... }` 去打补丁」，
 * 结果「蓝图专版覆盖已删除」这条断言把注释当成了残留规则直接失败。
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
    // 这正是上一轮把 96 处 text-[13px] 换成 text-ui-sm 时必须避开的隐性布局变更。
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

  it('蓝图刻度（tok / mono-xs / body-sm / title-sm / title / num-lg）在 fontSize 里成组存在', () => {
    // 规范第 3 章：批注制式 .tok = 11px、极小档 10.5px、正文小档 13.5px、
    // 三级标题 17/20px、尺寸块主数字 26px。它们必须走令牌而不是任意值。
    const block = /fontSize:\s*\{([^}]*)\}/.exec(CONFIG);
    expect(block, 'tailwind.config.js 里找不到 fontSize 定义').not.toBeNull();
    for (const [token, value] of [
      ['tok', '11px'],
      ['mono-xs', '10.5px'],
      ['body-sm', '13.5px'],
      ['title-sm', '17px'],
      ['title', '20px'],
      ['num-lg', '26px'],
    ] as const) {
      expect(block![1], `fontSize 缺少蓝图刻度 ${token}`).toMatch(
        new RegExp(`['"]?${token}['"]?\\s*:\\s*['"]${value.replace('.', '\\.')}['"]`),
      );
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

describe('③ 主题变量成对（白图 :root 与蓝图 html.dusk 都必须有值）', () => {
  it('tailwind 引用的每个 --c-* 变量，在 :root 与 html.dusk 里都有定义', () => {
    const referenced = [
      ...new Set([...CONFIG.matchAll(/rgb\(var\(--(c-[a-z-]+)\)/g)].map((m) => m[1])),
    ];
    expect(referenced.length, 'tailwind.config.js 里没解析到任何 --c-* 变量引用').toBeGreaterThan(5);

    const light = cssBlock(/:root\s*\{([^}]*)\}/);
    const dark = cssBlock(/html\.dusk\s*\{([^}]*)\}/);
    expect(light).not.toBe('');

    for (const name of referenced) {
      expect(light, `:root 缺少 --${name}（白图下该颜色会失效）`).toContain(`--${name}:`);
      expect(dark, `html.dusk 缺少 --${name}（蓝图下该颜色会失效）`).toContain(`--${name}:`);
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

  it('蓝图四档色变量（--c-band-1..4 与 -t 系列）在 :root 与 html.dusk 里成对定义', () => {
    // 规范 2.2/2.3：四档「色 + 形状 + 文字」三重编码，蓝图与白图各一套色值。
    // 守恒区（tailwind 的 band-* 六个字面 hex）只能容纳白图那套，蓝图那套走变量，
    // 因此这里必须成对定义 —— 少一边就是「某套主题下四档色消失」。
    const light = cssBlock(/:root\s*\{([^}]*)\}/);
    const dark = cssBlock(/html\.dusk\s*\{([^}]*)\}/);
    for (const name of [
      '--c-band-1',
      '--c-band-2',
      '--c-band-3',
      '--c-band-4',
      '--c-band-1-t',
      '--c-band-2-t',
      '--c-band-3-t',
      '--c-band-4-t',
      '--c-band-0',
      '--c-hatch',
    ]) {
      expect(light, `:root 缺少 ${name}`).toContain(`${name}:`);
      expect(dark, `html.dusk 缺少 ${name}`).toContain(`${name}:`);
    }
  });
});

describe('④ 浏览器部件变量化（禁止硬编码 hex 与蓝图专版覆盖）', () => {
  it('焦点环 / 选中色 / 插入符 / 滚动条 消费变量', () => {
    expect(CSS).toContain('outline: 2px solid rgb(var(--c-accent))');
    expect(CSS).toContain('background-color: rgb(var(--c-accent) / 0.26)');
    expect(CSS).toContain('caret-color: rgb(var(--c-accent))');
    expect(CSS).toContain('scrollbar-color: rgb(var(--c-scroll-thumb)) transparent');
    expect(CSS).toContain('background-color: rgb(var(--c-scroll-thumb-hover))');
  });

  it('焦点环是双环（2px 描边 + 4px halo，规范第 9 章）', () => {
    // 单靠 2px 描边在蓝图深底上「看得出来但认不出」；halo 让焦点在两种底色上都成为
    // 明确的形状而不是一根线。取值锁在 token 里，不写死颜色。
    const focusBlock = cssBlock(/:focus-visible\s*\{([^}]*)\}/);
    expect(focusBlock, 'index.css 里找不到 :focus-visible 块').not.toBe('');
    expect(focusBlock).toContain('outline: 2px solid rgb(var(--c-accent))');
    expect(focusBlock).toContain('outline-offset: 2px');
    expect(focusBlock).toContain('box-shadow: 0 0 0 4px rgb(var(--c-focus-halo))');
  });

  it('不再保留 ::selection / caret / 滚动条 / focus-visible 的蓝图专版覆盖（变量化后它们只是第二份真相）', () => {
    for (const stale of [
      'html.dusk ::selection',
      'html.dusk ::-webkit-scrollbar-thumb',
      'html.dusk :focus-visible',
    ]) {
      expect(CSS, `${stale} 应已删除（改由变量自动跟随主题）`).not.toContain(stale);
    }
    // caret-color 的蓝图覆盖同样不该在（选择器是 html.dusk input 起的多行列表）
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
    // 这三个类在更早一轮之前一直存在，且全仓没有任何定义：
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
    // 为什么单独设一条：accent 在白图下是 #1A5FB4 落在 accent-veil 上、在天蓝
    // 作为小字时都不达 AA（规范 2.4：天蓝 #4E86D6 不做小字文本）。这类写法
    // 「看起来完全正确」，渲染出来也不报错，只是读起来费力 ——
    // accent-ink 是同一个「accent 作为文字」角色，专门满足 4.5:1。
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

describe('⑨ 打印块必须完整中性化蓝图主题', () => {
  it('@media print 覆盖全部前景/表面角色变量', () => {
    // 为什么需要这条：@media print 里的 html.dusk { ... } 是**追加**覆盖 ——
    // 没被列出的变量会保留上面那套蓝图取值。于是「蓝图 + 打印」会出现
    // 浅色文字落在白纸上（例如漏掉 --c-accent-ink 就是浅蓝 on white，读不出字）。
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
      expect(printPart, `打印块缺少 ${name} —— 蓝图主题下会打出不可读的对比度`).toContain(
        `${name}:`,
      );
    }
  });

  it('外壳元素靠 [data-print=hide] 显式标记，不用 header / aside 这类结构选择器', () => {
    // 页面自身的 <header> 也要打印，靠标签名会连它一起干掉。
    expect(CSS).toContain("[data-print='hide']");
  });
});

describe('⑩ 任意值圆角不回流（圆角刻度只有两档：0 与 2px）', () => {
  it('src/** 的 className 里不出现 rounded-[…] 这类任意值圆角', () => {
    // 蓝图纪律（规范 5.1/5.4）：圆角的真实刻度是**两档** ——
    //   r0 0px 状态 chip / 方块章 / 条形 / 注记（走内置 rounded-none）
    //   r  2px 面板、按钮、输入、卡片（走 rounded-control / rounded-surface 令牌）
    // 上一轮实测到残留任意值圆角（登录页两个下划线文字按钮上的 rounded-[4px]，
    // 它只影响焦点环形状，看起来无害，于是最容易被复制到别处）。这类值不报错、
    // 不挂测试、只是让同一件事多出一种写法，所以必须静态拦。
    // 注释行不算（历史记录改掉会让历史失真）。
    const found: string[] = [];
    for (const file of FILES) {
      file.text.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        if (/rounded(-[tb][rl]?)?-\[/.test(line)) {
          found.push(`${file.rel}:${index + 1}: ${trimmed.slice(0, 110)}`);
        }
      });
    }
    expect(found, '任意值圆角应改为 rounded-none(0) / rounded-control(2) / rounded-surface(2)').toEqual([]);
  });

  it('tailwind 的 borderRadius 扩展表只有 control / surface 两档，且值都是 2px', () => {
    const block = /borderRadius:\s*\{([^}]*)\}/.exec(CONFIG);
    expect(block, 'tailwind.config.js 里找不到 borderRadius 定义').not.toBeNull();

    const entries = [...block![1].matchAll(/([\w-]+)\s*:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
    expect(entries.map(([k]) => k).sort()).toEqual(['control', 'surface']);
    for (const [key, value] of entries) {
      expect(value, `borderRadius.${key} 必须是 2px（蓝图圆角纪律）`).toBe('2px');
    }
  });
});

describe('⑪ band 令牌必须带前缀（裸令牌名不是类）', () => {
  it('src/** 不出现裸 band-* 类名（应为 text-band-* / bg-band-* / border-band-*）', () => {
    // 这条与第 ⑦ 条「死类回归」不同：⑦ 抓的是拼错的类名，这里抓的是**拼写正确但缺前缀**
    // 的令牌名。真实案例（2026-09-25 重构 P3 修掉）：ConsoleHomePage 的 Stat 组件用
    // `tone?: string` 接收 "band-mastered" 再拼进 className，得到裸类 band-mastered。
    // Tailwind 的颜色工具类必须带前缀，浏览器对未知类静默忽略 —— 于是那两个 KPI 的
    // 颜色编码**从未渲染过**：不报错、不挂测试、看起来还像是「设计成这样」。
    // 这类写法最容易被复制，所以静态拦。
    // 注释行不算（Badge.tsx 的文件头在列举令牌名，那是合法陈述，不是类名）。
    const found: string[] = [];
    for (const file of FILES) {
      file.text.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
        // 前置必须是行首/空白/引号：bg-band-mastered 里 band 前面是连字符，不会误伤。
        if (/(^|[\s"'])band-(weak|unstable|basic|mastered)([\s"']|$)/.test(line)) {
          found.push(`${file.rel}:${index + 1}: ${trimmed.slice(0, 110)}`);
        }
      });
    }
    expect(found, '裸 band 令牌名不是 Tailwind 类，会被静默忽略').toEqual([]);
  });
});

describe('⑫ 蓝图 token（动效三档 + 单一缓动 + 形状刻度）', () => {
  it('动效三 token 取 160 / 110 / 800ms，缓动全站唯一', () => {
    // 规范第 8 章：UI 过渡 160ms、微交互 110ms、唯一大动效（引线描边）800ms，
    // 缓动只有一条 cubic-bezier(.2,.7,.3,1)。写成两条缓动等于「同一件事两种节奏」。
    const tokens = cssBlock(/:root\s*\{([^}]*)\}/);
    expect(tokens, 'index.css 的 :root 里找不到动效 token').not.toBe('');
    expect(tokens).toContain('--t-ui: 160ms;');
    expect(tokens).toContain('--t-fast: 110ms;');
    expect(tokens).toContain('--t-draw: 800ms;');
    expect(tokens).toContain('--ease-ui: cubic-bezier(.2, .7, .3, 1);');

    // 动效 token 只允许出现在 :root 一处（蓝图经 class 切换，不重定义时长）
    const occurrences = CSS.split('--t-ui:').length - 1;
    expect(occurrences, '--t-ui 只应在 :root 定义一次').toBe(1);
  });

  it('形状刻度 r=2px / r0=0px 在 :root 里成对存在', () => {
    const tokens = cssBlock(/:root\s*\{([^}]*)\}/);
    expect(tokens).toContain('--r: 2px;');
    expect(tokens).toContain('--r0: 0px;');
  });

  it('静态面一律无阴影：--shadow-card 为 none', () => {
    // 规范 2.5：图纸感来自线与面，静态面板一律无阴影，只有浮层保留一层投影。
    const light = cssBlock(/:root\s*\{([^}]*)\}/);
    const dark = cssBlock(/html\.dusk\s*\{([^}]*)\}/);
    expect(light).toMatch(/--shadow-card:\s*none;/);
    expect(dark).toMatch(/--shadow-card:\s*none;/);
  });
});

describe('⑬ 图纸内边距 token（M-1：实现向规范 §4.2 对齐，不修订规范既有值）', () => {
  it('extend.spacing 里 pad-frame 四个 token 存在，且值 = 规范 §4.2 / 原型逐值', () => {
    // 为什么单独锁一条：这四个值里 22 / 18 不落在 Tailwind 默认刻度上，
    // 而它们直接决定全站每一张图纸的内容可用宽。早前实现「取最近刻度」（24/16）
    // 让规范与实现各说一套（M-1 漂移）—— 没有断言时，这种漂移只会在截图里
    // 「看着差不多」，谁也不会发现。值的事实源是原型 L140/L680/L681。
    const block = /spacing:\s*\{([^}]*)\}/.exec(CONFIG);
    expect(block, 'tailwind.config.js 里找不到 spacing 定义').not.toBeNull();
    for (const [token, value] of [
      ['pad-frame-md-y', '22px'], // 原型 L680 上内边距
      ['pad-frame-md-x', '18px'], // 原型 L680 左右内边距
      ['pad-frame-md-b', '12px'], // 原型 L680 下内边距
      ['pad-frame-sm-b', '10px'], // 原型 L681 下内边距
    ] as const) {
      expect(block![1], `spacing 缺少图纸内边距 token ${token}（规范 §4.2 的 Sheet 内边距）`).toMatch(
        new RegExp(`['"]?${token}['"]?\\s*:\\s*['"]${value.replace('.', '\\.')}['"]`),
      );
    }
  });

  it('Sheet 内边距类只经 token 与默认刻度表达，无裸任意值内边距', () => {
    // 反向锁：token 定义得再齐，实现里若又写回 pt-[22px]，刻度依旧是空的。
    // 与 ①/⑩ 同一手法 —— 这类写法不报错、不失效，只是悄悄绕过刻度。
    const sheet = FILES.find((file) => file.rel.endsWith('components/blueprint/Sheet.tsx'));
    expect(sheet, 'apps/web/src 下找不到 blueprint/Sheet.tsx').toBeTruthy();
    const paddingArbitrary = sheet!.text
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        // 注释行不算（与 ⑧/⑩/⑪ 同一口径）：文件头正是在**举例说明禁止哪种写法**，
        // 把注释一起拦下会逼着注释不敢举反例，闸门反而更难读。
        if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return false;
        return /(?:^|[\s"':])(?:p|pt|pr|pb|pl|px|py)-\[[^\]]+\]/.test(line);
      });
    expect(paddingArbitrary, '图纸内边距禁止裸任意值类，应走 pad-frame-* / 默认刻度 token').toEqual([]);
  });
});
