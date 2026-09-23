// @vitest-environment jsdom
/**
 * 认证切片测试（D2 / P0 #1）
 *
 * 覆盖：setSession 双写（内存 + localStorage）/ clear 双清 / 模块重新加载后从 localStorage 恢复
 * （＝刷新页面不掉线）/ localStorage 不可用时不崩。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../src/router';
import { useAuthStore } from '../src/stores/auth';

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('authStore · 持久化（刷新不掉线）', () => {
  it('setSession 同时写内存与 localStorage（键名 zhiwei_token / zhiwei_user_id）', () => {
    useAuthStore.getState().setSession({ user_id: 'u_1024', token: 'tok_abc' });

    expect(useAuthStore.getState().token).toBe('tok_abc');
    expect(useAuthStore.getState().userId).toBe('u_1024');
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('tok_abc');
    expect(localStorage.getItem(STORAGE_KEYS.userId)).toBe('u_1024');
  });

  it('模块重新加载（＝刷新页面）后仍从 localStorage 恢复 token/user_id', async () => {
    localStorage.setItem(STORAGE_KEYS.token, 'tok_persist');
    localStorage.setItem(STORAGE_KEYS.userId, 'u_persist');

    vi.resetModules();
    const fresh = (await import('../src/stores/auth')).useAuthStore;

    expect(fresh.getState().token).toBe('tok_persist');
    expect(fresh.getState().userId).toBe('u_persist');
  });

  it('clear 双清（内存 + localStorage），模拟登出 / 401 清理', () => {
    useAuthStore.getState().setSession({ user_id: 'u_1024', token: 'tok_abc' });
    useAuthStore.getState().clear();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().userId).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.userId)).toBeNull();
  });

  it('无持久化数据时初始 token 为 null（未登录）', async () => {
    vi.resetModules();
    const fresh = (await import('../src/stores/auth')).useAuthStore;
    expect(fresh.getState().token).toBeNull();
  });

  it('localStorage 读写抛错（隐私模式）时不崩：内存态仍可用', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    vi.resetModules();
    const fresh = (await import('../src/stores/auth')).useAuthStore;

    expect(fresh.getState().token).toBeNull();
    fresh.getState().setSession({ user_id: 'u_1', token: 'tok_mem' });
    expect(fresh.getState().token).toBe('tok_mem');
    fresh.getState().clear();
    expect(fresh.getState().token).toBeNull();
  });
});
