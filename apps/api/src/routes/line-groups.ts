import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { FieldValue } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

const updateGroupSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const lineGroupRoutes = new Hono();

function requireAdmin(c: { get(key: "user"): { dashboardRole: string | null } }) {
  if (c.get("user").dashboardRole !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// GET /api/line-groups — LINE グループ一覧
// 認証済み全員: isActive: true のみ返す
// admin + ?all=true: 全件返す
lineGroupRoutes.get("/", async (c) => {
  const showAll = c.req.query("all") === "true";

  if (showAll) {
    requireAdmin(c);
  }

  const baseQuery = collections.lineGroups.orderBy("createdAt", "desc");
  const snapshot = showAll
    ? await baseQuery.get()
    : await baseQuery.where("isActive", "==", true).get();

  const groups = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      groupId: data.groupId,
      displayName: data.displayName,
      isActive: data.isActive,
      addedBy: data.addedBy,
      updatedBy: data.updatedBy,
      createdAt: toISO(data.createdAt),
      updatedAt: toISO(data.updatedAt),
    };
  });

  return c.json({ data: groups });
});

// PATCH /api/line-groups/:id — LINE グループ更新（admin のみ）
lineGroupRoutes.patch("/:id", zValidator("json", updateGroupSchema), async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const actor = c.get("user");

  const docRef = collections.lineGroups.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("LineGroup", id);

  await docRef.update({
    ...updates,
    updatedBy: actor.email,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await collections.auditLogs.add({
    eventType: "user_updated",
    entityType: "line_group",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: updates,
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});

// DELETE /api/line-groups/:id — LINE グループ無効化（論理削除、admin のみ）
lineGroupRoutes.delete("/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const actor = c.get("user");

  const docRef = collections.lineGroups.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("LineGroup", id);

  await docRef.update({
    isActive: false,
    updatedBy: actor.email,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await collections.auditLogs.add({
    eventType: "user_removed",
    entityType: "line_group",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { groupId: doc.data()?.groupId, displayName: doc.data()?.displayName },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});
