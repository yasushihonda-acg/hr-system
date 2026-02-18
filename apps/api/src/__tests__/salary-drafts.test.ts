import type { ApprovalLog, SalaryDraft, SalaryDraftItem } from "@hr-system/db";
import { Hono } from "hono";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// モック設定
// ---------------------------------------------------------------------------

// google-auth-library モック（auth.test.ts と同パターン）
let mockVerifyIdToken: Mock;

vi.mock("google-auth-library", () => {
  const verifyIdToken = vi.fn();
  mockVerifyIdToken = verifyIdToken;
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
  };
});

// Firestore モック
const mockDraftGet = vi.fn();
const mockDraftUpdate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchCommit = vi.fn();
const mockItemsGet = vi.fn();
const mockLogsGet = vi.fn();
const mockCountGet = vi.fn();

vi.mock("@hr-system/db", () => {
  return {
    db: {
      batch: vi.fn(() => ({
        update: mockBatchUpdate,
        set: mockBatchSet,
        commit: mockBatchCommit,
      })),
    },
    collections: {
      salaryDrafts: {
        doc: vi.fn((_id = "draft-001") => ({
          id: _id ?? "draft-001",
          get: mockDraftGet,
          update: mockDraftUpdate,
        })),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        count: vi.fn().mockReturnThis(),
        get: mockCountGet,
      },
      salaryDraftItems: {
        where: vi.fn().mockReturnThis(),
        get: mockItemsGet,
      },
      approvalLogs: {
        doc: vi.fn(() => ({ id: "log-new" })),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: mockLogsGet,
      },
      auditLogs: {
        doc: vi.fn(() => ({ id: "audit-new" })),
      },
    },
  };
});

// ---------------------------------------------------------------------------
// テスト用アプリ（一度だけ生成）
// ---------------------------------------------------------------------------

const { authMiddleware } = await import("../middleware/auth.js");
const { rbacMiddleware } = await import("../middleware/rbac.js");
const { salaryDraftRoutes } = await import("../routes/salary-drafts.js");
const { appErrorHandler } = await import("../lib/errors.js");

function buildApp() {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.use("*", rbacMiddleware);
  app.route("/api/salary-drafts", salaryDraftRoutes);
  app.onError(appErrorHandler);
  return app;
}

const app = buildApp();
const AUTH_HEADER = { Authorization: "Bearer test-token" };

// ---------------------------------------------------------------------------
// ヘルパー: ロール別の認証メールを設定
// ---------------------------------------------------------------------------

function stubAsHrManager() {
  mockVerifyIdToken.mockResolvedValue({
    getPayload: () => ({ email: "manager@aozora-cg.com", name: "HR Manager", sub: "mgr" }),
  });
}

function stubAsCeo() {
  mockVerifyIdToken.mockResolvedValue({
    getPayload: () => ({ email: "ceo@aozora-cg.com", name: "CEO", sub: "ceo" }),
  });
}

// ---------------------------------------------------------------------------
// テストデータ
// ---------------------------------------------------------------------------

function makeDraft(overrides: Partial<SalaryDraft> = {}): SalaryDraft {
  return {
    employeeId: "emp-001",
    chatMessageId: null,
    status: "draft",
    changeType: "mechanical",
    reason: null,
    beforeBaseSalary: 247000,
    afterBaseSalary: 260000,
    beforeTotal: 267000,
    afterTotal: 280000,
    effectiveDate: { toDate: () => new Date("2026-03-01") } as never,
    aiConfidence: 0.95,
    aiReasoning: "2ピッチアップ",
    appliedRules: null,
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: { toDate: () => new Date("2026-02-18") } as never,
    updatedAt: { toDate: () => new Date("2026-02-18") } as never,
    ...overrides,
  };
}

function makeItemsSnap(): { docs: { id: string; data: () => SalaryDraftItem }[] } {
  return {
    docs: [
      {
        id: "item-001",
        data: () => ({
          draftId: "draft-001",
          itemType: "base_salary" as const,
          itemName: "基本給",
          beforeAmount: 247000,
          afterAmount: 260000,
          isChanged: true,
        }),
      },
    ],
  };
}

function makeLogsSnap(logs: Partial<ApprovalLog>[] = []): {
  docs: { id: string; data: () => Partial<ApprovalLog> }[];
} {
  return {
    docs: logs.map((log, i) => ({
      id: `log-00${i + 1}`,
      data: () => ({
        action: "reviewed" as const,
        fromStatus: "draft" as const,
        toStatus: "reviewed" as const,
        actorEmail: "manager@aozora-cg.com",
        actorRole: "hr_manager" as const,
        comment: null,
        modifiedFields: null,
        createdAt: { toDate: () => new Date("2026-02-18") } as never,
        ...log,
      }),
    })),
  };
}

// ---------------------------------------------------------------------------
// テストケース
// ---------------------------------------------------------------------------

describe("GET /api/salary-drafts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager@aozora-cg.com");
    mockBatchCommit.mockResolvedValue(undefined);
    stubAsHrManager();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("存在するドラフトを返す (200)", async () => {
    mockDraftGet.mockResolvedValue({ exists: true, data: () => makeDraft(), id: "draft-001" });
    mockItemsGet.mockResolvedValue(makeItemsSnap());
    mockLogsGet.mockResolvedValue(makeLogsSnap());

    const res = await app.request("/api/salary-drafts/draft-001", { headers: AUTH_HEADER });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string; items: unknown[] };
    expect(body.id).toBe("draft-001");
    expect(body.status).toBe("draft");
    expect(body.items).toHaveLength(1);
  });

  it("存在しないドラフト → 404", async () => {
    mockDraftGet.mockResolvedValue({ exists: false, data: () => null });
    mockItemsGet.mockResolvedValue({ docs: [] });
    mockLogsGet.mockResolvedValue({ docs: [] });

    const res = await app.request("/api/salary-drafts/nonexistent", { headers: AUTH_HEADER });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/salary-drafts/:id/transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager@aozora-cg.com");
    mockBatchCommit.mockResolvedValue(undefined);
    stubAsHrManager();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("draft → reviewed: hr_manager が遷移できる (200)", async () => {
    const reviewedDraft = makeDraft({ status: "reviewed" });
    mockDraftGet
      .mockResolvedValueOnce({ exists: true, data: () => makeDraft(), id: "draft-001" })
      .mockResolvedValueOnce({ exists: true, data: () => reviewedDraft, id: "draft-001" });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "reviewed", comment: "確認しました" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("reviewed");
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it("reviewed → approved: 機械的変更 + hr_manager (200)", async () => {
    const approvedDraft = makeDraft({ status: "approved", changeType: "mechanical" });
    mockDraftGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => makeDraft({ status: "reviewed", changeType: "mechanical" }),
        id: "draft-001",
      })
      .mockResolvedValueOnce({ exists: true, data: () => approvedDraft, id: "draft-001" });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "approved" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("approved");
  });

  it("reviewed → approved: 裁量的変更 + hr_manager → 409 (変更タイプ制約違反)", async () => {
    mockDraftGet.mockResolvedValue({
      exists: true,
      data: () => makeDraft({ status: "reviewed", changeType: "discretionary" }),
      id: "draft-001",
    });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "approved" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("pending_ceo_approval → approved: CEO のみ承認可能 (200)", async () => {
    stubAsCeo(); // CEO に切り替え

    const approvedDraft = makeDraft({ status: "approved", changeType: "discretionary" });
    mockDraftGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => makeDraft({ status: "pending_ceo_approval", changeType: "discretionary" }),
        id: "draft-001",
      })
      .mockResolvedValueOnce({ exists: true, data: () => approvedDraft, id: "draft-001" });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "approved" }),
    });

    expect(res.status).toBe(200);
  });

  it("pending_ceo_approval → approved: hr_manager は承認不可 → 409", async () => {
    mockDraftGet.mockResolvedValue({
      exists: true,
      data: () => makeDraft({ status: "pending_ceo_approval", changeType: "discretionary" }),
      id: "draft-001",
    });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "approved" }),
    });

    expect(res.status).toBe(409);
  });

  it("completed → reviewed: 遷移不可 → 409", async () => {
    mockDraftGet.mockResolvedValue({
      exists: true,
      data: () => makeDraft({ status: "completed" }),
      id: "draft-001",
    });

    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "reviewed" }),
    });

    expect(res.status).toBe(409);
  });

  it("バリデーション: toStatus が無効値 → 400", async () => {
    const res = await app.request("/api/salary-drafts/draft-001/transition", {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "invalid_status" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/salary-drafts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager@aozora-cg.com");
    mockBatchCommit.mockResolvedValue(undefined);
    stubAsHrManager();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("draft ステータス: hr_manager が修正できる (200)", async () => {
    const updatedDraft = makeDraft({ afterBaseSalary: 270000 });
    mockDraftGet
      .mockResolvedValueOnce({ exists: true, data: () => makeDraft(), id: "draft-001" })
      .mockResolvedValueOnce({ exists: true, data: () => updatedDraft, id: "draft-001" });

    const res = await app.request("/api/salary-drafts/draft-001", {
      method: "PATCH",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ afterBaseSalary: 270000 }),
    });

    expect(res.status).toBe(200);
    expect(mockBatchCommit).toHaveBeenCalledOnce();
  });

  it("CEO は修正不可 → 403", async () => {
    stubAsCeo(); // CEO に切り替え

    const res = await app.request("/api/salary-drafts/draft-001", {
      method: "PATCH",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ afterBaseSalary: 270000 }),
    });

    expect(res.status).toBe(403);
  });

  it("approved ステータス: 修正不可 → 409", async () => {
    mockDraftGet.mockResolvedValue({
      exists: true,
      data: () => makeDraft({ status: "approved" }),
      id: "draft-001",
    });

    const res = await app.request("/api/salary-drafts/draft-001", {
      method: "PATCH",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ afterBaseSalary: 270000 }),
    });

    expect(res.status).toBe(409);
  });

  it("空ボディ → 400", async () => {
    const res = await app.request("/api/salary-drafts/draft-001", {
      method: "PATCH",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
