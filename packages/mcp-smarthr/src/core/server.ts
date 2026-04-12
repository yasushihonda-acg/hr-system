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
 *   resolveAuthContext → authorize → audit log → handler → filterPII
 *
 * - 未登録ツールは default deny（TOOL_PERMISSIONS に無いツールは登録しない）
 * - 認証・認可の失敗時は fail-closed（アクセス拒否）
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
    if (!(name in TOOL_PERMISSIONS)) continue;

    server.tool(
      name,
      tool.description,
      tool.shape,
      tool.annotations,
      async (params: Record<string, unknown>) => {
        // --- fail-closed: 認証コンテキスト解決・認可チェックの失敗はアクセス拒否 ---
        let authContext: AuthContext;
        try {
          authContext = resolveAuthContext();
        } catch (error) {
          console.error(
            JSON.stringify({
              severity: "ERROR",
              message: "Failed to resolve auth context",
              tool: name,
              error: error instanceof Error ? error.message : String(error),
              source: "mcp-smarthr",
            }),
          );
          return {
            content: [
              { type: "text" as const, text: "Error: 認証コンテキストの解決に失敗しました" },
            ],
            isError: true,
          };
        }

        let authResult: Awaited<ReturnType<typeof authorizer.authorize>>;
        try {
          authResult = await authorizer.authorize(authContext, name);
        } catch (error) {
          console.error(
            JSON.stringify({
              severity: "ERROR",
              message: "Authorization system failure - denying access",
              tool: name,
              email: authContext.email,
              error: error instanceof Error ? error.message : String(error),
              source: "mcp-smarthr",
            }),
          );
          return {
            content: [{ type: "text" as const, text: "Error: 認証システムエラー" }],
            isError: true,
          };
        }

        if (!authResult.authorized) {
          const reason = authResult.reason ?? "アクセスが拒否されました";
          await auditLogger.logDenied(name, authContext.email, params, reason);
          return {
            content: [{ type: "text" as const, text: `アクセス拒否: ${reason}` }],
            isError: true,
          };
        }

        // 認可OK → 監査ログ付きでハンドラ実行 → PII フィルタ適用
        try {
          const result: unknown = await auditLogger.logToolCall(
            name,
            authContext.email,
            params,
            () => tool.handler(params as never),
          );

          // handler はオブジェクトを返すため、直接 PII フィルタを適用
          const filtered = filterPII(result, authResult.role);
          return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
        } catch (error) {
          // エラーメッセージに PII が含まれる可能性があるため、汎用メッセージを返す
          console.error(
            JSON.stringify({
              severity: "ERROR",
              message: error instanceof Error ? error.message : String(error),
              tool: name,
              email: authContext.email,
              source: "mcp-smarthr",
            }),
          );
          return {
            content: [{ type: "text" as const, text: "Error: ツール実行中にエラーが発生しました" }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
