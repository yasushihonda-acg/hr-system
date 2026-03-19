/**
 * 既存の line_messages から groupId を抽出し、line_groups コレクションに登録する。
 * 既に登録済みのグループはスキップする。
 *
 * Usage: npx tsx packages/db/src/seed/backfill-line-groups.ts [--dry-run]
 */
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../client.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`=== LINE グループ バックフィル${dryRun ? " (dry-run)" : ""} ===`);

  // 1. line_messages から groupId + groupName を収集
  const snap = await db.collection("line_messages").select("groupId", "groupName").get();

  const groups = new Map<string, string>();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.groupId && !groups.has(d.groupId)) {
      groups.set(d.groupId, d.groupName ?? d.groupId);
    }
  }

  console.log(`line_messages から ${groups.size} 件のユニークグループを検出`);
  for (const [id, name] of groups) {
    console.log(`  ${id} → ${name}`);
  }

  // 2. 既存の line_groups を確認
  const existingSnap = await db.collection("line_groups").get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`\n既存 line_groups: ${existingIds.size} 件`);

  // 3. 未登録のグループを登録
  const now = Timestamp.now();
  let created = 0;
  let skipped = 0;

  for (const [groupId, displayName] of groups) {
    if (existingIds.has(groupId)) {
      console.log(`  SKIP (既存): ${groupId}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  DRY-RUN: would create ${groupId} → ${displayName}`);
      created++;
      continue;
    }

    await db.collection("line_groups").doc(groupId).create({
      groupId,
      displayName,
      isActive: true,
      addedBy: "backfill",
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`  CREATED: ${groupId} → ${displayName}`);
    created++;
  }

  console.log(`\n完了: ${created} 件作成, ${skipped} 件スキップ`);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
