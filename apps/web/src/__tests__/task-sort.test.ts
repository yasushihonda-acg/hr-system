import { describe, expect, it } from "vitest";
import type { TaskItem } from "../app/(protected)/task-board/task-list";
import { compareNullable, sortTasks } from "../app/(protected)/task-board/task-sort";

// --- テスト用ヘルパー ---
function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "1",
    source: "gchat",
    senderName: "太郎",
    content: "テスト",
    taskPriority: "medium",
    responseStatus: "unresponded",
    taskSummary: null,
    assignees: null,
    deadline: null,
    groupName: null,
    categories: [],
    workflowSteps: null,
    notes: null,
    createdAt: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

// --- compareNullable ---
describe("compareNullable", () => {
  const numCmp = (a: number, b: number) => a - b;

  it("both null → 0", () => {
    expect(compareNullable(null, null, numCmp, "asc")).toBe(0);
  });

  it("a=null → 末尾(1)", () => {
    expect(compareNullable(null, 5, numCmp, "asc")).toBe(1);
  });

  it("b=null → 前方(-1)", () => {
    expect(compareNullable(5, null, numCmp, "asc")).toBe(-1);
  });

  it("null末尾はソート方向に依存しない", () => {
    expect(compareNullable(null, 5, numCmp, "desc")).toBe(1);
    expect(compareNullable(5, null, numCmp, "desc")).toBe(-1);
  });

  it("asc: a < b → 負", () => {
    expect(compareNullable(1, 2, numCmp, "asc")).toBeLessThan(0);
  });

  it("desc: a < b → 正", () => {
    expect(compareNullable(1, 2, numCmp, "desc")).toBeGreaterThan(0);
  });

  it("both undefined → 0", () => {
    expect(compareNullable(undefined, undefined, numCmp, "asc")).toBe(0);
  });
});

// --- sortTasks ---
describe("sortTasks", () => {
  it("key=null → 元の順序を維持", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    const result = sortTasks(tasks, null, "asc");
    expect(result).toBe(tasks); // 同一参照
  });

  it("元配列を変更しない（immutable）", () => {
    const tasks = [
      makeTask({ id: "1", createdAt: "2026-03-02T00:00:00Z" }),
      makeTask({ id: "2", createdAt: "2026-03-01T00:00:00Z" }),
    ];
    const original = [...tasks];
    sortTasks(tasks, "createdAt", "asc");
    expect(tasks).toEqual(original);
  });

  describe("createdAt", () => {
    const tasks = [
      makeTask({ id: "a", createdAt: "2026-03-03T00:00:00Z" }),
      makeTask({ id: "b", createdAt: "2026-03-01T00:00:00Z" }),
      makeTask({ id: "c", createdAt: "2026-03-02T00:00:00Z" }),
    ];

    it("asc", () => {
      const result = sortTasks(tasks, "createdAt", "asc");
      expect(result.map((t) => t.id)).toEqual(["b", "c", "a"]);
    });

    it("desc", () => {
      const result = sortTasks(tasks, "createdAt", "desc");
      expect(result.map((t) => t.id)).toEqual(["a", "c", "b"]);
    });
  });

  describe("taskPriority", () => {
    const tasks = [
      makeTask({ id: "low", taskPriority: "low" }),
      makeTask({ id: "critical", taskPriority: "critical" }),
      makeTask({ id: "high", taskPriority: "high" }),
      makeTask({ id: "medium", taskPriority: "medium" }),
    ];

    it("asc: critical → high → medium → low", () => {
      const result = sortTasks(tasks, "taskPriority", "asc");
      expect(result.map((t) => t.id)).toEqual(["critical", "high", "medium", "low"]);
    });

    it("desc: low → medium → high → critical", () => {
      const result = sortTasks(tasks, "taskPriority", "desc");
      expect(result.map((t) => t.id)).toEqual(["low", "medium", "high", "critical"]);
    });
  });

  describe("taskSummary（null末尾）", () => {
    const tasks = [
      makeTask({ id: "null", taskSummary: null }),
      makeTask({ id: "b", taskSummary: "タスクB" }),
      makeTask({ id: "a", taskSummary: "タスクA" }),
    ];

    it("asc: A → B → null", () => {
      const result = sortTasks(tasks, "taskSummary", "asc");
      expect(result.map((t) => t.id)).toEqual(["a", "b", "null"]);
    });

    it("desc: B → A → null", () => {
      const result = sortTasks(tasks, "taskSummary", "desc");
      expect(result.map((t) => t.id)).toEqual(["b", "a", "null"]);
    });
  });

  describe("source", () => {
    const tasks = [
      makeTask({ id: "manual", source: "manual" }),
      makeTask({ id: "gchat", source: "gchat" }),
      makeTask({ id: "line", source: "line" }),
    ];

    it("asc: gchat → line → manual", () => {
      const result = sortTasks(tasks, "source", "asc");
      expect(result.map((t) => t.id)).toEqual(["gchat", "line", "manual"]);
    });
  });

  describe("categories（空配列末尾）", () => {
    const tasks = [
      makeTask({ id: "empty", categories: [] }),
      makeTask({ id: "salary", categories: ["salary_insurance"] }),
      makeTask({ id: "attend", categories: ["attendance_leave"] }),
    ];

    it("asc: 先頭カテゴリでソート、空配列は末尾", () => {
      const result = sortTasks(tasks, "categories", "asc");
      expect(result.map((t) => t.id)).toEqual(["attend", "salary", "empty"]);
    });

    it("desc: 逆順、空配列は末尾", () => {
      const result = sortTasks(tasks, "categories", "desc");
      expect(result.map((t) => t.id)).toEqual(["salary", "attend", "empty"]);
    });
  });

  describe("assignees（null末尾）", () => {
    const tasks = [
      makeTask({ id: "null", assignees: null }),
      makeTask({ id: "tanaka", assignees: "田中" }),
      makeTask({ id: "suzuki", assignees: "鈴木" }),
    ];

    it("asc: 日本語ロケール順でソート、null末尾", () => {
      const result = sortTasks(tasks, "assignees", "asc");
      // localeCompare("ja") による順序: 田中 < 鈴木
      expect(result.map((t) => t.id)).toEqual(["tanaka", "suzuki", "null"]);
    });
  });

  describe("responseStatus", () => {
    const tasks = [
      makeTask({ id: "responded", responseStatus: "responded" }),
      makeTask({ id: "unresponded", responseStatus: "unresponded" }),
      makeTask({ id: "in_progress", responseStatus: "in_progress" }),
      makeTask({ id: "not_required", responseStatus: "not_required" }),
    ];

    it("asc: unresponded → in_progress → responded → not_required", () => {
      const result = sortTasks(tasks, "responseStatus", "asc");
      expect(result.map((t) => t.id)).toEqual([
        "unresponded",
        "in_progress",
        "responded",
        "not_required",
      ]);
    });
  });

  describe("deadline（null末尾）", () => {
    const tasks = [
      makeTask({ id: "null", deadline: null }),
      makeTask({ id: "later", deadline: "2026-04-01T00:00:00Z" }),
      makeTask({ id: "earlier", deadline: "2026-03-01T00:00:00Z" }),
    ];

    it("asc: earlier → later → null", () => {
      const result = sortTasks(tasks, "deadline", "asc");
      expect(result.map((t) => t.id)).toEqual(["earlier", "later", "null"]);
    });

    it("desc: later → earlier → null", () => {
      const result = sortTasks(tasks, "deadline", "desc");
      expect(result.map((t) => t.id)).toEqual(["later", "earlier", "null"]);
    });
  });

  describe("全null", () => {
    it("taskSummary 全null → 順序変わらず", () => {
      const tasks = [
        makeTask({ id: "a", taskSummary: null }),
        makeTask({ id: "b", taskSummary: null }),
      ];
      const result = sortTasks(tasks, "taskSummary", "asc");
      expect(result.map((t) => t.id)).toEqual(["a", "b"]);
    });
  });

  describe("同値", () => {
    it("同じ優先度 → 安定ソート（元の順序維持）", () => {
      const tasks = [
        makeTask({ id: "a", taskPriority: "high" }),
        makeTask({ id: "b", taskPriority: "high" }),
        makeTask({ id: "c", taskPriority: "high" }),
      ];
      const result = sortTasks(tasks, "taskPriority", "asc");
      expect(result.map((t) => t.id)).toEqual(["a", "b", "c"]);
    });
  });
});
