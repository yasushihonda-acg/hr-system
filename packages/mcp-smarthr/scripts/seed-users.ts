/**
 * Firestore mcp-users コレクションに初期ユーザーを登録するスクリプト
 *
 * 実行: npx tsx packages/mcp-smarthr/scripts/seed-users.ts
 * 前提: ADC が設定済みであること
 */

import { FirestoreUserStore } from "../src/core/stores/firestore-user-store.js";

const ADMIN_USERS = [
  "kosuke.omure@aozora-cg.com",
  "tomohiro.arikawa@aozora-cg.com",
  "makoto.tokunaga@aozora-cg.com",
  "yasushi.honda@aozora-cg.com",
];

const READONLY_USERS = [
  "ryota.yagi@aozora-cg.com",
  "gen.ichihara@aozora-cg.com",
  "rika.komatsu@aozora-cg.com",
  "shoma.horinouchi@aozora-cg.com",
  "tomoko.hommura@aozora-cg.com",
  "yuka.yoshimura@aozora-cg.com",
];

async function main() {
  const store = new FirestoreUserStore({ projectId: "hr-system-487809" });

  console.log("=== mcp-users シード開始 ===\n");

  for (const email of ADMIN_USERS) {
    await store.setUser(email, "admin", true);
    console.log(`  [admin]    ${email}`);
  }

  for (const email of READONLY_USERS) {
    await store.setUser(email, "readonly", true);
    console.log(`  [readonly] ${email}`);
  }

  console.log("\n=== 登録完了。確認中... ===\n");

  const users = await store.listUsers();
  for (const u of users) {
    console.log(`  ${u.email}: role=${u.role}, enabled=${u.enabled}`);
  }

  console.log(`\n合計: ${users.length} ユーザー`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
