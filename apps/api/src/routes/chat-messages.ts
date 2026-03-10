import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import {
  CHAT_CATEGORIES,
  type ChatCategory,
  RESPONSE_STATUSES,
  TASK_PRIORITIES,
  WORKFLOW_STEP_STATUSES,
  type WorkflowSteps,
} from "@hr-system/shared";
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { clearCache, getCached, setCache, TTL } from "../lib/cache.js";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO, toISOOrNull } from "../lib/serialize.js";

const listQuerySchema = z.object({
  spaceId: z.string().optional(),
  messageType: z.enum(["MESSAGE", "THREAD_REPLY"]).optional(),
  threadName: z.string().optional(),
  category: z.enum(CHAT_CATEGORIES).optional(),
  responseStatus: z.enum(RESPONSE_STATUSES).optional(),
  maxConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const patchIntentSchema = z.object({
  category: z.enum(CHAT_CATEGORIES),
  comment: z.string().max(500).optional(),
});

export const chatMessageRoutes = new Hono();

/** chatSpaces の displayName マップを取得（キャッシュ付き） */
async function getSpaceDisplayNameMap(): Promise<Map<string, string>> {
  const CACHE_KEY = "space-display-name-map";
  const cached = getCached<Map<string, string>>(CACHE_KEY);
  if (cached) return cached;
  const snap = await collections.chatSpaces.get();
  const map = new Map<string, string>();
  for (const doc of snap.docs) {
    const d = doc.data();
    map.set(d.spaceId, d.displayName);
  }
  setCache(CACHE_KEY, map, TTL.STATS);
  return map;
}

// ---------------------------------------------------------------------------
// GET /api/chat-messages — メッセージ一覧（フィルタリング・スレッド構造付き）
// ---------------------------------------------------------------------------
chatMessageRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const {
    spaceId,
    messageType,
    threadName,
    category,
    responseStatus,
    maxConfidence,
    limit,
    offset,
  } = c.req.valid("query");
  const { limit: lim, offset: off } = parsePagination({ limit, offset });
  const actorRole = c.get("actorRole");

  // HR スタッフ以上のみ閲覧可
  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const spaceNameMap = await getSpaceDisplayNameMap();

  // Intent 系フィルタ（別コレクション依存のため Firestore クエリ不可）
  const hasIntentFilter =
    category !== undefined || responseStatus !== undefined || maxConfidence !== undefined;

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

  // ---- Intent フィルタあり: IntentRecords → ChatMessages の逆引き ----
  if (hasIntentFilter) {
    // ChatMessage レベルのポストフィルタが不要か判定
    const hasChatFilter =
      spaceId !== undefined || messageType !== undefined || threadName !== undefined;
    // Firestore ページネーション可能: ChatMessage フィルタなし & maxConfidence なし
    const canPaginateAtFirestore = !hasChatFilter && maxConfidence === undefined;

    // 1. IntentRecords をネイティブフィルタでクエリ
    let intentQuery = collections.intentRecords as FirebaseFirestore.Query;
    if (category) {
      intentQuery = intentQuery.where("category", "==", category);
    }
    if (responseStatus) {
      intentQuery = intentQuery.where("responseStatus", "==", responseStatus);
    }

    let intentDocs: FirebaseFirestore.QueryDocumentSnapshot[];

    if (canPaginateAtFirestore) {
      // Firestore レベルでページネーション（O(page_size)）
      intentQuery = intentQuery.orderBy("createdAt", "desc");
      const intentSnapshot = await intentQuery
        .limit(lim + 1)
        .offset(off)
        .get();
      intentDocs = intentSnapshot.docs;
    } else {
      // 全件取得 → ポストフィルタ（従来パス）
      const intentSnapshot = await intentQuery.get();
      intentDocs = intentSnapshot.docs;
      if (maxConfidence !== undefined) {
        intentDocs = intentDocs.filter((d) => d.data().confidenceScore < maxConfidence);
      }
    }

    if (intentDocs.length === 0) {
      return c.json({
        data: [],
        pagination: { limit: lim, offset: off, hasMore: false },
      });
    }

    // hasMore 判定 & ページ切り出し（Firestore ページネーション時）
    let hasMore = false;
    if (canPaginateAtFirestore) {
      hasMore = intentDocs.length > lim;
      intentDocs = intentDocs.slice(0, lim);
    }

    // 2. intentByMsgId マップ構築
    const intentByMsgId = new Map<
      string,
      { id: string; data: ReturnType<(typeof intentDocs)[0]["data"]> }
    >();
    for (const d of intentDocs) {
      const iData = d.data();
      intentByMsgId.set(iData.chatMessageId, { id: d.id, data: iData });
    }

    // 3. ChatMessages をバッチフェッチ（FieldPath.documentId() "in", 30件ずつ、最大5並列）
    const chatMessageIds = [...intentByMsgId.keys()];
    const chatDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const chunks: string[][] = [];
    for (let i = 0; i < chatMessageIds.length; i += 30) {
      chunks.push(chatMessageIds.slice(i, i + 30));
    }
    const BATCH_CONCURRENCY = 5;
    for (let i = 0; i < chunks.length; i += BATCH_CONCURRENCY) {
      const batch = chunks.slice(i, i + BATCH_CONCURRENCY);
      const results = await Promise.all(
        batch.map((chunk) =>
          collections.chatMessages.where(FieldPath.documentId(), "in", chunk).get(),
        ),
      );
      for (const snap of results) {
        chatDocs.push(...snap.docs);
      }
    }

    if (!canPaginateAtFirestore) {
      // 4. ChatMessage レベルフィルタ（従来パス）
      let filteredDocs = chatDocs;
      if (spaceId) {
        filteredDocs = filteredDocs.filter((d) => d.data().spaceId === spaceId);
      }
      if (messageType) {
        filteredDocs = filteredDocs.filter((d) => d.data().messageType === messageType);
      }
      if (threadName) {
        filteredDocs = filteredDocs.filter((d) => d.data().threadName === threadName);
      }

      // 5. createdAt desc でソート
      filteredDocs.sort((a, b) => {
        const aTime = a.data().createdAt?.toMillis?.() ?? 0;
        const bTime = b.data().createdAt?.toMillis?.() ?? 0;
        if (bTime !== aTime) return bTime - aTime;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

      // 6. ページネーション
      const paged = filteredDocs.slice(off, off + lim);
      hasMore = off + lim < filteredDocs.length;

      const data = paged.map((doc) => {
        const msg = doc.data();
        const intentEntry = intentByMsgId.get(doc.id);
        const intent = intentEntry?.data ?? null;
        return {
          id: doc.id,
          spaceId: msg.spaceId,
          spaceDisplayName: spaceNameMap.get(msg.spaceId) ?? null,
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
                taskPriority: intent.taskPriority ?? null,
                taskSummary: intent.taskSummary ?? null,
                assignees: intent.assignees ?? null,
                deadline: toISOOrNull(intent.deadline),
                notes: intent.notes ?? null,
                workflowSteps: intent.workflowSteps ?? null,
                workflowUpdatedBy: intent.workflowUpdatedBy ?? null,
                workflowUpdatedAt: toISOOrNull(intent.workflowUpdatedAt),
                createdAt: toISO(intent.createdAt),
              }
            : null,
        };
      });

      return c.json({
        data,
        pagination: { limit: lim, offset: off, hasMore },
      });
    }
    // Firestore ページネーションパス: intentDocs の createdAt desc 順に並べ替え
    // （in クエリはドキュメントID順で返すため）
    const idOrder = new Map(chatMessageIds.map((id, i) => [id, i]));
    chatDocs.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
    const data = chatDocs.map((doc) => {
      const msg = doc.data();
      const intentEntry = intentByMsgId.get(doc.id);
      const intent = intentEntry?.data ?? null;
      return {
        id: doc.id,
        spaceId: msg.spaceId,
        spaceDisplayName: spaceNameMap.get(msg.spaceId) ?? null,
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
              taskPriority: intent.taskPriority ?? null,
              taskSummary: intent.taskSummary ?? null,
              assignees: intent.assignees ?? null,
              deadline: toISOOrNull(intent.deadline),
              notes: intent.notes ?? null,
              workflowSteps: intent.workflowSteps ?? null,
              workflowUpdatedBy: intent.workflowUpdatedBy ?? null,
              workflowUpdatedAt: toISOOrNull(intent.workflowUpdatedAt),
              createdAt: toISO(intent.createdAt),
            }
          : null,
      };
    });

    return c.json({
      data,
      pagination: { limit: lim, offset: off, hasMore },
    });
  }

  // ---- Intent フィルタなし: Firestore レベルでページング（従来どおり） ----
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
      responseStatus &&
      (intent == null || (intent.responseStatus ?? "unresponded") !== responseStatus)
    ) {
      return null; // 対応状況フィルタ外
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
            taskPriority: intent.taskPriority ?? null,
            taskSummary: intent.taskSummary ?? null,
            assignees: intent.assignees ?? null,
            deadline: toISOOrNull(intent.deadline),
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
// GET /api/chat-messages/inbox-counts — 対応状況別件数（Inboxバッジ用）
// ---------------------------------------------------------------------------
chatMessageRoutes.get("/inbox-counts", async (c) => {
  const actorRole = c.get("actorRole");
  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const CACHE_KEY = "inbox-counts:chat";
  const cached = getCached<{ counts: Record<string, number> }>(CACHE_KEY);
  if (cached) return c.json(cached);

  const results = await Promise.all(
    RESPONSE_STATUSES.map((s) =>
      collections.intentRecords
        .where("responseStatus", "==", s)
        .count()
        .get()
        .then((snap) => snap.data().count),
    ),
  );
  const counts = Object.fromEntries(RESPONSE_STATUSES.map((s, i) => [s, results[i] ?? 0]));

  const result = { counts };
  setCache(CACHE_KEY, result, TTL.INBOX_COUNTS);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// GET /api/chat-messages/:id — メッセージ詳細
// ---------------------------------------------------------------------------
chatMessageRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const actorRole = c.get("actorRole");

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const [spaceNameMap, docSnap] = await Promise.all([
    getSpaceDisplayNameMap(),
    collections.chatMessages.doc(id).get(),
  ]);
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
    spaceDisplayName: spaceNameMap.get(msg.spaceId) ?? null,
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
          taskPriority: intent.taskPriority ?? null,
          taskSummary: intent.taskSummary ?? null,
          assignees: intent.assignees ?? null,
          deadline: toISOOrNull(intent.deadline),
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
  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
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
        taskPriority: null,
        taskSummary: null,
        assignees: null,
        deadline: null,
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
  clearCache("inbox-counts:");

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

    if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const msgSnap = await collections.chatMessages.doc(chatMessageId).get();
    if (!msgSnap.exists) throw notFound("ChatMessage", chatMessageId);

    const intentSnap = await collections.intentRecords
      .where("chatMessageId", "==", chatMessageId)
      .limit(1)
      .get();

    await db.runTransaction(async (tx) => {
      let intentDocId: string;
      if (intentSnap.empty) {
        // IntentRecord がなければ新規作成（テーブルビューから直接更新するケース）
        const intentRef = collections.intentRecords.doc();
        intentDocId = intentRef.id;
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
          responseStatus,
          responseStatusUpdatedBy: actor.email,
          responseStatusUpdatedAt: FieldValue.serverTimestamp() as never,
          taskPriority: null,
          taskSummary: null,
          assignees: null,
          deadline: null,
          notes: null,
          workflowSteps: null,
          workflowUpdatedBy: null,
          workflowUpdatedAt: null,
          createdAt: FieldValue.serverTimestamp() as never,
        });
      } else {
        // biome-ignore lint/style/noNonNullAssertion: intentSnap.empty checked above
        const intentDoc = intentSnap.docs[0]!;
        intentDocId = intentDoc.id;
        tx.update(intentDoc.ref, {
          responseStatus,
          responseStatusUpdatedBy: actor.email,
          responseStatusUpdatedAt: FieldValue.serverTimestamp(),
        });
      }

      const auditRef = collections.auditLogs.doc();
      tx.set(auditRef, {
        eventType: "response_status_updated",
        entityType: "intent_record",
        entityId: intentDocId,
        actorEmail: actor.email,
        actorRole: actorRole,
        details: { chatMessageId, responseStatus },
        createdAt: FieldValue.serverTimestamp() as never,
      });
    });

    clearCache("inbox-counts:");
    return c.json({ success: true, chatMessageId, responseStatus });
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/chat-messages/:id/workflow — 「作成案」ワークフロー管理フィールド更新
// ---------------------------------------------------------------------------
const workflowStepStatusSchema = z.enum(WORKFLOW_STEP_STATUSES);

const patchWorkflowSchema = z.object({
  taskPriority: z.enum(TASK_PRIORITIES).nullable().optional(),
  taskSummary: z.string().max(500).nullable().optional(),
  assignees: z.string().max(200).nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
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

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
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
  if (body.taskPriority !== undefined) updates.taskPriority = body.taskPriority;
  if (body.taskSummary !== undefined) updates.taskSummary = body.taskSummary;
  if (body.assignees !== undefined) updates.assignees = body.assignees;
  if (body.deadline !== undefined)
    updates.deadline = body.deadline ? Timestamp.fromDate(new Date(body.deadline)) : null;
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
        taskPriority: body.taskPriority ?? null,
        taskSummary: body.taskSummary ?? null,
        assignees: body.assignees ?? null,
        deadline: body.deadline ? Timestamp.fromDate(new Date(body.deadline)) : null,
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

  clearCache("inbox-counts:");
  return c.json({ success: true, chatMessageId });
});
