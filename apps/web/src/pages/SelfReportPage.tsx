/**
 * 页 2 · 起点自报问卷（PRD §5 #2「30 秒建先验 + 定主攻章节」；批 1 占位 → 批 3 落地）
 * 契约：#6 POST /api/evidence/self-report（章节粒度，4 章节 × 5 档）
 * 验收：P0 #2 30 秒可完成（含「按 3 档填」一键）、提交后展示 updated。
 */
export default function SelfReportPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">先说说你的大概起点</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 3 落地（契约 #6，章节清单查 graphSnapshot 静态副本）。
      </p>
    </section>
  );
}
