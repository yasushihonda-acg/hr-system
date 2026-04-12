import { describe, expect, it, vi } from "vitest";
import { verifyGoogleToken } from "../shells/http.js";

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
