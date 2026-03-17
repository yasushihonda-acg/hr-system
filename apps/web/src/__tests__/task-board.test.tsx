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
    categories: [],
    workflowSteps: null,
    notes: null,
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

  it("taskSummary と content が別々の列に表示される", () => {
    const text = renderToText(
      React.createElement(TaskList, {
        tasks: [makeTask({ taskSummary: "給与テーブル更新依頼", content: "元のメッセージ" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(text).toContain("給与テーブル更新依頼");
    expect(text).toContain("元のメッセージ");
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

  it("gchat タスクで検索URLボタンが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "gchat", content: "給与変更をお願いします" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain('data-testid="icon-external-link"');
    expect(html).toContain("Google Chat でメッセージを検索して開く");
  });

  it("LINE タスクではURL列がダッシュ表示になる", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "line" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).not.toContain('data-testid="icon-external-link"');
  });

  it("テーブルヘッダーに記事のコピー・URL・タスク列が存在する", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask()],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("記事のコピー");
    expect(html).toContain("URL");
    expect(html).toContain(">タスク<");
  });

  it("カテゴリがある場合にバッジが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ categories: ["salary"] })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("給与・社保");
  });

  it("カテゴリが null の場合はダッシュが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ categories: [] })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("カテゴリ");
    // カテゴリ列にダッシュ（バッジなし）
    expect(html).not.toContain("給与・社保");
  });

  it("テーブルヘッダーにワークフローステップ列（❶❷❸❹）が存在する", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask()],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("❶");
    expect(html).toContain("❷");
    expect(html).toContain("❸");
    expect(html).toContain("❹");
  });

  it("テーブルヘッダーにメモ列が存在する", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask()],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("メモ");
  });

  it("給与カテゴリのタスクにワークフローステップボタンが表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [
          makeTask({
            source: "gchat",
            categories: ["salary"],
            workflowSteps: {
              salaryListReflection: "completed",
              noticeExecution: "undetermined",
              laborLawyerShare: "not_required",
              smartHRReflection: "undetermined",
            },
          }),
        ],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    // completed ステップの ✓ が表示される
    expect(html).toContain("✓");
    // not_required ステップの ✗ が表示される
    expect(html).toContain("✗");
    // undetermined ステップの ー が表示される
    expect(html).toContain("ー");
    expect(html).toContain("<button");
  });

  it("非給与カテゴリのタスクではステップボタンが非表示", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [
          makeTask({
            source: "line",
            categories: ["attendance"],
            workflowSteps: {
              salaryListReflection: "completed",
              smartHRReflection: "undetermined",
              noticeExecution: "undetermined",
              laborLawyerShare: "undetermined",
            },
          }),
        ],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    // ステップボタンは表示されない（✓/✗/!がない）
    expect(html).not.toContain("✓");
    expect(html).not.toContain("✗");
  });

  it("カテゴリ未設定のタスクではステップボタンが非表示", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [
          makeTask({
            source: "manual",
            categories: [],
            workflowSteps: {
              salaryListReflection: "undetermined",
              smartHRReflection: "undetermined",
              noticeExecution: "completed",
              laborLawyerShare: "undetermined",
            },
          }),
        ],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).not.toContain("✓");
  });

  it("LINE タスクでもメモ textarea が表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "line", notes: "LINEメモ" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("LINEメモ");
    expect(html).toContain("<textarea");
  });

  it("gchat タスクにメモ textarea が表示される", () => {
    const html = renderToHtml(
      React.createElement(TaskList, {
        tasks: [makeTask({ source: "gchat", notes: "テストメモ" })],
        selectedId: null,
        onSelect: mockOnSelect,
      }),
    );
    expect(html).toContain("テストメモ");
  });
});
