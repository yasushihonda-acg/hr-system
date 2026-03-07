import { collections } from "@hr-system/db";
import { Timestamp } from "firebase-admin/firestore";
import { getGroupMemberProfile, getGroupSummary, getMessageContent } from "../lib/line-api.js";
import { uploadLineMedia } from "../lib/storage.js";

interface LineWebhookEvent {
  type: string;
  timestamp: number;
  replyToken?: string;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
  };
}

/**
 * LINE Webhook イベントを処理し、Firestore に保存する。
 * Google Chat の processMessage と同じ役割。
 */
export async function processLineEvent(event: LineWebhookEvent): Promise<void> {
  // テキストメッセージ以外もメタデータは記録する
  if (event.type !== "message" || !event.message) return;

  const { source, message } = event;

  // グループ以外（1:1トーク等）は対象外
  if (source.type !== "group" || !source.groupId) {
    console.log(`[LineWorker] Skipping non-group message: source.type=${source.type}`);
    return;
  }

  const groupId = source.groupId;
  const userId = source.userId ?? "unknown";
  const lineMessageId = message.id;

  // 重複排除
  const existing = await collections.lineMessages
    .where("lineMessageId", "==", lineMessageId)
    .limit(1)
    .get();
  if (!existing.empty) {
    console.log(`[LineWorker] Duplicate message skipped: ${lineMessageId}`);
    return;
  }

  // 表示名・グループ名を best-effort で取得
  const [senderName, groupName] = await Promise.all([
    userId !== "unknown" ? getGroupMemberProfile(groupId, userId) : null,
    getGroupSummary(groupId),
  ]);

  // メディアメッセージ（image, video, audio, file）の場合、コンテンツをダウンロードしてGCSに保存
  const MEDIA_TYPES = new Set(["image", "video", "audio", "file"]);
  let contentUrl: string | null = null;
  if (MEDIA_TYPES.has(message.type)) {
    const binary = await getMessageContent(lineMessageId);
    if (binary) {
      try {
        contentUrl = await uploadLineMedia(lineMessageId, message.type, binary);
        console.log(`[LineWorker] Uploaded media: ${contentUrl}`);
      } catch (e) {
        console.warn(`[LineWorker] Media upload failed: ${String(e)}`);
      }
    }
  }

  await collections.lineMessages.add({
    groupId,
    groupName: groupName ?? null,
    lineMessageId,
    senderUserId: userId,
    senderName: senderName ?? "unknown",
    content: message.text ?? "",
    contentUrl,
    lineMessageType: message.type,
    rawPayload: event as unknown as Record<string, unknown>,
    taskPriority: null,
    responseStatus: "unresponded",
    responseStatusUpdatedBy: null,
    responseStatusUpdatedAt: null,
    createdAt: Timestamp.fromMillis(event.timestamp),
  });

  console.log(`[LineWorker] Saved message: ${lineMessageId} (group: ${groupId})`);
}
