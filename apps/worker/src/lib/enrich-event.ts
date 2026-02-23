import type { ChatAnnotation, ChatAttachment } from "@hr-system/db";
import type { ChatApiClient } from "./chat-api.js";
import type { ChatEvent } from "./event-parser.js";
import { normalizeAnnotation, type RawAnnotation } from "./event-parser.js";

/**
 * Chat REST API を使って Pub/Sub ペイロードに欠けているフィールドを補完する。
 *
 * Pub/Sub メッセージには formattedText / annotations / attachments が含まれないため、
 * Chat API spaces.messages.get で補完する。
 *
 * best-effort: API 失敗時は元の event をそのまま返す（NACK しない）。
 */
export async function enrichChatEvent(event: ChatEvent, client: ChatApiClient): Promise<ChatEvent> {
  try {
    const message = await client.getMessage(event.googleMessageId);
    if (!message) {
      return event;
    }

    // formattedText: API の値を優先、なければ元の値を維持
    const formattedText = message.formattedText ?? event.formattedText;

    // annotations: API の値があれば再正規化
    const annotations: ChatAnnotation[] = message.annotations
      ? message.annotations.map((a) => normalizeAnnotation(a as RawAnnotation))
      : event.annotations;

    // mentionedUsers: 補完後の annotations から再抽出
    // displayName が空の場合は spaces.members.get で補完する
    const rawMentionedUsers = annotations
      .filter((a) => a.type === "USER_MENTION" && a.userMention?.user)
      .map((a) => ({
        userId: a.userMention?.user.name ?? "",
        displayName: a.userMention?.user.displayName ?? "",
      }));
    const mentionedUsers = await Promise.all(
      rawMentionedUsers.map(async (u) => {
        if (u.displayName !== "" || !u.userId) return u;
        const memberName = `${event.spaceName}/members/${u.userId}`;
        const membership = await client.getMember(memberName);
        return { ...u, displayName: membership?.member?.displayName ?? "" };
      }),
    );

    // attachments: API の値があれば再正規化
    const attachments: ChatAttachment[] = message.attachment
      ? message.attachment.map((att) => ({
          name: att.name ?? "",
          contentName: att.contentName ?? undefined,
          contentType: att.contentType ?? undefined,
          downloadUri: att.downloadUri ?? undefined,
          source:
            att.source === "DRIVE_FILE" || att.source === "UPLOADED_CONTENT"
              ? att.source
              : undefined,
        }))
      : event.attachments;

    // isEdited / isDeleted: API の値で更新
    const isEdited =
      message.lastUpdateTime !== undefined
        ? !!(message.lastUpdateTime && message.lastUpdateTime !== message.createTime)
        : event.isEdited;
    const isDeleted = message.deleteTime !== undefined ? !!message.deleteTime : event.isDeleted;

    // senderName: Chat API は sender.displayName を返さないため getMember で補完し、
    // それも取得できなければ元の event 値を維持する
    let senderName = message.sender?.displayName || "";
    if (!senderName && message.sender?.name) {
      const senderMembership = await client.getMember(
        `${event.spaceName}/members/${message.sender.name}`,
      );
      senderName = senderMembership?.member?.displayName || "";
    }
    if (!senderName) senderName = event.senderName;

    return {
      ...event,
      formattedText,
      annotations,
      mentionedUsers,
      attachments,
      isEdited,
      isDeleted,
      senderName,
    };
  } catch (e) {
    console.warn(`[Worker] Chat API enrichment failed for ${event.googleMessageId}: ${String(e)}`);
    return event;
  }
}
