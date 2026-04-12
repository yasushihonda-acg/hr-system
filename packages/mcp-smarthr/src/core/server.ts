import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditLogStore } from "./middleware/audit-logger.js";
import { AuditLogger } from "./middleware/audit-logger.js";
import type { AuthContext, UserStore } from "./middleware/auth.js";
import { Authorizer, TOOL_PERMISSIONS } from "./middleware/auth.js";
import { filterPII } from "./middleware/pii-filter.js";
import type { SmartHRClient } from "./smarthr-client.js";
import { defineTools } from "./tools.js";

export interface CreateServerOptions {
  smarthrClient: SmartHRClient;
  /** 認証コンテキスト解決器（Shell 層が提供） */
  resolveAuthContext: () => AuthContext;
  /** ユーザー許可リスト（Firestore 等） */
  userStore: UserStore;
  /** 許可ドメイン */
  allowedDomain?: string;
  /** 監査ログの永続化ストア（オプション） */
  auditLogStore?: AuditLogStore;
}

/**
 * McpServer インスタンスを生成する（トランスポート非依存）
 *
 * 全ツール呼び出しに対して以下のパイプラインを強制する:
 *   authorize → audit log → handler → filterPII
 *
 * - 未登録ツールは default deny
 * - stdio でも許可リストを尊重（未登録ユーザーは readonly）
 */
export function createMcpServer(options: CreateServerOptions): McpServer {
  const {
    smarthrClient,
    resolveAuthContext,
    userStore,
    allowedDomain = "aozora-cg.com",
    auditLogStore,
  } = options;

  const tools = defineTools(smarthrClient);
  const authorizer = new Authorizer(allowedDomain, userStore);
  const auditLogger = new AuditLogger(auditLogStore);

  const server = new McpServer({
    name: "acg-smarthr",
    version: "0.1.0",
  });

  for (const [name, tool] of Object.entries(tools)) {
    // H3修正: 未登録ツールは登録しない（default deny）
    if (!(name in TOOL_PERMISSIONS)) continue;

    server.tool(name, tool.description, tool.shape, async (params: Record<string, unknown>) => {
      const authContext = resolveAuthContext();

      // Layer 1-4: 認可チェック
      const authResult = await authorizer.authorize(authContext, name);
      if (!authResult.authorized) {
        // 拒否時も監査ログを記録
        await auditLogger
          .logToolCall(name, authContext.email, params, async () => {
            throw new Error(authResult.reason ?? "アクセスが拒否されました");
          })
          .catch(() => {});
        return {
          content: [{ type: "text" as const, text: `アクセス拒否: ${authResult.reason}` }],
          isError: true,
        };
      }

      // 認可OK → 監査ログ付きでハンドラ実行 → PII フィルタ適用
      try {
        const result = await auditLogger.logToolCall(name, authContext.email, params, () =>
          tool.handler(params as never),
        );

        // H4修正: 結果にPIIフィルタを適用
        const filtered = filterPII(JSON.parse(result), authResult.role);
        return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  return server;
}
