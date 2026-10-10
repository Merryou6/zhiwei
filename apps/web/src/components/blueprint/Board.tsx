/**
 * Board 制图板（style-10 蓝图迁移 P4 / 规范 4.1）
 *
 * 四层骨架的最外层：底色 + 四角十字标记 + 图幅档（data-tier）+ 两个图层开关
 * （rail / annos）。它不接管路由、不读 store、不渲染任何导航 —— 那些是外壳
 * （Layout）的职责，Board 只回答「这是哪张板、多大、哪两个图层开着」。
 *
 * 【图幅档怎么来】D1：不引入全局 JS data-tier 驱动布局，布局一律走 @media 具名断点
 * （narrow/sheet/annos）。这里算出来的 tier 只用于**语义表达**（标题栏比例、dim 行文案、
 * 标注卡是否可画引线），因此用组件内 matchMedia 监听即可，与 mobileNav.ts 同款先例。
 *
 * 【skip link】四层骨架有固定的阅读起点（图签条 → 索引 → 图纸），键盘用户第一跳
 * 直接到图纸主体：`<a href="#sheet">跳到图纸主体</a>`，聚焦时落到板内左上角。
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

/** 四档视口（与设计规范 4.2 的矩阵逐行对应）。 */
export type BlueprintTier = 'xl' | 'lg' | 'md' | 'sm';

/** 原型 computeTier()：≤420 sm / ≤900 md / ≤1179 lg / ≥1180 xl。 */
export function tierOfWidth(width: number): BlueprintTier {
  if (width <= 420) return 'sm';
  if (width <= 900) return 'md';
  if (width <= 1179) return 'lg';
  return 'xl';
}

function readWidth(): number {
  try {
    if (typeof window === 'undefined') return 1180;
    return window.innerWidth || document.documentElement.clientWidth || 1180;
  } catch {
    return 1180;
  }
}

/** 当前图幅档（matchMedia 三档监听；SSR / 无 window 时按 xl）。 */
export function useBlueprintTier(): BlueprintTier {
  const [tier, setTier] = useState<BlueprintTier>(() => tierOfWidth(readWidth()));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const queries = ['(max-width: 420px)', '(max-width: 900px)', '(max-width: 1179px)'];
    const lists = queries.map((query) => window.matchMedia(query));
    const sync = (): void => setTier(tierOfWidth(readWidth()));
    sync();
    for (const list of lists) list.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      for (const list of lists) list.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  return tier;
}

/** 四角十字标记的位置类（原型 .corner.tl/.tr/.bl/.br）。 */
const CORNERS: readonly { key: string; className: string }[] = [
  { key: 'tl', className: 'left-2.5 top-2.5 border-b-0 border-r-0' },
  { key: 'tr', className: 'right-2.5 top-2.5 border-b-0 border-l-0' },
  { key: 'bl', className: 'bottom-2.5 left-2.5 border-r-0 border-t-0' },
  { key: 'br', className: 'bottom-2.5 right-2.5 border-l-0 border-t-0' },
];

export interface BoardProps {
  /** 缺省由内部 matchMedia 推导；显式传入用于测试与固定图幅导出。 */
  tier?: BlueprintTier;
  /** landing：门户图（无索引 / 无标注列 / 无标题栏 / 无底部导航）。 */
  view?: 'shell' | 'landing';
  railOpen?: boolean;
  annosOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Board({
  tier,
  view = 'shell',
  railOpen = true,
  annosOpen = false,
  className,
  children,
}: BoardProps) {
  const detected = useBlueprintTier();
  const effective = tier ?? detected;

  return (
    <div
      data-tier={effective}
      data-view={view}
      data-rail={railOpen ? 'on' : 'off'}
      data-annos={annosOpen ? 'on' : 'off'}
      className={cn(
        // 板面底色：白图 #F4F7FA / 蓝图 #0B1B2B，由角色令牌承担（规范 2.5）。
        'relative min-h-dvh bg-canvas text-ink',
        className,
      )}
    >
      {/* skip link：默认推到视口外，聚焦时落到图签条下方。
          top 用 `top-safe-16`（= env(safe-area-inset-top,0px) + 4rem）而不是一个裸值：
          4rem 恰好把落点放到底高约 56px 的图签条之下，安全区保证刘海屏上不被切掉。
          ⚠ 该类同时是 breakpoints.test.ts ⑥ 要求「必须有真实使用点」的五个安全区类之一
          （本轮 Toast 从右上移到了右下，落点由这里承接，见 Toast.tsx 的留痕）。 */}
      <a
        href="#sheet"
        className="absolute left-2 top-[-60px] z-nav border border-line bg-surface px-3.5 py-2.5 text-ui-sm text-ink transition-[top] duration-100 ease-out focus-visible:top-safe-16"
      >
        跳到图纸主体
      </a>

      {/* 图框四角十字标记（纯装饰，规范 4.1） */}
      {view === 'shell'
        ? CORNERS.map((corner) => (
            <span
              key={corner.key}
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute z-10 h-[22px] w-[22px] border border-line',
                corner.className,
              )}
            />
          ))
        : null}

      {children}
    </div>
  );
}
