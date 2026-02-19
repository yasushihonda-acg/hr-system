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
 * Google Workspace Events API が Pub/Sub トピックへ送る
 * Chat message.created イベントの内部ペイロード。
 */
interface ChatMessagePayload {
  message?: {
    name: string; // "spaces/{space_id}/messages/{message_id}"
    sender?: {
      name: string; // "users/{user_id}"
      type?: string; // "HUMAN" | "BOT"
      displayName?: string;
    };
    text?: string;
    createTime?: string;
    space?: { name: string };
  };
}

/**
 * パーサーが返す正規化済みイベント型。
 * Bot 投稿や無関係なイベントは null を返す。
 */
export interface ChatEvent {
  spaceName: string;
  googleMessageId: string;
  senderUserId: string; // "users/{user_id}" — Phase 1 では senderEmail の代替
  senderName: string;
  text: string;
  createdAt: Date;
}

/**
 * Pub/Sub push ボディを受け取り、ChatEvent を返す。
 * - message.created 以外のイベントタイプ → null（ACK）
 * - Bot 投稿 → null（ACK）
 * - パース失敗 → WorkerError(PARSE_ERROR, shouldNack=false) をスロー
 */
export function parsePubSubEvent(body: unknown): ChatEvent | null {
  // 型ガード
  if (!isPubSubPushBody(body)) {
    throw new WorkerError("PARSE_ERROR", "Invalid Pub/Sub push body structure");
  }

  const { message } = body;

  // イベントタイプ確認（ce-type 属性、またはデータ内の type フィールド）
  const ceType = message.attributes?.["ce-type"] ?? "";
  if (ceType && ceType !== "google.workspace.chat.message.v1.created") {
    return null; // message.created 以外は無視
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

  const chatMessage = payload.message;
  if (!chatMessage) {
    throw new WorkerError("PARSE_ERROR", "No message field in Chat event payload");
  }

  // Bot 投稿は無視
  if (chatMessage.sender?.type === "BOT") {
    return null;
  }

  // message.name から spaceName と messageId を抽出
  // フォーマット: "spaces/{space_id}/messages/{message_id}"
  const nameParts = chatMessage.name.split("/");
  // nameParts = ["spaces", "{space_id}", "messages", "{message_id}"]
  if (nameParts.length < 4 || nameParts[0] !== "spaces" || nameParts[2] !== "messages") {
    throw new WorkerError("PARSE_ERROR", `Invalid message name format: ${chatMessage.name}`);
  }

  const spaceName = `spaces/${nameParts[1]}`;
  const googleMessageId = chatMessage.name; // リソース名をID代わりに使用

  const senderUserId = chatMessage.sender?.name ?? "users/unknown";
  const senderName = chatMessage.sender?.displayName ?? "";
  const text = chatMessage.text ?? "";
  const createdAt = chatMessage.createTime ? new Date(chatMessage.createTime) : new Date();

  return {
    spaceName,
    googleMessageId,
    senderUserId,
    senderName,
    text,
    createdAt,
  };
}

function isPubSubPushBody(value: unknown): value is PubSubPushBody {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.message !== "object" || obj.message === null) return false;
  const msg = obj.message as Record<string, unknown>;
  return typeof msg.data === "string" && typeof msg.messageId === "string";
}
