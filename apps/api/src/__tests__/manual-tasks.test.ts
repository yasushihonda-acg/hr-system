import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- モック変数 ---
const {
  mockAdd,
  mockDocGet,
  mockDocUpdate,
  mockDocDelete,
  mockListGet,
  mockCountGet,
  mockAuditAdd,
} = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockDocGet: vi.fn(),
  mockDocUpdate: vi.fn(),
  mockDocDelete: vi.fn(),
  mockListGet: vi.fn(),
  mockCountGet: vi.fn(),
  mockAuditAdd: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getRequestHeaders: vi.fn().mockResolvedValue({}) };
    }
  },
}));

let currentDashboardRole: "admin" | "viewer" = "admin";

const manualTasksQuery: Record<string, unknown> = {};
manualTasksQuery.where = vi.fn(() => manualTasksQuery);
manualTasksQuery.orderBy = vi.fn(() => manualTasksQuery);
manualTasksQuery.limit = vi.fn(() => manualTasksQuery);
manualTasksQuery.offset = vi.fn(() => manualTasksQuery);
manualTasksQuery.count = vi.fn(() => ({ get: mockCountGet }));
manualTasksQuery.get = mockListGet;

vi.mock("@hr-system/db", () => ({
  db: {},
  collections: {
    manualTasks: {
      add: mockAdd,
      doc: vi.fn(() => ({
        id: "task-1",
        get: mockDocGet,
        update: mockDocUpdate,
        delete: mockDocDelete,
      })),
      orderBy: vi.fn(() => manualTasksQuery),
      where: vi.fn(() => manualTasksQuery),
    },
    auditLogs: { add: mockAuditAdd },
    // 他ルートが要求するコレクション（空スタブ）
    chatMessages: {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    },
    lineMessages: {
      orderBy: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      count: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      })),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    },
    appConfig: {
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })),
    },
    allowedUsers: {
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      }),
    },
    chatSpaces: {
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    },
    syncMetadata: {
      doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() })),
    },
  },
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("user", {
        email: "admin@test.com",
        name: "Admin User",
        sub: "admin-sub",
        dashboardRole: currentDashboardRole,
      });
      await next();
    },
  ),
}));

vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set("actorRole", currentDashboardRole === "admin" ? "hr_staff" : null);
      await next();
    },
  ),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

import { app } from "../app.js";

// --- ヘルパー ---
const now = Timestamp.fromDate(new Date("2026-03-10T10:00:00Z"));

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    title: "テストタスク",
    content: "詳細メモ",
    taskPriority: "medium",
    responseStatus: "unresponded",
    assignees: null,
    createdBy: "admin@test.com",
    createdByName: "Admin User",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDocSnap(id: string, data: Record<string, unknown>) {
  return { id, exists: true, data: () => data };
}

describe("manual-tasks routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentDashboardRole = "admin";
  });

  // --- GET /api/manual-tasks ---
  describe("GET /api/manual-tasks", () => {
    it("空の一覧を返す", async () => {
      mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 0 }) });
      mockListGet.mockResolvedValueOnce({ docs: [] });

      const res = await app.request("/api/manual-tasks");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
    });

    it("タスク一覧を返す", async () => {
      const task = makeTask();
      mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 1 }) });
      mockListGet.mockResolvedValueOnce({
        docs: [makeDocSnap("task-1", task)],
      });

      const res = await app.request("/api/manual-tasks");
      expect(res.status).toBe(200);

      const body = (await res.json()) as { data: { id: string; title: string }[]; total: number };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe("task-1");
      expect(body.data[0]!.title).toBe("テストタスク");
      expect(body.total).toBe(1);
    });
  });

  // --- POST /api/manual-tasks ---
  describe("POST /api/manual-tasks", () => {
    it("タスクを作成して201を返す", async () => {
      const created = makeTask();
      mockAdd.mockResolvedValueOnce({
        id: "new-task",
        get: vi.fn().mockResolvedValue(makeDocSnap("new-task", created)),
      });

      const res = await app.request("/api/manual-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "テストタスク", taskPriority: "medium" }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.title).toBe("テストタスク");
      expect(mockAuditAdd).toHaveBeenCalledOnce();
    });

    it("タイトル未指定で400を返す", async () => {
      const res = await app.request("/api/manual-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskPriority: "medium" }),
      });

      expect(res.status).toBe(400);
    });

    it("viewerは作成できない（403）", async () => {
      currentDashboardRole = "viewer";

      const res = await app.request("/api/manual-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "テスト", taskPriority: "high" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // --- GET /api/manual-tasks/:id ---
  describe("GET /api/manual-tasks/:id", () => {
    it("タスク詳細を返す", async () => {
      mockDocGet.mockResolvedValueOnce(makeDocSnap("task-1", makeTask()));

      const res = await app.request("/api/manual-tasks/task-1");
      expect(res.status).toBe(200);

      const body = (await res.json()) as Record<string, unknown>;
      expect(body.id).toBe("task-1");
    });

    it("存在しないIDは404を返す", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/manual-tasks/nonexistent");
      expect(res.status).toBe(404);
    });
  });

  // --- PATCH /api/manual-tasks/:id ---
  describe("PATCH /api/manual-tasks/:id", () => {
    it("タスクを更新する", async () => {
      const updated = makeTask({ title: "更新タスク" });
      mockDocGet
        .mockResolvedValueOnce(makeDocSnap("task-1", makeTask()))
        .mockResolvedValueOnce(makeDocSnap("task-1", updated));
      mockDocUpdate.mockResolvedValueOnce(undefined);

      const res = await app.request("/api/manual-tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "更新タスク" }),
      });

      expect(res.status).toBe(200);
      expect(mockDocUpdate).toHaveBeenCalledOnce();
      expect(mockAuditAdd).toHaveBeenCalledOnce();
    });

    it("空のボディで400を返す", async () => {
      const res = await app.request("/api/manual-tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("viewerは更新できない（403）", async () => {
      currentDashboardRole = "viewer";
      // actorRole チェックが docRef.get() より先なので mockDocGet 不要

      const res = await app.request("/api/manual-tasks/task-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "変更" }),
      });

      expect(res.status).toBe(403);
    });
  });

  // --- DELETE /api/manual-tasks/:id ---
  describe("DELETE /api/manual-tasks/:id", () => {
    it("タスクを削除する", async () => {
      mockDocGet.mockResolvedValueOnce(makeDocSnap("task-1", makeTask()));
      mockDocDelete.mockResolvedValueOnce(undefined);

      const res = await app.request("/api/manual-tasks/task-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(mockDocDelete).toHaveBeenCalledOnce();
      expect(mockAuditAdd).toHaveBeenCalledOnce();
    });

    it("存在しないIDは404を返す", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });

      const res = await app.request("/api/manual-tasks/nonexistent", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });

    it("viewerは削除できない（403）", async () => {
      currentDashboardRole = "viewer";
      // actorRole チェックが docRef.get() より先なので mockDocGet 不要

      const res = await app.request("/api/manual-tasks/task-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
    });
  });
});
