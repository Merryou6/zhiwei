/**
 * 页 3 · 学习空间列表（PRD §5 #3「默认已有空间；新建是次要按钮」；批 1 占位 → 批 3 落地）
 * 契约：#3 GET /api/space/list、#4 POST /api/space/create（409 → 弹窗默认按钮「切换过去」）
 * 验收：P0 #1 默认空间可见；409 的 existing_space_id 被正确消费。
 */
export default function SpacesPage() {
  return (
    <section className="max-w-3xl">
      <h1 className="text-xl font-medium text-ink">学习空间</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 3 落地（契约 #3 / #4，注册即自动建的「初中数学」默认空间）。
      </p>
    </section>
  );
}
