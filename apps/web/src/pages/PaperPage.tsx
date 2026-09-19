/**
 * 页 5 · 试卷上传与逐题确认（PRD §5 #5「识别进度 → 逐题确认对错」；批 1 占位 → 批 4 落地）
 * 契约：#5 GET /api/space/{space_id}/drive（选预置文件）、#9 POST /api/evidence/paper、
 *       #10 GET /api/evidence/paper/{recognition_id}（刷新回显）、
 *       #11 POST /api/evidence/paper/confirm
 * 验收：P0 #4 unclear 行必须手标（无默认值、未标全禁止提交）、确认后批量更新展示。
 */
export default function PaperPage() {
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-medium text-ink">试卷上传</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 4 落地（契约 #5 / #9 / #10 / #11）。
      </p>
    </section>
  );
}
