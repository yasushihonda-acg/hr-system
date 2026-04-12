import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { AuthContext, UserStore } from "../core/middleware/auth.js";
import { createMcpServer } from "../core/server.js";
import { SmartHRClient } from "../core/smarthr-client.js";

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

  const authContext: AuthContext = {
    email: userEmail,
    domain: userEmail.split("@")[1] ?? "",
    transport: "stdio",
  };

  const client = new SmartHRClient({ accessToken: apiKey, tenantId });
  const server = createMcpServer({
    smarthrClient: client,
    resolveAuthContext: () => authContext,
    userStore: stdioUserStore,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
