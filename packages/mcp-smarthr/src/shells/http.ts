/**
 * HTTP Shell — Hono + Streamable HTTP + Google OAuth ID トークン検証
 *
 * Cloud Run 上で動作し、claude.ai / Cowork / 自社アプリからのアクセスを受け付ける。
 * 認証フロー:
 *   Authorization: Bearer <Google ID Token>
 *   → google-auth-library で検証
 *   → email + hd を抽出 → createAuthContext
 *   → Core の createMcpServer に委譲
 */

import { serve } from "@hono/node-server";
import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { OAuth2Client } from "google-auth-library";
import { cors } from "hono/cors";
import type { AuthContext, UserStore } from "../core/middleware/auth.js";
import { createAuthContext } from "../core/middleware/auth.js";
import { createMcpServer } from "../core/server.js";
import { SmartHRClient } from "../core/smarthr-client.js";

export interface HttpShellOptions {
  smarthrApiKey: string;
  smarthrTenantId: string;
  googleClientId: string;
  allowedDomain?: string;
  userStore: UserStore;
  port?: number;
  /** true にすると OAuth 検証をスキップし、デフォルト AuthContext を使用する（デモ用） */
  authDisabled?: boolean;
}

/**
 * Google OAuth ID トークンを検証し、AuthContext を返す。
 * 検証失敗時は null を返す。
 */
export async function verifyGoogleToken(
  oauthClient: OAuth2Client,
  googleClientId: string,
  authHeader: string | undefined,
): Promise<{ authContext: AuthContext } | { error: string; status: 401 }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Authorization header required", status: 401 };
  }

  const token = authHeader.slice(7);

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return { error: "Invalid token: no email claim", status: 401 };
    }

    const authContext = createAuthContext(payload.email, "http", payload.hd);
    return { authContext };
  } catch (error) {
    console.error(
      JSON.stringify({
        severity: "WARNING",
        message: "OAuth token verification failed",
        error: error instanceof Error ? error.message : String(error),
        source: "mcp-smarthr",
      }),
    );
    return { error: "Invalid or expired token", status: 401 };
  }
}

/**
 * HTTP Shell を起動する。
 *
 * 環境変数:
 *   SMARTHR_API_KEY (必須), SMARTHR_TENANT_ID (必須)
 *   GOOGLE_CLIENT_ID (必須) — Google OAuth クライアント ID
 *   ALLOWED_DOMAIN (任意, デフォルト: aozora-cg.com)
 *   PORT (任意, デフォルト: 8080)
 */
export async function startHttp(options: HttpShellOptions): Promise<void> {
  const {
    smarthrApiKey,
    smarthrTenantId,
    googleClientId,
    allowedDomain = "aozora-cg.com",
    userStore,
    port = 8080,
    authDisabled = false,
  } = options;

  const smarthrClient = new SmartHRClient({
    accessToken: smarthrApiKey,
    tenantId: smarthrTenantId,
  });

  const oauthClient = new OAuth2Client(googleClientId);
  const app = createMcpHonoApp({ host: "0.0.0.0" });

  // CORS（MCP ヘッダーを expose）
  app.use(
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Mcp-Protocol-Version"],
      exposeHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Mcp-Protocol-Version"],
    }),
  );

  // ヘルスチェック（認証不要）
  app.get("/health", (c) => c.json({ status: "ok" }));

  if (authDisabled) {
    console.log(
      JSON.stringify({
        severity: "WARNING",
        message: "Auth is DISABLED — demo mode. Do NOT use in production.",
        source: "mcp-smarthr",
      }),
    );
  }

  // MCP エンドポイント — 認証 + ステートレス Streamable HTTP
  app.all("/mcp", async (c) => {
    let authContext: AuthContext;

    if (authDisabled) {
      // デモモード: 認証スキップ、デフォルト AuthContext を使用
      authContext = createAuthContext("demo@aozora-cg.com", "http");
    } else {
      // 本番モード: Google OAuth トークン検証
      const result = await verifyGoogleToken(
        oauthClient,
        googleClientId,
        c.req.header("authorization"),
      );
      if ("error" in result) {
        return c.json({ error: result.error }, result.status);
      }
      authContext = result.authContext;
    }

    const mcpServer = createMcpServer({
      smarthrClient,
      resolveAuthContext: () => authContext,
      userStore,
      allowedDomain,
    });

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await mcpServer.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  serve({ fetch: app.fetch, port }, () => {
    console.log(
      JSON.stringify({
        severity: "INFO",
        message: `MCP HTTP server listening on port ${port}`,
        allowedDomain,
        source: "mcp-smarthr",
      }),
    );
  });
}
