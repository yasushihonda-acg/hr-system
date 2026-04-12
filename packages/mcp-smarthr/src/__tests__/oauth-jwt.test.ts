import { describe, expect, it } from "vitest";
import { buildAuthServerMetadata, buildProtectedResourceMetadata } from "../core/oauth/config.js";
import { issueAccessToken, verifyAccessToken } from "../core/oauth/jwt.js";

const TEST_SECRET = "test-secret-key-for-jwt-signing-at-least-32-chars";
const TEST_SERVER_URL = "https://mcp-smarthr.example.com";

describe("JWT issueAccessToken / verifyAccessToken", () => {
  it("正常: 発行したトークンを検証できる", async () => {
    const token = await issueAccessToken(
      { email: "user@aozora-cg.com", domain: "aozora-cg.com", role: "readonly" },
      TEST_SECRET,
      { serverUrl: TEST_SERVER_URL },
    );

    const claims = await verifyAccessToken(token, TEST_SECRET, TEST_SERVER_URL);
    expect(claims.email).toBe("user@aozora-cg.com");
    expect(claims.domain).toBe("aozora-cg.com");
    expect(claims.role).toBe("readonly");
    expect(claims.sub).toBe("user@aozora-cg.com");
    expect(claims.iss).toBe(TEST_SERVER_URL);
    expect(claims.aud).toBe(TEST_SERVER_URL);
  });

  it("正常: admin ロールのトークン", async () => {
    const token = await issueAccessToken(
      { email: "admin@aozora-cg.com", domain: "aozora-cg.com", role: "admin" },
      TEST_SECRET,
      { serverUrl: TEST_SERVER_URL },
    );

    const claims = await verifyAccessToken(token, TEST_SECRET, TEST_SERVER_URL);
    expect(claims.role).toBe("admin");
  });

  it("異常: 不正なシークレットで検証失敗", async () => {
    const token = await issueAccessToken(
      { email: "user@aozora-cg.com", domain: "aozora-cg.com", role: "readonly" },
      TEST_SECRET,
      { serverUrl: TEST_SERVER_URL },
    );

    await expect(
      verifyAccessToken(token, "wrong-secret-key-that-does-not-match!!", TEST_SERVER_URL),
    ).rejects.toThrow();
  });

  it("異常: 不正な audience で検証失敗", async () => {
    const token = await issueAccessToken(
      { email: "user@aozora-cg.com", domain: "aozora-cg.com", role: "readonly" },
      TEST_SECRET,
      { serverUrl: TEST_SERVER_URL },
    );

    await expect(
      verifyAccessToken(token, TEST_SECRET, "https://other-server.example.com"),
    ).rejects.toThrow();
  });

  it("異常: 有効期限切れのトークン", async () => {
    const token = await issueAccessToken(
      { email: "user@aozora-cg.com", domain: "aozora-cg.com", role: "readonly" },
      TEST_SECRET,
      { serverUrl: TEST_SERVER_URL, expiresIn: 0 },
    );

    // jose は 0 秒 JWT を即座に期限切れと判断するが、
    // clockTolerance があるため 1 秒待つ
    await new Promise((r) => setTimeout(r, 1100));

    await expect(verifyAccessToken(token, TEST_SECRET, TEST_SERVER_URL)).rejects.toThrow();
  });
});

describe("OAuth Metadata builders", () => {
  it("Protected Resource Metadata に必須フィールドが含まれる", () => {
    const meta = buildProtectedResourceMetadata(TEST_SERVER_URL);
    expect(meta.resource).toBe(TEST_SERVER_URL);
    expect(meta.authorization_servers).toContain(TEST_SERVER_URL);
    expect(meta.bearer_methods_supported).toContain("header");
  });

  it("Auth Server Metadata に必須エンドポイントが含まれる", () => {
    const meta = buildAuthServerMetadata(TEST_SERVER_URL);
    expect(meta.issuer).toBe(TEST_SERVER_URL);
    expect(meta.authorization_endpoint).toBe(`${TEST_SERVER_URL}/authorize`);
    expect(meta.token_endpoint).toBe(`${TEST_SERVER_URL}/token`);
    expect(meta.registration_endpoint).toBe(`${TEST_SERVER_URL}/register`);
    expect(meta.code_challenge_methods_supported).toContain("S256");
    expect(meta.response_types_supported).toContain("code");
  });

  it("末尾スラッシュが正規化される", () => {
    const meta = buildProtectedResourceMetadata(`${TEST_SERVER_URL}/`);
    expect(meta.resource).toBe(TEST_SERVER_URL);
  });
});
