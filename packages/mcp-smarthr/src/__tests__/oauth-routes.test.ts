import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { UserStore } from "../core/middleware/auth.js";
import { createOAuthRoutes } from "../core/oauth/routes.js";

const TEST_CONFIG = {
  serverUrl: "https://mcp-smarthr.example.com",
  googleClientId: "test-google-client-id",
  googleClientSecret: "test-google-client-secret",
  jwtSecret: "test-secret-key-for-jwt-signing-at-least-32-chars",
  allowedDomain: "aozora-cg.com",
};

const testUserStore: UserStore = {
  async getUser(_email: string) {
    return { role: "readonly" as const, enabled: true };
  },
};

function createApp() {
  return createOAuthRoutes(TEST_CONFIG, testUserStore);
}

describe("OAuth Routes — .well-known endpoints", () => {
  it("GET /.well-known/oauth-protected-resource → 200 + メタデータ", async () => {
    const app = createApp();
    const res = await app.request("/.well-known/oauth-protected-resource");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.resource).toBe(TEST_CONFIG.serverUrl);
    expect(body.authorization_servers).toContain(TEST_CONFIG.serverUrl);
    expect(body.bearer_methods_supported).toContain("header");
  });

  it("GET /.well-known/oauth-authorization-server → 200 + AS メタデータ", async () => {
    const app = createApp();
    const res = await app.request("/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.issuer).toBe(TEST_CONFIG.serverUrl);
    expect(body.authorization_endpoint).toContain("/authorize");
    expect(body.token_endpoint).toContain("/token");
    expect(body.registration_endpoint).toContain("/register");
    expect(body.code_challenge_methods_supported).toContain("S256");
  });
});

describe("OAuth Routes — /authorize", () => {
  it("PKCE なしのリクエスト → 400", async () => {
    const app = createApp();
    const res = await app.request(
      "/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback",
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_request");
  });

  it("response_type が code 以外 → 400", async () => {
    const app = createApp();
    const res = await app.request(
      "/authorize?response_type=token&client_id=test&redirect_uri=http://localhost:3000/callback&code_challenge=abc&code_challenge_method=S256",
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("unsupported_response_type");
  });

  it("正しいパラメータ → Google OIDC にリダイレクト", async () => {
    const app = createApp();
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const res = await app.request(
      `/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback&code_challenge=${codeChallenge}&code_challenge_method=S256&state=mystate`,
      { redirect: "manual" },
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("openid");
  });
});

describe("OAuth Routes — /token", () => {
  it("grant_type が authorization_code 以外 → 400", async () => {
    const app = createApp();
    const res = await app.request("/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("unsupported_grant_type");
  });

  it("無効な認可コード → 400", async () => {
    const app = createApp();
    const res = await app.request("/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: "invalid-code",
        code_verifier: "test-verifier",
        client_id: "test-client",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_grant");
  });
});

describe("OAuth Routes — /register", () => {
  it("正常: Dynamic Client Registration", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://localhost:3000/callback"],
        client_name: "Test Client",
        token_endpoint_auth_method: "none",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.client_id).toBeTruthy();
    expect(body.redirect_uris).toContain("http://localhost:3000/callback");
    expect(body.grant_types).toContain("authorization_code");
  });

  it("redirect_uris なし → 400", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "No URIs" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("HTTP redirect_uri（localhost 以外）→ 400", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://evil.com/callback"],
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("invalid_client_metadata");
  });

  it("HTTPS redirect_uri → OK", async () => {
    const app = createApp();
    const res = await app.request("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["https://app.example.com/callback"],
      }),
    });
    expect(res.status).toBe(201);
  });
});
