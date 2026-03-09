import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

const createDocSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(""),
  category: z.string().trim().max(100).default(""),
  fileUrl: z
    .string()
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//i.test(url), { message: "Only http/https URLs allowed" })
    .nullable()
    .default(null),
});

export const adminDocRoutes = new Hono();

function requireAdmin(c: { get(key: "user"): { dashboardRole: string | null } }) {
  if (c.get("user").dashboardRole !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// GET /api/admin/docs — 資料一覧取得
adminDocRoutes.get("/", async (c) => {
  requireAdmin(c);

  const snapshot = await collections.adminDocuments.orderBy("createdAt", "desc").get();
  const docs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      category: data.category,
      fileUrl: data.fileUrl,
      createdBy: data.createdBy,
      createdAt: toISO(data.createdAt),
      updatedAt: toISO(data.updatedAt),
    };
  });

  return c.json({ data: docs });
});

// POST /api/admin/docs — 資料追加
adminDocRoutes.post("/", zValidator("json", createDocSchema), async (c) => {
  requireAdmin(c);
  const actor = c.get("user");
  const body = c.req.valid("json");
  const now = Timestamp.now();

  const batch = db.batch();

  const docRef = collections.adminDocuments.doc();
  batch.set(docRef, {
    title: body.title,
    description: body.description,
    category: body.category,
    fileUrl: body.fileUrl,
    createdBy: actor.email,
    createdAt: now,
    updatedAt: now,
  });

  const auditRef = collections.auditLogs.doc();
  batch.set(auditRef, {
    eventType: "doc_added",
    entityType: "admin_document",
    entityId: docRef.id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { title: body.title, category: body.category },
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return c.json({ success: true, id: docRef.id }, 201);
});

// DELETE /api/admin/docs/:id — 資料削除
adminDocRoutes.delete("/:id", async (c) => {
  requireAdmin(c);
  const id = c.req.param("id");
  const actor = c.get("user");

  const docRef = collections.adminDocuments.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) throw notFound("AdminDocument", id);

  const batch = db.batch();

  batch.delete(docRef);

  const auditRef = collections.auditLogs.doc();
  batch.set(auditRef, {
    eventType: "doc_removed",
    entityType: "admin_document",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { title: doc.data()?.title },
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return c.json({ success: true });
});
