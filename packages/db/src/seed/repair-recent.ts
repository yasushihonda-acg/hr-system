/**
 * 最新100件の空senderNameを優先修復するスクリプト
 *
 * 制約: スペース AAAA-qf5jX0 は外部ユーザー・ボット招待不可。
 *       chat.bot スコープ（SA）では "Not a member" エラーになるため使用不可。
 *       Chat API は displayName を返さないため、People API で取得する。
 *
 * 事前準備（ADC に directory.readonly を追加）:
 *   gcloud auth application-default login \
 *     --scopes="https://www.googleapis.com/auth/cloud-platform,\
 * https://www.googleapis.com/auth/chat.messages.readonly,\
 * https://www.googleapis.com/auth/chat.memberships.readonly,\
 * https://www.googleapis.com/auth/directory.readonly"
 *
 * Usage:
 *   pnpm --filter @hr-system/db exec tsx src/seed/repair-recent.ts
 */
import { collections } from "@hr-system/db";
import type { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

const SPACE_NAME = "spaces/AAAA-qf5jX0";
const REQUEST_DELAY_MS = 200;

type RequestClient = Awaited<ReturnType<GoogleAuth["getClient"]>>;

async function fetchMessageApi(client: RequestClient, messageName: string) {
  const url = `https://chat.googleapis.com/v1/${messageName}`;
  try {
    const res = await client.request<Record<string, unknown>>({ url });
    return res.data;
  } catch (e) {
    console.error(`  [fetchMessage] ERROR ${url}: ${String(e)}`);
    return null;
  }
}

/** People API で displayName を取得（chat.members.get は displayName を返さないため） */
async function fetchDisplayNameFromPeopleApi(
  client: RequestClient,
  senderUserId: string, // "users/116189466267679439841"
): Promise<string> {
  const numericId = senderUserId.replace(/^users\//, "");
  const url = `https://people.googleapis.com/v1/people/${numericId}?personFields=names`;
  try {
    const res = await client.request<{ names?: Array<{ displayName?: string }> }>({ url });
    return res.data.names?.[0]?.displayName ?? "";
  } catch (e) {
    console.error(`  [fetchPeople] ERROR ${url}: ${String(e)}`);
    return "";
  }
}

async function main() {
  console.log("=== 最新100件 優先修復 ===");
  console.log("  認証: ADC (chat.messages.readonly + directory.readonly)");

  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/chat.messages.readonly",
      "https://www.googleapis.com/auth/chat.memberships.readonly",
      "https://www.googleapis.com/auth/directory.readonly",
    ],
  });
  const client = await auth.getClient();

  // 全件取得してメモリでソート（compositeインデックスなしのため）
  const snap = await collections.chatMessages.where("senderName", "==", "").get();
  type DocData = {
    createdAt?: Timestamp;
    senderUserId?: string;
    googleMessageId?: string;
    spaceId?: string;
  };

  const sorted = snap.docs
    .map((d) => ({ ref: d.ref, id: d.id, ...(d.data() as DocData) }))
    .filter((d) => d.createdAt)
    .sort((a, b) => b.createdAt!.toMillis() - a.createdAt!.toMillis())
    .slice(0, 100);

  console.log(`対象: 最新 ${sorted.length} 件`);
  if (sorted.length > 0) {
    console.log(`  最新: ${sorted[0]?.createdAt?.toDate().toISOString().slice(0, 10)}`);
    console.log(
      `  最古: ${sorted[sorted.length - 1]?.createdAt?.toDate().toISOString().slice(0, 10)}`,
    );
  }

  let fixed = 0;
  let skipped = 0;

  for (let i = 0; i < sorted.length; i++) {
    const doc = sorted[i]!;
    const spaceName = doc.spaceId ? `spaces/${doc.spaceId}` : SPACE_NAME;
    const msgName =
      doc.googleMessageId ??
      `${spaceName}/messages/${doc.id.replace(/spaces_[^_]+_messages_/, "")}`;

    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    const apiMsg = (await fetchMessageApi(client, msgName)) as {
      sender?: { name?: string; displayName?: string };
    } | null;

    if (!apiMsg) {
      skipped++;
      continue;
    }

    // Chat API は displayName を返さないため、People API でフォールバック
    let senderName = (apiMsg.sender?.displayName as string) || "";
    if (!senderName && apiMsg.sender?.name) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
      senderName = await fetchDisplayNameFromPeopleApi(client, apiMsg.sender.name);
    }

    if (senderName) {
      await doc.ref.update({ senderName, senderUserId: apiMsg.sender?.name ?? doc.senderUserId });
      fixed++;
      if (fixed % 10 === 0 || i === sorted.length - 1) {
        console.log(`  進捗: ${i + 1}/${sorted.length} (修復済み: ${fixed}件)`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n完了: 修復 ${fixed}件 / スキップ ${skipped}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
