import { collections } from "@hr-system/db";

/**
 * googleMessageId を使った重複排除。
 * 同じメッセージが複数回 Pub/Sub から届いた場合に ACK して処理をスキップする。
 * @returns true = 重複（処理済み）、false = 新規メッセージ
 */
export async function isDuplicate(googleMessageId: string): Promise<boolean> {
  const snap = await collections.chatMessages
    .where("googleMessageId", "==", googleMessageId)
    .limit(1)
    .get();
  return !snap.empty;
}
