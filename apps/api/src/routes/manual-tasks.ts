import { zValidator } from "@hono/zod-validator";
import type { ManualTask } from "@hr-system/db";
import { collections } from "@hr-system/db";
import { RESPONSE_STATUSES, TASK_PRIORITIES } from "@hr-system/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { forbidden, notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { workflowStepsSchema } from "../lib/schemas.js";
import { toISO, toISOOrNull } from "../lib/serialize.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(2000).optional().default(""),
  taskPriority: z.enum(TASK_PRIORITIES),
  responseStatus: z.enum(RESPONSE_STATUSES).optional().default("unresponded"),
  assignees: z.string().max(200).nullable().optional().default(null),
  deadline: z.string().datetime({ offset: true }).nullable().optional().default(null),
});

const updateSchema = z
  .object({
    title: z.string().min(1).max(200),
    content: z.string().max(2000),
    taskPriority: z.enum(TASK_PRIORITIES),
    responseStatus: z.enum(RESPONSE_STATUSES),
    assignees: z.string().max(200).nullable(),
    deadline: z.string().datetime({ offset: true }).nullable(),
    notes: z.string().max(2000).nullable(),
    workflowSteps: workflowStepsSchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "更新するフィールドを1つ以上指定してください",
  });

const listQuerySchema = z.object({
  taskPriority: z.enum(TASK_PRIORITIES).optional(),
  responseStatus: z.enum(RESPONSE_STATUSES).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

function serialize(id: string, data: ManualTask) {
  return {
    id,
    title: data.title,
    content: data.content,
    taskPriority: data.taskPriority,
    responseStatus: data.responseStatus,
    assignees: data.assignees,
    deadline: toISOOrNull(data.deadline),
    workflowSteps: data.workflowSteps ?? null,
    notes: data.notes ?? null,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

const app = new Hono();

// GET /api/manual-tasks
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { taskPriority, responseStatus } = c.req.valid("query");
  const { limit, offset } = parsePagination(c.req.query());

  let query = collections.manualTasks.orderBy(
    "createdAt",
    "desc",
  ) as FirebaseFirestore.Query<ManualTask>;
  if (taskPriority) query = query.where("taskPriority", "==", taskPriority);
  if (responseStatus) query = query.where("responseStatus", "==", responseStatus);

  const [countSnap, docsSnap] = await Promise.all([
    query.count().get(),
    query.limit(limit).offset(offset).get(),
  ]);

  const total = countSnap.data().count;
  const tasks = docsSnap.docs.map((doc) => serialize(doc.id, doc.data()));

  return c.json({ data: tasks, total, limit, offset });
});

// POST /api/manual-tasks
app.post("/", zValidator("json", createSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  const actorRole = c.get("actorRole");

  if (!actorRole) {
    forbidden("閲覧専用ユーザーはタスクを作成できません");
  }

  const docRef = await collections.manualTasks.add({
    title: data.title,
    content: data.content,
    taskPriority: data.taskPriority,
    responseStatus: data.responseStatus,
    assignees: data.assignees,
    deadline: data.deadline ? Timestamp.fromDate(new Date(data.deadline)) : null,
    createdBy: user.email,
    createdByName: user.name ?? user.email,
    createdAt: FieldValue.serverTimestamp() as never,
    updatedAt: FieldValue.serverTimestamp() as never,
  });

  await collections.auditLogs.add({
    eventType: "manual_task_created",
    entityType: "ManualTask",
    entityId: docRef.id,
    actorEmail: user.email,
    actorRole,
    details: { title: data.title, taskPriority: data.taskPriority },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  const created = await docRef.get();
  return c.json(serialize(docRef.id, created.data() as ManualTask), 201);
});

// GET /api/manual-tasks/:id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const docSnap = await collections.manualTasks.doc(id).get();
  if (!docSnap.exists) notFound("ManualTask", id);

  return c.json(serialize(id, docSnap.data() as ManualTask));
});

// PATCH /api/manual-tasks/:id
app.patch("/:id", zValidator("json", updateSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const user = c.get("user");
  const actorRole = c.get("actorRole");

  if (!actorRole) {
    forbidden("閲覧専用ユーザーはタスクを修正できません");
  }

  const docRef = collections.manualTasks.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) notFound("ManualTask", id);

  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.content !== undefined) updateData.content = body.content;
  if (body.taskPriority !== undefined) updateData.taskPriority = body.taskPriority;
  if (body.responseStatus !== undefined) updateData.responseStatus = body.responseStatus;
  if (body.assignees !== undefined) updateData.assignees = body.assignees;
  if (body.deadline !== undefined)
    updateData.deadline = body.deadline ? Timestamp.fromDate(new Date(body.deadline)) : null;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.workflowSteps !== undefined) {
    updateData.workflowSteps = body.workflowSteps;
    updateData.workflowUpdatedBy = user.email;
    updateData.workflowUpdatedAt = FieldValue.serverTimestamp();
  }

  await docRef.update(updateData);

  await collections.auditLogs.add({
    eventType: "manual_task_updated",
    entityType: "ManualTask",
    entityId: id,
    actorEmail: user.email,
    actorRole,
    details: body,
    createdAt: FieldValue.serverTimestamp() as never,
  });

  const updated = await docRef.get();
  return c.json(serialize(id, updated.data() as ManualTask));
});

// DELETE /api/manual-tasks/:id
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const actorRole = c.get("actorRole");

  if (!actorRole) {
    forbidden("閲覧専用ユーザーはタスクを削除できません");
  }

  const docRef = collections.manualTasks.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) notFound("ManualTask", id);

  await docRef.delete();

  await collections.auditLogs.add({
    eventType: "manual_task_deleted",
    entityType: "ManualTask",
    entityId: id,
    actorEmail: user.email,
    actorRole,
    details: { title: (doc.data() as ManualTask).title },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});

export { app as manualTaskRoutes };
