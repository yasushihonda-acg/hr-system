/**
 * RBAC マトリクス統合テスト
 *
 * 全ロール（admin/viewer/hr_staff/hr_manager/ceo）× 主要エンドポイントの
 * アクセス制御を検証する。未認証リクエストの 401 もカバー。
 *
 * 認可パターンは3種類:
 * 1. requireRole ミドルウェア（intent-stats, classification-rules PATCH）
 * 2. requireAdmin インライン関数（admin/users, chat-spaces）
 * 3. actorRole インラインチェック（chat-messages, line-messages, llm-rules 書き込み）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- テスト用のロール設定 ---
type TestRole = "admin_ceo" | "admin_hr_manager" | "admin_hr_staff" | "viewer" | "unauthenticated";

interface RoleConfig {
  email: string;
  name: string;
  dashboardRole: "admin" | "viewer";
  actorRole: "ceo" | "hr_manager" | "hr_staff" | null;
}

const ROLES: Record<Exclude<TestRole, "unauthenticated">, RoleConfig> = {
  admin_ceo: {
    email: "ceo@aozora-cg.com",
    name: "CEO",
    dashboardRole: "admin",
    actorRole: "ceo",
  },
  admin_hr_manager: {
    email: "manager@aozora-cg.com",
    name: "HR Manager",
    dashboardRole: "admin",
    actorRole: "hr_manager",
  },
  admin_hr_staff: {
    email: "staff@aozora-cg.com",
    name: "HR Staff",
    dashboardRole: "admin",
    actorRole: "hr_staff",
  },
  viewer: {
    email: "viewer@aozora-cg.com",
    name: "Viewer",
    dashboardRole: "viewer",
    actorRole: null,
  },
};

// --- 現在のロール（テスト内で切り替え） ---
let currentRole: TestRole = "admin_hr_staff";

// --- モック変数 ---
const { mockGet, mockSet, mockAdd, mockUpdate, mockGetRequestHeaders } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn().mockResolvedValue(undefined),
  mockAdd: vi.fn().mockResolvedValue({ id: "audit-1" }),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockGetRequestHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer test" }),
}));

// --- google-auth-library モック ---
vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    async getClient() {
      return { getRequestHeaders: mockGetRequestHeaders };
    }
  },
}));

// --- Firestore モック ---
vi.mock("@hr-system/db", () => {
  const timestampNow = { toDate: () => new Date("2026-03-01T00:00:00Z") };

  return {
    db: {
      batch: vi.fn(() => ({
        update: vi.fn(),
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    },
    collections: {
      chatMessages: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
      },
      lineMessages: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        count: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
        })),
        get: vi.fn().mockResolvedValue({ docs: [], size: 0 }),
      },
      intentRecords: {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      chatSpaces: {
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        })),
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate, delete: vi.fn() })),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      employees: {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: "emp-1",
            data: () => ({
              name: "Test",
              employeeNumber: "001",
              department: "HR",
              position: "Staff",
              employmentType: "fulltime",
              createdAt: timestampNow,
              updatedAt: timestampNow,
            }),
          }),
        })),
      },
      salaryDrafts: {
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
        doc: vi.fn(() => ({ get: mockGet })),
      },
      classificationRules: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
      },
      llmRules: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate })),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      llmClassificationRules: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate, delete: vi.fn() })),
        add: vi.fn().mockResolvedValue({ id: "new-rule" }),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      auditLogs: {
        add: mockAdd,
        orderBy: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        count: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
        })),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      allowedUsers: {
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                empty: false,
                docs: [
                  {
                    data: () => ({
                      email: "test@aozora-cg.com",
                      role: "admin",
                      isActive: true,
                    }),
                  },
                ],
              }),
            }),
          }),
        }),
        doc: vi.fn(() => ({ get: mockGet, set: mockSet, update: mockUpdate, delete: vi.fn() })),
        orderBy: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      },
      syncMetadata: {
        doc: vi.fn(() => ({ get: mockGet, set: mockSet })),
      },
    },
  };
});

// --- auth ミドルウェアモック（ロール切替対応） ---
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      if (currentRole === "unauthenticated") {
        const { HTTPException } = await import("hono/http-exception");
        throw new HTTPException(401, { message: "Unauthorized" });
      }
      const role = ROLES[currentRole];
      c.set("user", {
        email: role.email,
        name: role.name,
        sub: `${currentRole}-sub`,
        dashboardRole: role.dashboardRole,
      });
      await next();
    },
  ),
}));

// --- rbac ミドルウェアモック（ロール切替対応） ---
vi.mock("../middleware/rbac.js", () => ({
  rbacMiddleware: vi.fn(
    async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      if (currentRole === "unauthenticated") {
        await next();
        return;
      }
      const role = ROLES[currentRole];
      c.set("actorRole", role.actorRole);
      await next();
    },
  ),
  requireRole: vi.fn((...roles: string[]) => {
    return async (c: { get: (key: string) => unknown }, next: () => Promise<void>) => {
      const actorRole = c.get("actorRole") as string | null;
      if (!actorRole || !roles.includes(actorRole)) {
        const { HTTPException } = await import("hono/http-exception");
        throw new HTTPException(403, { message: "Forbidden" });
      }
      await next();
    };
  }),
}));

const { app } = await import("../app.js");

// --- ヘルパー ---
function setRole(role: TestRole) {
  currentRole = role;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request(method: Method, path: string, body?: Record<string, unknown>) {
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  return app.request(path, opts);
}

// --- テスト本体 ---
describe("RBAC マトリクス", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRole = "admin_hr_staff"; // デフォルト
  });

  // =================================================================
  // 1. 未認証リクエスト → 401
  // =================================================================
  describe("未認証リクエスト → 401", () => {
    const endpoints: [Method, string][] = [
      ["GET", "/api/chat-messages"],
      ["GET", "/api/line-messages"],
      ["GET", "/api/employees"],
      ["GET", "/api/salary-drafts"],
      ["GET", "/api/audit-logs"],
      ["GET", "/api/stats"],
      ["GET", "/api/intent-stats/summary"],
      ["GET", "/api/admin/users"],
      ["GET", "/api/chat-spaces"],
      ["GET", "/api/classification-rules"],
      ["GET", "/api/llm-rules"],
    ];

    for (const [method, path] of endpoints) {
      it(`${method} ${path} → 401`, async () => {
        setRole("unauthenticated");
        const res = await request(method, path);
        expect(res.status).toBe(401);
      });
    }
  });

  // =================================================================
  // 2. /api/health は認証不要 → 200
  // =================================================================
  it("GET /api/health は認証不要 → 200", async () => {
    setRole("unauthenticated");
    const res = await request("GET", "/api/health");
    expect(res.status).toBe(200);
  });

  // =================================================================
  // 3. viewer → 全業務 API で 403
  // =================================================================
  describe("viewer → 業務 API で 403", () => {
    const businessEndpoints: [Method, string][] = [
      ["GET", "/api/chat-messages"],
      ["GET", "/api/line-messages"],
      ["GET", "/api/audit-logs"],
      ["GET", "/api/intent-stats/summary"],
      ["POST", "/api/chat-messages/sync"],
      ["GET", "/api/admin/users"],
      ["GET", "/api/chat-spaces?all=true"],
    ];

    for (const [method, path] of businessEndpoints) {
      it(`${method} ${path} → 403`, async () => {
        setRole("viewer");
        const res = await request(method, path);
        expect(res.status).toBe(403);
      });
    }

    it("GET /api/chat-spaces（?all なし）→ viewer でも 200（active のみ）", async () => {
      setRole("viewer");
      const res = await request("GET", "/api/chat-spaces");
      expect(res.status).toBe(200);
    });
  });

  // =================================================================
  // 4. admin 専用エンドポイント（dashboardRole = admin 必須）
  // =================================================================
  describe("admin 専用エンドポイント", () => {
    describe("GET /api/admin/users", () => {
      it("admin → 200", async () => {
        setRole("admin_hr_staff");
        const res = await request("GET", "/api/admin/users");
        expect(res.status).toBe(200);
      });

      it("viewer → 403", async () => {
        setRole("viewer");
        const res = await request("GET", "/api/admin/users");
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/chat-spaces?all=true", () => {
      it("admin → 200", async () => {
        setRole("admin_hr_staff");
        const res = await request("GET", "/api/chat-spaces?all=true");
        expect(res.status).toBe(200);
      });

      it("viewer → 403", async () => {
        setRole("viewer");
        const res = await request("GET", "/api/chat-spaces?all=true");
        expect(res.status).toBe(403);
      });
    });
  });

  // =================================================================
  // 5. hr_manager 以上限定エンドポイント
  // =================================================================
  describe("hr_manager 以上限定", () => {
    describe("GET /api/intent-stats/summary", () => {
      it("hr_manager → 200", async () => {
        setRole("admin_hr_manager");
        const res = await request("GET", "/api/intent-stats/summary");
        expect(res.status).toBe(200);
      });

      it("ceo → 200", async () => {
        setRole("admin_ceo");
        const res = await request("GET", "/api/intent-stats/summary");
        expect(res.status).toBe(200);
      });

      it("hr_staff → 403", async () => {
        setRole("admin_hr_staff");
        const res = await request("GET", "/api/intent-stats/summary");
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/audit-logs", () => {
      it("hr_manager → 200", async () => {
        setRole("admin_hr_manager");
        const res = await request("GET", "/api/audit-logs");
        expect(res.status).toBe(200);
      });

      it("ceo → 200", async () => {
        setRole("admin_ceo");
        const res = await request("GET", "/api/audit-logs");
        expect(res.status).toBe(200);
      });

      it("hr_staff → 403", async () => {
        setRole("admin_hr_staff");
        const res = await request("GET", "/api/audit-logs");
        expect(res.status).toBe(403);
      });
    });

    describe("POST /api/llm-rules（書き込み）", () => {
      it("hr_manager → 許可（バリデーションエラーは別問題）", async () => {
        setRole("admin_hr_manager");
        const res = await request("POST", "/api/llm-rules", {
          ruleType: "system_prompt",
          category: "salary",
          content: "test",
        });
        // 403 でなければ認可は通過（400/422 はバリデーション層）
        expect(res.status).not.toBe(403);
      });

      it("hr_staff → 403", async () => {
        setRole("admin_hr_staff");
        const res = await request("POST", "/api/llm-rules", {
          ruleType: "system_prompt",
          category: "salary",
          content: "test",
        });
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/llm-rules（読み取りは全員可）", () => {
      it("hr_staff → 200", async () => {
        setRole("admin_hr_staff");
        const res = await request("GET", "/api/llm-rules");
        expect(res.status).toBe(200);
      });
    });
  });

  // =================================================================
  // 6. hr_staff 以上のアクセス（通常業務 API）
  // =================================================================
  describe("hr_staff 以上 → 通常業務 API アクセス可", () => {
    const staffEndpoints: [Method, string][] = [
      ["GET", "/api/chat-messages"],
      ["GET", "/api/line-messages"],
    ];

    for (const [method, path] of staffEndpoints) {
      it(`hr_staff: ${method} ${path} → 200`, async () => {
        setRole("admin_hr_staff");
        const res = await request(method, path);
        expect(res.status).toBe(200);
      });
    }

    for (const [method, path] of staffEndpoints) {
      it(`hr_manager: ${method} ${path} → 200`, async () => {
        setRole("admin_hr_manager");
        const res = await request(method, path);
        expect(res.status).toBe(200);
      });
    }

    for (const [method, path] of staffEndpoints) {
      it(`ceo: ${method} ${path} → 200`, async () => {
        setRole("admin_ceo");
        const res = await request(method, path);
        expect(res.status).toBe(200);
      });
    }
  });
});
