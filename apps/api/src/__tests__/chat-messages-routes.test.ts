import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted でホイスト） ---
const { mockChatMessagesGet, mockIntentRecordsGet, mockIntentRecordsCollectionGet } = vi.hoisted(
  () => ({
    mockChatMessagesGet: vi.fn(),
    mockIntentRecordsGet: vi.fn(),
    mockIntentRecordsCollectionGet: vi.fn(),
  }),
);

vi.mock("@hr-system/db", () => {
  const chatMessagesQuery: Record<string, unknown> = {};
  chatMessagesQuery.where = vi.fn(() => chatMessagesQuery);
  chatMessagesQuery.orderBy = vi.fn(() => chatMessagesQuery);
  chatMessagesQuery.limit = vi.fn(() => chatMessagesQuery);
  chatMessagesQuery.offset = vi.fn(() => chatMessagesQuery);
  chatMessagesQuery.get = vi.fn(() => mockChatMessagesGet());

  return {
    db: {},
    collections: {
      chatMessages: {
        orderBy: vi.fn(() => chatMessagesQuery),
      },
      intentRecords: {
        get: vi.fn(() => mockIntentRecordsCollectionGet()),
        where: vi.fn(() => {
          const q: Record<string, unknown> = {
            get: vi.fn(() => mockIntentRecordsGet()),
          };
          q.where = vi.fn(() => q);
          q.limit = vi.fn(() => q);
          q.orderBy = vi.fn(() => q);
          return q;
        }),
      },
    },
  };
});

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("actorRole", "hr_manager");
      c.set("user", { email: "test@example.com" });
      await next();
    },
  ),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

import { app } from "../app.js";

const now = Timestamp.fromDate(new Date("2026-01-15T10:00:00Z"));

function makeChatDoc(id: string) {
  return {
    id,
    data: () => ({
      spaceId: "space-1",
      googleMessageId: `google-${id}`,
      senderUserId: "user-1",
      senderName: "Test User",
      senderType: "HUMAN",
      content: "Test message",
      formattedContent: null,
      messageType: "MESSAGE",
      threadName: null,
      parentMessageId: null,
      mentionedUsers: [],
      annotations: [],
      attachments: [],
      isEdited: false,
      isDeleted: false,
      processedAt: null,
      createdAt: now,
    }),
  };
}

function makeIntentSnap(
  id: string,
  confidenceScore: number,
  responseStatus: string = "unresponded",
) {
  return {
    docs: [
      {
        id: `intent-${id}`,
        data: () => ({
          chatMessageId: id,
          category: "salary",
          confidenceScore,
          classificationMethod: "ai",
          isManualOverride: false,
          originalCategory: null,
          regexPattern: null,
          responseStatus,
          createdAt: now,
        }),
      },
    ],
  };
}

describe("chat-messages routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/chat-messages", () => {
    it("maxConfidence なしで全メッセージを返す", async () => {
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2")],
      });
      // バッチクエリ (in) で一括取得: 1回のget()で全件返す
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [...makeIntentSnap("msg-1", 0.5).docs, ...makeIntentSnap("msg-2", 0.9).docs],
      });

      const res = await app.request("/api/chat-messages");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: unknown[] };
      expect(body.data).toHaveLength(2);
    });

    it("maxConfidence=0.7 で信頼度 >= 0.7 のメッセージを除外する", async () => {
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2"), makeChatDoc("msg-3")],
      });
      // msg-1: confidence=0.5（通過）, msg-2: confidence=0.7（除外: ちょうど境界）, msg-3: confidence=0.9（除外）
      // バッチクエリ (in) で一括取得
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [
          ...makeIntentSnap("msg-1", 0.5).docs,
          ...makeIntentSnap("msg-2", 0.7).docs,
          ...makeIntentSnap("msg-3", 0.9).docs,
        ],
      });

      const res = await app.request("/api/chat-messages?maxConfidence=0.7");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-1");
    });

    it("maxConfidence=0.7 で intent が null のメッセージを除外する", async () => {
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2")],
      });
      // msg-1: intent なし（除外）, msg-2: confidence=0.5（通過）
      // バッチクエリ (in) でmsg-1のintentは存在しないためdocsに含まれない
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [...makeIntentSnap("msg-2", 0.5).docs],
      });

      const res = await app.request("/api/chat-messages?maxConfidence=0.7");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-2");
    });

    it("responseStatus=in_progress で対応中のメッセージのみ返す", async () => {
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2"), makeChatDoc("msg-3")],
      });
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [
          ...makeIntentSnap("msg-1", 0.8, "unresponded").docs,
          ...makeIntentSnap("msg-2", 0.8, "in_progress").docs,
          ...makeIntentSnap("msg-3", 0.8, "responded").docs,
        ],
      });

      const res = await app.request("/api/chat-messages?responseStatus=in_progress");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-2");
    });

    it("responseStatus フィルタで intent が null のメッセージを除外する", async () => {
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2")],
      });
      // msg-1 の intent は存在しない
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [...makeIntentSnap("msg-2", 0.8, "responded").docs],
      });

      const res = await app.request("/api/chat-messages?responseStatus=responded");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-2");
    });

    it("responseStatus=unresponded で intent が null のメッセージも除外する", async () => {
      // intent が null の場合、responseStatus のデフォルトは "unresponded" だが
      // 実装上は intent == null のときフィルタ外となる
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2")],
      });
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [...makeIntentSnap("msg-2", 0.8, "unresponded").docs],
      });

      const res = await app.request("/api/chat-messages?responseStatus=unresponded");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      // msg-1 は intent null → 除外, msg-2 は unresponded → 通過
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-2");
    });
  });

  describe("GET /api/chat-messages/inbox-counts", () => {
    it("対応状況別の件数を集計して返す", async () => {
      mockIntentRecordsCollectionGet.mockResolvedValueOnce({
        docs: [
          { data: () => ({ responseStatus: "unresponded" }) },
          { data: () => ({ responseStatus: "unresponded" }) },
          { data: () => ({ responseStatus: "in_progress" }) },
          { data: () => ({ responseStatus: "responded" }) },
          { data: () => ({ responseStatus: "not_required" }) },
          { data: () => ({ responseStatus: "not_required" }) },
        ],
      });

      const res = await app.request("/api/chat-messages/inbox-counts");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        counts: {
          unresponded: number;
          in_progress: number;
          responded: number;
          not_required: number;
        };
      };
      expect(body.counts).toEqual({
        unresponded: 2,
        in_progress: 1,
        responded: 1,
        not_required: 2,
      });
    });

    it("responseStatus が未設定のドキュメントを unresponded としてカウントする", async () => {
      mockIntentRecordsCollectionGet.mockResolvedValueOnce({
        docs: [
          { data: () => ({ responseStatus: undefined }) },
          { data: () => ({}) },
          { data: () => ({ responseStatus: "responded" }) },
        ],
      });

      const res = await app.request("/api/chat-messages/inbox-counts");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        counts: {
          unresponded: number;
          in_progress: number;
          responded: number;
          not_required: number;
        };
      };
      expect(body.counts.unresponded).toBe(2);
      expect(body.counts.responded).toBe(1);
    });

    it("ドキュメントが空の場合は全カウント0を返す", async () => {
      mockIntentRecordsCollectionGet.mockResolvedValueOnce({ docs: [] });

      const res = await app.request("/api/chat-messages/inbox-counts");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        counts: {
          unresponded: number;
          in_progress: number;
          responded: number;
          not_required: number;
        };
      };
      expect(body.counts).toEqual({
        unresponded: 0,
        in_progress: 0,
        responded: 0,
        not_required: 0,
      });
    });
  });
});
