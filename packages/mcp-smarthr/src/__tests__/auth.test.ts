import { describe, expect, it } from "vitest";
import {
  type AuthContext,
  Authorizer,
  createAuthContext,
  type UserStore,
} from "../core/middleware/auth.js";

import type { Permission } from "../core/middleware/pii-filter.js";

/** テスト用モック UserStore（permissions 対応） */
function createMockUserStore(
  users: Record<
    string,
    { role: "admin" | "readonly"; permissions?: Permission[]; enabled: boolean }
  >,
): UserStore {
  return {
    getUser: async (email: string) => users[email] ?? null,
  };
}

const ALLOWED_DOMAIN = "aozora-cg.com";

describe("Authorizer", () => {
  describe("HTTP トランスポート", () => {
    it("正規ドメイン + 許可リスト内 + 適切なロール → authorized: true", async () => {
      const store = createMockUserStore({
        "user@aozora-cg.com": { role: "admin", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "user@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "get_pay_statements");

      expect(result.authorized).toBe(true);
      expect(result.role).toBe("admin");
      expect(result.email).toBe("user@aozora-cg.com");
      expect(result.reason).toBeUndefined();
    });

    it("gmail.com ドメイン → authorized: false, reason: ドメイン制限", async () => {
      const store = createMockUserStore({});
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "user@gmail.com",
        domain: "gmail.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("ドメイン制限");
    });

    it("aozora-cg.com + 許可リスト外 → authorized: false, reason: 許可リスト", async () => {
      const store = createMockUserStore({});
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "unknown@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("許可リスト");
    });

    it("readonly ロール + get_pay_statements → authorized: false, reason: 権限不足", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": { role: "readonly", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "get_pay_statements");

      expect(result.authorized).toBe(false);
      expect(result.role).toBe("readonly");
      expect(result.reason).toBe("権限不足");
    });

    it("readonly ロール + list_employees → authorized: true", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": { role: "readonly", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(true);
      expect(result.role).toBe("readonly");
    });

    it("無効化されたユーザー (enabled: false) → authorized: false", async () => {
      const store = createMockUserStore({
        "disabled@aozora-cg.com": { role: "admin", enabled: false },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "disabled@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("無効化されたユーザー");
    });
  });

  describe("未登録ツール（default deny）", () => {
    it("HTTP + 未登録ツール → authorized: false", async () => {
      const store = createMockUserStore({
        "user@aozora-cg.com": { role: "admin", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "user@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "unknown_tool");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("未登録ツール");
    });

    it("stdio + 未登録ツール → authorized: false", async () => {
      const store = createMockUserStore({
        "user@aozora-cg.com": { role: "admin", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "user@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "unknown_tool");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("未登録ツール");
    });
  });

  describe("stdio トランスポート", () => {
    it("未登録ユーザーは readonly（H2修正: admin にしない）", async () => {
      const store = createMockUserStore({});
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "local@example.com",
        domain: "example.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(true);
      expect(result.role).toBe("readonly");
    });

    it("未登録ユーザーは admin ツールにアクセスできない", async () => {
      const store = createMockUserStore({});
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "local@example.com",
        domain: "example.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "get_pay_statements");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("権限不足");
    });

    it("stdio でも enabled: false は拒否", async () => {
      const store = createMockUserStore({
        "disabled@aozora-cg.com": { role: "admin", enabled: false },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "disabled@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("無効化されたユーザー");
    });

    it("許可リストに存在するユーザーはそのロールを使用", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": { role: "readonly", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "list_employees");

      expect(result.authorized).toBe(true);
      expect(result.role).toBe("readonly");
    });

    it("stdio + readonly ロール + admin ツール → authorized: false", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": { role: "readonly", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "stdio",
      };

      const result = await authorizer.authorize(context, "get_pay_statements");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("権限不足");
    });
  });

  describe("パーミッションベース認可", () => {
    it("permissions: ['read', 'write'] → update_employee に成功", async () => {
      const store = createMockUserStore({
        "editor@aozora-cg.com": {
          role: "readonly",
          permissions: ["read", "write"],
          enabled: true,
        },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "editor@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "update_employee");

      expect(result.authorized).toBe(true);
    });

    it("permissions: ['read', 'write'] → get_pay_statements は拒否", async () => {
      const store = createMockUserStore({
        "editor@aozora-cg.com": {
          role: "readonly",
          permissions: ["read", "write"],
          enabled: true,
        },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "editor@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "get_pay_statements");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("権限不足");
    });

    it("permissions: ['read'] → update_employee は拒否", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": {
          role: "readonly",
          permissions: ["read"],
          enabled: true,
        },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const result = await authorizer.authorize(context, "update_employee");

      expect(result.authorized).toBe(false);
      expect(result.reason).toBe("権限不足");
    });

    it("role: 'admin'（permissions なし）→ 全ツールアクセス可（後方互換）", async () => {
      const store = createMockUserStore({
        "admin@aozora-cg.com": { role: "admin", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "admin@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const readResult = await authorizer.authorize(context, "list_employees");
      const writeResult = await authorizer.authorize(context, "update_employee");
      const payResult = await authorizer.authorize(context, "get_pay_statements");

      expect(readResult.authorized).toBe(true);
      expect(writeResult.authorized).toBe(true);
      expect(payResult.authorized).toBe(true);
    });

    it("role: 'readonly'（permissions なし）→ read のみ（後方互換）", async () => {
      const store = createMockUserStore({
        "reader@aozora-cg.com": { role: "readonly", enabled: true },
      });
      const authorizer = new Authorizer(ALLOWED_DOMAIN, store);
      const context: AuthContext = {
        email: "reader@aozora-cg.com",
        domain: "aozora-cg.com",
        transport: "http",
      };

      const readResult = await authorizer.authorize(context, "list_employees");
      const writeResult = await authorizer.authorize(context, "update_employee");

      expect(readResult.authorized).toBe(true);
      expect(writeResult.authorized).toBe(false);
    });
  });
});

describe("createAuthContext", () => {
  it("email からドメインを自動導出する", () => {
    const ctx = createAuthContext("user@aozora-cg.com", "http");
    expect(ctx.email).toBe("user@aozora-cg.com");
    expect(ctx.domain).toBe("aozora-cg.com");
    expect(ctx.transport).toBe("http");
  });

  it("hdOverride でドメインを上書きできる", () => {
    const ctx = createAuthContext("user@aozora-cg.com", "http", "custom-domain.com");
    expect(ctx.domain).toBe("custom-domain.com");
  });

  it("不正な email 形式でエラーを投げる", () => {
    expect(() => createAuthContext("invalid-email", "stdio")).toThrow("Invalid email format");
  });

  it("返されるオブジェクトが frozen である", () => {
    const ctx = createAuthContext("user@aozora-cg.com", "stdio");
    expect(Object.isFrozen(ctx)).toBe(true);
  });
});
