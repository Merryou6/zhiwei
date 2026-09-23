/**
 * 粒子标识（视觉改版 2026-09-22）
 *
 * 开场效果：一团散点在画面中心附近游移，随后被「吸」成上面的标识；
 * 聚拢后仍有极轻微的呼吸浮动（振幅不到 1px，不干扰阅读）；
 * 鼠标靠近时粒子被推开、离开后自己回去——和 DeepSeek 官网那种手感一致。
 *
 * 实现要点：
 *   · 目标点全部来自 lib/logoGeometry.ts（与静态 SVG 同源，形状不会走样）；
 *   · 弹簧收敛（每颗粒子有自己的劲度系数 → 聚拢有前后差，不是整体平移）；
 *   · 'lighter' 叠加 + 双层描点（软晕 + 实心），做出辉光而不必用 shadowBlur（那很贵）；
 *   · 系统开了「减弱动态效果」→ 直接落位、只画一帧、不起动画循环；
 *   · 标签页切到后台 → 暂停 rAF；尺寸变化 → 重新落位（用 ResizeObserver，组件自适应宽度）；
 *     注意**只有首次入场才播「散点聚拢」**，之后的尺寸变化直接落位（否则拖窗口会炸开一次）；
 *   · **聚拢完成后主动停表**：页面必须能进入「静止」状态（否则自动化工具的稳定性等待会被
 *     无限动画卡死），指针靠近时再唤醒——交互手感不变，但页面不再永动。
 */

import { useEffect, useRef } from 'react';

import { LOGO_VIEW, axisRatio, sampleLogoPoints } from '../lib/logoGeometry';
import { prefersReducedMotion } from '../lib/motion';

export interface ParticleLogoProps {
  /** 外层容器类名（宽度决定画布边长，组件是正方形自适应）。 */
  className?: string;
  /** 鼠标斥力半径（CSS px），0 = 关闭指针交互。 */
  repulseRadius?: number;
  /** 无障碍名称。 */
  label?: string;
}

type Rgb = [number, number, number];

/** 主链配色：accent 单色相三档（active → base → hover，#2F92E6/#42A5F5/#5DB3F8）。
 *  2026-09-23 对齐原型：此前是蓝→青→薄荷绿三套色相，与全站唯一的强调色不同源。 */
const STOPS: { at: number; rgb: Rgb }[] = [
  { at: 0, rgb: [47, 146, 230] },
  { at: 0.52, rgb: [66, 165, 245] },
  { at: 1, rgb: [93, 179, 248] },
];

const TAU = Math.PI * 2;

function mix(from: Rgb, to: Rgb, ratio: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
    from[2] + (to[2] - from[2]) * ratio,
  ];
}

/** 沿配色停靠点取色。 */
function gradientColor(ratio: number, toWhite: number): Rgb {
  const t = Math.min(1, Math.max(0, ratio));
  let rgb = STOPS[STOPS.length - 1].rgb;
  for (let index = 0; index < STOPS.length - 1; index += 1) {
    const left = STOPS[index];
    const right = STOPS[index + 1];
    if (t <= right.at) {
      rgb = mix(left.rgb, right.rgb, (t - left.at) / Math.max(1e-6, right.at - left.at));
      break;
    }
  }
  return toWhite <= 0 ? rgb : mix(rgb, [255, 255, 255], toWhite);
}

function css(rgb: Rgb): string {
  return `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
}

interface Particle {
  /** 目标位置（CSS px）。 */
  tx: number;
  ty: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 绘制半径（CSS px）。 */
  radius: number;
  alpha: number;
  /** 弹簧劲度系数（越大越早到位）。 */
  k: number;
  /** 呼吸相位。 */
  phase: number;
  color: string;
}

export default function ParticleLogo({
  className,
  repulseRadius = 64,
  label = '知微标识：沿先修链从根因走向掌握的知识图谱',
}: ParticleLogoProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const hostRefValue = hostRef.current;
    const canvasRefValue = canvasRef.current;
    if (!hostRefValue || !canvasRefValue) return;

    const rawContext = canvasRefValue.getContext('2d');
    if (!rawContext) return;

    // 显式标注为非空类型：下面的物理循环写在嵌套函数里，
    // TS 的控制流收窄不跨函数体保留，标注一次好过满屏 `!`
    const host: HTMLDivElement = hostRefValue;
    const canvas: HTMLCanvasElement = canvasRefValue;
    const context: CanvasRenderingContext2D = rawContext;

    const reduced = prefersReducedMotion();
    const pointer = { x: -1e4, y: -1e4, active: false, at: 0 };
    let particles: Particle[] = [];
    let side = 0;
    let frame = 0;
    let startedAt = 0;
    let appeared = false;
    let idleSince = 0;
    let cancelled = false;

    /** 建粒子：先从中心附近散开，再交给弹簧收敛。 */
    function seed(nextSide: number): void {
      side = nextSide;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(side * dpr);
      canvas.height = Math.round(side * dpr);
      canvas.style.width = `${side}px`;
      canvas.style.height = `${side}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const scale = side / LOGO_VIEW;
      particles = sampleLogoPoints().map((point) => {
        const tx = point.x * scale;
        const ty = point.y * scale;
        // 配色沿主轴走：从左下根因的蓝到右上掌握的薄荷绿（与静态标识同一套渐变方向）
        const ratio = axisRatio(point.x, point.y);
        // 瞳孔与链上节点压白 → 视线焦点；轮廓与虹膜保持纯渐变 → 不抢主次
        const bright = point.group === 'node' ? 0.62 : point.group === 'core' ? 0.46 : 0;
        const rgb = gradientColor(ratio, bright);

        // 初始落点分两种情况：
        //   · 首次入场 → 从中心附近的一个圆盘散开（就是那「一团散点」，开场聚拢的起点）；
        //   · 之后的尺寸变化 → 直接落在目标点上。
        // 第二点很重要：ResizeObserver 每次触发都会重新 seed，如果无脑重播散开，
        // 用户拖一下窗口、或截图工具调整视口，标识就会原地炸开再聚一次，很突兀。
        const fromScatter = !appeared;
        const angle = Math.random() * TAU;
        const radius = Math.sqrt(Math.random()) * side * 0.3;
        return {
          tx,
          ty,
          x: fromScatter ? side / 2 + Math.cos(angle) * radius : tx,
          y: fromScatter ? side / 2 + Math.sin(angle) * radius : ty,
          vx: 0,
          vy: 0,
          radius: Math.max(0.9, point.size * scale),
          alpha: point.alpha,
          k: 0.014 + Math.random() * 0.022,
          phase: Math.random() * TAU,
          color: css(rgb),
        };
      });

      if (reduced) {
        for (const particle of particles) {
          particle.x = particle.tx;
          particle.y = particle.ty;
        }
      }
    }

    function draw(time: number): void {
      context.clearRect(0, 0, side, side);
      context.globalCompositeOperation = 'lighter';

      // 聚拢的「入场淡入」：前 400ms 粒子从透明浮出
      const appear = reduced ? 1 : Math.min(1, Math.max(0, (time - startedAt) / 400));

      for (const particle of particles) {
        if (!reduced) {
          // 呼吸：聚拢后目标点有亚像素级浮动，看起来是活的但不抖
          const breath = Math.sin(time * 0.00085 + particle.phase) * 0.45;
          const tx = particle.tx + breath;
          const ty = particle.ty + Math.cos(time * 0.0007 + particle.phase) * 0.45;

          particle.vx = (particle.vx + (tx - particle.x) * particle.k) * 0.9;
          particle.vy = (particle.vy + (ty - particle.y) * particle.k) * 0.9;

          if (pointer.active && repulseRadius > 0) {
            const dx = particle.x - pointer.x;
            const dy = particle.y - pointer.y;
            const distance = Math.hypot(dx, dy);
            if (distance < repulseRadius && distance > 0.01) {
              const push = (1 - distance / repulseRadius) * 2.6;
              particle.vx += (dx / distance) * push;
              particle.vy += (dy / distance) * push;
            }
          }

          particle.x += particle.vx;
          particle.y += particle.vy;
        }

        // 软晕 + 实心双层：比 shadowBlur 便宜得多，但同样有辉光
        context.globalAlpha = particle.alpha * appear * 0.18;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius * 2.1, 0, TAU);
        context.fill();

        context.globalAlpha = particle.alpha * appear;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, TAU);
        context.fill();
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
    }

    /**
     * 是否已经「安静下来」：所有粒子都到位、也没有指针在附近扰动。
     * 指针停在标识上不动不算扰动（超过 1.2s 没移动就视作静止），否则鼠标一压上去就永不停表。
     */
    function isSettled(now: number): boolean {
      if (pointer.active && now - pointer.at < 1200) return false;
      for (const particle of particles) {
        if (Math.abs(particle.x - particle.tx) > 1.6 || Math.abs(particle.y - particle.ty) > 1.6) return false;
        if (Math.abs(particle.vx) > 0.12 || Math.abs(particle.vy) > 0.12) return false;
      }
      return true;
    }

    function tick(time: number): void {
      if (cancelled) return;
      draw(time);

      // 聚拢完成后停掉 rAF。理由不是省这一点电，而是「页面必须是静止的」：
      // 无限动画会让自动化工具（快照 / 等待网络与 DOM 稳定）永远等不到时机。
      // 指针一靠近会重新启动，交互手感不受影响。
      if (isSettled(time)) {
        if (idleSince === 0) idleSince = time;
        else if (time - idleSince > 900) {
          stop();
          return;
        }
      } else {
        idleSince = 0;
      }

      frame = window.requestAnimationFrame(tick);
    }

    function start(): void {
      if (cancelled || reduced) return;
      window.cancelAnimationFrame(frame);
      // 只有首次启动才播入场淡入：被交互唤醒时不该再淡入一遍
      if (!appeared) {
        startedAt = performance.now();
        appeared = true;
      }
      idleSince = 0;
      frame = window.requestAnimationFrame(tick);
    }

    function stop(): void {
      window.cancelAnimationFrame(frame);
    }

    /** 尺寸变化：重建粒子并落位（避免拉伸变形）。 */
    function resize(): void {
      const width = host.clientWidth;
      if (width <= 0) return;
      if (Math.abs(width - side) < 2) return;
      seed(width);
      if (reduced) draw(performance.now());
      else start();
    }

    function onPointerMove(event: PointerEvent): void {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
      pointer.at = performance.now();
      idleSince = 0;
      start(); // 停表之后由指针唤醒（减弱动效模式下 start 自身会拒绝）
    }

    function onPointerLeave(): void {
      pointer.active = false;
      pointer.x = -1e4;
      pointer.y = -1e4;
    }

    /** 后台标签页不烧 CPU。 */
    function onVisibility(): void {
      if (document.hidden) stop();
      else if (!reduced) start();
    }

    seed(host.clientWidth || 220);
    if (reduced) draw(performance.now());
    else start();

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [repulseRadius]);

  return (
    <div ref={hostRef} className={className} role="img" aria-label={label}>
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}
