/**
 * チャットメッセージ差分同期サービス
 *
 * Google Chat REST API から最新メッセージを取得し、
 * Firestore に未保存のメッセージのみ追加する。
 */

import type { ChatAnnotation, ChatAttachment, SyncMetadata } from "@hr-system/db";
import { collections } from "@hr-system/db";
import { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

const SPACE_ID = process.env.CHAT_SPACE_ID ?? "AAAA-qf5jX0";
const SPACE_NAME = `spaces/${SPACE_ID}`;
const CHAT_API_BASE = "https://chat.googleapis.com/v1";
const PEOPLE_API_BASE = "https://people.googleapis.com/v1";
const REQUEST_DELAY_MS = 100;

export interface SyncResult {
  newMessages: number;
  duplicateSkipped: number;
  durationMs: number;
}

/** "spaces/AAAA-qf5jX0/messages/xxx.yyy" → "spaces_AAAA-qf5jX0_messages_xxx_yyy" */
function sanitizeDocId(googleMessageId: string): string {
  return googleMessageId.replace(/\//g, "_").replace(/\./g, "_");
}

/** ADC（開発者 OAuth クレデンシャル）で Chat API 用の認証ヘッダーを取得
 *
 * getAccessToken() ではなく getRequestHeaders() を使用することで
 * authorized_user 認証時に必要な x-goog-user-project ヘッダーが自動付与される
 */
export async function getAuthHeaders(): Promise<{ [key: string]: string }> {
  const auth = new GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/chat.messages.readonly",
      "https://www.googleapis.com/auth/directory.readonly",
    ],
  });
  const client = await auth.getClient();
  return (await client.getRequestHeaders()) as unknown as { [key: string]: string };
}

/** People API で Workspace ユーザーの displayName を取得
 *  Chat API は sender.displayName / userMention.user.displayName を返さないため使用
 */
async function fetchDisplayName(
  authHeaders: { [key: string]: string },
  userId: string, // "users/116189466267679439841"
): Promise<string> {
  const numericId = userId.replace(/^users\//, "");
  try {
    const res = await fetch(`${PEOPLE_API_BASE}/people/${numericId}?personFields=names`, {
      headers: authHeaders,
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { names?: Array<{ displayName?: string }> };
    return data.names?.[0]?.displayName ?? "";
  } catch {
    return "";
  }
}

/** sync_metadata ドキュメントを取得 */
export async function getSyncMetadata(): Promise<SyncMetadata | null> {
  const doc = await collections.syncMetadata.doc("chat_messages").get();
  return doc.exists ? (doc.data() as SyncMetadata) : null;
}

/** sync_metadata ドキュメントを更新（merge） */
export async function updateSyncMetadata(data: Partial<SyncMetadata>): Promise<void> {
  await collections.syncMetadata
    .doc("chat_messages")
    .set({ ...data, updatedAt: Timestamp.now() } as SyncMetadata, { merge: true });
}

/** Chat API からメッセージを差分取得して Firestore に保存 */
export async function syncChatMessages(): Promise<SyncResult> {
  const startTime = Date.now();

  // 最終同期日時を取得（なければ24時間前）
  const meta = await getSyncMetadata();
  const since = meta?.lastSyncedAt
    ? meta.lastSyncedAt.toDate()
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const authHeaders = await getAuthHeaders();
  const filter = `createTime > "${since.toISOString()}"`;

  let newMessages = 0;
  let duplicateSkipped = 0;
  let pageToken: string | undefined;

  do {
    const url = new URL(`${CHAT_API_BASE}/${SPACE_NAME}/messages`);
    url.searchParams.set("filter", filter);
    url.searchParams.set("pageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const resp = await fetch(url.toString(), {
      headers: authHeaders,
    });

    if (!resp.ok) {
      throw new Error(`Chat API エラー: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      messages?: Array<Record<string, unknown>>;
      nextPageToken?: string;
    };

    const messages = data.messages ?? [];

    for (const msg of messages) {
      // Bot メッセージをスキップ
      const sender = msg.sender as Record<string, unknown> | undefined;
      if (sender?.type === "BOT") {
        continue;
      }

      const googleMessageId = msg.name as string;
      const docId = sanitizeDocId(googleMessageId);

      // 重複チェック
      const existing = await collections.chatMessages.doc(docId).get();
      if (existing.exists) {
        duplicateSkipped++;
        continue;
      }

      // メッセージ内容を取得（formattedText はフォールバックしない — HTML が content に混入するのを防ぐ）
      const content = (msg.text as string) || "";
      const formattedText = (msg.formattedText as string) || null;

      // スレッド情報
      const thread = msg.thread as Record<string, unknown> | undefined;
      const isThreadReply =
        (thread as Record<string, unknown> & { threadReply?: boolean })?.threadReply === true ||
        (msg.threadReply as boolean) === true;
      const threadName = (thread?.name as string) || null;

      // 引用元メッセージ（スレッド返信の親）
      const quotedMessageMetadata = msg.quotedMessageMetadata as
        | Record<string, unknown>
        | undefined;
      const parentMessageId = (quotedMessageMetadata?.name as string) ?? null;

      // 添付ファイル
      const rawAttachments = (msg.attachment as Array<Record<string, unknown>>) ?? [];
      const attachments: ChatAttachment[] = rawAttachments.map((att) => {
        const result: ChatAttachment = { name: (att.name as string) ?? "" };
        if (att.contentName !== undefined) result.contentName = att.contentName as string;
        if (att.contentType !== undefined) result.contentType = att.contentType as string;
        if (att.downloadUri !== undefined) result.downloadUri = att.downloadUri as string;
        if (att.source === "DRIVE_FILE" || att.source === "UPLOADED_CONTENT")
          result.source = att.source;
        return result;
      });

      // メンション情報
      const annotations: ChatAnnotation[] = (
        (msg.annotations as Array<Record<string, unknown>>) ?? []
      ).map((a) => ({
        type: (["USER_MENTION", "SLASH_COMMAND", "RICH_LINK"].includes(a.type as string)
          ? a.type
          : "UNKNOWN") as ChatAnnotation["type"],
        ...(a.startIndex !== undefined && { startIndex: a.startIndex as number }),
        ...(a.length !== undefined && { length: a.length as number }),
        ...(a.userMention !== undefined && {
          userMention: a.userMention as ChatAnnotation["userMention"],
        }),
      }));
      // メンション: Chat API は displayName を返さないため People API で補完
      const mentionedUsers: { userId: string; displayName: string }[] = [];
      for (const a of annotations.filter((a) => a.type === "USER_MENTION" && a.userMention?.user)) {
        const userId = a.userMention?.user.name ?? "";
        let displayName = a.userMention?.user.displayName ?? "";
        if (!displayName && userId) {
          await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
          displayName = await fetchDisplayName(authHeaders, userId);
        }
        mentionedUsers.push({ userId, displayName });
      }

      // 送信者: Chat API は sender.displayName を返さないため People API で補完
      const senderUserId = (sender?.name as string) || "";
      let senderName = (sender?.displayName as string) || "";
      if (!senderName && senderUserId) {
        await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
        senderName = await fetchDisplayName(authHeaders, senderUserId);
      }
      if (!senderName) senderName = "不明";

      // 作成日時
      const createTimeStr = msg.createTime as string | undefined;
      const createdAt = createTimeStr
        ? Timestamp.fromDate(new Date(createTimeStr))
        : Timestamp.now();

      // Firestore に保存
      await collections.chatMessages.doc(docId).set({
        spaceId: SPACE_ID,
        googleMessageId,
        senderUserId,
        senderEmail: "",
        senderName,
        senderType: "HUMAN",
        content,
        formattedContent: formattedText,
        messageType: isThreadReply ? "THREAD_REPLY" : "MESSAGE",
        threadName,
        parentMessageId,
        mentionedUsers,
        annotations,
        attachments,
        isEdited: false,
        isDeleted: false,
        rawPayload: msg,
        processedAt: null,
        createdAt,
      });

      newMessages++;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  const durationMs = Date.now() - startTime;

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "external_sync",
    entityType: "chat_messages",
    entityId: "sync",
    actorEmail: "system",
    actorRole: null,
    details: { newMessages, duplicateSkipped, durationMs },
    createdAt: Timestamp.now(),
  });

  return { newMessages, duplicateSkipped, durationMs };
}
