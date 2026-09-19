/**
 * 页 7 · 归因结果（PRD §5 #7「路径 + 根因 + 错误类型 + 反驳」；批 1 占位 → 批 5 落地）
 * 契约：#12 POST /api/error/classify、#13 POST /api/attribution/analyze、
 *       #14 GET /api/attribution/{attribution_id}（刷新回显）、
 *       #15 POST /api/attribution/verify、#16 POST /api/agent/reject、#17 POST /api/plan/generate
 * 验收：P0 #6 五类枚举 + 低置信就地追问；P0 #7 self 不回溯 / upstream 回溯 + 验证；
 *       P0 #9 回溯步进条 + 根因高亮 + 反驳按钮 + 耗尽兜底文案。
 */
export default function AttributionPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">归因结果</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 5 落地（契约 #12–#17，向导态 / 结果态两形态）。
      </p>
    </section>
  );
}
