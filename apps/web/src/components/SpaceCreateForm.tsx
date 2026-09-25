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
 *
 * 长度（H1）：输入框 maxLength 与提交前预检共用 lib/stages 的 SPACE_NAME_MAX（= 后端上限 30），
 * suggestSpaceName() 的返回值恒 ≤ 该上限 ⇒ 用户怎么输入（含「30 字原名已被占用」）都不会因长度被 400。
 *
 * 本地预检的前提（L4）：taken 取自 store.spaces，依赖其新鲜度。列表为空（刚登录 / 尚未拉取）时
 * 这里会**先补拉一次 listSpaces** 再预检；但列表「非空而已过期」（多端并发新建）仍可能落到服务端
 * 409 → ConfirmDialog「切换过去」。单实例 JSON 存储、无并发锁是本项目已知限制（LOOKATME），
 * 该降级路径有明确反馈、非静默，与计划 R4 的「409 仅作并发兜底」一致，故接受。
 */

import { useState } from 'react';

import { ApiError } from '../api/client';
import { createSpace, listSpaces } from '../api/endpoints';
import type { SpaceCreateConflictData, SpaceCreateData } from '../api/types';
import { SPACE_NAME_MAX, suggestSpaceName, STAGES } from '../lib/stages';
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

      // L4：列表为空（刚登录 / 尚未拉取）时先补拉一次，避免 taken=[] 把「重名自动后缀」
      // 降级成「409 → 切换过去」。只用于本次预检，不写 store（不干扰 activeSpace）。
      let taken = spaces.map((space) => space.name);
      if (taken.length === 0) {
        try {
          taken = (await listSpaces()).spaces.map((space) => space.name);
        } catch {
          /* 拉取失败 → 退回本地列表（可能 409，由下方 ConfirmDialog 兜底），不阻断提交 */
        }
      }

      // suggestSpaceName 保证返回值长度 ≤ SPACE_NAME_MAX（= 服务端上限），故不会因长度被 400
      const name = suggestSpaceName(base, taken);

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
          <legend className={compact ? 'text-ui-sm text-ink-soft' : 'text-sm text-ink-soft'}>
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
          <span className={compact ? 'text-ui-sm text-ink-soft' : 'text-sm text-ink-soft'}>
            空间名（可不填）
          </span>
          <input
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            maxLength={SPACE_NAME_MAX}
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

        <p className={`mt-2 text-ui-sm leading-relaxed text-ink-soft ${compact ? '' : 'max-w-prose'}`}>
          同一个学科可以建多个空间，名字不重复就行（最多 {SPACE_NAME_MAX} 字）。
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
