/**
 * category → categories マイグレーションスクリプト
 *
 * 既存ドキュメントの `category: string` を `categories: string[]` に変換し、
 * 旧 `category` フィールドを削除する。
 *
 * 対象コレクション:
 *   - intent_records: category → categories, originalCategory → originalCategories
 *   - line_messages: category → categories
 *   - manual_tasks: category → categories
 *
 * 実行:
 *   pnpm --filter @hr-system/worker tsx src/scripts/migrate-category-to-categories.ts
 *
 * --dry-run フラグで更新せずに対象件数のみ確認可能:
 *   pnpm --filter @hr-system/worker tsx src/scripts/migrate-category-to-categories.ts --dry-run
 */
import "@hr-system/db/client"; // Firebase 初期化
import { collections } from "@hr-system/db";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

interface MigrationResult {
  collection: string;
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
}

async function migrateIntentRecords(): Promise<MigrationResult> {
  const name = "intent_records";
  console.log(`\n[Migrate] Processing ${name}...`);

  const snapshot = await collections.intentRecords.get();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const writeBatch = collections.intentRecords.firestore.batch();
    let batchCount = 0;

    for (const doc of batch) {
      const data = doc.data() as unknown as Record<string, unknown>;

      // 既に移行済み（categories フィールドが存在）
      if (Array.isArray(data.categories)) {
        skipped++;
        continue;
      }

      const category = data.category as string | null | undefined;
      const categories = category ? [category] : [];

      const originalCategory = data.originalCategory as string | null | undefined;
      const originalCategories = originalCategory ? [originalCategory] : null;

      if (!DRY_RUN) {
        writeBatch.update(doc.ref, {
          categories,
          originalCategories,
          category: FieldValue.delete(),
          originalCategory: FieldValue.delete(),
        });
        batchCount++;
      }
      migrated++;
    }

    if (!DRY_RUN && batchCount > 0) {
      try {
        await writeBatch.commit();
      } catch (e) {
        failed += batchCount;
        migrated -= batchCount;
        console.error(`  Batch commit failed: ${String(e)}`);
      }
    }
  }

  console.log(
    `  [${name}] total=${snapshot.size}, migrated=${migrated}, skipped=${skipped}, failed=${failed}`,
  );
  return { collection: name, total: snapshot.size, migrated, skipped, failed };
}

async function migrateLineMessages(): Promise<MigrationResult> {
  const name = "line_messages";
  console.log(`\n[Migrate] Processing ${name}...`);

  const snapshot = await collections.lineMessages.get();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const writeBatch = collections.lineMessages.firestore.batch();
    let batchCount = 0;

    for (const doc of batch) {
      const data = doc.data() as unknown as Record<string, unknown>;

      if (Array.isArray(data.categories)) {
        skipped++;
        continue;
      }

      const category = data.category as string | null | undefined;
      const categories = category ? [category] : [];

      if (!DRY_RUN) {
        writeBatch.update(doc.ref, {
          categories,
          category: FieldValue.delete(),
        });
        batchCount++;
      }
      migrated++;
    }

    if (!DRY_RUN && batchCount > 0) {
      try {
        await writeBatch.commit();
      } catch (e) {
        failed += batchCount;
        migrated -= batchCount;
        console.error(`  Batch commit failed: ${String(e)}`);
      }
    }
  }

  console.log(
    `  [${name}] total=${snapshot.size}, migrated=${migrated}, skipped=${skipped}, failed=${failed}`,
  );
  return { collection: name, total: snapshot.size, migrated, skipped, failed };
}

async function migrateManualTasks(): Promise<MigrationResult> {
  const name = "manual_tasks";
  console.log(`\n[Migrate] Processing ${name}...`);

  const snapshot = await collections.manualTasks.get();
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    const writeBatch = collections.manualTasks.firestore.batch();
    let batchCount = 0;

    for (const doc of batch) {
      const data = doc.data() as unknown as Record<string, unknown>;

      if (Array.isArray(data.categories)) {
        skipped++;
        continue;
      }

      const category = data.category as string | null | undefined;
      const categories = category ? [category] : [];

      if (!DRY_RUN) {
        writeBatch.update(doc.ref, {
          categories,
          category: FieldValue.delete(),
        });
        batchCount++;
      }
      migrated++;
    }

    if (!DRY_RUN && batchCount > 0) {
      try {
        await writeBatch.commit();
      } catch (e) {
        failed += batchCount;
        migrated -= batchCount;
        console.error(`  Batch commit failed: ${String(e)}`);
      }
    }
  }

  console.log(
    `  [${name}] total=${snapshot.size}, migrated=${migrated}, skipped=${skipped}, failed=${failed}`,
  );
  return { collection: name, total: snapshot.size, migrated, skipped, failed };
}

async function main() {
  console.log(`[Migrate] category → categories migration${DRY_RUN ? " (DRY RUN)" : ""}`);

  const results = await Promise.all([
    migrateIntentRecords(),
    migrateLineMessages(),
    migrateManualTasks(),
  ]);

  console.log("\n[Migrate] Summary:");
  for (const r of results) {
    console.log(
      `  ${r.collection}: ${r.migrated} migrated, ${r.skipped} skipped, ${r.failed} failed (total: ${r.total})`,
    );
  }

  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[Migrate] Fatal error:", e);
  process.exit(1);
});
