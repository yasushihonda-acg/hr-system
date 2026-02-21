import { zValidator } from "@hono/zod-validator";
import { collections } from "@hr-system/db";
import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { FieldValue } from "firebase-admin/firestore";
import { Hono } from "hono";
import { z } from "zod";
import { notFound } from "../lib/errors.js";
import { toISO } from "../lib/serialize.js";

export const llmRulesRoutes = new Hono();

const llmRuleTypes = ["system_prompt", "few_shot_example", "category_definition"] as const;

const createLlmRuleSchema = z.object({
  type: z.enum(llmRuleTypes),
  content: z.string().max(10000).nullable().default(null),
  category: z
    .enum(CHAT_CATEGORIES as unknown as [string, ...string[]])
    .nullable()
    .default(null),
  description: z.string().max(500).nullable().default(null),
  keywords: z.array(z.string()).nullable().default(null),
  inputText: z.string().max(1000).nullable().default(null),
  expectedCategory: z
    .enum(CHAT_CATEGORIES as unknown as [string, ...string[]])
    .nullable()
    .default(null),
  explanation: z.string().max(1000).nullable().default(null),
  priority: z.number().int().min(1).max(999),
  isActive: z.boolean().default(true),
});

const updateLlmRuleSchema = createLlmRuleSchema.partial();

// GET /api/llm-rules — 全ルール取得
llmRulesRoutes.get("/", async (c) => {
  const snapshot = await collections.llmClassificationRules.orderBy("priority", "asc").get();

  const rules = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      type: d.type,
      content: d.content,
      category: d.category,
      description: d.description,
      keywords: d.keywords,
      inputText: d.inputText,
      expectedCategory: d.expectedCategory,
      explanation: d.explanation,
      priority: d.priority,
      isActive: d.isActive,
      createdBy: d.createdBy,
      createdAt: toISO(d.createdAt),
      updatedAt: toISO(d.updatedAt),
    };
  });

  return c.json({ rules });
});

// POST /api/llm-rules — 新規作成
llmRulesRoutes.post("/", zValidator("json", createLlmRuleSchema), async (c) => {
  const data = c.req.valid("json");
  const actor = c.get("user");

  const docRef = await collections.llmClassificationRules.add({
    ...data,
    category: (data.category as ChatCategory) ?? null,
    expectedCategory: (data.expectedCategory as ChatCategory) ?? null,
    createdBy: actor.email,
    createdAt: FieldValue.serverTimestamp() as never,
    updatedAt: FieldValue.serverTimestamp() as never,
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "llm_rule_changed",
    entityType: "llm_classification_rule",
    entityId: docRef.id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { action: "created", type: data.type },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true, id: docRef.id }, 201);
});

// PATCH /api/llm-rules/:id — 更新
llmRulesRoutes.patch("/:id", zValidator("json", updateLlmRuleSchema), async (c) => {
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const actor = c.get("user");

  const docRef = collections.llmClassificationRules.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    notFound("LlmClassificationRule", id);
  }

  await docRef.update({
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "llm_rule_changed",
    entityType: "llm_classification_rule",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { action: "updated", changes: updates },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});

// DELETE /api/llm-rules/:id — 削除(soft delete: isActive=false)
llmRulesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const actor = c.get("user");

  const docRef = collections.llmClassificationRules.doc(id);
  const doc = await docRef.get();
  if (!doc.exists) {
    notFound("LlmClassificationRule", id);
  }

  await docRef.update({
    isActive: false,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 監査ログ
  await collections.auditLogs.add({
    eventType: "llm_rule_changed",
    entityType: "llm_classification_rule",
    entityId: id,
    actorEmail: actor.email,
    actorRole: c.get("actorRole"),
    details: { action: "soft_deleted" },
    createdAt: FieldValue.serverTimestamp() as never,
  });

  return c.json({ success: true });
});
