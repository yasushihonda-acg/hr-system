/**
 * ヘルプページ用スクリーンショット自動生成スクリプト
 *
 * デスクトップビューポート（1280x800）で各ページのスクリーンショットを撮影し、
 * public/screenshots/help/ に保存する。
 *
 * 使い方:
 *   # ローカル開発サーバー（dev-login）
 *   pnpm screenshot:help
 *
 *   # 本番 URL（事前に storageState を保存）
 *   BASE_URL=https://hr-web-xxx.a.run.app pnpm screenshot:help
 *
 *   # storageState の保存（初回のみ）
 *   npx playwright open --save-storage=e2e/.auth/storage.json https://hr-web-xxx.a.run.app
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { loginAsDev } from "./helpers/auth.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const IS_LOCAL = BASE_URL.includes("localhost");
const STORAGE_STATE_PATH = path.resolve(__dirname, ".auth/storage.json");
const OUTPUT_DIR = path.resolve(__dirname, "../public/screenshots/help");

const VIEWPORT = { width: 1280, height: 800 };

/** ページ定義: ファイル名 → パス（+ 撮影前の待機セレクタ） */
const PAGES: {
  filename: string;
  path: string;
  waitFor?: string;
  /** 撮影前に実行するアクション */
  setup?: (page: import("@playwright/test").Page) => Promise<void>;
}[] = [
  {
    filename: "01-login.png",
    path: "/login",
    waitFor: 'text="Googleでログイン"',
  },
  {
    filename: "02-inbox-chat.png",
    path: "/inbox",
    waitFor: "[data-testid='inbox-content'], table, .space-y-4",
  },
  {
    filename: "03-inbox-line.png",
    path: "/inbox?source=line",
    waitFor: "[data-testid='inbox-content'], table, .space-y-4",
  },
  {
    filename: "04-task-board.png",
    path: "/task-board",
    waitFor: "main",
  },
  {
    filename: "05-tasks.png",
    path: "/tasks",
    waitFor: "table",
  },
  {
    filename: "07-dashboard.png",
    path: "/dashboard",
    waitFor: "main",
  },
  {
    filename: "08-admin-users.png",
    path: "/admin/users",
    waitFor: "table",
  },
  {
    filename: "09-admin-spaces.png",
    path: "/admin/spaces",
    waitFor: "main",
  },
  {
    filename: "10-admin-ai-settings.png",
    path: "/admin/ai-settings",
    waitFor: "main",
  },
];

async function main() {
  console.log(`📸 スクリーンショット生成開始`);
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log(`   出力先:   ${OUTPUT_DIR}`);
  console.log(`   ビューポート: ${VIEWPORT.width}x${VIEWPORT.height}`);
  console.log("");

  const browser = await chromium.launch();

  // 認証コンテキストの準備
  let context: Awaited<ReturnType<typeof browser.newContext>>;

  if (IS_LOCAL) {
    // ローカル: dev-login で認証
    context = await browser.newContext({ viewport: VIEWPORT, baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto(BASE_URL);
    await loginAsDev(page, "yasushi.honda@aozora-cg.com");
    await page.close();
    console.log("✅ ローカル dev-login 完了\n");
  } else {
    // 本番: storageState から認証情報を復元
    try {
      context = await browser.newContext({
        viewport: VIEWPORT,
        storageState: STORAGE_STATE_PATH,
      });
      console.log("✅ storageState から認証情報を復元\n");
    } catch {
      console.error(
        `❌ storageState が見つかりません: ${STORAGE_STATE_PATH}\n` +
          `   初回は以下を実行してください:\n` +
          `   npx playwright open --save-storage=e2e/.auth/storage.json ${BASE_URL}`,
      );
      await browser.close();
      process.exit(1);
    }
  }

  // ログインページは認証不要なので別途撮影
  const loginDef = PAGES.find((p) => p.path === "/login")!;
  const authedPages = PAGES.filter((p) => p.path !== "/login");

  // ログインページ撮影（認証なしコンテキスト）
  {
    const noAuthCtx = await browser.newContext({ viewport: VIEWPORT });
    const page = await noAuthCtx.newPage();
    console.log(`📷 ${loginDef.filename} → ${loginDef.path}`);
    await page.goto(`${BASE_URL}${loginDef.path}`);
    if (loginDef.waitFor) {
      await page
        .locator(loginDef.waitFor)
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {});
    }
    // アニメーション落ち着き待ち
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, loginDef.filename) });
    console.log(`   ✅ 保存完了`);
    await noAuthCtx.close();
  }

  // 認証済みページの撮影
  const page = await context.newPage();
  for (const def of authedPages) {
    console.log(`📷 ${def.filename} → ${def.path}`);
    try {
      await page.goto(`${BASE_URL}${def.path}`, { waitUntil: "networkidle" });
      if (def.waitFor) {
        await page
          .locator(def.waitFor)
          .first()
          .waitFor({ timeout: 10000 })
          .catch(() => {});
      }
      if (def.setup) {
        await def.setup(page);
      }
      // アニメーション落ち着き待ち
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUTPUT_DIR, def.filename) });
      console.log(`   ✅ 保存完了`);
    } catch (err) {
      console.error(`   ❌ 失敗: ${err instanceof Error ? err.message : err}`);
    }
  }

  await browser.close();
  console.log(`\n🎉 完了！ ${PAGES.length}枚のスクリーンショットを生成しました`);
}

main().catch(console.error);
