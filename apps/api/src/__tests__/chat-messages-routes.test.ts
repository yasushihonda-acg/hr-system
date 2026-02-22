import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted でホイスト） ---
const { mockChatMessagesGet, mockIntentRecordsGet } = vi.hoisted(() => ({
  mockChatMessagesGet: vi.fn(),
  mockIntentRecordsGet: vi.fn(),
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
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => mockIntentRecordsGet()),
          })),
        })),
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

function makeIntentSnap(id: string, confidenceScore: number) {
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
          responseStatus: "unresponded",
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
      mockIntentRecordsGet
        .mockResolvedValueOnce(makeIntentSnap("msg-1", 0.5))
        .mockResolvedValueOnce(makeIntentSnap("msg-2", 0.9));

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
      mockIntentRecordsGet
        .mockResolvedValueOnce(makeIntentSnap("msg-1", 0.5))
        .mockResolvedValueOnce(makeIntentSnap("msg-2", 0.7))
        .mockResolvedValueOnce(makeIntentSnap("msg-3", 0.9));

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
      mockIntentRecordsGet
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce(makeIntentSnap("msg-2", 0.5));

      const res = await app.request("/api/chat-messages?maxConfidence=0.7");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Array<{ id: string }> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("msg-2");
    });
  });
});
