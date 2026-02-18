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
