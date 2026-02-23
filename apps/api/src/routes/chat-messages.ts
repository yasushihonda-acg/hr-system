import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import {
  CHAT_CATEGORIES,
  type ChatCategory,
  RESPONSE_STATUSES,
  WORKFLOW_STEP_STATUSES,
  type WorkflowSteps,
} from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { clearCache } from "../lib/cache.js";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO, toISOOrNull } from "../lib/serialize.js";

const listQuerySchema = z.object({
  spaceId: z.string().optional(),
  messageType: z.enum(["MESSAGE", "THREAD_REPLY"]).optional(),
  threadName: z.string().optional(),
  category: z.enum(CHAT_CATEGORIES).optional(),
  maxConfidence: z.coerce.number().min(0).max(1).optional(),
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
  const { spaceId, messageType, threadName, category, maxConfidence, limit, offset } =
    c.req.valid("query");
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

  // IntentRecord を一括取得（N+1 → バッチクエリ）
  // Firestore の "in" は最大30件。ページサイズが30超の場合はチャンク処理
  const intentByMsgId = new Map<
    string,
    { id: string; data: ReturnType<(typeof docs)[0]["data"]> }
  >();
  if (docs.length > 0) {
    const docIds = docs.map((d) => d.id);
    const chunks: string[][] = [];
    for (let i = 0; i < docIds.length; i += 30) {
      chunks.push(docIds.slice(i, i + 30));
    }
    await Promise.all(
      chunks.map(async (chunk) => {
        const intentSnap = await collections.intentRecords
          .where("chatMessageId", "in", chunk)
          .get();
        for (const d of intentSnap.docs) {
          intentByMsgId.set(d.data().chatMessageId, { id: d.id, data: d.data() });
        }
      }),
    );
  }

  const items = docs.map((doc) => {
    const msg = doc.data();
    const intentEntry = intentByMsgId.get(doc.id);
    const intent = intentEntry?.data ?? null;

    if (category && intent?.category !== category) {
      return null; // フィルタ外
    }
    if (
      maxConfidence !== undefined &&
      (intent == null || intent.confidenceScore >= maxConfidence)
    ) {
      return null; // 信頼度フィルタ外（maxConfidence 未満のみ通過）
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
            id: intentEntry?.id ?? "",
            category: intent.category as ChatCategory,
            confidenceScore: intent.confidenceScore,
            classificationMethod: intent.classificationMethod ?? "ai",
            regexPattern: intent.regexPattern ?? null,
            isManualOverride: intent.isManualOverride ?? false,
            originalCategory: intent.originalCategory ?? null,
            responseStatus: intent.responseStatus ?? "unresponded",
            taskSummary: intent.taskSummary ?? null,
            assignees: intent.assignees ?? null,
            notes: intent.notes ?? null,
            workflowSteps: intent.workflowSteps ?? null,
            workflowUpdatedBy: intent.workflowUpdatedBy ?? null,
            workflowUpdatedAt: toISOOrNull(intent.workflowUpdatedAt),
            createdAt: toISO(intent.createdAt),
          }
        : null,
    };
  });

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

  // biome-ignore lint/style/noNonNullAssertion: docSnap.exists checked above
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
        formattedContent: d.data().formattedContent ?? null,
        messageType: d.data().messageType,
        mentionedUsers: d.data().mentionedUsers ?? [],
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
          taskSummary: intent.taskSummary ?? null,
          assignees: intent.assignees ?? null,
          notes: intent.notes ?? null,
          workflowSteps: intent.workflowSteps ?? null,
          workflowUpdatedBy: intent.workflowUpdatedBy ?? null,
          workflowUpdatedAt: toISOOrNull(intent.workflowUpdatedAt),
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
      // biome-ignore lint/style/noNonNullAssertion: intentSnap.empty checked above
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
        taskSummary: null,
        assignees: null,
        notes: null,
        workflowSteps: null,
        workflowUpdatedBy: null,
        workflowUpdatedAt: null,
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

  // 手動再分類後は統計キャッシュを無効化
  clearCache("intent-stats:");
  clearCache("stats:categories");

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

    // biome-ignore lint/style/noNonNullAssertion: intentSnap.empty checked above
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

// ---------------------------------------------------------------------------
// PATCH /api/chat-messages/:id/workflow — 「作成案」ワークフロー管理フィールド更新
// ---------------------------------------------------------------------------
const workflowStepStatusSchema = z.enum(WORKFLOW_STEP_STATUSES);

const patchWorkflowSchema = z.object({
  taskSummary: z.string().max(500).nullable().optional(),
  assignees: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  workflowSteps: z
    .object({
      salaryListReflection: workflowStepStatusSchema,
      noticeExecution: workflowStepStatusSchema,
      laborLawyerShare: workflowStepStatusSchema,
      smartHRReflection: workflowStepStatusSchema,
    })
    .optional(),
});

chatMessageRoutes.patch("/:id/workflow", zValidator("json", patchWorkflowSchema), async (c) => {
  const chatMessageId = c.req.param("id");
  const body = c.req.valid("json");
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

  const updates: Record<string, unknown> = {
    workflowUpdatedBy: actor.email,
    workflowUpdatedAt: FieldValue.serverTimestamp(),
  };
  if (body.taskSummary !== undefined) updates.taskSummary = body.taskSummary;
  if (body.assignees !== undefined) updates.assignees = body.assignees;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.workflowSteps !== undefined) updates.workflowSteps = body.workflowSteps;

  await db.runTransaction(async (tx) => {
    if (!intentSnap.empty) {
      // biome-ignore lint/style/noNonNullAssertion: intentSnap.empty checked above
      tx.update(intentSnap.docs[0]!.ref, updates);
    } else {
      // IntentRecord がなければ新規作成
      const intentRef = collections.intentRecords.doc();
      tx.set(intentRef, {
        chatMessageId,
        category: "other" as ChatCategory,
        confidenceScore: 0,
        extractedParams: null,
        classificationMethod: "manual",
        regexPattern: null,
        llmInput: null,
        llmOutput: null,
        isManualOverride: false,
        originalCategory: null,
        overriddenBy: null,
        overriddenAt: null,
        responseStatus: "unresponded",
        responseStatusUpdatedBy: null,
        responseStatusUpdatedAt: null,
        taskSummary: body.taskSummary ?? null,
        assignees: body.assignees ?? null,
        notes: body.notes ?? null,
        workflowSteps: (body.workflowSteps as WorkflowSteps) ?? null,
        workflowUpdatedBy: actor.email,
        workflowUpdatedAt: FieldValue.serverTimestamp() as never,
        createdAt: FieldValue.serverTimestamp() as never,
      });
    }

    const auditRef = collections.auditLogs.doc();
    tx.set(auditRef, {
      eventType: "response_status_updated",
      entityType: "intent_record",
      entityId: intentSnap.docs[0]?.id ?? "new",
      actorEmail: actor.email,
      actorRole: actorRole,
      details: { chatMessageId, workflowUpdates: body },
      createdAt: FieldValue.serverTimestamp() as never,
    });
  });

  return c.json({ success: true, chatMessageId });
});
