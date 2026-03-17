/**
 * LINE メッセージ カテゴリ バックフィルスクリプト
 *
 * category フィールドが未設定の既存テキストメッセージに
 * classifyIntent() で自動カテゴリ分類を実行する。
 *
 * 実行:
 *   pnpm --filter @hr-system/worker tsx src/scripts/backfill-line-category.ts
 *
 * --dry-run フラグで更新せずに対象件数のみ確認可能:
 *   pnpm --filter @hr-system/worker tsx src/scripts/backfill-line-category.ts --dry-run
 */
import { classifyIntent } from "@hr-system/ai";
import "@hr-system/db/client"; // Firebase 初期化
import { collections, loadClassificationConfig } from "@hr-system/db";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(
    `[Backfill] Fetching LINE messages without category...${DRY_RUN ? " (DRY RUN)" : ""}`,
  );

  // 分類設定をロード
  const loaded = await loadClassificationConfig();
  const config = {
    regexRules: loaded.regexRules,
    systemPrompt: loaded.systemPrompt,
    fewShotExamples: loaded.fewShotExamples,
  };

  const snapshot = await collections.lineMessages.get();
  const targets = snapshot.docs.filter((doc) => {
    const d = doc.data();
    return (
      (!d.categories || d.categories.length === 0) &&
      d.lineMessageType === "text" &&
      d.content &&
      d.content.length > 0
    );
  });

  console.log(`[Backfill] Found ${targets.length} / ${snapshot.size} messages to classify`);

  if (DRY_RUN || targets.length === 0) {
    if (DRY_RUN) {
      for (const doc of targets.slice(0, 5)) {
        const d = doc.data();
        console.log(`  - ${doc.id}: "${d.content.slice(0, 50)}..."`);
      }
      if (targets.length > 5) console.log(`  ... and ${targets.length - 5} more`);
    }
    process.exit(0);
  }

  let classified = 0;
  let failed = 0;

  for (const doc of targets) {
    const d = doc.data();
    try {
      const result = await classifyIntent(d.content, undefined, config);
      await doc.ref.update({ categories: result.categories });
      classified++;
      console.log(
        `  [${classified + failed}/${targets.length}] ${doc.id} → ${result.categories.join(",")} (${result.classificationMethod}, ${result.confidence.toFixed(2)})`,
      );
    } catch (e) {
      failed++;
      console.warn(`  [${classified + failed}/${targets.length}] ${doc.id} FAILED: ${String(e)}`);
    }
  }

  console.log("\n[Backfill] Complete!");
  console.log(`  Classified: ${classified}`);
  console.log(`  Failed: ${failed}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("[Backfill] Fatal error:", e);
  process.exit(1);
});
