/**
 * 路由守卫测试（D1）
 *
 * 守卫是纯函数（router.tsx 不 import 页面组件、不含 JSX），故可在 node 环境直接断言：
 *   - 未登录访问受保护页 → #/login
 *   - 已登录访问 #/login → #/spaces
 *   - 已登录无活跃空间 → #/spaces（/spaces 与 /self-report 豁免）
 *   - 路由表 12 页齐全、页面编号 1–12 无重复（v1.2 新增 /me「我的」）
 */

import { describe, expect, it } from 'vitest';

import {
  LOGIN_PATH,
  ROUTES,
  SELF_REPORT_PATH,
  SPACES_PATH,
  STORAGE_KEYS,
  guardPath,
  hashWithQuery,
  navRoutes,
  routeOf,
} from '../src/router';

const PROTECTED = ROUTES.filter((route) => route.requiresAuth).map((route) => route.path);

describe('router · 路由表（PRD §5 十页 + 控制台 + 我的）', () => {
  it('12 页齐全、路径唯一、页面编号 1–12 各一次', () => {
    expect(ROUTES).toHaveLength(12);
    expect(new Set(ROUTES.map((route) => route.path)).size).toBe(12);
    expect(ROUTES.map((route) => route.page).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(ROUTES.every((route) => route.label.length > 0)).toBe(true);
  });

  it('仅登录页不需要鉴权；空间管理不进主导航（不占首屏）', () => {
    expect(ROUTES.filter((route) => !route.requiresAuth).map((route) => route.path)).toEqual([LOGIN_PATH]);
    expect(navRoutes().map((route) => route.path)).toEqual([
      '/assessment',
      '/chat',
      '/graph',
      '/report',
      '/drive',
      // v1.2：/me「我的」进主导航（末位）
      '/me',
    ]);
    expect(navRoutes()).toHaveLength(6);
  });

  it('routeOf 支持带 query 的路径；未知路径返回 null', () => {
    expect(routeOf('/graph?path=a,b')?.label).toBe('知识图谱');
    expect(routeOf('/nope')).toBeNull();
  });
});

describe('router · guardPath 守卫分支', () => {
  it('未登录：受保护页一律 → #/login；登录页放行', () => {
    for (const path of PROTECTED) {
      expect(guardPath(path, { token: null, hasActiveSpace: false })).toBe(LOGIN_PATH);
    }
    expect(guardPath(LOGIN_PATH, { token: null, hasActiveSpace: false })).toBeNull();
  });

  it('已登录但无活跃空间：除 /spaces 与 /self-report 外一律 → #/spaces（注册后直进自报）', () => {
    const state = { token: 'tok_abc', hasActiveSpace: false };
    expect(guardPath('/graph', state)).toBe(SPACES_PATH);
    expect(guardPath('/assessment', state)).toBe(SPACES_PATH);
    expect(guardPath(SPACES_PATH, state)).toBeNull();
    expect(guardPath(SELF_REPORT_PATH, state)).toBeNull();
  });

  it('已登录且有活跃空间：受保护页全部放行；访问登录页 → #/spaces', () => {
    const state = { token: 'tok_abc', hasActiveSpace: true };
    for (const path of PROTECTED) {
      expect(guardPath(path, state)).toBeNull();
    }
    expect(guardPath(LOGIN_PATH, state)).toBe(SPACES_PATH);
    // v1.2：受保护页由 10 增至 11（/me 一并受 requiresAuth 覆盖，自动纳入本断言）
    expect(PROTECTED).toHaveLength(11);
  });

  it('未知路径：已登录去 #/spaces，未登录去 #/login（不白屏）', () => {
    expect(guardPath('/whatever', { token: 'tok_abc', hasActiveSpace: true })).toBe(SPACES_PATH);
    expect(guardPath('/whatever', { token: null, hasActiveSpace: false })).toBe(LOGIN_PATH);
  });

  it('hashWithQuery 构造带参路由（?path= / ?attribution_id= 页面跳转用）', () => {
    expect(hashWithQuery('/graph', { path: 'a,b' })).toBe('/graph?path=a%2Cb');
    expect(hashWithQuery('/attribution', { attribution_id: 'attr_1' })).toBe('/attribution?attribution_id=attr_1');
    expect(hashWithQuery('/assessment', { mode: undefined })).toBe('/assessment');
  });

  it('localStorage 键名与 D2 约定一致（auth / space / theme 落盘）', () => {
    expect(STORAGE_KEYS.token).toBe('zhiwei_token');
    expect(STORAGE_KEYS.userId).toBe('zhiwei_user_id');
    expect(STORAGE_KEYS.activeSpace).toBe('zhiwei_active_space');
    // v1.2（D3）：主题键与 index.html 内联脚本读的键名必须一致
    expect(STORAGE_KEYS.theme).toBe('zhiwei_theme');
  });
});
