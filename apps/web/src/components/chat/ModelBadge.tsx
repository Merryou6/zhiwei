/**
 * 对话模型只读徽标（D6）——面板头部与 /chat 全屏页头部共用。
 *
 * 数据源 = #20 GET /api/user/profile 的 model: { mode, name }（服务端配置，只读）。
 * 固定副文案明示「由服务端配置，不可自定义」；本文件不含任何切换/自定义入口（红线复核项）。
 *
 * useModelInfo()：进程内取一次、缓存复用（面板与全屏页各挂一次，避免重复请求）。
 */

import { useEffect, useState } from 'react';

import { getUserProfile } from '../../api/endpoints';
import type { ProfileModelView } from '../../api/types';

/** 只读说明文案（与「我的」页同口径）。 */
export const MODEL_READONLY_NOTE = '由服务端配置，不可自定义';

let cachedModel: ProfileModelView | null = null;
let inflight: Promise<ProfileModelView | null> | null = null;

function loadModelInfo(): Promise<ProfileModelView | null> {
  if (cachedModel) return Promise.resolve(cachedModel);
  if (!inflight) {
    inflight = getUserProfile()
      .then((profile) => {
        cachedModel = profile.model;
        return cachedModel;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** 取模型运行信息（失败静默返回 null：徽标退化为「—」，不打断对话）。 */
export function useModelInfo(): ProfileModelView | null {
  const [model, setModel] = useState<ProfileModelView | null>(cachedModel);

  useEffect(() => {
    if (model) return;
    let cancelled = false;
    void loadModelInfo().then((value) => {
      if (!cancelled && value) setModel(value);
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  return model;
}

export interface ModelBadgeProps {
  mode: 'local' | 'remote';
  name: string | null;
}

export default function ModelBadge({ mode, name }: ModelBadgeProps) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-caption text-ink-soft">
      <span className="rounded-md bg-accent-veil px-1.5 py-0.5 text-accent-ink">
        {mode === 'remote' ? '远程大模型' : '本地规则'}
      </span>
      {mode === 'remote' && name ? <span className="font-mono text-ink">{name}</span> : null}
      <span className="text-ink-soft">{MODEL_READONLY_NOTE}</span>
    </span>
  );
}
