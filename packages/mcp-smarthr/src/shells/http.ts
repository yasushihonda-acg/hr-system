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

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
  /** true にすると Anthropic IP 範囲のみ /mcp へのアクセスを許可する */
  ipRestrictionEnabled?: boolean;
}

/**
 * Anthropic の公開 IP 範囲（MCP ツール呼び出し用）
 * @see https://platform.claude.com/docs/en/api/ip-addresses
 */
const ANTHROPIC_IP_CIDR = "160.79.104.0/21";

/** CIDR 範囲にIPアドレスが含まれるか判定する */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [cidrBase, prefixLenStr] = cidr.split("/");
  if (!cidrBase || !prefixLenStr) return false;
  const prefixLen = Number(prefixLenStr);

  const ipNum = ipToNumber(ip);
  const cidrNum = ipToNumber(cidrBase);
  if (ipNum === null || cidrNum === null) return false;

  const mask = ~((1 << (32 - prefixLen)) - 1) >>> 0;
  return (ipNum & mask) === (cidrNum & mask);
}

function ipToNumber(ip: string): number | null {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) を処理
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const p of parts) {
    const n = Number(p);
    if (Number.isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
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
    ipRestrictionEnabled = false,
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

  // ヘルスチェック（認証不要・IP 制限なし）
  app.get("/health", (c) => c.json({ status: "ok" }));

  // ドキュメントページ（認証不要・IP 制限なし）
  app.get("/docs", (c) => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(resolve(__dirname, "../../static/docs.html"), "utf-8");
    return c.html(html);
  });

  // Anthropic IP 制限（/mcp のみ）
  if (ipRestrictionEnabled) {
    app.use("/mcp", async (c, next) => {
      // Cloud Run では X-Forwarded-For ヘッダーでクライアント IP を取得
      const forwarded = c.req.header("x-forwarded-for");
      const clientIp = forwarded?.split(",")[0]?.trim() ?? "";

      if (!clientIp || !isIpInCidr(clientIp, ANTHROPIC_IP_CIDR)) {
        console.log(
          JSON.stringify({
            severity: "WARNING",
            message: "Blocked non-Anthropic IP",
            clientIp,
            source: "mcp-smarthr",
          }),
        );
        return c.json({ error: "Forbidden" }, 403);
      }
      await next();
    });
  }

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
