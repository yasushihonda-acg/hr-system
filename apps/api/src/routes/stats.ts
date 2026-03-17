import { collections } from "@hr-system/db";
import { CHAT_CATEGORIES, type ChatCategory } from "@hr-system/shared";
import { Timestamp } from "firebase-admin/firestore";
import { Hono } from "hono";
import { getCached, setCache, TTL } from "../lib/cache.js";

export const statsRoutes = new Hono();

const CATEGORY_LABELS: Record<ChatCategory, string> = {
  salary: "給与・社会保険・手当関連",
  retirement: "退職・休職・復職関連",
  hiring: "入社・採用・面接関連",
  contract: "契約・労働条件変更関連",
  transfer: "施設運営・異動・備品関連",
  foreigner: "外国人・特定技能・ビザ関連",
  training: "研修・監査・事務手続き関連",
  health_check: "健康診断・面談関連",
  attendance: "勤怠・休暇管理関連",
  other: "その他",
};

// GET /api/stats/summary — サマリー（Google Chat + LINE）
statsRoutes.get("/summary", async (c) => {
  const CACHE_KEY = "stats:summary";
  const cached = getCached<{ total: number; today: number; thisWeek: number; thisMonth: number }>(
    CACHE_KEY,
  );
  if (cached) return c.json(cached);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [chatTotal, lineTotal, chatToday, lineToday, chatWeek, lineWeek, chatMonth, lineMonth] =
    await Promise.all([
      collections.chatMessages.count().get(),
      collections.lineMessages.count().get(),
      collections.chatMessages
        .where("createdAt", ">=", Timestamp.fromDate(todayStart))
        .count()
        .get(),
      collections.lineMessages
        .where("createdAt", ">=", Timestamp.fromDate(todayStart))
        .count()
        .get(),
      collections.chatMessages
        .where("createdAt", ">=", Timestamp.fromDate(weekStart))
        .count()
        .get(),
      collections.lineMessages
        .where("createdAt", ">=", Timestamp.fromDate(weekStart))
        .count()
        .get(),
      collections.chatMessages
        .where("createdAt", ">=", Timestamp.fromDate(monthStart))
        .count()
        .get(),
      collections.lineMessages
        .where("createdAt", ">=", Timestamp.fromDate(monthStart))
        .count()
        .get(),
    ]);

  const result = {
    total: chatTotal.data().count + lineTotal.data().count,
    today: chatToday.data().count + lineToday.data().count,
    thisWeek: chatWeek.data().count + lineWeek.data().count,
    thisMonth: chatMonth.data().count + lineMonth.data().count,
  };
  setCache(CACHE_KEY, result, TTL.STATS);
  return c.json(result);
});

// GET /api/stats/categories — カテゴリ別集計
statsRoutes.get("/categories", async (c) => {
  const CACHE_KEY = "stats:categories";
  const cached = getCached<{ categories: unknown[]; total: number }>(CACHE_KEY);
  if (cached) return c.json(cached);

  const intentSnap = await collections.intentRecords.get();

  const counts: Record<string, number> = {};
  for (const cat of CHAT_CATEGORIES) {
    counts[cat] = 0;
  }

  for (const doc of intentSnap.docs) {
    const cats = doc.data().categories ?? [];
    for (const cat of cats) {
      if (cat in counts && counts[cat] !== undefined) {
        counts[cat]++;
      }
    }
  }

  const total = intentSnap.docs.length;
  const categories = CHAT_CATEGORIES.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    count: counts[cat] ?? 0,
    percentage: total > 0 ? Math.round(((counts[cat] ?? 0) / total) * 1000) / 10 : 0,
  }));

  const result = { categories, total };
  setCache(CACHE_KEY, result, TTL.STATS);
  return c.json(result);
});

// GET /api/stats/timeline — 期間別推移
statsRoutes.get("/timeline", async (c) => {
  const granularity = c.req.query("granularity") ?? "day";
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const CACHE_KEY = `stats:timeline:${granularity}:${fromParam ?? ""}:${toParam ?? ""}`;
  const cached = getCached<unknown>(CACHE_KEY);
  if (cached) return c.json(cached);

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam) : now;

  const [chatSnap, lineSnap] = await Promise.all([
    collections.chatMessages
      .where("createdAt", ">=", Timestamp.fromDate(from))
      .where("createdAt", "<=", Timestamp.fromDate(to))
      .orderBy("createdAt", "asc")
      .get(),
    collections.lineMessages
      .where("createdAt", ">=", Timestamp.fromDate(from))
      .where("createdAt", "<=", Timestamp.fromDate(to))
      .orderBy("createdAt", "asc")
      .get(),
  ]);

  const buckets: Record<string, number> = {};
  for (const doc of [...chatSnap.docs, ...lineSnap.docs]) {
    const date = doc.data().createdAt.toDate();
    let key: string;
    if (granularity === "month") {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    } else if (granularity === "week") {
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      key = weekStart.toISOString().slice(0, 10);
    } else {
      key = date.toISOString().slice(0, 10);
    }
    buckets[key] = (buckets[key] ?? 0) + 1;
  }

  const timeline = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const result = { timeline, granularity, from: from.toISOString(), to: to.toISOString() };
  setCache(CACHE_KEY, result, TTL.STATS);
  return c.json(result);
});

// GET /api/stats/spaces — ソース別集計（Google Chat スペース + LINE グループ）
statsRoutes.get("/spaces", async (c) => {
  const CACHE_KEY = "stats:spaces";
  const cached = getCached<{ spaces: unknown[]; total: number }>(CACHE_KEY);
  if (cached) return c.json(cached);

  const [chatSnap, lineSnap, spaceConfigSnap] = await Promise.all([
    collections.chatMessages.get(),
    collections.lineMessages.get(),
    collections.chatSpaces.get(),
  ]);

  // Google Chat スペース別
  const spaceCounts: Record<string, number> = {};
  for (const doc of chatSnap.docs) {
    const spaceId = doc.data().spaceId;
    spaceCounts[spaceId] = (spaceCounts[spaceId] ?? 0) + 1;
  }

  const displayNameMap: Record<string, string> = {};
  for (const doc of spaceConfigSnap.docs) {
    const d = doc.data();
    displayNameMap[d.spaceId] = d.displayName;
  }

  const spaces: { spaceId: string; displayName: string; count: number; source: string }[] =
    Object.entries(spaceCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([spaceId, count]) => ({
        spaceId,
        displayName: displayNameMap[spaceId] ?? spaceId,
        count,
        source: "gchat",
      }));

  // LINE グループ別
  const groupCounts = new Map<string, { count: number; groupName: string | null }>();
  for (const doc of lineSnap.docs) {
    const msg = doc.data();
    const existing = groupCounts.get(msg.groupId);
    if (existing) {
      existing.count++;
    } else {
      groupCounts.set(msg.groupId, { count: 1, groupName: msg.groupName });
    }
  }

  const lineSpaces = Array.from(groupCounts.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([groupId, { count, groupName }]) => ({
      spaceId: groupId,
      displayName: groupName ?? groupId,
      count,
      source: "line",
    }));

  const allSpaces = [...spaces, ...lineSpaces].sort((a, b) => b.count - a.count);
  const total = chatSnap.docs.length + lineSnap.docs.length;

  const result = { spaces: allSpaces, total };
  setCache(CACHE_KEY, result, TTL.STATS);
  return c.json(result);
});
