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
 *   (2) SA_KEY_FILE（ボット認証）★推奨
 *       hr-worker SA の一時鍵ファイルを使って chat.bot スコープでアクセス。
 *       hr-worker はスペースのボットメンバーなので spaces.messages.get / spaces.members.get 両方可能。
 *       手順:
 *         # 一時鍵を作成
 *         gcloud iam service-accounts keys create /tmp/hr-worker-key.json \
 *           --iam-account=hr-worker@hr-system-487809.iam.gserviceaccount.com
 *         # 実行
 *         SA_KEY_FILE=/tmp/hr-worker-key.json pnpm --filter @hr-system/db db:repair -- --repair --limit=100
 *         # 完了後に鍵を削除
 *         KEY_ID=$(gcloud iam service-accounts keys list \
 *           --iam-account=hr-worker@hr-system-487809.iam.gserviceaccount.com \
 *           --filter="keyType=USER_MANAGED" --format="value(name)" | head -1)
 *         gcloud iam service-accounts keys delete $KEY_ID \
 *           --iam-account=hr-worker@hr-system-487809.iam.gserviceaccount.com
 *
 *   (3) DWD（Domain-Wide Delegation）
 *       SA + DWD でユーザーを代理してアクセス。
 *       DWD_SA_KEY_FILE と DWD_SUBJECT の両方が必要。
 *       前提: Cloud Console でSAのDWD有効化 + admin.google.com でスコープ承認済み。
 *       例: DWD_SA_KEY_FILE=/path/to/key.json DWD_SUBJECT=user@domain.com \
 *             pnpm --filter @hr-system/db db:backfill
 *
 *   (4) ADC（Application Default Credentials）
 *       gcloud auth application-default login \
 *         --scopes="https://www.googleapis.com/auth/cloud-platform,\
 *                   https://www.googleapis.com/auth/chat.messages.readonly,\
 *                   https://www.googleapis.com/auth/chat.memberships.readonly,\
 *                   https://www.googleapis.com/auth/directory.readonly"
 *       ※ Workspace管理者ポリシーでgcloudクライアントがブロックされている場合は失敗する。
 *       ※ displayName 取得は People API（directory.readonly）が必要。
 *         Chat API の spaces.members.get は displayName を返さない仕様のため。
 *
 * 実行:
 *   pnpm --filter @hr-system/db db:backfill
 */

import { fileURLToPath } from "node:url";
import type { ChatCategory } from "@hr-system/shared";
import { Timestamp } from "firebase-admin/firestore";
import { GoogleAuth, JWT } from "google-auth-library";
import { collections } from "../collections.js";
import type { ChatAnnotation, ChatAttachment } from "../types.js";

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

export async function backfillChatMessages(limit?: number): Promise<void> {
  console.log(`\n=== Chat API バックフィル開始 ===`);
  console.log(`対象スペース: ${SPACE_NAME}`);
  console.log(`取得期間: ${ONE_YEAR_AGO.toLocaleDateString("ja-JP")} 〜 現在`);
  if (limit) console.log(`  件数制限: 最新 ${limit} 件`);

  // 認証方法の選択（優先順位順）:
  //   (1) GOOGLE_ACCESS_TOKEN 環境変数 → Bearer トークン直接渡し
  //   (2) SA_KEY_FILE → SA鍵ファイル (chat.bot スコープ、ボット認証)
  //   (3) DWD_SA_KEY_FILE + DWD_SUBJECT → JWT (Domain-Wide Delegation)
  //   (4) 未設定 → ADC (Application Default Credentials)
  const bearerToken = process.env.GOOGLE_ACCESS_TOKEN;
  const saKeyFile = process.env.SA_KEY_FILE;
  const dwdKeyFile = process.env.DWD_SA_KEY_FILE;
  const dwdSubject = process.env.DWD_SUBJECT;

  let requestClient: RequestClient | null = null;

  if (bearerToken) {
    console.log("  認証: GOOGLE_ACCESS_TOKEN 環境変数を使用");
  } else if (saKeyFile) {
    console.log(`  認証: SA Key (chat.bot) — ${saKeyFile}`);
    requestClient = new JWT({
      keyFile: saKeyFile,
      scopes: ["https://www.googleapis.com/auth/chat.bot"],
    });
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
  const allMessages = await fetchMessages(requestClient, bearerToken);
  // --limit 指定時は最新 N 件に絞る（createTime asc で取得済みなので末尾が最新）
  const messages = limit ? allMessages.slice(-limit) : allMessages;
  console.log(
    `  合計 ${messages.length} 件取得${limit ? ` (全 ${allMessages.length} 件中 最新 ${limit} 件)` : ""}`,
  );

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

// ============================================================
// 1件メッセージ取得（repair 用）
// ============================================================

/**
 * Chat REST API で単一メッセージを取得する。
 * 取得失敗時は null を返す（best-effort）。
 */
async function fetchMessage(
  client: RequestClient | null,
  bearerToken: string | undefined,
  messageName: string,
): Promise<ChatApiMessage | null> {
  const url = `https://chat.googleapis.com/v1/${messageName}`;
  try {
    if (bearerToken) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) {
        console.warn(`  API エラー ${res.status} for ${messageName}`);
        return null;
      }
      return (await res.json()) as ChatApiMessage;
    }
    if (!client) throw new Error("client が null — 認証設定を確認してください");
    const res = await client.request<ChatApiMessage>({ url });
    return res.data;
  } catch (e) {
    console.warn(`  fetchMessage 失敗 (${messageName}): ${String(e)}`);
    return null;
  }
}

// ============================================================
// 1件メンバー取得（repair 用 displayName 補完）
// ============================================================

/**
 * spaces.members.get で単一メンバーの displayName を取得する。
 * 取得失敗時は null を返す（best-effort）。
 *
 * @param memberName - `spaces/{spaceId}/members/users/{userId}` 形式
 */
async function fetchMember(
  client: RequestClient | null,
  bearerToken: string | undefined,
  memberName: string,
): Promise<{ displayName?: string } | null> {
  const url = `https://chat.googleapis.com/v1/${memberName}`;
  try {
    if (bearerToken) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) {
        console.warn(`  getMember API エラー ${res.status} for ${memberName}`);
        return null;
      }
      const membership = (await res.json()) as { member?: { displayName?: string } };
      return membership.member ?? null;
    }
    if (!client) throw new Error("client が null — 認証設定を確認してください");
    const res = await client.request<{ member?: { displayName?: string } }>({ url });
    return res.data.member ?? null;
  } catch (e) {
    console.warn(`  fetchMember 失敗 (${memberName}): ${String(e)}`);
    return null;
  }
}

// ============================================================
// People API で displayName 取得（repair 用）
// ============================================================

/**
 * People API で Workspace ユーザーの displayName を取得する。
 * Chat API の spaces.members.get は displayName を返さないため、こちらを使用。
 * directory.readonly スコープが必要。
 *
 * @param senderUserId - "users/116189466267679439841" 形式
 */
async function fetchDisplayNameFromPeopleApi(
  client: RequestClient | null,
  bearerToken: string | undefined,
  senderUserId: string,
): Promise<string> {
  const numericId = senderUserId.replace(/^users\//, "");
  const url = `https://people.googleapis.com/v1/people/${numericId}?personFields=names`;
  try {
    if (bearerToken) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { names?: Array<{ displayName?: string }> };
      return data.names?.[0]?.displayName ?? "";
    }
    if (!client) return "";
    const res = await client.request<{ names?: Array<{ displayName?: string }> }>({ url });
    return res.data.names?.[0]?.displayName ?? "";
  } catch (e) {
    console.warn(`  fetchPeople 失敗 (${senderUserId}): ${String(e)}`);
    return "";
  }
}

// ============================================================
// 欠損データ修復
// ============================================================

/**
 * PR #62 マージ前に蓄積された chatMessages の欠損フィールドを補完する。
 *
 * 対象: senderName が空のドキュメント（Worker (Pub/Sub) 経由で受信した旧データ）
 * 処理: Chat REST API spaces.messages.get で再取得し update() で更新。
 *       mentionedUsers の displayName が空の場合は spaces.members.get で追加補完。
 * 非破壊: processedAt / createdAt / intentRecords には一切触らない。
 */
export async function repairChatMessages(limit?: number): Promise<void> {
  console.log("\n=== Chat メッセージ修復開始 ===");
  if (limit) console.log(`  件数制限: ${limit} 件`);

  // 認証（backfillChatMessages と同一ロジック）
  const bearerToken = process.env.GOOGLE_ACCESS_TOKEN;
  const saKeyFile = process.env.SA_KEY_FILE;
  const dwdKeyFile = process.env.DWD_SA_KEY_FILE;
  const dwdSubject = process.env.DWD_SUBJECT;
  let requestClient: RequestClient | null = null;

  if (bearerToken) {
    console.log("  認証: GOOGLE_ACCESS_TOKEN 環境変数を使用");
  } else if (saKeyFile) {
    console.log(`  認証: SA Key (chat.bot) — ${saKeyFile}`);
    requestClient = new JWT({
      keyFile: saKeyFile,
      scopes: ["https://www.googleapis.com/auth/chat.bot"],
    });
  } else if (dwdKeyFile && dwdSubject) {
    console.log(`  認証: DWD (Domain-Wide Delegation) — subject: ${dwdSubject}`);
    requestClient = new JWT({
      keyFile: dwdKeyFile,
      scopes: [
        "https://www.googleapis.com/auth/chat.messages.readonly",
        "https://www.googleapis.com/auth/chat.memberships.readonly",
      ],
      subject: dwdSubject,
    });
  } else {
    console.log("  認証: ADC (Application Default Credentials) を使用");
    const auth = new GoogleAuth({
      scopes: [
        "https://www.googleapis.com/auth/chat.messages.readonly",
        "https://www.googleapis.com/auth/chat.memberships.readonly",
        "https://www.googleapis.com/auth/directory.readonly",
      ],
    });
    requestClient = await auth.getClient();
  }

  // [1/3] 修復対象ドキュメントを Firestore から取得
  console.log("\n[1/3] 修復対象ドキュメントを検索中...");
  const baseQuery = collections.chatMessages.where("senderName", "==", "");
  const snap = await (limit ? baseQuery.limit(limit) : baseQuery).get();
  console.log(
    `  修復対象: ${snap.docs.length} 件 (senderName が空${limit ? ` / 上限 ${limit} 件` : ""})`,
  );

  if (snap.docs.length === 0) {
    console.log("  修復対象なし。処理を終了します。");
    return;
  }

  // [2/3] Chat API で補完データを取得し update
  console.log("\n[2/3] Chat API で欠損フィールドを補完中...");

  /** Chat API 呼び出し間のディレイ (ms) — spaces.messages.get: 600 req/min */
  const REQUEST_DELAY_MS = 200;

  let repaired = 0;
  let failed = 0;
  let docIndex = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const googleMessageId = data.googleMessageId;

    if (docIndex > 0) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
    docIndex++;

    const apiMsg = await fetchMessage(requestClient, bearerToken, googleMessageId);
    if (!apiMsg) {
      console.warn(`  スキップ (API 失敗): ${googleMessageId}`);
      failed++;
      continue;
    }

    // アノテーション
    const annotations = (apiMsg.annotations ?? []).map(normalizeAnnotation);

    // メンション（annotations から再抽出）
    // displayName が空の場合は spaces.members.get で補完する
    const rawMentionedUsers = annotations
      .filter((a) => a.type === "USER_MENTION" && a.userMention?.user)
      .map((a) => ({
        userId: a.userMention?.user.name ?? "",
        displayName: a.userMention?.user.displayName ?? "",
      }));
    const mentionedUsers: Array<{ userId: string; displayName: string }> = [];
    for (const u of rawMentionedUsers) {
      if (u.displayName !== "" || !u.userId) {
        mentionedUsers.push(u);
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      // Chat API の spaces.members.get は displayName を返さないため People API を使用
      const displayName = await fetchDisplayNameFromPeopleApi(requestClient, bearerToken, u.userId);
      mentionedUsers.push({ ...u, displayName });
    }

    // 添付ファイル
    const attachments: ChatAttachment[] = (apiMsg.attachment ?? []).map((att) => {
      const result: ChatAttachment = { name: att.name ?? "" };
      if (att.contentName !== undefined) result.contentName = att.contentName;
      if (att.contentType !== undefined) result.contentType = att.contentType;
      if (att.downloadUri !== undefined) result.downloadUri = att.downloadUri;
      if (att.source === "DRIVE_FILE" || att.source === "UPLOADED_CONTENT") {
        result.source = att.source;
      }
      return result;
    });

    // senderName: Chat API は sender.displayName を返さないため People API で補完
    let repairedSenderName = apiMsg.sender?.displayName || "";
    if (!repairedSenderName && apiMsg.sender?.name) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
      repairedSenderName = await fetchDisplayNameFromPeopleApi(
        requestClient,
        bearerToken,
        apiMsg.sender.name,
      );
    }

    // update() で欠損フィールドのみ補完（processedAt / createdAt には触らない）
    await doc.ref.update({
      senderName: repairedSenderName,
      senderUserId: apiMsg.sender?.name ?? data.senderUserId,
      formattedContent: apiMsg.formattedText ?? data.formattedContent,
      annotations,
      mentionedUsers,
      attachments,
      parentMessageId: apiMsg.quotedMessageMetadata?.name ?? data.parentMessageId,
      isEdited: !!(apiMsg.lastUpdateTime && apiMsg.lastUpdateTime !== apiMsg.createTime),
      isDeleted: !!apiMsg.deleteTime,
    });

    repaired++;
    if (repaired % 50 === 0 || repaired === snap.docs.length) {
      console.log(`  進捗: ${repaired}/${snap.docs.length} 件完了`);
    }
  }

  // [3/3] 結果サマリー
  console.log("\n[3/3] 修復結果");
  console.log(`  修復成功: ${repaired} 件`);
  if (failed > 0) console.warn(`  修復失敗 (API 取得不可): ${failed} 件`);
  console.log("=== 修復完了 ===\n");
}

// ============================================================
// エントリーポイント
// ============================================================

// このファイルがエントリーポイントとして直接実行された場合のみ実行
// import されただけの場合（seed/index.ts から呼ばれる場合など）はここを通らない
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isRepair = process.argv.includes("--repair");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.slice("--limit=".length), 10) : undefined;

  if (isRepair) {
    repairChatMessages(limit).catch((err) => {
      console.error("修復失敗:", err);
      process.exit(1);
    });
  } else {
    backfillChatMessages(limit).catch((err) => {
      console.error("バックフィル失敗:", err);
      process.exit(1);
    });
  }
}
