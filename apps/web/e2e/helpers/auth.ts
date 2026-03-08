import type { Page } from "@playwright/test";

/**
 * dev Credentials プロバイダーでログインする。
 *
 * NextAuth の Credentials フォームに POST してセッション Cookie を取得する。
 * NODE_ENV=development 前提（本番では Credentials プロバイダーが無効）。
 */
export async function loginAsDev(page: Page, email = "test@example.com"): Promise<void> {
  // NextAuth CSRF トークンを取得
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Credentials プロバイダーに POST でログイン
  await page.request.post("/api/auth/callback/dev-login", {
    form: {
      csrfToken,
      email,
    },
  });

  // Cookie が設定されたのでページをリロードしてセッションを反映
  await page.goto("/");
}
