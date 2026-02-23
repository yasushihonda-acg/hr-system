import { zValidator } from "@hono/zod-validator";
import { collections, db } from "@hr-system/db";
import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { TTL, getCached, setCache } from "../lib/cache.js";
import { requireRole } from "../middleware/rbac.js";

export const intentStatsRoutes = new Hono();

// 給与分析データ（チャット原文・PII含む）は hr_manager / ceo のみ閲覧可
intentStatsRoutes.use("*", requireRole("hr_manager", "ceo"));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const dateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), { message: "Invalid date format" });

const periodQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

const timelineQuerySchema = periodQuerySchema.extend({
  granularity: z.enum(["day", "week", "month"]).default("day"),
  method: z.enum(["all", "ai", "regex", "manual"]).default("all"),
});

const overrideRateQuerySchema = periodQuerySchema.extend({
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

function defaultRange(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  return {
    from: from ? new Date(from) : defaultFrom,
    to: to ? new Date(to) : now,
  };
}

function bucketKey(date: Date, granularity: string): string {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// GET /summary
// ---------------------------------------------------------------------------

intentStatsRoutes.get("/summary", async (c) => {
  const CACHE_KEY = "intent-stats:summary";
  try {
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return c.json(cached);

    const snapshot = await collections.intentRecords.get();
    const docs = snapshot.docs.map((d) => d.data());

    const total = docs.length;
    let aiCount = 0;
    let regexCount = 0;
    let manualCount = 0;
    let overrideCount = 0;
    let aiConfidenceSum = 0;
    let aiConfidenceN = 0;
    let regexConfidenceSum = 0;
    let regexConfidenceN = 0;

    for (const d of docs) {
      if (d.classificationMethod === "ai") aiCount++;
      else if (d.classificationMethod === "regex") regexCount++;
      else if (d.classificationMethod === "manual") manualCount++;

      if (d.isManualOverride) overrideCount++;

      // confidence by original method (before override)
      if (d.isManualOverride) {
        // The original method isn't stored directly; infer from fields
        if (d.regexPattern) {
          regexConfidenceSum += d.confidenceScore;
          regexConfidenceN++;
        } else {
          aiConfidenceSum += d.confidenceScore;
          aiConfidenceN++;
        }
      } else if (d.classificationMethod === "ai") {
        aiConfidenceSum += d.confidenceScore;
        aiConfidenceN++;
      } else if (d.classificationMethod === "regex") {
        regexConfidenceSum += d.confidenceScore;
        regexConfidenceN++;
      }
    }

    const result = {
      total,
      byMethod: { ai: aiCount, regex: regexCount, manual: manualCount },
      overrideCount,
      overrideRate: total > 0 ? Math.round((overrideCount / total) * 1000) / 10 : 0,
      avgConfidence: {
        ai: aiConfidenceN > 0 ? Math.round((aiConfidenceSum / aiConfidenceN) * 1000) / 1000 : null,
        regex:
          regexConfidenceN > 0
            ? Math.round((regexConfidenceSum / regexConfidenceN) * 1000) / 1000
            : null,
      },
    };
    setCache(CACHE_KEY, result, TTL.STATS);
    return c.json(result);
  } catch (e) {
    console.error("[intent-stats/summary]", e);
    throw new HTTPException(503, { message: "Failed to fetch intent stats" });
  }
});

// ---------------------------------------------------------------------------
// GET /confusion-matrix
// ---------------------------------------------------------------------------

intentStatsRoutes.get("/confusion-matrix", zValidator("query", periodQuerySchema), async (c) => {
  const { from: fromStr, to: toStr } = c.req.valid("query");
  const { from, to } = defaultRange(fromStr, toStr);
  const CACHE_KEY = `intent-stats:confusion-matrix:${from.toISOString()}:${to.toISOString()}`;
  try {
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return c.json(cached);

    const snapshot = await collections.intentRecords
      .where("isManualOverride", "==", true)
      .where("createdAt", ">=", Timestamp.fromDate(from))
      .where("createdAt", "<=", Timestamp.fromDate(to))
      .get();

    const matrix: Record<string, Record<string, number>> = {};
    for (const doc of snapshot.docs) {
      const d = doc.data();
      const original = d.originalCategory ?? "unknown";
      const corrected = d.category;
      if (!matrix[original]) matrix[original] = {};
      matrix[original][corrected] = (matrix[original][corrected] ?? 0) + 1;
    }

    // Flatten to array
    const entries: Array<{ from: string; to: string; count: number }> = [];
    for (const [orig, targets] of Object.entries(matrix)) {
      for (const [target, count] of Object.entries(targets)) {
        entries.push({ from: orig, to: target, count });
      }
    }
    entries.sort((a, b) => b.count - a.count);

    const result = {
      entries,
      categories: [...CHAT_CATEGORIES],
      period: { from: from.toISOString(), to: to.toISOString() },
    };
    setCache(CACHE_KEY, result, TTL.STATS);
    return c.json(result);
  } catch (e) {
    console.error("[intent-stats/confusion-matrix]", e);
    throw new HTTPException(503, { message: "Failed to fetch confusion matrix" });
  }
});

// ---------------------------------------------------------------------------
// GET /confidence-timeline
// ---------------------------------------------------------------------------

intentStatsRoutes.get(
  "/confidence-timeline",
  zValidator("query", timelineQuerySchema),
  async (c) => {
    try {
      const { from: fromStr, to: toStr, granularity, method } = c.req.valid("query");
      const { from, to } = defaultRange(fromStr, toStr);
      const CACHE_KEY = `intent-stats:confidence-timeline:${granularity}:${method}:${from.toISOString()}:${to.toISOString()}`;
      const cached = getCached<object>(CACHE_KEY);
      if (cached) return c.json(cached);

      const baseQuery = collections.intentRecords
        .where("createdAt", ">=", Timestamp.fromDate(from))
        .where("createdAt", "<=", Timestamp.fromDate(to));

      const filteredQuery =
        method !== "all" ? baseQuery.where("classificationMethod", "==", method) : baseQuery;

      const snapshot = await filteredQuery.orderBy("createdAt", "asc").get();

      const buckets: Record<string, { sum: number; count: number; min: number; max: number }> = {};
      for (const doc of snapshot.docs) {
        const d = doc.data();
        const date = d.createdAt.toDate();
        const key = bucketKey(date, granularity);
        if (!buckets[key]) {
          buckets[key] = { sum: 0, count: 0, min: 1, max: 0 };
        }
        const b = buckets[key];
        b.sum += d.confidenceScore;
        b.count++;
        if (d.confidenceScore < b.min) b.min = d.confidenceScore;
        if (d.confidenceScore > b.max) b.max = d.confidenceScore;
      }

      const timeline = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, b]) => ({
          date,
          avg: Math.round((b.sum / b.count) * 1000) / 1000,
          min: Math.round(b.min * 1000) / 1000,
          max: Math.round(b.max * 1000) / 1000,
          count: b.count,
        }));

      const result = { timeline, granularity, method };
      setCache(CACHE_KEY, result, TTL.STATS);
      return c.json(result);
    } catch (e) {
      console.error("[intent-stats/confidence-timeline]", e);
      throw new HTTPException(503, { message: "Failed to fetch confidence timeline" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /override-rate
// ---------------------------------------------------------------------------

intentStatsRoutes.get("/override-rate", zValidator("query", overrideRateQuerySchema), async (c) => {
  const { from: fromStr, to: toStr, granularity } = c.req.valid("query");
  const { from, to } = defaultRange(fromStr, toStr);
  const CACHE_KEY = `intent-stats:override-rate:${granularity}:${from.toISOString()}:${to.toISOString()}`;
  try {
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return c.json(cached);

    const snapshot = await collections.intentRecords
      .where("createdAt", ">=", Timestamp.fromDate(from))
      .where("createdAt", "<=", Timestamp.fromDate(to))
      .orderBy("createdAt", "asc")
      .get();

    const buckets: Record<string, { total: number; overrides: number }> = {};
    for (const doc of snapshot.docs) {
      const d = doc.data();
      const date = d.createdAt.toDate();
      const key = bucketKey(date, granularity);
      if (!buckets[key]) {
        buckets[key] = { total: 0, overrides: 0 };
      }
      buckets[key].total++;
      if (d.isManualOverride) buckets[key].overrides++;
    }

    const timeline = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        total: b.total,
        overrides: b.overrides,
        overrideRate: b.total > 0 ? Math.round((b.overrides / b.total) * 1000) / 10 : 0,
      }));

    const result = { timeline, granularity };
    setCache(CACHE_KEY, result, TTL.STATS);
    return c.json(result);
  } catch (e) {
    console.error("[intent-stats/override-rate]", e);
    throw new HTTPException(503, { message: "Failed to fetch override rate" });
  }
});

// ---------------------------------------------------------------------------
// GET /override-patterns
// ---------------------------------------------------------------------------

intentStatsRoutes.get("/override-patterns", async (c) => {
  const CACHE_KEY = "intent-stats:override-patterns";
  try {
    const cached = getCached<object>(CACHE_KEY);
    if (cached) return c.json(cached);

    const overrideSnap = await collections.intentRecords
      .where("isManualOverride", "==", true)
      .get();

    // Group by originalCategory -> category
    const patternsMap: Record<string, { count: number; chatMessageIds: string[] }> = {};

    for (const doc of overrideSnap.docs) {
      const d = doc.data();
      const key = `${d.originalCategory ?? "unknown"}->${d.category}`;
      if (!patternsMap[key]) {
        patternsMap[key] = { count: 0, chatMessageIds: [] };
      }
      patternsMap[key].count++;
      if (patternsMap[key].chatMessageIds.length < 3) {
        patternsMap[key].chatMessageIds.push(d.chatMessageId);
      }
    }

    // Sort by count desc
    const sortedKeys = Object.keys(patternsMap).sort(
      (a, b) => (patternsMap[b]?.count ?? 0) - (patternsMap[a]?.count ?? 0),
    );

    // Fetch sample messages via db.getAll() batch (個別getより効率的)
    const allMsgIds = new Set<string>();
    for (const key of sortedKeys) {
      for (const id of patternsMap[key]?.chatMessageIds ?? []) {
        allMsgIds.add(id);
      }
    }

    const messageMap: Record<string, string> = {};
    if (allMsgIds.size > 0) {
      const refs = [...allMsgIds].map((id) => collections.chatMessages.doc(id));
      const docSnaps = await db.getAll(...refs);
      for (const snap of docSnaps) {
        if (snap.exists) {
          messageMap[snap.id] = (snap.data() as { content?: string })?.content ?? "";
        }
      }
    }

    const totalOverrides = overrideSnap.docs.length;

    const patterns = sortedKeys.map((key) => {
      const [fromCat, toCat] = key.split("->") as [string, string];
      const entry = patternsMap[key]!;
      const sampleMessages = entry.chatMessageIds.map((id) => ({
        id,
        content: messageMap[id] ?? "",
      }));

      // Extract frequent words from sample messages
      const allWords = sampleMessages
        .flatMap((m) => m.content.split(/[\s,。、！？\n]+/))
        .filter((w) => w.length >= 2);
      const wordCounts: Record<string, number> = {};
      for (const w of allWords) {
        wordCounts[w] = (wordCounts[w] ?? 0) + 1;
      }
      const suggestedKeywords = Object.entries(wordCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([word]) => word);

      return {
        fromCategory: fromCat as ChatCategory,
        toCategory: toCat as ChatCategory,
        count: entry.count,
        percentage: totalOverrides > 0 ? Math.round((entry.count / totalOverrides) * 1000) / 10 : 0,
        sampleMessages,
        suggestedKeywords,
      };
    });

    const result = { patterns, totalOverrides };
    setCache(CACHE_KEY, result, TTL.STATS);
    return c.json(result);
  } catch (e) {
    console.error("[intent-stats/override-patterns]", e);
    throw new HTTPException(503, { message: "Failed to fetch override patterns" });
  }
});
