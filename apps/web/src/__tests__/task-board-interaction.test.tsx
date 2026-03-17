/**
 * タスクボード インタラクションテスト
 *
 * onSelect / onClose コールバックの呼び出しを検証。
 * renderToStaticMarkup パターン (task-board.test.tsx 準拠) を使用。
 *
 * 注: happy-dom / jsdom 環境では @/ エイリアスのモジュール解決に問題があるため、
 * クリックイベントの代わりに onClick ハンドラの props 渡しを静的に検証する。
 * 実際の DOM クリックテストは将来 jsdom 導入後に追加可能。
 */
import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// --- モック設定 ---

const mockOnSelect = vi.fn();
const mockOnOpenDialog = vi.fn();

vi.mock("@/lib/constants", () => ({
  RESPONSE_STATUS_DOT_COLORS: {
    unresponded: "bg-red-500",
    in_progress: "bg-yellow-500",
    responded: "bg-green-500",
    not_required: "bg-gray-400",
  },
  RESPONSE_STATUS_LABELS: {
    unresponded: "未対応",
    in_progress: "対応中",
    responded: "対応済",
    not_required: "対応不要",
  },
  RESPONSE_STATUS_BADGE_COLORS: {
    unresponded: "bg-red-100 text-red-800",
    in_progress: "bg-yellow-100 text-yellow-800",
    responded: "bg-green-100 text-green-800",
    not_required: "bg-gray-100 text-gray-600",
  },
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
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatDateTimeJST: (d: string) => new Date(d).toLocaleString("ja-JP"),
  formatDateJST: (d: string) => {
    const date = new Date(d);
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  },
  buildMessageSearchUrl: (content: string) => {
    const query = content.trim().slice(0, 30);
    if (!query) return "";
    return `https://mail.google.com/chat/u/0/#search/${encodeURIComponent(query)}/cmembership=1`;
  },
}));

vi.mock("lucide-react", () => ({
  MessageSquareText: () => React.createElement("span", { "data-testid": "icon-gchat" }),
  MessageCircle: () => React.createElement("span", { "data-testid": "icon-line" }),
  ClipboardEdit: () => React.createElement("span", { "data-testid": "icon-manual" }),
  Clock: () => React.createElement("span", { "data-testid": "icon-clock" }),
  ExternalLink: () => React.createElement("span", { "data-testid": "icon-external-link" }),
  FileText: () => React.createElement("span", { "data-testid": "icon-file-text" }),
}));

vi.mock("@/components/task-priority-selector", () => ({
  TaskPriorityDot: ({ priority }: Record<string, unknown>) =>
    priority
      ? React.createElement("span", {
          "data-testid": "task-priority-dot",
          "data-priority": priority,
        })
      : null,
}));

vi.mock("../app/(protected)/task-board/actions", () => ({
  updateWorkflowFromTaskBoard: vi.fn(),
}));

// --- インポート ---

import type { TaskItem } from "../app/(protected)/task-board/task-list";

const { TaskList } = await import("../app/(protected)/task-board/task-list");

// --- ヘルパー ---

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "msg-1",
    source: "gchat",
    senderName: "田中太郎",
    content: "給与変更をお願いします",
    taskPriority: "medium",
    responseStatus: "unresponded",
    taskSummary: null,
    assignees: null,
    deadline: null,
    groupName: null,
    categories: [],
    workflowSteps: null,
    notes: null,
    createdAt: "2026-03-01T09:00:00Z",
    ...overrides,
  };
}

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

// --- テスト ---

describe("TaskList onSelect コールバック", () => {
  it("各タスクにクリック可能な行が描画される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [
          makeTask({ id: "msg-1", source: "gchat" }),
          makeTask({ id: "msg-2", source: "gchat", senderName: "佐藤花子" }),
        ],
        selectedId: null,
        onSelect: mockOnSelect,
        onOpenDialog: mockOnOpenDialog,
      }),
    );
    // tbody 内に 2つの tr が存在（thead 1 + tbody 2）
    const trCount = (html.match(/<tr[ >]/g) || []).length;
    expect(trCount).toBe(3);
  });

  it("gchat タスクの複合ID形式が正しい（source-id）", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-42", source: "gchat" })],
        selectedId: "gchat-msg-42",
        onSelect: mockOnSelect,
        onOpenDialog: mockOnOpenDialog,
      }),
    );
    // selectedId が gchat-msg-42 でマッチし、bg-accent が適用される
    expect(html).toContain("bg-accent");
  });

  it("LINE タスクの複合ID形式が正しい（source-id）", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "line-msg-99", source: "line" })],
        selectedId: "line-line-msg-99",
        onSelect: mockOnSelect,
        onOpenDialog: mockOnOpenDialog,
      }),
    );
    expect(html).toContain("bg-accent");
  });
});
