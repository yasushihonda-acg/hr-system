import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted で vi.mock と同時にホイスト） ---
const { mockGetRequestHeaders, mockGet, mockSet, mockAdd, mockUpdate } = vi.hoisted(() => ({
  mockGetRequestHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { getRequestHeaders: mockGetRequestHeaders };
    }
  },
}));

vi.mock("@hr-system/db", () => ({
  db: {
    batch: vi.fn(() => ({
      update: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  },
  collections: {
    syncMetadata: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    chatMessages: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
    },
    lineMessages: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      count: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
    },
    chatSpaces: {
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    },
    classificationRules: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    llmRules: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    },
    auditLogs: {
      add: mockAdd,
    },
    allowedUsers: {
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [
                {
                  data: () => ({
                    email: "viewer@test.com",
                    role: "viewer",
                    isActive: true,
                  }),
                },
              ],
            }),
          }),
        }),
      }),
    },
  },
}));

// viewer ユーザーをセットする auth モック
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("user", {
        email: "viewer@test.com",
        name: "Viewer User",
        sub: "viewer-sub",
        dashboardRole: "viewer",
      });
      await next();
    },
  ),
}));

// rbac モック: viewer → actorRole: null（実際の rbacMiddleware と同じ動作）
vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("actorRole", null);
      await next();
    },
  ),
  requireRole: vi.fn(
    () => async (c: { get: (key: string) => unknown }, next: () => Promise<void>) => {
      const actorRole = c.get("actorRole");
      if (!actorRole) {
        const { HTTPException } = await import("hono/http-exception");
        throw new HTTPException(403, { message: "Forbidden" });
      }
      await next();
    },
  ),
}));

import { app } from "../app.js";

describe("viewer guard — viewer ユーザーは業務 API で 403 を返す", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LINE メッセージ", () => {
    it("GET /api/line-messages は 403", async () => {
      const res = await app.request("/api/line-messages");
      expect(res.status).toBe(403);
    });

    it("PATCH /api/line-messages/:id/response-status は 403", async () => {
      const res = await app.request("/api/line-messages/msg-1/response-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseStatus: "responded" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("Chat メッセージ", () => {
    it("GET /api/chat-messages は 403", async () => {
      const res = await app.request("/api/chat-messages");
      expect(res.status).toBe(403);
    });
  });

  describe("Chat 同期", () => {
    it("POST /api/chat-messages/sync は 403", async () => {
      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("分類ルール", () => {
    it("PATCH /api/classification-rules/:category は 403", async () => {
      const res = await app.request("/api/classification-rules/salary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: ["test"] }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("LLM ルール", () => {
    it("POST /api/llm-rules は 403", async () => {
      const res = await app.request("/api/llm-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test", prompt: "test" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("監査ログ", () => {
    it("GET /api/audit-logs は 403", async () => {
      const res = await app.request("/api/audit-logs");
      expect(res.status).toBe(403);
    });
  });
});
