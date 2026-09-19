/**
 * 页 10 · 云盘（P1；批 1 占位 → 批 6 落地）
 * 契约：#5 GET /api/space/{space_id}/drive（只读列表）
 * 验收：P1 预置教材列表只读 + 「上传自定义知识库」禁用占位（点击给非阻断提示）。
 */
export default function DrivePage() {
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-medium text-ink">云盘</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 6 落地（契约 #5，只读列表 + 禁用上传占位）。
      </p>
    </section>
  );
}
