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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts?: unknown) {}
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

      await syncChatMessages();

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

      await syncChatMessages();

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

      await syncChatMessages();

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

      await syncChatMessages();

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
  });
});
