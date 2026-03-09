/**
 * タスクボード インタラクションテスト
 *
 * @testing-library/react + happy-dom で実際のクリックイベントを検証。
 * renderToStaticMarkup ベースの task-board.test.tsx を補完する。
 *
 * @vitest-environment happy-dom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- モック設定 ---

const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
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
    groupName: null,
    createdAt: "2026-03-01T09:00:00Z",
    ...overrides,
  };
}

// --- テスト ---

describe("TaskList クリックインタラクション", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("タスクをクリックすると router.replace が正しい URL で呼ばれる", () => {
    render(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-42", source: "gchat" })],
        selectedId: null,
      }),
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockReplace).toHaveBeenCalledOnce();
    expect(mockReplace).toHaveBeenCalledWith("/task-board?id=gchat-msg-42", { scroll: false });
  });

  it("LINE タスクをクリックすると source-id 形式の複合キーで URL が更新される", () => {
    render(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "line-msg-99", source: "line" })],
        selectedId: null,
      }),
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockReplace).toHaveBeenCalledWith("/task-board?id=line-line-msg-99", { scroll: false });
  });

  it("複数タスクがある場合、クリックしたタスクの複合 ID が URL に設定される", () => {
    render(
      React.createElement(TaskList, {
        tasks: [
          makeTask({ id: "msg-1", source: "gchat", senderName: "田中太郎" }),
          makeTask({ id: "msg-2", source: "gchat", senderName: "佐藤花子" }),
        ],
        selectedId: null,
      }),
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    // 2番目のタスクをクリック
    fireEvent.click(buttons[1]);

    expect(mockReplace).toHaveBeenCalledOnce();
    expect(mockReplace).toHaveBeenCalledWith("/task-board?id=gchat-msg-2", { scroll: false });
  });
});

describe("TaskDetailPanel クリックインタラクション", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("デスクトップ閉じるボタン(X)をクリックすると id が URL から削除される", () => {
    const task = makeTask({ id: "msg-42", source: "gchat" });
    render(React.createElement(TaskDetailPanel, { task }));

    // 閉じるボタンは2つ（モバイル戻る + デスクトップX）
    const buttons = screen.getAllByRole("button");
    // デスクトップ閉じるボタン（2番目）をクリック
    fireEvent.click(buttons[1]);

    expect(mockReplace).toHaveBeenCalledOnce();
    expect(mockReplace).toHaveBeenCalledWith("/task-board?", { scroll: false });
  });

  it("モバイル戻るボタンをクリックすると id が URL から削除される", () => {
    const task = makeTask({ id: "msg-42", source: "gchat" });
    render(React.createElement(TaskDetailPanel, { task }));

    // モバイル戻るボタン（1番目）をクリック
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);

    expect(mockReplace).toHaveBeenCalledOnce();
    expect(mockReplace).toHaveBeenCalledWith("/task-board?", { scroll: false });
  });
});
