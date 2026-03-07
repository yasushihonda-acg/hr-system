/**
 * Inbox 3ペインレイアウト テスト
 *
 * B0 (Inbox Foundation): 3ペインレイアウトのロジック・表示内容を検証
 * - レンダリング: ReactDOMServer.renderToStaticMarkup + HTMLタグ除去
 * - コンポーネントロジック: カテゴリラベル変換、ステータス色、空状態
 */
import React from "react";
import ReactDOMServer from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック設定 ---

const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("@/lib/constants", () => ({
  CATEGORY_LABELS: {
    salary: "給与・社保",
    retirement: "退職・休職",
    hiring: "入社・採用",
    contract: "契約変更",
    transfer: "施設・異動",
    foreigner: "外国人・ビザ",
    training: "研修・監査",
    health_check: "健康診断",
    attendance: "勤怠・休暇",
    other: "その他",
  },
  RESPONSE_STATUS_LABELS: {
    unresponded: "未対応",
    in_progress: "対応中",
    responded: "対応済",
    not_required: "対応不要",
  },
  RESPONSE_STATUS_DOT_COLORS: {
    unresponded: "bg-red-500",
    in_progress: "bg-yellow-500",
    responded: "bg-green-500",
    not_required: "bg-gray-400",
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatDateTimeJST: (d: string) => new Date(d).toLocaleString("ja-JP"),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("lucide-react", () => ({
  ExternalLink: () => React.createElement("span", { "data-testid": "icon-external-link" }),
  MessageSquare: () => React.createElement("span", { "data-testid": "icon-message-square" }),
  X: () => React.createElement("span", { "data-testid": "icon-x" }),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("div", { "data-slot": "tabs", ...props }, children as React.ReactNode),
  TabsList: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("div", { "data-slot": "tabs-list", ...props }, children as React.ReactNode),
  TabsTrigger: ({ children, value, ...props }: Record<string, unknown>) =>
    React.createElement("button", { "data-value": value, ...props }, children as React.ReactNode),
  TabsContent: ({ children, value, ...props }: Record<string, unknown>) =>
    React.createElement("div", { "data-value": value, ...props }, children as React.ReactNode),
}));

vi.mock("@/components/workflow-panel", () => ({
  WorkflowPanel: () => React.createElement("div", { "data-testid": "workflow-panel" }),
}));

vi.mock("../app/(protected)/inbox/handover-form", () => ({
  HandoverForm: ({ taskSummary, assignees, notes }: Record<string, unknown>) =>
    React.createElement(
      "div",
      { "data-testid": "handover-form" },
      [taskSummary, assignees, notes].filter(Boolean).join(","),
    ),
}));

vi.mock("../app/(protected)/inbox/actions", () => ({
  updateResponseStatusAction: vi.fn(),
  updateWorkflowAction: vi.fn(),
}));

import type { ChatMessageDetail, ChatMessageSummary } from "../lib/types";

const { Inbox3Pane } = await import("../app/(protected)/inbox/inbox-3pane");

// --- ヘルパー ---

function renderToText(element: React.ReactElement): string {
  const html = ReactDOMServer.renderToStaticMarkup(element);
  return html.replace(/<[^>]*>/g, "");
}

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

// --- テストデータ ---

function makeSummary(overrides: Partial<ChatMessageSummary> = {}): ChatMessageSummary {
  return {
    id: "msg-1",
    spaceId: "space-1",
    googleMessageId: "gm-1",
    senderUserId: "user-1",
    senderName: "田中太郎",
    senderType: "HUMAN",
    content: "給与変更をお願いします",
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
    createdAt: "2026-03-01T09:00:00Z",
    intent: {
      id: "intent-1",
      category: "salary",
      confidenceScore: 0.95,
      classificationMethod: "ai",
      regexPattern: null,
      isManualOverride: false,
      originalCategory: null,
      responseStatus: "unresponded",
      taskSummary: null,
      assignees: null,
      notes: null,
      workflowSteps: null,
      workflowUpdatedBy: null,
      workflowUpdatedAt: null,
      createdAt: "2026-03-01T09:00:00Z",
    },
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ChatMessageDetail> = {}): ChatMessageDetail {
  return {
    ...makeSummary(),
    rawPayload: null,
    intent: {
      id: "intent-1",
      category: "salary",
      confidenceScore: 0.95,
      classificationMethod: "ai",
      regexPattern: null,
      isManualOverride: false,
      originalCategory: null,
      responseStatus: "unresponded",
      taskSummary: null,
      assignees: null,
      notes: null,
      workflowSteps: null,
      workflowUpdatedBy: null,
      workflowUpdatedAt: null,
      createdAt: "2026-03-01T09:00:00Z",
      reasoning: "給与に関する依頼",
      overriddenBy: null,
      overriddenAt: null,
      responseStatusUpdatedBy: null,
      responseStatusUpdatedAt: null,
    },
    threadMessages: [],
    ...overrides,
  };
}

// --- テスト ---

describe("Inbox3Pane", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  describe("空状態", () => {
    it("メッセージが空の場合、空状態メッセージを表示する", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("該当するメッセージはありません");
    });
  });

  describe("メッセージ一覧（左ペイン）", () => {
    it("送信者名が表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary({ senderName: "田中太郎" })],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("田中太郎");
    });

    it("コンテンツのプレビューが表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary({ content: "給与変更をお願いします" })],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("給与変更をお願いします");
    });

    it("カテゴリが日本語ラベルで表示される (salary → 給与・社保)", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("給与・社保");
    });

    it("信頼度スコアがパーセント表示される (0.95 → 95%)", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("95%");
    });

    it("複数メッセージが一覧に表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [
            makeSummary({ id: "msg-1", senderName: "田中太郎" }),
            makeSummary({ id: "msg-2", senderName: "佐藤花子" }),
          ],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("田中太郎");
      expect(text).toContain("佐藤花子");
    });
  });

  describe("未選択状態（中央ペイン）", () => {
    it("メッセージ未選択時にプレースホルダーが表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(text).toContain("メッセージを選択してください");
    });
  });

  describe("詳細表示（中央+右ペイン）", () => {
    it("選択メッセージの送信者名と本文が表示される", () => {
      const detail = makeDetail({
        senderName: "田中太郎",
        content: "給与変更をお願いします",
      });
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: detail,
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("田中太郎");
      expect(text).toContain("給与変更をお願いします");
    });

    it("対応状況のステータスボタンが4つ表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("未対応");
      expect(text).toContain("対応中");
      expect(text).toContain("対応済");
      expect(text).toContain("対応不要");
    });

    it("AI判定パネルにカテゴリと信頼度が表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("AI 判定");
      expect(text).toContain("給与・社保");
      expect(text).toContain("95%");
    });

    it("分類方法がAI (Gemini)と表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("AI (Gemini)");
    });

    it("推論テキストが表示される", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("給与に関する依頼");
    });

    it("手動修正済みの場合にバッジと元カテゴリが表示される", () => {
      const detail = makeDetail({
        intent: {
          id: "intent-1",
          category: "retirement",
          confidenceScore: 0.8,
          classificationMethod: "ai",
          regexPattern: null,
          isManualOverride: true,
          originalCategory: "salary",
          responseStatus: "unresponded",
          taskSummary: null,
          assignees: null,
          notes: null,
          workflowSteps: null,
          workflowUpdatedBy: null,
          workflowUpdatedAt: null,
          createdAt: "2026-03-01T09:00:00Z",
          reasoning: null,
          overriddenBy: null,
          overriddenAt: null,
          responseStatusUpdatedBy: null,
          responseStatusUpdatedAt: null,
        },
      });
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: detail,
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("手動修正済");
      expect(text).toContain("給与・社保");
    });

    it("詳細ページへのリンクが存在する", () => {
      const html = renderToHtml(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(html).toContain('href="/chat-messages/msg-1"');
    });
  });

  describe("スレッド表示", () => {
    it("スレッドメッセージがある場合にタブとスレッド内容が表示される", () => {
      const detail = makeDetail({
        threadMessages: [
          {
            id: "tm-1",
            senderName: "佐藤花子",
            content: "了解しました",
            formattedContent: null,
            messageType: "THREAD_REPLY",
            mentionedUsers: [],
            createdAt: "2026-03-01T10:00:00Z",
          },
          {
            id: "tm-2",
            senderName: "鈴木一郎",
            content: "確認します",
            formattedContent: null,
            messageType: "THREAD_REPLY",
            mentionedUsers: [],
            createdAt: "2026-03-01T11:00:00Z",
          },
        ],
      });
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: detail,
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("メッセージ");
      expect(text).toContain("スレッド (2)");
      expect(text).toContain("佐藤花子");
      expect(text).toContain("了解しました");
      expect(text).toContain("鈴木一郎");
    });

    it("スレッドが空の場合はタブが表示されない", () => {
      const html = renderToHtml(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail({ threadMessages: [] }),
          selectedId: "msg-1",
        }),
      );
      expect(html).not.toContain('data-slot="tabs-list"');
    });
  });

  describe("intentがnullの場合", () => {
    it("intentがnullでもクラッシュしない", () => {
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary({ intent: null })],
          selectedMessage: makeDetail({ intent: null }),
          selectedId: "msg-1",
        }),
      );
      expect(text).not.toContain("AI 判定");
      expect(text).not.toContain("ワークフロー");
    });

    it("intentがnullでもステータスドットはデフォルト(unresponded)で表示される", () => {
      const html = renderToHtml(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary({ intent: null })],
          selectedMessage: null,
          selectedId: null,
        }),
      );
      expect(html).toContain("bg-red-500");
    });

    it("intentがnullの場合、引き継ぎメモが表示されない", () => {
      const html = renderToHtml(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary({ intent: null })],
          selectedMessage: makeDetail({ intent: null }),
          selectedId: "msg-1",
        }),
      );
      expect(html).not.toContain('data-testid="handover-form"');
    });
  });

  describe("引き継ぎメモ", () => {
    it("intentがある場合にHandoverFormが表示される", () => {
      const html = renderToHtml(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: makeDetail(),
          selectedId: "msg-1",
        }),
      );
      expect(html).toContain('data-testid="handover-form"');
    });

    it("taskSummaryがHandoverFormに渡される", () => {
      const base = makeDetail();
      const detail = makeDetail({
        intent: base.intent ? { ...base.intent, taskSummary: "給与テーブル更新" } : null,
      });
      const text = renderToText(
        React.createElement(Inbox3Pane, {
          messages: [makeSummary()],
          selectedMessage: detail,
          selectedId: "msg-1",
        }),
      );
      expect(text).toContain("給与テーブル更新");
    });
  });
});
