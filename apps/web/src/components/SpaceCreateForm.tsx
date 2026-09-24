/**
 * 新建空间表单（D2c：唯一共享入口）
 *
 * 两个宿主复用同一份提交 / 预检 / 409 处理，避免「两套新建入口各自为政」：
 *   · /spaces 页 = 完整态（compact=false）：学科单选 + 可选名，卡片式排布；
 *   · 顶栏空间弹层 = 紧凑态（compact=true）：同一表单压扁，任意页面都有看得见的反馈。
 *
 * 关键行为（D1）：
 *   1) **学科单选**才是「学科选择器」——原来 STAGES 只用来显示文案，用户根本没地方选学科；
 *   2) 空间名可选，缺省 = 所选学科名；提交前用 store 里已有空间名做本地预检，
 *      重名自动追加序号（「初中数学 2」…），保证「一键新建必成功」；
 *      服务端 409 仅作并发兜底，收到后弹既有 ConfirmDialog「切换过去」（契约 §2 明文默认按钮）；
 *   3) 调用顺序固定：**先 setActive(新空间) 再 setSpaces(新列表)**——stores/space.ts 的 setSpaces
 *      会保留当前 activeSpaceId、否则回落到默认空间；顺序反了新建的空间会被回落逻辑顶掉。
 */

import { useState } from 'react';

import { ApiError } from '../api/client';
import { createSpace, listSpaces } from '../api/endpoints';
import type { SpaceCreateConflictData, SpaceCreateData } from '../api/types';
import { suggestSpaceName, STAGES } from '../lib/stages';
import { UI_TEXT } from '../lib/phrases';
import { useSpaceStore } from '../stores/space';
import { useUiStore } from '../stores/ui';
import ConfirmDialog from './ConfirmDialog';

export interface SpaceCreateFormProps {
  /** 紧凑态：嵌在顶栏弹层里时用（收紧留白、单选竖向排列）。 */
  compact?: boolean;
  /** 新建成功后的回调（顶栏用它收起弹层）。 */
  onCreated?: (space: SpaceCreateData) => void;
}

export default function SpaceCreateForm({ compact = false, onCreated }: SpaceCreateFormProps) {
  const [stageId, setStageId] = useState<string>(STAGES[0].id);
  const [nameInput, setNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [conflictSpaceId, setConflictSpaceId] = useState<string | null>(null);

  const spaces = useSpaceStore((state) => state.spaces);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  const toast = useUiStore((state) => state.toast);

  async function refresh(): Promise<void> {
    const data = await listSpaces();
    setSpaces(data.spaces);
  }

  async function handleSubmit(): Promise<void> {
    if (creating) return;
    setCreating(true);
    try {
      const stage = STAGES.find((item) => item.id === stageId) ?? STAGES[0];
      const base = nameInput.trim() || stage.label;
      const name = suggestSpaceName(base, spaces.map((space) => space.name));

      const created = await createSpace({ knowledge_source: stage.id, name });

      // 顺序不可颠倒：先落 active，再刷新列表（否则被 setSpaces 的回落逻辑顶掉）
      setActive(created.space_id);
      await refresh();

      toast(`已建好「${created.name}」`);
      setNameInput('');
      onCreated?.(created);
    } catch (error) {
      if (error instanceof ApiError && error.code === 409) {
        const data = error.data as SpaceCreateConflictData | null;
        if (data?.existing_space_id) setConflictSpaceId(data.existing_space_id);
        else toast(error.message, 'warn');
      } else {
        toast(error instanceof ApiError ? error.message : UI_TEXT.networkError, 'warn');
      }
    } finally {
      setCreating(false);
    }
  }

  const inputClass =
    'mt-2 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/80';

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset>
          <legend className={compact ? 'text-[13px] text-ink-soft' : 'text-sm text-ink-soft'}>
            选一个学科
          </legend>
          <div className={compact ? 'mt-1.5 flex flex-col gap-1' : 'mt-2 flex flex-wrap gap-2'}>
            {STAGES.map((stage) => (
              <label
                key={stage.id}
                className={[
                  'flex cursor-pointer items-center gap-2 rounded-control border px-3 py-1.5 text-sm',
                  stage.id === stageId
                    ? 'border-accent bg-accent-veil text-accent'
                    : 'border-line text-ink hover:bg-raised',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="space-stage"
                  value={stage.id}
                  checked={stage.id === stageId}
                  onChange={() => setStageId(stage.id)}
                  className="h-3.5 w-3.5"
                />
                {stage.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className={compact ? 'mt-3 block' : 'mt-4 block'}>
          <span className={compact ? 'text-[13px] text-ink-soft' : 'text-sm text-ink-soft'}>
            空间名（可不填）
          </span>
          <input
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            maxLength={40}
            placeholder="不填就用学科名"
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={creating}
          className={[
            'min-h-9 rounded-control bg-accent px-4 py-2 text-sm text-on-accent hover:opacity-90 disabled:opacity-60',
            compact ? 'mt-3 w-full' : 'mt-4',
          ].join(' ')}
        >
          {creating ? '正在新建…' : '新建空间'}
        </button>

        <p className={`mt-2 text-[13px] leading-relaxed text-ink-soft ${compact ? '' : 'max-w-prose'}`}>
          同一个学科可以建多个空间，名字不重复就行。
        </p>
      </form>

      <ConfirmDialog
        open={conflictSpaceId !== null}
        title="已有同名空间"
        description="同一个空间名下只能有一个空间，数据才不会分散。要切到已有的那个吗？"
        confirmLabel={UI_TEXT.switchToExisting}
        onCancel={() => setConflictSpaceId(null)}
        onConfirm={() => {
          if (conflictSpaceId) setActive(conflictSpaceId);
          setConflictSpaceId(null);
          void refresh().catch(() => {
            /* 列表刷新失败不阻断：active 已切换，页面自会提示 */
          });
        }}
      />
    </>
  );
}
