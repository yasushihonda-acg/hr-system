import { classifyIntent } from "@hr-system/ai";
import { collections, db } from "@hr-system/db";
import type { AuditEventType } from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { isDuplicate } from "../lib/dedup.js";
import { WorkerError } from "../lib/errors.js";
import type { ChatEvent } from "../lib/event-parser.js";
import { handleSalary } from "./salary-handler.js";

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

  // 2. ChatMessage を Firestore に保存
  const chatMessageRef = collections.chatMessages.doc();
  try {
    await chatMessageRef.set({
      spaceId: event.spaceName,
      googleMessageId: event.googleMessageId,
      senderUserId: event.senderUserId,
      senderEmail: event.senderUserId, // Phase 2: People API で実名メールに置換
      senderName: event.senderName,
      senderType: event.senderType,
      content: event.text,
      formattedContent: event.formattedText,
      messageType: event.messageType,
      threadName: event.threadName,
      parentMessageId: event.parentMessageId,
      mentionedUsers: event.mentionedUsers,
      annotations: event.annotations,
      attachments: event.attachments,
      isEdited: event.isEdited,
      isDeleted: event.isDeleted,
      rawPayload: event.rawPayload,
      processedAt: null,
      createdAt: FieldValue.serverTimestamp() as never,
    });
  } catch (e) {
    throw new WorkerError("DB_ERROR", `ChatMessage 保存失敗: ${String(e)}`, true);
  }

  // 3. 監査ログ: chat_received
  await writeAuditLog("chat_received", "chat_message", chatMessageRef.id);

  // 4. Intent 分類（regex → AI フォールバック）
  let intentResult: Awaited<ReturnType<typeof classifyIntent>>;
  try {
    intentResult = await classifyIntent(event.text);
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
      llmInput: intentResult.classificationMethod === "ai" ? event.text : null,
      llmOutput: intentResult.classificationMethod === "ai" ? intentResult.reasoning : null,
      isManualOverride: false,
      originalCategory: null,
      overriddenBy: null,
      overriddenAt: null,
      createdAt: FieldValue.serverTimestamp() as never,
    });
  } catch (e) {
    throw new WorkerError("DB_ERROR", `IntentRecord 保存失敗: ${String(e)}`, true);
  }

  // 6. 監査ログ: intent_classified
  await writeAuditLog("intent_classified", "intent_record", intentRef.id);

  // 7. カテゴリ別ハンドラへルーティング
  if (intentResult.category === "salary") {
    await handleSalary(chatMessageRef.id, event, intentResult);
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
