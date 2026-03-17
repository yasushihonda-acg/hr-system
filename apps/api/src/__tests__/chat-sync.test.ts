import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数（vi.hoisted で vi.mock と同時にホイスト） ---
const {
  mockGetRequestHeaders,
  mockGet,
  mockSet,
  mockAdd,
  mockBatchUpdate,
  mockBatchSet,
  mockBatchCommit,
} = vi.hoisted(() => ({
  mockGetRequestHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
  mockBatchUpdate: vi.fn(),
  mockBatchSet: vi.fn(),
  mockBatchCommit: vi.fn().mockResolvedValue(undefined),
}));

// GoogleAuth をクラスベースでモック（vi.clearAllMocks() 耐性）
vi.mock("google-auth-library", () => ({
  GoogleAuth: class MockGoogleAuth {
    async getClient() {
      return { getRequestHeaders: mockGetRequestHeaders };
    }
  },
}));

// @hr-system/ai モック
vi.mock("@hr-system/ai", () => ({
  classifyIntent: vi.fn().mockResolvedValue({
    categories: ["salary"],
    confidence: 0.9,
    classificationMethod: "regex",
    regexPattern: "給与",
    reasoning: null,
  }),
}));

// Firestore モック
vi.mock("@hr-system/db", () => ({
  db: {
    batch: vi.fn(() => ({
      update: mockBatchUpdate,
      set: mockBatchSet,
      commit: mockBatchCommit,
    })),
  },
  collections: {
    syncMetadata: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    chatMessages: {
      doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
    },
    intentRecords: {
      doc: vi.fn(() => ({ id: "intent-new" })),
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
  loadClassificationConfig: vi.fn().mockResolvedValue({
    regexRules: [],
    systemPrompt: "",
    fewShotExamples: [],
  }),
}));

import { classifyIntent } from "@hr-system/ai";
import {
  getAuthHeaders,
  getSyncMetadata,
  syncChatMessages,
  updateSyncMetadata,
} from "../services/chat-sync.js";

const mockClassifyIntent = classifyIntent as ReturnType<typeof vi.fn>;

describe("chat-sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    );
  });

  describe("getAuthHeaders", () => {
    it("ADC で認証ヘッダー（x-goog-user-project 含む）を取得する", async () => {
      const headers = await getAuthHeaders();
      expect(headers).toEqual({ Authorization: "Bearer test-token" });
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

      const result = await syncChatMessages("AAAA-qf5jX0");
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

      // chatMessages.doc(docId).get() → 存在する（分類済み）
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ content: "既存メッセージ", processedAt: Timestamp.now() }),
      });

      const result = await syncChatMessages("AAAA-qf5jX0");
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

      const result = await syncChatMessages("AAAA-qf5jX0");
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

      await expect(syncChatMessages("AAAA-qf5jX0")).rejects.toThrow("Chat API エラー: 500");
    });

    it("annotations を Chat API レスポンスから保存する（空配列にハードコードしない）", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-ann1",
                sender: { displayName: "花子", name: "users/456", type: "HUMAN" },
                text: "メンション付きメッセージ",
                createTime: "2026-02-20T10:00:00Z",
                annotations: [
                  {
                    type: "USER_MENTION",
                    startIndex: 0,
                    length: 4,
                    userMention: {
                      user: { name: "users/789", displayName: "次郎", type: "HUMAN" },
                    },
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      // .set() に渡された引数を検証
      const setArg = mockSet.mock.calls.find(
        (call) => !call[1]?.merge, // merge: true でない呼び出し（chatMessages への保存）
      )?.[0] as Record<string, unknown>;

      expect(setArg).toBeDefined();
      const annotations = setArg.annotations as Array<Record<string, unknown>>;
      expect(annotations).toHaveLength(1);
      expect(annotations.at(0)?.type).toBe("USER_MENTION");
    });

    it("attachments を Chat API レスポンスから保存する（空配列にハードコードしない）", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-att1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "添付ファイル付きメッセージ",
                createTime: "2026-02-20T10:00:00Z",
                attachment: [
                  {
                    name: "spaces/AAAA/messages/msg-att1/attachments/att1",
                    contentName: "report.pdf",
                    contentType: "application/pdf",
                    downloadUri: "https://example.com/report.pdf",
                    source: "UPLOADED_CONTENT",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;

      expect(setArg).toBeDefined();
      const attachments = setArg.attachments as Array<Record<string, unknown>>;
      expect(attachments).toHaveLength(1);
      expect(attachments.at(0)?.contentName).toBe("report.pdf");
      expect(attachments.at(0)?.source).toBe("UPLOADED_CONTENT");
    });

    it("parentMessageId を quotedMessageMetadata.name から保存する", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-reply1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "返信メッセージ",
                createTime: "2026-02-20T10:00:00Z",
                quotedMessageMetadata: {
                  name: "spaces/AAAA/messages/msg-original",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;

      expect(setArg).toBeDefined();
      expect(setArg.parentMessageId).toBe("spaces/AAAA/messages/msg-original");
    });

    it("text が空で formattedText がある場合、content は空文字列になる（HTML を混入させない）", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-html1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "",
                formattedText: "<b>太字テキスト</b>",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;

      expect(setArg).toBeDefined();
      // content はプレーンテキストのみ — HTML タグを含む formattedText をフォールバックしない
      expect(setArg.content).toBe("");
      // formattedContent には formattedText が保存される
      expect(setArg.formattedContent).toBe("<b>太字テキスト</b>");
    });

    it("senderName が空の場合、People API で補完される", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              messages: [
                {
                  name: "spaces/AAAA/messages/msg-people1",
                  sender: { displayName: "", name: "users/123", type: "HUMAN" },
                  text: "People API テスト",
                  createTime: "2026-02-20T10:00:00Z",
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          // People API レスポンス（senderName 補完）
          new Response(JSON.stringify({ names: [{ displayName: "補完太郎" }] }), { status: 200 }),
        );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;
      expect(setArg).toBeDefined();
      expect(setArg.senderName).toBe("補完太郎");
    });

    it("mentionedUsers の displayName が空の場合、People API で補完される", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              messages: [
                {
                  name: "spaces/AAAA/messages/msg-mention1",
                  sender: { displayName: "送信者", name: "users/123", type: "HUMAN" },
                  text: "@次郎 へのメンション",
                  createTime: "2026-02-20T10:00:00Z",
                  annotations: [
                    {
                      type: "USER_MENTION",
                      startIndex: 0,
                      length: 3,
                      userMention: {
                        user: { name: "users/789", displayName: "", type: "HUMAN" },
                      },
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          // People API レスポンス（mentionedUsers displayName 補完）
          new Response(JSON.stringify({ names: [{ displayName: "補完次郎" }] }), { status: 200 }),
        );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;
      expect(setArg).toBeDefined();
      const mentionedUsers = setArg.mentionedUsers as Array<{
        userId: string;
        displayName: string;
      }>;
      expect(mentionedUsers).toHaveLength(1);
      expect(mentionedUsers.at(0)?.displayName).toBe("補完次郎");
    });

    it("People API が失敗した場合、senderName は「不明」になる", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              messages: [
                {
                  name: "spaces/AAAA/messages/msg-fail1",
                  sender: { displayName: "", name: "users/123", type: "HUMAN" },
                  text: "People API 失敗テスト",
                  createTime: "2026-02-20T10:00:00Z",
                },
              ],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          // People API → 404 失敗 → senderName は「不明」にフォールバック
          new Response("Not Found", { status: 404 }),
        );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;
      expect(setArg).toBeDefined();
      expect(setArg.senderName).toBe("不明");
    });

    it("新規メッセージ保存後に classifyIntent が呼ばれ IntentRecord がバッチ保存される", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-classify1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "給与を変更してください",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      await syncChatMessages("AAAA-qf5jX0");

      // classifyIntent が呼ばれたことを検証
      expect(mockClassifyIntent).toHaveBeenCalledWith(
        "給与を変更してください",
        undefined,
        expect.objectContaining({ regexRules: [], systemPrompt: "" }),
      );

      // バッチで IntentRecord が保存されたことを検証
      expect(mockBatchSet).toHaveBeenCalledWith(
        { id: "intent-new" },
        expect.objectContaining({
          categories: ["salary"],
          confidenceScore: 0.9,
          classificationMethod: "regex",
        }),
      );

      // processedAt がバッチで更新されたことを検証
      expect(mockBatchUpdate).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("保存済みで processedAt: null のメッセージは再分類される", async () => {
      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-reclassify1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "未分類メッセージ",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在するが processedAt: null（未分類）
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ content: "未分類メッセージ", processedAt: null }),
      });

      const result = await syncChatMessages("AAAA-qf5jX0");

      // 重複としてカウントされるが、再分類は実行される
      expect(result.duplicateSkipped).toBe(1);
      expect(result.newMessages).toBe(0);

      // classifyIntent が再分類のために呼ばれたことを検証
      expect(mockClassifyIntent).toHaveBeenCalledWith(
        "未分類メッセージ",
        undefined,
        expect.anything(),
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("分類失敗時は processedAt: null のまま保存される（次回再分類）", async () => {
      // classifyIntent を一時的にエラーにする
      mockClassifyIntent.mockRejectedValueOnce(new Error("AI service unavailable"));

      // getSyncMetadata → 既存なし
      mockGet.mockResolvedValueOnce({ exists: false });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              {
                name: "spaces/AAAA/messages/msg-failclass1",
                sender: { displayName: "太郎", name: "users/123", type: "HUMAN" },
                text: "分類失敗テスト",
                createTime: "2026-02-20T10:00:00Z",
              },
            ],
          }),
          { status: 200 },
        ),
      );

      // chatMessages.doc(docId).get() → 存在しない
      mockGet.mockResolvedValueOnce({ exists: false });

      const result = await syncChatMessages("AAAA-qf5jX0");

      // メッセージ自体は保存される
      expect(result.newMessages).toBe(1);

      // chatMessages.set() で processedAt: null のまま保存されている
      const setArg = mockSet.mock.calls.find((call) => !call[1]?.merge)?.[0] as Record<
        string,
        unknown
      >;
      expect(setArg).toBeDefined();
      expect(setArg.processedAt).toBeNull();

      // バッチの commit は呼ばれない（classifyIntent が失敗したため）
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });
});
