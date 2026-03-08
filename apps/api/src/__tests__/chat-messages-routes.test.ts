import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted でホイスト） ---
const { mockChatMessagesGet, mockIntentRecordsGet, mockIntentRecordsCountGet } = vi.hoisted(() => ({
  mockChatMessagesGet: vi.fn(),
  mockIntentRecordsGet: vi.fn(),
  mockIntentRecordsCountGet: vi.fn(),
}));

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
        where: vi.fn(() => {
          const q: Record<string, unknown> = {
            get: vi.fn(() => mockIntentRecordsGet()),
            count: vi.fn(() => ({
              get: vi.fn(() => mockIntentRecordsCountGet()),
            })),
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

    it("Intent フィルタ + ページネーション: offset/limit がフィルタ後に適用される", async () => {
      // 5件のメッセージ、うち3件が salary カテゴリ
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [
          makeChatDoc("msg-1"),
          makeChatDoc("msg-2"),
          makeChatDoc("msg-3"),
          makeChatDoc("msg-4"),
          makeChatDoc("msg-5"),
        ],
      });
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [
          ...makeIntentSnap("msg-1", 0.9, "unresponded").docs, // salary
          {
            id: "intent-msg-2",
            data: () => ({
              chatMessageId: "msg-2",
              category: "retirement",
              confidenceScore: 0.8,
              classificationMethod: "ai",
              isManualOverride: false,
              originalCategory: null,
              regexPattern: null,
              responseStatus: "unresponded",
              createdAt: now,
            }),
          },
          ...makeIntentSnap("msg-3", 0.7, "unresponded").docs, // salary
          {
            id: "intent-msg-4",
            data: () => ({
              chatMessageId: "msg-4",
              category: "retirement",
              confidenceScore: 0.8,
              classificationMethod: "ai",
              isManualOverride: false,
              originalCategory: null,
              regexPattern: null,
              responseStatus: "unresponded",
              createdAt: now,
            }),
          },
          ...makeIntentSnap("msg-5", 0.6, "unresponded").docs, // salary
        ],
      });

      // limit=2, offset=0 — salary のうち最初の2件（msg-1, msg-3）を返し hasMore=true
      const res = await app.request("/api/chat-messages?category=salary&limit=2&offset=0");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ id: string }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(body.data).toHaveLength(2);
      expect(body.data[0]!.id).toBe("msg-1");
      expect(body.data[1]!.id).toBe("msg-3");
      expect(body.pagination.hasMore).toBe(true);
    });

    it("Intent フィルタ + ページネーション: 2ページ目を正しく返す", async () => {
      // 同じ5件、salary が3件
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [
          makeChatDoc("msg-1"),
          makeChatDoc("msg-2"),
          makeChatDoc("msg-3"),
          makeChatDoc("msg-4"),
          makeChatDoc("msg-5"),
        ],
      });
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [
          ...makeIntentSnap("msg-1", 0.9, "unresponded").docs,
          {
            id: "intent-msg-2",
            data: () => ({
              chatMessageId: "msg-2",
              category: "retirement",
              confidenceScore: 0.8,
              classificationMethod: "ai",
              isManualOverride: false,
              originalCategory: null,
              regexPattern: null,
              responseStatus: "unresponded",
              createdAt: now,
            }),
          },
          ...makeIntentSnap("msg-3", 0.7, "unresponded").docs,
          {
            id: "intent-msg-4",
            data: () => ({
              chatMessageId: "msg-4",
              category: "retirement",
              confidenceScore: 0.8,
              classificationMethod: "ai",
              isManualOverride: false,
              originalCategory: null,
              regexPattern: null,
              responseStatus: "unresponded",
              createdAt: now,
            }),
          },
          ...makeIntentSnap("msg-5", 0.6, "unresponded").docs,
        ],
      });

      // limit=2, offset=2 — salary の3件目（msg-5）のみ、hasMore=false
      const res = await app.request("/api/chat-messages?category=salary&limit=2&offset=2");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ id: string }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-5");
      expect(body.pagination.hasMore).toBe(false);
    });

    it("Intent フィルタなしでは Firestore レベルのページネーションを使用する", async () => {
      // limit+1 件取得して hasMore 判定する従来ロジック
      mockChatMessagesGet.mockResolvedValueOnce({
        docs: [makeChatDoc("msg-1"), makeChatDoc("msg-2"), makeChatDoc("msg-3")],
      });
      mockIntentRecordsGet.mockResolvedValueOnce({
        docs: [
          ...makeIntentSnap("msg-1", 0.9).docs,
          ...makeIntentSnap("msg-2", 0.8).docs,
          // msg-3 は limit+1 の余剰分として切り捨てられる想定だが
          // モック上は 3件返す → hasMore=true, data は 2件
          ...makeIntentSnap("msg-3", 0.7).docs,
        ],
      });

      const res = await app.request("/api/chat-messages?limit=2&offset=0");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: Array<{ id: string }>;
        pagination: { limit: number; offset: number; hasMore: boolean };
      };
      // 3件返ったので hasMore=true、data は先頭2件
      expect(body.data).toHaveLength(2);
      expect(body.pagination.hasMore).toBe(true);
    });
  });

  describe("GET /api/chat-messages/inbox-counts", () => {
    it("対応状況別の件数を集計して返す", async () => {
      // count() クエリが各ステータスに対して順に呼ばれる
      // statuses: ["unresponded", "in_progress", "responded", "not_required"]
      mockIntentRecordsCountGet
        .mockResolvedValueOnce({ data: () => ({ count: 2 }) }) // unresponded
        .mockResolvedValueOnce({ data: () => ({ count: 1 }) }) // in_progress
        .mockResolvedValueOnce({ data: () => ({ count: 1 }) }) // responded
        .mockResolvedValueOnce({ data: () => ({ count: 2 }) }); // not_required

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

    it("ドキュメントが空の場合は全カウント0を返す", async () => {
      mockIntentRecordsCountGet
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

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
