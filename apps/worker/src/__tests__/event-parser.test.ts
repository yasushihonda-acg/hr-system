import { describe, expect, it } from "vitest";
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
      expect(event?.text).toBe("山田さんの給与を2ピッチ上げてください");
    });

    it("createdAt が createTime から正しくパースされる", () => {
      const body = makePubSubBody({
        data: makeData(makeChatPayload({ createTime: "2026-02-19T10:00:00Z" })),
      });
      const event = parsePubSubEvent(body);
      expect(event?.createdAt).toEqual(new Date("2026-02-19T10:00:00Z"));
    });

    it("createTime がない場合は現在時刻を使用する", () => {
      const payload = makeChatPayload();
      (payload.message as { createTime?: string }).createTime = undefined;
      const body = makePubSubBody({ data: makeData(payload) });
      const before = new Date();
      const event = parsePubSubEvent(body);
      const after = new Date();
      expect(event?.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 100);
      expect(event?.createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 100);
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

    it("ce-type が message.created 以外の場合は null を返す", () => {
      const body = makePubSubBody({
        attributes: { "ce-type": "google.workspace.chat.message.v1.updated" },
      });
      expect(parsePubSubEvent(body)).toBeNull();
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
