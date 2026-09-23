/**
 * 标识几何单测（视觉改版 2026-09-22）
 *
 * 这段几何是粒子动画、界面图标、标签页图标三处的共同源头，
 * 改错一个数字会同时影响三处，所以这里把「设计意图」钉成断言：
 * 对称性、链与眼角的对齐、渐变投影、分层亮度、绘制顺序、采样边界。
 */

import { describe, expect, it } from 'vitest';

import {
  LOGO_EYE,
  LOGO_LINKS,
  LOGO_NODES,
  LOGO_VIEW,
  axisRatio,
  eyeOutlinePaths,
  getLogoNode,
  sampleLogoPoints,
} from '../src/lib/logoGeometry';

/** 线性同余伪随机：注入固定源后采样必须可复现。 */
function seeded(seed = 1): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** 每次调用都拿一个全新的种子随机源——同一个生成器是有状态的，复用会串味。 */
const seed = (value = 20260922) => ({ random: seeded(value) });

const PATH_PATTERN = /^M ([\d.-]+) ([\d.-]+) Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)$/;

describe('logoGeometry · 叶形轮廓', () => {
  it('两道弧，共用同一对眼角端点', () => {
    const paths = eyeOutlinePaths();
    expect(paths).toHaveLength(2);

    for (const path of paths) {
      const matched = PATH_PATTERN.exec(path);
      expect(matched).not.toBeNull();
      const [, startX, startY, , , endX, endY] = matched as RegExpExecArray;
      expect(Number(startX)).toBeCloseTo(LOGO_EYE.a.x, 2);
      expect(Number(startY)).toBeCloseTo(LOGO_EYE.a.y, 2);
      expect(Number(endX)).toBeCloseTo(LOGO_EYE.b.x, 2);
      expect(Number(endY)).toBeCloseTo(LOGO_EYE.b.y, 2);
    }
  });

  it('两道弧关于主轴镜像（控制点相加等于两倍中点）', () => {
    const [first, second] = eyeOutlinePaths().map((path) => PATH_PATTERN.exec(path) as RegExpExecArray);
    const controlOne = [Number(first[3]), Number(first[4])];
    const controlTwo = [Number(second[3]), Number(second[4])];

    expect(controlOne[0] + controlTwo[0]).toBeCloseTo(LOGO_EYE.mid.x * 2, 1);
    expect(controlOne[1] + controlTwo[1]).toBeCloseTo(LOGO_EYE.mid.y * 2, 1);
  });

  it('弧确实外鼓：控制点到主轴的垂距 = 2 倍半宽', () => {
    const matched = PATH_PATTERN.exec(eyeOutlinePaths()[0]) as RegExpExecArray;
    const control = { x: Number(matched[3]), y: Number(matched[4]) };
    const axis = {
      x: LOGO_EYE.b.x - LOGO_EYE.a.x,
      y: LOGO_EYE.b.y - LOGO_EYE.a.y,
    };
    // 控制点相对中点的偏移在主轴上的投影应为 0（正交）。
    // 容差放到 0.02：eyeOutlinePaths 会把坐标四舍五入到两位小数，投影误差量级就在这。
    const offset = { x: control.x - LOGO_EYE.mid.x, y: control.y - LOGO_EYE.mid.y };
    const along = (offset.x * axis.x + offset.y * axis.y) / LOGO_EYE.axisLength;
    expect(Math.abs(along)).toBeLessThan(0.02);

    const across = Math.hypot(offset.x, offset.y);
    expect(across).toBeCloseTo(LOGO_EYE.halfWidth * 2, 1);
  });
});

describe('logoGeometry · 主轴与链', () => {
  it('先修链两端正好落在眼角上', () => {
    const root = getLogoNode('root');
    const mastered = getLogoNode('mastered');
    expect(root?.x).toBeCloseTo(LOGO_EYE.a.x, 6);
    expect(root?.y).toBeCloseTo(LOGO_EYE.a.y, 6);
    expect(mastered?.x).toBeCloseTo(LOGO_EYE.b.x, 6);
    expect(mastered?.y).toBeCloseTo(LOGO_EYE.b.y, 6);
  });

  it('链上中间的节点关于瞳孔成对对称（不是随手撒的点）', () => {
    const step = getLogoNode('step');
    const rise = getLogoNode('rise');
    expect((step?.x ?? 0) + (rise?.x ?? 0)).toBeCloseTo(LOGO_EYE.mid.x * 2, 6);
    expect((step?.y ?? 0) + (rise?.y ?? 0)).toBeCloseTo(LOGO_EYE.mid.y * 2, 6);
  });

  it('瞳孔就是主轴中点，且全图只有一个实心盘', () => {
    const cores = LOGO_NODES.filter((node) => node.core);
    expect(cores).toHaveLength(1);
    expect(cores[0].x).toBeCloseTo(LOGO_EYE.mid.x, 6);
    expect(cores[0].y).toBeCloseTo(LOGO_EYE.mid.y, 6);
  });

  it('设计数据自洽：每条连线两端都是已定义节点', () => {
    for (const [fromId, toId] of LOGO_LINKS) {
      expect(getLogoNode(fromId)).not.toBeNull();
      expect(getLogoNode(toId)).not.toBeNull();
    }
    expect(getLogoNode('不存在的节点')).toBeNull();
  });

  it('节点都落在叶形范围内（链没有戳出轮廓）', () => {
    for (const node of LOGO_NODES) {
      const relative = { x: node.x - LOGO_EYE.a.x, y: node.y - LOGO_EYE.a.y };
      const along = (relative.x * (LOGO_EYE.b.x - LOGO_EYE.a.x) + relative.y * (LOGO_EYE.b.y - LOGO_EYE.a.y)) / LOGO_EYE.axisLength;
      expect(along).toBeGreaterThanOrEqual(-node.r);
      expect(along).toBeLessThanOrEqual(LOGO_EYE.axisLength + node.r);

      // 到主轴的垂距不超过半宽（叶形在中点最宽，故这是最宽松的上界）
      const across = Math.abs(
        (relative.x * (LOGO_EYE.a.y - LOGO_EYE.b.y) + relative.y * (LOGO_EYE.b.x - LOGO_EYE.a.x)) / LOGO_EYE.axisLength,
      );
      expect(across + node.r).toBeLessThanOrEqual(LOGO_EYE.halfWidth);
    }
  });
});

describe('logoGeometry · 渐变投影', () => {
  it('眼角投影为 0 / 1，中点为 0.5（配色严格沿先修链走）', () => {
    expect(axisRatio(LOGO_EYE.a.x, LOGO_EYE.a.y)).toBeCloseTo(0, 6);
    expect(axisRatio(LOGO_EYE.b.x, LOGO_EYE.b.y)).toBeCloseTo(1, 6);
    expect(axisRatio(LOGO_EYE.mid.x, LOGO_EYE.mid.y)).toBeCloseTo(0.5, 6);
  });

  it('超出两端时被夹到 0..1，不会出现越界色', () => {
    const unit = {
      x: (LOGO_EYE.b.x - LOGO_EYE.a.x) / LOGO_EYE.axisLength,
      y: (LOGO_EYE.b.y - LOGO_EYE.a.y) / LOGO_EYE.axisLength,
    };
    const beyond = {
      x: LOGO_EYE.b.x + unit.x * 60,
      y: LOGO_EYE.b.y + unit.y * 60,
    };
    const before = {
      x: LOGO_EYE.a.x - unit.x * 60,
      y: LOGO_EYE.a.y - unit.y * 60,
    };
    expect(axisRatio(beyond.x, beyond.y)).toBe(1);
    expect(axisRatio(before.x, before.y)).toBe(0);
  });
});

describe('logoGeometry · 采样', () => {
  it('同源采样可复现（粒子与图标形状一致的前提）', () => {
    expect(sampleLogoPoints(seed())).toEqual(sampleLogoPoints(seed()));
  });

  it('所有点都落在画布内', () => {
    for (const point of sampleLogoPoints({ ...seed(), jitter: 0.3 })) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(LOGO_VIEW);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(LOGO_VIEW);
    }
  });

  it('分组齐全，且链上节点压在最后（绘制顺序决定节点浮在最上层）', () => {
    const points = sampleLogoPoints(seed());
    const groups = new Set(points.map((point) => point.group));
    expect(groups).toEqual(new Set(['outline', 'link', 'iris', 'core', 'node']));

    const nonCore = LOGO_NODES.filter((node) => !node.core).length;
    const tail = points.slice(-nonCore);
    expect(tail.every((point) => point.group === 'node')).toBe(true);
    expect(groups.has('core')).toBe(true);
  });

  it('亮度分层单调：虹膜 < 链 < 轮廓 < 瞳孔 < 节点', () => {
    const points = sampleLogoPoints(seed());
    const alphaOf = (group: string): number =>
      points.find((point) => point.group === group)?.alpha ?? Number.NaN;

    const ladder = ['iris', 'link', 'outline', 'core', 'node'].map(alphaOf);
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index]).toBeGreaterThan(ladder[index - 1]);
    }
    expect(alphaOf('node')).toBe(1);
  });

  it('瞳孔是实心盘而不是一颗大点：点数足够多，且全部落在瞳孔半径内', () => {
    const core = sampleLogoPoints(seed()).filter((point) => point.group === 'core');
    expect(core.length).toBeGreaterThan(60);

    for (const point of core) {
      const distance = Math.hypot(point.x - LOGO_EYE.mid.x, point.y - LOGO_EYE.mid.y);
      expect(distance).toBeLessThanOrEqual(LOGO_EYE.pupilRadius + 1e-6);
    }
  });

  it('抖动为 0 时点严格落在几何上（轮廓在曲线上、节点在节点位上）', () => {
    const points = sampleLogoPoints({ ...seed(), jitter: 0 });

    const nodePoints = points.filter((point) => point.group === 'node');
    expect(nodePoints).toHaveLength(LOGO_NODES.filter((node) => !node.core).length);
    for (const node of LOGO_NODES.filter((item) => !item.core)) {
      expect(nodePoints.some((point) => point.x === node.x && point.y === node.y)).toBe(true);
    }

    // 轮廓点满足贝塞尔的隐式约束：应在眼角连线的同一侧、且不越出叶形外接范围
    for (const point of points.filter((item) => item.group === 'outline')) {
      expect(point.x).toBeGreaterThanOrEqual(LOGO_EYE.a.x - 1e-9);
      expect(point.x).toBeLessThanOrEqual(LOGO_EYE.b.x + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(point.y).toBeLessThanOrEqual(80 + 1e-9);
    }
  });

  it('点密度足够撑起粒子观感（叶形 + 链 + 瞳孔合计数百点）', () => {
    const count = sampleLogoPoints(seed()).length;
    expect(count).toBeGreaterThan(200);
    expect(count).toBeLessThan(800);
  });
});
