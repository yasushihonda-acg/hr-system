import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted で vi.mock と同時にホイスト） ---
const { mockGetAccessToken, mockGet, mockSet, mockAdd } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { getAccessToken: mockGetAccessToken };
    }
  },
}));

vi.mock("@hr-system/db", () => ({
  db: {},
  collections: {
    syncMetadata: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    chatMessages: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    auditLogs: {
      add: mockAdd,
    },
  },
}));

// 認証ミドルウェアのモック
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { app } from "../app.js";

describe("chat-sync routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );
  });

  describe("POST /api/chat-messages/sync", () => {
    it("202 で同期を開始する", async () => {
      // getSyncMetadata → idle
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "idle" }),
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(202);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("同期を開始しました");
    });

    it("409 で重複実行を防止する", async () => {
      // getSyncMetadata → running
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "running" }),
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("同期が既に実行中です");
    });
  });

  describe("GET /api/chat-messages/sync/status", () => {
    it("メタデータがない場合 idle を返す", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/chat-messages/sync/status");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; lastSyncedAt: string | null };
      expect(body.status).toBe("idle");
      expect(body.lastSyncedAt).toBeNull();
    });

    it("メタデータがある場合ステータスを返す", async () => {
      const { Timestamp } = await import("firebase-admin/firestore");
      const now = Timestamp.now();
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "idle",
          lastSyncedAt: now,
          lastResult: {
            newMessages: 5,
            duplicateSkipped: 2,
            durationMs: 1234,
            syncedAt: now,
          },
          errorMessage: null,
        }),
      });

      const res = await app.request("/api/chat-messages/sync/status");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; lastResult: { newMessages: number } };
      expect(body.status).toBe("idle");
      expect(body.lastResult.newMessages).toBe(5);
    });
  });
});
