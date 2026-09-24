/**
 * 右侧对话面板「让位位移」的**单一来源**（清尾轮 L11 修正，2026-09-24）。
 *
 * 为什么需要它：本项目有一条固化设计不变量 ——「内容列与顶栏共用同一条左基线」
 * （.learnbuddy/memory/MEMORY.md 设计系统段；9/20–9/21 走查固化项）。
 * F3 让位时只给 main 的外层包装加了 padding-right，顶栏仍按整宽居中 ⇒ ≥1280 面板展开态下
 * 正文列左缘 32px、顶栏内容左缘 232px（1440 实测差 **200px**），基线错位。
 *
 * 做法（单一来源，杜绝第二份 400px 常量）：
 *   · **写入侧**（只有 Layout 写）：把让位量作为 CSS 自定义属性挂在外壳根节点上，
 *     值就是 Layout 里唯一的 PANEL_WIDTH_PX（面板关 / <1280 覆盖态 = 0px）；
 *   · **读取侧**（TopNav 的 nav 容器 + 正文列外层）：各自只读**同一个变量**，
 *     于是两者永远同值、同一份 transition；不存在两份常量，也不会出现两份 matchMedia
 *     判定不同步（若只在一处改名，另一边会静默回退 0px 而无人察觉，故用常量收敛变量名）。
 *
 * 自定义属性按继承生效：外壳根节点写一次，顶栏与正文列（同为其后代）都读得到。
 * 与 D24 的关系：让位 padding 仍落在**外层包装**上（不落在 main 盒内），
 * main 的 max-w-5xl 作用在「面板左边的可用宽度」上（1440 下正文 976px、无死区），
 * 顶栏 nav 的 max-w-5xl 同理 —— 两者用同一个公式，左基线自然相等。
 */

import type { CSSProperties } from 'react';

/** 让位量的 CSS 自定义属性名（写入侧与读取侧共用，避免字符串漂移）。 */
export const DOCK_OFFSET_VAR = '--panel-dock-offset';

/**
 * 写入侧（仅 Layout 调用）：panels docked → 面板宽，否则 0。
 * 自定义属性不在 React 的 CSSProperties 已知键里，故此处做一次显式断言。
 */
export function dockOffsetVarStyle(paddingRightPx: number): CSSProperties {
  return { [DOCK_OFFSET_VAR]: `${paddingRightPx}px` } as CSSProperties;
}

/**
 * 读取侧（顶栏 nav 容器 + 正文列外层共用）：读同一个变量，未定义时回退 0px。
 * 回退值是必须的 —— 登录页 / 面板未挂载时变量不存在，此时不应有任何让位。
 */
export const DOCK_OFFSET_STYLE: CSSProperties = {
  paddingRight: `var(${DOCK_OFFSET_VAR}, 0px)`,
};
