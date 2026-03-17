/**
 * LINE画像メッセージの修復スクリプト
 *
 * contentUrl が null のメディアメッセージを LINE API から再取得し、
 * GCS にアップロードして Firestore を更新する。
 *
 * 前提:
 *   - gcloud ADC が設定済み（Firestore / GCS アクセス用）
 *   - LINE_CHANNEL_ACCESS_TOKEN 環境変数が設定済み
 *
 * 使い方:
 *   LINE_CHANNEL_ACCESS_TOKEN=$(gcloud secrets versions access latest \
 *     --secret=LINE_CHANNEL_ACCESS_TOKEN --project=hr-system-487809) \
 *     pnpm tsx scripts/repair-line-images.ts [--dry-run]
 */
import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collections } from "@hr-system/db";

const BUCKET_NAME = process.env.LINE_MEDIA_BUCKET ?? "hr-system-487809-line-media";
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const dryRun = process.argv.includes("--dry-run");

const EXT_MAP: Record<string, string> = { image: "jpg", video: "mp4", audio: "m4a" };

async function main() {
  if (!token) {
    console.error("ERROR: LINE_CHANNEL_ACCESS_TOKEN is required");
    process.exit(1);
  }

  const mediaTypes = ["image", "video", "audio", "file"];
  const snap = await collections.lineMessages.where("lineMessageType", "in", mediaTypes).get();

  const needsRepair = snap.docs.filter((d) => !d.data().contentUrl);
  console.log(`Total media messages: ${snap.size}`);
  console.log(`Needs repair (contentUrl is null): ${needsRepair.length}`);

  if (needsRepair.length === 0) {
    console.log("Nothing to repair.");
    return;
  }

  for (const doc of needsRepair) {
    const data = doc.data();
    const { lineMessageId, lineMessageType } = data;
    console.log(`\n  ${doc.id}: ${lineMessageType} (lineMessageId=${lineMessageId})`);

    if (dryRun) continue;

    try {
      const res = await fetch(`https://api-data.line.me/v2/bot/message/${lineMessageId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`    LINE API error: ${res.status} ${res.statusText}`);
        continue;
      }
      const binary = Buffer.from(await res.arrayBuffer());
      console.log(`    Downloaded ${binary.length} bytes`);

      const ext = EXT_MAP[lineMessageType] ?? "bin";
      const tmpPath = join(tmpdir(), `${lineMessageId}.${ext}`);
      writeFileSync(tmpPath, binary);

      const gcsPath = `gs://${BUCKET_NAME}/line/${lineMessageType}/${lineMessageId}.${ext}`;
      execSync(
        `gcloud storage cp "${tmpPath}" "${gcsPath}" --content-type=${lineMessageType === "image" ? "image/jpeg" : "application/octet-stream"} --project=hr-system-487809`,
        { stdio: "pipe" },
      );
      unlinkSync(tmpPath);

      const contentUrl = `https://storage.googleapis.com/${BUCKET_NAME}/line/${lineMessageType}/${lineMessageId}.${ext}`;
      await doc.ref.update({ contentUrl });
      console.log(`    Repaired: ${contentUrl}`);
    } catch (e) {
      console.error(`    Failed: ${String(e)}`);
    }
  }

  console.log(`\nDone.${dryRun ? " (dry-run, no changes made)" : ""}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
