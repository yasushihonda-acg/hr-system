import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { parsePagination } from "../lib/pagination.js";
import { toISO } from "../lib/serialize.js";

const listQuerySchema = z.object({
  groupId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const lineMessageRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /api/line-messages — LINE メッセージ一覧
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const { groupId, limit, offset } = c.req.valid("query");
  const { limit: lim, offset: off } = parsePagination({ limit, offset });
  const actorRole = c.get("actorRole");

  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let query = collections.lineMessages.orderBy("createdAt", "desc") as FirebaseFirestore.Query;

  if (groupId) {
    query = query.where("groupId", "==", groupId);
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

  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
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
// GET /api/line-messages/:id — メッセージ詳細
// ---------------------------------------------------------------------------
lineMessageRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const actorRole = c.get("actorRole");

  if (!["hr_staff", "hr_manager", "ceo"].includes(actorRole)) {
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
    rawPayload: msg.rawPayload,
    createdAt: toISO(msg.createdAt),
  });
});
