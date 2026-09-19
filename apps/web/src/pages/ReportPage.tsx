/**
 * 页 9 · 学习报告（PRD §5 #9「掌握度分布 + ΔAccuracy」；批 1 占位 → 批 6 落地）
 * 契约：#19 GET /api/report/summary?space_id=xxx（mastery / gaps / accuracy）
 * 验收：P0 #12 三段齐全（分布 / 缺口 / 基线 vs 复测 ΔAccuracy）。
 */
export default function ReportPage() {
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-medium text-ink">学习报告</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 6 落地（契约 #19，三段布局）。
      </p>
    </section>
  );
}
