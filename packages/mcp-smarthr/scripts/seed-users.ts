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

/**
 * 外部 readonly 例外ユーザー（allowedDomain 外）。
 * EXTERNAL_READONLY_EMAIL_ALLOWLIST 環境変数との二重承認（両方必要）で許可される。
 */
const EXTERNAL_READONLY_USERS: Array<{
  email: string;
  approvedBy: string;
  reason: string;
}> = [
  {
    email: "y@lend.aozora-cg.com",
    approvedBy: "yasushi.honda@aozora-cg.com",
    reason:
      "lend テナントからの readonly 参照（ドメインユーザー同等の信頼レベル、初期は readonly）",
  },
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

  const now = new Date().toISOString();
  for (const { email, approvedBy, reason } of EXTERNAL_READONLY_USERS) {
    await store.setUser(email, "readonly", true, {
      permissions: ["read"],
      external: true,
      approvedBy,
      approvedAt: now,
      reason,
    });
    console.log(`  [external readonly] ${email} (approvedBy: ${approvedBy})`);
  }

  console.log("\n=== 登録完了。確認中... ===\n");

  const users = await store.listUsers();
  for (const u of users) {
    const ext = u.external ? " [external]" : "";
    console.log(`  ${u.email}: role=${u.role}, enabled=${u.enabled}${ext}`);
  }

  console.log(`\n合計: ${users.length} ユーザー`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
