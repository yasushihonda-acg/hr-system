import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { RESPONSE_STATUSES, TASK_PRIORITIES } from "@hr-system/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { clearCache, getCached, setCache, TTL } from "../lib/cache.js";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { workflowStepsSchema } from "../lib/schemas.js";
import { toISO } from "../lib/serialize.js";

const listQuerySchema = z.object({
  groupId: z.string().optional(),
  responseStatus: z.enum(RESPONSE_STATUSES).optional(),
  hasTaskPriority: z.enum(["true"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const lineMessageRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/line-messages — LINE メッセージ一覧
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { groupId, responseStatus, hasTaskPriority, limit, offset } = c.req.valid("query");
  const { limit: lim, offset: off } = parsePagination({ limit, offset });
  const actorRole = c.get("actorRole");

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // hasTaskPriority フィルタ: in + orderBy は複合インデックスが必要なため
  // 別パスでクエリしメモリ内でソート・ページネーション
  if (hasTaskPriority) {
    let tpQuery = collections.lineMessages.where("taskPriority", "in", [
      ...TASK_PRIORITIES,
    ]) as FirebaseFirestore.Query;
    if (groupId) tpQuery = tpQuery.where("groupId", "==", groupId);
    if (responseStatus) tpQuery = tpQuery.where("responseStatus", "==", responseStatus);

    const tpSnap = await tpQuery.limit(500).get();
    const allDocs = tpSnap.docs.sort((a, b) => {
      const aTime = (a.data().createdAt as FirebaseFirestore.Timestamp)?.toMillis?.() ?? 0;
      const bTime = (b.data().createdAt as FirebaseFirestore.Timestamp)?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    const paged = allDocs.slice(off, off + lim);
    const hasMore = off + lim < allDocs.length;

    const data = paged.map((doc) => {
      const msg = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        groupId: msg.groupId as string,
        groupName: (msg.groupName as string) ?? null,
        senderUserId: msg.senderUserId as string,
        senderName: msg.senderName as string,
        content: msg.content as string,
        contentUrl: (msg.contentUrl as string) ?? null,
        lineMessageType: msg.lineMessageType as string,
        taskPriority: (msg.taskPriority as string) ?? null,
        assignees: (msg.assignees as string) ?? null,
        deadline: msg.deadline ? toISO(msg.deadline as FirebaseFirestore.Timestamp) : null,
        responseStatus: (msg.responseStatus as string) ?? "unresponded",
        workflowSteps: (msg.workflowSteps as Record<string, unknown>) ?? null,
        notes: (msg.notes as string) ?? null,
        createdAt: toISO(msg.createdAt as FirebaseFirestore.Timestamp),
      };
    });

    return c.json({
      data,
      pagination: { limit: lim, offset: off, hasMore },
    });
  }

  let query = collections.lineMessages.orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (groupId) {
    query = query.where("groupId", "==", groupId);
  }
  if (responseStatus) {
    query = query.where("responseStatus", "==", responseStatus);
  }

  const snapshot = await query
    .limit(lim + 1)
    .offset(off)
    .get();
  const hasMore = snapshot.docs.length > lim;
  const docs = snapshot.docs.slice(0, lim);

  const data = docs.map((doc) => {
    const msg = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      groupId: msg.groupId as string,
      groupName: (msg.groupName as string) ?? null,
      senderUserId: msg.senderUserId as string,
      senderName: msg.senderName as string,
      content: msg.content as string,
      contentUrl: (msg.contentUrl as string) ?? null,
      lineMessageType: msg.lineMessageType as string,
      taskPriority: (msg.taskPriority as string) ?? null,
      assignees: (msg.assignees as string) ?? null,
      deadline: msg.deadline ? toISO(msg.deadline as FirebaseFirestore.Timestamp) : null,
      responseStatus: (msg.responseStatus as string) ?? "unresponded",
      workflowSteps: (msg.workflowSteps as Record<string, unknown>) ?? null,
      notes: (msg.notes as string) ?? null,
      createdAt: toISO(msg.createdAt as FirebaseFirestore.Timestamp),
    };
  });

  return c.json({
    data,
    pagination: { limit: lim, offset: off, hasMore },
  });
});

// ---------------------------------------------------------------------------
// GET /api/line-messages/stats — グループ別統計
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/stats", async (c) => {
  const actorRole = c.get("actorRole");

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const snapshot = await collections.lineMessages.get();
  const groupCounts = new Map<string, { count: number; groupName: string | null }>();

  for (const doc of snapshot.docs) {
    const msg = doc.data();
    const existing = groupCounts.get(msg.groupId);
    if (existing) {
      existing.count++;
    } else {
      groupCounts.set(msg.groupId, { count: 1, groupName: msg.groupName });
    }
  }

  const groups = Array.from(groupCounts.entries()).map(([groupId, { count, groupName }]) => ({
    groupId,
    groupName,
    count,
  }));

  return c.json({ groups, total: snapshot.size });
});

// ---------------------------------------------------------------------------
// GET /api/line-messages/inbox-counts — 対応状況別件数
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/inbox-counts", async (c) => {
  const actorRole = c.get("actorRole");
  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const CACHE_KEY = "inbox-counts:line";
  const cached = getCached<{ counts: Record<string, number> }>(CACHE_KEY);
  if (cached) return c.json(cached);

  const results = await Promise.all(
    RESPONSE_STATUSES.map((s) =>
      collections.lineMessages
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
// GET /api/line-messages/:id — メッセージ詳細
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const actorRole = c.get("actorRole");

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const docSnap = await collections.lineMessages.doc(id).get();
  if (!docSnap.exists) throw notFound("LineMessage", id);

  // biome-ignore lint/style/noNonNullAssertion: docSnap.exists checked above
  const msg = docSnap.data()!;

  return c.json({
    id: docSnap.id,
    groupId: msg.groupId,
    groupName: msg.groupName,
    lineMessageId: msg.lineMessageId,
    senderUserId: msg.senderUserId,
    senderName: msg.senderName,
    content: msg.content,
    contentUrl: msg.contentUrl ?? null,
    lineMessageType: msg.lineMessageType,
    taskPriority: msg.taskPriority ?? null,
    assignees: msg.assignees ?? null,
    deadline: msg.deadline ? toISO(msg.deadline) : null,
    responseStatus: msg.responseStatus ?? "unresponded",
    responseStatusUpdatedBy: msg.responseStatusUpdatedBy ?? null,
    responseStatusUpdatedAt: msg.responseStatusUpdatedAt
      ? toISO(msg.responseStatusUpdatedAt)
      : null,
    rawPayload: msg.rawPayload,
    createdAt: toISO(msg.createdAt),
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/line-messages/:id/response-status — 対応状況更新
// ---------------------------------------------------------------------------
const updateStatusSchema = z.object({
  responseStatus: z.enum(RESPONSE_STATUSES),
});

lineMessageRoutes.patch(
  "/:id/response-status",
  zValidator("json", updateStatusSchema),
  async (c) => {
    const id = c.req.param("id");
    const { responseStatus } = c.req.valid("json");
    const actor = c.get("user");
    const actorRole = c.get("actorRole");

    if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const docRef = collections.lineMessages.doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw notFound("LineMessage", id);

    await docRef.update({
      responseStatus,
      responseStatusUpdatedBy: actor.email,
      responseStatusUpdatedAt: new Date(),
    });

    clearCache("inbox-counts:");
    return c.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/line-messages/:id/task-priority — タスク優先度更新
// ---------------------------------------------------------------------------
const updateTaskPrioritySchema = z.object({
  taskPriority: z.enum(TASK_PRIORITIES).nullable(),
});

lineMessageRoutes.patch(
  "/:id/task-priority",
  zValidator("json", updateTaskPrioritySchema),
  async (c) => {
    const id = c.req.param("id");
    const { taskPriority } = c.req.valid("json");
    const actorRole = c.get("actorRole");

    if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const docRef = collections.lineMessages.doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) throw notFound("LineMessage", id);

    await docRef.update({ taskPriority });

    return c.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/line-messages/:id/workflow — 担当者・期限更新
// ---------------------------------------------------------------------------
const updateWorkflowSchema = z
  .object({
    assignees: z.string().nullable().optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    workflowSteps: workflowStepsSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "更新するフィールドを1つ以上指定してください",
  });

lineMessageRoutes.patch("/:id/workflow", zValidator("json", updateWorkflowSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const actor = c.get("user");
  const actorRole = c.get("actorRole");

  if (!actorRole || !["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const docRef = collections.lineMessages.doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) throw notFound("LineMessage", id);

  const updates: Record<string, unknown> = {};
  if ("assignees" in body) {
    updates.assignees = body.assignees ?? null;
  }
  if ("deadline" in body) {
    updates.deadline = body.deadline ? Timestamp.fromDate(new Date(body.deadline)) : null;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }
  if (body.workflowSteps !== undefined) {
    updates.workflowSteps = body.workflowSteps;
    updates.workflowUpdatedBy = actor.email;
    updates.workflowUpdatedAt = FieldValue.serverTimestamp();
  }

  if (Object.keys(updates).length > 0) {
    await docRef.update(updates);
  }

  return c.json({ success: true });
});
