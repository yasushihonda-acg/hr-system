import type { ActorRole } from "@hr-system/shared";
import { Hono } from "hono";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// google-auth-library をモック
let mockVerifyIdToken: Mock;

vi.mock("google-auth-library", () => {
  const verifyIdToken = vi.fn();
  mockVerifyIdToken = verifyIdToken;
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken,
    })),
  };
});

// @hr-system/db の allowedUsers ホワイトリストチェックをモック
vi.mock("@hr-system/db", () => {
  const makeAllowedSnap = (email: string) => ({
    empty: false,
    docs: [{ data: () => ({ email, role: "hr_staff", isActive: true }) }],
  });

  const allowedUsersQuery = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(function (this: unknown) {
      return { get: vi.fn().mockResolvedValue(makeAllowedSnap("any")) };
    }),
  };

  return {
    collections: {
      allowedUsers: {
        where: vi.fn().mockReturnValue(allowedUsersQuery),
      },
    },
    db: {},
  };
});

const { authMiddleware } = await import("../middleware/auth.js");
const { rbacMiddleware, requireRole } = await import("../middleware/rbac.js");

function createTestApp(options?: { requiredRoles?: ActorRole[] }) {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.use("*", rbacMiddleware);
  if (options?.requiredRoles) {
    app.use("*", requireRole(...options.requiredRoles));
  }
  app.get("/test", (c) =>
    c.json({
      user: c.get("user"),
      actorRole: c.get("actorRole"),
    }),
  );
  return app;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("有効なBearerトークン → user と actorRole がセットされる (200)", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "staff@aozora-cg.com",
        name: "Staff User",
        sub: "12345",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; name: string; sub: string } };
    expect(body.user.email).toBe("staff@aozora-cg.com");
    expect(body.user.name).toBe("Staff User");
    expect(body.user.sub).toBe("12345");
  });

  it("GOOGLE_CLIENT_ID 設定時 → verifyIdToken に audience が渡される", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "my-client-id.apps.googleusercontent.com");
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "staff@aozora-cg.com",
        name: "Staff",
        sub: "sub-1",
      }),
    });

    const app = createTestApp();
    await app.request("/test", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: "valid-token",
      audience: "my-client-id.apps.googleusercontent.com",
    });

    vi.unstubAllEnvs();
  });

  it("本番環境で GOOGLE_CLIENT_ID 未設定 → 500 (フェイルクローズ)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // GOOGLE_CLIENT_ID は設定しない

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(res.status).toBe(500);

    vi.unstubAllEnvs();
  });

  it("Authorization ヘッダーなし → 401", async () => {
    const app = createTestApp();
    const res = await app.request("/test");

    expect(res.status).toBe(401);
  });

  it("Bearerプレフィックスなし → 401", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Basic some-token" },
    });

    expect(res.status).toBe(401);
  });

  it("無効なトークン (verifyIdToken が throw) → 401", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(res.status).toBe(401);
  });

  it("許可されたサービスアカウント → 200 (dashboardRole: null)", async () => {
    vi.stubEnv("ALLOWED_SERVICE_ACCOUNTS", "scheduler@hr-system-487809.iam.gserviceaccount.com");
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "scheduler@hr-system-487809.iam.gserviceaccount.com",
        sub: "sa-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer sa-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; dashboardRole: null } };
    expect(body.user.email).toBe("scheduler@hr-system-487809.iam.gserviceaccount.com");
    expect(body.user.dashboardRole).toBeNull();

    vi.unstubAllEnvs();
  });

  it("未許可のサービスアカウント → 403", async () => {
    vi.stubEnv("ALLOWED_SERVICE_ACCOUNTS", "scheduler@hr-system-487809.iam.gserviceaccount.com");
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "attacker@evil-project.iam.gserviceaccount.com",
        sub: "evil-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer evil-sa-token" },
    });

    expect(res.status).toBe(403);

    vi.unstubAllEnvs();
  });

  it("ALLOWED_SERVICE_ACCOUNTS 未設定 → SA は全拒否 (403)", async () => {
    // 環境変数を設定しない（デフォルト）
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "any@project.iam.gserviceaccount.com",
        sub: "sa-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer sa-token" },
    });

    expect(res.status).toBe(403);
  });

  it("SA トークンの audience 不一致 → audience なしフォールバックで認証成功", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "web-client-id.apps.googleusercontent.com");
    vi.stubEnv("ALLOWED_SERVICE_ACCOUNTS", "hr-api@hr-system-487809.iam.gserviceaccount.com");

    const saPayload = {
      email: "hr-api@hr-system-487809.iam.gserviceaccount.com",
      sub: "sa-sub",
    };

    // 1回目: audience 付き → reject（Cloud Scheduler の audience は Cloud Run URL）
    // 2回目: audience なし → resolve
    mockVerifyIdToken
      .mockRejectedValueOnce(new Error("Token used too late / wrong audience"))
      .mockResolvedValueOnce({ getPayload: () => saPayload });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer scheduler-oidc-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; dashboardRole: null } };
    expect(body.user.email).toBe("hr-api@hr-system-487809.iam.gserviceaccount.com");
    expect(body.user.dashboardRole).toBeNull();
    // verifyIdToken が2回呼ばれた（フォールバック）
    expect(mockVerifyIdToken).toHaveBeenCalledTimes(2);

    vi.unstubAllEnvs();
  });

  it("複数SAホワイトリスト → 2番目のSAも許可される", async () => {
    vi.stubEnv(
      "ALLOWED_SERVICE_ACCOUNTS",
      "sa1@project.iam.gserviceaccount.com,sa2@project.iam.gserviceaccount.com",
    );
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "sa2@project.iam.gserviceaccount.com",
        sub: "sa2-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer sa2-token" },
    });

    expect(res.status).toBe(200);

    vi.unstubAllEnvs();
  });

  it("許可されたSA → actorRole は null（業務操作不可）", async () => {
    vi.stubEnv("ALLOWED_SERVICE_ACCOUNTS", "scheduler@project.iam.gserviceaccount.com");
    vi.stubEnv("CEO_EMAIL", "ceo@test.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "");
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "scheduler@project.iam.gserviceaccount.com",
        sub: "sa-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer sa-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { actorRole: string | null };
    expect(body.actorRole).toBeNull();

    vi.unstubAllEnvs();
  });
});

describe("rbacMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CEO_EMAIL と一致 → actorRole = 'ceo'", async () => {
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "");

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "ceo@aozora-cg.com",
        name: "CEO",
        sub: "ceo-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer ceo-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { actorRole: string };
    expect(body.actorRole).toBe("ceo");

    vi.unstubAllEnvs();
  });

  it("HR_MANAGER_EMAILS に含まれる → actorRole = 'hr_manager'", async () => {
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager1@aozora-cg.com,manager2@aozora-cg.com");

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "manager1@aozora-cg.com",
        name: "HR Manager",
        sub: "mgr-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer manager-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { actorRole: string };
    expect(body.actorRole).toBe("hr_manager");

    vi.unstubAllEnvs();
  });

  it("その他 → actorRole = 'hr_staff'", async () => {
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager@aozora-cg.com");

    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "staff@aozora-cg.com",
        name: "Staff",
        sub: "staff-sub",
      }),
    });

    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer staff-token" },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { actorRole: string };
    expect(body.actorRole).toBe("hr_staff");

    vi.unstubAllEnvs();
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CEO_EMAIL", "ceo@aozora-cg.com");
    vi.stubEnv("HR_MANAGER_EMAILS", "manager@aozora-cg.com");
  });

  it("必要なロールなし → 403", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "staff@aozora-cg.com",
        name: "Staff",
        sub: "staff-sub",
      }),
    });

    const app = createTestApp({ requiredRoles: ["ceo", "hr_manager"] });
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer staff-token" },
    });

    expect(res.status).toBe(403);

    vi.unstubAllEnvs();
  });
});
