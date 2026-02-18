import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { AUDIT_EVENT_TYPES } from "@hr-system/shared";
import { Hono } from "hono";
import { z } from "zod";
import { parsePagination } from "../lib/pagination.js";
import { toISO } from "../lib/serialize.js";

const listQuerySchema = z.object({
  actorEmail: z.string().email().optional(),
  eventType: z.enum(AUDIT_EVENT_TYPES).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const app = new Hono();

/**
 * GET /api/audit-logs
 * 監査ログ検索（人事管理者・CEO のみ）
 */
app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const actorRole = c.get("actorRole");
  if (actorRole === "hr_staff") {
    return c.json(
      { error: { code: "FORBIDDEN", message: "監査ログの閲覧は管理者以上に限定されています" } },
      403,
    );
  }

  const { actorEmail, eventType, entityType, entityId } = c.req.valid("query");
  const { limit, offset } = parsePagination(c.req.query());

  let query = collections.auditLogs.orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (actorEmail) query = query.where("actorEmail", "==", actorEmail);
  if (eventType) query = query.where("eventType", "==", eventType);
  if (entityType) query = query.where("entityType", "==", entityType);
  if (entityId) query = query.where("entityId", "==", entityId);

  const [countSnap, docsSnap] = await Promise.all([
    query.count().get(),
    query.limit(limit).offset(offset).get(),
  ]);

  const total = countSnap.data().count;
  const logs = docsSnap.docs.map((doc) => {
    const log = doc.data();
    return {
      id: doc.id,
      eventType: log.eventType,
      entityType: log.entityType,
      entityId: log.entityId,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      details: log.details,
      createdAt: toISO(log.createdAt),
    };
  });

  return c.json({ logs, total, limit, offset });
});

export { app as auditLogRoutes };
