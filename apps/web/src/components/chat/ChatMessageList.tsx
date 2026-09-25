/**
 * 消息流（全屏页与右侧面板共用，D11）。
 *
 * 自 ChatPage 原样迁出：三种气泡（student 右 / agent 左 / notice 居中）+
 * 徽标（方向提示 / 换条路走走）+ 注脚（低置信澄清）+ 带图标注（演示态）+
 * 空态引导；流式追加时贴底滚动，尊重系统「减弱动态效果」（lib/motion.scrollBehavior）。
 */

import { useEffect, useRef } from 'react';

import EmptyState from '../EmptyState';
import { scrollBehavior } from '../../lib/motion';
import RichText from '../../lib/richText';
import type { ChatMessage } from '../../stores/dialog';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  /** 流式追加中（贴底滚动的触发条件之一）。 */
  streaming: boolean;
}

export default function ChatMessageList({ messages, streaming }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 流式追加时贴底；系统开启「减弱动态效果」时改为瞬时滚动
    bottomRef.current?.scrollIntoView({ behavior: scrollBehavior() });
  }, [messages.length, streaming]);

  return (
    <div className="space-y-3 rounded-surface border border-line bg-surface p-4 shadow-card">
      {messages.length === 0 ? (
        <EmptyState
          compact
          title="还没有聊天记录"
          hint="可以从一句「我卡在这里」开始，也可以传张题图让我先读题。"
        />
      ) : null}

      {messages.map((message) => {
        if (message.role === 'notice') {
          return (
            <p key={message.id} className="text-center text-ui-sm text-ink-soft">
              {message.text}
            </p>
          );
        }

        const isStudent = message.role === 'student';
        return (
          <div key={message.id} className={isStudent ? 'flex justify-end' : 'flex justify-start'}>
            {/* break-words（R6）：无空格长串（file_id / 行内 code）不再撑破气泡。
                overflow-wrap 只在「确实放不下」时生效 → 桌面正常文本零变化。 */}
            <div className={isStudent ? 'max-w-[80%] break-words text-right' : 'max-w-[85%] break-words'}>
              <div
                className={[
                  'inline-block rounded-surface px-4 py-2.5 text-left text-sm leading-relaxed break-words',
                  isStudent ? 'whitespace-pre-wrap bg-accent-veil text-ink' : 'bg-canvas text-ink',
                ].join(' ')}
              >
                {message.text.length > 0 ? (
                  // 学长回复走轻量 Markdown 子集（加粗/列表/换行）；学生输入是纯文本，保持原样
                  isStudent ? (
                    message.text
                  ) : (
                    <RichText text={message.text} className="space-y-1.5" />
                  )
                ) : message.pending ? (
                  '正在想…'
                ) : (
                  ''
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-ui-sm text-ink-soft">
                {isStudent && message.imageFileId ? (
                  // break-all（R6）：file_id 是无空格长串，只有强制断行才不溢出
                  <span className="break-all rounded-md bg-canvas px-2 py-0.5">
                    已带题图（演示态 · {message.imageFileId}）
                  </span>
                ) : null}
                {message.badge === 'hint' ? (
                  <span className="rounded-md bg-band-unstable/15 px-2 py-0.5 text-band-unstable">方向提示</span>
                ) : null}
                {message.badge === 'exit' ? (
                  <span className="rounded-md bg-band-weak/15 px-2 py-0.5 text-band-weak">换条路走走</span>
                ) : null}
                {!isStudent && message.note ? (
                  <span className="text-ink-soft">注：{message.note}</span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
