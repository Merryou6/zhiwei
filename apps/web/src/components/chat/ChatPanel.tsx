/**
 * 右侧常驻对话面板（v1.3，D1）——与 /chat 全屏页共用同一套共享视图（D11：不复制两份实现）。
 *
 * 内部结构：头部（标题 + 模型只读徽标 + 「全屏打开」Link + 关闭）+ 自管滚动的消息/链路区 +
 * 底部固定输入区。面板的宽度、定位与背景幕在 Layout 的 ChatPanelDock 里（≥1280 常驻挤压正文列、
 * <1280 覆盖式抽屉，D1b）；本组件只管面板内部结构与 Esc 关闭（D1f）。
 *
 * 上下文不丢：消息 / meta / 当轮链路都在全局 store（stores/dialog.ts），
 * 关掉面板再打开、或从 /chat 全屏页点「收进侧栏」过来，看到的都是同一份对话。
 *
 * 「全屏打开」= 切换到 /chat 全屏形态；两形态并存会让正文列被挤压且对话区重复，
 * 故进入全屏时一并收起面板（D22，与全屏页「收进侧栏」互为反向操作）。
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useChatPanelStore } from '../../stores/chatPanel';
import { useDialogStore } from '../../stores/dialog';
import ChatComposer from './ChatComposer';
import ChatMessageList from './ChatMessageList';
import ChatTracePanel from './ChatTracePanel';
import ModelBadge, { useModelInfo } from './ModelBadge';

/** 全屏对话页路径（与 router.ROUTES 的 '/chat' 一致；本文件不改路由数据，故此处不引常量）。 */
const CHAT_PATH = '/chat';

export default function ChatPanel() {
  const store = useDialogStore();
  const model = useModelInfo();
  const setOpen = useChatPanelStore((state) => state.setOpen);

  // Esc 关闭（D1f）：面板是覆盖层，键盘上必须有一条明确的退路。
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex flex-none items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-ui-sm font-medium text-ink">对话辅导</p>
          <div className="mt-1">
            <ModelBadge mode={model?.mode ?? 'local'} name={model?.name ?? null} />
          </div>
        </div>

        <Link
          to={CHAT_PATH}
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-control border border-line px-2 py-1 text-caption text-ink-soft hover:bg-raised max-nav:min-h-9"
        >
          全屏打开
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="关闭对话面板"
          title="关闭（Esc）"
          className="shrink-0 rounded-control border border-line p-1.5 text-ink-soft hover:bg-raised max-nav:min-h-9"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
          </svg>
        </button>
      </header>

      {/* 消息区自管滚动（D1f）：不劫持页面滚动，输入区恒在面板底部 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ChatMessageList messages={store.messages} streaming={store.streaming} />
        <div className="mt-3">
          <ChatTracePanel
            thought={store.thought}
            toolSteps={store.toolSteps}
            phase={store.phase}
            streaming={store.streaming}
            mode={model?.mode ?? 'local'}
          />
        </div>
      </div>

      {/* pb-safe-3（R9/D14）：<720 面板是覆盖式抽屉，输入区要避让 home indicator；
          ≥720 面板为常驻挤压态、非刘海设备 env()=0 → 仍是原 pb-3 的 12px。 */}
      <div className="flex-none border-t border-line px-4 pb-safe-3">
        <ChatComposer disabled={store.streaming} />
      </div>
    </div>
  );
}
