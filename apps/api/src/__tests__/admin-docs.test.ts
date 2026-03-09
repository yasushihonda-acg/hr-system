import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted でホイスト） ---
const { mockGet, mockGetCollection, mockBatchSet, mockBatchDelete, mockBatchCommit } = vi.hoisted(
  () => ({
    mockGet: vi.fn(),
    mockGetCollection: vi.fn(),
    mockBatchSet: vi.fn(),
    mockBatchDelete: vi.fn(),
    mockBatchCommit: vi.fn().mockResolvedValue(undefined),
  }),
);

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getRequestHeaders: vi.fn().mockResolvedValue({}) };
    }
  },
}));

// 現在のロール（テスト内で切り替え可能）
let currentDashboardRole: "admin" | "viewer" = "admin";

vi.mock("@hr-system/db", () => ({
  db: {
    batch: vi.fn(() => ({
      set: mockBatchSet,
      delete: mockBatchDelete,
      update: vi.fn(),
      commit: mockBatchCommit,
    })),
  },
  collections: {
    adminDocuments: {
      doc: vi.fn(() => ({ id: "doc-1", get: mockGet })),
      orderBy: vi.fn(() => ({ get: mockGetCollection })),
    },
    auditLogs: { doc: vi.fn(() => ({ id: "audit-1" })), add: vi.fn() },
    appConfig: {
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })),
    },
    chatMessages: {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    },
    lineMessages: {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      count: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    },
    syncMetadata: {
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() })),
    },
    chatSpaces: {
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    },
    allowedUsers: {
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      }),
    },
  },
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("user", {
        email: "admin@test.com",
        name: "Admin User",
        sub: "admin-sub",
        dashboardRole: currentDashboardRole,
      });
      await next();
    },
  ),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("actorRole", currentDashboardRole === "admin" ? "hr_staff" : null);
      await next();
    },
  ),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

import { app } from "../app.js";

describe("admin-docs routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDashboardRole = "admin";
  });

  describe("GET /api/admin/docs", () => {
    it("空の一覧を返す", async () => {
      mockGetCollection.mockResolvedValueOnce({ docs: [] });

      const res = await app.request("/api/admin/docs");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toEqual([]);
    });

    it("資料一覧を返す", async () => {
      const now = Timestamp.now();
      mockGetCollection.mockResolvedValueOnce({
        docs: [
          {
            id: "doc-1",
            data: () => ({
              title: "就業規則",
              description: "最新版",
              category: "規程",
              fileUrl: "https://storage.example.com/file.pdf",
              createdBy: "admin@test.com",
              createdAt: now,
              updatedAt: now,
            }),
          },
        ],
      });

      const res = await app.request("/api/admin/docs");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: Record<string, unknown>[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.title).toBe("就業規則");
      expect(body.data[0]!.category).toBe("規程");
    });

    it("viewer は 403", async () => {
      currentDashboardRole = "viewer";
      const res = await app.request("/api/admin/docs");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/admin/docs", () => {
    it("資料を追加する", async () => {
      const res = await app.request("/api/admin/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新規資料", category: "規程" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; id: string };
      expect(body.success).toBe(true);
      expect(body.id).toBe("doc-1");

      // batch.set が2回呼ばれる（資料 + 監査ログ）
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledOnce();

      const docArg = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>;
      expect(docArg.title).toBe("新規資料");
      expect(docArg.category).toBe("規程");
      expect(docArg.createdBy).toBe("admin@test.com");
    });

    it("タイトル未指定は 400", async () => {
      const res = await app.request("/api/admin/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("fileUrl が不正な URL は 400", async () => {
      const res = await app.request("/api/admin/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "テスト", fileUrl: "not-a-url" }),
      });

      expect(res.status).toBe(400);
    });

    it("viewer は 403", async () => {
      currentDashboardRole = "viewer";
      const res = await app.request("/api/admin/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "テスト" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/admin/docs/:id", () => {
    it("資料を削除する", async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ title: "削除対象" }),
      });

      const res = await app.request("/api/admin/docs/doc-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      expect(mockBatchDelete).toHaveBeenCalledOnce();
      expect(mockBatchSet).toHaveBeenCalledOnce(); // 監査ログ
      expect(mockBatchCommit).toHaveBeenCalledOnce();
    });

    it("存在しない資料は 404", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/admin/docs/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("viewer は 403", async () => {
      currentDashboardRole = "viewer";
      const res = await app.request("/api/admin/docs/doc-1", {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });
  });
});
