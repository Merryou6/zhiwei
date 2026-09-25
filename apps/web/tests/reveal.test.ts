// @vitest-environment jsdom
/**
 * 滚动揭示机制的闸门（2026-09-25 视觉重构 P0）
 *
 * 【为什么必须存在】
 * 揭示是动效里**唯一会隐藏内容**的一种，因此它的失败模式不是「少一点观感」而是
 * 「内容看不见」。而它的错误写法恰好是最自然的那种直觉写法 ——
 * CSS 里把区块默认设成 opacity: 0，交给 JS 在进入视口时揭示。
 * 那种写法在三种情况下会让首屏之外的区块永久隐形：
 *   · 用户系统开了「减弱动态效果」（动画被压到 0.01ms，永远不会「揭示」）
 *   · 打印（纸面上不存在「进入视口」这件事）
 *   · JS 未执行 / 抛错（观察器根本没建起来）
 *
 * 正确写法是反过来：**隐藏是被授予的权限，不是默认状态**。CSS 默认全可见，
 * 只有 JS 确认环境允许时才挂 [data-reveal='on'] 启用隐藏。
 *
 * 下面 ①–③ 锁 JS 侧的判定条件，④–⑤ 锁 DOM 操作，⑥–⑦ 锁 CSS 侧的作用域前缀
 * 与两处可见性兜底 —— 后两条是最重要的：它们保证「就算 JS 逻辑整个错了，
 * 内容也不会消失」。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REVEAL_DONE_ATTR,
  REVEAL_ITEM_ATTR,
  REVEAL_SCOPE_ATTR,
  armReveal,
  markInViewDone,
  observeReveal,
  revealAvailable,
} from '../src/lib/reveal';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** CSS 正文：先剥注释再断言（与 tokens.test.ts 同一手法 —— 注释里的范例不该被当规则）。 */
const CSS = readFileSync(resolve(WEB, 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type Entry = { isIntersecting: boolean; target: Element };

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  private readonly callback: (entries: Entry[]) => void;

  constructor(callback: (entries: Entry[]) => void) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
  }

  disconnect() {
    this.observed.clear();
  }

  /** 测试驱动：让给定元素「进入视口」。 */
  reveal(elements: Element[]) {
    this.callback(elements.map((target) => ({ isIntersecting: true, target })));
  }
}

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({ matches: reduced, media: query }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeIntersectionObserver.instances = [];
  document.documentElement.removeAttribute(REVEAL_SCOPE_ATTR);
});

describe('① 启用条件：缺一不可', () => {
  it('环境没有 IntersectionObserver 时**不启用**（元素保持可见）', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    stubMatchMedia(false);
    expect(revealAvailable()).toBe(false);
  });

  it('有 IntersectionObserver 且未要求减弱动效 → 启用', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    stubMatchMedia(false);
    expect(revealAvailable()).toBe(true);
  });

  it('用户要求减弱动效 → **不启用**，即便 IntersectionObserver 可用', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    stubMatchMedia(true);
    expect(revealAvailable()).toBe(false);
  });
});

describe('② 开关属性：挂得上、撤得掉', () => {
  it('armReveal 挂 REVEAL_SCOPE_ATTR；撤销函数把它移除', () => {
    const scope = document.createElement('div');
    expect(scope.hasAttribute(REVEAL_SCOPE_ATTR)).toBe(false);

    const disarm = armReveal(scope);
    expect(scope.getAttribute(REVEAL_SCOPE_ATTR)).toBe('on');

    disarm();
    expect(scope.hasAttribute(REVEAL_SCOPE_ATTR)).toBe(false);
  });
});

describe('③ 观察器：只盯未完成项，进入视口即标记并停止观察', () => {
  it('已带完成标记的项不再被观察（避免重复动画）', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    stubMatchMedia(false);

    const scope = document.createElement('div');
    const pending = document.createElement('section');
    pending.setAttribute(REVEAL_ITEM_ATTR, '');
    const done = document.createElement('section');
    done.setAttribute(REVEAL_ITEM_ATTR, '');
    done.setAttribute(REVEAL_DONE_ATTR, '');
    scope.append(pending, done);

    observeReveal(scope);

    const io = FakeIntersectionObserver.instances.at(-1);
    expect(io?.observed.size).toBe(1);
    expect(io?.observed.has(pending)).toBe(true);
    expect(io?.observed.has(done)).toBe(false);
  });

  it('进入视口 → 打上完成标记并取消观察；未进入视口的项保持待揭示', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    stubMatchMedia(false);

    const scope = document.createElement('div');
    const first = document.createElement('section');
    const second = document.createElement('section');
    for (const el of [first, second]) {
      el.setAttribute(REVEAL_ITEM_ATTR, '');
      scope.append(el);
    }

    observeReveal(scope);
    const io = FakeIntersectionObserver.instances.at(-1)!;
    io.reveal([first]);

    expect(first.getAttribute(REVEAL_DONE_ATTR)).toBe('');
    expect(second.hasAttribute(REVEAL_DONE_ATTR)).toBe(false);
    // 完成后不再观察，避免元素移出再移入时重播动画
    expect(io.observed.has(first)).toBe(false);
    expect(io.observed.has(second)).toBe(true);
  });
});

describe('④ 首屏内的项先标记（避免加载瞬间闪一下）', () => {
  it('已在视口内的项被标记；视口下方的项保持待揭示', () => {
    // 为什么要先标记再挂开关：观察器回调是异步的（下一帧才派发初始状态），
    // 而挂上开关的那一刻 CSS 就生效了。不先标记的话，首屏内的区块会经历
    // 「可见 → 被隐藏 → 被揭示」一帧闪烁 —— 内容没丢，但加载瞬间会明显抖一下。
    const scope = document.createElement('div');
    const above = document.createElement('section');
    const below = document.createElement('section');
    for (const el of [above, below]) {
      el.setAttribute(REVEAL_ITEM_ATTR, '');
      scope.append(el);
    }

    // jsdom 不做布局，getBoundingClientRect 恒为 0 —— 逐元素打桩来区分两种位置
    vi.spyOn(above, 'getBoundingClientRect').mockReturnValue({ top: 120 } as DOMRect);
    vi.spyOn(below, 'getBoundingClientRect').mockReturnValue({ top: 4000 } as DOMRect);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    markInViewDone(scope);

    expect(above.getAttribute(REVEAL_DONE_ATTR)).toBe('');
    expect(below.hasAttribute(REVEAL_DONE_ATTR)).toBe(false);
  });

  it('已带完成标记的项不被重复处理（不产生重复标记）', () => {
    const scope = document.createElement('div');
    const done = document.createElement('section');
    done.setAttribute(REVEAL_ITEM_ATTR, '');
    done.setAttribute(REVEAL_DONE_ATTR, '');
    scope.append(done);

    const spy = vi.spyOn(done, 'getBoundingClientRect');
    markInViewDone(scope);

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('⑤ CSS 侧：隐藏必须被授予，且两处必须有兜底', () => {
  it('预置态规则带 [data-reveal=on] 作用域前缀（JS 常量与 CSS 字面量一致）', () => {
    const scoped = new RegExp(
      `\\[${REVEAL_SCOPE_ATTR}=['"]on['"]\\]\\s+\\[${REVEAL_ITEM_ATTR}\\]:not\\(\\[${REVEAL_DONE_ATTR}\\]\\)`,
    );
    expect(
      scoped.test(CSS),
      `index.css 里找不到「[${REVEAL_SCOPE_ATTR}='on'] [${REVEAL_ITEM_ATTR}]:not([${REVEAL_DONE_ATTR}])」这条规则 —— ` +
        '若要隐藏揭示项，必须限定在该作用域内，否则元素在无 JS / 减弱动效 / 打印下会永久隐形',
    ).toBe(true);
  });

  it('减弱动效块与打印块都必须给 [data-reveal-item] 兜底可见性', () => {
    const safetyNet =
      /\[data-reveal-item\]\s*\{\s*opacity:\s*1\s*!important;\s*transform:\s*none\s*!important;\s*\}/g;
    const found = CSS.match(safetyNet)?.length ?? 0;
    expect(
      found,
      `两处兜底只找到 ${found} 处：@media (prefers-reduced-motion: reduce) 与 @media print 各需一条`,
    ).toBe(2);

    // 兜底必须落在真正的降级块里，而不是散落在别处
    expect(CSS).toContain('@media (prefers-reduced-motion: reduce)');
    expect(CSS).toContain('@media print');
  });

  it('被标记完成时真的有入场动画（keyframes 必须就地定义，不能依赖 tailwind 产出）', () => {
    // 这条锁的是一类特别的静默失效：动画「配置齐全但从不播放」。
    // 上一版把 reveal 的 keyframes 放在 tailwind.config.js 的动画令牌里，
    // 而源码中永远不会出现 animate-reveal 这个类（揭示的触发条件是 data-revealed
    // **属性被加上**，不是类名被挂上）—— 于是 @keyframes reveal 根本不进产物，
    // 元素照样显示、只是没有动画，tsc 与所有测试都不报。
    // tokens.test.ts ⑤ 也防不到：它校验的是「animation 引用的 keyframe 存在」，
    // 管不了「这个类名从未被使用」。所以必须在这里就地断言。
    expect(CSS).toContain('@keyframes reveal-in');
    expect(CSS).toContain("[data-reveal='on'] [data-reveal-item][data-revealed]");
    expect(CSS).toContain('animation: reveal-in');
  });
});
