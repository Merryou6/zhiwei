/**
 * 页 1 · 登录 / 注册（PRD §5 #1「一件事：进得来」；批 1 施工占位 → 批 3 落地）
 * 契约：#1 POST /api/auth/register、#2 POST /api/auth/login
 * 验收：P0 #1 注册即自动建默认空间、token 存 localStorage 刷新不掉线。
 */
export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-xl font-medium text-ink">登录 / 注册</h1>
      <p className="mt-2 text-sm text-ink-soft">
        施工占位：批 3 落地（契约 #1 register / #2 login，注册成功直接进起点自报）。
      </p>
    </section>
  );
}
