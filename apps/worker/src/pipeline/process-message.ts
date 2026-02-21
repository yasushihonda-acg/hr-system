import { classifyIntent, type ThreadContext } from "@hr-system/ai";
import { collections, db } from "@hr-system/db";
import type { AuditEventType } from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { createChatApiClient } from "../lib/chat-api.js";
import { isDuplicate } from "../lib/dedup.js";
import { enrichChatEvent } from "../lib/enrich-event.js";
import { WorkerError } from "../lib/errors.js";
import type { ChatEvent } from "../lib/event-parser.js";
import { handleSalary } from "./salary-handler.js";

/** Chat API クライアントの lazy singleton */
let _chatApiClient: ReturnType<typeof createChatApiClient> | undefined;
function getChatApiClient(): ReturnType<typeof createChatApiClient> {
  if (!_chatApiClient) {
    _chatApiClient = createChatApiClient();
  }
  return _chatApiClient;
}

/**
 * Chat メッセージを受け取り、Intent 分類 → カテゴリ別ハンドラへルーティングする
 * メインオーケストレーター。
 *
 * エラーハンドリング:
 * - WorkerError(shouldNack=true): LLM/DB 一時エラー → 500 NACK → Pub/Sub リトライ
 * - WorkerError(shouldNack=false): ビジネスエラー → 200 ACK（ログ記録済み）
 */
export async function processMessage(event: ChatEvent): Promise<void> {
  // 1. 重複排除
  try {
    if (await isDuplicate(event.googleMessageId)) {
      console.info(`[Worker] Duplicate message skipped: ${event.googleMessageId}`);
      return;
    }
  } catch (e) {
    throw new WorkerError("DB_ERROR", `重複チェック失敗: ${String(e)}`, true);
  }

  // 1.5. メタデータ補完（Chat API で formattedText / annotations / attachments を取得）
  // best-effort: 失敗時は元の event で続行（NACK しない）
  const enrichedEvent = await enrichChatEvent(event, getChatApiClient());

  // 2. ChatMessage を Firestore に保存
  const chatMessageRef = collections.chatMessages.doc();
  try {
    await chatMessageRef.set({
      spaceId: enrichedEvent.spaceName,
      googleMessageId: enrichedEvent.googleMessageId,
      senderUserId: enrichedEvent.senderUserId,
      senderEmail: enrichedEvent.senderUserId, // Phase 2: People API で実名メールに置換
      senderName: enrichedEvent.senderName,
      senderType: enrichedEvent.senderType,
      content: enrichedEvent.text,
      formattedContent: enrichedEvent.formattedText,
      messageType: enrichedEvent.messageType,
      threadName: enrichedEvent.threadName,
      parentMessageId: enrichedEvent.parentMessageId,
      mentionedUsers: enrichedEvent.mentionedUsers,
      annotations: enrichedEvent.annotations,
      attachments: enrichedEvent.attachments,
      isEdited: enrichedEvent.isEdited,
      isDeleted: enrichedEvent.isDeleted,
      rawPayload: enrichedEvent.rawPayload,
      processedAt: null,
      createdAt: FieldValue.serverTimestamp() as never,
    });
  } catch (e) {
    throw new WorkerError("DB_ERROR", `ChatMessage 保存失敗: ${String(e)}`, true);
  }

  // 3. 監査ログ: chat_received
  await writeAuditLog("chat_received", "chat_message", chatMessageRef.id);

  // 3.5. スレッドコンテキスト取得（返信メッセージの分類精度向上）
  // best-effort: 失敗時は context なしで分類を継続（NACK しない）
  let threadContext: ThreadContext | undefined;
  if (enrichedEvent.threadName) {
    try {
      threadContext = await getThreadContext(enrichedEvent.threadName, chatMessageRef.id);
    } catch (e) {
      console.warn(`[Worker] Thread context 取得失敗: ${String(e)}`);
    }
  }

  // 4. Intent 分類（regex → AI フォールバック、スレッドコンテキスト付き）
  let intentResult: Awaited<ReturnType<typeof classifyIntent>>;
  try {
    intentResult = await classifyIntent(enrichedEvent.text, threadContext);
  } catch (e) {
    // LLM エラー → NACK してリトライ
    throw new WorkerError("LLM_ERROR", `Intent 分類失敗: ${String(e)}`, true);
  }

  // 5. IntentRecord を Firestore に保存
  const intentRef = collections.intentRecords.doc();
  try {
    await intentRef.set({
      chatMessageId: chatMessageRef.id,
      category: intentResult.category,
      confidenceScore: intentResult.confidence,
      extractedParams: null,
      classificationMethod: intentResult.classificationMethod,
      regexPattern: intentResult.regexPattern ?? null,
      llmInput: intentResult.classificationMethod === "ai" ? enrichedEvent.text : null,
      llmOutput: intentResult.classificationMethod === "ai" ? intentResult.reasoning : null,
      isManualOverride: false,
      originalCategory: null,
      overriddenBy: null,
      overriddenAt: null,
      responseStatus: "unresponded",
      responseStatusUpdatedBy: null,
      responseStatusUpdatedAt: null,
      createdAt: FieldValue.serverTimestamp() as never,
    });
  } catch (e) {
    throw new WorkerError("DB_ERROR", `IntentRecord 保存失敗: ${String(e)}`, true);
  }

  // 6. 監査ログ: intent_classified
  await writeAuditLog("intent_classified", "intent_record", intentRef.id);

  // 7. カテゴリ別ハンドラへルーティング
  if (intentResult.category === "salary") {
    await handleSalary(chatMessageRef.id, enrichedEvent, intentResult);
  } else {
    // Phase 1: 給与以外はログのみ記録
    console.info(
      `[Worker] Non-salary category: ${intentResult.category}, message: ${chatMessageRef.id}`,
    );
  }

  // 8. processedAt を更新
  try {
    await chatMessageRef.update({ processedAt: FieldValue.serverTimestamp() });
  } catch (e) {
    // processedAt 更新失敗は致命的ではないが記録する
    console.warn(`[Worker] processedAt 更新失敗: ${String(e)}`);
  }
}

/**
 * スレッドの最初のメッセージ（親）の分類結果を取得してコンテキストを構築する。
 * firestore.indexes.json の threadName+createdAt(asc) インデックスを使用。
 */
async function getThreadContext(
  threadName: string,
  currentMessageId: string,
): Promise<ThreadContext | undefined> {
  // スレッド内の全メッセージを createdAt 昇順で取得（先頭が親）
  const snapshot = await collections.chatMessages
    .where("threadName", "==", threadName)
    .orderBy("createdAt", "asc")
    .limit(2)
    .get();

  if (snapshot.empty) return undefined;

  // 先頭メッセージが親（現在処理中のメッセージと同一の場合は親なし）
  const parentDoc = snapshot.docs[0];
  if (!parentDoc || parentDoc.id === currentMessageId) return undefined;

  const parentData = parentDoc.data();

  // 親の IntentRecord を取得
  const intentSnapshot = await collections.intentRecords
    .where("chatMessageId", "==", parentDoc.id)
    .limit(1)
    .get();

  const parentIntent = intentSnapshot.empty ? null : intentSnapshot.docs[0]?.data();

  // スレッドの返信数（親を除く）
  const replyCount = snapshot.size > 1 ? snapshot.size - 1 : 0;

  return {
    parentCategory: parentIntent?.category ?? "other",
    parentConfidence: parentIntent?.confidenceScore ?? 0,
    parentSnippet: parentData.content.slice(0, 100),
    replyCount,
  };
}

/** 監査ログを書き込む（失敗しても NACK しない） */
async function writeAuditLog(
  eventType: AuditEventType,
  entityType: string,
  entityId: string,
): Promise<void> {
  try {
    const auditRef = collections.auditLogs.doc();
    await db.runTransaction(async (tx) => {
      tx.set(auditRef, {
        eventType,
        entityType,
        entityId,
        actorEmail: null,
        actorRole: null,
        details: {},
        createdAt: FieldValue.serverTimestamp() as never,
      });
    });
  } catch (e) {
    // 監査ログ失敗は警告のみ（処理は続行）
    console.warn(`[Worker] 監査ログ書き込み失敗 (${eventType}): ${String(e)}`);
  }
}
