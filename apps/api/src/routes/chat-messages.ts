import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import { CHAT_CATEGORIES, type ChatCategory, RESPONSE_STATUSES } from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO, toISOOrNull } from "../lib/serialize.js";

const listQuerySchema = z.object({
  spaceId: z.string().optional(),
  messageType: z.enum(["MESSAGE", "THREAD_REPLY"]).optional(),
  threadName: z.string().optional(),
  category: z.enum(CHAT_CATEGORIES).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const patchIntentSchema = z.object({
  category: z.enum(CHAT_CATEGORIES),
  comment: z.string().max(500).optional(),
});

export const chatMessageRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/chat-messages — メッセージ一覧（フィルタリング・スレッド構造付き）
// ---------------------------------------------------------------------------
chatMessageRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { spaceId, messageType, threadName, category, limit, offset } = c.req.valid("query");
  const { limit: lim, offset: off } = parsePagination({ limit, offset });
  const actorRole = c.get("actorRole");

  // HR スタッフ以上のみ閲覧可
  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let query = collections.chatMessages.orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (spaceId) {
    query = query.where("spaceId", "==", spaceId);
  }
  if (messageType) {
    query = query.where("messageType", "==", messageType);
  }
  if (threadName) {
    query = query.where("threadName", "==", threadName);
  }

  const snapshot = await query
    .limit(lim + 1)
    .offset(off)
    .get();
  const hasMore = snapshot.docs.length > lim;
  const docs = snapshot.docs.slice(0, lim);

  // 各メッセージに対して IntentRecord を JOIN（N+1 だが Firestore では一般的）
  const items = await Promise.all(
    docs.map(async (doc) => {
      const msg = doc.data();

      // category フィルタが指定されている場合は IntentRecord 経由でフィルタリング
      const intentSnap = await collections.intentRecords
        .where("chatMessageId", "==", doc.id)
        .limit(1)
        .get();
      const intent = intentSnap.docs[0]?.data() ?? null;

      if (category && intent?.category !== category) {
        return null; // フィルタ外
      }

      return {
        id: doc.id,
        spaceId: msg.spaceId,
        googleMessageId: msg.googleMessageId,
        senderUserId: msg.senderUserId,
        senderName: msg.senderName,
        senderType: msg.senderType,
        content: msg.content,
        formattedContent: msg.formattedContent ?? null,
        messageType: msg.messageType,
        threadName: msg.threadName ?? null,
        parentMessageId: msg.parentMessageId ?? null,
        mentionedUsers: msg.mentionedUsers ?? [],
        annotations: msg.annotations ?? [],
        attachments: msg.attachments ?? [],
        isEdited: msg.isEdited ?? false,
        isDeleted: msg.isDeleted ?? false,
        processedAt: toISOOrNull(msg.processedAt),
        createdAt: toISO(msg.createdAt),
        intent: intent
          ? {
              id: intentSnap.docs[0]?.id ?? "",
              category: intent.category as ChatCategory,
              confidenceScore: intent.confidenceScore,
              classificationMethod: intent.classificationMethod ?? "ai",
              regexPattern: intent.regexPattern ?? null,
              isManualOverride: intent.isManualOverride ?? false,
              originalCategory: intent.originalCategory ?? null,
              responseStatus: intent.responseStatus ?? "unresponded",
              createdAt: toISO(intent.createdAt),
            }
          : null,
      };
    }),
  );

  const filtered = items.filter(Boolean);

  return c.json({
    data: filtered,
    pagination: {
      limit: lim,
      offset: off,
      hasMore,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/chat-messages/:id — メッセージ詳細
// ---------------------------------------------------------------------------
chatMessageRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const actorRole = c.get("actorRole");

  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const docSnap = await collections.chatMessages.doc(id).get();
  if (!docSnap.exists) throw notFound("ChatMessage", id);

  const msg = docSnap.data()!;

  // IntentRecord
  const intentSnap = await collections.intentRecords
    .where("chatMessageId", "==", id)
    .limit(1)
    .get();
  const intentDoc = intentSnap.docs[0];
  const intent = intentDoc?.data() ?? null;

  // スレッド内の他メッセージ（threadName がある場合）
  let threadMessages: unknown[] = [];
  if (msg.threadName) {
    const threadSnap = await collections.chatMessages
      .where("threadName", "==", msg.threadName)
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    threadMessages = threadSnap.docs
      .filter((d) => d.id !== id)
      .map((d) => ({
        id: d.id,
        senderName: d.data().senderName,
        content: d.data().content,
        messageType: d.data().messageType,
        createdAt: toISO(d.data().createdAt),
      }));
  }

  return c.json({
    id: docSnap.id,
    spaceId: msg.spaceId,
    googleMessageId: msg.googleMessageId,
    senderUserId: msg.senderUserId,
    senderName: msg.senderName,
    senderType: msg.senderType,
    content: msg.content,
    formattedContent: msg.formattedContent ?? null,
    messageType: msg.messageType,
    threadName: msg.threadName ?? null,
    parentMessageId: msg.parentMessageId ?? null,
    mentionedUsers: msg.mentionedUsers ?? [],
    annotations: msg.annotations ?? [],
    attachments: msg.attachments ?? [],
    isEdited: msg.isEdited ?? false,
    isDeleted: msg.isDeleted ?? false,
    rawPayload: msg.rawPayload ?? null,
    processedAt: toISOOrNull(msg.processedAt),
    createdAt: toISO(msg.createdAt),
    intent: intent
      ? {
          id: intentDoc?.id,
          category: intent.category,
          confidenceScore: intent.confidenceScore,
          classificationMethod: intent.classificationMethod ?? "ai",
          regexPattern: intent.regexPattern ?? null,
          reasoning: intent.llmOutput ?? null,
          isManualOverride: intent.isManualOverride ?? false,
          originalCategory: intent.originalCategory ?? null,
          overriddenBy: intent.overriddenBy ?? null,
          overriddenAt: toISOOrNull(intent.overriddenAt),
          responseStatus: intent.responseStatus ?? "unresponded",
          responseStatusUpdatedBy: intent.responseStatusUpdatedBy ?? null,
          responseStatusUpdatedAt: toISOOrNull(intent.responseStatusUpdatedAt),
          createdAt: toISO(intent.createdAt),
        }
      : null,
    threadMessages,
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/chat-messages/:id/intent — 手動再分類
// ---------------------------------------------------------------------------
chatMessageRoutes.patch("/:id/intent", zValidator("json", patchIntentSchema), async (c) => {
  const chatMessageId = c.req.param("id");
  const { category, comment } = c.req.valid("json");
  const actor = c.get("user");
  const actorRole = c.get("actorRole");

  // HR スタッフ以上のみ再分類可
  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // ChatMessage 存在確認
  const msgSnap = await collections.chatMessages.doc(chatMessageId).get();
  if (!msgSnap.exists) throw notFound("ChatMessage", chatMessageId);

  // 既存の IntentRecord を取得
  const intentSnap = await collections.intentRecords
    .where("chatMessageId", "==", chatMessageId)
    .limit(1)
    .get();

  await db.runTransaction(async (tx) => {
    if (!intentSnap.empty) {
      // 既存レコードを更新
      const existingDoc = intentSnap.docs[0]!;
      const intentRef = existingDoc.ref;
      const current = existingDoc.data();
      tx.update(intentRef, {
        category,
        classificationMethod: "manual",
        isManualOverride: true,
        originalCategory: current.isManualOverride
          ? current.originalCategory // 2回目以降は最初のオリジナルを保持
          : current.category,
        overriddenBy: actor.email,
        overriddenAt: FieldValue.serverTimestamp(),
      });
    } else {
      // IntentRecord がない場合は新規作成
      const intentRef = collections.intentRecords.doc();
      tx.set(intentRef, {
        chatMessageId,
        category,
        confidenceScore: 1.0,
        extractedParams: null,
        classificationMethod: "manual",
        regexPattern: null,
        llmInput: null,
        llmOutput: comment ?? null,
        isManualOverride: true,
        originalCategory: null,
        overriddenBy: actor.email,
        overriddenAt: FieldValue.serverTimestamp() as never,
        responseStatus: "unresponded",
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
        createdAt: FieldValue.serverTimestamp() as never,
      });
    }

    // 監査ログ
    const auditRef = collections.auditLogs.doc();
    tx.set(auditRef, {
      eventType: "intent_classified",
      entityType: "intent_record",
      entityId: intentSnap.docs[0]?.id ?? "new",
      actorEmail: actor.email,
      actorRole: actorRole,
      details: {
        chatMessageId,
        newCategory: category,
        method: "manual",
        comment: comment ?? null,
      },
      createdAt: FieldValue.serverTimestamp() as never,
    });
  });

  return c.json({ success: true, chatMessageId, category });
});

// ---------------------------------------------------------------------------
// PATCH /api/chat-messages/:id/response-status — 対応状況更新
// ---------------------------------------------------------------------------
const patchResponseStatusSchema = z.object({
  responseStatus: z.enum(RESPONSE_STATUSES),
});

chatMessageRoutes.patch(
  "/:id/response-status",
  zValidator("json", patchResponseStatusSchema),
  async (c) => {
    const chatMessageId = c.req.param("id");
    const { responseStatus } = c.req.valid("json");
    const actor = c.get("user");
    const actorRole = c.get("actorRole");

    if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const msgSnap = await collections.chatMessages.doc(chatMessageId).get();
    if (!msgSnap.exists) throw notFound("ChatMessage", chatMessageId);

    const intentSnap = await collections.intentRecords
      .where("chatMessageId", "==", chatMessageId)
      .limit(1)
      .get();

    if (intentSnap.empty) {
      return c.json({ error: "IntentRecord not found" }, 404);
    }

    const intentDoc = intentSnap.docs[0]!;

    await db.runTransaction(async (tx) => {
      tx.update(intentDoc.ref, {
        responseStatus,
        responseStatusUpdatedBy: actor.email,
        responseStatusUpdatedAt: FieldValue.serverTimestamp(),
      });

      const auditRef = collections.auditLogs.doc();
      tx.set(auditRef, {
        eventType: "response_status_updated",
        entityType: "intent_record",
        entityId: intentDoc.id,
        actorEmail: actor.email,
        actorRole: actorRole,
        details: { chatMessageId, responseStatus },
        createdAt: FieldValue.serverTimestamp() as never,
      });
    });

    return c.json({ success: true, chatMessageId, responseStatus });
  },
);
