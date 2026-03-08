import { test, expect } from "@playwright/test";

test.describe("smoke tests", () => {
  test("ログインページが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/login");
    // ログインページにタイトルが表示されること
    await expect(page.getByText("HR-AI Agent")).toBeVisible();
  });

  test("未認証で保護ページにアクセスするとリダイレクトされる", async ({ page }) => {
    await page.goto("/inbox");
    // middleware が /login にリダイレクト
    await expect(page).not.toHaveURL("/inbox");
  });
});
