import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted で vi.mock と同時にホイスト） ---
const { mockGetAccessToken, mockGet, mockSet, mockAdd } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

// GoogleAuth をクラスベースでモック（vi.clearAllMocks() 耐性）
vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { getAccessToken: mockGetAccessToken };
    }
  },
}));

// Firestore モック
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

import {
  getAccessToken,
  getSyncMetadata,
  syncChatMessages,
  updateSyncMetadata,
} from "../services/chat-sync.js";

describe("chat-sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );
  });

  describe("getAccessToken", () => {
    it("ADC でトークンを取得する", async () => {
      const token = await getAccessToken();
      expect(token).toBe("test-token");
    });
  });

  describe("getSyncMetadata", () => {
    it("ドキュメントが存在する場合データを返す", async () => {
      const mockData = {
        status: "idle",
        lastSyncedAt: Timestamp.now(),
        lastResult: null,
        errorMessage: null,
        updatedAt: Timestamp.now(),
      };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => mockData });

      const result = await getSyncMetadata();
      expect(result).toEqual(mockData);
    });

    it("ドキュメントが存在しない場合 null を返す", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const result = await getSyncMetadata();
      expect(result).toBeNull();
    });
  });

  describe("updateSyncMetadata", () => {
    it("merge: true で更新する", async () => {
      await updateSyncMetadata({ status: "running" });
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "running" }), {
        merge: true,
      });
    });
  });

  describe("syncChatMessages", () => {
    it("新規メッセージを保存する", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      // fetch → Chat API レスポンス
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "テストメッセージ",
                createTime: "2026-02-20T10:00:00Z",
                thread: { name: "spaces/AAAA/threads/t1" },
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      const result = await syncChatMessages();
      expect(result.newMessages).toBe(1);
      expect(result.duplicateSkipped).toBe(0);
    });

    it("重複メッセージをスキップする", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      // fetch → Chat API レスポンス
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "既存メッセージ",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在する
      mockGet.mockResolvedValueOnce({ exists: true });

      const result = await syncChatMessages();
      expect(result.newMessages).toBe(0);
      expect(result.duplicateSkipped).toBe(1);
    });

    it("Bot メッセージをスキップする", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      // fetch → Bot メッセージ
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/bot1",
                sender: { displayName: "Bot", name: "users/bot", type: "BOT" },
                text: "自動応答",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const result = await syncChatMessages();
      expect(result.newMessages).toBe(0);
      expect(result.duplicateSkipped).toBe(0);
    });

    it("Chat API エラー時に例外を投げる", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      // fetch → 500 エラー
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(syncChatMessages()).rejects.toThrow("Chat API エラー: 500");
    });
  });
});
