/**
 * チャットメッセージ差分同期サービス
 *
 * Google Chat REST API から最新メッセージを取得し、
 * Firestore に未保存のメッセージのみ追加する。
 */

import type { ChatAnnotation, ChatAttachment, SyncMetadata } from "@hr-system/db";
import { collections } from "@hr-system/db";
import { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth, Impersonated } from "google-auth-library";

const SPACE_ID = process.env.CHAT_SPACE_ID ?? "AAAA-qf5jX0";
const SPACE_NAME = `spaces/${SPACE_ID}`;
const CHAT_API_BASE = "https://chat.googleapis.com/v1";
// Chat API は chat.bot スコープが必要なため、hr-worker SA（Chatボット）を impersonate する
const CHAT_WORKER_SA =
  process.env.CHAT_SERVICE_ACCOUNT ?? "hr-worker@hr-system-487809.iam.gserviceaccount.com";

export interface SyncResult {
  newMessages: number;
  duplicateSkipped: number;
  durationMs: number;
}

/** "spaces/AAAA-qf5jX0/messages/xxx.yyy" → "spaces_AAAA-qf5jX0_messages_xxx_yyy" */
function sanitizeDocId(googleMessageId: string): string {
  return googleMessageId.replace(/\//g, "_").replace(/\./g, "_");
}

/** hr-worker SA を impersonate して Chat API 用のアクセストークンを取得 */
export async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth();
  const sourceClient = await auth.getClient();
  const impersonated = new Impersonated({
    sourceClient,
    targetPrincipal: CHAT_WORKER_SA,
    lifetime: 3600,
    delegates: [],
    targetScopes: ["https://www.googleapis.com/auth/chat.bot"],
  });
  const tokenResponse = await impersonated.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error("アクセストークンの取得に失敗しました");
  }
  return token;
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

  const token = await getAccessToken();
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
      headers: { Authorization: `Bearer ${token}` },
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
      const mentionedUsers = annotations
        .filter((a) => a.type === "USER_MENTION" && a.userMention?.user)
        .map((a) => ({
          userId: a.userMention?.user.name ?? "",
          displayName: a.userMention?.user.displayName ?? "",
        }));

      // 送信者情報
      const senderName = (sender?.displayName as string) || "不明";
      const senderUserId = (sender?.name as string) || "";

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
