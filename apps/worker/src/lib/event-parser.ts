import type { ChatAnnotation, ChatAttachment } from "@hr-system/db";
import { WorkerError } from "./errors.js";

/**
 * Pub/Sub push サブスクリプションが送るリクエストボディ。
 * https://cloud.google.com/pubsub/docs/push
 */
export interface PubSubPushBody {
  message: {
    data: string; // base64 エンコード済みペイロード
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

/**
 * Pub/Sub トピックへ送られる Chat イベントペイロード。
 * 2つのソースに対応:
 *
 * 1. Workspace Events API サブスクリプション
 *    - `ce-type` 属性あり (`google.workspace.chat.message.v1.created` 等)
 *    - ペイロード: `{ "message": {...} }` のみ（`type` フィールドなし）
 *
 * 2. Google Chat App (Pub/Sub 接続タイプ)
 *    - `ce-type` 属性なし
 *    - ペイロード: `{ "type": "MESSAGE"|"ADDED_TO_SPACE"|..., "message": {...}, "space": {...}, "user": {...} }`
 *    - MESSAGE 以外のイベント（ADDED_TO_SPACE, REMOVED_FROM_SPACE, CARD_CLICKED）は null を返す
 *
 * https://developers.google.com/workspace/events/reference/rest/v1/spaces.messages
 * https://developers.google.com/chat/api/reference/rest/v1/Event
 */
interface ChatMessagePayload {
  /** Chat App イベントタイプ。Workspace Events API には存在しない。 */
  type?: string;
  message?: {
    name: string; // "spaces/{space_id}/messages/{message_id}"
    sender?: {
      name: string; // "users/{user_id}"
      type?: string; // "HUMAN" | "BOT"
      displayName?: string;
    };
    text?: string;
    formattedText?: string;
    createTime?: string;
    lastUpdateTime?: string;
    deleteTime?: string;
    space?: { name: string };
    thread?: {
      name: string; // "spaces/{space_id}/threads/{thread_id}"
      threadReply?: boolean;
    };
    /** スレッド返信の場合に設定される */
    quotedMessageMetadata?: {
      name?: string; // 引用元メッセージリソース名
    };
    annotations?: RawAnnotation[];
    attachment?: Array<{
      name?: string;
      contentName?: string;
      contentType?: string;
      downloadUri?: string;
      source?: string;
    }>;
    /** スレッド返信かどうかを示す（thread.threadReply と同義） */
    threadReply?: boolean;
  };
}

/**
 * パーサーが返す正規化済みイベント型。
 * Bot 投稿や無関係なイベントは null を返す。
 */
export interface ChatEvent {
  spaceName: string;
  googleMessageId: string;
  senderUserId: string; // "users/{user_id}"
  senderName: string;
  senderType: "HUMAN" | "BOT";
  text: string;
  formattedText: string | null;
  messageType: "MESSAGE" | "THREAD_REPLY";
  threadName: string | null;
  parentMessageId: string | null;
  mentionedUsers: Array<{ userId: string; displayName: string }>;
  annotations: ChatAnnotation[];
  attachments: ChatAttachment[];
  isEdited: boolean;
  isDeleted: boolean;
  rawPayload: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Pub/Sub push ボディを受け取り、ChatEvent を返す。
 * - message.created / message.updated 以外のイベントタイプ → null（ACK）
 * - Bot 投稿 → null（ACK）
 * - パース失敗 → WorkerError(PARSE_ERROR, shouldNack=false) をスロー
 */
export function parsePubSubEvent(body: unknown): ChatEvent | null {
  // 型ガード
  if (!isPubSubPushBody(body)) {
    throw new WorkerError("PARSE_ERROR", "Invalid Pub/Sub push body structure");
  }

  const { message } = body;

  // イベントタイプ確認（ce-type 属性）
  const ceType = message.attributes?.["ce-type"] ?? "";
  const supportedTypes = [
    "google.workspace.chat.message.v1.created",
    "google.workspace.chat.message.v1.updated",
  ];
  if (ceType && !supportedTypes.includes(ceType)) {
    return null; // 未対応イベントタイプは無視（ACK）
  }

  // base64 デコード
  let decoded: string;
  try {
    decoded = Buffer.from(message.data, "base64").toString("utf-8");
  } catch {
    throw new WorkerError("PARSE_ERROR", "Failed to base64-decode Pub/Sub message data");
  }

  // JSON パース
  let payload: ChatMessagePayload;
  try {
    payload = JSON.parse(decoded) as ChatMessagePayload;
  } catch {
    throw new WorkerError("PARSE_ERROR", "Failed to parse Chat event JSON");
  }

  // Chat App イベントタイプ確認（Workspace Events API には `type` フィールドがない）
  // MESSAGE 以外（ADDED_TO_SPACE, REMOVED_FROM_SPACE, CARD_CLICKED）は無視（ACK）
  if (payload.type && payload.type !== "MESSAGE") {
    return null;
  }

  const chatMessage = payload.message;
  if (!chatMessage) {
    throw new WorkerError("PARSE_ERROR", "No message field in Chat event payload");
  }

  // Bot 投稿は無視
  const senderType = chatMessage.sender?.type === "BOT" ? "BOT" : "HUMAN";
  if (senderType === "BOT") {
    return null;
  }

  // message.name から spaceName と messageId を抽出
  // フォーマット: "spaces/{space_id}/messages/{message_id}"
  const nameParts = chatMessage.name.split("/");
  if (nameParts.length < 4 || nameParts[0] !== "spaces" || nameParts[2] !== "messages") {
    throw new WorkerError("PARSE_ERROR", `Invalid message name format: ${chatMessage.name}`);
  }

  const spaceName = `spaces/${nameParts[1]}`;
  const googleMessageId = chatMessage.name;

  // スレッド情報
  const isThreadReply =
    chatMessage.thread?.threadReply === true || chatMessage.threadReply === true;
  const messageType: "MESSAGE" | "THREAD_REPLY" = isThreadReply ? "THREAD_REPLY" : "MESSAGE";
  const threadName = chatMessage.thread?.name ?? null;
  const parentMessageId = chatMessage.quotedMessageMetadata?.name ?? null;

  // アノテーション正規化
  const annotations: ChatAnnotation[] = (chatMessage.annotations ?? []).map((a) =>
    normalizeAnnotation(a),
  );

  // メンション抽出（USER_MENTION アノテーションから）
  const mentionedUsers = annotations
    .filter((a) => a.type === "USER_MENTION" && a.userMention?.user)
    .map((a) => ({
      userId: a.userMention!.user.name,
      displayName: a.userMention!.user.displayName,
    }));

  // 添付ファイル正規化
  const attachments: ChatAttachment[] = (chatMessage.attachment ?? []).map((att) => ({
    name: att.name ?? "",
    contentName: att.contentName,
    contentType: att.contentType,
    downloadUri: att.downloadUri,
    source:
      att.source === "DRIVE_FILE" || att.source === "UPLOADED_CONTENT" ? att.source : undefined,
  }));

  const senderUserId = chatMessage.sender?.name ?? "users/unknown";
  const senderName = chatMessage.sender?.displayName ?? "";
  const text = chatMessage.text ?? "";
  const formattedText = chatMessage.formattedText ?? null;
  const isEdited = !!(
    chatMessage.lastUpdateTime && chatMessage.lastUpdateTime !== chatMessage.createTime
  );
  const isDeleted = !!chatMessage.deleteTime;
  const createdAt = chatMessage.createTime ? new Date(chatMessage.createTime) : new Date();

  return {
    spaceName,
    googleMessageId,
    senderUserId,
    senderName,
    senderType,
    text,
    formattedText,
    messageType,
    threadName,
    parentMessageId,
    mentionedUsers,
    annotations,
    attachments,
    isEdited,
    isDeleted,
    rawPayload: payload as Record<string, unknown>,
    createdAt,
  };
}

type RawAnnotation = {
  type?: string;
  startIndex?: number;
  length?: number;
  userMention?: {
    user?: { name?: string; displayName?: string; type?: string };
    type?: string;
  };
  slashCommand?: {
    commandId?: string;
    commandName?: string;
    bot?: { name?: string; displayName?: string };
    type?: string;
  };
  richLink?: { uri?: string; richLinkMetadata?: { title?: string; mimeType?: string } };
};

function normalizeAnnotation(a: RawAnnotation): ChatAnnotation {
  const type = normalizeAnnotationType(a.type);
  const base: ChatAnnotation = {
    type,
    startIndex: a.startIndex,
    length: a.length,
  };

  if (type === "USER_MENTION" && a.userMention?.user) {
    base.userMention = {
      user: {
        name: a.userMention.user.name ?? "",
        displayName: a.userMention.user.displayName ?? "",
        type: a.userMention.user.type ?? "HUMAN",
      },
    };
  }

  if (type === "SLASH_COMMAND" && a.slashCommand) {
    base.slashCommand = {
      commandId: a.slashCommand.commandId ?? "",
      commandName: a.slashCommand.commandName ?? "",
    };
  }

  if (type === "RICH_LINK" && a.richLink) {
    base.richLink = {
      uri: a.richLink.uri ?? "",
      title: a.richLink.richLinkMetadata?.title,
    };
  }

  return base;
}

function normalizeAnnotationType(type: string | undefined): ChatAnnotation["type"] {
  switch (type) {
    case "USER_MENTION":
      return "USER_MENTION";
    case "SLASH_COMMAND":
      return "SLASH_COMMAND";
    case "RICH_LINK":
      return "RICH_LINK";
    default:
      return "UNKNOWN";
  }
}

function isPubSubPushBody(value: unknown): value is PubSubPushBody {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.message !== "object" || obj.message === null) return false;
  const msg = obj.message as Record<string, unknown>;
  return typeof msg.data === "string" && typeof msg.messageId === "string";
}
