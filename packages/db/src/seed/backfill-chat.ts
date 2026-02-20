/**
 * Chat REST API バックフィル
 *
 * Google Chat REST API (spaces.messages.list) で過去1年分の全メッセージを取得し、
 * 完全なメタデータ付きで Firestore の chat_messages / intent_records を上書きする。
 *
 * 認証方法（優先順位順）:
 *
 *   (1) GOOGLE_ACCESS_TOKEN 環境変数
 *       任意の方法で取得した Bearer トークンを直接渡す。
 *       例: GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) だと chat スコープがないが、
 *           Desktop OAuth クライアントで取得したトークンなら有効。
 *       例: GOOGLE_ACCESS_TOKEN=ya29.xxx pnpm --filter @hr-system/db db:backfill
 *
 *   (2) DWD（Domain-Wide Delegation）
 *       SA + DWD でユーザーを代理してアクセス。
 *       DWD_SA_KEY_FILE と DWD_SUBJECT の両方が必要。
 *       前提: Cloud Console でSAのDWD有効化 + admin.google.com でスコープ承認済み。
 *       例: DWD_SA_KEY_FILE=/path/to/key.json DWD_SUBJECT=user@domain.com \
 *             pnpm --filter @hr-system/db db:backfill
 *
 *   (3) ADC（Application Default Credentials）
 *       gcloud auth application-default login \
 *         --scopes="https://www.googleapis.com/auth/cloud-platform,\
 *                   https://www.googleapis.com/auth/chat.messages.readonly"
 *       ※ Workspace管理者ポリシーでgcloudクライアントがブロックされている場合は失敗する。
 *
 * 実行:
 *   pnpm --filter @hr-system/db db:backfill
 */

import { fileURLToPath } from "node:url";
import type { ChatCategory } from "@hr-system/shared";
import type { ChatAnnotation, ChatAttachment } from "../types.js";
import { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth, JWT } from "google-auth-library";
import { collections } from "../collections.js";

/** google-auth-library の request インターフェースを最小限で抽象化 */
type RequestClient = {
  request: <T>(opts: { url: string }) => Promise<{ data: T }>;
};

// ============================================================
// 定数
// ============================================================

const SPACE_ID = "AAAA-qf5jX0";
const SPACE_NAME = `spaces/${SPACE_ID}`;
const BATCH_SIZE = 400;
const PAGE_SIZE = 1000;
/** ページ間レート制限対応ディレイ (ms) — spaces.messages.list: 600 req/min */
const PAGE_DELAY_MS = 500;
/** 過去1年分 */
const ONE_YEAR_AGO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

// ============================================================
// Google Chat API 型定義
// ============================================================

interface ChatApiUser {
  name?: string;
  displayName?: string;
  type?: string;
}

interface ChatApiAnnotation {
  type?: string;
  startIndex?: number;
  length?: number;
  userMention?: {
    user?: ChatApiUser;
    type?: string;
  };
  slashCommand?: {
    commandId?: string;
    commandName?: string;
    bot?: { name?: string; displayName?: string };
    type?: string;
  };
  richLink?: {
    uri?: string;
    richLinkMetadata?: { title?: string; mimeType?: string };
  };
}

interface ChatApiAttachment {
  name?: string;
  contentName?: string;
  contentType?: string;
  downloadUri?: string;
  source?: string;
}

interface ChatApiMessage {
  name: string;
  sender?: ChatApiUser;
  text?: string;
  formattedText?: string;
  createTime?: string;
  lastUpdateTime?: string;
  deleteTime?: string;
  space?: { name: string };
  thread?: { name: string; threadReply?: boolean };
  quotedMessageMetadata?: { name?: string };
  annotations?: ChatApiAnnotation[];
  attachment?: ChatApiAttachment[];
  threadReply?: boolean;
}

interface ListMessagesResponse {
  messages?: ChatApiMessage[];
  nextPageToken?: string;
}

// ============================================================
// カテゴリ分類（chat-messages.ts と同一ロジック）
// ============================================================

const CATEGORY_KEYWORDS: Record<ChatCategory, string[]> = {
  salary: [
    "給与",
    "時給",
    "月給",
    "賃金",
    "最低賃金",
    "手当",
    "社会保険",
    "住民税",
    "給与明細",
    "昇給",
    "減給",
    "資格手当",
    "地域手当",
    "役職手当",
    "ピッチ",
    "給与規程",
  ],
  retirement: [
    "退職",
    "退社",
    "離職",
    "休職",
    "復職",
    "離職票",
    "退職金",
    "育休",
    "育児休業",
    "産休",
    "産前産後",
  ],
  hiring: [
    "入社",
    "採用",
    "面接",
    "求人",
    "応募",
    "内定",
    "オリエンテーション",
    "試用期間",
    "新入社員",
    "新卒",
    "中途",
  ],
  contract: [
    "労働条件",
    "雇用契約",
    "契約更新",
    "職種変更",
    "条件通知書",
    "雇用形態",
    "パートタイム",
  ],
  transfer: ["異動", "拠点", "移転", "寮", "社用車", "施設", "転勤"],
  foreigner: ["外国人", "特定技能", "ビザ", "入管", "在留", "実習生", "技能実習", "外国籍"],
  training: ["研修", "監査", "証明書", "身体拘束", "就労証明", "資格", "免許", "講習"],
  health_check: ["健康診断", "面談", "産業医", "定期健診", "人間ドック", "健診"],
  attendance: ["勤怠", "休暇", "シフト", "有給", "残業", "欠勤", "遅刻", "早退"],
  other: [],
};

function classifyMessage(content: string): {
  category: ChatCategory;
  matchedKeyword: string | null;
} {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ChatCategory, string[]][]) {
    if (cat === "other") continue;
    const found = keywords.find((kw) => content.includes(kw));
    if (found) return { category: cat, matchedKeyword: found };
  }
  return { category: "other", matchedKeyword: null };
}

// ============================================================
// ドキュメントID のサニタイズ
// ============================================================

/** "spaces/AAAA-qf5jX0/messages/xxx.yyy" → "spaces_AAAA-qf5jX0_messages_xxx_yyy" */
function sanitizeDocId(googleMessageId: string): string {
  return googleMessageId.replace(/\//g, "_").replace(/\./g, "_");
}

// ============================================================
// アノテーション正規化
// ============================================================

type NormalizedAnnotationType = "USER_MENTION" | "SLASH_COMMAND" | "RICH_LINK" | "UNKNOWN";

function normalizeAnnotationType(type: string | undefined): NormalizedAnnotationType {
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

function normalizeAnnotation(a: ChatApiAnnotation): ChatAnnotation {
  const type = normalizeAnnotationType(a.type);
  const base: ChatAnnotation = { type };

  // undefined のフィールドはキー自体を省略（Firestore は undefined を拒否するため）
  if (a.startIndex !== undefined) base.startIndex = a.startIndex;
  if (a.length !== undefined) base.length = a.length;

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
    const richLink: ChatAnnotation["richLink"] = { uri: a.richLink.uri ?? "" };
    if (a.richLink.richLinkMetadata?.title !== undefined) {
      richLink.title = a.richLink.richLinkMetadata.title;
    }
    base.richLink = richLink;
  }
  return base;
}

// ============================================================
// Chat REST API クライアント
// ============================================================

async function fetchMessages(
  client: RequestClient | null,
  bearerToken?: string,
): Promise<ChatApiMessage[]> {
  const filterTime = ONE_YEAR_AGO.toISOString();
  const allMessages: ChatApiMessage[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  console.log(`  フィルタ: createTime > ${filterTime}`);

  do {
    const url = new URL(`https://chat.googleapis.com/v1/${SPACE_NAME}/messages`);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("filter", `createTime > "${filterTime}"`);
    url.searchParams.set("orderBy", "createTime asc");
    url.searchParams.set("showDeleted", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    let data: ListMessagesResponse;
    if (bearerToken) {
      // --- REST API / CLI トークン直接渡し ---
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Chat API エラー ${res.status}: ${body}`);
      }
      data = (await res.json()) as ListMessagesResponse;
    } else {
      // --- ADC / DWD (google-auth-library) ---
      if (!client) throw new Error("client が null — 認証設定を確認してください");
      const res = await client.request<ListMessagesResponse>({ url: url.toString() });
      data = res.data;
    }

    const msgs = data.messages ?? [];
    allMessages.push(...msgs);
    pageCount++;

    console.log(`  ページ ${pageCount}: ${msgs.length} 件取得 (累計 ${allMessages.length} 件)`);

    pageToken = data.nextPageToken;

    if (pageToken) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    }
  } while (pageToken);

  return allMessages;
}

// ============================================================
// 既存 seed ドキュメントの削除
// ============================================================

async function deleteExistingSeedDocs(): Promise<void> {
  console.log("  既存の seed ドキュメントを削除中...");

  const [msgSnap, intentSnap] = await Promise.all([
    collections.chatMessages
      .where("googleMessageId", ">=", "seed-msg-")
      .where("googleMessageId", "<=", "seed-msg-\uf8ff")
      .get(),
    collections.intentRecords
      .where("chatMessageId", ">=", "seed-msg-")
      .where("chatMessageId", "<=", "seed-msg-\uf8ff")
      .get(),
  ]);

  const FIRESTORE_BATCH_LIMIT = 500;

  // chatMessages 削除
  for (let i = 0; i < msgSnap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = msgSnap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = collections.chatMessages.firestore.batch();
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
  }

  // intentRecords 削除
  for (let i = 0; i < intentSnap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = intentSnap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = collections.intentRecords.firestore.batch();
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
  }

  console.log(
    `  削除完了: chatMessages ${msgSnap.docs.length} 件, intentRecords ${intentSnap.docs.length} 件`,
  );
}

// ============================================================
// メッセージ変換 + Firestore 書き込み
// ============================================================

async function writeMessages(messages: ChatApiMessage[]): Promise<void> {
  let chatMsgCount = 0;
  let intentCount = 0;
  let skippedBot = 0;

  for (let offset = 0; offset < messages.length; offset += BATCH_SIZE) {
    const chunk = messages.slice(offset, offset + BATCH_SIZE);
    const msgBatch = collections.chatMessages.firestore.batch();
    const intentBatch = collections.intentRecords.firestore.batch();

    for (const msg of chunk) {
      // Bot 投稿はスキップ
      if (msg.sender?.type === "BOT") {
        skippedBot++;
        continue;
      }

      const googleMessageId = msg.name;
      const docId = sanitizeDocId(googleMessageId);

      // スレッド情報
      const isThreadReply = msg.thread?.threadReply === true || msg.threadReply === true;
      const messageType = isThreadReply ? ("THREAD_REPLY" as const) : ("MESSAGE" as const);
      const threadName = msg.thread?.name ?? null;
      const parentMessageId = msg.quotedMessageMetadata?.name ?? null;

      // アノテーション
      const annotations = (msg.annotations ?? []).map(normalizeAnnotation);

      // メンション
      const mentionedUsers = annotations
        .filter((a) => a.type === "USER_MENTION" && a.userMention?.user)
        .map((a) => ({
          userId: a.userMention?.user.name ?? "",
          displayName: a.userMention?.user.displayName ?? "",
        }));

      // 添付ファイル（undefined フィールドはキーごと省略）
      const attachments = (msg.attachment ?? []).map((att): ChatAttachment => {
        const result: ChatAttachment = { name: att.name ?? "" };
        if (att.contentName !== undefined) result.contentName = att.contentName;
        if (att.contentType !== undefined) result.contentType = att.contentType;
        if (att.downloadUri !== undefined) result.downloadUri = att.downloadUri;
        if (att.source === "DRIVE_FILE" || att.source === "UPLOADED_CONTENT") {
          result.source = att.source;
        }
        return result;
      });

      const senderUserId = msg.sender?.name ?? "users/unknown";
      const senderName = msg.sender?.displayName ?? "";
      const content = msg.text ?? "";
      const formattedContent = msg.formattedText ?? null;
      const isEdited = !!(msg.lastUpdateTime && msg.lastUpdateTime !== msg.createTime);
      const isDeleted = !!msg.deleteTime;
      const createdAt = msg.createTime
        ? Timestamp.fromDate(new Date(msg.createTime))
        : Timestamp.now();

      // ChatMessage
      const msgRef = collections.chatMessages.doc(docId);
      msgBatch.set(msgRef, {
        spaceId: SPACE_ID,
        googleMessageId,
        senderUserId,
        senderEmail: senderUserId,
        senderName,
        senderType: "HUMAN" as const,
        content,
        formattedContent,
        messageType,
        threadName,
        parentMessageId,
        mentionedUsers,
        annotations,
        attachments,
        isEdited,
        isDeleted,
        rawPayload: JSON.parse(JSON.stringify(msg)) as Record<string, unknown>,
        processedAt: null,
        createdAt,
      });

      // IntentRecord
      const { category, matchedKeyword } = classifyMessage(content);
      const intentDocId = `intent-${docId}`;
      const intentRef = collections.intentRecords.doc(intentDocId);
      intentBatch.set(intentRef, {
        chatMessageId: docId,
        category,
        confidenceScore: matchedKeyword ? 0.9 : 0.5,
        extractedParams: null,
        classificationMethod: "regex" as const,
        regexPattern: matchedKeyword ?? null,
        llmInput: null,
        llmOutput: null,
        isManualOverride: false,
        originalCategory: null,
        overriddenBy: null,
        overriddenAt: null,
        responseStatus: "unresponded" as const,
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
        createdAt,
      });

      chatMsgCount++;
      intentCount++;
    }

    await msgBatch.commit();
    await intentBatch.commit();

    console.log(
      `  バッチ ${Math.floor(offset / BATCH_SIZE) + 1}: ${Math.min(chunk.length, chatMsgCount - Math.floor(offset / BATCH_SIZE) * BATCH_SIZE)} 件書き込み完了`,
    );
  }

  console.log(`  スキップ (Bot): ${skippedBot} 件`);
  console.log(`  書き込み完了: chatMessages ${chatMsgCount} 件, intentRecords ${intentCount} 件`);
}

// ============================================================
// メインエントリポイント
// ============================================================

export async function backfillChatMessages(): Promise<void> {
  console.log(`\n=== Chat API バックフィル開始 ===`);
  console.log(`対象スペース: ${SPACE_NAME}`);
  console.log(`取得期間: ${ONE_YEAR_AGO.toLocaleDateString("ja-JP")} 〜 現在`);

  // 認証方法の選択（優先順位順）:
  //   (1) GOOGLE_ACCESS_TOKEN 環境変数 → Bearer トークン直接渡し
  //   (2) DWD_SA_KEY_FILE + DWD_SUBJECT → JWT (Domain-Wide Delegation)
  //   (3) 未設定 → ADC (Application Default Credentials)
  const bearerToken = process.env.GOOGLE_ACCESS_TOKEN;
  const dwdKeyFile = process.env.DWD_SA_KEY_FILE;
  const dwdSubject = process.env.DWD_SUBJECT;

  let requestClient: RequestClient | null = null;

  if (bearerToken) {
    console.log("  認証: GOOGLE_ACCESS_TOKEN 環境変数を使用");
  } else if (dwdKeyFile && dwdSubject) {
    console.log(`  認証: DWD (Domain-Wide Delegation) — subject: ${dwdSubject}`);
    requestClient = new JWT({
      keyFile: dwdKeyFile,
      scopes: ["https://www.googleapis.com/auth/chat.messages.readonly"],
      subject: dwdSubject,
    });
  } else {
    console.log("  認証: ADC (Application Default Credentials) を使用");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/chat.messages.readonly"],
    });
    requestClient = await auth.getClient();
  }

  // 1. Chat API からメッセージ取得
  console.log("\n[1/3] Chat REST API からメッセージ取得中...");
  const messages = await fetchMessages(requestClient, bearerToken);
  console.log(`  合計 ${messages.length} 件取得`);

  if (messages.length === 0) {
    console.warn("  警告: メッセージが0件です。ADC認証とスペースIDを確認してください。");
    return;
  }

  // 2. 既存 seed ドキュメント削除
  console.log("\n[2/3] 既存 seed データ削除中...");
  await deleteExistingSeedDocs();

  // 3. API データを Firestore に書き込み
  console.log("\n[3/3] Firestore への書き込み中...");
  await writeMessages(messages);

  console.log("\n=== バックフィル完了 ===");
}

// このファイルがエントリーポイントとして直接実行された場合のみバックフィルを実行
// import されただけの場合（seed/index.ts から呼ばれる場合など）はここを通らない
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backfillChatMessages().catch((err) => {
    console.error("バックフィル失敗:", err);
    process.exit(1);
  });
}
