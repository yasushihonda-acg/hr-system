import { describe, expect, it } from "vitest";
import {
  type AuthContext,
  Authorizer,
  createAuthContext,
  isAllowedIdentity,
  isExternalReadonlyViolation,
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

describe("isAllowedIdentity", () => {
  it("ドメイン一致 → 'domain'", () => {
    expect(isAllowedIdentity("user@aozora-cg.com", "aozora-cg.com", "aozora-cg.com", [])).toBe(
      "domain",
    );
  });

  it("ドメイン不一致 + 外部 allowlist 空 → 'denied'", () => {
    expect(isAllowedIdentity("user@other.com", "other.com", "aozora-cg.com", [])).toBe("denied");
  });

  it("外部 allowlist に完全一致（小文字正規化） → 'external_email_exception'", () => {
    expect(
      isAllowedIdentity("y@lend.aozora-cg.com", "lend.aozora-cg.com", "aozora-cg.com", [
        "y@lend.aozora-cg.com",
      ]),
    ).toBe("external_email_exception");
  });

  it("外部 allowlist の大文字混在でも正規化してマッチ", () => {
    expect(
      isAllowedIdentity("Y@Lend.Aozora-CG.com", "lend.aozora-cg.com", "aozora-cg.com", [
        "y@lend.aozora-cg.com",
      ]),
    ).toBe("external_email_exception");
  });

  it("allowlist エントリの前後空白は無視される", () => {
    expect(
      isAllowedIdentity("y@lend.aozora-cg.com", "lend.aozora-cg.com", "aozora-cg.com", [
        "  y@lend.aozora-cg.com  ",
      ]),
    ).toBe("external_email_exception");
  });

  it("allowlist 未登録の外部メール → 'denied'", () => {
    expect(
      isAllowedIdentity("other@lend.aozora-cg.com", "lend.aozora-cg.com", "aozora-cg.com", [
        "y@lend.aozora-cg.com",
      ]),
    ).toBe("denied");
  });

  it("ドメイン一致を優先（allowlist に混入していても domain として扱う）", () => {
    expect(
      isAllowedIdentity("user@aozora-cg.com", "aozora-cg.com", "aozora-cg.com", [
        "user@aozora-cg.com",
      ]),
    ).toBe("domain");
  });
});

describe("Authorizer with externalAllowlist", () => {
  const ALLOWED_DOMAIN = "aozora-cg.com";
  const EXTERNAL_EMAIL = "y@lend.aozora-cg.com";

  it("AC1: 外部例外ユーザー readonly + list_employees → authorized", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "readonly", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(true);
    expect(result.role).toBe("readonly");
    expect(result.allowedBy).toBe("external_email_exception");
  });

  it("AC2: 外部例外 readonly → update_employee は deny（権限不足）", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "readonly", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "update_employee");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("権限不足");
    expect(result.allowedBy).toBe("external_email_exception");
  });

  it("AC2: 外部例外 readonly → get_pay_statements も deny", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "readonly", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "get_pay_statements");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("権限不足");
  });

  it("AC3: 外部ドメインで allowlist 未登録 → ドメイン制限", async () => {
    const store = createMockUserStore({});
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: "other@lend.aozora-cg.com",
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("ドメイン制限");
    expect(result.allowedBy).toBe("denied");
  });

  it("AC4: 外部例外 enabled:false → 無効化されたユーザー", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "readonly", enabled: false },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("無効化されたユーザー");
  });

  it("AC5: 外部メールが allowlist 未登録 + Firestore 登録済みでも deny", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "readonly", enabled: true },
    });
    // allowlist が空なので Firestore 登録だけでは通らない
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, []);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("ドメイン制限");
  });

  it("AC6c: 外部例外ユーザーが role=admin → 外部例外は readonly 固定で deny", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: { role: "admin", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("外部例外は readonly 固定");
    expect(result.allowedBy).toBe("external_email_exception");
  });

  it("AC6c: 外部例外ユーザーが permissions に write 含む → deny", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: {
        role: "readonly",
        permissions: ["read", "write"] as Permission[],
        enabled: true,
      },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("外部例外は readonly 固定");
  });

  it("AC6c: 外部例外ユーザーが permissions に pay_statements 含む → deny", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: {
        role: "readonly",
        permissions: ["read", "pay_statements"] as Permission[],
        enabled: true,
      },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(false);
    expect(result.reason).toBe("外部例外は readonly 固定");
  });

  it("AC7: 認可成功時 allowedBy: 'domain' が返る（regression）", async () => {
    const store = createMockUserStore({
      "user@aozora-cg.com": { role: "admin", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: "user@aozora-cg.com",
      domain: "aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(true);
    expect(result.allowedBy).toBe("domain");
  });

  it("AC8: 既存ドメインユーザーは externalAllowlist 導入後も変化なし（regression）", async () => {
    const store = createMockUserStore({
      "user@aozora-cg.com": { role: "admin", enabled: true },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: "user@aozora-cg.com",
      domain: "aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "get_pay_statements");
    expect(result.authorized).toBe(true);
    expect(result.role).toBe("admin");
  });

  it("外部例外ユーザーで permissions: ['read'] 明示指定も通過", async () => {
    const store = createMockUserStore({
      [EXTERNAL_EMAIL]: {
        role: "readonly",
        permissions: ["read"] as Permission[],
        enabled: true,
      },
    });
    const authorizer = new Authorizer(ALLOWED_DOMAIN, store, [EXTERNAL_EMAIL]);
    const context: AuthContext = {
      email: EXTERNAL_EMAIL,
      domain: "lend.aozora-cg.com",
      transport: "http",
    };

    const result = await authorizer.authorize(context, "list_employees");
    expect(result.authorized).toBe(true);
  });
});

describe("isExternalReadonlyViolation", () => {
  // この関数は Authorizer と OAuth /token の両方から呼び出される共通ガード。
  // JWT 発行前と認可時の両方で同じ不変条件を適用するための export。

  it("role: readonly + permissions 未指定 → 違反なし（ROLE_TO_PERMISSIONS.readonly = ['read']）", () => {
    expect(isExternalReadonlyViolation({ role: "readonly" })).toBe(false);
  });

  it("role: readonly + permissions: ['read'] → 違反なし", () => {
    expect(isExternalReadonlyViolation({ role: "readonly", permissions: ["read"] })).toBe(false);
  });

  it("role: admin → 違反（JWT に admin role が埋め込まれるのを防ぐ）", () => {
    expect(isExternalReadonlyViolation({ role: "admin" })).toBe(true);
  });

  it("role: readonly + permissions: ['read', 'write'] → 違反", () => {
    expect(isExternalReadonlyViolation({ role: "readonly", permissions: ["read", "write"] })).toBe(
      true,
    );
  });

  it("role: readonly + permissions: ['read', 'pay_statements'] → 違反", () => {
    expect(
      isExternalReadonlyViolation({ role: "readonly", permissions: ["read", "pay_statements"] }),
    ).toBe(true);
  });

  it("role: readonly + permissions: [] → 違反なし（空配列は read 相当にフォールバック）", () => {
    expect(isExternalReadonlyViolation({ role: "readonly", permissions: [] })).toBe(false);
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
