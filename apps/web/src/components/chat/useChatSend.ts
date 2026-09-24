/**
 * 一轮对话的发送逻辑（全屏页与右侧面板共用，D11：业务与视觉一律在共享组件内）。
 *
 * 从 ChatPage 原样迁出：学生发言入列 → startAssistant → streamChat →
 * delta 增量追加 / meta 落 store / 结束定制注脚与徽标 / 失败出错误气泡（不白屏）。
 *
 * v1.3 新增：onPhase / onThought / onTool 三个过程回调接到 dialog store
 *   （phase 覆盖、thought 拼接、tool 按 id upsert），全屏页与面板因此共用同一条链路状态。
 */

import { ApiError } from '../../api/client';
import { streamChat } from '../../api/sse';
import type { ChatMeta } from '../../api/types';
import { UI_TEXT } from '../../lib/phrases';
import { useDialogStore } from '../../stores/dialog';
import { useSpaceStore } from '../../stores/space';
import { useUiStore } from '../../stores/ui';

/** kp 匹配低置信阈值（契约 §9：< 0.6 服务端先追问、不产生证据）。 */
export const LOW_CONFIDENCE = 0.6;

function badgeOf(meta: ChatMeta | null): 'hint' | 'exit' | null {
  if (!meta) return null;
  if (meta.next_action === 'exit_channel') return 'exit';
  if (meta.next_action === 'hint_down') return 'hint';
  return null;
}

export interface ChatSendApi {
  /** 发送一条学生消息（同一条链路：面板与全屏页共用 store，上下文互通）。 */
  send: (text: string, imageFileId?: string | null) => Promise<void>;
  /** 是否正在回复（发送键据此禁用）。 */
  streaming: boolean;
}

export function useChatSend(): ChatSendApi {
  const streaming = useDialogStore((state) => state.streaming);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const toast = useUiStore((state) => state.toast);

  async function send(text: string, imageFileId: string | null = null): Promise<void> {
    const store = useDialogStore.getState();
    if (!activeSpaceId) {
      toast('先选一个学习空间', 'warn');
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length === 0 || store.streaming) return;

    store.appendStudent(trimmed, imageFileId);
    const assistantId = store.startAssistant();

    try {
      await streamChat(
        {
          space_id: activeSpaceId,
          dialog_id: store.dialogId ?? undefined,
          message: trimmed,
          image_file_id: imageFileId ?? undefined,
        },
        {
          onDelta: (delta) => useDialogStore.getState().appendDelta(assistantId, delta),
          onMeta: (meta) => useDialogStore.getState().setMeta(meta),
          onPhase: (phase) => useDialogStore.getState().setPhase(phase),
          onThought: (thought) => useDialogStore.getState().appendThought(thought),
          onTool: (tool) => useDialogStore.getState().upsertTool(tool),
          onDone: () => {
            const meta = useDialogStore.getState().meta;
            const lowConfidence =
              meta !== null &&
              (meta.kp_match.confidence ?? 0) < LOW_CONFIDENCE &&
              meta.kp_match.kp_id.length > 0;
            useDialogStore
              .getState()
              .finishAssistant(
                assistantId,
                badgeOf(meta),
                lowConfidence ? '我不太确定说的是哪个知识点，可以再描述一下吗' : null,
              );
          },
          onError: (msg) => {
            useDialogStore.getState().failAssistant(assistantId, msg);
            toast(msg, 'warn');
          },
          onFallback: (msg) => toast(msg),
        },
      );
    } catch (error) {
      // streamChat 内部已按降级链兜底，这里是最后一道：绝不白屏
      useDialogStore
        .getState()
        .failAssistant(assistantId, error instanceof ApiError ? error.message : UI_TEXT.networkError);
    }
  }

  return { send, streaming };
}
