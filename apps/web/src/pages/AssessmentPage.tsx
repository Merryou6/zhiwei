/**
 * 页 4 · 测评（PRD §5 #4「单题呈现 + 进度条，无对错反馈」；批 1 占位 → 批 4 落地）
 * 契约：#7 POST /api/diagnose/next（mode / scope_chapter / exclude_item_ids）
 *       #8 POST /api/diagnose/submit（correct 仅测量模式返回，前端一律不渲染 —— D11）
 * 验收：P0 #3 不出已做题、不展示对错、converged 即停进结束屏；P0 #11 baseline/retest 模式可选。
 */
export default function AssessmentPage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-medium text-ink">测评</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 4 落地（契约 #7 / #8，模式选择屏 → 单题屏 → 结束屏）。
      </p>
    </section>
  );
}
