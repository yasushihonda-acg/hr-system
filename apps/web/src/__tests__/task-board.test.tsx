/**
 * タスクボード テスト
 *
 * TaskList / TaskDetailPanel コンポーネントの表示・操作を検証
 * - renderToStaticMarkup + HTMLタグ除去パターン（inbox-3pane.test.tsx 準拠）
 */
import React from "react";
import ReactDOMServer from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("タスクがボタン要素で描画され、選択時にハイライトされる", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ id: "msg-42", source: "gchat" })],
        selectedId: "gchat-msg-42",
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("button");
    expect(html).toContain("bg-accent");
    // 注: 実際のクリックイベントテストは task-board-interaction.test.tsx を参照
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

  it("critical タスクに赤い border-l が表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ taskPriority: "critical" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("border-l-4");
    expect(html).toContain("border-l-red-500");
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
    expect(text).toContain("担当: 佐藤花子");
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

describe("TaskDetailPanel", () => {
  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("タスク詳細が正しく表示される（priority badge, status, sender, source）", () => {
    const task = makeTask({
      taskPriority: "high",
      responseStatus: "unresponded",
      senderName: "田中太郎",
      source: "gchat",
    });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("高");
    expect(text).toContain("未対応");
    expect(text).toContain("田中太郎");
    expect(text).toContain("Google Chat");
  });

  it("タスク概要がある場合は表示される", () => {
    const task = makeTask({ taskSummary: "給与テーブル更新依頼" });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("タスク概要");
    expect(text).toContain("給与テーブル更新依頼");
  });

  it("タスク概要がない場合は概要セクションが表示されない", () => {
    const task = makeTask({ taskSummary: null });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).not.toContain("タスク概要");
  });

  it("メッセージ本文が表示される", () => {
    const task = makeTask({ content: "給与変更をお願いします" });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("メッセージ");
    expect(text).toContain("給与変更をお願いします");
  });

  it("gchat タスクの「受信箱で開く」リンクが /inbox?id=xxx を持つ", () => {
    const task = makeTask({ id: "msg-42", source: "gchat" });
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(html).toContain('href="/inbox?id=msg-42"');
  });

  it("LINE タスクの「受信箱で開く」リンクが /inbox?source=line&id=xxx を持つ", () => {
    const task = makeTask({ id: "msg-99", source: "line" });
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(html).toContain('href="/inbox?source=line&amp;id=msg-99"');
  });

  it("閉じるボタンが存在する", () => {
    const task = makeTask();
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    // モバイル戻るボタン + デスクトップ閉じるボタン
    expect(html).toContain('data-testid="icon-arrow-left"');
    expect(html).toContain('data-testid="icon-x"');
  });

  it("担当者がある場合は表示される", () => {
    const task = makeTask({ assignees: "佐藤花子, 鈴木一郎" });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("担当者");
    expect(text).toContain("佐藤花子, 鈴木一郎");
  });

  it("担当者がない場合は担当者行が表示されない", () => {
    const task = makeTask({ assignees: null });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).not.toContain("担当者");
  });

  it("グループ名がある場合は表示される", () => {
    const task = makeTask({ groupName: "有川チーム" });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("グループ");
    expect(text).toContain("有川チーム");
  });

  it("グループ名がない場合はグループ行が表示されない", () => {
    const task = makeTask({ groupName: null });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).not.toContain("グループ");
  });

  it("LINE ソースの場合に LINE と表示される", () => {
    const task = makeTask({ source: "line" });
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("LINE");
  });

  it("critical タスクのヘッダーに赤い背景が適用される", () => {
    const task = makeTask({ taskPriority: "critical" });
    const html = renderToHtml(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(html).toContain("bg-red-50/80");
  });

  it("優先度バッジの色が正しい（critical: red, high: orange, medium: sky, low: slate）", () => {
    for (const [priority, colorFragment] of [
      ["critical", "bg-red-100"],
      ["high", "bg-orange-50"],
      ["medium", "bg-sky-50"],
      ["low", "bg-slate-50"],
    ] as const) {
      const task = makeTask({ taskPriority: priority });
      const html = renderToHtml(
        React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }),
      );
      expect(html).toContain(colorFragment);
    }
  });

  it("受信箱リンクのテキストが正しい", () => {
    const task = makeTask();
    const text = renderToText(React.createElement(TaskDetailPanel, { task, onClose: mockOnClose }));

    expect(text).toContain("受信箱で開く");
  });
});
