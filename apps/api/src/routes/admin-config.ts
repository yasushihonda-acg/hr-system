import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { toISO } from "../lib/serialize.js";

/** IANA タイムゾーン検証 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const DOC_ID = "default";

/** デフォルト設定値 */
const DEFAULT_CONFIG = {
  appName: "HR-AI Agent",
  companyName: "",
  defaultTimezone: "Asia/Tokyo",
  notificationEnabled: false,
  dataRetentionDays: 365,
};

const updateConfigSchema = z.object({
  appName: z.string().min(1).max(100).optional(),
  companyName: z.string().max(200).optional(),
  defaultTimezone: z
    .string()
    .min(1)
    .max(50)
    .refine(isValidTimezone, { message: "Invalid IANA timezone" })
    .optional(),
  notificationEnabled: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
});

export const adminConfigRoutes = new Hono();

function requireAdmin(c: { get(key: "user"): { dashboardRole: string | null } }) {
  if (c.get("user").dashboardRole !== "admin") {
    throw new HTTPException(403, { message: "Admin access required" });
  }
}

// GET /api/admin/config — 設定取得
adminConfigRoutes.get("/", async (c) => {
  requireAdmin(c);

  const doc = await collections.appConfig.doc(DOC_ID).get();
  if (!doc.exists) {
    return c.json({
      data: {
        ...DEFAULT_CONFIG,
        updatedAt: null,
        updatedBy: null,
      },
    });
  }

  const raw = doc.data()!;
  const data = { ...DEFAULT_CONFIG, ...raw };
  return c.json({
    data: {
      appName: data.appName,
      companyName: data.companyName,
      defaultTimezone: data.defaultTimezone,
      notificationEnabled: data.notificationEnabled,
      dataRetentionDays: data.dataRetentionDays,
      updatedAt: toISO(raw.updatedAt),
      updatedBy: raw.updatedBy ?? null,
    },
  });
});

// PATCH /api/admin/config — 設定更新
adminConfigRoutes.patch("/", zValidator("json", updateConfigSchema), async (c) => {
  requireAdmin(c);
  const updates = c.req.valid("json");
  const actor = c.get("user");

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const docRef = collections.appConfig.doc(DOC_ID);
  const existing = await docRef.get();
  const batch = db.batch();

  if (!existing.exists) {
    // 初回: デフォルト値 + updates で作成
    batch.set(docRef, {
      ...DEFAULT_CONFIG,
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: actor.email,
    });
  } else {
    batch.update(docRef, {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.email,
    });
  }

  const auditRef = collections.auditLogs.doc();
  batch.set(auditRef, {
    eventType: "config_updated",
    entityType: "app_config",
    entityId: DOC_ID,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: updates,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return c.json({ success: true });
});
