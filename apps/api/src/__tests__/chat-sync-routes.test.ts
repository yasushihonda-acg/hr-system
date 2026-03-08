import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted で vi.mock と同時にホイスト） ---
const { mockGetRequestHeaders, mockGet, mockSet, mockAdd, mockRunTransaction } = vi.hoisted(() => ({
  mockGetRequestHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
  mockRunTransaction: vi.fn(),
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
    runTransaction: mockRunTransaction,
  },
  loadClassificationConfig: vi.fn().mockResolvedValue({
    regexRules: [],
    systemPrompt: "",
    fewShotExamples: [],
  }),
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
    chatSpaces: {
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    },
  },
}));

// 認証ミドルウェアのモック（admin ユーザーをセット）
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("user", {
        email: "admin@test.com",
        name: "Admin",
        sub: "sub-1",
        dashboardRole: "admin",
      });
      await next();
    },
  ),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("actorRole", "hr_manager");
      await next();
    },
  ),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { app } from "../app.js";

describe("chat-sync routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // syncChatMessages 内の getSyncMetadata() / chatMessages.doc().get() 等のデフォルト
    mockGet.mockResolvedValue({ exists: false });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );
  });

  describe("POST /api/chat-messages/sync", () => {
    it("同期完了後に結果を返す", async () => {
      // acquireSyncLock → 成功（トランザクション内で idle → running）
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<boolean>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status: "idle" }),
          }),
          set: vi.fn(),
        };
        return fn(tx);
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string; result: { newMessages: number } };
      expect(body.message).toBe("同期が完了しました");
      expect(body.result.newMessages).toBe(0);
    });

    it("409 で重複実行を防止する（トランザクションで検出）", async () => {
      const { Timestamp } = await import("firebase-admin/firestore");
      // acquireSyncLock → 失敗（running かつ stale でない）
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<boolean>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: "running",
              updatedAt: Timestamp.now(), // 直近更新 → stale ではない
            }),
          }),
          set: vi.fn(),
        };
        return fn(tx);
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("同期が既に実行中です");
    });

    it("stale lock を検出してロックを上書きする", async () => {
      const { Timestamp } = await import("firebase-admin/firestore");
      // 20分前の updatedAt → stale lock
      const staleDate = new Date(Date.now() - 20 * 60 * 1000);
      const mockTxSet = vi.fn();

      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<boolean>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: "running",
              updatedAt: Timestamp.fromDate(staleDate),
            }),
          }),
          set: mockTxSet,
        };
        return fn(tx);
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      // stale lock を上書きして同期成功
      expect(res.status).toBe(200);
      expect(mockTxSet).toHaveBeenCalled();
    });

    it("初回起動時（メタデータなし）にロックを取得できる", async () => {
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<boolean>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn(),
        };
        return fn(tx);
      });

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string };
      expect(body.message).toBe("同期が完了しました");
    });

    it("同期失敗時に 500 とエラーメッセージを返す", async () => {
      // ロック取得成功
      mockRunTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<boolean>) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn(),
        };
        return fn(tx);
      });

      // Chat API 呼び出しを失敗させる
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const res = await app.request("/api/chat-messages/sync", {
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("同期に失敗しました");
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
