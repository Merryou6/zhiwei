/**
 * 页 1 · 登录 / 注册（PRD §5 #1「一件事：进得来」；P0 #1）
 *
 * 契约：#1 POST /api/auth/register（注册成功服务端自动建默认空间）
 *       #2 POST /api/auth/login
 *       #3 GET /api/space/list（登录后取空间，落 activeSpace，刷新不掉线）
 * 交互：一屏一件事（单卡表单 + 主按钮）；错误用服务端 msg 走非阻断 toast（不弹窗）。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listSpaces, login, register } from '../api/endpoints';
import { UI_TEXT } from '../lib/phrases';
import { SELF_REPORT_PATH, SPACES_PATH } from '../router';
import { useAuthStore } from '../stores/auth';
import { pickDefaultSpace, useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const toast = useUiStore((state) => state.toast);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (submitting) return;

    if (identifier.trim().length === 0) {
      toast('先填手机号或邮箱，我才能记住你', 'warn');
      return;
    }
    if (password.length < 6) {
      toast('密码至少 6 位（这是契约要求，不是我挑）', 'warn');
      return;
    }

    setSubmitting(true);
    try {
      const data =
        tab === 'register'
          ? await register({ identifier: identifier.trim(), password, nickname: nickname.trim() || null })
          : await login({ identifier: identifier.trim(), password });

      setSession(data);

      // 取空间列表：注册后服务端已自动建默认空间；此处落 activeSpace（刷新不掉线）
      let defaultName = '初中数学';
      try {
        const { spaces } = await listSpaces();
        setSpaces(spaces);
        defaultName = pickDefaultSpace(spaces)?.name ?? defaultName;
      } catch {
        /* 空间取不到不阻断登录：页 3 会重试 */
      }

      if (tab === 'register') {
        toast(`已为你建好「${defaultName}」学习空间`);
        navigate(SELF_REPORT_PATH, { replace: true });
      } else {
        navigate(SPACES_PATH, { replace: true });
      }
    } catch (error) {
      toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'mt-1 min-h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition-colors focus:border-primary';

  return (
    // 走查修正：认证页是全屏入口（无内容区导航），保持水平居中属有意例外；
    // 但增加垂直居中，修掉原「内容贴顶、下方大片留白」的重心失衡。
    <section className="mx-auto flex min-h-[calc(100vh-11rem)] max-w-md flex-col justify-center">
      <h1 className="text-xl font-medium text-ink">知微 · 学习伴侣</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        我会先弄清你卡在哪个知识点，再陪你把它补上。第一次来直接注册，30 秒就能开始。
      </p>

      <div className="mt-6 flex gap-1 rounded-xl border border-line bg-white p-1 text-sm shadow-card">
        {(['login', 'register'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={[
              'min-h-9 flex-1 rounded-lg px-3 py-2 transition-colors',
              tab === item
                ? 'bg-primary-soft font-medium text-ink ring-1 ring-primary/30'
                : 'text-ink-soft hover:bg-canvas',
            ].join(' ')}
          >
            {item === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-card"
      >
        <label className="block text-sm text-ink">
          手机号或邮箱
          <input
            className={inputClass}
            value={identifier}
            autoComplete="username"
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </label>

        <label className="mt-4 block text-sm text-ink">
          密码（≥6 位）
          <input
            className={inputClass}
            type="password"
            value={password}
            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {tab === 'register' ? (
          <label className="mt-4 block text-sm text-ink">
            称呼（可选）
            <input
              className={inputClass}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 min-h-11 w-full rounded-lg bg-primary px-4 py-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? '正在处理…' : tab === 'login' ? '进去看看' : '注册并开始'}
        </button>
      </form>
    </section>
  );
}
