import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted でホイスト） ---
const { mockGet, mockBatchSet, mockBatchUpdate, mockBatchCommit } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
}));

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
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
  },
  collections: {
    appConfig: {
      doc: vi.fn(() => ({ get: mockGet })),
    },
    auditLogs: { doc: vi.fn(() => ({ id: "audit-1" })) },
    // 他ルートが必要とするコレクション（app.ts のインポートで参照される）
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
    syncMetadata: { doc: vi.fn(() => ({ get: mockGet, set: vi.fn() })) },
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

describe("admin-config routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDashboardRole = "admin";
  });

  describe("GET /api/admin/config", () => {
    it("ドキュメント未作成の場合デフォルト値を返す", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/admin/config");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(body.data).toEqual({
        appName: "HR-AI Agent",
        companyName: "",
        defaultTimezone: "Asia/Tokyo",
        notificationEnabled: false,
        dataRetentionDays: 365,
        updatedAt: null,
        updatedBy: null,
      });
    });

    it("既存ドキュメントの値を返す", async () => {
      const now = Timestamp.now();
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          appName: "MyApp",
          companyName: "あおぞら株式会社",
          defaultTimezone: "Asia/Tokyo",
          notificationEnabled: true,
          dataRetentionDays: 730,
          updatedAt: now,
          updatedBy: "admin@test.com",
        }),
      });

      const res = await app.request("/api/admin/config");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(body.data.appName).toBe("MyApp");
      expect(body.data.companyName).toBe("あおぞら株式会社");
      expect(body.data.notificationEnabled).toBe(true);
      expect(body.data.dataRetentionDays).toBe(730);
    });

    it("viewer は 403", async () => {
      currentDashboardRole = "viewer";
      const res = await app.request("/api/admin/config");
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/admin/config", () => {
    it("初回更新時はデフォルト値とマージして作成する", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: "カスタム名" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);

      // batch.set が2回呼ばれる（config作成 + 監査ログ）
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledOnce();

      const configArg = mockBatchSet.mock.calls[0]![1] as Record<string, unknown>;
      expect(configArg.appName).toBe("カスタム名");
      expect(configArg.companyName).toBe(""); // デフォルト値
      expect(configArg.notificationEnabled).toBe(false); // デフォルト値

      // 監査ログ
      const auditArg = mockBatchSet.mock.calls[1]![1] as Record<string, unknown>;
      expect(auditArg.eventType).toBe("config_updated");
    });

    it("既存ドキュメントを部分更新する", async () => {
      mockGet.mockResolvedValueOnce({ exists: true });

      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEnabled: true, dataRetentionDays: 180 }),
      });

      expect(res.status).toBe(200);
      expect(mockBatchUpdate).toHaveBeenCalledOnce();
      expect(mockBatchCommit).toHaveBeenCalledOnce();

      const updateArg = mockBatchUpdate.mock.calls[0]![1] as Record<string, unknown>;
      expect(updateArg.notificationEnabled).toBe(true);
      expect(updateArg.dataRetentionDays).toBe(180);
    });

    it("空の更新は 400", async () => {
      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("バリデーションエラー: 無効なタイムゾーン", async () => {
      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTimezone: "Invalid/Zone" }),
      });

      expect(res.status).toBe(400);
    });

    it("バリデーションエラー: dataRetentionDays が範囲外", async () => {
      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataRetentionDays: 5 }), // min 30
      });

      expect(res.status).toBe(400);
    });

    it("viewer は 403", async () => {
      currentDashboardRole = "viewer";
      const res = await app.request("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: "test" }),
      });
      expect(res.status).toBe(403);
    });
  });
});
