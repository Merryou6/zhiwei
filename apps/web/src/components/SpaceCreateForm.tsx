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
 * ─────────────────────────────────────────────────────────────────────
 * style-10「青蓝蓝图」迁移 P10.1（2026-10-11 第 4 轮）：**仅视觉层**。
 *   为什么由 P10.1 带出：/spaces 的 02 新建区块渲染的本体就是这个组件（D2c 单一入口），
 *   不一起换制式则该页 02 区块仍停在迁移前的圆角/实心蓝按钮语汇，页面视觉不完整。
 *   改动范围（逐项，全部表现层）：
 *     · 学科单选 → `.bp-seg` 分段制式（原型 .seg；键盘语义仍是原生 radio，不自绘）；
 *     · 空间名 → ui 原语 FormField + Input（下划线刻度制式，并补上 label↔控件关联）；
 *     · 提交键 → ui 原语 Button（等宽大写 + inset 内框线 + 禁用态斜纹，随全站按钮制式）；
 *     · 说明文案 → 批注制式（font-mono text-mono-xs）。
 *   **业务逻辑一行不改**：handleSubmit / refresh / 本地重名预检 / suggestSpaceName 调用 /
 *   409 → ConfirmDialog「切换过去」/ setActive→refresh 的先后顺序 / maxLength / 兜底文案
 *   全部原样。本组件是计划文件清单之外的一个文件，属偏差，见执行报告 D-P10.1-3。
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
import { Button, FormField, Input } from './ui';

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

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset>
          <legend className="font-mono text-tok uppercase tracking-widest text-ink-soft">
            学段学科 / SUBJECT
          </legend>
          {/* 学科单选走 .bp-seg 分段制式（原型 .seg）：真控件仍是原生 radio，
              选中态与焦点环由 :has() 表达 —— 不重造键盘语义与读屏语义。 */}
          <div className={compact ? 'bp-seg bp-seg--vertical mt-2' : 'bp-seg mt-2'}>
            {STAGES.map((stage) => (
              <label key={stage.id}>
                <input
                  type="radio"
                  name="space-stage"
                  value={stage.id}
                  checked={stage.id === stageId}
                  onChange={() => setStageId(stage.id)}
                />
                {stage.label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-mono-xs tracking-wide text-ink-soft">
            目前覆盖 {STAGES.map((stage) => stage.label).join(' · ')}
          </p>
        </fieldset>

        <FormField
          // 上限走 lib/stages 的 SPACE_NAME_MAX（与后端常量同源，见文件头 H1）
          className={compact ? 'mt-3' : 'mt-4'}
          label={`空间名称（可不填 · 上限 ${SPACE_NAME_MAX} 字）`}
          hint="留空则取学科名；重名时自动追加序号，放心建。"
        >
          <Input
            type="text"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            maxLength={SPACE_NAME_MAX}
            placeholder="不填就用学科名"
          />
        </FormField>

        <Button
          type="submit"
          loading={creating}
          full={compact}
          className={compact ? 'mt-3' : 'mt-4'}
        >
          {creating ? '正在新建…' : '新建空间'}
        </Button>

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
