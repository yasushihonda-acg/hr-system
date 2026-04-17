import { describe, expect, it, vi } from "vitest";
import { parseExternalAllowlist, verifyGoogleToken } from "../shells/http.js";

// google-auth-library のモック
vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken: vi.fn(),
    })),
  };
});

import { OAuth2Client } from "google-auth-library";

function createMockOAuthClient(
  payload: Record<string, unknown> | null = null,
  shouldThrow = false,
) {
  const client = new OAuth2Client("test-client-id");
  const verifyMock = client.verifyIdToken as ReturnType<typeof vi.fn>;

  if (shouldThrow) {
    verifyMock.mockRejectedValue(new Error("Token verification failed"));
  } else {
    verifyMock.mockResolvedValue({
      getPayload: () => payload,
    });
  }

  return client;
}

const GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

describe("verifyGoogleToken", () => {
  it("有効なトークン → authContext を返す", async () => {
    const client = createMockOAuthClient({
      email: "user@aozora-cg.com",
      hd: "aozora-cg.com",
    });

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, "Bearer valid-token");

    expect("authContext" in result).toBe(true);
    if ("authContext" in result) {
      expect(result.authContext.email).toBe("user@aozora-cg.com");
      expect(result.authContext.domain).toBe("aozora-cg.com");
      expect(result.authContext.transport).toBe("http");
    }
  });

  it("hd クレームがない場合は email からドメインを導出", async () => {
    const client = createMockOAuthClient({
      email: "user@gmail.com",
    });

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, "Bearer valid-token");

    expect("authContext" in result).toBe(true);
    if ("authContext" in result) {
      expect(result.authContext.domain).toBe("gmail.com");
    }
  });

  it("Authorization ヘッダーなし → 401 エラー", async () => {
    const client = createMockOAuthClient();

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, undefined);

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Authorization header required");
      expect(result.status).toBe(401);
    }
  });

  it("Bearer プレフィックスなし → 401 エラー", async () => {
    const client = createMockOAuthClient();

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, "Basic abc123");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Authorization header required");
    }
  });

  it("email クレームがないトークン → 401 エラー", async () => {
    const client = createMockOAuthClient({ sub: "12345" });

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, "Bearer no-email-token");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Invalid token: no email claim");
    }
  });

  it("無効なトークン → 401 エラー", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = createMockOAuthClient(null, true);

    const result = await verifyGoogleToken(client, GOOGLE_CLIENT_ID, "Bearer invalid-token");

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Invalid or expired token");
    }

    // 検証失敗時にエラーログが出力されること
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("parseExternalAllowlist", () => {
  it("空文字 / undefined → 空配列", () => {
    expect(parseExternalAllowlist(undefined, "aozora-cg.com")).toEqual([]);
    expect(parseExternalAllowlist("", "aozora-cg.com")).toEqual([]);
    expect(parseExternalAllowlist("   ", "aozora-cg.com")).toEqual([]);
  });

  it("単一メール → 正規化した 1 件の配列", () => {
    expect(parseExternalAllowlist("y@lend.aozora-cg.com", "aozora-cg.com")).toEqual([
      "y@lend.aozora-cg.com",
    ]);
  });

  it("カンマ区切り複数 → 重複排除・小文字正規化・空白除去", () => {
    expect(
      parseExternalAllowlist(
        "  y@lend.aozora-cg.com , Y@Lend.Aozora-CG.com, other@partner.com ",
        "aozora-cg.com",
      ),
    ).toEqual(["y@lend.aozora-cg.com", "other@partner.com"]);
  });

  it("AC6a: ワイルドカード入り → 起動エラー", () => {
    expect(() => parseExternalAllowlist("*@lend.aozora-cg.com", "aozora-cg.com")).toThrow(
      "Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry",
    );
  });

  it("AC6a: @なし → 起動エラー", () => {
    expect(() => parseExternalAllowlist("not-an-email", "aozora-cg.com")).toThrow(
      "Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry",
    );
  });

  it("AC6a: @ で始まる → 起動エラー", () => {
    expect(() => parseExternalAllowlist("@lend.aozora-cg.com", "aozora-cg.com")).toThrow(
      "Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry",
    );
  });

  it("AC6a: @ で終わる → 起動エラー", () => {
    expect(() => parseExternalAllowlist("user@", "aozora-cg.com")).toThrow(
      "Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry",
    );
  });

  it("AC6a: @ が複数 → 起動エラー", () => {
    expect(() => parseExternalAllowlist("user@@lend.com", "aozora-cg.com")).toThrow(
      "Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry",
    );
  });

  it("AC6b: allowedDomain と同ドメインメール → WARNING ログ出力（パースは通る）", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const result = parseExternalAllowlist("redundant@aozora-cg.com", "aozora-cg.com");
      expect(result).toEqual(["redundant@aozora-cg.com"]);
      const call = logSpy.mock.calls.find((args) =>
        String(args[0]).includes("same domain as ALLOWED_DOMAIN"),
      );
      expect(call).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("カンマ区切りで 1 件でもワイルドカード含むなら全体エラー（fail-fast）", () => {
    expect(() =>
      parseExternalAllowlist("y@lend.aozora-cg.com,*@partner.com", "aozora-cg.com"),
    ).toThrow("Invalid EXTERNAL_READONLY_EMAIL_ALLOWLIST entry");
  });
});
