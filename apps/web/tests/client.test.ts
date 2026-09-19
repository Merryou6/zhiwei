// @vitest-environment jsdom
/**
 * 统一 API 客户端测试（D3）
 *
 * 覆盖：解包 / token 头（含 login·register 例外）/ 各类错误码 / 401 副作用（清会话 + 跳登录）/
 * 网络异常统一话术 / query 拼接 / POST body 序列化 / 非 JSON 响应不再白屏。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, buildUrl, request } from '../src/api/client';
import * as api from '../src/api/endpoints';
import { STORAGE_KEYS } from '../src/router';
import { useAuthStore } from '../src/stores/auth';

interface Recorded {
  url: string;
  init: RequestInit;
}

let recorded: Recorded[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): void {
  recorded = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      recorded.push({ url, init: init ?? {} });
      return handler(url, init ?? {});
    }),
  );
}

function lastHeaders(): Record<string, string> {
  return (recorded[recorded.length - 1].init.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().clear();
  window.location.hash = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client · 解包与鉴权头（契约 §0）', () => {
  it('code=0 → 返回 data（不返回整个信封）', async () => {
    stubFetch(() => jsonResponse({ code: 0, msg: 'success', data: { updated: 12 } }));
    const data = await api.selfReport({ space_id: 'sp_1', reports: [{ chapter: '二次函数', level: 3 }] });
    expect(data).toEqual({ updated: 12 });
  });

  it('自动附 Authorization: Bearer <token>', async () => {
    useAuthStore.getState().setSession({ user_id: 'u_1024', token: 'tok_abc' });
    stubFetch(() => jsonResponse({ code: 0, msg: 'success', data: { spaces: [] } }));

    await api.listSpaces();
    expect(lastHeaders().Authorization).toBe('Bearer tok_abc');
    expect(recorded[0].url).toBe('/api/space/list');
  });

  it('register / login 不带 Authorization（auth:false）', async () => {
    useAuthStore.getState().setSession({ user_id: 'u_1024', token: 'tok_abc' });
    stubFetch(() => jsonResponse({ code: 0, msg: 'success', data: { user_id: 'u_1', token: 't' } }));

    await api.register({ identifier: 'a@example.com', password: 'secret123' });
    expect(lastHeaders().Authorization).toBeUndefined();

    await api.login({ identifier: 'a@example.com', password: 'secret123' });
    expect(lastHeaders().Authorization).toBeUndefined();
  });

  it('POST body 序列化 + Content-Type（GET 无 body）', async () => {
    stubFetch(() => jsonResponse({ code: 0, msg: 'success', data: { updated: 4 } }));
    await api.selfReport({ space_id: 'sp_1', reports: [{ chapter: '函数', level: 2 }] });

    expect(recorded[0].init.method).toBe('POST');
    expect(lastHeaders()['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(recorded[0].init.body))).toEqual({
      space_id: 'sp_1',
      reports: [{ chapter: '函数', level: 2 }],
    });
  });

  it('query 拼接：#19 报告接口带 space_id，空值跳过', async () => {
    stubFetch(() => jsonResponse({ code: 0, msg: 'success', data: { mastery: [], gaps: [], accuracy: [] } }));
    await api.reportSummary('sp_1');
    expect(recorded[0].url).toBe('/api/report/summary?space_id=sp_1');

    expect(buildUrl('/x', { a: undefined, b: null, c: '', d: 0, e: 'v' })).toBe('/x?d=0&e=v');
    expect(buildUrl('/x')).toBe('/x');
  });
});

describe('client · 错误码分支（九码不扩展，msg 原样透出）', () => {
  it('code!==0 → 抛 ApiError{code,msg,data}（400 服务端话术原样）', async () => {
    stubFetch(() =>
      jsonResponse({ code: 400, msg: 'mode 必须是 diagnose | baseline | retest', data: null }, 400),
    );
    await expect(api.diagnoseNext({ space_id: 'sp_1', mode: 'diagnose' })).rejects.toMatchObject({
      name: 'ApiError',
      code: 400,
      message: 'mode 必须是 diagnose | baseline | retest',
    });
  });

  it('409 冲突：data.existing_space_id 透传给页面（弹「切换过去」用）', async () => {
    stubFetch(() => jsonResponse({ code: 409, msg: '同学科空间已存在', data: { existing_space_id: 'sp_001' } }, 409));
    const error = await api.createSpace({ knowledge_source: 'kb_math_cz' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(409);
    expect((error as ApiError).data).toEqual({ existing_space_id: 'sp_001' });
  });

  it('502 / 504：服务端用户可读降级话术原样透出', async () => {
    stubFetch(() =>
      jsonResponse({ code: 502, msg: '这道题我没看清，麻烦你手动标一下对错', data: null }, 502),
    );
    const error = await api.uploadPaper({ space_id: 'sp_1', file_id: 'file_preset_001' }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe(502);
    expect((error as ApiError).message).toBe('这道题我没看清，麻烦你手动标一下对错');
  });

  it('401 → 清 token（内存 + localStorage）+ hash 跳 #/login + 抛 ApiError(401)', async () => {
    useAuthStore.getState().setSession({ user_id: 'u_1024', token: 'tok_abc' });
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('tok_abc');

    stubFetch(() => jsonResponse({ code: 401, msg: 'token 无效或已过期', data: null }, 401));
    const error = await api.listSpaces().catch((e: unknown) => e);

    expect((error as ApiError).code).toBe(401);
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
    expect(window.location.hash).toBe('#/login');
  });

  it('网络异常（fetch reject）→ ApiError{code:0, msg=统一话术}', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const error = await request('/api/space/list').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(0);
    expect((error as ApiError).message).toBe('网络开小差了，稍后再试一次');
  });

  it('非 JSON 响应 / 空响应 → ApiError（不抛 TypeError 白屏）', async () => {
    stubFetch(() => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    const html = await request('/api/space/list').catch((e: unknown) => e);
    expect(html).toBeInstanceOf(ApiError);
    expect((html as ApiError).code).toBe(502);

    stubFetch(() => new Response('', { status: 204 }));
    const empty = await request('/api/space/list').catch((e: unknown) => e);
    expect(empty).toBeInstanceOf(ApiError);
  });
});
