import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerError } from "../lib/errors.js";
import type { ChatEvent } from "../lib/event-parser.js";

// ---------------------------------------------------------------------------
// モック設定
// ---------------------------------------------------------------------------

const mockEnrichChatEvent = vi.fn();
vi.mock("../lib/enrich-event.js", () => ({ enrichChatEvent: mockEnrichChatEvent }));

vi.mock("../lib/chat-api.js", () => ({
  createChatApiClient: vi.fn(() => ({})),
}));

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

// クエリ用の get モック（スレッドコンテキスト取得で使用）
const mockChatMessagesQueryGet = vi.fn();
const mockIntentRecordsQueryGet = vi.fn();

vi.mock("@hr-system/db", () => {
  // chatMessages のクエリチェーン: .where().orderBy().limit().get()
  // vi.fn().mockReturnThis() は vi.mock ファクトリ内では this が未定義になるため
  // 明示的なチェーンオブジェクトを使用する
  const chatMsgsChain: Record<string, unknown> = {};
  chatMsgsChain.orderBy = vi.fn(() => chatMsgsChain);
  chatMsgsChain.limit = vi.fn(() => chatMsgsChain);
  chatMsgsChain.get = mockChatMessagesQueryGet;

  // intentRecords のクエリチェーン: .where().limit().get()
  const intentChain: Record<string, unknown> = {};
  intentChain.limit = vi.fn(() => intentChain);
  intentChain.get = mockIntentRecordsQueryGet;

  return {
    db: {
      runTransaction: mockRunTransaction,
    },
    collections: {
      chatMessages: {
        doc: vi.fn(() => mockChatMessageRef),
        where: vi.fn(() => chatMsgsChain),
      },
      intentRecords: {
        doc: vi.fn(() => mockIntentRef),
        where: vi.fn(() => intentChain),
      },
      auditLogs: {
        doc: vi.fn(() => mockAuditRef),
      },
    },
  };
});

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

/** Firestore ドキュメントスナップショットを模倣するヘルパー */
function makeDocSnapshot(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

/** Firestore クエリスナップショットを模倣するヘルパー */
function makeQuerySnapshot(docs: ReturnType<typeof makeDocSnapshot>[]) {
  return { empty: docs.length === 0, docs, size: docs.length };
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

const { processMessage } = await import("../pipeline/process-message.js");

describe("processMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: enrichChatEvent は event をそのまま返す
    mockEnrichChatEvent.mockImplementation((event: ChatEvent) => Promise.resolve(event));
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
    // デフォルト: スレッドコンテキストなし（空のクエリ結果）
    mockChatMessagesQueryGet.mockResolvedValue(makeQuerySnapshot([]));
    mockIntentRecordsQueryGet.mockResolvedValue(makeQuerySnapshot([]));
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

  describe("スレッドコンテキスト（Step 3.5）", () => {
    it("threadName が null の場合、classifyIntent は context なしで呼ばれる", async () => {
      // threadName: null（デフォルト）
      await processMessage(makeEvent({ threadName: null }));

      expect(mockClassifyIntent).toHaveBeenCalledWith(
        expect.any(String),
        undefined, // context なし
      );
      // スレッド検索クエリは実行されない
      expect(mockChatMessagesQueryGet).not.toHaveBeenCalled();
    });

    it("スレッド返信: 親メッセージが存在する場合、ThreadContext が classifyIntent に渡される", async () => {
      const THREAD_NAME = "spaces/AAAA-qf5jX0/threads/thread-001";
      const PARENT_DOC_ID = "parent-chat-msg-001";

      // 親メッセージのクエリ結果
      mockChatMessagesQueryGet.mockResolvedValue(
        makeQuerySnapshot([
          makeDocSnapshot(PARENT_DOC_ID, {
            content: "田中さんの給与変更をお願いします",
            threadName: THREAD_NAME,
          }),
          makeDocSnapshot("chat-msg-001", {
            content: "承知しました",
            threadName: THREAD_NAME,
          }),
        ]),
      );

      // 親の IntentRecord
      mockIntentRecordsQueryGet.mockResolvedValue(
        makeQuerySnapshot([
          makeDocSnapshot("intent-parent-001", {
            chatMessageId: PARENT_DOC_ID,
            category: "salary",
            confidenceScore: 0.95,
          }),
        ]),
      );

      await processMessage(
        makeEvent({
          threadName: THREAD_NAME,
          messageType: "THREAD_REPLY",
          text: "承知しました",
        }),
      );

      expect(mockClassifyIntent).toHaveBeenCalledWith(
        "承知しました",
        expect.objectContaining({
          parentCategory: "salary",
          parentConfidence: 0.95,
          parentSnippet: "田中さんの給与変更をお願いします",
          replyCount: 1,
        }),
      );
    });

    it("スレッド返信: getThreadContext が失敗しても best-effort で処理を続行する", async () => {
      const THREAD_NAME = "spaces/AAAA-qf5jX0/threads/thread-002";

      // Firestore クエリがエラー
      mockChatMessagesQueryGet.mockRejectedValue(new Error("Firestore unavailable"));

      // エラーなく完了し、classifyIntent は context なしで呼ばれる
      await expect(
        processMessage(
          makeEvent({
            threadName: THREAD_NAME,
            messageType: "THREAD_REPLY",
            text: "確認しました",
          }),
        ),
      ).resolves.toBeUndefined();

      expect(mockClassifyIntent).toHaveBeenCalledWith("確認しました", undefined);
    });

    it("スレッド返信: 親 IntentRecord が存在しない場合、デフォルト値（category: other, confidence: 0）を使用", async () => {
      const THREAD_NAME = "spaces/AAAA-qf5jX0/threads/thread-003";
      const PARENT_DOC_ID = "parent-chat-msg-003";

      // 親メッセージは存在するが IntentRecord は未作成
      mockChatMessagesQueryGet.mockResolvedValue(
        makeQuerySnapshot([
          makeDocSnapshot(PARENT_DOC_ID, {
            content: "よろしくお願いします",
            threadName: THREAD_NAME,
          }),
        ]),
      );
      mockIntentRecordsQueryGet.mockResolvedValue(makeQuerySnapshot([]));

      await processMessage(
        makeEvent({
          threadName: THREAD_NAME,
          messageType: "THREAD_REPLY",
          text: "了解です",
        }),
      );

      expect(mockClassifyIntent).toHaveBeenCalledWith(
        "了解です",
        expect.objectContaining({
          parentCategory: "other",
          parentConfidence: 0,
          parentSnippet: "よろしくお願いします",
          replyCount: 0,
        }),
      );
    });
  });
});
