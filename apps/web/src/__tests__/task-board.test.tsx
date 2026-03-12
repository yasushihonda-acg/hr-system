/**
 * タスクボード テスト
 *
 * TaskList コンポーネントの表示・操作を検証
 * - renderToStaticMarkup + HTMLタグ除去パターン（inbox-3pane.test.tsx 準拠）
 */
import React from "react";
import ReactDOMServer from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック設定 ---

const mockOnSelect = vi.fn();

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
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatDateTimeJST: (d: string) => new Date(d).toLocaleString("ja-JP"),
  formatDateJST: (d: string) => {
    const date = new Date(d);
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  },
}));

vi.mock("lucide-react", () => ({
  MessageSquareText: () => React.createElement("span", { "data-testid": "icon-gchat" }),
  MessageCircle: () => React.createElement("span", { "data-testid": "icon-line" }),
  ClipboardEdit: () => React.createElement("span", { "data-testid": "icon-manual" }),
  Clock: () => React.createElement("span", { "data-testid": "icon-clock" }),
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

// --- インポート ---

import type { TaskItem } from "../app/(protected)/task-board/task-list";

const { TaskList } = await import("../app/(protected)/task-board/task-list");

// --- ヘルパー ---

function renderToText(element: React.ReactElement): string {
  const html = ReactDOMServer.renderToStaticMarkup(element);
  return html.replace(/<[^>]*>/g, "");
}

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

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
    createdAt: "2026-03-01T09:00:00Z",
    ...overrides,
  };
}

// --- テスト ---

describe("TaskList", () => {
  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it("タスクが0件の場合「タスクはありません」が表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, { tasks: [], selectedId: null, onSelect: mockOnSelect }),
    );
    expect(text).toContain("タスクはありません");
  });

  it("タスク一覧が正しく描画される（senderName, content）", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ senderName: "田中太郎", content: "給与変更をお願いします" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("田中太郎");
    expect(text).toContain("給与変更をお願いします");
  });

  it("優先度ドットが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ taskPriority: "high" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain('data-testid="task-priority-dot"');
    expect(html).toContain('data-priority="high"');
  });

  it("gchat ソースの場合に Google Chat アイコンが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "gchat" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain('data-testid="icon-gchat"');
  });

  it("LINE ソースの場合に LINE アイコンが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "line" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain('data-testid="icon-line"');
  });

  it("タスクがテーブル行で描画され、選択時にハイライトされる", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-42", source: "gchat" })],
        selectedId: "gchat-msg-42",
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("<tr");
    expect(html).toContain("bg-accent");
  });

  it("selectedId に一致するタスクがハイライトされる", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-1", source: "gchat", taskPriority: "medium" })],
        selectedId: "gchat-msg-1",
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("bg-accent");
  });

  it("critical タスクに赤い背景が表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ taskPriority: "critical" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("bg-red-50");
  });

  it("LINE タスクにグループ名が表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "line", groupName: "有川チーム" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("有川チーム");
  });

  it("taskSummary がある場合は content の代わりに表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ taskSummary: "給与テーブル更新依頼", content: "元のメッセージ" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("給与テーブル更新依頼");
    expect(text).not.toContain("元のメッセージ");
  });

  it("担当者がある場合に表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ assignees: "佐藤花子" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("佐藤花子");
  });

  it("対応状況ラベルが表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ responseStatus: "in_progress" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("対応中");
  });
});
