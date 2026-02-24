import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

const createSpaceSchema = z.object({
  spaceId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid spaceId format"),
  displayName: z.string().min(1).max(200),
});

const updateSpaceSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const chatSpaceRoutes = new Hono();

function requireAdmin(c: { get(key: "user"): { dashboardRole: string | null } }) {
  if (c.get("user").dashboardRole !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// GET /api/chat-spaces — チャットスペース一覧
// 認証済み全員: isActive: true のみ返す
// admin + ?all=true: 全件返す
chatSpaceRoutes.get("/", async (c) => {
  const showAll = c.req.query("all") === "true";

  if (showAll) {
    requireAdmin(c);
  }

  const baseQuery = collections.chatSpaces.orderBy("createdAt", "desc");
  const snapshot = showAll
    ? await baseQuery.get()
    : await baseQuery.where("isActive", "==", true).get();

  const spaces = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      spaceId: data.spaceId,
      displayName: data.displayName,
      isActive: data.isActive,
      addedBy: data.addedBy,
      updatedBy: data.updatedBy,
      createdAt: toISO(data.createdAt),
      updatedAt: toISO(data.updatedAt),
    };
  });

  return c.json({ data: spaces });
});

// POST /api/chat-spaces — チャットスペース追加（admin のみ）
chatSpaceRoutes.post("/", zValidator("json", createSpaceSchema), async (c) => {
  requireAdmin(c);
  const actor = c.get("user");
  const { spaceId, displayName } = c.req.valid("json");

  // 重複チェック
  const existing = await collections.chatSpaces.doc(spaceId).get();
  if (existing.exists) {
    return c.json({ error: "Chat space already exists" }, 409);
  }

  const now = Timestamp.now();
  await collections.chatSpaces.doc(spaceId).set({
    spaceId,
    displayName,
    isActive: true,
    addedBy: actor.email,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "user_added",
    entityType: "chat_space",
    entityId: spaceId,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { spaceId, displayName },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true, id: spaceId }, 201);
});

// PATCH /api/chat-spaces/:id — チャットスペース更新（admin のみ）
chatSpaceRoutes.patch("/:id", zValidator("json", updateSpaceSchema), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const actor = c.get("user");

  const docRef = collections.chatSpaces.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("ChatSpace", id);

  await docRef.update({
    ...updates,
    updatedBy: actor.email,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await collections.auditLogs.add({
    eventType: "user_updated",
    entityType: "chat_space",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: updates,
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});

// DELETE /api/chat-spaces/:id — チャットスペース無効化（論理削除、admin のみ）
chatSpaceRoutes.delete("/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const actor = c.get("user");

  const docRef = collections.chatSpaces.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("ChatSpace", id);

  await docRef.update({
    isActive: false,
    updatedBy: actor.email,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await collections.auditLogs.add({
    eventType: "user_removed",
    entityType: "chat_space",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { spaceId: doc.data()?.spaceId, displayName: doc.data()?.displayName },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});
