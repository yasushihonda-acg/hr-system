/**
 * LINE メッセージ responseStatus バックフィルスクリプト
 *
 * responseStatus フィールドが未設定の既存ドキュメントに
 * "unresponded" をデフォルト値として付与する。
 *
 * 実行:
 *   pnpm --filter @hr-system/worker tsx src/scripts/backfill-line-response-status.ts
 *
 * --dry-run フラグで更新せずに対象件数のみ確認可能:
 *   pnpm --filter @hr-system/worker tsx src/scripts/backfill-line-response-status.ts --dry-run
 */
import "@hr-system/db/client"; // Firebase 初期化
import { collections } from "@hr-system/db";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500; // Firestore batch write の上限

async function main() {
  console.log(
    `[Backfill] Fetching LINE messages without responseStatus...${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  const snapshot = await collections.lineMessages.get();
  const targets = snapshot.docs.filter((doc) => {
    const d = doc.data();
    return !d.responseStatus;
  });

  console.log(`[Backfill] Found ${targets.length} / ${snapshot.size} messages to backfill`);

  if (DRY_RUN || targets.length === 0) {
    process.exit(0);
  }

  let updated = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = collections.lineMessages.firestore.batch();
    const chunk = targets.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      batch.update(doc.ref, {
        responseStatus: "unresponded",
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`  Updated ${updated} / ${targets.length}`);
  }

  console.log("\n[Backfill] Complete!");
  console.log(`  Updated: ${updated}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("[Backfill] Fatal error:", e);
  process.exit(1);
});
