/**
 * 跨组件共享的 DOM id（2026-09-24 移动端适配轮，清尾轮 T2 收敛至此）。
 *
 * 【为什么要有这个文件】汉堡键（TopNav 渲染）与抽屉（MobileNav 渲染）是**两个组件**，
 * 但它们靠三个字符串互相关联：
 *   · TopNav 的 button.id  ←→ MobileNav 关闭时 getElementById 拿它归还焦点；
 *   · TopNav 的 aria-controls ←→ MobileNav 的 aside.id（读屏据此念出「按钮控制哪个区域」）。
 * 之前这三处各自硬编码字面量，改一处忘另一处会**静默失效**：焦点不再归还、aria 关联断掉，
 * 既不报错也不挂测试——正是 breakpoints.test.ts 文件头描述的「靠人肉 grep 守不住」那类破绽。
 * 收到这里后，「id 的真相」只有一个来源；tests/mobileNav.test.ts 另有一条静态断言，
 * 禁止两个组件再出现硬编码字面量。
 *
 * 注：tools/responsive-audit.cjs 的 --probe-nav 在 CDP 的 eval 字符串里也引用这两个 id，
 * 但它是独立的 .cjs 探针（不参与前端构建、无法 import 本模块），故不在此收敛范围内。
 */

/** 顶栏汉堡键（<720 唯一的导航入口，关闭抽屉时焦点归还到这里）。 */
export const MOBILE_NAV_TOGGLE_ID = 'mobile-nav-toggle';

/** 汉堡抽屉本体（TopNav 的 aria-controls 指向它）。 */
export const MOBILE_NAV_DRAWER_ID = 'mobile-nav-drawer';
