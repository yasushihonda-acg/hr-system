import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { UserStore } from "../core/middleware/auth.js";
import { createAuthContext } from "../core/middleware/auth.js";
import { createMcpServer } from "../core/server.js";
import { SmartHRClient } from "../core/smarthr-client.js";
import { parseExternalAllowlist } from "./http.js";

/** stdio 用の簡易 UserStore（環境変数 MCP_USER_ROLE で制御） */
const stdioUserStore: UserStore = {
  async getUser(_email: string) {
    const role = process.env.MCP_USER_ROLE === "admin" ? "admin" : "readonly";
    return { role, enabled: true };
  },
};

/**
 * stdio トランスポートで MCP サーバーを起動する
 *
 * Claude Code / Claude Desktop からローカル実行する場合に使用。
 * 環境変数:
 *   SMARTHR_API_KEY (必須), SMARTHR_TENANT_ID (必須)
 *   MCP_USER_EMAIL (任意, デフォルト: local@aozora-cg.com)
 *   MCP_USER_ROLE (任意, "admin" | "readonly", デフォルト: readonly)
 *   ALLOWED_DOMAIN (任意, デフォルト: aozora-cg.com)
 *   EXTERNAL_READONLY_EMAIL_ALLOWLIST (任意) — 外部 readonly 例外メール（カンマ区切り）
 *                                              stdio でも readonly 強制ガードが効く
 */
export async function startStdio(): Promise<void> {
  const apiKey = process.env.SMARTHR_API_KEY;
  const tenantId = process.env.SMARTHR_TENANT_ID;

  if (!apiKey || !tenantId) {
    console.error(
      "Error: SMARTHR_API_KEY and SMARTHR_TENANT_ID environment variables are required.",
    );
    process.exit(1);
  }

  const userEmail = process.env.MCP_USER_EMAIL ?? "local@aozora-cg.com";
  if (!process.env.MCP_USER_EMAIL) {
    console.error(
      "Warning: MCP_USER_EMAIL not set. Using default identity local@aozora-cg.com. " +
        "Audit logs will not reflect actual user identity.",
    );
  }

  const allowedDomain = process.env.ALLOWED_DOMAIN ?? "aozora-cg.com";

  // 外部 readonly 例外メールのパース（HTTP と同じガード、失敗時は起動エラー）
  let externalAllowlist: readonly string[] = [];
  try {
    externalAllowlist = parseExternalAllowlist(
      process.env.EXTERNAL_READONLY_EMAIL_ALLOWLIST,
      allowedDomain,
    );
  } catch (error) {
    console.error(
      `Error: Failed to parse EXTERNAL_READONLY_EMAIL_ALLOWLIST: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  const authContext = createAuthContext(userEmail, "stdio");

  const client = new SmartHRClient({ accessToken: apiKey, tenantId });
  const server = createMcpServer({
    smarthrClient: client,
    resolveAuthContext: () => authContext,
    userStore: stdioUserStore,
    allowedDomain,
    externalAllowlist,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
