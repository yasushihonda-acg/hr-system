import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import { isAllowedDomain, USER_ROLES } from "@hr-system/shared";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(USER_ROLES),
});

const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const adminUserRoutes = new Hono();

function requireAdmin(c: { get(key: "user"): { dashboardRole: string | null } }) {
  if (c.get("user").dashboardRole !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// GET /api/admin/users — 許可ユーザー一覧
adminUserRoutes.get("/", async (c) => {
  requireAdmin(c);

  const snapshot = await collections.allowedUsers.get();
  const users = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        isActive: data.isActive,
        addedBy: data.addedBy,
        sortOrder: data.sortOrder ?? Infinity,
        createdAt: toISO(data.createdAt),
        updatedAt: toISO(data.updatedAt),
      };
    })
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt < b.createdAt ? 1 : -1;
    });

  return c.json({ data: users });
});

// POST /api/admin/users — ユーザー追加
adminUserRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  requireAdmin(c);
  const actor = c.get("user");
  const { email, displayName, role } = c.req.valid("json");

  // ドメインチェック
  if (!isAllowedDomain(email)) {
    return c.json({ error: "許可されていないメールドメインです" }, 400);
  }

  // 重複チェック
  const existing = await collections.allowedUsers.where("email", "==", email).limit(1).get();
  if (!existing.empty) {
    return c.json({ error: "User already exists" }, 409);
  }

  // 新規ユーザーの sortOrder を既存ユーザー数+1 で自動付与
  const countSnapshot = await collections.allowedUsers.count().get();
  const sortOrder = countSnapshot.data().count + 1;

  const docId = email.replace(/[.@]/g, "_");
  const now = Timestamp.now();
  await collections.allowedUsers.doc(docId).set({
    email,
    displayName,
    role,
    addedBy: actor.email,
    isActive: true,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "user_added",
    entityType: "allowed_user",
    entityId: docId,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { email, displayName, role },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true, id: docId }, 201);
});

// PATCH /api/admin/users/:id — ユーザー更新
adminUserRoutes.patch("/:id", zValidator("json", updateUserSchema), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const actor = c.get("user");

  const docRef = collections.allowedUsers.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("AllowedUser", id);

  await docRef.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await collections.auditLogs.add({
    eventType: "user_updated",
    entityType: "allowed_user",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: updates,
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});

// POST /api/admin/users/reorder — 並び替え
const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

adminUserRoutes.post("/reorder", zValidator("json", reorderSchema), async (c) => {
  requireAdmin(c);
  const { orderedIds } = c.req.valid("json");

  const batch = db.batch();
  let sortOrder = 1;
  for (const id of orderedIds) {
    const ref = collections.allowedUsers.doc(id);
    batch.update(ref, { sortOrder: sortOrder++, updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();

  return c.json({ success: true });
});

// DELETE /api/admin/users/:id — ユーザー物理削除
adminUserRoutes.delete("/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const actor = c.get("user");

  const docRef = collections.allowedUsers.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("AllowedUser", id);

  const email = doc.data()?.email;

  await docRef.delete();

  await collections.auditLogs.add({
    eventType: "user_removed",
    entityType: "allowed_user",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { email },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});
