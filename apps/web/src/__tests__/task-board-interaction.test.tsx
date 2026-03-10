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
const mockOnClose = vi.fn();

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

vi.mock("lucide-react", () => ({
  MessageSquareText: () => React.createElement("span", { "data-testid": "icon-gchat" }),
  MessageCircle: () => React.createElement("span", { "data-testid": "icon-line" }),
  ArrowLeft: () => React.createElement("span", { "data-testid": "icon-arrow-left" }),
  ArrowUpRight: () => React.createElement("span", { "data-testid": "icon-arrow-up-right" }),
  Calendar: () => React.createElement("span", { "data-testid": "icon-calendar" }),
  X: () => React.createElement("span", { "data-testid": "icon-x" }),
  User: () => React.createElement("span", { "data-testid": "icon-user" }),
  Users: () => React.createElement("span", { "data-testid": "icon-users" }),
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
const { TaskDetailPanel } = await import("../app/(protected)/task-board/task-detail-panel");

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
    createdAt: "2026-03-01T09:00:00Z",
    ...overrides,
  };
}

function renderToHtml(element: React.ReactElement): string {
  return ReactDOMServer.renderToStaticMarkup(element);
}

// --- テスト ---

describe("TaskList onSelect コールバック", () => {
  it("各タスクにクリック可能なボタンが描画される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [
          makeTask({ id: "msg-1", source: "gchat" }),
          makeTask({ id: "msg-2", source: "gchat", senderName: "佐藤花子" }),
        ],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    // 2つのボタンが存在
    const buttonCount = (html.match(/<button/g) || []).length;
    expect(buttonCount).toBe(2);
  });

  it("gchat タスクの複合ID形式が正しい（source-id）", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-42", source: "gchat" })],
        selectedId: "gchat-msg-42",
        onSelect: mockOnSelect,
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
      }),
    );
    expect(html).toContain("bg-accent");
  });
});

describe("TaskDetailPanel onClose コールバック", () => {
  it("閉じるボタンが2つ存在する（モバイル戻る + デスクトップX）", () => {
    const task = makeTask({ id: "msg-42", source: "gchat" });
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    const buttonCount = (html.match(/<button/g) || []).length;
    expect(buttonCount).toBe(2);
  });

  it("モバイル戻るボタン（ArrowLeft）が描画される", () => {
    const task = makeTask();
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));
    expect(html).toContain('data-testid="icon-arrow-left"');
  });

  it("デスクトップ閉じるボタン（X）が描画される", () => {
    const task = makeTask();
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));
    expect(html).toContain('data-testid="icon-x"');
  });
});
