import { describe, expect, it, vi } from "vitest";
import type { ChatApiClient } from "../lib/chat-api.js";
import { enrichChatEvent } from "../lib/enrich-event.js";
import type { ChatEvent } from "../lib/event-parser.js";

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

function makeMockClient(
  messageData: Record<string, unknown> | null,
  memberData: Record<string, unknown> | null = null,
): ChatApiClient {
  return {
    getMessage: vi.fn().mockResolvedValue(messageData),
    getMember: vi.fn().mockResolvedValue(memberData),
  };
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

describe("enrichChatEvent", () => {
  describe("API 成功 — フィールド補完", () => {
    it("formattedText が補完される", async () => {
      const client = makeMockClient({
        formattedText: "<b>山田</b>さんの給与を2ピッチ上げてください",
      });
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.formattedText).toBe("<b>山田</b>さんの給与を2ピッチ上げてください");
    });

    it("annotations が補完され mentionedUsers が再抽出される", async () => {
      const client = makeMockClient({
        annotations: [
          {
            type: "USER_MENTION",
            startIndex: 0,
            length: 4,
            userMention: {
              user: { name: "users/99999", displayName: "山田 花子", type: "HUMAN" },
              type: "MENTION",
            },
          },
        ],
      });
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0]?.type).toBe("USER_MENTION");
      expect(result.mentionedUsers).toEqual([{ userId: "users/99999", displayName: "山田 花子" }]);
    });

    it("attachments が補完される", async () => {
      const client = makeMockClient({
        attachment: [
          {
            name: "spaces/AAAA/messages/abc/attachments/file1",
            contentName: "document.pdf",
            contentType: "application/pdf",
            downloadUri: "https://example.com/file.pdf",
            source: "UPLOADED_CONTENT",
          },
        ],
      });
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]?.contentName).toBe("document.pdf");
      expect(result.attachments[0]?.source).toBe("UPLOADED_CONTENT");
    });

    it("API の formattedText が null/undefined の場合は元の値を維持する", async () => {
      const client = makeMockClient({ text: "テキストのみ" }); // formattedText なし
      const event = makeEvent({ formattedText: "<b>既存</b>" });

      const result = await enrichChatEvent(event, client);

      expect(result.formattedText).toBe("<b>既存</b>");
    });

    it("isEdited が lastUpdateTime で更新される", async () => {
      const client = makeMockClient({
        createTime: "2026-02-19T10:00:00Z",
        lastUpdateTime: "2026-02-19T10:05:00Z",
      });
      const event = makeEvent({ isEdited: false });

      const result = await enrichChatEvent(event, client);

      expect(result.isEdited).toBe(true);
    });

    it("isDeleted が deleteTime で更新される", async () => {
      const client = makeMockClient({
        deleteTime: "2026-02-19T10:10:00Z",
      });
      const event = makeEvent({ isDeleted: false });

      const result = await enrichChatEvent(event, client);

      expect(result.isDeleted).toBe(true);
    });

    it("mentionedUsers の displayName が空の場合 getMember で補完される", async () => {
      const client = makeMockClient(
        {
          annotations: [
            {
              type: "USER_MENTION",
              startIndex: 0,
              length: 4,
              userMention: {
                user: { name: "users/99999", displayName: "", type: "HUMAN" },
                type: "MENTION",
              },
            },
          ],
        },
        { member: { name: "users/99999", displayName: "山田 花子", type: "HUMAN" } },
      );
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.mentionedUsers).toEqual([{ userId: "users/99999", displayName: "山田 花子" }]);
      expect(client.getMember).toHaveBeenCalledWith("spaces/AAAA-qf5jX0/members/users/99999");
    });

    it("displayName が既にある場合 getMember は呼ばれない", async () => {
      const client = makeMockClient({
        annotations: [
          {
            type: "USER_MENTION",
            startIndex: 0,
            length: 4,
            userMention: {
              user: { name: "users/99999", displayName: "山田 花子", type: "HUMAN" },
              type: "MENTION",
            },
          },
        ],
      });
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.mentionedUsers).toEqual([{ userId: "users/99999", displayName: "山田 花子" }]);
      expect(client.getMember).not.toHaveBeenCalled();
    });

    it("getMember が null を返す場合 displayName は空文字のまま", async () => {
      const client = makeMockClient(
        {
          annotations: [
            {
              type: "USER_MENTION",
              startIndex: 0,
              length: 4,
              userMention: {
                user: { name: "users/99999", displayName: "", type: "HUMAN" },
                type: "MENTION",
              },
            },
          ],
        },
        null,
      );
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.mentionedUsers).toEqual([{ userId: "users/99999", displayName: "" }]);
    });

    it("senderName が Chat API の sender.displayName で更新される", async () => {
      const client = makeMockClient({
        sender: { name: "users/12345", displayName: "鈴木 一郎", type: "HUMAN" },
      });
      const event = makeEvent({ senderName: "" }); // Pub/Sub からは空

      const result = await enrichChatEvent(event, client);

      expect(result.senderName).toBe("鈴木 一郎");
    });

    it("sender.displayName がない場合は元の senderName を維持する", async () => {
      const client = makeMockClient({ formattedText: "テスト" }); // sender なし
      const event = makeEvent({ senderName: "田中 太郎" });

      const result = await enrichChatEvent(event, client);

      expect(result.senderName).toBe("田中 太郎");
    });

    it("sender.displayName が空の場合、getMember で senderName が補完される", async () => {
      const client = makeMockClient(
        { sender: { name: "users/12345", displayName: "", type: "HUMAN" } },
        { member: { name: "users/12345", displayName: "田中 太郎", type: "HUMAN" } },
      );
      const event = makeEvent({ senderName: "" });

      const result = await enrichChatEvent(event, client);

      expect(result.senderName).toBe("田中 太郎");
      expect(client.getMember).toHaveBeenCalledWith("spaces/AAAA-qf5jX0/members/users/12345");
    });

    it("sender.displayName が空で getMember が null の場合は event.senderName を維持する", async () => {
      const client = makeMockClient(
        { sender: { name: "users/12345", displayName: "", type: "HUMAN" } },
        null,
      );
      const event = makeEvent({ senderName: "田中 太郎" });

      const result = await enrichChatEvent(event, client);

      expect(result.senderName).toBe("田中 太郎");
      expect(client.getMember).toHaveBeenCalledWith("spaces/AAAA-qf5jX0/members/users/12345");
    });
  });

  describe("API 失敗 / null — best-effort", () => {
    it("getMessage が null を返す場合は元の event をそのまま返す", async () => {
      const client = makeMockClient(null);
      const event = makeEvent({ formattedText: "<b>元のテキスト</b>" });

      const result = await enrichChatEvent(event, client);

      expect(result).toEqual(event);
    });

    it("getMessage が例外をスローする場合は元の event をそのまま返す（NACK しない）", async () => {
      const client: ChatApiClient = {
        getMessage: vi.fn().mockRejectedValue(new Error("Network error")),
        getMember: vi.fn().mockResolvedValue(null),
      };
      const event = makeEvent();

      // 例外が throw されず、元の event が返ること
      const result = await enrichChatEvent(event, client);

      expect(result).toEqual(event);
    });
  });

  describe("元の event の不変性", () => {
    it("補完後も googleMessageId 等の元フィールドが保持される", async () => {
      const client = makeMockClient({
        formattedText: "<b>補完テキスト</b>",
      });
      const event = makeEvent();

      const result = await enrichChatEvent(event, client);

      expect(result.googleMessageId).toBe(event.googleMessageId);
      expect(result.spaceName).toBe(event.spaceName);
      expect(result.senderUserId).toBe(event.senderUserId);
      expect(result.text).toBe(event.text);
    });
  });
});
