import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock variables ---
const mockIntentGet = vi.fn();
const mockIntentWhere = vi.fn();
const mockIntentOrderBy = vi.fn();
const mockChatDocGet = vi.fn();

function chainableQuery(getFn: () => unknown) {
  const q: Record<string, unknown> = {
    where: vi.fn(() => q),
    orderBy: vi.fn(() => q),
    get: vi.fn(getFn),
  };
  return q;
}

vi.mock("@hr-system/db", () => {
  const intentQuery = {
    where: (...args: unknown[]) => {
      mockIntentWhere(...args);
      return intentQuery;
    },
    orderBy: (...args: unknown[]) => {
      mockIntentOrderBy(...args);
      return intentQuery;
    },
    get: () => mockIntentGet(),
  };

  return {
    db: {},
    collections: {
      intentRecords: intentQuery,
      chatMessages: {
        doc: vi.fn((id: string) => ({
          get: () => mockChatDocGet(id),
        })),
      },
    },
  };
});

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { app } from "../app.js";

// Helper to create mock intent docs
function makeIntentDoc(
  overrides: Partial<{
    category: string;
    confidenceScore: number;
    classificationMethod: string;
    isManualOverride: boolean;
    originalCategory: string | null;
    regexPattern: string | null;
    chatMessageId: string;
    createdAt: Timestamp;
  }> = {},
) {
  const now = Timestamp.fromDate(new Date("2026-01-15T10:00:00Z"));
  return {
    id: overrides.chatMessageId ?? "msg-1",
    data: () => ({
      chatMessageId: "msg-1",
      category: "salary",
      confidenceScore: 0.85,
      classificationMethod: "ai",
      isManualOverride: false,
      originalCategory: null,
      regexPattern: null,
      createdAt: now,
      ...overrides,
    }),
  };
}

describe("intent-stats routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/intent-stats/summary
  // =========================================================================
  describe("GET /summary", () => {
    it("should return method breakdown and override rate", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({ classificationMethod: "ai", confidenceScore: 0.9 }),
          makeIntentDoc({
            classificationMethod: "regex",
            confidenceScore: 0.8,
            regexPattern: "pattern1",
          }),
          makeIntentDoc({
            classificationMethod: "manual",
            isManualOverride: true,
            originalCategory: "other",
            confidenceScore: 0.5,
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/summary");
      expect(res.status).toBe(200);

      const body = (await res.json()) as Record<string, unknown>;
      expect(body.total).toBe(3);
      expect(body.byMethod).toEqual({ ai: 1, regex: 1, manual: 1 });
      expect(body.overrideCount).toBe(1);
      expect(body.overrideRate).toBeCloseTo(33.3, 0);
    });

    it("should return zeros for empty data", async () => {
      mockIntentGet.mockResolvedValueOnce({ docs: [] });

      const res = await app.request("/api/intent-stats/summary");
      expect(res.status).toBe(200);

      const body = (await res.json()) as Record<string, unknown>;
      expect(body.total).toBe(0);
      expect(body.overrideRate).toBe(0);
      expect(body.avgConfidence).toEqual({ ai: null, regex: null });
    });

    it("should compute average confidence per method", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({ classificationMethod: "ai", confidenceScore: 0.8 }),
          makeIntentDoc({ classificationMethod: "ai", confidenceScore: 0.6 }),
          makeIntentDoc({
            classificationMethod: "regex",
            confidenceScore: 1.0,
            regexPattern: "p1",
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/summary");
      const body = (await res.json()) as { avgConfidence: { ai: number; regex: number } };
      expect(body.avgConfidence.ai).toBeCloseTo(0.7, 2);
      expect(body.avgConfidence.regex).toBeCloseTo(1.0, 2);
    });
  });

  // =========================================================================
  // GET /api/intent-stats/confusion-matrix
  // =========================================================================
  describe("GET /confusion-matrix", () => {
    it("should return override pairs sorted by count", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({ isManualOverride: true, originalCategory: "other", category: "salary" }),
          makeIntentDoc({ isManualOverride: true, originalCategory: "other", category: "salary" }),
          makeIntentDoc({
            isManualOverride: true,
            originalCategory: "hiring",
            category: "contract",
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/confusion-matrix");
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        entries: Array<{ from: string; to: string; count: number }>;
      };
      expect(body.entries[0]).toEqual({ from: "other", to: "salary", count: 2 });
      expect(body.entries[1]).toEqual({ from: "hiring", to: "contract", count: 1 });
    });

    it("should filter by period", async () => {
      mockIntentGet.mockResolvedValueOnce({ docs: [] });

      const res = await app.request(
        "/api/intent-stats/confusion-matrix?from=2026-01-01&to=2026-01-31",
      );
      expect(res.status).toBe(200);

      // Verify where was called with date params
      expect(mockIntentWhere).toHaveBeenCalledWith("isManualOverride", "==", true);
      expect(mockIntentWhere).toHaveBeenCalledWith("createdAt", ">=", expect.any(Timestamp));
      expect(mockIntentWhere).toHaveBeenCalledWith("createdAt", "<=", expect.any(Timestamp));
    });
  });

  // =========================================================================
  // GET /api/intent-stats/confidence-timeline
  // =========================================================================
  describe("GET /confidence-timeline", () => {
    it("should bucket by day with avg/min/max", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({
            confidenceScore: 0.9,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T08:00:00Z")),
          }),
          makeIntentDoc({
            confidenceScore: 0.6,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T12:00:00Z")),
          }),
          makeIntentDoc({
            confidenceScore: 0.8,
            createdAt: Timestamp.fromDate(new Date("2026-01-11T10:00:00Z")),
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/confidence-timeline?granularity=day");
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        timeline: Array<{ date: string; avg: number; min: number; max: number; count: number }>;
      };
      expect(body.timeline).toHaveLength(2);

      // Jan 10: avg 0.75, min 0.6, max 0.9
      expect(body.timeline[0]!.date).toBe("2026-01-10");
      expect(body.timeline[0]!.avg).toBeCloseTo(0.75, 2);
      expect(body.timeline[0]!.min).toBeCloseTo(0.6, 2);
      expect(body.timeline[0]!.max).toBeCloseTo(0.9, 2);
      expect(body.timeline[0]!.count).toBe(2);

      // Jan 11: single entry
      expect(body.timeline[1]!.date).toBe("2026-01-11");
      expect(body.timeline[1]!.avg).toBeCloseTo(0.8, 2);
    });

    it("should filter by method", async () => {
      mockIntentGet.mockResolvedValueOnce({ docs: [] });

      await app.request("/api/intent-stats/confidence-timeline?method=ai");

      expect(mockIntentWhere).toHaveBeenCalledWith("classificationMethod", "==", "ai");
    });

    it("should handle boundary confidence values (0.0, 1.0)", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({
            confidenceScore: 0.0,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T08:00:00Z")),
          }),
          makeIntentDoc({
            confidenceScore: 1.0,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T12:00:00Z")),
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/confidence-timeline?granularity=day");
      const body = (await res.json()) as { timeline: Array<{ min: number; max: number }> };
      expect(body.timeline[0].min).toBe(0);
      expect(body.timeline[0].max).toBe(1);
    });
  });

  // =========================================================================
  // GET /api/intent-stats/override-rate
  // =========================================================================
  describe("GET /override-rate", () => {
    it("should return override rate per period", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({
            isManualOverride: false,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T08:00:00Z")),
          }),
          makeIntentDoc({
            isManualOverride: true,
            createdAt: Timestamp.fromDate(new Date("2026-01-10T12:00:00Z")),
          }),
          makeIntentDoc({
            isManualOverride: false,
            createdAt: Timestamp.fromDate(new Date("2026-01-11T10:00:00Z")),
          }),
        ],
      });

      const res = await app.request("/api/intent-stats/override-rate?granularity=day");
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        timeline: Array<{ date: string; total: number; overrides: number; overrideRate: number }>;
      };
      expect(body.timeline).toHaveLength(2);
      expect(body.timeline[0].total).toBe(2);
      expect(body.timeline[0].overrides).toBe(1);
      expect(body.timeline[0].overrideRate).toBe(50);
      expect(body.timeline[1].overrideRate).toBe(0);
    });
  });

  // =========================================================================
  // GET /api/intent-stats/override-patterns
  // =========================================================================
  describe("GET /override-patterns", () => {
    it("should return patterns sorted by count with sample messages", async () => {
      mockIntentGet.mockResolvedValueOnce({
        docs: [
          makeIntentDoc({
            isManualOverride: true,
            originalCategory: "other",
            category: "salary",
            chatMessageId: "msg-1",
          }),
          makeIntentDoc({
            isManualOverride: true,
            originalCategory: "other",
            category: "salary",
            chatMessageId: "msg-2",
          }),
          makeIntentDoc({
            isManualOverride: true,
            originalCategory: "hiring",
            category: "contract",
            chatMessageId: "msg-3",
          }),
        ],
      });

      mockChatDocGet.mockImplementation((id: string) => {
        const messages: Record<string, string> = {
          "msg-1": "来月から基本給を上げたい",
          "msg-2": "手当の変更をお願いします",
          "msg-3": "契約更新のスケジュールを教えて",
        };
        return {
          exists: true,
          data: () => ({ content: messages[id] ?? "" }),
        };
      });

      const res = await app.request("/api/intent-stats/override-patterns");
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        patterns: Array<{
          fromCategory: string;
          toCategory: string;
          count: number;
          percentage: number;
          sampleMessages: Array<{ id: string; content: string }>;
          suggestedKeywords: string[];
        }>;
        totalOverrides: number;
      };

      expect(body.totalOverrides).toBe(3);
      expect(body.patterns).toHaveLength(2);
      // Sorted by count desc
      expect(body.patterns[0].fromCategory).toBe("other");
      expect(body.patterns[0].toCategory).toBe("salary");
      expect(body.patterns[0].count).toBe(2);
      expect(body.patterns[0].sampleMessages).toHaveLength(2);
      expect(body.patterns[0].sampleMessages[0].content).toContain("基本給");
    });

    it("should return empty patterns for no overrides", async () => {
      mockIntentGet.mockResolvedValueOnce({ docs: [] });

      const res = await app.request("/api/intent-stats/override-patterns");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { patterns: unknown[]; totalOverrides: number };
      expect(body.patterns).toHaveLength(0);
      expect(body.totalOverrides).toBe(0);
    });
  });
});
