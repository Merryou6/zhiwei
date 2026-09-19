/**
 * 页 8 · 知识图谱（兼「学习路径页」；批 1 占位 → 批 6 落地）
 * 契约：#19 GET /api/report/summary（全节点掌握度着色）+ 静态副本 graphSnapshot（结构）
 *       查询参数 ?path=kp1,kp2（来自页 7 跳转或 #17 plan.path）
 * 验收：P0 #10 四色着色 + 路径高亮 + 全局图例常驻。
 */
export default function GraphPage() {
  return (
    <section className="max-w-4xl">
      <h1 className="text-xl font-medium text-ink">知识图谱</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 6 落地（契约 #19 + graphSnapshot，ECharts 分层布局）。
      </p>
    </section>
  );
}
