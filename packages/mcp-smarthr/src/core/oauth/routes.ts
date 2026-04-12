/**
 * OAuth 2.1 Authorization Server ルート定義（Hono）
 *
 * MCP 仕様準拠の「意図的に狭い AS」:
 *   - authorization_code + PKCE のみ
 *   - リフレッシュトークンなし
 *   - 短寿命アクセストークン（JWT）
 *   - Google OIDC への認証委譲
 *   - Dynamic Client Registration（匿名、厳格な登録ポリシー）
 */

import { createHash, randomBytes } from "node:crypto";
import { Hono } from "hono";
import type { UserStore } from "../middleware/auth.js";
import {
  buildAuthServerMetadata,
  buildProtectedResourceMetadata,
  GOOGLE_OIDC,
  type OAuthConfig,
} from "./config.js";
import { issueAccessToken } from "./jwt.js";

/** 認可コード（一時的、メモリ保持、TTL 付き） */
interface AuthCodeEntry {
  /** Google から取得したユーザー email */
  email: string;
  /** Google Workspace ドメイン */
  domain: string;
  /** PKCE code_challenge（S256） */
  codeChallenge: string;
  /** クライアント ID */
  clientId: string;
  /** リダイレクト URI */
  redirectUri: string;
  /** MCP リソース URI（RFC 8707） */
  resource?: string;
  /** 有効期限 */
  expiresAt: number;
}

/** Dynamic Client Registration エントリ */
interface RegisteredClient {
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientName?: string;
  tokenEndpointAuthMethod: string;
}

const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5分

export function createOAuthRoutes(config: OAuthConfig, userStore: UserStore): Hono {
  const app = new Hono();

  // インメモリストア（Cloud Run 1 インスタンス前提）
  const authCodes = new Map<string, AuthCodeEntry>();
  const registeredClients = new Map<string, RegisteredClient>();
  // state → { codeChallenge, clientId, redirectUri, resource } の一時保存
  const pendingAuths = new Map<
    string,
    {
      codeChallenge: string;
      clientId: string;
      redirectUri: string;
      resource?: string;
      clientState?: string;
      expiresAt: number;
    }
  >();

  const serverUrl = config.serverUrl.replace(/\/$/, "");
  const MAX_REGISTERED_CLIENTS = 100;

  /** セキュリティイベントをログに記録する */
  function logSecurityEvent(event: string, details?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        severity: "WARNING",
        message: event,
        ...details,
        source: "mcp-smarthr",
      }),
    );
  }

  // 期限切れエントリのクリーンアップ
  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of authCodes) {
      if (now > entry.expiresAt) authCodes.delete(key);
    }
    for (const [key, entry] of pendingAuths) {
      if (now > entry.expiresAt) pendingAuths.delete(key);
    }
  }

  // --- RFC 9728: Protected Resource Metadata ---
  app.get("/.well-known/oauth-protected-resource", (c) => {
    return c.json(buildProtectedResourceMetadata(serverUrl));
  });

  // --- RFC 8414: Authorization Server Metadata ---
  app.get("/.well-known/oauth-authorization-server", (c) => {
    return c.json(buildAuthServerMetadata(serverUrl));
  });

  // --- GET /authorize: OAuth 2.1 Authorization Endpoint ---
  app.get("/authorize", (c) => {
    cleanup();

    const responseType = c.req.query("response_type");
    const clientId = c.req.query("client_id");
    const redirectUri = c.req.query("redirect_uri");
    const codeChallenge = c.req.query("code_challenge");
    const codeChallengeMethod = c.req.query("code_challenge_method");
    const state = c.req.query("state");
    const resource = c.req.query("resource");

    // バリデーション
    if (responseType !== "code") {
      return c.json({ error: "unsupported_response_type" }, 400);
    }
    if (!clientId || !redirectUri) {
      return c.json(
        { error: "invalid_request", error_description: "client_id and redirect_uri required" },
        400,
      );
    }
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return c.json(
        { error: "invalid_request", error_description: "PKCE with S256 required" },
        400,
      );
    }

    // 登録済みクライアントの場合、redirect_uri を検証
    const client = registeredClients.get(clientId);
    if (client && !client.redirectUris.includes(redirectUri)) {
      return c.json({ error: "invalid_request", error_description: "redirect_uri mismatch" }, 400);
    }

    // state を生成して pending に保存
    const internalState = randomBytes(32).toString("hex");
    pendingAuths.set(internalState, {
      codeChallenge,
      clientId,
      redirectUri,
      resource,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });

    // Google OIDC にリダイレクト
    const googleParams = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${serverUrl}/oauth/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      state: internalState,
      hd: config.allowedDomain ?? "aozora-cg.com",
      prompt: "consent",
    });

    // 元のクライアント state を callback 時に redirectUri に付与するため一時保管
    if (state) {
      const pending = pendingAuths.get(internalState);
      if (pending) {
        pending.clientState = state;
      }
    }

    return c.redirect(`${GOOGLE_OIDC.authorizationEndpoint}?${googleParams}`);
  });

  // --- GET /oauth/callback: Google OIDC Callback ---
  app.get("/oauth/callback", async (c) => {
    const googleCode = c.req.query("code");
    const internalState = c.req.query("state");
    const error = c.req.query("error");

    if (error) {
      return c.json({ error: "access_denied", error_description: error }, 400);
    }

    if (!googleCode || !internalState) {
      return c.json({ error: "invalid_request" }, 400);
    }

    const pending = pendingAuths.get(internalState);
    if (!pending || Date.now() > pending.expiresAt) {
      pendingAuths.delete(internalState ?? "");
      return c.json(
        { error: "invalid_request", error_description: "expired or invalid state" },
        400,
      );
    }
    pendingAuths.delete(internalState);

    // Google 認可コードをトークンに交換してユーザー情報を取得
    let email: string;
    let domain: string;
    try {
      const tokenRes = await fetch(GOOGLE_OIDC.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: googleCode,
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: `${serverUrl}/oauth/callback`,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error(
          JSON.stringify({
            severity: "ERROR",
            message: "Google token exchange failed",
            status: tokenRes.status,
            body,
            source: "mcp-smarthr",
          }),
        );
        return c.json(
          { error: "server_error", error_description: "Google token exchange failed" },
          500,
        );
      }

      const tokenData = (await tokenRes.json()) as { access_token: string; id_token?: string };

      // userinfo で email と hd を取得
      const userinfoRes = await fetch(GOOGLE_OIDC.userinfoEndpoint, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userinfoRes.ok) {
        return c.json(
          { error: "server_error", error_description: "Failed to fetch user info" },
          500,
        );
      }

      const userinfo = (await userinfoRes.json()) as { email: string; hd?: string };
      email = userinfo.email;
      domain = userinfo.hd ?? email.split("@")[1] ?? "";
    } catch (err) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "OAuth callback error",
          error: err instanceof Error ? err.message : String(err),
          source: "mcp-smarthr",
        }),
      );
      return c.json({ error: "server_error" }, 500);
    }

    // ドメイン検証
    const allowedDomain = config.allowedDomain ?? "aozora-cg.com";
    if (domain !== allowedDomain) {
      console.log(
        JSON.stringify({
          severity: "WARNING",
          message: "Domain validation failed",
          userDomain: domain,
          allowedDomain,
          source: "mcp-smarthr",
        }),
      );
      return c.json(
        {
          error: "access_denied",
          error_description: "Your account is not authorized to access this resource.",
        },
        403,
      );
    }

    // 認可コード発行（一回限り使用）
    const authCode = randomBytes(32).toString("hex");
    authCodes.set(authCode, {
      email,
      domain,
      codeChallenge: pending.codeChallenge,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      resource: pending.resource,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });

    // クライアントの redirect_uri に認可コードを返す
    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set("code", authCode);
    const clientState = pending.clientState;
    if (clientState) {
      redirectUrl.searchParams.set("state", clientState);
    }

    return c.redirect(redirectUrl.toString());
  });

  // --- POST /token: Token Endpoint ---
  app.post("/token", async (c) => {
    cleanup();

    const body = await c.req.parseBody();
    const grantType = body.grant_type as string | undefined;
    const code = body.code as string | undefined;
    const codeVerifier = body.code_verifier as string | undefined;
    const clientId = body.client_id as string | undefined;
    const redirectUri = body.redirect_uri as string | undefined;

    if (grantType !== "authorization_code") {
      return c.json({ error: "unsupported_grant_type" }, 400);
    }

    if (!code || !codeVerifier || !clientId) {
      return c.json(
        { error: "invalid_request", error_description: "code, code_verifier, client_id required" },
        400,
      );
    }

    const entry = authCodes.get(code);
    if (!entry) {
      return c.json(
        { error: "invalid_grant", error_description: "invalid or expired authorization code" },
        400,
      );
    }

    // 一回限り使用 — 即座に削除
    authCodes.delete(code);

    // 有効期限チェック
    if (Date.now() > entry.expiresAt) {
      logSecurityEvent("Authorization code expired", { clientId });
      return c.json(
        { error: "invalid_grant", error_description: "authorization code expired" },
        400,
      );
    }

    // クライアント ID 一致チェック
    if (entry.clientId !== clientId) {
      logSecurityEvent("Client ID mismatch in token exchange", {
        expected: entry.clientId,
        received: clientId,
      });
      return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
    }

    // redirect_uri 一致チェック（OAuth 2.1: 必須）
    if (!redirectUri || entry.redirectUri !== redirectUri) {
      logSecurityEvent("redirect_uri mismatch in token exchange", { clientId });
      return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
    }

    // PKCE 検証（S256）
    const expectedChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (expectedChallenge !== entry.codeChallenge) {
      logSecurityEvent("PKCE verification failed", { clientId });
      return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }

    // UserStore からロールを取得（fail-closed: エラー時はアクセス拒否）
    let user: Awaited<ReturnType<typeof userStore.getUser>>;
    try {
      user = await userStore.getUser(entry.email);
    } catch (err) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "UserStore lookup failed",
          email: entry.email,
          error: err instanceof Error ? err.message : String(err),
          source: "mcp-smarthr",
        }),
      );
      return c.json(
        { error: "server_error", error_description: "Unable to verify user permissions" },
        500,
      );
    }

    // fail-closed: 未登録ユーザーはアクセス拒否
    if (!user) {
      console.log(
        JSON.stringify({
          severity: "WARNING",
          message: "User not found in store",
          email: entry.email,
          source: "mcp-smarthr",
        }),
      );
      return c.json({ error: "access_denied", error_description: "User not provisioned" }, 403);
    }

    if (!user.enabled) {
      return c.json({ error: "access_denied", error_description: "User account is disabled" }, 403);
    }

    // JWT アクセストークン発行
    const expiresIn = config.jwtExpiresIn ?? 3600;
    let accessToken: string;
    try {
      accessToken = await issueAccessToken(
        { email: entry.email, domain: entry.domain, role: user.role },
        config.jwtSecret,
        { serverUrl, expiresIn },
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "JWT issuance failed",
          error: err instanceof Error ? err.message : String(err),
          source: "mcp-smarthr",
        }),
      );
      return c.json({ error: "server_error" }, 500);
    }

    return c.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: user.role === "admin" ? "mcp:read mcp:write" : "mcp:read",
    });
  });

  // --- POST /register: Dynamic Client Registration (RFC 7591) ---
  app.post("/register", async (c) => {
    // サイズ上限チェック（DoS 防止）
    if (registeredClients.size >= MAX_REGISTERED_CLIENTS) {
      return c.json(
        { error: "server_error", error_description: "Registration limit reached" },
        503,
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch (err) {
      logSecurityEvent("Invalid JSON in client registration", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "invalid_client_metadata" }, 400);
    }

    const redirectUris = body.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "redirect_uris required",
        },
        400,
      );
    }

    // redirect_uri 検証: localhost または HTTPS のみ許可
    for (const uri of redirectUris) {
      if (typeof uri !== "string") {
        return c.json(
          { error: "invalid_client_metadata", error_description: "invalid redirect_uri" },
          400,
        );
      }
      try {
        const parsed = new URL(uri);
        const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        if (!isLocalhost && parsed.protocol !== "https:") {
          return c.json(
            {
              error: "invalid_client_metadata",
              error_description: "redirect_uri must use HTTPS or localhost",
            },
            400,
          );
        }
      } catch {
        return c.json(
          { error: "invalid_client_metadata", error_description: "invalid redirect_uri format" },
          400,
        );
      }
    }

    const clientId = randomBytes(16).toString("hex");
    const clientSecret = randomBytes(32).toString("hex");
    const authMethod = (body.token_endpoint_auth_method as string) ?? "client_secret_post";

    const client: RegisteredClient = {
      clientId,
      clientSecret: authMethod === "none" ? undefined : clientSecret,
      redirectUris: redirectUris as string[],
      clientName: body.client_name as string | undefined,
      tokenEndpointAuthMethod: authMethod,
    };

    registeredClients.set(clientId, client);

    return c.json(
      {
        client_id: clientId,
        client_secret: client.clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: client.redirectUris,
        client_name: client.clientName,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: ["authorization_code"],
        response_types: ["code"],
      },
      201,
    );
  });

  return app;
}
