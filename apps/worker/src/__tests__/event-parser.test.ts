import { describe, expect, it, vi } from "vitest";
import { WorkerError } from "../lib/errors.js";
import { parsePubSubEvent } from "../lib/event-parser.js";

// ---------------------------------------------------------------------------
// テストヘルパー
// ---------------------------------------------------------------------------

function makeData(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function makePubSubBody(overrides: {
  data?: string;
  messageId?: string;
  attributes?: Record<string, string>;
  subscription?: string;
}) {
  return {
    message: {
      data: overrides.data ?? makeData(makeChatPayload()),
      messageId: overrides.messageId ?? "msg-001",
      publishTime: "2026-02-19T00:00:00Z",
      attributes: overrides.attributes,
    },
    subscription:
      overrides.subscription ?? "projects/hr-system-487809/subscriptions/hr-chat-events-sub",
  };
}

function makeChatPayload(
  overrides: {
    name?: string;
    senderType?: string;
    senderName?: string;
    displayName?: string;
    text?: string;
    createTime?: string;
  } = {},
) {
  return {
    message: {
      name: overrides.name ?? "spaces/AAAA-qf5jX0/messages/abc123",
      sender: {
        name: overrides.senderName ?? "users/12345",
        type: overrides.senderType ?? "HUMAN",
        displayName: overrides.displayName ?? "田中 太郎",
      },
      text: overrides.text ?? "山田さんの給与を2ピッチ上げてください",
      createTime: overrides.createTime ?? "2026-02-19T10:00:00Z",
      space: { name: "spaces/AAAA-qf5jX0" },
    },
  };
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

describe("parsePubSubEvent", () => {
  describe("正常系", () => {
    it("human の message.created イベントを正しくパースする", () => {
      const body = makePubSubBody({});
      const event = parsePubSubEvent(body);

      expect(event).not.toBeNull();
      expect(event?.spaceName).toBe("spaces/AAAA-qf5jX0");
      expect(event?.googleMessageId).toBe("spaces/AAAA-qf5jX0/messages/abc123");
      expect(event?.senderUserId).toBe("users/12345");
      expect(event?.senderName).toBe("田中 太郎");
      expect(event?.senderType).toBe("HUMAN");
      expect(event?.text).toBe("山田さんの給与を2ピッチ上げてください");
      expect(event?.messageType).toBe("MESSAGE");
      expect(event?.threadName).toBeNull();
      expect(event?.mentionedUsers).toEqual([]);
      expect(event?.annotations).toEqual([]);
      expect(event?.attachments).toEqual([]);
      expect(event?.isEdited).toBe(false);
      expect(event?.isDeleted).toBe(false);
    });

    it("createdAt が createTime から正しくパースされる", () => {
      const body = makePubSubBody({
        data: makeData(makeChatPayload({ createTime: "2026-02-19T10:00:00Z" })),
      });
      const event = parsePubSubEvent(body);
      expect(event?.createdAt).toEqual(new Date("2026-02-19T10:00:00Z"));
    });

    it("createTime がない場合は現在時刻を使用する", () => {
      vi.setSystemTime(new Date("2026-02-19T10:00:00Z"));
      const payload = makeChatPayload();
      (payload.message as { createTime?: string }).createTime = undefined;
      const body = makePubSubBody({ data: makeData(payload) });
      const event = parsePubSubEvent(body);
      expect(event?.createdAt).toEqual(new Date("2026-02-19T10:00:00Z"));
      vi.useRealTimers();
    });

    it("ce-type が message.created の場合はパースする", () => {
      const body = makePubSubBody({
        attributes: { "ce-type": "google.workspace.chat.message.v1.created" },
      });
      expect(parsePubSubEvent(body)).not.toBeNull();
    });
  });

  describe("無視するケース（null を返す）", () => {
    it("Bot 投稿は null を返す", () => {
      const body = makePubSubBody({
        data: makeData(makeChatPayload({ senderType: "BOT" })),
      });
      expect(parsePubSubEvent(body)).toBeNull();
    });

    it("ce-type が message.created 以外（deleted 等）の場合は null を返す", () => {
      const body = makePubSubBody({
        attributes: { "ce-type": "google.workspace.chat.message.v1.deleted" },
      });
      expect(parsePubSubEvent(body)).toBeNull();
    });

    it("ce-type が message.updated の場合はパースする（編集イベント対応）", () => {
      const body = makePubSubBody({
        attributes: { "ce-type": "google.workspace.chat.message.v1.updated" },
      });
      expect(parsePubSubEvent(body)).not.toBeNull();
    });

    it("Chat App ADDED_TO_SPACE イベントは null を返す", () => {
      const body = makePubSubBody({
        data: makeData({
          type: "ADDED_TO_SPACE",
          space: { name: "spaces/AAAA-qf5jX0", type: "ROOM" },
          user: { name: "users/123", displayName: "Admin" },
        }),
      });
      expect(parsePubSubEvent(body)).toBeNull();
    });

    it("Chat App REMOVED_FROM_SPACE イベントは null を返す", () => {
      const body = makePubSubBody({
        data: makeData({
          type: "REMOVED_FROM_SPACE",
          space: { name: "spaces/AAAA-qf5jX0" },
          user: { name: "users/123" },
        }),
      });
      expect(parsePubSubEvent(body)).toBeNull();
    });

    it("Chat App CARD_CLICKED イベントは null を返す", () => {
      const body = makePubSubBody({
        data: makeData({ type: "CARD_CLICKED", action: { actionMethodName: "approve" } }),
      });
      expect(parsePubSubEvent(body)).toBeNull();
    });
  });

  describe("Chat App Pub/Sub 接続形式（type フィールドあり）", () => {
    it("type=MESSAGE のイベントを正しくパースする", () => {
      const chatAppPayload = {
        type: "MESSAGE",
        eventTime: "2026-02-19T10:00:00Z",
        message: makeChatPayload().message,
        space: { name: "spaces/AAAA-qf5jX0", type: "ROOM", displayName: "HR" },
        user: { name: "users/12345", displayName: "田中 太郎", type: "HUMAN" },
      };
      const body = makePubSubBody({ data: makeData(chatAppPayload) });
      const event = parsePubSubEvent(body);

      expect(event).not.toBeNull();
      expect(event?.spaceName).toBe("spaces/AAAA-qf5jX0");
      expect(event?.senderType).toBe("HUMAN");
      expect(event?.text).toBe("山田さんの給与を2ピッチ上げてください");
    });
  });

  describe("エラーケース", () => {
    it("body が null の場合は WorkerError(PARSE_ERROR) をスロー", () => {
      expect(() => parsePubSubEvent(null)).toThrow(WorkerError);
      expect(() => parsePubSubEvent(null)).toThrow(
        expect.objectContaining({ code: "PARSE_ERROR" }),
      );
    });

    it("body が文字列の場合は WorkerError をスロー", () => {
      expect(() => parsePubSubEvent("invalid")).toThrow(WorkerError);
    });

    it("message.data が不正な base64 の場合は WorkerError をスロー", () => {
      const body = {
        message: {
          data: "!!!invalid-base64!!!",
          messageId: "x",
          publishTime: "2026-02-19T00:00:00Z",
        },
        subscription: "sub",
      };
      // base64 デコードは失敗しないが、JSON パースが失敗する
      expect(() => parsePubSubEvent(body)).toThrow(WorkerError);
    });

    it("data が有効な base64 だが JSON でない場合は WorkerError をスロー", () => {
      const body = makePubSubBody({ data: Buffer.from("not-json").toString("base64") });
      expect(() => parsePubSubEvent(body)).toThrow(WorkerError);
    });

    it("message フィールドがない payload は WorkerError をスロー", () => {
      const body = makePubSubBody({ data: makeData({ noMessage: true }) });
      expect(() => parsePubSubEvent(body)).toThrow(WorkerError);
    });

    it("message.name が不正フォーマットの場合は WorkerError をスロー", () => {
      const body = makePubSubBody({
        data: makeData(makeChatPayload({ name: "invalid-name" })),
      });
      expect(() => parsePubSubEvent(body)).toThrow(WorkerError);
    });
  });
});
