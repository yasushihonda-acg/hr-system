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

// GET /api/stats/summary — サマリー
statsRoutes.get("/summary", async (c) => {
  const allMessages = await collections.chatMessages.count().get();
  const total = allMessages.data().count;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySnap, weekSnap, monthSnap] = await Promise.all([
    collections.chatMessages.where("createdAt", ">=", Timestamp.fromDate(todayStart)).count().get(),
    collections.chatMessages.where("createdAt", ">=", Timestamp.fromDate(weekStart)).count().get(),
    collections.chatMessages.where("createdAt", ">=", Timestamp.fromDate(monthStart)).count().get(),
  ]);

  return c.json({
    total,
    today: todaySnap.data().count,
    thisWeek: weekSnap.data().count,
    thisMonth: monthSnap.data().count,
  });
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
    const cat = doc.data().category;
    if (cat in counts && counts[cat] !== undefined) {
      counts[cat]++;
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

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const from = fromParam ? new Date(fromParam) : defaultFrom;
  const to = toParam ? new Date(toParam) : now;

  const snapshot = await collections.chatMessages
    .where("createdAt", ">=", Timestamp.fromDate(from))
    .where("createdAt", "<=", Timestamp.fromDate(to))
    .orderBy("createdAt", "asc")
    .get();

  const buckets: Record<string, number> = {};
  for (const doc of snapshot.docs) {
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

  return c.json({ timeline, granularity, from: from.toISOString(), to: to.toISOString() });
});

// GET /api/stats/spaces — スペース別集計
statsRoutes.get("/spaces", async (c) => {
  const CACHE_KEY = "stats:spaces";
  const cached = getCached<{ spaces: unknown[]; total: number }>(CACHE_KEY);
  if (cached) return c.json(cached);

  const snapshot = await collections.chatMessages.get();

  const spaceCounts: Record<string, number> = {};
  for (const doc of snapshot.docs) {
    const spaceId = doc.data().spaceId;
    spaceCounts[spaceId] = (spaceCounts[spaceId] ?? 0) + 1;
  }

  // chat_spaces から displayName を取得してマッピング
  const spaceConfigSnap = await collections.chatSpaces.get();
  const displayNameMap: Record<string, string> = {};
  for (const doc of spaceConfigSnap.docs) {
    const d = doc.data();
    displayNameMap[d.spaceId] = d.displayName;
  }

  const spaces = Object.entries(spaceCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([spaceId, count]) => ({
      spaceId,
      displayName: displayNameMap[spaceId] ?? spaceId,
      count,
    }));

  const result = { spaces, total: snapshot.docs.length };
  setCache(CACHE_KEY, result, TTL.STATS);
  return c.json(result);
});
