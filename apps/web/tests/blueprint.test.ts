/**
 * 蓝图外壳族纯逻辑测试（2026-10-10 style-10 迁移 P4 新增）
 *
 * 与既有纪律一致：**不引渲染测试栈**（项目里没有 react-testing-library，
 * 也没有 jsdom 组件渲染先例）。这里只测三类「能静态/纯函数判定」的东西：
 *
 *   ① 图标族 —— 43 枚不多不少、名字唯一、规格（viewBox / stroke-width / fill）锁死。
 *      为什么值得测：图标是**跨页复用件**，少一枚会在某个页面静默变成空白
 *      （SVG 有 viewBox 但内容为空时什么也不画，不报错、不警告）。
 *   ② 四档形状 —— 七档全覆盖。缺一档时 BandShape 会静默退化成「未接触」，
 *      于是「待巩固」会被画成「未接触」—— 那是**语义错误**，不是样式瑕疵。
 *   ③ 引线几何纯函数与该宽度档函数 —— 边界值（420/900/1179/1180）与
 *      「间距不足不画线」的判据。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tierOfWidth } from '../src/components/blueprint/Board';
import { BAND_SHAPE, ICON_NAMES, ICONS } from '../src/components/blueprint/icons';
import { LEADER_MIN_GAP_PX, computeLeaderPath, leaderLabel } from '../src/components/blueprint/LeaderLayer';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

describe('① 图标族（规范 5 / D12：43 枚统一笔画 SVG）', () => {
  it('恰好 43 枚，名字唯一且都是非空小写标识符', () => {
    expect(ICON_NAMES).toHaveLength(43);
    expect(new Set(ICON_NAMES).size).toBe(43);
    for (const name of ICON_NAMES) {
      expect(name, `图标名 ${name} 应是小写字母/数字/连字符`).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ICONS[name], `图标 ${name} 的定义为空`).toBeTruthy();
    }
  });

  it('Icon 组件渲染出的 SVG 锁死规格：viewBox 24 / fill none / stroke 1.25 / linecap square', () => {
    // 直接读源文件断言规格字面量（不拉起渲染）：这是「同一枚图标在任何页面
    // 都是同一种笔」的唯一机械保证。四个值缺任何一个，图标族就会长成
    // 「细节各异的免费图标集合」，而不是一套制图标记。
    const text = readFileSync(resolve(SRC, 'components/blueprint/icons.tsx'), 'utf8');
    expect(text).toContain('viewBox="0 0 24 24"');
    expect(text).toContain('strokeWidth={1.25}');
    expect(text).toContain('strokeLinecap="square"');
    expect(text).toContain('fill="none"');
  });
});

describe('② 四档形状（规范 2.2：色 + 形状 + 文字三重编码）', () => {
  it('七档全部有形状（四个掌握档 + 未接触 / 未解锁 / 低置信）', () => {
    for (const band of ['待巩固', '不稳定', '基本掌握', '已掌握', '未接触', '未解锁', '低置信']) {
      expect(BAND_SHAPE[band], `缺形状：${band}（会静默退化成未接触）`).toBeTruthy();
    }
    expect(Object.keys(BAND_SHAPE)).toHaveLength(7);
  });
});

describe('③ 引线几何与图幅档（规范 6.2 / 4.2）', () => {
  it('图幅档边界取原型 computeTier：≤420 sm / ≤900 md / ≤1179 lg / ≥1180 xl', () => {
    expect(tierOfWidth(320)).toBe('sm');
    expect(tierOfWidth(420)).toBe('sm');
    expect(tierOfWidth(421)).toBe('md');
    expect(tierOfWidth(900)).toBe('md');
    expect(tierOfWidth(901)).toBe('lg');
    expect(tierOfWidth(1179)).toBe('lg');
    expect(tierOfWidth(1180)).toBe('xl');
    expect(tierOfWidth(2560)).toBe('xl');
  });

  it('目标与标注卡间距不足 24px 时不画线（返回 null）', () => {
    const base = { left: 0, top: 0 };
    const target = { left: 10, top: 20, right: 200, height: 40 };
    // 卡左缘 210 - 目标右缘 200 = 10px < 24 → 不画
    expect(computeLeaderPath(target, { left: 210, top: 20, right: 500, height: 40 }, base)).toBeNull();
    // 卡左缘 240 - 200 = 40px ≥ 24 → 画
    const geo = computeLeaderPath(target, { left: 240, top: 20, right: 500, height: 40 }, base);
    expect(geo).not.toBeNull();
    expect(geo!.d.startsWith('M200')).toBe(true);
    expect(geo!.d).toContain('h14');
  });

  it('最小间距常量是 24px（契约值，改它等于改「什么时候不画」的判据）', () => {
    expect(LEADER_MIN_GAP_PX).toBe(24);
  });

  it('编号小方块里的字符超过两位时取末两位', () => {
    expect(leaderLabel('①')).toBe('①');
    expect(leaderLabel('A1')).toBe('A1');
    expect(leaderLabel('A12')).toBe('12');
  });
});
