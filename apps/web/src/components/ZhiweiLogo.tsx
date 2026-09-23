/**
 * 「知微」静态标识（视觉改版 2026-09-22）
 *
 * 与 ParticleLogo 同源：形状全部读自 lib/logoGeometry.ts，
 * 于是「粒子聚出来的图」和「界面图标 / 标签页图标」永远长一样，改一处两边同步。
 * 用在不需要动效的地方：顶栏品牌位、登录卡片抬头、favicon 生成脚本。
 *
 * 渲染顺序与粒子一致（轮廓 → 链 → 虹膜 → 瞳孔 → 节点），保证两处层级相同。
 */

import { useId } from 'react';

import { LOGO_EYE, LOGO_LINKS, LOGO_NODES, LOGO_VIEW, eyeOutlinePaths, getLogoNode } from '../lib/logoGeometry';

export interface ZhiweiLogoProps {
  /** 边长（px）。 */
  size?: number;
  className?: string;
  /** 渐变起色（左下 / 根因）。 */
  from?: string;
  /** 渐变中段。 */
  mid?: string;
  /** 渐变止色（右上 / 掌握）。 */
  to?: string;
  /** 是否画叶形轮廓（极小尺寸时可关掉，只留链与瞳孔）。 */
  outline?: boolean;
  /** 给了就当「有语义的图」念给读屏；不给则按纯装饰隐藏。 */
  label?: string;
}

export default function ZhiweiLogo({
  size = 28,
  className,
  from = '#2F92E6',
  mid = '#42A5F5',
  to = '#5DB3F8',
  outline = true,
  label,
}: ZhiweiLogoProps) {
  // 同页可能出现多个实例，渐变 id 必须唯一（useId 带冒号，先洗掉）
  const uid = useId().replace(/:/g, '');
  const gradient = `url(#zw-line-${uid})`;
  const pupil = `url(#zw-pupil-${uid})`;

  return (
    <svg
      viewBox={`0 0 ${LOGO_VIEW} ${LOGO_VIEW}`}
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        {/* userSpaceOnUse：渐变钉在 0..100 坐标系的主轴上，缩放不跑偏 */}
        <linearGradient
          id={`zw-line-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1={LOGO_EYE.a.x}
          y1={LOGO_EYE.a.y}
          x2={LOGO_EYE.b.x}
          y2={LOGO_EYE.b.y}
        >
          <stop offset="0%" stopColor={from} />
          <stop offset="52%" stopColor={mid} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <radialGradient id={`zw-pupil-${uid}`}>
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="62%" stopColor="#E8EDF3" />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>

      {outline
        ? eyeOutlinePaths().map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke={gradient}
              strokeWidth={1.9}
              strokeLinecap="round"
              opacity={0.66}
            />
          ))
        : null}

      {LOGO_LINKS.map(([fromId, toId]) => {
        const start = getLogoNode(fromId);
        const end = getLogoNode(toId);
        if (!start || !end) return null;
        return (
          <line
            key={`link-${fromId}-${toId}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={gradient}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.58}
          />
        );
      })}

      {/* 虹膜细环：把瞳孔圈出来，小尺寸下也读得出是「眼睛」 */}
      <circle
        cx={LOGO_EYE.mid.x}
        cy={LOGO_EYE.mid.y}
        r={LOGO_EYE.irisRadius}
        fill="none"
        stroke={gradient}
        strokeWidth={0.9}
        opacity={0.32}
      />

      {LOGO_NODES.map((node) => (
        <circle
          key={`node-${node.id}`}
          cx={node.x}
          cy={node.y}
          r={node.r}
          fill={node.core ? pupil : node.key ? '#E8EDF3' : gradient}
        />
      ))}
    </svg>
  );
}
