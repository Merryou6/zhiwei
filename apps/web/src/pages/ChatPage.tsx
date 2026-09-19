/**
 * 页 6 · 对话辅导（SSE 流式；批 1 占位 → 批 5 落地）
 * 契约：#18 POST /api/agent/chat（Content-Type: text/event-stream；事件序列 delta → meta → done；
 *       降级为普通 JSON 时结构 = { reply, meta }）
 * 验收：P0 #8 SSE 流式渲染、hint_down / exit_channel 视觉区分、中断降级不白屏。
 */
export default function ChatPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">对话辅导</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 5 落地（契约 #18，流式增量渲染）。
      </p>
    </section>
  );
}
