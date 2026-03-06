/**
 * LINE メディアメッセージのバックフィルスクリプト
 *
 * contentUrl が未設定の画像/動画/音声/ファイルメッセージに対して
 * LINE Content API からバイナリを再取得し、Cloud Storage に保存する。
 *
 * 実行:
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx pnpm --filter @hr-system/worker tsx src/scripts/backfill-line-media.ts
 *
 * NOTE: LINE Content API のコンテンツ保持期間は送信後約30日。
 *       それを過ぎたメッセージは取得不可（スキップされる）。
 */
import "@hr-system/db/client"; // Firebase 初期化
import { collections } from "@hr-system/db";
import { getMessageContent } from "../lib/line-api.js";
import { uploadLineMedia } from "../lib/storage.js";

const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);

async function main() {
  console.log("[Backfill] Fetching LINE messages without contentUrl...");

  const snapshot = await collections.lineMessages.get();
  const targets = snapshot.docs.filter((doc) => {
    const d = doc.data();
    return MEDIA_TYPES.has(d.lineMessageType) && !d.contentUrl;
  });

  console.log(`[Backfill] Found ${targets.length} media messages to backfill`);

  let success = 0;
  let failed = 0;
  let expired = 0;

  for (const doc of targets) {
    const msg = doc.data();
    const messageId = msg.lineMessageId;
    const type = msg.lineMessageType;

    process.stdout.write(`  ${messageId} (${type})... `);

    const binary = await getMessageContent(messageId);
    if (!binary) {
      console.log("SKIP (content expired or unavailable)");
      expired++;
      continue;
    }

    try {
      const url = await uploadLineMedia(messageId, type, binary);
      await doc.ref.update({ contentUrl: url });
      console.log(`OK → ${url}`);
      success++;
    } catch (e) {
      console.log(`FAIL: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
      failed++;
    }
  }

  console.log("\n[Backfill] Complete!");
  console.log(`  Success: ${success}`);
  console.log(`  Expired: ${expired}`);
  console.log(`  Failed:  ${failed}`);

  process.exit(0);
}

main().catch((e) => {
  console.error("[Backfill] Fatal error:", e);
  process.exit(1);
});
