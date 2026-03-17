import { beforeEach, describe, expect, it, vi } from "vitest";

// テスト用環境変数
process.env.LINE_CHANNEL_SECRET = "test-channel-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN = "test-access-token";

// モック設定
vi.mock("@line/bot-sdk", () => ({
  validateSignature: vi.fn(),
  messagingApi: {
    MessagingApiClient: vi.fn(),
  },
}));

vi.mock("@hr-system/db", () => ({
  collections: {
    lineMessages: {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true }),
      add: vi.fn().mockResolvedValue({ id: "doc-1", update: vi.fn().mockResolvedValue(undefined) }),
    },
  },
}));

vi.mock("@hr-system/ai", () => ({
  classifyIntent: vi.fn().mockResolvedValue({
    categories: ["attendance"],
    confidence: 0.92,
    reasoning: "勤務表に関する相談",
    classificationMethod: "regex",
    regexPattern: "attendance_schedule",
  }),
}));

vi.mock("../lib/classification-config.js", () => ({
  getClassificationConfig: vi.fn().mockResolvedValue({}),
}));

import { classifyIntent } from "@hr-system/ai";
import { collections } from "@hr-system/db";
import { validateSignature } from "@line/bot-sdk";
import { app } from "../app.js";

const mockClassifyIntent = vi.mocked(classifyIntent);

const mockValidateSignature = vi.mocked(validateSignature);

function createTextMessageEvent(overrides?: Record<string, unknown>) {
  return {
    type: "message",
    timestamp: 1709700000000,
    replyToken: "reply-token",
    source: {
      type: "group",
      groupId: "Cxxxxx",
      userId: "Uxxxxx",
    },
    message: {
      id: "msg-001",
      type: "text",
      text: "来月の勤務表について相談です",
    },
    ...overrides,
  };
}

describe("LINE Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateSignature.mockReturnValue(true);
    // lineMessages モックリセット
    const lm = collections.lineMessages;
    vi.mocked(lm.get).mockResolvedValue({ empty: true } as never);
    vi.mocked(lm.add).mockResolvedValue({
      id: "doc-1",
      update: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("署名検証失敗で 401 を返す", async () => {
    mockValidateSignature.mockReturnValue(false);

    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    expect(res.status).toBe(401);
  });

  it("署名検証なし（ヘッダー欠如）で 401 を返す", async () => {
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    expect(res.status).toBe(401);
  });

  it("空イベント配列で 200 を返す", async () => {
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [] }),
    });

    expect(res.status).toBe(200);
  });

  it("テキストメッセージを Firestore に保存する", async () => {
    const event = createTextMessageEvent();
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event] }),
    });

    expect(res.status).toBe(200);
    expect(collections.lineMessages.add).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: "Cxxxxx",
        lineMessageId: "msg-001",
        senderUserId: "Uxxxxx",
        content: "来月の勤務表について相談です",
        lineMessageType: "text",
      }),
    );
  });

  it("重複メッセージはスキップする", async () => {
    vi.mocked(collections.lineMessages.get).mockResolvedValue({ empty: false } as never);

    const event = createTextMessageEvent();
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event] }),
    });

    expect(res.status).toBe(200);
    expect(collections.lineMessages.add).not.toHaveBeenCalled();
  });

  it("グループ以外のメッセージはスキップする", async () => {
    const event = createTextMessageEvent({
      source: { type: "user", userId: "Uxxxxx" },
    });

    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event] }),
    });

    expect(res.status).toBe(200);
    expect(collections.lineMessages.add).not.toHaveBeenCalled();
  });

  it("テキストメッセージのカテゴリを自動分類して更新する", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(collections.lineMessages.add).mockResolvedValue({
      id: "doc-1",
      update: mockUpdate,
    } as never);

    const event = createTextMessageEvent();
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event] }),
    });

    expect(res.status).toBe(200);
    expect(mockClassifyIntent).toHaveBeenCalledWith(
      "来月の勤務表について相談です",
      undefined,
      expect.any(Object),
    );
    expect(mockUpdate).toHaveBeenCalledWith({ categories: ["attendance"] });
  });

  it("カテゴリ分類が失敗してもメッセージ保存は成功する", async () => {
    mockClassifyIntent.mockRejectedValueOnce(new Error("LLM unavailable"));

    const event = createTextMessageEvent();
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event] }),
    });

    expect(res.status).toBe(200);
    expect(collections.lineMessages.add).toHaveBeenCalled();
  });

  it("不正な JSON で 200 を返す（リトライ不要）", async () => {
    mockValidateSignature.mockReturnValue(true);
    const res = await app.request("/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "valid", "Content-Type": "application/json" },
      body: "not json {{{",
    });

    expect(res.status).toBe(200);
  });
});
