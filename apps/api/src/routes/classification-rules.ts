import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

export const classificationRulesRoutes = new Hono();

const updateRuleSchema = z.object({
  keywords: z.array(z.string()).optional(),
  excludeKeywords: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  priority: z.number().int().min(1).max(99).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  sampleMessages: z.array(z.string()).optional(),
});

// GET /api/classification-rules — 全ルール取得
classificationRulesRoutes.get("/", async (c) => {
  const snapshot = await collections.classificationRules.orderBy("priority", "asc").get();

  const rules = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      category: d.category,
      keywords: d.keywords,
      excludeKeywords: d.excludeKeywords,
      patterns: d.patterns,
      priority: d.priority,
      description: d.description,
      isActive: d.isActive,
      sampleMessages: d.sampleMessages,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
    };
  });

  return c.json({ rules });
});

// GET /api/classification-rules/:category — カテゴリ別取得
classificationRulesRoutes.get("/:category", async (c) => {
  const category = c.req.param("category") as ChatCategory;
  if (!CHAT_CATEGORIES.includes(category)) {
    return c.json({ error: "Invalid category" }, 400);
  }

  const snapshot = await collections.classificationRules
    .where("category", "==", category)
    .limit(1)
    .get();

  if (snapshot.empty) {
    notFound("ClassificationRule", category);
  }

  const doc = snapshot.docs[0]!;
  const d = doc.data();
  return c.json({
    id: doc.id,
    category: d.category,
    keywords: d.keywords,
    excludeKeywords: d.excludeKeywords,
    patterns: d.patterns,
    priority: d.priority,
    description: d.description,
    isActive: d.isActive,
    sampleMessages: d.sampleMessages,
    createdAt: toISO(d.createdAt),
    updatedAt: toISO(d.updatedAt),
  });
});

// PATCH /api/classification-rules/:category — ルール更新
classificationRulesRoutes.patch("/:category", zValidator("json", updateRuleSchema), async (c) => {
  const category = c.req.param("category") as ChatCategory;
  if (!CHAT_CATEGORIES.includes(category)) {
    return c.json({ error: "Invalid category" }, 400);
  }

  const updates = c.req.valid("json");
  const actor = c.get("user");

  const snapshot = await collections.classificationRules
    .where("category", "==", category)
    .limit(1)
    .get();

  if (snapshot.empty) {
    notFound("ClassificationRule", category);
  }

  const docRef = snapshot.docs[0]!.ref;
  await docRef.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "classification_rule_changed",
    entityType: "classification_rule",
    entityId: category,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { category, changes: updates },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});
