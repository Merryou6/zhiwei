/**
 * 成长海报（v2.1 技能树 · 分享）—— 客户端 canvas 生成 PNG，零后端、零新增鉴权面。
 *
 * 数据来源：#32 summary（聚合带值 + kp 名），**不含** answer / 对话原文 / 分数明细，
 * 与隐私契约一致；海报是「越用越懂你」的可分享形态。
 *
 * 实现约束：
 *   - 纯 canvas 2D 手绘（不引 html2canvas 依赖）；
 *   - 颜色取 theme/bands.ts 的 hex 常量（组件不硬编码 —— 本文件是 lib，直接 import 常量）；
 *   - 浏览器不支持 canvas.toBlob（jsdom/极老内核）→ 返回 null，调用方 toast 降级。
 */

import { BAND_HEX, BAND_ORDER, PRIMARY_HEX } from '../theme/bands';
import type { MasteryBand } from '../theme/bands';
import type { GraphMasterySummary } from '../api/types';
import type { ChapterBadge } from './graphMastery';

export const POSTER_WIDTH = 750;
export const POSTER_HEIGHT = 1200;

/** 深色底海报配色（固定深色：海报是外传图片，不随主题切换）。 */
const POSTER_BG = '#0F1620';
const POSTER_TITLE = '#E8EEF4';
const POSTER_MUTED = '#9AA7B4';

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 四带环形图（中心写覆盖率）。 */
function drawBandRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, summary: GraphMasterySummary): void {
  const litRatios = BAND_ORDER.map((band) => (summary.band_counts[band] ?? 0) / Math.max(summary.total_kp, 1));
  const start = -Math.PI / 2;
  let cursor = start;
  BAND_ORDER.forEach((band, index) => {
    const sweep = litRatios[index] * Math.PI * 2;
    if (sweep <= 0) return;
    ctx.beginPath();
    ctx.strokeStyle = BAND_HEX[band as MasteryBand];
    ctx.lineWidth = 26;
    ctx.arc(cx, cy, r, cursor, cursor + sweep);
    ctx.stroke();
    cursor += sweep;
  });
  // 未点亮余量画灰
  const covered = litRatios.reduce((acc, value) => acc + value, 0);
  if (covered < 1) {
    ctx.beginPath();
    ctx.strokeStyle = '#2A3340';
    ctx.lineWidth = 26;
    ctx.arc(cx, cy, r, cursor, start + Math.PI * 2);
    ctx.stroke();
  }

  const ratio = coverageRatioOf(summary);
  ctx.fillStyle = POSTER_TITLE;
  ctx.font = '600 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(ratio * 100)}%`, cx, cy - 12);
  ctx.fillStyle = POSTER_MUTED;
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillText('知识地图点亮率', cx, cy + 34);
}

function coverageRatioOf(summary: GraphMasterySummary): number {
  const lit = (summary.band_counts['基本掌握'] ?? 0) + (summary.band_counts['已掌握'] ?? 0);
  return summary.total_kp === 0 ? 0 : lit / summary.total_kp;
}

/** 组装并绘制海报；成功返回 blob，失败（无 canvas 环境）返回 null。 */
export async function buildGrowthPoster(
  summary: GraphMasterySummary,
  badges: ChapterBadge[],
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 底
  ctx.fillStyle = POSTER_BG;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  // 标题区
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PRIMARY_HEX;
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillText('知微 · 成长海报', 56, 96);
  ctx.fillStyle = POSTER_TITLE;
  ctx.font = '500 52px system-ui, sans-serif';
  ctx.fillText('我的知识地图', 56, 164);
  ctx.fillStyle = POSTER_MUTED;
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillText(new Date().toLocaleDateString('zh-CN'), 56, 204);

  // 环形图
  drawBandRing(ctx, POSTER_WIDTH / 2, 434, 132, summary);

  // 图例
  const legendY = 616;
  const legendItemWidth = 168;
  BAND_ORDER.forEach((band, index) => {
    const x = 56 + index * legendItemWidth;
    ctx.fillStyle = BAND_HEX[band as MasteryBand];
    ctx.beginPath();
    ctx.arc(x + 8, legendY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = POSTER_MUTED;
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${band} ${summary.band_counts[band] ?? 0}`, x + 24, legendY + 8);
  });

  // 三块成绩单
  const stats: { value: string; label: string }[] = [
    { value: `${summary.evidence_total}`, label: '学习证据（条）' },
    { value: `${summary.newly_mastered_7d > 0 ? `+${summary.newly_mastered_7d}` : '0'}`, label: '本周点亮' },
    { value: `${summary.covered_kp}/${summary.total_kp}`, label: '已覆盖知识点' },
  ];
  stats.forEach((stat, index) => {
    const x = 56 + index * 220;
    roundRect(ctx, x, 680, 196, 132, 16);
    ctx.fillStyle = '#182230';
    ctx.fill();
    ctx.fillStyle = POSTER_TITLE;
    ctx.font = '500 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stat.value, x + 98, 740);
    ctx.fillStyle = POSTER_MUTED;
    ctx.font = '400 20px system-ui, sans-serif';
    ctx.fillText(stat.label, x + 98, 780);
  });

  // 下一关（薄弱点）
  ctx.textAlign = 'left';
  ctx.fillStyle = POSTER_MUTED;
  ctx.font = '400 24px system-ui, sans-serif';
  ctx.fillText('下一关', 56, 880);
  const weakest = summary.weakest.slice(0, 3);
  weakest.forEach((row, index) => {
    ctx.fillStyle = POSTER_TITLE;
    ctx.font = '400 28px system-ui, sans-serif';
    ctx.fillText(`${index + 1}. ${row.name}`, 56, 924 + index * 44);
  });

  // 章节进度条
  const doneBadges = badges.filter((badge) => badge.complete);
  ctx.fillStyle = POSTER_MUTED;
  ctx.font = '400 22px system-ui, sans-serif';
  ctx.fillText(
    doneBadges.length > 0 ? `已通关章节：${doneBadges.map((badge) => badge.name).join('、')}` : '第一个通关章节就在前方',
    56,
    1090,
  );

  // 页脚
  ctx.fillStyle = POSTER_MUTED;
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText('不说「答案错了」，告诉你断在第几步 —— 知微', 56, 1152);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** 触发下载（浏览器环境；失败返回 false 由调用方提示）。 */
export function downloadPoster(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `知微成长海报_${new Date().toISOString().slice(0, 10)}.png`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
