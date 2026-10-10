/**
 * 统一笔画图标族（style-10 蓝图迁移 P4 / 规范第 2、5 章）
 *
 * 【规格锁死（D12）】viewBox 24 · fill none · stroke currentColor · stroke-width 1.25 ·
 * linecap square · linejoin miter。43 枚全部来自原型的内联 SVG 表（L936–980），
 * 一枚不多一枚不少 —— 需要新图标时先在原型里找到它，再落到这里，
 * 不允许临时手画第三个风格的图标。
 *
 * 【为什么是 SVG 而不是图标字体 / 图片】
 *   · 图标字体：一个字形一段 CSS，改色要动字体文件；本项目的图标必须随
 *     currentColor 走主题（蓝图 / 白图两套），SVG 天然满足；
 *   · 图片：无法随 currentColor 变色，也不参与 forced-colors 适配；
 *   · 手写 emoji：跨平台渲染不一致，且是原型明确禁止的做法。
 *
 * 【尺寸怎么定】默认**不写 width/height**，交给 CSS 的 .ic（16px）/ .sh（18px）
 * 基线类控制 —— 内联 SVG 若既无尺寸又无约束会撑破版面（原型为此专门补了一节
 * 「图标基线」）。需要特殊尺寸时用 className 传 Tailwind 的 w- 与 h- 工具类。
 *
 * 【无障碍】默认 aria-hidden（图标是装饰，可访问名由文案承担）；
 * 传 title 时才挂 <title> 与 role="img"，用于「图标是唯一信息载体」的少数场合。
 */

import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

/** 43 枚统一笔画图标（键名即原型 ICONS 的键名，便于与原型逐条对照）。 */
export const ICONS = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" />
    </>
  ),
  key: (
    <>
      <rect x="3" y="9" width="18" height="11" />
      <path d="M7 9V6a5 5 0 0 1 10 0v3" />
      <path d="M12 13v3" />
    </>
  ),
  seed: (
    <>
      <path d="M12 21V11" />
      <path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z" />
      <path d="M12 15c0-3-2.5-5-5.5-5 0 3 2.5 5 5.5 5z" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7" cy="17" r="2" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 3 8l9 5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9 12 4l5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v10H10l-5 4V5z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M6 8.5v7" />
      <path d="M8.5 6H13a2.5 2.5 0 0 1 2.5 2.5V12" />
    </>
  ),
  graph: (
    <>
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="12" cy="6" r="2.5" />
      <circle cx="19" cy="14" r="2.5" />
      <path d="M6.8 16.2 10.4 8" />
      <path d="M13.8 7.2 17.4 12.4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 18a4 4 0 0 1 .6-8 5.5 5.5 0 0 1 10.4 1.6A3.2 3.2 0 0 1 17.5 18z" />
      <path d="M12 12v6M9.5 14.5 12 12l2.5 2.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  desk: (
    <>
      <rect x="3" y="4" width="18" height="12" />
      <path d="M3 20h18" />
      <path d="M8 8h8M8 12h5" />
    </>
  ),
  list: <path d="M4 6h16M4 12h16M4 18h16" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" />
      <path d="M15 5H5a1 1 0 0 0-1 1v10" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V4h10v4" />
      <rect x="4" y="8" width="16" height="8" />
      <path d="M7 16h10v4H7z" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  tick: <path d="M5 13l4 4L19 7" />,
  alert: (
    <>
      <path d="M12 4 21 20H3z" />
      <path d="M12 10v5" />
      <path d="M12 17.4v.2" />
    </>
  ),
  retry: (
    <>
      <path d="M20 12a8 8 0 1 1-3-6.2" />
      <path d="M20 4v5h-5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  up: (
    <>
      <path d="M12 19V6" />
      <path d="M6 12l6-6 6 6" />
    </>
  ),
  down: (
    <>
      <path d="M12 5v13" />
      <path d="M6 12l6 6 6-6" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  ruler: (
    <>
      <rect x="2" y="8" width="20" height="8" />
      <path d="M6 8v3M10 8v4M14 8v3M18 8v4" />
    </>
  ),
  zoomin: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
      <path d="M11 8.5v5M8.5 11h5" />
    </>
  ),
  zoomout: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
      <path d="M8.5 11h5" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V7a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-6-2-6-5v-3a1.5 1.5 0 0 1 3 0" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <path d="M3 16l5-5 4 4 3-3 6 5" />
      <circle cx="8.5" cy="9.5" r="1.3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5h7v15H4z" />
      <path d="M13 5h7v15h-7z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </>
  ),
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  star: (
    <path d="M12 4l2.3 5 5.7.6-4.3 3.7 1.3 5.4L12 15.9 7 18.7l1.3-5.4L4 9.6l5.7-.6z" />
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

/** 图标名全量清单（测试与审计用：确认 43 枚不多不少）。 */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export interface IconProps {
  name: IconName;
  /** 覆盖 CSS 基线尺寸；缺省由 .ic（16px）承担。 */
  className?: string;
  /** 可访问名。给了就变成 role="img"，否则 aria-hidden（图标是装饰）。 */
  title?: string;
}

export function Icon({ name, className, title }: IconProps) {
  return (
    <svg
      className={cn('ic', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {ICONS[name]}
    </svg>
  );
}

/** 四档形状（规范 2.2）：形状本身就是编码，颜色只是第二重编码。 */
export const BAND_SHAPE: Record<string, ReactNode> = {
  待巩固: <polygon points="12,2.4 21.6,12 12,21.6 2.4,12" />,
  不稳定: <polygon points="12,2.4 21.3,9.1 17.7,19.8 6.3,19.8 2.7,9.1" />,
  基本掌握: <polygon points="7.7,3.2 16.3,3.2 20.6,12 16.3,20.8 7.7,20.8 3.4,12" />,
  已掌握: <circle cx="12" cy="12" r="9.2" />,
  未接触: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  未解锁: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" />
      <path d="M8 12h8" />
    </>
  ),
  低置信: (
    <>
      <polygon points="12,3 21,12 12,21 3,12" />
      <path d="M8.4 12h7.2" />
    </>
  ),
};

export interface BandShapeProps {
  band: string;
  className?: string;
}

/** 四档形状标记本体（18×18、stroke 1.5、无填充），由 BandMark 消费。 */
export function BandShape({ band, className }: BandShapeProps) {
  const shape = BAND_SHAPE[band] ?? BAND_SHAPE['未接触'];
  return (
    <svg
      className={cn('sh', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
