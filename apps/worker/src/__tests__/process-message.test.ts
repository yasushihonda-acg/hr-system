import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerError } from "../lib/errors.js";
import type { ChatEvent } from "../lib/event-parser.js";

// ---------------------------------------------------------------------------
// モック設定
// ---------------------------------------------------------------------------

const mockIsDuplicate = vi.fn();
vi.mock("../lib/dedup.js", () => ({ isDuplicate: mockIsDuplicate }));

const mockClassifyIntent = vi.fn();
vi.mock("@hr-system/ai", () => ({
  classifyIntent: mockClassifyIntent,
  extractSalaryParams: vi.fn(),
}));

const mockHandleSalary = vi.fn();
vi.mock("../pipeline/salary-handler.js", () => ({ handleSalary: mockHandleSalary }));

// Firestore モック
const mockChatMessageSet = vi.fn();
const mockChatMessageUpdate = vi.fn();
const mockChatMessageRef = {
  id: "chat-msg-001",
  set: mockChatMessageSet,
  update: mockChatMessageUpdate,
};

const mockIntentSet = vi.fn();
const mockIntentRef = { id: "intent-001", set: mockIntentSet };

const mockAuditSet = vi.fn();
const mockAuditRef = { id: "audit-001", set: mockAuditSet };

const mockRunTransaction = vi.fn();

vi.mock("@hr-system/db", () => ({
  db: {
    runTransaction: mockRunTransaction,
  },
  collections: {
    chatMessages: {
      doc: vi.fn(() => mockChatMessageRef),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
    },
    intentRecords: {
      doc: vi.fn(() => mockIntentRef),
    },
    auditLogs: {
      doc: vi.fn(() => mockAuditRef),
    },
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP") },
}));

// ---------------------------------------------------------------------------
// テストデータ
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    spaceName: "spaces/AAAA-qf5jX0",
    googleMessageId: "spaces/AAAA-qf5jX0/messages/abc123",
    senderUserId: "users/12345",
    senderName: "田中 太郎",
    senderType: "HUMAN",
    text: "山田さんの給与を2ピッチ上げてください",
    formattedText: null,
    messageType: "MESSAGE",
    threadName: null,
    parentMessageId: null,
    mentionedUsers: [],
    annotations: [],
    attachments: [],
    isEdited: false,
    isDeleted: false,
    rawPayload: {},
    createdAt: new Date("2026-02-19T10:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

const { processMessage } = await import("../pipeline/process-message.js");

describe("processMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: 重複なし
    mockIsDuplicate.mockResolvedValue(false);
    // デフォルト: 非給与カテゴリ
    mockClassifyIntent.mockResolvedValue({
      category: "other",
      confidence: 0.9,
      reasoning: "その他の指示",
      classificationMethod: "ai",
      regexPattern: null,
    });
    mockChatMessageSet.mockResolvedValue(undefined);
    mockChatMessageUpdate.mockResolvedValue(undefined);
    mockIntentSet.mockResolvedValue(undefined);
    mockRunTransaction.mockImplementation((fn: (tx: unknown) => Promise<void>) =>
      fn({ set: mockAuditSet }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("重複排除", () => {
    it("重複メッセージは早期リターンする（Firestore へ書き込まない）", async () => {
      mockIsDuplicate.mockResolvedValue(true);

      await processMessage(makeEvent());

      expect(mockChatMessageSet).not.toHaveBeenCalled();
      expect(mockClassifyIntent).not.toHaveBeenCalled();
    });
  });

  describe("正常フロー", () => {
    it("非給与カテゴリ: ChatMessage + IntentRecord を保存し、handleSalary を呼ばない", async () => {
      await processMessage(makeEvent());

      expect(mockChatMessageSet).toHaveBeenCalledOnce();
      expect(mockIntentSet).toHaveBeenCalledOnce();
      expect(mockHandleSalary).not.toHaveBeenCalled();
      expect(mockChatMessageUpdate).toHaveBeenCalledWith({
        processedAt: "SERVER_TIMESTAMP",
      });
    });

    it("給与カテゴリ: handleSalary を呼ぶ", async () => {
      mockClassifyIntent.mockResolvedValue({
        category: "salary",
        confidence: 0.95,
        reasoning: "給与変更指示",
        classificationMethod: "ai",
        regexPattern: null,
      });
      mockHandleSalary.mockResolvedValue(undefined);

      await processMessage(makeEvent());

      expect(mockHandleSalary).toHaveBeenCalledOnce();
      expect(mockHandleSalary).toHaveBeenCalledWith(
        mockChatMessageRef.id,
        expect.objectContaining({ text: "山田さんの給与を2ピッチ上げてください" }),
        expect.objectContaining({ category: "salary" }),
      );
    });

    it("ChatMessage の senderEmail に senderUserId をセットする（Phase 1）", async () => {
      await processMessage(makeEvent({ senderUserId: "users/99999" }));

      expect(mockChatMessageSet).toHaveBeenCalledWith(
        expect.objectContaining({ senderEmail: "users/99999" }),
      );
    });
  });

  describe("エラーハンドリング", () => {
    it("isDuplicate が失敗した場合は NACK (WorkerError shouldNack=true)", async () => {
      mockIsDuplicate.mockRejectedValue(new Error("Firestore connection error"));

      await expect(processMessage(makeEvent())).rejects.toThrow(WorkerError);
      await expect(processMessage(makeEvent())).rejects.toThrow(
        expect.objectContaining({ code: "DB_ERROR", shouldNack: true }),
      );
    });

    it("classifyIntent が失敗した場合は NACK (LLM_ERROR)", async () => {
      mockClassifyIntent.mockRejectedValue(new Error("Vertex AI timeout"));

      await expect(processMessage(makeEvent())).rejects.toThrow(
        expect.objectContaining({ code: "LLM_ERROR", shouldNack: true }),
      );
    });

    it("processedAt 更新が失敗してもエラーを throw しない（警告のみ）", async () => {
      mockChatMessageUpdate.mockRejectedValue(new Error("Update failed"));

      // エラーなく完了するべき
      await expect(processMessage(makeEvent())).resolves.toBeUndefined();
    });
  });
});
